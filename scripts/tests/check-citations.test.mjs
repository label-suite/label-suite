// Regression tests for scripts/check-citations.mjs. Run: node --test scripts/tests/*.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  checkCitations,
  checkSpecRefs,
  citationsIn,
  failed,
  historicalLines,
} from "../check-citations.mjs";

// A throwaway repo: one prototype page and one design doc citing it, plus
// any extra files a test needs ({ path: text }).
function repo(doc, extra = {}, docPath = "design/system/pages/a.md") {
  const root = mkdtempSync(join(tmpdir(), "citations-"));
  const put = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  put(
    "design/prototype/pages/a.html",
    [
      "<html>",
      '  <button class="btn-primary">Go</button>',
      '  <div class="toast"></div>',
      "</html>",
      "",
    ].join("\n"),
  );
  for (const [rel, text] of Object.entries(extra)) put(rel, text);
  put(docPath, doc);
  return checkCitations({ root, docs: [docPath] });
}

test("a citation whose line names the sentence verifies", () => {
  const r = repo("`.btn-primary`（`pages/a.html:2`）\n");
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.stats.verified, 1);
});

test("a line past the end of the file is an error", () => {
  const r = repo("`.btn-primary`（`pages/a.html:9`）\n");
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /outside design\/prototype\/pages\/a\.html \(4 lines\)/);
});

test("a missing file is an error", () => {
  const r = repo("`.btn-primary`（`pages/missing.html:2`）\n");
  assert.match(r.errors[0], /file not found: pages\/missing\.html/);
});

test("a bare :N with no file before it in its paragraph is an error", () => {
  const r = repo("`pages/a.html:2`\n\n`.toast`（`:3`）\n");
  assert.match(r.errors[0], /has no file before it/);
});

test("a bare :N reads against the file before it in the same unit", () => {
  const r = repo("`.btn-primary` 在 `pages/a.html:2`，`.toast` 在 `:3`。\n");
  assert.deepEqual(r.errors, []);
  assert.equal(r.stats.citations, 2);
});

test("a line that names nothing in its sentence only warns", () => {
  const r = repo("`.toast`（`pages/a.html:2`）\n");
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
});

test("a range joins `a.html:2`–`:3` into one citation", () => {
  const [c] = citationsIn("`pages/a.html:2`–`:3`");
  assert.equal(c.from, 2);
  assert.equal(c.to, 3);
});

test("times, ratios and pseudo-classes are not citations", () => {
  assert.deepEqual(citationsIn("16:24、4.5:1、a:hover"), []);
});

test("a section pinned to a commit is historical and skipped", () => {
  const doc = [
    "### 盤點",
    "",
    "行號仍是 `eb9a884` 的位置。",
    "",
    "`.toast`（`pages/a.html:99`）",
    "",
  ].join("\n");
  assert.ok(historicalLines(doc).has(5));
  const r = repo(doc);
  assert.deepEqual(r.errors, []);
  assert.equal(r.stats.historical, 1);
});

test("a Chinese label in 「」 is a token, and a wrong line for it warns", () => {
  const extra = {
    "design/prototype/pages/b.html": ["label: '移除頭像',", "other: '取消',", ""].join("\n"),
  };
  assert.equal(repo("移除鈕寫「移除頭像」（`pages/b.html:1`）\n", extra).stats.verified, 1);
  assert.equal(repo("移除鈕寫「移除頭像」（`pages/b.html:2`）\n", extra).warnings.length, 1);
});

test("『』 inside a quote matches 「」 in the cited line", () => {
  const extra = { "design/prototype/pages/b.html": "text: '回到「密碼設定」重新設定',\n" };
  assert.equal(
    repo("例：「回到『密碼設定』重新設定」（`pages/b.html:1`）\n", extra).stats.verified,
    1,
  );
});

