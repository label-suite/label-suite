import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type I18nModule = typeof import("./index");

let mod: I18nModule;

beforeEach(async () => {
  // A fresh module per test, so each test starts from an uninitialised instance.
  vi.resetModules();
  window.localStorage.clear();
  document.documentElement.lang = "";
  mod = await import("./index");
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("initI18n", () => {
  it("shows Traditional Chinese to a first-time visitor whose browser is English", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");

    mod.initI18n();

    expect(mod.getCurrentLanguage()).toBe("zh-TW");
    expect(document.documentElement.lang).toBe("zh-TW");
  });

  it("uses the remembered language", () => {
    window.localStorage.setItem("labelsuite.lang", "en");

    mod.initI18n();

    expect(mod.getCurrentLanguage()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it.each(["ja", "", "EN-us"])("falls back to zh-TW when the remembered value is %j", (stored) => {
    window.localStorage.setItem("labelsuite.lang", stored);

    expect(() => mod.initI18n()).not.toThrow();
    expect(mod.getCurrentLanguage()).toBe("zh-TW");
  });

  it("falls back to zh-TW when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(() => mod.initI18n()).not.toThrow();
    expect(mod.getCurrentLanguage()).toBe("zh-TW");
  });

  it("loads common and auth, and no development page namespace", () => {
    const i18n = mod.initI18n();

    expect(i18n.t("documentTitle", { ns: "common", page: "X" })).toBe("Label Suite — X");
    for (const language of ["zh-TW", "en"]) {
      expect(i18n.hasResourceBundle(language, "common")).toBe(true);
      expect(i18n.hasResourceBundle(language, "auth")).toBe(true);
      expect(i18n.hasResourceBundle(language, "systemHealth")).toBe(false);
      expect(i18n.hasResourceBundle(language, "devGallery")).toBe(false);
    }
    expect(i18n.exists("probe", { ns: "systemHealth" })).toBe(false);
  });
});

describe("changeInterfaceLanguage", () => {
  it("switches the interface, the page language and the remembered choice", async () => {
    const i18n = mod.initI18n();

    await mod.changeInterfaceLanguage("en");

    expect(mod.getCurrentLanguage()).toBe("en");
    expect(i18n.t("login.error.invalidCredentials", { ns: "auth" })).toBe(
      "Invalid email or password",
    );
    expect(document.documentElement.lang).toBe("en");
    expect(window.localStorage.getItem("labelsuite.lang")).toBe("en");
  });

  it("is remembered for the next start", async () => {
    mod.initI18n();
    await mod.changeInterfaceLanguage("en");

    vi.resetModules();
    const reloaded = await import("./index");
    reloaded.initI18n();

    expect(reloaded.getCurrentLanguage()).toBe("en");
  });

  it("still switches the interface when storage cannot be written", async () => {
    mod.initI18n();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    await mod.changeInterfaceLanguage("en");

    expect(mod.getCurrentLanguage()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});

describe("registerNamespace", () => {
  it("makes a namespace's keys available in both languages", async () => {
    const i18n = mod.initI18n();

    mod.registerNamespace("systemHealth", { "zh-TW": { probe: "中文" }, en: { probe: "English" } });

    expect(i18n.t("probe", { ns: "systemHealth" })).toBe("中文");
    await i18n.changeLanguage("en");
    expect(i18n.t("probe", { ns: "systemHealth" })).toBe("English");
    expect(mod.getCurrentLanguage()).toBe("en");
  });

  it("accepts the same namespace twice and keeps the latest text", () => {
    const i18n = mod.initI18n();
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
