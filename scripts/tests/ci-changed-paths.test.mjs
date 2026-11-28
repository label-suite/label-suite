// Regression tests for scripts/ci-changed-paths.mjs. Run: node --test scripts/tests/*.test.mjs
//
// The `changes` job decides which path-conditioned jobs run (system-design D13,
// design D15, the path table approved on issue #823). When the base commit cannot
// be used, or a global trigger changed, every answer must be "changed": an extra
// run is cheap, a skipped one hides a broken job.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";

import { OUTPUTS, matchOutputs, touchesCompose, touchesGlobal } from "../ci-changed-paths.mjs";

const SCRIPT = fileURLToPath(new URL("../ci-changed-paths.mjs", import.meta.url));

describe("touchesCompose", () => {
  test("only docs/ changed: false", () => {
    assert.equal(touchesCompose(["docs/development/architecture.mdx", "docs/index.mdx"]), false);
  });

  test("docker-compose.yml changed: true", () => {
    assert.equal(touchesCompose(["docs/a.mdx", "docker-compose.yml"]), true);
  });

  test("docker-compose.prod.yml changed: true", () => {
    assert.equal(touchesCompose(["docker-compose.prod.yml"]), true);
  });

  test("a file under backend/ changed: true", () => {
    assert.equal(touchesCompose(["backend/app/main.py"]), true);
  });

  test("a file under frontend/ changed: true", () => {
    assert.equal(touchesCompose(["frontend/src/main.tsx"]), true);
  });

  test("a Dockerfile or .dockerignore at any path, and frontend/nginx.conf: true", () => {
    for (const path of [
      "Dockerfile",
      "worker/Dockerfile",
      ".dockerignore",
      "backend/.dockerignore",
      "frontend/nginx.conf",
    ]) {
      assert.equal(touchesCompose([path]), true, path);
    }
  });

  test("the header check, the e2e config and the public-entry and shared e2e files: true", () => {
    for (const path of [
      "scripts/check-security-headers.sh",
      "e2e/playwright.config.ts",
      "e2e/public-entry/shell.spec.ts",
      "e2e/public-entry/another.spec.ts",
      "e2e/shared/fixtures/index.ts",
    ]) {
      assert.equal(touchesCompose([path]), true, path);
    }
  });

  test("another e2e journey alone: false", () => {
    assert.equal(touchesCompose(["e2e/system-health/dev-health.spec.ts"]), false);
  });

  test("look-alike names do not match", () => {
    for (const path of [
      "backend-notes.md",
      "docs/Dockerfile.md",
      "docker-compose.yml.bak",
      "e2e/x.spec.ts",
      ".github/workflows/ci.yml",
    ]) {
      assert.equal(touchesCompose([path]), false, path);
    }
  });

  test("no changed files: false", () => {
    assert.equal(touchesCompose([]), false);
  });
});

describe("matchOutputs: one positive and one negative example per output", () => {
  // [output, a path that turns it on, a path that leaves it off]
  const CASES = [
    ["code", "backend/app/main.py", "e2e/system-health/dev-health.spec.ts"],
    ["code", "frontend/src/main.tsx", "design/prototype/assets/tokens.css"],
    ["frontend", "design/prototype/assets/tokens.css", "design/prototype/pages/login.html"],
    ["frontend", "frontend/src/main.tsx", "e2e/x.spec.ts"],
    ["e2e", "e2e/system-health/dev-health.spec.ts", "design/prototype/pages/login.html"],
    ["e2e", "design/prototype/assets/data-palette.css", "docs/index.mdx"],
    ["e2e", "backend/app/main.py", "docs/index.mdx"],
    ["api_contract", "frontend/src/api/client.ts", "frontend/src/pages/Login.tsx"],
    [
      "api_contract",
      "docs/diagrams/architecture/api.openapi.json",
      "docs/diagrams/architecture/x.mdx",
    ],
    ["api_contract", "backend/app/main.py", "e2e/x.spec.ts"],
    ["api_contract", "frontend/orval.config.ts", "frontend/vite.config.ts"],
    ["api_contract", "frontend/package.json", "frontend/tsconfig.json"],
    ["code", "scripts/check-coverage.mjs", "scripts/check-specs.mjs"],
    ["code", "scripts/check-critical-coverage.mjs", "scripts/tests/check-coverage.test.mjs"],
    ["code", "scripts/check-junit-skips.mjs", "scripts/dev.mjs"],
    ["docs_site", "docs/index.mdx", "backend/app/main.py"],
    ["docs_site", ".notecraft/components/x.tsx", "scripts/check-specs.mjs"],
    ["docs_site", "design/prototype/pages/login.html", "openspec/config.yaml"],
    ["scripts", "scripts/check-specs.mjs", "docs/index.mdx"],
    ["scripts", ".gitignore", ".gitattributes"],
    ["hooks", "docs/index.mdx", "design/prototype/pages/login.html"],
    ["hooks", "AGENTS.md", "README.md"],
    ["hooks", ".claude/settings.json", "openspec/config.yaml"],
    ["hooks", ".codex/hooks.json", ".notecraft/components/x.tsx"],
    ["hooks", ".semgrep/rules.yml", "CHANGELOG.md"],
    ["hooks", "e2e/x.spec.ts", "design/system/MASTER.md"],
    ["compose", "docker-compose.yml", "e2e/system-health/dev-health.spec.ts"],
  ];

  for (const [output, on, off] of CASES) {
    test(`${output}: ${on} turns it on, ${off} leaves it off`, () => {
      assert.equal(matchOutputs([on])[output], true, on);
      assert.equal(matchOutputs([off])[output], false, off);
    });
  }

  test("every output has at least one example", () => {
    for (const name of OUTPUTS) {
      assert.ok(
        CASES.some(([output]) => output === name),
        `${name} has no example`,
      );
    }
  });

  test("a docs-only change runs docs-site and hooks, and nothing in the code group", () => {
    const outputs = matchOutputs(["docs/development/architecture.mdx"]);
    assert.deepEqual(outputs, {
      code: false,
      frontend: false,
      e2e: false,
      api_contract: false,
      docs_site: true,
      scripts: false,
      hooks: true,
      compose: false,
    });
  });

  test("no changed files: every output is false", () => {
    for (const name of OUTPUTS) assert.equal(matchOutputs([])[name], false, name);
  });
});

