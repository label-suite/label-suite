// Regression tests for .github/workflows/ci.yml. Run: node --test scripts/tests/ci-workflow.test.mjs
//
// The workflow is parsed as YAML and its structure is asserted: which jobs exist,
// which conditions they carry, and the order of their steps (design D14, D4 C1-C11).
// Steps are found by the command they run, never by their display name, so renaming
// a step does not break the test (design R10). Each task that adds a job adds its
// assertions here; this file currently covers C1, C4 and C10 for the two backend jobs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const WORKFLOW_PATH = fileURLToPath(new URL("../../.github/workflows/ci.yml", import.meta.url));
const workflow = parse(readFileSync(WORKFLOW_PATH, "utf8"));

/** The jobs that existed before #506; their blocks are never edited. */
const EXISTING_JOBS = ["commit-messages", "docs-site", "format", "specs"];

/** Jobs that every pull request must run (C1). Grows with each task that adds a job. */
const ALWAYS_RUN_JOBS = ["backend-sqlite", "backend-postgres"];

function job(name) {
  const found = workflow.jobs?.[name];
  assert.ok(found, `job ${name} is missing from ci.yml`);
  return found;
}

/** Index of the first step whose `run` text matches, or -1. */
function stepIndex(steps, pattern) {
  return steps.findIndex((step) => typeof step.run === "string" && pattern.test(step.run));
}

/** Index of the first step that matches; fails the test with the pattern when none does. */
function requireStep(jobName, pattern) {
  const steps = job(jobName).steps;
  const index = stepIndex(steps, pattern);
  assert.notEqual(index, -1, `${jobName} has no step running ${pattern}`);
  return index;
}

function uploadSteps(jobName) {
  return job(jobName).steps.filter(
    (step) => typeof step.uses === "string" && step.uses.startsWith("actions/upload-artifact@"),
  );
}

describe("C1: every pull request runs the always-on jobs", () => {
  test("the always-on jobs exist, have no job-level if and no continue-on-error", () => {
    for (const name of ALWAYS_RUN_JOBS) {
      const found = job(name);
      assert.equal("if" in found, false, `${name} must not have a job-level if`);
      assert.equal("continue-on-error" in found, false, `${name} must not set continue-on-error`);
    }
  });

  test("no step of the always-on jobs is conditional or allowed to fail", () => {
    for (const name of ALWAYS_RUN_JOBS) {
      for (const step of job(name).steps) {
        assert.equal("continue-on-error" in step, false, `${name}: ${JSON.stringify(step)}`);
      }
    }
  });

  test("on.pull_request has no paths or paths-ignore filter", () => {
    const trigger = workflow.on.pull_request;
    assert.ok(trigger === null || typeof trigger === "object");
    assert.equal("paths" in (trigger ?? {}), false);
    assert.equal("paths-ignore" in (trigger ?? {}), false);
  });

  test("the four existing jobs are still present", () => {
    for (const name of EXISTING_JOBS) job(name);
  });
});

describe("C4: backend-sqlite", () => {
  const pytest = /pytest --cov=app --cov-branch --junitxml=test-results\/junit-sqlite\.xml/;

  test("steps run in the order ruff check, ruff format, mypy, lint-imports, pytest, skip summary", () => {
    const order = [
      requireStep("backend-sqlite", /\buv sync --locked\b/),
      requireStep("backend-sqlite", /\bruff check\b/),
      requireStep("backend-sqlite", /\bruff format --check\b/),
      requireStep("backend-sqlite", /\bmypy --strict app\b/),
      requireStep("backend-sqlite", /\blint-imports\b/),
      requireStep("backend-sqlite", pytest),
      requireStep("backend-sqlite", /check-junit-skips\.mjs --summary\b/),
    ];
    assert.deepEqual(
      order,
      [...order].sort((a, b) => a - b),
    );
    assert.equal(new Set(order).size, order.length, "each command is its own step");
  });

  test("the skipped count goes to the job summary and reads the SQLite report", () => {
    const steps = job("backend-sqlite").steps;
    const run = steps[requireStep("backend-sqlite", /check-junit-skips\.mjs --summary\b/)].run;
    assert.match(run, /test-results\/junit-sqlite\.xml/);
    assert.match(run, /\$GITHUB_STEP_SUMMARY/);
  });

  test("the pytest step writes coverage to .coverage.sqlite and runs without TEST_DATABASE_URL", () => {
    const step = job("backend-sqlite").steps[requireStep("backend-sqlite", pytest)];
    assert.equal(step.env?.COVERAGE_FILE, ".coverage.sqlite");
    assert.equal("TEST_DATABASE_URL" in (step.env ?? {}), false);
    assert.equal("TEST_DATABASE_URL" in (job("backend-sqlite").env ?? {}), false);
  });

  test("the coverage upload keeps hidden files and fails when the file is missing", () => {
    const uploads = uploadSteps("backend-sqlite");
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].with.name, "coverage-backend-sqlite");
    assert.match(uploads[0].with.path, /\.coverage\.sqlite$/);
    assert.equal(uploads[0].with["include-hidden-files"], true);
    assert.equal(uploads[0].with["if-no-files-found"], "error");
  });
});

