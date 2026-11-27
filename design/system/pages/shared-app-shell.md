# `shared/app-shell`

> 批次 `b1-shared-account` ｜規格 [`docs/specs/07-shared/01-sidebar.mdx`](../../../docs/specs/07-shared/01-sidebar.mdx) ｜檔案 `design/prototype/pages/shared/sidebar.js`（2630 行）＋ `sidebar.css`（1233 行）｜交付包 commit `b1fd43c`

## 入口

**沒有自己的 HTML 檔。**`pages/shared/` 一個 `.html` 都沒有，外殼整套由 `sidebar.js` 以字串模板注入。

交付包把它列為第 19 個條目（而不是 18 個畫面之一），理由寫在 `../handoff/coverage.md` §八：它決定全站共用元件的樣子，沒有條目等於這 13 個狀態沒有歸屬。

要看到它，開**任何一個連結 `sidebar.css` 的頁面**；最省事的是 `pages/dashboard/dashboard.html`。

## 視圖與元件

13 個視圖全部屬於同一個元件 [App Shell](../components/app-shell.md)。外殼裡另外用到三個跨畫面的元件：品牌區的 [Brand Mark](../components/brand-mark.md) 與 [Language Toggle](../components/lang-toggle.md)（每個視圖都有；`#state-lang-en` 是點它的結果），底部工具列與手機品牌列的 [Theme Toggle](../components/theme-toggle.md)（每個視圖都有；`#state-theme-dark` 是點它的結果）。

| 視圖 | 怎麼走到 |
| :--- | :--- |
| `#role-super-admin` | `localStorage` 的 `labelsuite.systemRole`（`sidebar.js:2`）設成 `super_admin` |
| `#state-admin-submenu-open` | 系統管理員 ＋ 桌機 ＋ 側欄未收合，點「系統管理」（`System Administration` 子選單，`sidebar.js:539`–`:541`） |
| `#state-sidebar-collapsed` | 桌機（`shouldEnableDesktopSidebarCollapse`，`sidebar.js:511`–`:513`）點收合鈕（`sidebar-collapsed`，`:524`） |
| `#state-mobile` | 視窗 ≤ 767px（`max-width: 767px`，`sidebar.css:828`） |
| `#state-theme-dark` | 點 `#sidebarThemeToggleBtn`（`sidebar.js:2087`）或 `#mobileThemeToggleBtn`（`:2061`） |
| `#state-lang-en` | 點 `#langToggle`（`:2053`）或 `#mobileLangToggle`（`:2057`） |
| `#state-user-chip` | `#userAvatar`（`:2104`）、`#userName`、`#roleIndicator`（`:2107`） |
| `#state-active-task-type` | 改 `labelsuite.activeTaskType`（`:4`） |
| `#state-workspace-tabs` | 開過兩個以上工作頁（`workspaceTabBar`，`:1524`） |
| `#state-logout` | 點 `#logoutBtn`（`:2110`）或 `#mobileLogoutBtn`（`:2071`）：一次清掉 7 個 storage 鍵 |
| `#param-ap-stage` | 任務詳情的網址加 `?ap_stage=r1`／`official`（`:763`，只在 `pageKind === 'task-detail'` 生效） |
| `#modal-notification` | 點通知鈴 `notificationBellBtn` 開 `notificationDropdown`（`:2270`、`:2295`） |
| `#modal-shortcut` | 開快捷鍵說明 `shortcutHelpModal`（`:2115`、`:2215`） |

## 這一頁專屬的

整個外殼就是 [App Shell](../components/app-shell.md) 一個元件，但它內部有幾個**沒有走共用元件**的東西：

| 東西 | 說明 |
| :--- | :--- |
| `#shortcutHelpModal`、`#notificationDropdown` | 覆蓋層整套自建，**不用 `modal-focus.js`**（`sidebar.js` 全檔 `LabelSuiteModalFocus` 出現 0 次）→ `../design-gaps.md` G-23 |
| `#langToggle`、`#mobileLangToggle` | 登入後的語言切換；prototype 的 markup 和帳號頁的 [Language Toggle](../components/lang-toggle.md) 是兩套，但結構、文案與行為相同，實作是同一個元件的兩種尺寸（#720 clarification Q9） |
| `.workspace-tab-bar`（`sidebar.css:966`） | 工作頁籤列，有上限、重開堆疊、改鍵三種通知；`tokens.css` 為它留了 `--workspace-tab-min-width`／`-max-width` |

## 業務行為

連回規格 [`07-shared/01-sidebar.mdx`](../../../docs/specs/07-shared/01-sidebar.mdx)。

`sidebar.css:963` 與 `sidebar.js:683` 都引用「`MASTER.md` 的 terminology note」來區分「工作頁籤」與「Content Tabs」的命名——**本批次建立 `MASTER.md` 時要寫進那一節**，否則這兩處註解指向不存在的東西（G-25）。

## 散佈範圍

| 檔 | 被幾個畫面載入 |
| :--- | ---: |
| `sidebar.js` | **16**／18（`index.html` 與 `components-showcase.html` 沒有） |
| `sidebar.css` | **11**（b1 只有 `account/profile`；b2–b4 的 10 頁全部） |

差額的 5 個是登出狀態的帳號頁：它們載 `sidebar.js` 只為了 `redirectIfLoggedIn()`（`sidebar.js:95`），不要外殼。
