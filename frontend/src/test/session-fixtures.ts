/**
 * MSW fixtures for the account endpoints (login-auth-guard api-contract.md).
 *
 * Bodies are built with the generated types, so a renamed field fails type
 * checking. Handlers match the absolute URLs apiFetch builds under the test
 * environment's VITE_API_BASE_URL; add them with `server.use()`. The people
 * below are made-up sample accounts. No ground-truth answers or test-set data
 * (Hard Rule 6).
 */
import { http, HttpResponse, type HttpHandler } from "msw";

import type {
  ErrorResponse,
  SessionDataResponse,
  SessionUserData,
} from "@/api/generated/label-suite.schemas";

import { TEST_API_BASE_URL } from "./envelope-fixtures";

/** GET and DELETE of the current session. */
export const CURRENT_SESSION_URL = `${TEST_API_BASE_URL}/api/v1/current-session`;

/** POST that extends the session (createSessionRefresh). */
export const SESSION_REFRESH_URL = `${TEST_API_BASE_URL}/api/v1/session-refreshes`;

/** A signed-in member, used as the default account in fixtures. */
export const SAMPLE_MEMBER: SessionUserData = {
  id: "0b6f3a52-1c7e-4d2a-9f41-6e8b2c9d0a17",
  name: "Mei Lin",
  email: "mei.lin@example.com",
  role: "user",
};

/** A success envelope carrying `user`. */
export function sessionBody(user: SessionUserData = SAMPLE_MEMBER): SessionDataResponse {
  return {
    success: true,
    code: "OK",
    message: "成功",
    data: { user },
    timestamp: "2026-11-26T08:00:00.000Z",
    traceId: "7d2c4e1a-5b3f-4c8d-9e0a-1f2b3c4d5e6f",
  };
}

/** The error codes the account endpoints answer with (api-contract.md). */
export type AccountErrorCode =
  | "AUTH_REQUIRED"
  | "ACCOUNT_INVALID_CREDENTIALS"
  | "ACCOUNT_GOOGLE_FLOW_INVALID"
  | "ACCOUNT_GOOGLE_REJECTED"
  | "ACCOUNT_GOOGLE_UNAVAILABLE"
  | "ACCOUNT_SESSION_EXPIRED"
  | "ACCOUNT_SESSION_INVALID"
  | "ACCOUNT_REFRESH_CONFLICT"
  | "CSRF_FAILED";

/** An error envelope with `code`. The message is a fixed placeholder: the UI never shows it. */
export function accountErrorBody(code: AccountErrorCode): ErrorResponse {
  return {
    success: false,
    code,
    message: `message of ${code}`,
    data: null,
    timestamp: "2026-11-26T08:00:01.000Z",
    traceId: "8e3d5f2b-6c4a-4d9e-8f1b-2a3c4d5e6f70",
    errors: null,
  };
}

/** One scripted answer: a status with an error code, or a success. */
export type ScriptedAnswer = { status: 200 | 201 } | { status: number; code: AccountErrorCode };

/** Turns one scripted answer into a response. */
function answer(step: ScriptedAnswer): Response {
  if ("code" in step) {
    return HttpResponse.json(accountErrorBody(step.code), { status: step.status });
  }
  return HttpResponse.json(sessionBody(), { status: step.status });
}

/** Counts the requests a scripted handler received. */
export interface RequestCounter {
  /** How many requests arrived so far. */
  count: () => number;
}

/**
 * Answers the requests to `method url` with `steps` in order; the last step
 * repeats once the script runs out.
 */
export function scriptedHandler(
  method: "get" | "post" | "delete",
  url: string,
  steps: readonly ScriptedAnswer[],
): { handler: HttpHandler; counter: RequestCounter } {
  let requests = 0;
  const handler = http[method](url, () => {
    const step = steps[Math.min(requests, steps.length - 1)];
    requests += 1;
    if (step === undefined) {
      throw new Error(`No scripted answer for ${method.toUpperCase()} ${url}`);
    }
    return answer(step);
  });
  return { handler, counter: { count: () => requests } };
}

/** GET of the deployment's sign-in options. */
export const AUTH_OPTIONS_URL = `${TEST_API_BASE_URL}/api/v1/auth-options`;

/** POST of the Email-and-password sign-in. */
export const SESSIONS_URL = `${TEST_API_BASE_URL}/api/v1/sessions`;

/** GET of Google's authorisation URL. */
export const GOOGLE_AUTHORIZATION_URL = `${TEST_API_BASE_URL}/api/v1/google-authorization`;

/** POST that completes the Google sign-in. */
export const GOOGLE_SESSIONS_URL = `${TEST_API_BASE_URL}/api/v1/google-sessions`;

/** The platform member of the spec scenarios. */
export const SPEC_MEMBER: SessionUserData = {
  id: "5a1e2c3d-4b5f-4a6e-8c7d-9e0f1a2b3c4d",
  name: "王小明",
  email: "user@example.com",
  role: "user",
};

/** A system administrator. */
export const SAMPLE_ADMIN: SessionUserData = {
  id: "6b2f3d4e-5c6a-4b7f-9d8e-0f1a2b3c4d5e",
  name: "Admin Chen",
  email: "admin@example.com",
  role: "super_admin",
};

/** The deployment switches answered by `getAuthOptions`. */
export interface AuthOptions {
  /** Whether Google sign-in is configured. */
  googleEnabled: boolean;
  /** Whether self-registration (a mail service) is configured. */
  selfRegistrationEnabled: boolean;
}

/** Answers the sign-in options with `options` (both on by default). */
export function authOptionsHandler(
  options: AuthOptions = { googleEnabled: true, selfRegistrationEnabled: true },
): HttpHandler {
  return http.get(AUTH_OPTIONS_URL, () =>
    HttpResponse.json({
      success: true,
      code: "OK",
      message: "成功",
      data: options,
      timestamp: "2026-11-26T08:00:00.000Z",
      traceId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    }),
  );
}

/** A visitor with no cookies: the session and the refresh both answer 401 AUTH_REQUIRED. */
export function signedOutHandlers(): HttpHandler[] {
  return [
    http.get(CURRENT_SESSION_URL, () =>
      HttpResponse.json(accountErrorBody("AUTH_REQUIRED"), { status: 401 }),
    ),
    http.post(SESSION_REFRESH_URL, () =>
      HttpResponse.json(accountErrorBody("AUTH_REQUIRED"), { status: 401 }),
    ),
  ];
}

/** A signed-in visitor: the session answers 200 with `user`. */
export function signedInHandler(user: SessionUserData = SAMPLE_MEMBER): HttpHandler {
  return http.get(CURRENT_SESSION_URL, () => HttpResponse.json(sessionBody(user)));
}

/** A successful session body for `user`, for sign-in and refresh answers. */
export function sessionCreatedResponse(user: SessionUserData = SAMPLE_MEMBER): Response {
  return HttpResponse.json(sessionBody(user), { status: 201 });
}

/** An error envelope response with `code` and `status`. */
export function accountErrorResponse(code: AccountErrorCode, status: number): Response {
  return HttpResponse.json(accountErrorBody(code), { status });
}
