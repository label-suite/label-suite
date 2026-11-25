# Design

change：`nginx-security-headers` · issue：#568 · 分支：`feat/nginx-security-headers`

## Context

動機見 `proposal.md` §Why。現況與實測基線見 `system-design.md` §實測基線、§實測：正式建置對 CSP 的需求、§實測：決議後的政策；部署拓撲與 `nginx.conf` 的結構見 §部署拓撲、§設定結構與不變式。本文只補 system-design 沒寫到、實作時需要先定下來的做法，其餘一律指回該段落。

會影響做法的限制：

- `frontend/nginx.conf` 兩層共用，改一次兩層同時生效（clarification Q6／Q7、system-design D6）。
- `compose` job 依路徑觸發、不列必過（archive `infra-compose-e2e-ci` clarification Q3、Q10；本 change Q4），而 `scripts-tests` job 每張 PR 都跑。所以驗證腳本本身的正確性要在 `scripts-tests` 證明，不能只靠 `compose` 跑到它。
- 驗證腳本要能在 CI（Ubuntu，bash 5）與維護者本機（macOS 內建 bash 3.2）執行（system-design §元件清單「可在本機對任一層執行」）。
- `e2e/` 的預設跑法連 Vite 開發伺服器、不經 Nginx（N3），`e2e` job 的行為不得改變（clarification Q4）。

## Goals / Non-Goals

**Goals:**

- 把 system-design D0 的標頭與值落到 `frontend/nginx.conf`，並讓 `specs/security-headers` 的每個 Scenario 都有一個會在 CI 失敗的自動檢查
- 驗證腳本的判定邏輯（缺少、值不符、重複、帶 HSTS、狀態碼不符）在不起容器的情況下就有回歸測試
- 瀏覽器檢查的失敗訊息足以指出被擋的指令與位址

**Non-Goals:**

- 不驗證 TLS 邊緣之後實際送到瀏覽器的標頭（N4，只寫進文件）
- 不在 Firefox、WebKit 上跑瀏覽器檢查（`e2e/playwright.config.ts` 只有 chromium 專案）
- 不驗證同源 iframe 實際可嵌入、`data:`／`blob:` 圖片實際可載入；這兩件由 D0 的完整值比對間接保證，實測紀錄在 system-design §實測：決議後的政策
- 不處理 clarification §交給後續產出「範圍外」所列各項（#566、全域限流、N1）

## Decisions

### D1：標頭的值與位置照 system-design D0、D1

`frontend/nginx.conf` 的改動、逐指令理由與「server 層級、一律 `always`、`location` 不得自己加標頭」的不變式都照 system-design D0、D1，本文不重寫。CSP 以單行寫在 server 層級；`X-Frame-Options` 改為 `SAMEORIGIN` 的那一行保留在原位置。CSP 的註解寫兩件事：`connect-src 'self'` 與 `VITE_API_BASE_URL` 的耦合（system-design D7）、開發伺服器不經 Nginx 所以不帶 CSP（N3）。

替代方案：用 `map` 或 `include` 把 CSP 拆到另一個檔。不採用：只有一個政策、兩層同值，拆檔只多一個要同步的檔，也讓驗證腳本以外多一處看起來像「期望值」的地方（違反 system-design D4）。

### D2：驗證腳本的介面與判定

依 system-design D2、D4，`scripts/check-security-headers.sh` 是期望值的唯一來源。system-design 沒定、這裡定下的部分：

- **介面**：`scripts/check-security-headers.sh [--backend-down] <base-url>`。結束碼 0 為全部相符、1 為有不符、2 為用法錯誤（少了 base URL、未知旗標、curl 連不上）。base URL 不給預設值，避免在本機誤打到別的服務。
- **預設模式的請求**：system-design D2 的五類加 `POST /`（405），另加兩個「帶身分憑證」的變體：`GET /` 與 `GET /api/v1/health` 各帶 `Cookie: session=probe` 與 `Authorization: Bearer probe`。這兩個變體對應 `specs/security-headers`「安全標頭與身分無關」；因為期望值本來就是常數，變體只要通過同一套比對，就證明了標頭不隨憑證而變（system-design §權限檢查點）。
- **建置資源的路徑**：從 `GET /` 的 body 取第一個 `src="/assets/…\.js"`；取不到時以結束碼 1 失敗並說明，不跳過這一類。
- **每一類的判定**：狀態碼相符；`specs/security-headers` 的七個標頭各恰好一行且值逐字元相同；沒有 `Strict-Transport-Security`；沒有 `Content-Security-Policy-Report-Only`。標頭名不分大小寫比對，值去掉結尾的 `\r` 後逐字元比對。任一類不符不中斷，跑完所有類別後一次列出全部不符，每筆一行「類別、標頭、期望值、實際值（缺少時寫 `<missing>`，重複時寫出現次數）」。
- **`--backend-down`**：只請求 `GET /api/v1/health`，期望 `502`，其餘判定相同。
- **可攜性**：只用 bash 3.2 也有的語法（不用關聯陣列、`mapfile`、`${var,,}`），外部工具只用 `curl`、`grep`、`sed`、`tr`、`awk`。

