/**
 * The gallery's light/dark switch (design D8, clarification Q13): it only sets
 * <html data-theme>, defaults to light, stores nothing, and restores light
 * when the gallery unmounts.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "./index";
import { ThemeToggle } from "./theme-toggle";

function theme(): string | undefined {
  return document.documentElement.dataset.theme;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("ThemeToggle", () => {
  it("is a group named 主題 with a pressed light button by default", () => {
    render(<ThemeToggle />);

    const group = screen.getByRole("group", { name: "主題" });
    expect(within(group).getByRole("button", { name: "淺色" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getByRole("button", { name: "深色" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(theme()).toBe("light");
  });

  it("switches to dark and back without writing any browser storage", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "深色" }));

    expect(theme()).toBe("dark");
    expect(screen.getByRole("button", { name: "深色" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "淺色" })).toHaveAttribute("aria-pressed", "false");
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "淺色" }));
    expect(theme()).toBe("light");
  });

  it("starts light again after a reload", async () => {
    const user = userEvent.setup();
    const first = render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "深色" }));
    expect(theme()).toBe("dark");

    first.unmount();
    render(<ThemeToggle />);

    expect(theme()).toBe("light");
    expect(screen.getByRole("button", { name: "淺色" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches with Tab and Space", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.tab();
    expect(screen.getByRole("button", { name: "淺色" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "深色" })).toHaveFocus();
    await user.keyboard(" ");

    expect(theme()).toBe("dark");
  });

  it("restores light when the gallery is left", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "深色" }));

    unmount();

    expect(theme()).toBe("light");
  });
});
