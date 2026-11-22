/**
 * One journey: open the developer health page and see that the backend and
 * the database are up (spec e2e-testing 「健康檢查頁旅程」; system-design D8b).
 * Loading, error and unreachable states are covered by the frontend's
 * component and page tests, not here.
 */
import { expect, test } from "../shared/fixtures/index.ts";

/** The frontend's HEALTH_PATH route, relative to baseURL. */
const HEALTH_PATH = "/dev/health";

test("the health page shows that the backend and the database are up", async ({ page }) => {
  await page.goto(HEALTH_PATH);

  await expect(page.getByRole("heading", { level: 1, name: "系統健康檢查" })).toBeVisible();
  // Conditional wait for the result; the short-lived loading state is not asserted.
  await expect(page.getByText("後端與資料庫都可以用")).toBeVisible();

  // Terms and definitions pair up by position, so pinning the terms' order
  // pins which definition belongs to which label.
  await expect(page.getByRole("term")).toHaveText(["服務", "資料庫", "檢查時間", "traceId"]);
  const definitions = page.getByRole("definition");
  await expect(definitions).toHaveCount(4);
  await expect(definitions.nth(0)).toHaveText("ok");
  await expect(definitions.nth(1)).toHaveText("ok");
  // The check time and the traceId differ on every run: assert presence only.
  await expect(definitions.nth(2)).not.toBeEmpty();
  await expect(definitions.nth(3)).not.toBeEmpty();

  await expect(page.getByRole("alert")).toHaveCount(0);
});
