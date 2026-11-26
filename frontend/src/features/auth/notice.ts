/**
 * The one sentence the sign-in page may show in its error banner
 * (login-auth-guard design D7, ui-design §畫面狀態). The text always comes from
 * the `auth` namespace by this value, never from the backend's `message`.
 */
import { isApiError } from "@/api/api-error";

/** Which sentence the banner shows; each maps to `login.error.<notice>`. */
export const loginNoticeValues = [
  "invalidCredentials",
  "googleRejected",
  "sessionExpired",
  "sessionInvalid",
  "unavailable",
] as const;

export type LoginNotice = (typeof loginNoticeValues)[number];

/** The navigation state that carries a notice to the sign-in page (never the URL). */
export interface LoginNoticeState {
  /** The sentence to show once. */
  loginNotice: LoginNotice;
}

/** The `auth` key of a notice's sentence. */
export function noticeKey(notice: LoginNotice): `login.error.${LoginNotice}` {
  return `login.error.${notice}`;
}

/** Builds the navigation state for `notice`. */
export function noticeState(notice: LoginNotice): LoginNoticeState {
  return { loginNotice: notice };
}

/**
 * Reads a notice from a navigation state. The state is whatever the history
 * entry holds, so anything but a known value is ignored (Hard Rule 9).
 */
export function readNoticeState(state: unknown): LoginNotice | null {
  if (typeof state !== "object" || state === null || !("loginNotice" in state)) {
    return null;
  }
  const value = state.loginNotice;
  return loginNoticeValues.find((notice) => notice === value) ?? null;
}

/** True when the request never got a usable answer: offline, timed out, a non-envelope or a 5xx. */
function isNoResponse(error: unknown): boolean {
  if (!isApiError(error)) {
    return true;
  }
  return error.kind !== "http" || (error.status ?? 0) >= 500;
}

/**
 * The sentence for a failed "current session" check (ui-design X7, U6): the
 * refresh's own code picks one of the two passive sign-out sentences; no
 * session at all (`AUTH_REQUIRED`) or a used-up conflict shows nothing; no
 * response shows the retry sentence.
 */
export function noticeForSessionError(error: unknown): LoginNotice | null {
  if (isApiError(error) && error.code === "ACCOUNT_SESSION_EXPIRED") {
    return "sessionExpired";
  }
  if (isApiError(error) && error.code === "ACCOUNT_SESSION_INVALID") {
    return "sessionInvalid";
  }
  if (
    isApiError(error) &&
    (error.code === "AUTH_REQUIRED" || error.code === "ACCOUNT_REFRESH_CONFLICT")
  ) {
    return null;
  }
  return isNoResponse(error) ? "unavailable" : null;
}

/** The sentence for a failed Email-and-password sign-in: one for wrong credentials, else the retry one. */
export function noticeForSignInError(error: unknown): LoginNotice {
  return isApiError(error) && error.code === "ACCOUNT_INVALID_CREDENTIALS"
    ? "invalidCredentials"
    : "unavailable";
}
