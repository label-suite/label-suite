import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteCurrentSession } from "@/api/generated/label-suite";
import { Button } from "@/components/ui/button";

import { markSignedOut } from "./session-query";

/**
 * Signs this browser out (spec 01-05 §從這一台登出). Whatever the answer, the
 * cached session and every other cached query are dropped and the guard sends
 * the page to sign-in, replacing the history entry: the screen does not tell
 * apart whether the server-side session ended (第 4 條). While the request is
 * in flight the button ignores mouse and keyboard, so it is sent once.
 */
export function LogoutButton() {
  const { t } = useTranslation("auth");
  const queryClient = useQueryClient();
  const signOut = useDeleteCurrentSession();
  // isPending only changes on the next render; the ref stops a second press in the same tick.
  const sent = useRef(false);

  const onClick = () => {
    if (sent.current) {
      return;
    }
    sent.current = true;
    signOut.mutate(undefined, {
      onSettled: () => {
        markSignedOut(queryClient);
      },
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      loading={signOut.isPending}
      onClick={onClick}
      className="rounded-(--radius-md) border-input text-foreground hover:bg-accent hover:text-foreground"
    >
      {signOut.isPending ? <span className="sr-only">{t("loading")}</span> : t("dashboard.signOut")}
    </Button>
  );
}
