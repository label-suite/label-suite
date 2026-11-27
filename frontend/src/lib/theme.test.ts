/**
 * The appearance preference (spec appearance-mode; sidebar-nav design D7).
 *
 * `lib/theme.ts` and `public/theme-init.js` each hold a copy of the reading
 * rule, because the init script runs before any bundle and imports nothing.
 * One case table drives both, so the two copies cannot drift apart.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import themeInitSource from "../../public/theme-init.js?raw";

type ThemeModule = typeof import("./theme");

const KEY = "label-suite-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** A stand-in for the operating system's colour scheme, with change events. */
interface FakeColorScheme {
  /** Changes the system scheme and fires `change` like a browser would. */
  set(dark: boolean): void;
}

let mod: ThemeModule;

/** Runs a classic script in the page, the way the browser runs public/theme-init.js. */
function runInPage(code: string): void {
  const script = document.createElement("script");
  script.textContent = code;
  document.head.append(script);
  script.remove();
}

/** The document, which both worlds share, used to hand a value to a page script. */
const handover = document as Document & { testMatchMedia?: unknown };

/**
 * Sets `matchMedia` for both worlds: the test's global (what lib/theme.ts
 * reads) and the global of a page script (what theme-init.js reads). jsdom
 * runs page scripts against its own window object, not the test's global, so
 * the value is handed over through the shared document.
 */
function setMatchMedia(value: unknown): void {
  vi.stubGlobal("matchMedia", value);
  handover.testMatchMedia = value;
  runInPage("window.matchMedia = document.testMatchMedia;");
  delete handover.testMatchMedia;
}

/** Replaces window.matchMedia (jsdom has none) with one that answers the dark query. */
function stubColorScheme(initiallyDark: boolean): FakeColorScheme {
  let dark = initiallyDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const matchMedia = vi.fn((query: string) => ({
    get matches() {
      return query === DARK_QUERY && dark;
    },
    media: query,
    addEventListener: (_type: "change", listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: "change", listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
  }));
  setMatchMedia(matchMedia);
  return {
    set(next) {
      dark = next;
      for (const listener of listeners) {
        listener(new Event("change") as MediaQueryListEvent);
      }
    },
  };
}

/** Runs public/theme-init.js as the page would. */
function runThemeInit(): void {
  runInPage(themeInitSource);
}

function dataTheme(): string | null {
  return document.documentElement.getAttribute("data-theme");
}

function store(value: string | null): void {
  if (value === null) {
    window.localStorage.removeItem(KEY);
  } else {
    window.localStorage.setItem(KEY, value);
  }
}

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  mod = await import("./theme");
});

