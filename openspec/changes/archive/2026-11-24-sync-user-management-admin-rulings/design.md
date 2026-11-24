# Design

## Context

規格 06-01 於 PR #605 刪除「只有查看權限的系統管理員新增帳號」，理由是規格 06-02 §固定格不能改「系統管理員 × 所有系統管理類的鍵｜固定開啟」，維護者 2026-11-24 裁定 2。主規格 `user-management` 的對應 Requirement 還引用它。

## Goals / Non-Goals

**Goals:**

- 主規格不再引用 06-01 已不存在的 Scenario。
- 「來源：」逐字對得上 06-01 現行 Scenario 名稱。

**Non-Goals:**

- 不改 `docs/specs/`。
- 不改 Requirement 的規範文字，也不移除 `admin.user_management.manage` 這個鍵：06-01 §使用角色 仍以它界定異動權限。
- 不新增 Scenario。

## Decisions

- 不用 MODIFIED：OpenSpec 的 validate 與 archive 都拒絕丟掉主規格現有 Scenario 的 MODIFIED 區塊，移除與新增又不能同名。改成移除舊 Requirement、新增加上「才會被接受」後綴的新名稱，規範文字不變，只動「來源：」與 Scenario 清單。
- 保留 Scenario「被降級的系統管理員送出異動」，它在 06-01 §驗收標準 現行存在，足以覆蓋「權限變更後下一個請求依新設定判斷」。

## Risks / Trade-offs

- Requirement 仍寫「另具備 manage」，而對系統管理員這是固定開啟；文字不變是因為 06-01 仍保留這個權限鍵，若維護者之後裁定移除該鍵，需另開 change。
