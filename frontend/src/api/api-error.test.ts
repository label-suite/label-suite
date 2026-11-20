import { describe, expect, it } from "vitest";

import { ApiError, isApiError, isAuthError } from "./api-error";

describe("ApiError", () => {
  it("carries every field of the error contract", () => {
    const error = new ApiError({
      kind: "http",
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      message: "資料庫暫時無法連線，請稍後再試",
      traceId: "9c1d7e2a-4b3f-4a8e-8d6c-0f5e2a1b3c47",
      timestamp: "2026-11-20T08:15:35.456Z",
      fieldErrors: null,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "ApiError",
      kind: "http",
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      message: "資料庫暫時無法連線，請稍後再試",
      traceId: "9c1d7e2a-4b3f-4a8e-8d6c-0f5e2a1b3c47",
      timestamp: "2026-11-20T08:15:35.456Z",
      fieldErrors: null,
    });
  });

  it("defaults the optional fields to null", () => {
    const error = new ApiError({ kind: "network", message: "Network request failed" });

    expect(error).toMatchObject({
      kind: "network",
      status: null,
      code: null,
      traceId: null,
      timestamp: null,
      fieldErrors: null,
    });
  });
});

describe("isApiError", () => {
  it("accepts an ApiError", () => {
    expect(isApiError(new ApiError({ kind: "timeout", message: "Request timed out" }))).toBe(true);
  });

  it.each([new Error("plain"), new TypeError("Failed to fetch"), "text", null, undefined, {}])(
    "rejects %s",
    (value) => {
      expect(isApiError(value)).toBe(false);
    },
  );
});

describe("isAuthError", () => {
  it("is true for an http error with status 401", () => {
    expect(isAuthError(new ApiError({ kind: "http", status: 401, message: "unauthorised" }))).toBe(
      true,
    );
  });

  it("is false for 403, which means no permission rather than not signed in", () => {
    expect(isAuthError(new ApiError({ kind: "http", status: 403, message: "forbidden" }))).toBe(
      false,
    );
  });

  it("is false for a network failure", () => {
    expect(isAuthError(new ApiError({ kind: "network", message: "Network request failed" }))).toBe(
      false,
    );
  });

  it("is false for a non-envelope response that happens to carry 401", () => {
    expect(
      isAuthError(
        new ApiError({ kind: "invalidResponse", status: 401, message: "not an envelope" }),
      ),
    ).toBe(false);
  });

  it("is false for values that are not ApiError", () => {
    expect(isAuthError(new Error("401"))).toBe(false);
    expect(isAuthError({ kind: "http", status: 401 })).toBe(false);
  });
});
