## 驗收：nginx-security-headers

結論：**通過**

驗收日期 2026-11-25，對象為分支 `feat/nginx-security-headers` 的 `2b057ed`（`git fetch` 後與 `origin/feat/nginx-security-headers` 相同，工作區乾淨）。驗收者 `acceptance-verifier`，結論依維護者 2026-11-19 裁定即為驗收結論；code review 無阻斷意見，它唯一的非阻擋修正已在 `2b057ed`。

### 範圍與不適用項目

- 本 change 只動公開入口的 Nginx 設定、標頭比對腳本、e2e 的容器模式、CI 與文件。沒有 API 異動（`api-contract.md`）、沒有 schema、沒有畫面（`ui-design.md`），所以**各角色的 payload、遮蔽欄位、寫入後逐欄位核對、畫面四種狀態、cookie 與 storage 檢查都不適用**。
- 標頭對所有呼叫端相同（spec「安全標頭與身分無關」），本專案也還沒有認證，所以依角色分列沒有意義；以「不帶憑證」與「帶任意 `Cookie` 與 `Authorization: Bearer`」兩種請求代替角色維度，以真實回應驗證。`endpoint-authorization.mdx` 唯一一列 `getHealth` 沒有被本 change 改動。
- 依 clarification Q9，本 change **不補** `docs/specs/` 規格頁（技術 change，依 spec-migration D4 追溯）。下表「對應的規格書驗收標準」一欄因此填 spec 每條 requirement 的 `來源：`（issue #568 §驗收條件 的條號與決議編號），不是缺陷。
- issue #568 驗收條件 1（只有 frontend 發布埠）沿用 #506 的既有證據（clarification Q8／Q10）：CI `compose` job 的「Assert the structure of both orchestration files」步驟以 `jq` 斷言兩份編排檔只有 `frontend` 有 `ports`；本次本機兩層 `docker compose ps` 也只有 `frontend` 發布 `0.0.0.0:18568->80`，`backend`、`db` 只有容器內埠。

### 證據來源代號

| 代號      | 內容                                                                                                                                                                                                                                                                                                                                                                                           |
| :-------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `L`       | 本機 Lite 層：`cp .env.example .env`，`FRONTEND_PORT=18568 docker compose -p issue568 -f docker-compose.yml -f <scratch>/override.yml up --build --wait --wait-timeout 300`（override 只把映像標成 `issue568-backend:probe`、`issue568-frontend:probe`，共用的 `label-suite-*:latest` 未被覆寫，驗收前後 image id 相同）。三個服務 healthy，health 回 `data.status`、`data.database` 都是 `ok` |
| `P`       | 本機正式層：同上改 `-f docker-compose.prod.yml`，`POSTGRES_PASSWORD=$(openssl rand -hex 16)`（本輪新產生），四個服務 healthy，health 回 `ok`／`ok`                                                                                                                                                                                                                                             |
| `CHK`     | `scripts/check-security-headers.sh http://localhost:18568`：`L`、`P` 都輸出 `Security headers match at http://localhost:18568 (8 responses checked).`，exit 0                                                                                                                                                                                                                                  |
| `DOWN`    | `docker compose -p issue568 stop backend` 後 `scripts/check-security-headers.sh --backend-down http://localhost:18568`：`L`、`P` 都 `(1 responses checked)`、exit 0；本機實際狀態碼兩層都是 `502`（CI 上耗時 60 秒，為 `504`；clarification Q11 兩者皆合格）                                                                                                                                   |
| `PROBE`   | 驗收者自寫、不依賴實作腳本的 `curl -D -` 探針，在 `L`、`P` 各跑一次八個請求並逐行數標頭（結果見下方原始證據 E1）                                                                                                                                                                                                                                                                               |
| `ENV`     | 後端 404 錯誤外層的逐字比對：同一個 `X-Correlation-ID: acc568-envelope-check`，一次經 Nginx（`curl`），一次在後端容器內直接打 `127.0.0.1:8000`（`docker compose exec backend python`），把 `timestamp` 正規化後比對（E2）                                                                                                                                                                      |
| `MUT`     | 驗收用的變異代理（只在 scratchpad、不改產品程式）：一支 Node `http` 代理放在 `L`／`P` 的公開入口前面，依模式刪 CSP、把 `X-Frame-Options` 改成 `DENY`、加 HSTS、拿掉 `/api/v1/` 回應的安全標頭、在 `/api/v1/` 回應多送一次 `X-Frame-Options`、在頁面殼 `<body>` 插入內嵌 `<script>`，再對代理跑 `CHK` 或瀏覽器旅程（E3）                                                                        |
| `E2E`     | `P` 起著時 `E2E_TARGET=compose E2E_BASE_URL=http://localhost:18568 pnpm --filter e2e test`：exit 0，`1 passed`，輸出沒有 `[WebServer]`                                                                                                                                                                                                                                                         |
| `CI`      | PR #659 的 CI run `45603927908`（`5ff952c`）與 `45605202454`（`2b057ed`）：15 個 job 全部 success；`compose` job log 摘錄見 E4                                                                                                                                                                                                                                                                 |
| `T:hdr`   | `scripts/tests/check-security-headers.test.mjs`：21 案例全過；`CHECK_HEADERS_BASH=/bin/bash`（macOS `GNU bash, version 3.2.57`）再跑一次 21 案例全過                                                                                                                                                                                                                                           |
| `T:paths` | `scripts/tests/ci-changed-paths.test.mjs` 17 案例全過，加上驗收者直接呼叫 `touchesCompose()` 與 CLI 的結果（E5）                                                                                                                                                                                                                                                                               |
| `T:wf`    | `scripts/tests/ci-workflow.test.mjs` 60 案例全過（C1–C11，含 C7 compose 步驟順序與 C9 scripts-tests 清單）                                                                                                                                                                                                                                                                                     |

