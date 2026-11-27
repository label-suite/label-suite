import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MousePointerClick, RotateCcw } from "lucide-react";

/**
 * 07 共用介面 Logic Flow：跨頁的操作邏輯流程（docs/specs/07-shared/index.mdx §Logic Flow）。
 *
 * 四種標準流程圖符號：起訖（圓角膠囊）、頁面（矩形）、判斷（菱形）、其他流程或外部系統（雙邊框矩形）。
 * 共用介面的四頁都不是獨立頁面，所以圖上畫的是側欄、工作頁籤與無權限或找不到的畫面把人帶去哪一頁；07-04 通知事件沒有畫面，不成一個節點。
 * 節點編號、分段與出處都和 index.mdx 的文字版逐項一致；文字版沒有的連線不畫，兩個缺口只以灰色註記標示。
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

const MODULE_LABEL = "07 共用介面";

/* ---------------------------------------------------------------- 共用節點（同一個編號在不同分段重複出現） */

const NOTE: Record<string, string> = {
  S: "開始：使用者停在任一登入後的頁面（側欄與頁籤列在每一頁都看得到）",
  P1: "07-01 側欄導覽（規格 07-01 §業務流程）",
  P2: "07-02 工作頁籤：頁籤列與小螢幕的總覽選單（規格 07-02 §業務流程）",
  P3: "07-03 無權限與找不到的畫面：取代內容區的兩種整頁畫面（規格 07-03 §畫面的組成）",
  D1: "判斷：在桌機，而且側欄沒有收合嗎？（規格 07-01 §系統管理的次選單 第 5 條）",
  D2: "判斷：第三個導覽項讀作「例外處置」嗎？（規格 07-01 §導覽項目與可見性 第 4～6 條）",
  D3: "判斷：在任何一個任務是標記員、審核員或專案負責人嗎？（規格 07-01 §進入模組的條件 第 1 條）",
  D4: "判斷：在目前的任務是專案負責人或審核員嗎？（規格 07-01 §進入模組的條件 第 2 條）",
  D5: "判斷：依同一性規則，這一頁已經開著了嗎？（規格 07-02 §開啟頁籤與去重）",
  D6: "判斷：頁籤數還沒到上限，或有可以淘汰的頁籤嗎？（規格 07-02 §數量上限與淘汰 第 1、3 條）",
  D7: "判斷：切回的頁籤還有權限、資料也還在嗎？（規格 07-02 §權限或資料失效 第 1、2 條）",
  D8: "判斷：要關的頁籤有未儲存變更嗎？（規格 07-02 §未儲存保護 第 6 條）",
  D9: "判斷：返回的去處那一頁放行嗎？（規格 07-03 §返回操作的去處 第 3 條）",
  X1: "其他模組：02-01 儀表板",
  X2: "其他模組：03-01 任務列表",
  X3: "其他模組：01-04 個人設定",
  X4: "其他模組：06-01 使用者管理",
  X5: "其他模組：06-02 角色設定",
  X6: "其他模組：01-01 登入頁（登入狀態怎麼結束見規格 01-05「自己登出這一台」）",
  X7: "其他模組：04-01 標記清單",
  X8: "其他模組：05-01 分析列表",
  X9: "其他模組：頁籤裡的那一頁（任一模組的頁面；同一性規則見規格 07-02 §開啟頁籤與去重）",
  X10: "外部系統：瀏覽器的新分頁",
  X11: "其他模組：返回操作的去處（由各模組自己的規格指定，見規格 07-03 §返回操作的去處 第 1 條）",
};

/* ---------------------------------------------------------------- 資料：每個分段，與該模組 index.mdx 文字版的分段逐項一致 */

