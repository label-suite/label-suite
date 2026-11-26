import { describe, expect, it } from "vitest";

import { resolveLanguage } from "./resolve-language";

describe("resolveLanguage", () => {
  it.each([
    ["zh-TW", "zh-TW"],
    ["en", "en"],
  ])("keeps the supported value %j", (stored, expected) => {
    expect(resolveLanguage(stored)).toBe(expected);
  });

  it.each([["ja"], [""], ["EN-us"], ["en-US"], ["zh-CN"], ["zh"], [null], [undefined]])(
    "falls back to zh-TW for %j",
    (stored) => {
      expect(resolveLanguage(stored)).toBe("zh-TW");
    },
  );
});
