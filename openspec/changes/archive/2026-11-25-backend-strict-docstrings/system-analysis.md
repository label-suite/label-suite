# System Analysis

## 需求依據

本 change 是後端工具設定的變更（issue #524），**`docs/specs/` 沒有對應的業務規格**：`docs/specs/index.mdx` 列的模組都是產品功能，沒有一份規格描述程式碼的型別與文件註解規範；依 `docs/development/workflow/spec-migration.mdx` D4，技術與 CI 規範屬 OpenSpec 範疇，不搬進 `docs/specs/`。依 `openspec/config.yaml` context（維護者 2026-11-20 裁定，#503），本 change 改為追溯到規則文件與 ADR 的條號。

| 來源                                                | 章節／編號                                       | 摘要（一句）                                                                                                                                               |
| :-------------------------------------------------- | :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| issue #524                                          | 背景、工作項、不在範圍                           | 維護者指定的需求依據：型別檢查設定要和 CI 一致、加入文件註解規則並採 google 風格、私有 helper 用設定豁免、修掉剩下的違規；不新增或修改 CI job              |
| issue #524 留言                                     | 維護者 2026-11-23 裁定                           | 登記 blocked-by #506；mypy 那一項改寫成「讓設定檔與 CI 的 `--strict` 一致」                                                                                |
| `docs/development/rules/backend-agent-rules.mdx`    | B2 docstring、型別與指令                         | 公開介面要有型別與英文 docstring，寫明前提、副作用與例外（`Args:`／`Returns:`／`Raises:`）；私有 helper（`_` 開頭）不強制 docstring；適用路徑 `backend/**` |
| `docs/development/rules/backend-agent-rules.mdx`    | B2 的反例與檢查方式（摺疊區塊）                  | 目前「docstring 的有無與內容沒有機械檢查（`ruff` 沒有選 `D` 規則），靠審查」；檢查方式列出現行選用的規則集                                                 |
| `docs/development/rules/backend-agent-rules.mdx`    | B6 schema 只由 Alembic 管                        | 已部署的 migration 不再改動（與違規修正範圍有關；依 clarification Q4，`alembic/**` 整體豁免，不改 baseline migration）                                     |
| `docs/development/rules/backend-agent-rules.mdx`    | 來源對照 B2                                      | 沿用原始 repo `backend.md` §Python Code Style 的「docstring 英文加完整型別」                                                                               |
| `docs/development/adr/003-backend-architecture.mdx` | 框架選型表 A FastAPI                             | 只提到「mypy strict 可用」作為選型理由，沒有其他關於型別或 docstring 的決定                                                                                |
| `openspec/specs/ci-quality-gates/spec.md`           | Requirement: 後端 lint、格式與型別檢查在 CI 執行 | CI 對後端執行 lint、格式與嚴格型別檢查（來源 B2、T9）；本 change 加入的規則會經由這條 requirement 的 lint 步驟生效                                         |
| `openspec/specs/workspace-commands/spec.md`         | 根目錄 `pnpm run check` 那條 requirement         | 本機總檢查每一步要與 CI 同一個指令、同一組參數                                                                                                             |
| `docs/specs/00-prd.mdx`、`docs/specs/glossary.mdx`  | —                                                | 不涉及：本 change 不改產品行為、不新增業務名詞                                                                                                             |

### 實測現況

在 worktree 的 `main`（`b123b20`，2026-11-25）、`backend/` 目錄下以 ruff 0.17.6 重量。issue 內 2026-11-20（`3084fe4`）的數字已舊。

