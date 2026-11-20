import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge, badgeVariantValues } from "./badge";

describe("Badge", () => {
  it("declares exactly the success, warning, error, info and neutral variants", () => {
    expect([...badgeVariantValues]).toEqual(["success", "warning", "error", "info", "neutral"]);
  });

  it("renders every declared variant with its text", () => {
    for (const variant of badgeVariantValues) {
      const { unmount } = render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toHaveAttribute("data-variant", variant);
      unmount();
    }
  });

  it("is neutral when no variant is given", () => {
    render(<Badge>Draft</Badge>);
    expect(screen.getByText("Draft")).toHaveAttribute("data-variant", "neutral");
  });
});
