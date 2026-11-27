/**
 * The look of the sidebar's top-level items, shared by plain links and the
 * System Administration button (design/system App Shell; ui-design §元件與
 * design token).
 */
import {
  CirclePlus,
  LayoutDashboard,
  LayoutGrid,
  PenLine,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { NavKey, ShellViewport } from "./types";

/** Each destination's Lucide icon, as the prototype draws it (sidebar.js:1067). */
export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  taskManagement: CirclePlus,
  annotation: PenLine,
  datasetAnalysis: LayoutGrid,
  systemAdmin: Settings,
  profile: User,
};

/**
 * The look of a top-level item, link or button alike. The current location is
 * styled from `data-current`, so it shows by weight and background, not by
 * colour alone (ui-design §無障礙), whether or not the element carries
 * aria-current. On a phone each item gets an equal share of the bottom bar;
 * a label longer than its share wraps, breaking inside a word only when a
 * word alone is wider than the item (maintainer ruling on Q13), so English
 * labels are never cut off or spill into the next item.
 */
export function navItemClassName(viewport: ShellViewport, collapsed: boolean): string {
  return cn(
    "flex cursor-pointer items-center rounded-(--radius-md) text-(length:--text-label) font-medium text-muted-foreground outline-none transition-colors duration-(--dur-fast) ease-(--ease-standard) hover:bg-surface-subtle hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none motion-reduce:duration-0 data-[current=true]:bg-nav-active data-[current=true]:font-semibold data-[current=true]:text-primary [&[data-current=true]>svg:first-child]:text-icon-accent",
    viewport === "mobile"
      ? "min-w-0 flex-1 flex-col justify-center gap-(--space-xs) px-0.5 py-(--space-sm) text-center leading-tight whitespace-normal [overflow-wrap:anywhere]"
      : "w-full gap-2.5 px-3 py-2.5 text-left",
    viewport === "desktop" && collapsed && "justify-center p-2.5",
  );
}
