# Proposal

## Why

`backend/` 還不存在，之後每個功能 change（第一個是規格 01-01 登入）都需要同一套回應格式、錯誤格式、追蹤編號、設定驗證與資料庫工作階段才能開工；若各自先做，契約會在第一批模組就分岔。ADR-002 D1 把「第一個 `backend/` 骨架 change」列為延後條文，`openspec/config.yaml` 的 `operations.apply.guidance` 第 4 條也在等這個 change 補上後端檢查指令，因此由 #504（Epic #502）先把骨架與一條端到端的健康檢查建起來。

本 change 沒有 `docs/specs/` 規格可追溯（spec-migration §決議 D4：foundation 屬技術規範），需求依 `openspec/config.yaml` `context`（維護者 2026-11-20 裁定，#503）追溯到 ADR 與規則文件的條號。範圍內的待決項目已由 `clarification.md` Q1–Q9（維護者 2026-11-20）定案，本 proposal 依決議撰寫。

## What Changes

範圍以 #504 §使用情境／功能範圍「包含」為準，加上 `clarification.md` 決議納入的項目：

- 新增 `backend/` 的 uv 專案與單一應用組裝入口，正式執行、測試與介面描述檔匯出共用同一個組裝（B2、T4、Hard Rule 3）。`backend/pyproject.toml` 的初始版號為 `0.0.0`，表示尚未發版（Q7、Hard Rule 4）。
- 啟動時一次驗證所有設定：`CORS_ALLOWED_ORIGINS` 是唯一的必要設定，缺少、空清單或含 `*` 都拒絕啟動並說明是哪一項；其餘設定都有預設值：`CORS_ALLOW_CREDENTIALS` 預設 true，`DATABASE_URL` 可選，`SQLITE_PATH` 預設 `./data/label_suite.db`（Q1、B10、S2、Hard Rule 7）。允許來源帶憑證，origins、methods、headers 都明列（ADR-004 D1 §後果）。
- 所有對外資料形狀共用一個基底：對外欄位小駝峰、未知欄位拒收（A2、#503 裁定 3）。
- 統一回應外層：成功與錯誤共用 `success`、`code`、`message`、`data`、`timestamp`、`traceId` 六個欄位，錯誤另帶 `errors`，`422` 時為逐欄位錯誤（ADR-003 D5、A1、A7、#503 裁定 1–2）。成功 `code` 固定 `OK`；錯誤碼為 `UPPER_SNAKE_CASE`，通用碼無前綴、模組碼加模組前綴，建立第一批六個通用碼；`timestamp` 為 ISO 8601、UTC、毫秒、`Z` 結尾（Q8）。
- 分頁回應的共用形狀：七個欄位，後三個由前四個推導（A3）；本次沒有列表端點引用它。
- 每個請求都有追蹤編號，回應標頭 `X-Correlation-ID` 與外層 `traceId` 同值；呼叫端自帶值符合 `^[A-Za-z0-9-]{8,64}$` 才沿用，否則重新產生、不回錯誤（Q8、A6、A7）。
- 外層 `message` 依 `Accept-Language` 本地化：zh-TW／en 兩份訊息檔，依 q 值挑語言，預設 zh-TW；所有語言都被拒時回 `406 NOT_ACCEPTABLE`；回應帶 `Content-Language`。文案採 `api-contract.md` N9 列的字串。`ErrorDetail.message` 維持英文，這是 A8 的明文例外（Q2、A8）。
- 統一的錯誤處理：驗證失敗、已知應用錯誤、路徑不存在、method 不支援、未處理例外都轉成錯誤外層；未處理例外不露出堆疊、例外訊息或內部路徑，並寫一筆含 `traceId` 的 `ERROR` log，不記 body、query、header、cookie（A7、S9、規格 07-01 §卡控機制「系統要向使用者顯示錯誤」）。
- 操作識別名由一處依「動詞加資源」產生，全專案唯一，撞名時啟動失敗（A1）。
- 資料庫連線與工作階段：沒設 `DATABASE_URL` 走 Lite 層（SQLite），有設走正式層（PostgreSQL，postgres 系列 scheme 正規化成 `+asyncpg`），一個請求一個工作階段（ADR-003 D7、B3、Q1）。
- 資料庫結構遷移的基礎設定：SQLite 批次模式、約束命名慣例、遷移檔名模板，並建立一個空的基準遷移，讓「上、下、再上」在兩種資料庫實際跑過（ADR-003 D7、B6、Q8）。
- 新增端點 `GET /api/v1/health`（`getHealth`），放在第一個模組資料夾 `app/modules/health/`，作為一條請求走完整條契約鏈並落到資料庫的證明（Epic #502 §需求目標、Q8）。健康檢查實際對資料庫執行一次 `SELECT 1`：成功回 200，`data` 為明確的 `HealthData`（`{status:"ok", database:"ok"}`）；連不上回 `503 DATABASE_UNAVAILABLE` 的錯誤外層，PostgreSQL 連線最多等 5 秒（Q3）。此端點刻意公開，認證上線後也維持公開，01-01 在 S10 權限矩陣把它列為刻意的例外（Q4）。
- 匯出介面描述檔的指令，輸出到 `backend/openapi.json` 並提交；欄位為小駝峰，泛型外層的元件名為 `XResponse`／`XPageResponse`／`XPage`（A4、A5 前半段、Q8）。
- unit 與 integration 測試，SQLite 與 PostgreSQL 各跑一次（ADR-007 D1、T1、T4、B7）。驗證失敗與未處理例外以只存在於 `tests/` 的探測路由觸發（Q8）。本次驗收的 PostgreSQL 由本機 `docker run postgres:16` 提供，設定 `TEST_DATABASE_URL` 後跑 pytest，沒設時 PostgreSQL 測試自動跳過，指令與結果寫進 `acceptance.md`（Q5）。以 `pytest-cov` 產出覆蓋率報告，數字記在 `acceptance.md`，不設門檻（Q8）。
- 建立後端的 lint 與型別檢查：`ruff check`、`ruff format --check`、`mypy --strict app`，只在本機與 apply 檢查時執行，不加 CI job（Q6）。
- 在 `openspec/config.yaml` 的 `operations.apply.guidance` 寫入後端的檢查指令：`uv run pytest`（兩種資料庫）、`ruff check`、`ruff format --check`、`mypy --strict app`、匯出 `openapi.json` 後跑 `git diff --exit-code`（#504 驗收條件第 7 項、Q6）。

