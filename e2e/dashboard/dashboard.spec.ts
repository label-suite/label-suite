/**
 * The temporary landing page /dashboard/dashboard, drawn in the signed-in
 * shell: spec auth-guard 「暫時落點顯示目前登入者」, login-session 「從這一台登出」
 * (signing out from the sidebar),
 * frontend-i18n 「切換後的語言跨頁沿用」, and the browser-side checks of the
 * acceptance (requests, credentials, no token in the page). Real backend and
 * Vite dev server (login-auth-guard acceptance).
 */
import type { BrowserContext, Page, Request } from "@playwright/test";

import { createAccount, sessionsOf, type TestAccount } from "../shared/accounts.ts";
import { expect, test } from "../shared/fixtures/index.ts";

const LOGIN_PATH = "/account/login";
const LANDING_PATH = "/dashboard/dashboard";
const CURRENT = "/api/v1/current-session";

/** Matches a path on the base URL with no query string. */
function pathIs(pathname: string): RegExp {
  return new RegExp(`^[^?#]*${pathname.replaceAll("/", "\\/")}$`);
}

/** Signs in through the page in Chinese and waits for the landing page. */
async function signIn(page: Page, account: TestAccount): Promise<void> {
  await page.goto(LOGIN_PATH);
  await page.getByLabel("電子郵件").fill(account.email);
  await page.getByLabel("密碼", { exact: true }).fill(account.passphrase);
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL(pathIs(LANDING_PATH));
}

/** Asks the backend directly, with the context's cookies, for the current session. */
async function currentStatus(context: BrowserContext, apiOrigin: string): Promise<number> {
  const response = await context.request.get(`${apiOrigin}${CURRENT}`);
  return response.status();
}

