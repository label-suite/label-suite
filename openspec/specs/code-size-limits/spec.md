# code-size-limits Specification

## Purpose

定義前後端原始碼的檔案行數、函式長度與複雜度的機械上限：數值、適用範圍、例外與其棘輪及過期偵測、違規等級，以及常駐的探針測試如何證明上限仍然有效。上限是擋極端值的 CI 護欄，不是拆分判準；是否拆分仍由職責審查決定。

## Requirements

### Requirement: 前端原始檔的行數上限

`frontend/` 底下符合 `src/**/*.{ts,tsx}` 或 `build/**/*.ts` 的原始檔 SHALL 不超過 300 行；空白行與註解行 MUST NOT 計入。超過時前端 lint MUST 失敗並指出該檔。不符合這兩個路徑樣式的檔案 MUST NOT 受此上限約束，例如前端套件根目錄的設定檔（`eslint.config.js`、`vite.config.ts`、`vitest.config.ts`、`orval.config.ts`）；`src/api/generated/` 底下的生成檔雖符合路徑樣式，同樣 MUST NOT 受此上限約束。

來源：issue #561 工作項 1、2；Epic #560；frontend-agent-rules F12（本 change 新增）；clarification Q1、Q2、Q7、Q12。

#### Scenario: 超過行數上限的前端檔案讓 lint 失敗

- **WHEN** `frontend/src/components/` 底下有一個非測試的 `.tsx` 檔，含 301 行非空白、非註解的程式，執行 `pnpm --filter frontend lint`
- **THEN** lint 以非 0 結束碼失敗，輸出指出該檔超過 300 行的上限

#### Scenario: 空白行與註解不計入檔案行數

- **WHEN** `frontend/src/components/` 底下有一個非測試的 `.tsx` 檔，含 300 行非空白、非註解的程式，另有 40 行空白與 40 行註解，執行 `pnpm --filter frontend lint`
- **THEN** 輸出沒有指出該檔超過檔案行數上限

#### Scenario: 設定檔與生成檔不受行數上限

- **WHEN** `frontend/eslint.config.js`、`frontend/orval.config.ts` 或 `frontend/src/api/generated/` 底下的檔案超過 300 行非空白、非註解的程式，執行 `pnpm --filter frontend lint`
- **THEN** 輸出沒有對這些檔案回報檔案行數上限

### Requirement: 前端函式的行數上限

`frontend/` 底下符合 `src/**/*.{ts,tsx}` 或 `build/**/*.ts` 的原始檔裡的每個函式（含 React 元件本體與箭頭函式）SHALL 不超過 80 行，空白行與註解行 MUST NOT 計入；立即呼叫的函式運算式 MUST NOT 單獨計算。超過時前端 lint MUST 失敗並指出該函式的位置。不符合這兩個路徑樣式的檔案（例如前端套件根目錄的設定檔）與 `src/api/generated/` 的生成檔 MUST NOT 受此上限約束。

來源：issue #561 工作項 1、2；Epic #560；frontend-agent-rules F12（本 change 新增）；clarification Q1、Q3、Q12。

#### Scenario: 超過函式行數上限的前端函式讓 lint 失敗

- **WHEN** `frontend/src/components/` 底下的非測試檔含一個 81 行非空白、非註解的函式，執行 `pnpm --filter frontend lint`
- **THEN** lint 以非 0 結束碼失敗，輸出指出該函式所在的檔名與行號，以及 80 行的上限

#### Scenario: 不超過函式行數上限時不報

- **WHEN** 同一個檔案的函式縮短為 80 行非空白、非註解的程式，執行 `pnpm --filter frontend lint`
- **THEN** 輸出沒有對該函式回報函式行數上限

### Requirement: 前端函式的複雜度上限

`frontend/` 底下符合 `src/**/*.{ts,tsx}` 或 `build/**/*.ts` 的原始檔裡每個函式的圈複雜度 SHALL 不超過 15。超過時前端 lint MUST 失敗並指出該函式的位置。這個上限 MUST 同樣套用在符合這兩個路徑樣式的前端測試檔。不符合這兩個路徑樣式的檔案（例如前端套件根目錄的設定檔）與 `src/api/generated/` 的生成檔 MUST NOT 受此上限約束。

來源：issue #561 工作項 1、2；Epic #560；frontend-agent-rules F12（本 change 新增）；clarification Q4、Q7。

#### Scenario: 超過複雜度上限的前端函式讓 lint 失敗

- **WHEN** `frontend/src/components/` 底下的非測試檔含一個有 16 條獨立 `if` 分支（圈複雜度 17）的函式，執行 `pnpm --filter frontend lint`
- **THEN** lint 以非 0 結束碼失敗，輸出指出該函式所在的檔名與行號，以及 15 的上限

