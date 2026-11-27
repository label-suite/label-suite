## 驗收：denied-and-not-found

結論：**通過**

驗收對象：分支 `feat/denied-and-not-found`，HEAD **`761dc3d6`**（issue #721，PR #793）；與 `origin/main` 的 merge-base 為 `fff1cd98`。驗收日期 2026-11-27，`acceptance-verifier`。

本次驗收：`denied-and-not-found-screens` 的 9 條 Scenario（全部是規格 07-03 §驗收標準 的原名），另核對三份 delta：`frontend-api-client` ADDED 5 條、`component-gallery` MODIFIED／ADDED 共 13 條（含沿用的既有 Scenario）、`auth-guard` MODIFIED 3 條（只改來源註，Scenario 沿用）。9 條依 clarification Q1 與 `tasks.md` §Workflow follow-up 以「元件 unit 加元件展示頁 e2e」的層級標「已驗證」，不是部分驗證；以真實頁面觸發的端對端驗證由 #763、#773 補上（不屬移出）。07-03 另 2 條依 clarification 移出，見 §覆蓋表。沒有未解決的缺陷。

### 證據代號

- **Unit**：`pnpm --filter frontend test:coverage`，**63 個測試檔、736 passed**，結束碼 0；`blocked-screen.tsx`、`blocked-section.tsx`、`api-error.ts` 三個檔案四項覆蓋率都是 100%（報表 `skipFull` 不列）
- **E2E**：`pnpm --filter e2e test`（完整一輪，真後端加 Vite 開發伺服器，SQLite）。第一輪 114 passed、1 failed（`account/session-guard.spec.ts:218`「慢的那個分頁自動重試一次」，與本次無關，見 §觀察）；第二輪 **115 passed**，結束碼 0。本次新增的 `e2e/system-health/dev-gallery.spec.ts` 5 支在兩輪都通過
- **Browser**：驗收者自己的 Playwright 腳本，對著另外啟動的後端（8000，SQLite 暫存檔）與前端（5173）跑，不用 E2E 的 fixture；截圖：
  - `/private/tmp/claude-501/-Users-mandy610425-project-label-suite-oss/06c86cc0-619f-464f-88ff-58192a17dc21/scratchpad/721-gallery-blocked-375.png`
  - `/private/tmp/claude-501/-Users-mandy610425-project-label-suite-oss/06c86cc0-619f-464f-88ff-58192a17dc21/scratchpad/721-gallery-blocked-1280.png`
  - `/private/tmp/claude-501/-Users-mandy610425-project-label-suite-oss/06c86cc0-619f-464f-88ff-58192a17dc21/scratchpad/721-unknown-signed-in.png`

### Scenario 結果

#### denied-and-not-found-screens（9 條，對到規格 07-03 §驗收標準）

