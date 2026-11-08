// Mechanical checks for the business-process flow components under
// .notecraft/components/*-flow.tsx and the spec chapters they belong to.
// See https://github.com/label-suite/label-suite/issues/163 for why each
// assertion exists. Run: node scripts/check-flows.mjs

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIVIDER = '【流程】';

// Everything above the 【流程】 divider is copied verbatim from the skeleton.
// The boundary is the divider itself, never a line number: the skeleton grows.
export function skeletonPrefix(src) {
  const lines = src.split('\n');
  const at = lines.findIndex((l) => l.includes(DIVIDER));
  if (at < 0) return null;
  return lines.slice(0, at).join('\n') + (at > 0 ? '\n' : '');
}


const HERE = dirname(fileURLToPath(import.meta.url));
export const SKELETON = join(HERE, '..', '.claude', 'skills', 'spec-writing', 'references', 'flow-skeleton.tsx');

// Constants the geometry needs. Read from the skeleton every run so that a
// skeleton edit moves the checker with it instead of silently disagreeing.
const CONSTS = ['LANE_LABEL_W', 'GRID_LEFT', 'COL_W', 'LANE_H', 'NODE_W', 'NODE_H', 'DIAMOND', 'START_R'];

// A constant may be written as an expression over the ones before it, e.g.
// `const GRID_LEFT = LANE_LABEL_W + 28;`. Resolve those instead of demanding a
// literal, but only over names already read and only with arithmetic.
function resolve(expr, known, name) {
  const substituted = expr.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (word) => {
    if (!(word in known)) throw new Error(`${name} in flow-skeleton.tsx refers to ${word}, which is not a geometry constant`);
    return String(known[word]);
  });
  if (!/^[\d+\-*/(). ]+$/.test(substituted)) {
    throw new Error(`${name} in flow-skeleton.tsx is not plain arithmetic: ${expr}`);
  }
  const value = Function(`"use strict"; return (${substituted});`)();
  if (!Number.isFinite(value)) throw new Error(`${name} in flow-skeleton.tsx did not evaluate to a number`);
  return value;
}

export function geometryFrom(src) {
  const n = {};
  const missing = [];
  for (const name of CONSTS) {
    const m = src.match(new RegExp(`const ${name}\\s*=\\s*([^;]+);`));
    if (m) n[name] = resolve(m[1].trim(), n, name);
    else missing.push(name);
  }
  if (missing.length > 0) {
    throw new Error(`flow-skeleton.tsx no longer declares ${missing.join(', ')}; the geometry cannot be derived`);
  }
  const colX = (c) => n.GRID_LEFT + c * n.COL_W + n.COL_W / 2;
  const laneY = (l) => l * n.LANE_H + n.LANE_H / 2;
  return {
    ...n,
    colX,
    laneY,
    laneTop: (l) => l * n.LANE_H,
    laneBottom: (l) => (l + 1) * n.LANE_H,
    // Ported from the skeleton; kept honest by PINNED_GEOMETRY_FINGERPRINT.
    half: (kind) =>
      kind === 'start' ? [n.START_R, n.START_R]
        : kind === 'decision' ? [n.DIAMOND, n.DIAMOND]
          : [n.NODE_W / 2, n.NODE_H / 2],
    center: (node) => [node.kind === 'start' ? n.LANE_LABEL_W + 14 : colX(node.col), laneY(node.lane)],
  };
}

// The skeleton functions the checker re-implements. Their source is hashed so
// that editing any of them fails the suite and forces the port to be redone.
const PINNED_FNS = ['colX', 'laneY', 'laneTop', 'laneBottom', 'center', 'halfSize', 'anchor', 'defaultSides', 'routePath', 'labelPos'];

export function geometryFingerprint(src) {
  const h = createHash('sha256');
  for (const name of PINNED_FNS) {
    const at = src.indexOf(`function ${name}(`);
    if (at < 0) throw new Error(`flow-skeleton.tsx no longer declares ${name}()`);
    // up to the first line that closes the declaration at column 0
    const rest = src.slice(at);
    const end = rest.indexOf('\n}\n');
    h.update(name).update(rest.slice(0, end < 0 ? rest.length : end + 3));
  }
  for (const name of CONSTS) h.update(src.match(new RegExp(`const ${name}\\s*=\\s*[^;]+;`))?.[0] ?? '');
  return h.digest('hex');
}

