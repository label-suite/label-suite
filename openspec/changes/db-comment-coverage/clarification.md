# Clarification

## 檢查範圍

關卡模式：檢查 `system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md`、`proposal.md` 五份。specs、design、tasks 還沒產生，相關的檢查項標「後續產物」。

## 檢查結論

| 面向             | 結論                                                                                                                                                                                      | 問題數 |
| :--------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 規格完整性       | 通過：issue #822 的六項待辦都有對應；技術 change，沒有 `docs/specs/` 規格頁可追溯，改追溯 ADR-003 D7、`backend-agent-rules` B6／B7、`testing-agent-rules` T4／T9、`dba.md`                | 0      |
| API Contract     | 通過：本次無 API 變更                                                                                                                                                                     | 0      |
| 邏輯一致性       | 問題 → 已列 P1、P2：system-analysis 引 ADR-007 談雙資料庫兩輪，但 ADR-007 D1–D5 沒有這條；system-analysis 寫「既有 drift 比對不涵蓋說明」，system-design 讀原始碼認為 PostgreSQL 上會比對 | 2      |
| 可行性           | 通過：metadata 層採複製 `env.py` 的掃描規則（`env.py` 匯入即執行 migration，無法重用；共用函式會撞 import-linter「Core does not depend on modules」）                                     | 0      |
| 邊界情況         | 通過：空 metadata 的空洞通過以兩道護欄擋下；`alembic_version` 由「表清單只從 metadata 推出」排除；SQLite 不支援說明，PostgreSQL 層在 SQLite 回合以 `skipif` 略過                          | 0      |
| 跨功能影響       | 通過：不改 schema、不改 `app/`；只新增測試與輔助模組、更新三份規則文件，並修正 `backend/pyproject.toml` 的 `postgres` 標記說明文字（只改文字，見技術預設表）                              | 0      |
| 可測試性         | 通過：負向驗證自動化（Q8 預設）；PostgreSQL 層在 CI `backend-postgres` 執行，`check-junit-skips.mjs` 不受影響                                                                             | 0      |
| 規格範圍         | 已決議（Q4）：delta 加進既有的 `database-migration`                                                                                                                                       | 1      |
| 任務設定驅動     | 通過：與任務類型無關                                                                                                                                                                      | 0      |
| 測試集答案不外露 | 通過：不碰任何標記員可到達的資料                                                                                                                                                          | 0      |

## 決議（Q）

### Q1. PostgreSQL 層是否仍獨立新增

- **來源**：`system-design.md` 技術待決 T6；`proposal.md` 待決問題 13
- **問題**：Alembic `compare_metadata` 在支援說明的方言上會比對表與欄位說明，既有 `drift == []` 測試可能已擋下「model 改了、migration 沒跟上」（只讀原始碼，未在 PostgreSQL 實跑）；drift 抓不到兩邊都沒說明、沒有 drift 測試的新表、也不指名欄位
- **決議**：照 issue 第 2 項獨立新增 PostgreSQL 層；實作時先以負向測試在 PostgreSQL 實跑，證實既有 drift 是否比對說明，結果寫進 PR
- **理由**：PostgreSQL 層涵蓋所有表、訊息指名「表.欄位」，不依賴每張表各自有 drift 測試；實跑結果決定規則文件怎麼描述既有 drift 的角色
- **已回修**：`proposal.md`、`system-design.md`（交 planner、sd 標已決議）
- **日期**：2026-11-28

### Q2. 是否檢查「說明是英文」

- **來源**：`system-analysis.md` 待決問題 3
- **問題**：`dba.md` 規定英文，issue 只要求非空
- **決議**：只檢查非空，以及 PostgreSQL 層與 model 一致；英文仍靠 review
- **理由**：英文判定容易誤判（專有名詞、縮寫），自動化收益低
- **已回修**：`proposal.md`（交 planner）
- **日期**：2026-11-28

### Q3. 純關聯表是否也要求說明

- **來源**：`system-analysis.md` 待決問題 2
- **問題**：目前沒有純關聯表，之後的多對多中介表要不要豁免
- **決議**：一律要求，不設豁免機制
- **理由**：規則一致，免維護豁免清單；寫一句說明的成本很低
- **已回修**：`proposal.md`（交 planner）
- **日期**：2026-11-28

### Q4. delta 放進哪個 capability

- **來源**：`system-analysis.md` 待決問題 6；`proposal.md` §Capabilities
- **問題**：新增 capability、加進 `database-migration`，或加進 `ci-quality-gates`
- **決議**：加進既有的 `database-migration`（`## ADDED Requirements`），不新增 capability
- **理由**：說明是否寫進資料庫、是否與 model 一致，和 migration 同一個話題
- **已回修**：`proposal.md` §Capabilities（交 planner）；`specs/database-migration/spec.md`（後續產物）
- **日期**：2026-11-28

