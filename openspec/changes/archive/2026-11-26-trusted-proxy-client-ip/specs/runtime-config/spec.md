# Spec Delta

## ADDED Requirements

### Requirement: 信任代理的位址清單在啟動時驗證

系統 SHALL 在啟動時驗證 `FORWARDED_ALLOW_IPS`：值為逗號分隔的清單，項目前後空白會被去掉，每一項 MUST 是單一 IP 位址，或主機位元為零的 CIDR 網段。清單含 `*`、前綴長度為 0 的網段（`0.0.0.0/0`、`::/0`）、主機位元不為零的網段（`127.0.0.1/8`）、主機名稱（`localhost`）、空項目，或整個清單為空時，服務 MUST 拒絕啟動、以非零狀態結束。這些值在不驗證時會被靜默當成「信任所有人」或「靜默失效」。

來源：issue #566；ADR-004 D7；security-agent-rules S9；clarification Q12；`system-design.md` 實測 D4 至 D11。

#### Scenario: 受信任位址設定不合法時啟動失敗

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS`，分別以 `FORWARDED_ALLOW_IPS=*`、`0.0.0.0/0`、`::/0`、`127.0.0.1/8`、`localhost`、`1.2.3.4,,5.6.7.8` 與空字串啟動服務
- **THEN** 七次都拒絕啟動，程序以非零狀態結束，服務沒有開始接受請求

#### Scenario: 合法的信任清單可以啟動

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS`，分別以 `FORWARDED_ALLOW_IPS=10.77.250.10`、`10.77.250.0/24`、`" 127.0.0.1 , ::1 "` 與 `127.0.0.1,10.0.0.0/8` 載入設定
- **THEN** 四次都載入成功，信任清單依序是 `["10.77.250.10"]`、`["10.77.250.0/24"]`、`["127.0.0.1", "::1"]`、`["127.0.0.1", "10.0.0.0/8"]`

### Requirement: 信任清單的錯誤訊息只指出變數名與原因

`FORWARDED_ALLOW_IPS` 驗證失敗時，錯誤訊息 MUST 指出 `FORWARDED_ALLOW_IPS` 這個名稱與原因，且 MUST NOT 印出設定值（含其中任何一項），比照 `CORS_ALLOWED_ORIGINS` 與 `DATABASE_URL`。

來源：issue #566；security-agent-rules S9；clarification Q12。

#### Scenario: 錯誤訊息含變數名且不含設定值

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `FORWARDED_ALLOW_IPS=CANARY-host.example` 啟動服務
- **THEN** 服務拒絕啟動，錯誤訊息含 `FORWARDED_ALLOW_IPS`，且不含 `CANARY-host.example`

#### Scenario: 含星號時以真實 uvicorn 啟動失敗並點名變數

- **WHEN** 以真實的 uvicorn 子行程設定 `FORWARDED_ALLOW_IPS=*` 啟動後端
- **THEN** 子行程以非零狀態結束，輸出含 `FORWARDED_ALLOW_IPS`，且沒有開始接受請求

## MODIFIED Requirements

### Requirement: 其餘設定都有預設值

系統 SHALL 在只設定合法的 `CORS_ALLOWED_ORIGINS` 時即可啟動：`CORS_ALLOW_CREDENTIALS` 預設為 true，`API_DOCS_ENABLED` 預設為 true，`DATABASE_URL` 可不設，`SQLITE_PATH` 預設為 `./data/label_suite.db`，`LOG_LEVEL` 預設為 `INFO`，`FORWARDED_ALLOW_IPS` 預設為 `127.0.0.1,::1`；SQLite 檔的父目錄不存在時 MUST 自動建立。`API_DOCS_ENABLED` 的值無法解析為布林時，服務 MUST 拒絕啟動、以非零狀態結束，錯誤訊息 MUST 指出 `API_DOCS_ENABLED` 這個名稱與原因，且 MUST NOT 印出設定值。`LOG_LEVEL` 只接受 `DEBUG`、`INFO`、`WARNING`、`ERROR`、`CRITICAL`（不分大小寫）；其他值 MUST 讓服務拒絕啟動、以非零狀態結束，錯誤訊息 MUST 指出 `LOG_LEVEL` 這個名稱與原因，且 MUST NOT 印出設定值。

來源：ADR-003 D7、backend-agent-rules B10、security-agent-rules S9、clarification Q1、issue #592、archive infra-compose-e2e-ci clarification Q13、issue #567、request-access-log clarification Q12、issue #566、trusted-proxy-client-ip clarification Q10、Q12。

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
