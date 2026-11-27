/**
 * The shared brand mark (design/system Brand Mark): decorative, sized by the
 * caller, never announced.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandMark } from "./brand-mark";

describe("BrandMark", () => {
  it("is hidden from assistive technology and takes its size from the caller", () => {
    const { container } = render(<BrandMark className="size-9" iconClassName="size-5" />);

    const mark = container.firstElementChild;
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark).toHaveClass("size-9", "bg-icon-accent", "text-primary-foreground");
    expect(mark?.querySelector("svg")).toHaveClass("size-5");
  });
});
