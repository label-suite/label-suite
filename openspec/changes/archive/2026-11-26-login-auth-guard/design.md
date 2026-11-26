# Design

本份只寫實作取捨與上游沒寫完的技術決定。分層、類別、序列圖、資料模型與權限檢查點以 `system-design.md` 為準；端點、欄位、cookie 與錯誤碼以 `api-contract.md` 為準；路由、元件樹與畫面狀態以 `ui-design.md` 為準；動機見 `proposal.md` §Why，行為見 `specs/`。各決定都依 `clarification.md` 的決議（Q1–Q16）與 §交給後續產出。

## Context

- 後端只有 `health` 模組，`core/` 沒有認證、授權或 CSRF 元件；資料庫只有基準遷移 `0dfb129ee036`，沒有任何業務表（`system-analysis.md` §現況盤點）
- 前端只有 `/dev/health`、`/dev/gallery` 兩個開發頁；介面語言依瀏覽器語言決定；唯一出口 `frontend/src/api/mutator.ts` 不重試、不重送（主規格 `frontend-api-client`）
- 測試替身的邊界由 `test-boundary-checks` 機械檢查：不得替換本專案匯入的物件、不得改寫依賴覆寫表、harness 與 production 的組裝必須一致；外部邊界只能用 `monkeypatch` 替換
- CI 的 `coverage` job 已合併兩輪後端覆蓋率並比較基準（`scripts/check-coverage.mjs`），後端已開啟分支量測（`backend/pyproject.toml` `[tool.coverage.run] branch = true`）
- 規格 01-01 Q10–Q15 與 01-05 Q19 已由 PR #742 合併進 `main`（c6b5036）；本 change 的 specs 以合併後的文字為準

## Goals / Non-Goals

**Goals:**

- 守門只做授權第 1、2 步，介面只交出 `Principal`（帳號識別、登入狀態識別、系統角色），讓 06-02 的權限矩陣與答案隔離接在後面而不改守門本身（`system-design.md` §權限檢查點）
- 每一條 spec Scenario 都能在 CI 以 unit、integration 或 e2e 其中一層自動驗證，不依賴真的 Google
- 兩種資料庫行為一致：遷移、延續的條件式消耗、時間比較

**Non-Goals:**

- 登入失敗鎖定（#726）：只保留 `system-design.md` §登入失敗鎖定的插入點，不建任何程式、碼或計數服務
- 撤銷事件本身（改密碼、換 Email、重設密碼、個人設定的連結 Google）、登入狀態紀錄的保留與每日清除（#726 與各自的頁面）
- 停用帳號時加一 `credential_version` 並撤銷所有登入狀態，以及重新啟用：屬 06-01 的 change。本次的守門只負責觀察得到的前提——帳號已停用，或 `credential_version` 與 access token 不符——就拒絕；測試以前置資料模擬這兩種狀態（`specs/auth-guard`「重新啟用不恢復舊的登入狀態」）
- e2e 各角色的 `storageState` fixture：本次只有一條登入旅程，fixture 等第一個登入後的業務頁面再建
- 規格 01-01 中以註冊頁為前提的兩條 Scenario「切換語言後到註冊頁仍是同一種語言」「從註冊頁回到登入頁仍是同一種語言」：註冊頁不存在（01-02，#723），本次以「切換後的語言跨頁沿用」（落點）驗證同一條規則，兩條原 Scenario 交給 #723 驗收；「點忘記密碼前往重設」「點前往註冊」本次只驗證前往的路徑，到達目的頁交給 #724、#723

## Decisions

### D1 分層與組裝照 system-design

照 `system-design.md` §目錄、§元件清單、§Class Diagram：`core/auth.py` 只定義 `PrincipalLoader` Protocol，`account` 模組實作，由 `app.main` 放進 `app.state`。不另寫。`service.py` 超過 B11 的 400 行時依 T11 改成套件。

### D2 憑證模型：短效 access JWT 加資料庫裡的 refresh token

照 `api-contract.md` §共用約定 Cookie 與 `system-design.md` §登入狀態與 refresh token 的狀態：access JWT 至多 15 分鐘、不越過 90 天；refresh token 不透明、資料庫只存雜湊（新表 `account_refresh_token`，N1）；寬限 30 秒（T5）。

