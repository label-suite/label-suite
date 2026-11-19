# `admin/user-management`

> 批次 `b2-admin-dashboard-task` ｜規格 [`docs/specs/06-admin/01-user-management.mdx`](../../../docs/specs/06-admin/01-user-management.mdx) ｜檔案 `design/prototype/pages/admin/user-management.html`（1647 行）｜交付包 commit `eb9a884`

## 入口

側欄「使用者管理」。頁內分頁可切到 `admin/role-settings`。

載入：`assets/tokens.css`、`pages/shared/modal.css`、`pages/shared/sidebar.css`、`pages/shared/button.css`、`pages/shared/empty-state.css`、`pages/shared/content-tabs.css`、`pages/shared/sidebar.js`。**沒有載入 `pages/shared/modal-focus.js`**，而且本頁又在 `<style>` 補寫了 modal 的規則（`:141`–`:142`）。交付包 `#modal-invite` 的說明寫「`shared/modal.css` 不在本頁」，與 `<link>` 不符——以檔案為準。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/admin/user-management.html` | [App Shell](../components/app-shell.md)、[Content Tabs](../components/content-tabs.md)（`:285`–`:287`）、[List Toolbar](../components/list-toolbar.md)（本頁的搜尋與篩選，`:61`–`:81`、`:234`）、[Data Table](../components/data-table.md)（`:324`–`:326`）、[Badge](../components/badge.md)（本頁的 `.badge`，`:101`）、[Pagination](../components/pagination.md)（本頁的 `.page-btn`，`:115`–`:133`）、[Input](../components/input.md)（`.input`，`:1616`） |
| `#state-filtered-empty` | 加 `?q=`／`?status=`／`?role=` 篩到 0 列 | [Empty State](../components/empty-state.md)（`empty-state-page`，`:455`–`:467`，含「清除篩選」） |
| `#modal-invite` | 點「新增使用者」（交付包叫它 invite，畫面標題是「新增使用者」，`addModal`，`:477`） | [Modal](../components/modal.md)（本頁版，`role="dialog"`／`aria-modal`）、[Input](../components/input.md)、[Button](../components/button.md) |
| `#toast-action` | 停用或啟用一個帳號：停用要先確認（`disableModal`，`:581`） | [Toast](../components/toast.md)（本頁的 `.toast*`，`:185`–`:225`）、[Modal](../components/modal.md)、[Alert Banner](../components/alert-banner.md)（`.alert-banner.warning`，`:592`）、[Button](../components/button.md)（`.btn-danger`，`:604`） |

交付包沒有列、畫面上找得到的：編輯使用者 modal（`editModal`，`:530`）；稽核紀錄抽屜（`shared/audit-drawer.js:36`，與 `admin/role-settings` 同一份，空的時候用 `empty-state-compact`，`:51`）。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.btn-primary`／`.btn-ghost`（`:54`）、`.badge`（`:101`）、`.page-btn`（`:115`–`:133`）、modal（`:143`–`:144`）、`.toast*`（`:185`–`:225`） | 全部是共用元件在本頁的**重新定義** → G-03、G-10、G-37 |
| `.alert-banner`（`:175`）＋ `.warning`（`:180`） | 全 prototype 唯一一個 Alert Banner 修飾子 → G-07 |
| `.audit-drawer` | 見 [`admin-role-settings.md`](admin-role-settings.md)；已於 #422 抽成共用檔，→ G-38 |

## 業務行為

連回規格 [`06-admin/01-user-management.mdx`](../../../docs/specs/06-admin/01-user-management.mdx)。UXC 落點：UXC-07（`TOAST_DURATIONS`，`:1461`）、UXC-10（只有新增與編輯可點遮罩關閉，`:1247`；停用確認按 Enter 送出，`:1259`）、UXC-11（`:957`）。
