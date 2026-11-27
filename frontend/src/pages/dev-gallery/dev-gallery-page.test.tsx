/**
 * The gallery's Alert samples are static examples, not messages: they must not
 * be live regions, or a screen reader would announce all four on page load.
 * The gallery's language, and its appearance switch, which is the shared one
 * and writes the shared preference (component-gallery, clarification Q5).
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { alertVariantValues } from "@/components/ui/alert";
import { LANGUAGE_STORAGE_KEY, i18n, readStoredLanguage } from "@/lib/i18n";
import { THEME_STORAGE_KEY, initTheme, setThemeChoice } from "@/lib/theme";

import { renderGallery } from "./render-gallery";

describe("DevGalleryPage Alert samples", () => {
  it("shows every Alert sample as a note, with no live alert region on the page", () => {
    renderGallery();

    expect(screen.queryAllByRole("alert")).toEqual([]);
    const section = screen.getByRole("region", { name: "Alert" });
    expect(within(section).getAllByRole("note")).toHaveLength(alertVariantValues.length);
  });
});

describe("DevGalleryPage interface language", () => {
  it("follows the remembered English and offers no language switch", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    // What initI18n does at start-up with the remembered value.
    await i18n.changeLanguage(readStoredLanguage());

    renderGallery();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Component gallery");
    expect(screen.queryByRole("button", { name: /^(EN|ZH)$|language|語言/i })).toBeNull();
  });
});

/** Every control on the page that switches the appearance. */
function themeControls(): HTMLElement[] {
  return screen.queryAllByRole("button", { name: /切換為(深|淺)色模式/ });
}

function dataTheme(): string | null {
  return document.documentElement.getAttribute("data-theme");
}

/** 離開展示頁不還原外觀 is in src/app/router.test.tsx: it needs the real route change. */
describe("DevGalleryPage appearance switch (component-gallery, clarification Q5)", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("元件展示頁切換淺色與深色: one shared switch in the title row, remembered", async () => {
    const user = userEvent.setup();
    setThemeChoice("light");
    renderGallery();
    const titleRow = screen.getByRole("heading", { level: 1 }).parentElement;
    expect(titleRow).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "切換為深色模式" }));

    expect(dataTheme()).toBe("dark");
    expect(themeControls()).toHaveLength(1);
    if (titleRow !== null) {
      expect(within(titleRow).getByRole("button", { name: "切換為淺色模式" })).toBe(
        themeControls()[0],
      );
    }
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("重新整理後沿用外觀偏好: dark again after a reload", async () => {
    const user = userEvent.setup();
    setThemeChoice("light");
    const first = renderGallery();
    await user.click(screen.getByRole("button", { name: "切換為深色模式" }));

    // Reload: the page goes away, the attribute starts empty, start-up applies the preference.
    first.unmount();
    document.documentElement.removeAttribute("data-theme");
    initTheme();
    renderGallery();

    expect(dataTheme()).toBe("dark");
    expect(screen.getByRole("button", { name: "切換為淺色模式" })).toBeInTheDocument();
  });

  it("鍵盤可以切換主題: Tab to the switch and press Space", async () => {
    const user = userEvent.setup();
    setThemeChoice("light");
    renderGallery();
    const toggle = screen.getByRole("button", { name: "切換為深色模式" });

    for (let step = 0; step < 30 && document.activeElement !== toggle; step += 1) {
      await user.tab();
    }
    expect(toggle).toHaveFocus();
    await user.keyboard(" ");

    expect(dataTheme()).toBe("dark");
  });
});
