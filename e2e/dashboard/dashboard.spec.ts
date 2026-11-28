/**
 * The dashboard /dashboard/dashboard, drawn in the signed-in shell: what the
 * existing suites need once the temporary landing page is gone (dashboard-shell
 * tasks 7.2). Arrival is judged by the dashboard header. Spec login-session
 * 「從這一台登出」 (signing out from the sidebar), frontend-i18n 「切換後的語言
 * 跨頁沿用」, and the browser-side checks of the acceptance (requests,
 * credentials, no token in the page). Real backend and Vite dev server
 * (login-auth-guard acceptance).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import type { BrowserContext, Page, Request } from "@playwright/test";

import { createAccount, sessionsOf, type TestAccount } from "../shared/accounts.ts";
import { okEnvelope } from "../shared/api-stubs.ts";
import { expect, test } from "../shared/fixtures/index.ts";
import { E2E_DIR } from "../shared/run-paths.ts";

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
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("banner").getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page).toHaveTitle("Label Suite — Dashboard");
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
  await expect(pageB.getByRole("heading", { level: 1, name: "儀表板", exact: true })).toBeVisible();
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

/*
 * ── dashboard-shell acceptance (design D10; tasks §Workflow follow-up) ──
 *
 * The Scenarios of spec `dashboard` that a real browser can reach in this
 * change: the two reachable layouts (a platform member with no task role, and
 * a system administrator), the header, the cards' links, widths, keyboard,
 * role colours per theme, and the one request. The loading, error and retry
 * states cannot be reached in a browser until #766 (clarification Q1, Q11);
 * the component tests cover them. A system role outside the contract cannot
 * be stored (database constraint), so its session answer is stubbed
 * (clarification T-3); every other request goes to the real backend.
 */

const PHONE = { width: 375, height: 667 };
const TABLET = { width: 820, height: 1180 };
const DESKTOP = { width: 1280, height: 800 };
const BLOCKED_ANNOTATION = "你目前在任何任務都沒有標記或審核角色，所以還不能進入標記作業。";
const CARD_HREFS = [
  "/task-management/task-list",
  "/annotation/annotation-list?entry=nav&role=annotator",
  "/annotation/annotation-list?entry=nav&role=reviewer",
];
const CARD_CTAS = ["開始建立任務", "開始標記", "開始審核"];
/** Field and parameter names that would mean an answer or a test-set marker reached the page. */
const ANSWER_NAMES = /answer|groundTruth|ground_truth|gold|isTest|is_test/i;
/** Parameter names the card links must not carry (spec dashboard, Q3). */
const TASK_PARAMS = ["task", "task_id", "task_type", "output_type", "view"];

/** Signs in an account of `role` and waits for the dashboard header. */
async function signInAs(page: Page, role: "user" | "super_admin"): Promise<TestAccount> {
  const account = createAccount(role === "super_admin" ? { name: "管理員", role } : {});
  await signIn(page, account);
  await expect(header(page)).toBeVisible();
  return account;
}

/** The dashboard header: a region named by its h1. */
function header(page: Page) {
  return page.getByRole("region", { name: "儀表板", exact: true });
}

/** Block A of the system administrator's layout. */
function statsBlock(page: Page, name = "平台使用者統計") {
  return page.getByRole("region", { name, exact: true });
}

/** The layout of a platform member with no task role. */
function entrySection(page: Page, name = "開始你的第一個工作流程") {
  return page.getByRole("region", { name, exact: true });
}

/** The bounding box, failing the test when the element has none. */
async function boxOf(locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  expect(box, "the element has a box").not.toBeNull();
  return box ?? { x: 0, y: 0, width: 0, height: 0 };
}

/**
 * From now on every document of the page records the URLs the app pushes or
 * replaces into history, so a test can read the first place a click went to
 * even when the router redirects straight on.
 */
async function recordHistory(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.defineProperty(window, "__historyLog", { value: seen });
    for (const method of ["pushState", "replaceState"] as const) {
      const original = history[method].bind(history);
      history[method] = (data: unknown, unused: string, url?: string | URL | null) => {
        if (url !== undefined && url !== null) {
          const resolved = new URL(String(url), window.location.href);
          seen.push(`${resolved.pathname}${resolved.search}`);
        }
        original(data, unused, url);
      };
    }
  });
}

