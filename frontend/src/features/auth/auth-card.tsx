import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

import { BrandMark } from "./brand-mark";

/** Props of {@link AuthCard}. */
export interface AuthCardProps {
  /** The region's accessible name (「登入」／Sign in). */
  label: string;
  /** The h1 under the large brand mark. */
  title: string;
  /** The line under the title. */
  subtitle: string;
  /** The banner, the sign-in buttons and the form. */
  children: ReactNode;
}

/**
 * The single card of an account page (design/system Auth Card): a region with
 * the large brand mark, the serif title and the subtitle, then its content.
 * 480px at most; tighter padding on phones.
 */
export function AuthCard({ label, title, subtitle, children }: AuthCardProps) {
  return (
    <Card
      role="region"
      aria-label={label}
      className="w-full max-w-120 gap-(--space-md) rounded-(--radius-lg) border-0 px-(--space-lg) py-(--space-lg) md:px-(--space-xl) md:py-(--space-xl)"
    >
      <div className="mb-(--space-sm) flex flex-col items-center gap-(--space-sm) text-center">
        <BrandMark className="size-13 rounded-(--radius-lg) md:size-14" iconClassName="size-7.5" />
        <h1 className="font-(family-name:--font-serif-display) text-(length:--text-h2) leading-tight font-bold text-foreground">
          {title}
        </h1>
        <p className="text-(length:--text-body) text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </Card>
  );
}
