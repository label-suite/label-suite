# System Design

本文把 `system-analysis.md` 的範圍轉成 #506 的技術藍圖。這是**基礎建設 change**：產出是容器編排、映像建置檔、設定範例檔、根目錄指令、`e2e/` 骨架與 CI job，**不新增任何後端類別、端點或資料表**。schema 範本的 Router／Service／Repository／Model 分層在這裡的用途，是界定「後端分層 import 檢查要擋什麼」；序列圖的參與者因此換成開發者、Compose、容器、CI runner 與檢查工具，仍然畫到「回傳結果」為止，不含畫面。

三件已裁定的事照裁定寫、不列待決（維護者 2026-11-10，`architecture.mdx` §決策紀錄）：**模組內分層** `app/modules/<module>/`、成功回應**包一層 envelope**、路徑前綴 **`/api/v1`**。本 change 不改這三件的任何行為，只拿它們當檢查與健康檢查的目標。

**設計與待決問題的關係**：system-analysis 的 16 條待決問題與本文新發現的 N1–N4，已由維護者於 2026-11-22 在 `clarification.md` 逐題裁定（Q1–Q15，全數採建議答案）；規劃審查時維護者再於 2026-11-22 裁定 R-A（覆蓋率基準只能持平或上升）與 R-B（驗收條件 6 的 `AGENTS.md` 部分移給 #523）。本文已依裁定回修，不再有「依待決 #n，未定」的切換點。對照表在 [§技術待決問題](#技術待決問題)。還開著的是 N5、N6，都是技術風險，交給 apply 驗證。

## 分層與類別

### 目錄結構（本 change 新增或修改的檔案）

