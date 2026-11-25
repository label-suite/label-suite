# Proposal

## Why

Epic #560 要在技術債長出來之前加上機器防線。子單 #562 處理其中「測試把平台層 mock 掉、測試全過但正式版卻壞」這一類。`testing-agent-rules.mdx` 的 T4 已規定 integration 測試走真路由、真授權、真資料庫，T6 規定替身只放在外部網路邊界，但兩條的檢查方式都標「待建置」，目前完全靠審查。#506 已合併，`semgrep` CI job 與 `scripts/check.mjs` 已在跑，新檢查可以掛在既有的 gate 上。

現況（`origin/main` 實測，見 `system-analysis.md` §現況量測）：`backend/tests/integration/` 內沒有以 `app.` 字串為目標的替身，但有 4 個呼叫點用 `monkeypatch.setattr` 替換從 `app` 匯入的 `export_openapi` 輸出路徑常數；conftest 與 integration 都呼叫 `create_app`、沒有直接建構 `FastAPI(`，但沒有任何測試守住這件事。`system-design.md` 另發現：目前 CI 的 `semgrep scan backend/ frontend/ e2e/` 因 Semgrep 內建預設忽略 `tests/` 而掃到 0 個測試檔，system-analysis 寫的「掃描範圍已含 `tests/`」不成立（system-design N1），所以規則寫對還不夠，掃描範圍也要先處理。

這是技術 change，`docs/specs/` 沒有對應的業務規格，不涉及使用者可見功能。需求依據為 issue、ADR 與規則文件條號（spec-migration D4；維護者 2026-11-20 裁定，#503）。ADR 沒有「替身只放在網路邊界」的決議，規則只存在於 T4、T6；追溯方式見待決問題 Q10。

## What Changes

下列範圍來自 issue #562 的六個工作項。**要擋哪些寫法、用什麼機制、例外怎麼記等細節都還是待決問題**（見下節），依 Epic #560 的裁定由維護者問答決定，本 proposal 不替它們選邊；寫在這裡的機制是 `system-design.md` 的「建議」，不是決議，clarification 之後才定案。

- **機器檢查**：新增一道檢查，擋住 `backend/tests/integration/`（及 Q2 決定納入的 harness 檔案）把本專案自己的模組換成替身，並接進 CI。候選機制是 Semgrep 規則（`.semgrep/` 新規則與 `.semgrep/tests/` 樣本，`semgrep --test` 與 `semgrep scan` 已在 CI）；若 Semgrep 表達不出 Q1 選定的寫法，退回 pytest 結構測試（Q4）。
- **掃描範圍修補（N1）**：因為現行 `semgrep scan` 掃不到任何 `tests/`，Q4 選 Semgrep 時需二選一：S1 在 repo 根目錄加 `.semgrepignore`（既有規則的範圍一併變大，`label-suite-hardcoded-secret` 對新納入的檔案多 4 個命中），或 S2 另開一個 CI 步驟加 `--x-ignore-semgrepignore-files`（既有規則不動，但依賴實驗旗標、升級 Semgrep 時要重驗）。建議是 S2，待 clarification 決定。
- **harness 與 production 共用同一個 app 組裝函式（T4）**：以靜態規則（不得在 integration 與 conftest 直接建構 `FastAPI(`，`app` fixture 必須呼叫 `create_app`）加行為測試（`test_harness_parity.py`，比對 harness 與 `create_app` 產出的中介層、例外處理器與路由集合，探針路由「只加不減」）守住（Q6）。
- **既有 4 個命中**（`backend/tests/integration/test_export_openapi.py` 的輸出路徑常數）：處理方式為待決 Q3（改測試、明文豁免、或視為檔案系統邊界）。
- **例外記法與證據**：例外怎麼記與違規等級為 Q7；持久的「刻意違規樣本會失敗」證據為 Q8，另在 acceptance 附一次實際對違規樣本跑 CI 指令的輸出。`nosemgrep` 無法強制理由格式（N3），若要強制，可能需要一個小型 pytest 檢查 `nosemgrep` 的理由。
- **規則文件寫回**：`testing-agent-rules.mdx` 的 T4、T6 檢查方式與文首狀態段由「待建置」改為實際指令；T4 適用路徑是否補 `conftest.py` 視 Q2；`agent-rules.mdx`、`backend-agent-rules.mdx`、`frontend-agent-rules.mdx`、`api-agent-rules.mdx` 附錄來源表中同類的狀態敘述同步（Q9）。T9 表依 sa 建議不新增項目。

