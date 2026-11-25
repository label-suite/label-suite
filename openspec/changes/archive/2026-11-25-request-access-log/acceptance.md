## 驗收：request-access-log

結論：**通過**

驗收日期 2026-11-25，對象為分支 `feat/request-access-log` 的 `b5c85cf`（force-push 後的 head，worktree 已確認與 `origin/feat/request-access-log` 相同）。驗收者 `acceptance-verifier`，結論依維護者 2026-11-19 裁定即為驗收結論；code review 已無阻斷意見。

### 範圍與不適用項目

- 本 change 只有後端與編排檔。沒有前端、沒有畫面（`ui-design.md`），所以 **Playwright E2E、畫面四種狀態、cookie 與 storage、bundle 檢查都不適用**；沒有虛構任何畫面。
- 沒有 API 異動（`api-contract.md`）：沒有新端點、欄位或錯誤碼。正式 app 仍只有 `GET /api/v1/health`。
- 本專案還沒有認證。所有呼叫端都是匿名呼叫端，「各系統角色 × 任務成員身分」、「登入狀態已失效」、「遮蔽欄位」、「看不到的資源回 404」都沒有可驗的對象；`endpoint-authorization.mdx` 唯一一列 `getHealth`（不檢查、未登入也可呼叫）與實際行為一致，本 change 沒有改它。
- 依 clarification Q13，本 change **不補** `docs/specs/` 規格頁（技術 change，依 spec-migration D4 追溯到 issue、ADR 與規則文件）。下表「對應的規格書驗收標準」一欄因此填 spec 每條 requirement 的 `來源：`（issue #567 §驗收條件 的條號與規則條號），不是缺陷。

### 證據來源代號

| 代號        | 內容                                                                                                                                                                                                                                                                                                                                                                                                             |
| :---------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `L:probe`   | 真實 uvicorn（port 18567，Lite／SQLite，未設 `LOG_LEVEL`）跑正式的 `create_app()`，再把 `tests/probe.py` 的探測 router 掛到 `/api/v1`（與 `tests/conftest.py` 的 `app` fixture 相同組裝方式），另加兩條只在驗收暫存腳本的探測：`/acc-levels`（寫一筆 INFO、一筆 DEBUG）與 `/acc-exc`（`thirdparty.lib` 以 `exc_info` 記 `ValueError("CANARY-exc")`）。組裝後在請求外寫兩筆 WARNING。組裝腳本只放在暫存區、已刪除 |
| `L:real`    | 真實 uvicorn 跑正式的 `app.main:create_app --factory`，**不帶** `--no-access-log`，不掛任何探測                                                                                                                                                                                                                                                                                                                  |
| `L:debug`   | `L:real` 與 `L:probe` 各以 `LOG_LEVEL=DEBUG`（Lite）啟動一次；另以 `LOG_LEVEL=DEBUG` 加 `DATABASE_URL` 指向 `postgres:16` 暫時容器啟動一次（`L:debug-pg`）                                                                                                                                                                                                                                                       |
| `L:warn`    | `L:probe` 分別以 `LOG_LEVEL=WARNING` 與 `LOG_LEVEL=warning` 啟動                                                                                                                                                                                                                                                                                                                                                 |
| `L:down`    | `L:real` 以 `DATABASE_URL=postgresql://acc:CANARY-pw@127.0.0.1:5999/acc`（無人監聽的埠）啟動                                                                                                                                                                                                                                                                                                                     |
| `L:start`   | 以不合法設定直接執行 `uv run uvicorn app.main:create_app --factory`，記錄結束狀態與輸出                                                                                                                                                                                                                                                                                                                          |
| `L:empty`   | 在空目錄啟動 `L:real`，只設 `CORS_ALLOWED_ORIGINS`（不設 `SQLITE_PATH`）                                                                                                                                                                                                                                                                                                                                         |
| `L:image`   | `docker build backend` 成暫時 tag，`docker run -e LOG_LEVEL=WARNING`，走映像檔自己的 `CMD`（`uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000`）；容器與映像檔已刪除                                                                                                                                                                                                                             |
| `C:compose` | `docker compose -f <檔> --env-file <檔> config --format json`，不建立 `.env`                                                                                                                                                                                                                                                                                                                                     |
| `T`         | `backend/tests/` 的自動化測試，以 `檔名::函式` 簡寫；SQLite 與 PostgreSQL 兩輪都全綠（見 DoD）                                                                                                                                                                                                                                                                                                                   |

`L:*` 的輸出都是服務行程的 stdout／stderr 原文。traceback 很長的 ERROR 行在下文以 `…` 截斷顯示，完整行只有一行（已以 `grep -vc '^timestamp='` 確認整份輸出沒有不以 `timestamp=` 開頭的行）。

注意：`X-Correlation-ID` 只接受 `^[A-Za-z0-9-]{8,64}$`（既有規則，非本 change）。驗收中少於 8 個字元的值（例如 `acc-404`）被丟棄、由伺服器另產生 UUID，所以下面部分證據的 `traceId` 是 UUID；每一筆都已對照回應的 `x-correlation-id` 標頭與 body 的 `traceId`，三者相同。

### Scenario 結果

#### server-logging

