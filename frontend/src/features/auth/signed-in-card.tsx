import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { ROLE_NAME_KEYS } from "./role-names";
import { useSessionState } from "./session-query";

/**
 * The temporary landing card (maintainer-approved artifact; ui-design §元件樹 ›
 * 暫時落點): "you're signed in", the account's own name and Email, its system
 * role (never a task role) and a note. Signing out is the sidebar's job
 * (sidebar-nav clarification Q2), so the card has no button. It reads the
 * same session query as the guard, so it sends no request of its own.
 */
export function SignedInCard() {
  const { t } = useTranslation("auth");
  const session = useSessionState();
  const titleId = useId();
  if (session.data?.kind !== "signedIn") {
    return null;
  }
  const { user } = session.data;
  const identity =
    user.name === "" ? user.email : t("dashboard.identity", { name: user.name, email: user.email });

  return (
    <Card
      role="region"
      aria-labelledby={titleId}
      className="w-full max-w-120 items-center gap-(--space-md) rounded-(--radius-lg) border-0 px-(--space-lg) py-(--space-lg) text-center md:px-(--space-xl) md:py-(--space-xl)"
    >
      <h1 id={titleId} className="text-(length:--text-h3) font-semibold text-foreground">
        {t("dashboard.title")}
      </h1>
      <p className="text-(length:--text-caption) break-all text-muted-foreground">{identity}</p>
      <Badge variant="role">{t(ROLE_NAME_KEYS[user.role])}</Badge>
      <p className="text-(length:--text-caption) text-muted-foreground">
        {t("dashboard.description")}
      </p>
    </Card>
  );
}
