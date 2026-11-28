## MODIFIED Requirements

### Requirement: 輸出等級由 LOG_LEVEL 決定且資料庫相關紀錄維持 WARNING

系統 SHALL 以 `LOG_LEVEL` 決定後端所有紀錄（含伺服器程式自己的紀錄）的最低輸出等級；低於該等級的紀錄 MUST NOT 輸出。資料庫引擎、連線池與驅動的紀錄固定為 `WARNING`：不論 `LOG_LEVEL` 設為何值，它們低於 `WARNING` 的紀錄 MUST NOT 輸出，SQL 本文與 SQL 參數值 MUST NOT 出現在輸出中。對外 HTTP 客戶端與其底層連線套件的紀錄同樣固定為 `WARNING`，送出的請求標頭（含 `Authorization`）與請求本文 MUST NOT 出現在輸出中；API 與 worker 兩個行程都適用。

來源：issue #567 §功能範圍；security-agent-rules S9；ADR-008 D4；clarification Q12；email-celery-worker clarification Q5。

#### Scenario: LOG_LEVEL 設為 WARNING 時不輸出 INFO 紀錄

- **WHEN** 以 `LOG_LEVEL=WARNING` 啟動服務，呼叫端送出 `GET /api/v1/items/42`（`200`）與 `GET /api/v1/no-such-resource`（`404`）
- **THEN** 輸出沒有 `level=INFO` 的行，也沒有 `200` 那個請求的存取紀錄
- **AND** `404` 那個請求有一行 `level=WARNING` 的存取紀錄

#### Scenario: 資料庫引擎的紀錄維持 WARNING

- **WHEN** 以 Lite 層（SQLite）分別以未設 `LOG_LEVEL` 與 `LOG_LEVEL=DEBUG` 啟動服務，資料庫可以連線，呼叫端送出 `GET /api/v1/health`
- **THEN** 兩次的輸出都不含 `SELECT 1`，且不含任何 SQL 參數值
- **AND** 兩次的輸出都沒有資料庫引擎、連線池或驅動寫出的 `INFO` 或 `DEBUG` 紀錄

#### Scenario: LOG_LEVEL 為 DEBUG 時也不輸出 HTTP 客戶端的標頭

- **WHEN** 以 `LOG_LEVEL=DEBUG` 套用紀錄設定，程式以對外 HTTP 客戶端對替身送出一個帶 `Authorization: Bearer CANARY-key`、本文 `CANARY-body` 的請求
- **THEN** 輸出不含 `CANARY-key` 與 `CANARY-body`
- **AND** 輸出沒有對外 HTTP 客戶端或其底層連線套件寫出的 `INFO` 或 `DEBUG` 紀錄

## ADDED Requirements

### Requirement: worker 的紀錄與 API 用同一個格式

worker 行程啟動時 SHALL 以本專案的紀錄設定取代背景工作框架自己的紀錄設定：經這套設定安裝的 handler 輸出的每一筆紀錄，包括背景工作框架 `celery.*` logger 的紀錄，SHALL 依「紀錄輸出為一行 key=value 文字」的格式輸出，等級由 `LOG_LEVEL` 決定；不在請求內，`traceId` SHALL 為 `-`。紀錄帶例外資訊時 MUST 只寫例外型別。框架啟動時直接印到標準輸出的橫幅不是紀錄，不在此列。

來源：ADR-008 D4；security-agent-rules S9；主規格 `server-logging`「紀錄輸出為一行 key=value 文字」「每一筆伺服器紀錄自動帶追蹤編號」；email-celery-worker clarification Q5。

#### Scenario: worker 的紀錄為一行 key=value

- **WHEN** 以 `LOG_LEVEL=INFO` 觸發背景工作框架的紀錄設定訊號，之後分別由 `celery.worker` 與 `app.mail` 兩個 logger 各寫一筆 `INFO` 紀錄
- **THEN** 兩筆都只由本專案的 handler 輸出一次，每一行都符合 `^timestamp=\S+Z level=INFO logger=\S+ traceId=- .*msg=.*$`
- **AND** root logger 上沒有背景工作框架自己安裝的 handler

#### Scenario: worker 的例外紀錄只寫例外型別

- **WHEN** 觸發紀錄設定訊號後，`celery.worker` logger 附帶例外資訊寫一筆紀錄，例外為 `ValueError("CANARY-exc")`
- **THEN** 該筆紀錄恰好一行、含 `excType=builtins.ValueError`，輸出不含 `CANARY-exc` 與 `Traceback`
