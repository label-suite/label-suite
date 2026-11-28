## 驗收：db-comment-coverage

結論：通過

本 change 只新增後端測試與規則文件，沒有產品行為、API 或 UI。這是技術性 change，`docs/specs/` 沒有對應頁面，因此「對應的規格書驗收標準」欄改為對應 delta Requirement（`specs/database-migration/spec.md`）。

驗收分支：`test/db-comment-coverage`，head `8f79f7d9`。PostgreSQL 用本機 `docker run postgres:16`（資料庫名 `acceptdb822`，用完已停止）。

### Scenario 結果

測試檔：`U` = `backend/tests/unit/test_db_comments.py`，`P` = `backend/tests/integration/test_db_comments_postgres.py`。

| #   | Scenario                                     | 對應 Requirement            | 證據                                                                                                                                                                                                                                            | 結果 |
| :-- | :------------------------------------------- | :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 1   | 所有表與欄位都有說明時通過                   | R1 每張表與欄位都有非空說明 | U `test_every_table_and_column_has_a_comment`；SQLite 與 PostgreSQL 兩輪都通過（與 U 同檔，PostgreSQL 輪 32 passed）                                                                                                                            | 通過 |
| 2   | 缺少欄位說明時失敗並指名該欄位               | R1                          | U `test_a_missing_column_comment_names_table_dot_column`、`test_a_blank_column_comment_counts_as_missing`、`test_all_violations_are_listed_at_once`；手動負向步驟顯示 `admin_role_permission.permission_key: column comment is missing`         | 通過 |
| 3   | 缺少表說明時失敗並指名該表                   | R1                          | U `test_a_missing_table_comment_names_the_table`、`test_a_blank_table_comment_counts_as_missing`                                                                                                                                                | 通過 |
| 4   | 純關聯表同樣被要求                           | R1                          | U `test_a_junction_table_is_held_to_the_same_rule`                                                                                                                                                                                              | 通過 |
| 5   | 英文以外的非空說明不被此檢查擋下             | R1                          | U `test_a_non_english_comment_is_not_rejected`                                                                                                                                                                                                  | 通過 |
| 6   | 資料表集合為空時失敗                         | R2 載入護欄                 | U `test_an_empty_metadata_fails_the_load_guard`                                                                                                                                                                                                 | 通過 |
| 7   | 資料表集合缺少已落地的表時失敗               | R2                          | U `test_a_missing_landed_table_is_named`、`test_the_landed_baseline_is_the_five_known_tables`                                                                                                                                                   | 通過 |
| 8   | 有資料模型檔的模組沒有登錄任何資料模型時失敗 | R2                          | U `test_a_models_module_without_a_mapper_is_named`、`test_every_models_module_registers_a_mapper`                                                                                                                                               | 通過 |
| 9   | 新增資料表不必修改檢查                       | R2                          | 檢查只讀共用 metadata（U `test_every_table_and_column_has_a_comment`、`test_metadata_tables_returns_the_sorted_tables`），沒有表清單或豁免設定；獨立樣本 metadata 不進共用 `Base.metadata`（`test_the_sample_never_joins_the_shared_metadata`） | 通過 |
| 10  | 遷移後資料庫說明與資料模型一致時通過         | R3 PostgreSQL 說明一致      | P `test_database_comments_match_model_comments`，PostgreSQL 16 實跑通過                                                                                                                                                                         | 通過 |
| 11  | 資料庫的說明缺漏時失敗                       | R3                          | U `test_a_database_without_a_column_comment_is_reported`、`test_a_database_without_a_table_comment_is_reported`                                                                                                                                 | 通過 |
| 12  | 資料庫的說明與資料模型不同時失敗             | R3                          | U `test_a_differing_column_comment_shows_both_sides`、`test_a_differing_table_comment_shows_both_sides`、`test_a_trailing_space_difference_is_a_mismatch`                                                                                       | 通過 |
| 13  | 表或欄位不在資料庫時失敗                     | R3                          | U `test_a_table_absent_from_the_database_is_reported`、`test_a_column_absent_from_the_database_is_reported`                                                                                                                                     | 通過 |
| 14  | 遷移版本紀錄表不被檢查                       | R3                          | U `test_a_table_the_model_does_not_know_is_never_checked`；表清單只由 metadata 推出                                                                                                                                                             | 通過 |
| 15  | 失敗訊息一次列出全部違規                     | R4 失敗訊息格式             | U `test_all_violations_are_listed_at_once`、`test_all_mismatches_are_listed_at_once`                                                                                                                                                            | 通過 |
| 16  | 檢查邏輯本身可被樣本證明會失敗               | R4                          | U 的樣本測試（獨立 `MetaData()`）在 SQLite 輪執行，不需 PostgreSQL（SQLite 輪 31 passed）                                                                                                                                                       | 通過 |
| 17  | SQLite 回合略過 PostgreSQL 層                | R5 略過與執行               | 未設 `TEST_DATABASE_URL`：P 顯示 `1 skipped`（`needs TEST_DATABASE_URL`），U 31 passed；完整輪 1202 passed、5 skipped                                                                                                                           | 通過 |
| 18  | PostgreSQL 回合執行 PostgreSQL 層            | R5                          | 設 `TEST_DATABASE_URL`：P `1 passed`；完整輪 1207 passed、0 skipped                                                                                                                                                                             | 通過 |
| 19  | 既有的略過檢查涵蓋 PostgreSQL 層的新測試     | R5                          | 把未設 `TEST_DATABASE_URL` 的 JUnit 餵給 `node scripts/check-junit-skips.mjs`：回報 `1 skipped; this round must skip none` 並列出 `test_database_comments_match_model_comments`，exit 1                                                         | 通過 |