### Scenario 結果

#### security-headers（新增主規格）

| Scenario                                     | 對應的規格書驗收標準                         | 證據                                                                                                                                                                                                                                   | 結果 |
| :------------------------------------------- | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 頁面殼帶完整的安全標頭值                     | issue #568 §驗收條件 2；Q2、Q3、Q3-附        | `PROBE`：`GET /` 200；從 spec 逐行取出七個期望值與 `L` 的實際值以字串相等比較，七個都 `MATCH`；`CSP-RO=0`。`CHK` `L`／`P` exit 0。`T:hdr` 的 Report-Only 案例                                                                          | 通過 |
| 防嵌入的兩個標頭一致                         | issue #568 §驗收條件 2；Q3                   | `PROBE`：`X-Frame-Options: SAMEORIGIN`；CSP 含 `frame-src 'self'; frame-ancestors 'self'`，不含 `frame-ancestors 'none'`（E1 原始標頭）                                                                                                | 通過 |
| Server 標頭不帶版本                          | issue #568 §需求目標；Q3-附                  | `PROBE`：`GET /` 與 `POST /` 的 `Server` 都恰好是 `nginx`。`T:hdr`「Server carries a version: exit 1」                                                                                                                                 | 通過 |
| 公開入口的每一類回應都帶同一組安全標頭       | issue #568 §驗收條件 2；Q4、Q11              | `PROBE` `L`／`P`：狀態碼依序 `200 200 200 200 404 405`，六類各七個標頭一行，與頁面殼 `diff` 相同（E1）。`CHK` 兩層 exit 0                                                                                                              | 通過 |
| 後端錯誤回應保留錯誤外層並帶安全標頭         | issue #568 §驗收條件 2；system-design D6     | `ENV` 兩層：經 Nginx 與直連後端都是 `404`、`172` bytes，正規化 `timestamp` 後 body 完全相同：`{"success":false,"code":"NOT_FOUND",…,"data":null,…,"errors":null}`；`curl -i` 經 Nginx 帶七個標頭（E2）。code review 指出的缺口以此補上 | 通過 |
| 後端停止時公開入口的 502 或 504 也帶安全標頭 | issue #568 §驗收條件 2；Q11                  | `DOWN` 兩層 exit 0；`PROBE --down` 兩層 `502`，七個標頭各一行、與頁面殼相同；`CI` 兩層 `--backend-down` 通過（60 秒，504 路徑）                                                                                                        | 通過 |
| 每一類回應都沒有 HSTS                        | issue #568 §需求目標；Q1                     | `PROBE` 八個請求加 `--down` 一個，兩層 `HSTS=0`。`MUT add-hsts`：`CHK` exit 1，八類都報 `Strict-Transport-Security: expected <absent>, got "max-age=60"`                                                                               | 通過 |
| 經後端轉發的回應沒有重複的安全標頭           | issue #568 §驗收條件 2；Q4、system-design D3 | `PROBE`：`/api/v1/health` 與 `/api/v1/does-not-exist` 七個標頭各恰好 1 行（兩層）。`MUT dup-xfo-api`：`CHK` exit 1，`expected "SAMEORIGIN" exactly once, got 2 occurrences`                                                            | 通過 |
| 帶與不帶身分憑證的回應標頭相同               | issue #568 §驗收條件 2；S2；Hard Rule 6      | `PROBE`：`GET /` 與 `GET /api/v1/health` 帶 `Cookie: session=acc568secret`、`Authorization: Bearer acc568token` 的回應標頭與不帶時 `diff` 相同；`grep acc568` 於全部標頭檔 0 命中                                                      | 通過 |
| CSP 不擋前端自己的資源                       | issue #568 §驗收條件 3；Q4、Q5               | `E2E` exit 0；`CI` 兩個 run 的正式層瀏覽器檢查 `1 passed`。反證：`MUT inline-script` 旅程 exit 1、`CSP violations while loading: script-src-elem blocked inline`                                                                       | 通過 |

#### ci-quality-gates（MODIFIED 與 ADDED）

