/**
 * Product roadmap data: the single source for docs/product/roadmap.mdx.
 *
 * Every roadmap component (epic list, goal hierarchy, swimlane timeline,
 * benefit-complexity matrix) reads from here, so each epic's one-line
 * summary is defined exactly once. Edit this file, not the components,
 * when the roadmap changes.
 */

export type GoalId = "G1" | "G2" | "G3" | "G4" | "G5" | "G6";
export type HorizonId = "month" | "quarter" | "later";
export type Level = "high" | "low";
export type LaneId = "release" | "milestone" | "product" | "infra" | "ux" | "thesis";

export interface Goal {
  id: GoalId;
  /** Short name; the full wording and measure live in the PRD goals table. */
  short: string;
}

export interface Horizon {
  id: HorizonId;
  label: string;
  /** What the breakdown in this horizon is for. */
  detail: string;
  /** Timeline span, in the shared 0..6 scale used by the swimlane chart. */
  span: [number, number];
}

export interface Feature {
  label: string;
  subs?: string[];
}

export interface Epic {
  id: string;
  name: string;
  /** One sentence: what this epic delivers and for whom. */
  oneLiner: string;
  /** First goal is the primary one; the hierarchy groups the epic under it. */
  goals: GoalId[];
  horizon: HorizonId;
  /** Spec pages or issues the epic covers. */
  scope: string;
  benefit: Level;
  complexity: Level;
  /** One sentence explaining the quadrant. */
  why: string;
  /** Spec pages (or PRD measures) the epic breaks down into, like E1. */
  features: Feature[];
}

export interface Bar {
  lane: LaneId;
  label: string;
  start: number;
  end: number;
  epic?: string;
}

export interface Marker {
  lane: "release" | "milestone";
  label: string;
  at: number;
  /** 0 = upper row, 1 = lower row; keeps nearby labels apart. */
  row: 0 | 1;
}

export const GOALS: Goal[] = [
  { id: "G1", short: "同一平台走完一次標記" },
  { id: "G2", short: "只改任務設定就換一種任務" },
  { id: "G3", short: "建立任務的步驟比現有工具少" },
  { id: "G4", short: "標記過程中就看到資料統計" },
  { id: "G5", short: "標記員與審核員覺得好上手" },
  { id: "G6", short: "向論文讀者重現使用情境" },
];

export const HORIZONS: Horizon[] = [
  { id: "month", label: "下個月", detail: "直接開 issue 動工", span: [0, 1] },
  { id: "quarter", label: "接下來兩個月", detail: "動工前再對一次規格", span: [1, 3] },
  { id: "later", label: "之後", detail: "條件成熟再排", span: [3, 6] },
];

