import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("lets a later Tailwind class override a conflicting earlier one", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("px-2 text-sm", "px-3")).toBe("text-sm px-3");
  });

  it("drops falsy values", () => {
    expect(cn("block", false, null, undefined, "", 0, "rounded")).toBe("block rounded");
  });

  it("accepts clsx object and array forms", () => {
    expect(cn(["flex", { "gap-2": true, "gap-4": false }])).toBe("flex gap-2");
  });
});
