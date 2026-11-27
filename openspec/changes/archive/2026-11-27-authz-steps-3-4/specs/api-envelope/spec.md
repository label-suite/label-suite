# Spec Delta

## MODIFIED Requirements

### Requirement: 錯誤碼為大寫底線格式並定義第一批通用碼

系統 SHALL 讓錯誤外層的 `code` 一律為 `UPPER_SNAKE_CASE`；通用錯誤碼不加前綴，模組專屬錯誤碼加模組前綴。本次的通用錯誤碼與 HTTP 狀態 MUST 一一對應：`AUTH_REQUIRED`（401）、`CSRF_FAILED`（403）、`PERMISSION_DENIED`（403）、`NOT_FOUND`（404）、`METHOD_NOT_ALLOWED`（405）、`NOT_ACCEPTABLE`（406）、`VALIDATION_FAILED`（422）、`INTERNAL_ERROR`（500）、`DATABASE_UNAVAILABLE`（503）。

來源：api-agent-rules A7、clarification Q8；ADR-004 D2、D3、D6；login-auth-guard C1；authz-steps-3-4 `api-contract.md` §錯誤契約：PERMISSION_DENIED、clarification Q3。

#### Scenario: 通用錯誤碼與 HTTP 狀態對應

- **WHEN** 分別觸發路徑不存在、method 不支援、語言全部被拒、請求驗證失敗、未處理例外、資料庫無法連線六種錯誤
- **THEN** 回應依序為 `404`／`NOT_FOUND`、`405`／`METHOD_NOT_ALLOWED`、`406`／`NOT_ACCEPTABLE`、`422`／`VALIDATION_FAILED`、`500`／`INTERNAL_ERROR`、`503`／`DATABASE_UNAVAILABLE`
- **AND** 每個 `code` 都符合 `^[A-Z][A-Z0-9_]*$`

#### Scenario: 認證與 CSRF 的通用碼

- **WHEN** 沒有登入 cookie 送出 `GET /api/v1/current-session`，以及帶登入 cookie、沒有 `X-CSRF-Token` 送出 `POST /api/v1/health`
- **THEN** 回應依序為 `401`／`AUTH_REQUIRED`、`403`／`CSRF_FAILED`，兩個 `code` 都沒有模組前綴

#### Scenario: 權限不足的通用碼

- **WHEN** 平台成員以有效的登入 cookie 呼叫一個需要平台層鍵 `admin.user_management.view` 的受保護操作
- **THEN** 回應為 `403`／`PERMISSION_DENIED`，`code` 沒有模組前綴，與 `CSRF_FAILED` 是不同的碼

#### Scenario: 模組專屬碼帶模組前綴

- **WHEN** 以錯誤的密碼送出 `POST /api/v1/sessions`
- **THEN** 回應的 `code` 為 `"ACCOUNT_INVALID_CREDENTIALS"`，以 `ACCOUNT_` 開頭
