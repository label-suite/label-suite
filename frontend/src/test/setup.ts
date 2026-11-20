/**
 * Vitest setup (design D7, D11): jest-dom matchers, the MSW server lifecycle,
 * and the i18n instance with only the `common` namespace in zh-TW. Feature and
 * page namespaces are registered by their own entry modules when a test
 * imports them, the same way as at runtime.
 */
import "@testing-library/jest-dom/vitest";

import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

import { i18n, initI18n } from "@/lib/i18n";

import { server } from "./msw-server";

initI18n("zh-TW");

beforeAll(() => {
  // MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`; same "error" behaviour.
  server.listen({ onUnhandledFrame: "error" });
});

beforeEach(async () => {
  await i18n.changeLanguage("zh-TW");
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