## 依上游建議定案的技術預設（非維護者題）

以下各題 system-analysis／system-design 都給了明確建議、屬實作層的技術選擇，主 session 依建議定案並在此留痕（2026-11-28）：

| 題                                  | 定案                                                                                                                                                                                                               |
| :---------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| model 怎麼確保都已匯入（SA 1、T1）  | 測試輔助模組 `backend/tests/support/db_comments.py` 照 `env.py` 的規則自己掃描；兩道護欄：表集合非空且涵蓋 5 張已落地的表（子集判斷）、每個 `app/modules/*/models.py` 都至少有一個 mapper。不抽共用函式，T1 不發生 |
| 規則文件落點（SA 4）                | 掛 `backend-agent-rules` B7，並同步 `testing-agent-rules.mdx` 開頭的已建置清單（T9 gate 表視實作是否新增 gate 而定）                                                                                               |
| `postgres` 標記是否自動略過（SA 5） | 沿用各檔自行 `skipif(TEST_DATABASE_URL is None)`，不改 `conftest.py`；`pyproject.toml` 標記說明與實際不符屬既有問題，本 change 一併修正其文字                                                                      |
| 字串比對（SA 7）                    | 完全相等；`None` 或 `strip()` 後為空視為缺漏                                                                                                                                                                       |
| 負向驗證（SA 8）                    | 自動化：比對寫成純函式，以獨立 `MetaData()` 的樣本做單元測試；拿掉說明再還原的人工步驟另列入 `acceptance.md`                                                                                                       |
| 讀取方式（T2）                      | 直接查 `obj_description`／`col_description`（參數綁定）                                                                                                                                                            |
| `requires_postgres`（T3）           | 本檔自行定義一行，與 `test_health.py` 相同                                                                                                                                                                         |
| 寫死 5 張表名（T4）                 | 接受，作為防空洞通過的底線                                                                                                                                                                                         |
| 失敗訊息格式（T5）                  | 寫進 Scenario：逐條列出 `表.欄位` 與原因                                                                                                                                                                           |
| import-linter（T7）                 | 實作時以 `uv run lint-imports` 與 `test_layer_boundaries` 確認，不需維護者決定                                                                                                                                     |

## 已修正（P）

| 編號 | 位置                                                               | 問題                                                                   | 修正                                                                                                                  |
| :--- | :----------------------------------------------------------------- | :--------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| P1   | `system-analysis.md` 需求依據                                      | 引 ADR-007 談雙資料庫兩輪；ADR-007 D1–D5 沒有這條（D1 是三層測試分工） | 改引 ADR-003 D7、`testing-agent-rules` T4／T9、`backend-agent-rules` B6／B7；ADR-007 D1 只在談三層分工時引用（交 sa） |
| P2   | `system-analysis.md`「既有 drift 比對不涵蓋說明」                  | 與 system-design 讀原始碼的結論不一致                                  | 改寫為「未經實跑確認；依原始碼，PostgreSQL 上可能已比對說明，實作時以負向測試證實（Q1）」（交 sa）                    |
| P3   | `system-analysis.md`、`system-design.md`、`proposal.md` 的待決問題 | 已在本檔決議或定案，仍寫成待決                                         | 各自標「已決議／已定案，見 clarification」（交 sa、sd、planner）                                                      |

## 移出本次的驗收標準

無。

## 交給後續產出

- specs：`database-migration` 加 `## ADDED Requirements`，至少涵蓋：每張表與每個欄位的說明非空（metadata 層）、migration 後 PostgreSQL 的說明與 model 一致（PostgreSQL 層）、失敗訊息逐條列出 `表.欄位` 與原因、SQLite 回合略過 PostgreSQL 層而 `backend-postgres` 必須執行；來源引 ADR-003 D7、B6／B7、T4／T9、`dba.md` 與本檔 Q1–Q4
- design：寫明兩道護欄、表清單只從 metadata 推出、比對規則（完全相等、空白視為缺漏）、負向驗證的樣本做法，以及「先以負向測試實跑證實既有 drift 是否比對說明」的步驟與結果如何影響規則文件的措辭
- tasks：實作標 `[@backend-developer]`；規則文件更新標 `[@technical-writer]` 或依 tasks 規則指派；驗證含 SQLite 與 PostgreSQL 兩輪 `uv run pytest`、`uv run lint-imports`、`ruff`、`mypy --strict`、故意拿掉一個欄位說明確認兩層都失敗並列出該欄位（自動化負向測試 + `acceptance.md` 人工步驟）
- 規則文件只寫「已建置」與檢查方式，不改需求
