import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MousePointerClick, RotateCcw } from "lucide-react";

/**
 * 04 標記作業 Logic Flow：跨頁的操作邏輯流程（docs/specs/04-annotation/index.mdx §Logic Flow）。
 *
 * 四種標準流程圖符號：起訖（圓角膠囊）、頁面（矩形）、判斷（菱形）、其他流程或外部系統（雙邊框矩形）。
 * 節點編號、分段與出處都和 index.mdx 的文字版逐項一致；文字版沒有的連線不畫，缺口只以灰色註記標示。
 * 寫法照 .notecraft/components/spec-01-account-logic-flow.tsx，只換節點與連線的資料。
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
  /** 與文字版相同的編號：S、P1～P2、D1～D8、X1～X3 */
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

/* ---------------------------------------------------------------- 共用節點（同一個編號在不同分段重複出現） */

const NOTE: Record<string, string> = {
  S: "起訖：使用者直接貼一個深連結進入工作區",
  P1: "04-01 標記清單（規格 04-01 §業務流程）",
  P2: "04-02 標記工作區（規格 04-02 §業務流程）",
  D1: "判斷：網址有帶任務嗎？",
  D2: "判斷：任務查得到嗎？",
  D3: "判斷：網址有帶要處理的那一筆嗎？",
  D4: "判斷：那一筆查得到嗎？",
  D5: "判斷：任務設定查得到已發布的那一份嗎？",
  D6: "判斷：任務查得到已發布的設定嗎？（快速入口）",
  D7: "判斷：有可處理的審核單位嗎？（審核員快速入口）",
  D8: "判斷：在目前任務是標記員、審核員或專案負責人嗎？（側欄導覽項的卡控）",
  X1: "其他模組：07-01 側欄導覽",
  X2: "其他模組：02-01 儀表板",
  X3: "其他流程：03-03 任務詳情 §最終例外池",
};

function n(id: string, kind: NodeKind, lines: string[], x: number, y: number, w: number, h: number): FlowNode {
  return { id, kind, lines, x, y, w, h, note: NOTE[id] ?? id };
}

/* ---------------------------------------------------------------- 資料：五個分段，與文字版的分段一～五逐項一致 */

