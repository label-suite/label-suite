## 驗收：backend-skeleton

結論：**通過**

驗收日期 2026-11-20，對象為分支 `feat/backend-skeleton` 的 `346a883`（含 code review 後的三個修正 commit `5bb389e`、`76ffac3`、`f26c2d0`）。驗收者 `acceptance-verifier`，結論依維護者 2026-11-19 裁定即為驗收結論。

### 範圍與不適用項目

- 本 change 只有後端。`frontend/` 與 `e2e/` 都不存在，所以**Playwright E2E、畫面的 loading／error／empty／無權限四種狀態、cookie 與 storage 檢查、bundle 檢查都不適用**；`ui-design.md` 也寫明本次無 UI 變更。沒有虛構任何畫面。
- 本 change 沒有認證。所有呼叫端都是匿名呼叫端；「各角色」、「登入狀態已失效」、「遮蔽欄位」、「看不到的資源回 404」都沒有可驗的對象。`GET /api/v1/health` 依 spec 刻意公開，已驗證不帶憑證可呼叫。
- 本 change 沒有 `docs/specs/` 規格頁（proposal、system-analysis 引 spec-migration §決議 D4：foundation 屬技術規範）。Scenario 的來源是 ADR 與規則條號，唯一引用的業務規則是 `docs/specs/07-shared/01-sidebar.mdx` §卡控機制「系統要向使用者顯示錯誤」，對應到 `500` 不露內部細節的兩個 Scenario。下表「對應的規格書驗收標準」一欄因此填 spec 的 `來源：` 條號。

### 證據來源代號

| 代號         | 內容                                                                                                                                                                                                                       |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `T:sqlite`   | `cd backend && uv run pytest --cov=app --cov-report=term-missing -rs -v`，不設 `TEST_DATABASE_URL`：**300 passed, 4 skipped**                                                                                              |
| `T:pg`       | 同一指令加 `TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:55432/postgres`（`postgres:16` 暫時容器）：**304 passed, 0 skipped**                                                                        |
| `L:lite`     | 真實 uvicorn，`CORS_ALLOWED_ORIGINS=http://localhost:5173 SQLITE_PATH=<暫存>/acc.db uv run uvicorn app.main:create_app --factory --port 18504`，以 `curl` 呼叫                                                             |
| `L:probe`    | 真實 uvicorn（port 18505）跑正式的 `create_app()`，再把只在 `tests/probe.py` 的探測 router 掛到 `/api/v1`（與 `tests/conftest.py` 的 `app` fixture 同一組裝方式），用來以真實 HTTP 打 `422` 與 `500`；組裝腳本只放在暫存區 |
| `L:pg`       | 真實 uvicorn（port 18506）以 `DATABASE_URL` 指向上述容器，`postgresql://`、`postgresql+asyncpg://`、`postgres://` 三種寫法各起一次                                                                                         |
| `L:down`     | 真實 uvicorn（port 18507）以 `DATABASE_URL` 指向關閉的本機埠 55499，以及一個只 accept、不回任何位元組的本機 TCP 伺服器（port 55433）                                                                                       |
| `L:start`    | 真實 uvicorn（port 18508）以各種不合法設定啟動，記錄結束狀態與 stderr                                                                                                                                                      |
| `L:emptycwd` | 真實 uvicorn（port 18509）在一個空目錄啟動，只設 `CORS_ALLOWED_ORIGINS`                                                                                                                                                    |
| `CLI`        | 直接執行的指令（`alembic`、`export_openapi`）                                                                                                                                                                              |

測試名稱以 `檔名::函式` 簡寫，檔案都在 `backend/tests/`。

### Scenario 結果

共 76 個 Scenario，全部 **PASS**（原 75 個，加上補驗新增的 1 個，見文末〈補驗〉）。

#### api-envelope（21，新增的 1 個見〈補驗〉）