- **為什麼不是只用一個 session id cookie**：每個請求都要查 `account_session` 與 `users`（T10 已接受），但延續、寬限與疑似盜用需要逐張 token 的消耗紀錄，只有 session id 做不出「同一次延續第三次就不給」
- **為什麼不放 Redis**：鎖定不在本次（sa-3），沒有其他需要共用計數的地方，不為延續多加一個服務（T7）

### D3 CSRF 只在帶登入 cookie 的寫入請求上驗證

維護者 2026-11-26 已確認這個範圍。

`CsrfMiddleware` 對 `POST`、`PUT`、`PATCH`、`DELETE`：請求**沒有** `__Host-ls_at` 時直接放行給路由；有時才要求 `X-CSRF-Token` 等於 `__Host-ls_csrf` 且等於 `HMAC(secret, sid)`（`sid` 取自 access JWT，只驗簽章不看到期）。放行清單照 T2 寫死四條。

- **理由**：跨站偽造借用的是瀏覽器自動帶上的登入 cookie；沒有 cookie 的請求沒有可借用的身分，需要登入的端點會由 `get_current_principal` 回 `401`
- **替代方案**：所有寫入一律驗證。這會讓匿名的 `POST /api/v1/health` 從 `405` 變成 `403`，打破主規格 `api-envelope`「不支援的方法回 405 錯誤外層」的 Scenario，也讓之後的匿名寫入端點都要進放行清單
- 這一條補上 `api-contract.md` 沒寫的「沒有 access cookie 時怎麼辦」，行為寫在 `specs/csrf-protection`「沒有登入 cookie 的寫入請求不驗 CSRF」
- 還沒有登入狀態之前的請求（Email 與密碼登入、Google 登入完成），由只收 `application/json` 加上 CORS 預檢擋住跨站送出；ADR-004 D3 補一句寫明這一點（tasks 5.3）

### D4 空字串一律當成沒設

`AUTH_SECRET`、三個 `GOOGLE_*`、`RESEND_API_KEY` 的值為空字串時，與沒設相同。理由：Compose 以 `${VAR:-}` 把沒設的變數傳成空字串，後端若把空字串當成「有設」，Lite 層就永遠不會自動產生秘密，Google 也會被判成「只設一部分」。

編排檔的寫法：

- `docker-compose.yml`（Lite）：`AUTH_SECRET: ${AUTH_SECRET:-}`、`GOOGLE_*: ${GOOGLE_*:-}`、`RESEND_API_KEY: ${RESEND_API_KEY:-}`
- `docker-compose.prod.yml`：`AUTH_SECRET: ${AUTH_SECRET:?AUTH_SECRET is required for the production tier}`，與既有的 `POSTGRES_PASSWORD` 同一種寫法，讓 `docker compose config` 在建立容器前失敗（`specs/container-runtime`）
- Lite 秘密檔的產生、權限與多 worker 競爭照 `system-design.md` §`AUTH_SECRET` 的來源；檔案放在 `SQLITE_PATH` 同目錄，容器裡就在具名 volume `label-suite-data`

### D5 Google 的測試替身設在網路邊界，不在 app 裡

`system-design.md` §目錄 把測試替身 `FakeGoogleOidcClient` 放在 `app/oidc/google.py`。本份改成：`app/oidc/` 只有正式的 `GoogleOidcClient`，測試以 `monkeypatch` 替換 `authlib` 使用的 `httpx.AsyncClient.send`，回應假的 token 端點與 JWKS，`id_token` 由測試在執行期產生的 RSA 金鑰簽章。

- **理由**：`test-boundary-checks` 禁止替換本專案匯入的物件與改寫依賴覆寫表，也要求 harness 與 production 組裝一致，所以 app 裡的替身沒有合法的方式被換進去；替身放在 production 程式裡也違反 testing-agent-rules T6「外部替身設在邊界上」
- **代價**：測試要自己組 Google 的 token 回應與 JWKS；共用的組裝放在 `backend/tests/support/google_oidc.py`
- e2e 不經 Google（`specs/e2e-testing`）；Google 的五條 Scenario 由後端 integration 與前端 integration（MSW）驗證
- `authlib` 的非同步客戶端是 `authlib.integrations.httpx_client`，執行期需要 `httpx`；它目前只在 `backend/pyproject.toml` 的 `dev` 群組，所以 tasks 1.1 以 `uv add` 把它移到執行期相依。歸類不變：`httpx` 仍是「對外 HTTP 客戶端」入口的套件（`backend/tests/unit/import_tree.py` 的 `HTTP_CLIENT`），`app/oidc/` 只 import `authlib`、MUST NOT 直接 import `httpx`（主規格 `backend-code-boundaries`「對外 HTTP 客戶端套件只能經 HTTP 入口使用」）；`httpx` 由 `authlib` 間接使用，不算違規。相依分類測試與 `uv run lint-imports` 要在 1.1 證明這兩件事

