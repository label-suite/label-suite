## 驗收：trusted-proxy-client-ip

結論：通過（issue #566、PR #682；驗收分支 `chore/trusted-proxy-client-ip`，與 origin 同步、工作區乾淨）

### 不適用的驗收項目

本 change 沒有 API、沒有畫面、沒有 schema：`api-contract.md` 與 `ui-design.md` 各只有一段「無異動」，`openapi.json` 重新匯出沒有差異。因此下列項目**不適用**，不是被略過：

- **依系統角色與任務成員身分的 API payload 檢查（含遮蔽欄位、404 vs 403、`endpoint-authorization.mdx` 對照）**：沒有新增或改動任何端點，也沒有改任何授權；這個 change 只改「請求的來源位址怎麼被還原」，不改誰能呼叫什麼。
- **Playwright／畫面四種狀態、token 不在前端**：沒有畫面。`e2e/shared/proxy-probe/` 是 CI 用的 shell 腳本加 ASGI 探針，不是瀏覽器測試。
- **Alembic 與 DB 寫入核對**：沒有 migration。DoD 仍跑了兩層的 `upgrade → downgrade → upgrade`（見 DoD），確認沒被破壞。
- Hard Rule 6（答案不外露）：沒有任何標記員可到達的端點被新增或改動；探針路由只存在於 CI 覆寫檔掛上的探針映像命令與 `backend/tests/` 的測試專用模組，不在 `backend/app`、不在映像。Hard Rule 5（任務設定驅動）：與任務類型無關。

### Scenario 結果

測試位置：`T-U` = `backend/tests/unit/test_forwarded_allow_ips.py`；`T-P` = `backend/tests/integration/test_trusted_proxy.py`；`T-S` = `backend/tests/integration/test_trusted_proxy_startup.py`；`T-C` = `backend/tests/unit/test_config.py`。CI 步驟都在 `.github/workflows/ci.yml` 的 `compose` job。「手動」欄是我本機另外以 Docker 實際跑過。

#### specs/trusted-proxy-client-ip

| Scenario                                    | 證據                                                                                                                                                                                                                                                                                         | 結果 |
| :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 經 Nginx 的請求取得原始來源位址             | CI 步驟 `Start the Lite tier with the client address probe` 與 `Check the client address the backend sees through nginx`（`check-client-address.sh` 的 `plain request`）；手動：`client=192.168.65.1`（非 `10.77.250.10`、是合法 IP）                                                        | 通過 |
| 經 Nginx 帶偽造標頭的請求不採信偽造值       | 同上，腳本的 `forged X-Forwarded-For`（`6.6.6.6`）；手動：`client=192.168.65.1`                                                                                                                                                                                                              | 通過 |
| 受信任的對端帶轉發標頭時採用原始位址        | `T-P::test_trusted_peer_forwarded_address_and_scheme_are_used`（真實 uvicorn 子行程）                                                                                                                                                                                                        | 通過 |
| 對端不在信任清單時整個標頭不看              | `T-P::test_untrusted_peer_headers_are_ignored`、`test_untrusted_peer_gets_no_forwarded_address_for_a_chain`                                                                                                                                                                                  | 通過 |
| Nginx 以附加方式轉發 X-Forwarded-For        | CI 步驟 `Assert the trusted proxy settings of both orchestration files` 內的 `grep -q 'proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;'`；我另讀 `frontend/nginx.conf` 第 69 行 `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`                                 | 通過 |
| 直接連後端自帶偽造標頭不被採信              | `T-P::test_untrusted_peer_headers_are_ignored`（`X-Forwarded-For: 6.6.6.6`＋`X-Forwarded-Proto: https`，回報 `127.0.0.1`、`http`）；手動兩種：在後端容器內送偽造標頭回 `{"client": "127.0.0.1", "scheme": "http"}`，從同網路的另一個容器送回 `{"client": "10.77.250.130", "scheme": "http"}` | 通過 |
| 受信任的對端帶 X-Forwarded-Proto 時採用其值 | `T-P::test_trusted_peer_forwarded_address_and_scheme_are_used`                                                                                                                                                                                                                               | 通過 |
| 經 Nginx 時回報的協定恆為 http              | CI `check-client-address.sh` 的 `forged X-Forwarded-Proto`；手動 `scheme=http`                                                                                                                                                                                                               | 通過 |
| 多層鏈取右到左第一個不受信任的位址          | `T-P::test_chain_takes_the_first_untrusted_address_from_the_right`                                                                                                                                                                                                                           | 通過 |
| 兩行 X-Forwarded-For 依同一規則處理         | `T-P::test_two_forwarded_for_lines_follow_the_same_rule`                                                                                                                                                                                                                                     | 通過 |
| 用戶端自帶的鏈不影響經 Nginx 的結果         | CI `check-client-address.sh` 的 `forged chain`（`9.9.9.9, 8.8.8.8`）；手動 `client=192.168.65.1`                                                                                                                                                                                             | 通過 |
| 預設信任清單只有 loopback                   | `T-U::test_default_trusts_only_loopback`；另 `T-P` 的無變數伺服器夾具                                                                                                                                                                                                                        | 通過 |
| 映像的啟動指令不帶信任清單旗標              | `T-P::test_dockerfile_cmd_carries_no_proxy_flags`；我另讀 `backend/Dockerfile` 第 60 行 `CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]`，且 `git diff origin/main..HEAD -- backend/Dockerfile` 為空                                             | 通過 |
| 環境變數指定的信任清單在映像啟動時生效      | `T-P::test_environment_variable_list_replaces_the_default_without_any_flag`；手動：映像內 `uvicorn` 啟動指令不帶旗標，`FORWARDED_ALLOW_IPS=10.77.250.99` 時經 Nginx 回報 `10.77.250.10`（見下方負向實驗，證明環境變數確實生效）                                                              | 通過 |

