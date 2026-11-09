// Regression tests for scripts/check-specs.mjs. Run: node --test scripts/tests/*.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { PRD_CHAPTERS, SPEC_CHAPTERS, MAPPING_CHAPTER, checkDocs, legacyIdsIn, slug } from '../check-specs.mjs';

function docs(files) {
  const root = mkdtempSync(join(tmpdir(), 'check-specs-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const FRONTMATTER =
  "---\ntitle: 甲\ndescription: 甲。\ncategory: '規格書'\ntags: [規格書]\ncreatedAt: '2026-11-04'\nupdatedAt: '2026-11-04'\n---\n\n";

const SPEC = 'specs/01-user-management/01-user-list.mdx';
const LEGACY = 'specs/legacy/01-01-user-list.ids';
const PRD = 'specs/00-prd.mdx';
const GLOSSARY = 'specs/glossary.mdx';
const INDEX = 'specs/index.mdx';

const ACCEPTANCE = '| Scenario | Given | When | Then |\n| --- | --- | --- | --- |\n| 新增使用者 | a | b | c |\n| 停用使用者 | a | b | c |';

const spec = (body = {}, extra = '') =>
  FRONTMATTER +
  SPEC_CHAPTERS.map((c) => `## ${c}\n\n${body[c] ?? (c === '驗收標準' ? ACCEPTANCE : '')}\n`).join('\n') +
  extra;

const prd = (body = {}) => FRONTMATTER + PRD_CHAPTERS.map((c) => `## ${c}\n\n${body[c] ?? ''}\n`).join('\n');

const def = (id, label = '甲') => `:::define{id="${id}" label="${label}"}\n${label}。\n:::`;
const glossary = (...defs) => FRONTMATTER + defs.join('\n\n') + '\n';

const errorsFor = (files) => checkDocs(docs(files));

test('a complete PRD, glossary and spec pass', () => {
  assert.deepEqual(
    errorsFor({
      [PRD]: prd({ 術語: '見 :ref[標註員]{id="term.annotator"}。' }),
      [GLOSSARY]: glossary(def('term.annotator', '標註員')),
      [SPEC]: spec({ 目標: '讓 :ref[標註員]{id="term.annotator"} 登入。' }),
    }),
    [],
  );
});

test('a missing spec chapter is reported', () => {
  const errors = errorsFor({ [SPEC]: spec().replace('## 卡控機制\n', '') });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /missing chapter "## 卡控機制"/);
});

test('swapped spec chapters are reported as out of order', () => {
  const text = spec().replace('## 目標\n', '## TMP\n').replace('## 使用角色\n', '## 目標\n').replace('## TMP\n', '## 使用角色\n');
  assert.match(errorsFor({ [SPEC]: text }).join('\n'), /out of order/);
});

test('an extra spec chapter is reported, the mapping appendix is not', () => {
  assert.match(errorsFor({ [SPEC]: spec({}, '## 附註\n') }).join('\n'), /unexpected chapter "## 附註"/);
  assert.match(
    errorsFor({ [SPEC]: spec({}, `## ${MAPPING_CHAPTER}\n`) }).join('\n'),
    /exists but there is no legacy ID list/,
  );
});

test('a missing PRD chapter is reported', () => {
  assert.match(errorsFor({ [PRD]: prd().replace('## Site Map\n', '') }).join('\n'), /missing chapter "## Site Map"/);
});

test('only NN-<module>/NN-<page>.mdx files are checked as specs', () => {
  assert.deepEqual(
    errorsFor({
      'specs/index.mdx': '## 模組\n',
      'specs/01-user-management/index.mdx': '## 規格一覽\n',
      'specs/1-x/01-y.mdx': '## 甲\n',
      'specs/01-x/01_y.mdx': '## 甲\n',
      'specs/01-x/02-y/01-z.mdx': '## 甲\n',
    }),
    [],
  );
});

test('a ref inside inline code is not a reference', () => {
  assert.deepEqual(errorsFor({ [GLOSSARY]: glossary('用 `:ref[名詞]{id="term.xxx"}` 引用。\n') }), []);
});

test('files outside docs/specs are checked for term ids too', () => {
  const errors = errorsFor({ '00-prd.mdx': ':ref[甲]{id="term.系統角色"}\n' }).join('\n');
  assert.match(errors, /00-prd\.mdx:1: term id "term\.系統角色" must be term\.<english-kebab-case>/);
});

test('a term defined outside the glossary is reported', () => {
  const errors = errorsFor({ [SPEC]: spec({ 目標: def('term.annotator') }) }).join('\n');
  assert.match(errors, /term "term\.annotator" must be defined in .*specs\/glossary\.mdx/);
});

test('a non-term define outside the glossary is allowed', () => {
  assert.deepEqual(errorsFor({ [SPEC]: spec({ 目標: def('flow.login') }) }), []);
});

test('a term id that is not English kebab-case is reported', () => {
  const errors = errorsFor({ [GLOSSARY]: glossary(def('term.系統角色'), def('term.systemRole'), def('term.system_role')) }).join('\n');
  assert.match(errors, /term id "term\.系統角色" must be term\.<english-kebab-case>/);
  assert.match(errors, /term id "term\.systemRole" must be/);
  assert.match(errors, /term id "term\.system_role" must be/);
});

test('a reference to an undefined term is reported', () => {
  const errors = errorsFor({ [SPEC]: spec({ 目標: ':ref[審核員]{id="term.reviewer"}' }) });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /undefined term "term\.reviewer"/);
});

test('terms inside code fences and MDX comments are ignored', () => {
  const body = '```mdx\n:ref[甲]{id="term.a"}\n```\n{/* :ref[乙]{id="term.b"} */}';
  assert.deepEqual(errorsFor({ [SPEC]: spec({ 目標: body }) }), []);
});

test('an id with a space or an empty segment is reported', () => {
  const errors = errorsFor({
    [GLOSSARY]: glossary(def('term.system role'), def('term..a')),
    [SPEC]: spec({ 目標: ':ref[甲]{id="flow login"}' }),
  }).join('\n');
  assert.match(errors, /glossary\.mdx:\d+: id "term\.system role" may only use/);
  assert.match(errors, /glossary\.mdx:\d+: id "term\.\.a" may only use/);
  assert.match(errors, /01-user-list\.mdx:\d+: id "flow login" may only use/);
});

test('a term defined twice is reported', () => {
  assert.match(errorsFor({ [GLOSSARY]: glossary(def('term.a'), def('term.a')) }).join('\n'), /already defined/);
});

test('a repeated Scenario name is reported', () => {
  const table = '| Scenario | Given | When | Then |\n| --- | --- | --- | --- |\n| 甲 | a | b | c |\n| 甲 | a | b | c |\n| | a | b | c |';
  const errors = errorsFor({ [SPEC]: spec({ 驗收標準: table }) }).join('\n');
  assert.match(errors, /Scenario "甲" is already used on line \d+/);
  assert.match(errors, /a Scenario row has no name/);
});

test('heading slugs drop punctuation and turn spaces into dashes', () => {
  assert.equal(slug(MAPPING_CHAPTER), '附錄舊編號對照');
  assert.equal(slug('邊界情況（Edge Case）'), '邊界情況edge-case');
  assert.equal(slug('Q&A'), 'qa');
});

const legacyIds = 'FR-001\nFR-002\nFR-003\nAC-1.1  # acceptance\nSC-001\n';
const mapped = (rows) =>
  spec(
    { 規格: '### 使用者列表\n\n甲。' },
    `## ${MAPPING_CHAPTER}\n\n| 舊編號 | 新位置 | 說明 |\n| --- | --- | --- |\n${rows}\n`,
  );
const ROWS = [
  '| FR-001 | [§規格 › 使用者列表](#使用者列表) | |',
  '| FR-002 | Scenario：新增使用者 | |',
  '| FR-003 | 刪除 | 改由營運流程處理 |',
  '| AC-1.1 | Scenario：停用使用者 | |',
  '| SC-001 | Scenario：新增使用者 | 與 FR-002 重複，併入 |',
];

test('a mapping that covers every legacy ID passes', () => {
  assert.deepEqual(errorsFor({ [SPEC]: mapped(ROWS.join('\n')), [LEGACY]: legacyIds }), []);
});

test('a legacy ID missing from the mapping is reported', () => {
  const errors = errorsFor({ [SPEC]: mapped(ROWS.slice(1).join('\n')), [LEGACY]: legacyIds });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /legacy FR-001 is missing/);
});

