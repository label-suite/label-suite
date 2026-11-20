# Spec Delta

## Purpose

定義所有 `/api/v1` 回應共用的外層契約：成功與錯誤外層的欄位、成功碼與錯誤碼、時間格式、`422` 的逐欄位錯誤、`404`／`405`／`500` 的錯誤外層與不露內部細節、對外欄位的命名，以及分頁回應的形狀，讓之後每個端點與前端的產生 client 都依同一個形狀運作。

## ADDED Requirements

### Requirement: 成功回應包一層六欄位外層

系統 SHALL 讓 `/api/v1` 底下每個成功回應的 body 都是一個外層物件，恰好含 `success`、`code`、`message`、`data`、`timestamp`、`traceId` 六個欄位：`success` 為 `true`，`code` 為 `"OK"`，端點的資料放在 `data`。本次沒有 `204`、檔案或串流這類不包外層的例外端點。

來源：ADR-003 D5、api-agent-rules A1、#503 裁定 1–2、clarification Q8。

#### Scenario: 成功回應包含六個外層欄位

- **WHEN** 呼叫端送出 `GET /api/v1/health`，資料庫可以連線
- **THEN** 系統回覆 `200`，body 的頂層欄位恰好是 `success`、`code`、`message`、`data`、`timestamp`、`traceId`
- **AND** `success` 為 `true`、`code` 為 `"OK"`、`message` 為非空字串、`traceId` 為非空字串

### Requirement: 外層時間為 UTC 毫秒格式

系統 SHALL 讓成功與錯誤外層的 `timestamp` 都是 ISO 8601、UTC、精確到毫秒、以 `Z` 結尾的字串，值為伺服器組成這個回應的時間。

來源：api-agent-rules A1、clarification Q8。

#### Scenario: 外層時間為 UTC 毫秒格式

- **WHEN** 呼叫端送出任一 `/api/v1` 請求（成功或錯誤）
- **THEN** 外層的 `timestamp` 符合 `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`
- **AND** 該時間與伺服器收到請求的 UTC 時間相差不超過 5 秒

### Requirement: 錯誤回應使用同一個錯誤外層

系統 SHALL 讓 `/api/v1` 底下所有 `4xx` 與 `5xx` 回應的 body 都是錯誤外層：含成功外層的六個欄位再加 `errors`，`success` 為 `false`、`data` 為 `null`；只有 `422` 的 `errors` 為非空陣列，其他錯誤的 `errors` 為 `null`。

來源：api-agent-rules A7、ADR-003 D5、#503 裁定 2。

#### Scenario: 非驗證錯誤的 errors 為 null

- **WHEN** 呼叫端送出 `GET /api/v1/no-such-resource`
- **THEN** body 的頂層欄位恰好是 `success`、`code`、`message`、`data`、`timestamp`、`traceId`、`errors`
- **AND** `success` 為 `false`、`data` 為 `null`、`errors` 為 `null`

### Requirement: 錯誤碼為大寫底線格式並定義第一批通用碼

系統 SHALL 讓錯誤外層的 `code` 一律為 `UPPER_SNAKE_CASE`；通用錯誤碼不加前綴，模組專屬錯誤碼加模組前綴。本次的通用錯誤碼與 HTTP 狀態 MUST 一一對應：`NOT_FOUND`（404）、`METHOD_NOT_ALLOWED`（405）、`NOT_ACCEPTABLE`（406）、`VALIDATION_FAILED`（422）、`INTERNAL_ERROR`（500）、`DATABASE_UNAVAILABLE`（503）。

來源：api-agent-rules A7、clarification Q8。

#### Scenario: 通用錯誤碼與 HTTP 狀態對應

- **WHEN** 分別觸發路徑不存在、method 不支援、語言全部被拒、請求驗證失敗、未處理例外、資料庫無法連線六種錯誤
- **THEN** 回應依序為 `404`／`NOT_FOUND`、`405`／`METHOD_NOT_ALLOWED`、`406`／`NOT_ACCEPTABLE`、`422`／`VALIDATION_FAILED`、`500`／`INTERNAL_ERROR`、`503`／`DATABASE_UNAVAILABLE`
- **AND** 每個 `code` 都符合 `^[A-Z][A-Z0-9_]*$`

### Requirement: 請求驗證失敗回 422 與逐欄位錯誤

系統 SHALL 在 path、query、header 或 body 不符合端點宣告的形狀時回覆 `422`、`code` 為 `VALIDATION_FAILED`，`errors` 每一筆含 `location`、`field`、`code`、`message` 四個欄位。`field` MUST 使用呼叫端送出的小駝峰欄位名，以 `.` 串接、陣列索引寫數字；錯誤在整個 location 時為空字串。未宣告的 body 欄位與無法解析的 JSON 也 MUST 回 `422`；body 欄位 MUST 以小駝峰名稱送出，以底線命名送出的欄位名（例 `display_name`）視為未宣告欄位。

