# Clarification：integration-no-self-mocks

關卡模式，檢查 system-analysis、system-design、ui-design、api-contract、proposal 五份產出；specs、design、tasks 尚未產生，相關檢查項標「後續產物」。來源 issue #562（Epic #560）。

## 檢查結論

| #   | 面向             | 結論   | 說明                                                                                                                                                                                       |
| :-- | :--------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 規格完整性       | 待釐清 | issue 六個工作項都有落點；擋哪些寫法、網路邊界怎麼定、前端是否納入都要維護者決定（Epic #560 §維護者裁定），列為 Q1–Q10。`docs/specs/` 沒有對應規格，依 #503 追溯到 issue 與規則文件 T4、T6 |
| 2   | API Contract     | 通過   | 沒有端點、欄位或錯誤碼變動，`openapi.json` 與 Orval 產物不變                                                                                                                               |
| 3   | 邏輯一致性       | 問題   | system-analysis 寫 CI 的 Semgrep 已掃到 `tests/`，system-design 實測為 0 個測試檔（N1）（P1）；proposal 的待決表與 Capabilities 仍是候選（P2）；system-design 的選項比較要改成定案（P3）   |
| 4   | 可行性           | 通過   | `sd` 以 CI 同一個 `semgrep/semgrep:1.186.0` 映像實測：Q1 四個選項都表達得出來，命中數與 sa 的盤點一致；`# nosemgrep` 的行為、`app.routes` 會漏判都已驗證                                   |
| 5   | 邊界情況         | 待釐清 | 掃描範圍是否含 `conftest.py`、`probe.py`（Q2）；`export_openapi` 的 4 處既有命中（Q3）；Semgrep 看不到的三種繞法（N5）；名為 `app` 的 fixture 的誤報（N4）                                 |
| 6   | 跨功能影響       | 待釐清 | 補掃 `tests/` 的兩條路會不會連帶讓既有的 secret 規則多出 4 筆命中（N1）；與 #563 共用 `ci.yml`、`check.mjs`、規則文件狀態段                                                                |
| 7   | 可測試性         | 待釐清 | 違規樣本是常駐還是一次性（Q8）；`semgrep --test` 不看規則的 `paths`，掃描範圍只能一次性證明（N2）                                                                                          |
| 8   | 規格範圍         | 待釐清 | 前端是否納入（Q5）；不改 `docs/specs/`、`00-prd.mdx`、`design/prototype/`                                                                                                                  |
| 9   | 任務設定驅動     | 通過   | 只動測試的靜態檢查、一支比對測試與規則文件，沒有任務類型的分支                                                                                                                             |
| 10  | 測試集答案不外露 | 通過   | 不新增標記員能到達的程式、不改任何回應；樣本是合成程式碼，不含答案資料                                                                                                                     |

## 待釐清項目（Q）

以下全部依維護者 2026-11-25「接下來有需要決策的都依照你的建議就好」的授權，採用主 session 的建議決定（日期 2026-11-25）；選項、命中數與實測結果取自 system-analysis §待決問題、system-design 與其 N1–N7。維護者看到後可推翻任一題，推翻時依 Q 編號回修。

