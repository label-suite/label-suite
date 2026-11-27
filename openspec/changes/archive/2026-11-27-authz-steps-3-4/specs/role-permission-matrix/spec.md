# Spec Delta

## Purpose

定義權限矩陣這份資料本身的規則：白名單上的 24 個權限鍵與它們的層級、啟用狀態與識別名稱，62 個適用格與錯層不存，固定格的永久值，每一格的初始值與矩陣版本，讓授權判斷與日後的角色設定頁讀到的是同一份、可回歸比對的矩陣。

## ADDED Requirements

### Requirement: 白名單恰好有 24 個權限鍵

權限鍵的白名單 SHALL 恰好有 24 個鍵：平台層 10 個、任務層 14 個，每一個有固定的識別名稱、層級與所屬段落；白名單外的鍵不是權限鍵。既有的 `admin.user_management.view`、`admin.user_management.manage`、`task.detail.edit`、`task.members.manage`、`task.delete` 沿用原名。

來源：規格 06-02 §權限鍵與它們對應的 PRD 格 第 1–11 條；`docs/specs/glossary.mdx` §權限矩陣；clarification P2。

#### Scenario: 白名單的鍵與層級

- **WHEN** 列出白名單的全部鍵與它們的層級
- **THEN** 平台層恰好是 `account.profile.view`、`account.profile.edit`、`dashboard.view`、`task.list.view`、`task.create`、`admin.user_management.view`、`admin.user_management.manage`、`admin.role_settings.view`、`admin.role_settings.manage`、`admin.platform_overview.view`
- **AND** 任務層恰好是 `task.detail.view`、`task.detail.edit`、`task.members.manage`、`task.lifecycle.manage`、`task.delete`、`annotation.annotate`、`annotation.review`、`annotation.exception.resolve`、`annotation.dispute.adjudicate`、`dataset.stats.view`、`dataset.quality.view`、`dataset.export`、`dataset.ingestion.view`、`dataset.ingestion.create`

#### Scenario: 五個鍵已登錄、待啟用

- **WHEN** 列出白名單中尚未啟用的鍵
- **THEN** 恰好是 `admin.platform_overview.view`、`task.lifecycle.manage`、`task.delete`、`annotation.exception.resolve`、`annotation.dispute.adjudicate`，其餘 19 個已啟用

### Requirement: 適用格 62 個，錯層的格不存在

矩陣 SHALL 只存適用格：10 個平台層鍵 × 平台成員、系統管理員兩個系統角色，加上 14 個任務層鍵 × 專案負責人、審核員、標記員三個任務角色，共 62 格；錯層的格 MUST NOT 有任何資料列。每一格的值只有開或關。待啟用的鍵也有它們全部的適用格。

本 capability 與 06-02 同名的 Scenario 只驗儲存與資料這一側；畫面上的呈現（徽章、清點、分段）屬角色設定頁（#729）。

來源：規格 06-02 §適用格，錯層的不存 第 1–7 條、§五個已登錄、待啟用的鍵 第 5 條；資料表字典 §`admin`「角色權限矩陣」。

#### Scenario: 適用格的總數

- **WHEN** 資料庫升到最新後清點矩陣的資料列
- **THEN** 恰好 62 列：平台層 20 列、任務層 42 列，每一列的值都是開或關

#### Scenario: 錯層的格不儲存

- **WHEN** 資料庫升到最新後查詢系統角色 × 任務層鍵，以及任務角色 × 平台層鍵的資料列
- **THEN** 兩者都沒有任何資料列

#### Scenario: 待啟用的鍵仍有適用列

- **WHEN** 資料庫升到最新後查詢五個待啟用鍵的資料列
- **THEN** `admin.platform_overview.view` 有 2 列，其餘四個任務層鍵各有 3 列，共 14 列，都算在 62 格內

### Requirement: 初始矩陣照預設矩陣逐格建立

資料庫升到最新後，矩陣 SHALL 逐格等於規格 06-02 §預設矩陣 的初始值，矩陣版本恰好一列、值為 1。初始矩陣隨資料庫升級建立，部署者不需另外執行任何指令；這份初始值也是授權判斷的回歸測試基準。

