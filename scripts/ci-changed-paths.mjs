#!/usr/bin/env node
// ci-changed-paths.mjs — decide whether the `compose` CI job has to run (system-design D13, design D15).
//
//   node scripts/ci-changed-paths.mjs --base <sha> --head <sha>
//
// Lists the files changed in `git diff --name-only <base>...<head>` and answers
// `compose=true` when any of them is a compose file, a Dockerfile, a
// .dockerignore, frontend/nginx.conf, scripts/check-security-headers.sh,
// e2e/playwright.config.ts, or anything under backend/, frontend/,
// e2e/public-entry/ or e2e/shared/.
// The answer is appended to $GITHUB_OUTPUT, or printed to stdout when that is
// not set. A base that is empty, all zeros (the first push of a new branch), or
// not a commit git can diff answers `compose=true` with the reason printed:
// running compose once too often is cheap, skipping it when it mattered is not.
// The workflow checks out with fetch-depth: 0 so the merge base is available.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

const EXACT = new Set([
  "docker-compose.yml",
  "docker-compose.prod.yml",
  "frontend/nginx.conf",
  "scripts/check-security-headers.sh",
  "e2e/playwright.config.ts",
]);
const BASENAMES = new Set(["Dockerfile", ".dockerignore"]);
const PREFIXES = ["backend/", "frontend/", "e2e/public-entry/", "e2e/shared/"];

/**
 * Whether a list of changed paths touches anything the compose job builds or runs.
 *
 * @param {string[]} paths repository-relative paths with forward slashes
 * @returns {boolean}
 */
export function touchesCompose(paths) {
  return paths.some(
    (path) =>
      EXACT.has(path) ||
      BASENAMES.has(posix.basename(path)) ||
      PREFIXES.some((prefix) => path.startsWith(prefix)),
  );
}

/**
 * Decide for a commit range. `diff` returns the changed paths or throws.
 *
 * @returns {{compose: boolean, reason: string}}
 */
export function decide({ base, head, diff }) {
  if (base.trim() === "") return { compose: true, reason: "the base commit is empty" };
  if (/^0+$/.test(base.trim())) return { compose: true, reason: "the base commit is all zeros" };
  let paths;
  try {
    paths = diff(base.trim(), head.trim());
  } catch (error) {
    const detail = String(error.stderr ?? error.message)
      .trim()
      .split("\n")[0];
    return { compose: true, reason: `git cannot diff ${base}...${head} (${detail})` };
  }
  const compose = touchesCompose(paths);
  return {
    compose,
    reason: compose
      ? "compose-related files changed"
      : `none of the ${paths.length} changed file(s) is compose-related`,
  };
}

function gitDiff(base, head) {
  const output = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output.split("\n").filter((line) => line !== "");
}

/** Run the CLI; return the exit code. */
export function main(
  argv,
  { stdout = process.stdout, stderr = process.stderr, env = process.env } = {},
) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if ((flag !== "--base" && flag !== "--head") || value === undefined) {
      options.invalid = true;
      break;
    }
    options[flag] = value;
  }
  if (options.invalid || options["--base"] === undefined || options["--head"] === undefined) {
    stderr.write("usage: ci-changed-paths.mjs --base <sha> --head <sha>\n");
    return 2;
  }

  const { compose, reason } = decide({
    base: options["--base"],
    head: options["--head"],
    diff: gitDiff,
  });
  stdout.write(
    `ci-changed-paths: ${reason}; ${compose ? "running compose" : "skipping compose"}\n`,
  );
  const line = `compose=${compose}\n`;
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, line);
  else stdout.write(line);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
