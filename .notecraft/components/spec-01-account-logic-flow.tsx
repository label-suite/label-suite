import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MousePointerClick, RotateCcw } from "lucide-react";

/**
 * 01 帳號 Logic Flow：跨頁的操作邏輯流程（docs/specs/01-account/index.mdx §Logic Flow）。
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
  /** 與文字版相同的編號：S、E、P1…、D1…、X1… */
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

const MODULE_LABEL = "01 帳號";

/* ---------------------------------------------------------------- 共用節點（同一個編號在不同分段重複出現） */

const NOTE: Record<string, string> = {
  S: "開始：使用者打開平台",
  E: "結束：進入平台",
  P1: "01-01 登入頁（規格 01-01 §業務流程）",
  P2: "01-02 註冊頁（規格 01-02 §業務流程）",
  P3: "01-02 驗證連結的落地頁：帳號已建立，或連結無法使用（規格 01-02 §業務流程）",
  P4: "01-03 申請頁，忘記密碼（規格 01-03 §業務流程）",
  P5: "01-03 重設頁，設定新密碼；受邀者設定密碼也是這一頁（規格 01-03 §業務流程）",
  P6: "01-04 個人設定頁（規格 01-04 §業務流程）",
  D1: "判斷：已經登入？",
  D2: "判斷：兩欄都有填、帳號密碼也對得上？",
  D3: "判斷：Google 驗證通過？",
  D4: "判斷：四欄都通過檢查？",
  D5: "判斷：註冊驗證連結可用？",
  D6: "判斷：有填 Email？",
  D7: "判斷：重設連結還能用？",
  D8: "判斷：新密碼兩欄都有填且一致？",
  D9: "判斷：換 Email 的驗證連結還有效？",
  X1: "外部系統：Google 驗證",
  X2: "收信：註冊驗證信",
  X3: "收信：重設密碼信",
  X4: "其他流程：06-01 系統管理員邀請新帳號，寄出設定密碼信",
  X5: "其他模組：02-01 儀表板",
  X6: "收信：換 Email 的驗證信",
  X7: "其他流程：01-05 登入狀態結束",
  X8: "其他流程：06-01 系統管理員停用帳號",
};

/* ---------------------------------------------------------------- 資料：每個分段，與該模組 index.mdx 文字版的分段逐項一致 */