#### specs/runtime-config

| Scenario                                  | 證據                                                                                                                                                                                                                                                  | 結果 |
| :---------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 受信任位址設定不合法時啟動失敗            | `T-S::test_bad_trust_list_stops_uvicorn_naming_the_variable`（七個壞值參數化，真實 uvicorn 非零結束、無 `Application startup complete`）；`T-U::test_unsafe_or_malformed_list_fails_naming_the_variable`；手動：真實映像 `*` 與 `0.0.0.0/0` 都 exit 1 | 通過 |
| 合法的信任清單可以啟動                    | `T-U::test_valid_list_loads_trimmed`（四組值與預期清單）                                                                                                                                                                                              | 通過 |
| 錯誤訊息含變數名且不含設定值              | `T-U::test_error_message_never_echoes_the_value`、`test_error_message_does_not_echo_any_item_of_a_mixed_list`（`CANARY-host.example`）                                                                                                                | 通過 |
| 含星號時以真實 uvicorn 啟動失敗並點名變數 | `T-S`（參數 `*`）；手動映像輸出末行 `ConfigError: FORWARDED_ALLOW_IPS: Value error, each item must be ...`，exit 1                                                                                                                                    | 通過 |
| 只設允許來源即可啟動                      | `T-C::test_only_allowed_origins_is_required_and_defaults_apply`；`backend/tests/integration/test_api_docs_toggle.py::test_docs_routes_are_served_by_default_and_when_true`；`test_health.py`（既有，全組綠）                                          | 通過 |
| API_DOCS_ENABLED 不是布林值時啟動失敗     | `T-C::test_api_docs_enabled_rejects_non_boolean_without_echoing_value`                                                                                                                                                                                | 通過 |
| LOG_LEVEL 未設時輸出等級為 INFO           | `T-C::test_log_level_defaults_to_info`；`test_access_log.py::test_successful_request_writes_one_info_access_line`                                                                                                                                     | 通過 |
| LOG_LEVEL 不分大小寫                      | `T-C::test_log_level_is_case_insensitive`；`test_access_log.py::test_warning_log_level_drops_info_records_and_keeps_warnings`                                                                                                                         | 通過 |
| LOG_LEVEL 不合法時啟動失敗                | `T-C::test_log_level_rejects_other_values_without_echoing_value`、`test_invalid_log_level_error_does_not_echo_the_value`                                                                                                                              | 通過 |

#### specs/container-runtime