// sha256 over the ten geometry declarations above plus the eight constants.
// If this fails, re-derive the ported geometry by hand before updating it.
export const PINNED_GEOMETRY_FINGERPRINT = '657d04b2c6955bc977ffacf6a28b73a45aaf05e2564fc803c36c774f7926e710';

export const COMPONENTS_DIR = join(HERE, '..', '.notecraft', 'components');

export const FLOWS_DECL = 'const FLOWS: Flow[] = [';

export function flowComponents(dir = COMPONENTS_DIR) {
  return readdirSync(dir).filter((f) => f.endsWith('-flow.tsx')).sort().map((f) => join(dir, f));
}

// Only components copied from flow-skeleton.tsx are in scope. The PRD's own
// lifecycle diagram is hand-written with its own geometry, so none of these
// assertions apply to it; it is skipped rather than reported.
export function skeletonDerived(files = flowComponents()) {
  return files.filter((f) => {
    const src = readFileSync(f, 'utf8');
    return src.includes(DIVIDER) && src.includes(FLOWS_DECL);
  });
}

// The components are generated files whose shape the skeleton fixes, so a small
// parser is enough. It is pinned by tests against every component in the repo.
const strList = (s) => [...s.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));

function objects(src) {
  // split a `[ { ... }, { ... } ]` body into its top-level `{ ... }` chunks
  const out = [];
  let depth = 0;
  let start = -1;
  let str = null;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (str) {
      if (c === '\\') i += 1;
      else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === '{') { if (depth === 0) start = i; depth += 1; continue; }
    if (c === '}') { depth -= 1; if (depth === 0) out.push(src.slice(start, i + 1)); }
  }
  return out;
}

function balanced(src, from) {
  // the `[ ... ]` that starts at or after `from`, with its brackets balanced
  const open = src.indexOf('[', from);
  if (open < 0) return null;
  let depth = 0;
  let str = null;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (str) {
      if (c === '\\') i += 1;
      else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === '[') depth += 1;
    else if (c === ']') { depth -= 1; if (depth === 0) return { body: src.slice(open + 1, i), end: i }; }
  }
  return null;
}

const field = (src, name) => src.match(new RegExp(`\\b${name}:\\s*"((?:[^"\\\\]|\\\\.)*)"`))?.[1];
const flag = (src, name) => new RegExp(`\\b${name}:\\s*true`).test(src);

function viaOf(src, geo) {
  const m = src.match(/\bvia:\s*lane(Top|Bottom)\((\d+)\)\s*([+-])\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const base = m[1] === 'Top' ? geo.laneTop(Number(m[2])) : geo.laneBottom(Number(m[2]));
    return base + Number(m[4]) * (m[3] === '+' ? 1 : -1);
  }
  const plain = src.match(/\bvia:\s*(-?\d+(?:\.\d+)?)\s*[,}]/);
  return plain ? Number(plain[1]) : undefined;
}

export function parseFlows(tsx, geo = geometryFrom(readFileSync(SKELETON, 'utf8'))) {
  const at = tsx.indexOf(FLOWS_DECL);
  if (at < 0) throw new Error(`component has no \`${FLOWS_DECL}\``);
  // start after the `=`, or the `[` inside `Flow[]` would close immediately
  const list = balanced(tsx, tsx.indexOf('=', at));
  if (!list) throw new Error('the FLOWS array is not balanced');
  return objects(list.body).map((chunk) => {
    const sub = (name) => balanced(chunk, chunk.indexOf(`${name}:`))?.body ?? '';
    const nodes = objects(sub('nodes')).map((n) => ({
      id: field(n, 'id'),
      lane: Number(n.match(/\blane:\s*(\d+)/)?.[1]),
      col: Number(n.match(/\bcol:\s*(\d+)/)?.[1]),
      kind: field(n, 'kind'),
      end: flag(n, 'end'),
      exception: flag(n, 'exception'),
      label: strList(balanced(n, n.indexOf('label:'))?.body ?? ''),
    }));
    const edges = objects(sub('edges')).map((e) => ({
      id: field(e, 'id'),
      from: field(e, 'from'),
      to: field(e, 'to'),
      label: field(e, 'label'),
      exception: flag(e, 'exception'),
      exit: field(e, 'exit'),
      enter: field(e, 'enter'),
      via: viaOf(e, geo),
    }));
    const steps = objects(sub('steps')).map((s) => ({
      title: field(s, 'title'),
      body: field(s, 'body'),
      ref: field(s, 'ref'),
      scenarios: strList(balanced(s, s.indexOf('scenarios:'))?.body ?? ''),
      highlight: strList(balanced(s, s.indexOf('highlight:'))?.body ?? ''),
    }));
    return {
      id: field(chunk, 'id'),
      label: field(chunk, 'label'),
      trigger: field(chunk, 'trigger'),
      result: field(chunk, 'result'),
      lanes: strList(balanced(chunk, chunk.indexOf('lanes:'))?.body ?? ''),
      nodes,
      edges,
      steps,
    };
  });
}

