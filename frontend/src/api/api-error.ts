/**
 * The single error type that apiFetch throws (api-contract §錯誤正規化契約).
 * Components and hooks never see a native TypeError, DOMException, Response
 * or an unnarrowed value: every failure arrives as an ApiError.
 */
import type { ErrorDetail } from "./generated/label-suite.schemas";

/** How a request failed (api-contract §ApiErrorKind). None is retried automatically. */
export type ApiErrorKind = "http" | "network" | "timeout" | "invalidResponse" | "aborted";

/** The values an ApiError is built from; omitted nullable fields default to null. */
export interface ApiErrorInit {
  /** How the request failed. */
  kind: ApiErrorKind;
  /**
   * For `http`, the envelope's message, already localised by the backend.
   * For every other kind, an English diagnostic string that never carries the
   * response body or a native error's message.
   */
  message: string;
  /** HTTP status code; set for `http` and `invalidResponse`. */
  status?: number | null;
  /** The error envelope's code; set for `http` only. */
  code?: string | null;
  /** The envelope's traceId, or the X-Correlation-ID header for `invalidResponse`. */
  traceId?: string | null;
  /** The error envelope's timestamp (UTC); set for `http` only. */
  timestamp?: string | null;
  /** The envelope's `errors`; set for an `http` 422 only. */
  fieldErrors?: ErrorDetail[] | null;
}

export class ApiError extends Error {
  /** How the request failed. */
  readonly kind: ApiErrorKind;
  /** HTTP status code, or null when no response arrived. */
  readonly status: number | null;
  /** The error envelope's code, or null when there was no error envelope. */
  readonly code: string | null;
  /** Correlation id of the request, or null when none is known. */
  readonly traceId: string | null;
  /** The error envelope's timestamp, or null when there was no error envelope. */
  readonly timestamp: string | null;
  /** Field-level validation errors of a 422, otherwise null. */
  readonly fieldErrors: ErrorDetail[] | null;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.code = init.code ?? null;
    this.traceId = init.traceId ?? null;
    this.timestamp = init.timestamp ?? null;
    this.fieldErrors = init.fieldErrors ?? null;
  }
}

/** Narrows an unknown thrown value to ApiError. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/**
 * True only for an error envelope with status 401 (clarification Q4). A 403
 * means "no permission", not "not signed in", and is left to 01-01.
 */
export function isAuthError(value: unknown): boolean {
  return isApiError(value) && value.kind === "http" && value.status === 401;
}

/**
 * Which full-page state a rejected read maps to: `denied` (no permission),
 * `notFound` (missing, or not to be known to exist), or `other` (the block's
 * own error state).
 */
export type RejectionKind = "denied" | "notFound" | "other";

/**
 * Classifies a rejection by the error envelope's status and code together
 * (api-contract §為什麼要看 `code`): only `403 PERMISSION_DENIED` is denied
 * and only `404 NOT_FOUND` is notFound, so `403 CSRF_FAILED` stays other.
 * A pure function: it sends nothing, reads no cache and does not decide
 * whether the page draws a full-page state or where its way back leads.
 *
 * @param value Any thrown value, such as a query's `error`.
 */
export function classifyRejection(value: unknown): RejectionKind {
  if (!isApiError(value) || value.kind !== "http") {
    return "other";
  }
  if (value.status === 403 && value.code === "PERMISSION_DENIED") {
    return "denied";
  }
  if (value.status === 404 && value.code === "NOT_FOUND") {
    return "notFound";
  }
  return "other";
}
