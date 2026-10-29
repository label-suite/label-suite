# Proposal

## Why

`docs/specs/006-user-management.mdx` 已依新骨架寫好，但 `openspec/specs/` 仍是空的，實作與測試沒有可驗證的契約可以對照。#17 要用 006 驗證「docs 寫產品、OpenSpec 寫可測契約」的兩層分工是否可行，因此先把 006 轉成第一個 capability。

## What Changes

- 新增 capability `user-management`，把 006 的 FR、卡控機制與 AC 轉寫為 `### Requirement:` 與 `#### Scenario:`，每條 requirement 註明來源的 FR／AC 編號。
- 只記錄可觀察的行為（權限、資料規則、錯誤條件、稽核），不寫版面、按鈕順序等畫面細節；畫面交給 prototype。
- 006「待釐清」的 006-Q1 至 006-Q4 尚未由維護者決定，本 change 不替它們寫 requirement：不含狀態篩選，也不規定新增或編輯表單能否直接設定停用。
- 本 change 不實作任何程式；`backend/`、`frontend/` 目前尚不存在。

## Capabilities

### New Capabilities

- `user-management`：系統管理員管理全平台帳號的契約，涵蓋存取權限、帳號列表查詢、新增與編輯、停用與啟用、Seeder 管理員與最後一位系統管理員的保護，以及帳號異動紀錄。

### Modified Capabilities

無。

## Impact

- 新增 `openspec/specs/user-management/spec.md`（archive 後產生）。
- 不影響程式、API 或相依套件；之後實作使用者管理時，測試以本 capability 的 scenario 為驗收依據。
- 006 若修訂 FR 或 AC，須另開 change 以 MODIFIED delta 同步本 capability。