```text
.
├─ docker-compose.yml            新增：Lite 層，預設 SQLite；只有 frontend 對外（architecture.mdx §技術選型 目錄結構）
├─ docker-compose.prod.yml       新增：正式層，PostgreSQL；獨立檔，不疊加在 Lite 上（見 §關鍵設計細節 D2）
├─ .env.example                  新增：每個設定一行、Lite 可直接用的預設值、不含 secret（Hard Rule 8、B10）
├─ .dockerignore                 新增：前端映像以 repo 根為 build context，排除 node_modules、.git、docs/ 等，只放進 frontend/、design/prototype/assets/、e2e/package.json 與 workspace 檔
├─ .semgrep/
│  ├─ label-suite.yml            新增：專案禁令規則（CORS 萬用來源、寫死的 secret）
│  └─ tests/                     新增：Semgrep 規則的回歸樣本（ruleid／ok 標註）
├─ coverage-baseline.json        新增：覆蓋率基準，前後端各一段（見 D12）
├─ package.json                  修改：加根目錄指令 bootstrap、dev、api:sync、check（Q11；不用 setup，避免撞 pnpm 內建指令）
├─ pnpm-workspace.yaml           修改：packages 加入 e2e
├─ .gitignore                    修改：加 frontend/src/pages/**/boundary-probe.tsx、e2e 的報告與結果目錄、backend/test-results/、.env
├─ scripts/
│  ├─ dev.mjs                    新增：同時起後端 uvicorn 與前端 Vite，轉送訊號，任一方結束就全部結束
│  ├─ check.mjs                  新增：依固定順序跑本機自查；每一步印出名稱與結果，第一個失敗就以非 0 結束
│  ├─ check-coverage.mjs         新增：讀前後端覆蓋率摘要，與根目錄 coverage-baseline.json 比較（Q7）
│  ├─ check-junit-skips.mjs      新增：讀 pytest 的 JUnit XML，skipped 不為 0 就失敗（PostgreSQL 那一輪用）
│  ├─ ci-changed-paths.mjs       新增：changes job 的路徑過濾判斷，輸出 compose 要不要跑（D13）
│  └─ tests/                     新增上面五支腳本的 node --test 回歸測試（沿用 scripts/tests/ 的慣例）
├─ .github/workflows/ci.yml      修改：既有四個 job 不動，新增 job（見 §CI job 設計）
├─ backend/
│  ├─ Dockerfile                 新增：多階段，uv 安裝鎖定依賴，非 root 執行；之後 worker 共用（ADR-008 D2）
│  ├─ .dockerignore              新增
│  ├─ .gitignore                 修改：加 `.coverage*` 與 test-results/（兩輪各寫一個 `.coverage.<db>` 檔，不得進 repo）
│  └─ pyproject.toml             修改：dev 依賴加 import-linter（uv add --dev）；[tool.importlinter] 契約；[tool.coverage] 設定
├─ frontend/
│  ├─ Dockerfile                 新增：node 階段 pnpm build，nginx:alpine 階段服務 /dist
│  ├─ nginx.conf                 新增：SPA fallback、反向代理 /api/v1 到 backend、安全標頭（Q2 選項 B）
│  ├─ package.json               修改：lint 改成 eslint . --max-warnings 0
│  └─ vitest.config.ts           修改：coverage 加 json-summary reporter；`include: src/**` 並排除產物、測試輔助、設定（Q8）
└─ e2e/                          新增：獨立的 pnpm workspace 套件（ADR-007 D4）
   ├─ package.json               @playwright/test；scripts.test = playwright test
   ├─ tsconfig.json              strict（F2 同等）
   ├─ playwright.config.ts       baseURL、webServer、reporter 全部集中在這裡（T8）
   ├─ shared/
   │  └─ fixtures/
   │     └─ index.ts             匯出擴充過的 test／expect；之後各角色的 storageState 放這裡（T8）
   └─ system-health/
      └─ dev-health.spec.ts      一條旅程：開健康檢查頁 → 看見正常狀態（T1 的 e2e/[module]/[page].spec.ts）
```

- `e2e/` 的模組名 `system-health` 沿用前端 `features/system-health/`、頁名 `dev-health` 沿用 `pages/dev-health/`；健康檢查不屬於 `docs/specs/` 的 01–07 模組，用功能名而不是規格編號。
- `e2e/` 納入現有 pnpm workspace（system-analysis §交接的限制 留給 sd 決定）：一份 lockfile、`pnpm --filter e2e …` 執行，不違反 #505 Q7（根目錄 workspace）。前端映像建置用 `pnpm install --filter frontend...`，不把 Playwright 裝進映像。
- 不建 `deploy/` 或 `infra/` 目錄：兩份編排檔依 `architecture.mdx` §技術選型 放根目錄；Nginx 設定只有一份、跟著前端映像，放 `frontend/nginx.conf`。

### 後端：分層 import 檢查的對象（既有類別，本次不改）

本次**沒有新增或修改任何後端類別**。下圖是既有的 `app/modules/health/`，用來界定 B1 的 import 契約要擋什麼；箭頭是「允許的 import 方向」。health 模組沒有 Model，依 B1 正例，Model 層出現時位在 Repository 之下。

```mermaid
classDiagram
  direction TB
  class HealthRouter {
    <<app.modules.health.router>>
    +get_health(request: Request, service: HealthService) ApiResponse~HealthData~
  }
  class HealthService {
    <<app.modules.health.service>>
    +check() HealthData
  }
  class get_health_service {
    <<dependency factory, service.py>>
    +get_health_service(db: AsyncSession) HealthService
  }
  class HealthRepository {
    <<app.modules.health.repository>>
    +ping() None
  }
  class HealthData {
    <<app.modules.health.schemas>>
    +status: HealthStatus
    +database: HealthStatus
  }
  class CoreLayer {
    <<app.core.*>>
    config / db / envelope / errors / schemas
  }
  HealthRouter --> HealthService : 呼叫
  HealthRouter ..> HealthData : 回應型別
  get_health_service ..> HealthRepository : 建構並注入
  HealthService --> HealthRepository : 呼叫
  HealthService ..> HealthData : 回傳
  HealthRouter ..> CoreLayer
  HealthService ..> CoreLayer
  HealthRepository ..> CoreLayer
```

import 契約（`backend/pyproject.toml` 的 `[tool.importlinter]`，工具 `import-linter`，B1 §檢查方式 指名的例子）：

| 契約              | 型別                                               | 內容                                                                                  | 擋住的反例（B1）                                                |
| :---------------- | :------------------------------------------------- | :------------------------------------------------------------------------------------ | :-------------------------------------------------------------- |
| 模組內分層        | `layers`，`containers` 每個 `app.modules.<module>` | `router` ＞ `service` ＞ `repository` ＞ `models`；`schemas` 放最低層，任何層都可以用 | service 或 repository 反向 import router                        |
| Router 不碰資料層 | `forbidden`                                        | `app.modules.*.router` 不得 import `app.modules.*.repository`、`app.modules.*.models` | Router 直接呼叫 Repository（`layers` 允許跳層，所以要另立這條） |
| core 不依賴模組   | `forbidden`                                        | `app.core` 不得 import `app.modules`                                                  | 共用層反過來綁業務模組（ADR-003 D3）                            |
| 資料層不處理 HTTP | `forbidden`                                        | `app.modules.*.repository`、`app.modules.*.models` 不得 import `fastapi`、`starlette` | Repository 裡 `raise HTTPException(404)`                        |

- **新模組自動受檢**：`layers` 契約的 `containers` 要逐一列模組。為了不讓新模組漏列，加一支 unit 測試：用 `pkgutil.iter_modules(app.modules.__path__)` 列出所有模組套件，斷言每一個都出現在契約的 `containers` 裡。這樣新增模組時忘了改契約，測試先紅。`forbidden` 契約是否支援萬用字元依所裝版本而定；不支援時同一支測試改為逐模組展開，apply 第一個後端群組先驗證（技術待決 N5）。
- **健康檢查模組照樣受檢**：system-analysis 需求矛盾 8 已由 #504 Q8 決定，B1 §例外 的字句不讓檢查略過 health。
- `app/main.py` 組裝各模組的 router，是唯一允許 import 多個模組 router 的地方，不在上述契約的禁止範圍內。

### 部署拓撲

兩份編排檔的服務與連線。依 Q2 選項 B，**只有 frontend（nginx）對外**，`/api/v1` 由它反向代理到 backend；backend 與 `db` 都不發布埠。Redis 與 worker 在兩層都不出現（Epic #502 §不包含；第一個背景工作的 change 再加）。

```mermaid
flowchart LR
  subgraph Host[開發者或部署者的主機]
    B[瀏覽器]
  end
  subgraph Lite[docker-compose.yml（Lite）]
    FE1[frontend<br/>nginx:alpine 服務 /dist]
    MG1[migrate<br/>一次性：alembic upgrade head]
    BE1[backend<br/>uvicorn app.main:create_app --factory]
    V1[(volume label-suite-data<br/>/app/data/label_suite.db)]
  end
  subgraph Prod[docker-compose.prod.yml（正式）]
    FE2[frontend<br/>nginx:alpine]
    MG2[migrate]
    BE2[backend]
    DB2[(db<br/>postgres:16)]
    V2[(volume pg-data)]
  end
  B -->|FRONTEND_PORT| FE1
  FE1 -->|/api/v1 反向代理，Compose 網路內| BE1
  MG1 --> V1
  BE1 --> V1
  B -->|FRONTEND_PORT| FE2
  FE2 -->|/api/v1 反向代理| BE2
  MG2 --> DB2
  BE2 --> DB2
  DB2 --> V2
```

### 元件清單

| 元件                                   | 種類     | 職責                                                                                                                                                                                                                                                                                                                                                                                                                                           | 依據                                                                    |
| :------------------------------------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| `backend/Dockerfile`                   | 映像     | builder 階段用 uv 依 `uv.lock` 安裝（`uv sync --locked --no-dev`），runtime 階段 `python:3.12-slim`、非 root 使用者、`WORKDIR /app`；預設 CMD 是 uvicorn。同一個映像也跑 migrate，之後也跑 worker                                                                                                                                                                                                                                              | ADR-008 D2；Hard Rule 3（不用 pip install）                             |
| `frontend/Dockerfile`                  | 映像     | build context 是 repo 根（要讀 `pnpm-lock.yaml`、`pnpm-workspace.yaml`、`design/prototype/assets/tokens.css`）；node 階段先複製 workspace 內**每個**套件的 `package.json`（含 `e2e/package.json`，否則 lockfile 的 importer 對不上、`--frozen-lockfile` 會失敗）再 `pnpm install --frozen-lockfile --filter frontend...`，接著 `pnpm --filter frontend build`，`VITE_API_BASE_URL` 以 build arg 傳入；runtime 階段 `nginx:alpine` 服務 `/dist` | `architecture.mdx` §部署與維運 表「image」；frontend-skeleton design D8 |
| `frontend/nginx.conf`                  | 設定     | `try_files $uri /index.html`；`location /api/v1/` 反向代理到 `backend:8000`（`proxy_set_header Host`、`X-Forwarded-*`）與安全標頭。前端是唯一公開入口                                                                                                                                                                                                                                                                                          | ADR-008 D1；Q2                                                          |
| `.dockerignore`（根）                  | 設定     | 讓前端 build context 只含 `frontend/`、`design/prototype/assets/`、`e2e/package.json`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`；其餘（`.git`、`docs/`、`backend/`、`node_modules`、`.claude/`、`.env`）排除                                                                                                                                                                                                                    | 縮小 context、避免 `.env` 進映像（Hard Rule 8）                         |
| `docker-compose.yml`                   | 編排     | Lite：`migrate`、`backend`、`frontend` 三個服務，一個具名 volume                                                                                                                                                                                                                                                                                                                                                                               | ADR-003 D7；`architecture.mdx` §資料庫雙層                              |
| `docker-compose.prod.yml`              | 編排     | 正式：再加 `db`（`postgres:16`）與 `pg-data` volume；`backend`、`migrate` 帶 `DATABASE_URL`；與 Lite 一樣不含 Redis 與 worker，只有 frontend 發布埠                                                                                                                                                                                                                                                                                            | ADR-008 D1；B7                                                          |
| `.env.example`                         | 設定範例 | 見 [§設定範例檔](#設定範例檔)                                                                                                                                                                                                                                                                                                                                                                                                                  | Hard Rule 8；B10；#504 Q1；#505 交接的兩個值                            |
| `scripts/dev.mjs`                      | 根指令   | 讀根目錄 `.env`（Node 內建 `process.loadEnvFile`，不加依賴），補上本機預設值，起 `uv run uvicorn … --reload` 與 `pnpm --filter frontend dev`；任一子程序結束或收到 SIGINT／SIGTERM 就結束另一個並以其退出碼結束                                                                                                                                                                                                                                | Q11（`dev` 起本機開發伺服器）                                           |
| `scripts/check.mjs`                    | 根指令   | 依 [§本機自查的步驟](#本機自查的步驟) 順序執行，印出每步名稱、耗時、結果；需要 PostgreSQL 的那一步在沒有 `TEST_DATABASE_URL` 時**明確印出「已跳過」**，不默默略過（T11）                                                                                                                                                                                                                                                                       | Q11                                                                     |
| `scripts/check-coverage.mjs`           | 檢查器   | 讀 `backend/coverage.json` 的 `totals.percent_covered` 與 `frontend/coverage/coverage-summary.json` 的 statements／branches，和 PR 的 `coverage-baseline.json` 比，低於基準減容許誤差就失敗；另讀 base 分支的基準檔，PR 的基準有任一值比 base 低時失敗，除非帶 `--allow-lower`（PR 有 `coverage-baseline-lower` 標籤）；實測上升時印出並寫出完整的建議基準檔，不失敗。沒有 `--update`，不寫回 repo（D12）                                      | ADR-007 D2；T10；Q7、Q8；R-A                                            |
| `scripts/ci-changed-paths.mjs`         | 檢查器   | 收 base、head 兩個 commit，取 `git diff --name-only` 的檔名清單，交給純函式判斷 compose 相關檔案是否變動，寫進 `$GITHUB_OUTPUT`；base 取不到時一律回答「有變動」（D13）                                                                                                                                                                                                                                                                        | Q9                                                                      |
| `scripts/check-junit-skips.mjs`        | 檢查器   | 讀 pytest `--junitxml` 輸出，加總 `skipped`，不為 0 就失敗並列出被跳過的測試名                                                                                                                                                                                                                                                                                                                                                                 | T11；`openspec/config.yaml` 第 113 行「這次應為 0 skipped」             |
| `.semgrep/label-suite.yml`             | 規則     | `label-suite-cors-wildcard-origin`：`CORSMiddleware(..., allow_origins=[..., "*", ...])` 與等價寫法；`label-suite-hardcoded-secret`：Python 與 TypeScript 中名稱符合 `(?i)(api_?key\|secret\|token\|password)` 的變數或參數被指派非空字串常值                                                                                                                                                                                                  | `architecture.mdx` §部署與維運 摺疊區；Hard Rule 7、8；S2               |
| `e2e/playwright.config.ts`             | 測試設定 | `baseURL` 取 `E2E_BASE_URL`、後端位址取 `E2E_API_URL`，未設時的本機預設值**全專案只寫在這一處**；`use.locale` 固定 `zh-TW`；`webServer` 起後端（SQLite 暫存檔）與前端開發伺服器，兩者的埠、`CORS_ALLOWED_ORIGINS`、`VITE_API_BASE_URL` 都由這兩個 URL 推導（D8a）；`reuseExistingServer` 本機為真、CI 為假；`retries` CI 1 次、本機 0；失敗時保留 trace                                                                                        | T8；ADR-007 D4                                                          |
| `e2e/system-health/dev-health.spec.ts` | e2e      | `page.goto` 前端 `HEALTH_PATH` 那條開發路由（相對 baseURL）→ 依 D8b 的觀察契約斷言；條件式等待，不用 `waitForTimeout`，不新增 `data-testid`                                                                                                                                                                                                                                                                                                    | T8；frontend-routing 兩條 requirement                                   |

### 關鍵設計細節

**D1 遷移是獨立的一次性服務，不塞進 backend 的啟動指令。** `migrate` 用 backend 映像、指令 `alembic upgrade head`，只帶資料庫設定（遷移不讀 `CORS_ALLOWED_ORIGINS`，`backend-skeleton` system-design §設定與啟動失敗）；`backend` 以 `depends_on: migrate: condition: service_completed_successfully` 等它完成。好處是遷移失敗時 backend 不會起來、`docker compose up` 以非 0 結束，錯誤只出現在 migrate 的 log；之後 worker 也依賴同一個 migrate，不會兩個容器同時跑遷移。

**D2 正式層是獨立檔，不是疊加檔。** `docker compose -f docker-compose.prod.yml up` 單獨使用。疊加（`-f a -f b`）要在正式層移除 Lite 的 volume 掛載，得靠 `!reset` 這類合併語意，部署者一看不懂。代價是兩份檔有約 30 行重複；用 CI 的 `docker compose config --quiet` 對兩份檔各驗一次，加上 compose 冒煙測試（見 D7）抓漂移。

**D3 Lite 的資料放具名 volume `label-suite-data`，掛在 `/app/data`。** `SQLITE_PATH` 預設 `./data/label_suite.db`，相對於 `WORKDIR /app` 就是 `/app/data/label_suite.db`，所以不必另設值。不用 bind mount 到主機的 `./data`：容器以非 root 執行，Docker 自動建立的主機目錄屬 root，SQLite 會寫不進去。`architecture.mdx` §部署與維運「停掉服務再複製 `./data`」那句在具名 volume 下改用 `docker compose cp`，該列由本 change 一併改寫（Q12 d、技術待決 N3）。

**D4 正式層缺資料庫密碼時讓 Compose 本身拒絕啟動。** `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}`；`DATABASE_URL` 在編排檔裡由 `POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_DB` 組成 `postgresql+asyncpg://…@db:5432/…`。密碼含 URL 保留字元時要先編碼，`.env.example` 的註解寫出這一點。`.env.example` 的密碼欄留空，不放範例值（Hard Rule 8）。

**D5 健康檢查：兩份編排檔的 backend 都有容器健康檢查，輪詢 30 秒、不拆存活端點（Q14）。** `depends_on: condition: service_healthy` 與 `docker compose up --wait` 都需要它。指令用映像內已有的 Python 打 `http://127.0.0.1:8000/api/v1/health`（slim 映像沒有 curl），非 2xx 即不健康。`interval: 30s`、`timeout: 10s`（大於健康檢查查詢的 5 秒連線上限、等於前端記下的 10 秒合約上限）、`start_period: 20s`、`retries: 3`；每分鐘查兩次資料庫，對 SQLite 與 PostgreSQL 都可忽略，所以**不新增不碰資料庫的存活端點**，`api-contract.md` 維持一行、沒有新端點，也沒有新的 spec delta。`frontend` 服務另設輕量健康檢查（`wget -q -O /dev/null http://127.0.0.1/`），讓 `up --wait` 也等到唯一公開入口就緒；**兩份編排檔的 `frontend` 都寫 `depends_on: backend: condition: service_healthy`**，nginx 在 backend 健康之後才啟動，不會一開門就把 `/api/v1` 代理到還沒起來的上游、回 502；`db` 服務用 `pg_isready`。`stop_grace_period: 30s` 給 backend（ADR-008 D10；worker 的 300 秒本次不適用）。

**D6 唯一公開入口是前端 nginx（Q2 選項 B，ADR-008 D1）。** 前端映像是 `nginx:alpine` 服務 `/dist`，同一個 nginx 反向代理 `/api/v1/` 到 `backend:8000`；兩層編排都**只發布 `FRONTEND_PORT`**，backend 與 `db` 只在 Compose 網路內。正式層與 Lite 一樣不含 Redis 與 worker。四個相關設定值：

| 項目                             | 值                                                                                                                                                                                                                                                              |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/nginx.conf`            | SPA fallback、`location /api/v1/` 反向代理到 `backend:8000`、安全標頭                                                                                                                                                                                           |
| backend 對外埠                   | 不發布，只在 Compose 網路內                                                                                                                                                                                                                                     |
| `VITE_API_BASE_URL`（build arg） | 空字串（同源相對路徑，`readApiConfig` 已支援）                                                                                                                                                                                                                  |
| `CORS_ALLOWED_ORIGINS`           | 編排檔寫 `${CORS_ALLOWED_ORIGINS:?set CORS_ALLOWED_ORIGINS in .env}`，**不給預設值**，值從 `.env` 來（`.env.example` 已含前端公開來源 `http://localhost:8080`）；未設或空字串時 Compose 插值失敗、任何容器都不建立（D7）。同源請求不觸發 CORS，但設定仍是必要值 |

`.env.example` 的本機開發值（`http://localhost:5173`、`http://localhost:8000`，#505 交接）照樣保留給 `pnpm run dev` 用；`.env.example` 的 `CORS_ALLOWED_ORIGINS` 同時列 5173 與前端容器的來源，複製成 `.env` 後兩種用法一次定對；改了 `FRONTEND_PORT` 的人要同步改這個值，`.env.example` 的註解寫出這一點。`BACKEND_PORT` 只給 `scripts/dev.mjs` 的本機 uvicorn 用，編排檔不讀它。

**D7 CI 用 `docker compose up --wait --wait-timeout 300` 把驗收條件 1 的容器那一半變成機械檢查（Q1）。** 驗收條件 1 兩條都要驗：(a) 容器以 `up --wait` 加後端健康檢查回應；(b) 健康檢查頁由 e2e 在前端開發伺服器驗（D8）。`--wait` 會等每個有健康檢查的服務變成 healthy，失敗或逾時就以非 0 結束；逾時定為 **300 秒**：backend 的 `start_period` 20 秒加三次 30 秒輪詢約 110 秒，再加 nginx 與正式層 `pg_isready` 的等待，留一倍餘裕，job 本身另設 `timeout-minutes: 20` 涵蓋映像建置。

`--wait` 搭配一次性的 `migrate`（以 `service_completed_successfully` 被依賴、跑完以 0 結束）要求 **Docker Compose v2.20.0 以上**（保守下限；較舊版本會把「已結束的一次性容器」當成 `--wait` 失敗）。compose job 第一步印出 `docker compose version`，低於下限就失敗並說明；`.env.example` 與 `architecture.mdx` §部署與維運 寫出同一個下限。這個下限的準確值留給 apply 實測（技術待決 N6）。

job 依序：`cp .env.example .env` → `docker compose config --quiet` 驗兩份檔 → **兩個反向檢查**：`CORS_ALLOWED_ORIGINS= docker compose config --quiet` 與 `POSTGRES_PASSWORD= docker compose -f docker-compose.prod.yml config --quiet` 都必須以非 0 結束（shell 環境變數優先於 `.env`，空字串會觸發 `:?`），讓「缺必要設定拒絕啟動」成為機械檢查 → Lite `up --build --wait --wait-timeout 300` → **經 nginx** 對 `http://localhost:${FRONTEND_PORT}/api/v1/health` 發一次請求（backend 不發布埠，這一步同時驗反向代理）並斷言 envelope 的 `data.status` 與 `data.database` 都是 `ok` → `down -v` → 正式層同樣跑一次（`POSTGRES_PASSWORD` 用 job 內產生的隨機值）。job 只在動到編排檔、Dockerfile、`backend/`、`frontend/` 時跑（Q9，見 D13），因此不列為必過（Q10）。

**D8 e2e 跑在開發伺服器上，不跑在容器裡。** 健康檢查頁只在 `import.meta.env.DEV` 時註冊、正式建置剪除（`frontend-routing`），而目前前端沒有任何非開發頁（`frontend/src/app/router.tsx` 的正式路由只有一條 `path: "*"`、什麼都不渲染），所以容器裡的正式建置**沒有可以走的旅程**。`playwright.config.ts` 的 `webServer` 起兩個程序：後端 `uv run uvicorn app.main:create_app --factory`（環境帶 `SQLITE_PATH` 指向 Playwright 輸出目錄下的暫存檔、`CORS_ALLOWED_ORIGINS` 為前端開發伺服器的來源，先跑一次 `alembic upgrade head`）與 `pnpm --filter frontend dev`；就緒判定分別用後端健康檢查的 URL 與前端首頁。e2e **每張 PR 都在 CI 跑**（Q3）：job 用 SQLite 與開發伺服器，瀏覽器只裝 chromium；先不列為必過檢查，觀察穩定度後再議（Q10）。這是驗收條件 1 的另一半（Q1）：容器那一半由 D7 驗，健康檢查頁由這一條旅程驗。e2e fixtures 不含任何答案資料（Hard Rule 6），本次也沒有 `storageState`（無認證），`e2e/shared/fixtures/index.ts` 只匯出共用的 `test`／`expect`，讓第一條角色旅程（01-01 登入）有固定的擴充點。

**D8a e2e 設定的三個限制：都集中在 `playwright.config.ts`，spec 裡不出現。** 這三條是從既有主規格推出來的（ui-ux 在 `d16004c` 的觀察紀錄，見 `frontend-i18n`、`dev-health-page`、`frontend-skeleton/design.md` §跨 change 依賴），不是新的需求，也不替待決問題選答案。

1. **固定介面語言為 `zh-TW`。** 介面語言依 `navigator.language` 決定（`frontend-i18n`「介面語言依瀏覽器語言決定」；`resolveLanguage` 以 `zh` 開頭就用 `zh-TW`，其餘一律 `en`）。文字選擇器跟著語言變，沒固定的話，同一份 spec 換一台機器就找不到文字。設定方式是 `use.locale: "zh-TW"`：Playwright 會同時設定 `navigator.language` 和 `Accept-Language` 標頭，所以前端介面文字和後端 envelope 的 `message` 會是同一種語言。選 `zh-TW` 是因為它是本專案的主要介面語言，也是 ui-ux 紀錄文案時用的語言。`en` 那一側已由前端的單元測試涵蓋（`frontend/src/lib/i18n/*.test.ts`），e2e 不必兩種語言各走一次。
2. **`baseURL` 集中設定，不寫死埠號。** 設定檔只讀兩個環境變數：`E2E_BASE_URL`（前端來源）與 `E2E_API_URL`（後端來源）。未設時的預設值（Vite 開發伺服器與 uvicorn 的本機位址）只寫在這一個檔案裡（T8 正例「`baseURL` 集中在 `playwright.config.ts`」）。spec 一律用相對路徑 `page.goto(HEALTH_PATH 的值)`，不寫任何 `localhost`、也不寫埠號。`webServer` 的埠從這兩個 URL 解析出來後傳給子程序：後端用 `--port`，前端用 `pnpm --filter frontend dev --port`。`vite.config.ts` 的 `strictPort` 照舊，埠被佔用時直接失敗，不會悄悄換埠讓 baseURL 指錯地方。
3. **前端的呼叫位址與後端的允許來源由同一處推導，兩者一定對得上。** 這兩個值一旦不一致，瀏覽器會擋下跨來源請求，呼叫層只看到連線失敗，頁面就停在「連不到後端」、錯誤類型 `network`（`dev-health-page`）。所以 `playwright.config.ts` 用 `E2E_BASE_URL` 的 origin 當後端 `webServer` 的 `CORS_ALLOWED_ORIGINS`，用 `E2E_API_URL` 當前端 `webServer` 的 `VITE_API_BASE_URL`，兩個值都不從根目錄 `.env` 讀，以免本機設定讓 e2e 的結果因機器而異。同一個限制在容器裡也成立：D6 表格裡 `VITE_API_BASE_URL` 與 `CORS_ALLOWED_ORIGINS` 那兩列要對得上（選項 B 下為空字串與前端公開來源），這是 `compose` job 與人工驗收要確認的地方。

**D8b 健康檢查旅程的觀察契約。** `dev-health.spec.ts` 只走「開啟 → 看到正常」這一條旅程（T8 規定一個 spec 只走一條旅程）。載入中、後端回報錯誤、連不到後端，以及「重新檢查」的防重複送出，都已由 #505 的元件與頁面測試涵蓋（`frontend/src/features/system-health/*.test.tsx`、`frontend/src/pages/dev-health/dev-health-page.test.tsx`），#506 沒有要求另寫失敗旅程。

| 步驟               | 選擇器（語意優先，T8）                                                                                             | 斷言                                                                                                        |
| :----------------- | :----------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| 頁面已載入         | `getByRole("heading", { level: 1, name: "系統健康檢查" })`                                                         | 可見                                                                                                        |
| 等結果             | `getByText("後端與資料庫都可以用")`                                                                                | 用 `expect(...).toBeVisible()` 做條件式等待；**不斷言載入中的狀態**，它出現的時間太短，斷言它只會讓測試不穩 |
| 兩個值             | 描述清單中「服務」「資料庫」兩項的值，用 `getByRole("term")`／`getByRole("definition")` 或描述清單的可存取名稱定位 | 兩個值都是 `ok`                                                                                             |
| 沒有錯誤           | `getByRole("alert")`                                                                                               | 數量為 0                                                                                                    |
| 檢查時間與 traceId | 描述清單中的對應項                                                                                                 | **只斷言存在**，不斷言值，因為每次執行都不一樣                                                              |

- **不新增 `data-testid`**：這一頁沒有 prototype 的 `data-testid` 契約可沿用（T8 例外的來源不存在），語意選擇器已經夠用，前端程式本次不改。
- **失敗時的診斷**：spec 不斷言失敗狀態，但失敗時 Playwright 保留的 trace 與截圖可以直接讀 `role="alert"` 的標題。「資料庫無法連線」表示後端起來了、但資料庫不可用，例如 SQLite 暫存檔的路徑不對。「連不到後端」表示後端沒起來，或 D8a 第 3 點的兩個值沒對上。這兩條寫進 `acceptance.md` 的人工驗收步驟，供出事時對照。
- **不需要角色**：健康檢查頁是公開頁，對任何呼叫端的內容都一樣，旅程不使用 `e2e/shared/fixtures/` 的任何 `storageState`。

**D9 前端 lint 在來源處改成零警告。** `frontend/package.json` 的 `lint` 改成 `eslint . --max-warnings 0`，本機、`check` 指令、CI 都呼叫同一個 script，不在 CI 另寫一份參數（2026-11-21 留言第 1 點的「零警告」選項）。前端目前零警告（`fix-pages-root-layer-classification` tasks 3.1），這個改動不會讓既有程式變紅。`openspec/config.yaml` 第 108 行的指令字串不必改。

**D10 `boundary-probe.tsx` 殘留不影響後續步驟：三層防護。**

1. **順序**：CI 的 frontend job 與 `check` 指令都是 lint 在前、測試在後。同一個 job 內，測試被 timeout 硬殺時 job 已經失敗，後續步驟預設不跑（`if: success()`）。
2. **工作目錄**：GitHub 託管 runner 每個 job 都是全新的 checkout；改用自架 runner 時，`actions/checkout` 的 `clean: true`（預設）會先 `git clean -ffdx`，未追蹤的探針檔被清掉。frontend job 設 `timeout-minutes`，讓「被硬殺」只發生在 job 邊界。
3. **本機**：`check.mjs` 跑前端 lint 之前先找 `frontend/src/pages/**/boundary-probe.tsx`，存在就**失敗並說明這是被中斷的測試留下的檔案、請刪除後重跑**，不自動刪（loud failure，agent-rules）。`.gitignore` 加上這個檔名，讓它不會被誤提交。

探針檔不能加進 ESLint 的 ignore：那支測試正是要 lint 它，ignore 掉測試就失效。

**D11 PostgreSQL 那一輪必須 0 skipped。** `backend-postgres` job 以 service container 起 `postgres:16`（`architecture.mdx` §部署與維運 表「本機與 CI」、`openspec/config.yaml` 第 113 行用同一版本），`TEST_DATABASE_URL` 指向它，pytest 加 `--junitxml`，之後 `scripts/check-junit-skips.mjs` 斷言 skipped 為 0。SQLite 那一輪的 skipped 數量照樣印在 job summary（T11 要求回報 skipped 數），但不設為失敗條件，因為標 `postgres` 的測試在那一輪本來就該跳過。migration 升降升已由既有的 `tests/integration/test_migrations.py` 涵蓋，兩輪各跑一次就滿足 B6、B7、T4。CI 的資料庫密碼是一次性測試容器的值，不是 secret；寫在 workflow 的 `env` 裡，不放 repo secret。

**D12 覆蓋率：和 repo 內的 `coverage-baseline.json` 比（Q7）。** 後端：兩個後端 job 都用 `pytest --cov=app --cov-branch`，以環境變數分別設 `COVERAGE_FILE=.coverage.sqlite`、`COVERAGE_FILE=.coverage.postgres`（pytest 參數不變，「本機與 CI 同一串參數」仍成立），各自以**不同的 artifact 名稱**上傳，上傳步驟設 `include-hidden-files: true` 與 `if-no-files-found: error`（前端 coverage summary 的上傳也設 `if-no-files-found: error`）：`actions/upload-artifact` v4.4.0 起預設略過隱藏檔，`.coverage.sqlite`、`.coverage.postgres` 會靜默沒上傳，找不到檔案時又預設只警告，所以兩項都要明設。原因：pytest-cov 在非分散式執行結束時會自己合併資料，不會留下 `.coverage.*` 分檔，兩個 job 若都產出名為 `.coverage` 的檔，在 `coverage` job 會互相覆蓋、只剩一輪被計入；**不依賴 coverage 設定的 `parallel = true`**。`coverage` job 把兩個 artifact 下載到同一個目錄，執行 `coverage combine .coverage.sqlite .coverage.postgres`，再 `coverage json` 輸出 `coverage.json`——只量一輪會漏掉另一種資料庫才走得到的分支。分母本來就只有 `app/`，migration（`backend/alembic/`）不在內。前端：`vitest run --coverage` 加 `json-summary` reporter，**`coverage.include` 改成 `src/**`**（Q8），排除 `src/api/generated/**`、`src/test/**`、`**/*.test.{ts,tsx}`、`**/*.d.ts`、`*.config.*` 與建置產物（`dist/**`）；這樣新增一個完全沒測的檔案會讓覆蓋率下降。

基準檔是根目錄 `coverage-baseline.json`：前後端各一段、各指標一個數字（後端 `percentCovered`；前端 `statements`、`branches`），加一個容許誤差 `tolerance: 0.1`（百分點）。**覆蓋率只能持平或上升**（維護者 2026-11-22 裁定 R-A）：比較的對象不只是 PR 自己帶的基準檔，還有 **base 分支**上的那一份，否則 PR 只要把基準改低就能讓覆蓋率下降而照樣通過。

`coverage` job 的比較分三步，`scripts/check-coverage.mjs` 的輸入是「實測值、PR 的基準檔、base 分支的基準檔（可缺）、是否允許調低」：

1. **取 base 的基準**：checkout 用 `fetch-depth: 0`，以 `git show origin/${{ github.base_ref }}:coverage-baseline.json` 寫到暫存檔。base 分支上沒有這個檔（只會發生在建立它的本 PR）時印出 notice、略過第 2 步；PR 自己的基準檔缺失或缺欄位則照樣失敗（loud failure）。
2. **基準不得調低**：PR 的基準有任一指標低於 base 的對應值，或 `tolerance` 比 base 大（等於放寬），job 失敗並列出被調低的欄位；**唯一例外**是 PR 帶有 `coverage-baseline-lower` 標籤，由 workflow 讀 `github.event.pull_request.labels` 後傳 `--allow-lower` 給腳本。這個標籤由維護者加上；workflow 的 `pull_request` 觸發因此要含 `labeled`、`unlabeled`（連同預設的 `opened`、`synchronize`、`reopened`），加上或拿掉標籤時整個 workflow 重跑，`coverage` 的結果才會跟著標籤變。重跑其他 job 的成本可接受，不為此拆 workflow。
3. **實測不得下降**：任一指標低於「PR 基準減 `tolerance`」就失敗，印出層、指標、基準、實測。沒有標籤時第 2 步已保證 PR 基準不低於 base，所以這一步等於「不低於 base」。

**CI 是覆蓋率數字的唯一來源，更新基準是選擇性的，不擋 PR。** 實測任一指標高於基準超過 `tolerance` 時，腳本不失敗，而是在 log 印出**完整的建議基準檔 JSON**（上升的指標換成實測值，其餘沿用 PR 基準，`tolerance` 不變），同時寫成檔案、由 job 以 artifact `coverage-baseline-suggested` 上傳。作者想把基準往上收時，下載那個檔、原樣提交成 `coverage-baseline.json`；不收也照樣通過。CI 不自動寫回 repo（`permissions: contents: read`），基準檔的每次變動都在 PR 的 diff 裡。

**本機數字不等於 CI，以 CI 為準。** 本機 `check` 只跑 SQLite 一輪（PostgreSQL 那一輪要有 `TEST_DATABASE_URL` 才跑），也不做兩輪的 `coverage combine`，只有 PostgreSQL 才走得到的分支在本機會算成未覆蓋，後端數字因此偏低；前端數字本機與 CI 理論上相同，但 Node 版本與快取不同仍可能有小差異。因此**原本的本機 `--update` 取消**：本機不寫基準檔，`check` 也不跑覆蓋率比較，只把兩邊測試指令印出的覆蓋率摘要留在畫面上作參考；要不要過、基準該填多少，一律看 CI 的 `coverage` job。

- **初始值**：取**本 PR 在 CI 上第一次量到的值**（含 Q8 擴大分母後的前端數字、兩輪合併後的後端數字），不沿用 acceptance 記的 97%。基準檔還不存在時第 3 步失敗，但腳本仍印出並上傳建議基準檔；提交該檔後下一次 run 轉綠。
- 五項關鍵路徑 90% 分支覆蓋：那五項程式都不存在，本次**不留位置**。

**D13 前後端 job 每張 PR 全跑；只有 `compose` 依路徑過濾（Q9）。** 兩層都存在後，ADR-003 D1 的 `hashFiles()` 條件恆真，所以新 job 不再寫該條件，`pull_request` 觸發就跑。理由：被 `if` 跳過的 job 對必過檢查的語意不清。`compose` 最慢，改用一個 `changes` job 判斷要不要跑，`compose` 以 `needs: changes` 加 `if` 讀它的輸出。`compose` 不在建議必過清單內（Q10），被跳過不影響合併語意。

判斷不寫在 workflow 的 shell 裡，而是抽成 `scripts/ci-changed-paths.mjs`，讓它能被測試：

- **純函式**：輸入檔名清單，回傳布林。命中任一條即為真：`docker-compose.yml`、`docker-compose.prod.yml`、任一路徑的 `Dockerfile`、`.dockerignore`、`frontend/nginx.conf`、`backend/` 或 `frontend/` 底下的任何檔。
- **取清單**：腳本收 `--base`、`--head` 兩個 commit，跑 `git diff --name-only <base>...<head>`。`pull_request` 事件傳 `github.event.pull_request.base.sha` 與 `head.sha`；之後若加 `push` 觸發，傳 `github.event.before` 與 `github.sha`。base 為空、全為 0（新分支的第一次 push）或 `git` 找不到該 commit 時，**一律回答「有變動」**並印出原因，寧可多跑一次 `compose` 也不漏跑。
- **checkout 用 `fetch-depth: 0`**，否則淺層 clone 裡沒有 base commit，三點 diff 取不到 merge base。
- **node 測試**（`scripts/tests/ci-changed-paths.test.mjs`）至少涵蓋：只改 `docs/` 時為假；改 `docker-compose.yml`（或 `docker-compose.prod.yml`）時為真；改 `backend/` 底下的檔時為真；base 取不到時為真。

**新腳本的 node 測試跑在獨立 job `scripts-tests`**：`node --test` 跑 `check-coverage`、`check-junit-skips`、`ci-changed-paths`、`check`、`dev` 五支腳本的測試，**不設 `needs`**，與其他 job 平行。不放進 `coverage` job：`coverage` 要等三個測試 job 都完成才開始，腳本壞了要很晚才知道，而且前面任一 job 失敗時 `coverage` 根本不跑，腳本的回歸就被遮住了。既有 `specs` job 跑的舊腳本測試不動。

### CI job 設計

既有 `commit-messages`、`docs-site`、`format`、`specs` 四個 job 一字不動。workflow 的 `on.pull_request` 加上 `types: [opened, synchronize, reopened, labeled, unlabeled]`（R-A，見 D12）；這只改觸發，不改既有 job 的內容。新 job 一律 `runs-on: ubuntu-latest`、`permissions: contents: read`（沿用檔頭），Node 22、Python 3.12，依賴安裝用 `pnpm install --frozen-lockfile` 與 `uv sync --locked`。

| job                | 步驟（依序）                                                                                                                                                                                                                                                                                                                                                                                           | 失敗條件                                                                                   | 依據        |
| :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- | :---------- |
| `backend-sqlite`   | uv sync → `ruff check`、`ruff format --check` → `mypy --strict app` → `lint-imports`（B1 契約）→ `pytest --cov=app --cov-branch --junitxml=test-results/junit-sqlite.xml`（與本機第 11 步同一串）→ 上傳 coverage artifact（`COVERAGE_FILE=.coverage.sqlite`，artifact 名 `coverage-backend-sqlite`，`include-hidden-files: true`、`if-no-files-found: error`）；skipped 數寫進 job summary             | 任何 lint、型別、import 契約違反或測試失敗                                                 | Q4、Q9      |
| `backend-postgres` | service container `postgres:16` → uv sync → `pytest --cov=app --cov-branch --junitxml=test-results/junit-postgres.xml`（`TEST_DATABASE_URL`，與本機第 12 步同一串）→ `check-junit-skips.mjs` → 上傳 coverage artifact（`COVERAGE_FILE=.coverage.postgres`，artifact 名 `coverage-backend-postgres`，`include-hidden-files: true`、`if-no-files-found: error`）                                         | 測試失敗、skipped 不為 0                                                                   | Q9          |
| `frontend`         | pnpm install → `pnpm --filter frontend lint`（零警告，含 F1 分層與 `no-unknown-files`）→ `typecheck` → `test:coverage` → build → 上傳 coverage summary（`if-no-files-found: error`）                                                                                                                                                                                                                   | lint 有任何 error 或 warning、型別錯誤、測試失敗、建置失敗                                 | Q4、Q8、Q9  |
| `api-contract`     | uv sync、pnpm install → 後端匯出 → `git diff --exit-code` 與 `git status --porcelain` 檢查 `backend/openapi.json` → 前端重產 → 同樣檢查 `frontend/src/api/generated`                                                                                                                                                                                                                                   | 任何一處有差異或新檔，並列出檔名                                                           | —           |
| `coverage`         | `needs: [backend-sqlite, backend-postgres, frontend]` → checkout（`fetch-depth: 0`）→ `git show origin/<base_ref>:coverage-baseline.json` → 下載 artifact 到同一目錄 → `coverage combine .coverage.sqlite .coverage.postgres` → `coverage json` → `check-coverage.mjs`（PR 基準、base 基準、有 `coverage-baseline-lower` 標籤時加 `--allow-lower`）→ 上升時上傳 artifact `coverage-baseline-suggested` | PR 基準比 base 低且沒有標籤；任一指標低於 PR 基準減容許誤差；PR 基準檔缺失                 | Q7、Q8、R-A |
| `semgrep`          | Semgrep 官方容器映像（版本鎖定）→ `semgrep --test .semgrep/`（規則自己的回歸）→ `semgrep scan --error --config .semgrep/ backend/ frontend/ e2e/`                                                                                                                                                                                                                                                      | 規則回歸失敗；任何發現即失敗（`--error`）；只有兩條專案禁令                                | Q6          |
| `changes`          | checkout（`fetch-depth: 0`）→ `node scripts/ci-changed-paths.mjs --base <sha> --head <sha>` → 輸出 compose 相關檔案是否變動（D13）                                                                                                                                                                                                                                                                     | 腳本本身出錯；base 取不到時輸出「有變動」而不是失敗                                        | Q9          |
| `compose`          | `needs: changes`，有變動才跑；印 Compose 版本 → 反向檢查 → `up --build --wait --wait-timeout 300`；見 D7                                                                                                                                                                                                                                                                                               | Compose 低於下限；反向檢查沒有失敗；任一服務不健康或逾時；經 nginx 的健康檢查回應不是 `ok` | Q1、Q2、Q9  |
| `scripts-tests`    | 不設 `needs` → `node --test` 跑五支新腳本的測試（D13）                                                                                                                                                                                                                                                                                                                                                 | 任一腳本測試失敗                                                                           | —           |
| `e2e`              | pnpm install、uv sync → `playwright install --with-deps chromium` → `pnpm --filter e2e test`（SQLite、開發伺服器）→ 失敗時上傳 report；每張 PR 跑，先不列必過                                                                                                                                                                                                                                          | 任一旅程失敗                                                                               | Q1、Q3      |
| `dependency-audit` | 後端 `uv run pip-audit`（pip-audit 2.10.1 無嚴重度旗標，任何已知弱點即失敗）、前端 `pnpm audit --prod --audit-level high`；`pip-audit` 以 `uv add --dev` 加入                                                                                                                                                                                                                                          | 後端有任何已知弱點，或前端正式依賴有 high 以上弱點                                         | Q5          |

`api-contract` job 是 A5 漂移檢查進 CI 的地方，比對內容如下；本機的 `pnpm run api:sync` 與 `check` 指令跑同一組指令。這個 job 不起服務，因為匯出不需要環境變數，也不需要資料庫（`api-schema-export`）。

| 順序 | 產生                                                                                       | 比對對象                                        | 判定失敗的條件                                                                                            |
| :--- | :----------------------------------------------------------------------------------------- | :---------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| 1    | `cd backend && uv run python -m app.scripts.export_openapi`：從 FastAPI app 匯出介面描述檔 | 已提交的 `backend/openapi.json`                 | `git diff --exit-code -- backend/openapi.json` 有差異，或 `git status --porcelain` 顯示它是還沒提交的新檔 |
| 2    | `pnpm --filter frontend api:generate`：Orval 讀 `backend/openapi.json`，清空後重寫產物     | 已提交的 `frontend/src/api/generated/` 整個目錄 | 同上兩個條件；有任何檔案被改、刪除或新增都算                                                              |

- 第 1 步抓的是「改了後端路由或 schema，卻沒重新匯出」；第 2 步抓的是「介面描述檔已更新，卻沒重產前端呼叫層」，或有人手改了產物。
- operationId 的唯一性與「動詞加資源」命名，在第 1 步匯出時由既有的 `assert_unique_operation_ids` 與 `generate_operation_id` 把關，重複就讓匯出以非 0 結束；這次不改這套策略。
- 失敗時 job 要列出不同步的檔名，修正方式是在本機跑 `pnpm run api:sync` 後提交。

`semgrep` 不需要安裝專案依賴。新 job 不會自動變成 `main` 的必過檢查；本 PR 合併後另開 issue，由維護者改 ruleset，建議必過：`backend-sqlite`、`backend-postgres`、`frontend`、`api-contract`、`coverage`、`semgrep`（Q10）。`compose` 與 `e2e` 先不列。`scripts-tests` 是規劃審查後新增的 job，不在 Q10 的建議清單裡，要不要列入由維護者在那張 issue 決定，本文不替它選。

### 本機自查的步驟

根目錄四條指令（Q11）：`bootstrap` 先跑 `scripts/setup.sh`（裝 Git hooks）再裝前後端依賴（`pnpm install --frozen-lockfile`、`cd backend && uv sync --locked`），名字不用 `setup` 以免誤觸 pnpm 內建指令；`dev` 起本機開發伺服器（`scripts/dev.mjs`，不是容器）；`api:sync` 見 `api-contract` job；`check` 依序執行下列步驟；每步呼叫的都是 CI 用的**同一個 package script 或同一個指令**，不另寫一套參數，避免本機與 CI 漂移。

1. 探針殘留檢查（D10 第 3 點）
2. `pnpm format:check`
3. `pnpm check:specs`
4. `pnpm --filter frontend lint`
5. `pnpm --filter frontend typecheck`
6. `pnpm --filter frontend test:coverage`
7. 契約同步後比對：先把目前工作區的 `backend/openapi.json` 與 `frontend/src/api/generated/` 複製到暫存目錄，再跑 `pnpm run api:sync`，比對**重產結果與執行前的工作區內容**，不是與 HEAD 比。這樣剛跑過 `api:sync`、還沒提交的正確產物不會被誤判；有差異時保留重產結果在工作區、列出檔名並失敗。CI 的 `api-contract` job 拿 checkout 出來的 commit 比，兩者的判定對象都是「提交或準備提交的內容是否等於重產結果」，產生指令相同
8. `cd backend && uv run ruff check . && uv run ruff format --check .`
9. `cd backend && uv run mypy --strict app`
10. `cd backend && uv run lint-imports`
11. `cd backend && uv run pytest --cov=app --cov-branch --junitxml=test-results/junit-sqlite.xml`（SQLite），再以 `check-junit-skips.mjs --summary` 印出 skipped 數
12. 有 `TEST_DATABASE_URL` 時以同一串參數跑 PostgreSQL 那一輪（`--junitxml=test-results/junit-postgres.xml`），再以 `check-junit-skips.mjs` 斷言 0 skipped；沒有時印出「PostgreSQL 那一輪已跳過：未設 TEST_DATABASE_URL」

第 11、12 步的 pytest 參數與 CI 的 `backend-sqlite`、`backend-postgres` **完全相同**（`--cov=app --cov-branch --junitxml=…`，JUnit 檔放 `backend/test-results/`，加進 `.gitignore`），所以「0 skipped」那一步本機也能跑，「本機與 CI 同一個指令」成立。**覆蓋率比較不在本機步驟內**：本機只有一輪、不做合併，數字和 CI 對不上，以 CI 的 `coverage` job 為準（D12）；第 6、11 步印出的覆蓋率摘要只供參考。

e2e 與 Semgrep 不在預設步驟內（前者要起服務、後者要另裝工具），以 `--with-e2e`、`--with-semgrep` 開啟。第 5、8、9 步本機與 CI 都跑（Q4）。第 12 步沒有 `TEST_DATABASE_URL` 時必須印出明確的跳過訊息（Q11），不默默略過。

### 設定範例檔

`.env.example` 每一行都有註解說明用途、哪一層用、Lite 能不能直接用。`.env` 加進 `.gitignore`。

| 變數                     | 範例值                                                                    | 誰讀                               | 說明                                                                                              |
| :----------------------- | :------------------------------------------------------------------------ | :--------------------------------- | :------------------------------------------------------------------------------------------------ |
| `CORS_ALLOWED_ORIGINS`   | `http://localhost:5173`，加上前端容器來源 `http://localhost:8080`         | backend                            | 唯一必要設定（#504 Q1）；不得含 `*`                                                               |
| `CORS_ALLOW_CREDENTIALS` | `true`                                                                    | backend                            | 有預設值，列出供參考                                                                              |
| `SQLITE_PATH`            | （註解掉）`./data/label_suite.db`                                         | backend、migrate                   | Lite 層；容器內不必改                                                                             |
| `DATABASE_URL`           | （註解掉）`postgresql+asyncpg://user:password@localhost:5432/label_suite` | backend、migrate                   | 設定後走正式層；本機不用容器跑 PostgreSQL 時才需要。範例裡的 `user:password` 是占位字，不是可用值 |
| `POSTGRES_USER`          | `label_suite`                                                             | 正式層編排                         |                                                                                                   |
| `POSTGRES_PASSWORD`      | （空）                                                                    | 正式層編排                         | 必填，未填時 Compose 拒絕啟動（D4）；含 URL 保留字元要先編碼                                      |
| `POSTGRES_DB`            | `label_suite`                                                             | 正式層編排                         |                                                                                                   |
| `VITE_API_BASE_URL`      | `http://localhost:8000`                                                   | 前端開發伺服器、前端映像 build arg | #505 交接；容器建置用空字串（Q2，同源經 nginx 代理）                                              |
| `FRONTEND_PORT`          | `8080`                                                                    | 兩份編排                           | 前端容器對外埠；兩份編排唯一發布的埠                                                              |
| `BACKEND_PORT`           | `8000`                                                                    | `scripts/dev.mjs`（本機開發）      | 編排檔不讀；backend 不發布埠                                                                      |

`/docs` 與 `/openapi.json` 在正式層**本次不關閉**（Q13），維持 #504 的行為，另開 issue（關閉要新增一個有預設值的設定，牽動 `runtime-config`）。access log 格式留給 01-01（Q15）：本次維持 uvicorn 的預設 access log，不改 backend 的 `command`。

## 關鍵情境

Scenario 名稱是本文提出的名稱，planner 寫 `specs/**/spec.md` 時沿用；需要改名時兩邊一起改。參與者到「回傳結果」為止，不含畫面。

### Scenario: Lite 編排以預設值起服務並通過健康檢查

```mermaid
sequenceDiagram
  participant Dev as 開發者或 CI
  participant Compose as docker compose
  participant MG as migrate
  participant BE as backend
  participant Vol as label-suite-data
  participant FE as frontend
  Dev->>Compose: up --build --wait --wait-timeout 300（只用 .env.example 複製來的 .env）
  alt CORS_ALLOWED_ORIGINS 未設或為空字串
    Compose-->>Dev: 插值錯誤「set CORS_ALLOWED_ORIGINS in .env」，任何容器都不建立（D6、D7）
  end
  Compose->>MG: 啟動（只帶資料庫設定）
  MG->>Vol: alembic upgrade head（建立或升級 label_suite.db）
  alt 遷移失敗
    MG-->>Compose: 非 0 結束
    Compose-->>Dev: up 失敗，backend 不啟動，錯誤在 migrate 的 log
  else 遷移成功
    MG-->>Compose: 0 結束（service_completed_successfully）
    Compose->>BE: 啟動 uvicorn
    alt CORS_ALLOWED_ORIGINS 含 *
      BE-->>Compose: ConfigError，指出變數名、不印值（B10、S9）
      Compose-->>Dev: up --wait 失敗
    else 設定有效
      loop 每 30 秒（D5）
        Compose->>BE: GET /api/v1/health（容器內）
        BE->>Vol: SELECT 1
        BE-->>Compose: 200 envelope，data.status = ok、data.database = ok
      end
      Compose->>FE: backend healthy 後才啟動 nginx（depends_on service_healthy；反向代理 /api/v1 到 backend，Q2）
      Compose-->>Dev: 所有服務 healthy，up 以 0 結束
      Dev->>FE: GET /api/v1/health（FRONTEND_PORT，經 nginx；backend 不發布埠）
      FE->>BE: 反向代理
      BE-->>Dev: 200 envelope，data.status = ok、data.database = ok
    end
  end
