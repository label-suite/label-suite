import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";

import { useFocusOnMount } from "./use-focus-on-mount";

/** The four metrics of block A, in order; keys under `stats` in `dashboard`. */
const METRICS = ["totalUsers", "projectLeaders", "annotators", "reviewers"] as const;

/** Props of {@link PlatformUserStats}. */
export interface PlatformUserStatsProps {
  /**
   * Move focus to the block title on mount. Reserved for the page's focus
   * handling (design D9); a first load leaves focus alone.
   */
  focusOnMount?: boolean;
}

/**
 * Block A of the system administrator's layout (spec 02-01 §系統管理員看到的
 * 四個區塊 1, 2, 4; §審核概況那三張卡是示範值; clarification Q2, Q5): four
 * Metric tiles whose values are fixed `0 人` strings from the locale file, and
 * a visible demo note below them in the same block. No request is sent.
 *
 * The outer grid follows `.grid-3` (auto-fit, 300px minimum from 768px, one
 * column below); the metric grid is two columns up to 767px and auto-fit at a
 * 150px minimum from 768px (`.metrics-readable-labels`; layout literals, Q9).
 */
export function PlatformUserStats({ focusOnMount = false }: PlatformUserStatsProps) {
  const { t } = useTranslation("dashboard");
  const titleId = useId();
  const titleRef = useFocusOnMount<HTMLHeadingElement>(focusOnMount);

  return (
    <div
      data-testid="super-admin-view"
      className="grid grid-cols-1 gap-(--space-lg) md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]"
    >
      <Card
        role="region"
        aria-labelledby={titleId}
        className="min-w-0 gap-(--space-md) rounded-(--radius-lg) px-(--space-lg) shadow-none"
      >
        <div>
          <h2
            id={titleId}
            ref={titleRef}
            tabIndex={-1}
            className="text-(length:--text-body) leading-(--leading-normal) font-semibold text-foreground"
          >
            {t("stats.title")}
          </h2>
          <p className="mt-(--space-xs) text-(length:--text-caption) leading-(--leading-relaxed) text-muted-foreground">
            {t("stats.subtitle")}
          </p>
        </div>
        <div>
          <div className="grid grid-cols-2 gap-(--space-md) md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            {METRICS.map((key) => (
              <Metric key={key} label={t(`stats.${key}.label`)} value={t(`stats.${key}.value`)} />
            ))}
          </div>
          <p className="mt-(--space-sm) text-(length:--text-caption) text-muted-foreground">
            {t("stats.demoNote")}
          </p>
        </div>
      </Card>
    </div>
  );
}
