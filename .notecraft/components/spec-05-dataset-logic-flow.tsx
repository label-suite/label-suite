import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MousePointerClick, RotateCcw } from "lucide-react";

/**
 * 05 資料集 Logic Flow：跨頁的操作邏輯流程（docs/specs/05-dataset/index.mdx §Logic Flow）。
 *
 * 四種標準流程圖符號：起訖（圓角膠囊）、頁面（矩形）、判斷（菱形）、其他流程或外部系統（雙邊框矩形）。
 * 節點編號、分段與出處都和 index.mdx 的文字版逐項一致；文字版沒有的連線不畫，缺口只以灰色註記標示。
 */

/* ================================================================ 【骨架】不可修改 ================================================================ */

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

/** terminal 起訖、page 本模組的頁面、decision 判斷、module 其他模組的流程、external 外部系統或收信 */
type NodeKind = "terminal" | "page" | "decision" | "module" | "external";

/** plain 一般、yes 判斷的「是」、no 判斷的「否」或失敗 */
type EdgeKind = "plain" | "yes" | "no";

interface FlowNode {
  /** 與文字版相同的編號：S、E（有明確終點的模組才有）、P1…、D1…、X1… */
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
  /** 文字版的條目，含出處；起訖連線沒有規格出處 */
  text: string;
}

interface Gap {
  x: number;
  y: number;
  lines: string[];
}

interface Section {
  id: string;
  label: string;
  w: number;
  h: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  gaps: Gap[];
}

/* ---------------------------------------------------------------- 共用節點輔助：依下方 NOTE 查出處說明 */

function n(id: string, kind: NodeKind, lines: string[], x: number, y: number, w: number, h: number): FlowNode {
  return { id, kind, lines, x, y, w, h, note: NOTE[id] ?? id };
}

/* ================================================================ 【節點與連線】依模組填寫 ================================================================ */

/* ---------------------------------------------------------------- 模組名稱（顯示於 aria-label） */

const MODULE_LABEL = "05 資料集";

/* ---------------------------------------------------------------- 共用節點（同一個編號在不同分段重複出現） */

const NOTE: Record<string, string> = {
  S: "開始：使用者直接貼一個網址進分析詳情（含舊連結或無效的任務代號）；網址帶著合法的分頁參數時落在該分頁，沒帶時落在統計總覽（規格 05-02 §邊界情況（Edge Case）「進入」第 1、3 條）",
  P1: "05-01 分析列表（規格 05-01 §業務流程）",
  P2: "05-02 分析詳情（規格 05-02 §業務流程）；統計總覽與品質監控是同一頁的兩個分頁，切換是頁內切換",
  D1: "判斷：在目前任務是專案負責人或審核員嗎？（側欄導覽項的卡控）",
  D2: "判斷：任務代號與成員資格都過得了嗎？",
  X1: "其他模組：07-01 側欄導覽的「資料集分析」",
  X2: "其他模組：03-01 任務列表",
  X3: "其他模組：02-01 儀表板上的「IAA 待確認」提醒（事件名與消費端見規格 07-04 §事件清單 第 8 列）",
  X4: "其他模組：03-03 任務詳情",
};

/* ---------------------------------------------------------------- 資料：每個分段，與該模組 index.mdx 文字版的分段逐項一致 */

