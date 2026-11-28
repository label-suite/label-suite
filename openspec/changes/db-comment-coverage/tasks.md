# Tasks

## 1. 先實跑證實既有 drift 是否比對說明

- [ ] 1.1 在 PostgreSQL（本機 `docker run postgres:16`，設 `TEST_DATABASE_URL`）升到最新後，暫時改動一個既有欄位的說明，跑既有 drift 斷言；另做「兩邊都沒有說明」的對照（model 端拿掉該說明，資料庫端對同一欄位執行 `COMMENT ON COLUMN <table>.<column> IS NULL`）；記錄兩種情況 drift 是否為空，以 `git checkout -- <被改的 model 檔>` 還原，把結果寫進 PR 描述（design D7）。驗證：`git status` 無殘留改動，PR 描述含兩種情況的結果；本機無法取得 PostgreSQL 時，在 PR 註明改以 CI `backend-postgres` 為證據、不下結論 [@backend-developer]

## 2. metadata 層檢查（TDD）

- [ ] 2.1 先寫失敗測試再實作 `backend/tests/support/db_comments.py` 的載入與缺漏檢查，以及 `backend/tests/unit/test_db_comments.py`：model 載入、表集合涵蓋已落地底線 5 張表、每個有 `models.py` 的模組都有 mapper、每張表與欄位說明非空（含純關聯表，無豁免）、缺漏判定用 `strip()`、失敗訊息逐條列出 `表.欄位` 與原因。驗證：`cd backend && uv run pytest tests/unit/test_db_comments.py` 通過，對應 spec 的「每張資料表與每個欄位都有非空說明」與「檢查不得因資料模型未載入而空洞通過」各 Scenario [@backend-developer]
- [ ] 2.2 為缺漏判定與護欄補上負向樣本測試：用獨立 `MetaData()`（不登錄進共用 `Base.metadata`）證明缺欄位說明、缺表說明、空白說明、空表集合、缺底線表都會失敗並指名 `表.欄位` 或模組。驗證：`uv run pytest tests/unit/test_db_comments.py` 通過，且共用 `Base.metadata` 的表集合在測試前後相同 [@backend-developer]

## 3. PostgreSQL 層檢查（TDD）

- [ ] 3.1 先寫比對純函式的失敗樣本測試再實作：完全相等、資料庫缺說明、說明不同（含只差頭尾空白）、表或欄位不在資料庫、`alembic_version` 不在檢查範圍；失敗訊息一次列出全部違規並含兩邊內容。驗證：`uv run pytest tests/unit/test_db_comments.py` 通過，對應 spec 的「失敗訊息逐條指名」與「PostgreSQL 實際儲存的說明與資料模型完全一致」的失敗類 Scenario [@backend-developer]
- [ ] 3.2 新增 `backend/tests/integration/test_db_comments_postgres.py`：`pytestmark = pytest.mark.integration`，加 `@pytest.mark.postgres` 與 `skipif(TEST_DATABASE_URL is None)`，用 `migrated_engine` 以參數綁定讀 `obj_description`／`col_description`，表清單只由 metadata 推出，只讀不寫。驗證：未設 `TEST_DATABASE_URL` 時 `uv run pytest tests/integration/test_db_comments_postgres.py` 顯示 skipped 且不連資料庫；設了時通過且 skipped 為 0 [@backend-developer]
- [ ] 3.3 修正 `backend/pyproject.toml` 的 `postgres` 標記說明文字，改為「標記只供篩選；略過由各測試自己的 `skipif` 決定」，不改標記名稱與行為。驗證：`uv run pytest --markers` 顯示新說明，`uv run pytest` 無新增警告 [@backend-developer]

## 4. 後端驗證

- [ ] 4.1 SQLite 與 PostgreSQL 兩輪各跑一次完整後端測試：`cd backend && uv run pytest`（回報 passed 與 skipped 數量，SQLite 輪 skipped 含新的 PostgreSQL 層）；`TEST_DATABASE_URL=postgresql+asyncpg://... uv run pytest`（應 0 skipped）。本機無 PostgreSQL 時，以 CI `backend-postgres` job 的結果與 `check-junit-skips.mjs` 通過為 PostgreSQL 證據，並在回報中明說；另確認 CI `backend-postgres` 的 `check-junit-skips.mjs` 通過，證明新的 PostgreSQL 層測試沒被略過 [@backend-developer]
- [ ] 4.2 靜態檢查全過：`cd backend && uv run lint-imports`、`uv run ruff check .`、`uv run ruff format --check .`、`uv run mypy --strict app`，並對新檔跑 `semgrep`（`.semgrep/test-boundaries.yml`）；確認 `tests/unit/test_layer_boundaries.py` 仍通過、覆蓋率基準不需調整。驗證：各指令結束碼 0 [@backend-developer]
- [ ] 4.3 確認契約沒有漂移（本 change 不動 `app/`，預期無差異）：`cd backend && uv run python -m app.scripts.export_openapi && git diff --exit-code -- openapi.json ../docs/diagrams/architecture/api.openapi.json`，並確認與 `api-contract.md` 的「無 API 變更」一致 [@backend-developer]

## 5. 規則文件（依 1.1 的實跑結果措辭，可平行）

- [ ] 5.1 更新 `.claude/agents/dba.md`：§資料模型準則的「每個欄位加英文 `comment`」與 §檢查清單對應項，註明「說明存在」與「PostgreSQL 與 model 一致」已由 CI 兩層測試檢查，「英文」與品質仍靠 review。驗證：`pnpm check:specs` 通過，且文字不宣稱英文已被自動檢查 [@technical-writer]
- [ ] 5.2 更新 `docs/development/rules/backend-agent-rules.mdx`：開頭「在 CI 跑的」清單加入本檢查；B7 的「檢查方式」寫明兩個測試檔路徑，以及 `backend-sqlite` 跑 metadata 層、`backend-postgres` 兩層都跑；既有 drift 的角色依 design D7 的表措辭；決策紀錄加一列（理由一句，連到 ADR-003 D7）。驗證：`pnpm check:specs` 通過；不在 worktree 跑 `notecraftapp build`（會污染全機快取，主倉庫也看不到改動），文件站建置以 CI 的 `docs-site` job 為證據 [@technical-writer]
- [ ] 5.3 更新 `docs/development/rules/testing-agent-rules.mdx`：開頭已建置清單加入本檢查；T9 gate 表第五列若實作沒有新增 gate 則維持原樣，只在檢查方式補一句。驗證：`pnpm check:specs` 通過，與 5.2 對「CI 跑了什麼」的說法一致 [@technical-writer]

## Workflow follow-up

- `acceptance.md` 由 acceptance-verifier 撰寫，須含手動步驟：暫時拿掉一個真實欄位說明、跑 metadata 層與（設了 `TEST_DATABASE_URL` 時）PostgreSQL 層、確認兩層都失敗並列出該 `表.欄位`、再還原。
- 實作完成後交 code-reviewer 審查、acceptance-verifier 驗收，通過後由 ops 歸檔並同步主規格。
