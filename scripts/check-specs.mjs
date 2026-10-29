#!/usr/bin/env node
// Structural checks for docs/00-prd.mdx and docs/specs/NNN-*.mdx.
// The writing rules live in .claude/skills/spec-writing/SKILL.md; this script
// enforces the parts of them that a machine can verify.
//
// Usage: node scripts/check-specs.mjs [docs-dir]   (default: docs)
//        node scripts/check-specs.mjs --extract-legacy <legacy spec.md>
// The first form exits 1 when any ERROR is reported. The second prints the
// IDs a legacy spec defines, one per line, to seed docs/specs/legacy/*.ids.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRD_CHAPTERS = [
  '文件資訊',
  '專案概述',
  '使用者角色',
  '專案範圍',
  '網站地圖',
  '業務流程',
  '規格說明',
  '非功能需求',
  '外部整合與依賴',
  '時程',
  '技術選型',
  '術語表',
  '待釐清事項',
  '變更紀錄',
];

export const SPEC_CHAPTERS = [
  '目標',
  '使用權限',
  '操作流程',
  '資料模型',
  '規格',
  '卡控機制',
  '驗收標準',
  '待釐清',
  '決策紀錄',
];

export const MAPPING_CHAPTER = '附錄：舊條文對照';

// FR-001, FR-004a, SC-012, AC-1.3: the numbering inherited from the legacy specs.
const ID_SOURCE = String.raw`(?:FR|SC)-\d{2,3}[A-Za-z]?|AC-\d+(?:\.\d+)+`;
const ID_RE = new RegExp(String.raw`\b(?:${ID_SOURCE})\b`, 'g');
const SPEC_FILE_RE = /^\d{3}-[a-z0-9-]+\.mdx$/;
const DELETED_MARK = '刪除';

// Blank out fenced code and MDX comments so examples inside them are not
// checked, while keeping line numbers stable for the report.
export function stripIgnored(text) {
  const blank = (s) => s.replace(/[^\n]/g, '');
  return text
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, blank)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank);
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// H2 headings with their line numbers; a leading "N. " is dropped so the PRD
// can number its chapters.
export function chapters(text) {
  const out = [];
  const re = /^## +(.+?)\s*$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ title: m[1].replace(/^\d+\.\s*/, ''), line: lineOf(text, m.index) });
  }
  return out;
}

function checkChapterOrder(file, text, expected, allowedTail, report) {
  const found = chapters(text);
  const titles = found.map((c) => c.title);
  const tail = allowedTail && titles.at(-1) === allowedTail ? 1 : 0;
  const body = titles.slice(0, titles.length - tail);

  for (const name of expected) {
    if (!body.includes(name)) report.error(file, 1, `missing chapter "## ${name}"`);
  }
  for (const c of found.slice(0, found.length - tail)) {
    if (!expected.includes(c.title)) report.error(file, c.line, `unexpected chapter "## ${c.title}"`);
  }
  const present = body.filter((t) => expected.includes(t));
  const order = expected.filter((t) => present.includes(t));
  if (present.join('\n') !== order.join('\n')) {
    report.error(file, 1, `chapters out of order; expected: ${order.join(' > ')}`);
  }
}

// Slice of text belonging to one H2 chapter, as [start, end) offsets.
function chapterRange(text, title) {
  const re = /^## +(.+?)\s*$/gm;
  let m;
  let start = -1;
  while ((m = re.exec(text)) !== null) {
    const t = m[1].replace(/^\d+\.\s*/, '');
    if (start >= 0) return [start, m.index];
    if (t === title) start = m.index;
  }
  return start >= 0 ? [start, text.length] : null;
}

const TERM_DEF_RE = /^:{3,}define\{[^}]*\bid="(term\.[^"]+)"/gm;
const TERM_REF_RE = /(?<![:\\]):ref\[[^\]]*\]\{[^}]*\bid="(term\.[^"]+)"/g;

function checkTerms(files, report) {
  const defined = new Map();
  for (const f of files) {
    for (const m of f.text.matchAll(TERM_DEF_RE)) {
      const line = lineOf(f.text, m.index);
      if (defined.has(m[1])) {
        report.error(f.rel, line, `term "${m[1]}" is already defined in ${defined.get(m[1])}`);
      } else {
        defined.set(m[1], `${f.rel}:${line}`);
      }
    }
  }
  for (const f of files) {
    for (const m of f.text.matchAll(TERM_REF_RE)) {
      if (!defined.has(m[1])) {
        report.error(f.rel, lineOf(f.text, m.index), `reference to undefined term "${m[1]}"`);
      }
    }
  }
}

