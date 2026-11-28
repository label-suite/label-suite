// Static checks over the e2e package (spec e2e-testing; design D7): run by
// `pnpm --filter e2e test:static` before any browser starts.
//
// The samples below build host names and ports from pieces on purpose: this
// file is itself scanned by the "no host or port outside the config" check.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CONFIG_FILE,
  findFixedWaits,
  findFixtureDataFiles,
  findHostsAndPorts,
  findMisplacedSpecs,
  listE2eFiles,
  readE2eFiles,
} from "./e2e-static-checks.mjs";

const E2E_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const LOCAL_HOST = ["local", "host"].join("");
const LOOPBACK = ["127", "0", "0", "1"].join(".");
const PORT = [":", "51", "73"].join("");

describe("findHostsAndPorts", () => {
  it("flags a host name, a loopback address and a port outside the config file", () => {
    const found = findHostsAndPorts([
      { path: "a/b.spec.ts", content: `await page.goto("http://${LOCAL_HOST}/x");` },
      { path: "a/c.spec.ts", content: `const api = "http://${LOOPBACK}/api";` },
      { path: "shared/fixtures/index.ts", content: `const origin = "http://example.test${PORT}";` },
    ]);
    assert.deepEqual(
      found.map((hit) => hit.path),
      ["a/b.spec.ts", "a/c.spec.ts", "shared/fixtures/index.ts"],
    );
  });

  it("ignores the config file, the one place allowed to hold defaults", () => {
    const found = findHostsAndPorts([
      { path: CONFIG_FILE, content: `const base = "http://${LOCAL_HOST}${PORT}";` },
    ]);
    assert.deepEqual(found, []);
  });

  it("accepts a relative path", () => {
    assert.deepEqual(
      findHostsAndPorts([{ path: "a/b.spec.ts", content: 'await page.goto("/dev/health");' }]),
      [],
    );
  });
});

describe("findFixedWaits", () => {
  it("flags waitForTimeout, setTimeout and sleep in a spec file", () => {
    const found = findFixedWaits([
      { path: "a/b.spec.ts", content: "await page.waitForTimeout(3000);" },
      { path: "a/c.spec.ts", content: "await new Promise((r) => setTimeout(r, 500));" },
      { path: "a/d.spec.ts", content: "await sleep(1);" },
    ]);
    assert.deepEqual(
      found.map((hit) => hit.path),
      ["a/b.spec.ts", "a/c.spec.ts", "a/d.spec.ts"],
    );
  });

  it("accepts a conditional wait", () => {
    const found = findFixedWaits([
      { path: "a/b.spec.ts", content: "await expect(page.getByText('ok')).toBeVisible();" },
    ]);
    assert.deepEqual(found, []);
  });
});

describe("findFixtureDataFiles", () => {
  it("flags any non-TypeScript file under shared/fixtures/", () => {
    assert.deepEqual(
      findFixtureDataFiles([
        "shared/fixtures/index.ts",
        "shared/fixtures/answers.json",
        "shared/fixtures/rows.csv",
        "shared/fixtures/items.jsonl",
        "shared/fixtures/notes.txt",
      ]),
      [
        "shared/fixtures/answers.json",
        "shared/fixtures/rows.csv",
        "shared/fixtures/items.jsonl",
        "shared/fixtures/notes.txt",
      ],
    );
  });
});

describe("findMisplacedSpecs", () => {
  it("accepts e2e/<module>/<page>.spec.ts only", () => {
    assert.deepEqual(
      findMisplacedSpecs([
        "system-health/dev-health.spec.ts",
        "top-level.spec.ts",
        "account/login/form.spec.ts",
        "shared/fixtures/helper.spec.ts",
        "shared/sample.spec.ts",
      ]),
      [
        "top-level.spec.ts",
        "account/login/form.spec.ts",
        "shared/fixtures/helper.spec.ts",
        "shared/sample.spec.ts",
      ],
    );
  });
});

describe("the e2e package as it is", () => {
  const files = listE2eFiles(E2E_ROOT);
  const contents = readE2eFiles(E2E_ROOT, files);

  it("has at least one spec, so the checks below are not vacuous", () => {
    assert.ok(files.some((file) => file.endsWith(".spec.ts")));
  });

  it("holds no host or port outside the config file", () => {
    assert.deepEqual(findHostsAndPorts(contents), []);
  });

  it("uses no fixed-time wait in any spec or shared file", () => {
    assert.deepEqual(findFixedWaits(contents), []);
  });

  it("keeps only TypeScript files under shared/fixtures/", () => {
    assert.deepEqual(findFixtureDataFiles(files), []);
  });

  it("places every spec at e2e/<module>/<page>.spec.ts", () => {
    assert.deepEqual(findMisplacedSpecs(files), []);
  });
});

/**
 * Resolves the Playwright config in a fresh Node process, so each call reads
 * its own environment (the config reads it once, at import time).
 *
 * @param {Record<string, string>} env Variables to set on top of the current environment.
 * @param {string[]} unset Variables to remove from the current environment.
 * @returns {{ webServer?: { name: string, env?: Record<string, string> }[] }}
 */
function resolveConfig(env, unset = []) {
  const childEnv = { ...process.env, ...env };
  for (const name of unset) {
    delete childEnv[name];
  }
  const script =
    'const m = await import("./playwright.config.ts"); console.log(JSON.stringify(m.default));';
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: E2E_ROOT,
    env: childEnv,
    encoding: "utf8",
  });
  return JSON.parse(out);
}

describe("the background-work setting in the resolved config", () => {
  const backendEnv = (/** @type {ReturnType<typeof resolveConfig>} */ config) =>
    config.webServer?.find((server) => server.name === "backend")?.env;

  it("starts the backend with eager background work", () => {
    const config = resolveConfig({}, ["E2E_TARGET", "CELERY_TASK_ALWAYS_EAGER"]);
    assert.equal(backendEnv(config)?.CELERY_TASK_ALWAYS_EAGER, "true");
  });

  it("does not let the surrounding environment override it", () => {
    const config = resolveConfig({ CELERY_TASK_ALWAYS_EAGER: "false" }, ["E2E_TARGET"]);
    assert.equal(backendEnv(config)?.CELERY_TASK_ALWAYS_EAGER, "true");
  });

  it("starts no server, so passes no eager value, when targeting compose", () => {
    const config = resolveConfig({
      E2E_TARGET: "compose",
      E2E_BASE_URL: "http://example.test",
    });
    assert.equal(config.webServer, undefined);
    assert.ok(!JSON.stringify(config).includes("CELERY_TASK_ALWAYS_EAGER"));
  });
});
