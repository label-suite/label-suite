import { describe, expect, it } from "vitest";

import { isErrorEnvelope, isSuccessEnvelope } from "@/api/envelope";
import { i18n } from "@/lib/i18n";

import {
  HEALTH_URL,
  TEST_API_BASE_URL,
  databaseUnavailableBody,
  healthDatabaseUnavailableHandler,
  healthOkBody,
  healthOkHandler,
} from "./envelope-fixtures";
import { server } from "./msw-server";

describe("envelope fixtures", () => {
  it("builds a normal body that passes the success envelope guard", () => {
    const body = healthOkBody();

    expect(isSuccessEnvelope(body)).toBe(true);
    expect(body.traceId).toBe("3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01");
    expect(body.timestamp).toBe("2026-11-20T08:15:30.123Z");
    expect(body.data).toEqual({ status: "ok", database: "ok" });
  });

  it("builds a 503 body that passes the error envelope guard with errors set to null", () => {
    const body = databaseUnavailableBody();

    expect(isErrorEnvelope(body)).toBe(true);
    expect(body.code).toBe("DATABASE_UNAVAILABLE");
    expect(body.errors).toBeNull();
    expect(body.traceId).toBe("9c1d7e2a-4b3f-4a8e-8d6c-0f5e2a1b3c47");
  });

  it("answers with the normal fixture instead of the generated fake data", async () => {
    server.use(healthOkHandler());

    const response = await fetch(HEALTH_URL, { headers: { "Accept-Language": "zh-TW" } });
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(healthOkBody());
    expect(response.headers.get("X-Correlation-ID")).toBe(healthOkBody().traceId);
    expect(response.headers.get("Content-Language")).toBe("zh-TW");
  });

  it("answers with the 503 fixture and its correlation header", async () => {
    server.use(healthDatabaseUnavailableHandler());

    const response = await fetch(HEALTH_URL, { headers: { "Accept-Language": "zh-TW" } });
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual(databaseUnavailableBody());
    expect(response.headers.get("X-Correlation-ID")).toBe(databaseUnavailableBody().traceId);
  });

  it("switches the message and Content-Language to English for an English request", async () => {
    server.use(healthDatabaseUnavailableHandler());

    const response = await fetch(HEALTH_URL, { headers: { "Accept-Language": "en" } });
    const body: unknown = await response.json();

    expect(body).toEqual(databaseUnavailableBody("en"));
    expect(response.headers.get("Content-Language")).toBe("en");
  });

  it("falls back to the generated handler when no fixture is added", async () => {
    const response = await fetch(HEALTH_URL);
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).not.toEqual(healthOkBody());
  });

  it("fails a request that no handler matches", async () => {
    // The cause proves MSW refused the request, rather than a real connection failing.
    await expect(fetch(`${TEST_API_BASE_URL}/api/v1/unknown`)).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining("onUnhandledFrame") as unknown,
      }) as unknown,
    });
  });

  it("starts every test in zh-TW", () => {
    expect(i18n.language).toBe("zh-TW");
  });
});
