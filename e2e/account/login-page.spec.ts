/**
 * The sign-in page's screen Scenarios of spec account-login, frontend-i18n and
 * frontend-routing, run against the real backend and the Vite dev server
 * (login-auth-guard acceptance). The sign-in journey itself lives in
 * login.spec.ts.
 *
 * This run's backend configures neither Google nor a mail service. Scenarios
 * about a deployment that has them, and the fault Scenarios (no response, a
 * 5xx), replace only that one response with page.route; every other request
 * goes to the real backend.
 *
 * Dev mode mounts each page twice (React StrictMode), which aborts the first
 * copy of each mount query. Counts here are of finished requests, the ones
 * the backend answered (design D6: an aborted request is not a request sent).
 */
import type { Locator, Page, Request } from "@playwright/test";

import { createAccount } from "../shared/accounts.ts";
import {
  countOf,
  fulfillError,
  gate,
  okEnvelope,
  recordApiRequests,
  stubAuthOptions,
} from "../shared/api-stubs.ts";
import { expect, test } from "../shared/fixtures/index.ts";

const LOGIN_PATH = "/account/login";
const LANDING_PATH = "/dashboard/dashboard";
const SESSIONS = "/api/v1/sessions";

/** Matches a path on the base URL with no query string. */
function pathIs(pathname: string): RegExp {
  return new RegExp(`^[^?#]*${pathname.replaceAll("/", "\\/")}$`);
}

/** The sign-in card. */
function card(page: Page, name = "登入"): Locator {
  return page.getByRole("region", { name });
}

/** The two fields and the submit button, in Chinese. */
function form(page: Page) {
  return {
    email: page.getByLabel("電子郵件"),
    secret: page.getByLabel("密碼", { exact: true }),
    submit: page.getByRole("button", { name: "登入", exact: true }),
  };
}

/** Counts finished sign-in requests from now on. */
function countSignIns(page: Page): () => number {
  let count = 0;
  page.on("requestfinished", (request: Request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === SESSIONS) {
      count += 1;
    }
  });
  return () => count;
}

/** Holds every sign-in request until the returned gate opens. */
async function holdSignIn(page: Page) {
  const held = gate();
  await page.route(`**${SESSIONS}`, async (route) => {
    await held.opened;
    await route.continue();
  });
  return held;
}

