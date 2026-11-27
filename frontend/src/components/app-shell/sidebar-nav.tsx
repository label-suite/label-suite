import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import { AdminNavGroup } from "./admin-nav-group";
import { MOBILE_NAV_HEIGHT } from "./dimensions";
import { NavItemLink } from "./nav-item-link";
import type { ShellNavClickHandler, ShellNavItem, ShellViewport } from "./types";

/** Props of {@link SidebarNav}. */
export interface SidebarNavProps {
  /** The items in display order, already filtered by role. */
  items: readonly ShellNavItem[];
  /** Desktop sidebar or phone bottom bar. */
  viewport: ShellViewport;
  /** The desktop sidebar is collapsed. */
  collapsed: boolean;
  /** Told about every link click, before the router follows it. */
  onNavClick?: ShellNavClickHandler;
}

/**
 * The main navigation (design/system App Shell 「側欄本體」): a column of items
 * in the desktop sidebar, or the phone's fixed bottom bar with the icon above
 * the name and the width shared evenly (ui-design §響應式).
 */
export function SidebarNav({ items, viewport, collapsed, onNavClick }: SidebarNavProps) {
  const { t } = useTranslation("appShell");

  return (
    <nav
      aria-label={t("landmarks.mainNav")}
      className={
        viewport === "desktop"
          ? "flex min-w-0 flex-col gap-(--space-xs)"
          : cn(
              "fixed inset-x-0 bottom-0 z-(--z-sticky) flex items-stretch justify-around border-t border-border bg-card",
              MOBILE_NAV_HEIGHT,
            )
      }
    >
      {items.map((item) =>
        item.children === undefined ? (
          <NavItemLink
            key={item.key}
            item={item}
            viewport={viewport}
            collapsed={collapsed}
            onNavClick={onNavClick}
          />
        ) : (
          <AdminNavGroup
            key={item.key}
            item={item}
            viewport={viewport}
            collapsed={collapsed}
            onNavClick={onNavClick}
          />
        ),
      )}
    </nav>
  );
}
