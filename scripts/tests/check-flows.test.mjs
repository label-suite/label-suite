// Regression tests for scripts/check-flows.mjs. Run: node --test scripts/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import {
  PINNED_GEOMETRY_FINGERPRINT,
  anchorOf,
  SKELETON,
  geometryFingerprint,
  checkAgainstSpec,
  checkFlowsIn,
  checkGeometry,
  checkGraph,
  checkRefs,
  checkShape,
  checkWalkthrough,
  flowComponents,
  skeletonDerived,
  geometryFrom,
  parseFlows,
  readMarker,
  readPage,
  skeletonBody,
  width,
} from '../check-flows.mjs';

const BANNER_A = '/* ================================================================ 【骨架】不可修改 ================================================================ */';
const BANNER_B = '/* ================================================================ 【流程】依規格填寫 ================================================================ */';

test('skeletonBody takes the section between the two banners', () => {
  const src = ['/** 【骨架】一字不改；【流程】整段換掉。*/', 'const HEADER = 0;', BANNER_A, 'const A = 1;', BANNER_B, 'const FLOWS = [];'].join('\n');
  assert.equal(skeletonBody(src), `${BANNER_A}\nconst A = 1;\n`);
});

test('skeletonBody is not fooled by 【流程】 in the file header comment', () => {
  // the real skeleton mentions 【流程】 on line 9; cutting there compared 9
  // lines and left the whole body unchecked
  const body = skeletonBody(readFileSync(SKELETON, 'utf8'));
  assert.ok(body.split('\n').length > 400, `skeletonBody covered only ${body.split('\n').length} lines`);
  assert.ok(body.includes('function routePath'), 'the body must contain the geometry it claims to pin');
});

test('skeletonBody returns null when a banner is missing', () => {
  assert.equal(skeletonBody('const A = 1;\n'), null);
  assert.equal(skeletonBody(`${BANNER_A}\nconst A = 1;\n`), null);
});

test('a component whose own geometry constant was edited is reported', () => {
  // the renderer would draw at the component's constant while the checker
  // computes with the skeleton's: the divergence must not be silent
  const file = skeletonDerived().find((f) => f.endsWith('spec-03-01-task-list-flow.tsx'));
  const dir = mkdtempSync(join(tmpdir(), 'check-flows-'));
  const copy = join(dir, 'spec-03-01-task-list-flow.tsx');
  writeFileSync(copy, readFileSync(file, 'utf8').replace('const COL_W = 96;', 'const COL_W = 140;'));
  const { errors } = checkFlowsIn({ files: [copy] });
  assert.ok(errors.some((e) => /differs from flow-skeleton/.test(e)), `expected a skeleton mismatch, got ${JSON.stringify(errors)}`);
});

test('checkFlowsIn refuses to pass by checking nothing', () => {
  const { errors } = checkFlowsIn({ files: [] });
  assert.match(errors.join('\n'), /pass by doing nothing/);
});

test('geometryFrom reads the constants out of the skeleton source, not a copy', () => {
  const src = 'const LANE_LABEL_W = 11;\nconst COL_W = 22;\nconst LANE_H = 33;\n'
    + 'const NODE_W = 44;\nconst NODE_H = 55;\nconst DIAMOND = 66;\nconst START_R = 7;\nconst GRID_LEFT = 88;\n';
  const g = geometryFrom(src);
  assert.equal(g.LANE_LABEL_W, 11);
  assert.equal(g.COL_W, 22);
  assert.equal(g.DIAMOND, 66);
  // colX/laneY are derived from those constants, so a skeleton edit moves them
  assert.equal(g.colX(0), 88 + 22 / 2);
  assert.equal(g.laneY(1), 33 + 33 / 2);
});

test('geometryFrom throws when a constant the geometry needs is absent', () => {
  assert.throws(() => geometryFrom('const LANE_LABEL_W = 11;\n'), /START_R/);
});

