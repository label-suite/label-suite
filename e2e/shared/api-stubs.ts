/**
 * Response shapes and route helpers for the journeys that need the backend to
 * answer in a way a healthy local run never does: a deployment with Google or
 * a mail service configured, a 5xx, a dropped connection, or a refresh
 * conflict (login-auth-guard acceptance). Everything else goes to the real
 * backend. The shapes follow api-contract.md: the six-field success envelope
 * and the seven-field error envelope.
 */
import type { Page, Request, Route } from "@playwright/test";

/** The success envelope around `data`. */
export function okEnvelope(data: unknown): string {
  return JSON.stringify({
    success: true,
    code: "OK",
    message: "成功",
    data,
    timestamp: new Date().toISOString(),
    traceId: "e2e-stub",
  });
}

/** The error envelope for `code`. */
export function errorEnvelope(code: string, message = "stub"): string {
  return JSON.stringify({
    success: false,
    code,
    message,
    data: null,
    timestamp: new Date().toISOString(),
    traceId: "e2e-stub",
    errors: null,
  });
}

/** Fulfils `route` with an error envelope. */
export async function fulfillError(route: Route, status: number, code: string): Promise<void> {
  await route.fulfill({ status, contentType: "application/json", body: errorEnvelope(code) });
}

/** Pretends the deployment has (or lacks) a mail service and Google sign-in. */
export async function stubAuthOptions(
  page: Page,
  options: { selfRegistrationEnabled: boolean; googleEnabled: boolean },
): Promise<void> {
  await page.route("**/api/v1/auth-options", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: okEnvelope(options),
    });
  });
}

/** A promise with its resolver, to hold a request until the test lets it go. */
export interface Gate {
  /** Resolves when the test opens the gate. */
  opened: Promise<void>;
  /** Opens the gate. */
  open: () => void;
}

/** Creates a closed gate. */
export function gate(): Gate {
  let open = (): void => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

/** One API request the page sent, as the journeys compare it. */
export interface SeenRequest {
  /** HTTP method. */
  method: string;
  /** Path below the API origin, without the query. */
  path: string;
  /** Request headers, lower-case names. */
  headers: Record<string, string>;
}

/**
 * Records every request the page sends to `/api/v1/`, with its headers.
 *
 * @returns The live list; read it after the step under test.
 */
export function recordApiRequests(page: Page): SeenRequest[] {
  const seen: SeenRequest[] = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v1/")) {
      seen.push({ method: request.method(), path: url.pathname, headers: request.headers() });
    }
  });
  return seen;
}

/** Counts recorded requests with `method` and `path`. */
export function countOf(seen: SeenRequest[], method: string, path: string): number {
  return seen.filter((request) => request.method === method && request.path === path).length;
}
