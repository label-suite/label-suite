# Tasks

依相依順序排列：相依套件與設定 → 資料表與遷移 → 後端共用認證元件 → account 模組與端點 → 後端文件 → 前端基礎 → 前端頁面 → e2e 旅程 → 覆蓋率門檻與規則文件。每個群組單獨提交後都能 build 並通過自己的測試；需要端點才能驗證的 Scenario 放在端點建好的群組 4。測試與實作在同一個 task（TDD，architecture §測試分層）；後端與前端以 `uv`、`pnpm` 安裝，不用 `pip install` 或 `npm install`。行為以 `specs/` 為準，做法以 `design.md`、`system-design.md` 為準，前後端交接以 `api-contract.md` 為準。

契約漂移檢查指令（`openspec/config.yaml`，在 repo 根目錄執行）：

- 後端：`cd backend && uv run python -m app.scripts.export_openapi && git diff --exit-code -- openapi.json ../docs/diagrams/architecture/api.openapi.json && test -z "$(git status --porcelain -- openapi.json ../docs/diagrams/architecture/api.openapi.json)"`
- 前端：`pnpm --filter frontend api:generate && git diff --exit-code -- frontend/src/api/generated && test -z "$(git status --porcelain -- frontend/src/api/generated)"`

## 1. 相依套件與執行期設定

- [ ] 1.1 以 `uv add pyjwt argon2-cffi authlib httpx` 加入執行期相依（`httpx` 由 `dev` 群組移到執行期，`authlib.integrations.httpx_client` 需要它；移除 `dev` 群組重複的那一行）；在 `backend/tests/unit/test_dependency_classification.py` 把 `jwt`、`argon2` 歸為一般套件，`authlib` 維持 OIDC 入口的套件、`httpx` 維持對外 HTTP 入口的套件，並加一個測試證明 `app/oidc/` 不直接 import `httpx`；在 `backend/tests/unit/import_tree.py` 的 `ENTRY_TOP_LEVEL_PACKAGES` 登記 `oidc`；建立只有 `__init__.py` 的 `backend/app/oidc/` 套件；驗證：`uv run pytest tests/unit/test_dependency_classification.py tests/unit/test_entry_contracts.py` 與 `uv run lint-imports` 通過，`specs/backend-code-boundaries` 兩條 MODIFIED 的 Scenario 成立（system-design T7、design D5） [@backend-developer]
- [ ] 1.2 在 `app/core/config.py` 加 `AUTH_SECRET`、三個 `GOOGLE_*`、`RESEND_API_KEY` 與 `google_configured()`、`mail_configured()`，空字串一律當成沒設、`GOOGLE_*` 只設一部分時拒絕啟動；新增 `app/core/auth_secret.py` 的 `resolve_auth_secret`（正式層必填、至少 32 字元、Lite 層讀或產生 `SQLITE_PATH` 同目錄的 `auth_secret`、權限 `0600`、多 worker 只產生一把、log 不印值），由 `create_app` 呼叫；以 unit 與 integration 測試先寫 `specs/runtime-config` 中不需端點的 Scenario：MODIFIED「其餘設定都有預設值」全部、「正式層沒設 AUTH_SECRET 時拒絕啟動」「AUTH_SECRET 太短時拒絕啟動」「只設一部分時拒絕啟動」，以及「Lite 層沒設時自動產生並重用」中檔案存在、權限 `0600`、兩次啟動讀到同一把且 log 不含內容的部分；驗證：`uv run pytest` 在 SQLite 與 PostgreSQL 兩輪都通過（system-design §`AUTH_SECRET` 的來源、design D4） [@backend-developer]
- [ ] 1.3 更新 `.env.example`（`AUTH_SECRET` 留空並註明 Lite 可不設、正式層必填且至少 32 字元；`GOOGLE_*`、`RESEND_API_KEY` 留空並附用途）、`docker-compose.yml`（以 `${VAR:-}` 傳入五個設定）、`docker-compose.prod.yml`（`AUTH_SECRET: ${AUTH_SECRET:?...}`）；驗證：`specs/container-runtime` 的 MODIFIED、「正式層編排缺 AUTH_SECRET 時拒絕啟動」與「秘密不在容器環境變數」成立，`docker compose -f docker-compose.prod.yml config --quiet` 在 `AUTH_SECRET` 留空時非 0 結束且輸出含 `AUTH_SECRET`（design D4） [@backend-developer]
- [ ] 1.4 確認本群組沒有改變任何端點：重新匯出 `openapi.json` 與重新產生前端型別後，前後端兩條契約漂移檢查指令都以 0 結束 [@backend-developer]

