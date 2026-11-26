/**
 * Accounts for the sign-in journeys beyond the Seeder admin (login-auth-guard
 * acceptance). Each journey creates its own account with a random Email, so
 * journeys stay independent when Playwright runs them in parallel.
 *
 * The rows are written by shared/account_db.py into this run's SQLite file,
 * through the backend's ORM and real argon2id hashing. Nothing here mints a
 * token or a cookie: every journey still signs in through the real page or
 * endpoint, so the authorisation path under test is the real one.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

import { BACKEND_DIR, E2E_DIR, SQLITE_PATH } from "./run-paths.ts";

/** The helper script, run with the backend's interpreter. */
const HELPER = path.join(E2E_DIR, "shared", "account_db.py");

/**
 * The helper's environment: this run's SQLite file, the backend on the import
 * path, and no DATABASE_URL, so an inherited server database is never touched.
 */
const HELPER_ENV: NodeJS.ProcessEnv = Object.fromEntries(
  Object.entries({ ...process.env, SQLITE_PATH, PYTHONPATH: BACKEND_DIR }).filter(
    ([name]) => name !== "DATABASE_URL",
  ),
);

/** An account a journey created, with the sign-in secret it was given. */
export interface TestAccount {
  /** The Email as stored and as typed on the sign-in page. */
  email: string;
  /** The display name. */
  name: string;
  /** The random sign-in secret, or an empty string when it has none. */
  passphrase: string;
}

/** Runs one helper command, feeding `input` on standard input. */
function runHelper(args: string[], input = ""): unknown {
  const output = execFileSync("uv", ["run", "python", HELPER, ...args], {
    cwd: BACKEND_DIR,
    env: HELPER_ENV,
    input,
    encoding: "utf8",
  });
  const lines = output.trim().split("\n");
  return JSON.parse(lines[lines.length - 1] ?? "null");
}

/** Options for a new account. */
export interface NewAccount {
  /** The display name; defaults to 王小明. */
  name?: string;
  /** The system role; defaults to user. */
  role?: "user" | "super_admin";
}

/**
 * Creates an active account with a local password and a random Email.
 *
 * @param options The name and role.
 * @returns The account, with its random sign-in secret.
 */
export function createAccount(options: NewAccount = {}): TestAccount {
  const tag = randomBytes(6).toString("hex");
  const account: TestAccount = {
    email: `member-${tag}@example.com`,
    name: options.name ?? "王小明",
    passphrase: `Aa1${randomBytes(12).toString("base64url")}`,
  };
  runHelper(
    ["add", "--email", account.email, "--name", account.name, "--role", options.role ?? "user"],
    `${account.passphrase}\n`,
  );
  return account;
}

/** Deactivates (false) or reactivates (true) an account. */
export function setActive(email: string, active: boolean): void {
  runHelper(["set", "--email", email, "--active", active ? "true" : "false"]);
}

/**
 * Moves every session of the account into the past.
 *
 * @param email The account.
 * @param startedDaysAgo Days since the sessions started.
 * @param seenDaysAgo Days since they were last refreshed.
 */
export function ageSessions(email: string, startedDaysAgo: number, seenDaysAgo: number): void {
  runHelper([
    "age",
    "--email",
    email,
    "--started-days-ago",
    String(startedDaysAgo),
    "--seen-days-ago",
    String(seenDaysAgo),
  ]);
}

/** One session row as the helper reports it. */
export interface SessionRow {
  /** When it started (ISO 8601). */
  startedAt: string;
  /** When it ended, or null while it is active. */
  revokedAt: string | null;
  /** When it was signed out of, or null. */
  loggedOutAt: string | null;
}

/** Lists the account's sessions, oldest first. */
export function sessionsOf(email: string): SessionRow[] {
  return runHelper(["sessions", "--email", email]) as SessionRow[];
}
