# System Analysis

## 需求依據

本 change 是技術 change，`docs/specs/` 沒有對應的業務規格（不涉及任何使用者可見功能，PRD 與規格書不受影響）。依 `openspec/config.yaml` 的規定，追溯對象改為 issue、ADR 與規則文件的條號（見 spec-migration D4、維護者 2026-11-20 裁定 #503）。

| 來源                                                                                     | 章節／編號                                                                                                                                   | 摘要（一句）                                                                                                                                                            |
| :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub issue #561                                                                        | 工作項（七項）                                                                                                                               | 加檔案行數、函式行數、複雜度上限；前後端各一組門檻與例外由維護者決定；既有超標列出來交維護者；規則寫回規則文件；先對刻意違規的樣本確認會失敗                            |
| GitHub issue #560（Epic）                                                                | §維護者裁定（2026-11-23）                                                                                                                    | 門檻數字與規則細節在各子單以問答方式問維護者，不由 agent 自訂；#506 已合併（blocked-by 已解除）                                                                         |
| `AGENTS.md`                                                                              | Hard Rules 5、Development Workflow、Language Rules、Agent Rules Index                                                                        | 本 change 不得動核心邏輯；規則文件的「檢查方式」必須如實寫成已建置的指令                                                                                                |
| `docs/development/rules/agent-rules.mdx`                                                 | R3、R4、§附錄：刻意不採用的來源條文                                                                                                          | 明文**不採用**「寫了 200 行而其實 50 行就夠」「5 檔／300 行 diff」等機械門檻，理由是「行數不是複雜度」                                                                  |
| `docs/development/rules/frontend-agent-rules.mdx`                                        | F5、§刻意不採用的來源條文（第 269 行）、§來源對照（第 320 行）                                                                               | F5 寫「不設行數門檻」；scaffold 的「超過約 200 行就拆檔」被列為**不採用**                                                                                               |
| `docs/development/rules/backend-agent-rules.mdx`                                         | 文首狀態段、B2                                                                                                                               | 後端只有 B1、B2、B6、B7 在 CI 跑；B2 的 ruff 規則組與指令是本 change 的落點                                                                                             |
| `docs/development/rules/testing-agent-rules.mdx`                                         | T9                                                                                                                                           | 「Python lint 與型別檢查」「TypeScript strict 與 React Hooks」兩個 gate 已由 `backend-sqlite`、`frontend` 兩個 job 跑，新規則可直接掛在這兩個 gate 上                   |
| `docs/development/rules/agent-hook-contract.mdx`                                         | H4、H7                                                                                                                                       | 本機 hook 與 CI 必須呼叫同一組檢查器；CI 才是最終 gate                                                                                                                  |
| `docs/development/adr/001`～`008`                                                        | 全文掃描                                                                                                                                     | 沒有任何一份 ADR 規定檔案行數、函式行數或複雜度的數值或工具；找不到數值來源（見待決問題 Q1）                                                                            |
| 參考專案 scaffold（本機 `fullstack-ai-sdd-workflow-scaffold`，`4410a62`，2026-11-16 查） | `frontend.md` §元件分層                                                                                                                      | 唯一的行數條文是「超過約 200 行就拆」，已被本 repo 駁回；scaffold 沒有 `complexity`、`C901`、`PLR` 設定。本 repo 的原始 repo（`label-suite`，`faf83356`）也沒有這些規則 |
| 工具預設值                                                                               | ESLint：`max-lines` 300、`max-lines-per-function` 50、`complexity` 20；ruff：`C901` 10、`PLR0915` 50、`PLR0912` 12、`PLR0913` 5、`PLR0911` 6 | 這是唯一客觀的數值來源；本 repo 的文件沒有採用它們的紀錄                                                                                                                |
| `openspec/specs/ci-quality-gates`                                                        | §後端 lint、格式與型別檢查在 CI 執行；§前端 lint、型別檢查、測試與建置在 CI 執行                                                             | 這兩條 requirement 描述 lint 的失敗條件，本次會被擴充                                                                                                                   |
| `openspec/specs/frontend-code-boundaries`、`backend-code-boundaries`                     | §lint 不容許警告 等                                                                                                                          | 既有的程式碼規範 capability；新規則可放進其中一個或新增一個 capability（由 planner 決定，見待決問題 Q9）                                                                |

