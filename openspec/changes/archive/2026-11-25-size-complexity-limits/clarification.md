# Clarification：size-complexity-limits

關卡模式，檢查 system-analysis、system-design、ui-design、api-contract、proposal 五份產出；specs、design、tasks 尚未產生，相關檢查項標「後續產物」。來源 issue #561（Epic #560）。

## 檢查結論

| #   | 面向             | 結論   | 說明                                                                                                                                                                                                       |
| :-- | :--------------- | :----- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 規格完整性       | 待釐清 | issue 七個工作項都有落點；門檻、例外與既有超標的處理都要維護者決定（Epic #560 §維護者裁定），列為 Q1–Q12。`docs/specs/` 沒有對應規格，依 #503 追溯到 issue、ADR 與規則文件條號                             |
| 2   | API Contract     | 通過   | 沒有端點、欄位或錯誤碼變動，`openapi.json` 與 Orval 產物不變                                                                                                                                               |
| 3   | 邏輯一致性       | 問題   | system-design 提出的後端檔案行數 B'（pytest）不在 system-analysis Q5 的選項裡（P1）；proposal 的 Capabilities 全是「候選」，要依 Q9 改成定案（P2）；system-analysis 的需求矛盾 C1 要依 Q1 改寫成決議（P3） |
| 4   | 可行性           | 通過   | `sd` 以暫時設定實測：前端建議值下只有 `dev-gallery-page.tsx:85` 違規；後端建議值下零違規；ESLint 的探針要寫實體檔（型別感知規則）；ruff 規則碼與 `per-file-ignores` 的行為已驗證                           |
| 5   | 邊界情況         | 待釐清 | 設定檔（`eslint.config.js` 281 行）會不會擋自己（T4）、例外過期偵測（T2、T3）、測試檔的長度與複雜度（Q7）                                                                                                  |
| 6   | 跨功能影響       | 待釐清 | 與 #562 共用 `frontend/eslint.config.js`、與 #563 共用 `backend/pyproject.toml`；Q5、Q10 決定是否動 `scripts/check.mjs`、`ci.yml`、`scripts/tests/check.test.mjs`（T1）；不動資料表                        |
| 7   | 可測試性         | 待釐清 | 「刻意違規會失敗」是一次性證據還是常駐測試（Q10）                                                                                                                                                          |
| 8   | 規格範圍         | 待釐清 | 既有超標是否在本 change 修（Q8）；不改 `docs/specs/`、`00-prd.mdx`、`design/prototype/`                                                                                                                    |
| 9   | 任務設定驅動     | 通過   | 只動 lint 設定、探針測試與規則文件，沒有任務類型的分支                                                                                                                                                     |
| 10  | 測試集答案不外露 | 通過   | 不新增標記員能到達的程式、不改任何回應；探針樣本是合成程式碼，不含答案資料                                                                                                                                 |

## 待釐清項目（Q）

以下全部依維護者 2026-11-25「接下來有需要決策的都依照你的建議就好」的授權，採用主 session 的建議決定（日期 2026-11-25）；選項與量測數字取自 system-analysis §待決問題、§現況量測與 system-design。維護者看到後可推翻任一題，推翻時依 Q 編號回修。