const SECTIONS: Section[] = [
  {
    id: "entry",
    label: "進入與登入",
    w: 830,
    h: 380,
    nodes: [
      n("S", "terminal", ["開始"], 50, 160, 76, 36),
      n("D1", "decision", ["已登入？"], 160, 160, 100, 60),
      n("P1", "page", ["01-01", "登入頁"], 310, 160, 110, 44),
      n("D2", "decision", ["帳密正確？"], 470, 160, 104, 60),
      n("X5", "module", ["02-01", "儀表板"], 640, 160, 120, 44),
      n("E", "terminal", ["進入平台"], 770, 160, 84, 36),
      n("P2", "page", ["01-02", "註冊頁"], 310, 50, 110, 40),
      n("P4", "page", ["01-03", "申請頁"], 230, 290, 110, 40),
      n("X1", "external", ["Google 驗證"], 470, 290, 116, 40),
      n("D3", "decision", ["驗證通過？"], 640, 290, 104, 60),
    ],
    edges: [
      { id: "1-1", from: "S", to: "D1", kind: "plain", pts: [[88, 160], [110, 160]], text: "S → D1（起訖連線，無規格條文）" },
      { id: "1-2", from: "D1", to: "X5", kind: "yes", pts: [[160, 130], [160, 14], [640, 14], [640, 138]], label: "是", lp: [176, 40], text: "D1 是 → X5 儀表板（01-01 §導向其他頁面 4、Q3；01-02 §使用角色；01-03 §使用角色）" },
      { id: "1-3", from: "D1", to: "P1", kind: "no", pts: [[210, 160], [255, 160]], label: "否", lp: [232, 150], text: "D1 否 → P1 登入頁（01-01 業務流程「用 Email 與密碼登入」觸發：未登入的訪客要進入平台；§登入頁的內容）" },
      { id: "1-4", from: "P1", to: "D2", kind: "plain", pts: [[365, 160], [418, 160]], label: "登入", lp: [391, 150], text: "P1 點「登入」→ D2（01-01 業務流程「用 Email 與密碼登入」主流程）" },
      { id: "1-5", from: "D2", to: "X5", kind: "yes", pts: [[522, 160], [580, 160]], label: "是", lp: [551, 150], text: "D2 是 → X5 儀表板（01-01 主流程、§導向其他頁面 3）" },
      { id: "1-6", from: "D2", to: "P1", kind: "no", pts: [[470, 130], [470, 106], [350, 106], [350, 138]], label: "否", lp: [486, 120], text: "D2 否 → 停在 P1（01-01 E1、E2；§登入失敗）" },
      { id: "1-7a", from: "P1", to: "X1", kind: "plain", pts: [[340, 182], [340, 290], [412, 290]], label: "Google", lp: [376, 280], text: "P1 點「使用 Google 帳號繼續」→ X1 Google 驗證 → D3（01-01 業務流程「用 Google 帳號登入」主流程）" },
      { id: "1-7b", from: "X1", to: "D3", kind: "plain", pts: [[528, 290], [588, 290]], text: "P1 點「使用 Google 帳號繼續」→ X1 Google 驗證 → D3（01-01 業務流程「用 Google 帳號登入」主流程）" },
      { id: "1-8", from: "D3", to: "X5", kind: "yes", pts: [[640, 260], [640, 182]], label: "是", lp: [652, 226], text: "D3 是 → X5 儀表板（01-01「用 Google 帳號登入」主流程）" },
      { id: "1-9", from: "D3", to: "P1", kind: "no", pts: [[640, 320], [640, 356], [310, 356], [310, 182]], label: "否", lp: [656, 342], text: "D3 否 → P1 登入頁（01-01「用 Google 帳號登入」E1；被停用的帳號也登不進來，01-05 §帳號被停用或重新啟用 3）" },
      { id: "1-10", from: "P1", to: "P2", kind: "plain", pts: [[310, 138], [310, 70]], label: "前往註冊", lp: [270, 109], text: "P1 點「前往註冊」→ P2 註冊頁（01-01 §導向其他頁面 2）" },
      { id: "1-11", from: "P1", to: "P4", kind: "plain", pts: [[275, 182], [275, 270]], label: "忘記密碼？", lp: [226, 232], text: "P1 點「忘記密碼？」→ P4 申請頁（01-01 §導向其他頁面 1）" },
      { id: "1-12", from: "X5", to: "E", kind: "plain", pts: [[700, 160], [728, 160]], text: "X5 儀表板 → E（起訖連線，無規格條文）" },
    ],
    gaps: [],
  },
  {
    id: "register",
    label: "註冊",
    w: 840,
    h: 300,
    nodes: [
      n("P2", "page", ["01-02", "註冊頁"], 90, 90, 130, 44),
      n("D4", "decision", ["四欄通過？"], 275, 90, 104, 60),
      n("X2", "external", ["收信：", "註冊驗證信"], 430, 90, 130, 44),
      n("P3", "page", ["01-02", "驗證連結落地頁"], 610, 90, 140, 44),
      n("D5", "decision", ["連結可用？"], 610, 200, 104, 60),
      n("X5", "module", ["02-01", "儀表板"], 770, 200, 120, 44),
      n("P1", "page", ["01-01", "登入頁"], 90, 210, 90, 40),
    ],
    edges: [
      { id: "2-1", from: "P2", to: "D4", kind: "plain", pts: [[155, 90], [223, 90]], label: "建立帳號", lp: [189, 80], text: "P2 點「建立帳號」→ D4（01-02 業務流程「送出註冊表單」主流程）" },
      { id: "2-2", from: "D4", to: "P2", kind: "no", pts: [[275, 60], [275, 30], [120, 30], [120, 68]], label: "否", lp: [291, 46], text: "D4 否 → 停在 P2（01-02「送出註冊表單」E1、E2）" },
      { id: "2-3", from: "D4", to: "X2", kind: "yes", pts: [[327, 90], [365, 90]], label: "是", lp: [346, 80], text: "D4 是 → 顯示「驗證信已寄出」→ X2 收信（01-02「送出註冊表單」主流程；帳號此時還沒建立）" },
      { id: "2-4a", from: "X2", to: "P3", kind: "plain", pts: [[495, 90], [540, 90]], label: "點連結", lp: [517, 80], text: "X2 點信裡的連結 → P3 → D5（01-02 業務流程「用驗證連結完成註冊」觸發與主流程）" },
      { id: "2-4b", from: "P3", to: "D5", kind: "plain", pts: [[610, 112], [610, 170]], text: "X2 點信裡的連結 → P3 → D5（01-02 業務流程「用驗證連結完成註冊」觸發與主流程）" },
      { id: "2-5", from: "D5", to: "X5", kind: "yes", pts: [[662, 200], [710, 200]], label: "是", lp: [686, 190], text: "D5 是 → 帳號建立 → X5 儀表板（01-02「用驗證連結完成註冊」主流程、§註冊成功 1～2、§導向其他頁面 2）" },
      { id: "2-6", from: "D5", to: "P2", kind: "no", pts: [[610, 230], [610, 272], [145, 272], [145, 112]], label: "否：連結無法使用", lp: [520, 262], text: "D5 否 → 「連結無法使用，請重新申請」→ P2 註冊頁（01-02「用驗證連結完成註冊」E1、§註冊成功 3 與該節的文案裁定）" },
      { id: "2-7", from: "P2", to: "P1", kind: "plain", pts: [[80, 112], [80, 190]], label: "返回登入", lp: [40, 154], text: "P2 點「返回登入」→ P1 登入頁（01-02 §導向其他頁面 1）" },
    ],
    gaps: [],
  },
  {
    id: "reset",
    label: "重設與設定密碼",
    w: 800,
    h: 310,
    nodes: [
      n("P4", "page", ["01-03", "申請頁"], 90, 80, 110, 44),
      n("D6", "decision", ["有填 Email？"], 245, 80, 110, 60),
      n("X3", "external", ["收信：", "重設密碼信"], 405, 80, 130, 44),
      n("X4", "module", ["06-01", "邀請新帳號"], 370, 200, 140, 44),
      n("P5", "page", ["01-03", "重設頁"], 570, 80, 110, 44),
      n("D7", "decision", ["連結能用？"], 720, 80, 100, 60),
      n("D8", "decision", ["兩欄一致？"], 720, 210, 104, 60),
      n("P1", "page", ["01-01", "登入頁"], 230, 270, 100, 40),
    ],
    edges: [
      { id: "3-1", from: "P4", to: "D6", kind: "plain", pts: [[145, 80], [190, 80]], label: "送出", lp: [167, 70], text: "P4 點送出 → D6（01-03 業務流程「申請重設」主流程）" },
      { id: "3-2", from: "D6", to: "P4", kind: "no", pts: [[245, 50], [245, 36], [110, 36], [110, 58]], label: "否", lp: [258, 43], text: "D6 否 → 停在 P4（01-03「申請重設」E1）" },
      { id: "3-3", from: "D6", to: "X3", kind: "yes", pts: [[300, 80], [340, 80]], label: "是", lp: [320, 70], text: "D6 是 → 「若此 Email 已註冊，重設連結已寄出」→ X3 收信（01-03「申請重設」主流程）" },
      { id: "3-4", from: "X3", to: "P5", kind: "plain", pts: [[470, 80], [515, 80]], label: "點連結", lp: [492, 70], text: "X3 點信裡的連結 → P5 重設頁（01-03 業務流程「用連結設定新密碼」觸發）" },
      { id: "3-5", from: "X4", to: "P5", kind: "plain", pts: [[440, 200], [540, 200], [540, 102]], label: "受邀者點連結", lp: [490, 190], text: "X4 受邀者點設定密碼信裡的連結 → P5 重設頁（01-03 §使用角色、Q6；06-01「邀請新帳號」主流程）" },
      { id: "3-6", from: "P5", to: "D7", kind: "plain", pts: [[625, 80], [670, 80]], text: "P5 → D7（01-03「用連結設定新密碼」主流程第 1 步）" },
      { id: "3-7", from: "D7", to: "P4", kind: "no", pts: [[720, 50], [720, 18], [80, 18], [80, 58]], label: "否：重新申請", lp: [660, 12], text: "D7 否 → 連結無法使用的面板，點「重新申請」→ P4 申請頁（01-03「用連結設定新密碼」E2、「從失效的連結重新申請」、§導向其他頁面 2）" },
      { id: "3-8", from: "D7", to: "D8", kind: "yes", pts: [[720, 110], [720, 180]], label: "是", lp: [732, 146], text: "D7 是 → 填新密碼並送出 → D8（01-03「用連結設定新密碼」主流程）" },
      { id: "3-9", from: "D8", to: "P5", kind: "no", pts: [[668, 210], [600, 210], [600, 102]], label: "否", lp: [634, 200], text: "D8 否 → 停在 P5（01-03「用連結設定新密碼」E1）" },
      { id: "3-10", from: "D8", to: "P1", kind: "yes", pts: [[720, 240], [720, 278], [280, 278]], label: "是：前往登入", lp: [660, 296], text: "D8 是 → 重設成功面板，點「前往登入」→ P1 登入頁（01-03「用連結設定新密碼」主流程、§導向其他頁面 3）" },
      { id: "3-11a", from: "P4", to: "P1", kind: "plain", pts: [[90, 102], [90, 270], [180, 270]], label: "返回登入", lp: [134, 260], text: "P4 或 P5 點「返回登入」→ P1 登入頁（01-03 §導向其他頁面 1）" },
      { id: "3-11b", from: "P5", to: "P1", kind: "plain", pts: [[580, 102], [580, 236], [250, 236], [250, 250]], label: "返回登入", lp: [440, 252], text: "P4 或 P5 點「返回登入」→ P1 登入頁（01-03 §導向其他頁面 1）" },
    ],
    gaps: [],
  },
  {
    id: "after",
    label: "登入之後",
    w: 850,
    h: 360,
    nodes: [
      n("P6", "page", ["01-04", "個人設定頁"], 180, 80, 120, 44),
      n("X6", "external", ["收信：", "換 Email 驗證信"], 380, 80, 130, 44),
      n("D9", "decision", ["連結有效？"], 550, 80, 100, 60),
      n("X1", "external", ["Google 驗證"], 180, 220, 120, 40),
      n("X7", "module", ["01-05", "登入狀態結束"], 550, 220, 140, 44),
      n("X8", "module", ["06-01", "停用帳號"], 720, 220, 120, 44),
      n("X5", "module", ["02-01", "儀表板"], 180, 320, 120, 44),
      n("P1", "page", ["01-01", "登入頁"], 550, 320, 110, 40),
    ],
    edges: [
      { id: "4-1", from: "P6", to: "P1", kind: "no", pts: [[140, 58], [140, 14], [830, 14], [830, 326], [605, 326]], label: "未登入時", lp: [184, 28], text: "未登入的人直接打開 P6 → P1 登入頁（01-04 §頁面的內容 4）" },
      { id: "4-2a", from: "P6", to: "X6", kind: "plain", pts: [[240, 80], [315, 80]], label: "換 Email", lp: [277, 70], text: "P6 送出新 Email → X6 收信 → 點信裡的連結 → D9（01-04 業務流程「送出新的 Email」「用驗證連結換掉 Email」）" },
      { id: "4-2b", from: "X6", to: "D9", kind: "plain", pts: [[445, 80], [500, 80]], label: "點連結", lp: [472, 70], text: "P6 送出新 Email → X6 收信 → 點信裡的連結 → D9（01-04 業務流程「送出新的 Email」「用驗證連結換掉 Email」）" },
      { id: "4-3", from: "D9", to: "X7", kind: "yes", pts: [[550, 110], [550, 198]], label: "是", lp: [562, 156], text: "D9 是 → Email 換成新的 → X7 登入狀態結束（01-04「用驗證連結換掉 Email」主流程、§換 Email 8；01-05「安全事件撤銷」A1）" },
      { id: "4-4a", from: "D9", to: "P6", kind: "no", pts: [[550, 50], [550, 36], [220, 36], [220, 58]], label: "否：已登入，回個人設定", lp: [385, 31], text: "D9 否 →「連結無法使用，請重新申請」面板；已登入點「回個人設定」→ P6 個人設定頁，未登入點「前往登入」→ P1 登入頁（01-04 §換 Email 9、Q19；01-04「用驗證連結換掉 Email」E1）" },
      { id: "4-4b", from: "D9", to: "P1", kind: "no", pts: [[600, 80], [810, 80], [810, 308], [605, 308]], label: "否：未登入，前往登入", lp: [700, 70], text: "D9 否 →「連結無法使用，請重新申請」面板；已登入點「回個人設定」→ P6 個人設定頁，未登入點「前往登入」→ P1 登入頁（01-04 §換 Email 9、Q19；01-04「用驗證連結換掉 Email」E1）" },
      { id: "4-5a", from: "P6", to: "X1", kind: "plain", pts: [[180, 102], [180, 200]], label: "連結 Google", lp: [226, 156], text: "P6 連結 Google 帳號 → X1 Google 驗證 → 連結成功 → X7 登入狀態結束（01-04 §連結 Google 帳號 2～3；01-05「安全事件撤銷」A1）" },
      { id: "4-5b", from: "X1", to: "X7", kind: "plain", pts: [[240, 212], [480, 212]], label: "連結成功", lp: [360, 204], text: "P6 連結 Google 帳號 → X1 Google 驗證 → 連結成功 → X7 登入狀態結束（01-04 §連結 Google 帳號 2～3；01-05「安全事件撤銷」A1）" },
      { id: "4-6", from: "X1", to: "P6", kind: "no", pts: [[120, 220], [60, 220], [60, 140], [150, 140], [150, 102]], label: "取消或失敗", lp: [100, 132], text: "X1 在 Google 那一側取消或驗證不通過 → 回到 P6 個人設定頁，Google 區塊維持未連結並顯示說明，登入狀態不變（01-04 §連結 Google 帳號 7、Q20）" },
      { id: "4-7", from: "X5", to: "X7", kind: "plain", pts: [[240, 320], [460, 320], [460, 232], [480, 232]], label: "登入後任一頁：登出／時間到", lp: [350, 310], text: "登入後任何一頁點登出，或時間到了 → X7 登入狀態結束（07-01 §登出 1；01-05 業務流程「自己登出這一台」「時間到了自然結束」）" },
      { id: "4-8", from: "X8", to: "X7", kind: "plain", pts: [[660, 220], [620, 220]], text: "X8 系統管理員停用帳號 → X7 登入狀態結束（01-05 §帳號被停用或重新啟用 1～2；01-05「時間到了自然結束」A2）" },
      { id: "4-9", from: "X7", to: "P1", kind: "plain", pts: [[550, 242], [550, 300]], text: "X7 → P1 登入頁（01-05「自己登出這一台」主流程與 A1、「安全事件撤銷」A1、「時間到了自然結束」主流程）" },
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

export default function SpecAccountLogicFlow(): ReactElement {
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
