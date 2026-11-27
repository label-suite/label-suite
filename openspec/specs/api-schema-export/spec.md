# api-schema-export Specification

## Purpose

定義後端匯出的介面描述檔 `backend/openapi.json`：如何在不連資料庫、不設環境變數的情況下穩定產出、欄位命名、操作識別名的「動詞加資源」規則與唯一性、外層元件命名與錯誤回應的宣告，讓前端的產生 client 與契約漂移比對有可靠的輸入。

## Requirements

### Requirement: 匯出指令不需環境變數與資料庫並產出穩定的檔案

系統 SHALL 提供一個匯出指令，在不設任何環境變數、沒有可用資料庫的情況下產出介面描述檔。不帶輸出路徑時，指令 MUST 把同一份內容同時寫到 `backend/openapi.json` 與文件站副本 `docs/diagrams/architecture/api.openapi.json`，兩份位元組完全相同；帶輸出路徑時 MUST 只寫該路徑，不寫副本。輸出 MUST 鍵名排序、縮排 2 個空白、以換行結尾；程式未變時重複匯出 MUST 產生位元組完全相同的檔案。寫出多個檔案時，寫入暫存內容的階段任一處失敗 MUST 使所有目標的既有檔案維持原樣、不留暫存檔或半成品，且指令以非零狀態結束。

來源：issue #572 §維護者裁定（2026-11-23）、clarification Q1；api-agent-rules A4、A5、testing-agent-rules T4、clarification Q8（N2）；ADR-003 D6（副本不是第二個契約來源）。

#### Scenario: 不設環境變數即可匯出

- **WHEN** 在沒有設定 `CORS_ALLOWED_ORIGINS`、`DATABASE_URL`、`SQLITE_PATH` 的環境執行匯出指令
- **THEN** 指令以狀態 0 結束，`backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 被寫出，且沒有建立任何 SQLite 檔

#### Scenario: 重複匯出內容相同

- **WHEN** 程式未變，連續執行兩次匯出指令
- **THEN** 兩次產出的 `backend/openapi.json` 位元組完全相同，檔案以換行結尾、縮排為 2 個空白、物件鍵依字母排序
- **AND** 兩次產出的 `docs/diagrams/architecture/api.openapi.json` 也位元組完全相同

#### Scenario: 提交的介面描述檔與程式一致

- **WHEN** 在本 change 完成的程式上執行匯出指令
- **THEN** 產出的 `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 都與版本庫中提交的檔案沒有差異

#### Scenario: 匯出指令預設同時寫出兩份內容相同的契約