test('a deletion without a reason is reported', () => {
  const rows = ROWS.map((r) => r.replace('改由營運流程處理', ''));
  assert.match(
    errorsFor({ [SPEC]: mapped(rows.join('\n')), [LEGACY]: legacyIds }).join('\n'),
    /FR-003 is marked 刪除 without a reason/,
  );
});

test('a link to a heading the spec does not have is reported', () => {
  const rows = ROWS.map((r) => r.replace('(#使用者列表)', '(#不存在)'));
  assert.match(
    errorsFor({ [SPEC]: mapped(rows.join('\n')), [LEGACY]: legacyIds }).join('\n'),
    /FR-001 links to #不存在, which is not a heading in this spec/,
  );
});

test('a Scenario the acceptance table does not list is reported', () => {
  const rows = ROWS.map((r) => r.replace('Scenario：停用使用者', 'Scenario：刪除使用者'));
  assert.match(
    errorsFor({ [SPEC]: mapped(rows.join('\n')), [LEGACY]: legacyIds }).join('\n'),
    /AC-1\.1 maps to Scenario "刪除使用者"/,
  );
});

test('a bare chapter name or a new FR is not a valid target', () => {
  const rows = ROWS.map((r) => r.replace('Scenario：停用使用者', '卡控機制'));
  assert.match(
    errorsFor({ [SPEC]: mapped(rows.join('\n')), [LEGACY]: legacyIds }).join('\n'),
    /AC-1\.1 maps to "卡控機制"; use a section link/,
  );
});

