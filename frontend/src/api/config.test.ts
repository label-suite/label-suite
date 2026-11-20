import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_TIMEOUT_MS, readApiConfig } from "./config";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readApiConfig", () => {
  it("fails to start when the base URL lacks a scheme, without sending a request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(() => readApiConfig({ VITE_API_BASE_URL: "localhost:8000" })).toThrow(
      /VITE_API_BASE_URL/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails to start when the base URL ends with a slash", () => {
    expect(() => readApiConfig({ VITE_API_BASE_URL: "http://localhost:8000/" })).toThrow(
      /VITE_API_BASE_URL/,
    );
  });

  it.each(["ftp://localhost:8000", "http://", "https://", " http://localhost:8000", 8000])(
    "rejects %s",
    (value) => {
      expect(() => readApiConfig({ VITE_API_BASE_URL: value })).toThrow(/VITE_API_BASE_URL/);
    },
  );

  it.each([undefined, ""])("treats %j as same-origin relative paths", (value) => {
    expect(readApiConfig({ VITE_API_BASE_URL: value })).toEqual({
      baseUrl: "",
      defaultTimeoutMs: 15_000,
    });
  });

  it.each(["http://localhost:8000", "https://api.example.org", "https://example.org/prefix"])(
    "accepts the absolute URL %s",
    (value) => {
      expect(readApiConfig({ VITE_API_BASE_URL: value }).baseUrl).toBe(value);
    },
  );

  it("defaults the request timeout to 15 seconds", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(15_000);
  });

  it("reads import.meta.env when no environment is passed", () => {
    expect(readApiConfig().baseUrl).toBe("http://localhost:8000");
  });
});
