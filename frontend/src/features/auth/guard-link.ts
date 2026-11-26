import type { MouseEvent } from "react";

/** The props that switch a link off while the page is frozen. */
export interface GuardedLinkProps {
  /** Out of the tab order while frozen. */
  tabIndex?: number;
  /** Announced as unavailable while frozen. */
  "aria-disabled"?: true;
  /** Cancels the navigation while frozen. */
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Links cannot be `disabled`, so while a request is in flight they leave the
 * tab order and cancel their own click (spec 01-01 §用 Email 與密碼登入 第 9
 * 條, U1: the whole page is frozen for mouse and keyboard alike).
 *
 * @param frozen Whether the page is frozen.
 */
export function guardLink(frozen: boolean): GuardedLinkProps {
  if (!frozen) {
    return {};
  }
  return {
    tabIndex: -1,
    "aria-disabled": true,
    onClick: (event) => {
      event.preventDefault();
    },
  };
}
