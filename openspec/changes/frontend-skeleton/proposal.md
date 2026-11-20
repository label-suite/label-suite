# Proposal

## Why

`frontend/` 還不存在。後端骨架（#504，PR #520）已經把統一回應外層、錯誤碼與 `backend/openapi.json` 定下來，但前端沒有唯一出口、產生的呼叫層與共用元件，之後每個前端功能 change（第一個是規格 01-01 登入）只能各自組 HTTP 呼叫、各自處理外層與錯誤，契約會在第一批模組就分岔。Epic #502 §需求目標要一條健康檢查請求走完整條契約鏈，`openspec/config.yaml` 的 `operations.apply.guidance` 也在等這個 change 補上前端的檢查指令，因此由 #505 先把前端骨架、契約管線與兩個開發用畫面建起來，讓後續 change 只要在 `features/`、`pages/` 底下新增就能拿到產生的型別、查詢 hooks 與共用元件（#505 §需求目標）。

本 change 沒有 `docs/specs/` 規格可追溯（spec-migration §決議 D4：foundation 屬技術規範），需求依 `openspec/config.yaml` `context`（維護者 2026-11-20 裁定，#503）追溯到 ADR 與規則文件的條號。上游四份產出列了大量待決問題，**本 proposal 不替任何一題做決定**：下列能力與影響範圍在每一個候選選項下都成立，會因選項改變範圍的地方集中列在 [§可能改變範圍的待決問題](#可能改變範圍的待決問題)，由 clarification 停點定案後再寫 specs、design、tasks。

## What Changes

範圍以 #505 §使用情境／功能範圍「包含」十二項為準（system-analysis §範圍）：

- 新增 `frontend/` 的 pnpm 專案：Vite、React 19、TypeScript strict（額外旗標見 N4）；初始版號 `0.0.0`，沿用後端 clarification Q7（Hard Rule 3、4，ADR-002 D6）。專案是獨立專案或根目錄工作區見待決 SA-8。
- 七層目錄 `app/`、`pages/`、`features/`、`components/ui/`、`api/`、`lib/`、`styles/` 的骨架，以 ESLint 把 F1 的分層表與 F2 的禁用 `any` 寫成機械檢查；同一份設定擋住日期套件散落、繞過唯一出口直接發請求、網路替身與測試支援進入產品碼（ADR-005 D2、F1、F2、F10、A6、T6、Hard Rule 7）。
- 客戶端路由（React Router v6），掛上 `/dev/health` 與 `/dev/gallery` 兩條開發用路徑（ADR-005 D1、#505 維護者留言）；兩頁是否進正式建置、根路徑與不存在路徑的處理見待決 SA-1、SA-15。
- 伺服器資料快取（TanStack Query）：認證錯誤不重試、寫入不自動重送；其他錯誤的重試政策與「認證錯誤」的範圍見待決 SA-4（A7、A9）。
- 由 `backend/openapi.json` 一條指令產生呼叫層到 `src/api/generated/`（Orval），產物不手改、不加檔、不受 lint、不進覆蓋率分母；並定義什麼算產物漂移（A4、A5、ADR-003 D6、T10）。指令範圍、從哪個目錄執行、產物與 Prettier 的關係見待決 SA-8、SA-9、SA-10。
- 唯一出口（Orval 的 mutator）：前端唯一的 HTTP 邊界，負責組網址、帶憑證與語言偏好、取消與逾時、拆統一回應外層，並把**任何**失敗轉成單一錯誤型別（帶狀態、錯誤碼、訊息、追蹤編號與錯誤類型）（A6、A7、S2、`api-contract.md` §錯誤正規化契約）。成功時是否一併交出外層的追蹤編號與伺服器時間、逾時長度、送出的語言值見待決 SA-2、SA-5、SA-6。
- 網路替身（MSW）：測試在不起後端時拿到四種狀態的回應（T6、`api-contract.md` §MSW 四種狀態的 fixture）；開發時能否在瀏覽器切換見待決 SA-7，fixture 的組法見 C1–C3。
- Vitest 加 React Testing Library 的 unit 與 integration 測試，測試檔與原始碼同目錄（T1、T2、ADR-007 D1、D3）。覆蓋率是否本次產出並記基準見待決 SA-13。
- shadcn/ui 元件原語放進 `components/ui/`，加上對照 `design/prototype/assets/tokens.css` 的語意變數對照層：元件只用語意名稱，色值只來自色值來源，對照層不寫任何色值（ADR-005 D3、D4、F6）。原語要不要為畫面改原始碼、`cta` 等語意的落點、tokens.css 的引入方式、深色驗證範圍見待決 SA-11、SA-14、N2、N5、UI-1、UI-2。
- `src/lib/date.ts`：day.js 的單一入口，時間點以 UTC 傳輸、顯示依瀏覽者裝置時區（F10、#503 裁定 5、規格 07-01 §規格 語言切換 第 5 條）；顯示格式見 UI-3。
- `/dev/gallery` 元件展示頁與完整性測試：元件宣告的 variant 少展示一個、或新增的原語沒放進展示頁，測試就失敗（ADR-005 D3、#503 裁定 4、#505 §驗收條件第 4 項）；「宣告的 variant」從哪裡取見 N1。
- `/dev/health` 健康檢查頁，作為端到端的證明：經 `getHealth` 顯示載入中／正常／資料庫無法連線／連不到後端四種狀態，並可重新檢查；在網路替身與真實後端下都顯示對應狀態（Epic #502 §需求目標、#505 §驗收條件第 3 項、維護者 2026-11-20 留言）。四種以外的回應歸哪一種見待決 SA-3、C5。
- 在 `openspec/config.yaml` 的 `operations.apply.guidance` 補上前端的檢查指令：lint、型別檢查、測試、建置與產物漂移檢查（#505 §驗收條件第 5 項、Epic #502 §承接的延後條文）；指令寫法依待決 SA-8、SA-10。