| Scenario                                   | 對應的規格書驗收標準               | 證據                                                                                                                                                                                                                                                      | 結果 |
| :----------------------------------------- | :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 動到編排檔時執行容器驗證                   | #506 §驗收條件 1（回歸）           | E5：`docker-compose.yml`、`docker-compose.prod.yml` → `true`。`CI` compose 兩層 health `ok`／`ok`                                                                                                                                                         | 通過 |
| 動到後端程式時執行容器驗證                 | #506（回歸）                       | E5：`backend/app/main.py` → `true`；`T:paths`                                                                                                                                                                                                             | 通過 |
| 只改文件時跳過容器驗證                     | #506（回歸）                       | E5：`docs/development/architecture.mdx` → `false`；`T:paths`                                                                                                                                                                                              | 通過 |
| 取不到 base commit 時執行容器驗證          | #506（回歸）                       | E5：空字串、全 0、不存在的 sha 三種都 `compose=true`，並印出原因（`the base commit is empty`／`all zeros`／`git cannot diff …`）                                                                                                                          | 通過 |
| 只改標頭驗證時執行容器驗證                 | issue #568 §驗收條件 2、3；P3      | E5：`scripts/check-security-headers.sh`、`e2e/playwright.config.ts`、`e2e/public-entry/shell.spec.ts`、`e2e/public-entry/another.spec.ts`、`e2e/shared/fixtures/index.ts` 都 `true`；`T:paths`                                                            | 通過 |
| 只改其他 e2e 旅程時跳過容器驗證            | P3                                 | E5：`e2e/system-health/dev-health.spec.ts` → `false`；`T:paths`                                                                                                                                                                                           | 通過 |
| 缺必要設定卻沒有被拒絕時 CI 失敗           | #506（回歸，本 change 未改該步驟） | `T:wf` C7 通過；`CI` compose 該步驟成功                                                                                                                                                                                                                   | 通過 |
| 服務逾時未健康時 CI 失敗                   | #506（回歸）                       | `T:wf` C7（`--wait-timeout 300`、`timeout-minutes` 不變）；`CI`                                                                                                                                                                                           | 通過 |
| 編排工具版本過舊時 CI 失敗                 | #506（回歸）                       | `CI` log「Check the Compose version」步驟在任何 `up` 之前，`minimum=2.20.0`、低於時 `::error::Docker Compose $version is older than the required $minimum`（E4）；`T:wf` C7                                                                               | 通過 |
| 動到公開入口時 CI 驗證兩層的安全標頭       | issue #568 §驗收條件 2、3；Q4      | `CI` run 45603927908 compose：Lite 標頭比對、Lite `--backend-down`、正式層標頭比對、瀏覽器檢查、正式層 `--backend-down` 依序成功（E4）；`T:wf` C7 斷言每層各一次、順序正確                                                                                | 通過 |
| 後端測試失敗時腳本測試照樣執行             | T9、T11（回歸）                    | `ci.yml` 的 `scripts-tests` 沒有 `needs`、沒有 `if`（只有 `compose` 的 `needs: changes` 與 `coverage` 的 `needs`）；`T:wf` C9                                                                                                                             | 通過 |
| CI 設定的回歸測試抓到被跳過的檢查          | T9（回歸）                         | `T:wf` C4 backend-sqlite 通過；實作者在 e954d74 刪掉正式層 `--backend-down` 時 C7 兩個測試失敗、還原後通過（提交訊息）                                                                                                                                    | 通過 |
| 安全標頭比對腳本的測試在腳本測試檢查中執行 | Q4、design D3                      | `CI` scripts-tests log：`scripts/tests/check-security-headers.test.mjs` 在清單中，`ok 21 - check-security-headers.sh`；`T:hdr` 的重複標頭案例；`T:wf` C9 的 `SCRIPT_TESTS` 含 `check-security-headers`                                                    | 通過 |
| 安全標頭被刪除時 CI 失敗                   | issue #568 §驗收條件 2             | `MUT strip-csp`：`CHK` exit 1，八類都報 `Content-Security-Policy: expected "<完整值>", got <missing>`；`T:hdr`「one category without CSP」                                                                                                                | 通過 |
| 安全標頭值不符時 CI 失敗                   | issue #568 §驗收條件 2             | `MUT xfo-deny`：exit 1，`X-Frame-Options: expected "SAMEORIGIN", got "DENY"`；實作者以真實 `nginx.conf` 改 `DENY` 重建亦 exit 1（90c399f 提交訊息）                                                                                                       | 通過 |
| 某條路徑漏掉安全標頭時 CI 失敗             | issue #568 §驗收條件 2             | `MUT api-drop`：exit 1，只有 `backend success GET /api/v1/health`、`backend error GET /api/v1/does-not-exist`（及帶憑證的 health）列出六個 `<missing>`，非 API 類別 0 行；實作者以 `location /api/v1/` 內加 `add_header X-Probe` 重建亦 exit 1（90c399f） | 通過 |
| 回應帶 HSTS 時 CI 失敗                     | Q1                                 | `MUT add-hsts` exit 1（同上）；實作者以真實 `nginx.conf` 加 HSTS 重建亦 exit 1                                                                                                                                                                            | 通過 |
| 同名標頭重複時 CI 失敗                     | Q4、system-design D3               | `MUT dup-xfo-api` exit 1，輸出含 `2 occurrences`；`T:hdr`「X-Frame-Options twice on both backend categories」                                                                                                                                             | 通過 |
| 後端停止後的 502 或 504 缺標頭時 CI 失敗   | Q11                                | 停後端的 `P` 前放 `MUT xfo-deny`：`--backend-down` exit 1，`[backend down GET /api/v1/health] X-Frame-Options: expected "SAMEORIGIN", got "DENY"`；`T:hdr`「504 missing a header」「health path answers 200」                                             | 通過 |
| CSP 擋下前端資源時 CI 失敗                 | issue #568 §驗收條件 3             | `MUT inline-script`：`CHK` 仍 exit 0（`8 responses checked`），瀏覽器旅程 exit 1、`script-src-elem blocked inline`；實作者以真實 `frontend/index.html` 重建亦同（b0bfe7f）                                                                                | 通過 |
| 瀏覽器檢查不在 e2e 檢查中執行              | Q4                                 | `CI` e2e job 只跑 `system-health/dev-health.spec.ts`（`1 passed`）；本機預設 `--list` 只列該檔                                                                                                                                                            | 通過 |

