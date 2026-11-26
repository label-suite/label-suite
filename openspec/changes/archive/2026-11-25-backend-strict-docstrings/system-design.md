# System Design

本 change 只改工具設定（issue #524）：`backend/pyproject.toml` 的 mypy 與 ruff 設定，以及修正 `backend/app` 裡違反新規則的 docstring。它**不新增也不修改**任何 Router、Service、Repository、Model、Pydantic schema、端點或資料表，所以範本裡的 Class Diagram、Sequence Diagram、資料模型與權限各節不適用；下面每一節寫明不適用的理由，並用「設定異動」與「檢查管線」兩節說明這次真正的設計內容。

量測數字沿用 `system-analysis.md` §實測現況（`main` `b123b20`、ruff 0.17.6），本設計在同一個 worktree 以 mypy 2.4.1 與 ruff 0.17.6 重跑過，結果相同（見 [§驗證過的前提](#驗證過的前提)）。

## 分層與類別

不適用。本 change 沒有新增或修改任何類別，也不改任何類別的方法簽章或依賴；Router → Service → Repository／Model 的分層與 `[tool.importlinter]` 的四份 contract 都不動。

會被碰到的程式只有 docstring 本身，位置如下，都不改變行為（依 `clarification.md` Q1、Q2 的決議）：

| 檔案                                       | 行  | 新設定下的結果      | 會怎麼改                                                                                                                                                                 |
| :----------------------------------------- | :-- | :------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/app/core/log_safety.py`           | 11  | D301，唯一一處違規  | docstring 改成 `r"""`，同時把內文的 `\\n`、`\\r` 等雙反斜線改成單反斜線，讓顯示出來的文字不變；或改寫內文去掉反斜線。兩種寫法都不改執行行為                              |
| `backend/app/modules/health/repository.py` | 12  | 不報（D107 已忽略） | `__init__` 不寫 docstring；建構參數 `session` 寫進類別 docstring 的 `Args:`（Q2）。ruff 不會因為少了 `Args:` 而失敗，這一處是依 B2 與 Q2 的寫法補齊，由 code review 核對 |
| `backend/app/modules/health/service.py`    | 37  | 不報（D107 已忽略） | 同上，建構參數 `repository` 寫進 `HealthService` 類別 docstring 的 `Args:`                                                                                               |

## 關鍵情境

不適用 Sequence Diagram。本 change 沒有 HTTP 請求路徑，也沒有任何 Client → Router → Service → Repository → DB 的互動會改變；`openspec/specs/` 也沒有以請求為主體的 Scenario 對應這次的工作。

這次的「情境」是開發者與 CI 跑檢查時的結果。對應的 Scenario 由 `planner` 寫進 `ci-quality-gates` 的 specs delta（`clarification.md` §交給後續產出：補「公開介面缺 docstring 時 CI 失敗」，範圍 `app`），預期的行為如下，供對照：

| 情境                                 | 觸發                                                                                    | 預期結果                                                                                                         |
| :----------------------------------- | :-------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| 公開介面缺 docstring                 | `backend/app` 裡新增一個沒有 docstring 的公開函式、類別或方法，跑 `uv run ruff check .` | 以 D1xx 規則失敗；CI `backend-sqlite` 的 `Lint` 步驟與 `pnpm run check` 第 8 步 `Backend lint and format` 都停下 |
| 私有 helper 沒有 docstring           | `_` 開頭的函式、類別或方法沒有 docstring                                                | 不報；ruff 預設不把 `_` 開頭的名稱當公開介面（實測，見 §驗證過的前提）                                           |
| 公開類別的 `__init__` 沒有 docstring | 公開類別的 `__init__` 不寫 docstring，參數寫在類別 docstring 的 `Args:`                 | 不報（`ignore = ["D107"]`）                                                                                      |
| `tests`、`alembic` 沒有 docstring    | `backend/tests/**`、`backend/alembic/**` 裡的公開函式或模組沒有 docstring               | 不報（`per-file-ignores` 以目錄樣式豁免 `D`）                                                                    |
| 本機不帶參數跑型別檢查               | `cd backend && uv run mypy app`                                                         | 與 `uv run mypy --strict app` 結果相同（因為設定檔已開 strict）                                                  |

## 設定異動

範本沒有這一節；本 change 唯一的設計內容在這裡。全部改在 `backend/pyproject.toml`，內容依 `clarification.md` Q1–Q4、Q6 的決議（維護者 2026-11-25 裁定），已無替代方案。

### mypy

```toml
[tool.mypy]
plugins = ["pydantic.mypy"]
strict = true
```

- 在 `[tool.mypy]` 加 `strict = true`，`[tool.pydantic-mypy]` 不變。
- 結果：本機 `uv run mypy app` 與 CI、`pnpm run check` 的 `uv run mypy --strict app` 檢查同一組旗標。設定檔開了 strict 之後，命令列的 `--strict` 是多餘但無害的，**不改** CI 與 `scripts/check.mjs` 的指令字串（理由見 [§檢查管線](#檢查管線)）。
- 範圍只有 `app`（Q3）。`tests` 不納入型別檢查；若有人手動跑 `uv run mypy tests` 會看到 21 個錯誤（5 個檔案），不影響 CI，修它們不在本 change。

### ruff

```toml
[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "S", "ASYNC", "D"]
# Constructor parameters go in the class docstring's Args: section (B2).
ignore = ["D107"]

[tool.ruff.lint.pydocstyle]
# B2 exempts private helpers. No rule is needed for that: ruff does not check
# names that start with "_", so they stay exempt by default.
convention = "google"

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "D"]
"alembic/**" = ["D"]
```

| 設定                                                                     | 決議     | 作用                                                                                                       |
| :----------------------------------------------------------------------- | :------- | :--------------------------------------------------------------------------------------------------------- |
| `select` 加 `D`                                                          | —        | 啟用 pydocstyle 規則                                                                                       |
| `[tool.ruff.lint.pydocstyle] convention = "google"`                      | —        | google 風格；自動關掉與它衝突的規則（例如 D413 那 35 處就是因此消失）                                      |
| `ignore = ["D107"]`                                                      | Q2 A     | 公開類別的 `__init__` 不必有自己的 docstring，建構參數寫在類別 docstring 的 `Args:`                        |
| `per-file-ignores` 的 `"tests/**"` 加 `"D"`、新增 `"alembic/**" = ["D"]` | Q1 A、Q4 | 規則只約束 `app`；`tests`、`alembic` 以目錄樣式整個豁免，不逐檔列舉。baseline migration 因此不必修改（B6） |
| `pydocstyle` 旁的註解                                                    | Q6 A     | 不另加規則；B2 的私有 helper 例外靠 ruff 不檢查 `_` 開頭名稱的預設行為成立，註解讓這個例外在設定裡看得見   |

除上表外不再忽略或啟用任何規則（Q6）。註解用英文（AGENTS.md §Language Rules：程式與註解只用英文），上面的寫法是建議字句，`backend-developer` 可調整措辭但要保留兩個意思：私有例外的來源是 ruff 的預設、所以不加規則。

### 修正 docstring 時的限制

- **router handler 與 Pydantic schema 的 docstring 會進 `openapi.json`**（FastAPI 把 handler 的 docstring 當 operation 的 `description`，Pydantic 把類別 docstring 當 schema 的 `description`，現有 `backend/openapi.json` 已有這些字串）。改到它們就要跑 `pnpm run api:sync`，否則 CI 的 `api-contract` job 與 `pnpm run check` 第 7 步 `Contract sync` 會判成漂移。這次要改的三處（`log_safety.py`、health 的 repository 與 service 的類別 docstring）都不在 handler 或 schema 上，預期 `openapi.json` 不變；實作時若改到其他 docstring，要重新匯出並提交。
- D301 用 `r"""` 修時，內文的 `\\n` 要一起改成 `\n`，否則 raw string 會讓顯示出來的文字多一個反斜線；ruff 的 unsafe fix 只加 `r` 前綴，不會幫你改內文，所以要逐處看過。
- 不用 `ruff check --fix --unsafe-fixes` 一次修完；D1xx 沒有自動修法。

## 檢查管線

新規則經由既有的指令生效，**不改任何 CI job 或 `pnpm run check` 的步驟**（issue #524「不在範圍」；`openspec/specs/workspace-commands/spec.md` 要求本機每一步與 CI 同指令同參數）。

| 設定                                | CI（`.github/workflows/ci.yml`）                                                                                  | `pnpm run check`（`scripts/check.mjs`）                                      | 指令是否改變 |
| :---------------------------------- | :---------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------- | :----------- |
| ruff 加 `D`                         | `backend-sqlite` job 的 `Lint` 步驟：`uv run ruff check .`（`working-directory: backend`，範圍是整個 `backend/`） | 第 8 步 `backend-lint`（Backend lint and format）：`uv run ruff check .`     | 不變         |
| mypy strict                         | `backend-sqlite` job 的 `Check types` 步驟：`uv run mypy --strict app`                                            | 第 9 步 `backend-typecheck`（Backend typecheck）：`uv run mypy --strict app` | 不變         |
| docstring 改到 handler 或 schema 時 | `api-contract` job 的 OpenAPI 漂移檢查                                                                            | 第 7 步 `api-contract`（Contract sync）                                      | 不變         |

- `backend-postgres` job 只跑 pytest，不跑 lint 與型別檢查，不受影響。
- `scripts/tests/ci-workflow.test.mjs`（第 91 至 96 行附近）與 `scripts/tests/check.test.mjs`（第 78、79 行）鎖住了 `ruff check`、`mypy --strict app` 這兩個指令字串。命令列保留 `--strict` 就不必動這兩份測試；若之後要把 `--strict` 從命令列拿掉，要連同這兩份測試與 CI 一起改，屬另一個 change。
- CI 的 lint 範圍是整個 `backend/`，所以 `tests/**` 與 `alembic/**` 的目錄豁免是合併前 CI 能全綠的前提：拿掉它們，`ruff check .` 會多出 226 處（`tests` 225、`alembic` 1）。

## 驗證過的前提

在 worktree（`b123b20`）的 `backend/` 重跑。設計回修時（2026-11-25，依 clarification 決議）另把 `backend/` 複製到暫存目錄，`pyproject.toml` 換成上面 [§設定異動](#設定異動) 的**完整設定**，用本專案的環境（ruff 0.17.6、mypy 2.4.1）在複本根目錄跑與 CI 相同的指令：

| 量法                                                                     | 結果                                                                                                                                                              |
| :----------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 決議後的完整設定，`uv run ruff check .`（與 CI `Lint` 步驟同指令同範圍） | **1 處**：`app/core/log_safety.py:11:5: D301 Use r""" if any backslashes in a docstring`，exit 1。health 的兩個 `__init__`（D107）已不報，`tests`、`alembic` 不報 |
| 同上，`uv run mypy app`（不帶 `--strict`）                               | `Success: no issues found in 21 source files`                                                                                                                     |
| 同上，`uv run mypy --strict app`                                         | `Success: no issues found in 21 source files`，與上一列相同，證明設定檔與命令列兩者疊加無衝突                                                                     |
| 規劃時：`uv run ruff check app --select D`，google 風格，無 `ignore`     | 3 處：D301 `app/core/log_safety.py:11`、D107 `app/modules/health/repository.py:12`、D107 `app/modules/health/service.py:37`                                       |
| 規劃時：`uv run ruff check . --select D`，google 風格，無目錄豁免        | 229 處（D103 ×215、D107 ×4、D101 ×3、D104 ×3、D102 ×2、D301 ×1、D415 ×1），與 system-analysis 一致                                                                |
| 規劃時：`mypy tests`（設定檔 strict）                                    | 21 errors，5 個檔案；依 Q3 不在本 change 範圍                                                                                                                     |

所以實作只需修 D301 一處就能讓 `ruff check .` 通過；health 兩個類別的 `Args:` 是依 Q2 的寫法補齊，不是為了讓檢查通過。

## 常駐文件異動

- 常駐文件：`docs/diagrams/architecture/backend-modules.mdx`

本 change 不動任何模組的分層、Class 圖或主要 Sequence 圖，但「後端基礎建設」與「已知限制」兩節有兩處要跟著本 change 同步。

| 節                                      | 異動 | 狀態                         | 摘要                                                                                                                                                                                                                                                                                                |
| :-------------------------------------- | :--- | :--------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §後端基礎建設 → §新增業務模組的檢查清單 | 加項 | 規劃階段已寫入，依 P1 回修   | 加一項：`app/` 裡公開的模組、類別、函式與方法附 google 風格英文 docstring（`tests/`、`alembic/` 不受檢），`_` 開頭的私有 helper 免寫，建構參數寫在類別 docstring 的 `Args:`、`__init__` 免寫；`uv run ruff check .` 會擋；router handler 與 schema 的 docstring 會進 `openapi.json`，改了要重新匯出 |
| `updatedAt`                             | 更新 | 規劃階段已寫入               | `2026-11-23` 改為 `2026-11-25`                                                                                                                                                                                                                                                                      |
| §已知限制                               | 刪列 | **刻意延到實作，規劃時不刪** | 刪掉「`pyproject.toml` 沒有設 mypy strict」那一列（追蹤 #524）。要等設定真的改了，這一列才不成立，所以由實作 `backend/pyproject.toml` 的那組任務在同一個 PR 裡刪，交給 `planner` 寫進 `tasks.md`；`code-reviewer` 核對這列已刪                                                                      |

順帶觀察（不在本 change 範圍）：§已知限制 的「CI 的後端檢查……只在本機跑」那一列追蹤 #506，#506 已關閉且 CI 已有 `backend-sqlite`、`backend-postgres`、`api-contract` job，該列也已過時。

## 資料模型異動

本次無資料模型異動。不新增 Alembic migration，`data-table-dictionary.mdx` 與 `database-schema.er.json` 不動，SQLite 與 PostgreSQL 都不受影響。

既有 migration 檔也不動：依 Q4，`alembic/**` 整個豁免 `D`，baseline migration 的 D415 不必修，B6「已部署的 migration 不再改動」不受影響。

## 權限檢查點

不適用。本 change 不新增或修改端點、不碰認證與授權的依賴、不改任何回應欄位，PRD §權限矩陣 與欄位遮蔽都不受影響。

測試集答案隔離（Hard Rule 6）：無風險。修改的只有 docstring 與檢查工具的設定；唯一可能流出到 API 的是 handler 與 schema 的 docstring（會進 `openapi.json`），而本 change 不新增任何描述答案或測試集的文字。

任務設定驅動（Hard Rule 5）：不涉及，本 change 沒有任務類型相關的程式。

## 技術待決問題

`system-analysis.md` 的六題已由維護者在 2026-11-25 全部裁定（`clarification.md` Q1–Q6），本設計照決議寫，沒有剩下的技術待決問題。

| #   | 問題                                                                          | 決議                                                                                  | 回修位置                                        |
| :-- | :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ | :---------------------------------------------- |
| 1   | 文件註解規則只套 `app`，還是整個 `backend/`                                   | Q1 A：只套 `app`；`"tests/**"`、`"alembic/**"` 以 `per-file-ignores` 目錄樣式豁免 `D` | §設定異動 → ruff、§檢查管線                     |
| 2   | 公開類別的 `__init__` 要不要自己的 docstring（D107）                          | Q2 A：`ignore = ["D107"]`，建構參數寫在類別 docstring 的 `Args:`                      | §分層與類別、§設定異動 → ruff、常駐文件檢查清單 |
| 3   | mypy strict 只管 `app`，還是 `tests` 也納入                                   | Q3 A：只管 `app`；`[tool.mypy] strict = true`，CI 與 `pnpm run check` 指令不改        | §設定異動 → mypy                                |
| 4   | baseline migration 的 D415                                                    | Q4：隨 Q1，`alembic/**` 整個豁免，不改 migration                                      | §設定異動 → ruff、§資料模型異動                 |
| 5   | `backend-agent-rules.mdx` B2「檢查方式」與「尚未檢查」的同步是否放進本 change | Q5 A：放進本 change，由 `planner` 列進 `tasks.md` 交 `technical-writer`；不影響設定   | 不影響本文件                                    |
| 6   | google 風格之外是否另外忽略或啟用規則                                         | Q6 A：不再加；設定旁註解寫明私有 helper 例外靠 ruff 不檢查 `_` 開頭名稱的預設         | §設定異動 → ruff                                |