| #   | 題目                           | 決議                                                                                                                                                                                                                                                                                                                             | 理由                                                                                                                                                                                                                  |
| :-- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | 與「不採用機械行數門檻」的關係 | **並存**：上限是擋極端值的 CI 護欄，不是拆分判準；R4、F5「不以行數取代職責審查」的原意保留。規則文件把那幾處「不採用」改寫成「不採用作為拆分判準；另設 CI 上限擋極端值」，並在新條文寫明兩者的關係                                                                                                                               | Epic #560 要求加上限，規則文件駁回的是「以行數當拆分規範」；兩者對象不同，並存只需改寫字面，不必推翻 R4 的理由。上限設得寬（建議值下現有程式幾乎零違規），符合「只擋極端值」                                          |
| Q2  | 前端檔案行數                   | **300**（`max-lines`，排除空白與註解）                                                                                                                                                                                                                                                                                           | ESLint 預設；非測試 0 違規，可直接生效                                                                                                                                                                                |
| Q3  | 前端函式行數                   | **80**（`max-lines-per-function`，排除空白與註解，`IIFEs: false`）                                                                                                                                                                                                                                                               | 只有 `dev-gallery-page.tsx:85`（174 行）違規，交 Q8 處理；50 會連帶 `mutator.ts`，200 等於不設                                                                                                                        |
| Q4  | 前端複雜度                     | **15**                                                                                                                                                                                                                                                                                                                           | 0 違規；10 或 12 會牽動 `mutator.ts`（HTTP 單一出口）與 `button.tsx`（shadcn 變體表），屬極端值以外的正常程式                                                                                                         |
| Q5  | 後端檔案行數的機制             | **B'：`backend/tests/unit/` 的 pytest 測試**，上限 **400**（排除空白行與只有 `#` 的行，docstring 計入）；`alembic/versions/` 排除；例外表條目同時是棘輪上限，條目過期（檔案已低於預設上限）時測試失敗                                                                                                                            | 做到 issue「前後端各一組」又不新增 CI 或 `check.mjs` 步驟，少碰 #562、#563 也可能改的共用檔；400 下 0 違規（最大 `middleware.py` 319、tests 399）。B 的失敗訊息較像 lint，但要改 `ci.yml`、`check.mjs` 與其步驟數斷言 |
| Q6  | 後端 ruff 規則與數值           | **B**：只開 `C901`（`max-complexity` 10）、`PLR0915`（`max-statements` 30）、`PLR0912`（`max-branches` 10），用明確規則碼，不開 `PLR0913`、`PLR0911`、`PLR0917`                                                                                                                                                                  | 0 違規；比預設的 `PLR0915` 50 貼近現況最大 21，仍留餘裕；issue 只點名這三條                                                                                                                                           |
| Q7  | 例外範圍                       | **B**：前端測試檔（既有 `TEST_FILES`）只豁免 `max-lines` 與 `max-lines-per-function`，複雜度照樣檢查；前端規則只套用 `SOURCE_FILES`，設定檔（`eslint.config.js`、`vite.config.ts`、`vitest.config.ts`）不在範圍；生成檔沿用既有全域 ignore；後端 `alembic/versions/` 豁免三條規則，`tests/` 不豁免                               | 測試的 `describe` 回呼天然很長，複雜度卻沒理由放寬（實測最大 10）；設定檔排除可避免 `eslint.config.js` 加規則後擋到自己（T4）；後端 tests 在建議值下零違規                                                            |
| Q8  | 既有超標程式                   | **具名豁免、本 change 不修**：`dev-gallery-page.tsx` 用 system-design 的 (iii) 棘輪寫法，在 `eslint.config.js` 的 `NAMED_EXEMPTIONS` 常數放寬到剛好高於現況（180），註明 `#561` 與理由；探針測試斷言清單內每個檔案仍然超標，過期就失敗。**不另開 issue**                                                                         | 不動產品碼、PR 只有一個目的；棘輪保證不再變長，過期偵測保證修好後豁免一定會被拿掉。依維護者「短期非必要不開新 issue」的方針，重構等真的要動這個開發用展示頁時再處理                                                   |
| Q9  | capability 歸屬                | **新增 `code-size-limits`**，前後端與證據測試寫在同一份；`ci-quality-gates` 不另寫 delta（新規則掛在既有 lint 步驟上，該 capability 的失敗條件已涵蓋「lint 有錯就失敗」）                                                                                                                                                        | 規則同時橫跨前後端；`ci-quality-gates` 已有 17 條。若 planner 寫 specs 時發現 `ci-quality-gates` 的現有文字確實需要改，以 MODIFIED 補上並在 design 寫明                                                               |
| Q10 | 違規樣本的證據形式             | **B：常駐探針測試**。前端 `frontend/build/size-limits-config.test.ts`（實體探針檔 `size-probe.tsx`、`size-probe.test.tsx`）；後端 `backend/tests/unit/test_size_limits.py`（比照 `test_layer_boundaries.py`，依規則碼過濾 ruff JSON）。`scripts/check.mjs` 的殘留探針檢查擴充成認得新探針名，同步 `scripts/tests/check.test.mjs` | 規則日後被改寬、降級或例外範圍被放大時每次 CI 都抓得到；探針與殘留檢查機制已存在。代價是 T1 的 `check.mjs` 小改（只改探針名清單，不加步驟）                                                                           |
| Q11 | 違規等級                       | **一律 `error`，不設報告期**                                                                                                                                                                                                                                                                                                     | `--max-warnings 0` 下 warn 也會擋；建議值下除 Q8 的具名豁免外零違規，不需要過渡期                                                                                                                                     |
| Q12 | 規則文件寫回                   | **新增 F12（前端）與 B11（後端）各一條**，F5 原意不改；同步 `frontend-agent-rules.mdx`、`backend-agent-rules.mdx` 的文首狀態段與條數、`agent-rules.mdx` 的總覽段與 Q1 要改寫的附錄／來源對照、`testing-agent-rules.mdx` T9；新條文各寫一句「行」的定義（T5）                                                                     | F5 沒有「待建置」可翻，掛在既有條文下會改變它的意思；新增條文讓檢查方式能如實寫成已建置的指令                                                                                                                         |
| T2  | 是否開 `RUF100`                | **不開**                                                                                                                                                                                                                                                                                                                         | 會讓本 change 呼叫路徑外的 `app/core/log_config.py:128` 失敗；後端建議值下零違規，不需要行內 `noqa`                                                                                                                   |

