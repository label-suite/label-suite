## 驗收：backend-entry-import-contracts

結論：**通過**（issue #563、PR #678、Epic #560；驗收於分支 `chore/backend-entry-import-contracts`，基準 commit `acec99b`）

### 適用範圍的明示說明

本 change 沒有 API、沒有畫面、沒有 schema 變更，`backend/app/` 沒有 diff（`git diff origin/main --stat -- backend/app` 為空）。所以下列項目**不適用**，不是略過：

- 依角色的 API payload 驗證、遮蔽欄位、端點授權對照 `endpoint-authorization.mdx`、404/403 區分：沒有端點可打。
- Playwright／E2E、loading／error／empty／無權限四種畫面狀態、token 不在前端：沒有畫面，`e2e/` 不需新增。
- Hard Rule 6（測試集答案不外露）：本 change 不碰任何標記員可達的端點或回應，沒有答案可外露。
- 資料庫 schema 與 Alembic 升降級：沒有 `[@dba]` task、沒有 migration。DoD 的 pytest 在兩層資料庫都有跑，其中已含既有的 `tests/integration/test_migrations.py` 升降級測試。

證據改由「契約對真實違規會失敗」與常駐測試取得。

### Scenario 結果

證據欄的測試皆位於 `backend/tests/unit/`，全部在 SQLite 與 PostgreSQL 兩層通過（見 DoD）。四個測試檔合跑：`67 passed`。