## 2. 帳號組的資料表與遷移

- [ ] 2.1 在 `app/modules/account/models.py` 建 `User`、`AccountSession`、`AccountRefreshToken`，`app/core/db.py` 加 `UtcDateTime`；新增一個 Alembic revision（`down_revision` 為 `0dfb129ee036`）依序建 `users`、`account_session`、`account_refresh_token`，down 反序刪除，不寫入任何帳號；先寫 `specs/database-migration` 的 MODIFIED 與 ADDED Scenario 為 integration 測試，驗證：以 `TEST_DATABASE_URL` 指向 PostgreSQL 與不設（SQLite）各跑一輪 `uv run pytest -m integration`，升到最新、降回基準、再升到最新、約束名稱一致與 Seeder 部分唯一索引都通過（system-design §資料模型異動、design D9） [@dba]
- [ ] 2.2 依實作校正 `docs/diagrams/architecture/data-table-dictionary.mdx` 與 `database-schema.er.json`，為 `users`、`account_session`、`account_refresh_token` 標記已落地與 Alembic revision；驗證：`pnpm check:er` 通過 [@dba]
- [ ] 2.3 確認本群組沒有改變任何端點：前後端兩條契約漂移檢查指令都以 0 結束 [@dba]

## 3. 後端共用的認證與 CSRF 元件

- [ ] 3.1 新增 `app/core/tokens.py`（`AccessTokenCodec`、不透明 token 與雜湊、由 `AUTH_SECRET` 以用途標籤衍生三把金鑰）、`app/core/passwords.py`（argon2id、驗證在執行緒、帳號不存在時跑假驗證）、`app/core/email_identity.py`（NFKC 加 casefold、254 字上限）、`app/core/cookies.py`（`SessionCookies`，四個 `__Host-` cookie 的屬性照 `api-contract.md` §共用約定）；以 unit 測試先寫 cookie 屬性、Email 正規化與長度、密碼雜湊與假驗證的判定，驗證：`uv run pytest tests/unit` 通過（system-design T6） [@backend-developer]
- [ ] 3.2 新增 `app/core/auth.py`：`Principal`、`PrincipalLoader` Protocol、`get_current_principal`（授權第 1、2 步，只讀 `__Host-ls_at`、不讀 `Authorization`、任何不成立都丟同一個 `AuthenticationRequiredError`），在錯誤對照加 `401 AUTH_REQUIRED`，並在 `app/i18n/zh-TW/messages.json` 與 `app/i18n/en/messages.json` 加 `common.auth_required` 一鍵（不透露原因）；以 unit 測試先寫各種不成立的情況都得到同一個錯誤、錯誤對到 `401 AUTH_REQUIRED`，驗證：`uv run pytest tests/unit` 通過，兩份 `messages.json` 鍵集一致（system-design §權限檢查點、design D7） [@backend-developer]
- [ ] 3.3 新增 `app/core/csrf.py` 的 `CsrfMiddleware`（只在帶 `__Host-ls_at` 的寫入請求上驗證、四條放行清單寫死、在路由之前回 `403 CSRF_FAILED`），掛在 `LocaleMiddleware` 內側，CORS 允許標頭加 `X-CSRF-Token`，兩份 `messages.json` 加 `common.csrf_failed`；以 integration 測試（以 3.1 的 `AccessTokenCodec` 產生 access token，對既有的 `/api/v1/health` 送寫入請求）先寫 `specs/csrf-protection` 的「沒帶 CSRF 標頭的寫入被擋下」「CSRF 標頭與 cookie 不符被擋下」「CSRF 相符的寫入交給路由處理」「未登入的寫入照常路由」與「只有允許的來源能送出 CSRF 標頭」兩條，驗證：兩種資料庫的 `uv run pytest -m integration` 通過，主規格 `api-envelope`「不支援的方法回 405 錯誤外層」仍通過（design D3、system-design T2） [@backend-developer]
- [ ] 3.4 確認本群組沒有新增端點：前後端兩條契約漂移檢查指令都以 0 結束 [@backend-developer]