| Scenario                                         | 對應的規格書驗收標準                                   | 證據                                                                                                                                                                                                                                                                                                                                                                                               | 結果 |
| :----------------------------------------------- | :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 成功的請求留下一行 INFO 存取紀錄                 | issue #567 §驗收條件 1；ADR-008 D4；ADR-003 D5         | `L:probe` 帶 `X-Correlation-ID: client-trace-0001` 打 `GET /api/v1/items/42` → `200`，輸出恰好一行（E1）；`grep -c 'items/42'` = 0。`T` `test_access_log.py::test_successful_request_writes_one_info_access_line`                                                                                                                                                                                  | 通過 |
| 方法不支援的請求記路由模板                       | issue #567 §驗收條件 1；clarification P1               | `L:probe` `POST /api/v1/health` → `405`，一行 `level=WARNING … route=/api/v1/health status=405`（E2）；`L:debug-pg` 同樣一行。`T` `::test_method_not_allowed_writes_the_route_template`                                                                                                                                                                                                            | 通過 |
| 沒有路由模板的請求記固定佔位文字                 | issue #567 §驗收條件 1；clarification Q5               | `L:probe` `GET /api/v1/no-such-resource` → `404`、帶 `Accept-Language: fr` 的 `GET /api/v1/health` → `406`，各一行 `route=<unmatched>`（E3）；`grep -c no-such-resource` = 0。`T` `::test_request_without_a_route_template_writes_the_placeholder`                                                                                                                                                 | 通過 |
| 用戶端錯誤的請求記一行 WARNING 存取紀錄          | issue #567 §驗收條件 1；api-agent-rules A7             | `L:probe` `POST /api/v1/probe` body `{}` → `422`，一行 `level=WARNING … method=POST route=/api/v1/probe status=422`（E4）。`T` `::test_client_error_writes_one_warning_access_line`                                                                                                                                                                                                                | 通過 |
| 處理過程沒有記過錯誤的 5xx 記一行 ERROR 存取紀錄 | issue #567 §驗收條件 1；api-agent-rules A7             | `L:probe` `GET /api/v1/probe-bad-gateway` → `502`，一行 `level=ERROR logger=app.access … status=502`（E5），該 traceId 沒有其他紀錄。`T` `::test_server_error_not_logged_before_writes_one_error_access_line`                                                                                                                                                                                      | 通過 |
| 未處理例外造成的 500 只留一筆 ERROR 紀錄         | issue #567 §驗收條件 1、2；S9；clarification Q3        | `L:probe` 帶 `X-Correlation-ID: acc-crash` 打 `GET /api/v1/probe-crash` → `500`、body `traceId` 為 `acc-crash`；輸出中 `traceId=acc-crash` 只有一行，`logger=app.core.middleware level=ERROR`，含 `GET /api/v1/probe-crash`，沒有 `app.access` 行；該行 `traceId=` 出現 1 次、訊息不含 `traceId=`（E6）。`T` `::test_unhandled_exception_leaves_one_error_record_and_no_access_line`               | 通過 |
| 未對應狀態轉成的 500 只留一筆 ERROR 紀錄         | issue #567 §驗收條件 1、2；clarification Q3、Q8        | `L:probe` `GET /api/v1/probe-teapot`（`HTTPException(418)`）→ `500`、`code=INTERNAL_ERROR`；該 traceId 只有一行 `level=ERROR logger=app.core.errors`，與回應 `traceId` 相同，沒有 `app.access` 行，訊息不含 `traceId=`（E7）。`T` `::test_unmapped_status_leaves_one_error_record_and_no_access_line`                                                                                              | 通過 |
| 資料庫無法連線時健康檢查只留一筆 WARNING 紀錄    | issue #567 §驗收條件 1、2；clarification Q3            | `L:down` `GET /api/v1/health` → `503 DATABASE_UNAVAILABLE`；該請求只有一行 `level=WARNING logger=app.modules.health.service`，沒有 `app.access` 行（E8）；`CANARY-pw` 未出現。`T` `::test_unreachable_database_leaves_one_warning_record_with_the_trace_id`（PostgreSQL 輪）                                                                                                                       | 通過 |
| 成功的健康檢查不留存取紀錄                       | issue #567 §驗收條件 1；clarification Q1               | `L:probe` 帶 `acc-health200` 的 `GET /api/v1/health` → `200`，`grep -c acc-health200` = 0；同一 app 隨後 `POST /api/v1/health`（`acc-405b`）→ 一行存取紀錄（E9）。`L:real`、`L:empty`、`L:debug-pg` 的 health `200` 也都沒有 `app.access` 行。`T` `::test_successful_health_check_writes_no_access_line`                                                                                           | 通過 |
| 預檢與 /api/v1 以外的請求不留存取紀錄            | issue #567 §功能範圍；ADR-003 D5；clarification Q4、Q6 | `L:probe`（`API_DOCS_ENABLED` 預設 true）：允許來源的 `OPTIONS /api/v1/health` 預檢 → `200`、`GET /docs` → `200`、`GET /openapi.json`、`GET /no-such-path` → `404`；`grep -cE 'acc-preflight\|acc-docs\|acc-openapi\|acc-nopath'` = 0。`T` `::test_preflight_and_paths_outside_api_v1_write_no_access_line`                                                                                        | 通過 |
| 存取紀錄不含查詢字串、body、標頭與 cookie        | issue #567 §驗收條件 4；S5、S9；Hard Rule 6            | `L:probe` `POST /api/v1/probe?q=CANARY-query`，帶 `Cookie: session=CANARY-cookie`、`Authorization: Bearer CANARY-auth`、`X-Custom: CANARY-header`、body `{"displayName": "CANARY-body"}` → `200`；整份輸出 `grep -c CANARY` = 0，存取行（E10）不含 `127.0.0.1`（`grep 'logger=app.access' \| grep -c 127.0.0.1` = 0）。`T` `::test_log_output_has_no_query_body_headers_cookies_or_client_address` | 通過 |
| 存取紀錄不含路徑參數的實際值                     | issue #567 §驗收條件 4；Hard Rule 6                    | `L:probe` `GET /api/v1/items/CANARY-answer` → `200`，`route=/api/v1/items/{item_id}`（E11），整份輸出 `CANARY` 0 次。`T` `::test_path_parameter_value_never_reaches_the_log`                                                                                                                                                                                                                       | 通過 |
| 業務程式的紀錄不改呼叫方式就帶上追蹤編號         | issue #567 §驗收條件 3；clarification Q8               | `L:down` 帶 `X-Correlation-ID: client-trace-0002`：WARNING 行 `traceId=client-trace-0002`，訊息 `Database unavailable: builtins.ConnectionRefusedError` 不含 `traceId=` 與 `client-trace-0002`，該行 `traceId=` 恰 1 次（E8）。`T` `test_access_log.py::test_unreachable_database_leaves_one_warning_record_with_the_trace_id`                                                                     | 通過 |
| 第三方套件的紀錄也帶追蹤編號                     | issue #567 §驗收條件 3；clarification N1               | `L:probe` 帶 `client-trace-0003` 打 `GET /api/v1/probe-third-party-log`：`logger=thirdparty.lib traceId=client-trace-0003`（E12）。`T` `::test_third_party_record_carries_the_trace_id`                                                                                                                                                                                                            | 通過 |
| 請求以外寫的紀錄帶固定標記                       | issue #567 §驗收條件 3；clarification Q7               | `L:probe` 組裝時寫的兩筆 WARNING 與 uvicorn 啟動／關閉的 INFO 都是 `traceId=-`（E13）；所有 `L:*` 執行的啟動與關閉行都是 `traceId=-`，沒有 UUID。`T` `test_log_config.py::test_records_written_outside_a_request_carry_the_fixed_marker`                                                                                                                                                           | 通過 |
| 每一筆紀錄輸出為一行 key=value                   | issue #567 §功能範圍；S9；clarification Q2             | E1 以 spec 的正規式 `grep -E` 命中（指令見下方 E1）。`T` `::test_access_line_matches_the_full_key_value_layout`                                                                                                                                                                                                                                                                                    | 通過 |
| 訊息含換行時仍輸出一行                           | issue #567 §功能範圍；S9                               | E6：多行堆疊在同一行內以 `\n` 出現；整份 `L:probe` 輸出 25 行、沒有不以 `timestamp=` 開頭的行。`T` `::test_message_with_newlines_is_still_one_line`                                                                                                                                                                                                                                                | 通過 |
| 第三方紀錄帶例外資訊時只寫例外型別               | issue #567 §功能範圍；S9                               | `L:probe` `/acc-exc`：`logger=thirdparty.lib … excType=builtins.ValueError msg=third party saw an error`，一行，不含 `CANARY-exc` 與 `Traceback`（E14）。`T` `test_log_config.py::test_exception_info_is_written_as_its_type_only`                                                                                                                                                                 | 通過 |
| 伺服器程式內建的存取紀錄已關閉                   | issue #567 §驗收條件 4；S9；clarification Q10          | `L:real`（不帶 `--no-access-log`）`GET /api/v1/health?q=CANARY-query` → `200`；輸出 8 行全是 `uvicorn.error` 的啟動／關閉，`grep -c 'CANARY\|"GET\|SELECT'` = 0（E15）。`L:image` 走映像檔 `CMD` 同樣沒有內建存取行。`T` `test_access_log.py::test_uvicorn_built_in_access_log_is_off`（子行程）                                                                                                   | 通過 |
| LOG_LEVEL 設為 WARNING 時不輸出 INFO 紀錄        | issue #567 §功能範圍；clarification Q12                | `L:warn` 兩次：`items/42`（200）、`no-such-resource`（404）、`acc-levels`（寫 INFO）；`level=INFO` 0 行，只有 404 那一行 `level=WARNING` 存取紀錄（E16）。`L:image` 以 `LOG_LEVEL=WARNING` 的容器輸出也只有 404 那一行。`T` `::test_warning_log_level_drops_info_records_and_keeps_warnings`                                                                                                       | 通過 |
| 資料庫引擎的紀錄維持 WARNING                     | issue #567 §功能範圍；S9；clarification Q12            | `L:real` 未設與 `L:debug` 設 `DEBUG`（Lite）各打 health：`grep -ciE 'SELECT\|sqlalchemy\|aiosqlite\|pool\|PRAGMA\|BEGIN\|COMMIT\|ROLLBACK'` = 0；同一 `DEBUG` 設定下自寫的 DEBUG 紀錄**有**輸出（E17），證明 `DEBUG` 確實生效、只有資料庫 logger 被壓住。`L:debug-pg` 對 `SELECT\|sqlalchemy\|asyncpg` 也是 0。`T` `test_app_assembly.py::test_lite_health_check_writes_no_database_records`       | 通過 |

