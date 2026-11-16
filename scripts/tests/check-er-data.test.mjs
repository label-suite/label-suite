// Regression tests for scripts/check-er-data.mjs. Run: node --test scripts/tests/*.test.mjs
//
// Every case below is a deliberately broken variant of a dictionary and the
// diagram data generated from it, because the checker exists to catch exactly
// the drift a human reading two 1000-line documents will not.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkErData, checkLandedRevisions, checkLineCitations, checkPathCitations, checkSpecEntries, parseDictionary } from '../check-er-data.mjs';

// A two-table dictionary in the real document's shape: a group table in §一,
// a chapter per group, a prose line and a column table per table.
const DICT = `---
title: '候選資料表字典與關聯限制'
---

## 一、範圍與起點

### 九個領域分組

| 分組 | 表數 | 對應模組 | 資料責任 |
| :--- | ---: | :--- | :--- |
| \`account\` | 1 | 01 帳號 | 帳號本身 |
| \`task\` | 1 | 03 任務管理 | 任務本體 |

## 二、\`account\` 帳號（1 張）

### \`users\` — 平台帳號

一列代表一位可登入的使用者。

| 識別碼 | 中文意義 | 型別 | 可空 | 鍵／限制 | 規格來源 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| \`id\` | 帳號的內部識別碼 | \`uuid\` | NOT NULL | **PK** | — |
| \`email\` | 登入帳號 | \`varchar(254)\` | NOT NULL | **唯一** | [01-05](../../specs/01-account/05-login-state.mdx#資料欄位)：正規化後判重 |

## 三、\`task\` 任務管理（1 張）

### \`task\` — 任務本體

一列代表一個任務。

| 識別碼 | 中文意義 | 型別 | 可空 | 鍵／限制 | 規格來源 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| \`id\` | 任務身分 | \`uuid\` | NOT NULL | **PK** | — |
| \`owner_user_id\` | 建立者 | \`uuid\` | NOT NULL | **FK → \`users.id\`，RESTRICT** | [03-02](../../specs/03-task-management/02-task-new.mdx#資料欄位)：建立任務的人 |
| \`archived_at\` | 封存時間 | \`timestamptz\` | **可空** | — | 空值＝未封存 |
`;