test("a percentage in the sentence is a token", () => {
  const extra = {
    "design/prototype/pages/b.css": [
      "a { background: color-mix(in srgb, red 12%, white); }",
      "b { color: red; }",
      "",
    ].join("\n"),
  };
  assert.equal(repo("混色比例 12%（`pages/b.css:1`）\n", extra).stats.verified, 1);
  assert.equal(repo("混色比例 12%（`pages/b.css:2`）\n", extra).warnings.length, 1);
});

test("a kebab-case script name finds its camel-case export", () => {
  const extra = {
    "design/prototype/pages/modal-focus.js": [
      "// helper",
      "window.LabelSuiteModalFocus = {};",
      "",
    ].join("\n"),
  };
  assert.equal(
    repo("焦點由 `modal-focus.js` 處理（`pages/modal-focus.js:2`）\n", extra).stats.verified,
    1,
  );
  assert.equal(
    repo("焦點由 `modal-focus.js` 處理（`pages/modal-focus.js:1`）\n", extra).warnings.length,
    1,
  );
});

test("`<style>` is met by a line inside that element only", () => {
  const extra = {
    "design/prototype/pages/b.html": [
      "<style>",
      "  .x { color: red; }",
      "</style>",
      "<p>x</p>",
      "",
    ].join("\n"),
  };
  assert.equal(repo("本頁 `<style>` 重寫（`pages/b.html:2`）\n", extra).stats.verified, 1);
  assert.equal(repo("本頁 `<style>` 重寫（`pages/b.html:4`）\n", extra).warnings.length, 1);
});

test("`<span>` is met by the CSS selector that styles it", () => {
  const extra = {
    "design/prototype/pages/b.css": [".metric span {", "  color: red;", "}", ""].join("\n"),
  };
  assert.equal(repo("標籤用 `<span>`（`pages/b.css:1`）\n", extra).stats.verified, 1);
  assert.equal(repo("標籤用 `<span>`（`pages/b.css:2`）\n", extra).warnings.length, 1);
});

test("`<svg>` is met by an opening tag with attributes, not by a longer tag name", () => {
  const extra = {
    "design/prototype/pages/b.html": ['<svg viewBox="0 0 24 24">', "<svgx>", ""].join("\n"),
  };
  assert.equal(repo("內嵌 `<svg>`（`pages/b.html:1`）\n", extra).stats.verified, 1);
  assert.equal(repo("內嵌 `<svg>`（`pages/b.html:2`）\n", extra).warnings.length, 1);
});

test("a design token is met by its light-theme value from tokens.css", () => {
  const extra = {
    "design/prototype/assets/tokens.css": [
      ":root {",
      "  --color-ink: #1E1B4B;",
      "}",
      'html[data-theme="dark"] { --color-ink: #E2E8F0; }',
      "",
    ].join("\n"),
    "design/prototype/assets/logo.svg": [
      "<svg>",
      '<text fill="#1E1B4B">L</text>',
      '<text fill="#E2E8F0">L</text>',
      "</svg>",
      "",
    ].join("\n"),
  };
  assert.equal(repo("字標用 `--color-ink`（`assets/logo.svg:2`）\n", extra).stats.verified, 1);
  assert.equal(repo("字標用 `--color-ink`（`assets/logo.svg:3`）\n", extra).warnings.length, 1);
});

test("a usage row in a component doc is met by the component slug", () => {
  const extra = {
    "design/prototype/pages/b.html": ['<span class="badge">x</span>', "<p>y</p>", ""].join("\n"),
  };
  const row = (n) =>
    `| \`task-management/task-list#state-default\` | 樣本（\`pages/b.html:${n}\`） |\n`;
  assert.equal(repo(row(1), extra, "design/system/components/badge.md").stats.verified, 1);
  assert.equal(repo(row(2), extra, "design/system/components/badge.md").warnings.length, 1);
  // Outside a component doc the slug means nothing.
  assert.equal(repo(row(1), extra, "design/system/pages/x.md").warnings.length, 1);
  // A usage entry written as a paragraph reads the same way.
  const para = (n) => `\`components-showcase#state-default\` → 樣本在 \`pages/b.html:${n}\`。\n`;
  assert.equal(repo(para(1), extra, "design/system/components/badge.md").stats.verified, 1);
  assert.equal(repo(para(2), extra, "design/system/components/badge.md").warnings.length, 1);
});

