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

### Requirement: 每張資料表與每個欄位都有非空說明

系統 SHALL 要求共用資料模型內每一張資料表與每一個欄位都有非空的說明；純關聯表一律適用，MUST NOT 有豁免。說明為缺漏、或去除頭尾空白後為空，都視為缺漏。此檢查與資料庫無關，在 SQLite 與 PostgreSQL 兩輪測試都 MUST 執行。只檢查非空，不檢查說明是否為英文。

來源：`.claude/agents/dba.md` 資料模型準則、clarification Q2、Q3。

#### Scenario: 所有表與欄位都有說明時通過

- **WHEN** 載入所有模組的資料模型後，檢查共用 metadata 內每張表與每個欄位的說明
- **THEN** 沒有任何缺漏，檢查通過
- **AND** 在 SQLite 回合與 PostgreSQL 回合結果相同

#### Scenario: 缺少欄位說明時失敗並指名該欄位

- **WHEN** 某張表的某個欄位沒有說明，或說明只有空白
- **THEN** 檢查失敗
- **AND** 失敗訊息逐條列出缺漏的 `<table>.<column>` 與原因，同時缺漏多處時一次全部列出

#### Scenario: 缺少表說明時失敗並指名該表

- **WHEN** 某張表本身沒有說明，或說明只有空白
- **THEN** 檢查失敗，失敗訊息列出該 `<table>` 與原因

#### Scenario: 純關聯表同樣被要求

- **WHEN** 一張只含外鍵欄位的多對多中介表缺少表說明或欄位說明
- **THEN** 檢查失敗，與一般資料表相同，沒有任何豁免清單可讓它通過

#### Scenario: 英文以外的非空說明不被此檢查擋下

- **WHEN** 某個欄位的說明非空但不是英文
- **THEN** 此檢查不因語言而失敗

### Requirement: 檢查不得因資料模型未載入而空洞通過

系統 SHALL 在判定說明覆蓋前先確認資料模型已完整載入，載入不完整時 MUST 失敗而不得通過。完整的判準有兩項：資料表集合涵蓋已落地的底線（`users`、`account_session`、`account_refresh_token`、`admin_role_permission`、`admin_role_permission_version`）；每個有資料模型檔的模組都至少登錄一個資料模型類別。

來源：ADR-003 D7、testing-agent-rules T4、clarification 技術預設（model 匯入）。

#### Scenario: 資料表集合為空時失敗

- **WHEN** 載入後共用 metadata 內沒有任何資料表
- **THEN** 檢查失敗，訊息指出資料模型載入失敗、沒有檢查任何東西

#### Scenario: 資料表集合缺少已落地的表時失敗

- **WHEN** 載入後的資料表集合缺少底線 5 張表中的任何一張
- **THEN** 檢查失敗，訊息列出缺少的表名

#### Scenario: 有資料模型檔的模組沒有登錄任何資料模型時失敗

- **WHEN** 某個模組存在資料模型檔，但載入後共用 metadata 沒有任何屬於該模組的資料模型類別
- **THEN** 檢查失敗，訊息指出該模組名稱

#### Scenario: 新增資料表不必修改檢查

- **WHEN** 某模組新增一張有完整說明的資料表
- **THEN** 檢查通過，不需要更動檢查的任何設定或清單

### Requirement: PostgreSQL 實際儲存的說明與資料模型完全一致

系統 SHALL 讓遷移升到最新後，PostgreSQL 內每張資料表與每個欄位實際儲存的說明都非空，且與資料模型的說明字串**完全相等**（不容許頭尾空白差異）。待檢查的表清單 MUST 只由資料模型推出，不得列舉資料庫內的表，因此遷移版本紀錄表與其他非資料模型的表不被檢查。此檢查只讀資料庫的系統目錄，不得改動資料或 schema。

來源：ADR-003 D7、backend-agent-rules B6、B7、testing-agent-rules T4、clarification Q1。

#### Scenario: 遷移後資料庫說明與資料模型一致時通過

