# `task-management/task-list`

> 批次 `b2-admin-dashboard-task` ｜規格 [`docs/specs/03-task-management/01-task-list.mdx`](../../../docs/specs/03-task-management/01-task-list.mdx) ｜檔案 `design/prototype/pages/task-management/task-list.html`（1265 行）｜交付包 commit `eb9a884`

## 入口

側欄「任務管理」。

載入：`assets/tokens.css`、`assets/data-palette.css`（#420）、`pages/shared/sidebar.css`、`pages/shared/button.css`、`pages/shared/empty-state.css`、`pages/shared/list-page.css`、`pages/shared/modal.css`、`pages/shared/modal-focus.js`、`pages/shared/sidebar.js`、`pages/shared/task-type-badge.css`。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/task-management/task-list.html` | [App Shell](../components/app-shell.md)、[List Toolbar](../components/list-toolbar.md)（`:197`–`:229`）、[Data Table](../components/data-table.md)（`.task-table`，`:238`–`:240`）、[Badge](../components/badge.md)（`:90`–`:99`）、[Pagination](../components/pagination.md)（`:256`–`:269`）、[Button](../components/button.md) |
| `#state-filtered-empty` | `?keyword=`／`?status=`／`?output_type=`／`?run_stage=` 篩到 0 列 | [Empty State](../components/empty-state.md)（表格內一列，`createEmptyRow(true)`，`:840`–`:864`，含「清除所有篩選」） |
| `#param-view-empty` | `?view=empty`：不載種子資料 | [Empty State](../components/empty-state.md)（`createEmptyRow(false)`，**沒有**第二顆「新增任務」） |
| `#param-view-error` | `?view=error`（`:1200`） | 表格內的錯誤列（`:868`–`:906`），「重試」用 `.clear-btn` |
| `#param-unauthorized` | `?unauthorized=1`（`:1213`） | [Toast](../components/toast.md)（本頁版） |
| `#sim-delete-error` | `?sim_delete_error=1`（`:1214`）後刪除一個草稿任務 | [Modal](../components/modal.md)（`#deleteTaskModal`，`:281`–`:290`）、[Button](../components/button.md)（`.btn-secondary`＋`.btn-danger`）、[Toast](../components/toast.md) |
| `#role-task-role` | `?task_role=project_leader`／`reviewer`／`annotator` | 同 `#state-default`，操作欄依角色減少 |

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| 工具列（`:139`–`:145`）、`.task-table`（`:79`–`:81`）、badge（`:89`–`:98`）、`.page-btn`（`:112`）、`.btn-icon`（`:70`）、`.filter-select`（`:56`）、`.toast*`（`:114`–`:124`） | 全部在本頁 `<style>` 又定義一次，雖然已經載入 `list-page.css` → G-37 |
| `.task-table` | 名字與用途對不上 → G-26 |
| 錯誤列 | 和 [Empty State](../components/empty-state.md) 同一個位置、不同一份 markup；規格要求的三種情況（無任務／篩選無結果／載入失敗）都**保留表頭** |

本頁的 modal **有**接 `modal-focus.js`（`:701`、`:710`），是 b2 六頁裡唯一一頁所有 modal 都接的。Esc 交給它（`:1194` 的註解）；點遮罩**不關**（UXC-10，#423 起），本頁只在遮罩的 `mousedown` 取消預設動作，讓焦點留在視窗裡、Esc 仍有效（`:1191`）→ `../design-gaps.md` G-45。

## 業務行為

連回規格 [`03-task-management/01-task-list.mdx`](../../../docs/specs/03-task-management/01-task-list.mdx)，尤其 §刪除任務 與 §空狀態與載入失敗。