#### runtime-config

| Scenario                              | 對應的規格書驗收標準                              | 證據                                                                                                                                                                                                                                                                          | 結果 |
| :------------------------------------ | :------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 只設允許來源即可啟動                  | ADR-003 D7；B10（本 change 未改其內容，回歸驗證） | `L:empty`：health `200`、`/docs` `200`，`data/label_suite.db` 已建立                                                                                                                                                                                                          | 通過 |
| API_DOCS_ENABLED 不是布林值時啟動失敗 | issue #592（回歸驗證）                            | `L:start` `API_DOCS_ENABLED=CANARY-maybe`：exit 1，`ConfigError: API_DOCS_ENABLED: Input should be a valid boolean, unable to interpret input`，`CANARY` 0 次                                                                                                                 | 通過 |
| LOG_LEVEL 未設時輸出等級為 INFO       | issue #567；clarification Q12                     | `L:probe`（未設）`/acc-levels`：有 `level=INFO … msg=ACC-info-record`，`grep -c ACC-debug` = 0（E18）。`T` `test_app_assembly.py::test_info_is_written_and_debug_is_not_when_log_level_is_unset`                                                                              | 通過 |
| LOG_LEVEL 不分大小寫                  | issue #567；clarification Q12                     | `L:warn` 的 `warning` 與 `WARNING` 都啟動成功，輸出相同、`level=INFO` 都是 0 行（E16）。`T` `::test_warning_log_level_drops_info_whatever_its_case`、`test_config.py`                                                                                                         | 通過 |
| LOG_LEVEL 不合法時啟動失敗            | issue #567；S9；clarification Q12                 | `L:start` `LOG_LEVEL=CANARY-verbose`：exit 1，`app.core.config.ConfigError: LOG_LEVEL: Input should be 'DEBUG', 'INFO', 'WARNING', 'ERROR' or 'CRITICAL'`，`CANARY` 0 次。`T` `::test_invalid_log_level_fails_before_logging_is_configured`                                   | 通過 |
| 編排檔把 LOG_LEVEL 傳進後端容器       | issue #567；ADR-008 D4；clarification Q12、Q14    | `C:compose`（正式層加 `POSTGRES_PASSWORD`）：`.env.example` 原樣 → 兩份 `LOG_LEVEL` 都是 `INFO`；`.env.example` 加 `LOG_LEVEL=WARNING` → 兩份都是 `WARNING`（E19）。後端 `environment` 其餘鍵與 main 相同（diff 每份只多 2 行），兩份都沒有 `env_file`。CI `compose` job 綠燈 | 通過 |