| Scenario                                  | 證據                                                                                                                                                                                                                                                                                                                                                                                                    | 結果 |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--- |
| 兩層宣告同一組子網段與前端位址            | CI 步驟 `Assert the trusted proxy settings of both orchestration files`；手動 `docker compose -f <file> config --format json`：兩層都是 `ipam [{"subnet":"10.77.250.0/24","ip_range":"10.77.250.128/25"}]`、`frontend` `ipv4_address` `10.77.250.10`（在子網段內、不在 `ip_range` 內）；實際 `up` 後 `docker network inspect` 為 `Subnet 10.77.250.0/24 IPRange 10.77.250.128/25 Gateway 10.77.250.128` | 通過 |
| 子網段在 Docker 預設位址池之外            | 同一 CI 步驟（`POOLS` 重疊檢查）；我自己讀：`10.77.250.0/24` 不在 `172.16.0.0/12`、不在 `192.168.0.0/16`                                                                                                                                                                                                                                                                                                | 通過 |
| 預設只信任前端的固定位址                  | 同一 CI 步驟；手動（以 `.env.example` 複製出 `.env`）兩層 `backend.environment.FORWARDED_ALLOW_IPS` 都是 `10.77.250.10`，`migrate` 沒有此變數；非 `*`、無 `/0`                                                                                                                                                                                                                                          | 通過 |
| .env 的值覆寫預設                         | 同一 CI 步驟（`FORWARDED_ALLOW_IPS=192.0.2.7`）；手動 `--env-file` 兩層都得 `192.0.2.7`                                                                                                                                                                                                                                                                                                                 | 通過 |
| 範例檔不含可用的 secret                   | 讀 `.env.example`：`POSTGRES_PASSWORD` 空、連線字串為註解、新增的 `FORWARDED_ALLOW_IPS` 行也是註解；CI `Check that a missing database password is rejected` 仍在                                                                                                                                                                                                                                        | 通過 |
| 允許來源同時涵蓋本機開發與前端容器        | 未被本 change 動到（`.env.example` 該區段無 diff）；CI `Resolve the Lite tier`、`Check the Lite health through nginx` 既有步驟涵蓋                                                                                                                                                                                                                                                                      | 通過 |
| .env 不進版控也不進映像                   | `git check-ignore .env` 命中；`.dockerignore` 與 `backend/.dockerignore` 含 `**/.env`、`**/.env.*`；`.env` 驗收後已刪除，`git status` 乾淨                                                                                                                                                                                                                                                              | 通過 |
| 範例檔列出 FORWARDED_ALLOW_IPS 並說明用法 | 讀 `.env.example` 第 40 至 74 行：說明只在代理後面才設、直接暴露時不要設、不得為 `*` 或涵蓋全部的網段、兩種擋不住的寫法、子網段重疊時三個值與變數一起改、兩層不可同時運行；`FORWARDED_ALLOW_IPS=10.77.250.10` 以註解列出                                                                                                                                                                                | 通過 |

### 對照 issue 的三個驗收條件（Docker 端對端）

Docker 29.2.1 可用，Docker Desktop。以下全部在 worktree 以 `.env.example` 複製的暫時 `.env` 執行，結束後刪除。

1. **經 Nginx 後端看到原始來源**：`docker compose -f docker-compose.yml -f e2e/shared/proxy-probe/compose.override.yml up --build --wait --wait-timeout 300` 後，`e2e/shared/proxy-probe/check-client-address.sh http://localhost:8080 10.77.250.10` exit 0，四種請求輸出 `client=192.168.65.1 scheme=http`（Docker Desktop 的發布埠來源，平台相依，腳本只做否定斷言）。
   **負向**：`FORWARDED_ALLOW_IPS=10.77.250.99`（錯的位址）重跑 `up`，後端不信任 Nginx，四種請求全部 `client=10.77.250.10`，腳本印出四行 `the backend sees the frontend address` 並 exit 1，證明檢查會失敗、環境變數確實生效。
2. **直接連後端的偽造標頭不被採信**：子行程整合測試（上表）通過；手動兩種：在後端容器內對 `127.0.0.1:8000` 送 `X-Forwarded-For: 6.6.6.6` 與 `X-Forwarded-Proto: https`，回 `{"client": "127.0.0.1", "scheme": "http"}`；以同映像另起容器接到編排網路（位址 `10.77.250.130`，不是 `.10`）直連 `backend:8000` 送同樣標頭，回 `{"client": "10.77.250.130", "scheme": "http"}`，兩者都沒有 `6.6.6.6`、`https`。
3. **設定有文件**：`.env.example`（上表最後一列）與 `docs/development/architecture.mdx` §部署與維運第 357 行（信任模型、位址常數、右到左取值、驗證、CI）與第 375 行（兩層不可同時運行、切換前先 `down`）；`docs/development/workflow/local-development.mdx` 環境變數表與 `docs/diagrams/architecture/backend-modules.mdx` 也同步。

