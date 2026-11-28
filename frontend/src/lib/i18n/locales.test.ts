import { describe, expect, it, vi } from "vitest";

const NAMESPACES = ["appShell", "auth", "common", "dashboard", "devGallery", "systemHealth"];
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
    ["appShell", "role.systemAdmin", "系統管理員", "System Admin"],
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

  it("has phone labels with soft hyphens in English and the plain labels in zh-TW (Q13)", () => {
    const SHY = "\u00AD";
    const plain = [
      "dashboard",
      "taskManagement",
      "annotation",
      "review",
      "exceptionDisposition",
      "datasetAnalysis",
      "systemAdmin",
      "profile",
    ];
    for (const key of plain) {
      expect(text("zh-TW", "appShell", `navMobile.${key}`)).toBe(
        text("zh-TW", "appShell", `nav.${key}`),
      );
      const phone = text("en", "appShell", `navMobile.${key}`);
      expect(typeof phone === "string" ? phone.replaceAll(SHY, "") : phone).toBe(
        text("en", "appShell", `nav.${key}`),
      );
    }
    expect(text("en", "appShell", "navMobile.dashboard")).toBe(`Dash${SHY}board`);
    expect(text("en", "appShell", "navMobile.taskManagement")).toBe(`Task Man${SHY}age${SHY}ment`);
    expect(text("en", "appShell", "navMobile.annotation")).toBe(`Anno${SHY}ta${SHY}tion`);
    expect(text("en", "appShell", "navMobile.datasetAnalysis")).toBe(
      `Data${SHY}set Ana${SHY}lyt${SHY}ics`,
    );
    expect(text("en", "appShell", "navMobile.systemAdmin")).toBe(
      `Sys${SHY}tem Admin${SHY}is${SHY}tra${SHY}tion`,
    );
    expect(text("en", "appShell", "navMobile.profile")).toBe("Profile");
  });

  it("no longer keeps the shared components' text under auth (design D10)", () => {
    expect(text("zh-TW", "auth", "nav")).toBeUndefined();
    expect(text("en", "auth", "nav")).toBeUndefined();
    // Signing out moved to the sidebar: its text is appShell's `signOut`.
    expect(text("zh-TW", "auth", "dashboard.signOut")).toBeUndefined();
    expect(text("en", "auth", "dashboard.signOut")).toBeUndefined();
  });

  it("no longer keeps the gallery's own theme switch text (clarification Q5)", () => {
    expect(text("zh-TW", "devGallery", "theme")).toBeUndefined();
    expect(text("en", "devGallery", "theme")).toBeUndefined();
  });
});

