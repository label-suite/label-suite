/**
 * Which shell layout the window gets (ui-design §響應式; brand.md §設計決策):
 * desktop from 768px, mobile at 767px and below. The CSS breakpoint and this
 * one agree, so collapsing, the submenu and the `?` key switch off exactly
 * where the phone layout starts.
 */
import { useSyncExternalStore } from "react";

import type { ShellViewport } from "@/components/app-shell/types";

const DESKTOP_QUERY = "(min-width: 768px)";

/** The breakpoint query, or null where the browser has no matchMedia. */
function desktopQuery(): MediaQueryList | null {
  return typeof window.matchMedia === "function" ? window.matchMedia(DESKTOP_QUERY) : null;
}

function subscribe(onChange: () => void): () => void {
  const query = desktopQuery();
  query?.addEventListener("change", onChange);
  return () => {
    query?.removeEventListener("change", onChange);
  };
}

/** Without matchMedia the width cannot be known; the desktop layout is drawn. */
function getSnapshot(): ShellViewport {
  return desktopQuery()?.matches === false ? "mobile" : "desktop";
}

/** The current layout, re-rendering when the window crosses 768px. */
export function useShellViewport(): ShellViewport {
  return useSyncExternalStore(subscribe, getSnapshot, () => "desktop");
}