畫面閘門：兩頁是新畫面，維護者已於 2026-11-20 核可畫面 artifact（`Main.dc.html`、`Gallery.dc.html`），Ready gate 已過；本 change 不改 `design/prototype/`。若定案的選項讓畫面偏離 artifact（例如 SA-2 選 C、SA-3 選 B、SA-7 選 B、SA-14 加切換），要回到維護者確認畫面（`AGENTS.md` §Project Board and Dispatch Ready gate）。

不包含（#505 §不包含、Epic #502、#506）：

- 登入、路由守衛、CSRF 標頭、`401` 的換發與重送、登出時清空快取：屬規格 01-01 登入（A6、A7、A9）。
- 任何業務頁面、側欄與登入外框、語言與外觀切換（07-01）、標記 widget。
- 容器編排、`.env.example`、e2e、CI 的前端 job 與各項 gate（漂移比對、覆蓋率門檻、分層檢查在 CI 執行）：屬 #506。本次只提供可被呼叫的指令。
- 修改 `backend/` 與 `backend/openapi.json`、`docs/specs/`、`design/prototype/`（含 `tokens.css`，只讀）。C1–C3 若選需要後端配合的選項，另開後端 issue，不在本 change 改。

**BREAKING：無。** 後端契約沒有改變，`frontend/` 是第一次建立。但本次定下的前端側約定一旦被功能 change 使用，之後改動屬 A10 的破壞性變更：唯一出口的回傳形狀（SA-2）、單一錯誤型別的欄位與錯誤類型值、產物的路徑與匯出名稱（`api-contract.md` §端點總覽）。

## Capabilities

### New Capabilities

