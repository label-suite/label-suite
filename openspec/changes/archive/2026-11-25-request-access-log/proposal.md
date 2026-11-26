# Proposal

## Why

後端現在只在未處理例外與資料庫連不上時留下伺服器紀錄，一般請求沒有任何紀錄，業務程式寫的紀錄也不帶 `traceId`。使用者回報回應裡的 `traceId` 時，部署者撈不到同一個請求的其他紀錄（`backend-modules.mdx` §已知限制 第 1 列）。ADR-008 D4 決定本期不做監控與錯誤追蹤，出錯時只能看 log，所以 log 能不能用一個 `traceId` 串起整個請求，就是部署者唯一的追查手段。本 change 補上這一塊，同時維持「錯誤只記一次」與「log 不含請求內容」（issue #567 §需求目標）。

## What Changes

以下決議都由維護者於 2026-11-25 在 clarification 停點裁定（`clarification.md` §待釐清項目，以 Q 編號引用）。

- 每一個 `/api/v1` 請求留下**一行存取紀錄**，欄位為 method、路由模板（不是實際路徑）、狀態碼、耗時、`traceId`（issue #567 驗收第 1 條）。涵蓋範圍：
  - 成功（2xx）的健康檢查不寫，非 2xx 的健康檢查照分級寫；驗收第 1 條加「成功的健康檢查除外」（Q1）
  - 只記 `/api/v1`；跨來源預檢由 CORS 直接回應，不記；`/docs`、`/openapi.json` 等 `/api/v1` 以外的路徑不記（Q4、Q6）
  - 沒有路由模板的請求，路徑欄記固定佔位文字（例如 `<unmatched>`），不記實際路徑（Q5）
  - 不記來源 IP（Q9）
  - 耗時欄為 `duration_ms`：從進入存取紀錄中介層起，到最後一個回應 body 送出為止，毫秒、一位小數（Q11）
- 存取紀錄**依狀態碼分級**：2xx／3xx 為 INFO、4xx 為 WARNING、5xx 為 ERROR（issue #567 §功能範圍）
- **錯誤只記一次**：請求在處理過程中已經寫過錯誤紀錄（未處理例外、未對應狀態轉成的 500、健康檢查回 503 前寫的 WARNING）時，存取紀錄不再寫；驗收第 1 條對這類請求加例外。既有錯誤紀錄的筆數與等級不變；訊息裡的 `traceId` 依 Q8 改由自動帶入，相關測試的斷言跟著改（Q3、Q8；驗收第 2 條）
- 中介層位置：跨來源處理的內側、未處理例外攔截的外側，所以看得到 406 與最終的 500（Q4）
- 後端的**每一筆伺服器紀錄自動帶上目前請求的 `traceId`**，業務程式不必改呼叫方式（驗收第 3 條）。請求以外寫的紀錄，`traceId` 欄固定為 `-`（Q7）。實作不照 issue 字面用 logging filter，改用 record factory，需求目標不變（N1）
- **拿掉既有訊息裡手寫的 `traceId`**：未處理例外、未對應狀態轉 500、資料庫不可用這三處的訊息不再手寫 `traceId=%s`，改由自動帶入；測試改斷言自動帶入的值（Q8）
- 存取紀錄**沿用既有的 log 安全規則**：不記 query、body、header、cookie，來自請求的值先跳脫（驗收第 4 條；security-agent-rules S5、S9）
- **關閉伺服器程式內建的存取紀錄**：在後端程式的 log 設定裡關掉，一處涵蓋容器、本機開發指令與文件裡的手動啟動指令（Q10）
- **後端 log 輸出設定**涵蓋整個後端：格式由本 change 定，為一行 `key=value` 文字（Q2）；預設等級 `INFO`，可用新的環境變數 `LOG_LEVEL` 調整，兩份編排檔把 `.env` 的 `LOG_LEVEL` 傳進後端容器（`LOG_LEVEL: ${LOG_LEVEL:-INFO}`，Q14）；資料庫引擎、連線池與驅動的紀錄明確固定為 `WARNING`，不因 `LOG_LEVEL` 是 `INFO` 或 `DEBUG` 而印出 SQL 本文、參數值或驅動的錯誤訊息（Q12）
- **Q2 取代先前的決議**：歸檔 `2026-11-23-infra-compose-e2e-ci/clarification.md` Q15（#506，「access log 格式留給 01-01」）由本 change 的 Q2 取代
- 同步常駐文件 `docs/diagrams/architecture/backend-modules.mdx`：§後端基礎建設的 `core/` 各模組、app factory、correlation id、§log 安全規則（並註明寄信降級的紀錄管道留給寄信的 change，N3）、§設定（`LOG_LEVEL`）。§已知限制：刪除 #567 那一列、新增「回應已開始送出後才出錯」一列（N2）；刪除 #567 那一列由實作在同一個 PR 進行（clarification P2、system-design §常駐文件異動）
- 沒有 **BREAKING** 變更：不改任何端點、回應欄位、標頭或錯誤碼（api-contract §理由）。部署者在容器 log 看到的內容會改變：每個請求新增一行存取紀錄、所有後端紀錄改成一行 `key=value`、伺服器程式內建的存取紀錄消失。這屬於維運面的變化，不算 API 破壞