| 檢查                                     | 範圍                   | 結果                                                                                                                                                                                            |
| :--------------------------------------- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 嚴格型別檢查（CI 的同一條指令）          | `app`                  | 通過，0 issues（21 個檔案）                                                                                                                                                                     |
| 型別檢查，不加 strict 參數（現行設定檔） | `app`                  | 通過，0 issues；目前程式在兩種模式下都乾淨，差異只在設定是否會擋住之後的程式                                                                                                                    |
| 嚴格型別檢查                             | `tests`                | 21 errors，分布在 5 個檔案（目前 CI 不檢查 `tests`）                                                                                                                                            |
| 嚴格型別檢查                             | `alembic`              | 通過，0 issues                                                                                                                                                                                  |
| 現行 lint 規則集                         | `.`（CI 範圍）         | 通過                                                                                                                                                                                            |
| 文件註解規則，未設風格                   | `app`                  | **38 處**：D413 ×35、D107 ×2、D301 ×1（issue 記為 37 處，D413 多了 1 處）                                                                                                                       |
| 文件註解規則，google 風格                | `app`                  | **3 處**：D107 ×2（`app/modules/health/repository.py` 第 12 行、`app/modules/health/service.py` 第 37 行，兩個 `__init__`）、D301 ×1（`app/core/log_safety.py` 第 11 行，docstring 內含反斜線） |
| 文件註解規則，google 風格                | `tests`                | **225 處**：D103 ×215、D101 ×3、D104 ×3、D107 ×2、D102 ×2                                                                                                                                       |
| 文件註解規則，google 風格                | `alembic`              | **1 處**：D415 ×1（`alembic/versions/20261120_1306_0dfb129ee036_baseline.py` 第 1 行）                                                                                                          |
| 文件註解規則，google 風格                | `.`（CI 實際跑的範圍） | **229 處**（上面三列加總）                                                                                                                                                                      |

其他觀察：

- google 風格已讓 D413 全部消失，`app` 只剩 3 處。
- `_` 開頭的函式、類別與方法（例如 `_lifespan`、`_enable_sqlite_foreign_keys`、`_Pinger`）在三種量法中都沒有被報出：此 ruff 版本的文件註解規則本來就不檢查 `_` 開頭的名稱。所以 B2「私有 helper 免 docstring」不必另寫設定或逐檔忽略也已成立；但 `__init__` 這類雙底線方法照樣受檢（依 clarification Q2 以忽略 D107 處理，見待決問題 #2）。
- `backend/` 底下**沒有** `scripts/` 目錄；後端的腳本在 `app/scripts/`，屬於 `app` 範圍，目前 0 處違規。根目錄的 `scripts/` 是 JavaScript 工具，與本 change 無關。

## 範圍

範圍依 `clarification.md` Q1–Q6（維護者 2026-11-25 裁定）定案。

- 這次包含：
  - 後端專案設定的型別檢查段落開啟 strict，讓本機不帶參數的型別檢查與 CI、`pnpm run check` 的嚴格檢查結果一致；嚴格型別檢查的範圍只有 `app`，CI 與 `pnpm run check` 的指令不改（issue #524 工作項 1；clarification Q3）
  - 後端 lint 規則加入文件註解規則，風格設為 google，額外只忽略 D107；文件註解規則只約束 `app`，`tests/**` 與 `alembic/**` 以目錄樣式整個豁免、不逐檔列舉；私有 helper 的豁免靠 ruff 不檢查 `_` 開頭名稱的預設行為成立，在設定旁以註解寫明，不另加規則（工作項 2；clarification Q1、Q2、Q6）
  - 修掉開啟後 `app` 剩下的 3 處違規：`app/core/log_safety.py` 的 D301 1 處；health 的 repository 與 service 兩個類別的 D107，建構參數改寫進類別 docstring 的 `Args:`（工作項 3；clarification Q1、Q2）
  - `backend-agent-rules.mdx` B2 的「檢查方式」改成實際指令與範圍、「尚未檢查」改成現況，與設定同一張 PR（clarification Q5）
  - 本機 lint、型別檢查、測試全部通過，且 #506 留下的後端 CI job 通過（工作項 4）
- 這次不包含：
  - 新增或修改 CI job 與 `pnpm run check` 的指令（issue #524「不在範圍」，屬 #506；#506 已關閉）
  - 改變任何產品行為、介面或資料
  - `docs/specs/` 的任何內容
  - 把 `tests` 納入型別檢查，以及修 `tests` 的 21 個型別錯誤（clarification Q3）
  - 替 `tests` 補 docstring（225 處）或修改 baseline migration 的 D415（clarification Q1、Q4）

## 業務流程