/** Empties the history log and returns a reader for it. */
async function resetHistory(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    (window as unknown as { __historyLog: string[] }).__historyLog.length = 0;
  });
  return () =>
    page.evaluate(() => [...(window as unknown as { __historyLog: string[] }).__historyLog]);
}

/** The document is no wider than the window. */
async function expectNoSideScroll(page: Page, label: string): Promise<void> {
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    window: window.innerWidth,
  }));
  expect(widths.document, label).toBeLessThanOrEqual(widths.window);
}

/** WCAG relative luminance of a computed `rgb()`/`rgba()` colour. */
function luminance(css: string): number {
  const parts =
    css
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number) ?? [];
  expect(parts, `${css} is an rgb colour`).toHaveLength(3);
  const [r, g, b] = parts.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two computed colours. */
function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** A palette literal (#RRGGBB) as the computed style writes it. */
function rgbOf(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${String((value >> 16) & 255)}, ${String((value >> 8) & 255)}, ${String(value & 255)})`;
}

/** Reads `--name` from the light (`:root`) or dark block of data-palette.css. */
function paletteValue(name: string, block: "light" | "dark"): string {
  const css = readFileSync(
    path.join(E2E_DIR, "..", "design", "prototype", "assets", "data-palette.css"),
    "utf8",
  );
  const marker = block === "light" ? ":root" : 'html[data-theme="dark"]';
  const start = css.indexOf(`${marker} {`);
  expect(start, `${marker} block exists`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("}", start));
  const match = body.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`));
  expect(match, `${name} in ${marker}`).not.toBeNull();
  return match?.[1] ?? "";
}