- **WHEN** 不帶輸出路徑執行匯出指令
- **THEN** 指令以狀態 0 結束
- **AND** `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 都存在，且兩份位元組完全相同

#### Scenario: 帶輸出路徑時只寫該處

- **WHEN** 帶一個暫存目錄下的輸出路徑執行匯出指令
- **THEN** 指令以狀態 0 結束，該路徑被寫出
- **AND** 暫存目錄只出現該檔，`docs/diagrams/architecture/api.openapi.json` 的內容與修改時間不變

#### Scenario: 匯出途中寫入失敗時兩處都不留半成品

- **WHEN** 匯出指令要寫出兩個目標（測試以暫存目錄下的兩個路徑代替），其中一個目標所在的目錄不存在，而另一個目標已有既有內容
- **THEN** 指令以非零狀態結束，並在標準錯誤寫出原因
- **AND** 兩個目標的既有檔案位元組不變，兩個目標所在目錄都沒有留下暫存檔或半成品

### Requirement: 介面描述檔的欄位為小駝峰且操作識別名為動詞加資源

系統 SHALL 讓介面描述檔中所有 schema 的屬性名都是小駝峰，並讓每個操作的識別名都依「動詞加資源」從 method、路徑與回應形狀產生：回應為分頁的 `GET` 用 `list` 加複數資源，其他 `GET` 用 `get`，`POST` 用 `create`，`PUT` 與 `PATCH` 用 `update`，`DELETE` 用 `delete`，後四者加單數資源。識別名 MUST NOT 由函式名推導或逐個指定。

來源：api-agent-rules A1、A2、#503 裁定 3、`openspec/config.yaml` `rules.api-contract`。

#### Scenario: 匯出的介面描述檔為小駝峰且操作識別名符合動詞加資源

- **WHEN** 執行匯出指令後讀取 `backend/openapi.json`
- **THEN** `paths["/api/v1/health"].get.operationId` 為 `"getHealth"`
- **AND** `components.schemas` 下每個 schema 的 `properties` 鍵都不含 `_`，例 `HealthDataResponse` 含 `traceId`、不含 `trace_id`

#### Scenario: 操作識別名依方法與回應形狀決定動詞

- **WHEN** 對資源 `tasks` 分別宣告 `GET /api/v1/tasks`（分頁回應）、`GET /api/v1/tasks/{taskId}`、`POST /api/v1/tasks`、`PATCH /api/v1/tasks/{taskId}`、`DELETE /api/v1/tasks/{taskId}`，以及 `GET /api/v1/health`（非分頁、沒有路徑參數）
- **THEN** 產生的識別名依序為 `listTasks`、`getTask`、`createTask`、`updateTask`、`deleteTask`、`getHealth`

### Requirement: 操作識別名撞名時拒絕啟動與匯出

系統 SHALL 在組裝完所有路由後檢查操作識別名是否全專案唯一；有重複時服務 MUST 拒絕啟動、匯出指令 MUST 以非零狀態結束且不寫出檔案，錯誤訊息 MUST 指出撞名的識別名與相關路由。

來源：api-agent-rules A1、clarification §不需維護者決定的結論（N1）。

#### Scenario: 操作識別名撞名時啟動失敗

- **WHEN** 兩個模組各宣告一條會產生相同識別名（例 `getItem`）的路由，然後啟動服務或執行匯出指令
- **THEN** 啟動失敗、匯出指令以非零狀態結束且沒有寫出檔案
- **AND** 錯誤訊息含 `getItem` 與兩條路由的路徑

### Requirement: 外層元件依資料型別命名

系統 SHALL 讓介面描述檔的泛型外層元件依資料型別命名：成功外層包 `X` 時元件名為 `XResponse`，包分頁的 `X` 時為 `XPageResponse`，分頁本身為 `XPage`；錯誤外層全專案共用一個 `ErrorResponse`，其他資料型別用自身名稱。元件名 MUST NOT 出現框架預設的泛型名稱寫法。

來源：api-agent-rules A4、clarification Q8（N3）。

#### Scenario: 健康檢查的外層元件名為 HealthDataResponse

- **WHEN** 執行匯出指令後讀取 `backend/openapi.json` 的 `components.schemas`
- **THEN** 含 `HealthDataResponse`、`HealthData`、`ErrorResponse`、`ErrorDetail`
- **AND** 沒有任何元件名含 `[`、`]`，或以 `_` 結尾

#### Scenario: 分頁外層的元件名

- **WHEN** 一條列表路由的成功回應是包分頁 `TaskItem` 的外層
- **THEN** 介面描述檔的元件名為 `TaskItemPageResponse` 與 `TaskItemPage`

### Requirement: 錯誤回應以統一錯誤外層宣告

系統 SHALL 在介面描述檔中為每個 `/api/v1` 操作宣告 `404`、`405`、`406`、`500` 回應為 `ErrorResponse`，端點專屬的錯誤另外宣告（`getHealth` 的 `503`）；有參數或 body 的操作，其 `422` 回應 MUST 宣告為 `ErrorResponse`。`components.schemas` MUST NOT 含框架預設的驗證錯誤形狀 `HTTPValidationError` 與 `ValidationError`。

來源：api-agent-rules A4、A7、api-contract §OpenAPI 元件命名與 `openapi.json`。

#### Scenario: 健康檢查的錯誤回應宣告

- **WHEN** 執行匯出指令後讀取 `paths["/api/v1/health"].get.responses`
- **THEN** 含 `200`（`HealthDataResponse`）以及 `404`、`405`、`406`、`500`、`503`，五個錯誤都參照 `ErrorResponse`
- **AND** 不含 `422`

#### Scenario: 帶 body 的操作的 422 宣告

- **WHEN** 一條宣告了 body 的 `/api/v1` 路由被加入組裝後產生介面描述檔
- **THEN** 該操作的 `422` 回應參照 `ErrorResponse`
- **AND** `components.schemas` 不含 `HTTPValidationError` 與 `ValidationError`

### Requirement: 每個操作恰好歸在一個模組分組

系統 SHALL 讓介面描述檔中的每個操作都帶恰好一個分組（`tags` 長度為 1），分組名稱等於該操作所屬後端模組的目錄名（`backend/app/modules/` 下的目錄名，小寫、與目錄同字）。規則適用於介面描述檔中的所有操作，沒有例外；不在模組內再依資源細分。操作缺少分組或帶兩個以上分組時，分組檢查 MUST 失敗。分組名稱是否等於目錄名由程式審查把關，分組檢查不驗名稱。

來源：api-agent-rules A1；issue #765 §分類原則（維護者 2026-11-27 裁定）；clarification P3、P5、P7。

#### Scenario: 每個操作都歸在所屬模組的分組

- **WHEN** 執行匯出指令後讀取 `backend/openapi.json` 的 `paths`
- **THEN** 每個 path 底下每個 HTTP method 的操作都有 `tags`，且長度恰好為 1
- **AND** `getHealth` 的 `tags` 為 `["health"]`
- **AND** `getAuthOptions`、`createSession`、`getCurrentSession`、`createSessionRefresh`、`deleteCurrentSession`、`getGoogleAuthorization`、`createGoogleSession` 的 `tags` 都為 `["account"]`

#### Scenario: 新模組漏掉分組時檢查失敗

- **WHEN** 組裝的服務中有一個掛在 `/api/v1` 底下的操作沒有帶任何分組，然後執行分組檢查
- **THEN** 檢查失敗
- **AND** 失敗訊息列出該操作的 method 與 path，以及它實際的分組（空）

#### Scenario: 同一操作帶兩個分組時檢查失敗

- **WHEN** 組裝的服務中有一個操作同時帶兩個分組（例 `["account", "account"]` 或 `["account", "health"]`），然後執行分組檢查
- **THEN** 檢查失敗
- **AND** 失敗訊息列出該操作的 method、path 與實際的分組

### Requirement: 分組在頂層宣告並附英文說明

系統 SHALL 在介面描述檔頂層提供 `tags` 陣列，每個後端模組恰好一筆，每筆帶 `name` 與 `description`；`name` 全文件唯一，`description` 是一句英文、不得為空字串或只有空白，只寫模組對外的用途，MUST NOT 含內部識別碼、類別名、檔案路徑、部署或主機資訊，也 MUST NOT 提到標準答案或測試集。每個操作的分組 MUST 出現在頂層 `tags` 的 `name` 中；違反時分組檢查 MUST 失敗。

來源：api-agent-rules A1；issue #765 §分類原則、§預期調整第 2 項；clarification P5；AGENTS.md Language Rules（`openapi.json` 屬機器契約，用英文）、Hard Rule 6。

#### Scenario: 頂層分組每筆都有名稱與非空說明

- **WHEN** 執行匯出指令後讀取 `backend/openapi.json` 的頂層 `tags`
- **THEN** 陣列恰好有兩筆，`name` 分別為 `account` 與 `health`，沒有重複
- **AND** 每筆的 `description` 去掉前後空白後不是空字串

#### Scenario: 頂層分組的說明只寫模組用途

- **WHEN** 執行匯出指令後讀取 `backend/openapi.json` 頂層 `tags` 每筆的 `description`
- **THEN** 每筆只含 ASCII 可列印字元，以一個句點結尾，且句點只出現在結尾（恰好一句英文）
- **AND** 每筆都不含 `/`、`\`、`_`、`://`、`localhost`，也不含 `answer`、`ground truth`、`test set`（不分大小寫）