const SECTIONS: Section[] = [
  {
    id: "entry",
    label: "進到分析列表",
    w: 670,
    h: 172,
    nodes: [
      n("X1", "module", ["07-01", "側欄「資料集分析」"], 98, 120, 150, 44),
      n("D1", "decision", ["專案負責人", "或審核員？"], 318, 120, 150, 68),
      n("X2", "module", ["03-01", "任務列表"], 568, 45, 130, 44),
      n("P1", "page", ["05-01", "分析列表"], 568, 120, 130, 44),
    ],
    edges: [
      { id: "1-1", from: "X1", to: "D1", kind: "plain", pts: [[173, 120], [243, 120]], text: "X1 側欄點「資料集分析」→ D1（系統先確認任務角色；07-01 §進入模組的條件 第 2 條；05-01 §業務流程「進到分析列表」主流程第 1 步、§模組入口 第 3 條前半「主要入口是側欄的「資料集分析」」）" },
      { id: "1-2", from: "D1", to: "X2", kind: "no", pts: [[318, 86], [318, 45], [503, 45]], label: "否", lp: [336, 68], text: "D1 否 → X2 任務列表（擋下進入，回到任務列表並顯示說明；07-01 §進入模組的條件 第 3 條、§卡控機制「使用者在目前任務不是專案負責人也不是審核員」那一列、§驗收標準「沒有任務角色時點擊資料集分析」、§已確認決議 Q9）" },
      { id: "1-3", from: "D1", to: "P1", kind: "yes", pts: [[393, 120], [503, 120]], label: "是", lp: [443, 110], text: "D1 是 → P1 分析列表（進入資料集分析列表，看到他在成員資格內的任務；07-01 §進入模組的條件 第 2 條；05-01 §業務流程「進到分析列表」主流程第 2、4 步與結果、§驗收標準「側欄進來是分析列表」）" },
    ],
    gaps: [],
  },
  {
    id: "detail",
    label: "從列表進分析詳情",
    w: 685,
    h: 210,
    nodes: [
      n("P1", "page", ["05-01", "分析列表"], 80, 90, 130, 44),
      n("S", "terminal", ["開始"], 80, 175, 80, 36),
      n("D2", "decision", ["任務代號與", "成員資格都過？"], 320, 90, 180, 72),
      n("P2", "page", ["05-02", "分析詳情"], 590, 90, 140, 44),
    ],
    edges: [
      { id: "2-1", from: "P1", to: "D2", kind: "plain", pts: [[145, 90], [230, 90]], label: "點任一列", lp: [187, 80], text: "P1 點任一任務列 → D2（整列都可點，不只任務名稱；05-01 §點任務列進入分析詳情 第 1、2 條、§業務流程「從列表挑一個任務」主流程第 3 步、§驗收標準「點列進統計總覽」「整列可點」；05-02 §兩個合法入口 第 1 條）" },
      { id: "2-2", from: "S", to: "D2", kind: "plain", pts: [[120, 175], [320, 175], [320, 126]], label: "直接貼網址", lp: [220, 167], text: "S → D2（起訖連線，無規格條文；05-01 §點任務列進入分析詳情 第 3 條把「用舊連結或無效的任務代號直接進詳情」交給 05-02 處理；05-02 §邊界情況（Edge Case）「進入」第 1 條）" },
      { id: "2-3", from: "D2", to: "P1", kind: "no", pts: [[320, 54], [320, 25], [80, 25], [80, 68]], label: "否：導回分析列表", lp: [200, 17], text: "D2 否 → P1 分析列表（任務代號不存在、沒有專案負責人或審核員的成員資格、任務角色缺少或認不得、或任務已經封存，一律導回分析列表，由那一頁顯示「找不到指定的任務，或你沒有該任務的存取權限。」；05-02 §進來先驗兩件事：任務代號與成員資格 第 1～7 條、§業務流程「進入某個任務的分析詳情」E1、§卡控機制 前四條、§驗收標準「任務代號不存在時導回列表」「首次打開已封存任務被擋」；05-01 §點任務列進入分析詳情 第 3 條）" },
      { id: "2-4", from: "D2", to: "P2", kind: "yes", pts: [[410, 90], [520, 90]], label: "是：落在統計總覽", lp: [465, 80], text: "D2 是 → P2 分析詳情，落在統計總覽（沒帶分頁參數、或參數不是兩個合法值之一時一律落在統計總覽；05-01 §點任務列進入分析詳情 第 1 條；05-02 §兩個合法入口 第 1 條、§分頁列與網址上的分頁參數 第 4、5 條、§業務流程「進入某個任務的分析詳情」A1、§驗收標準「從分析列表進來落在統計總覽」）" },
    ],
    gaps: [],
  },
  {
    id: "reminder",
    label: "儀表板的提醒進品質監控",
    w: 735,
    h: 200,
    nodes: [
      n("X3", "module", ["02-01", "「IAA 待確認」提醒"], 115, 72, 190, 44),
      n("D2", "decision", ["任務代號與", "成員資格都過？"], 370, 72, 180, 72),
      n("P1", "page", ["05-01", "分析列表"], 370, 160, 130, 44),
      n("P2", "page", ["05-02", "分析詳情"], 640, 72, 140, 44),
    ],
    edges: [
      { id: "3-1", from: "X3", to: "D2", kind: "plain", pts: [[210, 72], [280, 72]], label: "點提醒", lp: [245, 62], text: "X3 點儀表板的「IAA 待確認」提醒 → D2（這是深層連結，必須把任務上下文一併載入，不得只是切到分頁卻沒有資料；05-02 §兩個合法入口 第 2、3 條、§業務流程「進入某個任務的分析詳情」觸發；07-04 §事件清單 第 8 列）" },
      { id: "3-2", from: "D2", to: "P1", kind: "no", pts: [[370, 108], [370, 138]], label: "否：導回分析列表", lp: [430, 127], text: "D2 否 → P1 分析列表（同一道卡控不分入口：「不管從哪個入口進來，系統都先驗任務代號與成員資格，過不了就不渲染任何內容」；05-02 §進來先驗兩件事：任務代號與成員資格 開頭與第 1～3 條）" },
      { id: "3-3", from: "D2", to: "P2", kind: "yes", pts: [[460, 72], [570, 72]], label: "是：落在品質監控", lp: [515, 62], text: "D2 是 → P2 分析詳情，直接落在品質監控（05-02 §兩個合法入口 第 2 條、§驗收標準「從儀表板提醒進來落在品質監控」；該任務的試標還沒完成時落在品質監控的空狀態、外殼與分頁列都在，見 §邊界情況（Edge Case）「進入」第 2 條）" },
    ],
    gaps: [{ x: 160, y: 120, lines: ["儀表板的徽章深連結：規格沒指定是哪一個控制項、", "也沒指定落在哪一頁（缺口一，不畫）"] }],
  },
  {
    id: "leave",
    label: "從分析詳情離開",
    w: 685,
    h: 255,
    nodes: [
      n("P1", "page", ["05-01", "分析列表"], 85, 140, 130, 44),
      n("P2", "page", ["05-02", "分析詳情"], 325, 140, 150, 56),
      n("X4", "module", ["03-03", "任務詳情"], 590, 70, 140, 44),
    ],
    edges: [
      { id: "4-1", from: "P2", to: "P1", kind: "plain", pts: [[250, 140], [150, 140]], label: "麵包屑第一段", lp: [200, 132], text: "P2 點麵包屑第一段 → P1 分析列表（麵包屑固定是「資料集分析 › 〈任務名稱〉」，第一段連回分析列表；05-02 §頁首與麵包屑 第 3 條）" },
      { id: "4-2", from: "P2", to: "P1", kind: "plain", pts: [[325, 112], [325, 50], [85, 50], [85, 118]], label: "瀏覽器上一頁", lp: [205, 42], text: "P2 按瀏覽器的「上一頁」→ P1 分析列表（切換分頁不留歷程，所以上一頁是離開這一頁、回到進來之前的地方；05-02 §分頁列與網址上的分頁參數 第 8 條、§已確認決議 Q1、§驗收標準「上一頁離開這一頁」；回到列表時那五個查詢條件都還原，見 05-01 §查詢條件保留在網址 第 1、3 條、§邊界情況（Edge Case）「從分析詳情返回這一頁」、§驗收標準「從詳情返回還原條件」）" },
      { id: "4-3", from: "P2", to: "P1", kind: "no", pts: [[325, 168], [325, 196], [85, 196], [85, 162]], label: "資格失效，下一次讀取", lp: [205, 186], text: "P2 成員資格被移除或任務被封存，下一次讀取 → P1 分析列表（不等使用者自己離開，已載入的內容不再顯示；05-02 §業務流程「停在頁面上之後資格失效」主流程第 2、3 步、§卡控機制「載入後成員資格被移除或任務被封存」那一條、§已確認決議 Q5、§驗收標準「資格失效在下一次讀取時擋住」）" },
      { id: "4-4", from: "P2", to: "X4", kind: "plain", pts: [[400, 124], [480, 124], [480, 70], [520, 70]], label: "空狀態", lp: [440, 116], text: "P2 兩個分頁的空狀態各有一顆「前往任務詳情」→ X4 任務詳情（統計總覽在還沒有任何已提交的標記時、品質監控在試標還沒完成時；05-02 §統計總覽的空狀態 第 2、3 條、§品質監控要先有試標才有東西看 第 1、2 條、§卡控機制 那兩條、§驗收標準「空狀態的按鈕導向任務詳情」「試標沒完成時品質監控是空狀態」）" },
      { id: "4-5", from: "P2", to: "X4", kind: "plain", pts: [[400, 140], [590, 140], [590, 92]], label: "調整參與狀態", lp: [535, 132], text: "P2 專案負責人在風險表點「調整參與狀態」→ X4 任務詳情的成員管理分頁（05-02 §建議行動只有專案負責人能執行 第 1、2、4 條、§卡控機制「調整參與狀態」那一條、§驗收標準「調整參與狀態導向成員管理」；03-03 §成員管理）" },
    ],
    gaps: [],
  },
];

/* ================================================================ 【骨架】不可修改 ================================================================ */

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

export default function Spec05DatasetLogicFlow(): ReactElement {
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
            {`分段${["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][i] ?? i + 1}：${s.label}`}
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
            aria-label={`${MODULE_LABEL} Logic Flow：${section.label}；用 Tab 移到節點或連線，按 Enter 看出處`}
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

            {section.gaps.map((g) => (
              <text key={`${g.x}-${g.y}`} x={g.x} y={g.y} fontFamily={FONT} fontSize={12} fill={MUTED} textAnchor={g.x > section.w / 2 ? "start" : "middle"} opacity={active ? DIM : 1}>
                {g.lines.map((line, i) => (
                  <tspan key={line} x={g.x} dy={i === 0 ? 0 : 15}>
                    {line}
                  </tspan>
                ))}
              </text>
            ))}
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
