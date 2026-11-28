// Regression tests for scripts/dev.mjs. Run: node --test scripts/tests/*.test.mjs
//
// spec workspace-commands "dev 起本機前後端開發伺服器": when one server ends the
// other ends too and dev exits with the first one's code; an interrupt ends
// both. Real uvicorn and Vite are replaced by fixtures/dev/fake-server.mjs.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, test } from "node:test";

import { devCommands, loadDevEnv, resolveSpawn, supervise } from "../dev.mjs";

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

describe("resolveSpawn", () => {
  test("on win32 pnpm goes through cmd.exe, ComSpec first", () => {
    assert.deepEqual(resolveSpawn("pnpm", ["--filter", "frontend", "dev"], "win32", {}), {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "pnpm", "--filter", "frontend", "dev"],
    });
    assert.equal(
      resolveSpawn("pnpm", [], "win32", { ComSpec: "C:\\Windows\\cmd.exe" }).command,
      "C:\\Windows\\cmd.exe",
    );
  });

  test("on win32 other commands (uv.exe) are spawned directly, so no shell sees their args", () => {
    assert.deepEqual(resolveSpawn("uv", ["run", "x & y"], "win32", {}), {
      command: "uv",
      args: ["run", "x & y"],
    });
  });

  test("on POSIX nothing changes", () => {
    assert.deepEqual(resolveSpawn("pnpm", ["a"], "linux", {}), { command: "pnpm", args: ["a"] });
  });
});

describe("supervise on win32 (injected platform and spawn)", () => {
  function fakeSpawn({ withPid = true } = {}) {
    const calls = [];
    let nextPid = 100;
    const fn = (command, args, options) => {
      const child = new EventEmitter();
      child.pid = withPid ? nextPid++ : undefined; // no pid: POSIX kill() is skipped, never a real group
      child.kill = () => {};
      calls.push({ command, args, options, child });
      return child;
    };
    return { fn, calls };
  }
  const commands = [
    { name: "backend", command: "uv", args: ["run", "uvicorn"], cwd: "." },
    { name: "frontend", command: "pnpm", args: ["--filter", "frontend", "dev"], cwd: "." },
  ];

  test("starts pnpm through cmd.exe without a process group, and taskkills the tree when one ends", async () => {
    const { fn, calls } = fakeSpawn();
    const done = supervise(commands, {
      stdout: { write() {} },
      env: {},
      platform: "win32",
      spawnFn: fn,
    });
    const [backend, frontend] = calls;
    try {
      assert.equal(backend.command, "uv");
      assert.equal(frontend.command, "cmd.exe");
      assert.deepEqual(frontend.args.slice(0, 4), ["/d", "/s", "/c", "pnpm"]);
      assert.equal(frontend.options.detached, false);

      frontend.child.exitCode = 2; // as Node sets it before emitting "exit"
      frontend.child.emit("exit", 2, null);
      const killed = calls.filter((c) => c.command === "taskkill");
      // The running backend is stopped as a whole tree; the exited frontend's pid is left alone.
      assert.ok(killed.every((c) => c.args.includes("/T") && c.args.includes("/F")));
      assert.ok(killed.some((c) => c.args[1] === String(backend.child.pid)));
      assert.ok(!killed.some((c) => c.args[1] === String(frontend.child.pid)));
    } finally {
      for (const c of [backend, frontend]) c.child.emit("exit", 1, null);
    }
    assert.equal(await done, 2);
  });

  test("SIGTERM to dev taskkills both trees and exits 143", async () => {
    const { fn, calls } = fakeSpawn();
    const done = supervise(commands, {
      stdout: { write() {} },
      env: {},
      platform: "win32",
      spawnFn: fn,
    });
    const servers = calls.slice(0, 2);
    try {
      process.emit("SIGTERM", "SIGTERM");
      const pids = calls
        .filter((c) => c.command === "taskkill")
        .map((c) => c.args[1])
        .sort();
      assert.deepEqual(pids, servers.map((c) => String(c.child.pid)).sort());
    } finally {
      for (const c of servers) c.child.emit("exit", 1, null);
    }
    assert.equal(await done, 143);
  });

  test("POSIX keeps detached process groups", () => {
    const { fn, calls } = fakeSpawn({ withPid: false });
    supervise(commands, { stdout: { write() {} }, env: {}, platform: "linux", spawnFn: fn });
    assert.equal(calls[0].options.detached, true);
    assert.equal(calls[1].command, "pnpm");
    for (const c of calls) c.child.emit("exit", 0, null);
  });
});
