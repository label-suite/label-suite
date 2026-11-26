import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Separator, separatorOrientationValues } from "./separator";

describe("Separator", () => {
  it("declares the horizontal and vertical orientations", () => {
    expect([...separatorOrientationValues]).toEqual(["horizontal", "vertical"]);
  });

  it("is decorative by default, so screen readers skip it", () => {
    const { container } = render(<Separator />);

    expect(screen.queryByRole("separator")).toBeNull();
    expect(container.querySelector('[data-slot="separator"]')).toHaveAttribute(
      "data-orientation",
      "horizontal",
    );
  });

  it("is announced as a separator with its orientation when not decorative", () => {
    render(<Separator decorative={false} orientation="vertical" />);

    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "vertical");
  });
});
