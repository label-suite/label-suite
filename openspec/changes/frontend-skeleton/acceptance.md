## 驗收：frontend-skeleton

結論：**不通過**

驗收對象：分支 `feat/frontend-skeleton`，HEAD `12a48ea`（Issue #505）。驗收日期 2026-11-20，執行者 `acceptance-verifier`（Claude Opus 5.5）。

不通過的原因只有一個，而且性質是**規格與實作行為互相矛盾**，不是單純的實作缺陷，要先由 planner／維護者決定怎麼收斂，見 [§缺陷 1](#缺陷)：

- `dev-health-page`「開啟頁面只呼叫健康檢查端點」要求「整個過程只送出 1 個請求」。在真實瀏覽器的開發模式（兩個開發頁只存在於開發模式）開啟 `/dev/health`，瀏覽器實際送出 **2 個** `GET /api/v1/health`：第一個被前端中止（`net::ERR_ABORTED`），第二個完成，後端也收到兩次。原因是 `src/main.tsx` 以 `<StrictMode>` 包住應用，React 在開發模式會先掛載、卸載、再掛載一次；產生的查詢依 spec「傳入取消訊號」（`query.signal: true`）讀了 `signal`，卸載時 TanStack Query 便取消第一個請求，再掛載時重送。單元測試沒有包 `StrictMode`，所以 321 個測試全綠卻沒抓到。

其餘 112 個 Scenario 以單元測試、真實 lint／型別檢查探針、codegen 指令與真實瀏覽器驗證，結果都通過（細節見下表）。DoD 的自動化項目全部通過。

證據檔案（不進版控）：瀏覽器驗收腳本與截圖在本次 session 的 scratchpad，腳本 `accept-dev.cjs`（65 項檢查）、`preview.cjs`、`dbg3.cjs`（憑證模式）；以下引用的輸出都節錄自這些腳本或指令的實際輸出。

### 驗收方法

| 層                      | 怎麼做                                                                                                                                                                                                                                                                                                                                                                                                   |
| :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 單元／元件測試          | `pnpm --filter frontend test:coverage`（vitest，36 個檔案、321 個測試）；`--reporter=verbose` 逐條對照 Scenario                                                                                                                                                                                                                                                                                          |
| lint／型別檢查 Scenario | 在 `frontend/src/` 暫時放入違規探針檔（元件匯入頁面、功能互相匯入、頁面繞過功能入口、非展示頁讀 `theme.css?raw`、直接 `fetch`、產品碼匯入 `msw` 與產生的 `*.faker.ts`、`any`、條件式 hook、直接匯入 `dayjs`、陣列索引未檢查），對它們跑 `eslint --max-warnings 0` 與 `tsc -b`，記錄訊息後刪除；另放一支匯入 `msw`、`@/test/msw-server`、產生的假資料檔的測試檔確認 lint 不報錯。驗收後 `git status` 乾淨 |
| codegen Scenario        | 在產物目錄放一個舊檔後重產、重產後跑契約定義的兩條不同步檢查、手改產物、暫時在 `backend/openapi.json` 的 `HealthData` 加欄位後重產；全部以 `git restore` 還原並再重產一次確認乾淨。另以 macOS `sandbox-exec` 拒絕對外連線後重產，確認不需連網                                                                                                                                                            |
| 瀏覽器（開發模式）      | 真實後端：`uv run uvicorn app.main:create_app --factory --port 8000`（Lite／SQLite，`SQLITE_PATH` 指到暫存檔，`CORS_ALLOWED_ORIGINS=http://localhost:5173`）；前端 `pnpm --filter frontend dev`（`VITE_API_BASE_URL=http://localhost:8000`）。Playwright 1.64（不進專案依賴，取自本機 npx 快取）驅動 Chromium，監聽 `request`／`requestfailed`／`console`。錯誤、逾時、502 等狀態用 `page.route` 製造    |
| 瀏覽器（正式建置）      | `pnpm --filter frontend build` 後 `pnpm --filter frontend preview --port 4173`，開 `/`、`/dev/health`、`/dev/gallery`                                                                                                                                                                                                                                                                                    |
| 乾淨 clone              | 把本分支 clone 到暫存目錄，`pnpm install --frozen-lockfile` 後跑前端 lint、typecheck、test、build；同一份 clone 暫時移走 `tokens.css` 跑 build                                                                                                                                                                                                                                                           |

本 change 沒有 `docs/specs/` 規格可追溯（proposal：spec-migration §決議 D4，foundation 屬技術規範），所以下表「對應的規格書驗收標準」一欄只有日期時間兩條能對到 07-01／06-01，其餘標「無（來源 ADR／rules）」，不算脫節。

### Scenario 結果

#### component-gallery（17）

| Scenario                                | 對應的規格書驗收標準 | 證據                                                                                                                                                                                                      | 結果 |
| :-------------------------------------- | :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| Button 不宣告 link variant              | 無（ADR-005 D3）     | `completeness.test.tsx` › has exactly the declared button variant values                                                                                                                                  | 通過 |
| Badge 與 Alert 的 variant 集合          | 無                   | 同檔 badge／alert values 兩條                                                                                                                                                                             | 通過 |
| 每個宣告的 variant 都在頁面上           | 無                   | 測試 › shows one item per declared value、derives each section's count；瀏覽器：28 個 `data-gallery-item`（button 6+3+2、input 3、badge 5、alert 4、card 3、skeleton 1、empty 1），四個計數字串都在頁面上 | 通過 |
| 元件展示頁的完整性測試擋下漏寫的variant | 無                   | 測試 › fails and names the value when Button declares a variant the gallery lacks                                                                                                                         | 通過 |
| 新增原語卻沒放進展示頁時測試失敗        | 無                   | 測試 › fails and names the file when a primitive has no section                                                                                                                                           | 通過 |
| 原語的測試檔不算原語                    | 無                   | 測試 › does not count the primitives' test files as primitives                                                                                                                                            | 通過 |
| 展示頁不顯示測試示意                    | 無                   | 測試 › does not show the test illustration；瀏覽器：頁面文字無「（示意）」                                                                                                                                | 通過 |
| 元件展示頁切換淺色與深色                | 無                   | `theme-toggle.test.tsx`；瀏覽器：按「深色」後 `data-theme=dark`、`aria-pressed` 深色 true／淺色 false，`localStorage.length=0`、`sessionStorage.length=0`                                                 | 通過 |
| 預設為淺色且重新整理後回到淺色          | 無                   | 測試 › starts light again after a reload；瀏覽器：切深色後 reload，`data-theme=light`、淺色 pressed                                                                                                       | 通過 |
| 離開展示頁時回到淺色                    | 無                   | `router.test.tsx` › returns to light when leaving the gallery；瀏覽器：深色時以 history 導向 `/dev/health`，`data-theme=light`                                                                            | 通過 |
| 鍵盤可以切換主題                        | 無                   | 測試 › switches with Tab and Space；瀏覽器：Tab 到「深色」按 Space，`data-theme=dark`                                                                                                                     | 通過 |
| Token 對照顯示四組對照                  | 無                   | `token-mapping-section.test.tsx`；瀏覽器：四組字串依序出現（位置 45、80、110、141）                                                                                                                       | 通過 |
| 對照字串與樣式檔一致                    | 無                   | 測試 › matches the light block of the mapping layer                                                                                                                                                       | 通過 |
| 開啟帶錨點的網址時目錄標示該區塊        | 無                   | `gallery-nav.test.tsx`；瀏覽器 `/dev/gallery#badge`：7 個連結只有 Badge 帶 `aria-current="location"`                                                                                                      | 通過 |
| 窄視窗時目錄在內容上方                  | 無                   | 瀏覽器 767px：目錄 y=0、高 120，h1 y=144（在上方）；768px：目錄在左側（x 0–240，h1 x=288）                                                                                                                | 通過 |
| 驗證錯誤樣本關聯錯誤訊息                | 無                   | 測試 › ties the invalid sample to its error message；瀏覽器：「驗證錯誤」欄 `aria-invalid=true`，`aria-describedby` 指向「這一欄的格式不正確」，「停用」欄 `disabled`                                     | 通過 |
| 展示頁不發出後端請求                    | 無（Hard Rule 6）    | 測試 › sends no request while moving between sections；瀏覽器：點七個目錄連結、切兩次主題、reload，fetch／xhr 請求 0 個，對 `:8000` 的請求 0 個                                                           | 通過 |

#### date-time-display（7）

| Scenario                                     | 對應的規格書驗收標準                   | 證據                                                                                                                         | 結果 |
| :------------------------------------------- | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :--- |
| 同一時間點在台北與紐約裝置顯示各自的當地時間 | 07-01 §規格 語言切換 第 5 條；06-01 Q2 | `date.test.ts`；瀏覽器（`timezoneId`）：台北 `2026-11-20 16:15:30（UTC+8）`、紐約 `2026-11-20 03:15:30（UTC-5）`             | 通過 |
| 換算後跨日時日期跟著改變                     | 同上                                   | `date.test.ts` › moves the date forward when the conversion crosses midnight                                                 | 通過 |
| 未指定時區時採用裝置回報的時區               | 同上                                   | `date.test.ts` › uses the time zone the device reports；瀏覽器紐約裝置同上                                                   | 通過 |
| 日光節約時間期間顯示當時的偏移               | 無（clarification Q18）                | `date.test.ts` › offset in effect during DST                                                                                 | 通過 |
| 零偏移的時區                                 | 無                                     | `date.test.ts` › shows a zero offset as UTC+0                                                                                | 通過 |
| 偏移不是整點的時區                           | 無                                     | `date.test.ts` › non-whole-hour offset                                                                                       | 通過 |
| 功能直接匯入日期函式庫時 lint 失敗           | 無（F10）                              | 探針 `src/features/zz-probe/date.ts`：`'dayjs' import is restricted … Format dates through src/lib/date.ts`，eslint 結束碼 1 | 通過 |

#### design-token-mapping（10）

| Scenario                         | 對應的規格書驗收標準 | 證據                                                                                                                                                       | 結果 |
| :------------------------------- | :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 取出的樣式只有自訂屬性           | 無（ADR-005 D4）     | `extract-tokens.test.ts` › keeps only the custom properties；建置輸出的 CSS 開頭只有 `:root{--color-…}`                                                    | 通過 |
| 頁面不載入外部字型               | 無                   | 瀏覽器開 `/dev/health`：沒有任何請求打 `fonts.googleapis.com`；`dist/` 搜尋 `fonts.googleapis` 0 筆                                                        | 通過 |
| token 檔不存在時建置失敗         | 無                   | 乾淨 clone 移走 `tokens.css` 後 `pnpm --filter frontend build` 結束碼 1，訊息 `Design tokens not found at …/design/prototype/assets/tokens.css`            | 通過 |
| 對照層的已核可對照               | 無                   | `theme.test.ts` › maps the four approved shadcn variables                                                                                                  | 通過 |
| 對照層不含色值                   | 無                   | `theme.test.ts` › contains no colour value anywhere                                                                                                        | 通過 |
| token 檔的變數值不被對照層覆寫   | 無                   | 瀏覽器 `/dev/gallery` 讀 `<html>` 計算值：`--color-primary #6366F1`、`--color-border #E2E8F0`、`--color-success #15803D`，與 `tokens.css` `:root` 完全相同 | 通過 |
| 元件不直接引用 token 檔變數      | 無                   | `tokens-usage.test.ts`（7 個原語與其測試檔，各 3 條）                                                                                                      | 通過 |
| 取出的 token 同時保留淺色與深色  | 無                   | `extract-tokens.test.ts` › keeps the light and the dark block of the real tokens.css                                                                       | 通過 |
| 切成深色時頁面底色改用深色 token | 無                   | 瀏覽器：頁面容器底色淺色 `rgb(245, 243, 255)`（=`#F5F3FF`），深色 `rgb(11, 11, 18)`（=深色區塊 `#0B0B12`），移除 `data-theme` 後回到 `rgb(245, 243, 255)`  | 通過 |
| 減少動態時旋轉圖示不轉           | 無                   | 瀏覽器 `reducedMotion: 'reduce'` 載入中：`.animate-spin` 的 `animation-name` 為 `none`，「正在檢查後端狀態…」可見；未設定時為 `spin`                       | 通過 |

#### dev-health-page（15）

| Scenario                                       | 對應的規格書驗收標準 | 證據                                                                                                                                                                                                                                                  | 結果                 |
| :--------------------------------------------- | :------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------- |
| 開啟頁面只呼叫健康檢查端點                     | 無（ADR-003 D6）     | 單元測試 › sends exactly one request（未包 StrictMode）通過；**瀏覽器開發模式**：`GET http://localhost:8000/api/v1/health` 送出 2 次，第 1 次 `net::ERR_ABORTED`，後端 log 每次開頁收到 2 筆。頁首「DEV ONLY · /dev/health」與 h1「系統健康檢查」正確 | **不通過**（缺陷 1） |
| 未登入時看到與任何呼叫端相同的內容             | 無                   | 測試 › shows the full result to a caller without any credentials；瀏覽器（無登入憑證）：顯示「正常」與四列，網址留在 `/dev/health`，沒有「已遮蔽」                                                                                                    | 通過                 |
| 健康檢查頁在等待回應時顯示載入中並可重新檢查   | 無                   | 瀏覽器（攔住回應）：`role=status`「正在檢查後端狀態…」、內容區 `aria-busy="true"`、按鈕 `aria-disabled="true"`；放行後 `aria-busy` 移除並顯示「正常」                                                                                                 | 通過                 |
| 背景更新不回到載入中                           | 無                   | 測試 › keeps the previous result；瀏覽器：顯示正常後觸發 `visibilitychange`（切回分頁），背景請求未回應期間仍顯示「正常」、沒有載入文字                                                                                                               | 通過                 |
| 背景更新進行中按重新檢查不中斷也不重送         | 無                   | 測試 › neither aborts nor resends；瀏覽器：背景請求進行中按鈕 `aria-disabled=true`，按下後沒有新請求、背景請求沒有被中止，放行後顯示結果                                                                                                              | 通過                 |
| 後端與資料庫正常時健康檢查頁顯示正常           | 無                   | 瀏覽器（spec 的固定外層、台北時區）：「正常」「後端與資料庫都可以用」，服務 ok／資料庫 ok／檢查時間 `2026-11-20 16:15:30（UTC+8）`／traceId `3f2b8c1e-…9a01`；按鈕底色 `rgb(253, 253, 254)`（outline，非主色）。真實後端也正確顯示                    | 通過                 |
| 資料庫無法連線時健康檢查頁顯示資料庫無法連線   | 無                   | 瀏覽器 503：`role=alert`，標題「資料庫無法連線」、內文原樣、錯誤碼 `DATABASE_UNAVAILABLE`、traceId `9c1d7e2a-…3c47`；按鈕底色 `rgb(79, 70, 229)` = `--color-primary-strong`                                                                           | 通過                 |
| 後端回報其他錯誤時健康檢查頁顯示通用的後端錯誤 | 無                   | 瀏覽器 500 `INTERNAL_ERROR`：標題「後端回報錯誤」、內文原樣                                                                                                                                                                                           | 通過                 |
| 找不到端點時走通用的後端錯誤                   | 無                   | 瀏覽器 404 `NOT_FOUND`：標題「後端回報錯誤」、錯誤碼 `NOT_FOUND`                                                                                                                                                                                      | 通過                 |
| 連不到後端時健康檢查頁顯示連不到後端           | 無                   | 瀏覽器 `route.abort('connectionrefused')`：`role=alert`「連不到後端」、說明含 `VITE_API_BASE_URL`、錯誤類型 `network`、traceId「無（請求沒有送達）」                                                                                                  | 通過                 |
| 逾時時錯誤類型顯示 timeout                     | 無                   | 瀏覽器（永不回應）：約 15.5 秒後顯示「連不到後端」、錯誤類型 `timeout`                                                                                                                                                                                | 通過                 |
| 回應不是統一外層時顯示連不到後端               | 無                   | 瀏覽器 502 + HTML body：「連不到後端」、`network`                                                                                                                                                                                                     | 通過                 |
| 錯誤後重新檢查顯示新結果                       | 無                   | 瀏覽器：503 後改成功、按「重新檢查」→ 先顯示載入中 → 「正常」；焦點在按下、載入中、結果抵達三個時點都在按鈕上                                                                                                                                         | 通過                 |
| 請求進行中重複按下不送出額外請求               | 無                   | 瀏覽器：按下後、回應前再點一次、按 Enter、按 Space，這次重新檢查只送出 1 個請求（另見缺陷 2：再點一次滑鼠後焦點掉到 body）                                                                                                                            | 通過                 |
| 英文介面下的資料庫無法連線                     | 無                   | 瀏覽器 `locale: en-US` 503：頁面沒有任何中日韓字元，內文 `The database is temporarily unavailable. Please try again later.`、錯誤碼 `DATABASE_UNAVAILABLE`                                                                                            | 通過                 |

#### frontend-api-client（24）

| Scenario                                   | 對應的規格書驗收標準 | 證據                                                                                                                                                                                                                         | 結果         |
| :----------------------------------------- | :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------- |
| 健康檢查請求帶憑證與語言偏好且不帶內容型別 | 無（ADR-004 D1）     | `mutator.test.ts`、`generated-contract.test.ts`；瀏覽器：攔截 `fetch` 記到 `credentials: "include"`，完成的那次請求帶 `cookie: probe=1`（跨 port 同站）、`accept-language: zh-TW`，沒有 `content-type` 與 `x-correlation-id` | 通過         |
| 介面語言為英文時請求語言為英文             | 無                   | 測試；瀏覽器 en-US：`accept-language: en`                                                                                                                                                                                    | 通過         |
| 帶 body 的請求帶 JSON 內容型別             | 無                   | `mutator.test.ts` › sends a JSON content type and the JSON body                                                                                                                                                              | 通過         |
| 基底網址為空時以同源相對路徑送出           | 無                   | `mutator.test.ts` › returns the same-origin relative path                                                                                                                                                                    | 通過         |
| 基底網址缺少協定時啟動失敗                 | 無                   | `config.test.ts` › fails to start when the base URL lacks a scheme, without sending a request                                                                                                                                | 通過         |
| 基底網址以斜線結尾時啟動失敗               | 無                   | `config.test.ts` › ends with a slash                                                                                                                                                                                         | 通過         |
| 唯一出口成功時回傳資料與追蹤資訊           | 無                   | `mutator.test.ts` › returns the data together with the trace id and timestamp                                                                                                                                                | 通過         |
| 204 回應不丟錯誤                           | 無                   | `mutator.test.ts` › returns nothing for a 204                                                                                                                                                                                | 通過         |
| 503 錯誤外層轉成單一錯誤                   | 無                   | `mutator.test.ts` › 503                                                                                                                                                                                                      | 通過         |
| 404 錯誤外層轉成單一錯誤                   | 無                   | `mutator.test.ts` › 404                                                                                                                                                                                                      | 通過         |
| 422 錯誤外層帶出逐欄位錯誤                 | 無                   | `mutator.test.ts` › carries the field errors of a 422                                                                                                                                                                        | 通過         |
| 錯誤外層缺少 errors 鍵仍視為錯誤外層       | 無                   | `mutator.test.ts`、`envelope.test.ts`                                                                                                                                                                                        | 通過         |
| 唯一出口把非外層回應轉成單一錯誤型別       | 無                   | `mutator.test.ts` › HTML page into invalidResponse without leaking the body                                                                                                                                                  | 通過         |
| 非外層回應帶追蹤編號標頭時保留追蹤編號     | 無                   | `mutator.test.ts` › keeps the correlation header of an empty 502                                                                                                                                                             | 通過         |
| 形狀不符的 JSON 不算成功                   | 無                   | `mutator.test.ts`、`envelope.test.ts`                                                                                                                                                                                        | 通過         |
| 連線被拒時為 network 錯誤                  | 無                   | `mutator.test.ts` › refused connection into network without the native message                                                                                                                                               | 通過         |
| 超過 15 秒未回應時為 timeout 錯誤          | 無                   | `mutator.test.ts` › times out after 15 seconds（假時鐘）；瀏覽器實測約 15.5 秒                                                                                                                                               | 通過         |
| 呼叫端取消時為 aborted 錯誤                | 無                   | `mutator.test.ts` › reports aborted when the caller cancels                                                                                                                                                                  | 通過         |
| 五種失敗都是單一錯誤型別                   | 無                   | `mutator.test.ts` › throws ApiError for all five failure kinds                                                                                                                                                               | 通過         |
| 伺服器錯誤後不自動重試                     | 無                   | `query-client.test.ts` › does not retry a query after a server error；瀏覽器 500：完成的請求 1 個（另有 1 個是 StrictMode 中止的，見缺陷 1，不是重試）                                                                       | 通過（附註） |
| 寫入失敗後不自動重送                       | 無                   | `query-client.test.ts` › does not resend a failed write                                                                                                                                                                      | 通過         |
| 失敗後不自動重試且認證錯誤只認 401         | 無                   | `query-client.test.ts`、`api-error.test.ts`                                                                                                                                                                                  | 通過         |
| 403 不是認證錯誤                           | 無                   | `query-client.test.ts`、`api-error.test.ts`                                                                                                                                                                                  | 通過         |
| 連線失敗不是認證錯誤                       | 無                   | `api-error.test.ts` › is false for a network failure                                                                                                                                                                         | 通過         |

#### frontend-api-codegen（10）

| Scenario                             | 對應的規格書驗收標準 | 證據                                                                                                                                                                                                         | 結果 |
| :----------------------------------- | :------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 一條指令由介面描述檔重產呼叫層       | 無（ADR-003 D6）     | `pnpm --filter frontend api:generate` 結束碼 0，產出 `label-suite.ts`、`.schemas.ts`、`.msw.ts`、`.faker.ts`；以 `sandbox-exec` 拒絕對外連線（同沙箱內 `curl https://example.org` 失敗，exit 7）時重產仍成功 | 通過 |
| 描述檔刪除的端點不留在產物中         | 無                   | 產物目錄放 `stale-endpoint.ts` 後重產，檔案消失                                                                                                                                                              | 通過 |
| 產物與描述檔同步時檢查通過           | 無                   | 重產後 `git diff --exit-code -- frontend/src/api/generated` 結束碼 0、`git status --porcelain` 無輸出                                                                                                        | 通過 |
| 描述檔改了卻沒重產時檢查失敗         | 無                   | 暫時在 `HealthData` 加欄位後重產：`git diff --exit-code` 結束碼 1，列出 `label-suite.faker.ts`、`label-suite.schemas.ts`（已還原）                                                                           | 通過 |
| 產物被手改時檢查失敗                 | 無                   | 在 `label-suite.ts` 加一行：`git diff --exit-code` 結束碼 1（已還原）                                                                                                                                        | 通過 |
| 格式化不改寫產物目錄                 | 無                   | `prettier --file-info frontend/src/api/generated/x.ts` → `"ignored": true`；`pnpm format:check` 通過                                                                                                         | 通過 |
| 產物提供契約列出的名稱               | 無                   | `generated-contract.test.ts` › exports the runtime names／type names                                                                                                                                         | 通過 |
| 產生的查詢 hook 回傳資料與追蹤資訊   | 無                   | `generated-contract.test.ts` › returns the data together with the trace id                                                                                                                                   | 通過 |
| 產生的查詢 hook 的錯誤是單一錯誤型別 | 無                   | `generated-contract.test.ts` › fails with the single ApiError type                                                                                                                                           | 通過 |
| 正式建置不含模擬伺服器               | 無                   | `dist/` 搜尋 `msw`、`faker`、`setupWorker`、`http.get(` 全為 0 筆                                                                                                                                            | 通過 |

#### frontend-code-boundaries（14）

| Scenario                             | 對應的規格書驗收標準 | 證據                                                                                                                                            | 結果 |
| :----------------------------------- | :------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 根目錄一次安裝即可執行前端檢查       | 無（ADR-002 D6）     | 乾淨 clone：`pnpm install --frozen-lockfile` 成功，接著 lint、typecheck、test、build 四條結束碼都是 0；專案只有根目錄 `pnpm-lock.yaml`          | 通過 |
| 手寫的 TypeScript 在提交時格式化     | 無                   | 暫存一個格式錯亂的 `.tsx` 後 `pnpm exec lint-staged`，暫存區內容被 Prettier 改寫（驗證後移除）                                                  | 通過 |
| 元件匯入頁面時 lint 失敗             | 無（F1）             | 探針：`components may not import pages (frontend-agent-rules F1 layer table)`                                                                   | 通過 |
| 功能之間互相匯入時 lint 失敗         | 無                   | 探針：`features may not import features`                                                                                                        | 通過 |
| 頁面繞過功能入口匯入時 lint 失敗     | 無                   | 探針 `src/pages/zz-probe/deep.ts`：`pages may only import a feature through its index.ts`；經 `index.ts` 匯入則不報錯（另見缺陷 3）             | 通過 |
| 只有元件展示頁可以讀對照層原文       | 無                   | 探針 `src/pages/zz-probe/raw.ts`：`Only src/pages/dev-gallery/ may read src/styles/theme.css as raw text`；`dev-gallery` 內既有的讀取 lint 通過 | 通過 |
| 功能直接呼叫 fetch 時 lint 失敗      | 無                   | 探針：`Unexpected use of 'fetch'. Get server data through the client generated in src/api/generated/`                                           | 通過 |
| 產品碼匯入模擬伺服器時 lint 失敗     | 無                   | 探針：`'msw' import is restricted … Test doubles … may only be imported by test files`                                                          | 通過 |
| 產品碼匯入產生的假資料檔時 lint 失敗 | 無                   | 探針匯入 `@/api/generated/label-suite.faker`：同上訊息                                                                                          | 通過 |
| 測試檔可以匯入模擬伺服器             | 無                   | 探針測試檔匯入 `msw`、`@/test/msw-server`、產生的假資料檔：lint 無錯誤                                                                          | 通過 |
| 原始碼出現 any 時 lint 失敗          | 無（Hard Rule 7）    | 探針：`Unexpected any. Specify a different type`（`@typescript-eslint/no-explicit-any`）                                                        | 通過 |
| 陣列索引未檢查時型別檢查失敗         | 無                   | 探針：`TS2322: Type 'number \| undefined' is not assignable to type 'number'`，`tsc -b` 結束碼 1                                                | 通過 |
| 條件式呼叫 hook 時 lint 失敗         | 無（F3）             | 探針：`React Hook "useState" is called conditionally`（`react-hooks/rules-of-hooks`）                                                           | 通過 |
| 空狀態使用 Lucide 的 Inbox 圖示      | 無（F7）             | `empty.test.tsx`；瀏覽器：展示頁有 `svg.lucide-inbox`，`aria-hidden="true"`                                                                     | 通過 |

#### frontend-i18n（9）

| Scenario                               | 對應的規格書驗收標準     | 證據                                                                                                                                                                | 結果 |
| :------------------------------------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--- |
| 介面語言依瀏覽器語言決定且請求語言一致 | 無（architecture §i18n） | 瀏覽器 `locale: zh-TW`：`navigator.language` 為 `zh-TW`，h1「系統健康檢查」，`accept-language: zh-TW`（同時證明 `main.tsx` 的 `initI18n(navigator.language)` 串接） | 通過 |
| 各種瀏覽器語言對應的介面語言           | 無                       | `resolve-language.test.ts` 八種輸入                                                                                                                                 | 通過 |
| 英文瀏覽器顯示英文介面並送出英文偏好   | 無                       | 瀏覽器 `locale: en-US`：h1 `System health check`、`accept-language: en`、標題 `Label Suite — System health check`                                                   | 通過 |
| 畫面沒有語言切換控制項                 | 無                       | `router.test.tsx` › offers no language switch；瀏覽器兩頁都沒有 combobox 或語言按鈕                                                                                 | 通過 |
| 兩份語言檔的鍵集一致                   | 無                       | `locales.test.ts` 三組                                                                                                                                              | 通過 |
| 語言檔缺鍵時測試失敗                   | 無                       | `locales.test.ts` › fails and names the missing key                                                                                                                 | 通過 |
| 開發頁的語言檔不進正式建置             | 無                       | `dist/` 搜尋 `DEV ONLY`、「系統健康檢查」、「元件展示」、`systemHealth`、`devGallery` 全為 0 筆                                                                     | 通過 |
| 開發頁載入後才有該頁的文字             | 無                       | `router.lazy-i18n.test.tsx`                                                                                                                                         | 通過 |
| 英文介面顯示後端回的英文訊息           | 無                       | 瀏覽器 en-US 503：內文正好是後端的英文 `message`                                                                                                                    | 通過 |

#### frontend-routing（7）

| Scenario                             | 對應的規格書驗收標準 | 證據                                                                                                                                                                   | 結果 |
| :----------------------------------- | :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 兩頁只在開發模式註冊並導向健康檢查頁 | 無（ADR-005 D1）     | 瀏覽器：先開 `/dev/gallery` 再開 `/`，網址變 `/dev/health`；按上一頁回到 `/dev/gallery`，不是 `/`                                                                      | 通過 |
| 開發模式下未知路徑導向健康檢查頁     | 無                   | 瀏覽器 `/no-such-page` → `/dev/health`                                                                                                                                 | 通過 |
| 開發模式可直接開啟元件展示頁         | 無                   | 瀏覽器 `/dev/gallery` 網址不變，顯示元件展示頁                                                                                                                         | 通過 |
| 正式建置剪除開發頁                   | 無                   | `dist/` 搜尋 `/dev/health`、`/dev/gallery`、`msw`、`faker` 全為 0 筆                                                                                                   | 通過 |
| 正式建置開啟根路徑只有空殼           | 無                   | preview `/`：`#root` 為空、`body` 無文字、只有 document／script／stylesheet 三個請求，fetch／xhr 0 個；`/dev/health`、`/dev/gallery` 在 preview 下同樣是空殼、0 個 XHR | 通過 |
| 健康檢查頁的瀏覽器標題               | 無                   | 瀏覽器：`Label Suite — 系統健康檢查`                                                                                                                                   | 通過 |
| 元件展示頁的瀏覽器標題               | 無                   | 瀏覽器：`Label Suite — 元件展示`                                                                                                                                       | 通過 |

合計 113 個 Scenario：112 通過、1 不通過。spec 沒描述、實作出現的額外行為：開發模式每次開健康檢查頁多一個被中止的請求（缺陷 1）；index.html 沒有 favicon，瀏覽器每次開頁有一筆 `/favicon.ico` 404 的 console error（缺陷 4）；開發模式 console 有 React Router v7 future flag 警告（warning，不是 error）。

### 先前留給驗收的瀏覽器檢查

| 項目                                              | 結果 | 證據                                                                                                                                                                        |
| :------------------------------------------------ | :--- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| token 值沒被覆寫（computed style 對 tokens.css）  | 通過 | `--color-primary`、`--color-border`、`--color-success`、`--color-surface` 的計算值依序 `#6366F1`、`#E2E8F0`、`#15803D`、`#F5F3FF`，與 `tokens.css` `:root` 相同             |
| dark 模式背景切換                                 | 通過 | 淺色 `rgb(245, 243, 255)` → 深色 `rgb(11, 11, 18)`（深色 `--color-surface: #0B0B12`）→ 移除屬性後回淺色                                                                     |
| 窄視窗時 gallery 目錄在內容上方                   | 通過 | 767px 目錄在 h1 上方；768px 目錄在左側                                                                                                                                      |
| preview 沒有 XHR                                  | 通過 | `/`、`/dev/health`、`/dev/gallery` 三條路徑都沒有 fetch／xhr，只有 3 個靜態資源請求                                                                                         |
| `main.tsx` 的 `initI18n(navigator.language)` 串接 | 通過 | 瀏覽器語言 zh-TW → 中文介面、`Accept-Language: zh-TW`；en-US → 英文介面、`Accept-Language: en`                                                                              |
| Tailwind 原色 class 不產生                        | 通過 | `index.css` 以 `@theme { --color-*: initial; }` 清掉預設色盤；建置的 CSS 沒有 `.bg-red-500` 這類 class、沒有 `oklch(`；唯一同名的 `--color-slate-50` 來自 `tokens.css` 本身 |

### Decision Table

本 change 沒有登入、角色與任務：兩個開發頁是公開頁面，沒有系統角色或任務成員身分的分支，所以矩陣的「角色 × 任務身分」軸只有「未登入（任何呼叫端）」一種值；以「建置模式 × 頁面 × 後端回應 × 介面語言 × 使用者動作」展開。

| 建置模式 | 頁面                               | 後端回應／輸入                                                                                                 | 語言      | 動作                              | 預期                                        | 驗證方式                                      | 結果                               |
| :------- | :--------------------------------- | :------------------------------------------------------------------------------------------------------------- | :-------- | :-------------------------------- | :------------------------------------------ | :-------------------------------------------- | :--------------------------------- |
| dev      | `/dev/health`                      | 200 成功外層（真實後端）                                                                                       | zh-TW     | 開頁                              | 正常、四列、1 個請求                        | 瀏覽器（自動）                                | 畫面通過；請求數 **2**（缺陷 1）   |
| dev      | `/dev/health`                      | 200 成功外層                                                                                                   | en        | 開頁                              | 英文介面、`Accept-Language: en`             | 瀏覽器 + 單元                                 | 通過                               |
| dev      | `/dev/health`                      | 尚未回應                                                                                                       | zh-TW     | 開頁                              | 載入中、`aria-busy`、按鈕 `aria-disabled`   | 瀏覽器 + 單元                                 | 通過                               |
| dev      | `/dev/health`                      | 尚未回應、reduced motion                                                                                       | zh-TW     | 開頁                              | 圖示不轉、文字可見                          | 瀏覽器                                        | 通過                               |
| dev      | `/dev/health`                      | 503 `DATABASE_UNAVAILABLE`                                                                                     | zh-TW／en | 開頁                              | 專屬標題、message 原樣、主色按鈕            | 瀏覽器 + 單元                                 | 通過                               |
| dev      | `/dev/health`                      | 500 `INTERNAL_ERROR`、404 `NOT_FOUND`、422                                                                     | zh-TW     | 開頁                              | 通用標題                                    | 瀏覽器（500、404）+ 單元（422）               | 通過                               |
| dev      | `/dev/health`                      | 連線被拒／502 HTML／逾時 15 秒                                                                                 | zh-TW     | 開頁                              | 連不到後端，`network`／`network`／`timeout` | 瀏覽器 + 單元                                 | 通過                               |
| dev      | `/dev/health`                      | 503 → 成功                                                                                                     | zh-TW     | 按重新檢查                        | 載入中 → 正常，焦點留在按鈕                 | 瀏覽器 + 單元                                 | 通過                               |
| dev      | `/dev/health`                      | 進行中                                                                                                         | zh-TW     | 再點一次 + Enter + Space          | 只送 1 個請求                               | 瀏覽器 + 單元                                 | 通過（滑鼠再點後焦點掉落，缺陷 2） |
| dev      | `/dev/health`                      | 背景更新進行中                                                                                                 | zh-TW     | 按重新檢查                        | 不顯示載入、不中止、不重送                  | 瀏覽器 + 單元                                 | 通過                               |
| dev      | `/dev/gallery`                     | （不呼叫後端）                                                                                                 | zh-TW     | 切主題、點目錄、reload、Tab+Space | 主題正確、不寫 storage、0 個後端請求        | 瀏覽器 + 單元                                 | 通過                               |
| dev      | `/dev/gallery#badge`               | —                                                                                                              | zh-TW     | 開頁                              | 只有 Badge 帶 `aria-current`                | 瀏覽器 + 單元                                 | 通過                               |
| dev      | `/dev/gallery`                     | 寬 767／768                                                                                                    | zh-TW     | 開頁                              | 目錄在上方／左側                            | 瀏覽器                                        | 通過                               |
| dev      | `/`、`/no-such-page`               | —                                                                                                              | zh-TW     | 開頁                              | 以 replace 導向 `/dev/health`               | 瀏覽器 + 單元                                 | 通過                               |
| prod     | `/`、`/dev/health`、`/dev/gallery` | —                                                                                                              | zh-TW     | 開頁                              | 空殼、0 個 XHR                              | preview 瀏覽器 + 單元                         | 通過                               |
| 設定     | `VITE_API_BASE_URL`                | 空／`undefined`／絕對網址／缺協定／結尾斜線／`ftp://`／前置空白                                                | —         | 啟動                              | 前三種接受，其餘啟動丟錯且不送請求          | 單元（`src/api/config.test.ts` 14 條）        | 通過                               |
| —        | `apiFetch`                         | 成功／204／錯誤外層（缺 `errors` 鍵、422）／非外層 2xx／空 502 帶追蹤標頭／形狀不符 JSON／連線失敗／逾時／取消 | zh-TW／en | 呼叫                              | 對應 contract 的回傳或 `ApiError`           | 單元（`mutator.test.ts`、`envelope.test.ts`） | 通過                               |

### Hard Rule 必驗項

| 規則               | 怎麼驗的                                                                                                                                                                                                                                                                                                          | 結果   |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 5 任務設定驅動     | 本 change 不含任務、`input_type` 或 `outputs[]` 的任何邏輯，沒有可替換的任務類型組合；以 `grep` 確認 `frontend/src` 沒有任務類型的分支。此項不適用，記錄為 N/A                                                                                                                                                    | 不適用 |
| 6 測試集答案不外露 | 本 change 沒有標記員角色也沒有登入，改以「任何呼叫端都能到達的東西」驗：`/dev/health` 唯一打的端點 `GET /api/v1/health` 回應只有 `status`、`database`、`timestamp`、`traceId`；`/dev/gallery` 0 個後端請求、樣本是固定文字；正式建置不含兩個開發頁、MSW、faker 與假資料（`dist/` 搜尋 0 筆），preview 下 0 個 XHR | 通過   |

### DoD

| 項目                                         | 指令                                                                                                                                                    | 結果                                                                                                                                                                                                                                                                                                                                                           |
| :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 每個 Scenario 驗證通過                       | 見上表                                                                                                                                                  | **不通過**（1／113）                                                                                                                                                                                                                                                                                                                                           |
| Decision Table 的情境都有對應驗證            | 見上表                                                                                                                                                  | 通過                                                                                                                                                                                                                                                                                                                                                           |
| 前端 lint                                    | `pnpm --filter frontend lint --max-warnings 0`                                                                                                          | 通過，結束碼 0、0 problems                                                                                                                                                                                                                                                                                                                                     |
| 前端型別檢查                                 | `pnpm --filter frontend typecheck`（`tsc -b`）                                                                                                          | 通過，結束碼 0                                                                                                                                                                                                                                                                                                                                                 |
| 前端測試與覆蓋率                             | `pnpm --filter frontend test:coverage`                                                                                                                  | 通過：36 個檔案、321 個測試全綠。覆蓋率 Statements 98.98%（389/393）、Branches 92.85%（208/224）、Functions 99.08%（108/109）、Lines 98.95%（380/384）。**分母只含被測試載入的 43 個檔案；`src/main.tsx` 沒有任何測試匯入，不在分母內**（`coverage-final.json` 確認）；`src/api/generated/`、`src/test/`、設定檔依 `vitest.config.ts` 排除。本 change 不設門檻 |
| 前端建置                                     | `pnpm --filter frontend build`                                                                                                                          | 通過，結束碼 0：`index.html` 0.40 kB、CSS 27.44 kB、JS 355.49 kB（gzip 110.70 kB）                                                                                                                                                                                                                                                                             |
| 前端可啟動                                   | `pnpm --filter frontend dev`、`pnpm --filter frontend preview`                                                                                          | 通過（5173、4173）                                                                                                                                                                                                                                                                                                                                             |
| 乾淨 clone                                   | `pnpm install --frozen-lockfile` 後 lint／typecheck／test／build                                                                                        | 通過，四條結束碼 0；安裝只警告 `sharp` 的 build script 被略過（見殘餘風險）                                                                                                                                                                                                                                                                                    |
| 根目錄格式                                   | `pnpm format:check`                                                                                                                                     | 通過：`All matched files use Prettier code style!`                                                                                                                                                                                                                                                                                                             |
| 規格檢查                                     | `pnpm check:specs`                                                                                                                                      | 通過：`check-specs: docs OK`                                                                                                                                                                                                                                                                                                                                   |
| 腳本測試（本 change 動到 `docs/`）           | `pnpm test:scripts`                                                                                                                                     | 通過：296 pass、0 fail                                                                                                                                                                                                                                                                                                                                         |
| 文件站建置（本 change 動到 `docs/`）         | `pnpm exec notecraftapp build docs`                                                                                                                     | 通過：75 頁建置完成，沒有遇到 `~/.notecraft` 快取殘留錯誤                                                                                                                                                                                                                                                                                                      |
| OpenSpec                                     | `pnpm exec openspec validate frontend-skeleton --strict`                                                                                                | 通過：`Change 'frontend-skeleton' is valid`                                                                                                                                                                                                                                                                                                                    |
| 產物同步                                     | `pnpm --filter frontend api:generate` 後 `git diff --exit-code -- frontend/src/api/generated` 與 `git status --porcelain -- frontend/src/api/generated` | 通過，無差異                                                                                                                                                                                                                                                                                                                                                   |
| 後端 `uv run pytest`                         | —                                                                                                                                                       | 不適用：本 change 沒有修改 `backend/`（`git diff main...HEAD -- backend/` 為空）                                                                                                                                                                                                                                                                               |
| Alembic 雙資料庫 upgrade／downgrade／upgrade | —                                                                                                                                                       | 不適用：本 change 沒有 migration。啟動驗收用的後端時在 SQLite 執行過 `uv run alembic upgrade head`，成功                                                                                                                                                                                                                                                       |
| 重新匯出 `openapi.json` 無差異               | —                                                                                                                                                       | 不適用：`backend/openapi.json` 未變；前端只讀它                                                                                                                                                                                                                                                                                                                |
| 根目錄 `e2e/` Playwright 全綠                | —                                                                                                                                                       | 未建：`e2e/` 與 Playwright 依賴尚未建立（不在本 change 的 `tasks.md`，屬後續基礎建設）。本次瀏覽器驗收以 scratchpad 腳本代替，沒有留下可在 CI 重跑的 E2E                                                                                                                                                                                                       |
| 受影響文件已同步                             | 檢視 diff                                                                                                                                               | 通過：`docs/development/architecture.mdx`、ADR-003／005／008 與 `adr/index.mdx` 已隨本 change 更新，文件站建置與 `check:specs` 通過                                                                                                                                                                                                                            |

### 人工驗收步驟（留作紀錄）

1. **啟動**（三個終端機，皆在 repo 根目錄；Node 22.22.1 以上，pnpm 經 corepack）：
   1. 安裝：`corepack pnpm install --frozen-lockfile`
   2. 後端（Lite 層，**不設** `DATABASE_URL`）：
      ```bash
      cd backend
      export CORS_ALLOWED_ORIGINS=http://localhost:5173
      uv run alembic upgrade head
      uv run uvicorn app.main:create_app --factory --port 8000
      ```
      後端網址 `http://localhost:8000`，健康檢查 `http://localhost:8000/api/v1/health`。
   3. 前端開發模式：`VITE_API_BASE_URL=http://localhost:8000 corepack pnpm --filter frontend dev`，網址 `http://localhost:5173`（port 固定、被占用時直接失敗）。
   4. 正式建置（另外驗）：`corepack pnpm --filter frontend build && corepack pnpm --filter frontend preview`，網址 `http://localhost:4173`。
2. **用什麼身分登入**：不用登入。兩個開發頁是公開頁面，本 change 沒有帳號、沒有 seed 測試帳號。
3. **要點開哪幾個畫面**：
   - `http://localhost:5173/`（應被導到 `/dev/health`）
   - `http://localhost:5173/dev/health`
   - `http://localhost:5173/dev/gallery`、`http://localhost:5173/dev/gallery#badge`
   - `http://localhost:4173/`（正式建置）
4. **每一步預期看到什麼**：
   - `/` → 網址變成 `/dev/health`；按瀏覽器上一頁不會回到 `/`。
   - `/dev/health`：頁首小字「DEV ONLY · /dev/health」，標題「系統健康檢查」，分頁標題「Label Suite — 系統健康檢查」。卡片裡綠色徽章「正常」、「後端與資料庫都可以用」，下面四列：服務 `ok`、資料庫 `ok`、檢查時間是**你電腦時區**的時間，格式 `2026-11-20 18:20:45（UTC+8）`（全形括號、帶秒）、traceId 是一串 UUID。「重新檢查」是白底外框按鈕。
   - DevTools Network：對 `localhost:8000/api/v1/health` 的請求帶 `Accept-Language: zh-TW`，沒有 `Content-Type`。**目前會看到兩筆**，第一筆狀態是 canceled（缺陷 1）；修正後應只有一筆。
   - 按「重新檢查」：卡片先變成轉圈加「正在檢查後端狀態…」與三條灰色骨架，按鈕變灰，接著回到「正常」；按完後按 Tab 不會從頁首重新開始（焦點留在按鈕）。
   - `/dev/gallery`：左側「元件目錄」七個連結，右側依序 Button、Input、Badge、Alert、Card、Skeleton · Empty、Token 對照七區；Button 區標頭「variant × 6 · size × 3 · 狀態 × 2」。Token 對照四列 `--primary ← --color-primary-strong` 等。右上「淺色／深色」切換：按「深色」整頁底色變成近黑；重新整理後回到淺色；DevTools Application 的 Local Storage 與 Session Storage 都是空的。Network 面板對 `:8000` 沒有任何請求。
   - `/dev/gallery#badge`：目錄裡只有「Badge」反白。
   - 把視窗縮到 767px 以下：目錄移到頁面最上方、標題「元件展示」之上。
   - `http://localhost:4173/`：完全空白頁，分頁標題「Label Suite」；Network 只有 html、一支 JS、一支 CSS，沒有 Fetch/XHR。開 `http://localhost:4173/dev/health` 也是空白。
5. **刻意要試的失敗路徑**：
   - 停掉後端再按「重新檢查」：黃色提示「連不到後端」，說明提到 `VITE_API_BASE_URL`，錯誤類型 `network`，traceId「無（請求沒有送達）」，按鈕變成紫色實心。
   - 資料庫無法連線：停掉後端，改以 `DATABASE_URL=postgresql://nobody:x@127.0.0.1:1/none uv run uvicorn app.main:create_app --factory --port 8000` 重新啟動後端（不跑 migration；引擎在請求時才連線）再按「重新檢查」，預期紅色提示「資料庫無法連線」、內文是後端回的中文訊息、錯誤碼 `DATABASE_UNAVAILABLE`、traceId 一串 UUID。（本次驗收以 `page.route` 製造 503，沒有實際起不可達的 PostgreSQL。）
   - 英文：Chrome 設定把語言改成 English (United States) 置頂，或用 `--lang=en-US` 開新的瀏覽器，開 `/dev/health`：標題「System health check」，請求 `Accept-Language: en`，畫面上沒有中文。
   - 減少動態：macOS「輔助使用 → 顯示器 → 減少動態」打開後，載入中的轉圈圖示不轉，文字照常。
   - 不合法的基底網址：`VITE_API_BASE_URL=localhost:8000 corepack pnpm --filter frontend dev`，開頁面 console 出現含 `VITE_API_BASE_URL` 的錯誤，Network 沒有任何對後端的請求。
6. **收尾**：三個終端機各按 Ctrl+C。後端的 SQLite 檔在 `backend/data/label_suite.db`（預設路徑），是本機資料，不進版控，要清可以自行刪除；`frontend/dist/`、`frontend/coverage/` 已被 `.gitignore` 排除。

### 缺陷

1. **開發模式開啟健康檢查頁送出 2 個請求（規格與實作行為矛盾，需決議）**
   - 對應 Scenario：`dev-health-page`「開啟頁面只呼叫健康檢查端點」（連帶：`frontend-api-client`「伺服器錯誤後不自動重試」在瀏覽器裡同樣看到 2 個請求，其中 1 個是中止的，不是重試）
   - 預期／實際：預期整個過程只送出 1 個 `GET /api/v1/health`；實際在開發模式（兩頁唯一存在的模式）送出 2 個，第 1 個 `net::ERR_ABORTED`，後端 uvicorn log 每次開頁記到 2 筆 `GET /api/v1/health`。
   - 原因：`frontend/src/main.tsx` 以 `<StrictMode>` 包住 `<App>`；React 19 在開發模式會掛載 → 卸載 → 再掛載。spec `frontend-api-codegen` 要求產生的呼叫函式「傳入取消訊號」（`orval.config.ts` 的 `query.signal: true`），查詢函式讀了 `signal`，卸載時 TanStack Query 因沒有觀察者而取消請求，再掛載時重新送出。單元測試以 `render` 直接掛載、不包 `StrictMode`，所以沒有抓到；`toHealthViewState` 對 `aborted` 回 `null` 的設計讓畫面不受影響，但請求數已違反 Scenario。spec、design 與 system-design 都沒有提到 `StrictMode`。
   - 重現步驟：照「人工驗收步驟」啟動後端與前端，Chrome 開 `http://localhost:5173/dev/health`，DevTools Network 篩選 `health`：兩筆，第一筆 canceled。自動化：scratchpad `accept-dev.cjs` 第 1 段「health: only 1 API request」。
   - 為什麼不自己判定：可行的收斂方式有兩種，改的是不同層，屬規劃決定——(a) 實作端移除 `main.tsx` 的 `StrictMode`（或改成不在開發頁觸發雙重掛載），讓 Scenario 照字面成立；(b) 規格端把 Scenario 改寫成「只有 1 個完成的請求；開發模式 StrictMode 中止的那一次不計」，並補一條以 `StrictMode` 包住的測試鎖住「中止的請求不改變畫面」。兩者都不違反既有決議，但選哪一邊會改變 spec 或 `main.tsx` 的承諾，交給 planner／維護者。
   - 負責角色：planner（決定 spec 或實作哪一邊改），之後 frontend-developer 落實

2. **[Medium][Non-blocking] 請求進行中用滑鼠再點「重新檢查」，焦點掉到 `body`**
   - 對應 Scenario：`dev-health-page`「請求進行中重複按下不送出額外請求」（Scenario 只斷言請求數，通過）；Requirement「重新檢查重新取得結果且焦點留在按鈕」與 `ui-design.md` §無障礙「忽略點擊與 Enter／Space，焦點留在按鈕上」
   - 預期／實際：預期再點一次被忽略、焦點仍在按鈕；實際 `Button` 的 `aria-disabled:pointer-events-none` 讓滑鼠點擊穿透到下方卡片，焦點移到 `body`。鍵盤 Enter／Space 不受影響（焦點仍在按鈕）。
   - 重現步驟：在 `/dev/health` 讓後端慢回應（或以 `page.route` 攔住），點「重新檢查」後再點一次，`document.activeElement` 變成 `BODY`。自動化：`accept-dev.cjs` 第 6 段的 focus trail（`click1 BUTTON | loading BUTTON | click2 BODY`）。
   - 負責角色：frontend-developer（可行的最小修正：`aria-disabled` 時不加 `pointer-events-none`，改在 `onClick` 忽略；需先確認 Button 原語 loading 狀態的同一行為）

3. **[Medium][Non-blocking] 直接放在 `src/pages/` 根層的檔案不受分層規則檢查**
   - 對應 Scenario：`frontend-code-boundaries`「頁面繞過功能入口匯入時 lint 失敗」（放在 `src/pages/<page>/` 子目錄時通過）
   - 預期／實際：`src/pages/zz-probe-deep.ts`（不在子目錄）直接匯入 `@/features/zz-other/inner`，eslint **沒有**報錯；同內容放在 `src/pages/zz-probe/deep.ts` 才報 `pages may only import a feature through its index.ts`。目前沒有任何檔案放在 `src/pages/` 根層，所以不是現存違規，是 lint 的覆蓋缺口。
   - 重現步驟：建立 `frontend/src/pages/x.ts` 內容 `import { inner } from "@/features/<某功能>/inner";`，執行 `corepack pnpm --filter frontend exec eslint src/pages/x.ts`，結束碼 0。
   - 負責角色：frontend-developer

4. **[Low][Non-blocking] 每次開頁都有 `/favicon.ico` 404 的 console error**
   - 對應 Scenario：無（spec 沒描述的額外行為；驗收標準要求 console error 為零）
   - 預期／實際：`frontend/index.html` 沒有 `<link rel="icon">`，Chrome 自動請求 `/favicon.ico` 得到 404，console 記一筆 `Failed to load resource: … 404`。開發與 preview 都會出現。
   - 重現步驟：開任一頁，DevTools Console。
   - 負責角色：frontend-developer（或併入之後的品牌資產工作）

### 殘餘風險

- **`sharp` 的 build script 被 pnpm 略過**：乾淨 clone `pnpm install --frozen-lockfile` 印出 `Ignored build scripts: sharp.`（`esbuild`、`msw` 已在 `pnpm-workspace.yaml` 的 `onlyBuiltDependencies`，沒有警告）。`sharp` 是 `notecraftapp`（Astro）的傳遞依賴，前端不使用。本次文件站建置在略過狀態下成功（75 頁），但若之後文件站要處理圖片最佳化，可能需要把 `sharp` 加入 `onlyBuiltDependencies`。
- **根 lockfile 中 `notecraftapp` 的 `typescript` 解析由 5.9.3 變成 6.0.3**：因為前端以 `typescript@6.0.3` 寫死，pnpm 把同一個 peer 解析到 6.0.3（`main` 是 `notecraftapp@1.15.0(…)(typescript@5.9.3)`，本分支是 `(typescript@6.0.3)`，連帶 `astro@5.18.2` 也是）。本次 `pnpm exec notecraftapp build docs` 以 6.0.3 建置成功、沒有遇到 `~/.notecraft` 快取殘留錯誤，`check:specs`、`test:scripts` 也通過；風險在 Astro 對 TypeScript 6 的型別檢查路徑（例如 `astro check`）未被本次涵蓋。
- **沒有可重跑的 E2E**：根目錄 `e2e/` 與 Playwright 依賴尚未建立，本次瀏覽器驗收的腳本留在 session scratchpad，不進版控；回歸要靠之後建立 `e2e/` 時把這些檢查搬進去。
- **背景更新的瀏覽器驗證以合成事件觸發**：以 `window.dispatchEvent(new Event("visibilitychange"))` 搭配改寫 `document.visibilityState` 模擬切回分頁，與真實切換分頁的事件來源不同；單元測試另有覆蓋。
