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

/* ================================================================ 【流程】依規格填寫（規格 01-04 個人設定） ================================================================ */

const FLOWS: Flow[] = [
  {
    id: "edit-profile",
    label: "改個人資料",
    trigger: "使用者要更新自己的姓名、聯絡方式或頭像",
    result: "資料更新，側欄即時反映；任何一項不合格就整筆不送出，已填的內容都還在",
    lanes: ["平台成員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["編輯欄位", "點儲存"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["欄位都", "合格？"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["頭像", "合格？"] },
      { id: "n4", lane: 1, col: 3, kind: "system", end: true, label: ["存起來", "側欄更新"] },
      { id: "n5", lane: 1, col: 4, kind: "system", exception: true, end: true, label: ["欄旁顯示", "說明"] },
      { id: "n6", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["顯示檔案", "限制"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "是" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "e1", from: "n2", to: "n5", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e2", from: "n3", to: "n6", exception: true, label: "否", exit: "top", enter: "top", via: laneTop(1) - 8 },
    ],
    steps: [
      {
        title: "編輯姓名、聯絡方式或選一張新頭像，點「儲存」",
        body: "頁面依序有五個區塊：個人資料、偏好設定、密碼設定、通知設定、連結 Google 帳號。姓名是 1 到 100 字；聯絡方式是自由文字、可以留空、上限 255 字並顯示字數；頭像選了之後先顯示預覽，還沒存。未登入的人直接開這一頁會被帶到登入頁。",
        scenarios: ["頁面依序顯示五個區塊", "未登入的人被帶到登入頁", "改聯絡方式", "聯絡方式可以留空", "聯絡方式顯示字數"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "例外：姓名空白或超過一百字，或聯絡方式超過上限",
        body: "欄位旁顯示對應的說明，整筆不送出。這一頁沒有改自己系統角色或停用自己帳號的操作。流程結束。",
        scenarios: ["姓名清空不送出", "姓名超過一百字", "聯絡方式超過上限", "這一頁沒有改自己角色或停用自己的操作"],
        ref: "E1",
        highlight: ["n2", "e1", "n5"],
      },
      {
        title: "例外：頭像格式不支援或超過大小上限",
        body: "顯示檔案限制的說明，不送出。接受 JPG、PNG 與 WebP，單檔不超過 5 MB；尺寸、長寬比與裁切都不限制，顯示時由系統縮放。流程結束。",
        scenarios: ["頭像格式不支援", "頭像超過大小上限", "頭像不限尺寸"],
        ref: "E2",
        highlight: ["a2", "n3", "e2", "n6"],
      },
      {
        title: "全部合格就存起來，側欄立刻跟著變",
        body: "側欄的名稱與頭像都即時更新；移除頭像之後也一樣。選了圖或按了移除但沒按儲存就離開，下次進來還是上次存好的那張。送出之後平台沒有回應時，顯示一句可以重試的說明，已填的內容都還在。",
        scenarios: ["改姓名後側欄立刻更新", "上傳頭像後側欄立刻更新", "移除頭像後側欄立刻更新", "頭像沒儲存就離開", "移除頭像沒按儲存就離開", "送出後平台沒有回應"],
        ref: "主流程 2、3",
        highlight: ["a3", "n4"],
      },
      {
        title: "結果：資料更新，側欄即時反映",
        body: "資料還沒載好的時候，五個區塊先顯示灰色佔位的骨架，不先閃一下空白的欄位。流程結束。",
        scenarios: ["資料載入中顯示骨架"],
        ref: "結果",
        highlight: ["n4"],
      },
    ],
  },
  {
    id: "submit-new-email",
    label: "送出新的 Email",
    trigger: "使用者要換掉登入用的 Email",
    result: "新 Email 記成待驗證，而登入用的還是舊 Email",
    lanes: ["平台成員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點變更", "填新信箱"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["沒人", "用嗎？"] },
      { id: "n3", lane: 1, col: 2, kind: "system", end: true, label: ["記待驗證", "寄驗證信"] },
      { id: "n4", lane: 1, col: 3, kind: "system", exception: true, end: true, label: ["顯示已被", "使用"] },
      { id: "n5", lane: 0, col: 2, kind: "action", exception: true, label: ["再送一個", "新信箱"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "是" },
      { id: "e1", from: "n2", to: "n4", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e2", from: "n1", to: "n5", exception: true, exit: "top", enter: "top", via: laneTop(0) + 16 },
      { id: "e3", from: "n5", to: "n3", exception: true },
    ],
    steps: [
      {
        title: "點 Email 旁的「變更」，同一頁切換成輸入新 Email 的狀態",
        body: "不離開這一頁、不另開畫面。格式不合法的時候下一步按不下去。",
        scenarios: ["進入換 Email 的狀態", "格式不合法時下一步不能點"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "例外：新 Email 已經有別的帳號在用",
        body: "顯示已被使用，不建立請求。這一條和註冊那一頁不同——這裡的操作者已經登入、在改自己的帳號，所以顯示得出來。流程結束。",
        scenarios: ["新 Email 已被使用"],
        ref: "E1",
        highlight: ["n2", "e1", "n4"],
      },
      {
        title: "沒人用就記成待驗證，寄一封驗證信到新信箱",
        body: "驗證成功之前登入用的還是舊 Email：舊的照樣登得進來，新的登不進來。寄出之後有冷卻時間，見「用驗證連結換掉 Email」那一段。",
        scenarios: ["換 Email 寄出驗證信", "驗證前舊 Email 仍可登入", "驗證前新 Email 登不進來"],
        ref: "主流程 2、3",
        highlight: ["a2", "n3"],
      },
      {
        title: "替代：使用者又送了另一個新 Email",
        body: "新的蓋掉舊的，舊連結立刻失效。接回主流程的第 3 步，重新寄一封信到最新那個信箱。",
        scenarios: ["送出第二個新 Email", "被蓋掉的舊連結失效"],
        ref: "A1",
        highlight: ["n1", "e2", "n5", "e3", "n3"],
      },
      {
        title: "結果：新 Email 記成待驗證",
        body: "這一步還沒有換掉任何東西——換掉要等下一段流程。流程結束。",
        scenarios: ["驗證前舊 Email 仍可登入"],
        ref: "結果",
        highlight: ["n3"],
      },
    ],
  },
  {
    id: "verify-new-email",
    label: "用驗證連結換掉 Email",
    trigger: "使用者到新信箱收到驗證信",
    result: "成功後只有新 Email 能登入，而且每一台裝置都要重新登入",
    lanes: ["平台成員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點信裡", "的連結"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["連結", "有效？"] },
      { id: "n3", lane: 1, col: 2, kind: "system", label: ["換成新", "Email"] },
      { id: "n4", lane: 1, col: 3, kind: "system", end: true, label: ["所有裝置", "重新登入"] },
      { id: "n5", lane: 1, col: 4, kind: "system", exception: true, end: true, label: ["顯示失敗", "可重寄"] },
      { id: "n6", lane: 0, col: 2, kind: "action", exception: true, label: ["冷卻內點", "重新寄送"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "是" },
      { id: "a3", from: "n3", to: "n4" },
      { id: "e1", from: "n2", to: "n5", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e2", from: "n1", to: "n6", exception: true, exit: "top", enter: "top", via: laneTop(0) + 12 },
      { id: "e3", from: "n6", to: "n1", exception: true, exit: "bottom", enter: "bottom", via: laneBottom(0) - 8 },
    ],
    steps: [
      {
        title: "到新信箱點信裡的連結",
        body: "連結是一次性的；被另一個新 Email 蓋掉的舊連結會立刻失效。",
        scenarios: ["被蓋掉的舊連結失效"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "替代：冷卻時間內點「重新寄送」",
        body: "重新寄送每 60 秒最多一次。還沒到就不寄信，只顯示還要等多久；冷卻結束才能再寄一次。回到點連結那一步。",
        scenarios: ["冷卻時間內重新寄送", "冷卻結束後可以重新寄送"],
        ref: "A1",
        highlight: ["n1", "e2", "n6", "e3"],
      },
      {
        title: "例外：連結過期或已經失效",
        body: "顯示失敗，使用者可以重新寄送。流程結束。",
        scenarios: ["驗證連結過期"],
        ref: "E1",
        highlight: ["n2", "e1", "n5"],
      },
      {
        title: "連結有效，把 Email 換成新的",
        body: "換掉之後只有新 Email 能登入，舊的登不進來。",
        scenarios: ["驗證成功後只有新 Email 能登入"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "所有裝置的登入狀態全部失效，含目前這一台",
        body: "這和在這一頁改密碼不一樣——改密碼保留目前這一台。差別是刻意的：換 Email 連登入用的識別都變了，所以要清乾淨。這條規則由規格 01-05 擁有，這一頁不重複定義。",
        scenarios: ["驗證成功後所有裝置都要重新登入"],
        ref: "主流程 3",
        highlight: ["a3", "n4"],
      },
      {
        title: "結果：只有新 Email 能登入",
        body: "使用者回到登入頁，用新 Email 登入。流程結束。",
        scenarios: ["驗證成功後只有新 Email 能登入"],
        ref: "結果",
        highlight: ["n4"],
      },
    ],
  },
  {
    id: "change-password",
    label: "改密碼",
    trigger: "使用者要換掉自己的密碼",
    result: "密碼換成新的；使用者不必在這台重新登入，但其他裝置要",
    lanes: ["平台成員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["填密碼欄", "點送出"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["本來有", "密碼？"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["現有密", "碼對？"] },
      { id: "n4", lane: 1, col: 3, kind: "decision", label: ["新密碼", "過嗎？"] },
      { id: "n5", lane: 1, col: 4, kind: "system", end: true, label: ["換密碼", "只踢別台"] },
      { id: "n6", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["現有密碼", "錯誤"] },
      { id: "n7", lane: 1, col: 6, kind: "system", exception: true, end: true, label: ["欄旁顯示", "說明"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2", exit: "right", enter: "left" },
      { id: "a2", from: "n2", to: "n3", label: "是" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "a4", from: "n4", to: "n5", label: "是" },
      { id: "e1", from: "n2", to: "n4", exception: true, label: "否", exit: "top", enter: "top", via: laneTop(1) - 8 },
      { id: "e2", from: "n3", to: "n6", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e3", from: "n4", to: "n7", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 4 },
    ],
    steps: [
      {
        title: "填密碼欄位，點送出",
        body: "三個密碼欄預設都遮住，而且可以各自獨立切換顯示。",
        scenarios: ["密碼欄預設都遮住", "切換單一密碼欄的顯示"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "替代：用 Google 帳號進來、帳號本來沒有密碼",
        body: "不顯示現有密碼欄，跳過那一道檢查，直接設定新密碼；設好之後也能用 Email 與密碼登入。接回主流程的新密碼檢查。",
        scenarios: ["Google 帳號不顯示現有密碼欄", "Google 帳號設定密碼"],
        ref: "A1",
        highlight: ["n2", "e1", "n4"],
      },
      {
        title: "本來有密碼的人，系統先確認現有密碼正確",
        body: "現有密碼錯誤時顯示「現有密碼錯誤」，不換密碼，也不鎖定帳號——連錯幾次都不鎖，因為這個人已經登入、身分確認過了。這和登入頁的 10 次鎖定不衝突：那一條管的是還沒登入的人。流程結束。",
        scenarios: ["現有密碼錯誤", "現有密碼連錯不鎖定"],
        ref: "主流程 2、E1",
        highlight: ["a2", "n3", "e2", "n6"],
      },
      {
        title: "例外：新密碼不合組成規則，或兩次輸入不一致",
        body: "對應欄位旁顯示說明，不換密碼。組成規則和註冊那條路同一套。流程結束。",
        scenarios: ["兩次新密碼不一致", "新密碼不合組成規則"],
        ref: "E2",
        highlight: ["n4", "e3", "n7"],
      },
      {
        title: "都通過就換掉密碼，只踢掉其他裝置",
        body: "其他裝置的登入狀態失效，目前這一台維持登入。這和換 Email 與重設密碼不一樣，差別是刻意的：改密碼的人知道舊密碼、人就在這台，沒有理由把他踢出去。",
        scenarios: ["改密碼成功只踢掉其他裝置"],
        ref: "主流程 3、4",
        highlight: ["a3", "n4", "a4", "n5"],
      },
      {
        title: "結果：不必在這台重新登入，但其他裝置要",
        body: "三種動作對登入狀態的結果不同，對照表在這一頁的密碼設定那一節。流程結束。",
        scenarios: ["改密碼成功只踢掉其他裝置"],
        ref: "結果",
        highlight: ["n5"],
      },
    ],
  },
];

export default function Spec0104ProfileFlow(): ReactElement {
  return <FlowShell flows={FLOWS} />;
}