## 4. account 模組、七個端點與 Seeder 初始化指令

- [ ] 4.1 新增 `UserRepository`、`AccountSessionRepository`、`RefreshTokenRepository` 與 `SessionService`、`SessionPolicy`（90 天、7 天、寬限 30 秒、條件式消耗、寬限內第二次重發一次、第三次 `409`、寬限外全部撤銷、已失效的沒有寬限資格、登出與自然到期的紀錄差別）以及實作 `PrincipalLoader` 的 `AccountPrincipalLoader`，由 `app.main` 放進 `app.state`；先寫 `specs/login-session` 中期限、多分頁、疑似盜用、登出紀錄的判定為 unit 測試，驗證：`uv run pytest tests/unit` 通過（system-design §登入狀態與 refresh token 的狀態、§交易邊界與 session 生命週期、design D2） [@backend-developer]
- [ ] 4.2 新增 `PasswordLoginService`、`LoginOptionsService` 與 `getAuthOptions`、`createSession`、`getCurrentSession`、`createSessionRefresh`、`deleteCurrentSession` 五個端點（路徑、狀態碼、`204` 例外與錯誤碼照 `api-contract.md`；沒有 refresh cookie 的延續回 `401 AUTH_REQUIRED`），在 `app/core/openapi.py` 的 `_IRREGULAR_SINGULARS` 加 `"options": "options"` 讓 `auth-options` 算出 `getAuthOptions`，兩份 `messages.json` 加 `account.invalid_credentials`、`account.session_expired`、`account.session_invalid`、`account.refresh_conflict`（中英文照 design D7 的對照表）；以 integration 測試先寫 `specs/account-login`（登入頁設定、欄位驗證、Email 與密碼的成功與失敗）、`specs/login-session`、`specs/auth-guard`（後端部分）、`specs/api-envelope` 全部 Scenario、`specs/csrf-protection`「讀取請求不驗 CSRF」與「四個登入相關的寫入端點放行」、`specs/runtime-config`「Lite 層沒設時自動產生並重用」中登入狀態跨重啟仍有效的部分、「刪掉產生的秘密後所有登入狀態失效」「三個都不設時沒有 Google」與「寄信服務只看有沒有設定」，驗證：兩種資料庫的 `uv run pytest -m integration` 通過，`uv run pytest tests/unit/test_openapi.py` 確認 operationId 為 `getAuthOptions`，兩份 `messages.json` 鍵集一致 [@backend-developer]
- [ ] 4.3 在 `app/oidc/google.py` 實作 `GoogleOidcClient`（只 import `authlib`；PKCE S256、`state`、`nonce`、驗 `id_token`），新增 `GoogleLoginService` 與 `getGoogleAuthorization`、`createGoogleSession` 兩個端點（已連結優先；Email 已驗證且同 Email 帳號啟用中、未匿名化才自動連結，並在同一交易清密碼、加 `credential_version`、撤銷全部登入狀態；停用、已匿名化、沒有對應帳號、Email 未驗證都回 `ACCOUNT_GOOGLE_REJECTED`；不建立帳號），兩份 `messages.json` 加 `account.google_rejected`、`account.google_flow_invalid`、`account.google_unavailable`；不建 `FakeGoogleOidcClient`，測試在 `backend/tests/support/google_oidc.py` 以 `monkeypatch` 替換 `httpx.AsyncClient.send` 回應假的 token 端點與 JWKS；以 integration 測試先寫 `specs/account-login` 的 Google 四條 Requirement（含「停用的同 Email 帳號不會被自動連結」），驗證：兩種資料庫的 `uv run pytest -m integration` 與測試替身邊界檢查都通過（design D5、system-design T1、ADR-004 D5） [@backend-developer]
- [ ] 4.4 新增 `app/scripts/create_seeder.py` 與 `SeederService`（`--email`、`--name`、`--password-stdin`；不收密碼參數或環境變數；冪等；既有一般帳號或另一位 Seeder 時退出碼 2；同一交易寫入；輸出不含密碼或雜湊）；以 integration 測試在兩種資料庫驗證規格 06-01 的「部署者建立第一位 Seeder 管理員」「重複執行初始化」「以既有帳號執行初始化」與主規格 `user-management`「Seeder 管理員只能由初始化指令建立」，以及 `specs/auth-guard`「Seeder 管理員的角色是系統管理員」，驗證：兩輪 `uv run pytest -m integration` 通過（system-design §Seeder 初始化指令、design D6） [@backend-developer]
- [ ] 4.5 在容器編排驗證加上 `specs/container-runtime`「重啟後登入狀態仍有效」：Lite 編排以範例檔起服務、以初始化指令建立帳號並經公開入口登入，`docker compose down`（不帶 `-v`）再起，原 cookie 送出 `GET /api/v1/current-session` 回覆 `200`；驗證：CI 的容器編排驗證 job 通過 [@backend-developer]
- [ ] 4.6 重新匯出 `openapi.json`（含 `docs/diagrams/architecture/api.openapi.json`）並重新產生前端型別，提交產物，確認七個 operationId、路徑、request 與 response 欄位、`204` 例外都與 `api-contract.md` 一致；驗證：提交後前後端兩條契約漂移檢查指令都以 0 結束 [@backend-developer]

