/**
 * The shortcut overview's list and its `?` key (sidebar-nav design D12,
 * clarification Q3; spec 07-01 §快捷鍵總覽). The overview lists only what the
 * current page can use: the fixed Global group, then the groups the matched
 * routes declare in `handle.shortcutGroups`. No route declares one yet;
 * #725 (tabs) and #780 (workspace, review) add theirs.
 */
import { useEffect } from "react";

import type {
  ShellShortcut,
  ShellShortcutGroup,
  ShellViewport,
} from "@/components/app-shell/types";

/** The group every page has: `?` opens the overview, `Esc` closes a dialog. */
export const GLOBAL_SHORTCUT_GROUP: ShellShortcutGroup = {
  id: "global",
  titleKey: "shortcuts.groups.global",
  shortcuts: [
    { keys: ["?"], labelKey: "shortcuts.actions.openOverview" },
    { keys: ["Esc"], labelKey: "shortcuts.actions.closeDialog" },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isShortcut(value: unknown): value is ShellShortcut {
  return (
    isRecord(value) &&
    typeof value.labelKey === "string" &&
    Array.isArray(value.keys) &&
    value.keys.every((key) => typeof key === "string")
  );
}

function isShortcutGroup(value: unknown): value is ShellShortcutGroup {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.titleKey === "string" &&
    Array.isArray(value.shortcuts) &&
    value.shortcuts.every(isShortcut)
  );
}

/**
 * The groups of the current page, Global first, each id once.
 *
 * @param handles The `handle` of every matched route, outermost first; route
 *   handles are untyped, so anything that is not a valid group is ignored.
 */
export function shortcutGroupsFor(handles: readonly unknown[]): ShellShortcutGroup[] {
  const groups: ShellShortcutGroup[] = [GLOBAL_SHORTCUT_GROUP];
  for (const handle of handles) {
    const declared = isRecord(handle) ? handle.shortcutGroups : undefined;
    if (!Array.isArray(declared)) {
      continue;
    }
    for (const group of declared) {
      if (isShortcutGroup(group) && !groups.some((known) => known.id === group.id)) {
        groups.push(group);
      }
    }
  }
  return groups;
}

/** Fields where `?` is typing, not a shortcut. */
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function isEditable(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(EDITABLE) !== null;
}

/**
 * Opens the shortcut overview on `?` (prototype sidebar.js:2514): only from
 * 768px, never while focus is in an editable field, and still when the
 * sidebar is collapsed.
 *
 * @param viewport The current layout; below 768px the key does nothing.
 * @param onOpen Opens the overview.
 */
export function useShortcutOverviewKey(viewport: ShellViewport, onOpen: () => void): void {
  useEffect(() => {
    if (viewport !== "desktop") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (isEditable(event.target)) {
        return;
      }
      event.preventDefault();
      onOpen();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [viewport, onOpen]);
}