#### 沿用的既有 Scenario（design D9）

| Scenario                                                 | 證據                                                                                                                                                                                                                                                  | 結果 |
| :------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| api-envelope「未處理例外的紀錄含追蹤編號且不含請求內容」 | `L:probe` 帶 `Cookie: session=CANARY-cookie` 打 `GET /api/v1/probe-crash?q=CANARY-query` → `500`、`traceId=acc-envcanary`；一筆 `ERROR`，含 `traceId=acc-envcanary` 與 `/api/v1/probe-crash`，`CANARY` 0 次。`T` `test_localization_and_unhandled.py` | 通過 |

#### 原始證據行

```text
E1  timestamp=2026-11-25T07:37:53.243Z level=INFO logger=app.access traceId=client-trace-0001 method=GET route=/api/v1/items/{item_id} status=200 durationMs=1.1 msg=request completed
    （grep -E '^timestamp=[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z level=INFO logger=app\.access traceId=[^ ]+ method=GET route=/api/v1/items/\{item_id\} status=200 durationMs=[0-9]+\.[0-9] msg=.+$' 命中此行）
E2  timestamp=2026-11-25T07:37:53.255Z level=WARNING logger=app.access traceId=1006ba02-ebc6-432c-a8da-807e10fdc083 method=POST route=/api/v1/health status=405 durationMs=0.4 msg=request completed
E3  timestamp=2026-11-25T07:37:53.269Z level=WARNING logger=app.access traceId=a9ef131f-2877-431c-a2d6-4fedb8e5bcf0 method=GET route=<unmatched> status=404 durationMs=0.3 msg=request completed
    timestamp=2026-11-25T07:37:53.281Z level=WARNING logger=app.access traceId=ecb84e37-7b26-4726-8528-321809625666 method=GET route=<unmatched> status=406 durationMs=0.2 msg=request completed
E4  timestamp=2026-11-25T07:37:53.293Z level=WARNING logger=app.access traceId=7e55b1f3-4b79-4b2e-bbcd-7dbf252733a6 method=POST route=/api/v1/probe status=422 durationMs=0.9 msg=request completed
E5  timestamp=2026-11-25T07:37:53.303Z level=ERROR logger=app.access traceId=09c44509-c6af-42c7-8fba-2981eaca04bf method=GET route=/api/v1/probe-bad-gateway status=502 durationMs=0.3 msg=request completed
E6  timestamp=2026-11-25T07:37:53.316Z level=ERROR logger=app.core.middleware traceId=acc-crash msg=Unhandled exception GET /api/v1/probe-crash\nTraceback (most recent call last):\n  File ".../app/core/middleware.py", line 185, in __call__\n … \n    raise RuntimeError(CRASH_MESSAGE)\nbuiltins.RuntimeError
E7  timestamp=2026-11-25T07:37:53.327Z level=ERROR logger=app.core.errors traceId=cba801c3-441e-4bda-94c7-85aebc15d26f msg=HTTPException with unmapped status 418 GET /api/v1/probe-teapot
E8  timestamp=2026-11-25T07:39:17.745Z level=WARNING logger=app.modules.health.service traceId=client-trace-0002 msg=Database unavailable: builtins.ConnectionRefusedError
E9  timestamp=2026-11-25T07:37:53.349Z level=WARNING logger=app.access traceId=acc-405b method=POST route=/api/v1/health status=405 durationMs=0.2 msg=request completed
E10 timestamp=2026-11-25T07:37:53.410Z level=INFO logger=app.access traceId=acc-canary method=POST route=/api/v1/probe status=200 durationMs=0.3 msg=request completed
E11 timestamp=2026-11-25T07:37:53.420Z level=INFO logger=app.access traceId=acc-answer method=GET route=/api/v1/items/{item_id} status=200 durationMs=0.2 msg=request completed
E12 timestamp=2026-11-25T07:37:53.429Z level=WARNING logger=thirdparty.lib traceId=client-trace-0003 msg=third-party library warning
E13 timestamp=2026-11-25T07:37:42.448Z level=WARNING logger=app.acceptance traceId=- msg=outside request one
    timestamp=2026-11-25T07:37:42.448Z level=WARNING logger=thirdparty.boot traceId=- msg=outside request two
    timestamp=2026-11-25T07:37:42.448Z level=INFO logger=uvicorn.error traceId=- msg=Started server process [62862]
E14 timestamp=2026-11-25T07:37:53.449Z level=WARNING logger=thirdparty.lib traceId=58fedf0c-e9ef-47fd-a123-0f3745aac8ab excType=builtins.ValueError msg=third party saw an error
E15 （L:real 全部輸出，請求是 GET /api/v1/health?q=CANARY-query）
    timestamp=2026-11-25T07:38:35.465Z level=INFO logger=uvicorn.error traceId=- msg=Started server process [63224]
    timestamp=2026-11-25T07:38:35.465Z level=INFO logger=uvicorn.error traceId=- msg=Waiting for application startup.
    timestamp=2026-11-25T07:38:35.479Z level=INFO logger=uvicorn.error traceId=- msg=Application startup complete.
    timestamp=2026-11-25T07:38:35.482Z level=INFO logger=uvicorn.error traceId=- msg=Uvicorn running on http://127.0.0.1:18567 (Press CTRL+C to quit)
    timestamp=2026-11-25T07:38:35.891Z level=INFO logger=uvicorn.error traceId=- msg=Shutting down
    timestamp=2026-11-25T07:38:35.994Z level=INFO logger=uvicorn.error traceId=- msg=Waiting for application shutdown.
    timestamp=2026-11-25T07:38:35.995Z level=INFO logger=uvicorn.error traceId=- msg=Application shutdown complete.
    timestamp=2026-11-25T07:38:35.995Z level=INFO logger=uvicorn.error traceId=- msg=Finished server process [63224]
E16 （L:warn，WARNING 與 warning 兩次輸出相同）
    timestamp=2026-11-25T07:38:57.943Z level=WARNING logger=app.acceptance traceId=- msg=outside request one
    timestamp=2026-11-25T07:38:57.943Z level=WARNING logger=thirdparty.boot traceId=- msg=outside request two
    timestamp=2026-11-25T07:38:58.544Z level=WARNING logger=app.access traceId=acc-warn-404 method=GET route=<unmatched> status=404 durationMs=0.2 msg=request completed
E17 （L:debug 的 L:probe，LOG_LEVEL=DEBUG）
    timestamp=2026-11-25T07:38:51.125Z level=INFO logger=app.acceptance traceId=acc-debug-levels msg=ACC-info-record
    timestamp=2026-11-25T07:38:51.125Z level=DEBUG logger=app.acceptance traceId=acc-debug-levels msg=ACC-debug-record
    timestamp=2026-11-25T07:38:51.126Z level=INFO logger=app.access traceId=acc-debug-levels method=GET route=/api/v1/acc-levels status=200 durationMs=1.2 msg=request completed
E18 timestamp=2026-11-25T07:37:53.440Z level=INFO logger=app.acceptance traceId=acc-levels msg=ACC-info-record
    timestamp=2026-11-25T07:37:53.440Z level=INFO logger=app.access traceId=acc-levels method=GET route=/api/v1/acc-levels status=200 durationMs=0.6 msg=request completed
E19 docker-compose.yml       .env.example: INFO     ['CORS_ALLOWED_ORIGINS', 'CORS_ALLOW_CREDENTIALS', 'LOG_LEVEL', 'SQLITE_PATH']
    docker-compose.yml       +WARNING:     WARNING  ['CORS_ALLOWED_ORIGINS', 'CORS_ALLOW_CREDENTIALS', 'LOG_LEVEL', 'SQLITE_PATH']
    docker-compose.prod.yml  .env.example: INFO     ['API_DOCS_ENABLED', 'CORS_ALLOWED_ORIGINS', 'CORS_ALLOW_CREDENTIALS', 'DATABASE_URL', 'LOG_LEVEL']
    docker-compose.prod.yml  +WARNING:     WARNING  ['API_DOCS_ENABLED', 'CORS_ALLOWED_ORIGINS', 'CORS_ALLOW_CREDENTIALS', 'DATABASE_URL', 'LOG_LEVEL']
```

