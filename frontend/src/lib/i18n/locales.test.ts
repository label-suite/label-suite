import { describe, expect, it } from "vitest";

const NAMESPACES = ["appShell", "auth", "common", "devGallery", "systemHealth"];
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

describe("appShell and common locale text", () => {
  /** Reads one dotted key from a namespace's locale file, or undefined when it is absent. */
  function text(language: string, namespace: string, key: string): unknown {
    let node: unknown = files[`./locales/${language}/${namespace}.json`];
    for (const part of key.split(".")) {
      node = isRecord(node) ? node[part] : undefined;
    }
    return node;
  }

  it.each([
    ["appShell", "nav.dashboard", "儀表板", "Dashboard"],
    ["appShell", "nav.taskManagement", "任務管理", "Task Management"],
    ["appShell", "nav.annotation", "標記作業", "Annotation"],
    ["appShell", "nav.review", "審核作業", "Review"],
    ["appShell", "nav.exceptionDisposition", "例外處置", "Exception Disposition"],
    ["appShell", "nav.datasetAnalysis", "資料集分析", "Dataset Analytics"],
    ["appShell", "nav.systemAdmin", "系統管理", "System Administration"],
    ["appShell", "nav.profile", "個人設定", "Profile"],
    ["appShell", "adminNav.userManagement", "使用者管理", "User Management"],
    ["appShell", "adminNav.roleSettings", "角色設定", "Role Settings"],
    ["appShell", "role.annotator", "標記員", "Annotator"],
    ["appShell", "role.reviewer", "審核員", "Reviewer"],
    ["appShell", "role.projectLeader", "專案負責人", "Project leader"],
    ["appShell", "role.generalUser", "一般使用者", "General user"],
    ["appShell", "shortcuts.open", "快捷鍵", "Keyboard shortcuts"],
    ["appShell", "shortcuts.title", "目前頁面可用快捷鍵", "Available shortcuts for this page"],
    ["appShell", "shortcuts.close", "關閉快捷鍵", "Close keyboard shortcuts"],
    ["appShell", "shortcuts.groups.global", "全域", "Global"],
    ["appShell", "shortcuts.actions.openOverview", "開啟快捷鍵總覽", "Open shortcut overview"],
    [
      "appShell",
      "shortcuts.actions.closeDialog",
      "關閉視窗或取消選取",
      "Close dialog or clear selection",
    ],
    [
      "appShell",
      "blocked.annotation",
      "你目前在任何任務都沒有標記或審核角色，所以還不能進入標記作業。",
      "You don't have an annotation or review role in any task yet, so you can't open Annotation.",
    ],
    [
      "appShell",
      "blocked.datasetAnalysis",
      "資料集分析需要你在這個任務擔任專案負責人或審核員。",
      "Dataset Analytics requires you to be the project leader or a reviewer on this task.",
    ],
    ["appShell", "collapse.collapse", "收合側欄", "Collapse sidebar"],
    ["appShell", "collapse.expand", "展開側欄", "Expand sidebar"],
    ["appShell", "landmarks.mainNav", "主導覽", "Main navigation"],
    ["appShell", "landmarks.tools", "全域工具", "Global tools"],
    ["appShell", "landmarks.profileLink", "前往個人設定", "Go to Profile"],
    ["appShell", "signOut", "登出", "Sign out"],
    ["common", "brandHome", "Label Suite 首頁", "Label Suite home"],
    ["common", "languageToggle", "{{code}}，切換語言", "{{code}}, Switch language"],
    ["common", "theme.switchToDark", "切換為深色模式", "Switch to dark mode"],
    ["common", "theme.switchToLight", "切換為淺色模式", "Switch to light mode"],
  ])(
    "has the approved text for %s %s (sidebar-nav ui-design §文案)",
    (namespace, key, zhTW, en) => {
      expect(text("zh-TW", namespace, key)).toBe(zhTW);
      expect(text("en", namespace, key)).toBe(en);
    },
  );

  it("no longer keeps the shared components' text under auth (design D10)", () => {
    expect(text("zh-TW", "auth", "nav")).toBeUndefined();
    expect(text("en", "auth", "nav")).toBeUndefined();
  });

  it("no longer keeps the gallery's own theme switch text (clarification Q5)", () => {
    expect(text("zh-TW", "devGallery", "theme")).toBeUndefined();
    expect(text("en", "devGallery", "theme")).toBeUndefined();
  });
});
