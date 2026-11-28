/**
 * The error panel of the layout area (spec dashboard Scenario「讀取失敗顯示錯誤與
 * 重試」「骨架與錯誤畫面不帶任何資料」, component part; ui-design.md §元件樹,
 * §互動與鍵盤; design D9).
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { changeInterfaceLanguage } from "@/lib/i18n";

import { DashboardLoadError } from "./dashboard-load-error";

const TITLE = "儀表板載入失敗";
const DESCRIPTION = "無法載入任務成員資格資料，請稍後再試。";

describe("DashboardLoadError", () => {
  it("is an alert with the title, the description and a Retry button", () => {
    render(<DashboardLoadError onRetry={vi.fn()} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-testid", "dashboard-error-state");
    expect(alert).toHaveTextContent(TITLE);
    expect(alert).toHaveTextContent(DESCRIPTION);
    const retry = screen.getByRole("button", { name: "重試" });
    expect(alert).toContainElement(retry);
    expect(retry).toHaveAttribute("data-variant", "cta");
    expect(retry).toBeEnabled();
  });

  it("shows the three texts in English", async () => {
    await act(async () => {
      await changeInterfaceLanguage("en");
    });
    render(<DashboardLoadError onRetry={vi.fn()} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Failed to load dashboard");
    expect(alert).toHaveTextContent("Task membership data could not be loaded. Please try again.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it.each([["{Enter}"], [" "]])("calls onRetry when %j is pressed on Retry", async (key) => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<DashboardLoadError onRetry={onRetry} />);

    await user.tab();
    expect(screen.getByRole("button", { name: "重試" })).toHaveFocus();
    await user.keyboard(key);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows only its fixed copy: no error code, trace id or server message", () => {
    const { container } = render(<DashboardLoadError onRetry={vi.fn()} />);

    expect(container).toHaveTextContent(new RegExp(`^${TITLE}${DESCRIPTION}重試$`));
    expect(container.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(container.textContent).not.toMatch(/[A-Z]+_[A-Z_]+/);
  });

  it("draws a decorative icon inside a shadowless card", () => {
    const { container } = render(<DashboardLoadError onRetry={vi.fn()} />);

    const card = container.querySelector('[data-slot="card"]');
    expect(card).toHaveClass("shadow-none");
    const icon = card?.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("leaves focus alone by default and moves it to Retry when asked to on mount", () => {
    const { unmount } = render(<DashboardLoadError onRetry={vi.fn()} />);
    expect(screen.getByRole("button", { name: "重試" })).not.toHaveFocus();
    unmount();

    render(<DashboardLoadError onRetry={vi.fn()} focusOnMount />);
    expect(screen.getByRole("button", { name: "重試" })).toHaveFocus();
  });
});
