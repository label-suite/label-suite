# API Contract

本次無 API 變更。

**理由**：本 change 只修 `e2e/account/session-guard.spec.ts` 兩個測試的攔截器與計數方式（見 `system-design.md` §測試端設計），不新增、修改或移除任何端點，不改 request／response 欄位、錯誤碼、權限或欄位遮蔽，也沒有 BREAKING 變更。`openapi.json` 與前端 client 都不受影響。

## 端點總覽

本次沒有新增或修改的端點。下列既有端點只是測試的對象，列出供追溯，**不是異動**：

| Method | Path                        | operationId            | 模組（tag） | 角色                     | 異動                                                                                           |
| :----- | :-------------------------- | :--------------------- | :---------- | :----------------------- | :--------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/current-session`   | `getCurrentSession`    | account     | 已登入者                 | 無（測試以 `page.route` 替換回應：401 `AUTH_REQUIRED`，其餘放行）                              |
| POST   | `/api/v1/session-refreshes` | `createSessionRefresh` | account     | 持有 refresh cookie 的人 | 無（測試替換回應：409 `ACCOUNT_REFRESH_CONFLICT`，其餘放行或回 401 `ACCOUNT_SESSION_INVALID`） |

被替換的錯誤碼：

| 錯誤碼                     | HTTP | 出處                     | 在測試中的用途                               |
| :------------------------- | :--- | :----------------------- | :------------------------------------------- |
| `AUTH_REQUIRED`            | 401  | `GET current-session`    | 觸發前端延續                                 |
| `ACCOUNT_REFRESH_CONFLICT` | 409  | `POST session-refreshes` | 模擬另一個分頁搶先延續                       |
| `ACCOUNT_SESSION_INVALID`  | 401  | `POST session-refreshes` | 「重試仍失敗就帶回登入頁」（本 change 不動） |

測試的替換回應沿用 `e2e/shared/api-stubs.ts` 的七欄位錯誤 envelope（`errorEnvelope`），與既有契約一致，不新增欄位。

## 常駐文件異動

本次無常駐文件異動
