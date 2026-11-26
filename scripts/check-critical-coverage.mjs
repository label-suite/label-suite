#!/usr/bin/env node
// check-critical-coverage.mjs — branch coverage of the critical paths (login-auth-guard design D10,
// spec ci-quality-gates "認證與授權的關鍵路徑分支覆蓋率門檻", testing-agent-rules T10).
//
//   node scripts/check-critical-coverage.mjs \
//     --list critical-coverage.json \
//     --backend backend/coverage.json \
//     --frontend frontend/coverage/coverage-summary.json \
//     [--root <repository root, default: the current directory>]
//
// The list names each item's backend and frontend files, relative to the repository
// root. An entry ending in "/" (or "/**") is a directory and stands for every file
// under it that the report contains. For each item and each tier the branches of the
// listed files are added up (backend: coverage.py's summary.num_branches and
// covered_branches, already combined from both database runs; frontend: Vitest's
// branches.total and branches.covered) and the percentage must be at least the
// list's threshold. A tier with no branch at all counts as 100.0.
//
// Fails, naming the cause, when: an item or tier is below the threshold (the line
// carries the item, the tier, the threshold and the measured value, one decimal);
// a listed file or directory is not in the report (a missing file is not in it);
// the list holds anything but the authentication and authorization items.
//
// Exit codes: 0 every item and tier meets the threshold; 1 at least one failure;
// 2 usage error or an unreadable input file.
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** The only items the list may hold (spec ci-quality-gates "清單只有兩項"). */
export const ITEMS = ["authentication", "authorization"];
const TIERS = ["backend", "frontend"];
const OPTIONS = ["--list", "--backend", "--frontend", "--root"];
const REQUIRED = ["--list", "--backend", "--frontend"];

/** Float slack so a value sitting exactly on the threshold passes. */
const EPSILON = 1e-9;

class UsageError extends Error {}

/** Parse argv into an options object; throw UsageError on unknown or incomplete options. */
export function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!OPTIONS.includes(arg)) throw new UsageError(`unknown option ${arg}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) throw new UsageError(`${arg} needs a value`);
    options[arg] = value;
    i += 1;
  }
  const missing = REQUIRED.filter((name) => options[name] === undefined);
  if (missing.length > 0) throw new UsageError(`missing ${missing.join(", ")}`);
  return options;
}

function readJson(path, label) {
  if (!existsSync(path)) throw new UsageError(`${label} not found: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new UsageError(`${label} is not valid JSON: ${path} (${error.message})`);
  }
}

const toPosix = (path) => path.split(sep).join("/");

/** Backend report: coverage.py JSON, keys relative to backend/. Returns repo path -> branches. */
export function backendBranches(report) {
  const files = report?.files;
  if (files === null || typeof files !== "object")
    throw new UsageError("backend report has no files");
  const result = new Map();
  for (const [key, entry] of Object.entries(files)) {
    const total = entry?.summary?.num_branches;
    const covered = entry?.summary?.covered_branches;
    if (typeof total !== "number" || typeof covered !== "number") {
      throw new UsageError(`backend report has no branch counts for ${key}`);
    }
    result.set(`backend/${toPosix(key).replace(/^\.\//, "")}`, { total, covered });
  }
  return result;
}

/** Frontend report: Vitest json-summary, absolute keys plus "total". Returns repo path -> branches. */
export function frontendBranches(report, root) {
  if (report === null || typeof report !== "object")
    throw new UsageError("frontend report is empty");
  const result = new Map();
  for (const [key, entry] of Object.entries(report)) {
    if (key === "total") continue;
    const total = entry?.branches?.total;
    const covered = entry?.branches?.covered;
    if (typeof total !== "number" || typeof covered !== "number") {
      throw new UsageError(`frontend report has no branch counts for ${key}`);
    }
    const path = isAbsolute(key) ? toPosix(relative(root, key)) : `frontend/${toPosix(key)}`;
    result.set(path, { total, covered });
  }
  return result;
}

/** Validate the list: exactly the two items, each with string arrays for both tiers. */
export function validateList(list) {
  const problems = [];
  if (typeof list?.threshold !== "number") problems.push("the list has no numeric threshold");
  const items = Array.isArray(list?.items) ? list.items : [];
  const ids = items.map((item) => item?.id);
  if (ids.length !== ITEMS.length || ITEMS.some((id) => !ids.includes(id))) {
    problems.push(
      `the list must hold exactly the items ${ITEMS.join(", ")}; found ${ids.join(", ") || "none"}`,
    );
  }
  for (const item of items) {
    for (const tier of TIERS) {
      const paths = item?.[tier];
      if (!Array.isArray(paths) || paths.length === 0 || paths.some((p) => typeof p !== "string")) {
        problems.push(`item ${item?.id}: ${tier} must be a non-empty list of paths`);
      }
    }
  }
  return problems;
}

/** Return the report entries an entry of the list stands for (empty when none). */
function matching(entry, files) {
  const directory = entry.endsWith("/**") ? entry.slice(0, -2) : entry.endsWith("/") ? entry : null;
  if (directory === null) return files.has(entry) ? [files.get(entry)] : [];
  return [...files.entries()].filter(([path]) => path.startsWith(directory)).map(([, v]) => v);
}

/** Judge every item and tier. Returns { lines, failed } with one line per result or problem. */
export function evaluate(list, reports) {
  const lines = [];
  let failed = false;
  for (const item of list.items) {
    for (const tier of TIERS) {
      const files = reports[tier];
      let total = 0;
      let covered = 0;
      let incomplete = false;
      for (const entry of item[tier]) {
        const found = matching(entry, files);
        if (found.length === 0) {
          lines.push(`FAIL ${item.id} ${tier}: ${entry} is not in the ${tier} coverage report`);
          incomplete = true;
          continue;
        }
        for (const branches of found) {
          total += branches.total;
          covered += branches.covered;
        }
      }
      const percent = total === 0 ? 100 : (covered / total) * 100;
      const below = percent + EPSILON < list.threshold;
      const verdict = below || incomplete ? "FAIL" : "OK";
      lines.push(
        `${verdict} ${item.id} ${tier}: branch coverage ${percent.toFixed(1)}% ` +
          `(${covered}/${total}), threshold ${list.threshold.toFixed(1)}%`,
      );
      if (below || incomplete) failed = true;
    }
  }
  return { lines, failed };
}

/** Run the check; returns the exit code and writes the report to the given streams. */
export function main(argv, { stdout = process.stdout, stderr = process.stderr } = {}) {
  let options;
  let list;
  let reports;
  try {
    options = parseArgs(argv);
    const root = resolve(options["--root"] ?? process.cwd());
    list = readJson(options["--list"], "critical coverage list");
    const problems = validateList(list);
    if (problems.length > 0) {
      for (const problem of problems) stderr.write(`FAIL ${problem}\n`);
      return 1;
    }
    reports = {
      backend: backendBranches(readJson(options["--backend"], "backend coverage report")),
      frontend: frontendBranches(readJson(options["--frontend"], "frontend coverage report"), root),
    };
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    stderr.write(`check-critical-coverage: ${error.message}\n`);
    return 2;
  }
  const { lines, failed } = evaluate(list, reports);
  for (const line of lines) (line.startsWith("FAIL") ? stderr : stdout).write(`${line}\n`);
  stdout.write(failed ? "check-critical-coverage: FAILED\n" : "check-critical-coverage: OK\n");
  return failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
