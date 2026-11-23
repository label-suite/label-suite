// A stand-in for uvicorn or Vite in the dev.mjs tests.
//
//   node fake-server.mjs <pid file> [--exit <code> <delay ms>] [--grandchild <pid file>]
//
// Writes its pid to the pid file, then either exits with <code> after <delay ms>
// or keeps running until a signal ends it. With --grandchild it first starts a
// long-running child of its own (like pnpm starting Vite) and writes that pid too.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const [pidFile, ...rest] = process.argv.slice(2);
const exitAt = rest.indexOf("--exit");
const grandchildAt = rest.indexOf("--grandchild");

if (grandchildAt !== -1) {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), rest[grandchildAt + 1]], {
    stdio: "ignore",
  });
  child.on("error", () => process.exit(99));
}

writeFileSync(pidFile, String(process.pid));

if (exitAt !== -1) {
  const code = Number(rest[exitAt + 1]);
  setTimeout(() => process.exit(code), Number(rest[exitAt + 2]));
} else {
  setInterval(() => {}, 1000);
}
