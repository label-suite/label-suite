# Proposal

## Why

Epic #560 要在技術債長出來之前加上機器防線。子單 #561 處理其中「超長元件、一個檔案包山包海」這一類：目前前端 ESLint 沒有 `max-lines`、`max-lines-per-function`、`complexity`，後端 ruff 沒有開 `C901` 與 `PLR0915`／`PLR0912`，檔案與函式長度、圈複雜度完全沒有機械上限，只靠審查。#506 已合併，`frontend` 與 `backend-sqlite` 兩個 CI job 已在跑 lint，新規則可直接掛在這兩個既有 gate 上，不需新增 CI job。

這是技術 change，`docs/specs/` 沒有對應的業務規格，不涉及使用者可見功能。需求依據為 issue 與規則文件條號（spec-migration D4；維護者 2026-11-20 裁定，#503）。

另有一個必須先決定的矛盾（待決問題 Q1）：`agent-rules.mdx` 與 `frontend-agent-rules.mdx` 明文「不採用」機械行數門檻（理由是行數不是複雜度），而 issue #561 與 Epic #560 要求新增行數上限。依 `AGENTS.md` 衝突不由 agent 裁決，本 proposal 不選邊。

## What Changes

範圍依 system-analysis 與 system-design，**所有門檻數字、例外與選項都尚未決定**，由 clarification 逐題問答後才寫入 specs、design、tasks。本 proposal 只列出會改什麼，不預先採用任何建議值。

- **前端**：在 `frontend/eslint.config.js` 新增檔案行數（`max-lines`）、函式行數（`max-lines-per-function`）、複雜度（`complexity`）三類上限，並依決議設定測試檔、設定檔等例外（Q2、Q3、Q4、Q7、Q11）。
- **後端**：在 `backend/pyproject.toml` 的 ruff 開啟 `C901`、`PLR0915`、`PLR0912` 並設定其數值，例外沿用既有的 `per-file-ignores` 位置（Q6、Q7）。ruff 沒有檔案行數與函式行數規則，函式長度以敘述數計。
- **後端檔案行數**：機制待定（Q5），候選為不設、`scripts/` 檢查腳本、pytest 測試、pylint 的 `too-many-lines`。選哪一條決定是否新增 CI 步驟與 `scripts/check.mjs` 步驟。
- **既有超標程式**：只列出清單，交維護者決定修或豁免（Q8）。不在本 change 內重構，除非維護者在 Q8 明確決定。已量測的現況列於 system-analysis §現況量測。
- **證明規則有效**：對刻意違規的樣本證明檢查會失敗（Q10：一次性證據，或沿用 `frontend/build/eslint-config.test.ts` 與 `backend/tests/unit/test_layer_boundaries.py` 的做法做成持久探針測試）。若採持久探針，需擴充 `scripts/check.mjs` 的殘留探針檢查與 `scripts/tests/check.test.mjs`（system-design T1）。
- **規則文件寫回**：把規則與實際指令寫回 `docs/development/rules/` 並同步各文件的狀態敘述、計數與交叉參照（Q1、Q12）。需要改寫的「不採用」條文範圍取決於 Q1。
- **常駐文件**：`docs/diagrams/architecture/backend-modules.mdx` 的 §新增業務模組的檢查清單待門檻定案後補一條，列為 tasks 的文件任務（system-design §常駐文件異動）。

無破壞性變更：沒有 API、資料模型、畫面或權限的變動（見 `api-contract.md`、`ui-design.md`），不涉及任何標記員能到達的端點，測試集答案隔離不適用。唯一的行為變化是日後任何超標的新程式碼會讓 CI 失敗。

### 待決問題（皆為 open，由 clarification 決定）

| #   | 主題                                                                   |
| :-- | :--------------------------------------------------------------------- |
| Q1  | 與規則文件「不採用機械行數門檻」的關係：並存的極端值護欄，或推翻該裁定 |
| Q2  | 前端檔案行數上限                                                       |
| Q3  | 前端函式行數上限                                                       |
| Q4  | 前端複雜度上限                                                         |
| Q5  | 後端檔案行數的機制（ruff 無對應規則）                                  |
| Q6  | 後端要開哪些 ruff 規則與數值                                           |
| Q7  | 例外範圍（生成檔、測試檔、設定檔、`alembic/`）                         |
| Q8  | 既有超標程式修或豁免，以及具名豁免的維護位置                           |
| Q9  | 規則歸屬的 capability                                                  |
| Q10 | 「違規樣本會失敗」的證據形式                                           |
| Q11 | 違規等級（是否設報告期）                                               |
| Q12 | 規則文件新增條文的編號與計數同步範圍                                   |