無 API、資料模型、畫面或權限的變動（見 `api-contract.md`、`ui-design.md`；`app/` 不動），沒有破壞性變更，測試集答案隔離不適用。唯一的行為變化是日後 `tests/integration/` 出現被禁的寫法會讓 CI 失敗。

### 待決問題（clarification 逐題問答，尚未決議）

| #   | 主題                                                     | 候選與建議（出處 `system-analysis.md` §待決問題）                                        |
| :-- | :------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| Q1  | 要擋哪些寫法                                             | A 只擋 `app.` 字串目標；B 加擋從 `app` 匯入的物件；C 全擋；D 再加 mock 匯入。建議 B 加 D |
| Q2  | 網路邊界與允許的替身；是否納入 `conftest.py`、`probe.py` | A 白名單目標；B 專用邊界層；C 兩者並用。建議 C，並納入 `conftest.py` 與 `probe.py`       |
| Q3  | 既有 4 個 `export_openapi` 輸出路徑命中                  | A 改測試；B 明文豁免；C 視為檔案系統邊界。建議 B 或 C                                    |
| Q4  | 機制                                                     | A Semgrep；B pytest 結構測試；C 獨立腳本。建議 A 為主，表達不出再退 B；含 N1 的 S1／S2   |
| Q5  | 前端是否納入                                             | A 不納入；B 納入全部；C 先定義 integration 命名；D 另處理 `fetch` 4 處。建議 A           |
| Q6  | 如何守住「共用同一個 app 組裝函式」                      | A 結構測試；B 第二條規則；C 行為測試。建議 B 加 C，探針路由允許只加不減                  |
| Q7  | 例外記法與違規等級                                       | A 無例外；B 行內註解加理由；C allowlist。建議 B，且 `nosemgrep` 限 `tests/integration/`  |
| Q8  | 違規樣本證據形式                                         | A 一次性；B 持久樣本。建議 B，另在 acceptance 附實際輸出                                 |
| Q9  | 規則文件寫回範圍與 capability 歸屬                       | A 擴充既有 capability；B 新增。建議 B，T9 不新增項目                                     |
| Q10 | 追溯依據（ADR 無「替身邊界」決議）                       | 建議接受規則文件條號加維護者在 #562 的決議，不先補 ADR                                   |

另有技術待決 N1 至 N7（`system-design.md` §技術待決問題）：N1 掃描範圍、N2 `semgrep --test` 不套用 `paths` 所以樣本證明不了範圍、N3 `nosemgrep` 理由無法由 Semgrep 強制、N4 `fixture app.router` 可能誤判、N5 三個繞過手法（區域變數別名、字串拼接、取出 `dependency_overrides` 再寫入）Semgrep 擋不住、N6 行為測試不跑 lifespan、N7 新測試檔各自不得超過 #561 的 400 行上限。

## Capabilities

以下是**候選**，最終歸屬由 Q9 與 Q4 決定；specs 在 clarification 之後才寫。

### New Capabilities

- `test-boundary-checks`（候選名，Q9 建議 B）：integration 測試不得替換本專案自己的模組、被擋的寫法與允許的邊界、例外記法與違規等級、harness 與 production 共用同一個 app 組裝函式、以常駐樣本證明規則有效。

### Modified Capabilities

- 候選：`ci-quality-gates`（Q9 選 A，或 Q4 選 Semgrep 且 N1 選 S2 而需要新的 CI 步驟時）、`security-scanning`（N1 選 S1，既有「專案禁令掃描違規即失敗」的掃描範圍改變）、`workspace-commands`（`scripts/check.mjs` 新增或改動步驟時）。是否需要 delta 於 clarification 後確認；若 Q9 選 B 且不動任何既有 requirement，就只有新增一個 capability，不需 `skip_specs`。

`backend-code-boundaries`、`code-size-limits`（#561 已歸檔，僅 N7 要求新測試檔遵守其上限）不受影響。

## Impact