### Requirement: 前端測試檔只豁免長度上限

`frontend/` 底下符合 `src/**/*.{ts,tsx}` 或 `build/**/*.ts`、且檔名為 `*.test.ts`、`*.test.tsx` 或位於 `src/test/` 底下的前端測試檔 SHALL 不受檔案行數與函式行數上限約束，但 MUST 受複雜度上限約束。

來源：issue #561 工作項 1；Epic #560；frontend-agent-rules F12（本 change 新增）；clarification Q7。

#### Scenario: 測試檔長度豁免但複雜度不豁免

- **WHEN** `frontend/src/components/` 底下有一個測試檔，含 301 行非空白、非註解的程式、一個 81 行的函式，以及一個有 16 條獨立 `if` 分支的函式，執行 `pnpm --filter frontend lint`
- **THEN** lint 以非 0 結束碼失敗，輸出只對複雜度上限回報該檔，沒有回報檔案行數與函式行數上限

### Requirement: 前端既有超標程式以具名豁免列管

既有超標的前端程式 SHALL 只能以具名豁免放行。每筆豁免 MUST 指名一個檔案、一條上限、放寬後的上限、issue 編號與理由；放寬後的上限 MUST 是天花板，該檔超過它時 lint MUST 失敗。豁免 MUST NOT 影響該檔的其他上限，也 MUST NOT 影響其他檔案。本 change 合併時唯一的豁免是 `frontend/src/pages/dev-gallery/dev-gallery-page.tsx` 的函式行數，放寬到 180（#561）。

來源：issue #561 工作項 1、2、4；Epic #560；frontend-agent-rules F12（本 change 新增）；clarification Q3、Q8。

#### Scenario: 具名豁免的檔案在現況下通過

- **WHEN** 在本 change 合併時的 `frontend/` 執行 `pnpm --filter frontend lint`
- **THEN** lint 以結束碼 0 結束，`dev-gallery-page.tsx` 的頁面函式（174 行）沒有被回報

#### Scenario: 具名豁免檔案再變長仍失敗

- **WHEN** `dev-gallery-page.tsx` 的頁面函式增長到 181 行非空白、非註解的程式，執行 `pnpm --filter frontend lint`
- **THEN** lint 以非 0 結束碼失敗，輸出指出該函式超過 180 行的上限

#### Scenario: 具名豁免不放寬其他上限與其他檔案

- **WHEN** 查詢 `dev-gallery-page.tsx` 與 `frontend/src/components/` 底下任一非測試檔生效的上限設定
- **THEN** `dev-gallery-page.tsx` 的檔案行數上限為 300、複雜度上限為 15、函式行數上限為 180；`frontend/src/components/` 底下的檔案函式行數上限仍為 80

### Requirement: 前端過期的具名豁免讓測試失敗

前端測試 SHALL 對每筆具名豁免以未放寬的上限檢查該檔；該檔在未放寬的上限下已不再違規時，前端測試 MUST 失敗並指出應移除的豁免。

來源：issue #561 工作項 4、6；Epic #560；frontend-agent-rules F12（本 change 新增）；clarification Q8、Q10。

#### Scenario: 豁免過期時探針失敗

- **WHEN** `dev-gallery-page.tsx` 的頁面函式被縮短到 80 行以內，而該檔的具名豁免仍在，執行 `pnpm --filter frontend test`
- **THEN** 測試以非 0 結束碼失敗，輸出指出 `dev-gallery-page.tsx` 的函式行數豁免已過期

### Requirement: 後端函式的複雜度、敘述數與分支數上限

`backend/` 底下的 Python 程式（含 `backend/tests/`）每個函式 SHALL 圈複雜度不超過 10、敘述數不超過 30、分支數不超過 10；任一項超過時後端 lint MUST 失敗並指出該函式的位置與超過的上限。參數數與回傳數 MUST NOT 列入本上限。`backend/alembic/versions/` 除外，見下方 Requirement「自動產生的遷移腳本不受上限約束」。

來源：issue #561 工作項 1、3；Epic #560；backend-agent-rules B11（本 change 新增）；clarification Q6、Q7、T2。

#### Scenario: 敘述數超過上限的後端函式讓 lint 失敗

- **WHEN** `backend/app/` 底下有一個含 31 個敘述的函式，執行 `cd backend && uv run ruff check .`
- **THEN** lint 以非 0 結束碼失敗，輸出指出該函式的位置與「31 > 30」

#### Scenario: 分支數超過上限的後端函式讓 lint 失敗

- **WHEN** `backend/app/` 底下有一個含 11 條獨立 `if` 分支的函式，執行 `cd backend && uv run ruff check .`
- **THEN** lint 以非 0 結束碼失敗，輸出同時指出分支數超過 10 與圈複雜度超過 10

