# Proposal

## Why

`frontend/` 還不存在。後端骨架（#504，PR #520）已經把統一回應外層、錯誤碼與 `backend/openapi.json` 定下來，但前端沒有唯一出口、產生的呼叫層與共用元件，之後每個前端功能 change（第一個是規格 01-01 登入）只能各自組 HTTP 呼叫、各自處理外層與錯誤，契約會在第一批模組就分岔。Epic #502 §需求目標要一條健康檢查請求走完整條契約鏈，`openspec/config.yaml` 的 `operations.apply.guidance` 也在等這個 change 補上前端的檢查指令，因此由 #505 先把前端骨架、契約管線與兩個開發用畫面建起來，讓後續 change 只要在 `features/`、`pages/` 底下新增就能拿到產生的型別、查詢 hooks 與共用元件（#505 §需求目標）。

本 change 沒有 `docs/specs/` 規格可追溯（spec-migration §決議 D4：foundation 屬技術規範），需求依 `openspec/config.yaml` `context`（維護者 2026-11-20 裁定，#503）追溯到 ADR 與規則文件的條號。上游四份產出列的待決問題，已由維護者於 2026-11-20 在 `clarification.md` 全數決議（Q1–Q19，P1 另行修正）；本 proposal 依決議撰寫，各決議如何影響範圍見 [§已定案的決議與範圍](#已定案的決議與範圍)。specs、design、tasks 不得重新討論這些決議。

## What Changes

範圍以 #505 §使用情境／功能範圍「包含」十二項為準（system-analysis §範圍），加上 clarification Q5 新增的語系層：