替代方案：寫成 Node 腳本（`scripts/*.mjs` 的慣例）。不採用：`compose` job 的 Lite 層段落目前不裝 Node，system-design 元件清單也定為 `.sh`；判定邏輯不複雜，bash 加 curl 足夠。

### D3：驗證腳本的回歸測試用假伺服器

新增 `scripts/tests/check-security-headers.test.mjs`：每個案例在 `127.0.0.1` 的隨機埠起一個 Node `http` 伺服器，依 D2 的路徑回應指定的狀態碼與標頭，再以子程序執行 `bash scripts/check-security-headers.sh [--backend-down] http://127.0.0.1:<port>`，斷言結束碼與輸出。案例至少涵蓋：全部相符時結束碼 0；某一類缺 CSP；`X-Frame-Options` 值為 `DENY`；後端那兩類的 `X-Frame-Options` 出現兩次；帶 `Strict-Transport-Security`；帶 `Content-Security-Policy-Report-Only`；`Server` 帶版本；後端錯誤那一類回 `200` 而不是 `404`；帶憑證的變體缺標頭；`--backend-down` 時 `502` 相符與回 `200`；頁面殼取不到 `/assets/*.js`；沒給 base URL 時結束碼 2。

這支測試加進 `scripts-tests` job 的 `node --test` 清單與 `ci-workflow.test.mjs` C9 的 `SCRIPT_TESTS`，對應 `specs/ci-quality-gates`「CI 輔助腳本的測試獨立執行」。

替代方案：只靠 `compose` job 對真容器跑。不採用：`compose` 只在相關路徑變動時跑；而且今天的後端不發安全標頭（system-design D3），真容器造不出「重複標頭」這一類失敗，無法證明腳本會擋。

### D4：e2e 的容器模式

照 system-design D5：`E2E_TARGET=compose` 時 `webServer` 不設、`testMatch` 只取 `public-entry/**/*.spec.ts`、`E2E_BASE_URL` 必填；其他情況 `testIgnore` 加 `public-entry/**`。補充：

- 容器模式下 `E2E_API_URL` 不讀也不驗證（沒有要起的後端）。`E2E_BASE_URL` 未設或空字串時，設定檔在 `defineConfig` 之前丟出含 `E2E_BASE_URL` 的錯誤；沿用既有的 `readUrl` 驗證格式，只是不給預設值。
- 旅程 `e2e/public-entry/shell.spec.ts` 的做法：以 `page.addInitScript` 在文件載入前註冊 `securitypolicyviolation` 監聽、把 `violatedDirective` 與 `blockedURI` 收進陣列；以 `page.on("requestfailed")` 收失敗請求、`page.on("response")` 收同源回應的狀態碼。`page.goto("/")` 取得頁面殼回應，先斷言它帶 `content-security-policy`（只斷言存在，不比對值，D4 of system-design），再等 `load` 事件，接著以 `page.evaluate` 對 `/api/v1/health` 發同源 `fetch`，最後一次斷言：頁面殼與每一支 `/assets/` 回應 `200`、違規陣列為空、失敗請求為空、API 回 `200` 且 `data.status` 為 `"ok"`。斷言失敗時訊息列出違規的指令與位址或失敗的請求。
- 檔案位置符合 `e2e/static/e2e-static-checks.mjs` 的 `<module>/<page>.spec.ts`，spec 內只用相對路徑，不需改靜態檢查。

替代方案：另寫一個不經 Playwright 的瀏覽器腳本放在 `scripts/`。不採用：會多一套瀏覽器依賴與設定，且違反「位址設定只集中在一處」（testing-agent-rules T8）。

### D5：`compose` job 的步驟順序

照 system-design D6 與第三張序列圖。每一層在「Check the … health through nginx」之後、`down -v` 之前依序加：

1. `scripts/check-security-headers.sh http://localhost:8080`
2. （只在正式層）`E2E_TARGET=compose E2E_BASE_URL=http://localhost:8080 pnpm --filter e2e test`
3. `docker compose stop backend`（正式層帶 `-f docker-compose.prod.yml` 與同一個密碼變數）
4. `scripts/check-security-headers.sh --backend-down http://localhost:8080`

pnpm、Node 與 Chromium 的安裝步驟（`pnpm/action-setup`、`actions/setup-node`、`pnpm install --frozen-lockfile --filter e2e...`、`pnpm --filter e2e exec playwright install --with-deps chromium`）放在 Lite 層起服務之前，與 `e2e` job 同寫法；放在起服務之前，安裝失敗時不必先等 Lite 層。`timeout-minutes: 20` 不變，job 不加 `continue-on-error`、不改 `if`。`ci-workflow.test.mjs` C7 的順序斷言同步加上這四步，並斷言兩層各有一次標頭比對與一次 `--backend-down`、瀏覽器檢查只出現一次且在正式層。

