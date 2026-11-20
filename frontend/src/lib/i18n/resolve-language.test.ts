import { describe, expect, it } from "vitest";

import { resolveLanguage } from "./resolve-language";

describe("resolveLanguage", () => {
  it.each([
    ["zh-TW", "zh-TW"],
    ["zh-CN", "zh-TW"],
    ["zh", "zh-TW"],
    ["ZH-hk", "zh-TW"],
    ["en-US", "en"],
    ["ja", "en"],
    ["", "en"],
    [undefined, "en"],
  ])("maps the browser language %j to %s", (browserLanguage, expected) => {
    expect(resolveLanguage(browserLanguage)).toBe(expected);
  });
});
