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

/* ================================================================ 【流程】依規格填寫（規格 02-01 儀表板） ================================================================ */

const FLOWS: Flow[] = [
  {
    id: "enter-dashboard",
    label: "進入儀表板拿到自己的版面",
    trigger: "使用者登入成功後進入儀表板",
    result: "使用者看到唯一一種對應他身分的版面，頁首與導覽在每一種版面上都一樣",
    lanes: ["平台成員或系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["進到", "儀表板"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["角色", "有效？"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["系統管", "理員？"] },
      { id: "n4", lane: 1, col: 3, kind: "decision", label: ["有任務", "角色？"] },
      { id: "n5", lane: 1, col: 4, kind: "system", end: true, label: ["顯示對應", "的版面"] },
      { id: "n6", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["入口卡與", "三條路徑"] },
      { id: "n7", lane: 1, col: 6, kind: "system", exception: true, end: true, label: ["導向", "登入頁"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "是" },
      { id: "a3", from: "n3", to: "n4", label: "否" },
      { id: "a4", from: "n3", to: "n5", label: "是", exit: "top", enter: "top", via: laneTop(1) - 8 },
      { id: "a5", from: "n4", to: "n5", label: "是" },
      { id: "e1", from: "n4", to: "n6", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e2", from: "n2", to: "n7", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 4 },
    ],
    steps: [
      {
        title: "使用者進到儀表板，系統先確認他的系統角色有效",
        body: "這一頁自己不做事，它只做一次「你是誰、你在這些任務裡是什麼角色」的判斷。未登入的人到不了這一頁。",
        scenarios: ["未登入時導向登入頁"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "例外：系統角色無效",
        body: "導向登入頁，不顯示任何一種版面。流程結束。",
        scenarios: ["角色無效時導向登入頁"],
        ref: "E1",
        highlight: ["n2", "e2", "n7"],
      },
      {
        title: "系統判斷他是不是系統管理員",
        body: "是系統管理員就直接拿到全平台的四個區塊——那也是「對應他身分的版面」其中一種，所以這一支直接接到同一個節點。系統管理員看得到全平台的統計與任務列表。",
        scenarios: ["系統管理員拿到全平台版面"],
        ref: "主流程 2",
        highlight: ["a2", "n3", "a4", "n5"],
      },
      {
        title: "不是系統管理員，就看他在各任務的角色",
        body: "怎麼讀、讀不到怎麼辦，見下一段流程。讀到的任務角色有一種以上時，依專案負責人大於審核員大於標記員的優先序，只顯示其中一種版面。",
        scenarios: ["專案負責人拿到專案負責人版面", "標記員拿到標記員版面", "審核員拿到審核員版面", "多重任務角色只給一種版面", "審核員與標記員並存時取審核員"],
        ref: "主流程 3",
        highlight: ["a3", "n4", "a5", "n5"],
      },
      {
        title: "替代：一個任務角色都沒有",
        body: "同時顯示三張行動入口卡與「三條最短成功路徑」兩個區塊，不是只有其中一個。三張卡的按鈕都是真的入口，沒有任務可做時由那一頁顯示它自己的空狀態。流程結束。",
        scenarios: ["沒有任務角色的人拿到行動入口", "兩個區塊同時顯示", "三條最短成功路徑各五步", "三張卡的按鈕都走到模組入口頁"],
        ref: "A1",
        highlight: ["n4", "e1", "n6"],
      },
      {
        title: "結果：唯一一種版面，頁首與導覽都一樣",
        body: "不論落在哪一種版面，頁首都顯示同一組資訊；導覽、語言切換與登出不屬於這一頁。流程結束。",
        scenarios: ["頁首在每一種版面都顯示"],
        ref: "結果",
        highlight: ["n5"],
      },
    ],
  },
  {
    id: "load-task-roles",
    label: "讀取任務角色時的載入與失敗",
    trigger: "使用者進到儀表板，而且不是系統管理員",
    result: "使用者不會在骨架上卡住——要嘛換成真的版面，要嘛看到一句講得通的錯誤與一個重試入口",
    lanes: ["平台成員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["進到", "儀表板"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["顯示骨架", "佔位"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["讀到", "角色？"] },
      { id: "n4", lane: 1, col: 3, kind: "system", end: true, label: ["換成對應", "的版面"] },
      { id: "n5", lane: 1, col: 4, kind: "system", exception: true, end: true, label: ["錯誤說明", "與重試"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "e1", from: "n3", to: "n5", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
    ],
    steps: [
      {
        title: "讀取還沒回來的這段時間顯示骨架佔位",
        body: "骨架用的是指標卡的佈局，所以它不一定長得像最終的版面。",
        scenarios: ["讀取任務角色時顯示骨架"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2", "a2", "n3"],
      },
      {
        title: "讀到了就結束骨架，無縫換成實際內容",
        body: "即使骨架的佈局和最終版面不同，也直接切換，不再插一個中間狀態。流程結束。",
        scenarios: ["讀完無縫換成實際內容", "骨架與最終版面不同也直接切換"],
        ref: "主流程 2",
        highlight: ["a3", "n4"],
      },
      {
        title: "例外：讀取任務角色失敗",
        body: "結束骨架，顯示錯誤說明與一個重試入口。不改用一般使用者版面、不清掉登入狀態、也不導向登入頁。重試之後再失敗，照樣留在錯誤畫面。流程結束。",
        scenarios: ["讀取失敗顯示錯誤與重試", "讀取失敗不改用其他版面", "讀取失敗不清掉登入狀態", "重試後再失敗仍留在錯誤畫面"],
        ref: "E1",
        highlight: ["n3", "e1", "n5"],
      },
      {
        title: "結果：不會卡在骨架上",
        body: "要嘛換成真的版面，要嘛看到一句講得通的錯誤與一個重試入口；骨架本身不是一種終局。流程結束。",
        scenarios: ["讀完無縫換成實際內容", "重試後再失敗仍留在錯誤畫面"],
        ref: "結果",
        highlight: ["n4", "n5"],
      },
    ],
  },
  {
    id: "back-to-annotating",
    label: "從儀表板回到標記工作",
    trigger: "標記員要繼續標記",
    result: "標記員從儀表板一步回到工作，而且回到的是他按的那一個任務",
    lanes: ["標記員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["按快速", "繼續"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["找沒提交", "的那一筆"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["找到", "了？"] },
      { id: "n4", lane: 1, col: 3, kind: "system", end: true, label: ["進標記", "工作區"] },
      { id: "n5", lane: 1, col: 4, kind: "system", exception: true, end: true, label: ["到這個任", "務的清單"] },
      { id: "n6", lane: 0, col: 2, kind: "action", exception: true, label: ["按列上", "其他地方"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "e1", from: "n3", to: "n5", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e2", from: "n1", to: "n6", exception: true, exit: "top", enter: "top", via: laneTop(0) + 16 },
      { id: "e3", from: "n6", to: "n5", exception: true },
    ],
    steps: [
      {
        title: "標記員在某個任務列按「快速繼續」",
        body: "任務列的每一列都有這顆按鈕，不是只有第一列有。兩個輸出類型相同的任務，各自的按鈕也各自獨立。",
        scenarios: ["標記員每列都有快速繼續", "兩個任務輸出類型相同仍各自獨立"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "系統找這個任務第一筆還沒提交的資料",
        body: "可能是已儲存的草稿，也可能是還沒開始的那一筆。",
        scenarios: [],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "找到了就帶他進標記工作區",
        body: "帶的是這一個任務、那一筆資料與他的標記員身分。帶給下一頁的清單樣式資訊不由輸出類型推導。流程結束。",
        scenarios: ["快速繼續開第一筆沒提交的資料", "清單樣式資訊不由輸出類型推導"],
        ref: "主流程 3",
        highlight: ["a3", "n4"],
      },
      {
        title: "替代：這個任務的資料全部都已提交",
        body: "改帶他到這個任務的標記清單，不指定某一筆；「快速繼續」照樣可見可按。流程結束。",
        scenarios: ["全部已提交時快速繼續到清單"],
        ref: "A1",
        highlight: ["n3", "e1", "n5"],
      },
      {
        title: "替代：他按的是任務列上「快速繼續」以外的地方",
        body: "帶他到這個任務的標記清單。流程結束。",
        scenarios: ["點標記員任務列其他地方到清單"],
        ref: "A2",
        highlight: ["n1", "e2", "n6", "e3", "n5"],
      },
      {
        title: "結果：回到的是他按的那一個任務",
        body: "不是任意一個任務，也不是這個任務的第一筆（除非那一筆正好是第一筆沒提交的）。流程結束。",
        scenarios: ["兩個任務輸出類型相同仍各自獨立"],
        ref: "結果",
        highlight: ["n4", "n5"],
      },
    ],
  },
  {
    id: "back-to-reviewing",
    label: "從儀表板回到審核工作",
    trigger: "審核員要繼續審核",
    result: "審核員進到的是他真的能處理的那一筆，不是這個任務的第一筆",
    lanes: ["審核員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["按快速", "審核"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["推導可處", "理的單位"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["推導", "得出？"] },
      { id: "n4", lane: 1, col: 3, kind: "system", end: true, label: ["進標記", "工作區"] },
      { id: "n5", lane: 1, col: 4, kind: "system", exception: true, end: true, label: ["到清單並", "說明沒有"] },
      { id: "n6", lane: 0, col: 2, kind: "action", exception: true, label: ["按列上", "其他地方"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "e1", from: "n3", to: "n5", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e2", from: "n1", to: "n6", exception: true, exit: "top", enter: "top", via: laneTop(0) + 16 },
      { id: "e3", from: "n6", to: "n5", exception: true },
    ],
    steps: [
      {
        title: "審核員在某個任務列按「快速審核」",
        body: "任務列的每一列都有這顆按鈕。",
        scenarios: ["審核員每列都有快速審核"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "系統依審核單位的狀態與他本人的身分推導下一個可處理的單位",
        body: "推導的規則由標記清單那一頁擁有，這一頁只是使用它。推導的結果不取用任何預先指定的樣本。",
        scenarios: ["快速審核不開預先指定的樣本"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "推導得出一個單位就帶他進標記工作區",
        body: "帶的是任務、樣本、標記員身分、審核員身分與標記階段五項。流程結束。",
        scenarios: ["快速審核開可處理的審核單位"],
        ref: "主流程 3",
        highlight: ["a3", "n4"],
      },
      {
        title: "替代：推導結果是空的",
        body: "改帶他到這個任務的標記清單，不指定某一筆，並說明目前沒有可處理項目。不開任務的第一筆，也不開任何已定稿的唯讀單位。流程結束。",
        scenarios: ["沒有可處理單位時到清單並說明", "沒有可處理單位時不開已定稿的"],
        ref: "A1",
        highlight: ["n3", "e1", "n5"],
      },
      {
        title: "替代：他按的是任務列上「快速審核」以外的地方",
        body: "帶他到這個任務的標記清單。流程結束。",
        scenarios: ["點審核員任務列其他地方到清單"],
        ref: "A2",
        highlight: ["n1", "e2", "n6", "e3", "n5"],
      },
      {
        title: "結果：進到的是他真的能處理的那一筆",
        body: "已經參與過那個爭議審核的人，不會被導向自己無資格仲裁的單位。流程結束。",
        scenarios: ["沒有可處理單位時不開已定稿的"],
        ref: "結果",
        highlight: ["n4", "n5"],
      },
    ],
  },
];

export default function Spec0201DashboardFlow(): ReactElement {
  return <FlowShell flows={FLOWS} />;
}
