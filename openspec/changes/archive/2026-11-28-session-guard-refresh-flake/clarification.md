# Clarification

## 檢查範圍

關卡模式：檢查 `system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md`、`proposal.md` 五份。specs、design、tasks 還沒產生，相關的檢查項標「後續產物」。

## 檢查結論

| 面向             | 結論                                                                                                                                                                                                                                                                    | 問題數 |
| :--------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 規格完整性       | 待釐清 → 已決議（Q4、Q5）；受影響的 Scenario 只有兩條，01-05 §多個分頁同時延續登入狀態 第 2、3 條，條文與驗收標準都在，產品行為不變                                                                                                                                     | 2      |
| API Contract     | 通過：本次無 API 變更；測試碰到的端點 `GET /api/v1/current-session`、`POST /api/v1/session-refreshes` 與假回應錯誤碼（`AUTH_REQUIRED` 401、`ACCOUNT_REFRESH_CONFLICT` 409、`ACCOUNT_SESSION_INVALID` 401）都列出了；operationId 寫「以匯出的 openapi.json 為準」，見 P2 | 1      |
| 邏輯一致性       | 通過：五份對根因的說法一致（StrictMode 取消的第一份查詢占掉依序號回的 401）；ui-design「本次無 UI 變更」的前提是只改測試，已由 Q1 確認                                                                                                                                  | 0      |
| 可行性           | 通過：設計 A（假回應依延續階段 `refreshCalls` 決定）不依賴未查證的 Playwright 行為；唯一的時序條件是 `refreshCalls` 在延續攔截器回應前遞增，交給 design 寫明                                                                                                            | 0      |
| 邊界情況         | 通過：被取消的那份不論有沒有進攔截器都拿到 401、不影響結果；第三支「重試仍失敗就帶回登入頁」每次都回 401，不受影響、不改                                                                                                                                                | 0      |
| 跨功能影響       | 通過：只改 `e2e/account/session-guard.spec.ts`（可選 `e2e/shared/api-stubs.ts`）；前端、後端、`openapi.json`、`design/`、`docs/specs/` 不動                                                                                                                             | 0      |
| 可測試性         | 通過：驗收以兩支測試各 `--repeat-each=30` 全過為準（修正前 macOS 失敗率 10–35%）；Windows 由維護者在合併後驗（Q2）                                                                                                                                                      | 0      |
| 規格範圍         | 待釐清 → 已決議（Q6）：帶 `e2e-testing` delta 新增一條 Requirement；`login-session` 只改來源註記（Q5）                                                                                                                                                                  | 1      |
| 任務設定驅動     | 通過：只涉及登入狀態的延續，與任務類型無關                                                                                                                                                                                                                              | 0      |
| 測試集答案不外露 | 通過：不碰任何任務、答案或標記員可到達的資料                                                                                                                                                                                                                            | 0      |

## 決議（Q）

### Q1. 只改測試，還是也改前端

- **來源**：`system-analysis.md` 待決問題 1；`system-design.md` 選項比較；`proposal.md` 待決問題 1
- **問題**：trace 證實產品對實際收到的回應每次都處理正確，失敗出在兩支測試依請求序號回假回應；#804 的待辦寫「若是產品競態，回報為產品 bug」。修法範圍要不要涵蓋 `frontend/`
- **決議**：只改測試（`e2e/`），採 system-design 的設計 A；前端不動
- **理由**：根因不在產品；讓前端在 StrictMode 下不送第一份查詢是另一個產品改動，而且和 `frontend-api-client`「被取消的請求不算數」的規定衝突
- **已回修**：`proposal.md` §What Changes、§Out of scope（交 planner）；`ui-design.md` 的前提已成立，不需回修
- **日期**：2026-11-28

### Q2. #812 的 Windows 驗證

- **來源**：`system-analysis.md` 待決問題 2；`proposal.md` 待決問題 2
- **問題**：agent 沒有 Windows、CI 只跑 Linux，#812 在 Windows「固定失敗」的根因是依機制推論、未實證；本 PR 能否寫 `Closes #812`
- **決議**：PR 只寫 `Closes #804`，#812 保持開啟；合併後由維護者在 Windows 對 `main` 跑 `npx playwright test account/session-guard.spec.ts -g "慢的那個分頁自動重試一次" --repeat-each=10`，全過就關 #812，不過代表 Windows 另有原因，繼續在 #812 查
- **理由**：不讓合併等人；推論若不成立，#812 本來就要獨立處理
- **已回修**：`proposal.md` §Impact（交 planner）；PR 本文與 #812 檢查點由主 session 處理
- **日期**：2026-11-28

