// Regression tests for scripts/check-citations.mjs. Run: node --test scripts/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { checkCitations, citationsIn, historicalLines } from '../check-citations.mjs';

// A throwaway repo: one prototype page and one design doc citing it.
function repo(doc) {
  const root = mkdtempSync(join(tmpdir(), 'citations-'));
  const put = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  put('design/prototype/pages/a.html', ['<html>', '  <button class="btn-primary">Go</button>', '  <div class="toast"></div>', '</html>', ''].join('\n'));
  put('design/system/pages/a.md', doc);
  return checkCitations({ root, docs: ['design/system/pages/a.md'] });
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
