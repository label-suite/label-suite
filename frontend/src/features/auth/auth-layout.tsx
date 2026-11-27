import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { BrandMark } from "@/components/brand-mark";
import { LanguageToggle } from "@/components/language-toggle";

import { guardLink } from "./guard-link";

/** Props of {@link AuthLayout}. */
export interface AuthLayoutProps {
  /** The single centred card. */
  children: ReactNode;
  /** A request is in flight: the brand link and the language switch do nothing. */
  frozen?: boolean;
  /** Called after the interface language has switched. */
  onLanguageChange?: () => void;
}

/**
 * The signed-out shell of the sign-in and landing pages (design/system Auth
 * Navbar; ui-design §元件樹 › 共用外殼): a sticky header with the brand link
 * and the language switch, and a main area that centres one card. No sidebar.
 */
export function AuthLayout({ children, frozen = false, onLanguageChange }: AuthLayoutProps) {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-(--z-sticky) flex h-14 items-center justify-between border-b border-border bg-card px-(--space-md) md:h-16 md:px-(--space-xl)">
        <Link
          to="/"
          aria-label={t("brandHome")}
          {...guardLink(frozen)}
          className="flex items-center gap-(--space-sm) rounded-(--radius-md) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <BrandMark className="size-7 rounded-(--radius-md) md:size-8" iconClassName="size-5" />
          <span className="font-(family-name:--font-serif-display) text-(length:--text-body) leading-none font-bold text-foreground md:text-(length:--text-h3)">
            Label Suite
          </span>
        </Link>
        <LanguageToggle disabled={frozen} onChange={onLanguageChange} />
      </header>
      <main className="flex flex-1 items-start justify-center px-(--space-md) py-(--space-lg) md:items-center md:py-(--space-2xl)">
        {children}
      </main>
    </div>
  );
}
