/**
 * The sign-in page's local state and actions (ui-design §狀態放哪裡, §畫面狀態
 * › 登入表單, › Google 登入). Field values, field errors, the banner and the
 * "in flight" flag are page-local; the session itself is the shared query.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { createSession, getGoogleAuthorization } from "@/api/generated/label-suite";

import { goToExternalUrl } from "./external-navigation";
import { noticeForSignInError, type LoginNotice } from "./notice";
import { reloadSessionState } from "./session-query";

/** The two fields of the form. */
export type LoginField = "email" | "password";

/** Which request is in flight; either one freezes the whole page (U1). */
export type LoginBusy = "password" | "google" | null;

/** What the sign-in page renders from. */
export interface LoginController {
  /** The typed values; kept after a failure. */
  values: Record<LoginField, string>;
  /** Which fields show their "required" message. */
  missing: Record<LoginField, boolean>;
  /** The banner's sentence, or null. */
  notice: LoginNotice | null;
  /** The request in flight, or null. */
  busy: LoginBusy;
  /** Types into a field: clears that field's error and the banner (U2). */
  change: (field: LoginField, value: string) => void;
  /** Validates the two required fields and signs in once. */
  submit: () => void;
  /** Fetches Google's authorisation URL once and leaves for it. */
  startGoogle: () => void;
  /** The language switched: field errors and the banner go away. */
  languageChanged: () => void;
}

const NONE_MISSING: Record<LoginField, boolean> = { email: false, password: false };

/** True for an absolute http(s) URL; anything else from the backend is not followed. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * The sign-in page's state.
 *
 * @param initialNotice The sentence the page opens with (a passive sign-out, Google E2, no response).
 */
export function useLoginController(initialNotice: LoginNotice | null): LoginController {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<LoginField, string>>({ email: "", password: "" });
  const [missing, setMissing] = useState(NONE_MISSING);
  const [notice, setNotice] = useState(initialNotice);
  const [busy, setBusyState] = useState<LoginBusy>(null);
  // Read synchronously, so a second click before the re-render still sees the first.
  const busyRef = useRef<LoginBusy>(null);

  const setBusy = (next: LoginBusy) => {
    busyRef.current = next;
    setBusyState(next);
  };

  const signIn = async (email: string, typed: string) => {
    try {
      await createSession({ email, password: typed });
    } catch (error: unknown) {
      setNotice(noticeForSignInError(error));
      setBusy(null);
      return;
    }
    // The guard moves to the landing page once the cache says "signed in".
    const state = await reloadSessionState(queryClient);
    if (state.kind === "signedOut") {
      setNotice(state.notice ?? "unavailable");
      setBusy(null);
    }
  };

  const submit = () => {
    if (busyRef.current !== null) {
      return;
    }
    setNotice(null);
    const email = values.email.trim();
    const nextMissing = { email: email === "", password: values.password === "" };
    setMissing(nextMissing);
    if (nextMissing.email || nextMissing.password) {
      return;
    }
    setBusy("password");
    void signIn(email, values.password);
  };

  const leaveForGoogle = async () => {
    try {
      const response = await getGoogleAuthorization();
      const url = response.data.authorizationUrl;
      if (!isHttpUrl(url)) {
        throw new Error("The authorisation URL is not an http(s) URL");
      }
      // The page stays frozen while the browser leaves.
      goToExternalUrl(url);
    } catch {
      setNotice("unavailable");
      setBusy(null);
    }
  };

  const startGoogle = () => {
    if (busyRef.current !== null) {
      return;
    }
    setNotice(null);
    setBusy("google");
    void leaveForGoogle();
  };

  const change = (field: LoginField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setMissing((current) => ({ ...current, [field]: false }));
    setNotice(null);
  };

  const languageChanged = () => {
    setMissing(NONE_MISSING);
    setNotice(null);
  };

  return { values, missing, notice, busy, change, submit, startGoogle, languageChanged };
}