- 新增 `frontend/` 的 pnpm 專案，並納入**根目錄 pnpm workspace**：新增 `pnpm-workspace.yaml`，`frontend/` 是 workspace 套件，共用根目錄一份 `pnpm-lock.yaml` 與 Prettier，會修改根目錄 `package.json`（Q7）。技術棧為 Vite、React 19、TypeScript strict（不開 `exactOptionalPropertyTypes`，其他嚴格旗標照開，N4）；初始版號 `0.0.0`，沿用後端 clarification Q7（Hard Rule 3、4，ADR-002 D6）。
- 七層目錄 `app/`、`pages/`、`features/`、`components/ui/`、`api/`、`lib/`、`styles/` 的骨架，以 ESLint 把 F1 的分層表與 F2 的禁用 `any` 寫成機械檢查；同一份設定擋住日期套件散落、繞過唯一出口直接發請求、網路替身與測試支援進入產品碼（ADR-005 D2、F1、F2、F10、A6、T6、Hard Rule 7）。Token 對照區塊以 `?raw` 讀 `styles/theme.css`，lint 規則對這一個檔案具名放行並註明理由（Q16）。
- 客戶端路由（React Router v6）：`/dev/health` 與 `/dev/gallery` **只在 Vite 開發模式註冊，正式建置剪除**；開發模式下 `/` 與未知路徑都導向 `/dev/health`；正式建置只有空殼，首頁與找不到頁面由 01-01 設計（ADR-005 D1、#505 維護者留言；Q1、Q14）。
- 伺服器資料快取（TanStack Query）：**不自動重試**，認證錯誤只認 `401`（`403` 不算），寫入不自動重送（A7、A9；Q4）。
- 由 `backend/openapi.json` 一條指令（`pnpm api:generate`，**只跑 Orval，不含後端匯出**）產生呼叫層到 `src/api/generated/`，產物不手改、不加檔、不受 lint、不進覆蓋率分母、進 `.prettierignore`；並定義什麼算產物漂移（A4、A5、ADR-003 D6、T10；Q8、Q12）。從匯出到產生的整條鏈由 #506 的根目錄指令串起。
- 唯一出口（Orval 的 mutator）：前端唯一的 HTTP 邊界，負責組網址、帶憑證與語言偏好、取消與 **15 秒請求逾時**、拆統一回應外層，成功時回傳 `{data, meta:{traceId, timestamp}}`，並把**任何**失敗轉成單一錯誤型別 `ApiError`（帶狀態、錯誤碼、訊息、追蹤編號、`timestamp` 與錯誤類型）；`errors` 缺鍵視同 `null`（A6、A7、S2、`api-contract.md` §錯誤正規化契約；Q2、Q4、Q19）。
- **語系層（新增能力，Q5）**：react-i18next，介面文字有繁中（zh-TW）與英文（en）兩份；語言依 `navigator.language` 判斷（`zh` 開頭用 zh-TW，其餘用 en）；畫面不加切換控制項；`Accept-Language` 與介面語言一致；兩頁的介面文字都走翻譯鍵、不寫死中文字串；測試以指定語言執行（architecture.mdx §i18n 兩層）。
- 網路替身（MSW）：只給測試用，Orval 產生的 `*.msw.ts` 與 faker 同樣不進正式 bundle，lint 擋住產品碼 import；開發時不能在瀏覽器切換替身（Q6）。fixture 一律以固定值覆寫產生的 handler，帶 `X-Correlation-ID` 與 `Content-Language`，`503` 外層手組、型別取自產物（T6、`api-contract.md` §MSW 四種狀態的 fixture；Q19 C1–C3）。
- Vitest 加 React Testing Library 的 unit 與 integration 測試，測試檔與原始碼同目錄（T1、T2、ADR-007 D1、D3）。`vitest --coverage` 產報告，分母排除 `src/api/generated/`，第一次數字記進 `acceptance.md`；**不設門檻、不擋 CI**（Q12）。
- shadcn/ui 元件原語放進 `components/ui/`，加上對照 `design/prototype/assets/tokens.css` 的語意變數對照層：元件只用語意名稱，色值只來自色值來源，對照層不寫任何色值（ADR-005 D3、D4、F6）。**允許修改 shadcn 原語的原始碼加 variant**，對照層新增 `--cta`、`--success` 等語意變數；每個原語匯出 `as const` 的 variant 陣列；Button 不保留 `link` variant，只宣告 artifact 的六種（Q9、Q10）。對照層同時對應深色（`html[data-theme="dark"]`）（Q13）。
- `tokens.css` 的引入：以一支小 Vite 外掛在建置時只抽出 `:root` 與 `html[data-theme="dark"]` 的自訂屬性，產物不提交；不載入外部字型、不套用元素規則；圓角與字型仍以 tokens.css 的值為準（Q15）。
- `src/lib/date.ts`：day.js 的單一入口，時間點以 UTC 傳輸、顯示依瀏覽者裝置時區（F10、#503 裁定 5、規格 07-01 §規格 語言切換 第 5 條）；開發頁的檢查時間顯示 `YYYY-MM-DD HH:mm:ss（UTC+8）`，作為開發頁例外記錄，業務頁仍依 `brand.md` 的 `YYYY-MM-DD HH:mm`（Q18）。
- `/dev/gallery` 元件展示頁與完整性測試：元件宣告的 variant 少展示一個、或新增的原語沒放進展示頁，測試就失敗；完整性測試在執行期比對各原語匯出的 variant 陣列與展示內容（ADR-005 D3、#503 裁定 4、#505 §驗收條件第 4 項；Q9）。標題列右側有「淺色／深色」切換，只改 `<html data-theme>`，預設淺色、不記住選擇（Q13）。
- `/dev/health` 健康檢查頁，作為端到端的證明：經 `getHealth` 顯示載入中／正常／資料庫無法連線／連不到後端四種狀態，並可重新檢查；在網路替身與真實後端下都顯示對應狀態（Epic #502 §需求目標、#505 §驗收條件第 3 項）。所有錯誤外層走〔503〕的錯誤版面，標題用通用的「後端回報錯誤」並列錯誤碼與訊息；不是外層的回應歸〔連不到後端〕，「錯誤類型」列直接顯示 `network` 或 `timeout`（Q3）。兩頁是 07-01「不出現系統內部資料」的例外，照 artifact 顯示錯誤碼、traceId 與設定名；本次不做業務頁共用的錯誤元件（Q11）。
- 工具設定：`.prettierignore` 加入 `frontend/src/api/generated/`；`.lintstagedrc.mjs` 加上 `ts,tsx`，手寫 ts 在 commit 時就格式化（Q8）。
- 在 `openspec/config.yaml` 的 `operations.apply.guidance` 補上前端的檢查指令：lint、型別檢查、測試、建置與產物漂移檢查（#505 §驗收條件第 5 項、Epic #502 §承接的延後條文）；並在 apply 時把 `rules.ui-design` 的 ADR 引用由 ADR-004 改為 ADR-005（clarification P1）。

