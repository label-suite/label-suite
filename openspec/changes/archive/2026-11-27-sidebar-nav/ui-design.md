# UI Design

本份是 change `sidebar-nav`（Issue #720）的前端設計：登入後外殼（側欄）的路由、元件樹、資料來源、畫面狀態與 design token。脈絡基準是同目錄的 `system-analysis.md`（以下稱 sa，待決題號寫成 sa-N）；後端側見 `system-design.md`（以下稱 sd，題號 SD-N）；決議見 `clarification.md`（題號 Q、P）。

畫面長相以 prototype 為準，本份不重新設計。原本列在 [§待決問題](#待決問題) 的 U1～U11 都已由 clarification 決議，本份已依決議改寫；本次驗收 41 條 Scenario（07-01 留 40 條、01-01 一條），其餘 32 條依 clarification §移出本次的驗收標準 交給後續的單。

## Prototype 對照

規格 07-01 依它自己的 Q5 不嵌 `PrototypeFrame`，畫面來源是 `design/prototype/pages/shared/sidebar.js` 與 `sidebar.css`（兩檔都已實際讀過）；要看畫面時開任何載入 `sidebar.css` 的頁面，最省事的是 `design/prototype/pages/dashboard/dashboard.html`（`design/system/pages/shared-app-shell.md` §入口）。維護者 2026-11-27 已核可本單的畫面（Issue #720 留言「Ready gate：畫面已核可」）。

| 側欄的部分                             | prototype 來源                                                                                                                                     | 設計系統                                                                                                                                                                                        | 規格 07-01                                                       |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| 品牌區（logo、wordmark、語言切換）     | `sidebar.js:2042`–`:2060`；`sidebar.css:37`–`:79`                                                                                                  | [App Shell](../../../design/system/components/app-shell.md)、[Brand Mark](../../../design/system/components/brand-mark.md)、[Language Toggle](../../../design/system/components/lang-toggle.md) | §語言切換、§不同螢幕寬度的呈現 第 1 條                           |
| 導覽項（五或六項）與「系統管理」次選單 | `sidebar.js:1988`–`:2037`（清單）、`:649`–`:677`（次選單）、`:564`–`:567`（`l0NavI18n`）、`:557`–`:560`（`taskRoleI18n`）；`sidebar.css:81`–`:183` | App Shell 結構表「側欄本體」「系統管理次選單」                                                                                                                                                  | §導覽項目與可見性、§目前位置、§進入模組的條件、§系統管理的次選單 |
| 底部工具列（快捷鍵、外觀）             | `sidebar.js:2082`–`:2089`；`sidebar.css:192`–`:256`                                                                                                | App Shell 結構表「主題切換」；[Theme Toggle](../../../design/system/components/theme-toggle.md)                                                                                                 | §外觀切換、§快捷鍵總覽                                           |
| 使用者晶片與登出                       | `sidebar.js:2098`–`:2113`；`sidebar.css:278`–`:351`                                                                                                | App Shell 結構表「使用者區」「登出」                                                                                                                                                            | §導覽項目與可見性 的角色標示、§登出                              |
| 快捷鍵總覽對話框                       | `sidebar.js:2115`–`:2167`、`:2218`–`:2230`、`:2493`–`:2523`                                                                                        | App Shell「`#shortcutHelpModal`」；覆蓋層自建（`design-gaps.md` G-23）                                                                                                                          | §快捷鍵總覽                                                      |
| 收合                                   | `sidebar.js:2526`–`:2538`（點側欄空白處）；`sidebar.css:582`–`:645`                                                                                | App Shell 變體「桌機收合」                                                                                                                                                                      | §側欄收合                                                        |
| 手機版面                               | `sidebar.css:828`–`:950`                                                                                                                           | App Shell 變體「行動版」                                                                                                                                                                        | §不同螢幕寬度的呈現 第 2、3 條                                   |
| 暫時落點裡的卡片與擋下說明             | 無：#719 的暫時落點不在 prototype，是維護者核可的 artifact；擋下說明沿用既有元件（Q4）                                                             | [Alert Banner](../../../design/system/components/alert-banner.md)                                                                                                                               | 02-01（之後取代）；07-01 §進入模組的條件 第 3 條與註（Q20）      |

本次**不照 prototype** 的地方，都已有裁定，不是待決：

- prototype 點「標記作業」會從 `labelsuite.activeTaskType` 帶 `task_type`（`sidebar.js:1973`–`:1975`）；規格 07-01 Q6 裁定整條移除，所以連結只帶入口標記 `entry=nav`（Q17；參數名沿用 `sidebar.js:1971` 與 `docs/prototype/navigation.mdx` §Annotation 模組）
- prototype 的「跟隨系統」在 `sidebar.js` 的 `getStoredThemeChoice()` 退回淺色；規格 07-01 Q14 與 `design/prototype/assets/theme.js`、`theme-fouc.js` 都讀作業系統，以後者為準
- **不畫通知入口**（clarification Q7）：prototype 底部工具列與手機品牌列的通知鈴（`sidebar.js:2066`–`:2070`、`:2090`–`:2095`）本次不出現，通知整段交給 #740；工具列只剩快捷鍵與外觀兩顆，各占一半寬度
- **快捷鍵總覽只列目前頁面實際可用的**（clarification Q3、規格 07-01 Q19）：prototype 固定列四組（`sidebar.js:2115`–`:2167`），本次只列「全域」一組
- **收合多一個鍵盤路徑**（clarification Q12）：prototype 只能點側欄空白處；本次在空白區放一個平時看不見、取得焦點時才顯示焦點框的按鈕
- **側欄的語言切換與帳號頁的是同一個元件**（clarification Q9）：prototype 是兩套 markup，結構、文案與行為相同

## 頁面與路由

本次新增一個**登入後外殼**：它不是一頁，是包住所有登入後路由的 layout，側欄畫在這一層。路徑沿用 prototype 的頁面識別（`docs/prototype/navigation.mdx` §Shared Sidebar 導覽），和 `frontend-routes.mdx` 的既有慣例一致。

| 路由                                                                          | 頁面                                                                                               | 對應的規格                                                          | 需要的角色                                                                          |
| :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ | :---------------------------------------------------------------------------------- |
| （layout，沒有自己的 path）包在 `RequireAuthRoute` 底下、所有登入後路由的外層 | `AppShellLayout`（`src/app/`）＋ `AppShell`（`components/app-shell/`）                             | 規格 07-01 全頁；07-shared Logic Flow 節點 P1                       | 已登入：平台成員、系統管理員、Seeder 管理員（同系統管理員）。不需要任何任務成員身分 |
| `/dashboard/dashboard`                                                        | `DashboardPlaceholderPage`：畫在外殼裡，卡片沒有自己的登出鈕，頂端可能有一次性的擋下說明（Q2、Q4） | 規格 02-01（之後取代）；07-01 §進入模組的條件 第 3 條；07-shared X1 | 已登入，同上                                                                        |

**不新增「建置中」頁、不為不存在的落點註冊路由**（Q2；`frontend-routing` 不改）。側欄的出口（07-shared Logic Flow 分段一、二）照常連到最終路徑；頁還不存在時，照現行「其他路徑 → `/` → 暫時落點」回到暫時落點，不顯示任何說明：

| 導覽項                                               | 目標路徑                                                                                    | 07-shared 節點                 | 本次點了的結果                                        | 頁面由誰做 |
| :--------------------------------------------------- | :------------------------------------------------------------------------------------------ | :----------------------------- | :---------------------------------------------------- | :--------- |
| 品牌連結、儀表板                                     | `/dashboard/dashboard`                                                                      | X1                             | 暫時落點                                              | #722       |
| 任務管理                                             | `/task-management/task-list`                                                                | X2                             | 回暫時落點                                            | #730       |
| 第三個導覽項（讀作「例外處置」時）                   | `/task-management/task-list`                                                                | D2 是 → X2                     | 本次不會出現（沒有任務角色）                          | #730、#766 |
| 第三個導覽項（讀作「標記作業」「審核作業」且放行時） | `/annotation/annotation-list?entry=nav`                                                     | D3 是 → X7                     | 本次不會放行                                          | #773、#766 |
| 第三個導覽項（擋下時）                               | `/dashboard/dashboard`，帶擋下說明 `annotation`                                             | D3 否 → X1                     | **暫時落點頂端顯示說明**（本次驗收）                  | —          |
| 資料集分析（放行／擋下）                             | `/dataset/dataset-analysis-list`／`/task-management/task-list` 帶擋下說明 `datasetAnalysis` | D4 是 → X8／D4 否 → X2         | 擋下後任務列表不存在，經 `/` 回暫時落點，說明帶不過去 | #738／#730 |
| 系統管理（手機或已收合）、次選單「使用者管理」       | `/admin/user-management`                                                                    | D1 否 → X4；次選單見 07-01 Q21 | 回暫時落點                                            | #728       |
| 次選單「角色設定」                                   | `/admin/role-settings`                                                                      | D1 是 → X5                     | 回暫時落點                                            | #729       |
| 個人設定、使用者晶片                                 | `/account/profile`                                                                          | X3                             | 回暫時落點                                            | #727       |
| 登出                                                 | `/account/login`（經守門）                                                                  | X6                             | 回登入頁                                              | 已有       |

### 進入、離開與返回

- **進入**：外殼沒有自己的入口。任何登入後路由被畫出來時，外殼就在（07-shared S → P1）。守門還沒判定完成前只畫頁面底色，外殼與側欄都不畫（`openspec/specs/auth-guard` Requirement「畫面判定完成前不顯示任何頁面內容」），所以側欄不會在未登入時閃一下
- **離開**：只有上表的出口。導覽項一律是連結（`<a href>`），按住 Ctrl／⌘ 或中鍵點擊交給瀏覽器開新分頁，不經過側欄的擋下判斷（與規格 07-02 §開啟頁籤與去重 第 5 條一致）；被開到的那一頁自己的進入規則照常擋
- **擋下**：只攔一般點擊。第三個導覽項與「資料集分析」的連結 `href` 照樣指向真正的模組頁，點擊時若依 [§資料來源](#資料來源) 的任務角色判斷要擋，改為導向落點並以 router 的 navigation state 帶擋下說明的種類（`annotation` 或 `datasetAnalysis`），不進網址。目前已經在落點時以取代歷史紀錄的方式導向，不堆歷史
- **返回**：側欄不定任何返回。瀏覽器的上一頁回到前一個路由，外殼不動；擋下說明讀過一次就從歷史紀錄的 state 清掉，所以上一頁、下一頁與重新整理都不會再出現
- **目前位置**：由每條包在外殼裡的路由在 route 的 `handle` 宣告自己屬於哪個導覽項（`navKey`），系統管理的兩頁另外宣告次選單項（`adminSubKey`）；外殼讀最深一層的宣告，全站同一時間只標一個（07-01 §目前位置 第 1–5 條、§卡控機制「只標一個」）。本次只有暫時落點，宣告 `navKey: "dashboard"`。**缺宣告時測試失敗**（P3）：測試走過 `createAppRouter()` 的路由樹，外殼底下每一條有 `element` 的路由都要有 `navKey`，不靠預設值
- **角色標示的顯式覆寫**：系統管理的頁面以同一個 `handle` 宣告 `roleIndicator: "systemAdmin"`，外殼優先採用，不被任務角色蓋掉（07-01 §導覽項目與可見性 的註、Q2）。本次沒有系統管理頁，只建好這個入口（驗收移交 #728）

## 常駐文件異動

- 常駐文件：`docs/diagrams/architecture/frontend-routes.mdx`（已先改好，與本份一致）

| 節                          | 異動 | 摘要                                                                                                                                                      |
| :-------------------------- | :--- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §路由                       | 已改 | 開頭加登入後外殼；暫時落點那一列改成畫在外殼裡、沒有自己的登出鈕、頂端顯示擋下說明；表後加外殼 layout、`handle` 的 `navKey` 與「未註冊的落點回暫時落點」  |
| §頁面與功能元件             | 已改 | 加 `AppShellLayout` 一列（`AppShell` 與 namespace `appShell`）；暫時落點那一列拿掉 `AuthLayout` 與 `LogoutButton`、加 `BlockedNotice`；登出的說明改成側欄 |
| §前端骨架 › §目錄           | 已改 | `components/` 加外觀切換，`lib/` 加 theme                                                                                                                 |
| §前端骨架 › apiFetch 的細節 | 已改 | 預載 namespace 加 `appShell`；缺鍵以繁中代替（`fallbackLng`）；外觀在第一次繪製前套用、登入頁也照偏好                                                     |
| §前端骨架 › §登入狀態與守門 | 已改 | 加 `AppShellLayout`：換頁時背景重查登入狀態，焦點不重查                                                                                                   |
| §前端骨架 › §元件展示頁     | 已改 | `ThemeToggle` 改成共用的外觀切換並記住選擇；原語加 `dialog`                                                                                               |
| §已知限制                   | 已改 | 加兩列：落點頁多數不存在、任務角色讀取不存在                                                                                                              |
| §決策紀錄                   | 已改 | 加一列：外殼、暫時落點、擋下說明、展示頁外觀切換                                                                                                          |

## 元件樹

依 F5（`docs/development/rules/frontend-agent-rules.mdx`）與 `scripts/check-component-reuse.mjs`：

- 品牌標誌、語言切換、外觀切換放 `frontend/src/components/`（`ui/` 以外，它們是組合好的元件、不是 shadcn 原語）。品牌標誌與語言切換同時被帳號頁（`features/auth`）與外殼用到，是共用元件；外觀切換只有外殼這個產品畫面用到，放 `components/` 是 clarification Q5 的裁定（照 Issue #720 字面搬，展示頁與外殼共用同一個），`planner` 要在 `design.md` 依 F5 的「例外」寫明這一次抽象
- **App Shell 本身也是共用元件**：`design/system/screen-inventory.md` 的「元件 → 畫面」表裡，它被帳號、系統管理、儀表板、任務管理、標記、資料集與 `shared/app-shell` 用到，跨了一個以上 feature，所以它的畫面元件只能放 `components/`；`features/` 底下不能有名為 `*-shell.tsx` 的元件檔（檢查腳本第 2、3 條）。因此外殼拆成三層：
  - `components/app-shell/`：只負責畫，所有資料（導覽項清單、目前位置、角色標示、登入者名稱、收合狀態、登出送出中）都由 props 傳入，不 import 任何 `features/`
  - `features/app-shell/`：側欄自己的狀態轉換與規則——導覽項模型、任務角色來源的接縫、收合偏好、擋下說明、快捷鍵清單
  - `src/app/app-shell-layout.tsx`：組合層。`app/` 依 F1 可以 import 全部，它向 `features/auth` 取登入者與登出、向 `features/app-shell` 取模型，交給 `components/app-shell` 畫。`features/app-shell` 不 import `features/auth`
- `design/system/components/app-shell.md` 的「程式實作」寫 `frontend/src/components/app-shell/app-shell.tsx`

### 登入後外殼

```text
RequireAuthRoute（沿用 frontend/src/features/auth/route-guards.tsx）
└─ AppShellLayout          新建，放 frontend/src/app/app-shell-layout.tsx（組合層，非設計系統元件）
   │  讀：useSessionState（features/auth 既有）、useSignOut（features/auth 新匯出，見下）、
   │      目前路由的 handle（navKey、adminSubKey、roleIndicator、shortcutGroups）、
   │      useTaskRoleSource、buildSidebarNav、useSidebarCollapsed（features/app-shell）
   └─ AppShell             app-shell.md：新建，放 frontend/src/components/app-shell/app-shell.tsx
      ├─ BrandBar          app-shell.md「側欄本體」的品牌區：新建，放 frontend/src/components/app-shell/brand-bar.tsx；
      │                    桌機在側欄最上，手機變固定的上方品牌列
      │  ├─ BrandLink      連到 /dashboard/dashboard，可存取名稱「Label Suite 首頁」
      │  │  └─ BrandMark   brand-mark.md：搬移，frontend/src/features/auth/brand-mark.tsx → frontend/src/components/brand-mark.tsx
      │  ├─ LanguageToggle lang-toggle.md：搬移，frontend/src/features/auth/language-toggle.tsx
      │  │                 → frontend/src/components/language-toggle.tsx；手機版用同一個元件的精簡尺寸，不另建第二個
      │  └─ 手機才有：ThemeToggle（精簡尺寸）、SignOutButton（見下）
      ├─ SidebarNav        app-shell.md「側欄本體」的導覽項：新建，放 frontend/src/components/app-shell/sidebar-nav.tsx
      │  ├─ NavLink ×5     同檔；儀表板、任務管理、第三個導覽項、資料集分析、個人設定；Lucide 圖示＋文字
      │  │                 （React Router 的 NavLink 的 active 判斷不用，目前位置以 handle 為準）
      │  └─ AdminNavGroup  app-shell.md「系統管理次選單」：新建，放 frontend/src/components/app-shell/admin-nav-group.tsx
      │     ├─ 觸發鈕       桌機未收合時展開／收起；手機或已收合時直接導向 /admin/user-management
      │     └─ 次選單       兩個連結：使用者管理（/admin/user-management，07-01 Q21）、角色設定
      ├─ CollapseControl   設計系統無（clarification Q12）：新建，放 frontend/src/components/app-shell/collapse-control.tsx；
      │                    只在桌機；位在導覽項與底部工具列之間的空白區，平時看不見，取得焦點時才顯示焦點框
      ├─ UtilityRow        app-shell.md 的底部工具列：新建，放 frontend/src/components/app-shell/utility-row.tsx（只在桌機）
      │  ├─ 快捷鍵入口      button.md：沿用 frontend/src/components/ui/button.tsx（outline、icon 尺寸）；已收合時隱藏
      │  └─ ThemeToggle    theme-toggle.md：搬移，frontend/src/pages/dev-gallery/theme-toggle.tsx
      │                    → frontend/src/components/theme-toggle.tsx；改成單一圖示鈕、只顯示一個方向（07-01 §外觀切換 第 4 條）、
      │                    寫入外觀偏好。展示頁改用同一個（Q5），不再是兩顆 aria-pressed 鈕
      │                    （不畫通知入口，Q7）
      ├─ UserSummary       app-shell.md「使用者區」：新建，放 frontend/src/components/app-shell/user-summary.tsx（只在桌機）
      │  ├─ 個人設定連結    縮寫頭像（aria-hidden）＋姓名＋角色標示；已收合時整塊隱藏
      │  │                 頭像是 App Shell 自己的 `#userAvatar`，不是 avatar.md 的 Avatar（screen-inventory 的
      │  │                 Avatar 使用畫面不含 shared/app-shell）
      │  └─ SignOutButton  button.md：沿用 frontend/src/components/ui/button.tsx（icon 尺寸、loading）；
      │                    外殼自己的圖示鈕，新建，放 frontend/src/components/app-shell/sign-out-button.tsx
      ├─ ShortcutOverview  app-shell.md「#shortcutHelpModal」：新建，放 frontend/src/components/app-shell/shortcut-overview.tsx
      │  └─ Dialog         modal.md 的 Modal 尚未實作，且 App Shell 的這個覆蓋層本來就不走 Modal（G-23）：
      │                    新增 shadcn/ui 原語，放 frontend/src/components/ui/dialog.tsx；元件展示頁要有它的一節
      │                    （completeness 測試）。modal.md 的「程式實作」本次不改，因為 Modal 的尺寸變體沒有做
      └─ <main>（Outlet）  頁面內容；手機時上下留出品牌列與主導覽的高度，不被遮擋
```

檔名注意：檢查腳本用「最後一個字」比對共用元件，所以 `features/`、`pages/` 底下的元件檔不要以 `-shell`、`-toggle`、`-mark`、`-chip`（Chip 是共用元件、尚未實作，對到就失敗）、`-card`、`-button`、`-alert` 結尾，除非它就是包住對應的共用元件。上面的使用者區因此叫 `UserSummary` 而不是 `UserChip`；收合的偏好叫 `use-sidebar-collapsed.ts`（`.ts` 不在掃描範圍）。

### 暫時落點

```text
DashboardPlaceholderPage   沿用 frontend/src/pages/dashboard-placeholder/；不再包 AuthLayout（品牌與語言切換由側欄提供）
├─ BlockedNotice           設計系統：alert-banner.md；新建，放 frontend/src/features/app-shell/blocked-notice.tsx，
│                          由 features/app-shell 的 index.ts 匯出；內部用 frontend/src/components/ui/alert.tsx（variant info，
│                          前置 Lucide `info` 圖示）。navigation state 沒帶說明時什麼都不畫
└─ SignedInCard            沿用 frontend/src/features/auth/signed-in-card.tsx；拿掉 LogoutButton（Q2）
```

prototype 沒有這個畫面，所以畫低保真結構（桌機展開）：

```text
┌──────────────────────┬──────────────────────────────────────────────┐
│ [logo] Label Suite ZH│ ┌──────────────────────────────────────────┐ │
│ ──────────────────── │ │ (i) 你目前在任何任務都沒有標記或審核角色，│ │ ← 只有被擋下帶回來時、只一次
│ ▌儀表板（目前）       │ │     所以還不能進入標記作業。              │ │
│   任務管理            │ └──────────────────────────────────────────┘ │
│   標記作業            │        ┌──────────────────────────┐          │
│   資料集分析          │        │ 你已登入                  │          │
│   個人設定            │        │ 王小明（user@example.com）│          │
│                      │        │ [平台成員]                │          │
│ （空白區：收合控制）  │        │ 儀表板還在建置中，……      │          │
│ ──────────────────── │        └──────────────────────────┘          │
│ [ 快捷鍵 ][ 外觀 ]    │                                              │
│ (王) 王小明 一般使用者 [登出] │                                       │
└──────────────────────┴──────────────────────────────────────────────┘
```

- 擋下說明在內容區最上方、卡片之上，寬度與內容區一致，不與側欄重疊；沒有關閉鈕（Alert Banner 沒有可關閉的狀態，alert-banner.md §適用狀態），離開這一頁就不再出現
- 卡片的系統角色仍顯示（那是 #719 暫時落點的內容），和側欄角色標示讀任務角色是兩件事

### 非畫面的模組

| 模組              | 放哪                                                                                               | 做什麼                                                                                                                                                                                                                                                                                                  |
| :---------------- | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `buildSidebarNav` | `frontend/src/features/app-shell/sidebar-nav-model.ts`（新建）                                     | 純函式：輸入系統角色、任務角色來源的回答、目前路由的 `navKey`／`adminSubKey`／覆寫，輸出導覽項清單（含第三項的文案鍵、每項的目標、是否擋下與擋下說明的種類、目前位置、角色標示鍵）。所有依角色的判斷只在這裡，畫面元件不各自判斷（sd §設計結論 的「接縫」）                                             |
| 任務角色來源      | `frontend/src/features/app-shell/task-role-source.ts`（新建）                                      | 單一接縫 `useTaskRoleSource()`：本次固定回「任何任務都沒有任務角色、沒有目前任務」（Q1）。回答的形狀要能承接 sd §任務角色讀取的提案形狀（持有的任務角色集合、目前任務裡的角色）；#766 接上真的讀取時只換這一支                                                                                          |
| 擋下說明          | `frontend/src/features/app-shell/blocked-notice.tsx`（新建）                                       | 匯出擋下時要帶的 navigation state 形狀與 `BlockedNotice` 元件。元件讀 `location.state` 裡的說明種類，畫一次後以取代歷史紀錄的方式把 state 清掉，讓重新整理、上一頁、下一頁都不再出現；種類只有 `annotation`、`datasetAnalysis`，其他值不畫。#722（儀表板）與 #730（任務列表）在各自的頁頂端放同一個元件 |
| 快捷鍵清單        | `frontend/src/features/app-shell/shortcut-registry.ts`（新建）                                     | 「全域」一組固定存在；其他組由路由的 `handle.shortcutGroups` 宣告，外殼讀目前路由的宣告合併。本次沒有任何路由宣告，所以總覽只有全域一組（Q3）。#725（頁籤）、#780（工作區、審核）各自加組                                                                                                               |
| 收合狀態          | `frontend/src/features/app-shell/use-sidebar-collapsed.ts`（新建）                                 | 讀寫本機偏好 `labelsuite.sidebarCollapsed`（沿用 prototype 的鍵，`sidebar.js:5`）；手機一律不收合；讀不到或值無效當成展開                                                                                                                                                                               |
| 外觀偏好          | `frontend/src/lib/theme.ts`（新建，`lib/` 因為不含業務）                                           | 三種值（淺色、深色、跟隨系統）的讀寫、解析成實際外觀、訂閱作業系統變化；`ThemeToggle`、元件展示頁與日後 01-04 的三選一讀同一份。鍵沿用 prototype 的 `label-suite-theme`（`assets/theme.js:3`）。在第一次繪製前套用，**登入頁與登出後的登入頁也照它**（Q6；規格 07-01 §外觀切換 第 5 條、01-01）         |
| 登出              | `features/auth` 新匯出 `useSignOut()`（從 `logout-button.tsx` 抽出送出一次、`markSignedOut` 那段） | 外殼的 `SignOutButton` 經 `AppShellLayout` 用它。暫時落點拿掉登出鈕後 `LogoutButton` 沒有呼叫端，一併移除，不留第二份（F5）                                                                                                                                                                             |

## 資料來源

`api-contract.md` 已寫明本次沿用三個既有端點、不新增 operationId；側欄直接用到的是下表兩個，`createSessionRefresh` 由 `apiFetch` 在 `401` 時自動使用，外殼不直接呼叫。

| 區塊                                                     | operationId                                                                                      | 快取鍵／失效時機                                                                                                                                                                            |
| :------------------------------------------------------- | :----------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 使用者區的姓名與縮寫、「系統管理」顯示與否               | `getCurrentSession`（沿用 `features/auth/session-query.ts` 的同一份快取，不另發請求）            | `getGetCurrentSessionQueryKey()`；`staleTime` 維持無限。**每次換頁（路由的 pathname 改變）在背景重查一次**，回來之前側欄維持原樣、不顯示載入中；視窗重新取得焦點**不**重查（Q11）。理由見下 |
| 登出                                                     | `deleteCurrentSession`（經 `useSignOut`）                                                        | 不論成功或失敗都 `markSignedOut`：移除其他查詢、把登入狀態記成未登入，守門以取代歷史紀錄的方式帶回登入頁（沿用 #719 的行為，規格 01-05 §從這一台登出 第 4 條）                              |
| 第三個導覽項的名稱、角色標示、標記作業與資料集分析的擋下 | **無**：本次是固定回答「任何任務都沒有任務角色、沒有目前任務」的任務角色來源（Q1；sd §設計結論） | 無快取；#766 接上讀取時再定。日後的讀取形狀見 sd §任務角色讀取的提案形狀，那**不是**本次的契約                                                                                              |
| 快捷鍵總覽                                               | 無：靜態清單＋路由宣告                                                                           | —                                                                                                                                                                                           |
| 語言、外觀、收合                                         | 無：本機偏好（07-01 §資料欄位；`data-field-inventory.mdx` §07-01）                               | 語言沿用 `lib/i18n` 的 `labelsuite.lang`；外觀 `label-suite-theme`；收合 `labelsuite.sidebarCollapsed`                                                                                      |

**為什麼換頁就重查、焦點不重查**（Q11）：規格 07-01 §邊界情況「系統角色在側欄開著的時候被改掉 → 側欄維持原本的導覽項，從使用者下一次操作起才依新角色顯示」。「繼續停在目前頁面」時不能變，所以焦點重查會違反它；換頁是使用者明確的下一次操作，背景重查後側欄才更新。重查若得到未登入，守門照既有規則帶回登入頁。`planner` 要把「下一次操作 ＝ 換頁」寫進 Scenario 的測法。

### 狀態放哪裡

| 狀態                             | 去處                                          | 說明                                                             |
| :------------------------------- | :-------------------------------------------- | :--------------------------------------------------------------- |
| 登入者、系統角色                 | TanStack Query（既有快取）                    | 不複製進任何 store（F4、api-agent-rules A9）                     |
| 標記作業的入口標記               | 網址 `entry=nav`                              | 規格 07-01 Q17；標記清單只從網址讀上下文                         |
| 擋下說明                         | router 的 navigation state                    | 一次性；讀過就清掉，重新整理不重現、不可分享，所以不進網址（Q4） |
| 目前位置、角色標示覆寫、快捷鍵組 | 路由的 `handle`                               | 由路由宣告，不由元件猜                                           |
| 語言                             | i18next 實例＋本機偏好                        | 沿用                                                             |
| 外觀                             | `lib/theme.ts`＋本機偏好＋`<html data-theme>` | F4 明列的「第四個去處」；以訂閱同步，不是全域 store 套件         |
| 收合                             | 本機偏好＋`AppShellLayout` 的元件狀態         | 只有外殼讀它                                                     |
| 次選單開合、快捷鍵總覽開合       | 元件 `useState`                               | 純 UI                                                            |

**不需要全域 store**：上表每一格都已有去處，沒有「跨路由共用、又不是伺服器狀態、又不適合放網址」的東西（F4 例外的條件不成立）。

## 畫面狀態

每個資料區塊的四種狀態；側欄沒有被後端遮蔽的欄位，所以「欄位被遮蔽」寫成「刻意不顯示」。

| 狀態          | 呈現                                                                                                                                                                                                                                                                                                                                                                 |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| loading       | 第一次進入：守門判定完成前只畫頁面底色，**外殼與側欄都不畫**，所以沒有側欄的骨架（auth-guard「畫面判定完成前不顯示任何頁面內容」）。之後換頁的背景重查：側欄維持上一份資料，不閃、不顯示載入中。登出送出中見下                                                                                                                                                       |
| error         | 登入狀態查詢**不會失敗**：任何拒絕或沒有回應都轉成「未登入」並由守門帶回登入頁、帶既有的那一句（`session-query.ts`）。側欄自己不顯示任何錯誤訊息，也不顯示後端的 `message`、`code`、`traceId`（07-01 §卡控機制 最後一列、Scenario「錯誤訊息不出現系統內部資訊」）。偏好讀不到（瀏覽器儲存停用）時用預設值：繁中、跟隨系統、展開，不顯示錯誤                          |
| empty         | 姓名是空字串時：使用者區的姓名改顯示 Email，縮寫取 Email 的第一個字（沿用 `SignedInCard` 的做法）；姓名與 Email 都只剩零寬字元時縮寫為「U」（照 prototype `computeAvatarInitials`，`sidebar.js:156`–`:165`）。沒有任何任務角色時角色標示讀作「一般使用者」、第三項讀作「標記作業」——這是本次每一位使用者的實際狀態，不是空狀態。快捷鍵總覽至少有全域一組，不會是空的 |
| 無權限（403） | 側欄的兩個端點只讀自己的登入狀態，不會回 `403`；`401` 由 `apiFetch` 延續、延續失敗則回到未登入。**「看不到」不是無權限畫面**：平台成員的側欄根本不畫「系統管理」（07-01 Q&A「為什麼完全看不到」），不是畫成停用。**「進不去」**（任務角色不足）也不是 `403`：一般點擊導向落點並帶擋下說明（見下）                                                                    |
| 欄位被遮蔽    | 無遮蔽欄位。**刻意不顯示**：側欄只顯示本人的姓名、縮寫與角色標示，不顯示 Email、系統角色的原始值或任何他人資料；角色標示依任務角色解析，**不**顯示「平台成員」這個系統角色名（07-01 §導覽項目與可見性 的註，與暫時落點卡片顯示系統角色是兩件事）                                                                                                                     |

### 登出（寫入）

| 狀態       | 呈現                                                                                                                                                                                                                           |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 送出中     | 按下後圖示鈕立刻進入 `loading`（Button 既有的 spinner），`aria-busy`，滑鼠與鍵盤都按不動；同一個 tick 的第二下也擋（沿用 `LogoutButton` 的 ref 做法，搬進 `useSignOut`）。桌機、已收合、手機三個位置的登出鈕共用同一個送出狀態 |
| 完成或失敗 | 一律回登入頁，畫面不分辨伺服器端是否真的結束（規格 01-05 第 4 條）；登入頁照外觀偏好呈現，深色不先閃淺色（Q6）                                                                                                                 |
| 不會收合   | 點登出不觸發收合（07-01 §側欄收合 第 2 條）                                                                                                                                                                                    |

### 擋下說明（第三個導覽項、資料集分析）

| 狀態       | 呈現                                                                                                                                                                                                                |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 擋下       | 不進目標頁，導向落點並帶說明種類；落點頁最上方以 Alert（info）顯示一次，文案見下方 §元件與 design token › 文案。不帶任務名或任務 ID（Q4；規格 07-01 §進入模組的條件 的註、Q20）                                     |
| 再點一次   | 已在落點時以取代歷史紀錄的方式導向，說明重新出現一次，不堆歷史                                                                                                                                                      |
| 重新整理   | 不再出現：`BlockedNotice` 畫過後就清掉 state                                                                                                                                                                        |
| 落點不存在 | 「資料集分析」被擋時的落點任務列表本次不存在，經「其他路徑 → `/`」回到暫時落點，state 在轉址時丟失，**說明不出現**。這一條（「沒有任務角色時點擊資料集分析」）已移交 #730；本次驗收的是「標記作業」回暫時落點那一條 |

### 測試集答案不外露（Hard Rule 6）

側欄沒有任何任務、資料集、樣本或標準答案的資料；快捷鍵總覽只列按鍵與動作名稱；擋下說明是固定文案，不帶任務名或任務 ID；本次不畫通知（Q7）。日後任務角色來源也只回角色名稱的集合（sd §任務角色讀取的提案形狀），標記員從側欄推不出任何測試集資訊。

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
| 焦點環（含收合控制）               | `focus-visible:ring-ring/50`（沿用 `AuthLayout` 品牌連結的寫法）                                                 | `--color-primary`                                                                                            |
| 收合控制（平時）                   | 透明底、無框、無文字；只在 `focus-visible` 時顯示上一列的焦點環                                                  | —                                                                                                            |
| 登出鈕 hover                       | `text-error`、`bg-error-bg`；手機另加 `border-error-border`                                                      | `--color-error`、`--color-error-soft-bg`（與 `--color-error-bg` 同值的別名）                                 |
| 擋下說明                           | Alert 的 `info` 變體既有 class（`border-info-border`、`bg-info-bg`、`text-info`）                                | `--color-info*` 一組（`alert.tsx` 已對好，不另加）                                                           |
| logo 方塊                          | `bg-icon-accent`、`text-primary-foreground`（`BrandMark` 既有）                                                  | `--color-primary`、`--color-on-cta`                                                                          |
| wordmark                           | `font-(family-name:--font-serif-display)`、`text-foreground`                                                     | `--font-serif-display`、`--color-ink`                                                                        |
| 使用者姓名／角色標示               | `text-foreground`／`text-muted-foreground`                                                                       | `--color-ink`／`--color-ink-muted`                                                                           |
| 縮寫頭像                           | `bg-card`、`text-primary`，框線取主色的淡化                                                                      | `--color-white`、`--color-primary-strong`、`--color-primary`                                                 |
| 快捷鍵總覽對話框                   | `bg-card`、`border-border`；鍵帽 `bg-surface-subtle`                                                             | 遮罩與陰影 prototype 寫死墨色（G-02 #458 段），實作照 shadcn Dialog 的遮罩、深色由 tokens 隨主題換，不寫色碼 |
| 間距                               | `p-(--space-*)`、`gap-(--space-*)`                                                                               | `--space-xs`～`--space-xl`                                                                                   |
| 圓角                               | `rounded-(--radius-md)`、`rounded-(--radius-sm)`                                                                 | `--radius-sm`、`--radius-md`                                                                                 |
| 層級                               | 側欄 `z-(--z-sticky)`；手機兩條固定列與浮層照 prototype 的相對順序，用 `--z-sticky`、`--z-dropdown`、`--z-modal` | prototype 寫死 300／320／600／700（`sidebar.css`），`tokens.css` 有 `--z-*` 卻沒用，同 G-02 的類型           |
| 動態                               | `duration-(--dur-fast)`、`duration-(--dur-normal)`、`ease-(--ease-standard)`；`motion-reduce:transition-none`    | `--dur-fast`、`--dur-normal`、`--ease-standard`                                                              |

- 對照層新增的 `--nav-active` 只是把**已存在**的 token 接進 shadcn 風格的語意名（F6 映射前的第 1 點），不新增 token、不寫色值；深色由 `tokens.css` 的 `html[data-theme="dark"]` 跟著換。通知徽章的對照（原本的 `--notify-badge`）本次不加，跟著通知交給 #740
- **字級**（Q13，`design/system/design-gaps.md` G-66）：取最接近且不大於 prototype 的既有 token。13px（導覽項、工具鈕、姓名、手機 wordmark）與 12px（次選單）取 `--text-label`（12px）；11px（角色標示、手機主導覽）沒有不大於它的 token，只能取最小的 `--text-label`，比原型大，G-66 已登記
- **尺寸**：側欄寬度（展開 240px、收合 88px）、手機兩條列的高度（`--navbar-mobile-height`、`--navbar-mobile-top-height`，由宿主頁面定義，G-24）不是間距刻度，`tokens.css` 沒有對應 token。規格 07-01 §不同螢幕寬度的呈現 的註寫「尺寸以 prototype 為準」，實作照 prototype 的數值寫在外殼一處，不散在各元件；這是 G-24 已登記的狀況，不是新發現

### 文案（取自 prototype；中英兩種都要，aria-label 也一樣）

| 位置                            | 繁中                                                           | 英文                                                                                       | 來源                                                          |
| :------------------------------ | :------------------------------------------------------------- | :----------------------------------------------------------------------------------------- | :------------------------------------------------------------ |
| 導覽項                          | 儀表板、任務管理、資料集分析、系統管理、個人設定               | Dashboard、Task Management、Dataset Analytics、System Administration、Profile              | `sidebar.js:565`–`:566`                                       |
| 第三個導覽項                    | 標記作業／審核作業／例外處置                                   | Annotation／Review／Exception Disposition                                                  | `sidebar.js:558`–`:559`                                       |
| 次選單                          | 使用者管理、角色設定                                           | User Management、Role Settings                                                             | `sidebar.js:549`–`:550`                                       |
| 角色標示                        | 標記員、審核員、專案負責人、一般使用者                         | Annotator、Reviewer、Project leader、General user                                          | `sidebar.js:558`–`:559`；07-01 Q2                             |
| 外觀切換（aria-label 與 title） | 切換為深色模式／切換為淺色模式                                 | Switch to dark mode／Switch to light mode                                                  | `sidebar.js:255`–`:256`、`:277`–`:278`                        |
| 快捷鍵入口與對話框              | 快捷鍵、目前頁面可用快捷鍵、關閉快捷鍵                         | Keyboard shortcuts、Available shortcuts for this page、Close keyboard shortcuts            | `sidebar.js:234`–`:236`、`:259`–`:261`                        |
| 快捷鍵總覽「全域」組（Q3）      | 全域；`?` 開啟快捷鍵總覽；`Esc` 關閉視窗或取消選取             | Global；`?` Open shortcut overview；`Esc` Close dialog or clear selection                  | `sidebar.js:237`–`:239`、`:262`–`:264`                        |
| 擋下說明：標記作業（Q4）        | 你目前在任何任務都沒有標記或審核角色，所以還不能進入標記作業。 | You don't have an annotation or review role in any task yet, so you can't open Annotation. | 繁中：規格 07-01 §進入模組的條件 的註（Q20）；英文：本份擬稿  |
| 擋下說明：資料集分析（Q4）      | 資料集分析需要你在這個任務擔任專案負責人或審核員。             | Dataset Analytics requires you to be the project leader or a reviewer on this task.        | 同上                                                          |
| 收合控制（Q12）                 | 收合側欄／展開側欄                                             | Collapse sidebar／Expand sidebar                                                           | 本份擬稿（prototype 沒有這個控制項）                          |
| 主導覽區（P2）                  | 主導覽                                                         | Main navigation                                                                            | `sidebar.js:2076` 只有英文；繁中本份補                        |
| 工具列（P2）                    | 全域工具                                                       | Global tools                                                                               | `sidebar.js:2083` 只有繁中；英文本份補                        |
| 使用者區的個人設定連結（P2）    | 前往個人設定                                                   | Go to Profile                                                                              | `sidebar.js:2099` 只有繁中；英文本份補，用導覽項的「Profile」 |
| 品牌連結                        | Label Suite 首頁                                               | Label Suite home                                                                           | 既有 `auth.nav.brandHome`（搬到 `common`）                    |
| 語言切換                        | {{code}}，切換語言                                             | {{code}}, Switch language                                                                  | 既有 `auth.nav.languageToggle`（搬到 `common`；G-65 的修正）  |
| 登出                            | 登出                                                           | Sign out                                                                                   | 既有 `auth.dashboard.signOut`（搬到 `appShell`）              |

- namespace：側欄自己的文字（含擋下說明、快捷鍵總覽、收合控制、三個 aria-label）放新的 `appShell`（每個登入後頁面都用，和 `common`、`auth` 一樣啟動時載入，進正式 bundle）；搬到 `components/` 的品牌標誌、語言切換、外觀切換的文字放 `common`，因為共用元件不該依賴某一個 feature 的 namespace。展示頁原本的 `devGallery` `theme.*` 鍵隨舊元件移除
- 英文擬稿的語氣照 `brand.md` §內容與語氣（「你」對應 you、不寫空動詞）；擋下說明的英文由 `frontend-i18n` 的語言檔提供（Q4），定稿以實作時的語言檔為準
- **缺翻譯時顯示繁體中文原文**（P1）：`lib/i18n` 的 `fallbackLng` 從 `false` 改成 `zh-TW`，英文缺某個鍵時顯示繁中原文、不顯示鍵名（07-01 §邊界情況「某個名詞缺少目前語言的文字」、Scenario「術語缺少翻譯時顯示備用文字」）；`frontend-i18n` delta 寫入

## 互動與鍵盤

| 控制項                           | 滑鼠／觸控                                                                   | 鍵盤                                                                                                                                                                                                                     | 依據                                                                    |
| :------------------------------- | :--------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| 導覽項                           | 點擊進入；擋下時導向落點並帶說明                                             | Tab 走到、Enter 進入；目前位置帶 `aria-current="page"`                                                                                                                                                                   | 07-01 §目前位置、§不同螢幕寬度的呈現 第 4 條                            |
| 「系統管理」觸發鈕（桌機未收合） | 點擊展開／收起；點次選單以外的地方收起                                       | Enter／Space 展開／收起；`aria-expanded`、`aria-controls`；展開後 Tab 依序走到兩個連結；Esc 收起並把焦點還給觸發鈕                                                                                                       | 07-01 §系統管理的次選單 第 1–4 條                                       |
| 「系統管理」（手機或已收合）     | 直接導向使用者管理，不展開                                                   | 同左                                                                                                                                                                                                                     | 第 5 條                                                                 |
| 語言切換                         | 點擊立即切換，側欄與頁面內容一起換、記住                                     | 原生按鈕                                                                                                                                                                                                                 | 07-01 §語言切換                                                         |
| 外觀切換                         | 點擊立即切換淺色↔深色、記住；只顯示一個方向的圖示                            | 原生按鈕；aria-label 說出切過去的方向                                                                                                                                                                                    | 07-01 §外觀切換                                                         |
| 快捷鍵總覽                       | 點入口開啟；點對話框外或關閉鈕關閉                                           | 按 `?` 開啟（只在桌機、焦點不在可輸入的元素時）；Esc 關閉；開啟時焦點到關閉鈕、焦點鎖在對話框內，關閉後還給開啟它的元素                                                                                                  | 07-01 §快捷鍵總覽；`sidebar.js:2493`–`:2523`                            |
| 收合（滑鼠）                     | 桌機點側欄空白處切換；點導覽項、語言切換、登出不會收合；收合時同時收起次選單 | —                                                                                                                                                                                                                        | 07-01 §側欄收合；`sidebar.js:2526`–`:2538`                              |
| 收合控制（鍵盤，Q12）            | 它就在空白區裡，點它與點空白處是同一個切換                                   | Tab 順序在導覽項（含展開的次選單）之後、底部工具列之前；取得焦點時顯示焦點框；Enter 或空白鍵切換；`aria-expanded` 反映展開與否、`aria-controls` 指向側欄；名稱隨狀態換成「收合側欄」或「展開側欄」；切換後焦點留在它身上 | 07-01 §不同螢幕寬度的呈現 第 4 條、Scenario「用鍵盤走過側欄所有控制項」 |
| 登出                             | 點擊登出                                                                     | 原生按鈕                                                                                                                                                                                                                 | 07-01 §登出                                                             |

- **次選單用揭露式（disclosure），不照 prototype 的 `role="menu"`**：prototype 標了 `role="menu"`／`menuitem`（`sidebar.js:669`–`:674`），那個角色要求完整的方向鍵選單行為，而它實際只靠 Tab；導覽區裡的一組連結用「按鈕 `aria-expanded` ＋ 連結清單」才名實相符，而且滿足 07-01 第 4 條的「用鍵盤打開、移動與關閉，看得出焦點」。畫面長相不變
- **`?` 在已收合時仍可開啟**：規格只說收合後入口隱藏（§快捷鍵總覽 第 4 條），沒說按鍵失效；prototype 的判斷只看是否桌機（`sidebar.js:2514`），照 prototype
- **已收合時語言切換也隱藏**：prototype `sidebar.css:597`–`:603` 收合時隱藏語言切換與使用者區的姓名區，只留圖示、外觀與登出；規格 §卡控機制 點名保留外觀、通知、登出，通知本次不畫（Q7）
- **收合時導覽項的文字**用視覺隱藏（仍在無障礙樹裡），可存取名稱不變；hover 提示沿用 prototype 的原生 `title`，隨語言切換
- **收合控制不是新的可見控制項**：它平時透明、沒有圖示與文字，滑鼠使用者看到的仍是 prototype 的空白區；只有鍵盤使用者 Tab 到時看得到焦點框

## 響應式

斷點依 brand.md §設計決策：手機 `max-width: 767px`、桌機 `min-width: 768px`；判斷收合與 `?` 的 JS 也用同一個分界（brand.md §版面）。平板寬度落在桌機那一側。

| 寬度          | 版面                                                                                                                                                                                                                                       | 依據                                                                              |
| :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| ≥ 768px，展開 | 左側固定側欄：品牌區（logo、wordmark、語言切換）→ 導覽項 → 空白區（收合控制）→ 底部工具列（快捷鍵、外觀）→ 使用者區（頭像、姓名、角色標示、登出）；內容區在右，主要內容不被遮擋                                                            | 07-01 §不同螢幕寬度的呈現 第 1 條；`sidebar.css:3`–`:351`                         |
| ≥ 768px，收合 | 只剩圖示：品牌區只留 logo，導覽項只留圖示（目前位置仍看得見），工具列隱藏快捷鍵入口、保留外觀，使用者區只留登出；收合控制仍在空白區                                                                                                        | 07-01 §側欄收合、§卡控機制；`sidebar.css:582`–`:645`、`:825`                      |
| ≤ 767px       | 上方固定品牌列：logo、wordmark、語言切換（精簡）、外觀、登出；不顯示姓名、沒有快捷鍵入口、沒有收合控制。下方固定主導覽：導覽項圖示在上、文字在下，平均分配寬度。次選單不展開。內容區上下留出兩條列的高度，主要操作不被遮擋、不需要左右捲動 | 07-01 §不同螢幕寬度的呈現 第 2、3 條、§側欄收合 第 4 條；`sidebar.css:828`–`:950` |

- 英文的長標籤（「System Administration」「Exception Disposition」「Dataset Analytics」）在桌機展開時允許換行、不截斷；手機下方主導覽 prototype 是 `white-space: nowrap`（`sidebar.css:931`）。Q13：**以英文介面的 E2E 實測證明不截斷**（375px 寬、系統管理員六項），放不下時回報，不自行改文案、不新增 token
- 從桌機縮到手機時收合狀態不生效但仍記住，放大回桌機時恢復（prototype `resize` 的處理，`sidebar.js:2541`–`:2548`）；次選單在變成不可用時收起

## 無障礙

- 外殼的地標：側欄是 `<header>`（prototype `role="banner"`）內含 `<nav>`；主導覽區與工具列的 `aria-label` 隨語言切換（P2，文案見上）
- 只有圖示的控制項（收合後的導覽項、語言、外觀、快捷鍵、登出、收合控制）都有可存取名稱，隨語言切換（07-01 §語言切換 第 4 條）；裝飾性圖示、品牌標誌與縮寫頭像 `aria-hidden`
- 每個控制項都看得出焦點（07-01 §不同螢幕寬度的呈現 第 4 條）：prototype 只有工具鈕有焦點樣式（`sidebar.css:230`–`:235`），導覽項、次選單、登出、語言切換沒有——這是 G-05 已登記的全面缺口，不是新發現；實作一律用對照層的焦點環
- 目前位置不只靠顏色：`aria-current="page"` ＋ 字重 ＋ 底色；角色標示是文字
- 擋下說明用 Alert 既有的 `role="alert"`，導向落點後立即朗讀；它在內容區最上方，Tab 不會停在它身上（不可聚焦，alert-banner.md §鍵盤與焦點）
- `prefers-reduced-motion: reduce` 時，收合的寬度過場、次選單與對話框的展開都不播動畫，操作照常（07-01 §邊界情況、Scenario「關閉動態效果時不播動畫」；`sidebar.css:185`–`:190` 只涵蓋次選單，實作要全部涵蓋）
- 對比：只用語意 class，色票本身的對比已在 `tokens.css` 處理過（F9），主色當文字用 strong
- 深色下重新整理、登出回登入頁都不閃淺色：外觀在第一次繪製前就解析好（prototype `theme-fouc.js` 的做法，Q6），屬 sd／`planner` 的實作

## 設計系統異動

依 clarification Q9；`design/prototype/` 不改。`design/system/` 沒有生成 `screen-inventory.md` 的腳本（`design-system-setup` 步驟 6 是照 `components/` 與 `pages/` 逐列產生的作業），本次依同一規則重新產生受影響的列。

| 檔                                         | 異動                                                                                                                    |
| :----------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| `design/system/components/brand-mark.md`   | 新增；程式實作 `frontend/src/components/brand-mark.tsx`；用到它的畫面：五個帳號頁、`shared/app-shell`                   |
| `design/system/components/theme-toggle.md` | 新增；程式實作 `frontend/src/components/theme-toggle.tsx`；用到它的畫面：`shared/app-shell`                             |
| `design/system/components/lang-toggle.md`  | 程式實作改為 `frontend/src/components/language-toggle.tsx`；側欄與帳號頁是同一個元件；用到它的畫面加 `shared/app-shell` |
| `design/system/components/app-shell.md`    | 程式實作改為 `frontend/src/components/app-shell/app-shell.tsx`（App Shell 依 F5 是共用元件，見 [§元件樹](#元件樹)）     |
| `design/system/pages/shared-app-shell.md`  | 列出 Brand Mark、Language Toggle、Theme Toggle；語言切換從「兩套」改成同一個元件                                        |
| `design/system/pages/account-*.md`（五份） | 預設視圖的元件加 Brand Mark                                                                                             |
| `design/system/screen-inventory.md`        | 兩表加 Brand Mark、Theme Toggle；Language Toggle 加 `shared/app-shell` 並改程式實作；App Shell 改程式實作；元件數 37    |
| `design/system/MASTER.md`                  | 元件一覽加兩列、37 份；變更紀錄第 9 版                                                                                  |
| `design/system/design-gaps.md`             | G-66：側欄的 13、11、10px 字級（Q13）                                                                                   |

`node scripts/check-component-reuse.mjs` 在實作搬檔之前會因為四個「程式實作」路徑還不存在而失敗；搬完、建好 `components/app-shell/` 之後才會通過。這是預期的順序，`planner` 要把「搬檔與建檔後跑這支腳本」寫進 tasks。

## 待決問題

U1～U11 都已由 clarification 決議，本份已依決議改寫；本份沒有新的待決。

| #                 | 問題                                                                   | 決議                                                                                                                                            | 對應 |
| :---------------- | :--------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| U1（sa-3）        | 側欄掛在哪些頁？暫時落點要不要進外殼？不存在的落點頁點了怎麼辦？       | **已決議（Q2）**：暫時落點進外殼、拿掉卡片的登出鈕；導覽項照常連到最終路徑，頁不存在時沿用現行的回暫時落點，不新增「建置中」頁                  | Q2   |
| U2（sa-9）        | 擋下之後的說明出現在哪、用什麼元件、文案是什麼？                       | **已決議（Q4）**：落點頁頂端的既有 Alert，一次性、以 navigation state 帶；文案寫進 07-01（Q20），英文由語言檔提供                               | Q4   |
| U3（sa-11）       | 外觀切換搬成共用元件後，元件展示頁怎麼辦？                             | **已決議（Q5）**：展示頁改用同一個共用外觀切換，讀寫同一份偏好、離開不還原；`component-gallery` 出 MODIFIED                                     | Q5   |
| U4（sa-12）       | 品牌標誌與外觀切換的元件規格、「程式實作」與畫面清冊                   | **已決議（Q9）**：新增兩份元件規格，三份的「程式實作」寫 `components/` 的新位置，清冊補 `shared/app-shell`（見 [§設計系統異動](#設計系統異動)） | Q9   |
| U5（sa-10）       | 快捷鍵總覽在本次列什麼？審核組是「通過／退回」還是「通過／無法裁決」？ | **已決議（Q3）**：只列目前頁面實際可用的，本次只有全域一組；審核組以 04-02 為準（通過 A／無法裁決 B），各組由實作它的單加進總覽                 | Q3   |
| U6（新）          | 側欄收合沒有鍵盤路徑                                                   | **已決議（Q12）**：空白區放一個平時看不見、取得焦點時才顯示焦點框的按鈕，不新增可見控制項                                                       | Q12  |
| U7（新）          | 手機主導覽的英文長標籤與 13px 字級                                     | **已決議（Q13）**：取最接近且不大於 prototype 的字級 token，差異登記 G-66；不截斷以英文 E2E 實測證明，放不下時回報                              | Q13  |
| U8（sa-5、sa-6）  | 通知留不留在本次？入口畫不畫？                                         | **已決議（Q7）**：移交 #740，本次不畫入口、不用空清單代替                                                                                       | Q7   |
| U9（sa-4）        | 桌機展開次選單後點「使用者管理」去哪？                                 | **已決議（Q6）**：進 06-01 使用者管理，與 prototype 一致；寫進 07-01（Q21）。驗收「展開系統管理次選單點使用者管理」移交 #728                    | Q6   |
| U10（sa-14）      | 選了深色之後登出，登入頁要不要也是深色？                               | **已決議（Q6）**：外觀是這台瀏覽器的偏好，全站一致，登出後的登入頁也照偏好                                                                      | Q6   |
| U11（sa-1、sa-2） | 任務角色來源本次固定回「沒有任何任務角色」，畫面上的結果               | **已決議（Q1）**：本次只做「沒有任務角色」這一支，接縫固定回答；依任務角色的 Scenario 移交 #766                                                 | Q1   |

### 交給 `planner`／`sd` 的明確事項（不需要維護者決定）

- `lib/i18n` 的 `fallbackLng` 改成 `zh-TW`（P1），`frontend-i18n` delta 寫入；預載 namespace 加 `appShell`
- 三個 aria-label（主導覽區、工具列、個人設定連結）補齊兩種語言（P2），放進 `appShell`
- 每條包在外殼裡的路由都要在 `handle` 宣告 `navKey`，缺的時候測試要失敗（P3）
- `features/auth` 抽出 `useSignOut()`；`LogoutButton` 與 `SignedInCard` 的登出 prop 移除；暫時落點不再包 `AuthLayout`
- `auth.nav.*` 兩個鍵搬到 `common`，`LanguageToggle`、`BrandMark` 的呼叫端改 import 路徑；展示頁的 `ThemeToggle` 換成 `components/theme-toggle.tsx`、拿掉 `devGallery` 的 `theme.*` 鍵與舊測試
- 新增 `components/ui/dialog.tsx` 時，元件展示頁補一節、`variant-catalog.ts` 補清單，否則完整性測試失敗
- 外殼的畫面元件放 `components/app-shell/`，規則與狀態放 `features/app-shell/`，組合在 `src/app/`；搬檔與建檔後 `node scripts/check-component-reuse.mjs` 要通過
- 外觀切換放 `components/` 是 Q5 的裁定、不是 F5 的「一個以上 feature」，在 `design.md` 依 F5 的例外寫明
- 英文介面、375px 寬的手機主導覽不截斷，以 E2E 實測（Q13）