Scenario 共 19 條（delta 的 5 個 Requirement 各自列出）。沒有發現 spec 沒描述的額外行為。

### 完整測試輪次

| 輪次          | 指令                                                                                                         | 結果                                                    |
| :------------ | :----------------------------------------------------------------------------------------------------------- | :------------------------------------------------------ |
| SQLite        | `cd backend && uv run pytest`                                                                                | 1202 passed、5 skipped（其中 1 條是新的 PostgreSQL 層） |
| PostgreSQL 16 | `cd backend && TEST_DATABASE_URL=postgresql+asyncpg://postgres:pw@localhost:55432/acceptdb822 uv run pytest` | 1207 passed、0 skipped                                  |

1207 − 1202 = 5，正好是 SQLite 輪略過、PostgreSQL 輪執行的 5 條。

驗收中的一個設定教訓：第一次起 PostgreSQL 時資料庫名取 `t`（單一字元），`tests/integration/test_health.py::test_health_response_carries_no_deployment_information` 因回應文字含字元 `t` 而失敗。這是驗收環境的取名問題，不是本 change 的缺陷；改用 `acceptdb822` 後全綠。之後用 PostgreSQL 驗收時，資料庫名不要取太短。

### Decision Table

本 change 沒有系統角色、任務成員身分或輸入欄位，輸入條件是「模型說明狀態 × 資料庫說明狀態 × 回合」。

| 模型說明         | 資料庫說明                   | 回合                             | 預期                                        | 驗證                           |
| :--------------- | :--------------------------- | :------------------------------- | :------------------------------------------ | :----------------------------- |
| 非空             | 與模型完全相等               | PostgreSQL                       | 通過                                        | P 實跑（自動）                 |
| 非空（含非英文） | 不適用                       | SQLite                           | 通過                                        | U（自動）                      |
| 缺漏／全空白     | 不適用                       | SQLite、PostgreSQL               | 失敗並指名                                  | U 樣本與手動負向（自動＋手動） |
| 非空             | 缺漏                         | PostgreSQL                       | 失敗並指名                                  | U 比對純函式（自動）           |
| 非空             | 不同或只差頭尾空白           | PostgreSQL                       | 失敗並兩邊內容都顯示                        | U（自動）                      |
| 非空             | 表或欄位不存在               | PostgreSQL                       | 失敗並指名                                  | U（自動）                      |
| 不適用           | `alembic_version` 等非模型表 | PostgreSQL                       | 不檢查                                      | U（自動）                      |
| 缺漏             | 缺漏（兩邊都沒有）           | PostgreSQL                       | 由 metadata 層抓到（既有 drift 抓不到這種） | 手動負向步驟的 PostgreSQL 輪   |
| 不適用           | 不適用                       | 未設 `TEST_DATABASE_URL`         | PostgreSQL 層略過，不連資料庫               | P（自動）                      |
| 不適用           | 不適用                       | 設了 `TEST_DATABASE_URL`，且略過 | `check-junit-skips.mjs` 失敗                | 手動指令（Scenario 19）        |

### Hard Rule 必驗項

| 規則               | 怎麼驗的                                                                                                                                                 | 結果   |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 5 任務設定驅動     | 不適用：本 change 不碰任務類型，也沒有任務邏輯。檢查只掃共用 metadata，沒有寫死的表名清單（底線 5 張表是載入護欄，不是豁免或白名單）                     | 不適用 |
| 6 測試集答案不外露 | 不適用：本 change 沒有新增任何標記員可達的端點或畫面，`backend/app/` 與前端沒有改動（`git diff` 只含 tests、docs、`.claude/agents/dba.md`、`openspec/`） | 不適用 |

### DoD