| Requirement／Scenario                              | 對應的規格書驗收標準    | 證據（常駐測試函式）                                                                                                                                                                                               | 結果 |
| :------------------------------------------------- | :---------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 寄信：業務模組直接 import 寄信套件時檢查失敗       | backend-agent-rules B12 | `test_entry_contracts.py::test_business_module_importing_an_entry_package_fails_with_the_chain[resend]`；另以拋棄式複本實測（下表）                                                                                | 通過 |
| 寄信：其他寄信套件也被擋                           | B12                     | 同函式 `[smtplib]`、`[aiosmtplib]`                                                                                                                                                                                 | 通過 |
| OIDC：業務模組直接 import `authlib`                | B12                     | 同函式 `[authlib]`                                                                                                                                                                                                 | 通過 |
| HTTP：第三方客戶端被擋                             | B12                     | 同函式 `[httpx]`、`[requests]`、`[aiohttp]`、`[urllib3]`                                                                                                                                                           | 通過 |
| HTTP：共用層與組裝點 import `httpx`                | B12                     | `test_core_main_and_scripts_importing_httpx_fail[app/core/base.py]`、`[app/main.py]`、`[app/scripts/__init__.py]`                                                                                                  | 通過 |
| HTTP：標準庫 HTTP 工具不在範圍                     | B12                     | `test_standard_library_url_parsing_is_allowed`                                                                                                                                                                     | 通過 |
| 入口 import 自己的套件時通過                       | B12                     | `test_entry_package_outside_the_checked_packages_may_import_its_sdk`                                                                                                                                               | 通過 |
| 業務模組只經入口間接使用時通過                     | B12                     | `test_business_module_using_the_entry_is_an_allowed_indirect_import`                                                                                                                                               | 通過 |
| 既有程式通過入口檢查                               | B12                     | `test_layer_boundaries.py::test_real_backend_passes_the_layer_check`；`lint-imports --no-cache` 輸出 `9 kept, 0 broken`                                                                                            | 通過 |
| 清單列出七項並標明檢查狀態                         | B12                     | 文件閱讀：`backend-agent-rules.mdx` §B12 表格恰七列，#1 至 #3 標「已建置：契約 …」並列禁止清單，#4 至 #7 標「待建置」並寫原因；`grep -F` 交叉核對見下                                                              | 通過 |
| 限制與適用路徑寫明                                 | B12                     | 文件閱讀：適用路徑 `backend/app/**`；「尚未檢查」(2) 寫明 `urllib.request`、`http.client` 擋不了，並寫「不宣稱 Ruff `S310` 補得上」，未宣稱其他工具補得上                                                          | 通過 |
| B1 與 B5 只指向清單                                | B1、B5、B12             | 文件閱讀：B1 檢查方式末句「取得入口與跨模組…的契約見 B12，這裡不重複清單」，B1 內沒有 `resend`／`httpx` 等字串；B5「待建置」旁寫 import-linter 只能擋整個套件、擋不了 `text`，見 B12 尚未檢查                      | 通過 |
| 新的頂層套件未歸類時測試失敗                       | B12                     | `test_guard_names_a_stray_top_level_package`                                                                                                                                                                       | 通過 |
| 已登記入口被放進檢查來源時測試失敗                 | B12                     | `test_guard_names_a_registered_entry_listed_in_a_contract`                                                                                                                                                         | 通過 |
| 入口契約漏列既有頂層套件時測試失敗                 | B12                     | `test_guard_names_the_contract_and_the_package_it_leaves_out`                                                                                                                                                      | 通過 |
| 檢查來源寫成整個 `app` 時通過                      | B12                     | `test_guard_accepts_a_contract_whose_source_is_the_whole_app`（補充：`test_guard_accepts_registered_entries_outside_the_listed_sources`）                                                                          | 通過 |
| 既有的 `app` 通過守門測試                          | B12                     | `test_every_top_level_package_of_the_real_app_is_classified`                                                                                                                                                       | 通過 |
| 未歸類的第三方套件使測試失敗                       | B12                     | `test_dependency_classification.py::test_unlisted_package_in_a_sample_tree_is_returned`、`test_declared_dependency_is_still_unclassified_without_a_list`                                                           | 通過 |
| 標準庫不需歸類                                     | B12                     | `test_standard_library_imports_are_not_returned`                                                                                                                                                                   | 通過 |
| 傳遞相依被直接 import 時也被看見                   | B12                     | `test_declared_dependency_is_still_unclassified_without_a_list`（宣告相依不等於已歸類）；`test_real_app_reports_a_package_dropped_from_the_general_list`                                                           | 通過 |
| 入口清單與契約禁止清單不一致時測試失敗             | B12                     | `test_entry_list_with_an_extra_package_is_named`、`test_entry_list_with_a_missing_package_is_named`                                                                                                                | 通過 |
| 既有的 app 全部已歸類                              | B12                     | `test_real_app_has_no_unclassified_package`、`test_entry_lists_equal_the_contract_forbidden_modules`                                                                                                               | 通過 |
| 一個模組 router import 另一個模組 service 時失敗   | B12、B1                 | `test_entry_contracts.py::test_router_importing_another_modules_service_fails_with_the_chain`、`test_a_third_module_importing_health_schemas_fails`                                                                | 通過 |
| 組裝點 import 多個模組不違反獨立性                 | B12                     | `test_main_importing_several_routers_keeps_both_module_contracts`                                                                                                                                                  | 通過 |
| 同模組 service import 自己的 router 時失敗         | B12                     | `test_only_the_assembly_point_may_import_a_router[app/modules/health/service.py-…]`、`[app/modules/other/service.py-…]`                                                                                            | 通過 |
| 組裝點 import router 時通過                        | B12                     | `test_layer_boundaries.py::test_clean_tree_with_main_importing_several_routers_passes`                                                                                                                             | 通過 |
| 放行項沒有註解時測試失敗                           | B12                     | `test_contract_exemptions.py::test_ignored_import_without_a_comment_is_named`、`test_single_quoted_ignored_import_without_a_comment_is_named`                                                                      | 通過 |
| 單行陣列的放行項使測試失敗                         | B12                     | `test_single_line_ignore_array_with_an_entry_is_named`、`test_several_entries_on_one_line_are_named`                                                                                                               | 通過 |
| 註解沒有來源時測試失敗                             | B12                     | `test_comment_without_an_issue_or_rule_number_is_named`、`test_comment_with_only_a_source_and_no_reason_is_named`                                                                                                  | 通過 |
| 註解同時有理由與來源時通過                         | B12                     | `test_comment_with_an_issue_or_rule_number_passes[#563]`、`[B12]`                                                                                                                                                  | 通過 |
| 契約關閉過期警示時測試失敗                         | B12                     | `test_contract_that_silences_stale_ignores_is_named[warn]`、`[none]`                                                                                                                                               | 通過 |
| 過期的放行項使分層檢查失敗                         | B12                     | `test_ignored_import_that_matches_nothing_fails_the_run`；拋棄式複本實測（下表）輸出 `No matches for ignored import app.core -> authlib.`，結束碼 1                                                                | 通過 |
| 既有設定沒有任何豁免                               | B12                     | `test_real_configuration_has_no_ignored_import_and_passes`                                                                                                                                                         | 通過 |
| 乾淨的樣本樹通過全部契約                           | B12                     | `test_layer_boundaries.py::test_clean_tree_with_main_importing_several_routers_passes`（斷言 `f"{len(load_contracts())} kept, 0 broken"`）                                                                         | 通過 |
| 刪一條契約同時加一條時測試失敗                     | B12                     | `test_name_diff_sees_one_removed_and_one_added_when_the_count_is_unchanged`、`test_name_diff_sees_a_removed_contract`、`test_name_diff_sees_a_renamed_contract`、`test_real_contract_names_equal_the_expected_set` | 通過 |
| 每條新契約都有會失敗的樣本                         | B12                     | `test_entry_contracts.py` 對五條新契約各有違規樣本（八個套件參數化、三個來源檔、跨模組三案例）；拋棄式複本逐條實測（下表）                                                                                         | 通過 |
| （MODIFIED）新模組未列入檢查時測試失敗             | B1                      | `test_layer_boundaries.py::test_module_missing_from_the_contracts_is_reported_by_name`、`test_module_added_after_the_contracts_were_written_is_still_checked`                                                      | 通過 |
| （MODIFIED）健康檢查模組也受檢                     | B1                      | `test_every_module_in_app_modules_is_covered_by_the_contracts`、`test_violating_import_fails_and_names_the_contract[…]`                                                                                            | 通過 |
| （MODIFIED）跨模組契約被改成明列單一模組時測試失敗 | B1                      | `test_module_missing_only_from_the_independence_contract_is_reported`、`test_module_missing_only_from_the_router_protected_contract_is_reported`                                                                   | 通過 |
| （MODIFIED）新模組同時受跨模組契約檢查             | B1                      | `test_a_third_module_importing_health_schemas_fails`（同上）                                                                                                                                                       | 通過 |
| （MODIFIED）組裝點匯入多個模組的路由不報錯         | B1                      | `test_clean_tree_with_main_importing_several_routers_passes`                                                                                                                                                       | 通過 |
| （MODIFIED）組裝點以外的檔案 import router 仍被擋  | B1                      | `test_service_importing_router_reports_the_import_chain`、`test_only_the_assembly_point_may_import_a_router[…]`                                                                                                    | 通過 |

