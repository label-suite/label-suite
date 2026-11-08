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

/* ================================================================ 【流程】依規格填寫（規格 03-02 新增任務） ================================================================ */

const FLOWS: Flow[] = [
  {
    id: "step-one",
    label: "填完基本資料",
    trigger: "使用者在任務列表點「新增任務」",
    result: "使用者進到第二步，第一步填的內容都留著",
    lanes: ["平台成員或系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["進入第一步", "基本資料"] },
      { id: "n2", lane: 0, col: 1, kind: "action", label: ["填名稱與", "資料集"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["六件事", "都成立？"] },
      { id: "n4", lane: 1, col: 3, kind: "system", end: true, label: ["進入第二步", "標記設定檔"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "e1", from: "n3", to: "n2", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
    ],
    steps: [
      {
        title: "進入第一步「基本資料」",
        body: "四個步驟依序顯示，第一步沒有「上一步」。沒有權限的人進不來這一頁。",
        scenarios: ["四個步驟依序顯示", "第一步看不到上一步", "沒有權限的人進不來"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "填任務名稱、上傳資料集、指定欄位用途、選要產出什麼",
        body: "四件事在同一步裡填。資料集只收特定格式，而且一行一筆的寫法也讀得出來；欄名看起來像輸入的欄位會自動指定為輸入，但背景與輸出不自動猜。",
        scenarios: ["只收 JSON 的資料集", "一行一筆的寫法也讀得出來", "欄名像輸入的欄位自動指定為輸入", "不自動猜測背景與輸出"],
        ref: "主流程 2",
        highlight: ["a1", "n2"],
      },
      {
        title: "系統確認六件事都成立",
        body: "六個條件全部成立才過得去，少一個就不行。",
        scenarios: [],
        ref: "主流程 3",
        highlight: ["a2", "n3"],
      },
      {
        title: "替代：六件事沒有全部成立",
        body: "下一步點不下去，欄位下方與頁首各顯示一次說明，指出是哪個欄位與怎麼改，使用者留在第一步繼續填。",
        scenarios: ["填完第一步才能進第二步", "任務名稱空白時不能前進", "沒選輸出類型時不能前進", "沒有資料集時不能前進", "沒選輸入類型時不能前進", "資料集只有一筆時在第一步擋下", "移除所有檔案後回到不能前進"],
        ref: "A1",
        highlight: ["n3", "e1", "n2"],
      },
      {
        title: "結果：進到第二步「標記設定檔」",
        body: "第一步填的內容都留著，之後回上一步也還在。流程接到下一段。",
        scenarios: ["填完第一步才能進第二步"],
        ref: "結果",
        highlight: ["a3", "n4"],
      },
    ],
  },
  {
    id: "step-two-three",
    label: "設定標記方式與啟動設定",
    trigger: "使用者已經在第二步「標記設定檔」",
    result: "使用者進到第四步，前三步的設定都留著",
    lanes: ["平台成員或系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["設定每種", "輸出類型"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["必填", "都過？"] },
      { id: "n3", lane: 0, col: 2, kind: "action", label: ["設定試標", "抽幾筆"] },
      { id: "n4", lane: 1, col: 3, kind: "decision", label: ["筆數", "過關？"] },
      { id: "n5", lane: 1, col: 4, kind: "system", end: true, label: ["進入第四步", "標記說明"] },
      { id: "n6", lane: 0, col: 4, kind: "action", exception: true, end: true, label: ["回第一步", "內容都在"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "是", enter: "left" },
      { id: "e1", from: "n2", to: "n1", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "a3", from: "n3", to: "n4" },
      { id: "a4", from: "n4", to: "n5", label: "是" },
      { id: "e2", from: "n4", to: "n3", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 3 },
      { id: "a5", from: "n1", to: "n6", exception: true, exit: "top", enter: "top", via: laneTop(0) + 16 },
    ],
    steps: [
      {
        title: "設定每一種輸出類型要怎麼標，並在預覽上試標一次",
        body: "已選的每一種輸出類型各一個面板，改設定欄位時設定內容跟著變。",
        scenarios: ["每一種輸出類型各一個面板", "改設定欄位設定內容跟著變"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "系統確認必填都填了、設定沒有錯、也沒有未儲存的改動",
        body: "三個條件，少一個都不能前進。未儲存的改動也算沒過——設定檔要自己按儲存。",
        scenarios: [],
        ref: "主流程 2",
        highlight: ["a1", "n2"],
      },
      {
        title: "替代：第二步的條件沒有通過",
        body: "下一步點不下去，使用者留在第二步。",
        scenarios: ["必填設定沒過時不能前進", "有未儲存改動時擋下前進", "上傳設定檔要自己按儲存"],
        ref: "A1（第 2 步）",
        highlight: ["n2", "e1", "n1"],
      },
      {
        title: "替代：使用者點「上一步」",
        body: "回到前一步，已填的內容都還在。這一段流程結束，使用者回到前一段。",
        scenarios: ["回上一步內容還在"],
        ref: "A2",
        highlight: ["a5", "n6"],
      },
      {
        title: "設定試標要抽幾筆、要不要把試標與正式標記的資料隔開",
        body: "抽樣筆數會自動預填，資料隔離預設是開啟的。",
        scenarios: ["抽樣筆數自動預填", "資料隔離預設開啟", "多個大分類取最高比例"],
        ref: "主流程 3",
        highlight: ["a2", "n3", "a3", "n4"],
      },
      {
        title: "替代：筆數沒有通過檢查",
        body: "下一步點不下去，使用者留在第三步改筆數。",
        scenarios: ["抽樣筆數為零時擋下", "抽樣筆數不小於總筆數時擋下"],
        ref: "A1（第 4 步）",
        highlight: ["n4", "e2", "n3"],
      },
      {
        title: "結果：進到第四步「標記說明」",
        body: "這一步是選填的，而且它的「下一步」變成「建立任務」。前三步的設定都留著。",
        scenarios: ["第四步的下一步變成建立任務", "第三步提示成員在建立後邀請"],
        ref: "結果",
        highlight: ["a4", "n5"],
      },
    ],
  },
  {
    id: "create",
    label: "建立任務",
    trigger: "使用者已經在第四步「標記說明」",
    result: "任務建立起來，建立者是它的專案負責人，狀態是草稿",
    lanes: ["平台成員或系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["填標記說明", "或留空"] },
      { id: "n6", lane: 1, col: 0, kind: "system", exception: true, end: true, label: ["回第三步", "內容都在"] },
      { id: "n2", lane: 0, col: 1, kind: "action", label: ["點「建立", "任務」"] },
      { id: "n3", lane: 1, col: 2, kind: "system", label: ["建立任務", "設負責人"] },
      { id: "n4", lane: 1, col: 3, kind: "system", label: ["記下試標", "抽樣設定"] },
      { id: "n5", lane: 1, col: 4, kind: "system", end: true, label: ["前往任務", "詳情"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "e1", from: "n1", to: "n6", exception: true },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", enter: "left" },
      { id: "a3", from: "n3", to: "n4" },
      { id: "a4", from: "n4", to: "n5" },
    ],
    steps: [
      {
        title: "填標記說明，或什麼都不填",
        body: "這一整步可以空著。只填標記員說明、只填審核員說明，或只上傳檔案不填說明，都可以。",
        scenarios: ["第四步整步可以空著", "只填標記員說明也可以", "只填審核員說明也可以", "只上傳檔案不填說明也可以"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "替代：什麼都不填一樣建立得出來",
        body: "第四步留空不會擋下建立，也不影響後面任何一步。流程照常走到建立那一步。",
        scenarios: ["第四步整步可以空著"],
        ref: "A1",
        highlight: ["n1"],
      },
      {
        title: "替代：使用者點「上一步」",
        body: "回到第三步，已填的內容都還在。這一段流程結束，使用者回到前一段。",
        scenarios: ["回上一步內容還在"],
        ref: "A2",
        highlight: ["e1", "n6"],
      },
      {
        title: "點「建立任務」，系統建立任務並記下試標設定",
        body: "建立中不能重複點。建立者成為這個任務的專案負責人，標記說明存進任務，試標的抽樣設定記下來，之後在任務詳情看到的是同一份。中途失敗的話全部回到原狀，不會留下半個任務。",
        scenarios: ["建立成功後成為專案負責人", "標記說明存進任務", "抽樣設定在任務詳情看到同一份", "建立中不能重複點", "建立中途失敗就全部回到原狀"],
        ref: "主流程 2",
        highlight: ["a1", "n2", "a2", "n3", "a3", "n4"],
      },
      {
        title: "結果：前往該任務的任務詳情",
        body: "建立出來的任務是草稿，暫存的內容清掉。流程結束。",
        scenarios: ["建立成功後前往任務詳情", "建立出來的任務是草稿", "建立成功後暫存清掉"],
        ref: "結果",
        highlight: ["a4", "n5"],
      },
    ],
  },
  {
    id: "leave",
    label: "中途離開或重新整理",
    trigger: "使用者在任何一步點「取消」、要離開這一頁，或按 F5",
    result: "使用者不會在沒被問過的情況下弄丟已填的內容",
    lanes: ["平台成員或系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["要離開或", "重新整理"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["按的是", "F5？"] },
      { id: "n4", lane: 1, col: 2, kind: "decision", label: ["改過", "東西？"] },
      { id: "n5", lane: 1, col: 3, kind: "system", label: ["問「離開", "此頁面？」"] },
      { id: "n6", lane: 0, col: 4, kind: "decision", label: ["確認", "離開？"] },
      { id: "n7", lane: 1, col: 5, kind: "system", end: true, label: ["回任務列表", "不建立任務"] },
      { id: "n3", lane: 1, col: 6, kind: "system", exception: true, end: true, label: ["還原原步驟", "回填資料"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "e1", from: "n2", to: "n3", exception: true, label: "是", exit: "bottom", enter: "bottom", via: laneBottom(1) - 3 },
      { id: "a2", from: "n2", to: "n4", label: "否" },
      { id: "a3", from: "n4", to: "n5", label: "是" },
      { id: "e2", from: "n4", to: "n7", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "a4", from: "n5", to: "n6", enter: "left" },
      { id: "a5", from: "n6", to: "n7", label: "是" },
      { id: "e3", from: "n6", to: "n1", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(0) - 8 },
    ],
    steps: [
      {
        title: "使用者要離開這一頁，或要重新整理",
        body: "點「取消」、點側欄跳走、關分頁，或按 F5 都算。",
        scenarios: ["取消會先確認", "從側欄跳走也會先確認"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "系統先分辨這是重新整理還是離開",
        body: "這兩件事的處理刻意不一樣：重新整理是「我還在填」，離開是「我不填了」。",
        scenarios: [],
        ref: "主流程 2",
        highlight: ["a1", "n2"],
      },
      {
        title: "例外：使用者按 F5",
        body: "瀏覽器先問一次，確認之後系統把他還原到原本那一步，並回填所有已填的資料。注意這和從別的地方進來不同——那種情況一律從空白的第一步開始，不還原。流程結束。",
        scenarios: ["重新整理後還原到原本那一步", "從別的地方進來就從空白開始"],
        ref: "E1",
        highlight: ["n2", "e1", "n3"],
      },
      {
        title: "系統確認使用者有沒有改過東西",
        body: "改過才需要問；沒改過就沒有東西會弄丟。",
        scenarios: [],
        ref: "主流程 3",
        highlight: ["a2", "n4"],
      },
      {
        title: "替代：完全沒有改過任何東西",
        body: "不跳確認視窗，直接回到任務列表。",
        scenarios: ["什麼都沒改就取消不確認"],
        ref: "A2",
        highlight: ["n4", "e2", "n7"],
      },
      {
        title: "改過東西，顯示「離開此頁面？」",
        body: "確認視窗說明離開會遺失所有已填寫的內容，兩個選擇是「繼續編輯」與「離開」。",
        scenarios: ["取消會先確認"],
        ref: "主流程 4",
        highlight: ["a3", "n5"],
      },
      {
        title: "使用者在確認視窗做選擇",
        body: "兩個出口都要有下文。",
        scenarios: [],
        ref: "主流程 5",
        highlight: ["a4", "n6"],
      },
      {
        title: "替代：使用者選「繼續編輯」",
        body: "留在原處，什麼都不變，回到第 1 步。",
        scenarios: ["選繼續編輯就留在原處"],
        ref: "A1",
        highlight: ["n6", "e3", "n1"],
      },
      {
        title: "結果：回到任務列表，任務沒有被建立",
        body: "離開之後任務不存在，使用者填的內容也不會留下來。流程結束。",
        scenarios: ["選離開就不建立任務"],
        ref: "結果",
        highlight: ["a5", "n7"],
      },
    ],
  },
];

export default function Spec0302TaskNewFlow(): ReactElement {
  return <FlowShell flows={FLOWS} />;
}
