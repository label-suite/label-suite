// Regression tests for scripts/check.mjs and the root package.json commands. Run: node --test scripts/tests/*.test.mjs
//
// Every command is replaced by a fake runner, so these tests check the order,
// the stop-at-first-failure rule and the steps that check.mjs implements itself
// (the probe check and the contract comparison) without running the real tools
// (spec workspace-commands, system-design §本機自查的步驟, design D10).
// The last describe block asserts that steps 11 and 12 run the same pytest and skip-check commands as ci.yml.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, test } from "node:test";

import { parse } from "yaml";

import { OPTIONAL_STEPS, parseArgs, runCheck, STEPS } from "../check.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const COPY = "docs/diagrams/architecture/api.openapi.json";
const PG_SKIP_MESSAGE = "PostgreSQL 那一輪已跳過：未設 TEST_DATABASE_URL";

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "check-mjs-"));
  write("backend/openapi.json", '{"openapi": "3.1.0"}\n');
  write(COPY, '{"openapi": "3.1.0"}\n');
  write("frontend/src/api/generated/label-suite.ts", "export const a = 1;\n");
  write("frontend/src/api/generated/label-suite.schemas.ts", "export type A = number;\n");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function write(path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}
const read = (path) => readFileSync(join(root, path), "utf8");

/**
 * A fake runner: records every call and answers with `results[command]` (default 0).
 * `effects[command]` runs first, to simulate what the command writes.
 */
function fakeRunner({ results = {}, effects = {} } = {}) {
  const calls = [];
  const runner = async (call) => {
    calls.push(call);
    effects[call.command]?.(call);
    return results[call.command] ?? 0;
  };
  return { runner, calls, commands: () => calls.map((call) => call.command) };
}

async function check({ flags = [], env = { PATH: process.env.PATH }, runner }) {
  const lines = [];
  const code = await runCheck({
    root,
    flags: parseArgs(flags),
    env,
    runner,
    out: { write: (t) => lines.push(t) },
  });
  return { code, output: lines.join("") };
}

describe("the step list", () => {
  test("is the twelve steps of system-design §本機自查的步驟, in order, with CI's commands", () => {
    assert.deepEqual(
      STEPS.map((step) => [step.id, step.cwd ?? ".", step.commands ?? []]),
      [
        ["probe", ".", []],
        ["format", ".", ["pnpm format:check"]],
        ["specs", ".", ["pnpm check:specs"]],
        ["frontend-lint", ".", ["pnpm --filter frontend lint"]],
        ["frontend-typecheck", ".", ["pnpm --filter frontend typecheck"]],
        ["frontend-test", ".", ["pnpm --filter frontend test:coverage"]],
        ["api-contract", ".", ["pnpm run api:sync"]],
        ["backend-lint", "backend", ["uv run ruff check .", "uv run ruff format --check ."]],
        ["backend-typecheck", "backend", ["uv run mypy --strict app"]],
        ["backend-imports", "backend", ["uv run lint-imports"]],
        [
          "backend-sqlite",
          "backend",
          [
            "uv run pytest --cov=app --cov-branch --junitxml=test-results/junit-sqlite.xml",
            "node ../scripts/check-junit-skips.mjs --summary test-results/junit-sqlite.xml",
          ],
        ],
        [
          "backend-postgres",
          "backend",
          [
            "uv run pytest --cov=app --cov-branch --junitxml=test-results/junit-postgres.xml",
            "node ../scripts/check-junit-skips.mjs test-results/junit-postgres.xml",
          ],
        ],
      ],
    );
  });

  test("no step compares or writes the coverage baseline", () => {
    const all = [...STEPS, ...Object.values(OPTIONAL_STEPS).flat()];
    const text = JSON.stringify(all);
    assert.equal(text.includes("check-coverage"), false);
    assert.equal(text.includes("coverage-baseline"), false);
  });
});