### D6 Seeder 初始化指令照 system-design

照 `system-design.md` §Seeder 初始化指令：只收 `--email`、`--name`、`--password-stdin`，密碼不收命令列參數或環境變數，冪等，退出碼 0／2。實作的既有 Requirement 是主規格 `user-management`「Seeder 管理員只能由初始化指令建立」，本 change 不修改它。integration 測試在兩種資料庫上驗證規格 06-01 的「部署者建立第一位 Seeder 管理員」「重複執行初始化」「以既有帳號執行初始化」。

### D7 前端：同一份登入狀態查詢與單一延續

照 `ui-design.md` §資料來源、§狀態放哪裡：

- 「目前的登入狀態」是一個 TanStack Query 查詢，守門兩種包裝與暫時落點共用；判定中只畫頁面底色
- 延續放在唯一出口：`frontend/src/api/session-refresh.ts` 持有同一時間唯一一個延續 promise（single-flight），`mutator.ts` 只在 `401` 且 `code` 為 `AUTH_REQUIRED` 時呼叫它，延續請求本身不再觸發延續；`409 ACCOUNT_REFRESH_CONFLICT` 等候 300 ms 後重送一次；重送仍收到 `401 AUTH_REQUIRED` 時再延續一次（不再走 `409` 的等候），成功就再重送一次，否則把錯誤交給呼叫端。整個流程延續至多 2 次、重送至多 2 次（秒數不寫進 spec，01-05 §多個分頁同時延續登入狀態 的備註）
- 上一條依規格 01-05 §多個分頁同時延續登入狀態 第 3 條「重試還是不通 → 最多再延續一次」；clarification 的 PL2 只寫了「等候後重送一次」，比規格窄，依需求依據順序以規格為準（維護者 2026-11-26 確認）
- 延續回 `401 AUTH_REQUIRED`（請求沒有 refresh cookie，本來就沒有登入狀態）時回登入頁、不帶任何句子；只有 `ACCOUNT_SESSION_EXPIRED`、`ACCOUNT_SESSION_INVALID` 帶被動登出的兩句（維護者 2026-11-26 確認）
- `X-CSRF-Token` 在 `mutator.ts` 讀 `document.cookie` 的 `__Host-ls_csrf` 後加上；`createSession` 等放行端點帶不帶都可
- 被動登出、Google E2 與「沒有回應」三種要在登入頁顯示的句子，以導覽時的路由狀態帶一個列舉值，不放網址
- 「載入中」「平台暫時沒有回應」與被動登出兩句的文案取自規格 01-01 Q13、01-05 Q19 的最終文字
- **錯誤橫幅的文字來源**：前端以錯誤外層的 `code` 對到 `auth` 語言檔的鍵，不直接顯示後端的 `message`；後端的 `messages.json` 仍為每個 `ACCOUNT_` 碼與兩個通用碼備好中英文，供 API 呼叫端與日誌使用，兩邊的字相同。對照：

  | `code`／情況                  | `auth` 鍵                        | 繁體中文                                                           | 英文                                                                                                                                  | 後端 `messages.json` 鍵       |
  | :---------------------------- | :------------------------------- | :----------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------- |
  | `ACCOUNT_INVALID_CREDENTIALS` | `login.error.invalidCredentials` | 帳號或密碼錯誤，請再試一次                                         | Invalid email or password（prototype `login.html:550`）                                                                               | `account.invalid_credentials` |
  | `ACCOUNT_GOOGLE_REJECTED`     | `login.error.googleRejected`     | 無法用這個 Google 帳號登入。需要帳號的話，請聯絡系統管理員邀請你。 | You can't sign in with this Google account. If you need an account, ask an administrator to invite you.（prototype `login.html:551`） | `account.google_rejected`     |
  | `ACCOUNT_SESSION_EXPIRED`     | `login.error.sessionExpired`     | 登入已過期，請重新登入                                             | Session expired, please sign in again                                                                                                 | `account.session_expired`     |
  | `ACCOUNT_SESSION_INVALID`     | `login.error.sessionInvalid`     | 驗證失敗，請重新登入                                               | Authentication failed, please sign in                                                                                                 | `account.session_invalid`     |
  | 沒有回應、`5xx`               | `login.error.unavailable`        | 平台暫時沒有回應，請稍後再試。                                     | The platform is not responding. Please try again later.                                                                               | —（通用碼沿用 `common.*`）    |
  | `ACCOUNT_GOOGLE_FLOW_INVALID` | —（不顯示）                      | —                                                                  | —                                                                                                                                     | `account.google_flow_invalid` |
  | `ACCOUNT_GOOGLE_UNAVAILABLE`  | —（當成沒有回應）                | —                                                                  | —                                                                                                                                     | `account.google_unavailable`  |
  | `ACCOUNT_REFRESH_CONFLICT`    | —（不進畫面）                    | —                                                                  | —                                                                                                                                     | `account.refresh_conflict`    |
  | `AUTH_REQUIRED`               | —（不顯示）                      | —                                                                  | —                                                                                                                                     | `common.auth_required`        |
  | `CSRF_FAILED`                 | —（本次畫面不會遇到）            | —                                                                  | —                                                                                                                                     | `common.csrf_failed`          |

  後端四個不進畫面的碼與兩個通用碼的中英文句子由 tasks 3.2、4.2 依 `api-contract.md` 的觸發條件撰寫，不透露原因

