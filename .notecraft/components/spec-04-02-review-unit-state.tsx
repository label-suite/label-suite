import { useRef, useEffect, useState, type KeyboardEvent, type ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * 規格 04-02 審核單位狀態機：四個節點、每條轉換的觸發條件（爭議中到已定稿有三條），以及規格寫明不存在的轉換。
 * 從 prd-writing 的 state-machine-skeleton.tsx 複製；外殼的字面由「推進的模組」改成「誰的動作」，
 * 並在下方加一份「不存在的轉換」清單，其餘幾何與圖形不變。
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

/* ============================================================ 【資料】角色、狀態、轉換（規格 04-02 審核單位） */

const VB_W = 780;
const VB_H = 330;

const MODULES: Module[] = [
  { id: "annotator", label: "標記員", color: "#1D4ED8" }, // --color-info
  { id: "reviewer", label: "審核員", color: "#047857" }, // --color-cta
  { id: "arbiter", label: "仲裁者", color: "#8B5CF6" }, // --color-file-markdown
  { id: "leader", label: "專案負責人", color: "#818CF8" }, // --color-secondary
];

const STATES: State[] = [
  { id: "none", label: "不成立", x: 90, y: 110, desc: "標記員還沒提交這一筆，審核單位不成立；脈絡橫幅的狀態整個換成「尚無標記提交」。" },
  { id: "pending", label: "待審", x: 330, y: 110, desc: "標記員已提交，指派的那一位審核員還沒送出。還沒送出的決策草稿不計入狀態。" },
  { id: "dispute", label: "爭議中", x: 640, y: 110, desc: "審核員的決策有修正或無法裁決，修正還沒生效，等仲裁定案。仲裁選了兩者皆非的項目落入最終例外池，單位維持爭議中，直到例外池收尾。離開爭議中有三條路：仲裁定案、例外池收尾、當事審核員在還沒有仲裁票時改判為全部通過。" },
  { id: "final", label: "已定稿", x: 485, y: 270, final: true, desc: "終態：單位全面唯讀，沒有決策、修正與送出，也沒有任何解鎖入口。" },
];

const TRANSITIONS: Transition[] = [
  { id: "t1", from: "none", to: "pending", label: "提交", trigger: "標記員提交這一筆；系統指派恰好一位審核員", module: "annotator", labelOffset: 14 },
  { id: "t2", from: "pending", to: "final", label: "全部通過", trigger: "指派的審核員送出，逐項決策全部是通過，而且沒有改過答案", module: "reviewer", labelOffset: 16 },
  { id: "t3", from: "pending", to: "dispute", label: "修正或無法裁決", trigger: "審核員送出，任一項是修正或無法裁決；選了通過但答案和標記員的不同也算", module: "reviewer", labelOffset: 14 },
  { id: "t4", from: "dispute", to: "final", label: "仲裁定案", trigger: "所有爭議項都由仲裁採 A 或採 B 定案（任務沒有啟用中的仲裁者時，由專案負責人裁定）", module: "arbiter", bend: 34, labelOffset: 16 },
  { id: "t6", from: "dispute", to: "final", label: "當事人改判", trigger: "單位還沒有任何仲裁票時，當事審核員按「修改我的審核」改判，送出後逐項全部是通過；依五句判定式推導為已定稿（維護者 2026-11-24 裁定）", module: "reviewer", labelOffset: 0 },
  { id: "t5", from: "dispute", to: "final", label: "例外池收尾", trigger: "落入最終例外池的項目全部由專案負責人收尾（採用標記員答案、採用審核員答案、自訂答案或排除於資料集），而且其餘爭議項都已定案", module: "leader", bend: -34, labelOffset: -16 },
];

/** 規格寫明不存在的轉換，列在圖下方 */
const FORBIDDEN: { from: string; to: string; why: string }[] = [
  { from: "已定稿", to: "任何狀態", why: "已定稿是終態，這一頁不發明任何解鎖入口" },
  { from: "爭議中", to: "待審", why: "狀態只有單一欄位、線性推進" },
  { from: "任何狀態", to: "退回重標", why: "退回不在三向決策裡，兩個標記階段都不得出現" },
  { from: "待審", to: "中繼狀態", why: "曾經有的兩個中繼狀態與人數門檻都已移除，一個單位恰有一位指派審核員" },
  { from: "決策草稿", to: "任何狀態", why: "還沒送出的草稿不計入狀態" },
];

const DEFAULT_STATE = "dispute";

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

export default function Spec0402ReviewUnitState(): ReactElement {
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
      <div role="group" aria-label="依誰的動作篩選" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Chip label="全部" color={INK} active={mod === null} onClick={() => setMod(null)} />
        {MODULES.map((m) => (
          <Chip key={m.id} label={m.label} color={m.color} active={mod === m.id} onClick={() => setMod(mod === m.id ? null : m.id)} />
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" role="img" aria-label="審核單位狀態機：各狀態與觸發轉換的角色" style={{ minWidth: 620, display: "block" }}>
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
        <span>標籤前的色點：觸發這個轉換的是誰的動作</span>
      </div>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "12px 14px", background: "#ffffff" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>不存在的轉換</div>
        {FORBIDDEN.map((f) => (
          <div key={`${f.from}-${f.to}`} style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 13, color: TEXT, padding: "6px 0", borderTop: `1px solid ${LINE}` }}>
            <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
              {f.from} ✕→ {f.to}
            </span>
            <span style={{ color: MUTED }}>{f.why}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
