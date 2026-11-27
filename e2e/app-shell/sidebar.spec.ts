/**
 * The signed-in shell's sidebar (spec app-shell-sidebar; frontend-i18n
 * 「第一次登入預設繁體中文」「重新整理後語言保持」; sidebar-nav design D15).
 * Real backend and Vite dev server. Widths 1280, 820 and 375px stand for
 * desktop, tablet and phone. Every journey signs in its own account.
 */
import type { Locator, Page, Request } from "@playwright/test";

import { createAccount, setRole, type TestAccount } from "../shared/accounts.ts";
import { expect, test } from "../shared/fixtures/index.ts";

const LOGIN_PATH = "/account/login";
const LANDING_PATH = "/dashboard/dashboard";
const CURRENT = "/api/v1/current-session";
const BLOCKED_ANNOTATION = "你目前在任何任務都沒有標記或審核角色，所以還不能進入標記作業。";
const MEMBER_ITEMS = ["儀表板", "任務管理", "標記作業", "資料集分析", "個人設定"];
const ADMIN_ITEMS = ["儀表板", "任務管理", "標記作業", "資料集分析", "系統管理", "個人設定"];
const DESKTOP = { width: 1280, height: 800 };
const TABLET = { width: 820, height: 1180 };
const PHONE = { width: 375, height: 667 };
/** Chinese characters: none may remain in the English sidebar but the user's name. */
const HAN = /[㐀-鿿]/;

/** Matches a path on the base URL with no query string. */
function pathIs(pathname: string): RegExp {
  return new RegExp(`^[^?#]*${pathname.replaceAll("/", "\\/")}$`);
}

/** Signs in through the page in Chinese and waits for the sidebar on the landing page. */
async function signIn(page: Page, account: TestAccount): Promise<void> {
  await page.goto(LOGIN_PATH);
  await page.getByLabel("電子郵件").fill(account.email);
  await page.getByLabel("密碼", { exact: true }).fill(account.passphrase);
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page).toHaveURL(pathIs(LANDING_PATH));
  await expect(mainNav(page)).toBeVisible();
}

function mainNav(page: Page, name = "主導覽"): Locator {
  return page.getByRole("navigation", { name });
}

/** The sidebar's top-level items (links and the System Administration button). */
function navItems(page: Page, name = "主導覽"): Locator {
  return mainNav(page, name).locator(":scope > a, :scope > div > button, :scope > div > a");
}

async function expectItems(page: Page, names: string[], navName = "主導覽"): Promise<void> {
  await expect(navItems(page, navName)).toHaveText(names);
}

function sidebar(page: Page): Locator {
  return page.getByRole("banner");
}

function profileLink(page: Page, name = "前往個人設定"): Locator {
  return page.getByRole("link", { name });
}

/** The document is no wider than the window. */
async function expectNoSideScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    window: window.innerWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.window);
}

/** The bounding box, failing the test when the element has none. */
async function boxOf(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  expect(box, "the element has a box").not.toBeNull();
  return box ?? { x: 0, y: 0, width: 0, height: 0 };
}

/** Waits until the sidebar's width settles at `width` (it animates between the two). */
async function expectSidebarWidth(page: Page, width: number): Promise<void> {
  await expect.poll(async () => (await boxOf(sidebar(page))).width).toBe(width);
}

/**
 * Waits until every request the page started so far has been reported: after
 * the page's pending work and a frame, it fetches a file from its own origin
 * and waits for the answer. The browser reports requests in the order it
 * sends them, so a query the app sent before is counted by then. It waits on
 * an event, never on a clock (testing-agent-rules T8, e2e static checks).
 */
async function settleRequests(page: Page): Promise<void> {
  const sentinel = page.waitForResponse((response) =>
    response.url().includes("/theme-init.js?settle="),
  );
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
    await fetch(`/theme-init.js?settle=${String(Date.now())}`, { cache: "no-store" });
  });
  await sentinel;
}

/** Counts the "current session" queries the page sends from now on. */
function countSessionQueries(page: Page): () => number {
  const seen: Request[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET" && new URL(request.url()).pathname === CURRENT) {
      seen.push(request);
    }
  });
  return () => seen.length;
}

