/**
 * Page text arrives with the page (spec frontend-i18n, design D7). Kept in its
 * own file with a single test: Vitest isolates modules per file, so no other
 * test can have loaded features/system-health (and registered systemHealth)
 * before this one runs.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { i18n } from "@/lib/i18n";
import { healthOkHandler } from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";

import { App } from "./app";
import { createAppRouter, type AppRouter } from "./router";

let router: AppRouter | undefined;

afterEach(() => {
  router?.dispose();
  router = undefined;
  document.title = "";
  window.history.replaceState(null, "", "/");
});

it("has no systemHealth text until the lazy health route has loaded", async () => {
  expect(i18n.exists("pageName", { ns: "systemHealth" })).toBe(false);
  expect(i18n.hasResourceBundle("zh-TW", "systemHealth")).toBe(false);

  server.use(healthOkHandler());
  window.history.replaceState(null, "", "/dev/health");
  router = createAppRouter();
  render(<App router={router} />);

  expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("系統健康檢查");
  expect(i18n.exists("pageName", { ns: "systemHealth" })).toBe(true);
});