test('the ported geometry functions are pinned to the skeleton that was read', () => {
  // The ported defaultSides/routePath/labelPos/halfSize must be re-checked by
  // hand whenever the skeleton's own versions change. A changed fingerprint is
  // the signal to do that; it is not a cosmetic failure.
  const src = readFileSync(SKELETON, 'utf8');
  assert.equal(geometryFingerprint(src), PINNED_GEOMETRY_FINGERPRINT);
});

test('the fingerprint changes when a pinned geometry function is edited', () => {
  const src = readFileSync(SKELETON, 'utf8');
  const mutated = src.replace('function defaultSides(from: FlowNode, to: FlowNode): [Side, Side] {',
    'function defaultSides(from: FlowNode, to: FlowNode): [Side, Side] {\n  // edited');
  assert.notEqual(mutated, src);
  assert.notEqual(geometryFingerprint(mutated), geometryFingerprint(src));
});

test('the fingerprint changes when a geometry constant is edited', () => {
  const src = readFileSync(SKELETON, 'utf8');
  const mutated = src.replace('const COL_W = 96;', 'const COL_W = 97;');
  assert.notEqual(mutated, src);
  assert.notEqual(geometryFingerprint(mutated), geometryFingerprint(src));
});

test('parseFlows reads a flow out of the component source', () => {
  const tsx = `/* 【流程】 */
const FLOWS: Flow[] = [
  {
    id: "one",
    label: "甲乙",
    trigger: "甲",
    result: "乙",
    lanes: ["丙", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["丁", "戊"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["己？"] },
      { id: "n3", lane: 1, col: 2, kind: "system", end: true, label: ["庚"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "是" },
      { id: "e1", from: "n2", to: "n3", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
    ],
    steps: [
      { title: "辛", body: "壬", scenarios: ["癸", "子"], ref: "主流程 1", highlight: ["s", "a0", "n1"] },
      { title: "丑", body: "寅", scenarios: [], ref: "結果", highlight: ["a1", "n2", "a2", "e1", "n3"] },
    ],
  },
];`;
  const flows = parseFlows(tsx);
  assert.equal(flows.length, 1);
  const f = flows[0];
  assert.deepEqual({ id: f.id, label: f.label, trigger: f.trigger, result: f.result, lanes: f.lanes },
    { id: 'one', label: '甲乙', trigger: '甲', result: '乙', lanes: ['丙', '系統'] });
  assert.deepEqual(f.nodes.map((n) => [n.id, n.lane, n.col, n.kind, n.end ?? false, n.label]), [
    ['s', 0, 0, 'start', false, []],
    ['n1', 0, 0, 'action', false, ['丁', '戊']],
    ['n2', 1, 1, 'decision', false, ['己？']],
    ['n3', 1, 2, 'system', true, ['庚']],
  ]);
  const e1 = f.edges.find((e) => e.id === 'e1');
  assert.deepEqual([e1.from, e1.to, e1.label, e1.exception, e1.exit, e1.enter, e1.via],
    ['n2', 'n3', '否', true, 'bottom', 'bottom', 208]);
  assert.equal(f.edges.find((e) => e.id === 'a1').via, undefined);
  assert.deepEqual(f.steps.map((s) => [s.ref, s.scenarios, s.highlight]), [
    ['主流程 1', ['癸', '子'], ['s', 'a0', 'n1']],
    ['結果', [], ['a1', 'n2', 'a2', 'e1', 'n3']],
  ]);
});

test('skeletonDerived skips the hand-written PRD diagram', () => {
  const all = flowComponents();
  const derived = skeletonDerived(all);
  assert.ok(all.length > derived.length, 'expected at least one component that is not skeleton-derived');
  assert.ok(all.some((f) => f.endsWith('prd-task-lifecycle-flow.tsx')));
  assert.ok(!derived.some((f) => f.endsWith('prd-task-lifecycle-flow.tsx')),
    'the PRD lifecycle diagram has its own geometry and must not be checked as a skeleton flow');
});

