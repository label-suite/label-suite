/**
 * Public entry of the dashboard feature (frontend-agent-rules F1): the layout
 * resolver and the components the dashboard page composes.
 */
export { ActionEntrySection, type ActionEntrySectionProps } from "./action-entry-section";
export { DashboardHeader } from "./dashboard-header";
export { DashboardLoadError, type DashboardLoadErrorProps } from "./dashboard-load-error";
export { DashboardSkeleton, type DashboardSkeletonProps } from "./dashboard-skeleton";
export {
  resolveDashboardView,
  type DashboardTaskRoleState,
  type DashboardView,
} from "./dashboard-view";
export { PlatformUserStats, type PlatformUserStatsProps } from "./platform-user-stats";
