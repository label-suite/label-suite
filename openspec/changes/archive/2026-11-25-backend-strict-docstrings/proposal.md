# Proposal

## Why

`backend-agent-rules.mdx` B2 要求後端公開介面有型別標註與英文 docstring，但目前只有一半被機械檢查：CI 以命令列 `mypy --strict app` 跑型別檢查，`backend/pyproject.toml` 的 `[tool.mypy]` 卻沒有 `strict = true`，本機不帶參數的 `uv run mypy app` 與 CI 不一致；ruff 的 `select` 沒有 `D`，docstring 的有無完全靠審查（B2「尚未檢查」那一句）。#506 已關閉、它建立的後端 CI job 已在 `main`，issue #524 排在 #506 之後的理由已消除；之後的後端模組（例如使用者管理）會照這次定下的規則寫，規則越早落地，後續修正成本越低（system-analysis §跨模組依賴）。

## What Changes

- `backend/pyproject.toml` 的 `[tool.mypy]` 加 `strict = true`，讓本機不帶參數的 `uv run mypy app` 與 CI、`pnpm run check` 的 `uv run mypy --strict app` 檢查同一組旗標（issue #524 工作項 1）。嚴格型別檢查的範圍維持 `app`，`tests` 不納入；CI 與 `scripts/check.mjs` 的指令字串**不改**（clarification Q3，維護者 2026-11-25 裁定；system-design §檢查管線）。
- ruff 的 lint 規則 `select` 加入 `D`，`[tool.ruff.lint.pydocstyle]` 的 `convention` 設為 `google`（對應 B2 的 `Args:`／`Returns:`／`Raises:`），並設 `ignore = ["D107"]`：公開類別的 `__init__` 不另寫 docstring，建構參數寫在類別 docstring 的 `Args:`（工作項 2；clarification Q2，維護者 2026-11-25 裁定）。
- 文件註解規則只約束 `app`：`per-file-ignores` 以目錄樣式 `"tests/**"`、`"alembic/**"` 整個豁免 `D`，不逐檔列舉；baseline migration 因此不修改，符合 B6「已部署的 migration 不再改動」（clarification Q1、Q4，維護者 2026-11-25 裁定）。
- 規則清單只有 `convention = "google"` 與 `ignore = ["D107"]`，不另外忽略或啟用個別規則；設定旁加註解，寫明 B2 的私有 helper 例外靠 ruff 不檢查 `_` 開頭名稱的預設行為成立（工作項 2「私有 helper 用設定表達」；clarification Q6，維護者 2026-11-25 裁定）。
- 修掉開啟規則後 `app` 剩下的 3 處違規（工作項 3；clarification P3）：`backend/app/core/log_safety.py` 的 D301 一處；`backend/app/modules/health/repository.py`、`backend/app/modules/health/service.py` 兩個類別的建構參數移進類別 docstring 的 `Args:`。
- 修正只動 docstring，不改執行行為；若改到 router handler 或 Pydantic schema 的 docstring，要以 `pnpm run api:sync` 重新匯出 `openapi.json`（api-contract §與契約相鄰的限制）。上述 3 處都不在 handler 或 schema 上，預期不需要。
- 常駐文件 `docs/diagrams/architecture/backend-modules.mdx`：§新增業務模組的檢查清單 的 docstring 項依 Q1、Q2 改寫為限定 `app/`（`tests/`、`alembic/` 不受檢）、建構參數寫在類別 docstring 的 `Args:`（clarification P1）；§已知限制 追蹤 #524 的「`pyproject.toml` 沒有設 mypy strict」一列，在實作設定的同一組任務刪除（system-design §常駐文件異動）。
- `docs/development/rules/backend-agent-rules.mdx` B2 的「檢查方式」改成實際指令與範圍、「尚未檢查」改成現況，在本 change 由 `technical-writer` 同步（工作項 4；clarification Q5，維護者 2026-11-25 裁定）。
- 沒有 **BREAKING** 變更：不動任何端點、欄位、錯誤碼、operationId、資料表或畫面（api-contract、ui-design）。對開發端而言，`app` 內新寫的公開介面缺 docstring 時 lint 會失敗，這是本 change 刻意加上的新檢查。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `ci-quality-gates`：「後端 lint、格式與型別檢查在 CI 執行」這條 requirement 多一個失敗條件，即 `backend/app` 的公開介面缺 docstring 時 lint 那一步失敗，需補對應的 Scenario（system-analysis §跨模組依賴、system-design §關鍵情境）。lint 對 `backend/` 執行、文件註解規則只約束 `app`（clarification Q1）；嚴格型別檢查的範圍由現寫的「對 `backend/` 執行」更正為 `app`，與實際指令一致（clarification Q3、P2）。

`workspace-commands` **不修改**：`pnpm run check` 的後端 lint 與型別檢查步驟沿用與 CI 相同的指令與參數，本 change 不改這兩個指令，「check 依固定順序執行與 CI 相同的自查」這條 requirement 照樣成立（system-design §檢查管線；clarification Q3）。

