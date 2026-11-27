/**
 * The appearance preference (spec appearance-mode; sidebar-nav design D7):
 * the single owner of the light, dark and system choice for every page.
 *
 * The choice is remembered in this browser under `label-suite-theme` (the
 * prototype's key) and never sent to the server; signing out leaves it alone.
 * `light` and `dark` are explicit; `system`, a missing, unreadable or invalid
 * value all follow the operating system. The applied theme is written to
 * `<html data-theme>`, which tokens.css and the mapping layer follow.
 *
 * `public/theme-init.js` applies the same rule before the first paint; this
 * module takes over afterwards: writing the choice, following the operating
 * system while the page is open, and handing the result to components through
 * useSyncExternalStore.
 */
import { useSyncExternalStore } from "react";

/** The three stored choices. */
export type ThemeChoice = "light" | "dark" | "system";

/** What a page is actually shown in. */
export type ResolvedTheme = "light" | "dark";

/** The localStorage key of the remembered choice, shared with public/theme-init.js. */
export const THEME_STORAGE_KEY = "label-suite-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();

/** Set once the operating system's scheme is being watched. */
let watchingSystem = false;

/** A choice made on this page that storage refused to keep; null when storage has it. */
let pageChoice: ThemeChoice | null = null;

/** Maps a stored value to a choice: anything but the three exact values is `system`. */
function parseThemeChoice(value: string | null): ThemeChoice {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

/** The operating system's scheme query, or null where the browser has none. */
function systemQuery(): MediaQueryList | null {
  try {
    return typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
  } catch {
    return null;
  }
}

/**
 * Reads the remembered choice; storage that cannot be read counts as nothing
 * remembered. A choice made on this page wins, so it holds even when storage
 * refused to keep it.
 */
export function readThemeChoice(): ThemeChoice {
  if (pageChoice !== null) {
    return pageChoice;
  }
  try {
    return parseThemeChoice(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** The theme the remembered choice shows right now. */
export function getResolvedTheme(): ResolvedTheme {
  const choice = readThemeChoice();
  if (choice !== "system") {
    return choice;
  }
  return systemQuery()?.matches === true ? "dark" : "light";
}

/**
 * Writes the theme of the remembered choice to `<html data-theme>`.
 *
 * @returns The theme that was applied.
 */
export function applyTheme(): ResolvedTheme {
  const resolved = getResolvedTheme();
  document.documentElement.setAttribute("data-theme", resolved);
  return resolved;
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Starts following the operating system once; only a `system` choice moves with it. */
function watchSystemScheme(): void {
  if (watchingSystem) {
    return;
  }
  const query = systemQuery();
  if (query === null) {
    return;
  }
  watchingSystem = true;
  query.addEventListener("change", () => {
    if (readThemeChoice() === "system") {
      applyTheme();
      notify();
    }
  });
}

/**
 * Applies the remembered choice and follows the operating system from now on.
 * Called once at start-up (src/main.tsx); safe to call again.
 */
export function initTheme(): void {
  applyTheme();
  watchSystemScheme();
}

/**
 * Remembers a choice and applies it at once. When storage cannot be written
 * the choice still applies to this page.
 *
 * @param choice The choice to remember.
 */
export function setThemeChoice(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    pageChoice = null;
  } catch {
    // Storage disabled or full: the choice holds for this page only.
    pageChoice = choice;
  }
  applyTheme();
  notify();
}

/**
 * Calls `listener` whenever the applied theme may have changed.
 *
 * @returns A function that stops the calls.
 */
export function subscribeTheme(listener: () => void): () => void {
  watchSystemScheme();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The theme the page is shown in, re-rendering when it changes. */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeTheme, getResolvedTheme, () => "light");
}
