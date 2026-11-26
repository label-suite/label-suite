/**
 * User story map data: the single source for docs/product/story-map.mdx.
 *
 * Each story is one user goal taken from a spec page (its goals, business
 * flows and acceptance criteria). The Epic a story belongs to is not stored
 * here: it is derived from the roadmap's Epic features in roadmap-data.ts,
 * by the spec page the story links to. Where the maintainer ruled a different
 * Epic, the story carries `epicOverride`. A story whose Epic is unclear carries
 * `epicPending` instead, and stays unassigned until the maintainer decides.
 * Edit this file, not the component or the tables, when a story changes.
 */

import { EPICS, type Epic } from "./roadmap-data";

export type ActivityId =
  | "enter"
  | "dashboard"
  | "create"
  | "manage"
  | "annotate"
  | "review"
  | "analyze"
  | "admin"
  | "shared";

export interface Activity {
  id: ActivityId;
  name: string;
  /** True for the row that runs across every activity. */
  cross?: boolean;
}

/** Backbone, left to right; the last entry is the row that spans every activity. */
export const ACTIVITIES: Activity[] = [
  { id: "enter", name: "進入平台" },
  { id: "dashboard", name: "查看儀表板" },
  { id: "create", name: "建立任務" },
  { id: "manage", name: "管理任務與成員" },
  { id: "annotate", name: "執行標記" },
  { id: "review", name: "審核與仲裁" },
  { id: "analyze", name: "分析資料集" },
  { id: "admin", name: "系統管理" },
  { id: "shared", name: "個人設定與共用介面", cross: true },
];

export type RoleId =
  | "platform-member"
  | "system-admin"
  | "project-leader"
  | "reviewer"
  | "annotator"
  | "arbiter";

export interface Role {
  id: RoleId;
  label: string;
  /** Glossary term id, used by the MDX tables as :ref. */
  term: string;
}

/** PRD roles, in the order of the PRD role list. */
export const ROLES: Role[] = [
  { id: "platform-member", label: "平台成員", term: "term.platform-member" },
  { id: "system-admin", label: "系統管理員", term: "term.system-admin" },
  { id: "project-leader", label: "專案負責人", term: "term.project-leader" },
  { id: "reviewer", label: "審核員", term: "term.reviewer" },
  { id: "annotator", label: "標記員", term: "term.annotator" },
  { id: "arbiter", label: "仲裁者", term: "term.arbiter" },
];

export type FilterId = "project-leader" | "annotator" | "reviewer" | "system-admin";

/**
 * The four views of the role filter. A task-role view also lights stories of
 * platform members (task-role holders are platform members, spec 02-01), and
 * the reviewer view lights arbiter stories (an arbiter is a designated
 * reviewer, PRD role list).
 */
export const FILTERS: { id: FilterId; label: string; covers: RoleId[] }[] = [
  { id: "project-leader", label: "專案負責人", covers: ["project-leader", "platform-member"] },
  { id: "annotator", label: "標記員", covers: ["annotator", "platform-member"] },
  { id: "reviewer", label: "審核員", covers: ["reviewer", "arbiter", "platform-member"] },
  { id: "system-admin", label: "系統管理員", covers: ["system-admin"] },
];

export interface SpecPage {
  code: string;
  label: string;
  /** Path under docs/specs/, without the extension. */
  path: string;
}

