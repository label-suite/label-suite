/**
 * The gallery's 無權限與找不到 section (component-gallery ADDED
 * 「展示頁展示無權限與找不到的樣本」; design D8): three BlockedScreen samples
 * with level-two titles, one way back each, and no focus taken on arrival.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderGallery } from "./render-gallery";
import { blockedLongIdentifier, blockedSampleIdentifier } from "./variant-catalog";

function section(): HTMLElement {
  return screen.getByRole("region", { name: "無權限與找不到" });
}

function sample(kind: string): HTMLElement {
  const item = section().querySelector<HTMLElement>(
    `[data-gallery-item="blocked-screen:kind:${kind}"]`,
  );
  if (item === null) {
    throw new Error(`no blocked-screen sample for kind ${kind}`);
  }
  return item;
}

describe("gallery 無權限與找不到 section", () => {
  it("shows the three samples in order, counted 樣本 × 3, with level-two titles", () => {
    renderGallery();

    const kinds = Array.from(section().querySelectorAll("[data-gallery-item]"), (item) =>
      item.getAttribute("data-gallery-item"),
    );
    expect(kinds).toEqual([
      "blocked-screen:kind:notFound",
      "blocked-screen:kind:denied",
      "blocked-screen:kind:longIdentifier",
    ]);
    expect(within(section()).getByText("樣本 × 3")).toBeVisible();
    expect(within(sample("notFound")).getByRole("heading", { level: 2 })).toHaveTextContent(
      "找不到這個任務",
    );
    expect(within(sample("denied")).getByRole("heading", { level: 2 })).toHaveTextContent(
      "無權限檢視此任務",
    );
    expect(within(sample("longIdentifier")).getByRole("heading", { level: 2 })).toHaveTextContent(
      "找不到這個任務",
    );
    expect(sample("notFound").querySelector("[data-kind]")).toHaveAttribute(
      "data-kind",
      "notFound",
    );
    expect(sample("denied").querySelector("[data-kind]")).toHaveAttribute("data-kind", "denied");
  });

  it("puts the sample identifiers in the descriptions, the long one in full", () => {
    renderGallery();

    expect(sample("notFound")).toHaveTextContent(
      `任務代碼 ${blockedSampleIdentifier} 不存在，請確認網址或回到儀表板重新選擇任務。`,
    );
    expect(sample("denied")).toHaveTextContent(
      `你目前無權限檢視任務代碼 ${blockedSampleIdentifier}，請回到儀表板或聯絡管理員。`,
    );
    expect(blockedSampleIdentifier).toBe("demo-task-001");
    expect(blockedLongIdentifier).toHaveLength(300);
    expect(blockedLongIdentifier).toMatch(/^[A-Za-z0-9-]+$/);
    expect(sample("longIdentifier").querySelector("bdi")?.textContent).toBe(blockedLongIdentifier);
  });

  it("gives each sample exactly one link, 回儀表板 to /dashboard/dashboard", () => {
    renderGallery();

    for (const kind of ["notFound", "denied", "longIdentifier"]) {
      const links = within(sample(kind)).getAllByRole("link");
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAccessibleName("回儀表板");
      expect(links[0]).toHaveAttribute("href", "/dashboard/dashboard");
    }
  });

  it("does not move focus to any sample title when the gallery opens", () => {
    renderGallery();

    for (const kind of ["notFound", "denied", "longIdentifier"]) {
      expect(within(sample(kind)).getByRole("heading", { level: 2 })).not.toHaveFocus();
    }
    expect(document.body).toHaveFocus();
  });
});
