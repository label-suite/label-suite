/**
 * The task-role source (sidebar-nav design D3, dashboard-shell design D2; ui-design
 * §非畫面的模組): the single seam the sidebar and the dashboard ask about task
 * roles. The sidebar's third item, role label and entry conditions, and the
 * dashboard's layout, are computed only from its answer.
 *
 * Its state is a discriminated union, so a caller cannot read roles while the
 * source is loading or has failed. Tasks and task memberships do not exist yet
 * (system-design §設計結論), so every user truly holds no task role: without
 * a provider the hook answers "ready, no task role" and sends no request
 * (clarification Q1). Tests inject the other states with
 * TaskRoleSourceProvider. #766 replaces only the hook's inside with the real
 * read, whose proposed shape (system-design §任務角色讀取的提案形狀) is role
 * names only, never task IDs.
 */
import { createContext, createElement, useContext, type ReactNode } from "react";

/** A role a person can hold inside a task (PRD §角色清單). */
export type TaskRole = "annotator" | "reviewer" | "project_leader";

/** What the source answers about the signed-in person. */
export interface TaskRoleAnswer {
  /** Every task role held in any task, as names only; empty when none. */
  heldRoles: ReadonlySet<TaskRole>;
  /** The role in the current task; null with no current task or no role in it. */
  currentTaskRole: TaskRole | null;
}

/** What the source knows: still reading, failed with a way to retry, or answered. */
export type TaskRoleSourceState =
  | { status: "loading" }
  | {
      status: "error";
      /** Asks again; the source moves to its next state on its own. */
      retry: () => void;
    }
  | {
      status: "ready";
      /** The signed-in person's task roles. */
      answer: TaskRoleAnswer;
    };

/** No task role anywhere and no current task; also what the sidebar uses until the source is ready. */
export const NO_TASK_ROLE: TaskRoleAnswer = Object.freeze({
  heldRoles: new Set<TaskRole>(),
  currentTaskRole: null,
});

/** The answer of this change for everyone (clarification Q1); the same object on every render. */
const READY_WITHOUT_TASK_ROLE: TaskRoleSourceState = Object.freeze({
  status: "ready",
  answer: NO_TASK_ROLE,
});

const TaskRoleSourceContext = createContext<TaskRoleSourceState>(READY_WITHOUT_TASK_ROLE);

/** Props of {@link TaskRoleSourceProvider}. */
export interface TaskRoleSourceProviderProps {
  /** The state every `useTaskRoleSource()` below answers with, passed through as it is. */
  value: TaskRoleSourceState;
  /** The tree that reads it. */
  children: ReactNode;
}

/**
 * Fixes the task-role source's state for the tree below. The app needs none;
 * tests use it to drive loading, error (with their own retry) and ready.
 */
export function TaskRoleSourceProvider({ value, children }: TaskRoleSourceProviderProps) {
  return createElement(TaskRoleSourceContext.Provider, { value }, children);
}

/** The task-role source's state for the signed-in person. */
export function useTaskRoleSource(): TaskRoleSourceState {
  return useContext(TaskRoleSourceContext);
}
