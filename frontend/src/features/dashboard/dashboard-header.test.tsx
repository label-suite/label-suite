/**
 * The dashboard header (spec dashboard Requirement「每一種版面最上方都有同一個頁首」;
 * ui-design.md §元件樹): one h1 and its subtitle, in a region named by the h1.
 */
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { changeInterfaceLanguage } from "@/lib/i18n";

import { DashboardHeader } from "./dashboard-header";

describe("DashboardHeader", () => {
  it("shows the level-one title and its subtitle, in that order", () => {
    render(<DashboardHeader />);

    const title = screen.getByRole("heading", { level: 1, name: "儀表板" });
    const subtitle = screen.getByText("掌握任務進度與團隊協作狀態");
    expect(title.compareDocumentPosition(subtitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("is a region labelled by its h1", () => {
    render(<DashboardHeader />);

    const region = screen.getByRole("region", { name: "儀表板" });
    expect(region).toContainElement(screen.getByRole("heading", { level: 1 }));
  });

  it("has nothing focusable", () => {
    const { container } = render(<DashboardHeader />);

    expect(container.querySelectorAll("a, button, [tabindex]")).toHaveLength(0);
  });

  it("follows the interface language", async () => {
    render(<DashboardHeader />);

    await act(async () => {
      await changeInterfaceLanguage("en");
    });

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(
      screen.getByText("Track task progress and team collaboration at a glance"),
    ).toBeInTheDocument();
  });
});