test('an ID that is not in the legacy list, or mapped twice, is reported', () => {
  const rows = [...ROWS, ROWS[0], '| FR-009 | 刪除 | 甲 |'];
  const errors = errorsFor({ [SPEC]: mapped(rows.join('\n')), [LEGACY]: legacyIds }).join('\n');
  assert.match(errors, /FR-001 is mapped twice/);
  assert.match(errors, /FR-009 is not in the legacy ID list/);
});

test('a legacy list without the mapping chapter is reported', () => {
  assert.match(
    errorsFor({ [SPEC]: spec(), [LEGACY]: legacyIds }).join('\n'),
    /chapter "## 附錄：舊編號對照" is missing/,
  );
});

test('a PRD, glossary or spec without frontmatter is reported', () => {
  const errors = errorsFor({
    [PRD]: prd().replace(FRONTMATTER, ''),
    [GLOSSARY]: glossary().replace(FRONTMATTER, ''),
    [SPEC]: spec().replace(FRONTMATTER, ''),
  });
  assert.equal(errors.length, 3);
  for (const e of errors) assert.match(e, /:1: frontmatter is missing/);
});

test('a missing frontmatter field is reported', () => {
  const errors = errorsFor({ [SPEC]: spec().replace("category: '規格書'\n", '') });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /frontmatter field "category" is missing/);
});

test('an unquoted or malformed date is reported with its line', () => {
  const text = spec().replace("createdAt: '2026-11-04'", 'createdAt: 2026-11-04').replace("updatedAt: '2026-11-04'", 'updatedAt: "2026/11/04"');
  const errors = errorsFor({ [SPEC]: text });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /:6: createdAt must be a quoted "YYYY-MM-DD" string, got 2026-11-04/);
  assert.match(errors[1], /:7: updatedAt must be a quoted "YYYY-MM-DD" string, got "2026\/11\/04"/);
});

test('double-quoted dates pass', () => {
  const text = spec().replace("createdAt: '2026-11-04'", 'createdAt: "2026-11-04"');
  assert.deepEqual(errorsFor({ [SPEC]: text }), []);
});

test('files that are not the PRD, glossary or a spec need no frontmatter', () => {
  assert.deepEqual(errorsFor({ 'prototype/navigation.mdx': '## 甲\n', 'specs/index.mdx': '## 模組\n' }), []);
});

// --- legacy ID shapes, cross-page targets and source prefixes (#58) ---

const SHAPES = [
  'FR-001',
  'FR-004a',
  'FR-004aaa',
  'FR-0010',
  'FR-002c-1',
  'FR-009A1',
  'FR-024A-1',
  'SC-003aa',
  'AC-1.3',
  'AC-2A.1',
  'AC-2A.2a',
  'AC-3.1A',
];

test('every ID shape the legacy specs use is extracted', () => {
  const text = SHAPES.map((id, i) => `${i % 2 ? '-' : '1.'} **${id}**：甲`).join('\n');
  assert.deepEqual([...legacyIdsIn(text)].sort(), [...SHAPES].sort());
});

test('a bold ID followed by a version note is still extracted', () => {
  const text = '10. **AC-1.10（v3.0.0 新增，v3.2.0 修訂；v4.2.0 廢止）**：甲\n- **FR-005 (v2.0.0 廢止)**：甲';
  assert.deepEqual([...legacyIdsIn(text)].sort(), ['AC-1.10', 'FR-005']);
});

test('a version note containing nested parentheses does not break extraction', () => {
  const text = '49. **AC-4.49（v4.57.0 新增，對應 FR-084 與約束（a）～（c），issue #526；已撤銷 v4.59.0）**：甲';
  assert.deepEqual([...legacyIdsIn(text)], ['AC-4.49']);
});

test('an extended-shape ID is a valid legacy ID in the mapping', () => {
  const rows = [...ROWS, '| AC-2A.2a | Scenario：新增使用者 | |'];
  assert.deepEqual(errorsFor({ [SPEC]: mapped(rows.join('\n')), [LEGACY]: `${legacyIds}AC-2A.2a\n` }), []);
});

const OTHER_SPEC = 'specs/01-user-management/02-user-detail.mdx';

test('a cross-page target is accepted when that spec exists', () => {
  const rows = ROWS.map((r) => r.replace('Scenario：停用使用者', '見 規格 01-02'));
  const files = { [SPEC]: mapped(rows.join('\n')), [LEGACY]: legacyIds, [OTHER_SPEC]: spec() };
  assert.deepEqual(errorsFor(files), []);
});

test('a cross-page target naming a spec that does not exist is reported', () => {
  const rows = ROWS.map((r) => r.replace('Scenario：停用使用者', '見 規格 09-09'));
  assert.match(
    errorsFor({ [SPEC]: mapped(rows.join('\n')), [LEGACY]: legacyIds, [OTHER_SPEC]: spec() }).join('\n'),
    /AC-1\.1 maps to 規格 09-09, which does not exist/,
  );
});

