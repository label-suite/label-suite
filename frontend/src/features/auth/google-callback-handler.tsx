/**
 * The Google callback (ui-design §元件樹 › Google 回調; spec account-login E1,
 * E2). No visible content: it hands Google's `code` and `state` to the backend
 * once and moves on, always replacing the callback entry, so the URL with
 * `code` and `state` never stays in the history. The two values are passed to
 * the backend only, never stored, logged or shown.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { isApiError } from "@/api/api-error";
import { createGoogleSession } from "@/api/generated/label-suite";

import { noticeState, type LoginNotice } from "./notice";
import { LOGIN_PATH } from "./paths";
import { PageBackdrop } from "./route-guards";
import { reloadSessionState } from "./session-query";

/**
 * What a failed completion means for the sign-in page: E1 (the flow did not
 * pass) returns quietly, E2 (the account is rejected) shows the Google
 * sentence, anything else shows the retry sentence.
 */
function noticeForCompletionError(error: unknown): LoginNotice | null {
  if (isApiError(error) && error.code === "ACCOUNT_GOOGLE_FLOW_INVALID") {
    return null;
  }
  if (isApiError(error) && error.code === "ACCOUNT_GOOGLE_REJECTED") {
    return "googleRejected";
  }
  return "unavailable";
}

/** Reads Google's answer from the URL and completes the sign-in once. */
export function GoogleCallbackHandler() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // StrictMode runs this effect twice on the same component; the flow cookie
  // for `state` works only once, so a second request would turn into E1.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    const backToLogin = (notice: LoginNotice | null) => {
      navigate(LOGIN_PATH, { replace: true, state: notice === null ? null : noticeState(notice) });
    };
    const code = params.get("code");
    const state = params.get("state");
    if (params.has("error") || code === null || code === "" || state === null || state === "") {
      backToLogin(null);
      return;
    }

    const complete = async () => {
      try {
        await createGoogleSession({ code, state });
      } catch (error: unknown) {
        backToLogin(noticeForCompletionError(error));
        return;
      }
      // The guard replaces this entry with the landing page once the cache says "signed in".
      const session = await reloadSessionState(queryClient);
      if (session.kind === "signedOut") {
        backToLogin(session.notice ?? "unavailable");
      }
    };
    void complete();
  }, [navigate, params, queryClient]);

  return <PageBackdrop />;
}
