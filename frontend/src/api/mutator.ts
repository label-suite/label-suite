/**
 * apiFetch is the Orval mutator and the single HTTP boundary (api-agent-rules A6).
 *
 * Minimal version for the N3 check: only the exported types are final here.
 * Task 3.4 implements the request handling described in system-design
 * §唯一出口的處理順序.
 */
import { ApiError } from "./api-error";

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
  /** Request timeout in milliseconds. */
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

export function apiFetch<T>(
  config: RequestConfig,
  options?: ApiFetchOptions,
): Promise<ApiResponse<T>> {
  const timeout = options?.timeoutMs === undefined ? "default" : `${String(options.timeoutMs)} ms`;
  return Promise.reject(
    new ApiError({
      kind: "network",
      message: `apiFetch is not implemented yet (${config.method} ${config.url}, timeout ${timeout})`,
    }),
  );
}
