# Proposal

## Why

維護者 2026-11-24 裁定 2「刪掉不可能的條文」，已由 PR #605 同步到規格 06-01：兩項系統管理權限對系統管理員固定開啟（規格 06-02 §固定格不能改），「只有查看權限的系統管理員」不會出現，所以 Scenario「只有查看權限的系統管理員新增帳號」已從 06-01 刪除。`openspec/specs/user-management/spec.md` 的 Requirement「異動帳號須另具備管理權限」仍把它列為來源並保留同名 Scenario，造成主規格引用一個不存在的 Scenario，也留著一個永遠無法成立的測試契約。

## What Changes

- 刪除 Scenario「只有查看權限的系統管理員新增帳號」。
- Requirement「異動帳號須另具備管理權限」改名為「異動帳號須另具備管理權限才會被接受」（OpenSpec 不允許 MODIFIED 丟掉主規格現有的 Scenario，移除與新增又不能同名，所以改名後移除舊的、加入新的）；「來源：」只列 06-01 現行存在的 Scenario「被降級的系統管理員送出異動」。
- Requirement 的規範文字不變：06-01 §使用角色 仍寫「C、E 另需要『新增／編輯／停用使用者、指派系統角色』權限」，`manage` 這個鍵仍在。
- 其他 `openspec/specs/` 主規格已逐一檢查，沒有其他地方引用 06-01、06-02 已刪的 Scenario（「只有查看權限的系統管理員新增帳號」「沒有編輯權限時按不了編輯」「系統管理員看到可編輯的矩陣」「沒有權限讀不到矩陣資料」）。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `user-management`: Requirement「異動帳號須另具備管理權限」換成「異動帳號須另具備管理權限才會被接受」，拿掉不可能的 Scenario 並更新來源。

## Impact

只改 `openspec/specs/user-management/spec.md`（經 spec delta 同步）。不涉及程式碼、API、`docs/specs/`；`backend/` 與 `frontend/` 尚不存在。相關 issue：#551。