test('parseFlows handles every skeleton-derived component in the repository', () => {
  const files = skeletonDerived();
  assert.ok(files.length >= 10, `expected at least 10 skeleton-derived components, found ${files.length}`);
  for (const file of files) {
    const flows = parseFlows(readFileSync(file, 'utf8'));
    assert.ok(flows.length > 0, `${file}: no flows parsed`);
    for (const f of flows) {
      assert.ok(f.id && f.label, `${file}: a flow is missing id or label`);
      assert.ok(f.nodes.length > 0 && f.edges.length > 0 && f.steps.length > 0, `${file}: ${f.id} parsed empty`);
      for (const e of f.edges) {
        assert.ok(f.nodes.some((n) => n.id === e.from), `${file}: ${f.id}/${e.id} from=${e.from} is not a node`);
        assert.ok(f.nodes.some((n) => n.id === e.to), `${file}: ${f.id}/${e.id} to=${e.to} is not a node`);
      }
    }
  }
});

// --- assertion groups: each test proves the rule fires, then that it passes ---

const GEO = geometryFrom(readFileSync(SKELETON, 'utf8'));

function collect(fn) {
  const errors = [];
  fn({ error: (m) => errors.push(m) });
  return errors;
}

const node = (id, lane, col, kind, label, extra = {}) => ({ id, lane, col, kind, label, end: false, exception: false, ...extra });

test('width measures CJK as one and Latin as a half', () => {
  assert.equal(width('有任務？'), 4);
  assert.equal(width('Seeder'), 3);
});

test('checkShape rejects an over-long decision label but accepts Latin that fits', () => {
  const over = { id: 'f', lanes: ['甲', '系統'], steps: [], edges: [], nodes: [node('n1', 0, 0, 'decision', ['有五個字？'])] };
  assert.match(collect((r) => checkShape(over, r)).join('\n'), /over 4/);
  const latin = { ...over, nodes: [node('n1', 0, 0, 'decision', ['Seeder？'])] };
  assert.deepEqual(collect((r) => checkShape(latin, r)).filter((e) => e.includes('wide')), []);
});

test('checkShape rejects two nodes in one cell', () => {
  const flow = { id: 'f', lanes: ['甲', '系統'], steps: [], edges: [], nodes: [node('n1', 0, 0, 'action', ['甲']), node('n2', 0, 0, 'action', ['乙'])] };
  assert.match(collect((r) => checkShape(flow, r)).join('\n'), /share cell \(0,0\)/);
});

test('checkGraph rejects an end node that still has an outgoing edge', () => {
  const flow = {
    id: 'f',
    nodes: [node('s', 0, 0, 'start', []), node('n1', 0, 0, 'system', ['甲'], { end: true }), node('n2', 1, 1, 'system', ['乙'])],
    edges: [{ id: 'a0', from: 's', to: 'n1' }, { id: 'a1', from: 'n1', to: 'n2' }],
    steps: [{ highlight: ['s', 'n1', 'n2', 'a0', 'a1'] }],
  };
  assert.match(collect((r) => checkGraph(flow, r)).join('\n'), /marked end but a1 leaves it/);
});

test('checkGraph rejects a decision without exactly one 是 and one 否, and an unreachable node', () => {
  const flow = {
    id: 'f',
    nodes: [node('s', 0, 0, 'start', []), node('n1', 1, 1, 'decision', ['甲？']), node('n9', 1, 5, 'system', ['丙'])],
    edges: [{ id: 'a0', from: 's', to: 'n1' }, { id: 'a1', from: 'n1', to: 'n1', label: '是' }],
    steps: [{ highlight: ['s', 'n1', 'n9', 'a0', 'a1'] }],
  };
  const out = collect((r) => checkGraph(flow, r)).join('\n');
  assert.match(out, /exits are \[是\]/);
  assert.match(out, /n9 is not reachable/);
});