| Scenario                                 | 對應的規格書驗收標準 | 證據                                                                                                                                                                                                                                                                                                                                                            | 結果 |
| :--------------------------------------- | :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 成功回應包含六個外層欄位                 | ADR-003 D5、A1       | `integration/test_health.py::test_health_returns_the_full_success_envelope`；`L:lite` `GET /api/v1/health` → `200`，頂層恰為 `success,code,message,data,timestamp,traceId`                                                                                                                                                                                      | PASS |
| 外層時間為 UTC 毫秒格式                  | A1                   | `integration/test_app_assembly.py::test_envelope_timestamp_is_utc_with_milliseconds`、`unit/test_envelope.py::test_error_response_timestamp_is_utc_with_milliseconds`；`L:lite` 成功與 404 的 `timestamp` 例 `2026-11-20T06:04:59.738Z`，與 `date` 標頭同秒                                                                                                     | PASS |
| 非驗證錯誤的 errors 為 null              | A7、ADR-003 D5       | `integration/test_app_assembly.py::test_unknown_path_returns_a_not_found_envelope_with_null_errors`；`L:lite` `GET /api/v1/no-such-resource` → 七個鍵，`errors:null`、`data:null`                                                                                                                                                                               | PASS |
| 通用錯誤碼與 HTTP 狀態對應               | A7                   | `integration/test_localization_and_unhandled.py::test_generic_error_codes_map_to_http_statuses`；真實 HTTP 六種全打過：404／`NOT_FOUND`、405／`METHOD_NOT_ALLOWED`、406／`NOT_ACCEPTABLE`（`L:lite`），422／`VALIDATION_FAILED`、500／`INTERNAL_ERROR`（`L:probe`），503／`DATABASE_UNAVAILABLE`（`L:down`）                                                    | PASS |
| 請求驗證失敗回 422 外層與逐欄位錯誤      | A2、A7               | `integration/test_app_assembly.py::test_missing_body_field_returns_a_422_envelope_with_field_errors`；`L:probe` `POST /api/v1/probe` `{}` → `errors:[{"location":"body","field":"displayName","code":"missing","message":"Field required"}]`                                                                                                                    | PASS |
| 未宣告的 body 欄位被拒收                 | A2                   | `...::test_undeclared_body_field_is_rejected`；`L:probe` → `field:"nickName"`、`code:"extra_forbidden"`                                                                                                                                                                                                                                                         | PASS |
| 底線命名的 body 欄位被拒收               | A2、#503 裁定 3      | `...::test_snake_case_body_field_is_rejected`；`L:probe` `{"display_name":"A"}` → `displayName` `missing` 與 `display_name` `extra_forbidden` 兩筆                                                                                                                                                                                                              | PASS |
| 無法解析的 JSON 回 422                   | A7                   | `...::test_unparseable_json_returns_a_422_envelope`；`L:probe` body `{"displayName":` → `422`、`location:"body"`（`field` 值見缺陷 1）                                                                                                                                                                                                                          | PASS |
| 驗證錯誤不回顯送出的值                   | A7、Hard Rule 6      | `...::test_validation_errors_do_not_echo_submitted_values`、`unit/test_envelope.py::test_validation_details_have_exactly_four_keys_and_no_submitted_values`；`L:probe` 送 `{"displayName":12345,"secretAnswer":"CANARY-7f3a"}`，回應不含 `CANARY-7f3a`、`12345`，每筆只有四個鍵                                                                                 | PASS |
| 不存在的路徑回 404 外層                  | A7、S10              | `...::test_unknown_path_returns_a_not_found_envelope_with_null_errors`、`...::test_not_found_response_carries_the_correlation_id`；`L:lite` 帶 `x-correlation-id` 且等於 `traceId`                                                                                                                                                                              | PASS |
| 不支援的方法回 405 外層                  | A7                   | `...::test_unsupported_method_returns_a_method_not_allowed_envelope`、`integration/test_health.py::test_methods_other_than_get_return_a_405_envelope`；`L:lite` `POST` → `405`、`allow: GET`                                                                                                                                                                    | PASS |
| 未處理例外回 500 外層且不露出堆疊        | A7、07-01 §卡控機制  | `integration/test_localization_and_unhandled.py::test_unhandled_exception_returns_a_500_envelope_without_internals`；`L:probe` `GET /api/v1/probe-crash` 帶 `Origin: http://localhost:5173` → `500`，body 無 `CANARY-boom`、`/srv/secret.py`、`Traceback`、`RuntimeError`，`x-correlation-id` = `traceId`，`access-control-allow-origin: http://localhost:5173` | PASS |
| 回應內容不符合宣告形狀時回 500 外層      | A7、07-01 §卡控機制  | `...::test_response_not_matching_its_declared_shape_returns_a_500_envelope`；`L:probe` `GET /api/v1/probe-bad-response` → `500`，body 無 `CANARY-resp`、`name`、`ResponseValidationError`                                                                                                                                                                       | PASS |
| 未處理例外的紀錄含追蹤編號且不含請求內容 | A7、S9、ADR-008 D4   | `...::test_unhandled_exception_log_has_the_trace_id_and_no_request_content`（`caplog`，斷言恰一筆 `ERROR`）；`L:probe` 伺服器輸出 `Unhandled exception (traceId=45beadc0-…) GET /api/v1/probe-crash` 加堆疊，該筆紀錄不含 `CANARY-cookie`、`CANARY-query`（uvicorn 自己的 access log 另見觀察 3）                                                               | PASS |
| 回應欄位名為小駝峰                       | A2                   | `integration/test_health.py::test_health_response_keys_are_camel_case`、`unit/test_schemas.py::test_response_envelope_keys_are_camel_case_at_every_level`；`L:lite` 回應只有 `traceId`                                                                                                                                                                          | PASS |
| 中間頁的推導欄位                         | A3                   | `unit/test_schemas.py::test_middle_page_derives_has_more_total_pages_and_next_offset`                                                                                                                                                                                                                                                                           | PASS |
| 最後一頁沒有下一頁                       | A3                   | `unit/test_schemas.py::test_last_page_has_no_next_page`                                                                                                                                                                                                                                                                                                         | PASS |
| 沒有資料時頁數為零                       | A3                   | `unit/test_schemas.py::test_empty_result_has_zero_pages`                                                                                                                                                                                                                                                                                                        | PASS |
| offset 超過總數時回空頁而非 404          | A3                   | `unit/test_schemas.py::test_offset_beyond_total_is_a_valid_empty_page`                                                                                                                                                                                                                                                                                          | PASS |
| 分頁參數的預設值與範圍                   | A3                   | `unit/test_schemas.py::test_pagination_params_default_to_limit_20_offset_0`、`::test_pagination_params_accept_limit_bounds[1/100]`、`::test_pagination_params_reject_out_of_range_values`（`limit` 0／101、`offset` -1）                                                                                                                                        | PASS |

本次沒有列表端點，分頁五條只能在 schema 層驗證，這與 tasks 2.2 的安排一致。

#### api-schema-export（10）

| Scenario                                           | 對應的規格書驗收標準 | 證據                                                                                                                                                                                                                                                                                       | 結果 |
| :------------------------------------------------- | :------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 不設環境變數即可匯出                               | A4、A5、T4           | `integration/test_export_openapi.py::test_export_runs_with_no_environment_variables`；`CLI` `env -u CORS_ALLOWED_ORIGINS -u DATABASE_URL -u SQLITE_PATH uv run python -m app.scripts.export_openapi` 以 0 結束，`backend/data/` 沒有被建立                                                 | PASS |
| 重複匯出內容相同                                   | A5                   | `...::test_repeated_exports_are_byte_identical`、`...::test_export_writes_sorted_keys_indent_two_and_a_trailing_newline`；`CLI` 連續兩次匯出 SHA-1 皆為 `da4aadcc…f0a`，結尾位元組 `0a`                                                                                                    | PASS |
| 提交的介面描述檔與程式一致                         | A5、T4               | `integration/test_exported_document.py::test_committed_document_matches_the_code`；`CLI` drift 指令以 0 結束；`L:lite` 伺服器回的 `/openapi.json` 與提交的檔案 JSON 相等                                                                                                                   | PASS |
| 匯出的介面描述檔為小駝峰且操作識別名符合動詞加資源 | A1、A2               | `...::test_health_operation_id_is_get_health`、`...::test_every_schema_property_is_camel_case`；`L:lite` `/openapi.json` 的 `operationId` 為 `getHealth`                                                                                                                                   | PASS |
| 操作識別名依方法與回應形狀決定動詞                 | A1                   | `unit/test_openapi.py::test_operation_id_is_verb_plus_resource_from_method_and_response_shape`（`listTasks`、`getTask`、`createTask`、`updateTask`、`deleteTask`、`getHealth`）、`::test_get_verb_follows_the_return_annotation_on_*`、`::test_singularize_applies_the_six_steps_in_order` | PASS |
| 操作識別名撞名時啟動失敗                           | A1、N1               | `unit/test_openapi.py::test_create_app_fails_to_start_on_duplicate_operation_ids`、`::test_duplicate_operation_ids_raise_with_the_id_and_both_paths`、`integration/test_export_openapi.py::test_export_fails_and_writes_nothing_on_duplicate_operation_ids`                                | PASS |
| 健康檢查的外層元件名為 HealthDataResponse          | A4、N3               | `integration/test_exported_document.py::test_health_components_are_named_after_their_titles`；`L:lite` `components.schemas` = `ErrorDetail, ErrorResponse, HealthData, HealthDataResponse, HealthStatus`                                                                                   | PASS |
| 分頁外層的元件名                                   | A4、N3               | `unit/test_openapi.py::test_generic_components_are_renamed_to_their_titles`（`TaskItemPageResponse`、`TaskItemPage`）                                                                                                                                                                      | PASS |
| 健康檢查的錯誤回應宣告                             | A4、A7               | `integration/test_exported_document.py::test_health_declares_its_success_and_error_responses`；`L:lite` responses 為 `200, 404, 405, 406, 500, 503`，無 `422`                                                                                                                              | PASS |
| 帶 body 的操作的 422 宣告                          | A4、A7               | `unit/test_openapi.py::test_operation_with_a_body_declares_422_as_error_response`                                                                                                                                                                                                          | PASS |

#### database-migration（4）

