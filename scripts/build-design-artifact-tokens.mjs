#!/usr/bin/env node
// Converts design/prototype/assets/tokens.css into the Design System Artifact's
// project/tokens.json. Node 22 built-ins only.
//
//   node scripts/build-design-artifact-tokens.mjs             write tokens.json
//   node scripts/build-design-artifact-tokens.mjs --check     verify tokens.json against tokens.css
//   node scripts/build-design-artifact-tokens.mjs --contrast  print the WCAG contrast table
//
// Usage notes live in the hand-maintained sidecar design/system/artifact/token-usage.json.
// A token's usage is the sidecar note, then the computed contrast summary (text and UI
// colours), then the line comment tokens.css carries for it. Values are copied, never
// re-tinted: a value the artifact format cannot hold (color-mix(), calc(), a named colour,
// a var() with a fallback) is reported as skipped and left out.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PATHS = {
  tokens: 'design/prototype/assets/tokens.css',
  usage: 'design/system/artifact/token-usage.json',
  components: 'design/prototype/pages/shared',
  brand: 'design/system/brand.md',
  master: 'design/system/MASTER.md',
};
const OUT = 'design/system/artifact/project/tokens.json';
const THEMES = [
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
];

// Token family by CSS variable name. An unmatched name stops the build, so a new
// token in tokens.css has to be placed here before it can be published.
const FAMILY_RULES = [
  [/^(color-|fg-|bg-|nav-active-bg$)/, 'color'],
  [/^shadow-/, 'shadow'],
  [/^space-/, 'spacing'],
  [/^radius-/, 'radius'],
  [/^font-/, 'type.families'],
  [/^text-/, 'fontSize'],
  [/^leading-/, 'lineHeight'],
  [/^z-/, 'zIndex'],
  [/^(ease|dur)-/, 'motion'],
  [/^workspace-/, 'size'],
];
const FAMILY_ORDER = ['color', 'spacing', 'radius', 'shadow', 'fontSize', 'lineHeight', 'size', 'zIndex', 'motion'];

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
const fail = (msg) => {
  console.error(`build-design-artifact-tokens: ${msg}`);
  process.exit(1);
};

function familyOf(name) {
  const hit = FAMILY_RULES.find(([re]) => re.test(name));
  if (!hit) fail(`--${name} matches no family in FAMILY_RULES`);
  return hit[1];
}

// ---------------------------------------------------------------------------
// Parsing

// Every custom-property declaration, in source order, with the theme of its block
// and the comment written on the same line.
function parseDeclarations(css) {
  const lineComments = new Map();
  for (const line of css.split('\n')) {
    const m = /^\s*--([\w-]+)\s*:[^;]*;\s*\/\*\s*(.*?)\s*\*\/\s*$/.exec(line);
    if (m) lineComments.set(`${m[1]}\u0000${line}`, m[2]);
  }
  const decls = [];
  // Comments are blanked to spaces of the same length so offsets stay valid.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  for (let b; (b = blockRe.exec(bare)); ) {
    const selector = b[1].trim();
    const theme = /data-theme="dark"/.test(selector) ? 'dark' : 'light';
    const bodyStart = b.index + b[0].indexOf('{') + 1;
    const declRe = /--([\w-]+)\s*:\s*([^;]+);/g;
    for (let d; (d = declRe.exec(b[2])); ) {
      const start = bodyStart + d.index;
      const lineStart = css.lastIndexOf('\n', start) + 1;
      const lineEnd = css.indexOf('\n', start);
      const line = css.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      decls.push({
        name: d[1],
        raw: d[2].trim().replace(/\s+/g, ' '),
        theme,
        selector,
        comment: lineComments.get(`${d[1]}\u0000${line}`) ?? null,
      });
    }
  }
  return decls;
}

