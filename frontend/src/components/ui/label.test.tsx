import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Input } from "./input";
import { Label } from "./label";

describe("Label", () => {
  it("names the field it points at", () => {
    render(
      <>
        <Label htmlFor="email">電子郵件</Label>
        <Input id="email" type="email" />
      </>,
    );

    expect(screen.getByRole("textbox", { name: "電子郵件" })).toBeInTheDocument();
  });

  it("moves focus to its field when clicked", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Label htmlFor="name">Name</Label>
        <Input id="name" />
      </>,
    );

    await user.click(screen.getByText("Name"));

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
  });

  it("renders a native label element", () => {
    render(<Label htmlFor="x">X</Label>);

    expect(screen.getByText("X").tagName).toBe("LABEL");
  });
});