| Scenario                         | 對應的規格書驗收標準   | 證據                                                                                                                                                                                                                                                         | 結果 |
| :------------------------------- | :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 資料庫遷移在兩種資料庫上可升可降 | ADR-003 D7、B6、B7、T4 | `integration/test_migrations.py::test_migrations_upgrade_downgrade_and_upgrade_again`，`T:sqlite` 與 `T:pg` 都通過；`CLI` 兩層各跑 `upgrade head → downgrade base → upgrade head`，`alembic current` 依序為 `0dfb129ee036 (head)`、空、`0dfb129ee036 (head)` | PASS |
| 基準遷移不建立業務資料表         | B6                     | `...::test_baseline_creates_no_business_table`（兩層）；`CLI` 後 SQLite `.tables` 與 PostgreSQL `information_schema.tables`（public）都只有 `alembic_version`                                                                                                | PASS |
| 遷移連到與服務相同的資料庫       | B10、ADR-003 D7        | `...::test_migrations_use_the_service_database_settings`；`CLI` 只設 `SQLITE_PATH=<暫存>/mig/m.db`、不設 `CORS_ALLOWED_ORIGINS` 跑 `alembic upgrade head`，檔案被建立且含 `alembic_version`                                                                  | PASS |
| 約束名稱依固定規則產生           | B6                     | `integration/test_db.py::test_constraint_names_follow_the_fixed_rules`，`T:sqlite` 與 `T:pg` 都通過（`pk_sample`、`uq_sample_code`、`fk_sample_owner_id_owner`）                                                                                             | PASS |

#### health-check（7）

| Scenario                            | 對應的規格書驗收標準  | 證據                                                                                                                                                                                                                                                                                                                                                                        | 結果 |
| :---------------------------------- | :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 健康檢查回傳完整外層與追蹤編號      | Epic #502、B1、B5、A1 | `integration/test_health.py::test_health_returns_the_full_success_envelope`、`::test_health_header_matches_the_trace_id_and_is_a_uuid4`（兩層）；`L:lite` 與 `L:pg` 都回 `200`、`data:{"status":"ok","database":"ok"}`、標頭 = `traceId`                                                                                                                                    | PASS |
| 健康檢查回應不含部署資訊            | S9、Q4                | `...::test_health_response_carries_no_deployment_information`（標 `postgres`，只在 `T:pg` 執行並通過）；`L:pg` 三次回應的 body 都不含 `postgres`、`sqlite`、`127.0.0.1`、`55432`、`asyncpg`                                                                                                                                                                                 | PASS |
| 資料庫無法連線時健康檢查回 503 外層 | Q3、A7、S9            | `...::test_unreachable_database_returns_a_503_envelope`、`::test_unavailable_message_is_localised`；`L:down` 指向關閉埠，帶 `Accept-Language: en` → `503`、`DATABASE_UNAVAILABLE`、`message` 為 `"The database is temporarily unavailable. Please try again later."`、body 無 `CANARYuser`／`CANARYpw`／`CANARYdb`／主機／`refused`，標頭 = `traceId`；伺服器紀錄也沒有密碼 | PASS |
| 資料庫連線逾時在時限內回應          | Q3                    | `...::test_silent_database_times_out_within_the_limit`、`unit/test_health_service.py::test_check_bounds_a_hanging_ping_and_reports_database_unavailable`；`L:down` 指向不回應的 TCP 伺服器 → `503` `DATABASE_UNAVAILABLE`，`curl` `time_total=5.01s`                                                                                                                        | PASS |
| 未帶任何憑證即可呼叫健康檢查        | Q4、S10               | `...::test_health_needs_no_credentials`；`L:lite` 不帶任何憑證 → `200`，帶無效的 `Cookie` 與 `Authorization` 也是 `200`                                                                                                                                                                                                                                                     | PASS |
| 健康檢查拒絕 GET 以外的方法         | A2、A7                | `...::test_methods_other_than_get_return_a_405_envelope`、`::test_head_is_not_supported`；`L:lite` `POST`、`DELETE`、`HEAD` 都 `405`，`POST`／`DELETE` body 為 `METHOD_NOT_ALLOWED` 外層                                                                                                                                                                                    | PASS |
| 未宣告的查詢參數被忽略              | A2                    | `...::test_undeclared_query_parameters_are_ignored`、`::test_a_body_on_get_is_ignored`；`L:lite` `?verbose=true` → `200`，`GET` 帶 JSON body 也 `200`                                                                                                                                                                                                                       | PASS |

#### request-correlation（7）

| Scenario                       | 對應的規格書驗收標準 | 證據                                                                                                                                                                                                                                                           | 結果 |
| :----------------------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 成功回應的標頭與 traceId 同值  | A6、A7               | `integration/test_health.py::test_health_header_matches_the_trace_id_and_is_a_uuid4`、`integration/test_app_assembly.py::test_success_response_header_matches_trace_id`；`L:lite` 例 `fe644275-5caf-4f97-abbd-bdadc544fea4`，標頭與 `traceId` 相同、小寫 UUID4 | PASS |
| 錯誤回應也帶追蹤編號           | A6、A7               | `integration/test_app_assembly.py::test_not_found_response_carries_the_correlation_id`、`test_localization_and_unhandled.py::test_generic_error_codes_map_to_http_statuses`；`L:lite` 404 與 `L:probe` 500 標頭都等於各自的 `traceId`                          | PASS |
| CORS 預檢回應也帶追蹤編號      | A6                   | `...::test_preflight_response_carries_the_correlation_id`；`L:lite` `OPTIONS` 預檢回應帶 `x-correlation-id`                                                                                                                                                    | PASS |
| 每個請求的追蹤編號不同         | A6                   | `...::test_each_request_gets_a_different_trace_id`；`L:lite` 連續兩次 `1e720ecb-…`、`2144ac2d-…`                                                                                                                                                               | PASS |
| 符合格式的自帶值被沿用         | A6                   | `...::test_well_formed_client_correlation_id_is_reused`、`unit/test_correlation_middleware.py::test_reuses_a_supplied_value_that_matches_the_format`；`L:lite` `client-trace-0001` 標頭與 `traceId` 都沿用；64 個字元的值也沿用                                | PASS |
| 不符合格式的自帶值被丟棄       | A6、Hard Rule 9      | `...::test_malformed_client_correlation_id_is_discarded`；`L:lite` `abc`、`has space_and_underscore`、65 個 `a` 都是 `200`，標頭 = `traceId` = 伺服器產生的 UUID4                                                                                              | PASS |
| 允許來源的回應公開追蹤編號標頭 | A7、S2               | `...::test_allowed_origin_response_exposes_the_correlation_header`；`L:lite` `access-control-expose-headers: X-Correlation-ID`                                                                                                                                 | PASS |

#### response-localization（14）

