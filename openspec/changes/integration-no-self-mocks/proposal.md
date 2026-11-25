# Proposal

## Why

Epic #560 要在技術債長出來之前加上機器防線。子單 #562 處理其中「測試把平台層 mock 掉、測試全過但正式版卻壞」這一類。`testing-agent-rules.mdx` 的 T4 已規定 integration 測試走真路由、真授權、真資料庫，T6 規定替身只放在外部網路邊界，但兩條的檢查方式都標「待建置」，目前完全靠審查。#506 已合併，`semgrep` CI job 與 `scripts/check.mjs` 已在跑，新檢查可以掛在既有的 gate 上。

現況（`origin/main` 實測，見 `system-analysis.md` §現況量測）：`backend/tests/integration/` 內沒有以 `app.` 字串為目標的替身，但有 4 個呼叫點用 `monkeypatch.setattr` 替換從 `app` 匯入的 `export_openapi` 輸出路徑常數；conftest 與 integration 都呼叫 `create_app`、沒有直接建構 `FastAPI(`，但沒有任何測試守住這件事。`system-design.md` 另發現：目前 CI 的 `semgrep scan backend/ frontend/ e2e/` 因 Semgrep 內建預設忽略 `tests/` 而掃到 0 個測試檔，system-analysis 原先寫的「掃描範圍已含 `tests/`」不成立（system-design N1），所以規則寫對還不夠，掃描範圍也要另外處理。

這是技術 change，`docs/specs/` 沒有對應的業務規格，不涉及使用者可見功能。需求依據為 issue、ADR 與規則文件條號（spec-migration D4；維護者 2026-11-20 裁定，#503）。ADR 沒有「替身只放在網路邊界」的決議，規則只存在於 T4、T6；依 clarification Q10，接受 T4、T6 加上本次決議作為追溯來源，不先補 ADR。

## What Changes

範圍來自 issue #562 的六個工作項。要擋哪些寫法、用什麼機制、例外怎麼記等細節，已由 `clarification.md` 依維護者 2026-11-25 的授權逐題決議（決議摘要見下節），下列內容照決議撰寫。

- **機器檢查（Q1、Q4）**：新增 Semgrep 規則檔 `.semgrep/test-boundaries.yml`，樣本放在 `.semgrep/tests/`，擋下測試把本專案自己的模組換成替身：以 `app` 開頭的字串目標、從 `app` 匯入的物件被 `setattr`／`setitem`／`delattr`／`patch` 系列替換、`MagicMock`／`AsyncMock`／`Mock`／`create_autospec` 與 `unittest.mock` 的使用，以及任何對 `dependency_overrides` 的寫入。環境變數與工作目錄（`setenv`、`delenv`、`chdir`）不擋。
- **掃描範圍與接進 CI（Q2、N1）**：掃描範圍是 `backend/tests/integration/`、`backend/tests/conftest.py`、`backend/tests/probe.py` 與日後的 `factories/`。因為現行 `semgrep scan` 掃不到任何 `tests/`，採 S2：`.github/workflows/ci.yml` 的 `semgrep` job 新增一步，用 `--x-ignore-semgrepignore-files` 與 `.semgrep/test-boundaries.yml` 掃測試；現有 `label-suite.yml` 的掃描不動，不新增 `.semgrepignore`。該旗標是實驗性的，靠 CI 釘住的 `semgrep/semgrep:1.186.0` 映像保證行為。網路邊界現階段採「凡不是本專案 `app` 的目標都視為邊界」，之後接上外部服務（Resend、OIDC）再改成明列的邊界模組清單。
- **本機與 CI 一致**：`scripts/check.mjs` 新增對應的一步，`scripts/tests/check.test.mjs` 的步驟數同步更新。
- **既有 4 個命中（Q3）**：`backend/tests/integration/test_export_openapi.py` 對 `export_openapi` 的 `DEFAULT_OUTPUT`、`DOCS_COPY_OUTPUT` 兩個輸出路徑常數的替換視為檔案系統邊界，規則以 `pattern-not` 放行這兩個常數，同一個模組的其他屬性照擋；不改那 4 個測試。
- **harness 與 production 共用同一個 app 組裝函式（Q6、T4）**：靜態規則擋 `conftest.py`、integration、`probe.py` 內的 `FastAPI(`、`fastapi.FastAPI(`、`Starlette(`；另加比對測試 `backend/tests/integration/test_harness_parity.py`，比 middleware 類別與順序、例外處理器與 `openapi()["paths"]`，harness 只能多出 `probe_router` 的路徑（只准加、不准減）。不比 `app.routes`，也不跑 lifespan（N6）。
- **例外記法（Q7、N3）**：行內 `# nosemgrep: <rule-id> -- <理由，引用 T4 或 T6>`；另加一支小 pytest，檢查測試範圍內每個 `nosemgrep` 都帶規則 id 與理由，不帶規則 id 的 `# nosemgrep` 直接失敗。
- **違規樣本的證據（Q8、N2）**：`.semgrep/tests/` 常駐樣本，由 CI 既有的 `semgrep --test .semgrep/` 每次執行；因 `semgrep --test` 不套用規則的 `paths`，掃描範圍改在驗收時一次性證明（暫時在 `conftest.py`、`probe.py` 放違規，確認 CI 用的指令會擋）。N5 的三種繞法（區域變數轉手、別處組字串、先讀出 `dependency_overrides` 再寫）Semgrep 看不到，樣本以「不標記」的行記下。
- **規則文件寫回（Q9）**：`docs/development/rules/testing-agent-rules.mdx` 的 T4、T6 檢查方式改成實際指令，T4 適用路徑補上 `conftest.py`、`probe.py`，文首狀態段同步；`agent-rules.mdx` 總覽同步；N5 的已知缺口與「前端未納入」的原因寫在規則文件（T6，前端維持「待建置」）。T9 表不加列。