#### e2e-testing（MODIFIED 與 ADDED）

| Scenario                             | 對應的規格書驗收標準       | 證據                                                                                                                                                                                           | 結果 |
| :----------------------------------- | :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 從根目錄執行 e2e                     | ADR-007 D1（回歸）         | 不設 `E2E_TARGET` 的 `pnpm --filter e2e test` exit 0、`1 passed`；結束後 `lsof` 沒有 5173／8000 在聽                                                                                           | 通過 |
| spec 檔依模組與頁面放置              | T1                         | `find e2e -name '*.spec.ts'`：`e2e/system-health/dev-health.spec.ts`、`e2e/public-entry/shell.spec.ts`，`e2e/shared/` 下 0 個；`test:static` 12 項全過                                         | 通過 |
| 預設跑法不執行公開入口旅程           | Q4                         | `pnpm --filter e2e exec playwright test --list`：只有 `system-health/dev-health.spec.ts`，`Total: 1 test in 1 file`                                                                            | 通過 |
| spec 不含主機與埠                    | T8                         | `grep -rnE` 搜 `localhost`、`127.0.0.1` 與四到五位數埠號（`e2e/**/*.ts`）（排除設定檔與 node_modules）0 命中；`test:static`                                                                    | 通過 |
| 以環境變數改位址                     | T8（回歸）                 | `E2E_BASE_URL=http://localhost:15468 E2E_API_URL=http://localhost:18468 pnpm --filter e2e test` exit 0，後端 log `Uvicorn running on http://localhost:18468`，`1 passed`                       | 通過 |
| 對準容器入口時不自起伺服器           | Q4、system-design D5       | `E2E` exit 0，`[WebServer]` 0 次；`--list` 只列 `public-entry/shell.spec.ts`。以 `18568` 代替 Scenario 的 `8080`（本機約定，不佔用 8080）；`CI` 以 `8080` 跑過                                 | 通過 |
| 對準容器入口卻沒有設位址時以錯誤結束 | system-design D5           | `E2E_TARGET=compose … --list` exit 1；`E2E_TARGET=compose E2E_BASE_URL= pnpm --filter e2e test` exit 1；訊息 `E2E_BASE_URL must be set to the public entry point …`，沒有 `Running`、沒有 5173 | 通過 |
| 容器公開入口上的頁面殼載入正常       | issue #568 §驗收條件 3；Q5 | `E2E` exit 0；`CI` 兩次 run `1 passed`                                                                                                                                                         | 通過 |
| 目標沒有 CSP 時旅程失敗              | Q5                         | `MUT strip-csp` 旅程 exit 1：`The page shell is missing Content-Security-Policy, so this check would prove nothing.`                                                                           | 通過 |
| 載入時有 CSP 違規則旅程失敗          | Q5                         | `MUT inline-script` 旅程 exit 1：`CSP violations while loading: script-src-elem blocked inline`。同一代理 `passthrough` 模式旅程 exit 0，證明失敗來自注入而非代理本身                          | 通過 |

#### 原始證據行