## Capabilities

### New Capabilities

- `server-logging`：後端伺服器紀錄的可測行為，包括每個 `/api/v1` 請求一行存取紀錄的欄位與涵蓋範圍（Q1、Q5、Q6、Q9、Q11）、依狀態碼分級與已記過錯誤的請求不再寫存取紀錄（Q3）、每一筆紀錄自動帶 `traceId` 以及請求以外的紀錄標成 `-`（Q7）、紀錄不得含的內容（query、body、header、cookie、答案）、輸出格式（Q2）、伺服器程式內建存取紀錄已關閉（Q10），以及輸出等級（Q12）。`request-correlation` 管的是追蹤編號怎麼產生、怎麼沿用、怎麼放進回應；這個 capability 管的是伺服器紀錄怎麼使用這個編號。兩者分開，日後寄信降級的紀錄管道（N3）、串流端點的例外紀錄（N2）與背景工作的紀錄也有地方歸屬

### Modified Capabilities

- `runtime-config`：新增 `LOG_LEVEL` 設定，預設 `INFO`，值不合法時拒絕啟動，錯誤訊息指出變數名、不印出設定值（Q12）。既有 Requirement「其餘設定都有預設值」列出各設定的預設值，`LOG_LEVEL` 要加進去；預設值與驗證規則寫進這一條（MODIFIED），與同一條裡 `API_DOCS_ENABLED` 的寫法一致；「兩層編排檔把 `LOG_LEVEL` 傳進後端容器」（Q14）另立一條（ADDED），比照同 capability 已有的「正式層部署明確關閉內建文件」以獨立 requirement 規範編排檔（design D9）
- `api-envelope`：**不寫 delta**（寫 specs 時確認，理由見 design D9）。Q5 決定未處理例外那一筆維持記實際路徑，所以 Requirement「未處理例外留下可用追蹤編號對照的伺服器紀錄」的文字不變；但 Q8 拿掉訊息裡手寫的 `traceId` 之後，Scenario「未處理例外的紀錄含追蹤編號且不含請求內容」的「紀錄含與回應 `traceId` 相同的值」改由自動帶入的欄位成立。這個 Scenario 沒有限定值必須出現在訊息文字，Q8 之後照原文仍可判定，所以 requirement 與 Scenario 都不改

以下 capability 會受影響，但 requirement 不變，所以不寫 delta：

- `container-runtime`：依 Q2、Q10 檢查過，這個 capability 沒有任何 requirement 規範後端 log 的格式或伺服器程式內建的存取紀錄；Q10 在程式的 log 設定裡關掉內建存取紀錄，`backend/Dockerfile` 與編排檔的啟動指令都不改。Q14 讓兩份編排檔的後端 `environment` 加 `LOG_LEVEL`，但這個 capability 沒有任何 requirement 規範「哪些設定要傳進後端容器」，所以不寫 delta；`LOG_LEVEL` 由編排檔傳入的可測行為寫在 `runtime-config`（比照同 capability 既有的「正式層部署明確關閉內建文件」）。Requirement「設定範例檔列出所有設定且不含 secret」本來就要求列出每個設定，`LOG_LEVEL` 加進 `.env.example` 是照既有 requirement 做，不改 requirement 文字
- `request-correlation`：本 change 只讀取它定的追蹤編號，不改產生與沿用的規則
- `health-check`：成功的健康檢查不寫存取紀錄（Q1）、回 503 前已寫的 WARNING 不再重複（Q3），都寫在 `server-logging`；健康檢查端點本身的行為不變

