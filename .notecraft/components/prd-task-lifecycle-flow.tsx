import { useRef, useEffect, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

/**
 * PRD 跨模組流程：以「模組」為泳道的流程圖＋逐步走查。
 * 跨泳道的連線是交接，標圓形編號；黃框與黃色虛線是例外或替代路徑。
 * 事件框下方小字是商機狀態變化，對應 §共用狀態機。
 */

/* ============================================================ 【骨架】色票與型別 */

const PRIMARY = "#6366F1"; // --color-primary
const PRIMARY_SOFT = "#EEF2FF"; // --color-primary-soft-bg
const PRIMARY_BORDER = "#C7D2FE"; // --color-primary-border
const WARNING = "#A16207"; // --color-warning
const WARNING_BG = "#FEFCE8"; // --color-warning-bg
const WARNING_TEXT = "#A16207"; // --color-warning
const INK = "#1E1B4B"; // --color-ink
const TEXT = "#1E1B4B"; // --color-ink
const MUTED = "#64748B"; // --color-ink-muted
const FAINT = "#64748B"; // --color-ink-muted (lightest text allowed for WCAG AA)
const LINE = "#E2E8F0"; // --color-border
const LINE_2 = "#C7D2FE"; // --color-primary-border
const FONT = "'Inter','Noto Sans TC','PingFang TC',-apple-system,sans-serif"; // --font-sans
const DIM = 0.25;

type Side = "left" | "right" | "top" | "bottom";
type Kind = "start" | "event" | "decision";

interface Lane {
  id: string;
  label: string;
  color: string;
  /** 泳道內的列數：1 或 2 */
  rows: 1 | 2;
}

interface FlowNode {
  id: string;
  kind: Kind;
  lane: number;
  col: number;
  /** 兩列泳道時：0 上列、1 下列 */
  row?: 0 | 1;
  lines?: string[];
  /** 事件框下方的狀態變化 */
  state?: string;
  end?: boolean;
  exception?: boolean;
}

interface FlowEdge {
  id: string;
  from: string;
  to: string;
  exit?: Side;
  enter?: Side;
  /** 兩端都垂直進出時的轉折 y；兩端都水平進出時的轉折 x */
  via?: number;
  label?: string;
  /** 交接編號（跨泳道的交接） */
  handoff?: number;
  exception?: boolean;
}

interface Step {
  ref: string;
  title: string;
  body: string;
  handoff?: string;
  spec?: string;
  highlight: string[];
}

/* ============================================================ 【骨架】幾何 */

const LABEL_W = 128;
const COL_W = 112;
const ROW_H = 76;
const LANE_PAD = 18;
const NODE_W = 96;
const NODE_H = 52;
const DEC_W = 76;
const DEC_H = 52;

/* ============================================================ 【資料】泳道、節點、連線、走查 */

const TITLE = "任務從建立到匯出";
const TRIGGER = "起點：專案負責人在任務管理建立任務";
const RESULT = "終點：任務已完成，匯出標記結果";

const LANES: Lane[] = [
  { id: "m03", label: "03 任務管理", color: "#1D4ED8", rows: 2 },
  { id: "m04", label: "04 標記作業", color: "#8B5CF6", rows: 1 },
  { id: "m05", label: "05 資料集", color: "#818CF8", rows: 1 },
];

const NODES: FlowNode[] = [
  { id: "s", kind: "start", lane: 0, col: 0, row: 1 },
  { id: "t1", kind: "event", lane: 0, col: 1, row: 1, lines: ["建立任務"], state: "草稿" },
  { id: "t2", kind: "event", lane: 0, col: 2, row: 1, lines: ["啟動試標"], state: "→ 試標中" },
  { id: "a1", kind: "event", lane: 1, col: 3, lines: ["標記員", "試標作答"] },
  { id: "i1", kind: "event", lane: 2, col: 4, lines: ["計算 IAA"], state: "→ 等待 IAA 確認" },
  { id: "d1", kind: "decision", lane: 0, col: 5, row: 1, lines: ["接受", "IAA？"] },
  { id: "x1", kind: "event", lane: 0, col: 5, row: 0, lines: ["退回草稿或", "再開一輪"], exception: true },
  { id: "t3", kind: "event", lane: 0, col: 6, row: 1, lines: ["啟動", "正式標記"], state: "→ 正式標記中" },
  { id: "a2", kind: "event", lane: 1, col: 6, lines: ["正式作答", "與審核"] },
  { id: "i2", kind: "event", lane: 2, col: 7, lines: ["統計與", "品質分數"], state: "→ 已完成" },
  { id: "t4", kind: "event", lane: 0, col: 7, row: 1, lines: ["匯出", "標記結果"], end: true },
];

const EDGES: FlowEdge[] = [
  { id: "s-t1", from: "s", to: "t1" },
  { id: "t1-t2", from: "t1", to: "t2" },
  { id: "t2-a1", from: "t2", to: "a1", exit: "right", enter: "top", handoff: 1 },
  { id: "a1-i1", from: "a1", to: "i1", exit: "right", enter: "top", handoff: 2 },
  { id: "i1-d1", from: "i1", to: "d1", exit: "right", enter: "bottom", handoff: 3 },
  { id: "d1-t3", from: "d1", to: "t3", label: "是" },
  { id: "d1-x1", from: "d1", to: "x1", exit: "top", enter: "bottom", label: "否", exception: true },
  { id: "x1-t1", from: "x1", to: "t1", exit: "top", enter: "top", via: laneTop(0) + 8, label: "A1", exception: true },
  { id: "x1-t2", from: "x1", to: "t2", exit: "left", enter: "top", label: "A2", exception: true },
  { id: "t3-a2", from: "t3", to: "a2", exit: "bottom", enter: "top", handoff: 4 },
  { id: "a2-i2", from: "a2", to: "i2", exit: "bottom", enter: "left", handoff: 5 },
  { id: "i2-t4", from: "i2", to: "t4", exit: "top", enter: "bottom", handoff: 6 },
];

const STEPS: Step[] = [
  {
    ref: "起點",
    title: "專案負責人建立任務",
    body: "專案負責人在任務管理用任務設定建立任務並上傳資料集，任務是「草稿」。",
    spec: "規格 03-02（未撰寫）",
    highlight: ["s", "t1", "s-t1"],
  },
  {
    ref: "交接 1",
    title: "啟動試標",
    body: "專案負責人啟動試標，任務改為「試標中」；被指派的標記員在標記清單看到試標資料。",
    handoff: "03 任務管理 → 04 標記作業：試標資料與被指派的標記員",
    spec: "規格 03-03、04-01（未撰寫）",
    highlight: ["t1", "t2", "a1", "t1-t2", "t2-a1"],
  },
  {
    ref: "交接 2",
    title: "試標送出，計算 IAA",
    body: "試標的標記結果都送出後，資料集計算 IAA，任務改為「等待 IAA 確認」。",
    handoff: "04 標記作業 → 05 資料集：試標的標記結果",
    spec: "規格 04-02、05-02（未撰寫）",
    highlight: ["a1", "i1", "a1-i1"],
  },
  {
    ref: "交接 3",
    title: "專案負責人查看 IAA",
    body: "專案負責人在任務詳情查看 IAA，決定接受、退回草稿，或再開一輪試標；IAA 只供參考，不會自動擋下。",
    handoff: "05 資料集 → 03 任務管理：IAA",
    spec: "規格 03-03、05-02（未撰寫）",
    highlight: ["i1", "d1", "i1-d1"],
  },
  {
    ref: "替代 A1",
    title: "替代：退回草稿",
    body: "專案負責人退回草稿，任務回到「草稿」，修改任務設定後回到起點。",
    spec: "規格 03-03（未撰寫）",
    highlight: ["d1", "x1", "t1", "d1-x1", "x1-t1"],
  },
  {
    ref: "替代 A2",
    title: "替代：再開一輪試標",
    body: "專案負責人再開一輪試標，任務回到「試標中」，回到交接 1。",
    spec: "規格 03-03（未撰寫）",
    highlight: ["d1", "x1", "t2", "d1-x1", "x1-t2"],
  },
  {
    ref: "交接 4",
    title: "啟動正式標記",
    body: "專案負責人接受 IAA 結果並啟動正式標記，任務改為「正式標記中」；標記員開始正式作答，審核員開始審核。",
    handoff: "03 任務管理 → 04 標記作業：正式標記的資料與成員",
    spec: "規格 03-03、04-02（未撰寫）",
    highlight: ["d1", "t3", "a2", "d1-t3", "t3-a2"],
  },
  {
    ref: "交接 5",
    title: "審核定稿，計算品質",
    body: "審核定稿的結果與爭議處理結果進入資料集，計算統計與品質分數。",
    handoff: "04 標記作業 → 05 資料集：審核定稿的結果與爭議處理結果",
    spec: "規格 04-02、05-02（未撰寫）",
    highlight: ["a2", "i2", "a2-i2"],
  },
  {
    ref: "交接 6",
    title: "任務完成，匯出結果",
    body: "標記結果都已送出、審核都已定稿、沒有未決爭議、仲裁都已完成、品質分數都已算出後，任務進入「已完成」，專案負責人匯出標記結果。",
    handoff: "05 資料集 → 03 任務管理：任務已完成",
    spec: "規格 03-03（未撰寫）",
    highlight: ["i2", "t4", "i2-t4"],
  },
  {
    ref: "結果",
    title: "任務已完成",
    body: "任務停在「已完成」，不能再往回走；匯出格式為 JSON／JSON-MIN。",
    highlight: ["i2", "t4"],
  },
];

/* ============================================================ 【骨架】座標與路由 */

function laneHeight(i: number): number {
  return LANES[i].rows * ROW_H + LANE_PAD * 2;
}
function laneTop(i: number): number {
  let y = 0;
  for (let k = 0; k < i; k += 1) y += laneHeight(k);
  return y;
}
function laneBottom(i: number): number {
  return laneTop(i) + laneHeight(i);
}
const TOTAL_H = LANES.reduce((s, _l, i) => s + laneHeight(i), 0);
const MAX_COL = NODES.reduce((m, n) => Math.max(m, n.col), 0);
const TOTAL_W = LABEL_W + (MAX_COL + 1) * COL_W + 24;

interface Pt {
  x: number;
  y: number;
}

function center(n: FlowNode): Pt {
  const x = LABEL_W + n.col * COL_W + COL_W / 2 - (n.kind === "start" ? COL_W / 2 - 18 : 0);
  const lane = LANES[n.lane];
  const y = lane.rows === 2 ? laneTop(n.lane) + LANE_PAD + (n.row ?? 0) * ROW_H + ROW_H / 2 : laneTop(n.lane) + laneHeight(n.lane) / 2;
  return { x, y };
}
function half(n: FlowNode): Pt {
  if (n.kind === "start") return { x: 7, y: 7 };
  if (n.kind === "decision") return { x: DEC_W / 2, y: DEC_H / 2 };
  return { x: NODE_W / 2, y: NODE_H / 2 };
}
function anchor(n: FlowNode, side: Side): Pt {
  const c = center(n);
  const h = half(n);
  if (side === "left") return { x: c.x - h.x, y: c.y };
  if (side === "right") return { x: c.x + h.x, y: c.y };
  if (side === "top") return { x: c.x, y: c.y - h.y };
  return { x: c.x, y: c.y + h.y };
}
function horiz(s: Side): boolean {
  return s === "left" || s === "right";
}
function route(e: FlowEdge, a: FlowNode, b: FlowNode): { d: string; mid: Pt; labelAt: Pt } {
  const exit: Side = e.exit ?? (a.lane === b.lane || a.col === b.col ? (a.col === b.col ? (b.lane > a.lane ? "bottom" : "top") : "right") : "right");
  const enter: Side = e.enter ?? (a.col === b.col ? (b.lane > a.lane ? "top" : "bottom") : "left");
  const p0 = anchor(a, exit);
  const p1 = anchor(b, enter);
  let d: string;
  let mid: Pt;
  if (horiz(exit) && horiz(enter)) {
    if (Math.abs(p0.y - p1.y) < 1) {
      d = `M${p0.x},${p0.y} H${p1.x}`;
      mid = { x: (p0.x + p1.x) / 2, y: p0.y };
    } else {
      const vx = e.via ?? (p0.x + p1.x) / 2;
      d = `M${p0.x},${p0.y} H${vx} V${p1.y} H${p1.x}`;
      mid = { x: vx, y: (p0.y + p1.y) / 2 };
    }
  } else if (!horiz(exit) && !horiz(enter)) {
    if (Math.abs(p0.x - p1.x) < 1) {
      d = `M${p0.x},${p0.y} V${p1.y}`;
      mid = { x: p0.x, y: (p0.y + p1.y) / 2 };
    } else {
      const vy = e.via ?? (p0.y + p1.y) / 2;
      d = `M${p0.x},${p0.y} V${vy} H${p1.x} V${p1.y}`;
      mid = { x: (p0.x + p1.x) / 2, y: vy };
    }
  } else if (horiz(exit)) {
    d = `M${p0.x},${p0.y} H${p1.x} V${p1.y}`;
    mid = { x: (p0.x + p1.x) / 2, y: p0.y };
  } else {
    d = `M${p0.x},${p0.y} V${p1.y} H${p1.x}`;
    // 編號放在靠近起點的位置，避開和其他水平線的交叉點
    mid = { x: p0.x, y: p0.y + (p1.y - p0.y) * 0.3 };
  }
  const off = 10;
  const labelAt =
    exit === "right" ? { x: p0.x + 6, y: p0.y - 6 } : exit === "left" ? { x: p0.x - 22, y: p0.y - 6 } : exit === "top" ? { x: p0.x + 6, y: p0.y - off } : { x: p0.x + 6, y: p0.y + off + 3 };
  return { d, mid, labelAt };
}

/* ============================================================ 【骨架】圖形 */

function NodeShape({ n, active, dim, onClick }: { n: FlowNode; active: boolean; dim: boolean; onClick: () => void }): ReactElement {
  const c = center(n);
  const stroke = active ? PRIMARY : n.exception ? WARNING : n.kind === "event" && !n.exception ? PRIMARY : LINE_2;
  const fill = n.exception ? WARNING_BG : n.kind === "event" ? (active ? PRIMARY_BORDER : PRIMARY_SOFT) : "#ffffff";
  const sw = (active ? 2.2 : 1.2) + (n.end ? 1.4 : 0);
  const onKey = (e: KeyboardEvent<SVGGElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };
  const lines = n.lines ?? [];
  // 狀態變化寫在框內最後一行，框下方留給連線
  const rows = n.state ? [...lines, n.state] : lines;
  const textColor = n.exception ? WARNING_TEXT : INK;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={lines.join("") || "起點"}
      onClick={onClick}
      onKeyDown={onKey}
      style={{ cursor: "pointer", opacity: dim ? DIM : 1, transition: "opacity 200ms ease-out", outline: "none" }}
    >
      {n.kind === "start" && <circle cx={c.x} cy={c.y} r={7} fill={INK} />}
      {n.kind === "event" && <rect x={c.x - NODE_W / 2} y={c.y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={8} fill={fill} stroke={stroke} strokeWidth={sw} />}
      {n.kind === "decision" && (
        <polygon
          points={`${c.x},${c.y - DEC_H / 2} ${c.x + DEC_W / 2},${c.y} ${c.x},${c.y + DEC_H / 2} ${c.x - DEC_W / 2},${c.y}`}
          fill="#ffffff"
          stroke={active ? PRIMARY : LINE_2}
          strokeWidth={active ? 2.2 : 1.2}
        />
      )}
      {rows.map((t, i) => {
        const isState = n.state !== undefined && i === rows.length - 1;
        return (
          <text
            key={t}
            x={c.x}
            y={c.y + (i - (rows.length - 1) / 2) * 14 + 4.5}
            textAnchor="middle"
            fontSize={isState ? 10.5 : n.kind === "decision" ? 11 : 12.5}
            fontWeight={isState ? 400 : n.kind === "event" ? 600 : 500}
            fill={isState ? (n.exception ? WARNING_TEXT : MUTED) : textColor}
            fontFamily={FONT}
          >
            {t}
          </text>
        );
      })}
    </g>
  );
}

function EdgeLine({ e, active, dim, markerId, markerExId }: { e: FlowEdge; active: boolean; dim: boolean; markerId: string; markerExId: string }): ReactElement | null {
  const a = NODES.find((n) => n.id === e.from);
  const b = NODES.find((n) => n.id === e.to);
  if (!a || !b) return null;
  const { d, mid, labelAt } = route(e, a, b);
  const color = e.exception ? WARNING : active ? PRIMARY : FAINT;
  return (
    <g style={{ opacity: dim ? DIM : 1, transition: "opacity 200ms ease-out" }}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={active ? 2.4 : 1.4}
        strokeDasharray={e.exception ? "5 4" : undefined}
        markerEnd={`url(#${e.exception ? markerExId : markerId})`}
      />
      {e.label && (
        <text x={labelAt.x} y={labelAt.y} fontSize={11} fill={e.exception ? WARNING_TEXT : MUTED} fontFamily={FONT}>
          {e.label}
        </text>
      )}
      {e.handoff !== undefined && (
        <g>
          <circle cx={mid.x} cy={mid.y} r={10} fill={active ? PRIMARY : "#ffffff"} stroke={PRIMARY} strokeWidth={1.4} />
          <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={active ? "#ffffff" : PRIMARY} fontFamily={FONT}>
            {e.handoff}
          </text>
        </g>
      )}
    </g>
  );
}

function Legend(): ReactElement {
  const item = (svg: ReactElement, text: string): ReactElement => (
    <span key={text} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {svg}
      {text}
    </span>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 12, color: MUTED, fontFamily: FONT }}>
      {item(
        <svg width={22} height={14} aria-hidden="true">
          <rect x={1} y={1} width={20} height={12} rx={3} fill={PRIMARY_SOFT} stroke={PRIMARY} />
        </svg>,
        "模組內的事件",
      )}
      {item(
        <svg width={18} height={16} aria-hidden="true">
          <polygon points="9,1 17,8 9,15 1,8" fill="#ffffff" stroke={LINE_2} />
        </svg>,
        "判斷",
      )}
      {item(
        <svg width={22} height={14} aria-hidden="true">
          <rect x={1.5} y={1.5} width={19} height={11} rx={3} fill="#ffffff" stroke={INK} strokeWidth={2.2} />
        </svg>,
        "結束",
      )}
      {item(
        <svg width={28} height={10} aria-hidden="true">
          <path d="M1,5 H27" stroke={WARNING} strokeDasharray="5 4" strokeWidth={1.4} />
        </svg>,
        "例外／替代",
      )}
      {item(
        <svg width={20} height={20} aria-hidden="true">
          <circle cx={10} cy={10} r={8} fill="#ffffff" stroke={PRIMARY} strokeWidth={1.4} />
          <text x={10} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={PRIMARY}>
            1
          </text>
        </svg>,
        "模組間交接",
      )}
    </div>
  );
}

