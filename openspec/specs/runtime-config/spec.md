# runtime-config Specification

## Purpose

定義後端服務啟動時如何一次驗證設定：唯一的必要設定 `CORS_ALLOWED_ORIGINS` 不合法就拒絕啟動，其餘設定的預設值，依有無 `DATABASE_URL` 選擇 Lite 層或正式層，以及允許來源設定生效後的跨來源行為。

## Requirements

### Requirement: 允許來源是必要設定且不得含萬用字元

系統 SHALL 在啟動時驗證 `CORS_ALLOWED_ORIGINS`：它是本次唯一的必要設定，值為逗號分隔的來源清單，每一項 MUST 是 `http://` 或 `https://` 加主機（可帶連接埠）、不帶路徑。缺少、空清單、含 `*` 或任一項格式不合法時，服務 MUST 拒絕啟動、以非零狀態結束，錯誤訊息 MUST 指出是哪一項設定與原因，且 MUST NOT 印出設定值。

來源：backend-agent-rules B10、security-agent-rules S2、S9、AGENTS.md Hard Rule 7、clarification Q1。

#### Scenario: 缺必要設定時啟動失敗

- **WHEN** 未設定 `CORS_ALLOWED_ORIGINS` 就啟動服務
- **THEN** 服務沒有開始接受請求，程序以非零狀態結束
- **AND** 錯誤訊息含 `CORS_ALLOWED_ORIGINS` 這個名稱

#### Scenario: 允許來源為空清單時啟動失敗

- **WHEN** 以 `CORS_ALLOWED_ORIGINS=""` 啟動服務
- **THEN** 服務拒絕啟動，錯誤訊息含 `CORS_ALLOWED_ORIGINS`

#### Scenario: 允許來源含星號時啟動失敗

- **WHEN** 分別以 `CORS_ALLOWED_ORIGINS=*` 與 `CORS_ALLOWED_ORIGINS=http://localhost:5173,*` 啟動服務
- **THEN** 兩次都拒絕啟動，錯誤訊息含 `CORS_ALLOWED_ORIGINS`

#### Scenario: 允許來源格式不合法時啟動失敗

- **WHEN** 以 `CORS_ALLOWED_ORIGINS=http://localhost:5173/app` 或 `CORS_ALLOWED_ORIGINS=localhost:5173` 啟動服務
- **THEN** 服務拒絕啟動，錯誤訊息含 `CORS_ALLOWED_ORIGINS`，且不含 `localhost:5173`

### Requirement: 資料庫連線字串只接受 PostgreSQL

系統 SHALL 在設定了 `DATABASE_URL` 時只接受 PostgreSQL 的連線字串，`postgresql://`、`postgresql+asyncpg://` 與 `postgres://` 三種寫法都接受，並連到同一個資料庫；其他 scheme，包括指定了其他驅動的 PostgreSQL 寫法（例 `postgresql+psycopg://`），MUST 讓服務拒絕啟動，錯誤訊息 MUST 指出 `DATABASE_URL` 且 MUST NOT 印出連線字串（含帳號密碼）。

來源：ADR-003 D7、backend-agent-rules B10、security-agent-rules S9、clarification Q1。

#### Scenario: 非 PostgreSQL 的連線字串讓啟動失敗

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `DATABASE_URL=mysql://user:CANARY-pw@db/app` 啟動服務
- **THEN** 服務拒絕啟動，錯誤訊息含 `DATABASE_URL`，且不含 `CANARY-pw`

#### Scenario: 指定其他驅動的 PostgreSQL 連線字串讓啟動失敗

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `DATABASE_URL=postgresql+psycopg://user:CANARY-pw@db/app` 啟動服務
- **THEN** 服務拒絕啟動，錯誤訊息含 `DATABASE_URL`，且不含 `CANARY-pw`、`db/app`

### Requirement: 其餘設定都有預設值