無 API、資料模型、畫面或權限的變動（見 `api-contract.md`、`ui-design.md`；`app/` 不動），沒有破壞性變更，測試集答案隔離不適用。唯一的行為變化是日後 `tests/integration/`（及上述掃描範圍）出現被禁的寫法會讓 CI 失敗。

### 決議摘要

細節、理由與維護者可推翻的方式見 `clarification.md`（2026-11-25，依維護者「需要決策的都依照你的建議就好」授權）；推翻時依 Q 編號回修。

| #   | 主題                       | 決議                                                      |
| :-- | :------------------------- | :-------------------------------------------------------- |
| Q1  | 擋哪些寫法                 | B＋D；環境變數與工作目錄不擋                              |
| Q2  | 網路邊界與掃描範圍         | C；納入 `conftest.py`、`probe.py`、日後 `factories/`      |
| Q3  | `export_openapi` 4 處命中  | C：視為檔案系統邊界，`pattern-not` 放行兩個輸出路徑常數   |
| Q4  | 檢查機制                   | A：Semgrep 規則；N1 採 S2（CI 另開一步，現有掃描不動）    |
| Q5  | 前端是否納入               | A：不納入，缺口寫在規則文件，不另開 issue                 |
| Q6  | 共用同一個組裝函式         | B＋C：靜態規則加 `test_harness_parity.py`                 |
| Q7  | 例外寫法                   | B＋N3：行內帶規則 id 與理由，另有 pytest 強制             |
| Q8  | 違規樣本證據               | B：`.semgrep/tests/` 常駐樣本，範圍於驗收一次性證明（N2） |
| Q9  | 規則文件與 capability      | 新增 `test-boundary-checks`；T4、T6、狀態段、總覽同步     |
| Q10 | 追溯來源                   | 接受 T4、T6 加本次決議，不先寫 ADR                        |
| N4  | 名為 `app` 的 fixture 誤報 | 接受，真的遇到時用 Q7 的例外寫法                          |
| N5  | Semgrep 看不到的三種繞法   | 接受並寫進規則文件                                        |
| N6  | 比對測試不跑 lifespan      | 接受                                                      |

N7（新測試檔各自不得超過 #561 的 400 行上限）照常遵守。

## Capabilities

### New Capabilities

- `test-boundary-checks`：integration 測試及 harness 組裝檔案不得替換本專案自己的模組（被擋的寫法與允許的邊界、`export_openapi` 輸出路徑常數的放行）、測試檔確實被掃到、不另建 app、harness 與 production 組裝一致、例外必須帶規則 id 與理由、以常駐樣本證明規則有效。

### Modified Capabilities

預設沒有。`ci-quality-gates`（新的 CI 步驟）與 `workspace-commands`（`scripts/check.mjs` 新的一步）只有在寫 specs 時確認既有 requirement 的描述必須改動，才補 MODIFIED delta；若新增的 CI 步驟與檢查步驟可完全由 `test-boundary-checks` 的 requirement 涵蓋，就只有新增一個 capability。`security-scanning` 不動（N1 採 S2，既有掃描範圍不變）。

