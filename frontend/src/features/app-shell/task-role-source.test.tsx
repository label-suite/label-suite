/**
 * The task-role source seam (sidebar-nav design D3, clarification Q1): this
 * change answers "no task role in any task, no current task" for everyone,
 * without asking the server. #766 replaces only this seam.
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { server } from "@/test/msw-server";

import { useTaskRoleSource } from "./task-role-source";

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

describe("useTaskRoleSource", () => {
  it("answers no held task role and no current task role", () => {
    const { result } = renderHook(() => useTaskRoleSource());

    expect([...result.current.heldRoles]).toEqual([]);
    expect(result.current.currentTaskRole).toBeNull();
  });

  it("gives the same answer on every render and sends no request", async () => {
    const { result, rerender } = renderHook(() => useTaskRoleSource());
    const first = result.current;

    rerender();
    await Promise.resolve();

    expect(result.current).toBe(first);
    expect(requests).toEqual([]);
  });
});