const ER = {
  meta: { title: 'x', description: '已落地業務表：**0**。本圖顯示 **2 張候選表、5 欄、1 個單欄 FK**。' },
  groups: [{ key: 'account', label: '帳號' }, { key: 'task', label: '任務' }],
  layout: { columns: [{ key: 'account', groups: ['account'] }, { key: 'task', groups: ['task'] }] },
  tables: [
    {
      name: 'users', label: '平台帳號', group: 'account',
      columns: [
        { name: 'id', type: 'uuid', required: 'required', note: '帳號的內部識別碼', pk: true },
        { name: 'email', type: 'varchar(254)', required: 'required', note: '登入帳號', unique: true },
      ],
    },
    {
      name: 'task', label: '任務本體', group: 'task',
      columns: [
        { name: 'id', type: 'uuid', required: 'required', note: '任務身分', pk: true },
        { name: 'owner_user_id', type: 'uuid', required: 'required', note: '建立者', fk: 'users' },
        { name: 'archived_at', type: 'timestamptz', required: 'nullable', note: '封存時間' },
      ],
    },
  ],
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const run = (er, dict = DICT) => checkErData(dict, er);

test('a diagram generated from the dictionary passes', () => {
  assert.deepEqual(run(ER), []);
});

test('the dictionary parses into tables, columns and groups', () => {
  const d = parseDictionary(DICT);
  assert.deepEqual(d.groups.map((g) => g.key), ['account', 'task']);
  assert.deepEqual(d.tables.map((t) => t.name), ['users', 'task']);
  assert.deepEqual(d.tables[1].columns.map((c) => c.name), ['id', 'owner_user_id', 'archived_at']);
  assert.equal(d.tables[1].columns[2].required, 'nullable');
  assert.equal(d.tables[1].columns[1].fk, 'users');
});

test('a table only in the diagram is reported', () => {
  const er = clone(ER);
  er.tables.push({ name: 'ghost', label: '幽靈', group: 'task', columns: [{ name: 'id', type: 'uuid', required: 'required', note: 'x', pk: true }] });
  assert.match(run(er).join('\n'), /ghost.*not in the dictionary|dictionary.*ghost/i);
});

test('a table only in the dictionary is reported', () => {
  const er = clone(ER);
  er.tables = er.tables.filter((t) => t.name !== 'task');
  // Not /\btask\b/: the group-count check fires on the same word, so a loose
  // assertion passes while this one is removed.
  assert.match(run(er).join('\n'), /"task" is in the dictionary but not in the diagram/);
});

test('a renamed column is reported', () => {
  const er = clone(ER);
  er.tables[1].columns[1].name = 'owner_id';
  assert.match(run(er).join('\n'), /owner_id|owner_user_id/);
});

test('a changed type is reported', () => {
  const er = clone(ER);
  er.tables[0].columns[1].type = 'text';
  assert.match(run(er).join('\n'), /email.*type|type.*email/i);
});

test('a flipped nullability is reported', () => {
  const er = clone(ER);
  er.tables[1].columns[2].required = 'required';
  assert.match(run(er).join('\n'), /archived_at/);
});

test('a dropped primary key is reported', () => {
  const er = clone(ER);
  delete er.tables[0].columns[0].pk;
  assert.match(run(er).join('\n'), /users\.id|primary key/i);
});

test('a foreign key pointing at the wrong table is reported', () => {
  const er = clone(ER);
  er.tables[1].columns[1].fk = 'task';
  assert.match(run(er).join('\n'), /owner_user_id/);
});

test('a dangling foreign key is reported', () => {
  // The dictionary itself points at a table that is not there, so the
  // target-mismatch check agrees with the diagram and this is the only
  // assertion left to catch it.
  const dict = DICT.replace('FK → `users.id`', 'FK → `nowhere.id`');
  const er = clone(ER);
  er.tables[1].columns[1].fk = 'nowhere';
  assert.match(run(er, dict).join('\n'), /which is not a table/);
});

test('a layout column pointing at a group that does not exist is reported', () => {
  const er = clone(ER);
  er.layout.columns[0].groups = ['nope'];
  assert.match(run(er).join('\n'), /layout column "account" points at group "nope"/);
});

test('a spec source link this checker cannot resolve is reported', () => {
  const er = clone(ER);
  er.tables[0].description = '**規格來源**：[01-05](../../specs/01-account/05-login-state.mdx#資料欄位)';
  assert.match(run(er).join('\n'), /cannot resolve/);
});

test('a second spec source line is read too', () => {
  const er = clone(ER);
  er.tables[0].description = '**規格來源**：[01-05](/notes/specs/01-account/05-login-state#資料欄位)\n\n**規格來源**：[01-04](/notes/specs/01-account/99-nope#資料欄位)';
  assert.match(run(er).join('\n'), /99-nope/);
});

test('a duplicate table in the dictionary is reported', () => {
  const dict = DICT + DICT.slice(DICT.indexOf('### `users`'), DICT.indexOf('## 三、'));
  assert.match(run(ER, dict).join('\n'), /duplicate table name "users" in the dictionary/);
});

test('a changed label is reported', () => {
  const er = clone(ER);
  er.tables[0].label = '完全錯的標籤';
  assert.match(run(er).join('\n'), /label is "完全錯的標籤"/);
});

test('a summary sentence that no longer matches the checkable form is reported', () => {
  const er = clone(ER);
  er.meta.description = '本圖顯示 2 張候選表、5 欄、1 個單欄 FK。';
  assert.match(run(er).join('\n'), /no longer matches the checkable form/);
});

// Landed status (#381): the dictionary marks a table under its heading, the
// diagram carries the same line in the table description, and the summary
// counts them. A plan that says a table exists when Alembic never built it is
// the drift this guards against.
const LANDED_LINE = '**已落地**：Alembic revision `a1b2c3d4e5f6`';
const landedDict = DICT.replace('一列代表一位可登入的使用者。', `${LANDED_LINE}\n\n一列代表一位可登入的使用者。`);
const landedEr = () => {
  const er = clone(ER);
  er.meta.description = er.meta.description.replace('已落地業務表：**0**', '已落地業務表：**1**');
  er.tables[0].description = `${LANDED_LINE}\n\n一列代表一位可登入的使用者。`;
  return er;
};

test('the dictionary reads a landed marker under the table heading', () => {
  const d = parseDictionary(landedDict);
  assert.equal(d.tables[0].landed, 'a1b2c3d4e5f6');
  assert.equal(d.tables[1].landed, null);
});

test('a table landed in both with the same revision passes', () => {
  assert.deepEqual(run(landedEr(), landedDict), []);
});

test('a table landed in the dictionary but not in the diagram is reported', () => {
  const er = landedEr();
  delete er.tables[0].description;
  assert.match(run(er, landedDict).join('\n'), /"users": landed revision is none in the diagram but "a1b2c3d4e5f6"/);
});

test('a different landed revision in the diagram is reported', () => {
  const er = landedEr();
  er.tables[0].description = er.tables[0].description.replace('a1b2c3d4e5f6', 'ffffffffffff');
  assert.match(run(er, landedDict).join('\n'), /"users": landed revision is "ffffffffffff" in the diagram/);
});

test('a landed count that disagrees with the dictionary is reported', () => {
  assert.match(run(ER, landedDict).join('\n'), /says 0 landed tables but the dictionary marks 1/);
});

test('a summary with no landed count is reported', () => {
  const er = clone(ER);
  er.meta.description = er.meta.description.replace('已落地業務表：**0**。', '');
  assert.match(run(er).join('\n'), /landed count in the checkable form/);
});

test('a landed revision some migration declares passes', () => {
  const migration = "revision: str = 'a1b2c3d4e5f6'\ndown_revision = None\n";
  assert.deepEqual(checkLandedRevisions(landedDict, [migration]), []);
});

test('a landed revision only named as down_revision is reported', () => {
  const migration = "revision: str = 'zzz'\ndown_revision = 'a1b2c3d4e5f6'\n";
  assert.match(checkLandedRevisions(landedDict, [migration]).join('\n'), /no migration in backend\/alembic\/versions\/ declares/);
});

test('a landed table with no versions directory is reported', () => {
  assert.match(checkLandedRevisions(landedDict, null).join('\n'), /does not exist/);
});

test('no landed table needs no versions directory', () => {
  assert.deepEqual(checkLandedRevisions(DICT, null), []);
});

test('a dictionary with no group table is reported', () => {
  const dict = DICT.replace('### 九個領域分組', '### 分組');
  assert.match(run(ER, dict).join('\n'), /no group table/);
});

test('a wording that denies a unique key in another form is not read as granting one', () => {
  const dict = DICT.replace('| **唯一** |', '| **不設唯一索引** |');
  const er = clone(ER);
  delete er.tables[0].columns[1].unique;
  assert.deepEqual(run(er, dict), []);
});

test('a composite unique written after the word is not flattened', () => {
  const dict = DICT.replace('| **唯一** |', '| **唯一索引** `(id, email)` |');
  assert.match(run(ER, dict).join('\n'), /email.*unique/i);
});

test('a Chinese gloss in parentheses is not mistaken for a column list', () => {
  const dict = DICT.replace('| **唯一** |', '| **唯一**（一個帳號只有一個信箱，不可共用） |');
  assert.deepEqual(run(ER, dict), []);
});

test('a duplicate table name is reported', () => {
  const er = clone(ER);
  er.tables.push(clone(er.tables[0]));
  assert.match(run(er).join('\n'), /duplicate/i);
});

test('a duplicate column name in one table is reported', () => {
  const er = clone(ER);
  er.tables[0].columns.push(clone(er.tables[0].columns[0]));
  assert.match(run(er).join('\n'), /duplicate/i);
});

test('a group a table points at but which does not exist is reported', () => {
  const er = clone(ER);
  er.tables[1].group = 'nope';
  assert.match(run(er).join('\n'), /nope/);
});

test('a group count that disagrees with the dictionary table is reported', () => {
  const dict = DICT.replace('| `task` | 1 |', '| `task` | 2 |');
  assert.match(run(ER, dict).join('\n'), /task/);
});

test('a unique flag the dictionary does not grant is reported', () => {
  // The flag the renderer draws as a per-column badge. #246 shipped 30 of
  // these wrongly, two of them on columns the dictionary says carry no
  // unique key at all.
  const er = clone(ER);
  er.tables[1].columns[2].unique = true;
  assert.match(run(er).join('\n'), /archived_at.*unique/i);
});

test('a composite unique is not flattened onto its columns', () => {
  const dict = DICT.replace('| **唯一** |', '| **唯一** `(id, email)` |');
  // The dictionary now declares a composite; the diagram still flags the
  // column, which would assert a constraint that does not exist.
  assert.match(run(ER, dict).join('\n'), /email.*unique/i);
});

test('a dictionary denying a unique key is not read as granting one', () => {
  const dict = DICT.replace('| **唯一** |', '| **不加唯一**——名稱不是身分 |');
  const er = clone(ER);
  delete er.tables[0].columns[1].unique;
  assert.deepEqual(run(er, dict), []);
});

test('a summary column count that disagrees with the data is reported', () => {
  const er = clone(ER);
  er.meta.description = '本圖顯示 **2 張候選表、9 欄、1 個單欄 FK**。';
  assert.match(run(er).join('\n'), /9 columns but the diagram holds 5/);
});

test('a summary foreign key count that disagrees with the data is reported', () => {
  const er = clone(ER);
  er.meta.description = '本圖顯示 **2 張候選表、5 欄、4 個單欄 FK**。';
  assert.match(run(er).join('\n'), /4 single-column foreign keys but the diagram holds 1/);
});

test('a summary number that disagrees with the data is reported', () => {
  const er = clone(ER);
  er.meta.description = '本圖顯示 **3 張候選表、5 欄、1 個單欄 FK**。';
  assert.match(run(er).join('\n'), /3.*2|summary|描述/i);
});

test('a spec source link to a page that does not exist is reported', () => {
  const er = clone(ER);
  er.tables[0].description = '**規格來源**：[01-05](/notes/specs/01-account/99-nope#資料欄位)';
  const out = run(er).join('\n');
  assert.match(out, /99-nope/);
});

/* ── spec page entries ──────────────────────────────────────────────── */

const ER_WITH_SOURCES = (() => {
  const er = clone(ER);
  er.tables[0].description = '**規格來源**：[01-05](/notes/specs/01-account/05-login-state#資料欄位)';
  er.tables[1].description = '**規格來源**：[03-02](/notes/specs/03-task-management/02-task-new#資料欄位)';
  return er;
})();

const entry = (body) => `## 規格\n\n### 資料欄位\n\n:::note{title="資料規劃入口"}\n${body}\n:::\n`;

test('a spec entry that names exactly the tables citing it passes', () => {
  const pages = [
    { code: '01-05', rel: 'specs/01-account/05-login-state.mdx', text: entry('候選表有 **1 張**：`users`') },
    { code: '03-02', rel: 'specs/03-task-management/02-task-new.mdx', text: entry('候選表有 **1 張**：`task`') },
  ];
  assert.deepEqual(checkSpecEntries(ER_WITH_SOURCES, pages), []);
});

test('a spec entry naming a table that does not cite it is reported', () => {
  // The real case: a table whose description mentions the page as a contrast,
  // not as a source declaration.
  const pages = [{ code: '01-05', rel: 'specs/01-account/05-login-state.mdx', text: entry('候選表有 **2 張**：`users`、`task`') }];
  assert.match(checkSpecEntries(ER_WITH_SOURCES, pages).join('\n'), /task/);
});

test('a spec entry missing a table that cites it is reported', () => {
  const pages = [{ code: '03-02', rel: 'specs/03-task-management/02-task-new.mdx', text: entry('候選表有 **0 張**') }];
  assert.match(checkSpecEntries(ER_WITH_SOURCES, pages).join('\n'), /task/);
});

test('a count that disagrees with the names in the same sentence is reported', () => {
  const pages = [{ code: '01-05', rel: 'specs/01-account/05-login-state.mdx', text: entry('候選表有 **2 張**：`users`') }];
  assert.match(checkSpecEntries(ER_WITH_SOURCES, pages).join('\n'), /says 2 tables but names 1/);
});

test('an entry that names tables but states no count is reported', () => {
  const pages = [{ code: '01-05', rel: 'specs/01-account/05-login-state.mdx', text: entry('候選表：`users`') }];
  assert.match(checkSpecEntries(ER_WITH_SOURCES, pages).join('\n'), /states no count in the checkable form/);
});

test('a spec page with no entry at all is reported', () => {
  const pages = [{ code: '01-05', rel: 'specs/01-account/05-login-state.mdx', text: '## 規格\n\n### 資料欄位\n\n內容\n' }];
  assert.match(checkSpecEntries(ER_WITH_SOURCES, pages).join('\n'), /no 資料規劃入口/);
});

test('a page no table cites passes with an entry that names none', () => {
  const pages = [{ code: '07-01', rel: 'specs/07-shared/01-sidebar.mdx', text: entry('沒有任何一張表把本頁列為規格來源') }];
  assert.deepEqual(checkSpecEntries(ER_WITH_SOURCES, pages), []);
});

// --- line citations -----------------------------------------------------
// #236, 2026-11-14: three citations in the dictionary and the ER data had
// drifted because #170 and #282 inserted rows into a spec's 資料欄位 table.
// Nothing saw it: the spec-source check only proves the cited .mdx exists.
const CITED_PAGE = {
  code: '03-03',
  rel: 'specs/03-task-management/03-task-detail.mdx',
  text: [
    '---',                                                              // 1
    "title: '任務詳情'",                                                 // 2
    '---',                                                              // 3
    '',                                                                 // 4
    '### 資料欄位',                                                      // 5
    '',                                                                 // 6
    '| 欄位 | 規則 |',                                                   // 7
    '| :--- | :--- |',                                                  // 8
    '| 匯出時間 | 用的是**實際讀取結果的那個時間**，不是請求被接受的時間 |', // 9
    '| 排除紀錄 | 終局，不可刪除 |',                                      // 10
    '| 審核單位 | 任務的某個回合 × 某一筆指派 |',                          // 11
  ].join('\n'),
};
const cite = (body) => [{ rel: 'diagrams/architecture/x.mdx', text: body }];
const link = '[03-03](../../specs/03-task-management/03-task-detail.mdx#資料欄位)';

test('a line citation that lands on the row it quotes passes', () => {
  assert.deepEqual(checkLineCitations(cite(`**規格來源**：${link}（\`:9\`「匯出時間……**實際讀取結果的那個時間**」）`), [CITED_PAGE]), []);
});

test('a line citation one row off is reported', () => {
  const out = checkLineCitations(cite(`${link}（\`:10\`「匯出時間……實際讀取結果的那個時間」）`), [CITED_PAGE]);
  assert.match(out.join('\n'), /:10/);
  assert.match(out.join('\n'), /匯出時間/);
});

test('a line citation past the end of the page is reported', () => {
  assert.match(checkLineCitations(cite(`${link}（\`:4000\`「匯出時間」）`), [CITED_PAGE]).join('\n'), /4000/);
});

test('a line citation of a page code no spec page has is reported', () => {
  const body = '[06-09](../../specs/06-admin/09-nope.mdx#資料欄位)（`:9`「匯出時間」）';
  assert.match(checkLineCitations(cite(body), [CITED_PAGE]).join('\n'), /06-09/);
});

test('bold, full-width pipes and spaces do not count as drift', () => {
  // The dictionary quotes a table row as 欄名｜值, which the page writes as | 欄名 | 值 |.
  assert.deepEqual(checkLineCitations(cite(`${link}（\`:11\`「審核單位｜**任務的某個回合 × 某一筆指派**」）`), [CITED_PAGE]), []);
});

test('every fragment of an ellipsis-joined quote must be on that line', () => {
  // The first half is on :9, the second half is not anywhere.
  assert.match(checkLineCitations(cite(`${link}（\`:9\`「匯出時間……**由系統自動決定**」）`), [CITED_PAGE]).join('\n'), /由系統自動決定/);
});

test('a line number with no quote after it is not a citation', () => {
  // The shape a 變更紀錄 row uses to record this very fix.
  assert.deepEqual(checkLineCitations(cite('| [#236](https://x) | 2026-11-14 | 修好三個行號：`:965`→`:974`、`:666`→`:674` |'), [CITED_PAGE]), []);
});

test('a quoted line number that names no spec page is reported', () => {
  assert.match(checkLineCitations(cite('那一頁的 `:9`「匯出時間」就是依據'), [CITED_PAGE]).join('\n'), /names no spec page/);
});

test('the 的「」 shape is a citation too', () => {
  // database-schema.er.json writes `:969` 的「試標輪」, not `:969`「試標輪」.
  const out = checkLineCitations(cite(`${link}（\`:10\` 的「匯出時間」）`), [CITED_PAGE]);
  assert.match(out.join('\n'), /:10/);
});

test('a citation naming a page that exists but a row that moved reports both sides', () => {
  const out = checkLineCitations(cite(`${link}（\`:11\`「匯出時間」）`), [CITED_PAGE]).join('\n');
  assert.match(out, /03-03/);
  assert.match(out, /審核單位/);
});

const OTHER_PAGE = {
  code: '04-01',
  rel: 'specs/04-annotation/01-annotation-list.mdx',
  text: ['---', "title: '標記清單'", '---', '', '| 審核單位 | 任務的某個回合 × 某一筆指派 |'].join('\n'),
};
const other = '[04-01](../../specs/04-annotation/01-annotation-list.mdx#資料欄位)';

test('the page code nearest the citation wins, not the first on the line', () => {
  // The real shape: data-table-dictionary.mdx:751 cites two pages on one line.
  // Reading the first code for both citations would check 04-01 line 9.
  const body = `${other}（\`:5\`「審核單位」）、${link}（\`:9\`「匯出時間」）`;
  assert.deepEqual(checkLineCitations(cite(body), [CITED_PAGE, OTHER_PAGE]), []);
});

test('a bare page code in prose does not steal the citation', () => {
  // `specSources()` already refuses prose links because a mention is often a
  // contrast, not a declaration; attribution has to be just as strict.
  const body = `${link}（不同於 [04-01] 的寫法）（\`:9\`「匯出時間」）`;
  assert.deepEqual(checkLineCitations(cite(body), [CITED_PAGE, OTHER_PAGE]), []);
});

test('a quote longer than a line of prose is still checked', () => {
  const quote = '錯'.repeat(300);
  assert.match(checkLineCitations(cite(`${link}（\`:9\`「${quote}」）`), [CITED_PAGE]).join('\n'), /:9/);
});

test('every ellipsis in use joins fragments', () => {
  for (const dots of ['……', '⋯⋯', '...']) {
    const body = `${link}（\`:9\`「匯出時間${dots}不是請求被接受的時間」）`;
    assert.deepEqual(checkLineCitations(cite(body), [CITED_PAGE]), [], `fragments split on ${dots}`);
  }
});

test('line :0 is reported rather than read as the last line', () => {
  assert.match(checkLineCitations(cite(`${link}（\`:0\`「匯出時間」）`), [CITED_PAGE]).join('\n'), /:0/);
});

// ---------------------------------------------------------------------------
// checkPathCitations: the same drift, one directory over.
//
// `docs/specs/` cites prototype files and the PRD by path and line
// (`sidebar.js:558`), not by spec code, so `checkLineCitations` cannot see
// them. Measured on 2026-11-16: three of the six live citations pointed at
// unrelated lines, and two of those three also asserted a screen state that
// #165 had changed five days earlier. Existence alone catches none of them —
// every stale line number was still inside its file — so a citation without a
// quote is itself the finding.

const FILES = new Map([
  ['design/prototype/pages/shared/sidebar.js', [
    'var taskRoleI18n = {',
    "  zh: { roleAnnotator: '標記員', roleNoTaskRole: '一般使用者' },",
    "  en: { roleAnnotator: 'Annotator', roleNoTaskRole: 'General user' }",
    '};',
  ].join('\n')],
  ['design/prototype/pages/account/profile.html', [
    '<div>',
    "  roleIndicator:           'General user',",
    '</div>',
  ].join('\n')],
  ['docs/specs/00-prd.mdx', ['# PRD', '| 05 資料匯入與版本 | R/C | R | — |'].join('\n')],
  ['design/prototype/pages/dashboard/sidebar.js', 'var other = 1;\n'],
]);

const spec = (body) => [{ rel: 'specs/07-shared/01-sidebar.mdx', text: `# 07-01\n\n## 規格\n\n${body}\n` }];

test('a path citation whose quote is on that line passes', () => {
  const body = "（`design/prototype/pages/account/profile.html:2` 的 `roleIndicator: 'General user'`）";
  assert.deepEqual(checkPathCitations(spec(body), FILES), []);
});

test('a path citation one line off is reported even though the line exists', () => {
  const body = "（`design/prototype/pages/account/profile.html:3` 的 `roleIndicator: 'General user'`）";
  const out = checkPathCitations(spec(body), FILES).join('\n');
  assert.match(out, /:3/);
  assert.match(out, /roleIndicator/);
});

test('a path citation with no quote is reported, because nothing could check it', () => {
  const out = checkPathCitations(spec('（`design/prototype/pages/account/profile.html:2`）'), FILES).join('\n');
  assert.match(out, /profile\.html/);
  assert.match(out, /quote/);
});

test('a bare line number inherits the path named earlier on the same line', () => {
  const body = '（`design/prototype/pages/shared/sidebar.js:2` 的「roleNoTaskRole: \'一般使用者\'」、'
    + '`:3` 的「roleNoTaskRole: \'General user\'」）';
  assert.deepEqual(checkPathCitations(spec(body), FILES), []);
});

test('a bare line number with no path before it on the line is reported', () => {
  // Not /no file/: without the guard the path is `null` and the lookup says
  // "no file in the repository is null", which passes that pattern too.
  const out = checkPathCitations(spec('（`:2` 的「標記員」）'), FILES).join('\n');
  assert.match(out, /names no file before it/);
});

test('a bare line number does not inherit across lines', () => {
  const text = '# 07-01\n\n## 規格\n\n（`design/prototype/pages/shared/sidebar.js:2` 的「標記員」）\n（`:3` 的「Annotator」）\n';
  const out = checkPathCitations([{ rel: 'specs/07-shared/01-sidebar.mdx', text }], FILES).join('\n');
  assert.match(out, /names no file before it/);
});

test('a line past the end of the file is reported', () => {
  assert.match(checkPathCitations(spec('（`docs/specs/00-prd.mdx:400` 的「R/C」）'), FILES).join('\n'), /400/);
});

test('line :0 is reported rather than read as the last line', () => {
  assert.match(checkPathCitations(spec('（`docs/specs/00-prd.mdx:0` 的「R/C」）'), FILES).join('\n'), /:0/);
});

test('a path no file in the repo matches is reported', () => {
  assert.match(checkPathCitations(spec('（`design/prototype/pages/gone.html:1` 的「x」）'), FILES).join('\n'), /gone\.html/);
});

test('a bare file name resolves when exactly one file has it', () => {
  assert.deepEqual(checkPathCitations(spec("（`profile.html:2` 的 `roleIndicator: 'General user'`）"), FILES), []);
});

test('a bare file name two files share is reported as ambiguous, not guessed', () => {
  const out = checkPathCitations(spec('（`sidebar.js:2` 的「標記員」）'), FILES).join('\n');
  assert.match(out, /ambiguous/);
  assert.match(out, /sidebar\.js/);
});

test('a line range passes when the quote is on either line', () => {
  const body = '（`design/prototype/pages/shared/sidebar.js:2-3` 的「roleNoTaskRole: \'General user\'」）';
  assert.deepEqual(checkPathCitations(spec(body), FILES), []);
});

test('a line range is reported when the quote is on neither line', () => {
  const body = '（`design/prototype/pages/shared/sidebar.js:1-2` 的「roleNoTaskRole: \'General user\'」）';
  assert.match(checkPathCitations(spec(body), FILES).join('\n'), /2-3|1-2/);
});

test('a backwards range is reported rather than read as empty', () => {
  // Not /2-1/: with the guard gone the quote check reports the same range,
  // so only the reason tells the two apart.
  const out = checkPathCitations(spec('（`docs/specs/00-prd.mdx:2-1` 的「R/C」）'), FILES).join('\n');
  assert.match(out, /ends before it starts/);
});

test('rows in 變更紀錄 are skipped, because they quote the text they removed', () => {
  // The #179 row on 03-01 quotes its own removed sentence, line number and all.
  const text = '# 07-01\n\n## 變更紀錄\n\n| [#179](u) | 2026-11-10 | §規格 | 「徽章是另一組字（`sidebar.js:9999` 的 `statusLabel`）」 | 移除已失效的行號 |\n';
  assert.deepEqual(checkPathCitations([{ rel: 'specs/03-task-management/01-task-list.mdx', text }], FILES), []);
});

test('a citation after 變更紀錄 ends is checked again', () => {
  const text = '# 07-01\n\n## 變更紀錄\n\n| a | b |\n\n## Q&A\n\n（`docs/specs/00-prd.mdx:9` 的「R/C」）\n';
  assert.match(checkPathCitations([{ rel: 'x.mdx', text }], FILES).join('\n'), /:9/);
});

test('bold and spacing do not count as drift, as in the spec-code checker', () => {
  const body = '（`docs/specs/00-prd.mdx:2` 的「05 資料匯入與版本｜**R/C**」）';
  assert.deepEqual(checkPathCitations(spec(body), FILES), []);
});

test('a one-character quote is too weak to be an anchor and is reported', () => {
  assert.match(checkPathCitations(spec('（`docs/specs/00-prd.mdx:2` 的「R」）'), FILES).join('\n'), /too short/);
});

test('a quote further down the line is not an anchor', () => {
  // The rule that forced 07-01:416 to be rewritten: the citation read
  // `…user-management.html:358` 傳入「系統管理員」, two words apart.
  const body = '（`design/prototype/pages/account/profile.html:2` 傳入 `roleIndicator`）';
  assert.match(checkPathCitations(spec(body), FILES).join('\n'), /no quote after it/);
});

test('a bare file name matches a whole segment, not a suffix of one', () => {
  const files = new Map([['design/prototype/pages/shared/my-sidebar.js', 'var a = 1;\n']]);
  const out = checkPathCitations(spec('（`sidebar.js:1` 的「var a」）'), files).join('\n');
  assert.match(out, /no file in the repository is sidebar\.js/);
});

test('only a level-two heading opens 變更紀錄, so a deeper one keeps checking', () => {
  const text = '# x\n\n## 規格\n\n### 變更紀錄\n\n（`docs/specs/00-prd.mdx:9` 的「R/C」）\n';
  assert.match(checkPathCitations([{ rel: 'x.mdx', text }], FILES).join('\n'), /:9/);
});

test('every fragment of an ellipsis-joined quote must be on that line', () => {
  const ok = '（`docs/specs/00-prd.mdx:2` 的「05 資料匯入與版本……R/C」）';
  assert.deepEqual(checkPathCitations(spec(ok), FILES), []);
  const bad = '（`docs/specs/00-prd.mdx:2` 的「05 資料匯入與版本……由系統決定」）';
  assert.match(checkPathCitations(spec(bad), FILES).join('\n'), /由系統決定/);
});

test('a citation inside a fenced code block is left alone', () => {
  const text = '# x\n\n## 規格\n\n```js\nconsole.log(`app.js:12`);\n```\n';
  assert.deepEqual(checkPathCitations([{ rel: 'x.mdx', text }], FILES), []);
});

test('a 變更紀錄 heading inside a fence does not silence the rest of the page', () => {
  const text = '# x\n\n## 規格\n\n```md\n## 變更紀錄\n```\n\n（`docs/specs/00-prd.mdx:9` 的「R/C」）\n';
  assert.match(checkPathCitations([{ rel: 'x.mdx', text }], FILES).join('\n'), /:9/);
});