spec 沒描述但實作出現的額外行為：`app.scripts` 納入入口契約的 `source_modules`（design D1 已寫明，spec 的樣本以它覆蓋）；樣本樹 helper `import_tree.py`（無 `test_` 前綴、不被收集）。沒有發現與規格書矛盾之處。

### 文件 Scenario 的 `grep -F` 交叉核對（tasks 7.3）

`grep -cF "<契約名稱>"` 在 `backend/pyproject.toml` 與 `docs/development/rules/backend-agent-rules.mdx` 都有命中（pyproject 各 1、文件各 2）：

| 契約名稱                                | pyproject.toml | backend-agent-rules.mdx |
| :-------------------------------------- | :------------: | :---------------------: |
| Mail only through its entry             |       1        |            2            |
| OIDC only through its entry             |       1        |            2            |
| Outbound HTTP only through its entry    |       1        |            2            |
| Modules do not import each other        |       1        |            2            |
| Only the assembly point imports routers |       1        |            2            |

禁止清單逐字：`"resend", "smtplib", "aiosmtplib"`、`"authlib"`、`"httpx", "requests", "aiohttp", "urllib3"` 在 pyproject 各命中 1；文件 B12 表格列出同樣的套件（`resend`、`smtplib`、`aiosmtplib`；`authlib`；`httpx`、`requests`、`aiohttp`、`urllib3`）。五個測試檔路徑（`import_tree.py`、`test_entry_contracts.py`、`test_dependency_classification.py`、`test_contract_exemptions.py`、`test_layer_boundaries.py`）皆存在。B12 標「已建置」的三項與兩條跨模組契約都有對應契約與測試；標「待建置」的四項（取得目前使用者、cookie helper、CSRF middleware、`get_db`）沒有被寫成已檢查。B1 不重複禁止清單。

