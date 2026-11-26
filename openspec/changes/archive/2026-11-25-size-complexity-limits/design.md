# Design

## Context

動機見 proposal.md §Why；門檻、例外與機制的全部決議見 `clarification.md` §待釐清項目（Q1–Q12、T2，2026-11-25），本文件不重述數字的理由。機制的組成、各規則落點與已驗證的行為見 system-design §機制總覽、§前端：ESLint 規則放在哪裡、§例外的表達方式、§後端：ruff 設定、§後端檔案行數檢查器、§持久探針測試，下文只寫那幾節沒有定下、實作前必須定下的決策，以及與既有 capability 的關係。

現況限制：

- `frontend/eslint.config.js` 以多個設定物件依檔案群組套規則，同名規則後者覆蓋前者；已有 `SOURCE_FILES`、`TEST_FILES` 常數與全域 `ignores`。
- `frontend/tsconfig.json` 沒有 `allowJs`，`frontend/build/*.test.ts` 不能以型別安全的方式 import `eslint.config.js`。
- `backend/pyproject.toml` 的 ruff `select` 是一行清單，`per-file-ignores` 已有 `tests/**`、`alembic/**`。
- `scripts/check.mjs` 的殘留探針檢查以 `PROBE_NAME`、`PROBE_DIRS`、`PROBE_FILES` 三個常數只認 `boundary-probe.tsx`；`.gitignore` 只忽略該檔名。
- `openspec/specs/workspace-commands` 的「check 遇到探針殘留檔時失敗」只寫 `frontend/src/pages/` 底下分層測試的探針。

## Goals / Non-Goals

**Goals:**

- 每條上限在超過一個單位時讓既有步驟失敗，且有常駐測試守住數值、等級與例外範圍（specs `code-size-limits` 全部 Requirement）。
- 例外（前端具名豁免、後端例外表）有天花板，過期時測試失敗。
- 新規則在共用檔裡集中成獨立區塊，與 #562、#563 的改動衝突最小。

**Non-Goals:**

- 不重構任何既有程式，含 `dev-gallery-page.tsx`（clarification Q8）。
- 不新增 CI job、CI 步驟或 `pnpm run check` 步驟；不改 `.github/workflows/ci.yml`（Q5、Q10）。
- 不開 `RUF100`、`PLR0913`、`PLR0911`、`PLR0917`（Q6、T2）。
- 不改 `docs/specs/`、`docs/specs/00-prd.mdx`、`design/prototype/`。

## Decisions

### D1 上限與「不採用機械行數門檻」並存（Q1）

上限是 CI 護欄，只擋極端值；拆不拆、怎麼拆仍由 R4、F5 的職責審查判斷。數值刻意設寬，現有程式除一筆具名豁免外零違規（system-analysis §現況量測），所以上限不會變成日常的拆分壓力。規則文件不推翻 R4、F5 的理由，只把「不採用」的字面收窄成「不採用作為拆分判準；另設 CI 上限擋極端值」，新條文 F12、B11 各寫一段兩者的關係與「行」的定義（T5）。

考慮過的替代：推翻 R4 改以行數為拆分判準，與規則文件「行數不是複雜度」的論證衝突，且 Epic #560 要求的是護欄不是判準；未採用。

### D2 前端規則集中成一個設定物件（Q2–Q4、Q7、Q11；system-design §前端：ESLint 規則放在哪裡）

照 system-design 的 `SIZE_LIMITS` 常數與兩個設定物件：`{ files: SOURCE_FILES, rules: SIZE_LIMITS }` 與 `{ files: TEST_FILES, rules: { "max-lines": "off", "max-lines-per-function": "off" } }`，放在既有「Import restrictions」區塊之後、`defineConfig` 的尾端，選項逐字照該節（含 `skipBlankLines`、`skipComments`、`IIFEs: false`）。`files` 用 `SOURCE_FILES` 讓設定檔自然不在範圍（T4）。放在尾端而不是夾在既有區塊之間，是為了讓 #562 對既有區塊的改動與本 change 落在不同的行。

