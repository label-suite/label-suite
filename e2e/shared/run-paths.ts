/**
 * Where one e2e run keeps its files (login-auth-guard design D11). Shared by
 * playwright.config.ts and the Seeder setup, so the backend, the setup and
 * the journeys agree on one SQLite file and one credentials file.
 *
 * Everything lives under the Playwright output directory, which Playwright
 * clears before it starts the web servers: every run begins with a fresh
 * database and no credentials. The directory is not uploaded by CI (only
 * playwright-report is), and nothing here is under shared/fixtures/.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The e2e package directory. */
export const E2E_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** The backend package, where `uv run` finds the app. */
export const BACKEND_DIR = path.join(E2E_DIR, "..", "backend");

/** Playwright's output directory. */
export const OUTPUT_DIR = path.join(E2E_DIR, "test-results");

/** The backend's SQLite file for this run. */
export const SQLITE_PATH = path.join(OUTPUT_DIR, "backend", "label_suite.db");

/** The Seeder account created by the setup project, read by the journeys. */
export const SEEDER_CREDENTIALS_PATH = path.join(OUTPUT_DIR, "accounts", "seeder.json");
