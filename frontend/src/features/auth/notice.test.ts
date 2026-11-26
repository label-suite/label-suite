import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/api-error";

import {
  noticeForSessionError,
  noticeForSignInError,
  noticeKey,
  noticeState,
  readNoticeState,
} from "./notice";

/** An http ApiError with `status` and `code`. */
function httpError(status: number, code: string): ApiError {
  return new ApiError({ kind: "http", status, code, message: "x" });
}

describe("readNoticeState", () => {
  it("reads a known notice back from the navigation state", () => {
    expect(readNoticeState(noticeState("googleRejected"))).toBe("googleRejected");
  });

  it.each([
    [null],
    [undefined],
    ["unavailable"],
    [{}],
    [{ loginNotice: "other" }],
    [{ loginNotice: 1 }],
  ])("ignores %j", (state) => {
    expect(readNoticeState(state)).toBeNull();
  });
});

describe("noticeForSessionError", () => {
  it.each([
    [httpError(401, "ACCOUNT_SESSION_EXPIRED"), "sessionExpired"],
    [httpError(401, "ACCOUNT_SESSION_INVALID"), "sessionInvalid"],
    [httpError(401, "AUTH_REQUIRED"), null],
    [httpError(409, "ACCOUNT_REFRESH_CONFLICT"), null],
    [httpError(503, "DATABASE_UNAVAILABLE"), "unavailable"],
    [httpError(403, "CSRF_FAILED"), null],
    [new ApiError({ kind: "network", message: "x" }), "unavailable"],
    [new ApiError({ kind: "invalidResponse", status: 200, message: "x" }), "unavailable"],
    [new Error("not an ApiError"), "unavailable"],
  ])("maps %s to %s", (error, notice) => {
    expect(noticeForSessionError(error)).toBe(notice);
  });
});

describe("noticeForSignInError", () => {
  it("has one sentence for wrong credentials and the retry sentence otherwise", () => {
    expect(noticeForSignInError(httpError(401, "ACCOUNT_INVALID_CREDENTIALS"))).toBe(
      "invalidCredentials",
    );
    expect(noticeForSignInError(httpError(422, "VALIDATION_FAILED"))).toBe("unavailable");
    expect(noticeForSignInError(new Error("x"))).toBe("unavailable");
  });
});

describe("noticeKey", () => {
  it("points at the auth namespace's error sentences", () => {
    expect(noticeKey("sessionExpired")).toBe("login.error.sessionExpired");
  });
});