test.describe("every width has the full navigation", () => {
  test("桌機能完整導覽", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const account = createAccount();
    await signIn(page, account);

    const bar = sidebar(page);
    const barBox = await boxOf(bar);
    expect(barBox.x).toBe(0);
    await expect(bar.getByRole("link", { name: "Label Suite 首頁" })).toBeVisible();
    await expect(bar.getByTestId("lang-toggle")).toBeVisible();
    await expectItems(page, MEMBER_ITEMS);
    await expect(bar.getByRole("button", { name: "快捷鍵" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "切換為深色模式" })).toBeVisible();
    await expect(profileLink(page)).toContainText("王小明");
    await expect(bar.getByTestId("role-indicator")).toHaveText("一般使用者");
    await expect(bar.getByRole("button", { name: "登出" })).toBeVisible();
    const mainBox = await boxOf(page.getByRole("main"));
    expect(mainBox.x).toBeGreaterThanOrEqual(barBox.x + barBox.width);
    await expectNoSideScroll(page);

    await bar.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(mainNav(page)).toHaveCount(0);
  });

  test("平板能完整導覽", async ({ page }) => {
    await page.setViewportSize(TABLET);
    await signIn(page, createAccount());

    const bar = sidebar(page);
    const barBox = await boxOf(bar);
    expect(barBox.x).toBe(0);
    await expectItems(page, MEMBER_ITEMS);
    for (const item of await navItems(page).all()) {
      await expect(item).toBeVisible();
      await expect(item).toBeEnabled();
    }
    await expect(bar.getByRole("button", { name: "快捷鍵" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "切換為深色模式" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "登出" })).toBeVisible();
    const mainBox = await boxOf(page.getByRole("main"));
    expect(mainBox.x).toBeGreaterThanOrEqual(barBox.x + barBox.width);
    await expectNoSideScroll(page);
  });

  test("手機能完整導覽", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signIn(page, createAccount());

    const brandLink = page.getByRole("link", { name: "Label Suite 首頁" });
    const topBar = brandLink.locator("xpath=..");
    expect((await boxOf(topBar)).y).toBe(0);
    await expect(topBar.getByTestId("lang-toggle")).toBeVisible();
    await expect(topBar.getByRole("button", { name: "切換為深色模式" })).toBeVisible();
    await expect(topBar.getByRole("button", { name: "登出" })).toBeVisible();
    await expect(page.getByText("王小明", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "快捷鍵" })).toHaveCount(0);

    const navBox = await boxOf(mainNav(page));
    expect(navBox.y + navBox.height).toBe(PHONE.height);
    await expectItems(page, MEMBER_ITEMS);
    for (const item of await navItems(page).all()) {
      await expect(item).toBeVisible();
      await expect(item).toBeEnabled();
    }
    await expectNoSideScroll(page);
  });

  test("手機底部導覽不遮擋主要操作", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signIn(page, createAccount());

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    const topBar = await boxOf(
      page.getByRole("link", { name: "Label Suite 首頁" }).locator("xpath=.."),
    );
    const bottomNav = await boxOf(mainNav(page));
    const last = await page.getByRole("main").evaluate((main) => {
      let node: Element = main;
      while (node.lastElementChild !== null) {
        node = node.lastElementChild;
      }
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    });

    expect(last.top).toBeGreaterThanOrEqual(topBar.y + topBar.height);
    expect(last.bottom).toBeLessThanOrEqual(bottomNav.y);
  });
});