## 決議摘要

維護者 2026-11-25 在 clarification 停點的裁定，完整的選項與理由見 `clarification.md` §待釐清項目與 system-design §技術待決問題。

| 編號 | 主題                            | 決議                                                                                                    |
| :--- | :------------------------------ | :------------------------------------------------------------------------------------------------------ |
| Q1   | 健康檢查的存取紀錄              | 只略過成功的：2xx 不寫，非 2xx 照分級寫；驗收第 1 條加「成功的健康檢查除外」                            |
| Q2   | log 格式由誰定                  | 本 change 定，一行 `key=value` 文字；取代 #506 clarification Q15                                        |
| Q3   | 500 怎麼「不多記一次」          | 已記過錯誤的請求（未處理例外、未對應狀態轉 500、健康檢查 503）存取紀錄不寫；驗收第 1 條對這類請求加例外 |
| Q4   | 中介層位置                      | 跨來源處理的內側、未處理例外攔截的外側                                                                  |
| Q5   | 沒有路由模板的請求              | 路徑欄記固定佔位文字；未處理例外那一筆維持記實際路徑，`api-envelope` requirement 文字不動               |
| Q6   | 預檢與 `/api/v1` 以外的路徑     | 只記 `/api/v1`，預檢不記                                                                                |
| Q7   | 請求以外紀錄的 `traceId`        | 固定為 `-`                                                                                              |
| Q8   | 既有訊息裡手寫的 `traceId`      | 拿掉，三處訊息改寫，測試改斷言自動帶入的值                                                              |
| Q9   | 來源 IP                         | 不記                                                                                                    |
| Q10  | 伺服器程式內建的存取紀錄        | 在程式的 log 設定裡關閉                                                                                 |
| Q11  | 耗時                            | `duration_ms`，從進入中介層到最後一個 body 送出，毫秒一位小數                                           |
| Q12  | log 設定範圍                    | 整個後端；新增 `LOG_LEVEL`，預設 `INFO`；資料庫引擎、連線池與驅動的紀錄維持 `WARNING`                   |
| Q13  | 是否補回 `docs/specs/`          | 不補，依 spec-migration D4 追溯到 issue、ADR 與規則文件                                                 |
| Q14  | 編排檔傳入 `LOG_LEVEL`          | 補：兩份編排檔的後端 `environment` 加 `LOG_LEVEL: ${LOG_LEVEL:-INFO}`                                   |
| N1   | issue 字面寫 logging filter     | 改用 record factory                                                                                     |
| N2   | 回應已開始送出後才出錯          | 記成 `backend-modules.mdx` §已知限制，留給第一個串流端點的 change                                       |
| N3   | 寄信降級的設定密碼連結 log 管道 | 本 change 不處理，在 §log 安全規則註明留給寄信的 change                                                 |

system-design 另列的 N4（路由模板依賴 FastAPI 的公開函式，升版時有風險）不需要維護者決定，由測試釘住。

**範圍外**：來源 IP（Q9，日後要加另開 issue）、寄信降級的紀錄管道（N3）、串流端點的例外紀錄（N2）。

## 引用的需求來源

`docs/specs/` 沒有規格涵蓋本 change：PRD 只在 §系統脈絡 提到伺服器 log 一次，各模組規格都沒有存取紀錄的條文。依 `docs/development/workflow/spec-migration.mdx` D4，本 change 改追溯到 issue、ADR 與規則文件的條號（system-analysis §需求依據）；維護者已決定不補回 `docs/specs/`（Q13）：