describe("runCheck", () => {
  test("all steps pass: each prints its name and result, exit 0", async () => {
    const fake = fakeRunner();
    const { code, output } = await check({ runner: fake.runner });
    assert.equal(code, 0, output);
    for (const step of STEPS) assert.ok(output.includes(`] ${step.name}\n`), step.name);
    assert.equal((output.match(/^PASS /gm) ?? []).length, 11);
    assert.match(output, /^SKIP .*PostgreSQL/m);
  });

  test("a lint failure stops the run: lint prints FAIL, exit non-zero, no backend step runs", async () => {
    const fake = fakeRunner({ results: { "pnpm --filter frontend lint": 1 } });
    const { code, output } = await check({ runner: fake.runner });
    assert.notEqual(code, 0);
    assert.match(output, /^FAIL Frontend lint/m);
    assert.equal(fake.commands().at(-1), "pnpm --filter frontend lint");
    assert.equal(
      fake.calls.some((call) => call.cwd === "backend"),
      false,
    );
  });

  test("e2e and Semgrep run only with --with-e2e and --with-semgrep, and print their results", async () => {
    const plain = fakeRunner();
    await check({ runner: plain.runner });
    assert.equal(
      plain.commands().some((c) => c.includes("e2e") || c.includes("semgrep")),
      false,
    );

    const flagged = fakeRunner();
    const { code, output } = await check({
      flags: ["--with-e2e", "--with-semgrep"],
      runner: flagged.runner,
    });
    assert.equal(code, 0, output);
    assert.deepEqual(flagged.commands().slice(-4), [
      "pnpm --filter e2e test:static",
      "pnpm --filter e2e test",
      "semgrep --test .semgrep/",
      "semgrep scan --error --config .semgrep/label-suite.yml backend/ frontend/ e2e/",
    ]);
    assert.match(output, /^PASS e2e/m);
    assert.match(output, /^PASS Semgrep/m);
  });

  test("an unknown flag is rejected", () => {
    assert.throws(() => parseArgs(["--with-everything"]), /unknown option --with-everything/);
  });
});

describe("the PostgreSQL round", () => {
  test("without TEST_DATABASE_URL it prints the skip message and the SQLite round prints the skipped count", async () => {
    const fake = fakeRunner();
    const { code, output } = await check({ runner: fake.runner });
    assert.equal(code, 0, output);
    assert.ok(output.includes(PG_SKIP_MESSAGE), output);
    assert.equal(
      fake.commands().some((c) => c.includes("junit-postgres")),
      false,
    );
    assert.ok(
      fake
        .commands()
        .includes("node ../scripts/check-junit-skips.mjs --summary test-results/junit-sqlite.xml"),
    );
  });

  test("with TEST_DATABASE_URL it runs; the SQLite round never sees the URL", async () => {
    const fake = fakeRunner();
    const url = "postgresql+asyncpg://u:p@localhost:5432/test";
    const { code, output } = await check({
      env: { PATH: process.env.PATH, TEST_DATABASE_URL: url },
      runner: fake.runner,
    });
    assert.equal(code, 0, output);
    assert.equal(output.includes(PG_SKIP_MESSAGE), false);
    const sqlite = fake.calls.find(
      (c) => c.command.includes("junit-sqlite.xml") && c.command.startsWith("uv"),
    );
    const postgres = fake.calls.find(
      (c) => c.command.includes("junit-postgres.xml") && c.command.startsWith("uv"),
    );
    assert.equal(sqlite.env.TEST_DATABASE_URL, undefined);
    assert.equal(sqlite.env.COVERAGE_FILE, ".coverage.sqlite");
    assert.equal(postgres.env.TEST_DATABASE_URL, url);
    assert.equal(postgres.env.COVERAGE_FILE, ".coverage.postgres");
  });

  test("a skipped test in the PostgreSQL round fails the run and names the test", async () => {
    // The pytest call is faked; the skip check really runs, on a report with one skipped test.
    const junit = readFileSync(join(ROOT, "scripts/tests/fixtures/junit/one-skip.xml"), "utf8");
    write(
      "scripts/check-junit-skips.mjs",
      readFileSync(join(ROOT, "scripts/check-junit-skips.mjs"), "utf8"),
    );
    const pytest =
      "uv run pytest --cov=app --cov-branch --junitxml=test-results/junit-postgres.xml";
    const skips = "node ../scripts/check-junit-skips.mjs test-results/junit-postgres.xml";
    const fake = fakeRunner({
      effects: { [pytest]: () => write("backend/test-results/junit-postgres.xml", junit) },
    });
    let stderr = "";
    const runner = async (call) => {
      if (call.command !== skips) return fake.runner(call);
      const r = spawnSync(process.execPath, call.command.split(" ").slice(1), {
        cwd: join(root, call.cwd),
        encoding: "utf8",
      });
      stderr = r.stderr;
      return r.status;
    };
    const { code } = await check({
      env: { PATH: process.env.PATH, TEST_DATABASE_URL: "postgresql://x" },
      runner,
    });
    assert.notEqual(code, 0);
    assert.match(stderr, /test_health_reports_postgres/);
  });
});

