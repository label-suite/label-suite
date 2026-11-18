# `dataset/dataset-analysis-list`

> 批次 `b4-dataset-sweep` ｜規格 [`docs/specs/05-dataset/01-analysis-list.mdx`](../../../docs/specs/05-dataset/01-analysis-list.mdx) ｜檔案 `design/prototype/pages/dataset/dataset-analysis-list.html`（324 行）＋ `.data.js`、`.i18n.js`、`.model.js`（263 行）、`.view.js`（322 行）、`.js`（335 行）｜交付包 commit `eb9a884`

## 入口

側欄「資料集分析」。`dataset/dataset-analysis-detail` 遇到不合法的任務時也會導回本頁並帶 `?invalid_task=1`（`dataset-analysis-detail.html:2468`）。

載入：`assets/tokens.css`、`assets/data-palette.css`（#420）、`pages/shared/sidebar.css`（`:9`）、`empty-state.css`（`:10`）、`list-page.css`（`:11`）、`task-type-badge.css`（`:214`）；腳本 `sidebar.js`（`:217`）、`theme.js`、`analytics.js` 與本頁五支腳本（`:318`–`:322`）。**沒有載入 `button.css`、`modal.css`、`modal-focus.js`**。本頁在 `<style>` 定義了 `--navbar-mobile-height`／`--navbar-mobile-top-height`（`:20`），G-24 在本頁不成立。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/dataset/dataset-analysis-list.html` | [App Shell](../components/app-shell.md)、[List Toolbar](../components/list-toolbar.md)（`.toolbar role="search"`，`:247`；兩個 `.filter-select`，`:249`、`:252`；`.clear-btn`，`:255`）、[Data Table](../components/data-table.md)（`.task-table`，`:272`）、[Badge](../components/badge.md)（輸出類型、IAA 狀態、角色，`dataset-analysis-list.view.js:46`、`:84`、`:98`）、[Progress Bar](../components/progress-bar.md)（本頁 `.progress-track`，`:97`–`:106`；`role="progressbar"`，`dataset-analysis-list.view.js:67`–`:79`）、[Pagination](../components/pagination.md)（`:284`–`:300`；`aria-current="page"`，`dataset-analysis-list.view.js:239`） |
| `#state-filtered-empty` | 用 `?keyword=`／`?iaa_status=`／`?output_type=` 篩到 0 列 | [Empty State](../components/empty-state.md)（表格內的 `empty-state empty-state-cell`，`createEmptyRow(true)`，`dataset-analysis-list.view.js:133`；文案 `dataset-analysis-list.i18n.js:40`–`:41`）、[List Toolbar](../components/list-toolbar.md)（清除篩選由工具列的 `.clear-btn` 負責，空狀態裡沒有按鈕） |
| `#param-view-empty` | `?view=empty`（`dataset-analysis-list.model.js:237` 清空任務） | [Empty State](../components/empty-state.md)（同一個 `createEmptyRow(false)`，文案「尚無可分析的任務」，`dataset-analysis-list.i18n.js:38`–`:39`） |
| `#param-invalid-task` | `?invalid_task=1`（`dataset-analysis-list.js:293`、`:314`–`:316`） | [Toast](../components/toast.md)（error：「找不到指定的任務，或您沒有該任務的存取權限。」） |

另外找得到但交付包沒有列的：載入失敗的錯誤列（`createErrorRow`，`dataset-analysis-list.view.js:159`，條件 `state.loadFailed`，`dataset-analysis-list.model.js:138`），用 `.error-title`（`:149`）與一顆 `.clear-btn` 重試；沒有網址參數能觸發 → `../design-gaps.md` G-54。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.task-row`（`dataset-analysis-list.view.js:18`–`:19`） | 一列是 `tr role="button" tabindex="0"`，Enter／Space 進詳情（`:124`）；點擊先出 info toast「前往分析詳情…」，220 ms 後導頁（`:115`–`:116`） |
| `.task-row:focus-visible`（`:74`–`:76`） | 焦點環是一個寫死的 rgba（原文見 G-02），沒有對應 token → G-02 |
| `.progress-track`／`.progress-fill`（`:97`–`:106`） | 與 Progress Bar 同結構，全用 token；本頁有 `role="progressbar"` 與 `aria-value*`，比 `annotation-list` 完整 |
| `.badge`（`:120`）與 `.badge-iaa-*`（`:139`–`:143`）、`.badge-role-pl`／`-rev`（`:145`–`:146`） | 本頁重寫的徽章，全用 token；輸出類型另由 `task-type-badge.css` 提供 → [Badge](../components/badge.md) |
| `.toast*`（`:154`–`:196`，markup `:309`–`:313`） | [Toast](../components/toast.md)：`TOAST_DURATIONS`（`dataset-analysis-list.js:25`）依類型 3000／5000／8000／不自動關，照 UXC-07 |

## 業務行為

連回規格 [`05-dataset/01-analysis-list.mdx`](../../../docs/specs/05-dataset/01-analysis-list.mdx)。UXC 落點：UXC-07（`dataset-analysis-list.js:25`）、UXC-09（空狀態分兩種文案，`dataset-analysis-list.i18n.js:38`–`:41`）、UXC-11（清單狀態放網址，`syncUrl`）。
