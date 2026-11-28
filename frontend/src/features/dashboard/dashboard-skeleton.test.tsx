/**
 * The loading skeleton of the layout area (spec dashboard Scenario「讀取任務角色時
 * 顯示骨架」「骨架與錯誤畫面不帶任何資料」, component part; ui-design.md §元件樹,
 * §無障礙; design D7, D9).
 */
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { changeInterfaceLanguage } from "@/lib/i18n";

import { DashboardSkeleton } from "./dashboard-skeleton";

/** Metric's own label and value text, which a skeleton must never show. */
const METRIC_TEXT = ["總用戶", "專案負責人", "標記員", "審核員", "0 人"];

describe("DashboardSkeleton", () => {
  it("is a busy, politely announced region named 載入中", () => {
    render(<DashboardSkeleton />);

    const region = screen.getByRole("region", { name: "載入中" });
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("data-testid", "dashboard-skeleton");
  });

  it("is named Loading in English", async () => {
    await act(async () => {
      await changeInterfaceLanguage("en");
    });
    render(<DashboardSkeleton />);

    expect(screen.getByRole("region", { name: "Loading" })).toBeInTheDocument();
  });

  it("holds a programmatically focusable status hint outside the Tab order", () => {
    render(<DashboardSkeleton />);

    const hint = screen.getByText("載入中");
    expect(hint).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).not.toBe(hint);
  });

  it("moves focus to the status hint when asked to on mount", () => {
    render(<DashboardSkeleton focusOnMount />);

    expect(document.activeElement).toBe(screen.getByText("載入中"));
  });

  it("draws a block of four metric placeholders and a block of three rows", () => {
    render(<DashboardSkeleton />);

    const metrics = screen.getByTestId("dashboard-skeleton-metrics");
    const cells = Array.from(metrics.children);
    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      // Each cell is a label bar over a value bar, both Skeleton, and nothing else.
      const bars = Array.from(cell.children);
      expect(bars).toHaveLength(2);
      for (const bar of bars) {
        expect(bar).toHaveAttribute("data-slot", "skeleton");
        expect(bar).toHaveAttribute("data-animation", "shimmer");
      }
      expect(cell).toHaveTextContent("");
    }
    expect(Array.from(screen.getByTestId("dashboard-skeleton-rows").children)).toHaveLength(3);
  });

  it("uses no Metric and no text besides 載入中", () => {
    const { container } = render(<DashboardSkeleton />);

    expect(container.querySelector('[data-slot="metric"]')).toBeNull();
    for (const text of METRIC_TEXT) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(container).toHaveTextContent(/^載入中$/);
  });

  it("plays the shimmer on every bar, each hidden from assistive technology", () => {
    const { container } = render(<DashboardSkeleton />);

    const bars = container.querySelectorAll('[data-slot="skeleton"]');
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of Array.from(bars)) {
      expect(bar).toHaveAttribute("data-animation", "shimmer");
      expect(bar).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("frames both blocks in shadowless cards", () => {
    const { container } = render(<DashboardSkeleton />);

    const cards = container.querySelectorAll('[data-slot="card"]');
    expect(cards).toHaveLength(2);
    for (const card of Array.from(cards)) {
      expect(card).toHaveClass("shadow-none");
    }
  });
});