test.describe("acceptance: layouts and copy", () => {
  test("沒有任務角色的人拿到行動入口 / 行動入口卡文案與步驟 / 頁首 / 網址參數不能指定版面", async ({
    page,
  }) => {
    await signInAs(page, "user");
    await expect(page).toHaveTitle("Label Suite — 儀表板");

    // Header first in the content area: h1, then the subtitle.
    const firstInMain = page.getByRole("main").locator("section").first();
    await expect(firstInMain).toHaveAccessibleName("儀表板");
    await expect(header(page).getByRole("heading", { level: 1 })).toHaveText("儀表板");
    await expect(header(page)).toContainText("掌握任務進度與團隊協作狀態");
    await expect(
      header(page).locator("a, button, input, select, textarea, [tabindex]"),
    ).toHaveCount(0);

    const section = entrySection(page);
    await expect(section).toBeVisible();
    await expect(section).toContainText("從三個行動入口開始，快速達成第一個可交付成果");
    expect((await boxOf(header(page))).y).toBeLessThan((await boxOf(section)).y);
    const cards = section.getByRole("article");
    await expect(cards).toHaveCount(3);
    const expected = [
      {
        title: "建立標記專案",
        description: "上傳資料、設定標籤規則、指派團隊成員。",
        steps: ["建立任務", "上傳資料", "指派人員"],
      },
      {
        title: "進行資料標記",
        description: "查看待辦任務，完成資料標記並送出結果。",
        steps: ["開啟任務", "進行標記", "送出標記"],
      },
      {
        title: "進行標記審核",
        description: "逐標記員獨立審核，直接修正結果，歧異交付仲裁。",
        steps: ["審核標記", "修正或仲裁", "完成審核"],
      },
    ];
    for (const [index, card] of expected.entries()) {
      const article = cards.nth(index);
      await expect(article).toHaveAccessibleName(card.title);
      await expect(article.getByRole("heading", { level: 3 })).toHaveText(card.title);
      await expect(article).toContainText(card.description);
      const items = article.locator("ol > li");
      await expect(items).toHaveCount(3);
      for (const [step, name] of card.steps.entries()) {
        await expect(items.nth(step).locator("strong")).toHaveText(name);
      }
      const link = article.getByRole("link");
      await expect(link).toHaveText(CARD_CTAS[index] ?? "");
      await expect(link).toHaveAttribute("href", CARD_HREFS[index] ?? "");
    }
    await expect(cards.nth(1).locator("ol > li").nth(2)).toContainText(
      "自我檢查標記一致性，送出標記結果",
    );
    await expect(page.getByText("平台使用者統計")).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);

    // The URL cannot pick a layout.
    await page.goto(`${LANDING_PATH}?scenario=admin&view=empty`);
    await expect(entrySection(page).getByRole("article")).toHaveCount(3);
    await expect(page.getByText("平台使用者統計")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("combobox")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("tab")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("radio")).toHaveCount(0);
  });

  test("行動入口卡切換語言", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signInAs(page, "user");
    const before = await page.evaluate(() => performance.getEntriesByType("navigation").length);
    const marker = await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
      return true;
    });
    expect(marker).toBe(true);

    await page.getByRole("banner").getByTestId("lang-toggle").click();

    const section = entrySection(page, "Start Your First Workflow");
    await expect(section).toBeVisible();
    await expect(section).toContainText(
      "Use these three action entry points to reach your first success quickly.",
    );
    const cards = section.getByRole("article");
    await expect(cards.getByRole("heading", { level: 3 })).toHaveText([
      "Create Labeling Project",
      "Conduct Data Labeling",
      "Conduct Labeling Review",
    ]);
    await expect(cards.getByRole("link")).toHaveText([
      "Start Creating Task",
      "Start Annotating",
      "Start Reviewing",
    ]);
    await expect(cards.locator("ol > li strong")).toHaveText([
      "Create Task",
      "Upload Data",
      "Assign Team",
      "Open Task",
      "Annotate",
      "Submit Annotation",
      "Review Annotations",
      "Correct or Arbitrate",
      "Complete Review",
    ]);
    expect(await section.innerText()).not.toMatch(/[㐀-鿿]/);
    expect(
      await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
    ).toBe(true);
    expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(
      before,
    );
    await expect(page).toHaveTitle("Label Suite — Dashboard");
  });

  test("系統管理員的平台使用者統計 / 示範值標示出現在每一種版面 / 頁面內容隨語言一起換", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await signInAs(page, "super_admin");

    const block = statsBlock(page);
    await expect(block).toBeVisible();
    await expect(block).toContainText("系統概況");
    const metrics = block.locator('[data-slot="metric"]');
    await expect(metrics.locator("span")).toHaveText(["總用戶", "專案負責人", "標記員", "審核員"]);
    await expect(metrics.locator("strong")).toHaveText(["0 人", "0 人", "0 人", "0 人"]);
    for (const metric of await metrics.all()) {
      const label = await boxOf(metric.locator("span"));
      const value = await boxOf(metric.locator("strong"));
      expect(label.y + label.height).toBeLessThanOrEqual(value.y);
    }
    await expect(block.locator("a, button, input, select, textarea, [tabindex='0']")).toHaveCount(
      0,
    );
    const note = block.getByText("示範用靜態值：這些指標卡尚未接上實際資料，算法另案定義。", {
      exact: true,
    });
    await expect(note).toBeVisible();
    expect(await note.getAttribute("role")).toBeNull();
    expect((await boxOf(note)).y).toBeGreaterThanOrEqual(
      (await boxOf(metrics.last())).y + (await boxOf(metrics.last())).height,
    );
    await expect(page.getByText("開始你的第一個工作流程")).toHaveCount(0);
    await expect(page.getByText("儀表板載入失敗")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "載入中" })).toHaveCount(0);

    await page.getByRole("banner").getByTestId("lang-toggle").click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
    await expect(page.getByRole("main")).toContainText(
      "Track task progress and team collaboration at a glance",
    );
    const english = statsBlock(page, "Platform Stats");
    await expect(english).toContainText("System overview");
    await expect(english.locator('[data-slot="metric"] span')).toHaveText([
      "Total Users",
      "Project Leaders",
      "Annotators",
      "Reviewers",
    ]);
    await expect(english.locator('[data-slot="metric"] strong')).toHaveText([
      "0 Users",
      "0 Leaders",
      "0 Annotators",
      "0 Reviewers",
    ]);
    await expect(
      english.getByText(
        "Demo static values: these metric cards are not yet connected to real data; how they are calculated is defined separately.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page).toHaveTitle("Label Suite — Dashboard");
  });
});

