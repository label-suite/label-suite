# Design

## Context

動機見 `proposal.md` §Why。本 change 只動後端基礎建設 `backend/app/core/`，加上 `modules/health/service.py` 一行訊息與它丟的例外參數；沒有端點、資料表或畫面異動（`api-contract.md`、`ui-design.md`）。元件、目錄異動、Class Diagram 與五張 Sequence Diagram 都在 `system-design.md`，本文只記決策、取捨、風險與上線計畫，不重抄。

現況與限制：

- 中介層由外而內是 Correlation → CORS → Unhandled → Locale，三個自寫中介層都是純 ASGI（`backend-modules.mdx` §請求管線）
- 目前只有未處理例外、未對應狀態轉 `500`、資料庫不可用三處寫紀錄，訊息裡手寫 `traceId=%s`；程式沒有任何 log 輸出設定，uvicorn 內建的存取紀錄會印出 query（歸檔 `2026-11-20-backend-skeleton/acceptance.md` §觀察 第 3 條）
- `app/core/` 不得 import `app/modules/`（backend-agent-rules B1，`test_layer_boundaries.py` 的 `Core does not depend on modules`）
- 維護者 2026-11-25 已裁定 Q1–Q14、N1–N3（`clarification.md`），本文照裁定寫

## Goals / Non-Goals

**Goals:**

- 實作 `specs/server-logging/spec.md` 的每條 requirement，以及 `specs/runtime-config/spec.md` 對「其餘設定都有預設值」的修改
- 既有 `api-envelope`、`request-correlation`、`health-check` 的行為與測試意圖不變（`api-contract.md` §與契約相鄰、本次維持不變的約束）
- `configure_logging` 可在同一個行程內重複呼叫而不疊加 handler，讓測試能反覆建 app

**Non-Goals:**

- 來源 IP（Q9）、寄信降級的紀錄管道（N3）、串流端點回應開始後的例外紀錄（N2）、背景工作的紀錄與 traceId 傳遞（ADR-003 D8，worker 尚不存在）
- log 的保存、輪替、集中式平台與告警（ADR-008 D4）
- 非同步寫出（`QueueHandler`）：目前量不需要，見 Risks
- 改 `backend/Dockerfile`、`scripts/dev.mjs`、文件裡的手動啟動指令（Q10 在程式裡關內建存取紀錄）

## Decisions

### D1. 中介層位置：CORS 內側、Unhandled 外側（Q4）

由外而內 Correlation → CORS → AccessLog → Unhandled → Locale；`create_app` 以 `add_middleware` 在 `UnhandledExceptionMiddleware` 之後、`CORSMiddleware` 之前加入（後加的在外層）。理由與各層關係見 system-design §中介層位置；這個位置讓存取紀錄看得到 `406` 與 `500` 的最終狀態及「已記過」標記，預檢由 CORS 自己回應、自然不經過它，並且仍在 Correlation 內側、讀得到 `correlation_id_var`。

- 替代：放在 Correlation 外側——`correlation_id_var` 已被 `reset`，紀錄拿不到 traceId，否決
- 替代：放在 Unhandled 內側——看不到未處理例外轉成的 `500`，也看不到 Unhandled 設的標記，否決

### D2. 錯誤只記一次：以 scope state 標記「已記過」（Q3）

`log_config.py` 提供 `mark_error_logged(scope)`／`is_error_logged(scope)`，在 `scope["state"]` 設、讀固定鍵 `error_logged`。三個已記錯誤的地方記完就標記：`UnhandledExceptionMiddleware`（含回應已開始、要往外拋的路徑）、`handle_http_exception` 的未對應狀態分支、`handle_app_error` 在 `exc.already_logged` 為真時。`AppError` 加 keyword `already_logged: bool = False`，`HealthService.check` 丟 `DatabaseUnavailableError(already_logged=True)`，service 因此不必碰 `scope`。存取紀錄在內層結束後先看標記，為真就不寫。細節見 system-design §元件清單與「未處理例外造成的 500 只留一筆 ERROR 紀錄」「業務程式的紀錄不改呼叫方式就帶上追蹤編號」兩張圖。

