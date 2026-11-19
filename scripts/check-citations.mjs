#!/usr/bin/env node
// Checks the `file:line` citations in the design system and the prototype
// navigation contract: every cited file exists, every cited line is inside the
// file, every bare `:N` can be traced to a file, and the cited line mentions
// something the sentence around it names. See
// https://github.com/label-suite/label-suite/issues/455 for why it exists.
// Run: node scripts/check-citations.mjs [--verbose]
//
// Errors (exit 1): a file that cannot be found or is ambiguous, a line outside
// the file, a bare `:N` with no file before it in the same paragraph, list
// item or table row.
// Warnings: the cited line (or range) contains none of the identifiers, class
// names, functions or quoted strings of its sentence. That test is a
// heuristic, so it warns, the way check-flows reports its text heuristics.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..');

// What gets scanned. docs/specs is scanned too: its citations are reported,
// but the pages belong to the maintainer, so a fix there is digits only.
export const SCAN = [
  { dir: 'design/system', exts: ['.md', '.css', '.html'], skip: ['design/system/handoff/manifest.json'] },
  { dir: 'docs/prototype', exts: ['.mdx', '.md'] },
  { dir: 'docs/specs', exts: ['.mdx', '.md'] },
];

// Where a cited file is looked for, in this order, when the path is not
// already relative to the repo root or to the citing document.
const SEARCH_BASES = ['design/prototype', 'design/system', 'docs/specs', 'docs'];
const INDEX_SKIP = new Set(['node_modules', '.git', '.astro', 'worktrees', 'dist', '.impeccable']);

const EXT = 'html|js|mjs|cjs|css|md|mdx|json|svg|tsx|ts|jsx|yaml|yml|py|sh';
// `path/to/file.ext:12`, optionally `:12-14` or `:12–14` inside the same span.
const EXPLICIT = new RegExp(String.raw`(?<![\w/.@-])((?:[\w.-]+/)*[\w.-]+\.(?:${EXT})):(\d+)(?:\s*[-–]\s*:?(\d+))?(?![\w])`, 'g');
// A bare `:12` (or `:12-14`): preceded by start, space, backtick or CJK
// punctuation, never by a word character, so 16:24, 4.5:1 and a:hover are out.
const BARE = /(?<=^|[\s`(（、，,；;「『:]|[　-〿＀-￯])(?<!\d):(\d+)(?:\s*[-–]\s*:?(\d+))?(?![\w.%])/g;
// A file named in a code span without a line number.
const MENTION = new RegExp(String.raw`\`(?:…|\.\.\.)?((?:[\w.-]+/)*[\w.-]+\.(?:${EXT}))\``, 'g');
// What may sit between `a.html:12` and `:14` for the second to close a range.
const RANGE_JOIN = /^`?\s*[–-]\s*`?$/;

// Prose words too common to prove anything about a line.
const STOP = new Set(`the and for with from that this var px rem em css html js div span class
  const let function return true false null none auto color background border width height
  font size page pages file line lines shared prototype showcase md mdx json svg see also
  not one two only all new old same each its into are was use used uses`.split(/\s+/).filter(Boolean));

// A citation the heuristic cannot verify but a person did: `file` is the
// citing document, `text` a substring of its line, `reason` why it is right.
// Keep this short. Prefer rewording the sentence so it names what the line
// holds, or teaching the heuristic, over adding an entry here.
export const ALLOW = [];

// ---------------------------------------------------------------- file index

export function buildIndex(root = ROOT) {
  const files = new Map(); // rel path -> abs path
  const walk = (abs) => {
    for (const name of readdirSync(abs)) {
      if (INDEX_SKIP.has(name)) continue;
      const p = join(abs, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else files.set(relative(root, p).split(sep).join('/'), p);
    }
  };
  walk(root);
  return files;
}

// Resolves a cited path to a repo-relative file, or reports why it cannot.
export function resolveFile(cited, fromDoc, index) {
  const tries = [cited, join(dirname(fromDoc), cited).split(sep).join('/'), ...SEARCH_BASES.map((b) => `${b}/${cited}`)];
  for (const t of tries) if (index.has(t)) return { file: t };
  const hits = [...index.keys()].filter((k) => k.endsWith(`/${cited}`));
  // `…detail.partials/x.html` elides the front of a directory name.
  if (hits.length === 0 && cited.includes('/')) hits.push(...[...index.keys()].filter((k) => k.endsWith(cited)));
  if (hits.length === 1) return { file: hits[0] };
  if (hits.length > 1) {
    const proto = hits.filter((h) => h.startsWith('design/prototype/'));
    if (proto.length === 1) return { file: proto[0] };
    return { error: `ambiguous file ${cited}: ${hits.join(', ')}` };
  }
  return { error: `file not found: ${cited}` };
}

// ---------------------------------------------------------------- parsing

// Splits a document into units: a table row, a list item, a heading, a
// blockquote line, or a run of plain lines. A bare `:N` may only inherit a
// file from earlier in its own unit. Fenced code is dropped.
export function units(text) {
  const out = [];
  let cur = null;
  let fence = false;
  text.split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; cur = null; return; }
    if (fence) return;
    if (line.trim() === '') { cur = null; return; }
    const starts = /^\s*(\||[-*+] |\d+\. |#|>)/.test(line) || cur === null;
    if (starts) { cur = { line: i + 1, text: line }; out.push(cur); }
    else cur.text += `\n${line}`;
  });
  return out;
}

