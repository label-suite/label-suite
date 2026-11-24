// Regression tests for scripts/gen-site-map-data.mjs. Run: node --test scripts/tests/*.test.mjs
//
// The data file is derived from the PRD §Site Map list and each spec's
// `## 規格` subsections, so every case below builds a small docs/specs tree
// and checks what the generator reads out of it, or what it refuses.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { DATA_PATH, buildSiteMap, features, prdPages, render } from "../gen-site-map-data.mjs";

const PRD = `---
title: 'PRD'
---

# PRD

## Site Map

- 未登入時
  - 登入，含 Google SSO 入口（所有人）：見 [規格 01-01](./01-account/01-login.mdx)
- 登入後，從側欄進入
  - 儀表板（平台成員）：見 [規格 02-01](./02-dashboard/01-dashboard.mdx)
- 不是獨立頁面
  - 登入狀態與安全（所有登入的使用者）：見 [規格 01-05](./01-account/05-login-state.mdx)

## 模組架構與串接

- 不算：見 [規格 09-09](./09-x/09-y.mdx)
`;

const LOGIN = `---
title: '登入'
---

# 登入

## 目標

### 資料欄位

## 規格

### 用 Email 登入

\`\`\`md
### 不是標題
\`\`\`

### 不同螢幕寬度的呈現

### 「無法判定」（Bypass）

### 資料欄位

## 卡控機制

### 用 Email 登入
`;

const STATE = `---
title: '登入狀態與安全'
---

## 規格

### 資料欄位
`;

const DASHBOARD = `---
title: '儀表板'
---

## 規格

### 頁首
`;

function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), "site-map-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

const BASE = {
  "00-prd.mdx": PRD,
  "01-account/index.mdx": "---\ntitle: '01 帳號'\n---\n",
  "01-account/01-login.mdx": LOGIN,
  "01-account/05-login-state.mdx": STATE,
  "02-dashboard/index.mdx": "---\ntitle: '02 儀表板'\n---\n",
  "02-dashboard/01-dashboard.mdx": DASHBOARD,
};
const EXCLUDED = ["資料欄位", "不同螢幕寬度的呈現"];

function withTree(files, fn) {
  const dir = tree(files);
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("features keep only ### under ## 規格, drop excluded ones and code blocks", () => {
  assert.deepEqual(features(LOGIN, EXCLUDED), [
    { title: "用 Email 登入", anchor: "用-email-登入" },
    { title: "「無法判定」（Bypass）", anchor: "無法判定bypass" },
  ]);
});

test("anchors count headings before ## 規格, as NoteCraft does", () => {
  // "資料欄位" under ## 目標 takes the bare anchor, so the one under ## 規格 is
  // "資料欄位-1"; the duplicate after ## 規格 does not shift earlier anchors.
  const [f] = features(LOGIN, []).filter((h) => h.title === "資料欄位");
  assert.equal(f.anchor, "資料欄位-1");
});

test("PRD §Site Map gives labels, spec numbers and standalone flags", () => {
  assert.deepEqual(prdPages(PRD), [
    { spec: "01-01", label: "登入", path: "01-account/01-login", standalone: true },
    { spec: "02-01", label: "儀表板", path: "02-dashboard/01-dashboard", standalone: true },
    {
      spec: "01-05",
      label: "登入狀態與安全",
      path: "01-account/05-login-state",
      standalone: false,
    },
  ]);
});

test("buildSiteMap orders pages by spec number and reads module labels", () => {
  withTree(BASE, (dir) => {
    const { modules, pages } = buildSiteMap(dir, EXCLUDED);
    assert.deepEqual(modules, [
      { id: "01", label: "帳號" },
      { id: "02", label: "儀表板" },
    ]);
    assert.deepEqual(
      pages.map((p) => [p.spec, p.features.length]),
      [
        ["01-01", 2],
        ["01-05", 0],
        ["02-01", 1],
      ],
    );
  });
});

test("a spec page missing from PRD §Site Map fails", () => {
  withTree({ ...BASE, "02-dashboard/02-extra.mdx": DASHBOARD }, (dir) => {
    assert.throws(() => buildSiteMap(dir, EXCLUDED), /02-dashboard\/02-extra\.mdx is not in PRD/);
  });
});

test("a PRD §Site Map entry with no spec file fails", () => {
  const files = { ...BASE };
  delete files["02-dashboard/01-dashboard.mdx"];
  withTree(files, (dir) => {
    assert.throws(() => buildSiteMap(dir, EXCLUDED), /lists 02-dashboard\/01-dashboard\.mdx/);
  });
});

test("an exclusion entry no spec uses any more fails", () => {
  withTree(BASE, (dir) => {
    assert.throws(
      () => buildSiteMap(dir, [...EXCLUDED, "網址與畫面狀態同步"]),
      /EXCLUDED_FEATURES lists 「網址與畫面狀態同步」/,
    );
  });
});

test("the committed data file matches the specs", () => {
  assert.equal(readFileSync(DATA_PATH, "utf8"), render(buildSiteMap()));
});
