/**
 * The collapsed preference and the 768px breakpoint (sidebar-nav design D8;
 * ui-design §響應式). The view only draws what these hooks return.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SIDEBAR_COLLAPSED_KEY, useSidebarCollapsed } from "./use-sidebar-collapsed";
import { useShellViewport } from "./use-shell-viewport";

/** A stand-in for `(min-width: 768px)`, with change events. */
interface FakeWidth {
  /** Resizes the window across or within the breakpoint. */
  set(desktop: boolean): void;
}

function stubWidth(initiallyDesktop: boolean): FakeWidth {
  let desktop = initiallyDesktop;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === "(min-width: 768px)" && desktop;
    },
    media: query,
    addEventListener: (_type: "change", listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: "change", listener: () => void) => {
      listeners.delete(listener);
    },
  }));
  return {
    set(next) {
      desktop = next;
      for (const listener of listeners) listener();
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useShellViewport", () => {
  it("is desktop from 768px and mobile below, following resizes", () => {
    const width = stubWidth(true);
    const { result } = renderHook(() => useShellViewport());
    expect(result.current).toBe("desktop");

    act(() => {
      width.set(false);
    });
    expect(result.current).toBe("mobile");
  });

  it("draws the desktop layout when the browser cannot report its width", () => {
    vi.stubGlobal("matchMedia", undefined);

    expect(renderHook(() => useShellViewport()).result.current).toBe("desktop");
  });
});

describe("useSidebarCollapsed", () => {
  it("starts expanded when nothing is remembered", () => {
    stubWidth(true);

    expect(renderHook(() => useSidebarCollapsed("desktop")).result.current.collapsed).toBe(false);
  });

  it.each(["yes", "", "TRUE", "1"])("reads the invalid value %j as expanded", (stored) => {
    stubWidth(true);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, stored);

    expect(renderHook(() => useSidebarCollapsed("desktop")).result.current.collapsed).toBe(false);
  });

  it("reads storage that cannot be read as expanded", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(renderHook(() => useSidebarCollapsed("desktop")).result.current.collapsed).toBe(false);
  });

  it("重新整理後收合狀態保持: a toggle is remembered for the next page load", () => {
    const first = renderHook(() => useSidebarCollapsed("desktop"));

    act(() => {
      first.result.current.toggle();
    });
    expect(first.result.current.collapsed).toBe(true);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("true");
    first.unmount();

    // Reload: a fresh mount reads the remembered value.
    expect(renderHook(() => useSidebarCollapsed("desktop")).result.current.collapsed).toBe(true);
  });

  it("手機不啟用收合: never collapsed below 768px, keeps the remembered value, and toggling does nothing", () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    const { result, rerender } = renderHook(
      ({ viewport }: { viewport: "desktop" | "mobile" }) => useSidebarCollapsed(viewport),
      { initialProps: { viewport: "mobile" } },
    );
    expect(result.current.collapsed).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.collapsed).toBe(false);
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("true");

    // Back on a desktop width, the remembered collapse returns.
    rerender({ viewport: "desktop" });
    expect(result.current.collapsed).toBe(true);
  });

  it("still toggles for this page when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const { result } = renderHook(() => useSidebarCollapsed("desktop"));

    act(() => {
      result.current.toggle();
    });

    expect(result.current.collapsed).toBe(true);
  });
});
