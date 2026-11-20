/**
 * The generated client's contract (design D5, spec frontend-api-codegen,
 * api-contract §產生的識別字): the twelve names exist, and the generated hook
 * goes through apiFetch end to end. Runtime names are checked after import;
 * type-only names are checked by `tsc -b` through `import type`.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { createQueryClient } from "@/app/query-client";
import { i18n } from "@/lib/i18n";
import {
  HEALTH_OK_TRACE_ID,
  HEALTH_URL,
  healthDatabaseUnavailableHandler,
  healthOkBody,
  healthOkHandler,
} from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";

import { ApiError, isApiError } from "./api-error";
import {
  getGetHealthQueryKey,
  getGetHealthQueryOptions,
  getHealth,
  useGetHealth,
  type GetHealthQueryError,
} from "./generated/label-suite";
import { getGetHealthMockHandler, getGetHealthResponseMock } from "./generated/label-suite.msw";
import {
  HealthStatus,
  type ErrorDetail,
  type ErrorResponse,
  type HealthData,
  type HealthDataResponse,
} from "./generated/label-suite.schemas";

afterEach(() => {
  vi.restoreAllMocks();
});

function renderGeneratedHealthHook() {
  const client = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useGetHealth(), { wrapper });
}

describe("generated identifiers", () => {
  it("exports the runtime names", () => {
    for (const exported of [
      useGetHealth,
      getHealth,
      getGetHealthQueryKey,
      getGetHealthQueryOptions,
      getGetHealthMockHandler,
      getGetHealthResponseMock,
      HealthStatus,
    ]) {
      expect(exported).toBeDefined();
    }
    expect(getGetHealthQueryKey()).toEqual(["/api/v1/health"]);
  });

  it("exports the type names, with the query error resolving to ApiError", () => {
    expectTypeOf<GetHealthQueryError>().toEqualTypeOf<ApiError>();
    expectTypeOf<HealthData>().toEqualTypeOf<{ database: HealthStatus; status: HealthStatus }>();
    expectTypeOf<HealthDataResponse>().toHaveProperty("data").toEqualTypeOf<HealthData>();
    expectTypeOf<ErrorResponse>().toHaveProperty("errors").toEqualTypeOf<ErrorDetail[] | null>();
    expectTypeOf<ErrorDetail>().toHaveProperty("field").toEqualTypeOf<string>();
  });
});

describe("generated health hook", () => {
  it("returns the data together with the trace id and timestamp", async () => {
    server.use(healthOkHandler());

    const { result } = renderGeneratedHealthHook();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const body = healthOkBody();
    expect(result.current.data).toEqual({
      data: { status: "ok", database: "ok" },
      meta: { traceId: body.traceId, timestamp: body.timestamp },
    });
  });

  it("fails with the single ApiError type", async () => {
    server.use(healthDatabaseUnavailableHandler());

    const { result } = renderGeneratedHealthHook();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    const error: unknown = result.current.error;
    expect(isApiError(error)).toBe(true);
    expect(result.current.error).toMatchObject({ kind: "http", status: 503 });
  });

  it("sends the request with credentials and the language, without a content type", async () => {
    let request: Request | undefined;
    server.use(
      http.get(HEALTH_URL, ({ request: received }) => {
        request = received;
        return HttpResponse.json(healthOkBody(), {
          headers: { "X-Correlation-ID": HEALTH_OK_TRACE_ID, "Content-Language": "zh-TW" },
        });
      }),
    );
    // MSW drops the credentials mode from the intercepted Request; read it from fetch's init.
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { result } = renderGeneratedHealthHook();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(request?.method).toBe("GET");
    expect(request?.url).toBe("http://localhost:8000/api/v1/health");
    expect(fetchSpy.mock.calls[0]?.[1]?.credentials).toBe("include");
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(request?.headers.get("Accept-Language")).toBe("zh-TW");
    expect(request?.headers.has("Content-Type")).toBe(false);
    expect(request?.headers.has("X-Correlation-ID")).toBe(false);
  });

  it("sends English as the request language when the interface is in English", async () => {
    await i18n.changeLanguage("en");
    let language: string | null = null;
    server.use(
      http.get(HEALTH_URL, ({ request }) => {
        language = request.headers.get("Accept-Language");
        return HttpResponse.json(healthOkBody("en"));
      }),
    );

    const { result } = renderGeneratedHealthHook();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(language).toBe("en");
  });
});
