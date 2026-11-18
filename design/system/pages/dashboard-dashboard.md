# `dashboard/dashboard`

> 批次 `b2-admin-dashboard-task` ｜規格 [`docs/specs/02-dashboard/01-dashboard.mdx`](../../../docs/specs/02-dashboard/01-dashboard.mdx) ｜檔案 `design/prototype/pages/dashboard/dashboard.html`（502 行）＋ `dashboard.js`、`dashboard.layout.css`、`dashboard.components.css` ｜交付包 commit `eb9a884`

## 入口

登入後的首頁，側欄「儀表板」。

載入（`dashboard.html:11`–`:20`）：`assets/tokens.css`、`assets/data-palette.css`（#420）、`pages/shared/sidebar.css`、`pages/shared/button.css`、`dashboard.layout.css`（它 `@import` `pages/shared/metric.css`，`:1`）、`dashboard.components.css`、`pages/shared/task-type-badge.css`。

五種版面是同一頁的五個 `<section class="view">`（`:109`、`:251`、`:346`、`:389`、`:433`），`applyScenario`（`dashboard.js:555`）切換。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/dashboard/dashboard.html`（落在 `view-user`） | [App Shell](../components/app-shell.md)、[Card](../components/card.md)（`.panel`）、[Metric](../components/metric.md)、[Button](../components/button.md) |
| `#param-scenario-user` | `?scenario=user`（`:109`） | [Card](../components/card.md)、[Button](../components/button.md)（三個角色 CTA 都是 `.btn-cta`，`:157`、`:199`、`:241`；#423 起不再各自配色） |
| `#param-scenario-super-admin-data` | `?scenario=super_admin_data`（`:251`） | [Card](../components/card.md)、[Metric](../components/metric.md)、[Badge](../components/badge.md)（`dashboard.js:127`）、[Button](../components/button.md)（`.btn-secondary slim`，`:338`） |
| `#param-scenario-project-leader` | `?scenario=project_leader`（`:346`） | [Card](../components/card.md)、[Metric](../components/metric.md)、[Progress Bar](../components/progress-bar.md)（`dashboard.js:213`–`:224`）、[Button](../components/button.md)（`:380`） |
| `#param-scenario-annotator` | `?scenario=annotator`（`:389`） | [Card](../components/card.md)、[Metric](../components/metric.md)、[Progress Bar](../components/progress-bar.md)、`.filter-select`（`:421`） |
| `#param-scenario-reviewer` | `?scenario=reviewer`（`:433`） | [Card](../components/card.md)、[Metric](../components/metric.md)、[Badge](../components/badge.md)（`dashboard.js:243`、`:247`）、`.filter-select`（`:472`）、[Empty State](../components/empty-state.md)（`empty-state-compact`，`dashboard.js:431`） |
| `#param-view-skeleton` | `?view=skeleton`：**永遠停在載入中**（`dashboard.js:627`） | [Skeleton](../components/skeleton.md)（`:66`–`:78`，`.skeleton`／`.skel-line`／`.skel-metric` 放在 `.metric` 裡） |
| `#param-view-error` | `?view=error`（`:97`） | `.dashboard-error-state`（見下）、[Button](../components/button.md)（「重試」`.btn.btn-primary`，`:103`；`dashboard.js:637`–`:641`） |

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.btn` 與 `.btn-secondary.slim`（`dashboard.layout.css:208`–`:238`） | 本頁的 `.btn` 外框，`:where(.btn)` 零特異性，variant 用正典 `button.css`；焦點環 `outline: 2px solid var(--color-primary)`（`:235`–`:238`）。原本的 `.btn-emerald`／`.btn-violet`／`.btn-indigo` 已於 #423 刪除 → G-37 |
| `.badge`／`.badge-error`／`.badge-draft`（`dashboard.layout.css:238`、`:269`、`:278`） | 本頁的 badge；#420 起中性徽章改用中性 token，任務型別配色另從 `task-type-badge.css`（取自 `data-palette.css`）來 → G-02 |
| `.progress`（`dashboard.components.css:206`–`:241`） | 與正典 [Progress Bar](../components/progress-bar.md) **同名同構**；`role="progressbar"` 只在審核覆蓋率那一條有（`dashboard.js:213`），一般進度條沒有（`:222`） |
| `.skeleton`（`dashboard.components.css:319`–`:329`） | 正典的 shimmer 變體，逐字相同；#420 起漸層改用 token，暗色那組寫死的漸層已刪 → G-02、G-10 |
| `.dashboard-error-state` | 本頁的錯誤狀態卡，和 State Panel 不同一份（`components/state-panel.md`） → G-10 |
| `.filter-select`（`dashboard.components.css:368`–`:376`） | 本頁的下拉，和 `task-list` 的同名 class 不同一份 |

## 業務行為

連回規格 [`02-dashboard/01-dashboard.mdx`](../../../docs/specs/02-dashboard/01-dashboard.mdx)。「還沒有任務角色」的版面不定名，見該規格 Q8。
