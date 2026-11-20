# Proposal

## Why

`backend/` 還不存在，之後每個功能 change（第一個是規格 01-01 登入）都需要同一套回應格式、錯誤格式、追蹤編號、設定驗證與資料庫工作階段才能開工；若各自先做，契約會在第一批模組就分岔。ADR-002 D1 把「第一個 `backend/` 骨架 change」列為延後條文，`openspec/config.yaml` 的 `operations.apply.guidance` 第 4 條也在等這個 change 補上後端檢查指令，因此由 #504（Epic #502）先把骨架與一條端到端的健康檢查建起來。

本 change 沒有 `docs/specs/` 規格可追溯（spec-migration §決議 D4：foundation 屬技術規範），需求依 `openspec/config.yaml` `context`（維護者 2026-11-20 裁定，#503）追溯到 ADR 與規則文件的條號。

## What Changes

範圍以 #504 §使用情境／功能範圍「包含」為準，不增不減：

- 新增 `backend/` 的 uv 專案與單一應用組裝入口，正式執行、測試與介面描述檔匯出共用同一個組裝（B2、T4、Hard Rule 3）。
- 啟動時一次驗證所有設定：缺必要設定或格式不合法就拒絕啟動並說明是哪一項；允許來源逐一列出、拒絕 `*`（B10、S2、Hard Rule 7）。哪幾項算必要見待決 1。
- 所有對外資料形狀共用一個基底：對外欄位小駝峰、未知欄位拒收（A2、#503 裁定 3）。
- 統一回應外層：成功與錯誤共用 `success`、`code`、`message`、`data`、`timestamp`、`traceId` 六個欄位，錯誤另帶 `errors`，`422` 時為逐欄位錯誤（ADR-003 D5、A1、A7、#503 裁定 1–2）。
- 分頁回應的共用形狀：七個欄位，後三個由前四個推導（A3）；本次沒有列表端點引用它。
- 每個請求都有追蹤編號，出現在回應標頭 `X-Correlation-ID` 與外層（A6、A7）；兩者關係與呼叫端自帶值的處理見待決 7。
- 統一的錯誤處理：驗證失敗、已知應用錯誤、路徑不存在、未處理例外都轉成錯誤外層；未處理例外不露出堆疊、例外訊息或內部路徑（A7、規格 07-01 §卡控機制「系統要向使用者顯示錯誤」）。
- 操作識別名由一處依「動詞加資源」產生，全專案唯一，撞名時啟動失敗（A1）。
- 資料庫連線與工作階段：沒設正式連線走 Lite 層（SQLite），有設走正式層（PostgreSQL），一個請求一個工作階段（ADR-003 D7、B3）。
- 資料庫結構遷移的基礎設定：SQLite 批次模式、約束命名慣例、遷移檔名模板，兩種資料庫都可升可降（ADR-003 D7、B6）；是否建立空的基準遷移見待決 13。
- 新增端點 `GET /api/v1/health`（`getHealth`），作為一條請求走完整條契約鏈並落到資料庫的證明（Epic #502 §需求目標）；回應形狀、是否實際確認資料庫、連不上時的回應見待決 10、11。
- 匯出介面描述檔 `openapi.json` 的指令，欄位為小駝峰（A4、A5 前半段）；檔案位置見 N2。
- unit 與 integration 測試，SQLite 與 PostgreSQL 各跑一次（ADR-007 D1、T1、T4、B7）；PostgreSQL 由誰提供見待決 4。
- 在 `openspec/config.yaml` 的 `operations.apply.guidance` 補上後端的檢查指令（#504 驗收條件第 7 項）；是否含 lint 與型別檢查見待決 15、矛盾 1。
- 回應外層的 `message` 是否在本次依語言偏好本地化（含 `406`）尚未決定，見待決 2、矛盾 4。

不包含（#504 §不包含、Epic #502）：認證、權限與任何業務資料表；背景工作與快取（ADR-003 D8）；可觀測性（ADR-008 D4）；前端骨架與 client 產生（#505）；容器編排、`.env.example`、e2e 與 CI 檢查（#506）；任何 `docs/specs/` 需求、`design/prototype/` 與畫面（`ui-design.md`：本次無 UI 變更）。

**BREAKING：無。** 這是第一份 API 契約，沒有既有端點可以破壞。但外層、錯誤外層、`ErrorDetail`、錯誤碼與 OpenAPI 元件名一旦被 #505 的產生 client 使用，之後任何更動都屬 A10 的破壞性變更（`api-contract.md` §端點總覽）。

## Capabilities

### New Capabilities

- `api-envelope`：對外回應的共用契約。成功與錯誤外層的欄位、錯誤碼規則與第一批通用錯誤碼、`422` 的逐欄位錯誤與不回顯原值、`404`／`405`／`500` 的錯誤外層與不露內部細節、對外欄位小駝峰與未知欄位拒收、分頁回應形狀。
- `request-correlation`：每個請求的追蹤編號，包括回應標頭 `X-Correlation-ID`、外層 `traceId`，以及呼叫端自帶值的接受與丟棄規則。
- `response-localization`：外層 `message` 依 `Accept-Language` 決定語言、fallback 與全部被拒時的回應。**取決於待決 2**：若維護者決定語系能力留給之後的 change，本 capability 從本 change 移除，`api-envelope` 改寫固定字串的行為。
- `runtime-config`：服務啟動時的設定驗證與失敗行為、允許來源清單的規則、依有無正式資料庫連線選擇 Lite 層或正式層。
- `database-migration`：資料庫結構遷移在 SQLite 與 PostgreSQL 上都可升、可降、可再升，以及約束命名在兩種資料庫一致。
- `health-check`：`GET /api/v1/health` 的成功回應、資料庫不可用時的回應與公開程度。
- `api-schema-export`：匯出 `openapi.json` 的行為，包括小駝峰欄位、操作識別名的「動詞加資源」規則與唯一性、元件命名、錯誤回應的宣告。

