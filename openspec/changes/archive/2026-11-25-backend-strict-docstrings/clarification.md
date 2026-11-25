# Clarification：backend-strict-docstrings

關卡模式，檢查 system-analysis、system-design、ui-design、api-contract、proposal 五份產出；specs、design、tasks 尚未產生，相關檢查項標「後續產物」。來源 issue #524。

## 檢查結論

| #   | 面向             | 結論     | 說明                                                                                                                                                                                               |
| :-- | :--------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 規格完整性       | 待釐清   | issue 四個工作項都有對應；B2「檢查方式」文字同步不在工作項裡，列為 Q5。specs、design、tasks 的完整性為後續產物                                                                                     |
| 2   | API Contract     | 通過     | 無端點、欄位、錯誤碼、operationId 異動；與契約相鄰的限制（handler 與 schema 的 docstring 進 `openapi.json`）已寫明，`app` 的 3 處違規都不在 handler 或 schema 上                                   |
| 3   | 邏輯一致性       | 問題     | `backend-modules.mdx` 檢查清單提前宣稱檢查生效、範圍未限定（P1）；主規格 `ci-quality-gates` 寫「對 `backend/` 執行嚴格型別檢查」，實際指令只檢查 `app`（P2）；proposal 的待決問題要改成決議（P3）  |
| 4   | 可行性           | 通過     | 設定改在 `backend/pyproject.toml`，CI 與 `pnpm run check` 指令不改（`scripts/tests/check.test.mjs`、`ci-workflow.test.mjs` 鎖住指令字串）；ruff 0.17.6 支援 `convention = "google"` 與目錄層級豁免 |
| 5   | 邊界情況         | 通過     | 不涉及使用者輸入、權限或並發；唯一的邊界是 docstring 修正改到 handler 或 schema 時要重跑 `pnpm run api:sync`，已在 api-contract 與 system-design 寫明                                              |
| 6   | 跨功能影響       | 待釐清   | lint 範圍是整個 `backend/`，規則會擋 `tests` 與 `alembic`（Q1）；baseline migration 屬已部署 migration，修改牴觸 B6（Q4）；無資料庫 schema 異動，不需 migration                                    |
| 7   | 可測試性         | 後續產物 | 可測：缺 docstring 時 `uv run ruff check .` 失敗、本機不帶參數 `uv run mypy app` 為 strict；Scenario 由 specs 定義                                                                                 |
| 8   | 規格範圍         | 待釐清   | 把 `tests` 納入型別檢查會改 CI 指令，超出 issue「不在範圍」（Q3）；不改 `docs/specs/`、`00-prd.mdx`、`design/prototype/`                                                                           |
| 9   | 任務設定驅動     | 通過     | 只改 lint 與型別檢查設定和 docstring，沒有任何任務類型的分支、欄位或特判                                                                                                                           |
| 10  | 測試集答案不外露 | 通過     | 不改任何端點、回應或資料；docstring 只描述介面，不含答案或測試集資料                                                                                                                               |

`sa` 的待決問題共 6 題（system-analysis §待決問題 #1–#6），逐題成為下面的 Q1–Q6。

## 待釐清項目（Q）

### Q1. 文件註解規則套用到哪裡？

- **來源**：system-analysis 待決 #1、需求矛盾 1；system-design §設定異動
- **問題**：CI 在 `backend/` 對整個目錄跑 lint，規則一加就同時擋 `tests`（225 處）與 `alembic`（1 處）；`app` 只有 3 處
- **選項**：A 只套 `app`，`tests/**` 與 `alembic/**` 以目錄層級豁免／B `app` 加 `alembic`，只豁免 `tests`／C 整個 `backend/`
- **決議**：**A**。`tests/**` 與 `alembic/**` 用 `per-file-ignores` 的目錄樣式整個豁免 `D`，不逐檔列舉
- **理由**：B2 的對象是公開介面，測試函式不是介面；也避開修改已部署的 baseline migration（B6）
- **日期**：維護者 2026-11-25 裁定

### Q2. 公開類別的 `__init__` 要不要有自己的 docstring？

- **來源**：system-analysis 待決 #2
- **選項**：A 忽略 D107，建構參數寫在類別 docstring 的 `Args:`／B 保留 D107，`__init__` 也要寫
- **決議**：**A**。設定加 `ignore = ["D107"]`；health 的 repository 與 service 兩個類別把建構參數寫進類別 docstring
- **理由**：google 風格的慣例寫法，一個類別只寫一處
- **日期**：維護者 2026-11-25 裁定

### Q3. 嚴格型別檢查只管 `app`，還是也納入 `tests`？

- **來源**：system-analysis 待決 #3；proposal §待決問題
- **選項**：A 只管 `app`／B 也納入 `tests`（修 21 個錯誤、改 CI 與 `pnpm run check` 指令）
- **決議**：**A**。`[tool.mypy]` 寫 `strict = true`，讓本機不帶參數的 `uv run mypy app` 與 CI 的 `mypy --strict app` 一致；指令不改
- **理由**：issue 寫明不改 CI job；`tests` 的型別錯誤不在本 issue 範圍
- **日期**：維護者 2026-11-25 裁定

