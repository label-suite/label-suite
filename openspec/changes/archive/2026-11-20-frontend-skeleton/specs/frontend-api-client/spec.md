# Spec Delta

## Purpose

定義前端唯一的 HTTP 邊界對外承諾的行為：請求帶什麼、成功時交出什麼、任何失敗如何轉成單一錯誤型別，以及伺服器資料快取不自動重試、認證錯誤只認 `401` 的預設，讓每個前端功能拿到一致的資料與錯誤形狀。

## ADDED Requirements

### Requirement: 唯一出口送出的請求帶憑證與介面語言

前端對後端的每一個請求 SHALL 只經唯一出口送出：網址為基底網址加上產生的呼叫層給的路徑（已含 `/api/v1`）；一律帶瀏覽器憑證（`credentials: include`）；`Accept-Language` 一律等於目前的介面語言（`zh-TW` 或 `en`）；只有帶 body 的請求帶 `Content-Type: application/json`；不送 `X-Correlation-ID`。

來源：ADR-003 D6；ADR-004 D1；api-agent-rules A6、A8；security-agent-rules S2；clarification Q5。

#### Scenario: 健康檢查請求帶憑證與語言偏好且不帶內容型別

- **WHEN** 介面語言為 `zh-TW`、基底網址為 `http://localhost:8000`，前端經產生的呼叫層發出健康檢查請求
- **THEN** 送出的請求為 `GET http://localhost:8000/api/v1/health`，憑證模式為 `include`
- **AND** 請求標頭 `Accept-Language` 為 `zh-TW`
- **AND** 請求沒有 `Content-Type` 標頭，也沒有 `X-Correlation-ID` 標頭

#### Scenario: 介面語言為英文時請求語言為英文

- **WHEN** 介面語言為 `en`，前端發出健康檢查請求
- **THEN** 請求標頭 `Accept-Language` 為 `en`

#### Scenario: 帶 body 的請求帶 JSON 內容型別

- **WHEN** 呼叫端經唯一出口送出方法為 `POST`、body 為 `{"name": "a"}` 的請求
- **THEN** 請求帶 `Content-Type: application/json`，body 為該物件的 JSON 字串

#### Scenario: 基底網址為空時以同源相對路徑送出

- **WHEN** 基底網址設定為空字串，組出健康檢查請求的網址
- **THEN** 網址正好是相對路徑 `/api/v1/health`，不含協定與主機，由瀏覽器以頁面的同源補齊

### Requirement: 基底網址設定不合法時啟動失敗

前端的基底網址設定（`VITE_API_BASE_URL`）SHALL 只接受空值或以 `http://`、`https://` 開頭且不以 `/` 結尾的絕對網址；其他值 MUST 讓應用在啟動時丟出錯誤，錯誤訊息含設定名稱 `VITE_API_BASE_URL`，且不得因此送出任何請求。

來源：api-agent-rules A6；`AGENTS.md` Hard Rule 8、9；`system-design.md` §元件清單 `readApiConfig`。

#### Scenario: 基底網址缺少協定時啟動失敗

- **WHEN** 基底網址設定為 `localhost:8000`，應用啟動
- **THEN** 啟動丟出錯誤，訊息含 `VITE_API_BASE_URL`
- **AND** 沒有任何請求被送出

#### Scenario: 基底網址以斜線結尾時啟動失敗

- **WHEN** 基底網址設定為 `http://localhost:8000/`，應用啟動
- **THEN** 啟動丟出錯誤，訊息含 `VITE_API_BASE_URL`

### Requirement: 成功時交出資料與追蹤資訊

收到 `2xx` 且 body 符合成功外層（`success` 為 `true`；`code`、`message`、`timestamp`、`traceId` 為字串；有 `data` 鍵）時，唯一出口 SHALL 回傳 `{ data, meta: { traceId, timestamp } }`：`data` 為外層的 `data`，`meta` 取自外層同名欄位；外層的 `success`、`code`、`message` 不交給呼叫端。`204` SHALL 回傳無值、不丟錯誤。

來源：api-agent-rules A6、A7；ADR-003 D5；`api-contract.md` §唯一出口的回傳形狀；clarification Q2。

#### Scenario: 唯一出口成功時回傳資料與追蹤資訊