test.describe("entrances", () => {
  test("登入頁顯示完整的登入入口", async ({ page }) => {
    await stubAuthOptions(page, { selfRegistrationEnabled: true, googleEnabled: true });
    await page.goto(LOGIN_PATH);
    const region = card(page);
    const items = [
      page.getByRole("link", { name: "Label Suite 首頁" }),
      page.getByRole("button", { name: /ZH/ }),
      region.getByRole("heading", { level: 1 }),
      region.getByText("登入你的帳號"),
      region.getByRole("button", { name: "使用 Google 帳號繼續登入" }),
      region.getByText("或", { exact: true }),
      region.getByLabel("電子郵件"),
      region.getByRole("link", { name: "忘記密碼？" }),
      region.getByLabel("密碼", { exact: true }),
      region.getByRole("button", { name: "登入", exact: true }),
      region.getByText("還沒有帳號？"),
      region.getByRole("link", { name: "前往註冊" }),
    ];
    let previousMiddle = -1;
    for (const item of items) {
      await expect(item).toBeVisible();
      const box = await item.boundingBox();
      expect(box, "every entrance has a box").not.toBeNull();
      const middle = (box?.y ?? 0) + (box?.height ?? 0) / 2;
      // Items on one row (brand and toggle; password label and the forgot link)
      // share a vertical middle; the tolerance absorbs sub-pixel alignment.
      expect(middle).toBeGreaterThanOrEqual(previousMiddle - 4);
      previousMiddle = middle;
    }
    await expect(page.getByText(/記住我|Remember me/)).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });

  test("沒有設定寄信服務時登入頁不顯示前往註冊", async ({ page }) => {
    await stubAuthOptions(page, { selfRegistrationEnabled: false, googleEnabled: true });
    await page.goto(LOGIN_PATH);
    const region = card(page);
    await expect(region.getByRole("button", { name: "使用 Google 帳號繼續登入" })).toBeVisible();
    await expect(region.getByText("還沒有帳號？")).toHaveCount(0);
    await expect(region.getByRole("link", { name: "前往註冊" })).toHaveCount(0);
    for (const item of [
      region.getByLabel("電子郵件"),
      region.getByLabel("密碼", { exact: true }),
      region.getByRole("link", { name: "忘記密碼？" }),
      region.getByRole("button", { name: "登入", exact: true }),
    ]) {
      await expect(item).toBeVisible();
    }
  });

  test("沒有設定 Google 登入時登入頁不顯示 Google 入口 (real backend: neither set)", async ({
    page,
  }) => {
    const options = page.waitForResponse("**/api/v1/auth-options");
    await page.goto(LOGIN_PATH);
    const body: unknown = await (await options).json();
    expect(body).toMatchObject({
      data: { selfRegistrationEnabled: false, googleEnabled: false },
    });
    const region = card(page);
    await expect(region.getByLabel("電子郵件")).toBeVisible();
    await expect(region.getByRole("button", { name: /Google/ })).toHaveCount(0);
    await expect(region.getByText("或", { exact: true })).toHaveCount(0);
    const firstControl = await region.evaluate((element) => {
      const control = element.querySelector("input, button, a[href], select, textarea");
      return control === null ? null : (control.getAttribute("type") ?? control.tagName);
    });
    expect(firstControl, "the first control in the card is the Email field").toBe("email");
  });

  // Partial: the two target pages do not exist yet (#724, #723). Only the
  // navigation to the target path is checked; the unregistered path then falls
  // back through / to the sign-in page.
  for (const [name, label, target] of [
    ["點忘記密碼前往重設 (partial: link target only)", "忘記密碼？", "/account/forgot-password"],
    ["點前往註冊 (partial: link target only)", "前往註冊", "/account/register"],
  ] as const) {
    test(name, async ({ page }) => {
      await stubAuthOptions(page, { selfRegistrationEnabled: true, googleEnabled: false });
      await page.goto(LOGIN_PATH);
      const visited: string[] = [];
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) {
          visited.push(new URL(frame.url()).pathname);
        }
      });
      await expect(card(page).getByRole("link", { name: label })).toHaveAttribute("href", target);
      await card(page).getByRole("link", { name: label }).click();
      await expect.poll(() => visited).toContain(target);
    });
  }
});

test.describe("required fields", () => {
  test("沒填 Email 就送出", async ({ page }) => {
    const signIns = countSignIns(page);
    await page.goto(LOGIN_PATH);
    const f = form(page);
    await f.secret.fill("anything-1");
    await f.submit.click();
    await expect(f.email).toHaveAccessibleDescription("請輸入電子郵件");
    await expect(f.secret).not.toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    expect(signIns()).toBe(0);
  });

  test("沒填密碼就送出", async ({ page }) => {
    const signIns = countSignIns(page);
    await page.goto(LOGIN_PATH);
    const f = form(page);
    await f.email.fill("someone@example.com");
    await f.submit.click();
    await expect(f.secret).toHaveAccessibleDescription("請輸入密碼");
    await expect(f.email).not.toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    expect(signIns()).toBe(0);
  });

  test("兩欄都沒填", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    const f = form(page);
    await f.submit.click();
    await expect(f.email).toHaveAccessibleDescription("請輸入電子郵件");
    await expect(f.secret).toHaveAccessibleDescription("請輸入密碼");
  });

  test("只填空白字元的 Email", async ({ page }) => {
    const signIns = countSignIns(page);
    await page.goto(LOGIN_PATH);
    const f = form(page);
    await f.email.fill("   ");
    await f.secret.fill("anything-1");
    await f.submit.click();
    await expect(f.email).toHaveAccessibleDescription("請輸入電子郵件");
    expect(signIns()).toBe(0);
  });

  test("重新輸入就清掉錯誤", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    const f = form(page);
    await f.submit.click();
    await expect(f.email).toHaveAccessibleDescription("請輸入電子郵件");
    await f.email.pressSequentially("a");
    await expect(f.email).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("請輸入電子郵件")).toHaveCount(0);
  });
});

