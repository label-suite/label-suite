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

系統 SHALL 在只設定合法的 `CORS_ALLOWED_ORIGINS` 時即可啟動：`CORS_ALLOW_CREDENTIALS` 預設為 true，`API_DOCS_ENABLED` 預設為 true，`DATABASE_URL` 可不設，`SQLITE_PATH` 預設為 `./data/label_suite.db`；SQLite 檔的父目錄不存在時 MUST 自動建立。`API_DOCS_ENABLED` 的值無法解析為布林時，服務 MUST 拒絕啟動、以非零狀態結束，錯誤訊息 MUST 指出 `API_DOCS_ENABLED` 這個名稱與原因，且 MUST NOT 印出設定值。

來源：ADR-003 D7、backend-agent-rules B10、security-agent-rules S9、clarification Q1、issue #592、archive infra-compose-e2e-ci clarification Q13。

#### Scenario: 只設允許來源即可啟動

- **WHEN** 只設定 `CORS_ALLOWED_ORIGINS=http://localhost:5173`、其餘設定都不設，在一個沒有 `data/` 目錄的工作目錄啟動服務
- **THEN** 服務啟動成功，`GET /api/v1/health` 回覆 `200`
- **AND** `./data/label_suite.db` 已被建立
- **AND** `GET /docs` 回覆 `200`（`API_DOCS_ENABLED` 預設為 true）

#### Scenario: API_DOCS_ENABLED 不是布林值時啟動失敗

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `API_DOCS_ENABLED=CANARY-maybe` 啟動服務
- **THEN** 服務拒絕啟動，程序以非零狀態結束
- **AND** 錯誤訊息含 `API_DOCS_ENABLED`，且不含 `CANARY-maybe`

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

### Requirement: 內建 API 文件路由依設定提供

系統 SHALL 依 `API_DOCS_ENABLED` 決定是否提供四條內建、不在 `/api/v1` 底下的文件與介面描述路由：`/docs`、`/docs/oauth2-redirect`、`/redoc`、`/openapi.json`。設為 true 時，四條路由 MUST 如現況提供，不套成功回應 envelope；設為 false 時，四條路由 MUST 全部不提供，請求 MUST 得到與其他不存在路徑一致的 `404` 與共通錯誤 envelope（錯誤碼 `NOT_FOUND`，訊息依請求語系），回應 MUST NOT 帶內部識別碼或堆疊，且 MUST NOT 影響 `/api/v1` 底下任何端點。

來源：issue #592、archive infra-compose-e2e-ci clarification Q13、archive backend-skeleton clarification N6、clarification Q1、Q2。

#### Scenario: 正式層不提供內建 API 文件與介面描述路由

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `API_DOCS_ENABLED=false` 啟動服務，分別送出 `GET /docs`、`GET /docs/oauth2-redirect`、`GET /redoc`、`GET /openapi.json`
- **THEN** 四次都回覆 `404`，body 為共通 envelope，錯誤碼為 `NOT_FOUND`
- **AND** 回應內容與請求任一不存在路徑（例如 `GET /no-such-path`）的 `404` 形態一致，不含「文件」或路由註冊的線索

#### Scenario: Lite 層與本機開發維持提供內建 API 文件

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS`、不設 `DATABASE_URL`、不設 `API_DOCS_ENABLED` 啟動服務，分別送出 `GET /docs`、`GET /docs/oauth2-redirect`、`GET /redoc`、`GET /openapi.json`
- **THEN** 四次都回覆 `200`，且回應不是 envelope 的 JSON 外層
- **AND** 明確設 `API_DOCS_ENABLED=true` 時結果相同

#### Scenario: 關閉內建文件不影響業務端點

- **WHEN** 以 `API_DOCS_ENABLED=false` 啟動服務並送出 `GET /api/v1/health`
- **THEN** 回覆 `200`，成功回應仍為 envelope

### Requirement: 契約匯出不受內建文件設定影響

系統 SHALL 使匯出的 `backend/openapi.json` 與文件站副本在 `API_DOCS_ENABLED` 為 true 與 false 下內容位元組相同，且契約的 `paths` MUST NOT 含四條內建路由。

來源：api-agent-rules A4、A5、ADR-003 D6、clarification Q5。

#### Scenario: 契約匯出不受設定影響

- **WHEN** 在 `API_DOCS_ENABLED` 為 true 與 false 兩種環境下各執行契約匯出命令
- **THEN** 兩次都成功，產出的 `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 與已提交版本位元組相同
- **AND** 契約的 `paths` 不含 `/docs`、`/redoc`、`/openapi.json`、`/docs/oauth2-redirect`

### Requirement: 正式層部署明確關閉內建文件

系統的正式層容器部署設定 MUST 明確將 `API_DOCS_ENABLED` 設為 false，且 `.env.example` MUST 說明該設定。

來源：ADR-008 D1、issue #592、clarification Q1。

#### Scenario: 正式層部署明確關閉內建文件

- **WHEN** 展開 `docker-compose.prod.yml` 的有效設定（以 `.env` 或環境提供必要變數）
- **THEN** 後端服務的 `API_DOCS_ENABLED` 為 `false`，且不受 `.env` 中同名設定影響
- **AND** `.env.example` 含 `API_DOCS_ENABLED` 的說明，並指出正式層 compose 固定該值為 false