| Scenario                             | 對應的規格書驗收標準 | 證據                                                                                                                                       | 結果 |
| :----------------------------------- | :------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 回應訊息依語言偏好本地化             | A8、Q2               | `integration/test_health.py::test_health_message_follows_the_language_preference`；`L:lite` `en` → `"Success"`                             | PASS |
| 指定 zh-TW 時回中文訊息              | A8                   | 同上；`L:lite` `zh-TW` → `"成功"`                                                                                                          | PASS |
| 未帶語言偏好時預設 zh-TW             | A8                   | `test_localization_and_unhandled.py::test_message_defaults_to_zh_tw_without_a_preference`；`L:lite` 不帶 → 404 `"找不到指定的資源"`        | PASS |
| 依 q 值排序挑語言                    | A8                   | `unit/test_i18n.py::test_resolve_locale_picks_the_highest_q_supported_language`；`L:lite` `zh-TW;q=0.5, en;q=0.9` → `"Success"`            | PASS |
| 略過不支援的語言                     | A8                   | 同上；`L:lite` `fr, en;q=0.5` → `"Success"`                                                                                                | PASS |
| 星號視為接受預設語言                 | A8                   | 同上；`L:lite` `fr, *;q=0.1` → `"成功"`                                                                                                    | PASS |
| 中文變體與大小寫對到 zh-TW           | A8                   | 同上；`L:lite` `zh`、`zh-Hant`、`ZH-tw` → `"成功"`，`EN` → `"Success"`                                                                     | PASS |
| 錯誤外層的訊息同樣本地化             | A8                   | `...::test_error_message_is_localised_too`；`L:lite` `en` 404 → `"The requested resource was not found."`                                  | PASS |
| 只接受不支援的語言時回 406           | A8、Q2               | `...::test_only_rejected_languages_returns_a_zh_tw_406`；`L:lite` `fr` → `406`、`NOT_ACCEPTABLE`、`"不支援所要求的語言"`、`data:null`      | PASS |
| 所有語言都以 q=0 拒絕時回 406        | A8                   | `unit/test_i18n.py::test_all_languages_refused_with_q_zero_is_rejected`；`L:lite` `zh-TW;q=0, en;q=0, *;q=0` → `406`                       | PASS |
| 成功與錯誤回應都帶 Content-Language  | A8、N10              | `...::test_success_and_error_responses_both_carry_content_language`；`L:lite` `en` 的 200 與 404 都是 `content-language: en`               | PASS |
| 406 回應的 Content-Language 為 zh-TW | A8                   | 同上 406 測試；`L:lite` `content-language: zh-TW`                                                                                          | PASS |
| 逐欄位錯誤說明不隨語言改變           | A8                   | `...::test_field_error_messages_stay_english`；`L:probe` 外層 `"輸入資料有誤，請檢查標示的欄位"`、`errors[].message` 為 `"Field required"` | PASS |
| /api/v1 以外的路徑不因語言回 406     | A8                   | `...::test_paths_outside_api_v1_never_return_406`；`L:lite` `Accept-Language: fr` `GET /openapi.json` → `200`                              | PASS |

#### runtime-config（13）

| Scenario                                     | 對應的規格書驗收標準 | 證據                                                                                                                                                                                                                                                                       | 結果 |
| :------------------------------------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 缺必要設定時啟動失敗                         | B10、S2、S9、Q1      | `integration/test_app_assembly.py::test_server_refuses_to_start_without_allowed_origins`、`unit/test_config.py::test_missing_allowed_origins_fails_naming_the_variable`；`L:start` exit 1，`ConfigError: CORS_ALLOWED_ORIGINS: Field required`，沒有出現 `Uvicorn running` | PASS |
| 允許來源為空清單時啟動失敗                   | B10                  | `unit/test_config.py::test_empty_allowed_origins_fails`；`L:start` `CORS_ALLOWED_ORIGINS=` → exit 1，`must list at least one origin`                                                                                                                                       | PASS |
| 允許來源含星號時啟動失敗                     | Hard Rule 7、S2      | `unit/test_config.py::test_wildcard_allowed_origin_fails[*, http://localhost:5173,*]`；`L:start` 兩種都 exit 1，`must not contain "*"`                                                                                                                                     | PASS |
| 允許來源格式不合法時啟動失敗                 | B10、S9              | `unit/test_config.py::test_malformed_allowed_origin_fails_without_echoing_the_value`；`L:start` `/app` 與缺 scheme 兩種都 exit 1，輸出不含 `localhost:5173`                                                                                                                | PASS |
| 非 PostgreSQL 的連線字串讓啟動失敗           | ADR-003 D7、S9       | `unit/test_config.py::test_non_postgresql_database_url_fails_without_echoing_credentials`；`L:start` `mysql://user:CANARY-pw@db/app` → exit 1，訊息含 `DATABASE_URL`、不含 `CANARY-pw`                                                                                     | PASS |
| 指定其他驅動的 PostgreSQL 連線字串讓啟動失敗 | ADR-003 D7、S9       | `unit/test_config.py::test_other_driver_or_scheme_database_url_fails`；`L:start` `postgresql+psycopg://…` → exit 1，不含 `CANARY-pw`、`db/app`                                                                                                                             | PASS |
| 只設允許來源即可啟動                         | B10                  | `integration/test_health.py::test_starts_with_only_the_allowed_origins_set`；`L:emptycwd` 空目錄 → `200`，`./data/label_suite.db` 被建立                                                                                                                                   | PASS |
| 沒設 DATABASE_URL 時走 Lite 層               | ADR-003 D7           | `...::test_lite_tier_without_database_url`；`L:lite` `SQLITE_PATH` 指向的檔案存在且回 `200`                                                                                                                                                                                | PASS |
| 設了 DATABASE_URL 時走正式層                 | ADR-003 D7           | `...::test_production_tier_with_database_url[postgresql/postgresql+asyncpg/postgres]`（標 `postgres`，`T:pg` 通過）；`L:pg` 三種寫法都 `200`，`SQLITE_PATH` 指向的檔案沒有被建立                                                                                           | PASS |
| 請求結束後連線歸還                           | B3                   | `...::test_connections_return_to_the_pool_after_requests`（20 次後 `checkedout() == 0`，兩層）                                                                                                                                                                             | PASS |
| 允許來源的請求帶跨來源標頭                   | S2                   | `integration/test_app_assembly.py::test_allowed_origin_gets_cross_origin_headers`；`L:lite` `access-control-allow-origin: http://localhost:5173`、`access-control-allow-credentials: true`                                                                                 | PASS |
| 預檢回應明列方法與標頭                       | S2、Hard Rule 7      | `...::test_preflight_lists_methods_and_headers_explicitly`；`L:lite` `access-control-allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`、`access-control-allow-headers: Accept, Accept-Language, Content-Language, Content-Type, X-Correlation-ID`（見觀察 2）         | PASS |
| 不在清單內的來源不帶跨來源標頭               | S2、ADR-004 D1       | `...::test_unlisted_origin_gets_no_cross_origin_headers`；`L:lite` `Origin: http://evil.example` → `200`，沒有 `access-control-allow-origin`                                                                                                                               | PASS |

#### spec 沒描述、實作出現的行為

