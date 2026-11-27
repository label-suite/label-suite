# Spec Delta

## ADDED Requirements

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