| Scenario                               | 對應的規格書驗收標準                        | 證據                                                                                                                                                                                                                                                                                                                                                                                                                     | 結果   |
| :------------------------------------- | :------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 正向：那一筆不存在時顯示找不到         | 07-03「正向：那一筆不存在時顯示找不到」     | Unit `blocked-screen.test.tsx`「shows the not-found screen…」；E2E `dev-gallery.spec.ts` 第 1 支（標題、說明逐字、恰一個「回儀表板」→ `/dashboard/dashboard`、0 個按鈕）；Browser 兩種寬度：`h2` 一個、說明逐字、0 個 button／input／svg／img                                                                                                                                                                            | 已驗證 |
| 正向：權限被撤銷時顯示無權限           | 07-03「正向：權限被撤銷時顯示無權限」       | Unit「shows the denied screen that says who to contact, with no retry」；E2E 第 1 支；Browser：說明「你目前無權限檢視任務代碼 demo-task-001，請回到儀表板或聯絡管理員。」，沒有重試按鈕                                                                                                                                                                                                                                  | 已驗證 |
| 反向：不得用空白內容代替找不到         | 07-03 同名                                  | Unit `blocked-flow.test.tsx`「replaces an empty list with the not-found screen…」：同一個內容區由 `table`＋空狀態換成找不到後，沒有 `table`、`list`、`listitem`、空狀態文字                                                                                                                                                                                                                                              | 已驗證 |
| 反向：兩種畫面不得互換                 | 07-03 同名                                  | Unit `api-error.test.ts`（`403 PERMISSION_DENIED` → `denied`）；Unit `blocked-flow.test.tsx`（`data-kind="denied"`，沒有找不到的標題、沒有 `data-kind="notFound"`）；E2E 第 1 支（兩個樣本的 `data-kind` 分別為 `notFound`、`denied`）                                                                                                                                                                                   | 已驗證 |
| 邊界：網址沒帶識別碼                   | 07-03 同名                                  | Unit「shows the unspecified description without an identifier element…」：說明為「未指定任務，請回到儀表板重新選擇任務。」，沒有 `bdi`，恰一個連結                                                                                                                                                                                                                                                                       | 已驗證 |
| 反向：本來就不該知道它存在時顯示找不到 | 07-03 同名                                  | Unit `blocked-flow.test.tsx`「draws the same not-found screen for a hidden record as for a missing one」：以 api-contract 的 `404 NOT_FOUND` 外層建 `ApiError`，除去 React 產生的 id 後 markup 與「不存在」**逐字相同**；文字不含 `message`「找不到指定的資源」、`traceId` 值、「測試集」                                                                                                                                | 已驗證 |
| 邊界：兩種條件同時成立                 | 07-03 同名                                  | Unit `blocked-flow.test.tsx`：`data-kind="notFound"`，內容區 `textContent` **完全等於**「標題＋含 `demo-task-001` 的說明＋連結標籤」                                                                                                                                                                                                                                                                                     | 已驗證 |
| 邊界：識別碼很長或帶著奇怪的字元       | 07-03 同名                                  | Unit：300 字元識別碼逐字出現、`bdi` 帶 `[overflow-wrap:anywhere]`；`<img src=x onerror=alert(1)>`＋U+202E＋`abc` 不產生 `img`、`bdi` 沒有子元素、`bdi` 之後的文字是獨立的兄弟節點。E2E 第 4、5 支（375／1280px）；Browser：`bdi` 計算樣式 `unicode-bidi: isolate`、`overflow-wrap: anywhere`，375px 樣本 277/277、區塊 325/325，1280px 樣本 894/894、區塊 942/942（`scrollWidth`/`clientWidth`），整份文件也沒有水平捲軸 | 已驗證 |
| 權限：每一種角色都看得到同一套結構     | 07-03「權限：每一種角色都看得到同一套結構」 | Unit「has the same structure for both kinds with no session, query client or auth provider」（兩種畫面都是 heading 1、paragraph 1、link 1、button 0）、「moves focus to the title on arrival, and one Tab reaches the way back」；元件不收角色參數，`components/` 不得 import `features/`／`api/`／`app/` 由 lint `boundaries/dependencies` 保證（lint 通過）；Browser：從標題按 Tab 落在「回儀表板」                    | 已驗證 |

#### frontend-api-client（ADDED 5 條）

| Scenario                           | 證據                                                                                                                                       | 結果 |
| :--------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 403 PERMISSION_DENIED 分類為無權限 | Unit `api-error.test.ts`「classifies 403 PERMISSION_DENIED as denied」                                                                     | 通過 |
| 404 NOT_FOUND 分類為找不到         | Unit 同檔                                                                                                                                  | 通過 |
| CSRF 失敗不算無權限                | Unit 同檔「does not count a CSRF failure as denied」                                                                                       | 通過 |
| 其他錯誤都分類為其他               | Unit 同檔 `it.each`：`401`、`500`、`503`、`network`、`timeout`、`aborted`、`invalidResponse` 414（`code` 為 `null`）、一般 `Error`、`null` | 通過 |
| 狀態碼與錯誤碼不一致時是其他       | Unit 同檔 `it.each`：`404 PERMISSION_DENIED`、`403 NOT_FOUND`                                                                              | 通過 |

既有「認證錯誤只認 401」的 `isAuthError` 測試未改動且通過。

#### component-gallery（MODIFIED／ADDED）

