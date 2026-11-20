import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/api-error";

import {
  isRecheckDisabled,
  toHealthViewState,
  type HealthQueryInput,
} from "./to-health-view-state";

const okData: NonNullable<HealthQueryInput["data"]> = {
  data: { status: "ok", database: "ok" },
  meta: {
    traceId: "3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01",
    timestamp: "2026-11-20T08:15:30.123Z",
  },
};

const databaseUnavailable = new ApiError({
  kind: "http",
  status: 503,
  code: "DATABASE_UNAVAILABLE",
  message: "資料庫暫時無法連線，請稍後再試",
  traceId: "9c1d7e2a-4b3f-4a8e-8d6c-0f5e2a1b3c47",
  timestamp: "2026-11-20T08:15:35.456Z",
});

const aborted = new ApiError({ kind: "aborted", message: "Request was cancelled" });

/** A settled query with the given overrides. */
function query(overrides: Partial<HealthQueryInput>): HealthQueryInput {
  return { isPending: false, isFetching: false, data: undefined, error: null, ...overrides };
}

describe("toHealthViewState", () => {
  it("returns null for an aborted request before anything else, even while pending", () => {
    expect(
      toHealthViewState(query({ isPending: true, isFetching: true, error: aborted }), false),
    ).toBeNull();
    expect(toHealthViewState(query({ isFetching: true, error: aborted }), true)).toBeNull();
    expect(toHealthViewState(query({ data: okData, error: aborted }), false)).toBeNull();
  });

  it("is loading on the first load", () => {
    expect(toHealthViewState(query({ isPending: true, isFetching: true }), false)).toEqual({
      kind: "loading",
    });
  });

  it("is loading while a refetch the user started is in flight, whatever the previous result", () => {
    expect(toHealthViewState(query({ isFetching: true, data: okData }), true)).toEqual({
      kind: "loading",
    });
    expect(
      toHealthViewState(query({ isFetching: true, error: databaseUnavailable }), true),
    ).toEqual({ kind: "loading" });
  });

  it("keeps the previous result during a background refetch", () => {
    expect(toHealthViewState(query({ isFetching: true, data: okData }), false)).toMatchObject({
      kind: "ok",
    });
    expect(
      toHealthViewState(query({ isFetching: true, error: databaseUnavailable }), false),
    ).toMatchObject({ kind: "backendError" });
  });

  it("maps a success to ok with the service, database, server time and traceId", () => {
    expect(toHealthViewState(query({ data: okData }), false)).toEqual({
      kind: "ok",
      service: "ok",
      database: "ok",
      checkedAt: "2026-11-20T08:15:30.123Z",
      traceId: "3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01",
    });
  });

  it("ignores the user flag once the refetch has finished", () => {
    expect(toHealthViewState(query({ data: okData }), true)).toMatchObject({ kind: "ok" });
  });

  it("maps DATABASE_UNAVAILABLE to backendError with its own title", () => {
    expect(toHealthViewState(query({ error: databaseUnavailable }), false)).toEqual({
      kind: "backendError",
      titleKey: "databaseUnavailable",
      code: "DATABASE_UNAVAILABLE",
      message: "資料庫暫時無法連線，請稍後再試",
      traceId: "9c1d7e2a-4b3f-4a8e-8d6c-0f5e2a1b3c47",
    });
  });

  it.each([
    [500, "INTERNAL_ERROR"],
    [404, "NOT_FOUND"],
    [422, "VALIDATION_FAILED"],
  ])(
    "maps any other error envelope (%i %s) to backendError with the generic title",
    (status, code) => {
      const error = new ApiError({
        kind: "http",
        status,
        code,
        message: "backend message",
        traceId: "trace",
      });
      expect(toHealthViewState(query({ error }), false)).toEqual({
        kind: "backendError",
        titleKey: "backendError",
        code,
        message: "backend message",
        traceId: "trace",
      });
    },
  );

  it("prefers the latest error over data kept from an earlier success", () => {
    expect(
      toHealthViewState(query({ data: okData, error: databaseUnavailable }), false),
    ).toMatchObject({ kind: "backendError" });
  });

  it.each([
    ["network", "network"],
    ["timeout", "timeout"],
    ["invalidResponse", "network"],
  ] as const)("maps a %s failure to unreachable with error type %s", (kind, errorType) => {
    const error = new ApiError({ kind, message: "diagnostic" });
    expect(toHealthViewState(query({ error }), false)).toEqual({ kind: "unreachable", errorType });
  });
});

describe("isRecheckDisabled", () => {
  it.each([
    [{ isPending: true, isFetching: true }, true],
    [{ isFetching: true, data: okData }, true],
    [{ data: okData }, false],
    [{ error: databaseUnavailable }, false],
  ] as const)("for %o is %s", (overrides, expected) => {
    expect(isRecheckDisabled(query(overrides))).toBe(expected);
  });
});