### D3 具名豁免與其過期偵測（Q8；system-design §例外的表達方式 (iii)、T3）

`eslint.config.js` 新增 `NAMED_EXEMPTIONS` 常數陣列，每筆含 `file`、`rule`、`max`、`issue`、`reason`；由它產生的設定物件排在 D2 兩個物件之後，規則選項沿用 `SIZE_LIMITS` 同一條規則的選項、只換 `max`。初始只有一筆：`src/pages/dev-gallery/dev-gallery-page.tsx` 的 `max-lines-per-function`，`max` 180、`issue` 561。

**過期偵測的資料來源**（system-design 寫「讀匯出的例外清單或用 `calculateConfigForFile`」，這裡定下後者）：因為 tsconfig 沒有 `allowJs`，測試不 import `eslint.config.js`。`size-limits-config.test.ts` 走訪的範圍精確定義如下：

- **走訪集合**：`frontend/` 底下符合 `SOURCE_FILES`（`src/**/*.{ts,tsx}`、`build/**/*.ts`）的檔案，以 `readdir`（遞迴）列出後依副檔名與路徑樣式篩選；`vitest.config.ts` 雖在 `TEST_FILES` 內，但不符合 `SOURCE_FILES`，本來就不在集合裡。
- **分成兩組**：符合 `TEST_FILES` 的測試樣式（`*.test.ts`、`*.test.tsx`、`src/test/**`）的檔案為「測試組」，其餘為「原始組」。
- **排除**：`calculateConfigForFile` 回傳 `undefined` 的檔案（等同 `eslint.isPathIgnored` 為真，例如 `src/api/generated/**`）不列入任何一組。
- **並行寫入的探針檔**：`eslint-config.test.ts` 的 `boundary-probe.tsx` 可能在走訪途中出現或消失。它位在 `SOURCE_FILES` 內、沒有豁免，生效選項就是約定值，所以不需要排除；走訪只用 `readdir` 的結果，**不在 `readdir` 之後對個別檔案做 `stat`**（檔案已消失時 `stat` 會丟 `ENOENT`），`calculateConfigForFile` 只依路徑計算，不讀檔案內容。本測試自己的 `size-probe*` 檔在同一個測試檔裡依序寫入與刪除，走訪案例執行時不存在。

對測試組的每個檔案，斷言 `complexity` 的生效設定恰為 `[2, { max: 15 }]`（守住「測試檔只豁免長度」）。對原始組的每個檔案，以 `calculateConfigForFile` 取三條規則的生效選項，與約定值不同的檔案即為「有豁免」；對每個這樣的檔案：

1. 斷言它的生效選項恰為約定的豁免值（目前只允許 `dev-gallery-page.tsx` 的 `max-lines-per-function` 為 180，其餘檔案與其餘規則都必須等於約定值），這同時守住「豁免不擴散到其他檔案或其他規則」；
2. 以 `overrideConfig` 把該規則還原成約定值再 `lintFiles` 該檔，斷言有 `severity === 2` 的該規則錯誤；沒有就是豁免過期，測試失敗並在訊息寫出檔名與規則。

這樣不必在測試裡另抄一份豁免清單，新增豁免時也一定會被第 1 步攔到審查。`calculateConfigForFile` 不做型別感知解析，走訪全部原始檔的成本在秒級以下；只有豁免檔需要一次型別感知的 `lintFiles`。

考慮過的替代：在測試裡維護一份豁免清單（會與設定檔各自漂移）；以動態 import 加型別斷言讀 `NAMED_EXEMPTIONS`（要對 `unknown` 做執行期驗證，且仍會撞到 `noImplicitAny` 對無型別 JS 模組的檢查）；都未採用。

### D4 前端探針測試（Q10；system-design §持久探針測試）

新檔 `frontend/build/size-limits-config.test.ts`，案例照 system-design 該節的表，另加兩案以對應 specs：