test.describe("items by role", () => {
  test("平台成員看不到系統管理", async ({ page }) => {
    await signIn(page, createAccount());

    await expectItems(page, MEMBER_ITEMS);
    await expect(page.getByRole("button", { name: "系統管理" })).toHaveCount(0);
  });

  test("系統管理員看到系統管理", async ({ page }) => {
    await signIn(page, createAccount({ name: "管理員", role: "super_admin" }));

    await expectItems(page, ADMIN_ITEMS);
  });

  test("角色被改掉時側欄不立刻變", async ({ page }) => {
    const account = createAccount({ name: "管理員", role: "super_admin" });
    await signIn(page, account);
    await expectItems(page, ADMIN_ITEMS);
    const queries = countSessionQueries(page);

    setRole(account.email, "user");
    await page.evaluate(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });
    await settleRequests(page);
    await expectItems(page, ADMIN_ITEMS);
    expect(queries()).toBe(0);

    await page.getByRole("link", { name: "任務管理" }).click();
    await expect(page).toHaveURL(pathIs(LANDING_PATH));
    await expectItems(page, MEMBER_ITEMS);
    await expect(page.getByRole("button", { name: "系統管理" })).toHaveCount(0);
    // The next page asked once, also through the redirect chain and StrictMode.
    await settleRequests(page);
    expect(queries()).toBe(1);
  });

  test("沒有任務角色時角色標示讀作一般使用者", async ({ page }) => {
    await signIn(page, createAccount({ name: "王小明" }));

    const profile = profileLink(page);
    await expect(profile).toContainText("王小明");
    await expect(profile.getByTestId("role-indicator")).toHaveText("一般使用者");
    await expect(navItems(page).nth(2)).toHaveText("標記作業");
    await expect(profile).not.toContainText("平台成員");
  });

  test("角色標示切換語言後也換", async ({ page }) => {
    await signIn(page, createAccount({ name: "王小明" }));

    await sidebar(page).getByTestId("lang-toggle").click();

    const profile = profileLink(page, "Go to Profile");
    await expect(profile.getByTestId("role-indicator")).toHaveText("General user");
    await expect(navItems(page, "Main navigation").nth(2)).toHaveText("Annotation");
    expect(await mainNav(page, "Main navigation").innerText()).not.toMatch(HAN);
    // The user's name, and the avatar's initial taken from it, are the only exceptions.
    expect((await profile.innerText()).replace("王小明", "").replace("王", "")).not.toMatch(HAN);
  });
});

test.describe("current location and blocking", () => {
  test("每頁只有一個目前位置", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, createAccount({ name: "管理員", role: "super_admin" }));

    const current = page.locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAccessibleName("儀表板");

    await page.getByRole("button", { name: "收合側欄" }).click();
    await expect(page.getByRole("button", { name: "展開側欄" })).toBeVisible();
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAccessibleName("儀表板");
    await expect(current).toBeVisible();
  });

  test("沒有任務角色時點擊標記作業", async ({ page }) => {
    await signIn(page, createAccount());
    const link = page.getByRole("link", { name: "標記作業" });
    await expect(link).toHaveAttribute("href", "/annotation/annotation-list?entry=nav");
    expect(await link.getAttribute("href")).not.toMatch(/task_type|task_id|taskId/);

    await link.click();

    await expect(page).toHaveURL(pathIs(LANDING_PATH));
    expect(new URL(page.url()).search).toBe("");
    const alert = page.getByRole("alert");
    await expect(alert).toHaveText(BLOCKED_ANNOTATION);
    const card = await boxOf(page.getByRole("region", { name: "你已登入" }));
    expect((await boxOf(alert)).y).toBeLessThan(card.y);

    await page.reload();
    await expect(page.getByRole("region", { name: "你已登入" })).toBeVisible();
    await expect(page.getByText(BLOCKED_ANNOTATION)).toHaveCount(0);
  });

  test("錯誤訊息不出現系統內部資訊", async ({ page }) => {
    await signIn(page, createAccount());
    await page.route(`**${CURRENT}`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          code: "INTERNAL_ERROR",
          message: "系統發生錯誤",
          data: null,
          timestamp: "2026-11-27T08:00:00.000Z",
          traceId: "trace-abc",
          errors: null,
        }),
      });
    });

    await page.getByRole("link", { name: "任務管理" }).click();

    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("alert")).toHaveText("平台暫時沒有回應，請稍後再試。");
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("INTERNAL_ERROR");
    expect(text).not.toContain("trace-abc");
    expect(text).not.toContain(CURRENT);
  });
});

test.describe("System Administration submenu", () => {
  test("展開系統管理次選單", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, createAccount({ name: "管理員", role: "super_admin" }));
    const trigger = page.getByRole("button", { name: "系統管理" });

    await trigger.click();

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const submenu = page.getByTestId("admin-nav-submenu");
    await expect(submenu.getByRole("link")).toHaveText(["使用者管理", "角色設定"]);
    await expect(submenu.getByRole("link", { name: "使用者管理" })).toHaveAttribute(
      "href",
      "/admin/user-management",
    );
    await expect(submenu.getByRole("link", { name: "角色設定" })).toHaveAttribute(
      "href",
      "/admin/role-settings",
    );
  });

  test("按 Esc 關閉系統管理次選單", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, createAccount({ name: "管理員", role: "super_admin" }));
    const trigger = page.getByRole("button", { name: "系統管理" });
    await trigger.click();
    await page.getByRole("link", { name: "角色設定" }).focus();

    await page.keyboard.press("Escape");

    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });
});

