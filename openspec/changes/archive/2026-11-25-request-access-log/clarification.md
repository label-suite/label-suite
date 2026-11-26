# Clarification：request-access-log

關卡模式，檢查 system-analysis、system-design、ui-design、api-contract、proposal 五份產出；specs、design、tasks 尚未產生，相關檢查項標「後續產物」。來源 issue #567。

## 檢查結論

| #   | 面向             | 結論     | 說明                                                                                                                                                                                             |
| :-- | :--------------- | :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 規格完整性       | 待釐清   | issue 四條驗收都有對應；issue 自身兩處矛盾（「恰好一行」與 health 可略過；5xx 分級與「不多記一次」）與 #506 clarification Q15 的衝突列為 Q1–Q3。specs、design、tasks 的完整性為後續產物          |
| 2   | API Contract     | 通過     | 無端點、欄位、錯誤碼、operationId 異動；envelope、`X-Correlation-ID`、500 通用訊息、CORS 公開標頭維持不變，已寫明供審查與驗收對照                                                                |
| 3   | 邏輯一致性       | 問題     | 405 有沒有路由模板，system-analysis 與 system-design 說法相反（P1）；§已知限制 #567 那一列由誰、何時改，兩份說法不同（P2）                                                                       |
| 4   | 可行性           | 通過     | FastAPI 0.165／Starlette 1.10 實測：路由完整前綴只在私有 scope 鍵，改用公開的 `iter_route_contexts`，由測試釘住；SQLAlchemy engine 要明確設 `WARNING`                                            |
| 5   | 邊界情況         | 待釐清   | 無模板請求、預檢、`/api/v1` 以外路徑、請求以外紀錄、回應已開始送出後出錯，列為 Q4–Q7、N2                                                                                                         |
| 6   | 跨功能影響       | 待釐清   | log 設定範圍牽動 `runtime-config`、`.env.example`（Q12）；格式牽動所有既有紀錄與 `container-runtime`（Q2）；500 的寫法牽動 `api-envelope`（Q3、Q5、Q8）；寄信降級的 log 管道（N3）。無資料庫異動 |
| 7   | 可測試性         | 後續產物 | 存取紀錄欄位、分級、traceId 帶入、不含 query 與 body 都可用 `caplog` 與 ASGI 測試客戶端驗；Scenario 由 specs 定義                                                                                |
| 8   | 規格範圍         | 待釐清   | 是否補回 `docs/specs/`（Q13）；不改 `00-prd.mdx`、`design/prototype/`                                                                                                                            |
| 9   | 任務設定驅動     | 通過     | 只動 `app/core/` 的基礎建設，沒有任務類型的分支或欄位                                                                                                                                            |
| 10  | 測試集答案不外露 | 通過     | 存取紀錄只寫在伺服器端，產品沒有任何畫面或 API 讀得到；欄位不含 query、body、header、cookie，不會帶出答案                                                                                        |

`sa` 的待決問題 1–13 與 `sd` 新增的 N1–N3 成為下面的 Q1–Q13、N1–N3；N4（FastAPI 升版風險）不需要維護者決定，由測試釘住。

## 待釐清項目（Q）

以下全部由維護者 2026-11-25 在本停點以問答逐題裁定；提問時附的選項與後果取自 system-design 當時的 §技術待決問題，裁定後 system-design 已改寫成只描述決議，各題的理由見下表。

