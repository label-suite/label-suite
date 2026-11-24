## 驗收：openapi-docs-renderer

結論：通過

本 change 沒有新增端點、`frontend/` 沒有畫面、角色與遮蔽欄位都沒有變動，所以 API payload 驗收、Playwright 與 Hard Rule 6 的標記員端點檢查不適用，改用實際適用的指令驗證（pytest 匯出測試用 tmp 路徑、漂移指令、模擬手改與刪除副本後還原、`pnpm test:scripts`、`node scripts/check-specs.mjs docs`）。未執行 `notecraftapp build`：它與其他 serve 共用快取，文件頁路由已由主工作階段的建置確認，渲染以 CI docs-site 為準。

### Scenario 結果

#### api-schema-export

| Scenario                               | 對應的規格書驗收標準           | 證據                                                                                                                                                                | 結果 |
| :------------------------------------- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--- |
| 不設環境變數即可匯出                   | issue #572、api-agent-rules A4 | 以 `env -u CORS_ALLOWED_ORIGINS -u DATABASE_URL -u SQLITE_PATH` 執行匯出，退出碼 0，兩個檔都寫出，沒有新增 SQLite 檔（只有 mypy 快取的 `.db`）；pytest 檔也含此案例 | 通過 |
| 重複匯出內容相同                       | api-agent-rules A4             | 連續匯出兩次，`backend/openapi.json` 以 `cmp` 比對相同；結尾為換行、第二行縮排 2 空白；副本與主檔 `cmp` 相同                                                        | 通過 |
| 提交的介面描述檔與程式一致             | api-agent-rules A5             | 重新匯出後 `git status` 乾淨，兩個檔與提交版本無差異                                                                                                                | 通過 |
| 匯出指令預設同時寫出兩份內容相同的契約 | issue #572 §維護者裁定         | 不帶 `--output`，退出碼 0，`cmp backend/openapi.json docs/diagrams/architecture/api.openapi.json` 相同                                                              | 通過 |
| 帶輸出路徑時只寫該處                   | issue #572 §維護者裁定         | `--output $TMP/x.json` 退出碼 0，暫存目錄只有 `x.json`，副本修改時間不變                                                                                            | 通過 |
| 匯出途中寫入失敗時兩處都不留半成品     | issue #572、clarification Q8   | `uv run pytest tests/integration/test_export_openapi.py`：13 passed（含此案例，一律用 `tmp_path`）                                                                  | 通過 |

#### ci-quality-gates

| Scenario                               | 對應的規格書驗收標準   | 證據                                                                                                                                                                                              | 結果 |
| :------------------------------------- | :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--- |
| 介面描述檔或前端產物未重產時 CI 失敗   | #506 §驗收條件 2       | 既有步驟未改，`ci.yml` 的 `api-contract` job 仍比對 `backend/openapi.json`；本 change 未動該行為，`pnpm test:scripts` 的 `ci-workflow.test.mjs` 通過                                              | 通過 |
| 介面描述檔已更新但前端未重產時 CI 失敗 | #506 §驗收條件 2       | 前端 `api:generate` 與 `frontend/src/api/generated` 比對步驟原樣保留（讀 `ci.yml`）                                                                                                               | 通過 |
| 手改產物時 CI 失敗                     | #506 §驗收條件 2       | 同上，`frontend/src/api/generated` 的 `git diff` 與未追蹤檢查原樣保留                                                                                                                             | 通過 |
| 契約副本與後端契約不一致時 CI 失敗     | issue #572 §驗收條件 3 | 照 CI 步驟的指令模擬：手改副本後輸出列出 `docs/diagrams/architecture/api.openapi.json`、drift=1；另模擬已暫存的手改再匯出，仍列出該檔。錯誤訊息含 `run 'pnpm run api:sync' and commit the result` | 通過 |
| 副本漏提交或被刪除時 CI 失敗           | issue #572 §驗收條件 3 | 刪除副本後指令列出該檔（` D`）、drift=1；從索引移除再匯出時列出 `D` 與 `??`，drift 成立                                                                                                           | 通過 |
| 兩份契約都與重新匯出結果一致時通過     | issue #572 §驗收條件 3 | 乾淨狀態下指令 drift=0；`openspec/config.yaml` 的本機指令執行結果 0，手改後 `git diff` 退出碼 1，還原後通過                                                                                       | 通過 |

額外：`pnpm test:scripts` 474 個測試全部通過（含 `check.test.mjs` 副本被改動的案例）；`scripts/check.mjs` 的 `CONTRACT_PATHS` 已納入副本。前端產生工具的輸入仍只有 `backend/openapi.json`（`api:sync` 先匯出再 `api:generate`，副本不是輸入）。沒有發現 spec 沒描述的額外行為。