畫面閘門：兩頁是新畫面，維護者已核可畫面 artifact（`Main.dc.html`、`Gallery.dc.html`），並於 2026-11-20 確認**第 4 版**（含 Q13 元件展示頁的「淺色／深色」切換），Ready gate 已過；本 change 不改 `design/prototype/`。會讓畫面偏離已核可 artifact 的實作細節，一律回到維護者，不在 apply 中自行調整（`AGENTS.md` §Project Board and Dispatch Ready gate）。

不包含（#505 §不包含、Epic #502、#506）：

- 登入、路由守衛、CSRF 標頭、`401` 的換發與重送、登出時清空快取：屬規格 01-01 登入（A6、A7、A9）。
- 任何業務頁面、側欄與登入外框、語言與外觀的**使用者切換控制項**（07-01；本次只有語系層與展示頁的主題切換）、標記 widget、業務頁共用的錯誤元件與首頁／找不到頁面（01-01）。
- 容器編排、`.env.example`、e2e、CI 的前端 job 與各項 gate（漂移比對、覆蓋率門檻、分層檢查在 CI 執行、後端匯出到產生的整條鏈指令）：屬 #506。本次只提供可被呼叫的指令。
- 修改 `backend/` 與 `backend/openapi.json`、`docs/specs/`、`design/prototype/`（含 `tokens.css`，只讀）。fixture 差異由前端覆寫處理（Q19），不需要後端配合。

**BREAKING：無。** 後端契約沒有改變，`frontend/` 是第一次建立。但本次定下的前端側約定一旦被功能 change 使用，之後改動屬 A10 的破壞性變更：唯一出口的回傳形狀 `{data, meta}`（Q2）、單一錯誤型別 `ApiError` 的欄位與錯誤類型值、產物的路徑與匯出名稱（`api-contract.md` §端點總覽）。

## Capabilities

### New Capabilities

- `frontend-api-client`：前端唯一的 HTTP 邊界與伺服器資料快取的預設行為。請求帶憑證與語言偏好、只在有 body 時帶內容型別、取消與逾時；成功時拆統一回應外層；任何失敗都轉成單一錯誤型別（錯誤類型 `http`／`network`／`timeout`／`invalidResponse`／`aborted`，與各自帶的狀態、錯誤碼、訊息、追蹤編號、逐欄位錯誤）；外層的判定規則；不自動重試、請求逾時 15 秒、`isAuthError` 只認 `401`、寫入不自動重送；成功回傳 `{data, meta:{traceId, timestamp}}`，`ApiError` 也帶 `timestamp`；`errors` 缺鍵視同 `null`。
- `frontend-api-codegen`：由已提交的 `backend/openapi.json` 一條指令重產呼叫層與網路替身；產物位置、產物不手改不加檔、query key 只來自產物、產生的識別字，以及「什麼算漂移」的判定。
- `frontend-code-boundaries`：前端原始碼的機械檢查（含 Token 對照區塊讀 `styles/theme.css` 的具名放行）。七層之間允許的引用方向、功能之間不互相引用、頁面只經功能的公開入口引用、禁用 `any`、日期套件只在單一入口使用、產品碼不得繞過唯一出口直接發請求、網路替身與測試支援不得進入產品碼；違反時 lint 或型別檢查失敗。
- `frontend-routing`：前端有哪些路徑、各在哪種建置出現。兩條開發用路徑只在開發模式註冊、正式建置剪除；開發模式下根路徑與不存在路徑導向 `/dev/health`；正式建置只有空殼。
- `frontend-i18n`：react-i18next 語系層。zh-TW 與 en 兩份介面文字、依 `navigator.language` 判斷（`zh` 開頭用 zh-TW，其餘 en）、不提供切換控制項、`Accept-Language` 與介面語言一致、兩頁文字走翻譯鍵、測試可指定語言。
- `design-token-mapping`：元件原語只用語意變數名、語意變數只對照到 `tokens.css` 的變數、對照層不含任何色值；新增 `--cta`、`--success` 等語意變數；同時對應深色（`html[data-theme="dark"]`），由 `data-theme` 屬性驅動；以建置時的 Vite 外掛只抽出 tokens.css 的自訂屬性，不載入外部字型與元素規則。
- `date-time-display`：日期時間的單一入口。時間點以 UTC 傳輸與保存，顯示依瀏覽者裝置時區；同一個 UTC 時間點在不同時區的顯示結果；不依賴真實時間即可測試。
- `component-gallery`：`/dev/gallery` 展示每個元件原語宣告的每一個 variant、狀態與 token 對照；完整性檢查以各原語匯出的 `as const` variant 陣列在執行期比對，漏展示 variant 或漏放原語時失敗；標題列有「淺色／深色」切換（預設淺色、不記住選擇）。
- `dev-health-page`：`/dev/health` 依 `getHealth` 的結果顯示載入中、正常、資料庫無法連線、連不到後端四種狀態，各狀態顯示的欄位，重新檢查回到載入中，所有錯誤外層走〔503〕錯誤版面（通用標題「後端回報錯誤」），非外層的回應歸〔連不到後端〕並顯示 `network` 或 `timeout`；檢查時間格式 `YYYY-MM-DD HH:mm:ss（UTC+8）`。

