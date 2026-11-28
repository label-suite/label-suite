/**
 * Which dashboard layout to draw (dashboard-shell design D3; spec 02-01 §這一頁
 * 顯示哪一種版面). A pure function, so the priority rules are checked by unit
 * tests even where the browser cannot reach a layout yet.
 */

/** A role a person can hold inside a task. */
type TaskRoleName = "annotator" | "reviewer" | "project_leader";

/**
 * The slice of the task-role source this function reads. It is declared here
 * rather than imported from features/app-shell, because features may not import
 * each other (frontend-agent-rules F1); the page passes the source's state, which
 * satisfies this shape structurally.
 */
export type DashboardTaskRoleState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; answer: { heldRoles: ReadonlySet<TaskRoleName> } };

/** The one layout the page draws. */
export type DashboardView =
  | "invalidRole"
  | "systemAdmin"
  | "loading"
  | "error"
  | "noTaskRole"
  | "projectLeader"
  | "reviewer"
  | "annotator";

/**
 * Decides the layout from the system role and the task-role state.
 *
 * The system role is a plain string, not the generated enum: at run time the
 * server may still send a value outside the contract, and that must be judged
 * here. A `super_admin` never reads the task-role state.
 *
 * @param systemRole The signed-in person's system role as received.
 * @param taskRoleState The task-role source's state; ignored for `super_admin`.
 * @returns Exactly one view; project leader outranks reviewer outranks annotator.
 */
export function resolveDashboardView(
  systemRole: string,
  taskRoleState: DashboardTaskRoleState,
): DashboardView {
  if (systemRole === "super_admin") {
    return "systemAdmin";
  }
  if (systemRole !== "user") {
    return "invalidRole";
  }
  if (taskRoleState.status === "loading") {
    return "loading";
  }
  if (taskRoleState.status === "error") {
    return "error";
  }
  const held = taskRoleState.answer.heldRoles;
  if (held.has("project_leader")) {
    return "projectLeader";
  }
  if (held.has("reviewer")) {
    return "reviewer";
  }
  if (held.has("annotator")) {
    return "annotator";
  }
  return "noTaskRole";
}
