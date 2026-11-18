App Shell 是登入後每一頁共用的外殼：左側導覽列、全域工具與使用者區，加上掛在 `<main>` 頂端的工作頁籤列。

## 何時使用

- 所有登入後的頁面都用它，包括 `account/profile`。
- 登出狀態的帳號頁（登入、註冊、忘記密碼、重設密碼、驗證信箱）改用 Auth Navbar，兩者互斥。
- 外殼由 `sidebar.js` 注入，頁面只要連結 `sidebar.css` 與 `sidebar.js`，不要自己寫一份側欄 markup。

## 結構與使用方提供的內容

- `header.navbar[role=banner]`：桌機寬 240px、`height: 100vh`、`position: sticky`。
  - `.brand-section`：`.navbar-brand`（`.navbar-logo` ＋ `.navbar-wordmark`）與 `.lang-toggle`。
  - `nav.navbar-center`：一列 `a.nav-link`（`svg.nav-icon` ＋ 文字），目前頁加 `.active` 與 `aria-current="page"`。
  - 系統管理是 `.nav-link-group`：`button.nav-link[aria-haspopup]` ＋ `svg.nav-caret`，下面接 `.nav-submenu[role=menu]`，展開時加 `.open`；子項是 `a.nav-sublink`，目前子頁加 `.current`。
  - `.nav-actions`：`.sidebar-utility-row` 放快捷鍵、主題切換（`.sidebar-theme-toggle-btn`，深色時加 `.is-dark` 換圖示）、通知鈴（`.notif-bell-wrap` ＋ `.notif-badge`）；`.user-chip` 放頭像、姓名、角色與 `.logout-btn`。
- `.workspace-tab-bar[role=tablist]`：必須是 `<main>` 的第一個子元素。每個 `.workspace-tab[role=tab]` 有 `svg.workspace-tab-icon`、選用的 `.workspace-tab-kind--{neutral|review|primary|warning}`、`.workspace-tab-label` 與 `button.workspace-tab-close`。
- 頁面要提供的只有：目前導覽鍵、使用者姓名與角色、工作頁籤的狀態。姓名一律以 `textContent` 寫入，不拼進 markup。
- 用到一整組只為外殼存在的 token：`--nav-active-bg`、`--color-tab-active-bg`、`--color-tab-hover-bg`、`--workspace-tab-min-width`、`--workspace-tab-max-width`、`--z-sticky`、`--z-dropdown`。

## 變體

- 桌機展開：預設，就是 preview 這一種。
- 桌機收合：`body` 加 `sidebar-collapsed`，側欄縮成只剩圖示。因為要改 `body` 的 class，preview 無法靜態並列。
- 行動版（≤ 767px）：側欄變固定底部列，品牌區變固定頂部列，工作頁籤列隱藏。兩個高度變數 `--navbar-mobile-height`、`--navbar-mobile-top-height` 不在 `tokens.css`，要宿主頁面自己定義；`annotation-workspace` 沒定義，窄螢幕會拿到空值（G-24）。
- 深色：主題切換後走 `sidebar.css` 的深色覆寫。

## 狀態

交付包記了 13 個視圖，外殼的狀態就是這 13 種，不逐項列 hover／focus：

- 角色：超級管理員才看得到系統管理群組；子選單只在「超級管理員 ＋ 桌機 ＋ 未收合」時能展開。
- 收合、行動版、深色、英文介面。
- 使用者區隨系統角色顯示「一般使用者」「標記員」等。
- 工作頁籤：開過兩個以上工作頁時出現，任務詳情可帶 `?ap_stage=` 改頁籤標記。
- 登出：一次清掉 7 個 storage 鍵。
- 通知下拉與快捷鍵說明兩個覆蓋層。

## 該做／不該做

- 該做：頁面只呼叫 `sidebar.js` 掛載外殼，導覽與頁籤的樣式一律來自 `sidebar.css`。
- 該做：宿主頁面定義 `--navbar-mobile-height` 與 `--navbar-mobile-top-height`，直到 G-24 把它們收進 `tokens.css`。
- 不該做：把工作頁籤列和頁內的 Content Tabs 混為一談。前者是外殼層的工作頁，後者是頁面內的分頁；命名分工要寫在 `MASTER.md`，但那一節還不存在（G-25）。
- 不該做：再寫第三套覆蓋層焦點處理。外殼的通知下拉與快捷鍵說明目前自己管焦點，沒有用 Modal 的共用模組（G-23）。
- 注意：`sidebar.css` 的 `.avatar`（40px 圓、白底）是全域選擇器，在 bundle 中排在 Avatar 元件之後，會蓋掉 Avatar 的正典樣式。
