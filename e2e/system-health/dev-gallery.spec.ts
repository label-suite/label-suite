/**
 * The component gallery's 無權限與找不到 section in a real browser
 * (denied-and-not-found design D8): the screen-level half of
 * specs/denied-and-not-found-screens and the component-gallery scenarios that
 * jsdom cannot measure (wrapping, horizontal scroll). No product page draws
 * these screens yet, so the gallery is the entry point; it needs no sign-in
 * and sends no backend request. Samples are found by their
 * `data-gallery-item`, the gallery's test contract.
 */
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../shared/fixtures/index.ts";

const SECTION_NAME = "無權限與找不到";
const IDENTIFIER = "demo-task-001";
const BACK_LABEL = "回儀表板";
const BACK_HREF = "/dashboard/dashboard";

const SAMPLES = {
  notFound: {
    title: "找不到這個任務",
    description: `任務代碼 ${IDENTIFIER} 不存在，請確認網址或回到儀表板重新選擇任務。`,
  },
  denied: {
    title: "無權限檢視此任務",
    description: `你目前無權限檢視任務代碼 ${IDENTIFIER}，請回到儀表板或聯絡管理員。`,
  },
} as const;

/** Every request the page sends to the backend API, collected for the whole test. */
function recordApiRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/")) {
      requests.push(`${request.method()} ${request.url()}`);
    }
  });
  return requests;
}

function blockedSection(page: Page): Locator {
  return page.getByRole("region", { name: SECTION_NAME, exact: true });
}

function sample(page: Page, kind: "notFound" | "denied" | "longIdentifier"): Locator {
  return blockedSection(page).locator(`[data-gallery-item="blocked-screen:kind:${kind}"]`);
}

/** True when the element's content fits its own visible width (no horizontal scroll). */
async function fitsItsWidth(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element.scrollWidth <= element.clientWidth);
}

test.describe("元件展示頁的無權限與找不到", () => {
  test("找不到與無權限的樣本各有標題、說明與恰一個回儀表板的連結，結構相同", async ({ page }) => {
    const apiRequests = recordApiRequests(page);
    await page.goto("/dev/gallery#blocked");

    for (const kind of ["notFound", "denied"] as const) {
      const { title, description } = SAMPLES[kind];
      const screen = sample(page, kind).getByRole("region", { name: title });
      await expect(screen).toBeVisible();
      await expect(screen).toHaveAttribute("data-kind", kind);
      await expect(screen.getByRole("heading", { level: 2, name: title })).toBeVisible();
      await expect(screen.getByRole("heading")).toHaveCount(1);
      await expect(screen.getByRole("paragraph")).toHaveCount(1);
      await expect(screen.getByRole("paragraph")).toHaveText(description);
      await expect(screen.getByRole("link")).toHaveCount(1);
      const back = screen.getByRole("link", { name: BACK_LABEL, exact: true });
      await expect(back).toHaveAttribute("href", BACK_HREF);
      await expect(screen.getByRole("button")).toHaveCount(0);
    }
    expect(apiRequests).toEqual([]);
  });

  test("目錄有指向無權限與找不到的錨點，帶 aria-current", async ({ page }) => {
    const apiRequests = recordApiRequests(page);
    await page.goto("/dev/gallery#blocked");

    const nav = page.getByRole("navigation", { name: "元件目錄" });
    await expect(nav.getByRole("link")).toHaveCount(11);
    const link = nav.getByRole("link", { name: SECTION_NAME, exact: true });
    await expect(link).toHaveAttribute("href", "#blocked");
    await expect(link).toHaveAttribute("aria-current", "location");
    await expect(blockedSection(page)).toHaveAttribute("id", "blocked");
    expect(apiRequests).toEqual([]);
  });

  test("開啟展示頁不搶焦點", async ({ page }) => {
    const apiRequests = recordApiRequests(page);
    await page.goto("/dev/gallery");
    await expect(page.getByRole("heading", { level: 1, name: "元件展示" })).toBeVisible();
    await expect(sample(page, "longIdentifier")).toBeAttached();

    for (const kind of ["notFound", "denied", "longIdentifier"] as const) {
      await expect(sample(page, kind).getByRole("heading")).not.toBeFocused();
    }
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    expect(apiRequests).toEqual([]);
  });

  for (const width of [375, 1280]) {
    test(`長識別碼樣本在 ${width}px 寬時完整換行，不撐破樣本與區塊`, async ({ page }) => {
      const apiRequests = recordApiRequests(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/dev/gallery#blocked");

      const longSample = sample(page, "longIdentifier");
      const identifier = longSample.locator("bdi");
      await expect(identifier).toBeVisible();
      const text = await identifier.textContent();
      expect(text).toHaveLength(300);
      await expect(longSample.getByRole("paragraph")).toContainText(text ?? "");
      // Scoped to the sample and its section: the rest of the gallery at 375px
      // is outside this change.
      expect(await fitsItsWidth(longSample)).toBe(true);
      expect(await fitsItsWidth(blockedSection(page))).toBe(true);
      expect(apiRequests).toEqual([]);
    });
  }
});
