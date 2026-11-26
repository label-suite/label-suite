# Design

## Context

`backend/pyproject.toml` 的 `[tool.mypy]` 沒有 `strict = true`，`[tool.ruff.lint]` 的 `select` 沒有 `D`；CI（`backend-sqlite` job）與 `pnpm run check` 以命令列 `uv run mypy --strict app`、`uv run ruff check .` 檢查，lint 範圍是整個 `backend/`（system-design §檢查管線）。動機見 proposal §Why，量測見 system-analysis §實測現況，不在此重述。

限制：

- CI 與 `scripts/check.mjs` 的指令字串不能改：issue #524「不在範圍」，且 `scripts/tests/ci-workflow.test.mjs`、`scripts/tests/check.test.mjs` 鎖住這兩個字串（system-design §檢查管線；`workspace-commands` 要求本機與 CI 同指令同參數）
- router handler 與 Pydantic schema 的 docstring 會進 `openapi.json`（api-contract §與契約相鄰的限制）
- 已部署的 migration 不再改動（backend-agent-rules B6）

## Goals / Non-Goals

**Goals:**

- 只靠設定檔讓新規則經由既有的 CI 步驟與 `pnpm run check` 步驟生效
- 合併前 `uv run ruff check .`、`uv run mypy app`、`uv run mypy --strict app` 在 `backend/` 全部通過
- 規則確實會擋：以刻意違規的樣本證明 lint 失敗後再還原

**Non-Goals:**

- `tests` 納入型別檢查、修 `tests` 的 21 個型別錯誤、替 `tests` 補 docstring（clarification Q1、Q3）
- 修改 baseline migration（Q4）
- 把命令列的 `--strict` 拿掉（要連同兩份腳本測試與 CI 一起改，屬另一個 change；system-design §檢查管線）
- `backend-modules.mdx` §已知限制 追蹤 #506 那一列（clarification §交給後續產出「範圍外」）

## Decisions

