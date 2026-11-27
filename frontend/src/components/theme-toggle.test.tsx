/**
 * The shared appearance switch (design/system Theme Toggle; sidebar-nav design
 * D7, clarification Q5): one icon button that points at the other theme,
 * switches at once and remembers the choice. Its text comes from `common`.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { changeInterfaceLanguage } from "@/lib/i18n";
import { THEME_STORAGE_KEY, setThemeChoice } from "@/lib/theme";

import { ThemeToggle } from "./theme-toggle";

function dataTheme(): string | null {
  return document.documentElement.getAttribute("data-theme");
}

/** Every control on the page that switches the appearance. */
function themeControls(): HTMLElement[] {
  return screen.queryAllByRole("button", {
    name: /切換為(深|淺)色模式|Switch to (dark|light) mode/,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("points at dark while the page is light, with one icon and a matching title", () => {
    setThemeChoice("light");
    render(<ThemeToggle />);

    const toggle = screen.getByRole("button", { name: "切換為深色模式" });
    expect(toggle).toHaveAttribute("title", "切換為深色模式");
    expect(toggle).toHaveAttribute("data-testid", "sidebar-theme-toggle");
    expect(toggle.querySelectorAll("[data-theme-toggle-icon]")).toHaveLength(1);
    expect(toggle.querySelector('[data-theme-toggle-icon="moon"]')).not.toBeNull();
    expect(themeControls()).toHaveLength(1);
  });

  it("切換外觀立即生效: switches to dark at once, remembers it and then points at light", async () => {
    const user = userEvent.setup();
    setThemeChoice("light");
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "切換為深色模式" }));

    expect(dataTheme()).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    const toggle = screen.getByRole("button", { name: "切換為淺色模式" });
    expect(toggle).toHaveAttribute("title", "切換為淺色模式");
    expect(toggle.querySelector('[data-theme-toggle-icon="sun"]')).not.toBeNull();
    expect(themeControls()).toHaveLength(1);

    await user.click(toggle);
    expect(dataTheme()).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("follows what a system choice actually shows", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "切換為淺色模式" }));

    expect(dataTheme()).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("names itself in English after the language switches", async () => {
    setThemeChoice("light");
    render(<ThemeToggle />);

    await changeInterfaceLanguage("en");

    expect(await screen.findByRole("button", { name: "Switch to dark mode" })).toHaveAttribute(
      "title",
      "Switch to dark mode",
    );
  });

  it("has a compact size for the phone brand bar", () => {
    render(<ThemeToggle compact />);

    expect(screen.getByRole("button", { name: "切換為深色模式" })).toHaveAttribute(
      "data-testid",
      "mobile-theme-toggle",
    );
  });

  it("switches with the keyboard", async () => {
    const user = userEvent.setup();
    setThemeChoice("light");
    render(<ThemeToggle />);

    await user.tab();
    expect(screen.getByRole("button", { name: "切換為深色模式" })).toHaveFocus();
    await user.keyboard(" ");

    expect(dataTheme()).toBe("dark");
  });
});
