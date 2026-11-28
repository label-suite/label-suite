# Design

## Context

本 change 只新增測試與輔助模組、修一段標記說明文字、更新三份規則文件，`backend/app/`、`alembic/`、資料表與 API 都不動（動機見 proposal.md「Why」，行為見 `specs/database-migration/spec.md`）。因此沒有 Router、Service、Repository，也沒有執行期元件；技術面的細節（輔助模組的函式、查詢、訊息格式）已寫在 `system-design.md`，本文只記決策、取捨、風險與步驟。決議以 `clarification.md` 為準。

限制：

- `alembic/env.py` 匯入即執行 migration，無法在 Alembic 環境外重用其 model 掃描函式（system-design §model 匯入）。
- import-linter 契約 `Core does not depend on modules` 擋住把掃描抽進 `app/core`（同上）。
- SQLite 不儲存說明，只有 PostgreSQL 能驗證資料庫端（system-design §資料模型異動的雙資料庫差異表）。

## Goals / Non-Goals

**Goals:**

- 任何新表或新欄漏寫說明，或 PostgreSQL 說明與 model 不同步，都讓 CI 失敗並指名 `表.欄位`。
- 檢查本身不會因掃描不完整而空洞通過。

**Non-Goals:**

- 不檢查說明是否為英文（clarification Q2）。
- 不抽共用掃描函式、不改 `env.py`、不改 `conftest.py`、不改 CI workflow。
- 不重寫既有 drift 測試，也不要求每個新表群組另寫 drift 測試。

## Decisions

### D1. 兩層檢查：metadata 層與 PostgreSQL 層都做

metadata 層（unit，兩輪都跑）擋住「model 漏寫」與「兩邊都沒說明」；PostgreSQL 層（integration，`backend-postgres` 才跑）擋住「migration 與 model 說明不同步」。依 clarification Q1 獨立新增 PostgreSQL 層，不依賴既有 drift。

- 替代：只加強 metadata 層、要求每個新表群組都寫 drift 測試。否決：依賴人記得寫，且訊息不指名欄位（system-design §與既有 drift 比對的關係、T6）。

### D2. model 匯入：測試輔助模組照 `env.py` 規則自己掃，加兩道護欄

對應 system-design §model 匯入 的 (a)。護欄 1：表集合非空且涵蓋 5 張已落地的表（子集判斷，新表不必改測試）。護欄 2：每個有 `models.py` 的模組在 mapper 登錄中至少有一個類別。

- 替代 (b) 抽共用函式：要動 import-linter 契約、`import_tree.py` 與 `env.py`，超出範圍。
- 替代 (c) 測試各自匯入：新模組落地時空洞通過。
- 代價：掃描規則複製一份，由護欄 2 抵銷漂移。

### D3. 比對規則：完全相等；缺漏用 `strip()` 後為空判定

兩邊來源是同一段字串，放寬會掩蓋 migration 抄錯尾端空白之類的漂移；PostgreSQL 與 Alembic 都不分「空字串」與「沒有說明」，所以空白視為缺漏（system-design §介面約定、§比對）。

### D4. PostgreSQL 層直接查系統目錄，表清單只由 metadata 推出

用 `obj_description`／`col_description`，表名一律綁定參數；不列舉資料庫內的表，所以 `alembic_version` 不會被抓到（system-design §PostgreSQL 層）。`Inspector` 只在實作時當交叉驗證，不是被測路徑。

- 替代：用 `Inspector.get_table_comment`／`get_columns`。程式較短、底層同源，但把檢查綁在函式庫的反射行為上；留作交叉驗證。

### D5. 略過機制：各檔自行 `skipif`，不動 `conftest.py`

沿用 `test_health.py` 的寫法，`requires_postgres` 在新檔自定義一行。`skipif` 在收集階段求值，被略過時 `migrated_engine` 不會建立；不用夾具內動態 `pytest.skip()`，避免 PostgreSQL 回合悄悄停跑。標記說明文字與實際作法不符，一併改字串（`pyproject.toml`），不改行為（system-design §SQLite 回合略過 PostgreSQL 層；clarification 技術預設）。

### D6. 負向驗證：純函式加獨立 `MetaData()` 樣本

比對寫成純函式，單元測試用獨立樣本證明「缺漏與不一致都會失敗並指名 `表.欄位`」，不登錄進共用 `Base.metadata`，SQLite 回合也跑得到。「拿掉真實欄位說明、跑兩層、再還原」的手動步驟由 acceptance-verifier 寫進 `acceptance.md`（system-design §故意拿掉一個欄位說明）。

### D7. 先以負向測試在 PostgreSQL 實跑，證實既有 drift 是否比對說明

這是 tasks 的第一步，在寫規則文件之前完成（clarification Q1）。做法：

1. 對乾淨的 PostgreSQL（本機 `docker run postgres:16`）升到最新。
2. 暫時（不提交）把某個既有 model 的一個欄位說明改掉，再跑既有 `test_account_schema.py` 的 drift 斷言（`compare_metadata`）；另做一次「兩邊都拿掉說明」的對照。
3. 記錄：(a) 說明不同時 drift 是否非空；(b) 兩邊都沒有說明時 drift 是否為空。還原改動。

結果如何影響規則文件措辭：

| 實跑結果                  | 規則文件寫法                                                                                                                   |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------------------- |
| (a) drift 非空            | 寫「既有 drift 比對已涵蓋 model 與資料庫的說明差異；本檢查補上兩邊都沒有說明、沒有 drift 測試的表、以及指名 `表.欄位` 的訊息」 |
| (a) drift 為空            | 寫「既有 drift 比對不涵蓋說明；說明一致由本檢查的 PostgreSQL 層負責」                                                          |
| 無法在本機取得 PostgreSQL | 不下結論，只寫本檢查涵蓋什麼，不描述既有 drift 的角色；實跑結果等 CI `backend-postgres` 的證據，PR 註明                        |

結果寫進 PR 描述。這一步不產生任何提交的檔案，也不改 system-design（它已標示「未實跑」）。

## Risks / Trade-offs

- [掃描規則與 `env.py` 漂移] → 護欄 2 逐模組交叉核對，漏掃時直接指名模組。
- [寫死 5 張表名，表更名時要同步改] → 接受（clarification 技術預設）；更名本來就要改 migration 與測試。
- [本機沒有 PostgreSQL，PostgreSQL 層的實跑證據只能來自 CI] → 以 CI `backend-postgres` 為證據並在 PR 說明；`check-junit-skips.mjs` 保證它沒有被略過。
- [後續每個新表漏寫說明都會讓 CI 失敗] → 這是預期效果；失敗訊息指名 `表.欄位`，修正成本低。
- [`text()` 查詢被 semgrep 規則誤報] → 只在測試內使用且參數綁定；實作時跑 `semgrep` 確認（system-design §讀取）。
- [unit 測試 import `app.modules.*.models` 被 import-linter 或 `test_layer_boundaries.py` 判違規] → 預期不受影響（tests 不在 `app` 根套件內），以 `uv run lint-imports` 確認；若違規則停下回報，不自行放寬契約。

## Migration Plan

無 schema、無 Alembic migration，沒有 down 可講。上線即合併；回滾為還原本 change 的提交（新增的測試與輔助模組、標記說明字串、三份規則文件）。沒有資料或設定需要處理。