```

### Scenario: 正式層編排缺資料庫密碼時拒絕啟動

```mermaid
sequenceDiagram
  participant Dev as 部署者或 CI
  participant Compose as docker compose
  participant DB as db（postgres:16）
  participant MG as migrate
  participant BE as backend
  participant FE as frontend（nginx）
  Dev->>Compose: -f docker-compose.prod.yml up --wait --wait-timeout 300
  alt .env 沒有 POSTGRES_PASSWORD
    Compose-->>Dev: 插值錯誤「set POSTGRES_PASSWORD in .env」，任何容器都不建立（D4）
  else 有密碼
    Compose->>DB: 啟動，pg_isready 直到 healthy
    Compose->>MG: 啟動（DATABASE_URL 由三個變數組成）
    MG->>DB: alembic upgrade head
    MG-->>Compose: 0 結束
    Compose->>BE: 啟動
    Compose->>BE: GET /api/v1/health
    BE->>DB: SELECT 1
    alt 資料庫不可用
      BE-->>Compose: 503 envelope（DatabaseUnavailableError）
      Compose-->>Dev: backend unhealthy，up --wait 失敗
    else 可用
      BE-->>Compose: 200 envelope，data.database = ok
      Compose->>FE: backend healthy 後才啟動 nginx（只有它發布埠；正式層不含 Redis 與 worker）
      Compose-->>Dev: 所有服務 healthy
      Dev->>FE: GET /api/v1/health（經 nginx 反向代理）
      FE-->>Dev: 200 envelope，data.database = ok
    end
  end
