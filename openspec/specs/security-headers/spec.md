# security-headers Specification

## Purpose

定義系統公開入口對外回應必須帶的安全標頭：有哪些標頭、每個標頭的完整值、在哪些回應類別上必須出現、不得帶哪些標頭，以及這組標頭不得擋下前端自己的資源，讓整組標頭成為可比對的契約，被刪除、改值或在某條路徑漏掉時能被檢查出來。

## Requirements

### Requirement: 安全標頭的完整值

經公開入口的回應 SHALL 帶 `Content-Security-Policy`、`X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy`、`Cross-Origin-Opener-Policy`、`Permissions-Policy` 與 `Server` 七個標頭，值 MUST 與本 requirement 的 Scenario 所列逐字元相同。`Content-Security-Policy` MUST 為強制模式，MUST NOT 以僅回報模式的標頭替代，也 MUST NOT 含違規回報的指令。

來源：issue #568 §需求目標、§驗收條件 2；ADR-008 D1 §決定；security-agent-rules S9 §正例；`AGENTS.md` Hard Rule 9；nginx-security-headers clarification Q2、Q3、Q3-附。

#### Scenario: 頁面殼帶完整的安全標頭值

- **WHEN** 任一層編排已起，對公開入口送出 `GET /`
- **THEN** 回應為 `200`，且下列標頭的值逐字元相同：
  - `Content-Security-Policy`：`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self'; frame-ancestors 'self'`
  - `X-Frame-Options`：`SAMEORIGIN`
  - `X-Content-Type-Options`：`nosniff`
  - `Referrer-Policy`：`strict-origin-when-cross-origin`
  - `Cross-Origin-Opener-Policy`：`same-origin`
  - `Permissions-Policy`：`camera=(), microphone=(), geolocation=()`
  - `Server`：`nginx`
- **AND** 回應沒有 `Content-Security-Policy-Report-Only` 標頭

#### Scenario: 防嵌入的兩個標頭一致

- **WHEN** 讀取 `GET /` 回應的 `X-Frame-Options` 與 `Content-Security-Policy`
- **THEN** `X-Frame-Options` 為 `SAMEORIGIN`，`Content-Security-Policy` 含 `frame-ancestors 'self'` 與 `frame-src 'self'`，不含 `frame-ancestors 'none'`

#### Scenario: Server 標頭不帶版本

- **WHEN** 對公開入口送出 `GET /` 與 `POST /`
- **THEN** 兩個回應的 `Server` 標頭都恰好是 `nginx`，不含 `/` 或任何版本號

### Requirement: 每一類回應都帶同一組安全標頭

公開入口的每一類回應 SHALL 帶「安全標頭的完整值」所列的七個標頭且值相同：頁面殼、前端路由的深層路徑、建置資源、後端成功回應、後端錯誤回應、公開入口自己產生的錯誤（含方法不允許，與後端無法連線時的 `502` 或 `504`）。加上標頭 MUST NOT 改變回應的狀態碼與 body。

來源：issue #568 §驗收條件 2；ADR-008 D1 §後果；archive `infra-compose-e2e-ci` system-design D6；nginx-security-headers clarification Q3-附、Q4、Q11、§交給後續產出。

#### Scenario: 公開入口的每一類回應都帶同一組安全標頭

- **WHEN** 任一層編排已起，對公開入口依序送出 `GET /`、`GET /some/spa/path`、`GET` 頁面殼引用的那支 `/assets/*.js`、`GET /api/v1/health`、`GET /api/v1/does-not-exist`、`POST /`
- **THEN** 狀態碼依序為 `200`、`200`、`200`、`200`、`404`、`405`
- **AND** 六個回應都帶七個標頭，每個標頭的值與「頁面殼帶完整的安全標頭值」所列逐字元相同

#### Scenario: 後端錯誤回應保留錯誤外層並帶安全標頭

- **WHEN** 對公開入口送出 `GET /api/v1/does-not-exist`
- **THEN** 回應為 `404`，body 是後端的錯誤外層（`success` 為 `false`、`code` 為 `"NOT_FOUND"`、`data` 為 `null`）
- **AND** 回應帶七個標頭且值與頁面殼相同

