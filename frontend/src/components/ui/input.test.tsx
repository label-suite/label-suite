import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Input } from "./input";

describe("Input", () => {
  it("takes the name of its native label and accepts typing", async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="name">Name</label>
        <Input id="name" />
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });

    await user.type(input, "abc");

    expect(input).toHaveValue("abc");
  });

  it("shows the error outline when aria-invalid is set and keeps the error description", () => {
    render(
      <>
        <label htmlFor="code">Code</label>
        <Input id="code" aria-invalid="true" aria-describedby="code-error" defaultValue="abc" />
        <p id="code-error">Wrong format</p>
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Code" });

    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("Wrong format");
    expect(input.className).toContain("aria-invalid:border-error");
  });

  it("cannot be typed into when disabled", async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="locked">Locked</label>
        <Input id="locked" disabled defaultValue="read only" />
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Locked" });

    await user.type(input, "x");

    expect(input).toBeDisabled();
    expect(input).toHaveValue("read only");
  });

  it("matches the approved artifact's 44px height and 12px side padding", () => {
    render(
      <>
        <label htmlFor="size">Size</label>
        <Input id="size" />
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Size" });

    // h-11 is 44px and px-3 is 12px on Tailwind's 4px spacing scale.
    expect(input).toHaveClass("h-11", "px-3");
    expect(input).not.toHaveClass("h-9");
  });
});
