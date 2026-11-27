# Design

本份只寫實作做法的決策與取捨。動機見 `proposal.md` §Why；行為以 `specs/` 為準；後端沿用的端點與欄位見 `api-contract.md`；畫面結構、元件樹、文案與 token 見 `ui-design.md`；後端無異動的依據見 `system-design.md` §設計結論。凡上游已寫過的，這裡只指段落，不重抄。

## Context

- 後端零異動：側欄只用既有的 `getCurrentSession`、`deleteCurrentSession`（`createSessionRefresh` 由 `apiFetch` 間接使用），`backend/openapi.json` 應與 `main` 逐位元組相同（`api-contract.md` 開頭、sd §設計結論）
- 前端現況：登入後只有暫時落點 `/dashboard/dashboard`，包在 `AuthLayout` 裡、卡片有 `LogoutButton`；`features/auth` 有 `brand-mark.tsx`、`language-toggle.tsx`，元件展示頁有自己的 `theme-toggle.tsx`（不記住、離開還原淺色）；`components/ui/` 沒有對話框原語；`lib/i18n` 的 `fallbackLng` 為 `false`、預載 `common`、`auth`
- `node scripts/check-component-reuse.mjs` 在本分支目前失敗：`design/system/components/` 已依 clarification Q9 把 `app-shell.md`、`brand-mark.md`、`lang-toggle.md`、`theme-toggle.md` 的「程式實作」指向 `frontend/src/components/` 的新位置，而那些檔還不存在（ui §設計系統異動 最後一段）
- 內容安全政策是 `script-src 'self'`（`openspec/specs/security-headers`、`frontend/nginx.conf`），任何內嵌 `<script>` 都會被擋
- 任務與任務成員沒有資料也沒有讀取（sd §設計結論 第 1–3 點）；clarification Q1 定本次只做「任何任務都沒有任務角色」這一支

## Goals / Non-Goals

**Goals:**

- 側欄的依角色判斷集中在一個純函式與一個任務角色來源接縫，#766 接上真實讀取時只換接縫的實作
- 外觀偏好只有一個擁有者（`lib/theme.ts`），側欄、登入頁、元件展示頁與日後的 01-04 讀寫同一份；每一頁在第一次繪製前就套用
- 三個元件搬到 `components/` 後 `check-component-reuse.mjs` 通過，且不在檢查腳本的允許清單留下對應列

**Non-Goals:**

- 不新增任何後端讀取、端點、資料表或 migration（Q1；sd §資料模型異動）
- 不註冊任何不存在的落點頁、不新增「建置中」頁、不改 `frontend-routing`（Q2）
- 不畫通知入口（Q7）；快捷鍵總覽不列頁籤、工作區、審核三組（Q3）
- 不改 `design/prototype/`、`docs/specs/`（規格書回寫已在規劃階段完成，commit `081721f`）

## Decisions

### D1 外殼拆成三層：畫面、規則、組合

`components/app-shell/` 只負責畫，所有資料由 props 傳入，不 import 任何 `features/`；`features/app-shell/` 放導覽模型、任務角色來源、收合偏好、擋下說明與快捷鍵清單；`src/app/app-shell-layout.tsx` 是組合層，向 `features/auth` 取登入者與登出、向 `features/app-shell` 取模型，交給 `components/app-shell` 畫。依據 ui §元件樹 開頭三點與 clarification P6；使用者區命名 `UserSummary` 依 P7。

- **為什麼不是全部放 `features/app-shell/`**：App Shell 在 `design/system/screen-inventory.md` 被多個 feature 的畫面用到，依 F5 是共用元件，放 `features/` 會被 `check-component-reuse.mjs` 擋下（`*-shell.tsx`）
- **為什麼不是全部放 `components/`**：畫面元件若直接讀登入狀態或導覽規則，`components/` 就要 import `features/`，違反 F1（`openspec/specs/frontend-code-boundaries`「依分層限制 import 方向」）；`features/app-shell` 也不 import `features/auth`（功能之間不得互相 import），兩者只在 `app/` 會合

### D2 三個元件搬到 `components/`，外觀切換依 F5 的例外寫明