不包含（#504 §不包含、Epic #502、`clarification.md`）：

- 認證、權限與任何業務資料表；背景工作與快取（ADR-003 D8）；可觀測性（ADR-008 D4）。
- 前端骨架與 client 產生（#505）。
- 容器編排、`.env.example`、e2e、任何 CI job（含 PostgreSQL 的 CI 資料庫）、覆蓋率門檻、匯入方向檢查、契約漂移的 CI 檢查與 Semgrep（#506）；`/docs`、`/redoc`、`/openapi.json` 本次維持框架預設開啟，正式環境是否關閉也由 #506 決定。
- 修正 `AGENTS.md` Language Rules 對「API contracts」的措辭（#516）；本 PR 不改 `AGENTS.md`（Q9）。
- 修正 schema 範本中與 A7 相反的 `400`／`422` 寫法（#517）；本 change 依 A7 實作，不改範本。
- 任何 `docs/specs/` 需求、`design/prototype/` 與畫面（`ui-design.md`：本次無 UI 變更）。

**BREAKING：無。** 這是第一份 API 契約，沒有既有端點可以破壞。但外層、錯誤外層、`ErrorDetail`、錯誤碼與 OpenAPI 元件名一旦被 #505 的產生 client 使用，之後任何更動都屬 A10 的破壞性變更（`api-contract.md` §端點總覽）。

## Capabilities

### New Capabilities

- `api-envelope`：對外回應的共用契約。成功與錯誤外層的欄位、成功碼 `OK`、錯誤碼規則與第一批六個通用錯誤碼、`timestamp` 格式、`422` 的逐欄位錯誤與不回顯原值、`404`／`405`／`500` 的錯誤外層與不露內部細節、對外欄位小駝峰與未知欄位拒收、分頁回應形狀。
- `request-correlation`：每個請求的追蹤編號，包括回應標頭 `X-Correlation-ID` 與外層 `traceId` 同值，以及呼叫端自帶值的接受與丟棄規則。
- `response-localization`：外層 `message` 依 `Accept-Language` 的 q 值決定語言（zh-TW、en），預設 zh-TW、全部被拒時回 `406 NOT_ACCEPTABLE`、回應帶 `Content-Language`，以及 `ErrorDetail.message` 維持英文的例外。
- `runtime-config`：服務啟動時的設定驗證與失敗行為（`CORS_ALLOWED_ORIGINS` 缺少、空清單、含 `*`）、其餘設定的預設值、依有無 `DATABASE_URL` 選擇 Lite 層或正式層。
- `database-migration`：資料庫結構遷移在 SQLite 與 PostgreSQL 上都可升、可降、可再升（以空的基準遷移驗證），以及約束命名在兩種資料庫一致。
- `health-check`：`GET /api/v1/health` 實際查詢資料庫的成功回應、資料庫不可用時的 `503 DATABASE_UNAVAILABLE`，以及刻意公開。
- `api-schema-export`：匯出 `backend/openapi.json` 的行為，包括小駝峰欄位、操作識別名的「動詞加資源」規則與唯一性、元件命名、錯誤回應的宣告。

