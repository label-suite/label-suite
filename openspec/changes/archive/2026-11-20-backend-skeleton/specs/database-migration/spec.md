# Spec Delta

## Purpose

確保資料庫結構遷移在 Lite 層（SQLite）與正式層（PostgreSQL）都能升級、降級、再升級，遷移與服務連到同一個資料庫，且約束名稱在兩種資料庫一致，作為之後每個模組建表的基礎。

## ADDED Requirements

### Requirement: 遷移在兩種資料庫上可升可降可再升

系統 SHALL 提供一條基準遷移，讓資料庫結構遷移在 SQLite 與 PostgreSQL 上都能完成「升到最新、降回起點、再升到最新」；基準遷移 MUST NOT 建立任何業務資料表，降回起點後 MUST 完全還原（只剩遷移版本紀錄為空）。

來源：ADR-003 D7、backend-agent-rules B6、B7、testing-agent-rules T4、clarification Q8。

#### Scenario: 資料庫遷移在兩種資料庫上可升可降

- **WHEN** 對一個空的 SQLite 測試資料庫與一個空的 PostgreSQL 測試資料庫，各依序執行升到最新、降回起點、再升到最新
- **THEN** 三個步驟在兩種資料庫上都成功
- **AND** 每次升到最新後，遷移版本紀錄恰好有一筆、值為基準遷移的版本；降回起點後遷移版本紀錄為空

#### Scenario: 基準遷移不建立業務資料表

- **WHEN** 對空的測試資料庫升到最新
- **THEN** 資料庫中除了遷移版本紀錄表以外沒有其他資料表

### Requirement: 遷移與服務使用同一份資料庫設定

系統 SHALL 讓資料庫結構遷移依服務相同的設定決定連到哪個資料庫：沒設 `DATABASE_URL` 時遷移 `SQLITE_PATH` 指向的 SQLite 檔，設了時遷移該 PostgreSQL；遷移 MUST NOT 另外要求一組連線設定，也 MUST NOT 要求與資料庫無關的設定（例 `CORS_ALLOWED_ORIGINS`）。

來源：backend-agent-rules B10、ADR-003 D7。

#### Scenario: 遷移連到與服務相同的資料庫

- **WHEN** 只設定 `SQLITE_PATH=<暫存目錄>/m.db`、不設 `DATABASE_URL`，也不設 `CORS_ALLOWED_ORIGINS`，執行升到最新
- **THEN** `<暫存目錄>/m.db` 被建立，且含遷移版本紀錄表

### Requirement: 約束名稱在兩種資料庫一致

系統 SHALL 依固定規則為資料表的主鍵、唯一、檢查、外鍵與索引約束命名，讓同一份遷移在 SQLite 與 PostgreSQL 產生相同的約束名稱，之後的遷移才能在 SQLite 重建表時找到要修改的約束。主鍵 MUST 為 `pk_<表名>`、唯一約束 MUST 為 `uq_<表名>_<欄名>`、外鍵 MUST 為 `fk_<表名>_<欄名>_<被參照表名>`。

來源：backend-agent-rules B6、ADR-003 D7。

#### Scenario: 約束名稱依固定規則產生

- **WHEN** 一個名為 `sample` 的資料表有主鍵 `id`、在 `code` 欄位上有未指定名稱的唯一約束、`owner_id` 欄位參照 `owner` 表
- **THEN** 產生的約束名稱分別為 `pk_sample`、`uq_sample_code`、`fk_sample_owner_id_owner`，在 SQLite 與 PostgreSQL 上相同