```text
E1  PROBE（L 與 P 輸出相同，此為 P）
GET /                         200 | CSP=1 XFO=1 XCTO=1 Referrer=1 COOP=1 Permissions=1 Server=1 | HSTS=0 CSP-RO=0 Server=nginx
GET /some/spa/path            200 | 同上
GET /assets/index-DH5Y4k2x.js 200 | 同上
GET /api/v1/health            200 | 同上
GET /api/v1/does-not-exist    404 | 同上
POST /                        405 | 同上
GET / +creds                  200 | 同上
GET health +creds             200 | 同上
health(backend down)          502 | 同上
（九個回應的七個標頭行與 GET / 的 diff 全部相同；標頭中 acc568 0 命中）

E2  ENV（L 與 P 相同）
via nginx : status+bytes = 404 172
direct    : status+bytes = 404 172
via body  : {"success":false,"code":"NOT_FOUND","message":"找不到指定的資源","data":null,"timestamp":"<T>","traceId":"acc568-envelope-check","errors":null}
direct body: {"success":false,"code":"NOT_FOUND","message":"找不到指定的資源","data":null,"timestamp":"<T>","traceId":"acc568-envelope-check","errors":null}
BODY IDENTICAL (timestamp normalized)

    curl -si http://localhost:18568/api/v1/does-not-exist（P）
HTTP/1.1 404 Not Found
Server: nginx
Content-Type: application/json
Content-Length: 187
content-language: zh-TW
vary: Origin
x-correlation-id: 14408983-a995-446a-8e0e-1c53e87f0c69
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self'; frame-ancestors 'self'
Referrer-Policy: strict-origin-when-cross-origin
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()

{"success":false,"code":"NOT_FOUND","message":"找不到指定的資源","data":null,"timestamp":"2026-11-25T11:35:08.521Z","traceId":"14408983-a995-446a-8e0e-1c53e87f0c69","errors":null}

E3  MUT（對 L／P 前的代理執行 check-security-headers.sh）
passthrough   exit 0  Security headers match … (8 responses checked).
strip-csp     exit 1  MISMATCH [page shell GET /] Content-Security-Policy: expected "default-src 'self'; …", got <missing>（八類）
xfo-deny      exit 1  MISMATCH [page shell GET /] X-Frame-Options: expected "SAMEORIGIN", got "DENY"（八類）
add-hsts      exit 1  MISMATCH [page shell GET /] Strict-Transport-Security: expected <absent>, got "max-age=60"（八類）
api-drop      exit 1  只有 backend success／backend error／backend success with credentials 三類，各六個 <missing>
dup-xfo-api   exit 1  MISMATCH [backend success GET /api/v1/health] X-Frame-Options: expected "SAMEORIGIN" exactly once, got 2 occurrences: "SAMEORIGIN" | "SAMEORIGIN"
inline-script exit 0  （標頭比對不受影響）；瀏覽器旅程 exit 1：Error: CSP violations while loading: script-src-elem blocked inline
strip-csp     瀏覽器旅程 exit 1：Error: The page shell is missing Content-Security-Policy, so this check would prove nothing.
xfo-deny + 後端已停 --backend-down exit 1：MISMATCH [backend down GET /api/v1/health] X-Frame-Options: expected "SAMEORIGIN", got "DENY"

E4  CI run 45603927908（5ff952c）compose job
Check the Compose version            Docker Compose version v5.1.3（minimum=2.20.0）
Check the Lite security headers      Security headers match at http://localhost:8080 (8 responses checked).
Stop the Lite backend                Container label-suite-backend-1 Stopped
Check the Lite … with the backend down   11:24:28 → 11:25:28  Security headers match at http://localhost:8080 (1 responses checked).
Check the production security headers    Security headers match at http://localhost:8080 (8 responses checked).
Check the public entry in a browser  E2E_TARGET=compose E2E_BASE_URL=http://localhost:8080 pnpm --filter e2e test → 1 passed (1.3s)
Stop the production backend          Container label-suite-prod-backend-1 Stopped
Check the production … with the backend down  11:25:57 → 11:26:57  Security headers match at http://localhost:8080 (1 responses checked).
    run 45605202454（2b057ed，HEAD）compose job 同五步全部 match／1 passed；兩個 run 的 15 個 job 全部 success

E5  ci-changed-paths（touchesCompose 與 CLI）
docker-compose.yml true · docker-compose.prod.yml true · scripts/check-security-headers.sh true · e2e/playwright.config.ts true
e2e/public-entry/shell.spec.ts true · e2e/public-entry/another.spec.ts true · e2e/shared/fixtures/index.ts true
e2e/system-health/dev-health.spec.ts false · docs/development/architecture.mdx false · backend/app/main.py true · frontend/nginx.conf true
--base origin/main → compose=true · --base "" → "the base commit is empty" compose=true
--base 000…0 → "the base commit is all zeros" compose=true · --base 1234567890abcdef… → "git cannot diff …" compose=true
```

#### spec 沒描述、實作出現的行為（觀察，不是缺陷）

1. 後端停止時，本機兩層都是立即 `502`；CI runner 上兩層都等了 60 秒才回（`504`，`proxy_connect_timeout` 預設值）。Q11 已接受兩者。人工驗收時若等了一分鐘才有回應，是 504 路徑，不是卡住。
2. 經 Nginx 的後端回應另帶 `content-language`、`vary: Origin`、`x-correlation-id` 三個後端自己的標頭，與本 change 無關，原樣通過。
3. `/assets/` 下不存在的檔案退回頁面殼 `200`（clarification N1，不在本 change，寫進 PR 的非阻擋事項）。

### Decision Table

標頭與角色無關（spec「安全標頭與身分無關」），本專案也尚無認證；系統角色與任務成員身分一欄以「呼叫端憑證」代替：「無」＝不帶 `Cookie` 與 `Authorization`，「任意」＝帶 `Cookie: session=acc568secret` 與 `Authorization: Bearer acc568token`。動作是經公開入口的 HTTP 請求。

