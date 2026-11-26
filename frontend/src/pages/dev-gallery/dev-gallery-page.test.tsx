/**
 * The gallery's Alert samples are static examples, not messages: they must not
 * be live regions, or a screen reader would announce all four on page load.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { alertVariantValues } from "@/components/ui/alert";
import { LANGUAGE_STORAGE_KEY, i18n, readStoredLanguage } from "@/lib/i18n";

import { DevGalleryPage } from "./index";

describe("DevGalleryPage Alert samples", () => {
  it("shows every Alert sample as a note, with no live alert region on the page", () => {
    render(<DevGalleryPage />);

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

    render(<DevGalleryPage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Component gallery");
    expect(screen.queryByRole("button", { name: /^(EN|ZH)$|language|語言/i })).toBeNull();
  });
});