### D8 介面語言的記憶

語言存在 `localStorage` 的 `labelsuite.lang`（prototype 既有的鍵，`brand.md` §設計決策）。啟動時讀它，值不是 `zh-TW` 或 `en`、讀不到（例如儲存被停用而丟例外）時用 `zh-TW`；刪掉現行依 `navigator.language` 決定的程式。切換時同時更新 i18n 實例、`<html lang>` 與 `localStorage`。

### D9 一個可逆的遷移，兩種資料庫都測

照 `system-design.md` §資料模型異動：一個 revision 依序建 `users`、`account_session`、`account_refresh_token`，down 反序刪除；約束名稱依既有命名規則。integration 測試以 `TEST_DATABASE_URL` 在 PostgreSQL 與 SQLite 各跑「升到最新、降回基準、再升到最新」、約束名稱比對與 Seeder 部分唯一索引（`specs/database-migration`）。

### D10 關鍵路徑覆蓋率門檻用一份清單檔

repo 根新增 `critical-coverage.json`，兩項各列後端與前端的檔案；新增 `scripts/check-critical-coverage.mjs`，在既有 `coverage` job 讀同一份合併後的後端 `coverage.json`（每檔 `summary.num_branches`、`covered_branches`）與前端 `coverage-summary.json`（每檔 `branches.total`、`branches.covered`），每項每層把分支數加總後算百分比，低於 90.0 失敗。不改 `check-coverage.mjs` 的「不得下降」邏輯。

| 項目                              | 後端                                                                                                                                                                                                        | 前端                                                                                                         |
| :-------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| 認證（`authentication`）          | `app/core/auth_secret.py`、`app/core/tokens.py`、`app/core/cookies.py`、`app/core/passwords.py`、`app/core/email_identity.py`、`app/modules/account/service.py`（或改成套件後的各檔）、`app/oidc/google.py` | `src/features/auth/` 下登入表單、Google 回調、登出與目前登入狀態 hook 的原始檔；`src/api/session-refresh.ts` |
| 授權與權限檢查（`authorization`） | `app/core/auth.py`、`app/core/csrf.py`                                                                                                                                                                      | `src/features/auth/` 下兩種路由包裝與根路徑導向的原始檔                                                      |

後端清單與 `system-design.md` §維護者的決定 相同，只是分成兩項；前端的具體檔名在前端群組完成時填入清單，清單列到不存在的檔案會讓檢查失敗（`specs/ci-quality-gates`）。

