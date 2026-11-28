#!/usr/bin/env node
// dev.mjs — `pnpm run dev`: the backend (uvicorn) and frontend (Vite) dev servers on this machine, not in containers.
//
// Reads the root .env (a variable already in the environment wins), fills
// BACKEND_PORT with 8000 when unset, and starts both servers. When either one
// ends, the other is stopped and dev exits with the first one's exit code;
// SIGINT or SIGTERM is forwarded to both and dev exits with 128 + the signal
// number (spec workspace-commands, system-design §元件清單 scripts/dev.mjs).
//
// On POSIX each server runs in its own process group so a signal reaches the
// whole tree (pnpm starts Vite, uvicorn --reload starts a worker). Their stdin
// is closed: a background process group reading the terminal would be stopped
// by SIGTTIN. Windows has no process groups: pnpm is started through cmd.exe
// (it is pnpm.cmd there) and a stop runs `taskkill /T /F` on the whole tree.
// Once a server's root dies its children are no longer reachable from it, so
// every ~10 s dev records each server's descendants (pid + creation time) and,
// when a server ends, taskkills the recorded ones that are still alive.
import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { constants } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** How long a server gets to exit after SIGTERM or SIGINT before it is killed. */
const KILL_TIMEOUT_MS = 10_000;

/** Exit code for a process ended by a signal, the shell convention 128 + n. */
const signalExitCode = (signal) => 128 + (constants.signals[signal] ?? 0);

/**
 * The process environment for the dev servers: the root .env under the current environment.
 *
 * @param {string} root repository root
 * @param {Record<string, string | undefined>} env the current environment
 */
export function loadDevEnv(root, env) {
  const file = join(root, ".env");
  const fromFile = existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
  const merged = { ...fromFile, ...env };
  merged.BACKEND_PORT ??= "8000";
  return merged;
}

/**
 * The two servers `pnpm run dev` starts.
 *
 * @returns {{name: string, command: string, args: string[], cwd: string}[]}
 */
export function devCommands(env, root = ROOT) {
  const port = env.BACKEND_PORT ?? "8000";
  return [
    {
      name: "backend",
      command: "uv",
      args: ["run", "uvicorn", "app.main:create_app", "--factory", "--reload", "--port", port],
      cwd: join(root, "backend"),
    },
    { name: "frontend", command: "pnpm", args: ["--filter", "frontend", "dev"], cwd: root },
  ];
}

/**
 * The command and args to spawn. On Windows pnpm is pnpm.cmd, which Node (>= 18.20, CVE-2024-27980)
 * refuses to spawn directly, so it goes through cmd.exe; its args are fixed in devCommands().
 */
