## 驗收：backend-strict-docstrings

結論：通過

驗收對象：分支 `chore/backend-strict-docstrings`，HEAD `642ef1b`（PR #635 的 head 相同），2026-11-25 在本機 worktree 執行。工具版本：ruff 0.17.6、mypy 2.4.1。

本 change 只改 `backend/pyproject.toml` 的 lint 與型別檢查設定、`backend/app` 三處 docstring 與兩份常駐文件。**沒有畫面、沒有 API 異動、沒有角色或遮蔽欄位的變動**，所以 Playwright E2E、以各角色呼叫端點的 API 驗收、`endpoint-authorization.mdx` 對照與 token／cookie 檢查都不適用，也不需要登入任何角色。改用實際適用的方式驗證：在 `backend/` 暫時加入刻意違規的樣本檔，實際執行 CI 的同一組指令，確認每個 Scenario 該擋的擋、該過的過，最後刪掉樣本並以 `git status` 證明工作區乾淨。

### Scenario 結果

#### ci-quality-gates — Requirement：後端 lint、格式與型別檢查在 CI 執行（MODIFIED）

本 Requirement 的來源是規則文件（backend-agent-rules B2、testing-agent-rules T9）與 issue #524，`docs/specs/` 沒有對應的驗收標準，所以「對應的規格書驗收標準」欄寫的是規則文件與 issue 的條目。

| Scenario                             | 對應的規格書驗收標準        | 證據                                                                                                                                                                                                                                                                                                                         | 結果 |
| :----------------------------------- | :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 後端型別錯誤時 CI 失敗               | testing-agent-rules T9；B2  | 樣本 `app/core/docstring_probe.py` 只含 `def wrong_return() -> int` 回傳字串：`ruff check .` 與 `ruff format --check .` 通過，`uv run mypy --strict app` 結束碼 1：`docstring_probe.py:6: error: Incompatible return value type (got "str", expected "int")  [return-value]`                                                 | 通過 |
| 後端格式不符時 CI 失敗               | testing-agent-rules T9；B2  | 樣本只含 `def ugly( x:int )->int:`（有 docstring、有型別）：`ruff check .` 通過、`mypy --strict app` 通過，`uv run ruff format --check .` 結束碼 1：`1 file would be reformatted`，指出 `app/core/docstring_probe.py:4:10`                                                                                                   | 通過 |
| 公開介面缺 docstring 時 CI 失敗      | B2；issue #524 工作項 1；Q1 | tasks 1.2 的樣本 (a)，`uv run ruff check . --output-format concise` 結束碼 1，列出 `app/core/docstring_probe.py:4:5: D103 Missing docstring in public function`（`public_no_doc`）與 `app/core/docstring_probe.py:27:9: D102 Missing docstring in public method`（`PublicProbe.public_method`），檔名與行號都在輸出裡        | 通過 |
| 文件註解漏列參數時 CI 失敗           | B2；issue #524 工作項 1     | 同一次執行：``app/core/docstring_probe.py:8:5: D417 Missing argument description in the docstring for `args_missing`: `y` ``，輸出指出漏列的參數名 `y`                                                                                                                                                                       | 通過 |
| 私有 helper 與建構子不需要 docstring | B2 例外；Q2、Q6             | 同一次執行裡 `_private_helper`、`PublicProbe.__init__` 都沒有被報出；另外單獨放一個只含 `_private_helper` 與「類別 docstring 有 `Args:`、`__init__` 沒有 docstring」的 `PublicProbe` 的樣本，`uv run ruff check .` 結束碼 0：`All checks passed!`                                                                            | 通過 |
| 測試與遷移腳本不受文件註解規則約束   | Q1、Q4                      | 樣本 (b) `tests/test_docstring_probe.py`（無模組 docstring、`helper(x)` 與測試函式都無 docstring）與 (c) `alembic/docstring_probe.py`（無模組 docstring，只有 `VALUE = 1`）在兩次執行裡都沒有被報出；只留 (b)、(c) 與上一列的私有樣本時 `ruff check .` 結束碼 0                                                              | 通過 |
| 型別檢查範圍是 backend/app           | Q3；issue #524「不在範圍」  | 只留 (b)（`tests` 裡無型別標註的 `helper(x)`）時 `uv run mypy --strict app` 結束碼 0：`Success: no issues found in 21 source files`；同一個 `helper(x)` 放進 `app/core/docstring_probe.py` 後結束碼 1：`docstring_probe.py:4: error: Function is missing a type annotation  [no-untyped-def]`                                | 通過 |
| 本機不帶嚴格參數的型別檢查與 CI 一致 | Q3；issue #524 工作項 2     | 樣本 (a) 的 `untyped(x)`：`uv run mypy app` 與 `uv run mypy --strict app` 都結束碼 1，輸出逐字相同：`app/core/docstring_probe.py:31: error: Function is missing a type annotation  [no-untyped-def]` / `Found 1 error in 1 file (checked 22 source files)`；乾淨狀態下兩者都是 `Success: no issues found in 21 source files` | 通過 |

