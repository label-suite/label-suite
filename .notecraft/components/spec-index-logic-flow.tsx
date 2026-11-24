import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MousePointerClick, RotateCcw } from "lucide-react";

/**
 * 全系統 Logic Flow：模組之間的移動（docs/specs/index.mdx §Logic Flow）。
 *
 * 每個模組收成一個節點，07-01 側欄照各模組畫出的連線出現成一個節點；連線的 text 與文字版的分段清單逐字一致。
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

const MODULE_LABEL = "全系統";

/* ---------------------------------------------------------------- 共用節點（同一個編號在不同分段重複出現） */

const NOTE: Record<string, string> = {
  S: "開始：使用者打開平台",
  "01": "01 帳號：登入、註冊、用一次性連結設定密碼、個人設定與登入狀態（模組 01 §Logic Flow）",
  "02": "02 儀表板：登入後的第一頁，依任務角色把人分流出去（模組 02 §Logic Flow）",
  "03": "03 任務管理：任務列表、新增任務與任務詳情（模組 03 §Logic Flow）",
  "04": "04 標記作業：標記清單與標記工作區（模組 04 §Logic Flow）",
  "05": "05 資料集：分析列表與分析詳情（模組 05 §Logic Flow）",
  "06": "06 系統管理：使用者管理與角色設定（模組 06 §Logic Flow）",
  X1: "其他流程：07-01 側欄導覽（07 共用介面沒有自己的 §Logic Flow；03、04、05、06 把它畫成進入本模組的起點）",
};

/* ---------------------------------------------------------------- 資料：每個分段，與 docs/specs/index.mdx §Logic Flow 文字版的分段逐項一致 */