| #   | 呼叫端憑證 | 動作                         | 資料狀態（層／後端）    | 輸入或變異                                 | 預期                                                     | 結果        | 驗證方式                     |
| :-- | :--------- | :--------------------------- | :---------------------- | :----------------------------------------- | :------------------------------------------------------- | :---------- | :--------------------------- |
| 1   | 無         | `GET /`                      | Lite／正式層，後端健康  | 有效路徑                                   | 200，七標頭逐字元相符各一行，無 HSTS、無 Report-Only     | 符合        | `PROBE`、`CHK`（手動＋自動） |
| 2   | 無         | `GET /some/spa/path`         | 同上                    | 非檔案路徑（邊界：前端路由）               | 200，同一組標頭                                          | 符合        | `PROBE`、`CHK`               |
| 3   | 無         | `GET /assets/<hash>.js`      | 同上                    | 頁面殼引用的建置資源                       | 200，同一組標頭                                          | 符合        | `PROBE`、`CHK`               |
| 4   | 無         | `GET /api/v1/health`         | 同上                    | 有效路徑                                   | 200，`ok`／`ok`，同一組標頭各一行                        | 符合        | `PROBE`、`CHK`               |
| 5   | 無         | `GET /api/v1/does-not-exist` | 同上                    | 不存在路徑                                 | 404，body 與直連後端相同，同一組標頭各一行               | 符合        | `ENV`、`PROBE`、`CHK`        |
| 6   | 無         | `POST /`                     | 同上                    | 不允許的方法                               | 405（Nginx 自產），同一組標頭，`Server: nginx`           | 符合        | `PROBE`、`CHK`               |
| 7   | 任意       | `GET /`                      | 同上                    | 帶憑證                                     | 與 #1 標頭相同，標頭不含憑證值                           | 符合        | `PROBE`、`CHK`               |
| 8   | 任意       | `GET /api/v1/health`         | 同上                    | 帶憑證                                     | 與 #4 標頭相同，標頭不含憑證值                           | 符合        | `PROBE`、`CHK`               |
| 9   | 無         | `GET /api/v1/health`         | 後端已停止              | —                                          | 502 或 504，同一組標頭，無 HSTS                          | 符合（502） | `DOWN`、`PROBE`              |
| 10  | 無         | 瀏覽器開 `/`                 | 正式層，後端健康        | —                                          | CSP 存在、資源 200、違規 0、失敗 0、同源 health 200 `ok` | 符合        | `E2E`、`CI`                  |
| 11  | 無         | 標頭比對                     | 頁面殼前加變異          | 缺 CSP（缺值）                             | exit 1，`<missing>`                                      | 符合        | `MUT`、`T:hdr`               |
| 12  | 無         | 標頭比對                     | 同上                    | `X-Frame-Options: DENY`（無效值）          | exit 1，期望與實際值                                     | 符合        | `MUT`、`T:hdr`               |
| 13  | 無         | 標頭比對                     | 同上                    | 多一個 HSTS                                | exit 1，`expected <absent>`                              | 符合        | `MUT`、`T:hdr`               |
| 14  | 無         | 標頭比對                     | 同上                    | API 回應拿掉標頭（某條路徑漏掉）           | exit 1，只列後端兩類                                     | 符合        | `MUT`                        |
| 15  | 無         | 標頭比對                     | 同上                    | API 回應同名標頭兩次（重複）               | exit 1，列次數                                           | 符合        | `MUT`、`T:hdr`               |
| 16  | 無         | 標頭比對 `--backend-down`    | 後端已停止＋變異        | `DENY`                                     | exit 1                                                   | 符合        | `MUT`、`T:hdr`               |
| 17  | 無         | 瀏覽器旅程                   | 頁面殼前加變異          | 內嵌 `<script>`                            | 旅程 exit 1、`script-src-elem`；標頭比對仍 exit 0        | 符合        | `MUT`                        |
| 18  | 無         | 瀏覽器旅程                   | 頁面殼前加變異          | 缺 CSP                                     | 旅程 exit 1，指出缺 CSP                                  | 符合        | `MUT`                        |
| 19  | —          | `pnpm --filter e2e test`     | `E2E_TARGET=compose`    | `E2E_BASE_URL` 未設／空字串（缺值）        | 執行旅程前 exit 1，訊息含 `E2E_BASE_URL`                 | 符合        | 手動                         |
| 20  | —          | `pnpm --filter e2e test`     | `E2E_TARGET` 未設       | 預設／兩個非預設埠                         | 只跑 dev-health，exit 0，自起並關閉伺服器                | 符合        | 手動                         |
| 21  | —          | 標頭比對腳本                 | 無                      | 沒給 base URL／未知 flag／沒人監聽／不回應 | exit 2                                                   | 符合        | `T:hdr`                      |
| 22  | —          | `ci-changed-paths`           | base 為空／全 0／不存在 | 邊界                                       | `compose=true` 並說明原因                                | 符合        | 手動（E5）、`T:paths`        |
| 23  | —          | `ci-changed-paths`           | 各觸發路徑              | 標頭驗證檔、e2e 設定與共用、其他 e2e、docs | 前三者 `true`，後兩者 `false`                            | 符合        | 手動（E5）、`T:paths`        |

### Hard Rule 必驗項

| 規則               | 怎麼驗的                                                                                                                                                                                                                                                                                                                                   | 結果 |
| :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 5 任務設定驅動     | 本 change 只動 `frontend/nginx.conf`、`frontend/Dockerfile` 註解、`scripts/`、`e2e/` 設定與旅程、CI 與文件，`backend/`、`frontend/src/` 無任何改動（`git diff --stat origin/main...HEAD -- frontend/src` 為空）。標頭在 server 層級，對每條路徑一致（六類回應驗過）。目前沒有任務類型可換 `input_type` 加 `outputs[]` 的組合，該檢查不適用 | 通過 |
| 6 測試集答案不外露 | 尚無標記員身分與任務端點。以標記員可能帶的憑證（`Cookie`、`Authorization: Bearer`）打公開入口可到的每一類回應（頁面殼、前端路由、建置資源、health、後端 404、Nginx 405、後端停止時的 502）：標頭值與不帶憑證時逐字元相同，七個標頭只有固定字串，憑證值 0 命中；後端 404 body 與直連後端相同，Nginx 沒有加入任何內容。標頭不帶任何資料      | 通過 |