describe("the leftover probe check", () => {
  const PROBES = [
    "frontend/src/pages/dev-health/boundary-probe.tsx",
    "frontend/src/pages/boundary-probe.tsx",
    // Not named by the spec, but written by the same boundary test file and just as fatal to lint.
    "frontend/src/components/boundary-probe.tsx",
  ];
  for (const probe of PROBES) {
    test(`${probe} fails the run before lint, is explained, and is not deleted`, async () => {
      write(probe, "export const probe = 1;\n");
      const fake = fakeRunner();
      const { code, output } = await check({ runner: fake.runner });
      assert.notEqual(code, 0);
      assert.equal(fake.calls.length, 0, "no command may run, lint included");
      assert.ok(output.includes(probe), output);
      assert.match(output, /interrupted/);
      assert.match(output, /[Dd]elete it/);
      assert.equal(existsSync(join(root, probe)), true);
    });
  }

  test("the probe files are ignored by git, so git status does not list them", () => {
    for (const probe of PROBES) {
      const r = spawnSync("git", ["check-ignore", "-q", probe], { cwd: ROOT });
      assert.equal(r.status, 0, `${probe} is not ignored`);
    }
  });
});

describe("the contract step compares with the working tree before the run", () => {
  const SYNC = "pnpm run api:sync";
  const regenerate = (files) => () => {
    rmSync(join(root, "frontend/src/api/generated"), { recursive: true, force: true });
    for (const [path, text] of Object.entries(files)) write(path, text);
  };
  const git = (...args) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@example.com",
        "-c",
        "core.hooksPath=/dev/null",
        ...args,
      ],
      {
        cwd: root,
        encoding: "utf8",
      },
    );

  test("artifacts just synced but not committed pass", async () => {
    git("init", "-q");
    git("add", ".");
    git("commit", "-q", "-m", "old contract");
    // api:sync ran earlier and was not committed: the working tree differs from HEAD.
    write("backend/openapi.json", '{"openapi": "3.1.0", "info": "new"}\n');
    write("frontend/src/api/generated/label-suite.ts", "export const a = 2;\n");
    const fake = fakeRunner({
      effects: {
        [SYNC]: regenerate({
          "backend/openapi.json": '{"openapi": "3.1.0", "info": "new"}\n',
          "frontend/src/api/generated/label-suite.ts": "export const a = 2;\n",
          "frontend/src/api/generated/label-suite.schemas.ts": "export type A = number;\n",
        }),
      },
    });
    const { code, output } = await check({ runner: fake.runner });
    assert.equal(code, 0, output);
    assert.match(output, /^PASS Contract/m);
  });

  test("a hand-edited artifact fails, is listed, and holds the regenerated content afterwards", async () => {
    write("frontend/src/api/generated/label-suite.ts", "export const a = 1; // edited by hand\n");
    const fake = fakeRunner({
      effects: {
        [SYNC]: regenerate({
          "backend/openapi.json": '{"openapi": "3.1.0"}\n',
          "frontend/src/api/generated/label-suite.ts": "export const a = 1;\n",
          "frontend/src/api/generated/label-suite.schemas.ts": "export type A = number;\n",
        }),
      },
    });
    const { code, output } = await check({ runner: fake.runner });
    assert.notEqual(code, 0);
    assert.match(output, /^FAIL Contract/m);
    assert.match(output, /modified: frontend\/src\/api\/generated\/label-suite\.ts/);
    assert.equal(read("frontend/src/api/generated/label-suite.ts"), "export const a = 1;\n");
    assert.equal(
      fake.calls.some((call) => call.cwd === "backend"),
      false,
      "the run stops at the contract step",
    );
  });

  test("added and removed artifacts and a stale openapi.json are listed too", async () => {
    const fake = fakeRunner({
      effects: {
        [SYNC]: regenerate({
          "backend/openapi.json": '{"openapi": "3.1.0", "paths": {}}\n',
          "frontend/src/api/generated/label-suite.ts": "export const a = 1;\n",
          "frontend/src/api/generated/label-suite.msw.ts": "export const handlers = [];\n",
        }),
      },
    });
    const { code, output } = await check({ runner: fake.runner });
    assert.notEqual(code, 0);
    assert.match(output, /modified: backend\/openapi\.json/);
    assert.match(output, /added: frontend\/src\/api\/generated\/label-suite\.msw\.ts/);
    assert.match(output, /removed: frontend\/src\/api\/generated\/label-suite\.schemas\.ts/);
  });

  test("a hand-edited docs copy fails, is listed, and holds the regenerated content afterwards", async () => {
    write(COPY, '{"openapi": "3.1.0", "info": "edited by hand"}\n');
    const fake = fakeRunner({
      effects: {
        [SYNC]: () => {
          write(COPY, '{"openapi": "3.1.0"}\n');
        },
      },
    });
    const { code, output } = await check({ runner: fake.runner });
    assert.notEqual(code, 0);
    assert.match(output, /^FAIL Contract/m);
    assert.match(output, /modified: docs\/diagrams\/architecture\/api\.openapi\.json/);
    assert.equal(read(COPY), '{"openapi": "3.1.0"}\n');
  });

  test("a deleted docs copy fails and is listed as added after the regeneration", async () => {
    rmSync(join(root, COPY));
    const fake = fakeRunner({
      effects: {
        [SYNC]: () => {
          write(COPY, '{"openapi": "3.1.0"}\n');
        },
      },
    });
    const { code, output } = await check({ runner: fake.runner });
    assert.notEqual(code, 0);
    assert.match(output, /added: docs\/diagrams\/architecture\/api\.openapi\.json/);
  });

  test("a failing api:sync fails the step", async () => {
    const fake = fakeRunner({ results: { [SYNC]: 1 } });
    const { code, output } = await check({ runner: fake.runner });
    assert.notEqual(code, 0);
    assert.match(output, /^FAIL Contract/m);
  });
});

