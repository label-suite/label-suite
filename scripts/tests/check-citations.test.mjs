// Regression tests for scripts/check-citations.mjs. Run: node --test scripts/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { checkCitations, citationsIn, historicalLines } from '../check-citations.mjs';

// A throwaway repo: one prototype page and one design doc citing it, plus
// any extra files a test needs ({ path: text }).
function repo(doc, extra = {}, docPath = 'design/system/pages/a.md') {
  const root = mkdtempSync(join(tmpdir(), 'citations-'));
  const put = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  put('design/prototype/pages/a.html', ['<html>', '  <button class="btn-primary">Go</button>', '  <div class="toast"></div>', '</html>', ''].join('\n'));
  for (const [rel, text] of Object.entries(extra)) put(rel, text);
  put(docPath, doc);
  return checkCitations({ root, docs: [docPath] });
}

test('a citation whose line names the sentence verifies', () => {
  const r = repo('`.btn-primary`（`pages/a.html:2`）\n');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.stats.verified, 1);
});

test('a line past the end of the file is an error', () => {
  const r = repo('`.btn-primary`（`pages/a.html:9`）\n');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /outside design\/prototype\/pages\/a\.html \(4 lines\)/);
});

test('a missing file is an error', () => {
  const r = repo('`.btn-primary`（`pages/missing.html:2`）\n');
  assert.match(r.errors[0], /file not found: pages\/missing\.html/);
});

test('a bare :N with no file before it in its paragraph is an error', () => {
  const r = repo('`pages/a.html:2`\n\n`.toast`（`:3`）\n');
  assert.match(r.errors[0], /has no file before it/);
});

test('a bare :N reads against the file before it in the same unit', () => {
  const r = repo('`.btn-primary` 在 `pages/a.html:2`，`.toast` 在 `:3`。\n');
  assert.deepEqual(r.errors, []);
  assert.equal(r.stats.citations, 2);
});

test('a line that names nothing in its sentence only warns', () => {
  const r = repo('`.toast`（`pages/a.html:2`）\n');
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
});

test('a range joins `a.html:2`–`:3` into one citation', () => {
  const [c] = citationsIn('`pages/a.html:2`–`:3`');
  assert.equal(c.from, 2);
  assert.equal(c.to, 3);
});

test('times, ratios and pseudo-classes are not citations', () => {
  assert.deepEqual(citationsIn('16:24、4.5:1、a:hover'), []);
});

test('a section pinned to a commit is historical and skipped', () => {
  const doc = ['### 盤點', '', '行號仍是 `eb9a884` 的位置。', '', '`.toast`（`pages/a.html:99`）', ''].join('\n');
  assert.ok(historicalLines(doc).has(5));
  const r = repo(doc);
  assert.deepEqual(r.errors, []);
  assert.equal(r.stats.historical, 1);
});

test('a Chinese label in 「」 is a token, and a wrong line for it warns', () => {
  const extra = { 'design/prototype/pages/b.html': ["label: '移除頭像',", "other: '取消',", ''].join('\n') };
  assert.equal(repo('移除鈕寫「移除頭像」（`pages/b.html:1`）\n', extra).stats.verified, 1);
  assert.equal(repo('移除鈕寫「移除頭像」（`pages/b.html:2`）\n', extra).warnings.length, 1);
});

test('『』 inside a quote matches 「」 in the cited line', () => {
  const extra = { 'design/prototype/pages/b.html': "text: '回到「密碼設定」重新設定',\n" };
  assert.equal(repo('例：「回到『密碼設定』重新設定」（`pages/b.html:1`）\n', extra).stats.verified, 1);
});

test('a percentage in the sentence is a token', () => {
  const extra = { 'design/prototype/pages/b.css': ['a { background: color-mix(in srgb, red 12%, white); }', 'b { color: red; }', ''].join('\n') };
  assert.equal(repo('混色比例 12%（`pages/b.css:1`）\n', extra).stats.verified, 1);
  assert.equal(repo('混色比例 12%（`pages/b.css:2`）\n', extra).warnings.length, 1);
});

test('a kebab-case script name finds its camel-case export', () => {
  const extra = { 'design/prototype/pages/modal-focus.js': ['// helper', 'window.LabelSuiteModalFocus = {};', ''].join('\n') };
  assert.equal(repo('焦點由 `modal-focus.js` 處理（`pages/modal-focus.js:2`）\n', extra).stats.verified, 1);
  assert.equal(repo('焦點由 `modal-focus.js` 處理（`pages/modal-focus.js:1`）\n', extra).warnings.length, 1);
});

test('`<style>` is met by a line inside that element only', () => {
  const extra = { 'design/prototype/pages/b.html': ['<style>', '  .x { color: red; }', '</style>', '<p>x</p>', ''].join('\n') };
  assert.equal(repo('本頁 `<style>` 重寫（`pages/b.html:2`）\n', extra).stats.verified, 1);
  assert.equal(repo('本頁 `<style>` 重寫（`pages/b.html:4`）\n', extra).warnings.length, 1);
});

test('`<span>` is met by the CSS selector that styles it', () => {
  const extra = { 'design/prototype/pages/b.css': ['.metric span {', '  color: red;', '}', ''].join('\n') };
  assert.equal(repo('標籤用 `<span>`（`pages/b.css:1`）\n', extra).stats.verified, 1);
  assert.equal(repo('標籤用 `<span>`（`pages/b.css:2`）\n', extra).warnings.length, 1);
});

test('a design token is met by its light-theme value from tokens.css', () => {
  const extra = {
    'design/prototype/assets/tokens.css': [':root {', '  --color-ink: #1E1B4B;', '}', 'html[data-theme="dark"] { --color-ink: #E2E8F0; }', ''].join('\n'),
    'design/prototype/assets/logo.svg': ['<svg>', '<text fill="#1E1B4B">L</text>', '<text fill="#E2E8F0">L</text>', '</svg>', ''].join('\n'),
  };
  assert.equal(repo('字標用 `--color-ink`（`assets/logo.svg:2`）\n', extra).stats.verified, 1);
  assert.equal(repo('字標用 `--color-ink`（`assets/logo.svg:3`）\n', extra).warnings.length, 1);
});

test('a usage row in a component doc is met by the component slug', () => {
  const extra = { 'design/prototype/pages/b.html': ['<span class="badge">x</span>', '<p>y</p>', ''].join('\n') };
  const row = (n) => `| \`task-management/task-list#state-default\` | 樣本（\`pages/b.html:${n}\`） |\n`;
  assert.equal(repo(row(1), extra, 'design/system/components/badge.md').stats.verified, 1);
  assert.equal(repo(row(2), extra, 'design/system/components/badge.md').warnings.length, 1);
  // Outside a component doc the slug means nothing.
  assert.equal(repo(row(1), extra, 'design/system/pages/x.md').warnings.length, 1);
});