```

### Scenario: 開發伺服器上的健康檢查頁顯示正常

e2e 的那一條旅程；每張 PR 在 CI 跑（Q3），是驗收條件 1 的健康檢查頁那一半（Q1）；容器那一半見上面兩個 Scenario 與 D7。

```mermaid
sequenceDiagram
  participant Runner as 開發者或 CI
  participant PW as Playwright
  participant BE as uvicorn（SQLite 暫存檔）
  participant Vite as Vite 開發伺服器
  participant Browser as chromium
  Runner->>PW: pnpm --filter e2e test
  PW->>PW: 由 E2E_BASE_URL、E2E_API_URL 推導兩個埠與兩個設定值（D8a）
  PW->>BE: webServer：alembic upgrade head 後啟動（CORS_ALLOWED_ORIGINS = 前端 origin）
  PW->>BE: 輪詢 /api/v1/health 直到 200
  PW->>Vite: webServer：pnpm --filter frontend dev --port（VITE_API_BASE_URL = 後端 origin）
  PW->>Vite: 輪詢首頁直到 200
  PW->>Browser: 新 context，locale zh-TW
  PW->>Browser: page.goto(健康檢查頁，相對 baseURL)
  Browser->>Vite: 取得開發模式的 SPA
  Browser->>BE: GET /api/v1/health（跨來源，Accept-Language zh-TW）
  alt 前端 origin 不在 CORS_ALLOWED_ORIGINS
    BE-->>Browser: 沒有 CORS 標頭，瀏覽器擋下
    Browser-->>PW: 頁面顯示「連不到後端」（network）
  else 允許
    BE-->>Browser: 200 envelope
  end
  PW->>Browser: expect(heading 系統健康檢查).toBeVisible()
  PW->>Browser: expect(getByText(後端與資料庫都可以用)).toBeVisible()（條件式等待）
  alt 逾時仍看不到
    PW-->>Runner: 失敗，保留 trace、截圖與 report（role=alert 的標題即診斷）
  else 看得到
    PW->>Browser: 服務、資料庫皆為 ok；role=alert 數量 0；檢查時間與 traceId 存在
    PW-->>Runner: 1 passed，關閉兩個 webServer
  end