- issue #567：§使用情境／功能範圍、§需求目標、§驗收條件 第 1～4 條
- `openspec/changes/request-access-log/clarification.md` Q1～Q14、N1～N3（2026-11-25 裁定）
- `docs/specs/00-prd.mdx` §系統脈絡（部署者那一列、Resend 那一列）：只有背景，沒有業務條文
- ADR-008 D4（觀測性本期只做 `ai_runs`）、D3（寄信降級把連結印在 log）；ADR-003 D5（`/api/v1` 前綴與外層的 `traceId`）、D8（背景工作，不在本次範圍）
- `docs/development/architecture.mdx` §部署與維運「監控」列
- api-agent-rules A7；security-agent-rules S5、S9；backend-agent-rules B1、B10；testing-agent-rules T6
- `docs/diagrams/architecture/backend-modules.mdx` §請求管線、§correlation id、§log 安全規則、§設定、§已知限制 第 1 列
- 主規格 `request-correlation`（Purpose）、`api-envelope`（Requirement「未處理例外留下可用追蹤編號對照的伺服器紀錄」）、`runtime-config`（Requirement「其餘設定都有預設值」）、`container-runtime`（Requirement「設定範例檔列出所有設定且不含 secret」）、`health-check`
- 歸檔 `2026-11-23-infra-compose-e2e-ci/clarification.md` Q15（被本 change Q2 取代）；歸檔 `2026-11-20-backend-skeleton/acceptance.md` §觀察 第 3 條

## Impact

- **後端程式**：`backend/app/core/` 新增 log 設定模組（record factory、formatter、整個後端的輸出設定、關閉伺服器程式內建的存取紀錄）；`core/middleware.py` 加存取紀錄中介層，並修改未處理例外中介層（Q3 的已記錯標記、Q8 的訊息）；`core/errors.py` 修改未對應狀態轉 500 那一筆（Q3、Q8）；`core/config.py` 的設定加 `LOG_LEVEL`（Q12）；`modules/health/service.py` 修改資料庫不可用那一筆（Q3、Q8）；`backend/app/main.py` 接上 log 設定與中介層。`backend/Dockerfile`、`scripts/dev.mjs` 不改（Q10）。分層不變，`app/core/` 仍不 import `app/modules/`（backend-agent-rules B1）
- **API**：沒有變更（api-contract）。`backend/openapi.json` 不用重新匯出，前端型別也不用重新產生。回應的外層、`X-Correlation-ID`、`500 INTERNAL_ERROR` 的通用訊息、CORS 公開的標頭都維持不變（api-contract §與契約相鄰、本次維持不變的約束）
- **前端與 UI**：沒有變更（ui-design），`design/prototype/` 不動
- **資料庫**：沒有資料模型異動，沒有 migration
- **設定**：新增 `LOG_LEVEL`（預設 `INFO`），同時改根目錄 `.env.example` 與 `backend-modules.mdx` §設定（Q12）
- **編排檔**：`docker-compose.yml` 與 `docker-compose.prod.yml` 的後端 `environment` 各加一行 `LOG_LEVEL: ${LOG_LEVEL:-INFO}`，`.env` 的值才進得了容器；啟動指令與其他設定不改。檔案變動會讓 CI 的 `compose` job 執行，該 job 現有的檢查不需修改（Q14）
- **文件**：`docs/diagrams/architecture/backend-modules.mdx`（見 What Changes 倒數第二項）
- **部署與維運**：容器 log 每個 `/api/v1` 請求多一行存取紀錄，成功的健康檢查（每 30 秒一次）不算在內（Q1）；所有後端紀錄改成一行 `key=value`（Q2）；伺服器程式內建的存取紀錄消失（Q10）；部署者可在 `.env` 把 `LOG_LEVEL` 設成 `WARNING` 只留 4xx 以上，兩層容器部署都生效（Q12、Q14）。log 的保存、輪替與集中式平台不在範圍內（ADR-008 D4）
- **依賴**：issue #567 唯一的 blocked-by（#506）已關閉；不記來源 IP，所以與 #566 沒有依賴（Q9）
- **測試集答案不外露（Hard Rule 6）**：存取紀錄只記路由模板、從不讀 body，所以不會把答案或資料識別碼寫進紀錄（system-design §權限檢查點）。**任務設定驅動（Hard Rule 5）**：不適用，本 change 不涉及任務類型
