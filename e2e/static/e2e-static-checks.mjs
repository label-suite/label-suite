// Static checks over the e2e package (spec e2e-testing; design D7). Each check
// is a pure function over relative paths (and file contents where needed), so
// the test can feed it samples as well as the real tree.
//
// Patterns are written so that their own source text does not match them:
// this file lives in e2e/ and is scanned by findHostsAndPorts like any other.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** The one file allowed to hold host names, ports and their defaults (T8). */
export const CONFIG_FILE = "playwright.config.ts";

/** Directories that are tool output or installed packages, not package source. */
const SKIPPED_DIRS = new Set(["node_modules", "playwright-report", "test-results", "blob-report"]);

const HOST_AND_PORT_PATTERNS = [/\blocal(?:host)\b/i, /\b127\.0\.0\.1\b/, /:\d{4,5}\b/];

const FIXED_WAIT_PATTERNS = [/\bwaitForTimeout\s*\(/, /\bsetTimeout\s*\(/, /\bsleep\s*\(/];

const SPEC_SUFFIX = ".spec.ts";
const FIXTURES_DIR = "shared/fixtures/";
const SPEC_LOCATION = /^(?!shared\/)[^/]+\/[^/]+\.spec\.ts$/;

/**
 * Lists every file of the e2e package as a POSIX path relative to `root`,
 * skipping installed packages and Playwright output.
 *
 * @param {string} root Absolute path of the e2e package.
 * @returns {string[]} Sorted relative paths.
 */
export function listE2eFiles(root) {
  /** @type {string[]} */
  const found = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        found.push(path.relative(root, path.join(dir, entry.name)).split(path.sep).join("/"));
      }
    }
  };
  walk(root);
  return found.sort();
}

/**
 * Reads the given files.
 *
 * @param {string} root Absolute path of the e2e package.
 * @param {string[]} files Paths relative to `root`.
 * @returns {{ path: string, content: string }[]}
 */
export function readE2eFiles(root, files) {
  return files.map((file) => ({
    path: file,
    content: readFileSync(path.join(root, file), "utf8"),
  }));
}

/**
 * @param {{ path: string, content: string }[]} files
 * @param {RegExp[]} patterns
 * @returns {{ path: string, line: number, text: string }[]}
 */
function findLines(files, patterns) {
  /** @type {{ path: string, line: number, text: string }[]} */
  const hits = [];
  for (const file of files) {
    file.content.split("\n").forEach((text, index) => {
      if (patterns.some((pattern) => pattern.test(text))) {
        hits.push({ path: file.path, line: index + 1, text: text.trim() });
      }
    });
  }
  return hits;
}

/**
 * Finds host names, loopback addresses and port numbers anywhere but the
 * config file (spec "spec 不含主機與埠").
 *
 * @param {{ path: string, content: string }[]} files
 * @returns {{ path: string, line: number, text: string }[]}
 */
export function findHostsAndPorts(files) {
  return findLines(
    files.filter((file) => file.path !== CONFIG_FILE),
    HOST_AND_PORT_PATTERNS,
  );
}

/**
 * Finds fixed-time waits in spec files and shared helpers (spec "spec 不使用固定時間等待").
 *
 * @param {{ path: string, content: string }[]} files
 * @returns {{ path: string, line: number, text: string }[]}
 */
export function findFixedWaits(files) {
  return findLines(
    files.filter((file) => file.path.endsWith(SPEC_SUFFIX) || file.path.startsWith("shared/")),
    FIXED_WAIT_PATTERNS,
  );
}

/**
 * Finds files under shared/fixtures/ that are not TypeScript source (spec
 * "共用 fixtures 目錄沒有資料檔"; Hard Rule 6).
 *
 * @param {string[]} files Relative paths.
 * @returns {string[]}
 */
export function findFixtureDataFiles(files) {
  return files.filter((file) => file.startsWith(FIXTURES_DIR) && !file.endsWith(".ts"));
}

/**
 * Finds spec files that are not at <module>/<page>.spec.ts, including any
 * under shared/ (spec "spec 檔依模組與頁面放置").
 *
 * @param {string[]} files Relative paths.
 * @returns {string[]}
 */
export function findMisplacedSpecs(files) {
  return files.filter((file) => file.endsWith(SPEC_SUFFIX) && !SPEC_LOCATION.test(file));
}
