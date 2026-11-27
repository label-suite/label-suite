import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { NAV_ICONS, navItemClassName, phoneLabelKey } from "./nav-item-style";
import type { ShellNavClickHandler, ShellNavItem, ShellViewport } from "./types";

/** Props of {@link NavItemLink}. */
export interface NavItemLinkProps {
  /** The item to draw. */
  item: ShellNavItem;
  /** Desktop sidebar or phone bottom bar. */
  viewport: ShellViewport;
  /** The desktop sidebar shows icons only; the name stays for assistive technology. */
  collapsed: boolean;
  /** Told about every click, before the router follows the link. */
  onNavClick?: ShellNavClickHandler;
}

/**
 * One top-level item as a real link: Ctrl/⌘ and middle clicks are the
 * browser's (ui-design §進入、離開與返回). The current location carries
 * aria-current="page"; the hover hint is the name, following the language.
 * On a phone the text is the soft-hyphenated phone label and the name is set
 * to the plain label, so assistive technology never reads the hyphens.
 */
export function NavItemLink({ item, viewport, collapsed, onNavClick }: NavItemLinkProps) {
  const { t } = useTranslation("appShell");
  const label = t(item.labelKey);
  const phone = viewport === "mobile";
  const Icon = NAV_ICONS[item.key];

  return (
    <Link
      to={item.href}
      title={label}
      // On a phone the visible text carries soft hyphens; the name stays the plain label.
      aria-label={phone ? label : undefined}
      aria-current={item.current ? "page" : undefined}
      data-current={item.current}
      onClick={(event) => {
        onNavClick?.(item, event);
      }}
      className={navItemClassName(viewport, collapsed)}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className={collapsed ? "sr-only" : undefined}>
        {phone ? t(phoneLabelKey(item.labelKey)) : label}
      </span>
    </Link>
  );
}