test("--strict fails on an unverified citation, the default does not", () => {
  const r = repo("`.btn-primary`（`pages/a.html:3`）\n");
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
  assert.equal(failed(r), false);
  assert.equal(failed(r, { strict: true }), true);
});

// ------------------------------------------- spec references in §Logic Flow

const PAGE_A = [
  "# 01-01 A",
  "",
  "## 業務流程",
  "",
  "- **送出表單**",
  "  - 觸發：使用者點「送出」",
  "  - 主流程：",
  "    1. 使用者點「送出」",
  "    2. 系統檢查兩欄",
  "  - 例外流程：",
  "    - E1（第 2 步）欄位沒填 → 停在這一頁",
  "",
  "## 規格",
  "",
  "### 導向其他頁面",
  "",
  "1. 點「前往註冊」→ 註冊頁",
  "2. 點「忘記密碼？」→ **申請頁**",
  "",
  "### 存取與入口：誰進得來",
  "",
  "- **存取**",
  "  1. 未登入的訪客 → 登入頁",
  "  2. 平台成員 → 儀表板",
  "",
  "## 卡控機制",
  "",
  "| 條件 | 結果 |",
  "| :--- | :--- |",
  "| 沒填 | 擋下 |",
  "| 格式錯 | 顯示錯誤 |",
  "",
  "## 邊界情況（Edge Case）",
  "",
  "- 連點兩次 → 只送一次",
  "",
  "## 已確認決議",
  "",
  "### Q3. 要不要記住語言？（已定案）",
  "",
].join("\n");

const PAGE_B = [
  "# 01-02 B",
  "",
  "## 業務流程",
  "",
  "### 開清單",
  "",
  "- 觸發：使用者從側欄點進來",
  "- 主流程：",
  "  1. 使用者點進來",
  "  2. 系統解析網址",
  "  3. 顯示清單",
  "- 替代流程：",
  "  - A1（第 2 步）他是審核員 → 換一個版面",
  "",
  "### 挑一筆",
  "",
  "1. 使用者篩選",
  "2. 沒有符合的 → 顯示空結果（替代流程 **A1**）",
  "3. 點某一列",
  "",
].join("\n");

// A throwaway repo with two spec pages and a module index whose §Logic Flow
// holds `lines`; `component` adds a Logic Flow component with those edge texts.
function specRepo(lines, { component = null, pageA = PAGE_A } = {}) {
  const root = mkdtempSync(join(tmpdir(), "spec-refs-"));
  const put = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  put("docs/specs/01-mod/01-a.mdx", pageA);
  put("docs/specs/01-mod/02-b.mdx", PAGE_B);
  put(
    "docs/specs/01-mod/index.mdx",
    ["# 01 模組", "", "## Logic Flow", "", ...lines, ""].join("\n"),
  );
  const components = [];
  if (component) {
    const texts = component.map((t) => `      { id: "e", text: ${JSON.stringify(t)} },`);
    put(".notecraft/components/spec-01-mod-logic-flow.tsx", [...texts, ""].join("\n"));
    components.push(".notecraft/components/spec-01-mod-logic-flow.tsx");
  }
  return checkSpecRefs({ root, components, allow: [] });
}

test("a spec page that does not exist is an error", () => {
  const r = specRepo(["1. P1 → P2（01-09 §導向其他頁面 第 1 條）"]);
  assert.match(r.errors[0], /no spec page 01-09/);
});

test("§節名 must be a heading of the cited page", () => {
  assert.deepEqual(specRepo(["1. P1 → P2（01-01 §導向其他頁面 第 1 條）"]).errors, []);
  const r = specRepo(["1. P1 → P2（01-01 §規格一覽 第 1 條）"]);
  assert.match(r.errors[0], /01-01 has no heading §規格一覽/);
});

