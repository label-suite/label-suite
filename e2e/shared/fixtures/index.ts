/**
 * The shared extension point of every e2e spec (testing-agent-rules T8;
 * system-design D8). Specs import `test` and `expect` from here, never from
 * `@playwright/test` directly, so that per-role `storageState` fixtures and
 * seed helpers can be added in one place later.
 *
 * Nothing here holds data: no answers, no test-set markers (Hard Rule 6).
 */
import { expect, test as base } from "@playwright/test";

/** Playwright's `test`, extended with this project's fixtures (none yet). */
export const test = base.extend({});

export { expect };