## 5. 後端文件（可平行）

- [ ] 5.1 在 `docs/development/workflow/local-development.mdx` 的 §用 Docker Compose 起整套 與 §前後端分開起 各加一步「建立第一位系統管理員」（兩種執行方式各一行指令，說明密碼會被詢問兩次且不顯示），§環境變數 補 `AUTH_SECRET` 兩層差別、`GOOGLE_*`、`RESEND_API_KEY`；驗證：照文件在乾淨的 clone 以兩種方式各執行一次，再以 `curl` 對 `POST /api/v1/sessions` 送出該帳號的 Email 與密碼，回覆 `201` 且 `data.user.role` 為 `super_admin` [@technical-writer]
- [ ] 5.2 把 `backend-modules.mdx`、`error-codes.mdx`、`endpoint-authorization.mdx` 中本 change 的規劃內容依實作校正並併進主表；驗證：三份文件列出的端點、operationId 與錯誤碼和 4.6 提交的 `openapi.json` 一致，`pnpm check` 通過 [@technical-writer]
- [ ] 5.3 更新 ADR-004：D3 補一句「還沒有登入狀態之前的請求（Email 與密碼登入、Google 登入完成）由只收 `application/json` 加上 CORS 預檢擋下跨站送出，CSRF token 只驗帶登入 cookie 的寫入」；D4 把「沒設定時按鈕退回 no-op」改成「沒設定時登入頁不顯示 Google 按鈕與『或』分隔線」並連到規格 01-01 §已確認決議 Q10；兩處都在變更紀錄記一列指向 #719；驗證：ADR-004 D3、D4 的文字與 `design.md` D3、`specs/account-login`「登入頁依部署能力顯示入口」一致，`pnpm check` 通過 [@technical-writer]

## 6. 前端基礎：唯一出口、介面語言與共用原語

