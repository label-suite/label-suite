# `task-management/task-detail`

> 批次 `b2-admin-dashboard-task` ｜規格 [`docs/specs/03-task-management/03-task-detail.mdx`](../../../docs/specs/03-task-management/03-task-detail.mdx) ｜檔案 `design/prototype/pages/task-management/task-detail.html`（12501 行）＋ `task-detail.panels/` 六個 partial、`task-config.css`、`task-config.engine.js` ｜交付包 commit `eb9a884`

## 入口

`task-management/task-list` 點任務名稱。

載入：`assets/tokens.css`、`pages/shared/modal.css`、`sidebar.css`、`button.css`、`date-range-picker.css`、`empty-state.css`、`content-tabs.css`、`metric.css`、`task-config.css`；腳本 `sidebar.js`、`date-range-picker.js`、`modal-focus.js`、`span-tagging-export.js`、`task-config.engine.js`、`task-detail.config.js` 等。六個分頁的內容由 `fetchPanelPartial` 從 `task-detail.panels/*.html` 載入（`:4645`–`:4707`）。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#tab-overview` | `?tab=overview`（預設） | [App Shell](../components/app-shell.md)、[Breadcrumb](../components/breadcrumb.md)（`:1947`–`:1950`）、[Content Tabs](../components/content-tabs.md)（`.admin-tabs`，`:1955`–`:1962`）、[Card](../components/card.md)（本頁的 `.panel`，`:91`）、[Metric](../components/metric.md)（`overview.html`，4 處）、[Badge](../components/badge.md)（`:117`–`:132`） |
| `#tab-member-management` | `?tab=member-management` | [Data Table](../components/data-table.md)（`.member-table`，`member-management.html:19`、`:57`、`:106`）、[Pagination](../components/pagination.md)、[Modal](../components/modal.md)（`memberAction`，`:2096`） |
| `#tab-annotation-progress` | `?tab=annotation-progress` | [Metric](../components/metric.md)（6 處）、[Data Table](../components/data-table.md)（`annotation-progress.html:32`、`:61`、`:93`、`:121`）、[Pagination](../components/pagination.md)（`:134`）、[Empty State](../components/empty-state.md)（`empty-state-panel`，`:157`） |
| `#tab-annotation-results` | `?tab=annotation-results` | [Data Table](../components/data-table.md)（`annotation-results.html:48`、`:95`）、[Pagination](../components/pagination.md)（`:63`、`:112`）、[Empty State](../components/empty-state.md)（`:164`）、[Modal](../components/modal.md)（`arSeqExportModal`，`:138`） |
| `#tab-work-log` | `?tab=work-log` | [Date Range Picker](../components/date-range-picker.md)（`work-log.html:7`）、[Data Table](../components/data-table.md)（`:38`）、[Metric](../components/metric.md)（4 處）、[Empty State](../components/empty-state.md)（`:84`） |
| `#tab-settings` | `?tab=settings` | [Toggle Switch](../components/toggle-switch.md)（`settings.html:274`、`:345`）、[Tooltip](../components/tooltip.md)（`:321`–`:323`）、[Chip](../components/chip.md)（`:74`、`:78`）、[Accordion](../components/accordion.md)、[Color Dot](../components/color-dot.md)、[Modal](../components/modal.md)（`settingsLeave`，`:2035`） |
| `#param-section-basic` | `?tab=settings&section=basic`（預設；`SETTINGS_SECTIONS`，`:5034`） | 同 `#tab-settings` |
| `#param-section-labeling` | `?tab=settings&section=labeling` | 同上，加 [Modal](../components/modal.md)（`taxonomyDelete`，`:2012`；`datasetPreview`，`:1995`） |
| `#param-section-sampling` | `?tab=settings&section=sampling` | 同 `#tab-settings` |
| `#param-section-review` | `?tab=settings&section=review` | 同 `#tab-settings` |
| `#param-section-guideline` | `?tab=settings&section=guideline` | 同 `#tab-settings` |
| `#param-status` | `?status=<任務狀態>`：狀態轉換與回合表跟著變 | [Badge](../components/badge.md)、[Modal](../components/modal.md)（`risk`，`:2023`；`backToDraft`，`:2049`；`trialRoundRevision`，`:2067`） |
| `#role-project-leader` | `?task_role=project_leader` | 同 `#tab-overview`，操作最多 |
| `#role-reviewer` | `?task_role=reviewer` | 同 `#tab-overview`，操作減少 |
| `#role-annotator` | `?task_role=annotator`，或不給、給錯值（fail closed，`:5149`） | **不算繪**，直接導到 `task-list.html?unauthorized=1`（`:5176`），看到的是 `task-management/task-list#param-unauthorized` |
| `#sim-403` | `?sim_403=1`（`:5163`） | `taskForbidden` 面板（`:1979`–`:1990`） |
| `#state-panel-load-failed` | 讓某一個 partial 請求失敗：只有那個分頁留佔位與重試，其他照常（`:4645`–`:4707`） | `.panel` ＋ [Button](../components/button.md)（`.mini-btn`） |

載入中的骨架（`.skeleton-stack`／`.skeleton-card`／`.skeleton-line`，`:1964`–`:1975`）與「任務不存在」面板（`taskNotFound`，`:1979`）找得到，交付包沒有列成視圖 → [Skeleton](../components/skeleton.md)。操作結果的通知（`showToast`，`:11255`）也沒有對應視圖 → [Toast](../components/toast.md)。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.mini-btn` | #423 起用正典 `pages/shared/button.css` 的小尺寸 variant，本頁不再重新定義 → G-37 |
| `.panel`（`:91`） | 本頁的卡片，和 `dashboard` 的 `.panel` 同名不同一份 → [Card](../components/card.md)、G-41 |
| `.toggle-switch`（`:306`–`:332`） | 本頁**重新定義**：42×24、開啟色 `--color-cta`；同頁也載了 `task-config.css` 的正典版（40×22、`--color-primary`）→ G-42 |
| `.skeleton-*`（`:67`–`:83`） | [Skeleton](../components/skeleton.md)：與 showcase 的 pulse 變體逐字相同（`components-showcase.html:436` 起） |
| `.toast*`（`:844`–`:862`） | [Toast](../components/toast.md)：`showToast`（`:11255`）一律 2400 ms → G-39 |
| `.breadcrumb`（`:45`–`:47`） | 本頁一行式的版本 |

八個 modal 只有四個接了 `modal-focus.js`：`backToDraft`（`:6054`）、`settingsLeave`（`:7799`）、`arSeqExport`（`:10921`）、`risk`（`:11289`）→ G-43。

## 業務行為

連回規格 [`03-task-management/03-task-detail.mdx`](../../../docs/specs/03-task-management/03-task-detail.mdx)。
