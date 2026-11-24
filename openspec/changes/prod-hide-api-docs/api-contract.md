# API Contract

本次**沒有業務端點的變更**：`/api/v1` 底下的端點、request、response、錯誤碼、角色與欄位遮蔽都不動，沒有新增 operationId。受影響的只有 FastAPI 內建、不在 `/api/v1` 底下、不在 `openapi.json` 的 `paths` 裡（`include_in_schema=False`）的四條非業務路由。它們不是業務契約的一部分，不走 `generate_unique_id_function`、沒有 operationId，也不套成功回應 envelope（框架直接回 HTML 或 JSON 文件，屬於 envelope 的檔案類例外：回的是文件頁與整份 OpenAPI 文件，不是業務資料）。

設定為 `API_DOCS_ENABLED`，布林，預設 `true`，正式層 compose 設為 `false`（clarification Q1，細節見 system-design）。`false` 時四條路由都不註冊（Q2），回既有 envelope 404（Q7）。

## 端點總覽

| Method            | Path                    | operationId        | 角色             | 異動                                                               |
| :---------------- | :---------------------- | :----------------- | :--------------- | :----------------------------------------------------------------- |
| GET               | `/docs`                 | 無（不在 `paths`） | 任何人，不需登入 | `API_DOCS_ENABLED=false` 時不提供；預設維持                        |
| GET               | `/docs/oauth2-redirect` | 無                 | 任何人           | 隨 `/docs` 一併不提供（system-design：`docs_url=None` 連帶不註冊） |
| GET               | `/redoc`                | 無                 | 任何人           | `API_DOCS_ENABLED=false` 時不提供                                  |
| GET               | `/openapi.json`         | 無                 | 任何人           | `API_DOCS_ENABLED=false` 時不提供                                  |
| `/api/v1/**` 全部 | —                       | 不變               | 不變             | 無 API 變更                                                        |

## 關閉範圍與回應形態

### 各設定值的結果

| 路徑                    | `API_DOCS_ENABLED=true`（預設，Lite 與本機開發） | `API_DOCS_ENABLED=false`（正式層 compose）                            | 回應格式                          |
| :---------------------- | :----------------------------------------------- | :-------------------------------------------------------------------- | :-------------------------------- |
| `/docs`、`/redoc`       | 200，內建文件頁（與現況相同）                    | 404（既有 envelope `NOT_FOUND`，訊息依 locale，與其他不存在路徑一致） | 提供時為 HTML，不套 envelope      |
| `/docs/oauth2-redirect` | 200（與現況相同）                                | 404                                                                   | 提供時為 HTML                     |
| `/openapi.json`         | 200，現況                                        | 404                                                                   | 提供時為 JSON 文件，不套 envelope |

### 各路由共同欄位

- **角色**：任何人，不需登入（現況，本次不改）；沒有授權判定，控制點是路由是否存在（組裝期）。
- **Request**：無 path／query／body 欄位。
- **遮蔽欄位**：無。
- **測試集答案隔離**：無（只描述端點結構，不含資料；本次沒有新增任何標記員能到達的端點）。
- **錯誤**：`API_DOCS_ENABLED=false` 時 `404`（觸發條件：該路徑未註冊，實作要以測試確認回應與其他不存在路徑一致）；提供時沒有錯誤碼。不回內部識別碼或堆疊。

## 不受影響的契約產物

- `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json`（#572 文件站副本，`openapi-renderer` 讀取）：內建路由本就不在 `paths`；匯出命令直接呼叫 `app.openapi()` 且用固定的 `PLACEHOLDER_SETTINGS`，不依賴 `/openapi.json` 路由（system-design「契約匯出不受設定影響」）。預期重新匯出後位元組不變，CI `api-contract` job 不受影響；`PLACEHOLDER_SETTINGS` 要明確加上 `api_docs_enabled=True`（避免環境變數影響匯出）；實作要以測試證明位元組不變。
- 前端：client 由提交進 repo 的 `openapi.json` 產生，不讀執行中服務的文件路由，無 BREAKING 變更、前端不受影響。

## 常駐文件異動

已在規劃階段改好（clarification Q7、Q10、P2）：

- 常駐文件：`docs/diagrams/architecture/endpoint-authorization.mdx`、`docs/diagrams/architecture/error-codes.mdx`

| 文件                         | 節              | 異動     | 摘要                                                                                                                            |
| :--------------------------- | :-------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------ |
| `endpoint-authorization.mdx` | §不在本表的路徑 | 修改     | 內建文件那列改成依 `API_DOCS_ENABLED` 提供：`true` 任何人、`false` 路由不註冊回 404；出處改為 `create_app` 依該設定決定（#592） |
| `endpoint-authorization.mdx` | §已知限制       | 刪除一列 | 移除「正式環境要不要關閉」那列（原寫「尚未開 issue」，已由 #592 處理）                                                          |
| `error-codes.mdx`            | `NOT_FOUND` 列  | 修改     | 「產生的位置」補上 `API_DOCS_ENABLED=false` 時四條內建文件路由也由路由層回 `404`；不新增錯誤碼                                  |

`backend-modules.mdx` 的異動見 system-design.md §常駐文件異動。
