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

/* ================================================================ 【流程】依規格填寫（規格 04-01 標記清單） ================================================================ */

const FLOWS: Flow[] = [
  {
    id: "open-list",
    label: "開清單",
    trigger: "使用者從側欄點「標記作業」，或從儀表板任務列的非快速區點進來",
    result: "清單顯示這個任務的資訊卡與資料清單；網址壞掉的人看到的是講得通的說明與一個回儀表板的入口，不是一張空白清單",
    lanes: ["標記員或審核員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點標記作業", "或任務列"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["解析網址", "的上下文"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["有帶", "任務？"] },
      { id: "n4", lane: 1, col: 3, kind: "decision", label: ["任務查", "得到？"] },
      { id: "n5", lane: 1, col: 4, kind: "system", end: true, label: ["顯示資訊", "卡與清單"] },
      { id: "n6", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["顯示未指", "定任務"] },
      { id: "n7", lane: 1, col: 6, kind: "system", exception: true, end: true, label: ["顯示找不", "到任務"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "a4", from: "n4", to: "n5", label: "是" },
      { id: "e1", from: "n3", to: "n6", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e2", from: "n4", to: "n7", exception: true, label: "否", exit: "top", enter: "top", via: laneTop(1) - 8 },
    ],
    steps: [
      {
        title: "從側欄或儀表板的非快速區點進來",
        body: "兩條路都落在清單：側欄的「標記作業」是這個模組的入口頁，儀表板任務列的非快速區點進來也是清單，而且帶著被點的那個任務的上下文。",
        scenarios: ["側欄進來是清單", "儀表板非快速區進來是清單"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "系統解析網址帶來的任務、角色與標記階段",
        body: "角色只認標記員與審核員，缺值或不認得一律回退成標記員；標記階段只認試標與正式標記，缺值或不認得一律回退成試標；標記員身分與審核員身分缺值時當成登入者本人。任務的設定讀的是任務詳情已經發布的那一份。這一頁沒有任何從本機記憶體還原上下文的退路。",
        scenarios: ["角色回退成標記員", "標記階段回退成試標", "缺角色就當標記員", "不認得的標記階段值當試標", "身分缺值當成登入者本人", "任務設定讀已發布的那一份", "上下文只從網址來"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "例外：網址沒帶任務",
        body: "不得進入一張空白清單——空清單看起來像這個任務沒有資料，而實際上是網址壞了。顯示「未指定任務，請回到儀表板重新選擇任務。」與一個回儀表板的入口；這個狀態下整條麵包屑只剩第 1 層而且不帶連結。流程結束。",
        scenarios: ["沒帶任務不進空白清單", "沒帶任務時麵包屑零個連結"],
        ref: "E1",
        highlight: ["n3", "e1", "n6"],
      },
      {
        title: "例外：帶了任務但查不到",
        body: "顯示「找不到這個任務」，說明把任務代碼寫出來，同樣給一個回儀表板的入口。流程結束。",
        scenarios: ["任務查不到顯示代碼"],
        ref: "E2",
        highlight: ["n4", "e2", "n7"],
      },
      {
        title: "兩道都過，顯示任務資訊卡與資料清單",
        body: "資訊卡上有任務名稱、進度摘要、依設定順序排的輸出類型標籤、標記階段徽章、任務狀態徽章、快速入口與進度條；標題下的導引跟著角色換一句；麵包屑只有兩層。資料還在讀的時候顯示載入中，和空狀態分得出來。",
        scenarios: ["任務資訊卡的內容", "頁首導引跟著角色", "麵包屑只有兩層", "讀取中顯示載入中", "載入中與空狀態分得出來"],
        ref: "主流程 3",
        highlight: ["a3", "n4", "a4", "n5"],
      },
      {
        title: "結果：進得來的人看到清單，進不來的人知道為什麼",
        body: "這一頁是用來挑的，不是用來做的；挑好之後的動作在下一段流程。流程結束。",
        scenarios: ["側欄進來是清單", "沒帶任務不進空白清單"],
        ref: "結果",
        highlight: ["n5"],
      },
    ],
  },
  {
    id: "pick-one",
    label: "在清單裡挑一筆進工作區",
    trigger: "清單已經顯示這個任務的資料",
    result: "使用者進到工作區，而且停在他自己挑的那一筆；按快速入口的人停在最新未完成的那一筆",
    lanes: ["標記員或審核員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["篩選或搜尋"] },
      { id: "n2", lane: 0, col: 1, kind: "action", label: ["點某一筆"] },
      { id: "n3", lane: 1, col: 2, kind: "system", end: true, label: ["進工作區", "停在那筆"] },
      { id: "n4", lane: 0, col: 3, kind: "action", exception: true, label: ["按快速", "繼續"] },
      { id: "n5", lane: 1, col: 4, kind: "system", exception: true, end: true, label: ["落在最新", "未完成"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "e1", from: "n1", to: "n4", exception: true, exit: "top", enter: "top", via: laneTop(0) + 12 },
      { id: "e2", from: "n4", to: "n5", exception: true },
    ],
    steps: [
      {
        title: "篩選或搜尋，縮小到想做的那一批",
        body: "篩選即時反映，不用另外按一顆套用；搜尋只比對用途是輸入的欄位，不比對輸出欄位，也不比對背景參考。篩選或搜尋之後分頁一律回第一頁。",
        scenarios: ["篩選即時反映", "搜尋比對輸入欄位", "搜尋不比對輸出欄位", "篩選後分頁回第一頁"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "點某一筆，進入工作區並停在那一筆",
        body: "點整列或點列上的動作入口都進得去，進去的是同一筆。進去時把清單的四個檢視狀態一起帶出去，所以從工作區返回時還原得回來。",
        scenarios: ["點資料列進工作區", "點編輯進工作區", "檢視狀態帶進工作區"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "替代：按任務資訊卡的「快速繼續／快速審核」",
        body: "跳過挑選那一步，直接落在最新未完成的那一筆。最新未完成有明確的優先序：先取最後一筆待處理，沒有的話取最後一筆已儲存，兩者都沒有就回退成該任務的最後一筆——全部做完的任務按下去不該停在一個空畫面。流程結束。",
        scenarios: ["清單上的快速繼續同行為", "最新未完成有優先序", "沒有待處理就取已儲存", "全部做完就回退最後一筆"],
        ref: "A1",
        highlight: ["n1", "e1", "n4", "e2", "n5"],
      },
      {
        title: "結果：兩條路都進同一個工作區",
        body: "差別只在停在哪一筆——自己挑的那一筆，或最新未完成的那一筆。流程結束。",
        scenarios: ["點資料列進工作區", "快速繼續直達工作區"],
        ref: "結果",
        highlight: ["n3", "n5"],
      },
    ],
  },
  {
    id: "back-to-list",
    label: "從工作區返回清單",
    trigger: "使用者從工作區返回",
    result: "清單還是他離開時的樣子，不必重新篩一次",
    lanes: ["標記員或審核員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["從工作區", "返回"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["還原篩選", "與頁碼"] },
      { id: "n3", lane: 1, col: 2, kind: "system", end: true, label: ["回到可以", "再挑一筆"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
    ],
    steps: [
      {
        title: "從工作區返回清單",
        body: "工作區有三條返回清單的路徑：側欄的「標記作業」、任務查不到時的轉址，以及麵包屑第 2 層。三條都要還原，不是只有其中一條。",
        scenarios: ["從工作區返回還原", "三條返回路徑都還原"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "系統原樣還原原本的篩選與頁碼",
        body: "還原的是四個值：完成狀態篩選、搜尋字串、每頁筆數、頁碼位移。前兩條路徑是原樣沿用原本的網址參數所以自動成立；麵包屑第 2 層自己重組網址，所以要另外轉發。",
        scenarios: ["從工作區返回還原", "預設值不寫進網址"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "回到可以再挑一筆的狀態",
        body: "除了那四個值，同一個任務與同一個標記階段的上下文也要還原，而且保留捲動位置——回來時看到的是剛才那一列，不是跳回最上面。返回路徑也要把標記員身分與審核員身分一起轉發。",
        scenarios: ["返回時保留捲動位置", "返回路徑也轉發身分"],
        ref: "主流程 3",
        highlight: ["n3"],
      },
      {
        title: "結果：不必重新篩一次",
        body: "清單還是他離開時的樣子：四個檢視狀態、同一個任務與標記階段的上下文，還有捲動位置都在。流程結束。",
        scenarios: ["從工作區返回還原"],
        ref: "結果",
        highlight: ["n3"],
      },
    ],
  },
  {
    id: "quick-resume",
    label: "從儀表板直接續做",
    trigger: "使用者在儀表板點任務卡的「快速繼續／快速審核」",
    result: "每天回來續做的人一步就回到工作，不必先挑一遍",
    lanes: ["標記員或審核員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點快速", "繼續"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["設定查", "得到？"] },
      { id: "n3", lane: 1, col: 2, kind: "system", end: true, label: ["帶最新未完", "成進工作區"] },
      { id: "n4", lane: 1, col: 3, kind: "system", exception: true, label: ["改推下一個", "審核單位"] },
      { id: "n5", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["導回", "標記清單"] },
      { id: "n6", lane: 1, col: 4, kind: "system", exception: true, end: true, label: ["進工作區落", "在該單位"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "是" },
      { id: "e1", from: "n2", to: "n5", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e2", from: "n1", to: "n4", exception: true, exit: "top", enter: "top", via: laneTop(0) + 12 },
      { id: "e3", from: "n4", to: "n6", exception: true },
    ],
    steps: [
      {
        title: "在儀表板點任務卡的「快速繼續／快速審核」",
        body: "按鈕的文字跟著角色變：標記員看到「快速繼續」，審核員看到「快速審核」。這一條與側欄進清單是刻意並存的——每天回來續做的人不想每次都先挑一遍。",
        scenarios: ["快速繼續直達工作區", "按鈕文字跟著角色"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "查得到已發布的設定，帶著最新未完成的那一筆直接進工作區",
        body: "不經過清單，而且任務必須是被點的那一個，不得導向別的任務的內容。最新未完成的優先序與清單上的快速入口同一套。",
        scenarios: ["不得導向別的任務", "最新未完成有優先序"],
        ref: "主流程 2、3",
        highlight: ["a2", "n3"],
      },
      {
        title: "替代：他是審核員",
        body: "目標不是預先指定的某一筆，而是下一個可處理的審核單位，由審核單位狀態與他本人的身分即時推導（見階段三）。有爭議的單位優先，而且不要求那個單位先被指派給他。快速審核帶出五項上下文，進到工作區時落在那個單位，不是最新未完成的那一筆。流程結束。",
        scenarios: ["快速審核導向可處理的單位", "爭議優先序不要求指派", "快速審核帶出五項"],
        ref: "A1",
        highlight: ["n1", "e2", "n4", "e3", "n6"],
      },
      {
        title: "例外：那個任務查不到已發布的設定",
        body: "導回標記清單，而清單自己會顯示「找不到這個任務」與回儀表板的入口——不會停在一個半成品的工作區。流程結束。",
        scenarios: ["任務查不到顯示代碼"],
        ref: "E1",
        highlight: ["n2", "e1", "n5"],
      },
      {
        title: "結果：一步回到工作",
        body: "審核員那一支還有一種空的情況：推導不出任何可處理的單位時導回清單並說明目前沒有可處理項目，而且不開任何已定稿的唯讀單位——那一條寫在審核員視圖那一節。流程結束。",
        scenarios: ["沒有可處理就導回清單", "沒有可處理時不開唯讀單位"],
        ref: "結果",
        highlight: ["n3", "n6"],
      },
    ],
  },
];

export default function Spec0401AnnotationListFlow(): ReactElement {
  return <FlowShell flows={FLOWS} />;
}
