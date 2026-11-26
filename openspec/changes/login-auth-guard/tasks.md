# Tasks

依相依順序排列：相依套件與設定 → 資料表與遷移 → 後端共用認證元件 → account 模組與端點 → 前端基礎 → 前端頁面 → e2e 旅程 → 覆蓋率門檻與規則文件。每個 task 的測試與實作同一個 task（TDD，architecture §測試分層）；後端與前端以 `uv`、`pnpm` 安裝，不用 `pip install` 或 `npm install`。行為以 `specs/` 為準，做法以 `design.md`、`system-design.md` 為準，前後端交接以 `api-contract.md` 為準。

## 1. 相依套件與執行期設定

- [ ] 1.1 以 `uv add pyjwt argon2-cffi authlib` 加入三個套件；在 `backend/tests/unit/test_dependency_classification.py` 把 `jwt`、`argon2` 歸為一般套件、`authlib` 歸為 OIDC 入口的套件，在 `backend/tests/unit/import_tree.py` 的 `ENTRY_TOP_LEVEL_PACKAGES` 登記 `oidc`；建立只有 `__init__.py` 的 `backend/app/oidc/` 套件；驗證：`uv run pytest tests/unit/test_dependency_classification.py tests/unit/test_entry_contracts.py` 與後端分層檢查通過，`specs/backend-code-boundaries` 兩條 MODIFIED 的 Scenario 成立（system-design T7、design D5） [@backend-developer]
- [ ] 1.2 在 `app/core/config.py` 加 `AUTH_SECRET`、三個 `GOOGLE_*`、`RESEND_API_KEY` 與 `google_configured()`、`mail_configured()`，空字串一律當成沒設；新增 `app/core/auth_secret.py` 的 `resolve_auth_secret`（正式層必填、Lite 層讀或產生 `SQLITE_PATH` 同目錄的 `auth_secret`、權限 `0600`、多 worker 只產生一把、log 不印值），由 `create_app` 呼叫；先寫 `specs/runtime-config` 三條 ADDED 與 MODIFIED「其餘設定都有預設值」的 Scenario 為 unit 與 integration 測試，驗證：`uv run pytest` 在 SQLite 與 PostgreSQL 兩輪都通過（system-design §`AUTH_SECRET` 的來源、design D4） [@backend-developer]
- [ ] 1.3 更新 `.env.example`（`AUTH_SECRET` 留空並註明 Lite 可不設、正式層必填且至少 32 字元；`GOOGLE_*`、`RESEND_API_KEY` 留空並附用途）、`docker-compose.yml`（以 `${VAR:-}` 傳入五個設定）、`docker-compose.prod.yml`（`AUTH_SECRET: ${AUTH_SECRET:?...}`）；驗證：`specs/container-runtime` 的 MODIFIED 與兩條 ADDED Scenario 以容器編排驗證腳本或手動指令重現成立，`docker compose -f docker-compose.prod.yml config --quiet` 在 `AUTH_SECRET` 留空時非 0 結束且輸出含 `AUTH_SECRET`（design D4） [@backend-developer]
- [ ] 1.4 重新產生 `openapi.json` 與前端型別（`pnpm run api:sync`），確認本群組沒有改變任何端點、與 `api-contract.md` 一致；驗證：`git diff --exit-code backend/openapi.json frontend/src/api/generated` 無差異 [@backend-developer]

## 2. 帳號組的資料表與遷移