#### tasks 1.2 預期輸出的核對

tasks 1.2 的完成判定寫「恰好 4 筆」，第 4 筆是 `app/core/log_safety.py:11:5` 的 D301。那是 1.3 修正**之前**的狀態；1.3 已經改成 `r"""`，所以驗收時（1.3 之後）恰好是其餘 3 筆（D103、D417、D102），與預期一致，不是缺陷。mypy 兩種執行各恰好 1 筆相同錯誤，`tests` 的 `helper` 不被報出，與預期一致。

#### spec 沒描述但觀察到的行為

- 直接對 `tests/test_docstring_probe.py` 執行 `uv run mypy`（不是 CI 指令）會報 3 個錯誤：`[tool.mypy] strict = true` 對任何被指定的路徑都生效。CI 與 `pnpm run check` 只跑 `mypy --strict app`（`ci.yml` 的 `backend-sqlite`、`scripts/check.mjs` 第 82 行），所以不影響 Scenario；B2「尚未檢查」寫的「`tests` 的型別不受檢」指的就是 CI 範圍，敘述成立。
- `escape_for_log` 的 docstring 以 `main` 版與本分支版分別載入比對 `__doc__`：`docstring identical: True`（1.3 的顯示文字不變）。

### Decision Table

本 change 沒有系統角色與任務成員身分的差異（全部是 CI 與本機指令的行為），改以「檔案位置 × 違規種類 × 檢查指令」列出：

| 檔案位置                         | 內容                                         | `ruff check .` | `ruff format --check .` | `mypy --strict app` | `mypy app`     | 驗證方式 | 結果 |
| :------------------------------- | :------------------------------------------- | :------------- | :---------------------- | :------------------ | :------------- | :------- | :--- |
| `app/`                           | 公開函式無 docstring                         | 失敗 D103      | 通過                    | 通過                | 通過           | 手動樣本 | 符合 |
| `app/`                           | 公開方法無 docstring                         | 失敗 D102      | 通過                    | 通過                | 通過           | 手動樣本 | 符合 |
| `app/`                           | `Args:` 漏列一個參數                         | 失敗 D417 `y`  | 通過                    | 通過                | 通過           | 手動樣本 | 符合 |
| `app/`                           | `_` 開頭函式無 docstring                     | 通過           | 通過                    | 通過                | 通過           | 手動樣本 | 符合 |
| `app/`                           | `__init__` 無 docstring，類別 docstring 有   | 通過           | 通過                    | 通過                | 通過           | 手動樣本 | 符合 |
| `app/`                           | 一行 docstring、無型別標註                   | 通過           | 通過                    | 失敗 no-untyped-def | 同左，逐字相同 | 手動樣本 | 符合 |
| `app/`                           | 回傳型別不符                                 | 通過           | 通過                    | 失敗 return-value   | （未另跑）     | 手動樣本 | 符合 |
| `app/`                           | 未排版                                       | 通過           | 失敗                    | 通過                | （未另跑）     | 手動樣本 | 符合 |
| `tests/`                         | 無模組 docstring、函式無 docstring、無型別   | 通過           | 通過                    | 通過（不在範圍）    | 通過           | 手動樣本 | 符合 |
| `alembic/`                       | 無模組 docstring                             | 通過           | 通過                    | 通過（不在範圍）    | 通過           | 手動樣本 | 符合 |
| 無樣本（分支 HEAD 的乾淨工作區） | 1.3 修正後的 `log_safety.py`、1.4 的 `Args:` | 通過           | 通過（48 files）        | 通過（21 files）    | 通過           | 手動指令 | 符合 |