#### Scenario: 後端測試程式同樣受限

- **WHEN** `backend/tests/` 底下有一個含 31 個敘述的測試函式，執行 `cd backend && uv run ruff check .`
- **THEN** lint 以非 0 結束碼失敗，輸出指出該測試函式

#### Scenario: 參數多的函式不因本上限失敗

- **WHEN** `backend/app/` 底下有一個有 8 個參數、敘述數與分支數都在上限內、且有完整文件註解的公開函式，執行 `cd backend && uv run ruff check .`
- **THEN** 輸出沒有對該函式回報任何上限

### Requirement: 後端原始檔的行數上限

`backend/app/`、`backend/tests/` 與 `backend/alembic/` 底下的每個 `.py` 檔 SHALL 不超過 400 行。行數以純文字逐行計算，不依語法判斷：空白行與去掉前後空白後以 `#` 開頭的行 MUST NOT 計入（位於 docstring 內、以 `#` 開頭的行同樣不計入），其餘的行（含 docstring 的其他行）MUST 計入。超過時後端測試 MUST 失敗，並列出該檔的路徑、實際行數與上限。`backend/alembic/versions/` 除外，見下方 Requirement「自動產生的遷移腳本不受上限約束」。

來源：issue #561 工作項 1、3；Epic #560；backend-agent-rules B11（本 change 新增）；clarification Q5、Q12。

#### Scenario: 超過行數上限的後端檔案讓測試失敗

- **WHEN** `backend/app/` 底下有一個含 401 行計入行的 `.py` 檔，執行 `cd backend && uv run pytest`
- **THEN** 測試以非 0 結束碼失敗，輸出含該檔的路徑、401 與 400

#### Scenario: 剛好等於上限的後端檔案通過

- **WHEN** 同一個檔案縮短為 400 行計入行，執行 `cd backend && uv run pytest`
- **THEN** 檔案行數的測試通過

#### Scenario: 後端行數計算排除空白與註解行但計入 docstring

- **WHEN** 一個後端 `.py` 檔含 380 行程式、30 行 docstring、50 行空白與 50 行只含 `#` 的註解
- **THEN** 該檔的計入行數為 410，檔案行數的測試失敗

#### Scenario: docstring 內以井號開頭的行不計入

- **WHEN** 一個後端 `.py` 檔含 395 行程式，以及一段 10 行的 docstring，其中 5 行去掉前後空白後以 `#` 開頭
- **THEN** 該檔的計入行數為 400，檔案行數的測試通過

### Requirement: 後端檔案行數的例外表兼棘輪

後端檔案行數 SHALL 只能以例外表放行超過 400 行的檔案。每個條目 MUST 指名一個檔案、該檔的上限、issue 編號與理由；條目的上限 MUST 取代 400 並作為天花板。條目所指的檔案已不超過 400 行時，後端測試 MUST 失敗並指出應移除的條目。本 change 合併時例外表 MUST 為空。

來源：issue #561 工作項 1、4；Epic #560；backend-agent-rules B11（本 change 新增）；clarification Q5、Q8。

#### Scenario: 例外表內的檔案在上限內通過

- **WHEN** 例外表有一筆上限為 450 的條目，所指的檔案有 430 行計入行
- **THEN** 檔案行數的測試通過

#### Scenario: 例外表內的檔案超過條目上限時失敗

- **WHEN** 同一筆條目所指的檔案增長到 451 行計入行
- **THEN** 檔案行數的測試失敗，輸出含該檔的路徑、451 與 450

#### Scenario: 例外表條目過期時失敗

- **WHEN** 例外表有一筆條目，所指的檔案只有 400 行計入行
- **THEN** 檔案行數的測試失敗，輸出指出該條目已過期、應移除

#### Scenario: 合併時例外表為空

- **WHEN** 在本 change 合併時的 `backend/` 執行 `uv run pytest`
- **THEN** 檔案行數的測試通過，例外表沒有任何條目

### Requirement: 自動產生的遷移腳本不受上限約束

`backend/alembic/versions/` 底下的遷移腳本 SHALL 不受後端複雜度、敘述數、分支數與檔案行數上限約束；`backend/alembic/` 的其他檔案 MUST 照常受限。

來源：issue #561 工作項 1、3；Epic #560；backend-agent-rules B11（本 change 新增）；clarification Q5、Q7。

#### Scenario: alembic/versions 不受限

- **WHEN** `backend/alembic/versions/` 底下有一個含 31 個敘述、11 條獨立 `if` 分支的函式，所在檔案有 401 行計入行，執行 `cd backend && uv run ruff check .` 與 `uv run pytest`
- **THEN** lint 沒有對該檔回報複雜度、敘述數或分支數上限，檔案行數的測試沒有把該檔列為超標

