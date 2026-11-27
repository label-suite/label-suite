/**
 * buildSidebarNav: every role-dependent sidebar decision in one pure function
 * (sidebar-nav design D3, D4; spec 07-01 §導覽項目與可見性, §目前位置,
 * §進入模組的條件). The view components only draw what it returns.
 */
import type { SessionUserDataRole } from "@/api/generated/label-suite.schemas";
import type {
  AdminSubKey,
  NavKey,
  ShellNavItem,
  ShellSubNavItem,
} from "@/components/app-shell/types";

import type { BlockedNoticeKind } from "./blocked-notice-state";
import type { TaskRole, TaskRoleAnswer } from "./task-role-source";

/** The landing page (07-shared X1); where a blocked Annotation click lands. */
export const DASHBOARD_HREF = "/dashboard/dashboard";
/** The task list (X2); where a blocked Dataset Analytics click lands. */
export const TASK_LIST_HREF = "/task-management/task-list";
/**
 * The annotation list with the entry mark only (spec 07-01 Q6, Q17): never a
 * task, task type or output type (Hard Rule 5).
 */
export const ANNOTATION_HREF = "/annotation/annotation-list?entry=nav";
const DATASET_HREF = "/dataset/dataset-analysis-list";
const USER_MANAGEMENT_HREF = "/admin/user-management";
const ROLE_SETTINGS_HREF = "/admin/role-settings";
const PROFILE_HREF = "/account/profile";

/** What the current route declares in its `handle` (design D4). */
export interface SidebarRouteDeclaration {
  /** The item this page belongs to; exactly one is current. */
  navKey: NavKey;
  /** The System Administration submenu entry this page is. */
  adminSubKey?: AdminSubKey;
  /** A role label the page fixes, winning over task roles (07-01 §導覽項目與可見性 note). */
  roleIndicator?: "systemAdmin";
}

/** Everything the sidebar's rules depend on. */
export interface SidebarNavInput {
  /** The system role from this session query; display only, never authorization. */
  systemRole: SessionUserDataRole;
  /** The task-role source's answer. */
  taskRoles: TaskRoleAnswer;
  /** The deepest route's declaration; null marks no item current (the router test forbids it). */
  route: SidebarRouteDeclaration | null;
}

/** Why and where a plain click is sent instead of the item's own target. */
export interface SidebarNavBlock {
  /** Which explanation the landing page shows. */
  kind: BlockedNoticeKind;
  /** Where the click lands. */
  landing: string;
}

/** One item with its entry condition. */
export interface SidebarNavEntry extends ShellNavItem {
  /** Set when a plain click must be blocked (07-01 §進入模組的條件 3); null otherwise. */
  blocked: SidebarNavBlock | null;
}

/** What the sidebar shows. */
export interface SidebarNavModel {
  /** The items in display order. */
  items: SidebarNavEntry[];
  /** appShell key of the user summary's role label. */
  roleLabelKey: string;
}

const ROLE_LABEL_KEYS: Record<TaskRole, string> = {
  annotator: "role.annotator",
  reviewer: "role.reviewer",
  project_leader: "role.projectLeader",
};

/** Holds a project-leader role somewhere but no annotator or reviewer role anywhere (rule 5). */
function isProjectLeaderOnly({ heldRoles }: TaskRoleAnswer): boolean {
  return (
    heldRoles.has("project_leader") && !heldRoles.has("annotator") && !heldRoles.has("reviewer")
  );
}

/** The third item's name (07-01 §導覽項目與可見性 4–6). */
function thirdItemLabelKey(taskRoles: TaskRoleAnswer): string {
  const current = taskRoles.currentTaskRole;
  if (current === "reviewer") {
    return "nav.review";
  }
  if (current === "project_leader" || (current === null && isProjectLeaderOnly(taskRoles))) {
    return "nav.exceptionDisposition";
  }
  return "nav.annotation";
}

/** The role label (07-01 §導覽項目與可見性 notes): a page's own label wins, then the current task role. */
function roleLabelKey({ route, taskRoles }: SidebarNavInput): string {
  if (route?.roleIndicator === "systemAdmin") {
    return "role.systemAdmin";
  }
  const current = taskRoles.currentTaskRole;
  return current === null ? "role.generalUser" : ROLE_LABEL_KEYS[current];
}

function annotationEntry(taskRoles: TaskRoleAnswer, current: boolean): SidebarNavEntry {
  const labelKey = thirdItemLabelKey(taskRoles);
  return {
    key: "annotation",
    labelKey,
    // Exception disposition is handled from the task list, never the annotation list (07-01 Q15, Q18).
    href: labelKey === "nav.exceptionDisposition" ? TASK_LIST_HREF : ANNOTATION_HREF,
    current,
    // Rule 1: any task role in any task lets the person in.
    blocked:
      taskRoles.heldRoles.size === 0 ? { kind: "annotation", landing: DASHBOARD_HREF } : null,
  };
}

function datasetEntry(taskRoles: TaskRoleAnswer, current: boolean): SidebarNavEntry {
  const role = taskRoles.currentTaskRole;
  return {
    key: "datasetAnalysis",
    labelKey: "nav.datasetAnalysis",
    href: DATASET_HREF,
    current,
    // Rule 2: project leader or reviewer in the current task.
    blocked:
      role === "project_leader" || role === "reviewer"
        ? null
        : { kind: "datasetAnalysis", landing: TASK_LIST_HREF },
  };
}

function adminEntry(route: SidebarRouteDeclaration | null): SidebarNavEntry {
  const sub = (key: AdminSubKey, labelKey: string, href: string): ShellSubNavItem => ({
    key,
    labelKey,
    href,
    current: route?.navKey === "systemAdmin" && route.adminSubKey === key,
  });
  return {
    key: "systemAdmin",
    labelKey: "nav.systemAdmin",
    href: USER_MANAGEMENT_HREF,
    current: route?.navKey === "systemAdmin",
    blocked: null,
    children: [
      sub("userManagement", "adminNav.userManagement", USER_MANAGEMENT_HREF),
      sub("roleSettings", "adminNav.roleSettings", ROLE_SETTINGS_HREF),
    ],
  };
}

/**
 * Builds the sidebar for one person on one page.
 *
 * @param input The system role, the task-role answer and the route's declaration.
 * @returns The items in display order, with exactly the declared one current,
 *   and the role label key.
 */
export function buildSidebarNav(input: SidebarNavInput): SidebarNavModel {
  const { systemRole, taskRoles, route } = input;
  const currentKey = route?.navKey ?? null;
  const plain = (key: NavKey, labelKey: string, href: string): SidebarNavEntry => ({
    key,
    labelKey,
    href,
    current: currentKey === key,
    blocked: null,
  });

  const items: SidebarNavEntry[] = [
    plain("dashboard", "nav.dashboard", DASHBOARD_HREF),
    plain("taskManagement", "nav.taskManagement", TASK_LIST_HREF),
    annotationEntry(taskRoles, currentKey === "annotation"),
    datasetEntry(taskRoles, currentKey === "datasetAnalysis"),
  ];
  // Rules 2, 3: only a system admin sees System Administration; showing it is not authorization.
  if (systemRole === "super_admin") {
    items.push(adminEntry(route));
  }
  items.push(plain("profile", "nav.profile", PROFILE_HREF));

  return { items, roleLabelKey: roleLabelKey(input) };
}
