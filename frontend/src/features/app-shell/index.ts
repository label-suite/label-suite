/**
 * The app-shell feature's public boundary (frontend-agent-rules F1): the
 * sidebar's rules and state (sidebar-nav design D1). It never imports
 * features/auth; the two meet only in src/app/.
 */
export { BlockedNotice } from "./blocked-notice";
export {
  blockedNoticeKinds,
  blockedNoticeState,
  readBlockedNoticeKind,
  type BlockedNoticeKind,
  type BlockedNoticeState,
} from "./blocked-notice-state";
export { readRouteDeclaration } from "./route-declaration";
export {
  GLOBAL_SHORTCUT_GROUP,
  shortcutGroupsFor,
  useShortcutOverviewKey,
} from "./shortcut-registry";
export {
  buildSidebarNav,
  type SidebarNavBlock,
  type SidebarNavEntry,
  type SidebarNavInput,
  type SidebarNavModel,
  type SidebarRouteDeclaration,
} from "./sidebar-nav-model";
export {
  NO_TASK_ROLE,
  TaskRoleSourceProvider,
  useTaskRoleSource,
  type TaskRole,
  type TaskRoleAnswer,
  type TaskRoleSourceProviderProps,
  type TaskRoleSourceState,
} from "./task-role-source";
export {
  SIDEBAR_COLLAPSED_KEY,
  useSidebarCollapsed,
  type SidebarCollapsed,
} from "./use-sidebar-collapsed";
export { useShellViewport } from "./use-shell-viewport";
