/**
 * Runtime guards for the response envelope (api-contract §外層的判定規則).
 * Field requirements follow the `required` lists in backend/openapi.json;
 * the payload inside `data` is trusted to the generated types.
 */
import type { ErrorDetail } from "./generated/label-suite.schemas";

/** The success envelope with its payload left unchecked. */
export interface SuccessEnvelope {
  /** Always true for a success envelope. */
  success: true;
  /** Machine-readable result code. */
  code: string;
  /** Localised message. */
  message: string;
  /** The payload; its shape is trusted to the generated types. */
  data: unknown;
  /** Server time of the response, an ISO 8601 UTC instant. */
  timestamp: string;
  /** Correlation id, equal to the X-Correlation-ID response header. */
  traceId: string;
}

/** The error envelope as received; `errors` may be absent (clarification Q19 C4). */
export interface ErrorEnvelope {
  /** Always false for an error envelope. */
  success: false;
  /** Machine-readable error code. */
  code: string;
  /** Message localised by the backend through Accept-Language. */
  message: string;
  /** Always null for an error envelope. */
  data: null;
  /** Server time of the response, an ISO 8601 UTC instant. */
  timestamp: string;
  /** Correlation id, equal to the X-Correlation-ID response header. */
  traceId: string;
  /** Field-level errors of a 422; null or absent otherwise. */
  errors?: ErrorDetail[] | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStringFields(body: Record<string, unknown>): boolean {
  return (
    typeof body.code === "string" &&
    typeof body.message === "string" &&
    typeof body.timestamp === "string" &&
    typeof body.traceId === "string"
  );
}

/** True when `body` is a success envelope: success is true, the four strings are present, and there is a data key. */
export function isSuccessEnvelope(body: unknown): body is SuccessEnvelope {
  return isRecord(body) && body.success === true && hasStringFields(body) && "data" in body;
}

/** True when `body` is an error envelope; a missing `errors` key counts as null. */
export function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  if (!isRecord(body) || body.success !== false || !hasStringFields(body)) {
    return false;
  }
  if (!("data" in body) || body.data !== null) {
    return false;
  }
  const errors = body.errors;
  return errors === undefined || errors === null || Array.isArray(errors);
}