// ---------------------------------------------------------------- geometry ---

const HORIZ = (side) => side === 'left' || side === 'right';

export function anchorOf(node, side, geo) {
  const [cx, cy] = geo.center(node);
  const [hw, hh] = geo.half(node.kind);
  if (side === 'left') return [cx - hw, cy];
  if (side === 'right') return [cx + hw, cy];
  if (side === 'top') return [cx, cy - hh];
  return [cx, cy + hh];
}

export function defaultSides(from, to) {
  if (from.kind !== 'start' && from.col === to.col) {
    return to.lane > from.lane ? ['bottom', 'top'] : ['top', 'bottom'];
  }
  if (from.lane === to.lane) {
    return to.col > from.col || from.kind === 'start' ? ['right', 'left'] : ['bottom', 'bottom'];
  }
  return ['right', to.lane > from.lane ? 'top' : 'bottom'];
}

export function segmentsOf(edge, nodes, geo) {
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  const [d0, d1] = defaultSides(from, to);
  const s0 = edge.exit ?? d0;
  const s1 = edge.enter ?? d1;
  const p0 = anchorOf(from, s0, geo);
  const p1 = anchorOf(to, s1, geo);
  let pts;
  if (HORIZ(s0) && HORIZ(s1)) {
    const mx = edge.via ?? (p0[0] + p1[0]) / 2;
    pts = [p0, [mx, p0[1]], [mx, p1[1]], p1];
  } else if (!HORIZ(s0) && !HORIZ(s1)) {
    const my = edge.via ?? (p0[1] + p1[1]) / 2;
    pts = [p0, [p0[0], my], [p1[0], my], p1];
  } else if (HORIZ(s0)) {
    pts = [p0, [p1[0], p0[1]], p1];
  } else {
    pts = [p0, [p0[0], p1[1]], p1];
  }
  const segs = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [a, b] = [pts[i], pts[i + 1]];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    // a straight run comes out of routePath as two collinear halves; join them
    const last = segs.at(-1);
    const collinear = last
      && ((last[0][0] === last[1][0] && a[0] === b[0] && last[1][0] === a[0])
        || (last[0][1] === last[1][1] && a[1] === b[1] && last[1][1] === a[1]));
    if (collinear) last[1] = b;
    else segs.push([a, b]);
  }
  return { segs, s0, s1, p0, p1 };
}

export function labelBox(p0, s0, text, geo) {
  // fontSize 11.5 in the skeleton; one CJK glyph is about one em wide.
  const w = text.length * 11.5;
  const [x, y] = s0 === 'left' ? [p0[0] - 6, p0[1] - 6]
    : s0 === 'bottom' ? [p0[0] + 10, p0[1] + 4]
      : [p0[0] + 6, p0[1] - 6];
  const x0 = s0 === 'left' ? x - w : x;
  return [x0, y - 9, x0 + w, y + 2.5];
}

const overlap = (a0, a1, b0, b1) => Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1));

function boxOf(node, geo) {
  const [cx, cy] = geo.center(node);
  const [hw, hh] = geo.half(node.kind);
  return [cx - hw, cy - hh, cx + hw, cy + hh];
}

function distSegBox(seg, box) {
  const [[ax, ay], [bx, by]] = seg;
  const [x0, y0, x1, y1] = box;
  const dx = ax === bx ? Math.max(x0 - ax, ax - x1, 0) : Math.max(x0 - Math.max(ax, bx), Math.min(ax, bx) - x1, 0);
  const dy = ay === by ? Math.max(y0 - ay, ay - y1, 0) : Math.max(y0 - Math.max(ay, by), Math.min(ay, by) - y1, 0);
  return Math.hypot(dx, dy);
}