### Modified Capabilities

無。既有的 `user-management` 與本 change 沒有重疊（system-analysis §需求依據）。

## Impact

- **新增程式**：`backend/` 整個目錄（應用、設定、資料庫、遷移、`app/modules/health/` 模組、匯出指令、測試）；目錄配置見 `system-design.md` §目錄結構。
- **新增 API**：`GET /api/v1/health`（公開）；共用契約見 `api-contract.md` §共用契約。
- **新增依賴**：後端的 Python 套件（含 ruff、mypy、pytest-cov）一律以 `uv add` 加入（Hard Rule 3）；套件清單由 `design.md` 依 `system-design.md` 列出。`backend/pyproject.toml` 初始版號 `0.0.0`（Hard Rule 4）。
- **修改設定**：`openspec/config.yaml` 的 `operations.apply.guidance` 寫入後端檢查指令（pytest 兩種資料庫、ruff、`mypy --strict`、`openapi.json` 漂移檢查），之後每個 change 的 apply 都依它跑。
- **新增檔案**：`backend/openapi.json`（提交進版控），是 #505 產生前端 client 的輸入；zh-TW／en 兩份訊息檔。
- **資料模型**：不建業務資料表，`data-table-dictionary.mdx` 與 ER 不動；只有一個空的基準遷移。
- **下游**：#505（介面描述檔、外層、錯誤形狀、操作識別名、健康檢查形狀與 `503` error 狀態、`frontend/package.json` 沿用版號 `0.0.0`）、#506（CI 的 PostgreSQL 與測試指令、`.env.example` 預設值、覆蓋率門檻、可供分層檢查的模組資料夾、`/docs` 在正式環境的開關）、規格 01-01 登入（組裝入口、設定驗證、允許來源、錯誤外層、健康檢查在 S10 矩陣列為刻意公開的例外）。
- **權限與答案隔離**：本次唯一端點刻意公開，回應只含服務與資料庫狀態；PRD §權限矩陣不適用；Hard Rule 5、6 不適用，但未處理例外不露內部細節與 `422` 不回顯原值，是之後答案不經錯誤訊息外洩的前提（`system-design.md` §權限檢查點）。

## 引用的需求來源

- 維護者指定：Issue #504 §使用情境／功能範圍、§驗收條件七項；Epic #502 §需求目標、§承接的延後條文；#503 裁定 1–3；`clarification.md` Q1–Q9（2026-11-20）。
- `docs/specs/`：規格 07-01 §卡控機制「系統要向使用者顯示錯誤」（錯誤不露內部細節的業務依據）；其餘無對應規格頁（spec-migration §決議 D4）。
- ADR：ADR-002 D1；ADR-003 D1、D2、D3、D5（含 2026-11-20 決策紀錄）、D6、D7、D8；ADR-004 D1 §後果；ADR-007 D1、D2；ADR-008 D4、D8。
- 規則文件：backend-agent-rules B1、B2、B3、B5、B6、B7、B10；api-agent-rules A1、A2、A3、A4、A5、A6、A7、A8、A10；security-agent-rules S2、S9、S10；testing-agent-rules T1、T3、T4、T5、T9、T10、T11。
- `AGENTS.md` Hard Rule 3、4、5、6、7、8、9；`docs/development/architecture.mdx` §技術選型、§後端分層、§API 契約、§資料庫雙層、§i18n 兩層、§測試分層；`openspec/config.yaml` `operations.apply.guidance` 第 4 條。

## 待決問題

本 change 範圍內沒有待決問題。system-analysis 待決 1–16、需求矛盾 1–4，以及 system-design／api-contract 的 N1–N10，已由 `clarification.md` Q1–Q9 與 §不需維護者決定的結論 全部定案。延到其他地方處理的項目：

- N1（operationId 撞名時父資源怎麼回到產生函式）：本次只做「撞名就啟動失敗」，解法等第一次撞名的 change 再定。
- N5（框架最外層產生的 `500` 沒有 CORS 標頭）：已由 CORS 內側的未處理例外處理層涵蓋，列供 `code-reviewer` 與 #505 知悉。
- N6（`/docs`、`/redoc`、`/openapi.json` 在正式部署是否關閉）：交給 #506。
- N7（`AGENTS.md` Language Rules 措辭）：#516。
- N8（schema 範本的 `400`／`422`）：#517。
