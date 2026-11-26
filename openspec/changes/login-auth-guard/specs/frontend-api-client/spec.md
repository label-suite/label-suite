# Spec Delta

## MODIFIED Requirements

### Requirement: 唯一出口送出的請求帶憑證與介面語言

前端對後端的每一個請求 SHALL 只經唯一出口送出：網址為基底網址加上產生的呼叫層給的路徑（已含 `/api/v1`）；一律帶瀏覽器憑證（`credentials: include`）；`Accept-Language` 一律等於目前的介面語言（`zh-TW` 或 `en`）；只有帶 body 的請求帶 `Content-Type: application/json`；`POST`、`PUT`、`PATCH`、`DELETE` 在讀得到 `__Host-ls_csrf` cookie 時帶 `X-CSRF-Token`，值等於該 cookie；不送 `X-Correlation-ID`。

來源：ADR-003 D6；ADR-004 D1、D3；api-agent-rules A6、A8；security-agent-rules S2；clarification Q5；login-auth-guard PL2。

#### Scenario: 健康檢查請求帶憑證與語言偏好且不帶內容型別

- **WHEN** 介面語言為 `zh-TW`、基底網址為 `http://localhost:8000`，前端經產生的呼叫層發出健康檢查請求
- **THEN** 送出的請求為 `GET http://localhost:8000/api/v1/health`，憑證模式為 `include`
- **AND** 請求標頭 `Accept-Language` 為 `zh-TW`
- **AND** 請求沒有 `Content-Type` 標頭、沒有 `X-CSRF-Token` 標頭，也沒有 `X-Correlation-ID` 標頭

#### Scenario: 介面語言為英文時請求語言為英文

- **WHEN** 介面語言為 `en`，前端發出健康檢查請求
- **THEN** 請求標頭 `Accept-Language` 為 `en`

#### Scenario: 帶 body 的請求帶 JSON 內容型別

- **WHEN** 呼叫端經唯一出口送出方法為 `POST`、body 為 `{"name": "a"}` 的請求
- **THEN** 請求帶 `Content-Type: application/json`，body 為該物件的 JSON 字串

#### Scenario: 基底網址為空時以同源相對路徑送出

- **WHEN** 基底網址設定為空字串，組出健康檢查請求的網址
- **THEN** 網址正好是相對路徑 `/api/v1/health`，不含協定與主機，由瀏覽器以頁面的同源補齊

#### Scenario: 寫入請求帶 CSRF 標頭

- **WHEN** 瀏覽器有 `__Host-ls_csrf=abc123`，呼叫端經唯一出口送出 `DELETE` 請求
- **THEN** 請求帶 `X-CSRF-Token: abc123`

#### Scenario: 沒有 CSRF cookie 時不帶標頭

- **WHEN** 瀏覽器沒有 `__Host-ls_csrf` cookie，呼叫端送出 `POST` 請求
- **THEN** 請求沒有 `X-CSRF-Token` 標頭

### Requirement: 伺服器資料快取不自動重試

伺服器資料快取的預設 SHALL 不自動重試失敗的查詢，也不自動重送失敗的寫入；每次失敗只完成一次請求（開發模式下 React StrictMode 的雙重掛載會中止第一次請求，被中止的請求不計，見 design.md D6），由使用者或呼叫端決定是否再試。唯一的例外是「登入狀態過期時延續一次再重送」，見「`AUTH_REQUIRED` 時先延續一次再重送原請求」。

來源：api-agent-rules A7、A9；clarification Q4；login-auth-guard PL2。

#### Scenario: 伺服器錯誤後不自動重試

- **WHEN** 健康檢查的查詢收到 `500` 錯誤外層
- **THEN** 查詢進入失敗狀態，整個過程完成的請求只有 1 次；開發模式下 StrictMode 雙重掛載而中止的請求不計，也不是重試

#### Scenario: 寫入失敗後不自動重送

- **WHEN** 以預設設定執行一次寫入，請求收到 `503` 錯誤外層
- **THEN** 寫入進入失敗狀態，整個過程只送出 1 次請求

### Requirement: 認證錯誤只認 401

認證錯誤的判定 SHALL 只在單一錯誤的 `kind` 為 `http` 且 `status` 為 `401` 時成立；`403` 與其他錯誤 MUST NOT 判定為認證錯誤。

來源：api-agent-rules A7；`api-contract.md` §`ApiErrorKind`；clarification Q4。

#### Scenario: 失敗後不自動重試且認證錯誤只認 401

- **WHEN** 查詢收到 `401`、`code` 不是 `AUTH_REQUIRED`（例如 `ACCOUNT_INVALID_CREDENTIALS`）的錯誤外層
- **THEN** 整個過程只送出 1 次請求，沒有送出延續
- **AND** 該錯誤被判定為認證錯誤

#### Scenario: 403 不是認證錯誤

- **WHEN** 查詢收到 `403` 錯誤外層
- **THEN** 該錯誤不被判定為認證錯誤，整個過程只送出 1 次請求

#### Scenario: 連線失敗不是認證錯誤

- **WHEN** 查詢因連線失敗收到 `kind` 為 `network` 的錯誤
- **THEN** 該錯誤不被判定為認證錯誤

## ADDED Requirements

### Requirement: `AUTH_REQUIRED` 時先延續一次再重送原請求

請求收到 `401`、`code` 為 `AUTH_REQUIRED` 時，唯一出口 SHALL 先送出一次延續：延續成功就重送原請求一次；延續回 `409 ACCOUNT_REFRESH_CONFLICT` 就短暫等候後以目前的 cookie 重送原請求一次；延續回其他錯誤就把錯誤交給呼叫端。同時多個請求遇到時共用同一次延續；延續請求本身 MUST NOT 再觸發延續。

來源：規格 01-05 §多個分頁同時延續登入狀態 第 1–3 條、§登入狀態能撐多久；api-agent-rules A7；`ui-design.md` §進入、離開與返回 X7；login-auth-guard PL2。

#### Scenario: 延續成功後重送原請求一次

- **WHEN** 查詢第一次收到 `401 AUTH_REQUIRED`，延續回覆 `201`，重送的原請求回覆 `200`
- **THEN** 查詢成功，整個過程送出原請求 2 次、延續 1 次

#### Scenario: 延續失敗時不再重送

- **WHEN** 查詢收到 `401 AUTH_REQUIRED`，延續回覆 `401 ACCOUNT_SESSION_EXPIRED`
- **THEN** 查詢失敗，呼叫端拿到 `code` 為 `ACCOUNT_SESSION_EXPIRED` 的錯誤，原請求只送出 1 次

#### Scenario: 延續衝突時等候後重送一次

- **WHEN** 查詢收到 `401 AUTH_REQUIRED`，延續回覆 `409 ACCOUNT_REFRESH_CONFLICT`，等候後重送的原請求回覆 `200`
- **THEN** 查詢成功，整個過程原請求送出 2 次、延續 1 次

#### Scenario: 多個請求同時遇到 401 只延續一次

- **WHEN** 三個查詢同時收到 `401 AUTH_REQUIRED`
- **THEN** 只送出 1 次延續，延續成功後三個查詢各重送 1 次