| Scenario                                        | 證據                                                                                                                 | 結果 |
| :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- | :--- |
| 每個宣告的 variant 都在頁面上（沿用）           | Unit `completeness.test.tsx`                                                                                         | 通過 |
| 新原語各有一個區塊（十一個區塊順序）            | Unit `completeness.test.tsx`「names each of the eleven sections with an h2, in order」                               | 通過 |
| 元件展示頁的完整性測試擋下漏寫的variant（沿用） | Unit `completeness.test.tsx`                                                                                         | 通過 |
| 新增原語卻沒放進展示頁時測試失敗（沿用）        | Unit `completeness.test.tsx`                                                                                         | 通過 |
| 原語的測試檔不算原語（沿用）                    | Unit `completeness.test.tsx`                                                                                         | 通過 |
| 展示頁不顯示測試示意（沿用）                    | Unit `completeness.test.tsx`                                                                                         | 通過 |
| 開啟帶錨點的網址時目錄標示該區塊                | Unit `gallery-nav.test.tsx`；Browser `#badge`：十一個連結中只有 Badge 帶 `aria-current`                              | 通過 |
| 目錄有指向無權限與找不到的錨點                  | Unit `gallery-nav.test.tsx`；E2E 第 2 支（11 個連結、`#blocked`、`aria-current="location"`、`section#blocked`）      | 通過 |
| 窄視窗時目錄在內容上方（沿用）                  | Browser：767px 目錄 y=0、高 161，h1 y=185（在上方）；768px 目錄在左側 x 0–240、h1 x=288                              | 通過 |
| 區塊展示三個樣本                                | Unit `blocked-section.test.tsx`；Browser：區塊標頭「樣本 × 3」，順序 `notFound`、`denied`、`longIdentifier`，皆 `h2` | 通過 |
| 樣本的返回連結到儀表板                          | Unit `blocked-section.test.tsx`；E2E 第 1 支；Browser 三個樣本各恰一個「回儀表板」→ `/dashboard/dashboard`           | 通過 |
| 開啟展示頁不搶焦點                              | Unit `blocked-section.test.tsx`；E2E 第 3 支；Browser 兩種寬度 `document.activeElement` 都是 `BODY`                  | 通過 |
| 長識別碼樣本不撐破版面                          | E2E 第 4、5 支；Browser 數值見上                                                                                     | 通過 |

#### auth-guard（MODIFIED，只改來源註，3 條沿用）

| Scenario                   | 證據                                                                                                                                                                                                                                                                                                               | 結果 |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 未登入開啟根路徑           | E2E `account/session-guard.spec.ts`；Unit `router.test.tsx`                                                                                                                                                                                                                                                        | 通過 |
| 已登入開啟根路徑           | Unit `router.test.tsx`「are sent from / to the landing page」                                                                                                                                                                                                                                                      | 通過 |
| 不存在的路徑依登入狀態導向 | E2E `session-guard.spec.ts`「不存在的路徑依登入狀態導向」；Browser：未登入開 `/no-such-page` → `/account/login`；以 Seeder 管理員登入後開 `/no-such-page`、`/tasks/demo-task-001`、`/dashboard/nope` 都回到 `/dashboard/dashboard`，頁面上 0 個 `section[data-kind]`（clarification Q2：未註冊的網址不顯示找不到） | 通過 |

### 覆蓋表（規格 07-03 §驗收標準 11 條）

| 07-03 Scenario                         | 本次處理                  | 層級                      |
| :------------------------------------- | :------------------------ | :------------------------ |
| 正向：那一筆不存在時顯示找不到         | 已驗證                    | 元件 unit＋元件展示頁 e2e |
| 正向：權限被撤銷時顯示無權限           | 已驗證                    | 元件 unit＋元件展示頁 e2e |
| 反向：不得用空白內容代替找不到         | 已驗證                    | 元件 unit                 |
| 反向：兩種畫面不得互換                 | 已驗證                    | 元件 unit＋元件展示頁 e2e |
| 邊界：網址沒帶識別碼                   | 已驗證                    | 元件 unit                 |
| 反向：本來就不該知道它存在時顯示找不到 | 已驗證                    | 元件 unit                 |
| 邊界：兩種條件同時成立                 | 已驗證                    | 元件 unit                 |
| 邊界：識別碼很長或帶著奇怪的字元       | 已驗證                    | 元件 unit＋元件展示頁 e2e |
| 權限：每一種角色都看得到同一套結構     | 已驗證                    | 元件 unit＋元件展示頁 e2e |
| 邊界：返回之後仍被擋下                 | clarification 移出 → #763 | —                         |
| 邊界：被權限矩陣帶回的那一頁也擋下他   | clarification 移出 → #730 | —                         |