不適用：本 change 的需求依據是 issue #524 與 `backend-agent-rules.mdx` B2，不是 `docs/specs/` 的規格，也沒有任何使用者或角色可感知的業務流程——它只改變開發者與 CI 檢查程式碼時用的規則。依 `spec-migration.mdx` D4，這類技術規範屬 OpenSpec 範疇，所以**不建議**用 `spec-writing` 把流程補進 `docs/specs/`。

涉及的角色只有開發端，沒有權限差異，不需要角色 × 動作矩陣：

| 角色                                          | 與本 change 的關係                                                    |
| :-------------------------------------------- | :-------------------------------------------------------------------- |
| 後端開發者（含 `backend-developer` 等 agent） | 寫公開介面時要附 google 風格的英文 docstring；本機檢查會直接擋下缺漏  |
| CI                                            | 沿用 #506 建好的後端 job 與指令，不改；新規則經由同一個 lint 步驟生效 |
| 維護者                                        | 已於 2026-11-25 裁定範圍與規則取捨（clarification Q1–Q6）             |

## 跨模組依賴

- **前置**：#506（Docker Compose、e2e 與 CI 檢查）已關閉；它建立的後端 CI job 以嚴格參數檢查 `app`、並對整個 `backend/` 跑 lint。issue #524 排在 #506 之後的理由（避免 #506 新增的程式冒出 docstring 違規）已消除。#523（規則文件改為 `backend/` 已存在的現況）亦已關閉。
- **既有 capability `ci-quality-gates`**：「後端 lint、格式與型別檢查在 CI 執行」這條 requirement 已涵蓋 lint 與嚴格型別檢查，來源標 B2。本 change 不改 CI 的指令，但會讓 lint 那一步多擋 `app` 的文件註解；這條 requirement 現在寫「對 `backend/` 執行嚴格型別檢查」，與實際只檢查 `app` 的指令不符（clarification P2），範圍依 Q1、Q3 由 `planner` 的 specs delta 處理。
- **既有 capability `workspace-commands`**：`pnpm run check` 的後端型別檢查步驟與 CI 同為帶嚴格參數的指令，且 `scripts/tests/check.test.mjs`、`scripts/tests/ci-workflow.test.mjs` 鎖住這個指令字串。設定檔開啟 strict 後，帶參數的指令仍然成立；本 change 不應改這兩處指令（改了會違反 workspace-commands 的「與 CI 同指令同參數」，也超出 issue 範圍）。
- **lint 範圍是整個 `backend/`**：CI 在 `backend/` 下跑 lint，設定檔加入的規則若不豁免會同時套用到 `tests` 與 `alembic`。依 clarification Q1，`tests/**` 與 `alembic/**` 以目錄樣式豁免文件註解規則，lint 的執行範圍與 CI 指令不變（待決問題 #1 已決）。
- **規則文件**：B2 的「檢查方式」列出現行規則集、「尚未檢查」寫明 docstring 沒有機械檢查；本 change 合併後這兩句會與現況不符；依 clarification Q5，兩句的同步列在本 change 內（待決問題 #5 已決）。
- **進行中的其他 change**：`openspec/changes/` 中除本 change 外只有 `archive/`，沒有重疊或衝突。
- **後續依賴本 change 的部分**：之後所有新增的後端模組（例如使用者管理）都要符合本 change 定下的文件註解規則；規則越早定下，後續模組的修正成本越低。

## 需求矛盾

| #   | 矛盾                                                                                                                                                                                                                                                                   | 來源                                                                                                        | 處理                                                                                                                                                    |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | B2 的適用路徑是 `backend/**`，issue #524 的量測與工作項只寫 `app`；但 CI 的 lint 範圍是整個 `backend/`，所以設定一旦加入就會擋到 `tests`（225 處）與 `alembic`（1 處）。兩份依據對範圍的說法不一致，依 context 的順序 issue 優先，但 issue 沒有明說 `tests` 要不要豁免 | `backend-agent-rules.mdx` B2 適用路徑；issue #524 背景與工作項 3；`.github/workflows/ci.yml` 後端 lint 步驟 | 已決：文件註解規則只約束 `app`，`tests/**`、`alembic/**` 以目錄樣式豁免；B2 是對公開介面的要求，測試函式不是介面（clarification Q1，維護者 2026-11-25） |
| 2   | 若要修 `alembic` 那 1 處，需要改既有的 baseline migration 的 docstring；B6 禁止改動「已部署」的 migration。這份 migration 是否已部署，需求文件沒有交代                                                                                                                 | `backend-agent-rules.mdx` B6；`backend/alembic/versions/20261120_1306_0dfb129ee036_baseline.py`             | 已決：`alembic/**` 整體豁免，不修改 baseline migration，不需判斷是否已部署（clarification Q4，維護者 2026-11-25 隨 Q1 決定）                            |

