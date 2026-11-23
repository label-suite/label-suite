import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MousePointerClick, RotateCcw } from "lucide-react";

/**
 * 03 任務管理 Logic Flow：跨頁的操作邏輯流程（docs/specs/03-task-management/index.mdx §Logic Flow）。
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
  /** 與文字版相同的編號：S、P1～P3、D1～D7、X1～X2 */
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

const MODULE_LABEL = "03 任務管理";

/* ---------------------------------------------------------------- 共用節點（同一個編號在不同分段重複出現） */

const NOTE: Record<string, string> = {
  S: "開始：使用者直接用網址打開新增任務或任務詳情",
  P1: "03-01 任務列表（規格 03-01 §業務流程）",
  P2: "03-02 新增任務（規格 03-02 §業務流程）",
  P3: "03-03 任務詳情（規格 03-03 §業務流程）",
  D1: "判斷：權限矩陣「檢視任務列表」那一格允許嗎？",
  D2: "判斷：看得了這個任務的詳情嗎？",
  D3: "判斷：有建立任務的權限嗎？",
  D4: "判斷：任務建立成功了嗎？",
  D5: "判斷：已經改過東西嗎？",
  D6: "判斷：在這個任務是專案負責人或審核員嗎？",
  D7: "判斷：是權限被撤銷，而不是從來沒有角色嗎？",
  X1: "其他模組：07-01 側欄導覽",
  X2: "其他模組：04-02 標記工作區",
};

/* ---------------------------------------------------------------- 資料：每個分段，與該模組 index.mdx 文字版的分段逐項一致 */

