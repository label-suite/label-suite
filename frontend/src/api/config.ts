/**
 * Reads and validates the API settings once at start-up (system-design
 * §元件清單 readApiConfig). VITE_API_BASE_URL is bundled into the frontend,
 * so it is configuration, not a secret (Hard Rule 8).
 */

/** Request timeout of apiFetch: above the backend health check's 10 s ceiling (clarification Q4). */
export const DEFAULT_TIMEOUT_MS = 15_000;

/** The environment variables readApiConfig reads; `import.meta.env` satisfies it. */
export interface ApiEnv {
  /** Empty for same-origin relative URLs, or an absolute http(s) URL without a trailing slash. */
  readonly VITE_API_BASE_URL?: unknown;
  /** Other variables are ignored; the index signature lets `import.meta.env` match. */
  readonly [name: string]: unknown;
}

/** Validated API settings. */
export interface ApiConfigValue {
  /** Prefix for every request URL; empty means same-origin relative paths. */
  baseUrl: string;
  /** Request timeout in milliseconds unless a call overrides it. */
  defaultTimeoutMs: number;
}

const ABSOLUTE_HTTP_URL = /^https?:\/\/[^\s/]\S*$/;

/**
 * Returns the validated API settings, or throws an error naming
 * VITE_API_BASE_URL when the value is neither empty nor an absolute http(s)
 * URL without a trailing slash (Hard Rule 9).
 *
 * @param env The environment to read; defaults to `import.meta.env`.
 */
export function readApiConfig(env: ApiEnv = import.meta.env): ApiConfigValue {
  const raw = env.VITE_API_BASE_URL;
  if (raw === undefined || raw === "") {
    return { baseUrl: "", defaultTimeoutMs: DEFAULT_TIMEOUT_MS };
  }
  if (typeof raw !== "string" || !ABSOLUTE_HTTP_URL.test(raw) || raw.endsWith("/")) {
    throw new Error(
      "VITE_API_BASE_URL must be empty or an absolute http:// or https:// URL without a trailing slash.",
    );
  }
  return { baseUrl: raw, defaultTimeoutMs: DEFAULT_TIMEOUT_MS };
}
