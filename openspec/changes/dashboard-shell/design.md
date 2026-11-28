# Design

本份是 change `dashboard-shell`（Issue #722）的技術決策。動機見 `proposal.md` §Why；行為以同目錄 `specs/` 為準；後端現況與「不動後端」的論證見 `system-design.md`，契約見 `api-contract.md`，畫面、元件樹、文案與 token 對照見 `ui-design.md`。那幾份寫過的內容這裡只指過去，不重抄。所有決策都依 `clarification.md` 的決議（Q1–Q10、Q8 補充決議、「不需維護者決定」表）。

## Context

- `/dashboard/dashboard` 目前是暫時落點 `DashboardPlaceholderPage`（`frontend/src/pages/dashboard-placeholder/`），畫在登入後外殼 `AppShellLayout` 的 `<Outlet>` 裡，內容是 `features/auth` 的 `SignedInCard` 與 `features/app-shell` 的 `BlockedNotice`
- 任務角色只有一個來源：`features/app-shell/task-role-source.ts` 的 `useTaskRoleSource()`，對每個人固定回答 `{ heldRoles: ∅, currentTaskRole: null }`，不送請求；側欄（`AppShellLayout` → `buildSidebarNav`）讀它
- 卡片要用的三條路徑在 `features/app-shell/sidebar-nav-model.ts`（`DASHBOARD_HREF`、`TASK_LIST_HREF`、`ANNOTATION_HREF`），`features/auth/paths.ts` 另有一份同值的 `LANDING_PATH`
- token 由 `frontend/build/extract-tokens.ts` 只從 `tokens.css` 取出、以虛擬模組 `virtual:design-tokens.css` 提供；`styles/theme.css` 是 shadcn 對照層；ADR-005 D4 與 frontend-agent-rules F6 寫著「`tokens.css` 是唯一色值來源」
- 原語：`components/ui/skeleton.tsx` 只有 pulse；沒有 Metric
- 限制：F1（`features/` 之間不互相 import，跨 feature 共用往下搬到 `components/ui/` 或 `lib/`）；F5（共用元件只放 `components/ui/`）；F6（原語只用語意變數）；本次沒有後端工作（`system-design.md` §設計結論）

## Goals / Non-Goals

**Goals:**

- 頁面由一個純函式決定版面，三種任務角色版面與優先序可以在本次以單元測試驗證，#733、#736 只要補畫面
- 任務角色來源的三種狀態有固定形狀，骨架、錯誤與重試不靠模組替換（mock）也能在前端測試製造
- 卡片與側欄用同一組路徑常數，符合 F1
- 角色色接進前端而 shadcn 對照層維持只有 `tokens.css` 一個來源，ADR-005 D4 與 F6 在同一張 PR 修訂
- Metric 原語把 G-66 字級對應固定下來，#733、#736 的指標卡直接沿用

**Non-Goals:**

- 不新增、不修改後端端點、模組、資料表或 migration（`system-design.md` §設計結論、`api-contract.md` §端點總覽）
- 不實作真實的任務角色讀取（#766）、三種任務角色版面的區塊（#733、#736）、區塊 B、C、D（#733、#741）
- 不建 `/task-management/task-list`、`/annotation/annotation-list`；三顆按鈕按下後照既有的未建置頁規則回到 `/`
- 不改 `design/prototype/`、`design/system/brand.md`（#814）

## Decisions

### D1 只讀 `getCurrentSession` 的 `role`，不新增請求

儀表板沿用 `features/auth` 的 `useSessionState`（與守門、外殼共用 `getGetCurrentSessionQueryKey()` 的快取），只讀 `data.user.role`。這是 `api-contract.md` §getCurrentSession「儀表板怎麼用」與 `system-design.md` §關鍵情境 的決定，這裡只補實作面：頁面不呼叫任何 Orval hook，所以「進儀表板不多送請求」不需要另寫去重邏輯。

- 替代方案：新增 `getTaskRoleSummary`、`getPlatformUserSummary`——Q1、Q2 不採用，理由見 `system-design.md` §未採用的方案

### D2 任務角色來源回傳三態的判別聯集，以 React context 作為測試接縫

`useTaskRoleSource()` 的回傳改成判別聯集，現有的 `TaskRoleAnswer` 原封不動包在 `ready` 裡：

