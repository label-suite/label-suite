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
import { join, posix, relative, sep } from 'node:path';
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

// docs/specs/NN-<module>/NN-<page>.mdx; index.mdx inside a module is not a spec.
const MODULE_DIR_RE = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SPEC_FILE_RE = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.mdx$/;

// The numbering the legacy specs actually use: FR-001, FR-004a, FR-004aaa,
// FR-0010, FR-002c-1, FR-009A1, FR-024A-1, SC-003aa, AC-1.3, AC-2A.1,
// AC-2A.2a, AC-3.1A.
const ID_SOURCE = String.raw`(?:FR|SC)-\d{2,4}[A-Za-z]{0,3}\d*(?:-\d+)?|AC-\d+[A-Za-z]?(?:\.\d+[A-Za-z]?)+`;
// A page that collects two legacy sources prefixes each ID with its source
// ("shared:FR-001", "foundation:FR-001"), so same-named IDs stay distinct.
const SOURCE_PREFIX = String.raw`(?:[a-z][a-z0-9-]*:)?`;
const ID_RE = new RegExp(String.raw`^${SOURCE_PREFIX}(?:${ID_SOURCE})$`);
const DELETED_MARK = '刪除';
const SCENARIO_PREFIX_RE = /^Scenario[：:]\s*/;

