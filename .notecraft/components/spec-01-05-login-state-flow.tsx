import { useId, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

/**
 * spec-writing 業務流程圖骨架（參考實作）。寫法見同目錄的 flow.md。
 *
 * 使用方式：整份複製到 .notecraft/components/spec-<模組編號>-<頁面編號>-<主題>-flow.tsx，
 * 【骨架】一字不改；【流程】整段換成這份規格的流程資料，default export 改名。
 *
 * 【流程】目前填的是規格 01-01 客戶聯絡紀錄，當作範例：
 * - FLOWS：每段業務流程一筆，包含泳道、節點、連線與走查步驟
 * - 節點位置用「泳道 lane × 欄 col」指定，連線由骨架自動走直角線；
 *   自動路線會穿過其他節點時，用 exit／enter／via 指定（見 flow.md「連線」）
 */

/* ================================================================ 【骨架】不可修改 ================================================================ */

/* ---------------------------------------------------------------- 色票（label-suite-design，來源 design/prototype/assets/tokens.css） */

const PRIMARY_STRONG = "#4F46E5"; // --color-primary-strong
const PRIMARY = "#6366F1"; // --color-primary
const PRIMARY_SOFT = "#EEF2FF"; // --color-primary-soft-bg
const WARNING = "#A16207"; // --color-warning
const WARNING_BG = "#FEFCE8"; // --color-warning-bg
const WARNING_TEXT = "#A16207"; // --color-warning
const INK = "#1E1B4B"; // --color-ink
const TEXT = "#1E1B4B"; // --color-ink
const MUTED = "#64748B"; // --color-ink-muted
const FAINT = "#64748B"; // --color-ink-muted (lightest text allowed for WCAG AA)
const LINE = "#E2E8F0"; // --color-border
const LINE_2 = "#C7D2FE"; // --color-primary-border
const LANE_BG = "#F8FAFC"; // --color-slate-50
const FONT = "'Inter','Noto Sans TC','PingFang TC',-apple-system,sans-serif"; // --font-sans

/* ---------------------------------------------------------------- 型別 */

interface Choice {
  value: string;
  label: string;
}

/** 節點種類：開始點、角色操作、系統回應、判斷 */
type NodeKind = "start" | "action" | "system" | "decision";

/** 連線從節點的哪一側出去或進來 */
type Side = "left" | "right" | "top" | "bottom";

interface FlowNode {
  id: string;
  /** 泳道索引，對應 Flow.lanes */
  lane: number;
  /** 欄索引，由左而右從 0 起算；開始點固定畫在第 0 欄左側，col 寫 0 */
  col: number;
  kind: NodeKind;
  /** 節點文字，最多兩行；操作與回應每行 ≤ 6 字，判斷每行 ≤ 4 字並以「？」結尾 */
  label: string[];
  /** 流程在這個節點結束（粗框） */
  end?: boolean;
  /** 例外或替代流程才會走到的節點（黃色） */
  exception?: boolean;
}

interface FlowEdge {
  id: string;
  from: string;
  to: string;
  /** 例外或替代流程（黃色虛線） */
  exception?: boolean;
  /** 判斷出口的文字：是、否，或極短的條件 */
  label?: string;
  /** 指定出口側；不寫時依位置自動決定 */
  exit?: Side;
  /** 指定入口側；不寫時依位置自動決定 */
  enter?: Side;
  /** 折線經過的座標：水平進出時是 x、垂直進出時是 y；用 laneTop／laneBottom／colX 計算 */
  via?: number;
}

interface FlowStep {
  title: string;
  body: string;
  /** 對應的驗收 Scenario 名稱，必須與規格「驗收標準」完全一致；純操作說明可留空 */
  scenarios: string[];
  /** 對應規格「業務流程」的步驟代號，例：主流程 2、E1、A1 */
  ref: string;
  /** 這一步要亮起的節點與連線 id */
  highlight: string[];
}

interface Flow {
  id: string;
  /** 業務流程名稱，與規格「業務流程」章節的粗體標題一致 */
  label: string;
  trigger: string;
  result: string;
  /** 泳道名稱（角色或「系統」），由上而下 */
  lanes: string[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  steps: FlowStep[];
}

interface Point {
  x: number;
  y: number;
}

/* ---------------------------------------------------------------- 幾何 */

const LANE_LABEL_W = 76;
const GRID_LEFT = LANE_LABEL_W + 28;
const COL_W = 96;
const LANE_H = 108;
const NODE_W = 80;
const NODE_H = 44;
const DIAMOND = 36;
const START_R = 7;
const RING = 4;

/** 第 col 欄的中心 x */
function colX(col: number): number {
  return GRID_LEFT + col * COL_W + COL_W / 2;
}

/** 第 lane 條泳道的中心 y */
function laneY(lane: number): number {
  return lane * LANE_H + LANE_H / 2;
}

/** 第 lane 條泳道的上緣 y */
function laneTop(lane: number): number {
  return lane * LANE_H;
}

/** 第 lane 條泳道的下緣 y */
function laneBottom(lane: number): number {
  return (lane + 1) * LANE_H;
}

/** 節點中心點；開始點固定在格線左側 */
function center(n: FlowNode): Point {
  return { x: n.kind === "start" ? LANE_LABEL_W + 14 : colX(n.col), y: laneY(n.lane) };
}

/** 節點中心到邊緣的水平、垂直距離 */
function halfSize(n: FlowNode): Point {
  if (n.kind === "start") return { x: START_R, y: START_R };
  if (n.kind === "decision") return { x: DIAMOND, y: DIAMOND };
  return { x: NODE_W / 2, y: NODE_H / 2 };
}

/** 節點某一側的連接點 */
function anchor(n: FlowNode, side: Side): Point {
  const c = center(n);
  const h = halfSize(n);
  if (side === "left") return { x: c.x - h.x, y: c.y };
  if (side === "right") return { x: c.x + h.x, y: c.y };
  if (side === "top") return { x: c.x, y: c.y - h.y };
  return { x: c.x, y: c.y + h.y };
}

/** 依兩個節點的相對位置決定預設的出口與入口 */
function defaultSides(from: FlowNode, to: FlowNode): [Side, Side] {
  if (from.kind !== "start" && from.col === to.col) return to.lane > from.lane ? ["bottom", "top"] : ["top", "bottom"];
  if (from.lane === to.lane) return to.col > from.col || from.kind === "start" ? ["right", "left"] : ["bottom", "bottom"];
  return ["right", to.lane > from.lane ? "top" : "bottom"];
}

/** 是否水平進出 */
function isHorizontal(side: Side): boolean {
  return side === "left" || side === "right";
}

/** 直角折線的 SVG path */
function routePath(p0: Point, s0: Side, p1: Point, s1: Side, via: number | undefined): string {
  const start = `M${p0.x},${p0.y}`;
  if (isHorizontal(s0) && isHorizontal(s1)) {
    if (p0.y === p1.y) return `${start} H${p1.x}`;
    const mx = via ?? (p0.x + p1.x) / 2;
    return `${start} H${mx} V${p1.y} H${p1.x}`;
  }
  if (!isHorizontal(s0) && !isHorizontal(s1)) {
    if (p0.x === p1.x) return `${start} V${p1.y}`;
    const my = via ?? (p0.y + p1.y) / 2;
    return `${start} V${my} H${p1.x} V${p1.y}`;
  }
  if (isHorizontal(s0)) return `${start} H${p1.x} V${p1.y}`;
  return `${start} V${p1.y} H${p1.x}`;
}

/** 判斷出口文字的位置：貼著出口 */
function labelPos(p0: Point, s0: Side): { x: number; y: number; anchor: "start" | "end" } {
  if (s0 === "right") return { x: p0.x + 6, y: p0.y - 6, anchor: "start" };
  if (s0 === "left") return { x: p0.x - 6, y: p0.y - 6, anchor: "end" };
  if (s0 === "top") return { x: p0.x + 6, y: p0.y - 6, anchor: "start" };
  return { x: p0.x + 10, y: p0.y + 4, anchor: "start" };
}

/* ---------------------------------------------------------------- 圖形 */

/** 節點：開始點（實心圓）、角色操作（藍）、系統回應（白）、判斷（菱形）；例外節點黃色、結束節點粗框 */
/** 泳道名稱超過 5 個字時換行：優先在「或」「、」「／」之後斷開，否則每 5 個字一行 */
function laneLabelLines(name: string): string[] {
  const MAX = 5;
  if (name.length <= MAX) return [name];
  const cut = [...name].findIndex((ch, i) => "或、／".includes(ch) && i + 1 <= MAX && name.length - (i + 1) <= MAX);
  if (cut >= 0) return [name.slice(0, cut + 1), name.slice(cut + 1)];
  const lines: string[] = [];
  for (let i = 0; i < name.length; i += MAX) lines.push(name.slice(i, i + MAX));
  return lines;
}

function FlowNodeShape({ n, active, dim, onClick }: { n: FlowNode; active: boolean; dim: boolean; onClick: () => void }): ReactElement {
  const c = center(n);
  const fill = n.exception ? WARNING_BG : n.kind === "action" ? PRIMARY_SOFT : "#fff";
  const stroke = n.exception ? WARNING : n.kind === "action" ? PRIMARY : n.kind === "decision" ? MUTED : LINE_2;
  const color = n.exception ? WARNING_TEXT : n.kind === "action" ? PRIMARY_STRONG : TEXT;
  const width = n.end ? 2.2 : 1;
  const style: CSSProperties = { cursor: "pointer", opacity: dim ? 0.3 : 1, transition: "opacity 200ms" };
  let shape: ReactNode;
  let ring: ReactNode = null;
  if (n.kind === "start") {
    shape = <circle cx={c.x} cy={c.y} r={START_R} fill={MUTED} />;
    if (active) ring = <circle cx={c.x} cy={c.y} r={START_R + RING} fill="none" stroke={PRIMARY} strokeWidth={2} />;
  } else if (n.kind === "decision") {
    const pts = (d: number): string => `${c.x},${c.y - d} ${c.x + d},${c.y} ${c.x},${c.y + d} ${c.x - d},${c.y}`;
    shape = <polygon points={pts(DIAMOND)} fill={fill} stroke={stroke} strokeWidth={width} />;
    if (active) ring = <polygon points={pts(DIAMOND + RING + 2)} fill="none" stroke={PRIMARY} strokeWidth={2} />;
  } else {
    shape = <rect x={c.x - NODE_W / 2} y={c.y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={6} fill={fill} stroke={stroke} strokeWidth={width} />;
    if (active)
      ring = (
        <rect
          x={c.x - NODE_W / 2 - RING}
          y={c.y - NODE_H / 2 - RING}
          width={NODE_W + RING * 2}
          height={NODE_H + RING * 2}
          rx={8}
          fill="none"
          stroke={PRIMARY}
          strokeWidth={2}
        />
      );
  }
  return (
    <g style={style} onClick={onClick} role="button" aria-label={n.kind === "start" ? "開始" : n.label.join("")}>
      {ring}
      {shape}
      {n.label.map((t, i) => (
        <text
          key={t}
          x={c.x}
          y={c.y + (n.label.length > 1 ? (i === 0 ? -8 : 8) : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontFamily={FONT}
          fill={color}
        >
          {t}
        </text>
      ))}
    </g>
  );
}

/** 連線：主流程灰色實線、例外與替代流程黃色虛線；亮起時加粗 */
function FlowEdgeLine({ e, nodes, markerId, active, dim }: { e: FlowEdge; nodes: Map<string, FlowNode>; markerId: string; active: boolean; dim: boolean }): ReactElement | null {
  const from = nodes.get(e.from);
  const to = nodes.get(e.to);
  if (!from || !to) return null;
  const [ds0, ds1] = defaultSides(from, to);
  const s0 = e.exit ?? ds0;
  const s1 = e.enter ?? ds1;
  const p0 = anchor(from, s0);
  const p1 = anchor(to, s1);
  const lp = labelPos(p0, s0);
  const color = e.exception ? WARNING : MUTED;
  return (
    <g style={{ opacity: dim ? 0.25 : 1, transition: "opacity 200ms" }}>
      <path
        d={routePath(p0, s0, p1, s1, e.via)}
        fill="none"
        stroke={color}
        strokeWidth={active ? 2.4 : 1.3}
        strokeDasharray={e.exception ? "5 4" : undefined}
        markerEnd={`url(#${markerId}-${e.exception ? "exc" : "main"})`}
      />
      {e.label ? (
        <text x={lp.x} y={lp.y} textAnchor={lp.anchor} fontSize={11.5} fontFamily={FONT} fill={e.exception ? WARNING_TEXT : MUTED}>
          {e.label}
        </text>
      ) : null}
    </g>
  );
}

/* ---------------------------------------------------------------- 控制列 */

function Tabs({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  label: string;
  value: string | null;
  options: Choice[];
  onChange: (v: string) => void;
  icon?: ReactNode;
}): ReactElement {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, color: MUTED, minWidth: 56 }}>{label}</span>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            style={{
              fontFamily: FONT,
              fontSize: 12.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 12px",
              borderRadius: 999,
              cursor: "pointer",
              border: `1px solid ${on ? PRIMARY_STRONG : LINE_2}`,
              background: on ? PRIMARY_STRONG : "#fff",
              color: on ? "#fff" : TEXT,
            }}
          >
            {icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- 走查卡片 */

/** 走查卡片：標題、說明、對應 Scenario、規格步驟代號、進度點、上一步與下一步 */
function StepCard({
  step,
  index,
  count,
  onPrev,
  onNext,
  onClose,
}: {
  step: FlowStep | null;
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}): ReactElement {
  const plain: CSSProperties = { fontFamily: FONT, fontSize: 12, border: "none", background: "transparent", padding: "4px 2px", display: "inline-flex", alignItems: "center", gap: 2, cursor: "pointer" };
  if (!step)
    return (
      <div style={{ border: `1px dashed ${LINE_2}`, borderRadius: 8, padding: "12px 14px", fontSize: 12.5, color: MUTED }}>
        選「逐步走查」依序看主流程與例外流程，或直接點擊節點跳到對應的步驟
      </div>
    );
  const last = index === count - 1;
  return (
    <div aria-live="polite" style={{ border: `1px solid ${LINE_2}`, borderRadius: 8, padding: "12px 14px", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 11.5, color: FAINT }}>{step.ref}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{step.title}</span>
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.65, color: TEXT, marginTop: 6 }}>{step.body}</div>
      <div style={{ fontSize: 11, lineHeight: 1.5, color: FAINT, marginTop: 8 }}>對應：{step.scenarios.length ? step.scenarios.join("、") : "無（操作說明）"}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
        <span role="img" aria-label={`第 ${index + 1} 步，共 ${count} 步`} style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: i === index ? PRIMARY : LINE_2 }} />
          ))}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {index > 0 ? (
            <button type="button" onClick={onPrev} style={{ ...plain, color: MUTED }}>
              <ChevronLeft size={13} />
              上一步
            </button>
          ) : null}
          <button type="button" onClick={last ? onClose : onNext} style={{ ...plain, padding: "4px 12px", borderRadius: 4, background: PRIMARY, color: "#fff" }}>
            {last ? "完成" : "下一步"}
            {last ? null : <ChevronRight size={13} />}
          </button>
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 外殼 */