- **WHEN** 後端以 `200` 回應 `{"success": true, "code": "OK", "message": "成功", "data": {"status": "ok", "database": "ok"}, "timestamp": "2026-11-20T08:15:30.123Z", "traceId": "3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01"}`
- **THEN** 呼叫端拿到 `{"data": {"status": "ok", "database": "ok"}, "meta": {"traceId": "3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01", "timestamp": "2026-11-20T08:15:30.123Z"}}`
- **AND** 回傳值沒有 `success`、`code`、`message` 鍵

#### Scenario: 204 回應不丟錯誤

- **WHEN** 後端以 `204` 回應且沒有 body
- **THEN** 唯一出口回傳無值，不丟出錯誤

### Requirement: 錯誤外層轉成 http 類型的單一錯誤

收到非 `2xx` 且 body 符合錯誤外層（`success` 為 `false`；`code`、`message`、`timestamp`、`traceId` 為字串；`data` 為 `null`；`errors` 為陣列或 `null`，缺鍵視同 `null`）時，唯一出口 SHALL 丟出單一錯誤型別：`kind` 為 `http`，`status`、`code`、`message`、`traceId`、`timestamp` 取自回應；`fieldErrors` 在 `422` 時為外層的 `errors`，其他時候為 `null`。

來源：api-agent-rules A7、A8；`api-contract.md` §錯誤正規化契約、§外層的判定規則；clarification Q2、Q19（C4）。

#### Scenario: 503 錯誤外層轉成單一錯誤

- **WHEN** 後端以 `503` 回應 `{"success": false, "code": "DATABASE_UNAVAILABLE", "message": "資料庫暫時無法連線，請稍後再試", "data": null, "timestamp": "2026-11-20T08:15:35.456Z", "traceId": "9c1d7e2a-4b3f-4a8e-8d6c-0f5e2a1b3c47", "errors": null}`
- **THEN** 呼叫端收到的錯誤為 `{kind: "http", status: 503, code: "DATABASE_UNAVAILABLE", message: "資料庫暫時無法連線，請稍後再試", traceId: "9c1d7e2a-4b3f-4a8e-8d6c-0f5e2a1b3c47", timestamp: "2026-11-20T08:15:35.456Z", fieldErrors: null}`

#### Scenario: 404 錯誤外層轉成單一錯誤

- **WHEN** 後端以 `404` 回應 `code` 為 `NOT_FOUND`、`message` 為「找不到指定的資源」的錯誤外層
- **THEN** 呼叫端收到的錯誤 `kind` 為 `http`、`status` 為 `404`、`code` 為 `NOT_FOUND`、`message` 為「找不到指定的資源」

#### Scenario: 422 錯誤外層帶出逐欄位錯誤

- **WHEN** 後端以 `422` 回應 `code` 為 `VALIDATION_FAILED`、`errors` 為 `[{"location": "body", "field": "displayName", "code": "missing", "message": "Field required"}]` 的錯誤外層
- **THEN** 呼叫端收到的錯誤 `kind` 為 `http`、`status` 為 `422`，`fieldErrors` 等於該 `errors` 陣列

#### Scenario: 錯誤外層缺少 errors 鍵仍視為錯誤外層

- **WHEN** 後端以 `500` 回應的錯誤外層沒有 `errors` 鍵，其他欄位齊全
- **THEN** 呼叫端收到的錯誤 `kind` 為 `http`、`status` 為 `500`、`fieldErrors` 為 `null`

### Requirement: 非外層回應轉成 invalidResponse 錯誤

回應 body 不是 JSON、為空，或是 JSON 但不符合成功或錯誤外層時（含 `2xx`），唯一出口 SHALL 丟出 `kind` 為 `invalidResponse` 的單一錯誤：`status` 為實際狀態碼，`traceId` 取自回應標頭 `X-Correlation-ID`（沒有則 `null`），`code`、`timestamp`、`fieldErrors` 為 `null`；`message` 為英文診斷字串，MUST NOT 含回應 body 原文。

來源：api-agent-rules A7；`api-contract.md` §錯誤正規化契約、§外層的判定規則；`system-design.md` §唯一出口的處理順序。

#### Scenario: 唯一出口把非外層回應轉成單一錯誤型別

