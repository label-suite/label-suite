/**
 * /dev/health, a developer-only page (ui-design.md §元件樹 /dev/health): a
 * static header plus the system-health feature's panel. It calls no hook of
 * its own; the panel owns the only request.
 */
import { useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";

import { HealthStatusPanel } from "@/features/system-health";

const NAMESPACE = "systemHealth";

export function DevHealthPage() {
  const { t } = useTranslation(NAMESPACE);
  const pageName = t("pageName");
  const documentTitle = t("documentTitle", { ns: "common", page: pageName });

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <main className="min-h-screen bg-background p-(--space-2xl) text-foreground">
      <header className="mb-(--space-xl) flex flex-col gap-(--space-sm)">
        <p className="text-(length:--text-label) font-medium tracking-wide text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1 className="text-(length:--text-h1) font-semibold">{pageName}</h1>
        <p className="text-(length:--text-caption) text-muted-foreground">
          <Trans
            t={t}
            i18nKey="description"
            components={{
              code: <code className="rounded-sm bg-accent px-1 font-mono text-accent-foreground" />,
            }}
          />
        </p>
      </header>
      <div className="max-w-xl">
        <HealthStatusPanel />
      </div>
    </main>
  );
}
