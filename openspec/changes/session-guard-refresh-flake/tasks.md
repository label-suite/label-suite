# Tasks

本份依 `clarification.md`（Q1–Q6、「交給後續產出」）、`design.md`（D1–D5）與 `specs/` 撰寫。本次**沒有後端群組、沒有 `[@dba]`**：不改 API、資料表、前端產品程式（`api-contract.md`、`system-design.md`）；所以也沒有「重新產生 openapi.json」的 task。

角色標記：`e2e/` 沒有專屬角色，`tasks` 規則只允許四個實作角色，這裡標 `[@frontend-developer]`（與既有改 `e2e/` 的 task 一致）；`.claude/agents/frontend-developer.md` 寫「全端 E2E 不在本角色的 TDD 範圍」，這裡指的是本 task 自己依 design D5 先重現再修，不是該角色的前端 TDD。派工時若維護者認為該換角色，在這裡改標。

本次只改 E2E，`frontend-developer` 的前端 TDD 檢查表（MSW、四種畫面狀態等）不適用；先重現再修的順序依 design D5。

驗證指令都在根目錄執行；Playwright 的 `-g` 與 `--repeat-each` 透過 `pnpm --filter e2e exec playwright test` 傳入。

## 1. 修正 session-guard 的兩個攔截器

- [x] 1.1 先重現：在未修改的 `e2e/account/session-guard.spec.ts` 上，對「慢的那個分頁自動重試一次」「重試不通時再延續一次就成功」各跑 `pnpm --filter e2e exec playwright test account/session-guard.spec.ts -g "<測試名>" --repeat-each=30`，把失敗次數與失敗訊息（`refreshes()` 少算一次）記在 PR 描述；30 次全過時依 design D5 加壓（`--repeat-each=60`、`--workers=4`），仍重現不了就停下回報，不進入修復（design D5；T5）。[@frontend-developer]
- [x] 1.2 修兩個測試：各加或沿用 `refreshCalls`，在延續攔截器第一行、`fulfill`／`continue` 之前遞增；查詢攔截器改為 `refreshCalls < N` 回 `401 AUTH_REQUIRED`，否則 `route.continue()`（測試 1 的 N 為 1、測試 2 的 N 為 2）。斷言數值（測試 1：refresh 1、original 2；測試 2：refresh 2、original 3）與 `countFinished` 不改，不加固定等待、`retries`、`test.fixme`；第三支「重試仍失敗就帶回登入頁」不改；不抽 helper、不動 `e2e/shared/api-stubs.ts`。檔首註解補一句 stubs choose a response by refresh phase, never by request order。驗證：兩個測試各 `--repeat-each=30` 全過（`specs/e2e-testing` Requirement「路由攔截器依情境階段回應，不依請求順序」兩個 Scenario；design D1–D4；clarification「交給後續產出」）。[@frontend-developer]

## 2. 整體驗證

- [x] 2.1 跑完整 E2E 與靜態檢查：`pnpm --filter e2e test` 全過、`pnpm --filter e2e test:static` 通過（CI 的 `e2e` job 只跑這兩個）。另在本機加跑 `pnpm --filter e2e exec tsc --noEmit` 確認型別，這一步不屬於 CI job。推上 PR 後確認 CI 的 `e2e` job 通過。不含 Windows 步驟：PR 只寫 `Closes #804`，#812 由維護者在合併後於 Windows 驗（clarification Q2；design D5）。[@frontend-developer]
