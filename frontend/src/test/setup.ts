/**
 * Vitest setup (design D7, D11): jest-dom matchers, the MSW server lifecycle,
 * and the i18n instance with the `common` and `auth` namespaces in zh-TW. Feature and
 * page namespaces are registered by their own entry modules when a test
 * imports them, the same way as at runtime.
 */
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

import { i18n, initI18n } from "@/lib/i18n";

import { server } from "./msw-server";

/** True in the jsdom tests; the build/ tests run in Node without a DOM. */
const hasDom = typeof window !== "undefined";

/** Forgets the remembered language, so every test starts in zh-TW. */
function forgetLanguage(): void {
  if (hasDom) {
    window.localStorage.clear();
  }
}

forgetLanguage();
initI18n();

beforeAll(() => {
  // MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`; same "error" behaviour.
  server.listen({ onUnhandledFrame: "error" });
});

beforeEach(async () => {
  forgetLanguage();
  await i18n.changeLanguage("zh-TW");
  if (hasDom) {
    document.documentElement.lang = "zh-TW";
  }
});

afterEach(() => {
  // Vitest runs without globals, so Testing Library cannot register its own
  // automatic cleanup; unmount every rendered tree here instead.
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