- 替代：存取紀錄一律不記 `5xx`——沒記過錯誤的 `5xx`（例如日後的領域錯誤）會完全沒有紀錄，違反 issue #567 §功能範圍的分級
- 替代：拿掉既有的 ERROR、只留存取紀錄——存取紀錄不含例外型別與堆疊，追不到原因，且會改變 `api-envelope` 的 requirement
- 標記只是 scope 裡的一個布林，`already_logged` 也只是建構參數，都不進回應（system-design §權限檢查點）

### D3. traceId 以 record factory 帶入（N1、Q7）

`install_trace_id_record_factory()` 以 `logging.setLogRecordFactory` 包住原本的 factory，每筆 record 建立時加 `trace_id = current_correlation_id() or "-"`；**不**呼叫 `current_trace_id()`（請求外會產生新 UUID）。以模組層旗標保證只包一次。取捨表見 system-design §traceId 怎麼進每一筆 record：filter 掛在 handler 時 `caplog` 看不到，掛在 logger 時子 logger 的 record 不經過。代價是行程層全域狀態，靠「只包一次」與測試 fixture 控制。

連帶的訊息改寫（Q8）：三處訊息拿掉手寫的 `traceId=%s`，測試改斷言 `record.trace_id`。

### D4. 一行 `key=value` 的 `KeyValueFormatter`（Q2）

所有紀錄（存取紀錄、業務程式、uvicorn）都用同一個 formatter；欄位順序、`timestamp` 形狀、`msg` 固定最後、控制字元跳脫、`exc_info` 只寫 `excType` 的規則見 system-design §一行長什麼樣。存取欄位以 record 的 `extra`（`http_method`、`http_route`、`http_status`、`duration_ms`）傳入，formatter 在 record 帶這些屬性時才輸出對應鍵。

- 替代：JSON 一行——機器好解析，但維護者選人眼好讀、`grep traceId=` 就找得到（Q2）
- 替代：沿用 stdlib 預設格式——不帶 traceId，且多行 traceback 會讓一筆紀錄跨行，無法以行為單位搜尋

### D5. 路由模板以公開的 `iter_route_contexts` 取得（Q5、N4）

`route_template(scope)` 從 `scope["app"]` 用 `fastapi.routing.iter_route_contexts(app.routes)` 建「route 物件 → 完整 `path_format`」對照表並快取；查不到時重建一次，仍查不到回 `None`，由存取紀錄寫 `<unmatched>`。實測結果（405 有模板、404 與 406 沒有、預檢不進來）與取法見 system-design §路由模板怎麼取。

- 替代：讀 `scope["route"].path`——不含 `include_router` 的 `/api/v1` 前綴，否決
- 替代：讀私有的 `scope["fastapi"]["effective_route_context"]`——沒有型別、升版可能改名，否決
- 替代：沒有模板時記實際路徑——任意輸入會進 log（Q5 否決）
- 風險控制：一條測試釘住「完整模板含 `/api/v1` 前綴」，FastAPI 升版改行為時先紅

### D6. `configure_logging` 是唯一的輸出設定點，可重複呼叫（Q10、Q12）

`create_app` 讀完設定後呼叫 `configure_logging(settings)`：安裝 record factory；在 root 掛一個以屬性標記的 `StreamHandler`（重呼叫時先移除自己標記的那一個再掛，不動 `caplog` 等其他 handler）；root 與該 handler 的等級都設成 `LOG_LEVEL`；`sqlalchemy`（父 logger，涵蓋 `sqlalchemy.engine` 與 `sqlalchemy.pool`）、`aiosqlite`、`asyncpg` 固定 `WARNING`；`uvicorn` 清空 handler、`propagate=True`；`uvicorn.access` 清空 handler、`propagate=False`。各項的理由（handler 也要設等級才壓得掉 uvicorn 的 INFO、root 為 INFO 時 SQLAlchemy 會印 SQL、uvicorn 先 `dictConfig` 後呼叫 factory 所以設定不會被蓋回）見 system-design §log 輸出設定的已知陷阱。

只釘 `sqlalchemy.engine` 不夠（design review 指出）：`LOG_LEVEL=DEBUG` 時 `aiosqlite` 會以 DEBUG 印出 SQL 本文與參數（繞過 engine 的 `hide_parameters=True`），`sqlalchemy.pool` 繼承 root、會在 INFO／DEBUG 印出驅動的錯誤訊息。所以改釘父 logger `sqlalchemy` 與兩個驅動的 logger，仍在 Q12「SQL 紀錄維持 `WARNING`」的意圖內。