9 條已驗證、2 條移交、0 條未驗證。以真實頁面觸發的端對端驗證（任務詳情、標記清單）由 #763、#773 補上（clarification Q1），不屬移出也不屬部分驗證。

### Decision Table

這兩種畫面不讀 session、不送請求，不接收角色；決定畫哪一種的唯一輸入是拒絕回應的 `kind`／`status`／`code`。系統角色與任務成員身分在本次沒有分支（07-03 §使用角色：每一種登入後角色同一套結構）。

| 系統角色                     | 任務成員身分 | 動作                     | 資料狀態／輸入                                                                                      | 預期                                                      | 驗證方式            | 結果 |
| :--------------------------- | :----------- | :----------------------- | :-------------------------------------------------------------------------------------------------- | :-------------------------------------------------------- | :------------------ | :--- |
| 不適用（元件不收角色）       | 不適用       | 分類拒絕回應             | `http` 403 `PERMISSION_DENIED`                                                                      | `denied`                                                  | Unit（自動）        | 通過 |
| 不適用                       | 不適用       | 分類拒絕回應             | `http` 404 `NOT_FOUND`                                                                              | `notFound`                                                | Unit（自動）        | 通過 |
| 不適用                       | 不適用       | 分類拒絕回應             | `http` 403 `CSRF_FAILED`                                                                            | `other`                                                   | Unit（自動）        | 通過 |
| 不適用                       | 不適用       | 分類拒絕回應             | 404 `PERMISSION_DENIED`／403 `NOT_FOUND`（交錯）                                                    | `other`                                                   | Unit（自動）        | 通過 |
| 不適用                       | 不適用       | 分類拒絕回應             | 401、500、503、`network`、`timeout`、`aborted`、`invalidResponse`（`code` `null`）、`Error`、`null` | `other`                                                   | Unit（自動）        | 通過 |
| 平台成員／系統管理員／Seeder | 任一         | 畫找不到                 | 有識別碼 `demo-task-001`                                                                            | 標題不含識別碼、說明含它、恰一個返回連結                  | Unit＋E2E＋Browser  | 通過 |
| 同上                         | 任一         | 畫找不到                 | 沒有識別碼（缺值）                                                                                  | 「未指定」說明、沒有 `bdi`                                | Unit（自動）        | 通過 |
| 同上                         | 任一         | 畫找不到                 | 識別碼 300 字元（邊界）                                                                             | 逐字出現、任意處換行、無水平捲軸（375／1280px）           | Unit＋E2E＋Browser  | 通過 |
| 同上                         | 任一         | 畫找不到                 | 識別碼含 HTML 與 U+202E（無效／惡意）                                                               | 純文字、無 `img`、其後文字不受方向覆寫影響                | Unit（自動）        | 通過 |
| 同上                         | 任一         | 畫無權限                 | 有識別碼                                                                                            | 說明含「聯絡管理員」、無重試                              | Unit＋E2E＋Browser  | 通過 |
| 同上                         | 任一         | 畫找不到（隱藏的那一筆） | 404 外層含 `message`、`traceId`                                                                     | 與「不存在」逐字相同，不顯示 `message`／`traceId`         | Unit（自動）        | 通過 |
| 同上                         | 任一         | 畫面掛上                 | `focusOnMount` 預設 `true`／`false`                                                                 | 焦點到標題，Tab 到連結／焦點不動                          | Unit＋E2E＋Browser  | 通過 |
| 同上                         | 任一         | 畫面掛上                 | `headingLevel` 預設／`2`                                                                            | `h1`／`h2`                                                | Unit（自動）        | 通過 |
| 訪客（未登入）               | —            | 開未註冊網址             | `/no-such-page`                                                                                     | 導向 `/account/login`，不顯示找不到                       | E2E＋Browser        | 通過 |
| Seeder 管理員（已登入）      | 無           | 開未註冊網址             | `/no-such-page`、`/tasks/demo-task-001`、`/dashboard/nope`                                          | 導回 `/dashboard/dashboard`，不顯示找不到                 | Browser（手動腳本） | 通過 |
| 訪客（未登入）               | —            | 開元件展示頁             | `/dev/gallery#blocked`（開發模式）                                                                  | 三個樣本、0 個 `/api/` 請求、0 個失敗請求與 console error | E2E＋Browser        | 通過 |

