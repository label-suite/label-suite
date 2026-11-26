/**
 * specs/frontend-api-client: "AUTH_REQUIRED 時延續並重送原請求（各至多兩次）"
 * and "認證錯誤只認 401", driven through the generated client so every request
 * goes through apiFetch exactly as at runtime (design D7).
 */
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/test/msw-server";
import {
  CURRENT_SESSION_URL,
  accountErrorBody,
  SESSION_REFRESH_URL,
  scriptedHandler,
  sessionBody,
  type ScriptedAnswer,
} from "@/test/session-fixtures";

import { isApiError, isAuthError } from "./api-error";
import { getCurrentSession } from "./generated/label-suite";
import { isAuthRequired } from "./session-refresh";

/** Scripts the current-session query and the refresh, returning both counters. */
function script(original: ScriptedAnswer[], refresh: ScriptedAnswer[]) {
  const query = scriptedHandler("get", CURRENT_SESSION_URL, original);
  const refreshes = scriptedHandler("post", SESSION_REFRESH_URL, refresh);
  server.use(query.handler, refreshes.handler);
  return { originals: query.counter, refreshes: refreshes.counter };
}

/** Runs the query and returns what it threw, failing the test if it resolved. */
async function failureOf(): Promise<unknown> {
  try {
    await getCurrentSession();
  } catch (error: unknown) {
    return error;
  }
  throw new Error("the query resolved, but a failure was expected");
}

/** The error code of a caught value, or null when it is not an ApiError. */
function codeOf(error: unknown): string | null {
  return isApiError(error) ? error.code : null;
}

const AUTH_REQUIRED = { status: 401, code: "AUTH_REQUIRED" } as const;
const CONFLICT = { status: 409, code: "ACCOUNT_REFRESH_CONFLICT" } as const;
const OK = { status: 200 } as const;
const CREATED = { status: 201 } as const;

describe("session refresh on AUTH_REQUIRED", () => {
  it("resends the original request once after a successful refresh", async () => {
    const counts = script([AUTH_REQUIRED, OK], [CREATED]);

    const result = await getCurrentSession();

    expect(result.data.user.email).toBe("mei.lin@example.com");
    expect(counts.originals.count()).toBe(2);
    expect(counts.refreshes.count()).toBe(1);
  });

  it("hands the refresh's error to the caller and does not resend", async () => {
    const counts = script([AUTH_REQUIRED, OK], [{ status: 401, code: "ACCOUNT_SESSION_EXPIRED" }]);

    const error = await failureOf();

    expect(codeOf(error)).toBe("ACCOUNT_SESSION_EXPIRED");
    expect(counts.originals.count()).toBe(1);
    expect(counts.refreshes.count()).toBe(1);
  });

  it("waits and resends once when the refresh conflicts", async () => {
    const counts = script([AUTH_REQUIRED, OK], [CONFLICT]);

    const result = await getCurrentSession();

    expect(result.data.user.role).toBe("user");
    expect(counts.originals.count()).toBe(2);
    expect(counts.refreshes.count()).toBe(1);
  });

  it("refreshes once more when the resend after a conflict is still refused", async () => {
    const counts = script([AUTH_REQUIRED, AUTH_REQUIRED, OK], [CONFLICT, CREATED]);

    await getCurrentSession();

    expect(counts.originals.count()).toBe(3);
    expect(counts.refreshes.count()).toBe(2);
  });

  it("refreshes at most twice", async () => {
    const counts = script(
      [AUTH_REQUIRED, AUTH_REQUIRED, OK],
      [CONFLICT, { status: 401, code: "ACCOUNT_SESSION_INVALID" }],
    );

    const error = await failureOf();

    expect(codeOf(error)).toBe("ACCOUNT_SESSION_INVALID");
    expect(counts.refreshes.count()).toBe(2);
    expect(counts.originals.count()).toBe(2);
  });

  it("does not refresh a third time when every attempt is refused", async () => {
    const counts = script([AUTH_REQUIRED], [CONFLICT, CREATED, CREATED]);

    const error = await failureOf();

    expect(codeOf(error)).toBe("AUTH_REQUIRED");
    expect(counts.refreshes.count()).toBe(2);
    expect(counts.originals.count()).toBe(3);
  });

  it("shares one refresh between three requests refused at the same time", async () => {
    let refreshed = false;
    let refreshes = 0;
    let originals = 0;
    server.use(
      http.post(SESSION_REFRESH_URL, async () => {
        refreshes += 1;
        // Slow enough that all three refusals arrive while it is in flight.
        await delay(50);
        refreshed = true;
        return HttpResponse.json(sessionBody(), { status: 201 });
      }),
      http.get(CURRENT_SESSION_URL, () => {
        originals += 1;
        return refreshed
          ? HttpResponse.json(sessionBody(), { status: 200 })
          : HttpResponse.json(accountErrorBody("AUTH_REQUIRED"), { status: 401 });
      }),
    );

    await Promise.all([getCurrentSession(), getCurrentSession(), getCurrentSession()]);

    expect(refreshes).toBe(1);
    expect(originals).toBe(6);
  });

  it("never refreshes because of the refresh request itself", async () => {
    const counts = script([AUTH_REQUIRED], [AUTH_REQUIRED]);

    const error = await failureOf();

    expect(codeOf(error)).toBe("AUTH_REQUIRED");
    expect(counts.refreshes.count()).toBe(1);
    expect(counts.originals.count()).toBe(1);
  });
});

describe("only 401 AUTH_REQUIRED starts a refresh", () => {
  it("sends a 401 with another code once, and it still counts as an auth error", async () => {
    const counts = script([{ status: 401, code: "ACCOUNT_INVALID_CREDENTIALS" }], [CREATED]);

    const error = await failureOf();

    expect(counts.originals.count()).toBe(1);
    expect(counts.refreshes.count()).toBe(0);
    expect(isAuthError(error)).toBe(true);
    expect(isAuthRequired(error)).toBe(false);
  });

  it("sends a 403 once, and it is not an auth error", async () => {
    const counts = script([{ status: 403, code: "CSRF_FAILED" }], [CREATED]);

    const error = await failureOf();

    expect(counts.originals.count()).toBe(1);
    expect(counts.refreshes.count()).toBe(0);
    expect(isAuthError(error)).toBe(false);
  });

  it("does not treat a connection failure as an auth error", async () => {
    server.use(http.get(CURRENT_SESSION_URL, () => HttpResponse.error()));

    const error = await failureOf();

    expect(isApiError(error) && error.kind).toBe("network");
    expect(isAuthError(error)).toBe(false);
    expect(isAuthRequired(error)).toBe(false);
  });
});