test('a cross-page target pointing at the spec itself is reported', () => {
  const rows = ROWS.map((r) => r.replace('Scenario：停用使用者', '見 規格 01-01'));
  assert.match(
    errorsFor({ [SPEC]: mapped(rows.join('\n')), [LEGACY]: legacyIds }).join('\n'),
    /AC-1\.1 maps to 規格 01-01, which is this spec/,
  );
});

test('a source prefix keeps same-named IDs from two legacy sources distinct', () => {
  const ids = 'shared:FR-001\nfoundation:FR-001\n';
  const rows = [
    '| shared:FR-001 | [§規格 › 使用者列表](#使用者列表) | 來自 shared/008 |',
    '| foundation:FR-001 | 刪除 | 來自 foundation/000，技術規範 |',
  ];
  assert.deepEqual(errorsFor({ [SPEC]: mapped(rows.join('\n')), [LEGACY]: ids }), []);
});

test('a prefixed ID still has to be in the legacy list', () => {
  const rows = ['| shared:FR-001 | 刪除 | 甲 |', '| foundation:FR-002 | 刪除 | 甲 |'];
  assert.match(
    errorsFor({ [SPEC]: mapped(rows.join('\n')), [LEGACY]: 'shared:FR-001\n' }).join('\n'),
    /foundation:FR-002 is not in the legacy ID list/,
  );
});

test('a malformed source prefix is still reported as not a legacy ID', () => {
  const rows = ['| 01 shared:FR-001 | 刪除 | 甲 |'];
  assert.match(
    errorsFor({ [SPEC]: mapped(rows.join('\n')), [LEGACY]: '01 shared:FR-001\n' }).join('\n'),
    /is not a legacy ID/,
  );
});

// --- anchor links (#129) ---------------------------------------------------

const SPEC2 = 'specs/01-user-management/02-user-detail.mdx';

test('a same-file anchor that matches a heading passes', () => {
  assert.deepEqual(errorsFor({ [SPEC]: spec({ 目標: '見 [§卡控機制](#卡控機制)。' }) }), []);
});

test('a same-file anchor with no such heading is reported', () => {
  const errors = errorsFor({ [SPEC]: spec({ 目標: '見 [§不存在](#不存在的章節)。' }) }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: link anchor "#不存在的章節" has no matching heading/);
});

test('a cross-file anchor that matches a heading in the target passes', () => {
  assert.deepEqual(
    errorsFor({
      [SPEC]: spec({ 目標: '見 [規格 01-02 §卡控機制](./02-user-detail.mdx#卡控機制)。' }),
      [SPEC2]: spec(),
    }),
    [],
  );
});

test('a cross-file anchor with no such heading in the target is reported', () => {
  const errors = errorsFor({
    [SPEC]: spec({ 目標: '見 [規格 01-02 §停用與啟用帳號](./02-user-detail.mdx#停用與啟用帳號)。' }),
    [SPEC2]: spec(),
  }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: link anchor "\.\/02-user-detail\.mdx#停用與啟用帳號" has no matching heading/);
});

test('a cross-file link to a file that does not exist is reported', () => {
  const errors = errorsFor({ [SPEC]: spec({ 目標: '見 [規格 09-09](../09-nope/09-nope.mdx#目標)。' }) }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: link target "\.\.\/09-nope\/09-nope\.mdx" does not exist/);
});

test('an anchor on a level-1 heading resolves', () => {
  assert.deepEqual(errorsFor({ [SPEC]: spec({ 目標: '見 [頁首](#甲)。' }, '\n# 甲\n') }), []);
});

test('a repeated heading gets the -1 suffix anchor', () => {
  assert.deepEqual(
    errorsFor({ [SPEC]: spec({ 目標: '見 [第二個](#重複-1)。', 卡控機制: '### 重複\n\n### 重複\n' }) }),
    [],
  );
});

test('an anchor inside a fenced code block is not checked', () => {
  assert.deepEqual(
    errorsFor({ [SPEC]: spec({ 目標: '```md\n[x](#不存在的章節)\n```\n' }) }),
    [],
  );
});

test('a link with no anchor is not checked', () => {
  assert.deepEqual(
    errorsFor({ [SPEC]: spec({ 目標: '見 [規格 01-02](./02-user-detail.mdx)。' }), [SPEC2]: spec() }),
    [],
  );
});

test('an external URL with a fragment is not treated as a spec anchor', () => {
  assert.deepEqual(
    errorsFor({ [SPEC]: spec({ 目標: '見 [Issue](https://github.com/o/r/issues/1#issuecomment-2)。' }) }),
    [],
  );
});

test('a link to a non-mdx file with a fragment is not checked', () => {
  assert.deepEqual(errorsFor({ [SPEC]: spec({ 目標: '見 [圖](./a.svg#layer1)。' }) }), []);
});

