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

import {
  descendantsOf,
  devCommands,
  isReloadTrigger,
  loadDevEnv,
  parseProcessList,
  resolveSpawn,
  seedDevAdmin,
  supervise,
  withoutSeedPassword,
} from "../dev.mjs";

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
    const [backend, frontend] = devCommands({ BACKEND_PORT: "8123" }, ROOT, "linux");
    assert.equal(backend.name, "backend");
    assert.equal(backend.cwd, join(ROOT, "backend"));
    assert.deepEqual(
      [backend.command, ...backend.args],
      [
        "uv",
        "run",
        "uvicorn",
        "app.main:create_app",
        "--factory",
        "--reload",
        "--reload-dir",
        "app",
        "--timeout-graceful-shutdown",
        "5",
        "--port",
        "8123",
      ],
    );
    assert.equal(frontend.name, "frontend");
    assert.equal(frontend.cwd, ROOT);
    assert.deepEqual([frontend.command, ...frontend.args], ["pnpm", "--filter", "frontend", "dev"]);
  });

  test("BACKEND_PORT defaults to 8000", () => {
    const [backend] = devCommands({}, ROOT, "linux");
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
      listProcesses: async () => [],
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
      listProcesses: async () => [],
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

  describe("orphaned descendants", () => {
    const row = (pid, ppid, created) => ({ pid, ppid, created });
    // uv (100) -> reloader (200) -> worker (300); the frontend is cmd (101).
    const full = [row(100, 1, "10"), row(200, 100, "20"), row(300, 200, "30"), row(101, 1, "40")];

    // Record a snapshot of `full`, then kill uv and the reloader; `after` is the process list then.
    async function run(after, { failList = false } = {}) {
      const { fn, calls } = fakeSpawn();
      let list = full;
      let listed = 0;
      const lines = [];
      const done = supervise(commands, {
        stdout: { write: (text) => lines.push(text) },
        env: {},
        platform: "win32",
        spawnFn: fn,
        listProcesses: async () => {
          listed++;
          if (failList && list !== full) throw new Error("powershell failed");
          return list;
        },
        snapshotIntervalMs: 10,
      });
      const [backend, frontend] = calls;
      try {
        await waitFor(() => listed >= 1, "the first snapshot");
        await new Promise((resolve) => setTimeout(resolve, 50));
        list = after;
        backend.child.exitCode = 1;
        backend.child.emit("exit", 1, null);
      } finally {
        frontend.child.emit("exit", 1, null);
        backend.child.emit("exit", 1, null);
      }
      await done;
      return {
        killed: calls.filter((c) => c.command === "taskkill").map((c) => c.args[1]),
        listed,
        lines: lines.join(""),
      };
    }

    test("a worker still alive with the same creation time is taskkilled after its root died", async () => {
      const { killed } = await run([row(101, 1, "40"), row(300, 200, "30")]);
      assert.ok(killed.includes("300"));
      assert.ok(!killed.includes("100"), "the exited root is never targeted");
    });

    test("a recorded pid now showing a different creation time is a reused pid and is left alone", async () => {
      const { killed } = await run([row(101, 1, "40"), row(300, 1, "99")]);
      assert.ok(!killed.includes("300"));
    });

    test("a worker respawned after the last snapshot is reaped through its dead recorded parent", async () => {
      const { killed } = await run([row(101, 1, "40"), row(400, 200, "25")]);
      assert.ok(killed.includes("400"));
    });

    test("a child of the exited root itself is reaped too, but never the root", async () => {
      const { killed } = await run([row(101, 1, "40"), row(500, 100, "15")]);
      assert.ok(killed.includes("500"));
      assert.ok(!killed.includes("100"));
    });

    test("a row whose parent pid matches but that started earlier than the parent is left alone", async () => {
      const { killed } = await run([row(101, 1, "40"), row(401, 200, "15")]);
      assert.ok(!killed.includes("401"));
    });

    test("a row under a pid that now belongs to another process is left alone", async () => {
      const { killed } = await run([row(101, 1, "40"), row(200, 1, "50"), row(402, 200, "60")]);
      assert.ok(!killed.includes("402") && !killed.includes("200"));
    });

    test("a failed process listing during the reap says so", async () => {
      const { lines } = await run([], { failList: true });
      assert.match(lines, /could not list processes; a backend child may still be running/);
    });

    test("the snapshot timer stops once supervise resolves", async () => {
      const { listed } = await run([row(101, 1, "40")]);
      await new Promise((resolve) => setTimeout(resolve, 60));
      const after = listed;
      await new Promise((resolve) => setTimeout(resolve, 60));
      assert.equal(after, listed);
    });
  });

  test("POSIX keeps detached process groups", () => {
    const { fn, calls } = fakeSpawn({ withPid: false });
    supervise(commands, { stdout: { write() {} }, env: {}, platform: "linux", spawnFn: fn });
    assert.equal(calls[0].options.detached, true);
    assert.equal(calls[1].command, "pnpm");
    for (const c of calls) c.child.emit("exit", 0, null);
  });
});

