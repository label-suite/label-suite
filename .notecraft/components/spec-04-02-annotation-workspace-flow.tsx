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

/* ================================================================ 【流程】依規格填寫（規格 04-02 標記工作區） ================================================================ */

const FLOWS: Flow[] = [
  {
    id: "enter-workspace",
    label: "進入工作區",
    trigger: "使用者從儀表板的快速入口、標記清單的某一列，或直接貼一個深連結進來",
    result: "三欄就位；網址壞掉時使用者被導回清單，絕不會看到一個用預設控制項頂替的工作區",
    lanes: ["標記員或審核員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點快速入口", "或深連結"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["解析網址", "的上下文"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["有帶", "那筆？"] },
      { id: "n4", lane: 1, col: 3, kind: "decision", label: ["那筆查", "得到？"] },
      { id: "n5", lane: 1, col: 4, kind: "decision", label: ["設定查", "得到？"] },
      { id: "n6", lane: 1, col: 5, kind: "system", end: true, label: ["三欄就位"] },
      { id: "n7", lane: 1, col: 6, kind: "system", exception: true, end: true, label: ["導回", "標記清單"] },
      { id: "n8", lane: 0, col: 4, kind: "system", exception: true, label: ["回退第一筆", "改寫網址"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "a4", from: "n4", to: "n5", label: "是" },
      { id: "a5", from: "n5", to: "n6", label: "是" },
      { id: "e1", from: "n3", to: "n7", exception: true, label: "否", exit: "top", enter: "top", via: laneTop(1) - 8 },
      { id: "e2", from: "n5", to: "n7", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e3", from: "n4", to: "n8", exception: true, label: "否", exit: "top", enter: "left" },
      { id: "e4", from: "n8", to: "n5", exception: true },
    ],
    steps: [
      {
        title: "從三個入口之一進來",
        body: "儀表板的快速入口、標記清單的某一列，或直接貼一個深連結——三條路進到的是同一個工作區，而且網址帶的那一筆就是作用中的那一筆。",
        scenarios: ["網址帶的那一筆就是作用中的那一筆"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "系統解析網址帶來的任務、那一筆、角色與標記階段",
        body: "標記階段缺值時回退成試標。重新整理之後停在同一筆，不會跳回第一筆。",
        scenarios: ["標記階段缺值回退成試標", "重新整理停在同一筆"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "例外：網址沒帶那一筆",
        body: "導回標記清單。工作區沒有一筆可以作用的樣本時不給進，也不以任何預設值挑一筆頂替。流程結束。",
        scenarios: ["沒帶那一筆就不給進"],
        ref: "E2",
        highlight: ["n3", "e1", "n7"],
      },
      {
        title: "例外：網址帶的那一筆查不到",
        body: "回退到第一筆，並把網址改寫成實際顯示的那一筆，讓網址和畫面一致；改寫時其餘參數不被丟掉。接回主流程的設定檢查。",
        scenarios: ["查不到那一筆時網址正規化", "其餘參數不被丟掉"],
        ref: "E3",
        highlight: ["n4", "e3", "n8", "e4", "n5"],
      },
      {
        title: "查任務發布時凍結的設定，載入樣本、說明與進度",
        body: "三欄就位：左欄是這個任務的清單，中欄是題目與作答，右欄是說明與檔案。樣本怎麼切分讀的是發布時凍結的那一份，不在這一頁重算。",
        scenarios: ["桌機三欄就位", "樣本切分不重算"],
        ref: "主流程 3、4",
        highlight: ["a3", "n4", "a4", "n5", "a5", "n6"],
      },
      {
        title: "例外：查不到已發布的任務設定",
        body: "導回標記清單，不得以任何預設的輸出類型或空白控制項呈現工作區——一個長得像能用、其實沒有設定的工作區會讓人把答案填進一個不存在的題型。流程結束。",
        scenarios: ["任務設定查不到就不給進"],
        ref: "E1",
        highlight: ["n5", "e2", "n7"],
      },
      {
        title: "結果：進得來就一定有設定",
        body: "這一段的三道檢查是整頁的前提：後面所有控制項都建立在「這是哪個任務、哪一筆、什麼設定」已經確定之上。流程結束。",
        scenarios: ["桌機三欄就位", "任務設定查不到就不給進"],
        ref: "結果",
        highlight: ["n6"],
      },
    ],
  },
  {
    id: "read-guide-and-work",
    label: "讀說明並開始作業",
    trigger: "三欄就位，使用者要開始作業",
    result: "使用者在確認過說明之後才動手；翻筆時網址一直等於畫面上的那一筆，所以任何一筆都能直接分享",
    lanes: ["標記員或審核員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 1, col: 1, kind: "decision", label: ["要先讀", "說明？"] },
      { id: "n2", lane: 1, col: 2, kind: "system", label: ["顯示說明", "彈窗"] },
      { id: "n3", lane: 0, col: 2, kind: "action", label: ["按確認", "才開始"] },
      { id: "n4", lane: 0, col: 3, kind: "action", label: ["在中欄作業", "翻上下筆"] },
      { id: "n5", lane: 1, col: 4, kind: "system", end: true, label: ["網址改寫", "成那一筆"] },
      { id: "n6", lane: 1, col: 3, kind: "system", exception: true, label: ["右欄說明", "常駐"] },
      { id: "n7", lane: 1, col: 5, kind: "system", exception: true, label: ["說明改走", "底部抽屜"] },
      { id: "n8", lane: 1, col: 0, kind: "system", exception: true, end: true, label: ["回到", "標記清單"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2", label: "是" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4" },
      { id: "a4", from: "n4", to: "n5" },
      { id: "e1", from: "n1", to: "n6", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e2", from: "n6", to: "n4", exception: true },
      { id: "e3", from: "n4", to: "n7", exception: true, exit: "top", enter: "top", via: laneTop(0) + 12 },
      { id: "e4", from: "n7", to: "n5", exception: true, exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e5", from: "n2", to: "n8", exception: true, exit: "bottom", enter: "bottom", via: laneBottom(1) - 3 },
    ],
    steps: [
      {
        title: "這個任務要求先讀說明，而且這個指引版本還沒被確認過",
        body: "顯示說明彈窗。要不要先讀說明是逐任務各自判定的，不是全平台一個開關；開了的任務在使用者第一次進來時彈一次。",
        scenarios: ["開了就彈一次", "逐任務各自判定"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "使用者按確認才開始",
        body: "彈窗打開時焦點在確認，按 Esc 不會關掉它。確認是綁帳號的，所以同一台共用電腦的第二個人照樣要自己讀一次；確認過之後不再彈。指引換了版本要重新確認，而舊版本的確認紀錄不會因此失效。彈窗的內容與右欄的說明同一個來源。",
        scenarios: ["確認過不再彈", "指引確認綁帳號", "共用電腦的第二個人照樣要讀", "換指引版本要重新確認", "舊版本的確認不失效", "彈窗與右欄同源", "閘門按 Esc 不關閉", "閘門的初始焦點在確認"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "替代：在說明彈窗按「返回標記清單」",
        body: "彈窗只有兩個出口：確認，或返回標記清單。按 Esc、點視窗外面都不會關。按返回就回到這個任務的標記清單，不記下確認，下次進來照樣顯示彈窗。流程結束。",
        scenarios: ["從閘門返回標記清單"],
        ref: "A3",
        highlight: ["n2", "e5", "n8"],
      },
      {
        title: "替代：這個任務沒要求先讀說明",
        body: "跳過彈窗直接開始，右欄的說明仍然常駐——不彈窗不等於沒有說明。接回主流程的作業那一步。",
        scenarios: ["沒開先讀說明就不彈"],
        ref: "A1",
        highlight: ["n1", "e1", "n6", "e2", "n4"],
      },
      {
        title: "在中欄作業，必要時翻到上一筆或下一筆",
        body: "首筆與末筆的方向按鈕停用，按了沒有反應。四個快捷鍵真的有效，但在輸入框裡照常生效、不被攔走。翻筆之後說明還在，而且不自行改變收合狀態——使用者手動收起來的，翻筆之後維持收起。",
        scenarios: ["首末筆按鈕停用", "四個快捷鍵真的有效", "翻筆後說明還在", "翻筆不自行改變收合狀態", "手動收起後翻筆維持收起"],
        ref: "主流程 3",
        highlight: ["a3", "n4"],
      },
      {
        title: "替代：使用者在手機上",
        body: "說明改由底部抽屜承載，翻筆時抽屜維持原本的開合狀態。抽屜裡不含操作紀錄。接回主流程的網址改寫。",
        scenarios: ["手機抽屜維持開合", "手機抽屜不含操作紀錄"],
        ref: "A2",
        highlight: ["n4", "e3", "n7", "e4", "n5"],
      },
      {
        title: "每次翻筆都把網址改寫成畫面上的那一筆",
        body: "翻筆同步網址，但不新增身分參數、也不堆瀏覽器歷程——按上一頁不會變成一筆一筆退回去。麵包屑第 3 層跟著換筆重畫。",
        scenarios: ["翻筆同步網址", "翻筆不新增身分參數", "翻筆不堆瀏覽器歷程", "麵包屑跟著換筆重畫"],
        ref: "主流程 4",
        highlight: ["a4", "n5"],
      },
      {
        title: "結果：網址一直等於畫面上的那一筆",
        body: "所以重新整理停在同一筆，貼給別人的網址也打開同一筆。流程結束。",
        scenarios: ["重新整理停在同一筆", "翻筆同步網址"],
        ref: "結果",
        highlight: ["n5"],
      },
    ],
  },
  {
    id: "review-overview",
    label: "審核總覽",
    trigger: "標記員提交一筆標記",
    result: "每個審核單位最後都是已定稿，兩個標記階段都不退回重標",
    lanes: ["標記員", "系統", "審核員", "仲裁者或專案負責人"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["提交標記"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["成立單位", "指派審核員"] },
      { id: "n3", lane: 2, col: 2, kind: "action", label: ["逐項決策", "送出審核"] },
      { id: "n4", lane: 1, col: 3, kind: "decision", label: ["全部", "通過？"] },
      { id: "n5", lane: 1, col: 6, kind: "system", end: true, label: ["已定稿"] },
      { id: "n6", lane: 1, col: 4, kind: "system", exception: true, label: ["進入", "爭議池"] },
      { id: "n7", lane: 3, col: 5, kind: "decision", exception: true, label: ["選得出", "一邊？"] },
      { id: "n8", lane: 3, col: 6, kind: "action", exception: true, label: ["例外池", "逐筆收尾"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4" },
      { id: "a4", from: "n4", to: "n5", label: "是", exit: "top", enter: "top", via: laneTop(1) - 24 },
      { id: "e1", from: "n4", to: "n6", exception: true, label: "否" },
      { id: "e2", from: "n6", to: "n7", exception: true, exit: "bottom", enter: "left" },
      { id: "e3", from: "n7", to: "n5", exception: true, label: "是", exit: "top", enter: "left" },
      { id: "e4", from: "n7", to: "n8", exception: true, label: "否" },
      { id: "e5", from: "n8", to: "n5", exception: true },
    ],
    steps: [
      {
        title: "提交標記，成立審核單位",
        body: "標記員提交一筆標記，系統成立單位、指派審核員：這位標記員在這一筆就是一個審核單位，指派恰好一位審核員；單位的狀態是待審。標記員還沒提交時不成立審核單位。",
        scenarios: [],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "審核員逐項決策並送出",
        body: "審核員對每個輸出類型選通過、修正或無法裁決，然後按送出。送出之前的決策只是草稿，不影響單位狀態；也沒有「退回重標」這個選項。",
        scenarios: ["三向決策的字面", "沒有退回", "決策草稿能還原"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "全部通過就定稿",
        body: "每一項都是通過、而且沒有改過答案，單位直接已定稿；畫面停在這一個單位，就地變成唯讀的定稿卡。",
        scenarios: ["一致的單位沒有爭議項", "定稿的送出停在原地"],
        ref: "主流程 3",
        highlight: ["a3", "n4", "a4", "n5"],
      },
      {
        title: "替代：有爭議項就進入爭議池",
        body: "任一項是修正或無法裁決，或選了通過但答案和標記員的不同，那些項成為爭議項，單位變成爭議中；修正不會立即生效。審核員的畫面前進到下一個可處理的單位。",
        scenarios: ["後果提示：選了修正", "後果提示：改了答案再按通過", "未定稿的送出會前進"],
        ref: "A1",
        highlight: ["n4", "e1", "n6"],
      },
      {
        title: "替代：仲裁者二選一",
        body: "不是這個單位當事人、而且在仲裁者名冊上的人逐項在標記員的原答案（A）與審核員的答案（B）之間二選一，不寫第三份答案，全部裁定後一次送出；任務沒有啟用中的仲裁者時，由專案負責人裁定。選得出一邊（全部採 A 或採 B），單位已定稿。",
        scenarios: ["仲裁版面沒有修正控件", "B 依來源動態呈現", "未全數裁定不得送出"],
        ref: "A1",
        highlight: ["e2", "n7", "e3", "n5"],
      },
      {
        title: "例外：兩者皆非落入最終例外池",
        body: "仲裁判定 A 與 B 都不可採時選兩者皆非，那一項落入最終例外池，單位維持爭議中。例外池是最後一道出口，不再往下轉送。",
        scenarios: ["兩者皆非落入例外池", "例外池是最後一道"],
        ref: "E1",
        highlight: ["n7", "e4", "n8"],
      },
      {
        title: "例外：專案負責人逐筆收尾",
        body: "專案負責人對每一項選採用標記員答案、採用審核員答案、自訂答案（只限正式標記）或排除於資料集；所有例外項都收尾後，單位已定稿。",
        scenarios: ["自訂答案只在正式標記", "全數收尾後定稿"],
        ref: "E1",
        highlight: ["e5", "n5"],
      },
      {
        title: "結果：已定稿是終態",
        body: "每個審核單位最後都是已定稿，畫面全面唯讀，沒有任何解鎖入口；兩個標記階段都不退回重標。",
        scenarios: ["已定稿改渲染唯讀卡", "沒有解鎖入口"],
        ref: "結果",
        highlight: ["n5"],
      },
    ],
  },
  {
    id: "review-dry-run",
    label: "試標審核",
    trigger: "標記員提交一筆試標標記",
    result: "本回合收尾後任務轉為等待 IAA 確認，標記員看得到試標歷史回饋",
    lanes: ["標記員", "系統", "審核員", "仲裁者或專案負責人"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["提交", "試標標記"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["整筆指派", "一位審核員"] },
      { id: "n3", lane: 2, col: 2, kind: "action", label: ["審核同筆", "N 個單位"] },
      { id: "n4", lane: 1, col: 3, kind: "decision", label: ["全部", "通過？"] },
      { id: "n5", lane: 3, col: 3, kind: "action", exception: true, label: ["仲裁或", "例外收尾"] },
      { id: "n6", lane: 1, col: 4, kind: "system", label: ["定稿", "不產最終答案"] },
      { id: "n7", lane: 1, col: 5, kind: "decision", label: ["完成條件", "都滿足？"] },
      { id: "n8", lane: 1, col: 6, kind: "system", end: true, label: ["轉為等待", "IAA 確認"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4", enter: "left" },
      { id: "a4", from: "n4", to: "n6", label: "是" },
      { id: "e1", from: "n4", to: "n5", exception: true, label: "否" },
      { id: "e2", from: "n5", to: "n6", exception: true },
      { id: "a5", from: "n6", to: "n7" },
      { id: "a6", from: "n7", to: "n8", label: "是" },
      { id: "e3", from: "n7", to: "n3", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(2) - 8 },
    ],
    steps: [
      {
        title: "提交試標，整筆指派給一位審核員",
        body: "同一筆資料由 N 位標記員各標一次，就是 N 個各自獨立的審核單位；系統把這一筆的全部單位指派給同一位審核員，讓他得以比對。",
        scenarios: [],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "審核同一筆的 N 個單位",
        body: "審核員一次審一位標記員的單位；左欄依資料分組，同一筆的下一位標記員排在下一筆資料之前。",
        scenarios: ["左欄依資料分組", "表頭帶人數"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "全部通過就定稿，但不產生最終答案",
        body: "每一項都通過，單位已定稿；試標的定稿不產生最終答案，只計入一致性與被修改率。",
        scenarios: ["後果提示：試標加註"],
        ref: "主流程 3",
        highlight: ["a3", "n4", "a4", "n6"],
      },
      {
        title: "替代：有爭議項就走仲裁與例外池",
        body: "有爭議項時走仲裁或例外收尾：照「審核總覽」那一段由仲裁者裁定，兩者皆非的項目由專案負責人在最終例外池收尾。試標的例外池沒有自訂答案，只能採用標記員答案、採用審核員答案或排除於資料集。收尾後單位已定稿。",
        scenarios: ["自訂答案只在正式標記"],
        ref: "A1",
        highlight: ["n4", "e1", "n5", "e2", "n6"],
      },
      {
        title: "本回合的完成條件",
        body: "沒有未指派的試標作業、每位啟用中的標記員都完成、本回合全部單位已定稿、沒有爭議中、最終例外池已清空，五條同時成立時，系統自動把任務轉為等待 IAA 確認。這五條和 IAA 達標與否無關。",
        scenarios: [],
        ref: "主流程 4",
        highlight: ["a5", "n7", "a6", "n8"],
      },
      {
        title: "替代：還有條件沒滿足",
        body: "任務維持試標中，逐項列出還沒滿足的條件與剩餘數，待審核與待仲裁分開列；其他單位照常審核。",
        scenarios: [],
        ref: "A2",
        highlight: ["n7", "e3", "n3"],
      },
      {
        title: "結果：轉為等待 IAA 確認，開放試標歷史回饋",
        body: "那一回合轉入等待 IAA 確認之後，標記員才看得到自己哪幾項被改、由誰定案；回合還在進行中一律不揭露。專案負責人在這個狀態決定開始正式標記、新增下一個試標回合或退回草稿。",
        scenarios: [],
        ref: "結果",
        highlight: ["n8"],
      },
    ],
  },
  {
    id: "review-official-run",
    label: "正式標記審核",
    trigger: "標記員提交一筆正式標記",
    result: "結案條件全部滿足後任務已完成，匯出開放",
    lanes: ["標記員", "系統", "審核員", "仲裁者或專案負責人"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["提交", "正式標記"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["一筆一單位", "平均指派"] },
      { id: "n3", lane: 2, col: 2, kind: "action", label: ["逐項決策", "送出審核"] },
      { id: "n4", lane: 1, col: 3, kind: "decision", label: ["全部", "通過？"] },
      { id: "n5", lane: 3, col: 3, kind: "action", exception: true, label: ["仲裁或", "例外收尾"] },
      { id: "n6", lane: 1, col: 4, kind: "system", label: ["定稿", "成為最終答案"] },
      { id: "n7", lane: 1, col: 5, kind: "decision", label: ["結案條件", "都滿足？"] },
      { id: "n8", lane: 3, col: 6, kind: "action", end: true, label: ["標記完成", "任務已完成"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4", enter: "left" },
      { id: "a4", from: "n4", to: "n6", label: "是" },
      { id: "e1", from: "n4", to: "n5", exception: true, label: "否" },
      { id: "e2", from: "n5", to: "n6", exception: true },
      { id: "a5", from: "n6", to: "n7" },
      { id: "a6", from: "n7", to: "n8", label: "是" },
      { id: "e3", from: "n7", to: "n3", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(2) - 8 },
    ],
    steps: [
      {
        title: "提交正式標記，平均指派",
        body: "正式標記一筆只指派給一位標記員，所以一筆恰有一個審核單位；系統以審核單位為單位，在被勾選、而且不是仲裁者的審核員之間平均指派。",
        scenarios: [],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "審核員逐項決策並送出",
        body: "決策的三個選項與試標完全相同：通過、修正、無法裁決；審核卡也是同一套版面。",
        scenarios: ["審核卡兩階段同版面", "三向決策的字面"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "全部通過就定稿，成為最終答案",
        body: "每一項都通過，單位已定稿，那個值就成為最終答案；標記員重新開啟那一筆時看到已定稿的提示，不能再改。",
        scenarios: ["後果提示：全部通過", "已定稿會鎖住"],
        ref: "主流程 3",
        highlight: ["a3", "n4", "a4", "n6"],
      },
      {
        title: "替代：有爭議項就走仲裁與例外池",
        body: "有爭議項時走仲裁或例外收尾：照「審核總覽」那一段由仲裁者裁定，兩者皆非的項目由專案負責人在最終例外池收尾；正式標記的例外池多一個自訂答案，定案值不能是空的。排除於資料集不產生最終答案。收尾後單位已定稿。",
        scenarios: ["自訂答案只在正式標記", "排除不顯示定案值"],
        ref: "A1",
        highlight: ["n4", "e1", "n5", "e2", "n6"],
      },
      {
        title: "結案條件",
        body: "正式標記作業全數提交、全部單位已定稿或經例外池排除、沒有爭議中、最終例外池已清空、品質指標就緒，五條同時成立時，專案負責人才能把任務標記完成。",
        scenarios: [],
        ref: "主流程 4",
        highlight: ["a5", "n7", "a6", "n8"],
      },
      {
        title: "替代：還有條件沒滿足",
        body: "擋下這次轉換，逐項列出沒滿足的具體原因；其他單位照常審核。",
        scenarios: [],
        ref: "A2",
        highlight: ["n7", "e3", "n3"],
      },
      {
        title: "結果：任務已完成",
        body: "任務成為已完成，不能再往回走；匯出從這時起開放。",
        scenarios: [],
        ref: "結果",
        highlight: ["n8"],
      },
    ],
  },
];

export default function Spec0402AnnotationWorkspaceFlow(): ReactElement {
  return <FlowShell flows={FLOWS} />;
}