export const SPECS: SpecPage[] = [
  { code: "01-01", label: "登入", path: "01-account/01-login" },
  { code: "01-02", label: "註冊", path: "01-account/02-register" },
  { code: "01-03", label: "用一次性連結設定密碼", path: "01-account/03-reset-password" },
  { code: "01-04", label: "個人設定", path: "01-account/04-profile" },
  { code: "01-05", label: "登入狀態與安全", path: "01-account/05-login-state" },
  { code: "02-01", label: "儀表板", path: "02-dashboard/01-dashboard" },
  { code: "03-01", label: "任務列表", path: "03-task-management/01-task-list" },
  { code: "03-02", label: "新增任務", path: "03-task-management/02-task-new" },
  { code: "03-03", label: "任務詳情", path: "03-task-management/03-task-detail" },
  { code: "04-01", label: "標記清單", path: "04-annotation/01-annotation-list" },
  { code: "04-02", label: "標記工作區", path: "04-annotation/02-annotation-workspace" },
  { code: "05-01", label: "資料集分析列表", path: "05-dataset/01-analysis-list" },
  { code: "05-02", label: "資料集分析詳情", path: "05-dataset/02-analysis-detail" },
  { code: "05-03", label: "資料匯入與版本", path: "05-dataset/03-ingestion-lineage" },
  { code: "06-01", label: "使用者管理", path: "06-admin/01-user-management" },
  { code: "06-02", label: "角色設定", path: "06-admin/02-role-settings" },
  { code: "07-01", label: "側欄導覽", path: "07-shared/01-sidebar" },
  { code: "07-02", label: "工作頁籤", path: "07-shared/02-workspace-tabs" },
  { code: "07-03", label: "無權限與找不到", path: "07-shared/03-denied-and-not-found" },
  { code: "07-04", label: "通知事件", path: "07-shared/04-notification-events" },
];

export interface Story {
  id: string;
  activity: ActivityId;
  /** The user goal, one sentence. */
  text: string;
  roles: RoleId[];
  /** Spec page code, e.g. "01-01". */
  spec: string;
  /** Epic id the maintainer ruled, used instead of the one derived from the spec page. */
  epicOverride?: string;
  /** Set when the story's Epic is unclear; the maintainer decides. */
  epicPending?: true;
}

/** What the Epic column shows for a story with `epicPending`. */
export const EPIC_PENDING_LABEL = "待維護者確認";

const ALL: RoleId[] = ["platform-member", "system-admin"];

