import { describe, expect, it } from "vitest";

import { isErrorEnvelope, isSuccessEnvelope } from "./envelope";

const success = {
  success: true,
  code: "OK",
  message: "成功",
  data: { status: "ok", database: "ok" },
  timestamp: "2026-11-20T08:15:30.123Z",
  traceId: "3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01",
};

const failure = {
  success: false,
  code: "DATABASE_UNAVAILABLE",
  message: "資料庫暫時無法連線，請稍後再試",
  data: null,
  timestamp: "2026-11-20T08:15:35.456Z",
  traceId: "9c1d7e2a-4b3f-4a8e-8d6c-0f5e2a1b3c47",
  errors: null,
};

/** Returns a copy of `value` without `key`. */
function without(value: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
}

describe("isSuccessEnvelope", () => {
  it("accepts a complete success envelope", () => {
    expect(isSuccessEnvelope(success)).toBe(true);
  });

  it("accepts null data as long as the data key is present", () => {
    expect(isSuccessEnvelope({ ...success, data: null })).toBe(true);
  });

  it.each([null, undefined, "text", 42, [success]])("rejects the non-object %s", (value) => {
    expect(isSuccessEnvelope(value)).toBe(false);
  });

  it("rejects success that is not exactly true", () => {
    expect(isSuccessEnvelope({ ...success, success: false })).toBe(false);
    expect(isSuccessEnvelope({ ...success, success: "true" })).toBe(false);
  });

  it.each(["code", "message", "timestamp", "traceId"])("rejects a missing %s", (key) => {
    expect(isSuccessEnvelope(without(success, key))).toBe(false);
  });

  it.each(["code", "message", "timestamp", "traceId"])("rejects a non-string %s", (key) => {
    expect(isSuccessEnvelope({ ...success, [key]: 1 })).toBe(false);
  });

  it("rejects a body without the data key", () => {
    expect(isSuccessEnvelope(without(success, "data"))).toBe(false);
  });

  it("does not count JSON of the wrong shape as success", () => {
    expect(isSuccessEnvelope({ success: "yes", data: {} })).toBe(false);
  });
});

describe("isErrorEnvelope", () => {
  it("accepts a complete error envelope", () => {
    expect(isErrorEnvelope(failure)).toBe(true);
  });

  it("accepts an errors array", () => {
    const errors = [{ location: "body", field: "displayName", code: "missing", message: "x" }];
    expect(isErrorEnvelope({ ...failure, errors })).toBe(true);
  });

  it("still treats a body without the errors key as an error envelope", () => {
    expect(isErrorEnvelope(without(failure, "errors"))).toBe(true);
  });

  it.each([null, undefined, "text", 42, [failure]])("rejects the non-object %s", (value) => {
    expect(isErrorEnvelope(value)).toBe(false);
  });

  it("rejects success that is not exactly false", () => {
    expect(isErrorEnvelope({ ...failure, success: true })).toBe(false);
    expect(isErrorEnvelope({ ...failure, success: 0 })).toBe(false);
  });

  it.each(["code", "message", "timestamp", "traceId"])("rejects a missing %s", (key) => {
    expect(isErrorEnvelope(without(failure, key))).toBe(false);
  });

  it.each(["code", "message", "timestamp", "traceId"])("rejects a non-string %s", (key) => {
    expect(isErrorEnvelope({ ...failure, [key]: 1 })).toBe(false);
  });

  it("rejects data that is not null", () => {
    expect(isErrorEnvelope({ ...failure, data: {} })).toBe(false);
    expect(isErrorEnvelope(without(failure, "data"))).toBe(false);
  });

  it("rejects errors that are neither an array nor null", () => {
    expect(isErrorEnvelope({ ...failure, errors: "bad" })).toBe(false);
    expect(isErrorEnvelope({ ...failure, errors: {} })).toBe(false);
  });
});
