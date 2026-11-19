# `annotation/annotation-list`

> 批次 `b3-annotation-review` ｜規格 [`docs/specs/04-annotation/01-annotation-list.mdx`](../../../docs/specs/04-annotation/01-annotation-list.mdx) ｜檔案 `design/prototype/pages/annotation/annotation-list.html`（2497 行）｜交付包 commit `eb9a884`

## 入口

`dashboard/dashboard` 的任務卡「繼續標記」或側欄「標記清單」；從 `annotation/annotation-workspace` 返回時帶回清單的檢視狀態（UXC-11，`:1051`）。

載入：`assets/tokens.css`、`assets/data-palette.css`（#420）、`pages/shared/sidebar.css`、`button.css`、`empty-state.css`、`list-page.css`、`task-type-badge.css`；腳本 `sidebar.js`、`annotation-history.js`、`theme.js`、`analytics.js`。**沒有載入 `modal.css`、`modal-focus.js`**，本頁也沒有 toast。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/annotation/annotation-list.html?task_id=<任務>` | [App Shell](../components/app-shell.md)、[Breadcrumb](../components/breadcrumb.md)（`#entryBreadcrumb`，`:435`）、[Badge](../components/badge.md)（本頁 `.badge`，`:142`–`:177`）、[Progress Bar](../components/progress-bar.md)（本頁 `.progress`，`:179`–`:191`、markup `:456`）、[Button](../components/button.md)（`.btn.btn-primary.slim` 快速繼續）、[List Toolbar](../components/list-toolbar.md)（`role="search"`，`:473`）、[Data Table](../components/data-table.md)（`.task-table`，`:495`）、[Status Pill](../components/status-pill.md)（`.status-badge`，`:257`–`:268`）、[Pagination](../components/pagination.md)（`:509`） |
| `#state-empty` | 任務還沒有資料：`#emptyState` 顯示「目前尚無資料。」（`renderEmptyState`，`:1924`） | [Empty State](../components/empty-state.md)（`empty-state-page`，`:508`） |
| `#state-filtered-empty` | 用 `?q=` 或 `?status=` 篩到 0 列：「找不到符合條件的資料。」＋清除篩選（`:1930`–`:1940`） | [Empty State](../components/empty-state.md)、[List Toolbar](../components/list-toolbar.md) |
| `#state-no-task` | 網址不帶 `task_id`（`renderNotFound`，`:2296`） | [Empty State](../components/empty-state.md)（`empty-state-panel`，`#taskNotFound`，`:467`） |
| `#state-task-not-found` | `task_id` 給一個不存在的代碼 | 同上 |
| `#role-reviewer` | `?role=reviewer`：一列是一個審核單位 | 同 `#state-default` |
| `#role-project-leader` | `?role=project_leader`：角色解析只認標記員與審核員（`:1030`），這個值只改側欄的角色標籤（`:416`） | 同 `#state-default` |
| `#param-run-type` | `?run_type=official_run`；缺值或不認得的值回退成試標 | [Badge](../components/badge.md)（`.badge-dry-run`／`.badge-official`，`:167`–`:174`） |
| `#param-notice-no-actionable-review` | `?notice=no_actionable_review&role=reviewer`（條件在 `:2336`） | [Empty State](../components/empty-state.md)（`empty-state-panel`，`#noActionableNotice`，`role="status"`，`:471`） |

**`#state-loading` 無法重現**：本頁沒有任何載入狀態，規格 §空的與找不到 第 1、2 條（Q8）要求的載入中畫面不存在 → 交付包列為無法重現，追蹤在 label-suite/label-suite#187。

**沒帶任務與找不到任務的標題分開**（#423）：`renderNotFound` 依有沒有 `task_id` 選標題（`:2308`）——沒帶是「尚未選擇任務／No task selected」（`noTaskTitle`，`:586`），帶了查不到才是「找不到這個任務」；說明照舊是「未指定任務，請回到儀表板重新選擇任務。」。規格 §路由上下文與回退 第 6 條只要那句說明與回儀表板的入口，沒有規定標題 → `../design-gaps.md` G-48。

另外找得到但交付包沒有列的：試標歷史回饋卡（`#dryRunFeedbackCard`，`:465`，只對標記員且試標時由 `renderDryRunFeedback`，`:2199`，填入）→ `../design-gaps.md` G-51。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.badge`（`:142`–`:178`） | 本頁重寫的徽章；`.badge-dry-run`／`.badge-official` 原本寫死 hex，#420 起改用中性 token 與 `--color-accent*`（`:169`–`:178`）→ [Badge](../components/badge.md)、G-02 |
| `.progress`（`:179`–`:191`） | 本頁的進度條，全用 token，但 markup 帶 `aria-hidden="true"`（`:456`），沒有 `role="progressbar"` → [Progress Bar](../components/progress-bar.md) |
| `.status-badge`（`:254`–`:265`） | 與 showcase 的 Status Pill（`components-showcase.html:383`–`:385`）逐字相同，只換了 class 名 → [Status Pill](../components/status-pill.md) |
| `.mini-btn` | #423 起用正典 `pages/shared/button.css` 的小尺寸 variant，本頁不再重新定義 → G-37 |
| 結果標籤（`:346`–`:348`） | #420 之前全頁 CSS 約 30 個寫死的 hex，結果標籤另有一組暗色 hex；#420 起改用 success／info／error 族（Q3），跟著 token 翻轉，暗色那組已刪，全頁不剩 hex → G-02、G-10 |

標記員的列是 `tr role="button" tabindex="0"`，Enter／Space 進工作區（`:1819`）。

## 業務行為

連回規格 [`04-annotation/01-annotation-list.mdx`](../../../docs/specs/04-annotation/01-annotation-list.mdx)。UXC 落點：UXC-09（`renderEmptyState`，`:1924`–`:1941`）、UXC-11（清單狀態放網址，`:1082`）。
