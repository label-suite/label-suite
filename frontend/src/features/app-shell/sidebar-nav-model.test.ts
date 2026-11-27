/**
 * buildSidebarNav, the one place the sidebar decides by role (sidebar-nav
 * design D3, D4). The tables lock spec 07-01 §導覽項目與可見性 rules 1–6 and
 * notes, and §進入模組的條件 rules 1–3, including the task-role branches this
 * change cannot reach end to end (handed to #766).
 */
import { describe, expect, it } from "vitest";

import {
  ANNOTATION_HREF,
  buildSidebarNav,
  type SidebarNavInput,
  type SidebarNavModel,
} from "./sidebar-nav-model";
import type { TaskRole, TaskRoleAnswer } from "./task-role-source";

function answer(held: readonly TaskRole[], current: TaskRole | null = null): TaskRoleAnswer {
  return { heldRoles: new Set(held), currentTaskRole: current };
}

const NO_TASK_ROLE = answer([]);

function build(overrides: Partial<SidebarNavInput> = {}): SidebarNavModel {
  return buildSidebarNav({
    systemRole: "user",
    taskRoles: NO_TASK_ROLE,
    route: { navKey: "dashboard" },
    ...overrides,
  });
}

function item(model: SidebarNavModel, key: string) {
  const found = model.items.find((entry) => entry.key === key);
  if (found === undefined) {
    throw new Error(`no item ${key}`);
  }
  return found;
}

describe("items by system role (07-01 §導覽項目與可見性 1–3)", () => {
  it("平台成員看不到系統管理: five items in order", () => {
    expect(build().items.map((entry) => entry.key)).toEqual([
      "dashboard",
      "taskManagement",
      "annotation",
      "datasetAnalysis",
      "profile",
    ]);
  });

  it("系統管理員看到系統管理: six items, System Administration before Profile", () => {
    const model = build({ systemRole: "super_admin" });

    expect(model.items.map((entry) => entry.key)).toEqual([
      "dashboard",
      "taskManagement",
      "annotation",
      "datasetAnalysis",
      "systemAdmin",
      "profile",
    ]);
    expect(item(model, "systemAdmin")).toMatchObject({
      labelKey: "nav.systemAdmin",
      href: "/admin/user-management",
      blocked: null,
    });
    expect(item(model, "systemAdmin").children).toEqual([
      {
        key: "userManagement",
        labelKey: "adminNav.userManagement",
        href: "/admin/user-management",
        current: false,
      },
      {
        key: "roleSettings",
        labelKey: "adminNav.roleSettings",
        href: "/admin/role-settings",
        current: false,
      },
    ]);
  });

  it("gives every fixed item its name and target", () => {
    const model = build({ systemRole: "super_admin" });

    expect(
      model.items
        .filter((entry) => entry.key !== "annotation")
        .map((entry) => [entry.key, entry.labelKey, entry.href]),
    ).toEqual([
      ["dashboard", "nav.dashboard", "/dashboard/dashboard"],
      ["taskManagement", "nav.taskManagement", "/task-management/task-list"],
      ["datasetAnalysis", "nav.datasetAnalysis", "/dataset/dataset-analysis-list"],
      ["systemAdmin", "nav.systemAdmin", "/admin/user-management"],
      ["profile", "nav.profile", "/account/profile"],
    ]);
  });
});

/**
 * held task roles, current task role → third item's name, role label,
 * annotation blocked?, dataset analysis blocked?
 */
const TRUTH_TABLE: [string, TaskRoleAnswer, string, string, boolean, boolean][] = [
  [
    "no task role anywhere (this change)",
    answer([]),
    "nav.annotation",
    "role.generalUser",
    true,
    true,
  ],
  [
    "annotator in the current task",
    answer(["annotator"], "annotator"),
    "nav.annotation",
    "role.annotator",
    false,
    true,
  ],
  [
    "reviewer in the current task",
    answer(["reviewer"], "reviewer"),
    "nav.review",
    "role.reviewer",
    false,
    false,
  ],
  [
    "project leader in the current task",
    answer(["project_leader"], "project_leader"),
    "nav.exceptionDisposition",
    "role.projectLeader",
    false,
    false,
  ],
  [
    "project leader only, no current task",
    answer(["project_leader"]),
    "nav.exceptionDisposition",
    "role.generalUser",
    false,
    true,
  ],
  [
    "annotator elsewhere, no current task",
    answer(["annotator"]),
    "nav.annotation",
    "role.generalUser",
    false,
    true,
  ],
  [
    "reviewer elsewhere, no current task",
    answer(["reviewer"]),
    "nav.annotation",
    "role.generalUser",
    false,
    true,
  ],
  [
    "project leader and annotator elsewhere, no current task",
    answer(["project_leader", "annotator"]),
    "nav.annotation",
    "role.generalUser",
    false,
    true,
  ],
  [
    "project leader elsewhere, annotator in the current task",
    answer(["project_leader", "annotator"], "annotator"),
    "nav.annotation",
    "role.annotator",
    false,
    true,
  ],
  [
    "annotator elsewhere, reviewer in the current task",
    answer(["annotator", "reviewer"], "reviewer"),
    "nav.review",
    "role.reviewer",
    false,
    false,
  ],
];

