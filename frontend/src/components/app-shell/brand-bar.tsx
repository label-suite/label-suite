import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { BrandMark } from "@/components/brand-mark";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

import { MOBILE_TOP_BAR_HEIGHT } from "./dimensions";
import { SignOutButton } from "./sign-out-button";
import type { ShellViewport } from "./types";

/** Props of {@link BrandBar}. */
export interface BrandBarProps {
  /** Top of the desktop sidebar, or the phone's fixed top bar. */
  viewport: ShellViewport;
  /** The desktop sidebar is collapsed: only the logo stays. */
  collapsed: boolean;
  /** Where the brand link goes (the landing page). */
  brandHref: string;
  /** The sign-out request is in flight (the phone bar has a sign-out button). */
  signingOut: boolean;
  /** Starts signing out. */
  onSignOut: () => void;
}

/**
 * The brand area (design/system App Shell 「側欄本體」 品牌區): the brand link
 * with the shared Brand Mark and the wordmark, and the shared language
 * switch. On a phone it is the fixed top bar and also holds the compact
 * appearance switch and the sign-out button; it never shows the user's name
 * and has no shortcut entry (ui-design §響應式).
 */
export function BrandBar({ viewport, collapsed, brandHref, signingOut, onSignOut }: BrandBarProps) {
  const { t } = useTranslation("common");
  const desktop = viewport === "desktop";

  return (
    <div
      className={
        desktop
          ? cn(
              "mb-(--space-xl) flex items-center gap-(--space-sm) border-b border-border pb-(--space-lg)",
              collapsed && "flex-col",
            )
          : cn(
              "fixed inset-x-0 top-0 z-(--z-sticky) flex items-center gap-(--space-sm) border-b border-border bg-card px-(--space-md)",
              MOBILE_TOP_BAR_HEIGHT,
            )
      }
    >
      <Link
        to={brandHref}
        aria-label={t("brandHome")}
        className={cn(
          "flex min-w-0 items-center gap-(--space-sm) rounded-(--radius-md) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          !desktop && "flex-1",
        )}
      >
        <BrandMark className="size-9 rounded-(--radius-md)" iconClassName="size-5" />
        {collapsed ? null : (
          <span
            className={cn(
              "font-(family-name:--font-serif-display) leading-none font-bold text-foreground",
              desktop ? "text-(length:--text-body)" : "text-(length:--text-label)",
            )}
          >
            Label Suite
          </span>
        )}
      </Link>
      {collapsed ? null : (
        <div className={cn("shrink-0", desktop && "ml-auto")}>
          <LanguageToggle compact={!desktop} />
        </div>
      )}
      {desktop ? null : (
        <>
          <ThemeToggle compact />
          <SignOutButton placement="phone" signingOut={signingOut} onSignOut={onSignOut} />
        </>
      )}
    </div>
  );
}
