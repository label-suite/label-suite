# `task-management/task-list`

> 批次 `b2-admin-dashboard-task` ｜規格 [`docs/specs/03-task-management/01-task-list.mdx`](../../../docs/specs/03-task-management/01-task-list.mdx) ｜檔案 `design/prototype/pages/task-management/task-list.html`（1265 行）｜交付包 commit `eb9a884`

## 入口

側欄「任務管理」。

載入：`assets/tokens.css`、`pages/shared/sidebar.css`、`pages/shared/button.css`、`pages/shared/empty-state.css`、`pages/shared/list-page.css`、`pages/shared/modal.css`、`pages/shared/modal-focus.js`、`pages/shared/sidebar.js`、`pages/shared/task-type-badge.css`。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/task-management/task-list.html` | [App Shell](../components/app-shell.md)、[List Toolbar](../components/list-toolbar.md)（`:224`–`:256`）、[Data Table](../components/data-table.md)（`.task-table`，`:265`–`:267`）、[Badge](../components/badge.md)（`:117`–`:126`）、[Pagination](../components/pagination.md)（`:283`–`:296`）、[Button](../components/button.md) |
| `#state-filtered-empty` | `?keyword=`／`?status=`／`?output_type=`／`?run_stage=` 篩到 0 列 | [Empty State](../components/empty-state.md)（表格內一列，`createEmptyRow(true)`，`:846`–`:870`，含「清除所有篩選」） |
| `#param-view-empty` | `?view=empty`：不載種子資料 | [Empty State](../components/empty-state.md)（`createEmptyRow(false)`，**沒有**第二顆「新增任務」） |
| `#param-view-error` | `?view=error`（`:1225`） | 表格內的錯誤列（`:881`–`:913`），「重試」用 `.clear-btn` |
| `#param-unauthorized` | `?unauthorized=1`（`:1219`） | [Toast](../components/toast.md)（本頁版） |
| `#sim-delete-error` | `?sim_delete_error=1`（`:1220`）後刪除一個草稿任務 | [Modal](../components/modal.md)（`#deleteTaskModal`，`:307`–`:315`）、[Button](../components/button.md)（`.btn-secondary`＋`.btn-danger`）、[Toast](../components/toast.md) |
| `#role-task-role` | `?task_role=project_leader`／`reviewer`／`annotator` | 同 `#state-default`，操作欄依角色減少 |

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| 工具列（`:160`–`:166`）、`.task-table`（`:79`–`:81`）、badge（`:117`–`:126`）、`.page-btn`（`:138`）、`.btn-icon`（`:68`）、`.filter-select`（`:54`）、`.toast*`（`:142`–`:152`） | 全部在本頁 `<style>` 又定義一次，雖然已經載入 `list-page.css` → G-37 |
| `.task-table` | 名字與用途對不上 → G-26 |
| 錯誤列 | 和 [Empty State](../components/empty-state.md) 同一個位置、不同一份 markup；規格要求的三種情況（無任務／篩選無結果／載入失敗）都**保留表頭** |

本頁的 modal **有**接 `modal-focus.js`（`:711`、`:721`），是 b2 六頁裡唯一一頁所有 modal 都接的。Esc 交給它（`:1200` 的註解）；點遮罩關閉由本頁自己綁（`:1197`）。

## 業務行為

連回規格 [`03-task-management/01-task-list.mdx`](../../../docs/specs/03-task-management/01-task-list.mdx)，尤其 §刪除任務 與 §空狀態與載入失敗。
