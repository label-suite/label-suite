# Spec Delta

## ADDED Requirements

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

#### Scenario: 重複匯出時分組順序不變

- **WHEN** 程式未變，連續執行兩次匯出指令
- **THEN** 兩次產出的頂層 `tags` 的 `name` 依序都是 `account`、`health`

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

系統 SHALL 讓匯出指令寫出的 `backend/openapi.json` 與文件站副本 `docs/diagrams/architecture/api.openapi.json` 都含操作的分組與頂層 `tags`，兩份位元組完全相同；版本庫中提交的兩份檔案 MUST 與目前程式匯出的結果一致。

來源：api-agent-rules A4、A5；issue #765 §預期調整第 4 項；ADR-003 D6。

#### Scenario: 匯出的介面描述檔帶分組

- **WHEN** 不帶輸出路徑執行匯出指令
- **THEN** `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 都含頂層 `tags`，且每個操作都有 `tags`
- **AND** 兩份檔案位元組完全相同，也與版本庫中提交的檔案沒有差異
