import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/lib/i18n";
import {
  DATABASE_UNAVAILABLE_TRACE_ID,
  HEALTH_OK_TRACE_ID,
  HEALTH_URL,
  TEST_API_BASE_URL,
  errorBody,
  healthDatabaseUnavailableHandler,
  healthNetworkErrorHandler,
  healthOkHandler,
  healthPendingHandler,
} from "@/test/envelope-fixtures";
import { server } from "@/test/msw-server";

import { ApiError, isApiError } from "./api-error";
import type { HealthDataResponse } from "./generated/label-suite.schemas";
import { apiFetch, buildRequestUrl, type RequestConfig } from "./mutator";

const HEALTH_REQUEST: RequestConfig = { url: "/api/v1/health", method: "GET" };

/** Calls apiFetch and returns the thrown value, failing the test if it resolves. */
async function failureOf(config: RequestConfig = HEALTH_REQUEST): Promise<unknown> {
  try {
    await apiFetch<HealthDataResponse>(config);
  } catch (error: unknown) {
    return error;
  }
  throw new Error("apiFetch resolved, but a failure was expected");
}

/** Narrows a caught value to ApiError so its fields can be asserted. */
function asApiError(value: unknown): ApiError {
  expect(isApiError(value)).toBe(true);
  if (!isApiError(value)) {
    throw new Error("not an ApiError");
  }
  return value;
}

