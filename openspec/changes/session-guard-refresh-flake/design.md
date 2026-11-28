# Design

本份依 `clarification.md`（Q1–Q6、「交給後續產出」）撰寫。測試端的現況缺陷、選項 A–E 的比較、兩張情境序列圖已寫在 `system-design.md` §測試端設計與 §關鍵情境，這裡不重抄，只記錄實作決策與取捨。本 change 沒有 API、資料模型、常駐文件、權限的異動（`api-contract.md`、`system-design.md` §常駐文件異動、§資料模型異動），所以沒有 migration，也沒有資料回滾。

## Context

`e2e/account/session-guard.spec.ts` 的兩個測試（「慢的那個分頁自動重試一次」「重試不通時再延續一次就成功」）以查詢被叫的次數（`queries === 1`、`queries <= 2`）決定回 401 或放行。開發模式雙重掛載送出的第一份查詢被取消，若先進攔截器就占掉 401 名額（`system-design.md` §現況缺陷；證據見 `system-analysis.md` §根因分析與證據）。

## Goals / Non-Goals

**Goals**

- 兩個測試各 `--repeat-each=30` 全過，斷言數值不動。
- 讓同類錯誤有規則可對照（`specs/e2e-testing/spec.md`）。

**Non-Goals**

- 不改 `frontend/`（Q1）、不改 E2E 的開發模式（Q3）、不在本 PR 驗 Windows（Q2）、不改第三支測試「重試仍失敗就帶回登入頁」（它每次都回 401，不受影響）。

## Decisions

### D1. 採選項 A：以延續呼叫次數為階段

選項比較見 `system-design.md` §選項比較；選 A（Q1）。實作規則：

1. 兩個測試各有一個 `refreshCalls` 計數器（測試 2 原有；測試 1 新增）。
2. 延續攔截器第一行就 `refreshCalls += 1`，之後才 `fulfill` 或 `continue`。遞增在回應之前，且中間沒有 `await`，所以頁面收到延續回應後發出的重送，看到的階段一定已經是新值；這是設計 A 唯一的時序前提（`system-design.md` §設計 A 的細節 3、§技術待決問題 4）。
3. 查詢攔截器：`refreshCalls < N` 回 `401 AUTH_REQUIRED`，否則 `route.continue()`。測試 1 的 N 為 1，測試 2 的 N 為 2。
4. 不用被叫次數、不判斷請求是否已取消（選項 B、C 依賴未驗證的 Playwright 行為，見 `system-design.md`）。

為何穩定：被取消的那一份（A）即使先進攔截器，階段仍是 0，回 401 給已取消的請求無效果，也不改變階段；畫面實際使用的那一份（B）在第一次延續之前，階段也是 0，必定得 401。

### D2. 不抽共用 helper，規則寫在兩個測試內

`system-design.md` §設計 A 的細節 4 把是否抽到 `e2e/shared/api-stubs.ts` 留給 design 決定（交給後續產出）。決定：**不抽**。理由：

- 規則只有一行判斷（`refreshCalls < N`），兩個測試的延續攔截器本來就不同（測試 1 恆回 409，測試 2 第 1 次 409、第 2 次放行），抽出去的只有查詢那半，要帶 `getRefreshCalls` 回呼才能拿到階段，抽象比兩行重複更難讀。
- `api-stubs.ts` 目前只放回應形狀與跨多個 spec 共用的路由工具；只有一個檔、兩處使用的規則，不符「rule of three」，也避免為此擴大 `shared/` 的面積（`AGENTS.md` 的「smallest change」與「no excessive abstraction」）。
- 之後若有第三處需要「第一階段回錯、之後放行」，再抽；`specs/e2e-testing` 的 Requirement 是規則，不要求共用函式。

代價：兩處各有一份相似的條件式，靠檔首註解（D4）提醒。

### D3. 斷言與等待不動（T8）

測試 1 `refreshes() = 1`、`originals() = 2`；測試 2 `refreshes() = 2`、`originals() = 3`；`countFinished` 以 `requestfinished` 計，不改（被取消的 A 只觸發 `requestfailed`，本來就不被計入）。不加 `waitForTimeout`、不放寬 `toBe`、不加 `retries` 或 `test.fixme`（`system-design.md` §設計 A 的細節 5、6；testing-agent-rules T8）。第三支測試完全不碰。

### D4. 檔首註解

檔首「Counts are of finished requests」那段維持，補一句英文：stubs choose a response by refresh phase, never by request order（程式內註解用英文，`AGENTS.md` Language Rules）。

### D5. 驗證方式

TDD：先在未修改的檔案上對兩個測試各跑 `--repeat-each=30`，留下失敗紀錄（修前 macOS 失敗率約 10–35%，不保證每次都失敗，記錄實際失敗次數；若 30 次恰好全過，改用 `--repeat-each=60` 或 `--workers=4` 加壓再試，仍重現不了就停下回報，不要硬進修復，T5「間歇性問題要能重現才算結案」）。修後兩個測試各 30 次全過、完整 E2E 全過，再跑 `pnpm --filter e2e test:static` 與 e2e 的 tsc。CI Linux 由既有 `e2e` job 跑。

## Risks / Trade-offs

- **修後仍偶發失敗**：機制在 macOS 以 50 次執行的 trace 證實；若修後仍有失敗，代表有第二個根因，停下回報，不以放寬斷言收尾。
- **Windows 未驗**：#812 的根因是依機制推論；Q2 決議合併後由維護者驗，本 change 不含 Windows 步驟。
- **StrictMode 行為改變**：若日後 React 或 TanStack Query 改變雙重掛載的取消方式，D1 的規則仍成立，因為它不依賴任何一份查詢是否進攔截器。

## Migration Plan

無 migration。回滾：還原 `e2e/account/session-guard.spec.ts` 的單一 commit 即可，不影響產品、資料庫或其他 spec。

## Open Questions

無。clarification Q1–Q6 已全數決議；Q4（規格 01-05 §業務流程）本次不處理。