test.describe("language and appearance", () => {
  test("切換語言後整頁一起換", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, createAccount());

    await sidebar(page).getByTestId("lang-toggle").click();

    await expectItems(
      page,
      ["Dashboard", "Task Management", "Annotation", "Dataset Analytics", "Profile"],
      "Main navigation",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("You're signed in");
    await expect(page.getByRole("button", { name: /^Switch to (dark|light) mode$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Keyboard shortcuts" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Global tools" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Profile" })).toBeVisible();
  });

  test("切換外觀立即生效", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await signIn(page, createAccount());
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await sidebar(page).getByRole("button", { name: "切換為深色模式" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(sidebar(page).getByRole("button", { name: "切換為淺色模式" })).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: /切換為(深|淺)色模式/ })).toHaveCount(1);
  });

  test("第一次登入預設繁體中文 / 重新整理後語言保持", async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await signIn(page, createAccount());
    await expect(navItems(page).first()).toHaveText("儀表板");
    await expectItems(page, MEMBER_ITEMS);

    await sidebar(page).getByTestId("lang-toggle").click();
    await expect(navItems(page, "Main navigation").first()).toHaveText("Dashboard");
    await page.reload();

    await expect(navItems(page, "Main navigation").first()).toHaveText("Dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("You're signed in");
    await context.close();
  });
});

