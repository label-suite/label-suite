## REMOVED Requirements

### Requirement: 異動帳號須另具備管理權限

**Reason**: 這條 Requirement 附帶的 Scenario「只有查看權限的系統管理員新增帳號」已從規格 06-01 刪除（PR #605，維護者 2026-11-24 裁定 2：兩項權限對系統管理員固定開啟，這種狀態不會出現）。OpenSpec 不允許 MODIFIED 區塊丟掉主規格現有的 Scenario，而移除與新增又不能用同一個名稱，所以移除後以「異動帳號須另具備管理權限才會被接受」重新加入，規範文字不變，只少一個 Scenario。

**Migration**: 見同一份 delta 的新增區塊「異動帳號須另具備管理權限才會被接受」。

## ADDED Requirements

### Requirement: 異動帳號須另具備管理權限才會被接受

系統 SHALL 只在請求者通過讀取的條件、且另具備 `admin.user_management.manage` 時，接受新增、編輯、停用、啟用與系統角色變更。權限變更後，下一個請求 MUST 依新設定判斷。

來源：06-01 被降級的系統管理員送出異動。

#### Scenario: 被降級的系統管理員送出異動

- **WHEN** 系統管理員 A 已被降為平台成員，A 以仍有效的憑證送出任一異動請求
- **THEN** 系統回覆 403，帳號資料沒有變動