## 範圍

- 這次包含：
  - 前端：`frontend/eslint.config.js` 加檔案行數、函式行數、複雜度三類上限；生成檔與測試檔的例外
  - 後端：`backend/pyproject.toml` 的 ruff 加複雜度（`C901`）與對應的 `PLR` 規則（函式長度以敘述數計）；後端檔案行數的做法（ruff 沒有對應規則，見 Q5）
  - 列出現有程式超標的清單，交維護者決定修或豁免（本次只列不修）
  - 把規則與實際指令寫回 `frontend-agent-rules.mdx`、`backend-agent-rules.mdx`，並同步 `agent-rules.mdx`、`testing-agent-rules.mdx` 的狀態敘述
  - 對刻意違規的樣本證明檢查會失敗
- 這次不包含：
  - 修改超標的既有程式碼（只列出，除非維護者在 Q8 決定在本 change 內修）
  - 新增 CI job（`frontend` 與 `backend-sqlite` 現有的 lint 步驟已會執行新規則；是否另加後端檔案長度的步驟取決於 Q5）
  - #562、#563、#564 的內容；#111 的七個 gate；`e2e/` 套件（它沒有 lint 工具，且最大檔案 103 行）
  - 任何 UI 畫面與 API 變動（本次無 UI、無 API；`ui-design`、`api-contract` 只需寫「無」）
  - 修改 `docs/specs/` 與 PRD（沒有業務需求涉及）

## 業務流程

不適用：本 change 沒有對應的 `docs/specs/` 規格，也沒有使用者或角色的業務流程。它只改變開發與審查流程中「超標程式碼會被機械擋下」這一點，流程本身沿用 `AGENTS.md` §Development Workflow 與 `testing-agent-rules.mdx` T9 的 CI gate，不另畫一份。

## 角色與權限

不涉及產品角色（Annotator／Reviewer／Admin 等）與權限矩陣。涉及的是開發流程中的行為者：

| 行為者                                                                      | 在本 change 中能做的事                                                               |
| :-------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| 維護者                                                                      | 決定門檻、例外、既有超標程式的處理（修或豁免）、是否推翻「不採用機械門檻」的既有裁定 |
| 實作 agent（`backend-developer`、`frontend-developer`、`technical-writer`） | 依 tasks 調整設定與規則文件，不得自訂門檻                                            |
| `code-reviewer`、`acceptance-verifier`                                      | 驗證規則在刻意違規樣本上失敗、既有程式全數通過或列入豁免                             |

## 跨模組依賴

- **先決條件**：#506（CI 的前端與後端 job）已合併並關閉，`frontend` 與 `backend-sqlite` 兩個 job 已存在，並分別跑 `pnpm --filter frontend lint`（`eslint . --max-warnings 0`）與 `uv run ruff check .`。新規則直接沿用這兩個 gate，不需新 job（Q5 的後端檔案長度除外）。
- **既有 capability 會受影響**：
  - `ci-quality-gates`：兩條 lint requirement 的失敗條件要擴充
  - `frontend-code-boundaries`／`backend-code-boundaries`：新規則的歸屬（Q9）
  - `workspace-commands`：本機自查（`pnpm run check`）與 CI 必須執行同一組指令；若新增後端檔案長度腳本，兩邊都要加