## 需求來源

`docs/specs/` 沒有對應的業務規格（技術規範，依 `spec-migration.mdx` D4 屬 OpenSpec 範疇），改依 `openspec/config.yaml` context（維護者 2026-11-20 裁定，#503）追溯到 issue、規則文件與 ADR：

- issue #524：背景、工作項 1 至 4、不在範圍（維護者指定的需求依據）
- issue #524 留言：維護者 2026-11-23 裁定（blocked-by #506；mypy 一項改為「讓設定檔與 CI 的 `--strict` 一致」）
- `clarification.md` Q1–Q6：維護者 2026-11-25 裁定
- `docs/development/rules/backend-agent-rules.mdx`：B2 docstring、型別與指令（適用路徑、正例、例外、反例與檢查方式）；B6 schema 只由 Alembic 管（Q4 不修改 baseline migration 的依據）
- `docs/development/adr/003-backend-architecture.mdx`：框架選型表 A FastAPI（「mypy strict 可用」）
- 主規格 `openspec/specs/ci-quality-gates/spec.md`「後端 lint、格式與型別檢查在 CI 執行」；`openspec/specs/workspace-commands/spec.md`「check 依固定順序執行與 CI 相同的自查」

## 已決議事項

system-analysis §待決問題 #1–#6 已在 clarification 停點由維護者於 2026-11-25 逐題裁定（clarification Q1–Q6），本 proposal 依決議撰寫：

| Q   | 問題                                                                         | 決議                                                                                 | 對本 proposal 的影響                                                |
| :-- | :--------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------ |
| Q1  | 文件註解規則只套 `app`，還是整個 `backend/`（含 `tests`、`alembic`）         | A：只套 `app`，`tests/**` 與 `alembic/**` 以 `per-file-ignores` 目錄樣式整個豁免 `D` | 修正處數為 3；`ci-quality-gates` delta 的受檢範圍為 `app`           |
| Q2  | 公開類別的 `__init__` 要有自己的 docstring（D107），或參數寫進類別 docstring | A：`ignore = ["D107"]`，建構參數寫在類別 docstring 的 `Args:`                        | health 的 repository、service 兩處的修法；常駐文件檢查清單的寫法    |
| Q3  | mypy strict 只管 `app`，還是 `tests` 也納入                                  | A：只管 `app`，`[tool.mypy]` 寫 `strict = true`，指令不改                            | CI、`pnpm run check` 指令不改；`workspace-commands` 不修改          |
| Q4  | baseline migration 的 D415 怎麼處理                                          | 隨 Q1：`alembic/**` 整個豁免，不修改 baseline migration                              | 不碰 `backend/alembic/versions/`，符合 B6                           |
| Q5  | B2「檢查方式」與「尚未檢查」的同步是否放進本 change                          | A：本 change 一起改，交 `technical-writer`                                           | `tasks.md` 多一組 `docs/development/rules/` 文件任務                |
| Q6  | google 風格與忽略 D107 之外，是否另外忽略或啟用個別規則                      | A：不再加；設定旁註解私有 helper 由 ruff 預設豁免                                    | 設定檔的規則清單只有 `convention = "google"` 與 `ignore = ["D107"]` |

本 proposal 已無待決問題。

## Impact

- **程式**：`backend/pyproject.toml`（`[tool.mypy]` 的 `strict = true`；`[tool.ruff.lint]` 的 `select` 加 `D`、`ignore = ["D107"]`、`per-file-ignores` 的 `"tests/**"`、`"alembic/**"`；`[tool.ruff.lint.pydocstyle]` 的 `convention = "google"`；私有 helper 例外的註解）；`backend/app/core/log_safety.py`、`backend/app/modules/health/repository.py`、`backend/app/modules/health/service.py` 的 docstring。`backend/tests/**` 與 `backend/alembic/**` 不改。
- **CI 與本機自查**：`.github/workflows/ci.yml`、`scripts/check.mjs` 與鎖住指令字串的 `scripts/tests/ci-workflow.test.mjs`、`scripts/tests/check.test.mjs` 都不改；新規則經由既有的 `backend-sqlite` job `Lint` 步驟與 `pnpm run check` 的 `backend-lint` 步驟生效。
- **文件**：`docs/diagrams/architecture/backend-modules.mdx`（檢查清單 docstring 項、已知限制 #524 那一列，見 What Changes）；`docs/development/rules/backend-agent-rules.mdx` B2 的「檢查方式」與「尚未檢查」（Q5）。`backend-modules.mdx` 已知限制追蹤 #506 那一列已過時，不在本 change 範圍。
- **API、資料、畫面**：無。`openapi.json`、`error-codes.mdx`、`endpoint-authorization.mdx`、`frontend-routes.mdx`、資料表字典與 ER 都不動，不新增 migration。
- **依賴**：不新增套件（ruff 0.17.6、mypy 2.4.1 已在後端依賴中）。
- **Hard Rule 5、6**：不涉及任務類型的程式，也不碰任何可能帶出測試集答案的 payload（system-design §權限檢查點）。
