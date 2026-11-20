# Spec Delta

## Purpose

定義前端顯示日期時間的規則：伺服器回的 UTC 時間一律換算成台北時間（UTC+8）並以固定格式顯示，開發頁的檢查時間帶秒並標示時區，日期處理只集中在一處，讓時間顯示不受執行環境時區影響且可以測試。

## ADDED Requirements

### Requirement: 伺服器時間換算成台北時間顯示

前端顯示伺服器回的 ISO 8601 UTC 時間時 SHALL 換算為 UTC+8，與執行環境（瀏覽器或測試機）的時區無關。開發頁的檢查時間格式為 `YYYY-MM-DD HH:mm:ss（UTC+8）`（全形括號）；業務頁的格式 `YYYY-MM-DD HH:mm` 依 `brand.md`，不在本次範圍。

來源：frontend-agent-rules F10；`brand.md` §語言；clarification Q18。

#### Scenario: UTC 時間換算成台北時間

- **WHEN** 以開發頁格式顯示 `2026-11-20T08:15:30.123Z`
- **THEN** 顯示為 `2026-11-20 16:15:30（UTC+8）`

#### Scenario: 跨日的 UTC 時間換算到隔天

- **WHEN** 以開發頁格式顯示 `2026-11-20T17:30:00Z`
- **THEN** 顯示為 `2026-11-21 01:30:00（UTC+8）`

#### Scenario: 執行環境時區不影響顯示

- **WHEN** 執行環境的時區設為 `America/New_York`，以開發頁格式顯示 `2026-11-20T08:15:30.123Z`
- **THEN** 顯示仍為 `2026-11-20 16:15:30（UTC+8）`

### Requirement: 日期處理只在一處

前端的日期解析與格式化 SHALL 只集中在一個日期模組；其他檔案直接使用日期函式庫時 lint MUST 失敗。

來源：frontend-agent-rules F10；`system-design.md` §額外的 ESLint 規則。

#### Scenario: 功能直接匯入日期函式庫時 lint 失敗

- **WHEN** 功能目錄下的檔案直接 import 日期函式庫，執行 lint
- **THEN** lint 以非 0 結束碼失敗，訊息指出應改用日期模組
