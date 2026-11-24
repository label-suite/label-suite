## MODIFIED Requirements

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

## ADDED Requirements

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

- **WHEN** 檢視 `docker-compose.prod.yml` 後端服務傳入的環境設定
- **THEN** `API_DOCS_ENABLED` 的值為 `false`
- **AND** `.env.example` 含 `API_DOCS_ENABLED` 的說明
