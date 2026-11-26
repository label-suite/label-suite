import { afterEach, describe, expect, it, vi } from "vitest";

import { getHealth } from "./generated/label-suite";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/**
 * The container image is built with an empty VITE_API_BASE_URL so the browser
 * calls the same origin and nginx proxies /api/v1 (design R6). This pins the
 * URL the health check really requests in that setup.
 */
describe("health check URL with an empty VITE_API_BASE_URL", () => {
  it("requests the same-origin /api/v1/health", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const body = {
      success: true,
      code: "OK",
      message: "成功",
      data: { status: "ok", database: "ok" },
      timestamp: "2026-11-20T08:15:30.123Z",
      traceId: "trace-1",
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

    await getHealth();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/v1/health");
  });
});
