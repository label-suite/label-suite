# Proposal

## Why

維護者決定了重發設定密碼信的兩項規則：重發寄信失敗時整個重發回滾、原連結維持有效；重發成功寫入異動紀錄。`docs/specs/006-user-management.mdx` 已更新 FR-006d、FR-013、AC-4.9，並新增 AC-6.7，`user-management` capability 須同步。

## What Changes

- 修改「重發設定密碼信」：作廢、核發與寄信在同一作業完成，寄送失敗時回滾，原連結維持有效（FR-006d；AC-4.9）。
- 修改「每次帳號異動都寫入異動紀錄」：成功的重發也寫入一筆紀錄，失敗的重發不寫（FR-013；AC-6.7）。
- 本 change 不實作任何程式。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `user-management`：補上重發失敗的回滾規則與重發的異動紀錄。

## Impact

- 更新 `openspec/specs/user-management/spec.md`（archive 後產生）。
- 不影響程式、API 或相依套件。
