# `annotation/annotation-list`

> 批次 `b3-annotation-review` ｜規格 [`docs/specs/04-annotation/01-annotation-list.mdx`](../../../docs/specs/04-annotation/01-annotation-list.mdx) ｜檔案 `design/prototype/pages/annotation/annotation-list.html`（2497 行）｜交付包 commit `eb9a884`

## 入口

`dashboard/dashboard` 的任務卡「繼續標記」或側欄「標記清單」；從 `annotation/annotation-workspace` 返回時帶回清單的檢視狀態（UXC-11，`:1078`）。

載入：`assets/tokens.css`、`pages/shared/sidebar.css`、`button.css`、`empty-state.css`、`list-page.css`、`task-type-badge.css`；腳本 `sidebar.js`、`annotation-history.js`、`theme.js`、`analytics.js`。**沒有載入 `modal.css`、`modal-focus.js`**，本頁也沒有 toast。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/annotation/annotation-list.html?task_id=<任務>` | [App Shell](../components/app-shell.md)、[Breadcrumb](../components/breadcrumb.md)（`#entryBreadcrumb`，`:465`）、[Badge](../components/badge.md)（本頁 `.badge`，`:140`–`:175`）、[Progress Bar](../components/progress-bar.md)（本頁 `.progress`，`:176`–`:188`、markup `:485`）、[Button](../components/button.md)（`.btn.btn-primary.slim` 快速繼續）、[List Toolbar](../components/list-toolbar.md)（`role="search"`，`:502`）、[Data Table](../components/data-table.md)（`.task-table`，`:524`）、[Status Pill](../components/status-pill.md)（`.status-badge`，`:254`–`:265`）、[Pagination](../components/pagination.md)（`:538`） |
| `#state-empty` | 任務還沒有資料：`#emptyState` 顯示「目前尚無資料。」（`renderEmptyState`，`:1951`） | [Empty State](../components/empty-state.md)（`empty-state-page`，`:537`） |
| `#state-filtered-empty` | 用 `?q=` 或 `?status=` 篩到 0 列：「找不到符合條件的資料。」＋清除篩選（`:1957`–`:1966`） | [Empty State](../components/empty-state.md)、[List Toolbar](../components/list-toolbar.md) |
| `#state-no-task` | 網址不帶 `task_id`（`renderNotFound`，`:2305`） | [Empty State](../components/empty-state.md)（`empty-state-panel`，`#taskNotFound`，`:476`） |
| `#state-task-not-found` | `task_id` 給一個不存在的代碼 | 同上 |
| `#role-reviewer` | `?role=reviewer`：一列是一個審核單位 | 同 `#state-default` |
| `#role-project-leader` | `?role=project_leader`：角色解析只認標記員與審核員（`:1053`），這個值只改側欄的角色標籤（`:440`） | 同 `#state-default` |
| `#param-run-type` | `?run_type=official_run`；缺值或不認得的值回退成試標 | [Badge](../components/badge.md)（`.badge-dry-run`／`.badge-official`，`:167`–`:174`） |
| `#param-notice-no-actionable-review` | `?notice=no_actionable_review&role=reviewer`（條件在 `:2351`） | [Empty State](../components/empty-state.md)（`empty-state-panel`，`#noActionableNotice`，`role="status"`，`:500`） |

**`#state-loading` 無法重現**：本頁沒有任何載入狀態，規格 §空的與找不到 第 1、2 條（Q8）要求的載入中畫面不存在 → 交付包列為無法重現，追蹤在 label-suite/label-suite#187。

**沒帶任務與找不到任務的標題分開**（#423）：`renderNotFound` 依有沒有 `task_id` 選標題（`:2317`）——沒帶是「尚未選擇任務／No task selected」（`noTaskTitle`，`:595`），帶了查不到才是「找不到這個任務」；說明照舊是「未指定任務，請回到儀表板重新選擇任務。」。規格 §路由上下文與回退 第 6 條只要那句說明與回儀表板的入口，沒有規定標題 → `../design-gaps.md` G-48。

另外找得到但交付包沒有列的：試標歷史回饋卡（`#dryRunFeedbackCard`，`:494`，只對標記員且試標時由 `renderDryRunFeedback`，`:2215`，填入）→ `../design-gaps.md` G-51。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.badge`（`:140`–`:175`） | 本頁重寫的徽章；`.badge-dry-run`／`.badge-official` 寫死 hex（`:167`–`:174`）→ [Badge](../components/badge.md)、G-02 |
| `.progress`（`:176`–`:188`） | 本頁的進度條，全用 token，但 markup 帶 `aria-hidden="true"`（`:485`），沒有 `role="progressbar"` → [Progress Bar](../components/progress-bar.md) |
| `.status-badge`（`:254`–`:265`） | 與 showcase 的 Status Pill（`components-showcase.html:379`–`:381`）逐字相同，只換了 class 名 → [Status Pill](../components/status-pill.md) |
| `.mini-btn` | #423 起用正典 `pages/shared/button.css` 的小尺寸 variant，本頁不再重新定義 → G-37 |
| 結果標籤 hex（`:364`–`:366`）與暗色模式 hex（`:422`–`:428`） | 全頁 CSS 約 30 個寫死的 hex ＋ 1 個 rgba → G-02、G-10 |

標記員的列是 `tr role="button" tabindex="0"`，Enter／Space 進工作區（`:1875`）。

## 業務行為

連回規格 [`04-annotation/01-annotation-list.mdx`](../../../docs/specs/04-annotation/01-annotation-list.mdx)。UXC 落點：UXC-09（`renderEmptyState`，`:1949`–`:1966`）、UXC-11（清單狀態放網址，`:1078`）。
