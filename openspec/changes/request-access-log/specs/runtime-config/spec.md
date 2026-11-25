# Spec Delta

## MODIFIED Requirements

### Requirement: 其餘設定都有預設值

系統 SHALL 在只設定合法的 `CORS_ALLOWED_ORIGINS` 時即可啟動：`CORS_ALLOW_CREDENTIALS` 預設為 true，`API_DOCS_ENABLED` 預設為 true，`DATABASE_URL` 可不設，`SQLITE_PATH` 預設為 `./data/label_suite.db`，`LOG_LEVEL` 預設為 `INFO`；SQLite 檔的父目錄不存在時 MUST 自動建立。`API_DOCS_ENABLED` 的值無法解析為布林時，服務 MUST 拒絕啟動、以非零狀態結束，錯誤訊息 MUST 指出 `API_DOCS_ENABLED` 這個名稱與原因，且 MUST NOT 印出設定值。`LOG_LEVEL` 只接受 `DEBUG`、`INFO`、`WARNING`、`ERROR`、`CRITICAL`（不分大小寫）；其他值 MUST 讓服務拒絕啟動、以非零狀態結束，錯誤訊息 MUST 指出 `LOG_LEVEL` 這個名稱與原因，且 MUST NOT 印出設定值。兩層的容器編排檔 MUST 把 `.env` 的 `LOG_LEVEL` 傳進後端容器，`.env` 未設時傳入 `INFO`。

來源：ADR-003 D7、backend-agent-rules B10、security-agent-rules S9、clarification Q1、issue #592、archive infra-compose-e2e-ci clarification Q13、issue #567、request-access-log clarification Q12、Q14。

#### Scenario: 只設允許來源即可啟動

- **WHEN** 只設定 `CORS_ALLOWED_ORIGINS=http://localhost:5173`、其餘設定都不設，在一個沒有 `data/` 目錄的工作目錄啟動服務
- **THEN** 服務啟動成功，`GET /api/v1/health` 回覆 `200`
- **AND** `./data/label_suite.db` 已被建立
- **AND** `GET /docs` 回覆 `200`（`API_DOCS_ENABLED` 預設為 true）

#### Scenario: API_DOCS_ENABLED 不是布林值時啟動失敗

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `API_DOCS_ENABLED=CANARY-maybe` 啟動服務
- **THEN** 服務拒絕啟動，程序以非零狀態結束
- **AND** 錯誤訊息含 `API_DOCS_ENABLED`，且不含 `CANARY-maybe`

#### Scenario: LOG_LEVEL 未設時輸出等級為 INFO

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS`、不設 `LOG_LEVEL` 啟動服務，處理請求期間後端寫出一筆 `INFO` 紀錄與一筆 `DEBUG` 紀錄
- **THEN** 輸出含那一筆 `level=INFO` 的紀錄，不含那一筆 `DEBUG` 紀錄

#### Scenario: LOG_LEVEL 不分大小寫

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 分別加 `LOG_LEVEL=warning` 與 `LOG_LEVEL=WARNING` 啟動服務
- **THEN** 兩次都啟動成功，且輸出等級都是 `WARNING`（`INFO` 紀錄不輸出）

#### Scenario: LOG_LEVEL 不合法時啟動失敗

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `LOG_LEVEL=CANARY-verbose` 啟動服務
- **THEN** 服務拒絕啟動，程序以非零狀態結束
- **AND** 錯誤訊息含 `LOG_LEVEL`，且不含 `CANARY-verbose`

#### Scenario: 編排檔把 LOG_LEVEL 傳進後端容器

- **WHEN** 以 `.env.example` 複製出 `.env` 並加上 `LOG_LEVEL=WARNING`，分別展開 `docker-compose.yml` 與 `docker-compose.prod.yml` 的有效設定（正式層另以環境提供 `POSTGRES_PASSWORD`）
- **THEN** 兩份的後端服務 `environment` 都含 `LOG_LEVEL`，值為 `WARNING`
- **AND** `.env` 不設 `LOG_LEVEL` 時，兩份的後端服務 `LOG_LEVEL` 都是 `INFO`
