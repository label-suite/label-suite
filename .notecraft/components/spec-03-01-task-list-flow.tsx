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

/* ================================================================ 【流程】依規格填寫（規格 03-01 任務列表） ================================================================ */

const FLOWS: Flow[] = [
  {
    id: "enter-list",
    label: "進到任務列表",
    trigger: "使用者從側欄點「任務管理」",
    result: "使用者看到一張他有權限看到的任務列表；沒有任務或載入失敗時，表頭留著，兩種情況長得不一樣",
    lanes: ["平台成員或系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點「任務", "管理」"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["依角色載", "入任務"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["載入", "成功？"] },
      { id: "n4", lane: 1, col: 3, kind: "decision", label: ["有任務？"] },
      { id: "n5", lane: 1, col: 4, kind: "system", end: true, label: ["顯示任務", "列表"] },
      { id: "n6", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["保留表頭", "尚無任務"] },
      { id: "n7", lane: 1, col: 6, kind: "system", exception: true, end: true, label: ["保留表頭", "載入失敗"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "a4", from: "n4", to: "n5", label: "是" },
      { id: "e1", from: "n4", to: "n6", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "e2", from: "n3", to: "n7", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 3 },
    ],
    steps: [
      {
        title: "從側欄點「任務管理」",
        body: "任何已登入的平台成員都進得了這一頁，看得到的內容才依角色而定。",
        scenarios: [],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "系統依角色載入任務",
        body: "平台成員只載入自己參與的任務——他是該任務的專案負責人、審核員或標記員其中之一。沒有參與的任務從頭就不在這張列表上，不是被隱藏，而是沒有載入。",
        scenarios: ["平台成員只看到自己參與的任務", "成員資格失效後看不到那個任務"],
        ref: "主流程 2",
        highlight: ["a1", "n2"],
      },
      {
        title: "替代：使用者是系統管理員",
        body: "系統管理員載入全平台的所有任務，不限自己有沒有參與。畫面上沒有「我的任務／全平台任務」切換，因為他看到的本來就是全部。",
        scenarios: ["系統管理員看到所有任務", "系統管理員沒有檢視切換"],
        ref: "A1",
        highlight: ["n2"],
      },
      {
        title: "載入成功了嗎",
        body: "成功與失敗要分得開，使用者看得出來現在是沒有資料還是讀不到資料。",
        scenarios: [],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "例外：列表載入失敗",
        body: "表頭留著，表格內顯示載入失敗與「重試」，不顯示成空資料——使用者不會把讀不到誤判成沒有任務。重試時那筆任務已經被別人封存的話，重試後的列表上就不會有它。流程結束。",
        scenarios: ["列表載入失敗", "載入失敗後重試", "重試時任務已被別人封存"],
        ref: "E1",
        highlight: ["n3", "e2", "n7"],
      },
      {
        title: "有任務嗎",
        body: "載入成功之後才問這一題。平台成員問的是自己參與的任務，系統管理員問的是全平台。",
        scenarios: [],
        ref: "主流程 3",
        highlight: ["a3", "n4"],
      },
      {
        title: "替代：完全沒有任務",
        body: "表頭留著，表格內顯示尚無任務；整頁只保留那一顆「新增任務」，不出現分頁列。系統管理員在全平台都沒有任務時看到的是同一個狀態。流程結束。",
        scenarios: ["完全沒有任務", "系統管理員在全平台都沒有任務", "空狀態不顯示分頁列", "尚無任務時只有一顆新增"],
        ref: "A2",
        highlight: ["n4", "e1", "n6"],
      },
      {
        title: "結果：看到一張自己有權限看到的列表",
        body: "列表顯示出來，預設依更新時間由新到舊排序。接下來就是把它篩到要處理的那幾筆。",
        scenarios: ["預設依更新時間由新到舊"],
        ref: "結果",
        highlight: ["a4", "n5"],
      },
    ],
  },
  {
    id: "filter-list",
    label: "篩到要處理的那一筆",
    trigger: "列表已經顯示出來",
    result: "使用者看到他要處理的那幾筆；查詢條件留在網址上，重新整理或分享都還原得回來",
    lanes: ["平台成員或系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["輸入關鍵字", "或篩選"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["更新列表", "回第一頁"] },
      { id: "n3", lane: 1, col: 2, kind: "decision", label: ["有符合", "的？"] },
      { id: "n4", lane: 1, col: 3, kind: "system", end: true, label: ["看到要處理", "的那一筆"] },
      { id: "n5", lane: 1, col: 4, kind: "system", exception: true, label: ["空結果與", "清除篩選"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2", enter: "left" },
      { id: "a2", from: "n2", to: "n3" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "e1", from: "n3", to: "n5", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "a4", from: "n5", to: "n2", exception: true, exit: "top", enter: "top", via: laneTop(1) + 12 },
    ],
    steps: [
      {
        title: "輸入關鍵字或套用篩選",
        body: "關鍵字只要部分符合就算命中，而且比對的是畫面上目前這個語言的文字——切換語言之後，要用新語言的字才搜得到。",
        scenarios: ["關鍵字部分符合", "用畫面上的狀態文字搜尋", "切換語言後用新語言的字搜尋", "搜尋只比對目前語言", "選一種輸出類型", "標記階段篩選只有兩個選項"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "更新列表、回到第一頁，再看有沒有符合的",
        body: "列表當場更新，頁次回到第一頁，查詢條件同時寫進網址。換頁不會把篩選條件弄掉，改每頁筆數會再回到第一頁。網址上的值無效時退回預設，不報錯。",
        scenarios: ["套用篩選後回到第一頁", "換頁保留篩選條件", "改每頁筆數回到第一頁", "重新整理還原查詢條件", "網址上的篩選值無效", "網址上的頁次無效", "網址上的每頁筆數無效"],
        ref: "主流程 2",
        highlight: ["a1", "n2", "a2", "n3"],
      },
      {
        title: "替代：篩選後沒有符合的任務",
        body: "表頭留著，表格內顯示找不到符合條件的任務與「清除所有篩選」，而且不出現分頁列。使用者點清除就回到沒有篩選的列表，回到更新列表那一步。有條件時才看得到清除，沒有條件時它不出現。",
        scenarios: ["篩選後沒有結果", "從空結果一鍵清除", "清除所有篩選", "有條件時才出現清除", "沒有條件時不顯示清除"],
        ref: "A1",
        highlight: ["n3", "e1", "n5", "a4", "n2"],
      },
      {
        title: "結果：看到要處理的那幾筆",
        body: "複合任務在多個篩選結果裡都出現得到；草稿任務的標記階段欄顯示未建立清單。查詢條件留在網址上，重新整理或把連結分享出去都還原得回來。",
        scenarios: ["複合任務出現在多個篩選結果", "草稿任務的標記階段欄顯示未建立清單", "重新整理還原查詢條件", "這一頁看不到標記結果"],
        ref: "結果",
        highlight: ["a3", "n4"],
      },
    ],
  },
  {
    id: "open-detail",
    label: "從列表進入任務詳情",
    trigger: "使用者點任務列，或點那一列的「編輯」",
    result: "使用者前往下一頁；被擋下時停在這一頁，列表還在",
    lanes: ["平台成員或系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點任務列", "或「編輯」"] },
      { id: "n2", lane: 1, col: 1, kind: "decision", label: ["看得了", "詳情？"] },
      { id: "n3", lane: 1, col: 2, kind: "system", end: true, label: ["前往任務", "詳情"] },
      { id: "n4", lane: 1, col: 3, kind: "system", exception: true, end: true, label: ["停在列表", "顯示無權限"] },
      { id: "n5", lane: 0, col: 2, kind: "action", exception: true, label: ["點「新增", "任務」"] },
      { id: "n6", lane: 1, col: 4, kind: "system", exception: true, end: true, label: ["前往新增", "任務"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", label: "是" },
      { id: "e1", from: "n2", to: "n4", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
      { id: "a3", from: "n1", to: "n5", exception: true, exit: "top", enter: "top", via: laneTop(0) + 16 },
      { id: "a4", from: "n5", to: "n6", exception: true },
    ],
    steps: [
      {
        title: "點任務列或那一列的「編輯」",
        body: "整列都點得到，「編輯」也到同一個地方；兩條路進去的是同一頁。",
        scenarios: ["點任務列進入任務詳情", "點編輯進入任務詳情"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1"],
      },
      {
        title: "看得了這個任務的詳情嗎",
        body: "列表上看得到不等於詳情看得了。這一題由詳情那一頁的權限決定，不是由列表決定。",
        scenarios: [],
        ref: "主流程 2",
        highlight: ["a1", "n2"],
      },
      {
        title: "例外：看不了詳情",
        body: "停在這一頁並顯示無權限檢視任務詳情，不跳頁、列表還在。從詳情那一頁被退回來的時候也要有說明，不能無聲地回到列表。流程結束。",
        scenarios: ["沒有權限時停在列表", "從詳情被退回也要有說明"],
        ref: "E1",
        highlight: ["n2", "e1", "n4"],
      },
      {
        title: "替代：點「新增任務」",
        body: "這是另一個離開這一頁的出口，前往新增任務，和上面那一條互不相干。流程結束。",
        scenarios: ["點新增任務", "尚無任務時只有一顆新增"],
        ref: "A1",
        highlight: ["a3", "n5", "a4", "n6"],
      },
      {
        title: "結果：前往任務詳情",
        body: "使用者離開這一頁、進到那個任務的詳情。流程結束。",
        scenarios: ["點任務列進入任務詳情"],
        ref: "結果",
        highlight: ["a2", "n3"],
      },
    ],
  },
  {
    id: "delete-draft",
    label: "刪除草稿任務",
    trigger: "使用者點某一列的「刪除」",
    result: "任務移到封存，資料留著供查核；這一版沒有復原入口，而任何被擋下或取消的情況都不會改變任務",
    lanes: ["平台成員或系統管理員", "系統"],
    nodes: [
      { id: "s", lane: 0, col: 0, kind: "start", label: [] },
      { id: "n1", lane: 0, col: 0, kind: "action", label: ["點「刪除」"] },
      { id: "n7", lane: 1, col: 0, kind: "system", exception: true, end: true, label: ["不顯示可", "用的刪除"] },
      { id: "n2", lane: 1, col: 1, kind: "system", label: ["顯示確認", "視窗"] },
      { id: "n3", lane: 0, col: 2, kind: "decision", label: ["確認", "刪除？"] },
      { id: "n4", lane: 1, col: 3, kind: "system", label: ["送出刪除"] },
      { id: "n5", lane: 1, col: 4, kind: "system", end: true, label: ["移到封存", "從列表消失"] },
      { id: "n6", lane: 0, col: 4, kind: "action", exception: true, end: true, label: ["任務不變", "回到列表"] },
      { id: "n8", lane: 1, col: 5, kind: "system", exception: true, end: true, label: ["仍在列表", "說明可重試"] },
    ],
    edges: [
      { id: "a0", from: "s", to: "n1" },
      { id: "e1", from: "n1", to: "n7", exception: true },
      { id: "a1", from: "n1", to: "n2" },
      { id: "a2", from: "n2", to: "n3", enter: "left" },
      { id: "a3", from: "n3", to: "n4", label: "是" },
      { id: "a4", from: "n3", to: "n6", exception: true, label: "否", exit: "bottom", enter: "bottom", via: laneBottom(0) - 8 },
      { id: "a5", from: "n4", to: "n5" },
      { id: "e2", from: "n4", to: "n8", exception: true, exit: "bottom", enter: "bottom", via: laneBottom(1) - 8 },
    ],
    steps: [
      {
        title: "點「刪除」，系統顯示確認視窗",
        body: "刪除一定要先確認，不會一點就刪。視窗內容指名那個任務，而且不承諾可以復原——它的說法是移到封存。",
        scenarios: ["刪除要先確認", "確認視窗不承諾可以復原"],
        ref: "主流程 1",
        highlight: ["s", "a0", "n1", "a1", "n2"],
      },
      {
        title: "例外：任務不是草稿或沒有刪除權限",
        body: "那一列不顯示可用的刪除。這個限制擋的是能力本身，不是只把按鈕藏起來——刪除不能由別的權限間接取得，若刪除仍被觸發就擋下並顯示對應提示。流程結束。",
        scenarios: ["不是草稿時沒有可用的刪除", "沒有刪除權限時沒有可用的刪除", "刪除不能由別的權限間接取得"],
        ref: "E1",
        highlight: ["e1", "n7"],
      },
      {
        title: "使用者在確認視窗做決定",
        body: "確認或取消，兩個出口都要有下文。系統管理員刪得掉自己進不去的草稿任務，因為刪除看的是系統角色，不是任務角色。",
        scenarios: ["系統管理員刪除自己進不去的草稿任務", "系統管理員可以刪除草稿任務"],
        ref: "主流程 2",
        highlight: ["a2", "n3"],
      },
      {
        title: "替代：在確認視窗取消",
        body: "點「取消」、點視窗外面，或按 Esc 都算取消。視窗關閉，任務完全不變，使用者回到列表。流程結束。",
        scenarios: ["在確認視窗取消刪除", "按 Esc 關閉確認視窗"],
        ref: "A1",
        highlight: ["n3", "a4", "n6"],
      },
      {
        title: "確認之後送出刪除",
        body: "送出的是封存，不是把資料清掉；資料留著供查核，但這一版沒有復原入口。",
        scenarios: ["刪除草稿任務"],
        ref: "主流程 3",
        highlight: ["a3", "n4"],
      },
      {
        title: "例外：送出之後失敗",
        body: "任務仍在列表上，顯示刪除未完成與可以重試的說明，不會讓使用者以為已經刪掉了。流程結束。",
        scenarios: ["刪除送出之後失敗"],
        ref: "E2",
        highlight: ["e2", "n8"],
      },
      {
        title: "結果：移到封存，資料留著供查核",
        body: "任務從列表消失並顯示已移至封存，之後不再出現在列表上；拿舊連結打開已封存的任務時，看到的和不存在的任務是同一句話。封存的意思是資料留著供查核，但這一版平台上沒有任何角色有復原的入口，所以確認視窗也不向使用者承諾可以復原。流程結束。",
        scenarios: ["封存後不再出現", "用舊連結打開已封存的任務"],
        ref: "結果",
        highlight: ["a5", "n5"],
      },
    ],
  },
];

export default function Spec0301TaskListFlow(): ReactElement {
  return <FlowShell flows={FLOWS} />;
}
