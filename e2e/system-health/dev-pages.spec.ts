/**
 * The two developer pages after login-auth-guard: spec frontend-routing
 * 「開發頁只在開發模式註冊且不經過守門」「每頁設定瀏覽器標題」 and frontend-i18n
 * 「開發頁沒有語言切換控制項但沿用記住的語言」 (login-auth-guard acceptance).
 * The production-build half is checked against a built bundle in acceptance.md.
 */
import { expect, test } from "../shared/fixtures/index.ts";

const PAGES = [
  { path: "/dev/health", zh: "系統健康檢查", en: "System health check" },
  { path: "/dev/gallery", zh: "元件展示", en: "Component gallery" },
] as const;

for (const devPage of PAGES) {
  test(`開發模式可直接開啟 ${devPage.path}，不經過守門，標題為「Label Suite — ${devPage.zh}」`, async ({
    page,
  }) => {
    let sessionChecks = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/v1/current-session") {
        sessionChecks += 1;
      }
    });
    await page.goto(devPage.path);
    await expect(page.getByRole("heading", { level: 1, name: devPage.zh })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(devPage.path);
    await expect(page).toHaveTitle(`Label Suite — ${devPage.zh}`);
    expect(sessionChecks, "the developer pages do not go through the guard").toBe(0);
  });

  test(`開發頁沒有語言切換控制項但沿用記住的語言 (${devPage.path})`, async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("labelsuite.lang", "en"));
    await page.goto(devPage.path);
    await expect(page.getByRole("heading", { level: 1, name: devPage.en })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("button", { name: /^(ZH|EN)\b|Switch language|切換語言/ }),
    ).toHaveCount(0);
  });
}
