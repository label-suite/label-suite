# Tasks

## 1. 後端分層檢查與覆蓋率設定

- [ ] 1.1 先驗證技術風險 N5（design R1）：`cd backend && uv add --dev import-linter`，在 `pyproject.toml` 寫一條 `app.modules.*.router` 不得 import `app.modules.*.repository` 的 forbidden 契約，對一個暫存目錄裡刻意違規的模組副本跑 `uv run lint-imports`。以結束碼判定萬用字元是否生效；結果（版本號、支援與否、採哪一條路）寫進本群組的提交訊息。不支援時，1.2 的「逐模組產生契約」改為 fallback：unit 測試以 `pkgutil.iter_modules(app.modules.__path__)` 列出所有模組、產生每個模組的 forbidden 契約內容，並斷言 `pyproject.toml` 的契約與產生結果一致。完成判定：驗證結果已記錄，且下一步採用的寫法已定 [@backend-developer]
- [ ] 1.2 依 system-design §後端：分層 import 檢查的對象 與 design D9，在 `backend/pyproject.toml` 的 `[tool.importlinter]` 寫四條契約（模組內分層、Router 不碰資料層、core 不依賴模組、資料層不處理 HTTP），並以 TDD 寫 `backend/tests/unit/` 下的分層檢查測試：每條契約各有一個暫存違規副本讓 `lint-imports` 以非 0 結束（含健康檢查模組的 router 匯入 repository）、`app/main.py` 匯入多個模組 router 不報錯、新增模組未列入契約時測試失敗並指出模組名。完成判定：`cd backend && uv run lint-imports` 以 0 結束，`uv run pytest` 通過且回報 skipped 數，對應 spec `backend-code-boundaries` 全部 Scenario [@backend-developer]
- [ ] 1.3 依 system-design D12 在 `backend/pyproject.toml` 加 `[tool.coverage]`：`source = ["app"]`、`branch = true`、`parallel = true`（讓兩輪各自產生 `.coverage.*` 供合併），並確認 `backend/alembic/` 不在分母內。完成判定：`cd backend && uv run pytest --cov=app --cov-branch && uv run coverage combine && uv run coverage json` 產生的 `coverage.json` 只列 `app/` 下的檔案；`uv run ruff check . && uv run ruff format --check . && uv run mypy --strict app` 通過 [@backend-developer]

## 2. 前端 lint 零警告與覆蓋率範圍

- [ ] 2.1 依 system-design D9 與 design D8，把 `frontend/package.json` 的 `lint` 改成 `eslint . --max-warnings 0`，並在既有的邊界探針測試加一個案例：以覆寫設定把分層規則設為 `warn`、讓 `components/` 匯入 `pages/`，斷言在零警告門檻下判定為失敗。`.gitignore` 加 `frontend/src/pages/**/boundary-probe.tsx`。完成判定：`pnpm --filter frontend lint` 以 0 結束且輸出無警告；`pnpm --filter frontend test` 通過；對應 spec `frontend-code-boundaries`「lint 不容許警告」三個 Scenario [@frontend-developer]
- [ ] 2.2 依 system-design D12 與 Q8 修改 `frontend/vitest.config.ts`：coverage 加 `json-summary` reporter，`include` 改成 `src/**`，排除 `src/api/generated/**`、`src/test/**`、`**/*.test.{ts,tsx}`、`**/*.d.ts`、`*.config.*`、`dist/**`。完成判定：`pnpm --filter frontend test:coverage` 產生 `coverage/coverage-summary.json`，報告不含 `src/api/generated/` 與 `src/test/` 的檔案；暫時新增一個沒有測試的 `src/lib/` 檔時 statements 下降（驗證後移除該檔）[@frontend-developer]
- [ ] 2.3 依 design R6 以 TDD 加一支單元測試：`VITE_API_BASE_URL` 為空字串時，健康檢查呼叫的網址是同源的 `/api/v1/health`。若現有程式組出的網址不對，停下回報，不改產品程式（design R5）。完成判定：`pnpm --filter frontend test` 通過、`pnpm --filter frontend typecheck` 通過 [@frontend-developer]

## 3. 安全掃描規則與相依套件掃描（可平行）

