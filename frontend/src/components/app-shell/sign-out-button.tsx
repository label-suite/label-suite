import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Where the sign-out button sits; each place has its own size (prototype sidebar.css). */
export type SignOutButtonPlacement = "summary" | "collapsed" | "phone";

const PLACEMENT_CLASSES: Record<SignOutButtonPlacement, string> = {
  summary: "size-7",
  collapsed: "size-10 border-border bg-card",
  phone: "size-8.5 border-border bg-card hover:border-error-border",
};

/** Props of {@link SignOutButton}. */
export interface SignOutButtonProps {
  /** Beside the user summary, alone in a collapsed sidebar, or in the phone brand bar. */
  placement: SignOutButtonPlacement;
  /** The sign-out request is in flight: shows progress and ignores further presses. */
  signingOut: boolean;
  /** Starts signing out. */
  onSignOut: () => void;
}

/**
 * The shell's sign-out icon button (design/system App Shell 「登出」). While
 * the request is in flight it shows the Button spinner with aria-busy, and
 * mouse and keyboard presses do nothing (the Button's `loading`).
 */
export function SignOutButton({ placement, signingOut, onSignOut }: SignOutButtonProps) {
  const { t } = useTranslation("appShell");
  const label = t("signOut");

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      loading={signingOut}
      aria-label={label}
      title={label}
      onClick={onSignOut}
      className={cn(
        "shrink-0 rounded-(--radius-sm) px-0 text-muted-foreground duration-(--dur-fast) hover:bg-error-bg hover:text-error has-[>svg]:px-0",
        PLACEMENT_CLASSES[placement],
      )}
    >
      {signingOut ? null : <LogOut aria-hidden="true" />}
    </Button>
  );
}
