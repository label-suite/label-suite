/**
 * Signs this browser out (spec 01-05 §從這一台登出; sidebar-nav design D11).
 * Whatever the answer, the cached session and every other cached query are
 * dropped and the guard sends the page to sign-in, replacing the history
 * entry: the screen does not tell apart whether the server-side session ended
 * (第 4 條). Every sign-out button in the shell shares one hook instance
 * through the composition layer, so they share one progress state.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { useDeleteCurrentSession } from "@/api/generated/label-suite";

import { markSignedOut } from "./session-query";

/** What a sign-out button needs. */
export interface SignOut {
  /** Starts signing out; a second call before the first settles does nothing. */
  signOut: () => void;
  /** The request is in flight. */
  signingOut: boolean;
}

/** Sign-out for this browser: one request per press, signed out whatever happens. */
export function useSignOut(): SignOut {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useDeleteCurrentSession();
  // isPending only changes on the next render; the ref stops a second press in the same tick.
  const sent = useRef(false);

  const signOut = useCallback(() => {
    if (sent.current) {
      return;
    }
    sent.current = true;
    mutate(undefined, {
      onSettled: () => {
        markSignedOut(queryClient);
      },
    });
  }, [mutate, queryClient]);

  return { signOut, signingOut: isPending };
}
