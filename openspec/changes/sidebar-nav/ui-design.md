# UI Design

本份是 change `sidebar-nav`（Issue #720）的前端設計：登入後外殼（側欄）的路由、元件樹、資料來源、畫面狀態與 design token。脈絡基準是同目錄的 `system-analysis.md`（以下稱 sa，待決題號寫成 sa-N）；後端側見 `system-design.md`（以下稱 sd，題號 SD-N）。

畫面長相以 prototype 為準，本份不重新設計；prototype 與規格不一致、或畫面根本沒有的東西，一律列在 [§待決問題](#待決問題)，不自己選邊。sa 的 15 題待決由 clarification 決定，本份只把畫面上會分岔的地方寫成分支。

## Prototype 對照

規格 07-01 依它自己的 Q5 不嵌 `PrototypeFrame`，畫面來源是 `design/prototype/pages/shared/sidebar.js` 與 `sidebar.css`（兩檔都已實際讀過）；要看畫面時開任何載入 `sidebar.css` 的頁面，最省事的是 `design/prototype/pages/dashboard/dashboard.html`（`design/system/pages/shared-app-shell.md` §入口）。維護者 2026-11-27 已核可本單的畫面（Issue #720 留言「Ready gate：畫面已核可」）。

| 側欄的部分                             | prototype 來源                                                                                                                                     | 設計系統                                                                                                                         | 規格 07-01                                                       |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| 品牌區（logo、wordmark、語言切換）     | `sidebar.js:2042`–`:2075`；`sidebar.css:37`–`:79`                                                                                                  | [App Shell](../../../design/system/components/app-shell.md)、[Language Toggle](../../../design/system/components/lang-toggle.md) | §語言切換、§不同螢幕寬度的呈現 第 1 條                           |
| 導覽項（五或六項）與「系統管理」次選單 | `sidebar.js:1988`–`:2037`（清單）、`:649`–`:677`（次選單）、`:564`–`:567`（`l0NavI18n`）、`:557`–`:560`（`taskRoleI18n`）；`sidebar.css:81`–`:183` | App Shell 結構表「側欄本體」「系統管理次選單」                                                                                   | §導覽項目與可見性、§目前位置、§進入模組的條件、§系統管理的次選單 |
| 底部工具列（快捷鍵、外觀、通知）       | `sidebar.js:2082`–`:2097`；`sidebar.css:192`–`:256`、`:660`–`:826`                                                                                 | App Shell 結構表「主題切換」「通知鈴」                                                                                           | §外觀切換、§通知、§快捷鍵總覽                                    |
| 使用者晶片與登出                       | `sidebar.js:2098`–`:2113`；`sidebar.css:278`–`:351`                                                                                                | App Shell 結構表「使用者區」「登出」                                                                                             | §導覽項目與可見性 的角色標示、§登出                              |
| 快捷鍵總覽對話框                       | `sidebar.js:2115`–`:2167`、`:2218`–`:2230`、`:2493`–`:2523`                                                                                        | App Shell「`#shortcutHelpModal`」；覆蓋層自建（`design-gaps.md` G-23）                                                           | §快捷鍵總覽                                                      |
| 收合                                   | `sidebar.js:2526`–`:2538`（點側欄空白處）；`sidebar.css:582`–`:645`                                                                                | App Shell 變體「桌機收合」                                                                                                       | §側欄收合                                                        |
| 手機版面                               | `sidebar.css:828`–`:950`                                                                                                                           | App Shell 變體「行動版」                                                                                                         | §不同螢幕寬度的呈現 第 2、3 條                                   |
| 暫時落點裡的卡片                       | 無：#719 的暫時落點不在 prototype，是維護者核可的 artifact                                                                                         | —                                                                                                                                | 02-01（之後取代）；見 [§待決問題](#待決問題) U1                  |

本次**不照 prototype** 的兩處，都已有維護者裁定，不是待決：

- prototype 點「標記作業」會從 `labelsuite.activeTaskType` 帶 `task_type`（`sidebar.js:1973`–`:1975`）；規格 07-01 Q6 裁定整條移除，所以連結只帶入口標記 `entry=nav`（Q17；參數名沿用 `sidebar.js:1971` 與 `docs/prototype/navigation.mdx` §Annotation 模組）
- prototype 的「跟隨系統」在 `sidebar.js` 的 `getStoredThemeChoice()` 退回淺色；規格 07-01 Q14 與 `design/prototype/assets/theme.js`、`theme-fouc.js` 都讀作業系統，以後者為準

## 頁面與路由

本次新增一個**登入後外殼**：它不是一頁，是包住所有登入後路由的 layout，側欄就畫在這一層。路徑沿用 prototype 的頁面識別（`docs/prototype/navigation.mdx` §Shared Sidebar 導覽），和 `frontend-routes.mdx` 的既有慣例一致。

| 路由                                                                          | 頁面                                                                 | 對應的規格                                    | 需要的角色                                                                          |
| :---------------------------------------------------------------------------- | :------------------------------------------------------------------- | :-------------------------------------------- | :---------------------------------------------------------------------------------- |
| （layout，沒有自己的 path）包在 `RequireAuthRoute` 底下、所有登入後路由的外層 | `AppShellLayout`（`src/app/`）＋ `AppShell`（`features/app-shell/`） | 規格 07-01 全頁；07-shared Logic Flow 節點 P1 | 已登入：平台成員、系統管理員、Seeder 管理員（同系統管理員）。不需要任何任務成員身分 |
| `/dashboard/dashboard`                                                        | `DashboardPlaceholderPage`；掛不掛進外殼見 **U1**                    | 規格 02-01（之後取代）；07-shared X1          | 已登入，同上                                                                        |

側欄的七個出口（07-shared Logic Flow 分段一、二）都指向**本次不存在**的頁，只有儀表板以暫時落點存在：

| 導覽項                                               | 目標路徑                                                                      | 07-shared 節點                    | 頁面由誰做             |
| :--------------------------------------------------- | :---------------------------------------------------------------------------- | :-------------------------------- | :--------------------- |
| 品牌連結、儀表板                                     | `/dashboard/dashboard`                                                        | X1                                | #722（目前是暫時落點） |
| 任務管理                                             | `/task-management/task-list`                                                  | X2                                | #730                   |
| 第三個導覽項（讀作「例外處置」時）                   | `/task-management/task-list`                                                  | D2 是 → X2                        | #730                   |
| 第三個導覽項（讀作「標記作業」「審核作業」且放行時） | `/annotation/annotation-list?entry=nav`                                       | D3 是 → X7                        | #773                   |
| 第三個導覽項（擋下時）                               | `/dashboard/dashboard`，帶「擋下說明」                                        | D3 否 → X1                        | 說明的呈現見 **U2**    |
| 資料集分析（放行／擋下）                             | `/dataset/dataset-analysis-list`／`/task-management/task-list` 帶「擋下說明」 | D4 是 → X8／D4 否 → X2            | #738／#730             |
| 系統管理（手機或已收合）、次選單「使用者管理」       | `/admin/user-management`                                                      | D1 否 → X4；次選單的去處見 **U9** | #728                   |
| 次選單「角色設定」                                   | `/admin/role-settings`                                                        | D1 是 → X5                        | #729                   |
| 個人設定、使用者晶片                                 | `/account/profile`                                                            | X3                                | #727                   |
| 登出                                                 | `/account/login`（經守門）                                                    | X6                                | 已有                   |

### 進入、離開與返回

- **進入**：外殼沒有自己的入口。任何登入後路由被畫出來時，外殼就在（07-shared S → P1）。守門還沒判定完成前只畫頁面底色，外殼與側欄都不畫（`openspec/specs/auth-guard` Requirement「畫面判定完成前不顯示任何頁面內容」），所以側欄不會在未登入時閃一下
- **離開**：只有上表的出口。導覽項一律是連結（`<a href>`），按住 Ctrl／⌘ 或中鍵點擊交給瀏覽器開新分頁，不經過側欄的擋下判斷（與規格 07-02 §開啟頁籤與去重 第 5 條一致）；被開到的那一頁自己的進入規則照常擋
- **擋下**：只攔一般點擊。第三個導覽項與「資料集分析」的連結 `href` 照樣指向真正的模組頁，點擊時若依 [§資料來源](#資料來源) 的任務角色判斷要擋，改為導向落點並帶一次性的「擋下說明」（router 的 navigation state，不進網址：重新整理不應再出現說明，也沒有分享的意義）
- **返回**：側欄不定任何返回。瀏覽器的上一頁回到前一個路由，外殼不動
- **目前位置**：由每條登入後路由在 route 的 `handle` 宣告自己屬於哪個導覽項（`navKey`），系統管理的兩頁另外宣告次選單項（`adminSubKey`）；外殼讀最深一層的宣告，全站同一時間只標一個（07-01 §目前位置 第 1–5 條、§卡控機制「只標一個」）。新增路由沒有宣告時，`planner` 要在 tasks 裡讓測試擋下，不靠預設值
- **角色標示的顯式覆寫**：系統管理的頁面以同一個 `handle` 宣告 `roleIndicator: "systemAdmin"`，外殼優先採用，不被任務角色蓋掉（07-01 §導覽項目與可見性 的註、Q2）。本次沒有系統管理頁，只建好這個入口

## 常駐文件異動

- 常駐文件：`docs/diagrams/architecture/frontend-routes.mdx`

| 節                      | 異動                     | 摘要                                                                                                                                                   |
| :---------------------- | :----------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| §頁面與功能元件         | 已改                     | `LoginPage` 那一列：品牌標誌與語言切換改寫成取自 `components/`                                                                                         |
| §前端骨架 › §目錄       | 已改                     | 目錄樹與分層表加上 `components/`（`ui/` 以外）這一層，放 F5 定義的共用元件                                                                             |
| §決策紀錄               | 已改                     | 加一列：兩個元件搬到 `components/`                                                                                                                     |
| §路由                   | **等 U1 裁定後回改**     | 要加登入後外殼這個 layout；暫時落點那一列的「沒有側欄」要不要改、要不要為不存在的落點註冊路由，取決於 U1。現在寫進去等於替維護者選邊，所以這一節先不動 |
| §頁面與功能元件         | **等 U1、U3 裁定後回改** | 外殼的 `AppShell`（`features/app-shell/`）、新 namespace `appShell`，以及 `ThemeToggle` 的歸屬                                                         |
| §前端骨架 › §元件展示頁 | **等 U3 裁定後回改**     | 展示頁的 `ThemeToggle` 那一列；新增的原語 `dialog` 要列進「目前的原語」                                                                                |

## 元件樹

依 F5（`docs/development/rules/frontend-agent-rules.mdx`）的判準：`shared/app-shell` 自成一個 feature（`scripts/check-component-reuse.mjs` 的 `SCREEN_FEATURE`），所以**只有側欄用的東西留在 `features/app-shell/`**；同時被帳號頁（`features/auth`）與外殼用到的品牌標誌、語言切換、外觀切換是共用元件，放 `frontend/src/components/`（`ui/` 以外，因為它們是組合好的元件、不是 shadcn 原語）。Issue #720 §驗收條件 第 2 項與維護者 2026-11-27 的裁定點名這三個要搬。

F1 不准 `features/` 互相 import，而外殼需要帳號 feature 的登入狀態與登出。所以**由 `src/app/` 組合**：`app/` 依 F1 可以 import 全部（「全站 layout」就在這一層），它向 `features/auth` 取登入者與登出，再以 props 交給 `features/app-shell`。`features/app-shell` 不 import `features/auth`。

### 登入後外殼

```text
RequireAuthRoute（沿用 frontend/src/features/auth/route-guards.tsx）
└─ AppShellLayout          新建，放 frontend/src/app/app-shell-layout.tsx（組合層，非設計系統元件）
   │  讀：useSessionState（features/auth 既有）、useSignOut（features/auth 新匯出，見下）、
   │      目前路由的 handle（navKey、adminSubKey、roleIndicator）、任務角色來源（見 §資料來源）
   └─ AppShell             app-shell.md：新建，放 frontend/src/features/app-shell/app-shell.tsx
      ├─ BrandBar          app-shell.md「側欄本體」的品牌區：新建，放 frontend/src/features/app-shell/brand-bar.tsx；
      │                    桌機在側欄最上，手機變固定的上方品牌列
      │  ├─ BrandLink      連到 /dashboard/dashboard，aria-label「Label Suite 首頁」
      │  │  └─ BrandMark   設計系統無（auth-navbar.md、auth-card.md 的插槽，app-shell.md 的品牌區）：
      │  │                 搬移，frontend/src/features/auth/brand-mark.tsx → frontend/src/components/brand-mark.tsx
      │  ├─ LanguageToggle lang-toggle.md：搬移，frontend/src/features/auth/language-toggle.tsx
      │  │                 → frontend/src/components/language-toggle.tsx；手機版用同一個元件的精簡尺寸，不另建第二個
      │  └─ 手機才有：ThemeToggle、通知入口（U8）、SignOutButton（見下）
      ├─ SidebarNav        app-shell.md「側欄本體」的導覽項：新建，放 frontend/src/features/app-shell/sidebar-nav.tsx
      │  ├─ NavLink ×5     同檔；儀表板、任務管理、第三個導覽項、資料集分析、個人設定；Lucide 圖示＋文字（React Router 的 NavLink 不用它的 active 判斷，目前位置以 handle 為準）
      │  └─ AdminNavGroup  app-shell.md「系統管理次選單」：新建，放 frontend/src/features/app-shell/admin-nav-group.tsx
      │     ├─ 觸發鈕       桌機未收合時展開／收起；手機或已收合時直接導向 /admin/user-management
      │     └─ 次選單       兩個連結：使用者管理、角色設定
      ├─ UtilityRow        app-shell.md 的底部工具列：新建，放 frontend/src/features/app-shell/utility-row.tsx（只在桌機）
      │  ├─ 快捷鍵入口      button.md：沿用 frontend/src/components/ui/button.tsx（outline、icon 尺寸）；已收合時隱藏
      │  ├─ ThemeToggle    設計系統無（app-shell.md 結構表「主題切換」）：
      │  │                 搬移，frontend/src/pages/dev-gallery/theme-toggle.tsx → frontend/src/components/theme-toggle.tsx；
      │  │                 單一圖示鈕、只顯示一個方向（07-01 §外觀切換 第 4 條）；展示頁是否共用同一個見 U3
      │  └─ 通知入口        app-shell.md「通知鈴」：是否在本次見 U8
      ├─ UserChip          app-shell.md「使用者區」：新建，放 frontend/src/features/app-shell/user-chip.tsx（只在桌機）
      │  ├─ 個人設定連結    縮寫頭像（aria-hidden）＋姓名＋角色標示；已收合時整塊隱藏
      │  │                 頭像是 App Shell 自己的 `#userAvatar`，不是 avatar.md 的 Avatar（screen-inventory 的
      │  │                 Avatar 使用畫面不含 shared/app-shell）
      │  └─ SignOutButton  button.md：沿用 frontend/src/components/ui/button.tsx（icon 尺寸、loading）；
      │                    外殼自己的圖示鈕，新建，放 frontend/src/features/app-shell/sign-out-button.tsx
      ├─ ShortcutOverview  app-shell.md「#shortcutHelpModal」：新建，放 frontend/src/features/app-shell/shortcut-overview.tsx
      │  └─ Dialog         modal.md 的 Modal 尚未實作，且 App Shell 的這個覆蓋層本來就不走 Modal（G-23）：
      │                    新增 shadcn/ui 原語，放 frontend/src/components/ui/dialog.tsx；元件展示頁要有它的一節
      │                    （completeness 測試）。modal.md 的「程式實作」本次不改，因為 Modal 的尺寸變體沒有做
      └─ <main>（Outlet）  頁面內容；手機時上下留出品牌列與主導覽的高度，不被遮擋
```

### 非畫面的模組（同一個 feature 或共用層）

| 模組              | 放哪                                                                                               | 做什麼                                                                                                                                                                                                                                                |
| :---------------- | :------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildSidebarNav` | `frontend/src/features/app-shell/sidebar-nav-model.ts`（新建）                                     | 純函式：輸入系統角色、任務角色來源的回答、目前路由的 `navKey`／`adminSubKey`／覆寫、介面語言無關，輸出導覽項清單（含第三項的文案鍵、每項的目標與是否擋下、目前位置、角色標示鍵）。所有依角色的判斷只在這裡，元件不各自判斷（sd §設計結論 的「接縫」） |
| 收合狀態          | `frontend/src/features/app-shell/use-sidebar-collapsed.ts`（新建）                                 | 讀寫本機偏好 `labelsuite.sidebarCollapsed`（沿用 prototype 的鍵，`sidebar.js:5`）；手機一律不收合；讀不到或值無效當成展開                                                                                                                             |
| 外觀偏好          | `frontend/src/lib/theme.ts`（新建，`lib/` 因為不含業務）                                           | 三種值（淺色、深色、跟隨系統）的讀寫、解析成實際外觀、訂閱作業系統變化；`ThemeToggle` 與日後 01-04 的三選一讀同一份。鍵沿用 prototype 的 `label-suite-theme`（`assets/theme.js:3`）                                                                   |
| 登出              | `features/auth` 新匯出 `useSignOut()`（從 `logout-button.tsx` 抽出送出一次、`markSignedOut` 那段） | `LogoutButton` 與外殼的 `SignOutButton` 共用同一段，不寫第二份（F5）                                                                                                                                                                                  |

檔名注意：`check-component-reuse.mjs` 用「最後一個字」比對共用元件。語言切換搬到 `components/` 之後就是共用元件，`features/app-shell/` 底下檔名以 `-toggle` 結尾的檔案都會被要求 import 它。收合不要命名成 `*-toggle.tsx`（上表用 `use-sidebar-collapsed.ts`）。

### 暫時落點（只在 U1 選「掛進外殼」時）

prototype 沒有這個畫面，所以畫低保真結構：

```text
┌───────────────┬────────────────────────────────────────────┐
│ 側欄（外殼）   │                                            │
│ Label Suite ZH│        ┌──────────────────────────┐        │
│ ───────────── │        │ 你已登入                  │        │
│ 儀表板（目前） │        │ 王小明（user@example.com）│        │
│   任務管理     │        │ [平台成員]                │        │
│   標記作業     │        │ 儀表板還在建置中，……      │        │
│   資料集分析   │        │ [登出]  ← 是否保留見 U1   │        │
│   個人設定     │        └──────────────────────────┘        │
│ ───────────── │                                            │
│ [快捷][外觀][通知?] │  （通知入口是否畫出見 U8）        │
│ (縮寫) 姓名 一般使用者 [登出] │                             │
└───────────────┴────────────────────────────────────────────┘
```

- 卡片沿用 `SignedInCard`（`frontend/src/features/auth/signed-in-card.tsx`），**不再包 `AuthLayout`**：品牌與語言切換由側欄提供，兩份頁首會重複
- 卡片裡的「登出」鈕與側欄的登出重複；留或拿掉是 `auth-guard` 那條 Requirement 的內容，列在 U1

## 資料來源

`api-contract.md` 還不存在；sd 已寫明本次後端零異動，側欄只用兩個既有端點。下表的 operationId 以 `backend/openapi.json` 與 `frontend/src/api/generated/label-suite.ts` 現有的為準，待 `api-contract.md` 對齊。

| 區塊                                                     | operationId                                                                                                                                                      | 快取鍵／失效時機                                                                                                                                                                     |
| :------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 使用者晶片的姓名與縮寫、「系統管理」顯示與否             | `getCurrentSession`（沿用 `features/auth/session-query.ts` 的同一份快取，不另發請求）                                                                            | `getGetCurrentSessionQueryKey()`；`staleTime` 維持無限。**每次換頁（路由的 pathname 改變）在背景重查一次**，回來之前側欄維持原樣、不顯示載入中；視窗重新取得焦點**不**重查。理由見下 |
| 登出                                                     | `deleteCurrentSession`（經 `useSignOut`）                                                                                                                        | 不論成功或失敗都 `markSignedOut`：移除其他查詢、把登入狀態記成未登入，守門以取代歷史紀錄的方式帶回登入頁（沿用 #719 的行為，規格 01-05 §從這一台登出 第 4 條）                       |
| 第三個導覽項的名稱、角色標示、標記作業與資料集分析的擋下 | **無**：本次是固定回答「任何任務都沒有任務角色、沒有目前任務」的任務角色來源（sd §設計結論、SD-1）；由 `AppShellLayout` 以 prop 傳入，日後換成真的讀取時只換來源 | 無快取；日後的讀取形狀見 sd §任務角色讀取的提案形狀。12 條 Scenario 能不能驗收是 sa-1、sa-2                                                                                          |
| 通知的未讀數與清單                                       | **無對應端點**（07-04 的資料不存在）                                                                                                                             | 見 U8；若留在本次，要先有 operationId                                                                                                                                                |
| 快捷鍵總覽                                               | 無：靜態清單                                                                                                                                                     | —                                                                                                                                                                                    |
| 語言、外觀、收合                                         | 無：本機偏好（07-01 §資料欄位；`data-field-inventory.mdx` §07-01）                                                                                               | 語言沿用 `lib/i18n` 的 `labelsuite.lang`；外觀 `label-suite-theme`；收合 `labelsuite.sidebarCollapsed`                                                                               |

**為什麼換頁就重查、焦點不重查**（sd SD-4 交給前端定）：規格 07-01 §邊界情況「系統角色在側欄開著的時候被改掉 → 側欄維持原本的導覽項，從使用者下一次操作起才依新角色顯示」。「繼續停在目前頁面」時不能變，所以焦點重查會違反它；換頁是使用者明確的下一次操作，背景重查後側欄才更新。重查若得到未登入，守門照既有規則帶回登入頁。`planner` 要把「下一次操作 ＝ 換頁」寫進 Scenario 的測法。

### 狀態放哪裡

| 狀態                                     | 去處                                          | 說明                                                     |
| :--------------------------------------- | :-------------------------------------------- | :------------------------------------------------------- |
| 登入者、系統角色                         | TanStack Query（既有快取）                    | 不複製進任何 store（F4、api-agent-rules A9）             |
| 標記作業的入口標記                       | 網址 `entry=nav`                              | 規格 07-01 Q17；標記清單只從網址讀上下文                 |
| 擋下說明                                 | router 的 navigation state                    | 一次性；重新整理不重現、不可分享，所以不進網址           |
| 目前位置、角色標示覆寫                   | 路由的 `handle`                               | 由路由宣告，不由元件猜                                   |
| 語言                                     | i18next 實例＋本機偏好                        | 沿用                                                     |
| 外觀                                     | `lib/theme.ts`＋本機偏好＋`<html data-theme>` | F4 明列的「第四個去處」；以訂閱同步，不是全域 store 套件 |
| 收合                                     | 本機偏好＋外殼的元件狀態                      | 只有外殼讀它                                             |
| 次選單開合、快捷鍵總覽開合、通知清單開合 | 元件 `useState`                               | 純 UI                                                    |

**不需要全域 store**：上表每一格都已有去處，沒有「跨路由共用、又不是伺服器狀態、又不適合放網址」的東西（F4 例外的條件不成立）。

## 畫面狀態

每個資料區塊的四種狀態；側欄沒有被後端遮蔽的欄位，所以「欄位被遮蔽」寫成「刻意不顯示」。

| 狀態          | 呈現                                                                                                                                                                                                                                                                                                                                        |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| loading       | 第一次進入：守門判定完成前只畫頁面底色，**外殼與側欄都不畫**，所以沒有側欄的骨架（auth-guard「畫面判定完成前不顯示任何頁面內容」）。之後換頁的背景重查：側欄維持上一份資料，不閃、不顯示載入中。登出送出中見下                                                                                                                              |
| error         | 登入狀態查詢**不會失敗**：任何拒絕或沒有回應都轉成「未登入」並由守門帶回登入頁、帶既有的那一句（`session-query.ts`）。側欄自己不顯示任何錯誤訊息，也不顯示後端的 `message`、`code`、`traceId`（07-01 §卡控機制 最後一列、Scenario「錯誤訊息不出現系統內部資訊」）。偏好讀不到（瀏覽器儲存停用）時用預設值：繁中、跟隨系統、展開，不顯示錯誤 |
| empty         | 姓名是空字串時：晶片的姓名改顯示 Email，縮寫取 Email 的第一個字（沿用 `SignedInCard` 的做法）；姓名與 Email 都只剩零寬字元時縮寫為「U」（照 prototype `computeAvatarInitials`，`sidebar.js:156`–`:165`）。沒有任何任務角色時角色標示讀作「一般使用者」、第三項讀作「標記作業」——這是本次每一位使用者的實際狀態，不是空狀態                  |
| 無權限（403） | 側欄的兩個端點只讀自己的登入狀態，不會回 `403`；`401` 由 `apiFetch` 延續、延續失敗則回到未登入。**「看不到」不是無權限畫面**：平台成員的側欄根本不畫「系統管理」（07-01 Q&A「為什麼完全看不到」），不是畫成停用。**「進不去」**（任務角色不足）也不是 `403`：一般點擊導向落點並帶擋下說明，呈現見 U2                                        |
| 欄位被遮蔽    | 無遮蔽欄位。**刻意不顯示**：側欄只顯示本人的姓名、縮寫與角色標示，不顯示 Email、系統角色的原始值或任何他人資料；角色標示依任務角色解析，**不**顯示「平台成員」這個系統角色名（07-01 §導覽項目與可見性 的註，與暫時落點卡片顯示系統角色是兩件事）                                                                                            |

### 登出（寫入）

| 狀態       | 呈現                                                                                                                                                                                                        |
| :--------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 送出中     | 按下後圖示鈕立刻進入 `loading`（Button 既有的 spinner），`aria-busy`，滑鼠與鍵盤都按不動；同一個 tick 的第二下也擋（沿用 `LogoutButton` 的 ref 做法）。桌機、已收合、手機三個位置的登出鈕共用同一個送出狀態 |
| 完成或失敗 | 一律回登入頁，畫面不分辨伺服器端是否真的結束（規格 01-05 第 4 條）                                                                                                                                          |
| 不會收合   | 點登出不觸發收合（07-01 §側欄收合 第 2 條）                                                                                                                                                                 |

### 擋下說明（第三個導覽項、資料集分析）

| 狀態       | 呈現                                                                                            |
| :--------- | :---------------------------------------------------------------------------------------------- |
| 擋下       | 不進目標頁，導向落點並帶一次性的說明；說明的位置、元件與文案都不在 prototype，也不在規格，見 U2 |
| 落點不存在 | 「資料集分析」被擋時的落點任務列表本次不存在，見 U1                                             |

### 測試集答案不外露（Hard Rule 6）

側欄沒有任何任務、資料集、樣本或標準答案的資料；快捷鍵總覽只列按鍵與動作名稱；擋下說明是固定文案，不帶任務名或任務 ID。日後任務角色來源也只回角色名稱的集合（sd §任務角色讀取的提案形狀），標記員從側欄推不出任何測試集資訊。若 U8 把通知留在本次，通知的「相關的任務」只能是任務名稱，不得帶樣本或答案。

## 元件與 design token

元件只用 `frontend/src/styles/theme.css` 對照層的語意 class；色值只在 `design/prototype/assets/tokens.css`。圖示統一 Lucide（`lucide-react`），品牌標誌沿用 `BrandMark`（Lucide `tag`），不畫 SVG、不用 emoji。

| 用途                               | 語意 class（對照層變數）                                                                                         | `tokens.css` 來源                                                                                            |
| :--------------------------------- | :--------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| 側欄、手機品牌列與主導覽的底       | `bg-card`                                                                                                        | `--color-white`                                                                                              |
| 側欄外框與區塊分隔線               | `border-border`                                                                                                  | `--color-border`                                                                                             |
| 導覽項文字、圖示（預設）           | `text-muted-foreground`                                                                                          | `--color-ink-muted`                                                                                          |
| 導覽項 hover 的文字與底            | `text-foreground`、`bg-surface-subtle`                                                                           | `--color-ink`、`--color-slate-50`                                                                            |
| 目前位置的文字                     | `text-primary`（主色當文字一律用 strong，brand.md 鐵律 2）                                                       | `--color-primary-strong`                                                                                     |
| 目前位置的圖示、次選單展開時的箭頭 | `text-icon-accent`                                                                                               | `--color-primary`                                                                                            |
| 目前位置的底                       | **對照層新增** `--nav-active`（Tailwind `bg-nav-active`），指向既有的 `--nav-active-bg`                          | `--nav-active-bg`（深色另有值，`tokens.css:275`）                                                            |
| 次選單目前項                       | `text-primary`，字重加粗                                                                                         | `--color-primary-strong`                                                                                     |
| 工具鈕、語言切換（預設）           | `border-border`、`bg-card`、`text-muted-foreground`（語言切換文字 `text-foreground`）                            | `--color-border`、`--color-white`、`--color-ink-muted`                                                       |
| 工具鈕、語言切換（hover）          | `border-ring`、`bg-accent`、`text-icon-accent`（沿用 `LanguageToggle` 既有寫法）                                 | `--color-primary`、`--color-primary-soft-bg`                                                                 |
| 焦點環                             | `focus-visible:ring-ring/50`（沿用 `AuthLayout` 品牌連結的寫法）                                                 | `--color-primary`                                                                                            |
| 登出鈕 hover                       | `text-error`、`bg-error-bg`；手機另加 `border-error-border`                                                      | `--color-error`、`--color-error-soft-bg`（與 `--color-error-bg` 同值的別名）                                 |
| logo 方塊                          | `bg-icon-accent`、`text-primary-foreground`（`BrandMark` 既有）                                                  | `--color-primary`、`--color-on-cta`                                                                          |
| wordmark                           | `font-(family-name:--font-serif-display)`、`text-foreground`                                                     | `--font-serif-display`、`--color-ink`                                                                        |
| 使用者姓名／角色標示               | `text-foreground`／`text-muted-foreground`                                                                       | `--color-ink`／`--color-ink-muted`                                                                           |
| 縮寫頭像                           | `bg-card`、`text-primary`，框線取主色的淡化                                                                      | `--color-white`、`--color-primary-strong`、`--color-primary`                                                 |
| 快捷鍵總覽對話框                   | `bg-card`、`border-border`；鍵帽 `bg-surface-subtle`                                                             | 遮罩與陰影 prototype 寫死墨色（G-02 #458 段），實作照 shadcn Dialog 的遮罩、深色由 tokens 隨主題換，不寫色碼 |
| 通知數字徽章（只在 U8 留在本次時） | **對照層新增** `--notify-badge`／`--notify-badge-foreground`                                                     | `--color-badge-notify`、`--color-on-badge-notify`（兩種主題同值）                                            |
| 間距                               | `p-(--space-*)`、`gap-(--space-*)`                                                                               | `--space-xs`～`--space-xl`                                                                                   |
| 圓角                               | `rounded-(--radius-md)`、`rounded-(--radius-sm)`                                                                 | `--radius-sm`、`--radius-md`                                                                                 |
| 層級                               | 側欄 `z-(--z-sticky)`；手機兩條固定列與浮層照 prototype 的相對順序，用 `--z-sticky`、`--z-dropdown`、`--z-modal` | prototype 寫死 300／320／600／700（`sidebar.css`），`tokens.css` 有 `--z-*` 卻沒用，同 G-02 的類型           |
| 動態                               | `duration-(--dur-fast)`、`duration-(--dur-normal)`、`ease-(--ease-standard)`；`motion-reduce:transition-none`    | `--dur-fast`、`--dur-normal`、`--ease-standard`                                                              |

- 對照層新增的兩個變數都只是把**已存在**的 token 接進 shadcn 風格的語意名（F6 映射前的第 1 點），不新增 token、不寫色值；深色由 `tokens.css` 的 `html[data-theme="dark"]` 跟著換，`theme.css` 的深色區塊仍不需要內容
- **字級**：prototype 的側欄用 13／12／11／10px（`sidebar.css` 的 `.nav-link`、`.nav-sublink`、`.user-role`、`.notif-badge`），`tokens.css` 的字級只有 48／36／24／18／16／14／12。照 G-64 的「就近套用既有 token」：11px、10px 取 `--text-label`，12px 取 `--text-label`；**13px 與 12、14 等距**，見 U7
- **尺寸**：側欄寬度（展開 240px、收合 88px）、手機兩條列的高度（`--navbar-mobile-height`、`--navbar-mobile-top-height`，由宿主頁面定義，G-24）不是間距刻度，`tokens.css` 沒有對應 token。規格 07-01 §不同螢幕寬度的呈現 的註寫「尺寸以 prototype 為準」，實作照 prototype 的數值寫在外殼一處，不散在各元件；這是 G-24 已登記的狀況，不是新發現

### 文案（取自 prototype；中英兩種都要，aria-label 也一樣）

| 位置                            | 繁中                                                                                                                           | 英文                                                                            | 來源                                                                                                                            |
| :------------------------------ | :----------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------ |
| 導覽項                          | 儀表板、任務管理、資料集分析、系統管理、個人設定                                                                               | Dashboard、Task Management、Dataset Analytics、System Administration、Profile   | `sidebar.js:565`–`:566`                                                                                                         |
| 第三個導覽項                    | 標記作業／審核作業／例外處置                                                                                                   | Annotation／Review／Exception Disposition                                       | `sidebar.js:558`–`:559`                                                                                                         |
| 次選單                          | 使用者管理、角色設定                                                                                                           | User Management、Role Settings                                                  | `sidebar.js:549`–`:550`                                                                                                         |
| 角色標示                        | 標記員、審核員、專案負責人、一般使用者                                                                                         | Annotator、Reviewer、Project leader、General user                               | `sidebar.js:558`–`:559`；07-01 Q2                                                                                               |
| 外觀切換（aria-label 與 title） | 切換為深色模式／切換為淺色模式                                                                                                 | Switch to dark mode／Switch to light mode                                       | `sidebar.js:255`–`:256`、`:277`–`:278`                                                                                          |
| 快捷鍵入口與對話框              | 快捷鍵、目前頁面可用快捷鍵、關閉快捷鍵                                                                                         | Keyboard shortcuts、Available shortcuts for this page、Close keyboard shortcuts | `sidebar.js:234`–`:236`、`:259`–`:261`                                                                                          |
| 通知（U8）                      | 通知、全部標為已讀、目前沒有通知                                                                                               | Notifications、Mark all as read、No notifications                               | `sidebar.js:283`–`:301`                                                                                                         |
| 品牌連結                        | Label Suite 首頁                                                                                                               | Label Suite home                                                                | 既有 `auth.nav.brandHome`（搬到 `common`）                                                                                      |
| 語言切換                        | {{code}}，切換語言                                                                                                             | {{code}}, Switch language                                                       | 既有 `auth.nav.languageToggle`（搬到 `common`；G-65 的修正）                                                                    |
| 登出                            | 登出                                                                                                                           | Sign out                                                                        | 既有 `auth.dashboard.signOut`                                                                                                   |
| 主導覽區、工具列、晶片連結      | prototype 只有寫死的「Main navigation」「全域工具」「前往個人設定」，**沒有另一種語言**（`sidebar.js:2076`、`:2083`、`:2099`） | 同左                                                                            | 07-01 §語言切換 第 4 條要求隨語言切換；缺的那一半語言由 `planner` 補文案時對照 brand.md §內容與語氣，列為明確事項，不是新控制項 |

- namespace：側欄自己的文字放新的 `appShell`（每個登入後頁面都用，和 `common`、`auth` 一樣啟動時載入，進正式 bundle）；搬到 `components/` 的三個共用元件的文字從 `auth` 移到 `common`，因為共用元件不該依賴某一個 feature 的 namespace
- 缺翻譯時顯示**繁體中文原文**當備用文字（07-01 §邊界情況「某個名詞缺少目前語言的文字」、Scenario「術語缺少翻譯時顯示備用文字」）。現在 `lib/i18n` 是 `fallbackLng: false`，缺鍵會顯示鍵名；改設定屬 sd／`planner`，列為明確事項

## 互動與鍵盤

| 控制項                           | 滑鼠／觸控                                                                   | 鍵盤                                                                                                                    | 依據                                         |
| :------------------------------- | :--------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :------------------------------------------- |
| 導覽項                           | 點擊進入；擋下時導向落點                                                     | Tab 走到、Enter 進入；目前位置帶 `aria-current="page"`                                                                  | 07-01 §目前位置、§不同螢幕寬度的呈現 第 4 條 |
| 「系統管理」觸發鈕（桌機未收合） | 點擊展開／收起；點次選單以外的地方收起                                       | Enter／Space 展開／收起；`aria-expanded`、`aria-controls`；展開後 Tab 依序走到兩個連結；Esc 收起並把焦點還給觸發鈕      | 07-01 §系統管理的次選單 第 1–4 條            |
| 「系統管理」（手機或已收合）     | 直接導向使用者管理，不展開                                                   | 同左                                                                                                                    | 第 5 條                                      |
| 語言切換                         | 點擊立即切換，側欄與頁面內容一起換、記住                                     | 原生按鈕                                                                                                                | 07-01 §語言切換                              |
| 外觀切換                         | 點擊立即切換淺色↔深色、記住；只顯示一個方向的圖示                            | 原生按鈕；aria-label 說出切過去的方向                                                                                   | 07-01 §外觀切換                              |
| 快捷鍵總覽                       | 點入口開啟；點對話框外或關閉鈕關閉                                           | 按 `?` 開啟（只在桌機、焦點不在可輸入的元素時）；Esc 關閉；開啟時焦點到關閉鈕、焦點鎖在對話框內，關閉後還給開啟它的元素 | 07-01 §快捷鍵總覽；`sidebar.js:2493`–`:2523` |
| 收合                             | 桌機點側欄空白處切換；點導覽項、語言切換、登出不會收合；收合時同時收起次選單 | **prototype 沒有鍵盤路徑**，見 U6                                                                                       | 07-01 §側欄收合；`sidebar.js:2526`–`:2538`   |
| 登出                             | 點擊登出                                                                     | 原生按鈕                                                                                                                | 07-01 §登出                                  |

- **次選單用揭露式（disclosure），不照 prototype 的 `role="menu"`**：prototype 標了 `role="menu"`／`menuitem`（`sidebar.js:669`–`:674`），那個角色要求完整的方向鍵選單行為，而它實際只靠 Tab；導覽區裡的一組連結用「按鈕 `aria-expanded` ＋ 連結清單」才名實相符，而且滿足 07-01 第 4 條的「用鍵盤打開、移動與關閉，看得出焦點」。畫面長相不變
- **`?` 在已收合時仍可開啟**：規格只說收合後入口隱藏（§快捷鍵總覽 第 4 條），沒說按鍵失效；prototype 的判斷只看是否桌機（`sidebar.js:2514`），照 prototype
- **已收合時語言切換也隱藏**：prototype `sidebar.css:597`–`:603` 收合時隱藏語言切換與晶片的姓名區，只留圖示、外觀、通知與登出；規格 §卡控機制 只點名保留外觀、通知、登出，照 prototype
- **收合時導覽項的文字**用視覺隱藏（仍在無障礙樹裡），可存取名稱不變；hover 提示沿用 prototype 的原生 `title`，隨語言切換

## 響應式

斷點依 brand.md §設計決策：手機 `max-width: 767px`、桌機 `min-width: 768px`；判斷收合與 `?` 的 JS 也用同一個分界（brand.md §版面）。平板寬度落在桌機那一側。

| 寬度          | 版面                                                                                                                                                                                                                                           | 依據                                                                              |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| ≥ 768px，展開 | 左側固定側欄：品牌區（logo、wordmark、語言切換）→ 導覽項 → 底部工具列（快捷鍵、外觀、通知）→ 使用者晶片（頭像、姓名、角色標示、登出）；內容區在右，主要內容不被遮擋                                                                            | 07-01 §不同螢幕寬度的呈現 第 1 條；`sidebar.css:3`–`:351`                         |
| ≥ 768px，收合 | 只剩圖示：品牌區只留 logo，導覽項只留圖示（目前位置仍看得見），工具列隱藏快捷鍵入口、保留外觀與通知，晶片只留登出                                                                                                                              | 07-01 §側欄收合、§卡控機制；`sidebar.css:582`–`:645`、`:825`                      |
| ≤ 767px       | 上方固定品牌列：logo、wordmark、語言切換（精簡）、外觀、通知、登出；不顯示姓名、沒有快捷鍵入口。下方固定主導覽：導覽項圖示在上、文字在下，平均分配寬度。不提供收合，次選單不展開。內容區上下留出兩條列的高度，主要操作不被遮擋、不需要左右捲動 | 07-01 §不同螢幕寬度的呈現 第 2、3 條、§側欄收合 第 4 條；`sidebar.css:828`–`:950` |

- 英文的長標籤（「System Administration」「Exception Disposition」「Dataset Analytics」）在桌機展開時允許換行、不截斷；手機下方主導覽 prototype 是 `white-space: nowrap`（`sidebar.css:931`），見 U7
- 從桌機縮到手機時收合狀態不生效但仍記住，放大回桌機時恢復（prototype `resize` 的處理，`sidebar.js:2541`–`:2548`）；次選單在變成不可用時收起

## 無障礙

- 外殼的地標：側欄是 `<header>`（prototype `role="banner"`）內含 `<nav>`；導覽區與工具列的 `aria-label` 隨語言切換
- 只有圖示的控制項（收合後的導覽項、語言、外觀、通知、快捷鍵、登出）都有可存取名稱，隨語言切換（07-01 §語言切換 第 4 條）；裝飾性圖示與縮寫頭像 `aria-hidden`
- 每個控制項都看得出焦點（07-01 §不同螢幕寬度的呈現 第 4 條）：prototype 只有工具鈕有焦點樣式（`sidebar.css:230`–`:235`），導覽項、次選單、登出、語言切換沒有——這是 G-05 已登記的全面缺口，不是新發現；實作一律用對照層的焦點環
- 目前位置不只靠顏色：`aria-current="page"` ＋ 字重 ＋ 底色；角色標示是文字
- 未讀數（U8）若在本次：數字對螢幕閱讀器要有文字（prototype 的徽章 `aria-hidden`，名稱只有「通知」，聽不到數量），`planner` 補進通知入口的可存取名稱
- `prefers-reduced-motion: reduce` 時，收合的寬度過場、次選單、對話框與通知清單的展開都不播動畫，操作照常（07-01 §邊界情況、Scenario「關閉動態效果時不播動畫」；`sidebar.css:185`–`:190` 只涵蓋次選單，實作要全部涵蓋）
- 對比：只用語意 class，色票本身的對比已在 `tokens.css` 處理過（F9），主色當文字用 strong
- 深色下重新整理不閃淺色：外觀在第一次繪製前就解析好（prototype `theme-fouc.js` 的做法），屬 sd／`planner` 的實作

## 待決問題

U 開頭是本份自己的題；括號內是對應的 sa 題號。本份**不替任何一題選邊**，只寫畫面上的分支。

| #                       | 問題                                                                                           | 畫面上的分支                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 影響                                                                                                       |
| :---------------------- | :--------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| U1（sa-3）              | 側欄掛在哪些頁？暫時落點要不要進外殼？不存在的落點頁點了怎麼辦？                               | **A 暫時落點進外殼**：`auth-guard` Requirement「暫時落點……沒有側欄」要出 delta；卡片保留、拿掉 `AuthLayout` 頁首（見上方線框）；卡片裡的「登出」鈕保留（兩處可登出）或拿掉（delta 一併改）。**B 暫時落點維持沒有側欄**：本次沒有任何頁面看得到側欄，58 條 Scenario 都沒有畫面可驗。不存在的落點：**a** 照樣連到最終路徑，目前會落到「其他路徑 → `/` → 暫時落點」，使用者沒有任何說明就被彈回；**b** 為每個落點註冊一頁外殼內的「建置中」暫時頁（prototype 沒有這個畫面，要先畫 artifact 過 Ready gate）；**c** 不存在的導覽項不顯示或停用——牴觸 07-01 §導覽項目與可見性 第 1 條「清單在每一頁都一樣」                                                                                                                 | `auth-guard` delta；`frontend-routes.mdx` §路由；Scenario 8、11、12、21、23、27、47、55 等需要落點頁的驗收 |
| U2（sa-9）              | 擋下之後的「說明」出現在哪、用什麼元件、文案是什麼？                                           | prototype 與規格都沒有這個畫面與文案。**A** 落點頁頂部的提示橫幅（[Alert Banner](../../../design/system/components/alert-banner.md)，沿用 `frontend/src/components/ui/alert.tsx`）；**B** 一則 [Toast](../../../design/system/components/toast.md)（尚未實作，要新建 `components/ui/` 的原語，照 UXC-07 的存續時間）。兩者都由**落點頁**讀 navigation state 呈現，本次落點只有暫時落點；任務列表不存在（U1）。文案要維護者給，例：標記作業「你目前沒有任何任務的標記員、審核員或專案負責人角色，所以還不能進入標記作業」——**這只是範例，不是建議文案**                                                                                                                                                                | Scenario 13、19；#722、#730 要不要接住這個說明                                                             |
| U3（sa-11）             | 外觀切換搬成共用元件後，元件展示頁怎麼辦？                                                     | **A** 展示頁改用同一個 `components/theme-toggle.tsx`（單一圖示鈕、記住選擇、離開不還原）：`component-gallery` Requirement「展示頁切換淺色與深色」要出 delta（不再是兩顆 `aria-pressed` 鈕、不再不寫入儲存）。**B** 展示頁保留自己的兩顆鈕、不記住：那它不是同一個元件，`pages/dev-gallery/theme-toggle.tsx` 不搬、改名，與 Issue #720 驗收條件第 2 項「把 `theme-toggle.tsx` 搬到 `components/`」的字面不一致，要維護者確認                                                                                                                                                                                                                                                                                           | `component-gallery` delta；`frontend-routes.mdx` §元件展示頁                                               |
| U4（sa-12）             | 品牌標誌與外觀切換沒有自己的元件規格，Issue 要求更新的「程式實作」欄寫在哪？畫面清冊怎麼更新？ | 現況：`design/system/components/` 只有 `lang-toggle.md`；`screen-inventory.md`（生成檔，不手改）的 Language Toggle 只列帳號頁與展示頁，**沒有 `shared/app-shell`**，`check-component-reuse.mjs` 因此判斷它不是共用元件，搬到 `components/` 的理由在檢查腳本上看不出來。**A** 用 `design-system-setup` 補兩份元件規格（品牌標誌、外觀切換），並在 `pages/shared-app-shell.md` 把三者列為使用的元件，重新產生清冊。**B** 不新增規格，只更新 `lang-toggle.md` 的「程式實作」與 `pages/shared-app-shell.md`（它目前寫「登入後的語言切換……是兩套」，要改成同一個元件）。兩種都要改 `design/system/`，不改 `design/prototype/`                                                                                              | `planner` 的 tasks；共用元件檢查能否判斷這三個元件                                                         |
| U5（sa-10，另有新發現） | 快捷鍵總覽在本次列什麼？「審核」那一組是「通過／退回」還是「通過／無法裁決」？                 | sa-10 已記「目前頁面可用的」與固定三組的矛盾。**新發現（`design-gaps.md` 沒有登記）**：規格 07-01 §快捷鍵總覽 的註與 Scenario「快捷鍵總覽不合併動作」要「通過目前結果」「退回目前結果」兩列；規格 04-02 §決策快捷鍵 第 1、8 條是 `A` 通過、`B` 無法裁決、沒有退回，prototype 的總覽也是「通過目前結果 A」「無法裁決 B」（`sidebar.js:2161`–`:2162`，#596 廢除退回）。另外 04-02 §鍵盤快捷鍵 第 1 條把那一組叫「工作區」，07-01 Scenario 與 prototype 叫「標記作業」。**A** 照 prototype 列四組（全域、標記作業、頁籤、審核），審核兩列是通過／無法裁決，07-01 要用 `spec-writing` 回寫；**B** 照 07-01 字面列通過／退回，與 04-02 牴觸；**C** 只列目前頁面真的可用的（本次只有全域兩列），07-01 Scenario 48–50 要回寫 | Scenario 43、48–50；07-01 或 04-02 的回寫                                                                  |
| U6（新）                | 側欄收合沒有鍵盤路徑                                                                           | prototype 只在「點側欄空白處」收合（`sidebar.js:2526`–`:2538`），沒有任何可聚焦的控制項；規格 07-01 §不同螢幕寬度的呈現 第 4 條「每個控制項都能用鍵盤操作」、Scenario「用鍵盤走過側欄所有控制項」。`design-gaps.md` 沒有這一條（G-05 只講焦點樣式）。**A** 收合不算控制項，維持只能用滑鼠；**B** 加一個看得見的收合鈕——prototype 沒有，屬介面改動，要先畫 artifact 過 Ready gate；**C** 讓空白區可聚焦（鍵盤按 Enter 收合）——沒有可見的提示，使用者不會知道                                                                                                                                                                                                                                                           | Scenario 51、61；可能的 artifact                                                                           |
| U7（新）                | 手機下方主導覽的英文長標籤會不會被截斷？13px 字級取哪一個 token？                              | prototype 手機主導覽 11px、`nowrap`、六項平均分配（`sidebar.css:917`–`:932`）；英文「System Administration」在 375px 寬、每項約六分之一寬時**很可能**放不下，本份**沒有實測**。規格 07-01 §邊界情況、Scenario「語言文字較長時導覽不截斷」。**A** 允許換成兩行；**B** 手機另用較短的英文標籤（要維護者給文案）。字級：13px（導覽項、工具鈕）與 `--text-caption` 14px、`--text-label` 12px 等距，G-64 對登入頁也留了這一題                                                                                                                                                                                                                                                                                              | Scenario 63；手機版面                                                                                      |
| U8（sa-5、sa-6）        | 通知留不留在本次？不留的話，通知入口畫不畫？                                                   | **A 不在本次、不畫入口**：Scenario 54「收合後外觀、通知與登出入口仍看得到」的「通知」那一半驗不到，需改寫或移交。**B 不在本次、但畫入口**：入口點了打開的是什麼沒有資料可給，prototype 的空清單文案是「目前沒有通知」，但那會讓使用者以為真的沒有通知，違反「不可把不存在的資料顯示成空」的原則，不建議以此替代。**C 留在本次**：要先有 07-04 的資料與 operationId（sd 已寫明本次後端不畫通知），還要處理未讀數的可存取名稱                                                                                                                                                                                                                                                                                           | Scenario 37–42、54；#740 的移交                                                                            |
| U9（sa-4）              | 桌機展開次選單後點「使用者管理」去哪？                                                         | prototype 的次選單「使用者管理」連到與「系統管理」相同的使用者管理頁（`sidebar.js:670`），規格沒寫（07-shared Logic Flow 缺口二）。採用 prototype 的去處需要維護者確認，再用 `spec-writing` 回寫 07-01                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 次選單第一個連結的目標                                                                                     |
| U10（sa-14）            | 使用者選了深色之後登出，登入頁要不要也是深色？                                                 | 外觀在第一次繪製前就依本機偏好解析，若對所有頁面一視同仁，登入頁也會是深色（帳號頁的元件已用語意 class，深色可正確呈現）。**A** 全站一致；**B** 登入前一律淺色、登入後才套用——登入那一下會從淺色跳成深色                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 登入頁外觀；01-01 是否回寫                                                                                 |
| U11（sa-1、sa-2）       | 任務角色來源本次固定回「沒有任何任務角色」，畫面上的結果                                       | 本次每一位使用者：第三項讀「標記作業」、角色標示「一般使用者」、點第三項與「資料集分析」都被擋下。依任務角色的另外 12 條 Scenario 在本次沒有畫面可驗；若改成本次就有真的來源，`buildSidebarNav` 不必改，只換 `AppShellLayout` 傳入的來源                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Scenario 3–7、9、13、14、16–19                                                                             |

### 交給 `planner`／`sd` 的明確事項（不需要維護者決定）

- `lib/i18n` 的 `fallbackLng` 改成以繁中為備用語言，讓缺翻譯時顯示繁中原文（07-01 §邊界情況）
- prototype 寫死單一語言的三個 aria-label（「Main navigation」「全域工具」「前往個人設定」）補另一種語言的文案
- `features/auth` 抽出 `useSignOut()`，`LogoutButton` 改用它
- `auth.nav.*` 兩個鍵搬到 `common`，`LanguageToggle`、`BrandMark` 的呼叫端改 import 路徑；`check-component-reuse.mjs` 的允許清單與 `lang-toggle.md` 的「程式實作」跟著更新（U4 決定清冊的做法）
- 新增 `components/ui/dialog.tsx` 時，元件展示頁補一節、`variant-catalog.ts` 補清單，否則完整性測試失敗
- 每條登入後路由都要在 `handle` 宣告 `navKey`，缺的時候測試要失敗