/* ============================================================ 【骨架】外殼 */

// 走查說明的交接次數依資料計算（同一個編號畫成兩條線時只算一次）
const HANDOFF_COUNT = new Set(EDGES.flatMap((e) => (e.handoff === undefined ? [] : [e.handoff]))).size;

export default function PrdTaskLifecycleFlow(): ReactElement {
  const reduce = useReducedMotion();
  // 第一次 render（含 SSR）直接呈現終態，之後切換時才播放進場
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const [step, setStep] = useState<number | null>(null);
  const lit = step === null ? null : new Set(STEPS[step].highlight);
  const isLit = (id: string): boolean => lit !== null && lit.has(id);
  const isDim = (id: string): boolean => lit !== null && !lit.has(id);
  const jumpTo = (nodeId: string): void => {
    const i = STEPS.findIndex((s) => s.highlight.includes(nodeId));
    if (i >= 0) setStep(i);
  };
  const cur = step === null ? null : STEPS[step];
  const btn = (enabled: boolean, primary: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 12px",
    borderRadius: 6,
    border: `1px solid ${primary ? PRIMARY : LINE_2}`,
    background: primary ? PRIMARY : "#ffffff",
    color: primary ? "#ffffff" : TEXT,
    fontSize: 13,
    fontFamily: FONT,
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.45,
  });

  return (
    <div className="not-prose" style={{ width: "100%", fontFamily: FONT, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{TITLE}</div>
          <div style={{ fontSize: 12, color: MUTED }}>
            {TRIGGER}　{RESULT}
          </div>
        </div>
        <button type="button" style={btn(true, step === null)} onClick={() => setStep(step === null ? 0 : null)}>
          {step === null ? "逐步走查" : (
            <>
              <RotateCcw size={14} />
              結束走查
            </>
          )}
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`} width="100%" role="img" aria-label={`跨模組流程：${TITLE}`} style={{ minWidth: 820, display: "block" }}>
          <defs>
            <marker id="pcmf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={FAINT} />
            </marker>
            <marker id="pcmf-arrow-ex" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={WARNING} />
            </marker>
          </defs>
          <rect x={0.5} y={0.5} width={TOTAL_W - 1} height={TOTAL_H - 1} fill="#ffffff" stroke={LINE} rx={6} />
          {LANES.map((l, i) => (
            <g key={l.id}>
              {i > 0 && <line x1={0} x2={TOTAL_W} y1={laneTop(i)} y2={laneTop(i)} stroke={LINE} />}
              <rect x={12} y={laneTop(i) + 14} width={4} height={laneHeight(i) - 28} rx={2} fill={l.color} />
              <text x={24} y={laneTop(i) + laneHeight(i) / 2 + 4} fontSize={13} fontWeight={600} fill={INK} fontFamily={FONT}>
                {l.label}
              </text>
            </g>
          ))}
          <line x1={LABEL_W - 8} x2={LABEL_W - 8} y1={0} y2={TOTAL_H} stroke={LINE} />
          {EDGES.map((e) => (
            <EdgeLine key={e.id} e={e} active={isLit(e.id)} dim={isDim(e.id)} markerId="pcmf-arrow" markerExId="pcmf-arrow-ex" />
          ))}
          {NODES.map((n) => (
            <NodeShape key={n.id} n={n} active={isLit(n.id)} dim={isDim(n.id)} onClick={() => jumpTo(n.id)} />
          ))}
        </svg>
      </div>

      <motion.div
        key={step ?? "idle"}
        initial={reduce || !mounted.current ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "12px 14px", minHeight: 132, background: "#ffffff" }}
      >
        {cur === null ? (
          <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
            按「逐步走查」依序看 {HANDOFF_COUNT} 次交接、例外與替代路徑；也可以直接點圖上的節點。圓形編號是模組之間的交接，黃色是例外或替代路徑。
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: cur.ref.startsWith("例外") || cur.ref.startsWith("替代") ? WARNING_BG : PRIMARY_SOFT,
                  color: cur.ref.startsWith("例外") || cur.ref.startsWith("替代") ? WARNING_TEXT : PRIMARY,
                }}
              >
                {cur.ref}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>{cur.title}</span>
            </div>
            <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.7 }}>{cur.body}</div>
            {cur.handoff && <div style={{ fontSize: 12.5, color: TEXT }}>交接：{cur.handoff}</div>}
            {cur.spec && <div style={{ fontSize: 12.5, color: MUTED }}>細節：{cur.spec}</div>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 5 }} aria-label={`第 ${(step ?? 0) + 1} 步，共 ${STEPS.length} 步`}>
                {STEPS.map((s, i) => (
                  <span key={s.ref} style={{ width: 7, height: 7, borderRadius: 999, background: i === step ? PRIMARY : i < (step ?? 0) ? PRIMARY_BORDER : LINE_2 }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={btn((step ?? 0) > 0, false)} disabled={(step ?? 0) === 0} onClick={() => setStep(Math.max(0, (step ?? 0) - 1))}>
                  <ChevronLeft size={14} />
                  上一步
                </button>
                <button
                  type="button"
                  style={btn(true, true)}
                  onClick={() => setStep((step ?? 0) + 1 < STEPS.length ? (step ?? 0) + 1 : null)}
                >
                  {(step ?? 0) + 1 < STEPS.length ? "下一步" : "完成"}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
      <Legend />
    </div>
  );
}
