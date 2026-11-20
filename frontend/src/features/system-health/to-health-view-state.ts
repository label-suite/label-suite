/**
 * Maps the health query to one of the four screen states of /dev/health
 * (design D6, system-design §元件清單 toHealthViewState, clarification Q3 and
 * Q19 UI-7). Pure: no React, no formatting, no translation.
 */
import type { ApiError } from "@/api/api-error";
import type { HealthDataResponse } from "@/api/generated/label-suite.schemas";
import type { ApiResponse } from "@/api/mutator";

/** The parts of the useGetHealth result the mapping reads. */
export interface HealthQueryInput {
  /** True until the query has a first result. */
  isPending: boolean;
  /** True while any request for the query is in flight, background refetches included. */
  isFetching: boolean;
  /** The last successful result, kept by TanStack Query after later failures. */
  data: ApiResponse<HealthDataResponse> | undefined;
  /** The error of the latest attempt, or null when it succeeded. */
  error: ApiError | null;
}

/** The first load, or a check the user started with the recheck button. */
export interface HealthLoadingState {
  /** Discriminant. */
  kind: "loading";
}

/** The backend and its database are both available. */
export interface HealthOkState {
  /** Discriminant. */
  kind: "ok";
  /** `data.status` of the success envelope. */
  service: string;
  /** `data.database` of the success envelope. */
  database: string;
  /** The envelope's server timestamp, an ISO 8601 UTC instant (formatted by the panel). */
  checkedAt: string;
  /** The envelope's traceId. */
  traceId: string;
}

/** Which title the backend-error layout shows. */
export type BackendErrorTitleKey = "databaseUnavailable" | "backendError";

/** The backend answered with any error envelope. */
export interface HealthBackendErrorState {
  /** Discriminant. */
  kind: "backendError";
  /** `databaseUnavailable` for DATABASE_UNAVAILABLE, `backendError` for every other code. */
  titleKey: BackendErrorTitleKey;
  /** The envelope's code, shown verbatim. */
  code: string | null;
  /** The envelope's message, already localised by the backend and shown verbatim. */
  message: string;
  /** The envelope's traceId. */
  traceId: string | null;
}

/** The error types the unreachable layout shows, verbatim and untranslated. */
export type UnreachableErrorType = "network" | "timeout";

/** No envelope arrived: the connection failed, timed out, or the body was not an envelope. */
export interface HealthUnreachableState {
  /** Discriminant. */
  kind: "unreachable";
  /** `timeout` for a timeout; `network` for a failed connection or a non-envelope response. */
  errorType: UnreachableErrorType;
}

/** One of the four screen states of /dev/health. */
export type HealthViewState =
  HealthLoadingState | HealthOkState | HealthBackendErrorState | HealthUnreachableState;

const LOADING: HealthLoadingState = { kind: "loading" };

/** Maps an ApiError that is not `aborted` to its screen state. */
function fromError(error: ApiError): HealthViewState {
  switch (error.kind) {
    case "http":
      return {
        kind: "backendError",
        titleKey: error.code === "DATABASE_UNAVAILABLE" ? "databaseUnavailable" : "backendError",
        code: error.code,
        message: error.message,
        traceId: error.traceId,
      };
    case "timeout":
      return { kind: "unreachable", errorType: "timeout" };
    case "network":
    case "invalidResponse":
    case "aborted":
      return { kind: "unreachable", errorType: "network" };
  }
}

/**
 * Picks the screen state. The order is fixed: an aborted request yields null
 * (the panel keeps what it showed last, so a first load cancelled stays
 * loading); then loading, which only the first load or a user-started
 * refetch shows; then the latest error or success. A background refetch
 * keeps the previous result.
 *
 * @param query The health query's state.
 * @param userRefetching True from the user pressing recheck until that request ends.
 */
export function toHealthViewState(
  query: HealthQueryInput,
  userRefetching: boolean,
): HealthViewState | null {
  if (query.error?.kind === "aborted") {
    return null;
  }
  if (query.isPending || (userRefetching && query.isFetching)) {
    return LOADING;
  }
  if (query.error !== null) {
    return fromError(query.error);
  }
  if (query.data !== undefined) {
    return {
      kind: "ok",
      service: query.data.data.status,
      database: query.data.data.database,
      checkedAt: query.data.meta.timestamp,
      traceId: query.data.meta.traceId,
    };
  }
  return LOADING;
}

/**
 * The recheck button is disabled while any request is in flight, background
 * refetches included, so refetch() never cancels a request in progress.
 */
export function isRecheckDisabled(query: Pick<HealthQueryInput, "isFetching">): boolean {
  return query.isFetching;
}
