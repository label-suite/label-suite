import { useRef, useEffect, useState, type KeyboardEvent, type ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * PRD 共用狀態機：商機狀態與推進各轉移的模組。
 * 模組篩選只亮起該模組推進的轉移；點狀態在下方面板看進入與離開的條件。
 * 黃色虛線是尚未拍板（待確認）的轉移。
 */

/* ============================================================ 【骨架】色票與型別 */

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
const FONT = "'Inter','Noto Sans TC','PingFang TC',-apple-system,sans-serif"; // --font-sans
const DIM = 0.28;

interface Module {
  id: string;
  label: string;
  color: string;
}

interface State {
  id: string;
  label: string;
  x: number;
  y: number;
  /** 起點只畫小圓 */
  start?: boolean;
  /** 結束狀態畫雙框 */
  final?: boolean;
  desc?: string;
}

interface Transition {
  id: string;
  from: string;
  to: string;
  /** 圖上的短標籤 */
  label: string;
  /** 面板裡的完整觸發條件 */
  trigger: string;
  module: string;
  /** 垂直於連線方向的彎曲量；正值往行進方向左側彎 */
  bend?: number;
  /** 標籤沿法線方向的偏移 */
  labelOffset?: number;
  pending?: boolean;
}

/* ============================================================ 【資料】模組、狀態、轉移 */

const VB_W = 780;
const VB_H = 330;

const MODULES: Module[] = [
  { id: "m02", label: "02 商機管理", color: "#047857" },
  { id: "m03", label: "03 報價管理", color: "#1D4ED8" },
  { id: "m01", label: "01 客戶管理", color: "#6366F1" },
];

const STATES: State[] = [
  { id: "start", label: "建立", x: 44, y: 120, start: true },
  { id: "dev", label: "開發中", x: 236, y: 120, desc: "商機剛建立，或報價單未被接受、退回重來。" },
  { id: "quote", label: "報價中", x: 472, y: 120, desc: "至少有一張已送出、還沒有客戶回覆的有效報價單。" },
  { id: "won", label: "成交", x: 700, y: 120, final: true, desc: "客戶接受報價，結束狀態，不能改回進行中。" },
  { id: "lost", label: "失敗", x: 354, y: 268, final: true, desc: "管理員放棄這個商機，結束狀態，不能改回進行中。" },
];

const TRANSITIONS: Transition[] = [
  { id: "t1", from: "start", to: "dev", label: "建立商機", trigger: "為往來中的客戶建立商機", module: "m02", labelOffset: 14 },
  { id: "t2", from: "dev", to: "quote", label: "送出報價單", trigger: "送出報價單", module: "m03", labelOffset: 14 },
  { id: "t3", from: "quote", to: "dev", label: "未接受或作廢", trigger: "報價單未接受或作廢，且沒有其他有效報價單", module: "m03", bend: 78, labelOffset: 12 },
  { id: "t4", from: "quote", to: "won", label: "客戶接受", trigger: "記錄客戶接受報價", module: "m03", labelOffset: 14 },
  { id: "t5", from: "dev", to: "lost", label: "結案為失敗", trigger: "管理員在商機詳情結案為失敗", module: "m02", labelOffset: -16 },
  { id: "t6", from: "quote", to: "lost", label: "結案為失敗", trigger: "管理員在商機詳情結案為失敗", module: "m02", labelOffset: 16 },
  { id: "t7", from: "dev", to: "lost", label: "停止往來？", trigger: "客戶改為停止往來（是否自動改為失敗，待確認）", module: "m01", bend: 70, labelOffset: -14, pending: true },
  { id: "t8", from: "quote", to: "lost", label: "停止往來？", trigger: "客戶改為停止往來（是否自動改為失敗，待確認）", module: "m01", bend: -70, labelOffset: 14, pending: true },
];

const DEFAULT_STATE = "quote";

/* ============================================================ 【骨架】幾何 */

const PILL_W = 116;
const PILL_H = 44;

interface Pt {
  x: number;
  y: number;
}

function stateById(id: string): State {
  return STATES.find((s) => s.id === id) ?? STATES[0];
}

/** 從狀態中心往 toward 方向，算出和外框的交點 */
function clip(s: State, toward: Pt): Pt {
  const dx = toward.x - s.x;
  const dy = toward.y - s.y;
  if (s.start) {
    const len = Math.hypot(dx, dy) || 1;
    return { x: s.x + (dx / len) * 8, y: s.y + (dy / len) * 8 };
  }
  const hw = PILL_W / 2 + 3;
  const hh = PILL_H / 2 + 3;
  const t = Math.min(dx === 0 ? Infinity : hw / Math.abs(dx), dy === 0 ? Infinity : hh / Math.abs(dy));
  return { x: s.x + dx * t, y: s.y + dy * t };
}

function geometry(t: Transition): { d: string; label: Pt } {
  const a = stateById(t.from);
  const b = stateById(t.to);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const bend = t.bend ?? 0;
  const ctrl = { x: mx + nx * bend * 2, y: my + ny * bend * 2 };
  const p0 = clip(a, bend === 0 ? b : ctrl);
  const p1 = clip(b, bend === 0 ? a : ctrl);
  const d = bend === 0 ? `M${p0.x},${p0.y} L${p1.x},${p1.y}` : `M${p0.x},${p0.y} Q${ctrl.x},${ctrl.y} ${p1.x},${p1.y}`;
  const peak = bend === 0 ? { x: mx, y: my } : { x: 0.25 * p0.x + 0.5 * ctrl.x + 0.25 * p1.x, y: 0.25 * p0.y + 0.5 * ctrl.y + 0.25 * p1.y };
  const off = t.labelOffset ?? 12;
  return { d, label: { x: peak.x + nx * -off, y: peak.y + ny * -off } };
}

function moduleOf(id: string): Module {
  return MODULES.find((m) => m.id === id) ?? MODULES[0];
}

/* ============================================================ 【骨架】圖形 */

function StateShape({ s, selected, onSelect }: { s: State; selected: boolean; onSelect: () => void }): ReactElement {
  const onKey = (e: KeyboardEvent<SVGGElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };
  if (s.start) {
    return (
      <g>
        <circle cx={s.x} cy={s.y} r={8} fill={INK} />
        <text x={s.x} y={s.y + 26} textAnchor="middle" fontSize={11} fill={MUTED} fontFamily={FONT}>
          {s.label}
        </text>
      </g>
    );
  }
  const x = s.x - PILL_W / 2;
  const y = s.y - PILL_H / 2;
  return (
    <g role="button" tabIndex={0} aria-label={`狀態：${s.label}`} aria-pressed={selected} onClick={onSelect} onKeyDown={onKey} style={{ cursor: "pointer", outline: "none" }}>
      <rect x={x} y={y} width={PILL_W} height={PILL_H} rx={PILL_H / 2} fill={selected ? PRIMARY_SOFT : "#ffffff"} stroke={selected ? PRIMARY : INK} strokeWidth={selected ? 2 : 1.3} />
      {s.final && <rect x={x + 4} y={y + 4} width={PILL_W - 8} height={PILL_H - 8} rx={(PILL_H - 8) / 2} fill="none" stroke={selected ? PRIMARY : INK} strokeWidth={1} />}
      <text x={s.x} y={s.y + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill={INK} fontFamily={FONT}>
        {s.label}
      </text>
    </g>
  );
}

function TransitionLine({ t, dim, emphasize }: { t: Transition; dim: boolean; emphasize: boolean }): ReactElement {
  const { d, label } = geometry(t);
  const mod = moduleOf(t.module);
  const color = t.pending ? WARNING : emphasize ? PRIMARY : FAINT;
  const textW = t.label.length * 12 + 18;
  return (
    <g style={{ opacity: dim ? DIM : 1, transition: "opacity 200ms ease-out" }}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={emphasize ? 2.2 : 1.4}
        strokeDasharray={t.pending ? "5 4" : undefined}
        markerEnd={`url(#pos-arrow-${t.pending ? "ex" : emphasize ? "on" : "off"})`}
      />
      <rect x={label.x - textW / 2} y={label.y - 10} width={textW} height={20} rx={10} fill={t.pending ? WARNING_BG : "#ffffff"} stroke={t.pending ? WARNING : LINE} />
      <circle cx={label.x - textW / 2 + 9} cy={label.y} r={3.5} fill={mod.color} />
      <text x={label.x + 5} y={label.y + 4} textAnchor="middle" fontSize={11} fill={t.pending ? WARNING_TEXT : TEXT} fontFamily={FONT}>
        {t.label}
      </text>
    </g>
  );
}

function Chip({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? color : LINE_2}`,
        background: active ? color : "#ffffff",
        color: active ? "#ffffff" : TEXT,
        fontSize: 13,
        fontFamily: FONT,
        cursor: "pointer",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: active ? "#ffffff" : color }} />
      {label}
    </button>
  );
}

function TransitionRow({ t }: { t: Transition }): ReactElement {
  const mod = moduleOf(t.module);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 10, padding: "7px 0", borderTop: `1px solid ${LINE}`, alignItems: "baseline" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>
        {stateById(t.from).label} → {stateById(t.to).label}
      </span>
      <span style={{ fontSize: 13, color: t.pending ? WARNING_TEXT : TEXT, lineHeight: 1.6 }}>{t.trigger}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: mod.color }} />
        {mod.label}
        {t.pending && <span style={{ color: WARNING_TEXT, fontWeight: 700 }}>待確認</span>}
      </span>
    </div>
  );
}

/* ============================================================ 【骨架】外殼 */

export default function PrdOpportunityState(): ReactElement {
  const reduce = useReducedMotion();
  // 第一次 render（含 SSR）直接呈現終態，之後切換時才播放進場
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const [mod, setMod] = useState<string | null>(null);
  const [sel, setSel] = useState<string>(DEFAULT_STATE);
  const state = stateById(sel);
  const incoming = TRANSITIONS.filter((t) => t.to === sel);
  const outgoing = TRANSITIONS.filter((t) => t.from === sel);
  const marker = (id: string, color: string): ReactElement => (
    <marker id={`pos-arrow-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill={color} />
    </marker>
  );

  return (
    <div className="not-prose" style={{ width: "100%", fontFamily: FONT, display: "grid", gap: 12 }}>
      <div role="group" aria-label="依推進的模組篩選" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Chip label="全部" color={INK} active={mod === null} onClick={() => setMod(null)} />
        {MODULES.map((m) => (
          <Chip key={m.id} label={m.label} color={m.color} active={mod === m.id} onClick={() => setMod(mod === m.id ? null : m.id)} />
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" role="img" aria-label="商機狀態機：各狀態與推進轉移的模組" style={{ minWidth: 620, display: "block" }}>
          <defs>
            {marker("off", FAINT)}
            {marker("on", PRIMARY)}
            {marker("ex", WARNING)}
          </defs>
          <rect x={0.5} y={0.5} width={VB_W - 1} height={VB_H - 1} fill="#ffffff" stroke={LINE} rx={6} />
          {TRANSITIONS.map((t) => {
            const touchesSel = t.from === sel || t.to === sel;
            const dim = mod !== null ? t.module !== mod : false;
            return <TransitionLine key={t.id} t={t} dim={dim} emphasize={mod !== null ? t.module === mod : touchesSel} />;
          })}
          {STATES.map((s) => (
            <StateShape key={s.id} s={s} selected={s.id === sel} onSelect={() => setSel(s.id)} />
          ))}
        </svg>
      </div>
      <motion.div
        key={sel}
        initial={reduce || !mounted.current ? false : { opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "12px 14px", minHeight: 210, background: "#ffffff" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>{state.label}</span>
          {state.final && <span style={{ fontSize: 12, color: MUTED }}>結束狀態</span>}
        </div>
        <div style={{ fontSize: 13, color: TEXT, marginBottom: 8 }}>{state.desc}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>進入</div>
        {incoming.map((t) => (
          <TransitionRow key={t.id} t={t} />
        ))}
        <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>離開</div>
        {outgoing.length === 0 ? <div style={{ fontSize: 13, color: FAINT, padding: "7px 0", borderTop: `1px solid ${LINE}` }}>無（結束狀態）</div> : outgoing.map((t) => <TransitionRow key={t.id} t={t} />)}
      </motion.div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 12, color: MUTED }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width={30} height={16} aria-hidden="true">
            <rect x={1} y={1} width={28} height={14} rx={7} fill="#ffffff" stroke={INK} />
            <rect x={4} y={4} width={22} height={8} rx={4} fill="none" stroke={INK} />
          </svg>
          結束狀態
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width={28} height={10} aria-hidden="true">
            <path d="M1,5 H27" stroke={WARNING} strokeDasharray="5 4" strokeWidth={1.4} />
          </svg>
          待確認的轉移
        </span>
        <span>標籤前的色點：推進這個轉移的模組</span>
      </div>
    </div>
  );
}