- [ ] 6.1 在 `frontend/src/api/mutator.ts` 加寫入請求的 `X-CSRF-Token`，新增 `frontend/src/api/session-refresh.ts`（single-flight 延續、只在 `401 AUTH_REQUIRED` 觸發、延續成功重送一次、`409 ACCOUNT_REFRESH_CONFLICT` 等候後重送一次、重送仍 `401 AUTH_REQUIRED` 時再延續一次並在成功後再重送一次、延續至多 2 次、延續請求本身不再觸發）；以 Vitest 加 MSW 先寫 `specs/frontend-api-client` 全部 Scenario，驗證：`pnpm --filter frontend test` 通過（design D7） [@frontend-developer]
- [ ] 6.2 改寫介面語言的決定方式：讀寫 `localStorage` 的 `labelsuite.lang`、無效或讀不到時 `zh-TW`、移除依瀏覽器語言決定的程式、切換時更新 `<html lang>`；新增 `auth` 語言檔，含 design D7 對照表的五個錯誤鍵（`ACCOUNT_INVALID_CREDENTIALS` 的英文為 `Invalid email or password`）與 design D12 的落點文案，中英鍵集一致；先寫 `specs/frontend-i18n` 的 ADDED 與 MODIFIED Scenario 為測試，驗證：`pnpm --filter frontend test` 通過，主規格 `dev-health-page`「健康檢查頁以英文介面顯示」仍通過（design D8） [@frontend-developer]
- [ ] 6.3 以 shadcn/ui 新增 `label`、`separator` 原語，`badge` 加 `role` 變體（token 照 `ui-design.md` §元件與 design token），元件展示頁加 Label、Separator 兩個區塊並更新 Badge 區塊；驗證：`specs/component-gallery` 兩條 MODIFIED 的 Scenario 與完整性測試通過，`pnpm --filter frontend test` 通過 [@frontend-developer]

## 7. 前端頁面與守門

- [ ] 7.1 新增「目前的登入狀態」查詢 hook 與兩種路由包裝（需要登入、只給未登入的人）、`/` 的導向，以及 `"*"` 路由以取代歷史紀錄的方式導向 `/`；守門查詢連不上或 `5xx` 當成未登入並帶「沒有回應」那一句，延續回 `401 AUTH_REQUIRED` 時回登入頁不帶任何句子；移除開發模式 `/` 與未知路徑導向 `/dev/health` 的路由；先寫 `specs/auth-guard` 畫面端的 Requirement 與 `specs/frontend-routing` 的 ADDED Scenario 為測試，驗證：`pnpm --filter frontend test` 與正式建置後的產物搜尋測試通過（ui-design §頁面與路由、§元件樹 › 守門） [@frontend-developer]
- [ ] 7.2 新增登入頁 `/account/login`（`AuthLayout`、`AuthNavbar`、`LanguageToggle`、`AuthCard`、`LoginForm`、`PasswordInput`、`GoogleSignInButton`、錯誤橫幅；橫幅文字依 `code` 取 `auth` 語言檔），版面與文案照 prototype 與 `ui-design.md` §元件樹 › 登入頁；以 Vitest 加 RTL 加 MSW 先寫 `specs/account-login` 畫面端的 Requirement（入口、必填、失敗、送出中整頁凍結、沒有回應、密碼切換、語言切換、三種寬度）與 `specs/login-session`「被動登出時顯示對應的一句」，驗證：`pnpm --filter frontend test` 通過（design D7） [@frontend-developer]
- [ ] 7.3 新增 Google 回調 `/account/google/callback`（同一組 `code`、`state` 只送一次；`error` 不呼叫後端；E1 安靜回登入頁；E2 帶旗標顯示 Google 那一句；沒有回應帶「沒有回應」那一句；回調網址不留在歷史紀錄）；先寫 `specs/account-login`「Google 驗證沒通過時安靜回到登入頁」「Google 登入被拒一律同一句」的畫面端 Scenario 為測試，驗證：`pnpm --filter frontend test` 通過（ui-design §元件樹 › Google 回調） [@frontend-developer]
- [ ] 7.4 新增暫時落點 `/dashboard/dashboard`（`SignedInCard`、角色 Badge、`LogoutButton`；登出不論結果都清掉登入狀態查詢並回登入頁）與瀏覽器標題；先寫 `specs/auth-guard`「暫時落點顯示目前登入者並提供登出」、`specs/login-session`「從這一台登出」的畫面端 Scenario 與 `specs/frontend-routing` MODIFIED「每頁設定瀏覽器標題」為測試，驗證：`pnpm --filter frontend test` 通過，畫面與維護者核准的 artifact 相符（Issue #719 落點確認） [@frontend-developer]
- [ ] 7.5 依實作把 `docs/diagrams/architecture/frontend-routes.mdx` 的「規劃中：login-auth-guard（#719）」與「規劃中的骨架異動」兩個摺疊區塊併進主表與 §前端骨架；驗證：文件列出的路由、頁面元件與 operationId 和 `frontend/src/app/router.tsx` 一致 [@technical-writer]

