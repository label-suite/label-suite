/**
 * The only place that reads E2E_BASE_URL, E2E_API_URL and E2E_TARGET and holds
 * their local defaults (testing-agent-rules T8; system-design D8, D8a; #568
 * system-design D5).
 *
 * Two ways to run:
 *
 * - Default (E2E_TARGET unset or any other value): Playwright starts the
 *   backend and the Vite dev server itself and runs every spec except
 *   public-entry/**, which only holds on a build served through nginx.
 * - E2E_TARGET=compose: targets an already running public entry point, such as
 *   `E2E_TARGET=compose E2E_BASE_URL=http://localhost:8080 pnpm --filter e2e test`
 *   against either Compose tier. No web server is started, E2E_API_URL is not
 *   read, only public-entry/**\/*.spec.ts runs, and E2E_BASE_URL is required:
 *   unset or empty fails here instead of falling back to the dev server.
 *
 * In the default mode:
 *
 * - The browser context is fixed to zh-TW: `locale` sets both
 *   `navigator.language` and the Accept-Language header (D8a point 1).
 * - Specs navigate with relative paths against `baseURL` (D8a point 2).
 * - The backend's allowed origin is derived from E2E_BASE_URL and the
 *   frontend's API base URL from E2E_API_URL, both passed explicitly through
 *   `webServer.env`; the root `.env` is never read (D8a point 3).
 * - The backend runs background work in its own process
 *   (CELERY_TASK_ALWAYS_EAGER=true), so no Redis or worker is needed; compose
 *   mode starts no backend and passes no such value (email-celery-worker D12).
 * - The backend runs on a SQLite file under the Playwright output directory,
 *   which Playwright clears before it starts the web servers, so every run
 *   migrates a fresh database.
 * - A `setup` project runs first and creates the Seeder admin with the
 *   initialisation command; the chromium project depends on it (login-auth-guard
 *   design D11). In compose mode there is no setup: no journey signs in there.
 */
import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

import { BACKEND_DIR, OUTPUT_DIR, SQLITE_PATH } from "./shared/run-paths.ts";

const DEFAULT_BASE_URL = "http://localhost:5173";
const DEFAULT_API_URL = "http://localhost:8000";

const isCI = Boolean(process.env.CI);

/**
 * Reads an http(s) URL from the environment, falling back when unset or empty.
 *
 * @param name The environment variable to read.
 * @param fallback The local default; when omitted the variable is required.
 * @returns The parsed URL.
 * @throws Error naming the variable when it is required but unset or empty, or
 *   when the value is not an http(s) URL.
 */
function readUrl(name: string, fallback?: string): URL {
  const raw = process.env[name];
  let value: string;
  if (raw !== undefined && raw !== "") {
    value = raw;
  } else if (fallback !== undefined) {
    value = fallback;
  } else {
    throw new Error(
      `${name} must be set to the public entry point (for example the Compose tier's URL) when E2E_TARGET=compose.`,
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute http:// or https:// URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must be an absolute http:// or https:// URL.`);
  }
  return url;
}

/** Returns the URL's port, or the scheme's default port when none is given. */
function portOf(url: URL): string {
  if (url.port !== "") {
    return url.port;
  }
  return url.protocol === "https:" ? "443" : "80";
}

/** Whether to target a running public entry point instead of dev servers. */
const targetsCompose = process.env.E2E_TARGET === "compose";

/** Settings shared by both ways to run. */
const shared = {
  testDir: ".",
  outputDir: OUTPUT_DIR,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
} satisfies PlaywrightTestConfig;

/** The browser options shared by both ways to run, for a given base URL. */
function useFor(baseUrl: URL): PlaywrightTestConfig["use"] {
  return {
    baseURL: baseUrl.origin,
    locale: "zh-TW",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  };
}

/**
 * E2E_TARGET=compose: the public entry point is already up, so nothing is
 * started and only the journeys that need nginx in front run.
 */
function composeConfig(): PlaywrightTestConfig {
  const baseUrl = readUrl("E2E_BASE_URL");
  return {
    ...shared,
    testMatch: "public-entry/**/*.spec.ts",
    testIgnore: ["shared/**", "node_modules/**"],
    use: useFor(baseUrl),
  };
}

/** The default: start the backend and the Vite dev server, skip public-entry/. */
function devServerConfig(): PlaywrightTestConfig {
  const baseUrl = readUrl("E2E_BASE_URL", DEFAULT_BASE_URL);
  const apiUrl = readUrl("E2E_API_URL", DEFAULT_API_URL);
  return {
    ...shared,
    testMatch: "**/*.spec.ts",
    testIgnore: ["shared/**", "node_modules/**", "public-entry/**"],
    use: useFor(baseUrl),
    projects: [
      { name: "setup", testMatch: "**/*.setup.ts" },
      { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    ],
    webServer: [
      {
        name: "backend",
        cwd: BACKEND_DIR,
        command: `uv run alembic upgrade head && uv run uvicorn app.main:create_app --factory --host ${apiUrl.hostname} --port ${portOf(apiUrl)}`,
        url: `${apiUrl.origin}/api/v1/health`,
        env: {
          CORS_ALLOWED_ORIGINS: baseUrl.origin,
          SQLITE_PATH,
          // Background work runs in the backend process: no Redis, no worker.
          // Fixed here, never read from the root .env (e2e-testing spec).
          CELERY_TASK_ALWAYS_EAGER: "true",
        },
        reuseExistingServer: !isCI,
        timeout: 120_000,
        gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      },
      {
        name: "frontend",
        command: `pnpm --filter frontend dev --host ${baseUrl.hostname} --port ${portOf(baseUrl)}`,
        url: baseUrl.origin,
        env: {
          VITE_API_BASE_URL: apiUrl.origin,
        },
        reuseExistingServer: !isCI,
        timeout: 120_000,
        gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
      },
    ],
  };
}

// Built before defineConfig, so a missing E2E_BASE_URL in compose mode fails
// before any test is collected or any server is started.
const config = targetsCompose ? composeConfig() : devServerConfig();

export default defineConfig(config);
