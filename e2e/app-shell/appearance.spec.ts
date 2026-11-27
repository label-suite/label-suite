/**
 * The appearance preference end to end (spec appearance-mode; sidebar-nav
 * design D7, D15). Real backend and Vite dev server. The operating system's
 * scheme comes from page.emulateMedia. "No flash of light" is observed from
 * before the document is parsed: an init script records every value
 * <html data-theme> takes, and its value in the first animation frame, which
 * is the frame before the first paint.
 */
import type { Page } from "@playwright/test";

import { createAccount, type TestAccount } from "../shared/accounts.ts";
import { expect, test } from "../shared/fixtures/index.ts";

declare global {
  interface Window {
    /** Every value <html data-theme> took after a change, in order. */
    themeLog?: (string | null)[];
    /** <html data-theme> in the first animation frame. */
    themeFirstFrame?: string | null;
  }
}

const LOGIN_PATH = "/account/login";
const LANDING_PATH = "/dashboard/dashboard";
const THEME_KEY = "label-suite-theme";

/** Matches a path on the base URL with no query string. */
function pathIs(pathname: string): RegExp {
  return new RegExp(`^[^?#]*${pathname.replaceAll("/", "\\/")}$`);
}

async function signIn(page: Page, account: TestAccount): Promise<void> {
  await page.goto(LOGIN_PATH);
  await page.getByLabel("電子郵件").fill(account.email);
  await page.getByLabel("密碼", { exact: true }).fill(account.passphrase);
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL(pathIs(LANDING_PATH));
  await expect(page.getByRole("navigation", { name: "主導覽" })).toBeVisible();
}

/** From now on, every document of the page records its data-theme from the start. */
async function recordTheme(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // <html> may not exist yet when this runs, so watch the document for it.
    const read = () => document.documentElement.getAttribute("data-theme");
    const log: (string | null)[] = [];
    window.themeLog = log;
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.target === document.documentElement) {
          log.push(read());
        }
      }
    }).observe(document, { attributes: true, attributeFilter: ["data-theme"], subtree: true });
    requestAnimationFrame(() => {
      window.themeFirstFrame = read();
    });
  });
}

/** What the recorder saw in the current document. */
async function themeRecord(
  page: Page,
): Promise<{ log: (string | null)[]; firstFrame: string | null }> {
  await expect.poll(() => page.evaluate(() => window.themeFirstFrame !== undefined)).toBe(true);
  return page.evaluate(() => ({
    log: window.themeLog ?? [],
    firstFrame: window.themeFirstFrame ?? null,
  }));
}

/** Stores `value` as this browser's appearance preference. */
async function storeTheme(page: Page, value: string): Promise<void> {
  await page.evaluate(
    ([key, stored]) => {
      window.localStorage.setItem(key, stored);
    },
    [THEME_KEY, value] as const,
  );
}

function html(page: Page) {
  return page.locator("html");
}

test("重新整理後外觀保持", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signIn(page, createAccount());

  await page.getByRole("banner").getByRole("button", { name: "切換為深色模式" }).click();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await page.reload();

  await expect(page.getByRole("navigation", { name: "主導覽" })).toBeVisible();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
});

test("外觀設定值無效", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await signIn(page, createAccount());

  for (const value of ["sepia", "", "DARK"]) {
    await storeTheme(page, value);
    await page.goto(LANDING_PATH);
    await expect(page.getByRole("region", { name: "你已登入" })).toBeVisible();
    await expect(html(page), `stored ${JSON.stringify(value)}`).toHaveAttribute(
      "data-theme",
      "dark",
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
});

test("從來沒設定過外觀", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signIn(page, createAccount());

  expect(await page.evaluate((key) => window.localStorage.getItem(key), THEME_KEY)).toBeNull();
  await expect(html(page)).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("跟隨系統依作業系統呈現", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await signIn(page, createAccount());
  await storeTheme(page, "system");
  await page.goto(LANDING_PATH);
  await expect(page.getByRole("region", { name: "你已登入" })).toBeVisible();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");

  await page.emulateMedia({ colorScheme: "light" });

  await expect(html(page)).toHaveAttribute("data-theme", "light");
});

test("重新整理時不閃淺色", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signIn(page, createAccount());
  await storeTheme(page, "dark");
  await recordTheme(page);

  await page.reload();
  await expect(page.getByRole("navigation", { name: "主導覽" })).toBeVisible();

  const record = await themeRecord(page);
  expect(record.firstFrame).toBe("dark");
  expect(record.log.length).toBeGreaterThan(0);
  expect(record.log.every((value) => value === "dark")).toBe(true);
});

test("登出後登入頁沿用外觀", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await recordTheme(page);
  await signIn(page, createAccount());
  await page.getByRole("banner").getByRole("button", { name: "切換為深色模式" }).click();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await page.evaluate(() => {
    window.themeLog?.splice(0);
  });

  await page.getByRole("banner").getByRole("button", { name: "登出" }).click();

  await expect(page).toHaveURL(pathIs(LOGIN_PATH));
  await expect(page.getByRole("region", { name: "登入" })).toBeVisible();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  const afterSignOut = await themeRecord(page);
  expect(afterSignOut.log.every((value) => value === "dark")).toBe(true);

  // Opening the sign-in page afresh after signing out stays dark from the start too.
  await page.reload();
  await expect(page.getByRole("region", { name: "登入" })).toBeVisible();
  const reloaded = await themeRecord(page);
  expect(reloaded.firstFrame).toBe("dark");
  expect(reloaded.log.every((value) => value === "dark")).toBe(true);
});

test("登入頁沿用已儲存的外觀", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(LOGIN_PATH);
  await storeTheme(page, "dark");
  await recordTheme(page);

  await page.goto(LOGIN_PATH);

  await expect(page.getByRole("region", { name: "登入" })).toBeVisible();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  const record = await themeRecord(page);
  expect(record.firstFrame).toBe("dark");
  expect(record.log.length).toBeGreaterThan(0);
  expect(record.log.every((value) => value === "dark")).toBe(true);
});