`features/auth/brand-mark.tsx` → `components/brand-mark.tsx`、`features/auth/language-toggle.tsx` → `components/language-toggle.tsx`、`pages/dev-gallery/theme-toggle.tsx` → `components/theme-toggle.tsx`（ui §元件樹 › 登入後外殼；Issue #720 §驗收條件 第 2 項）。登入頁、`AuthLayout`、外殼與元件展示頁改 import 新位置；兩個元件的文字鍵 `auth.nav.brandHome`、`auth.nav.languageToggle` 搬到 `common`，外觀切換的文字放 `common`，展示頁原本的 `devGallery` `theme.*` 鍵與舊測試一併移除（ui §文案 的 namespace 說明）。`password-input.tsx` 不搬（Issue #720 留言「備註（來自 #747）」）。

**F5 例外**：品牌標誌與語言切換同時被帳號頁（`features/auth`）與外殼用到，是 F5 定義的共用元件，搬移是規則本身的要求。外觀切換不同：`design/system/components/theme-toggle.md` 的使用畫面只有 `shared/app-shell`，依 F5 字面只算一個 feature，本該留在 feature 內。本次仍放 `components/`，依據是 clarification Q5 的裁定——同一個外觀屬性只能有一個擁有者，元件展示頁（`pages/dev-gallery`，不是產品畫面）與外殼要共用同一個控制項，而 `pages/` 不得 import 另一個 feature 的內部檔，`components/` 是兩邊都能合法使用的唯一位置。這是 F5「例外：設計上需要一次抽象時在該 change 的 `design.md` 寫明」所指的情況，只涵蓋外觀切換這一個元件。

- **替代方案**：外觀切換放 `features/app-shell/` 並由展示頁經 feature 對外入口使用——展示頁會因此依賴整個外殼 feature，而且日後 01-04（`features/auth` 或個人設定的 feature）要讀寫同一份偏好時又得搬一次；不採用

`check-component-reuse.mjs` 的允許清單（`MOVE`、`NOT_SAME`）目前都是空的，本次不新增任何列：搬檔與建好 `components/app-shell/` 之後腳本直接通過，不靠允許清單放行（F5 §檢查方式）。

### D3 任務角色來源是單一接縫，本次固定回答「沒有」

`features/app-shell/task-role-source.ts` 的 `useTaskRoleSource()` 回傳 `{ heldRoles: ReadonlySet<TaskRole>, currentTaskRole: TaskRole | null }`，本次固定為空集合與 `null`，不發任何請求（Q1；ui §非畫面的模組「任務角色來源」）。形狀對齊 sd §任務角色讀取的提案形狀（`heldRoles` 只有角色名稱、不帶任務 ID），#766 接上讀取時只換這一支。

第三個導覽項的名稱、角色標示鍵、兩個進入條件與每一項的目標，都由 `features/app-shell/sidebar-nav-model.ts` 的純函式 `buildSidebarNav` 依「系統角色、任務角色來源的回答、目前路由的宣告」算出；畫面元件不各自判斷（sd §設計結論 最後一段的「接縫」）。純函式讓 07-01 依任務角色的完整真值表（含已移交 #766 的那幾支）現在就能以 unit 測試鎖住，接上讀取時行為不漂移。

- **替代方案**：本次就加後端彙總讀取——依 ADR-003 D14 任務成員屬 `task` 模組，現在做只會是寫死的假實作，clarification Q1 已否決
- **替代方案**：各元件直接寫死「一般使用者」「標記作業」——#766 時要改多處，且無法先以測試鎖住真值表；不採用

### D4 目前位置與角色標示覆寫由路由 `handle` 宣告，缺宣告時測試失敗

外殼底下每一條有 `element` 的路由在 `handle` 宣告 `navKey`，系統管理兩頁另宣告 `adminSubKey` 與 `roleIndicator: "systemAdmin"`、需要的頁宣告 `shortcutGroups`；外殼讀最深一層的宣告（ui §進入、離開與返回 › 目前位置、角色標示的顯式覆寫）。本次只有暫時落點，宣告 `navKey: "dashboard"`。

依 clarification P3，`router.test.tsx` 加一個測試走過 `createAppRouter()` 的路由樹，外殼 layout 底下每一條有 `element` 的路由沒有 `navKey` 時失敗，不靠預設值。

