/**
 * Block A of the system administrator's layout (spec dashboard Scenario「系統管理員
 * 的平台使用者統計」「示範值標示出現在每一種版面」「頁面內容隨語言一起換」, block A
 * part; design D6; clarification Q2, Q5).
 */
import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { changeInterfaceLanguage } from "@/lib/i18n";

import { PlatformUserStats } from "./platform-user-stats";

const DEMO_NOTE_ZH = "示範用靜態值：這些指標卡尚未接上實際資料，算法另案定義。";
const DEMO_NOTE_EN =
  "Demo static values: these metric cards are not yet connected to real data; how they are calculated is defined separately.";

/** The label and value of every Metric, in order. */
function metrics(): { label: string; value: string }[] {
  return Array.from(document.querySelectorAll('[data-slot="metric"]')).map((metric) => ({
    label: metric.querySelector("span")?.textContent ?? "",
    value: metric.querySelector("strong")?.textContent ?? "",
  }));
}

describe("PlatformUserStats", () => {
  it("shows the title, the subtitle and four zero metrics in Chinese", () => {
    render(<PlatformUserStats />);

    const region = screen.getByRole("region", { name: "平台使用者統計" });
    expect(within(region).getByRole("heading", { level: 2 })).toHaveTextContent("平台使用者統計");
    expect(within(region).getByText("系統概況")).toBeInTheDocument();
    expect(metrics()).toEqual([
      { label: "總用戶", value: "0 人" },
      { label: "專案負責人", value: "0 人" },
      { label: "標記員", value: "0 人" },
      { label: "審核員", value: "0 人" },
    ]);
  });

  it("puts the demo note as plain visible text in the same block, below the four metrics", () => {
    render(<PlatformUserStats />);

    const region = screen.getByRole("region", { name: "平台使用者統計" });
    const note = within(region).getByText(DEMO_NOTE_ZH);
    expect(note.tagName).toBe("P");
    expect(note).not.toHaveAttribute("role");
    expect(note).not.toHaveAttribute("aria-hidden");
    const lastMetric = Array.from(region.querySelectorAll('[data-slot="metric"]')).at(-1);
    expect(lastMetric).toBeDefined();
    expect(
      lastMetric && lastMetric.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("switches labels, values and the demo note to English, values keeping their order", async () => {
    render(<PlatformUserStats />);

    await act(async () => {
      await changeInterfaceLanguage("en");
    });

    const region = screen.getByRole("region", { name: "Platform Stats" });
    expect(within(region).getByText("System overview")).toBeInTheDocument();
    expect(metrics()).toEqual([
      { label: "Total Users", value: "0 Users" },
      { label: "Project Leaders", value: "0 Leaders" },
      { label: "Annotators", value: "0 Annotators" },
      { label: "Reviewers", value: "0 Reviewers" },
    ]);
    expect(within(region).getByText(DEMO_NOTE_EN)).toBeInTheDocument();
  });

  it("has no focusable control besides the programmatically focusable title", () => {
    render(<PlatformUserStats />);

    const region = screen.getByRole("region", { name: "平台使用者統計" });
    expect(region.querySelectorAll("a, button, input, select, textarea")).toHaveLength(0);
    const tabbable = Array.from(region.querySelectorAll("[tabindex]")).filter(
      (element) => element.getAttribute("tabindex") !== "-1",
    );
    expect(tabbable).toHaveLength(0);
  });

  it("focuses the title only when asked to on mount", () => {
    const { unmount } = render(<PlatformUserStats />);
    expect(screen.getByRole("heading", { level: 2 })).not.toHaveFocus();
    unmount();

    render(<PlatformUserStats focusOnMount />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();
  });

  it("lays the metrics out two-up on phones and auto-fit at 150px from 768px", () => {
    render(<PlatformUserStats />);

    const grid = document.querySelector('[data-slot="metric"]')?.parentElement;
    expect(grid).toHaveClass("grid-cols-2", "md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]");
    const card = document.querySelector('[data-slot="card"]');
    expect(card).toHaveClass("shadow-none");
    expect(card?.parentElement).toHaveClass("md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]");
  });
});
