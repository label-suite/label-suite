#!/usr/bin/env node
// check-junit-skips.mjs — read a pytest JUnit XML report and check the skipped count.
//
//   node scripts/check-junit-skips.mjs <junit.xml>            fail (exit 1) when any test was skipped
//   node scripts/check-junit-skips.mjs --summary <junit.xml>  print only the skipped count, exit 0
//
// The PostgreSQL round must skip nothing, and the failure names every skipped
// test (system-design D11, design D5). The SQLite round only reports the count,
// because tests marked `postgres` are meant to skip there. JUnit XML is read
// instead of pytest's terminal summary because its format does not change with
// pytest versions or plugins. A missing or unreadable report is an error in both
// modes (exit 2), never a silent "0 skipped".
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const ENTITIES = { quot: '"', apos: "'", lt: "<", gt: ">", amp: "&" };

/** Decode the five predefined XML entities and numeric character references. */
function decodeXml(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|quot|apos|lt|gt|amp);/gi, (_, ref) => {
    if (ref[0] === "#") {
      const code =
        ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[ref.toLowerCase()];
  });
}

/** Return the decoded value of one attribute in a tag's attribute text, or "". */
function attribute(attrs, name) {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return match ? decodeXml(match[1]) : "";
}

/**
 * Count the skipped test cases in a JUnit XML report.
 *
 * @param {string} xml the report text
 * @returns {{count: number, names: string[]}} names are `classname::name`
 * @throws {Error} when the text has no <testsuite>, or the per-case count does
 *   not match the suites' own `skipped` attributes
 */
export function parseJunitSkips(xml) {
  const suites = [...xml.matchAll(/<testsuite\b([^>]*)>/g)];
  if (suites.length === 0) throw new Error("not a JUnit report: no <testsuite> element");

  const names = [];
  for (const match of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const body = match[2] ?? "";
    if (!/<skipped\b/.test(body)) continue;
    const attrs = match[1];
    const classname = attribute(attrs, "classname");
    const name = attribute(attrs, "name");
    names.push(classname ? `${classname}::${name}` : name);
  }

  const declared = suites.reduce(
    (sum, suite) => sum + (Number(attribute(suite[1], "skipped")) || 0),
    0,
  );
  if (declared !== names.length) {
    throw new Error(
      `the report declares ${declared} skipped but lists ${names.length} skipped test cases`,
    );
  }
  return { count: names.length, names };
}

/** Run the CLI; return the exit code. */
export function main(argv, { stdout = process.stdout, stderr = process.stderr } = {}) {
  const summary = argv.includes("--summary");
  const files = argv.filter((arg) => arg !== "--summary");
  if (files.length !== 1 || files[0].startsWith("--")) {
    stderr.write("usage: check-junit-skips.mjs [--summary] <junit.xml>\n");
    return 2;
  }
  const [file] = files;

  let result;
  try {
    result = parseJunitSkips(readFileSync(file, "utf8"));
  } catch (error) {
    stderr.write(`check-junit-skips: cannot read ${file}: ${error.message}\n`);
    return 2;
  }

  if (summary) {
    stdout.write(`Skipped tests: ${result.count}\n`);
    return 0;
  }
  if (result.count === 0) {
    stdout.write(`check-junit-skips: ${basename(file)}: 0 skipped\n`);
    return 0;
  }
  stderr.write(
    `check-junit-skips: ${basename(file)}: ${result.count} skipped; this round must skip none:\n`,
  );
  for (const name of result.names) stderr.write(`  - ${name}\n`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