// An ID is defined where it opens a list item in bold ("- **FR-001**：",
// "1. **AC-1.1**：") or fills the first cell of a table row ("| AC-1.1 | ...").
const DEF_RE = new RegExp(String.raw`^(?:\s*(?:[-*]|\d+\.) +\*\*(${ID_SOURCE})\*\*|\|\s*(${ID_SOURCE})\s*\|)`, 'gm');

export function definedIds(text) {
  const ids = new Map();
  for (const m of text.matchAll(DEF_RE)) {
    const id = m[1] ?? m[2];
    if (!ids.has(id)) ids.set(id, []);
    ids.get(id).push(lineOf(text, m.index));
  }
  return ids;
}

function tableRows(text, start, end) {
  const rows = [];
  const lines = text.slice(start, end).split('\n');
  const first = lineOf(text, start);
  lines.forEach((raw, i) => {
    if (!/^\s*\|/.test(raw) || /^\s*\|[\s:|-]+\|\s*$/.test(raw)) return;
    const cells = raw.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    rows.push({ cells, line: first + i });
  });
  return rows;
}

function checkSpecIds(file, text, legacyIds, report) {
  const mapping = chapterRange(text, MAPPING_CHAPTER);
  const scanned = mapping ? text.slice(0, mapping[0]) : text;
  const ids = definedIds(scanned);

  for (const [id, lines] of ids) {
    if (lines.length > 1) report.error(file, lines[1], `${id} is defined more than once (lines ${lines.join(', ')})`);
  }

  if (!legacyIds) return;
  if (!mapping) {
    report.error(file, 1, `legacy ID list exists but chapter "## ${MAPPING_CHAPTER}" is missing`);
    return;
  }

  const covered = new Map();
  const rows = tableRows(text, mapping[0], mapping[1]);
  for (const { cells, line } of rows.slice(1)) {
    const [old, target = '', note = ''] = cells;
    if (!old.match(ID_RE)) continue;
    if (!legacyIds.has(old)) report.error(file, line, `${old} is not in the legacy ID list`);
    if (covered.has(old)) report.error(file, line, `${old} is mapped twice (line ${covered.get(old)})`);
    covered.set(old, line);

    if (target.includes(DELETED_MARK)) {
      if (!note) report.error(file, line, `${old} is marked ${DELETED_MARK} without a reason`);
      continue;
    }
    const targets = target.match(ID_RE) ?? [];
    if (targets.length === 0 && !SPEC_CHAPTERS.includes(target)) {
      report.error(file, line, `${old} maps to "${target}", which is neither a defined ID, a chapter, nor ${DELETED_MARK}`);
    }
    for (const t of targets) {
      if (!ids.has(t)) report.error(file, line, `${old} maps to ${t}, which this spec does not define`);
    }
  }
  for (const id of legacyIds) {
    if (!covered.has(id)) report.error(file, 1, `legacy ${id} is missing from "## ${MAPPING_CHAPTER}"`);
  }
}

export function readLegacyIds(path) {
  if (!existsSync(path)) return null;
  const ids = readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean);
  return new Set(ids);
}

function listMdx(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return listMdx(p);
    return name.endsWith('.mdx') ? [p] : [];
  });
}

export function checkDocs(docsDir) {
  const errors = [];
  const report = { error: (file, line, msg) => errors.push(`${file}:${line}: ${msg}`) };

  const files = listMdx(docsDir).map((p) => ({
    path: p,
    rel: relative(process.cwd(), p),
    text: stripIgnored(readFileSync(p, 'utf8')),
  }));

  for (const f of files) {
    const name = basename(f.path);
    if (f.path === join(docsDir, '00-prd.mdx')) {
      checkChapterOrder(f.rel, f.text, PRD_CHAPTERS, null, report);
    } else if (f.path === join(docsDir, 'specs', name) && SPEC_FILE_RE.test(name)) {
      checkChapterOrder(f.rel, f.text, SPEC_CHAPTERS, MAPPING_CHAPTER, report);
      const legacy = readLegacyIds(join(docsDir, 'specs', 'legacy', name.replace(/\.mdx$/, '.ids')));
      checkSpecIds(f.rel, f.text, legacy, report);
    }
  }
  checkTerms(files, report);
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === '--extract-legacy') {
  const text = stripIgnored(readFileSync(process.argv[3], 'utf8'));
  for (const id of definedIds(text).keys()) console.log(id);
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'docs';
  const errors = checkDocs(dir);
  for (const e of errors) console.error(`ERROR ${e}`);
  if (errors.length > 0) process.exit(1);
  console.log(`check-specs: ${dir} OK`);
}
