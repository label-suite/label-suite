/**
 * The task-role source (sidebar-nav design D3; ui-design §非畫面的模組): the
 * single seam the sidebar asks about task roles. The third item's name, the
 * role label and the two entry conditions are computed only from its answer.
 *
 * Tasks and task memberships do not exist yet (system-design §設計結論), so
 * every user truly holds no task role; this change answers exactly that and
 * sends no request (clarification Q1). #766 replaces this one hook with the
 * real read, whose proposed shape (system-design §任務角色讀取的提案形狀) is
 * role names only, never task IDs.
 */

/** A role a person can hold inside a task (PRD §角色清單). */
export type TaskRole = "annotator" | "reviewer" | "project_leader";

/** What the source answers about the signed-in person. */
export interface TaskRoleAnswer {
  /** Every task role held in any task, as names only; empty when none. */
  heldRoles: ReadonlySet<TaskRole>;
  /** The role in the current task; null with no current task or no role in it. */
  currentTaskRole: TaskRole | null;
}

/** The answer of this change: no task role anywhere and no current task. */
const NO_TASK_ROLE: TaskRoleAnswer = Object.freeze({
  heldRoles: new Set<TaskRole>(),
  currentTaskRole: null,
});

/** The signed-in person's task roles; the same object on every render. */
export function useTaskRoleSource(): TaskRoleAnswer {
  return NO_TASK_ROLE;
}
