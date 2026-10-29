// Regression tests for scripts/serve-prototype.mjs. Run: node --test scripts/tests/
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';

import { DEFAULT_PORT, resolvePort, resolveRequestPath } from '../serve-prototype.mjs';

const root = '/srv/prototype';

test('maps a page URL to a file under root', () => {
  assert.equal(
    resolveRequestPath(root, '/pages/admin/user-management.html?lang=en#top'),
    join(root, 'pages/admin/user-management.html'),
  );
});

test('decodes percent-encoded paths', () => {
  assert.equal(resolveRequestPath(root, '/assets/a%20b.svg'), join(root, 'assets/a b.svg'));
});

test('maps the bare root to root itself', () => {
  assert.equal(resolveRequestPath(root, '/'), root);
});

test('keeps dot segments that the URL parser folds inside root', () => {
  assert.equal(resolveRequestPath(root, '/%2e%2e/secret.txt'), join(root, 'secret.txt'));
});

test('rejects encoded slashes that escape root', () => {
  assert.equal(resolveRequestPath(root, '/..%2f..%2fetc/passwd'), null);
});

test('rejects a sibling directory that shares the root prefix', () => {
  assert.equal(resolveRequestPath(root, '/..%2fprototype-private/x.html'), null);
});

test('rejects malformed percent-encoding', () => {
  assert.equal(resolveRequestPath(root, '/%E0%A4%A'), null);
});

test('reads PROTOTYPE_PORT and falls back on invalid values', () => {
  assert.equal(resolvePort({ PROTOTYPE_PORT: '5000' }), 5000);
  assert.equal(resolvePort({}), DEFAULT_PORT);
  assert.equal(resolvePort({ PROTOTYPE_PORT: 'abc' }), DEFAULT_PORT);
  assert.equal(resolvePort({ PROTOTYPE_PORT: '70000' }), DEFAULT_PORT);
  assert.equal(resolvePort({ PROTOTYPE_PORT: '0' }), DEFAULT_PORT);
});
