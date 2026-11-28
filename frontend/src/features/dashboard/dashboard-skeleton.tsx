import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useFocusOnMount } from "./use-focus-on-mount";

/** Props of {@link DashboardSkeleton}. */
export interface DashboardSkeletonProps {
  /**
   * Move focus to the status hint on mount. The page sets it only when a retry
   * brought the skeleton back (design D9); a first load leaves focus alone.
   */
  focusOnMount?: boolean;
}

/** Shadowless block frame (ui-design.md §元件樹「Card 不帶陰影」). */
const BLOCK = "gap-(--space-md) rounded-(--radius-lg) px-(--space-lg) shadow-none";

/** The two header bars of a block: 100px and 160px wide, 12px tall, 6px apart (UXC-08). */
function BlockHeaderBars() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton animation="shimmer" className="h-3 w-25" />
      <Skeleton animation="shimmer" className="h-3 w-40" />
    </div>
  );
}

/**
 * One metric placeholder. The frame repeats Metric's (border, `--radius-lg`,
 * `--space-md` padding) and each bar takes the line box of the text it stands
 * for (`h-lh` at Metric's font size and leading), so the finished tile lands
 * where the placeholder was. Only Skeleton is drawn; Metric itself is not used.
 */
function MetricPlaceholder() {
  return (
    <div className="flex flex-col rounded-(--radius-lg) border border-border bg-card p-(--space-md)">
      <Skeleton
        animation="shimmer"
        className="mb-(--space-xs) h-lh w-3/5 text-(length:--text-label)"
      />
      <Skeleton
        animation="shimmer"
        className="h-lh w-2/5 text-(length:--text-h3) leading-(--leading-tight)"
      />
    </div>
  );
}

/**
 * The layout area while the task roles load (spec 02-01 §這一頁顯示哪一種版面
 * 9–12; ui-design.md §元件樹, §無障礙): a block with four metric placeholders
 * and a block with three rows, after `dashboard.html:68`–`:97`. The region is
 * busy, polite and named by its status hint 載入中, which is focusable from
 * script only. It carries no data at all.
 */
export function DashboardSkeleton({ focusOnMount = false }: DashboardSkeletonProps) {
  const { t } = useTranslation("dashboard");
  const hintId = useId();
  const hintRef = useFocusOnMount<HTMLParagraphElement>(focusOnMount);

  return (
    <section
      aria-labelledby={hintId}
      aria-busy="true"
      aria-live="polite"
      data-testid="dashboard-skeleton"
      className="grid gap-(--space-lg)"
    >
      <p id={hintId} ref={hintRef} tabIndex={-1} className="sr-only">
        {t("loading")}
      </p>
      <Card className={BLOCK}>
        <BlockHeaderBars />
        <div
          data-testid="dashboard-skeleton-metrics"
          className="grid grid-cols-2 gap-(--space-md) md:grid-cols-4"
        >
          <MetricPlaceholder />
          <MetricPlaceholder />
          <MetricPlaceholder />
          <MetricPlaceholder />
        </div>
      </Card>
      <Card className={BLOCK}>
        <BlockHeaderBars />
        <div data-testid="dashboard-skeleton-rows" className="grid gap-(--space-sm)">
          <Skeleton animation="shimmer" className="h-12" />
          <Skeleton animation="shimmer" className="h-12" />
          <Skeleton animation="shimmer" className="h-12" />
        </div>
      </Card>
    </section>
  );
}
