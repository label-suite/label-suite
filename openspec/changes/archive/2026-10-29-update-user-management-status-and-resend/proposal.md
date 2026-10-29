# Proposal

## Why

維護者已回覆 006-Q1 至 006-Q4，`docs/specs/006-user-management.mdx` 新增了 FR-005c、FR-006d、FR-007a 與 AC-3.8、AC-4.7 至 AC-4.10。`user-management` capability 建立時刻意略過這幾題，現在須補上，讓契約與 006 一致。

## What Changes

- 新增「依帳號狀態篩選」：列表可依全部、啟用、停用篩選（FR-005c）。
- 修改「列表分頁並保留查詢條件」：明列換頁時保留的條件包含帳號狀態篩選（FR-005a、FR-005c）。
- 新增「重發設定密碼信」：只有尚未設定密碼的帳號提供重發，重發作廢原連結，寄送失敗時顯示錯誤（FR-006d）。
- 新增「新增與編輯表單不提供帳號狀態」：新帳號一律為啟用，狀態只能經由停用與啟用操作變更（FR-007a）。
- 本 change 不實作任何程式。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `user-management`：補上帳號狀態篩選、重發設定密碼信，以及表單不提供帳號狀態欄的規則。

## Impact

- 更新 `openspec/specs/user-management/spec.md`（archive 後產生）。
- 不影響程式、API 或相依套件。
