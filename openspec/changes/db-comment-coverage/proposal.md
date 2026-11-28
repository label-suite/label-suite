# Proposal

## Why

`dba.md` 規定每張表與每個欄位都要有英文 comment，目前 5 張已落地的表（36 欄）也都寫了，但沒有任何自動檢查：新表或新欄漏寫、或 model 與 migration 的說明不同步，CI 都不會失敗，只靠 dba 自查。資料表字典還有 37 張候選表未落地，每落地一張就多一次漏寫的機會，所以要在這些表進來之前先補上檢查。

## What Changes

- 新增 metadata 層單元測試：與資料庫無關，`backend-sqlite` 與 `backend-postgres` 兩輪都會跑，斷言共用 metadata 內**每張表與每個欄位**的說明都非空，**包含純關聯表，不設豁免**（clarification Q3）。檢查前先載入所有模組的 model，並有兩道護欄避免 metadata 為空或不完整時空洞通過：表集合涵蓋已落地底線 5 張表；每個有 `models.py` 的模組都至少有一個 mapper。
- 新增 PostgreSQL 層整合測試（`postgres` 標記，未設 `TEST_DATABASE_URL` 時 `skipif`）：照 issue 第 2 項獨立新增（clarification Q1）。migration 升到最新後，讀資料庫實際儲存的表說明與欄位說明，要求非空且與 model **完全相等**（空白視為缺漏）。表清單只由 metadata 推出，不列舉資料庫，所以不會抓到 `alembic_version`。實作時先以負向測試在 PostgreSQL 實跑，證實既有 Alembic drift 是否比對說明，結果寫進 PR，並決定規則文件對既有 drift 角色的措辭。
- 新增共用測試輔助模組（`backend/tests/support/db_comments.py`）：載入 model、找出缺說明、讀取 PostgreSQL 說明、比對差異。失敗訊息逐條列出 `<table>.<column>` 與原因。
- 只檢查非空與一致，**不檢查說明是否為英文**（clarification Q2）；英文仍靠 review，並在規則文件寫明。
- 負向驗證自動化：以獨立的 `MetaData()` 樣本證明檢查真的會失敗並指名欄位；另在 `acceptance.md` 記錄「拿掉真實欄位說明、跑兩層、再還原」的手動步驟。
- 修正 `backend/pyproject.toml` 的 `postgres` 標記說明文字，使其與實際作法一致（標記只供篩選，略過由各測試自己的 `skipif` 決定）；不改 `conftest.py`，不改標記名稱。
- 更新規則文件：`.claude/agents/dba.md`（資料模型準則與檢查清單）、`docs/development/rules/backend-agent-rules.mdx`（已建置清單、B7 的檢查方式、決策紀錄一列）、`docs/development/rules/testing-agent-rules.mdx`（開頭已建置清單；T9 gate 表視實作是否新增 gate 而定）。
- 不改 schema、不改 `app/`、不改任何既有 model 的說明文字、不改 `docs/specs/`、PRD 與 `design/prototype/`。無 API 與 UI 變更（見 `api-contract.md`、`ui-design.md`）。
- 沒有 **BREAKING** 變更。但後續每個新增資料表的 change，model 漏寫說明就會讓 CI 失敗，這會改變後續 change 的實作成本。

## Capabilities

### New Capabilities

無（clarification Q4：不新增 capability）。

### Modified Capabilities

- `database-migration`：以 `## ADDED Requirements` 加入「說明覆蓋」相關 requirement（metadata 層非空、兩道護欄、PostgreSQL 層與 model 一致、失敗訊息格式、兩輪 CI 的略過與執行）。不修改其既有 requirement，delta 不與既有 Scenario 重複。對應檔案 `specs/database-migration/spec.md`。

## Impact

- 程式：新增 `backend/tests/unit/test_db_comments.py`、`backend/tests/integration/test_db_comments_postgres.py`、`backend/tests/support/db_comments.py`；修改 `backend/pyproject.toml` 的標記說明文字（只改字串）。`backend/app/`、`alembic/`、`conftest.py` 不動。
- 文件：`.claude/agents/dba.md`、`docs/development/rules/backend-agent-rules.mdx`、`docs/development/rules/testing-agent-rules.mdx`；`data-table-dictionary.mdx` 不更新。
- CI：不改 workflow。`backend-postgres` 的新測試不得被略過（既有的 skipped 即失敗檢查會把關）；覆蓋率基準只能持平或上升，新增測試預期不需調整基準。
- 資料與 API：無 migration、無 API、無錯誤碼、無權限異動；PostgreSQL 層只讀系統目錄。
- 後續 change：字典其餘 37 張候選表落地時自動被兩層檢查約束。

## 引用的需求來源

本 change 是技術 change，`docs/specs/` 沒有對應規格頁，依 spec-migration D4 追溯到下列 ADR 與規則文件：

- GitHub issue #822：背景、範圍 1-3、待辦六項。
- ADR-003 D7（資料庫分兩層，schema 只由 Alembic 管）。
- `backend-agent-rules.mdx` B6、B7；`testing-agent-rules.mdx` T4、T9。
- ADR-007 D1（三層測試分工）只在需要引用 metadata 層屬 unit、PostgreSQL 層屬 integration 時使用。ADR-007 沒有雙資料庫條款（clarification P1）；雙資料庫的依據是 ADR-003 D7、T4、T9 與 B6／B7。
- `.claude/agents/dba.md`（資料模型準則、Migration 準則、檢查清單）。
- 既有 `openspec/specs/database-migration`：delta 加在其上，不改其既有 requirement。
- `clarification.md` Q1 至 Q4 與技術預設表。

## 待決問題

全部已解決，決議與定案見 `clarification.md`，本 proposal 不再有待決項。

| 來源問題                         | 結果                                                                                                                                         | 位置                   |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| Q1／T6 PostgreSQL 層是否獨立新增 | 已決議：獨立新增；實作時先實跑證實既有 drift 是否比對說明                                                                                    | clarification Q1       |
| Q3 是否檢查英文                  | 已決議：只檢查非空與一致                                                                                                                     | clarification Q2       |
| Q2 純關聯表                      | 已決議：一律要求，不設豁免                                                                                                                   | clarification Q3       |
| Q6 capability 落點               | 已決議：加進 `database-migration`                                                                                                            | clarification Q4       |
| Q1／T1 model 匯入方式            | 已定案：(a) 自己掃描加兩道護欄                                                                                                               | clarification 技術預設 |
| Q4 規則文件落點                  | 已定案：B7，並同步 `testing-agent-rules.mdx`                                                                                                 | clarification 技術預設 |
| Q5 `postgres` 標記               | 已定案：沿用各檔 `skipif`，修正 `pyproject.toml` 標記說明文字                                                                                | clarification 技術預設 |
| Q7、Q8、T2 至 T5、T7             | 已定案（完全相等、負向驗證自動化、直接查詢、各檔自定 `requires_postgres`、寫死 5 張表名、失敗訊息進 Scenario、實作時以 `lint-imports` 確認） | clarification 技術預設 |
| P1、P2、P3（上游文件更正）       | 已修正，由 sa、sd 處理                                                                                                                       | clarification 已修正   |
