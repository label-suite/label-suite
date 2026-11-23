#!/usr/bin/env node
// dev.mjs — `pnpm run dev`: the backend (uvicorn) and frontend (Vite) dev servers on this machine, not in containers.
//
// Reads the root .env (a variable already in the environment wins), fills
// BACKEND_PORT with 8000 when unset, and starts both servers. When either one
// ends, the other is stopped and dev exits with the first one's exit code;
// SIGINT or SIGTERM is forwarded to both and dev exits with 128 + the signal
// number (spec workspace-commands, system-design §元件清單 scripts/dev.mjs).
//
// Each server runs in its own process group so a signal reaches the whole tree
// (pnpm starts Vite, uvicorn --reload starts a worker). Their stdin is closed:
// a background process group reading the terminal would be stopped by SIGTTIN.
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

/** Send a signal to a child's whole process group; ignore a group that is already gone. */
function signalGroup(child, signal) {
  if (child.pid === undefined) return;
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
 * @returns {Promise<number>} the exit code dev should end with
 */
export function supervise(
  commands,
  { stdout = process.stdout, env = process.env, killTimeoutMs = KILL_TIMEOUT_MS } = {},
) {
  return new Promise((resolve) => {
    const running = new Map();
    let exitCode;
    let killTimer;

    const say = (text) => stdout.write(`[dev] ${text}\n`);

    const stopAll = (signal) => {
      for (const child of running.values()) signalGroup(child, signal);
      if (killTimer === undefined && running.size > 0) {
        killTimer = setTimeout(() => {
          for (const child of running.values()) signalGroup(child, "SIGKILL");
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
      signalGroup(child, "SIGTERM");
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
      const child = spawn(command, args, {
        cwd,
        env,
        detached: true,
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