```ts
type TaskRoleSourceState =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "ready"; answer: TaskRoleAnswer };
```

- **正式環境**：hook 讀一個 React context，context 的預設值是凍結的 `{ status: "ready", answer: NO_TASK_ROLE }`，所以 app 樹不必加 provider，行為與現在相同（Q1：正式環境恆為「完成、沒有任務角色」）
- **測試**：`features/app-shell` 從公開邊界匯出 `TaskRoleSourceProvider`，測試以它包住頁面、餵入 `loading`／`error`（`retry` 由測試控制下一個狀態）／`ready`。不用 `vi.mock` 替換自己的模組，與 testing-agent-rules 不 mock 自己程式碼的方向一致
- **側欄**：`AppShellLayout` 只在 `status === "ready"` 時把 `answer` 交給 `buildSidebarNav`，其餘兩態交 `NO_TASK_ROLE`。正式環境到不了那兩態，`app-shell-sidebar` 的行為不變；接上真實讀取後側欄在讀取中與失敗時該怎麼畫，列在 Open Questions
- **#766**：只換 hook 內部（改成 TanStack Query 讀取並映射到三態），儀表板、側欄、測試的呼叫端都不動
- 替代方案一：維持回傳 `TaskRoleAnswer`，另加 `useTaskRoleStatus()`——兩個 hook 可能在同一次 render 給出不一致的組合（例如 `error` 卻帶著角色），判別聯集讓型別擋掉這種狀態
- 替代方案二：直接回傳 TanStack Query 的 `UseQueryResult`——本次沒有查詢，會為了形狀造一個假查詢；也讓呼叫端綁在查詢函式庫的欄位上
- 替代方案三：測試以 `vi.mock` 替換 `@/features/app-shell`——要部分替換公開邊界，重試的狀態轉換也要在 mock 裡手寫，脆弱

### D3 版面由 `features/dashboard` 的純函式決定，頁面只負責組合

- `resolveDashboardView(systemRole, taskRoleState)`（`features/dashboard/dashboard-view.ts`）回傳 `invalidRole`、`systemAdmin`、`loading`、`error`、`noTaskRole`、`projectLeader`、`reviewer`、`annotator` 之一（`ui-design.md` §狀態放哪裡）。判斷順序：角色不在允許清單 → `invalidRole`；`super_admin` → `systemAdmin`（不看第二個參數，滿足 specs `dashboard`「系統管理員不讀任務角色」）；接著 `loading`、`error`；`ready` 時依專案負責人 > 審核員 > 標記員取一種，空集合為 `noTaskRole`
- `systemRole` 參數型別是 `string`，不是產物的 `SystemRole` 列舉：產物型別只描述契約，執行時仍可能收到契約外的值（02-01 第 4 條），純函式要能對它判斷
- 三種任務角色版面本次只有頁首（維護者 2026-11-28），但優先序屬於這個函式，所以本次以單元測試逐條驗 02-01 第 1–4 條與優先序；它們的 02-01 Scenario 仍由 #733、#736 驗收
- `pages/dashboard/dashboard-page.tsx` 向 `features/auth` 取系統角色與 `LOGIN_PATH`、向 `features/app-shell` 取任務角色狀態與 `BlockedNotice`，交給 `features/dashboard`（`ui-design.md` §元件樹「頁面是組合層」）。`invalidRole` 時頁面只回傳 `<Navigate to={LOGIN_PATH} replace />`，不呼叫 `useSignOut`、不送 `DELETE /api/v1/current-session`（clarification sa-7）
- 頁面的順序固定為頁首 → `BlockedNotice` → 版面區（Q4；`ui-design.md` §元件樹）；`BlockedNotice` 元件本身不改，只是被放在頁首之後
- 替代方案：把版面判斷寫在頁面元件的 JSX 條件裡——三種任務角色版面本次在畫面上沒有差別，條件寫在 JSX 裡就只能靠 E2E 驗，而 E2E 在本次到不了那三種版面

### D4 卡片與側欄共用的路徑常數搬到 `lib/route-paths.ts`（T-4）

