/**
 * The one "current session" query (login-auth-guard design D7, ui-design
 * §資料來源). Both route guards and the landing page read this cache entry,
 * keyed by the generated query key, so a page load sends one request.
 *
 * The query never fails: a refused or unanswered check resolves to "signed
 * out" with the sentence the sign-in page should show, so the guards only
 * ever branch on data. A 200 whose system role is not one the contract
 * defines also resolves to "signed out", with no sentence and without signing
 * out on the server (dashboard-shell design D11): every guard and the
 * dashboard then agree on one answer, so the page is redirected once instead
 * of bouncing between the sign-in page and the dashboard. Session lifetimes
 * are never computed here; the backend decides (spec 01-05 Q11).
 */
import { useQuery, type QueryClient } from "@tanstack/react-query";

import { isApiError } from "@/api/api-error";
import { getCurrentSession, getGetCurrentSessionQueryKey } from "@/api/generated/label-suite";
import { SessionUserDataRole, type SessionUserData } from "@/api/generated/label-suite.schemas";

import { noticeForSessionError, type LoginNotice } from "./notice";

/** What the guards know about this browser's session. */
export type SessionState =
  | {
      /** A usable session exists. */
      kind: "signedIn";
      /** The signed-in account, as the backend returned it. */
      user: SessionUserData;
    }
  | {
      /** No usable session. */
      kind: "signedOut";
      /** The sentence the sign-in page shows, or null for a clean page. */
      notice: LoginNotice | null;
    };

/** The cache key, shared with the generated client. */
export const sessionQueryKey = getGetCurrentSessionQueryKey();

const SYSTEM_ROLES: readonly unknown[] = Object.values(SessionUserDataRole);

/** Whether `role` is a system role the contract defines (`user`, `super_admin`). */
function isSystemRole(role: unknown): role is SessionUserDataRole {
  return SYSTEM_ROLES.includes(role);
}

/**
 * Asks the backend; maps every refusal or failure except a cancel, and a 200
 * with an unknown system role, to "signed out".
 */
async function fetchSessionState(signal: AbortSignal): Promise<SessionState> {
  try {
    const response = await getCurrentSession(undefined, signal);
    const { user } = response.data;
    // The body is not validated at runtime, so the generated type cannot vouch for the role.
    const role: unknown = user.role;
    if (!isSystemRole(role)) {
      return { kind: "signedOut", notice: null };
    }
    return { kind: "signedIn", user };
  } catch (error: unknown) {
    if (isApiError(error) && error.kind === "aborted") {
      throw error;
    }
    return { kind: "signedOut", notice: noticeForSessionError(error) };
  }
}

/**
 * The query options. The result stays fresh until something that changes the
 * session (sign-in, sign-out) refetches or replaces it, or the signed-in shell
 * refetches it on the next page (sidebar-nav design D6). Window focus never
 * refetches it: the sidebar must not change while the user stays put (Q11).
 */
export function sessionQueryOptions() {
  return {
    queryKey: sessionQueryKey,
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchSessionState(signal),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  };
}

/** Reads the shared session query. */
export function useSessionState() {
  return useQuery(sessionQueryOptions());
}

/**
 * Asks the backend again after a sign-in and resolves once the cache holds
 * the answer; the guards then move the page on their own.
 */
export function reloadSessionState(queryClient: QueryClient): Promise<SessionState> {
  return queryClient.query({ ...sessionQueryOptions(), staleTime: 0 });
}

/**
 * Records that the sign-in page has shown the guard's sentence, so reopening
 * the page in the same visit does not show it again. Only a signed-out entry
 * with a sentence is touched.
 */
export function clearSessionNotice(queryClient: QueryClient): void {
  const current = queryClient.getQueryData<SessionState>(sessionQueryKey);
  if (current?.kind === "signedOut" && current.notice !== null) {
    const cleared: SessionState = { kind: "signedOut", notice: null };
    queryClient.setQueryData(sessionQueryKey, cleared);
  }
}

/**
 * Forgets everything cached for the signed-in account and records "signed
 * out, no sentence", so the guard sends the page to sign-in without another
 * request (ui-design §畫面狀態 › 暫時落點：登出).
 */
export function markSignedOut(queryClient: QueryClient): void {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== sessionQueryKey[0],
  });
  const signedOut: SessionState = { kind: "signedOut", notice: null };
  queryClient.setQueryData(sessionQueryKey, signedOut);
}