test.describe("shortcut overview", () => {
  test("桌機開啟快捷鍵總覽", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, createAccount());
    const dashboard = page.getByRole("link", { name: "儀表板" });
    await dashboard.focus();

    await page.keyboard.press("?");

    const dialog = page.getByRole("dialog", { name: "目前頁面可用快捷鍵" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 3 })).toHaveText(["全域"]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(dashboard).toBeFocused();
  });

  test("快捷鍵總覽只列目前頁面可用的", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, createAccount());

    await page.getByRole("button", { name: "快捷鍵" }).click();

    const dialog = page.getByRole("dialog", { name: "目前頁面可用快捷鍵" });
    await expect(dialog.getByRole("heading", { level: 3 })).toHaveText(["全域"]);
    await expect(dialog.getByRole("term")).toHaveText(["開啟快捷鍵總覽", "關閉視窗或取消選取"]);
    await expect(dialog.getByRole("definition")).toHaveText(["?", "Esc"]);
    await expect(dialog).not.toContainText(/審核|工作區|頁籤/);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("?");
    await expect(dialog).toBeVisible();
  });

  test("手機沒有快捷鍵總覽入口", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signIn(page, createAccount());

    await expect(page.getByRole("button", { name: "快捷鍵" })).toHaveCount(0);
  });

  test("手機按問號不開啟快捷鍵總覽", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signIn(page, createAccount());

    await page.keyboard.press("?");

    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("signing out", () => {
  test("登出後回到登入頁", async ({ page, playwright }) => {
    await signIn(page, createAccount());
    const before = await page.context().storageState();
    const signOut = page.waitForRequest((request) => request.method() === "DELETE");

    await sidebar(page).getByRole("button", { name: "登出" }).click();

    const apiOrigin = new URL((await signOut).url()).origin;
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await page.goBack();
    await expect(page.getByRole("region", { name: "你已登入" })).toHaveCount(0);
    const oldCookies = await playwright.request.newContext({ storageState: before });
    const response = await oldCookies.get(`${apiOrigin}${CURRENT}`);
    expect(response.status()).toBe(401);
    expect(((await response.json()) as { code: string }).code).toBe("AUTH_REQUIRED");
    await oldCookies.dispose();
  });

  test("等待中的操作顯示進行中", async ({ page }) => {
    await signIn(page, createAccount());
    let deletes = 0;
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**${CURRENT}`, async (route) => {
      if (route.request().method() !== "DELETE") {
        await route.continue();
        return;
      }
      deletes += 1;
      await held;
      await route.continue();
    });
    const button = sidebar(page).getByRole("button", { name: "登出" });

    await button.click();
    await button.click({ force: true });

    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button.locator("svg.animate-spin")).toBeVisible();
    expect(deletes).toBe(1);
    release();
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    expect(deletes).toBe(1);
  });
});

test.describe("collapsing", () => {
  /** Clicks the sidebar's empty space between the items and the tools. */
  async function clickEmptySpace(page: Page): Promise<void> {
    const nav = await boxOf(mainNav(page));
    const tools = await boxOf(page.getByRole("group", { name: "全域工具" }));
    const y = (nav.y + nav.height + tools.y) / 2;
    await page.mouse.click(nav.x + nav.width / 2, y);
  }

  test("點擊側欄空白區收合", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, createAccount());

    await clickEmptySpace(page);

    await expect(page.getByRole("button", { name: "展開側欄" })).toBeVisible();
    const dashboard = page.getByRole("link", { name: "儀表板" });
    await expect(dashboard).toBeVisible();
    await expect(dashboard.getByText("儀表板")).not.toBeInViewport({ ratio: 0.5 });
    await expectSidebarWidth(page, 88);
  });

  test("點擊導覽連結不會收合", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, createAccount());

    await page.getByRole("link", { name: "儀表板" }).click();

    await expect(page.getByRole("button", { name: "收合側欄" })).toBeVisible();
    await expectSidebarWidth(page, 240);
  });

  test("點擊登出不會收合", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const account = createAccount();
    await signIn(page, account);

    await sidebar(page).getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await signIn(page, account);

    await expect(page.getByRole("button", { name: "收合側欄" })).toBeVisible();
    await expectSidebarWidth(page, 240);
  });

  test("重新整理後收合狀態保持", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, createAccount());
    await clickEmptySpace(page);
    await expect(page.getByRole("button", { name: "展開側欄" })).toBeVisible();

    await page.reload();

    await expect(page.getByRole("button", { name: "展開側欄" })).toBeVisible();
    await expectSidebarWidth(page, 88);
  });

  test("手機不啟用收合", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signIn(page, createAccount());
    await page.evaluate(() => {
      window.localStorage.setItem("labelsuite.sidebarCollapsed", "true");
    });
    await page.reload();
    await expect(mainNav(page)).toBeVisible();

    await mainNav(page).click({ position: { x: 1, y: 0 } });

    await expect(page.getByRole("link", { name: "Label Suite 首頁" })).toBeVisible();
    for (const item of await navItems(page).all()) {
      await expect(item).toBeVisible();
      await expect(item.locator("span")).toBeVisible();
    }
    await expectItems(page, MEMBER_ITEMS);
    expect(
      await page.evaluate(() => window.localStorage.getItem("labelsuite.sidebarCollapsed")),
    ).toBe("true");
  });

  test("側欄收合後快捷鍵入口隱藏", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, createAccount());
    await expect(page.getByRole("button", { name: /通知/ })).toHaveCount(0);

    await page.getByRole("button", { name: "收合側欄" }).click();

    await expect(page.getByRole("button", { name: "快捷鍵" })).toHaveCount(0);
    const theme = sidebar(page).getByRole("button", { name: "切換為深色模式" });
    const signOut = sidebar(page).getByRole("button", { name: "登出" });
    await expect(theme).toBeVisible();
    await expect(theme).toBeEnabled();
    await expect(signOut).toBeVisible();
    await expect(signOut).toBeEnabled();
    await expect(page.getByRole("button", { name: /通知/ })).toHaveCount(0);
  });
});

test.describe("keyboard and motion", () => {
  test("用鍵盤走過側欄所有控制項", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, createAccount({ name: "管理員", role: "super_admin" }));
    await page.locator("body").focus();
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    const expected = [
      "Label Suite 首頁",
      "ZH，切換語言",
      ...ADMIN_ITEMS,
      "收合側欄",
      "快捷鍵",
      "切換為深色模式",
      "前往個人設定",
      "登出",
    ];

    for (const name of expected) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(focused).toHaveAccessibleName(name);
      const ring = await focused.evaluate((element) => getComputedStyle(element).boxShadow);
      expect(ring, `${name} shows a focus ring`).not.toBe("none");
    }

    const control = page.getByRole("button", { name: "收合側欄" });
    await control.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(":focus")).toHaveAccessibleName("展開側欄");
    await expectSidebarWidth(page, 88);
  });

  test("關閉動態效果時不播動畫", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page, createAccount({ name: "管理員", role: "super_admin" }));
    const bar = sidebar(page);

    await page.getByRole("button", { name: "收合側欄" }).click();
    expect(await bar.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe(
      "0s",
    );
    await expectSidebarWidth(page, 88);
    await page.getByRole("button", { name: "展開側欄" }).click();
    await expectSidebarWidth(page, 240);

    await page.getByRole("button", { name: "系統管理" }).click();
    const link = page.getByRole("link", { name: "角色設定" });
    await expect(link).toBeVisible();
    expect(await link.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe(
      "0s",
    );
  });
});

test.describe("long English labels (clarification Q13)", () => {
  for (const viewport of [DESKTOP, PHONE]) {
    test(`語言文字較長時導覽不截斷 (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await signIn(page, createAccount({ name: "Admin", role: "super_admin" }));
      await sidebar(page).getByTestId("lang-toggle").click();
      // hyphens: auto needs the language; lib/i18n keeps <html lang> in step.
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      const englishNames = [
        "Dashboard",
        "Task Management",
        "Annotation",
        "Dataset Analytics",
        "System Administration",
        "Profile",
      ];
      // The names come from the accessibility tree, matched exactly: no soft hyphen in any.
      await expect(navItems(page, "Main navigation")).toHaveCount(englishNames.length);
      for (const [index, name] of englishNames.entries()) {
        const item = navItems(page, "Main navigation").nth(index);
        await expect(item).toHaveAccessibleName(name);
        // On a wide sidebar System Administration is the submenu's button.
        const role = viewport.width !== PHONE.width && index === 4 ? "button" : "link";
        await expect(
          mainNav(page, "Main navigation").getByRole(role, { name, exact: true }),
        ).toHaveCount(1);
      }

      const measured = await navItems(page, "Main navigation").evaluateAll((items) =>
        items.map((item) => {
          const label = item.querySelector("span");
          const itemRect = item.getBoundingClientRect();
          const labelRect = label?.getBoundingClientRect();
          const nav = item.closest("nav")?.getBoundingClientRect();
          return {
            text: item.textContent,
            itemScroll: item.scrollWidth,
            itemClient: item.clientWidth,
            itemScrollHeight: item.scrollHeight,
            itemClientHeight: item.clientHeight,
            labelLeft: labelRect?.left ?? 0,
            labelRight: labelRect?.right ?? 0,
            labelTop: labelRect?.top ?? 0,
            labelBottom: labelRect?.bottom ?? 0,
            // The label is a flex item, so one box; its height over the line height is its line count.
            lines:
              labelRect === undefined || label === null
                ? 0
                : Math.round(labelRect.height / parseFloat(getComputedStyle(label).lineHeight)),
            itemLeft: itemRect.left,
            itemRight: itemRect.right,
            itemTop: itemRect.top,
            itemBottom: itemRect.bottom,
            navTop: nav?.top ?? 0,
            navBottom: nav?.bottom ?? 0,
            windowHeight: window.innerHeight,
            ellipsis: label === null ? "" : getComputedStyle(label).textOverflow,
          };
        }),
      );
      // Where a word breaks, and whether a hyphen is drawn, is not in the DOM;
      // the screenshot is the record of how the labels wrap.
      await test.info().attach(`main-navigation-${String(viewport.width)}px`, {
        body: await mainNav(page, "Main navigation").screenshot({
          path: test.info().outputPath(`main-navigation-${String(viewport.width)}px.png`),
        }),
        contentType: "image/png",
      });
      await test.info().attach("measurements", {
        body: JSON.stringify(measured, null, 2),
        contentType: "application/json",
      });
      // Soft, so a failure reports every label's measurements at once.
      for (const item of measured) {
        expect
          .soft(item.itemScroll, `${item.text} fits its item (${JSON.stringify(item)})`)
          .toBeLessThanOrEqual(item.itemClient);
        expect
          .soft(item.labelLeft, `${item.text} starts inside its item`)
          .toBeGreaterThanOrEqual(item.itemLeft - 0.5);
        expect
          .soft(item.labelRight, `${item.text} ends inside its item`)
          .toBeLessThanOrEqual(item.itemRight + 0.5);
        expect
          .soft(item.itemScrollHeight, `${item.text} is not cut off vertically`)
          .toBeLessThanOrEqual(item.itemClientHeight);
        expect
          .soft(item.labelTop, `${item.text} starts below its item's top`)
          .toBeGreaterThanOrEqual(item.itemTop - 0.5);
        expect
          .soft(item.labelBottom, `${item.text} ends above its item's bottom`)
          .toBeLessThanOrEqual(item.itemBottom + 0.5);
        expect
          .soft(item.itemBottom, `${item.text} stays inside the navigation`)
          .toBeLessThanOrEqual(item.navBottom + 0.5);
        expect
          .soft(item.navBottom, "the navigation stays inside the window")
          .toBeLessThanOrEqual(item.windowHeight + 0.5);
        expect.soft(item.ellipsis).not.toBe("ellipsis");
        expect.soft(item.text ?? "").not.toContain("…");
      }
      // Labels sit side by side: no two items overlap.
      for (const [index, item] of measured.entries()) {
        const next = measured[index + 1];
        if (viewport.width === PHONE.width && next !== undefined) {
          expect
            .soft(item.labelRight, `${item.text} stays clear of ${next.text}`)
            .toBeLessThanOrEqual(next.labelLeft + 0.5);
        }
      }
      if (viewport.width === PHONE.width) {
        await expectBreaksAtHyphens(page);
      }
      await expectNoSideScroll(page);
    });
  }
});

/** One rendered line of a label: its text, and the character that ends it in the source. */
interface RenderedLine {
  /** The line's characters, soft hyphens included. */
  text: string;
  /** The last source character placed on this line. */
  last: string;
  /** The first source character of the next line, or "" on the last line. */
  next: string;
}

/**
 * Checks, line by line, that every phone label breaks only at a space or at a
 * soft hyphen (where the browser draws "-"), never in the middle of a word
 * (maintainer ruling on Q13). Lines are read from the label's text node,
 * character by character, grouped by the top of each character's box.
 */
async function expectBreaksAtHyphens(page: Page): Promise<void> {
  const labels = await navItems(page, "Main navigation").evaluateAll((items) =>
    items.map((item) => {
      const span = item.querySelector("span");
      const node = span?.firstChild;
      const lines: { text: string; last: string; next: string }[] = [];
      if (node === null || node === undefined || node.nodeType !== Node.TEXT_NODE) {
        return { name: item.getAttribute("aria-label") ?? "", lines };
      }
      const text = node.textContent ?? "";
      const range = document.createRange();
      let top: number | null = null;
      let current = "";
      for (let index = 0; index < text.length; index += 1) {
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        // A character at a line start can also report an empty box at the end of the
        // line before; only a box with width shows where it is drawn.
        const rect = Array.from(range.getClientRects())
          .filter((box) => box.width > 0 && box.height > 0)
          .at(-1);
        const char = text.charAt(index);
        if (rect !== undefined && top !== null && rect.top > top + 1) {
          lines.push({ text: current, last: current.at(-1) ?? "", next: char });
          current = "";
        }
        if (rect !== undefined && (top === null || rect.top > top + 1)) {
          top = rect.top;
        }
        current += char;
      }
      lines.push({ text: current, last: current.at(-1) ?? "", next: "" });
      return { name: item.getAttribute("aria-label") ?? "", lines };
    }),
  );
  await test.info().attach("phone-label-lines", {
    body: JSON.stringify(labels, null, 2),
    contentType: "application/json",
  });
  for (const label of labels) {
    const lines: RenderedLine[] = label.lines;
    for (const line of lines.slice(0, -1)) {
      expect
        .soft(
          line.last === "\u00AD" || line.last === " " || line.next === " ",
          `${label.name}: the line ${JSON.stringify(line.text)} ends at a space or a soft hyphen`,
        )
        .toBe(true);
    }
  }
  const shot = await mainNav(page, "Main navigation").screenshot({
    path: test.info().outputPath("main-navigation-375px-shy.png"),
  });
  await test.info().attach("main-navigation-375px-shy", { body: shot, contentType: "image/png" });
}