test('a percent-encoded anchor resolves to the decoded heading', () => {
  assert.deepEqual(errorsFor({ [SPEC]: spec({ 目標: '見 [目標](#%E7%9B%AE%E6%A8%99)。' }) }), []);
});

test('a level-1 heading anchor is the plain slug, not a suffixed one', () => {
  const errors = errorsFor({ [SPEC]: spec({ 目標: '見 [頁首](#甲-1)。' }, '\n# 甲\n') }).join('\n');
  assert.match(errors, /link anchor "#甲-1" has no matching heading/);
});

test('a heading that appears once has no -1 anchor', () => {
  const errors = errorsFor({ [SPEC]: spec({ 目標: '見 [第二個](#重複-1)。', 卡控機制: '### 重複\n' }) }).join('\n');
  assert.match(errors, /link anchor "#重複-1" has no matching heading/);
});

test('a percent-encoded anchor with no such heading is still reported', () => {
  // %E4%B8%8D%E5%AD%98 decodes to 不存 — reported, so the decode is not a blanket pass.
  const errors = errorsFor({ [SPEC]: spec({ 目標: '見 [x](#%E4%B8%8D%E5%AD%98)。' }) }).join('\n');
  assert.match(errors, /link anchor "#%E4%B8%8D%E5%AD%98" has no matching heading/);
});

// --- stale "未撰寫" cross-references (#150) --------------------------------

const SPEC3 = 'specs/02-dashboard/01-dashboard.mdx';

test('calling a spec page unwritten when it exists is reported', () => {
  const errors = errorsFor({
    [SPEC]: spec({ 目標: '見 規格 02-01 儀表板（未撰寫）。' }),
    [SPEC3]: spec(),
  }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: spec 02-01 is called 未撰寫 but specs\/02-dashboard\/01-dashboard\.mdx exists/);
});

test('the number may come after the page name', () => {
  const errors = errorsFor({
    [SPEC]: spec({ 目標: '見 儀表板（規格 02-01，未撰寫）。' }),
    [SPEC3]: spec(),
  }).join('\n');
  assert.match(errors, /spec 02-01 is called 未撰寫/);
});

test('the 規格 prefix is optional', () => {
  const errors = errorsFor({
    [SPEC]: spec({ 目標: '那一層屬 02-01（未撰寫）。' }),
    [SPEC3]: spec(),
  }).join('\n');
  assert.match(errors, /spec 02-01 is called 未撰寫/);
});

test('calling a spec page unwritten when it really is absent passes', () => {
  assert.deepEqual(errorsFor({ [SPEC]: spec({ 目標: '見 規格 09-09 還沒寫的頁（未撰寫）。' }) }), []);
});

test('未撰寫 with no spec number nearby is not reported', () => {
  assert.deepEqual(errorsFor({ [SPEC]: spec({ 目標: '這一節未撰寫。' }), [SPEC3]: spec() }), []);
});

test('a spec number far from 未撰寫 is not pulled in', () => {
  assert.deepEqual(
    errorsFor({
      [SPEC]: spec({ 目標: '見 規格 02-01 儀表板，那一頁講的是彙整任務與快速回到標記，另外有一段內容未撰寫。' }),
      [SPEC3]: spec(),
    }),
    [],
  );
});

test('未撰寫 inside a fenced code block is not reported', () => {
  assert.deepEqual(
    errorsFor({ [SPEC]: spec({ 目標: '```md\n規格 02-01（未撰寫）\n```\n' }), [SPEC3]: spec() }),
    [],
  );
});

test('a link to a spec page that does not exist is reported even without an anchor', () => {
  const errors = errorsFor({ [SPEC]: spec({ 目標: '見 [規格 09-09](../09-nope/09-nope.mdx)。' }) }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: link target "\.\.\/09-nope\/09-nope\.mdx" does not exist/);
});

test('a link to a spec page that exists passes without an anchor', () => {
  assert.deepEqual(
    errorsFor({ [SPEC]: spec({ 目標: '見 [規格 02-01](../02-dashboard/01-dashboard.mdx)。' }), [SPEC3]: spec() }),
    [],
  );
});

test('a date is not mistaken for a spec number', () => {
  assert.deepEqual(
    errorsFor({ [SPEC]: spec({ 目標: '這一版記在 2026-02-01，未撰寫。' }), [SPEC3]: spec() }),
    [],
  );
});

test('the look-back does not reach into the previous line', () => {
  assert.deepEqual(
    errorsFor({ [SPEC]: spec({ 目標: '見規格 02-01\n（未撰寫）。' }), [SPEC3]: spec() }),
    [],
  );
});

test('every spec number in the window is checked, not just the last', () => {
  const errors = errorsFor({
    [SPEC]: spec({ 目標: '見 規格 02-01、09-09（都未撰寫）。' }),
    [SPEC3]: spec(),
  }).join('\n');
  assert.match(errors, /spec 02-01 is called 未撰寫/);
});