test.describe("acceptance: links", () => {
  test("三張卡的按鈕都走到模組入口頁 / 從儀表板行動入口卡進入不被擋下", async ({ page }) => {
    await recordHistory(page);
    await signInAs(page, "user");

    const links = entrySection(page).getByRole("link");
    for (const [index, href] of CARD_HREFS.entries()) {
      const link = links.nth(index);
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toBeEnabled();
      expect(await link.getAttribute("aria-disabled")).toBeNull();
      const params = new URL(href, "https://example.invalid").searchParams;
      for (const name of TASK_PARAMS) {
        expect(params.has(name), `${href} has no ${name}`).toBe(false);
      }
    }

    for (const name of ["開始標記", "開始審核"]) {
      const href = await page.getByRole("link", { name }).getAttribute("href");
      const read = await resetHistory(page);
      await page.getByRole("link", { name }).click();
      // The entry pages do not exist yet (#773), so the router ends on the dashboard again.
      await expect.poll(async () => (await read())[0]).toBe(href);
      await expect(page).toHaveURL(pathIs(LANDING_PATH));
      await expect(header(page)).toBeVisible();
      await expect(entrySection(page)).toBeVisible();
      await expect(page.getByText(BLOCKED_ANNOTATION)).toHaveCount(0);
    }
  });
});

test.describe("acceptance: widths", () => {
  test("窄螢幕指標卡排兩欄", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signInAs(page, "super_admin");
    const metrics = statsBlock(page).locator('[data-slot="metric"]');
    const [total, leaders, annotators, reviewers] = await Promise.all(
      [0, 1, 2, 3].map((index) => boxOf(metrics.nth(index))),
    );
    if (!total || !leaders || !annotators || !reviewers) throw new Error("four metrics");
    expect(leaders.y).toBe(total.y);
    expect(leaders.x).toBeGreaterThan(total.x);
    expect(annotators.y).toBeGreaterThanOrEqual(total.y + total.height);
    expect(reviewers.y).toBe(annotators.y);
    expect(annotators.x).toBe(total.x);
    await expectNoSideScroll(page, "admin at 375px");
  });

  test("側欄收合時長標籤仍可讀", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signInAs(page, "super_admin");
    await page.getByRole("button", { name: "收合側欄" }).click();
    await expect(page.getByRole("button", { name: "展開側欄" })).toBeVisible();
    const sidebar = page.getByRole("banner");
    await expect.poll(async () => (await boxOf(sidebar)).width).toBe(88);

    const metrics = statsBlock(page).locator('[data-slot="metric"]');
    for (const metric of await metrics.all()) {
      expect((await boxOf(metric)).width).toBeGreaterThanOrEqual(150);
    }
    const label = metrics.nth(1).locator("span");
    await expect(label).toHaveText("專案負責人");
    const layout = await label.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
      return {
        lines: tops.size,
        overflow: element.scrollWidth > element.clientWidth,
        ellipsis: getComputedStyle(element).textOverflow,
      };
    });
    expect(layout.lines).toBe(1);
    expect(layout.overflow).toBe(false);
    expect(layout.ellipsis).not.toBe("ellipsis");
  });

  for (const role of ["user", "super_admin"] as const) {
    test(`任何寬度都不需左右滑動 (${role})`, async ({ page }) => {
      await signInAs(page, role);
      for (const viewport of [PHONE, TABLET, DESKTOP]) {
        await page.setViewportSize(viewport);
        await expect(header(page)).toBeVisible();
        await expectNoSideScroll(page, `${role} at ${String(viewport.width)}px`);
      }

      await page.setViewportSize(PHONE);
      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      const topBar = await boxOf(
        page.getByRole("link", { name: "Label Suite 首頁" }).locator("xpath=.."),
      );
      const bottomNav = await boxOf(page.getByRole("navigation", { name: "主導覽" }));
      const last = await page.getByRole("main").evaluate((main) => {
        let node: Element = main;
        while (node.lastElementChild !== null) {
          node = node.lastElementChild;
        }
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, text: node.textContent };
      });
      expect(
        last.top,
        `last element (${last.text ?? ""}) below the top bar`,
      ).toBeGreaterThanOrEqual(topBar.y + topBar.height);
      expect(
        last.bottom,
        `last element (${last.text ?? ""}) above the bottom nav`,
      ).toBeLessThanOrEqual(bottomNav.y);
    });
  }
});

