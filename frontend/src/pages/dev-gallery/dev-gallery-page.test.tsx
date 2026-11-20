/**
 * The gallery's Alert samples are static examples, not messages: they must not
 * be live regions, or a screen reader would announce all four on page load.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { alertVariantValues } from "@/components/ui/alert";

import { DevGalleryPage } from "./index";

describe("DevGalleryPage Alert samples", () => {
  it("shows every Alert sample as a note, with no live alert region on the page", () => {
    render(<DevGalleryPage />);

    expect(screen.queryAllByRole("alert")).toEqual([]);
    const section = screen.getByRole("region", { name: "Alert" });
    expect(within(section).getAllByRole("note")).toHaveLength(alertVariantValues.length);
  });
});
