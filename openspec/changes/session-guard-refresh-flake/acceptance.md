## 驗收：session-guard-refresh-flake

結論：通過

本 change 只改 `e2e/account/session-guard.spec.ts`（兩個測試的查詢攔截器改依延續階段回 401）與 tasks.md，沒有產品程式、API、UI、資料庫變更。驗收以 E2E 重複執行與規格審查為證據。

### Scenario 結果

| Scenario（delta）                                   | 證據                                                                                                                                                                                                                                  | 結果 |
| :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--- |
| e2e-testing：被取消的查詢先到攔截器也不改變情境結果 | 「慢的那個分頁自動重試一次」`--repeat-each=30` 全過（30/30）；「重試不通時再延續一次就成功」`--repeat-each=30` 全過（30/30）；修正前依 commit 記錄失敗 2/30、3/30。斷言計數（測試 1：延續 1、原請求 2；測試 2：延續 2、原請求 3）未改 | 通過 |
| e2e-testing：攔截器的決定只讀情境階段（靠審查）     | 審 `git diff HEAD~1 -- e2e/`：兩個查詢攔截器只判斷 `refreshCalls < N`（1、2），不再有 `queries` 計數；`refreshCalls += 1` 在延續攔截器 `fulfillError` 之前                                                                            | 通過 |
| login-session：兩個分頁同時延續不會互相踢掉         | 完整 `pnpm --filter e2e test` 128 passed，含該 spec；本 change 未動                                                                                                                                                                   | 通過 |
| login-session：同一次延續用第三次就不給             | 同上                                                                                                                                                                                                                                  | 通過 |
| login-session：慢的那個分頁自動重試一次             | repeat 30/30 + 完整套件                                                                                                                                                                                                               | 通過 |
| login-session：重試仍失敗就帶回登入頁               | 完整套件通過；該測試每次都回 401，未改                                                                                                                                                                                                | 通過 |
| login-session：重試不通時再延續一次就成功           | repeat 30/30 + 完整套件                                                                                                                                                                                                               | 通過 |

### 規格頁驗收標準覆蓋（01-05 §多個分頁同時延續登入狀態）

| 規格條文                                                | 對應 Scenario                      | 規格書驗收標準列                                           | 證據         |
| :------------------------------------------------------ | :--------------------------------- | :--------------------------------------------------------- | :----------- |
| 第 2 條：沒成功的等一下，原操作重試一次                 | 慢的那個分頁自動重試一次           | 「慢的那個分頁自動重試一次」（AC-2.3）                     | repeat 30/30 |
| 第 3 條：重試不通，最多再延續一次；還是不行就帶回登入頁 | 重試仍失敗就帶回登入頁（失敗分支） | 「重試仍失敗就帶回登入頁」                                 | 完整套件通過 |
| 第 3 條成功分支：再延續一次成功                         | 重試不通時再延續一次就成功         | 規格書沒有同名列（delta 來源註記已說明，clarification Q5） | repeat 30/30 |

Scenario 名稱與規格書驗收標準對得起來；唯一沒有同名列的是第 3 條成功分支，已在 delta 註記，不算缺陷。

### Decision Table

不適用：沒有角色、授權、資料狀態或輸入組合的變更。唯一的變數是延續階段（尚未延續 / 已延續 1 次 / 已延續 2 次）×查詢是否被 StrictMode 取消的第一份是否先到攔截器，兩個測試的 repeat 各 30 次涵蓋兩種到達順序。

### Hard Rule 必驗項

| 規則               | 怎麼驗的                                                                    | 結果   |
| :----------------- | :-------------------------------------------------------------------------- | :----- |
| 5 任務設定驅動     | 不適用：只涉及登入狀態延續，與任務類型無關                                  | 不適用 |
| 6 測試集答案不外露 | 不適用：不碰任務、答案或標記員可到達的資料；git diff 僅 e2e 測試與 tasks.md | 不適用 |

### DoD

| 項目                                                    | 指令與結果                                                                                                                    | 結果   |
| :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- | :----- |
| 兩個測試各 repeat 30                                    | `pnpm --filter e2e exec playwright test account/session-guard.spec.ts -g "<名>" --repeat-each=30`：各 31 passed（30 + setup） | 通過   |
| 完整 E2E                                                | `pnpm --filter e2e test`：128 passed                                                                                          | 通過   |
| 靜態檢查                                                | `pnpm --filter e2e test:static`：12 pass、0 fail                                                                              | 通過   |
| 型別（本機加跑，非 CI）                                 | `pnpm --filter e2e exec tsc --noEmit`：exit 0                                                                                 | 通過   |
| spec 驗證                                               | `pnpm exec openspec validate session-guard-refresh-flake --strict`：valid                                                     | 通過   |
| 規格檢查                                                | `pnpm check:specs`：docs OK                                                                                                   | 通過   |
| git status 乾淨                                         | 驗證後 `git status --short` 無輸出                                                                                            | 通過   |
| 後端 pytest、前端測試、build                            | 不適用：backend/、frontend/ 未變動                                                                                            | 不適用 |
| Alembic upgrade/downgrade/upgrade（SQLite、PostgreSQL） | 不適用：無 migration                                                                                                          | 不適用 |
| openapi.json 重新匯出無差異                             | 不適用：無 API 變更                                                                                                           | 不適用 |
| 文件站建置、test:scripts                                | 不適用：未動 docs/ 與 scripts/（只動 openspec/）                                                                              | 不適用 |
| CI `e2e` job                                            | 推上 PR #833 後由 CI 確認（合併閘）                                                                                           | 待 CI  |

### 人工驗收步驟（留作紀錄）

1. **啟動**：不需自己啟動服務。Playwright 自己啟動後端（SQLite，每次重新 migrate，不設 `DATABASE_URL`）與 Vite 開發伺服器（前端 `http://localhost:5173`、後端 `http://localhost:8000`）。在 repo 根目錄 `pnpm install` 後即可。
2. **登入身分**：測試內以 `createAccount()` 即時建立的帳號登入，不需預先準備帳號或密碼。
3. **要跑的測試**：`pnpm --filter e2e exec playwright test account/session-guard.spec.ts -g "慢的那個分頁自動重試一次" --repeat-each=30`，以及 `-g "重試不通時再延續一次就成功"` 同樣 `--repeat-each=30`；再跑 `pnpm --filter e2e test`、`pnpm --filter e2e test:static`、`pnpm --filter e2e exec tsc --noEmit`。
4. **預期**：兩個 repeat 都是 `31 passed`（30 次加 setup）；完整套件 128 passed；static 12 pass；tsc exit 0。
5. **失敗路徑**：想確認修法有效，可把查詢攔截器暫時改回依請求序號（`queries += 1; if (queries === 1)`），再跑 repeat 30，預期出現間歇失敗（`refreshes()` 少算一次），之後用 `git checkout` 還原。
6. **收尾**：不需清資料，SQLite 檔在 Playwright output 目錄，下次執行自動清掉。

### #812 Windows 交接（clarification Q2）

PR #833 只寫 `Closes #804`，#812 保持開啟。合併後由維護者在 Windows 對 `main` 執行：

`npx playwright test account/session-guard.spec.ts -g "慢的那個分頁自動重試一次" --repeat-each=10`

（在 `e2e/` 目錄下執行）全過就關 #812；不過代表 Windows 另有原因，繼續在 #812 查。agent 沒有 Windows 環境，本驗收未驗此項。

### 缺陷

無。