```

### Scenario: 契約同步指令一次完成後端匯出與前端重產

```mermaid
sequenceDiagram
  participant Dev as 開發者或 agent
  participant Root as pnpm run api:sync
  participant Export as uv run python -m app.scripts.export_openapi
  participant Orval as pnpm --filter frontend api:generate
  Dev->>Root: 執行（不需環境變數、不需資料庫）
  Root->>Export: 匯出
  alt operationId 重複或匯出失敗
    Export-->>Root: 非 0
    Root-->>Dev: 失敗，不執行重產
  else 成功
    Export-->>Root: 寫入 backend/openapi.json
    Root->>Orval: 讀 backend/openapi.json 重產
    Orval-->>Root: 清空並重寫 frontend/src/api/generated/
    Root-->>Dev: 0 結束，兩處的差異留在工作區供提交
  end
```

### Scenario: 介面描述檔或前端產物未重產時 CI 失敗

```mermaid
sequenceDiagram
  participant PR as Pull request
  participant Job as api-contract job
  participant Git as git
  PR->>Job: 觸發
  Job->>Job: 後端匯出 openapi.json
  Job->>Git: diff --exit-code 與 status --porcelain（backend/openapi.json）
  alt 有差異或新檔
    Git-->>Job: 非 0
    Job-->>PR: 失敗，列出 backend/openapi.json 未重產
  else 一致
    Job->>Job: 前端重產
    Job->>Git: diff 與 status（frontend/src/api/generated）
    alt 有差異或新檔
      Job-->>PR: 失敗，列出不同步的檔案
    else 一致
      Job-->>PR: 通過
    end
  end