- **替代方案**：用 React Router `NavLink` 依路徑前綴判斷——任務詳情、角色設定這類次層頁的路徑與導覽項不一定同前綴，且做不到「全站恰好一個」；不採用

### D5 擋下只攔一般點擊，說明先存進元件狀態再清 router state

第三個導覽項與「資料集分析」的 `href` 照樣指向真正的模組頁；`onClick` 在一般點擊（沒有 Ctrl／⌘、Shift、中鍵）且 `buildSidebarNav` 判定要擋時 `preventDefault`，以 `navigate(落點, { state: { blockedNotice: "annotation" | "datasetAnalysis" }, replace: 已在落點 })` 導向（Q4；ui §非畫面的模組「擋下說明」、§畫面狀態 › 擋下說明）。

`features/app-shell/blocked-notice.tsx` 的 `BlockedNotice` 不直接以 `location.state` 決定畫不畫，因為 state 一清掉下一次渲染（包括切換語言）說明就會消失：

1. 每當 `location.key` 改變且 `location.state.blockedNotice` 是兩個已知種類之一，就把 `{ arrivalKey: location.key, kind }` 存進元件狀態
2. 存好之後才以 `navigate(目前路徑, { replace: true, state: null })` 清掉 router state。這次 replace 產生的新 location 沒有 state，元件**不**因此清除已存的種類。清除必須冪等：只在 `location.state.blockedNotice` 仍存在時才送出這次 `replace`，StrictMode 重跑 effect 時 state 已清或存入的 `arrivalKey` 已等於目前的 key，就不再送，也不重存
3. 說明用既有 `components/ui/alert.tsx`（`info`）畫出，文字每次渲染都從 `appShell` 語言檔取，所以切換語言後變成英文；不插值任何任務資料。種類只認兩個值，其他值不畫
4. 說明一直留到離開這一頁（元件卸載）為止。重新整理、上一頁、下一頁回到的歷史紀錄都已沒有 state，所以不再出現
5. 已在落點時再點一次被擋的導覽項，會帶著新的 `location.key` 再到達一次，步驟 1 重新存入；Alert 以 `arrivalKey` 作 `key` 重新掛載，讓 `role="alert"` 再朗讀一次

- **替代方案**：網址 query（`?blocked=annotation`）——可分享、重新整理會重現，違反 07-01 §進入模組的條件 的註「重新整理之後不再出現」；不採用
- **替代方案**：Toast——要新增原語與未核可的畫面，Q4 已否決

### D6 外殼每次被重新掛載或換頁時背景重查登入狀態，焦點不重查

本次只有 `/dashboard/dashboard` 在外殼底下。點一個還沒建置的導覽項（例如「任務管理」→ `/task-management/task-list`）會落到外殼以外的 `{ path: "*" }`，經 `/`（`RootRedirect` 讀 `staleTime: Infinity` 的快取）回到落點，途中外殼會**卸載再重新掛載**。所以「只監看 `AppShellLayout` 的 pathname、不含第一次掛載」永遠不會觸發，觸發點要能跨過外殼的重新掛載：

`frontend/src/main.tsx` 以 `<StrictMode>` 包住整個應用，開發模式（E2E 跑的就是它）下 effect 會「執行、清理、再執行」一次，refs 保留。所以判斷「要不要重查」不能依「這個 effect 是不是第一次跑」或「外殼是不是第一次掛載」，否則 StrictMode 的模擬重新掛載就會讓每次頁面載入多送一次查詢。判斷改依 StrictMode 重跑時不會變的值：`location.key` 與 `location.pathname`。

