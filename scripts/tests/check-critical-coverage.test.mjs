// Regression tests for scripts/check-critical-coverage.mjs. Run: node --test scripts/tests/*.test.mjs
//
// The first four cases are the four scenarios of spec ci-quality-gates "認證與授權的關鍵路徑
// 分支覆蓋率門檻" (login-auth-guard task 9.1); the rest pin the edges the script promises
// (directory entries, absolute frontend keys, the exact threshold, usage errors). Each case
// writes its own list and reports into a temporary directory that plays the repository root.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, test } from "node:test";

import { ITEMS, validateList } from "../check-critical-coverage.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SCRIPT = join(ROOT, "scripts/check-critical-coverage.mjs");

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "check-critical-coverage-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const list = (overrides = {}) => ({
  threshold: 90,
  items: [
    {
      id: "authentication",
      backend: ["backend/app/core/tokens.py", "backend/app/modules/account/service/"],
      frontend: ["frontend/src/features/auth/"],
    },
    {
      id: "authorization",
      backend: ["backend/app/core/auth.py"],
      frontend: ["frontend/src/features/auth/route-guards.tsx"],
    },
  ],
  ...overrides,
});

/** Backend report in coverage.py's shape: keys relative to backend/. */
const backend = (files) => ({
  files: Object.fromEntries(
    Object.entries(files).map(([path, [covered, total]]) => [
      path,
      { summary: { covered_branches: covered, num_branches: total } },
    ]),
  ),
});

/** Frontend report in Vitest's json-summary shape: absolute keys under the root. */
const frontend = (files) => ({
  total: { branches: { total: 0, covered: 0, pct: 100 } },
  ...Object.fromEntries(
    Object.entries(files).map(([path, [covered, total]]) => [
      join(dir, "frontend", path),
      { branches: { covered, total } },
    ]),
  ),
});

const PASSING_BACKEND = {
  "app/core/tokens.py": [14, 14],
  "app/modules/account/service/google.py": [13, 14],
  "app/modules/account/service/session.py": [29, 30],
  "app/core/auth.py": [4, 4],
};
const PASSING_FRONTEND = {
  "src/features/auth/login-form.tsx": [40, 42],
  "src/features/auth/route-guards.tsx": [12, 12],
};

function run({
  listJson = list(),
  backendFiles = PASSING_BACKEND,
  frontendFiles = PASSING_FRONTEND,
  args,
} = {}) {
  mkdirSync(join(dir, "reports"), { recursive: true });
  writeFileSync(join(dir, "critical-coverage.json"), JSON.stringify(listJson));
  writeFileSync(join(dir, "reports/backend.json"), JSON.stringify(backend(backendFiles)));
  writeFileSync(join(dir, "reports/frontend.json"), JSON.stringify(frontend(frontendFiles)));
  const argv = args ?? [
    "--list",
    join(dir, "critical-coverage.json"),
    "--backend",
    join(dir, "reports/backend.json"),
    "--frontend",
    join(dir, "reports/frontend.json"),
    "--root",
    dir,
  ];
  const r = spawnSync(process.execPath, [SCRIPT, ...argv], { encoding: "utf8" });
  return { status: r.status, output: r.stdout + r.stderr };
}

// --- the four scenarios ------------------------------------------------------------------

test("authentication backend at 89.0% fails and names the item, tier, threshold and value", () => {
  const { status, output } = run({
    backendFiles: {
      "app/core/tokens.py": [100, 100],
      "app/modules/account/service/session.py": [78, 100],
      "app/core/auth.py": [4, 4],
    },
  });

  assert.equal(status, 1);
  assert.match(
    output,
    /FAIL authentication backend: branch coverage 89\.0% \(178\/200\), threshold 90\.0%/,
  );
  assert.match(output, /check-critical-coverage: FAILED/);
});

test("both items at or above 90.0% in both tiers pass", () => {
  const { status, output } = run();

  assert.equal(status, 0, output);
  for (const item of ["authentication", "authorization"]) {
    for (const tier of ["backend", "frontend"]) {
      assert.match(output, new RegExp(`OK ${item} ${tier}: branch coverage`));
    }
  }
  assert.match(output, /check-critical-coverage: OK/);
});

test("a listed file that does not exist fails and is named", () => {
  const withMissing = list();
  withMissing.items[0].backend.push("backend/app/core/no_such.py");

  const { status, output } = run({ listJson: withMissing });

  assert.equal(status, 1);
  assert.match(output, /backend\/app\/core\/no_such\.py is not in the backend coverage report/);
});

test("the real list holds exactly the authentication and authorization items", () => {
  const real = JSON.parse(readFileSync(join(ROOT, "critical-coverage.json"), "utf8"));

  assert.deepEqual(validateList(real), []);
  assert.deepEqual(real.items.map((item) => item.id).sort(), [...ITEMS].sort());
  assert.equal(real.threshold, 90);
  assert.ok(
    real.items
      .find((item) => item.id === "authentication")
      .backend.includes("backend/app/modules/account/service/"),
  );
});

// --- edges ---------------------------------------------------------------------------------

test("a list with a third item, such as answer isolation, fails", () => {
  const extra = list();
  extra.items.push({ id: "answerIsolation", backend: ["backend/app/x.py"], frontend: ["x"] });

  const { status, output } = run({ listJson: extra });

  assert.equal(status, 1);
  assert.match(output, /exactly the items authentication, authorization/);
});

test("a directory entry adds up every file under it, and nothing outside it", () => {
  const { status, output } = run({
    backendFiles: {
      ...PASSING_BACKEND,
      "app/modules/account/service/login.py": [0, 30],
      "app/modules/account/servicex.py": [0, 1000],
    },
  });

  assert.equal(status, 1);
  assert.match(output, /FAIL authentication backend: branch coverage 63\.6% \(56\/88\)/);
});

test("exactly 90.0% passes", () => {
  const { status, output } = run({
    backendFiles: { ...PASSING_BACKEND, "app/core/auth.py": [9, 10] },
  });

  assert.equal(status, 0, output);
  assert.match(output, /OK authorization backend: branch coverage 90\.0% \(9\/10\)/);
});

test("a frontend file below the threshold fails the frontend tier only", () => {
  const { status, output } = run({
    frontendFiles: { ...PASSING_FRONTEND, "src/features/auth/route-guards.tsx": [10, 12] },
  });

  assert.equal(status, 1);
  assert.match(output, /FAIL authorization frontend: branch coverage 83\.3% \(10\/12\)/);
  assert.match(output, /OK authorization backend/);
});

test("a tier whose files have no branches counts as 100.0%", () => {
  const { status, output } = run({
    backendFiles: { ...PASSING_BACKEND, "app/core/auth.py": [0, 0] },
  });

  assert.equal(status, 0, output);
  assert.match(output, /OK authorization backend: branch coverage 100\.0% \(0\/0\)/);
});

test("a missing option or an unreadable report is a usage error, exit 2", () => {
  assert.equal(run({ args: ["--list", join(dir, "critical-coverage.json")] }).status, 2);
  const missingReport = run({
    args: [
      "--list",
      join(dir, "critical-coverage.json"),
      "--backend",
      join(dir, "nope.json"),
      "--frontend",
      join(dir, "reports/frontend.json"),
    ],
  });
  assert.equal(missingReport.status, 2);
  assert.match(missingReport.output, /backend coverage report not found/);
});
