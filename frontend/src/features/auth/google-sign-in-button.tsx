import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import googleMarkUrl from "./google-g.svg";

/** Props of {@link GoogleSignIn}. */
export interface GoogleSignInProps {
  /** The page is frozen: the button is disabled. */
  disabled: boolean;
  /** Starts the Google sign-in. */
  onStart: () => void;
}

/**
 * "Continue with Google" and the "or" divider below it, which always appear
 * and disappear together (design/system Button `.btn-oauth`, Divider text
 * form; sa-8). The G mark is the brand-mark exception to Lucide-only icons.
 */
export function GoogleSignIn({ disabled, onStart }: GoogleSignInProps) {
  const { t } = useTranslation("auth");

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="google-login-btn"
        aria-label={t("login.googleLabel")}
        disabled={disabled}
        onClick={onStart}
        className="w-full rounded-(--radius-md) border-border text-(length:--text-caption) text-foreground hover:border-ring hover:bg-accent hover:text-foreground"
      >
        <img src={googleMarkUrl} alt="" aria-hidden="true" className="size-4.5" />
        <span>{t("login.google")}</span>
      </Button>
      <div className="flex items-center gap-(--space-md) py-(--space-xs) text-(length:--text-caption) text-muted-foreground">
        <Separator className="flex-1" />
        <span>{t("login.divider")}</span>
        <Separator className="flex-1" />
      </div>
    </>
  );
}
