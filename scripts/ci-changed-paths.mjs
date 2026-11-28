#!/usr/bin/env node
// ci-changed-paths.mjs — decide which path-conditioned CI jobs have to run
// (system-design D13, design D15; the path table was approved on issue #823).
//
//   node scripts/ci-changed-paths.mjs --base <sha> --head <sha>
//
// Lists the files changed in `git diff --name-only --no-renames <base>...<head>`
// (a renamed file counts under both its old and its new path) and answers
// one `<output>=true|false` line per entry of OUTPUTS below, appended to
// $GITHUB_OUTPUT, or printed to stdout when that is not set. The `changes` job
// in ci.yml exposes each line, and every conditional job reads one of them.
//
// Two cases answer `true` for every output, with the reason printed:
//   - a changed file is on the global-trigger list (GLOBAL_EXACT,
//     GLOBAL_PREFIXES): the workflow, the lockfiles, the shared tool settings,
//     the coverage baselines and this script itself can change what any job
//     does, so a change to one of them reruns all of them;
//   - the base is empty, all zeros (the first push of a new branch), or not a
//     commit git can diff.
// Running a job once too often is cheap; skipping it when it mattered is not.
// The workflow checks out with fetch-depth: 0 so the merge base is available.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";

/** A change to any of these runs every conditional job. */
const GLOBAL_EXACT = new Set([
  "pnpm-lock.yaml",
  "backend/uv.lock",
  "package.json",
  "pnpm-workspace.yaml",
  "backend/pyproject.toml",
  ".prettierrc.json",
  ".prettierignore",
  ".lintstagedrc.mjs",
  "coverage-baseline.json",
  "critical-coverage.json",
  "scripts/ci-changed-paths.mjs",
]);
const GLOBAL_PREFIXES = [".github/"];

const COMPOSE_EXACT = new Set([
  "docker-compose.yml",
  "docker-compose.prod.yml",
  "frontend/nginx.conf",
  "scripts/check-security-headers.sh",
  "e2e/playwright.config.ts",
]);
const COMPOSE_BASENAMES = new Set(["Dockerfile", ".dockerignore"]);
const COMPOSE_PREFIXES = ["backend/", "frontend/", "e2e/public-entry/", "e2e/shared/"];

/**
 * The code group: backend-sqlite, backend-postgres, frontend, coverage and e2e share
 * it. The three coverage and skip gates are in it so a change to one runs the real
 * gate, not only its unit tests.
 */
const CODE_EXACT = [
  "scripts/check-coverage.mjs",
  "scripts/check-critical-coverage.mjs",
  "scripts/check-junit-skips.mjs",
];
const CODE_PREFIXES = ["backend/", "frontend/"];
/** Read by the frontend's token extraction and by the dashboard e2e journey. */
const PROTOTYPE_ASSETS = "design/prototype/assets/";

/**
 * The path table. Each output is true when a changed path equals one of
 * `exact` or starts with one of `prefixes`; `compose` keeps its own matcher.
 */
const TABLE = {
  code: { exact: CODE_EXACT, prefixes: CODE_PREFIXES },
  frontend: { exact: CODE_EXACT, prefixes: [...CODE_PREFIXES, PROTOTYPE_ASSETS] },
  e2e: { exact: CODE_EXACT, prefixes: [...CODE_PREFIXES, PROTOTYPE_ASSETS, "e2e/"] },
  api_contract: {
    exact: [
      "docs/diagrams/architecture/api.openapi.json",
      "frontend/orval.config.ts",
      "frontend/package.json",
    ],
    prefixes: ["backend/", "frontend/src/api/"],
  },
  docs_site: { exact: [], prefixes: ["docs/", ".notecraft/", "design/"] },
  scripts: { exact: [], prefixes: ["scripts/"] },
  hooks: {
    exact: ["AGENTS.md", "CLAUDE.md"],
    prefixes: [
      "scripts/",
      ".claude/",
      ".codex/",
      ".semgrep/",
      "backend/",
      "frontend/",
      "e2e/",
      "docs/",
    ],
  },
};

/** The output names, in the order they are written. */
export const OUTPUTS = [...Object.keys(TABLE), "compose"];

/**
 * Whether a list of changed paths touches anything the compose job builds or runs.
 *
 * @param {string[]} paths repository-relative paths with forward slashes
 * @returns {boolean}
 */
export function touchesCompose(paths) {
  return paths.some(
    (path) =>
      COMPOSE_EXACT.has(path) ||
      COMPOSE_BASENAMES.has(posix.basename(path)) ||
      COMPOSE_PREFIXES.some((prefix) => path.startsWith(prefix)),
  );
}

/**
 * Whether a list of changed paths touches the global-trigger list.
 *
 * @param {string[]} paths repository-relative paths with forward slashes
 * @returns {boolean}
 */
export function touchesGlobal(paths) {
  return paths.some(
    (path) => GLOBAL_EXACT.has(path) || GLOBAL_PREFIXES.some((prefix) => path.startsWith(prefix)),
  );
}

/**
 * Every output for a list of changed paths, global triggers included.
 *
 * @param {string[]} paths repository-relative paths with forward slashes
 * @returns {Record<string, boolean>}
 */
export function matchOutputs(paths) {
  if (touchesGlobal(paths)) return allTrue();
  const outputs = {};
  for (const [name, { exact, prefixes }] of Object.entries(TABLE)) {
    outputs[name] = paths.some(
      (path) => exact.includes(path) || prefixes.some((prefix) => path.startsWith(prefix)),
    );
  }
  outputs.compose = touchesCompose(paths);
  return outputs;
}

function allTrue() {
  return Object.fromEntries(OUTPUTS.map((name) => [name, true]));
}

/**
 * Decide for a commit range. `diff` returns the changed paths or throws.
 *
 * @returns {{outputs: Record<string, boolean>, reason: string}}
 */
export function decide({ base, head, diff }) {
  if (base.trim() === "") return { outputs: allTrue(), reason: "the base commit is empty" };
  if (/^0+$/.test(base.trim()))
    return { outputs: allTrue(), reason: "the base commit is all zeros" };
  let paths;
  try {
    paths = diff(base.trim(), head.trim());
  } catch (error) {
    const detail = String(error.stderr ?? error.message)
      .trim()
      .split("\n")[0];
    return { outputs: allTrue(), reason: `git cannot diff ${base}...${head} (${detail})` };
  }
  if (touchesGlobal(paths)) {
    return { outputs: allTrue(), reason: "a file on the global-trigger list changed" };
  }
  return {
    outputs: matchOutputs(paths),
    reason: `${paths.length} changed file(s) matched against the path table`,
  };
}

function gitDiff(base, head) {
  // --no-renames lists a moved file under its old path as well as its new one, so
  // moving a file out of backend/ still counts as a backend change.
  const output = execFileSync("git", ["diff", "--name-only", "--no-renames", `${base}...${head}`], {
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

  const { outputs, reason } = decide({
    base: options["--base"],
    head: options["--head"],
    diff: gitDiff,
  });
  const running = OUTPUTS.filter((name) => outputs[name]);
  const skipping = OUTPUTS.filter((name) => !outputs[name]);
  stdout.write(
    `ci-changed-paths: ${reason}; running ${running.join(", ") || "none"}; ` +
      `skipping ${skipping.join(", ") || "none"}\n`,
  );
  const lines = OUTPUTS.map((name) => `${name}=${outputs[name]}\n`).join("");
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, lines);
  else stdout.write(lines);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
