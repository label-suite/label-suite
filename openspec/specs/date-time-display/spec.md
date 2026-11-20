# date-time-display Specification

## Purpose

定義前端顯示日期時間的規則：伺服器回的 UTC 時間點一律依瀏覽者裝置的時區顯示，不寫死任何時區；開發頁的檢查時間帶秒並標出該時間點在裝置時區的實際偏移；日期處理只集中在一處，讓時間顯示可以用指定的時區測試。

## Requirements

### Requirement: 伺服器時間點依裝置時區顯示

前端顯示伺服器回的 ISO 8601 UTC 時間點時 SHALL 換算到瀏覽者裝置的時區；前端 MUST NOT 把顯示時區寫死為任何固定時區（例如 `Asia/Taipei`）。同一個時間點在不同裝置時區的裝置上顯示不同的當地時間。業務頁的格式 `YYYY-MM-DD HH:mm` 依 `brand.md`，不在本次範圍。

來源：frontend-agent-rules F10；規格 07-01 §規格 語言切換 第 5 條；規格 06-01 Q2；clarification Q18 補充決議。

#### Scenario: 同一時間點在台北與紐約裝置顯示各自的當地時間

- **WHEN** 以開發頁格式顯示 `2026-11-20T08:15:30.123Z`，裝置時區分別為 `Asia/Taipei` 與 `America/New_York`
- **THEN** 台北裝置顯示 `2026-11-20 16:15:30（UTC+8）`
- **AND** 紐約裝置顯示 `2026-11-20 03:15:30（UTC-5）`

#### Scenario: 換算後跨日時日期跟著改變

- **WHEN** 裝置時區為 `Asia/Taipei`，以開發頁格式顯示 `2026-11-20T17:30:00Z`
- **THEN** 顯示為 `2026-11-21 01:30:00（UTC+8）`

#### Scenario: 未指定時區時採用裝置回報的時區

- **WHEN** 裝置回報的時區為 `America/New_York`，以開發頁格式顯示 `2026-11-20T08:15:30.123Z`，呼叫端沒有另外指定時區
- **THEN** 顯示為 `2026-11-20 03:15:30（UTC-5）`

### Requirement: 開發頁檢查時間標出實際偏移

開發頁的檢查時間 SHALL 以 `YYYY-MM-DD HH:mm:ss（UTC±H）` 顯示（全形括號）：括號內是該時間點在裝置時區的實際 UTC 偏移，正偏移帶 `+`、負偏移帶 `-`、零偏移為 `UTC+0`；偏移不是整點時以 `UTC±H:mm` 表示。偏移依時間點計算，同一時區在日光節約時間前後顯示不同的偏移。

來源：clarification Q18 與其補充決議；畫面 artifact 第 4 版 Main.dc.html §2 正常（200）。

#### Scenario: 日光節約時間期間顯示當時的偏移

- **WHEN** 裝置時區為 `America/New_York`，以開發頁格式顯示 `2026-07-01T12:00:00Z`
- **THEN** 顯示為 `2026-07-01 08:00:00（UTC-4）`

#### Scenario: 零偏移的時區

- **WHEN** 裝置時區為 `UTC`，以開發頁格式顯示 `2026-11-20T08:15:30.123Z`
- **THEN** 顯示為 `2026-11-20 08:15:30（UTC+0）`

#### Scenario: 偏移不是整點的時區

- **WHEN** 裝置時區為 `Asia/Kolkata`，以開發頁格式顯示 `2026-11-20T08:15:30.123Z`
- **THEN** 顯示為 `2026-11-20 13:45:30（UTC+5:30）`

### Requirement: 日期處理只在一處

前端的日期解析與格式化 SHALL 只集中在一個日期模組；其他檔案直接使用日期函式庫時 lint MUST 失敗。

來源：frontend-agent-rules F10；`system-design.md` §額外的 ESLint 規則。

#### Scenario: 功能直接匯入日期函式庫時 lint 失敗

- **WHEN** 功能目錄下的檔案直接 import 日期函式庫，執行 lint
- **THEN** lint 以非 0 結束碼失敗，訊息指出應改用日期模組