// Blank out fenced code, MDX comments and inline code so examples inside them
// are not checked, while keeping line numbers stable for the report. Headings
// keep their inline code, since it is part of the rendered anchor.
export function stripIgnored(text) {
  const blank = (s) => s.replace(/[^\n]/g, '');
  return text
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, blank)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
    .replace(/^(?!#{1,6} ).*$/gm, (line) => line.replace(/(`+)[^`\n]+?\1/g, (s) => ' '.repeat(s.length)));
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
//
// A heading may itself be a link, and NoteCraft slugs the rendered text, not
// the markdown. Keeping the raw source here pulled the URL into the anchor, so
// every link to such a heading was reported broken while the built page worked.
export function slug(title) {
  return title
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
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
// The same define, read for its label so a reference can be held to it.
// Directive attributes are unordered, so the brace body is read whole and each
// attribute picked out of it; keying on id-then-label missed label-first ones.
const DEF_ATTRS_RE = /^:{3,}define\{([^}\n]*)/gm;
const attrOf = (attrs, name) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const REF_ID_RE = /(?<![:\\]):ref\[([^\]]*)\]\{[^}]*\bid="([^"]*)"/g;
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
  // Labels, so a reference can be held to the wording the glossary settled on.
  // A term.* label is the glossary's to settle (any other definition of one is
  // already an error above) and the first definition of any other id wins, so a
  // stray copy cannot turn every correct reference into a mismatch.
  const labels = new Map();
  for (const f of files) {
    for (const m of f.text.matchAll(DEF_ATTRS_RE)) {
      const id = attrOf(m[1], 'id');
      const label = attrOf(m[1], 'label');
      if (id === undefined || label === undefined) continue;
      if (id.startsWith('term.') && f.rel !== glossaryRel) continue;
      if (!labels.has(id)) labels.set(id, label);
    }
  }
  for (const f of files) {
    for (const m of f.text.matchAll(REF_ID_RE)) {
      const [, display, id] = m;
      const line = lineOf(f.text, m.index);
      checkFormat(f, id, line);
      if (id.startsWith('term.') && !defined.has(id)) {
        report.error(f.rel, line, `reference to undefined term "${id}"`);
        continue;
      }
      // A reference that renames the term quietly forks the vocabulary: the
      // glossary says one thing and the page says another, and check:specs used
      // to pass because the id resolved (#150).
      // The display text has to be the bare label: emphasis or padding around it
      // renders differently, so it is a rename like any other.
      const label = labels.get(id);
      if (label !== undefined && display !== label) {
        report.error(f.rel, line, `ref text "${display}" does not match the label "${label}" of ${id}`);
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
// A legacy spec split across two pages points at the other one: "見 規格 04-02".
const CROSS_PAGE_RE = /^見\s*§?規格\s*(\d{2}-\d{2})(?:\s+§.+)?$/;

function checkMapping(file, text, legacyIds, scenarioNames, specNumbers, self, report) {
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
      report.error(file, line, `"${old}" is not a legacy ID (FR-NNN, SC-NNN, AC-N.N, optionally "<source>:" prefixed)`);
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
    const cross = target.match(CROSS_PAGE_RE);
    if (cross) {
      const [, number] = cross;
      if (number === self) report.error(file, line, `${old} maps to 規格 ${number}, which is this spec; point at a section instead`);
      else if (!specNumbers.has(number)) report.error(file, line, `${old} maps to 規格 ${number}, which does not exist`);
      continue;
    }
    report.error(file, line, `${old} maps to "${target}"; use a section link, "Scenario：<name>", "見 規格 NN-NN" or ${DELETED_MARK}`);
  }
  for (const id of legacyIds) {
    if (!covered.has(id)) report.error(file, 1, `legacy ${id} is missing from "## ${MAPPING_CHAPTER}"`);
  }
}

// Legacy IDs a legacy spec defines: a bold ID opening a list item
// ("- **FR-001**：", "1. **AC-1.1**：") or the first cell of a table row.
// The bold header may carry a version note, which the legacy specs add instead
// of deleting superseded clauses: "**AC-1.10（v4.2.0 廢止）**". Those notes nest
// parentheses ("約束（a）～（c）"), so the note is anything up to the closing "**".
const DEF_NOTE = String.raw`[^*\n]*`;
const LEGACY_DEF_RE = new RegExp(
  String.raw`^(?:\s*(?:[-*]|\d+\.) +\*\*(${ID_SOURCE})${DEF_NOTE}\*\*|\|\s*(${ID_SOURCE})\s*\|)`,
  'gm',
);

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

// "02-task-management/01-task-list.mdx" -> the reference number "02-01" and
// the legacy list name "02-01-task-list"; null when the path is not a spec.
function specParts(path) {
  const parts = path.split('/');
  if (parts.length !== 3 || parts[0] !== 'specs') return null;
  const [, dir, file] = parts;
  if (!MODULE_DIR_RE.test(dir) || !SPEC_FILE_RE.test(file)) return null;
  const module = dir.slice(0, 2);
  return { number: `${module}-${file.slice(0, 2)}`, legacyName: `${module}-${file.replace(/\.mdx$/, '')}` };
}

// Links of the form "](path.mdx#anchor)" and "](#anchor)": the target file must
// exist and the anchor must match one of its headings. Neither check:specs' own
// chapter checks nor the site build verify this, so a renamed heading silently
// leaves dead links behind (#129).
//
// Deliberately narrow, so that what it does check, it checks exactly:
//   - only inline "](...)" links, and only those whose target is empty
//     (same file) or ends in ".mdx"; an external URL or an asset may carry a
//     fragment that means nothing here
//   - only ".mdx" source files, since that is what listMdx walks
// Reference-style links, bare <a href>, links carrying a title, links split
// across lines, angle-bracket targets and extension-less in-site links are all
// skipped. Writing a link one of those ways therefore bypasses this check.
const ANCHOR_LINK_RE = /\]\(([^)\s#]*)#([^)\s]+)\)/g;
// The same links written without a fragment: the target still has to exist.
const PLAIN_LINK_RE = /\]\(([^)\s#]+\.mdx)\)/g;

// A fragment copied from the browser's address bar arrives percent-encoded, and
// every anchor here is Chinese, so compare against the decoded form.
function decodeAnchor(anchor) {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return anchor;
  }
}

function checkAnchorLinks(files, report) {
  const known = new Set(files.map((f) => f.path));
  const anchorsOf = new Map(files.map((f) => [f.path, anchors(f.text)]));
  for (const f of files) {
    const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
    for (const m of f.text.matchAll(ANCHOR_LINK_RE)) {
      const [, target, anchor] = m;
      if (target !== '' && !target.endsWith('.mdx')) continue;
      const line = lineOf(f.text, m.index);
      const where = target === '' ? f.path : posix.normalize(posix.join(dir, target));
      if (target !== '' && !known.has(where)) {
        report.error(f.rel, line, `link target "${target}" does not exist`);
        continue;
      }
      if (!anchorsOf.get(where).has(decodeAnchor(anchor))) {
        report.error(f.rel, line, `link anchor "${target}#${anchor}" has no matching heading in ${where}`);
      }
    }
    for (const m of f.text.matchAll(PLAIN_LINK_RE)) {
      const [, target] = m;
      const where = posix.normalize(posix.join(dir, target));
      if (!known.has(where)) report.error(f.rel, lineOf(f.text, m.index), `link target "${target}" does not exist`);
    }
  }
}

// "### Q12." question headings. The number is how the page is cited elsewhere;
// it is append-only and never reused, so two of the same in one page make any
// tool that locates a question by its number work on the wrong one in silence
// (#131 landed a settled decision in the wrong chapter exactly this way).
const QUESTION_RE = /^#{3} +(Q\d+)\./gm;
// A page citing a question: a link to the chapter, then the numbers. Only the
// numbers written directly after the link are resolved, joined by nothing but
// the list punctuation below — a full-width comma or semicolon ends the clause,
// so a number past one belongs to a different thought and is not attributed to
// this link.
const QUESTION_CITE_RE = /\]\(([^)\s#]*)#([^)\s]+)\)((?:[ 、與和]*Q\d+)+)/g;
// The same citation written as a row of the open-questions index, where the
// number sits in its own cell *before* the link and so is invisible to the
// regex above. The row carries the page twice, which is itself worth checking.
const QUESTION_ROW_RE = /^\|\s*(\d{2}-\d{2}) +(Q\d+)\s*\|.*$/gm;
// Still uncovered: a citation written without a link at all ("見該頁 §已確認決議
// Q10"). There the page really cannot be read off the text, so resolving it
// would mean guessing which page "該頁" is.
const QUESTION_CHAPTERS = ['待釐清', '已確認決議'];

function checkQuestions(files, report) {
  const known = new Set(files.map((f) => f.path));
  // Every question number in a page, with the chapter and line it sits in. Two
  // pages' numbers are unrelated, so this is kept per page.
  const questionsOf = new Map();
  // Which of the two chapters a page has at all: a page missing one is
  // checkAnchorLinks' error, not a missing-question error here.
  const chaptersOf = new Map();
  for (const f of files) {
    const found = new Map();
    for (const chapter of QUESTION_CHAPTERS) {
      const range = chapterRange(f.text, chapter);
      if (!range) continue;
      for (const m of f.text.slice(range[0], range[1]).matchAll(QUESTION_RE)) {
        const line = lineOf(f.text, range[0] + m.index);
        if (!found.has(m[1])) found.set(m[1], []);
        found.get(m[1]).push({ chapter, line });
      }
    }
    questionsOf.set(f.path, found);
    chaptersOf.set(f.path, new Set(QUESTION_CHAPTERS.filter((c) => chapterRange(f.text, c))));
    for (const [q, at] of found) {
      if (at.length < 2) continue;
      // Every occurrence is reported: a tool reading only the first one is the
      // failure this check exists to catch, so the report must not do the same.
      const where = at.map((a) => `§${a.chapter}:${a.line}`).join(', ');
      for (const a of at) {
        report.error(f.rel, a.line, `question number "${q}" is used ${at.length} times in this page (${where})`);
      }
    }
  }
  for (const f of files) {
    const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
    // Where a link in this file points, or null when nothing here should judge it.
    const resolve = (target, chapter) => {
      if (!QUESTION_CHAPTERS.includes(chapter)) return null;
      if (target !== '' && !target.endsWith('.mdx')) return null;
      const where = target === '' ? f.path : posix.normalize(posix.join(dir, target));
      // A target or an anchor that does not exist is checkAnchorLinks' to report.
      if (!known.has(where) || !chaptersOf.get(where).has(chapter)) return null;
      return where;
    };
    const check = (where, chapter, q, line) => {
      if (!questionsOf.get(where).get(q)?.some((a) => a.chapter === chapter)) {
        report.error(f.rel, line, `"${q}" is not in §${chapter} of ${where}`);
      }
    };
    for (const m of f.text.matchAll(QUESTION_CITE_RE)) {
      const [, target, anchor, cited] = m;
      const chapter = decodeAnchor(anchor);
      const where = resolve(target, chapter);
      if (!where) continue;
      const line = lineOf(f.text, m.index);
      for (const q of cited.match(/Q\d+/g)) check(where, chapter, q, line);
    }
    for (const m of f.text.matchAll(QUESTION_ROW_RE)) {
      const [row, number, q] = m;
      // The row names its own page in its last cell. An earlier cell may cite
      // another page's chapter — that citation is prose, caught by the loop
      // above — so the row's own link is the last one, not the first.
      const link = [...row.matchAll(ANCHOR_LINK_RE)].filter((l) => QUESTION_CHAPTERS.includes(decodeAnchor(l[2]))).at(-1);
      if (!link) continue;
      const chapter = decodeAnchor(link[2]);
      const where = resolve(link[1], chapter);
      if (!where) continue;
      const line = lineOf(f.text, m.index);
      if (specParts(where)?.number !== number) {
        report.error(f.rel, line, `row names 規格 ${number} but links to ${where}`);
        continue;
      }
      check(where, chapter, q, line);
    }
  }
}

// "規格 03-03 任務詳情（未撰寫）" and its variants. Each migrated page leaves
// these behind in the pages that referenced it, and nothing notices: a reader
// who sees "未撰寫" does not go looking for a page that has in fact shipped
// (#150). The spec number may sit before or after the page name and the 規格
// prefix is optional, so this looks backwards from 未撰寫 for a number rather
// than matching one fixed phrasing.
//
// 00-prd.mdx is left out on purpose: it is maintained by the prd-writing skill,
// not by spec migration, and its own stale markers are tracked in #85.
// The claim is written several ways, so match them all; a page that has shipped
// is just as badly described by 還沒撰寫 as by 未撰寫.
const UNWRITTEN_RE = /(未撰寫|還沒撰寫|尚未撰寫)/g;
// How far back to look for the number. Clamped to the containing line, so the
// window never reaches into the line above or across a blanked code fence.
const UNWRITTEN_LOOKBACK = 24;
// A spec number, rejecting the MM-DD tail of a date such as 2026-02-01.
const SPEC_NUMBER_NEAR_RE = /(?<![\d-])(\d{2}-\d{2})(?![\d-])/g;

function checkStaleUnwritten(files, specPathByNumber, report) {
  for (const f of files) {
    // 00-prd.mdx is maintained by the prd-writing skill, not by spec migration,
    // and its own stale markers are tracked in #85.
    if (f.path === PRD_PATH) continue;
    for (const m of f.text.matchAll(UNWRITTEN_RE)) {
      const at = m.index;
      const lineStart = f.text.lastIndexOf('\n', at) + 1;
      const before = f.text.slice(Math.max(at - UNWRITTEN_LOOKBACK, lineStart), at);
      const seen = new Set();
      for (const n of before.matchAll(SPEC_NUMBER_NEAR_RE)) {
        const number = n[1];
        if (seen.has(number)) continue;
        seen.add(number);
        const target = specPathByNumber.get(number);
        if (target) report.error(f.rel, lineOf(f.text, at), `spec ${number} is called ${m[1]} but ${target} exists`);
      }
    }
  }
}

// --- the basis of a settled decision (#90) -----------------------------------

// Unlike the other checks this one reads the raw text: a legacy ID is almost
// always written as inline code, and stripIgnored blanks that, which would hide
// the strongest basis there is.
// 「已確認決議」 may only rest on a basis the migration document's general rule 4
// lists, plus the writing method the maintainer added on 2026-11-09 (#203); that
// document's own table is updated by the same issue. This does not judge whether the stated basis holds —
// that still needs a reader — it only fails a decision that names none at all,
// which is how the same rule was broken three times in a row (#67, #68, #69).
const SETTLED_CHAPTER = '已確認決議';
const DECISION_RE = /^#{3} +(Q\d+)\./gm;

const SOURCE_WORD = /來源|舊規格/;
const SOURCE_ARTEFACT = /Clarification|釐清紀錄|拍板|明寫|明訂|定成|定義|條文|規格常數|行為規則|使用者故事|舊編號|逐字/;
const LEGACY_ID = /(?:FR|SC|AC)-\d/;
const METHOD_DOC = /spec-writing|搬移設計文件/;
// 鐵律 covers technical vocabulary and 非目標 covers technical design, so
// neither reaches a decision about layout or button order. The rule that does
// is the skill's 「畫面長相以 prototype 為準」, so citing it has to count too
// (#203): otherwise the check pushes a writer toward a rule that does not
// actually govern the decision.
const METHOD_RULE = /鐵律|非目標|黑名單|以 prototype 為準/;
const DATE = String.raw`\d{4}-\d{2}-\d{2}`;

// Naming a basis only to say it is absent is not a citation. 「舊規格沒有定義這
// 一條，由我自己判斷」 mentions the source and what it would have defined, and
// without this the co-occurrence below would read it as a source citation.
const DENIAL = /(?:PRD|術語表|來源|舊規格|舊來源)[^。\n]{0,12}(?:沒有|沒寫|沒說|未寫|未定義|不存在|從來沒|並未)/g;
const withoutDenials = (text) => text.replace(DENIAL, (s) => ' '.repeat(s.length));

const BASES = [
  // PRD or the glossary, both already settled elsewhere.
  (t) => /PRD/.test(t) || /術語表/.test(t),
  // A cross-page decision of the migration document itself: D1 to D10.
  (t) => /(?<![A-Za-z0-9])D(?:10|[1-9])(?![0-9])/.test(t),
  // This page's own source: a legacy ID, or the source plus what it settled.
  (t) => LEGACY_ID.test(t) || (SOURCE_WORD.test(t) && SOURCE_ARTEFACT.test(t)),
  // The maintainer, with the date the ruling was given.
  (t) => new RegExp(`維護者[^。\\n]{0,30}${DATE}|${DATE}[^。\\n]{0,20}維護者`).test(t),
  // The writing method, which settles what belongs in a spec at all rather than
  // how the product behaves (maintainer ruling 2026-11-09, #203). Both halves
  // are required, like the source basis above: name the document that carries
  // the rule, and name the kind of rule. A bare 「非目標」 in a question title
  // with 「我自己判斷」 for a reason is exactly what this check exists to fail.
  (t) => METHOD_DOC.test(t) && METHOD_RULE.test(t),
  // An admitted gap, which must name the issue that tracks it. This keeps a
  // missing basis visible instead of letting it read as settled.
  (t) => /依據待補[^。\n]{0,20}#\d+/.test(t),
];

function checkDecisionBases(file, text, report) {
  const range = chapterRange(text, SETTLED_CHAPTER);
  if (!range) return;
  const chapter = text.slice(range[0], range[1]);
  const found = [...chapter.matchAll(DECISION_RE)];
  for (const [i, m] of found.entries()) {
    const end = i + 1 < found.length ? found[i + 1].index : chapter.length;
    const block = chapter.slice(m.index, end);
    if (BASES.some((has) => has(withoutDenials(block)))) continue;
    report.error(
      file,
      lineOf(text, range[0] + m.index),
      `decision "${m[1]}" states no basis; cite the PRD or the glossary, a D rule of the migration document, this page's source, a dated maintainer ruling, or the writing method (name spec-writing or the migration document, and the 鐵律 or 非目標 you cite)`,
    );
  }
}

export function checkDocs(docsDir) {
  const errors = [];
  const report = { error: (file, line, msg) => errors.push(`${file}:${line}: ${msg}`) };

  const files = listMdx(docsDir)
    .map((p) => {
      const raw = readFileSync(p, 'utf8');
      const path = relative(docsDir, p).split(sep).join('/');
      return { path, rel: relative(process.cwd(), p), raw, text: stripIgnored(raw) };
    });

  const specNumbers = new Set(files.map((f) => specParts(f.path)?.number).filter(Boolean));
  const specPathByNumber = new Map(
    files.flatMap((f) => {
      const n = specParts(f.path)?.number;
      return n ? [[n, f.path]] : [];
    }),
  );

  for (const f of files) {
    if (f.path === PRD_PATH) {
      checkFrontmatter(f.rel, f.raw, report);
      checkChapterOrder(f.rel, f.text, PRD_CHAPTERS, null, report);
    } else if (f.path === GLOSSARY_PATH) {
      checkFrontmatter(f.rel, f.raw, report);
    } else {
      const spec = specParts(f.path);
      if (!spec) continue;
      checkFrontmatter(f.rel, f.raw, report);
      checkChapterOrder(f.rel, f.text, SPEC_CHAPTERS, MAPPING_CHAPTER, report);
      const names = checkScenarios(f.rel, f.text, report);
      checkDecisionBases(f.rel, f.raw, report);
      const legacy = readLegacyIds(join(docsDir, 'specs', 'legacy', `${spec.legacyName}.ids`));
      checkMapping(f.rel, f.text, legacy, names, specNumbers, spec.number, report);
    }
  }
  checkAnchorLinks(files, report);
  checkStaleUnwritten(files, specPathByNumber, report);
  checkQuestions(files, report);
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
