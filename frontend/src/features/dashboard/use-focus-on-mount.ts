import { useEffect, useRef, type RefObject } from "react";

/**
 * Moves focus to the returned ref's element once, right after mount, when
 * `enabled` is true (dashboard-shell design D9). The page decides when: only a
 * retry moves focus, a first load never does (ui-design.md §互動與鍵盤).
 *
 * @param enabled Whether this mount should take focus; read on mount only.
 * @returns A ref to attach to the element that should receive focus.
 */
export function useFocusOnMount<Element extends HTMLElement>(
  enabled: boolean,
): RefObject<Element | null> {
  const ref = useRef<Element>(null);
  const shouldFocus = useRef(enabled);

  useEffect(() => {
    if (shouldFocus.current) {
      ref.current?.focus();
    }
  }, []);

  return ref;
}