### 契約對真實違規會失敗（拋棄式複本）

做法：把 worktree 的 `backend/app` 與 `pyproject.toml` 複製到 scratchpad（`/private/tmp/claude-501/-Users-mandy610425-project-label-suite-oss/06c86cc0-619f-464f-88ff-58192a17dc21/scratchpad/v/c`，不在 worktree 內），每案重新複製、加一個違規、在複本內以 worktree 的 `.venv/bin/lint-imports --no-cache` 執行。原樣控制組輸出 `Contracts: 9 kept, 0 broken.`、結束碼 0。逐案輸出存於 `…/scratchpad/viol.out` 與 `viol2.out`。

| 違規（加在複本）                                                                   | 被擊破的契約                                                                          | import 鏈（節錄）                                         | 結束碼 |
| :--------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ | :-------------------------------------------------------- | :----: |
| `app/modules/health/service.py` 加 `import resend`                                 | Mail only through its entry BROKEN                                                    | `app.modules.health.service -> resend`                    |   1    |
| 同檔 `import smtplib`                                                              | Mail only through its entry BROKEN                                                    | `… -> smtplib`                                            |   1    |
| 同檔 `import aiosmtplib`                                                           | Mail only through its entry BROKEN                                                    | `… -> aiosmtplib`                                         |   1    |
| 同檔 `import authlib`                                                              | OIDC only through its entry BROKEN                                                    | `… -> authlib`                                            |   1    |
| 同檔 `import httpx`                                                                | Outbound HTTP only through its entry BROKEN                                           | `… -> httpx`                                              |   1    |
| 同檔 `import requests`／`aiohttp`／`urllib3`                                       | Outbound HTTP only through its entry BROKEN                                           | `… -> requests`／`aiohttp`／`urllib3`                     |  各 1  |
| `app/core/__init__.py` 加 `import httpx`                                           | Outbound HTTP only through its entry BROKEN                                           | `app.core -> httpx`                                       |   1    |
| `app/main.py` 加 `import httpx`                                                    | Outbound HTTP only through its entry BROKEN                                           | `app.main -> httpx`                                       |   1    |
| 新增 `app/modules/other/`（五層檔齊全），`other/router.py` import `health.service` | Modules do not import each other BROKEN                                               | `app.modules.other.router -> app.modules.health.service`  |   1    |
| `other/service.py` import `health.router`                                          | Modules do not import each other 與 Only the assembly point imports routers 皆 BROKEN | `app.modules.other.service -> app.modules.health.router`  |   1    |
| `health/service.py` import 自己的 router                                           | Module layers 與 Only the assembly point imports routers 皆 BROKEN                    | `app.modules.health.service -> app.modules.health.router` |   1    |
| `authlib` 契約加一條指向不存在 import 的 `ignore_imports`                          | （過期警示）`No matches for ignored import app.core -> authlib.`                      | —                                                         |   1    |
| 控制組：新增 `other` 模組但無跨模組 import                                         | 全部 KEPT，`9 kept, 0 broken`                                                         | —                                                         |   0    |

