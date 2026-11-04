// Regression tests for scripts/check-specs.mjs. Run: node --test scripts/tests/*.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { PRD_CHAPTERS, SPEC_CHAPTERS, MAPPING_CHAPTER, checkDocs, slug } from '../check-specs.mjs';

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
      [PRD]: prd({ 術語: '見 :ref[術語表]{id="term.annotator"}。' }),
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