describe("task-role truth table (07-01 §導覽項目與可見性 4–6, §進入模組的條件 1–3)", () => {
  it.each(TRUTH_TABLE)(
    "%s",
    (_case, taskRoles, thirdLabel, roleLabel, annotationBlocked, datasetBlocked) => {
      const model = build({ taskRoles });

      expect(item(model, "annotation").labelKey).toBe(thirdLabel);
      expect(model.roleLabelKey).toBe(roleLabel);
      expect(item(model, "annotation").blocked).toEqual(
        annotationBlocked ? { kind: "annotation", landing: "/dashboard/dashboard" } : null,
      );
      expect(item(model, "datasetAnalysis").blocked).toEqual(
        datasetBlocked ? { kind: "datasetAnalysis", landing: "/task-management/task-list" } : null,
      );
    },
  );

  it("沒有任務角色時角色標示讀作一般使用者: the third item reads 標記作業 and blocks to the landing page", () => {
    const model = build();

    expect(model.roleLabelKey).toBe("role.generalUser");
    expect(item(model, "annotation")).toMatchObject({
      labelKey: "nav.annotation",
      href: ANNOTATION_HREF,
      blocked: { kind: "annotation", landing: "/dashboard/dashboard" },
    });
  });

  it("sends the exception-disposition reading to the task list (07-01 §進入模組的條件 note)", () => {
    expect(item(build({ taskRoles: answer(["project_leader"]) }), "annotation").href).toBe(
      "/task-management/task-list",
    );
  });

  it("links the third item to the annotation list with only the entry mark otherwise (Hard Rule 5)", () => {
    expect(ANNOTATION_HREF).toBe("/annotation/annotation-list?entry=nav");
    for (const [, taskRoles, thirdLabel] of TRUTH_TABLE) {
      const href = item(build({ taskRoles }), "annotation").href;
      if (thirdLabel !== "nav.exceptionDisposition") {
        expect(href).toBe(ANNOTATION_HREF);
      }
      expect(href).not.toMatch(/task_type|task_id|taskId|output/i);
    }
  });

  it("never blocks the other items", () => {
    const model = build({ systemRole: "super_admin" });

    for (const key of ["dashboard", "taskManagement", "systemAdmin", "profile"]) {
      expect(item(model, key).blocked).toBeNull();
    }
  });
});

describe("role label override (07-01 §導覽項目與可見性 note)", () => {
  it("a page that declares systemAdmin shows 系統管理員 over any task role", () => {
    for (const [, taskRoles] of TRUTH_TABLE) {
      const model = build({
        systemRole: "super_admin",
        taskRoles,
        route: { navKey: "systemAdmin", roleIndicator: "systemAdmin" },
      });
      expect(model.roleLabelKey).toBe("role.systemAdmin");
    }
  });
});

describe("current location (07-01 §目前位置)", () => {
  it.each(["dashboard", "taskManagement", "annotation", "datasetAnalysis", "profile"] as const)(
    "marks exactly %s",
    (navKey) => {
      const current = build({ route: { navKey } }).items.filter((entry) => entry.current);

      expect(current.map((entry) => entry.key)).toEqual([navKey]);
    },
  );

  it("marks nothing when the route declares no item", () => {
    const model = build({ systemRole: "super_admin", route: null });

    expect(model.items.filter((entry) => entry.current)).toEqual([]);
    expect(model.roleLabelKey).toBe("role.generalUser");
  });

  it("marks System Administration and the declared submenu entry on an admin page", () => {
    const model = build({
      systemRole: "super_admin",
      route: { navKey: "systemAdmin", adminSubKey: "roleSettings", roleIndicator: "systemAdmin" },
    });

    expect(model.items.filter((entry) => entry.current).map((entry) => entry.key)).toEqual([
      "systemAdmin",
    ]);
    expect(
      item(model, "systemAdmin")
        .children?.filter((entry) => entry.current)
        .map((entry) => entry.key),
    ).toEqual(["roleSettings"]);
  });
});