- `frontend-api-client`：前端唯一的 HTTP 邊界與伺服器資料快取的預設行為。請求帶憑證與語言偏好、只在有 body 時帶內容型別、取消與逾時；成功時拆統一回應外層的回傳形狀；任何失敗都轉成單一錯誤型別（錯誤類型 `http`／`network`／`timeout`／`invalidResponse`／`aborted`，與各自帶的狀態、錯誤碼、訊息、追蹤編號、逐欄位錯誤）；外層的判定規則；認證錯誤與呼叫端取消不重試、寫入不自動重送，其他錯誤的重試依 SA-4。
- `frontend-api-codegen`：由已提交的 `backend/openapi.json` 一條指令重產呼叫層與網路替身；產物位置、產物不手改不加檔、query key 只來自產物、產生的識別字，以及「什麼算漂移」的判定。
- `frontend-code-boundaries`：前端原始碼的機械檢查。七層之間允許的引用方向、功能之間不互相引用、頁面只經功能的公開入口引用、禁用 `any`、日期套件只在單一入口使用、產品碼不得繞過唯一出口直接發請求、網路替身與測試支援不得進入產品碼；違反時 lint 或型別檢查失敗。
- `frontend-routing`：前端有哪些路徑、各在哪種建置出現。兩條開發用路徑的掛載條件（SA-1），以及根路徑與不存在路徑的行為（SA-15）。
- `design-token-mapping`：元件原語只用語意變數名、語意變數只對照到 `tokens.css` 的變數、對照層不含任何色值；深色由頁面的 `data-theme` 屬性驅動，不需要對照層另寫深色分支。
- `date-time-display`：日期時間的單一入口。時間點以 UTC 傳輸與保存，顯示依瀏覽者裝置時區；同一個 UTC 時間點在不同時區的顯示結果；不依賴真實時間即可測試。
- `component-gallery`：`/dev/gallery` 展示每個元件原語宣告的每一個 variant、狀態與 token 對照；完整性檢查在漏展示 variant 或漏放原語時失敗。
- `dev-health-page`：`/dev/health` 依 `getHealth` 的結果顯示載入中、正常、資料庫無法連線、連不到後端四種狀態，各狀態顯示的欄位，重新檢查回到載入中，以及四種以外的回應的歸屬（SA-3）。

### Modified Capabilities

無。本 change 只消費既有的 `api-envelope`、`health-check`、`request-correlation`、`response-localization`、`api-schema-export`，不改它們的 requirement（system-analysis §需求依據 `openspec/specs/` 列、`api-contract.md` 開頭「本次無後端 API 變更」）。C1–C3 若選需要後端配合的選項，`api-schema-export` 的修改會在另開的後端 issue 與它自己的 change 裡做，不進本 change。`user-management` 與本 change 沒有重疊。

## Impact

- **新增程式**：`frontend/` 整個目錄（專案設定、ESLint／TypeScript／Vitest／Orval／shadcn 設定、七層骨架、唯一出口與錯誤型別、產物、`features/system-health`、兩個開發用頁面、對照層、日期入口、測試支援）；目錄配置見 `system-design.md` §目錄結構。
- **新增依賴**：前端套件一律以 `pnpm add` 加入（Hard Rule 3）；套件清單由 `design.md` 依 `system-design.md` 列出。`frontend/package.json` 初始版號 `0.0.0`（Hard Rule 4）。
- **API**：無新增或修改；第一次消費 `GET /api/v1/health`（`getHealth`，刻意公開，後端 clarification Q4）。
- **修改設定**：`openspec/config.yaml` 的 `operations.apply.guidance` 寫入前端檢查指令，之後每個動到 `frontend/` 的 change 都依它跑。依待決項目，可能另外修改：根目錄 `package.json` 或新增 `pnpm-workspace.yaml`、`scripts/setup.sh`（SA-8）；`.prettierignore`（SA-9）；`.lintstagedrc.mjs`（N7）；`openspec/config.yaml` 的 `rules.ui-design` ADR 編號（SA-16）。
- **資料模型**：無。資料表字典、ER 與 migration 都不動。
- **讀取但不修改**：`backend/openapi.json`（產生的唯一輸入）、`design/prototype/assets/tokens.css`（色值來源，位於 `frontend/` 之外）。
- **權限與答案隔離**：本次沒有受保護的能力，PRD §權限矩陣不適用；唯一呼叫的端點刻意公開，所有呼叫端拿到的內容相同。Hard Rule 5、6 本次不適用：唯一出口、錯誤型別與快取不認識任何 `operationId` 或任務類型，網路替身的範例資料不含答案；延續到後續的約束（標記 widget 的 variant 依設定來自 widget 自己的宣告、產生的替身資料不含答案要靠後端 S5）見 `system-design.md` §權限檢查點。
- **下游**：#506（前端 lint、型別檢查、測試、建置與重產指令；產物位置供漂移比對與覆蓋率排除；分層檢查規則；開發時的 `VITE_API_BASE_URL` 與後端 `CORS_ALLOWED_ORIGINS` 範例值；前端容器的 build context 要含 `design/prototype/assets/`；容器內健康檢查頁的驗收方式依 SA-1）；規格 01-01 登入（唯一出口加 CSRF 標頭與 `401` 換發、快取的登出清空、路由守衛與登入頁、元件原語）；07-01 共用介面（對照層的深色、語系層、錯誤顯示的露出程度）；之後所有前端模組（七層目錄、產生的型別與 hooks、單一錯誤型別、日期入口、元件展示頁）。

