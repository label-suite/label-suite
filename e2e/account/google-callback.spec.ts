/**
 * The Google callback page /account/google/callback: spec account-login
 * 「Google 驗證沒通過時安靜回到登入頁」 and the screen half of 「Google 登入被拒一律同
 * 一句」 and 「Google 登入只登入或連結既有帳號」 (login-auth-guard acceptance).
 *
 * No journey talks to Google. This run's backend has no Google settings, so the
 * completion endpoint's answer is stubbed with the exact codes of
 * api-contract.md; the backend side of every Google Scenario is covered by the
 * integration tests with a fake OIDC client and by the live API acceptance.
 */
import type { Page } from "@playwright/test";

import { createAccount } from "../shared/accounts.ts";
import { fulfillError, stubAuthOptions } from "../shared/api-stubs.ts";
import { expect, test } from "../shared/fixtures/index.ts";

const LOGIN_PATH = "/account/login";
const LANDING_PATH = "/dashboard/dashboard";
const CALLBACK = "/account/google/callback";
const COMPLETE = "/api/v1/google-sessions";
const REJECTED = "無法用這個 Google 帳號登入。需要帳號的話，請聯絡系統管理員邀請你。";

/** Matches a path on the base URL with no query string. */
function pathIs(pathname: string): RegExp {
  return new RegExp(`^[^?#]*${pathname.replaceAll("/", "\\/")}$`);
}

/** Counts completion requests that reached the route handler and were answered. */
async function answerCompletion(page: Page, status: number, code: string): Promise<() => number> {
  let answered = 0;
  page.on("requestfinished", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === COMPLETE) {
      answered += 1;
    }
  });
  await page.route(`**${COMPLETE}`, (route) => fulfillError(route, status, code));
  return () => answered;
}

test("Google 驗證沒通過回到登入頁", async ({ page }) => {
  const completions = await answerCompletion(page, 400, "ACCOUNT_GOOGLE_FLOW_INVALID");
  let posted = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === COMPLETE) {
      posted += 1;
    }
  });
  await page.goto(`${CALLBACK}?error=access_denied&state=s1`);
  await expect(page).toHaveURL(pathIs(LOGIN_PATH));
  await expect(page.getByRole("region", { name: "登入", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(posted).toBe(0);
  expect(completions()).toBe(0);
  await page.goBack().catch(() => null);
  expect(new URL(page.url()).pathname).not.toBe(CALLBACK);
});

test("同一組回調只送出一次 / state 不符時安靜回到登入頁", async ({ page }) => {
  const completions = await answerCompletion(page, 400, "ACCOUNT_GOOGLE_FLOW_INVALID");
  await page.goto(`${CALLBACK}?code=c1&state=s1`);
  await expect(page).toHaveURL(pathIs(LOGIN_PATH));
  await expect(page.getByRole("region", { name: "登入", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(completions()).toBe(1);
});

for (const mail of [false, true]) {
  test(`Google 帳號沒有對應的平台帳號 (mail service ${mail ? "set" : "not set"})`, async ({
    page,
  }) => {
    if (mail) {
      await stubAuthOptions(page, { selfRegistrationEnabled: true, googleEnabled: true });
    }
    const visited: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        visited.push(new URL(frame.url()).pathname);
      }
    });
    await answerCompletion(page, 401, "ACCOUNT_GOOGLE_REJECTED");
    await page.goto(`${CALLBACK}?code=c1&state=s1`);
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("alert")).toHaveText(REJECTED);
    expect(visited).not.toContain("/account/register");
    await expect(page.getByRole("alert")).not.toContainText("註冊");
  });
}

test("Google 登入成功後前往落點，沒有任何連結通知 (completion stubbed with a real session)", async ({
  page,
  playwright,
}) => {
  const account = createAccount();
  const options = page.waitForRequest("**/api/v1/auth-options");
  await page.goto(LOGIN_PATH);
  const apiOrigin = new URL((await options).url()).origin;

  // A real session, opened by a separate client: its Set-Cookie lines become the
  // stubbed completion's, as the backend's own 201 would carry them.
  const client = await playwright.request.newContext();
  const signedIn = await client.post(`${apiOrigin}/api/v1/sessions`, {
    data: { email: account.email, password: account.passphrase },
  });
  expect(signedIn.status()).toBe(201);
  const setCookie = signedIn
    .headersArray()
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value)
    .join("\n");
  const body = await signedIn.text();
  await client.dispose();

  let completions = 0;
  await page.route(`**${COMPLETE}`, async (route) => {
    completions += 1;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      headers: { Location: "/api/v1/current-session", "Set-Cookie": setCookie },
      body,
    });
  });
  await page.goto(`${CALLBACK}?code=c1&state=s1`);
  await expect(page).toHaveURL(pathIs(LANDING_PATH));
  await expect(page.getByText(`${account.name}（${account.email}）`)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText(/連結|link/i)).toHaveCount(0);
  expect(completions).toBeGreaterThanOrEqual(1);
  await page.goBack().catch(() => null);
  expect(new URL(page.url()).pathname).not.toBe(CALLBACK);
});
