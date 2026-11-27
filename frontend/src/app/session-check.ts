/**
 * When the signed-in shell asks the backend for the session again
 * (sidebar-nav design D6, clarification Q11): on the user's next page, never
 * on window focus and never twice for one page load.
 *
 * The shell unmounts on the way through a redirect (Task Management →
 * `*` → `/` → the landing page), and StrictMode runs every effect twice, so
 * "first mount" and "first effect run" cannot tell a new page from the same
 * one. The decision instead rests on values StrictMode does not change: the
 * location's key and pathname, kept in a ref that AppRoot holds above every
 * route and that only a full page load resets.
 */
import { createContext, useContext, useEffect, type RefObject } from "react";
import { useLocation } from "react-router-dom";

/** The shell's last session check, and whether the router has been elsewhere since. */
export interface SessionCheckMark {
  /** `location.key` of the last check; null before the shell's first arrival in this page load. */
  checkedKey: string | null;
  /** The pathname of the last check. */
  checkedPathname: string | null;
  /** The router has been on a pathname other than `checkedPathname` since the last check. */
  leftSince: boolean;
}

/** A fresh mark for a new page load. */
export function createSessionCheckMark(): SessionCheckMark {
  return { checkedKey: null, checkedPathname: null, leftSince: false };
}

/** The mark AppRoot provides; null outside AppRoot. */
export const SessionCheckContext = createContext<RefObject<SessionCheckMark> | null>(null);

/**
 * Asks for the session again when the shell arrives on a new page:
 *
 * - the shell's first arrival in this page load: the guard has just asked, so
 *   only remember the location;
 * - the same `location.key` (StrictMode's re-run, a re-render): nothing;
 * - a new key on another pathname, or on the same one after the router has
 *   been elsewhere (a redirect chain back here): refetch, and remember;
 * - a new key on the same pathname without leaving (clearing the blocked
 *   explanation's state, a blocked click while already here): only remember.
 *
 * @param refetch Asks for the session again; it must keep a request already
 *   in flight (`cancelRefetch: false`) and keep showing the previous answer.
 */
export function useSessionCheckOnArrival(refetch: () => void): void {
  const mark = useContext(SessionCheckContext);
  const { key, pathname } = useLocation();

  useEffect(() => {
    if (mark === null) {
      return;
    }
    const last = mark.current;
    if (last.checkedKey === key) {
      return;
    }
    const firstArrival = last.checkedKey === null;
    const moved = pathname !== last.checkedPathname || last.leftSince;
    last.checkedKey = key;
    last.checkedPathname = pathname;
    last.leftSince = false;
    if (!firstArrival && moved) {
      queueMicrotask(refetch);
    }
  }, [mark, key, pathname, refetch]);
}