## 引用的需求來源

- 維護者指定：Issue #505 §使用情境／功能範圍「包含」十二項與「不包含」兩項、§需求目標、§驗收條件五項、§畫面閘門；#505 維護者留言（2026-11-20：畫面 artifact 核可、`/dev/health` 四種狀態、`/dev/gallery` 七個區塊、兩頁只在開發環境出現）；畫面 artifact `Main.dc.html`、`Gallery.dc.html` 與 canvas 假設 1–4；Epic #502 §需求目標、§承接的延後條文；#503 裁定 1–5；#506 §包含、§驗收條件（下游）；後端 `clarification.md` Q2、Q3、Q4、Q7、Q8（`openspec/changes/archive/2026-11-20-backend-skeleton/`）。
- `docs/specs/`：規格 07-01 §卡控機制「系統要向使用者顯示錯誤」、§邊界情況「從來沒設定過語言」、§規格 語言切換 第 5 條；其餘無對應規格頁（spec-migration §決議 D4）。
- ADR：ADR-002 D6；ADR-003 D5（含 2026-11-20 決策紀錄）、D6；ADR-004 D1 §後果、D3；ADR-005 D1、D2、D3、D4、D5；ADR-007 D1、D2、D3。
- 規則文件：frontend-agent-rules 前提、F1、F2、F3、F4、F6、F7、F8、F9、F10；api-agent-rules A4、A5、A6、A7、A8、A9、A10；security-agent-rules S2；testing-agent-rules T1、T2、T3、T6、T9、T10、T11。
- `AGENTS.md` Hard Rule 3、4、5、6、7、9，Required Behaviors（pre-commit 格式化）；`docs/development/architecture.mdx` §技術選型、§目錄結構（目標）、§API 契約、§i18n 兩層、§前端、§測試分層；`openspec/config.yaml` `operations.apply.guidance`「前端的檢查指令等 frontend/ 骨架 change（#505）建好再補進這一節」。
- 既有主規格（只消費）：`api-envelope`、`health-check`、`request-correlation`、`response-localization`、`api-schema-export`。

## 可能改變範圍的待決問題

以下待決全部維持未定，由 clarification 停點決定。編號沿用上游：SA-n 為 `system-analysis.md` §待決問題 #n，N1–N8 為 `system-design.md` §本文新發現的待決問題，UI-1–UI-7 為 `ui-design.md` §本文新發現的待決，C1–C6 為 `api-contract.md` §新發現的待決問題。上面的 capability 清單在每個選項下都成立；各題只會改變某個 capability 的 requirement 內容，或在 Impact 多出一處修改。

**可能增加 capability、範圍或修改檔案的：**