### DoD

| 項目                                                | 指令與結果                                                                                                                                                                                  | 結果   |
| :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----- |
| 每個 Scenario 驗證通過                              | security-headers 10 條、ci-quality-gates 21 條、e2e-testing 10 條，全部通過                                                                                                                 | 通過   |
| Decision Table 都有對應驗證                         | 23 列，全部以真實回應、真實指令或自動化測試驗過                                                                                                                                             | 通過   |
| Lite 層（SQLite）起服務與標頭                       | `L`：`up --build --wait` healthy；`CHK` exit 0；`DOWN` exit 0（502）                                                                                                                        | 通過   |
| 正式層（PostgreSQL）起服務、標頭與瀏覽器檢查        | `P`：`up --build --wait` healthy；`CHK` exit 0；`E2E` exit 0（`1 passed`，無 `[WebServer]`）；`DOWN` exit 0（502）                                                                          | 通過   |
| `pnpm test:scripts`                                 | exit 0，`# tests 510 / # pass 510 / # fail 0`                                                                                                                                               | 通過   |
| bash 3.2 相容                                       | `/bin/bash --version` = `3.2.57`；`CHECK_HEADERS_BASH=/bin/bash node --test scripts/tests/check-security-headers.test.mjs` 21／21；`bash -n scripts/check-security-headers.sh` 無輸出       | 通過   |
| e2e 型別與靜態檢查                                  | `pnpm --filter e2e exec tsc --noEmit` exit 0；`pnpm --filter e2e test:static` 12／12                                                                                                        | 通過   |
| 根目錄 `e2e/` Playwright                            | 預設模式 exit 0（`1 passed`）；替代埠 exit 0；compose 模式 exit 0                                                                                                                           | 通過   |
| `pnpm --filter frontend lint`                       | exit 0（`eslint . --max-warnings 0`）                                                                                                                                                       | 通過   |
| `pnpm --filter frontend typecheck`                  | exit 0（`tsc -b`）                                                                                                                                                                          | 通過   |
| `pnpm --filter frontend test`                       | 連跑四次：第 1 次 `1 failed, 329 passed`（`router.lazy-i18n.test.tsx`，見下方觀察），其後三次都 `37 passed (37)`、`330 passed (330)`；CI `frontend` job 兩個 run 都 success                 | 通過   |
| `pnpm --filter frontend build`                      | exit 0（`✓ built`）                                                                                                                                                                         | 通過   |
| 前端契約漂移                                        | `pnpm --filter frontend api:generate` 後 `git diff --exit-code -- frontend/src/api/generated` 與 `git status --porcelain` 皆空                                                              | 通過   |
| 後端 pytest、Alembic 雙層、`openapi.json` 重新匯出  | 本 change 沒有動 `backend/`、沒有 schema 與 API 異動（`api-contract.md`）；CI `backend-sqlite`、`backend-postgres`、`api-contract` job 兩個 run 都 success                                  | 不適用 |
| `pnpm check:specs`                                  | `check-specs: docs OK`                                                                                                                                                                      | 通過   |
| `node scripts/check-citations.mjs --strict`         | exit 0，`0 errors`、`0 unverified`                                                                                                                                                          | 通過   |
| Prettier                                            | 本分支改到的檔案（排除 `.sh`、`nginx.conf`、`Dockerfile`）`All matched files use Prettier code style!`                                                                                      | 通過   |
| `openspec validate nginx-security-headers --strict` | `Change 'nginx-security-headers' is valid`                                                                                                                                                  | 通過   |
| 文件站建置                                          | 依 tasks.md 不在 worktree 執行 NoteCraft build；CI `docs-site` job 兩個 run 都 success                                                                                                      | 通過   |
| 文件同步                                            | `grep -n "Nginx 與安全標頭" docs/diagrams/architecture/backend-modules.mdx` 無輸出；CSP 的值只出現在 `frontend/nginx.conf` 與 `scripts/check-security-headers.sh`（`e2e/`、`docs/` 0 命中） | 通過   |
| PR #659 CI                                          | run 45605202454（HEAD `2b057ed`）15 個 job 全部 success，`compose` 有執行且兩層標頭、兩次 `--backend-down`、一次瀏覽器檢查都通過                                                            | 通過   |

**觀察（不在本 change 的路徑上，不是本 change 的缺陷）**：`frontend/src/app/router.lazy-i18n.test.tsx`「has no systemHealth text until the lazy health route has loaded」第一次執行以 1094 ms 找不到 `role="heading"` 失敗，連續重跑三次都通過；本分支沒有改 `frontend/src/` 與前端依賴。看起來是等待時間接近 Testing Library 預設 1000 ms 的不穩定測試，交主 session 決定是否折進既有 issue。

### 人工驗收步驟（留作紀錄）

