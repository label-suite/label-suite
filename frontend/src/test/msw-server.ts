/**
 * The MSW server shared by every test (design D11, clarification Q6).
 *
 * The defaults are Orval's generated handlers, which match `*\/api/v1/health`
 * from any origin and answer with faker data. They are only a floor that
 * proves a request was intercepted: tests add the fixed fixtures from
 * envelope-fixtures.ts with `server.use()`, which MSW matches first.
 */
import { setupServer } from "msw/node";

import { getLabelSuiteAPIMock } from "@/api/generated/label-suite.msw";

export const server = setupServer(...getLabelSuiteAPIMock());
