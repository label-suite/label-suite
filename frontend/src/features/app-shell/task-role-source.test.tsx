/**
 * The task-role source seam (sidebar-nav design D3, clarification Q1;
 * dashboard-shell design D2). Without a provider it answers "ready, no task
 * role in any task, no current task" for everyone, without asking the server.
 * Tests inject the other states through TaskRoleSourceProvider. #766
 * replaces only the hook's inside.
 */
import { act, renderHook } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { server } from "@/test/msw-server";

import {
  TaskRoleSourceProvider,
  useTaskRoleSource,
  type TaskRoleAnswer,
  type TaskRoleSourceState,
} from "./task-role-source";

let requests: string[] = [];

beforeEach(() => {
  requests = [];
  server.events.on("request:start", ({ request }) => {
    requests.push(`${request.method} ${request.url}`);
  });
});

afterEach(() => {
  server.events.removeAllListeners();
});

/** Wraps the hook in a provider that injects `state`. */
function injecting(state: TaskRoleSourceState) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <TaskRoleSourceProvider value={state}>{children}</TaskRoleSourceProvider>;
  };
}

describe("useTaskRoleSource without a provider", () => {
  it("is ready with no held task role and no current task role", () => {
    const { result } = renderHook(() => useTaskRoleSource());

    expect(result.current.status).toBe("ready");
    if (result.current.status !== "ready") {
      return;
    }
    expect([...result.current.answer.heldRoles]).toEqual([]);
    expect(result.current.answer.currentTaskRole).toBeNull();
  });

  it("gives the same object on every render and sends no request", async () => {
    const { result, rerender } = renderHook(() => useTaskRoleSource());
    const first = result.current;

    rerender();
    await Promise.resolve();

    expect(result.current).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(requests).toEqual([]);
  });
});

describe("useTaskRoleSource under TaskRoleSourceProvider", () => {
  it("passes a loading state through as it is", () => {
    const loading: TaskRoleSourceState = { status: "loading" };

    const { result } = renderHook(() => useTaskRoleSource(), { wrapper: injecting(loading) });

    expect(result.current).toBe(loading);
  });

  it("passes a ready answer through as it is", () => {
    const answer: TaskRoleAnswer = {
      heldRoles: new Set(["reviewer", "annotator"]),
      currentTaskRole: "reviewer",
    };
    const ready: TaskRoleSourceState = { status: "ready", answer };

    const { result } = renderHook(() => useTaskRoleSource(), { wrapper: injecting(ready) });

    expect(result.current).toBe(ready);
  });

  it("passes an error through, and its retry lets the test choose the next state", () => {
    const next: TaskRoleSourceState = { status: "loading" };
    let retried = 0;
    /** Owns the injected state, so the retry the test hands out can change it. */
    function Switching({ children }: { children: ReactNode }) {
      const [state, setState] = useState<TaskRoleSourceState>(() => ({
        status: "error",
        retry: () => {
          retried += 1;
          setState(next);
        },
      }));
      return <TaskRoleSourceProvider value={state}>{children}</TaskRoleSourceProvider>;
    }

    const { result } = renderHook(() => useTaskRoleSource(), { wrapper: Switching });
    expect(result.current.status).toBe("error");
    const failed = result.current;

    act(() => {
      if (failed.status === "error") {
        failed.retry();
      }
    });

    expect(retried).toBe(1);
    expect(result.current).toBe(next);
  });
});