test('checkWalkthrough rejects a mislabelled alternative step and a wrong last ref', () => {
  const flow = { id: 'f', steps: [{ ref: 'A1', title: '甲' }, { ref: 'E1', title: '乙' }] };
  const out = collect((r) => checkWalkthrough(flow, r)).join('\n');
  assert.match(out, /A1 should start with 「替代：」/);
  assert.match(out, /E1 should start with 「例外：」/);
  assert.match(out, /last walkthrough step is "E1" instead of 結果/);
});

test('checkGeometry rejects a line drawn through a third node', () => {
  // n1 -> n3 in one lane, with n2 sitting in the column between them
  const flow = {
    id: 'f',
    nodes: [node('n1', 1, 0, 'system', ['甲']), node('n2', 1, 1, 'system', ['乙']), node('n3', 1, 2, 'system', ['丙'])],
    edges: [{ id: 'a1', from: 'n1', to: 'n3' }],
  };
  assert.match(collect((r) => checkGeometry(flow, GEO, r)).join('\n'), /a1 runs through node n2/);
});

test('checkGeometry rejects two arrows landing on the same anchor', () => {
  const flow = {
    id: 'f',
    nodes: [node('n1', 0, 0, 'action', ['甲']), node('n2', 0, 1, 'action', ['乙']), node('n3', 1, 2, 'system', ['丙'])],
    edges: [{ id: 'a1', from: 'n1', to: 'n3' }, { id: 'a2', from: 'n2', to: 'n3' }],
  };
  assert.match(collect((r) => checkGeometry(flow, GEO, r)).join('\n'), /both enter n3 on its top side/);
});

test('checkGeometry accepts a label beside its own straight line', () => {
  // the skeleton puts a label 6px above its line on purpose: not a defect
  const flow = {
    id: 'f',
    nodes: [node('n1', 1, 0, 'decision', ['甲？']), node('n2', 1, 1, 'system', ['乙'])],
    edges: [{ id: 'a1', from: 'n1', to: 'n2', label: '是' }],
  };
  assert.deepEqual(collect((r) => checkGeometry(flow, GEO, r)), []);
});

test('checkAgainstSpec rejects an unknown scenario, tab label and lane', () => {
  const page = { rel: 'p.mdx', scenarios: new Set(['甲']), flowTitles: ['走一遍'], roles: new Set(['平台成員']), rolesChapter: '…:ref[平台成員]…' };
  const flow = { id: 'f', label: '另一段', lanes: ['標記員', '系統'], steps: [{ scenarios: ['乙'] }] };
  const out = collect((r) => checkAgainstSpec(flow, page, r)).join('\n');
  assert.match(out, /scenario "乙" is not in the acceptance table/);
  assert.match(out, /tab label "另一段" is not a flow title/);
  assert.match(out, /lane "標記員" is not a role/);
});

test('readPage takes a role named by a list item, not by any word in the chapter', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-flows-'));
  const file = join(dir, 'p.mdx');
  writeFileSync(file, ['## 使用角色', '', '- :ref[平台成員]{id="t.m"}：可以', '- 受邀的使用者（剛被新增）：無權限', '', '## 業務流程', ''].join('\n'));
  const page = readPage(file, 'p.mdx');
  assert.ok(page.roles.has('平台成員'));
  assert.ok(page.roles.has('受邀的使用者'), 'a participant named by a list item counts as a role');
  assert.ok(!page.roles.has('無權限'), 'a word that merely appears in the chapter must not count');
  const flow = { id: 'f', label: '走一遍', lanes: ['平台成員或受邀的使用者', '系統'], steps: [] };
  assert.deepEqual(collect((r) => checkAgainstSpec(flow, { ...page, flowTitles: ['走一遍'] }, r)), []);
});