/** Records the request a handler received, answering with the normal fixture body. */
function captureHealthRequest(): { last: () => Request | undefined } {
  let captured: Request | undefined;
  server.use(
    http.get(HEALTH_URL, ({ request }) => {
      captured = request;
      return HttpResponse.json({
        success: true,
        code: "OK",
        message: "成功",
        data: { status: "ok", database: "ok" },
        timestamp: "2026-11-20T08:15:30.123Z",
        traceId: HEALTH_OK_TRACE_ID,
      });
    }),
  );
  return { last: () => captured };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("buildRequestUrl", () => {
  it("returns the same-origin relative path when the base URL is empty", () => {
    expect(buildRequestUrl("", "/api/v1/health")).toBe("/api/v1/health");
  });

  it("prefixes a non-empty base URL", () => {
    expect(buildRequestUrl("http://localhost:8000", "/api/v1/health")).toBe(
      "http://localhost:8000/api/v1/health",
    );
  });

  it("serialises params with URLSearchParams and skips empty values", () => {
    expect(
      buildRequestUrl("http://localhost:8000", "/api/v1/tasks", {
        page: 2,
        q: "a b&c",
        archived: false,
        tag: ["x", "y"],
        cursor: undefined,
        owner: null,
      }),
    ).toBe("http://localhost:8000/api/v1/tasks?page=2&q=a+b%26c&archived=false&tag=x&tag=y");
  });

  it("leaves the URL without a query string when no param has a value", () => {
    expect(buildRequestUrl("", "/api/v1/tasks", { cursor: undefined })).toBe("/api/v1/tasks");
  });
});

describe("apiFetch request", () => {
  it("sends the health check with credentials and the language, without a content type", async () => {
    const capture = captureHealthRequest();
    // MSW rebuilds the intercepted Request without its credentials mode, so the
    // mode is read from the init that apiFetch handed to fetch.
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await apiFetch<HealthDataResponse>(HEALTH_REQUEST);

    const request = capture.last();
    expect(request?.method).toBe("GET");
    expect(request?.url).toBe("http://localhost:8000/api/v1/health");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[1]?.credentials).toBe("include");
    expect(request?.headers.get("Accept-Language")).toBe("zh-TW");
    expect(request?.headers.has("Content-Type")).toBe(false);
    expect(request?.headers.has("X-Correlation-ID")).toBe(false);
  });

  it("sends English as the request language when the interface is in English", async () => {
    await i18n.changeLanguage("en");
    const capture = captureHealthRequest();

    await apiFetch<HealthDataResponse>(HEALTH_REQUEST);

    expect(capture.last()?.headers.get("Accept-Language")).toBe("en");
  });

  it("sends a JSON content type and the JSON body when there is a body", async () => {
    let contentType: string | null = null;
    let body = "";
    server.use(
      http.post(`${TEST_API_BASE_URL}/api/v1/echo`, async ({ request }) => {
        contentType = request.headers.get("Content-Type");
        body = await request.text();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await apiFetch<undefined>({ url: "/api/v1/echo", method: "POST", data: { name: "a" } });

    expect(contentType).toBe("application/json");
    expect(body).toBe('{"name":"a"}');
  });
});

describe("apiFetch success", () => {
  it("returns the data together with the trace id and timestamp", async () => {
    server.use(healthOkHandler());

    const result = await apiFetch<HealthDataResponse>(HEALTH_REQUEST);

    expect(result).toEqual({
      data: { status: "ok", database: "ok" },
      meta: {
        traceId: "3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01",
        timestamp: "2026-11-20T08:15:30.123Z",
      },
    });
    expect(Object.keys(result)).toEqual(["data", "meta"]);
  });

  it("clears its timeout timer once the response has arrived", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    server.use(healthOkHandler());

    await apiFetch<HealthDataResponse>(HEALTH_REQUEST);

    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns nothing for a 204 without throwing", async () => {
    server.use(http.get(HEALTH_URL, () => new HttpResponse(null, { status: 204 })));

    await expect(apiFetch<undefined>(HEALTH_REQUEST)).resolves.toBeUndefined();
  });
});

describe("apiFetch error envelopes", () => {
  it("turns a 503 error envelope into an http ApiError", async () => {
    server.use(healthDatabaseUnavailableHandler());

    const error = asApiError(await failureOf());

    const { kind, status, code, message, traceId, timestamp, fieldErrors } = error;
    expect({ kind, status, code, message, traceId, timestamp, fieldErrors }).toEqual({
      kind: "http",
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      message: "資料庫暫時無法連線，請稍後再試",
      traceId: DATABASE_UNAVAILABLE_TRACE_ID,
      timestamp: "2026-11-20T08:15:35.456Z",
      fieldErrors: null,
    });
  });

  it("turns a 404 error envelope into an http ApiError", async () => {
    server.use(
      http.get(HEALTH_URL, () =>
        HttpResponse.json(errorBody({ code: "NOT_FOUND" }), { status: 404 }),
      ),
    );

    const error = asApiError(await failureOf());

    expect(error).toMatchObject({
      kind: "http",
      status: 404,
      code: "NOT_FOUND",
      message: "找不到指定的資源",
    });
  });

  it("carries the field errors of a 422", async () => {
    const errors = [
      { location: "body", field: "displayName", code: "missing", message: "Field required" },
    ];
    server.use(
      http.get(HEALTH_URL, () =>
        HttpResponse.json(errorBody({ code: "VALIDATION_FAILED", errors }), { status: 422 }),
      ),
    );

    const error = asApiError(await failureOf());

    expect(error).toMatchObject({ kind: "http", status: 422 });
    expect(error.fieldErrors).toEqual(errors);
  });

  it("still treats an error envelope without the errors key as http", async () => {
    const body: Record<string, unknown> = { ...errorBody({ code: "INTERNAL_ERROR" }) };
    delete body.errors;
    server.use(http.get(HEALTH_URL, () => HttpResponse.json(body, { status: 500 })));

    const error = asApiError(await failureOf());

    expect(error).toMatchObject({ kind: "http", status: 500, fieldErrors: null });
  });
});

describe("apiFetch non-envelope responses", () => {
  it("turns an HTML page into invalidResponse without leaking the body", async () => {
    server.use(
      http.get(
        HEALTH_URL,
        () =>
          new HttpResponse("<!doctype html><html>SECRET-BODY</html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const error = asApiError(await failureOf());

    expect(error).toMatchObject({
      kind: "invalidResponse",
      status: 200,
      traceId: null,
      code: null,
      timestamp: null,
      fieldErrors: null,
    });
    expect(error.message).not.toContain("SECRET-BODY");
  });

  it("keeps the correlation header of an empty 502", async () => {
    server.use(
      http.get(
        HEALTH_URL,
        () =>
          new HttpResponse(null, { status: 502, headers: { "X-Correlation-ID": "abcd1234-ef56" } }),
      ),
    );

    const error = asApiError(await failureOf());

    expect(error).toMatchObject({ kind: "invalidResponse", status: 502, traceId: "abcd1234-ef56" });
  });

  it("does not count JSON of the wrong shape as success", async () => {
    server.use(http.get(HEALTH_URL, () => HttpResponse.json({ success: "yes", data: {} })));

    const error = asApiError(await failureOf());

    expect(error.kind).toBe("invalidResponse");
  });
});

describe("apiFetch connection failures", () => {
  it("turns a refused connection into network without the native message", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("NATIVE-FAILURE-TEXT"));

    const error = asApiError(await failureOf());

    expect(error).toMatchObject({ kind: "network", status: null, traceId: null, code: null });
    expect(error.message).not.toContain("NATIVE-FAILURE-TEXT");
    expect(error.stack ?? "").not.toContain("NATIVE-FAILURE-TEXT");
  });

  it("times out after 15 seconds without a response", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    server.use(healthPendingHandler());
    let outcome: unknown = "pending";
    const settled = apiFetch<HealthDataResponse>(HEALTH_REQUEST).then(
      () => (outcome = "resolved"),
      (error: unknown) => (outcome = error),
    );

    await vi.advanceTimersByTimeAsync(14_999);
    expect(outcome).toBe("pending");

    await vi.advanceTimersByTimeAsync(1);
    await settled;
    expect(asApiError(outcome).kind).toBe("timeout");
  });

  it("reports aborted when the caller cancels", async () => {
    server.use(healthPendingHandler());
    const controller = new AbortController();
    const pending = failureOf({ ...HEALTH_REQUEST, signal: controller.signal });

    controller.abort();

    expect(asApiError(await pending).kind).toBe("aborted");
  });
});

describe("apiFetch single error type", () => {
  it("throws ApiError for all five failure kinds", async () => {
    const kinds: string[] = [];

    server.use(healthDatabaseUnavailableHandler());
    kinds.push(asApiError(await failureOf()).kind);

    server.resetHandlers(http.get(HEALTH_URL, () => new HttpResponse("nope", { status: 200 })));
    kinds.push(asApiError(await failureOf()).kind);

    server.resetHandlers(healthNetworkErrorHandler());
    kinds.push(asApiError(await failureOf()).kind);

    server.resetHandlers(healthPendingHandler());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const timedOut = failureOf();
    await vi.advanceTimersByTimeAsync(15_000);
    kinds.push(asApiError(await timedOut).kind);
    vi.useRealTimers();

    const controller = new AbortController();
    const cancelled = failureOf({ ...HEALTH_REQUEST, signal: controller.signal });
    controller.abort();
    kinds.push(asApiError(await cancelled).kind);

    expect(kinds).toEqual(["http", "invalidResponse", "network", "timeout", "aborted"]);
  });
});