- **共用檔案，與同 Epic 的兄弟 issue 有衝突風險**：#562（integration 測試禁止 mock 自己的模組）會動 `frontend/eslint.config.js`；#563（後端單一入口與 import-linter 契約）會動 `backend/pyproject.toml`。三張都是 Epic #560 的子單、彼此不依賴，合併順序決定誰要 rebase。
- **現有的「刻意違規樣本」做法**：前端有 `frontend/build/eslint-config.test.ts`（寫入探針檔後跑 ESLint，`scripts/check.mjs` 與 CI 會檢查探針殘留）；後端有 `backend/tests/unit/test_layer_boundaries.py`。本次證明「會失敗」可沿用，也可只做一次性證據（Q10）。
- **會被後續功能依賴的部分**：所有未來新增的前後端程式碼都會受這些上限約束；新增的第一個違規會直接讓 CI 失敗。
- **不依賴任何資料、API 或其他模組的執行期行為**。

## 現況量測

量測日期 2026-11-25，基於 `origin/main`（`c2ccf7a`）。方法：以不提交的暫時設定執行 ESLint 的 `max-lines`、`max-lines-per-function`、`complexity`（門檻設為 1，再從訊息取實際數字；行數都排除空白行與註解行，`IIFEs: false`），以及 `ruff check --select C901,PLR0915,PLR0912,PLR0913,PLR0911 --preview` 搭配最低門檻。暫時設定已刪除，工作區沒有留下設定變更。

數字是「超過該門檻的件數」（嚴格大於）；括號內是目前最大值。

**前端（`frontend/src` 與 `frontend/build`，生成檔 `src/api/generated/` 已被現有設定排除，共 285 行）**

| 度量     | 範圍            | 最大值                                                                                  | >200 | >250 | >300 | >400 |
| :------- | :-------------- | :-------------------------------------------------------------------------------------- | ---: | ---: | ---: | ---: |
| 檔案行數 | 非測試（39 檔） | 281（`eslint.config.js`）；`src` 內最大 242（`pages/dev-gallery/dev-gallery-page.tsx`） |    2 |    1 |    0 |    0 |
| 檔案行數 | 測試（42 檔）   | 347（`features/system-health/health-status-panel.test.tsx`）                            |    3 |    2 |    1 |    0 |

| 度量     | 範圍                                             | 最大值                                                | >50 | >60 | >80 | >100 | >150 |
| :------- | :----------------------------------------------- | :---------------------------------------------------- | --: | --: | --: | ---: | ---: |
| 函式行數 | 非測試（103 個函式）                             | 174（`dev-gallery-page.tsx:85` 的頁面元件）           |   2 |   1 |   1 |    1 |    1 |
| 函式行數 | 測試（449 個函式，含每個 `describe`／`it` 回呼） | 104（`completeness.test.tsx:131` 的 `describe` 區塊） |  11 |   7 |   2 |    1 |    0 |

非測試超過 50 行的兩個函式：`dev-gallery-page.tsx:85`（174 行）、`api/mutator.ts:129`（59 行）。

| 度量   | 範圍                | 最大值                                                               | >10 | >15 | >20（ESLint 預設） |
| :----- | :------------------ | :------------------------------------------------------------------- | --: | --: | -----------------: |
| 複雜度 | 非測試（46 個函式） | 13（`api/mutator.ts:129`）；次為 11（`components/ui/button.tsx:93`） |   2 |   0 |                  0 |
| 複雜度 | 測試（61 個函式）   | 10                                                                   |   0 |   0 |                  0 |

**後端（`backend/app`、`backend/tests`、`backend/alembic`）**

ruff 預設值（`C901` 10、`PLR0915` 50、`PLR0912` 12、`PLR0911` 6）下**零違規**；`PLR0913`（參數 5）預設下有 1 個 app 與 1 個 tests 違規。

