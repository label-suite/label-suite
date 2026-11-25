# Proposal

## Why

Epic #560 要在技術債長出來之前加上機器防線。子單 #561 處理其中「超長元件、一個檔案包山包海」這一類：目前前端 ESLint 沒有 `max-lines`、`max-lines-per-function`、`complexity`，後端 ruff 沒有開 `C901` 與 `PLR0915`／`PLR0912`，檔案與函式長度、圈複雜度完全沒有機械上限，只靠審查。#506 已合併，`frontend` 與 `backend-sqlite` 兩個 CI job 已在跑 lint 與 pytest，新規則可直接掛在這兩個既有 gate 上，不需新增 CI job 或步驟。

這是技術 change，`docs/specs/` 沒有對應的業務規格，不涉及使用者可見功能。需求依據為 issue 與規則文件條號（spec-migration D4；維護者 2026-11-20 裁定，#503）。

`agent-rules.mdx` 與 `frontend-agent-rules.mdx` 明文「不採用」機械行數門檻（理由是行數不是複雜度），而 issue #561 與 Epic #560 要求新增行數上限。此矛盾已由 clarification Q1 決議為並存：上限是擋極端值的 CI 護欄，不是拆分判準，F5、R4「不以行數取代職責審查」的原意保留。

## What Changes

所有門檻、例外與機制已於 2026-11-25 依維護者的標準授權在 `clarification.md` 決議（Q1 至 Q12、T2）；本 change 依該決議實作，不再有待決項。

- **前端（`frontend/eslint.config.js`）**：新增三條上限，一律 `error`、不設報告期（Q11）。
  - 檔案行數 `max-lines` 300，函式行數 `max-lines-per-function` 80（`IIFEs: false`），兩者排除空白與註解（Q2、Q3）。
  - 複雜度 `complexity` 15（Q4）。
  - 前端規則集中成一個設定物件，只套用 `SOURCE_FILES`（`src/**/*.{ts,tsx}`、`build/**/*.ts`）；不在其中的檔案不在範圍，例如套件根目錄的設定檔（`eslint.config.js`、`vite.config.ts`、`vitest.config.ts`、`orval.config.ts`），生成檔沿用既有全域 ignore；測試檔（既有 `TEST_FILES`）只豁免 `max-lines` 與 `max-lines-per-function`，複雜度照樣檢查（Q7）。
- **後端（`backend/pyproject.toml`）**：ruff 以明確規則碼開 `C901`（`max-complexity` 10）、`PLR0915`（`max-statements` 30）、`PLR0912`（`max-branches` 10），不開 `PLR0913`、`PLR0911`、`PLR0917`；`select` 只在尾端追加；`alembic/versions/` 以既有 `per-file-ignores` 豁免這三條，`tests/` 不豁免；不開 `RUF100`（Q6、Q7、T2）。
- **後端檔案行數**：ruff 沒有對應規則，採 B'：`backend/tests/unit/` 下的 pytest 測試，上限 400 行（純文字逐行計算：排除空白行與去掉前後空白後以 `#` 開頭的行，docstring 內以 `#` 開頭的行同樣排除，docstring 的其他行計入），`alembic/versions/` 排除；例外表的條目同時是棘輪上限，條目過期（檔案已低於預設上限）時測試失敗（Q5）。不新增 CI job、不新增 `scripts/check.mjs` 步驟、不改 `ci.yml`。
- **既有超標程式**：具名豁免、本 change 不修、不另開 issue（Q8）。`frontend/src/pages/dev-gallery/dev-gallery-page.tsx`（174 行的頁面函式）在 `eslint.config.js` 的 `NAMED_EXEMPTIONS` 常數放寬到剛好高於現況（180），註明 `#561` 與理由；探針測試斷言清單內每個檔案仍然超標，豁免過期就失敗。不重構任何產品碼。
- **證明規則有效（Q10 B：常駐探針測試）**：
  - 前端 `frontend/build/size-limits-config.test.ts`，使用實體探針檔 `size-probe.tsx`、`size-probe.test.tsx`（型別感知規則需要實體檔）。
  - 後端 `backend/tests/unit/test_size_limits.py`，比照 `test_layer_boundaries.py`，依規則碼過濾 ruff JSON。
  - 規則被改寬、降級或例外範圍被放大時，每次 CI 都會失敗。