export const STORIES: Story[] = [
  // 進入平台
  { id: "S01", activity: "enter", text: "自己註冊成為平台成員，點驗證連結後帳號才建立", roles: ["platform-member"], spec: "01-02" },
  { id: "S02", activity: "enter", text: "用 Email 與密碼登入平台", roles: ALL, spec: "01-01" },
  { id: "S03", activity: "enter", text: "用 Google 帳號登入，不必另記一組密碼", roles: ALL, spec: "01-01" },
  { id: "S04", activity: "enter", text: "忘記密碼時用一次性連結自己設定新密碼", roles: ALL, spec: "01-03" },
  { id: "S05", activity: "enter", text: "受邀的人用設定密碼信設定自己的密碼", roles: ALL, spec: "01-03" },
  { id: "S06", activity: "enter", text: "一段時間內持續操作，不必反覆登入", roles: ALL, spec: "01-05" },
  { id: "S07", activity: "enter", text: "從這一台登出，其他裝置維持登入", roles: ALL, spec: "01-05" },

  // 查看儀表板
  { id: "S08", activity: "dashboard", text: "登入後直接看到符合自己任務角色的版面", roles: ALL, spec: "02-01" },
  { id: "S09", activity: "dashboard", text: "還沒有任務角色時，從三張行動入口卡知道下一步", roles: ["platform-member"], spec: "02-01" },
  { id: "S10", activity: "dashboard", text: "按「快速繼續」回到這個任務第一筆還沒提交的資料", roles: ["annotator"], spec: "02-01", epicOverride: "E5" },
  { id: "S11", activity: "dashboard", text: "按「快速審核」開到下一個可處理的審核單位", roles: ["reviewer"], spec: "02-01", epicOverride: "E5" },
  { id: "S12", activity: "dashboard", text: "從「等待 IAA 確認」的數字點進已篩好的任務列表", roles: ["system-admin", "project-leader"], spec: "02-01", epicOverride: "E7" },

  // 建立任務
  { id: "S13", activity: "create", text: "只靠任務設定開一個標記任務，建立完成為它的專案負責人", roles: ALL, spec: "03-02" },
  { id: "S14", activity: "create", text: "上傳資料集後當場看到資料，指定每一欄的用途", roles: ALL, spec: "03-02" },
  { id: "S15", activity: "create", text: "設定每一種輸出類型怎麼標，並在預覽上試標一次", roles: ALL, spec: "03-02" },
  { id: "S16", activity: "create", text: "設定試標抽樣筆數，以及要不要隔開試標與正式標記的資料", roles: ALL, spec: "03-02" },
  { id: "S17", activity: "create", text: "中途離開或重新整理時，不在沒被問過的情況下弄丟已填內容", roles: ALL, spec: "03-02" },
  { id: "S18", activity: "create", text: "匯入前逐欄宣告可公開或受保護，定版成不可改的資料集版本", roles: ["project-leader"], spec: "05-03" },
  { id: "S19", activity: "create", text: "草稿階段把某個欄位從可公開改成受保護", roles: ["project-leader"], spec: "05-03" },
  { id: "S20", activity: "create", text: "丟棄還沒定版、也沒被回合引用的草稿版本", roles: ["project-leader"], spec: "05-03" },

  // 管理任務與成員
  { id: "S21", activity: "manage", text: "在任務列表搜尋與篩選，找到要處理的任務，查詢條件留在網址上", roles: ALL, spec: "03-01" },
  { id: "S22", activity: "manage", text: "刪除不再需要的草稿任務，確認後移到封存", roles: ["project-leader", "system-admin"], spec: "03-01" },
  { id: "S23", activity: "manage", text: "在概覽看出任務現在卡在哪、下一步該做什麼", roles: ["project-leader"], spec: "03-03" },
  { id: "S24", activity: "manage", text: "以唯讀方式取得審核需要的任務資訊，碰不到成員與推進", roles: ["reviewer"], spec: "03-03" },
  { id: "S25", activity: "manage", text: "修改任務的設定", roles: ["project-leader"], spec: "03-03" },
  { id: "S26", activity: "manage", text: "搜尋平台成員或用 Email 邀請，把標記員與審核員加進任務", roles: ["project-leader"], spec: "03-03" },
  { id: "S27", activity: "manage", text: "點任務邀請信的連結，成員資格從邀請中變成啟用", roles: ["platform-member"], spec: "03-03" },
  { id: "S28", activity: "manage", text: "按「新增試標回合 R1」開始試標", roles: ["project-leader"], spec: "03-03" },
  { id: "S29", activity: "manage", text: "看過最新回合的 IAA 後，填修訂紀錄再開下一個試標回合", roles: ["project-leader"], spec: "03-03" },
  { id: "S30", activity: "manage", text: "開始正式標記，樣本輪流分派給啟用中的標記員", roles: ["project-leader"], spec: "03-03" },
  { id: "S31", activity: "manage", text: "設定有誤時從等待 IAA 確認退回草稿，記下退回原因", roles: ["project-leader"], spec: "03-03" },
  { id: "S32", activity: "manage", text: "把未指派的標記作業重新指派，或明確排除", roles: ["project-leader"], spec: "03-03" },
  { id: "S33", activity: "manage", text: "看每位成員的進度與品質旗標", roles: ["project-leader"], spec: "03-03" },
  { id: "S34", activity: "manage", text: "逐筆看標記員交了什麼、審核員怎麼判", roles: ["project-leader", "reviewer"], spec: "03-03" },
  { id: "S35", activity: "manage", text: "看工時紀錄", roles: ["project-leader", "reviewer"], spec: "03-03" },
  { id: "S36", activity: "manage", text: "結案條件都滿足後把任務標記完成", roles: ["project-leader"], spec: "03-03" },
  { id: "S37", activity: "manage", text: "任務完成後匯出標記結果，之後重新下載同一份檔案", roles: ["project-leader"], spec: "03-03" },
  { id: "S38", activity: "manage", text: "把序列標註的標記匯出成訓練用的序列格式，重匯結果相同", roles: ["project-leader"], spec: "05-02" },

  // 執行標記
  { id: "S39", activity: "annotate", text: "在標記清單看清楚有哪些資料、自己處理到哪", roles: ["annotator", "reviewer"], spec: "04-01" },
  { id: "S40", activity: "annotate", text: "從側欄進來時挑一個自己有角色的任務", roles: ["annotator", "reviewer"], spec: "04-01" },
  { id: "S41", activity: "annotate", text: "從工作區返回清單時，篩選與頁碼都還在", roles: ["annotator", "reviewer"], spec: "04-01" },
  { id: "S42", activity: "annotate", text: "一致性確認完成後，看自己在歷次試標中的表現", roles: ["annotator"], spec: "04-01" },
  { id: "S43", activity: "annotate", text: "第一次進來先讀任務說明，確認後才開始", roles: ["annotator", "reviewer"], spec: "04-02" },
  { id: "S44", activity: "annotate", text: "一次面對一筆資料，依任務設定作答，儲存草稿或提交", roles: ["annotator"], spec: "04-02" },
  { id: "S45", activity: "annotate", text: "用快捷鍵儲存、提交與翻筆", roles: ["annotator"], spec: "04-02" },
  { id: "S46", activity: "annotate", text: "把網址貼給別人，對方回到同一筆", roles: ["annotator", "reviewer"], spec: "04-02" },

  // 審核與仲裁
  { id: "S47", activity: "review", text: "對系統指派的審核單位逐項通過、修正或標為無法裁決", roles: ["reviewer"], spec: "04-02" },
  { id: "S48", activity: "review", text: "看出標記員與審核員的答案差在哪幾項", roles: ["reviewer", "arbiter"], spec: "04-02" },
  { id: "S49", activity: "review", text: "仲裁爭議：在標記員答案與審核員的決定之間選一邊", roles: ["arbiter"], spec: "04-02" },
  { id: "S50", activity: "review", text: "任務沒有啟用中的仲裁者時，由專案負責人親自裁定爭議", roles: ["project-leader"], spec: "03-03" },
  { id: "S51", activity: "review", text: "逐筆收尾最終例外池：採標記員或審核員答案、自訂答案或排除", roles: ["project-leader"], spec: "04-02" },

  // 分析資料集
  { id: "S52", activity: "analyze", text: "一眼看到自己能分析的任務與各自的 IAA 狀態", roles: ["project-leader", "reviewer"], spec: "05-01" },
  { id: "S53", activity: "analyze", text: "用輸出類型找任務，複合任務也找得到", roles: ["project-leader", "reviewer"], spec: "05-01" },
  { id: "S54", activity: "analyze", text: "在同一個任務下切換統計總覽與品質監控", roles: ["project-leader", "reviewer"], spec: "05-02" },
  { id: "S55", activity: "analyze", text: "看每種輸出類型的 IAA 與門檻", roles: ["project-leader", "reviewer"], spec: "05-02" },
  { id: "S56", activity: "analyze", text: "看標記員的風險等級，和高分歧樣本分開看", roles: ["project-leader", "reviewer"], spec: "05-02" },
  { id: "S57", activity: "analyze", text: "從建議行動前往成員管理，調整標記員的參與狀態", roles: ["project-leader"], spec: "05-02" },

  // 系統管理
  { id: "S58", activity: "admin", text: "查詢帳號並新增帳號，以設定密碼信讓對方自己設密碼", roles: ["system-admin"], spec: "06-01" },
  { id: "S59", activity: "admin", text: "連結過期或遺失時重發設定密碼信", roles: ["system-admin"], spec: "06-01" },
  { id: "S60", activity: "admin", text: "停用帳號讓它立即無法使用，之後可以重新啟用", roles: ["system-admin"], spec: "06-01" },
  { id: "S61", activity: "admin", text: "變更帳號的系統角色", roles: ["system-admin"], spec: "06-01" },
  { id: "S62", activity: "admin", text: "查每一次帳號異動是誰在什麼時間改了什麼", roles: ["system-admin"], spec: "06-01" },
  { id: "S63", activity: "admin", text: "在一個地方看完每個角色能做什麼", roles: ["system-admin"], spec: "06-02" },
  { id: "S64", activity: "admin", text: "收窄角色權限，同時有人改時擋下", roles: ["system-admin"], spec: "06-02" },
  { id: "S65", activity: "admin", text: "查權限矩陣是誰在什麼時候改了哪一格", roles: ["system-admin"], spec: "06-02" },

  // 個人設定與共用介面（橫跨各活動）
  { id: "S66", activity: "shared", text: "自己維護姓名、聯絡方式與頭像", roles: ALL, spec: "01-04" },
  { id: "S67", activity: "shared", text: "換登入用的 Email，新信箱驗證後才生效", roles: ALL, spec: "01-04" },
  { id: "S68", activity: "shared", text: "改密碼；用 Google 帳號進來的人補設一組密碼", roles: ALL, spec: "01-04" },
  { id: "S69", activity: "shared", text: "逐事件決定要不要收通知", roles: ALL, spec: "01-04" },
  { id: "S70", activity: "shared", text: "從側欄知道自己在哪個模組，不走進沒有權限的頁面", roles: ALL, spec: "07-01" },
  { id: "S71", activity: "shared", text: "不離開目前的工作就切換語言與外觀", roles: ALL, spec: "07-01" },
  { id: "S72", activity: "shared", text: "在桌機查看目前頁面能用的快捷鍵", roles: ALL, spec: "07-01" },
  { id: "S73", activity: "shared", text: "在側欄看到未讀通知的數量，並一次全部標為已讀", roles: ALL, spec: "07-01", epicOverride: "E7" },
  { id: "S74", activity: "shared", text: "同時開多個工作頁籤，切回來時檢視狀態都還在", roles: ALL, spec: "07-02" },
  { id: "S75", activity: "shared", text: "把同一個任務的試標與正式標記各開一個頁籤來回比對", roles: ["project-leader"], spec: "07-02" },
  { id: "S76", activity: "shared", text: "頁籤被自動淘汰時，不遺失還沒送出的作答或審核決定", roles: ["annotator", "reviewer"], spec: "07-02" },
  { id: "S77", activity: "shared", text: "被擋下時看懂是什麼狀況，而且有一條走得出去的路", roles: ALL, spec: "07-03" },
  { id: "S78", activity: "shared", text: "知道自己會因為哪些事被通知", roles: ["platform-member"], spec: "07-04" },
  { id: "S79", activity: "shared", text: "在儀表板的最近提醒只看到與全平台有關的事件", roles: ["system-admin"], spec: "07-04" },
];

export const specByCode = (code: string): SpecPage | undefined => SPECS.find((s) => s.code === code);

/**
 * The Epic the maintainer ruled for the story, otherwise the Epic whose roadmap
 * features include the story's spec page; undefined when pending.
 */
export const epicOf = (story: Story): Epic | undefined => {
  if (story.epicPending) return undefined;
  if (story.epicOverride) return EPICS.find((e) => e.id === story.epicOverride);
  return EPICS.find((e) => e.features.some((f) => f.label.startsWith(`${story.spec} `)));
};

/** Whether a story lights up under a role-filter view; null means no filter. */
export const matchesFilter = (story: Story, filter: FilterId | null): boolean => {
  if (filter === null) return true;
  const covers = FILTERS.find((f) => f.id === filter)?.covers ?? [];
  return story.roles.some((r) => covers.includes(r));
};