- 「空白行與註解不計入檔案行數」：探針檔改寫成 300 行程式加空白與註解，斷言沒有 `max-lines` 錯誤；
- 「設定檔與生成檔不受行數上限」：以 `calculateConfigForFile` 斷言 `eslint.config.js`、`orval.config.ts` 與 `src/api/generated/` 下一個既有檔沒有生效的 `max-lines`（後者由全域 `ignores` 涵蓋，`calculateConfigForFile` 回 `undefined`）。

探針檔固定為 `src/components/size-probe.tsx`、`src/components/size-probe.test.tsx`，與 `eslint-config.test.ts` 的 `boundary-probe.tsx` 不同名，避免 vitest 平行執行時互相覆寫；每次寫入都包在 `try`／`finally` 內刪除。判定一律比對 `ruleId` 加 `severity === 2`，不比總錯誤數。探針內容必須是型別正確的 TypeScript，殘留時不會讓 `typecheck` 出現與本規則無關的錯誤。測試的 `describe` 與 `it` 回呼屬 `TEST_FILES`，不受長度上限；每個 `it` 的 timeout 沿用 30 秒。

### D5 殘留探針檢查只擴充名單（Q10、T1）

對應 `workspace-commands` 的 MODIFIED delta（D8）。`scripts/check.mjs` 不加步驟、不改步驟的 `id` 與 `name`，只把 `PROBE_FILES` 擴充為含 `frontend/src/components/size-probe.tsx`、`frontend/src/components/size-probe.test.tsx`，失敗訊息從「boundary test」改成泛指被中斷的前端 lint 探針測試（仍含 `interrupted` 與 `Delete it`，現有斷言不變）。`.gitignore` 加這兩個路徑。`scripts/tests/check.test.mjs` 的 `PROBES` 陣列加這兩個路徑，沿用同一組斷言（lint 前失敗、訊息含路徑、不刪除、被版控忽略）。

### D6 後端 ruff 設定（Q6、Q7、T2；system-design §後端：ruff 設定）

照 system-design 該節的 TOML：`select` 在既有清單**尾端**追加 `"C901", "PLR0912", "PLR0915"`，新增 `[tool.ruff.lint.mccabe]`、`[tool.ruff.lint.pylint]` 兩個表，`per-file-ignores` 新增 `"alembic/versions/**" = ["C901", "PLR0912", "PLR0915"]` 一行；`tests/**` 那一行不動。`alembic/**` 的 `D` 豁免與新行並存（ruff 對多個匹配的 `per-file-ignores` 取聯集）。

### D7 後端檔案行數與探針放在同一個測試檔（Q5 B'、Q10；system-design §後端檔案行數檢查器、§持久探針測試）

只新增 `backend/tests/unit/test_size_limits.py`（system-design 曾寫 `test_file_length.py`，clarification Q10 與 proposal 定為同一個檔，以此為準）。內容分兩部分：

- **檔案行數**：模組層的 `MAX_FILE_LINES = 400`、`SCANNED_DIRS = ("app", "tests", "alembic")`、`EXCLUDED_DIRS = ("alembic/versions",)`、`EXEMPTIONS: dict[str, Exemption] = {}`（`Exemption` 為含 `max`、`issue`、`reason` 的 `TypedDict`）；純函式 `count_lines(text) -> int`（純文字逐行計算、不做語法解析：排除空白行與 `strip()` 後以 `#` 開頭的行，所以 docstring 內以 `#` 開頭的行也不計入；docstring 的其他行計入）與 `find_violations(root, exemptions) -> list[str]`（回傳超標與過期條目的訊息）。對真實 `backend/` 呼叫一次斷言回傳為空；以 `tmp_path` 造樣本呼叫，涵蓋 specs 的超標、剛好 400、行數定義、docstring 內以 `#` 開頭的行、例外上限內、超過例外上限、過期、`alembic/versions` 排除。
- **ruff 探針**：比照 `test_layer_boundaries.py`，複製真實 `pyproject.toml` 到 `tmp_path`、寫樣本、以 `Path(sys.executable).parent / "ruff"` 加 `--output-format json` 執行並依規則碼過濾。樣本的敘述數與分支數由 `tomllib` 讀出的上限加一產生；「設定值沒有被放寬」那一案寫死約定值，改門檻必須同時改測試。