### Hard Rule 必驗項

| 規則               | 怎麼驗的                                                                                                                                                                | 結果   |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 5 任務設定驅動     | 不適用：本 change 只改 lint 與型別檢查設定和 docstring，沒有任務類型的分支、欄位或特判，與 `input_type`、`outputs[]` 無關                                               | 不適用 |
| 6 測試集答案不外露 | 不適用：沒有新增或修改標記員能到達的端點與畫面。重新匯出 `openapi.json` 後與提交版本無差異（下方 DoD），docstring 只改 `log_safety.py` 與 health 兩個類別，不含任何資料 | 不適用 |

### DoD

| 項目                                 | 指令與結果                                                                                                                                                                                                            | 結果   |
| :----------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| spec 每個 Scenario 驗證通過          | 上表 8 個 Scenario 全部通過                                                                                                                                                                                           | 通過   |
| Decision Table 都有對應驗證          | 上表每一列都以實際樣本執行                                                                                                                                                                                            | 通過   |
| lint                                 | `cd backend && uv run ruff check .`：`All checks passed!`                                                                                                                                                             | 通過   |
| 格式                                 | `uv run ruff format --check .`：`48 files already formatted`                                                                                                                                                          | 通過   |
| 型別（CI 指令）                      | `uv run mypy --strict app`：`Success: no issues found in 21 source files`                                                                                                                                             | 通過   |
| 型別（本機不帶參數）                 | `uv run mypy app`：`Success: no issues found in 21 source files`                                                                                                                                                      | 通過   |
| import 分層                          | `uv run lint-imports`：`Contracts: 4 kept, 0 broken.`                                                                                                                                                                 | 通過   |
| pytest — SQLite                      | `uv run pytest -q`（不設 `TEST_DATABASE_URL`）：`342 passed, 4 skipped`（4 個是 `postgres` 標記，依設計在 SQLite 輪略過）；刪除樣本後再跑一次結果相同                                                                 | 通過   |
| pytest — PostgreSQL                  | 本機以 `postgres:16-alpine` 容器，`TEST_DATABASE_URL=postgresql+asyncpg://...@localhost:55432/acc uv run pytest -q`：`346 passed`，0 skipped                                                                          | 通過   |
| Alembic 往返 — SQLite                | 不設 `DATABASE_URL`、`SQLITE_PATH` 指向暫存檔：`upgrade head` → `downgrade base` → `upgrade head` 都成功（baseline `0dfb129ee036`）。本 change 沒有 migration，這一項只確認沒有被設定改動破壞                         | 通過   |
| Alembic 往返 — PostgreSQL            | 同一個容器，`DATABASE_URL=...`：`upgrade head` → `downgrade base` → `upgrade head` 都成功                                                                                                                             | 通過   |
| 契約漂移                             | `uv run python -m app.scripts.export_openapi && git diff --exit-code -- openapi.json ../docs/diagrams/architecture/api.openapi.json && test -z "$(git status --porcelain -- ...)"`：結束碼 0，無差異；本次無 API 變更 | 通過   |
| 文件                                 | `pnpm check:specs`：`check-specs: docs OK`；`pnpm exec prettier --check` 兩份改動的 `.mdx`：通過；`grep -n "沒有設 mypy strict" docs/diagrams/architecture/backend-modules.mdx` 無輸出                                | 通過   |
| B2 文字與設定一致                    | 逐項比對 `backend-agent-rules.mdx` B2「檢查方式」「尚未檢查」與 `backend/pyproject.toml`：`strict = true`、`select` 含 `D`、`ignore = ["D107"]`、`convention = "google"`、`tests/**` 與 `alembic/**` 豁免 `D`，一致   | 通過   |
| CI                                   | `gh pr checks 635`（head `642ef1b`）：15 個 job 全部 pass，含 `backend-sqlite`、`backend-postgres`、`docs-site`、`e2e`、`specs`、`format`                                                                             | 通過   |
| 前端元件測試、Playwright、前端 build | 不適用：本 change 沒有改 `frontend/` 或 `e2e/`；CI 的 `frontend`、`e2e` job 照常通過                                                                                                                                  | 不適用 |
| 樣本清除                             | 刪除三個樣本後 `find . -name '*docstring_probe*'`（排除 `.venv`）無輸出，`git status --porcelain` 0 行                                                                                                                | 通過   |