describe("the coverage baseline is neither compared nor written locally", () => {
  test("a baseline above the local numbers does not fail the run and is not modified", async () => {
    const baseline =
      '{\n  "backend": { "percentCovered": 100 },\n  "frontend": { "statements": 100, "branches": 100 },\n  "tolerance": 0.1\n}\n';
    write("coverage-baseline.json", baseline);
    const { code, output } = await check({ runner: fakeRunner().runner });
    assert.equal(code, 0, output);
    assert.equal(read("coverage-baseline.json"), baseline);
  });

  test("a missing baseline is not created", async () => {
    const { code } = await check({ runner: fakeRunner().runner });
    assert.equal(code, 0);
    assert.equal(existsSync(join(root, "coverage-baseline.json")), false);
  });
});

describe("root package.json commands", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

  test("has bootstrap, dev, api:sync and check, and no setup", () => {
    for (const name of ["bootstrap", "dev", "api:sync", "check"])
      assert.ok(pkg.scripts[name], name);
    assert.equal(pkg.scripts.setup, undefined);
  });

  test("bootstrap enables the hooks first, then installs both sides from their lockfiles", () => {
    assert.equal(
      pkg.scripts.bootstrap,
      "scripts/setup.sh && pnpm install --frozen-lockfile && cd backend && uv sync --locked",
    );
  });

  test("api:sync regenerates the frontend only after the backend export succeeds", () => {
    assert.equal(
      pkg.scripts["api:sync"],
      "(cd backend && uv run python -m app.scripts.export_openapi) && pnpm --filter frontend api:generate",
    );
  });

  test("dev and check run the two scripts", () => {
    assert.equal(pkg.scripts.dev, "node scripts/dev.mjs");
    assert.equal(pkg.scripts.check, "node scripts/check.mjs");
  });

  test("backend/test-results/ is ignored by git", () => {
    const r = spawnSync("git", ["check-ignore", "-q", "backend/test-results/junit-sqlite.xml"], {
      cwd: ROOT,
    });
    assert.equal(r.status, 0);
  });
});

describe("steps 11 and 12 match ci.yml", () => {
  const workflow = parse(readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8"));

  /** The run commands and env of one CI job, with the `uv run ` prefix check.mjs adds stripped later. */
  function ciSteps(jobName) {
    const steps = workflow.jobs[jobName]?.steps ?? [];
    return steps.filter((step) => typeof step.run === "string");
  }

  /** One check.mjs step against the CI job that runs the same round. */
  function assertSameAsCi(stepId, jobName) {
    const local = STEPS.find((step) => step.id === stepId);
    assert.ok(local, `check.mjs has no step ${stepId}`);
    const ci = ciSteps(jobName);
    const [pytestCommand, skipCommand] = local.commands;

    // CI runs the pytest command in the same form, with `uv run` in front.
    assert.equal(pytestCommand.startsWith("uv run pytest "), true);
    const ciPytest = ci.find((step) => step.run.trim() === pytestCommand);
    assert.ok(ciPytest, `${jobName} has no step running exactly: ${pytestCommand}`);
    assert.equal(ciPytest.env?.COVERAGE_FILE, local.env.COVERAGE_FILE);

    // The skip check names the same script and the same report; CI may append
    // shell redirection (the job summary), so compare the leading command.
    const ciSkip = ci.find((step) => step.run.trim().startsWith(skipCommand));
    assert.ok(ciSkip, `${jobName} has no step running: ${skipCommand}`);
  }

  test("step 11 (SQLite) runs the same pytest and skip summary commands as backend-sqlite", () => {
    assertSameAsCi("backend-sqlite", "backend-sqlite");
  });

  test("step 12 (PostgreSQL) runs the same pytest and skip check commands as backend-postgres", () => {
    assertSameAsCi("backend-postgres", "backend-postgres");
  });

  test("the local pytest arguments for both rounds are identical apart from the report name", () => {
    const normalize = (id) =>
      STEPS.find((step) => step.id === id).commands[0].replace(
        /junit-(sqlite|postgres)/,
        "junit-X",
      );
    assert.equal(normalize("backend-sqlite"), normalize("backend-postgres"));
  });
});