describe("global triggers", () => {
  const GLOBAL = [
    ".github/workflows/ci.yml",
    ".github/PULL_REQUEST_TEMPLATE.md",
    "pnpm-lock.yaml",
    "backend/uv.lock",
    "package.json",
    "pnpm-workspace.yaml",
    "backend/pyproject.toml",
    ".prettierrc.json",
    ".prettierignore",
    ".lintstagedrc.mjs",
    "coverage-baseline.json",
    "critical-coverage.json",
    "scripts/ci-changed-paths.mjs",
  ];

  for (const path of GLOBAL) {
    test(`${path} turns every output on`, () => {
      assert.equal(touchesGlobal([path]), true);
      for (const name of OUTPUTS) assert.equal(matchOutputs([path])[name], true, name);
    });
  }

  test("look-alike names are not global triggers", () => {
    for (const path of [
      "frontend/package.json",
      "e2e/package.json",
      "docs/pnpm-lock.yaml.md",
      "github/workflows/ci.yml",
      "scripts/ci-changed-paths.test.mjs",
    ]) {
      assert.equal(touchesGlobal([path]), false, path);
    }
  });
});

describe("CLI", () => {
  let repo;
  let base;
  let docsHead;
  let backendHead;
  let lockHead;
  let renameHead;

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
        cwd: repo,
        encoding: "utf8",
      },
    ).trim();
  const commitFile = (path, text) => {
    mkdirSync(join(repo, dirname(path)), { recursive: true });
    writeFileSync(join(repo, path), text);
    git("add", path);
    git("commit", "-q", "-m", `change ${path}`);
    return git("rev-parse", "HEAD");
  };

  before(() => {
    repo = mkdtempSync(join(tmpdir(), "ci-changed-paths-"));
    git("init", "-q", "-b", "main");
    base = commitFile("README.md", "x\n");
    docsHead = commitFile("docs/a.mdx", "a\n");
    backendHead = commitFile("backend/app/main.py", "print()\n");
    lockHead = commitFile("pnpm-lock.yaml", "lockfileVersion: 9\n");
    git("mv", "backend/app/main.py", "docs/main.py");
    git("commit", "-q", "-m", "move main.py out of backend/");
    renameHead = git("rev-parse", "HEAD");
  });

  after(() => rmSync(repo, { recursive: true, force: true }));

  /** Run the script in the temp repo; return its result and what it wrote to $GITHUB_OUTPUT. */
  function run(args, { githubOutput = true } = {}) {
    const outFile = join(dirname(repo), `${basename(repo)}-output.txt`);
    writeFileSync(outFile, "previous=1\n");
    const env = { ...process.env };
    delete env.GITHUB_OUTPUT;
    if (githubOutput) env.GITHUB_OUTPUT = outFile;
    const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: repo, encoding: "utf8", env });
    const written = readFileSync(outFile, "utf8");
    rmSync(outFile);
    return { ...r, written };
  }

  /** The $GITHUB_OUTPUT lines for the outputs set to true; every other output is false. */
  const expected = (...on) =>
    "previous=1\n" + OUTPUTS.map((name) => `${name}=${on.includes(name)}\n`).join("");

  test("a range that only touches docs/ writes docs_site and hooks only to $GITHUB_OUTPUT", () => {
    const r = run(["--base", base, "--head", docsHead]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.written, expected("docs_site", "hooks"));
  });

  test("a range that touches backend/ writes the code group, api_contract, hooks and compose", () => {
    const r = run(["--base", docsHead, "--head", backendHead]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      r.written,
      expected("code", "frontend", "e2e", "api_contract", "hooks", "compose"),
    );
  });

  test("a range that touches a global trigger writes every output true and says why", () => {
    const r = run(["--base", backendHead, "--head", lockHead]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.written, expected(...OUTPUTS));
    assert.match(r.stdout, /global-trigger list/);
  });

  test("a file moved out of backend/ into docs/ still runs the code group", () => {
    const r = run(["--base", lockHead, "--head", renameHead]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.written, /^code=true$/m);
    assert.match(r.written, /^docs_site=true$/m);
  });

  test("without $GITHUB_OUTPUT the result goes to stdout", () => {
    const r = run(["--base", base, "--head", docsHead], { githubOutput: false });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^compose=false$/m);
    assert.match(r.stdout, /^docs_site=true$/m);
    assert.equal(r.written, "previous=1\n");
  });

  for (const [label, value, reason] of [
    ["empty", "", /base commit is empty/],
    ["all zeros", "0000000000000000000000000000000000000000", /base commit is all zeros/],
    ["not in the repository", "1234567890abcdef1234567890abcdef12345678", /cannot diff/],
  ]) {
    test(`a base that is ${label} answers true for every output and says why`, () => {
      const r = run(["--base", value, "--head", docsHead]);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.written, expected(...OUTPUTS));
      assert.match(r.stdout, reason);
      assert.match(r.stdout, /skipping none/);
    });
  }

  test("a missing --head is a usage error", () => {
    const r = run(["--base", base]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /usage/i);
  });
});