- **工具**：`scripts/check.mjs` 的殘留探針檢查只擴充探針名清單以認得上述新探針，不加步驟；同步 `scripts/tests/check.test.mjs`（T1）。這個行為屬 `workspace-commands`，以 MODIFIED delta 把「check 遇到探針殘留檔時失敗」一般化為所有被中斷的前端 lint 探針測試留下的探針檔。
- **規則文件寫回（Q1、Q12）**：新增 F12（前端，`frontend-agent-rules.mdx`）與 B11（後端，`backend-agent-rules.mdx`）各一條，各寫一句「行」的定義，F5 原意不改；同步兩份文件的文首狀態段與條數、`agent-rules.mdx` 的總覽段與 Q1 要改寫的附錄／來源對照（把「不採用」改寫成「不採用作為拆分判準；另設 CI 上限擋極端值」並寫明兩者關係）、`testing-agent-rules.mdx` T9。
- **常駐文件**：`docs/diagrams/architecture/backend-modules.mdx` 的 §新增業務模組的檢查清單補一條，列為 tasks 的文件任務。

無破壞性變更：沒有 API、資料模型、畫面或權限的變動（見 `api-contract.md`、`ui-design.md`），不涉及任何標記員能到達的端點，測試集答案隔離不適用。唯一的行為變化是日後任何超標的新程式碼會讓 CI 失敗；既有程式碼在決議的數值下，除 `dev-gallery-page.tsx` 的具名豁免外零違規。

### 決議摘要

12 題與 T2 的完整決議、理由與日期見 `clarification.md` §待釐清項目；本節只指向，不重抄。決議依維護者 2026-11-25「接下來有需要決策的都依照你的建議就好」的授權，維護者可推翻任一題，推翻時依 Q 編號回修。

| #   | 主題                     | 決議（細節見 clarification）                                   |
| :-- | :----------------------- | :------------------------------------------------------------- |
| Q1  | 與「不採用機械行數門檻」 | 並存：極端值護欄，不是拆分判準                                 |
| Q2  | 前端檔案行數             | 300                                                            |
| Q3  | 前端函式行數             | 80                                                             |
| Q4  | 前端複雜度               | 15                                                             |
| Q5  | 後端檔案行數機制         | B'：pytest 測試，400 行，例外表兼棘輪                          |
| Q6  | 後端 ruff 規則           | `C901` 10、`PLR0915` 30、`PLR0912` 10                          |
| Q7  | 例外範圍                 | 前端測試檔只豁免長度；設定檔不在範圍；`alembic/versions/` 豁免 |
| Q8  | 既有超標程式             | 具名豁免（棘輪）、不修、不另開 issue                           |
| Q9  | capability 歸屬          | 新增 `code-size-limits`；不改 `ci-quality-gates`               |
| Q10 | 違規樣本證據             | B：常駐探針測試，擴充 `scripts/check.mjs` 探針名清單           |
| Q11 | 違規等級                 | 一律 `error`，不設報告期                                       |
| Q12 | 規則文件寫回             | 新增 F12、B11，同步狀態段、條數、T9、Q1 改寫                   |
| T2  | 是否開 `RUF100`          | 不開                                                           |

## Capabilities

### New Capabilities

- `code-size-limits`：前後端檔案行數、函式長度與複雜度的機械上限與數值、例外範圍、具名豁免的棘輪與過期偵測、違規等級，以及以常駐探針測試證明規則有效（Q9）。前後端與證據測試寫在同一份 spec。

### Modified Capabilities

- `workspace-commands`：MODIFIED「check 遇到探針殘留檔時失敗」。原文字只涵蓋 `frontend/src/pages/` 底下的分層探針，改為涵蓋被中斷的前端 lint 探針測試留下的探針檔：`src/pages/**/boundary-probe.tsx`、`src/components/boundary-probe.tsx`、`src/components/size-probe.tsx`、`src/components/size-probe.test.tsx`（Q10、T1；design D8）。`check` 的步驟不變。

`ci-quality-gates` 不另寫 delta：新規則掛在既有 lint 步驟上，該 capability 的失敗條件已涵蓋「lint 有錯就失敗」（Q9）。`frontend-code-boundaries`、`backend-code-boundaries` 不受影響。

