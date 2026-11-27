/**
 * The Dialog primitive (shadcn/ui on radix-ui; sidebar-nav design D9): focus
 * goes inside and is trapped, Esc and the close button close it, and focus
 * returns to the element that opened it.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./dialog";

/** Props of {@link Sample}. */
interface SampleProps {
  /** Passed through to DialogContent. */
  closeLabel?: string;
}

function Sample({ closeLabel }: SampleProps) {
  return (
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent closeLabel={closeLabel}>
        <DialogTitle>Title</DialogTitle>
        <DialogDescription>Description</DialogDescription>
        <button type="button">Inside</button>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("opens a modal dialog named by its title", async () => {
    const user = userEvent.setup();
    render(<Sample />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open" }));

    const dialog = screen.getByRole("dialog", { name: "Title" });
    expect(dialog).toHaveAccessibleDescription("Description");
    expect(dialog).toHaveAttribute("data-slot", "dialog-content");
  });

  it("closes on Esc and gives focus back to the opening button", async () => {
    const user = userEvent.setup();
    render(<Sample />);
    const trigger = screen.getByRole("button", { name: "Open" });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("puts a named close button first, so focus starts on it, and closes with it", async () => {
    const user = userEvent.setup();
    render(<Sample closeLabel="Close it" />);

    await user.click(screen.getByRole("button", { name: "Open" }));
    const close = screen.getByRole("button", { name: "Close it" });
    expect(close).toHaveFocus();

    await user.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps Tab inside the dialog", async () => {
    const user = userEvent.setup();
    render(<Sample closeLabel="Close it" />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.tab();
    expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close it" })).toHaveFocus();
  });

  it("has no close button without a close label", async () => {
    const user = userEvent.setup();
    render(<Sample />);

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Inside"]);
  });
});
