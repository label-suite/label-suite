# `dashboard/dashboard`

> 批次 `b2-admin-dashboard-task` ｜規格 [`docs/specs/02-dashboard/01-dashboard.mdx`](../../../docs/specs/02-dashboard/01-dashboard.mdx) ｜檔案 `design/prototype/pages/dashboard/dashboard.html`（502 行）＋ `dashboard.js`、`dashboard.layout.css`、`dashboard.components.css` ｜交付包 commit `eb9a884`

## 入口

登入後的首頁，側欄「儀表板」。

載入（`dashboard.html:11`–`:17`）：`assets/tokens.css`、`pages/shared/sidebar.css`、`pages/shared/button.css`、`dashboard.layout.css`（它 `@import` `pages/shared/metric.css`，`:1`）、`dashboard.components.css`、`pages/shared/task-type-badge.css`。

五種版面是同一頁的五個 `<section class="view">`（`:108`、`:250`、`:345`、`:388`、`:432`），`applyScenario`（`dashboard.js:555`）切換。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/dashboard/dashboard.html`（落在 `view-user`） | [App Shell](../components/app-shell.md)、[Card](../components/card.md)（`.panel`）、[Metric](../components/metric.md)、[Button](../components/button.md) |
| `#param-scenario-user` | `?scenario=user`（`:108`） | [Card](../components/card.md)、[Button](../components/button.md)（`.btn-emerald`／`.btn-violet`／`.btn-indigo`，`:156`、`:198`、`:240`） |
| `#param-scenario-super-admin-data` | `?scenario=super_admin_data`（`:250`） | [Card](../components/card.md)、[Metric](../components/metric.md)、[Badge](../components/badge.md)（`dashboard.js:127`）、[Button](../components/button.md)（`.btn-secondary slim`，`:337`） |
| `#param-scenario-project-leader` | `?scenario=project_leader`（`:345`） | [Card](../components/card.md)、[Metric](../components/metric.md)、[Progress Bar](../components/progress-bar.md)（`dashboard.js:213`–`:224`）、[Button](../components/button.md)（`:380`） |
| `#param-scenario-annotator` | `?scenario=annotator`（`:388`） | [Card](../components/card.md)、[Metric](../components/metric.md)、[Progress Bar](../components/progress-bar.md)、`.filter-select`（`:420`） |
| `#param-scenario-reviewer` | `?scenario=reviewer`（`:432`） | [Card](../components/card.md)、[Metric](../components/metric.md)、[Badge](../components/badge.md)（`dashboard.js:243`、`:247`）、`.filter-select`（`:472`）、[Empty State](../components/empty-state.md)（`empty-state-compact`，`dashboard.js:431`） |
| `#param-view-skeleton` | `?view=skeleton`：**永遠停在載入中**（`dashboard.js:627`） | [Skeleton](../components/skeleton.md)（`:65`–`:77`，`.skeleton`／`.skel-line`／`.skel-metric` 放在 `.metric` 裡） |
| `#param-view-error` | `?view=error`（`:96`） | `.dashboard-error-state`（見下）、[Button](../components/button.md)（「重試」`.btn.btn-primary`，`:102`；`dashboard.js:637`–`:641`） |

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.btn` 與 `.btn-emerald`／`.btn-violet`／`.btn-indigo`／`.btn-secondary.slim`（`dashboard.layout.css:211`–`:240`） | 本頁自己的按鈕系統，`:where(.btn)` 零特異性；焦點環寫死 rgba（`:235`）→ G-37 |
| `.badge`／`.badge-error`／`.badge-draft`（`dashboard.layout.css:241`、`:272`、`:281`；`dashboard.components.css:425`） | 本頁的 badge，任務型別配色另從 `task-type-badge.css` 來 → G-02 |
| `.progress`（`dashboard.components.css:235`–`:270`） | 與正典 [Progress Bar](../components/progress-bar.md) **同名同構**；`role="progressbar"` 只在審核覆蓋率那一條有（`dashboard.js:213`），一般進度條沒有（`:222`） |
| `.skeleton`（`dashboard.components.css:348`–`:386`） | 正典的 shimmer 變體，逐字相同，暗色另寫死一組漸層 → G-02、G-10 |
| `.dashboard-error-state` | 本頁的錯誤狀態卡，和 State Panel 不同一份（`components/state-panel.md`） → G-10 |
| `.filter-select`（`dashboard.components.css:451`–`:459`） | 本頁的下拉，和 `task-list` 的同名 class 不同一份 |

## 業務行為

連回規格 [`02-dashboard/01-dashboard.mdx`](../../../docs/specs/02-dashboard/01-dashboard.mdx)。「還沒有任務角色」的版面不定名，見該規格 Q8。
