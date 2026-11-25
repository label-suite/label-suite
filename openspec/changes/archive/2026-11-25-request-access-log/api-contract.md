# API Contract

本次無 API 變更。

## 理由

本 change 只動後端的基礎建設（`app/core/` 的存取紀錄中介層與 log 設定，見 `system-design.md`），寫的是伺服器端的紀錄，沒有任何 API 或畫面能讀到它：

- 沒有新增、修改或移除端點；`operationId` 不變，`backend/openapi.json` 不需重新匯出，前端 `pnpm --filter frontend api:generate` 不需重跑
- 沒有新增或修改請求、回應欄位，沒有新的錯誤碼，任何端點的角色與欄位遮蔽都不變
- 沒有 **BREAKING** 變更，前端不受影響

## 常駐文件異動

本次無常駐文件異動（`docs/diagrams/architecture/error-codes.mdx`、`docs/diagrams/architecture/endpoint-authorization.mdx` 都不改）。

## 與契約相鄰、本次維持不變的約束

以下行為是既有契約（`openspec/specs/api-envelope`、`openspec/specs/request-correlation`），實作本 change 時**不得**改變；列在這裡給 `code-reviewer` 與 `acceptance-verifier` 對照：

| 約束                                | 維持的行為                                                                                           | 為什麼要特別寫                                                                                     |
| :---------------------------------- | :--------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| 成功與錯誤 envelope                 | 欄位與形狀不變；存取紀錄的欄位（耗時、路由模板、等級）**不得**出現在回應裡                           | 存取紀錄中介層包住整條回應，只能讀 `http.response.start` 的狀態碼，不得改寫 body                   |
| `X-Correlation-ID` 標頭與 `traceId` | 每個回應仍帶 `X-Correlation-ID`，與 envelope 的 `traceId` 同值；自帶值的格式規則不變                 | log record 的 `trace_id` 讀同一個 contextvar，三者同值；本 change 不新增回應標頭                   |
| `500 INTERNAL_ERROR`                | 回應仍只有通用訊息，不含堆疊或內部識別碼                                                             | clarification Q3 的「已記過就不寫存取紀錄」與 Q8 拿掉手寫 traceId 只改變**伺服器紀錄**，不改變回應 |
| CORS 公開標頭                       | `expose_headers` 仍只有 `X-Correlation-ID`                                                           | 本 change 不加任何給前端讀的標頭                                                                   |
| 測試集答案不外露（Hard Rule 6）     | 不適用於 API：沒有端點異動。紀錄端的做法（只記路由模板、不讀 body）見 `system-design.md` §權限檢查點 | —                                                                                                  |

`LOG_LEVEL`（clarification Q12 裁定新增）是**執行期設定**，屬 `openspec/specs/runtime-config` 與 `.env.example`，不是 API 契約，不出現在 `openapi.json`。
