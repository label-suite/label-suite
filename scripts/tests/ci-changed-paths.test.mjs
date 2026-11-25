// Regression tests for scripts/ci-changed-paths.mjs. Run: node --test scripts/tests/*.test.mjs
//
// The `changes` job decides whether `compose` runs (system-design D13, design
// D15). When the base commit cannot be used the answer must be "changed": an
// extra compose run is cheap, a skipped one hides a broken image.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";

import { touchesCompose } from "../ci-changed-paths.mjs";

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

describe("CLI", () => {
  let repo;
  let base;
  let docsHead;
  let backendHead;

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
  });

  after(() => rmSync(repo, { recursive: true, force: true }));

  /** Run the script in the temp repo; return its result and what it wrote to $GITHUB_OUTPUT. */
  function run(args, { githubOutput = true } = {}) {
    const outFile = join(repo, "..", `${repo.split("/").pop()}-output.txt`);
    writeFileSync(outFile, "previous=1\n");
    const env = { ...process.env };
    delete env.GITHUB_OUTPUT;
    if (githubOutput) env.GITHUB_OUTPUT = outFile;
    const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: repo, encoding: "utf8", env });
    const written = readFileSync(outFile, "utf8");
    rmSync(outFile);
    return { ...r, written };
  }

  test("a range that only touches docs/ writes compose=false to $GITHUB_OUTPUT", () => {
    const r = run(["--base", base, "--head", docsHead]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.written, "previous=1\ncompose=false\n");
  });

  test("a range that touches backend/ writes compose=true", () => {
    const r = run(["--base", docsHead, "--head", backendHead]);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.written, "previous=1\ncompose=true\n");
  });

  test("without $GITHUB_OUTPUT the result goes to stdout", () => {
    const r = run(["--base", base, "--head", docsHead], { githubOutput: false });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^compose=false$/m);
    assert.equal(r.written, "previous=1\n");
  });

  for (const [label, value, reason] of [
    ["empty", "", /base commit is empty/],
    ["all zeros", "0000000000000000000000000000000000000000", /base commit is all zeros/],
    ["not in the repository", "1234567890abcdef1234567890abcdef12345678", /cannot diff/],
  ]) {
    test(`a base that is ${label} answers true and says why`, () => {
      const r = run(["--base", value, "--head", backendHead]);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.written, "previous=1\ncompose=true\n");
      assert.match(r.stdout, reason);
      assert.match(r.stdout, /running compose/);
    });
  }

  test("a missing --head is a usage error", () => {
    const r = run(["--base", base]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /usage/i);
  });
});