本 change 沒有畫面，**不需要登入任何角色**。所有指令在 repo 根目錄執行；`-p issue568` 與 `FRONTEND_PORT=18568` 只是避免佔用 8080 與其他 project，正式部署用預設即可。

1. **啟動 Lite 層**（**不設** `DATABASE_URL`，後端用容器內的 SQLite）：

   ```bash
   cp .env.example .env
   FRONTEND_PORT=18568 docker compose -p issue568 up --build --wait --wait-timeout 300
   ```

   公開入口是 `http://localhost:18568`（前端與 `/api/v1/` 都從這裡進）；後端在容器內的 8000，**不發布到主機**，主機上沒有後端網址。注意 `--build` 會覆寫本機 `label-suite-*:latest` 映像；不想覆寫時另寫一份 override 檔把三個服務的 `image:` 改成別的標籤，加 `-f docker-compose.yml -f <override>`。

2. **用什麼身分登入**：不登入。專案還沒有認證，標頭也與身分無關。

3. **要打哪些請求、開哪些畫面**：

   ```bash
   curl -sD - -o /dev/null http://localhost:18568/
   curl -si http://localhost:18568/api/v1/does-not-exist
   curl -sD - -o /dev/null -X POST http://localhost:18568/
   scripts/check-security-headers.sh http://localhost:18568; echo "exit=$?"
   ```

   再用瀏覽器開 `http://localhost:18568/`，打開開發者工具的 Console 與 Network 後重新整理。

4. **每一步預期看到什麼**：
   - `GET /` 回 `200`，標頭恰好有這七個且值相同，各出現一次：
     `Server: nginx`（沒有斜線與版本號）、`X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN`、`Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self'; frame-ancestors 'self'`、`Referrer-Policy: strict-origin-when-cross-origin`、`Cross-Origin-Opener-Policy: same-origin`、`Permissions-Policy: camera=(), microphone=(), geolocation=()`。**沒有** `Strict-Transport-Security`，**沒有** `Content-Security-Policy-Report-Only`。
   - `does-not-exist` 回 `404`，同樣七個標頭，body 是後端的錯誤外層 `{"success":false,"code":"NOT_FOUND","message":"找不到指定的資源","data":null,…,"errors":null}`，不是 Nginx 的 HTML 錯誤頁。
   - `POST /` 回 `405 Not Allowed`（Nginx 自己產生），同樣七個標頭。
   - 腳本印出 `Security headers match at http://localhost:18568 (8 responses checked).`，`exit=0`。
   - 瀏覽器：Console 沒有任何 `Content Security Policy` 違規訊息或紅字；Network 每個請求（`/`、`/assets/*.js`、`/assets/*.css`）都是 `200`，沒有紅色失敗列。

5. **刻意要試的失敗路徑**：
   - 停掉後端：`docker compose -p issue568 stop backend`，再 `curl -sD - http://localhost:18568/api/v1/health`。預期 `502 Bad Gateway` 或 `504 Gateway Time-out`（504 要等約 60 秒才回，不是卡住），**仍帶同一組七個標頭**、沒有 HSTS；`scripts/check-security-headers.sh --backend-down http://localhost:18568` 印 `(1 responses checked)` 並 `exit=0`。
   - 帶任意憑證：`curl -sD - -o /dev/null -H 'Cookie: session=x' -H 'Authorization: Bearer y' http://localhost:18568/`，七個標頭與第 3 步完全相同，且標頭裡找不到 `x`、`y` 的值。
   - 不設位址跑容器模式：`E2E_TARGET=compose pnpm --filter e2e test`，預期在跑任何旅程前失敗，訊息 `E2E_BASE_URL must be set to the public entry point …`。
   - 收掉 Lite 層（`FRONTEND_PORT=18568 docker compose -p issue568 down -v`）後起**正式層**再重複第 3、4 步與停後端那一步：

     ```bash
     export POSTGRES_PASSWORD=$(openssl rand -hex 16)
     FRONTEND_PORT=18568 docker compose -p issue568 -f docker-compose.prod.yml up --build --wait --wait-timeout 300
     scripts/check-security-headers.sh http://localhost:18568; echo "exit=$?"
     E2E_TARGET=compose E2E_BASE_URL=http://localhost:18568 pnpm --filter e2e test
     ```

     瀏覽器檢查預期 `1 passed`、輸出沒有 `[WebServer]`（沒有自起開發伺服器）。同一個 shell 內 `up`、`stop`、`down` 要用同一個 `POSTGRES_PASSWORD`。

   - 想親眼看檢查器會擋：暫時把 `frontend/nginx.conf` 的 `X-Frame-Options` 改成 `DENY` 並 `up --build`，腳本 `exit=1` 且每一類都印 `expected "SAMEORIGIN", got "DENY"`；看完 `git restore frontend/nginx.conf` 再重建。

6. **收尾**：

   ```bash
   FRONTEND_PORT=18568 docker compose -p issue568 -f docker-compose.prod.yml down -v   # 正式層；Lite 層去掉 -f
   rm .env
   ```

   `-v` 會刪掉這個 project 的資料 volume（`issue568_label-suite-data` 或 `issue568_pg-data`），只用於驗收用的 project。用了 override 標籤時再 `docker rmi` 那兩個映像。

### 缺陷

無。
