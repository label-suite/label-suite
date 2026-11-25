/**
 * One journey, run only with E2E_TARGET=compose against a public entry point
 * served by nginx: the Content-Security-Policy does not block the frontend's
 * own resources (spec security-headers 「CSP 不擋前端自己的資源」; spec
 * e2e-testing 「公開入口不擋前端自己的資源旅程」; #568 clarification Q5,
 * system-design D5).
 *
 * The page shell must carry a CSP, otherwise this journey would pass on a
 * target without one. The policy's value is not compared here: the expected
 * value lives only in scripts/check-security-headers.sh (system-design D4).
 * Nothing depends on page copy or test-only attributes, and no role signs in.
 */
import { expect, test } from "../shared/fixtures/index.ts";

/** One `securitypolicyviolation` event, as the page reported it. */
interface CspViolation {
  /** The directive that blocked the load, e.g. `script-src-elem`. */
  directive: string;
  /** What was blocked: a URL, or `inline` / `eval`. */
  blockedUri: string;
}

/** One same-origin response the page received. */
interface SeenResponse {
  /** The request path, without the origin. */
  path: string;
  /** The HTTP status code. */
  status: number;
}

declare global {
  interface Window {
    /** Filled by the init script below before any page script runs. */
    cspViolations?: CspViolation[];
  }
}

/** Where the page itself calls the backend, relative to baseURL. */
const HEALTH_PATH = "/api/v1/health";

/**
 * Reads `data.status` from a health response body.
 *
 * @param body The parsed JSON body, not yet trusted.
 * @returns The status string, or undefined when the body has another shape.
 */
function readDataStatus(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || !("data" in body)) {
    return undefined;
  }
  const { data } = body;
  if (typeof data !== "object" || data === null || !("status" in data)) {
    return undefined;
  }
  return typeof data.status === "string" ? data.status : undefined;
}

test("the page shell and its built assets load under the CSP", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "").origin;
  const responses: SeenResponse[] = [];
  const failedRequests: string[] = [];

  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.cspViolations?.push({
        directive: event.violatedDirective,
        blockedUri: event.blockedURI,
      });
    });
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "unknown error"}`,
    );
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === origin) {
      responses.push({ path: url.pathname, status: response.status() });
    }
  });

  const shell = await page.goto("/", { waitUntil: "load" });
  if (shell === null) {
    throw new Error("Opening / returned no response for the page shell.");
  }
  expect(
    shell.headers(),
    "The page shell is missing Content-Security-Policy, so this check would prove nothing.",
  ).toHaveProperty("content-security-policy");

  const api = await page.evaluate(async (path) => {
    const response = await fetch(path);
    const body: unknown = await response.json();
    return { status: response.status, body };
  }, HEALTH_PATH);
  const violations = await page.evaluate(() => window.cspViolations ?? []);

  expect(shell.status(), "The page shell's status").toBe(200);
  const assets = responses.filter((response) => response.path.startsWith("/assets/"));
  expect(assets.length, "The page shell loaded at least one /assets/ file").toBeGreaterThan(0);
  expect(
    assets.filter((asset) => asset.status !== 200),
    "Every /assets/ response is 200",
  ).toEqual([]);
  expect(
    violations,
    `CSP violations while loading: ${violations
      .map((violation) => `${violation.directive} blocked ${violation.blockedUri}`)
      .join("; ")}`,
  ).toEqual([]);
  expect(failedRequests, `Failed requests: ${failedRequests.join("; ")}`).toEqual([]);
  expect(api.status, `The same-origin call to ${HEALTH_PATH}`).toBe(200);
  expect(readDataStatus(api.body), `data.status of ${HEALTH_PATH}`).toBe("ok");
});
