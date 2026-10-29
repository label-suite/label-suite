# Tasks

## 1. 契約與 docs 對齊

- [x] 1.1 確認 006 每個 FR、SC、AC 編號都出現在 `specs/user-management/spec.md` 的「來源」行，以逐一比對編號的指令驗證沒有遺漏
- [x] 1.2 確認 delta 沒有替 006-Q1 至 006-Q4 決定行為：搜尋 delta 不含狀態篩選與表單直接設定停用的 requirement
- [x] 1.3 執行 `npx openspec validate add-user-management-capability --strict`，驗證輸出為 valid

## Workflow follow-up

- 維護者審閱後，archive 本 change，產生 `openspec/specs/user-management/spec.md`。
- 以 `npx openspec validate --specs --strict` 驗證 archive 後的主 spec。
- 006-Q1 至 006-Q4 有結論後，另開 change 以 ADDED 或 MODIFIED delta 補進本 capability。
