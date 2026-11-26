/**
 * Setup project: create the Seeder admin the login journeys sign in as
 * (login-auth-guard design D11; spec e2e-testing 「登入到落點再登出的旅程」).
 *
 * Runs after Playwright has started the backend, which migrated a fresh
 * SQLite file. It first confirms that the database holds no account: the
 * initialisation command refuses (exit code 2) when another Seeder exists, so
 * a reused database would fail here with a clear message instead. The Email
 * and the password are random per run, the password goes to the command on
 * standard input (never as an argument or an environment variable), and both
 * are written only to the Playwright output directory.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test as setup } from "../shared/fixtures/index.ts";
import { BACKEND_DIR, SEEDER_CREDENTIALS_PATH, SQLITE_PATH } from "../shared/run-paths.ts";
import type { SeederAccount } from "../shared/seeder-account.ts";

/**
 * The command's environment: this run's SQLite file. DATABASE_URL is left
 * out, so an inherited server database can never be the target.
 */
const COMMAND_ENV: NodeJS.ProcessEnv = Object.fromEntries(
  Object.entries({ ...process.env, SQLITE_PATH }).filter(([name]) => name !== "DATABASE_URL"),
);

/** Counts the rows of the users table in this run's SQLite file. */
function countAccounts(): number {
  const output = execFileSync(
    "uv",
    [
      "run",
      "python",
      "-c",
      "import sqlite3, sys; print(sqlite3.connect(sys.argv[1]).execute('SELECT COUNT(*) FROM users').fetchone()[0])",
      SQLITE_PATH,
    ],
    { cwd: BACKEND_DIR, env: COMMAND_ENV, encoding: "utf8" },
  );
  return Number.parseInt(output.trim(), 10);
}

/** A random account that meets the password policy (8+ characters, upper, lower, digit). */
function randomAccount(): SeederAccount {
  const tag = randomBytes(6).toString("hex");
  return {
    email: `seeder-${tag}@example.com`,
    name: "E2E Seeder",
    passphrase: `Aa1${randomBytes(18).toString("base64url")}`,
  };
}

setup("create the Seeder admin with the initialisation command", () => {
  expect(countAccounts(), `${SQLITE_PATH} must start with no account`).toBe(0);

  const account = randomAccount();
  // execFileSync throws, with the command's stderr, on any non-zero exit code.
  execFileSync(
    "uv",
    [
      "run",
      "python",
      "-m",
      "app.scripts.create_seeder",
      "--email",
      account.email,
      "--name",
      account.name,
      "--password-stdin",
    ],
    { cwd: BACKEND_DIR, env: COMMAND_ENV, input: `${account.passphrase}\n`, encoding: "utf8" },
  );
  expect(countAccounts(), "the command created exactly one account").toBe(1);

  mkdirSync(path.dirname(SEEDER_CREDENTIALS_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(SEEDER_CREDENTIALS_PATH, JSON.stringify(account), { mode: 0o600 });
});
