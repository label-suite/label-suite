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
import { spawn } from "node:child_process";
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

/**
 * Signal a child's whole tree: the process group on POSIX, `taskkill /T /F` on Windows
 * (which has no groups and no graceful signal). Ignore a tree that is already gone.
 */
function signalGroup(child, signal, { platform, spawnFn }) {
  if (child.pid === undefined) return;
  if (platform === "win32") {
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
  } = {},
) {
  return new Promise((resolve) => {
    const running = new Map();
    let exitCode;
    let killTimer;

    const signalTree = (child, signal) => signalGroup(child, signal, { platform, spawnFn });
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
      if (exitCode === undefined) {
        exitCode = code;
        if (running.size > 0)
          say(`${name} exited with code ${code}; stopping ${[...running.keys()].join(" and ")}`);
        stopAll("SIGTERM");
      }
      if (running.size === 0) {
        clearTimeout(killTimer);
        process.off("SIGINT", onSigint);
        process.off("SIGTERM", onSigterm);
        resolve(exitCode);
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