#### spec 沒描述、實作出現的行為（觀察，不是缺陷）

1. 未處理例外那一筆 ERROR 的訊息含只有型別的 traceback（E6），堆疊裡有原始碼檔的**絕對路徑**與原始碼行。這是 backend-skeleton 以來 `UnhandledExceptionMiddleware` 的既有寫法（api-envelope），本 change 只拿掉 `traceId=%s` 並改成一行；spec「訊息含換行時仍輸出一行」正是描述這一筆。原始碼行會進紀錄，代表「把值寫在 `raise` 那一行」的程式碼會把值帶進紀錄——`tests/probe.py` 的 `db_error_probe` 已刻意把值放在 `raise` 行之外。不在本 change 範圍。
2. `X-Correlation-ID` 少於 8 字元會被丟棄、改用伺服器產生的 UUID（既有 api-envelope 規則），手動驗收時要用 8 字元以上的值才看得到自己的編號。

### Decision Table

本專案尚無認證與任務成員身分，系統角色一欄全部是「匿名」；動作就是 HTTP 請求。

| #   | 呼叫端 | 請求                                          | 資料狀態／設定                      | 輸入                        | 預期                                                    | 結果 | 驗證方式         |
| :-- | :----- | :-------------------------------------------- | :---------------------------------- | :-------------------------- | :------------------------------------------------------ | :--- | :--------------- |
| 1   | 匿名   | `GET /api/v1/items/{id}`                      | 預設                                | 有效 `id=42`、有效 corr id  | 1 行 INFO，模板、traceId 同 corr id                     | 符合 | `L:probe` + `T`  |
| 2   | 匿名   | `GET /api/v1/items/{id}`                      | 預設                                | `id=CANARY-answer`          | 模板，不含實際值                                        | 符合 | `L:probe` + `T`  |
| 3   | 匿名   | `POST /api/v1/health`                         | 預設                                | 不支援的方法                | 1 行 WARNING `route=/api/v1/health status=405`          | 符合 | `L:probe` + `T`  |
| 4   | 匿名   | `GET /api/v1/no-such-resource`                | 預設                                | 不存在路徑（含 query）      | 1 行 WARNING `<unmatched>` 404，不含路徑與 query        | 符合 | `L:probe` + `T`  |
| 5   | 匿名   | `GET /api/v1/health`                          | 預設                                | `Accept-Language: fr`       | 1 行 WARNING `<unmatched>` 406                          | 符合 | `L:probe` + `T`  |
| 6   | 匿名   | `POST /api/v1/probe`                          | 預設                                | body `{}`（缺值）           | 1 行 WARNING 422                                        | 符合 | `L:probe` + `T`  |
| 7   | 匿名   | `POST /api/v1/probe?q=…`                      | 預設                                | 有效 body、各種 CANARY 標頭 | 1 行 INFO 200；全輸出無 CANARY、無來源 IP               | 符合 | `L:probe` + `T`  |
| 8   | 匿名   | 領域錯誤 502                                  | 處理中未記錯                        | —                           | 1 行 ERROR 存取紀錄                                     | 符合 | `L:probe` + `T`  |
| 9   | 匿名   | 未處理例外                                    | —                                   | 例外訊息含 CANARY           | 1 筆 ERROR（middleware），無存取行，無例外訊息          | 符合 | `L:probe` + `T`  |
| 10  | 匿名   | `HTTPException(418)`                          | —                                   | 未對應狀態                  | 500；1 筆 ERROR（errors），無存取行                     | 符合 | `L:probe` + `T`  |
| 11  | 匿名   | `GET /api/v1/health`                          | 資料庫可連（SQLite／PG）            | —                           | 200，無存取行                                           | 符合 | `L:*` + `T`      |
| 12  | 匿名   | `GET /api/v1/health`                          | 資料庫無法連線                      | corr id `client-trace-0002` | 503；1 筆 WARNING 帶該 traceId，無存取行                | 符合 | `L:down` + `T`   |
| 13  | 匿名   | `OPTIONS /api/v1/health` 預檢                 | 允許來源                            | —                           | 無存取行                                                | 符合 | `L:probe` + `T`  |
| 14  | 匿名   | `GET /docs`、`/openapi.json`、`/no-such-path` | `API_DOCS_ENABLED` 預設             | —                           | 無存取行                                                | 符合 | `L:probe` + `T`  |
| 15  | 匿名   | 第三方 logger WARNING                         | 請求中                              | —                           | 帶該請求 traceId                                        | 符合 | `L:probe` + `T`  |
| 16  | 匿名   | 第三方 logger `exc_info`                      | 請求中                              | `ValueError("CANARY-exc")`  | 一行，`excType=builtins.ValueError`，無訊息與 Traceback | 符合 | `L:probe` + `T`  |
| 17  | —      | 啟動／關閉、組裝時的紀錄                      | 請求外                              | —                           | `traceId=-`                                             | 符合 | `L:*` + `T`      |
| 18  | 匿名   | 混合請求                                      | `LOG_LEVEL` 未設                    | —                           | INFO 有、DEBUG 無                                       | 符合 | `L:probe` + `T`  |
| 19  | 匿名   | 混合請求                                      | `LOG_LEVEL=WARNING`／`warning`      | 邊界：大小寫                | 無 INFO；404 有 WARNING                                 | 符合 | `L:warn` + `T`   |
| 20  | 匿名   | `GET /api/v1/health`                          | `LOG_LEVEL=DEBUG`（Lite／PG）       | —                           | 無 SQL、無資料庫 logger；自寫 DEBUG 有輸出              | 符合 | `L:debug` + `T`  |
| 21  | —      | 啟動                                          | `LOG_LEVEL=CANARY-verbose`          | 無效值                      | exit 1，訊息有 `LOG_LEVEL`、無設定值                    | 符合 | `L:start` + `T`  |
| 22  | —      | 啟動                                          | `API_DOCS_ENABLED=CANARY-maybe`     | 無效值                      | exit 1，訊息有名稱、無設定值                            | 符合 | `L:start` + `T`  |
| 23  | —      | 啟動                                          | 只設 `CORS_ALLOWED_ORIGINS`、空目錄 | 缺值（其餘全不設）          | 啟動成功、建立 `data/label_suite.db`                    | 符合 | `L:empty` + `T`  |
| 24  | —      | `docker compose config`（兩層）               | `.env` 未設／設 `WARNING`           | 缺值／有效值                | `INFO`／`WARNING`                                       | 符合 | `C:compose` + CI |
| 25  | —      | 映像檔 `CMD` 啟動                             | `LOG_LEVEL=WARNING`                 | query 含 CANARY             | 只有 404 一行 WARNING；無內建存取行                     | 符合 | `L:image`        |