test.describe("sign-in failures", () => {
  test("失敗時不清空已填的內容 + 改在任一欄輸入就收起失敗訊息", async ({ page }) => {
    const account = createAccount();
    await page.goto(LOGIN_PATH);
    const f = form(page);
    const wrong = `${account.passphrase}-x`;
    await f.email.fill(account.email);
    await f.secret.fill(wrong);
    await f.submit.click();
    const banner = page.getByRole("alert");
    await expect(banner).toHaveText("帳號或密碼錯誤，請再試一次");
    await expect(f.email).toHaveValue(account.email);
    await expect(f.secret).toHaveValue(wrong);
    await f.secret.pressSequentially("y");
    await expect(banner).toHaveCount(0);
  });

  test("錯誤後再送出成功", async ({ page }) => {
    const account = createAccount();
    await page.goto(LOGIN_PATH);
    const f = form(page);
    await f.submit.click();
    await expect(f.email).toHaveAccessibleDescription("請輸入電子郵件");
    await f.email.fill(account.email);
    await f.secret.fill(account.passphrase);
    const held = await holdSignIn(page);
    await f.submit.click();
    // While submitting: the errors are already gone.
    await expect(page.getByRole("button", { name: "載入中" })).toBeDisabled();
    await expect(page.getByText(/請輸入電子郵件|請輸入密碼/)).toHaveCount(0);
    held.open();
    await expect(page).toHaveURL(pathIs(LANDING_PATH));
  });

  test("送出後平台沒有回應 (connection refused)", async ({ page }) => {
    await page.route(`**${SESSIONS}`, (route) => route.abort("connectionrefused"));
    await page.goto(LOGIN_PATH);
    const f = form(page);
    await f.email.fill("someone@example.com");
    await f.secret.fill("anything-1");
    await f.submit.click();
    await expect(page.getByRole("alert")).toHaveText("平台暫時沒有回應，請稍後再試。");
    await expect(f.email).toHaveValue("someone@example.com");
    await expect(f.secret).toHaveValue("anything-1");
    await expect(f.submit).toBeEnabled();
  });

  test("送出後平台沒有回應 (English)", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("labelsuite.lang", "en"));
    await page.route(`**${SESSIONS}`, (route) => route.abort("timedout"));
    await page.goto(LOGIN_PATH);
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByLabel("Password", { exact: true }).fill("anything-1");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "The platform is not responding. Please try again later.",
    );
  });

  test("伺服器錯誤也顯示同一句", async ({ page }) => {
    await page.route(`**${SESSIONS}`, (route) => fulfillError(route, 500, "INTERNAL_ERROR"));
    await page.goto(LOGIN_PATH);
    const f = form(page);
    await f.email.fill("someone@example.com");
    await f.secret.fill("anything-1");
    await f.submit.click();
    await expect(page.getByRole("alert")).toHaveText("平台暫時沒有回應，請稍後再試。");
    await expect(page.getByText("帳號或密碼錯誤，請再試一次")).toHaveCount(0);
  });
});