`configure_logging` 另接受一個選用參數 `stream`（預設 `sys.stderr`），讓本 repo 的 root handler 寫到指定的串流；測試傳入 `io.StringIO`，以實際的 `KeyValueFormatter` 輸出斷言整行格式與「整個輸出不含某字串」，不只看 `caplog.records`。正式程式不傳這個參數。

- 替代：用 `--no-access-log` 關內建存取紀錄——要改 Dockerfile、`scripts/dev.mjs` 與文件三個啟動點，漏一處就漏（Q10 否決）
- 替代：只設 `app.access` 的 handler、不碰 root——業務程式與 uvicorn 的紀錄格式不一，`LOG_LEVEL` 管不到全後端（Q12 否決）

### D7. 成功時不記的路由由 `main.py` 傳入（Q1、B1）

`AccessLogMiddleware(quiet_success_routes=frozenset({f"{API_V1_PREFIX}/health"}))`；core 不寫死健康檢查的路徑，也不 import `app/modules/`。判斷順序：先看「已記過」標記，再看「2xx 且模板在 `quiet_success_routes`」，其餘寫一筆（system-design §元件清單 `AccessLogMiddleware`）。

### D8. `LOG_LEVEL` 只放在 `Settings`（Q12）

列舉 `DEBUG`、`INFO`、`WARNING`、`ERROR`、`CRITICAL`，不分大小寫，預設 `INFO`；錯值由 `load_settings` 丟 `ConfigError`，只寫變數名與原因。`DatabaseSettings`（Alembic）不讀，遷移行程維持 `alembic.ini` 的 `fileConfig`（system-design §元件清單 `Settings.log_level`、§已知陷阱「遷移行程不受影響」）。範例寫在根目錄 `.env.example`（`container-runtime` requirement「設定範例檔列出所有設定且不含 secret」所指的檔案；repo 沒有 `backend/.env.example`，system-design §目錄異動 已更正）。

兩份編排檔的後端 `environment` 各加一行 `LOG_LEVEL: ${LOG_LEVEL:-INFO}`（Q14）：兩份編排檔都逐項列出傳給後端的變數、沒有 `env_file`，不加這一行時 `.env` 的 `LOG_LEVEL` 進不了容器，Q12「部署者可降到 `WARNING`」在容器部署時不成立。預設值寫在編排檔與 `Settings` 兩處且同為 `INFO`，`.env` 不設時行為與不經編排檔直接啟動相同。正式層不像 `API_DOCS_ENABLED` 那樣釘死，因為等級是部署者要能調的值。CI 的 `compose` job 會因編排檔變動而執行，它現有的結構檢查與啟動檢查不涉及環境變數清單，不需修改；`scripts/tests/` 沒有斷言編排檔的 `environment` 內容。

- 替代：編排檔改用 `env_file: .env`——會把 `.env` 的所有變數（含資料庫密碼）一併傳進後端，與兩份編排檔逐項列出的既有做法相反，否決

### D9. spec delta 的範圍

- `server-logging`：新增 capability，承載存取紀錄、traceId 帶入、格式與等級（proposal §Capabilities）
- `runtime-config`：MODIFIED「其餘設定都有預設值」，把 `LOG_LEVEL` 的預設值與驗證寫進同一條，與同一條裡 `API_DOCS_ENABLED` 的寫法一致；ADDED「兩層編排檔把 LOG_LEVEL 傳進後端容器」（Q14），比照同 capability 已有的「正式層部署明確關閉內建文件」以獨立 requirement 規範編排檔，不混進「預設值」那一條
- `api-envelope`：**不寫 delta**。Requirement「未處理例外留下可用追蹤編號對照的伺服器紀錄」要求紀錄「含該請求的 `traceId`、method、path 與例外細節」，Q5 保留實際路徑、例外細節仍是只有型別與 frame 的 traceback；Q8 之後 `traceId` 不在訊息文字裡，但仍在同一筆紀錄的 `traceId` 欄（record 屬性與輸出行的 `traceId=`）。Scenario「未處理例外的紀錄含追蹤編號且不含請求內容」的判定句「伺服器紀錄有一筆 `ERROR`，含與回應 `traceId` 相同的值與請求的 path」沒有限定值必須出現在訊息文字，照原文仍可客觀判定；改變的只是測試斷言的位置（How）。「恰好一筆」與「訊息不含 `traceId=`」由 `server-logging` 的 Scenario 另外釘住
- `container-runtime`：不寫 delta。它的 requirement 規範服務組成、啟動順序、公開入口、遷移、健康檢查、volume 與 `.env.example`，沒有任何一條規範「哪些設定要傳進後端容器」，所以 Q14 不改它的 requirement 文字；`.env.example` 加 `LOG_LEVEL` 是照既有 requirement「設定範例檔列出所有設定且不含 secret」做
- `request-correlation`、`health-check`：不寫 delta，理由見 proposal §Capabilities