來源：api-agent-rules A2、A7、#503 裁定 3。

#### Scenario: 請求驗證失敗回 422 外層與逐欄位錯誤

- **WHEN** 呼叫端對一個要求 body 欄位 `displayName` 的 `/api/v1` 端點送出 `{}`
- **THEN** 系統回覆 `422`，`code` 為 `"VALIDATION_FAILED"`，`data` 為 `null`
- **AND** `errors` 含一筆 `{"location": "body", "field": "displayName", "code": "missing", "message": <非空字串>}`，且每一筆恰好只有這四個欄位

#### Scenario: 未宣告的 body 欄位被拒收

- **WHEN** 呼叫端對同一個端點送出 `{"displayName": "A", "nickName": "B"}`
- **THEN** 系統回覆 `422`，`errors` 含一筆 `location` 為 `"body"`、`field` 為 `"nickName"`、`code` 為 `"extra_forbidden"` 的錯誤

#### Scenario: 底線命名的 body 欄位被拒收

- **WHEN** 呼叫端對同一個端點送出 `{"display_name": "A"}`
- **THEN** 系統回覆 `422`，`code` 為 `"VALIDATION_FAILED"`
- **AND** `errors` 含一筆 `location` 為 `"body"`、`field` 為 `"display_name"`、`code` 為 `"extra_forbidden"` 的錯誤，以及一筆 `field` 為 `"displayName"`、`code` 為 `"missing"` 的錯誤

#### Scenario: 無法解析的 JSON 回 422

- **WHEN** 呼叫端對同一個端點送出 `Content-Type: application/json`、body 為 `{"displayName":`
- **THEN** 系統回覆 `422`、`code` 為 `"VALIDATION_FAILED"`，`errors` 至少一筆、`location` 為 `"body"`

### Requirement: 422 不回顯呼叫端送出的值

系統 MUST NOT 在 `422` 回應的任何位置回顯呼叫端送出的欄位值，`errors` 的每一筆也 MUST NOT 帶有欄位原值、驗證規則參數或外部說明連結。這是之後含密碼或答案內容的端點不經錯誤訊息外洩的前提。

來源：api-agent-rules A7、AGENTS.md Hard Rule 6、clarification §交給後續產出 第 9 項。

#### Scenario: 驗證錯誤不回顯送出的值

- **WHEN** 呼叫端對要求 `displayName` 為字串的端點送出 `{"displayName": 12345, "secretAnswer": "CANARY-7f3a"}`
- **THEN** 系統回覆 `422`
- **AND** 回應 body 序列化後的字串不含 `CANARY-7f3a`，也不含 `12345`
- **AND** `errors` 的每一筆只有 `location`、`field`、`code`、`message` 四個鍵，沒有 `input`、`ctx`、`url`

### Requirement: 不存在的路徑回 404 錯誤外層

系統 SHALL 在 `/api/v1` 底下的路徑不存在時回覆 `404` 錯誤外層、`code` 為 `NOT_FOUND`；之後「資源不存在」與「刻意隱藏」MUST 使用同一個錯誤碼與同一句訊息，讓呼叫端無法從外層分辨資源是否存在。

來源：api-agent-rules A7、security-agent-rules S10。

#### Scenario: 不存在的路徑回 404 外層

- **WHEN** 呼叫端送出 `GET /api/v1/no-such-resource`
- **THEN** 系統回覆 `404`，`code` 為 `"NOT_FOUND"`、`success` 為 `false`、`data` 為 `null`、`errors` 為 `null`
- **AND** 回應帶 `X-Correlation-ID` 標頭

### Requirement: 不支援的方法回 405 錯誤外層

系統 SHALL 在路徑存在但 method 不支援時回覆 `405` 錯誤外層、`code` 為 `METHOD_NOT_ALLOWED`，並保留列出允許方法的 `Allow` 標頭。

來源：api-agent-rules A7。

#### Scenario: 不支援的方法回 405 外層

- **WHEN** 呼叫端送出 `POST /api/v1/health`
- **THEN** 系統回覆 `405`，`code` 為 `"METHOD_NOT_ALLOWED"`、`data` 為 `null`
- **AND** 回應帶 `Allow` 標頭，值含 `GET`

### Requirement: 未處理例外回 500 且不露內部資訊

系統 SHALL 把處理請求時未被處理的例外（含回應內容不符合宣告形狀）轉成 `500` 錯誤外層、`code` 為 `INTERNAL_ERROR`、`message` 為通用訊息。回應 MUST NOT 含堆疊、例外型別、例外訊息、SQL、內部檔案路徑或連線字串，並且 MUST 帶 `X-Correlation-ID` 與允許來源的 CORS 標頭。

來源：api-agent-rules A7、規格 07-01 §卡控機制「系統要向使用者顯示錯誤」、clarification §交給後續產出 第 9 項。