### Hard Rule 必驗項

| 規則               | 怎麼驗的                                                                                                                                                                                                                                                                                                                      | 結果 |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 5 任務設定驅動     | 本 change 只動 `app/core/` 基礎建設、health 模組的一行紀錄與編排檔，沒有任務類型的分支或欄位；`lint-imports` 的「Core does not depend on modules」KEPT。存取紀錄只依路由模板與狀態碼運作，對任何端點都一樣（以 health、probe、items 三種不同路由驗過）。目前沒有任務類型可換 `input_type` 加 `outputs[]` 的組合，該檢查不適用 | 通過 |
| 6 測試集答案不外露 | 尚無標記員身分與任務端點；以標記員能送出內容的三條管道驗紀錄不外流：路徑參數（`CANARY-answer`）、query、body、標頭、cookie 全以 CANARY 送進真實 uvicorn，整份伺服器輸出 0 次命中；回應 body 與錯誤回應也不含（422 錯誤只列欄位名與原因）。紀錄只寫在伺服器端，沒有任何 API 讀得到                                             | 通過 |

### DoD

| 項目                                                  | 指令與結果                                                                                                                                                                                           | 結果   |
| :---------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 每個 Scenario 驗證通過                                | 上表 server-logging 21 條、runtime-config 6 條、沿用 1 條，全部通過                                                                                                                                  | 通過   |
| Decision Table 都有對應驗證                           | 25 列，全部以真實行程或 `docker compose config` 驗過，並有自動化測試                                                                                                                                 | 通過   |
| `uv run ruff check .`                                 | `All checks passed!`                                                                                                                                                                                 | 通過   |
| `uv run ruff format --check .`                        | `52 files already formatted`                                                                                                                                                                         | 通過   |
| `uv run mypy app`                                     | `Success: no issues found in 22 source files`                                                                                                                                                        | 通過   |
| `uv run lint-imports`                                 | `Contracts: 4 kept, 0 broken.`（含 `Core does not depend on modules KEPT`）                                                                                                                          | 通過   |
| `uv run pytest -q`（SQLite）                          | `439 passed, 4 skipped`；skip 的 4 條都是 `needs TEST_DATABASE_URL (PostgreSQL)`                                                                                                                     | 通過   |
| `TEST_DATABASE_URL=… uv run pytest -q`（PostgreSQL）  | `postgres:16` 暫時容器：`443 passed`，0 skipped                                                                                                                                                      | 通過   |
| Alembic `upgrade`→`downgrade`→`upgrade`（SQLite）     | `upgrade head`、`downgrade base`、`upgrade head` 皆 exit 0，`alembic current` = `0dfb129ee036 (head)`（本 change 無 schema 變更）                                                                    | 通過   |
| Alembic `upgrade`→`downgrade`→`upgrade`（PostgreSQL） | 同上，以 `DATABASE_URL` 指向暫時容器，皆 exit 0，`0dfb129ee036 (head)`                                                                                                                               | 通過   |
| 後端可 build 並啟動                                   | `L:*` 各次啟動成功；`docker build backend` 成功並以映像檔 `CMD` 啟動（`L:image`）                                                                                                                    | 通過   |
| 前端 build、元件與 hook 測試、根目錄 `e2e/`           | 本 change 未動前端；CI `frontend`、`e2e` job 綠燈                                                                                                                                                    | 不適用 |
| 重新匯出 `openapi.json` 無差異                        | `uv run python -m app.scripts.export_openapi` 後 `git status --short` 空；`openapi.json` 中 probe／items 0 次；與 `api-contract.md`「無異動」一致                                                    | 通過   |
| `pnpm check:specs`                                    | `check-specs: docs OK`                                                                                                                                                                               | 通過   |
| Prettier                                              | 改到的 docs、`.notecraft` 元件、change 目錄、兩份編排檔：`All matched files use Prettier code style!`                                                                                                | 通過   |
| `openspec validate request-access-log --strict`       | `Change 'request-access-log' is valid`                                                                                                                                                               | 通過   |
| 文件站建置                                            | 依 tasks.md 不在 worktree 執行 NoteCraft build；CI `docs-site` job 綠燈                                                                                                                              | 通過   |
| `pnpm test:scripts`                                   | 本 change 未動 `scripts/`；CI `scripts-tests` job 綠燈                                                                                                                                               | 通過   |
| PR #657 CI                                            | 15 個 job（api-contract、backend-postgres、backend-sqlite、changes、commit-messages、compose、coverage、dependency-audit、docs-site、e2e、format、frontend、scripts-tests、semgrep、specs）全部 pass | 通過   |
| 文件同步                                              | `backend-modules.mdx` §已知限制 已刪 #567 那一列、加回應已開始後出錯的那一列；`grep -rn "traceId=%s" backend/app` 無輸出；`.env.example` 的 `LOG_LEVEL` 註解與編排檔一致                             | 通過   |