describe("devCommands per platform", () => {
  test("win32 starts the backend without --reload and names the directory to watch", () => {
    const [backend] = devCommands({}, ROOT, "win32");
    assert.ok(!backend.args.includes("--reload"));
    assert.ok(!backend.args.includes("--reload-dir"));
    assert.ok(backend.args.includes("--timeout-graceful-shutdown"));
    assert.equal(backend.watch, join(ROOT, "backend", "app"));
  });

  test("POSIX keeps uvicorn --reload and has nothing for dev to watch", () => {
    const [backend] = devCommands({}, ROOT, "linux");
    assert.ok(backend.args.includes("--reload"));
    assert.equal(backend.args[backend.args.indexOf("--reload-dir") + 1], "app");
    assert.equal(backend.watch, undefined);
  });
});

describe("isReloadTrigger", () => {
  test("only .py files outside __pycache__, dotfiles and temp files", () => {
    for (const ok of ["main.py", "core\\db.py", "modules/x/service.py"])
      assert.equal(isReloadTrigger(ok), true, ok);
    for (const no of [
      "main.pyc",
      "__pycache__/main.cpython-312.pyc",
      "__pycache__\\x.py",
      ".hidden.py",
      ".git/x.py",
      "~main.py",
      "data.json",
      null,
      undefined,
    ])
      assert.equal(isReloadTrigger(no), false, String(no));
  });
});