`backend-code-boundaries`、`code-size-limits`（#561 已歸檔，僅 N7 要求新測試檔遵守其上限）不受影響。

## Impact

- **Semgrep**：新增 `.semgrep/test-boundaries.yml` 與 `.semgrep/tests/` 的違規、合規與「不標記」樣本；`.semgrep/label-suite.yml` 與根目錄 `.semgrepignore`（不新增）不動。
- **CI**：`.github/workflows/ci.yml` 的 `semgrep` job 新增一步（`--x-ignore-semgrepignore-files` 加 `.semgrep/test-boundaries.yml`）；`semgrep --test .semgrep/` 既有步驟會涵蓋新樣本。
- **工具**：`scripts/check.mjs` 新增對應的一步，`scripts/tests/check.test.mjs` 更新步驟數。
- **後端測試**：新增 `backend/tests/integration/test_harness_parity.py`（Q6）與檢查 `nosemgrep` 理由的 pytest（Q7、N3，確切位置由 design 決定）；每個新檔 ≤ 400 行（N7）。`backend/tests/integration/test_export_openapi.py` 與 `backend/app/` 不動。
- **文件**：`docs/development/rules/testing-agent-rules.mdx`（T4、T6、文首狀態段、N5 缺口、前端未納入的原因）、`agent-rules.mdx` 總覽；T9 表不加列。
- **specs**：新增 `openspec/specs/test-boundary-checks/`；其他 delta 視上節。
- **與兄弟 issue 的衝突風險**：#563 也可能動 `backend/pyproject.toml`、`scripts/check.mjs`、`ci.yml` 與規則文件狀態段；#561 已合併。互不依賴，後合併者 merge `origin/main`；新規則集中成獨立檔案以縮小衝突範圍。
- **不動**：`backend/app/`、`backend/openapi.json`、`frontend/src/api/generated/`、`docs/diagrams/architecture/*`、`.semgrep/label-suite.yml`。

## 不在範圍

- #563（後端單一入口清單與 import-linter 契約）、#564（定期架構盤點）、#561（已合併）。
- #111 的七個 gate（含 T9 第 6 項授權與答案隔離回歸測試）、#506 的 CI 骨架。
- S1 會新增的 4 個既有 `label-suite-hardcoded-secret` 命中（`backend/tests/integration/test_app_assembly.py:126`、`backend/tests/probe.py:23`、`backend/tests/unit/test_envelope.py:175`、`frontend/build/extract-tokens.ts:23`）：N1 採 S2，不會暴露；那些命中在本 change 呼叫路徑之外，只回報，不順手修。
- 前端（Q5）：不納入；前端 integration 與 unit 測試同目錄、同副檔名，沒有可區分的位置，缺口寫在規則文件 T6，不另開 issue；4 處 `vi.spyOn(globalThis, "fetch")` 不列為違規。
- `e2e/` 套件、環境變數與工作目錄的 `setenv`／`delenv`／`chdir`（行程邊界，不擋）。
- `docs/specs/`、`docs/specs/00-prd.mdx`、`design/prototype/`；任何 UI 與 API 變動。

## 引用來源

- GitHub issue #562（六個工作項）、Epic #560（§維護者裁定 2026-11-23：規則細節由維護者問答決定，agent 不自訂）。
- 本 change 的 `clarification.md`（Q1 至 Q10、N1、N4 至 N6 決議，2026-11-25）。
- `docs/development/rules/testing-agent-rules.mdx`：T4（integration 的真實邊界）、T6（外部替身設在邊界上）、文首狀態段、T9 gate 表、§來源表。
- `docs/development/adr/007-testing-strategy.mdx` D1；`003-backend-architecture.mdx`、`006-task-config-and-answer-isolation.mdx` 的相關行（無「替身邊界」決議）。
- `agent-rules.mdx` 的附錄來源表與總覽。
- `openspec/specs/ci-quality-gates`、`security-scanning`、`backend-code-boundaries`、`workspace-commands`、`code-size-limits`。
- `AGENTS.md`：Hard Rules、Language Rules、「衝突不由 agent 裁決」「範圍鎖定」、Required Behaviors 的「呼叫路徑之外只回報」。
- 本 change 的 `system-analysis.md`、`system-design.md`（先決發現 N1、技術待決 N1 至 N7）、`ui-design.md`（無 UI 變更）、`api-contract.md`（無 API 變更）。