test('還沒撰寫 and 尚未撰寫 count as the same claim', () => {
  const errors = errorsFor({
    [SPEC]: spec({ 目標: '規格 02-01 還沒撰寫。', 卡控機制: '規格 02-01 尚未撰寫。' }),
    [SPEC3]: spec(),
  }).join('\n');
  assert.equal((errors.match(/is called/g) ?? []).length, 2);
});

test('00-prd.mdx is skipped on purpose', () => {
  assert.deepEqual(errorsFor({ [PRD]: prd({ 'Site Map': '儀表板：規格 02-01，未撰寫' }), [SPEC3]: spec() }), []);
});

test('未撰寫 inside a JSX comment is not reported', () => {
  assert.deepEqual(
    errorsFor({ [SPEC]: spec({ 目標: '{/* 規格 02-01（未撰寫） */}' }), [SPEC3]: spec() }),
    [],
  );
});

// --- ref display text vs glossary label (#150) ------------------------------

test('a ref whose display text matches the define label passes', () => {
  assert.deepEqual(
    errorsFor({
      [GLOSSARY]: glossary(def('term.annotator', '標註員')),
      [SPEC]: spec({ 目標: '讓 :ref[標註員]{id="term.annotator"} 登入。' }),
    }),
    [],
  );
});

test('a ref whose display text differs from the define label is reported', () => {
  const errors = errorsFor({
    [GLOSSARY]: glossary(def('term.annotator', '標註員')),
    [SPEC]: spec({ 目標: '讓 :ref[標記員]{id="term.annotator"} 登入。' }),
  }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: ref text "標記員" does not match the label "標註員" of term\.annotator/);
});

test('a ref inside inline code is not checked for its label', () => {
  assert.deepEqual(
    errorsFor({
      [GLOSSARY]: glossary(def('term.annotator', '標註員'), '用 `:ref[名詞]{id="term.annotator"}` 引用。'),
    }),
    [],
  );
});