describe("supervise restarts the backend on Windows when backend/app changes", () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const commands = [
    {
      name: "backend",
      command: "uv",
      args: ["run", "uvicorn"],
      cwd: ".",
      watch: join(ROOT, "backend", "app"),
    },
    { name: "frontend", command: "pnpm", args: ["dev"], cwd: "." },
  ];

  function setup(options = {}) {
    const calls = [];
    let nextPid = 100;
    const spawnFn = (command, args, opts) => {
      const child = new EventEmitter();
      child.pid = options.noPid ? undefined : nextPid++; // no pid: POSIX never signals a real group
      child.kill = () => {};
      calls.push({ command, args, options: opts, child });
      return child;
    };
    const watchers = [];
    const watchFn = (dir, opts, listener) => {
      const watcher = new EventEmitter();
      watcher.dir = dir;
      watcher.opts = opts;
      watcher.listener = listener;
      watcher.closed = false;
      watcher.close = () => {
        watcher.closed = true;
      };
      watchers.push(watcher);
      return watcher;
    };
    const lines = [];
    const done = supervise(options.commands ?? commands, {
      stdout: { write: (text) => lines.push(text) },
      env: {},
      platform: options.platform ?? "win32",
      spawnFn,
      watchFn,
      listProcesses: async () => [],
      reloadDebounceMs: 20,
      killTimeoutMs: 1000,
    });
    const spawned = (name) =>
      calls.filter((c) => c.command === (name === "backend" ? "uv" : "cmd.exe"));
    const killed = () => calls.filter((c) => c.command === "taskkill").map((c) => c.args[1]);
    const exit = (child, code = 1) => {
      child.exitCode = code;
      child.emit("exit", code, null);
    };
    return { calls, watchers, lines, done, spawned, killed, exit };
  }

  test("a .py change taskkills the backend tree and starts it again, leaving the frontend alone", async () => {
    const { calls, watchers, lines, done, spawned, killed, exit } = setup();
    const [backend] = spawned("backend");
    const [frontend] = spawned("frontend");
    assert.equal(watchers.length, 1);
    assert.equal(watchers[0].dir, join(ROOT, "backend", "app"));
    assert.equal(watchers[0].opts.recursive, true);

    watchers[0].listener("change", "main.py");
    await sleep(60);
    assert.deepEqual(killed(), [String(backend.child.pid)]);
    assert.ok(lines.some((l) => l.includes("backend/app changed; restarting backend")));
    exit(backend.child, 1); // taskkill ended the old root
    await sleep(20);

    assert.equal(spawned("backend").length, 2);
    const second = spawned("backend")[1];
    assert.deepEqual(second.args, backend.args);
    assert.equal(second.options.env, backend.options.env);
    assert.ok(!killed().includes(String(frontend.child.pid)));

    // The new backend is the one that counts from now on; the old exit was not "ended".
    process.emit("SIGTERM", "SIGTERM");
    exit(second.child, 1);
    exit(frontend.child, 1);
    assert.equal(await done, 143);
    assert.equal(calls.filter((c) => c.command === "uv").length, 2);
  });

  test("a burst of saves is one restart", async () => {
    const { watchers, done, spawned, killed, exit } = setup();
    const [backend] = spawned("backend");
    for (let i = 0; i < 5; i++) {
      watchers[0].listener("change", `m${i}.py`);
      await sleep(5);
    }
    await sleep(60);
    assert.equal(killed().length, 1);
    exit(backend.child);
    await sleep(20);
    assert.equal(spawned("backend").length, 2);
    process.emit("SIGTERM", "SIGTERM");
    for (const c of [...spawned("backend"), ...spawned("frontend")]) exit(c.child);
    await done;
  });

  test("changes to non-.py files do nothing", async () => {
    const { watchers, done, spawned, killed, exit } = setup();
    for (const f of ["x.pyc", "__pycache__/x.cpython-312.pyc", ".x.py", "data.json"])
      watchers[0].listener("change", f);
    await sleep(60);
    assert.deepEqual(killed(), []);
    assert.equal(spawned("backend").length, 1);
    process.emit("SIGTERM", "SIGTERM");
    for (const c of [...spawned("backend"), ...spawned("frontend")]) exit(c.child);
    await done;
  });

  test("a change during a restart is a second restart after the first settles", async () => {
    const { watchers, done, spawned, killed, exit } = setup();
    watchers[0].listener("change", "a.py");
    await sleep(60);
    watchers[0].listener("change", "b.py");
    await sleep(60);
    assert.equal(killed().length, 1); // still waiting for the old root to end
    exit(spawned("backend")[0].child);
    await sleep(30);
    assert.equal(spawned("backend").length, 2);
    assert.equal(killed().length, 2); // the new backend is restarted too
    exit(spawned("backend")[1].child);
    await sleep(30);
    assert.equal(spawned("backend").length, 3);
    process.emit("SIGTERM", "SIGTERM");
    for (const c of [...spawned("backend"), ...spawned("frontend")]) exit(c.child);
    await done;
  });

  test("a signal while the old backend is stopping ends dev without respawning", async () => {
    const { watchers, done, spawned, exit } = setup();
    const [backend] = spawned("backend");
    const [frontend] = spawned("frontend");
    watchers[0].listener("change", "a.py");
    await sleep(60);
    process.emit("SIGINT", "SIGINT");
    exit(frontend.child);
    exit(backend.child);
    assert.equal(await done, 130);
    assert.equal(spawned("backend").length, 1);
    assert.ok(watchers[0].closed);
  });

  test("the frontend ending during a restart ends dev without respawning the backend", async () => {
    const { watchers, done, spawned, exit } = setup();
    const [backend] = spawned("backend");
    const [frontend] = spawned("frontend");
    watchers[0].listener("change", "a.py");
    await sleep(60);
    exit(frontend.child, 7);
    exit(backend.child);
    assert.equal(await done, 7);
    assert.equal(spawned("backend").length, 1);
  });

  test("a null filename (watch buffer overflow) still restarts", async () => {
    const { watchers, done, spawned, killed, exit } = setup();
    watchers[0].listener("change", null);
    await sleep(60);
    assert.equal(killed().length, 1);
    exit(spawned("backend")[0].child);
    await sleep(20);
    assert.equal(spawned("backend").length, 2);
    process.emit("SIGTERM", "SIGTERM");
    for (const c of [...spawned("backend"), ...spawned("frontend")]) exit(c.child);
    await done;
  });

  test("a respawned backend that exits keeps dev up and the next change starts it again", async () => {
    const { watchers, lines, done, spawned, killed, exit } = setup();
    const [frontend] = spawned("frontend");
    watchers[0].listener("change", "a.py");
    await sleep(60);
    exit(spawned("backend")[0].child);
    await sleep(20);
    exit(spawned("backend")[1].child, 1); // e.g. a syntax error
    await sleep(20);
    assert.ok(
      lines.some((l) =>
        l.includes("backend exited with code 1; waiting for a change in backend/app"),
      ),
    );
    assert.ok(!killed().includes(String(frontend.child.pid)));
    assert.equal(frontend.child.exitCode, undefined);

    watchers[0].listener("change", "a.py");
    await sleep(60);
    assert.equal(spawned("backend").length, 3);
    // Starting from "waiting" kills nothing new and does not touch the frontend.
    assert.ok(!killed().includes(String(frontend.child.pid)));

    process.emit("SIGTERM", "SIGTERM");
    exit(spawned("backend")[2].child);
    exit(frontend.child);
    assert.equal(await done, 143);
  });

  test("a signal while the backend is down and waiting ends dev", async () => {
    const { watchers, done, spawned, exit } = setup();
    watchers[0].listener("change", "a.py");
    await sleep(60);
    exit(spawned("backend")[0].child);
    await sleep(20);
    exit(spawned("backend")[1].child, 1);
    await sleep(20);
    process.emit("SIGTERM", "SIGTERM");
    exit(spawned("frontend")[0].child);
    assert.equal(await done, 143);
    assert.ok(watchers[0].closed);
  });

  test("the frontend ending while the backend waits ends dev", async () => {
    const { watchers, done, spawned, exit } = setup();
    watchers[0].listener("change", "a.py");
    await sleep(60);
    exit(spawned("backend")[0].child);
    await sleep(20);
    exit(spawned("backend")[1].child, 1);
    await sleep(20);
    exit(spawned("frontend")[0].child, 5);
    assert.equal(await done, 5);
  });

  test("the first start failing still ends dev and stops the frontend", async () => {
    const { done, spawned, killed, exit } = setup();
    exit(spawned("backend")[0].child, 4);
    assert.ok(killed().includes(String(spawned("frontend")[0].child.pid)));
    exit(spawned("frontend")[0].child);
    assert.equal(await done, 4);
  });

  test("an old backend that does not exit in time is reported before the respawn", async () => {
    const { watchers, lines, done, spawned, exit } = setup();
    watchers[0].listener("change", "a.py");
    await sleep(60);
    await sleep(1050); // killTimeoutMs is 1000 in these tests
    assert.ok(lines.some((l) => l.includes("did not exit in 1 s; port may still be in use")));
    assert.equal(spawned("backend").length, 2);
    process.emit("SIGTERM", "SIGTERM");
    for (const c of [...spawned("backend"), ...spawned("frontend")]) exit(c.child);
    await done;
  });

  test("a directory that cannot be watched only warns", async () => {
    const lines = [];
    const children = [];
    const done = supervise(commands, {
      stdout: { write: (text) => lines.push(text) },
      env: {},
      platform: "win32",
      spawnFn: () => {
        const child = new EventEmitter();
        child.pid = 1;
        child.kill = () => {};
        children.push(child);
        return child;
      },
      watchFn: () => {
        throw new Error("ENOENT");
      },
      listProcesses: async () => [],
    });
    assert.ok(lines.some((l) => l.includes("cannot watch") && l.includes("ENOENT")));
    for (const c of children) c.emit("exit", 0, null);
    assert.equal(await done, 0);
  });

  test("POSIX never watches", async () => {
    const { calls, watchers, done, exit } = setup({ platform: "linux", noPid: true });
    assert.equal(watchers.length, 0);
    for (const c of calls) exit(c.child, 0);
    assert.equal(await done, 0);
  });
});