test("a heading is also matched without its trailing （…） or after its ：", () => {
  const r = specRepo([
    "1. A（01-01 §邊界情況「連點兩次 → 只送一次」）",
    "2. B（01-01 §存取與入口 的「存取」第 2 條）",
  ]);
  assert.deepEqual(r.errors, []);
});

test("第 N 條 must be an item of the section, ranges included", () => {
  assert.deepEqual(specRepo(["1. A（01-01 §導向其他頁面 第 1～2 條）"]).errors, []);
  const r = specRepo(["1. A（01-01 §導向其他頁面 第 1、3 條）"]);
  assert.match(r.errors[0], /§導向其他頁面 has no 第 3 條 \(numbered items 2: 1～2\)/);
});

test("a bare number right after §節名 is a clause number", () => {
  assert.deepEqual(specRepo(["1. A（01-01 §導向其他頁面 2、Q3）"]).errors, []);
  assert.match(specRepo(["1. A（01-01 §導向其他頁面 4）"]).errors[0], /has no 第 4 條/);
});

test("第 N 條 counts top-level bullets, and 第 N 列 table rows, when there is no numbered list", () => {
  assert.deepEqual(specRepo(["1. A（01-01 §卡控機制 第 2 列）"]).errors, []);
  assert.match(
    specRepo(["1. A（01-01 §卡控機制 第 3 列）"]).errors[0],
    /has no 第 3 列 \(table rows/,
  );
  assert.deepEqual(specRepo(["1. A（01-01 §邊界情況 第 1 條）"]).errors, []);
  assert.match(specRepo(["1. A（01-01 §邊界情況 第 2 條）"]).errors[0], /has no 第 2 條 \(bullets/);
});

test("a quote naming a `- **group**` narrows the section to it", () => {
  assert.deepEqual(specRepo(["1. A（01-01 §規格「存取」第 2 條）"]).errors, []);
  assert.match(specRepo(["1. A（01-01 §規格「存取」第 3 條）"]).errors[0], /has no 第 3 條/);
});

test("主流程第 N 步, EN and AN must exist in the named flow", () => {
  const ok = specRepo([
    "1. A（01-01 §業務流程「送出表單」觸發、主流程第 1～2 步、E1）",
    "2. B（01-02 §開清單 主流程第 3 步、A1；01-02「挑一筆」主流程 2、A1）",
  ]);
  assert.deepEqual(ok.errors, []);
  const bad = specRepo(["1. A（01-01 業務流程「送出表單」主流程第 3 步、E2）"]);
  assert.match(bad.errors[0], /「送出表單」主流程 has no 第 3 步 \(steps 2: 1～2\)/);
  assert.match(bad.errors[1], /「送出表單」 has no E2 \(it has E1\)/);
});

test("QN must be a decision heading of the page", () => {
  assert.deepEqual(specRepo(["1. A（01-01 §已確認決議 Q3）"]).errors, []);
  assert.match(specRepo(["1. A（01-01 §已確認決議 Q4）"]).errors[0], /01-01 has no §已確認決議 Q4/);
});

test("a quote must be verbatim in its section, ignoring emphasis and spacing", () => {
  assert.deepEqual(specRepo(["1. A（01-01 §導向其他頁面「忘記密碼？」→ 申請頁」）"]).errors, []);
  const r = specRepo(["1. A（01-01 §導向其他頁面「忘了密碼」）"]);
  assert.match(r.errors[0], /「忘了密碼」 is not in 01-01 §導向其他頁面/);
});

test("a quote next to a clause number must be in that clause", () => {
  assert.deepEqual(specRepo(["1. A（01-01 §導向其他頁面 第 2 條的「忘記密碼？」）"]).errors, []);
  assert.deepEqual(specRepo(["- 依 01-01 §導向其他頁面 的「前往註冊」（第 1 條）。"]).errors, []);
  const r = specRepo(["1. A（01-01 §導向其他頁面 第 1 條寫「忘記密碼？」）"]);
  assert.match(r.errors[0], /is not in 01-01 §導向其他頁面 第 1 條; it is in 第 2 條/);
});

test("a link to a spec page sets the page; its label may carry the section", () => {
  const ok = specRepo(["- P2（見[§導向其他頁面](./01-a.mdx#導向其他頁面)的「前往註冊」）"]);
  assert.deepEqual(ok.errors, []);
  const r = specRepo(["- P2（見[規格 01-01](./01-a.mdx#x) §導向其他頁面 的「前往登入」）"]);
  assert.match(r.errors[0], /「前往登入」 is not in 01-01 §導向其他頁面/);
});

test("the context ends with its （…） and with 。, and a bare page mention leaves it alone", () => {
  // 「否」 after the parenthesis is the diagram's own label, not a quote of 01-01
  assert.deepEqual(specRepo(["1. A（01-01 §導向其他頁面 第 1 條），所以「否」不畫"]).errors, []);
  assert.deepEqual(specRepo(["- 01-01 §導向其他頁面 第 1 條。之後「否」不畫"]).errors, []);
  // 歸給 01-02、 names a page; 第 2 條 still reads against 01-01
  const r = specRepo(["- 01-01 §導向其他頁面 第 1 條歸給 01-02、第 2 條寫「忘記密碼？」"]);
  assert.deepEqual(r.errors, []);
});

test("references the scanner cannot place are counted as unverifiable, not passed", () => {
  const r = specRepo(["1. A（主流程 3；E1；§驗收標準「x」；01-01 §卡控機制 那張表）"]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.stats.unverifiable, 4);
  assert.equal(r.notes.length, 4);
});

test("分段 self-references and quotes of what a spec does not say are skipped", () => {
  const r = specRepo([
    "- 分段一第 9 條照 01-01 §導向其他頁面 畫，01-01 §導向其他頁面 沒有寫「全部收尾後導向…」",
  ]);
  assert.deepEqual(r.errors, []);
});

test("a component text identical to its bullet is not checked twice; a drifted one is", () => {
  const bullet = "P1 → P2（01-01 §導向其他頁面 第 1 條）";
  const same = specRepo([`1. ${bullet}`], { component: [bullet] });
  assert.equal(same.stats.mirrored, 1);
  const drift = specRepo([`1. ${bullet}`], {
    component: ["P1 → P2（01-01 §導向其他頁面 第 5 條）"],
  });
  assert.match(
    drift.errors[0],
    /^\.notecraft\/components\/spec-01-mod-logic-flow\.tsx:1: .*has no 第 5 條/,
  );
});

test("an unused spec allowlist entry is an error", () => {
  const root = mkdtempSync(join(tmpdir(), "spec-refs-"));
  mkdirSync(join(root, "docs/specs/01-mod"), { recursive: true });
  writeFileSync(join(root, "docs/specs/01-mod/index.mdx"), "## Logic Flow\n\n- 沒有出處\n");
  const allow = [{ file: "docs/specs/01-mod/index.mdx", text: "y" }];
  const r = checkSpecRefs({ root, components: [], allow });
  assert.match(
    r.errors[0],
    /spec allowlist entry for docs\/specs\/01-mod\/index\.mdx \("y"\) matched nothing/,
  );
  // an entry for a file the run did not read is left alone
  assert.deepEqual(checkSpecRefs({ root, docs: [], components: [], allow }).errors, []);
});

test("checkCitations reports spec reference errors with the rest", () => {
  const root = mkdtempSync(join(tmpdir(), "spec-refs-"));
  mkdirSync(join(root, "docs/specs/01-mod"), { recursive: true });
  writeFileSync(join(root, "docs/specs/01-mod/01-a.mdx"), PAGE_A);
  writeFileSync(
    join(root, "docs/specs/01-mod/index.mdx"),
    "## Logic Flow\n\n1. A（01-01 §導向其他頁面 第 7 條）\n",
  );
  const r = checkCitations({ root, docs: [], logicFlowComponents: [] });
  assert.match(r.errors[0], /has no 第 7 條/);
  assert.equal(failed(r), true);
  assert.equal(r.spec.stats.refs, 2);
});