test('a ref to an undefined term is reported once, not twice', () => {
  const errors = errorsFor({
    [GLOSSARY]: glossary(def('term.annotator', '標註員')),
    [SPEC]: spec({ 目標: ':ref[甲]{id="term.nope"}' }),
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /reference to undefined term "term\.nope"/);
});

test('a define that writes label before id still holds its references', () => {
  const errors = errorsFor({
    [GLOSSARY]: FRONTMATTER + ':::define{label="標註員" id="term.annotator"}\n標註員。\n:::\n',
    [SPEC]: spec({ 目標: '讓 :ref[標記員]{id="term.annotator"} 登入。' }),
  }).join('\n');
  assert.match(errors, /ref text "標記員" does not match the label "標註員" of term\.annotator/);
});

// A spec page is read before the glossary, so only the glossary's own label may
// be the one a reference is held to.
test('a term define outside the glossary does not shadow the glossary label', () => {
  const errors = errorsFor({
    [GLOSSARY]: glossary(def('term.annotator', '標註員')),
    [SPEC]: spec({ 目標: def('term.annotator', '標記員') + '\n\n讓 :ref[標註員]{id="term.annotator"} 登入。' }),
  }).join('\n');
  assert.doesNotMatch(errors, /does not match the label/);
});

// Nothing reports a duplicate id outside term.*, so the first one has to win or
// the label a reference is held to would depend on the order files are read in.
test('the first define of a non-term id settles its label', () => {
  const errors = errorsFor({
    [GLOSSARY]: glossary(def('term.annotator', '標註員')) + '\n' + def('specs.map', '甲') + '\n',
    [INDEX]: FRONTMATTER + def('specs.map', '乙') + '\n',
    [SPEC]: spec({ 目標: '見 :ref[甲]{id="specs.map"}。' }),
  }).join('\n');
  assert.doesNotMatch(errors, /does not match the label/);
});

test('a define with no label exempts its references from the label check', () => {
  assert.deepEqual(
    errorsFor({
      [GLOSSARY]: FRONTMATTER + ':::define{id="term.annotator"}\n標註員。\n:::\n',
      [SPEC]: spec({ 目標: '讓 :ref[隨便]{id="term.annotator"} 登入。' }),
    }),
    [],
  );
});

// --- question numbers (#150) -------------------------------------------------

test('the same Q number twice in one page is reported at every occurrence', () => {
  const errors = errorsFor({
    [SPEC]: spec({ 待釐清: '### Q9. 甲\n\n甲。', 已確認決議: '### Q9. 乙\n\n乙。' }),
  }).join('\n');
  const lines = [...errors.matchAll(/01-user-list\.mdx:(\d+): question number "Q9"/g)].map((m) => m[1]);
  assert.equal(lines.length, 2, `expected both occurrences, got:\n${errors}`);
});

test('two pages may each use the same Q number', () => {
  assert.deepEqual(
    errorsFor({
      [SPEC]: spec({ 待釐清: '### Q9. 甲\n\n甲。' }),
      [SPEC2]: spec({ 待釐清: '### Q9. 乙\n\n乙。' }),
    }),
    [],
  );
});

test('a citation naming the wrong chapter for a Q number is reported', () => {
  const errors = errorsFor({
    [SPEC]: spec({ 目標: '見 [§待釐清](#待釐清) Q9。', 已確認決議: '### Q9. 甲\n\n甲。' }),
  }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: "Q9" is not in §待釐清 of specs\/01-user-management\/01-user-list\.mdx/);
});

test('a citation of a Q number that is in the chapter it names passes', () => {
  assert.deepEqual(errorsFor({ [SPEC]: spec({ 目標: '見 [§待釐清](#待釐清) Q9。', 待釐清: '### Q9. 甲\n\n甲。' }) }), []);
});

test('a citation is resolved against the page its link points at', () => {
  const errors = errorsFor({
    [SPEC]: spec({ 目標: '見 [規格 01-02 §待釐清](./02-user-detail.mdx#待釐清) Q9。', 待釐清: '### Q9. 甲\n\n甲。' }),
    [SPEC2]: spec({ 已確認決議: '### Q9. 乙\n\n乙。' }),
  }).join('\n');
  assert.match(errors, /"Q9" is not in §待釐清 of specs\/01-user-management\/02-user-detail\.mdx/);
});

test('a citation naming two Q numbers checks both', () => {
  const errors = errorsFor({
    [SPEC]: spec({ 目標: '見 [§待釐清](#待釐清) Q9 與 Q10。', 待釐清: '### Q9. 甲\n\n甲。' }),
  }).join('\n');
  assert.doesNotMatch(errors, /"Q9" is not in/);
  assert.match(errors, /"Q10" is not in §待釐清/);
});

const OPEN_QUESTIONS = 'specs/open-questions.mdx';
const row = (number, q, target, chapter) =>
  `| ${number} ${q} | 甲 | 乙 | 丙 | [規格 ${number} §${chapter}](${target}#${chapter}) |`;

test('an index row whose Q number is in the other chapter is reported', () => {
  const errors = errorsFor({
    [OPEN_QUESTIONS]: FRONTMATTER + row('01-01', 'Q9', './01-user-management/01-user-list.mdx', '待釐清') + '\n',
    [SPEC]: spec({ 已確認決議: '### Q9. 甲\n\n甲。' }),
  }).join('\n');
  assert.match(errors, /open-questions\.mdx:\d+: "Q9" is not in §待釐清 of specs\/01-user-management\/01-user-list\.mdx/);
});

test('an index row whose Q number is in the chapter it names passes', () => {
  assert.deepEqual(
    errorsFor({
      [OPEN_QUESTIONS]: FRONTMATTER + row('01-01', 'Q9', './01-user-management/01-user-list.mdx', '待釐清') + '\n',
      [SPEC]: spec({ 待釐清: '### Q9. 甲\n\n甲。' }),
    }),
    [],
  );
});

test('an index row naming one spec but linking to another is reported', () => {
  const errors = errorsFor({
    [OPEN_QUESTIONS]: FRONTMATTER + row('01-01', 'Q9', './01-user-management/02-user-detail.mdx', '待釐清') + '\n',
    [SPEC]: spec({ 待釐清: '### Q9. 甲\n\n甲。' }),
    [SPEC2]: spec({ 待釐清: '### Q9. 乙\n\n乙。' }),
  }).join('\n');
  assert.match(errors, /open-questions\.mdx:\d+: row names 規格 01-01 but links to specs\/01-user-management\/02-user-detail\.mdx/);
});

test('a citation whose target page has no such chapter is left to the anchor check', () => {
  const errors = errorsFor({
    [OPEN_QUESTIONS]: FRONTMATTER + '見 [§待釐清](./glossary.mdx#待釐清) Q1。\n',
    [GLOSSARY]: glossary(def('term.annotator', '標註員')),
  }).join('\n');
  assert.match(errors, /has no matching heading in specs\/glossary\.mdx/);
  assert.doesNotMatch(errors, /"Q1" is not in/);
});

test('a clause boundary after the link does not pull the next number in', () => {
  assert.deepEqual(
    errorsFor({
      [SPEC]: spec({ 目標: '見 [規格 01-02 §待釐清](./02-user-detail.mdx#待釐清)，Q9 也在等。', 待釐清: '### Q9. 甲\n\n甲。' }),
      [SPEC2]: spec({ 待釐清: '### Q1. 乙\n\n乙。' }),
    }),
    [],
  );
});

// The row's own page is named by its last cell; an earlier cell may legitimately
// cite another page's chapter, and that citation is checked as prose, not as the
// row's own link (this was a false positive on open-questions.mdx:251).
test('an index row citing another page mid-row is judged by its last link', () => {
  assert.deepEqual(
    errorsFor({
      [OPEN_QUESTIONS]:
        FRONTMATTER +
        '| 01-01 Q9 | 甲 | 已由[規格 01-02 §已確認決議](./01-user-management/02-user-detail.mdx#已確認決議) Q1 結案 |' +
        ' [規格 01-01 §待釐清](./01-user-management/01-user-list.mdx#待釐清) |\n',
      [SPEC]: spec({ 待釐清: '### Q9. 甲\n\n甲。' }),
      [SPEC2]: spec({ 已確認決議: '### Q1. 乙（已定案，維護者裁定 2026-11-09）\n\n乙。' }),
    }),
    [],
  );
});

// --- the basis of a settled decision (#90) -----------------------------------

const settled = (block) => spec({ 已確認決議: block });

test('a decision citing the PRD passes', () => {
  assert.deepEqual(errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：PRD §使用者角色 已經把這一條定下來。') }), []);
});

test('a decision citing the glossary passes', () => {
  assert.deepEqual(errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：依術語表已定的名稱折回。') }), []);
});

test('a decision citing a D rule of the migration document passes', () => {
  assert.deepEqual(errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：依搬移設計文件的 D5，一律以 main 分支現況為準。') }), []);
});

// Deliberately cites nothing but the legacy ID, and writes it as inline code the
// way every page does: this is what pins both the legacy-ID basis and the choice
// to read the raw text, since stripIgnored would blank the ID.
test("a decision citing this page's own source clause passes", () => {
  assert.deepEqual(errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：`FR-002` 已經定了這一條。') }), []);
});

test('naming a basis only to say it is absent is not a citation', () => {
  const errors = errorsFor({
    [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：舊規格沒有定義這一條，由我自己判斷 100 字夠用。'),
  }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: decision "Q9" states no basis/);
});

test("a decision citing the source's own clarification record passes", () => {
  assert.deepEqual(errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：舊來源的釐清紀錄逐字寫下這個答案。') }), []);
});

test('a decision citing a dated maintainer ruling passes', () => {
  assert.deepEqual(errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案，維護者裁定 2026-11-09）\n\n> 理由：乙。') }), []);
});

test('a maintainer ruling without a date is reported', () => {
  const errors = errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案，維護者裁定）\n\n> 理由：乙。') }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: decision "Q9" states no basis/);
});

test("a decision resting only on the writer's own reasoning is reported", () => {
  const errors = errorsFor({
    [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：254 字是信箱格式本身的上限，100 字放得下中英文全名，又不會撐壞列表。'),
  }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: decision "Q9" states no basis/);
});

test('the basis may be written in the 依據 bullet instead of the 理由 quote', () => {
  assert.deepEqual(
    errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案）\n\n- **依據**：來源的規格常數明寫這個值。') }),
    [],
  );
});

test('an unsettled question is not checked for a basis', () => {
  assert.deepEqual(errorsFor({ [SPEC]: spec({ 待釐清: '### Q9. 甲？\n\n建議：乙。' }) }), []);
});

test('a missing basis may be deferred only by naming an issue', () => {
  assert.deepEqual(errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：依據待補（#123）。') }), []);
  const errors = errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：依據待補。') }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: decision "Q9" states no basis/);
});

test('a decision citing the writing method passes', () => {
  assert.deepEqual(errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：這些屬於畫面，依 `spec-writing` 的技術用語黑名單不收。') }), []);
});

// 06-01 Q7 的依據是 skill 步驟 1 輸入表的「畫面長相以 prototype 為準，規格只寫規則」——
// 鐵律 1 管的是技術用語，非目標管的是技術設計，兩者都沒有覆蓋版面與按鈕順序。
test('a decision citing the prototype-precedence rule passes', () => {
  assert.deepEqual(
    errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：依 `spec-writing`「畫面長相以 prototype 為準，規格只寫規則」，版面不寫進規格。') }),
    [],
  );
});

test('naming the method document without naming a rule is not a citation', () => {
  const errors = errorsFor({
    [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：這一頁用的 skill 叫 `spec-writing`，我自己判斷這樣比較好。'),
  }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: decision "Q9" states no basis/);
});

// 審查示範過的誤放行：關鍵字出現在問題標題裡，理由卻是撰寫者自己的判斷。
test('the writing method needs the document named, not just the word', () => {
  const errors = errorsFor({
    [SPEC]: settled('### Q9. 這一條算不算非目標？（已定案）\n\n> 理由：我自己判斷不算，所以收進規格。'),
  }).join('\n');
  assert.match(errors, /01-user-list\.mdx:\d+: decision "Q9" states no basis/);
});

test('a decision citing the migration document\'s non-goals passes', () => {
  assert.deepEqual(errorsFor({ [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：搬移設計文件的「非目標」已經把這一類排除在外。') }), []);
});

test('every decision in a chapter is reported, not just the first', () => {
  const errors = errorsFor({
    [SPEC]: settled('### Q9. 甲？（已定案）\n\n> 理由：甲。\n\n### Q10. 乙？（已定案）\n\n> 理由：乙。'),
  }).join('\n');
  assert.match(errors, /decision "Q9" states no basis/);
  assert.match(errors, /decision "Q10" states no basis/);
});