test.describe("while submitting", () => {
  test("送出中點語言切換沒反應", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    const f = form(page);
    await f.email.fill("someone@example.com");
    await f.secret.fill("anything-1");
    const held = await holdSignIn(page);
    await f.submit.click();
    await expect(page.getByRole("button", { name: "載入中" })).toBeDisabled();
    await page.getByRole("button", { name: /ZH/ }).click({ force: true });
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
    await expect(page.getByRole("button", { name: /ZH/ })).toBeVisible();
    await expect(page).toHaveTitle("Label Suite — 登入");
    held.open();
    await expect(page.getByRole("alert")).toHaveText("帳號或密碼錯誤，請再試一次");
  });

  test("送出中點底部連結沒反應", async ({ page }) => {
    await stubAuthOptions(page, { selfRegistrationEnabled: true, googleEnabled: true });
    await page.goto(LOGIN_PATH);
    const f = form(page);
    await f.email.fill("someone@example.com");
    await f.secret.fill("anything-1");
    const held = await holdSignIn(page);
    await f.submit.click();
    await expect(page.getByRole("button", { name: "載入中" })).toBeDisabled();
    for (const link of [
      page.getByRole("link", { name: "前往註冊" }),
      page.getByRole("link", { name: "忘記密碼？" }),
    ]) {
      await expect(link).toHaveAttribute("aria-disabled", "true");
      await link.click({ force: true });
      await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    }
    await expect(page.getByRole("button", { name: "使用 Google 帳號繼續登入" })).toBeDisabled();
    await expect(f.email).toBeDisabled();
    await expect(f.secret).toBeDisabled();
    held.open();
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
  });

  test("送出中重複點擊只送出一次", async ({ page }) => {
    const account = createAccount();
    const signIns = countSignIns(page);
    // Counts changes of page. Dev-mode StrictMode runs <Navigate>'s effect
    // twice, which commits the same URL twice; that is not a second redirect
    // (the production build commits it once, see acceptance.md).
    let landings = 0;
    let lastPath = "";
    page.on("framenavigated", (frame) => {
      if (frame !== page.mainFrame()) {
        return;
      }
      const current = new URL(frame.url()).pathname;
      if (current === LANDING_PATH && lastPath !== LANDING_PATH) {
        landings += 1;
      }
      lastPath = current;
    });
    await page.goto(LOGIN_PATH);
    const f = form(page);
    await f.email.fill(account.email);
    await f.secret.fill(account.passphrase);
    const historyBefore = await page.evaluate(() => window.history.length);
    const held = await holdSignIn(page);
    await f.submit.click();
    const busy = page.getByRole("button", { name: "載入中" });
    for (let i = 0; i < 3; i += 1) {
      await busy.click({ force: true });
    }
    held.open();
    await expect(page).toHaveURL(pathIs(LANDING_PATH));
    await expect(page.getByRole("button", { name: "登出" })).toBeVisible();
    expect(signIns()).toBe(1);
    expect(landings).toBe(1);
    expect(await page.evaluate(() => window.history.length)).toBe(historyBefore);
  });

  test("送出中的進行中指示有名稱 (zh-TW)", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    const f = form(page);
    await f.email.fill("someone@example.com");
    await f.secret.fill("anything-1");
    const held = await holdSignIn(page);
    await f.submit.click();
    await expect(page.getByRole("button", { name: "載入中", exact: true })).toBeVisible();
    held.open();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("送出中的進行中指示有名稱 (en)", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("labelsuite.lang", "en"));
    await page.goto(LOGIN_PATH);
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByLabel("Password", { exact: true }).fill("anything-1");
    const held = await holdSignIn(page);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("button", { name: "Loading", exact: true })).toBeVisible();
    held.open();
    await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
  });
});

test.describe("password visibility", () => {
  test("密碼可切換顯示 / 密碼再點一次變回遮住 / 密碼顯示中切換語言", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    const secret = form(page).secret;
    await secret.fill("abc123");
    await expect(secret).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "顯示密碼" }).click();
    await expect(secret).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "隱藏密碼" })).toBeVisible();
    await page.getByRole("button", { name: "隱藏密碼" }).click();
    await expect(secret).toHaveAttribute("type", "password");
    await expect(page.getByRole("button", { name: "顯示密碼" })).toBeVisible();

    await page.getByRole("button", { name: "顯示密碼" }).click();
    await page.getByRole("button", { name: /ZH/ }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();
  });
});