| 規則                | 範圍             | 最大值                         |  >5 |  >8 | >10 | >12 | >15 | >20 | >30 |
| :------------------ | :--------------- | :----------------------------- | --: | --: | --: | --: | --: | --: | --: |
| `C901`（複雜度）    | app（54 個函式） | 10（`core/i18n.py:52`）        |   9 |   1 |   0 |   0 |   0 |   0 |   0 |
| `C901`              | tests（69）      | 9（`test_openapi.py:96`）      |   3 |   1 |   0 |   0 |   0 |   0 |   0 |
| `PLR0915`（敘述數） | app（72）        | 20（`core/i18n.py:52`）        |  35 |  23 |  18 |  14 |   9 |   0 |   0 |
| `PLR0915`           | tests（340）     | 21（`test_access_log.py:490`） | 117 |  49 |  27 |  14 |   6 |   1 |   0 |
| `PLR0912`（分支數） | app（31）        | 10（`core/i18n.py:52`）        |   3 |   1 |   0 |   0 |   0 |   0 |   0 |
| `PLR0912`           | tests（13）      | 6                              |   1 |   0 |   0 |   0 |   0 |   0 |   0 |

`alembic/`（`env.py` 與 baseline 遷移）數值都很小：複雜度最大 4、敘述數最大 9，不影響任何選項。ruff 沒有「檔案行數」與「函式行數」規則，只有以敘述數計的 `PLR0915`（見 Q5、Q6）。

後端檔案行數（以排除空白與註解行計，自行統計，不是工具輸出）：

| 範圍                      | 最大值                                                     | >200 | >250 | >300 | >400 |
| :------------------------ | :--------------------------------------------------------- | ---: | ---: | ---: | ---: |
| `backend/app`（22 檔）    | 319（`core/middleware.py`）；次為 276（`core/openapi.py`） |    2 |    2 |    1 |    0 |
| `backend/tests`（28 檔）  | 399（`integration/test_access_log.py`）                    |    6 |    3 |    2 |    0 |
| `backend/alembic`（2 檔） | 80                                                         |    0 |    0 |    0 |    0 |

**結論**：以工具預設值或略嚴的值，現有後端全數通過；前端的主要既有超標只有一個：`dev-gallery-page.tsx` 的頁面元件函式（174 行，只要函式上限小於 174 就會被擋），以及 `mutator.ts` 的複雜度 13 與 `button.tsx` 的複雜度 11（只在複雜度上限小於等於 12 時才違規）。測試檔的函式行數是大宗（449 個函式，11 個超過 50 行），所以測試例外的決定影響最大。

## 需求矛盾

| #   | 矛盾                                                                                 | 來源                                                                                                                                                                                                                                                                                                              |
| :-- | :----------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 規則文件明文駁回機械的行數門檻，issue #561／Epic #560 要求新增行數與複雜度的機械上限 | `agent-rules.mdx` §附錄：刻意不採用的來源條文（理由：「行數不是複雜度。50 行的爛抽象比 200 行的直白程式更難改」）與 §來源對照（第 230、239 行）；`frontend-agent-rules.mdx` F5 的「不設行數門檻」（第 134、145 行）、第 269 行與第 320 行的「超過約 200 行就拆檔：不採用」 vs. issue #561 工作項、Epic #560 §背景 |

兩者適用對象不完全相同：被駁回的是「**拆檔／重寫／PR 大小**的固定門檻當成規範本身」，且 F5 的「不設行數門檻」專指「抽共用的判準」；本 change 加的是「CI 上限」，用來擋極端值而不是取代職責審查。但文件字面上有衝突，且 `agent-rules.mdx` 的理由（「不以固定行數取代職責審查」）同樣適用。依 `AGENTS.md` 的「衝突不由 agent 裁決」，記為 Q1，不自行選邊。

**已決（clarification Q1）**：兩者並存。上限是擋極端值的 CI 護欄，不是拆分判準；R4、F5「不以行數取代職責審查」的原意保留。規則文件把那幾處「不採用」改寫成「不採用作為拆分判準；另設 CI 上限擋極端值」，並在新條文寫明兩者的關係。本矛盾不再是待決。

## 待決問題