test('checkRefs accepts both ways the spec pages write an alternative code', () => {
  const flow = { id: 'f', steps: [{ ref: 'A1' }, { ref: 'E2' }] };
  const inline = { rel: 'p.mdx', processChapter: '- A1（第 2 步）甲 → 乙\n- E2（第 3 步）丙' };
  assert.deepEqual(collect((r) => checkRefs(flow, inline, r)), []);
  const trailing = { rel: 'p.mdx', processChapter: '   - 甲（替代流程 **A1**）\n   - 乙（例外流程 **E2**）' };
  assert.deepEqual(collect((r) => checkRefs(flow, trailing, r)), []);
  const absent = { rel: 'p.mdx', processChapter: '沒有任何代號' };
  assert.match(collect((r) => checkRefs(flow, absent, r)).join('\n'), /step A1 is not mentioned in/);
});

test('every skeleton-derived component parses and the 03 module flows are clean', () => {
  const files = skeletonDerived().filter((f) => /spec-03-/.test(f));
  assert.equal(files.length, 3);
  const { errors } = checkFlowsIn({ files });
  assert.deepEqual(errors, []);
});

// --- readMarker had no unit tests at all; each rule needs a firing case ---

const MARKER = (over = {}) => {
  const f = { id: 'spec-01-01-x-flow', status: 'generated', caption: '甲', prompt: '骨架：a。\n核心洞察：b。\n泳道：c\n流程：d\n走查對應：e\n', ...over };
  const indented = f.prompt.replace(/\n$/, '').split('\n').map((l) => `  ${l}`).join('\n');
  const frame = f.noFrame ? '' : `\n<GeneratedFrame id="${f.frameId ?? f.id}" type="motion" prompt={${JSON.stringify(f.framePrompt ?? f.prompt)}} caption="${f.frameCaption ?? f.caption}">\n</GeneratedFrame>\n`;
  const imp = f.noImport ? '' : `import Spec from '@notes/components/${f.id}'\n`;
  return `{/* @ai-visualize\nstatus: ${f.status}\ntype: motion\nid: ${f.id}\nprompt: |\n${indented}\ncaption: ${f.caption}\n${f.extraCaption ? `caption: ${f.extraCaption}\n` : ''}*/}\n\n${imp}${frame}`;
};

const marker = (over) => collect((r) => readMarker({ rel: 'p.mdx', text: MARKER(over) }, 'spec-01-01-x-flow', r));

test('readMarker accepts a well-formed marker', () => {
  assert.deepEqual(marker(), []);
});

test('readMarker rejects a duplicated key', () => {
  assert.match(marker({ extraCaption: '乙' }).join('\n'), /has 2 `caption:` lines/);
});

test('readMarker rejects an id that does not match the component', () => {
  assert.match(marker({ id: 'spec-09-09-other-flow' }).join('\n'), /marker id .* does not match/);
});

test('readMarker rejects a prompt missing one of its five keys', () => {
  assert.match(marker({ prompt: '骨架：a。\n核心洞察：b。\n泳道：c\n流程：d\n' }).join('\n'), /no 「走查對應：」 line/);
});

test('readMarker rejects a status other than generated when the component exists', () => {
  assert.match(marker({ status: 'pending' }).join('\n'), /the marker says status: pending/);
});

test('readMarker rejects a prompt that differs from the GeneratedFrame attribute', () => {
  assert.match(marker({ framePrompt: '骨架：z。\n核心洞察：b。\n泳道：c\n流程：d\n走查對應：e\n' }).join('\n'),
    /marker prompt and the GeneratedFrame prompt differ/);
});

test('readMarker rejects a caption that differs from the GeneratedFrame attribute', () => {
  assert.match(marker({ frameCaption: '乙' }).join('\n'), /caption and the GeneratedFrame caption differ/);
});