| #   | 題目                         | 決議                                                                                                                                                                                                                                                                                                       | 理由                                                                                                                                                                                                              |
| :-- | :--------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | 擋哪些寫法                   | **B＋D**：擋以 `app` 開頭的字串目標、從 `app` 匯入的物件被 `setattr`／`setitem`／`delattr`／`patch` 系列替換，以及 `MagicMock`、`AsyncMock`、`Mock`、`create_autospec` 與 `unittest.mock` 的使用；`dependency_overrides` 的任何寫入一律擋。環境變數與工作目錄（`setenv`、`delenv`、`chdir`）不擋           | 只比對字串（A）會漏掉現有 4 處用匯入物件的寫法，等於沒擋；C 會連 `sys.stderr` 也擋，超出「自己的模組」。現在 integration 沒有 mock 物件，D 先擋住以後不會長出來                                                   |
| Q2  | 網路邊界與掃描範圍           | **C**：現在凡不是本專案 `app` 的目標都視為邊界、允許；之後接上外部服務（Resend、OIDC）時，再改成明列的邊界模組清單。掃描範圍是 `backend/tests/integration/`，加上 `backend/tests/conftest.py`、`backend/tests/probe.py` 與日後的 `factories/`                                                              | 目前沒有任何外部服務可列；harness 在 `conftest.py` 組裝，只掃 `tests/integration/**` 會漏掉組裝點（需求矛盾第 1 條）。兩個檔案現在都是 0 命中                                                                     |
| Q3  | `export_openapi` 的 4 處命中 | **C：視為檔案系統邊界**。規則以 `pattern-not` 放行 `export_openapi` 的 `DEFAULT_OUTPUT` 與 `DOCS_COPY_OUTPUT` 兩個輸出路徑常數，同一個模組的其他屬性照擋；不改那 4 個測試                                                                                                                                  | 那 4 處只是把輸出檔改寫到 `tmp_path`，替換的是檔案寫到哪裡，不是 app 的行為。改成傳 `--output`（A）會讓「預設輸出位置」失去測試；逐行豁免（B）要留 4 個註解。`sd` 已實測放行範圍只到這兩個常數                    |
| Q4  | 檢查機制                     | **A：Semgrep 規則**，放在新的 `.semgrep/test-boundaries.yml`，樣本放在 `.semgrep/tests/`。掃描範圍依 **N1 的 S2**：CI 另開一步，用 `--x-ignore-semgrepignore-files` 與這份規則檔掃測試；現有的 `label-suite.yml` 掃描不動。`scripts/check.mjs` 加對應的一步                                                | CI 已有 `semgrep` job 與 `semgrep --test` 機制，樣本直接就是常駐的失敗證據；四個選項都表達得出來。S2 不改現有掃描，也不會讓既有的 secret 規則在測試檔多出 4 筆命中。旗標是實驗性的，靠 CI 釘住的 1.186.0 映像保證 |
| Q5  | 前端是否納入                 | **A：不納入**。前端 integration 與 unit 測試同目錄、同副檔名，沒有路徑能區分；T6 的檢查方式在規則文件裡維持「待建置」並寫明原因。**不另開 issue**                                                                                                                                                          | 前端現在 0 個 `vi.mock`，擋了也只會擋到 unit 測試；要先定前端 integration 的檔名慣例（改 T1）才有意義。依維護者「短期非必要不開新 issue」的方針，缺口寫在規則文件裡                                               |
| Q6  | 守住「共用同一個組裝函式」   | **B＋C**：靜態規則擋 `conftest.py`、integration、`probe.py` 裡的 `FastAPI(`、`fastapi.FastAPI(`、`Starlette(`；另加比對測試 `backend/tests/integration/test_harness_parity.py`，比 middleware 類別與順序、例外處理器、`openapi()["paths"]`，harness 只能多出 `probe_router` 的路徑。探針路由只准加、不准減 | 靜態規則擋得住另建 app，擋不住組裝內容不同；比對測試補上後者。不比 `app.routes`：這版 FastAPI 會把 router 包起來，`sd` 實測按路徑比會漏判                                                                         |
| Q7  | 例外的寫法                   | **B**：行內 `# nosemgrep: <rule-id> -- <理由，引用 T4 或 T6>`。另加一支小 pytest（**N3**）檢查測試範圍內每個 `nosemgrep` 都帶規則 id 與理由；不帶規則 id 的 `# nosemgrep` 直接失敗                                                                                                                         | 單寫 `# nosemgrep` 會關掉所有規則，連守它的規則也一起關掉，Semgrep 自己擋不住，只能另寫檢查                                                                                                                       |
| Q8  | 違規樣本的證據               | **B：常駐樣本**，放在 `.semgrep/tests/`，CI 既有的 `semgrep --test .semgrep/` 每次都跑。`semgrep --test` 不看 `paths`（**N2**），所以掃描範圍改在驗收時一次性證明：暫時在 `conftest.py`、`probe.py` 放一個違規，確認 CI 用的指令會擋                                                                       | 規則被改寬或樣式寫錯時每次都抓得到；範圍的部分 Semgrep 做不到常駐，用驗收紀錄補                                                                                                                                   |
| Q9  | 規則文件與 capability        | 新增 capability **`test-boundary-checks`**；T4、T6 的檢查方式改成實際指令，同步 `testing-agent-rules.mdx` 文首狀態段與 `agent-rules.mdx` 的總覽；T4 的適用路徑補上 `conftest.py`、`probe.py`；T9 表不加列                                                                                                  | 規則橫跨靜態掃描、比對測試與 CI；既有 capability 都放不下這一組                                                                                                                                                   |
| Q10 | 追溯來源                     | **接受 T4、T6 加上本次決議**作為來源，不先寫 ADR                                                                                                                                                                                                                                                           | ADR 沒有「替身邊界」的決議，規則本來就只在 T4、T6；這次是把既有規則接上檢查，不是新的架構決定                                                                                                                     |
| N1  | 測試檔怎麼被掃到             | **S2**（同 Q4）                                                                                                                                                                                                                                                                                            | 不動現有掃描與既有規則；S1 會把 4 筆既有 secret 命中帶進來，那是本 change 呼叫路徑外的事                                                                                                                          |
| N4  | 名為 `app` 的 fixture 誤報   | **接受**，誤報方向是安全的；真的遇到時用 Q7 的例外寫法                                                                                                                                                                                                                                                     | 現在 0 處                                                                                                                                                                                                         |
| N5  | Semgrep 看不到的三種繞法     | **接受並寫進規則文件**：區域變數轉手、在別處組字串、先讀出 `dependency_overrides` 再寫；樣本以「不標記」的行記下這三種，讓日後改成 pytest 時有依據                                                                                                                                                         | 要擋這三種得改用 AST 測試（Q4-B），成本與兩套機制並存不划算；現在 0 處                                                                                                                                            |
| N6  | 比對測試不跑 lifespan        | **接受**：比的是組裝結果，不碰資料庫                                                                                                                                                                                                                                                                       | lifespan 的行為由既有 integration 測試涵蓋                                                                                                                                                                        |