#### Scenario: 操作的分組未在頂層宣告時檢查失敗

- **WHEN** 組裝的服務中有一個操作帶的分組（例 `accounts`）不在頂層 `tags` 的 `name` 中，然後執行分組檢查
- **THEN** 檢查失敗
- **AND** 失敗訊息列出該分組名稱與帶著它的操作的 method、path

#### Scenario: 頂層分組的說明為空時檢查失敗

- **WHEN** 組裝的服務中頂層 `tags` 有一筆的 `description` 是空字串或只有空白，然後執行分組檢查
- **THEN** 檢查失敗
- **AND** 失敗訊息列出該筆的 `name`

### Requirement: 頂層分組依規格章節排序且健康檢查放最後

系統 SHALL 讓頂層 `tags` 陣列依各模組對應的規格章節排序，`health` 一律放最後；完整順序為 `account`（01）、`dashboard`（02）、`task`（03、04）、`dataset`（05）、`admin`（06）、`health`，尚未存在的模組不出現。陣列順序即 API 文件的分組顯示順序；匯出時 MUST 保留宣告順序，不因鍵名排序而改變。

來源：api-agent-rules A1；issue #765 §預期調整第 2 項（宣告順序即顯示順序）；clarification Q2、P1；ADR-003 D14（模組名）。