- **WHEN** 對空的 PostgreSQL 測試資料庫升到最新後，讀取每張資料模型內的表與欄位的實際說明
- **THEN** 每個說明都非空，且與資料模型的說明字串完全相等，檢查通過

#### Scenario: 資料庫的說明缺漏時失敗

- **WHEN** 資料庫中某個欄位沒有說明，而資料模型有說明
- **THEN** 檢查失敗，訊息列出該 `<table>.<column>`，原因指出資料庫缺少該欄位說明

#### Scenario: 資料庫的說明與資料模型不同時失敗

- **WHEN** 資料庫中某張表或某個欄位的說明與資料模型的說明字串不相等，包含只差頭尾空白
- **THEN** 檢查失敗，訊息列出該表或 `<table>.<column>`，並同時顯示資料模型與資料庫兩邊的內容

#### Scenario: 表或欄位不在資料庫時失敗

- **WHEN** 資料模型內有某張表，或某個欄位，而遷移升到最新後資料庫沒有它
- **THEN** 檢查失敗，訊息列出該表或 `<table>.<column>`，原因指出資料庫沒有它

#### Scenario: 遷移版本紀錄表不被檢查

- **WHEN** 遷移升到最新後資料庫內有遷移版本紀錄表，它沒有說明且不在資料模型內
- **THEN** 此檢查不因它而失敗

### Requirement: 說明覆蓋的失敗訊息逐條指名並說明原因

系統 SHALL 在說明覆蓋的檢查（資料模型層與 PostgreSQL 層）失敗時，一次列出全部違規，每條一行，格式為 `<table>` 或 `<table>.<column>` 加上原因。違規為零時 MUST 通過。

來源：clarification 技術預設（失敗訊息格式）；issue #822 範圍 1。

#### Scenario: 失敗訊息一次列出全部違規

- **WHEN** 同時有兩個欄位缺少說明、一張表的資料庫說明與資料模型不同
- **THEN** 失敗訊息含三條違規，各占一行，各自以 `<table>.<column>` 或 `<table>` 開頭並附原因

#### Scenario: 檢查邏輯本身可被樣本證明會失敗

- **WHEN** 以一份獨立的樣本資料模型（不登錄進共用 metadata）故意拿掉一個欄位的說明，並對同一欄位構造與資料庫不同的說明
- **THEN** 兩種比對都回報該 `<table>.<column>`
- **AND** 此樣本檢查在 SQLite 回合也會執行，不需要 PostgreSQL

### Requirement: PostgreSQL 層在 SQLite 回合略過、在 PostgreSQL 回合必須執行

系統 SHALL 讓 PostgreSQL 層的說明檢查在未設定 `TEST_DATABASE_URL` 的回合（`backend-sqlite`）被略過且不連資料庫，並在設定了的回合（`backend-postgres`）實際執行。`backend-postgres` 回合 MUST NOT 有任何被略過的測試，被略過即讓該回合失敗。

來源：backend-agent-rules B7、testing-agent-rules T4、T9、ADR-003 D7、clarification 技術預設（`postgres` 標記）。

#### Scenario: SQLite 回合略過 PostgreSQL 層

- **WHEN** 未設定 `TEST_DATABASE_URL`，執行後端測試
- **THEN** PostgreSQL 層的說明檢查被略過，不建立資料庫連線，測試回合不因它失敗
- **AND** 資料模型層的說明檢查仍然執行並通過

#### Scenario: PostgreSQL 回合執行 PostgreSQL 層

- **WHEN** 已設定 `TEST_DATABASE_URL` 指向 PostgreSQL，執行後端測試
- **THEN** PostgreSQL 層的說明檢查實際執行並通過
- **AND** 該回合被略過的測試數為 0

#### Scenario: 既有的略過檢查涵蓋 PostgreSQL 層的新測試

- **WHEN** `backend-postgres` 回合有任何測試被略過，包含 PostgreSQL 層的說明檢查
- **THEN** 該回合既有的略過檢查失敗（本 change 依賴此既有保證，不新增機制）
