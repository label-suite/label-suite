// Regression tests for scripts/check-security-headers.sh.
// Run: node --test scripts/tests/check-security-headers.test.mjs
//
// Each case starts a throwaway Node HTTP server on 127.0.0.1 that answers the
// paths the script requests (design D2) with chosen status codes and headers,
// then runs `<bash> scripts/check-security-headers.sh [--backend-down] <url>`
// and asserts the exit code and the output (design D3). `<bash>` is
// $CHECK_HEADERS_BASH, or `bash` on PATH when unset; on macOS
// CHECK_HEADERS_BASH=/bin/bash runs every case on the built-in bash 3.2.
//
// The expected header values are not repeated here: they are read from the
// script's EXPECTED block, which stays the only place they are written
// (system-design D4). What these tests pin is the judging logic - missing,
// wrong value, duplicated, forbidden headers and wrong status codes.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const SCRIPT = fileURLToPath(new URL("../check-security-headers.sh", import.meta.url));
const BASH = process.env.CHECK_HEADERS_BASH || "bash";
const ASSET = "/assets/index-Abc123.js";

/** Reads the "Name: value" lines between the script's EXPECTED heredoc markers. */
function readExpected() {
  const source = readFileSync(SCRIPT, "utf8");
  const match = source.match(/<<'EXPECTED'\n([\s\S]*?)\nEXPECTED\n/);
  assert.ok(match, "the script has an EXPECTED heredoc");
  return match[1].split("\n").map((line) => {
    const at = line.indexOf(": ");
    return [line.slice(0, at), line.slice(at + 2)];
  });
}

const EXPECTED = readExpected();
const EXPECTED_VALUE = Object.fromEntries(EXPECTED);
const CSP = EXPECTED_VALUE["Content-Security-Policy"];

/** The status each path answers on a healthy entry point. */
function defaultStatus(method, path) {
  if (method === "POST" && path === "/") return 405;
  if (path === "/api/v1/does-not-exist") return 404;
  return 200;
}

/**
 * Starts a fake public entry point.
 *
 * @param {object} [options]
 * @param {(req, headers: Record<string, string | string[]>) => void} [options.editHeaders]
 *   Mutates the headers of one response; starts from the expected set.
 * @param {(req) => number} [options.status] Overrides the status code.
 * @param {string} [options.shell] The page shell's body.
 * @returns {Promise<{url: string, seen: string[], close: () => Promise<void>}>}
 */
async function startServer({ editHeaders, status, shell } = {}) {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    const headers = Object.fromEntries(EXPECTED);
    if (editHeaders) editHeaders(req, headers);
    const code = status ? status(req) : defaultStatus(req.method, req.url);
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    const body =
      req.url === "/" && req.method === "GET"
        ? (shell ?? `<script type="module" crossorigin src="${ASSET}"></script>`)
        : "x";
    res.writeHead(code);
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    seen,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Runs the script asynchronously, so the in-process server can still answer. */
function run(args, env = {}) {
  return new Promise((resolve) => {
    execFile(
      BASH,
      [SCRIPT, ...args],
      { encoding: "utf8", env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === "number" ? error.code : -1) : 0;
        resolve({ code, output: stdout + stderr });
      },
    );
  });
}

/** Starts a server, runs the script against it and closes the server. */
async function check(serverOptions, extraArgs = []) {
  const server = await startServer(serverOptions);
  try {
    const result = await run([...extraArgs, server.url]);
    return { ...result, seen: server.seen };
  } finally {
    await server.close();
  }
}

const isApi = (req) => req.url.startsWith("/api/v1/");
const hasCredentials = (req) =>
  req.headers.cookie !== undefined && req.headers.authorization !== undefined;