### Modified Capabilities

無。既有的 `user-management` 與本 change 沒有重疊（system-analysis §需求依據）。

## Impact

- **新增程式**：`backend/` 整個目錄（應用、設定、資料庫、遷移、健康檢查模組、匯出指令、測試）；目錄配置見 `system-design.md` §目錄結構。
- **新增 API**：`GET /api/v1/health`；共用契約見 `api-contract.md` §共用契約。
- **新增依賴**：後端的 Python 套件一律以 `uv add` 加入（Hard Rule 3）；套件清單由 `design.md` 依 `system-design.md` 列出。`backend/pyproject.toml` 的初始版號見待決 5（Hard Rule 4）。
- **修改設定**：`openspec/config.yaml` 的 `operations.apply.guidance` 補後端檢查指令，之後每個 change 的 apply 都依它跑。
- **新增檔案**：`backend/openapi.json`（位置與是否提交見 N2），是 #505 產生前端 client 的輸入。
- **資料模型**：不建業務資料表，`data-table-dictionary.mdx` 與 ER 不動。
- **下游**：#505（介面描述檔、外層、錯誤形狀、操作識別名、健康檢查形狀）、#506（兩種資料庫的測試指令、必要設定清單、覆蓋率報告、可供分層檢查的模組資料夾）、規格 01-01 登入（組裝入口、設定驗證、允許來源、錯誤外層）。
- **權限與答案隔離**：本次沒有受保護能力，PRD §權限矩陣不適用；Hard Rule 5、6 不適用，但未處理例外不露內部細節與 `422` 不回顯原值，是之後答案不經錯誤訊息外洩的前提（`system-design.md` §權限檢查點）。

## 引用的需求來源

- 維護者指定：Issue #504 §使用情境／功能範圍、§驗收條件七項；Epic #502 §需求目標、§承接的延後條文；#503 裁定 1–3。
- `docs/specs/`：規格 07-01 §卡控機制「系統要向使用者顯示錯誤」（錯誤不露內部細節的業務依據）；其餘無對應規格頁（spec-migration §決議 D4）。
- ADR：ADR-002 D1；ADR-003 D1、D2、D3、D5（含 2026-11-20 決策紀錄）、D6、D7、D8；ADR-004 D1 §後果；ADR-007 D1、D2；ADR-008 D4、D8。
- 規則文件：backend-agent-rules B1、B2、B3、B5、B6、B7、B10；api-agent-rules A1、A2、A3、A4、A5、A6、A7、A8、A10；security-agent-rules S2、S9、S10；testing-agent-rules T1、T3、T4、T5、T9、T10、T11。
- `AGENTS.md` Hard Rule 3、4、5、6、7、8、9；`docs/development/architecture.mdx` §技術選型、§後端分層、§API 契約、§資料庫雙層、§i18n 兩層、§測試分層；`openspec/config.yaml` `operations.apply.guidance` 第 4 條。

## 待決問題

以下全部尚未決議，由 clarification 停點處理；本 proposal 不替它們定案，`system-design.md` 與 `api-contract.md` 寫的是建議預設。

- **system-analysis 待決 1–16**：1 必要設定有哪幾項；2 `message` 是否本次本地化；3 允許來源是否允許帶憑證；4 PostgreSQL 由誰提供；5 `pyproject.toml` 初始版號；6 外層 `code` 的規則與第一批錯誤碼；7 標頭追蹤編號與 `traceId` 的關係及自帶值處理；8 `timestamp` 格式與時區；9 覆蓋率第一次基準；10 健康檢查是否有明確回應形狀；11 健康檢查是否確認資料庫及失敗語意；12 認證上線後健康檢查是否公開；13 是否建立空的基準遷移；14 健康檢查是否作為第一個模組資料夾；15 是否建立 lint 與型別檢查並寫進 `config.yaml`；16 未處理例外是否寫含追蹤編號的 log。
- **system-analysis 需求矛盾 1–4**：1 七項自動 gate 的歸屬（T9 對 #506）；2 健康檢查是否需要回應形狀（A2、B1 例外對 Epic #502）；3 缺必要設定就失敗（B10）對不必設定就能跑（ADR-003 D7）；4 `message` 本地化（A8）對 #504 未列語系能力。
- **system-design 新增 N1–N6**：N1 operationId 撞名時父資源怎麼回到產生函式；N2 `openapi.json` 的位置與是否提交；N3 泛型外層的 OpenAPI 元件名；N4 以只存在於 `tests/` 的探測路由驗證 `422` 與 `500`；N5 框架最外層產生的 `500` 沒有 CORS 標頭（列供知悉）；N6 `/docs`、`/redoc`、`/openapi.json` 在正式部署是否關閉。
- **api-contract 新增 N7–N10**：N7 `AGENTS.md` Language Rules 對 `api-contract.md` 語言的兩列說法相反；N8 schema 範本的 `400`／`422` 寫法與 A7 相反；N9 外層 `message` 的 zh-TW 與 en 文案來源；N10 回應是否帶 `Content-Language`。

待決 2 會改變 Capabilities 的組成（`response-localization` 去留）；待決 10、11、13、15 與 N4 會改變對應 capability 的 Scenario 與 tasks 的範圍，specs 與 tasks 要等 clarification 的決議後再寫。
