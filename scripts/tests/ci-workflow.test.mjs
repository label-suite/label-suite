// Regression tests for .github/workflows/ci.yml. Run: node --test scripts/tests/ci-workflow.test.mjs
//
// The workflow is parsed as YAML and its structure is asserted: which jobs exist,
// which conditions they carry, and the order of their steps (design D14, D4 C1-C11).
// Steps are found by the command they run, never by their display name, so renaming
// a step does not break the test (design R10). Each task that adds a job adds its
// assertions here; this file currently covers C1, C2, C3, C4, C5, C6, C7, C8, C9, C10 and C11.
// C7 includes the header comparison, the production browser check and the failure-only report upload.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const WORKFLOW_PATH = fileURLToPath(new URL("../../.github/workflows/ci.yml", import.meta.url));
const workflow = parse(readFileSync(WORKFLOW_PATH, "utf8"));

/** The jobs that existed before #506; C1 checks that they are still present. */
const EXISTING_JOBS = ["commit-messages", "docs-site", "format", "specs"];

/** Jobs that every pull request must run (C1; issue #823's approved path table). */
const ALWAYS_RUN_JOBS = [
  "commit-messages",
  "format",
  "specs",
  "semgrep",
  "dependency-audit",
  "changes",
];

/**
 * Jobs that run only when `changes` says their paths changed, and the output each
 * reads (issue #823). The five code-group jobs read `code` or a widening of it.
 */
const CONDITIONAL_JOBS = {
  hooks: "hooks",
  "docs-site": "docs_site",
  "backend-sqlite": "code",
  "backend-postgres": "code",
  frontend: "frontend",
  e2e: "e2e",
  coverage: "code",
  "api-contract": "api_contract",
  "scripts-tests": "scripts",
  "scripts-tests-windows": "scripts",
  compose: "compose",
};

/**
 * The job-level `if` of a conditional job: it runs when its output is true, and also
 * when `changes` did not succeed, so a failed `changes` cannot skip it as passing.
 */
