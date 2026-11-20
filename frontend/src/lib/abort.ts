/**
 * Composes the caller's abort signal with a timeout (design D4, clarification
 * Q19 N6). Replace with the standard AbortSignal.any once jsdom and every
 * target browser support it.
 */

/** Which source aborted the composed signal. */
export type AbortSource = "caller" | "timeout";

/** A composed signal together with its cleanup and the source that fired. */
export interface ComposedSignal {
  /** Aborts when the caller aborts or the timeout elapses, keeping that reason. */
  signal: AbortSignal;
  /** Clears the timer and removes the caller listener; call it in `finally`. */
  cleanup: () => void;
  /** The source that aborted the signal, or null while it is still live. */
  reason: () => AbortSource | null;
}

/**
 * Builds one signal that aborts when either the caller's signal aborts or
 * `timeoutMs` elapses. The first source wins and its reason is kept: the
 * caller's own reason, or a `TimeoutError` DOMException for the timeout.
 *
 * @param caller The caller's signal (TanStack Query passes one); may be absent.
 * @param timeoutMs Milliseconds before the composed signal times out.
 */
export function composeSignals(caller: AbortSignal | undefined, timeoutMs: number): ComposedSignal {
  const controller = new AbortController();
  let source: AbortSource | null = null;

  const abortFrom = (from: AbortSource, reason: unknown): void => {
    if (controller.signal.aborted) {
      return;
    }
    source = from;
    controller.abort(reason);
  };

  const onCallerAbort = (): void => {
    abortFrom("caller", caller?.reason);
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  if (caller?.aborted) {
    abortFrom("caller", caller.reason);
  } else {
    caller?.addEventListener("abort", onCallerAbort, { once: true });
    timer = setTimeout(() => {
      abortFrom(
        "timeout",
        new DOMException(`Timed out after ${String(timeoutMs)} ms`, "TimeoutError"),
      );
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      caller?.removeEventListener("abort", onCallerAbort);
    },
    reason: () => source,
  };
}