test('readMarker rejects a missing GeneratedFrame, a mismatched frame id and a missing import', () => {
  assert.match(marker({ noFrame: true }).join('\n'), /no <GeneratedFrame>/);
  assert.match(marker({ frameId: 'spec-09-09-other-flow' }).join('\n'), /GeneratedFrame id .* does not match/);
  assert.match(marker({ noImport: true }).join('\n'), /component is not imported/);
});

// --- the drift guards must be wired into checkFlowsIn, not just exported ---

test('checkFlowsIn reports a changed skeleton fingerprint', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-flows-'));
  const fake = join(dir, 'flow-skeleton.tsx');
  writeFileSync(fake, readFileSync(SKELETON, 'utf8').replace('const COL_W = 96;', 'const COL_W = 97;'));
  const { errors } = checkFlowsIn({ files: [], skeleton: fake });
  assert.match(errors.join('\n'), /geometry changed; re-derive/);
});

// --- geometry thresholds and the ported constants need firing cases ---

test('checkGeometry reports a collinear overlap between two edges', () => {
  // two edges that both run down x = colX(0) in lane 0
  const flow = {
    id: 'f',
    nodes: [node('n1', 0, 0, 'action', ['甲']), node('n2', 1, 0, 'system', ['乙']), node('n3', 2, 0, 'system', ['丙'])],
    edges: [{ id: 'a1', from: 'n1', to: 'n3' }, { id: 'a2', from: 'n2', to: 'n3' }],
  };
  assert.match(collect((r) => checkGeometry(flow, GEO, r)).join('\n'), /a1 and f\/a2 overlap on x=/);
});

test('checkGeometry measures a decision from its diamond, not a box', () => {
  // a bottom route that clears a box but not a diamond must be reported
  const nodes = [node('n1', 1, 0, 'decision', ['甲？']), node('n2', 1, 1, 'decision', ['乙？']), node('n3', 1, 2, 'system', ['丙'])];
  const clearsBoxOnly = { id: 'e1', from: 'n1', to: 'n3', exit: 'bottom', enter: 'bottom', via: GEO.laneY(1) + GEO.NODE_H / 2 + 2 };
  assert.match(collect((r) => checkGeometry({ id: 'f', nodes, edges: [clearsBoxOnly] }, GEO, r)).join('\n'), /runs through node n2/);
  const clearsDiamond = { ...clearsBoxOnly, via: GEO.laneY(1) + GEO.DIAMOND + 2 };
  assert.deepEqual(collect((r) => checkGeometry({ id: 'f', nodes, edges: [clearsDiamond] }, GEO, r)), []);
});

test('checkGeometry reports a label its own line turns underneath', () => {
  const flow = {
    id: 'f',
    nodes: [node('n1', 1, 0, 'decision', ['甲？']), node('n2', 0, 1, 'action', ['乙'])],
    edges: [{ id: 'a1', from: 'n1', to: 'n2', label: '是', enter: 'left' }],
  };
  assert.match(collect((r) => checkGeometry(flow, GEO, r)).join('\n'), /crossed by its own line/);
});

test('the CLI exits non-zero only for errors, never for warnings', () => {
  const run = (args) => spawnSync(process.execPath, ['scripts/check-flows.mjs', ...args], { encoding: 'utf8' });
  const real = run([]);
  assert.ok(real.stdout.includes('WARN') || real.stderr.includes('WARN'), 'expected the repository to produce warnings');
  assert.equal(real.status, real.stderr.includes('ERROR') ? 1 : 0);
});

// --- one firing case per remaining rule, found by a mutation sweep ---

const shapeFlow = (over) => ({ id: 'f', lanes: ['甲', '系統'], steps: [{ ref: '結果' }], edges: [], nodes: [], ...over });
const shapeErrors = (over) => collect((r) => checkShape(shapeFlow(over), r)).join('\n');

