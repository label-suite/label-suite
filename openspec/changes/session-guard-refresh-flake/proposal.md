# Proposal

## Why

`e2e/account/session-guard.spec.ts`「refresh conflicts」區塊的兩個測試（「慢的那個分頁自動重試一次」「重試不通時再延續一次就成功」）在 CI Linux 偶發失敗（#804）、在 Windows 固定失敗（#812），誤擋過 #799、#807、#818 等無關的 PR。trace 已證實根因在測試端：開發模式的雙重掛載會取消第一份登入狀態查詢，而兩個測試的攔截器依「被叫的次數」決定回 401 或放行，已取消的那一份若先進攔截器就占掉 401 名額，真正被畫面使用的那一份拿到往後挪一格的回應，`refreshes()` 因此少算一次（測試 1 為 0、測試 2 為 1）。產品對它實際收到的回應反應正確，不是產品競態（證據見 `system-analysis.md` §根因分析與證據：macOS 上 50 次執行的攔截器順序與成敗一一對應，沒有例外）。

## What Changes

- 修改 `e2e/account/session-guard.spec.ts` 兩個測試的攔截器：查詢攔截器改依「延續攔截器已被呼叫的次數（階段）」回應，不再依查詢被叫的順序（`system-design.md` 設計 A）。測試 1 在階段小於 1 時回 401，測試 2 在階段小於 2 時回 401，其餘放行。
- 階段計數器在延續攔截器回應之前遞增；原有的次數斷言（測試 1 `refreshes() = 1`、`originals() = 2`；測試 2 `refreshes() = 2`、`originals() = 3`）與 `countFinished` 計數方式都不改；不放寬斷言、不加固定等待、不加 `retries` 或 `test.fixme`。
- 檔首註解補一句「攔截器依延續階段選回應，不依請求順序」，避免後人改回去。
- 是否抽共用函式見 `design.md` D2：不抽，規則直接寫在兩個測試內，不新增 `e2e/shared/api-stubs.ts` 的匯出。
- 沒有 **BREAKING** 變更。沒有產品程式、API、資料模型、畫面異動（`ui-design.md`、`api-contract.md` 均為「本次無變更」）。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `e2e-testing`：新增 Requirement「路由攔截器依情境階段回應，不依請求順序」。現有 Requirement「等待只用條件式」只約束等待，沒有約束攔截器怎麼挑回應（clarification Q6）。來源：testing-agent-rules T5 禁止欄「測試結果隨執行時間變化」；同屬 E2E 等待紀律，T8 未直接涵蓋攔截器。
- `login-session`：只修改 Requirement「多個分頁同時延續不互相踢掉」的來源註記，補上 Scenario「重試不通時再延續一次就成功」，指到規格 01-05 §規格「多個分頁同時延續登入狀態」第 3 條（clarification Q5）。行為不變、Scenario 不動；不改 `docs/specs/`。

> 兩個 capability 都帶 delta，不設 `skip_specs`（clarification P1）。

## 引用的需求來源

- `docs/specs/01-account/05-login-state.mdx` §規格 › 多個分頁同時延續登入狀態 第 1–4 條；§邊界情況；§驗收標準 Scenario「慢的那個分頁自動重試一次」「重試仍失敗就帶回登入頁」；§已確認決議 Q13
- `openspec/specs/login-session/spec.md` Requirement「多個分頁同時延續不互相踢掉」
- `openspec/specs/frontend-api-client/spec.md` Requirement「伺服器資料快取不自動重試」（被中止的請求不計）
- `openspec/specs/e2e-testing/spec.md` Requirement「等待只用條件式」
- `docs/development/rules/testing-agent-rules.mdx` T8、附錄 T5／T11；`AGENTS.md`「Scope, once locked」
- `docs/specs/00-prd.mdx` §權限矩陣「01 帳號」：本 change 不涉及權限差異
- 待決問題：`system-analysis.md` #1 至 #5、`system-design.md` §技術待決問題 1 至 3

## Impact

- 受影響程式：`e2e/account/session-guard.spec.ts`。
- 不影響：`frontend/`、`backend/`、`openapi.json`、前端 client、`design/prototype/`、`docs/specs/`、常駐文件（`docs/diagrams/architecture/`）。
- 驗收：兩個測試各跑 `--repeat-each=30`（macOS 修前約一到三成失敗），修後需全過；CI Linux 由既有 `e2e` job 跑。PR 只寫 `Closes #804`；#812 保持開啟，合併後由維護者在 Windows 對 `main` 跑 `npx playwright test account/session-guard.spec.ts -g "慢的那個分頁自動重試一次" --repeat-each=10`，全過就關 #812，不過代表 Windows 另有原因，繼續在 #812 查（clarification Q2）。
- 後續影響：任何需要「第一次回錯、之後放行」的 E2E 旅程可沿用這個寫法。

## 不在範圍

- 不改產品行為（延續、等候、重送都已照規格正確運作）。
- 不加 Windows CI。
- 不改產品的 `frontend/`，也不讓前端在 StrictMode 下不送第一份查詢（clarification Q1）。
- 不改開發模式的 StrictMode 雙重掛載，也不把 E2E 改成跑正式建置（clarification Q3）。
- 不在本 PR 驗 Windows，不寫 `Closes #812`（clarification Q2）。
- 不補規格 01-05 §業務流程的多分頁延續流程，也不另開 issue；之後修 01-05 時由 `spec-writing` 補（clarification Q4）。
- 不改 `docs/specs/` 的任何需求。

## 待決問題（已全數決議）

1. 只改測試，不動 `frontend/`：已決議，見 clarification Q1。
2. #812 的 Windows 驗收：已決議，PR 只寫 `Closes #804`，合併後由維護者驗，見 clarification Q2。
3. E2E 維持開發模式：已決議，見 clarification Q3。
4. 規格 01-05 §業務流程補流程：已決議，本次不處理，見 clarification Q4。
5. `login-session` Scenario 來源：已決議，改註來源、不改 `docs/specs/`，見 clarification Q5。
6. 是否帶 `e2e-testing` delta：已決議，帶，見 clarification Q6。
