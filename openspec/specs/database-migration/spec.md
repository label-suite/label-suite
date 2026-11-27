# database-migration Specification

## Purpose

確保資料庫結構遷移在 Lite 層（SQLite）與正式層（PostgreSQL）都能升級、降級、再升級，遷移與服務連到同一個資料庫，且約束名稱在兩種資料庫一致，作為之後每個模組建表的基礎。

## Requirements

### Requirement: 遷移在兩種資料庫上可升可降可再升

系統 SHALL 讓資料庫結構遷移在 SQLite 與 PostgreSQL 上都能完成「升到最新、降回起點、再升到最新」：遷移鏈從基準遷移開始，基準遷移 MUST NOT 建立任何業務資料表；升到最新後遷移版本紀錄恰好一筆、值為鏈上最新的版本；降回起點後 MUST 完全還原（只剩遷移版本紀錄為空，沒有任何業務資料表）。

來源：ADR-003 D7、backend-agent-rules B6、B7、testing-agent-rules T4、clarification Q8；login-auth-guard PL6。

#### Scenario: 資料庫遷移在兩種資料庫上可升可降

- **WHEN** 對一個空的 SQLite 測試資料庫與一個空的 PostgreSQL 測試資料庫，各依序執行升到最新、降回起點、再升到最新
- **THEN** 三個步驟在兩種資料庫上都成功
- **AND** 每次升到最新後，遷移版本紀錄恰好有一筆、值為鏈上最新的版本；降回起點後遷移版本紀錄為空，除了遷移版本紀錄表以外沒有其他資料表

#### Scenario: 基準遷移不建立業務資料表

- **WHEN** 對空的測試資料庫只升到基準遷移的版本
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

### Requirement: 帳號組的三張表在兩種資料庫上可升可降

基準遷移之後的帳號組遷移 SHALL 建立 `users`、`account_session`、`account_refresh_token` 三張表，在 SQLite 與 PostgreSQL 上產生相同的欄位、約束名稱與索引；降回基準遷移時 MUST 依相反順序刪除這三張表。遷移 MUST NOT 寫入任何帳號資料。

來源：規格 01-05 §資料欄位；login-auth-guard 決定表 N1、sa-4；主規格 `user-management`「Seeder 管理員只能由初始化指令建立」；ADR-003 D7；backend-agent-rules B6、B7；testing-agent-rules T4；`docs/diagrams/architecture/data-table-dictionary.mdx` §二 帳號組。

#### Scenario: 升到最新後有三張帳號表且沒有帳號

- **WHEN** 對空的 SQLite 與 PostgreSQL 測試資料庫各升到最新
- **THEN** 兩者都有 `users`、`account_session`、`account_refresh_token` 三張表，`users` 沒有任何列

#### Scenario: 兩種資料庫的約束名稱相同

- **WHEN** 升到最新後列出兩種資料庫上三張表的主鍵、唯一、檢查、外鍵約束與索引名稱
- **THEN** 兩邊的名稱集合完全相同

#### Scenario: 至多一位 Seeder 管理員

- **WHEN** 升到最新後，在兩種資料庫上各直接寫入兩筆 seeder 標記為真的帳號
- **THEN** 第二筆寫入在兩種資料庫上都因唯一限制失敗

#### Scenario: 降回基準遷移時刪除三張表

- **WHEN** 升到最新後降回基準遷移的版本
- **THEN** 兩種資料庫上都沒有 `users`、`account_session`、`account_refresh_token`

### Requirement: 系統管理組的兩張矩陣表在兩種資料庫上可升可降

帳號組之後的系統管理組遷移 SHALL 建立 `admin_role_permission` 與 `admin_role_permission_version` 兩張表，在 SQLite 與 PostgreSQL 上產生相同的欄位、約束名稱與索引，並寫入 62 列初始矩陣與一列矩陣版本；降回帳號組遷移時 MUST 依相反順序刪除這兩張表，帳號組的三張表與其中的資料不受影響。

來源：clarification Q2、P1；ADR-003 D7、D14；ADR-004 D6；backend-agent-rules B6、B7；testing-agent-rules T4；`docs/diagrams/architecture/data-table-dictionary.mdx` §三 `admin` 組；`system-design.md` §資料模型異動。

#### Scenario: 升到最新後有兩張矩陣表與初始矩陣

- **WHEN** 對空的 SQLite 與 PostgreSQL 測試資料庫各升到最新
- **THEN** 兩者都有 `admin_role_permission` 與 `admin_role_permission_version`，前者恰好 62 列，後者恰好一列、`version` 為 1

#### Scenario: 兩張矩陣表的約束名稱在兩種資料庫相同

- **WHEN** 升到最新後列出兩種資料庫上兩張矩陣表的主鍵、檢查約束與索引名稱
- **THEN** 兩邊的名稱集合完全相同，主鍵分別為 `pk_admin_role_permission` 與 `pk_admin_role_permission_version`

#### Scenario: 角色種類只能是系統或任務

- **WHEN** 升到最新後，在兩種資料庫上各直接寫入一列角色種類為 `global` 的矩陣格
- **THEN** 兩種資料庫都拒絕這次寫入

#### Scenario: 降回帳號組遷移時只刪兩張矩陣表

- **WHEN** 升到最新、寫入一個帳號後，降回帳號組遷移的版本
- **THEN** 兩種資料庫上都沒有 `admin_role_permission` 與 `admin_role_permission_version`，`users` 仍在且那個帳號仍在

#### Scenario: 降回後再升級得到同一份初始矩陣

- **WHEN** 降回帳號組遷移後再升到最新
- **THEN** 矩陣再次恰好 62 列、逐格與初始值相同，矩陣版本恰好一列、值為 1
