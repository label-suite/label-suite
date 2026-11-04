import { useEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
// 【資料】角色 icon：依 ROLES 用到的 lucide-react icon 調整這一行
import { Eye, ShieldCheck } from "lucide-react";

/**
 * PRD Site Map：左側是一次看一個模組的縱向主幹樹，右側是詳情面板（寬度不夠時移到樹下方）。
 * 上方切換模組（大型系統另有頁面搜尋），模組節點在最上面，主幹往下串起子模組（沒有子模組時串起模組的入口頁），
 * 子模組左右交錯掛在主幹兩側，頁面在子模組下方垂直排列，左右兩側的支線互為鏡像。
 * 頁面框第一行是名稱與規格編號，第二行是角色 icon；角色用 icon 區分、權限等級用外框區分
 * （實心＝可操作、灰框＝唯讀、黃色虛線＝待確認、不顯示＝無權限）。角色篩選只壓暗進不去的頁面（不隱藏）。
 */

/* ============================================================ 【骨架】色票與型別 */

const PRIMARY_STRONG = "#4F46E5"; // --color-primary-strong
const PRIMARY = "#6366F1"; // --color-primary
const PRIMARY_SOFT = "#EEF2FF"; // --color-primary-soft-bg
const WARNING = "#A16207"; // --color-warning
const WARNING_TEXT = "#A16207"; // --color-warning
const INK = "#1E1B4B"; // --color-ink
const TEXT = "#1E1B4B"; // --color-ink
const MUTED = "#64748B"; // --color-ink-muted
const FAINT = "#64748B"; // --color-ink-muted (lightest text allowed for WCAG AA)
const LINE = "#E2E8F0"; // --color-border
const LINE_2 = "#C7D2FE"; // --color-primary-border
const FONT = "'Inter','Noto Sans TC','PingFang TC',-apple-system,sans-serif"; // --font-sans
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const DIM = 0.28;

/** 頁面超過這個數量才顯示頁面搜尋 */
const SEARCH_PAGE_LIMIT = 20;

/** op：可操作；read：唯讀；pending：有存取但操作權待確認 */
type Level = "op" | "read" | "pending";

interface Role {
  id: string;
  label: string;
  /** 代表這個角色的 lucide-react icon；角色之間不用顏色區分 */
  icon: LucideIcon;
}

interface Module {
  id: string;
  label: string;
  /** 只用在主幹與模組標記，不用在卡片邊框 */
  color: string;
}

/** 子模組：模組底下的頁面分組，本身不是頁面；沒有分組時留空陣列 */
interface Group {
  id: string;
  module: string;
  /** 分組代號，例：1.1 */
  code: string;
  label: string;
}

interface Access {
  level: Level;
  /** 權限代號或補充（R/C/E/D、遮蔽說明、待確認原因） */
  note: string;
}

interface PageNode {
  id: string;
  /** 上層頁面；直接掛在模組或子模組底下的頁面為 null */
  parent: string | null;
  /** 所屬子模組 */
  group?: string;
  label: string;
  module: string;
  /** 規格編號；不需要規格的頁面為 null */
  spec: string | null;
  /** written：已撰寫；reserved：PRD 預留、未撰寫；none：不寫規格；part：屬於上層頁面的規格 */
  specState: "written" | "reserved" | "none" | "part";
  /** 需求來源的原編號（選填），詳情面板顯示、搜尋也比對 */
  code?: string;
  desc: string;
  entry: string;
  access: Record<string, Access | undefined>;
}

/* ============================================================ 【資料】角色、模組、子模組、頁面 */

const ROLES: Role[] = [
  { id: "admin", label: "管理員", icon: ShieldCheck },
  { id: "viewer", label: "檢視者", icon: Eye },
];

const MODULES: Module[] = [
  { id: "m00", label: "登入", color: FAINT },
  { id: "m01", label: "01 客戶管理", color: "#6366F1" },
  { id: "m02", label: "02 商機管理", color: "#047857" },
  { id: "m03", label: "03 報價管理", color: "#1D4ED8" },
];

const GROUPS: Group[] = [];

const PAGES: PageNode[] = [
  {
    id: "login",
    parent: null,
    label: "登入",
    module: "m00",
    spec: null,
    specState: "none",
    desc: "導向公司登入服務；登入後依角色進入系統。沒有被指派角色的使用者無法進入。",
    entry: "未登入時開啟任何頁面",
    access: { admin: { level: "read", note: "未登入可達" }, viewer: { level: "read", note: "未登入可達" } },
  },
  {
    id: "customer-list",
    parent: null,
    label: "客戶清單",
    module: "m01",
    spec: "01-02",
    specState: "reserved",
    desc: "查詢與篩選客戶，是客戶管理的入口頁。",
    entry: "側欄「客戶」",
    access: {
      admin: { level: "op", note: "R/C/E/D" },
      viewer: { level: "read", note: "R；電話與 Email 顯示「—」" },
    },
  },
  {
    id: "customer-new",
    parent: "customer-list",
    label: "新增客戶",
    module: "m01",
    spec: "01-02",
    specState: "part",
    desc: "建立客戶資料，新客戶的往來狀態預設為「往來中」。",
    entry: "客戶清單右上「新增客戶」",
    access: { admin: { level: "op", note: "C" } },
  },
  {
    id: "customer-detail",
    parent: "customer-list",
    label: "客戶詳情",
    module: "m01",
    spec: "01-03",
    specState: "reserved",
    desc: "檢視與編輯客戶資料、維護往來狀態；下方列出這位客戶的聯絡紀錄與商機。",
    entry: "客戶清單點一列",
    access: {
      admin: { level: "op", note: "R/E/D" },
      viewer: { level: "read", note: "R；電話與 Email 顯示「—」" },
    },
  },
  {
    id: "contact-log",
    parent: "customer-detail",
    label: "聯絡紀錄",
    module: "m01",
    spec: "01-01",
    specState: "written",
    desc: "客戶詳情頁下方的區塊：登錄、檢視、編輯、刪除每次聯絡。",
    entry: "客戶詳情頁下方",
    access: { admin: { level: "op", note: "R/C/E/D" }, viewer: { level: "read", note: "R；內容不遮蔽" } },
  },
  {
    id: "opp-board",
    parent: null,
    label: "商機看板",
    module: "m02",
    spec: "02-01",
    specState: "reserved",
    desc: "依商機狀態分欄（開發中、報價中、成交、失敗）檢視全部商機。",
    entry: "側欄「商機」",
    access: { admin: { level: "op", note: "R/C/E" }, viewer: { level: "read", note: "R" } },
  },
  {
    id: "opp-new",
    parent: "opp-board",
    label: "建立商機",
    module: "m02",
    spec: "02-01",
    specState: "part",
    desc: "為客戶建立商機，狀態為「開發中」；只能為往來中的客戶建立。",
    entry: "商機看板右上「建立商機」",
    access: { admin: { level: "op", note: "C" } },
  },
  {
    id: "opp-detail",
    parent: "opp-board",
    label: "商機詳情",
    module: "m02",
    spec: "02-02",
    specState: "reserved",
    desc: "檢視商機與它的報價單、建立報價單、結案為失敗。",
    entry: "商機看板點一張卡片；客戶詳情的商機區塊",
    access: {
      admin: { level: "op", note: "R/E" },
      viewer: { level: "read", note: "R；報價金額顯示「—」" },
    },
  },
  {
    id: "quote-list",
    parent: null,
    label: "報價單清單",
    module: "m03",
    spec: "03-01",
    specState: "reserved",
    desc: "查詢報價單與客戶回覆。",
    entry: "側欄「報價」",
    access: { admin: { level: "op", note: "R" } },
  },
  {
    id: "quote-edit",
    parent: "quote-list",
    label: "報價單編輯",
    module: "m03",
    spec: "03-02",
    specState: "reserved",
    desc: "編輯品項與金額、送出、作廢、記錄客戶接受或不接受。",
    entry: "報價單清單點一列；商機詳情「建立報價單」",
    access: { admin: { level: "op", note: "R/C/E" } },
  },
];

const DEFAULT_SELECTED = "customer-list";

/* ============================================================ 【骨架】版面計算 */

// 樹的設計寬度固定，主幹在正中間；角色 icon 收在頁面框第二行，樹才能窄到旁邊放得下詳情面板
const PAGE_W = 150;
const GROUP_W = 168;
const DESIGN_W = 2 * (GROUP_W + 32);
const TRUNK_X = DESIGN_W / 2;
const PAGE_H = 44;
const GROUP_H = 36;
const ROW_H = 52;
const INDENT = 14;
const HEAD_TOP = 6;
const HEAD_H = 40;
const HEAD_W = 150;
const PANEL_MIN = 240;
const ICON = 14;

/** 主幹上的一站：子模組，或沒有子模組時的模組入口頁 */
interface Station {
  key: string;
  label: string;
  sub: string;
  page?: PageNode;
  /** 掛在這一站底下的頁面；depth 是相對這一站的層級 */
  rows: { page: PageNode; depth: number }[];
}

interface PlacedStation {
  st: Station;
  left: boolean;
  y: number;
  rowsY: number[];
}

function moduleOf(id: string): Module {
  return MODULES.find((m) => m.id === id) ?? MODULES[0];
}

function groupOf(id: string | undefined): Group | undefined {
  return GROUPS.find((g) => g.id === id);
}

/** 依 parent 攤平某頁底下的所有子頁（深度優先） */
function descendants(rootIds: string[], pages: PageNode[], depth: number): { page: PageNode; depth: number }[] {
  const out: { page: PageNode; depth: number }[] = [];
  for (const id of rootIds) {
    const p = pages.find((x) => x.id === id);
    if (!p) continue;
    out.push({ page: p, depth });
    out.push(...descendants(pages.filter((x) => x.parent === id).map((x) => x.id), pages, depth + 1));
  }
  return out;
}

function stationsOf(moduleId: string): Station[] {
  const pages = PAGES.filter((p) => p.module === moduleId);
  const ids = new Set(pages.map((p) => p.id));
  const isRoot = (p: PageNode): boolean => !p.parent || !ids.has(p.parent);
  const groups = GROUPS.filter((g) => g.module === moduleId);
  if (groups.length > 0) {
    return groups.map((g) => {
      const roots = pages.filter((p) => p.group === g.id && isRoot(p)).map((p) => p.id);
      const rows = descendants(roots, pages, 0);
      return { key: g.id, label: `${g.code} ${g.label}`, sub: `${rows.length} 頁`, rows };
    });
  }
  // 沒有子模組：模組的入口頁就是主幹上的站，子頁掛在它底下
  return pages.filter(isRoot).map((p) => {
    const rows = descendants(pages.filter((x) => x.parent === p.id).map((x) => x.id), pages, 0);
    return { key: p.id, label: p.label, sub: rows.length > 0 ? `${rows.length} 個子頁` : "", page: p, rows };
  });
}

function stationH(st: Station): number {
  return st.page ? PAGE_H : GROUP_H;
}

/** 子模組左右交錯；同一側的下一站要排在上一站的頁面之後，主幹上的站依序往下 */
function placeStations(stations: Station[]): { placed: PlacedStation[]; height: number; trunkEnd: number } {
  const end = { left: HEAD_TOP + HEAD_H, right: HEAD_TOP + HEAD_H };
  let prev = HEAD_TOP + HEAD_H / 2;
  const placed = stations.map((st, i) => {
    const left = i % 2 === 0;
    const y = Math.max(prev + 46, (left ? end.left : end.right) + 40);
    prev = y;
    const rowsY = st.rows.map((_, j) => y + stationH(st) / 2 + 18 + j * ROW_H);
    const last = rowsY.length > 0 ? rowsY[rowsY.length - 1] + PAGE_H : y + stationH(st) / 2;
    if (left) end.left = last + 8;
    else end.right = last + 8;
    return { st, left, y, rowsY };
  });
  return { placed, height: Math.max(end.left, end.right, prev + PAGE_H) + 12, trunkEnd: prev };
}

function useMeasuredWidth(initial: number): { ref: RefObject<HTMLDivElement | null>; width: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/* ============================================================ 【骨架】圖形 */

function levelName(level: Level): string {
  return level === "op" ? "可操作" : level === "read" ? "唯讀" : "待確認";
}

/** 頁面框第二行的角色 icon；權限等級用外框表示 */
function RoleBadge({ role, access }: { role: Role; access: Access }): ReactElement {
  const Icon = role.icon;
  const op = access.level === "op";
  const pending = access.level === "pending";
  return (
    <span
      title={`${role.label}：${levelName(access.level)}，${access.note}`}
      style={{
        width: ICON,
        height: ICON,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 3,
        background: op ? PRIMARY_STRONG : "#ffffff",
        border: op ? "none" : pending ? `1px dashed ${WARNING}` : `1px solid ${FAINT}`,
        color: op ? "#ffffff" : pending ? WARNING_TEXT : TEXT,
      }}
    >
      <Icon size={10} strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

function specText(p: PageNode): string {
  if (p.specState === "none") return "不寫規格";
  if (p.specState === "reserved") return p.spec ?? "";
  if (p.specState === "part") return `屬於 ${p.spec}`;
  return p.spec ?? "";
}

function PageBox({ page, x, y, w, selected, role, onSelect }: { page: PageNode; x: number; y: number; w: number; selected: boolean; role: string | null; onSelect: () => void }): ReactElement {
  const dim = role !== null && !page.access[role];
  const roles = ROLES.filter((r) => page.access[r.id]);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={page.label}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: PAGE_H,
        boxSizing: "border-box",
        padding: "3px 7px",
        textAlign: "left",
        borderRadius: 4,
        border: selected ? `1.5px solid ${PRIMARY}` : `1px ${page.specState === "reserved" ? "dashed" : "solid"} ${LINE_2}`,
        background: selected ? PRIMARY_SOFT : "#ffffff",
        cursor: "pointer",
        fontFamily: FONT,
        lineHeight: 1.3,
        opacity: dim ? DIM : 1,
        transition: "opacity 200ms ease-out",
      }}
    >
      <span style={{ display: "flex", justifyContent: "space-between", gap: 4, whiteSpace: "nowrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: selected ? PRIMARY_STRONG : INK, overflow: "hidden", textOverflow: "ellipsis" }}>{page.label}</span>
        <span style={{ fontSize: 10, color: page.specState === "written" ? PRIMARY : MUTED, fontFamily: page.spec ? MONO : FONT, flex: "none" }}>{specText(page)}</span>
      </span>
      <span style={{ display: "flex", gap: 2, marginTop: 4 }}>
        {roles.map((r) => {
          const a = page.access[r.id];
          return a ? <RoleBadge key={r.id} role={r} access={a} /> : null;
        })}
      </span>
    </button>
  );
}

function ModuleTree({ moduleId, selected, role, onSelect }: { moduleId: string; selected: string; role: string | null; onSelect: (id: string) => void }): ReactElement {
  const mod = moduleOf(moduleId);
  const { placed, height, trunkEnd } = placeStations(stationsOf(moduleId));
  const pageCount = PAGES.filter((p) => p.module === moduleId).length;
  const groupCount = GROUPS.filter((g) => g.module === moduleId).length;
  const reach = (st: Station): boolean => role === null || (st.page ? !!st.page.access[role] : false) || st.rows.some((r) => !!r.page.access[role]);
  return (
    <div style={{ position: "relative", width: DESIGN_W, height }}>
      <svg width={DESIGN_W} height={height} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0 }}>
        <rect x={0.5} y={0.5} width={DESIGN_W - 1} height={height - 1} fill="#ffffff" stroke={LINE} rx={6} />
        {placed.map(({ st, left, y, rowsY }) => {
          const elbow = left ? TRUNK_X - 28 : TRUNK_X + 28;
          return (
            <g key={st.key} fill="none" stroke={LINE_2} strokeWidth={1.2} style={{ opacity: reach(st) ? 1 : DIM, transition: "opacity 200ms ease-out" }}>
              <path d={`M${TRUNK_X},${y} H${left ? TRUNK_X - 20 : TRUNK_X + 20}`} />
              {rowsY.length > 0 ? <path d={`M${elbow},${y + stationH(st) / 2} V${rowsY[rowsY.length - 1] + PAGE_H / 2}`} /> : null}
              {st.rows.map((r, j) => {
                const tip = left ? TRUNK_X - 38 - r.depth * INDENT : TRUNK_X + 38 + r.depth * INDENT;
                return <path key={r.page.id} d={`M${elbow},${rowsY[j] + PAGE_H / 2} H${tip}`} />;
              })}
            </g>
          );
        })}
        <path d={`M${TRUNK_X},${HEAD_TOP + HEAD_H} V${trunkEnd}`} stroke={mod.color} strokeWidth={3} fill="none" />
        {placed.map(({ st, y }) => (
          <circle key={st.key} cx={TRUNK_X} cy={y} r={5} fill="#ffffff" stroke={mod.color} strokeWidth={2} />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          left: TRUNK_X - HEAD_W / 2,
          top: HEAD_TOP,
          width: HEAD_W,
          height: HEAD_H,
          boxSizing: "border-box",
          padding: "4px 10px",
          border: `1px solid ${MUTED}`,
          borderRadius: 4,
          background: "#ffffff",
          fontFamily: FONT,
          lineHeight: 1.35,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: INK }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: mod.color }} />
          {mod.label}
        </div>
        <div style={{ fontSize: 11, color: MUTED }}>{groupCount > 0 ? `${groupCount} 子模組・${pageCount} 頁` : `${pageCount} 頁`}</div>
      </div>
      {placed.map(({ st, left, y, rowsY }) => {
        const stW = st.page ? PAGE_W : GROUP_W;
        const sx = left ? TRUNK_X - 20 - stW : TRUNK_X + 20;
        return (
          <div key={st.key}>
            {st.page ? (
              <PageBox page={st.page} x={sx} y={y - PAGE_H / 2} w={stW} selected={st.page.id === selected} role={role} onSelect={() => onSelect(st.page?.id ?? selected)} />
            ) : (
              <div
                style={{
                  position: "absolute",
                  left: sx,
                  top: y - GROUP_H / 2,
                  width: stW,
                  height: GROUP_H,
                  boxSizing: "border-box",
                  padding: "3px 9px",
                  border: `1px solid ${LINE_2}`,
                  borderRadius: 4,
                  background: "#ffffff",
                  fontFamily: FONT,
                  lineHeight: 1.3,
                  opacity: reach(st) ? 1 : DIM,
                  transition: "opacity 200ms ease-out",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.label}</div>
                <div style={{ fontSize: 10.5, color: MUTED }}>{st.sub}</div>
              </div>
            )}
            {st.rows.map((r, j) => {
              const w = PAGE_W - r.depth * INDENT;
              const x = left ? TRUNK_X - 38 - r.depth * INDENT - w : TRUNK_X + 38 + r.depth * INDENT;
              return <PageBox key={r.page.id} page={r.page} x={x} y={rowsY[j]} w={w} selected={r.page.id === selected} role={role} onSelect={() => onSelect(r.page.id)} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

function Pill({ active, onClick, children, dim }: { active: boolean; onClick: () => void; children: ReactElement | ReactElement[] | string; dim?: boolean }): ReactElement {
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
        border: `1px solid ${active ? INK : LINE_2}`,
        background: active ? INK : "#ffffff",
        color: active ? "#ffffff" : TEXT,
        fontSize: 13,
        fontFamily: FONT,
        cursor: "pointer",
        opacity: dim ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Legend(): ReactElement {
  const swatch = (style: Record<string, string | number>): ReactElement => <span style={{ width: 14, height: 14, boxSizing: "border-box", borderRadius: 3, display: "inline-block", ...style }} />;
  const item = (el: ReactElement, text: string): ReactElement => (
    <span key={text} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      {el}
      {text}
    </span>
  );
  const levels = new Set(PAGES.flatMap((p) => Object.values(p.access).map((a) => a?.level)));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 11.5, color: MUTED, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${LINE}` }}>
      {levels.has("op") ? item(swatch({ background: PRIMARY_STRONG }), "可操作") : null}
      {levels.has("read") ? item(swatch({ border: `1px solid ${FAINT}` }), "唯讀") : null}
      {levels.has("pending") ? item(swatch({ border: `1px dashed ${WARNING}` }), "權限待確認") : null}
      {item(swatch({ border: `1px dashed ${LINE_2}`, width: 22 }), "規格未撰寫")}
    </div>
  );
}

/** 右側詳情面板：選取頁面的說明、位置、入口、各角色權限與規格；圖例收在底部 */
function DetailPanel({ node }: { node: PageNode }): ReactElement {
  const mod = moduleOf(node.module);
  const group = groupOf(node.group);
  const specLine =
    node.specState === "none"
      ? "不另寫規格"
      : node.specState === "reserved"
        ? `規格 ${node.spec}（PRD 預留，未撰寫）`
        : node.specState === "part"
          ? `屬於規格 ${node.spec}`
          : `規格 ${node.spec}（已撰寫）`;
  const row = (k: string, v: ReactElement | string): ReactElement => (
    <div style={{ display: "grid", gridTemplateColumns: "52px 1fr", gap: 8, padding: "7px 0", borderTop: `1px solid ${LINE}` }}>
      <div style={{ color: MUTED, fontSize: 12 }}>{k}</div>
      <div style={{ color: TEXT, fontSize: 13, lineHeight: 1.6 }}>{v}</div>
    </div>
  );
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: "12px 14px", fontFamily: FONT, background: "#ffffff" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginBottom: 6 }}>{node.label}</div>
      <div style={{ color: TEXT, fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>{node.desc}</div>
      {row("位置", group ? `${mod.label} › ${group.code} ${group.label}` : mod.label)}
      {node.code ? row("原編號", <span style={{ fontFamily: MONO }}>{node.code}</span>) : null}
      {row("入口", node.entry)}
      {row(
        "權限",
        <div style={{ display: "grid", gap: 4 }}>
          {ROLES.map((r) => {
            const a = node.access[r.id];
            const Icon = r.icon;
            return (
              <div key={r.id} style={{ display: "flex", flexWrap: "wrap", columnGap: 6, alignItems: "center", color: a ? (a.level === "pending" ? WARNING_TEXT : TEXT) : FAINT }}>
                <Icon size={14} strokeWidth={2} aria-hidden="true" />
                <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.label}</span>
                <span>{a ? `${levelName(a.level)}，${a.note}` : "無權限"}</span>
              </div>
            );
          })}
        </div>,
      )}
      {row("規格", <span style={{ fontFamily: node.spec ? MONO : FONT, color: node.specState === "written" ? PRIMARY : TEXT }}>{specLine}</span>)}
      <Legend />
    </div>
  );
}

/** 頁面搜尋：比對頁面名稱、規格編號與原編號，選取後切到該模組並選取頁面 */
function PageSearch({ onPick }: { onPick: (p: PageNode) => void }): ReactElement {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const hits = query ? PAGES.filter((p) => [p.label, p.spec ?? "", p.code ?? ""].some((s) => s.toLowerCase().includes(query))).slice(0, 8) : [];
  const pick = (p: PageNode): void => {
    onPick(p);
    setQ("");
  };
  return (
    <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 360 }}>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && hits[0]) pick(hits[0]);
          if (e.key === "Escape") setQ("");
        }}
        placeholder="搜尋頁面名稱或編號"
        aria-label="搜尋頁面名稱或編號"
        style={{ width: "100%", boxSizing: "border-box", padding: "6px 12px", borderRadius: 999, border: `1px solid ${LINE_2}`, fontSize: 13, fontFamily: FONT, color: TEXT, background: "#ffffff" }}
      />
      {query ? (
        <div
          role="listbox"
          aria-label="搜尋結果"
          style={{ position: "absolute", zIndex: 5, top: "calc(100% + 4px)", left: 0, right: 0, background: "#ffffff", border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: "0 6px 18px rgba(99,102,241,0.10)", padding: 4 }}
        >
          {hits.length === 0 ? <div style={{ padding: "6px 8px", fontSize: 12.5, color: MUTED }}>找不到符合的頁面</div> : null}
          {hits.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => pick(p)}
              style={{ display: "flex", width: "100%", gap: 8, alignItems: "baseline", padding: "6px 8px", border: "none", background: "transparent", borderRadius: 6, cursor: "pointer", fontFamily: FONT, textAlign: "left" }}
            >
              <span style={{ fontSize: 13, color: INK }}>{p.label}</span>
              <span style={{ fontSize: 11, color: MUTED }}>{moduleOf(p.module).label}</span>
              <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO, marginLeft: "auto" }}>{[p.spec, p.code].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================ 【骨架】外殼 */

export default function PrdSiteMap(): ReactElement {
  const reduce = useReducedMotion();
  // 第一次 render（含 SSR）直接呈現終態，之後切換時才播放進場
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const [role, setRole] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(DEFAULT_SELECTED);
  const [focus, setFocus] = useState<string>((PAGES.find((p) => p.id === DEFAULT_SELECTED) ?? PAGES[0]).module);
  const { ref, width } = useMeasuredWidth(DESIGN_W + PANEL_MIN + 16);
  // 樹的右邊還放得下面板才並排，否則面板移到樹下方
  const side = width >= DESIGN_W + PANEL_MIN + 16;
  const selectedNode = PAGES.find((p) => p.id === selected) ?? PAGES[0];
  const modules = MODULES.filter((m) => PAGES.some((p) => p.module === m.id));
  const pickModule = (id: string): void => {
    setFocus(id);
    const first = stationsOf(id)[0];
    const firstPage = first?.page ?? first?.rows[0]?.page;
    if (firstPage) setSelected(firstPage.id);
  };
  const pickPage = (p: PageNode): void => {
    setFocus(p.module);
    setSelected(p.id);
  };
  const fade = { initial: reduce || !mounted.current ? false : { opacity: 0.4 }, animate: { opacity: 1 }, transition: { duration: 0.2, ease: "easeOut" as const } };

  return (
    <div ref={ref} className="not-prose" style={{ width: "100%", fontFamily: FONT, display: "grid", gap: 12 }}>
      {PAGES.length > SEARCH_PAGE_LIMIT ? <PageSearch onPick={pickPage} /> : null}
      <div role="group" aria-label="角色篩選" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Pill active={role === null} onClick={() => setRole(null)}>
          全部角色
        </Pill>
        {ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <Pill key={r.id} active={role === r.id} onClick={() => setRole(role === r.id ? null : r.id)}>
              <Icon size={14} strokeWidth={2} aria-hidden="true" />
              <span>{r.label}</span>
            </Pill>
          );
        })}
      </div>
      <div role="group" aria-label="模組切換" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {modules.map((m) => {
          const pages = PAGES.filter((p) => p.module === m.id);
          const n = role ? pages.filter((p) => p.access[role]).length : pages.length;
          return (
            <Pill key={m.id} active={m.id === focus} onClick={() => pickModule(m.id)} dim={role !== null && n === 0}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
              <span>{m.label}</span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>{n}</span>
            </Pill>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: side ? `${DESIGN_W}px minmax(0,1fr)` : "minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        <motion.div key={focus} {...fade} role="group" aria-label={`Site Map：${moduleOf(focus).label}的頁面與各角色可存取的範圍`} style={{ overflowX: "auto" }}>
          <ModuleTree moduleId={focus} selected={selected} role={role} onSelect={setSelected} />
        </motion.div>
        <motion.div key={selected} {...fade} style={side ? { position: "sticky", top: 12 } : undefined}>
          <DetailPanel node={selectedNode} />
        </motion.div>
      </div>
    </div>
  );
}
