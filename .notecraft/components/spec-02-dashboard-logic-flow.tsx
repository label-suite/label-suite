import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MousePointerClick, RotateCcw } from "lucide-react";

/**
 * 02 儀表板 Logic Flow：跨頁的操作邏輯流程（docs/specs/02-dashboard/index.mdx §Logic Flow）。
 *
 * 四種標準流程圖符號：起訖（圓角膠囊）、頁面（矩形）、判斷（菱形）、其他流程或外部系統（雙邊框矩形）。
 * 節點編號、分段與出處都和 index.mdx 的文字版逐項一致；文字版沒有的連線不畫。
 * 符號、配色、互動與鍵盤操作照 01 帳號的元件（spec-01-account-logic-flow.tsx），只換節點與連線的資料。
 */

/* ---------------------------------------------------------------- 色票（label-suite-design，來源 design/prototype/assets/tokens.css） */

const PRIMARY = "#6366F1"; // --color-primary
const PRIMARY_STRONG = "#4F46E5"; // --color-primary-strong
const PRIMARY_SOFT = "#EEF2FF"; // --color-primary-soft-bg
const PRIMARY_BORDER = "#C7D2FE"; // --color-primary-border
const INK = "#1E1B4B"; // --color-ink
const MUTED = "#64748B"; // --color-ink-muted (lightest text allowed for WCAG AA)
const SURFACE = "#F5F3FF"; // --color-surface
const WHITE = "#FFFFFF"; // --color-white
const SLATE_50 = "#F8FAFC"; // --color-slate-50
const BORDER = "#E2E8F0"; // --color-border
const INFO = "#1D4ED8"; // --color-info
const INFO_BG = "#EFF6FF"; // --color-info-bg
const WARNING = "#A16207"; // --color-warning
const FONT = "'Inter','Noto Sans TC','PingFang TC',-apple-system,sans-serif"; // --font-sans
const DIM = 0.22;
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

/* ---------------------------------------------------------------- 型別 */

/** terminal 起訖、page 頁面、decision 判斷、module 其他模組的流程、external 外部系統或收信 */
type NodeKind = "terminal" | "page" | "decision" | "module" | "external";

/** plain 一般、yes 判斷的「是」、no 判斷的「否」或失敗 */
type EdgeKind = "plain" | "yes" | "no";

interface FlowNode {
  /** 與文字版相同的編號：S、P1、D1～D3、X1～X4 */
  id: string;
  kind: NodeKind;
  lines: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  /** 點選後顯示的說明 */
  note: string;
}

interface FlowEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  /** 折線座標，第一點在起點邊上、最後一點在終點邊上 */
  pts: [number, number][];
  label?: string;
  lp?: [number, number];
  /** 文字版的條目，含出處 */
  text: string;
}

