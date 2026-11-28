import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Metric } from "./metric";

describe("Metric", () => {
  it("shows the label before the value", () => {
    render(<Metric label="總用戶" value="0 人" />);

    const label = screen.getByText("總用戶");
    const value = screen.getByText("0 人");
    expect(label.compareDocumentPosition(value) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows both strings as given, without adding units or changing case in the text", () => {
    const { container } = render(<Metric label="Project leads" value="1,024 people" />);

    expect(screen.getByText("Project leads")).toHaveTextContent(/^Project leads$/);
    expect(screen.getByText("1,024 people")).toHaveTextContent(/^1,024 people$/);
    expect(container).toHaveTextContent(/^Project leads1,024 people$/);
  });

  it("is a plain, non-interactive tile with no card shadow", () => {
    const { container } = render(<Metric label="標記員" value="0 人" />);

    const tile = container.querySelector('[data-slot="metric"]');
    expect(tile).not.toBeNull();
    expect(tile).not.toHaveClass("shadow-card");
    expect(tile?.querySelector("button, a, input, [tabindex]")).toBeNull();
  });
});