**啟動守門於真實映像**：`docker run --rm -e CORS_ALLOWED_ORIGINS=http://localhost:5173 -e SQLITE_PATH=/tmp/x.db -e 'FORWARDED_ALLOW_IPS=*' label-suite-backend:latest` exit 1，輸出末行 `app.core.config.ConfigError: FORWARDED_ALLOW_IPS: Value error, each item must be a single IP address or a CIDR network with no host bits set and a non-zero prefix length; "*", hostnames and empty items are not accepted`。這句是固定文案、對所有壞值相同（`0.0.0.0/0` 的輸出逐字相同，exit 1），輸出裡沒有以 `=值` 形式回印設定值。

### Decision Table

沒有角色與任務成員身分維度（見「不適用」）；維度是「對端位址是否受信任 × 標頭 × 信任清單設定」。

| 對端                        | 信任清單                                                                         | 請求標頭                         | 預期                                   | 驗證                                                                | 結果               |
| :-------------------------- | :------------------------------------------------------------------------------- | :------------------------------- | :------------------------------------- | :------------------------------------------------------------------ | :----------------- |
| loopback                    | `127.0.0.1`                                                                      | `X-Forwarded-For: 5.5.5.5`       | client `5.5.5.5`                       | `T-P` 自動化                                                        | 通過               |
| loopback                    | `127.0.0.1`                                                                      | `X-Forwarded-Proto: https`       | scheme `https`                         | `T-P`                                                               | 通過               |
| loopback                    | `127.0.0.1`                                                                      | 鏈 `6.6.6.6, 5.5.5.5, 127.0.0.1` | `5.5.5.5`                              | `T-P`                                                               | 通過               |
| loopback                    | `127.0.0.1`                                                                      | 兩行 XFF `6.6.6.6`、`7.7.7.7`    | `7.7.7.7`                              | `T-P`                                                               | 通過               |
| loopback                    | `127.0.0.1`                                                                      | 無轉發標頭                       | 回報對端本身                           | `T-P::test_trusted_peer_without_forwarded_headers_reports_the_peer` | 通過               |
| loopback                    | `192.0.2.1`（不含）                                                              | XFF `6.6.6.6`＋Proto `https`     | `127.0.0.1`、`http`                    | `T-P`                                                               | 通過               |
| loopback                    | 未設（預設 loopback）                                                            | XFF `5.5.5.5`                    | `5.5.5.5`                              | `T-P` 預設夾具                                                      | 通過               |
| loopback                    | 環境變數 `192.0.2.1`                                                             | XFF `5.5.5.5`                    | `127.0.0.1`                            | `T-P`                                                               | 通過               |
| 容器 `.10`（Nginx）         | `10.77.250.10`                                                                   | 偽造 XFF、鏈、Proto              | 回報原始來源、非 `.10`、非偽造、`http` | CI P2＋手動                                                         | 通過               |
| 容器 `.10`                  | `10.77.250.99`（錯）                                                             | 任何                             | 回報 `.10`（腳本失敗）                 | 手動負向                                                            | 通過（失敗如預期） |
| 同網路其他容器 `.130`       | `10.77.250.10`                                                                   | 偽造 XFF＋Proto                  | 回報 `.130`、`http`                    | 手動                                                                | 通過               |
| 設定值                      | `*`、`0.0.0.0/0`、`::/0`、`127.0.0.1/8`、`localhost`、`1.2.3.4,,5.6.7.8`、空字串 | —                                | 啟動失敗、訊息含變數名                 | `T-S`、`T-U`；映像手動 `*`、`0.0.0.0/0`                             | 通過               |
| 設定值                      | `10.77.250.10`、`10.77.250.0/24`、`" 127.0.0.1 , ::1 "`、`127.0.0.1,10.0.0.0/8`  | —                                | 載入成功並去空白                       | `T-U`                                                               | 通過               |
| 設定值                      | `CANARY-host.example`                                                            | —                                | 失敗、訊息不含該值                     | `T-U`                                                               | 通過               |
| `.env` 未設／設 `192.0.2.7` | —                                                                                | —                                | 預設 `.10`／覆寫 `192.0.2.7`，兩層     | CI P1＋手動                                                         | 通過               |

### Hard Rule 必驗項

