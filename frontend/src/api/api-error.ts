/**
 * The single error type that apiFetch throws (api-contract §錯誤正規化契約).
 *
 * Minimal version for the N3 check; task 3.1 completes the fields and guards.
 */
export type ApiErrorKind = "http" | "network" | "timeout" | "invalidResponse" | "aborted";

export class ApiError extends Error {
  /** How the request failed. */
  readonly kind: ApiErrorKind;

  constructor(kind: ApiErrorKind, message: string) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
  }
}
