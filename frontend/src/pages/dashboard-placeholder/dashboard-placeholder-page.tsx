import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { BlockedNotice } from "@/features/app-shell";
import { SignedInCard } from "@/features/auth";

/**
 * /dashboard/dashboard, the temporary landing page (Issue #719 sa-5, sa-7;
 * sidebar-nav clarification Q2, Q4). It is drawn inside the signed-in shell,
 * which provides the brand, the language switch and signing out; the page
 * itself is the card, with the one-time explanation above it when the
 * sidebar blocked a click and sent the user here. 02-01 replaces this
 * component, not the path.
 */
export function DashboardPlaceholderPage() {
  const { t } = useTranslation("auth");
  const documentTitle = t("documentTitle", { ns: "common", page: t("dashboard.pageName") });

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-(--space-lg) px-(--space-md) py-(--space-lg) md:px-(--space-xl) md:py-(--space-2xl)">
      <BlockedNotice />
      <SignedInCard />
    </div>
  );
}
