/**
 * apiFetch is the Orval mutator and the single HTTP boundary (api-agent-rules
 * A6). The base URL, credentials, Accept-Language, timeout and cancellation,
 * and the conversion of every failure into ApiError live here and nowhere else
 * (system-design §唯一出口的處理順序). It knows no operationId, so adding an
 * endpoint needs no change here.
 */
import { composeSignals, type AbortSource } from "@/lib/abort";
import { getCurrentLanguage } from "@/lib/i18n";

import { ApiError } from "./api-error";
import { readApiConfig } from "./config";
import { isErrorEnvelope, isSuccessEnvelope } from "./envelope";

/** Request metadata lifted out of the success envelope. */
export interface ResponseMeta {
  /** The envelope's traceId, equal to the X-Correlation-ID response header. */
  traceId: string;
  /** The envelope's timestamp, an ISO 8601 UTC instant. */
  timestamp: string;
}

/** What apiFetch resolves to: the envelope's data plus meta, or T unchanged when T has no data. */
export type ApiResponse<T> = T extends { data: infer D } ? { data: D; meta: ResponseMeta } : T;

/** The request description Orval passes to the mutator. */
export interface RequestConfig {
  /** Path from the OpenAPI document, without the base URL. */
  url: string;
  /** HTTP method. */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Query parameters. */
  params?: Record<string, unknown>;
  /** Request body, serialised as JSON. */
  data?: unknown;
  /** Extra request headers. */
  headers?: Record<string, string>;
  /** The caller's abort signal (TanStack Query passes one). */
  signal?: AbortSignal;
}

/** Per-call options of apiFetch. */
export interface ApiFetchOptions {
  /** Request timeout in milliseconds; defaults to readApiConfig's 15 seconds. */
  timeoutMs?: number;
}

/**
 * Every generated error type resolves to ApiError. Orval's mutator contract
 * requires the type parameter even though the result does not depend on it.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Orval passes the error schema here; apiFetch always throws ApiError.
export type ErrorType<_E> = ApiError;

/** Request bodies are passed through unchanged. */
export type BodyType<B> = B;

/** Appends one query value; null and undefined are skipped, arrays repeat the key. */
function appendParam(search: URLSearchParams, name: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      appendParam(search, name, item);
    }
    return;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    search.append(name, String(value));
    return;
  }
  throw new TypeError(`Unsupported value for query parameter "${name}"`);
}

/**
 * Joins the base URL, the generated path and the query parameters. An empty
 * base URL yields a same-origin relative path such as `/api/v1/health`.
 *
 * @param baseUrl The validated VITE_API_BASE_URL, possibly empty.
 * @param url The generated path, already starting with `/api/v1`.
 * @param params Query parameters, serialised with URLSearchParams.
 */
export function buildRequestUrl(
  baseUrl: string,
  url: string,
  params?: Record<string, unknown>,
): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params ?? {})) {
    appendParam(search, name, value);
  }
  const query = search.toString();
  return `${baseUrl}${url}${query === "" ? "" : `?${query}`}`;
}

/** The ApiError for a rejected fetch or body read, told apart by which signal fired. */
function failureFromRejection(source: AbortSource | null, request: string): ApiError {
  switch (source) {
    case "timeout":
      return new ApiError({ kind: "timeout", message: `Request timed out (${request})` });
    case "caller":
      return new ApiError({ kind: "aborted", message: `Request was cancelled (${request})` });
    case null:
      return new ApiError({ kind: "network", message: `Network request failed (${request})` });
  }
}

/** Parses a body as JSON, or returns undefined for an empty or non-JSON body. */
function parseJson(text: string): unknown {
  if (text === "") {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * The single HTTP exit of the frontend. Resolves to `{ data, meta }` for a
 * success envelope and to undefined for a 204; every failure is thrown as an
 * ApiError. No retries.
 *
 * @param config The request Orval generated.
 * @param options Per-call options such as a longer timeout.
 */
export async function apiFetch<T>(
  config: RequestConfig,
  options?: ApiFetchOptions,
): Promise<ApiResponse<T>> {
  const { baseUrl, defaultTimeoutMs } = readApiConfig();
  const request = `${config.method} ${config.url}`;

  const headers = new Headers(config.headers);
  headers.set("Accept-Language", getCurrentLanguage());
  const hasBody = config.data !== undefined;
  if (hasBody) {
    headers.set("Content-Type", "application/json");
  }

  const composed = composeSignals(config.signal, options?.timeoutMs ?? defaultTimeoutMs);
  try {
    let response: Response;
    let text: string;
    try {
      response = await fetch(buildRequestUrl(baseUrl, config.url, config.params), {
        method: config.method,
        headers,
        credentials: "include",
        body: hasBody ? JSON.stringify(config.data) : undefined,
        signal: composed.signal,
      });
      text = await response.text();
    } catch {
      // The native error is dropped on purpose: its message never reaches callers.
      throw failureFromRejection(composed.reason(), request);
    }

    if (response.status === 204) {
      // A 204 endpoint is generated with a body-less T, for which ApiResponse<T> is T itself.
      return undefined as ApiResponse<T>;
    }

    const body = parseJson(text);
    if (response.ok && isSuccessEnvelope(body)) {
      // The payload inside data is trusted to the generated types (api-contract §外層的判定規則).
      return {
        data: body.data,
        meta: { traceId: body.traceId, timestamp: body.timestamp },
      } as ApiResponse<T>;
    }
    if (!response.ok && isErrorEnvelope(body)) {
      throw new ApiError({
        kind: "http",
        status: response.status,
        code: body.code,
        message: body.message,
        traceId: body.traceId,
        timestamp: body.timestamp,
        fieldErrors: response.status === 422 ? (body.errors ?? null) : null,
      });
    }
    throw new ApiError({
      kind: "invalidResponse",
      status: response.status,
      traceId: response.headers.get("X-Correlation-ID"),
      message: `Response is not an API envelope (${request}, status ${String(response.status)})`,
    });
  } finally {
    composed.cleanup();
  }
}
