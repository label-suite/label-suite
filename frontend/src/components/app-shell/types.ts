/**
 * What the signed-in shell's view layer is given (sidebar-nav design D1).
 * components/app-shell only draws: the items, the current location, the role
 * label, the user, the collapsed state and the sign-out progress all arrive
 * through props, decided by features/app-shell and assembled in src/app/.
 * Every `labelKey` and `titleKey` is a key of the `appShell` namespace, so the
 * view re-renders its own text when the language changes.
 */
import type { MouseEvent } from "react";

/** The six top-level destinations; picks the icon of each item. */
export type NavKey =
  "dashboard" | "taskManagement" | "annotation" | "datasetAnalysis" | "systemAdmin" | "profile";

/** The two entries of the System Administration submenu. */
export type AdminSubKey = "userManagement" | "roleSettings";

/** Which layout to draw: from 768px the left sidebar, below it the two phone bars. */
export type ShellViewport = "desktop" | "mobile";

/** One entry of the System Administration submenu. */
export interface ShellSubNavItem {
  /** Which entry. */
  key: AdminSubKey;
  /** appShell key of the visible name. */
  labelKey: string;
  /** Where the link goes. */
  href: string;
  /** This entry is the page's current location. */
  current: boolean;
}

/** One top-level sidebar item. */
export interface ShellNavItem {
  /** Which destination; also picks the icon. */
  key: NavKey;
  /** appShell key of the visible name (the third item's name depends on task roles). */
  labelKey: string;
  /** Where a plain click goes, and what a new tab opens; never carries task data. */
  href: string;
  /** This item is the page's current location; exactly one item is, site-wide. */
  current: boolean;
  /** The submenu entries; only System Administration has them. */
  children?: readonly ShellSubNavItem[];
}

/** Called on every click of a sidebar link, before the router follows it. */
export type ShellNavClickHandler = (
  item: ShellNavItem | ShellSubNavItem,
  event: MouseEvent<HTMLAnchorElement>,
) => void;

/** One row of the shortcut overview. */
export interface ShellShortcut {
  /** The keys, shown as key caps in this order (e.g. `?`, `Esc`). */
  keys: readonly string[];
  /** appShell key of the action's name. */
  labelKey: string;
}

/** One group of the shortcut overview; only groups usable on the current page are passed. */
export interface ShellShortcutGroup {
  /** Stable id, e.g. `global`. */
  id: string;
  /** appShell key of the group's title. */
  titleKey: string;
  /** The group's rows. */
  shortcuts: readonly ShellShortcut[];
}

/** The signed-in person as the user summary shows them; nothing else about them. */
export interface ShellUser {
  /** Display name; may be empty, then the email is shown instead. */
  name: string;
  /** Email, shown only when the name is empty. */
  email: string;
  /** appShell key of the role label, resolved from task roles (e.g. `role.generalUser`). */
  roleLabelKey: string;
}
