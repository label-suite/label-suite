// Regression tests for scripts/dev.mjs. Run: node --test scripts/tests/*.test.mjs
//
// spec workspace-commands "dev 起本機前後端開發伺服器": when one server ends the
// other ends too and dev exits with the first one's code; an interrupt ends
// both. Real uvicorn and Vite are replaced by fixtures/dev/fake-server.mjs.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, test } from "node:test";

import { devCommands, loadDevEnv, supervise } from "../dev.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const FAKE = fileURLToPath(new URL("./fixtures/dev/fake-server.mjs", import.meta.url));
const HARNESS = fileURLToPath(new URL("./fixtures/dev/supervise-harness.mjs", import.meta.url));

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dev-mjs-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function waitFor(predicate, what, timeoutMs = 5000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

const readPid = (file) => Number(readFileSync(file, "utf8"));

describe("supervise", () => {
  test("when the backend exits non-zero, the frontend ends too and dev exits with the backend's code", async () => {
    const backendPid = join(dir, "backend.pid");
    const frontendPid = join(dir, "frontend.pid");
    const grandchildPid = join(dir, "grandchild.pid");
    const code = await supervise(
      [
        {
          name: "backend",
          command: process.execPath,
          args: [FAKE, backendPid, "--exit", "3", "300"],
          cwd: dir,
        },
        {
          name: "frontend",
          command: process.execPath,
          args: [FAKE, frontendPid, "--grandchild", grandchildPid],
          cwd: dir,
        },
      ],
      { stdout: { write() {} } },
    );
    assert.equal(code, 3);
    await waitFor(() => !isAlive(readPid(frontendPid)), "the frontend to end");
    await waitFor(() => !isAlive(readPid(grandchildPid)), "the frontend's own child to end");
  });

  test("when the frontend exits 0 first, dev exits 0 and the backend ends", async () => {
    const backendPid = join(dir, "backend.pid");
    const frontendPid = join(dir, "frontend.pid");
    const code = await supervise(
      [
        { name: "backend", command: process.execPath, args: [FAKE, backendPid], cwd: dir },
        {
          name: "frontend",
          command: process.execPath,
          args: [FAKE, frontendPid, "--exit", "0", "300"],
          cwd: dir,
        },
      ],
      { stdout: { write() {} } },
    );
    assert.equal(code, 0);
    await waitFor(() => !isAlive(readPid(backendPid)), "the backend to end");
  });

  test("a command that cannot start ends the other one and fails", async () => {
    const frontendPid = join(dir, "frontend.pid");
    const lines = [];
    const code = await supervise(
      [
        { name: "backend", command: join(dir, "no-such-command"), args: [], cwd: dir },
        { name: "frontend", command: process.execPath, args: [FAKE, frontendPid], cwd: dir },
      ],
      { stdout: { write: (text) => lines.push(text) } },
    );
    assert.notEqual(code, 0);
    assert.match(lines.join(""), /backend/);
    if (existsSync(frontendPid))
      await waitFor(() => !isAlive(readPid(frontendPid)), "the frontend to end");
  });
});

for (const [signal, expected] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  test(`${signal} to dev ends both servers, including the frontend's own child`, async () => {
    const pids = ["backend.pid", "frontend.pid", "grandchild.pid"].map((name) => join(dir, name));
    const dev = spawn(process.execPath, [HARNESS, ...pids], { stdio: "ignore" });
    const exited = new Promise((resolve) => dev.on("exit", (code) => resolve(code)));
    await waitFor(
      () => pids.every((file) => existsSync(file) && readFileSync(file, "utf8") !== ""),
      "all pids",
    );
    dev.kill(signal);
    assert.equal(await exited, expected);
    for (const file of pids) await waitFor(() => !isAlive(readPid(file)), `${file} to end`);
  });
}

describe("devCommands", () => {
  test("starts uvicorn with reload on BACKEND_PORT in backend/ and the frontend dev script", () => {
    const [backend, frontend] = devCommands({ BACKEND_PORT: "8123" }, ROOT);
    assert.equal(backend.name, "backend");
    assert.equal(backend.cwd, join(ROOT, "backend"));
    assert.deepEqual(
      [backend.command, ...backend.args],
      ["uv", "run", "uvicorn", "app.main:create_app", "--factory", "--reload", "--port", "8123"],
    );
    assert.equal(frontend.name, "frontend");
    assert.equal(frontend.cwd, ROOT);
    assert.deepEqual([frontend.command, ...frontend.args], ["pnpm", "--filter", "frontend", "dev"]);
  });

  test("BACKEND_PORT defaults to 8000", () => {
    const [backend] = devCommands({}, ROOT);
    assert.equal(backend.args.at(-1), "8000");
  });
});

describe("loadDevEnv", () => {
  test("reads the root .env; a variable already in the environment wins", () => {
    writeFileSync(
      join(dir, ".env"),
      "# comment\nCORS_ALLOWED_ORIGINS=http://localhost:5173\nBACKEND_PORT=8001\n",
    );
    const env = loadDevEnv(dir, { BACKEND_PORT: "9000", PATH: "/bin" });
    assert.equal(env.CORS_ALLOWED_ORIGINS, "http://localhost:5173");
    assert.equal(env.BACKEND_PORT, "9000");
    assert.equal(env.PATH, "/bin");
  });

  test("works without a .env and fills BACKEND_PORT", () => {
    const env = loadDevEnv(dir, { PATH: "/bin" });
    assert.equal(env.BACKEND_PORT, "8000");
    assert.equal(
      env.CORS_ALLOWED_ORIGINS,
      undefined,
      "the one required setting gets no invented default",
    );
  });
});