新增一個、修改一個 capability，不需 `skip_specs`。

## Impact

- **設定**：`frontend/eslint.config.js`（規則設定物件與 `NAMED_EXEMPTIONS`）、`backend/pyproject.toml`（ruff `select`、`max-complexity`、`max-statements`、`max-branches`、`per-file-ignores`）。
- **測試**：新增 `frontend/build/size-limits-config.test.ts`（含探針檔 `size-probe.tsx`、`size-probe.test.tsx`）、`backend/tests/unit/test_size_limits.py`（含後端檔案行數檢查與例外表）。
- **工具**：只改 `scripts/check.mjs` 的殘留探針名清單與 `scripts/tests/check.test.mjs`；不改 `.github/workflows/ci.yml`，不新增 `scripts/` 檢查腳本、CI job 或 `check.mjs` 步驟。
- **文件**：`docs/development/rules/agent-rules.mdx`、`frontend-agent-rules.mdx`（F12）、`backend-agent-rules.mdx`（B11）、`testing-agent-rules.mdx`（T9）；`docs/diagrams/architecture/backend-modules.mdx`。
- **specs**：新增 `openspec/specs/code-size-limits/`，修改 `openspec/specs/workspace-commands/` 的「check 遇到探針殘留檔時失敗」（皆由本 change 的 delta 在歸檔時同步）。
- **與兄弟 issue 的衝突風險**：#562 也會動 `frontend/eslint.config.js`，#563 也會動 `backend/pyproject.toml`（也可能動 `scripts/check.mjs`、`ci.yml`）；三張互不依賴，後合併者 merge `origin/main`。設計上把新規則集中成獨立的設定區塊、後端 `select` 只在尾端追加，以縮小衝突範圍；Q5 B' 不新增 CI 或 `check.mjs` 步驟，也是為了少碰共用檔。
- **既有程式**：依 system-analysis 量測，現有後端在決議的數值下零違規（最大 `middleware.py` 319 行、tests 399 行）；前端只有 `frontend/src/pages/dev-gallery/dev-gallery-page.tsx:85` 的頁面函式（174 行）超標，由 Q8 的具名豁免處理，不改動該檔。

## 不在範圍

- 重構 `dev-gallery-page.tsx` 或任何既有超標程式（Q8：具名豁免，不修，不另開 issue）。
- `RUF100`（T2）；`PLR0913`、`PLR0911`、`PLR0917`。
- #562（integration 測試禁止 mock 自己的模組）、#563（後端單一入口與 import-linter 契約）、#564（定期架構盤點）。
- #111 的七個 gate、#506 的 CI job；新增 CI job 或 `check.mjs` 步驟；修改 `.github/workflows/ci.yml`。
- `e2e/` 套件。
- `docs/specs/`、`docs/specs/00-prd.mdx` 與 `design/prototype/`；任何 UI 與 API 變動。

## 引用來源

- GitHub issue #561（工作項七項）、Epic #560（§維護者裁定 2026-11-23：門檻數字與規則細節由維護者問答決定，agent 不自訂）。
- 本 change 的 `clarification.md`（Q1 至 Q12、T2，2026-11-25 決議；P2）。
- `AGENTS.md`：Hard Rules、Language Rules、Agent Rules Index；「衝突不由 agent 裁決」「範圍鎖定」。
- `docs/development/rules/agent-rules.mdx`（R3、R4、§附錄：刻意不採用的來源條文）、`frontend-agent-rules.mdx`（F5 與其「不採用」條文）、`backend-agent-rules.mdx`（B2）、`testing-agent-rules.mdx`（T9）、`agent-hook-contract.mdx`（H4、H7）。
- ADR-001 至 ADR-008：全文掃描，沒有行數或複雜度數值的來源。
- `openspec/specs/ci-quality-gates`（不改，見 Capabilities）、`openspec/specs/workspace-commands`（MODIFIED，見 Capabilities）。
- 本 change 的 `system-analysis.md`（§現況量測）、`system-design.md`（機制總覽、技術待決 T1 至 T5）、`ui-design.md`（無 UI 變更）、`api-contract.md`（無 API 變更）。
