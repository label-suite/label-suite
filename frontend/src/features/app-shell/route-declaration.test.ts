/**
 * Reading what a route declares in its `handle` (sidebar-nav design D4). Route
 * handles are untyped, so only valid declarations count, and the deepest wins.
 */
import { describe, expect, it } from "vitest";

import { readRouteDeclaration } from "./route-declaration";

describe("readRouteDeclaration", () => {
  it("takes the deepest handle that declares a navKey", () => {
    expect(
      readRouteDeclaration([
        undefined,
        { navKey: "dashboard" },
        { navKey: "systemAdmin", adminSubKey: "roleSettings", roleIndicator: "systemAdmin" },
        { shortcutGroups: [] },
      ]),
    ).toEqual({ navKey: "systemAdmin", adminSubKey: "roleSettings", roleIndicator: "systemAdmin" });
  });

  it("keeps only the valid optional fields", () => {
    expect(
      readRouteDeclaration([{ navKey: "profile", adminSubKey: "users", roleIndicator: "boss" }]),
    ).toEqual({ navKey: "profile" });
  });

  it("is null when no route declares a known navKey", () => {
    expect(readRouteDeclaration([null, { navKey: "tasks" }, "dashboard", {}])).toBeNull();
  });
});