/**
 * 業務流程圖外殼：上方控制列（流程、逐步走查）、觸發與結果、泳道圖、走查卡片、下方圖例。
 * 切換流程會結束走查；點擊節點跳到第一個亮起它的步驟。窄螢幕時只有泳道圖在框內橫向捲動。
 */
function FlowShell({ flows }: { flows: Flow[] }): ReactElement {
  const reduce = useReducedMotion() ?? false;
  const markerId = `flow${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [flowId, setFlowId] = useState(flows[0]?.id ?? "");
  const [stepIdx, setStepIdx] = useState<number | null>(null);

  const flow = flows.find((f) => f.id === flowId) ?? flows[0];
  if (!flow) return <div />;
  const step = stepIdx === null ? null : (flow.steps[stepIdx] ?? null);
  const lit = new Set(step ? step.highlight : []);
  const nodes = new Map(flow.nodes.map((n) => [n.id, n]));
  const maxCol = Math.max(0, ...flow.nodes.map((n) => n.col));
  const w = GRID_LEFT + (maxCol + 1) * COL_W + 8;
  const h = flow.lanes.length * LANE_H;

  const jumpTo = (id: string): void => {
    const i = flow.steps.findIndex((s) => s.highlight.includes(id));
    if (i >= 0) setStepIdx(i);
  };

  return (
    <div className="not-prose" style={{ width: "100%", fontFamily: FONT, color: TEXT }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        <Tabs
          label="流程"
          value={flow.id}
          options={flows.map((f) => ({ value: f.id, label: f.label }))}
          onChange={(id) => {
            setFlowId(id);
            setStepIdx(null);
          }}
        />
        <Tabs label="走查" value={stepIdx === null ? null : "tour"} options={[{ value: "tour", label: "逐步走查" }]} onChange={() => setStepIdx(0)} icon={<Play size={11} />} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", fontSize: 12, color: MUTED, marginBottom: 8 }}>
        <span>觸發：{flow.trigger}</span>
        <span>結果：{flow.result}</span>
      </div>

      <div style={{ border: `1px solid ${LINE_2}`, borderRadius: 8, overflowX: "auto", background: "#fff" }}>
        <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${flow.label}的業務流程泳道圖`} style={{ display: "block", width: "100%", minWidth: Math.round(w * 0.72) }}>
          <defs>
            {(["main", "exc"] as const).map((k) => (
              <marker key={k} id={`${markerId}-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M1 1L9 5L1 9" fill="none" stroke={k === "exc" ? WARNING : MUTED} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            ))}
          </defs>
          {flow.lanes.map((name, i) => (
            <g key={name}>
              <rect x={0} y={laneTop(i)} width={w} height={LANE_H} fill={i % 2 ? LANE_BG : "#fff"} />
              {i > 0 ? <line x1={0} y1={laneTop(i)} x2={w} y2={laneTop(i)} stroke={LINE} /> : null}
              <line x1={LANE_LABEL_W} y1={laneTop(i)} x2={LANE_LABEL_W} y2={laneBottom(i)} stroke={LINE} />
              <text x={LANE_LABEL_W / 2} y={laneY(i)} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600} fontFamily={FONT} fill={INK}>
                {laneLabelLines(name).map((line, k, all) => (
                  <tspan key={line} x={LANE_LABEL_W / 2} dy={k === 0 ? `${-(all.length - 1) * 0.6}em` : "1.2em"}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          ))}
          {flow.edges.map((e) => (
            <FlowEdgeLine key={e.id} e={e} nodes={nodes} markerId={markerId} active={lit.has(e.id)} dim={step !== null && !lit.has(e.id)} />
          ))}
          {flow.nodes.map((n) => (
            <FlowNodeShape key={n.id} n={n} active={lit.has(n.id)} dim={step !== null && !lit.has(n.id)} onClick={() => jumpTo(n.id)} />
          ))}
        </svg>
      </div>

      <div style={{ marginTop: 10, transition: reduce ? "none" : "opacity 200ms" }}>
        <StepCard
          step={step}
          index={stepIdx ?? 0}
          count={flow.steps.length}
          onPrev={() => setStepIdx((i) => (i === null ? null : Math.max(0, i - 1)))}
          onNext={() => setStepIdx((i) => (i === null ? 0 : Math.min(flow.steps.length - 1, i + 1)))}
          onClose={() => setStepIdx(null)}
        />
      </div>

      <div role="group" aria-label="圖例" style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 8, fontSize: 11.5, color: MUTED }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 9, background: PRIMARY_SOFT, border: `1px solid ${PRIMARY}`, borderRadius: 2 }} />
          角色操作
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 9, background: "#fff", border: `1px solid ${LINE_2}`, borderRadius: 2 }} />
          系統回應
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 9, height: 9, border: `1px solid ${MUTED}`, transform: "rotate(45deg)" }} />
          判斷
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, borderTop: `1.5px dashed ${WARNING}` }} />
          例外／替代流程
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 9, border: `2px solid ${LINE_2}`, borderRadius: 2 }} />
          結束
        </span>
      </div>
    </div>
  );
}

/* ================================================================ 【流程】依規格填寫（規格 01-05 登入狀態與安全） ================================================================ */

const FLOWS: Flow[] = [
  {
    id: "logout-this-device",
    label: "自己登出這一台",
    trigger: "使用者點「登出」",
    result: "只有這一台要重新登入；平台留下一筆可驗證的登出紀錄",
    lanes: ["平台成員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點登出"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["還驗", "得過？"] },
      { id: "n3", lane: 1, col: 2, kind: "system", label: ["讓這台", "失效"] },
      { id: "n4", lane: 1, col: 3, kind: "system", end: true, label: ["回登入頁", "記下登出"] },
      { id: "n5", lane: 1, col: 4, kind: "system", exception: true, end: true, label: ["只清本機", "不記登出"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "是" },
      { id: "a3", from: "n3", to: "n4" },
      { id: "e1", from: "n2", to: "n5", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
    ],
    steps: [
      {
        title: "點「登出」",
        body: "登出的入口在側欄，規則在共用介面那一頁；這一頁定的是登出之後登入狀態怎麼變。平台上沒有任何角色能登出別人的某一台裝置。",
        scenarios: ["沒有登出別人裝置的操作"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "替代：這一台的登入狀態已經不能驗證",
        body: "系統只清掉本機留著的登入資料並把人帶回登入頁，不聲稱已經讓伺服器端失效，也不把這次記成一次登出。這樣登出紀錄裡就只有真的驗證過的那些。流程結束。",
        scenarios: ["登入狀態已經不能驗證時登出"],
        ref: "A1",
        highlight: ["n2", "e1", "n5"],
      },
      {
        title: "驗證通過，讓這一台的登入狀態失效",
        body: "只有這一台；其他裝置維持登入。同一個人在兩台裝置上的兩段登入狀態互不相干。",
        scenarios: ["從這一台登出只影響這一台", "登出不影響其他裝置", "兩段登入狀態互不相干"],
        ref: "主流程 2、3",
        highlight: ["a2", "n3"],
      },
      {
        title: "回到登入頁，並記下這次登出",
        body: "同時清掉本機留著的登入資料。這一筆是可驗證的登出紀錄——自然到期與安全撤銷都不算一次登出，所以不會混進來。",
        scenarios: ["登入狀態自然到期不記成登出", "安全撤銷不記成登出"],
        ref: "主流程 3、4",
        highlight: ["a3", "n4"],
      },
      {
        title: "結果：只有這一台要重新登入",
        body: "那一筆登出紀錄之後會被標記作業的工時統計讀到——而工時只能用這種可驗證的登出當結束時間。流程結束。",
        scenarios: ["從這一台登出只影響這一台"],
        ref: "結果",
        highlight: ["n4"],
      },
    ],
  },
  {
    id: "security-revoke",
    label: "安全事件撤銷",
    trigger: "使用者改密碼、換 Email、重設密碼、連結 Google 帳號，或系統管理員停用帳號",
    result: "失去資格的登入狀態一律不能再通行；只有改密碼這一種保留操作者自己這一台",
    lanes: ["平台成員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["做一件高", "風險改動"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["每一步", "都成？"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["是改密", "碼嗎？"] },
      { id: "n4", lane: 1, col: 3, kind: "system", end: true, label: ["只踢別台", "這台留著"] },
      { id: "n5", lane: 1, col: 4, kind: "system", exception: true, end: true, label: ["全部失效", "回登入頁"] },
      { id: "n6", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["整件事回", "到原狀"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2", exit: "right", enter: "left" },
      { id: "a2", from: "n2", to: "n3", label: "是" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "e1", from: "n3", to: "n5", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e2", from: "n2", to: "n6", exception: true, label: "否", exit: "top", enter: "top", via: laneTop(1) - 8 },
    ],
    steps: [
      {
        title: "使用者做一件高風險的改動，或管理員停用這個帳號",
        body: "事件本身的規則在各自的頁面：改密碼與換 Email 在個人設定、重設密碼在一次性連結那一頁、停用帳號在使用者管理。這一頁只定它們對登入狀態的後果。",
        scenarios: ["改密碼保留目前這一台"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "例外：這個事件的任何一步失敗",
        body: "整件事回到原狀：密碼沒換、Email 沒換、登入狀態也沒有任何一台被踢掉。不會出現「密碼換了但裝置沒踢」或反過來的半成品狀態。流程結束。",
        scenarios: ["改動中途失敗就全部回到原狀"],
        ref: "E1",
        highlight: ["n2", "e2", "n6"],
      },
      {
        title: "事件成功，系統判斷這是哪一種",
        body: "只有改密碼這一種保留操作者自己這一台；其他五種都是全部失效。",
        scenarios: ["改密碼保留目前這一台"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "是改密碼：其他裝置全部失效，目前這一台維持登入",
        body: "其他裝置連延續都不給。使用者在這一台不必重新登入，繼續操作。",
        scenarios: ["改密碼保留目前這一台", "改密碼後其他裝置不能延續"],
        ref: "主流程 3、4",
        highlight: ["a3", "n4"],
      },
      {
        title: "替代：不是改密碼",
        body: "換 Email 驗證成功、重設密碼成功、系統管理員改了這個帳號的 Email、連結 Google 帳號成功，或帳號被停用——所有裝置的登入狀態全部失效，包含目前這一台，使用者回到登入頁。被重新啟用時，停用前的登入狀態不會恢復。連結 Google 之後也不能再用密碼登入，除非他重新設一組。被安全撤銷的登入狀態沒有寬限資格，而且畫面不說明原因。流程結束。",
        scenarios: ["換 Email 驗證成功後所有裝置重新登入", "密碼重設成功後所有裝置重新登入", "管理員改了 Email 後所有裝置重新登入", "連結 Google 後所有裝置重新登入", "連結 Google 後不能再用密碼登入", "停用帳號讓所有裝置立刻失效", "重新啟用不恢復舊的登入狀態", "安全撤銷的登入狀態沒有寬限資格", "不能通行的登入狀態不說明原因"],
        ref: "A1",
        highlight: ["n3", "e1", "n5"],
      },
      {
        title: "結果：失去資格的登入狀態一律不能再通行",
        body: "疑似被盜用的時候所有裝置也一起登出。這種結束都不算一次登出，所以不會被工時統計當成結束時間。流程結束。",
        scenarios: ["疑似被盜用時所有裝置一起登出", "安全撤銷不記成登出"],
        ref: "結果",
        highlight: ["n4", "n5"],
      },
    ],
  },
  {
    id: "natural-expiry",
    label: "時間到了自然結束",
    trigger: "使用者做任何一次操作（系統每次都檢查兩條時間限制）",
    result: "沒有任何一段登入狀態能無限期延續；這種結束不算一次登出",
    lanes: ["平台成員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["做下一次", "操作"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["時間到", "了嗎？"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["帳號還", "啟用？"] },
      { id: "n4", lane: 1, col: 3, kind: "system", end: true, label: ["通行並延", "後閒置線"] },
      { id: "n5", lane: 1, col: 4, kind: "system", exception: true, end: true, label: ["拒絕並回", "登入頁"] },
      { id: "n6", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["依當下狀", "態判定"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "否" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "e1", from: "n2", to: "n5", exception: true, label: "是", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e2", from: "n3", to: "n6", exception: true, label: "否", exit: "top", enter: "top", via: laneTop(1) - 8 },
    ],
    steps: [
      {
        title: "使用者做下一次操作，系統每次都檢查兩條時間限制",
        body: "一條是從登入那一刻起算的絕對上限 90 天，用得再頻繁也不會延後；另一條是連續沒有使用就結束的 7 天，每次使用就重新起算。延續失敗不計次，直接要求重新登入。",
        scenarios: ["延續登入狀態失敗不計次"],
        ref: "主流程 1、2",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "例外：其中任一條到了",
        body: "拒絕這次操作，把使用者帶回登入頁。他重新登入之後取得的是一段新的登入狀態。這種結束不算一次登出，所以不會被工時統計當成結束時間；畫面也不說明原因。流程結束。",
        scenarios: ["達到絕對上限就要重新登入", "閒置超過限制就要重新登入", "登入狀態自然到期不記成登出", "不能通行的登入狀態不說明原因"],
        ref: "主流程 3、4",
        highlight: ["n2", "e1", "n5"],
      },
      {
        title: "替代：兩條都還沒到，系統再看帳號與角色的當下狀態",
        body: "能做什麼一律以送出這次操作時的系統角色與帳號狀態判定，不以登入時的為準。",
        scenarios: ["角色變更從下一次操作起生效"],
        ref: "A1",
        highlight: ["a2", "n3"],
      },
      {
        title: "替代：帳號還啟用、角色也沒變，正常通行並延後閒置那條線",
        body: "延後只動閒置那一條，絕對上限不動——所以延續出來的有效期間不會越過絕對上限。兩個分頁同時延續不會互相踢掉：慢的那個會自動重試一次，再失敗才帶回登入頁；同一次延續用到第三次就不給。",
        scenarios: ["持續使用會延長閒置那條線", "延長不會越過絕對上限", "兩個分頁同時延續不會互相踢掉", "慢的那個分頁自動重試一次", "重試仍失敗就帶回登入頁", "同一次延續用第三次就不給"],
        ref: "A1",
        highlight: ["a3", "n4"],
      },
      {
        title: "替代：帳號已被停用或系統角色已變更",
        body: "依當下的狀態判定：停用就拒絕並帶回登入頁；角色變更就用新角色的權限繼續。被重新啟用時，停用前的登入狀態不會恢復。流程結束。",
        scenarios: ["停用帳號讓所有裝置立刻失效", "重新啟用不恢復舊的登入狀態", "角色變更從下一次操作起生效"],
        ref: "A2",
        highlight: ["n3", "e2", "n6"],
      },
      {
        title: "結果：沒有任何一段登入狀態能無限期延續",
        body: "⚠️ 兩個數字的依據原本不足：90 天與 7 天都只出現在 foundation 的架構常數，不在這一頁來源的條文裡；維護者 2026-11-09 確認沿用。流程結束。",
        scenarios: ["達到絕對上限就要重新登入", "閒置超過限制就要重新登入"],
        ref: "結果",
        highlight: ["n4"],
      },
    ],
  },
];

export default function Spec0105LoginStateFlow(): ReactElement {
  return <FlowShell flows={FLOWS} />;
}
