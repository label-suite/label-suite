/**
 * The sign-in journeys (spec e2e-testing 「登入到落點再登出的旅程」; spec
 * account-login 「登入頁在三種螢幕寬度都能完整操作」). They sign in as the
 * Seeder admin the setup project created for this run; no journey talks to
 * Google, and this deployment configures neither Google nor a mail service,
 * so neither the Google button nor the register row is on the page.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../shared/fixtures/index.ts";
import { readSeederAccount } from "../shared/seeder-account.ts";

const LOGIN_PATH = "/account/login";
const LANDING_PATH = "/dashboard/dashboard";

/** Fills both fields on the sign-in page and presses 登入. */
async function signIn(page: Page, email: string, secret: string): Promise<void> {
  await page.getByLabel("電子郵件").fill(email);
  await page.getByLabel("密碼", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "登入", exact: true }).click();
}

/** Matches a path on the base URL with no query string. */
function pathIs(pathname: string): RegExp {
  return new RegExp(`^[^?#]*${pathname.replaceAll("/", "\\/")}$`);
}

test("signs in, reaches the landing page and signs out", async ({ page }) => {
  const account = readSeederAccount();

  await page.goto("/");
  await expect(page).toHaveURL(pathIs(LOGIN_PATH));

  await signIn(page, account.email, account.passphrase);
  await expect(page).toHaveURL(pathIs(LANDING_PATH));
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "儀表板", exact: true })).toBeVisible();
  // The Seeder admin is a system administrator: the platform layout's block A.
  const stats = main.getByRole("region", { name: "平台使用者統計" });
  await expect(stats).toBeVisible();

  // A signed-in person never sees the sign-in page.
  await page.goto(LOGIN_PATH);
  await expect(page).toHaveURL(pathIs(LANDING_PATH));
  await expect(stats).toBeVisible();

  // Signing out is the sidebar's job; the page itself has no button for it.
  await expect(main.getByRole("button", { name: "登出" })).toHaveCount(0);
  await page.getByRole("banner").getByRole("button", { name: "登出" }).click();
  await expect(page).toHaveURL(pathIs(LOGIN_PATH));
  await expect(page.getByRole("region", { name: "登入" })).toBeVisible();

  // Signed out: the landing page sends the visitor back.
  await page.goto(LANDING_PATH);
  await expect(page).toHaveURL(pathIs(LOGIN_PATH));
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("stays on the sign-in page after a wrong password", async ({ page }) => {
  const account = readSeederAccount();
  await page.goto(LOGIN_PATH);

  await signIn(page, account.email, `${account.passphrase}-wrong`);

  await expect(page.getByRole("alert")).toHaveText("帳號或密碼錯誤，請再試一次");
  await expect(page).toHaveURL(pathIs(LOGIN_PATH));
  await expect(page.getByLabel("電子郵件")).toHaveValue(account.email);
});

/** The three widths of spec account-login, with the spec's window sizes. */
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "phone", width: 375, height: 667 },
] as const;

/** The header's controls. */
function headerControls(page: Page): Locator[] {
  return [
    page.getByRole("link", { name: "Label Suite 首頁" }),
    page.getByRole("button", { name: /^ZH/ }),
  ];
}

/** The card's controls and texts in this deployment. */
function cardContents(card: Locator): Locator[] {
  return [
    card.getByRole("heading", { level: 1 }),
    card.getByText("登入你的帳號"),
    card.getByLabel("電子郵件"),
    card.getByRole("link", { name: "忘記密碼？" }),
    card.getByLabel("密碼", { exact: true }),
    card.getByRole("button", { name: "顯示密碼" }),
    card.getByRole("button", { name: "登入", exact: true }),
  ];
}

/** The box of `locator`, failing with `what` when it has none. */
async function boxOf(locator: Locator, what: string) {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(`${what} has no box`);
  }
  return box;
}

for (const viewport of VIEWPORTS) {
  test(`the sign-in page works at ${viewport.name} width (${String(viewport.width)}×${String(viewport.height)})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(LOGIN_PATH);
    const card = page.getByRole("region", { name: "登入" });
    await expect(card).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "no horizontal scrolling").toBeLessThanOrEqual(0);

    const cardBox = await boxOf(card, "The sign-in card");
    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width);

    for (const control of headerControls(page)) {
      await expect(control).toBeInViewport();
      // A trial click checks that it is visible, enabled and not covered, without clicking.
      await control.click({ trial: true });
    }
    for (const item of cardContents(card)) {
      // Scrolls the item into view first: on a phone the card is taller than the window.
      await item.scrollIntoViewIfNeeded();
      await expect(item).toBeInViewport();
      const box = await boxOf(item, "A card item");
      expect(box.x).toBeGreaterThanOrEqual(cardBox.x);
      expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
    }
    for (const control of cardContents(card).slice(2)) {
      await control.click({ trial: true });
    }
  });
}