附記：第一次在複本裡只放 `other/router.py` 時，結束碼 1 的原因是 layers 契約要求每個模組五層都在（`Missing layer in container 'app.modules.other': module app.modules.other.schemas does not exist.`），屬我的樣本不完整，補齊後如上表。這與常駐測試的 `build_tree` 寫法一致，不是缺陷。

### Decision Table

本 change 沒有角色與資料狀態維度；維度只有「違規位置 × 套件 × 預期」，已由上兩表窮舉。邊界值與無效輸入（空註解、單行陣列、單引號、`warn`／`none`、`source_modules = ["app"]`、標準庫、宣告但未歸類的相依）各有對應常駐測試，見 Scenario 表。

### Hard Rule 必驗項

| 規則               | 怎麼驗的                                                                                           | 結果             |
| :----------------- | :------------------------------------------------------------------------------------------------- | :--------------- |
| 5 任務設定驅動     | 本 change 沒有任務類型相關行為，`backend/app/` 無 diff；契約只談 import 邊界，不含任何任務類型字串 | 不適用（無牴觸） |
| 6 測試集答案不外露 | 沒有標記員可達的端點、畫面或回應被新增或改動（`backend/app/` 無 diff）                             | 不適用（無牴觸） |

### DoD

命令都在 worktree，`backend/` 內執行。

| 項目                                                                  | 指令與結果摘要                                                                                                                                                                                                                   | 結果         |
| :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------- |
| ruff                                                                  | `uv run ruff check .` 輸出 `All checks passed!`                                                                                                                                                                                  | 通過         |
| 格式                                                                  | `uv run ruff format --check .` 輸出 `59 files already formatted`                                                                                                                                                                 | 通過         |
| 型別                                                                  | `uv run mypy --strict app` 輸出 `Success: no issues found in 22 source files`                                                                                                                                                    | 通過         |
| import 契約                                                           | `uv run lint-imports --no-cache`：`Analyzed 49 files, 109 dependencies`，`Contracts: 9 kept, 0 broken.`                                                                                                                          | 通過         |
| pytest（SQLite）                                                      | `uv run pytest -q`：`545 passed, 4 skipped`（四個是標 `postgres` 的測試）                                                                                                                                                        | 通過         |
| pytest（PostgreSQL）                                                  | 本機 Docker 起 `postgres:16`，`TEST_DATABASE_URL=postgresql+asyncpg://postgres:…@localhost:55433/postgres uv run pytest -q`：`549 passed`，skipped 為 0；Alembic 升降級測試包含在內                                              | 通過         |
| openapi 漂移                                                          | `uv run python -m app.scripts.export_openapi && git diff --exit-code -- openapi.json ../docs/diagrams/architecture/api.openapi.json && test -z "$(git status --porcelain -- …)"`：無差異，與 api-contract「本次無 API 變更」一致 | 通過         |
| `backend/app` 無 diff                                                 | `git diff origin/main --stat -- backend/app` 為空                                                                                                                                                                                | 通過         |
| `pnpm check:er`                                                       | `check-er-data: dictionary, diagram, landed revisions, spec entries and both kinds of line citation agree`                                                                                                                       | 通過         |
| `node scripts/check-specs.mjs docs`                                   | `check-specs: docs OK`                                                                                                                                                                                                           | 通過         |
| `node scripts/check-citations.mjs --strict`                           | `169 documents, 2555 citations … 0 errors`                                                                                                                                                                                       | 通過         |
| `pnpm format:check`                                                   | `All matched files use Prettier code style!`                                                                                                                                                                                     | 通過         |
| `pnpm exec openspec validate backend-entry-import-contracts --strict` | `Change 'backend-entry-import-contracts' is valid`                                                                                                                                                                               | 通過         |
| 無 `backend/.grimp_cache/`                                            | 每次跑完 `ls -a backend \| grep grimp` 無輸出                                                                                                                                                                                    | 通過         |
| 前端、E2E                                                             | 本 change 不動 `frontend/`、`e2e/`，不適用                                                                                                                                                                                       | 不適用       |
| NoteCraft 建置                                                        | tasks 與 design D10 明示不在 worktree 執行（會污染共用快取），改由上列 `check-specs`、`check-citations`、`format:check` 取代                                                                                                     | 依設計不執行 |

