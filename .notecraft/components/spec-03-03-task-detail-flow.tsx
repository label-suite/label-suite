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

/* ================================================================ 【流程】依規格填寫（規格 03-03 任務詳情） ================================================================ */

const FLOWS: Flow[] = [
  {
    id: "enter-detail",
    label: "進入任務詳情",
    trigger: "使用者從任務列表點某個任務",
    result: "使用者停在概覽，看得出現況與下一個該做的決定；進不來的人有明確的落點",
    lanes: ["專案負責人或審核員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點某個", "任務"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["有負責", "或審核？"] },
      { id: "n3", lane: 1, col: 2, kind: "system", label: ["顯示標頭", "與分頁"] },
      { id: "n4", lane: 1, col: 3, kind: "decision", label: ["是負", "責人？"] },
      { id: "n5", lane: 1, col: 4, kind: "system", end: true, label: ["六個分頁", "停在概覽"] },
      { id: "n6", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["五個分頁", "全唯讀"] },
      { id: "n7", lane: 1, col: 6, kind: "system", exception: true, end: true, label: ["帶回任務", "列表"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "是" },
      { id: "e1", from: "n2", to: "n7", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 3 },
      { id: "a3", from: "n3", to: "n4" },
      { id: "a4", from: "n4", to: "n5", label: "是" },
      { id: "e2", from: "n4", to: "n6", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
    ],
    steps: [
      {
        title: "從任務列表點某個任務，系統確認他在這個任務有什麼角色",
        body: "看的是任務角色，不是系統角色。同一個人在同一個任務身兼多個角色時取聯集，權限以最寬的那個為準。",
        scenarios: ["同一人有多個角色取聯集"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "例外：只有標記員的角色，或完全沒有角色",
        body: "帶回任務列表並顯示無權限提示，不停在這一頁。系統管理員也一樣：他在任務列表看得到這個任務，但在這個任務沒有任務角色時就進不來。流程結束。",
        scenarios: ["標記員被帶回任務列表", "沒有任務角色的系統管理員進不來"],
        ref: "E1",
        highlight: ["n2", "e1", "n7"],
      },
      {
        title: "顯示共用的任務標頭與分頁，再看他是哪一種角色",
        body: "標頭顯示任務名稱與現在的階段，階段跟概覽同一個來源。分頁依固定順序排列，切分頁不會換頁。載入中先顯示骨架，載入失敗顯示可以重試的說明。",
        scenarios: ["標頭顯示任務名稱與階段", "標頭的階段與概覽同源", "分頁依固定順序排列", "切換分頁不換頁", "載入中顯示骨架", "載入失敗顯示重試"],
        ref: "主流程 2",
        highlight: ["a2", "n3", "a3", "n4"],
      },
      {
        title: "替代：只有審核員的角色",
        body: "看得到五個分頁，看不到成員管理，而且每個看得到的分頁一律唯讀。設定分頁他進得去，只是沒有編輯入口。回到概覽那一步。",
        scenarios: ["審核員看不到成員管理", "審核員的概覽是唯讀", "審核員進不了成員管理", "審核員直連設定分頁正常進入", "審核員的設定分頁沒有編輯入口"],
        ref: "A1",
        highlight: ["n4", "e2", "n6"],
      },
      {
        title: "替代：審核員用網址直接開成員管理",
        body: "導回概覽並顯示無權限，而且網址也改寫成概覽的參數，不會留在一個他沒有權限的位置。無效的分頁參數也一樣回到概覽。這一條的落點就是前一步那個唯讀的概覽，回到概覽那一步。",
        scenarios: ["審核員直連成員管理被導回概覽", "無效的分頁參數回到概覽", "網址帶著分頁與篩選"],
        ref: "A2",
        highlight: ["n6"],
      },
      {
        title: "結果：停在概覽，看得出現況與下一步",
        body: "概覽依序顯示六塊，包含四張數字卡、樣本池怎麼分，以及下一步該做什麼。草稿任務的概覽少了已完成試標回合那張卡。分享網址給別人會重現同一個畫面。流程結束。",
        scenarios: ["專案負責人看得到六個分頁", "概覽依序顯示六塊", "概覽顯示四張數字卡", "概覽顯示樣本池分配", "概覽顯示下一步該做什麼", "草稿任務的概覽", "分享網址重現同一個畫面"],
        ref: "結果",
        highlight: ["a4", "n5"],
      },
    ],
  },
  {
    id: "own-hours",
    label: "看自己的工時",
    trigger: "使用者點「工時紀錄」",
    result: "使用者看到篩選範圍內的工時明細與匯總",
    lanes: ["專案負責人或審核員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["選日期區間", "與階段"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["是負", "責人？"] },
      { id: "n3", lane: 0, col: 2, kind: "action", label: ["再選成員"] },
      { id: "n4", lane: 1, col: 3, kind: "system", label: ["依完整結果", "算匯總"] },
      { id: "n5", lane: 1, col: 4, kind: "decision", label: ["有紀錄？"] },
      { id: "n6", lane: 1, col: 5, kind: "system", end: true, label: ["明細表", "與匯總"] },
      { id: "n7", lane: 1, col: 6, kind: "system", exception: true, end: true, label: ["尚無工時", "回概覽"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "是" },
      { id: "e1", from: "n2", to: "n4", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "a3", from: "n3", to: "n4" },
      { id: "a4", from: "n4", to: "n5" },
      { id: "a5", from: "n5", to: "n6", label: "是" },
      { id: "e2", from: "n5", to: "n7", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 3 },
    ],
    steps: [
      {
        title: "選日期區間與任務階段",
        body: "篩選列上有日期區間與任務階段。只點了起點還沒點終點時不套用，明細表與匯總維持套用前的結果。改篩選會回到第一頁。",
        scenarios: ["工時篩選改變時回到第一頁", "單邊的日期網址保留語意"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "是專案負責人的話，還可以選成員",
        body: "專案負責人的篩選列多一個成員，看得到全部人的工時。",
        scenarios: ["工時明細表的欄位"],
        ref: "主流程 2",
        highlight: ["a1", "n2", "a2", "n3"],
      },
      {
        title: "替代：他是審核員",
        body: "篩選列上沒有成員那一個，而且只看得到自己的工時。少了這一步之後直接進到算匯總，回到第 3 步。",
        scenarios: ["審核員的工時只看得到自己", "審核員沒有成員篩選"],
        ref: "A1",
        highlight: ["n2", "e1", "n4"],
      },
      {
        title: "明細與匯總依完整的篩選結果計算",
        body: "匯總卡與異常提醒算的是整個篩選結果，不是只算目前這一頁。同一個成員同一天可能有多列，所以同一段登入狀態跨多列時上線時長不相加。",
        scenarios: ["工時匯總依完整篩選結果計算", "四張匯總卡", "工時的分頁狀態獨立"],
        ref: "主流程 3",
        highlight: ["a3", "n4", "a4", "n5"],
      },
      {
        title: "替代：篩選之後一筆都沒有",
        body: "顯示「尚無工時紀錄」與一個回到概覽的入口，不讓使用者卡在一張空表上。流程結束。",
        scenarios: ["工時一筆都沒有"],
        ref: "A2",
        highlight: ["n5", "e2", "n7"],
      },
      {
        title: "結果：看到篩選範圍內的明細與匯總",
        body: "明細表的欄位依序是日期、成員、角色、登入與登出時間、上線時長、工作時長、標記筆數、審核筆數、仲裁筆數、平均速度、標記階段。這一頁不夾帶標記內容。流程結束。",
        scenarios: ["工時明細表的欄位", "工時不夾帶標記內容"],
        ref: "結果",
        highlight: ["a5", "n6"],
      },
    ],
  },
];

export default function Spec0303TaskDetailFlow(): ReactElement {
  return <FlowShell flows={FLOWS} />;
}
