/**
 * What the current route declares to the shell (sidebar-nav design D4): its
 * item (`navKey`), its System Administration entry (`adminSubKey`) and a fixed
 * role label (`roleIndicator`). React Router types `handle` as unknown, so
 * the declaration is checked here instead of asserted.
 */
import type { AdminSubKey, NavKey } from "@/components/app-shell/types";

import type { SidebarRouteDeclaration } from "./sidebar-nav-model";

const NAV_KEYS: readonly NavKey[] = [
  "dashboard",
  "taskManagement",
  "annotation",
  "datasetAnalysis",
  "systemAdmin",
  "profile",
];

const ADMIN_SUB_KEYS: readonly AdminSubKey[] = ["userManagement", "roleSettings"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * The deepest valid declaration among the matched routes' handles.
 *
 * @param handles The `handle` of every matched route, outermost first.
 * @returns The declaration, or null when no route declares a known `navKey`.
 */
export function readRouteDeclaration(handles: readonly unknown[]): SidebarRouteDeclaration | null {
  for (const handle of [...handles].reverse()) {
    if (!isRecord(handle)) {
      continue;
    }
    const navKey = NAV_KEYS.find((key) => key === handle.navKey);
    if (navKey === undefined) {
      continue;
    }
    const adminSubKey = ADMIN_SUB_KEYS.find((key) => key === handle.adminSubKey);
    return {
      navKey,
      ...(adminSubKey === undefined ? {} : { adminSubKey }),
      ...(handle.roleIndicator === "systemAdmin" ? { roleIndicator: "systemAdmin" as const } : {}),
    };
  }
  return null;
}
