import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<Skeleton />);
    const bar = container.querySelector('[data-slot="skeleton"]');

    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the border colour of the canonical Skeleton", () => {
    const { container } = render(<Skeleton />);

    expect(container.querySelector('[data-slot="skeleton"]')).toHaveClass("bg-border");
  });
});
