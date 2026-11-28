import { useId } from "react";
import { useTranslation } from "react-i18next";

/**
 * The header at the top of every dashboard layout, including the skeleton and
 * the error panel (spec 02-01 §這一頁顯示哪一種版面 5–8; ui-design.md §元件樹):
 * the h1 and its subtitle, in a region named by the h1. Nothing in it is
 * focusable.
 */
export function DashboardHeader() {
  const { t } = useTranslation("dashboard");
  const titleId = useId();

  return (
    <section aria-labelledby={titleId}>
      <h1
        id={titleId}
        className="mb-(--space-xs) font-(family-name:--font-serif-display) text-(length:--text-h2) leading-(--leading-snug) font-bold text-foreground"
      >
        {t("title")}
      </h1>
      <p className="text-(length:--text-caption) text-muted-foreground">{t("subtitle")}</p>
    </section>
  );
}
