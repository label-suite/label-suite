import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

import { NavItemLink } from "./nav-item-link";
import { NAV_ICONS, navItemClassName } from "./nav-item-style";
import type { ShellNavClickHandler, ShellNavItem, ShellSubNavItem, ShellViewport } from "./types";

/** Props of {@link AdminNavGroup}. */
export interface AdminNavGroupProps {
  /** The System Administration item, with its submenu entries. */
  item: ShellNavItem;
  /** Desktop sidebar or phone bottom bar. */
  viewport: ShellViewport;
  /** The desktop sidebar is collapsed. */
  collapsed: boolean;
  /** Told about every link click, before the router follows it. */
  onNavClick?: ShellNavClickHandler;
}

const SUBMENU_LINK =
  "flex min-h-11 items-center rounded-(--radius-md) px-(--space-md) text-(length:--text-label) font-medium text-muted-foreground outline-none transition-colors duration-(--dur-fast) ease-(--ease-standard) hover:bg-surface-subtle hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none data-[current=true]:font-semibold data-[current=true]:text-primary";

/** While `open`, a pointer press outside `container` sets it closed. */
function useCloseOnOutsidePress(
  open: boolean,
  container: RefObject<HTMLElement | null>,
  setOpen: (open: boolean) => void,
): void {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && container.current?.contains(event.target) === true) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, container, setOpen]);
}

/** Props of {@link AdminSubmenu}. */
interface AdminSubmenuProps {
  /** The id the trigger's aria-controls points at. */
  id: string;
  /** The submenu is shown; its links exist only then. */
  open: boolean;
  /** User Management and Role Settings. */
  entries: readonly ShellSubNavItem[];
  /** Told about every link click, before the router follows it. */
  onNavClick?: ShellNavClickHandler;
}

/** The submenu: a plain list of links, hidden while closed. */
function AdminSubmenu({ id, open, entries, onNavClick }: AdminSubmenuProps) {
  const { t } = useTranslation("appShell");

  return (
    <div
      id={id}
      data-testid="admin-nav-submenu"
      hidden={!open}
      className="mt-(--space-xs) flex flex-col gap-(--space-xs) pl-(--space-xl)"
    >
      {open
        ? entries.map((entry) => (
            <Link
              key={entry.key}
              to={entry.href}
              data-testid={
                entry.key === "userManagement"
                  ? "admin-nav-user-management-link"
                  : "admin-nav-role-settings-link"
              }
              aria-current={entry.current ? "page" : undefined}
              data-current={entry.current}
              onClick={(event) => {
                onNavClick?.(entry, event);
              }}
              className={SUBMENU_LINK}
            >
              {t(entry.labelKey)}
            </Link>
          ))
        : null}
    </div>
  );
}

/**
 * System Administration (design/system App Shell 「系統管理次選單」; spec
 * 07-01 §系統管理的次選單). On a desktop sidebar that is not collapsed it is a
 * disclosure: a button with aria-expanded that shows a plain list of two
 * links (not role="menu", design D13). Enter or Space opens and closes it,
 * Tab walks the links, Esc closes it and returns focus to the button, and a
 * pointer press outside closes it. On a phone or a collapsed sidebar it is a
 * plain link to User Management, and an open submenu closes.
 *
 * Only one element carries aria-current="page": a current submenu entry while
 * the submenu is shown, otherwise the button.
 */
export function AdminNavGroup({ item, viewport, collapsed, onNavClick }: AdminNavGroupProps) {
  const { t } = useTranslation("appShell");
  const disclosure = viewport === "desktop" && !collapsed;
  const [open, setOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submenuId = useId();

  // Collapsing or narrowing the window closes the submenu, so it is shut when it comes back.
  if (!disclosure && open) {
    setOpen(false);
  }

  useCloseOnOutsidePress(open, groupRef, setOpen);

  if (!disclosure) {
    return (
      <NavItemLink item={item} viewport={viewport} collapsed={collapsed} onNavClick={onNavClick} />
    );
  }

  const entries = item.children ?? [];
  const entryIsCurrent = open && entries.some((entry) => entry.current);
  const label = t(item.labelKey);
  const Icon = NAV_ICONS[item.key];

  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={groupRef} className="flex flex-col" onKeyDown={closeOnEscape}>
      <button
        ref={triggerRef}
        type="button"
        data-testid="admin-nav-trigger"
        title={label}
        aria-expanded={open}
        aria-controls={submenuId}
        aria-current={item.current && !entryIsCurrent ? "page" : undefined}
        data-current={item.current}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className={navItemClassName(viewport, collapsed)}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span>{label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "ml-auto size-3 shrink-0 text-muted-foreground transition-colors duration-(--dur-fast) ease-(--ease-standard) motion-reduce:transition-none",
            open && "text-icon-accent",
          )}
        />
      </button>
      <AdminSubmenu id={submenuId} open={open} entries={entries} onNavClick={onNavClick} />
    </div>
  );
}