## 待決問題

以下 6 題已由維護者於 2026-11-25 在 `clarification.md` 逐題裁定（Q1–Q6 對應本表 #1–#6），保留原問題以便追溯。

| #   | 問題                                                                                                                                                                                                                                  | 決議                                                                                                                                                                                         | 狀態 |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 1   | 文件註解規則的適用範圍是只有 `app`，還是整個 `backend/`（含 `tests`、`alembic`）？（來源：`backend-agent-rules.mdx` B2 適用路徑 `backend/**`；issue #524 工作項 2、3；衝突點：見需求矛盾 #1）                                         | 只套 `app`；`tests/**` 與 `alembic/**` 用 `per-file-ignores` 的目錄樣式整個豁免文件註解規則，不逐檔列舉。修正工作量為 `app` 的 3 處（clarification Q1，維護者 2026-11-25）                   | 已決 |
| 2   | 公開類別的 `__init__` 是否必須有自己的 docstring（D107），或改成在類別 docstring 寫 `Args:`、並忽略 D107？（來源：`backend-agent-rules.mdx` B2 例外；實測 `app/modules/health/repository.py:12`、`app/modules/health/service.py:37`） | 忽略 D107；health 的 repository 與 service 兩個類別把建構參數寫進類別 docstring 的 `Args:`，之後的新類別同此寫法（clarification Q2，維護者 2026-11-25）                                      | 已決 |
| 3   | 型別檢查的 strict 是否只對 `app` 生效即可，還是 `tests` 也要納入？（來源：issue #524 工作項 1 與留言 2026-11-23；`backend-agent-rules.mdx` B2 適用路徑 `backend/**`；`openspec/specs/workspace-commands/spec.md` `pnpm run check`）   | 只管 `app`；設定檔開啟 strict，讓本機不帶參數的型別檢查與 CI 的嚴格檢查一致，CI 與 `pnpm run check` 的指令不改；`tests` 的 21 個型別錯誤不在本 change（clarification Q3，維護者 2026-11-25） | 已決 |
| 4   | baseline migration 的 D415 要修改該 migration，還是排除 `alembic/versions`？（來源：`backend-agent-rules.mdx` B6；`backend/alembic/versions/20261120_1306_0dfb129ee036_baseline.py:1`；衝突點：見需求矛盾 #2）                        | 隨 #1 決定：`alembic/**` 整個豁免，不修改 baseline migration（clarification Q4，維護者 2026-11-25）                                                                                          | 已決 |
| 5   | `backend-agent-rules.mdx` B2 的「檢查方式」與「尚未檢查：docstring 沒有機械檢查」的同步要放進本 change，還是另外處理？（來源：`backend-agent-rules.mdx` B2 的反例與檢查方式；issue #524 工作項）                                      | 本 change 一起改，與設定同一張 PR，交 `technical-writer`：「檢查方式」改成實際指令與範圍、「尚未檢查」改成現況（clarification Q5，維護者 2026-11-25）                                        | 已決 |
| 6   | 在 google 風格之外，是否還要額外忽略或額外啟用某些文件註解規則（例如 D100／D104）？（來源：issue #524 工作項 2；實測結果）                                                                                                            | 不再加；設定只有 google 風格與忽略 D107，設定旁註解寫明 B2 的私有 helper 例外靠 ruff 不檢查 `_` 開頭名稱的預設行為成立（clarification Q6，維護者 2026-11-25）                                | 已決 |