| 項目                                                              | 結果                                                                                                                                                |
| :---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| 每個 Scenario 都驗證通過                                          | 通過（19/19）                                                                                                                                       |
| Decision Table 都有對應驗證                                       | 通過                                                                                                                                                |
| 後端 `uv run pytest`，SQLite                                      | 通過：1202 passed、5 skipped                                                                                                                        |
| 後端 `uv run pytest`，PostgreSQL                                  | 通過：1207 passed、0 skipped                                                                                                                        |
| `uv run lint-imports`                                             | 通過：9 kept、0 broken                                                                                                                              |
| `uv run ruff check .`、`uv run ruff format --check .`             | 通過：All checks passed、140 files already formatted                                                                                                |
| `uv run mypy --strict app`                                        | 通過：no issues in 51 source files                                                                                                                  |
| `openspec validate db-comment-coverage --strict`                  | 通過：`Change 'db-comment-coverage' is valid`（用 `pnpm exec openspec`）                                                                            |
| `pnpm check:specs`                                                | 通過：`check-specs: docs OK`                                                                                                                        |
| 重新匯出 `openapi.json`、`api.openapi.json` 沒有差異              | 通過：`git diff --exit-code` 無差異，與 `api-contract.md`「無 API 變更」一致                                                                        |
| Alembic `upgrade` → `downgrade` → `upgrade`，SQLite 與 PostgreSQL | 不適用：本 change 沒有新增或改動 migration。PostgreSQL 輪升到最新由 `migrated_engine` 在每次測試中執行並通過                                        |
| 前端元件與 hook 測試、根目錄 `e2e/` Playwright                    | 不適用：沒有改動前端或畫面                                                                                                                          |
| 後端與前端 build 並啟動                                           | 不適用：`app/` 與 `frontend/` 沒有改動                                                                                                              |
| `pnpm test:scripts`、文件站建置                                   | 文件站建置不在 worktree 跑（design 任務 5.2 的規定，會污染全機快取），以 CI `docs-site` job 為證據；`scripts/` 沒有改動，`pnpm test:scripts` 不適用 |
| 受影響文件已同步                                                  | 通過：`.claude/agents/dba.md`、`backend-agent-rules.mdx`、`testing-agent-rules.mdx` 已更新，`pnpm check:specs` 通過                                 |
| 無殘留檔案                                                        | 通過：`git status` 乾淨，沒有 `backend/data/`                                                                                                       |

### 人工驗收步驟（留作紀錄）

1. **啟動**：不需要啟動後端或前端，這個 change 只有測試。要驗 PostgreSQL 層時：
   - `docker run -d --rm --name pg822acc -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=acceptdb822 -p 55432:5432 postgres:16`
   - 等 `docker exec pg822acc pg_isready -U postgres -d acceptdb822` 回報 accepting connections。
   - `export TEST_DATABASE_URL=postgresql+asyncpg://postgres:pw@localhost:55432/acceptdb822`。
   - 資料庫名不要取一個字元，否則 `test_health.py` 會誤判。
2. **用什麼身分登入**：不適用，沒有登入、角色或帳號。
3. **要執行哪幾條指令**：
   - SQLite 輪：`cd backend && uv run pytest tests/unit/test_db_comments.py tests/integration/test_db_comments_postgres.py -rs`。
   - PostgreSQL 輪：設好 `TEST_DATABASE_URL` 後執行同一條指令。
4. **每一步預期看到什麼**：
   - SQLite 輪：31 passed、1 skipped，skip 原因是 `needs TEST_DATABASE_URL (PostgreSQL)`。
   - PostgreSQL 輪：32 passed、0 skipped。
   - 完整 `uv run pytest`：SQLite 1202 passed、5 skipped；PostgreSQL 1207 passed、0 skipped。
5. **刻意要試的失敗路徑（負向步驟）**：
   - 在 `backend/app/modules/admin/models.py` 刪掉 `admin_role_permission.permission_key` 那一行 `comment="Permission key; ..."`。
   - 不設 `TEST_DATABASE_URL`，跑上面 SQLite 輪的指令。預期 1 failed，失敗訊息含 `admin_role_permission.permission_key: column comment is missing`。
   - 設 `TEST_DATABASE_URL`，再跑一次。預期 2 failed，訊息含兩條：`admin_role_permission.permission_key: column comment is missing`（metadata 層）與 `admin_role_permission.permission_key: model comment is missing`（PostgreSQL 層）。
   - 還原用 `git checkout -- backend/app/modules/admin/models.py`，再以 `git status --short` 確認沒有殘留。
   - 另一條：未設 `TEST_DATABASE_URL` 跑 P 並加 `--junitxml=<檔>`，再執行 `node scripts/check-junit-skips.mjs <檔>`，預期 exit 1 並列出被略過的測試。
6. **收尾**：`docker stop pg822acc`（容器以 `--rm` 啟動，停止即移除）；`unset TEST_DATABASE_URL`；用 `git status --short` 確認工作樹乾淨。

### 缺陷

無。
