# Tasks

## 1. 同步主規格

- [x] 1.1 逐字確認 06-01 現行存在「被降級的系統管理員送出異動」，且不再有「只有查看權限的系統管理員新增帳號」
- [x] 1.2 全面檢查 `openspec/specs/` 是否引用 06-01、06-02 其他已刪 Scenario
- [x] 1.3 寫 `specs/user-management/spec.md` 的 delta（移除舊 Requirement、新增改名後的 Requirement）

## 2. 驗證與歸檔

- [x] 2.1 `openspec validate sync-user-management-admin-rulings --strict` 通過
- [x] 2.2 歸檔，主規格同步
- [x] 2.3 `node scripts/check-specs.mjs docs` 與 `node scripts/check-citations.mjs --strict` 通過