const SECTIONS: Section[] = [
  {
    id: "sidebar",
    label: "側欄直接進的模組與登出",
    w: 860,
    h: 420,
    nodes: [
      n("S", "terminal", ["開始"], 60, 200, 76, 36),
      n("P1", "page", ["07-01","側欄導覽"], 210, 200, 120, 44),
      n("X1", "module", ["02-01","儀表板"], 620, 50, 120, 44),
      n("X2", "module", ["03-01","任務列表"], 620, 125, 120, 44),
      n("X3", "module", ["01-04","個人設定"], 620, 200, 120, 44),
      n("D1", "decision", ["桌機未收合？"], 420, 300, 116, 60),
      n("X4", "module", ["06-01","使用者管理"], 620, 300, 120, 44),
      n("X5", "module", ["06-02","角色設定"], 620, 380, 120, 44),
      n("X6", "module", ["01-01","登入頁"], 210, 330, 120, 44),
    ],
    edges: [
      { id: "1-1", from: "S", to: "P1", kind: "plain", pts: [[98,200],[150,200]], text: "S → P1（起訖連線，無規格條文；07-01 §業務流程「從側欄進入模組」觸發是這個入口）" },
      { id: "1-2", from: "P1", to: "X1", kind: "plain", pts: [[230,178],[230,50],[560,50]], label: "儀表板", lp: [400,42], text: "P1 點「儀表板」→ X1 儀表板（07-01 §導覽項目與可見性 第 1 條與該節「儀表板對 02」的註；07-01 §業務流程「從側欄進入模組」主流程第 2 步）" },
      { id: "1-3", from: "P1", to: "X2", kind: "plain", pts: [[250,178],[250,125],[560,125]], label: "任務管理", lp: [400,117], text: "P1 點「任務管理」→ X2 任務列表（07-01 §導覽項目與可見性 第 1 條與該節「任務管理對 03」的註；03-01 §業務流程「進到任務列表」觸發）" },
      { id: "1-4", from: "P1", to: "X3", kind: "plain", pts: [[270,200],[560,200]], label: "個人設定", lp: [400,192], text: "P1 點「個人設定」→ X3 個人設定（07-01 §導覽項目與可見性 第 1 條與該節「個人設定對 01-04」的註）" },
      { id: "1-5", from: "P1", to: "D1", kind: "plain", pts: [[270,214],[330,214],[330,300],[362,300]], label: "系統管理", lp: [292,262], text: "P1 系統管理員點「系統管理」→ D1（07-01 §導覽項目與可見性 第 3 條；§系統管理的次選單 第 1、5 條）" },
      { id: "1-6", from: "D1", to: "X4", kind: "no", pts: [[478,300],[560,300]], label: "否", lp: [519,292], text: "D1 否 → X4 使用者管理（在手機或側欄已收合：直接進入使用者管理，不展開次選單；07-01 §系統管理的次選單 第 5 條；§驗收標準「手機點擊系統管理直接進入使用者管理」「側欄收合後點擊系統管理」；06-01 §規格 的「存取與分頁切換」第 1 條）" },
      { id: "1-7", from: "D1", to: "X5", kind: "yes", pts: [[420,330],[420,380],[560,380]], label: "是：點角色設定", lp: [492,372], text: "D1 是 → X5 角色設定（展開次選單，點「角色設定」直接進入角色設定頁，不經過使用者管理頁；07-01 §業務流程「從側欄進入模組」A1；§系統管理的次選單 第 1、2 條；§驗收標準「展開系統管理次選單直達角色設定」；06-02 §怎麼進來、誰進得來 第 1 條）" },
      { id: "1-8", from: "D1", to: "X4", kind: "yes", pts: [[420,270],[420,250],[620,250],[620,278]], label: "是：點使用者管理", lp: [520,242], text: "D1 是 → X4 使用者管理（展開次選單，點「使用者管理」進入使用者管理；07-01 §系統管理的次選單 第 2 條；§驗收標準「展開系統管理次選單點使用者管理」；§已確認決議 Q21）" },
      { id: "1-9", from: "P1", to: "X6", kind: "plain", pts: [[210,222],[210,308]], label: "登出", lp: [232,268], text: "P1 點「登出」→ X6 登入頁（結束這次的登入狀態；07-01 §業務流程「登出」主流程第 1～2 步；§登出 第 1 條；§驗收標準「登出後回到登入頁」）" },
    ],
    gaps: [
      { x: 105, y: 262, lines: ["點某一則通知：規格沒指定","（缺口一，不畫）"] },
    ],
  },
  {
    id: "role",
    label: "看任務角色的兩個導覽項",
    w: 860,
    h: 370,
    nodes: [
      n("P1", "page", ["07-01","側欄導覽"], 90, 120, 120, 44),
      n("D2", "decision", ["讀作例外處置？"], 290, 120, 124, 60),
      n("X2", "module", ["03-01","任務列表"], 700, 40, 120, 44),
      n("D3", "decision", ["任一任務有角色？"], 480, 120, 140, 60),
      n("X7", "module", ["04-01","標記清單"], 700, 120, 120, 44),
      n("X1", "module", ["02-01","儀表板"], 700, 220, 120, 44),
      n("D4", "decision", ["目前任務是負責人","或審核員？"], 300, 290, 150, 70),
      n("X8", "module", ["05-01","分析列表"], 700, 290, 120, 44),
    ],
    edges: [
      { id: "2-1", from: "P1", to: "D2", kind: "plain", pts: [[150,120],[228,120]], label: "第三個導覽項", lp: [189,110], text: "P1 點第三個導覽項 → D2（07-01 §導覽項目與可見性 第 4～6 條；§進入模組的條件 的「第 1 條進入標記作業之後的落點依第三個導覽項的名稱分」）" },
      { id: "2-2", from: "D2", to: "X2", kind: "yes", pts: [[290,90],[290,40],[640,40]], label: "是", lp: [302,66], text: "D2 是 → X2 任務列表（讀作「例外處置」：進到任務列表，不進標記清單；他處置例外的入口在任務詳情的最終例外池；07-01 §卡控機制 的「進到任務列表，不進標記清單」；§驗收標準「專案負責人進得去標記作業」「只當專案負責人的人看到例外處置」；§已確認決議 Q15、Q18）" },
      { id: "2-3", from: "D2", to: "D3", kind: "no", pts: [[352,120],[410,120]], label: "否", lp: [381,112], text: "D2 否 → D3（讀作「標記作業」或「審核作業」；07-01 §導覽項目與可見性 第 4、6 條；§進入模組的條件 第 1 條）" },
      { id: "2-4", from: "D3", to: "X7", kind: "yes", pts: [[550,120],[640,120]], label: "是", lp: [595,112], text: "D3 是 → X7 標記清單（連結不帶任務，但在網址帶入口標記，由那一頁列出他有標記員或審核員角色的任務讓他挑；07-01 §進入模組的條件 第 1 條；§卡控機制 的「連結不帶任務，但在網址帶入口標記」；§驗收標準「點標記作業進到的是清單頁」「在別的任務有角色時點擊標記作業」；§已確認決議 Q16、Q17；04-01 §路由上下文與回退 第 11 條）" },
      { id: "2-5", from: "D3", to: "X1", kind: "no", pts: [[480,150],[480,220],[640,220]], label: "否", lp: [492,190], text: "D3 否 → X1 儀表板（擋下，回到儀表板並顯示說明；07-01 §業務流程「從側欄進入模組」E2；§進入模組的條件 第 3、5 條，從側欄點導覽項不適用第 4 條的放寬；§驗收標準「沒有任務角色時點擊標記作業」）" },
      { id: "2-6", from: "P1", to: "D4", kind: "plain", pts: [[90,142],[90,290],[225,290]], label: "資料集分析", lp: [157,282], text: "P1 點「資料集分析」→ D4（07-01 §進入模組的條件 第 2 條）" },
      { id: "2-7", from: "D4", to: "X8", kind: "yes", pts: [[375,290],[640,290]], label: "是", lp: [508,282], text: "D4 是 → X8 分析列表（07-01 §進入模組的條件 第 2 條；§業務流程「從側欄進入模組」A2；05-01 §業務流程「進到分析列表」主流程第 2、4 步）" },
      { id: "2-8", from: "D4", to: "X2", kind: "no", pts: [[300,325],[300,350],[800,350],[800,40],[760,40]], label: "否", lp: [312,342], text: "D4 否 → X2 任務列表（擋下，回到任務列表並顯示說明；07-01 §業務流程「從側欄進入模組」E2；§進入模組的條件 第 3 條；§卡控機制 的「擋下進入資料集分析，回到任務列表並顯示說明」；§驗收標準「沒有任務角色時點擊資料集分析」；§已確認決議 Q9）" },
    ],
    gaps: [],
  },
  {
    id: "open",
    label: "開啟頁籤",
    w: 860,
    h: 330,
    nodes: [
      n("S", "terminal", ["開始"], 60, 120, 76, 36),
      n("D5", "decision", ["已經開著？"], 230, 120, 130, 64),
      n("D6", "decision", ["還沒到上限","或可淘汰？"], 430, 120, 150, 70),
      n("X9", "module", ["頁籤裡的那一頁"], 700, 120, 150, 44),
      n("X10", "external", ["瀏覽器的新分頁"], 230, 290, 140, 44),
      n("P2", "page", ["07-02","工作頁籤"], 430, 290, 120, 44),
    ],
    edges: [
      { id: "3-1", from: "S", to: "D5", kind: "plain", pts: [[98,120],[165,120]], label: "點項目", lp: [131,110], text: "S 點側欄、清單、通知或儀表板上會換頁的項目 → D5（起訖連線，無規格條文；07-02 §業務流程「開啟頁籤」觸發是這個入口）" },
      { id: "3-2", from: "S", to: "X10", kind: "plain", pts: [[60,138],[60,290],[160,290]], label: "Ctrl／⌘／中鍵", lp: [108,282], text: "S 按住 Ctrl 或 ⌘、或用滑鼠中鍵點 → X10 瀏覽器的新分頁（起訖連線，無規格條文；不建立工作頁籤；07-02 §業務流程「開啟頁籤」E2；§開啟頁籤與去重 第 5 條；§驗收標準「按住 Ctrl 點擊交給瀏覽器」）" },
      { id: "3-3", from: "D5", to: "X9", kind: "yes", pts: [[230,88],[230,40],[700,40],[700,98]], label: "是：切過去", lp: [300,32], text: "D5 是 → X9 那一頁所在的頁籤（切過去，不新開第二個；07-02 §業務流程「開啟頁籤」A1；§開啟頁籤與去重 第 2 條；§驗收標準「同一頁再點一次切到既有頁籤」）" },
      { id: "3-4", from: "D5", to: "D6", kind: "no", pts: [[295,120],[355,120]], label: "否", lp: [325,112], text: "D5 否 → D6（07-02 §業務流程「開啟頁籤」主流程第 2 步）" },
      { id: "3-5", from: "D6", to: "X9", kind: "yes", pts: [[505,120],[625,120]], label: "是：開新頁籤", lp: [565,112], text: "D6 是 → X9 新頁籤裡的那一頁（在作用中頁籤的右邊插入新頁籤，掛載那一頁並由網址還原檢視狀態；已達上限時先淘汰最久沒用且沒有未儲存變更的那一個；07-02 §業務流程「開啟頁籤」主流程第 2～3 步、A2；§開啟頁籤與去重 第 3 條；§數量上限與淘汰 第 1、2 條；§驗收標準「新頁籤插在作用中頁籤右邊」「達上限時淘汰最久沒用的」）" },
      { id: "3-6", from: "D6", to: "P2", kind: "no", pts: [[430,155],[430,268]], label: "否：擋下", lp: [462,214], text: "D6 否 → 留在 P2 目前的頁籤（已有 8 個頁籤且每一個都有未儲存變更：擋下開啟並顯示說明，沒有任何頁籤被動到；07-02 §業務流程「開啟頁籤」E1；§數量上限與淘汰 第 3 條；§驗收標準「全部都有未儲存變更時擋下」）" },
      { id: "3-7", from: "P2", to: "D5", kind: "plain", pts: [[370,290],[320,290],[320,200],[230,200],[230,152]], label: "重開剛關閉的", lp: [275,216], text: "P2 點「重開剛關閉的」或按 Alt+Shift+T → D5（取出最近關閉的一筆重新開啟，再走一次這一段；07-02 §業務流程「關閉與重開頁籤」A1；§關閉與重開 第 3、4 條；§驗收標準「重開剛關閉的頁籤」「重開撞到已開的頁籤」）" },
      { id: "3-8", from: "P2", to: "X9", kind: "plain", pts: [[490,290],[700,290],[700,142]], label: "頁內切換撞到已開的", lp: [595,282], text: "P2 在某一頁裡切換子分頁或篩選，切換後的狀態和另一個已開的頁籤相同 → X9 那個已開的頁籤（原本的頁籤維持原狀並顯示說明；07-02 §開啟頁籤與去重 第 4 條；§驗收標準「頁內切換撞到已開的頁籤」）" },
    ],
    gaps: [],
  },
  {
    id: "switch",
    label: "切換與關閉頁籤",
    w: 860,
    h: 380,
    nodes: [
      n("P2", "page", ["07-02","工作頁籤"], 90, 180, 120, 44),
      n("D7", "decision", ["權限與資料","都還在？"], 300, 70, 140, 64),
      n("P3", "page", ["07-03","無權限或找不到"], 540, 70, 150, 44),
      n("X9", "module", ["頁籤裡的那一頁"], 680, 180, 150, 44),
      n("D8", "decision", ["有未儲存","變更？"], 300, 290, 140, 64),
    ],
    edges: [
      { id: "4-1", from: "P2", to: "D7", kind: "plain", pts: [[90,158],[90,70],[230,70]], label: "切換頁籤", lp: [160,62], text: "P2 點另一個頁籤、按 Alt 加數字，或點總覽選單裡的某一列 → D7（07-02 §業務流程「切換頁籤」觸發、主流程第 1～2 步；§頁籤總覽選單 第 6 條；§快捷鍵 第 1 條）" },
      { id: "4-2", from: "D7", to: "X9", kind: "yes", pts: [[300,102],[300,164],[605,164]], label: "是", lp: [312,134], text: "D7 是 → X9 目標頁籤的那一頁（由網址還原子分頁、篩選、頁碼與階段，再還原捲動位置；先前載入過的不顯示整頁載入中；07-02 §業務流程「切換頁籤」主流程第 3 步、A1；§切換頁籤與狀態還原 第 1～3 條；§驗收標準「切回頁籤還原子分頁與捲動」「已載入過的頁籤不顯示載入中」）" },
      { id: "4-3", from: "D7", to: "P3", kind: "no", pts: [[370,70],[465,70]], label: "否", lp: [417,62], text: "D7 否 → P3 無權限或找不到的畫面（已經沒有權限顯示無權限、任務已被刪掉顯示找不到，頁籤不自動關閉；07-02 §業務流程「切換頁籤」E1；§權限或資料失效 第 1～3 條；§驗收標準「切回時沒有權限」「切回時資料已不存在」）" },
      { id: "4-4", from: "P2", to: "D8", kind: "plain", pts: [[90,202],[90,290],[230,290]], label: "關閉頁籤", lp: [160,282], text: "P2 點頁籤的關閉按鈕或按 Alt+W → D8（07-02 §業務流程「關閉與重開頁籤」觸發、主流程第 1 步；§快捷鍵 第 2 條）" },
      { id: "4-5", from: "D8", to: "X9", kind: "no", pts: [[300,258],[300,196],[605,196]], label: "否", lp: [312,230], text: "D8 否 → X9 鄰近頁籤的那一頁（關閉並推進最近關閉的清單；關的是作用中頁籤時，焦點移到緊鄰右邊的頁籤，它是最右邊時移到緊鄰左邊的，內容區跟著換成那個頁籤的頁；07-02 §業務流程「關閉與重開頁籤」主流程第 2～3 步；07-01 §工作頁籤的位置 第 1、2 條；焦點與內容一起換，依 07-01 §工作頁籤的位置 第 4 條的「焦點與目前頁面都不變」把兩者寫成一組，07-02 §不支援的事 第 2 條的「同一時間只顯示一個頁籤的內容」，§驗收標準「Alt+W 關閉作用中頁籤」的「移到下一個頁籤」）" },
      { id: "4-6", from: "D8", to: "P2", kind: "yes", pts: [[300,322],[300,350],[60,350],[60,202]], label: "是：確認對話", lp: [180,342], text: "D8 是 → 留在 P2（出現該頁原有的確認對話，取消就不關閉，確認之後照分段四第 5 條關閉；07-02 §業務流程「關閉與重開頁籤」E1 的「使用者取消就不關閉」與結果的「有未儲存變更時使用者一定先被問過」；§未儲存保護 第 6 條；§驗收標準「關閉有未儲存變更的頁籤」）" },
      { id: "4-7", from: "P2", to: "X9", kind: "plain", pts: [[150,180],[605,180]], label: "全部關閉", lp: [210,175], text: "P2 點「全部關閉」→ X9 被跳過的其中一個頁籤（關掉所有沒有未儲存變更的頁籤，作用中的被關掉時焦點落在被跳過的頁籤，內容區跟著換成那個頁籤的頁；07-02 §全部關閉 第 1～3 條；§不支援的事 第 2 條；§驗收標準「全部關閉後焦點落在被跳過的」；07-01 §工作頁籤的位置 第 4 條的「焦點與目前頁面都不變」）" },
    ],
    gaps: [
      { x: 560, y: 250, lines: ["關到一個都不剩：規格沒指定","（缺口二，不畫）"] },
    ],
  },
  {
    id: "back",
    label: "無權限與找不到的返回",
    w: 760,
    h: 260,
    nodes: [
      n("P3", "page", ["07-03","無權限或找不到"], 110, 110, 150, 44),
      n("D9", "decision", ["去處那一頁","放行嗎？"], 360, 110, 150, 70),
      n("X11", "module", ["返回操作的去處"], 600, 110, 160, 44),
    ],
    edges: [
      { id: "5-1", from: "P3", to: "D9", kind: "plain", pts: [[185,110],[285,110]], label: "返回操作", lp: [235,102], text: "P3 按畫面上唯一的返回操作（標籤寫出去處）→ D9（07-03 §畫面的組成 第 1、5 條；§返回操作的去處 第 1 條）" },
      { id: "5-2", from: "D9", to: "X11", kind: "yes", pts: [[435,110],[520,110]], label: "是", lp: [477,102], text: "D9 是 → X11 各模組指定的去處（例：任務詳情回任務列表、標記清單回儀表板；07-03 §返回操作的去處 第 1、2 條與該節「現況兩例」的註；§已確認決議 Q4）" },
      { id: "5-3", from: "D9", to: "P3", kind: "no", pts: [[360,145],[360,200],[110,200],[110,132]], label: "否", lp: [372,175], text: "D9 否 → P3（那一頁自己的規則再判一次，顯示的仍是這兩種畫面其中一種；07-03 §返回操作的去處 第 3 條；§邊界情況「返回的去處本身也擋下這個使用者」；§驗收標準「邊界：返回之後仍被擋下」）" },
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

export default function Spec07SharedLogicFlow(): ReactElement {
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
