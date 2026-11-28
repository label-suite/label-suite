/**
 * The page guard and the passive sign-out Scenarios of spec auth-guard,
 * login-session and frontend-routing, against the real backend and the Vite
 * dev server (login-auth-guard acceptance).
 *
 * Expired and invalid sessions are produced for real: the journey signs in,
 * then shared/account_db.py ages the session or deactivates the account, and
 * the backend itself answers 401 AUTH_REQUIRED and then 401
 * ACCOUNT_SESSION_EXPIRED or ACCOUNT_SESSION_INVALID. Only the faults a
 * healthy run cannot produce (a 503, a dropped connection, a refresh
 * conflict) replace a response with page.route.
 *
 * Counts are of finished requests: dev-mode StrictMode aborts the first copy
 * of each mount query, and an aborted request is not a request sent (design
 * D6). Stubs choose a response by refresh phase, never by request order: the
 * aborted first copy may reach a stub before the live one.
 */
import type { Page, Request } from "@playwright/test";

import { ageSessions, createAccount, setActive, type TestAccount } from "../shared/accounts.ts";
import { fulfillError, gate } from "../shared/api-stubs.ts";
import { expect, test } from "../shared/fixtures/index.ts";

const LOGIN_PATH = "/account/login";
const LANDING_PATH = "/dashboard/dashboard";
const CURRENT = "/api/v1/current-session";
const REFRESH = "/api/v1/session-refreshes";

/** Matches a path on the base URL with no query string. */
function pathIs(pathname: string): RegExp {
  return new RegExp(`^[^?#]*${pathname.replaceAll("/", "\\/")}$`);
}

/** Counts finished requests to `path` with `method` from now on. */
function countFinished(page: Page, method: string, path: string): () => number {
  let count = 0;
  page.on("requestfinished", (request: Request) => {
    if (request.method() === method && new URL(request.url()).pathname === path) {
      count += 1;
    }
  });
  return () => count;
}

/** Signs in through the page and waits for the landing page. */
async function signIn(page: Page, account: TestAccount): Promise<void> {
  await page.goto(LOGIN_PATH);
  await page.getByLabel("電子郵件").fill(account.email);
  await page.getByLabel("密碼", { exact: true }).fill(account.passphrase);
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL(pathIs(LANDING_PATH));
  await expect(page.getByRole("button", { name: "登出" })).toBeVisible();
}

/** True when going back does not return to `path`. */
async function backDoesNotReturnTo(page: Page, path: string): Promise<void> {
  await page.goBack().catch(() => null);
  expect(new URL(page.url()).pathname).not.toBe(path);
}

test.describe("signed-out visitors", () => {
  test("未登入開啟落點被帶回登入頁", async ({ page }) => {
    await page.goto(LANDING_PATH);
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("region", { name: "登入", exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await backDoesNotReturnTo(page, LANDING_PATH);
  });

  test("登入後一律去落點", async ({ page }) => {
    const account = createAccount();
    await page.goto(LANDING_PATH);
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await page.getByLabel("電子郵件").fill(account.email);
    await page.getByLabel("密碼", { exact: true }).fill(account.passphrase);
    await page.getByRole("button", { name: "登入", exact: true }).click();
    await expect(page).toHaveURL(pathIs(LANDING_PATH));
  });

  test("未登入開啟根路徑 / 開發模式下根路徑依登入狀態導向", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("系統健康檢查")).toHaveCount(0);
  });

  test("不存在的路徑依登入狀態導向", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("alert")).toHaveCount(0);
    await backDoesNotReturnTo(page, "/no-such-page");
  });

  test("沒有登入狀態時回到登入頁不顯示橫幅 (real 401 AUTH_REQUIRED twice)", async ({ page }) => {
    const refreshes: number[] = [];
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === REFRESH) {
        refreshes.push(response.status());
      }
    });
    await page.goto(LANDING_PATH);
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("region", { name: "登入", exact: true })).toBeVisible();
    expect(refreshes).toContain(401);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("判定中不顯示內容", async ({ page }) => {
    const account = createAccount();
    await signIn(page, account);
    const held = gate();
    await page.route(`**${CURRENT}`, async (route) => {
      await held.opened;
      await route.continue();
    });
    await page.goto(LANDING_PATH);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "儀表板", exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole("region", { name: "登入", exact: true })).toHaveCount(0);
    await expect(page.getByText(account.email)).toHaveCount(0);
    await expect(page.getByText(account.name)).toHaveCount(0);
    held.open();
    await expect(
      page.getByRole("heading", { level: 1, name: "儀表板", exact: true }),
    ).toBeVisible();
  });
});

test.describe("signed-in visitors", () => {
  test("已登入的人開登入頁直接進儀表板 / 兩種路由共用同一次查詢", async ({ page }) => {
    const account = createAccount();
    await signIn(page, account);
    const queries = countFinished(page, "GET", CURRENT);
    await page.goto(LOGIN_PATH);
    await expect(page).toHaveURL(pathIs(LANDING_PATH));
    await expect(
      page.getByRole("heading", { level: 1, name: "儀表板", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "登入", exact: true })).toHaveCount(0);
    expect(queries()).toBe(1);
    await backDoesNotReturnTo(page, LOGIN_PATH);
  });

  test("已登入開啟根路徑", async ({ page }) => {
    await signIn(page, createAccount());
    await page.goto("/");
    await expect(page).toHaveURL(pathIs(LANDING_PATH));
  });
});