### 人工驗收步驟（留作紀錄）

本 change 沒有畫面，不需要啟動前端，也不需要登入任何角色。

1. **啟動**（Lite 層，**不設** `DATABASE_URL`）：

   ```bash
   cd backend
   uv sync
   CORS_ALLOWED_ORIGINS=http://localhost:5173 SQLITE_PATH=/tmp/acc-567.db \
     uv run uvicorn app.main:create_app --factory --port 8000 2>&1 | tee /tmp/acc-567.log
   ```

   後端在 `http://127.0.0.1:8000`（沒有前端）。啟動後終端機先出現四行 `logger=uvicorn.error traceId=-` 的啟動紀錄，格式是 `timestamp=…Z level=INFO logger=… traceId=- msg=…`。

2. **用什麼身分登入**：不登入，專案還沒有認證；所有請求都是匿名 `curl`。

3. **要打哪些請求**（另開一個終端機）：

   ```bash
   curl -s http://127.0.0.1:8000/api/v1/health
   curl -s -i -H 'X-Correlation-ID: manual-check-0001' 'http://127.0.0.1:8000/api/v1/no-such-resource?q=CANARY'
   curl -s -X POST http://127.0.0.1:8000/api/v1/health
   ```

4. **每一步預期看到什麼**：
   - `GET /api/v1/health` 回 `200`，伺服器輸出**沒有**新增任何一行（成功的健康檢查不記）。
   - `no-such-resource` 回 `404`、標頭 `x-correlation-id: manual-check-0001`；伺服器多一行 `level=WARNING logger=app.access traceId=manual-check-0001 method=GET route=<unmatched> status=404 durationMs=<數字.一位> msg=request completed`，整行**不含** `CANARY` 與 `no-such-resource`。
   - `POST /api/v1/health` 回 `405`；多一行 `level=WARNING logger=app.access … method=POST route=/api/v1/health status=405 …`。
   - `grep 'traceId=manual-check-0001' /tmp/acc-567.log` 只找到上面那一行。
   - 整份輸出沒有 uvicorn 內建格式的行（例如 `127.0.0.1:xxxxx - "GET /api/v1/health HTTP/1.1" 200`），也沒有 `SELECT`。
   - 自訂的 `X-Correlation-ID` 必須 8 到 64 個英數或 `-`，太短會被換成伺服器產生的 UUID。

