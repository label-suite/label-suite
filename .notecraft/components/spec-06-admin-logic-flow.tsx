import { useId, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MousePointerClick, RotateCcw } from "lucide-react";

/**
 * 06 系統管理 Logic Flow：跨頁的操作邏輯流程（docs/specs/06-admin/index.mdx §Logic Flow）。
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

const MODULE_LABEL = "06 系統管理";

/* ---------------------------------------------------------------- 共用節點（同一個編號在不同分段重複出現） */

const NOTE: Record<string, string> = {
  S: "開始：使用者要管理全平台帳號或角色權限",
  P1: "06-01 使用者管理（規格 06-01 §業務流程）",
  P2: "06-02 角色設定（規格 06-02 §業務流程）",
  D1: "判斷：已經登入？",
  D2: "判斷：系統角色是系統管理員？",
  D3: "判斷：有這一頁的「進入」權限？（使用者管理頁要「進入使用者管理頁」，角色設定頁要「進入角色權限設定頁」）",
  D4: "判斷：這個部署有設定寄信服務嗎？",
  X1: "其他模組：01-01 登入頁",
  X2: "其他模組：02-01 儀表板",
  X3: "其他模組：07-01 側欄導覽（「系統管理」導覽項與它的次選單）",
  X4: "收信：設定密碼信",
  X5: "其他模組：01-03 用一次性連結設定密碼（受邀的使用者設定密碼的那一頁）",
  X6: "外部：伺服器紀錄，沒有設定寄信服務時設定密碼連結留在這裡",
  X7: "其他流程：01-05 登入狀態結束",
};

/* ---------------------------------------------------------------- 資料：每個分段，與該模組 index.mdx 文字版的分段逐項一致 */

