// Regression tests for scripts/check-specs.mjs. Run: node --test scripts/tests/
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { PRD_CHAPTERS, SPEC_CHAPTERS, MAPPING_CHAPTER, checkDocs } from '../check-specs.mjs';

function docs(files) {
  const root = mkdtempSync(join(tmpdir(), 'check-specs-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

const spec = (body = {}, extra = '') =>
  SPEC_CHAPTERS.map((c) => `## ${c}\n\n${body[c] ?? ''}\n`).join('\n') + extra;

const prd = (body = {}) => PRD_CHAPTERS.map((c, i) => `## ${i + 1}. ${c}\n\n${body[c] ?? ''}\n`).join('\n');

const errorsFor = (files) => checkDocs(docs(files));

test('a complete PRD and spec pass', () => {
  assert.deepEqual(
    errorsFor({
      '00-prd.mdx': prd({ 術語表: '::::define{id="term.標註員" label="標註員"}\n執行標註的人。\n::::' }),
      'specs/006-user-management.mdx': spec({ 目標: '讓 :ref[標註員]{id="term.標註員"} 登入。' }),
    }),
    [],
  );
});

test('a missing spec chapter is reported', () => {
  const text = spec().replace('## 卡控機制\n', '');
  const errors = errorsFor({ 'specs/006-x.mdx': text });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /missing chapter "## 卡控機制"/);
});

test('swapped spec chapters are reported as out of order', () => {
  const text = spec().replace('## 規格\n', '## TMP\n').replace('## 資料模型\n', '## 規格\n').replace('## TMP\n', '## 資料模型\n');
  assert.match(errorsFor({ 'specs/006-x.mdx': text }).join('\n'), /out of order/);
});

test('an extra spec chapter is reported, the mapping appendix is not', () => {
  assert.match(errorsFor({ 'specs/006-x.mdx': spec({}, '## 附註\n') }).join('\n'), /unexpected chapter "## 附註"/);
  assert.deepEqual(errorsFor({ 'specs/006-x.mdx': spec({}, `## ${MAPPING_CHAPTER}\n`) }), []);
});

test('PRD chapters are checked with their numbers stripped', () => {
  const text = prd().replace('## 12. 術語表\n', '');
  assert.match(errorsFor({ '00-prd.mdx': text }).join('\n'), /missing chapter "## 術語表"/);
});

test('files outside the naming pattern are not checked as specs', () => {
  assert.deepEqual(errorsFor({ 'specs/00-writing-order.mdx': '## 進度\n' }), []);
});

test('a reference to an undefined term is reported', () => {
  const errors = errorsFor({ 'specs/006-x.mdx': spec({ 目標: ':ref[審核員]{id="term.審核員"}' }) });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /undefined term "term\.審核員"/);
});

test('terms inside code fences and MDX comments are ignored', () => {
  const body = '```mdx\n:ref[甲]{id="term.甲"}\n```\n{/* :ref[乙]{id="term.乙"} */}';
  assert.deepEqual(errorsFor({ 'specs/006-x.mdx': spec({ 目標: body }) }), []);
});

test('a term defined twice is reported', () => {
  const def = '::::define{id="term.甲" label="甲"}\n甲。\n::::';
  assert.match(errorsFor({ '00-prd.mdx': prd({ 術語表: `${def}\n\n${def}` }) }).join('\n'), /already defined/);
});

test('an ID defined twice in one spec is reported', () => {
  const body = '- **FR-001**：甲。\n- **FR-001**：乙。';
  assert.match(errorsFor({ 'specs/006-x.mdx': spec({ 規格: body }) }).join('\n'), /FR-001 is defined more than once/);
});

test('the same ID in two specs is allowed', () => {
  const body = { 規格: '- **FR-001**：甲。' };
  assert.deepEqual(errorsFor({ 'specs/006-x.mdx': spec(body), 'specs/007-y.mdx': spec(body) }), []);
});

test('a referenced ID is not a definition', () => {
  const body = '- **FR-001**：甲，見 FR-001 與 `account/020` 的 FR-002。';
  assert.deepEqual(errorsFor({ 'specs/006-x.mdx': spec({ 規格: body }) }), []);
});

const legacy = 'FR-001\nFR-002\nAC-1.1  # acceptance\n';
const mapped = (rows) =>
  spec(
    { 規格: '- **FR-001**：甲。', 驗收標準: '| ID | Given | When | Then |\n| --- | --- | --- | --- |\n| AC-1.1 | a | b | c |' },
    `## ${MAPPING_CHAPTER}\n\n| 舊編號 | 新位置 | 說明 |\n| --- | --- | --- |\n${rows}\n`,
  );

test('a mapping that covers every legacy ID passes', () => {
  const rows = '| FR-001 | FR-001 | |\n| FR-002 | 刪除 | 與 FR-001 重複 |\n| AC-1.1 | AC-1.1 | |';
  assert.deepEqual(errorsFor({ 'specs/006-x.mdx': mapped(rows), 'specs/legacy/006-x.ids': legacy }), []);
});

test('a legacy ID missing from the mapping is reported', () => {
  const rows = '| FR-001 | FR-001 | |\n| AC-1.1 | AC-1.1 | |';
  const errors = errorsFor({ 'specs/006-x.mdx': mapped(rows), 'specs/legacy/006-x.ids': legacy });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /legacy FR-002 is missing/);
});

test('a deletion without a reason is reported', () => {
  const rows = '| FR-001 | FR-001 | |\n| FR-002 | 刪除 | |\n| AC-1.1 | AC-1.1 | |';
  assert.match(
    errorsFor({ 'specs/006-x.mdx': mapped(rows), 'specs/legacy/006-x.ids': legacy }).join('\n'),
    /FR-002 is marked 刪除 without a reason/,
  );
});

test('a mapping to an ID the spec does not define is reported', () => {
  const rows = '| FR-001 | FR-001 | |\n| FR-002 | FR-009 | |\n| AC-1.1 | AC-1.1 | |';
  assert.match(
    errorsFor({ 'specs/006-x.mdx': mapped(rows), 'specs/legacy/006-x.ids': legacy }).join('\n'),
    /FR-002 maps to FR-009, which this spec does not define/,
  );
});

test('a mapping to a chapter name passes', () => {
  const rows = '| FR-001 | FR-001 | |\n| FR-002 | 卡控機制 | 改寫成卡控 |\n| AC-1.1 | AC-1.1 | |';
  assert.deepEqual(errorsFor({ 'specs/006-x.mdx': mapped(rows), 'specs/legacy/006-x.ids': legacy }), []);
});

test('an ID that is not in the legacy list, or mapped twice, is reported', () => {
  const rows = '| FR-001 | FR-001 | |\n| FR-001 | FR-001 | |\n| FR-002 | 刪除 | 重複 |\n| FR-003 | FR-001 | |\n| AC-1.1 | AC-1.1 | |';
  const errors = errorsFor({ 'specs/006-x.mdx': mapped(rows), 'specs/legacy/006-x.ids': legacy }).join('\n');
  assert.match(errors, /FR-001 is mapped twice/);
  assert.match(errors, /FR-003 is not in the legacy ID list/);
});

test('a legacy list without the mapping chapter is reported', () => {
  assert.match(
    errorsFor({ 'specs/006-x.mdx': spec(), 'specs/legacy/006-x.ids': legacy }).join('\n'),
    /chapter "## 附錄：舊條文對照" is missing/,
  );
});
