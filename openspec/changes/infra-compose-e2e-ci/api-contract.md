# API Contract

本次無 API 變更。

不新增、不修改、不移除任何端點，`backend/openapi.json` 與 `frontend/src/api/generated/` 的內容都不動；BREAKING 無，角色、遮蔽欄位與測試集答案隔離皆為「無」。依據是 `system-design.md` D5：容器健康檢查沿用既有的 `GET /api/v1/health`（`getHealth`，契約見 `openspec/changes/archive/2026-11-20-backend-skeleton/api-contract.md` §getHealth），不拆出不碰資料庫的存活端點。若維護者在待決 #15 決定拆端點，本文要回修，新增那一個端點的完整契約。

## 本次只消費、不改動的契約

| Method | Path             | operationId | 誰呼叫                                                                                       |
| :----- | :--------------- | :---------- | :------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/health` | `getHealth` | 兩份編排檔的 backend 容器健康檢查、`compose` job、e2e 旅程（`system-design.md` D5、D7、D8b） |

## 契約漂移檢查比對什麼

這次把 A5 的漂移檢查放進 CI（`system-design.md` §CI job 設計 的 `api-contract` job），本機的 `pnpm run api:sync` 與 `check` 指令跑的是同一組指令。這個 job 不起服務，因為匯出不需要環境變數，也不需要資料庫（`api-schema-export`）。

| 順序 | 產生                                                                                           | 比對對象                                        | 判定失敗的條件                                                                                            |
| :--- | :--------------------------------------------------------------------------------------------- | :---------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| 1    | `cd backend && uv run python -m app.scripts.export_openapi`：從 FastAPI app 匯出介面描述檔     | 已提交的 `backend/openapi.json`                 | `git diff --exit-code -- backend/openapi.json` 有差異，或 `git status --porcelain` 顯示它是還沒提交的新檔 |
| 2    | `pnpm --filter frontend api:generate`：Orval 讀已提交的 `backend/openapi.json`，清空後重寫產物 | 已提交的 `frontend/src/api/generated/` 整個目錄 | 同上兩個條件；有任何檔案被改、刪除或新增都算                                                              |

- 第 1 步抓的是「改了後端路由或 schema，卻沒重新匯出」；第 2 步抓的是「介面描述檔已更新，卻沒重產前端呼叫層」，或有人手改了產物。
- operationId 的唯一性與「動詞加資源」命名，在第 1 步匯出時由既有的 `assert_unique_operation_ids` 與 `generate_operation_id` 把關，重複就讓匯出以非 0 結束。這次不改這套策略。
- 失敗時 job 要列出不同步的檔名，修正方式是在本機跑 `pnpm run api:sync` 後提交。
