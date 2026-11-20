/**
 * TanStack Query defaults (design D6, clarification Q4): failed queries and
 * writes are never retried automatically; the user or the caller decides
 * whether to try again. Everything else keeps the library defaults. A feature
 * that needs retries sets `retry` in its own hook options and excludes
 * isAuthError.
 */
import { QueryClient } from "@tanstack/react-query";

/** Builds a QueryClient with retries switched off for queries and mutations. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}