```

### Scenario: PostgreSQL 那一輪有測試被跳過時 CI 失敗

```mermaid
sequenceDiagram
  participant PR as Pull request
  participant Job as backend-postgres job
  participant PG as service container postgres:16
  participant Pytest as uv run pytest
  participant Skips as check-junit-skips.mjs
  PR->>Job: 觸發
  Job->>PG: 等待 healthy
  Job->>Pytest: TEST_DATABASE_URL 指向 PG，--cov --junitxml
  Pytest->>PG: 各測試對測試庫跑 alembic upgrade head 與案例（含升降升）
  alt 有測試失敗
    Pytest-->>Job: 非 0
    Job-->>PR: 失敗
  else 全部通過
    Pytest-->>Job: 0，寫出 JUnit XML
    Job->>Skips: 讀 JUnit XML
    alt skipped 大於 0
      Skips-->>Job: 非 0，列出被跳過的測試名
      Job-->>PR: 失敗（這一輪等於沒跑，T11）
    else skipped = 0
      Skips-->>Job: 0
      Job-->>PR: 通過，上傳 coverage artifact
    end
  end
```

### Scenario: 覆蓋率低於基準時 CI 失敗

base 分支的基準檔也參與比較（R-A，D12）；上升時的建議基準檔由 CI 產生，CI 是數字的唯一來源。

```mermaid
sequenceDiagram
  participant PR as Pull request
  participant Job as coverage job
  participant Git as git（fetch-depth 0）
  participant Art as artifacts
  participant Cmp as check-coverage.mjs
  PR->>Job: backend-sqlite、backend-postgres、frontend 都完成後觸發（含 labeled／unlabeled 重跑）
  Job->>Git: git show origin/<base_ref>:coverage-baseline.json
  alt base 分支沒有基準檔
    Git-->>Job: 不存在，印 notice，略過「不得調低」
  else 有
    Git-->>Job: base 基準
  end
  Job->>Art: 下載 coverage-backend-sqlite、coverage-backend-postgres 兩個 artifact（.coverage.sqlite、.coverage.postgres）與前端 coverage-summary.json
  Job->>Job: coverage combine .coverage.sqlite .coverage.postgres，再 coverage json 輸出 coverage.json
  Job->>Cmp: 實測值、PR 基準、base 基準、有 coverage-baseline-lower 標籤時 --allow-lower
  alt PR 基準檔缺失或缺欄位
    Cmp-->>Job: 非 0，說明缺什麼；仍印出並寫出建議基準檔
    Job-->>PR: 失敗，上傳 coverage-baseline-suggested
  else PR 基準有值低於 base，或 tolerance 被放寬，且沒有標籤
    Cmp-->>Job: 非 0，列出被調低的欄位
    Job-->>PR: 失敗（要調低須由維護者加 coverage-baseline-lower）
  else 任一指標低於 PR 基準減 tolerance
    Cmp-->>Job: 非 0，印出層、指標、基準、實測
    Job-->>PR: 失敗
  else 全部不低於
    opt 有指標高於基準超過 tolerance
      Cmp-->>Job: 在 log 印出完整建議基準 JSON 並寫成檔案
      Job->>Art: 上傳 coverage-baseline-suggested（作者可選擇提交，不擋 PR）
    end
    Cmp-->>Job: 0
    Job-->>PR: 通過
  end