- [ ] 3.1 依 design R2 先驗證 `pip-audit` 的嚴重度過濾：`cd backend && uv add --dev pip-audit`，執行 `uv run pip-audit --help` 並對照官方文件，確認是否有 ADR-008 D8 與 Q5 寫的 `--fail-on high`（或等效旗標）。有就以它執行一次並記錄輸出；沒有時依 R2 實作 fallback（`--format json` 加一支依嚴重度判定 high 以上才失敗的小腳本，附 `node --test` 或 pytest 測試；JSON 無嚴重度時退為任何弱點都失敗），**不改寫 ADR-008 D8 或 Q5 的字句**，把實際旗標、所選 fallback、與 D8 字面的差異回報主 agent。另以 `pnpm audit --prod --audit-level high` 在 repo 根執行一次。完成判定：兩個指令的實際寫法已定並記在提交訊息；若既有依賴已有 high 以上弱點，停下回報（design R4）[@backend-developer]
- [ ] 3.2 依 system-design §目錄結構 與 Q6 新增 `.semgrep/label-suite.yml`（只有兩條規則：CORS 允許來源含萬用字元、寫死的 secret）與 `.semgrep/tests/` 的回歸樣本（每條規則各有 `ruleid` 與 `ok` 標註，涵蓋後端 Python 與前端 TypeScript；從環境變數讀取的設定標為 `ok`）。完成判定：`semgrep --test .semgrep/` 通過；`semgrep scan --error --config .semgrep/ backend/ frontend/ e2e/`（`e2e/` 尚未建立時先掃前兩個）沒有發現；若既有程式命中，停下回報（design R4）；對應 spec `security-scanning` 前兩個 requirement [@backend-developer]

## 4. e2e 套件與健康檢查旅程

- [ ] 4.1 依 system-design §目錄結構、D8、D8a 建 `e2e/`：`pnpm-workspace.yaml` 加入 `e2e`；`e2e/package.json`（以 `pnpm --filter e2e add -D @playwright/test` 加依賴，`test`、`test:static` 兩個 script）、`tsconfig.json`（strict）、`playwright.config.ts`（唯一讀 `E2E_BASE_URL`、`E2E_API_URL` 並寫預設值的地方；`locale` 與 `Accept-Language` 固定 `zh-TW`；`webServer` 起後端與前端開發伺服器，後端允許來源與前端呼叫位址由兩個位址推導，不讀根目錄 `.env`；後端用 Playwright 輸出目錄下的 SQLite 暫存檔並先跑遷移）、`shared/fixtures/index.ts`（只匯出擴充過的 `test`／`expect`）。`.gitignore` 加 e2e 的報告與結果目錄。完成判定：`pnpm install --frozen-lockfile` 成功，`pnpm --filter e2e exec tsc --noEmit` 通過 [@frontend-developer]
- [ ] 4.2 依 system-design D8b 與 design D7，以 TDD 寫 `e2e/system-health/dev-health.spec.ts`（一條旅程：開健康檢查開發頁 → 標題「系統健康檢查」→「後端與資料庫都可以用」→ 服務與資料庫都是 `ok`、檢查時間與 traceId 存在、沒有 `role="alert"`；只用條件式等待、相對路徑、不加 `data-testid`），以及 `test:static` 跑的靜態掃描測試（設定檔以外不含主機與埠、spec 不用固定時間等待、`shared/fixtures/` 只有 `.ts`、spec 都在 `e2e/<module>/<page>.spec.ts`）。完成判定：在 repo 根 `pnpm --filter e2e exec playwright install chromium` 後，`pnpm --filter e2e test:static` 與 `pnpm --filter e2e test` 都以 0 結束；另以不同的 `E2E_BASE_URL`、`E2E_API_URL`，以及與 e2e 位址不符的根目錄 `.env` 各跑一次仍通過；`semgrep scan --error --config .semgrep/ e2e/` 沒有發現；對應 spec `e2e-testing` 全部 Scenario [@frontend-developer]

## 5. 根目錄指令與 CI 輔助腳本

- [ ] 5.1 依 system-design D11、D12 與 design D5、D6，以 TDD 新增 `scripts/check-junit-skips.mjs`（讀 JUnit XML，skipped 不為 0 時以非 0 結束並列出測試名；`--summary` 模式只印 skipped 數）與 `scripts/check-coverage.mjs`（讀 `coverage-baseline.json`、後端 `coverage.json`、前端 `coverage-summary.json`；低於基準減容許誤差時失敗並印出層、指標、基準與實測值；高於基準超過容許誤差時提示可更新、只有帶 `--update` 才寫回；基準檔缺失或缺欄位時失敗並說明缺什麼），測試放 `scripts/tests/`，fixture 放 `scripts/tests/fixtures/`。完成判定：`pnpm test:scripts` 通過，測試涵蓋 spec `ci-quality-gates` 覆蓋率三個 Scenario 的數值（90.0／89.8、95.0／94.95、85.0／86.0）與 PostgreSQL 跳過的 Scenario [@frontend-developer]
- [ ] 5.2 依 system-design §本機自查的步驟 與 design D10，以 TDD 新增 `scripts/dev.mjs`（同時起後端 uvicorn 與前端 Vite，轉送 SIGINT／SIGTERM，任一方結束就全部結束並沿用其結束碼）與 `scripts/check.mjs`（步驟清單是一個陣列常數，依 12 步固定順序執行、每步印出名稱與結果、第一個失敗即以非 0 結束；第 1 步發現 `boundary-probe.tsx` 時失敗並說明、不刪檔；第 12 步未設 `TEST_DATABASE_URL` 時印出「PostgreSQL 那一輪已跳過：未設 TEST_DATABASE_URL」；`--with-e2e`、`--with-semgrep` 才加跑 e2e 與 Semgrep），根目錄 `package.json` 加 `bootstrap`（先 `scripts/setup.sh`，再 `pnpm install --frozen-lockfile`、`cd backend && uv sync --locked`）、`dev`、`api:sync`（後端匯出成功才跑前端重產）、`check`，不加 `setup`。完成判定：`pnpm test:scripts` 通過，測試以假的子程序涵蓋 spec `workspace-commands` 的停止、訊號、跳過訊息與探針殘留 Scenario；在本機實際執行 `pnpm run api:sync` 後 `git status` 無差異，`pnpm run check` 以 0 結束並印出跳過訊息 [@frontend-developer]