afterEach(() => {
  setMatchMedia(undefined);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

/** stored value × system dark → the theme both copies must apply. */
const CASES: [string | null, boolean, "light" | "dark"][] = [
  ["light", false, "light"],
  ["light", true, "light"],
  ["dark", false, "dark"],
  ["dark", true, "dark"],
  ["system", false, "light"],
  ["system", true, "dark"],
  [null, false, "light"],
  [null, true, "dark"],
  ["sepia", false, "light"],
  ["sepia", true, "dark"],
  ["", false, "light"],
  ["", true, "dark"],
  ["DARK", false, "light"],
  ["DARK", true, "dark"],
];

describe("the reading rule, shared by lib/theme.ts and public/theme-init.js", () => {
  it.each(CASES)("stored %j with a dark system %s gives %s in both", (stored, osDark, expected) => {
    stubColorScheme(osDark);
    store(stored);

    runThemeInit();
    const fromInitScript = dataTheme();
    document.documentElement.removeAttribute("data-theme");
    const fromLibrary = mod.applyTheme();

    expect(fromInitScript).toBe(expected);
    expect(fromLibrary).toBe(expected);
    expect(dataTheme()).toBe(expected);
  });

  it("reads an invalid or missing value as system", () => {
    for (const value of [null, "sepia", "", "DARK"]) {
      store(value);
      expect(mod.readThemeChoice()).toBe("system");
    }
    store("dark");
    expect(mod.readThemeChoice()).toBe("dark");
  });

  it("treats storage that cannot be read as system in both, without throwing", () => {
    stubColorScheme(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(runThemeInit).not.toThrow();
    expect(dataTheme()).toBe("dark");
    document.documentElement.removeAttribute("data-theme");
    expect(() => mod.applyTheme()).not.toThrow();
    expect(dataTheme()).toBe("dark");
  });

  it("falls back to light in both when the browser cannot report the system scheme", () => {
    setMatchMedia(undefined);

    runThemeInit();
    expect(dataTheme()).toBe("light");
    document.documentElement.removeAttribute("data-theme");
    expect(mod.applyTheme()).toBe("light");
  });

  it("is a self-contained classic script: no import, no export", () => {
    expect(themeInitSource).not.toMatch(/^\s*(import|export)\b/m);
    expect(themeInitSource).toContain(KEY);
  });
});

describe("appearance-mode Scenarios at unit level", () => {
  it("外觀設定值無效: sepia, empty and DARK follow a dark system", () => {
    stubColorScheme(true);
    for (const value of ["sepia", "", "DARK"]) {
      store(value);
      runThemeInit();
      expect(dataTheme()).toBe("dark");
    }
  });

  it("從來沒設定過外觀: nothing stored and a light system gives light", () => {
    stubColorScheme(false);

    runThemeInit();

    expect(dataTheme()).toBe("light");
  });

  it("跟隨系統依作業系統呈現: follows the system while the page is open", () => {
    const scheme = stubColorScheme(true);
    store("system");

    mod.initTheme();
    expect(dataTheme()).toBe("dark");

    scheme.set(false);
    expect(dataTheme()).toBe("light");
    scheme.set(true);
    expect(dataTheme()).toBe("dark");
  });

  it("an explicit light or dark choice does not move with the system", () => {
    const scheme = stubColorScheme(false);
    store("dark");

    mod.initTheme();
    scheme.set(true);
    scheme.set(false);

    expect(dataTheme()).toBe("dark");
  });

  it("重新整理後外觀保持: a dark choice made on a light system survives a reload", async () => {
    stubColorScheme(false);
    mod.setThemeChoice("dark");
    expect(window.localStorage.getItem(KEY)).toBe("dark");
    expect(dataTheme()).toBe("dark");

    // Reload: the document starts without the attribute and the modules start fresh.
    document.documentElement.removeAttribute("data-theme");
    vi.resetModules();
    runThemeInit();
    expect(dataTheme()).toBe("dark");
    const reloaded = await import("./theme");
    reloaded.initTheme();
    expect(dataTheme()).toBe("dark");
  });
});

describe("setThemeChoice", () => {
  it("still applies the choice to this page when storage cannot be written", () => {
    stubColorScheme(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(() => {
      mod.setThemeChoice("dark");
    }).not.toThrow();
    expect(dataTheme()).toBe("dark");
  });
});

describe("useResolvedTheme", () => {
  it("re-renders when the choice changes", () => {
    stubColorScheme(false);
    const { result } = renderHook(() => mod.useResolvedTheme());
    expect(result.current).toBe("light");

    act(() => {
      mod.setThemeChoice("dark");
    });
    expect(result.current).toBe("dark");

    act(() => {
      mod.setThemeChoice("light");
    });
    expect(result.current).toBe("light");
  });

  it("re-renders when the system changes under a system choice", () => {
    const scheme = stubColorScheme(false);
    const { result } = renderHook(() => mod.useResolvedTheme());
    expect(result.current).toBe("light");

    act(() => {
      scheme.set(true);
    });

    expect(result.current).toBe("dark");
    expect(dataTheme()).toBe("dark");
  });
});