### Q4. baseline migration 的 D415 怎麼處理？

- **來源**：system-analysis 待決 #4、需求矛盾 2
- **決議**：**隨 Q1 決定**，`alembic/**` 整個豁免，不修改 baseline migration
- **日期**：維護者 2026-11-25 裁定 Q1 時一併決定

### Q5. B2 的「檢查方式」「尚未檢查」要不要在本 change 一起改？

- **來源**：system-analysis 待決 #5
- **選項**：A 本 change 一起改，列進 tasks 交 `technical-writer`／B 另外處理
- **決議**：**A**
- **理由**：和設定同一張 PR，避免規則文件與現況再次不一致
- **日期**：維護者 2026-11-25 裁定

### Q6. google 風格與忽略 D107 之外，還要不要額外忽略或啟用規則？

- **來源**：system-analysis 待決 #6；proposal 上游不一致第 3 點（issue「私有 helper 用設定表達」）
- **選項**：A 不再加，在設定旁註解私有 helper 由 ruff 預設豁免／B 額外忽略 D100、D104
- **決議**：**A**。設定只有 `convention = "google"` 與 `ignore = ["D107"]`，旁邊的註解寫明 B2 的私有例外靠 ruff 不檢查 `_` 開頭名稱的預設行為成立
- **理由**：實測 `_` 開頭的名稱三種量法都不被報，不需要另加規則；註解讓這個例外在設定裡看得見
- **日期**：維護者 2026-11-25 裁定

## 明確問題（P）

### P1. 新模組檢查清單提前宣稱檢查生效、範圍未限定

- **位置**：`docs/diagrams/architecture/backend-modules.mdx` §新增業務模組的檢查清單（規劃階段由 `sd` 寫入的那一項）
- **問題**：寫「公開的模組、類別、函式與方法附 google 風格的英文 docstring……`uv run ruff check .` 會擋下缺漏」，沒有限定 `app`（Q1），也沒寫 `__init__` 的寫法（Q2）
- **修正**：派 `sd` 依 Q1、Q2 改寫：限定 `app/`，`tests/`、`alembic/` 不受檢；建構參數寫在類別 docstring 的 `Args:`。「已知限制」追蹤 #524 那一列照 system-design 的安排，在實作 `pyproject.toml` 那組任務的同一張 PR 刪除

### P2. 主規格的型別檢查範圍寫成整個 `backend/`

- **位置**：`openspec/specs/ci-quality-gates/spec.md` Requirement「後端 lint、格式與型別檢查在 CI 執行」
- **問題**：寫 CI 對 `backend/` 執行嚴格型別檢查，實際指令是 `mypy --strict app`
- **修正**：交給 `planner` 的 specs delta：依 Q3 寫明嚴格型別檢查的範圍是 `app`，lint 對 `backend/` 執行、文件註解規則只約束 `app`（Q1）

### P3. 上游產出的待決問題改成決議

- **位置**：system-analysis §待決問題、system-design 各方案段落、proposal §待決問題與 §What Changes（修正範圍三種情況）
- **修正**：派 `sa`、`sd`、`planner` 各自把待決改成本文件的決議並標回修位置；proposal 的修正範圍定為 `app` 的 3 處

## 交給後續產出

- **specs**：`ci-quality-gates` 的 MODIFIED requirement 補 Scenario「公開介面缺 docstring 時 CI 失敗」，範圍 `app`；型別檢查範圍寫 `app`（P2）。`workspace-commands` 不修改。來源寫 issue #524、`backend-agent-rules` B2、本文件 Q1–Q3、Q6
- **design**：設定內容為 `[tool.mypy] strict = true`；`[tool.ruff.lint] select` 加 `D`；`[tool.ruff.lint.pydocstyle] convention = "google"`；`ignore = ["D107"]`；`per-file-ignores` 以 `"tests/**"`、`"alembic/**"` 豁免 `D`；設定旁註解私有 helper 的例外
- **tasks**：
  - `backend-developer`：改 `pyproject.toml`；依決議的設定實測只剩 1 處違規（`app/core/log_safety.py` D301，不能直接套 ruff 的 unsafe fix，`\\n` 這類寫法要一起改），另依 Q2 把 health 的 repository、service 建構參數寫進類別 docstring 的 `Args:`（ruff 不會因此失敗，由 `code-reviewer` 核對）；改到 handler 或 schema 時跑 `pnpm run api:sync`；跑 `uv run ruff check .`、`uv run mypy app`、`uv run mypy --strict app`、`uv run pytest`；同一組任務刪 `backend-modules.mdx` 「已知限制」追蹤 #524 那一列
  - `technical-writer`：`backend-agent-rules.mdx` B2 的「檢查方式」改成實際指令與範圍、「尚未檢查」改成現況（Q5）
  - 先對刻意違規的樣本確認檢查會失敗（例如暫時拿掉一個公開函式的 docstring），再提交
- **範圍外，不在本 change**：`backend-modules.mdx` 「已知限制」追蹤 #506 那一列已過時，另行處理
