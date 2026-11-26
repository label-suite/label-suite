import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { AuthLayout, SignedInCard } from "@/features/auth";

/**
 * /dashboard/dashboard, the temporary landing page (Issue #719 sa-5, sa-7;
 * design D12). It keeps the sign-in page's header and card style, with no
 * sidebar; 02-01 replaces this component, not the path.
 */
export function DashboardPlaceholderPage() {
  const { t } = useTranslation("auth");
  const documentTitle = t("documentTitle", { ns: "common", page: t("dashboard.pageName") });

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <AuthLayout>
      <SignedInCard />
    </AuthLayout>
  );
}
