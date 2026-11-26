// Regression tests for scripts/check-junit-skips.mjs. Run: node --test scripts/tests/*.test.mjs
//
// The PostgreSQL round must report 0 skipped tests (system-design D11); the
// SQLite round only reports the count for the job summary (--summary).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { parseJunitSkips } from "../check-junit-skips.mjs";

const SCRIPT = fileURLToPath(new URL("../check-junit-skips.mjs", import.meta.url));
const fixture = (name) => fileURLToPath(new URL(`./fixtures/junit/${name}`, import.meta.url));

const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

test("parseJunitSkips counts no skipped test in a clean report", () => {
  const result = parseJunitSkips(readFileSync(fixture("no-skips.xml"), "utf8"));
  assert.equal(result.count, 0);
  assert.deepEqual(result.names, []);
});

test("parseJunitSkips names each skipped test, self-closing tags and entities included", () => {
  const result = parseJunitSkips(readFileSync(fixture("two-skips.xml"), "utf8"));
  assert.equal(result.count, 2);
  assert.deepEqual(result.names, [
    "tests.integration.test_migrations::test_upgrade_downgrade[postgres]",
    "tests.integration.test_health::test_database_error_is_masked",
  ]);
});

test("parseJunitSkips rejects a file that is not a JUnit report", () => {
  assert.throws(() => parseJunitSkips(readFileSync(fixture("not-junit.xml"), "utf8")), /testsuite/);
});

test("a report with 0 skipped passes", () => {
  const r = run(fixture("no-skips.xml"));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /0 skipped/);
});

test("a PostgreSQL report with one skipped test fails and names the test", () => {
  const r = run(fixture("one-skip.xml"));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /tests\.integration\.test_health::test_health_reports_postgres/);
  assert.match(r.stderr, /1 skipped/);
});

test("--summary prints only the skipped count and exits 0 even with skips", () => {
  const r = run("--summary", fixture("two-skips.xml"));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), "Skipped tests: 2");
  assert.equal(r.stderr, "");
});

test("a missing report fails instead of passing as 0 skipped", () => {
  const r = run(fixture("does-not-exist.xml"));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /does-not-exist\.xml/);
});

test("--summary still fails on a missing report", () => {
  const r = run("--summary", fixture("does-not-exist.xml"));
  assert.notEqual(r.status, 0);
});

test("no report argument is a usage error", () => {
  const r = run();
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /usage/i);
});