| #   | 題目                                                               | 決議                                                                                                                                                                        | 理由                                                                        |
| :-- | :----------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| Q1  | health 的存取紀錄                                                  | **只略過成功的**：health 的 2xx 不寫，非 2xx 照分級寫；驗收第 1 條加「成功的健康檢查除外」                                                                                  | 平時不洗版，資料庫中斷時存取紀錄看得到                                      |
| Q2  | log 格式由誰定                                                     | **本 change 定，一行 `key=value` 文字**；**取代** #506 clarification Q15「access log 格式留給 01-01」                                                                       | 人眼好讀、`grep traceId=` 就找得到                                          |
| Q3  | 500 怎麼「不多記一次」                                             | **存取紀錄不寫**：已記過 ERROR 的請求（未處理例外、HTTP 例外轉 500、health 回 503 前已記 WARNING）以 `scope["state"]` 標記，存取紀錄看到就不寫；驗收第 1 條對這類請求加例外 | ERROR 恰一筆，既有測試不改                                                  |
| Q4  | middleware 位置                                                    | **CORS 內側、未處理例外外側**                                                                                                                                               | 看得到 406 與最終的 500 標記；預檢由 CORS 自己回，自然不記                  |
| Q5  | 沒有路由模板的請求                                                 | **固定佔位文字**（例如 `<unmatched>`）；未處理例外那一筆維持記實際路徑，不動 `api-envelope`                                                                                 | 不讓任意輸入進 log                                                          |
| Q6  | 預檢與 `/api/v1` 以外的路徑                                        | **只記 `/api/v1`，預檢不記**（隨 Q4）                                                                                                                                       | `/docs`、`/openapi.json` 在正式層本來就關閉                                 |
| Q7  | 請求以外紀錄的 traceId                                             | **固定標記 `-`**                                                                                                                                                            | 一眼看出不屬於任何請求                                                      |
| Q8  | 既有訊息裡手寫的 `traceId=%s`                                      | **拿掉**：三處訊息改寫，測試改斷言自動帶入的 `trace_id`                                                                                                                     | 避免同一行兩次 traceId                                                      |
| Q9  | 來源 IP                                                            | **不記**                                                                                                                                                                    | 與 #566 無依賴、沒有 PII 疑慮                                               |
| Q10 | uvicorn 內建 access log                                            | **在程式的 log 設定裡關**（`uvicorn.access` 清空 handler、`propagate=False`）                                                                                               | 一處涵蓋 Dockerfile、dev 腳本、文件手動指令三個啟動點                       |
| Q11 | 耗時                                                               | **`perf_counter`，從進入存取紀錄 middleware 到最後一個 body 送出，毫秒一位小數**（`duration_ms`）                                                                           | 含傳輸時間                                                                  |
| Q12 | log 設定範圍                                                       | **全後端，加 `LOG_LEVEL` 環境變數**，預設 `INFO`；`sqlalchemy.engine` 明確設 `WARNING`                                                                                      | 部署者可降到 `WARNING` 減量；要寫進 `.env.example`、`runtime-config`、§設定 |
| Q13 | 是否補回 `docs/specs/`                                             | **不補**                                                                                                                                                                    | 技術 change，依 spec-migration D4 追溯到 issue、ADR 與規則文件              |
| Q14 | 編排檔沒有把 `LOG_LEVEL` 傳進後端容器（`planner` 寫 tasks 時發現） | **補**：`docker-compose.yml` 與 `docker-compose.prod.yml` 的後端 `environment` 加 `LOG_LEVEL: ${LOG_LEVEL:-INFO}`；`container-runtime` 依需要寫 delta                       | Q12 的目的「部署者可降到 `WARNING`」要在容器部署時也成立                    |
| N1  | issue 字面寫 logging filter                                        | **用 record factory**                                                                                                                                                       | 達成同樣目標，且 uvicorn 與 `caplog` 的紀錄也有 `trace_id`                  |
| N2  | 回應已開始送出後才出錯                                             | **記成已知限制**（`backend-modules.mdx` §已知限制），留給第一個串流端點的 change                                                                                            | 目前沒有串流端點                                                            |
| N3  | 寄信降級的設定密碼連結 log 管道                                    | **本 change 不處理**，在 §log 安全規則註明留給寄信的 change                                                                                                                 | 那條紀錄還不存在                                                            |

## 明確問題（P）

### P1. 405 有沒有路由模板

- **位置**：system-analysis 待決 5 與 §例外路徑把 405 算成沒有模板；system-design 待決 5 實測 405 有模板
- **修正**：派 `sa` 依 system-design 的實測改正

### P2. §已知限制 #567 那一列由誰、何時改

- **位置**：system-analysis §範圍寫「由 `sd` 規劃時先改」；system-design §常駐文件異動寫「延到實作，同一張 PR 刪除」
- **修正**：派 `sa` 改成與 system-design 一致

### P3. 上游產出的待決改成決議

- **位置**：system-analysis §待決問題、system-design §技術待決問題與受影響的圖、元件表、常駐文件異動「待回修」各列；proposal §待決與有條件的 capability
- **修正**：`sa`、`sd`、`planner` 各自依上表改寫並標回修位置；`sd` 把常駐文件裡標「待回修」的各處（請求管線層次表與 `@ai-visualize`、§log 安全規則兩列、§設定）依決議改完，§已知限制 #567 那一列仍延到實作

## 交給後續產出

- **specs**：新增 capability `server-logging`（存取紀錄欄位與涵蓋範圍、分級、Q3 的不重複規則、traceId 自動帶入與請求以外的 `-`、紀錄不得含的內容、輸出等級）；`runtime-config` MODIFIED 加 `LOG_LEVEL`（Q12）；`api-envelope` 依 Q8 判斷 Scenario 的驗證方式是否要 MODIFIED；`container-runtime` 依 Q2、Q10 判斷是否要 delta。每條 requirement 註明來源：issue #567、ADR-008 D3／D4、ADR-003 D5／D8、api-agent-rules A7、security-agent-rules S5／S9、本文件的 Q 編號
- **design**：上表的決議；middleware 順序（Correlation → CORS → AccessLog → Unhandled → Locale）；record factory；`configure_logging` 可重複呼叫
- **tasks**：實作依 `backend-developer`；`.env.example`、`backend-modules.mdx` §設定、§log 安全規則、§已知限制（刪 #567、加 N2）的文件改動依分工；同一組任務刪 §已知限制 #567 那一列；測試涵蓋 2xx、4xx、未處理 500、health 成功與失敗、無模板 404、406、預檢不記、`/docs` 不記、請求以外紀錄的 `-`、不含 query、uvicorn 內建 access log 已關、`LOG_LEVEL` 錯值
- **範圍外，不在本 change**：來源 IP（Q9，若日後要加另開單）；寄信 log 管道（N3）；串流端點的例外紀錄（N2）
