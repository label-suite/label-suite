// Runs dev.mjs's supervise() over two fake servers, so a test can send this
// process a real SIGINT or SIGTERM and check that both children are gone.
//
//   node supervise-harness.mjs <backend pid file> <frontend pid file> <frontend grandchild pid file>
import { fileURLToPath } from "node:url";

import { supervise } from "../../../dev.mjs";

const FAKE = fileURLToPath(new URL("./fake-server.mjs", import.meta.url));
const [backendPid, frontendPid, grandchildPid] = process.argv.slice(2);

process.exitCode = await supervise([
  { name: "backend", command: process.execPath, args: [FAKE, backendPid], cwd: "." },
  {
    name: "frontend",
    command: process.execPath,
    args: [FAKE, frontendPid, "--grandchild", grandchildPid],
    cwd: ".",
  },
]);
