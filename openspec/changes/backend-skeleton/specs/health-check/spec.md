# Spec Delta

## Purpose

提供刻意公開的 `GET /api/v1/health`，實際查詢一次資料庫來回報服務與資料庫是否可用，證明一條請求能走完整條契約鏈並落到 Lite 層或正式層，也讓前端的健康檢查頁有成功與錯誤兩種真實狀態可以呈現。

## ADDED Requirements

### Requirement: 健康檢查實際查詢資料庫並回報可用

系統 SHALL 在收到 `GET /api/v1/health` 時實際對目前使用的資料庫執行一次查詢；查詢成功時回覆 `200` 成功外層，`data` 恰好為 `{"status": "ok", "database": "ok"}`。此行為 MUST 在 Lite 層與正式層都成立。

來源：Epic #502 §需求目標、backend-agent-rules B1、B5、api-agent-rules A1、clarification Q3。

#### Scenario: 健康檢查回傳完整外層與追蹤編號

- **WHEN** 資料庫可以連線，呼叫端送出 `GET /api/v1/health`
- **THEN** 系統回覆 `200`，`success` 為 `true`、`code` 為 `"OK"`、`data` 為 `{"status": "ok", "database": "ok"}`
- **AND** 回應帶 `X-Correlation-ID` 標頭，值與 `traceId` 相同
- **AND** 以上結果在 Lite 層與正式層各驗證一次都成立

### Requirement: 健康檢查回應不含部署資訊

系統 MUST NOT 在健康檢查的回應中回傳資料庫類型、資料庫版本、主機名稱、連線字串或應用版號；`data` 只有 `status` 與 `database` 兩個欄位。

來源：security-agent-rules S9、api-contract §getHealth、clarification Q4。

#### Scenario: 健康檢查回應不含部署資訊

- **WHEN** 服務以正式層啟動，呼叫端送出 `GET /api/v1/health`
- **THEN** `data` 的鍵恰好是 `status` 與 `database`
- **AND** 回應 body 不含 `postgresql`、`sqlite`、資料庫主機名稱或 `DATABASE_URL` 的任何片段

### Requirement: 資料庫無法連線時健康檢查回 503

系統 SHALL 在健康檢查的資料庫查詢因連不上或逾時而失敗時回覆 `503` 錯誤外層、`code` 為 `DATABASE_UNAVAILABLE`、`data` 為 `null`、`errors` 為 `null`，`message` 依語言偏好本地化。回應 MUST NOT 含連線字串、驅動錯誤訊息或資料庫主機名稱；正式層的連線等待 MUST 不超過 5 秒。

來源：clarification Q3、api-agent-rules A7、security-agent-rules S9。

#### Scenario: 資料庫無法連線時健康檢查回 503 外層

- **WHEN** 服務設定的 PostgreSQL 無法連線（主機不存在或服務已停止），呼叫端帶 `Accept-Language: en` 送出 `GET /api/v1/health`
- **THEN** 系統回覆 `503`，`success` 為 `false`、`code` 為 `"DATABASE_UNAVAILABLE"`、`data` 為 `null`、`errors` 為 `null`
- **AND** `message` 為 `"The database is temporarily unavailable. Please try again later."`
- **AND** 回應 body 不含 `DATABASE_URL` 的主機名稱、帳號、密碼，也不含驅動的錯誤訊息
- **AND** 回應帶 `X-Correlation-ID`，值與 `traceId` 相同

#### Scenario: 資料庫連線逾時在時限內回應

- **WHEN** 服務設定的 PostgreSQL 位址不回應任何封包，呼叫端送出 `GET /api/v1/health`
- **THEN** 系統在送出請求後 5 秒的連線時限屆滿時回覆 `503`、`code` 為 `"DATABASE_UNAVAILABLE"`，總耗時不超過 10 秒

### Requirement: 健康檢查刻意公開

系統 SHALL 讓任何呼叫端不帶任何憑證即可呼叫 `GET /api/v1/health`；這是刻意的公開端點，認證上線後也 MUST 維持公開，由規格 01-01 在權限矩陣列為刻意的例外。

來源：clarification Q4、security-agent-rules S10。

#### Scenario: 未帶任何憑證即可呼叫健康檢查

- **WHEN** 呼叫端不帶 cookie、不帶 `Authorization` 標頭送出 `GET /api/v1/health`
- **THEN** 系統回覆 `200`，不是 `401` 或 `403`

### Requirement: 健康檢查只接受 GET 且忽略未宣告的參數

系統 SHALL 只以 `GET` 提供健康檢查；其他 method（含 `HEAD`）MUST 回覆 `405`、`code` 為 `METHOD_NOT_ALLOWED`。未宣告的 query 參數與 `GET` 帶的 body MUST 被忽略，不回 `422`。

來源：api-agent-rules A2、A7、api-contract §getHealth。

#### Scenario: 健康檢查拒絕 GET 以外的方法

- **WHEN** 呼叫端分別以 `POST`、`DELETE`、`HEAD` 呼叫 `/api/v1/health`
- **THEN** 每個回應都是 `405`；`POST` 與 `DELETE` 的 body 為 `code` 是 `"METHOD_NOT_ALLOWED"` 的錯誤外層

#### Scenario: 未宣告的查詢參數被忽略

- **WHEN** 資料庫可以連線，呼叫端送出 `GET /api/v1/health?verbose=true`
- **THEN** 系統回覆 `200`，`data` 為 `{"status": "ok", "database": "ok"}`
