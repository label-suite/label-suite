import { useCallback, useState, type MouseEvent } from "react";
import { Outlet, useLocation, useMatches, useNavigate } from "react-router-dom";

import { AppShell } from "@/components/app-shell/app-shell";
import type { ShellNavClickHandler } from "@/components/app-shell/types";
import {
  DASHBOARD_HREF,
  blockedNoticeState,
  buildSidebarNav,
  readRouteDeclaration,
  shortcutGroupsFor,
  useShellViewport,
  useShortcutOverviewKey,
  useSidebarCollapsed,
  useTaskRoleSource,
  type SidebarNavModel,
} from "@/features/app-shell";
import { useSessionState, useSignOut } from "@/features/auth";

import { useSessionCheckOnArrival } from "./session-check";

/** A plain left click: modified and middle clicks are the browser's (new tab, new window). */
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * Turns a plain click on a blocked item into a trip to its landing page with
 * the explanation in router state (design D5); replaces the entry when the
 * page is already the landing page, so history does not pile up.
 */
function useBlockedClick(model: SidebarNavModel): ShellNavClickHandler {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return useCallback(
    (item, event) => {
      const block = model.items.find((entry) => entry.key === item.key)?.blocked ?? null;
      if (block === null || !isPlainClick(event)) {
        return;
      }
      event.preventDefault();
      navigate(block.landing, {
        state: blockedNoticeState(block.kind),
        replace: pathname === block.landing,
      });
    },
    [model, navigate, pathname],
  );
}

/**
 * The signed-in shell's composition layer (sidebar-nav design D1): the only
 * place where features/auth (the session and signing out) and
 * features/app-shell (the navigation rules and state) meet. It hands the
 * result to components/app-shell, which only draws, and draws the page in
 * its Outlet. It sits under RequireAuthRoute, so a session is known here.
 */
export function AppShellLayout() {
  const session = useSessionState();
  const { refetch } = session;
  const { signOut, signingOut } = useSignOut();
  const taskRoles = useTaskRoleSource();
  const viewport = useShellViewport();
  const { collapsed, toggle } = useSidebarCollapsed(viewport);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const handles = useMatches().map((match) => match.handle);

  // While this runs, the previous answer keeps the sidebar as it was (D6).
  const refetchSession = useCallback(() => {
    void refetch({ cancelRefetch: false });
  }, [refetch]);
  useSessionCheckOnArrival(refetchSession);

  const openShortcuts = useCallback(() => {
    setShortcutsOpen(true);
  }, []);
  useShortcutOverviewKey(viewport, openShortcuts);

  const signedInUser = session.data?.kind === "signedIn" ? session.data.user : null;
  const model = buildSidebarNav({
    systemRole: signedInUser?.role ?? "user",
    taskRoles,
    route: readRouteDeclaration(handles),
  });
  const onNavClick = useBlockedClick(model);

  if (signedInUser === null) {
    // The guard above redirects a signed-out session on this same render.
    return null;
  }

  return (
    <AppShell
      viewport={viewport}
      collapsed={collapsed}
      onToggleCollapsed={toggle}
      navItems={model.items}
      onNavClick={onNavClick}
      brandHref={DASHBOARD_HREF}
      profileHref="/account/profile"
      user={{
        name: signedInUser.name,
        email: signedInUser.email,
        roleLabelKey: model.roleLabelKey,
      }}
      shortcutGroups={shortcutGroupsFor(handles)}
      shortcutsOpen={shortcutsOpen}
      onShortcutsOpenChange={setShortcutsOpen}
      signingOut={signingOut}
      onSignOut={signOut}
    >
      <Outlet />
    </AppShell>
  );
}