- 不在清單內的來源送 `OPTIONS` 預檢時，回 `400`、`text/plain` 的 `Disallowed CORS origin`，不是錯誤外層；允許來源的預檢回 `200`、`text/plain` 的 `OK`。見缺陷 2。
- 不在清單內的來源，一般請求仍帶 `access-control-allow-credentials: true` 與 `access-control-expose-headers`，只是沒有 `access-control-allow-origin`。瀏覽器少了 `Allow-Origin` 就不放行，Scenario 只禁止 `Allow-Origin`，所以不算缺陷。這是 Starlette `CORSMiddleware` 的既有行為。
- `/openapi.json` 與 `/docs` 這類 `/api/v1` 以外的路徑不套外層與語言規則，這與 spec 一致。

### Decision Table

本次只有匿名呼叫端；沒有系統角色與任務成員身分。表中「資料狀態」指資料庫狀態。

| #   | 呼叫端 | 動作                                | 資料庫狀態                  | 輸入                                                                                          | 預期                                        | 驗證方式                  | 結果                     |
| :-- | :----- | :---------------------------------- | :-------------------------- | :-------------------------------------------------------------------------------------------- | :------------------------------------------ | :------------------------ | :----------------------- |
| 1   | 匿名   | `GET /api/v1/health`                | Lite 可連線                 | 無標頭                                                                                        | `200` 外層、`zh-TW`                         | 自動＋`L:lite`            | PASS                     |
| 2   | 匿名   | `GET /api/v1/health`                | 正式層可連線（三種 scheme） | 無                                                                                            | `200`、無部署資訊                           | 自動（`T:pg`）＋`L:pg`    | PASS                     |
| 3   | 匿名   | `GET /api/v1/health`                | PostgreSQL 埠關閉           | `Accept-Language: en`                                                                         | `503`、英文訊息、不露連線資訊               | 自動＋`L:down`            | PASS                     |
| 4   | 匿名   | `GET /api/v1/health`                | 連線建立後不回應            | 無                                                                                            | ≈5 秒內 `503`                               | 自動＋`L:down`（5.01 秒） | PASS                     |
| 5   | 匿名   | `GET /api/v1/health`                | 可連線                      | 無效 `Cookie`／`Authorization`                                                                | `200`（刻意公開）                           | 自動＋`L:lite`            | PASS                     |
| 6   | 匿名   | `GET /api/v1/health`                | 可連線                      | 未宣告 query、`GET` 帶 body                                                                   | `200`，不回 `422`                           | 自動＋`L:lite`            | PASS                     |
| 7   | 匿名   | `POST`／`DELETE`／`HEAD` health     | 任意                        | 無                                                                                            | `405`、`Allow: GET`                         | 自動＋`L:lite`            | PASS                     |
| 8   | 匿名   | `GET /api/v1/no-such-resource`      | 任意                        | 無／`en`                                                                                      | `404` 外層、`errors:null`                   | 自動＋`L:lite`            | PASS                     |
| 9   | 匿名   | `GET /api/v1/health`                | 任意                        | `Accept-Language`：`en`、`zh-TW`、q 值排序、`fr, en`、`fr, *`、`zh`、`zh-Hant`、`ZH-tw`、`EN` | 依規則挑語言、`Content-Language` 相符       | 自動＋`L:lite`            | PASS                     |
| 10  | 匿名   | `GET /api/v1/health`                | 任意                        | `fr`；全部 `q=0`                                                                              | `406`、`zh-TW`                              | 自動＋`L:lite`            | PASS                     |
| 11  | 匿名   | `GET /openapi.json`                 | 任意                        | `fr`                                                                                          | 不是 `406`                                  | 自動＋`L:lite`            | PASS                     |
| 12  | 匿名   | 探測 `POST`                         | 任意                        | `{}`（缺值）                                                                                  | `422` `missing`                             | 自動＋`L:probe`           | PASS                     |
| 13  | 匿名   | 探測 `POST`                         | 任意                        | 多一個欄位                                                                                    | `422` `extra_forbidden`                     | 自動＋`L:probe`           | PASS                     |
| 14  | 匿名   | 探測 `POST`                         | 任意                        | 底線欄位名                                                                                    | `422` 兩筆                                  | 自動＋`L:probe`           | PASS                     |
| 15  | 匿名   | 探測 `POST`                         | 任意                        | 截斷的 JSON                                                                                   | `422`、`location:body`                      | 自動＋`L:probe`           | PASS（`field` 見缺陷 1） |
| 16  | 匿名   | 探測 `POST`                         | 任意                        | 型別錯誤＋CANARY 值                                                                           | `422`、不回顯                               | 自動＋`L:probe`           | PASS                     |
| 17  | 匿名   | 探測 `POST`                         | 任意                        | 有效 `{"displayName":"A"}`                                                                    | `200`、`data.displayName` = `"A"`           | 自動＋`L:probe`           | PASS                     |
| 18  | 匿名   | 探測 crash／bad-response            | 任意                        | 允許來源、CANARY cookie 與 query                                                              | `500`、不露內部、CORS 與追蹤編號都在        | 自動＋`L:probe`           | PASS                     |
| 19  | 匿名   | 任一請求                            | 任意                        | `X-Correlation-ID`：無、8–64 合法、`abc`、含空白底線、65 字元、64 字元                        | 合法沿用，不合法丟棄、不報錯                | 自動＋`L:lite`            | PASS                     |
| 20  | 匿名   | `GET`／`OPTIONS`                    | 任意                        | `Origin` 在清單內／不在清單內                                                                 | 清單內帶 CORS 標頭；清單外無 `Allow-Origin` | 自動＋`L:lite`            | PASS                     |
| 21  | 部署者 | 啟動服務                            | 不適用                      | `CORS_ALLOWED_ORIGINS` 缺、空、`*`、含 `*`、帶路徑、缺 scheme                                 | 拒絕啟動、訊息不含值                        | 自動＋`L:start`           | PASS                     |
| 22  | 部署者 | 啟動服務                            | 不適用                      | `DATABASE_URL` 為 `mysql://`、`postgresql+psycopg://`                                         | 拒絕啟動、不印出密碼                        | 自動＋`L:start`           | PASS                     |
| 23  | 部署者 | 啟動服務                            | 空目錄、無 `data/`          | 只設 `CORS_ALLOWED_ORIGINS`                                                                   | 啟動、建立 `./data/label_suite.db`          | 自動＋`L:emptycwd`        | PASS                     |
| 24  | 部署者 | `alembic upgrade/downgrade/upgrade` | 空 SQLite／空 PostgreSQL    | 只設 `SQLITE_PATH` 或 `DATABASE_URL`                                                          | 三步成功、只剩 `alembic_version`            | 自動＋`CLI`               | PASS                     |
| 25  | 部署者 | 匯出 `openapi.json`                 | 無資料庫                    | 不設任何環境變數                                                                              | 0 結束、無 SQLite 檔、位元組穩定            | 自動＋`CLI`               | PASS                     |
| 26  | 開發者 | 組裝 app／匯出                      | 不適用                      | 兩條同識別名路由                                                                              | 啟動失敗、匯出非零且不寫檔                  | 自動                      | PASS                     |

### Hard Rule 必驗項

