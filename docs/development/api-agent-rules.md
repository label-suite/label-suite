---
title: 'API 契約與前端 Client 規範'
description: '路由與 operationId 與回應外層、request 驗證與 response 建模、分頁、三份契約產物的分工、重產與 drift 檢查、單一 HTTP 邊界、錯誤處理、i18n、server state、相容性與破壞性變更。附來源逐條對照。'
category: '開發說明'
tags: [開發說明, Agent, 規範, API, 前端]
createdAt: '2026-11-10'
updatedAt: '2026-11-10'
---

# API 契約與前端 Client 規範

:badge[Issue #108]{variant="neutral"} :badge[正式開發前]{variant="warning"}

> `AGENTS.md` 是**規則本體**。這一份是 API 契約與前端 client 那一塊的說明，由 `AGENTS.md` 的 Agent Rules Index 指過來。
> 兩邊說法不同時**以 `AGENTS.md` 為準**，並回報給維護者。
> 跨領域的規範在 [agent-rules.md](agent-rules.md)、後端分層與資料在 [backend-agent-rules.md](backend-agent-rules.md)、
> 授權與答案隔離在 [security-agent-rules.md](security-agent-rules.md)，這裡不重複。

**`backend/` 與 `frontend/` 目前都不存在**，所以下面每一條的「檢查方式」幾乎都還沒有自動檢查。標「待建置」就是字面意思：那些檢查要等實際有程式與 CI 才寫得出來，**不得因為這份文件存在就宣稱契約已被強制**。

## 開工前的六個前提都已定案

這張 issue 的第一個工作項是「先由維護者確認」。確認結果如下，本文件只是把它們寫下來，不是重新決定：

| 前提 | 狀態 |
| :--- | :--- |
| 路徑前綴 | **`/api/v1`**（維護者 2026-11-10 裁定，[architecture.md](architecture.md) 待決清單 第 3 列） |
| operationId | **由 FastAPI 的 `generate_unique_id_function` 固定成「動詞加資源」**，不手寫也不逐個覆寫（[#51](https://github.com/label-suite/label-suite/issues/51) 已落地在 `openspec/schemas/label-suite-sdd/`） |
| 成功回應格式 | **包一層 envelope**；**204 無 body、檔案與串流是明文例外**（維護者 2026-11-10 裁定，待決清單 第 2 列） |
| 前端型別與 client 生成工具 | **Orval**，由後端匯出的 `openapi.json` 產生到 `frontend/src/api/generated/`（維護者 2026-11-10 裁定，見 [architecture.md](architecture.md) §前端） |
| Bruno | **降級成可選的手動工具，pre-PR 硬關卡取消**；唯一的契約真相是 `api-contract.md` 加 `openapi.json`（待決清單 第 7 列） |
| i18n | ADR-026 兩層；前端只負責 UI 字串，後端 `detail` 由後端依 `Accept-Language` 解析（沿用） |

---

## 規範

每一條交付**適用路徑、禁止事項、正例、反例、例外條件、檢查方式、來源**。

### A1 路由、HTTP status、operationId 與回應外層

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/modules/**` 的 router、`openspec/changes/*/api-contract.md` |
| **禁止** | 端點不帶 `/api/v1` 前綴；路徑在 `/api/v1` 之後插一段模組名；operationId 與既有端點撞名卻不處理；手寫或逐個覆寫 operationId；讓 operationId 從 Python 函式名推導；自由心證地擴大 envelope 的例外；非 CRUD 動作用動詞式路徑而不在 api-contract 寫理由；建立成功回 `200`、刪除成功回 `200` 帶 body |
| **正例** | `GET /api/v1/tasks` → `listTasks`；集合端點用複數名詞；**operationId 全專案唯一**；非 CRUD 動作寫成 subresource（`/tasks/{id}/assignments`）、狀態轉移資源（`/submissions/{id}/status-changes`）或命令資源（`/exports`）。成功 status：讀取與更新 `200`、**建立 `201` 並帶 `Location` header**、刪除 `204` 無 body。`200` 的回應包一層 envelope；`204`、檔案與串流在 api-contract 標成例外 |
| **反例** | `POST /api/v1/tasks/{id}/doPublish`（動詞式又沒記理由）；`@router.get(..., operation_id="get_task_by_id_v2")`（逐個覆寫）；「這個端點只回一個布林，所以不包 envelope」 |
| **例外** | `204` 無 body、檔案下載與串流不套 envelope。**例外要逐一寫進該 change 的 `api-contract.md` 並寫出理由**，不逐案自由心證（裁定 2 的延伸要求，見 [architecture.md](architecture.md) 待決清單 第 2 列） |
| **檢查方式** | **待建置**。前綴與複數名詞可用自寫腳本掃匯出的 `openapi.json`；operationId 的穩定性靠 A10 的 snapshot diff。兩者都要等 `backend/` 與 CI 存在 |
| **來源** | 維護者 2026-11-10 裁定（envelope、`/api/v1`）；[#51](https://github.com/label-suite/label-suite/issues/51) 已落地的 operationId 策略（含 `openspec/config.yaml` 明寫的「**全專案唯一**」）。原始 repo `api.md` §Design Conventions（RESTful、複數名詞）與 §Status Codes（`200` 讀取與更新、`201` 建立並帶 `Location`、`204` 刪除無 body）**沿用**；原始 repo `specs/foundation/000-foundation/spec.md` 的 FR-128（非 CRUD 的三種 pattern）**沿用**、FR-120（operationId 必須穩定、改名視同破壞性變更）**沿用該要求但不採用它的機制** |

**路徑不帶模組段，依據是本 repo 自己的例子。** `api.md` 的 route pattern 寫 `/api/v1/[module]/[resource]`，但 [architecture.md](architecture.md) §非同步任務 的流程圖寫的是 `GET /api/v1/submissions/{id}/status`——**資源直接接在 `/api/v1` 後面**，沒有模組段；FR-128 舉的三個 pattern（`/tasks/{id}/assignments`、`/submissions/{id}/status-changes`、`/exports`）也都不帶。而 operationId 是「動詞加資源」，模組名不進那個名字。所以 `api.md` 那一條是**沿用但去掉模組段**；後端的模組邊界由目錄（`app/modules/<module>/`）表達，不由路徑表達。

**「全專案唯一」不等於「動詞加資源」就自動成立。** 兩個不同父資源底下的同名子資源會算出同一個名字——`/api/v1/tasks/{id}/members` 與 `/api/v1/projects/{id}/members` 都是 `listMembers`。規則：**撞名時在該 change 的 `api-contract.md` 把名字加上父資源**（`listTaskMembers`），並寫一行理由；不改成手寫覆寫，`generate_unique_id_function` 仍是唯一的產生處。

**FR-120 為什麼只採一半，以及它提醒了什麼。** FR-120 要求每條 route 顯式寫 `operation_id=`，這與本專案「不手寫、不逐個覆寫」的裁定相反，所以機制不採用。但它禁止的那件事要照收：**operationId 不得依賴函式名自動生成**。本專案的 `generate_unique_id_function` 必須從 **method 與資源路徑**算出「動詞加資源」，**不得從 handler 的 Python 函式名推導**——否則把 `get_task` 重新命名成 `read_task` 會悄悄改掉前端 hook 的名稱，正是 FR-120 要防的事，而「動詞加資源」這個裁定本身就已經排除了函式名。

### A2 request 驗證與 response 建模

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/modules/**/schemas/**`、同模組的 router |
| **禁止** | 回傳裸 ORM model；省略 `response_model=`；body、query、path 任一處少了型別或範圍驗證；未知欄位政策靠框架預設而沒寫出來；敏感欄位先回前端再由前端遮蔽 |
| **正例** | 所有 schema 繼承共用 base（`from_attributes=True`，一處設定全專案生效）；`limit: int = Field(ge=1, le=100)`；query 參數宣告型別讓 FastAPI 轉型；回應明確建模，欄位與 nullable 都寫進 api-contract |
| **反例** | `return task`（直接回 SQLAlchemy model）；`@router.get("/tasks")` 沒有 `response_model=`；後端回完整的 `email` 再由前端顯示成 `***` |
| **例外** | 檔案串流端點沒有 `response_model`；不碰業務資料的健康檢查端點 |
| **檢查方式** | **待建置**。`response_model=` 是否齊全可用自寫 AST 檢查；欄位遮蔽的規則在 [security-agent-rules.md](security-agent-rules.md) 的 S4，跨角色的負向驗收矩陣在 S10 |
| **來源** | 原始 repo `api.md` 的「**request body** 一律 Pydantic 驗證」（原文只寫 body；query 與 path 要驗是 #108 工作項 2 的要求，見下）「response schema 必須明確、不回裸 ORM model」「每條 route 都要 `response_model=`」**沿用**（[#106](https://github.com/label-suite/label-suite/issues/106) 的對照表已標「歸本張」）；共用 base 的做法來自原始 repo 的實作 `backend/app/schemas/common.py`（FR-103）**沿用原則**；遮蔽在後端是 [#107](https://github.com/label-suite/label-suite/issues/107) 的 S4，這裡只寫「不得先回前端」 |

**未知欄位政策由維護者裁定維持 `forbid`（2026-11-10）。** 工作項 2 要求政策要寫出來，而來源沒有任何一條定過它；本文件初版依 `AGENTS.md` 硬性規則 9 提議 **`extra="forbid"`，在共用 base 上設定一次**（Pydantic v2 的預設 `ignore` 會把打錯的欄位名靜默丟掉，呼叫端以為設定生效、實際沒有），**維護者當日裁定維持**。代價是前端先部署、後端還沒加那個欄位時整個請求會被拒絕，而不是忽略多餘欄位；實作者不得逐個端點改成 `ignore`。

**共用 base 的 `from_attributes=True` 與 S4 的「不得 `from_attributes` 全收」不衝突。** S4 擋的是「回應 model 照抄整列 ORM 欄位」；`from_attributes=True` 只允許從 ORM 物件**建構**一個已經明列欄位的 schema，沒宣告的欄位不會被帶出去。所以兩條並存：**base 設定開著，但每個回應 schema 仍要明列欄位**，不得用它當作省略欄位清單的理由。

**`query` 的未知參數擋不到，所以要用別的方式收齊。** `extra="forbid"` 只作用在 body 的 model 上；FastAPI 對沒宣告的 query 參數是直接忽略，沒有地方可以設成拒絕。所以 query 這一半的政策是：**每個被接受的參數都要宣告並寫進 `api-contract.md` 的 Request 表**，沒寫進去的就是不支援；畫面把狀態放在網址時，不認得的值照規格的既有做法處理（規格 03-01 §查詢條件保留在網址：無效值忽略、改用預設並把網址整理過），不是回 `422`。`path` 參數由路由本身決定，型別與範圍仍要宣告。

### A3 分頁

| | |
| :--- | :--- |
| **適用路徑** | 所有列表端點與它們的 `api-contract.md` |
| **禁止** | 各模組自選 `page`／`page_size`／cursor；`limit` 沒有上限；`offset >= total` 時回 `404`；用非唯一的排序鍵做 offset 分頁；讓前端自己算下一頁的 offset |
| **正例** | query 參數 `limit`（預設 20、上限 100）與 `offset`（預設 0）；回應七個欄位 `items`、`total`、`limit`、`offset`、`has_more`、`total_pages`、`next_offset`，後三者由前四者**推導**、不另外查資料庫；排序一律帶唯一的尾鍵（例 `updated_at DESC, id DESC`）；`offset >= total` 回空 `items` 與 `has_more: false` |
| **反例** | `GET /api/v1/tasks?page=2&page_size=50`；`ORDER BY updated_at DESC` 單鍵（兩列同一個時間時，翻頁會重複或漏掉其中一列）；`offset=999` 回 `404`；前端自己算 `offset = page * size` |
| **例外** | cursor 分頁允許，但該 change 的 `api-contract.md` 要寫出**理由、response schema、穩定排序鍵與測試**（FR-003 的例外條款） |
| **檢查方式** | **待建置**。`limit` 的上限可由共用的 query schema 一處約束；空頁與排序穩定性要靠整合測試，等 `backend/` 存在 |
| **來源** | 原始 repo `api.md` 的 `PaginatedResponse[T]` 與 `limit`／`offset`／`next_offset`**沿用**（#106 已標「細節歸本張」）。七個欄位取自它的**實作** `backend/app/schemas/common.py` 與 `frontend/src/shared/types/api.ts`——**比 `api.md` 的文字多四個**（`items`、`total`、`has_more`、`total_pages`）。FR-003（cursor 例外與穩定排序鍵）、FR-068（三個衍生欄位不得額外查 DB）、FR-069（`limit: Field(ge=1, le=PAGINATION_MAX_LIMIT)`、`offset: Field(ge=0)`、空頁回空陣列不回 `404`）**沿用** |

**這三件要逐一寫進每個列表端點的契約，不靠口頭慣例。** `api-contract.md` 要寫出該端點的 **`limit` 上限**、**預設排序鍵（含用來打破同值的尾鍵）**與**空頁的行為**——那正是工作項 3 要求「皆寫入契約」的三件。

**20 與 100 這兩個數字有本 repo 自己的依據。** 原始 repo 的架構常數是 `PAGINATION_DEFAULT_LIMIT = 20`、`PAGINATION_MAX_LIMIT = 100`，而本 repo 兩份**已定案**規格寫的是同一組：規格 03-01 §排序與分頁「每頁預設 20 筆，可以改成 50 或 100」與規格 06-01「每頁預設 20 筆，可以切換為 50 或 100 筆」（`docs/specs/03-task-management/01-task-list.mdx`、`docs/specs/06-admin/01-user-management.mdx`，兩份都是**已定案**）。兩邊一致，所以這組數字不是沿用來的猜測。

**`total` 與 `total_pages` 是規格要的欄位，不是多餘的。** 規格 06-01 要顯示「共 24 筆 · 第 1 / 2 頁」；規格 03-01 §排序與分頁 更明確——分頁列要顯示「共幾筆、目前第幾頁、**總共幾頁**」，而且「中間還有幾個頁碼可以直接點（以目前頁為中心，最多五個）」。只有 `next_offset` 做不到這幾件事。所以 `api.md` 只提三個欄位是它的文字不完整，不是契約只有三個欄位。

**排序穩定性那一條是本文件推出來的。** FR-003 只在 cursor 分頁那一句要求穩定排序鍵；但 offset 分頁同樣會因為非唯一的排序鍵而在翻頁時重複或漏列，而規格 03-01 的預設排序正是「依更新時間由新到舊」。所以這一條套用到所有列表端點。

### A4 三份契約產物的分工

| | |
| :--- | :--- |
| **適用路徑** | `openspec/changes/*/api-contract.md`、後端匯出的 `openapi.json`、`frontend/src/api/generated/**` |
| **禁止** | 手改 `frontend/src/api/generated/`（含加檔與格式化）；手改匯出的 `openapi.json`；實作與規劃版契約不一致時直接改程式不改契約；把 Bruno collection 當成契約真相 |
| **正例** | 三者分工：`api-contract.md` 是**規劃依據**（前後端同時開工用）、`openapi.json` 是**實作真相**（後端匯出）、`frontend/src/api/generated/` 是**前端產物**（Orval 從前者產生）。實作要偏離規劃時**先改 `api-contract.md` 並寫原因**，再改程式 |
| **反例** | 在產物裡補一個後端還沒有的欄位讓前端先動工；`openapi.json` 與程式不一致時手動修 JSON；「Bruno 裡能跑就算對」 |
| **例外** | 無。Bruno 保留成**可選的手動工具**，既不是契約也沒有 pre-PR 關卡（裁定 7） |
| **檢查方式** | **待建置**。產物未被手改要靠 A5 的 CI 重產比對；`api-contract.md` 與 `openapi.json` 的一致性目前只有人工與獨立審查 |
| **來源** | 維護者 2026-11-10 裁定（Bruno 降級，待決清單 第 7 列、落差 14）；scaffold `api-contract.md` §與規劃版 contract 的關係、`api-client.md` 鐵律一（禁止手改產物）**沿用**；本 repo 的 api-contract artifact 定義在 `openspec/schemas/label-suite-sdd/`（#51） |

### A5 重產與 drift 檢查

| | |
| :--- | :--- |
| **適用路徑** | `backend/` 的匯出設定、`frontend/orval.config.ts`、`frontend/src/api/generated/**`、CI |
| **禁止** | 只改後端不重產前端產物；本機重產後不提交產物；用 Orval 以外的工具產型別或 client；把型別漂移當成警告而不是失敗 |
| **正例** | 一條命令走完「後端匯出 `openapi.json` → Orval 產 `frontend/src/api/generated/`」；**契約、`openapi.json` 與產物同一個 commit**；CI 重新產生並比對，有差異即失敗 |
| **反例** | 後端加了一個欄位、PR 只有後端檔案（前端 typecheck 看不到破壞性變更）；手動補產物讓 CI 過 |
| **例外** | 無 |
| **檢查方式** | **待建置**，而且這一條特別容易被誤以為已經有。原始 repo 的 FR-071 與 SC-018 要求這道 CI gate，但它自己的歸檔紀錄明寫「OpenAPI export／type generation command **未實作**」（`specs/foundation/000-foundation/spec.md` v1.12.4 的 (c) 項），所以**不得引用它當成已存在的機制** |
| **來源** | 維護者 2026-11-10 裁定 Orval 與輸出路徑 `frontend/src/api/generated/`；scaffold `api-contract.md` 鐵律四與 `api-client.md` §來源（同一個 commit、CI 重產比對）**沿用**；FR-071（CI 阻擋型別漂移）**沿用要求**、FR-130（本機 bootstrap 契約要含生成命令）**沿用** |

### A6 單一 HTTP 邊界

| | |
| :--- | :--- |
| **適用路徑** | `frontend/src/api/**`（Orval 的 mutator 與它的設定）；反面適用於 `frontend/src/pages/**` 與 `frontend/src/features/**` |
| **禁止** | 業務元件自行 `fetch`／`axios`；另寫與契約重複的型別或 DTO；在元件裡設 base URL 或組 header；用 ad-hoc 旗標做取消；在元件裡 try/catch 吞掉錯誤 |
| **正例** | Orval 的 mutator 是唯一出口，集中七件事：**base URL**、**`credentials: 'include'`**（cookie 認證必要）、**`Accept-Language`**、**CSRF 的自訂 header**（值從 `__Host-` 前綴的 cookie 複製，見 S2）、**`AbortSignal`**（TanStack Query 傳進來的 signal 直接轉給 `fetch`）、**錯誤轉成單一 error 型別**（帶 `status` 與 correlation id）、以及 **request timeout** |
| **反例** | 原始 repo 的實作 `frontend/src/shared/services/api-client.ts` 就是反例：它**沒有 `credentials: 'include'`**，所以 httpOnly cookie 根本不會隨請求送出；也沒有 `Accept-Language`、沒有 CSRF header、沒有 timeout。元件裡 `const r = await fetch('/api/v1/tasks')` 同樣是反例 |
| **例外** | 檔案上傳與下載不走 JSON 解析，但仍然走同一層（base URL、credentials、CSRF、取消都一樣要） |
| **檢查方式** | **待建置**。可用 lint 規則禁止 `pages/` 與 `features/` 直接用 `fetch`／`axios`，並禁止 import 產物目錄以外的 API 型別。**#107 的 S2 把一條測試指派到這裡**：斷言元件不自己帶 `credentials`（`credentials` 的統一責任位置就是這一層），那條測試等 `frontend/` 存在才寫得出來 |
| **來源** | #108 工作項 6 的六項明文（本條照收）；FR-058（集中 base URL、credentials、headers、**timeout**、401 refresh 與 `ErrorResponse` 解析）**沿用並補上它多出來的 timeout**；scaffold `api-client.md` 鐵律二、三**沿用**；CSRF 的形狀來自 #107 的 S2 與 [architecture.md](architecture.md) §認證與授權 的 CSRF 段 |

**自訂 header 只加在寫入請求上。** 原始 repo 那支 client 的註解寫得對：`application/json` 不在 CORS safelist 裡，所以只在有 body 時才設 `Content-Type`，免得每個 `GET` 都觸發 preflight。CSRF 的自訂 header 同理——**只在會改變狀態的請求加**，`GET` 不加，才留得住那個免 preflight 的好處。寫入請求本來就有 body，preflight 無論如何都會發生。這一層的強度等於 CORS allowlist 的嚴格程度（#107 已記）。

### A7 錯誤處理與安全訊息

| | |
| :--- | :--- |
| **適用路徑** | 後端的 exception handler、`frontend/src/api/**` 的錯誤轉換、TanStack Query 的 `QueryClient` 設定 |
| **禁止** | 用錯誤字串猜 status；`403` 自動重試；把「看不到的資源」回 `403`；顯示原始堆疊、資料庫錯誤或未處理的 HTTP 物件；在元件各自 try/catch 吞錯；`401` 時讓多個 refresh 同時在飛 |
| **正例** | 單一 error 型別帶 `status`、`detail` 與 correlation id。`401`：先試 refresh，**同時只允許一個在飛**（single-flight），其餘請求等它的結果。**refresh 成功就更新 session 並重放原請求**；**refresh 失敗就清掉前端的登入狀態並導向登入**，而且要往上傳明確的 auth failure 旗標，讓 `QueryClient` 的 `retry` 對 auth error 回 `false`。`403`：不重試，顯示無權限狀態。`404`：同時代表不存在與刻意隱藏。`409`：**在表單情境**顯示在表單上（refresh 併發也會回 `409`，那一種由 A6 那層處理、不進畫面）。`400`：與 `422` 分開——FR-006 的 `400` 是語意或應用規則錯誤、`422` 是 schema 驗證失敗，兩者都回到觸發它的欄位或表單。`422`：`detail` 是 `ErrorDetail[]`，逐欄位顯示。`5xx`：顯示通用錯誤並附 correlation id |
| **反例** | `if (String(err).includes('403'))`；讓 TanStack Query 的預設 retry 跟 refresh 搶——FR-085 寫的是這樣**最多疊出六次冗餘請求**；把使用者看不到的任務回 `403`（洩漏它存在）；把 `detail` 的 `ErrorDetail[]` 直接 `JSON.stringify` 貼到畫面 |
| **例外** | FastAPI 預設的 `422` `RequestValidationError` **不在 i18n 契約內**（[architecture.md](architecture.md) §i18n 兩層），要本地化得另註冊 handler；A6 提到的最後手段診斷字串（回應沒有 body 或不是 JSON 時由 client 自己合成）留英文 |
| **檢查方式** | **待建置**。`retry` 對 auth error 回 `false` 可用前端單元測試鎖住；`403`／`404` 的隱藏行為屬 #107 的 S10 驗收矩陣 |
| **來源** | #108 工作項 7 的明文（本條照收）；FR-006（`400`／`401`／`403`／`404`／`422` 的語意）**沿用**；FR-085（401 retry 與 refresh 的競爭）**沿用**；FR-041（不顯示原始堆疊與資料庫錯誤）**沿用**，它的業務面已經收進規格 07-01 §卡控機制（`docs/specs/legacy/07-01-sidebar.ids` 的 `foundation:FR-041` 對照列）；FR-046 與 FR-123（每個請求一個 `X-Correlation-ID`，client 把它附到正規化後的錯誤）**沿用**；`api.md` §Status Codes 與「`403` vs `404`」**沿用**（後端那一面歸 #107）；scaffold `api-client.md` 鐵律三**沿用** |

**single-flight 與重放是本文件依工作項 7 的「併發 refresh」推出來的，不是 FR-085 的內容。** FR-085 只要求兩件事：refresh 失敗要往上傳明確的 auth failure 旗標、`QueryClient` 的 `retry` 對 auth error 回 `false`。前端只排一個 refresh 在飛、成功後重放原請求，是為了不讓同時發生的多個 `401` 各自換一次 token。**後端那一面另有來源**：原始 repo FR-075 對 refresh token 的併發採有界 grace（30 秒內、`rotated` 且未被重發過的 token 可多發一次，資格已被占用時回 `409 Conflict`），所以前端排隊與後端 grace 是互補的兩層，不是同一條。

**FR-123 的 Sentry 那一半不採用**：ADR-020（Sentry）本期不做（裁定 6），所以 correlation id 只進錯誤物件與 log，不送任何第三方。

### A8 i18n 的兩層分工

| | |
| :--- | :--- |
| **適用路徑** | 後端的 i18n 字串與 exception handler、前端的語系檔與錯誤顯示 |
| **禁止** | 前端把後端的 `detail` 再翻譯一次或對照 key；語系檔放後端 `detail` 的副本；後端在商業邏輯內嵌人看得懂的訊息字面值；**`detail` 回傳 i18n key 本身或原始英文字面值**；前端不送 `Accept-Language` 而自己決定語言 |
| **正例** | 前端送 `Accept-Language`（由 A6 那一層統一加），把 `detail` 當成**已經本地化的不透明字串**直接顯示；後端照 ADR-026 解析 q-value、`*` 通配、`q=0` 拒絕，fallback 到 `zh-TW`，全部被拒時回 `406` |
| **反例** | `t(error.detail)`；在 `zh-TW/common.json` 放一份後端訊息；`raise HTTPException(400, "任務名稱重複")`（字面值寫在商業邏輯裡）；`detail: "task.name.duplicate"`（回了 key，前端照「不透明字串直接顯示」會把 key 貼到畫面上） |
| **例外** | `422` 的 `ErrorDetail[]`（見 A7）；client 在沒有後端 body 時合成的診斷字串 |
| **檢查方式** | **待建置**。後端可用整合測試斷言同一條錯誤在 `zh-TW` 與 `en` 下的 `detail`；前端可 grep 語系檔裡有沒有後端訊息的副本 |
| **來源** | ADR-026（沿用）與 [architecture.md](architecture.md) §i18n 兩層；原始 repo `backend.md` §i18n 的「訊息字串由後端擁有、不硬寫在 handler」**沿用**（它的 `app/i18n/zh_TW/` 路徑已被模組內分層覆寫，解析長段屬實作規格，見 #106 的對照）；原始 repo `frontend.md` §Localization 的「**不要**把後端 `detail` 放進語系檔」**沿用** |

### A9 server state 與快取

| | |
| :--- | :--- |
| **適用路徑** | `frontend/src/**` 用到 TanStack Query 的地方、`QueryClient` 的設定 |
| **禁止** | 把 API 回應複製進全域 store；在元件或 hook 裡用 inline 字串陣列當 query key；mutation 成功後不失效相關查詢；切換登入者或任務之後沿用前一個人的快取 |
| **正例** | query key 的**唯一來源是 Orval 產物匯出的 `get*QueryKey`**；mutation 成功後用它失效對應的 list 與 detail；登出、切換帳號、`credential_version` 變動時整個 `queryClient.clear()`；切換任務時失效帶 `taskId` 的 key；**mutation 進行中，送出入口 disabled**，避免同一筆被送兩次 |
| **反例** | `useQuery(['tasks', id], ...)` 手寫 key（另一處寫成 `['task', id]`，失效就打不中）；把 `listTasks` 的結果再存一份進 Zustand；登出只清 cookie 不清 cache——下一個在同一台機器登入的人會先看到上一個人的列表 |
| **例外** | 表單狀態與純 UI 狀態**不**進 TanStack Query（[architecture.md](architecture.md) §前端） |
| **檢查方式** | **待建置**。inline key 可用 lint 規則擋；跨帳號不外洩要有前端測試：登出再登入另一個帳號後列表不得出現前一個帳號的資料 |
| **來源** | ADR-004（TanStack Query）與 [architecture.md](architecture.md) §前端；FR-059（server state 的單一邊界、不得用全域 store 複製）**沿用**；FR-084（單一 queryKey 慣例、禁止 inline）**沿用原則但換掉來源**；跨帳號與跨任務的快取清理對應 #107 S4 的失效規則（帳號停用、系統角色變更、任務成員身分變更）；scaffold `api-client.md` §Mutation 慣例 的「送出期間 disabled」**沿用** |

**S4 的三個失效事件在前端各有不同的落點。** 帳號停用與系統角色變更會讓 session 失效，下一個請求拿到 `401`，由 A7 清掉整個 cache。**任務成員身分變更不會讓 session 失效**——使用者還登著，只是某個任務不再屬於他。那一格的做法是：收到該任務的 `403` 或 `404` 時，失效帶那個 `taskId` 的 key 並退回列表（規格 03-01 §點任務進入任務詳情 已經寫了「停在列表並顯示無權限」），**不是整個 `clear()`**。

**FR-084 的 factory 不照抄。** 它要求手寫 `frontend/src/shared/constants/query-keys.ts` 的 factory，採 `[module, resource, id?, subresource?]` 階層。本專案採 Orval 之後，key 由產物產生，再手寫一份就是**兩個真相**；而且 `shared/` 那個路徑已被 2026-11-10 的 `pages/` 加 `features/` 裁定覆寫。要保留的是它的用意：**全專案只有一套 key 慣例，不准 inline**。

### A10 相容性與破壞性變更

| | |
| :--- | :--- |
| **適用路徑** | `openspec/changes/*/api-contract.md` 與 `design.md`、匯出的 `openapi.json`、CI |
| **禁止** | 刪欄位、改型別、改語意、改 operationId 而不當成破壞性變更；複製原始 repo 那條 Bruno 的 pre-PR 硬關卡；在同一個 major version 裡悄悄改語意 |
| **正例** | 破壞性變更要在該 change 的 `design.md` 寫出影響範圍；每個 major version 一份獨立的 OpenAPI artifact；deprecated 端點在 OpenAPI description 或 changelog 標出 migration path；operationId 的變動由 artifact 的 snapshot diff 在 CI 偵測 |
| **反例** | 把 `listTasks` 改名成 `getTaskList` 當成單純重構（前端 hook 名稱跟著變）；把回應從 envelope 改成裸物件而不走版本——裁定 3 的理由明寫**版本前綴就是那個逃生門** |
| **例外** | Bruno 可以留著當手動工具，但它不是關卡 |
| **檢查方式** | **待建置**。snapshot diff 與 compatibility test 都要等 CI 與 `backend/` 存在；前兩個落點的 agent 檢查項已經在 `.claude/agents/design-reviewer.md` 與 `code-reviewer.md` 裡 |
| **來源** | 維護者 2026-11-10 裁定（Bruno 降級、關卡取消，落差 14）；scaffold `api-contract.md` §與規劃版 contract 的關係（破壞性變更寫進 design）**沿用**；FR-118（每個 major version 的 artifact 與 deprecation 標示）**沿用**；FR-120（operationId 變動視同破壞性變更、由 artifact diff 偵測）**沿用** |

**「審核方式」有三個落點，不另立流程**（工作項 10 要求定義它）：規劃階段由 `design-reviewer` 對 `api-contract.md` 與 `design.md` 檢查影響範圍；實作階段由 `code-reviewer` 的「端點與 `api-contract.md` 一致」與「operationId 符合『動詞加資源』且全專案唯一」兩條檢查；CI 的 artifact snapshot diff 擋住沒被宣告的改名。三者看的是同一份 `openapi.json`。**原始 repo 那條 Bruno 的 pre-PR 關卡不在落點裡**——它已被裁定取消。

---

## 刻意不採用的來源條文

| 不採用 | 出處 | 為什麼 |
| :--- | :--- | :--- |
| 逐條 route 顯式寫 `operation_id=` | 原始 repo foundation spec FR-120 | 與本專案「由 `generate_unique_id_function` 固定、**不逐個覆寫**」的裁定相反。它禁止的「從函式名自動生成」仍然照收，見 A1 |
| 手寫 `shared/constants/query-keys.ts` 的 queryKey factory | FR-084 | 採 Orval 後 key 由產物產生，再手寫一份就是兩個真相；`shared/` 路徑也已被 `pages/` 加 `features/` 覆寫。用意保留在 A9 |
| correlation id 送進 Sentry 的 redacted context | FR-123 | ADR-020（Sentry）本期不做（裁定 6） |
| Bruno 的 pre-PR 硬關卡 | 原始 repo ADR-025 | 維護者 2026-11-10 裁定取消；Bruno 降級成可選工具 |
| `ApiResponseDto { success, code, message, data, timestamp, traceId }` 這個具體 envelope 形狀 | scaffold `api-contract.md` | 本專案只裁定「包一層 envelope」，沒有裁定欄位。**第一個 API change 的 `api-contract.md` 要把欄位定下來**，不要照抄 NestJS 專案的形狀，也不要由各模組各自決定 |
| Bearer token 與 `@ApiBearerAuth()` | scaffold `api-contract.md`、`api-client.md` | 本專案是 httpOnly cookie 加 session，**不接受 cookie 以外的任何來源**（#107 已落地） |
| `@nestjs/swagger` 的 decorator 寫法、`@RegisterDto()`、`bigint id` 一律 `type: String` | scaffold `api-contract.md` | 棧不同（FastAPI 加 Pydantic v2）。「每個欄位都要寫出型別、nullable、enum、範例」的用意在 A2 |

---

## 來源對照

### 原始 repo（`singyichen/label-suite@faf83356`）

**這張表的範圍是 API 契約與前端 client。** 來源檔裡的非 API 條文（`frontend.md` 的 ADR-011 切片與 `shared/` 准入規則、§Icons、§TypeScript Code Style）**刻意不在這裡對照**，歸 [#109](https://github.com/label-suite/label-suite/issues/109)；`api.md` §Auth & Permissions 歸 [#107](https://github.com/label-suite/label-suite/issues/107)；`backend.md` 的分層與指令歸 [#106](https://github.com/label-suite/label-suite/issues/106)。所以某一節沒出現在下表，是被排除、不是被漏掉。

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `api.md` §Design Conventions（RESTful、複數名詞、`/api/v1/[module]/[resource]`） | **沿用** | 成為 A1。前綴已由維護者 2026-11-10 裁定 |
| `api.md` §Request & Response 的 Pydantic 驗證、不回裸 ORM | **沿用** | 成為 A2。這兩條在 #106 的對照表已標「歸 #108」，是**已交辦**、不是漏掉 |
| `api.md` §Request & Response 的 `ErrorResponse.detail` 由後端本地化 | **沿用** | 成為 A8。這一條是 #106 殘餘風險裡標「靜默遺漏」的那幾條之一，本張收齊 |
| `api.md` 的 `PaginatedResponse[T]`、`limit`／`offset`／`next_offset` | **沿用但補完** | 成為 A3。它的文字只提三個欄位，實作有七個 |
| `api.md` §Status Codes（`200`／`201` 加 `Location`／`204`／`422`、`403` vs `404`） | **沿用** | 成為 A1 與 A7。`201` 要帶 `Location` 這一條本張照收 |
| `api.md` §FastAPI Specifics 的「`APIRouter` 按模組分組」與 `response_model=` 必填 | **沿用** | 前者與 #106 的 B1 同向（模組內分層），後者成為 A2。這是 #106 殘餘風險點名的那一條 |
| `backend.md` §i18n 的「訊息字串由後端擁有、不硬寫在 handler」 | **沿用** | 成為 A8 |
| `backend.md` §i18n 的「`detail` 必須查 i18n key 後回**已解析的本地化文字**，不得是原始英文字面值或 key 本身」 | **沿用** | 成為 A8 的禁止。它與上一條合起來是 #106 殘餘風險交辦過來的「§i18n 的三條」的前兩條 |
| `backend.md` §i18n 的「關鍵錯誤路徑的整合測試要斷言 `zh-TW` 與 `en` 兩種 `detail`」 | **沿用** | 成為 A8 的檢查方式（待建置）。這是那三條的第三條 |
| `frontend.md` §State management 的「TanStack Query 管所有 API／server state」 | **沿用** | 成為 A9。同一節的「Zustand 存 auth token」已在 #107 列為**不採用** |
| `frontend.md` §Localization（命名空間、只管 UI 字串、**不要**放後端 `detail` 副本） | **沿用** | 成為 A8 |
| 實作 `backend/app/schemas/common.py`（`AppBaseModel`、`ErrorResponse`／`ErrorDetail`、`PaginatedResponse[T]` 的七個欄位與衍生邏輯） | **沿用原則** | 成為 A2、A3、A7。這份不是規則檔，是**真正跑過的程式**，比 `api.md` 的文字完整 |
| 實作 `frontend/src/shared/services/api-client.ts` | **當反例沿用** | 成為 A6 的反例：它沒有 `credentials: 'include'`、沒有 `Accept-Language`、沒有 CSRF header、沒有 timeout。它對的部分（`204` 視為空 body、非 JSON body 要與「沒有內容」分得開、只在有 body 時設 `Content-Type` 以免 preflight）照收 |
| foundation spec FR-003、FR-068、FR-069（分頁常數、衍生欄位、邊界） | **沿用** | 成為 A3 |
| foundation spec FR-006（status 語意） | **沿用** | 成為 A7 |
| foundation spec FR-058（API client 集中 base URL、credentials、headers、timeout、401 refresh、錯誤解析） | **沿用** | 成為 A6 |
| foundation spec FR-059、FR-084、FR-085（server state 邊界、queryKey 慣例、401 retry 競爭） | **沿用／部分改寫** | 成為 A9 與 A7；FR-084 的 factory 位置不採用 |
| foundation spec FR-041（不顯示原始堆疊與資料庫錯誤） | **沿用** | 成為 A7。它的業務面已在規格 07-01 §卡控機制（舊編號對照表的 `foundation:FR-041` 那一列） |
| foundation spec FR-046、FR-123（`X-Correlation-ID`） | **沿用**（Sentry 那半不採用） | 成為 A7 |
| foundation spec FR-071、FR-130（CI 擋型別漂移、bootstrap 含生成命令） | **沿用要求** | 成為 A5。它自己的歸檔紀錄說那條命令**未實作**，所以不得當成既有機制 |
| foundation spec FR-118、FR-120、FR-128（版本 artifact 與 deprecation、operationId 穩定、非 CRUD 的 REST pattern） | **沿用／部分不採用** | 成為 A10 與 A1 |
| foundation spec FR-013、FR-071 的「生成型別是 `shared/` 的唯一例外」 | **不在本文件** | 屬前端依賴方向與 `shared/` 准入，歸 [#109](https://github.com/label-suite/label-suite/issues/109) |
| foundation spec FR-082（restricted-client router 的 OpenAPI tag） | **不在本文件** | 屬授權邊界，歸 [#107](https://github.com/label-suite/label-suite/issues/107) |

**`specs/foundation/000-foundation/spec.md` 的身分要講清楚**：它是原始 repo 的**參考資料**，和 `api.md` 同一個位階，不是本 repo 的正典。本 repo 的業務正典是 `docs/specs/`，搬移時只收了它八條與畫面有關的 FR（見 `docs/specs/legacy/07-01-sidebar.ids`）。上表引用它是因為 #108 點名的 `api.md` 是濃縮過的規則檔，**真正定過的條文在那份 spec 與它的實作程式裡**——只讀規則檔會以為很多事沒定過。

### scaffold（`fullstack-ai-sdd-workflow-scaffold`，本機與 `trendlink`）

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `api-contract.md` 鐵律一（每個端點都要有完整的 OpenAPI 描述：成功回應、會發生的錯誤碼） | **沿用原則** | 成為 A2 與本 repo 的 api-contract artifact 要求；decorator 寫法不採用 |
| `api-contract.md` 鐵律二（DTO 完整描述：型別、nullable、enum、範例、format；遮蔽欄位標 nullable 並寫明誰看不到） | **沿用原則** | 成為 A2；遮蔽的呈現歸 #107 S4 與 `ui-design` |
| `api-contract.md` 鐵律三（handler 名稱全專案唯一、「動詞加資源」、不用 `findAll`／`findOne`） | **沿用** | 與 #51 已落地的 operationId 策略同向，成為 A1 |
| `api-contract.md` 鐵律四（改 DTO 或 controller 就同步契約、同一個 commit、不手改 JSON、CI 重產比對） | **沿用** | 成為 A5 |
| `api-contract.md` §與規劃版 contract 的關係 | **沿用** | 成為 A4 與 A10 |
| `api-client.md` §來源（Orval 從 `openapi.json` 產 hooks、型別與 MSW mock；mutator 負責 base URL、解開 envelope、丟統一錯誤） | **沿用** | 正是維護者 2026-11-10 選定的做法，成為 A5 與 A6。它的 Bearer token 那一項不採用 |
| `api-client.md` 鐵律一（產物禁止手改）、鐵律二（不手寫 fetch、不手寫 API 型別、要擴充就從產物衍生） | **沿用** | 成為 A4 與 A6 |
| `api-client.md` 鐵律三（錯誤一律是單一 error 型別，禁止比對錯誤字串） | **沿用** | 成為 A7 |
| `api-client.md` §Mutation 慣例（成功後用產物的 `get*QueryKey` 失效、送出期間 disabled、可預期錯誤顯示在表單） | **沿用** | 三項分別落在 A9（失效、送出期間 disabled）與 A7（`409`／`400` 顯示在表單） |
| `api-client.md` §測試與 mock（MSW handler 優先取自 Orval 產生的 mock、測試內覆寫不改產物） | **不在本文件** | 測試分層歸 [#110](https://github.com/label-suite/label-suite/issues/110)；「不改產物」那一面在 A4 |
| `ApiResponseDto` 的具體欄位、`@ApiBearerAuth()`、`bigint id` 轉字串 | **不採用** | 見上表 |

### duty-mate（`trendlink/duty-mate@c53cc453`，`develop`）

**它沒有 API 契約或 API client 的規則檔**，`.claude/rules/` 的十二份裡沒有 `api-*`——因為它是 SSR（NestJS 加 Handlebars），沒有 SPA client 要對接。所以這一類大部分沒有可對照的條文，不編造。

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `dto-boolean.md`（鐵律：`@Transform` 要從原始 object 取值；表單重複 key 是常態；未送出的欄位要靠 `@Expose()` 才會跑轉換；決策表要把「key 存在但值是 undefined」與「key 不存在」當兩格） | **沿用教訓，不沿用條文** | 它的 class-transformer API 不適用，但它的事故（2026-07-07「勾選存成否、取消勾選存成是，兩個方向都反」）正是 A2 要防的事：**request 的轉型與未知／缺漏欄位政策要在一處定好並測到邊界**，不要靠框架預設。本專案用 Pydantic v2，對應的陷阱是預設 `extra="ignore"` 會靜默吃掉打錯的欄位名 |
| `integration-test-http.md`（整合測試的 HTTP 生命週期、harness 不得比 production 寬鬆） | **不在本文件** | 測試歸 [#110](https://github.com/label-suite/label-suite/issues/110)。「harness 不得比 production 寬鬆」與 A5 的「CI 要真的重產並比對」同向 |
| 其餘十份（`typescript.md`、`database.md`、`date-handling.md`、`icon-usage.md`、`command.md`、`tailwind-theme.md`、`hbs-partials.md`、`hbs-inline-script.md`、`jest-mock-queue.md`、`index.md`） | **不在本文件** | 見 [agent-rules.md](agent-rules.md) 與 [backend-agent-rules.md](backend-agent-rules.md) 的 duty-mate 一節 |

### starter-kit

**仍然對不上。** #108 點名它的 `backend/api-design.md` 與 `frontend/api-client.md`——**又是和前兩張不同的檔名**，所以本張依 `agent-rules.md` 記下的教訓（「附帶搜尋清單的否定結論會勸退後面的人再查」）**另外實查了一次**：

- `trendlink` 組織底下每個 repo 的 git tree，grep `api-design`／`api-client`／`api-contract`：只命中 `fullstack-ai-sdd-workflow-scaffold`（就是上面那個 scaffold）與 `rag-poc` 的一份功能設計文件 `docs/superpowers/specs/2026-08-06-query-report-api-design.md`（那是某個報表功能的設計，不是規則檔）
- `singyichen` 底下每個 repo 的 git tree，grep 同三組字與 `starter`：只命中 `label-suite` 自己的 `frontend/src/shared/services/api-client.ts`（本文已引用成 A6 的反例）與兩個 repo 的 `senior-api-designer.md` agent 定義
- 本機 `find ~/project ~/Documents ~/Downloads` 找 `api-design.md` 與 `api-client.md`：只有 scaffold 那一份

查核日期 2026-11-10。所以這一類沒有對照可做。

---

## 變更紀錄

| Issue | 日期 | 變更 |
| :--- | :--- | :--- |
| [#108](https://github.com/label-suite/label-suite/issues/108) | 2026-11-10 | 初版。十條規範（各帶適用路徑、禁止、正反例、例外條件、檢查方式與來源）、七條刻意不採用的來源條文、原始 repo（含它的 foundation spec 與實作程式）／scaffold／duty-mate 的逐條對照，以及 starter-kit 的實查紀錄 |
| [#108](https://github.com/label-suite/label-suite/issues/108) | 2026-11-10 | 把十個工作項的並列子項逐字拆開再對照，補四處落點：**A2 的 `query` 未知參數**（`extra="forbid"` 只擋 body，FastAPI 不給你拒絕未宣告的 query 參數）、**A3 的三件要逐一寫進契約**、**A7 的 `401` 有「更新」與「清掉」兩個分支**（原本只寫了清掉那一支）、**A10 的破壞性變更審核方式**（三個落點） |
| [#109](https://github.com/label-suite/label-suite/issues/109) | 2026-11-10 | A2 的未知欄位政策從「本文件定的，不是裁定」改寫成**維護者 2026-11-10 裁定維持 `extra="forbid"`**，並寫出代價（前端先部署、後端還沒加那個欄位時整個請求會被拒絕）。本文件初版把它標成可逆，裁定當日就落地，免得一份已合併的文件繼續說那是撰寫者自己定的 |
| [#108](https://github.com/label-suite/label-suite/issues/108) | 2026-11-10 | 獨立審查後修九處：**A8 原本沒擋「`detail` 回 i18n key 本身」**（`backend.md` §i18n 明文禁止，而前端照「不透明字串直接顯示」會把 key 貼到畫面上）；**A1 漏掉 operationId「全專案唯一」**並補上撞名規則（`/tasks/{id}/members` 與 `/projects/{id}/members` 都算 `listMembers`）；**路徑的模組段改成明確不帶**，依據是 `architecture.md` 自己的 `GET /api/v1/submissions/{id}/status`；**A7 的 FR-085 引用更正**（「最多六次冗餘請求」不是「同時六個 refresh」，也不是實測數字），並標明 single-flight 與重放是本文件自推、後端那一面是 FR-075 的有界 grace；A9 補「送出期間 disabled」與「任務成員身分變更」在前端的落點；A2 寫明共用 base 的 `from_attributes=True` 與 S4 的「不得全收」不衝突；三處把 #107 的驗收矩陣誤指成 S4（實際是 S10）；A6 收下 S2 指派過來的那條測試；對照表把「已交辦」與「靜默遺漏」分開，`backend.md` §i18n 拆成三列 |