來源：規格 06-02 §預設矩陣：每一格的初始值 第 1–8 條、§五個已登錄、待啟用的鍵 第 6、7 條；issue #755；#753 D1；clarification Q2、P1。

#### Scenario: 預設矩陣的平台層初始值

- **WHEN** 資料庫升到最新後讀平台層 10 個鍵對兩個系統角色的格
- **THEN** `account.profile.view`、`account.profile.edit`、`dashboard.view`、`task.list.view`、`task.create` 兩個角色都開
- **AND** `admin.user_management.view`、`admin.user_management.manage`、`admin.role_settings.view`、`admin.role_settings.manage`、`admin.platform_overview.view` 平台成員關、系統管理員開

#### Scenario: 預設矩陣的任務層初始值

- **WHEN** 資料庫升到最新後讀任務層 14 個鍵對三個任務角色的格（依序為專案負責人、審核員、標記員）
- **THEN** `task.detail.view` 為開、開、關；`task.detail.edit`、`task.members.manage`、`dataset.export`、`dataset.ingestion.create` 為開、關、關；`annotation.annotate` 為關、關、開；`annotation.review` 為關、開、關；`dataset.stats.view`、`dataset.quality.view`、`dataset.ingestion.view` 為開、開、關

#### Scenario: 待啟用任務層鍵的種子值

- **WHEN** 資料庫升到最新後讀 `task.lifecycle.manage`、`task.delete`、`annotation.exception.resolve`、`annotation.dispute.adjudicate` 的格
- **THEN** 四個鍵都是專案負責人開、審核員關、標記員關

#### Scenario: 升級後的矩陣與白名單的初始值逐格相同

- **WHEN** 資料庫升到最新後，把 62 列與白名單記載的 62 個適用格與初始值逐格比對
- **THEN** 兩邊的格集合相同、每一格的值相同，矩陣版本恰好一列、值為 1

### Requirement: 固定格不能被改成別的值

系統管理員 × 五個系統管理類鍵 SHALL 永遠為開、平台成員 × 五個系統管理類鍵永遠為關、兩種系統角色 × `dashboard.view` 永遠為開；任何寫入把固定格改成別的值時，SQLite 與 PostgreSQL MUST 都在資料庫層拒絕，繞過應用直接寫入也一樣。

來源：規格 06-02 §固定格不能改 第 1–5 條、§已確認決議 Q6、Q13；PRD §權限矩陣「06 系統管理」兩列；clarification P3。

#### Scenario: 平台成員的系統管理類格寫不成開

- **WHEN** 在兩種資料庫上直接把平台成員 × `admin.role_settings.manage` 的格更新為開
- **THEN** 兩種資料庫都拒絕這次寫入，該格仍為關

#### Scenario: 系統管理員的系統管理類格寫不成關

- **WHEN** 在兩種資料庫上直接把系統管理員 × `admin.user_management.manage` 的格更新為關
- **THEN** 兩種資料庫都拒絕這次寫入，該格仍為開

#### Scenario: 檢視儀表板的格寫不成關

- **WHEN** 在兩種資料庫上直接把平台成員 × `dashboard.view` 的格更新為關
- **THEN** 兩種資料庫都拒絕這次寫入，該格仍為開

#### Scenario: 非固定格可以改

- **WHEN** 在兩種資料庫上直接把平台成員 × `task.create` 的格更新為關
- **THEN** 寫入成功

### Requirement: 矩陣版本只有一列

矩陣版本 SHALL 至多一列，版本值 MUST 為大於或等於 1 的整數；在兩種資料庫上寫入第二列版本或小於 1 的版本值都 MUST 被資料庫拒絕。

來源：資料表字典 §`admin`「矩陣版本號」；ADR-004 D6「矩陣版本列不存在一律拒絕」；規格 06-02 §儲存用樂觀鎖。

#### Scenario: 寫不進第二列版本

- **WHEN** 資料庫升到最新後，在兩種資料庫上直接再寫入一列矩陣版本
- **THEN** 兩種資料庫都拒絕這次寫入

#### Scenario: 版本值不能小於 1

- **WHEN** 在兩種資料庫上直接把矩陣版本更新為 0
- **THEN** 兩種資料庫都拒絕這次寫入，版本仍為 1