### Modified Capabilities

無。本 change 只消費既有的 `api-envelope`、`health-check`、`request-correlation`、`response-localization`、`api-schema-export`，不改它們的 requirement（system-analysis §需求依據 `openspec/specs/` 列、`api-contract.md` 開頭「本次無後端 API 變更」）。`user-management` 與本 change 沒有重疊。

## Impact

- **新增程式**：`frontend/` 整個目錄（專案設定、ESLint／TypeScript／Vitest／Orval／shadcn 設定、七層骨架、唯一出口與錯誤型別、產物、`features/system-health`、兩個開發用頁面、對照層、日期入口、測試支援）；目錄配置見 `system-design.md` §目錄結構。
- **新增依賴**：前端套件（含 react-i18next）一律以 `pnpm add` 加入（Hard Rule 3）；套件清單由 `design.md` 依 `system-design.md` 列出。`frontend/package.json` 初始版號 `0.0.0`（Hard Rule 4）。
- **API**：無新增或修改；第一次消費 `GET /api/v1/health`（`getHealth`，刻意公開，後端 clarification Q4）。
- **修改設定**：`openspec/config.yaml` 的 `operations.apply.guidance` 寫入前端檢查指令，之後每個動到 `frontend/` 的 change 都依它跑；apply 時另把 `rules.ui-design` 的 ADR-004 改為 ADR-005（P1）。根目錄 `package.json` 與新增 `pnpm-workspace.yaml`（Q7，必要時 `scripts/setup.sh` 確認 `pnpm install` 一次裝好）；`.prettierignore`、`.lintstagedrc.mjs`（Q8）。
- **後續與範圍外的工作**：另開一張 `[Docs]` issue，把 `docs/development/architecture.mdx`「shadcn 元件不改寫」那句改準（Q9）；本 change 不改該檔。#506 的跨 change 依賴寫在 design.md：前端 Docker build context 含 `design/prototype/assets/`、`.env.example` 有 `CORS_ALLOWED_ORIGINS=http://localhost:5173` 與 `VITE_API_BASE_URL=http://localhost:8000`、容器內改以後端 `/api/v1/health` 驗證或把 E2E 跑在開發伺服器上（Q1）。
- **資料模型**：無。資料表字典、ER 與 migration 都不動。
- **讀取但不修改**：`backend/openapi.json`（產生的唯一輸入）、`design/prototype/assets/tokens.css`（色值來源，位於 `frontend/` 之外）。
- **權限與答案隔離**：本次沒有受保護的能力，PRD §權限矩陣不適用；唯一呼叫的端點刻意公開，所有呼叫端拿到的內容相同。Hard Rule 5、6 本次不適用：唯一出口、錯誤型別與快取不認識任何 `operationId` 或任務類型，網路替身的範例資料不含答案；延續到後續的約束（標記 widget 的 variant 依設定來自 widget 自己的宣告、產生的替身資料不含答案要靠後端 S5）見 `system-design.md` §權限檢查點。
- **下游**：#506（前端 lint、型別檢查、測試、建置與重產指令；產物位置供漂移比對與覆蓋率排除；分層檢查規則；開發時的 `VITE_API_BASE_URL` 與後端 `CORS_ALLOWED_ORIGINS` 範例值；前端容器的 build context 要含 `design/prototype/assets/`；容器內驗收改以後端 `/api/v1/health` 或開發伺服器上的 E2E，Q1）；規格 01-01 登入（唯一出口加 CSRF 標頭與 `401` 換發、快取的登出清空、路由守衛與登入頁、元件原語）；07-01 共用介面（語言切換控制項、錯誤顯示的露出程度）；之後所有前端模組（七層目錄、產生的型別與 hooks、單一錯誤型別、日期入口、元件展示頁）。