### Q3. E2E 是否維持開發模式

- **來源**：`system-analysis.md` 待決問題 3；`system-design.md` 選項 E
- **問題**：E2E 目前跑開發模式（帶 StrictMode 雙重掛載），要不要改跑正式 build
- **決議**：維持開發模式，不在本 change 處理
- **理由**：本次修法就是讓測試不受雙重掛載影響；改跑正式 build 是環境決策
- **已回修**：`proposal.md` §Out of scope（交 planner）
- **日期**：2026-11-28

### Q4. 規格 01-05 §業務流程缺多分頁延續的流程

- **來源**：`system-analysis.md` 待決問題 4
- **問題**：01-05 的多分頁延續只寫在 §規格 的條文，§業務流程沒有對應的一段
- **決議**：本次不處理，不另開 issue；之後修改 01-05 時一併由 `spec-writing` 補
- **理由**：條文與驗收標準都在，缺的只是流程圖，不影響這次修測試；短期先清既有 backlog
- **已回修**：無（本 change 不改 `docs/specs/`）
- **日期**：2026-11-28

### Q5. `login-session` Scenario 的來源註記

- **來源**：`system-analysis.md` 待決問題 5；`proposal.md` 待決問題 5
- **問題**：主規格 `login-session` 的 Scenario「重試不通時再延續一次就成功」在 01-05 §驗收標準 沒有同名的一列，所屬 Requirement 的來源清單也漏了它
- **決議**：在 `login-session` 的 delta 修正來源註記，指到 01-05 §規格「多個分頁同時延續登入狀態」第 3 條；不改 `docs/specs/`
- **理由**：Scenario 驗的是既有條文，缺的是追溯，不是需求
- **已回修**：`specs/login-session/spec.md`（後續產物，交 planner）
- **日期**：2026-11-28

### Q6. 帶 `e2e-testing` delta，還是 `skip_specs`

- **來源**：`proposal.md` 待決問題 6
- **問題**：`e2e-testing` 現有的「等待只用條件式」只約束等待，沒有約束假回應怎麼挑
- **決議**：帶 `e2e-testing` delta，新增一條 Requirement：攔截器放行或回應的決定不依請求的先後順序，改依情境的狀態（例如已延續幾次）；附一條 Scenario
- **理由**：同類錯誤之後寫 E2E 的人有規則可對照，code review 也有依據
- **已回修**：`specs/e2e-testing/spec.md`（後續產物，交 planner）
- **日期**：2026-11-28

## 已修正（P）

| 編號 | 位置                                                               | 問題                                                 | 修正                                                                                                          |
| :--- | :----------------------------------------------------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| P1   | `proposal.md` §Capabilities                                        | `e2e-testing`、`login-session` 只寫成「候選」        | 依 Q5、Q6 定案：`e2e-testing` 新增 Requirement、`login-session` 修改來源註記；不設 `skip_specs`（交 planner） |
| P2   | `api-contract.md` §測試碰到的端點                                  | operationId 寫「以匯出的 openapi.json 為準」，沒有查 | 從 `backend/openapi.json` 查出兩個端點的 operationId 填上（交 sd）                                            |
| P3   | `system-analysis.md`、`system-design.md`、`proposal.md` 的待決問題 | 已在本檔決議，三份仍寫成待決                         | 各自標「已決議，見 clarification Qn」（交 sa、sd、planner）                                                   |

## 移出本次的驗收標準

無。#812 的 Windows 驗證不是規格頁的驗收標準，由 Q2 的方式在 #812 處理。

## 交給後續產出

- 只改 `e2e/account/session-guard.spec.ts`；共用 helper 放 `e2e/shared/api-stubs.ts` 是否值得，由 design 決定並寫理由
- 兩支測試的斷言數值一律不改（測試 1：refresh 1、original 2；測試 2：refresh 2、original 3），不加固定等待（`testing-agent-rules.mdx` T8）
- design 寫明 `refreshCalls` 必須在延續攔截器回應前遞增
- 第三支「重試仍失敗就帶回登入頁」不改
- specs：`e2e-testing` 新增一條 Requirement 與 Scenario（來源：`testing-agent-rules.mdx` 的對應條號與本檔 Q6）；`login-session` 只修改來源註記（Q5）
- tasks 的驗證：兩支測試各 `--repeat-each=30` 全過、完整 E2E 通過、CI `e2e` job 通過；不含 Windows（Q2）
- PR 只寫 `Closes #804`；#812 合併後由維護者在 Windows 驗