- **Semgrep**：`.semgrep/` 新規則檔（或併入 `label-suite.yml`，Q4）與 `.semgrep/tests/` 的違規與合規樣本；N1 選 S1 時另加 repo 根目錄 `.semgrepignore`。
- **CI**：`.github/workflows/ci.yml` 的 `semgrep` job（N1 選 S2 時新增一個帶 `--x-ignore-semgrepignore-files` 的步驟；選 S1 時可能不需改）。
- **工具**：`scripts/check.mjs` 與 `scripts/tests/check.test.mjs`（本機 `pnpm run check` 要與 CI 一致，若新增步驟）。
- **後端測試**：新增 `backend/tests/unit/test_harness_parity.py`（Q6）；Q7 要強制 `nosemgrep` 理由時再加 `backend/tests/unit/test_semgrep_exemptions.py`（N3）；每個新檔 ≤ 400 行（N7）。Q3 選 A 時才會改 `backend/tests/integration/test_export_openapi.py`（可能連帶產品碼）。
- **文件**：`docs/development/rules/testing-agent-rules.mdx`（T4、T6、文首狀態段）、`agent-rules.mdx`、`backend-agent-rules.mdx`、`frontend-agent-rules.mdx`、`api-agent-rules.mdx` 的對應狀態與來源敘述。
- **specs**：新增 `openspec/specs/test-boundary-checks/`（候選），其他 delta 視上節。
- **與兄弟 issue 的衝突風險**：#563 也可能動 `backend/pyproject.toml`、`scripts/check.mjs`、`ci.yml`；#561 已合併。互不依賴，後合併者 merge `origin/main`；新規則集中成獨立檔案以縮小衝突範圍。
- **不動**：`backend/app/`、`backend/openapi.json`、`frontend/src/api/generated/`、`docs/diagrams/architecture/*`。

## 不在範圍

- #563（後端單一入口清單與 import-linter 契約）、#564（定期架構盤點）、#561（已合併）。
- #111 的七個 gate（含 T9 第 6 項授權與答案隔離回歸測試）、#506 的 CI 骨架。
- N1 選 S1 時會新增的 4 個既有 `label-suite-hardcoded-secret` 命中（`backend/tests/integration/test_app_assembly.py:126`、`backend/tests/probe.py:23`、`backend/tests/unit/test_envelope.py:175`、`frontend/build/extract-tokens.ts:23`）：依 AGENTS.md「Anything outside that code path is only reported and gets its own issue」，本 change 只回報，不順手修；若維護者選 S1，處理方式（另開 issue 後暫放 `nosemgrep`，或在本 change 內處理）在 clarification 決定。
- 前端：除非 Q5 決定納入，否則不動；Q5 建議的「前端 integration 沒有可區分的位置」是後續議題，不在這裡解決，4 處 `vi.spyOn(globalThis, "fetch")` 不列為違規。
- `e2e/` 套件、環境變數與工作目錄的 `setenv`／`delenv`／`chdir`（行程邊界，不擋）。
- `docs/specs/`、`docs/specs/00-prd.mdx`、`design/prototype/`；任何 UI 與 API 變動。

## 引用來源

- GitHub issue #562（六個工作項）、Epic #560（§維護者裁定 2026-11-23：規則細節由維護者問答決定，agent 不自訂）。
- `docs/development/rules/testing-agent-rules.mdx`：T4（integration 的真實邊界）、T6（外部替身設在邊界上）、文首狀態段、T9 gate 表、§來源表。
- `docs/development/adr/007-testing-strategy.mdx` D1；`003-backend-architecture.mdx`、`006-task-config-and-answer-isolation.mdx` 的相關行（無「替身邊界」決議）。
- `agent-rules.mdx`、`backend-agent-rules.mdx`、`frontend-agent-rules.mdx`、`api-agent-rules.mdx` 的附錄來源表。
- `openspec/specs/ci-quality-gates`、`security-scanning`、`backend-code-boundaries`、`workspace-commands`、`code-size-limits`。
- `AGENTS.md`：Hard Rules、Language Rules、「衝突不由 agent 裁決」「範圍鎖定」、Required Behaviors 的「呼叫路徑之外只回報」。
- 本 change 的 `system-analysis.md`（待決問題 Q1 至 Q10）、`system-design.md`（先決發現 N1、技術待決 N1 至 N7）、`ui-design.md`（無 UI 變更）、`api-contract.md`（無 API 變更）。