test.describe("Google sign-in (Google answers stubbed; the real Google is never contacted)", () => {
  const AUTHORIZE =
    "https://accounts.google.com/o/oauth2/v2/auth?state=s1&nonce=n1&code_challenge=c1&code_challenge_method=S256";

  test("點 Google 帳號登入 / 快速連點 Google 按鈕", async ({ page }) => {
    await stubAuthOptions(page, { selfRegistrationEnabled: true, googleEnabled: true });
    let urlRequests = 0;
    await page.route("**/api/v1/google-authorization", async (route) => {
      urlRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: okEnvelope({ authorizationUrl: AUTHORIZE }),
      });
    });
    let googleVisits = 0;
    await page.route("https://accounts.google.com/**", async (route) => {
      googleVisits += 1;
      await route.fulfill({ status: 200, contentType: "text/html", body: "<title>Google</title>" });
    });
    await page.goto(LOGIN_PATH);
    const button = page.getByRole("button", { name: "使用 Google 帳號繼續登入" });
    await button.click({ clickCount: 3, delay: 0 });
    await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
    expect(urlRequests).toBe(1);
    expect(googleVisits).toBe(1);
  });
});

test.describe("language switch", () => {
  test("語言切換鈕只顯示代號 / 說明文字包含代號", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    const toggle = page.getByRole("button", { name: /ZH/ });
    await expect(toggle).toHaveText("ZH");
    await expect(toggle).toHaveAccessibleName(/ZH/);
  });

  test("Google 按鈕的文字隨語言切換", async ({ page }) => {
    await stubAuthOptions(page, { selfRegistrationEnabled: true, googleEnabled: true });
    await page.goto(LOGIN_PATH);
    await page.getByRole("button", { name: /ZH/ }).click();
    const google = page.getByRole("button", { name: "Continue with Google account" });
    await expect(google).toHaveText("Continue with Google");
  });

  test("切換語言整頁即時更新 / 切換語言可以切回來 / 登入頁的瀏覽器標題", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    await expect(page).toHaveTitle("Label Suite — 登入");
    await page.evaluate(() => {
      (window as unknown as { notReloaded: boolean }).notReloaded = true;
    });
    await page.getByRole("button", { name: /ZH/ }).click();
    await expect(page).toHaveTitle("Label Suite — Sign In");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText("Sign in to your account")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show password" })).toBeVisible();
    await expect(page.getByRole("button", { name: /EN/ })).toHaveText("EN");
    expect(
      await page.evaluate(() => (window as unknown as { notReloaded?: boolean }).notReloaded),
    ).toBe(true);

    await page.getByRole("button", { name: /EN/ }).click();
    await expect(page).toHaveTitle("Label Suite — 登入");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
    await expect(page.getByText("登入你的帳號")).toBeVisible();
    await expect(page.getByRole("button", { name: "顯示密碼" })).toBeVisible();
  });

  test("切換語言會清掉欄位錯誤", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    await form(page).submit.click();
    await expect(page.getByText("請輸入電子郵件")).toBeVisible();
    await page.getByRole("button", { name: /ZH/ }).click();
    await expect(page.getByText(/Email is required|請輸入電子郵件/)).toHaveCount(0);
    await expect(page.getByLabel("Email")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("重新開啟後沿用記住的語言", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    await page.getByRole("button", { name: /ZH/ }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.reload();
    await expect(page.getByText("Sign in to your account")).toBeVisible();
    await expect(page.getByRole("button", { name: /EN/ })).toHaveText("EN");
  });

  for (const stored of ["ja", "", "EN-us"]) {
    test(`記住的語言值無效時用繁體中文 (${JSON.stringify(stored)})`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(
        (value) => window.localStorage.setItem("labelsuite.lang", value),
        stored,
      );
      await page.goto(LOGIN_PATH);
      await expect(page.getByText("登入你的帳號")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
      expect(errors).toEqual([]);
    });
  }
});

test.describe("first visit with an English browser", () => {
  test.use({ locale: "en-US" });

  test("第一次來的人看到繁體中文", async ({ page }) => {
    const seen = recordApiRequests(page);
    await page.goto(LOGIN_PATH);
    expect(await page.evaluate(() => navigator.language)).toBe("en-US");
    await expect(page.getByText("登入你的帳號")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
    const options = seen.filter((request) => request.path === "/api/v1/auth-options");
    expect(options.length).toBeGreaterThan(0);
    for (const request of options) {
      expect(request.headers["accept-language"]).toBe("zh-TW");
    }
    expect(countOf(seen, "GET", "/api/v1/auth-options")).toBeGreaterThan(0);
  });
});
