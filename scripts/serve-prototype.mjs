#!/usr/bin/env node
// Static server for design/prototype/, so docs/specs/*.mdx can embed its pages
// as wireframes with <iframe>. NoteCraft cannot serve the prototype itself: its
// /notes-assets/ route only covers files under docs/, and it sends .html, .js and
// .css as application/octet-stream.
//
// Usage: node scripts/serve-prototype.mjs   (PROTOTYPE_PORT overrides 4331)
// Binds to 127.0.0.1 only; the prototype is a local design reference.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PORT = 4331;
export const ROOT = resolve(fileURLToPath(new URL('../design/prototype', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
};

// Map a request URL to a file under root, or null when it escapes root.
export function resolveRequestPath(root, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return null;
  }
  const target = resolve(join(root, pathname));
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}

export function resolvePort(env = process.env) {
  const parsed = Number(env.PROTOTYPE_PORT);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : DEFAULT_PORT;
}

async function handle(req, res) {
  let file = resolveRequestPath(ROOT, req.url ?? '/');
  if (!file) {
    res.writeHead(400).end('bad path');
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = resolvePort();
  createServer(handle).listen(port, '127.0.0.1', () => {
    console.log(`prototype: http://127.0.0.1:${port}/`);
  });
}
