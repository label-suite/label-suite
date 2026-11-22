/**
 * The only place that reads E2E_BASE_URL and E2E_API_URL and holds their
 * local defaults (testing-agent-rules T8; system-design D8, D8a).
 *
 * - The browser context is fixed to zh-TW: `locale` sets both
 *   `navigator.language` and the Accept-Language header (D8a point 1).
 * - Specs navigate with relative paths against `baseURL` (D8a point 2).
 * - The backend's allowed origin is derived from E2E_BASE_URL and the
 *   frontend's API base URL from E2E_API_URL, both passed explicitly through
 *   `webServer.env`; the root `.env` is never read (D8a point 3).
 * - The backend runs on a SQLite file under the Playwright output directory,
 *   which Playwright clears before it starts the web servers, so every run
 *   migrates a fresh database.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const DEFAULT_BASE_URL = "http://localhost:5173";
const DEFAULT_API_URL = "http://localhost:8000";

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(CONFIG_DIR, "test-results");
const SQLITE_PATH = path.join(OUTPUT_DIR, "backend", "label_suite.db");

const isCI = Boolean(process.env.CI);

/**
 * Reads an http(s) URL from the environment, falling back when unset or empty.
 *
 * @param name The environment variable to read.
 * @param fallback The local default.
 * @returns The parsed URL.
 * @throws Error naming the variable when the value is not an http(s) URL.
 */
function readUrl(name: string, fallback: string): URL {
  const raw = process.env[name];
  const value = raw === undefined || raw === "" ? fallback : raw;
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

const baseUrl = readUrl("E2E_BASE_URL", DEFAULT_BASE_URL);
const apiUrl = readUrl("E2E_API_URL", DEFAULT_API_URL);

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  testIgnore: ["shared/**", "node_modules/**"],
  outputDir: OUTPUT_DIR,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: baseUrl.origin,
    locale: "zh-TW",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      name: "backend",
      cwd: path.join(CONFIG_DIR, "..", "backend"),
      command: `uv run alembic upgrade head && uv run uvicorn app.main:create_app --factory --host ${apiUrl.hostname} --port ${portOf(apiUrl)}`,
      url: `${apiUrl.origin}/api/v1/health`,
      env: {
        CORS_ALLOWED_ORIGINS: baseUrl.origin,
        SQLITE_PATH,
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
});
