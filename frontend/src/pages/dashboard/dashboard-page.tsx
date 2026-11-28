import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";

import { BlockedNotice, useTaskRoleSource } from "@/features/app-shell";
import { LOGIN_PATH, useSessionState } from "@/features/auth";
import {
  ActionEntrySection,
  DashboardHeader,
  DashboardLoadError,
  DashboardSkeleton,
  PlatformUserStats,
  resolveDashboardView,
  type DashboardView,
} from "@/features/dashboard";

/**
 * Where a Retry stands, for focus only (design D9): `requested` until the
 * skeleton it brings back is drawn, `loading` until the result replaces the
 * skeleton, then `idle` again. Anything but `idle` lets the next layout-area
 * mount take focus; a first load never does.
 */
type RetryFocus = "idle" | "requested" | "loading";

/**
 * /dashboard/dashboard (spec 02-01; dashboard-shell design D3, D9;
 * ui-design.md §元件樹). A composition layer inside the signed-in shell: the
 * system role comes from features/auth, the task-role state and the blocked
 * explanation from features/app-shell, and features/dashboard decides and
 * draws the one layout. From top to bottom: the header, the blocked
 * explanation, the layout area (Q4).
 *
 * A system role outside the contract draws nothing and only replaces the
 * location with the sign-in page; it does not sign out (clarification sa-7).
 * The guards already send such a session there (design D11); this branch is
 * the page's own line of defence.
 */
export function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const session = useSessionState();
  const taskRoleState = useTaskRoleSource();
  const [retryFocus, setRetryFocus] = useState<RetryFocus>("idle");

  const systemRole = session.data?.kind === "signedIn" ? session.data.user.role : "";
  const view = resolveDashboardView(systemRole, taskRoleState);
  const documentTitle = t("documentTitle", { ns: "common", page: t("pageName") });

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  // Runs after the layout area's own mount effects, so a mount that was meant
  // to take focus has already done so when the flag moves on.
  useEffect(() => {
    if (retryFocus === "requested" && view === "loading") {
      setRetryFocus("loading");
    } else if (retryFocus === "loading" && view !== "loading") {
      setRetryFocus("idle");
    }
  }, [retryFocus, view]);

  // The guard draws the page only once the session is known; nothing to judge before that.
  if (session.data === undefined) {
    return null;
  }
  if (view === "invalidRole") {
    return <Navigate to={LOGIN_PATH} replace />;
  }

  const focusOnMount = retryFocus !== "idle";
  const retry =
    taskRoleState.status === "error"
      ? () => {
          setRetryFocus("requested");
          taskRoleState.retry();
        }
      : undefined;

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-(--space-lg) px-(--space-md) pt-(--space-md) pb-(--space-xl) md:p-(--space-lg)">
      <DashboardHeader />
      <BlockedNotice />
      <LayoutArea view={view} focusOnMount={focusOnMount} onRetry={retry} />
    </div>
  );
}

/** Props of {@link LayoutArea}. */
interface LayoutAreaProps {
  /** The layout to draw; never `invalidRole`, which the page handles itself. */
  view: Exclude<DashboardView, "invalidRole">;
  /** Whether the area's content takes focus when it mounts (design D9). */
  focusOnMount: boolean;
  /** Asks the task-role source again; present only in the error state. */
  onRetry: (() => void) | undefined;
}

/**
 * The one layout of the area (ui-design.md §元件樹). The three task-role
 * layouts have only the header in this change (maintainer 2026-11-28), so
 * they draw nothing here.
 */
function LayoutArea({ view, focusOnMount, onRetry }: LayoutAreaProps) {
  switch (view) {
    case "loading":
      return <DashboardSkeleton focusOnMount={focusOnMount} />;
    case "error":
      return (
        <DashboardLoadError
          focusOnMount={focusOnMount}
          onRetry={() => {
            onRetry?.();
          }}
        />
      );
    case "noTaskRole":
      return <ActionEntrySection focusOnMount={focusOnMount} />;
    case "systemAdmin":
      return <PlatformUserStats />;
    case "projectLeader":
    case "reviewer":
    case "annotator":
      return null;
  }
}