### D11 e2e 的帳號由初始化指令建立

`e2e/account/login.spec.ts` 用 Playwright 的 setup project：等後端起好（`webServer` 已跑完遷移）後，以 `uv run python -m app.scripts.create_seeder --email ... --name ... --password-stdin` 對同一個 SQLite 檔建立帳號。初始化指令是冪等的，而且已有另一位 Seeder 時會失敗，所以每次執行都用 Playwright 清空後的新 SQLite 檔（設定檔現有的行為）；setup 先確認資料庫裡沒有任何帳號再建立，避免沿用舊檔時以退出碼 2 中斷；密碼在 setup 執行期以亂數產生、經檔案交給旅程（放在 Playwright 輸出目錄，不在 `e2e/shared/fixtures/`）。設定檔仍是唯一讀位址環境變數的地方（主規格 `e2e-testing`）。

### D12 暫時落點的英文文案

規格沒有暫時落點的英文；依 clarification Q16（U3）由派工擬稿，維護者 2026-11-26 已核准。`auth` 語言檔的英文：`You're signed in`、`The dashboard is still being built. Once it's ready, signing in will take you straight there.`、`Sign out`，瀏覽器標題 `Label Suite — Signed In`；角色名稱用 prototype 既有的 `Platform Member`、`System Admin`。

## Risks / Trade-offs

- [`__Host-` 與 `Secure` cookie 在純 HTTP 的區網位址存不進瀏覽器] → 寫進部署文件與 Lite Quick Start：Lite 只支援經 `http://localhost` 使用，其他位址要放在 HTTPS 後面（T9）
- [前端開發伺服器 `:5173` 與後端 `:8000` 不同來源，CSRF cookie 要讓前端讀得到] → cookie 不分埠，兩者同屬 `localhost`；`credentials: include` 與允許清單已有，CORS 允許標頭加 `X-CSRF-Token`
- [守門每個請求多一次 JOIN] → ADR-004 D2 已接受；之後要快取必須維持立即撤銷（T10）
- [刪掉 Lite volume 或 `auth_secret` 會讓所有人登出] → 預期行為，寫進 `.env.example` 註解與部署文件；log 只寫來源與路徑（`system-design.md` §`AUTH_SECRET` 的來源）
- [延續衝突的等候秒數寫死在前端] → 只影響使用者感受不到的重試時機；規格只要求有界，測試以假時間驗證延續至多 2 次、重送至多 2 次
- [CSRF 在沒有 access cookie 時放行（D3）] → access cookie 過期仍會帶著（存活與 refresh token 相同），所以已登入過的瀏覽器在 7 天內的寫入都會被驗證；登入狀態徹底結束後 cookie 被清掉，那時也沒有身分可借用
- [Google 替身改在網路邊界（D5），與 `system-design.md` §目錄 的寫法不同] → 本份為準；`system-design.md` §目錄 那一行是明確問題，交 `sd` 回修，tasks 不建 `FakeGoogleOidcClient`
- [規格 01-01 的四條以註冊頁、重設密碼頁為前提的 Scenario 本次只部分驗證] → 見 Non-Goals，交給 #723、#724，在 `acceptance.md` 逐條標明

## Migration Plan

1. 合併前：CI 在兩種資料庫跑遷移的升、降、再升；容器編排驗證在 Lite 以範例檔起服務
2. 部署：
   - Lite：不需新增設定；`migrate` 服務建三張表，後端首次啟動產生 `auth_secret`；部署者執行一次 Seeder 初始化指令建立第一位系統管理員
   - 正式層：先在 `.env` 補 `AUTH_SECRET`（至少 32 字元），否則 `docker compose -f docker-compose.prod.yml config` 就失敗；其餘同 Lite
   - 要開 Google 登入時三個 `GOOGLE_*` 一起設，`GOOGLE_REDIRECT_URI` 指向 `<對外 origin>/account/google/callback`
3. 回滾：
   - 程式回到前一版即可，前一版不讀這三張表
   - 資料庫降回 `0dfb129ee036` 會刪掉三張表與其中所有帳號；已有真實帳號的部署不降版，只回滾程式（`system-design.md` §資料模型異動）
   - Lite 的 `auth_secret` 檔留在 volume 不影響前一版
