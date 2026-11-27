import { useId, type MouseEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { BrandBar } from "./brand-bar";
import { CollapseControl } from "./collapse-control";
import { MOBILE_CONTENT_INSET, SIDEBAR_PADDING, SIDEBAR_WIDTH } from "./dimensions";
import { ShortcutOverview } from "./shortcut-overview";
import { SidebarNav } from "./sidebar-nav";
import type {
  ShellNavClickHandler,
  ShellNavItem,
  ShellShortcutGroup,
  ShellUser,
  ShellViewport,
} from "./types";
import { UserSummary } from "./user-summary";
import { UtilityRow } from "./utility-row";

/** Props of {@link AppShell}. */
export interface AppShellProps {
  /** From 768px the left sidebar, below it the phone's top bar and bottom navigation. */
  viewport: ShellViewport;
  /** The remembered collapsed state; ignored on a phone, which never collapses. */
  collapsed: boolean;
  /** Collapses or expands the desktop sidebar (empty-space click or the collapse control). */
  onToggleCollapsed: () => void;
  /** The items in display order, already decided by role, with exactly one current. */
  navItems: readonly ShellNavItem[];
  /** Told about every sidebar link click, before the router follows it (used to block). */
  onNavClick?: ShellNavClickHandler;
  /** Where the brand link goes. */
  brandHref: string;
  /** Where the profile link goes. */
  profileHref: string;
  /** The signed-in person as the user area shows them. */
  user: ShellUser;
  /** The shortcut groups usable on the current page. */
  shortcutGroups: readonly ShellShortcutGroup[];
  /** The shortcut overview is open. */
  shortcutsOpen: boolean;
  /** Opens or closes the shortcut overview. */
  onShortcutsOpenChange: (open: boolean) => void;
  /** The sign-out request is in flight; every sign-out button shows it. */
  signingOut: boolean;
  /** Starts signing out. */
  onSignOut: () => void;
  /** The page. */
  children: ReactNode;
}

/** Controls a click on the sidebar's empty space must not collapse it through (prototype sidebar.js:528). */
const INTERACTIVE =
  'a, button, input, select, textarea, label, [contenteditable="true"], [role="button"]';

function isInteractive(target: EventTarget): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null;
}

/**
 * The signed-in shell (design/system App Shell; spec 07-01). It only draws:
 * every item, the current location, the user, the collapsed state and the
 * sign-out progress come through props (sidebar-nav design D1). From 768px it
 * is a sticky left sidebar (brand, items, collapse control, tools, user)
 * beside the page; a click on the sidebar's empty space toggles collapsing,
 * a click on any control does not. Below 768px it is a fixed top brand bar
 * and a fixed bottom navigation, with the page inset so neither covers it.
 */
export function AppShell(props: AppShellProps) {
  const { viewport, collapsed, onToggleCollapsed, navItems, onNavClick, user } = props;
  const desktop = viewport === "desktop";
  const isCollapsed = desktop && collapsed;
  const sidebarId = useId();

  const toggleOnEmptySpace = (event: MouseEvent<HTMLElement>) => {
    if (desktop && !isInteractive(event.target)) {
      onToggleCollapsed();
    }
  };

  return (
    <div className={cn("min-h-screen bg-background text-foreground", desktop && "flex")}>
      <header
        id={sidebarId}
        data-collapsed={isCollapsed}
        onClick={toggleOnEmptySpace}
        className={
          desktop
            ? cn(
                "sticky top-0 z-(--z-sticky) flex h-screen shrink-0 flex-col overflow-y-auto border-r border-border bg-card py-(--space-lg) transition-[width,padding] duration-(--dur-normal) ease-(--ease-standard) motion-reduce:transition-none motion-reduce:duration-0",
                isCollapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded,
                isCollapsed ? SIDEBAR_PADDING.collapsed : SIDEBAR_PADDING.expanded,
              )
            : undefined
        }
      >
        <BrandBar
          viewport={viewport}
          collapsed={isCollapsed}
          brandHref={props.brandHref}
          signingOut={props.signingOut}
          onSignOut={props.onSignOut}
        />
        <SidebarNav
          items={navItems}
          viewport={viewport}
          collapsed={isCollapsed}
          onNavClick={onNavClick}
        />
        {desktop ? (
          <>
            <CollapseControl
              collapsed={isCollapsed}
              sidebarId={sidebarId}
              onToggle={onToggleCollapsed}
            />
            <div className="flex flex-col gap-(--space-md) border-t border-border pt-(--space-lg)">
              <UtilityRow
                collapsed={isCollapsed}
                onOpenShortcuts={() => {
                  props.onShortcutsOpenChange(true);
                }}
              />
              <UserSummary
                user={user}
                profileHref={props.profileHref}
                collapsed={isCollapsed}
                signingOut={props.signingOut}
                onSignOut={props.onSignOut}
              />
            </div>
          </>
        ) : null}
      </header>
      <main className={cn("min-w-0 flex-1", !desktop && MOBILE_CONTENT_INSET)}>
        {props.children}
      </main>
      <ShortcutOverview
        open={props.shortcutsOpen}
        onOpenChange={props.onShortcutsOpenChange}
        groups={props.shortcutGroups}
      />
    </div>
  );
}