| 規則                | 怎麼驗的                                                                                                                                                                                                                                                                                                                          | 結果                                |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| 5 任務設定驅動      | 本 change 沒有任務、任務類型、`input_type` 或 `outputs[]`，沒有可換的組合。可驗的部分：操作識別名、元件名與 `422` 宣告都在 `app/core/openapi.py` 一處依 method、路徑與回傳型別推導，沒有逐一指定（`unit/test_openapi.py` 以 `tasks` 這個與健康檢查無關的資源驗過整組動詞）；新增模組只需在 `app/modules/` 加 router，不改核心分派 | 不適用（相關的一般化機制已驗 PASS） |
| 6 測試集答案不外露  | 本 change 沒有標記員角色、沒有答案資料，也沒有標記員可到達的端點。驗了它的前提：`422` 不回顯送出的值（`L:probe` 送 `CANARY-7f3a`，回應沒有；`errors` 只有四個鍵、沒有 `input`／`ctx`／`url`）、`500` 不回例外訊息（`CANARY-boom`、`CANARY-resp`）、`503` 不回連線資訊                                                             | 不適用（前提已驗 PASS）             |
| 7 CORS 不用萬用字元 | `L:start` `*` 與 `http://localhost:5173,*` 都拒絕啟動；`L:lite` 預檢的 methods／headers 明列                                                                                                                                                                                                                                      | PASS                                |
| 8 不寫死秘密        | 所有連線資訊來自環境變數；啟動失敗與 `503` 都不印出密碼（`L:start`、`L:down`）                                                                                                                                                                                                                                                    | PASS                                |
| 9 不接受未驗證輸入  | 自帶的 `X-Correlation-ID` 以 `^[A-Za-z0-9-]{8,64}$` 過濾（`L:lite`）；body 一律 `extra="forbid"`（`L:probe`）                                                                                                                                                                                                                     | PASS                                |

### DoD

| 項目                                                     | 指令                                                                                                                                                                                                                                                                           | 結果                                                                                                                                                                                                                                        |
| :------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| spec 每個 Scenario 驗證通過                              | 見上表                                                                                                                                                                                                                                                                         | 通過（76／76，含〈補驗〉）                                                                                                                                                                                                                  |
| Decision Table 每一列有驗證                              | 見上表                                                                                                                                                                                                                                                                         | 通過（26／26）                                                                                                                                                                                                                              |
| 後端測試，SQLite                                         | `cd backend && uv run pytest --cov=app --cov-report=term-missing`                                                                                                                                                                                                              | 通過：**300 passed, 4 skipped**（4 個都是標 `postgres` 的測試：`test_health.py:168` 一個、`test_health.py:304` 三個參數化），覆蓋率 **97%**（728 statements，24 miss）                                                                      |
| 後端測試，PostgreSQL                                     | `docker run --rm -d --name label-suite-pg-504 -p 55432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`，等 `pg_isready` 後 `cd backend && TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:55432/postgres uv run pytest --cov=app --cov-report=term-missing` | 通過：**304 passed, 0 skipped**，覆蓋率 **97%**；跑完 `docker stop label-suite-pg-504`                                                                                                                                                      |
| 9.1 的歷史紀錄（code review 修正之前，commit `c7ee2b0`） | 同上兩條                                                                                                                                                                                                                                                                       | SQLite 297 passed、4 skipped；PostgreSQL 301 passed、0 skipped；97%。本次重跑多 3 個測試，來自 review 修正 `5bb389e`、`76ffac3` 新增的測試；**本次重跑是現行紀錄**                                                                          |
| Alembic 升降升，SQLite                                   | `SQLITE_PATH=<暫存>/m.db uv run alembic upgrade head && uv run alembic downgrade base && uv run alembic upgrade head`                                                                                                                                                          | 通過，每步後 `alembic current` 正確；`.tables` 只有 `alembic_version`                                                                                                                                                                       |
| Alembic 升降升，PostgreSQL                               | `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres uv run alembic upgrade head && … downgrade base && … upgrade head`                                                                                                                                       | 通過；public schema 只有 `alembic_version`                                                                                                                                                                                                  |
| 後端能啟動                                               | `CORS_ALLOWED_ORIGINS=http://localhost:5173 uv run uvicorn app.main:create_app --factory --port <port>`                                                                                                                                                                        | 通過：Lite（`L:lite`）與正式層三種 scheme（`L:pg`）都啟動並回 `200`                                                                                                                                                                         |
| 前端 build、元件測試、E2E                                | —                                                                                                                                                                                                                                                                              | 不適用：本 change 沒有 `frontend/`、`e2e/`（#505 建立）                                                                                                                                                                                     |
| lint                                                     | `cd backend && uv run ruff check . && uv run ruff format --check .`                                                                                                                                                                                                            | 通過：`All checks passed!`、`46 files already formatted`                                                                                                                                                                                    |
| 型別檢查                                                 | `cd backend && uv run mypy --strict app`                                                                                                                                                                                                                                       | 通過：`Success: no issues found in 21 source files`                                                                                                                                                                                         |
| 契約漂移                                                 | `cd backend && uv run python -m app.scripts.export_openapi && git diff --exit-code -- openapi.json && test -z "$(git status --porcelain -- openapi.json)"`（另以 `env -u CORS_ALLOWED_ORIGINS -u DATABASE_URL -u SQLITE_PATH` 跑一次）                                         | 通過：exit 0、無差異；與 `api-contract.md` §OpenAPI 元件命名一致（`getHealth`、`HealthDataResponse`、`HealthData`、`HealthStatus`、`ErrorResponse`、`ErrorDetail`，無 `HTTPValidationError`／`ValidationError`，`info.version` 為 `0.0.0`） |
| 根目錄格式                                               | `corepack pnpm exec prettier --check .`                                                                                                                                                                                                                                        | 通過：exit 0                                                                                                                                                                                                                                |
| OpenSpec                                                 | `./node_modules/.bin/openspec validate backend-skeleton --strict`                                                                                                                                                                                                              | 通過：`Change 'backend-skeleton' is valid`                                                                                                                                                                                                  |
| 規格檢查                                                 | `corepack pnpm check:specs`                                                                                                                                                                                                                                                    | 通過：`check-specs: docs OK`（本分支沒有動 `docs/`、`scripts/`，不需 `pnpm test:scripts` 與文件站建置）                                                                                                                                     |
| 文件同步                                                 | 檢查七個 spec 的 `## Purpose`                                                                                                                                                                                                                                                  | 通過：都有內容、沒有 TBD，可供 archive 帶入                                                                                                                                                                                                 |
| 工作區                                                   | `git status --porcelain`                                                                                                                                                                                                                                                       | 驗收前後都乾淨（驗收只新增本檔）                                                                                                                                                                                                            |

### 人工驗收步驟（留作紀錄）

