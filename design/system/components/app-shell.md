# App Shell（Sidebar）

> 正典章節：`MASTER.md` — Sidebar（`pages/task-management/task-new.html:19` 這樣引用它）｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`
>
> 這是交付包的 `shared/app-shell` 條目：**一個沒有自己 HTML 檔的畫面**。`pages/shared/` 一個 `.html` 都沒有，外殼整套由 `sidebar.js` 注入。

## 結構

`sidebar.js` 以字串模板注入整個外殼。桌機與行動版是**兩套不同的版面**（不是同一套的響應式調整）。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| 側欄本體（品牌、導覽項、收合鈕） | 必填 | `pages/shared/sidebar.css`、`sidebar.js` |
| 系統管理次選單（兩個連結） | 條件式 | `sidebar.js:539`–`:541`：**只有**系統管理員、桌機、且側欄未收合三者同時成立才展開 |
| 通知鈴 ＋ `#notificationDropdown`（含 `#notifMarkAllBtn`「全部標為已讀」） | 選用 | `sidebar.css:659`、`:684`；`sidebar.js:2259`、`:2274` |
| 語言切換 `#langToggle`／行動版 `#mobileLangToggle` | 必填 | `sidebar.js:2046`／`:2050` |
| 主題切換 `#sidebarThemeToggleBtn`／`#mobileThemeToggleBtn` | 必填 | `sidebar.js:2080`／`:2054` |
| 使用者區：`#userAvatar`、`#userName`、`#roleIndicator` | 必填 | `sidebar.js:2097`、`:2100` |
| 登出 `#logoutBtn`／`#mobileLogoutBtn` | 必填 | `sidebar.js:2103`／`:2064` |
| `#shortcutHelpModal` 快捷鍵說明 | 選用 | `sidebar.js:2108`（開關在 `:2208`） |
| `.workspace-tab-bar` 工作頁籤列 | 條件式，開過兩頁以上才出現 | `sidebar.css:959`、`sidebar.js:1524` |

`#userAvatar` 標了 `aria-hidden="true"`（`sidebar.js:2097`），所以頭像不朗讀，身分靠 `#userName` 與 `#roleIndicator` 的文字。

## 變體

| 變體 | 觸發 | 依據 |
| :--- | :--- | :--- |
| 桌機展開 | 預設 | — |
| 桌機收合 | 點收合鈕，`body` 加 `sidebar-collapsed` | `sidebar.js:513`（`matchMedia('(min-width: 769px)')`）、`:524` |
| 行動版 | 視窗 ≤ 768px：側欄變**固定底部列**、品牌區變**固定頂部列** | `sidebar.css:611` 起的 `@media (max-width: 768px)` |
| 深色 | 點主題切換 | `sidebar.css:646` 起的 dark overrides |

## 適用狀態

交付包記了 **13 個視圖**，是 b1 最多的一個條目。

| 視圖 | 怎麼叫出來 |
| :--- | :--- |
| `role-super-admin` | `localStorage` 的 `labelsuite.systemRole`（`sidebar.js:2`，讀在 `:175`）設成 `super_admin` |
| `state-admin-submenu-open` | 系統管理員 ＋ 桌機 ＋ 未收合，點「系統管理」 |
| `state-sidebar-collapsed` | 桌機點收合鈕 |
| `state-mobile` | 視窗縮到 768px 以下 |
| `state-theme-dark` | 點主題切換 |
| `state-lang-en` | 點語言切換，走 `applyGlobalLanguage()`（`sidebar.js:126`） |
| `state-user-chip` | 使用者區，隨 `labelsuite.systemRole` 變 |
| `state-active-task-type` | 改 `labelsuite.activeTaskType`（`sidebar.js:4`） |
| `state-workspace-tabs` | 開過兩個以上工作頁 |
| `state-logout` | 點登出，handler 一次清掉 7 個 storage 鍵 |
| `param-ap-stage` | 在任務詳情的網址加 `?ap_stage=r1`／`official`（`sidebar.js:762` 只在 `pageKind === 'task-detail'` 時生效） |
| `modal-notification` | 點通知鈴 |
| `modal-shortcut` | 開快捷鍵說明 |

