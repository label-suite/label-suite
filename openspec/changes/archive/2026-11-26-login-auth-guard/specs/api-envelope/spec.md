# Spec Delta

## MODIFIED Requirements

### Requirement: 成功回應包一層六欄位外層

系統 SHALL 讓 `/api/v1` 底下每個成功回應的 body 都是一個外層物件，恰好含 `success`、`code`、`message`、`data`、`timestamp`、`traceId` 六個欄位：`success` 為 `true`，`code` 為 `"OK"`，端點的資料放在 `data`。唯一不包外層的例外是從這一台登出（`DELETE /api/v1/current-session`）的 `204`，它沒有 body；檔案與串流這類例外本次沒有。

來源：ADR-003 D5、api-agent-rules A1、#503 裁定 1–2、clarification Q8；architecture §API 契約；login-auth-guard PL3。

#### Scenario: 成功回應包含六個外層欄位

- **WHEN** 呼叫端送出 `GET /api/v1/health`，資料庫可以連線
- **THEN** 系統回覆 `200`，body 的頂層欄位恰好是 `success`、`code`、`message`、`data`、`timestamp`、`traceId`
- **AND** `success` 為 `true`、`code` 為 `"OK"`、`message` 為非空字串、`traceId` 為非空字串

#### Scenario: 登出的 204 沒有 body

- **WHEN** 呼叫端送出 `DELETE /api/v1/current-session`
- **THEN** 系統回覆 `204`，回應 body 長度為 0
- **AND** 回應帶 `X-Correlation-ID` 標頭

### Requirement: 錯誤碼為大寫底線格式並定義第一批通用碼

系統 SHALL 讓錯誤外層的 `code` 一律為 `UPPER_SNAKE_CASE`；通用錯誤碼不加前綴，模組專屬錯誤碼加模組前綴。本次的通用錯誤碼與 HTTP 狀態 MUST 一一對應：`AUTH_REQUIRED`（401）、`CSRF_FAILED`（403）、`NOT_FOUND`（404）、`METHOD_NOT_ALLOWED`（405）、`NOT_ACCEPTABLE`（406）、`VALIDATION_FAILED`（422）、`INTERNAL_ERROR`（500）、`DATABASE_UNAVAILABLE`（503）。

來源：api-agent-rules A7、clarification Q8；ADR-004 D2、D3；login-auth-guard C1。

#### Scenario: 通用錯誤碼與 HTTP 狀態對應

- **WHEN** 分別觸發路徑不存在、method 不支援、語言全部被拒、請求驗證失敗、未處理例外、資料庫無法連線六種錯誤
- **THEN** 回應依序為 `404`／`NOT_FOUND`、`405`／`METHOD_NOT_ALLOWED`、`406`／`NOT_ACCEPTABLE`、`422`／`VALIDATION_FAILED`、`500`／`INTERNAL_ERROR`、`503`／`DATABASE_UNAVAILABLE`
- **AND** 每個 `code` 都符合 `^[A-Z][A-Z0-9_]*$`

#### Scenario: 認證與 CSRF 的通用碼

- **WHEN** 沒有登入 cookie 送出 `GET /api/v1/current-session`，以及帶登入 cookie、沒有 `X-CSRF-Token` 送出 `POST /api/v1/health`
- **THEN** 回應依序為 `401`／`AUTH_REQUIRED`、`403`／`CSRF_FAILED`，兩個 `code` 都沒有模組前綴

#### Scenario: 模組專屬碼帶模組前綴

- **WHEN** 以錯誤的密碼送出 `POST /api/v1/sessions`
- **THEN** 回應的 `code` 為 `"ACCOUNT_INVALID_CREDENTIALS"`，以 `ACCOUNT_` 開頭
