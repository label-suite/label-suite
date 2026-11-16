#!/usr/bin/env node
// Mechanical comparison between the candidate table dictionary and the ER
// diagram data generated from it. See issue #236 for why each assertion
// exists: the diagram is derived, so the dictionary is always right and any
// difference is the diagram having drifted.
//
// The first three classes below are not hypothetical. PR #252's first attempt
// listed `audit_events` as a table for spec 04-02 because a mention in prose
// was read as a source declaration; PR #246's first attempt carried 30 unique
// flags that did not exist, two of them contradicting the dictionary in words.
//
// Run: node scripts/check-er-data.mjs

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DICT_PATH = join(HERE, '..', 'docs', 'diagrams', 'architecture', 'data-table-dictionary.mdx');
export const ER_PATH = join(HERE, '..', 'docs', 'diagrams', 'architecture', 'database-schema.er.json');
export const INVENTORY_PATH = join(HERE, '..', 'docs', 'diagrams', 'architecture', 'data-field-inventory.mdx');
const SPECS_DIR = join(HERE, '..', 'docs', 'specs');
const ROOT = join(HERE, '..');
// The roots a spec page is allowed to cite by line: the screens it describes,
// the documents beside it, and the rules it quotes. Anything else is a path
// `checkPathCitations` will report as missing, which is the right answer.
const CITABLE = ['design/prototype', 'docs', 'scripts', '.claude/skills', '.agents/skills'];
const CITABLE_EXT = /\.(html|js|mjs|cjs|json|mdx|md|css|ts|tsx|svg)$/;

// One shape for a spec page code, so the two readers of it cannot drift apart.
const SPEC_CODE = '(0[1-7]-0[0-9])';

const NAME = /`([a-z][a-z0-9_]*)`/;
const SEP = /^\|[\s:\-|]+\|$/;