test.describe("a failing session check counts as signed out", () => {
  test("守門查詢遇到伺服器錯誤", async ({ page }) => {
    await page.route(`**${CURRENT}`, (route) => fulfillError(route, 503, "DATABASE_UNAVAILABLE"));
    await page.goto(LANDING_PATH);
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("alert")).toHaveText("平台暫時沒有回應，請稍後再試。");
  });

  test("守門查詢連不上", async ({ page }) => {
    await page.route(`**${CURRENT}`, (route) => route.abort("connectionrefused"));
    await page.goto("/");
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("alert")).toHaveText("平台暫時沒有回應，請稍後再試。");
  });
});

test.describe("passive sign-out (real backend answers)", () => {
  test("登入已過期顯示中文那句 / 達到絕對上限就要重新登入 (screen)", async ({ page }) => {
    const account = createAccount();
    await signIn(page, account);
    ageSessions(account.email, 90, 0);
    const codes: string[] = [];
    page.on("response", async (response) => {
      if (new URL(response.url()).pathname === REFRESH) {
        const body: unknown = await response.json().catch(() => null);
        if (typeof body === "object" && body !== null && "code" in body) {
          codes.push(String(body.code));
        }
      }
    });
    await page.reload();
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("alert")).toHaveText("登入已過期，請重新登入");
    expect(new URL(page.url()).search).toBe("");
    expect(codes).toContain("ACCOUNT_SESSION_EXPIRED");
    const names = (await page.context().cookies()).map((cookie) => cookie.name);
    expect(names).not.toContain("__Host-ls_rt");
  });

  test("英文介面的登入已過期顯示英文那句", async ({ page }) => {
    const account = createAccount();
    await signIn(page, account);
    await page.getByRole("button", { name: /ZH/ }).click();
    ageSessions(account.email, 91, 0);
    await page.reload();
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("alert")).toHaveText("Session expired, please sign in again");
  });

  test("英文介面的驗證失敗顯示英文那句", async ({ page }) => {
    const account = createAccount();
    await signIn(page, account);
    await page.getByRole("button", { name: /ZH/ }).click();
    setActive(account.email, false);
    await page.reload();
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("alert")).toHaveText("Authentication failed, please sign in");
  });

  test("重新整理後不再顯示被動登出那句", async ({ page }) => {
    const account = createAccount();
    await signIn(page, account);
    setActive(account.email, false);
    await page.reload();
    await expect(page.getByRole("alert")).toHaveText("驗證失敗，請重新登入");
    await page.reload();
    await expect(page.getByRole("region", { name: "登入", exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

test.describe("refresh conflicts (the 409 is stubbed; everything else is real)", () => {
  test("慢的那個分頁自動重試一次", async ({ page }) => {
    const account = createAccount();
    await signIn(page, account);
    let refreshCalls = 0;
    await page.route(`**${CURRENT}`, async (route) => {
      if (refreshCalls < 1) {
        await fulfillError(route, 401, "AUTH_REQUIRED");
      } else {
        await route.continue();
      }
    });
    await page.route(`**${REFRESH}`, async (route) => {
      refreshCalls += 1;
      await fulfillError(route, 409, "ACCOUNT_REFRESH_CONFLICT");
    });
    const refreshes = countFinished(page, "POST", REFRESH);
    const originals = countFinished(page, "GET", CURRENT);
    await page.goto(LANDING_PATH);
    await expect(
      page.getByRole("heading", { level: 1, name: "儀表板", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(pathIs(LANDING_PATH));
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(refreshes()).toBe(1);
    expect(originals()).toBe(2);
  });

  test("重試仍失敗就帶回登入頁", async ({ page }) => {
    const account = createAccount();
    await signIn(page, account);
    await page.route(`**${CURRENT}`, (route) => fulfillError(route, 401, "AUTH_REQUIRED"));
    let refreshCalls = 0;
    await page.route(`**${REFRESH}`, async (route) => {
      refreshCalls += 1;
      await fulfillError(
        route,
        refreshCalls === 1 ? 409 : 401,
        refreshCalls === 1 ? "ACCOUNT_REFRESH_CONFLICT" : "ACCOUNT_SESSION_INVALID",
      );
    });
    const refreshes = countFinished(page, "POST", REFRESH);
    const originals = countFinished(page, "GET", CURRENT);
    await page.goto(LANDING_PATH);
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("alert")).toHaveText("驗證失敗，請重新登入");
    expect(refreshes()).toBe(2);
    // The original request plus exactly one resend.
    expect(originals()).toBe(2);
  });

  test("重試不通時再延續一次就成功", async ({ page }) => {
    const account = createAccount();
    await signIn(page, account);
    let refreshCalls = 0;
    await page.route(`**${CURRENT}`, async (route) => {
      if (refreshCalls < 2) {
        await fulfillError(route, 401, "AUTH_REQUIRED");
      } else {
        await route.continue();
      }
    });
    await page.route(`**${REFRESH}`, async (route) => {
      refreshCalls += 1;
      if (refreshCalls === 1) {
        await fulfillError(route, 409, "ACCOUNT_REFRESH_CONFLICT");
      } else {
        await route.continue();
      }
    });
    const refreshes = countFinished(page, "POST", REFRESH);
    const originals = countFinished(page, "GET", CURRENT);
    await page.goto(LANDING_PATH);
    await expect(
      page.getByRole("heading", { level: 1, name: "儀表板", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(refreshes()).toBe(2);
    expect(originals()).toBe(3);
  });
});
