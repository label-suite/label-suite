import { describe, expect, it } from "vitest";

import { FOCUS_RING } from "./focus-ring";

describe("FOCUS_RING", () => {
  const classes = FOCUS_RING.split(/\s+/);

  it("restores the outline style that Button's outline-none switches off", () => {
    // Tailwind v4: `outline-none` sets --tw-outline-style:none, and `outline-2` only
    // reads that variable, so without `outline-solid` the 2px outline never draws.
    expect(classes).toContain("focus-visible:outline-2");
    expect(classes).toContain("focus-visible:outline-solid");
  });

  it("drops Button's own 3px focus ring so only the prototype's outline shows", () => {
    expect(classes).toContain("focus-visible:ring-0");
  });
});