- 新增 `frontend/src/lib/route-paths.ts`，放 `DASHBOARD_HREF`、`TASK_LIST_HREF`、`ANNOTATION_LIST_PATH` 與 `annotationEntryHref(role?: "annotator" | "reviewer")`（產生 `?entry=nav`，帶 role 時加 `&role=<值>`）。`ANNOTATION_HREF` 改由 `annotationEntryHref()` 算出
- `features/app-shell/sidebar-nav-model.ts` 改從 `lib/route-paths` 引用，`features/app-shell/index.ts` 移除這三個常數的再匯出（呼叫端改從 `lib` 取）；`features/auth/paths.ts` 的 `LANDING_PATH` 改為引用 `DASHBOARD_HREF`，註解的「temporary landing page」一併改掉
- 依據：F1「跨 feature 要共用時，往下搬到 `components/ui/` 或 `lib/`」；路徑字串與網址參數的格式（04-01 §路由上下文與回退 第 1、11 條）沒有業務邏輯，是全站的位址，`lib` 可以被每一層 import
- 替代方案一：`pages/dashboard` 從 `features/app-shell` 取常數，以 props 傳給 `features/dashboard`——F1 允許，但卡片的宣告陣列在 `features/dashboard` 裡，三個去處要穿過頁面才能到達卡片，role 參數的格式仍得在某一層再拼一次
- 替代方案二：`features/dashboard` 自己寫一份字串——兩份同值字串正是 `ui-design.md` §交給 `planner`／`sd` 的明確事項 要避免的
- 替代方案三：放 `app/`——`features/` 不能 import `app/`（F1 分層表）

### D5 資料色從 `data-palette.css` 取出，不進 shadcn 對照層（Q8 與 ADR-005 D4 修訂）

- `extract-tokens.ts` 讀 `tokens.css` 之後再讀 `design/prototype/assets/data-palette.css`，兩份都只取 `:root` 與 `html[data-theme="dark"]` 的 `--*` 宣告，依此順序串成同一個 `virtual:design-tokens.css`；任一檔不存在時丟出含該路徑的錯誤，建置失敗。順序要緊：淺色的 `--data-role-emerald-fg` 是 `var(--color-cta-hover)`（`ui-design.md` §角色色的接法）
- 資料色只給 `features/dashboard` 的角色圓形以引用變數的任意值使用（例如 `bg-[var(--data-role-violet-bg)]`，F6 摺疊區塊第 3 點允許引用變數的任意值）；`styles/theme.css` 不宣告、不引用 `--data-*`，`components/ui/` 也不讀。`components/ui/tokens-usage.test.ts` 的禁止樣式加上 `--data-`，讓原語讀資料色時測試失敗
- 這樣 shadcn 的語意色仍只指向 `tokens.css`，資料色另有自己的來源檔，正是 Q8 補充決議修訂後的 D4。修訂由 `[@technical-writer]` 依 `doc-writing` 的 ADR 寫法改 `docs/development/adr/005-frontend-architecture.mdx` D4 的「決定」與「後果」並補一列決策紀錄，同時改 frontend-agent-rules F6 的開頭句與「正例」裡「色值只存在 `tokens.css` 一處」的字面，兩份同一張 PR、排在 token 抽取之前或同組
- 對照：`docs/diagrams/architecture/frontend-routes.mdx` §前端骨架「design token 怎麼進到元件」已依此寫好，實作完成後由實作角色依程式校正
- 替代方案一：把三組角色色抄進 `tokens.css` 或對照層——改 `design/prototype/` 不在本次範圍，抄進對照層會讓對照層含色值（`design-token-mapping`「對照層不含色值」）
- 替代方案二：在 `features/dashboard` 寫死六個色碼——違反 F6，深色主題也得自己切換
- 替代方案三：把資料色映射成 shadcn 風格的語意變數（`--role-annotator` 之類）——資料色不帶語意（`data-palette.css` 檔頭），進對照層就變成語意色，與 D4 修訂的界線相反

### D6 不在刻度上的字級照 G-66 對應，並由 Metric 原語固定（Q9）

- 規則與逐處對照已寫在 `ui-design.md` §用途 → 語意 token（Q9：取最接近且不大於的 token；版面寬度、圓形與圖示尺寸、箭頭不透明度照 prototype 字面值）
- Metric 原語把標籤固定為 `--text-label`、粗 600、大寫，數值固定為 `--text-h3`、粗 700、`--leading-tight`；原語只用語意變數與 Tailwind 的字級 utility 所對應的 token，不讀 `--color-*` 名稱（F6、`design-token-mapping`）。#733、#736 的指標卡直接用這個原語，不再各自對應一次字級
- 替代方案：照 G-64 改用最接近（可能較大）的 token——Q9 明定照 G-66