1. **啟動**（Lite 層，預設，不設 `DATABASE_URL`）：

   ```bash
   cd backend
   uv sync
   uv run alembic upgrade head          # 建立 backend/data/label_suite.db；不需要 CORS_ALLOWED_ORIGINS
   CORS_ALLOWED_ORIGINS=http://localhost:5173 \
     uv run uvicorn app.main:create_app --factory --port 8000
   ```

   後端網址 `http://127.0.0.1:8000`（API 在 `/api/v1`，介面描述檔在 `/openapi.json`，互動文件在 `/docs`）。**沒有前端**；`http://localhost:5173` 只是寫進允許來源的值，那個 port 上目前什麼都沒有。

   正式層（PostgreSQL）另外起：

   ```bash
   docker run --rm -d --name label-suite-pg -p 55432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
   docker exec label-suite-pg pg_isready -U postgres   # 等到 accepting connections
   cd backend
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres uv run alembic upgrade head
   CORS_ALLOWED_ORIGINS=http://localhost:5173 \
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres \
     uv run uvicorn app.main:create_app --factory --port 8001
   ```

2. **用什麼身分登入**：不登入。本 change 沒有認證，也沒有 seed 帳號；所有呼叫都是匿名呼叫，`GET /api/v1/health` 是刻意公開的端點。

3. **要打哪幾個網址**（沒有畫面，以 `curl -i` 代替）：

   ```bash
   curl -i http://127.0.0.1:8000/api/v1/health
   curl -i -H 'Accept-Language: en' http://127.0.0.1:8000/api/v1/health
   curl -i http://127.0.0.1:8000/api/v1/no-such-resource
   curl -i -X POST http://127.0.0.1:8000/api/v1/health
   curl -i -H 'Accept-Language: fr' http://127.0.0.1:8000/api/v1/health
   curl -i -H 'X-Correlation-ID: client-trace-0001' http://127.0.0.1:8000/api/v1/health
   curl -i -H 'Origin: http://localhost:5173' http://127.0.0.1:8000/api/v1/health
   curl -i -X OPTIONS -H 'Origin: http://localhost:5173' \
     -H 'Access-Control-Request-Method: GET' \
     -H 'Access-Control-Request-Headers: accept-language,x-correlation-id' \
     http://127.0.0.1:8000/api/v1/health
   curl -s http://127.0.0.1:8000/openapi.json | python3 -c 'import sys,json;print(json.load(sys.stdin)["paths"]["/api/v1/health"]["get"]["operationId"])'
   ```

4. **每一步預期看到什麼**：

   - health（不帶語言）：`HTTP/1.1 200 OK`、`content-language: zh-TW`、body 為 `{"success":true,"code":"OK","message":"成功","data":{"status":"ok","database":"ok"},"timestamp":"…Z","traceId":"…"}`。`timestamp` 是 `YYYY-MM-DDTHH:MM:SS.mmmZ`，正好三位毫秒；`x-correlation-id` 標頭與 `traceId` 一字不差，是小寫帶連字號的 UUID。
   - health 帶 `en`：`message` 變成 `"Success"`，`content-language: en`，其餘相同。
   - no-such-resource：`404`，`"code":"NOT_FOUND"`、`"message":"找不到指定的資源"`、`"data":null`、`"errors":null`，一共七個鍵。
   - `POST` health：`405`，`allow: GET`，`"code":"METHOD_NOT_ALLOWED"`、`"message":"不支援這個操作"`。
   - `fr`：`406`，`"code":"NOT_ACCEPTABLE"`、`"message":"不支援所要求的語言"`，`content-language: zh-TW`。
   - 自帶 `client-trace-0001`：標頭與 `traceId` 都是 `client-trace-0001`。
   - 帶允許來源：多出 `access-control-allow-origin: http://localhost:5173`、`access-control-allow-credentials: true`、`access-control-expose-headers: X-Correlation-ID`。
   - 預檢：`200`，`access-control-allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`，`access-control-allow-headers` 逐一列出（含 `Accept-Language`、`X-Correlation-ID`），**不是 `*`**，也帶 `x-correlation-id`。
   - `openapi.json`：印出 `getHealth`。
   - 正式層（port 8001）重打 health：回應與 Lite 層形狀相同，body 不出現 `postgres`、`127.0.0.1`、`55432`。

5. **刻意要試的失敗路徑**：

   - 拿掉允許來源啟動：`uv run uvicorn app.main:create_app --factory`（不設 `CORS_ALLOWED_ORIGINS`）→ 程序以非零結束，最後一行 `app.core.config.ConfigError: CORS_ALLOWED_ORIGINS: Field required`，沒有出現 `Uvicorn running`。
   - 允許來源設成 `*` → 拒絕啟動，`must not contain "*"`。
   - `DATABASE_URL=mysql://user:secret@db/app` → 拒絕啟動，訊息提到 `DATABASE_URL`，**不會印出 `secret`**。
   - 資料庫掛掉：正式層服務跑著時 `docker stop label-suite-pg`，再帶 `Accept-Language: en` 打 health → `503`、`"code":"DATABASE_UNAVAILABLE"`、`"message":"The database is temporarily unavailable. Please try again later."`，body 沒有主機、帳號、密碼或驅動錯誤訊息；回應在約 5 秒內回來，不會卡住。
   - 不在清單的來源：`curl -i -H 'Origin: http://evil.example' …/api/v1/health` → 仍是 `200`，但**沒有** `access-control-allow-origin`。
   - 不合法的追蹤編號：`-H 'X-Correlation-ID: abc'` → 仍是 `200`，標頭換成伺服器產生的 UUID。
   - `422` 與 `500` 沒有正式端點可觸發，只能靠 `tests/` 的探測路由；重現方式是跑 `uv run pytest tests/integration/test_app_assembly.py tests/integration/test_localization_and_unhandled.py`。

6. **收尾**：在 uvicorn 視窗按 `Ctrl+C`；`docker stop label-suite-pg`（`--rm` 會順便刪掉容器）；要清掉 Lite 層資料就 `rm -rf backend/data`（這個目錄已被 `backend/.gitignore` 排除，不會進版本庫）。

### 缺陷

結論為通過：沒有 Scenario、DoD 或 Hard Rule 項目未通過。以下兩項在初次驗收時是非阻斷的落差，**兩項都已解決**（見〈補驗〉）。

1. `[Medium][Non-blocking]` 無法解析的 JSON 的 `field` 是字元位置，不是空字串
   - 對應 Scenario：無法解析的 JSON 回 422（Scenario 只要求 `location` 為 `"body"`，已通過）；落差在 Requirement「請求驗證失敗回 422 與逐欄位錯誤」與 `api-contract.md` 第 73 行「錯誤在整個 location 時為空字串 `""`」。
   - 預期／實際：預期 `{"location":"body","field":"","code":"json_invalid",…}`；實際 `field` 為 `"15"`。Pydantic 把 JSON 解析失敗的字元位置放在 `loc[1]`，被當成陣列索引轉成字串。前端若照契約把 `field` 當成欄位路徑，會把它當成第 15 個元素。沒有回顯送出的值，所以不是 Hard Rule 6 問題。
   - 重現步驟：匿名；`uv run pytest` 用的探測 app，或照 `L:probe` 的方式起服務後 `curl -X POST -H 'Content-Type: application/json' --data-raw '{"displayName":' http://127.0.0.1:<port>/api/v1/probe` → `"errors":[{"location":"body","field":"15","code":"json_invalid","message":"JSON decode error"}]`。轉換在 `backend/app/core/errors.py` 第 121–124 行（`field` 取 `loc[1:]` 以 `.` 串接，tasks 4.2）。
   - 負責角色：backend-developer（另開 issue；不在本 change 的 Scenario 範圍內）