interface Section {
  id: string;
  label: string;
  w: number;
  h: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/* ---------------------------------------------------------------- 共用節點（同一個編號在不同分段重複出現） */

const NOTE: Record<string, string> = {
  S: "開始：使用者登入成功，進入儀表板",
  P1: "02-01 儀表板：依身分顯示其中一種版面（全平台、專案負責人、審核員、標記員或還沒有任務角色的行動入口）（規格 02-01 §業務流程、§規格「這一頁顯示哪一種版面」）",
  D1: "判斷：已登入且系統角色有效？",
  D2: "判斷：這個任務還有沒提交的資料嗎？",
  D3: "判斷：推導得出可處理的審核單位嗎？",
  X1: "其他模組：01-01 登入頁",
  X2: "其他模組：03-01 任務列表",
  X3: "其他模組：04-01 標記清單",
  X4: "其他模組：04-02 標記工作區",
  X5: "其他模組：01-04 個人設定頁",
};

function n(id: string, kind: NodeKind, lines: string[], x: number, y: number, w: number, h: number): FlowNode {
  return { id, kind, lines, x, y, w, h, note: NOTE[id] ?? id };
}

/* ---------------------------------------------------------------- 資料：五個分段，與文字版的分段一～五逐項一致 */

const SECTIONS: Section[] = [
  {
    id: "entry",
    label: "進入儀表板與行動入口",
    w: 860,
    h: 320,
    nodes: [
      n("S", "terminal", ["開始"], 50, 150, 76, 36),
      n("D1", "decision", ["登入且角色有效？"], 190, 150, 130, 60),
      n("X1", "module", ["01-01", "登入頁"], 190, 270, 120, 44),
      n("P1", "page", ["02-01", "儀表板"], 390, 150, 120, 44),
      n("X2", "module", ["03-01", "任務列表"], 650, 70, 130, 44),
      n("X3", "module", ["04-01", "標記清單"], 650, 240, 130, 44),
    ],
    edges: [
      { id: "1-1", from: "S", to: "D1", kind: "plain", pts: [[88, 150], [125, 150]], text: "S → D1（起訖連線，無規格條文）" },
      { id: "1-2", from: "D1", to: "X1", kind: "no", pts: [[190, 180], [190, 248]], label: "否", lp: [206, 214], text: "D1 否 → X1 登入頁（02-01 業務流程「進入儀表板拿到自己的版面」E1；§卡控機制「系統角色不在允許清單裡」「使用者沒有登入」；§驗收標準「角色無效時導向登入頁」「未登入時導向登入頁」）" },
      { id: "1-3", from: "D1", to: "P1", kind: "yes", pts: [[255, 150], [330, 150]], label: "是", lp: [292, 140], text: "D1 是 → P1 儀表板（02-01 業務流程「進入儀表板拿到自己的版面」主流程 1～3；§規格「這一頁顯示哪一種版面」1～3）" },
      { id: "1-4", from: "P1", to: "X2", kind: "plain", pts: [[420, 128], [420, 70], [585, 70]], label: "卡 A：開始建立任務", lp: [450, 50], text: "P1（還沒有任務角色的版面）按卡 A「開始建立任務」→ X2 任務列表（02-01 業務流程 A1；§規格「還沒有任務角色的人看到什麼」2、3、7；03-01 自己的引言「這一頁是任務管理模組的進入點」。不引規格 07-01 §進入模組的條件：那一條只管「標記作業」與「資料集分析」兩個模組，任務管理本來就不被任務角色擋下，不需要例外）" },
      { id: "1-5", from: "P1", to: "X3", kind: "plain", pts: [[420, 165], [420, 222], [585, 222]], label: "卡 B：開始標記", lp: [460, 206], text: "P1 按卡 B「開始標記」→ X3 標記清單（02-01 業務流程 A1；§規格「還沒有任務角色的人看到什麼」2、3、7；04-01 §規格「兩種入口並存」第 1 條「這一頁是標記模組的入口頁」；02-01 §驗收標準「三張卡的按鈕都走到模組入口頁」；規格 07-01 §進入模組的條件 第 4 條例外；規格 07-01 §驗收標準「從儀表板行動入口卡進入不被擋下」）" },
      { id: "1-6", from: "P1", to: "X3", kind: "plain", pts: [[420, 172], [440, 258], [585, 258]], label: "卡 C：開始審核", lp: [460, 284], text: "P1 按卡 C「開始審核」→ X3 標記清單（同上條款；02-01 §規格「還沒有任務角色的人看到什麼」3，「審核的入口」與卡 B 同指 04-01）" },
    ],
  },
  {
    id: "admin_pm",
    label: "系統管理員與專案負責人的清單入口",
    w: 620,
    h: 220,
    nodes: [
      n("P1", "page", ["02-01", "儀表板"], 110, 110, 120, 44),
      n("X2", "module", ["03-01", "任務列表"], 460, 110, 140, 56),
    ],
    edges: [
      { id: "2-1", from: "P1", to: "X2", kind: "plain", pts: [[170, 92], [390, 92]], label: "等待 IAA 確認", lp: [280, 76], text: "P1（系統管理員或專案負責人版面）點「等待 IAA 確認」數值 → X2 任務列表，已套用「等待 IAA 確認」狀態篩選（02-01 §規格「「等待 IAA 確認」這張卡是一個入口」1～4；§驗收標準「等待 IAA 確認可用滑鼠點」「等待 IAA 確認可用鍵盤觸發」「等待 IAA 確認的數字與清單一致」「等待 IAA 確認為零仍是入口」）" },
      { id: "2-2", from: "P1", to: "X2", kind: "plain", pts: [[170, 128], [390, 128]], label: "查看全部", lp: [280, 148], text: "P1 點「查看全部」→ X2 任務列表，不套篩選，範圍依登入者身分（02-01 §規格「「查看全部」去哪裡、看得到誰的任務」1～7；§驗收標準「系統管理員查看全部得到全平台」「專案負責人查看全部只得到自己的」）" },
    ],
  },
  {
    id: "annotator",
    label: "標記員的快速繼續",
    w: 700,
    h: 280,
    nodes: [
      n("P1", "page", ["02-01", "儀表板"], 90, 140, 110, 44),
      n("D2", "decision", ["還有沒提交的資料？"], 300, 90, 130, 64),
      n("X4", "module", ["04-02", "標記工作區"], 540, 70, 130, 44),
      n("X3", "module", ["04-01", "標記清單"], 540, 230, 130, 44),
    ],
    edges: [
      { id: "3-1", from: "P1", to: "D2", kind: "plain", pts: [[145, 128], [235, 98]], label: "快速繼續", lp: [185, 95], text: "P1（標記員版面）點某列「快速繼續」→ D2（02-01 業務流程「從儀表板回到標記工作」觸發、前置條件、主流程 1～2）" },
      { id: "3-2", from: "D2", to: "X4", kind: "yes", pts: [[365, 90], [475, 90], [475, 75]], label: "是：找到了", lp: [420, 78], text: "D2 找到了 → X4 標記工作區，帶任務、資料與標記員身分（主流程 3；§驗收標準「快速繼續開第一筆沒提交的資料」）" },
      { id: "3-3", from: "D2", to: "X3", kind: "no", pts: [[300, 122], [300, 230], [475, 230]], label: "否：全部已提交", lp: [340, 215], text: "D2 全部已提交 → X3 標記清單，該任務、不指定某一筆；「快速繼續」仍可見可按（A1；§已確認決議 Q13；§驗收標準「全部已提交時快速繼續到清單」）" },
      { id: "3-4", from: "P1", to: "X3", kind: "plain", pts: [[90, 162], [90, 252], [475, 252]], label: "點其他地方", lp: [150, 268], text: "P1 點某列「快速繼續」以外的地方 → X3 標記清單，該任務（A2；§驗收標準「點標記員任務列其他地方到清單」）" },
    ],
  },
  {
    id: "reviewer",
    label: "審核員的快速審核",
    w: 700,
    h: 280,
    nodes: [
      n("P1", "page", ["02-01", "儀表板"], 90, 140, 110, 44),
      n("D3", "decision", ["推導得出可處理單位？"], 310, 90, 150, 64),
      n("X4", "module", ["04-02", "標記工作區"], 560, 70, 130, 44),
      n("X3", "module", ["04-01", "標記清單"], 560, 230, 130, 44),
    ],
    edges: [
      { id: "4-1", from: "P1", to: "D3", kind: "plain", pts: [[145, 128], [240, 98]], label: "快速審核", lp: [185, 95], text: "P1（審核員版面）點某列「快速審核」→ D3（02-01 業務流程「從儀表板回到審核工作」觸發、前置條件、主流程 1～2；§規格「「快速審核」要開哪一個審核單位」1～4）" },
      { id: "4-2", from: "D3", to: "X4", kind: "yes", pts: [[385, 90], [495, 90], [495, 75]], label: "是：推導得出", lp: [430, 78], text: "D3 推導得出 → X4 標記工作區，帶任務、樣本、標記員身分、審核員身分與標記階段五項（主流程 3；§規格同節第 5 條；§驗收標準「快速審核開可處理的審核單位」）" },
      { id: "4-3", from: "D3", to: "X3", kind: "no", pts: [[310, 122], [310, 230], [495, 230]], label: "否：是空的", lp: [350, 215], text: "D3 是空的 → X3 標記清單，該任務、不指定某一筆，顯示明確的空狀態說明；不開任務的第一筆，也不開任何已定稿的唯讀單位（A1；§規格同節第 7、8 條；§驗收標準「沒有可處理單位時到清單並說明」「沒有可處理單位時不開已定稿的」）" },
      { id: "4-4", from: "P1", to: "X3", kind: "plain", pts: [[90, 162], [90, 252], [495, 252]], label: "點其他地方", lp: [150, 268], text: "P1 點某列「快速審核」以外的地方 → X3 標記清單，該任務（A2；§驗收標準「點審核員任務列其他地方到清單」）" },
    ],
  },
  {
    id: "sidebar",
    label: "側欄導覽離開儀表板",
    w: 680,
    h: 300,
    nodes: [
      n("P1", "page", ["02-01", "儀表板"], 90, 150, 110, 44),
      n("X5", "module", ["01-04", "個人設定頁"], 480, 60, 150, 44),
      n("X3", "module", ["04-01", "標記清單"], 480, 150, 150, 44),
      n("X1", "module", ["01-01", "登入頁"], 480, 240, 150, 44),
    ],
    edges: [
      { id: "5-1", from: "P1", to: "X5", kind: "plain", pts: [[135, 132], [280, 70], [405, 70]], label: "側欄：個人設定", lp: [270, 50], text: "P1 點側欄「個人設定」→ X5 個人設定頁（規格 07-01 §導覽項目與可見性「個人設定對 01-04」；02-01 §驗收標準「換頁再回來語言不變」的 When「前往個人設定或帳號頁面再回到儀表板」，「帳號頁面」與「個人設定」同指 01-04，這一頁沒有第二個側欄可達的帳號頁面）" },
      { id: "5-2", from: "P1", to: "X3", kind: "plain", pts: [[145, 150], [405, 150]], label: "側欄：標記作業（專案負責人）", lp: [275, 136], text: "P1（專案負責人版面）點側欄「標記作業」→ X3 標記清單（02-01 §規格「這一頁顯示哪一種版面」第 3 條後方附註「他要標記得從側欄進入標記作業」；§邊界情況「平台成員同時是專案負責人與標記員」；§Q&A 同句）" },
      { id: "5-3", from: "P1", to: "X1", kind: "plain", pts: [[135, 168], [280, 230], [405, 230]], label: "側欄：登出", lp: [270, 254], text: "P1 點側欄「登出」→ X1 登入頁（02-01 §導覽、語言與登出不在這一頁 第 1 條，側欄導覽與登出的規則都在規格 07-01，這一頁只是使用它；規格 07-01 §登出 第 1 條）" },
    ],
  },
];

/* ---------------------------------------------------------------- 樣式 */

function nodeColors(kind: NodeKind): { fill: string; stroke: string; text: string } {
  switch (kind) {
    case "page":
      return { fill: PRIMARY_SOFT, stroke: PRIMARY, text: PRIMARY_STRONG };
    case "decision":
      return { fill: SURFACE, stroke: PRIMARY_BORDER, text: INK };
    case "module":
      return { fill: INFO_BG, stroke: INFO, text: INFO };
    case "external":
      return { fill: SLATE_50, stroke: MUTED, text: INK };
    case "terminal":
      return { fill: WHITE, stroke: INK, text: INK };
  }
}

const EDGE_COLOR: Record<EdgeKind, string> = { plain: MUTED, yes: PRIMARY, no: WARNING };

const KIND_LABEL: Record<NodeKind, string> = {
  terminal: "起訖",
  page: "頁面",
  decision: "判斷",
  module: "其他流程",
  external: "外部系統",
};

/* ---------------------------------------------------------------- 圖形 */

function Shape({ node }: { node: FlowNode }): ReactElement {
  const c = nodeColors(node.kind);
  const { x, y, w, h } = node;
  const left = x - w / 2;
  const top = y - h / 2;
  if (node.kind === "decision") {
    const pts = `${x},${top} ${x + w / 2},${y} ${x},${top + h} ${left},${y}`;
    return <polygon points={pts} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />;
  }
  if (node.kind === "terminal") {
    return <rect x={left} y={top} width={w} height={h} rx={h / 2} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />;
  }
  if (node.kind === "module" || node.kind === "external") {
    return (
      <g>
        <rect x={left} y={top} width={w} height={h} rx={4} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
        <line x1={left + 8} y1={top} x2={left + 8} y2={top + h} stroke={c.stroke} strokeWidth={1.2} />
        <line x1={left + w - 8} y1={top} x2={left + w - 8} y2={top + h} stroke={c.stroke} strokeWidth={1.2} />
      </g>
    );
  }
  return <rect x={left} y={top} width={w} height={h} rx={4} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />;
}

function NodeText({ node }: { node: FlowNode }): ReactElement {
  const c = nodeColors(node.kind);
  const two = node.lines.length > 1;
  return (
    <text x={node.x} y={node.y} textAnchor="middle" fontFamily={FONT} fill={c.text}>
      {node.lines.map((line, i) => {
        const isCode = two && i === 0 && /^\d/.test(line);
        return (
          <tspan key={line} x={node.x} dy={two ? (i === 0 ? -3 : 15) : 5} fontSize={isCode ? 12 : 13} fontWeight={isCode ? 500 : 600}>
            {line}
          </tspan>
        );
      })}
    </text>
  );
}

/* ---------------------------------------------------------------- 主元件 */

type Selection = { type: "node"; id: string } | { type: "edge"; id: string } | null;

export default function Spec02DashboardLogicFlow(): ReactElement {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const [tab, setTab] = useState<string>(SECTIONS[0].id);
  const [switched, setSwitched] = useState<boolean>(false);
  const [sel, setSel] = useState<Selection>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const activate = (ev: KeyboardEvent<SVGGElement>, next: Selection): void => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      setSel(next);
    }
  };

  const section = SECTIONS.find((s) => s.id === tab) ?? SECTIONS[0];
  const nodeById = new Map(section.nodes.map((nd) => [nd.id, nd]));

  const litNodes = new Set<string>();
  const litEdges = new Set<string>();
  if (sel?.type === "node") {
    litNodes.add(sel.id);
    for (const e of section.edges) {
      if (e.from === sel.id || e.to === sel.id) {
        litEdges.add(e.id);
        litNodes.add(e.from);
        litNodes.add(e.to);
      }
    }
  } else if (sel?.type === "edge") {
    const e = section.edges.find((ed) => ed.id === sel.id);
    if (e) {
      litEdges.add(e.id);
      litNodes.add(e.from);
      litNodes.add(e.to);
    }
  }
  const active = sel !== null;
  const transition = { duration: reduce ? 0 : 0.2, ease: EASE };

  const detail = ((): { title: string; body: string } => {
    if (sel?.type === "node") {
      const nd = nodeById.get(sel.id);
      if (nd) return { title: `${nd.id}・${KIND_LABEL[nd.kind]}`, body: nd.note };
    }
    if (sel?.type === "edge") {
      const e = section.edges.find((ed) => ed.id === sel.id);
      if (e) return { title: `連線 ${e.from} → ${e.to}`, body: e.text };
    }
    return { title: "點節點或連線", body: "下方會顯示它在文字版的條目與規格出處；再點一次空白處取消。" };
  })();

  const tabStyle = (on: boolean): CSSProperties => ({
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: on ? 600 : 500,
    color: on ? PRIMARY_STRONG : MUTED,
    background: on ? PRIMARY_SOFT : "transparent",
    border: `1px solid ${on ? PRIMARY_BORDER : BORDER}`,
    borderRadius: 8,
    padding: "6px 12px",
    cursor: "pointer",
    transition: "all 150ms cubic-bezier(0.4,0,0.2,1)",
  });

  return (
    <div className="not-prose mx-auto w-full max-w-5xl" style={{ fontFamily: FONT, color: INK }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label="Logic Flow 分段" className="flex flex-wrap items-center gap-2">
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            id={`${uid}-tab-${s.id}`}
            type="button"
            role="tab"
            aria-selected={s.id === tab}
            aria-controls={`${uid}-panel`}
            tabIndex={s.id === tab ? 0 : -1}
            onKeyDown={(ev) => {
              if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
              ev.preventDefault();
              const next = SECTIONS[(i + (ev.key === "ArrowRight" ? 1 : SECTIONS.length - 1)) % SECTIONS.length];
              setTab(next.id);
              setSel(null);
              setSwitched(true);
              document.getElementById(`${uid}-tab-${next.id}`)?.focus();
            }}
            style={tabStyle(s.id === tab)}
            onClick={() => {
              setTab(s.id);
              setSel(null);
              setSwitched(true);
            }}
          >
            {`分段${["一", "二", "三", "四", "五"][i]}：${s.label}`}
          </button>
        ))}
      </div>
        {active && (
          <button type="button" onClick={() => setSel(null)} style={{ ...tabStyle(false), display: "inline-flex", alignItems: "center", gap: 4 }}>
            <RotateCcw size={14} aria-hidden="true" />
            取消選取
          </button>
        )}
      </div>

      <div
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${section.id}`}
        style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflowX: "auto", background: WHITE }}
      >
        <motion.div
          key={section.id}
          initial={switched && !reduce ? { opacity: 0, y: 4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.25, ease: EASE }}
        >
          <svg
            viewBox={`0 0 ${section.w} ${section.h}`}
            role="group"
            aria-label={`02 儀表板 Logic Flow：${section.label}；用 Tab 移到節點或連線，按 Enter 看出處`}
            style={{ display: "block", width: "100%", minWidth: Math.round(section.w * 0.78) }}
            onClick={() => setSel(null)}
          >
            <defs>
              {(Object.keys(EDGE_COLOR) as EdgeKind[]).map((k) => (
                <marker key={k} id={`${uid}-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={EDGE_COLOR[k]} />
                </marker>
              ))}
            </defs>

            {section.edges.map((e) => {
              const op = !active || litEdges.has(e.id) ? 1 : DIM;
              const d = e.pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px},${py}`).join(" ");
              const color = EDGE_COLOR[e.kind];
              return (
                <motion.g
                  key={e.id}
                  animate={{ opacity: op }}
                  transition={transition}
                  style={{ cursor: "pointer", outline: "none" }}
                  tabIndex={0}
                  role="button"
                  aria-label={`連線 ${e.from} 到 ${e.to}${e.label ? `，${e.label}` : ""}`}
                  aria-pressed={sel?.type === "edge" && sel.id === e.id}
                  onFocus={() => setFocusKey(`e-${e.id}`)}
                  onBlur={() => setFocusKey(null)}
                  onKeyDown={(ev) => activate(ev, { type: "edge", id: e.id })}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setSel({ type: "edge", id: e.id });
                  }}
                >
                  <path d={d} fill="none" stroke={focusKey === `e-${e.id}` ? PRIMARY_BORDER : "transparent"} strokeWidth={focusKey === `e-${e.id}` ? 8 : 12} strokeLinejoin="round" />
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth={litEdges.has(e.id) ? 2.2 : 1.5}
                    strokeDasharray={e.kind === "no" ? "5 4" : undefined}
                    markerEnd={`url(#${uid}-${e.kind})`}
                  />
                  {e.label && e.lp && (
                    <text x={e.lp[0]} y={e.lp[1]} textAnchor="middle" fontFamily={FONT} fontSize={12} fontWeight={500} fill={e.kind === "plain" ? MUTED : color} stroke={WHITE} strokeWidth={4} paintOrder="stroke">
                      {e.label}
                    </text>
                  )}
                </motion.g>
              );
            })}

            {section.nodes.map((nd) => {
              const op = !active || litNodes.has(nd.id) ? 1 : DIM;
              return (
                <motion.g
                  key={nd.id}
                  animate={{ opacity: op }}
                  transition={transition}
                  style={{ cursor: "pointer", outline: "none" }}
                  tabIndex={0}
                  role="button"
                  aria-label={nd.note}
                  aria-pressed={sel?.type === "node" && sel.id === nd.id}
                  onFocus={() => setFocusKey(`n-${nd.id}`)}
                  onBlur={() => setFocusKey(null)}
                  onKeyDown={(ev) => activate(ev, { type: "node", id: nd.id })}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setSel({ type: "node", id: nd.id });
                  }}
                >
                  {focusKey === `n-${nd.id}` && (
                    <rect x={nd.x - nd.w / 2 - 5} y={nd.y - nd.h / 2 - 5} width={nd.w + 10} height={nd.h + 10} rx={8} fill="none" stroke={PRIMARY_STRONG} strokeWidth={2} />
                  )}
                  <Shape node={nd} />
                  <NodeText node={nd} />
                  <text x={nd.x - nd.w / 2} y={nd.y - nd.h / 2 - 4} fontFamily={FONT} fontSize={12} fontWeight={600} fill={MUTED} textAnchor="start">
                    {nd.kind === "decision" ? "" : nd.id}
                  </text>
                  {nd.kind === "decision" && (
                    <text x={nd.x + nd.w / 2 - 6} y={nd.y - nd.h / 2 + 8} fontFamily={FONT} fontSize={12} fontWeight={600} fill={MUTED}>
                      {nd.id}
                    </text>
                  )}
                </motion.g>
              );
            })}
          </svg>
        </motion.div>
      </div>

      <div className="mt-3 flex items-start gap-2" style={{ fontSize: 14, lineHeight: 1.6 }} aria-live="polite">
        <MousePointerClick size={16} color={PRIMARY_STRONG} aria-hidden="true" style={{ marginTop: 3, flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 600, color: INK }}>{detail.title}</div>
          <div style={{ color: MUTED }}>{detail.body}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: 12, color: MUTED }}>
        <span>圓角膠囊：起訖</span>
        <span>矩形：頁面</span>
        <span>菱形：判斷</span>
        <span>雙邊框：其他流程或外部系統</span>
        <span style={{ color: WARNING }}>虛線：否或失敗</span>
      </div>
    </div>
  );
}