1. `createAppRouter()` 在所有路由外加一層沒有 path 的根 layout route（`src/app/app-root.tsx` 的 `AppRoot`，只畫 `<Outlet>`），這一層不因換頁而卸載，只有整頁重新載入才重來。它以 context 提供一個 ref：`{ checkedKey, checkedPathname, leftSince }`，前兩者是上一次登入狀態檢查時外殼所在的 `location.key` 與 pathname（初值為空），`leftSince` 表示那之後路由是否到過別的 pathname
2. `AppRoot` 有一個依 `location.pathname` 的 effect：目前的 pathname 不等於 ref 裡的 `checkedPathname`（外殼記下的值，不是 `AppRoot` 自己上一次看到的 pathname）時，把 `leftSince` 設為 true；相等時不動。它只做比較與設值，StrictMode 重跑時結果相同
3. `AppShellLayout` 有一個依 `location.key`、`location.pathname` 的 effect，依序判斷：
   - `checkedKey` 為空（這次頁面載入外殼第一次到達，守門剛查過）→ 記下目前的 key 與 pathname、`leftSince` 設為 false，**不重查**
   - `location.key` 等於 `checkedKey`（StrictMode 的重跑，或同一個 location 的重新渲染）→ 什麼都不做
   - key 不同，且 pathname 不同於 `checkedPathname` 或 `leftSince` 為 true（使用者換了頁，包括經外殼以外的轉址回到同一個落點）→ 呼叫 `refetch({ cancelRefetch: false })`，記下新的 key 與 pathname、`leftSince` 設為 false
   - key 不同但 pathname 相同且沒有離開過（擋下說明清 state 的 `replace`、已在落點時再點被擋的導覽項）→ 只記下新的 key，不重查
4. `cancelRefetch: false` 讓一連串轉址裡進行中的那一次重查被沿用，不重送
5. 重查在 effect 判斷並記下之後，排到 commit 之後的 microtask 才送出：轉址回來時守門、外殼都是新掛載，StrictMode 會同步模擬一次卸載，effect 裡直接呼叫的查詢那時沒有觀察者，TanStack Query 會取消它，而 `staleTime: Infinity` 讓重新掛載也不再查。每個 `location.key` 仍只判斷、只送一次
6. 查詢維持 `staleTime: Infinity`、`refetchOnWindowFocus: false`；重查進行中側欄沿用上一份資料、不顯示載入中；重查得到未登入時守門照既有規則帶回登入頁（Q11；ui §資料來源 的「為什麼換頁就重查、焦點不重查」；sd §關鍵情境「角色被改掉時側欄不立刻變」）

React 先跑子層再跑父層的 effect，所以同一次 commit 裡外殼的 effect 先記下到達、`AppRoot` 的 effect 後跑。`AppRoot` 比對的是外殼剛記下的 `checkedPathname`，到達的那一頁與它相等，`leftSince` 維持外殼剛設的 false，不會在外殼記下到達之後又被設回 true；若改成比對 `AppRoot` 自己上一次看到的 pathname，從 `/account/login` 導向落點或轉址鏈回到落點的那一次 commit 就會把 `leftSince` 設回 true，接著在落點點被擋的「標記作業」就會誤觸重查。外殼底下的直接換頁（日後多頁時）在同一次 commit 裡 `AppRoot` 還沒機會設 `leftSince`，靠第 3 點的「pathname 不同」判斷；經外殼以外的轉址（本次「任務管理 → `*` → `/` → 落點」）回到同一個 pathname 時，中途的 `/task-management/task-list` 與 `/` 都不等於 `checkedPathname`，已讓 `AppRoot` 設好 `leftSince`。

這樣頁面載入時（含已登入的人開 `/account/login` 被導向落點）`checkedKey` 為空，不會多送請求，StrictMode 下也一樣，`auth-guard`「兩種路由共用同一次查詢」的「只送出 1 次」與 `e2e/account/session-guard.spec.ts` 既有的查詢次數都不變。登出後在同一次頁面載入裡再登入，外殼會以新的 key 與離開過的 pathname 到達而多一次重查，結果與登入回應相同，只多一個請求。

- **替代方案**：以「外殼是否掛載過」或「effect 是否第一次跑」判斷（前一版寫法）——StrictMode 的模擬重新掛載會被當成第二次，每次頁面載入多送一次查詢，違反 `session-guard.spec.ts` 的次數；不採用
- **替代方案**：在根 layout 監看所有 pathname 改變就重查——已登入的人開 `/account/login` 被導向落點時會多送一次，違反 `auth-guard`「兩種路由共用同一次查詢」；不採用
- **替代方案**：只在外殼監看 pathname、不含第一次掛載（原寫法）——本次的換頁都經過外殼以外的轉址，永遠不會觸發；不採用
- **替代方案**：`refetchOnWindowFocus: true`——停在原頁時側欄就會變，違反 07-01 §邊界情況；不採用
- **替代方案**：定時輪詢——同樣會在使用者沒有操作時改變側欄，也多出不必要的請求；不採用