export const EPICS: Epic[] = [
  {
    id: "E0",
    name: "基礎建設收尾",
    oneLiner: "讓前後端、契約與 CI 檢查在同一套 Docker Compose 與 e2e 上跑通，功能開發才有共同的起點。",
    goals: ["G1"],
    horizon: "month",
    scope: "Epic #502 的 #506",
    benefit: "low",
    complexity: "high",
    why: "使用者看不到，但之後每個模組都建在它上面。",
    features: [{ label: "#506 整合", subs: ["Docker Compose", "e2e", "CI 檢查"] }],
  },
  {
    id: "E1",
    name: "帳號",
    oneLiner: "讓使用者能註冊、登入、用一次性連結設定密碼，並建立之後每個模組都依賴的認證與權限 guard。",
    goals: ["G1"],
    horizon: "month",
    scope: "規格 01-01～01-05",
    benefit: "low",
    complexity: "low",
    why: "不直接對應任何目標，卻是所有角色進入平台的門。",
    features: [
      { label: "01-01 登入", subs: ["認證與權限 guard", "Google SSO"] },
      { label: "01-02 註冊" },
      { label: "01-03 設定密碼", subs: ["一次性連結信"] },
      { label: "01-05 登入狀態與安全" },
      { label: "01-04 個人設定" },
    ],
  },
  {
    id: "E2",
    name: "共用介面外殼",
    oneLiner: "讓每一頁共用同一套側欄、工作頁籤與無權限／找不到畫面。",
    goals: ["G1", "G5"],
    horizon: "month",
    scope: "規格 07-01～07-03",
    benefit: "low",
    complexity: "low",
    why: "每個功能頁都掛在這個外殼上，先做才不必回頭改。",
    features: [
      { label: "07-01 側欄導覽", subs: ["語言切換", "外觀切換", "快捷鍵總覽"] },
      { label: "07-02 工作頁籤" },
      { label: "07-03 無權限與找不到" },
    ],
  },
  {
    id: "E3",
    name: "系統管理",
    oneLiner: "讓系統管理員管理帳號，並在 PRD 權限矩陣的上限內收窄角色權限。",
    goals: ["G1"],
    horizon: "quarter",
    scope: "規格 06-01、06-02",
    benefit: "low",
    complexity: "low",
    why: "只有系統管理員用得到，但權限設定會影響後面每個模組。",
    features: [
      { label: "06-01 使用者管理", subs: ["新增與編輯帳號", "重發設定密碼信", "異動紀錄"] },
      { label: "06-02 角色設定", subs: ["兩層授權模型", "權限鍵對應 PRD 格", "修改紀錄"] },
    ],
  },
  {
    id: "E4",
    name: "任務管理",
    oneLiner: "讓專案負責人只靠任務設定建立任務、管理成員，並推進試標與正式標記。",
    goals: ["G2", "G3"],
    horizon: "quarter",
    scope: "規格 03-01～03-03",
    benefit: "high",
    complexity: "high",
    why: "設定驅動是論文的核心主張，而任務設定的契約要撐住所有任務類型。",
    features: [
      { label: "03-01 任務列表", subs: ["搜尋與篩選", "新增與刪除任務"] },
      { label: "03-02 新增任務", subs: ["上傳資料集", "欄位用途", "八種輸出類型的預覽"] },
      { label: "03-03 任務詳情", subs: ["設定分頁", "成員管理", "五個狀態與試標回合"] },
    ],
  },
  {
    id: "E5",
    name: "標記作業",
    oneLiner: "讓標記員依任務設定作答，審核員審核、處理爭議與仲裁。",
    goals: ["G1", "G2"],
    horizon: "quarter",
    scope: "規格 04-01、04-02",
    benefit: "high",
    complexity: "high",
    why: "標記員每天停留的畫面，同時要依設定換作答方式、隔離標準答案。",
    features: [
      { label: "04-01 標記清單", subs: ["標記員視圖", "審核員視圖", "試標歷史回饋"] },
      { label: "04-02 標記工作區", subs: ["三欄外殼", "題目卡與標記卡", "指引閘門", "鍵盤快捷鍵"] },
    ],
  },
  {
    id: "E6",
    name: "資料集",
    oneLiner: "讓專案負責人與審核員在標記過程中就看到統計、IAA 與資料來源版本。",
    goals: ["G4", "G1"],
    horizon: "quarter",
    scope: "規格 05-01～05-03",
    benefit: "high",
    complexity: "high",
    why: "試標要靠 IAA 才能推進，統計必須和人工計算完全一致。",
    features: [
      { label: "05-01 分析列表", subs: ["搜尋與篩選", "IAA 狀態徽章"] },
      { label: "05-02 分析詳情", subs: ["兩個分頁與各自的權限"] },
      { label: "05-03 資料匯入與版本", subs: ["版本快照與來源追溯", "答案欄位隔離"] },
    ],
  },
  {
    id: "E7",
    name: "儀表板與通知",
    oneLiner: "讓使用者登入後一眼看到自己的任務與待辦，並在關鍵事件時收到通知。",
    goals: ["G5"],
    horizon: "later",
    scope: "規格 02-01、07-04",
    benefit: "low",
    complexity: "low",
    why: "彙整前面模組已有的資料，模組齊了才有東西可以彙整。",
    features: [
      { label: "02-01 儀表板", subs: ["依角色的版面", "快速繼續與快速審核"] },
      { label: "07-04 通知事件", subs: ["事件清單", "兩個消費端"] },
    ],
  },
  {
    id: "E8",
    name: "論文驗證",
    oneLiner: "用五種研究示例、建立步驟數比較、統計核對、SUS 問卷與示範影片，逐一證明 PRD 的六個目標。",
    goals: ["G2", "G3", "G4", "G5", "G6"],
    horizon: "later",
    scope: "PRD 目標表的衡量方式",
    benefit: "high",
    complexity: "low",
    why: "幾乎不寫新功能，卻直接決定論文能不能交出成果。",
    features: [
      { label: "五種研究示例", subs: ["只靠任務設定建立"] },
      { label: "建立步驟數比較", subs: ["對照 Label Studio"] },
      { label: "統計核對", subs: ["句數、詞數、標籤數"] },
      { label: "SUS 問卷", subs: ["5～10 位實驗室成員"] },
      { label: "示範影片", subs: ["2～3 個使用情境"] },
    ],
  },
  {
    id: "E9",
    name: "發版與 DOI",
    oneLiner: "把論文使用的版本發成有 CHANGELOG、tag 與 Zenodo DOI 的可引用 release。",
    goals: ["G6"],
    horizon: "later",
    scope: "Epic #3",
    benefit: "low",
    complexity: "low",
    why: "流程已規劃好，只在論文定版時執行一次。",
    features: [
      { label: "#6 發版流程定案", subs: ["CHANGELOG", "release commit 與 tag"] },
      { label: "#7 發版自動化", subs: ["版號一致性檢查", "Zenodo DOI"] },
    ],
  },
];

