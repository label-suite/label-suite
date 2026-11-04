#!/usr/bin/env node
// Structural checks for the PRD, glossary and module specs under docs/specs/.
// The writing rules live in .claude/skills/prd-writing/SKILL.md and
// .claude/skills/spec-writing/SKILL.md; this script enforces the parts of them
// that a machine can verify.
//
// Usage: node scripts/check-specs.mjs [docs-dir]   (default: docs)
//        node scripts/check-specs.mjs --extract-legacy <legacy spec.md>
// The first form exits 1 when any ERROR is reported. The second prints the
// IDs a legacy spec defines, one per line, to seed docs/specs/legacy/*.ids.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRD_PATH = 'specs/00-prd.mdx';
export const GLOSSARY_PATH = 'specs/glossary.mdx';

export const PRD_CHAPTERS = ['文件資訊', '專案概述', '使用者角色', '專案範圍', 'Site Map', '模組架構與串接', '術語'];

export const SPEC_CHAPTERS = [
  '目標',
  '使用角色',
  '業務流程',
  '規格',
  '卡控機制',
  '邊界情況（Edge Case）',
  '驗收標準',
  '待釐清',
  '已確認決議',
  '變更紀錄',
  'Q&A',
];

export const MAPPING_CHAPTER = '附錄：舊編號對照';
export const ACCEPTANCE_CHAPTER = '驗收標準';

// Transitional: files still in the pre-scaffold layout. They are skipped
// entirely until #32 moves them into docs/specs/; remove this list there.
export const LEGACY_PATHS = ['00-prd.mdx', 'specs/006-user-management.mdx'];

// docs/specs/NN-<module>/NN-<page>.mdx; index.mdx inside a module is not a spec.
const MODULE_DIR_RE = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SPEC_FILE_RE = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.mdx$/;

// FR-001, FR-004a, SC-012, AC-1.3: the numbering used by the legacy specs.
const ID_SOURCE = String.raw`(?:FR|SC)-\d{2,3}[A-Za-z]?|AC-\d+(?:\.\d+)+`;
const ID_RE = new RegExp(String.raw`^(?:${ID_SOURCE})$`);
const DELETED_MARK = '刪除';
const SCENARIO_PREFIX_RE = /^Scenario[：:]\s*/;

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

// Headings of the given depth with their line numbers.
function headings(text, depth) {
  const out = [];
  const re = new RegExp(String.raw`^#{${depth}} +(.+?)\s*$`, 'gm');
  let m;
  while ((m = re.exec(text)) !== null) out.push({ title: m[1], line: lineOf(text, m.index), index: m.index });
  return out;
}

export const chapters = (text) => headings(text, 2);

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
  const found = chapters(text);
  const i = found.findIndex((c) => c.title === title);
  if (i < 0) return null;
  return [found[i].index, found[i + 1]?.index ?? text.length];
}

// Heading anchors as NoteCraft renders them (github-slugger rules): lowercase,
// drop punctuation, spaces to "-", and a "-N" suffix for repeated headings.
export function slug(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} _-]/gu, '')
    .replace(/ /g, '-');
}

function anchors(text) {
  const seen = new Map();
  const out = new Set();
  for (const h of [1, 2, 3, 4, 5, 6].flatMap((d) => headings(text, d)).sort((a, b) => a.index - b.index)) {
    const base = slug(h.title);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n === 0 ? base : `${base}-${n}`);
  }
  return out;
}

