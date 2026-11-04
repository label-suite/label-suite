import { useId, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

/**
 * spec-writing 業務流程圖骨架（參考實作）。寫法見同目錄的 flow.md。
 *
 * 使用方式：整份複製到 .notecraft/components/spec-<模組編號>-<頁面編號>-<主題>-flow.tsx，
 * 【骨架】一字不改；【流程】整段換成這份規格的流程資料，default export 改名。
 *
 * 【流程】填的是規格 06-01 使用者管理的三段業務流程：邀請新帳號、停用帳號、變更系統角色。
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

/* ================================================================ 【流程】依規格填寫（規格 06-01 使用者管理） ================================================================ */

const FLOWS: Flow[] = [
  {
    id: "invite",
    label: "邀請新帳號",
    trigger: "有新成員要加入平台，系統管理員替對方建立帳號",
    result: "列表多一個啟用中的帳號；受邀的使用者設定密碼後可以登入；異動紀錄多一筆「新增」",
    lanes: ["系統管理員", "系統", "受邀的使用者"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點「新增", "使用者」"] },
      { id: "n2", lane: 0, col: 1, kind: "action", label: ["填寫並", "點「儲存」"] },
      { id: "d1", lane: 1, col: 2, kind: "decision", label: ["可以", "建立？"] },
      { id: "n3", lane: 1, col: 3, kind: "system", label: ["建立帳號", "寄出信件"] },
      { id: "n4", lane: 2, col: 4, kind: "action", label: ["開啟連結", "設定密碼"] },
      { id: "d2", lane: 1, col: 5, kind: "decision", label: ["連結", "可用？"] },
      { id: "n5", lane: 1, col: 6, kind: "system", end: true, label: ["完成設定", "可以登入"] },
      { id: "n6", lane: 2, col: 6, kind: "system", exception: true, end: true, label: ["顯示連結", "無法使用"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "d1" },
      { id: "e1", from: "d1", to: "n2", exception: true, label: "否", exit: "left", enter: "bottom" },
      { id: "a3", from: "d1", to: "n3", label: "是" },
      { id: "a4", from: "n3", to: "n4" },
      { id: "a5", from: "n4", to: "d2", exit: "right", enter: "left" },
      { id: "a6", from: "d2", to: "n5", label: "是" },
      { id: "e2", from: "d2", to: "n6", exception: true, label: "否", exit: "bottom", enter: "left" },
      { id: "e3", from: "n6", to: "n4", exception: true, exit: "bottom", enter: "bottom", via: laneBottom(2) - 8 },
    ],
    steps: [
      {
        title: "點擊「新增使用者」",
        body: "系統管理員在使用者管理分頁點擊「新增使用者」，系統顯示新增表單。",
        scenarios: [],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "填寫並點擊「儲存」",
        body: "系統管理員填寫姓名、Email 與系統角色後點擊「儲存」；表單沒有帳號狀態欄。",
        scenarios: ["表單沒有帳號狀態欄"],
        ref: "主流程 2",
        highlight: ["a1", "n2"],
      },
      {
        title: "例外：設定密碼信寄不出去",
        body: "不建立帳號，顯示「設定密碼信寄送失敗」，表單保留已填內容，系統管理員可以稍後再點一次「儲存」。",
        scenarios: ["新增時郵件服務無法寄信"],
        ref: "E1",
        highlight: ["a2", "d1", "e1", "n2"],
      },
      {
        title: "例外：Email 已存在",
        body: "Email 已被其他帳號使用（大小寫不同也算同一個）時無法儲存，顯示「Email 已存在」，表單不關閉。",
        scenarios: ["大小寫不同的同一信箱"],
        ref: "E2",
        highlight: ["a2", "d1", "e1", "n2"],
      },
      {
        title: "建立帳號並寄出設定密碼信",
        body: "系統寄出設定密碼信並建立帳號，顯示「使用者已建立」與「設定密碼信已寄出」；新帳號為啟用、尚未設定密碼。",
        scenarios: ["新增帳號成功"],
        ref: "主流程 2",
        highlight: ["a3", "n3"],
      },
      {
        title: "受邀的使用者開啟連結",
        body: "受邀的使用者開啟信中的連結並設定密碼；連結 24 小時內有效、只能使用一次。",
        scenarios: [],
        ref: "主流程 3",
        highlight: ["a4", "n4"],
      },
      {
        title: "完成設定",
        body: "連結可用時完成設定，對方之後可以用 Email 與密碼登入。",
        scenarios: ["受邀者在期限內設定密碼"],
        ref: "主流程 3",
        highlight: ["a5", "d2", "a6", "n5"],
      },
      {
        title: "例外：連結無法使用",
        body: "連結超過 24 小時、已用過或已因重發而作廢時，顯示「連結無法使用」，無法設定密碼，流程結束。",
        scenarios: ["開啟過期的連結", "連結使用兩次", "重發後開啟舊連結"],
        ref: "E3",
        highlight: ["a5", "d2", "e2", "n6"],
      },
      {
        title: "替代：重發設定密碼信",
        body: "系統管理員在該帳號那一列點擊「重發設定密碼信」，系統寄出新連結、舊連結作廢，顯示「設定密碼信已寄出」，受邀的使用者回到開啟連結這一步。",
        scenarios: ["重發設定密碼信成功"],
        ref: "A1",
        highlight: ["n6", "e3", "n4"],
      },
      {
        title: "結果：帳號可以登入",
        body: "列表多一個啟用中的帳號，受邀的使用者設定密碼後可以登入；異動紀錄多一筆「新增」。",
        scenarios: ["五種異動各留一筆"],
        ref: "結果",
        highlight: ["n5"],
      },
    ],
  },
  {
    id: "deactivate",
    label: "停用帳號",
    trigger: "成員離開平台，或帳號有外流風險，系統管理員要讓它立即無法使用",
    result: "帳號為停用，無法登入；重新啟用時停用前的登入狀態不會恢復；異動紀錄多一筆「停用」",
    lanes: ["系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點「停用」"] },
      { id: "d1", lane: 1, col: 1, kind: "decision", label: ["Seeder", "管理員？"] },
      { id: "xb", lane: 1, col: 2, kind: "system", exception: true, end: true, label: ["擋下", "維持啟用"] },
      { id: "d2", lane: 0, col: 3, kind: "decision", label: ["確定", "停用？"] },
      { id: "x2", lane: 0, col: 4, kind: "action", exception: true, end: true, label: ["點「取消」", "維持啟用"] },
      { id: "d3", lane: 1, col: 3, kind: "decision", label: ["保留一位", "管理員？"] },
      { id: "n3", lane: 1, col: 4, kind: "system", end: true, label: ["標示停用", "登入失效"] },
      { id: "x4", lane: 0, col: 5, kind: "system", exception: true, end: true, label: ["自己登出", "回登入頁"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "d1", exit: "bottom", enter: "left" },
      { id: "e1", from: "d1", to: "xb", exception: true, label: "是" },
      { id: "a2", from: "d1", to: "d2", label: "否", exit: "top", enter: "left" },
      { id: "e2", from: "d2", to: "x2", exception: true, label: "否" },
      { id: "a3", from: "d2", to: "d3", label: "是" },
      { id: "e3", from: "d3", to: "xb", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "a4", from: "d3", to: "n3", label: "是" },
      { id: "e4", from: "n3", to: "x4", exception: true },
    ],
    steps: [
      {
        title: "點擊「停用」",
        body: "系統管理員在目標帳號那一列點擊「停用」；目標帳號為啟用中。",
        scenarios: [],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "例外：目標是 Seeder 管理員",
        body: "Seeder 管理員那一列的「停用」不可用並說明原因；不經過頁面停用也會被擋下。流程結束。",
        scenarios: ["停用 Seeder 管理員"],
        ref: "E1",
        highlight: ["a1", "d1", "e1", "xb"],
      },
      {
        title: "顯示確認視窗",
        body: "系統顯示「確定要停用 {姓名} 的帳號嗎？」，並說明停用後對方會立即無法登入。",
        scenarios: [],
        ref: "主流程 1",
        highlight: ["a1", "d1", "a2", "d2"],
      },
      {
        title: "替代：點擊「取消」",
        body: "關閉確認視窗，帳號維持啟用；停用的是自己時也一樣停在列表。流程結束。",
        scenarios: ["取消停用他人的帳號", "取消停用自己"],
        ref: "A1",
        highlight: ["d2", "e2", "x2"],
      },
      {
        title: "例外：會沒有啟用中的系統管理員",
        body: "停用後平台會沒有任何啟用中的系統管理員時，系統擋下，帳號維持啟用；兩人同時停用對方也只有一個成功。流程結束。",
        scenarios: ["停用最後一位系統管理員", "兩位系統管理員同時停用對方"],
        ref: "E2",
        highlight: ["a3", "d3", "e3", "xb"],
      },
      {
        title: "停用成功",
        body: "系統把帳號標示為停用並留在列表，對方目前的登入狀態立即失效，顯示「帳號已停用」。",
        scenarios: ["停用登入中的帳號"],
        ref: "主流程 2",
        highlight: ["a3", "d3", "a4", "n3"],
      },
      {
        title: "替代：停用的是自己",
        body: "確認後自己立即登出並回到登入頁，不回到列表。流程結束。",
        scenarios: ["確認停用自己"],
        ref: "A2",
        highlight: ["n3", "e4", "x4"],
      },
      {
        title: "結果：帳號無法登入",
        body: "帳號為停用，無法登入；之後重新啟用時，停用前的登入狀態不會恢復。異動紀錄多一筆「停用」。",
        scenarios: ["啟用停用中的帳號"],
        ref: "結果",
        highlight: ["n3"],
      },
    ],
  },
  {
    id: "change-role",
    label: "變更系統角色",
    trigger: "成員的職責改變，要升為系統管理員或降為平台成員",
    result: "帳號的系統角色已更新並立即生效；異動紀錄多一筆「角色變更」",
    lanes: ["系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點「編輯」"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["顯示編輯", "使用者表單"] },
      { id: "n3", lane: 0, col: 2, kind: "action", label: ["改系統角色", "點「儲存」"] },
      { id: "d1", lane: 1, col: 3, kind: "decision", label: ["保護規則", "通過？"] },
      { id: "n4", lane: 1, col: 4, kind: "system", label: ["顯示帳號", "資訊已更新"] },
      { id: "n5", lane: 1, col: 5, kind: "system", end: true, label: ["下一次", "操作起生效"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "d1", exit: "right", enter: "left" },
      { id: "e1", from: "d1", to: "n3", exception: true, label: "否", exit: "top", enter: "top", via: laneTop(0) + 12 },
      { id: "a4", from: "d1", to: "n4", label: "是" },
      { id: "a5", from: "n4", to: "n5" },
    ],
    steps: [
      {
        title: "點擊「編輯」",
        body: "系統管理員在目標帳號那一列點擊「編輯」。",
        scenarios: [],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "顯示「編輯使用者」表單",
        body: "表單帶入目前的姓名、Email 與系統角色；沒有帳號狀態欄，也沒有任何指派任務角色的欄位。",
        scenarios: ["表單沒有帳號狀態欄", "本頁沒有任務角色"],
        ref: "主流程 1",
        highlight: ["a1", "n2"],
      },
      {
        title: "改選系統角色並點擊「儲存」",
        body: "系統管理員把系統角色改為平台成員或系統管理員後點擊「儲存」。",
        scenarios: [],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "例外：會失去管理者",
        body: "把 Seeder 管理員或最後一位啟用中的系統管理員降為平台成員時，系統擋下，角色不變，表單保留。",
        scenarios: ["降級 Seeder 管理員", "降級最後一位系統管理員"],
        ref: "E1",
        highlight: ["a3", "d1", "e1", "n3"],
      },
      {
        title: "儲存成功",
        body: "系統儲存並顯示「帳號資訊已更新」，列表顯示新的系統角色。",
        scenarios: ["變更系統角色"],
        ref: "主流程 2",
        highlight: ["a3", "d1", "a4", "n4"],
      },
      {
        title: "對方下一次操作起生效",
        body: "對方的下一次操作就依新的系統角色判斷能做什麼；被降為平台成員的人無法再進入使用者管理頁，不必等登入狀態到期。",
        scenarios: ["被降級的系統管理員以有效憑證讀取", "被降級的系統管理員送出異動"],
        ref: "主流程 3",
        highlight: ["a5", "n5"],
      },
      {
        title: "結果：角色已更新",
        body: "帳號的系統角色已更新並立即生效；異動紀錄多一筆「角色變更」。",
        scenarios: ["五種異動各留一筆"],
        ref: "結果",
        highlight: ["n5"],
      },
    ],
  },
];

export default function Spec0601AccountLifecycleFlow(): ReactElement {
  return <FlowShell flows={FLOWS} />;
}
