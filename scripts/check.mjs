#!/usr/bin/env node
// check.mjs — `pnpm run check`: the local self-check, in the fixed order of system-design §本機自查的步驟.
//
//   pnpm run check [--with-e2e] [--with-semgrep]
//
// Every step runs the same package script or command CI runs, with the same
// arguments, prints its name and result, and the first failure ends the run
// with a non-zero exit code. Two steps are implemented here rather than by a
// tool: the leftover boundary-probe check (design D10) and the contract step,
// which compares the regenerated artifacts with the working tree as it was
// before the run, not with HEAD, so artifacts synced but not yet committed pass.
// Coverage is only printed by the test commands; this script never compares it
// with the baseline nor reads or writes the baseline file (CI is the only source
// of those numbers, system-design D12). The PostgreSQL round runs only when
// TEST_DATABASE_URL is set, and says so when it is skipped.
import { spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The contract artifacts the contract step compares, relative to the repository root. */
const CONTRACT_PATHS = [
  "backend/openapi.json",
  "docs/diagrams/architecture/api.openapi.json",
  "frontend/src/api/generated",
];

/**
 * Where the frontend lint probe tests write their probe files: the layer-boundary
 * tests (frontend/build/eslint-config.test.ts) and the size and complexity tests
 * (frontend/build/size-limits-config.test.ts).
 */
const PROBE_NAME = "boundary-probe.tsx";
const PROBE_DIRS = ["frontend/src/pages"];
const PROBE_FILES = [
  "frontend/src/components/boundary-probe.tsx",
  "frontend/src/components/size-probe.tsx",
  "frontend/src/components/size-probe.test.tsx",
];

const PG_SKIP_MESSAGE = "PostgreSQL 那一輪已跳過：未設 TEST_DATABASE_URL";

/**
 * The twelve default steps, in order. A step either runs `commands` (one after
 * another in `cwd`, stopping at the first non-zero exit) or is a `kind`
 * implemented below. Steps 11 and 12 use CI's exact pytest arguments.
 */
export const STEPS = [
  { id: "probe", name: "Leftover boundary probe", kind: "probe" },
  { id: "format", name: "Format", commands: ["pnpm format:check"] },
  { id: "specs", name: "Specs", commands: ["pnpm check:specs"] },
  { id: "frontend-lint", name: "Frontend lint", commands: ["pnpm --filter frontend lint"] },
  {
    id: "frontend-typecheck",
    name: "Frontend typecheck",
    commands: ["pnpm --filter frontend typecheck"],
  },
  {
    id: "frontend-test",
    name: "Frontend tests with coverage",
    commands: ["pnpm --filter frontend test:coverage"],
  },
  {
    id: "api-contract",
    name: "Contract sync",
    kind: "api-contract",
    commands: ["pnpm run api:sync"],
  },
  {
    id: "backend-lint",
    name: "Backend lint and format",
    cwd: "backend",
    commands: ["uv run ruff check .", "uv run ruff format --check ."],
  },
  {
    id: "backend-typecheck",
    name: "Backend typecheck",
    cwd: "backend",
    commands: ["uv run mypy --strict app"],
  },
  {
    id: "backend-imports",
    name: "Backend import contracts",
    cwd: "backend",
    commands: ["uv run lint-imports"],
  },
  {
    id: "backend-sqlite",
    name: "Backend tests (SQLite)",
    cwd: "backend",
    env: { COVERAGE_FILE: ".coverage.sqlite" },
    // The SQLite round must not pick up a PostgreSQL URL from the developer's shell.
    unsetEnv: ["TEST_DATABASE_URL"],
    commands: [
      "uv run pytest --cov=app --cov-branch --junitxml=test-results/junit-sqlite.xml",
      "node ../scripts/check-junit-skips.mjs --summary test-results/junit-sqlite.xml",
    ],
  },
  {
    id: "backend-postgres",
    name: "Backend tests (PostgreSQL)",
    cwd: "backend",
    env: { COVERAGE_FILE: ".coverage.postgres" },
    requiresEnv: "TEST_DATABASE_URL",
    skipMessage: PG_SKIP_MESSAGE,
    commands: [
      "uv run pytest --cov=app --cov-branch --junitxml=test-results/junit-postgres.xml",
      "node ../scripts/check-junit-skips.mjs test-results/junit-postgres.xml",
    ],
  },
];

/** Steps appended only when their flag is given, in this order. */
export const OPTIONAL_STEPS = {
  "--with-e2e": [
    {
      id: "e2e",
      name: "e2e",
      commands: ["pnpm --filter e2e test:static", "pnpm --filter e2e test"],
    },
  ],
  "--with-semgrep": [
    {
      id: "semgrep",
      name: "Semgrep",
      commands: [
        "semgrep --test .semgrep/",
        "semgrep scan --error --config .semgrep/label-suite.yml backend/ frontend/ e2e/",
      ],
    },
    // T4, T6 (#562): integration tests and the harness files must not mock this
    // project's own modules; the same command as the semgrep job in ci.yml.
    {
      id: "semgrep-test-boundaries",
      name: "Semgrep test boundaries",
      commands: [
        "semgrep scan --error --x-ignore-semgrepignore-files --config .semgrep/test-boundaries.yml backend/",
      ],
    },
  ],
};

/** Parse the CLI flags; throw on anything else. */
export function parseArgs(argv) {
  const flags = new Set();
  for (const arg of argv) {
    if (!(arg in OPTIONAL_STEPS)) throw new Error(`unknown option ${arg}`);
    flags.add(arg);
  }
  return flags;
}

/** Run one shell command in the repository with inherited output; resolve to its exit code. */
export function shellRunner(root) {
  return ({ command, cwd, env }) =>
    new Promise((resolve) => {
      const child = spawn(command, { cwd: join(root, cwd), env, shell: true, stdio: "inherit" });
      child.on("error", () => resolve(127));
      child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    });
}

/** Every file under a path (a file or a directory), as root-relative paths. */
function listFiles(base, path) {
  const absolute = join(base, path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [path];
  return readdirSync(absolute, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(base, join(entry.parentPath, entry.name)))
    .sort();
}

function contractFiles(base) {
  return CONTRACT_PATHS.flatMap((path) => listFiles(base, path));
}

/** Find leftover probe files; return root-relative paths. */
function findProbes(root) {
  const found = PROBE_FILES.filter((path) => existsSync(join(root, path)));
  for (const dir of PROBE_DIRS) {
    found.push(...listFiles(root, dir).filter((path) => path.endsWith(`/${PROBE_NAME}`)));
  }
  return found.sort();
}

async function runCommands(step, { root, env, runner }) {
  const stepEnv = { ...env, ...step.env };
  for (const name of step.unsetEnv ?? []) delete stepEnv[name];
  for (const command of step.commands) {
    const code = await runner({ command, cwd: step.cwd ?? ".", env: stepEnv, root });
    if (code !== 0) return { ok: false, detail: `\`${command}\` exited with code ${code}` };
  }
  return { ok: true };
}

/** Execute one step; resolve to { ok, skipped?, detail? }. */
async function executeStep(step, context) {
  const { root, env, say } = context;

  if (step.kind === "probe") {
    const probes = findProbes(root);
    for (const probe of probes) {
      say(
        `Found ${probe}: a file left behind by an interrupted frontend lint probe test ` +
          `(frontend/build/eslint-config.test.ts or size-limits-config.test.ts). ` +
          `Delete it and run check again.`,
      );
    }
    return probes.length === 0
      ? { ok: true }
      : { ok: false, detail: `${probes.length} leftover probe file(s)` };
  }

  if (step.requiresEnv && !env[step.requiresEnv]) {
    say(step.skipMessage);
    return { ok: true, skipped: true, detail: step.skipMessage };
  }

  if (step.kind === "api-contract") {
    const snapshot = mkdtempSync(join(tmpdir(), "label-suite-check-"));
    try {
      for (const path of CONTRACT_PATHS) {
        if (existsSync(join(root, path)))
          cpSync(join(root, path), join(snapshot, path), { recursive: true });
      }
      const result = await runCommands(step, context);
      if (!result.ok) return result;

      const before = new Set(contractFiles(snapshot));
      const after = new Set(contractFiles(root));
      const differences = [];
      for (const path of [...new Set([...before, ...after])].sort()) {
        if (!after.has(path)) differences.push(`removed: ${path}`);
        else if (!before.has(path)) differences.push(`added: ${path}`);
        else if (!readFileSync(join(snapshot, path)).equals(readFileSync(join(root, path)))) {
          differences.push(`modified: ${path}`);
        }
      }
      if (differences.length === 0) return { ok: true };
      say("The contract artifacts in the working tree differ from the regenerated ones.");
      say("The regenerated files are now in the working tree; review and commit them:");
      for (const line of differences) say(`  ${line}`);
      return { ok: false, detail: `${differences.length} contract file(s) out of sync` };
    } finally {
      rmSync(snapshot, { recursive: true, force: true });
    }
  }

  return runCommands(step, context);
}

/**
 * Run the self-check.
 *
 * @param {object} options
 * @param {string} options.root repository root
 * @param {Set<string>} options.flags parsed flags
 * @param {Record<string, string | undefined>} options.env environment for the commands
 * @param {(call: {command: string, cwd: string, env: object, root: string}) => Promise<number>} options.runner
 * @param {{write(text: string): void}} options.out
 * @returns {Promise<number>} exit code
 */
export async function runCheck({ root, flags, env, runner, out }) {
  const say = (text) => out.write(`${text}\n`);
  const steps = [...STEPS];
  for (const [flag, extra] of Object.entries(OPTIONAL_STEPS))
    if (flags.has(flag)) steps.push(...extra);

  for (const [index, step] of steps.entries()) {
    say(`\n==> [${index + 1}/${steps.length}] ${step.name}`);
    const started = Date.now();
    const result = await executeStep(step, { root, env, runner, say });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (result.skipped) {
      say(`SKIP ${step.name}: ${result.detail}`);
    } else if (result.ok) {
      say(`PASS ${step.name} (${seconds}s)`);
    } else {
      say(`FAIL ${step.name} (${seconds}s): ${result.detail}`);
      say(`\ncheck: stopped at step ${index + 1}/${steps.length} (${step.name})`);
      return 1;
    }
  }
  say(`\ncheck: all ${steps.length} steps done`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let flags;
  try {
    flags = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `check: ${error.message}\nusage: pnpm run check [--with-e2e] [--with-semgrep]\n`,
    );
    process.exit(2);
  }
  process.exitCode = await runCheck({
    root: ROOT,
    flags,
    env: process.env,
    runner: shellRunner(ROOT),
    out: process.stdout,
  });
}