// The file a document declares in its header blockquote, e.g. a page doc's
// `檔案 \`design/prototype/pages/x.html\``, or a component doc's
// `未標檔名的行號指 \`…\``. A bare `:N` with no explicit file
// before it in its unit refers to this file.
export function declaredFile(text) {
  for (const line of text.split('\n').slice(0, 8)) {
    if (!line.startsWith('>')) continue;
    const m = line.match(/(?:檔案|未標檔名的行號指)\s*`([^`]+)`/);
    if (m) return m[1];
  }
  return null;
}

// Character ranges inside 「…」: a `file:N` there is quoted text, not a citation.
function quotedRanges(text) {
  return [...text.matchAll(/「[^」]*」/g)].map((m) => [m.index, m.index + m[0].length]);
}

// 原件 shortly before a citation, in the same sentence, says it points into
// the original repository (singyichen/label-suite), which this one cannot
// resolve.
function original(text, at) {
  const before = text.slice(Math.max(0, at - 16), at);
  return /原件/.test(before.slice(before.search(/[^。]*$/)));
}

// Every citation in one unit, in order, with the bare ones resolved to the
// nearest explicit file before them (or the document's declared file) and
// ranges joined. A citation right after 原件 points into the original
// repository, which this one cannot resolve; it is marked external, and so
// are the bare numbers that inherit from it.
export function citationsIn(unitText, fallback = null) {
  const found = [];
  const quoted = quotedRanges(unitText);
  const inQuote = (i) => quoted.some(([a, b]) => i > a && i < b);
  for (const m of unitText.matchAll(EXPLICIT)) {
    if (inQuote(m.index)) continue;
    found.push({ at: m.index, end: m.index + m[0].length, path: m[1], from: +m[2], to: m[3] ? +m[3] : +m[2], raw: m[0] });
  }
  for (const m of unitText.matchAll(BARE)) {
    if (inQuote(m.index)) continue;
    if (found.some((f) => m.index >= f.at && m.index < f.end)) continue;
    found.push({ at: m.index, end: m.index + m[0].length, path: null, from: +m[1], to: m[2] ? +m[2] : +m[1], raw: m[0] });
  }
  // In a document without a declared file, a file named in a code span with
  // no line (`pages/x.html`（2）：:5, :9) is also a file the bare numbers
  // after it read against. With a declared file it is not: a page doc's
  // 「`button.css`（`:12`）」 cites the line of the page that loads button.css.
  if (fallback === null) {
    for (const m of unitText.matchAll(MENTION)) {
      if (inQuote(m.index) || found.some((f) => m.index >= f.at && m.index < f.end)) continue;
      found.push({ at: m.index, end: m.index + m[0].length, path: m[1], mention: true });
    }
  }
  found.sort((a, b) => a.at - b.at);
  const out = [];
  let lastPath = null;
  let lastExternal = false;
  for (const c of found) {
    const prev = out.at(-1);
    if (c.path === null && prev && prev.from === prev.to && RANGE_JOIN.test(unitText.slice(prev.end, c.at))) {
      prev.to = c.from;
      prev.end = c.end;
      prev.raw = unitText.slice(prev.at, c.end);
      continue;
    }
    if (c.mention) { lastPath = c.path; lastExternal = original(unitText, c.at); continue; }
    if (c.path) {
      c.external = original(unitText, c.at);
      lastPath = c.path;
      lastExternal = c.external;
    } else {
      c.bare = true;
      c.path = lastPath ?? fallback;
      c.external = lastPath ? lastExternal : false;
      if (!lastPath && original(unitText, c.at)) c.external = true;
    }
    out.push(c);
  }
  return out;
}

// The sentence (or table cell) a citation sits in.
export function sentenceAround(unitText, at, end) {
  let lo = 0;
  let hi = unitText.length;
  // A table row is read whole: the evidence cell often holds nothing but
  // citations, and what they cite is named in the cells beside it.
  if (unitText.trimStart().startsWith('|')) return unitText;
  const cell = unitText.slice(lo, hi);
  const rel = at - lo;
  const stops = /[。！？]/g;
  let sLo = 0;
  let sHi = cell.length;
  for (const m of cell.matchAll(stops)) {
    if (m.index < rel) sLo = m.index + 1;
    else { sHi = m.index; break; }
  }
  return cell.slice(sLo, sHi);
}

// The strings a cited line is expected to contain at least one of.
export function tokensOf(sentence) {
  const strip = sentence.replace(EXPLICIT, ' ').replace(BARE, ' ');
  const tokens = new Set();
  const addIdents = (s) => {
    for (const m of s.matchAll(/[A-Za-z_$][\w$-]*/g)) {
      const w = m[0].replace(/-+$/, '');
      if (w.length >= 3 && !STOP.has(w.toLowerCase())) tokens.add(w);
    }
  };
  const addQuote = (q) => {
    for (const part of q.replace(/`/g, '').split(/…+|\.\.\.|⋯/)) {
      const t = part.trim().replace(/^[{(\s]+|[})\s]+$/g, '');
      // Only punctuation, digits and spaces prove nothing; a Chinese label
      // such as 「移除頭像」 does, so the test is Unicode-aware.
      if (t.length >= 2 && !/^[\p{P}\p{S}\p{N}_\s]+$/u.test(t)) tokens.add(t);
    }
  };
  for (const m of strip.matchAll(/`([^`]+)`/g)) {
    const inner = m[1].trim();
    if (!inner) continue;
    addQuote(inner);
    addIdents(inner);
    // A script is named after what it exports: `modal-focus.js` is the file
    // of window.LabelSuiteModalFocus, `date-range-picker.js` of
    // window.DateRangePicker. The kebab stem without hyphens finds the
    // camel-case name once both sides are lower-cased.
    const script = inner.match(/(?:^|\/)([a-z][a-z0-9]*(?:-[a-z0-9]+)+)(?:\.[\w-]+)*\.m?js$/);
    if (script) tokens.add(script[1].replace(/-/g, ''));
  }
  for (const m of strip.matchAll(/「([^」]+)」|『([^』]+)』|“([^”]+)”|"([^"\n]+)"/g)) addQuote(m[1] ?? m[2] ?? m[3] ?? m[4]);
  addIdents(strip.replace(/`[^`]*`/g, ' ').replace(/\]\([^)]*\)/g, ']'));
  // A percentage is a value the cited line can be checked for (`12%` in a
  // color-mix). 0% and 100% are too common to prove anything.
  for (const m of strip.matchAll(/(?<![\w.])(\d{1,2}(?:\.\d+)?)%/g)) if (+m[1] !== 0) tokens.add(`${m[1]}%`);
  return [...tokens];
}