| 規則               | 怎麼驗的                                                                                                                                                                                                                                                | 結果           |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------- |
| 5 任務設定驅動     | 不適用：change 與任務類型、`input_type`、`outputs[]` 無關，`git diff origin/main..HEAD -- backend/app` 只有 `config.py` 新增 41 行（`forwarded_allow_ips` 驗證）                                                                                        | 通過（不適用） |
| 6 測試集答案不外露 | 不適用：沒有新增或改動可被標記員到達的端點；探針路由只存在於 `backend/tests/integration/forwarded_probe.py` 與 `e2e/shared/proxy-probe/report_client.py`，後者只由 CI 覆寫檔掛載，`backend/.dockerignore` 與映像不含它們；回應只有 `client` 與 `scheme` | 通過（不適用） |
| 7 / 8（附帶）      | 無 `allow_origins=["*"]` 變動；`.env` 沒進版控、驗收暫時檔已刪；`FORWARDED_ALLOW_IPS` 不是 secret，錯誤訊息仍不回印值                                                                                                                                   | 通過           |

### DoD

| 項目                        | 指令與結果                                                                                                                                                                                                                                                    | 結果   |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----- |
| ruff check                  | `uv run ruff check .` → `All checks passed!`                                                                                                                                                                                                                  | 通過   |
| ruff format                 | `uv run ruff format --check .` → `64 files already formatted`                                                                                                                                                                                                 | 通過   |
| mypy                        | `uv run mypy --strict app` → `Success: no issues found in 22 source files`                                                                                                                                                                                    | 通過   |
| import 契約                 | `uv run lint-imports --no-cache` → `Contracts: 9 kept, 0 broken.`                                                                                                                                                                                             | 通過   |
| pytest（SQLite）            | `uv run pytest -q` → `574 passed, 4 skipped in 20.56s`                                                                                                                                                                                                        | 通過   |
| pytest（PostgreSQL 16）     | `docker run postgres:16`（資料庫名 `label_suite_acc`），`TEST_DATABASE_URL=postgresql+asyncpg://…/label_suite_acc uv run pytest -q` → `578 passed in 20.98s`（skipped 的 4 個只在 SQLite 層跳過）                                                             | 通過   |
| Alembic（SQLite）           | 由 `tests/integration/test_migrations.py` 在 SQLite 那輪覆蓋（574 passed 內）；本 change 無 migration                                                                                                                                                         | 通過   |
| Alembic（PostgreSQL）       | 對 PG16 實跑 `alembic upgrade head` → `downgrade base`（`Running downgrade 0dfb129ee036 -> , baseline`）→ `upgrade head`（`Running upgrade  -> 0dfb129ee036, baseline`），皆成功                                                                              | 通過   |
| openapi 漂移                | `uv run python -m app.scripts.export_openapi && git diff --exit-code -- openapi.json ../docs/diagrams/architecture/api.openapi.json && 無未提交檔` → 無差異；與 `api-contract.md`（無異動）一致                                                               | 通過   |
| 規格檢查                    | `node scripts/check-specs.mjs docs` → `check-specs: docs OK`                                                                                                                                                                                                  | 通過   |
| 引用檢查                    | `node scripts/check-citations.mjs --strict` → `0 errors`（`0 unverified (WARN)`）                                                                                                                                                                             | 通過   |
| ER 資料                     | `node scripts/check-er-data.mjs` → 各處一致                                                                                                                                                                                                                   | 通過   |
| Prettier                    | `prettier --check .` → `All matched files use Prettier code style!`                                                                                                                                                                                           | 通過   |
| OpenSpec                    | `openspec validate trusted-proxy-client-ip --strict` → `Change 'trusted-proxy-client-ip' is valid`                                                                                                                                                            | 通過   |
| 兩層編排可展開與 P1         | 兩份 `docker compose config` 成功；P1 的等價斷言我以 `jq` 手動重做（見 Scenario 表）；CI 的 `compose` job 本身由 PR 的 CI 執行，未在本機重放整個 job                                                                                                          | 通過   |
| 後端映像建置與啟動          | `up --build --wait` 兩個服務 healthy；`backend/Dockerfile` 無 diff                                                                                                                                                                                            | 通過   |
| 前端 lint／型別／Playwright | 不適用：`frontend/` 只動 `nginx.conf` 的註解，沒有 `frontend/src` 變動                                                                                                                                                                                        | 不適用 |
| 文件同步                    | `architecture.mdx`、`local-development.mdx`、`backend-modules.mdx`、`.env.example`、`frontend/nginx.conf` 註解的位址與預設值逐字與 `docker-compose*.yml` 相同（`10.77.250.0/24`、`10.77.250.128/25`、`10.77.250.10`、`${FORWARDED_ALLOW_IPS:-10.77.250.10}`） | 通過   |