## 引用的需求來源

- 維護者指定：Issue #505 §使用情境／功能範圍「包含」十二項與「不包含」兩項、§需求目標、§驗收條件五項、§畫面閘門；#505 維護者留言（2026-11-20：畫面 artifact 核可、`/dev/health` 四種狀態、`/dev/gallery` 七個區塊、兩頁只在開發環境出現）；畫面 artifact `Main.dc.html`、`Gallery.dc.html` 與 canvas 假設 1–4；Epic #502 §需求目標、§承接的延後條文；#503 裁定 1–5；#506 §包含、§驗收條件（下游）；後端 `clarification.md` Q2、Q3、Q4、Q7、Q8（`openspec/changes/archive/2026-11-20-backend-skeleton/`）。
- `docs/specs/`：規格 07-01 §卡控機制「系統要向使用者顯示錯誤」、§邊界情況「從來沒設定過語言」、§規格 語言切換 第 5 條；其餘無對應規格頁（spec-migration §決議 D4）。
- ADR：ADR-002 D6；ADR-003 D5（含 2026-11-20 決策紀錄）、D6；ADR-004 D1 §後果、D3；ADR-005 D1、D2、D3、D4、D5；ADR-007 D1、D2、D3。
- 規則文件：frontend-agent-rules 前提、F1、F2、F3、F4、F6、F7、F8、F9、F10；api-agent-rules A4、A5、A6、A7、A8、A9、A10；security-agent-rules S2；testing-agent-rules T1、T2、T3、T6、T9、T10、T11。
- `AGENTS.md` Hard Rule 3、4、5、6、7、9，Required Behaviors（pre-commit 格式化）；`docs/development/architecture.mdx` §技術選型、§目錄結構（目標）、§API 契約、§i18n 兩層、§前端、§測試分層；`openspec/config.yaml` `operations.apply.guidance`「前端的檢查指令等 frontend/ 骨架 change（#505）建好再補進這一節」。
- 既有主規格（只消費）：`api-envelope`、`health-check`、`request-correlation`、`response-localization`、`api-schema-export`。

## 已定案的決議與範圍

依據 `clarification.md` §決議（Q）。下表只列對範圍有影響的決議；其餘（Q2、Q3、Q4、Q6、Q10、Q11、Q12、Q16、Q17、Q18、Q19）已併入上面的 What Changes 與 Capabilities，細節由 specs、design 承接。

| 決議 | 對範圍的影響                                                                                   |
| :--- | :--------------------------------------------------------------------------------------------- |
| Q1   | 兩頁只在開發模式註冊；`frontend-routing` 有「正式建置剪除」requirement；#506 驗收換驗證對象    |
| Q5   | **新增 capability `frontend-i18n`**；`frontend-api-client` 的 `Accept-Language` 與介面語言一致 |
| Q7   | 新增 `pnpm-workspace.yaml`、修改根目錄 `package.json`、共用 lockfile                           |
| Q8   | 新增 `.prettierignore` 條目、`.lintstagedrc.mjs` 加 `ts,tsx`；`api:generate` 只跑 Orval        |
| Q9   | 允許改 `components/ui/` 原語；另開 `[Docs]` issue 改 architecture.mdx（不在本 change）         |
| Q13  | 對照層含深色；展示頁多一個主題切換（artifact 第 4 版已確認）                                   |
| Q14  | 開發模式下 `/` 與未知路徑導向 `/dev/health`                                                    |
| Q15  | 多一支建置時抽取 tokens 的 Vite 外掛（需測試）                                                 |
| P1   | apply 時修正 `openspec/config.yaml` `rules.ui-design` 的 ADR 編號                              |

延續約束：N3（`{data, meta}` 回傳形狀能否穿過 Orval 產物）是技術風險，apply 第一組先驗證，失敗是故障，停下來回到 clarification。