const SECTIONS: Section[] = [
  {
    id: "entry",
    label: "進入平台與回到登入頁",
    w: 600,
    h: 210,
    nodes: [
      n("S", "terminal", ["開始"], 50, 110, 76, 36),
      n("01", "page", ["帳號"], 200, 110, 120, 140),
      n("02", "page", ["儀表板"], 520, 110, 120, 140),
    ],
    edges: [
      { id: "1-1", from: "S", to: "01", kind: "plain", pts: [[88, 110], [140, 110]], text: "S → 01 帳號（起訖連線，無規格條文）" },
      { id: "1-2", from: "01", to: "02", kind: "plain", pts: [[260, 62], [460, 62]], label: "登入成功 → 02-01", lp: [360, 56], text: "01 帳號 登入、用 Google 帳號登入或用註冊驗證連結完成註冊，或本來就已登入 → 02 儀表板（01 §Logic Flow 分段一第 2、5、8 條、分段二第 5 條；02 §Logic Flow 節點 S）" },
      { id: "1-3", from: "02", to: "01", kind: "no", pts: [[460, 92], [260, 92]], label: "未登入或角色無效 → 01-01", lp: [360, 86], text: "02 儀表板 未登入或系統角色無效 → 01 帳號的 01-01 登入頁（02 §Logic Flow 分段一第 2 條）" },
      { id: "1-4", from: "02", to: "01", kind: "plain", pts: [[460, 122], [260, 122]], label: "登出或時間到 → 01-05", lp: [360, 116], text: "02 儀表板 點側欄「登出」，或時間到了 → 01 帳號，經 01-05 登入狀態結束回到 01-01 登入頁（02 §Logic Flow 分段五第 3 條；01 §Logic Flow 分段四第 7、10 條）" },
      { id: "1-5", from: "02", to: "01", kind: "plain", pts: [[460, 152], [260, 152]], label: "側欄「個人設定」→ 01-04", lp: [360, 146], text: "02 儀表板 點側欄「個人設定」→ 01 帳號的 01-04 個人設定頁（02 §Logic Flow 分段五第 1 條；01 §Logic Flow 盤點「沒畫的進入」）" },
    ],
    gaps: [],
  },
  {
    id: "dashboard",
    label: "從儀表板進任務管理與標記作業",
    w: 550,
    h: 310,
    nodes: [
      n("02", "page", ["儀表板"], 80, 155, 120, 270),
      n("03", "page", ["任務管理"], 470, 40, 120, 40),
      n("04", "page", ["標記作業"], 470, 185, 120, 210),
    ],
    edges: [
      { id: "2-1", from: "02", to: "03", kind: "plain", pts: [[140, 40], [410, 40]], label: "卡 A、等待 IAA 確認、查看全部 → 03-01", lp: [275, 34], text: "02 儀表板 按行動入口卡 A「開始建立任務」、點「等待 IAA 確認」數值或「查看全部」→ 03 任務管理的 03-01 任務列表（02 §Logic Flow 分段一第 4 條、分段二第 1、2 條；03 §Logic Flow 盤點「沒畫的進入」）" },
      { id: "2-2", from: "02", to: "04", kind: "plain", pts: [[140, 100], [410, 100]], label: "行動卡 B、C → 04-01", lp: [275, 94], text: "02 儀表板 按行動入口卡 B「開始標記」或卡 C「開始審核」→ 04 標記作業的 04-01 標記清單（02 §Logic Flow 分段一第 5、6 條；04 §Logic Flow 分段一第 5 條）" },
      { id: "2-3", from: "02", to: "04", kind: "plain", pts: [[140, 128], [410, 128]], label: "快速區以外 → 04-01", lp: [275, 122], text: "02 儀表板 點任務列「快速繼續／快速審核」以外的地方 → 04 標記作業的 04-01 標記清單（02 §Logic Flow 分段三第 4 條、分段四第 4 條；04 §Logic Flow 分段一第 4 條）" },
      { id: "2-4", from: "02", to: "04", kind: "plain", pts: [[140, 156], [410, 156]], label: "快速入口有下一筆 → 04-02（待裁定）", lp: [275, 150], text: "02 儀表板 「快速繼續」找到要做的資料，或「快速審核」推導得出可處理的審核單位 → 04 標記作業的 04-02 標記工作區（02 §Logic Flow 分段三第 2 條、分段四第 2 條；04 §Logic Flow 分段三第 1、4～6 條；標記員落在哪一筆，02 與規格 04-01 §兩種入口並存 第 5 條說法相反，待維護者裁定）" },
      { id: "2-5", from: "02", to: "04", kind: "plain", pts: [[140, 184], [410, 184]], label: "快速審核沒有可處理 → 04-01", lp: [275, 178], text: "02 儀表板 「快速審核」推導不出可處理的審核單位 → 04 標記作業的 04-01 標記清單（02 §Logic Flow 分段四第 3 條；04 §Logic Flow 分段三第 7 條）" },
      { id: "2-6", from: "02", to: "04", kind: "plain", pts: [[140, 212], [410, 212]], label: "快速繼續全部已提交 → 04-01（待裁定）", lp: [275, 206], text: "02 儀表板 「快速繼續」時任務的資料全部已提交 → 04 標記作業的 04-01 標記清單（02 §Logic Flow 分段三第 3 條；04 §Logic Flow 沒有這一條，而規格 04-01 §兩種入口並存 第 5 條說法相反，待維護者裁定）" },
      { id: "2-7", from: "04", to: "02", kind: "plain", pts: [[410, 240], [140, 240]], label: "麵包屑第 1 層", lp: [275, 234], text: "04 標記作業 在標記清單或標記工作區點麵包屑第 1 層 → 02 儀表板（04 §Logic Flow 分段一第 13 條、分段四第 5、6 條、分段五第 2 條）" },
      { id: "2-8", from: "04", to: "02", kind: "plain", pts: [[410, 268], [140, 268]], label: "改過審核狀態後回來", lp: [275, 262], text: "04 標記作業 審核員在標記工作區改過審核單位的狀態後回到 02 儀表板，摘要與進度條立刻反映（02 §Logic Flow 分段四第 5 條）" },
    ],
    gaps: [],
  },
  {
    id: "sidebar",
    label: "側欄進各模組",
    w: 620,
    h: 330,
    nodes: [
      n("X1", "module", ["07-01", "側欄導覽"], 90, 170, 120, 264),
      n("04", "page", ["標記作業"], 320, 50, 120, 44),
      n("03", "page", ["任務管理"], 320, 130, 120, 44),
      n("05", "page", ["資料集"], 320, 210, 120, 44),
      n("06", "page", ["系統管理"], 320, 290, 120, 44),
      n("02", "page", ["儀表板"], 540, 50, 120, 44),
    ],
    edges: [
      { id: "3-1", from: "X1", to: "03", kind: "plain", pts: [[150, 130], [260, 130]], label: "任務管理", lp: [205, 124], text: "X1 側欄 點「任務管理」→ 03 任務管理的 03-01 任務列表（03 §Logic Flow 分段一第 1、2 條）" },
      { id: "3-2", from: "X1", to: "04", kind: "plain", pts: [[150, 50], [260, 50]], label: "標記作業", lp: [205, 44], text: "X1 側欄 點「標記作業」→ 04 標記作業的 04-01 標記清單（04 §Logic Flow 分段一第 1、3 條；02 §Logic Flow 分段五第 2 條）" },
      { id: "3-3", from: "X1", to: "05", kind: "plain", pts: [[150, 210], [260, 210]], label: "資料集分析", lp: [205, 204], text: "X1 側欄 點「資料集分析」→ 05 資料集的 05-01 分析列表（05 §Logic Flow 分段一第 1、3 條）" },
      { id: "3-4", from: "X1", to: "06", kind: "plain", pts: [[150, 290], [260, 290]], label: "系統管理", lp: [205, 284], text: "X1 側欄 點「系統管理」或次選單的「角色設定」→ 06 系統管理的 06-01 使用者管理或 06-02 角色設定（06 §Logic Flow 分段一第 2、6、7 條）" },
      { id: "3-5", from: "04", to: "02", kind: "no", pts: [[380, 50], [480, 50]], label: "沒有任務角色", lp: [430, 44], text: "04 標記作業 側欄的「標記作業」被擋下：在任何一個任務都沒有任務角色 → 02 儀表板（04 §Logic Flow 分段一第 2 條）" },
      { id: "3-6", from: "05", to: "03", kind: "no", pts: [[350, 188], [350, 152]], label: "不是負責人或審核員", lp: [418, 174], text: "05 資料集 側欄的「資料集分析」被擋下：在目前任務不是專案負責人也不是審核員 → 03 任務管理的 03-01 任務列表（05 §Logic Flow 分段一第 2 條；03 §Logic Flow 盤點「沒畫的進入」）" },
    ],
    gaps: [],
  },
  {
    id: "between",
    label: "儀表板、任務管理、標記作業與資料集之間",
    w: 810,
    h: 230,
    nodes: [
      n("02", "page", ["儀表板"], 70, 150, 100, 44),
      n("05", "page", ["資料集"], 350, 150, 120, 120),
      n("03", "page", ["任務管理"], 630, 110, 120, 44),
      n("04", "page", ["標記作業"], 630, 190, 120, 44),
    ],
    edges: [
      { id: "4-1", from: "03", to: "04", kind: "plain", pts: [[670, 132], [670, 168]], label: "最終例外池 → 04-02", lp: [604, 148], text: "03 任務管理 任務詳情的最終例外池點「進入處置畫面」→ 04 標記作業的 04-02 標記工作區（03 §Logic Flow 分段五第 3 條；04 §Logic Flow 分段五第 1 條）" },
      { id: "4-2", from: "05", to: "03", kind: "plain", pts: [[410, 110], [570, 110]], label: "前往任務詳情 → 03-03", lp: [490, 104], text: "05 資料集 分析詳情兩個空狀態的「前往任務詳情」，或專案負責人點「調整參與狀態」→ 03 任務管理的 03-03 任務詳情（05 §Logic Flow 分段四第 4、5 條；03 §Logic Flow 盤點「沒畫的進入」）" },
      { id: "4-3", from: "02", to: "05", kind: "plain", pts: [[120, 150], [290, 150]], label: "IAA 待確認提醒（待裁定）", lp: [205, 144], text: "02 儀表板 點「IAA 待確認」提醒 → 05 資料集的 05-02 分析詳情，直接落在品質監控（05 §Logic Flow 分段三第 1、3 條；02 §Logic Flow 沒有這一條，待維護者裁定）" },
      { id: "4-4", from: "04", to: "03", kind: "plain", pts: [[685, 168], [685, 132]], label: "例外收尾、側欄 → 03", lp: [742, 154], text: "04 標記作業 專案負責人在例外處置畫面把待處置例外項全部收尾完，或點麵包屑第 2 層 → 03 任務管理的 03-03 任務詳情的最終例外池；處置例外時點側欄的例外處置導覽項 → 03 任務管理的 03-01 任務列表（04 §Logic Flow 分段五第 3、4 條；03 §Logic Flow 沒有這一條）" },
    ],
    gaps: [],
  },
  {
    id: "admin",
    label: "系統管理把人送走",
    w: 580,
    h: 260,
    nodes: [
      n("06", "page", ["系統管理"], 100, 140, 120, 200),
      n("01", "page", ["帳號"], 480, 95, 120, 130),
      n("02", "page", ["儀表板"], 480, 210, 120, 44),
    ],
    edges: [
      { id: "5-1", from: "06", to: "01", kind: "no", pts: [[160, 130], [420, 130]], label: "未登入、停用自己 → 01-01", lp: [290, 124], text: "06 系統管理 未登入的人直接開系統管理的網址，或系統管理員停用自己 → 01 帳號的 01-01 登入頁（06 §Logic Flow 分段一第 3 條、分段四第 1 條）" },
      { id: "5-2", from: "06", to: "02", kind: "no", pts: [[160, 210], [420, 210]], label: "平台成員、被降級 → 02-01", lp: [290, 204], text: "06 系統管理 平台成員直接開系統管理的網址，或系統管理員被降為平台成員 → 02 儀表板（06 §Logic Flow 分段一第 5 條、分段二第 3、4 條）" },
      { id: "5-3", from: "06", to: "01", kind: "plain", pts: [[160, 60], [420, 60]], label: "受邀者開設定密碼連結 → 01-03", lp: [290, 54], text: "06 系統管理 受邀的使用者點設定密碼信裡的連結，或開啟系統管理員從伺服器紀錄轉給他的連結 → 01 帳號的 01-03 設定密碼那一頁（06 §Logic Flow 分段三第 5、6 條；01 §Logic Flow 分段三第 5 條）" },
      { id: "5-4", from: "06", to: "01", kind: "plain", pts: [[160, 95], [420, 95]], label: "停用或改 Email → 01-05", lp: [290, 89], text: "06 系統管理 停用別人的帳號或改掉別人的 Email → 01 帳號的 01-05 登入狀態結束，對方回到 01-01 登入頁（06 §Logic Flow 分段四第 2～4 條；01 §Logic Flow 分段四第 8～10 條）" },
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

export default function SpecIndexLogicFlow(): ReactElement {
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
