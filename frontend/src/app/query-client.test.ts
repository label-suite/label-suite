import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { isAuthError } from "@/api/api-error";
import type { ErrorResponse, HealthDataResponse } from "@/api/generated/label-suite.schemas";
import { apiFetch } from "@/api/mutator";
import { HEALTH_URL, TEST_API_BASE_URL, errorBody } from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";

import { createQueryClient } from "./query-client";

/** Answers the health check with `body` and `status`, counting the requests. */
function countHealthRequests(status: number, body: ErrorResponse): { count: () => number } {
  let requests = 0;
  server.use(
    http.get(HEALTH_URL, () => {
      requests += 1;
      return HttpResponse.json(body, { status });
    }),
  );
  return { count: () => requests };
}

/**
 * 401 and 403 error codes are defined by 01-01 and are not in the backend
 * contract yet; these placeholder codes only make the envelopes complete.
 * The tests depend on the status, not the code.
 */
function authEnvelope(status: 401 | 403): ErrorResponse {
  return {
    ...errorBody({ code: "INTERNAL_ERROR" }),
    code: status === 401 ? "TEST_PLACEHOLDER_401" : "TEST_PLACEHOLDER_403",
    message: "placeholder",
  };
}

function renderHealthQuery() {
  const client = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(
    () =>
      useQuery({
        queryKey: ["health"],
        queryFn: ({ signal }) =>
          apiFetch<HealthDataResponse>({ url: "/api/v1/health", method: "GET", signal }),
      }),
    { wrapper },
  );
}

describe("createQueryClient", () => {
  it("does not retry a query after a server error", async () => {
    const requests = countHealthRequests(500, errorBody({ code: "INTERNAL_ERROR" }));

    const { result } = renderHealthQuery();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(requests.count()).toBe(1);
  });

  it("does not resend a failed write", async () => {
    let requests = 0;
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/v1/echo`, () => {
        requests += 1;
        return HttpResponse.json(errorBody({ code: "DATABASE_UNAVAILABLE" }), { status: 503 });
      }),
    );
    const client = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: (name: string) =>
            apiFetch<undefined>({ url: "/api/v1/echo", method: "POST", data: { name } }),
        }),
      { wrapper },
    );

    result.current.mutate("a");

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(requests).toBe(1);
  });

  it("does not retry after a 401 and reports it as an auth error", async () => {
    const requests = countHealthRequests(401, authEnvelope(401));

    const { result } = renderHealthQuery();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(requests.count()).toBe(1);
    expect(isAuthError(result.current.error)).toBe(true);
  });

  it("does not treat a 403 as an auth error and does not retry it", async () => {
    const requests = countHealthRequests(403, authEnvelope(403));

    const { result } = renderHealthQuery();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(requests.count()).toBe(1);
    expect(isAuthError(result.current.error)).toBe(false);
  });

  it("keeps the other TanStack Query defaults", () => {
    const defaults = createQueryClient().getDefaultOptions();

    expect(defaults).toEqual({ queries: { retry: false }, mutations: { retry: false } });
  });
});