export function resolveSpawn(command, args, platform = process.platform, env = process.env) {
  if (platform === "win32" && command === "pnpm")
    return { command: env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  return { command, args };
}

/** How often dev records each server's descendants on Windows. */
const SNAPSHOT_INTERVAL_MS = 10_000;

/** The first snapshot waits this long, so uvicorn has spawned its worker. */
const FIRST_SNAPSHOT_MS = 2000;

/**
 * Parse the JSON `listProcesses` gets from PowerShell into `{pid, ppid, created}` rows.
 * PowerShell prints a lone object, not an array, when there is a single row.
 */
export function parseProcessList(json) {
  const rows = [JSON.parse(json)].flat();
  return rows.map((r) => ({
    pid: Number(r.pid),
    ppid: Number(r.ppid),
    created: String(r.created),
  }));
}

/** The process table on Windows: one PowerShell call. Rejects when PowerShell fails. */
export function listWindowsProcesses() {
  const script =
    "Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,CreationDate | ForEach-Object { [pscustomobject]@{ pid = $_.ProcessId; " +
    "ppid = $_.ParentProcessId; created = $(if ($_.CreationDate) { $_.CreationDate.ToFileTimeUtc().ToString() } else { '0' }) } } " +
    "| ConvertTo-Json -Compress";
  return new Promise((resolve, reject) => {
    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, timeout: 10_000, maxBuffer: 16 * 1024 * 1024 },
      (error, out) => {
        if (error) return reject(error);
        try {
          resolve(parseProcessList(out));
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
  });
}

/** Whether creation time `a` is later than `b` (FILETIME strings, compared exactly). */
export function createdAfter(a, b) {
  try {
    return BigInt(a) > BigInt(b);
  } catch {
    return false;
  }
}

/**
 * Every descendant of `rootPid` in a process list, as `{pid, created}`.
 *
 * @param {{pid: number, ppid: number, created: string}[]} list
 * @param {number} rootPid
 */
export function descendantsOf(list, rootPid) {
  const found = [];
  const seen = new Set([rootPid]);
  const queue = [rootPid];
  while (queue.length > 0) {
    const parent = queue.shift();
    for (const row of list) {
      if (row.ppid !== parent || seen.has(row.pid)) continue;
      seen.add(row.pid);
      found.push({ pid: row.pid, created: row.created });
      queue.push(row.pid);
    }
  }
  return found;
}

/**
 * Signal a child's whole tree: the process group on POSIX, `taskkill /T /F` on Windows
 * (which has no groups and no graceful signal). Ignore a tree that is already gone.
 */
function signalGroup(child, signal, { platform, spawnFn }) {
  if (child.pid === undefined) return;
  if (platform === "win32") {
    // An exited child's pid may be reused; taskkill must never aim at it.
    if (child.exitCode != null || child.signalCode != null) return;
    try {
      const killer = spawnFn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.on?.("error", () => {});
    } catch {
      // Already gone.
    }
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Already gone.
    }
  }
}

/**
 * Run the commands together until the first one ends or a signal arrives, then stop the rest.
 *
 * @param {{name: string, command: string, args: string[], cwd: string}[]} commands
 * @param {object} [options]
 * @param {{write(text: string): void}} [options.stdout] where dev's own messages go
 * @param {Record<string, string | undefined>} [options.env] environment for the commands
 * @param {number} [options.killTimeoutMs]
 * @param {NodeJS.Platform} [options.platform] the platform to behave as (tests inject win32)
 * @param {typeof spawn} [options.spawnFn] process starter (tests inject a fake)
 * @param {() => Promise<{pid: number, ppid: number, created: string}[]>} [options.listProcesses]
 *   the Windows process table (tests inject a fake)
 * @param {number} [options.snapshotIntervalMs] how often Windows descendants are recorded
 * @returns {Promise<number>} the exit code dev should end with
 */
export function supervise(
  commands,
  {
    stdout = process.stdout,
    env = process.env,
    killTimeoutMs = KILL_TIMEOUT_MS,
    platform = process.platform,
    spawnFn = spawn,
    listProcesses = listWindowsProcesses,
    snapshotIntervalMs = SNAPSHOT_INTERVAL_MS,
  } = {},
) {
  return new Promise((resolve) => {
    const running = new Map();
    let exitCode;
    let killTimer;

    const signalTree = (child, signal) => signalGroup(child, signal, { platform, spawnFn });
    const win32 = platform === "win32";
    // Windows only: per server, descendant pid -> creation time seen while the root was alive.
    const recorded = new Map();
    const pending = [];
    let snapshotting = false;
    let pollTimer;
    let firstTimer;

    const taskkillTree = (pid) => {
      try {
        spawnFn("taskkill", ["/pid", String(pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        }).on?.("error", () => {});
      } catch {
        // Already gone.
      }
    };

    const snapshot = async () => {
      if (snapshotting || exitCode !== undefined) return;
      snapshotting = true;
      try {
        const list = await listProcesses();
        for (const [name, child] of running) {
          if (child.pid === undefined) continue;
          const known = recorded.get(name) ?? new Map();
          const root = list.find((row) => row.pid === child.pid);
          if (root) known.set(root.pid, root.created);
          for (const { pid, created } of descendantsOf(list, child.pid)) known.set(pid, created);
          recorded.set(name, known);
        }
      } catch {
        // PowerShell failed; the next poll tries again.
      } finally {
        snapshotting = false;
      }
    };

    // A server's root is gone, so taskkill /T cannot reach its children. Kill (a) recorded
    // pids still alive with the same creation time and (b) any process whose parent pid is a
    // recorded one and that started later than it (a worker respawned between snapshots; its
    // ParentProcessId outlives the parent). A pid shown with another creation time is reused.
    // The exited root itself is never targeted; taskkill /T takes each target's subtree.
    const reapOrphans = async (name, rootPid) => {
      const known = recorded.get(name);
      if (!known || known.size === 0) return;
      try {
        const list = await listProcesses();
        const byPid = new Map(list.map((row) => [row.pid, row]));
        for (const row of list) {
          if (row.pid === rootPid) continue;
          const sameProcess = known.get(row.pid) === row.created;
          const parentCreated = known.get(row.ppid);
          const parentNow = byPid.get(row.ppid);
          const childOfRecorded =
            parentCreated !== undefined &&
            (parentNow === undefined || parentNow.created === parentCreated) &&
            createdAfter(row.created, parentCreated);
          if (sameProcess || childOfRecorded) taskkillTree(row.pid);
        }
      } catch {
        say(`could not list processes; a ${name} child may still be running`);
      }
    };

    if (win32) {
      firstTimer = setTimeout(snapshot, Math.min(FIRST_SNAPSHOT_MS, snapshotIntervalMs));
      pollTimer = setInterval(snapshot, snapshotIntervalMs);
      firstTimer.unref();
      pollTimer.unref();
    }

    const say = (text) => stdout.write(`[dev] ${text}\n`);

    const stopAll = (signal) => {
      for (const child of running.values()) signalTree(child, signal);
      if (killTimer === undefined && running.size > 0) {
        killTimer = setTimeout(() => {
          for (const child of running.values()) signalTree(child, "SIGKILL");
        }, killTimeoutMs);
        killTimer.unref();
      }
    };

    const onSignal = (signal) => {
      if (exitCode === undefined) exitCode = signalExitCode(signal);
      say(`received ${signal}; stopping ${[...running.keys()].join(" and ")}`);
      stopAll(signal);
    };
    const onSigint = () => onSignal("SIGINT");
    const onSigterm = () => onSignal("SIGTERM");
    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);

    const finished = (name, code) => {
      if (!running.has(name)) return;
      const child = running.get(name);
      running.delete(name);
      signalTree(child, "SIGTERM");
      if (win32) pending.push(reapOrphans(name, child.pid));
      if (exitCode === undefined) {
        exitCode = code;
        if (running.size > 0)
          say(`${name} exited with code ${code}; stopping ${[...running.keys()].join(" and ")}`);
        stopAll("SIGTERM");
      }
      if (running.size === 0) {
        clearTimeout(killTimer);
        clearTimeout(firstTimer);
        clearInterval(pollTimer);
        process.off("SIGINT", onSigint);
        process.off("SIGTERM", onSigterm);
        Promise.all(pending).then(() => resolve(exitCode));
      }
    };

    for (const { name, command, args, cwd } of commands) {
      const target = resolveSpawn(command, args, platform, env);
      const child = spawnFn(target.command, target.args, {
        cwd,
        env,
        detached: platform !== "win32",
        stdio: ["ignore", "inherit", "inherit"],
      });
      running.set(name, child);
      child.on("error", (error) => {
        say(`${name} could not start: ${error.message}`);
        finished(name, 127);
      });
      child.on("exit", (code, signal) => finished(name, code ?? signalExitCode(signal)));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = loadDevEnv(ROOT, process.env);
  process.exitCode = await supervise(devCommands(env), { env });
}
