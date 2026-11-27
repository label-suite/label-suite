/**
 * The shared language switch (design/system Language Toggle; sidebar-nav
 * design D2): one component for the account pages and the signed-in shell,
 * with a compact size for the phone brand bar. Its text comes from `common`.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LANGUAGE_STORAGE_KEY, getCurrentLanguage } from "@/lib/i18n";

import { LanguageToggle } from "./language-toggle";

describe("LanguageToggle", () => {
  it("shows only the code, named with it from the common namespace", () => {
    render(<LanguageToggle />);

    const toggle = screen.getByRole("button", { name: "ZH，切換語言" });
    expect(toggle).toHaveTextContent(/^ZH$/);
    expect(toggle).toHaveAttribute("data-testid", "lang-toggle");
    expect(screen.getByTestId("lang-label")).toHaveTextContent("ZH");
  });

  it("switches the language, remembers it and reports the change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LanguageToggle onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "ZH，切換語言" }));

    expect(getCurrentLanguage()).toBe("en");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "EN, Switch language" })).toHaveTextContent(/^EN$/);
  });

  it("has a compact size for the phone brand bar, with the same name and behaviour", async () => {
    const user = userEvent.setup();
    render(<LanguageToggle compact />);

    const toggle = screen.getByRole("button", { name: "ZH，切換語言" });
    expect(toggle).toHaveAttribute("data-size", "compact");
    await user.click(toggle);
    expect(getCurrentLanguage()).toBe("en");
  });

  it("does nothing while disabled", async () => {
    const user = userEvent.setup();
    render(<LanguageToggle disabled />);

    await user.click(screen.getByRole("button", { name: "ZH，切換語言" }));

    expect(getCurrentLanguage()).toBe("zh-TW");
  });
});
