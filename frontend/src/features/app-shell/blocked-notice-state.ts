/**
 * The navigation state a blocked sidebar click carries to its landing page
 * (sidebar-nav design D5, clarification Q4). It travels in router state, never
 * the URL, so a reload, Back or Forward does not bring it back.
 */

/** The two explanations, one per blocked item. */
export const blockedNoticeKinds = ["annotation", "datasetAnalysis"] as const;

/** Which explanation the landing page shows. */
export type BlockedNoticeKind = (typeof blockedNoticeKinds)[number];

/** The router state of a blocked arrival. */
export interface BlockedNoticeState {
  /** Which item was blocked. */
  blockedNotice: BlockedNoticeKind;
}

/** The state to navigate with when `kind` is blocked. */
export function blockedNoticeState(kind: BlockedNoticeKind): BlockedNoticeState {
  return { blockedNotice: kind };
}

/** Reads a known kind from any router state; anything else is null. */
export function readBlockedNoticeKind(state: unknown): BlockedNoticeKind | null {
  if (typeof state !== "object" || state === null || !("blockedNotice" in state)) {
    return null;
  }
  const kind: unknown = state.blockedNotice;
  return blockedNoticeKinds.find((known) => known === kind) ?? null;
}
