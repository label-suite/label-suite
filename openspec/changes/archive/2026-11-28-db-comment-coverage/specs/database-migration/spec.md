# Spec Delta

## ADDED Requirements

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