系統 SHALL 在只設定合法的 `CORS_ALLOWED_ORIGINS` 時即可啟動：`CORS_ALLOW_CREDENTIALS` 預設為 true，`DATABASE_URL` 可不設，`SQLITE_PATH` 預設為 `./data/label_suite.db`；SQLite 檔的父目錄不存在時 MUST 自動建立。

來源：ADR-003 D7、backend-agent-rules B10、clarification Q1。

#### Scenario: 只設允許來源即可啟動

- **WHEN** 只設定 `CORS_ALLOWED_ORIGINS=http://localhost:5173`、其餘設定都不設，在一個沒有 `data/` 目錄的工作目錄啟動服務
- **THEN** 服務啟動成功，`GET /api/v1/health` 回覆 `200`
- **AND** `./data/label_suite.db` 已被建立

### Requirement: 依有無 DATABASE_URL 選擇資料庫層

系統 SHALL 在沒設 `DATABASE_URL` 時使用 Lite 層（`SQLITE_PATH` 指向的 SQLite 檔），設了時使用正式層（該 PostgreSQL）；每個請求 MUST 使用自己的資料庫工作階段，請求結束後連線 MUST 歸還。

來源：ADR-003 D7、backend-agent-rules B3、clarification Q1。

#### Scenario: 沒設 DATABASE_URL 時走 Lite 層

- **WHEN** 只設定 `CORS_ALLOWED_ORIGINS` 與 `SQLITE_PATH=<暫存目錄>/lite.db` 啟動服務並呼叫 `GET /api/v1/health`
- **THEN** 回覆 `200`，且 `<暫存目錄>/lite.db` 存在

#### Scenario: 設了 DATABASE_URL 時走正式層

- **WHEN** 以指向可連線 PostgreSQL 的 `DATABASE_URL`（分別用 `postgresql://`、`postgresql+asyncpg://` 與 `postgres://` 寫法）啟動服務並呼叫 `GET /api/v1/health`
- **THEN** 三次都回覆 `200`，且 `SQLITE_PATH` 指向的檔案沒有被建立

#### Scenario: 請求結束後連線歸還

- **WHEN** 連續送出 20 次 `GET /api/v1/health` 並全部完成
- **THEN** 資料庫連線池中被借出的連線數為 0

### Requirement: 允許來源設定決定跨來源回應

系統 SHALL 只對 `CORS_ALLOWED_ORIGINS` 列出的來源回應跨來源標頭，並帶 `Access-Control-Allow-Credentials: true`（依 `CORS_ALLOW_CREDENTIALS`）；允許的方法與標頭 MUST 逐一列出、MUST NOT 是 `*`。不在清單內的來源，請求照常處理，但回應 MUST NOT 帶 `Access-Control-Allow-Origin`。

來源：security-agent-rules S2、AGENTS.md Hard Rule 7、ADR-004 D1 §後果、clarification §不需維護者決定的結論（待決 3）。

#### Scenario: 允許來源的請求帶跨來源標頭

- **WHEN** 以 `CORS_ALLOWED_ORIGINS=http://localhost:5173` 啟動，呼叫端帶 `Origin: http://localhost:5173` 送出 `GET /api/v1/health`
- **THEN** 回應的 `Access-Control-Allow-Origin` 為 `http://localhost:5173`、`Access-Control-Allow-Credentials` 為 `true`

#### Scenario: 預檢回應明列方法與標頭

- **WHEN** 允許來源送出 `OPTIONS /api/v1/health` 預檢，`Access-Control-Request-Method: GET`、`Access-Control-Request-Headers: accept-language,x-correlation-id`
- **THEN** 回應的 `Access-Control-Allow-Methods` 列出 `GET, POST, PUT, PATCH, DELETE, OPTIONS`，不是 `*`
- **AND** `Access-Control-Allow-Headers` 含 `Accept-Language` 與 `X-Correlation-ID`，不是 `*`

#### Scenario: 不在清單內的來源不帶跨來源標頭

- **WHEN** 呼叫端帶 `Origin: http://evil.example` 送出 `GET /api/v1/health`
- **THEN** 回應為 `200`，但不帶 `Access-Control-Allow-Origin`