### D7 原語擴充：新增 Metric、Skeleton 加 `animation`，Card 的陰影在呼叫端拿掉

- `components/ui/metric.tsx`：收 `label`、`value` 兩個字串（呼叫端負責語言與單位，`ui-design.md` §元件樹「原語的兩處擴充」），不宣告 variant；展示頁一個樣本
- `components/ui/skeleton.tsx`：加 `animation?: "pulse" | "shimmer"`，預設 `pulse`，並匯出 `skeletonAnimationValues` 讓展示頁的目錄以 `satisfies Record<…>` 綁定（`component-gallery`「原語宣告的 variant 集合固定」）。shimmer 的 `@keyframes` 寫在 `styles/index.css`，漸層用對照層既有的 `--border`（← `--color-border`）與 `--muted`（← `--color-border-muted`），不直接寫 `--color-*` 名稱，時間照 `skeleton.md` 固定 1.5s；`prefers-reduced-motion: reduce` 時不播
- 展示頁：`variant-catalog.ts` 的 `skeleton` 由 `sample: lines` 改為 `animation: pulse | shimmer`，新增 `metric` 一節排在 Card 與 Separator 之間，目錄錨點 `#metric`（`component-gallery` 三條 MODIFIED）
- Card 不帶陰影以 `className` 覆寫，不改 `card.tsx`、不加 variant（`ui-design.md` §元件樹「Card 不帶陰影」）
- 替代方案：Metric 放 `features/dashboard`——它被三個 feature 用到（`screen-inventory.md`），依 F5 屬共用元件

### D8 新增啟動時預載的 `dashboard` 語言檔，暫時落點的鍵一起刪

- `lib/i18n` 的啟動預載清單加 `dashboard`（與 `common`、`auth`、`appShell` 同一批）：儀表板是正式建置的落點，不走開發頁的動態註冊（`frontend-routes.mdx` §前端骨架 › apiFetch 的細節）
- 文案以 `ui-design.md` §文案 為準；區塊 A 的四個 `0 人` 與示範值標示也是語言檔字串（Q2、Q5），所以切換語言時數值的單位字一起換
- 刪 `auth` 語言檔兩份的 `dashboard.*` 鍵、`features/auth/signed-in-card.tsx`（含測試）與 `pages/dashboard-placeholder/`；`features/auth/role-names.ts` 只被 `SignedInCard` 使用，一併刪除，`features/auth/index.ts` 移除對應的匯出
- 瀏覽器標題沿用 `common` 的 `documentTitle`，頁名取 `dashboard` 語言檔（`frontend-routing`「每頁設定瀏覽器標題」）

### D9 重試的焦點由頁面持有一個旗標

- 版面區回到骨架時錯誤面板已卸載，所以「這次骨架是不是由重試觸發」的旗標放在頁面（或版面區容器）而不是錯誤面板；旗標為真時骨架掛載後把焦點移到可程式聚焦的狀態提示，結果回來後依新內容移到「重試」或新版面的區塊標題，然後清掉旗標。首次載入不移焦點。行為細節見 `ui-design.md` §互動與鍵盤、§無障礙
- 重試期間沒有可按的「重試」（錯誤面板已卸載），所以不需要再做防重複觸發

### D10 測試分層