成本：每次換頁多一次 `account_session` JOIN `users` 的主鍵查詢（sd §技術待決問題 › 效能）。

### D7 外觀偏好：`lib/theme.ts` 是唯一擁有者，第一次繪製前以同源外部腳本套用

`lib/theme.ts` 負責三種值的讀寫、解讀（無效或缺值當成 `system`）、解析成 `light`／`dark`、寫到 `<html data-theme>`、訂閱 `matchMedia('(prefers-color-scheme: dark)')`，並以 `useSyncExternalStore` 提供給 `ThemeToggle`、元件展示頁與日後的 01-04。儲存鍵沿用 prototype 的 `label-suite-theme`（ui §非畫面的模組「外觀偏好」）。

第一次繪製前的套用放在 `frontend/public/theme-init.js`，由 `frontend/index.html` 在 `<head>` 以同步的 `<script src="/theme-init.js"></script>` 載入（在模組腳本與樣式之前）。它只做一件事：讀同一個鍵、套同一套解讀規則、設定 `data-theme`。

- **為什麼不用內嵌腳本**：`script-src 'self'` 會擋下內嵌腳本，放寬 CSP（加 `'unsafe-inline'` 或 hash）會改動 `security-headers` 的契約；同源外部檔在既有政策下就能執行
- **為什麼不在 React 掛載後套用**：那時已經畫過一次，深色會先閃淺色，違反 Scenario「重新整理時不閃淺色」
- **為什麼不只用 CSS `prefers-color-scheme`**：使用者明確選了淺色或深色時要壓過作業系統，純 CSS 做不到

`theme-init.js` 不經 Vite 打包，所以解讀規則有兩份（它與 `lib/theme.ts`）。以同一張案例表（`light`、`dark`、`system`、缺值、`sepia`、空字串、`DARK` × 作業系統深／淺）同時測兩者，任一份漂移就失敗（見 §Risks）。

登出只清 session cookie 與查詢快取，不碰 `label-suite-theme`，所以登出後的登入頁照偏好呈現（Q6；sd §關鍵情境 的對照表 §外觀切換）。

元件展示頁原本「不記住、離開還原淺色」改為共用控制項並記住（Q5）。`component-gallery` 那條 Requirement 的四個既有 Scenario 中有兩個與新行為相反，`openspec validate` 不允許 MODIFIED 丟掉既有 Scenario，所以 delta 以 REMOVED「展示頁切換淺色與深色」加 ADDED「展示頁的外觀切換沿用外觀偏好」表達，REMOVED 寫明理由與去處。

### D8 收合：本機偏好加一顆平時不可見的鍵盤控制項

`features/app-shell/use-sidebar-collapsed.ts` 讀寫 `labelsuite.sidebarCollapsed`（沿用 prototype 的鍵），值無效或讀不到時當成展開；寬度 767px 以下一律不收合但不覆寫記住的值（ui §響應式 最後一點）。滑鼠點側欄空白處切換時，以事件目標是否落在互動元素（連結、按鈕、輸入）內判斷，落在其中就不切換，這是「點導覽項、語言切換、登出不會收合」的保證（07-01 §側欄收合 第 2 條）。

鍵盤路徑依 clarification Q12：`components/app-shell/collapse-control.tsx` 是一顆透明、無文字的按鈕，位在導覽項與工具列之間的空白區，只在 `focus-visible` 時顯示焦點環，`aria-expanded`、`aria-controls` 指向側欄，名稱隨狀態為「收合側欄」／「展開側欄」（ui §互動與鍵盤）。

### D9 對話框原語以既有 `radix-ui` 建，展示頁放在 Separator 之後