test.describe("acceptance: keyboard", () => {
  test("鍵盤可以走完整頁 (focus ring is a solid 2px outline)", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await recordHistory(page);
    await signInAs(page, "user");

    // Leave the sidebar: its last control is 登出; the next Tab enters the content area.
    await page.getByRole("banner").getByRole("button", { name: "登出" }).focus();
    for (const [index, name] of CARD_CTAS.entries()) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(focused).toHaveAccessibleName(name);
      await expect(focused).toHaveAttribute("href", CARD_HREFS[index] ?? "");
      // Button carries transition-all, so the outline animates in from the initial
      // `medium` (3px) width; wait for it to settle instead of reading mid-transition.
      const readRing = () =>
        focused.evaluate((element) => {
          const style = getComputedStyle(element);
          const probe = document.createElement("span");
          probe.style.color = "var(--ring)";
          document.body.append(probe);
          const ringColour = getComputedStyle(probe).color;
          probe.remove();
          return {
            visible: element.matches(":focus-visible"),
            style: style.outlineStyle,
            width: style.outlineWidth,
            offset: style.outlineOffset,
            colourIsRing: style.outlineColor === ringColour,
          };
        });
      await expect
        .poll(readRing, { message: `${name} draws a solid 2px outline in --ring, 2px out` })
        .toEqual({
          visible: true,
          style: "solid",
          width: "2px",
          offset: "2px",
          colourIsRing: true,
        });
    }

    for (const [index, name] of CARD_CTAS.entries()) {
      const read = await resetHistory(page);
      await page.getByRole("link", { name }).focus();
      await page.keyboard.press("Enter");
      await expect.poll(async () => (await read())[0]).toBe(CARD_HREFS[index]);
      await expect(header(page)).toBeVisible();
      await expect(entrySection(page)).toBeVisible();
    }
  });
});