- [ ] 2.1 在 `app/modules/account/models.py` 建 `User`、`AccountSession`、`AccountRefreshToken`，`app/core/db.py` 加 `UtcDateTime`；新增一個 Alembic revision（`down_revision` 為 `0dfb129ee036`）依序建 `users`、`account_session`、`account_refresh_token`，down 反序刪除，不寫入任何帳號；先寫 `specs/database-migration` 的 MODIFIED 與 ADDED Scenario 為 integration 測試，驗證：以 `TEST_DATABASE_URL` 指向 PostgreSQL 與不設（SQLite）各跑一輪 `uv run pytest -m integration`，升到最新、降回基準、再升到最新、約束名稱一致與 Seeder 部分唯一索引都通過（system-design §資料模型異動、design D9） [@dba]
- [ ] 2.2 依實作校正 `docs/diagrams/architecture/data-table-dictionary.mdx` 與 `database-schema.er.json`，為 `users`、`account_session`、`account_refresh_token` 標記已落地與 Alembic revision；驗證：`pnpm check:er` 通過 [@dba]
- [ ] 2.3 重新產生 `openapi.json` 與前端型別並確認與 `api-contract.md` 一致；驗證：`pnpm run api:sync` 後 `git diff --exit-code backend/openapi.json frontend/src/api/generated` 無差異 [@dba]

## 3. 後端共用的認證與 CSRF 元件

- [ ] 3.1 新增 `app/core/tokens.py`（`AccessTokenCodec`、不透明 token 與雜湊、由 `AUTH_SECRET` 以用途標籤衍生三把金鑰）、`app/core/passwords.py`（argon2id、驗證在執行緒、帳號不存在時跑假驗證）、`app/core/email_identity.py`（NFKC 加 casefold、254 字上限）、`app/core/cookies.py`（`SessionCookies`，四個 `__Host-` cookie 的屬性照 `api-contract.md` §共用約定）；以 unit 測試先寫 `specs/login-session`「登入憑證只放在 cookie」與 `specs/account-login`「用大寫寫自己的 Email 登入」「正規化後超過上限就拒絕」的判定邏輯，驗證：`uv run pytest tests/unit` 通過（system-design T6） [@backend-developer]
- [ ] 3.2 新增 `app/core/auth.py`：`Principal`、`PrincipalLoader` Protocol、`get_current_principal`（授權第 1、2 步，只讀 `__Host-ls_at`、不讀 `Authorization`、任何不成立都丟同一個 `AuthenticationRequiredError`），並在錯誤對照加 `401 AUTH_REQUIRED`；以 unit 測試先寫各種不成立的情況都得到同一個錯誤，驗證：`uv run pytest tests/unit` 通過，`specs/api-envelope`「錯誤碼為大寫底線格式並定義第一批通用碼」的 `AUTH_REQUIRED` 列成立（system-design §權限檢查點） [@backend-developer]
- [ ] 3.3 新增 `app/core/csrf.py` 的 `CsrfMiddleware`（只在帶 `__Host-ls_at` 的寫入請求上驗證、四條放行清單寫死、在路由之前回 `403 CSRF_FAILED`），掛在 `LocaleMiddleware` 內側，CORS 允許標頭加 `X-CSRF-Token`；先寫 `specs/csrf-protection` 全部 Scenario 與 `specs/api-envelope`「認證與 CSRF 的通用碼」為 integration 測試，驗證：兩種資料庫的 `uv run pytest -m integration` 通過，且主規格 `api-envelope`「不支援的方法回 405 錯誤外層」仍通過（design D3、system-design T2） [@backend-developer]
- [ ] 3.4 重新產生 `openapi.json` 與前端型別並確認與 `api-contract.md` 一致；驗證：`pnpm run api:sync` 後產物差異只有預期的部分，`pnpm check` 的契約漂移比對通過 [@backend-developer]

## 4. account 模組、七個端點與 Seeder 初始化指令