1. **嚴格型別檢查寫進設定檔：`[tool.mypy]` 加 `strict = true`，命令列的 `--strict` 保留。** 對應 system-design §設定異動 → mypy、§檢查管線。設定檔開 strict 後命令列的 `--strict` 多餘但無害，兩者疊加的結果已實測相同（system-design §驗證過的前提）。替代方案：從 CI 與 `scripts/check.mjs` 拿掉 `--strict`，只靠設定檔（要改兩份鎖指令的測試，超出 issue 範圍，維護者 Q3 選 A）；`tests` 一併納入（Q3 B，要改指令並修 21 個錯誤）。範圍只有 `app`，spec 以「型別檢查範圍是 backend/app」Scenario 鎖住。
2. **文件註解規則採 `select` 加 `D`、`[tool.ruff.lint.pydocstyle] convention = "google"`、`ignore = ["D107"]`。** 完整設定與逐項作用見 system-design §設定異動 → ruff，不在此重抄。google 風格對應 B2 的 `Args:`／`Returns:`／`Raises:`，並啟用「`Args:` 漏列參數」的檢查（spec「文件註解漏列參數時 CI 失敗」；規劃時以暫存複本實測會報出漏列的參數名）。忽略 D107 依 Q2：建構參數寫在類別 docstring 的 `Args:`，一個類別只寫一處；這個寫法 ruff 不檢查，由 code review 核對。替代方案：保留 D107（Q2 B，每個 `__init__` 各寫一份）；另外忽略 D100／D104（Q6 B，模組與套件 docstring 免寫，維護者未採用）。
3. **規則只約束 `app`：`per-file-ignores` 以目錄樣式 `"tests/**"`、`"alembic/**"` 豁免整個 `D`。** 對應 system-design §設定異動 → ruff 表格 Q1 A、Q4 列與 §檢查管線最後一點。因為 CI 的 lint 範圍是整個 `backend/`，這兩個豁免是 CI 能全綠的前提（拿掉會多 226 處）。替代方案：縮小 lint 範圍到 `app`（要改 CI 指令，超出範圍）；逐檔列舉（新增測試檔就要改設定，Q1 明定不逐檔）；修 baseline migration 的 D415（牴觸 B6）。
4. **私有 helper 的例外不另寫規則，只在設定旁加英文註解說明靠 ruff 的預設。** 對應 system-design §設定異動 → ruff 表格 Q6 A 列。ruff 本來就不檢查 `_` 開頭的名稱（system-analysis §實測現況其他觀察）；`__x__` 形式的特殊方法不在此例外內，照樣受檢。註解措辭由 `backend-developer` 決定，但要保留「例外來自 ruff 預設」與「所以不加規則」兩個意思。
5. **D301 的修法：改成 `r"""` 時把內文的 `\\n`、`\\r`、`\\t`、`\\x1b` 一起改成單反斜線，或改寫內文去掉反斜線。** 對應 system-design §設定異動 → 修正 docstring 時的限制。只加 `r` 前綴（ruff 的 unsafe fix）會讓顯示出來的文字多一個反斜線，與原意不符，所以不採用。修完以 `help(escape_for_log)` 或 `escape_for_log.__doc__` 比對修改前後顯示的文字相同。
6. **health 兩個類別的建構參數移進類別 docstring 的 `Args:`，`__init__` 不寫 docstring。** 對應 system-design §分層與類別的表格與 Q2。這兩處在新設定下不是違規，補齊是為了讓現有程式成為之後新類別的範例。
7. **docstring 修正不碰 handler 與 schema，預期 `openapi.json` 不變。** 對應 api-contract §與契約相鄰的限制。實作時若改到 handler 或 schema 的 docstring，同一組任務跑 `pnpm run api:sync` 並提交產物；沒改到就以契約漂移指令確認無差異。
8. **常駐文件與規則文件的同步分兩處、兩個角色。** `backend-modules.mdx` §新增業務模組的檢查清單 已在規劃階段改好（clarification P1）；§已知限制 追蹤 #524 那一列要等設定改了才不成立，所以由改 `pyproject.toml` 的同一組任務刪除（system-design §常駐文件異動）。`backend-agent-rules.mdx` B2 的「檢查方式」「尚未檢查」由 `technical-writer` 依實作後的設定改寫（Q5），排在設定之後，免得文件描述還沒落地的設定。

## Risks / Trade-offs

- [新模組的公開介面缺 docstring 會讓 lint 失敗，開發成本上升] → 這是 B2 刻意要的檢查；`backend-modules.mdx` 檢查清單已寫出寫法與範圍，B2 文件同步說明
- [D1xx 只檢查 docstring 有沒有、段落格式對不對，不檢查內容是否寫明前提、副作用與例外] → B2「尚未檢查」改寫時保留「內容靠審查」這一句，不宣稱內容已被機械檢查
- [`tests` 不受型別與文件註解檢查，測試程式品質靠審查] → 維護者 Q1、Q3 的取捨；之後要納入時另開 change，同時改 CI 指令與兩份腳本測試
- [設定檔與命令列都寫 strict，之後有人只改一邊] → 兩者疊加無衝突；拿掉命令列 `--strict` 屬另一個 change，Non-Goals 已寫明
- [改 docstring 不小心碰到 handler 或 schema，CI `api-contract` job 判成漂移] → 決策 7 的契約漂移指令列進同一組任務
- [ruff 升版後 google 風格的規則組合改變] → 依賴由 `uv.lock` 鎖住版本，升版時 CI 會直接顯示新增的違規

## Migration Plan

- 無資料模型異動，不新增 Alembic migration，SQLite 與 PostgreSQL 都不受影響（system-design §資料模型異動）。
- 部署：只改開發工具設定與 docstring，執行行為不變，不需要部署步驟。
- 回滾：還原 `backend/pyproject.toml` 的設定段落、三個檔案的 docstring、`backend-modules.mdx` 已知限制那一列與 `backend-agent-rules.mdx` B2 的兩句；沒有資料要還原。
