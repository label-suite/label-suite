#!/usr/bin/env node
// Checks the `file:line` citations in the design system and the prototype
// navigation contract: every cited file exists, every cited line is inside the
// file, every bare `:N` can be traced to a file, and the cited line mentions
// something the sentence around it names. See
// https://github.com/label-suite/label-suite/issues/455 for why it exists.
// Run: node scripts/check-citations.mjs [--strict] [--verbose]
//
// It also checks the spec references (`03-01 §節名 第 N 條` and the like) in
// the §Logic Flow of each module index and in the edge texts of the Logic
// Flow components; see "spec references in §Logic Flow" below.
//
// Errors (exit 1): a file that cannot be found or is ambiguous, a line outside
// the file, a bare `:N` with no file before it in the same paragraph, list
// item or table row.
// Warnings: the cited line (or range) contains none of the identifiers, class
// names, functions or quoted strings of its sentence. That test is a
// heuristic, so it warns, the way check-flows reports its text heuristics.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..");

// What gets scanned. docs/specs is scanned too: its citations are reported,
// but the pages belong to the maintainer, so a fix there is digits only.
export const SCAN = [
  {
    dir: "design/system",
    exts: [".md", ".css", ".html"],
    skip: ["design/system/handoff/manifest.json"],
  },
  { dir: "docs/prototype", exts: [".mdx", ".md"] },
  { dir: "docs/specs", exts: [".mdx", ".md"] },
];

// Where a cited file is looked for, in this order, when the path is not
// already relative to the repo root or to the citing document.
const SEARCH_BASES = ["design/prototype", "design/system", "docs/specs", "docs"];
const INDEX_SKIP = new Set(["node_modules", ".git", ".astro", "worktrees", "dist", ".impeccable"]);

const EXT = "html|js|mjs|cjs|css|md|mdx|json|svg|tsx|ts|jsx|yaml|yml|py|sh";
// `path/to/file.ext:12`, optionally `:12-14` or `:12–14` inside the same span.
const EXPLICIT = new RegExp(
  String.raw`(?<![\w/.@-])((?:[\w.-]+/)*[\w.-]+\.(?:${EXT})):(\d+)(?:\s*[-–]\s*:?(\d+))?(?![\w])`,
  "g",
);
// A bare `:12` (or `:12-14`): preceded by start, space, backtick or CJK
// punctuation, never by a word character, so 16:24, 4.5:1 and a:hover are out.
const BARE = /(?<=^|[\s`(（、，,；;「『:]|[　-〿＀-￯])(?<!\d):(\d+)(?:\s*[-–]\s*:?(\d+))?(?![\w.%])/g;
// A file named in a code span without a line number.
const MENTION = new RegExp(String.raw`\`(?:…|\.\.\.)?((?:[\w.-]+/)*[\w.-]+\.(?:${EXT}))\``, "g");
// What may sit between `a.html:12` and `:14` for the second to close a range.
const RANGE_JOIN = /^`?\s*[–-]\s*`?$/;

// Prose words too common to prove anything about a line.
const STOP = new Set(
  `the and for with from that this var px rem em css html js div span class
  const let function return true false null none auto color background border width height
  font size page pages file line lines shared prototype showcase md mdx json svg see also
  not one two only all new old same each its into are was use used uses`
    .split(/\s+/)
    .filter(Boolean),
);

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
      else files.set(relative(root, p).split(sep).join("/"), p);
    }
  };
  walk(root);
  return files;
}

// Resolves a cited path to a repo-relative file, or reports why it cannot.
export function resolveFile(cited, fromDoc, index) {
  const tries = [
    cited,
    join(dirname(fromDoc), cited).split(sep).join("/"),
    ...SEARCH_BASES.map((b) => `${b}/${cited}`),
  ];
  for (const t of tries) if (index.has(t)) return { file: t };
  const hits = [...index.keys()].filter((k) => k.endsWith(`/${cited}`));
  // `…detail.partials/x.html` elides the front of a directory name.
  if (hits.length === 0 && cited.includes("/"))
    hits.push(...[...index.keys()].filter((k) => k.endsWith(cited)));
  if (hits.length === 1) return { file: hits[0] };
  if (hits.length > 1) {
    const proto = hits.filter((h) => h.startsWith("design/prototype/"));
    if (proto.length === 1) return { file: proto[0] };
    return { error: `ambiguous file ${cited}: ${hits.join(", ")}` };
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
  text.split("\n").forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      cur = null;
      return;
    }
    if (fence) return;
    if (line.trim() === "") {
      cur = null;
      return;
    }
    const starts = /^\s*(\||[-*+] |\d+\. |#|>)/.test(line) || cur === null;
    if (starts) {
      cur = { line: i + 1, text: line };
      out.push(cur);
    } else cur.text += `\n${line}`;
  });
  return out;
}