### API 驗收

本次沒有 API 變更（`api-contract.md`「本次無 API 變更」）。正式環境沒有任何端點會回 `403 PERMISSION_DENIED`（clarification P1），所以沒有可以逐角色呼叫的端點；分類規則以 api-contract §錯誤外層 的範例在 unit 驗。契約漂移：

- `uv run python -m app.scripts.export_openapi` 後 `backend/openapi.json`、`docs/diagrams/architecture/api.openapi.json` 沒有差異
- `pnpm --filter frontend api:generate` 後 `frontend/src/api/generated` 沒有差異
- `git diff --exit-code fff1cd98 -- backend frontend/src/api/generated docs/diagrams/architecture/api.openapi.json` 結束碼 0（整個 `backend/` 與 merge-base 相同）
- `endpoint-authorization.mdx` 本次沒有變動，也不需要變動（沒有新端點、沒有新遮蔽欄位）

### Hard Rule 必驗項

| 規則               | 怎麼驗的                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 結果 |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--- |
| 5 任務設定驅動     | `BlockedScreen` 的字面、去處、識別碼全部由呼叫端傳入，元件與 `classifyRejection` 裡沒有 `input_type`、`outputs`、任務類型或角色的分支（grep 新檔案為 0）；同一個元件在 unit 以兩組不同字面（「任務」與測試檔內示意字面）畫出，結構相同。本次沒有任何依任務類型走的路徑可換組合                                                                                                                                                                                                                                                  | 通過 |
| 6 測試集答案不外露 | 本次沒有任何標記員可達的端點。畫面層：「本來就不該知道它存在」與「不存在」的 markup 逐字相同（unit），文字不含錯誤外層的 `message`、`traceId` 或「測試集」；「兩種條件同時成立」時內容區文字**只有**標題、說明、連結標籤（unit）；元件沒有 `children`、不送請求（E2E 與 Browser 0 個 `/api/` 請求）。正式建置 `frontend/dist/assets/*` 搜尋「無權限與找不到」「Denied and not found」「demo-task-001」「demo-long-」「找不到這個任務」「無權限檢視此任務」「樣本 ×」「samples ×」「blocked-screen」「data-gallery-item」皆 0 筆 | 通過 |
| 9 輸入只當文字     | `<img src=x onerror=alert(1)>`＋U+202E＋`abc` 作為識別碼：沒有 `img` 元素、`bdi` 無子元素、`textContent` 與原值相同、`bdi` 之後的說明是獨立文字節點；元件沒有 `dangerouslySetInnerHTML`；瀏覽器中 `bdi` 計算樣式 `unicode-bidi: isolate`                                                                                                                                                                                                                                                                                        | 通過 |

前端另核對：Browser 以 Seeder 管理員登入後 `localStorage`、`sessionStorage` 都是空的，`document.cookie` 只讀得到 `__Host-ls_csrf`（認證 cookie 是 `httpOnly`）。

### DoD

