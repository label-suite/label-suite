/**
 * The Seeder account of one e2e run (login-auth-guard design D11). The setup
 * project writes it once; the journeys read it back. The password is random
 * per run and exists only in the Playwright output directory, never in
 * shared/fixtures/ or in the repository.
 */
import { readFileSync } from "node:fs";

import { SEEDER_CREDENTIALS_PATH } from "./run-paths.ts";

/** The account the initialisation command created for this run. */
export interface SeederAccount {
  /** The Seeder admin's Email, as typed on the sign-in page. */
  email: string;
  /** The display name passed to the command. */
  name: string;
  /** The random sign-in secret of this run. */
  passphrase: string;
}

/** True when `value` has the three string fields of a SeederAccount. */
function isSeederAccount(value: unknown): value is SeederAccount {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    "email" in value &&
    typeof value.email === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "passphrase" in value &&
    typeof value.passphrase === "string"
  );
}

/**
 * Reads the account the setup project created.
 *
 * @throws Error when the file is missing or malformed, which means the setup
 *   project did not run or failed.
 */
export function readSeederAccount(): SeederAccount {
  const parsed: unknown = JSON.parse(readFileSync(SEEDER_CREDENTIALS_PATH, "utf8"));
  if (!isSeederAccount(parsed)) {
    throw new Error(`${SEEDER_CREDENTIALS_PATH} does not hold a Seeder account; did setup run?`);
  }
  return parsed;
}