const SECTIONS: Section[] = [
  {
    id: "enter",
    label: "進入任務列表與分岔",
    w: 880,
    h: 320,
    nodes: [
      n("X1", "module", ["07-01", "側欄導覽"], 90, 150, 130, 44),
      n("D1", "decision", ["能檢視列表？"], 280, 150, 130, 60),
      n("P1", "page", ["03-01", "任務列表"], 460, 150, 120, 44),
      n("D2", "decision", ["看得了詳情？"], 640, 150, 130, 60),
      n("P3", "page", ["03-03", "任務詳情"], 800, 150, 120, 44),
      n("P2", "page", ["03-02", "新增任務"], 460, 270, 120, 44),
    ],
    edges: [
      { id: "1-1", from: "X1", to: "D1", kind: "plain", pts: [[155, 150], [215, 150]], label: "任務管理", lp: [185, 140], text: "X1 側欄點「任務管理」→ D1（07-01 §導覽項目與可見性 第 1 條與該節「任務管理對 03」的註；03-01 §業務流程「進到任務列表」觸發）" },
      { id: "1-2", from: "D1", to: "P1", kind: "yes", pts: [[345, 150], [400, 150]], label: "是", lp: [372, 140], text: "D1 是 → P1 任務列表（03-01 §業務流程「進到任務列表」主流程第 1～3 步；§誰看得到哪些任務 第 6、8 條）" },
      { id: "1-3", from: "P1", to: "D2", kind: "plain", pts: [[520, 150], [575, 150]], label: "點任務列", lp: [547, 140], text: "P1 點任務列或那一列的「編輯」→ D2（03-01 §點任務進入任務詳情 第 1、2 條；§業務流程「從列表進入任務詳情」主流程第 1～2 步）" },
      { id: "1-4", from: "D2", to: "P3", kind: "yes", pts: [[705, 150], [740, 150]], label: "是", lp: [722, 140], text: "D2 是 → P3 任務詳情（03-01 §點任務進入任務詳情 第 1、2 條；§業務流程「從列表進入任務詳情」主流程第 3 步；03-03 §業務流程「進入任務詳情」觸發、主流程第 2～3 步）" },
      { id: "1-5", from: "D2", to: "P1", kind: "no", pts: [[640, 120], [640, 95], [480, 95], [480, 128]], label: "否", lp: [656, 105], text: "D2 否 → 停在 P1（顯示「無權限檢視任務詳情」，不跳頁；03-01 §點任務進入任務詳情 第 3 條；§業務流程「從列表進入任務詳情」E1；§卡控機制「使用者點的任務他看不了詳情」；§驗收標準「沒有權限時停在列表」）" },
      { id: "1-6", from: "P1", to: "P2", kind: "plain", pts: [[460, 172], [460, 248]], label: "新增任務", lp: [408, 210], text: "P1 點「新增任務」→ P2 新增任務（03-01 §新增任務 第 1、2 條；§業務流程「從列表進入任務詳情」A1；§驗收標準「點新增任務」）" },
    ],
    gaps: [{ x: 280, y: 215, lines: ["否：規格沒指定落點", "（缺口一，不畫）"] }],
  },
  {
    id: "create",
    label: "新增任務這條單行道",
    w: 880,
    h: 320,
    nodes: [
      n("P1", "page", ["03-01", "任務列表"], 85, 90, 120, 44),
      n("S", "terminal", ["直接開網址"], 85, 270, 96, 36),
      n("D3", "decision", ["有建立權限？"], 275, 160, 130, 60),
      n("P2", "page", ["03-02", "新增任務"], 460, 160, 120, 44),
      n("D4", "decision", ["建立成功？"], 645, 160, 110, 60),
      n("P3", "page", ["03-03", "任務詳情"], 800, 160, 120, 44),
    ],
    edges: [
      { id: "2-1", from: "P1", to: "D3", kind: "plain", pts: [[85, 112], [85, 160], [210, 160]], label: "新增任務", lp: [147, 150], text: "P1 點「新增任務」→ D3（03-01 §新增任務 第 1 條；03-02 §業務流程「填完基本資料」觸發與前置條件）" },
      { id: "2-2", from: "S", to: "D3", kind: "plain", pts: [[133, 270], [275, 270], [275, 190]], text: "S → D3（起訖連線，無規格條文；03-02 §邊界情況「沒有建立任務權限的人直接打開這一頁」是這個入口）" },
      { id: "2-3", from: "D3", to: "P2", kind: "yes", pts: [[340, 160], [400, 160]], label: "是", lp: [370, 150], text: "D3 是 → P2 新增任務的第一步（03-02 §業務流程「填完基本資料」主流程第 1 步；§四個步驟 第 1～3 條）" },
      { id: "2-4", from: "P2", to: "D4", kind: "plain", pts: [[520, 160], [590, 160]], label: "建立任務", lp: [555, 150], text: "P2 四個步驟都過關、點「建立任務」→ D4（03-02 §建立任務 第 1 條；§業務流程「建立任務」主流程第 2 步；§四個步驟 第 4 條）" },
      { id: "2-5", from: "D4", to: "P3", kind: "yes", pts: [[700, 160], [740, 160]], label: "是", lp: [720, 150], text: "D4 是 → P3 任務詳情（03-02 §建立任務 第 2 條；§業務流程「建立任務」主流程第 3 步與結果；§驗收標準「建立成功後前往任務詳情」）" },
    ],
    gaps: [
      { x: 350, y: 230, lines: ["否：規格沒指定落點", "（缺口二，不畫）"] },
      { x: 660, y: 230, lines: ["失敗：規格沒指定落點", "（缺口三，不畫）"] },
    ],
  },
  {
    id: "leave-new",
    label: "中途離開新增任務",
    w: 700,
    h: 200,
    nodes: [
      n("P2", "page", ["03-02", "新增任務"], 120, 120, 120, 44),
      n("D5", "decision", ["改過東西？"], 340, 120, 110, 60),
      n("P1", "page", ["03-01", "任務列表"], 580, 120, 120, 44),
    ],
    edges: [
      { id: "3-1", from: "P2", to: "D5", kind: "plain", pts: [[180, 120], [285, 120]], label: "取消或離開", lp: [232, 110], text: "P2 點「取消」，或要離開這一頁（點側欄、關分頁）→ D5（03-02 §離開這一頁與重新整理 第 1 條；§業務流程「中途離開或重新整理」主流程第 1～3 步）" },
      { id: "3-2", from: "D5", to: "P1", kind: "yes", pts: [[340, 90], [340, 45], [580, 45], [580, 98]], label: "是：確認後離開", lp: [460, 37], text: "D5 是 → P1 任務列表（顯示「離開此頁面？」，選「離開」就回到任務列表、不建立任務；03-02 §離開這一頁與重新整理 第 1、2 條；§業務流程「中途離開或重新整理」主流程第 4～5 步；§驗收標準「選離開就不建立任務」）" },
      { id: "3-3", from: "D5", to: "P1", kind: "no", pts: [[395, 120], [520, 120]], label: "否：不跳確認", lp: [457, 110], text: "D5 否 → P1 任務列表（完全沒有改過任何東西就不跳確認，直接回到任務列表；03-02 §離開這一頁與重新整理 該節補充條「完全沒有改過任何東西時，點「取消」或離開不會跳確認」；§業務流程「中途離開或重新整理」A2；§邊界情況「什麼都沒填就點「取消」」）" },
    ],
    gaps: [],
  },
  {
    id: "detail-entry",
    label: "直接打開任務詳情",
    w: 860,
    h: 340,
    nodes: [
      n("S", "terminal", ["直接開網址"], 80, 160, 96, 36),
      n("D6", "decision", ["有負責或審核？"], 285, 160, 150, 60),
      n("P3", "page", ["03-03", "任務詳情"], 700, 80, 120, 44),
      n("D7", "decision", ["權限被撤銷？"], 285, 270, 130, 60),
      n("P1", "page", ["03-01", "任務列表"], 520, 265, 120, 44),
    ],
    edges: [
      { id: "4-1", from: "S", to: "D6", kind: "plain", pts: [[128, 160], [210, 160]], text: "S → D6（起訖連線，無規格條文；03-03 §誰進得來、誰看得到哪些分頁 第 1 條的「直接開這一頁」是這個入口）" },
      { id: "4-2", from: "D6", to: "P3", kind: "yes", pts: [[285, 130], [285, 80], [640, 80]], label: "是", lp: [301, 100], text: "D6 是 → P3 任務詳情（顯示共用的任務標頭與六個分頁、停在概覽；03-03 §誰進得來、誰看得到哪些分頁 表格前兩列與第 5 條；§業務流程「進入任務詳情」主流程第 2～3 步）" },
      { id: "4-3", from: "D6", to: "D7", kind: "no", pts: [[285, 190], [285, 240]], label: "否", lp: [301, 215], text: "D6 否 → D7（03-03 §誰進得來、誰看得到哪些分頁 把第 1 條與第 4 條分成兩種情境，同節末段註「第 4 條與第 1 條的差別在於系統知道多少」）" },
      { id: "4-4", from: "D7", to: "P3", kind: "yes", pts: [[285, 300], [700, 300], [700, 102]], label: "是：留在本頁", lp: [420, 315], text: "D7 是 → 留在 P3（顯示一張無權限面板，面板上有任務編號與一個回任務列表的連結；03-03 §誰進得來、誰看得到哪些分頁 第 4 條；§邊界情況「任務存在、但這個人的權限被撤銷」；§驗收標準「權限被撤銷時留在本頁」）" },
      { id: "4-5", from: "D7", to: "P1", kind: "no", pts: [[350, 270], [460, 270]], label: "否", lp: [405, 260], text: "D7 否 → P1 任務列表（只有標記員的角色，或在這個任務完全沒有角色（含沒有任務角色的系統管理員）→ 帶回任務列表並顯示無權限提示；03-03 §誰進得來、誰看得到哪些分頁 第 1 條；§業務流程「進入任務詳情」E1；§卡控機制「使用者在這個任務只有標記員的角色」；§邊界情況「專案負責人被移出這個任務之後重新整理」；§驗收標準「標記員被帶回任務列表」「沒有任務角色的系統管理員進不來」；03-01 §點任務進入任務詳情 第 4 條；§驗收標準「從詳情被退回也要有說明」）" },
    ],
    gaps: [{ x: 450, y: 205, lines: ["任務不存在或已封存：落點兩份規格相反", "（缺口五，不畫）"] }],
  },
  {
    id: "detail-exit",
    label: "從任務詳情離開",
    w: 720,
    h: 300,
    nodes: [
      n("P3", "page", ["03-03", "任務詳情"], 150, 150, 130, 44),
      n("P1", "page", ["03-01", "任務列表"], 440, 60, 120, 44),
      n("X2", "module", ["04-02", "標記工作區"], 440, 250, 140, 44),
    ],
    edges: [
      { id: "5-1", from: "P3", to: "P1", kind: "plain", pts: [[180, 128], [180, 60], [380, 60]], label: "麵包屑第 1 層", lp: [275, 52], text: "P3 點麵包屑第 1 層「任務管理」→ P1 任務列表（03-03 §共用任務標頭 第 3 條；§驗收標準「標頭顯示任務名稱與階段」）" },
      { id: "5-2", from: "P3", to: "P1", kind: "plain", pts: [[215, 150], [430, 150], [430, 82]], label: "回任務列表", lp: [310, 142], text: "P3 無權限面板點「回任務列表」→ P1 任務列表（03-03 §誰進得來、誰看得到哪些分頁 第 4 條；07-03 §畫面的組成 第 5 條、§返回操作的去處 第 1、2 條）" },
      { id: "5-3", from: "P3", to: "X2", kind: "plain", pts: [[150, 172], [150, 250], [370, 250]], label: "進入處置畫面", lp: [255, 242], text: "P3 最終例外池某一列點「進入處置畫面」→ X2 標記工作區（帶著完整的審核單位身分與爭議項識別；03-03 §最終例外池 第 6、7 條；04-02 §最終例外池是最後一道出口）" },
    ],
    gaps: [{ x: 470, y: 170, lines: ["Email 邀請的落點：規格沒指定", "（缺口四，不畫）"] }],
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

export default function Spec03TaskManagementLogicFlow(): ReactElement {
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