export function checkGeometry(flow, geo, report) {
  const { nodes, edges, id: fid } = flow;
  const routes = new Map(edges.map((e) => [e.id, segmentsOf(e, nodes, geo)]));
  // a line must not run through a node that is not one of its endpoints
  const through_ = new Set();
  for (const e of edges) {
    for (const seg of routes.get(e.id).segs) {
      for (const n of nodes) {
        if (n.id === e.from || n.id === e.to || n.kind === 'start') continue;
        const [x0, y0, x1, y1] = boxOf(n, geo);
        const vertical = seg[0][0] === seg[1][0];
        const through = vertical
          ? x0 < seg[0][0] && seg[0][0] < x1 && overlap(seg[0][1], seg[1][1], y0, y1) > 0
          : y0 < seg[0][1] && seg[0][1] < y1 && overlap(seg[0][0], seg[1][0], x0, x1) > 0;
        if (through) through_.add(`${fid}/${e.id} runs through node ${n.id}`);
      }
    }
  }
  for (const m of through_) report.error(m);
  // two different lines must not lie on top of each other
  const flat = edges.flatMap((e) => routes.get(e.id).segs.map((s) => [e.id, s]));
  for (let i = 0; i < flat.length; i += 1) {
    for (let j = i + 1; j < flat.length; j += 1) {
      const [e1, s1] = flat[i];
      const [e2, s2] = flat[j];
      if (e1 === e2) continue;
      const vertical = s1[0][0] === s1[1][0] && s2[0][0] === s2[1][0] && s1[0][0] === s2[0][0];
      const horizontal = s1[0][1] === s1[1][1] && s2[0][1] === s2[1][1] && s1[0][1] === s2[0][1];
      if (vertical && overlap(s1[0][1], s1[1][1], s2[0][1], s2[1][1]) > 0.5) {
        report.error(`${fid}/${e1} and ${fid}/${e2} overlap on x=${s1[0][0]}`);
      }
      if (horizontal && overlap(s1[0][0], s1[1][0], s2[0][0], s2[1][0]) > 0.5) {
        report.error(`${fid}/${e1} and ${fid}/${e2} overlap on y=${s1[0][1]}`);
      }
    }
  }
  // two arrows must not land on the same anchor
  const landing = new Map();
  for (const e of edges) {
    const key = `${e.to}:${routes.get(e.id).s1}`;
    if (landing.has(key)) report.error(`${fid}/${e.id} and ${fid}/${landing.get(key)} both enter ${e.to} on its ${routes.get(e.id).s1} side`);
    landing.set(key, e.id);
  }
  // a label must keep its distance from every line, including its own turns
  for (const e of edges) {
    if (!e.label) continue;
    const { p0, s0 } = routes.get(e.id);
    const box = labelBox(p0, s0, e.label, geo);
    for (const other of edges) {
      for (const seg of routes.get(other.id).segs) {
        const d = distSegBox(seg, box);
        if (other.id === e.id) {
          // labelPos deliberately places the text beside this edge's own line,
          // so only an actual crossing is a defect — that happens when the
          // edge turns underneath its own label.
          if (d === 0) report.error(`${fid}/${e.id} label "${e.label}" is crossed by its own line`);
        } else if (d < 4) {
          report.error(`${fid}/${e.id} label "${e.label}" sits ${d.toFixed(1)}px from ${fid}/${other.id}`);
        }
      }
    }
  }
}

// ------------------------------------------------------------- structure ---

export const PROMPT_KEYS = ['骨架', '核心洞察', '泳道', '流程', '走查對應'];
const LIMITS = { nodes: 8, cols: 7, lanes: [2, 4], steps: [4, 10] };

// flow.md counts 「字」 as what fits on a line, so measure visual width: a CJK
// glyph is one, a Latin letter or digit about half.
export const width = (text) => [...text].reduce((w, c) => w + (/[\u3000-\u9fff\uff00-\uffef]/.test(c) ? 1 : 0.5), 0);