替代方案：瀏覽器檢查放 `e2e` job 並在其中起容器。不採用：clarification Q4 已定放 `compose` job。

### D6：觸發清單

照 system-design N2（clarification P3）：`scripts/ci-changed-paths.mjs` 的 `EXACT` 加 `scripts/check-security-headers.sh`、`e2e/playwright.config.ts`、`e2e/public-entry/shell.spec.ts`；檔頭註解的清單同步。測試加三個為真的案例與一個「只改 `e2e/system-health/dev-health.spec.ts` 為假」的案例。

### D7：`VITE_API_BASE_URL` 的耦合與文件

照 system-design D7：耦合寫在 `frontend/nginx.conf` 的 CSP 註解、`frontend/Dockerfile` 的 `ARG VITE_API_BASE_URL` 註解、`architecture.mdx` §部署與維運 三處。`architecture.mdx` §部署與維運 依 system-design §元件清單 的那一列改寫（實際檢查方式、HSTS 歸 TLS 邊緣與正式層必須在 TLS 後面、N3、N4）；只寫「怎麼檢查、檢查哪幾類」，不另抄標頭與值（system-design D4）。`backend-modules.mdx` §已知限制「Nginx 與安全標頭」列刪除。這兩份文件在實作組做，不在規劃階段（clarification §交給後續產出）。

### Scenario 與檢查的對應

| spec               | Requirement 或 Scenario                        | 由誰證明                                                   |
| :----------------- | :--------------------------------------------- | :--------------------------------------------------------- |
| `security-headers` | 安全標頭的完整值、每一類回應、HSTS、只出現一次 | 驗證腳本（D2），`compose` job 兩層各跑；判定邏輯由 D3 測試 |
| `security-headers` | 安全標頭與身分無關                             | 驗證腳本的兩個帶憑證變體（D2）                             |
| `security-headers` | CSP 不擋前端自己的資源                         | `e2e/public-entry/shell.spec.ts`（D4），`compose` 正式層   |
| `ci-quality-gates` | 觸發路徑                                       | `scripts/tests/ci-changed-paths.test.mjs`（D6）            |
| `ci-quality-gates` | 步驟、失敗條件、瀏覽器檢查、腳本測試獨立執行   | `scripts/tests/ci-workflow.test.mjs` C7、C9（D3、D5）      |
| `e2e-testing`      | 預設跑法、容器模式、旅程                       | `playwright test --list` 與兩種模式的實際執行（D4）        |

## Risks / Trade-offs

- [強制模式的 CSP 讓日後引入外部資源的前端 change 靜默壞掉，開發伺服器上看不出來（N3）] → `compose` 的瀏覽器檢查在動到 `frontend/` 時一定會跑；`architecture.mdx` 與 `frontend/nginx.conf` 註解寫明；ui-design §給後續畫面的設計約束 要求之後的 change 自查
- [`compose` 不列必過，紅燈不會被 GitHub 擋下] → dispatch 的合併條件是「CI 每個 job 都 completed 且 success」，被觸發的 `compose` 失敗時不會合併（AGENTS.md §Project Board and Dispatch）
- [瀏覽器檢查不穩定，例如 Chromium 下載失敗或首次載入慢] → 沿用 `e2e` job 的安裝寫法；設定檔在 CI 下 `retries: 1`；旅程只用條件式等待
- [後端日後自己發同名安全標頭，回應出現兩個值] → system-design D3；驗證腳本「只出現一次」的判定擋下，D3 有回歸測試
- [邊緣代理改寫或移除 origin 的標頭（N4）] → 本 repo 只驗到 origin；`architecture.mdx` 寫部署後以 `curl -I https://<網域>/` 自查
- [`form-action 'self'` 與 COOP `same-origin` 限制 01-01 Google 登入的做法] → system-design §仍開著的技術問題 已列為給後續 change 的提醒，本 change 不處理
- [`X-Frame-Options` 由 `DENY` 改為 `SAMEORIGIN` 是放寬] → 只多允許同源嵌入（clarification Q3）；`frame-ancestors 'self'` 同值，兩者一致

## Migration Plan

- 沒有資料庫 migration，沒有 API、資料模型或設定變數異動。
- 部署：合併後，部署者以 `docker compose up --build`（正式層加 `-f docker-compose.prod.yml`）重建 `frontend` 映像，新標頭才會生效；不需改 `.env`。部署後以 `curl -I` 對公開網域自查（N4，寫在 `architecture.mdx`）。
- 回滾：revert 本 change 的合併 commit 並重建 `frontend` 映像，即回到只有五個標頭、`X-Frame-Options: DENY` 的狀態；沒有狀態需要清理。若只是 CSP 擋到某個功能，可以先單獨 revert `frontend/nginx.conf` 的 CSP 那一行，但驗證腳本會因此失敗，必須同一個 PR 一起改腳本的期望值。
