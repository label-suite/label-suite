/**
 * Fixed MSW fixtures for the four health-check states (api-contract §MSW
 * 四種狀態的 fixture, design D11, clarification Q19 C1–C3).
 *
 * Bodies are assembled by hand with the generated types and only the fields
 * openapi.json declares, so a renamed field fails type checking. Handlers
 * match the absolute URL that apiFetch builds under the test environment's
 * VITE_API_BASE_URL; add them with `server.use()` so they are matched before
 * the generated defaults. Values come from the backend contract's examples
 * and error code table. No ground-truth answers or test-set data (Hard Rule 6).
 */
import { delay, http, HttpResponse, type HttpHandler } from "msw";

import type {
  ErrorDetail,
  ErrorResponse,
  HealthDataResponse,
} from "@/api/generated/label-suite.schemas";
import type { AppLanguage } from "@/lib/i18n";

/** The base URL set in vitest.config.ts `test.env`. */
export const TEST_API_BASE_URL = "http://localhost:8000";

/** The absolute health-check URL apiFetch sends in tests. */
export const HEALTH_URL = `${TEST_API_BASE_URL}/api/v1/health`;

/** Fixed traceId of the normal fixture. */
export const HEALTH_OK_TRACE_ID = "3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01";

/** Fixed traceId of the 503 fixture. */
export const DATABASE_UNAVAILABLE_TRACE_ID = "9c1d7e2a-4b3f-4a8e-8d6c-0f5e2a1b3c47";

const MESSAGES = {
  OK: { "zh-TW": "成功", en: "Success" },
  NOT_FOUND: { "zh-TW": "找不到指定的資源", en: "The requested resource was not found." },
  VALIDATION_FAILED: {
    "zh-TW": "輸入資料有誤，請檢查標示的欄位",
    en: "Some fields are invalid. Please check the highlighted fields.",
  },
  INTERNAL_ERROR: {
    "zh-TW": "系統發生錯誤，請稍後再試",
    en: "Something went wrong. Please try again later.",
  },
  DATABASE_UNAVAILABLE: {
    "zh-TW": "資料庫暫時無法連線，請稍後再試",
    en: "The database is temporarily unavailable. Please try again later.",
  },
} as const satisfies Record<string, Record<AppLanguage, string>>;

/** An error code from the backend contract's code table. */
export type FixtureErrorCode = Exclude<keyof typeof MESSAGES, "OK">;

/** The language a request asked for: `en` only when Accept-Language says so. */
function requestLanguage(request: Request): AppLanguage {
  return request.headers.get("Accept-Language") === "en" ? "en" : "zh-TW";
}

/** Response headers the backend sends with every envelope (Q19 C2). */
function envelopeHeaders(traceId: string, language: AppLanguage): HeadersInit {
  return { "X-Correlation-ID": traceId, "Content-Language": language };
}

/** The normal health-check body. */
export function healthOkBody(language: AppLanguage = "zh-TW"): HealthDataResponse {
  return {
    success: true,
    code: "OK",
    message: MESSAGES.OK[language],
    data: { status: "ok", database: "ok" },
    timestamp: "2026-11-20T08:15:30.123Z",
    traceId: HEALTH_OK_TRACE_ID,
  };
}

/** Options for an error envelope built from the backend contract's code table. */
export interface ErrorBodyOptions {
  /** The error code; its message comes from the backend contract. */
  code: FixtureErrorCode;
  /** Language of the message. */
  language?: AppLanguage;
  /** Fixed correlation id. */
  traceId?: string;
  /** Fixed UTC timestamp. */
  timestamp?: string;
  /** Field-level errors, for a 422 only. */
  errors?: ErrorDetail[] | null;
}

/** An error envelope whose code and message come from the backend contract. */
export function errorBody({
  code,
  language = "zh-TW",
  traceId = DATABASE_UNAVAILABLE_TRACE_ID,
  timestamp = "2026-11-20T08:15:35.456Z",
  errors = null,
}: ErrorBodyOptions): ErrorResponse {
  return {
    success: false,
    code,
    message: MESSAGES[code][language],
    data: null,
    timestamp,
    traceId,
    errors,
  };
}

/** The 503 database-unavailable body. */
export function databaseUnavailableBody(language: AppLanguage = "zh-TW"): ErrorResponse {
  return errorBody({ code: "DATABASE_UNAVAILABLE", language });
}

/** Normal state: 200 with the normal body in the request's language. */
export function healthOkHandler(): HttpHandler {
  return http.get(HEALTH_URL, ({ request }) => {
    const language = requestLanguage(request);
    return HttpResponse.json(healthOkBody(language), {
      status: 200,
      headers: envelopeHeaders(HEALTH_OK_TRACE_ID, language),
    });
  });
}

/** Backend-reported error state: 503 DATABASE_UNAVAILABLE in the request's language. */
export function healthDatabaseUnavailableHandler(): HttpHandler {
  return http.get(HEALTH_URL, ({ request }) => {
    const language = requestLanguage(request);
    return HttpResponse.json(databaseUnavailableBody(language), {
      status: 503,
      headers: envelopeHeaders(DATABASE_UNAVAILABLE_TRACE_ID, language),
    });
  });
}

/** Unreachable state: the fetch itself rejects. */
export function healthNetworkErrorHandler(): HttpHandler {
  return http.get(HEALTH_URL, () => HttpResponse.error());
}

/** Loading state: the response never arrives. */
export function healthPendingHandler(): HttpHandler {
  return http.get(HEALTH_URL, async () => {
    await delay("infinite");
    return HttpResponse.error();
  });
}