describe("dashboard locale text (dashboard-shell ui-design §文案)", () => {
  /** Reads one dotted key from a dashboard locale file, or undefined when it is absent. */
  function text(language: string, key: string): unknown {
    let node: unknown = files[`./locales/${language}/dashboard.json`];
    for (const part of key.split(".")) {
      node = isRecord(node) ? node[part] : undefined;
    }
    return node;
  }

  const card = (id: string, field: string) => `entry.cards.${id}.${field}`;
  const step = (id: string, n: number, field: string) =>
    `entry.cards.${id}.steps.step${String(n)}.${field}`;

  it.each([
    ["pageName", "儀表板", "Dashboard"],
    ["title", "儀表板", "Dashboard"],
    [
      "subtitle",
      "掌握任務進度與團隊協作狀態",
      "Track task progress and team collaboration at a glance",
    ],
    ["loading", "載入中", "Loading"],
    ["error.title", "儀表板載入失敗", "Failed to load dashboard"],
    [
      "error.description",
      "無法載入任務成員資格資料，請稍後再試。",
      "Task membership data could not be loaded. Please try again.",
    ],
    ["error.retry", "重試", "Retry"],
    ["entry.title", "開始你的第一個工作流程", "Start Your First Workflow"],
    [
      "entry.subtitle",
      "從三個行動入口開始，快速達成第一個可交付成果",
      "Use these three action entry points to reach your first success quickly.",
    ],
    [card("leader", "title"), "建立標記專案", "Create Labeling Project"],
    [
      card("leader", "description"),
      "上傳資料、設定標籤規則、指派團隊成員。",
      "Upload data, set labeling rules, and assign team members.",
    ],
    [card("leader", "cta"), "開始建立任務", "Start Creating Task"],
    [step("leader", 1, "name"), "建立任務", "Create Task"],
    [
      step("leader", 1, "description"),
      "設定任務目標與標籤規則",
      "Define task objectives and label rules",
    ],
    [step("leader", 2, "name"), "上傳資料", "Upload Data"],
    [
      step("leader", 2, "description"),
      "上傳第一批資料，確認可被系統讀取",
      "Upload the first batch and verify parsing",
    ],
    [step("leader", 3, "name"), "指派人員", "Assign Team"],
    [
      step("leader", 3, "description"),
      "指派至少 1 位標記員與 1 位審核員",
      "Assign at least one annotator and one reviewer",
    ],
    [card("annotator", "title"), "進行資料標記", "Conduct Data Labeling"],
    [
      card("annotator", "description"),
      "查看待辦任務，完成資料標記並送出結果。",
      "View pending tasks, complete data labeling, and submit results.",
    ],
    [card("annotator", "cta"), "開始標記", "Start Annotating"],
    [step("annotator", 1, "name"), "開啟任務", "Open Task"],
    [
      step("annotator", 1, "description"),
      "進入標記工作區，查看待辦任務",
      "Enter the annotation workspace and view pending items",
    ],
    [step("annotator", 2, "name"), "進行標記", "Annotate"],
    [
      step("annotator", 2, "description"),
      "依照標籤規則，完成標記工作",
      "Follow label rules and complete annotation work",
    ],
    [step("annotator", 3, "name"), "送出標記", "Submit Annotation"],
    [
      step("annotator", 3, "description"),
      "自我檢查標記一致性，送出標記結果",
      "Self-check consistency, then submit results",
    ],
    [card("reviewer", "title"), "進行標記審核", "Conduct Labeling Review"],
    [
      card("reviewer", "description"),
      "逐標記員獨立審核，直接修正結果，歧異交付仲裁。",
      "Review each annotator independently, correct results directly, and arbitrate disputes.",
    ],
    [card("reviewer", "cta"), "開始審核", "Start Reviewing"],
    [step("reviewer", 1, "name"), "審核標記", "Review Annotations"],
    [
      step("reviewer", 1, "description"),
      "檢查標記內容，檢視標記與依據",
      "Inspect annotation content and compare against guidelines",
    ],
    [step("reviewer", 2, "name"), "修正或仲裁", "Correct or Arbitrate"],
    [
      step("reviewer", 2, "description"),
      "通過、修正或無法裁決；歧異交付仲裁與例外池",
      "Approve, modify, or cannot adjudicate; disputes go to arbitration and the exception pool",
    ],
    [step("reviewer", 3, "name"), "完成審核", "Complete Review"],
    [
      step("reviewer", 3, "description"),
      "確認審核列表，標記任務完成",
      "Confirm review list and mark task complete",
    ],
    ["stats.title", "平台使用者統計", "Platform Stats"],
    ["stats.subtitle", "系統概況", "System overview"],
    ["stats.totalUsers.label", "總用戶", "Total Users"],
    ["stats.totalUsers.value", "0 人", "0 Users"],
    ["stats.projectLeaders.label", "專案負責人", "Project Leaders"],
    ["stats.projectLeaders.value", "0 人", "0 Leaders"],
    ["stats.annotators.label", "標記員", "Annotators"],
    ["stats.annotators.value", "0 人", "0 Annotators"],
    ["stats.reviewers.label", "審核員", "Reviewers"],
    ["stats.reviewers.value", "0 人", "0 Reviewers"],
    [
      "stats.demoNote",
      "示範用靜態值：這些指標卡尚未接上實際資料，算法另案定義。",
      "Demo static values: these metric cards are not yet connected to real data; how they are calculated is defined separately.",
    ],
  ])("has the approved text for %s", (key, zhTW, en) => {
    expect(text("zh-TW", key)).toBe(zhTW);
    expect(text("en", key)).toBe(en);
  });

  it("uses 送出 for card B and never 提交 anywhere in the zh-TW file (clarification Q12)", () => {
    const raw = JSON.stringify(files["./locales/zh-TW/dashboard.json"]);
    expect(raw).not.toContain("提交");
    for (const key of [
      card("annotator", "description"),
      step("annotator", 3, "name"),
      step("annotator", 3, "description"),
    ]) {
      expect(text("zh-TW", key)).toContain("送出");
    }
  });
});

describe("dashboard namespace preload (frontend-i18n 儀表板的語言檔啟動時就在)", () => {
  it("answers the dashboard heading right after start-up, with no page opened", async () => {
    vi.resetModules();
    window.localStorage.clear();
    const mod = await import("./index");
    mod.initI18n();
    expect(mod.i18n.t("title", { ns: "dashboard" })).toBe("儀表板");
    await mod.changeInterfaceLanguage("en");
    expect(mod.i18n.t("title", { ns: "dashboard" })).toBe("Dashboard");
    window.localStorage.clear();
  });
});