export const LANES: { id: LaneId; label: string }[] = [
  { id: "release", label: "交付" },
  { id: "milestone", label: "里程碑" },
  { id: "product", label: "產品模組" },
  { id: "infra", label: "基礎建設" },
  { id: "ux", label: "UX 與設計" },
  { id: "thesis", label: "論文驗證" },
];

/** Timeline scale: 0..1 next month, 1..3 the two months after, 3..6 the rest. */
export const BARS: Bar[] = [
  { lane: "product", label: "帳號", start: 0.1, end: 1, epic: "E1" },
  { lane: "product", label: "共用介面外殼", start: 0.3, end: 1, epic: "E2" },
  { lane: "product", label: "系統管理", start: 1, end: 1.5, epic: "E3" },
  { lane: "product", label: "任務管理", start: 1.2, end: 2.2, epic: "E4" },
  { lane: "product", label: "標記作業", start: 1.8, end: 2.9, epic: "E5" },
  { lane: "product", label: "資料集", start: 2.2, end: 3, epic: "E6" },
  { lane: "product", label: "儀表板與通知", start: 3, end: 3.8, epic: "E7" },
  { lane: "infra", label: "基礎建設收尾", start: 0, end: 0.3, epic: "E0" },
  { lane: "infra", label: "認證與權限 guard", start: 0.1, end: 0.5, epic: "E1" },
  { lane: "ux", label: "標記作業畫面修正", start: 1.5, end: 1.9, epic: "E5" },
  { lane: "ux", label: "說明入口評估", start: 4.6, end: 5.1 },
  { lane: "thesis", label: "五種研究示例", start: 2.2, end: 3.2, epic: "E8" },
  { lane: "thesis", label: "步驟數比較與統計核對", start: 3, end: 3.7, epic: "E8" },
  { lane: "thesis", label: "SUS 招募與填答", start: 3.3, end: 4.3, epic: "E8" },
  { lane: "thesis", label: "SUS 分析", start: 4.3, end: 4.8, epic: "E8" },
  { lane: "thesis", label: "示範影片", start: 4.8, end: 5.6, epic: "E8" },
  { lane: "release", label: "發版與 DOI", start: 5.5, end: 6, epic: "E9" },
];

export const MARKERS: Marker[] = [
  { lane: "release", label: "R1 可以登入", at: 1, row: 0 },
  { lane: "release", label: "R2 完整流程", at: 3, row: 0 },
  { lane: "release", label: "R3 論文版", at: 5.8, row: 1 },
  { lane: "milestone", label: "基礎建設完成", at: 0.3, row: 0 },
  { lane: "milestone", label: "SUS 開始招募", at: 3.3, row: 1 },
  { lane: "milestone", label: "第一次完整流程示範", at: 3, row: 0 },
  { lane: "milestone", label: "示範影片完成", at: 5.6, row: 0 },
];

export const epicById = (id: string): Epic | undefined => EPICS.find((e) => e.id === id);