## Capabilities

歸屬由 Q9 決定，下列是候選，不是決議。

### New Capabilities

- `code-size-limits`（候選，Q9）：前後端檔案行數、函式長度與複雜度的機械上限、例外與違規時的失敗行為。若 Q9 決定併入既有 capability，則本節留空。

### Modified Capabilities

候選（Q9）：

- `ci-quality-gates`：「後端 lint、格式與型別檢查在 CI 執行」與「前端 lint、型別檢查、測試與建置在 CI 執行」兩條 requirement 的失敗條件需涵蓋新上限。
- `workspace-commands`：僅當 Q5 選擇新增檢查步驟時，本機 `pnpm run check` 與 CI 的步驟一致性要求會受影響。
- `frontend-code-boundaries`、`backend-code-boundaries`：僅當 Q9 決定把新規則放進它們時。

至少有一個 capability 受影響，不需 `skip_specs`；實際的 delta 檔案清單待 Q9 決議後確定。

## Impact

- **設定**：`frontend/eslint.config.js`、`backend/pyproject.toml`。
- **測試**：`frontend/build/` 與 `backend/tests/unit/` 下的探針測試（視 Q10）。
- **工具**：可能新增 `scripts/` 檢查腳本，並動到 `scripts/check.mjs`、`scripts/tests/check.test.mjs`、`.github/workflows/ci.yml`（視 Q5、Q10）。
- **文件**：`docs/development/rules/agent-rules.mdx`、`frontend-agent-rules.mdx`、`backend-agent-rules.mdx`、`testing-agent-rules.mdx`；`docs/diagrams/architecture/backend-modules.mdx`。
- **specs**：依 Q9 新增或修改 `openspec/specs/` 下的 capability。
- **與兄弟 issue 的衝突風險**：#562 也會動 `frontend/eslint.config.js`，#563 也會動 `backend/pyproject.toml`（也可能動 `scripts/check.mjs`、`ci.yml`）；三張互不依賴，後合併者 rebase。設計上把新規則集中成獨立的設定區塊以縮小衝突範圍。
- **既有程式**：依 system-analysis 量測，現有後端在工具預設值下零違規；前端主要超標為 `frontend/src/pages/dev-gallery/dev-gallery-page.tsx` 的頁面元件（174 行），以及依 Q4 而定的 `api/mutator.ts` 與 `components/ui/button.tsx`。

## 不在範圍

- 重構既有超標程式（只列出，除非 Q8 另有決議）。
- #562（integration 測試禁止 mock 自己的模組）、#563（後端單一入口與 import-linter 契約）、#564（定期架構盤點）。
- #111 的七個 gate、#506 的 CI job；新增 CI job。
- `e2e/` 套件。
- `docs/specs/`、`docs/specs/00-prd.mdx` 與 `design/prototype/`；任何 UI 與 API 變動。

## 引用來源

- GitHub issue #561（工作項七項）、Epic #560（§維護者裁定 2026-11-23：門檻數字與規則細節由維護者問答決定，agent 不自訂）。
- `AGENTS.md`：Hard Rules、Language Rules、Agent Rules Index；「衝突不由 agent 裁決」「範圍鎖定」。
- `docs/development/rules/agent-rules.mdx`（R3、R4、§附錄：刻意不採用的來源條文）、`frontend-agent-rules.mdx`（F5 與其「不採用」條文）、`backend-agent-rules.mdx`（B2）、`testing-agent-rules.mdx`（T9）、`agent-hook-contract.mdx`（H4、H7）。
- ADR-001 至 ADR-008：全文掃描，沒有行數或複雜度數值的來源（Q1）。
- `openspec/specs/ci-quality-gates`、`workspace-commands`、`frontend-code-boundaries`、`backend-code-boundaries`。
- 本 change 的 `system-analysis.md`（待決問題 Q1 至 Q12、§現況量測）、`system-design.md`（機制總覽、技術待決 T1 至 T5）、`ui-design.md`（無 UI 變更）、`api-contract.md`（無 API 變更）。
