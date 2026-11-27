/**
 * The desktop sidebar's collapsed preference (sidebar-nav design D8; spec
 * 07-01 §側欄收合). It is remembered in this browser under the prototype's key
 * as `"true"` or `"false"`; any other value, or storage that cannot be read,
 * means expanded. Below 768px the sidebar never collapses and toggling does
 * nothing, but the remembered value is left alone, so it returns on a desktop
 * width (prototype sidebar.js:2541).
 */
import { useCallback, useState } from "react";

import type { ShellViewport } from "@/components/app-shell/types";

/** The localStorage key of the remembered collapsed state (prototype sidebar.js:5). */
export const SIDEBAR_COLLAPSED_KEY = "labelsuite.sidebarCollapsed";

function readStored(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

/** What the shell gets. */
export interface SidebarCollapsed {
  /** The sidebar is drawn collapsed now: remembered as collapsed and on a desktop width. */
  collapsed: boolean;
  /** Flips and remembers the state; does nothing below 768px. */
  toggle: () => void;
}

/**
 * The collapsed state for the given layout.
 *
 * @param viewport The current layout, from useShellViewport.
 */
export function useSidebarCollapsed(viewport: ShellViewport): SidebarCollapsed {
  const [stored, setStored] = useState(readStored);
  const desktop = viewport === "desktop";

  const toggle = useCallback(() => {
    if (!desktop) {
      return;
    }
    const next = !stored;
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "true" : "false");
    } catch {
      // Storage disabled or full: the state holds for this page only.
    }
    setStored(next);
  }, [desktop, stored]);

  return { collapsed: desktop && stored, toggle };
}