// The file a document declares in its header blockquote, e.g. a page doc's
// `檔案 \`design/prototype/pages/x.html\``, or a component doc's
// `未標檔名的行號指 \`…\``. A bare `:N` with no explicit file
// before it in its unit refers to this file.
export function declaredFile(text) {
  for (const line of text.split("\n").slice(0, 8)) {
    if (!line.startsWith(">")) continue;
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
    found.push({
      at: m.index,
      end: m.index + m[0].length,
      path: m[1],
      from: +m[2],
      to: m[3] ? +m[3] : +m[2],
      raw: m[0],
    });
  }
  for (const m of unitText.matchAll(BARE)) {
    if (inQuote(m.index)) continue;
    if (found.some((f) => m.index >= f.at && m.index < f.end)) continue;
    found.push({
      at: m.index,
      end: m.index + m[0].length,
      path: null,
      from: +m[1],
      to: m[2] ? +m[2] : +m[1],
      raw: m[0],
    });
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
    if (
      c.path === null &&
      prev &&
      prev.from === prev.to &&
      RANGE_JOIN.test(unitText.slice(prev.end, c.at))
    ) {
      prev.to = c.from;
      prev.end = c.end;
      prev.raw = unitText.slice(prev.at, c.end);
      continue;
    }
    if (c.mention) {
      lastPath = c.path;
      lastExternal = original(unitText, c.at);
      continue;
    }
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
  if (unitText.trimStart().startsWith("|")) return unitText;
  const cell = unitText.slice(lo, hi);
  const rel = at - lo;
  const stops = /[。！？]/g;
  let sLo = 0;
  let sHi = cell.length;
  for (const m of cell.matchAll(stops)) {
    if (m.index < rel) sLo = m.index + 1;
    else {
      sHi = m.index;
      break;
    }
  }
  return cell.slice(sLo, sHi);
}

// The strings a cited line is expected to contain at least one of.
export function tokensOf(sentence) {
  const strip = sentence.replace(EXPLICIT, " ").replace(BARE, " ");
  const tokens = new Set();
  const addIdents = (s) => {
    for (const m of s.matchAll(/[A-Za-z_$][\w$-]*/g)) {
      const w = m[0].replace(/-+$/, "");
      if (w.length >= 3 && !STOP.has(w.toLowerCase())) tokens.add(w);
    }
  };
  const addQuote = (q) => {
    for (const part of q.replace(/`/g, "").split(/…+|\.\.\.|⋯/)) {
      const t = part.trim().replace(/^[{(\s]+|[})\s]+$/g, "");
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
    if (script) tokens.add(script[1].replace(/-/g, ""));
  }
  for (const m of strip.matchAll(/「([^」]+)」|『([^』]+)』|“([^”]+)”|"([^"\n]+)"/g))
    addQuote(m[1] ?? m[2] ?? m[3] ?? m[4]);
  addIdents(strip.replace(/`[^`]*`/g, " ").replace(/\]\([^)]*\)/g, "]"));
  // A percentage is a value the cited line can be checked for (`12%` in a
  // color-mix). 0% and 100% are too common to prove anything.
  for (const m of strip.matchAll(/(?<![\w.])(\d{1,2}(?:\.\d+)?)%/g))
    if (+m[1] !== 0) tokens.add(`${m[1]}%`);
  return [...tokens];
}

// 『』 is how a quote inside 「…」 is written, so a label quoted in a doc as
// 「…『密碼設定』…」 reads 「密碼設定」 in the cited line.
const norm = (s) => s.replace(/\s+/g, " ").replace(/『/g, "「").replace(/』/g, "」").toLowerCase();

export function lineMatches(lines, from, to, tokens) {
  const text = norm(lines.slice(from - 1, to).join("\n"));
  return tokens.some((t) => text.includes(norm(t)));
}

// The light-theme value of each custom property in the first :root block of
// tokens.css. An SVG cannot read a custom property, so a logo file carries
// the value: `--color-ink` is satisfied by a line that reads #1E1B4B.
export function tokenValues(css) {
  const out = new Map();
  const root = css.match(/:root\s*\{([^}]*)\}/);
  if (!root) return out;
  for (const m of root[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
    out.set(m[1], m[2].trim().toLowerCase());
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
export function contextMatches({
  lines,
  from,
  to,
  tokens,
  doc = "",
  unitText = "",
  values = new Map(),
}) {
  const text = lines.slice(from - 1, to).join("\n");
  for (const t of tokens) {
    // `<style>` or `<script>`: the citation points into that element.
    const el = t.match(/^<(style|script)>$/i);
    if (el && [from, to].every((n) => insideElement(lines, n, el[1].toLowerCase()))) return true;
    // `<span>` is also met by an opening tag with attributes (`<svg viewBox=…>`)
    // and by the CSS selector that styles it (`.metric span {`).
    const tag = t.match(/^<([a-z][a-z0-9]*)>$/i);
    if (
      tag &&
      new RegExp(`<${tag[1]}[\\s/>]|(^|[\\s>+~,(])${tag[1]}(?=\\s*[{,:>.[)]|\\s*$)`, "im").test(
        text,
      )
    )
      return true;
    // A design token is met by its light-theme value.
    const v = t.startsWith("--") ? values.get(t) : undefined;
    if (v && /^#[0-9a-f]{3,8}$/.test(v) && text.toLowerCase().includes(v)) return true;
  }
  // A usage entry of a component doc (a table row, list item or paragraph)
  // opens with the screen that uses the component (`task-management/task-list#state-default`,
  // `components-showcase#comp-banner`); the component it cites is the doc's
  // own, so the doc's slug is what the cited line must name.
  const slug = doc.match(/^design\/system\/components\/([\w-]+)\.md$/)?.[1];
  const firstCell = unitText.match(/^\s*(?:\|\s*|[-*]\s+)?`([^`]+)`/)?.[1] ?? "";
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
  text.split("\n").forEach((line, i) => {
    const h = line.match(/^(#+) /);
    if (h) level = /原件/.test(line) ? h[1].length : level && h[1].length > level ? level : 0;
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
  const lines = text.split("\n");
  const hist = new Set();
  const headings = [];
  lines.forEach((line, i) => {
    const h = line.match(/^(#+) /);
    if (h) headings.push({ i, level: h[1].length });
  });
  let sectionStart = 0;
  lines.forEach((line, i) => {
    if (/^#{1,3} /.test(line)) sectionStart = i;
    if (/上文.{0,8}行號指的?是修正前/.test(line))
      for (let j = sectionStart; j < i; j++) hist.add(j + 1);
    if (/行號仍是[^。]*`[0-9a-f]{7,40}`[^。]*的位置/.test(line)) {
      const own = headings.filter((h) => h.i < i).at(-1) ?? { i: -1, level: 0 };
      const next = headings.find((h) => h.i > i && h.level <= own.level);
      for (let j = own.i + 1; j < (next ? next.i : lines.length); j++) hist.add(j + 1);
    }
    if (/^\|\s*\[#\d+\]\([^)]*\)\s*\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(line)) hist.add(i + 1);
  });
  return hist;
}

// ------------------------------------------- spec references in §Logic Flow
//
// A module index's §Logic Flow cites spec clauses by name, not by file:line:
// `03-01 §點任務進入任務詳情 第 1、2 條`, `01-01 §登入頁 9`,
// `§業務流程「進到任務列表」主流程第 1～3 步`, `01-04「用驗證連結換掉 Email」E1`,
// `§已確認決議 Q19`, `07-04 §事件清單 第 8 列`, `[§四個步驟](./02-task-new.mdx#…)的「…」`.
// Each unit (list item or paragraph) is read left to right, carrying the
// page, section and business flow named so far. 。 ends that context, and so
// does the （…） it was opened in; `同頁` after a 。 picks the page up again.
// A page id followed by 、，。 or 的連結 only names the page and leaves the
// context alone; so does `分段一第 3 條`, an item of this Logic Flow itself.
// In a module with one spec page (02), a § with no page reads against it.
// A code span holding only `E1`, `A2` or `Q3` is read as that id; other
// code spans are skipped.
//
// Verified: the page `NN-NN` exists; `§節名` is a heading on it (the full
// heading, the heading without a trailing （…）, or the part before its ：),
// followed by punctuation or one of a few phrases (的「, 第 N, 與 §, 也只寫,
// 都沒有寫), so `§導向其他頁面說明` is not taken for `§導向其他頁面`;
// 第 N 條 is an item of that section (its numbered items, else its
// top-level bullets, else its table rows), 第 N 列 a table row, 前N條 a
// count; 主流程第 N 步, EN and AN exist in the named flow; QN is a heading on
// the page. A quote 「…」 after `§業務流程` (or after a page) that names a
// flow selects it; one that names a heading or a `- **group**` inside the
// section narrows the section to it. Any other quote must be found verbatim
// (ignoring whitespace and Markdown; … elides) in the narrowest scope it is
// attributed to: the clauses it sits next to (`第 6 條「…」`, `第 6 條寫「…」`,
// `「…」（第 6 條）`), else the flow, else the section (or any section joined
// to it by 與／和／、), else the page. A quote written before its citation
// (`：「…」；05-02 §X`, or `「…」（05-02 §X）` when it is not in the scope
// already named) must be in one of the scopes the references after it name,
// up to the end of their （…） or the sentence. A quote after 沒有寫,
// 不改寫成 or 少了 is what the spec does not say and is not checked. Any
// other quote with no spec reference around it is the item's own wording
// (a button label on the edge) and is not a reference.
// Unverifiable (counted, listed with --verbose): a clause, step, EN/AN or QN
// with no page, section or flow to read it against, `§X同節`, a quote that
// follows a § with no page or waits for a citation that never comes, and
// structural pointers such as 開頭, 末段 or 那張表 not followed by a quote.

const LOGIC_FLOW_HEADING = /^## Logic Flow\s*$/;

// A spec reference the scanner reads wrongly but a person checked: `file`
// is the citing document, `text` a substring of the error, `reason` why the
// reference is right. Prose that cites one page's sentence about another
// page is the usual case. Keep it short; prefer rewording.
export const SPEC_ALLOW = [];

const CN_DIGITS = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

// Spec page id -> repo path: `03-01` -> docs/specs/03-task-management/01-task-list.mdx.
export function specPages(root = ROOT) {
  const out = new Map();
  const base = join(root, "docs/specs");
  if (!existsSync(base)) return out;
  for (const mod of readdirSync(base).sort()) {
    const abs = join(base, mod);
    if (!statSync(abs).isDirectory()) {
      if (mod === "00-prd.mdx") out.set("PRD", "docs/specs/00-prd.mdx");
      continue;
    }
    const m = mod.match(/^(\d\d)-/);
    if (!m) continue;
    for (const f of readdirSync(abs).sort()) {
      const p = f.match(/^(\d\d)-.+\.mdx$/);
      if (p) out.set(`${m[1]}-${p[1]}`, `docs/specs/${mod}/${f}`);
    }
  }
  return out;
}

// Markup a quote is compared without: emphasis, <mark>, the issue <sup>,
// :ref[…]{…}, links, code ticks and all whitespace. 『』 reads as 「」.
export function plain(s) {
  return s
    .replace(/⟦[^⟧]*⟧|⟫/g, "")
    .replace(/<sup>.*?<\/sup>/g, "")
    .replace(/<\/?mark>/g, "")
    .replace(/:ref\[([^\]]*)\]\{[^}]*\}/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|`/g, "")
    .replace(/『/g, "「")
    .replace(/』/g, "」")
    .replace(/\s+/g, "");
}

// The same, keeping single spaces: what a `§節名` is matched against.
function spaced(s) {
  return s
    .replace(/<sup>.*?<\/sup>/g, "")
    .replace(/<\/?mark>/g, "")
    .replace(/:ref\[([^\]]*)\]\{[^}]*\}/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const indentOf = (l) => l.match(/^\s*/)[0].length;

// Headings, business flows and items of one spec page.
export function parseSpecPage(text) {
  const lines = text.split("\n");
  const heads = [];
  let fence = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    const m = !fence && l.match(/^(#{1,6})\s+(.*)$/);
    if (!m) return;
    const full = spaced(m[2].replace(/\s*\{#[^}]*\}\s*$/, ""));
    const names = [full];
    const short = full.replace(/\s*（[^（）]*）$/, "");
    if (short && short !== full) names.push(short);
    // `§進來先驗兩件事` for `### 進來先驗兩件事：任務代號與成員資格`
    const lead = full.split("：")[0];
    if (lead && lead !== full && !/^Q\d/.test(full)) names.push(lead);
    heads.push({ level: m[1].length, names, start: i });
  });
  heads.forEach((h, k) => {
    const next = heads.slice(k + 1).find((x) => x.level <= h.level);
    h.end = next ? next.start : lines.length;
    h.parent = heads.slice(0, k).findLast((x) => x.level < h.level) ?? null;
  });
  const proc = heads.find((h) => h.level === 2 && h.names[0] === "業務流程") ?? null;
  const flows = [];
  if (proc) {
    for (const h of heads)
      if (h.parent === proc) flows.push(flowOf(h.names[0], lines, h.start + 1, h.end, h));
    for (let i = proc.start + 1; i < proc.end; i++) {
      const m = lines[i].match(/^- \*\*(.+?)\*\*\s*$/);
      if (!m) continue;
      let j = i + 1;
      while (j < proc.end && !/^\S/.test(lines[j])) j++;
      flows.push(flowOf(spaced(m[1]), lines, i + 1, j, null));
    }
  }
  return { lines, heads, proc, flows };
}

// A flow's steps (the numbered lines under 主流程), its A/E ids and which
// of 觸發, 前置條件, 主流程 it has.
function flowOf(name, lines, start, end, head) {
  const steps = new Map();
  const ids = new Set();
  const has = new Set();
  let inMain = false;
  let mainIndent = -1;
  for (let i = start; i < end; i++) {
    const l = lines[i];
    const b = l.match(/^(\s*)- (觸發|前置條件|主流程|替代流程|例外流程|結果)/);
    if (b) {
      has.add(b[2]);
      inMain = b[2] === "主流程";
      mainIndent = b[1].length;
      continue;
    }
    const s = l.match(/^(\s*)(\d+)\.\s/);
    if (inMain && s && s[1].length > mainIndent) steps.set(+s[2], l);
    const id = l.match(/^\s*- (?:<mark>)?(?:\*\*)?([AE]\d+)(?![\w])/);
    if (id) ids.add(id[1]);
    // `（例外流程 **E2**）` inside a step of a flow written as a plain list
    for (const x of l.matchAll(/(?:例外|替代)流程\s*(?:\*\*)?([AE]\d+)(?![\w])/g)) ids.add(x[1]);
  }
  // A flow written as a plain numbered list, with no `- 主流程：` bullet:
  // its top-level numbered lines are the main flow.
  if (!has.has("主流程")) {
    const num = [];
    for (let i = start; i < end; i++) {
      const s = lines[i].match(/^(\s*)(\d+)\.\s/);
      if (s) num.push({ ind: s[1].length, n: +s[2], l: lines[i] });
    }
    if (num.length) {
      const ind = Math.min(...num.map((x) => x.ind));
      for (const x of num) if (x.ind === ind) steps.set(x.n, x.l);
      has.add("主流程");
    }
  }
  return { name, start, end, steps, ids, has, head };
}

// The items of a scope, in the three shapes a spec section uses: numbered
// lines (at their smallest indent), top-level bullets, table data rows.
// Each maps an item number to its text; numbered lists that restart in one
// scope merge, so 第 N 條 is any item numbered N there.
export function itemsIn(lines, a, b) {
  const numbered = new Map();
  const bullets = new Map();
  const rows = new Map();
  const add = (map, n, text) => map.set(n, map.has(n) ? `${map.get(n)}\n${text}` : text);
  const num = [];
  const bul = [];
  let fence = false;
  for (let i = a; i < b; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) fence = !fence;
    if (fence) continue;
    const n = lines[i].match(/^(\s*)(?:<mark>)?(\d+)\.\s/);
    if (n) num.push({ i, ind: n[1].length, n: +n[2] });
    const d = lines[i].match(/^(\s*)- /);
    if (d) bul.push({ i, ind: d[1].length });
  }
  if (num.length) {
    const ind = Math.min(...num.map((x) => x.ind));
    const top = num.filter((x) => x.ind === ind);
    top.forEach((x, k) => {
      let j = x.i + 1;
      const stop = k + 1 < top.length ? top[k + 1].i : b;
      while (j < stop && !/^#/.test(lines[j]) && !new RegExp(`^\\s{0,${ind}}- `).test(lines[j]))
        j++;
      add(numbered, x.n, lines.slice(x.i, j).join("\n"));
    });
  }
  if (bul.length) {
    const ind = Math.min(...bul.map((x) => x.ind));
    let k = 0;
    for (const x of bul.filter((y) => y.ind === ind)) {
      let j = x.i + 1;
      while (j < b && (lines[j].trim() === "" || indentOf(lines[j]) > ind)) j++;
      bullets.set(++k, lines.slice(x.i, j).join("\n"));
    }
  }
  let r = 0;
  let header = true;
  for (let i = a; i < b; i++) {
    const l = lines[i];
    if (!/^\s*\|/.test(l)) {
      header = true;
      continue;
    }
    if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue;
    if (header) {
      header = false;
      continue;
    }
    rows.set(++r, l);
  }
  return { numbered, bullets, rows };
}

// Which shape 第 N 條 / 第 N 列 counts in.
function itemModel(items, unit) {
  const order =
    unit === "列"
      ? [
          ["rows", "table rows"],
          ["bullets", "bullets"],
        ]
      : [
          ["numbered", "numbered items"],
          ["bullets", "bullets"],
          ["rows", "table rows"],
        ];
  for (const [key, label] of order) if (items[key].size) return { map: items[key], label };
  return null;
}

// `6、8`, `1～3`, `24、26、30`, `6～8` -> [6, 8], [1, 2, 3], ...
export function numbersOf(s) {
  const out = [];
  for (const part of s.split(/\s*[、，,與和及]\s*(?:第\s*)?/)) {
    const r = part.match(/^(\d+)\s*[～~–-]\s*(\d+)$/);
    if (r) for (let n = +r[1]; n <= +r[2]; n++) out.push(n);
    else if (/^\d+$/.test(part.trim())) out.push(+part.trim());
  }
  return out;
}

const span = (ns) => (ns.length > 1 ? `${ns[0]}～${ns.at(-1)}` : `${ns[0]}`);
const describe = (map) => {
  const ks = [...map.keys()].sort((a, b) => a - b);
  return ks.length ? `${ks.length}: ${span(ks)}` : "none";
};

// The text after an opening 「 up to its balanced 」, or null.
function balancedQuote(s, at) {
  let depth = 0;
  for (let i = at; i < s.length; i++) {
    if (s[i] === "「") depth++;
    else if (s[i] === "」" && --depth === 0) return { q: s.slice(at + 1, i), end: i + 1 };
  }
  return null;
}

// Does `hay` contain `needle` verbatim? An ellipsis in the quote elides.
function quoted(hay, needle) {
  const parts = plain(needle)
    .split(/…+|\.\.\.|⋯/)
    .filter(Boolean);
  const h = plain(hay);
  let from = 0;
  for (const p of parts) {
    const at = h.indexOf(p, from);
    if (at < 0) return false;
    from = at + p.length;
  }
  return parts.length > 0;
}

// Turns a unit into the text the scanner reads: code spans and emphasis
// dropped, a link to a spec page replaced by ⟦NN-NN⟧ and its label. A code
// span that holds only a flow id or a decision id (`E1`, `A2`, `Q3`) stays,
// unwrapped, so it is checked like the bare id.
function prepUnit(text, fromDir, byPath) {
  return text
    .replace(/`([^`\n]*)`/g, (_, inner) => (/^(?:[AE]|Q)\d+$/.test(inner) ? ` ${inner} ` : " "))
    .replace(/<sup>.*?<\/sup>/g, "")
    .replace(/<\/?mark>/g, "")
    .replace(/\*\*/g, "")
    .replace(/:ref\[([^\]]*)\]\{[^}]*\}/g, "$1")
    .replace(/\[([^\]\n]*)\]\(([^)\s]*)\)/g, (_, label, href) => {
      const path = href.split("#")[0];
      if (!path) return label;
      const id = byPath.get(join(fromDir, path).split(sep).join("/"));
      return id ? `⟦${id}⟧${label}⟫` : label;
    });
}

const TOKEN = new RegExp(
  [
    String.raw`⟦(?<link>[^⟧]+)⟧`,
    String.raw`(?<![\w-])(?<page>\d\d-\d\d)(?![\w-])`,
    String.raw`(?<![A-Za-z])(?<prd>PRD)(?![A-Za-z])`,
    String.raw`(?<sect>§)`,
    String.raw`(?<proc>業務流程)(?=\s*的?\s*「)`,
    String.raw`(?<quote>「)`,
    String.raw`第\s*(?<nums>\d+(?:\s*(?:[、，,～~–-]|與第?|和第?)\s*\d+)*)\s*(?<unit>條|列|步)`,
    String.raw`(?<main>主流程)`,
    String.raw`(?<![A-Za-z0-9])(?<ea>[AE]\d+)(?![\w])`,
    String.raw`(?<![A-Za-z0-9])Q(?<q>\d+)(?!\d)`,
    String.raw`前(?<first>[一二兩三四五六七八九十]|\d+)(?<firstUnit>條|列)`,
    String.raw`(?<vague>那張表|末段|開頭)`,
    String.raw`(?<stop>。)`,
    String.raw`(?<semi>[；;])`,
    String.raw`(?<open>[（(])`,
    String.raw`(?<close>[）)])`,
  ].join("|"),
  "g",
);
// Bare item numbers right after a section, a narrowing quote or 主流程:
// `§導向其他頁面 4`, `§規格「…」1～3`, `主流程 1～3`.
const BARE_NUMS =
  /^\s*(\d+(?:\s*[、～~–-]\s*\d+)*)(?![\d\w%.:])(?!\s*(?:條|列|步|個|種|筆|字|人|次|頁|天|週|小時|分鐘|秒|%))/;
// What may follow a heading name: punctuation, the end of a link label (⟫),
// or one of the few phrases written straight after it in the specs
// (`§X的「…」`, `§X第 3 條`, `§X與 §Y`, `§X也只寫`, `§X都沒有寫`). Anything
// else means the cited name is longer than the heading, e.g. `§導向其他頁面說明`.
const HEADING_END =
  /^(?:$|[\s「『（(；;，,。、）)⟦⟫：:]|的「|第\s*\d|(?:與|和|及)\s*(?:⟦|§|\d\d-\d\d)|也只?寫|還明?寫|都沒有?寫|只寫|說「|同節)/;

// Checks the spec references of one unit. `report(kind, message, at)` gets
// "verified", "unverifiable" or "error"; `at` is the offset in the unit.
export function checkSpecRefsIn(
  unitText,
  { fromDir, pages, byPath, load, report, defaultPage = null },
) {
  const t = prepUnit(unitText, fromDir, byPath);
  const st = { page: null, pageId: null, bad: false, sec: null, scope: null, flow: null };
  let clauses = null; // { nums, end, model } of the last 第 N 條
  // A context opened inside （…） ends with it: `（07-01 §X 第 2 條），所以「否」…`
  let depth = 0;
  let openedAt = 0;
  // `§A 與 §B 來說明「…」`: a quote may sit in any section joined that way.
  let joint = [];
  let secEnd = -1;
  let lastPageId = null; // for 同頁 after a 。
  let lfFrom = -1; // end of the last `§Logic Flow`
  // A quote written before its citation, `：「…」；05-02 §X` or
  // `「…」（05-02 §X；§Y）`, waits for the references that follow it and must
  // be found in one of the scopes they name.
  let pending = [];
  const seen = () => {
    if (st.sec || st.flow)
      for (const p of pending) if (p.armed) p.scopes.push([where(), scopeText()]);
  };
  const settle = () => {
    seen();
    for (const p of pending) {
      // a page cited with no section after it is the scope then
      if (!p.scopes.length && p.armed && st.page) p.scopes.push([where(), scopeText()]);
      if (!p.scopes.length)
        report("unverifiable", `「${p.q}」 with no spec reference after it`, p.at);
      else if (p.scopes.some(([, x]) => quoted(x, p.q))) report("verified", null, p.at);
      else
        report(
          "error",
          `「${p.q}」 is not in ${[...new Set(p.scopes.map(([w]) => w))].join(" or ")}`,
          p.at,
        );
    }
    pending = [];
  };
  const reset = () => {
    if (st.pageId) lastPageId = st.pageId;
    st.page = st.pageId = st.sec = st.scope = st.flow = null;
    st.bad = false;
    clauses = null;
    joint = [];
  };
  const where = () =>
    `${st.pageId}${st.sec ? ` §${st.sec.names[0]}` : ""}${st.flow ? `「${st.flow.name}」` : ""}`;
  const setPage = (id, at) => {
    st.page = null;
    st.pageId = null;
    st.sec = st.scope = st.flow = null;
    clauses = null;
    joint = [];
    openedAt = depth;
    st.bad = !pages.has(id);
    if (st.bad) {
      report("error", `no spec page ${id}`, at);
      return;
    }
    st.page = load(id);
    st.pageId = id;
  };
  // In a module with a single spec page, a reference with no page reads
  // against that page.
  const ensurePage = (at) => {
    if (!st.page && !st.bad && defaultPage) setPage(defaultPage, at);
    return st.page;
  };
  const setSection = (h) => {
    st.sec = h;
    st.scope = [h.start, h.end];
    st.flow = st.page.flows.find((f) => f.head === h) ?? null;
    clauses = null;
  };
  const scopeText = () => {
    if (st.flow) return st.page.lines.slice(st.flow.start - 1, st.flow.end).join("\n");
    if (st.scope) return st.page.lines.slice(st.scope[0], st.scope[1]).join("\n");
    return st.page.lines.join("\n");
  };
  const scopeItems = () => {
    const [a, b] = st.flow ? [st.flow.start, st.flow.end] : st.scope;
    return itemsIn(st.page.lines, a, b);
  };
  // Verifies item numbers against the current scope; returns the model.
  const checkItems = (nums, unit, at, end) => {
    if (!st.page) return report("unverifiable", `第 ${span(nums)} ${unit} with no spec page`, at);
    if (!st.sec && !st.flow)
      return report("unverifiable", `第 ${span(nums)} ${unit} with no section (${st.pageId})`, at);
    const model = itemModel(scopeItems(), unit);
    if (!model)
      return report("error", `${where()} has no items to count 第 ${span(nums)} ${unit} in`, at);
    const missing = nums.filter((n) => !model.map.has(n));
    if (missing.length)
      report(
        "error",
        `${where()} has no 第 ${missing.join("、")} ${unit} (${model.label} ${describe(model.map)})`,
        at,
      );
    else report("verified", null, at);
    clauses = { nums, end, model };
  };
  const checkSteps = (nums, at) => {
    if (!st.flow) return report("unverifiable", `主流程第 ${span(nums)} 步 with no flow named`, at);
    const missing = nums.filter((n) => !st.flow.steps.has(n));
    if (missing.length)
      report(
        "error",
        `${st.pageId}「${st.flow.name}」主流程 has no 第 ${missing.join("、")} 步 (steps ${describe(st.flow.steps)})`,
        at,
      );
    else report("verified", null, at);
  };
  const flowNamed = (q) => st.page.flows.find((f) => plain(f.name) === plain(q)) ?? null;
  // A heading or a `- **group**` inside the current scope named by the quote.
  const groupNamed = (q) => {
    const [a, b] = st.scope;
    const h = st.page.heads.find(
      (x) => x.start >= a && x.start < b && x.names.some((n) => plain(n) === plain(q)),
    );
    if (h) return { head: h };
    for (let i = a; i < b; i++) {
      const m = st.page.lines[i].match(/^(\s*)- \*\*(.+?)\*\*\s*$/);
      if (!m || plain(m[2]) !== plain(q)) continue;
      let j = i + 1;
      while (j < b && (st.page.lines[j].trim() === "" || indentOf(st.page.lines[j]) > m[1].length))
        j++;
      return { range: [i + 1, j] };
    }
    return null;
  };
  // Where in the section a quote that missed its clauses actually is.
  const foundIn = (q, model) => {
    const hits = [...model.map].filter(([, text]) => quoted(text, q)).map(([n]) => n);
    return hits.length ? `it is in 第 ${hits.join("、")} 條` : null;
  };

  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(t))) {
    const g = m.groups;
    const at = m.index;
    let end = at + m[0].length;
    if (g.link || g.page || g.prd) {
      // `歸給規格 07-01、` or `（02-01）` names a page without citing anything
      // in it; it leaves the context alone.
      if (!g.link && /^\s*(?:$|[、，,。；;）)]|的連結)/.test(t.slice(end))) continue;
      seen();
      setPage(g.link ?? g.page ?? g.prd, at);
      for (const p of pending) p.armed = true;
      continue;
    }
    if (g.stop) {
      settle();
      reset();
      continue;
    }
    if (g.open) {
      depth++;
      continue;
    }
    if (g.close) {
      depth = Math.max(0, depth - 1);
      // the group that followed the quote, or the one the quote sat in, closed
      if ((st.pageId || st.bad) && depth < openedAt) {
        if (pending.some((p) => p.armed)) settle();
        reset();
      }
      if (pending.some((p) => depth < p.depth)) settle();
      continue;
    }
    if (g.semi) {
      seen();
      clauses = null;
      continue;
    }
    if (g.sect) {
      const rest = t.slice(end).replace(/^\s+/, "");
      const token = rest.match(/^[^\s「（；，。）]*/)[0];
      // `§Logic Flow` names a module Logic Flow (or this one), not a spec
      // section. What follows it -- `分段三第 2 條`, `盤點「沒畫的進入」` --
      // belongs to that Logic Flow, so the spec page named before it no
      // longer applies, and a quote right after it is that page's own wording.
      if (rest.startsWith("Logic Flow")) {
        if (st.pageId || st.bad) {
          if (pending.some((p) => p.armed)) settle();
          reset();
        }
        lfFrom = end;
        continue;
      }
      seen();
      // `同頁 §刪除任務` after a 。 reads against the page named before it
      if (!st.page && lastPageId && /同一?頁\s*$/.test(t.slice(0, at))) setPage(lastPageId, at);
      if (!ensurePage(at)) {
        if (!st.bad) report("unverifiable", `§${token} with no spec page`, at);
        continue;
      }
      let best = null;
      let bestLen = 0;
      for (const h of st.page.heads)
        for (const n of h.names)
          if (n.length > bestLen && rest.startsWith(n) && HEADING_END.test(rest.slice(n.length))) {
            best = h;
            bestLen = n.length;
          }
      if (!best) {
        report("error", `${st.pageId} has no heading §${token}`, at);
        st.sec = st.scope = st.flow = null;
        joint = [];
        continue;
      }
      // `§規格同節第 5 條`: the section an earlier item named, which this
      // unit does not carry
      const same = rest.slice(bestLen).match(/^同節\s*(?:第\s*[\d\s、～~–-]+?\s*條)?/);
      if (same) {
        report(
          "unverifiable",
          `§${best.names[0]}${same[0]} (a section named in an earlier item)`,
          at,
        );
        st.sec = st.scope = st.flow = null;
        TOKEN.lastIndex = t.length - rest.length + bestLen + same[0].length;
        continue;
      }
      const joined = st.sec && /^[⟫\s]*(?:與|和|及|、)\s*$/.test(t.slice(secEnd, at));
      joint = joined ? [...joint, scopeText()] : [];
      setSection(best);
      report("verified", null, at);
      end = t.length - rest.length + bestLen;
      secEnd = end;
      TOKEN.lastIndex = end;
      const b = t.slice(end).match(BARE_NUMS);
      if (b) {
        checkItems(numbersOf(b[1]), "條", end, end + b[0].length);
        TOKEN.lastIndex = end + b[0].length;
      }
      continue;
    }
    if (g.proc) {
      if (!st.page) continue;
      if (!st.page.proc) {
        report("error", `${st.pageId} has no §業務流程`, at);
        continue;
      }
      setSection(st.page.proc);
      report("verified", null, at);
      continue;
    }
    if (g.quote) {
      const bq = balancedQuote(t, at);
      if (!bq) continue;
      TOKEN.lastIndex = bq.end;
      // `§Logic Flow 盤點「沒畫的進入」`: a Logic Flow's own heading words
      if (lfFrom >= 0 && !st.page && /^[^「」（）；;。]*$/.test(t.slice(lfFrom, at))) continue;
      // a quote followed straight by its citation waits for it
      const followed = /^\s*（\s*(?:⟦|\d\d-\d\d|PRD)/.test(t.slice(bq.end));
      const orphan =
        !st.page && /^\s*(?:[；;，,：:]\s*|（\s*)?(?:⟦|\d\d-\d\d|PRD|§)/.test(t.slice(bq.end));
      // after a § that had no page to read against (`§驗收標準 的 Scenario「…」`,
      // `§驗收標準「a」「b」`): it belongs to that §
      if (
        !st.page &&
        /§[^「」；;。（）\s]+(?:[^「；;。（）]|「[^「」]*」){0,16}$/.test(t.slice(0, at))
      ) {
        report("unverifiable", `「${bq.q}」 after a § with no spec page`, at);
        continue;
      }
      if (orphan) {
        pending.push({ q: bq.q, at, depth, armed: false, scopes: [] });
        continue;
      }
      if (!st.page) continue;
      const q = bq.q;
      // `沒有寫「…」`, `不改寫成「…」`: what the spec does not say.
      if (
        /(?:(?:沒有|沒|未|不)(?:寫|說|提|定|改寫成|改成)|少了)[^「。；]{0,6}$/.test(t.slice(0, at))
      )
        continue;
      const inProc = st.sec && st.page.proc && (st.sec === st.page.proc || st.flow);
      const f = (!st.sec || inProc) && flowNamed(q);
      if (f) {
        st.flow = f;
        clauses = null;
        report("verified", null, at);
        const b = t.slice(bq.end).match(BARE_NUMS);
        if (b) {
          checkSteps(numbersOf(b[1]), bq.end);
          TOKEN.lastIndex = bq.end + b[0].length;
        }
        continue;
      }
      const grp = st.sec && !st.flow && groupNamed(q);
      if (grp) {
        if (grp.head) setSection(grp.head);
        else {
          st.scope = grp.range;
          clauses = null;
        }
        report("verified", null, at);
        const b = t.slice(bq.end).match(BARE_NUMS);
        if (b) {
          checkItems(numbersOf(b[1]), "條", bq.end, bq.end + b[0].length);
          TOKEN.lastIndex = bq.end + b[0].length;
        }
        continue;
      }
      // the clauses this quote sits next to, before or after it
      let bound = null;
      if (clauses && /^\s*(?:的|說|寫|只寫|明寫|也只寫|寫的是)?\s*$/.test(t.slice(clauses.end, at)))
        bound = clauses;
      // `「…」（第 6 條）` or `「…」，第 6 條）`: the clause closes the reference
      const after = t
        .slice(bq.end)
        .match(
          /^\s*(?:（\s*第\s*([\d\s、～~–-]+?)\s*條\s*）|[，,]\s*第\s*([\d\s、～~–-]+?)\s*條\s*(?=[）)；;。]|$))/,
        );
      if (!bound && after && (st.sec || st.flow)) {
        const model = itemModel(scopeItems(), "條");
        if (model) bound = { nums: numbersOf(after[1] ?? after[2]), model };
      }
      if (bound) {
        const texts = bound.nums.map((n) => bound.model.map.get(n)).filter(Boolean);
        if (texts.some((x) => quoted(x, q))) {
          report("verified", null, at);
          continue;
        }
        if (bound.nums.some((n) => !bound.model.map.has(n))) continue; // the number already failed
        const hint = foundIn(q, bound.model);
        report(
          "error",
          `「${q}」 is not in ${where()} 第 ${bound.nums.join("、")} 條${hint ? `; ${hint}` : quoted(scopeText(), q) ? "; it is elsewhere in that scope" : ""}`,
          at,
        );
        continue;
      }
      if (quoted(scopeText(), q) || joint.some((x) => quoted(x, q))) report("verified", null, at);
      else if (followed) pending.push({ q, at, depth, armed: false, scopes: [] });
      else {
        const page = quoted(st.page.lines.join("\n"), q);
        report(
          "error",
          `「${q}」 is not in ${where() || st.pageId}${page && (st.sec || st.flow) ? ` (it is elsewhere on ${st.pageId})` : ""}`,
          at,
        );
      }
      continue;
    }
    if (g.nums) {
      // `分段一第 3 條` is an item of this Logic Flow, not of a spec
      if (/分段[一二三四五六七八九十\d]+\s*$/.test(t.slice(0, at))) continue;
      const nums = numbersOf(g.nums);
      if (g.unit === "步") checkSteps(nums, at);
      else checkItems(nums, g.unit, at, end);
      continue;
    }
    if (g.main) {
      if (!st.flow) {
        report(
          "unverifiable",
          `主流程 with no flow named${st.pageId ? ` (${st.pageId})` : ""}`,
          at,
        );
        const b = t.slice(end).match(BARE_NUMS);
        if (b) TOKEN.lastIndex = end + b[0].length;
        continue;
      }
      if (!st.flow.has.has("主流程")) report("error", `${where()} has no 主流程`, at);
      else report("verified", null, at);
      const b = t.slice(end).match(BARE_NUMS);
      if (b) {
        checkSteps(numbersOf(b[1]), end);
        TOKEN.lastIndex = end + b[0].length;
      }
      continue;
    }
    if (g.ea) {
      if (!st.flow) {
        report(
          "unverifiable",
          `${g.ea} with no flow named${st.pageId ? ` (${st.pageId})` : ""}`,
          at,
        );
        continue;
      }
      if (st.flow.ids.has(g.ea)) report("verified", null, at);
      else
        report(
          "error",
          `${st.pageId}「${st.flow.name}」 has no ${g.ea} (it has ${[...st.flow.ids].join("、") || "none"})`,
          at,
        );
      continue;
    }
    if (g.q) {
      if (!ensurePage(at)) {
        report("unverifiable", `Q${g.q} with no spec page`, at);
        continue;
      }
      if (st.page.heads.some((h) => new RegExp(`^Q${g.q}[.．]`).test(h.names[0])))
        report("verified", null, at);
      else report("error", `${st.pageId} has no §已確認決議 Q${g.q}`, at);
      continue;
    }
    if (g.first) {
      const n = CN_DIGITS[g.first] ?? +g.first;
      if (!st.page || (!st.sec && !st.flow)) {
        report("unverifiable", `前${g.first}${g.firstUnit} with no section`, at);
        continue;
      }
      const model = itemModel(scopeItems(), g.firstUnit);
      if (model && model.map.size >= n) report("verified", null, at);
      else
        report(
          "error",
          `${where()} has fewer than ${n} ${model ? model.label : "items"} (前${g.first}${g.firstUnit})`,
          at,
        );
      continue;
    }
    if (g.vague) {
      if (!st.page || !st.sec) continue;
      // `末段的補充條明說「…」`: the quote that follows is checked
      if (/^[^「。；]{0,8}「/.test(t.slice(end))) continue;
      report("unverifiable", `${where()} ${g.vague}`, at);
    }
  }
  settle();
}

// The §Logic Flow section of a module index, as units with their lines.
// The @ai-visualize comment, imports and JSX lines are left out: the prompt
// restates the section and its component is checked from the .tsx.
export function logicFlowUnits(text) {
  const lines = text.split("\n");
  const from = lines.findIndex((l) => LOGIC_FLOW_HEADING.test(l));
  if (from < 0) return [];
  let to = lines.findIndex((l, i) => i > from && /^## /.test(l));
  if (to < 0) to = lines.length;
  let comment = false;
  const kept = lines.map((l, i) => {
    if (i <= from || i >= to) return "";
    if (/^\s*\{\/\*/.test(l)) comment = !/\*\/\}\s*$/.test(l);
    else if (comment) {
      if (/\*\/\}\s*$/.test(l)) comment = false;
      return "";
    } else if (!/^\s*(<|import\s)/.test(l)) return l;
    return "";
  });
  return units(kept.join("\n"));
}

// Module indexes with a §Logic Flow, then the specs index when it carries the
// system-wide overview, and the Logic Flow components.
export const OVERVIEW_DOC = "docs/specs/index.mdx";

export function logicFlowDocs(root = ROOT) {
  const base = join(root, "docs/specs");
  if (!existsSync(base)) return [];
  return [
    ...readdirSync(base)
      .sort()
      .map((d) => `docs/specs/${d}/index.mdx`),
    OVERVIEW_DOC,
  ]
    .filter((p) => existsSync(join(root, p)) && statSync(join(root, p)).isFile())
    .filter((p) =>
      readFileSync(join(root, p), "utf8")
        .split("\n")
        .some((l) => LOGIC_FLOW_HEADING.test(l)),
    );
}

export function logicFlowComponentFiles(root = ROOT) {
  const dir = join(root, ".notecraft/components");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^spec-(?:\d\d-.+|index)-logic-flow\.tsx$/.test(f))
    .sort()
    .map((f) => `.notecraft/components/${f}`);
}

// The `text:` of each edge in a Logic Flow component, with its line.
export function componentTexts(src) {
  const out = [];
  for (const m of src.matchAll(/\btext:\s*"((?:[^"\\]|\\.)*)"/g))
    out.push({ text: JSON.parse(`"${m[1]}"`), line: src.slice(0, m.index).split("\n").length });
  return out;
}

// The segments of a module §Logic Flow: `### 分段一：…` headings, each with
// the numbers of its numbered items.
export function logicFlowSegments(text) {
  const lines = text.split("\n");
  const from = lines.findIndex((l) => LOGIC_FLOW_HEADING.test(l));
  const segs = new Map();
  if (from < 0) return segs;
  let cur = null;
  for (let i = from + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^## /.test(l)) break;
    const h = l.match(/^### 分段([一二三四五六七八九十]+)：/);
    if (h) {
      cur = new Set();
      segs.set(h[1], cur);
      continue;
    }
    if (/^#{1,3} |^<details>/.test(l)) cur = null;
    const item = cur && l.match(/^(\d+)\.\s/);
    if (item) cur.add(Number(item[1]));
  }
  return segs;
}

// The overview in the specs index cites module Logic Flows as
// `02 §Logic Flow 分段三第 2 條、分段四第 2～4 條`. Each segment must exist in
// module 02's §Logic Flow and hold each item number.
const LF_REF = new RegExp(
  String.raw`(?<![\d-])(\d\d) §Logic Flow((?:\s*[、，,]?\s*分段[一二三四五六七八九十]+第\s*\d+(?:\s*[、～~–-]\s*\d+)*\s*條)+)`,
  "g",
);
const LF_ITEM = /分段([一二三四五六七八九十]+)第\s*(\d+(?:\s*[、～~–-]\s*\d+)*)\s*條/g;

export function checkLogicFlowRefsIn(text, { segmentsOf, report }) {
  for (const m of text.matchAll(LF_REF)) {
    const mod = m[1];
    const segs = segmentsOf(mod);
    if (!segs) {
      report("error", `no module ${mod} with a §Logic Flow`, m.index);
      continue;
    }
    for (const it of m[2].matchAll(LF_ITEM)) {
      const at = m.index + m[0].length - m[2].length + it.index;
      const seg = segs.get(it[1]);
      if (!seg) {
        report("error", `${mod} §Logic Flow has no 分段${it[1]}`, at);
        continue;
      }
      const missing = numbersOf(it[2]).filter((n) => !seg.has(n));
      if (missing.length)
        report(
          "error",
          `${mod} §Logic Flow 分段${it[1]} has no 第 ${missing.join("、")} 條 (items ${describe(new Map([...seg].map((n) => [n, ""])))})`,
          at,
        );
      else report("verified", null, at);
    }
  }
}

export function checkSpecRefs({
  root = ROOT,
  docs = logicFlowDocs(root),
  components = logicFlowComponentFiles(root),
  allow = SPEC_ALLOW,
} = {}) {
  const pages = specPages(root);
  const byPath = new Map([...pages].map(([id, p]) => [p, id]));
  const cache = new Map();
  const load = (id) => {
    if (!cache.has(id))
      cache.set(id, parseSpecPage(readFileSync(join(root, pages.get(id)), "utf8")));
    return cache.get(id);
  };
  const errors = [];
  const notes = [];
  const stats = { refs: 0, verified: 0, unverifiable: 0, allowed: 0, mirrored: 0 };
  const seen = new Map(); // module number -> bullet texts already checked
  // The one spec page of a single-page module (02 has only 02-01).
  const onlyPage = (mod) => {
    const ids = [...pages.keys()].filter((id) => id.startsWith(`${mod}-`));
    return ids.length === 1 ? ids[0] : null;
  };
  const usedAllow = new Set();
  const run = (text, fromDir, whereOf, mod) =>
    checkSpecRefsIn(text, {
      fromDir,
      pages,
      byPath,
      load,
      defaultPage: mod ? onlyPage(mod) : null,
      report: (kind, msg, at) => {
        stats.refs++;
        const where = whereOf(at);
        if (kind === "verified") stats.verified++;
        else if (kind === "unverifiable") {
          stats.unverifiable++;
          notes.push(`${where}: ${msg}`);
        } else {
          const a = allow.findIndex((x) => where.startsWith(`${x.file}:`) && msg.includes(x.text));
          if (a >= 0) {
            stats.allowed++;
            usedAllow.add(a);
          } else errors.push(`${where}: ${msg}`);
        }
      },
    });
  // module number -> its §Logic Flow segments, for the overview's references
  const segCache = new Map();
  const segmentsOf = (mod) => {
    if (!segCache.has(mod)) {
      const doc = docs.find((d) => d.startsWith(`docs/specs/${mod}-`));
      segCache.set(mod, doc ? logicFlowSegments(readFileSync(join(root, doc), "utf8")) : null);
    }
    const segs = segCache.get(mod);
    return segs && segs.size ? segs : null;
  };
  for (const doc of docs) {
    const text = readFileSync(join(root, doc), "utf8");
    const overview = doc === OVERVIEW_DOC;
    const mod = overview ? "index" : doc.match(/docs\/specs\/(\d\d)-/)?.[1];
    const bodies = new Set();
    for (const u of logicFlowUnits(text)) {
      bodies.add(u.text.replace(/^\s*\d+\.\s+/, "").trim());
      const whereOf = (at) => `${doc}:${u.line + u.text.slice(0, at).split("\n").length - 1}`;
      run(u.text, dirname(doc), whereOf, overview ? null : mod);
      if (overview)
        checkLogicFlowRefsIn(u.text, {
          segmentsOf,
          report: (kind, msg, at) => {
            stats.refs++;
            if (kind === "verified") stats.verified++;
            else errors.push(`${whereOf(at)}: ${msg}`);
          },
        });
    }
    if (mod) seen.set(mod, bodies);
  }
  for (const file of components) {
    const mod = /spec-index-/.test(file) ? "index" : file.match(/spec-(\d\d)-/)?.[1];
    const doc =
      mod === "index"
        ? docs.find((d) => d === OVERVIEW_DOC)
        : docs.find((d) => d.includes(`/${mod}-`));
    for (const { text, line } of componentTexts(readFileSync(join(root, file), "utf8"))) {
      // a text identical to a bullet of its index was checked there
      if (seen.get(mod)?.has(text.trim())) {
        stats.mirrored++;
        continue;
      }
      run(text, doc ? dirname(doc) : "docs/specs", () => `${file}:${line}`, mod);
    }
  }
  // an entry for a file this run did not read cannot be judged unused
  allow.forEach((x, i) => {
    if (!usedAllow.has(i) && docs.includes(x.file))
      errors.push(`spec allowlist entry for ${x.file} ("${x.text}") matched nothing; remove it`);
  });
  return { errors, notes, stats };
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
          const rel = relative(root, p).split(sep).join("/");
          if (exts.some((e) => name.endsWith(e)) && !skip.includes(rel)) out.push(rel);
        }
      }
    };
    walk(abs);
  }
  return out;
}