hover／focus／disabled 等元件層狀態**未逐項盤點**——外殼不是單一控制項，它的狀態是上表這 13 種。

## token

`--nav-active-bg`、`--color-tab-active-bg`、`--color-tab-hover-bg`、`--workspace-tab-min-width`、`--workspace-tab-max-width`、`--z-sticky`、`--z-dropdown` 等；`tokens.css` 有一整組**只為側欄與頁籤存在**的 token。b2 已逐條核對：`sidebar.css` 用到 40 個 token，38 個在 `tokens.css`；`--navbar-mobile-height`、`--navbar-mobile-top-height` 兩個要宿主頁面自己定義（`sidebar.css:831`–`:837` 的窄視窗規則用它們）→ `../design-gaps.md` G-24。

## 鍵盤與焦點

`#shortcutHelpModal` 的存在表示有一套鍵盤快捷鍵，但**它不用 `modal-focus.js`**：整個 modal 由 `sidebar.js:2108` 自己注入與開關（`:2208`），`sidebar.js` 全檔沒有引用 `LabelSuiteModalFocus`。`#notificationDropdown` 同樣是 `sidebar.js:2259` 自建。

所以 prototype 有**兩套覆蓋層焦點處理**：[Modal](modal.md) 的共用模組，與 app-shell 自己的。→ `../design-gaps.md` G-23

## 樣式出處

`design/prototype/pages/shared/sidebar.css:1`–`:1233`、`design/prototype/pages/shared/sidebar.js:1`–`:2630`。

`sidebar.css:963` 與 `sidebar.js:682` 都引用「`MASTER.md` 的 terminology note」來解釋頁籤與 Content Tabs 的命名分工——**那一節在本 repo 還不存在**，見 [content-tabs](content-tabs.md) 與 `../design-gaps.md` G-25。

## 可重現樣本

`shared/app-shell` 的 13 個視圖（見上）。因為沒有自己的 HTML，要在**任何一個載入 `sidebar.js` 的頁面**上叫出來；最省事的是 `dashboard/dashboard.html`。

`sidebar.js` 被 18 個畫面裡的 **16 個**載入，只有 `index.html` 與 `components-showcase.html` 沒有。但其中**只有 11 個頁面連結 `sidebar.css`**（b1 裡只有 `account/profile`）——五個登出狀態的帳號頁載 `sidebar.js` 是為了 `redirectIfLoggedIn()`（`sidebar.js:95`）的導向判斷，不是為了外殼。

## shadcn 對照

候選原語 `Sidebar`（shadcn/ui 的 sidebar block）＋ `DropdownMenu` ＋ `Dialog` ＋ `Tabs`。

- **我們有而它沒有**：工作頁籤列（上限、重開堆疊、改鍵通知三種行為）、`ap_stage` 的網址驅動、桌機／行動兩套完全不同的版面。
- **它有而我們沒有**：收合狀態的 `SidebarProvider` 與 cookie 持久化（我們用 `localStorage`）、鍵盤快捷鍵的標準接法、焦點管理。
- **語意對不上**：shadcn 的 sidebar 是 React 元件樹；我們的是一支 2630 行的 IIFE，用字串模板注入並直接操作 `localStorage` 與 `document`，**沒有任何 props 介面**——重建時這是最大的一塊。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `account/profile` | 唯一連結 `sidebar.css` 的 b1 畫面 |
| `account/login`／`register`／`forgot-password`／`reset-password`／`verify-email` | **只載 `sidebar.js`**，用 `redirectIfLoggedIn()`；沒有外殼 |
| `admin/user-management`、`admin/role-settings`、`dashboard/dashboard`、`task-management/task-list`、`task-new`、`task-detail`（b2 全部視圖） | 連結 `sidebar.css` ＋ `sidebar.js`；除 `dashboard` 外各自在 `<style>` 定義 `--navbar-mobile-height`／`--navbar-mobile-top-height`，`dashboard` 定義在 `dashboard.layout.css:6` → `../design-gaps.md` G-24 |

b2 的六頁已補上（見上表）；b3、b4 的四頁待那兩批補。
