## ADDED Requirements

### Requirement: 對外 HTTP 客戶端的紀錄維持 WARNING

對外 HTTP 客戶端與其底層連線套件的紀錄 SHALL 固定為 `WARNING`：不論 `LOG_LEVEL` 設為何值，它們低於 `WARNING` 的紀錄 MUST NOT 輸出，送出的請求標頭（含 `Authorization`）與請求本文 MUST NOT 出現在輸出中。API 與 worker 兩個行程都適用。

來源：security-agent-rules S9；ADR-008 D3、D4；email-celery-worker clarification Q5。

#### Scenario: LOG_LEVEL 為 DEBUG 時也不輸出 HTTP 客戶端的標頭

- **WHEN** 以 `LOG_LEVEL=DEBUG` 啟動，程式以對外 HTTP 客戶端對替身送出一個帶 `Authorization: Bearer CANARY-key`、本文 `CANARY-body` 的請求
- **THEN** 輸出不含 `CANARY-key` 與 `CANARY-body`
- **AND** 輸出沒有對外 HTTP 客戶端或其底層連線套件寫出的 `INFO` 或 `DEBUG` 紀錄

### Requirement: worker 的紀錄與 API 用同一個格式

worker 行程寫出的每一筆紀錄，包括背景工作框架自己的紀錄，SHALL 依「紀錄輸出為一行 key=value 文字」的格式輸出，輸出等級 SHALL 由 `LOG_LEVEL` 決定；不在請求內，`traceId` SHALL 為固定標記 `-`。紀錄帶例外資訊時 MUST 只寫例外型別，MUST NOT 寫例外訊息與多行堆疊。背景工作框架會把例外的文字寫進訊息本身，所以會進入 worker 的例外 MUST NOT 帶敏感文字（寄信的部分見主規格 `mail-delivery`）。

來源：ADR-008 D4；security-agent-rules S9；主規格 `server-logging`「紀錄輸出為一行 key=value 文字」「每一筆伺服器紀錄自動帶追蹤編號」；email-celery-worker clarification Q5。

#### Scenario: worker 的紀錄為一行 key=value

- **WHEN** worker 行程以 `LOG_LEVEL=INFO` 啟動並執行一個寄出成功的寄信工作
- **THEN** 該行程的每一行輸出都符合 `^timestamp=\S+Z level=[A-Z]+ logger=\S+ traceId=- .*msg=.*$`

#### Scenario: worker 的例外紀錄只寫例外型別

- **WHEN** worker 行程中一個 logger 附帶例外資訊寫一筆紀錄，例外為 `ValueError("CANARY-exc")`
- **THEN** 該筆紀錄恰好一行、含 `excType=builtins.ValueError`，輸出不含 `CANARY-exc` 與 `Traceback`