// 『』 is how a quote inside 「…」 is written, so a label quoted in a doc as
// 「…『密碼設定』…」 reads 「密碼設定」 in the cited line.
const norm = (s) => s.replace(/\s+/g, ' ').replace(/『/g, '「').replace(/』/g, '」').toLowerCase();

export function lineMatches(lines, from, to, tokens) {
  const text = norm(lines.slice(from - 1, to).join('\n'));
  return tokens.some((t) => text.includes(norm(t)));
}

// The light-theme value of each custom property in the first :root block of
// tokens.css. An SVG cannot read a custom property, so a logo file carries
// the value: `--color-ink` is satisfied by a line that reads #1E1B4B.
export function tokenValues(css) {
  const out = new Map();
  const root = css.match(/:root\s*\{([^}]*)\}/);
  if (!root) return out;
  for (const m of root[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim().toLowerCase());
  return out;
}

// Is line n inside a <style> or <script> element of the file?
function insideElement(lines, n, tag) {
  for (let i = n - 1; i >= 0; i--) {
    const l = lines[i].toLowerCase();
    if (l.includes(`</${tag}>`) && i < n - 1) return false;
    if (new RegExp(`<${tag}[\\s>]`).test(l)) return true;
  }
  return false;
}

// Matches the heuristic cannot see in the cited text alone. Each needs the
// cited file, the token table or the citing doc.
export function contextMatches({ lines, from, to, tokens, doc = '', unitText = '', values = new Map() }) {
  const text = lines.slice(from - 1, to).join('\n');
  for (const t of tokens) {
    // `<style>` or `<script>`: the citation points into that element.
    const el = t.match(/^<(style|script)>$/i);
    if (el && [from, to].every((n) => insideElement(lines, n, el[1].toLowerCase()))) return true;
    // `<span>` is also met by an opening tag with attributes (`<svg viewBox=…>`)
    // and by the CSS selector that styles it (`.metric span {`).
    const tag = t.match(/^<([a-z][a-z0-9]*)>$/i);
    if (tag && new RegExp(`<${tag[1]}[\\s/>]|(^|[\\s>+~,(])${tag[1]}(?=\\s*[{,:>.[)]|\\s*$)`, 'im').test(text)) return true;
    // A design token is met by its light-theme value.
    const v = t.startsWith('--') ? values.get(t) : undefined;
    if (v && /^#[0-9a-f]{3,8}$/.test(v) && text.toLowerCase().includes(v)) return true;
  }
  // A usage entry of a component doc (a table row, list item or paragraph)
  // opens with the screen that uses the component (`task-management/task-list#state-default`,
  // `components-showcase#comp-banner`); the component it cites is the doc's
  // own, so the doc's slug is what the cited line must name.
  const slug = doc.match(/^design\/system\/components\/([\w-]+)\.md$/)?.[1];
  const firstCell = unitText.match(/^\s*(?:\|\s*|[-*]\s+)?`([^`]+)`/)?.[1] ?? '';
  if (slug && /^(?:[\w-]+\/[\w-]+|components-showcase)(?:#[\w-]+)?$/.test(firstCell)) {
    if (text.toLowerCase().includes(slug)) return true;
  }
  return false;
}

// Lines under a heading that names 原件 transcribe the original repository;
// their citations are external.
export function originalLines(text) {
  const out = new Set();
  let level = 0;
  text.split('\n').forEach((line, i) => {
    const h = line.match(/^(#+) /);
    if (h) level = /原件/.test(line) ? h[1].length : (level && h[1].length > level ? level : 0);
    else if (level) out.add(i + 1);
  });
  return out;
}

// Citations inside a part the document itself marks as history are skipped:
// (1) in a `###` section, everything above a paragraph that says
// 上文…的行號指的是修正前; (2) a section (with its subsections) that says its
// line numbers are still those of a named commit, 行號仍是 `eb9a884` 的位置,
// because it keeps a list as a record; (3) a change-log table row, which
// starts with an issue link and a date.
export function historicalLines(text) {
  const lines = text.split('\n');
  const hist = new Set();
  const headings = [];
  lines.forEach((line, i) => {
    const h = line.match(/^(#+) /);
    if (h) headings.push({ i, level: h[1].length });
  });
  let sectionStart = 0;
  lines.forEach((line, i) => {
    if (/^#{1,3} /.test(line)) sectionStart = i;
    if (/上文.{0,8}行號指的?是修正前/.test(line)) for (let j = sectionStart; j < i; j++) hist.add(j + 1);
    if (/行號仍是[^。]*`[0-9a-f]{7,40}`[^。]*的位置/.test(line)) {
      const own = headings.filter((h) => h.i < i).at(-1) ?? { i: -1, level: 0 };
      const next = headings.find((h) => h.i > i && h.level <= own.level);
      for (let j = own.i + 1; j < (next ? next.i : lines.length); j++) hist.add(j + 1);
    }
    if (/^\|\s*\[#\d+\]\([^)]*\)\s*\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(line)) hist.add(i + 1);
  });
  return hist;
}

// ---------------------------------------------------------------- the check

export function docsToScan(root = ROOT, scan = SCAN) {
  const out = [];
  for (const { dir, exts, skip = [] } of scan) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    const walk = (d) => {
      for (const name of readdirSync(d).sort()) {
        const p = join(d, name);
        if (statSync(p).isDirectory()) walk(p);
        else {
          const rel = relative(root, p).split(sep).join('/');
          if (exts.some((e) => name.endsWith(e)) && !skip.includes(rel)) out.push(rel);
        }
      }
    };
    walk(abs);
  }
  return out;
}

export function checkCitations({ root = ROOT, docs = docsToScan(root), allow = ALLOW } = {}) {
  const index = buildIndex(root);
  const cache = new Map();
  const linesOf = (file) => {
    if (!cache.has(file)) cache.set(file, readFileSync(index.get(file), 'utf8').split('\n'));
    return cache.get(file);
  };
  const errors = [];
  const warnings = [];
  const stats = { citations: 0, historical: 0, external: 0, allowed: 0, verified: 0, unnamed: 0 };
  const usedAllow = new Set();
  const tokensCss = index.get('design/prototype/assets/tokens.css');
  const values = tokensCss ? tokenValues(readFileSync(tokensCss, 'utf8')) : new Map();
  for (const doc of docs) {
    const text = readFileSync(join(root, doc), 'utf8');
    const hist = historicalLines(text);
    const fallback = declaredFile(text);
    const orig = originalLines(text);
    for (const u of units(text)) {
      for (const c of citationsIn(u.text, fallback)) {
        const lineNo = u.line + u.text.slice(0, c.at).split('\n').length - 1;
        const where = `${doc}:${lineNo}`;
        stats.citations++;
        if (hist.has(lineNo)) { stats.historical++; continue; }
        if (c.external || orig.has(lineNo)) { stats.external++; continue; }
        if (!c.path) { errors.push(`${where}: \`${c.raw.trim()}\` has no file before it in the same paragraph, list item or table row`); continue; }
        const r = resolveFile(c.path, doc, index);
        if (r.error) { errors.push(`${where}: ${r.error}`); continue; }
        const lines = linesOf(r.file);
        const count = lines.at(-1) === '' ? lines.length - 1 : lines.length;
        if (c.from < 1 || c.to > count || c.to < c.from) {
          errors.push(`${where}: ${c.bare ? `\`${c.raw.trim()}\` (${c.path})` : `\`${c.raw.trim()}\``} is outside ${r.file} (${count} lines)`);
          continue;
        }
        const sentence = sentenceAround(u.text, c.at, c.end);
        const tokens = tokensOf(sentence);
        // A sentence that names nothing (only Chinese prose and the citation)
        // gives the heuristic nothing to look for; it is counted, not warned.
        if (tokens.length === 0) { stats.unnamed++; continue; }
        if (lineMatches(lines, c.from, c.to, tokens)
          || contextMatches({ lines, from: c.from, to: c.to, tokens, doc, unitText: u.text, values })) { stats.verified++; continue; }
        const lineText = u.text.split('\n')[lineNo - u.line];
        const a = allow.findIndex((x) => x.file === doc && lineText.includes(x.text) && (!x.cite || c.raw.includes(x.cite)));
        if (a >= 0) { stats.allowed++; usedAllow.add(a); continue; }
        const span = c.from === c.to ? `${c.from}` : `${c.from}-${c.to}`;
        const shown = lines.slice(c.from - 1, Math.min(c.to, c.from + 2)).join(' ⏎ ').trim().slice(0, 120);
        warnings.push(`${where}: ${r.file}:${span} names none of [${tokens.slice(0, 6).join(', ')}${tokens.length > 6 ? ', …' : ''}]; the line reads: ${shown}`);
      }
    }
  }
  allow.forEach((x, i) => {
    if (!usedAllow.has(i)) errors.push(`allowlist entry for ${x.file} ("${x.text}") matched nothing; remove it`);
  });
  return { errors, warnings, stats, docs: docs.length };
}

// Errors always fail. With --strict, an unverified citation (WARN) fails too,
// so CI catches a line number that drifted onto an unrelated line.
export function failed({ errors, warnings }, { strict = false } = {}) {
  return errors.length > 0 || (strict && warnings.length > 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkCitations();
  const { errors, warnings, stats, docs } = result;
  for (const w of warnings) console.warn(`WARN  ${w}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  const summary = `${docs} documents, ${stats.citations} citations: ${stats.verified} verified, ${warnings.length} unverified (WARN), ${stats.unnamed} naming nothing to check, ${stats.allowed} allowlisted, ${stats.historical} historical, ${stats.external} external, ${errors.length} errors`;
  if (failed(result, { strict: process.argv.includes('--strict') })) { console.error(`check-citations: ${summary}`); process.exit(1); }
  console.log(`check-citations: ${summary}`);
}