以下十二題已於 2026-11-25 在 `clarification.md` 依維護者「接下來有需要決策的都依照你的建議就好」的授權決議（狀態欄標明對應的 Q 編號；選項保留作為脈絡）；維護者可推翻任一題，推翻時依 Q 編號回修。T2（是否開 `RUF100`）決議為不開，見 clarification T2。

| #   | 問題                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 影響                                                                                                                                                                                                                              | 狀態                                                                                                                                                |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 規則文件已駁回機械行數門檻，本次新增的上限是否視為推翻該裁定、或視為與它並存的「極端值護欄」？（來源：`agent-rules.mdx` §附錄：刻意不採用的來源條文；`frontend-agent-rules.mdx` F5、第 269、320 行；衝突點：該處駁回「超過約 200 行就拆」，Epic #560 要求加上限。**找不到數值的既有來源**：ADR-001 至 008 全文與參考專案都沒有；只有工具預設值）。選項：(A) 並存：上限只當護欄（設得寬、只擋極端值），規則文件新增一節說明它與「不以行數取代職責審查」的關係，並把「不採用」條文改寫為「不採用作為拆分判準，但設 CI 上限」；(B) 推翻：直接刪除或改寫那三處「不採用」，行數上限變成規範的一部分。建議 A                                                                                                                                                                                                                                                                                                                                                                     | 決定規則文件要改的範圍：A 要改 `agent-rules.mdx` 附錄與來源對照兩列、`frontend-agent-rules.mdx` 的第 269、320 行與 F5 說明；B 還要重寫 R4 的理由。牽動 `tasks.md` 的文件任務與 `design-reviewer` 的審查項；不決定就無法寫規則文件 | 已決（clarification Q1）：選 A 並存，上限是擋極端值的 CI 護欄，不是拆分判準；規則文件把「不採用」改寫為「不採用作為拆分判準；另設 CI 上限擋極端值」 |
| 2   | 前端檔案行數上限（ESLint `max-lines`，排除空白與註解）。選項：(A) 250：非測試 1 個違規（`eslint.config.js` 281；`src` 內 0）；(B) 300（ESLint 預設）：非測試 0 違規；(C) 400：0 違規。建議 300                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 選 A 要先處理 `eslint.config.js`（加新規則後還會變長，可能要拆設定檔，超出本次範圍）；選 B／C 零違規可直接生效。數字寫入 `eslint.config.js`、`frontend-agent-rules.mdx`                                                           | 已決（clarification Q2）：選 B，300                                                                                                                 |
| 3   | 前端函式行數上限（`max-lines-per-function`，排除空白與註解）。選項：(A) 50（ESLint 預設）：非測試 2 個違規（`dev-gallery-page.tsx:85` 174 行、`mutator.ts:129` 59 行）；(B) 80：1 個違規（`dev-gallery-page.tsx`）；(C) 100：1 個違規；(D) 200：0 違規但等於不設。React 元件函式本體算一個函式。建議 80，並把 `dev-gallery-page.tsx` 列入 Q8                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 無論選 A 到 C，`dev-gallery-page.tsx` 都違規，必須在 Q8 決定修或豁免；選 A 還多 `mutator.ts`。會影響元件拆分壓力                                                                                                                  | 已決（clarification Q3）：選 B，80（`IIFEs: false`）；`dev-gallery-page.tsx` 交 Q8                                                                  |
| 4   | 前端複雜度上限（`complexity`）。選項：(A) 10（與 ruff 預設一致）：2 個違規（`mutator.ts:129` 13、`button.tsx:93` 11）；(B) 12：1 個違規；(C) 15：0 違規；(D) 20（ESLint 預設）：0 違規。建議 15                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 選 A 或 B 要在 Q8 處理 `mutator.ts`（HTTP 單一出口，api-agent-rules A6 的核心檔）與 `button.tsx`（shadcn 元件，變體表造成的分支）；ESLint 與 ruff 對 `&&`、`?.`、`??` 的計算不同，不能直接視為同一個數字                          | 已決（clarification Q4）：選 C，15                                                                                                                  |
| 5   | 後端檔案行數：ruff 沒有對應規則（`ruff rule --all` 沒有 too-many-lines；`PLR09xx` 只有敘述數、分支、參數、回傳、區域變數等）。選項：(A) 後端不設機械檔案行數，只靠審查（前端有、後端沒有，與 issue「前後端各一組」不符）；(B) 在 `scripts/` 寫一支小檢查腳本（比照 `check-specs.mjs` 一類），CI 與 `pnpm run check` 各加一步；(C) 為此新增 pylint 相依（`uv add`），只開 `too-many-lines`（C0302），維護兩套 linter。(B') 在 `backend/tests/unit/` 寫 pytest 測試（比照 `test_layer_boundaries.py`），掃描 `app/`、`tests/` 與 `alembic/` 的檔案行數（排除 `alembic/versions/`），不新增 CI 步驟與 `scripts/check.mjs` 步驟（由 system-design 提出，原先不在選項中）。若選 B 或 C，數字見下：app 最大 319（`core/middleware.py`），>300 有 1 個、>400 為 0。原建議 B，上限 400（0 違規）；**決議採 B'**（排除空白行與只有 `#` 的行，docstring 計入；`alembic/versions/` 排除；例外表條目同時是棘輪上限，條目過期即失敗）；若要與前端同為 300，`middleware.py` 要在 Q8 處理 | 決定是否新增 CI 步驟、腳本及其測試（`test:scripts` 是否納入）、`workspace-commands` 與 `ci-quality-gates` 的 requirement 範圍；選 A 則 issue 工作項「後端檔案行數」要以維護者裁定縮減範圍（範圍鎖定規則：不得由 agent 自行縮減）  | 已決（clarification Q5）：選 B'，pytest 測試，上限 400                                                                                              |
| 6   | 後端函式長度與複雜度要開哪些規則、數值多少。ruff 的函式長度只有敘述數（`PLR0915`）。**目前實測**：`C901` 最大 10、`PLR0915` 最大 21、`PLR0912` 最大 10、`PLR0913`（參數）最大 8（app）／7（tests）、`PLR0911`（回傳）最大 6。選項：(A) 全用 ruff 預設（`C901` 10、`PLR0915` 50、`PLR0912` 12）：0 違規，但 `PLR0915` 的 50 比現況最大值 21 高出一倍多；(B) 較緊：`C901` 10、`PLR0915` 30、`PLR0912` 10：仍 0 違規；(C) 再加 `PLR0913`（5）：app 1、tests 1 個違規。建議 B，只開 `C901`、`PLR0915`、`PLR0912`，不開 `PLR0913`、`PLR0911`、`PLR0917`（issue 只點名 `C901`、`PLR0915`、`PLR0912`）                                                                                                                                                                                                                                                                                                                                                                            | 決定 `pyproject.toml` 的 `select` 與 `[tool.ruff.lint.mccabe]`、`[tool.ruff.lint.pylint]` 的數值；選 C 要先決定那兩個違規是否修                                                                                                   | 已決（clarification Q6）：選 B，只開 `C901`（10）、`PLR0915`（30）、`PLR0912`（10）                                                                 |
| 7   | 例外：哪些檔案不受上限約束。已知候選：前端 `src/api/generated/`（已被 ESLint `ignores` 排除，285 行）；前端測試檔（`*.test.ts(x)`、`src/test/`、`vitest.config.ts`，現有 `TEST_FILES` 常數已定義）；前端設定檔（`eslint.config.js` 281 行）；後端 `alembic/versions/`（自動產生的遷移）與 `alembic/env.py`；後端 `tests/`。選項：(A) 測試完全豁免三類規則；(B) 測試只豁免兩個「長度」規則、保留複雜度（前端測試複雜度最大 10、後端 9，零違規）；(C) 測試用較寬鬆的另一組數字（例如前端函式 120、檔案 400；後端不變）。生成檔豁免與否沒有爭議，因生成檔不由人維護。建議 B：前端測試豁免 `max-lines` 與 `max-lines-per-function`（`describe` 回呼天然很長，449 個函式中 11 個超過 50 行），後端 `alembic/versions/` 豁免、`tests/` 不豁免（目前後端 tests 在建議值下零違規）                                                                                                                                                                                                 | 決定 `eslint.config.js` 的 `files`／`ignores` 與 `pyproject.toml` 的 `per-file-ignores`；選 A 會讓測試出現複雜度極端值也不被擋；選 C 要多定一組數字                                                                               | 已決（clarification Q7）：選 B，前端測試只豁免兩個長度規則；前端規則只套用 `SOURCE_FILES`；後端 `alembic/versions/` 豁免、`tests/` 不豁免           |
| 8   | 既有超標程式的處理：在建議值（Q2 300、Q3 80、Q4 15、後端 Q6 B）下，**唯一違規是 `frontend/src/pages/dev-gallery/dev-gallery-page.tsx:85` 的頁面元件（174 行，`dev-gallery` 是開發用元件展示頁）**；若 Q3 選 50 另有 `api/mutator.ts:129`（59 行），若 Q4 選 10 另有 `mutator.ts:129`（複雜度 13）與 `button.tsx:93`（11）。選項：(A) 本 change 內修（拆元件）：超出「只改設定與文件」的範圍，會牽動 `component-gallery` capability 的測試（`completeness.test.tsx` 等）；(B) 在設定中以具名檔案豁免並寫明理由與 issue 編號，另開 issue 處理（比照現有 `dev-gallery` 的具名例外風格）；(C) 把 Q3 的數字放寬到不違規（200）。建議 B                                                                                                                                                                                                                                                                                                                                          | 決定 `tasks.md` 是否包含重構任務；選 A 的 PR 會同時含設定與元件改動，違反「一個 PR 一個目的」的檢查；選 B 需要在設定檔留下具名豁免清單的維護位置                                                                                  | 已決（clarification Q8）：選 B 的棘輪寫法，具名豁免 `dev-gallery-page.tsx`（放寬到 180）、本 change 不修、不另開 issue                              |
| 9   | 規則放進哪個 capability：`ci-quality-gates`（lint 的失敗條件）、`frontend-code-boundaries`、`backend-code-boundaries`，或新增一個 capability（例如 `code-size-limits`）。前端與後端的新規則寫在同一份還是分兩份。建議新增一個 capability，因為規則同時橫跨前後端與 CI，且 `ci-quality-gates` 已有 17 條                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 決定 specs 的 delta 檔案與 `ops` 歸檔時同步的對象；影響 `planner` 寫 specs 的範圍                                                                                                                                                 | 已決（clarification Q9）：新增 `code-size-limits`，`ci-quality-gates` 不另寫 delta                                                                  |
| 10  | 「刻意違規樣本會失敗」的證據形式。選項：(A) 一次性證據：在實作時以暫時檔案證明並把指令與輸出記進 PR／acceptance，不留檔案；(B) 持久測試：沿用 `frontend/build/eslint-config.test.ts` 的探針檔做法與 `backend/tests/unit/test_layer_boundaries.py` 的做法，新增測試每次 CI 都驗規則仍生效；(C) 前端用 B、後端用 A。建議 B，因為探針機制與殘留檢查已存在，且規則被誤改成寬鬆值時會被抓到                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 決定 `tasks.md` 是否包含新增測試檔、`scripts/check.mjs` 的探針清單是否要擴充；選 B 的測試需要生成超過上限的樣本（行數類上限需要大檔案，執行時間與暫存檔管理要在 design 說明）                                                     | 已決（clarification Q10）：選 B，常駐探針測試；`scripts/check.mjs` 只改探針名清單                                                                   |
| 11  | 上限的違規等級：`frontend` 的 lint 以 `--max-warnings 0` 執行，所以設為 `warn` 等同 `error`；ruff 沒有警告等級。是否要把新規則先以「僅報告」方式導入（不擋 CI）？（來源：`frontend/package.json` lint script；`openspec/specs/frontend-code-boundaries` §lint 不容許警告）。建議一律擋（`error`），不設報告期，因為建議值下現有程式零違規（Q8 的具名豁免除外）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 若選報告期，要另有一次切換成擋的後續 issue，也與 issue 工作項「CI 相關 job 通過」的語意不一致                                                                                                                                     | 已決（clarification Q11）：一律 `error`，不設報告期                                                                                                 |
| 12  | 規則文件寫回的範圍：issue 要求「檢查方式從待建置改成實際的指令」，但 F5 與前述條文是「不設行數門檻」，沒有「待建置」字樣可改；`frontend-agent-rules.mdx` 與 `backend-agent-rules.mdx` 的文首狀態段（「在 CI 跑的只有 F1、F2、F3…」「只有 B1、B2、B6、B7」）、`agent-rules.mdx` 第 29 行的總覽段、`testing-agent-rules.mdx` T9 都會變得不準。要新增一條規範（例如 F12／B11）還是掛在既有條文（F5、B2）下？建議新增一條規範各一，不改寫 F5 的原意                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 決定規則編號與所有交叉參照（`AGENTS.md` Agent Rules Index 不用改，但文件內的「共十一條」「共十條」計數要改）；影響 `technical-writer` 的任務與 `docs/` 的連結檢查（`pnpm check:specs`）                                           | 已決（clarification Q12）：新增 F12（前端）與 B11（後端）各一條，F5 原意不改                                                                        |

### 補充說明（不需維護者決定，供下游參考）

- 前端的 `eslint.config.js` 現有 `ignores: ["src/api/generated/**", ...]`，生成檔不需另設例外；後端沒有生成的 Python 原始碼（`openapi.json` 是 JSON 產物）。
- 現有後端 ruff 設定已把 `tests/**` 的 `S101`、`D` 與 `alembic/**` 的 `D` 放進 `per-file-ignores`，新的例外可沿用同一個位置與風格。
- `max-lines-per-function` 對 React 元件的影響：元件函式本體的 JSX 也算行數，`dev-gallery-page.tsx` 超標就是這個原因；這是 Q3、Q8 的前提，不是工具誤判。

## 參考檔案

- GitHub：issue #561、Epic #560（#506 已 CLOSED；#111 仍 OPEN，只列為相關）
- `AGENTS.md`、`CLAUDE.md`、`openspec/config.yaml`
- `openspec/schemas/label-suite-sdd/templates/system-analysis.md`
- `docs/development/rules/agent-rules.mdx`（R3、R4、§附錄、§來源對照）
- `docs/development/rules/frontend-agent-rules.mdx`（F1、F5、第 269、284、318 至 320 行）
- `docs/development/rules/backend-agent-rules.mdx`（文首、B1、B2）
- `docs/development/rules/testing-agent-rules.mdx`（T9）
- `docs/development/rules/agent-hook-contract.mdx`（H4、H7）
- `docs/development/adr/001-agent-engineering.mdx` 至 `008-deployment-and-operations.mdx`（全文掃描，無數值來源）
- `frontend/eslint.config.js`、`frontend/package.json`、`backend/pyproject.toml`、`.github/workflows/ci.yml`（`frontend`、`backend-sqlite` job）、`scripts/check.mjs`
- `frontend/build/eslint-config.test.ts`、`backend/tests/unit/test_layer_boundaries.py`（現有的違規樣本做法）
- `openspec/specs/ci-quality-gates`、`frontend-code-boundaries`、`backend-code-boundaries`、`workspace-commands`
- 參考專案：`fullstack-ai-sdd-workflow-scaffold`（`4410a62`，2026-11-16）、`label-suite` 原始 repo（`faf83356`）