- [ ] 4.1 新增 `UserRepository`、`AccountSessionRepository`、`RefreshTokenRepository` 與 `SessionService`、`SessionPolicy`（90 天、7 天、寬限 30 秒、條件式消耗、寬限內第二次重發一次、第三次 `409`、寬限外全部撤銷、已失效的沒有寬限資格、登出與自然到期的紀錄差別）以及實作 `PrincipalLoader` 的 `AccountPrincipalLoader`，由 `app.main` 放進 `app.state`；先寫 `specs/login-session` 中期限、多分頁、疑似盜用、登出紀錄的判定為 unit 測試，驗證：`uv run pytest tests/unit` 通過（system-design §登入狀態與 refresh token 的狀態、§交易邊界與 session 生命週期、design D2） [@backend-developer]
- [ ] 4.2 新增 `PasswordLoginService`、`LoginOptionsService` 與 `getAuthOptions`、`createSession`、`getCurrentSession`、`createSessionRefresh`、`deleteCurrentSession` 五個端點（路徑、狀態碼、`204` 例外與錯誤碼照 `api-contract.md`），在 `app/core/openapi.py` 的 `_IRREGULAR_SINGULARS` 加 `"options": "options"` 讓 `auth-options` 算出 `getAuthOptions`；先寫 `specs/account-login`（Email 與密碼、登入頁設定、欄位驗證）、`specs/login-session`、`specs/auth-guard`（後端部分）、`specs/api-envelope`「登出的 204 沒有 body」與「模組專屬碼帶模組前綴」為 integration 測試，驗證：兩種資料庫的 `uv run pytest -m integration` 通過，`uv run pytest tests/unit/test_openapi.py` 確認 operationId 為 `getAuthOptions` [@backend-developer]
- [ ] 4.3 在 `app/oidc/google.py` 實作 `GoogleOidcClient`（`authlib`、PKCE S256、`state`、`nonce`、驗 `id_token`），新增 `GoogleLoginService` 與 `getGoogleAuthorization`、`createGoogleSession` 兩個端點（已連結優先、Email 已驗證才自動連結並在同一交易清密碼、加 `credential_version`、撤銷全部登入狀態；停用、已匿名化、沒有對應帳號、Email 未驗證都回 `ACCOUNT_GOOGLE_REJECTED`；不建立帳號）；不建 `FakeGoogleOidcClient`，測試在 `backend/tests/support/google_oidc.py` 以 `monkeypatch` 替換 `httpx.AsyncClient.send` 回應假的 token 端點與 JWKS；先寫 `specs/account-login` 的 Google 四條 Requirement 為 integration 測試，驗證：兩種資料庫的 `uv run pytest -m integration` 與測試替身邊界檢查都通過（design D5、system-design T1、ADR-004 D5） [@backend-developer]
- [ ] 4.4 新增 `app/scripts/create_seeder.py` 與 `SeederService`（`--email`、`--name`、`--password-stdin`；不收密碼參數或環境變數；冪等；既有一般帳號或另一位 Seeder 時退出碼 2；同一交易寫入；輸出不含密碼或雜湊）；以 integration 測試在兩種資料庫驗證規格 06-01 的「部署者建立第一位 Seeder 管理員」「重複執行初始化」「以既有帳號執行初始化」與主規格 `user-management`「Seeder 管理員只能由初始化指令建立」，以及 `specs/auth-guard`「Seeder 管理員的角色是系統管理員」，驗證：兩輪 `uv run pytest -m integration` 通過（system-design §Seeder 初始化指令、design D6） [@backend-developer]
- [ ] 4.5 在 `docs/development/workflow/local-development.mdx` 的 §用 Docker Compose 起整套 與 §前後端分開起 各加一步「建立第一位系統管理員」（兩種執行方式各一行指令，說明密碼會被詢問兩次且不顯示），§環境變數 補 `AUTH_SECRET` 兩層差別、`GOOGLE_*`、`RESEND_API_KEY`；驗證：照文件在乾淨的 clone 以兩種方式各執行一次，都建立帳號並能登入 [@technical-writer]
- [ ] 4.6 把 `backend-modules.mdx`、`error-codes.mdx`、`endpoint-authorization.mdx` 中本 change 的規劃內容依實作校正並併進主表；驗證：三份文件的端點、錯誤碼與 `openapi.json` 一致，`pnpm check` 通過 [@technical-writer]
- [ ] 4.7 重新產生 `openapi.json` 與前端型別並確認與 `api-contract.md` 一致：七個 operationId、路徑、request 與 response 欄位、`204` 例外都相符；驗證：`pnpm run api:sync` 後提交產物，`pnpm check` 的契約漂移比對通過 [@backend-developer]