describe("descendantsOf", () => {
  const row = (pid, ppid, created = "t") => ({ pid, ppid, created });

  test("walks the whole tree below the root, not the root or siblings", () => {
    const list = [row(1, 0), row(2, 1), row(3, 2), row(4, 2), row(9, 8)];
    assert.deepEqual(
      descendantsOf(list, 1)
        .map((d) => d.pid)
        .sort(),
      [2, 3, 4],
    );
  });

  test("a worker whose parent is gone is still found through an earlier snapshot", () => {
    const earlier = [row(100, 1), row(200, 100, "b"), row(300, 200, "c")];
    const recordedPids = descendantsOf(earlier, 100);
    assert.deepEqual(recordedPids, [
      { pid: 200, created: "b" },
      { pid: 300, created: "c" },
    ]);
    // Later the root and reloader are gone: walking from the root finds nothing.
    assert.deepEqual(descendantsOf([row(300, 200, "c")], 100), []);
  });

  test("a parent cycle from pid reuse does not loop forever", () => {
    assert.deepEqual(
      descendantsOf([row(2, 1), row(1, 2)], 1).map((d) => d.pid),
      [2],
    );
  });
});

describe("parseProcessList", () => {
  test("accepts an array and a lone object", () => {
    assert.deepEqual(parseProcessList('[{"pid":1,"ppid":0,"created":5}]'), [
      { pid: 1, ppid: 0, created: "5" },
    ]);
    assert.equal(parseProcessList('{"pid":2,"ppid":1,"created":6}')[0].pid, 2);
  });
});