describe("C4: backend-postgres", () => {
  const pytest = /pytest --cov=app --cov-branch --junitxml=test-results\/junit-postgres\.xml/;

  test("uses a postgres:16 service container", () => {
    const services = Object.values(job("backend-postgres").services ?? {});
    assert.ok(
      services.some((service) => service.image === "postgres:16"),
      "backend-postgres needs a postgres:16 service container",
    );
  });

  test("steps run in the order uv sync, pytest, skip check without --summary", () => {
    const order = [
      requireStep("backend-postgres", /\buv sync --locked\b/),
      requireStep("backend-postgres", pytest),
      requireStep("backend-postgres", /check-junit-skips\.mjs\b/),
    ];
    assert.deepEqual(
      order,
      [...order].sort((a, b) => a - b),
    );
    const run = job("backend-postgres").steps[order[2]].run;
    assert.doesNotMatch(run, /--summary/);
    assert.match(run, /test-results\/junit-postgres\.xml/);
  });

  test("the pytest step points TEST_DATABASE_URL at the service and writes .coverage.postgres", () => {
    const step = job("backend-postgres").steps[requireStep("backend-postgres", pytest)];
    assert.equal(step.env?.COVERAGE_FILE, ".coverage.postgres");
    const url = step.env?.TEST_DATABASE_URL ?? "";
    assert.match(url, /^postgresql\+asyncpg:\/\/postgres:[^@]+@localhost:5432\//);
    // The password is derived from the run, never a literal (AGENTS.md hard rule 8).
    assert.match(url, /\$\{\{ github\.run_id \}\}/);
    const service = Object.values(job("backend-postgres").services).find(
      (candidate) => candidate.image === "postgres:16",
    );
    assert.match(service.env?.POSTGRES_PASSWORD ?? "", /\$\{\{ github\.run_id \}\}/);
  });

  test("the coverage upload keeps hidden files and fails when the file is missing", () => {
    const uploads = uploadSteps("backend-postgres");
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].with.name, "coverage-backend-postgres");
    assert.match(uploads[0].with.path, /\.coverage\.postgres$/);
    assert.equal(uploads[0].with["include-hidden-files"], true);
    assert.equal(uploads[0].with["if-no-files-found"], "error");
  });
});

describe("C4: the two backend jobs do not collide", () => {
  test("COVERAGE_FILE values and artifact names differ", () => {
    const sqlite = job("backend-sqlite").steps.find((s) => s.env?.COVERAGE_FILE).env.COVERAGE_FILE;
    const postgres = job("backend-postgres").steps.find((s) => s.env?.COVERAGE_FILE).env
      .COVERAGE_FILE;
    assert.notEqual(sqlite, postgres);
    assert.notEqual(
      uploadSteps("backend-sqlite")[0].with.name,
      uploadSteps("backend-postgres")[0].with.name,
    );
  });
});

describe("C10: new jobs use no secrets and no extra permissions", () => {
  const newJobs = () => Object.keys(workflow.jobs).filter((name) => !EXISTING_JOBS.includes(name));

  test("the workflow grants contents: read only", () => {
    assert.deepEqual(workflow.permissions, { contents: "read" });
  });

  test("no new job references secrets. or widens its permissions", () => {
    assert.ok(newJobs().length >= ALWAYS_RUN_JOBS.length);
    for (const name of newJobs()) {
      assert.doesNotMatch(JSON.stringify(workflow.jobs[name]), /secrets\./, name);
      assert.equal("permissions" in workflow.jobs[name], false, `${name} must inherit permissions`);
    }
  });

  test("no new job gates a step on hashFiles()", () => {
    for (const name of newJobs()) {
      assert.doesNotMatch(JSON.stringify(workflow.jobs[name]), /hashFiles\(/, name);
    }
  });
});