const SECTIONS: Section[] = [
  {
    id: "entry",
    label: "進入清單",
    w: 1100,
    h: 410,
    nodes: [
      n("X1", "module", ["07-01", "側欄導覽"], 85, 90, 140, 44),
      n("D8", "decision", ["是標記員、審核員", "或專案負責人嗎？"], 340, 90, 210, 86),
      n("X2", "module", ["02-01", "儀表板"], 85, 300, 140, 44),
      n("D1", "decision", ["有帶任務？"], 580, 190, 120, 74),
      n("D2", "decision", ["任務查得到？"], 780, 190, 130, 74),
      n("P1", "page", ["04-01", "標記清單"], 980, 190, 120, 48),
    ],
    edges: [
      { id: "1-1", from: "X1", to: "D8", kind: "plain", pts: [[155, 90], [230, 90]], label: "側欄「標記作業」", lp: [192, 80], text: "X1 → D8（側欄點「標記作業」，系統先確認任務角色；07-01 §進入模組的條件 第 1 條；04-01 §開清單 觸發）" },
      { id: "1-2", from: "D8", to: "X2", kind: "no", pts: [[340, 133], [340, 235], [85, 235], [85, 276]], label: "否：擋下，回儀表板", lp: [205, 227], text: "D8 否 → X2（系統擋下，「標記作業」回到儀表板並顯示說明；從側欄點導覽項不適用第 4 條的放寬；07-01 §進入模組的條件 第 3、5 條；07-01 §驗收標準「沒有任務角色時點擊標記作業」）" },
      { id: "1-3", from: "D8", to: "D1", kind: "yes", pts: [[445, 90], [480, 90], [480, 190], [515, 190]], label: "是", lp: [462, 80], text: "D8 是 → D1（進入標記清單；07-01 §進入模組的條件 第 1 條；04-01 §開清單 主流程第 1～2 步）" },
      { id: "1-4", from: "X2", to: "D1", kind: "plain", pts: [[155, 300], [580, 300], [580, 230]], label: "儀表板任務列非快速區", lp: [340, 292], text: "X2 → D1（儀表板任務列的非快速區點進來；04-01 §開清單 觸發；§兩種入口並存 第 2 條）" },
      { id: "1-5", from: "X2", to: "P1", kind: "plain", pts: [[120, 322], [120, 350], [950, 350], [950, 216]], label: "儀表板行動入口卡 B／C", lp: [420, 363], text: "X2 → P1（儀表板「還沒有任務角色」版面的行動入口卡 B「開始標記」或卡 C「開始審核」點進來，不被任務角色擋下，去的是標記模組的入口頁；他在這一頁看到哪一種畫面見下方的缺口三；02-01 §還沒有任務角色的人看到什麼 第 2、3、7 條；02-01 §驗收標準「三張卡的按鈕都走到模組入口頁」；07-01 §進入模組的條件 第 4 條；07-01 §驗收標準「從儀表板行動入口卡進入不被擋下」；04-01 §兩種入口並存 第 1 條）" },
      { id: "1-6", from: "D1", to: "P1", kind: "no", pts: [[580, 153], [580, 40], [1000, 40], [1000, 162]], label: "否：未指定任務", lp: [770, 32], text: "D1 否 → P1（顯示「未指定任務」與回儀表板的入口；04-01 §開清單 E1；§路由上下文與回退 第 6 條）" },
      { id: "1-7", from: "D1", to: "D2", kind: "yes", pts: [[640, 190], [710, 190]], label: "是", lp: [675, 180], text: "D1 是 → D2（04-01 §開清單 主流程第 3 步）" },
      { id: "1-8", from: "D2", to: "P1", kind: "no", pts: [[780, 153], [780, 100], [980, 100], [980, 162]], label: "否：找不到這個任務", lp: [878, 92], text: "D2 否 → P1（顯示「找不到這個任務」與回儀表板的入口；04-01 §開清單 E2；§路由上下文與回退 第 7、8 條）" },
      { id: "1-9", from: "D2", to: "P1", kind: "yes", pts: [[845, 190], [915, 190]], label: "是", lp: [880, 180], text: "D2 是 → P1（顯示任務資訊卡與資料清單；04-01 §開清單 主流程第 3 步、結果）" },
      { id: "1-10", from: "P1", to: "X2", kind: "plain", pts: [[980, 214], [980, 380], [85, 380], [85, 326]], label: "麵包屑第 1 層／回儀表板", lp: [520, 393], text: "P1 → X2（麵包屑第 1 層／回儀表板；04-01 §入口麵包屑 第 3、5 條；沒帶任務或任務查不到時麵包屑零個連結，回儀表板靠的是頁內入口，§入口麵包屑 第 8 條、§路由上下文與回退 第 6～8 條）" },
    ],
    gaps: [{ x: 600, y: 283, lines: ["行動入口卡進來的人在清單上看到哪一種畫面：", "兩份規格說法相反（缺口三，不畫）"] }],
  },
  {
    id: "pick",
    label: "挑一筆進工作區",
    w: 980,
    h: 480,
    nodes: [
      n("P1", "page", ["04-01", "標記清單"], 80, 120, 110, 44),
      n("S", "terminal", ["直接貼深連結"], 80, 280, 90, 36),
      n("D3", "decision", ["有帶那一筆？"], 280, 190, 110, 70),
      n("D4", "decision", ["那一筆查得到？"], 460, 190, 110, 70),
      n("D5", "decision", ["設定查得到？"], 640, 190, 120, 70),
      n("P2", "page", ["04-02", "標記工作區"], 860, 190, 120, 48),
    ],
    edges: [
      { id: "2-1", from: "P1", to: "D3", kind: "plain", pts: [[135, 100], [225, 160]], label: "點某一筆", lp: [170, 118], text: "P1 點某一筆 → D3（標記員點清單裡的某一筆；04-01 §在清單裡挑一筆進工作區 主流程第 1～2 步）" },
      { id: "2-2", from: "P1", to: "D3", kind: "plain", pts: [[135, 120], [225, 180]], label: "編輯／仲裁", lp: [170, 150], text: "P1 點「編輯」或「仲裁」→ D3（審核員點那一列的動作按鈕；04-01 §每列的動作：編輯或仲裁 第 24、26、30 條）" },
      { id: "2-3", from: "P1", to: "D3", kind: "plain", pts: [[135, 140], [225, 200]], label: "沒有人提交說明列", lp: [170, 182], text: "P1 點「尚未提交」說明列入口 → D3（審核員點它，不帶標記員身分；04-01 §沒有人提交的樣本 第 36～38 條）" },
      { id: "2-4", from: "P1", to: "D3", kind: "plain", pts: [[135, 160], [225, 220]], label: "試標回饋連結", lp: [170, 214], text: "P1 點試標回饋的有效引用連結 → D3（帶到該樣本並定位指南段落；04-01 §試標歷史回饋 第 5、6 條）" },
      { id: "2-5", from: "S", to: "D3", kind: "plain", pts: [[125, 272], [225, 240]], text: "S → D3（起訖連線，無規格條文；04-02 §進入工作區 觸發的三個入口之一）" },
      { id: "2-6", from: "D3", to: "P1", kind: "no", pts: [[280, 155], [280, 40], [80, 40], [80, 98]], label: "否：導回清單", lp: [180, 32], text: "D3 否 → P1（導回標記清單；04-02 §進入工作區 E2；§進不來的時候：導回清單 第 3 條）" },
      { id: "2-7", from: "D3", to: "D4", kind: "yes", pts: [[335, 190], [405, 190]], label: "是", lp: [370, 180], text: "D3 是 → D4（04-02 §進入工作區 主流程第 3 步）" },
      { id: "2-8", from: "D4", to: "D5", kind: "no", pts: [[460, 225], [460, 300], [640, 300], [640, 225]], label: "否：回退第一筆、改寫網址", lp: [550, 312], text: "D4 否 → D5（回退到第一筆並把網址改寫成實際顯示的那一筆，接回設定檢查；04-02 §進入工作區 E3；§網址一直指向目前這一筆 第 7 條）" },
      { id: "2-9", from: "D4", to: "D5", kind: "yes", pts: [[515, 190], [585, 190]], label: "是", lp: [550, 180], text: "D4 是 → D5（04-02 §進入工作區 主流程第 3 步）" },
      { id: "2-10", from: "D5", to: "P1", kind: "no", pts: [[640, 155], [640, 15], [50, 15], [50, 98]], label: "否：導回清單，不得以預設控制項呈現", lp: [360, 7], text: "D5 否 → P1（導回標記清單，不得以任何預設的輸出類型或空白控制項呈現工作區；04-02 §進入工作區 E1；§進不來的時候：導回清單 第 1 條）" },
      { id: "2-11", from: "D5", to: "P2", kind: "yes", pts: [[700, 190], [800, 190]], label: "是", lp: [750, 180], text: "D5 是 → P2（載入樣本、說明檔案與進度，三欄就位；04-02 §進入工作區 主流程第 4 步）" },
      { id: "2-12", from: "P2", to: "P1", kind: "plain", pts: [[860, 166], [860, 65], [110, 65], [110, 98]], label: "說明彈窗按「返回標記清單」", lp: [470, 57], text: "P2 點說明彈窗的「返回標記清單」→ P1（不記下確認，下次進來照樣顯示彈窗；04-02 §指引閘門：第一次進來先讀說明 第 3 條）" },
    ],
    gaps: [],
  },
  {
    id: "quick",
    label: "快速續做與快速審核",
    w: 900,
    h: 380,
    nodes: [
      n("X2", "module", ["02-01", "儀表板"], 90, 100, 130, 44),
      n("P1", "page", ["04-01", "標記清單"], 90, 220, 110, 44),
      n("D6", "decision", ["設定查得到？"], 320, 160, 120, 70),
      n("D7", "decision", ["有可處理單位？"], 540, 170, 130, 70),
      n("P2", "page", ["04-02", "標記工作區"], 760, 100, 120, 48),
    ],
    edges: [
      { id: "3-1", from: "X2", to: "D6", kind: "plain", pts: [[155, 100], [260, 135]], label: "儀表板「快速繼續／快速審核」", lp: [195, 108], text: "X2 點「快速繼續／快速審核」→ D6（04-01 §從儀表板直接續做 觸發、主流程第 1～2 步）" },
      { id: "3-2", from: "P1", to: "D6", kind: "plain", pts: [[135, 210], [260, 185]], label: "清單任務卡的快速入口", lp: [175, 222], text: "P1 點任務資訊卡的「快速繼續／快速審核」→ D6（04-01 §在清單裡挑一筆進工作區 A1；§兩種入口並存 第 6 條）" },
      { id: "3-3", from: "D6", to: "P1", kind: "no", pts: [[320, 195], [320, 280], [135, 280], [135, 232]], label: "否：導回清單", lp: [230, 292], text: "D6 否 → P1（那個任務查不到已發布的設定，導回標記清單；04-01 §從儀表板直接續做 E1）" },
      { id: "3-4", from: "D6", to: "P2", kind: "yes", pts: [[380, 140], [500, 115], [700, 108]], label: "是（標記員）", lp: [480, 108], text: "D6 是、而且是標記員 → P2（帶著最新未完成的那一筆直接進入工作區；04-01 §從儀表板直接續做 主流程第 3 步；§兩種入口並存 第 4、5 條）" },
      { id: "3-5", from: "D6", to: "D7", kind: "yes", pts: [[380, 175], [475, 175]], label: "是（審核員）", lp: [425, 165], text: "D6 是、而且是審核員 → D7（目標改成下一個可處理的審核單位；04-01 §從儀表板直接續做 A1；§沒有可處理的審核單位 第 76～80 條）" },
      { id: "3-6", from: "D7", to: "P2", kind: "yes", pts: [[605, 145], [700, 118]], label: "是", lp: [665, 128], text: "D7 是 → P2（進到工作區時落在那個可處理單位；04-01 §沒有可處理的審核單位 第 78～80 條）" },
      { id: "3-7", from: "D7", to: "P1", kind: "no", pts: [[540, 205], [540, 320], [100, 320], [100, 232]], label: "否：導回清單，顯示沒有可處理", lp: [330, 332], text: "D7 否 → P1（導回清單，不帶樣本，顯示「沒有可處理」的空狀態；04-01 §沒有可處理的審核單位 第 82～87 條）" },
    ],
    gaps: [],
  },
  {
    id: "after",
    label: "作業完成後的去向",
    w: 900,
    h: 320,
    nodes: [
      n("P2", "page", ["04-02", "標記工作區"], 90, 140, 120, 48),
      n("P1", "page", ["04-01", "標記清單"], 480, 140, 110, 44),
      n("X2", "module", ["02-01", "儀表板"], 750, 140, 130, 44),
    ],
    edges: [
      { id: "4-1", from: "P2", to: "P1", kind: "plain", pts: [[150, 140], [290, 70], [425, 140]], label: "標記員全部已提交：自動回清單", lp: [290, 58], text: "P2 → P1（標記員提交成功、任務全部已提交，自動導回清單，那一筆顯示為已提交；04-02 §提交之後往哪 第 2、3 條）" },
      { id: "4-2", from: "P2", to: "P1", kind: "plain", pts: [[150, 140], [290, 105], [425, 140]], label: "未定稿且已無可處理單位：自動回清單", lp: [290, 92], text: "P2 → P1（審核員或仲裁送出成功、這次送出沒有讓單位定稿、而且這個任務已經沒有可處理的單位，自動導回清單並帶「已無可處理單位」的提示；讓單位定稿的那一次送出必須停在原單位、不導頁；04-02 §審核員送出之後往哪 第 1、2、9、11 條）" },
      { id: "4-3", from: "P2", to: "P1", kind: "plain", pts: [[150, 140], [290, 175], [425, 140]], label: "定稿卡剩餘量 0：點回清單連結", lp: [290, 188], text: "P2 → P1（定稿卡剩餘量為 0 時，使用者主動點那顆唯一的回清單連結；04-02 §定稿卡上的剩餘可處理量與歸零去向 第 11～13 條）" },
      { id: "4-4", from: "P2", to: "P1", kind: "plain", pts: [[150, 140], [290, 210], [425, 140]], label: "側欄連結／麵包屑第 2 層：保留篩選與身分", lp: [290, 223], text: "P2 → P1（側欄的「標記作業」連結、或麵包屑第 2 層，逐字沿用或轉發檢視狀態與身分；04-02 §提交之後往哪 第 4 條；§入口麵包屑的第三層 第 5、6 條）" },
      { id: "4-5", from: "P1", to: "X2", kind: "plain", pts: [[535, 140], [685, 140]], label: "麵包屑第 1 層", lp: [610, 130], text: "P1 → X2（麵包屑第 1 層；04-01 §入口麵包屑 第 3 條）" },
      { id: "4-6", from: "P2", to: "X2", kind: "plain", pts: [[150, 118], [420, 30], [685, 118]], label: "麵包屑第 1 層", lp: [420, 22], text: "P2 → X2（麵包屑第 1 層；04-02 §入口麵包屑的第三層 第 1 條）" },
    ],
    gaps: [],
  },
  {
    id: "exception",
    label: "專案負責人的例外處置入口",
    w: 820,
    h: 300,
    nodes: [
      n("X3", "module", ["03-03", "最終例外池"], 110, 140, 170, 48),
      n("P2", "page", ["04-02", "標記工作區"], 480, 140, 130, 48),
      n("X2", "module", ["02-01", "儀表板"], 720, 60, 130, 44),
    ],
    edges: [
      { id: "5-1", from: "X3", to: "P2", kind: "plain", pts: [[195, 140], [415, 140]], label: "進入處置畫面", lp: [305, 130], text: "X3 → P2（專案負責人在任務詳情的最終例外池，點某一項的「進入處置畫面」，帶著完整的審核單位身分與爭議項識別；03-03 §最終例外池 第 6 條；04-02 §最終例外池是最後一道出口、§例外處置畫面的外殼）" },
      { id: "5-2", from: "P2", to: "X2", kind: "plain", pts: [[480, 116], [600, 60], [655, 60]], label: "麵包屑第 1 層「例外處置」", lp: [555, 50], text: "P2 → X2（麵包屑第 1 層在例外處置時顯示「例外處置」，仍連儀表板；04-02 §入口麵包屑的第三層 第 1 條）" },
    ],
    gaps: [
      { x: 480, y: 196, lines: ["全部收尾或中途離開的去向：", "規格沒有寫（缺口一，不畫）"] },
      { x: 480, y: 242, lines: ["麵包屑第 2 層回標記清單：", "與 04-01 Q1 矛盾（缺口二，不畫）"] },
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

export default function SpecAnnotationLogicFlow(): ReactElement {
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
            aria-label={`04 標記作業 Logic Flow：${section.label}；用 Tab 移到節點或連線，按 Enter 看出處`}
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
