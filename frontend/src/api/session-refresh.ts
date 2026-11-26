/**
 * The session refresh behind apiFetch (login-auth-guard design D7, ui-design
 * §進入、離開與返回 X7, spec 01-05 §多個分頁同時延續登入狀態).
 *
 * A request refused with `401 AUTH_REQUIRED` starts one refresh; requests
 * refused at the same time join it (single-flight). The flow sends at most two
 * refreshes and two resends of the original request:
 *
 * 1. refresh succeeds -> resend once;
 * 2. refresh answers `409 ACCOUNT_REFRESH_CONFLICT` (another tab just
 *    refreshed) -> wait briefly, resend once with the current cookies;
 * 3. that resend is still `401 AUTH_REQUIRED` -> refresh once more, and on
 *    success resend once more;
 * 4. anything else is handed to the caller unchanged, so the caller sees the
 *    refresh's own code (`ACCOUNT_SESSION_EXPIRED`, `ACCOUNT_SESSION_INVALID`
 *    or `AUTH_REQUIRED`) and picks the sentence for the sign-in page.
 */
import { isApiError } from "./api-error";
import { createSessionRefresh } from "./generated/label-suite";

/** How long to wait after a refresh conflict before resending (design D7: 300 ms). */
export const REFRESH_CONFLICT_WAIT_MS = 300;

/** The refresh shared by every request refused while it is in flight. */
let inFlight: Promise<void> | null = null;

/** True only for `401` with code `AUTH_REQUIRED`, the one error that starts a refresh. */
export function isAuthRequired(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.kind === "http" &&
    error.status === 401 &&
    error.code === "AUTH_REQUIRED"
  );
}

/** True for the refresh's `409 ACCOUNT_REFRESH_CONFLICT`. */
function isRefreshConflict(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.kind === "http" &&
    error.status === 409 &&
    error.code === "ACCOUNT_REFRESH_CONFLICT"
  );
}

/**
 * Starts the refresh, or joins the one already in flight. Resolves when the
 * backend has set new cookies; rejects with the refresh's ApiError. The
 * refresh request itself never starts another refresh.
 */
export function refreshSession(): Promise<void> {
  inFlight ??= createSessionRefresh({}, { skipSessionRefresh: true }).then(
    () => {
      inFlight = null;
    },
    (error: unknown) => {
      inFlight = null;
      throw error;
    },
  );
  return inFlight;
}

/** Resolves after `ms` milliseconds. */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Runs `send`; resolves to its result, or to `refused` when it was `401 AUTH_REQUIRED`. */
async function sendUnlessRefused<T>(send: () => Promise<T>): Promise<{ value: T } | "refused"> {
  try {
    return { value: await send() };
  } catch (error: unknown) {
    if (isAuthRequired(error)) {
      return "refused";
    }
    throw error;
  }
}

/** Refreshes; resolves to `conflict` on 409, rethrows every other failure. */
async function refreshUnlessConflict(): Promise<"refreshed" | "conflict"> {
  try {
    await refreshSession();
    return "refreshed";
  } catch (error: unknown) {
    if (isRefreshConflict(error)) {
      return "conflict";
    }
    throw error;
  }
}

/**
 * Sends a request through the refresh flow described at the top of this file.
 *
 * @param send Sends the original request once; called at most three times.
 */
export async function sendWithSessionRefresh<T>(send: () => Promise<T>): Promise<T> {
  const first = await sendUnlessRefused(send);
  if (first !== "refused") {
    return first.value;
  }
  if ((await refreshUnlessConflict()) === "refreshed") {
    return send();
  }
  await wait(REFRESH_CONFLICT_WAIT_MS);
  const afterConflict = await sendUnlessRefused(send);
  if (afterConflict !== "refused") {
    return afterConflict.value;
  }
  await refreshSession();
  return send();
}