### Decision Table

本 change 沒有系統角色、任務成員身分的差異，改以輸入條件對應：

| 動作                     | 資料狀態             | 預期                               | 驗證方式          | 結果 |
| :----------------------- | :------------------- | :--------------------------------- | :---------------- | :--- |
| 匯出，無 `--output`      | 無環境變數、無資料庫 | 退出碼 0，兩份位元組相同           | 手動指令          | 通過 |
| 匯出，有 `--output`      | 暫存目錄             | 只寫該檔，副本不變                 | 手動指令與 pytest | 通過 |
| 匯出，一個目標目錄不存在 | 另一目標已有內容     | 退出碼非 0，既有檔不變，不留暫存檔 | pytest            | 通過 |
| 漂移檢查                 | 副本被手改           | 失敗並列出副本                     | 手動模擬          | 通過 |
| 漂移檢查                 | 副本被刪除           | 失敗並列出副本                     | 手動模擬          | 通過 |
| 漂移檢查                 | 兩份與匯出一致       | 通過                               | 手動模擬          | 通過 |

### Hard Rule 必驗項

| 規則               | 怎麼驗的                                                                                                                  | 結果   |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------ | :----- |
| 5 任務設定驅動     | 不適用：本 change 不涉及任務類型，匯出與渲染與 `input_type`、`outputs[]` 無關                                             | 不適用 |
| 6 測試集答案不外露 | 不適用：沒有新增或修改標記員能到達的端點與畫面；副本內容與既有 `backend/openapi.json` 相同（位元組比對），沒有新增 schema | 不適用 |

### DoD

| 項目                                 | 指令與結果                                                                                                                                                                                                     | 結果       |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| pytest 匯出測試                      | `cd backend && uv run pytest tests/integration/test_export_openapi.py`：13 passed                                                                                                                              | 通過       |
| ruff、mypy                           | `uv run ruff check .` All checks passed；`uv run mypy app` no issues in 21 source files                                                                                                                        | 通過       |
| `pnpm test:scripts`                  | 474 pass、0 fail                                                                                                                                                                                               | 通過       |
| `node scripts/check-specs.mjs docs`  | `check-specs: docs OK`                                                                                                                                                                                         | 通過       |
| 重新匯出後 openapi.json 無差異       | 匯出後 `git status` 乾淨，且與 `api-contract.md` 的副本說明一致                                                                                                                                                | 通過       |
| Alembic 往返（SQLite 與 PostgreSQL） | 不適用：本 change 沒有 migration                                                                                                                                                                               | 不適用     |
| 文件站建置                           | 未在本機執行 `notecraftapp build`（共用快取）；以主工作階段的建置與 CI docs-site 為準；`.notecraft/plugins.json` 已對應 `**/*.openapi.json`，`architecture.mdx` 連結 `/view/diagrams/architecture/api.openapi` | 以 CI 為準 |
| 文件同步                             | `architecture.mdx`、`api-agent-rules.mdx`（A4、A5）、`backend-modules.mdx`、`NOTICE` 已更新                                                                                                                    | 通過       |

### 人工驗收步驟（留作紀錄）

1. **啟動**：在 repo 根目錄執行 `pnpm install`，再執行 `pnpm docs:serve`，開啟 `/view/diagrams/architecture/api.openapi`（網址的 port 以該指令印出者為準；若看到舊內容，重啟 serve）。這個 change 不需要後端或前端服務，也不用設 `DATABASE_URL`。
2. **用什麼身分登入**：不需要登入，文件站是靜態頁。
3. **要點開哪幾個畫面**：開 `/view/diagrams/architecture/api.openapi`；再開 `/view/development/architecture` 的「API 契約」一節，點副本連結。
4. **每一步預期看到什麼**：API 文件頁列出端點與 schema，不是原始 JSON 文字；架構頁的連結導到同一頁。
5. **刻意要試的失敗路徑**：在 repo 根目錄執行 `echo " " >> docs/diagrams/architecture/api.openapi.json`，再 `cd backend && uv run python -m app.scripts.export_openapi`（會把副本重寫回來）；改用 `git add` 暫存該手改後匯出，執行 `git diff --exit-code --name-only -- ../docs/diagrams/architecture/api.openapi.json`，預期列出副本檔名且退出碼 1。刪除副本後執行 `git status --porcelain -- docs/diagrams/architecture/api.openapi.json`，預期列出 ` D`。
6. **收尾**：`git checkout docs/diagrams/architecture/api.openapi.json` 還原；Ctrl-C 關掉 `pnpm docs:serve`。不需清資料。

### 缺陷

無。