const changesCondition = (output) =>
  `\${{ !cancelled() && (needs.changes.result != 'success' || needs.changes.outputs.${output} == 'true') }}`;

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

  test("every job is either always-on or conditional, never both and never neither", () => {
    for (const name of Object.keys(workflow.jobs)) {
      const always = ALWAYS_RUN_JOBS.includes(name);
      const conditional = name in CONDITIONAL_JOBS;
      assert.ok(always !== conditional, `${name} must be in exactly one of the two lists`);
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

describe("conditional jobs read their own changes output (issue #823)", () => {
  test("each needs changes and has a job-level if on its output, with no continue-on-error", () => {
    for (const [name, output] of Object.entries(CONDITIONAL_JOBS)) {
      const found = job(name);
      const needs = [].concat(found.needs ?? []);
      assert.ok(needs.includes("changes"), `${name} must need changes`);
      if (name !== "coverage") {
        assert.equal(
          found.if,
          changesCondition(output),
          `${name} must run on the ${output} output or when changes did not succeed`,
        );
      }
      assert.equal("continue-on-error" in found, false, `${name} must not set continue-on-error`);
    }
  });

  test("changes exposes every output a conditional job reads, from the paths step", () => {
    const outputs = job("changes").outputs ?? {};
    for (const output of new Set(Object.values(CONDITIONAL_JOBS))) {
      assert.match(
        String(outputs[output] ?? ""),
        new RegExp(`steps\\.paths\\.outputs\\.${output}\\b`),
        `changes does not expose ${output}`,
      );
    }
  });

  test("coverage runs when the three test jobs succeeded and changes failed or said code", () => {
    const condition = String(job("coverage").if).replace(/\s+/g, " ").trim();
    assert.equal(
      condition,
      "${{ !cancelled() && needs.backend-sqlite.result == 'success'" +
        " && needs.backend-postgres.result == 'success'" +
        " && needs.frontend.result == 'success'" +
        " && (needs.changes.result != 'success' || needs.changes.outputs.code == 'true') }}",
    );
  });

  test("the five code-group jobs share the code condition, widened only for frontend and e2e", () => {
    for (const name of ["backend-sqlite", "backend-postgres", "frontend", "e2e", "coverage"]) {
      assert.match(String(job(name).if), /needs\.changes\.outputs\.(code|frontend|e2e) == 'true'/);
    }
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

describe("C5: frontend", () => {
  const stepsOf = () => job("frontend").steps;

  test("sets a job timeout", () => {
    assert.equal(typeof job("frontend")["timeout-minutes"], "number");
  });

  test("checks run in the order install, lint, typecheck, test:coverage, build", () => {
    const order = [
      requireStep("frontend", /\bpnpm install --frozen-lockfile\b/),
      requireStep("frontend", /\bfrontend lint\b/),
      requireStep("frontend", /\bfrontend typecheck\b/),
      requireStep("frontend", /\bfrontend test:coverage\b/),
      requireStep("frontend", /\bfrontend build\b/),
    ];
    assert.deepEqual(
      order,
      [...order].sort((a, b) => a - b),
    );
    assert.equal(new Set(order).size, order.length, "each command is its own step");
  });

  test("lint is the first check step, so nothing runs before it but setup", () => {
    const lint = requireStep("frontend", /\bfrontend lint\b/);
    const install = requireStep("frontend", /\bpnpm install --frozen-lockfile\b/);
    const earlierRuns = stepsOf()
      .slice(0, lint)
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => typeof step.run === "string" && step.run !== undefined);
    assert.deepEqual(
      earlierRuns.map(({ index }) => index),
      [install],
    );
  });

  test("no step runs always() or is allowed to fail, and checkout is clean", () => {
    for (const step of stepsOf()) {
      assert.equal("continue-on-error" in step, false, JSON.stringify(step));
      assert.doesNotMatch(String(step.if ?? ""), /always\(\)/, JSON.stringify(step));
      if (typeof step.uses === "string" && step.uses.startsWith("actions/checkout@")) {
        assert.notEqual(step.with?.clean, false);
      }
    }
  });

  test("the coverage summary upload fails when the file is missing", () => {
    const uploads = uploadSteps("frontend");
    assert.equal(uploads.length, 1);
    assert.match(uploads[0].with.path, /coverage-summary\.json$/);
    assert.equal(uploads[0].with["if-no-files-found"], "error");
    const build = requireStep("frontend", /\bfrontend build\b/);
    assert.ok(stepsOf().indexOf(uploads[0]) > build, "upload comes after build");
  });
});

describe("C8: e2e", () => {
  test("runs test:static before the Playwright run", () => {
    const order = [
      requireStep("e2e", /\bpnpm install --frozen-lockfile\b/),
      requireStep("e2e", /\buv sync --locked\b/),
      requireStep("e2e", /\be2e test:static\b/),
      requireStep("e2e", /\bplaywright install --with-deps chromium\b/),
      requireStep("e2e", /\bpnpm --filter e2e test\s*$/m),
    ];
    assert.deepEqual(
      order,
      [...order].sort((a, b) => a - b),
    );
    assert.equal(new Set(order).size, order.length, "each command is its own step");
  });

  test("installs the backend from the backend directory", () => {
    const step = job("e2e").steps[requireStep("e2e", /\buv sync --locked\b/)];
    assert.ok(
      /\bcd backend\b/.test(step.run) || step["working-directory"] === "backend",
      "uv sync --locked must run in backend/",
    );
  });

  test("the report upload runs only on failure and fails when the report is missing", () => {
    const uploads = uploadSteps("e2e");
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].if, "failure()");
    assert.match(uploads[0].with.path, /e2e\/playwright-report/);
    assert.equal(uploads[0].with["if-no-files-found"], "error");
  });

  test("no other step is conditional or allowed to fail", () => {
    for (const step of job("e2e").steps) {
      if (step.uses?.startsWith("actions/upload-artifact@")) continue;
      assert.equal("if" in step, false, JSON.stringify(step));
      assert.equal("continue-on-error" in step, false, JSON.stringify(step));
    }
  });
});

describe("C6: api-contract", () => {
  const exportCmd = /\buv run python -m app\.scripts\.export_openapi\b/;
  const generateCmd = /\bpnpm --filter frontend api:generate\b/;
  const checkOpenapi = /git (?:diff|status)[^\n]*backend\/openapi\.json/;
  const COPY = "docs/diagrams/architecture/api.openapi.json";
  const checkGenerated = /git (?:diff|status)[^\n]*frontend\/src\/api\/generated/;

  test("runs export, compares openapi.json, regenerates, then compares the generated client", () => {
    const order = [
      requireStep("api-contract", /\buv sync --locked\b/),
      requireStep("api-contract", exportCmd),
      requireStep("api-contract", checkOpenapi),
      requireStep("api-contract", generateCmd),
      requireStep("api-contract", checkGenerated),
    ];
    assert.deepEqual(
      order,
      [...order].sort((a, b) => a - b),
    );
    assert.equal(new Set(order).size, order.length, "each command is its own step");
    const install = requireStep("api-contract", /\bpnpm install --frozen-lockfile\b/);
    assert.ok(install < order[3], "dependencies are installed before the client is regenerated");
  });

  test("each comparison fails on a diff and on an untracked file, and lists the file names", () => {
    for (const pattern of [checkOpenapi, checkGenerated]) {
      const steps = job("api-contract").steps;
      const run = steps[requireStep("api-contract", pattern)].run;
      assert.match(run, /git diff --exit-code/);
      assert.match(run, /git status --porcelain/);
      assert.match(run, /--name-only|--porcelain/);
      assert.match(run, /exit 1/);
    }
  });

  test("the openapi.json comparison also covers the docs copy and names it in the hint", () => {
    const run = job("api-contract").steps[requireStep("api-contract", checkOpenapi)].run;
    assert.match(run, new RegExp(`git diff[^\\n]*${COPY.replaceAll(".", "\\.")}`));
    assert.match(run, new RegExp(`git status[^\\n]*${COPY.replaceAll(".", "\\.")}`));
    assert.match(run, /pnpm run api:sync/);
    assert.doesNotMatch(run, /\bcmp\b/);
  });

  test("the export step is not run from the repository root", () => {
    const step = job("api-contract").steps[requireStep("api-contract", exportCmd)];
    assert.ok(
      /\bcd backend\b/.test(step.run) || step["working-directory"] === "backend",
      "the export must run in backend/",
    );
  });
});

describe("C7: changes and compose", () => {
  const COMPOSE_VERSION = /docker compose version/;
  const LITE_CONFIG = /^docker compose config --quiet\s*$/m;
  const PROD_CONFIG =
    /POSTGRES_PASSWORD="?\$\{?[A-Z_]+\}?"? docker compose -f docker-compose\.prod\.yml config --quiet/;
  const CORS_REJECTED = /if [^\n]*CORS_ALLOWED_ORIGINS= docker compose config --quiet/;
  const PASSWORD_REJECTED =
    /if [^\n]*POSTGRES_PASSWORD= docker compose -f docker-compose\.prod\.yml config --quiet/;
  const STATIC = /config --format json/;
  const LITE_UP = /^docker compose up --build --wait --wait-timeout 300\s*$/m;
  const PROD_UP =
    /POSTGRES_PASSWORD="?\$\{?[A-Z_]+\}?"? docker compose -f docker-compose\.prod\.yml up --build --wait --wait-timeout 300/;
  const HEALTH = /localhost:8080\/api\/v1\/health/;
  const LITE_DOWN = /^docker compose down -v\s*$/m;
  const PROD_DOWN = /docker compose -f docker-compose\.prod\.yml down -v/;
  const HEADERS = /scripts\/check-security-headers\.sh http:\/\/localhost:8080\s*$/m;
  const HEADERS_DOWN = /scripts\/check-security-headers\.sh --backend-down http:\/\/localhost:8080/;
  const BROWSER =
    /E2E_TARGET=compose E2E_BASE_URL=http:\/\/localhost:8080 pnpm --filter e2e test\s*$/m;
  const LITE_STOP = /^docker compose stop backend\s*$/m;
  const PROD_STOP =
    /POSTGRES_PASSWORD="?\$\{?[A-Z_]+\}?"? docker compose -f docker-compose\.prod\.yml stop backend/;
  const CHROMIUM = /\bplaywright install --with-deps chromium\b/;
  const RESTART = /^scripts\/check-login-survives-restart\.sh http:\/\/localhost:8080\s*$/m;

  const stepsOf = () => job("compose").steps;
  const indexes = (pattern) =>
    stepsOf().flatMap((step, i) =>
      typeof step.run === "string" && pattern.test(step.run) ? [i] : [],
    );

  test("changes checks out the full history and calls ci-changed-paths.mjs, exposing compose", () => {
    const steps = job("changes").steps;
    const checkout = steps.find((s) => s.uses?.startsWith("actions/checkout@"));
    assert.equal(checkout.with["fetch-depth"], 0);
    const run = steps[requireStep("changes", /node scripts\/ci-changed-paths\.mjs\b/)].run;
    assert.match(run, /--base\b/);
    assert.match(run, /--head\b/);
    assert.match(String(job("changes").outputs?.compose ?? ""), /steps\.[\w-]+\.outputs\.compose/);
    assert.equal("if" in job("changes"), false);
    assert.equal("needs" in job("changes"), false);
  });

  test("compose needs changes, reads its output, and has a 20 minute timeout", () => {
    const found = job("compose");
    const needs = [].concat(found.needs ?? []);
    assert.ok(needs.includes("changes"));
    assert.match(String(found.if), /needs\.changes\.outputs\.compose/);
    assert.equal(found["timeout-minutes"], 20);
    assert.equal("continue-on-error" in found, false);
  });

  test("the version check is the first run step and compares against 2.20.0", () => {
    const first = stepsOf().findIndex((step) => typeof step.run === "string");
    assert.equal(first, requireStep("compose", COMPOSE_VERSION));
    const run = stepsOf()[first].run;
    assert.match(run, /2\.20\.0/);
    assert.match(run, /exit 1/);
  });

  test("steps run in order: config checks, rejections, static assertions, Lite, then production", () => {
    const at = (pattern) => {
      const found = indexes(pattern);
      assert.ok(found.length > 0, `compose has no step running ${pattern}`);
      return found[0];
    };
    const order = [
      at(COMPOSE_VERSION),
      at(/\bcp \.env\.example \.env\b/),
      at(LITE_CONFIG),
      at(PROD_CONFIG),
      at(CORS_REJECTED),
      at(PASSWORD_REJECTED),
      at(STATIC),
      at(CHROMIUM),
      at(LITE_UP),
      at(HEALTH),
      indexes(HEADERS)[0],
      at(RESTART),
      at(LITE_STOP),
      indexes(HEADERS_DOWN)[0],
      at(LITE_DOWN),
      at(PROD_UP),
      indexes(HEALTH)[1],
      indexes(HEADERS)[1],
      at(BROWSER),
      at(PROD_STOP),
      indexes(HEADERS_DOWN)[1],
      at(PROD_DOWN),
    ];
    for (const entry of order) assert.notEqual(entry, undefined, "a compose step is missing");
    assert.deepEqual(
      order,
      [...order].sort((a, b) => a - b),
      "compose steps are out of order",
    );
    // Each health check sits between its own up and down; two of them in all.
    const health = indexes(HEALTH);
    assert.equal(health.length, 2, "one health check per tier");
    assert.ok(at(LITE_UP) < health[0] && health[0] < at(LITE_DOWN));
    assert.ok(at(PROD_UP) < health[1] && health[1] < at(PROD_DOWN));
  });

  test("each tier compares the headers once and again with --backend-down after stopping the backend", () => {
    assert.equal(indexes(HEADERS).length, 2, "one header comparison per tier");
    assert.equal(indexes(HEADERS_DOWN).length, 2, "one --backend-down comparison per tier");
    assert.equal(indexes(LITE_STOP).length, 1);
    assert.equal(indexes(PROD_STOP).length, 1);
    const [liteDown, prodDown] = indexes(HEADERS_DOWN);
    assert.ok(indexes(LITE_UP)[0] < indexes(HEADERS)[0]);
    assert.ok(indexes(LITE_STOP)[0] < liteDown && liteDown < indexes(LITE_DOWN)[0]);
    assert.ok(indexes(PROD_STOP)[0] < prodDown && prodDown < indexes(PROD_DOWN)[0]);
  });

  test("the restart check runs once, on the Lite tier after its headers and before its backend stop", () => {
    // login-auth-guard task 4.5: spec container-runtime "重啟後登入狀態仍有效".
    const restart = indexes(RESTART);
    assert.equal(restart.length, 1, "exactly one restart check");
    assert.ok(indexes(HEADERS)[0] < restart[0] && restart[0] < indexes(LITE_STOP)[0]);
    assert.equal("env" in stepsOf()[restart[0]], false, "Lite runs with .env only");
  });

  test("the browser check runs once, on the production tier between its up and its backend stop", () => {
    const browser = indexes(BROWSER);
    assert.equal(browser.length, 1, "exactly one browser check");
    assert.ok(indexes(PROD_UP)[0] < browser[0] && browser[0] < indexes(PROD_STOP)[0]);
  });

  test("Chromium and the e2e dependencies are installed before the Lite tier starts", () => {
    const chromium = indexes(CHROMIUM);
    assert.equal(chromium.length, 1);
    assert.ok(chromium[0] < indexes(LITE_UP)[0]);
    const install = indexes(/\bpnpm install --frozen-lockfile --filter e2e\.\.\./);
    assert.equal(install.length, 1);
    assert.ok(install[0] < chromium[0]);
  });

  test("a failure-only step uploads the Playwright report under its own name and tolerates its absence", () => {
    const uploads = uploadSteps("compose");
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].if, "failure()");
    assert.match(uploads[0].with.path, /e2e\/playwright-report/);
    assert.equal(uploads[0].with.name, "playwright-report-public-entry");
    assert.notEqual(uploads[0].with.name, "playwright-report");
    assert.equal(uploads[0].with["if-no-files-found"], "ignore");
  });

  test("both rejection checks require a non-zero exit and name the variable in the output", () => {
    const run = (pattern) => stepsOf()[indexes(pattern)[0]].run;
    assert.match(run(CORS_REJECTED), /grep -q "?CORS_ALLOWED_ORIGINS/);
    assert.match(run(PASSWORD_REJECTED), /grep -q "?POSTGRES_PASSWORD/);
  });

  test("the production tier reads its password from a value generated inside the job", () => {
    const steps = stepsOf();
    const generate = steps.findIndex((s) => /openssl rand/.test(s.run ?? ""));
    assert.notEqual(generate, -1, "compose has no step generating a password");
    const run = steps[generate].run;
    assert.ok(run.indexOf("::add-mask::") !== -1, "the value is masked");
    assert.ok(run.indexOf("::add-mask::") < run.indexOf("GITHUB_ENV"), "mask before export");
    assert.ok(generate < indexes(PROD_CONFIG)[0], "generated before it is first used");
    for (const pattern of [PROD_CONFIG, PROD_UP]) {
      assert.doesNotMatch(
        steps[indexes(pattern)[0]].run,
        /POSTGRES_PASSWORD="?[A-Za-z0-9]{6,}"? /,
        "no literal password",
      );
    }
    assert.doesNotMatch(JSON.stringify(job("compose")), /secrets\./);
  });

  test("the static assertions read both files and check ports, depends_on and the health check", () => {
    const run = stepsOf()[indexes(STATIC)[0]].run;
    assert.match(run, /docker compose config --format json/);
    assert.match(
      run,
      /POSTGRES_PASSWORD="?\$\{?[A-Z_]+\}?"? docker compose -f docker-compose\.prod\.yml config --format json/,
    );
    assert.match(run, /\bports\b/);
    assert.match(run, /service_healthy/);
    assert.match(run, /interval/);
    assert.match(run, /\/api\/v1\/health/);
    assert.match(run, /redis\|worker/);
  });

  test("every up waits with a timeout, and nothing in compose is allowed to fail silently", () => {
    for (const pattern of [LITE_UP, PROD_UP]) assert.equal(indexes(pattern).length, 1);
    for (const step of stepsOf()) {
      assert.equal("continue-on-error" in step, false, JSON.stringify(step));
    }
  });
});

describe("C11: semgrep", () => {
  const image = () => job("semgrep").container?.image ?? job("semgrep").container;

  test("uses the official image at a pinned tag, not latest", () => {
    assert.match(String(image()), /^semgrep\/semgrep:\d+\.\d+\.\d+$/);
  });

  test("runs the rule tests before the scan, and the scan uses the single rule file", () => {
    const test = requireStep("semgrep", /^semgrep --test \.semgrep\/\s*$/m);
    const scan = requireStep("semgrep", /semgrep scan --error\b/);
    assert.ok(test < scan);
    const run = job("semgrep").steps[scan].run;
    assert.match(run, /--config \.semgrep\/label-suite\.yml\b/);
    assert.doesNotMatch(run, /--config \.semgrep\/(\s|$)/);
    assert.match(run, /backend\/ frontend\/ e2e\//);
  });

  // T4, T6 and #562: the test-boundary check is its own step after the rule
  // tests, and the project-rule scan above is left as it was.
  test("checks the tests for self-mocks in one step after the rule tests, apart from the project scan", () => {
    const steps = job("semgrep").steps;
    const boundary = steps
      .map((step, index) => ({ step, index }))
      .filter(
        ({ step }) =>
          typeof step.run === "string" &&
          /--config \.semgrep\/test-boundaries\.yml\b/.test(step.run),
      );
    assert.equal(
      boundary.length,
      1,
      "semgrep must have exactly one step loading test-boundaries.yml",
    );
    const { step, index } = boundary[0];
    assert.match(step.run, /semgrep scan --error\b/);
    assert.match(step.run, /--x-ignore-semgrepignore-files\b/);
    assert.match(step.run, /\s--config \.semgrep\/test-boundaries\.yml backend\/\s*$/);
    assert.doesNotMatch(step.run, /label-suite\.yml/);
    assert.ok(
      requireStep("semgrep", /^semgrep --test \.semgrep\/\s*$/m) < index,
      "the rule tests must run first",
    );
    const scan = steps[requireStep("semgrep", /semgrep scan --error\b/)].run;
    assert.doesNotMatch(scan, /test-boundaries\.yml/);
  });
});

describe("dependency-audit", () => {
  test("runs pip-audit without --fail-on and pnpm audit for production dependencies at high", () => {
    const steps = job("dependency-audit").steps;
    const pip = steps[requireStep("dependency-audit", /\buv run pip-audit\b/)].run;
    assert.doesNotMatch(pip, /--fail-on/);
    const pnpm = steps[requireStep("dependency-audit", /\bpnpm audit\b/)].run;
    assert.match(pnpm, /--prod\b/);
    assert.match(pnpm, /--audit-level high\b/);
  });

  test("turns the automatic pnpm cache off, because the job never runs pnpm install and has no store to save", () => {
    const steps = job("dependency-audit").steps;
    assert.equal(stepIndex(steps, /\bpnpm install\b/), -1);
    for (const step of steps.filter((s) => String(s.uses).startsWith("actions/setup-node@"))) {
      assert.equal(step.with?.["package-manager-cache"], false);
    }
  });

  test("installs the backend environment before auditing it", () => {
    assert.ok(
      requireStep("dependency-audit", /\buv sync --locked\b/) <
        requireStep("dependency-audit", /\buv run pip-audit\b/),
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

describe("C2: the workflow reruns when a label is added or removed", () => {
  test("on.pull_request.types has the default types plus labeled and unlabeled", () => {
    const types = workflow.on.pull_request?.types;
    assert.ok(Array.isArray(types), "on.pull_request.types is missing");
    for (const type of ["opened", "synchronize", "reopened", "labeled", "unlabeled"]) {
      assert.ok(types.includes(type), `on.pull_request.types lacks ${type}`);
    }
  });
});

describe("C3: coverage", () => {
  const combine = /\bcoverage combine \.coverage\.sqlite \.coverage\.postgres\b/;

  test("needs exactly changes and the three test jobs", () => {
    assert.deepEqual([...job("coverage").needs].sort(), [
      "backend-postgres",
      "backend-sqlite",
      "changes",
      "frontend",
    ]);
  });

  test("checkout fetches the full history so the base branch can be read", () => {
    const checkout = job("coverage").steps.find(
      (step) => typeof step.uses === "string" && step.uses.startsWith("actions/checkout@"),
    );
    assert.ok(checkout, "coverage has no checkout step");
    assert.equal(checkout.with?.["fetch-depth"], 0);
  });

  test("the base baseline is read with git show from origin/<base_ref>", () => {
    const run =
      job("coverage").steps[
        requireStep("coverage", /git show "?origin\/\$\{?BASE_REF\}?"?:coverage-baseline\.json/)
      ];
    assert.match(JSON.stringify(run), /github\.base_ref/);
  });

  test("the three artifacts are downloaded before the data is combined", () => {
    const steps = job("coverage").steps;
    const downloaded = steps
      .filter(
        (step) =>
          typeof step.uses === "string" && step.uses.startsWith("actions/download-artifact@"),
      )
      .map((step) => step.with?.name);
    for (const name of [
      "coverage-backend-sqlite",
      "coverage-backend-postgres",
      "coverage-frontend",
    ]) {
      assert.ok(downloaded.includes(name), `coverage does not download ${name}`);
    }
    const lastDownload = Math.max(
      ...steps.map((step, i) =>
        String(step.uses).startsWith("actions/download-artifact@") ? i : -1,
      ),
    );
    assert.ok(requireStep("coverage", combine) > lastDownload);
  });

  test("the data is combined, and only then exported to JSON", () => {
    const combineIndex = requireStep("coverage", combine);
    const jsonIndex = requireStep("coverage", /\bcoverage json\b/);
    assert.ok(combineIndex < jsonIndex);
    assert.ok(jsonIndex < requireStep("coverage", /check-coverage\.mjs\b/));
  });

  test("combine and json run in backend/ where the recorded paths resolve", () => {
    const steps = job("coverage").steps;
    for (const pattern of [combine, /\bcoverage json\b/]) {
      const step = steps[requireStep("coverage", pattern)];
      const where =
        step["working-directory"] ?? job("coverage").defaults?.run?.["working-directory"];
      assert.equal(where, "backend", `${pattern} must run in backend/`);
    }
  });

  test("check-coverage gets both baselines and a suggested-out path", () => {
    const run = job("coverage").steps[requireStep("coverage", /check-coverage\.mjs\b/)].run;
    for (const option of [
      "--backend",
      "--frontend",
      "--baseline",
      "--base-baseline",
      "--suggested-out",
    ]) {
      assert.match(run, new RegExp(option), `check-coverage.mjs is called without ${option}`);
    }
  });

  test("--allow-lower appears only in a step conditioned on the coverage-baseline-lower label", () => {
    const offenders = [];
    let found = 0;
    for (const step of job("coverage").steps) {
      if (typeof step.run !== "string" || !step.run.includes("--allow-lower")) continue;
      found += 1;
      if (!/coverage-baseline-lower/.test(JSON.stringify({ if: step.if, env: step.env }))) {
        offenders.push(step.run);
      }
    }
    assert.ok(found > 0, "no step passes --allow-lower");
    assert.deepEqual(offenders, []);
  });

  test("--allow-lower appears in no other job", () => {
    for (const [name, other] of Object.entries(workflow.jobs)) {
      if (name === "coverage") continue;
      assert.doesNotMatch(JSON.stringify(other), /--allow-lower/, name);
    }
  });

  test("the suggested baseline is uploaded even when the comparison fails", () => {
    const upload = uploadSteps("coverage").find(
      (step) => step.with?.name === "coverage-baseline-suggested",
    );
    assert.ok(upload, "coverage does not upload coverage-baseline-suggested");
    assert.match(String(upload.if), /always\(\)/);
    const steps = job("coverage").steps;
    assert.ok(steps.indexOf(upload) > requireStep("coverage", /check-coverage\.mjs\b/));
  });

  test("the critical-path check reads the list and both reports after the JSON export", () => {
    // login-auth-guard task 9.1, design D10: authentication and authorization at 90% branches.
    const index = requireStep("coverage", /node scripts\/check-critical-coverage\.mjs\b/);
    const step = job("coverage").steps[index];
    for (const option of [
      /--list critical-coverage\.json\b/,
      /--backend backend\/coverage\.json\b/,
      /--frontend frontend\/coverage\/coverage-summary\.json\b/,
    ]) {
      assert.match(step.run, option);
    }
    assert.ok(requireStep("coverage", /\bcoverage json\b/) < index);
    assert.ok(requireStep("coverage", /check-coverage\.mjs\b/) < index);
    assert.equal("working-directory" in step, false, "it runs from the repository root");
    assert.equal("continue-on-error" in step, false);
    assert.equal("if" in step, false);
  });

  test("the job asks for no permission beyond the workflow's contents: read", () => {
    assert.equal("permissions" in job("coverage"), false);
    assert.deepEqual(workflow.permissions, { contents: "read" });
  });
});

describe("C9: scripts-tests", () => {
  const SCRIPT_TESTS = [
    "check-coverage",
    "check-critical-coverage",
    "check-junit-skips",
    "check-security-headers",
    "ci-changed-paths",
    "check",
    "dev",
    "ci-workflow",
  ];

  test("needs only changes, so a failed test job cannot hide it", () => {
    assert.deepEqual([].concat(job("scripts-tests").needs), ["changes"]);
    assert.deepEqual([].concat(job("scripts-tests-windows").needs), ["changes"]);
  });

  test("installs dependencies, then runs every script test and the workflow test with node --test", () => {
    const install = requireStep("scripts-tests", /\bpnpm install --frozen-lockfile\b/);
    const run = requireStep("scripts-tests", /\bnode --test\b/);
    assert.ok(install < run);
    const text = job("scripts-tests").steps[run].run;
    for (const name of SCRIPT_TESTS) {
      assert.match(text, new RegExp(`scripts/tests/${name}\\.test\\.mjs`), `${name} is not run`);
    }
  });
});

describe("C9: scripts-tests-windows", () => {
  test("is a separate, non-matrix job on windows-latest so the required scripts-tests name is untouched", () => {
    const windows = job("scripts-tests-windows");
    assert.equal(windows.name, "scripts-tests-windows");
    assert.equal(windows["runs-on"], "windows-latest");
    assert.equal("strategy" in job("scripts-tests"), false);
    assert.equal(job("scripts-tests")["runs-on"], "ubuntu-latest");
  });

  test("runs the same node --test command as scripts-tests, under bash", () => {
    const windows = job("scripts-tests-windows");
    assert.equal(windows.defaults?.run?.shell, "bash");
    const a = job("scripts-tests").steps[requireStep("scripts-tests", /\bnode --test\b/)].run;
    const b = windows.steps[requireStep("scripts-tests-windows", /\bnode --test\b/)].run;
    assert.equal(b, a);
  });
});