## 8. e2e 旅程

- [ ] 8.1 新增 `e2e/account/login.spec.ts` 與 Playwright setup project：後端在每次執行清空後的新 SQLite 檔上起好後，setup 先確認沒有任何帳號，再以 `create_seeder --password-stdin` 建立帳號；Email 與密碼在執行期以亂數產生、只存在 Playwright 輸出目錄；旅程照 `specs/e2e-testing`「登入到落點再登出的旅程」；驗證：連續執行兩次 `pnpm --filter e2e test` 都通過，`pnpm --filter e2e test:static` 通過，`e2e/shared/fixtures/` 下沒有新增密碼（design D11） [@frontend-developer]

## 9. 關鍵路徑覆蓋率門檻與規則文件

- [ ] 9.1 新增 repo 根的 `critical-coverage.json`（只有 `authentication`、`authorization` 兩項，後端與前端檔案照 design D10）與 `scripts/check-critical-coverage.mjs`，加進 CI 的 `coverage` job；先在 `scripts/tests/` 寫 `specs/ci-quality-gates`「認證與授權的關鍵路徑分支覆蓋率門檻」四條 Scenario 的測試，驗證：CI 輔助腳本測試通過，本 PR 的 `coverage` job 綠燈，兩項兩層都不低於 90.0%（design D10） [@backend-developer]
- [ ] 9.2 更新 `docs/development/rules/testing-agent-rules.mdx` T10 的「尚未檢查」那一列與檢查方式，寫明「認證」「授權與權限檢查」兩項已由 #719 建立並指向 `critical-coverage.json` 與 `scripts/check-critical-coverage.mjs`，其餘三項仍未建、屬 #111；同步 T9 開頭那段的已建清單；驗證：文件與 CI 的 job 名稱、指令一致 [@technical-writer]
- [ ] 9.3 改寫 Issue #111 本文 §2b 第二項：「認證」「授權與權限檢查」兩項的 90% 分支門檻已由 #719 建立，答案隔離、評分、IAA 三項仍留在 #111；以 `gh issue edit 111` 更新並在 #111 留言附 PR 連結；驗證：`gh issue view 111` 的本文含上述改寫 [@technical-writer]
- [ ] 9.4 在 `docs/development/architecture.mdx` §部署與維運 與 Lite Quick Start 加上：正式層 `AUTH_SECRET` 必填、Lite 自動產生並存在資料 volume、刪 volume 等於全部登出；`__Host-` 與 `Secure` cookie 只在 HTTPS 或 `localhost` 有效；部署後執行一次 Seeder 初始化指令；開 Google 時三個 `GOOGLE_*` 一起設與 `GOOGLE_REDIRECT_URI` 的值；驗證：照文件以 Lite 編排起服務、建立第一位系統管理員並登入成功（system-design T9、design §Migration Plan） [@technical-writer]

## Workflow follow-up

- tasks 定稿後先提交規劃產出物，交 `design-reviewer` 審閱；修訂由 `planner` 另開 commit
- `acceptance.md` 逐條對照規格 01-01、01-05 的驗收標準，標明登入失敗鎖定（#726）與以註冊頁、重設密碼頁為前提的四條 Scenario（#723、#724）不在本次
- 驗收通過後由 `ops` 執行 `/opsx:archive`，與程式同一個 PR 合併