PostgreSQL 驗證中途曾有一次失敗，原因是我自己把資料庫名取成 `t`，`test_health_response_carries_no_deployment_information` 斷言回應文字不含資料庫名，而 `timestamp` 含字母 `t`；改用 CI 同樣的資料庫名 `postgres` 後全部通過。這是驗收環境的設定問題，不是缺陷，也未動任何程式。

### 人工驗收步驟（留作紀錄）

本 change 沒有畫面、沒有登入角色、沒有網址與 port；啟動後端與前端都不需要。

1. **準備**：`cd <repo>/backend`。SQLite 為預設，不需設 `DATABASE_URL`。
2. **確認現況**：`uv run lint-imports --no-cache`，預期最後一行 `Contracts: 9 kept, 0 broken.`，結束碼 0，且九條契約的名稱都列出 KEPT。
3. **跑常駐測試**：`uv run pytest tests/unit/test_layer_boundaries.py tests/unit/test_entry_contracts.py tests/unit/test_dependency_classification.py tests/unit/test_contract_exemptions.py`，預期 `67 passed`。
4. **重現違規（在 repo 外的暫存複本做，不在 repo 內留下違規檔）**：
   1. `mkdir -p /tmp/v && cd <repo>/backend && tar --exclude=.venv --exclude=.grimp_cache --exclude=__pycache__ -cf - app pyproject.toml | tar -xf - -C /tmp/v`
   2. `cd /tmp/v && echo "import resend" >> app/modules/health/service.py && <repo>/backend/.venv/bin/lint-imports --no-cache; echo $?`
   3. 預期：輸出 `Mail only through its entry BROKEN`、`Contracts: 8 kept, 1 broken.`、`app.modules.health.service -> resend`，結束碼 `1`。
   4. 對每個違規重複（先重新複製再加一行）：`smtplib`、`aiosmtplib` 預期仍是 Mail 契約；`authlib` 預期 OIDC 契約；`httpx`、`requests`、`aiohttp`、`urllib3` 預期 Outbound HTTP 契約；把 `import httpx` 加到 `app/core/__init__.py` 或 `app/main.py` 預期同一條 Outbound HTTP 契約。
   5. 跨模組：在複本 `app/modules/other/` 建 `__init__.py`、`router.py`、`service.py`、`repository.py`、`schemas.py`（五個檔都要有，layers 契約才不報缺層），在 `other/router.py` 寫 `from app.modules.health import service`，預期 `Modules do not import each other BROKEN`；改在 `other/service.py` 寫 `from app.modules.health import router`，預期該契約與 `Only the assembly point imports routers` 同時 BROKEN。
   6. 過期放行：在 `OIDC only through its entry` 契約加 `ignore_imports = [ "app.core -> authlib", ]`，預期 `No matches for ignored import app.core -> authlib.`，結束碼 1。
5. **刻意要試的失敗路徑**：上一步即是；另可在 repo 的 `backend/app/` 暫時新增 `stray/__init__.py` 後跑 `uv run pytest tests/unit/test_entry_contracts.py::test_every_top_level_package_of_the_real_app_is_classified`（需在 repo 的 backend 內，故這項要在 repo 內暫時新增再刪除，並以 `git status` 確認無殘留），預期失敗並點名 `stray`。
6. **收尾**：`rm -rf /tmp/v`（只刪暫存複本）；確認 `git status --porcelain` 在 repo 內乾淨，且 `backend/` 底下沒有 `.grimp_cache`。

### 缺陷

無。