### 人工驗收步驟（留作紀錄）

本 change 沒有畫面，不需要啟動後端或前端，也不需要登入任何角色。全部在終端機執行。

1. **啟動**：不需要啟動服務，也不需要設 `DATABASE_URL`。準備環境：
   - `git checkout chore/backend-strict-docstrings`（或合併後的 `main`）
   - `cd backend && uv sync --locked`
2. **用什麼身分登入**：不適用，沒有任何端點或畫面要驗。
3. **要點開哪幾個畫面**：沒有畫面。改為依序執行下列指令（都在 `backend/`）。
4. **每一步預期看到什麼**：
   1. 乾淨狀態下：`uv run ruff check .` 印 `All checks passed!`；`uv run ruff format --check .` 印 `48 files already formatted`；`uv run mypy app` 與 `uv run mypy --strict app` 都印 `Success: no issues found in 21 source files`；`uv run lint-imports` 印 `Contracts: 4 kept, 0 broken.`；`uv run pytest -q` 印 `342 passed, 4 skipped`。
   2. 照 `tasks.md` 1.2 建三個樣本檔：
      - `app/core/docstring_probe.py`：模組 docstring 一行；`public_no_doc(x: int) -> int` 無 docstring；`args_missing(x: int, y: int) -> int` 的 docstring 有 `Args:` 但只寫 `x`；`_private_helper(x: int) -> int` 無 docstring；`class PublicProbe` 有類別 docstring，`__init__(self, value: int) -> None` 與 `public_method(self) -> int` 都無 docstring；`untyped(x)` 只有一行 docstring、沒有任何型別標註。
      - `tests/test_docstring_probe.py`：無模組 docstring；`def helper(x): return x` 與 `def test_helper(): assert helper(1) == 1`。
      - `alembic/docstring_probe.py`：只有一行 `VALUE = 1`。
   3. `uv run ruff check . --output-format concise` 結束碼 1，**恰好 3 行**：`docstring_probe.py:4:5: D103`（`public_no_doc`）、``docstring_probe.py:8:5: D417 ... `y` ``（`args_missing`）、`docstring_probe.py:27:9: D102`（`public_method`），最後一行 `Found 3 errors.`。看到 `_private_helper`、`__init__`、`untyped`、`tests/` 或 `alembic/` 的檔案出現在輸出裡就是錯的。看到 `log_safety.py` 的 D301 也是錯的（1.3 已修）。
   4. `uv run mypy app` 與 `uv run mypy --strict app` 都結束碼 1，輸出**逐字相同**：`app/core/docstring_probe.py:31: error: Function is missing a type annotation  [no-untyped-def]`、`Found 1 error in 1 file (checked 22 source files)`。`tests/test_docstring_probe.py` 不出現。兩者不同（例如不帶參數時是 `Success`）就代表 `strict = true` 沒生效。
5. **刻意要試的失敗路徑**：
   - 把 `app/core/docstring_probe.py` 改成只有 `def wrong_return() -> int:`（有 docstring）回傳 `"not an int"`：`uv run mypy --strict app` 報 `Incompatible return value type (got "str", expected "int")  [return-value]`，ruff 兩項通過。
   - 改成 `def ugly( x:int )->int:`（有 docstring）：`uv run ruff format --check .` 結束碼 1，`1 file would be reformatted`；`ruff check .` 與 mypy 通過。
   - 只留 `tests/test_docstring_probe.py`：`uv run mypy --strict app` 通過；把同一個 `helper(x)`（加一行 docstring）放進 `app/core/docstring_probe.py`：報 `no-untyped-def`。
6. **收尾**：`rm app/core/docstring_probe.py tests/test_docstring_probe.py alembic/docstring_probe.py`，再 `git status --porcelain` 必須沒有任何輸出；樣本不得進任何 commit。沒有服務要關、沒有資料要清。若另外起了 PostgreSQL 容器驗 pytest，用 `docker stop <容器名>` 關掉。

### 缺陷

無。
