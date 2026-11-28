import { describe, expect, it } from "vitest";

import { resolveDashboardView, type DashboardTaskRoleState } from "./dashboard-view";

/** A ready state holding exactly the given task roles. */
function ready(...roles: ("annotator" | "reviewer" | "project_leader")[]): DashboardTaskRoleState {
  return { status: "ready", answer: { heldRoles: new Set(roles) } };
}

const LOADING: DashboardTaskRoleState = { status: "loading" };
const ERROR: DashboardTaskRoleState = { status: "error" };

describe("resolveDashboardView", () => {
  it.each(["", "guest", "admin", "USER", "Super_Admin"])(
    "treats the system role %j as invalidRole, whatever the task roles are",
    (role) => {
      expect(resolveDashboardView(role, ready("project_leader"))).toBe("invalidRole");
      expect(resolveDashboardView(role, LOADING)).toBe("invalidRole");
      expect(resolveDashboardView(role, ERROR)).toBe("invalidRole");
    },
  );

  it.each([
    ["loading", LOADING],
    ["error", ERROR],
    ["ready without roles", ready()],
    ["ready with every role", ready("annotator", "reviewer", "project_leader")],
  ])("gives super_admin systemAdmin while the task roles are %s", (_name, state) => {
    expect(resolveDashboardView("super_admin", state)).toBe("systemAdmin");
  });

  it("does not read the task-role state at all for super_admin", () => {
    const throwing = new Proxy({} as DashboardTaskRoleState, {
      get() {
        throw new Error("task-role state was read");
      },
    });
    expect(resolveDashboardView("super_admin", throwing)).toBe("systemAdmin");
  });

  it("maps a platform member's loading and error states", () => {
    expect(resolveDashboardView("user", LOADING)).toBe("loading");
    expect(resolveDashboardView("user", ERROR)).toBe("error");
  });

  it("gives a platform member with no task role noTaskRole", () => {
    expect(resolveDashboardView("user", ready())).toBe("noTaskRole");
  });

  it("gives projectLeader to anyone holding project_leader", () => {
    expect(resolveDashboardView("user", ready("project_leader"))).toBe("projectLeader");
  });

  it("gives reviewer to a reviewer, and to a reviewer who is also an annotator", () => {
    expect(resolveDashboardView("user", ready("reviewer"))).toBe("reviewer");
    expect(resolveDashboardView("user", ready("annotator", "reviewer"))).toBe("reviewer");
  });

  it("gives annotator only to someone holding just the annotator role", () => {
    expect(resolveDashboardView("user", ready("annotator"))).toBe("annotator");
  });

  it("ranks project leader over reviewer over annotator", () => {
    expect(resolveDashboardView("user", ready("annotator", "reviewer", "project_leader"))).toBe(
      "projectLeader",
    );
    expect(resolveDashboardView("user", ready("reviewer", "project_leader"))).toBe("projectLeader");
    expect(resolveDashboardView("user", ready("annotator", "project_leader"))).toBe(
      "projectLeader",
    );
  });
});