| 項目                                                  | 指令                                                                                                                              | 結果                                                                                                              |
| :---------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| spec 每個 Scenario 都驗證通過                         | 見 §Scenario 結果                                                                                                                 | 通過（9＋5＋13＋3）                                                                                               |
| Decision Table 情境都有對應驗證                       | 見 §Decision Table                                                                                                                | 通過                                                                                                              |
| 前端 lint                                             | `pnpm --filter frontend lint`                                                                                                     | 通過，結束碼 0                                                                                                    |
| 前端型別檢查                                          | `pnpm --filter frontend typecheck`                                                                                                | 通過，結束碼 0                                                                                                    |
| 前端 unit 與覆蓋率                                    | `pnpm --filter frontend test:coverage`                                                                                            | 通過，736 passed；整體 Stmts 98.29%、Branch 96.05%；新檔案 100%                                                   |
| 前端 build                                            | `pnpm --filter frontend build`                                                                                                    | 通過；有 Vite 的「chunk 大於 500 kB」提示（504.98 kB），非錯誤，且本次的新元件沒有進入正式 bundle                 |
| 元件重用檢查                                          | `node scripts/check-component-reuse.mjs`                                                                                          | `PASS`，允許清單 0 列                                                                                             |
| e2e 靜態檢查                                          | `pnpm --filter e2e test:static`                                                                                                   | 通過，fail 0                                                                                                      |
| e2e 全套                                              | `pnpm --filter e2e test`                                                                                                          | 第二輪 115 passed（第一輪的 1 個失敗見 §觀察）                                                                    |
| 後端 pytest                                           | `uv run pytest -q`（未設 `DATABASE_URL`）                                                                                         | 通過，1171 passed、4 skipped；本次沒有後端變更，作為回歸確認                                                      |
| Alembic 雙層 upgrade／downgrade／upgrade — SQLite     | —                                                                                                                                 | 不適用：本次沒有 migration，`backend/` 與 merge-base 完全相同；驗收時 `alembic upgrade head` 在新的 SQLite 檔成功 |
| Alembic 雙層 upgrade／downgrade／upgrade — PostgreSQL | —                                                                                                                                 | 不適用：同上，沒有 migration 變更，未起 PostgreSQL                                                                |
| 後端與前端可 build 並啟動                             | 見 §人工驗收步驟 的啟動指令                                                                                                       | 通過：後端 `/api/v1/health` 回 `database: ok`，前端 5173 可開                                                     |
| `openapi.json` 重新匯出無差異且與 contract 一致       | 見 §API 驗收                                                                                                                      | 通過                                                                                                              |
| 動到 `docs/`：`pnpm check:specs`                      | `pnpm check:specs`                                                                                                                | 通過，`check-specs: docs OK`                                                                                      |
| 動到 `docs/`：文件站建置                              | 依 `tasks.md` 不在 worktree 跑 `notecraftapp build`                                                                               | 未在本機驗，以 CI `docs-site` job 為準                                                                            |
| `pnpm test:scripts`                                   | —                                                                                                                                 | 不適用：本次沒有動到 `scripts/`                                                                                   |
| OpenSpec 嚴格驗證                                     | `pnpm exec openspec validate denied-and-not-found --strict`                                                                       | `Change 'denied-and-not-found' is valid`                                                                          |
| 正式 bundle 沒有展示頁專用字串                        | 見 §Hard Rule 6                                                                                                                   | 通過，0 筆                                                                                                        |
| 受影響文件同步                                        | 檢視 `frontend-routes.mdx`（「其他路徑」列、§目錄、apiFetch、§元件展示頁、§已知限制、決策紀錄）、`design-gaps.md`；新 spec 無 TBD | 通過                                                                                                              |
| 工作區乾淨                                            | `git status --porcelain`                                                                                                          | 驗收過程結束後為空（本檔除外）                                                                                    |

### 觀察（不是本次的缺陷）

1. `e2e/account/session-guard.spec.ts:218`「慢的那個分頁自動重試一次」第一輪失敗：`expect(refreshes()).toBe(1)` 得到 `0`。第二輪全套通過，單獨以 `--repeat-each 8` 跑 9 次全數通過。本次沒有動到 session、refresh 或 `session-guard.spec.ts` 任何一行，判定為既有的時序抖動，不歸入本次缺陷；建議折進現有處理 e2e 穩定性的 issue 追蹤。
2. 正式 bundle 裡也沒有 `BlockedScreen` 與 `classifyRejection`：目前沒有產品頁面 import 它們，被 tree-shaking 移除。這是 clarification Q1 的預期狀態，#763、#773 接上後才會進 bundle。