// Every define/ref id, whatever its namespace; term.* ids are also resolved.
const DEF_ID_RE = /^:{3,}define\{[^}]*\bid="([^"]*)"/gm;
const REF_ID_RE = /(?<![:\\]):ref\[[^\]]*\]\{[^}]*\bid="([^"]*)"/g;
// Letters, digits, _ and -, in .-separated segments. NoteCraft fails the whole
// build on anything else, such as a space.
const ID_FORMAT_RE = /^[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*$/u;
// Glossary terms: term.<English kebab-case>, e.g. term.system-role.
const TERM_ID_RE = /^term\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

function checkTerms(files, glossaryRel, report) {
  const defined = new Map();
  const checkFormat = (f, id, line) => {
    if (!ID_FORMAT_RE.test(id)) {
      report.error(f.rel, line, `id "${id}" may only use letters, digits, _ and - in .-separated segments`);
    } else if (id.startsWith('term.') && !TERM_ID_RE.test(id)) {
      report.error(f.rel, line, `term id "${id}" must be term.<english-kebab-case>`);
    }
  };
  for (const f of files) {
    for (const m of f.text.matchAll(DEF_ID_RE)) {
      const line = lineOf(f.text, m.index);
      checkFormat(f, m[1], line);
      if (!m[1].startsWith('term.')) continue;
      if (f.rel !== glossaryRel) {
        report.error(f.rel, line, `term "${m[1]}" must be defined in ${glossaryRel}`);
      }
      if (defined.has(m[1])) {
        report.error(f.rel, line, `term "${m[1]}" is already defined in ${defined.get(m[1])}`);
      } else {
        defined.set(m[1], `${f.rel}:${line}`);
      }
    }
  }
  for (const f of files) {
    for (const m of f.text.matchAll(REF_ID_RE)) {
      const line = lineOf(f.text, m.index);
      checkFormat(f, m[1], line);
      if (m[1].startsWith('term.') && !defined.has(m[1])) {
        report.error(f.rel, line, `reference to undefined term "${m[1]}"`);
      }
    }
  }
}

export const FRONTMATTER_FIELDS = ['title', 'description', 'category', 'tags', 'createdAt', 'updatedAt'];
const DATE_FIELDS = ['createdAt', 'updatedAt'];
// NoteCraft drops a page whose dates YAML parses as Date objects, so they stay quoted strings.
const QUOTED_DATE_RE = /^(["'])\d{4}-\d{2}-\d{2}\1$/;

function checkFrontmatter(file, text, report) {
  const m = text.match(/^---\n([\s\S]*?)\n---[ \t]*$/m);
  if (!m || m.index !== 0) {
    report.error(file, 1, 'frontmatter is missing');
    return;
  }
  const fields = new Map();
  m[1].split('\n').forEach((raw, i) => {
    const f = raw.match(/^([A-Za-z]\w*):[ \t]*(.*?)\s*$/);
    if (f) fields.set(f[1], { value: f[2], line: i + 2 });
  });
  for (const name of FRONTMATTER_FIELDS) {
    if (!fields.has(name)) report.error(file, 1, `frontmatter field "${name}" is missing`);
  }
  for (const name of DATE_FIELDS) {
    const f = fields.get(name);
    if (f && !QUOTED_DATE_RE.test(f.value)) {
      report.error(file, f.line, `${name} must be a quoted "YYYY-MM-DD" string, got ${f.value || 'nothing'}`);
    }
  }
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

// Scenario names from the first column of the acceptance table, header excluded.
export function scenarios(text) {
  const range = chapterRange(text, ACCEPTANCE_CHAPTER);
  if (!range) return [];
  return tableRows(text, range[0], range[1])
    .slice(1)
    .map(({ cells, line }) => ({ name: cells[0] ?? '', line }));
}

function checkScenarios(file, text, report) {
  const seen = new Map();
  for (const { name, line } of scenarios(text)) {
    if (!name) {
      report.error(file, line, 'a Scenario row has no name');
      continue;
    }
    if (seen.has(name)) report.error(file, line, `Scenario "${name}" is already used on line ${seen.get(name)}`);
    else seen.set(name, line);
  }
  return new Set(seen.keys());
}

const LINK_RE = /^\[[^\]]*\]\(#([^)\s]+)\)$/;

function checkMapping(file, text, legacyIds, scenarioNames, report) {
  const mapping = chapterRange(text, MAPPING_CHAPTER);
  if (!legacyIds) {
    if (mapping) report.error(file, chapters(text).at(-1).line, `"## ${MAPPING_CHAPTER}" exists but there is no legacy ID list`);
    return;
  }
  if (!mapping) {
    report.error(file, 1, `legacy ID list exists but chapter "## ${MAPPING_CHAPTER}" is missing`);
    return;
  }

  const known = anchors(text.slice(0, mapping[0]));
  const covered = new Map();
  for (const { cells, line } of tableRows(text, mapping[0], mapping[1]).slice(1)) {
    const [old, target = '', note = ''] = cells;
    if (!ID_RE.test(old)) {
      report.error(file, line, `"${old}" is not a legacy ID (FR-NNN, SC-NNN or AC-N.N)`);
      continue;
    }
    if (!legacyIds.has(old)) report.error(file, line, `${old} is not in the legacy ID list`);
    if (covered.has(old)) report.error(file, line, `${old} is mapped twice (line ${covered.get(old)})`);
    covered.set(old, line);

    if (target === DELETED_MARK) {
      if (!note) report.error(file, line, `${old} is marked ${DELETED_MARK} without a reason`);
      continue;
    }
    const link = target.match(LINK_RE);
    if (link) {
      const anchor = decodeURIComponent(link[1]);
      if (!known.has(anchor)) report.error(file, line, `${old} links to #${anchor}, which is not a heading in this spec`);
      continue;
    }
    if (SCENARIO_PREFIX_RE.test(target)) {
      const name = target.replace(SCENARIO_PREFIX_RE, '');
      if (!scenarioNames.has(name)) report.error(file, line, `${old} maps to Scenario "${name}", which "## ${ACCEPTANCE_CHAPTER}" does not list`);
      continue;
    }
    report.error(file, line, `${old} maps to "${target}"; use a section link, "Scenario：<name>" or ${DELETED_MARK}`);
  }
  for (const id of legacyIds) {
    if (!covered.has(id)) report.error(file, 1, `legacy ${id} is missing from "## ${MAPPING_CHAPTER}"`);
  }
}

// Legacy IDs a legacy spec defines: a bold ID opening a list item
// ("- **FR-001**：", "1. **AC-1.1**：") or the first cell of a table row.
const LEGACY_DEF_RE = new RegExp(String.raw`^(?:\s*(?:[-*]|\d+\.) +\*\*(${ID_SOURCE})\*\*|\|\s*(${ID_SOURCE})\s*\|)`, 'gm');

export function legacyIdsIn(text) {
  const ids = new Set();
  for (const m of text.matchAll(LEGACY_DEF_RE)) ids.add(m[1] ?? m[2]);
  return ids;
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

// "02-task-management/01-task-list.mdx" -> "02-01-task-list" (legacy list name).
function specKind(path) {
  const parts = path.split('/');
  if (parts.length !== 3 || parts[0] !== 'specs') return null;
  const [, dir, file] = parts;
  if (!MODULE_DIR_RE.test(dir) || !SPEC_FILE_RE.test(file)) return null;
  return `${dir.slice(0, 2)}-${file.replace(/\.mdx$/, '')}`;
}

export function checkDocs(docsDir) {
  const errors = [];
  const report = { error: (file, line, msg) => errors.push(`${file}:${line}: ${msg}`) };

  const files = listMdx(docsDir)
    .map((p) => {
      const raw = readFileSync(p, 'utf8');
      const path = relative(docsDir, p).split(sep).join('/');
      return { path, rel: relative(process.cwd(), p), raw, text: stripIgnored(raw) };
    })
    .filter((f) => !LEGACY_PATHS.includes(f.path));

  for (const f of files) {
    if (f.path === PRD_PATH) {
      checkFrontmatter(f.rel, f.raw, report);
      checkChapterOrder(f.rel, f.text, PRD_CHAPTERS, null, report);
    } else if (f.path === GLOSSARY_PATH) {
      checkFrontmatter(f.rel, f.raw, report);
    } else {
      const legacyName = specKind(f.path);
      if (!legacyName) continue;
      checkFrontmatter(f.rel, f.raw, report);
      checkChapterOrder(f.rel, f.text, SPEC_CHAPTERS, MAPPING_CHAPTER, report);
      const names = checkScenarios(f.rel, f.text, report);
      const legacy = readLegacyIds(join(docsDir, 'specs', 'legacy', `${legacyName}.ids`));
      checkMapping(f.rel, f.text, legacy, names, report);
    }
  }
  checkTerms(files, relative(process.cwd(), join(docsDir, GLOSSARY_PATH)), report);
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === '--extract-legacy') {
  const text = stripIgnored(readFileSync(process.argv[3], 'utf8'));
  for (const id of legacyIdsIn(text)) console.log(id);
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'docs';
  const errors = checkDocs(dir);
  for (const e of errors) console.error(`ERROR ${e}`);
  if (errors.length > 0) process.exit(1);
  console.log(`check-specs: ${dir} OK`);
}