## 5. 前端基礎：唯一出口、介面語言與共用原語

- [ ] 5.1 在 `frontend/src/api/mutator.ts` 加寫入請求的 `X-CSRF-Token`，新增 `frontend/src/api/session-refresh.ts`（single-flight 延續、只在 `401 AUTH_REQUIRED` 觸發、延續成功重送一次、`409 ACCOUNT_REFRESH_CONFLICT` 等候後重送一次、延續請求本身不再觸發）；先寫 `specs/frontend-api-client` 全部 Scenario 為 Vitest 加 MSW 測試，驗證：`pnpm --filter frontend test` 通過（design D7） [@frontend-developer]
- [ ] 5.2 改寫介面語言的決定方式：讀寫 `localStorage` 的 `labelsuite.lang`、無效或讀不到時 `zh-TW`、移除依瀏覽器語言決定的程式、切換時更新 `<html lang>`；新增 `auth` 語言檔（中英鍵集一致，文案照規格 01-01、01-05 與 design D12）；先寫 `specs/frontend-i18n` 的 ADDED 與 MODIFIED Scenario 為測試，驗證：`pnpm --filter frontend test` 通過，主規格 `dev-health-page`「健康檢查頁以英文介面顯示」仍通過（design D8） [@frontend-developer]
- [ ] 5.3 以 shadcn/ui 新增 `label`、`separator` 原語，`badge` 加 `role` 變體（token 照 `ui-design.md` §元件與 design token），元件展示頁加 Label、Separator 兩個區塊並更新 Badge 區塊；驗證：`specs/component-gallery` 兩條 MODIFIED 的 Scenario 與完整性測試通過，`pnpm --filter frontend test` 通過 [@frontend-developer]

## 6. 前端頁面與守門

- [ ] 6.1 新增「目前的登入狀態」查詢 hook 與兩種路由包裝（需要登入、只給未登入的人）、`/` 的導向，以及 `"*"` 路由以取代歷史紀錄的方式導向 `/`；守門查詢連不上或 `5xx` 當成未登入並帶「沒有回應」那一句；移除開發模式 `/` 與未知路徑導向 `/dev/health` 的路由；先寫 `specs/auth-guard` 畫面端的 Requirement 與 `specs/frontend-routing` 的 ADDED Scenario 為測試，驗證：`pnpm --filter frontend test` 與正式建置後的產物搜尋測試通過（ui-design §頁面與路由、§元件樹 › 守門） [@frontend-developer]
- [ ] 6.2 新增登入頁 `/account/login`（`AuthLayout`、`AuthNavbar`、`LanguageToggle`、`AuthCard`、`LoginForm`、`PasswordInput`、`GoogleSignInButton`、錯誤橫幅），版面與文案照 prototype 與 `ui-design.md` §元件樹 › 登入頁；先寫 `specs/account-login` 畫面端的 Requirement（入口、必填、失敗、送出中整頁凍結、沒有回應、密碼切換、語言切換、三種寬度）與 `specs/login-session`「被動登出時顯示對應的一句」為 Vitest 加 RTL 加 MSW 測試，驗證：`pnpm --filter frontend test` 通過 [@frontend-developer]
- [ ] 6.3 新增 Google 回調 `/account/google/callback`（同一組 `code`、`state` 只送一次；`error` 不呼叫後端；E1 安靜回登入頁；E2 帶旗標顯示 Google 那一句；沒有回應帶「沒有回應」那一句；回調網址不留在歷史紀錄）；先寫 `specs/account-login`「Google 驗證沒通過時安靜回到登入頁」「Google 登入被拒一律同一句」的畫面端 Scenario 為測試，驗證：`pnpm --filter frontend test` 通過（ui-design §元件樹 › Google 回調） [@frontend-developer]
- [ ] 6.4 新增暫時落點 `/dashboard/dashboard`（`SignedInCard`、角色 Badge、`LogoutButton`；登出不論結果都清掉登入狀態查詢並回登入頁）與瀏覽器標題；先寫 `specs/auth-guard`「暫時落點顯示目前登入者並提供登出」、`specs/login-session`「從這一台登出」的畫面端 Scenario 與 `specs/frontend-routing` MODIFIED「每頁設定瀏覽器標題」為測試，驗證：`pnpm --filter frontend test` 通過，畫面與維護者核准的 artifact 相符（Issue #719 落點確認） [@frontend-developer]
- [ ] 6.5 依實作把 `docs/diagrams/architecture/frontend-routes.mdx` 的「規劃中：login-auth-guard（#719）」與「規劃中的骨架異動」兩個摺疊區塊併進主表與 §前端骨架；驗證：文件列出的路由、頁面元件與 operationId 和 `frontend/src/app/router.tsx` 一致 [@technical-writer]