## 明確問題（P）

### P1. Q5 的選項 B' 只在 system-design 出現

- **位置**：system-analysis §待決問題 Q5（只有 A、B、C）；system-design §後端檔案行數檢查器
- **修正**：派 `sa` 把 Q5 改成決議 B' 並補上選項說明；全部 12 題的「狀態」改成決議並標回 clarification；§需求矛盾 C1 依 Q1 寫成已決

### P2. proposal 的 Capabilities 與待決表

- **位置**：proposal §What Changes 的「待決問題（皆為 open）」、§Capabilities
- **修正**：派 `planner` 依上表改寫：待決表改成決議摘要；Capabilities 定為新增 `code-size-limits`、不改 `ci-quality-gates`（除非寫 specs 時發現必要）；Impact 依 Q5 B'、Q10 B 寫明會動 `scripts/check.mjs` 的探針名清單與 `scripts/tests/check.test.mjs`，不動 `ci.yml`

### P3. system-design 的選項比較改成定案

- **位置**：system-design 各節的「建議值」「技術建議」、§技術待決問題 T1–T5
- **修正**：派 `sd` 依上表標明採用的選項（Q5 B'、Q7 B、Q8 (iii)、Q10 B、T2 不開），其餘選項保留為「考慮過的選項」；T1 改寫成「只改探針名清單，不加步驟」

## 交給後續產出

- **specs**：新增 capability `code-size-limits`。Requirement 涵蓋：前端三條上限與數值（Q2–Q4）、前端例外範圍（Q7）、具名豁免的棘輪與過期偵測（Q8）、後端三條 ruff 規則與數值（Q6）、後端檔案行數 400 與例外表（Q5）、違規等級（Q11）、常駐探針證明規則有效（Q10）。每條 Requirement 的來源寫 issue #561、Epic #560 與規則文件新條文 F12／B11（Q12），以及本文件的 Q 編號。Scenario 至少要有：超標檔案、函式、複雜度各自失敗；測試檔長度豁免但複雜度不豁免；具名豁免檔案再變長仍失敗；豁免過期時探針失敗；`alembic/versions/` 不受限；規則被改寬時探針失敗
- **design**：上表的決議；說明 Q1 的並存關係；前端規則集中在一個設定物件、例外集中在 `NAMED_EXEMPTIONS`；後端 `select` 只在尾端追加；與 #562、#563 的衝突以「後合併者 merge `origin/main`」處理
- **tasks**：前端設定與探針測試（`frontend-developer`）；後端 ruff 設定、檔案行數測試與探針測試（`backend-developer`）；`scripts/check.mjs` 探針名清單與 `scripts/tests/check.test.mjs`（實作角色之一，與探針測試同組）；規則文件 F12、B11、狀態段、Q1 的改寫、T9、`backend-modules.mdx` 檢查清單（`technical-writer`）。每組都要先對刻意違規的樣本跑出失敗再提交
- **範圍外**：重構 `dev-gallery-page.tsx`；`RUF100`；#562、#563 的內容；新增 CI job 或步驟；`e2e/`
