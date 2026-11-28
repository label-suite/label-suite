import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { FOCUS_RING } from "./focus-ring";
import { useFocusOnMount } from "./use-focus-on-mount";

/** Props of {@link DashboardLoadError}. */
export interface DashboardLoadErrorProps {
  /** Asks the task-role source to load again; the page then shows the skeleton. */
  onRetry: () => void;
  /**
   * Move focus to Retry on mount. The page sets it when a retried load failed
   * again (design D9), so focus does not fall back to the page start.
   */
  focusOnMount?: boolean;
}

/**
 * The layout area when the task roles failed to load (spec 02-01 §這一頁顯示
 * 哪一種版面 13–15; the page-only `.dashboard-error-state`): an alert with an
 * icon, the fixed title and description, and Retry. It never shows the
 * server's message, code or traceId. Retry is not marked busy: the page swaps
 * this panel for the skeleton, so there is nothing left to press twice.
 */
export function DashboardLoadError({ onRetry, focusOnMount = false }: DashboardLoadErrorProps) {
  const { t } = useTranslation("dashboard");
  const retryRef = useFocusOnMount<HTMLButtonElement>(focusOnMount);

  return (
    <Card
      role="alert"
      data-testid="dashboard-error-state"
      className="items-center gap-(--space-sm) rounded-(--radius-lg) px-(--space-lg) py-(--space-2xl) text-center shadow-none"
    >
      <CircleAlert aria-hidden="true" className="size-8 text-error" />
      <p className="text-(length:--text-body) font-bold text-foreground">{t("error.title")}</p>
      <p className="mb-(--space-sm) text-(length:--text-label) text-muted-foreground">
        {t("error.description")}
      </p>
      <Button
        ref={retryRef}
        type="button"
        variant="cta"
        className={`font-semibold ${FOCUS_RING}`}
        onClick={onRetry}
      >
        {t("error.retry")}
      </Button>
    </Card>
  );
}
