// Regression tests for scripts/check-coverage.mjs. Run: node --test scripts/tests/*.test.mjs
//
// Each case is a number set from spec ci-quality-gates' three coverage
// requirements (not below the baseline; the baseline only stays or rises; a
// rise produces a suggested baseline). The script reads files only, so every
// case also checks that the fixture baselines are byte-for-byte unchanged.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, test } from "node:test";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SCRIPT = join(ROOT, "scripts/check-coverage.mjs");
const FIXTURES = join(ROOT, "scripts/tests/fixtures/coverage");
const PRETTIER = join(ROOT, "node_modules/.bin/prettier");
const fixture = (name) => join(FIXTURES, name);

let outDir;
let before;

const snapshotFixtures = () =>
  Object.fromEntries(
    readdirSync(FIXTURES).map((name) => [name, readFileSync(fixture(name), "utf8")]),
  );

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), "check-coverage-"));
  before = snapshotFixtures();
});

afterEach(() => {
  assert.deepEqual(snapshotFixtures(), before, "a fixture file was modified");
  rmSync(outDir, { recursive: true, force: true });
});

/**
 * Run the script. `base` is a fixture name, `null` for "no --base-baseline",
 * or "missing" for a path that does not exist (base branch has no file).
 */
function run({ backend, frontend, baseline, base = "baseline.json", allowLower = false }) {
  const suggested = join(outDir, "coverage-baseline.suggested.json");
  const args = [
    SCRIPT,
    "--backend",
    fixture(backend),
    "--frontend",
    fixture(frontend),
    "--baseline",
    baseline === "missing" ? join(outDir, "coverage-baseline.json") : fixture(baseline),
    "--suggested-out",
    suggested,
  ];
  if (base === "missing") args.push("--base-baseline", join(outDir, "base-coverage-baseline.json"));
  else if (base !== null) args.push("--base-baseline", fixture(base));
  if (allowLower) args.push("--allow-lower");
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  return { ...r, output: r.stdout + r.stderr, suggested };
}

test("frontend statements 89.8 against a 90.0 baseline fails with layer, metric and both values", () => {
  const r = run({
    backend: "backend-95.0.json",
    frontend: "frontend-89.8-85.0.json",
    baseline: "baseline.json",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.output, /frontend statements.*baseline 90\.0.*measured 89\.8/);
});

test("backend 94.95 against a 95.0 baseline passes within the 0.1 tolerance", () => {
  const r = run({
    backend: "backend-94.95.json",
    frontend: "frontend-90.0-85.0.json",
    baseline: "baseline.json",
  });
  assert.equal(r.status, 0, r.output);
  assert.equal(existsSync(r.suggested), false, "no rise, so no suggested baseline");
});

test("a missing PR baseline fails, names the file, and still writes a suggested baseline", () => {
  const r = run({
    backend: "backend-95.0.json",
    frontend: "frontend-90.0-85.0.json",
    baseline: "missing",
    base: null,
  });
  assert.notEqual(r.status, 0);
  assert.match(r.output, /coverage-baseline\.json/);
  assert.match(r.output, /not found/);
  const suggested = JSON.parse(readFileSync(r.suggested, "utf8"));
  assert.deepEqual(suggested, {
    backend: { percentCovered: 95 },
    frontend: { statements: 90, branches: 85 },
    tolerance: 0.1,
  });
});

test("a PR baseline without frontend branches fails and names the field", () => {
  const r = run({
    backend: "backend-95.0.json",
    frontend: "frontend-90.0-85.0.json",
    baseline: "baseline-missing-branches.json",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.output, /frontend\.branches/);
  assert.equal(JSON.parse(readFileSync(r.suggested, "utf8")).frontend.branches, 85);
});

test("lowering the baseline below base (90.0 to 88.0) without --allow-lower fails with both values", () => {
  const r = run({
    backend: "backend-95.0.json",
    frontend: "frontend-88.5-85.0.json",
    baseline: "baseline-statements-lowered.json",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.output, /frontend statements.*base 90\.0.*PR baseline 88\.0/);
  assert.match(r.output, /coverage-baseline-lower/);
});

test("loosening the tolerance from 0.1 to 0.5 counts as lowering", () => {
  const r = run({
    backend: "backend-95.0.json",
    frontend: "frontend-90.0-85.0.json",
    baseline: "baseline-tolerance-loosened.json",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.output, /tolerance.*loosened.*base 0\.1.*PR baseline 0\.5/);
});

test("with --allow-lower the lowered baseline passes", () => {
  const r = run({
    backend: "backend-95.0.json",
    frontend: "frontend-88.5-85.0.json",
    baseline: "baseline-statements-lowered.json",
    allowLower: true,
  });
  assert.equal(r.status, 0, r.output);
});

test("a rise from 85.0 to 86.0 passes and prints exactly the suggested baseline it writes", () => {
  const r = run({
    backend: "backend-95.0.json",
    frontend: "frontend-90.0-86.0.json",
    baseline: "baseline.json",
  });
  assert.equal(r.status, 0, r.output);
  const written = readFileSync(r.suggested, "utf8");
  assert.deepEqual(JSON.parse(written), {
    backend: { percentCovered: 95 },
    frontend: { statements: 90, branches: 86 },
    tolerance: 0.1,
  });
  assert.equal(written, `${JSON.stringify(JSON.parse(written), null, 2)}\n`);
  assert.ok(r.stdout.includes(written), "the log must contain the whole suggested file");
  const prettier = spawnSync(PRETTIER, ["--check", r.suggested], { encoding: "utf8", cwd: ROOT });
  assert.equal(prettier.status, 0, prettier.stdout + prettier.stderr);
});

test("a base branch without coverage-baseline.json passes and prints a notice", () => {
  const r = run({
    backend: "backend-95.0.json",
    frontend: "frontend-90.0-85.0.json",
    baseline: "baseline.json",
    base: "missing",
  });
  assert.equal(r.status, 0, r.output);
  assert.match(r.output, /::notice::.*base branch has no coverage-baseline\.json/i);
});

test("a measured file that does not exist fails instead of counting as 0", () => {
  const r = run({
    backend: "no-such-backend.json",
    frontend: "frontend-90.0-85.0.json",
    baseline: "baseline.json",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.output, /no-such-backend\.json/);
});

test("the script has no --update flag and never writes the baseline it reads", () => {
  const source = readFileSync(SCRIPT, "utf8");
  assert.equal(source.includes("--update"), false);
  const r = spawnSync(process.execPath, [SCRIPT, "--update"], { encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unknown option --update/);
});