#### Scenario: 後端停止時公開入口的 502 或 504 也帶安全標頭

- **WHEN** 任一層編排已起後停止後端服務，再對公開入口送出 `GET /api/v1/health`
- **THEN** 回應為 `502` 或 `504`（依公開入口連不到後端的方式而定，兩者皆合格）
- **AND** 回應帶七個標頭且值與頁面殼相同

### Requirement: 回應不帶 HSTS

公開入口的回應 MUST NOT 帶 `Strict-Transport-Security` 標頭；HSTS 由公開入口前面的 TLS 邊緣負責，不在本系統的回應中發出。

來源：issue #568 §需求目標；ADR-008 D1 §決定、§待決 第 1 列；nginx-security-headers clarification Q1。

#### Scenario: 每一類回應都沒有 HSTS

- **WHEN** 對公開入口送出「公開入口的每一類回應都帶同一組安全標頭」所列的六個請求，以及後端停止後的 `GET /api/v1/health`
- **THEN** 七個回應都沒有 `Strict-Transport-Security` 標頭

### Requirement: 每個安全標頭只出現一次

公開入口的每一個回應中，「安全標頭的完整值」所列的每個標頭 MUST 恰好出現一次；上游回應若帶同名標頭，最終回應 MUST NOT 出現兩個值。

來源：issue #568 §驗收條件 2；nginx-security-headers clarification Q4、system-design D3。

#### Scenario: 經後端轉發的回應沒有重複的安全標頭

- **WHEN** 對公開入口送出 `GET /api/v1/health` 與 `GET /api/v1/does-not-exist`，逐行讀取原始回應標頭
- **THEN** 兩個回應中七個標頭各恰好一行

### Requirement: 安全標頭與身分無關

公開入口回應的安全標頭 SHALL 對所有角色與未登入的請求相同，MUST NOT 依請求是否帶身分憑證、以哪個角色登入而不同；標頭 MUST NOT 含任何資料、使用者識別或標準答案。

來源：issue #568 §驗收條件 2；security-agent-rules S2 §正例；`AGENTS.md` Hard Rule 6；nginx-security-headers clarification Q4、第 10 面向。

#### Scenario: 帶與不帶身分憑證的回應標頭相同

- **WHEN** 對 `GET /` 與 `GET /api/v1/health` 各送兩次請求，一次不帶 `Cookie` 與 `Authorization`，一次帶任意的 `Cookie` 與 `Authorization: Bearer <任意值>`
- **THEN** 同一路徑兩次回應的七個標頭值逐字元相同，且都與頁面殼所列的值相同
- **AND** 七個標頭的值都不含請求帶的 `Cookie` 或 `Authorization` 內容

### Requirement: CSP 不擋前端自己的資源

在公開入口以瀏覽器開啟前端正式建置的頁面殼時，安全標頭 MUST NOT 擋下前端自己的資源與同源 API 呼叫。「首頁正常」的判準 SHALL 為：頁面殼帶 `Content-Security-Policy`；頁面殼與它引用的每一支建置資源回 `200`；載入期間 CSP 違規 0 次、請求失敗 0 次；頁面內同源呼叫 `/api/v1/health` 成功。判準 MUST NOT 依賴頁面的文案或元素。

來源：issue #568 §驗收條件 3；ADR-008 D1；nginx-security-headers clarification Q4、Q5。

#### Scenario: CSP 不擋前端自己的資源

- **WHEN** 正式層編排已起，瀏覽器開啟公開入口的 `/`，等待頁面殼引用的建置資源載入完成，再在頁面內以同源相對路徑呼叫 `/api/v1/health`
- **THEN** 頁面殼的回應帶 `Content-Security-Policy`，頁面殼與它引用的每一支 `/assets/` 資源都回 `200`
- **AND** 載入期間瀏覽器回報的 CSP 違規為 0 次，請求失敗為 0 次
- **AND** 頁面內的 `/api/v1/health` 呼叫回 `200`，body 的 `data.status` 為 `"ok"`