test('checkShape reports a ninth node and an eighth column', () => {
  const nine = Array.from({ length: 9 }, (_, i) => node(`n${i}`, 0, i, 'action', ['甲']));
  assert.match(shapeErrors({ nodes: nine }), /has 9 nodes, over the limit of 8/);
  assert.match(shapeErrors({ nodes: nine }), /spans 9 columns, over the limit of 7/);
  const eightCols = [node('n1', 0, 0, 'action', ['甲']), node('n2', 0, 7, 'action', ['乙'])];
  assert.match(shapeErrors({ nodes: eightCols }), /spans 8 columns/);
});

test('checkShape reports too few and too many lanes', () => {
  assert.match(shapeErrors({ lanes: ['甲'] }), /has 1 lanes, outside 2-4/);
  assert.match(shapeErrors({ lanes: ['甲', '乙', '丙', '丁', '戊'] }), /has 5 lanes, outside 2-4/);
});

test('checkShape reports too few and too many walkthrough steps', () => {
  assert.match(shapeErrors({ steps: [{}, {}, {}] }), /has 3 walkthrough steps, outside 4-10/);
  assert.match(shapeErrors({ steps: Array.from({ length: 11 }, () => ({})) }), /has 11 walkthrough steps, outside 4-10/);
});

test('checkShape reports a three-line label and a decision without 「？」', () => {
  assert.match(shapeErrors({ nodes: [node('n1', 0, 0, 'action', ['甲', '乙', '丙'])] }), /label has 3 lines, over 2/);
  assert.match(shapeErrors({ nodes: [node('n1', 0, 0, 'decision', ['甲'])] }), /does not end with 「？」/);
});

test('checkShape reports Markdown in a walkthrough body', () => {
  for (const body of ['這是**重點**', '這是 `程式碼`', '見 [§甲](#甲)']) {
    assert.match(shapeErrors({ steps: [{ title: '甲', body, ref: '結果' }] }), /body contains Markdown/);
  }
});

test('checkGraph reports a node and an edge that no step lights, and a dangling highlight', () => {
  const flow = {
    id: 'f',
    nodes: [node('s', 0, 0, 'start', []), node('n1', 0, 0, 'action', ['甲']), node('n2', 1, 1, 'system', ['乙'], { end: true })],
    edges: [{ id: 'a0', from: 's', to: 'n1' }, { id: 'a1', from: 'n1', to: 'n2' }],
    steps: [{ highlight: ['s', 'a0', 'nope'] }],
  };
  const out = collect((r) => checkGraph(flow, r)).join('\n');
  assert.match(out, /n1 is never highlighted/);
  assert.match(out, /a1 is never highlighted/);
  assert.match(out, /highlights "nope", which is neither a node nor an edge/);
});

test('anchorOf puts the start node where the skeleton draws it', () => {
  // the skeleton pins the start circle beside the lane labels, not on a column
  const start = node('s', 0, 3, 'start', []);
  assert.deepEqual(anchorOf(start, 'right', GEO), [GEO.LANE_LABEL_W + 14 + GEO.START_R, GEO.laneY(0)]);
  assert.notEqual(anchorOf(start, 'right', GEO)[0], GEO.colX(3) + GEO.START_R);
});

test('parseFlows refuses a node whose lane is not a literal number', () => {
  const src = readFileSync(skeletonDerived()[0], 'utf8').replace('{ id: "n1", lane: 0,', '{ id: "n1", lane: LANE_A,');
  assert.throws(() => parseFlows(src), /lane or col did not parse as a number/);
});

test('parseFlows refuses a via form it cannot read, instead of dropping the route', () => {
  // flow.md allows colX(...) for a horizontal via; the reader does not handle
  // it yet, so it must fail loudly rather than skip that connector
  const file = skeletonDerived().find((f) => /spec-03-01/.test(f));
  const src = readFileSync(file, 'utf8').replace(/via: laneBottom\(1\) - 8/, 'via: colX(2) + 10');
  assert.throws(() => parseFlows(src), /`via:` written but .* understood/);
});