#### Scenario: 頂層分組依規格章節排序

- **WHEN** 執行匯出指令後讀取 `backend/openapi.json` 的頂層 `tags`
- **THEN** 各筆 `name` 依序為 `account`、`health`

### Requirement: 加上分組不改變操作識別名與請求回應

系統 SHALL 在加上分組後維持每個操作的識別名、參數、請求內容與回應宣告不變；分組只是文件的描述性欄位，MUST NOT 參與操作識別名的計算，也 MUST NOT 用來表達授權邊界。

來源：api-agent-rules A1、A10；issue #765 §預期調整第 4 項（operationId 不變、前端 hook 名稱不變）；clarification P9。

#### Scenario: 加上分組後操作識別名不變

- **WHEN** 執行匯出指令後讀取 `backend/openapi.json` 每個操作的 `operationId`
- **THEN** 識別名的集合恰好為 `getHealth`、`getAuthOptions`、`createSession`、`getCurrentSession`、`createSessionRefresh`、`deleteCurrentSession`、`getGoogleAuthorization`、`createGoogleSession`，與加上分組前相同

#### Scenario: 前端產生的呼叫層名稱不變

- **WHEN** 以帶分組的 `backend/openapi.json` 重產前端呼叫層
- **THEN** 健康檢查的查詢 hook 仍為 `useGetHealth`、呼叫函式仍為 `getHealth`
- **AND** 產物目錄沒有新增或刪除任何檔案

### Requirement: 匯出的介面描述檔與文件站副本帶相同分組

系統 SHALL 讓匯出指令寫出的 `backend/openapi.json` 與文件站副本 `docs/diagrams/architecture/api.openapi.json` 都含操作的分組與頂層 `tags`。兩份位元組相同、與提交的檔案一致、重複匯出內容相同，由既有 requirement「匯出指令不需環境變數與資料庫並產出穩定的檔案」規範，本條不重述。

來源：api-agent-rules A4、A5；issue #765 §預期調整第 4 項；ADR-003 D6。

#### Scenario: 匯出的介面描述檔帶分組

- **WHEN** 不帶輸出路徑執行匯出指令
- **THEN** `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 都含頂層 `tags`，且每個操作都有 `tags`
