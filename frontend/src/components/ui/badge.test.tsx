import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge, badgeVariantValues } from "./badge";

describe("Badge", () => {
  it("declares exactly the success, warning, error, info, neutral and role variants", () => {
    expect([...badgeVariantValues]).toEqual([
      "success",
      "warning",
      "error",
      "info",
      "neutral",
      "role",
    ]);
  });

  it("draws the role variant as a primary-family pill", () => {
    render(<Badge variant="role">平台成員</Badge>);

    const badge = screen.getByText("平台成員");
    expect(badge).toHaveAttribute("data-variant", "role");
    expect(badge).toHaveClass("rounded-full", "bg-accent", "text-accent-foreground");
    expect(badge).toHaveClass("border-primary-border");
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
