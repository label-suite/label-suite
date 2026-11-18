# `admin/role-settings`

> 批次 `b2-admin-dashboard-task` ｜規格 [`docs/specs/06-admin/02-role-settings.mdx`](../../../docs/specs/06-admin/02-role-settings.mdx) ｜檔案 `design/prototype/pages/admin/role-settings.html`（1657 行）｜交付包 commit `eb9a884`

## 入口

從 `admin/user-management` 的頁內分頁切過來，或直接開 `pages/admin/role-settings.html`。

載入：`assets/tokens.css`、`pages/shared/sidebar.css`、`pages/shared/button.css`、`pages/shared/content-tabs.css`、`pages/shared/empty-state.css`（`:12`）、`pages/shared/modal.css`、`pages/shared/sidebar.js`。**沒有載入 `pages/shared/modal-focus.js`**。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/admin/role-settings.html` | [App Shell](../components/app-shell.md)、[Content Tabs](../components/content-tabs.md)（`.admin-tabs`，`:412`–`:414`，帶 `role="tablist"`／`aria-selected`）、[Data Table](../components/data-table.md)（權限矩陣 `.matrix-table`，`:455`）、[Button](../components/button.md)（「編輯」`:425`）、[Badge](../components/badge.md)（本頁自己的 `.badge`，`:316`） |
| `#state-dirty` | 點「編輯」（`:425`）後改任一格、還沒儲存 | [Alert Banner](../components/alert-banner.md)（本頁的 `.dirty-banner`，`:353`）、[Button](../components/button.md)（「取消」`:440`、「儲存」`:443`） |
| `#state-conflict` | 開兩個分頁，兩邊都進編輯；先在一邊儲存，再到另一邊儲存（`saveMatrix`，`:1451`，比對 `localStorage` 版本） | [Alert Banner](../components/alert-banner.md)（`.conflict-banner`，`:365`，含「重新載入」）、[Toast](../components/toast.md)（error）。儲存鈕停用 |
| `#toast-saved` | 編輯後儲存成功 | [Toast](../components/toast.md)（本頁自己的 `.toast*`，`:213`；容器 `:979`） |

交付包沒有列、但畫面上找得到的狀態（都可重現，只登記）：

| 狀態 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| 稽核紀錄抽屜 | 點「稽核紀錄」 | `.audit-drawer`（`:270`–`:296`，見下）、[Modal](../components/modal.md) 的 `.modal-close`（`:942`）、[Empty State](../components/empty-state.md)（`empty-state-compact`，`:951`） |
| 離開確認 | 編輯中按「取消」或切走（`:1416`） | [Modal](../components/modal.md)（`#dirtyModal`，`:958`，`role="dialog"`／`aria-modal`）、[Button](../components/button.md)（`.btn-danger`，`:972`） |
| 已存資料無效 | 本機存的矩陣版本不合法時（`:383`） | [Alert Banner](../components/alert-banner.md) |

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.btn-ghost`／`.btn-cta`（`:93`–`:94`、`:257`–`:258`） | **本頁重新定義**，它已經載入 `button.css` → `../design-gaps.md` G-33（同型問題，b1 只登記了 `account/profile`）、G-37 |
| `.banner`／`.dirty-banner`／`.conflict-banner`（`:44`–`:60`） | Alert Banner 的又一份實作，用 `--color-warning-*`／`--color-error-soft-*` → G-07 |
| `.matrix-table`（`:104`），第一欄與表頭 sticky（`:127`、`:156`） | 包在 `role="region" tabindex="0"` 的容器裡，**鍵盤可以捲**——和 [Data Table](../components/data-table.md) 的 G-27 正好相反 |
| `.audit-drawer`／`.audit-drawer-overlay`（`:270`–`:296`；窄視窗改成由下往上，`:324`–`:330`） | 右側抽屜。**已於 #422 抽成共用檔** `pages/shared/audit-drawer.css`／`audit-drawer.js`，與 `admin/user-management` 共用，並接上焦點陷阱 → G-38（左欄的行號是抽出之前的） |
| `.toast*`（`:199` 起） | 右下角（#423 起，與規格一致）；`TOAST_DURATIONS`（`:1418`）與 UXC-07 一致 → G-39 |

## 業務行為

連回規格 [`06-admin/02-role-settings.mdx`](../../../docs/specs/06-admin/02-role-settings.mdx)。本頁的 UXC 落點：UXC-03（`beforeunload` `:1398`、取消守門 `:1416`）、UXC-07（`:1504`）、UXC-10（Esc／Enter，`:1405`）。