- **WHEN** 回應為 `200`、`Content-Type: text/html`、body 為 `<!doctype html><html>SECRET-BODY</html>`，沒有 `X-Correlation-ID` 標頭
- **THEN** 呼叫端收到的錯誤 `kind` 為 `invalidResponse`、`status` 為 `200`、`traceId` 為 `null`、`code` 為 `null`
- **AND** 錯誤的 `message` 不含 `SECRET-BODY`

#### Scenario: 非外層回應帶追蹤編號標頭時保留追蹤編號

- **WHEN** 回應為 `502`、body 為空、回應標頭 `X-Correlation-ID` 為 `abcd1234-ef56`
- **THEN** 呼叫端收到的錯誤 `kind` 為 `invalidResponse`、`status` 為 `502`、`traceId` 為 `abcd1234-ef56`

#### Scenario: 形狀不符的 JSON 不算成功

- **WHEN** 回應為 `200`、body 為 `{"success": "yes", "data": {}}`
- **THEN** 呼叫端收到的錯誤 `kind` 為 `invalidResponse`，不會拿到成功結果

### Requirement: 連線失敗、逾時與取消各有錯誤類型

唯一出口 SHALL 在連線失敗時丟出 `kind` 為 `network`、在請求送出滿 15 秒仍未收到回應時中止並丟出 `kind` 為 `timeout`、在呼叫端取消時丟出 `kind` 為 `aborted` 的單一錯誤；三者的 `status`、`code`、`traceId`、`timestamp`、`fieldErrors` 為 `null`，`message` 為英文診斷字串，MUST NOT 含原生錯誤的訊息或堆疊。

來源：api-agent-rules A6、A7；`api-contract.md` §`ApiErrorKind`；clarification Q4。

#### Scenario: 連線被拒時為 network 錯誤

- **WHEN** 請求的 `fetch` 因連線被拒而失敗，原生錯誤訊息為 `NATIVE-FAILURE-TEXT`
- **THEN** 呼叫端收到的錯誤 `kind` 為 `network`、`traceId` 為 `null`
- **AND** 錯誤的 `message` 不含 `NATIVE-FAILURE-TEXT`

#### Scenario: 超過 15 秒未回應時為 timeout 錯誤

- **WHEN** 後端一直不回應，時間從送出請求起推進 14,999 毫秒
- **THEN** 請求仍在等待，沒有錯誤
- **AND** 時間再推進 1 毫秒後，請求被中止，呼叫端收到的錯誤 `kind` 為 `timeout`

#### Scenario: 呼叫端取消時為 aborted 錯誤

- **WHEN** 請求送出後、回應抵達前，呼叫端取消請求
- **THEN** 呼叫端收到的錯誤 `kind` 為 `aborted`，不是 `timeout` 或 `network`

### Requirement: 呼叫端只會拿到單一錯誤型別

任何經唯一出口的失敗 SHALL 以單一錯誤型別呈現給呼叫端；呼叫端 MUST NOT 拿到原生的網路錯誤、中止錯誤、回應物件或未收窄的值。

來源：api-agent-rules A7；frontend-agent-rules F2；`api-contract.md` §錯誤正規化契約。

#### Scenario: 五種失敗都是單一錯誤型別

- **WHEN** 分別以錯誤外層、非外層回應、連線失敗、逾時、呼叫端取消五種情況呼叫唯一出口
- **THEN** 五次丟出的錯誤都通過單一錯誤型別的判定，`kind` 依序為 `http`、`invalidResponse`、`network`、`timeout`、`aborted`

### Requirement: 伺服器資料快取不自動重試

伺服器資料快取的預設 SHALL 不自動重試失敗的查詢，也不自動重送失敗的寫入；每次失敗只完成一次請求（開發模式下 React StrictMode 的雙重掛載會中止第一次請求，被中止的請求不計，見 design.md D6），由使用者或呼叫端決定是否再試。

來源：api-agent-rules A7、A9；clarification Q4。

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

- **WHEN** 查詢收到 `401` 錯誤外層
- **THEN** 整個過程只送出 1 次請求
- **AND** 該錯誤被判定為認證錯誤

#### Scenario: 403 不是認證錯誤

- **WHEN** 查詢收到 `403` 錯誤外層
- **THEN** 該錯誤不被判定為認證錯誤，整個過程只送出 1 次請求

#### Scenario: 連線失敗不是認證錯誤

- **WHEN** 查詢因連線失敗收到 `kind` 為 `network` 的錯誤
- **THEN** 該錯誤不被判定為認證錯誤
