import { beforeEach, describe, expect, it, vi } from "vitest";

type I18nModule = typeof import("./index");

let mod: I18nModule;

beforeEach(async () => {
  // A fresh module per test, so each test starts from an uninitialised instance.
  vi.resetModules();
  mod = await import("./index");
});

describe("initI18n", () => {
  it("picks the interface language from the browser language", () => {
    mod.initI18n("zh-HK");
    expect(mod.getCurrentLanguage()).toBe("zh-TW");
  });

  it("falls back to English when the browser reports no language", () => {
    mod.initI18n(undefined);
    expect(mod.getCurrentLanguage()).toBe("en");
  });

  it("loads only the common namespace", () => {
    const i18n = mod.initI18n("zh-TW");

    expect(i18n.t("documentTitle", { ns: "common", page: "X" })).toBe("Label Suite — X");
    for (const language of ["zh-TW", "en"]) {
      expect(i18n.hasResourceBundle(language, "common")).toBe(true);
      expect(i18n.hasResourceBundle(language, "systemHealth")).toBe(false);
      expect(i18n.hasResourceBundle(language, "devGallery")).toBe(false);
    }
    expect(i18n.exists("probe", { ns: "systemHealth" })).toBe(false);
  });
});

describe("registerNamespace", () => {
  it("makes a namespace's keys available in both languages", async () => {
    const i18n = mod.initI18n("zh-TW");

    mod.registerNamespace("systemHealth", { "zh-TW": { probe: "中文" }, en: { probe: "English" } });

    expect(i18n.t("probe", { ns: "systemHealth" })).toBe("中文");
    await i18n.changeLanguage("en");
    expect(i18n.t("probe", { ns: "systemHealth" })).toBe("English");
    expect(mod.getCurrentLanguage()).toBe("en");
  });

  it("accepts the same namespace twice and keeps the latest text", () => {
    const i18n = mod.initI18n("en");
    const register = (text: string) => {
      mod.registerNamespace("systemHealth", { "zh-TW": { probe: text }, en: { probe: text } });
    };

    register("first");
    expect(() => {
      register("second");
    }).not.toThrow();
    expect(i18n.t("probe", { ns: "systemHealth" })).toBe("second");
  });
});