```

### Scenario: 前端違反分層或有警告時 lint 失敗

```mermaid
sequenceDiagram
  participant PR as Pull request
  participant Job as frontend job
  participant Lint as pnpm --filter frontend lint
  participant Test as pnpm --filter frontend test:coverage
  PR->>Job: 觸發（全新 checkout，D10）
  Job->>Lint: eslint . --max-warnings 0
  alt boundaries/dependencies 或 no-unknown-files 違反
    Lint-->>Job: 非 0，指出檔案與層別
    Job-->>PR: 失敗
  else 任一規則被降成 warn 且有命中
    Lint-->>Job: 非 0（警告數超過 0）
    Job-->>PR: 失敗
  else 乾淨
    Lint-->>Job: 0
    Job->>Test: 跑測試（eslint-config.test.ts 在 src/pages/ 寫入並清除探針檔）
    alt 被 timeout 硬殺
      Test-->>Job: job 失敗，後續步驟不跑；殘留檔隨 runner 工作目錄丟棄
    else 正常結束
      Test-->>Job: 結果與覆蓋率摘要
      Job-->>PR: 依測試結果通過或失敗
    end
  end
```

### Scenario: 後端 Router 直接匯入 Repository 時 CI 失敗

```mermaid
sequenceDiagram
  participant PR as Pull request
  participant Job as backend-sqlite job
  participant IL as uv run lint-imports
  participant Pytest as uv run pytest
  PR->>Job: 觸發
  Job->>IL: 讀 pyproject.toml 的 [tool.importlinter]
  IL->>IL: 建 app 的 import 圖，逐條檢查四個契約
  alt app.modules.<m>.router import app.modules.<m>.repository
    IL-->>Job: 非 0，印出違反的契約與 import 鏈
    Job-->>PR: 失敗
  else 契約都成立
    IL-->>Job: 0
    Job->>Pytest: 含「每個模組都列在 containers」的 unit 測試
    alt 有模組沒列進契約
      Pytest-->>Job: 失敗，指出模組名
      Job-->>PR: 失敗
    else
      Pytest-->>Job: 通過
      Job-->>PR: 通過
    end
  end
```

### Scenario: Semgrep 掃到 CORS 萬用來源或寫死的 secret

違規即失敗（`--error`），只用兩條專案禁令，掃 `backend/`、`frontend/`、`e2e/`（Q6）。

```mermaid
sequenceDiagram
  participant PR as Pull request
  participant Job as semgrep job
  participant SG as semgrep
  PR->>Job: 觸發
  Job->>SG: semgrep --test .semgrep/
  alt 規則自己的回歸樣本不符
    SG-->>Job: 非 0
    Job-->>PR: 失敗（規則壞了）
  else 規則正常
    Job->>SG: scan --error --config .semgrep/ backend/ frontend/ e2e/
    alt 有發現
      SG-->>Job: 非 0，列出檔案、行號、規則 id
      Job-->>PR: 失敗
    else 沒有發現
      SG-->>Job: 0
      Job-->>PR: 通過
    end
  end
```

### Scenario: 相依套件有弱點時 CI 失敗（後端任何已知弱點、前端正式依賴 high 以上）

```mermaid
sequenceDiagram
  participant PR as Pull request
  participant Job as dependency-audit job
  participant Pip as uv run pip-audit
  participant Pnpm as pnpm audit
  PR->>Job: 觸發
  Job->>Pip: 執行 pip-audit（無嚴重度旗標）
  alt 後端依賴有任何已知弱點
    Pip-->>Job: 非 0，列出套件與弱點編號
    Job-->>PR: 失敗
  else 乾淨
    Pip-->>Job: 0
    Job->>Pnpm: audit --prod --audit-level high
    alt 前端正式依賴有 high 以上弱點
      Pnpm-->>Job: 非 0
      Job-->>PR: 失敗
    else 乾淨
      Pnpm-->>Job: 0
      Job-->>PR: 通過
    end
  end