新增 `components/ui/dialog.tsx`（shadcn/ui 的 Dialog，底層用已在依賴裡的 `radix-ui`，不新增套件；proposal §Impact › 依賴）。快捷鍵總覽用它，焦點鎖定、`Esc` 關閉與還焦點由原語提供。元件展示頁在 Separator 與 Skeleton · Empty 之間加 Dialog 區塊（原語排在狀態與 Token 對照之前，沿用既有區塊順序的分組），`variant-catalog.ts` 的 `gallerySections` 同步，否則完整性測試失敗（ui §交給 planner／sd 的明確事項）。`modal.md` 的「程式實作」不改（ui §元件樹 的 Dialog 說明）。

### D10 i18n：新增 `appShell`、共用元件文字移到 `common`、缺鍵以繁中代替

- `appShell` namespace 與 `common`、`auth` 一樣在 `lib/i18n` 啟動時預載、進正式 bundle（ui §文案 的 namespace 說明）
- `fallbackLng` 由 `false` 改為 `"zh-TW"`（clarification P1），英文缺鍵時顯示繁中原文，不顯示鍵名；鍵集一致測試不變，仍擋下提交時的缺鍵
- 主導覽區、工具列、個人設定連結三個 aria-label 補齊兩種語言放進 `appShell`（clarification P2；文案見 ui §文案）
- 擋下說明的英文以 ui §文案 的擬稿為起點，定稿以語言檔為準（Q4）

### D11 登出：抽出 `useSignOut()`，移除 `LogoutButton`

從 `features/auth/logout-button.tsx` 抽出「同一個 tick 只送一次、不論結果都 `markSignedOut`」那段成 `features/auth` 的新匯出 `useSignOut()`，外殼經 `AppShellLayout` 用它；桌機、已收合、手機三個位置的登出控制項共用同一個送出狀態（ui §非畫面的模組「登出」、§畫面狀態 › 登出）。暫時落點拿掉登出鈕後 `LogoutButton` 沒有呼叫端，一併刪除，`SignedInCard` 的登出 prop 移除，暫時落點不再包 `AuthLayout`（Q2）。

### D12 快捷鍵清單：全域一組固定，其他組由路由宣告

`features/app-shell/shortcut-registry.ts` 固定「全域」一組（`?`、`Esc`），其他組由路由 `handle.shortcutGroups` 宣告後合併；本次沒有路由宣告，總覽只有全域一組（Q3；ui §非畫面的模組「快捷鍵清單」）。`?` 的鍵盤監聽只在寬度 768px 以上、焦點不在 `input`、`textarea`、`select` 或 `contenteditable` 時開啟總覽；側欄已收合時按鍵仍有效，照 prototype（ui §互動與鍵盤 的說明）。

### D13 次選單用揭露式，不用 `role="menu"`

「系統管理」是 `aria-expanded` 的按鈕，次選單是一般連結清單；不照 prototype 的 `role="menu"`，因為那個角色要求方向鍵選單行為而 prototype 實際只靠 Tab（ui §互動與鍵盤 的說明）。點外面收起以 document 的 `pointerdown` 判斷事件目標是否在次選單與觸發鈕外。

### D14 版面數值與字級

斷點 767／768px（ui §響應式）；側欄寬度、手機兩條列的高度照 prototype 的數值集中寫在外殼一處（G-24）。字級依 clarification Q13 取 `--text-label`，差異已登記 `design/system/design-gaps.md` G-66。手機主導覽的文字允許換行（必要時字中斷行、置中），英文長標籤在 375px 才不會溢到相鄰項；英文以連字號依音節斷字：英文手機標籤在音節處放軟連字號（U+00AD），另加 `hyphens: auto`（需 `<html lang>` 跟著介面語言），字中斷行只當最後手段；可存取名稱不含軟連字號；桌機不變（clarification Q13 的續決）。目前位置的底色在 `frontend/src/styles/theme.css` 對照層新增 `--nav-active`，指向既有的 `--nav-active-bg`，不新增 token（ui §元件與 design token 的註）。

### D15 E2E 的測法

E2E 沿用 `e2e/` 的真後端加 Vite 開發伺服器。`e2e/static` 要求旅程檔放在 `<module>/<page>.spec.ts` 且不得在 `shared/` 底下，所以側欄的旅程放 `e2e/app-shell/sidebar.spec.ts`，外觀偏好的旅程放 `e2e/app-shell/appearance.spec.ts`：