describe("check-security-headers.sh", () => {
  test("the EXPECTED block lists the seven headers of system-design D0", () => {
    assert.deepEqual(
      EXPECTED.map(([name]) => name),
      [
        "Content-Security-Policy",
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Cross-Origin-Opener-Policy",
        "Permissions-Policy",
        "Server",
      ],
    );
  });

  test("every category matches: exit 0, and every category was requested", async () => {
    const r = await check({});
    assert.equal(r.code, 0, r.output);
    for (const request of [
      "GET /",
      "GET /some/spa/path",
      `GET ${ASSET}`,
      "GET /api/v1/health",
      "GET /api/v1/does-not-exist",
      "POST /",
    ]) {
      assert.ok(r.seen.includes(request), `${request} was requested: ${r.seen.join(", ")}`);
    }
  });

  test("the credential variants send a Cookie and a Bearer token", async () => {
    const withCredentials = [];
    const r = await check({
      editHeaders: (req) => {
        if (hasCredentials(req)) {
          withCredentials.push(`${req.url} ${req.headers.cookie} ${req.headers.authorization}`);
        }
      },
    });
    assert.equal(r.code, 0, r.output);
    assert.deepEqual(withCredentials.sort(), [
      "/ session=probe Bearer probe",
      "/api/v1/health session=probe Bearer probe",
    ]);
  });

  test("one category without CSP: exit 1, naming the category, header, expected and <missing>", async () => {
    const r = await check({
      editHeaders: (req, headers) => {
        if (req.url === "/some/spa/path") delete headers["Content-Security-Policy"];
      },
    });
    assert.equal(r.code, 1, r.output);
    const line = r.output.split("\n").find((l) => l.includes("Content-Security-Policy"));
    assert.ok(line, r.output);
    assert.match(line, /SPA deep path/);
    assert.ok(line.includes(CSP), line);
    assert.ok(line.includes("<missing>"), line);
  });

  test("X-Frame-Options is DENY: exit 1 with SAMEORIGIN expected and DENY found", async () => {
    const r = await check({
      editHeaders: (_req, headers) => {
        headers["X-Frame-Options"] = "DENY";
      },
    });
    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /page shell.*X-Frame-Options.*SAMEORIGIN.*DENY/);
  });

  test("X-Frame-Options twice on both backend categories: exit 1 with the count", async () => {
    const r = await check({
      editHeaders: (req, headers) => {
        if (isApi(req)) headers["X-Frame-Options"] = ["SAMEORIGIN", "DENY"];
      },
    });
    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /backend success.*X-Frame-Options.*SAMEORIGIN.*2 occurrences/);
    assert.match(r.output, /backend error.*X-Frame-Options.*SAMEORIGIN.*2 occurrences/);
    assert.doesNotMatch(r.output, /page shell[^\n]*X-Frame-Options/);
  });

  test("Strict-Transport-Security present: exit 1, expected <absent>", async () => {
    const r = await check({
      editHeaders: (_req, headers) => {
        headers["Strict-Transport-Security"] = "max-age=60";
      },
    });
    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /page shell.*Strict-Transport-Security.*<absent>.*max-age=60/);
  });

  test("Content-Security-Policy-Report-Only present: exit 1, expected <absent>", async () => {
    const r = await check({
      editHeaders: (_req, headers) => {
        headers["Content-Security-Policy-Report-Only"] = "default-src 'self'";
      },
    });
    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /Content-Security-Policy-Report-Only.*<absent>/);
  });

  test("Server carries a version: exit 1 with nginx expected and the version found", async () => {
    const r = await check({
      editHeaders: (_req, headers) => {
        headers.Server = "nginx/1.31.10";
      },
    });
    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /nginx error.*Server.*"nginx".*"nginx\/1\.31\.10"/);
  });

  test("the backend error answers 200 instead of 404: exit 1 on the status", async () => {
    const r = await check({
      status: (req) =>
        req.url === "/api/v1/does-not-exist" ? 200 : defaultStatus(req.method, req.url),
    });
    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /backend error.*status.*404.*200/);
  });

  test("a credential variant without a header: exit 1 naming that variant only", async () => {
    const r = await check({
      editHeaders: (req, headers) => {
        if (hasCredentials(req) && isApi(req)) delete headers["Referrer-Policy"];
      },
    });
    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /backend success with credentials.*Referrer-Policy.*<missing>/);
    const mismatches = r.output.split("\n").filter((l) => l.includes("Referrer-Policy"));
    assert.equal(mismatches.length, 1, r.output);
  });

  test("--backend-down with a 502 that matches: exit 0, only the health path requested", async () => {
    const r = await check({ status: () => 502 }, ["--backend-down"]);
    assert.equal(r.code, 0, r.output);
    assert.deepEqual(r.seen, ["GET /api/v1/health"]);
  });

  test("--backend-down with a 504 that matches: exit 0 (clarification Q11)", async () => {
    const r = await check({ status: () => 504 }, ["--backend-down"]);
    assert.equal(r.code, 0, r.output);
    assert.deepEqual(r.seen, ["GET /api/v1/health"]);
  });

  test("--backend-down with a 504 missing a header: exit 1 naming the header", async () => {
    const r = await check(
      {
        status: () => 504,
        editHeaders: (_req, headers) => {
          delete headers["Permissions-Policy"];
        },
      },
      ["--backend-down"],
    );
    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /backend down.*Permissions-Policy.*<missing>/);
  });

  test("--backend-down when the health path answers 200: exit 1 on the status", async () => {
    const r = await check({}, ["--backend-down"]);
    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /backend down.*status.*502 or 504.*200/);
  });

  test("the page shell references no /assets/*.js: exit 1 and says so", async () => {
    const r = await check({ shell: "<html><body>no scripts</body></html>" });
    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /built asset.*\/assets\/\*\.js/);
  });

  test("no base URL: exit 2 with the usage", async () => {
    const r = await run([]);
    assert.equal(r.code, 2, r.output);
    assert.match(r.output, /usage/i);
  });

  test("an unknown flag: exit 2 with the usage", async () => {
    const r = await run(["--nope", "http://127.0.0.1:9"]);
    assert.equal(r.code, 2, r.output);
    assert.match(r.output, /usage/i);
  });

  test("nothing listening at the base URL: exit 2", async () => {
    const server = await startServer({});
    const { url } = server;
    await server.close();
    const r = await run([url]);
    assert.equal(r.code, 2, r.output);
  });

  test('a header present with an empty value is reported as "", not <missing>', async () => {
    const r = await check({
      editHeaders: (req, headers) => {
        if (req.url === "/") headers["Referrer-Policy"] = "";
      },
    });
    assert.equal(r.code, 1, r.output);
    assert.match(r.output, /Referrer-Policy.*expected "strict-origin-when-cross-origin", got ""/);
    assert.doesNotMatch(r.output, /Referrer-Policy.*<missing>/);
  });

  test("a server that accepts the connection but never answers: exit 2 on the timeout", async () => {
    const sockets = [];
    const server = createTcpServer((socket) => {
      sockets.push(socket);
      socket.on("error", () => {});
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    try {
      const r = await run([`http://127.0.0.1:${port}`], {
        CHECK_HEADERS_CONNECT_TIMEOUT: "1",
        CHECK_HEADERS_MAX_TIME: "2",
      });
      assert.equal(r.code, 2, r.output);
      assert.match(r.output, /curl could not complete GET .*\(curl exit 28\)/);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