| 待決                  | 可能的範圍變化                                                                                                                                                                      |
| :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SA-1（含需求矛盾 1）  | 兩頁進不進正式建置。決定 `frontend-routing` 的掛載條件、正式建置的 `dist/` 檢查內容，以及 #506「容器起來後健康檢查頁顯示成功」的驗收方式要不要改；選建置旗標時多一個設定。          |
| SA-6                  | 選「建語系層」時，本次多一塊介面文字的語系能力（兩份語言檔、初始化與測試），要新增一個 capability；不建時只影響 `frontend-api-client` 送出的語言值。                                |
| SA-7                  | 選「開發時也能切到替身」時多一個開發模式開關、`public/` 下的替身 worker 與頁面上的替身標示（畫面偏離 artifact，要維護者看過）。                                                     |
| SA-8                  | 獨立專案或根目錄工作區。決定是否修改根目錄 `package.json`、新增 `pnpm-workspace.yaml`、改 `scripts/setup.sh`，以及 `openspec/config.yaml` 指令的寫法。                              |
| SA-9、N7（含矛盾 3）  | 產物與手寫 `.ts`／`.tsx` 的格式化。決定是否修改 `.prettierignore`、`.lintstagedrc.mjs`，或在產生設定加格式化步驟。                                                                  |
| SA-10                 | 一條指令是否包含後端匯出。選「包含」時前端指令依賴 Python 工具鏈，漂移判定多一條 `backend/openapi.json`；不包含時整條鏈的根目錄指令屬 #506。                                        |
| SA-13                 | 本次是否產出覆蓋率報告並在 `acceptance.md` 記第一次基準（分母排除產物）。                                                                                                           |
| SA-14、UI-1、N2       | 深色驗證範圍與 `tokens.css` 的引入方式。選展示頁加 `data-theme` 切換時畫面要維護者看過；N2 選「建置時只抽變數」時多一支建置外掛；連帶決定標題字型、圓角與外部字型是否生效。         |
| SA-15                 | 根路徑與不存在路徑。選「最小的找不到頁面」時多一個畫面（要維護者看過）。                                                                                                            |
| SA-16（含需求矛盾 5） | `openspec/config.yaml` `rules.ui-design` 的 ADR 編號是否在本 change 順手改成 ADR-005。                                                                                              |
| SA-12（含需求矛盾 4） | 開發用頁面顯示錯誤碼、追蹤編號與設定名稱是否算 07-01 的例外；選「同時做業務頁共用的錯誤顯示元件」時本次多一個元件與它的露出規則。                                                   |
| C1、C2、C3            | 產生的替身與真實後端的差異（外層 `success`／`code` 沒有 `const`、回應標頭沒宣告、`503` mock 不會自動產生）。選前端覆寫時只影響 fixture；選後端配合時另開後端 issue，不進本 change。 |

**只改變既有 capability 內容、不改範圍的：**

- `frontend-api-client`：SA-2（成功時是否交出 `traceId`、`timestamp`；決定之後每個 hook 的 `data` 型別，屬 A10 破壞性變更的起點）、SA-4（重試政策、`isAuthError` 是否含 `403`）、SA-5（逾時長度，須大於後端健康檢查的 10 秒上限）、C4（`errors` 缺鍵的判定）、C6（錯誤型別是否帶 `timestamp`）、N3（回傳型別能否穿過產物，apply 第一組確認，失敗時回到 clarification）、N6。
- `dev-health-page`：SA-3（四種以外的回應歸屬；選第五種狀態時畫面偏離 artifact）、C5（錯誤類型顯示 `network` 或原樣 `timeout`）、UI-3（檢查時間格式）、UI-7（背景重新取資料是否顯示載入中）。
- `component-gallery`：SA-11、N1、N5（是否改原語原始碼加 variant、完整性檢查的宣告來源、Button 的 `link`）、N8（Token 對照區塊的資料來源與 F1 例外）、UI-4（測試示意是否上頁面）、UI-5（空狀態圖示）、UI-6（版面寬度與目錄高亮）。
- `design-token-mapping`：UI-2（刻度外的間距與字級、對不到 token 的顏色）。
- `frontend-code-boundaries`：N4（型別檢查的額外旗標，`exactOptionalPropertyTypes` 不開的提議）。
