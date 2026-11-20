/**
 * N3 gate (design D4): the return type of apiFetch must flow through the
 * Orval-generated client unchanged, so every generated hook hands callers
 * `{ data, meta }` and fails with ApiError. If Orval annotated the generated
 * request function with its own return type, ApiResponse<T> would be lost.
 */
import { describe, expect, expectTypeOf, it } from "vitest";

import type { ApiError } from "./api-error";
import { getHealth, useGetHealth } from "./generated/label-suite";
import type { HealthData } from "./generated/label-suite.schemas";
import generatedClientSource from "./generated/label-suite.ts?raw";
import type { ResponseMeta } from "./mutator";

/**
 * Calling the hook from a wrapper lets TypeScript infer TData from the hook's
 * defaults. `ReturnType<typeof useGetHealth>` would substitute `unknown` for
 * the generic instead (clarification Q20). The wrapper is named like a hook so
 * the rules-of-hooks lint accepts the call; it is only inspected, never run.
 */
const useHealthQuery = () => useGetHealth();

describe("generated health client", () => {
  it("exposes the health payload together with the response meta", () => {
    expectTypeOf(useHealthQuery)
      .returns.toHaveProperty("data")
      .toEqualTypeOf<{ data: HealthData; meta: ResponseMeta } | undefined>();
  });

  it("reports failures as ApiError", () => {
    expectTypeOf(useHealthQuery).returns.toHaveProperty("error").toEqualTypeOf<ApiError | null>();
  });

  it("returns what apiFetch returns from the request function", () => {
    expectTypeOf(getHealth).returns.resolves.toEqualTypeOf<{
      data: HealthData;
      meta: ResponseMeta;
    }>();
  });

  it("leaves the request function without an Orval return type annotation", () => {
    const declaration = /export const getHealth = (?:async\s*)?\(([^)]*)\)\s*(:[^=]*)?=>/.exec(
      generatedClientSource,
    );

    expect(declaration, "getHealth declaration not found in the generated client").not.toBeNull();
    expect(declaration?.[2]).toBeUndefined();
  });
});
