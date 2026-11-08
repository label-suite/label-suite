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

/* ================================================================ 【流程】依規格填寫（規格 07-02 工作頁籤） ================================================================ */

const FLOWS: Flow[] = [
  {
    id: "open-tab",
    label: "開啟頁籤",
    trigger: "使用者點側欄、清單、通知或儀表板上會換頁的項目",
    result: "目標頁面在一個頁籤裡顯示，檢視狀態與網址一致；被擋下時沒有任何頁籤被動到",
    lanes: ["平台成員或系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點會換頁", "的項目"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["已經", "開著？"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["開得了？"] },
      { id: "n4", lane: 1, col: 3, kind: "system", label: ["在右邊插", "入新頁籤"] },
      { id: "n5", lane: 1, col: 4, kind: "system", end: true, label: ["掛載並還", "原檢視"] },
      { id: "n6", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["擋下並", "顯示說明"] },
      { id: "n7", lane: 0, col: 2, kind: "action", exception: true, end: true, label: ["改用瀏覽", "器分頁"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "否" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "a4", from: "n4", to: "n5" },
      { id: "a5", from: "n2", to: "n5", exception: true, label: "是", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e1", from: "n3", to: "n6", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 3 },
      { id: "e2", from: "n1", to: "n7", exception: true, exit: "top", enter: "top", via: laneTop(0) + 16 },
    ],
    steps: [
      {
        title: "點一個會換頁的項目",
        body: "入口不只側欄：清單上的任務列、通知清單裡的項目、儀表板的「快速繼續」都算。頁籤列在每一個登入後、有側欄的頁面都在，系統管理的頁面也一樣；較窄的螢幕改成頂部的總覽按鈕，兩者恰有一個看得到。",
        scenarios: ["每一頁都看得到頁籤列", "頁籤列與總覽按鈕只有一個"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "系統先用同一性規則看這一頁是不是已經開著",
        body: "同一性規則是唯一來源：標記工作區看任務加模式（標記、審核或例外處置，三種各算一個）；新增任務永遠只能開一個；任務詳情看完整的檢視狀態，所以同一個任務可以開好幾個——那正是試標與正式標記比對的基礎。",
        scenarios: ["同一任務的標記與審核各一個頁籤", "同一任務的例外處置是第三個頁籤", "新增任務只能開一個", "同一任務不同階段各一個頁籤"],
        ref: "主流程 1",
        highlight: ["a1", "n2"],
      },
      {
        title: "例外：按住 Ctrl、⌘ 或用滑鼠中鍵點",
        body: "交給瀏覽器開新的瀏覽器分頁，工作頁籤這一列完全不介入，不建立頁籤。新的瀏覽器分頁從空白的頁籤列開始，不帶入原本那個分頁開過的頁籤。流程結束。",
        scenarios: ["按住 Ctrl 點擊交給瀏覽器", "另開瀏覽器分頁從空白開始"],
        ref: "E2",
        highlight: ["n1", "e2", "n7"],
      },
      {
        title: "系統看這個新頁籤開不開得了",
        body: "上限是 8 個，這是業務決定、不是暫定值。開得了有兩種情形：還沒到上限，或者已達上限但有可以淘汰的頁籤。兩種的結果一樣，所以圖上只畫一個判斷。",
        scenarios: ["新頁籤插在作用中頁籤右邊"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "在作用中頁籤的右邊插入新頁籤",
        body: "插在右邊，不是插在最後，所以從同一個頁籤分出去的幾個會排在一起。",
        scenarios: ["新頁籤插在作用中頁籤右邊"],
        ref: "主流程 2",
        highlight: ["a3", "n4"],
      },
      {
        title: "替代：已經 8 個了，但有可以淘汰的",
        body: "先淘汰最久沒用而且沒有未儲存變更的那一個，把它推進最近關閉的清單（之後可以重開），再插入新頁籤。「最久沒用」看的是最後一次成為作用中頁籤的時間。有未儲存變更的頁籤永遠不會被自動淘汰。",
        scenarios: ["達上限時淘汰最久沒用的", "有未儲存變更的頁籤不被淘汰"],
        ref: "A2",
        highlight: ["n3", "a3", "n4"],
      },
      {
        title: "例外：已經 8 個，而且每一個都有未儲存變更",
        body: "擋下開啟並顯示說明，不淘汰任何一個。會回報未儲存狀態的只有標記工作區（標記、審核與例外處置三種模式）與新增任務，其餘頁面一律視為沒有。流程結束。",
        scenarios: ["全部都有未儲存變更時擋下", "審核還沒送出也算未儲存", "例外處置還沒送出也算未儲存"],
        ref: "E1",
        highlight: ["n3", "e1", "n6"],
      },
      {
        title: "掛載那一頁並由網址還原檢視狀態",
        body: "頁籤只記一個網址，所以還原得回來的前提是那一頁把檢視狀態寫進網址。重新整理瀏覽器時頁籤清單與停在哪一個都還原回來。",
        scenarios: ["切回頁籤還原子分頁與捲動", "重新整理後頁籤還在"],
        ref: "主流程 3",
        highlight: ["a4", "n5"],
      },
      {
        title: "替代：這一頁已經開著",
        body: "切到那個頁籤，不新開第二個，也不重新掛載。使用者在某一頁裡改篩選、改子分頁而撞到另一個已開的頁籤時也一樣：切過去，原本那個維持原狀並顯示說明，不合併也不產生重複。",
        scenarios: ["同一頁再點一次切到既有頁籤", "頁內切換撞到已開的頁籤"],
        ref: "A1",
        highlight: ["n2", "a5", "n5"],
      },
      {
        title: "結果：目標頁面在一個頁籤裡顯示",
        body: "檢視狀態與網址一致，所以這個頁籤的連結分享出去打開的是同一個畫面。被擋下的時候沒有任何既有頁籤被動到。流程結束。",
        scenarios: ["切回頁籤還原子分頁與捲動"],
        ref: "結果",
        highlight: ["n5"],
      },
    ],
  },
  {
    id: "switch-tab",
    label: "切換頁籤",
    trigger: "使用者點另一個頁籤，或按 Alt 加數字",
    result: "畫面回到離開那個頁籤之前的樣子，包含子分頁、篩選、階段與捲動位置",
    lanes: ["平台成員或系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點另一個", "頁籤"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["記住目前的", "捲動位置"] },
      { id: "n3", lane: 1, col: 2, kind: "system", label: ["卸載舊頁", "掛載新頁"] },
      { id: "n4", lane: 1, col: 3, kind: "decision", label: ["還有", "權限？"] },
      { id: "n5", lane: 1, col: 4, kind: "system", end: true, label: ["還原子分頁", "與捲動"] },
      { id: "n6", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["無權限或", "找不到"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4" },
      { id: "a4", from: "n4", to: "n5", label: "是" },
      { id: "e1", from: "n4", to: "n6", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
    ],
    steps: [
      {
        title: "點另一個頁籤，或按 Alt 加數字",
        body: "切換是頁內的事，不經過瀏覽器的換頁；按瀏覽器的上一頁只會回到同一個頁籤裡的上一個檢視狀態，不會跳到別的頁籤，也不會增減頁籤。",
        scenarios: ["上一頁只在同一個頁籤內移動"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "先記住目前這個頁籤的捲動位置",
        body: "捲動位置不寫進網址，只在同一個瀏覽器分頁內記住，所以每個頁籤各自獨立。",
        scenarios: ["切回頁籤還原子分頁與捲動"],
        ref: "主流程 1",
        highlight: ["a1", "n2"],
      },
      {
        title: "卸載目前這一頁，掛載目標頁籤那一頁",
        body: "頁籤只記網址、不保留頁面本身的執行狀態，所以切回去是重新掛載那一頁，再由網址把畫面還原回來。",
        scenarios: ["切回頁籤還原子分頁與捲動"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "替代：目標頁籤先前已經載入過",
        body: "不顯示整頁載入中，直接呈現內容。圖上不另畫一條分支，因為終點和主流程一樣，差別只在中間會不會閃一下載入畫面。",
        scenarios: ["已載入過的頁籤不顯示載入中"],
        ref: "A1",
        highlight: ["n3"],
      },
      {
        title: "系統在這一刻才看權限與資料還在不在",
        body: "權限或資料在頁籤閒置的時候變了，系統不主動推播，只在使用者切回去的這一刻重新檢查。",
        scenarios: ["不主動推播權限變更"],
        ref: "主流程 3",
        highlight: ["a3", "n4"],
      },
      {
        title: "例外：已經沒有權限，或資料已不存在",
        body: "該頁籤顯示無權限或找不到的畫面，而且不自動關閉——由使用者自己決定要不要關。兩個畫面裡面寫什麼、有沒有返回的操作，由共用介面模組另一份規格定義全站通用的版本。多個頁籤同時失效時各自顯示、互不影響。流程結束。",
        scenarios: ["切回時沒有權限", "切回時資料已不存在", "多個頁籤同時失效"],
        ref: "E1",
        highlight: ["n4", "e1", "n6"],
      },
      {
        title: "結果：還原子分頁、篩選、頁碼與捲動位置",
        body: "畫面回到離開那個頁籤之前的樣子。某一頁還沒把某項檢視狀態寫進網址時，那一項就還原不回來——那是該頁自己要補的，不是頁籤的責任。流程結束。",
        scenarios: ["切回頁籤還原子分頁與捲動"],
        ref: "結果",
        highlight: ["a4", "n5"],
      },
    ],
  },
  {
    id: "close-tab",
    label: "關閉與重開頁籤",
    trigger: "使用者關閉某個頁籤",
    result: "頁籤關閉且可以重開；有未儲存變更時使用者一定先被問過",
    lanes: ["平台成員或系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點頁籤的", "關閉"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["有未存", "變更？"] },
      { id: "n3", lane: 1, col: 2, kind: "system", label: ["關閉並推進", "最近清單"] },
      { id: "n4", lane: 1, col: 3, kind: "system", end: true, label: ["焦點移到", "鄰近頁籤"] },
      { id: "n5", lane: 1, col: 4, kind: "system", exception: true, end: true, label: ["沿用原有", "確認對話"] },
      { id: "n6", lane: 0, col: 3, kind: "action", exception: true, label: ["點「重開", "剛關閉的」"] },
      { id: "n7", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["那一筆重", "新開啟"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "否" },
      { id: "a3", from: "n3", to: "n4" },
      { id: "a4", from: "n3", to: "n6", exception: true, exit: "top", enter: "bottom", via: laneBottom(0) - 8 },
      { id: "a5", from: "n6", to: "n7", exception: true },
      { id: "e1", from: "n2", to: "n5", exception: true, label: "是", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
    ],
    steps: [
      {
        title: "點頁籤上的關閉",
        body: "「全部關閉」走的是同一道未儲存判斷：它關掉所有沒有未儲存變更的頁籤、留下有的，並顯示被跳過了幾個，本身不另外彈確認對話。",
        scenarios: ["全部關閉跳過未儲存的"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "系統先看這個頁籤有沒有未儲存變更",
        body: "會回報未儲存狀態的只有標記工作區（標記、審核與例外處置三種模式）與新增任務，其餘頁面一律視為沒有。",
        scenarios: ["審核還沒送出也算未儲存", "例外處置還沒送出也算未儲存"],
        ref: "主流程 1",
        highlight: ["a1", "n2"],
      },
      {
        title: "例外：有未儲存變更",
        body: "沿用該頁原本就有的確認對話，不另外做第二套；使用者取消就不關閉。這和自動淘汰不同——自動淘汰永遠不會動有未儲存變更的頁籤，但使用者自己關是可以的，只是一定先被問過。流程結束。",
        scenarios: ["關閉有未儲存變更的頁籤"],
        ref: "E1",
        highlight: ["n2", "e1", "n5"],
      },
      {
        title: "關閉它，並推進最近關閉的清單",
        body: "手動關閉、全部關閉、被自動淘汰的頁籤都會推進這個清單。清單最多記 10 筆，第 11 筆進來時最舊的一筆被丟掉；登出時整個清空。",
        scenarios: ["最近關閉的清單滿了丟最舊", "登出後下一位從空白開始"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "關的是作用中頁籤時，焦點移到鄰近的頁籤",
        body: "焦點怎麼移動由側欄那一頁定義，是那一節的唯一正典，本頁不重寫也不另外驗收：關的不是最右邊就移到右鄰，是最右邊就移到左鄰，關的不是作用中頁籤則焦點不動。",
        scenarios: [],
        ref: "主流程 3",
        highlight: ["a3", "n4"],
      },
      {
        title: "替代：點「重開剛關閉的」或按 Alt+Shift+T",
        body: "取出最近關閉的一筆重新開啟，順序是後關的先重開。要重開的那一筆依同一性規則發現已經有頁籤開著時，切到那個頁籤、不新開，並把該筆從清單移除。清單空的時候這個操作點不下去。重開之後就回到「開啟頁籤」那一段流程的第 1 步。",
        scenarios: ["重開剛關閉的頁籤", "重開依後關的先出", "重開撞到已開的頁籤", "清單空時不能重開"],
        ref: "A1",
        highlight: ["n3", "a4", "n6", "a5", "n7"],
      },
      {
        title: "結果：關掉了，而且救得回來",
        body: "頁籤關閉、焦點有明確的落點，而且還在最近關閉的清單裡救得回來；有未儲存變更的話使用者一定先被問過，不會無聲消失。流程結束。",
        scenarios: ["重開剛關閉的頁籤"],
        ref: "結果",
        highlight: ["n4"],
      },
    ],
  },
];

export default function Spec0702WorkspaceTabsFlow(): ReactElement {
  return <FlowShell flows={FLOWS} />;
}