export function checkShape(flow, report) {
  const { id: fid, nodes, edges, steps, lanes } = flow;
  const real = nodes.filter((n) => n.kind !== 'start');
  if (real.length > LIMITS.nodes) report.error(`${fid} has ${real.length} nodes, over the limit of ${LIMITS.nodes}`);
  const cols = Math.max(...nodes.map((n) => n.col)) + 1;
  if (cols > LIMITS.cols) report.error(`${fid} spans ${cols} columns, over the limit of ${LIMITS.cols}`);
  if (lanes.length < LIMITS.lanes[0] || lanes.length > LIMITS.lanes[1]) {
    report.error(`${fid} has ${lanes.length} lanes, outside ${LIMITS.lanes.join('-')}`);
  }
  if (steps.length < LIMITS.steps[0] || steps.length > LIMITS.steps[1]) {
    report.error(`${fid} has ${steps.length} walkthrough steps, outside ${LIMITS.steps.join('-')}`);
  }
  const cells = new Map();
  for (const n of real) {
    const key = `${n.lane},${n.col}`;
    if (cells.has(key)) report.error(`${fid}: nodes ${cells.get(key)} and ${n.id} share cell (${key})`);
    cells.set(key, n.id);
  }
  for (const n of real) {
    const limit = n.kind === 'decision' ? 4 : 6;
    for (const line of n.label) {
      if (width(line) > limit) report.error(`${fid}/${n.id} label line "${line}" is ${width(line)} wide, over ${limit}`);
    }
    if (n.label.length > 2) report.error(`${fid}/${n.id} label has ${n.label.length} lines, over 2`);
    if (n.kind === 'decision' && !n.label.at(-1)?.endsWith('？')) {
      report.error(`${fid}/${n.id} is a decision but its label does not end with 「？」`);
    }
  }
  for (const s of steps) {
    if (/[*`]|\]\(/.test(s.body ?? '')) report.error(`${fid}: step "${s.title}" body contains Markdown, which the skeleton renders literally`);
  }
}

export function checkGraph(flow, report) {
  const { id: fid, nodes, edges, steps } = flow;
  for (const n of nodes.filter((x) => x.kind === 'decision')) {
    const out = edges.filter((e) => e.from === n.id).map((e) => e.label).sort();
    if (out.length !== 2 || out[0] !== '否' || out[1] !== '是') {
      report.error(`${fid}/${n.id} is a decision whose exits are [${out.join(', ')}] instead of 是 and 否`);
    }
  }
  for (const n of nodes.filter((x) => x.end)) {
    const out = edges.filter((e) => e.from === n.id);
    if (out.length > 0) report.error(`${fid}/${n.id} is marked end but ${out.map((e) => e.id).join(', ')} leaves it`);
  }
  const start = nodes.find((n) => n.kind === 'start');
  if (!start) report.error(`${fid} has no start node`);
  else {
    const seen = new Set([start.id]);
    for (let grew = true; grew;) {
      grew = false;
      for (const e of edges) if (seen.has(e.from) && !seen.has(e.to)) { seen.add(e.to); grew = true; }
    }
    for (const n of nodes) if (!seen.has(n.id)) report.error(`${fid}/${n.id} is not reachable from the start node`);
  }
  const lit = new Set(steps.flatMap((s) => s.highlight));
  for (const n of nodes) if (!lit.has(n.id)) report.error(`${fid}/${n.id} is never highlighted, so clicking it does nothing`);
  for (const e of edges) if (!lit.has(e.id)) report.error(`${fid}/${e.id} is never highlighted`);
  for (const h of lit) {
    if (!nodes.some((n) => n.id === h) && !edges.some((e) => e.id === h)) {
      report.error(`${fid}: a step highlights "${h}", which is neither a node nor an edge`);
    }
  }
}

export function checkWalkthrough(flow, report) {
  const { id: fid, steps } = flow;
  for (const s of steps) {
    if (/^A\d/.test(s.ref ?? '') && !s.title?.startsWith('替代：')) {
      report.error(`${fid}: step for ${s.ref} should start with 「替代：」 but is "${s.title}"`);
    }
    if (/^E\d/.test(s.ref ?? '') && !s.title?.startsWith('例外：')) {
      report.error(`${fid}: step for ${s.ref} should start with 「例外：」 but is "${s.title}"`);
    }
  }
  if (steps.at(-1)?.ref !== '結果') {
    report.error(`${fid}: the last walkthrough step is "${steps.at(-1)?.ref}" instead of 結果`);
  }
}

export function checkAgainstSpec(flow, page, report) {
  const { id: fid } = flow;
  for (const name of new Set(flow.steps.flatMap((s) => s.scenarios))) {
    if (!page.scenarios.has(name)) {
      report.error(`${fid}: scenario "${name}" is not in the acceptance table of ${page.rel}`);
    }
  }
  // 05/06 use ### headings for each flow, 03/07 use bold list items; both count.
  if (!page.flowTitles.includes(flow.label)) {
    report.error(`${fid}: tab label "${flow.label}" is not a flow title in ${page.rel} §業務流程`);
  }
  for (const lane of flow.lanes) {
    // A lane name is a role from §使用角色, 系統, or two roles joined with 或.
    // Some pages name a participant in prose rather than with :ref, so the
    // chapter text counts too.
    const named = (part) => page.roles.has(part) || page.rolesChapter.includes(part);
    const ok = lane === '系統' || named(lane) || lane.split(/或|、|／/).every(named);
    if (!ok) report.error(`${fid}: lane "${lane}" is not named in ${page.rel} §使用角色`);
  }
}

export function weakJumpWarnings(flow, warn) {
  const cards = flow.steps.map((s) => [s.highlight, `${s.title ?? ''}${s.body ?? ''}`]);
  for (const n of flow.nodes) {
    const words = n.label.filter(Boolean);
    if (words.length === 0) continue;
    const hit = cards.find(([h]) => h.includes(n.id));
    if (hit && !words.some((w) => hit[1].includes(w))) {
      warn(`${flow.id}/${n.id}: the first step that lights it does not mention "${words.join('')}"`);
    }
  }
}

// ------------------------------------------------------- pages and markers ---

const DOCS_DIR = join(HERE, '..', 'docs');

function chapter(text, title) {
  const re = new RegExp(`^## ${title}\\s*$`, 'm');
  const at = text.search(re);
  if (at < 0) return '';
  const rest = text.slice(at).split('\n').slice(1).join('\n');
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

export function readPage(path, rel) {
  const text = readFileSync(path, 'utf8');
  const acceptance = chapter(text, '驗收標準');
  const scenarios = new Set(
    acceptance.split('\n')
      .filter((l) => l.startsWith('| ') && !l.startsWith('| :') && !l.includes('Scenario |'))
      .map((l) => l.split('|')[1]?.trim())
      .filter(Boolean),
  );
  const process = chapter(text, '業務流程');
  const flowTitles = [
    ...[...process.matchAll(/^### (.+)$/gm)].map((m) => m[1].trim()),
    ...[...process.matchAll(/^- \*\*(.+?)\*\*\s*$/gm)].map((m) => m[1].trim()),
  ];
  const rolesChapter = chapter(text, '使用角色');
  const roles = new Set([...rolesChapter.matchAll(/:ref\[([^\]]+)\]/g)].map((m) => m[1]));
  return { text, rel, scenarios, flowTitles, roles, rolesChapter, process };
}

export function readMarker(page, componentId, report) {
  const open = page.text.indexOf('{/* @ai-visualize');
  if (open < 0) { report.error(`${page.rel}: no @ai-visualize marker for ${componentId}`); return null; }
  const close = page.text.indexOf('*/}', open);
  const block = page.text.slice(open, close);
  for (const key of ['id', 'type', 'status', 'prompt', 'caption']) {
    const times = [...block.matchAll(new RegExp(`^${key}:`, 'gm'))].length;
    if (times !== 1) report.error(`${page.rel}: the marker has ${times} \`${key}:\` lines, expected exactly 1`);
  }
  const id = block.match(/^id:\s*(\S+)/m)?.[1];
  if (id !== componentId) report.error(`${page.rel}: marker id "${id}" does not match component ${componentId}`);
  const status = block.match(/^status:\s*(\S+)/m)?.[1];
  const caption = block.match(/^caption:\s*(.+)$/m)?.[1]?.trim();
  const body = block.split('prompt: |\n')[1]?.split('\ncaption:')[0] ?? '';
  const prompt = body.replace(/^ {2}/gm, '').replace(/\s*$/, '') + '\n';
  for (const key of PROMPT_KEYS) {
    if (!prompt.includes(`${key}：`)) report.error(`${page.rel}: the marker prompt has no 「${key}：」 line`);
  }
  if (status !== 'generated') {
    report.error(`${page.rel}: component ${componentId} exists but the marker says status: ${status}`);
  }
  const frame = page.text.match(/<GeneratedFrame\s+id="([^"]+)"[^>]*?prompt=\{(".*?")\}\s+caption="([^"]*)"/s);
  if (!frame) { report.error(`${page.rel}: status is generated but there is no <GeneratedFrame> with prompt and caption`); return { prompt, caption }; }
  if (frame[1] !== componentId) report.error(`${page.rel}: GeneratedFrame id "${frame[1]}" does not match ${componentId}`);
  let attr;
  try { attr = JSON.parse(frame[2]); } catch { report.error(`${page.rel}: the GeneratedFrame prompt attribute is not a JSON string`); return { prompt, caption }; }
  if (attr !== prompt) report.error(`${page.rel}: the marker prompt and the GeneratedFrame prompt differ`);
  if (frame[3] !== caption) report.error(`${page.rel}: the marker caption and the GeneratedFrame caption differ`);
  if (!new RegExp(`import \\w+ from '@notes/components/${componentId}'`).test(page.text)) {
    report.error(`${page.rel}: the component is not imported`);
  }
  return { prompt, caption };
}

// 05-01 → docs/specs/05-dataset/01-analysis-list.mdx, found by its number pair.
export function pageFor(componentId, docsDir = DOCS_DIR) {
  const m = componentId.match(/^spec-(\d\d)-(\d\d)-/);
  if (!m) return null;
  const moduleDir = readdirSync(join(docsDir, 'specs')).find((d) => d.startsWith(`${m[1]}-`));
  if (!moduleDir) return null;
  const file = readdirSync(join(docsDir, 'specs', moduleDir)).find((f) => f.startsWith(`${m[2]}-`) && f.endsWith('.mdx'));
  if (!file) return null;
  const rel = `specs/${moduleDir}/${file}`;
  return { path: join(docsDir, 'specs', moduleDir, file), rel };
}

export function checkFlowsIn({ files = skeletonDerived(), docsDir = DOCS_DIR, skeleton = SKELETON } = {}) {
  const errors = [];
  const warnings = [];
  const report = { error: (m) => errors.push(m) };
  const warn = (m) => warnings.push(m);
  const skeletonSrc = readFileSync(skeleton, 'utf8');
  const geo = geometryFrom(skeletonSrc);
  if (geometryFingerprint(skeletonSrc) !== PINNED_GEOMETRY_FINGERPRINT) {
    errors.push('flow-skeleton.tsx geometry changed; re-derive the ported functions in check-flows.mjs, then update PINNED_GEOMETRY_FINGERPRINT');
  }
  const wanted = skeletonPrefix(skeletonSrc);
  for (const file of files) {
    const base = file.split('/').at(-1).replace(/\.tsx$/, '');
    const src = readFileSync(file, 'utf8');
    const prefix = skeletonPrefix(src);
    if (prefix !== wanted) report.error(`${base}: the part above 【流程】 differs from flow-skeleton.tsx`);
    const located = pageFor(base, docsDir);
    if (!located) { report.error(`${base}: no spec page matches this component name`); continue; }
    const page = readPage(located.path, located.rel);
    readMarker(page, base, report);
    const flows = parseFlows(src, geo);
    const labels = flows.map((f) => f.label);
    const order = page.flowTitles.filter((t) => labels.includes(t));
    if (order.join('|') !== labels.join('|')) {
      report.error(`${base}: the tabs are ordered [${labels.join(', ')}] but §業務流程 has [${order.join(', ')}]`);
    }
    for (const flow of flows) {
      checkShape(flow, report);
      checkGraph(flow, report);
      checkWalkthrough(flow, report);
      checkAgainstSpec(flow, page, report);
      checkGeometry(flow, geo, report);
      weakJumpWarnings(flow, warn);
    }
  }
  return { errors, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { errors, warnings } = checkFlowsIn();
  for (const w of warnings) console.warn(`WARN  ${w}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  if (errors.length > 0) process.exit(1);
  console.log(`check-flows: ${skeletonDerived().length} components OK`);
}