### D10. 常駐文件分工

規劃階段 `sd` 已改好 `backend-modules.mdx` 的 §health、§`core/` 各模組、§app factory、§請求管線（含 `@ai-visualize` prompt，`status: pending`）、§correlation id、§log 安全規則、§設定（system-design §常駐文件異動）。實作留下三件：

1. §已知限制 刪掉 #567 那一列、加上 N2 那一列（system-design §已知限制），由實作群組在同一個 PR 處理（clarification P2）
2. 依落地的程式校正上述各節（`backend-modules.mdx` §誰改、什麼時候改：實作後由 `backend-developer` 校正）
3. 重新產生互動元件 `.notecraft/components/backend-request-pipeline.tsx`，`status` 改回 `generated`，並依 `content-visualize` skill 第 5 步把 `GeneratedFrame` 的 `prompt` 與 `caption` 換成目前 `@ai-visualize` 區塊的值（現在仍是九層、沒有 `AccessLogMiddleware` 的舊 prompt；`import` 不改），由 `technical-writer` 做。**不得在 worktree 執行 NoteCraft build**（會污染主倉庫共用的建置快取），渲染驗證交給 CI 的 `docs-site` job

## Risks / Trade-offs

- [record factory 與 root handler 是行程層的全域狀態，測試反覆建 app 會互相影響] → `configure_logging` 只移除自己標記的 handler、record factory 只包一次；測試以 fixture 在每個測試後還原 root 等級、root handler、`uvicorn`、`uvicorn.access`、`sqlalchemy`、`aiosqlite`、`asyncpg` 的設定
- [FastAPI 升版改了 `iter_route_contexts` 或 `RouteContext`（N4）] → 測試釘住「完整模板含 `/api/v1` 前綴」；`openapi.py` 的 operationId 唯一性檢查依賴同一個函式，會一起紅
- [回應已開始送出後才出錯時，uvicorn 會以 `exc_info` 再記一筆 ERROR，「錯誤只記一次」在這條路徑不成立（N2）] → 目前沒有串流端點；formatter 對 `exc_info` 只寫型別，不會外洩訊息；寫進 `backend-modules.mdx` §已知限制，留給第一個串流端點的 change
- [`StreamHandler` 在事件迴圈上同步寫 stderr，收集端變慢時會拖慢請求] → 正常量每個請求一行；成功的健康檢查不寫（Q1）。日後需要時改 `QueueHandler` 加 `QueueListener`（system-design §交易、session 與效能）
- [部署者既有的 log 解析規則失效：格式改成一行 `key=value`、uvicorn 內建存取紀錄消失] → 不是 API 破壞（proposal §What Changes 最後一項）；格式寫進 `backend-modules.mdx` §log 安全規則與本 spec
- [`LOG_LEVEL=DEBUG` 可能讓第三方套件印出敏感內容] → `sqlalchemy`、`aiosqlite`、`asyncpg` 固定 `WARNING`；其他第三方紀錄帶 `exc_info` 時只寫型別；正式層預設 `INFO`
- [reloader 父行程（`--reload`）的幾行不經 `create_app`，維持 uvicorn 原格式] → 只影響本機開發，不含請求內容

## Migration Plan

- **資料庫**：沒有 migration，Alembic 不受影響
- **上線**：合併後照常重建後端映像並以更新後的編排檔重啟；`.env` 不設 `LOG_LEVEL` 時為 `INFO`，行為即 spec 的預設
- **回滾**：revert 本 change 的 PR 即可（含兩份編排檔的那一行），沒有資料或 schema 要還原；`.env` 已設的 `LOG_LEVEL` 在舊版不被傳入也不被讀取，不影響啟動
- **觀察點**：上線後容器 log 每個非健康檢查的 `/api/v1` 請求多一行 `logger=app.access`；成功的健康檢查不出現；`grep "traceId=<值>"` 能找到同一請求的全部紀錄