## 明確問題（P）

### P1. system-analysis 對 CI 掃描範圍的錯誤說法

- **位置**：system-analysis 中「CI 的 Semgrep 已掃到 `backend/` 含 `tests/`」一類的敘述
- **修正**：派 `sa` 依 system-design N1 更正（CI 的 `semgrep scan` 掃到 0 個測試檔）；10 題的「狀態」改成決議並標回 clarification

### P2. proposal 的待決表與 Capabilities

- **位置**：proposal §待決問題、§Capabilities、§Impact
- **修正**：派 `planner` 依上表改寫：待決表改成決議摘要；Capabilities 定為新增 `test-boundary-checks`，`ci-quality-gates`、`workspace-commands` 只在寫 specs 時確實需要才補 MODIFIED，`security-scanning` 不動（N1 採 S2）；Impact 寫明會動的檔案

### P3. system-design 的選項比較改成定案

- **位置**：system-design 各節與 N1–N7
- **修正**：派 `sd` 標明採用的選項（Q1 B＋D、Q2 C、Q3 C、Q4 A＋S2、Q6 B＋C、Q7 B＋N3、Q8 B），其餘保留為「考慮過的選項」；N1–N7 標出處理結果

## 交給後續產出

- **specs**：新增 capability `test-boundary-checks`。Requirement 涵蓋：擋下的寫法（Q1）、掃描範圍與網路邊界（Q2）、輸出路徑常數的放行（Q3）、測試檔確實被掃到（Q4、N1）、不另建 app（Q6 靜態規則）、harness 與 production 組裝一致（Q6 比對測試）、例外必須帶規則 id 與理由（Q7、N3）、常駐樣本證明規則有效（Q8）。每條的來源寫 issue #562、Epic #560、T4、T6 與本文件的 Q 編號。Scenario 至少要有：字串目標被擋、匯入物件被擋、mock 物件被擋、`dependency_overrides` 寫入被擋、`setenv`／`chdir` 不擋、`export_openapi` 兩個輸出常數放行而其他屬性仍擋、`conftest.py` 裡另建 `FastAPI(` 被擋、harness 少了 production 的 middleware 或路徑時比對測試失敗、`probe_router` 的路徑允許、不帶理由的 `nosemgrep` 失敗
- **design**：上表的決議；說明 S2 與實驗性旗標靠釘住的映像版本；N2 的掃描範圍只能一次性證明、N5 的已知缺口；與 #563 共用檔案時後合併者 merge `origin/main`
- **tasks**：Semgrep 規則與樣本、`ci.yml` 新的一步與 `scripts/check.mjs` 對應的一步（含 `scripts/tests/check.test.mjs` 步驟數）、`test_harness_parity.py`、`nosemgrep` 理由檢查的 pytest（`backend-developer`）；規則文件 T4、T6、狀態段、總覽與 N5 缺口（`technical-writer`）。每組都要先對刻意違規的樣本跑出失敗再提交；新的測試檔不超過 400 行（#561 的 B11）
- **範圍外**：前端（Q5）；S1 會暴露的 4 筆既有 secret 命中；#563、#564；環境變數與工作目錄的替換；`e2e/`