- 螢幕寬度以 `page.setViewportSize` 的 1280、820、375px 代表桌機、平板、手機
- 「角色被改掉」以 `e2e/shared/account_db.py` 直接改資料庫的 `users.role`，再以 `page.evaluate` 觸發 `blur`／`focus`
- 「等待中」以 `page.route` 延遲 `DELETE /api/v1/current-session`；「錯誤訊息」以 `page.route` 讓換頁後那次 `GET /api/v1/current-session` 回 `500`
- 「不閃淺色」以 `page.addInitScript` 在文件解析前掛 `MutationObserver` 記錄 `data-theme` 每一次變動後的值，並在第一個 `requestAnimationFrame`（第一次繪製前的那一格）記下當下的值，兩者都必須是 `dark`；作業系統深淺與減少動態效果以 `page.emulateMedia`
- 「不截斷」以每個導覽項文字元素的 `scrollWidth <= clientWidth` 且文件 `scrollWidth <= innerWidth` 判定，英文介面以頁面上的語言切換切過去（瀏覽器語系仍固定 zh-TW，`e2e-testing`「介面語言固定為 zh-TW」不變）

## Risks / Trade-offs

- [英文長標籤在 375px 手機主導覽放不下：六項、`--text-label` 12px、prototype 為 `nowrap`] → 以 Scenario「語言文字較長時導覽不截斷」的 E2E 實測；失敗時停下回報，不自行改文案或新增 token（Q13）
- [11px 的角色標示與手機主導覽改用 12px 的 `--text-label`，比 prototype 大] → 已登記 G-66，維護者核可畫面時已知；不自行定義新字級
- [`theme-init.js` 與 `lib/theme.ts` 的解讀規則各一份，可能漂移] → 同一張案例表同時測兩者（D7）；`theme-init.js` 只有十幾行、不 import 任何東西
- [`theme-init.js` 被 CSP 或路徑設定擋下，正式層深色會閃] → 檔案放 `public/` 由 Vite 原樣複製到建置根目錄，同源；`e2e/public-entry` 既有的「載入期間 CSP 違規 0 次、請求失敗 0 次」會涵蓋它
- [暫時落點沒有任何主要操作按鈕，「手機底部導覽不遮擋主要操作」只能以「最後一個內容元素沒被遮住」驗證] → acceptance 以這個判準驗收；#722 的儀表板有真正的主要操作時應再驗一次（acceptance.md 的覆蓋表照實標註）
- [依任務角色的真值表只有「沒有任務角色」一支在本次能驗收] → `buildSidebarNav` 的 unit 測試先鎖住完整真值表；E2E 與驗收只算本次的 41 條，其餘依 clarification §移出本次的驗收標準 移交
- [移除 `LogoutButton` 與 `AuthLayout` 會讓既有的 `e2e/dashboard/dashboard.spec.ts` 與前端unit 測試失效] → 在同一個群組內改寫，以側欄的「登出」控制項重跑 `e2e-testing`「登入、到落點、再登出」
- [`check-component-reuse.mjs` 在搬檔完成前一直失敗，CI 的 `specs` job 在那之前是紅的] → tasks 把三個元件搬移與 `components/app-shell/` 骨架放在最前面的群組，該群組提交時就要通過
- [每次換頁多一次登入狀態查詢] → 單次主鍵 JOIN，成本低（sd §技術待決問題）；不採輪詢或焦點重查
- [外觀切換放 `components/` 依 F5 字面不成立] → D2 已依 F5 的例外寫明，只涵蓋這一個元件

## Migration Plan

- **後端與資料庫**：無異動，沒有 Alembic migration，也就沒有 down 要還原；`openapi.json` 與前端產生的型別以兩條契約漂移指令確認不變
- **部署**：前端隨下一次建置上線；新增的本機儲存鍵 `label-suite-theme`、`labelsuite.sidebarCollapsed` 第一次讀不到時用預設值（跟隨系統、展開），不需要資料搬移
- **回滾**：還原本 PR 即可。舊版前端不讀這兩個鍵，殘留的值不影響任何行為；元件展示頁回到「不記住、離開還原淺色」；暫時落點回到 `AuthLayout` 與卡片登出鈕
