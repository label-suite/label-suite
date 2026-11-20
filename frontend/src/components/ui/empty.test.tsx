import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Empty } from "./empty";

describe("Empty", () => {
  it("shows its title and description", () => {
    render(<Empty title="No data yet" description="Why it is empty, and what to do next" />);

    expect(screen.getByText("No data yet")).toBeVisible();
    expect(screen.getByText("Why it is empty, and what to do next")).toBeVisible();
  });

  it("uses the Lucide Inbox icon, hidden from assistive technology", () => {
    const { container } = render(<Empty title="No data yet" description="Nothing here" />);
    const icon = container.querySelector("svg");

    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("lucide-inbox");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders an optional action", () => {
    render(
      <Empty
        title="No data yet"
        description="Nothing here"
        action={<button type="button">Create</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Create" })).toBeVisible();
  });

  it("sits on the subtle surface, not on the disabled-control colour", () => {
    const { container } = render(<Empty title="No data yet" description="Nothing here" />);
    const panel = container.firstElementChild;

    expect(panel).toHaveClass("bg-surface-subtle");
    expect(panel).not.toHaveClass("bg-control-disabled");
  });
});
