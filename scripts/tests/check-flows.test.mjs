// Regression tests for scripts/check-flows.mjs. Run: node --test scripts/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readFileSync } from 'node:fs';

import {
  PINNED_GEOMETRY_FINGERPRINT,
  SKELETON,
  geometryFingerprint,
  checkAgainstSpec,
  checkFlowsIn,
  checkGeometry,
  checkGraph,
  checkShape,
  checkWalkthrough,
  flowComponents,
  skeletonDerived,
  geometryFrom,
  parseFlows,
  skeletonPrefix,
  width,
} from '../check-flows.mjs';

test('skeletonPrefix cuts at the flow divider comment, not a fixed line count', () => {
  const src = ['const A = 1;', 'const B = 2;', '/* ==== 【流程】依規格填寫 ==== */', 'const FLOWS = [];'].join('\n');
  assert.equal(skeletonPrefix(src), 'const A = 1;\nconst B = 2;\n');
});

test('skeletonPrefix returns null when the divider is missing', () => {
  assert.equal(skeletonPrefix('const A = 1;\n'), null);
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
  assert.match(out, /lane "標記員" is not named/);
});

test('checkAgainstSpec accepts a lane named only in prose and an A或B lane', () => {
  const page = { rel: 'p.mdx', scenarios: new Set(), flowTitles: ['走一遍'], roles: new Set(['平台成員', '系統管理員']), rolesChapter: '受邀的使用者會收到信' };
  const flow = { id: 'f', label: '走一遍', lanes: ['平台成員或系統管理員', '受邀的使用者'], steps: [] };
  assert.deepEqual(collect((r) => checkAgainstSpec(flow, page, r)), []);
});

test('every skeleton-derived component parses and the 03 module flows are clean', () => {
  const files = skeletonDerived().filter((f) => /spec-03-/.test(f));
  assert.equal(files.length, 3);
  const { errors } = checkFlowsIn({ files });
  assert.deepEqual(errors, []);
});