這個測試檔本身也受 400 行與 ruff 上限約束；探針的樣本產生函式要拆小，避免測試檔自己撞到 `PLR0915`。

### D8 capability 歸屬：新增 `code-size-limits`，不改既有 capability（Q9）

- **`ci-quality-gates` 不寫 delta**。查過現有文字：「後端 lint、格式與型別檢查在 CI 執行」已規定 lint 有違規即失敗，「前端 lint、型別檢查、測試與建置在 CI 執行」已規定 lint 有錯誤或警告即失敗，「後端測試在兩種資料庫各跑一輪」涵蓋檔案行數測試的失敗；新上限都掛在這三條描述的步驟上，那幾條的文字不需要改就仍然成立。「每個 job 與步驟」的清單沒有變。
- **`workspace-commands` 寫 MODIFIED delta**（`specs/workspace-commands/spec.md`）。殘留探針檢查是 `pnpm run check` 的行為，歸 `workspace-commands`；既有的「check 遇到探針殘留檔時失敗」只寫 `frontend/src/pages/` 底下的分層探針，本 change 把它一般化為「被中斷的前端 lint 探針測試留下的探針檔」，列出 `src/pages/**/boundary-probe.tsx`、`src/components/boundary-probe.tsx`、`src/components/size-probe.tsx`、`src/components/size-probe.test.tsx` 四類路徑（`components/boundary-probe.tsx` 是 `scripts/check.mjs` 已在檢查、但原文字沒寫到的路徑，一併補齊），原有 Scenario 保留，新增尺寸探針的 Scenario。`code-size-limits` 只保留「探針測試結束時（含失敗）刪除探針檔、探針檔被版控忽略」，殘留時的處理指向 `workspace-commands`，同一個行為只在一處規定。
- **`frontend-code-boundaries`、`backend-code-boundaries` 不寫 delta**。分層邊界沒有變。

### D9 規則文件與常駐文件（Q12；system-design §常駐文件異動）

- `frontend-agent-rules.mdx` 新增 F12、`backend-agent-rules.mdx` 新增 B11，格式比照既有條文（表加摺疊的反例與檢查方式），檢查方式寫成已建置的指令與 CI job；各寫一句「行」的定義（前端：排除空白與註解；後端：排除空白與只含 `#` 的行，docstring 計入，兩邊數字不可互比）；各自的文首條數、狀態段、frontmatter `description`、§各條規範的來源、§決策紀錄同步。
- `agent-rules.mdx`：§這一份管什麼 的「在 CI 跑的」清單加 B11、F12；§附錄：刻意不採用的來源條文 與 §來源對照 中「200 行→50 行」那兩處依 D1 改寫字面；R3 的「不設固定的檔案數或行數門檻」講的是變更（PR）大小，與本 change 無關，不動。
- `frontend-agent-rules.mdx` F5 的檢查方式與 §附錄「超過約 200 行就拆檔」那一列、§來源對照 F5 列，依 D1 改寫字面並指向 F12；F5 的規範本文不改。
- `testing-agent-rules.mdx` T9 表的「Python lint 與型別檢查」「TypeScript strict 與 React Hooks」兩列，政策欄加 B11、F12；七項 gate 的數目與建成狀態不變。
- `docs/diagrams/architecture/backend-modules.mdx` §新增業務模組的檢查清單 補一條：函式的複雜度、敘述數、分支數由 `uv run ruff check .` 擋下，檔案行數由 `tests/unit/test_size_limits.py` 擋下，指向 B11 與 #561。這是對「先改常駐文件」的明示偏離（system-design §常駐文件異動 已說明），在實作時與規則文件同一組提交。