## 6. 映像（可平行）

- [ ] 6.1 依 system-design §目錄結構 與 ADR-008 D2 新增 `backend/Dockerfile`（多階段、`uv sync --locked`、非 root、`WORKDIR /app`、映像內有 Python 可供健康檢查使用）與 `backend/.dockerignore`（排除 `.env`、`.venv`、測試快取與資料目錄）。完成判定：`docker build -t label-suite-backend backend/` 成功，`docker run --rm label-suite-backend id -u` 不是 0，映像內沒有 `.env` [@backend-developer]
- [ ] 6.2 依 system-design D6 與 frontend-skeleton design D8 新增 `frontend/Dockerfile`（node 階段 `pnpm install --filter frontend...` 後 build，`VITE_API_BASE_URL` 以 build arg 傳入、預設空字串；`nginx:alpine` 階段服務 `/dist`）、`frontend/nginx.conf`（SPA fallback、`/api/v1/` 反向代理到 `backend:8000`、安全標頭）與根目錄 `.dockerignore`（只讓 `frontend/`、`design/prototype/assets/` 與 workspace 檔進入 build context，排除 `.env`）。完成判定：在 repo 根 `docker build -f frontend/Dockerfile -t label-suite-frontend .` 成功，映像內沒有 `@playwright/test` 與 `.env`，`design/prototype/` 在 git 中無任何修改 [@frontend-developer]

## 7. 容器編排與設定範例檔

- [ ] 7.1 依 system-design D1–D6、§部署拓撲 與 §設定範例檔 新增 `docker-compose.yml`（Lite：`migrate`、`backend`、`frontend`；具名 volume `label-suite-data` 掛 `/app/data`；只有 `frontend` 發布 `${FRONTEND_PORT:-8080}`；backend 健康檢查 30s／10s／20s／3、`stop_grace_period: 30s`；frontend 健康檢查用 wget）、`docker-compose.prod.yml`（獨立檔，加 `db`（`postgres:16`、`pg_isready`），`POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?…}`）、`.env.example`（每行附註解、密碼欄留空），`.gitignore` 加 `.env`。完成判定：兩份檔 `docker compose config --quiet` 通過；Lite 與正式層各 `up --build --wait` 後，經 `http://localhost:8080/api/v1/health` 取得 `data.status` 與 `data.database` 都是 `ok`，再 `down -v`；對應 spec `container-runtime` 的兩個起服務 Scenario、缺密碼 Scenario 與範例檔 Scenario [@backend-developer]
- [ ] 7.2 依 design D4 在本機逐條執行 spec `container-runtime` 的動態負向情境（遷移失敗時後端不啟動、允許來源為空或為 `*` 時起不來、資料庫停止後後端轉為不健康、`down` 後資料仍在與 `down -v` 後移除、`.env` 不進映像、SPA fallback、主機連不到 8000），把每條的指令與結果記在本群組的提交訊息。若任一情境與 spec 不符，停下回報。完成判定：每條情境都有記錄且結果與 spec 的 THEN 一致 [@backend-developer]

## 8. CI 工作流程