### 人工驗收步驟（留作紀錄）

1. **啟動**（在 repo 根目錄，**不要**設 `DATABASE_URL`，走 Lite／SQLite）：
   ```bash
   cd backend
   uv run alembic upgrade head
   CORS_ALLOWED_ORIGINS=http://localhost:5173 uv run uvicorn app.main:create_app --factory --host localhost --port 8000
   ```
   另開一個終端機：
   ```bash
   VITE_API_BASE_URL=http://localhost:8000 pnpm --filter frontend dev --host localhost --port 5173
   ```
   後端 `http://localhost:8000`（健康檢查 `http://localhost:8000/api/v1/health` 應回 `"database":"ok"`），前端 `http://localhost:5173`。元件展示頁本身不需要後端，只看展示頁時可以只起前端。
2. **用什麼身分登入**：看元件展示頁**不用登入**（`/dev/gallery` 在開發模式不經守門）。要試第 5 步的已登入路徑時，用 Seeder 管理員：`cd backend && uv run python -m app.scripts.create_seeder --email <你的 Email> --name <名稱> --password-stdin`，密碼從標準輸入給、由你自己決定，不寫進 repo（同一個資料庫只能建一個 Seeder，已有就用原本那個帳號）。
3. **要點開哪幾個畫面**：
   - `http://localhost:5173/dev/gallery#blocked`
   - 用瀏覽器開發者工具的裝置模式切到寬度 375px，再切回 1280px
4. **每一步預期看到什麼**：
   - 左側（窄視窗時在上方）「元件目錄」有 11 個連結，「無權限與找不到」那一個是目前位置的樣式；右側捲到「無權限與找不到」區塊，標頭右邊寫「樣本 × 3」
   - 第一張卡片：標題「找不到這個任務」，說明「任務代碼 demo-task-001 不存在，請確認網址或回到儀表板重新選擇任務。」，下面只有一個「回儀表板」按鈕狀的連結；**沒有**圖示、沒有其他按鈕
   - 第二張卡片：標題「無權限檢視此任務」，說明「你目前無權限檢視任務代碼 demo-task-001，請回到儀表板或聯絡管理員。」，同樣只有「回儀表板」
   - 第三張卡片：標題同第一張，說明裡是一串很長的 `demo-long-a1b2c3d4e5…`，在 375px 與 1280px 都**在卡片內折行**，頁面下方**不出現水平捲軸**，結尾仍有「不存在，請確認網址或回到儀表板重新選擇任務。」
   - 滑鼠移到「回儀表板」上，狀態列顯示的網址結尾是 `/dashboard/dashboard`
   - 開頁時焦點**不在**任何卡片的標題上（按 Tab 第一下會先落在頁面最前面的控制項，而不是卡片）
   - 開發者工具 Network 面板：開這一頁**沒有任何** `/api/v1/` 請求；Console 沒有紅色錯誤
5. **刻意要試的失敗路徑**：
   - 未登入時開 `http://localhost:5173/no-such-page`：網址變成 `/account/login`，**不是**找不到的畫面；按瀏覽器上一頁不會回到 `/no-such-page`
   - 以 Seeder 管理員登入後開 `http://localhost:5173/no-such-page` 或 `http://localhost:5173/tasks/demo-task-001`：回到 `/dashboard/dashboard`，**不是**找不到的畫面（未註冊的網址維持導回暫時落點，clarification Q2）
   - 到正式建置確認展示頁不存在：`pnpm --filter frontend build` 後 `grep -l "無權限與找不到" frontend/dist/assets/*` 沒有任何輸出
6. **收尾**：兩個終端機各按 `Ctrl+C` 關掉。沒設 `SQLITE_PATH` 時用的 SQLite 檔是 `backend/data/label_suite.db`（`config.py` 的預設），若只是為了這次驗收建的 Seeder 帳號不想留，刪掉那個資料庫檔前先確認裡面沒有你要的資料（刪檔屬破壞性動作，自行判斷）。驗收者本次用的是暫存區的獨立 SQLite 檔，沒有動到預設資料庫。

### 缺陷

無。