const SECTIONS: Section[] = [
  {
    id: "entry",
    label: "進入系統管理，誰進得來",
    w: 900,
    h: 295,
    nodes: [
      n("S", "terminal", ["開始"], 56, 170, 76, 36),
      n("X3", "module", ["07-01", "側欄導覽"], 175, 170, 120, 44),
      n("D1", "decision", ["已登入？"], 320, 170, 104, 60),
      n("D2", "decision", ["系統管理員？"], 480, 170, 118, 60),
      n("D3", "decision", ["有進入權限？"], 650, 170, 120, 60),
      n("X1", "module", ["01-01", "登入頁"], 320, 66, 110, 44),
      n("X2", "module", ["02-01", "儀表板"], 480, 66, 110, 44),
      n("P1", "page", ["06-01", "使用者管理"], 830, 100, 130, 44),
      n("P2", "page", ["06-02", "角色設定"], 830, 250, 130, 44),
    ],
    edges: [
      { id: "1-1", from: "S", to: "X3", kind: "plain", pts: [[94, 170], [115, 170]], text: "S → X3（起訖連線，無規格條文）" },
      { id: "1-2", from: "X3", to: "D1", kind: "plain", pts: [[235, 170], [268, 170]], label: "點側欄或開網址", lp: [223, 132], text: "X3 點側欄的「系統管理」，或點次選單的「角色設定」，或直接開啟這兩頁的網址 → D1（07-01 §導覽項目與可見性 第 1、3 條；§系統管理的次選單 第 1、2、5 條；06-01 §規格 的「存取與分頁切換」摘要句「系統管理員從側欄進入「系統管理」」與第 1 條，直接開啟網址那一種見同節第 3、4 條；06-02 §怎麼進來、誰進得來 第 5、6 條。平台成員的側欄本來就沒有「系統管理」（07-01 §導覽項目與可見性 第 2 條），所以 D1、D2 的「否」走的是直接開啟網址這一種）" },
      { id: "1-3", from: "D1", to: "X1", kind: "no", pts: [[320, 140], [320, 88]], label: "否", lp: [334, 116], text: "D1 否 → X1 登入頁（06-01 §規格 的「存取與分頁切換」第 3 條、§卡控機制 第 1 條、§驗收標準「未登入者開啟頁面」；06-02 §怎麼進來、誰進得來 第 6 條、§業務流程「改一次角色權限」E1、§卡控機制 第 2 條、§驗收標準「未登入被導向登入」）" },
      { id: "1-4", from: "D1", to: "D2", kind: "yes", pts: [[372, 170], [421, 170]], label: "是", lp: [396, 160], text: "D1 是 → D2（06-02 §授權判斷的順序 第 1、2 條）" },
      { id: "1-5", from: "D2", to: "X2", kind: "no", pts: [[480, 140], [480, 88]], label: "否", lp: [494, 116], text: "D2 否 → X2 儀表板（06-01 §規格 的「存取與分頁切換」第 4 條、§卡控機制 第 2 條、§驗收標準「平台成員開啟頁面」；06-02 §怎麼進來、誰進得來 第 5 條、§業務流程「改一次角色權限」E1、§卡控機制 第 1 條、§驗收標準「平台成員被導回儀表板」；07-01 §導覽項目與可見性 第 2 條，平台成員的側欄本來就沒有「系統管理」）" },
      { id: "1-6", from: "D2", to: "D3", kind: "yes", pts: [[539, 170], [590, 170]], label: "是", lp: [564, 160], text: "D2 是 → D3（06-02 §授權判斷的順序 第 3 條；06-01 §使用角色 的「R 需要角色設定中的「進入使用者管理頁」權限」；06-02 §使用角色 第 2 條條列，進來要「進入角色權限設定頁」）" },
      { id: "1-7", from: "D3", to: "P1", kind: "yes", pts: [[650, 140], [650, 100], [765, 100]], label: "是：點「系統管理」", lp: [706, 90], text: "D3 是，而且點的是「系統管理」→ P1 使用者管理，預設停在這個分頁並顯示全平台帳號列表（06-01 §規格 的「存取與分頁切換」第 1 條、§驗收標準「進入系統管理頁」；07-01 §系統管理的次選單 第 5 條，手機或側欄收合時點「系統管理」直接進入使用者管理）" },
      { id: "1-8", from: "D3", to: "P2", kind: "yes", pts: [[650, 200], [650, 250], [765, 250]], label: "是：點次選單的「角色設定」", lp: [676, 272], text: "D3 是，而且點的是次選單的「角色設定」→ P2 角色設定，不先落在使用者管理，進來顯示閱覽模式的矩陣（07-01 §系統管理的次選單 第 2 條與該節最後一條「這個次選單是額外的直達入口」；06-02 §閱覽模式與編輯模式 第 1 條、§驗收標準「預設是閱覽模式」；06-02 §怎麼進來、誰進得來 第 1 條說入口只有一個，兩邊說法相反，見下方的缺口二）" },
    ],
    gaps: [{ x: 530, y: 228, lines: ["否：規格沒指定落點", "（缺口一，不畫）"] }],
  },
  {
    id: "tabs",
    label: "兩個分頁之間與中途失去資格",
    w: 560,
    h: 200,
    nodes: [
      n("P1", "page", ["06-01", "使用者管理"], 140, 70, 130, 44),
      n("P2", "page", ["06-02", "角色設定"], 420, 70, 130, 44),
      n("X2", "module", ["02-01", "儀表板"], 280, 160, 120, 44),
    ],
    edges: [
      { id: "2-1", from: "P1", to: "P2", kind: "plain", pts: [[205, 58], [355, 58]], label: "角色設定分頁", lp: [280, 44], text: "P1 點「角色設定」分頁 → P2 角色設定（06-01 §規格 的「存取與分頁切換」第 2 條、§驗收標準「切換到角色設定」；06-02 §怎麼進來、誰進得來 第 1 條、§驗收標準「進入矩陣頁」「系統管理員看到可編輯的矩陣」）" },
      { id: "2-2", from: "P2", to: "P1", kind: "plain", pts: [[355, 82], [205, 82]], label: "使用者管理分頁", lp: [280, 104], text: "P2 點「使用者管理」分頁 → P1 使用者管理（06-02 §怎麼進來、誰進得來 第 3 條、§驗收標準「存完切回使用者管理」）" },
      { id: "2-3", from: "P1", to: "X2", kind: "plain", pts: [[140, 92], [140, 160], [220, 160]], label: "被降級，下一次操作", lp: [72, 130], text: "P1 的系統管理員被另一位系統管理員降為平台成員，下一次操作 → X2 儀表板（06-01 §業務流程「變更系統角色」主流程第 3 步、§卡控機制 第 5 條、§邊界情況（Edge Case）的「存取與分頁切換」第 1 條、§驗收標準「被降級的系統管理員以有效憑證讀取」）" },
      { id: "2-4", from: "P2", to: "X2", kind: "plain", pts: [[420, 92], [420, 160], [340, 160]], label: "被降級，下一次操作", lp: [488, 130], text: "P2 的系統管理員被降為平台成員，下一次操作 → X2 儀表板（06-02 §邊界情況（Edge Case）的「進入與權限」第 3 條只寫「下一次操作就進不來」，落點依同頁 §卡控機制 第 1 條「拒絕並導回儀表板」；06-01 §卡控機制 第 5 條）" },
    ],
    gaps: [],
  },
  {
    id: "invite",
    label: "邀請新帳號與受邀者設定密碼",
    w: 900,
    h: 215,
    nodes: [
      n("P1", "page", ["06-01", "使用者管理"], 120, 90, 130, 44),
      n("D4", "decision", ["有設定寄信？"], 330, 90, 130, 60),
      n("X4", "external", ["收信：", "設定密碼信"], 560, 60, 130, 44),
      n("X6", "external", ["伺服器紀錄：", "設定密碼連結"], 560, 170, 150, 44),
      n("X5", "module", ["01-03", "設定密碼頁"], 800, 115, 140, 44),
    ],
    edges: [
      { id: "3-1", from: "P1", to: "D4", kind: "plain", pts: [[185, 78], [291, 78]], label: "新增並儲存", lp: [225, 68], text: "P1 點「新增使用者」，填寫並點「儲存」，帳號建立 → D4（06-01 §業務流程「邀請新帳號」主流程第 1、2 步；§規格 的「新增帳號」第 1、2 條；§驗收標準「新增帳號成功」）" },
      { id: "3-2", from: "P1", to: "D4", kind: "plain", pts: [[185, 102], [291, 102]], label: "重發設定密碼信", lp: [219, 124], text: "P1 在尚未設定密碼的那一列點「重發設定密碼信」，舊連結作廢 → D4（06-01 §業務流程「邀請新帳號」A1；§規格 的「重發設定密碼信」第 1 條；§驗收標準「重發設定密碼信成功」）" },
      { id: "3-3", from: "D4", to: "X4", kind: "yes", pts: [[395, 90], [445, 90], [445, 60], [495, 60]], label: "是", lp: [457, 52], text: "D4 是 → X4 收信：設定密碼信（06-01 §業務流程「邀請新帳號」主流程第 2 步；§規格 的「新增帳號」第 2 條；§規格 的「重發設定密碼信」第 1 條）" },
      { id: "3-4", from: "D4", to: "X6", kind: "no", pts: [[330, 120], [330, 170], [485, 170]], label: "否", lp: [344, 146], text: "D4 否 → X6 伺服器紀錄：帳號照樣建立，連結留在紀錄裡、不上畫面，畫面告知信沒有寄出與原因，那一列出現「信未寄出」（06-01 §業務流程「邀請新帳號」E1a；§規格 的「新增帳號」的「這個部署沒有設定寄信服務時」與「連結不顯示在畫面上」兩條條列；§規格 的「帳號列表」最後一條；§卡控機制 第 10、12、13 條；§已確認決議 Q9、Q10、Q11；§驗收標準「沒有設定寄信服務時新增帳號」「沒有設定寄信服務時重發」「信未寄出的標記只出現在尚未設定密碼的列」）" },
      { id: "3-5", from: "X4", to: "X5", kind: "plain", pts: [[625, 60], [690, 60], [690, 100], [730, 100]], label: "受邀者開啟連結", lp: [672, 50], text: "X4 受邀的使用者在 24 小時內開啟信裡的連結 → X5 01-03 設定密碼那一頁（06-01 §業務流程「邀請新帳號」主流程第 3 步、E3；§規格 的「新增帳號」第 4 條「設定密碼的頁面屬於帳號模組」；§驗收標準「受邀者在期限內設定密碼」；01-03 §使用角色 的「受邀的使用者「設定密碼」那個畫面由這一頁擁有」、§已確認決議 Q6）" },
      { id: "3-6", from: "X6", to: "X5", kind: "plain", pts: [[635, 170], [690, 170], [690, 130], [730, 130]], label: "管理員轉給對方", lp: [680, 196], text: "X6 系統管理員從伺服器紀錄取出連結轉給對方，對方開啟 → X5 01-03 設定密碼那一頁（06-01 §規格 的「新增帳號」的「請從紀錄取出連結轉給對方」；§邊界情況（Edge Case）的「新增帳號」第 2 條；§已確認決議 Q9）" },
    ],
    gaps: [],
  },
  {
    id: "revoke",
    label: "停用與改 Email 之後對方的去向",
    w: 720,
    h: 150,
    nodes: [
      n("P1", "page", ["06-01", "使用者管理"], 100, 100, 130, 44),
      n("X7", "module", ["01-05", "登入狀態結束"], 390, 100, 150, 44),
      n("X1", "module", ["01-01", "登入頁"], 640, 100, 120, 44),
    ],
    edges: [
      { id: "4-1", from: "P1", to: "X1", kind: "plain", pts: [[100, 78], [100, 28], [640, 28], [640, 78]], label: "停用自己：立即登出不回列表", lp: [370, 20], text: "P1 系統管理員在自己那一列點「停用」，並在確認視窗再點「停用」→ X1 登入頁（自己立即登出並回到登入頁，不回到列表）（06-01 §業務流程「停用的是自己」主流程第 2、3 步與結果；§規格 的「停用與啟用」的「停用的是目前登入的自己時，確認後立即登出並回到登入頁，不回到列表」；§卡控機制 第 17 條；§驗收標準「確認停用自己」）" },
      { id: "4-2", from: "P1", to: "X7", kind: "plain", pts: [[165, 90], [315, 90]], label: "停用別人", lp: [240, 80], text: "P1 停用別人的帳號 → X7 01-05 登入狀態結束，對方所有裝置的登入狀態立刻失效（06-01 §業務流程「停用帳號」主流程第 2 步與結果；§規格 的「停用與啟用」第 2 條；01-05 §帳號被停用或重新啟用 第 1 條與該節第一條條列）" },
      { id: "4-3", from: "P1", to: "X7", kind: "plain", pts: [[165, 112], [315, 112]], label: "改掉別人的 Email", lp: [240, 132], text: "P1 改掉別人的 Email → X7 01-05 登入狀態結束（06-01 §規格 的「編輯帳號」的「修改 Email 後，對方目前的登入狀態立即失效，需要用新的 Email 重新登入」；§驗收標準「修改登入中帳號的 Email」；01-05 §四種改動讓所有裝置重新登入 表格的「系統管理員改了這個帳號的 Email」那一列與第 1 條）" },
      { id: "4-4", from: "X7", to: "X1", kind: "plain", pts: [[465, 100], [580, 100]], label: "下一次操作被拒絕", lp: [522, 90], text: "X7 → X1 登入頁（對方下一次操作被拒絕、回到登入頁；之後重新啟用也不恢復停用前的登入狀態，要重新登入）（01-05 §帳號被停用或重新啟用 第 2、4 條；§四種改動讓所有裝置重新登入 第 2 條；06-01 §規格 的「停用與啟用」的「重新啟用不會恢復停用前的登入狀態，對方要重新登入」；§驗收標準「停用登入中的帳號」「啟用停用中的帳號」）" },
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

export default function Spec06AdminLogicFlow(): ReactElement {
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