- [ ] 8.1 依 system-design §CI job 設計 在 `.github/workflows/ci.yml` 新增 `backend-sqlite`（ruff、`ruff format --check`、`mypy --strict app`、`lint-imports`、`pytest --cov --junitxml`、以 `check-junit-skips.mjs --summary` 把 skipped 數寫進 job summary、上傳 coverage artifact）與 `backend-postgres`（`postgres:16` service container、先跑 `check-junit-skips` 的 `node --test`、`pytest --cov --junitxml`、`check-junit-skips.mjs`、上傳 coverage artifact）。既有四個 job 一字不動；新 job 不寫 `hashFiles()` 條件、不引用 `secrets.`。完成判定：PR 上兩個 job 都綠；`git diff main -- .github/workflows/ci.yml` 中既有四個 job 的區塊沒有任何變更 [@backend-developer]
- [ ] 8.2 新增 `frontend` job（設 `timeout-minutes`；lint → typecheck → `test:coverage` → build → 上傳 coverage summary）與 `e2e` job（`pnpm --filter e2e test:static`、`playwright install --with-deps chromium`、`pnpm --filter e2e test`、失敗時上傳 report）。完成判定：PR 上兩個 job 都綠；`frontend` job 的步驟順序為 lint 在前、後續步驟沿用預設的 `if: success()`（lint 失敗時的行為由 2.1 的探針測試涵蓋，不在 PR 上推刻意失敗的 commit）[@frontend-developer]
- [ ] 8.3 新增 `api-contract`（system-design §CI job 設計 的兩步比對，失敗時列出檔名）、`semgrep`（鎖定版本的官方映像，`semgrep --test .semgrep/` 後 `semgrep scan --error --config .semgrep/ backend/ frontend/ e2e/`）、`dependency-audit`（依 3.1 定案的寫法）、`changes` 與 `compose`（system-design D7、D13，加 design D4 的三個靜態步驟，正式層密碼用 job 內產生的隨機值）。完成判定：PR 上這些 job 都綠；本 PR 動到編排檔，`compose` 有執行而不是 skipped [@backend-developer]
- [ ] 8.4 新增 `coverage` job（`needs: [backend-sqlite, backend-postgres, frontend]`；先跑 `check-coverage`、`check`、`dev` 三支腳本的 `node --test`（design D11）；下載 artifact、`coverage combine`、`coverage json`、`check-coverage.mjs` 不帶 `--update`）。基準檔還不存在，本次 run 預期失敗但會印出實測值（design R3）。完成判定：`coverage` job 的 log 印出後端 `percentCovered` 與前端 `statements`、`branches` 的實測值，失敗原因是基準檔缺失 [@backend-developer]

## 9. 覆蓋率基準初始化

- [ ] 9.1 依 Q7 與 design R3，取 8.4 那次 CI run 印出的實測值建立 repo 根 `coverage-baseline.json`（後端 `percentCovered`、前端 `statements`、`branches`、`tolerance: 0.1`），不使用 acceptance 記的 97%、98.98% 或其他占位值。完成判定：下一次 CI run 的 `coverage` job 轉綠；本 PR 所有新 job（`compose` 依路徑條件）都綠 [@backend-developer]

## 10. 文件改寫（可平行）

- [ ] 10.1 依 Q12 (a)(b)(f) 與 design D13 改寫 `docs/development/rules/backend-agent-rules.mdx` B1、B2、B6、B7 的「檢查方式」為實際的 job 名稱與指令，並在 B1 §例外 補一句：健康檢查模組仍是分層檢查對象。不改文件開頭的「目錄不存在」敘述（Q12 (c)）。完成判定：`pnpm check:specs` 與 `pnpm exec notecraftapp build docs --rebuild` 通過，`node scripts/check-citations.mjs --strict` 通過 [@technical-writer]
- [ ] 10.2 依 Q12 (a)(b) 改寫 `frontend-agent-rules.mdx` F1、F2、F3，`api-agent-rules.mdx` A5，`security-agent-rules.mdx` S2 的「檢查方式」。完成判定：同 10.1 的三個指令通過 [@technical-writer]
- [ ] 10.3 依 Q12 (a)(e) 改寫 `testing-agent-rules.mdx` T1、T9、T10 的「檢查方式」，並把 T9 的「七項的實作全歸 #111」改成哪幾項由本 change 建成、哪幾項仍屬 #111。完成判定：同 10.1 的三個指令通過 [@technical-writer]
- [ ] 10.4 依 Q12 (d) 與 system-design N3 改寫 `docs/development/adr/008-deployment-and-operations.mdx` D8 的「Semgrep 延後」為已建成（門檻寫實際採用的指令；若 3.1 走了 fallback，照 design R2 先回報，不在此自行改字），以及 `docs/development/architecture.mdx` §部署與維運 的 CI 安全掃描列與備援列（具名 volume 改用 `docker compose cp`）。完成判定：同 10.1 的三個指令通過 [@technical-writer]

## Workflow follow-up

- 在 #111 留言說明 §2b 的覆蓋率項已由本 change 建成，以及 T9 歸屬字句的改寫結果（Q12 (e)）。
- 合併後另開 issue：由維護者修改 `main` ruleset，建議必過 `backend-sqlite`、`backend-postgres`、`frontend`、`api-contract`、`coverage`、`semgrep`（Q10）。
- 合併後另開 issue：正式層關閉 `/docs` 與介面描述路由（Q13）。
- code-reviewer 審查、acceptance-verifier 驗收（`acceptance.md` 附動態負向情境的手動步驟），通過後由 ops 在合併前歸檔。
