// Regression tests for scripts/check-er-data.mjs. Run: node --test scripts/tests/*.test.mjs
//
// Every case below is a deliberately broken variant of a dictionary and the
// diagram data generated from it, because the checker exists to catch exactly
// the drift a human reading two 1000-line documents will not.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkErData, checkSpecEntries, parseDictionary } from '../check-er-data.mjs';

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
  meta: { title: 'x', description: '本圖顯示 **2 張候選表、5 欄、1 個單欄 FK**。' },
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
  assert.match(run(er).join('\n'), /\btask\b/);
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
  const er = clone(ER);
  er.tables[1].columns[1].fk = 'nowhere';
  assert.match(run(er).join('\n'), /nowhere/);
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

test('a spec page with no entry at all is reported', () => {
  const pages = [{ code: '01-05', rel: 'specs/01-account/05-login-state.mdx', text: '## 規格\n\n### 資料欄位\n\n內容\n' }];
  assert.match(checkSpecEntries(ER_WITH_SOURCES, pages).join('\n'), /no 資料規劃入口/);
});

test('a page no table cites passes with an entry that names none', () => {
  const pages = [{ code: '07-01', rel: 'specs/07-shared/01-sidebar.mdx', text: entry('沒有任何一張表把本頁列為規格來源') }];
  assert.deepEqual(checkSpecEntries(ER_WITH_SOURCES, pages), []);
});