function strip(cell) {
  return cell
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nullability(cell) {
  const c = cell.replace(/\*/g, '');
  if (c.includes('系統寫入')) return 'system';
  if (c.includes('可空')) return 'nullable';
  return 'required';
}

// Only a column list with a comma makes a unique composite; the renderer draws
// `unique` as a per-column badge, so a composite flattened onto each column
// would assert constraints that do not exist. "不加唯一" is the dictionary
// denying one outright, and a substring search for 唯一 is bitten by it.
function singleUnique(key) {
  const k = key.replace(/\*/g, '');
  if (!k.includes('唯一')) return false;
  // The dictionary denies a unique key in more than one wording, and a
  // whitelist of two literals is how a future 不設唯一 would be read as
  // granting one -- the mistake this check exists to catch.
  if (/(不[加設建立]|無|毋須|不需)[^。；]{0,6}唯一/.test(k)) return false;
  if (k.includes('部分唯一')) return false;
  // A column list is written in backticks. Prose in parentheses after 唯一
  // is a gloss, not a list.
  if (/`\s*[（(][^）)]*[,，][^）)]*[）)]\s*`/.test(k)) return false;
  return true;
}

/** The dictionary, read as data: its groups with their declared counts, and a
 *  table per `### \`name\` — label` heading with one entry per column row. */
export function parseDictionary(text) {
  const lines = text.split('\n');
  const groups = [];
  let inGroupTable = false;
  for (const line of lines) {
    if (/^### 九個領域分組/.test(line)) { inGroupTable = true; continue; }
    if (inGroupTable && /^#{2,3} /.test(line)) inGroupTable = false;
    if (!inGroupTable) continue;
    const m = /^\| `([a-z_]+)` \| +(\d+) \|/.exec(line);
    if (m) groups.push({ key: m[1], count: Number(m[2]) });
  }

  const tables = [];
  let group = null;
  let table = null;
  let inColumns = false;
  for (const line of lines) {
    const g = /^## [一二三四五六七八九十]+、`([a-z_]+)`/.exec(line);
    if (g) { group = g[1]; table = null; inColumns = false; continue; }
    const t = /^### `([a-z][a-z0-9_]*)` — (.+?)\s*$/.exec(line);
    if (t && group) {
      // `group` is deliberately not carried: chapter seven covers two groups
      // under one heading, so a chapter-derived group would be wrong for six
      // tables. Group membership is checked against the declared counts.
      table = { name: t[1], label: t[2].trim(), columns: [] };
      tables.push(table);
      inColumns = false;
      continue;
    }
    if (line.startsWith('| 識別碼 | 中文意義 |')) { inColumns = true; continue; }
    if (!inColumns || !table) continue;
    if (!line.startsWith('|')) { inColumns = false; continue; }
    if (SEP.test(line.trim())) continue;
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 7) continue;
    const names = [...cells[1].matchAll(new RegExp(NAME, 'g'))].map((m) => m[1]);
    if (names.length === 0) continue;
    const key = cells[5];
    const fk = /→\s*`?([a-z_]+)\./.exec(key);
    const type = strip(cells[3]).replace(/\s*[×x]\s*\d+$/, '');
    for (const name of names) {
      table.columns.push({
        name,
        type,
        required: nullability(cells[4]),
        pk: key.includes('PK'),
        unique: singleUnique(key),
        fk: fk ? fk[1] : null,
      });
    }
  }
  return { groups, tables };
}

/** Every `[NN-NN](path)` on a table's `**規格來源**` line. Links elsewhere in
 *  the description are prose — often a contrast — and are not declarations. */
function specSources(description) {
  // Every such line, not the first: a description may carry more than one,
  // and missing one makes a correct spec entry look like it over-lists.
  const lines = [...(description || '').matchAll(/\*\*規格來源\*\*：(.*)/g)];
  return lines.flatMap((line) =>
    [...line[1].matchAll(new RegExp(`\\[${SPEC_CODE}\\]\\(([^)]+)\\)`, 'g'))].map((m) => ({ code: m[1], href: m[2] })));
}

function numbersIn(description) {
  const m = /\*\*(\d+)\s*張候選表、(\d+)\s*欄、(\d+)\s*個單欄 FK\*\*/.exec(description || '');
  return m ? { tables: Number(m[1]), columns: Number(m[2]), fks: Number(m[3]) } : null;
}

/** Compare the two and return one message per difference. */
export function checkErData(dictText, er, { specsDir = SPECS_DIR } = {}) {
  const out = [];
  const dict = parseDictionary(dictText);
  const erTables = Array.isArray(er.tables) ? er.tables : [];

  const seen = new Set();
  for (const t of erTables) {
    if (seen.has(t.name)) out.push(`duplicate table name "${t.name}" in the diagram`);
    seen.add(t.name);
    const cols = new Set();
    for (const c of t.columns || []) {
      if (cols.has(c.name)) out.push(`duplicate column "${t.name}.${c.name}" in the diagram`);
      cols.add(c.name);
    }
  }

  const dictSeen = new Set();
  for (const t of dict.tables) {
    if (dictSeen.has(t.name)) out.push(`duplicate table name "${t.name}" in the dictionary`);
    dictSeen.add(t.name);
  }
  const dictByName = new Map(dict.tables.map((t) => [t.name, t]));
  const erByName = new Map(erTables.map((t) => [t.name, t]));
  for (const name of erByName.keys()) {
    if (!dictByName.has(name)) out.push(`table "${name}" is in the diagram but not in the dictionary`);
  }
  for (const name of dictByName.keys()) {
    if (!erByName.has(name)) out.push(`table "${name}" is in the dictionary but not in the diagram`);
  }

  const groupKeys = new Set((er.groups || []).map((g) => g.key));
  for (const t of erTables) {
    if (!groupKeys.has(t.group)) out.push(`table "${t.name}" points at group "${t.group}", which the diagram does not define`);
  }
  for (const col of er.layout?.columns || []) {
    for (const g of col.groups || []) {
      if (!groupKeys.has(g)) out.push(`layout column "${col.key}" points at group "${g}", which the diagram does not define`);
    }
  }
  if (dict.groups.length === 0) out.push('§一 has no group table this checker can read counts from');
  for (const g of dict.groups) {
    const actual = erTables.filter((t) => t.group === g.key).length;
    if (actual !== g.count) out.push(`group "${g.key}" holds ${actual} tables in the diagram but the dictionary says ${g.count}`);
  }

  for (const [name, dt] of dictByName) {
    const et = erByName.get(name);
    if (!et) continue;
    if ((et.label || '') !== dt.label) out.push(`table "${name}": label is "${et.label}" in the diagram but "${dt.label}" in the dictionary`);
    const dCols = dt.columns.map((c) => c.name).join(',');
    const eCols = (et.columns || []).map((c) => c.name).join(',');
    if (dCols !== eCols) {
      out.push(`table "${name}" has columns [${eCols}] in the diagram but [${dCols}] in the dictionary`);
      continue;
    }
    for (const [i, dc] of dt.columns.entries()) {
      const ec = et.columns[i];
      const where = `${name}.${dc.name}`;
      if ((ec.type || '') !== dc.type) out.push(`${where}: type is "${ec.type}" in the diagram but "${dc.type}" in the dictionary`);
      if ((ec.required || '') !== dc.required) out.push(`${where}: nullability is "${ec.required}" in the diagram but "${dc.required}" in the dictionary`);
      if (!!ec.pk !== dc.pk) out.push(`${where}: primary key is ${!!ec.pk} in the diagram but ${dc.pk} in the dictionary`);
      if (!!ec.unique !== dc.unique) out.push(`${where}: single-column unique is ${!!ec.unique} in the diagram but ${dc.unique} in the dictionary`);
      const efk = ec.fk || null;
      if (efk !== dc.fk) out.push(`${where}: foreign key points at "${efk}" in the diagram but "${dc.fk}" in the dictionary`);
      if (efk && !erByName.has(efk)) out.push(`${where}: foreign key points at "${efk}", which is not a table`);
    }
  }

  const claimed = numbersIn(er.meta?.description);
  if (!claimed) {
    out.push('the summary in meta.description no longer matches the checkable form "**N 張候選表、N 欄、N 個單欄 FK**"');
  } else {
    const columns = erTables.reduce((n, t) => n + (t.columns || []).length, 0);
    const fks = erTables.reduce((n, t) => n + (t.columns || []).filter((c) => c.fk).length, 0);
    if (claimed.tables !== erTables.length) out.push(`the summary says ${claimed.tables} tables but the diagram holds ${erTables.length}`);
    if (claimed.columns !== columns) out.push(`the summary says ${claimed.columns} columns but the diagram holds ${columns}`);
    if (claimed.fks !== fks) out.push(`the summary says ${claimed.fks} single-column foreign keys but the diagram holds ${fks}`);
  }

  for (const t of erTables) {
    for (const { code, href } of specSources(t.description)) {
      const rel = /^\/notes\/specs\/(.+?)(#.*)?$/.exec(href);
      if (!rel) { out.push(`table "${t.name}" cites ${code} with a link this checker cannot resolve: ${href}`); continue; }
      if (!existsSync(join(specsDir, `${rel[1]}.mdx`))) {
        out.push(`table "${t.name}" cites ${code} at ${href}, but that spec page does not exist`);
      }
    }
  }
  return out;
}

/** Every `` `:N`「quote」 `` in the generated artifacts must land on the line it
 *  quotes. #236, 2026-11-14: three of them had drifted, because #170 and #282
 *  inserted rows into a spec's 資料欄位 table and pushed every later row down.
 *  Nothing could see it — `specSources()` only proves the cited page exists,
 *  and `check-specs.mjs` never reads `docs/diagrams/`.
 *
 *  A line number with no quote after it is not a citation: that is the shape a
 *  變更紀錄 row uses to record a fix (`` `:965`→`:974` ``), and reading those as
 *  citations would make every such row fail the moment it is written.
 *
 *  The comparison is substring containment, so a quote only protects as well as
 *  it is chosen: pick wording that appears on that row and nowhere else on the
 *  page, or a drifted line number can still land on a decoy. */
const CITATION = /`:(\d+)`\s*(?:的\s*)?「([^」]{2,})」/g;
// A link, not a bare mention: `specSources()` refuses prose links for the same
// reason — a page named in passing is usually a contrast, not a declaration —
// and attribution has to be at least as strict, or a contrast steals the quote.
const citedPage = () => new RegExp(`\\[${SPEC_CODE}\\]\\(`, 'g');

// The dictionary quotes a table row as 欄名｜值 while the page writes it as
// | 欄名 | 值 |, and bold moves around, so compare without either.
const flatten = (text) => text.replace(/\*\*/g, '').replace(/｜/g, '|').replace(/\s+/g, '');

export function checkLineCitations(sources, pages) {
  const out = [];
  const byCode = new Map(pages.map((p) => [p.code, p.text.split('\n')]));
  for (const { rel, text } of sources) {
    for (const [i, line] of text.split('\n').entries()) {
      for (const m of line.matchAll(CITATION)) {
        const where = `${rel}:${i + 1}`;
        const codes = [...line.slice(0, m.index).matchAll(citedPage())];
        if (codes.length === 0) {
          out.push(`${where} quotes :${m[1]} but names no spec page before it, so nothing can check that line`);
          continue;
        }
        const code = codes[codes.length - 1][1];
        const lines = byCode.get(code);
        if (!lines) {
          out.push(`${where} cites ${code} at :${m[1]}, but no spec page has that code`);
          continue;
        }
        const n = Number(m[1]);
        if (n < 1 || n > lines.length) {
          out.push(`${where} cites ${code} at :${m[1]}, but that page has ${lines.length} lines`);
          continue;
        }
        const actual = flatten(lines[n - 1]);
        // An ellipsis joins fragments of one row, so every fragment must be there.
        for (const fragment of m[2].split(/[…⋯]+|\.{3,}/)) {
          const want = flatten(fragment);
          if (want.length < 2) continue;
          if (!actual.includes(want)) {
            out.push(`${where} cites ${code} at :${n} for 「${fragment.trim()}」, but that line reads 「${lines[n - 1].trim().slice(0, 60)}」`);
          }
        }
      }
    }
  }
  return out;
}

/** `docs/specs/` cites prototype files and the PRD the other way round: by
 *  path and line (`` `sidebar.js:558` ``), not by spec code, so
 *  `checkLineCitations` cannot see any of them.
 *
 *  Measured on 2026-11-16: three of the six live citations pointed at
 *  unrelated lines, and two of those three also asserted a screen state that
 *  #165 had changed five days earlier. **Existence alone catches none of
 *  them** — every stale line number was still well inside its file — so a
 *  citation with no quote after it is itself the finding, not a pass.
 *
 *  That is the opposite of the rule next door, where a bare line number marks
 *  a 變更紀錄 row recording a fix. Here those rows are skipped wholesale
 *  instead: a row quotes the sentence it removed, line number and all, so
 *  reading them as citations would fail every page that ever fixed one. */
const PATH_CITE = /`([\w./-]*\.[A-Za-z]\w*)?:(\d+)(?:-(\d+))?`/g;
const ANCHOR = /^(?:\s*的)?\s*(?:「([^」]*)」|`([^`]*)`)/;

/** `files` maps a repo-relative path to its text; a bare file name resolves
 *  through it only when exactly one path ends in that name. */
export function checkPathCitations(sources, files) {
  const out = [];
  const paths = [...files.keys()];
  for (const { rel, text } of sources) {
    let section = '';
    let fenced = false;
    let lastPath = null;
    for (const [i, line] of text.split('\n').entries()) {
      // A fence hides both kinds of line: a `foo.js:12` inside an example is
      // not a citation, and a `## 變更紀錄` inside one must not silence the
      // rest of the page.
      if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
      if (fenced) continue;
      if (line.startsWith('## ')) section = line.slice(3).trim();
      if (section === '變更紀錄') continue;
      lastPath = null;
      for (const m of line.matchAll(PATH_CITE)) {
        const where = `${rel}:${i + 1}`;
        const cite = `${m[1] || ''}:${m[2]}${m[3] ? `-${m[3]}` : ''}`;
        let path = m[1] || lastPath;
        if (!path) {
          out.push(`${where} cites :${m[2]} but names no file before it on that line`);
          continue;
        }
        lastPath = path;
        let hits = paths.includes(path) ? [path] : paths.filter((p) => p.endsWith(`/${path}`));
        if (hits.length === 0) {
          out.push(`${where} cites ${cite}, but no file in the repository is ${path}`);
          continue;
        }
        if (hits.length > 1) {
          out.push(`${where} cites ${cite}, but ${path} is ambiguous: ${hits.join(', ')}`);
          continue;
        }
        const lines = files.get(hits[0]).split('\n');
        const from = Number(m[2]);
        const to = m[3] ? Number(m[3]) : from;
        if (from < 1 || to > lines.length) {
          out.push(`${where} cites ${cite}, but ${hits[0]} has ${lines.length} lines`);
          continue;
        }
        if (to < from) {
          out.push(`${where} cites ${cite}, but that range ends before it starts`);
          continue;
        }
        const rest = line.slice(m.index + m[0].length);
        const a = ANCHOR.exec(rest);
        const quote = a ? (a[1] ?? a[2]) : null;
        if (quote === null) {
          out.push(`${where} cites ${cite} with no quote after it, so nothing can check that line`);
          continue;
        }
        const span = lines.slice(from - 1, to).map(flatten);
        for (const fragment of quote.split(/[…⋯]+|\.{3,}/)) {
          const want = flatten(fragment);
          if (want.length < 2) {
            out.push(`${where} cites ${cite} for 「${fragment.trim()}」, which is too short to anchor anything`);
            continue;
          }
          if (!span.some((l) => l.includes(want))) {
            out.push(`${where} cites ${cite} for 「${fragment.trim()}」, but ${hits[0]} reads 「${lines[from - 1].trim().slice(0, 60)}」 there`);
          }
        }
      }
    }
  }
  return out;
}

/** The table list each spec page's planning entry names must be exactly the
 *  tables whose `**規格來源**` cites that page. PR #252 shipped a first
 *  attempt that read every link in a table's description, so `audit_events`
 *  appeared under 04-02 on the strength of a sentence saying that table and
 *  `annotation_history_event` are two policies that must not be merged. */
export function checkSpecEntries(er, pages) {
  const out = [];
  const expected = new Map();
  for (const t of er.tables || []) {
    for (const { code } of specSources(t.description)) {
      if (!expected.has(code)) expected.set(code, new Set());
      expected.get(code).add(t.name);
    }
  }
  for (const { code, text, rel } of pages) {
    const note = /:::note\{title="資料規劃入口"\}([\s\S]*?)\n:::/.exec(text);
    if (!note) { out.push(`${rel}: has no 資料規劃入口 entry`); continue; }
    const listed = [...note[1].matchAll(/`([a-z][a-z0-9_]*)`/g)].map((m) => m[1]);
    const want = [...(expected.get(code) || [])].sort();
    const got = [...new Set(listed)].sort();
    if (want.join(',') !== got.join(',')) {
      out.push(`${rel}: the entry lists [${got.join(', ')}] but the dictionary's spec sources give [${want.join(', ')}]`);
    }
    const claimed = /\*\*(\d+) 張\*\*/.exec(note[1]);
    if (claimed && Number(claimed[1]) !== want.length) {
      out.push(`${rel}: the entry says ${claimed[1]} tables but names ${want.length}`);
    } else if (!claimed && want.length > 0) {
      out.push(`${rel}: the entry names ${want.length} tables but states no count in the checkable form "**N 張**"`);
    }
  }
  return out;
}

function specPages(specsDir = SPECS_DIR) {
  const pages = [];
  for (const mod of readdirSync(specsDir, { withFileTypes: true })) {
    if (!mod.isDirectory() || !/^\d\d-/.test(mod.name)) continue;
    for (const f of readdirSync(join(specsDir, mod.name))) {
      const m = /^(\d\d)-.*\.mdx$/.exec(f);
      if (!m) continue;
      const rel = `specs/${mod.name}/${f}`;
      pages.push({ code: `${mod.name.slice(0, 2)}-${m[1]}`, rel, text: readFileSync(join(specsDir, mod.name, f), 'utf8') });
    }
  }
  return pages.sort((a, b) => a.code.localeCompare(b.code));
}

/** Every file a spec page may cite, read only when a citation names it. */
export function citableFiles(root = ROOT, roots = CITABLE) {
  const paths = [];
  const walk = (rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      // The roots above already name the dot directories that count.
      if (e.name.startsWith('.')) continue;
      if (e.name === 'node_modules') continue;
      const next = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(next);
      else if (CITABLE_EXT.test(e.name)) paths.push(next);
    }
  };
  for (const r of roots) walk(r);
  const cache = new Map();
  return {
    keys: () => paths,
    get: (p) => {
      if (!cache.has(p)) cache.set(p, readFileSync(join(root, p), 'utf8'));
      return cache.get(p);
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dictText = readFileSync(DICT_PATH, 'utf8');
  const erText = readFileSync(ER_PATH, 'utf8');
  const er = JSON.parse(erText);
  const pages = specPages();
  const errors = checkErData(dictText, er)
    .concat(checkSpecEntries(er, pages))
    .concat(checkLineCitations([
      { rel: 'diagrams/architecture/data-table-dictionary.mdx', text: dictText },
      { rel: 'diagrams/architecture/database-schema.er.json', text: erText },
      { rel: 'diagrams/architecture/data-field-inventory.mdx', text: readFileSync(INVENTORY_PATH, 'utf8') },
    ], pages))
    .concat(checkPathCitations(
      pages.map((p) => ({ rel: p.rel, text: p.text })),
      citableFiles(),
    ));
  for (const e of errors) console.error(`ERROR ${e}`);
  if (errors.length > 0) process.exit(1);
  console.log('check-er-data: dictionary, diagram, spec entries and both kinds of line citation agree');
}