#### Scenario: 未處理例外回 500 外層且不露出堆疊

- **WHEN** 處理 `/api/v1` 請求時拋出訊息為 `"CANARY-boom /srv/secret.py"` 的未處理例外，請求帶允許來源的 `Origin`
- **THEN** 系統回覆 `500`，`code` 為 `"INTERNAL_ERROR"`、`data` 為 `null`、`errors` 為 `null`
- **AND** 回應 body 不含 `CANARY-boom`、`/srv/secret.py`、`Traceback`、例外型別名稱
- **AND** 回應帶 `X-Correlation-ID`，值與 `traceId` 相同，並帶 `Access-Control-Allow-Origin` 為該來源

#### Scenario: 回應內容不符合宣告形狀時回 500 外層

- **WHEN** 一個 `/api/v1` 端點宣告回應 `data` 含必填欄位 `name`，處理後產生的內容缺少 `name` 且含值 `CANARY-resp`
- **THEN** 系統回覆 `500`，`code` 為 `"INTERNAL_ERROR"`、`data` 為 `null`、`errors` 為 `null`
- **AND** 回應 body 不含 `CANARY-resp`、`name` 的驗證錯誤說明或例外型別名稱
- **AND** 回應帶 `X-Correlation-ID`，值與 `traceId` 相同

### Requirement: 未處理例外留下可用追蹤編號對照的伺服器紀錄

系統 SHALL 在每次未處理例外時寫一筆 `ERROR` 等級的伺服器紀錄，含該請求的 `traceId`、method、path 與例外細節，讓部署者能用回應裡的 `traceId` 找到原因。紀錄 MUST NOT 含 request body、query string、header 或 cookie 的內容。

來源：api-agent-rules A7、security-agent-rules S9、ADR-008 D4。

#### Scenario: 未處理例外的紀錄含追蹤編號且不含請求內容

- **WHEN** 呼叫端帶 `Cookie: session=CANARY-cookie`、query `?q=CANARY-query`，觸發一個未處理例外
- **THEN** 伺服器紀錄有一筆 `ERROR`，含與回應 `traceId` 相同的值與請求的 path
- **AND** 該紀錄不含 `CANARY-cookie`、`CANARY-query`

### Requirement: 對外欄位一律小駝峰

系統 SHALL 讓所有回應 body 的欄位名都是小駝峰（例 `traceId`、`hasMore`），回應 MUST NOT 出現底線命名的欄位。

來源：api-agent-rules A2、#503 裁定 3。

#### Scenario: 回應欄位名為小駝峰

- **WHEN** 呼叫端送出 `GET /api/v1/health`
- **THEN** 回應含 `traceId`，不含 `trace_id`；body 任何層級的鍵都不含 `_`

### Requirement: 分頁回應的形狀與推導規則

系統 SHALL 讓之後每個列表回應的 `data` 恰好含 `items`、`total`、`limit`、`offset`、`hasMore`、`totalPages`、`nextOffset` 七個欄位，後三個由前四個推導：`hasMore` 為 `offset + limit < total`；`totalPages` 為 `ceil(total / limit)`，`total` 為 0 時為 0；`nextOffset` 在 `hasMore` 為真時是 `offset + limit`，否則為 `null`。分頁參數 `limit` 預設 20、範圍 1 到 100，`offset` 預設 0、不得小於 0。

來源：api-agent-rules A3。

#### Scenario: 中間頁的推導欄位

- **WHEN** 一個列表結果的 `total` 為 45、`limit` 為 20、`offset` 為 20
- **THEN** `hasMore` 為 `true`、`totalPages` 為 3、`nextOffset` 為 40

#### Scenario: 最後一頁沒有下一頁

- **WHEN** 一個列表結果的 `total` 為 45、`limit` 為 20、`offset` 為 40
- **THEN** `hasMore` 為 `false`、`totalPages` 為 3、`nextOffset` 為 `null`

#### Scenario: 沒有資料時頁數為零

- **WHEN** 一個列表結果的 `total` 為 0、`limit` 為 20、`offset` 為 0
- **THEN** `items` 為空陣列、`hasMore` 為 `false`、`totalPages` 為 0、`nextOffset` 為 `null`

#### Scenario: offset 超過總數時回空頁而非 404

- **WHEN** 一個列表結果的 `total` 為 5、`limit` 為 20、`offset` 為 40
- **THEN** 該結果是合法的分頁回應而不是錯誤（列表端點據此回 `200`、不回 `404`），`items` 為空陣列、`hasMore` 為 `false`、`nextOffset` 為 `null`

#### Scenario: 分頁參數的預設值與範圍

- **WHEN** 分頁參數未帶 `limit` 與 `offset`
- **THEN** 採用 `limit` 為 20、`offset` 為 0
- **AND** `limit` 為 0 或 101、`offset` 為 -1 時都視為驗證失敗