## 7. e2e 旅程

- [ ] 7.1 新增 `e2e/account/login.spec.ts` 與 Playwright setup project：後端起好後以 `create_seeder --password-stdin` 在同一個 SQLite 檔建立帳號，密碼在執行期以亂數產生、只存在 Playwright 輸出目錄；旅程照 `specs/e2e-testing`「登入到落點再登出的旅程」；驗證：`pnpm --filter e2e test` 與 `pnpm --filter e2e test:static` 通過，`e2e/shared/fixtures/` 下沒有新增密碼（design D11） [@frontend-developer]

## 8. 關鍵路徑覆蓋率門檻與規則文件

- [ ] 8.1 新增 repo 根的 `critical-coverage.json`（只有 `authentication`、`authorization` 兩項，後端與前端檔案照 design D10）與 `scripts/check-critical-coverage.mjs`，加進 CI 的 `coverage` job；先在 `scripts/tests/` 寫 `specs/ci-quality-gates`「認證與授權的關鍵路徑分支覆蓋率門檻」四條 Scenario 的測試，驗證：CI 輔助腳本測試通過，本 PR 的 `coverage` job 綠燈，兩項兩層都不低於 90.0%（design D10） [@backend-developer]
- [ ] 8.2 更新 `docs/development/rules/testing-agent-rules.mdx` T10 的「尚未檢查」那一列與檢查方式，寫明「認證」「授權與權限檢查」兩項已由 #719 建立並指向 `critical-coverage.json` 與 `scripts/check-critical-coverage.mjs`，其餘三項仍未建、屬 #111；同步 T9 開頭那段的已建清單；驗證：文件與 CI 的 job 名稱、指令一致 [@technical-writer]
- [ ] 8.3 改寫 Issue #111 本文 §2b 第二項：「認證」「授權與權限檢查」兩項的 90% 分支門檻已由 #719 建立，答案隔離、評分、IAA 三項仍留在 #111；以 `gh issue edit 111` 更新並在 #111 留言附 PR 連結；驗證：`gh issue view 111` 的本文含上述改寫 [@technical-writer]
- [ ] 8.4 在 `docs/development/architecture.mdx` §部署與維運 與 Lite Quick Start 加上：正式層 `AUTH_SECRET` 必填、Lite 自動產生並存在資料 volume、刪 volume 等於全部登出；`__Host-` 與 `Secure` cookie 只在 HTTPS 或 `localhost` 有效；部署後執行一次 Seeder 初始化指令；開 Google 時三個 `GOOGLE_*` 一起設與 `GOOGLE_REDIRECT_URI` 的值；驗證：照文件以 Lite 編排起服務、建立第一位系統管理員並登入成功（system-design T9、design §Migration Plan） [@technical-writer]

## Workflow follow-up

- tasks 定稿後先提交規劃產出物，交 `design-reviewer` 審閱；修訂由 `planner` 另開 commit
- `acceptance.md` 逐條對照規格 01-01、01-05 的驗收標準，標明登入失敗鎖定（#726）與以註冊頁、重設密碼頁為前提的四條 Scenario（#723、#724）不在本次
- PR 本文列出暫時落點的英文擬稿（design D12）給維護者確認
- 驗收通過後由 `ops` 執行 `/opsx:archive`，與程式同一個 PR 合併