5. **刻意要試的失敗路徑**：
   - 停掉服務，以 `LOG_LEVEL=WARNING` 重新啟動、再打第 3 步：輸出沒有任何 `level=INFO` 的行（連 uvicorn 的啟動行都沒有），只有 `404` 與 `405` 兩行 WARNING。`LOG_LEVEL=warning`（小寫）結果相同。
   - 以 `LOG_LEVEL=verbose` 啟動：行程立刻以非零狀態結束，最後一行是 `app.core.config.ConfigError: LOG_LEVEL: Input should be 'DEBUG', 'INFO', 'WARNING', 'ERROR' or 'CRITICAL'`，**不含** `verbose`。
   - 以 `LOG_LEVEL=DEBUG` 啟動再打 health：仍然沒有 `SELECT 1`、沒有 `sqlalchemy`／`aiosqlite` 的紀錄。
   - 以 `DATABASE_URL=postgresql://x:y@127.0.0.1:5999/x`（沒有人監聽的埠）啟動，帶 `X-Correlation-ID: manual-check-0002` 打 health：回 `503 DATABASE_UNAVAILABLE`，輸出只有一行 `level=WARNING logger=app.modules.health.service traceId=manual-check-0002 msg=Database unavailable: builtins.ConnectionRefusedError`，**沒有** `app.access` 行。
   - 容器路徑（選做）：`.env.example` 複製成 `.env` 並加 `LOG_LEVEL=WARNING`，執行 `docker compose --env-file .env config | grep LOG_LEVEL` 應看到 `LOG_LEVEL: WARNING`；`docker compose -f docker-compose.prod.yml` 同樣（另需 `POSTGRES_PASSWORD`）。要真的 `docker compose up --build --wait` 時，`docker compose logs backend` 應沒有 `level=INFO` 的行。注意 Lite 層的 project name 固定為 `label-suite`，會重用本機同名的 volume 與 `label-suite-backend:latest` 映像檔。

6. **收尾**：`Ctrl+C` 停掉 uvicorn；`rm -f /tmp/acc-567.db /tmp/acc-567.log`；若跑過 compose，`docker compose down`（加 `-v` 會刪掉 Lite 層資料 volume，只在確定不需要時才加）並刪掉自建的 `.env`。

### 缺陷

無。
