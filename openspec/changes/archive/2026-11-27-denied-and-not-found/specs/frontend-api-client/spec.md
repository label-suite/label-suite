# Spec Delta

## ADDED Requirements

### Requirement: 拒絕回應分成無權限、找不到與其他

拒絕回應的分類 SHALL 只讀單一錯誤的 `kind`、`status` 與 `code`：`kind` 為 `http`、`status` 為 `403` 且 `code` 為 `PERMISSION_DENIED` 時是無權限；`kind` 為 `http`、`status` 為 `404` 且 `code` 為 `NOT_FOUND` 時是找不到；其餘一律是其他，包括 `403 CSRF_FAILED`、`401`、`5xx`、連線失敗、逾時、取消與非外層回應。分類 MUST NOT 決定是否畫成整頁或去處，也不送出任何請求；不是單一錯誤型別的值同樣是其他。

來源：規格 07-03 §兩種畫面的分工 第 1～4 條、§不在本頁範圍 第 3、4 條；`api-contract.md` §為什麼要看 `code`，不能只看 status；api-agent-rules A7；frontend-agent-rules F8；denied-and-not-found clarification Q4。

#### Scenario: 403 PERMISSION_DENIED 分類為無權限

- **WHEN** 分類 `{kind: "http", status: 403, code: "PERMISSION_DENIED"}` 的單一錯誤
- **THEN** 結果是無權限

#### Scenario: 404 NOT_FOUND 分類為找不到

- **WHEN** 分類 `{kind: "http", status: 404, code: "NOT_FOUND"}` 的單一錯誤
- **THEN** 結果是找不到

#### Scenario: CSRF 失敗不算無權限

- **WHEN** 分類 `{kind: "http", status: 403, code: "CSRF_FAILED"}` 的單一錯誤
- **THEN** 結果是其他

#### Scenario: 其他錯誤都分類為其他

- **WHEN** 分別分類 `401 AUTH_REQUIRED`、`500 INTERNAL_ERROR`、`503 DATABASE_UNAVAILABLE` 的 `http` 錯誤，`kind` 為 `network`、`timeout`、`aborted` 的錯誤，`kind` 為 `invalidResponse`、`status` 為 `414`、`code` 為 `null` 的錯誤，以及一個不是單一錯誤型別的值
- **THEN** 每一個結果都是其他

#### Scenario: 狀態碼與錯誤碼不一致時是其他

- **WHEN** 分別分類 `{kind: "http", status: 404, code: "PERMISSION_DENIED"}` 與 `{kind: "http", status: 403, code: "NOT_FOUND"}` 的單一錯誤
- **THEN** 兩個結果都是其他