test("平台成員看到自己的身分 / 落點的瀏覽器標題", async ({ page }) => {
  const account = createAccount({ name: "王小明" });
  await signIn(page, account);
  const card = page.getByRole("region", { name: "你已登入" });
  await expect(card.getByRole("heading", { level: 1 })).toHaveText("你已登入");
  await expect(card.getByText(`王小明（${account.email}）`)).toBeVisible();
  await expect(card.getByText("平台成員", { exact: true })).toBeVisible();
  await expect(card.getByText("儀表板還在建置中，完成後登入會直接帶你過去。")).toBeVisible();
  await expect(card.getByRole("button", { name: "登出" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "主導覽" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("button", { name: "登出" })).toBeVisible();
  await expect(page).toHaveTitle("Label Suite — 你已登入");
});

test("系統管理員看到系統管理員", async ({ page }) => {
  await signIn(page, createAccount({ name: "管理員", role: "super_admin" }));
  await expect(page.getByText("系統管理員", { exact: true })).toBeVisible();
  await expect(page.getByText("平台成員", { exact: true })).toHaveCount(0);
});

test("切換後的語言跨頁沿用", async ({ page }) => {
  const account = createAccount();
  await page.goto(LOGIN_PATH);
  await page.getByRole("button", { name: /ZH/ }).click();
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.passphrase);
  const query = page.waitForRequest(
    (request) => request.method() === "GET" && new URL(request.url()).pathname === CURRENT,
  );
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(pathIs(LANDING_PATH));
  expect((await query).headers()["accept-language"]).toBe("en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("You're signed in");
  await expect(page.getByText("Platform Member", { exact: true })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page).toHaveTitle("Label Suite — Signed In");
});

test("從這一台登出只影響這一台 / 登出不影響其他裝置", async ({ browser, page }) => {
  const account = createAccount();
  const deviceB = await browser.newContext();
  const pageB = await deviceB.newPage();
  await signIn(pageB, account);
  await signIn(page, account);

  const csrfCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "__Host-ls_csrf",
  );
  expect(csrfCookie, "the CSRF cookie is set").toBeDefined();
  const signOut = page.waitForRequest((request) => request.method() === "DELETE");
  const signOutResponse = page.waitForResponse(
    (response) => response.request().method() === "DELETE",
  );
  const historyBefore = await page.evaluate(() => window.history.length);
  await page.getByRole("banner").getByRole("button", { name: "登出" }).click();
  const request = await signOut;
  const response = await signOutResponse;
  expect(new URL(request.url()).pathname).toBe(CURRENT);
  expect((await request.allHeaders())["x-csrf-token"]).toBe(csrfCookie?.value);
  expect(response.status()).toBe(204);
  expect((await response.body()).length).toBe(0);
  await expect(page).toHaveURL(pathIs(LOGIN_PATH));
  expect(await page.evaluate(() => window.history.length)).toBe(historyBefore);
  const names = (await page.context().cookies()).map((cookie) => cookie.name);
  expect(names.filter((name) => name.startsWith("__Host-ls_"))).toEqual([]);

  const apiOrigin = new URL(request.url()).origin;
  expect(await currentStatus(page.context(), apiOrigin)).toBe(401);
  expect(await currentStatus(deviceB, apiOrigin)).toBe(200);
  await pageB.reload();
  await expect(pageB.getByRole("heading", { name: "你已登入" })).toBeVisible();
  const rows = sessionsOf(account.email);
  expect(rows.filter((row) => row.loggedOutAt !== null)).toHaveLength(1);
  expect(rows.filter((row) => row.revokedAt === null)).toHaveLength(1);
  await deviceB.close();
});

test("登出失敗時畫面仍回到登入頁", async ({ page }) => {
  await signIn(page, createAccount());
  await page.route(`**${CURRENT}`, async (route) => {
    if (route.request().method() === "DELETE") {
      await route.abort("connectionrefused");
    } else {
      await route.continue();
    }
  });
  await page.getByRole("banner").getByRole("button", { name: "登出" }).click();
  await expect(page).toHaveURL(pathIs(LOGIN_PATH));
});

test("the browser holds no token, sends cookies with every API call, and gets no errors", async ({
  page,
}) => {
  const account = createAccount();
  const failures: string[] = [];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const sent: Request[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/")) {
      sent.push(request);
    }
  });
  page.on("requestfailed", (request) => {
    // Dev-mode StrictMode aborts the first copy of each mount query (design D6).
    if (request.failure()?.errorText !== "net::ERR_ABORTED") {
      failures.push(`${request.method()} ${request.url()}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    // Chrome logs every non-2xx response as a console error; the 401s of a
    // signed-out visitor's session check and refresh are the contract.
    if (message.type() === "error" && !/status of 401/.test(message.text())) {
      consoleErrors.push(message.text());
    }
  });

  await signIn(page, account);
  await page.getByRole("banner").getByRole("button", { name: "登出" }).click();
  await expect(page).toHaveURL(pathIs(LOGIN_PATH));
  await signIn(page, account);

  const storage = await page.evaluate(() => ({
    local: JSON.stringify({ ...window.localStorage }),
    session: JSON.stringify({ ...window.sessionStorage }),
    cookie: document.cookie,
  }));
  const cookies = await page.context().cookies();
  const byName = new Map(cookies.map((cookie) => [cookie.name, cookie]));
  for (const name of ["__Host-ls_at", "__Host-ls_rt"]) {
    const value = byName.get(name)?.value ?? "missing";
    expect(byName.get(name)?.httpOnly, `${name} is httpOnly`).toBe(true);
    expect(storage.cookie).not.toContain(name);
    expect(storage.local).not.toContain(value);
    expect(storage.session).not.toContain(value);
  }
  expect(byName.get("__Host-ls_csrf")?.httpOnly).toBe(false);
  expect(storage.local).not.toMatch(/token|jwt|eyJ/i);
  expect(storage.session).toBe("{}");

  const allowed = new Set([
    "GET /api/v1/current-session",
    "POST /api/v1/session-refreshes",
    "GET /api/v1/auth-options",
    "POST /api/v1/sessions",
    "DELETE /api/v1/current-session",
  ]);
  for (const request of sent) {
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    expect(allowed.has(key), `${key} is a contract call`).toBe(true);
    expect(url.search, `${key} has no query string`).toBe("");
    const headers = await request.allHeaders();
    expect(headers["accept-language"], key).toBe("zh-TW");
    expect(headers["x-correlation-id"], key).toBeUndefined();
    if (request.method() === "GET") {
      expect(headers["content-type"], key).toBeUndefined();
    }
  }
  // Every call after signing in carried the session cookie (credentials: include, cross-origin).
  const lastQuery = sent.filter((request) => request.method() === "GET").at(-1);
  expect(lastQuery, "a session query was sent").toBeDefined();
  expect((await lastQuery?.allHeaders())?.cookie ?? "").toContain("__Host-ls_at=");

  expect(failures).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