#### Scenario: alembic 的其他檔案照常受限

- **WHEN** 同一個函式放在 `backend/alembic/` 的根層檔案，執行 `cd backend && uv run ruff check .`
- **THEN** lint 以非 0 結束碼失敗，輸出指出該函式

### Requirement: 上限違規在既有的檢查步驟失敗

本 capability 的每一條上限 SHALL 以錯誤等級回報，MUST NOT 以警告等級或報告期放行。違規 MUST 讓既有的檢查步驟失敗：前端在前端 lint，後端複雜度類在後端 lint，後端檔案行數在後端測試；本機 `pnpm run check` 與 CI 的判定 MUST 相同。本 change MUST NOT 新增 CI job、CI 步驟或 `pnpm run check` 的步驟。

來源：issue #561 工作項 7；Epic #560；testing-agent-rules T9；agent-hook-contract H4、H7；clarification Q5、Q10、Q11。

#### Scenario: 超標的前端程式讓 CI 的前端 lint 失敗

- **WHEN** PR 在 `frontend/src/components/` 加入一個 81 行的非測試函式，其餘程式都符合規則
- **THEN** CI 的前端 job 在 lint 那一步失敗，後續的型別檢查、測試與建置不執行；本機 `pnpm run check` 在前端 lint 那一步以非 0 結束

#### Scenario: 超標的後端程式讓 CI 的後端 job 失敗

- **WHEN** PR 在 `backend/app/` 加入一個含 31 個敘述的函式，或加入一個 401 行計入行的檔案
- **THEN** 前者讓 CI 的後端 SQLite job 在 lint 那一步失敗；後者讓兩個後端 job 在測試那一步失敗

#### Scenario: 檢查步驟數不變

- **WHEN** 比較本 change 合併前後 CI 的 job 與步驟清單，以及 `pnpm run check` 的步驟清單
- **THEN** 兩份清單都沒有新增或移除任何 job 或步驟

### Requirement: 常駐探針證明上限仍然有效

前後端 SHALL 各有常駐的探針測試，對超過上限一個單位的合成樣本確認每條上限以錯誤等級回報，並逐字比對約定的上限值與例外範圍。上限被改寬、被降為警告、被關閉，或例外範圍被放大時，探針測試 MUST 失敗並指出是哪一條上限。探針樣本 MUST 是合成程式碼，不含任何資料集內容。

來源：issue #561 工作項 6；Epic #560；frontend-agent-rules F12、backend-agent-rules B11（本 change 新增）；testing-agent-rules T9；clarification Q10。

#### Scenario: 前端規則被改寬時探針失敗

- **WHEN** 前端函式行數上限被改成 100，或複雜度上限被降為警告等級，執行 `pnpm --filter frontend test`
- **THEN** 測試以非 0 結束碼失敗，輸出指出被放寬的那一條上限

#### Scenario: 前端例外範圍被放大時探針失敗

- **WHEN** 前端測試檔的複雜度上限被關閉，執行 `pnpm --filter frontend test`
- **THEN** 測試以非 0 結束碼失敗，輸出指出測試檔的複雜度上限沒有生效

#### Scenario: 後端規則被改寬時探針失敗

- **WHEN** 後端敘述數上限被改成 50，或複雜度上限被移出 lint 的檢查範圍，執行 `cd backend && uv run pytest`
- **THEN** 測試以非 0 結束碼失敗，輸出指出被放寬或被移除的那一條上限

#### Scenario: 後端例外範圍被放大時探針失敗

- **WHEN** `backend/tests/` 被加入複雜度、敘述數或分支數上限的豁免範圍，執行 `cd backend && uv run pytest`
- **THEN** 測試以非 0 結束碼失敗，輸出指出 `tests/` 的上限沒有生效

### Requirement: 前端尺寸探針檔不留在工作目錄

前端尺寸探針測試寫入的探針檔 SHALL 在測試結束時移除，測試失敗時 MUST 同樣移除。探針檔 MUST 被版控忽略。探針檔因測試被中斷而殘留時的處理見 `workspace-commands`「check 遇到探針殘留檔時失敗」。

來源：issue #561 工作項 6；Epic #560；testing-agent-rules T5、T11；clarification Q10。

#### Scenario: 探針測試結束後沒有殘留檔

- **WHEN** 執行 `pnpm --filter frontend test`，不論探針測試通過或失敗
- **THEN** 測試結束後 `frontend/src/components/size-probe.tsx` 與 `frontend/src/components/size-probe.test.tsx` 都不存在

#### Scenario: 尺寸探針檔被版控忽略

- **WHEN** `frontend/src/components/size-probe.tsx` 或 `frontend/src/components/size-probe.test.tsx` 存在，執行 `git status --porcelain`
- **THEN** 輸出不列出該檔