未驗證的範圍：正式層（`docker-compose.prod.yml`）只做 `config` 展開與靜態比對，沒有在本機實際 `up`（tasks 3.3 已由實作者實測並記錄，本次不重放）；`docs/specs/07-shared/` 兩個檔出現在 `git diff origin/main..HEAD` 是因為分支與 main 的相對位置，不屬本 change 的 tasks，未驗。

### 人工驗收步驟（留作紀錄）

1. **啟動 Lite 層（含探針）**：在 repo 根目錄 `cp .env.example .env`（`.env` 已被 git 忽略，驗完刪除；Lite 層不需要設 `DATABASE_URL`），然後 `docker compose -f docker-compose.yml -f e2e/shared/proxy-probe/compose.override.yml up --build --wait --wait-timeout 300`。網址：前端（Nginx）`http://localhost:8080`；後端只在編排網路內的 `backend:8000`，沒有發布埠。
2. **身分**：不需要登入，這個 change 沒有畫面也沒有授權變動。
3. **要送的請求**（都從主機打前端）：`e2e/shared/proxy-probe/check-client-address.sh http://localhost:8080 10.77.250.10`；或自己 `curl -s http://localhost:8080/api/v1/proxy-probe`，再加 `-H 'X-Forwarded-For: 6.6.6.6'`、`-H 'X-Forwarded-For: 9.9.9.9, 8.8.8.8'`、`-H 'X-Forwarded-Proto: https'`。
4. **預期**：腳本 exit 0；每種請求回 JSON `{"client": "<合法 IP>", "scheme": "http"}`，`client` 不是 `10.77.250.10`、不是 `6.6.6.6`／`9.9.9.9`／`8.8.8.8`（Docker Desktop 上看到 `192.168.65.1`，Linux 會是別的位址，這是平台差異不是缺陷）。`docker network inspect label-suite_default` 看到 `Subnet 10.77.250.0/24`、`IPRange 10.77.250.128/25`。
5. **刻意要試的失敗路徑**：
   - 偽造標頭直連後端：`docker compose -f docker-compose.yml -f e2e/shared/proxy-probe/compose.override.yml exec -T backend python -c "import urllib.request as u; r=u.Request('http://127.0.0.1:8000/x',headers={'X-Forwarded-For':'6.6.6.6','X-Forwarded-Proto':'https'}); print(u.urlopen(r).read())"`，預期 `{"client": "127.0.0.1", "scheme": "http"}`。從網路內另一個容器打：`docker run --rm --network label-suite_default --entrypoint python label-suite-backend:latest -c "<同上，網址改 http://backend:8000/x>"`，預期 `client` 是該容器自己的 `10.77.250.1xx`，不是 `6.6.6.6`。
   - 錯的信任位址：先 `down -v`，再 `FORWARDED_ALLOW_IPS=10.77.250.99 docker compose -f … up --build --wait` 並重跑腳本，預期 `client=10.77.250.10`、腳本印出 `the backend sees the frontend address` 並 exit 1。
   - 星號：`docker run --rm -e CORS_ALLOWED_ORIGINS=http://localhost:5173 -e SQLITE_PATH=/tmp/x.db -e 'FORWARDED_ALLOW_IPS=*' label-suite-backend:latest; echo $?`，預期輸出含 `FORWARDED_ALLOW_IPS`、結束碼 1、沒有 `Application startup complete`。把值換成 `0.0.0.0/0`、`::/0`、`localhost` 結果相同。
   - 也可在 `.env` 加 `FORWARDED_ALLOW_IPS=*` 後 `docker compose up`：後端容器反覆失敗、`up --wait` 逾時，不會開始接受請求。
6. **收尾**：`docker compose -f docker-compose.yml -f e2e/shared/proxy-probe/compose.override.yml down -v`；刪除 `.env`；若本機建置過映像，`docker rmi label-suite-backend:latest label-suite-frontend:latest`。PostgreSQL 驗證用的 `docker run postgres:16` 以 `docker rm -f` 移除（它留下的匿名 volume 另用 `docker volume rm` 清）。兩層共用同一子網段，換層前一定先 `down`。

### 缺陷

無。

觀察（非缺陷、不影響結論）：

1. 啟動失敗的錯誤訊息是固定文案，其中含字面 `"*"` 作為「不接受什麼」的說明，因此對任何壞值都一樣；它不是回印使用者設定的值（`0.0.0.0/0` 的輸出逐字相同），符合「不印設定值」。
2. 正式層沒有在本機實際 `up`，靠實作者 task 3.3 記錄與 CI `Start the production tier` 步驟覆蓋。