| 層   | 涵蓋                                                                                                                                                                         | 做法                                                                                                                                                                                                                                   |
| :--- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 單元 | `resolveDashboardView` 的八種結果與優先序；`annotationEntryHref`；`extract-tokens` 讀兩份檔、順序與缺檔錯誤                                                                  | Vitest，純函式                                                                                                                                                                                                                         |
| 元件 | specs `dashboard` 的骨架、讀完切換、錯誤、重試與焦點、行動入口卡文案與連結、區塊 A、語言切換、缺翻譯、角色無效                                                               | Vitest + Testing Library；任務角色狀態以 `TaskRoleSourceProvider` 注入（D2）；`getCurrentSession` 以既有的 MSW handler 提供，角色無效改回 `role: "guest"`（clarification T-3，不在資料庫繞過約束）；缺翻譯以測試內移除一個 `en` 鍵製造 |
| 元件 | 展示頁的 Metric、Skeleton 兩種動畫與完整性測試；`tokens-usage.test.ts` 擋 `--data-`                                                                                          | 既有的 `renderGallery()`                                                                                                                                                                                                               |
| E2E  | 兩種到得了的版面（平台成員、系統管理員）、頁首、卡片連結與點擊後不出現擋下說明、窄螢幕兩欄、側欄收合、無水平捲動、鍵盤、請求只有 `GET /api/v1/current-session`、角色色隨主題 | Playwright，`e2e/dashboard/dashboard.spec.ts` 改寫；帳號由 `e2e/shared/accounts.ts` 的 `createAccount` 建立                                                                                                                            |

依賴「你已登入」的既有測試要一起改：前端 `app/app-shell-layout.test.tsx`、`app/router.test.tsx`、`lib/i18n/locales.test.ts`；E2E `account/login.spec.ts`、`account/session-guard.spec.ts`、`app-shell/appearance.spec.ts`、`app-shell/sidebar.spec.ts`、`dashboard/dashboard.spec.ts`。

## Risks / Trade-offs

- [骨架、錯誤與重試在正式環境到不了，只在測試替身出現] → 以 D2 的 context 接縫在元件測試逐條驗；`acceptance.md` 標明這幾條在哪一層驗證。#766 接上真實讀取時，這些 Scenario 才第一次在正式環境發生，由 #766 在 E2E 補驗
- [三種任務角色版面只有頁首，使用者在本次到不了，但 #766 一接上讀取就會有人落進「只有頁首」的版面] → #766 依賴 #733、#736 的順序由 Epic #713 的 blocked-by 管；本次不加佔位（維護者 2026-11-28）
- [區塊 A 的 `0 人` 可能被讀成真實統計] → 同一個區塊下方有看得見的示範值標示（Q5）；換成真實統計要先以 `spec-writing` 改 02-01（Q4）
- [卡片按下去目前回到儀表板，看起來像沒反應] → Q3 已接受；去處頁面由 #730、#773 建置並補驗「實際到達入口頁」
- [角色色前景對底色在淺深兩組的對比未經驗證] → `ui-design.md` §無障礙 要求圖示至少 3:1；E2E 讀計算後色值時一併算對比，不足時停下回報，不在前端改色（色值在 `design/prototype/`）
- [路徑常數搬家會動到側欄的 import] → 只是 import 來源改變，字串不變；側欄既有的單元測試與 E2E 會擋住任何去處的差異
- [ADR-005 D4 與 F6 的字面在 PR 中途與實作不一致] → D5 要求 ADR 與 F6 修訂排在 token 抽取之前或同組，不讓程式先於規則落地

## Migration Plan

- **部署**：純前端變更，沒有 Alembic migration、沒有資料異動，`backend/openapi.json` 與 `frontend/src/api/generated/` 不變；部署即生效
- **順序**：ADR-005 D4 與 F6 修訂 → token 抽取讀資料色 → 路徑常數搬到 `lib` → 任務角色來源三態 → 原語（Metric、Skeleton）與展示頁 → 儀表板頁面與移除暫時落點 → E2E 改寫 → `design/system/` 的「程式實作」與常駐文件校正。實際分組由 tasks 定
- **回滾**：revert 這張 PR 即回到暫時落點；沒有資料或 schema 要還原。ADR 與 F6 的修訂在同一張 PR，一起 revert，規則與程式不會分家
- **相容性**：網址 `/dashboard/dashboard` 不變，登入後去處、`denied-and-not-found-screens` 的「回儀表板」與側欄的落點都不必改

## Open Questions

- 接上真實的任務角色讀取（#766）之後，側欄在任務角色來源讀取中與讀取失敗時，角色標示與第三個導覽項要怎麼畫；以及系統管理員進儀表板時，側欄仍需要任務角色，儀表板「不讀任務角色」是否只表示版面不等待它。本次正式環境到不了這兩態，D2 先讓側欄沿用「沒有任務角色」的答案、D3 讓系統管理員的版面不看任務角色狀態；答案不影響本次的 specs 與 tasks，由 #766 的規劃釐清