2. `[Medium][Non-blocking]` CORS 預檢回應不是錯誤外層（規格問題，待維護者回答）
   - 對應 Scenario：無直接 Scenario；Requirement「錯誤回應使用同一個錯誤外層」寫的是「`/api/v1` 底下**所有** `4xx` 與 `5xx` 回應的 body 都是錯誤外層」。
   - 預期／實際：依條文，不在清單內的來源送預檢應得到錯誤外層；實際是 Starlette `CORSMiddleware` 直接回 `400`、`text/plain`、body `Disallowed CORS origin`（允許來源的預檢則是 `200`、`text/plain`、`OK`）。`system-design.md` §請求穿過的層 有意把 CORS 放在外層處理之外，`api-contract.md` 只要求預檢帶 `X-Correlation-ID`（已通過），所以 spec 條文與 design 不一致。瀏覽器不讀預檢的 body，實際影響小。
   - 重現步驟：匿名；`curl -i -X OPTIONS -H 'Origin: http://evil.example' -H 'Access-Control-Request-Method: GET' http://127.0.0.1:8000/api/v1/health`。
   - 負責角色：待維護者決定要把條文改成「預檢除外」，還是要求預檢也包外層；決定後才分派（改條文由 planner，改實作由 backend-developer）。

#### 觀察（不是缺陷）

3. uvicorn 自己的 access log（`INFO`）會印出完整 query string，例如 `"GET /api/v1/probe-crash?q=CANARY-query HTTP/1.1" 500`。本 change 的 Requirement 只約束「未處理例外那一筆 `ERROR` 紀錄」，那一筆確實不含 query；但之後若有端點把 token 或答案放在 query，access log 會留下來。建議 01-01 或 #506 部署設定時決定 access log 的格式（S9）。
4. 預檢的 `access-control-allow-headers` 除了設定的 `Content-Type, Accept-Language, X-Correlation-ID`，還多了 `Accept`、`Content-Language`：這是 Starlette 自動加上的 CORS safelisted 標頭，不是 `*`，符合 Scenario。

## 補驗：驗收後修正（2026-11-20）

結論：**通過**（76／76 Scenario PASS）

初次驗收（`9dc46b5`）的兩項非阻斷缺陷，處理方式如下：

| Commit    | 內容                                                                                                                                                                                                     |
| :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `5d47dfa` | 維護者裁定（2026-11-20）：spec 改為 CORS 預檢不套錯誤外層，`api-envelope` 新增 Scenario「不允許來源的 CORS 預檢回應不是錯誤外層」；「無法解析的 JSON 回 422」增加一條斷言，要求 `field` 為 `""`          |
| `300b143` | tasks 10.1：修正 `backend/app/core/errors.py` 的 `_error_detail`，讓 `json_invalid` 的 `field` 為 `""`；新增 `integration/test_app_assembly.py::test_unlisted_origin_preflight_is_not_an_error_envelope` |

### 受影響 Scenario 重驗

兩條都用真實 server 驗證：`L:probe` 方式，port 18505，正式 `create_app()` 加上 `tests/probe.py` 的探測 router，`CORS_ALLOWED_ORIGINS=http://localhost:5173`。

| Scenario                                       | 證據                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 結果 |
| :--------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 不允許來源的 CORS 預檢回應不是錯誤外層（新增） | `integration/test_app_assembly.py::test_unlisted_origin_preflight_is_not_an_error_envelope`；`curl -i -X OPTIONS -H 'Origin: http://evil.example' -H 'Access-Control-Request-Method: GET' http://127.0.0.1:18505/api/v1/health` → `400`、`content-type: text/plain`、body `Disallowed CORS origin`（不是 JSON 外層），沒有 `access-control-allow-origin`。對照組：允許來源的同一請求回 `200`，並帶 `access-control-allow-origin: http://localhost:5173`         | PASS |
| 無法解析的 JSON 回 422（加了 `field` 斷言）    | `integration/test_app_assembly.py::test_unparseable_json_returns_a_422_envelope`、`unit/test_envelope.py::test_validation_details_split_location_and_field`；`curl -X POST -H 'Content-Type: application/json' --data-raw '{"displayName":' http://127.0.0.1:18505/api/v1/probe` → `422`、`VALIDATION_FAILED`，`errors:[{"location":"body","field":"","code":"json_invalid","message":"JSON decode error"}]`。回歸檢查：送 `{}` 時 `field` 仍是 `"displayName"` | PASS |

### 缺陷狀態

| 原缺陷                                  | 狀態                                                                |
| :-------------------------------------- | :------------------------------------------------------------------ |
| 1. `json_invalid` 的 `field` 是字元位置 | **已解決**：`300b143`（實作）、`5d47dfa`（Scenario 斷言）           |
| 2. CORS 預檢不是錯誤外層（規格問題）    | **已解決**：維護者裁定預檢除外，`5d47dfa` 改 spec；`300b143` 補測試 |

### DoD 重跑

| 項目                 | 指令                                                                                                                                                                                                                                                                                                            | 結果                                                                                                       |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| 後端測試，SQLite     | `cd backend && uv run pytest --cov=app --cov-report=term-missing -rs`                                                                                                                                                                                                                                           | 通過：**301 passed, 4 skipped**（4 個都是標 `postgres` 的測試），覆蓋率 **97%**（732 statements，24 miss） |
| 後端測試，PostgreSQL | `docker run --rm -d --name label-suite-pg-504 -p 55432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`，等 `pg_isready` 後執行 `TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:55432/postgres uv run pytest --cov=app --cov-report=term-missing -rs`，跑完 `docker stop label-suite-pg-504` | 通過：**305 passed, 0 skipped**，覆蓋率 **97%**                                                            |
| OpenSpec             | `./node_modules/.bin/openspec validate backend-skeleton --strict`                                                                                                                                                                                                                                               | 通過：`Change 'backend-skeleton' is valid`                                                                 |

本次重跑取代上方 DoD 表的 pytest 數字，作為現行紀錄。兩套測試各比初次驗收多 1 個測試：`300b143` 新增了預檢測試。`json_invalid` 那條是在既有測試上加斷言，不增加測試數。

### 人工驗收步驟補充

在上方步驟 5「刻意要試的失敗路徑」中，不在清單內的來源送預檢：

```bash
curl -i -X OPTIONS -H 'Origin: http://evil.example' -H 'Access-Control-Request-Method: GET' \
  http://127.0.0.1:8000/api/v1/health
```

預期得到 `400`、`text/plain` 的 `Disallowed CORS origin`，不是 JSON 錯誤外層，也沒有 `access-control-allow-origin`。這是裁定後的正確行為（`5d47dfa`），不是缺陷。`json_invalid` 只能經探測路由觸發，要重現就跑 `uv run pytest tests/integration/test_app_assembly.py -k unparseable`。
