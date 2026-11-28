# UI Design

本份是 change `dashboard-shell`（Issue #722）的前端設計：儀表板外殼的路由、元件樹、資料來源、畫面狀態與 design token。脈絡基準是同目錄的 `system-analysis.md`（以下稱 sa）；後端側見 `system-design.md`（sd）與 `api-contract.md`；維護者的決議見 `clarification.md`（以下稱 clarification，題號寫成 Q-N）。

畫面長相以 prototype 為準，本份不重新設計。維護者 2026-11-28 已核可本單的畫面 artifact（Issue #722 檢查點留言），連同三點已決定（sa §維護者已決定）：卡 B 文案照規格寫「提交」；系統管理員本單只有區塊 A；三種任務角色版面本單只有頁首。artifact 裡區塊 B、C、D 的虛線框是審閱註記，**不是產品**，本單不畫任何佔位。prototype 的「場景模式」切換列是走查工具，**不做**（02-01 §這一頁顯示哪一種版面 的註）。

sa 與本份原先列的待決題已全部由 clarification 決議（Q1–Q10 與「不需維護者決定、依依據處理的待決項」）；本份照決議寫，決議出處標在各處，對照見 [§待決問題](#待決問題)。

## Prototype 對照

`design/prototype/pages/dashboard/` 的 `dashboard.html`、`dashboard.js`、`dashboard.i18n.js`、`dashboard.layout.css`、`dashboard.components.css`，以及它載入的 `pages/shared/card.css`、`metric.css`、`button.css` 都已實際讀過。元件與狀態對過 `design/system/pages/dashboard-dashboard.md` 與 `components/` 各份規格；畫面上找不到的狀態已查 `design/system/design-gaps.md`。

| 本次的部分                     | prototype 來源                                                                                                                                                  | 設計系統                                                                                                                                                                                                                                                                                         | 規格                                                                                        |
| :----------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| 頁首                           | `dashboard.html:47`–`:50`；`dashboard.layout.css:68`–`:86`                                                                                                      | 無專屬元件（`pages/dashboard-dashboard.md` 未列）                                                                                                                                                                                                                                                | 02-01 §這一頁顯示哪一種版面 第 5–8 條                                                       |
| 骨架                           | `dashboard.html:68`–`:97`（兩個 `.panel`：標題兩條線＋四塊指標、標題兩條線＋三列）；`dashboard.components.css:313`–`:333`（shimmer）；`dashboard.js:640`–`:651` | [Skeleton](../../../design/system/components/skeleton.md) B（shimmer）放在 [Card](../../../design/system/components/card.md) 與 [Metric](../../../design/system/components/metric.md) 裡；[UXC-08](../../../design/system/ux-conventions.md#uxc-08-skeleton-尺寸要貼合載入後的內容)              | 02-01 §這一頁顯示哪一種版面 第 9–12 條                                                      |
| 讀取失敗                       | `dashboard.html:99`–`:106`；`dashboard.components.css:335`–`:347`；文案 `dashboard.i18n.js:152`–`:154`、`:298`–`:300`；重試 `dashboard.js:654`–`:665`           | 「這一頁專屬的」`.dashboard-error-state`（`pages/dashboard-dashboard.md`）：同一組 Card 容器；與 State Panel 是各自的實作（[G-10](../../../design/system/design-gaps.md)、[G-68](../../../design/system/design-gaps.md) 已登記）；重試鈕是 [Button](../../../design/system/components/button.md) | 02-01 §這一頁顯示哪一種版面 第 13–15 條、§卡控機制                                          |
| 還沒有任務角色的版面           | `dashboard.html:111`–`:250`；`dashboard.components.css:28`–`:160`、`:380`–`:384`（外層 `.panel` 無框，只有三張卡有框）                                          | [Card](../../../design/system/components/card.md)（`.workflow-role-card` 同一組容器規則）、[Button](../../../design/system/components/button.md)（`.btn-cta`，#423 起三顆都是同一個 variant，G-37 已裁定）                                                                                       | 02-01 §還沒有任務角色的人看到什麼 第 1–8 條                                                 |
| 系統管理員區塊 A               | `dashboard.html:253`–`:280`（`.grid-3` 裡的第一個 `.panel`）；`dashboard.layout.css:159`、`:293`–`:302`                                                         | [Card](../../../design/system/components/card.md)、[Metric](../../../design/system/components/metric.md)（`.metrics-readable-labels`）                                                                                                                                                           | 02-01 §系統管理員看到的四個區塊 第 1、2、4 條                                               |
| 示範值標示                     | 只有審核員那一行：`dashboard.html:461`–`:465`；`dashboard.layout.css:305`–`:307`；`dashboard.i18n.js:143`、`:289`                                               | 無專屬元件；樣式是 `.controls-hint` 加 `.metrics-demo-note`                                                                                                                                                                                                                                      | 02-01 §審核概況那三張卡是示範值 第 2–8 條；區塊 A 的文案由 Q5 定（規格 02-01 同節回寫）     |
| 擋下說明                       | 無：prototype 沒有這個狀態；沿用 `sidebar-nav` 已落地的元件                                                                                                     | [Alert Banner](../../../design/system/components/alert-banner.md)（info，`frontend/src/components/ui/alert.tsx`）                                                                                                                                                                                | 07-01 §進入模組的條件 第 3 條、Q20；位置在頁首下方、版面內容之上（Q4，規格 07-01 同條回寫） |
| 專案負責人、審核員、標記員版面 | `dashboard.html:348`–`:480`（本次**只取頁首**，區塊不做）                                                                                                       | —                                                                                                                                                                                                                                                                                                | 02-01 §這一頁顯示哪一種版面 第 2、3、7 條；區塊由 #733、#736 補                             |

本次**不照 prototype** 的地方，依據都已定：

- **不做「場景模式」切換列**（`dashboard.html:53`–`:66`）：走查工具，02-01 §這一頁顯示哪一種版面 的註；維護者 2026-11-28 重申
- **卡 B 的說明、第 3 步名稱與第 3 步說明照規格與決議寫「提交」**：prototype 是「查看待辦任務，完成資料標記並送出結果。」「送出標記」「自我檢查標記一致性，送出標記結果」（`dashboard.i18n.js:53`、`:66`、`:67`），本次寫 `查看待辦任務，完成資料標記並提交結果。`、`提交標記`（02-01 §還沒有任務角色的人看到什麼 第 2 條；維護者 2026-11-28）、`自我檢查標記一致性，提交標記結果`（Q6）；英文維持 `submit`。這與 `design/system/brand.md` §按鈕用語「『送出』＋受詞，不用『提交』」不一致，本次照維護者的決定，`brand.md` 怎麼處理由 #814 決定（Q10），本次不改 `design/`
- **區塊 A 的四個數值不照 prototype 的 `156 人` 等**：全部是 `0 人`（Q2）
- **卡 A「開始建立任務」去任務列表，不去新增任務頁**：prototype 導向 `task-new.html`（`dashboard.js:710`–`:714`）；`docs/specs/02-dashboard/index.mdx` §Logic Flow 分段一 第 4 條定為 X2 任務列表（03-01 是任務管理模組的進入點）。路由的去處以 Logic Flow 為準，Logic Flow 與 02-01 規格沒有不一致
- **卡 B、C 的連結不帶 `view=empty`**：那是 prototype 為了落在空狀態而加的參數（`dashboard.js:325`–`:328` 的註、`docs/prototype/navigation.mdx` 第 356 列）。連結只帶入口標記與角色（04-01 §路由上下文與回退 第 1、2、11 條；`navigation.mdx` 同列）
- **不載入 `analytics.js`**：prototype 的 `LabelSuiteAnalytics.track` 是走查埋點，規格沒有
- **骨架停留時間不照 prototype 的 400ms**：那是為了讓骨架看得見而設（`dashboard.js:15`–`:18`；02-01 第 9–15 條的註「骨架顯示多久不寫進規格」）
- **區塊外框不加陰影**：prototype 的 `.panel`、`.workflow-role-card`、`.metric`、`.dashboard-error-state` 都只有邊框（`pages/shared/card.css:8`–`:15`）；`card.md` §shadcn 對照「三份實作都只有邊框、沒有陰影」。前端既有的 Card 原語帶 `--shadow-card`，本頁使用時不帶陰影（見 [§元件樹](#元件樹)）

## 頁面與路由

路由不新增、路徑不變；`/dashboard/dashboard` 的頁面元件由暫時落點 `DashboardPlaceholderPage` 換成 `DashboardPage`（Issue #722 §驗收條件 第 2 項；sa §範圍「01-01 登入後的暫時落點改回儀表板」）。

| 路由                   | 頁面                                                                                                                                                                         | 對應的規格                                                                                                                                                                                                   | 需要的角色                                                                                                                                                                    |
| :--------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard/dashboard` | `DashboardPage`（`frontend/src/pages/dashboard/dashboard-page.tsx`），畫在登入後外殼 `AppShellLayout` 的 `<Outlet>` 裡；route 的 `handle` 宣告 `navKey: "dashboard"`（不變） | 規格 02-01 §這一頁顯示哪一種版面、§還沒有任務角色的人看到什麼、§系統管理員看到的四個區塊 第 1、2、4 條、§審核概況那三張卡是示範值 第 6–8 條；07-01 §進入模組的條件 第 3、4 條；儀表板模組 Logic Flow 節點 P1 | 已登入，系統角色是平台成員或系統管理員（含 Seeder 管理員，同系統管理員）。不需要任何任務成員身分；任務角色只決定版面，不是權限（02-01 §使用角色；PRD §權限矩陣「02 儀表板」） |

### 進入、離開與返回

依 `docs/specs/02-dashboard/index.mdx` §Logic Flow；與規格 02-01 沒有不一致。

- **進入**（S → D1 → P1）：登入成功、已登入的人開登入頁、開 `/`，都已經前往這個網址（`auth-guard`、`frontend-routing` 不變）。守門判定完成前只畫頁面底色（既有）
- **D1 否 → X1 登入頁**：未登入由 `RequireAuthRoute` 處理（既有）。系統角色不在允許清單裡（`role` 不是 `user` 也不是 `super_admin`）時，頁面**不畫任何版面、不畫頁首**，以取代歷史紀錄的方式導向 `/account/login`（02-01 第 4 條），**只導向，不另外結束登入狀態**，登入頁不顯示句子（clarification sa-7）。後端對不在允許清單裡的角色，每一個需要登入的請求都回 `401 AUTH_REQUIRED`，守門已經會先把人送到登入頁，登入頁的守門也拿到同一個 `401`，不會來回；頁面的這個分支是防禦
- **P1 → X2**：卡 A「開始建立任務」→ `/task-management/task-list`（分段一 第 4 條）
- **P1 → X3**：卡 B「開始標記」→ `/annotation/annotation-list?entry=nav&role=annotator`；卡 C「開始審核」→ `/annotation/annotation-list?entry=nav&role=reviewer`（分段一 第 5、6 條；04-01 §路由上下文與回退 第 1、2、11 條）。從這兩張卡進入**不經側欄的擋下判斷**（07-01 §進入模組的條件 第 4 條、Q13）：卡片是一般連結，不掛 `AppShellLayout` 的擋下處理
- **三個去處目前都還沒建置**（03-01 屬 #730、04-01 屬 #773）：三顆按鈕照樣是連到上列最終路徑的連結，不停用、不隱藏、不加說明（Q3）；按下去照「其他路徑」經 `/` 回到儀表板，且不出現擋下說明。本次驗連結的去處與「不出現擋下說明」，「實際到達入口頁」由 #730（卡 A）與 #773（卡 B、C）補驗
- **P1 → X5／X1（側欄的個人設定、登出）**：側欄自己的連線（分段五），本頁不畫
- **被側欄擋下回到 P1**（07-01 交回 02-01）：沿用既有的 router navigation state，本頁顯示一次擋下說明，位置在頁首下方、版面內容之上（Q4）
- **返回**：本頁不定任何返回。瀏覽器上一頁回前一個路由；擋下說明讀一次就清掉（既有）
- **其他版面的出口**（「查看全部」「等待 IAA 確認」、快速繼續、快速審核、任務列；分段二～四）本次都不存在

## 常駐文件異動

- 常駐文件：`docs/diagrams/architecture/frontend-routes.mdx`（已先改好，與本份一致）

| 節                                    | 異動 | 摘要                                                                                                                                                                                                                                                  |
| :------------------------------------ | :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| frontmatter                           | 已改 | `updatedAt` 改 2026-11-28                                                                                                                                                                                                                             |
| §路由                                 | 已改 | 開頭「暫時落點」改「儀表板」；`/dashboard/dashboard` 那一列換成 `DashboardPage`，寫出頁首、擋下說明的位置、版面決定、骨架與錯誤（重試回到骨架）、行動入口卡、區塊 A（`0 人`）、規格編號與 Logic Flow 節點；表後補行動入口卡的連結與落點未建置時的去向 |
| §頁面與功能元件                       | 已改 | `DashboardPlaceholderPage` 那一列換成 `DashboardPage` 與 `features/dashboard/` 的元件；namespace 改 `dashboard`、`appShell`、`common`；只讀 `getCurrentSession`，任務角色取自前端的任務角色來源、區塊 A 是語言檔固定值，都不送請求                    |
| §前端骨架 › §目錄                     | 已改 | `build/extract-tokens.ts` 的說明加上 `data-palette.css`                                                                                                                                                                                               |
| §前端骨架 › apiFetch 的細節           | 已改 | 啟動時預載的 namespace 加 `dashboard`（儀表板是正式建置的落點，不走開發頁的動態註冊）                                                                                                                                                                 |
| §前端骨架 › §元件展示頁               | 已改 | 原語加 `metric`；`skeleton` 註明兩種動畫                                                                                                                                                                                                              |
| §前端骨架 › design token 怎麼進到元件 | 已改 | token 抽取也讀 `data-palette.css` 的 `:root` 與深色宣告（資料色，淺深兩組）；資料色只給功能元件直接用，不進 `styles/theme.css` 的 shadcn 對照                                                                                                         |
| §已知限制                             | 已改 | 開頭「暫時落點」改「儀表板的外殼」；落點頁那一列加上行動入口卡；任務角色那一列加上儀表板（任務角色來源的讀取中與失敗只在測試替身出現）；加一列「儀表板各版面的區塊」                                                                                  |
| §決策紀錄                             | 已改 | 一列 2026-11-28                                                                                                                                                                                                                                       |

## 元件樹

依 F5（`docs/development/rules/frontend-agent-rules.mdx`）與 `scripts/check-component-reuse.mjs`：

- **Metric 是共用元件**：`design/system/screen-inventory.md` 的「元件 → 畫面」表裡它被 `dashboard/dashboard`、`task-management/task-detail`、`dataset/dataset-analysis-detail` 用到，跨三個 feature；它沒有業務、換頁照樣能用，所以**新建在 `frontend/src/components/ui/metric.tsx`**，元件展示頁加一節（完整性測試要求）。`metric.md` 與 `screen-inventory.md` 的「程式實作」要同步改（見 [§設計系統異動](#設計系統異動)）
- **其餘都只有儀表板用到**，放 `frontend/src/features/dashboard/`：錯誤面板（`pages/dashboard-dashboard.md` 列為「這一頁專屬的」`.dashboard-error-state`）、行動入口卡、骨架的佈局、區塊 A。檔名照檢查腳本第 3 條：名字和共用元件同尾字的（`*-card`、`*-skeleton`）一定 import 對應的 `components/ui/` 實作；錯誤面板取名 `dashboard-load-error.tsx`，避開 `*-state`（Empty State）、`*-panel`（State Panel）、`*-alert`（alert.tsx）
- **版面決定是純函式**，放 `features/dashboard/dashboard-view.ts`：輸入系統角色與任務角色來源的狀態，輸出一種版面（見 [§資料來源 › 狀態放哪裡](#狀態放哪裡)）
- **頁面是組合層**：`pages/dashboard/` 依 F1 可以 import 多個 feature；它向 `features/auth` 取系統角色、向 `features/app-shell` 取任務角色來源與擋下說明，交給 `features/dashboard`。`features/dashboard` 不 import 其他 feature
- **移除**：`frontend/src/pages/dashboard-placeholder/`（整個資料夾）與只被它用到的 `features/auth/signed-in-card.tsx`、`auth` 語言檔的 `dashboard.*` 鍵。`openspec/specs/auth-guard/` Requirement「暫時落點顯示目前登入者」由 planner 寫成 REMOVED

由上而下的順序是**頁首 → 擋下說明 → 版面區**（Q4）：

```text
DashboardPage                     pages/dashboard/dashboard-page.tsx：新建；設 document.title「Label Suite — 儀表板」
│                                 （common 的 documentTitle）；系統角色無效時只回傳導向登入頁、不畫下列任何東西
├─ DashboardHeader                設計系統無：新建，放 frontend/src/features/dashboard/dashboard-header.tsx
│  ├─ 主標題 h1「儀表板」
│  └─ 副標題 p「掌握任務進度與團隊協作狀態」
├─ BlockedNotice                  alert-banner.md：沿用 frontend/src/features/app-shell/blocked-notice.tsx（以 components/ui/alert.tsx 的 info 畫）；
│                                 只在被側欄擋下帶回來時出現一次，緊接在頁首下方
└─ 版面區（依 resolveDashboardView 的結果只畫一種；loading 時不畫其他任何版面）
   ├─ [loading] DashboardSkeleton            skeleton.md：新建，放 frontend/src/features/dashboard/dashboard-skeleton.tsx
   │  │                                      佈局照 dashboard.html:68–:97，沿用 frontend/src/components/ui/skeleton.tsx 的 shimmer 變體（新增，見下）
   │  ├─ 狀態提示（可存取名稱「載入中」）       可程式聚焦，重試後焦點移到這裡（見 §互動與鍵盤）
   │  ├─ 區塊外框 ×1：標題兩條線、四格指標      card.md：沿用 frontend/src/components/ui/card.tsx（不帶陰影）
   │  │                                      metric.md：每格是 components/ui/metric.tsx 的外框，內放一條骨架
   │  └─ 區塊外框 ×1：標題兩條線、三列          card.md：沿用 frontend/src/components/ui/card.tsx（不帶陰影）
   ├─ [error] DashboardLoadError             設計系統無專屬規格（pages/dashboard-dashboard.md「這一頁專屬的」.dashboard-error-state）：
   │  │                                      新建，放 frontend/src/features/dashboard/dashboard-load-error.tsx
   │  ├─ 外框                                card.md：沿用 frontend/src/components/ui/card.tsx（不帶陰影、內容置中）
   │  ├─ 圖示                                Lucide CircleAlert（prototype 的 svg 是同一個字形）
   │  ├─ 標題「儀表板載入失敗」、說明「無法載入任務成員資格資料，請稍後再試。」
   │  └─ 重試鈕「重試」                        button.md：沿用 frontend/src/components/ui/button.tsx（variant cta）；
   │                                         按下後版面區回到骨架（clarification U1），不在按鈕上顯示送出中
   ├─ [noTaskRole] ActionEntrySection        設計系統無：新建，放 frontend/src/features/dashboard/action-entry-section.tsx
   │  │                                      外層不加框（dashboard.components.css:380–:384）
   │  ├─ 區塊標題 h2「開始你的第一個工作流程」、副標「從三個行動入口開始，快速達成第一個可交付成果」
   │  └─ ActionEntryCard ×3（A、B、C）         card.md：新建，放 frontend/src/features/dashboard/action-entry-card.tsx，
   │     │                                   外框沿用 frontend/src/components/ui/card.tsx（不帶陰影、內容置中）；三張的資料由一份宣告陣列提供
   │     ├─ 角色圓形圖示                       Lucide Users／Tag／FileText，裝飾（aria-hidden）；配色取 data-palette.css 的角色色（Q8）
   │     ├─ 卡標題 h3、說明 p
   │     ├─ 三步驟（有序清單 ol）              每步：圓形圖示（裝飾）、步驟名稱、步驟說明；步驟之間 Lucide ArrowRight（裝飾）
   │     └─ 行動按鈕（整寬，導覽連結）          button.md：沿用 frontend/src/components/ui/button.tsx（variant cta，asChild 包 React Router Link）；
   │                                         連到最終路徑（Q3），不停用、不隱藏
   ├─ [systemAdmin] 全平台版面               設計系統無：版面容器照 .grid-3（自動排欄）；本次只有區塊 A
   │  └─ PlatformUserStats                   設計系統無：新建，放 frontend/src/features/dashboard/platform-user-stats.tsx
   │     ├─ 外框                              card.md：沿用 frontend/src/components/ui/card.tsx（不帶陰影）
   │     ├─ 區塊標題 h2「平台使用者統計」、副標「系統概況」
   │     ├─ 指標卡 ×4（總用戶、專案負責人、標記員、審核員），數值都是「0 人」（Q2）
   │     │                                   metric.md：新建，放 frontend/src/components/ui/metric.tsx（共用，見上）
   │     └─ 示範值標示 p                       設計系統無：同一個區塊裡、指標卡下方；文案照 Q5
   └─ [projectLeader | reviewer | annotator] 不畫任何東西（只有頁首；維護者 2026-11-28）
```

**原語的兩處擴充**（`components/ui/`，展示頁跟著加，否則完整性測試失敗）：

- `metric.tsx`：新原語。結構照 `metric.md` §結構 與 `pages/shared/metric.css`：外框、標籤（在上，小字）、數值（在下，大字）。標籤與數值由呼叫端以字串傳入，原語不知道單位與語言；`.metric-desc`、`.metric-lg` 本次用不到，不做
- `skeleton.tsx`：加一個 shimmer 變體（`skeleton.md` 的 B），預設仍是現有的 pulse，現有用法不變。本頁照 prototype 用 shimmer（`dashboard.components.css:319`–`:329`，`skeleton.md` §用到它的畫面 記為與正典逐字相同）。使用者開啟「減少動態效果」時不播光帶（F9）

**Card 不帶陰影**：用 `className` 覆寫掉陰影，不改 `card.tsx` 本身，也不新增 variant（只有本頁用到；改原語會動到既有的健康檢查卡片與展示頁樣本）。

## 資料來源

這一頁只讀、不寫（PRD §權限矩陣「02 儀表板」只有 `R`）。沒有 mutation，所以沒有要 invalidate 的查詢。**本次不新增任何請求**（Q1、Q2）：唯一讀到後端的是既有的 `getCurrentSession`；`api-contract.md` 的 `getTaskRoleSummary`、`getPlatformUserSummary` 記為未採用。

| 區塊                 | 需要的資料                                                                                                                                                                                  | operationId                                                                                                                  | 快取鍵／失效時機                                                                                                                                           |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 系統角色（版面決定） | 目前登入者的 `role`（`user`／`super_admin`）                                                                                                                                                | `getCurrentSession`（已存在）                                                                                                | `getGetCurrentSessionQueryKey()`，與守門、外殼共用同一份快取（`features/auth` 的 `useSessionState`）；`staleTime` 無限、換頁時由外殼背景重查（既有，不改） |
| 任務角色（版面決定） | 目前登入者在任何任務擁有的任務角色：專案負責人、審核員、標記員各有沒有（02-01 §資料欄位「任務角色摘要」是三個計數，版面只需要「有沒有」）。**只要角色，不要任務識別碼、任務名稱或任務類型** | 無，不送請求：沿用 `features/app-shell` 既有的任務角色來源 `useTaskRoleSource()`，它目前對每個人都回答「沒有任務角色」（Q1） | 無快取。系統管理員不讀任務角色（02-01 §卡控機制）                                                                                                          |
| 區塊 A 的四個數值    | `總用戶`、`專案負責人`、`標記員`、`審核員` 四個示範值                                                                                                                                       | 無，不送請求：`dashboard` 語言檔的固定字串，四個都是 `0 人`（Q2）                                                            | 無                                                                                                                                                         |
| 頁首、行動入口卡     | 無：固定文案（`dashboard` 語言檔）                                                                                                                                                          | 無                                                                                                                           | 無                                                                                                                                                         |
| 擋下說明             | 被擋下的是哪一項（router navigation state，既有）                                                                                                                                           | 無                                                                                                                           | 不進網址、不進快取（既有）                                                                                                                                 |

**任務角色來源要補的三種狀態**（Q1）：儀表板要從任務角色來源知道三件事——**讀取中**、**讀取失敗（附一個重試動作）**、**完成（擁有哪些任務角色）**。現有的 `useTaskRoleSource()` 只回答「完成」那一種，所以來源的回傳要擴充成這三種狀態之一；這一次正式環境恆為「完成、一個任務角色都沒有」，讀取中與失敗只在測試替身裡出現，用來驗骨架、錯誤畫面與重試。側欄讀同一個來源，本次側欄的行為不變；#766 接上真的讀取時，只換來源本身，儀表板與側欄不動。回傳的形狀由 design 定。

### 狀態放哪裡

| 狀態       | 放哪裡                                                                                                                                                                                  | 理由                                                                                    |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| 系統角色   | 伺服器狀態：TanStack Query（`getCurrentSession`，既有）                                                                                                                                 | 與守門、側欄同一個來源                                                                  |
| 任務角色   | 任務角色來源（`features/app-shell`），提供讀取中／失敗（附重試）／完成三種狀態（見上）                                                                                                  | 02-01 第 9–15 條要求這三種畫面；側欄與儀表板讀同一個來源，#766 接上真實讀取時兩邊一起變 |
| 版面       | 不存，每次 render 由 `resolveDashboardView(系統角色, 任務角色狀態)` 算出：`invalidRole`、`systemAdmin`、`loading`、`error`、`noTaskRole`、`projectLeader`、`reviewer`、`annotator` 之一 | 純函式，好測；優先序固定為專案負責人 > 審核員 > 標記員（02-01 第 3 條）                 |
| 擋下說明   | router navigation state（既有）                                                                                                                                                         | 不進網址                                                                                |
| URL 狀態   | **無**。這一頁沒有篩選、搜尋、排序或分頁；版面不能由網址指定（02-01 §卡控機制「全平台範圍不得來自網址參數」；prototype 的 `?scenario=`、`?view=` 是走查工具，不做）                     | —                                                                                       |
| 純 UI 狀態 | 只有「這次骨架是不是由重試觸發」一個旗標，放在頁面（或版面區）內，用來決定焦點去處（見 [§互動與鍵盤](#互動與鍵盤)）                                                                     | 重試後版面區回到骨架、錯誤面板卸載，旗標不能放在錯誤面板裡                              |
| 全域 store | **不需要**：上列每一種都已有擁有者                                                                                                                                                      | —                                                                                       |

## 畫面狀態

### 版面區（任務角色的讀取；只有平台成員）

| 狀態          | 呈現                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| :------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| loading       | 頁首照常顯示；版面區畫 `DashboardSkeleton`：「指標卡加任務列表」的佈局（02-01 第 10 條），尺寸照 prototype 的骨架（UXC-08）。不畫三張行動入口卡、不畫任何任務角色版面。讀完直接換成實際版面，中間不出現空白（第 11、12 條）；骨架與最終版面不同（最後是行動入口卡）時也直接換。這一次正式環境到不了，只在測試替身出現（Q1）                                                                                                                                                                                                                         |
| error         | `DashboardLoadError`：圖示、`儀表板載入失敗`、`無法載入任務成員資格資料，請稍後再試。`、`重試`（第 13、15 條）。觸發：任務角色來源回報失敗（之後接上真實讀取時是伺服器錯誤或逾時）。**三個禁止**（第 14 條）：不改成三張行動入口卡、不清掉登入狀態、不導向登入頁。文字固定取語言檔，不顯示後端的 `message`、`code` 或 `traceId`。按 `重試` 後版面區**回到骨架**（第 9 條；clarification U1），結果回來前不再有可按的 `重試`，所以不會重複觸發；再失敗時回到同一個錯誤畫面，`重試` 還在（Scenario 17）。這一次正式環境到不了，只在測試替身出現（Q1） |
| empty         | 「一個任務角色都沒有」就是這一頁的空：畫三張行動入口卡（02-01 A1、第 1–8 條），不是一個空的任務列表（§邊界情況）。這一次正式環境的平台成員一律落在這裡                                                                                                                                                                                                                                                                                                                                                                                              |
| 無權限（403） | 不會發生：「檢視儀表板」兩種系統角色都是固定開（06-02 §固定格不能改），而本次除了 `getCurrentSession` 不送任何請求，`getCurrentSession` 的 403 不在儀表板的路徑上（clarification U4）。不畫無權限畫面                                                                                                                                                                                                                                                                                                                                               |
| 欄位被遮蔽    | 無：版面決定只用角色，不顯示任何任務資料                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### 區塊 A `平台使用者統計`（只有系統管理員）

系統管理員不讀任務角色（02-01 §卡控機制），版面區直接畫全平台版面，**不經過**上面的骨架與錯誤。區塊 A 的數值是語言檔的固定字串（Q2），所以：

| 狀態          | 呈現                                                  |
| :------------ | :---------------------------------------------------- |
| loading       | 不會發生：一進來就畫（Q2；sa-8 不成立）               |
| error         | 不會發生：沒有讀取                                    |
| empty         | 不會發生：四張卡永遠都在，數值都是 `0 人`，不是空狀態 |
| 無權限（403） | 不會發生：沒有讀取                                    |
| 欄位被遮蔽    | 無                                                    |

四張卡下方有看得見的示範值標示 `示範用靜態值：這些指標卡尚未接上實際資料，算法另案定義。`（Q5；02-01 §審核概況那三張卡是示範值 第 2、4、6 條）：只放在 tooltip 或 `aria-*` 不算；不改卡片自己的標籤與數值（第 7 條）。

### 頁首、行動入口卡、擋下說明

不取資料的靜態區塊，沒有四種狀態（F8 例外）。頁首在每一種版面都顯示，包括 loading 與 error（第 5、7 條）；只有 `invalidRole` 不畫（直接導向登入頁）。擋下說明出現時在頁首正下方、版面區之上（Q4），不論版面區是骨架、錯誤或實際版面。

### 測試集答案不外露（Hard Rule 6）

02-01 §這一頁看不到標準答案 第 1–4 條涵蓋標記員在這一頁能接觸到的一切。本次能接觸到的是：頁首、三張行動入口卡、區塊 A、骨架、錯誤畫面、擋下說明，以及卡片連結交給下一頁的網址參數。

- 這幾個畫面都不讀、不顯示任何任務資料：文案全部是語言檔的固定字串，區塊 A 是寫死的 `0 人`
- 本次發出的請求只有既有的 `getCurrentSession`，用到的只有登入者自己的系統角色；任務角色來源不送請求
- 骨架是灰色方塊，不帶任何資料；錯誤畫面不顯示後端的訊息、錯誤碼或 `traceId`
- 卡片連結只帶 `entry=nav` 與 `role`，不帶任務、任務類型、輸出類型或任何答案相關的值（04-01 §路由上下文與回退 第 1 條；Hard Rule 5 也一併守住）

## 元件與 design token

圖示一律 Lucide（`lucide-react`），裝飾性圖示加 `aria-hidden`，顏色由 `currentColor` 繼承。prototype 的 `assets/icons/*.svg` 與內嵌 svg 對到的 Lucide 名稱如下（字形逐一比對過）：

| 位置                | Lucide                                   |
| :------------------ | :--------------------------------------- |
| 卡 A 角色圖示／三步 | `Users`；`Plus`、`CloudUpload`、`Users`  |
| 卡 B 角色圖示／三步 | `Tag`；`Folder`、`SquarePen`、`Send`     |
| 卡 C 角色圖示／三步 | `FileText`；`Eye`、`Check`、`ListChecks` |
| 步驟之間            | `ArrowRight`                             |
| 錯誤面板            | `CircleAlert`                            |
| 擋下說明            | `Info`（既有）                           |

### 用途 → 語意 token

只列 `tokens.css` 的語意名稱，另加行動入口卡的角色色（`data-palette.css`，Q8）。prototype 不在刻度上的字級照 Q9 對到「最接近且不大於」的 token（G-66 的規則）；版面寬度、圓形與圖示尺寸、箭頭不透明度不屬品牌刻度，照 prototype 的字面值（Q9）。

| 用途                             | token                                                                                                                                                                                                                                                                                                                  |
| :------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 頁面底色                         | `--color-surface`（外殼已提供）                                                                                                                                                                                                                                                                                        |
| 內容區最大寬度與內距             | 最大寬度 1280px（`brand.md` §設計決策）；內距 `--space-lg`，手機 `--space-md`、底部 `--space-xl`（`dashboard.layout.css:57`、`dashboard.components.css:247`）                                                                                                                                                          |
| 頁首主標題                       | `--font-serif-display`、粗 700、`--color-ink`、`--text-h2`（prototype 28px，Q9）；下距 `--space-xs`                                                                                                                                                                                                                    |
| 頁首副標題                       | `--text-caption`、`--color-text-soft`                                                                                                                                                                                                                                                                                  |
| 頁首、擋下說明、版面區之間的間距 | `--space-lg`                                                                                                                                                                                                                                                                                                           |
| 區塊外框（Card）                 | 框線 `--color-border`、圓角 `--radius-lg`、底 `--color-white`、內距 `--space-lg`；**不加** `--shadow-card`                                                                                                                                                                                                             |
| 區塊內子元素間距                 | `--space-md`                                                                                                                                                                                                                                                                                                           |
| 區塊標題（h2）                   | 粗 600、`--color-ink`、`--text-body`（prototype 1.05rem，Q9）                                                                                                                                                                                                                                                          |
| 區塊副標                         | `--text-caption`、`--color-ink-muted`；上距 `--space-xs`                                                                                                                                                                                                                                                               |
| 指標卡（Metric）                 | 內距 `--space-md`、圓角 `--radius-lg`、底 `--color-white`、框線 `--color-border`；格線間距 `--space-md`                                                                                                                                                                                                                |
| 指標卡標籤                       | 粗 600、`--color-ink-muted`、大寫、下距 `--space-xs`、`--text-label`（prototype 11px，Q9）；字距照 prototype 的 0.04em（不屬品牌刻度）                                                                                                                                                                                 |
| 指標卡數值                       | 粗 700、`--color-ink`、`--leading-tight`、`--text-h3`（prototype 1.35rem，Q9）                                                                                                                                                                                                                                         |
| 示範值標示                       | `--text-caption`、`--color-ink-muted`；上距 `--space-sm`                                                                                                                                                                                                                                                               |
| 行動入口卡外框                   | 框線 `--color-border`、圓角 `--radius-lg`、底 `--color-white`；內距上 `--space-lg`、左右下 `--space-md`；子元素間距 `--space-xs`；三張卡之間 `--space-md`                                                                                                                                                              |
| 角色圓形圖示、步驟圓形圖示       | `--radius-full`；底色與前景色 `--data-role-emerald-bg`／`-fg`（卡 A）、`--data-role-violet-*`（卡 B）、`--data-role-indigo-*`（卡 C），淺深兩組都取自 `data-palette.css`（Q8）；淺色主題下部分步驟圖示前景改 `--color-ink`（`dashboard.components.css:118`）；圓形 72px／44px、圖示 32px／20px（prototype 字面值，Q9） |
| 行動入口卡標題（h3）             | 粗 700、`--color-ink`、`--text-body`（prototype 1.0625rem，Q9）                                                                                                                                                                                                                                                        |
| 行動入口卡說明                   | `--color-ink-muted`、`--text-label`（prototype 0.8125rem，Q9）；下距 `--space-xs`                                                                                                                                                                                                                                      |
| 步驟名稱                         | `--text-label`、粗 700、`--color-ink`、`--leading-tight`                                                                                                                                                                                                                                                               |
| 步驟說明                         | `--color-ink-muted`、`--leading-snug`、`--text-label`（prototype 0.6875rem，Q9）                                                                                                                                                                                                                                       |
| 步驟之間的箭頭                   | `--color-ink`，不透明度照 prototype 的字面值：淺色 0.4、深色 0.45（Q9）                                                                                                                                                                                                                                                |
| 行動按鈕、重試鈕                 | Button `cta`：`--color-cta`、`--color-on-cta`、hover `--color-cta-hover`、圓角 `--radius-md`、`--text-caption`、粗 600；行動按鈕整寬                                                                                                                                                                                   |
| 焦點環                           | `outline: 2px solid` `--color-primary`、外推 2px（`dashboard.layout.css` 的 `.btn:focus-visible`，G-37 #423 修正後的寫法）                                                                                                                                                                                             |
| 骨架                             | shimmer：`--color-border` 與 `--color-border-muted` 的漸層、圓角 `--radius-md`；尺寸是逐處量的字面值（UXC-08，不 token 化）                                                                                                                                                                                            |
| 錯誤面板                         | Card 容器；內距上下 `--space-2xl`、左右 `--space-lg`；子元素間距 `--space-sm`；圖示 `--color-error`；標題 `--text-body`、粗 700；說明 `--color-ink-muted`、`--text-label`（prototype 13px，Q9）                                                                                                                        |
| 擋下說明                         | Alert `info`：`--color-info`、`--color-info-bg`、`--color-info-border`（既有）                                                                                                                                                                                                                                         |
| 動態                             | hover 過場 `--dur-fast`、`--ease-standard`；「減少動態效果」時骨架不播光帶、按鈕 hover 不位移（F9）                                                                                                                                                                                                                    |
| 字體與行高                       | `--font-sans`；中文 `--leading-body-zh`、英文 `--leading-body`（隨 `<html lang>`，既有）                                                                                                                                                                                                                               |

**角色色的接法**（Q8）：前端的 token 抽取除了 `tokens.css`，也讀 `data-palette.css` 的 `:root` 與 `html[data-theme="dark"]` 宣告，淺深兩組都要；`--data-role-emerald-fg` 在淺色主題是 `var(--color-cta-hover)`，所以兩份要一起載入。資料色只給 `features/dashboard` 的角色圓形直接用，**不**進 `styles/theme.css` 的 shadcn 語意對照、`components/ui/` 原語也不讀它；這樣 shadcn 的語意色仍只有 `tokens.css` 一個來源，維持在 ADR-005 D4 的範圍內。抽取與對照怎麼擴充由 design 定；design 若判斷超出 D4 的範圍，依 Q8 停下回報。

### 文案（`dashboard` 語言檔；中英兩種都要）

取自 `dashboard.i18n.js`、規格與 clarification；中英不一致時中文以規格為準。

| 鍵的用途              | zh-TW                                                                                                | en                                                                                                                                     | 來源                                                        |
| :-------------------- | :--------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| 瀏覽器標題的頁名      | `儀表板`（經 `common` 的 `documentTitle` 組成 `Label Suite — 儀表板`）                               | `Dashboard`                                                                                                                            | `dashboard.i18n.js` `dashboardMainTitle`                    |
| 頁首主標題／副標題    | `儀表板`／`掌握任務進度與團隊協作狀態`                                                               | `Dashboard`／`Track task progress and team collaboration at a glance`                                                                  | 02-01 第 6 條；i18n.js                                      |
| 骨架區塊的可存取名稱  | `載入中`                                                                                             | `Loading`                                                                                                                              | 沿用 `auth` 的 `loading` 同一句                             |
| 錯誤標題／說明／重試  | `儀表板載入失敗`／`無法載入任務成員資格資料，請稍後再試。`／`重試`                                   | `Failed to load dashboard`／`Task membership data could not be loaded. Please try again.`／`Retry`                                     | 02-01 第 15 條；i18n.js                                     |
| 區塊標題／副標        | `開始你的第一個工作流程`／`從三個行動入口開始，快速達成第一個可交付成果`                             | `Start Your First Workflow`／`Use these three action entry points to reach your first success quickly.`                                | 02-01 §還沒有任務角色的人看到什麼 第 1 條                   |
| 卡 A 標題／說明／按鈕 | `建立標記專案`／`上傳資料、設定標籤規則、指派團隊成員。`／`開始建立任務`                             | `Create Labeling Project`／`Upload data, set labeling rules, and assign team members.`／`Start Creating Task`                          | 同節第 2 條                                                 |
| 卡 A 三步名稱         | `建立任務`、`上傳資料`、`指派人員`                                                                   | `Create Task`、`Upload Data`、`Assign Team`                                                                                            | 同上                                                        |
| 卡 B 標題／說明／按鈕 | `進行資料標記`／**`查看待辦任務，完成資料標記並提交結果。`**／`開始標記`                             | `Conduct Data Labeling`／`View pending tasks, complete data labeling, and submit results.`／`Start Annotating`                         | 同上；維護者 2026-11-28                                     |
| 卡 B 三步名稱         | `開啟任務`、`進行標記`、**`提交標記`**                                                               | `Open Task`、`Annotate`、`Submit Annotation`                                                                                           | 同上                                                        |
| 卡 C 標題／說明／按鈕 | `進行標記審核`／`逐標記員獨立審核，直接修正結果，歧異交付仲裁。`／`開始審核`                         | `Conduct Labeling Review`／`Review each annotator independently, correct results directly, and arbitrate disputes.`／`Start Reviewing` | 同上                                                        |
| 卡 C 三步名稱         | `審核標記`、`修正或仲裁`、`完成審核`                                                                 | `Review Annotations`、`Correct or Arbitrate`、`Complete Review`                                                                        | 同上                                                        |
| 九句步驟說明          | 照 `dashboard.i18n.js:57`–`:73` 原文，唯一例外是卡 B 第 3 句：**`自我檢查標記一致性，提交標記結果`** | 照 `dashboard.i18n.js:203`–`:219` 原文（卡 B 第 3 句維持 `Self-check consistency, then submit results`）                               | 只是文案、不是規格（02-01 第 5 條、Q16）；卡 B 第 3 句見 Q6 |
| 區塊 A 標題／副標     | `平台使用者統計`／`系統概況`                                                                         | `Platform Stats`／`System overview`                                                                                                    | 02-01 §系統管理員看到的四個區塊 第 1 條                     |
| 區塊 A 四個標籤       | `總用戶`、`專案負責人`、`標記員`、`審核員`                                                           | `Total Users`、`Project Leaders`、`Annotators`、`Reviewers`                                                                            | 同節第 2 條                                                 |
| 區塊 A 四個數值       | `0 人`、`0 人`、`0 人`、`0 人`                                                                       | `0 Users`、`0 Leaders`、`0 Annotators`、`0 Reviewers`                                                                                  | Q2；英文的單位字沿用 `dashboard.i18n.js:226`–`:232`         |
| 區塊 A 示範值標示     | `示範用靜態值：這些指標卡尚未接上實際資料，算法另案定義。`                                           | `Demo static values: these metric cards are not yet connected to real data; how they are calculated is defined separately.`            | Q5（規格 02-01 §審核概況那三張卡是示範值 回寫）             |

卡片的標題、說明、三步名稱與按鈕文字都在語言檔裡，切換語言時一起換（02-01 第 4 條、Scenario「行動入口卡切換語言」）。某個鍵缺英文時顯示繁體中文原文、不中斷互動（`frontend-i18n` 既有的備用規則，02-01 §導覽、語言與登出不在這一頁 第 5 條）。中文文案用「你」（`brand.md` §稱謂），上表已符合。

## 互動與鍵盤

- **Tab 順序**：頁首與擋下說明都不可聚焦；版面區內，還沒有任務角色的版面依序是卡 A、卡 B、卡 C 的行動按鈕；錯誤畫面只有 `重試`；系統管理員版面與只有頁首的版面沒有可聚焦的控制項。指標卡、示範值標示不可聚焦
- **行動按鈕是導覽連結**（`<a href>`，外觀是按鈕）：Enter 觸發；按住 Ctrl／⌘ 或中鍵交給瀏覽器開新分頁（與側欄的連結一致）
- **重試**：原生 `<button>`，Enter／Space 觸發。按下後錯誤面板卸載、版面區回到骨架，**焦點移到骨架區的狀態提示**（clarification U1；狀態提示可程式聚焦、不在 Tab 順序裡），所以焦點不會掉回頁面開頭；結果回來前沒有可按的 `重試`，不會重複觸發（UXC-06）
- **重試觸發的骨架被換掉時**：焦點跟著移到新內容，不掉回 `<body>`——再失敗時移到錯誤面板的 `重試`，成功時移到新版面的區塊標題（可程式聚焦）
- **首次載入不搶焦點**：不是由重試觸發的骨架換成實際版面時，焦點不移動
- **焦點可見**：每個控制項都有焦點環（02-01 §在窄螢幕上的呈現 第 7 條；`design-gaps.md` G-05 記的是 prototype 正典按鈕缺焦點樣式，本頁照 `dashboard.layout.css` 的 `.btn:focus-visible` 補上）

## 響應式

斷點照 `brand.md` §設計決策：手機 `max-width: 767px`／桌面 `min-width: 768px`（prototype `dashboard.components.css:246` 同值）。任何寬度都不需要左右滑動（02-01 §在窄螢幕上的呈現 第 1 條）。

| 區塊                 | 桌面                                                                                                                                                                       | 手機（≤ 767px）                                                                                  |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| 內容區               | 最大寬度 1280px、置中、內距 `--space-lg`                                                                                                                                   | 內距 `--space-md`、底部 `--space-xl`；內容不被外殼的上方品牌列與下方主導覽遮住（外殼既有的內縮） |
| 擋下說明             | 頁首下方、整寬                                                                                                                                                             | 同左                                                                                             |
| 三張行動入口卡       | 三欄等寬（`dashboard.components.css:29`）                                                                                                                                  | 一欄直排（`:269`）                                                                               |
| 全平台版面的區塊容器 | 自動排欄，每欄最窄 300px（`.grid-3`，`dashboard.layout.css:159`）；本次只有區塊 A，所以它佔滿整列，之後 B、C 加入時自然排成三欄                                            | 一欄                                                                                             |
| 區塊 A 的四張指標卡  | 自動排欄，每欄最窄 150px（`.metrics-readable-labels`，`dashboard.layout.css:299`）：側欄收合、空間變寬時維持可讀寬度，欄寬不夠就換列，`專案負責人` 不被壓成窄欄（第 6 條） | **固定兩欄**，前兩張同一列，不退化成一張一張直排（第 2 條、Scenario「窄螢幕指標卡排兩欄」）      |
| 區塊標題列           | 標題與動作分置兩端（本次沒有動作）                                                                                                                                         | 直向排列                                                                                         |
| 骨架                 | 與桌面同結構；四格指標在手機同樣兩欄                                                                                                                                       | 同左                                                                                             |

300px、150px 欄寬與 72px、44px 圓形是 prototype 的版面尺寸，不屬品牌刻度，照字面值（Q9）。

## 無障礙

- **地標與標題層級**：外殼已提供 `<main>`，本頁不再畫 `<main>`（prototype 的 `<main class="layout">` 由外殼取代）。頁首是 `aria-labelledby` 指向 h1 的區段，排在最上方，擋下說明緊接其後（Q4）；區塊標題 h2；行動入口卡標題 h3；步驟是有序清單（三步有先後）
- **骨架**：容器帶 `aria-busy="true"` 與 `aria-live="polite"`；內有一個可存取名稱「載入中」、可程式聚焦（`tabindex="-1"`）的狀態提示，重試後焦點移到它；每條骨架本身 `aria-hidden`（`components/ui/skeleton.tsx` 既有）。讀完時容器卸載、版面出現
- **錯誤面板**：`role="alert"`（`dashboard.html:99`），出現時朗讀標題與說明；重試後再失敗時重新掛載，再朗讀一次
- **示範值標示**：一般文字，眼睛看得到，不是 tooltip 或 `aria-*`（02-01 第 4 條）
- **圖示**：全部是裝飾，`aria-hidden`；意思由旁邊的文字表達，不只靠顏色
- **對比**：次要文字最淺用 `--color-ink-muted`；主色不當文字用；按鈕文字 `--color-on-cta` 壓 `--color-cta`（`tokens.css` 已處理過 WCAG AA）。角色色（Q8）的前景對底色在淺深兩組都要確認至少 3:1（圖示）
- **減少動態效果**：骨架不播光帶、按鈕 hover 不位移（F9）。prototype 的 `dashboard.components.css` 沒有 `prefers-reduced-motion`，前端照 F9 補，不是新的設計差異
- **語言**：`<html lang>` 隨語言切換（既有），行高跟著換

## 設計系統異動

規劃階段不改 `design/system/`；以下由 apply 階段的 `frontend-developer` 在實作同一個 PR 裡改（檢查腳本第 1 條要求「程式實作」寫的路徑存在，所以不能在檔案建立前先改）：

| 檔案                                   | 異動                                                                   |
| :------------------------------------- | :--------------------------------------------------------------------- |
| `design/system/components/metric.md`   | 「程式實作」由「尚未實作」改為 `frontend/src/components/ui/metric.tsx` |
| `design/system/screen-inventory.md`    | 「元件 → 畫面」表 Metric KPI Tile 那一列的「程式實作」欄同上           |
| `design/system/components/skeleton.md` | 「程式實作」路徑不變；在 §變體 或 §shadcn 對照 註明前端兩個變體都有了  |

「提交」與 `brand.md` §按鈕用語 的不一致由 #814 處理（Q10），本次不改 `brand.md` 與 `design-gaps.md`。

## 待決問題

本份沒有未決的問題。原先列的題目都已由 clarification 決議，對照如下：

| 原題號 | 簡述                               | 決議出處                                                      | 落在本份哪裡                                                       |
| :----- | :--------------------------------- | :------------------------------------------------------------ | :----------------------------------------------------------------- |
| sa-1   | 平台成員的任務角色從哪裡讀         | Q1：沿用前端既有的任務角色來源，補三種狀態，不送請求          | §資料來源、§狀態放哪裡、§畫面狀態                                  |
| sa-2   | 三張卡的去處頁不存在時按鈕怎麼表現 | Q3：連到最終路徑，實際到達由 #730、#773 補驗                  | §進入、離開與返回                                                  |
| sa-3   | 區塊 A 的示範值怎麼來、是哪幾個數  | Q2：語言檔固定字串，全部 `0 人`                               | §資料來源、§區塊 A、§文案                                          |
| sa-4   | 區塊 A 的示範值標示文案            | Q5                                                            | §區塊 A、§文案                                                     |
| sa-5   | 擋下說明與頁首的順序               | Q4：頁首在上，擋下說明緊接其下                                | §元件樹、§頁首、行動入口卡、擋下說明、§無障礙                      |
| sa-6   | 卡 B 第 3 步說明句                 | Q6                                                            | §Prototype 對照、§文案                                             |
| sa-7   | 系統角色無效時要不要結束登入狀態   | clarification「不需維護者決定」表：只導向登入頁               | §進入、離開與返回                                                  |
| sa-8   | 系統管理員進入時要不要骨架         | 不成立（Q2）                                                  | §區塊 A                                                            |
| U1     | 重試期間畫什麼                     | clarification「不需維護者決定」表：回到骨架，焦點移到狀態提示 | §畫面狀態、§互動與鍵盤、§無障礙                                    |
| U2     | 行動入口卡的角色色                 | Q8：讀 `data-palette.css`，淺深兩組，須在 ADR-005 D4 範圍內   | §用途 → 語意 token、§角色色的接法；`frontend-routes.mdx` §前端骨架 |
| U3     | 不在刻度上的字級與尺寸             | Q9：照 G-66 取最接近且不大於；版面尺寸照字面值                | §用途 → 語意 token、§響應式                                        |
| U4     | 讀取收到 403 怎麼畫                | 不成立（clarification「不需維護者決定」表）                   | §畫面狀態                                                          |

### 交給 `planner`／`sd` 的明確事項（不需要維護者決定）

- `auth-guard` Requirement「暫時落點顯示目前登入者」整條被取代（「你已登入」卡片、「儀表板還在建置中」、瀏覽器標題「你已登入」），planner 寫 REMOVED；`DashboardPlaceholderPage`、`SignedInCard`、`auth` 語言檔的 `dashboard.*` 鍵一起刪
- `app-shell-sidebar` 的擋下說明位置改為「頁首下方、版面內容之上」，planner 寫 MODIFIED（Q4）
- 新增 namespace `dashboard`，在啟動時預載（與 `common`、`auth`、`appShell` 同一批）；`frontend-i18n` 的鍵集合測試會涵蓋它
- 元件展示頁加 `metric` 一節與 `skeleton` 的 shimmer 樣本；完整性測試會檢查
- 任務角色來源的回傳擴充成讀取中／失敗（附重試）／完成三種狀態，正式環境恆為「完成、沒有任務角色」，側欄行為不變；形狀由 design 定（Q1）
- token 抽取讀 `data-palette.css`，資料色不進 shadcn 對照；是否在 ADR-005 D4 範圍內由 design 確認，超出就停下回報（Q8）
- 版面決定 `resolveDashboardView` 要能被單元測試逐一驗證 02-01 §這一頁顯示哪一種版面 第 1–4 條與優先序，不靠 E2E 才驗得到（三種任務角色版面本次正式環境到不了）
- 卡片連結的網址常數與側欄的 `ANNOTATION_HREF`、`TASK_LIST_HREF` 是同一組路徑；`features/dashboard` 不能 import `features/app-shell`（F1），路徑常數放哪一層由 design 依 F1 定（T-4），不能各寫一份字串