// Plain declarations (property: value) of the first block whose selector list equals `selector`.
function ruleDeclarations(css, selector) {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  for (let b; (b = blockRe.exec(bare)); ) {
    if (norm(b[1]) !== norm(selector)) continue;
    const out = {};
    for (const part of b[2].split(';')) {
      const i = part.indexOf(':');
      if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    return out;
  }
  fail(`no rule with selector "${selector}" in ${PATHS.tokens}`);
}

// ---------------------------------------------------------------------------
// Values

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FN = /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\([\d\s.,%/-]+\)$/i;
const OTHER_VALUE = /^[A-Za-z0-9 #%(),./+_-]{1,200}$/;

// Returns { value } or { skip: reason }.
function convert(raw, family) {
  const alias = /^var\(--([\w-]+)\)$/.exec(raw);
  if (alias) return { value: `{${alias[1]}}` };
  if (/color-mix\(/i.test(raw)) return { skip: 'color-mix()' };
  if (/calc\(/i.test(raw)) return { skip: 'calc()' };
  if (/var\(/i.test(raw)) return { skip: 'var() inside a value' };
  if (family === 'color') {
    if (HEX.test(raw)) return { value: raw.toLowerCase() };
    if (COLOR_FN.test(raw)) return { value: raw };
    return { skip: /^[a-z]+$/i.test(raw) ? 'named colour' : 'unsupported colour syntax' };
  }
  if (family === 'shadow') {
    if (raw.length > 400 || /url\(/i.test(raw)) return { skip: 'unsupported shadow syntax' };
    return { value: raw.replace(/#[0-9a-f]{3,8}\b/gi, (h) => h.toLowerCase()) };
  }
  if (family === 'type.families') {
    if (raw.length > 200 || /[;{}<>\\()]/.test(raw) || (raw.split("'").length - 1) % 2 || (raw.split('"').length - 1) % 2) {
      return { skip: 'unsupported font stack' };
    }
    return { value: raw };
  }
  if (!OTHER_VALUE.test(raw) || /url\(/i.test(raw)) return { skip: 'unsupported characters' };
  let depth = 0;
  for (const ch of raw) {
    depth += ch === '(' ? 1 : ch === ')' ? -1 : 0;
    if (depth < 0) return { skip: 'unbalanced parentheses' };
  }
  return depth === 0 ? { value: raw } : { skip: 'unbalanced parentheses' };
}

// ---------------------------------------------------------------------------
// Contrast (WCAG 2.x relative luminance)

function luminance(hex) {
  const h = hex.replace('#', '');
  const full = h.length <= 4 ? [...h.slice(0, 3)].map((c) => c + c).join('') : h.slice(0, 6);
  const ch = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = ch.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const fmt = (r) => r.toFixed(2); // display only; pass/fail uses the exact ratio

// ---------------------------------------------------------------------------
// Build

function build() {
  const css = read(PATHS.tokens);
  const sidecar = JSON.parse(read(PATHS.usage));
  const decls = parseDeclarations(css);
  const skipped = [];
  const order = [];
  const byName = new Map(); // name -> { family, light, dark, comments: {light, dark} }

  for (const d of decls) {
    const family = familyOf(d.name);
    const conv = convert(d.raw, family);
    if (conv.skip) {
      skipped.push({ name: d.name, theme: d.theme, value: d.raw, reason: conv.skip });
      continue;
    }
    if (!byName.has(d.name)) {
      byName.set(d.name, { family, light: undefined, dark: undefined, comments: {} });
      order.push(d.name);
    }
    const t = byName.get(d.name);
    t[d.theme] = conv.value;
    if (d.comment) t.comments[d.theme] = d.comment;
  }
  for (const t of byName.values()) {
    // A token with no dark override inherits its :root value in the dark theme.
    t.light ??= t.dark;
    t.dark ??= t.light;
  }

  const resolve = (name, theme, seen = new Set()) => {
    const t = byName.get(name);
    if (!t || seen.has(name)) fail(`cannot resolve --${name} (${theme})`);
    seen.add(name);
    const v = t[theme];
    const alias = /^\{(.+)\}$/.exec(v);
    return alias ? resolve(alias[1], theme, seen) : v;
  };

  // Contrast: grounds and results per foreground token.
  const contrastRows = [];
  const contrastNote = new Map();
  for (const pair of sidecar.contrast) {
    const parts = [];
    for (const on of pair.on) {
      const r = Object.fromEntries(THEMES.map(({ id }) => [id, ratio(resolve(pair.fg, id), resolve(on, id))]));
      const passes = Object.fromEntries(THEMES.map(({ id }) => [id, r[id] >= pair.min]));
      contrastRows.push({ fg: pair.fg, on, min: pair.min, role: pair.role, ...Object.fromEntries(THEMES.map(({ id }) => [id, r[id]])), passes });
      const flags = THEMES.filter(({ id }) => !passes[id]).map(({ id }) => id);
      parts.push(`{${on}} ${fmt(r.light)}／${fmt(r.dark)}${flags.length ? `（${flags.join('、')} 未達 ${pair.min}:1）` : ''}`);
    }
    const label = pair.role === 'text' ? `文字 ≥ ${pair.min}:1` : `${pair.role} ≥ ${pair.min}:1`;
    const prev = contrastNote.get(pair.fg);
    const line = `對比（${label}，light／dark）：${parts.join('；')}。`;
    contrastNote.set(pair.fg, prev ? `${prev} ${line}` : line);
  }

  const usageFor = (name) => {
    const note = sidecar.tokens[name];
    const t = byName.get(name);
    const comments = [];
    if (t?.comments.light) comments.push(t.comments.light);
    if (t?.comments.dark && t.comments.dark !== t.comments.light) comments.push(`dark: ${t.comments.dark}`);
    if (!note && !comments.length) fail(`--${name} has no usage note in ${PATHS.usage} and no line comment in ${PATHS.tokens}`);
    const text = [note, contrastNote.get(name), comments.length ? `tokens.css 註解：${comments.join(' ｜ ')}` : null]
      .filter(Boolean)
      .join(' ');
    if (text.length > 1000) fail(`usage for --${name} is ${text.length} chars (limit 1000)`);
    return text;
  };

  const families = {};
  for (const name of order) {
    const t = byName.get(name);
    if (t.family === 'type.families') continue;
    families[t.family] ??= [];
    const themed = t.family === 'color' || (t.family === 'shadow' && t.light !== t.dark);
    families[t.family].push({ name, value: themed ? { light: t.light, dark: t.dark } : t.light, usage: usageFor(name) });
  }
  for (const name of Object.keys(sidecar.tokens)) {
    if (!byName.has(name) && !skipped.some((s) => s.name === name)) fail(`${PATHS.usage} has a note for --${name}, which tokens.css does not declare`);
  }

  // Type: families from --font-*, styles from the semantic rules plus the sidecar's extras.
  const typeFamilies = {};
  for (const name of order) {
    if (byName.get(name).family === 'type.families') typeFamilies[name.replace(/^font-/, '')] = byName.get(name).light;
  }
  const tokenValue = (ref) => {
    const m = /^var\(--([\w-]+)\)$/.exec(ref) ?? [null, ref];
    return resolve(m[1], 'light');
  };
  const groups = sidecar.type.groups.map((g) => ({
    name: g.name,
    family: g.family,
    styles: g.styles.map((s) => {
      const rule = s.from ? ruleDeclarations(css, s.from) : {};
      const familyRef = s.family ?? /^var\(--font-([\w-]+)\)$/.exec(rule['font-family'] ?? '')?.[1];
      const style = {
        name: s.name,
        ...(familyRef && familyRef !== g.family ? { family: familyRef } : {}),
        fontSize: tokenValue(s.fontSize ?? rule['font-size']),
        fontWeight: Number(s.fontWeight ?? rule['font-weight'] ?? 400),
        lineHeight: Number(tokenValue(s.lineHeight ?? rule['line-height'])),
      };
      if (!style.fontSize) fail(`type style ${s.name} has no font size`);
      return { ...style, sample: s.sample, usage: s.usage };
    }),
  }));

  const shortSha = (() => {
    try {
      return execFileSync('git', ['log', '-1', '--format=%h', 'origin/main', '--', PATHS.tokens], { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  })();
  if (!shortSha) fail('cannot read the last origin/main commit that touched tokens.css (fetch origin first)');

  const out = {
    meta: { source: 'github', repo: 'label-suite/label-suite', ref: `main@${shortSha}`, paths: PATHS },
    color: { themes: THEMES, tokens: families.color },
    type: { fonts: [], families: typeFamilies, groups },
  };
  for (const f of FAMILY_ORDER.slice(1)) {
    if (!families[f]) continue;
    out[f] = sidecar.familyNotes?.[f] ? { note: sidecar.familyNotes[f], tokens: families[f] } : { tokens: families[f] };
  }
  for (const f of Object.keys(families)) if (f !== 'color' && !FAMILY_ORDER.includes(f)) fail(`family ${f} missing from FAMILY_ORDER`);

  return { out, skipped, contrastRows, decls };
}

// ---------------------------------------------------------------------------
// Check: every --var in tokens.css is in tokens.json with a matching value, or skipped.

function check() {
  const { skipped } = build();
  const json = JSON.parse(read(OUT));
  const listed = new Map();
  for (const [family, body] of Object.entries(json)) {
    if (family === 'meta' || family === 'type') continue;
    for (const t of body.tokens) listed.set(t.name, t.value);
  }
  for (const [key, stack] of Object.entries(json.type.families)) listed.set(`font-${key}`, stack);

  // Independent pass: strip every comment, then read each declaration with its block's theme.
  const css = read(PATHS.tokens).replace(/\/\*[\s\S]*?\*\//g, '');
  const problems = [];
  let total = 0;
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  for (let b; (b = blockRe.exec(css)); ) {
    const theme = b[1].includes('data-theme="dark"') ? 'dark' : 'light';
    for (const [, name, rawValue] of b[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      total += 1;
      const raw = rawValue.trim().replace(/\s+/g, ' ');
      if (skipped.some((s) => s.name === name && s.theme === theme)) continue;
      if (!listed.has(name)) {
        problems.push(`--${name} (${theme}) is neither in tokens.json nor skipped`);
        continue;
      }
      const have = listed.get(name);
      const got = typeof have === 'object' ? have[theme] ?? have.light : have;
      const want = raw.replace(/^var\(--([\w-]+)\)$/, '{$1}');
      if (String(got).toLowerCase() !== want.toLowerCase()) problems.push(`--${name} (${theme}): tokens.css "${want}" vs tokens.json "${got}"`);
    }
  }
  if (problems.length) fail(`check failed:\n  ${problems.join('\n  ')}`);
  console.log(`check ok: ${total} declarations in ${PATHS.tokens}; ${listed.size} tokens in ${OUT}; ${skipped.length} skipped`);
  for (const s of skipped) console.log(`  skipped --${s.name} (${s.theme}): ${s.value} [${s.reason}]`);
}

// ---------------------------------------------------------------------------

const args = new Set(process.argv.slice(2));
if (args.has('--check')) {
  check();
} else if (args.has('--contrast')) {
  const { contrastRows } = build();
  const only = args.has('--failing');
  console.log('| Foreground | Ground | Role | Min | Light | Dark |');
  console.log('| :--- | :--- | :--- | ---: | ---: | ---: |');
  for (const r of contrastRows) {
    if (only && r.passes.light && r.passes.dark) continue;
    const cell = (id) => `${fmt(r[id])}${r.passes[id] ? '' : ' fail'}`;
    console.log(`| \`${r.fg}\` | \`${r.on}\` | ${r.role} | ${r.min}:1 | ${cell('light')} | ${cell('dark')} |`);
  }
} else {
  const { out, skipped, contrastRows } = build();
  writeFileSync(join(ROOT, OUT), `${JSON.stringify(out, null, 2)}\n`);
  const failing = contrastRows.filter((r) => !r.passes.light || !r.passes.dark).length;
  console.log(`wrote ${OUT}: ${out.color.tokens.length} colours, ${Object.keys(out.type.families).length} font families, ${skipped.length} skipped, ${failing} of ${contrastRows.length} contrast pairs below their minimum`);
  for (const s of skipped) console.log(`  skipped --${s.name} (${s.theme}): ${s.value} [${s.reason}]`);
}
