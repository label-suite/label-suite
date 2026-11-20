import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { composeSignals } from "./abort";

const TIMEOUT_MS = 15_000;

describe("composeSignals", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts with the caller's reason when the caller cancels", () => {
    const caller = new AbortController();
    const composed = composeSignals(caller.signal, TIMEOUT_MS);

    caller.abort("caller cancelled");

    expect(composed.signal.aborted).toBe(true);
    expect(composed.signal.reason).toBe("caller cancelled");
    expect(composed.reason()).toBe("caller");
    composed.cleanup();
  });

  it("is aborted at once when the caller signal is already aborted", () => {
    const caller = new AbortController();
    caller.abort("gone");

    const composed = composeSignals(caller.signal, TIMEOUT_MS);

    expect(composed.signal.aborted).toBe(true);
    expect(composed.signal.reason).toBe("gone");
    expect(composed.reason()).toBe("caller");
    composed.cleanup();
  });

  it("aborts with a TimeoutError once the timeout elapses", () => {
    const caller = new AbortController();
    const composed = composeSignals(caller.signal, TIMEOUT_MS);

    vi.advanceTimersByTime(TIMEOUT_MS - 1);
    expect(composed.signal.aborted).toBe(false);
    expect(composed.reason()).toBeNull();

    vi.advanceTimersByTime(1);
    expect(composed.signal.aborted).toBe(true);
    expect(composed.signal.reason).toBeInstanceOf(DOMException);
    expect(composed.signal.reason).toHaveProperty("name", "TimeoutError");
    expect(composed.reason()).toBe("timeout");
    composed.cleanup();
  });

  it("still times out when there is no caller signal", () => {
    const composed = composeSignals(undefined, TIMEOUT_MS);

    vi.advanceTimersByTime(TIMEOUT_MS);

    expect(composed.reason()).toBe("timeout");
    composed.cleanup();
  });

  it("keeps the first reason when the caller cancels after the timeout", () => {
    const caller = new AbortController();
    const composed = composeSignals(caller.signal, TIMEOUT_MS);

    vi.advanceTimersByTime(TIMEOUT_MS);
    caller.abort("late");

    expect(composed.reason()).toBe("timeout");
    composed.cleanup();
  });

  it("receives no further events after cleanup", () => {
    const caller = new AbortController();
    const composed = composeSignals(caller.signal, TIMEOUT_MS);
    const onAbort = vi.fn();
    composed.signal.addEventListener("abort", onAbort);

    composed.cleanup();
    caller.abort("after cleanup");
    vi.advanceTimersByTime(TIMEOUT_MS);

    expect(onAbort).not.toHaveBeenCalled();
    expect(composed.signal.aborted).toBe(false);
    expect(composed.reason()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