test.describe("acceptance: role colours", () => {
  test("角色色隨主題取淺深兩組 / 角色色前景對底色至少 3:1", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signInAs(page, "user");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    const circles = (title: string) =>
      entrySection(page)
        .getByRole("article", { name: title })
        .locator("div.rounded-\\(--radius-full\\)");
    const cardB = circles("進行資料標記").first();

    const read = async () => {
      const results: { name: string; ratio: number }[] = [];
      for (const title of ["建立標記專案", "進行資料標記", "進行標記審核"]) {
        const all = await circles(title).all();
        expect(all.length, `${title} has the role circle and three step circles`).toBe(4);
        for (const [index, circle] of all.entries()) {
          const colours = await circle.evaluate((element) => {
            const style = getComputedStyle(element);
            return { fg: style.color, bg: style.backgroundColor };
          });
          results.push({
            name: `${title} circle ${String(index)}`,
            ratio: contrast(colours.fg, colours.bg),
          });
        }
      }
      return results;
    };

    const lightBg = await cardB.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(lightBg).toBe(rgbOf(paletteValue("--data-role-violet-bg", "light")));
    for (const { name, ratio } of await read()) {
      expect(ratio, `light: ${name}`).toBeGreaterThanOrEqual(3);
    }

    await page.getByRole("banner").getByRole("button", { name: "切換為深色模式" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect
      .poll(() => cardB.evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe(rgbOf(paletteValue("--data-role-violet-bg", "dark")));
    for (const { name, ratio } of await read()) {
      expect(ratio, `dark: ${name}`).toBeGreaterThanOrEqual(3);
    }

    // A data colour that points at a token resolves (design-token-mapping).
    await page.getByRole("banner").getByRole("button", { name: "切換為淺色模式" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const emerald = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        fg: style.getPropertyValue("--data-role-emerald-fg").trim(),
        cta: style.getPropertyValue("--color-cta-hover").trim(),
      };
    });
    expect(emerald.fg).not.toBe("");
    expect(emerald.fg.toLowerCase()).toBe(emerald.cta.toLowerCase());
  });
});

test.describe("acceptance: requests and answers", () => {
  for (const role of ["user", "super_admin"] as const) {
    test(`儀表板不出現標準答案 / the only request is GET current-session (${role})`, async ({
      page,
    }) => {
      const account = await signInAs(page, role);
      const finished: Request[] = [];
      const failures: string[] = [];
      const consoleErrors: string[] = [];
      page.on("requestfinished", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/")) finished.push(request);
      });
      page.on("requestfailed", (request) => {
        // Dev-mode StrictMode aborts the first copy of each mount query (design D6).
        if (request.failure()?.errorText !== "net::ERR_ABORTED") {
          failures.push(`${request.method()} ${request.url()}`);
        }
      });
      page.on("pageerror", (error) => consoleErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });

      await page.goto(LANDING_PATH);
      await expect(header(page)).toBeVisible();
      await expect(role === "user" ? entrySection(page) : statsBlock(page)).toBeVisible();
      // Let every request the page started be reported: one more round trip to its own origin.
      await page.evaluate(() => fetch("/theme-init.js", { cache: "no-store" }));

      expect(
        finished.map((request) => `${request.method()} ${new URL(request.url()).pathname}`),
      ).toEqual([`GET ${CURRENT}`]);
      const request = finished[0];
      if (!request) throw new Error("the session query finished");
      expect(new URL(request.url()).search).toBe("");
      expect((await request.allHeaders()).cookie ?? "").toContain("__Host-ls_at=");
      const response = await request.response();
      expect(response?.status()).toBe(200);
      const body = (await response?.json()) as { data: { user: Record<string, unknown> } };
      expect(Object.keys(body.data)).toEqual(["user"]);
      expect(Object.keys(body.data.user).sort()).toEqual(["email", "id", "name", "role"]);
      expect(body.data.user.email).toBe(account.email);
      expect(body.data.user.role).toBe(role);
      expect(JSON.stringify(body)).not.toMatch(ANSWER_NAMES);
      expect(JSON.stringify(body)).not.toMatch(/task|dataset|item/i);

      const text = await page.locator("body").innerText();
      expect(text).not.toMatch(ANSWER_NAMES);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href") ?? ""));
      for (const href of hrefs) {
        expect(href, href).not.toMatch(ANSWER_NAMES);
        const params = new URL(href, "https://example.invalid").searchParams;
        for (const name of ["task", "task_id", "taskId", "dataset", "dataset_id", "item_id"]) {
          expect(params.has(name), `${href} has no ${name}`).toBe(false);
        }
      }
      expect(failures).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }
});

test.describe("acceptance: a system role outside the contract (session answer stubbed, T-3)", () => {
  /** Answers every session query with a valid envelope whose role is `guest`. */
  async function stubGuest(page: Page): Promise<() => { gets: number; deletes: number }> {
    let gets = 0;
    let deletes = 0;
    await page.route(`**${CURRENT}`, async (route) => {
      if (route.request().method() === "DELETE") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: okEnvelope({
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            name: "訪客",
            email: "guest@example.com",
            role: "guest",
          },
        }),
      });
    });
    page.on("requestfinished", (request) => {
      if (new URL(request.url()).pathname !== CURRENT) return;
      if (request.method() === "GET") gets += 1;
      if (request.method() === "DELETE") deletes += 1;
    });
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).pathname === CURRENT && request.method() === "DELETE")
        deletes += 1;
    });
    return () => ({ gets, deletes });
  }

  test("角色無效時導向登入頁", async ({ page }) => {
    const counts = await stubGuest(page);
    const seenHeading: boolean[] = [];
    await page.exposeFunction("__sawDashboard", (seen: boolean) => {
      seenHeading.push(seen);
    });
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const h1 = document.querySelector("h1");
        if (h1?.textContent === "儀表板") {
          void (
            window as unknown as { __sawDashboard: (seen: boolean) => Promise<void> }
          ).__sawDashboard(true);
        }
      }).observe(document, { childList: true, subtree: true, characterData: true });
    });
    await page.goto("about:blank");
    await page.goto(LANDING_PATH);
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("region", { name: "登入", exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.evaluate(() => fetch("/theme-init.js", { cache: "no-store" }));
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    expect(seenHeading).toEqual([]);
    expect(counts()).toEqual({ gets: 1, deletes: 0 });
    await page.goBack();
    expect(new URL(page.url()).pathname).not.toBe(LANDING_PATH);
  });

  test("角色無效時登入頁不被帶走", async ({ page }) => {
    const counts = await stubGuest(page);
    await page.goto(LOGIN_PATH);
    await expect(page.getByRole("region", { name: "登入", exact: true })).toBeVisible();
    await page.evaluate(() => fetch("/theme-init.js", { cache: "no-store" }));
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(counts()).toEqual({ gets: 1, deletes: 0 });
  });

  test("角色無效時根路徑導向登入頁", async ({ page }) => {
    const counts = await stubGuest(page);
    await page.goto("/");
    await expect(page).toHaveURL(pathIs(LOGIN_PATH));
    await expect(page.getByRole("region", { name: "登入", exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(counts().deletes).toBe(0);
  });
});
