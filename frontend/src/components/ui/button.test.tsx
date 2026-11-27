import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SyntheticEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { attachUtilityCss } from "@/test/utility-css";

import { Button, buttonSizeValues, buttonVariantValues } from "./button";

describe("Button declarations", () => {
  it("declares exactly the six variants of the approved screen, without link", () => {
    expect([...buttonVariantValues]).toEqual([
      "default",
      "cta",
      "outline",
      "secondary",
      "ghost",
      "destructive",
    ]);
    expect(buttonVariantValues).not.toContain("link");
  });

  it("declares exactly the sm, md and lg sizes", () => {
    expect([...buttonSizeValues]).toEqual(["sm", "md", "lg"]);
  });

  it("renders every declared variant and size", () => {
    for (const variant of buttonVariantValues) {
      for (const size of buttonSizeValues) {
        const { unmount } = render(
          <Button variant={variant} size={size}>
            {`${variant} ${size}`}
          </Button>,
        );
        const button = screen.getByRole("button", { name: `${variant} ${size}` });
        expect(button).toHaveAttribute("data-variant", variant);
        expect(button).toHaveAttribute("data-size", size);
        unmount();
      }
    }
  });

  it("uses md and default when no size or variant is given", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("data-variant", "default");
    expect(button).toHaveAttribute("data-size", "md");
  });
});

describe("Button interaction", () => {
  it("calls onClick when clicked and when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe("Button motion", () => {
  it("turns its colour transition off when reduced motion is requested (F9)", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "transition-all",
      "motion-reduce:transition-none",
      "motion-reduce:duration-0",
    );
  });
});

describe("Button loading state", () => {
  it("stops the spinner from turning when reduced motion is requested", () => {
    const { container } = render(<Button loading>Checking</Button>);

    expect(container.querySelector("svg")).toHaveClass(
      "animate-spin",
      "motion-reduce:animate-none",
    );
  });

  it("is busy and aria-disabled, but not natively disabled", () => {
    render(<Button loading>Checking</Button>);
    const button = screen.getByRole("button", { name: "Checking" });

    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
  });

  it("shows a decorative spinner next to its text", () => {
    render(<Button loading>Checking</Button>);
    const button = screen.getByRole("button", { name: "Checking" });
    const icon = button.querySelector("svg");

    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("lucide-loader-circle");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("ignores clicks, Enter and Space", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Checking
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Checking" });

    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps focus on the button when it turns to loading", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Button>Re-check</Button>);

    await user.tab();
    const button = screen.getByRole("button", { name: "Re-check" });
    expect(button).toHaveFocus();

    rerender(<Button loading>Re-check</Button>);

    expect(screen.getByRole("button", { name: "Re-check" })).toHaveFocus();
  });

  it("does not submit its form while loading", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: SyntheticEvent) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading>
          Sending
        </Button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Sending" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("Button aria-disabled", () => {
  it("ignores clicks when the caller marks it aria-disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button aria-disabled="true" onClick={onClick}>
        Re-check
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Re-check" });

    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");

    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it.each([
    ["aria-disabled", { "aria-disabled": true }],
    ["loading", { loading: true }],
  ] as const)(
    "takes focus from a mouse click while %s, with its real CSS, and still ignores it",
    async (_label, inertProps) => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Button {...inertProps} onClick={onClick}>
          Re-check
        </Button>,
      );
      const button = screen.getByRole("button", { name: "Re-check" });
      const detach = await attachUtilityCss(button);

      try {
        await user.click(button);
      } finally {
        detach();
      }

      expect(button).toHaveFocus();
      expect(onClick).not.toHaveBeenCalled();
    },
  );
});