describe("seedDevAdmin (injected spawn)", () => {
  const PASSWORD = "Sup3r-secret-Pw";
  const full = {
    DEV_SEED_ADMIN_EMAIL: "dev@example.com",
    DEV_SEED_ADMIN_NAME: "Dev Admin",
    DEV_SEED_ADMIN_PASSWORD: PASSWORD,
    DATABASE_URL: "sqlite+aiosqlite:///x.db",
  };

  /** A spawn that records each call and exits with the next code in `codes`. */
  function fakeRun(codes) {
    const calls = [];
    const fn = (command, args, options) => {
      const child = new EventEmitter();
      const written = [];
      child.stdin = Object.assign(new EventEmitter(), { end: (text) => written.push(text) });
      calls.push({ command, args, options, written });
      const code = codes[calls.length - 1] ?? 0;
      setImmediate(() => child.emit("exit", code, null));
      return child;
    };
    return { fn, calls };
  }
  const collect = () => {
    const lines = [];
    return { lines, say: (text) => lines.push(text) };
  };

  test("all three set: migrate, then seed with the password on stdin only", async () => {
    const { fn, calls } = fakeRun([0, 0]);
    const { lines, say } = collect();
    const result = await seedDevAdmin(full, { root: "/repo", say, spawnFn: fn, platform: "linux" });
    assert.deepEqual(result, { email: "dev@example.com" });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].args, ["run", "alembic", "upgrade", "head"]);
    assert.deepEqual(calls[1].args, [
      "run",
      "python",
      "-m",
      "app.scripts.create_seeder",
      "--email",
      "dev@example.com",
      "--name",
      "Dev Admin",
      "--password-stdin",
    ]);
    for (const c of calls) {
      assert.equal(c.command, "uv");
      assert.equal(c.options.cwd, join("/repo", "backend"));
      assert.equal(c.options.env.DATABASE_URL, full.DATABASE_URL);
      assert.ok(!c.args.some((a) => a.includes(PASSWORD)));
      assert.equal(c.options.env.DEV_SEED_ADMIN_PASSWORD, undefined);
    }
    assert.deepEqual(calls[1].written, [`${PASSWORD}\n`]);
    assert.deepEqual(calls[0].written, []);
    assert.ok(!lines.join("\n").includes(PASSWORD));
  });

  test("win32: uv is spawned directly and the password still arrives on stdin only", async () => {
    const { fn, calls } = fakeRun([0, 0]);
    const { lines, say } = collect();
    const result = await seedDevAdmin(full, { say, spawnFn: fn, platform: "win32" });
    assert.deepEqual(result, { email: "dev@example.com" });
    for (const c of calls) {
      assert.equal(c.command, "uv");
      assert.ok(!c.args.some((a) => a.includes(PASSWORD)));
    }
    assert.deepEqual(calls[1].written, [`${PASSWORD}\n`]);
    assert.ok(!lines.join("\n").includes(PASSWORD));
  });

  test("does not mutate the env it is given", async () => {
    const { fn } = fakeRun([0, 0]);
    const env = { ...full };
    await seedDevAdmin(env, { say: () => {}, spawnFn: fn });
    assert.deepEqual(env, full);
  });

  test("withoutSeedPassword drops only the password and returns a copy", () => {
    const env = { ...full };
    const copy = withoutSeedPassword(env);
    assert.equal("DEV_SEED_ADMIN_PASSWORD" in copy, false);
    assert.equal(copy.DEV_SEED_ADMIN_EMAIL, full.DEV_SEED_ADMIN_EMAIL);
    assert.equal(copy.DATABASE_URL, full.DATABASE_URL);
    assert.equal(env.DEV_SEED_ADMIN_PASSWORD, PASSWORD);
  });

  test("none set (or only blanks): neither command runs and nothing is said", async () => {
    for (const env of [
      {},
      { DEV_SEED_ADMIN_EMAIL: "", DEV_SEED_ADMIN_NAME: " ", DEV_SEED_ADMIN_PASSWORD: "" },
    ]) {
      const { fn, calls } = fakeRun([]);
      const { lines, say } = collect();
      assert.equal(await seedDevAdmin(env, { say, spawnFn: fn }), null);
      assert.equal(calls.length, 0);
      assert.equal(lines.length, 0);
    }
  });

  test("only some set: warns by variable name, runs nothing, leaks no value", async () => {
    const { fn, calls } = fakeRun([]);
    const { lines, say } = collect();
    const env = { DEV_SEED_ADMIN_EMAIL: "dev@example.com", DEV_SEED_ADMIN_PASSWORD: PASSWORD };
    assert.equal(await seedDevAdmin(env, { say, spawnFn: fn }), null);
    assert.equal(calls.length, 0);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /DEV_SEED_ADMIN_NAME/);
    assert.ok(!lines[0].includes(PASSWORD));
  });

  test("seeder exit 2: warns without the password and returns null (servers still start)", async () => {
    const { fn, calls } = fakeRun([0, 2]);
    const { lines, say } = collect();
    assert.equal(await seedDevAdmin(full, { say, spawnFn: fn }), null);
    assert.equal(calls.length, 2);
    assert.match(lines.join("\n"), /create_seeder exited 2/);
    assert.ok(!lines.join("\n").includes(PASSWORD));
  });

  test("migration failure: warns, skips the seeder, returns null", async () => {
    const { fn, calls } = fakeRun([1]);
    const { lines, say } = collect();
    assert.equal(await seedDevAdmin(full, { say, spawnFn: fn }), null);
    assert.equal(calls.length, 1);
    assert.match(lines.join("\n"), /alembic upgrade head failed/);
  });

  test("a command that cannot start is a warning, not a throw", async () => {
    const fn = () => {
      const child = new EventEmitter();
      setImmediate(() => child.emit("error", new Error("spawn uv ENOENT")));
      return child;
    };
    const { lines, say } = collect();
    assert.equal(await seedDevAdmin(full, { say, spawnFn: fn }), null);
    assert.match(lines.join("\n"), /failed/);
  });
});

describe("supervise onStarted", () => {
  test("runs once after both servers are spawned, with the [dev] logger", async () => {
    const out = [];
    const calls = [];
    const fn = (command, args, options) => {
      const child = new EventEmitter();
      child.pid = undefined;
      child.kill = () => {};
      calls.push(child);
      return child;
    };
    const done = supervise(
      [
        { name: "backend", command: "uv", args: [], cwd: "." },
        { name: "frontend", command: "pnpm", args: [], cwd: "." },
      ],
      {
        stdout: { write: (t) => out.push(t) },
        env: {},
        platform: "linux",
        spawnFn: fn,
        onStarted: (say) => {
          assert.equal(calls.length, 2);
          say("hello");
        },
      },
    );
    assert.deepEqual(out, ["[dev] hello\n"]);
    for (const c of calls) c.emit("exit", 0, null);
    assert.equal(await done, 0);
  });
});