```

## 資料模型異動

本次無資料模型異動。不新增表、欄位、索引或 Alembic revision，`docs/diagrams/architecture/data-table-dictionary.mdx` 與 `database-schema.er.json` 都不動。

雙資料庫與遷移的相關點只有「怎麼跑既有的遷移」：容器裡由 `migrate` 服務跑 `alembic upgrade head`（D1）；CI 兩輪測試各自對測試庫跑既有的升降升測試（D11）。SQLite 與 PostgreSQL 在本 change 的差異只在連線：Lite 是 volume 裡的檔案、正式層是 Compose 網路內的 `db:5432`；`env.py` 的 `render_as_batch` 已讓同一份遷移服務兩層，本次不碰。

## 權限檢查點

本 change 不新增端點、不碰認證、授權與任何業務資料，**沒有產品角色的權限檢查點，也沒有欄位遮蔽**；PRD §權限矩陣 不受影響。基礎建設層面的對應：

| 面向                        | 本 change 的做法                                                                                                                                                                                                                                                                                                      |
| :-------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 祕密（Hard Rule 8）         | `.env.example` 不含任何可用的密碼；`POSTGRES_PASSWORD` 留空並由 Compose 強制要求（D4）；`.env` 進 `.gitignore`，前端映像的 `.dockerignore` 排除 `.env`；Semgrep 的 `label-suite-hardcoded-secret` 擋寫死的 secret。CI 用的 PostgreSQL 密碼是一次性測試容器的值，不是 secret（D11）；compose job 用 job 內產生的隨機值 |
| CORS（Hard Rule 7）         | 兩份編排檔都把 `CORS_ALLOWED_ORIGINS` 寫成明確來源；後端已拒絕 `*`（`runtime-config`）；Semgrep 的 `label-suite-cors-wildcard-origin` 在程式層再擋一次                                                                                                                                                                |
| 對外暴露                    | backend 不發布埠、只有 frontend nginx 對外（ADR-008 D1、Q2）；`db` 同樣不發布埠；正式層不含 Redis 與 worker                                                                                                                                                                                                           |
| log（ADR-008 D3、S9）       | `ConfigError` 只印變數名；健康檢查失敗只記例外型別（既有行為）；CI 不在 log 印任何環境變數值；access log 的查詢字串留給 01-01（Q15）                                                                                                                                                                                  |
| 測試集答案（Hard Rule 6）   | 不適用：本次不碰答案資料；`e2e/shared/fixtures/` 只放共用的 `test`／`expect`，不放任何資料檔                                                                                                                                                                                                                          |
| 任務設定驅動（Hard Rule 5） | 不適用：沒有任務類型相關的行為                                                                                                                                                                                                                                                                                        |
| CI 權限                     | 新 job 沿用 workflow 的 `permissions: contents: read`；不需要任何 repo secret；ruleset 必過清單只有維護者能改，合併後另開 issue（Q10）                                                                                                                                                                                |

## 技術待決問題

### system-analysis 待決問題的處理

維護者 2026-11-22 全數裁定（`clarification.md` Q1–Q15，採建議答案）；下表的「設計中的位置」是回修後的落點。

| #   | 主題                             | 裁定                                                                                                                                                                                                                                                                    | 設計中的位置              |
| :-- | :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------ |
| 1   | 容器裡驗什麼                     | 兩個都要：容器以 `up --wait` 加後端健康檢查回應（Q1）；健康檢查頁由 e2e 在開發伺服器驗                                                                                                                                                                                  | D5、D7、D8                |
| 2   | 唯一公開入口                     | 選項 B：前端 nginx 反向代理 `/api/v1`，只有它對外；正式層也不含 Redis 與 worker（Q2）                                                                                                                                                                                   | D6；部署拓撲圖            |
| 3   | e2e 進不進 CI                    | 每張 PR 跑（SQLite、開發伺服器），先不列必過（Q3）                                                                                                                                                                                                                      | D8；CI job 表             |
| 4   | 型別檢查與後端 lint 進不進 CI    | 前端 typecheck、後端 ruff、`mypy --strict` 加進 CI，取代 #504 Q6「不加 CI job」（Q4）                                                                                                                                                                                   | CI job 表；本機自查的步驟 |
| 5   | 相依套件掃描                     | 本次一起接：`dependency-audit` job（Q5）；後端 `pip-audit` 任何已知弱點即失敗、前端 `--audit-level high`（維護者 2026-11-22 裁定）                                                                                                                                      | CI job 表；對應序列圖     |
| 6   | Semgrep 失敗或回報、規則集、範圍 | 違規即失敗（`--error`），只用兩條專案禁令，掃前端、後端與 e2e（Q6）                                                                                                                                                                                                     | `semgrep` 序列圖          |
| 7   | 覆蓋率基準的定義                 | repo 內 `coverage-baseline.json`、容許誤差 0.1 個百分點、前後端各一個、初始值取本 PR 第一次 CI 量到的值、不留 90% 位置（Q7）；另與 base 分支的基準比、只能持平或上升，調低須維護者加 `coverage-baseline-lower` 標籤；上升時更新為選擇性，CI 印出並上傳建議基準檔（R-A） | D12；CI job 表            |
| 8   | 前端覆蓋率分母                   | `include: src/**`，排除產物、測試輔助、設定（Q8）                                                                                                                                                                                                                       | D12                       |
| 9   | `hashFiles()` 語意               | 前後端 job 每張 PR 全跑；`compose` 只在動到編排檔、Dockerfile、`backend/`、`frontend/` 時跑（Q9）                                                                                                                                                                       | D13                       |
| 10  | 必過檢查清單                     | 合併後另開 issue 由維護者改 ruleset；ruleset 變更不在本 change 內執行（Q10）                                                                                                                                                                                            | CI job 表                 |
| 11  | 四條根目錄指令的語意             | `bootstrap`（原 setup）、`dev` 起本機開發伺服器、`check` 印出 PostgreSQL 跳過訊息（Q11）                                                                                                                                                                                | 目錄結構；本機自查的步驟  |
| 12  | 文件改寫範圍                     | 改 (a)(b)(d)(e)(f)，(c) 留給 #523（Q12）；(d) 含 ADR-008 D8 與 `architecture.mdx` 的 Semgrep 延後列                                                                                                                                                                     | N3                        |
| 13  | T9 與 #111 的歸屬                | 併入 Q12 (e)                                                                                                                                                                                                                                                            | —                         |
| 14  | 正式層關閉 `/docs`               | 本次不關，另開 issue（Q13）                                                                                                                                                                                                                                             | 設定範例檔                |
| 15  | 健康檢查輪詢頻率、存活端點       | 30 秒、不拆端點，`api-contract.md` 維持一行（Q14）                                                                                                                                                                                                                      | D5                        |
| 16  | access log 格式                  | 留給 01-01（Q15）                                                                                                                                                                                                                                                       | 設定範例檔                |

### 規劃審查時的裁定（維護者 2026-11-22）

| #   | 裁定                                                                                                                                                                                                                                                                 | 設計中的位置                 |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------- |
| R-A | 覆蓋率比較 base 分支的 `coverage-baseline.json`（`git show origin/<base_ref>:coverage-baseline.json`），不只看 PR 自己那份；PR 把任一值調低到 base 以下時 job 失敗，除非 PR 帶維護者加的 `coverage-baseline-lower` 標籤；workflow 要在 `labeled`／`unlabeled` 時重跑 | D12；CI job 表；覆蓋率序列圖 |
| R-B | #506 驗收條件 6 裡改 `AGENTS.md` 的部分移給 #523，依 Q12 (c)（issue 內文已載明）；本 change 不改 `AGENTS.md`                                                                                                                                                         | 上表第 12 列；N3             |

### 本文新發現的待決問題

| #   | 問題                                                                                                                                                                                                                                                                                                               | 狀態                                                                                           |
| :-- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| N1  | `pnpm setup` 是 pnpm 的內建指令，根目錄 script 叫 `setup` 要打 `pnpm run setup`                                                                                                                                                                                                                                    | **已裁定（Q11）**：改名 `bootstrap`，先跑 `scripts/setup.sh` 再裝前後端依賴                    |
| N2  | 覆蓋率基準的數字從哪一次量測來                                                                                                                                                                                                                                                                                     | **已裁定（Q7）**：取本 PR 在 CI 上第一次量到的值（兩輪合併的後端、擴大分母後的前端）           |
| N3  | Lite 改用具名 volume（D3）後，`architecture.mdx` §部署與維運備援列「停掉服務再複製 `./data`」不成立；另外 ADR-008 D8 與 `architecture.mdx` 的「Semgrep 延後」也與本次矛盾                                                                                                                                          | **已裁定（Q12 d）**：備援列、ADR-008 D8、`architecture.mdx` 的「Semgrep 延後」列都在改寫範圍內 |
| N4  | `compose` job 每次建兩個映像、耗時數分鐘，要不要每張 PR 跑                                                                                                                                                                                                                                                         | **已裁定（Q9）**：只在動到編排檔、Dockerfile、`backend/`、`frontend/` 時跑，不列必過（Q10）    |
| N5  | 技術風險，不需維護者決定：`import-linter` 的 `forbidden` 契約是否支援 `app.modules.*.router` 這類萬用字元依版本而定。apply 第一個後端群組先驗證，不支援時改由「列出所有模組」的 unit 測試逐模組產生契約檢查                                                                                                        | **仍開著**：影響 `backend/pyproject.toml` 的契約寫法與那支 unit 測試的範圍                     |
| N6  | 技術風險，不需維護者決定：`docker compose up --wait` 遇到以 `service_completed_successfully` 被依賴的一次性 `migrate` 時，各版 Compose 的行為不同；本文以 v2.20.0 為保守下限（D7）。apply 在 CI runner 上實測 `migrate` 以 0 結束後 `--wait` 不會判失敗，並把確認過的下限寫進 `.env.example` 與 `architecture.mdx` | **仍開著**：影響 compose job 的版本檢查與文件寫的下限                                          |

### 效能與資源

- **健康檢查輪詢**（Q14）：30 秒一次、每次一個 `SELECT 1`，backend-skeleton system-design §交易、session 與效能 留下的疑慮在這個頻率下可忽略；多實例或改用外部監控時再評估。
- **標籤觸發的重跑**（R-A）：加上或拿掉 `coverage-baseline-lower` 會讓整個 workflow 重跑一次。標籤只在少數 PR 上出現，成本可接受；不另拆一個只含 `coverage` 的 workflow，因為那樣 `coverage` 要重新取得三個測試 job 的 artifact，反而更複雜。
- **CI 時間**：新 job 彼此平行，最長的會是 `compose`（映像建置，已用路徑過濾，Q9）與 `e2e`（瀏覽器安裝，每張 PR 跑，Q3）。pnpm 用 `actions/setup-node` 的 cache、uv 用 `astral-sh/setup-uv` 的 cache；Docker 建置是否加 layer cache（`docker/build-push-action` 的 gha cache）等實測耗時後再定，本次不預先加。
- **session 生命週期**：本次不碰。API 的 async session 由既有的 `get_db` 管；worker 的 sync session 屬第一個背景工作的 change。
