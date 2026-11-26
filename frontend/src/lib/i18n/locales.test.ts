import { describe, expect, it } from "vitest";

const NAMESPACES = ["auth", "common", "devGallery", "systemHealth"];
const LANGUAGES = ["en", "zh-TW"];

/** Every locale file, read straight from disk (not through i18next). */
const files = import.meta.glob<unknown>("./locales/*/*.json", { eager: true, import: "default" });

/** Returns the dotted path of every leaf key in a locale tree. */
function collectKeys(tree: unknown, prefix = ""): string[] {
  if (typeof tree !== "object" || tree === null || Array.isArray(tree)) {
    return [prefix];
  }
  return Object.entries(tree).flatMap(([key, value]) =>
    collectKeys(value, prefix === "" ? key : `${prefix}.${key}`),
  );
}

/** Throws an error naming every key that one language has and the other lacks. */
function assertSameKeys(namespace: string, byLanguage: Record<string, unknown>): void {
  const keySets = Object.entries(byLanguage).map(
    ([language, tree]) => [language, new Set(collectKeys(tree).filter(Boolean))] as const,
  );
  const problems = keySets.flatMap(([language, keys]) =>
    keySets
      .filter(([other]) => other !== language)
      .flatMap(([other, otherKeys]) =>
        [...otherKeys]
          .filter((key) => !keys.has(key))
          .map((key) => `${language}/${namespace} is missing "${key}" (present in ${other})`),
      ),
  );
  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }
}

/** Groups the globbed files as namespace -> language -> tree. */
function groupByNamespace(): Map<string, Record<string, unknown>> {
  const grouped = new Map<string, Record<string, unknown>>();
  for (const [path, tree] of Object.entries(files)) {
    const match = /^\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
    if (match?.[1] === undefined || match[2] === undefined) {
      throw new Error(`Unexpected locale file path: ${path}`);
    }
    const [, language, namespace] = match;
    grouped.set(namespace, { ...grouped.get(namespace), [language]: tree });
  }
  return grouped;
}

describe("locale files", () => {
  it("has every namespace in both languages", () => {
    const grouped = groupByNamespace();
    expect([...grouped.keys()].sort()).toEqual(NAMESPACES);
    for (const byLanguage of grouped.values()) {
      expect(Object.keys(byLanguage).sort()).toEqual(LANGUAGES);
    }
  });

  it.each(NAMESPACES)("has the same keys in zh-TW and en for %s", (namespace) => {
    const byLanguage = groupByNamespace().get(namespace) ?? {};
    expect(() => {
      assertSameKeys(namespace, byLanguage);
    }).not.toThrow();
  });

  it("fails and names the missing key when en/auth lacks a key zh-TW has", () => {
    const zhTW = files["./locales/zh-TW/auth.json"];
    const byLanguage = { "zh-TW": zhTW, en: { login: { error: {} } } };
    expect(() => {
      assertSameKeys("auth", byLanguage);
    }).toThrow('en/auth is missing "login.error.invalidCredentials" (present in zh-TW)');
  });

  it("fails and names the missing key when one language lacks a key", () => {
    const byLanguage = {
      "zh-TW": { title: "x", status: { ok: "x", down: "x" } },
      en: { title: "x", status: { ok: "x" } },
    };
    expect(() => {
      assertSameKeys("systemHealth", byLanguage);
    }).toThrow('en/systemHealth is missing "status.down" (present in zh-TW)');
  });
});

/** Narrows a parsed JSON value to an object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("auth locale text", () => {
  /** Reads one dotted key from a locale file, or undefined when it is absent. */
  function text(language: string, key: string): unknown {
    let node: unknown = files[`./locales/${language}/auth.json`];
    for (const part of key.split(".")) {
      node = isRecord(node) ? node[part] : undefined;
    }
    return node;
  }

  it.each([
    ["login.error.invalidCredentials", "帳號或密碼錯誤，請再試一次", "Invalid email or password"],
    [
      "login.error.googleRejected",
      "無法用這個 Google 帳號登入。需要帳號的話，請聯絡系統管理員邀請你。",
      "You can't sign in with this Google account. If you need an account, ask an administrator to invite you.",
    ],
    [
      "login.error.sessionExpired",
      "登入已過期，請重新登入",
      "Session expired, please sign in again",
    ],
    ["login.error.sessionInvalid", "驗證失敗，請重新登入", "Authentication failed, please sign in"],
    [
      "login.error.unavailable",
      "平台暫時沒有回應，請稍後再試。",
      "The platform is not responding. Please try again later.",
    ],
    ["dashboard.title", "你已登入", "You're signed in"],
    [
      "dashboard.description",
      "儀表板還在建置中，完成後登入會直接帶你過去。",
      "The dashboard is still being built. Once it's ready, signing in will take you straight there.",
    ],
    ["dashboard.signOut", "登出", "Sign out"],
    ["dashboard.pageName", "你已登入", "Signed In"],
    ["dashboard.role.user", "平台成員", "Platform Member"],
    ["dashboard.role.super_admin", "系統管理員", "System Admin"],
  ])("has the approved text for %s (design D7, D12)", (key, zhTW, en) => {
    expect(text("zh-TW", key)).toBe(zhTW);
    expect(text("en", key)).toBe(en);
  });
});