### D10 不在 worktree 執行 NoteCraft build（偏離 `openspec/config.yaml` operations.apply）

`openspec/config.yaml` operations.apply 要求動到 `docs/` 的群組提交前執行 `pnpm exec notecraftapp build docs --rebuild`。本 change 明示偏離這一項：第 3 組在 worktree 內不執行 NoteCraft build，理由是從 worktree 建置會污染主倉庫共用的 `~/.notecraft` 建置快取，worktree 刪除後主倉庫的建置會持續失敗。替代的檢查：本機以 `node scripts/check-specs.mjs docs`、`node scripts/check-citations.mjs --strict`、`pnpm format:check` 收尾，渲染驗證由 CI 的 `docs-site` job 負責，該 job 失敗即視同本機建置失敗，照樣阻擋合併。其餘 operations.apply 的檢查不偏離。

### D11 與 #562、#563 的衝突處理

三張同 Epic、互不依賴，不設 blocked-by。本 change 的共用檔改動都集中：前端是 `eslint.config.js` 尾端的常數與三個設定物件，後端是 `select` 尾端追加與兩個新表加一行 `per-file-ignores`，`scripts/check.mjs` 只動 `PROBE_FILES` 與一句訊息。**後合併者在自己的分支 merge `origin/main`**（不 rebase、不 force push），解完衝突後重跑該組的完成檢查再推。若 #562 或 #563 先合併且同樣新增了探針或規則碼，合併時兩邊的條目都保留。

## Risks / Trade-offs

- [前端探針依賴型別感知 lint，單次約 6 秒] → 每個 `lintFiles` 只餵一個檔；三條規則共用一個探針檔；過期偵測只對豁免檔跑；`it` timeout 30 秒。
- [探針測試被中斷時殘留檔會讓 lint 或 vitest 出現無關錯誤] → `finally` 刪除、`.gitignore` 忽略、`pnpm run check` 在 lint 前攔下（D5）；CI 每次從乾淨的 checkout 開始（ci-quality-gates「探針殘留檔不影響後續步驟」）。
- [前端與後端「行」的定義不同，數字不能互比] → F12、B11 各寫明定義（T5）；後端不用 AST，換來檢查器簡單。
- [後端檔案行數是測試不是 lint，失敗出現在 pytest 輸出，且兩輪 DB 各跑一次] → 失敗訊息列路徑、行數、上限；計數為毫秒級。這是 Q5 B' 為了不動 `ci.yml` 與 `check.mjs` 步驟所接受的代價。
- [具名豁免的棘輪 180 比現況 174 多 6 行] → 天花板只允許小幅增長，再長就失敗；過期偵測保證修好後豁免被拿掉。
- [後端測試檔 `test_size_limits.py` 自己逼近上限] → D7 要求樣本產生函式拆小；實作時以 `uv run ruff check .` 與檔案行數測試自查。
- [與 #562、#563 合併衝突] → D11。
- [第 3 組沒有在本機跑 NoteCraft build，渲染錯誤要到 CI 才看得到] → D10；`docs-site` job 是必過的檢查，失敗時回到第 3 組修正。

## Migration Plan

沒有資料、API 或畫面的遷移，沒有 Alembic migration。上線就是合併本 change 的 PR；合併當下既有程式除 `dev-gallery-page.tsx` 的具名豁免外零違規，所以 main 不會因合併而變紅。

回滾：revert 本 change 的實作 commit（前端組、後端組、文件組各一個）即可，三組互不依賴，可只 revert 其中一組；revert 前端組時 `.gitignore` 與 `scripts/check.mjs` 的探針名一起回去。沒有需要清理的狀態。

## Open Questions

無。所有會影響 specs、做法或拆工的問題已由 clarification Q1–Q12、T2 決議；D3 的過期偵測資料來源是本文件依 tsconfig 限制定下的技術選擇，D10 是對 operations.apply 單一檢查的偏離，兩者都不改變任何決議。