export function checkCitations({
  root = ROOT,
  docs = docsToScan(root),
  allow = ALLOW,
  logicFlowDocs: lfDocs = logicFlowDocs(root),
  logicFlowComponents: lfComponents = logicFlowComponentFiles(root),
} = {}) {
  const index = buildIndex(root);
  const cache = new Map();
  const linesOf = (file) => {
    if (!cache.has(file)) cache.set(file, readFileSync(index.get(file), "utf8").split("\n"));
    return cache.get(file);
  };
  const errors = [];
  const warnings = [];
  const stats = { citations: 0, historical: 0, external: 0, allowed: 0, verified: 0, unnamed: 0 };
  const usedAllow = new Set();
  const tokensCss = index.get("design/prototype/assets/tokens.css");
  const values = tokensCss ? tokenValues(readFileSync(tokensCss, "utf8")) : new Map();
  for (const doc of docs) {
    const text = readFileSync(join(root, doc), "utf8");
    const hist = historicalLines(text);
    const fallback = declaredFile(text);
    const orig = originalLines(text);
    for (const u of units(text)) {
      for (const c of citationsIn(u.text, fallback)) {
        const lineNo = u.line + u.text.slice(0, c.at).split("\n").length - 1;
        const where = `${doc}:${lineNo}`;
        stats.citations++;
        if (hist.has(lineNo)) {
          stats.historical++;
          continue;
        }
        if (c.external || orig.has(lineNo)) {
          stats.external++;
          continue;
        }
        if (!c.path) {
          errors.push(
            `${where}: \`${c.raw.trim()}\` has no file before it in the same paragraph, list item or table row`,
          );
          continue;
        }
        const r = resolveFile(c.path, doc, index);
        if (r.error) {
          errors.push(`${where}: ${r.error}`);
          continue;
        }
        const lines = linesOf(r.file);
        const count = lines.at(-1) === "" ? lines.length - 1 : lines.length;
        if (c.from < 1 || c.to > count || c.to < c.from) {
          errors.push(
            `${where}: ${c.bare ? `\`${c.raw.trim()}\` (${c.path})` : `\`${c.raw.trim()}\``} is outside ${r.file} (${count} lines)`,
          );
          continue;
        }
        const sentence = sentenceAround(u.text, c.at, c.end);
        const tokens = tokensOf(sentence);
        // A sentence that names nothing (only Chinese prose and the citation)
        // gives the heuristic nothing to look for; it is counted, not warned.
        if (tokens.length === 0) {
          stats.unnamed++;
          continue;
        }
        if (
          lineMatches(lines, c.from, c.to, tokens) ||
          contextMatches({ lines, from: c.from, to: c.to, tokens, doc, unitText: u.text, values })
        ) {
          stats.verified++;
          continue;
        }
        const lineText = u.text.split("\n")[lineNo - u.line];
        const a = allow.findIndex(
          (x) => x.file === doc && lineText.includes(x.text) && (!x.cite || c.raw.includes(x.cite)),
        );
        if (a >= 0) {
          stats.allowed++;
          usedAllow.add(a);
          continue;
        }
        const span = c.from === c.to ? `${c.from}` : `${c.from}-${c.to}`;
        const shown = lines
          .slice(c.from - 1, Math.min(c.to, c.from + 2))
          .join(" ⏎ ")
          .trim()
          .slice(0, 120);
        warnings.push(
          `${where}: ${r.file}:${span} names none of [${tokens.slice(0, 6).join(", ")}${tokens.length > 6 ? ", …" : ""}]; the line reads: ${shown}`,
        );
      }
    }
  }
  allow.forEach((x, i) => {
    if (!usedAllow.has(i))
      errors.push(`allowlist entry for ${x.file} ("${x.text}") matched nothing; remove it`);
  });
  const spec = checkSpecRefs({ root, docs: lfDocs, components: lfComponents });
  errors.push(...spec.errors);
  return { errors, warnings, stats, docs: docs.length, spec };
}

// Errors always fail. With --strict, an unverified citation (WARN) fails too,
// so CI catches a line number that drifted onto an unrelated line.
export function failed({ errors, warnings }, { strict = false } = {}) {
  return errors.length > 0 || (strict && warnings.length > 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkCitations();
  const { errors, warnings, stats, docs, spec } = result;
  for (const w of warnings) console.warn(`WARN  ${w}`);
  if (process.argv.includes("--verbose")) for (const n of spec.notes) console.warn(`NOTE  ${n}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  const s = spec.stats;
  const summary = `${docs} documents, ${stats.citations} citations: ${stats.verified} verified, ${warnings.length} unverified (WARN), ${stats.unnamed} naming nothing to check, ${stats.allowed} allowlisted, ${stats.historical} historical, ${stats.external} external; §Logic Flow spec references: ${s.refs} checked, ${s.verified} verified, ${s.unverifiable} unverifiable (NOTE, --verbose lists them), ${s.allowed} allowlisted; ${errors.length} errors`;
  if (failed(result, { strict: process.argv.includes("--strict") })) {
    console.error(`check-citations: ${summary}`);
    process.exit(1);
  }
  console.log(`check-citations: ${summary}`);
}
