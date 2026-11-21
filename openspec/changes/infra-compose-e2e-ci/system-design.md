# System Design

本文把 `system-analysis.md` 的範圍轉成 #506 的技術藍圖。這是**基礎建設 change**：產出是容器編排、映像建置檔、設定範例檔、根目錄指令、`e2e/` 骨架與 CI job，**不新增任何後端類別、端點或資料表**。schema 範本的 Router／Service／Repository／Model 分層在這裡的用途，是界定「後端分層 import 檢查要擋什麼」；序列圖的參與者因此換成開發者、Compose、容器、CI runner 與檢查工具，仍然畫到「回傳結果」為止，不含畫面。

三件已裁定的事照裁定寫、不列待決（維護者 2026-11-10，`architecture.mdx` §決策紀錄）：**模組內分層** `app/modules/<module>/`、成功回應**包一層 envelope**、路徑前綴 **`/api/v1`**。本 change 不改這三件的任何行為，只拿它們當檢查與健康檢查的目標。

**設計與待決問題的關係**：system-analysis 的 16 條待決問題都還沒裁定。凡是設計會被某一題改變的地方，本文**不替維護者選邊**，而是把設計拆成「各選項都要的共同部分」與「依選項切換的部分」，並在該處標「依待決 #n，未定」。對照表在 [§技術待決問題](#技術待決問題)。下文寫「本文的預設」時，意思是「規劃與 tasks 先照這個寫、clarification 改了就回修」，不是裁定。

## 分層與類別

### 目錄結構（本 change 新增或修改的檔案）

```text
.
├─ docker-compose.yml            新增：Lite 層，預設 SQLite（architecture.mdx §技術選型 目錄結構）
├─ docker-compose.prod.yml       新增：正式層，PostgreSQL；獨立檔，不疊加在 Lite 上（見 §關鍵設計細節 D2）
├─ .env.example                  新增：每個設定一行、Lite 可直接用的預設值、不含 secret（Hard Rule 8、B10）
├─ .dockerignore                 新增：前端映像以 repo 根為 build context，排除 node_modules、.git、docs/ 等，只放進 frontend/、design/prototype/assets/ 與 workspace 檔
├─ .semgrep/
│  ├─ label-suite.yml            新增：專案禁令規則（CORS 萬用來源、寫死的 secret）
│  └─ tests/                     新增：Semgrep 規則的回歸樣本（ruleid／ok 標註）
├─ package.json                  修改：加根目錄指令 setup、dev、api:sync、check
├─ pnpm-workspace.yaml           修改：packages 加入 e2e
├─ .gitignore                    修改：加 frontend/src/pages/**/boundary-probe.tsx、e2e 的報告與結果目錄、.env
├─ scripts/
│  ├─ dev.mjs                    新增：同時起後端 uvicorn 與前端 Vite，轉送訊號，任一方結束就全部結束
│  ├─ check.mjs                  新增：依固定順序跑本機自查；每一步印出名稱與結果，第一個失敗就以非 0 結束
│  ├─ check-coverage.mjs         新增：讀前後端覆蓋率摘要與基準比較（依待決 #7，基準來源未定）
│  ├─ check-junit-skips.mjs      新增：讀 pytest 的 JUnit XML，skipped 不為 0 就失敗（PostgreSQL 那一輪用）
│  └─ tests/                     新增上面三支腳本的 node --test 回歸測試（沿用 scripts/tests/ 的慣例）
├─ .github/workflows/ci.yml      修改：既有四個 job 不動，新增 job（見 §CI job 設計）
├─ backend/
│  ├─ Dockerfile                 新增：多階段，uv 安裝鎖定依賴，非 root 執行；之後 worker 共用（ADR-008 D2）
│  ├─ .dockerignore              新增
│  └─ pyproject.toml             修改：dev 依賴加 import-linter（uv add --dev）；[tool.importlinter] 契約；[tool.coverage] 設定
├─ frontend/
│  ├─ Dockerfile                 新增：node 階段 pnpm build，nginx:alpine 階段服務 /dist
│  ├─ nginx.conf                 新增：SPA fallback；是否反向代理 /api/v1 依待決 #2
│  ├─ package.json               修改：lint 改成 eslint . --max-warnings 0
│  └─ vitest.config.ts           修改：coverage 加 json-summary reporter；分母範圍依待決 #8
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

兩份編排檔的服務與連線。虛線框與 `nginx-proxy` 那條線**依待決 #2，未定**；Redis 與 worker 依 Epic #502 §不包含 不出現（第一個背景工作的 change 再加）。

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
  B -.->|選項 A：BACKEND_PORT 直連| BE1
  FE1 -.->|選項 B：/api/v1 反向代理| BE1
  MG1 --> V1
  BE1 --> V1
  B -->|FRONTEND_PORT| FE2
  B -.->|選項 A| BE2
  FE2 -.->|選項 B| BE2
  MG2 --> DB2
  BE2 --> DB2
  DB2 --> V2
```

### 元件清單

| 元件                                   | 種類     | 職責                                                                                                                                                                                                                                                                                                                                                    | 依據                                                                    |
| :------------------------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------- |
| `backend/Dockerfile`                   | 映像     | builder 階段用 uv 依 `uv.lock` 安裝（`uv sync --locked --no-dev`），runtime 階段 `python:3.12-slim`、非 root 使用者、`WORKDIR /app`；預設 CMD 是 uvicorn。同一個映像也跑 migrate，之後也跑 worker                                                                                                                                                       | ADR-008 D2；Hard Rule 3（不用 pip install）                             |
| `frontend/Dockerfile`                  | 映像     | build context 是 repo 根（要讀 `pnpm-lock.yaml`、`pnpm-workspace.yaml`、`design/prototype/assets/tokens.css`）；node 階段 `pnpm install --frozen-lockfile --filter frontend...` 再 `pnpm --filter frontend build`，`VITE_API_BASE_URL` 以 build arg 傳入；runtime 階段 `nginx:alpine` 服務 `/dist`                                                      | `architecture.mdx` §部署與維運 表「image」；frontend-skeleton design D8 |
| `frontend/nginx.conf`                  | 設定     | `try_files $uri /index.html`；選項 B 時另加 `location /api/v1/` 反向代理到 `backend:8000` 與安全標頭                                                                                                                                                                                                                                                    | ADR-008 D1；依待決 #2                                                   |
| `.dockerignore`（根）                  | 設定     | 讓前端 build context 只含 `frontend/`、`design/prototype/assets/`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`；其餘（`.git`、`docs/`、`backend/`、`node_modules`、`.claude/`、`.env`）排除                                                                                                                                                 | 縮小 context、避免 `.env` 進映像（Hard Rule 8）                         |
| `docker-compose.yml`                   | 編排     | Lite：`migrate`、`backend`、`frontend` 三個服務，一個具名 volume                                                                                                                                                                                                                                                                                        | ADR-003 D7；`architecture.mdx` §資料庫雙層                              |
| `docker-compose.prod.yml`              | 編排     | 正式：再加 `db`（`postgres:16`）與 `pg-data` volume；`backend`、`migrate` 帶 `DATABASE_URL`                                                                                                                                                                                                                                                             | ADR-008 D1；B7                                                          |
| `.env.example`                         | 設定範例 | 見 [§設定範例檔](#設定範例檔)                                                                                                                                                                                                                                                                                                                           | Hard Rule 8；B10；#504 Q1；#505 交接的兩個值                            |
| `scripts/dev.mjs`                      | 根指令   | 讀根目錄 `.env`（Node 內建 `process.loadEnvFile`，不加依賴），補上本機預設值，起 `uv run uvicorn … --reload` 與 `pnpm --filter frontend dev`；任一子程序結束或收到 SIGINT／SIGTERM 就結束另一個並以其退出碼結束                                                                                                                                         | 依待決 #11 的 dev 語意（本文預設「本機開發伺服器」）                    |
| `scripts/check.mjs`                    | 根指令   | 依 [§本機自查的步驟](#本機自查的步驟) 順序執行，印出每步名稱、耗時、結果；需要 PostgreSQL 的那一步在沒有 `TEST_DATABASE_URL` 時**明確印出「已跳過」**，不默默略過（T11）                                                                                                                                                                                | 依待決 #11                                                              |
| `scripts/check-coverage.mjs`           | 檢查器   | 讀 `backend/coverage.json` 的 `totals.percent_covered` 與 `frontend/coverage/coverage-summary.json` 的 statements／branches，和基準比，低於基準加容許誤差就失敗並印出層、指標、基準、實測                                                                                                                                                               | ADR-007 D2；T10；依待決 #7、#8                                          |
| `scripts/check-junit-skips.mjs`        | 檢查器   | 讀 pytest `--junitxml` 輸出，加總 `skipped`，不為 0 就失敗並列出被跳過的測試名                                                                                                                                                                                                                                                                          | T11；`openspec/config.yaml` 第 113 行「這次應為 0 skipped」             |
| `.semgrep/label-suite.yml`             | 規則     | `label-suite-cors-wildcard-origin`：`CORSMiddleware(..., allow_origins=[..., "*", ...])` 與等價寫法；`label-suite-hardcoded-secret`：Python 與 TypeScript 中名稱符合 `(?i)(api_?key\|secret\|token\|password)` 的變數或參數被指派非空字串常值                                                                                                           | `architecture.mdx` §部署與維運 摺疊區；Hard Rule 7、8；S2               |
| `e2e/playwright.config.ts`             | 測試設定 | `baseURL` 取 `E2E_BASE_URL`、後端位址取 `E2E_API_URL`，未設時的本機預設值**全專案只寫在這一處**；`use.locale` 固定 `zh-TW`；`webServer` 起後端（SQLite 暫存檔）與前端開發伺服器，兩者的埠、`CORS_ALLOWED_ORIGINS`、`VITE_API_BASE_URL` 都由這兩個 URL 推導（D8a）；`reuseExistingServer` 本機為真、CI 為假；`retries` CI 1 次、本機 0；失敗時保留 trace | T8；ADR-007 D4                                                          |
| `e2e/system-health/dev-health.spec.ts` | e2e      | `page.goto` 前端 `HEALTH_PATH` 那條開發路由（相對 baseURL）→ 依 D8b 的觀察契約斷言；條件式等待，不用 `waitForTimeout`，不新增 `data-testid`                                                                                                                                                                                                             | T8；frontend-routing 兩條 requirement                                   |

### 關鍵設計細節

**D1 遷移是獨立的一次性服務，不塞進 backend 的啟動指令。** `migrate` 用 backend 映像、指令 `alembic upgrade head`，只帶資料庫設定（遷移不讀 `CORS_ALLOWED_ORIGINS`，`backend-skeleton` system-design §設定與啟動失敗）；`backend` 以 `depends_on: migrate: condition: service_completed_successfully` 等它完成。好處是遷移失敗時 backend 不會起來、`docker compose up` 以非 0 結束，錯誤只出現在 migrate 的 log；之後 worker 也依賴同一個 migrate，不會兩個容器同時跑遷移。

**D2 正式層是獨立檔，不是疊加檔。** `docker compose -f docker-compose.prod.yml up` 單獨使用。疊加（`-f a -f b`）要在正式層移除 Lite 的 volume 掛載，得靠 `!reset` 這類合併語意，部署者一看不懂。代價是兩份檔有約 30 行重複；用 CI 的 `docker compose config --quiet` 對兩份檔各驗一次，加上 compose 冒煙測試（見 D7）抓漂移。

**D3 Lite 的資料放具名 volume `label-suite-data`，掛在 `/app/data`。** `SQLITE_PATH` 預設 `./data/label_suite.db`，相對於 `WORKDIR /app` 就是 `/app/data/label_suite.db`，所以不必另設值。不用 bind mount 到主機的 `./data`：容器以非 root 執行，Docker 自動建立的主機目錄屬 root，SQLite 會寫不進去。`architecture.mdx` §部署與維運「停掉服務再複製 `./data`」那句在具名 volume 下改用 `docker compose cp`，文字要不要改併入待決 #12（技術待決 N3）。

**D4 正式層缺資料庫密碼時讓 Compose 本身拒絕啟動。** `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}`；`DATABASE_URL` 在編排檔裡由 `POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_DB` 組成 `postgresql+asyncpg://…@db:5432/…`。密碼含 URL 保留字元時要先編碼，`.env.example` 的註解寫出這一點。`.env.example` 的密碼欄留空，不放範例值（Hard Rule 8）。

**D5 健康檢查：兩份編排檔的 backend 都有容器健康檢查。** 不論待決 #1 選哪一個，`depends_on: condition: service_healthy` 與 `docker compose up --wait` 都需要它。指令用映像內已有的 Python 打 `http://127.0.0.1:8000/api/v1/health`（slim 映像沒有 curl），非 2xx 即不健康。本文預設 `interval: 30s`、`timeout: 10s`（大於健康檢查查詢的 5 秒連線上限、等於前端記下的 10 秒合約上限）、`start_period: 20s`、`retries: 3`；每分鐘查兩次資料庫，對 SQLite 與 PostgreSQL 都可忽略，所以**本文預設不新增不碰資料庫的存活端點**，`api-contract.md` 因此不會有新端點。若維護者在待決 #15 選擇拆端點，會新增一個端點與一條 spec delta。`db` 服務用 `pg_isready`。`stop_grace_period: 30s` 給 backend（ADR-008 D10；worker 的 300 秒本次不適用）。

**D6 待決 #2 的兩個選項只差在 nginx 設定、對外埠與兩個設定值。** 前端映像在兩個選項下都是 `nginx:alpine` 服務 `/dist`（`architecture.mdx` §部署與維運 表「image」已定），所以先把共同部分做好，選項只切換下表四格：

| 項目                             | 選項 A：前後端各自對外                               | 選項 B：nginx 是唯一公開入口（ADR-008 D1）                        |
| :------------------------------- | :--------------------------------------------------- | :---------------------------------------------------------------- |
| `frontend/nginx.conf`            | 只有 SPA fallback                                    | 加 `location /api/v1/` 反向代理到 `backend:8000`、安全標頭        |
| backend 對外埠                   | 發布 `${BACKEND_PORT:-8000}`                         | 不發布，只在 Compose 網路內                                       |
| `VITE_API_BASE_URL`（build arg） | `http://localhost:${BACKEND_PORT}`                   | 空字串（同源相對路徑，`readApiConfig` 已支援）                    |
| `CORS_ALLOWED_ORIGINS`           | 含前端容器的來源 `http://localhost:${FRONTEND_PORT}` | 前端的公開來源（同源請求不觸發 CORS，但設定仍是必要值，不能留空） |

兩個選項下 `.env.example` 的本機開發值（`http://localhost:5173`、`http://localhost:8000`，#505 交接）都照樣保留給 `pnpm dev` 用；選項 A 時 `CORS_ALLOWED_ORIGINS` 的預設值同時列 5173 與前端容器的來源。

**D7 CI 用 `docker compose up --wait` 把驗收條件 1 變成機械檢查。** `--wait` 會等每個有健康檢查的服務變成 healthy，失敗或逾時就以非 0 結束。job 依序：`docker compose config --quiet` 驗兩份檔 → Lite `up --build --wait` → 對健康檢查發一次請求並斷言 envelope 的 `data.status` 與 `data.database` 都是 `ok` → `down -v` → 正式層同樣跑一次（`POSTGRES_PASSWORD` 用 job 內產生的隨機值）。這只驗「後端健康檢查回報正常」，即待決 #1 的做法 (a)；做法 (b)「健康檢查頁顯示成功」由 e2e 驗（D8）。兩者都做或擇一由待決 #1 決定，本 job 設計不受影響。這個 job 是否每張 PR 跑、是否列為必過，依待決 #9、#10（技術待決 N4）。

**D8 e2e 跑在開發伺服器上，不跑在容器裡。** 健康檢查頁只在 `import.meta.env.DEV` 時註冊、正式建置剪除（`frontend-routing`），而目前前端沒有任何非開發頁（`frontend/src/app/router.tsx` 的正式路由只有一條 `path: "*"`、什麼都不渲染），所以容器裡的正式建置**沒有可以走的旅程**。`playwright.config.ts` 的 `webServer` 起兩個程序：後端 `uv run uvicorn app.main:create_app --factory`（環境帶 `SQLITE_PATH` 指向 Playwright 輸出目錄下的暫存檔、`CORS_ALLOWED_ORIGINS` 為前端開發伺服器的來源，先跑一次 `alembic upgrade head`）與 `pnpm --filter frontend dev`；就緒判定分別用後端健康檢查的 URL 與前端首頁。e2e 是否進 CI 依待決 #3；進的話 job 用 Lite（SQLite），瀏覽器只裝 chromium。e2e fixtures 不含任何答案資料（Hard Rule 6），本次也沒有 `storageState`（無認證），`e2e/shared/fixtures/index.ts` 只匯出共用的 `test`／`expect`，讓第一條角色旅程（01-01 登入）有固定的擴充點。

**D8a e2e 設定的三個限制：都集中在 `playwright.config.ts`，spec 裡不出現。** 這三條是從既有主規格推出來的（ui-ux 在 `d16004c` 的觀察紀錄，見 `frontend-i18n`、`dev-health-page`、`frontend-skeleton/design.md` §跨 change 依賴），不是新的需求，也不替待決問題選答案。

1. **固定介面語言為 `zh-TW`。** 介面語言依 `navigator.language` 決定（`frontend-i18n`「介面語言依瀏覽器語言決定」；`resolveLanguage` 以 `zh` 開頭就用 `zh-TW`，其餘一律 `en`）。文字選擇器跟著語言變，沒固定的話，同一份 spec 換一台機器就找不到文字。設定方式是 `use.locale: "zh-TW"`：Playwright 會同時設定 `navigator.language` 和 `Accept-Language` 標頭，所以前端介面文字和後端 envelope 的 `message` 會是同一種語言。選 `zh-TW` 是因為它是本專案的主要介面語言，也是 ui-ux 紀錄文案時用的語言。`en` 那一側已由前端的單元測試涵蓋（`frontend/src/lib/i18n/*.test.ts`），e2e 不必兩種語言各走一次。
2. **`baseURL` 集中設定，不寫死埠號。** 設定檔只讀兩個環境變數：`E2E_BASE_URL`（前端來源）與 `E2E_API_URL`（後端來源）。未設時的預設值（Vite 開發伺服器與 uvicorn 的本機位址）只寫在這一個檔案裡（T8 正例「`baseURL` 集中在 `playwright.config.ts`」）。spec 一律用相對路徑 `page.goto(HEALTH_PATH 的值)`，不寫任何 `localhost`、也不寫埠號。`webServer` 的埠從這兩個 URL 解析出來後傳給子程序：後端用 `--port`，前端用 `pnpm --filter frontend dev --port`。`vite.config.ts` 的 `strictPort` 照舊，埠被佔用時直接失敗，不會悄悄換埠讓 baseURL 指錯地方。
3. **前端的呼叫位址與後端的允許來源由同一處推導，兩者一定對得上。** 這兩個值一旦不一致，瀏覽器會擋下跨來源請求，呼叫層只看到連線失敗，頁面就停在「連不到後端」、錯誤類型 `network`（`dev-health-page`）。所以 `playwright.config.ts` 用 `E2E_BASE_URL` 的 origin 當後端 `webServer` 的 `CORS_ALLOWED_ORIGINS`，用 `E2E_API_URL` 當前端 `webServer` 的 `VITE_API_BASE_URL`，兩個值都不從根目錄 `.env` 讀，以免本機設定讓 e2e 的結果因機器而異。同一個限制在容器裡也成立：D6 表格裡 `VITE_API_BASE_URL` 與 `CORS_ALLOWED_ORIGINS` 那兩列，在選項 A、B 下各自要對得上，這是 `compose` job 與人工驗收要確認的地方。

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

**D12 覆蓋率：量測方式先定，基準怎麼存依待決 #7。** 後端：兩個後端 job 都用 `pytest --cov=app --cov-branch`，各自上傳 `.coverage.*` 為 artifact，`coverage` job 下載後 `coverage combine` 再輸出 `coverage.json`——只量一輪會漏掉另一種資料庫才走得到的分支。分母本來就只有 `app/`，migration（`backend/alembic/`）不在內。前端：`vitest run --coverage` 加 `json-summary` reporter，排除既有的 `src/api/generated/**`、`src/test/**`、`*.config.*`；是否把 `coverage.include` 擴成所有 `src/**` 原始碼依待決 #8。比較：`scripts/check-coverage.mjs` 只接受「實測值、基準值、容許誤差」三個輸入，基準從哪裡來是可替換的輸入端：

| 待決 #7 的選項             | 基準來源                                                                                                  | 額外成本                                  |
| :------------------------- | :-------------------------------------------------------------------------------------------------------- | :---------------------------------------- |
| (a) 和 base 分支比         | 同一個 workflow 另跑一次 base 分支的測試，或下載 base 最近一次成功 run 的覆蓋率 artifact                  | CI 時間約加倍，或依賴 artifact 保存期限   |
| (b) 和 repo 裡的固定基準比 | 根目錄 `coverage-baseline.json`（前後端各一段、各指標一個數字、容許誤差一個數字），上升時在同一張 PR 更新 | PR 要多提交一個檔；檔案被改低時審查看得到 |

五項關鍵路徑 90% 分支覆蓋：那五項的程式都不存在，本文**不設計**它的量測位置；要不要先留空位依待決 #7 最後一問。

**D13 CI 觸發條件維持 `pull_request` 全跑，條件判斷依待決 #9。** ADR-003 D1 的 `hashFiles()` 條件在兩層都存在後恆真，本文預設每個新 job 照寫 `if: hashFiles('backend/pyproject.toml') != ''`（或 `frontend/package.json`）以符合 ADR 的字面、行為上等於全跑。若待決 #9 改為「有改到才跑」，加一個 `changes` job 以 `git diff --name-only base...head` 輸出各層是否變動，其他 job 以 `needs` 加 `if` 讀它；被 `if` 跳過的 job 在 GitHub 的必過檢查視為通過，這一點要和待決 #10 一起決定。

### CI job 設計

既有 `commit-messages`、`docs-site`、`format`、`specs` 四個 job 一字不動。新 job 一律 `runs-on: ubuntu-latest`、`permissions: contents: read`（沿用檔頭），Node 22、Python 3.12，依賴安裝用 `pnpm install --frozen-lockfile` 與 `uv sync --locked`。

| job                | 步驟（依序）                                                                                                                                                         | 失敗條件                                                      | 依賴的待決                                                           |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------ | :------------------------------------------------------------------- |
| `backend-sqlite`   | uv sync → `lint-imports`（B1 契約）→ `pytest --cov --junitxml` → 上傳 coverage artifact；skipped 數寫進 job summary                                                  | 任何 import 契約違反、任何測試失敗                            | #4（ruff、mypy 是否加步驟）、#9                                      |
| `backend-postgres` | service container `postgres:16` → uv sync → `pytest --cov --junitxml`（`TEST_DATABASE_URL`）→ `check-junit-skips.mjs` → 上傳 coverage artifact                       | 測試失敗、skipped 不為 0                                      | #9                                                                   |
| `frontend`         | pnpm install → `pnpm --filter frontend lint`（零警告，含 F1 分層與 `no-unknown-files`）→ typecheck → `test:coverage` → build → 上傳 coverage summary                 | lint 有任何 error 或 warning、測試失敗、建置失敗              | #4（typecheck 是否加步驟）、#8、#9                                   |
| `api-contract`     | uv sync、pnpm install → 後端匯出 → `git diff --exit-code` 與 `git status --porcelain` 檢查 `backend/openapi.json` → 前端重產 → 同樣檢查 `frontend/src/api/generated` | 任何一處有差異或新檔，並列出檔名                              | —                                                                    |
| `coverage`         | `needs: [backend-sqlite, backend-postgres, frontend]` → 下載 artifact → `coverage combine` → `check-coverage.mjs`                                                    | 任一層任一指標低於基準減容許誤差                              | #7、#8                                                               |
| `semgrep`          | Semgrep 官方容器映像（版本鎖定）→ `semgrep --test .semgrep/`（規則自己的回歸）→ `semgrep scan --config .semgrep/ backend/ frontend/ e2e/`                            | 規則回歸失敗；有發現時是否失敗依待決 #6（失敗就加 `--error`） | #6                                                                   |
| `compose`          | 見 D7                                                                                                                                                                | 任一服務不健康、健康檢查回應不是 `ok`                         | #1、#2、#9、#10（N4）                                                |
| `e2e`              | pnpm install、uv sync → `playwright install --with-deps chromium` → `pnpm --filter e2e test` → 失敗時上傳 report                                                     | 任一旅程失敗                                                  | **#3：整個 job 是否存在**                                            |
| `dependency-audit` | `uv run pip-audit --fail-on high`、`pnpm audit --prod --audit-level high`                                                                                            | 有 high 以上弱點                                              | **#5：整個 job 是否存在**；要的話 `pip-audit` 以 `uv add --dev` 加入 |

`api-contract` job 是 A5 漂移檢查進 CI 的地方，比對內容如下；本機的 `pnpm run api:sync` 與 `check` 指令跑同一組指令。這個 job 不起服務，因為匯出不需要環境變數，也不需要資料庫（`api-schema-export`）。

| 順序 | 產生                                                                                       | 比對對象                                        | 判定失敗的條件                                                                                            |
| :--- | :----------------------------------------------------------------------------------------- | :---------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| 1    | `cd backend && uv run python -m app.scripts.export_openapi`：從 FastAPI app 匯出介面描述檔 | 已提交的 `backend/openapi.json`                 | `git diff --exit-code -- backend/openapi.json` 有差異，或 `git status --porcelain` 顯示它是還沒提交的新檔 |
| 2    | `pnpm --filter frontend api:generate`：Orval 讀 `backend/openapi.json`，清空後重寫產物     | 已提交的 `frontend/src/api/generated/` 整個目錄 | 同上兩個條件；有任何檔案被改、刪除或新增都算                                                              |

- 第 1 步抓的是「改了後端路由或 schema，卻沒重新匯出」；第 2 步抓的是「介面描述檔已更新，卻沒重產前端呼叫層」，或有人手改了產物。
- operationId 的唯一性與「動詞加資源」命名，在第 1 步匯出時由既有的 `assert_unique_operation_ids` 與 `generate_operation_id` 把關，重複就讓匯出以非 0 結束；這次不改這套策略。
- 失敗時 job 要列出不同步的檔名，修正方式是在本機跑 `pnpm run api:sync` 後提交。

`semgrep` 不需要安裝專案依賴。新 job 不會自動變成 `main` 的必過檢查；改 ruleset 是維護者的動作（待決 #10）。

### 本機自查的步驟

`pnpm run check`（指令名見技術待決 N1）依序執行下列步驟；每步呼叫的都是 CI 用的**同一個 package script 或同一個指令**，不另寫一套參數，避免本機與 CI 漂移。

1. 探針殘留檢查（D10 第 3 點）
2. `pnpm format:check`
3. `pnpm check:specs`
4. `pnpm --filter frontend lint`
5. `pnpm --filter frontend typecheck`
6. `pnpm --filter frontend test:coverage`
7. 契約同步後比對（同 `api-contract` job）
8. `cd backend && uv run ruff check . && uv run ruff format --check .`
9. `cd backend && uv run mypy --strict app`
10. `cd backend && uv run lint-imports`
11. `cd backend && uv run pytest`（SQLite），印出 skipped 數
12. 有 `TEST_DATABASE_URL` 時跑 PostgreSQL 那一輪並斷言 0 skipped；沒有時印出「PostgreSQL 那一輪已跳過：未設 TEST_DATABASE_URL」

e2e 與 Semgrep 不在預設步驟內（前者要起服務、後者要另裝工具），以 `--with-e2e`、`--with-semgrep` 開啟；這是否符合「check 要跑哪些檢查」由待決 #11 決定。第 5、8、9 步在 CI 是否也跑依待決 #4，本機一律跑（`openspec/config.yaml` 已要求）。

### 設定範例檔

`.env.example` 每一行都有註解說明用途、哪一層用、Lite 能不能直接用。`.env` 加進 `.gitignore`。

| 變數                     | 範例值                                                                    | 誰讀                                  | 說明                                                                                              |
| :----------------------- | :------------------------------------------------------------------------ | :------------------------------------ | :------------------------------------------------------------------------------------------------ |
| `CORS_ALLOWED_ORIGINS`   | `http://localhost:5173`（選項 A 時加上前端容器來源）                      | backend                               | 唯一必要設定（#504 Q1）；不得含 `*`                                                               |
| `CORS_ALLOW_CREDENTIALS` | `true`                                                                    | backend                               | 有預設值，列出供參考                                                                              |
| `SQLITE_PATH`            | （註解掉）`./data/label_suite.db`                                         | backend、migrate                      | Lite 層；容器內不必改                                                                             |
| `DATABASE_URL`           | （註解掉）`postgresql+asyncpg://user:password@localhost:5432/label_suite` | backend、migrate                      | 設定後走正式層；本機不用容器跑 PostgreSQL 時才需要。範例裡的 `user:password` 是占位字，不是可用值 |
| `POSTGRES_USER`          | `label_suite`                                                             | 正式層編排                            |                                                                                                   |
| `POSTGRES_PASSWORD`      | （空）                                                                    | 正式層編排                            | 必填，未填時 Compose 拒絕啟動（D4）；含 URL 保留字元要先編碼                                      |
| `POSTGRES_DB`            | `label_suite`                                                             | 正式層編排                            |                                                                                                   |
| `VITE_API_BASE_URL`      | `http://localhost:8000`                                                   | 前端開發伺服器、前端映像 build arg    | #505 交接；選項 B 的容器建置用空字串                                                              |
| `FRONTEND_PORT`          | `8080`                                                                    | 兩份編排                              | 前端容器對外埠                                                                                    |
| `BACKEND_PORT`           | `8000`                                                                    | 兩份編排（選項 A）、`scripts/dev.mjs` |                                                                                                   |

`/docs` 與 `/openapi.json` 在正式層是否關閉（待決 #14）：本文預設**不新增設定**，維持 #504 的行為；若要關閉，會新增一個有預設值的設定，牽動 `runtime-config`「其餘設定都有預設值」那條，由 planner 寫進 spec delta。access log 格式（待決 #16）：本文預設維持 uvicorn 的預設 access log；若決定在本次處理，改動只在兩份編排檔的 backend `command`（例如加 `--no-access-log` 或指定 log config），不影響其他設計。

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
  Dev->>Compose: up --build --wait（只用 .env.example 複製來的 .env）
  Compose->>MG: 啟動（只帶資料庫設定）
  MG->>Vol: alembic upgrade head（建立或升級 label_suite.db）
  alt 遷移失敗
    MG-->>Compose: 非 0 結束
    Compose-->>Dev: up 失敗，backend 不啟動，錯誤在 migrate 的 log
  else 遷移成功
    MG-->>Compose: 0 結束（service_completed_successfully）
    Compose->>BE: 啟動 uvicorn
    alt 缺 CORS_ALLOWED_ORIGINS 或含 *
      BE-->>Compose: ConfigError，指出變數名、不印值（B10、S9）
      Compose-->>Dev: up --wait 失敗
    else 設定有效
      loop 每 30 秒（D5）
        Compose->>BE: GET /api/v1/health（容器內）
        BE->>Vol: SELECT 1
        BE-->>Compose: 200 envelope，data.status = ok、data.database = ok
      end
      Compose->>FE: 啟動 nginx（依待決 #2 是否代理 /api/v1）
      Compose-->>Dev: 所有服務 healthy，up 以 0 結束
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
  Dev->>Compose: -f docker-compose.prod.yml up --wait
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
      Compose-->>Dev: 所有服務 healthy
    end
  end
```

### Scenario: 開發伺服器上的健康檢查頁顯示正常

e2e 的那一條旅程；是否也在 CI 跑依待決 #3，是否算作驗收條件 1 的證據依待決 #1。

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

```mermaid
sequenceDiagram
  participant PR as Pull request
  participant Job as coverage job
  participant Art as artifacts
  participant Cmp as check-coverage.mjs
  participant Base as 基準來源（依待決 #7）
  PR->>Job: backend-sqlite、backend-postgres、frontend 都完成後觸發
  Job->>Art: 下載兩份 .coverage.* 與前端 coverage-summary.json
  Job->>Job: coverage combine，輸出 coverage.json
  Job->>Cmp: 實測值
  Cmp->>Base: 讀基準與容許誤差
  Base-->>Cmp: 後端 percent_covered、前端 statements 與 branches
  alt 任一指標低於基準減容許誤差
    Cmp-->>Job: 非 0，印出層、指標、基準、實測
    Job-->>PR: 失敗
  else 全部不低於
    Cmp-->>Job: 0（選項 b 且上升時提示可更新基準）
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

違規時讓 CI 失敗或只回報，依待決 #6；下圖兩支都畫。

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
    Job->>SG: scan --config .semgrep/ backend/ frontend/ e2e/
    alt 有發現
      alt 待決 #6 選「失敗」（加 --error）
        SG-->>Job: 非 0，列出檔案、行號、規則 id
        Job-->>PR: 失敗
      else 待決 #6 選「只回報」
        SG-->>Job: 0，發現寫進 job summary
        Job-->>PR: 通過但有標示
      end
    else 沒有發現
      SG-->>Job: 0
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
| 對外暴露                    | 選項 B 下 backend 不發布埠、只有 nginx 對外（ADR-008 D1）；選項 A 下 backend 直接對外（依待決 #2）；`db` 在兩個選項下都不發布埠                                                                                                                                                                                       |
| log（ADR-008 D3、S9）       | `ConfigError` 只印變數名；健康檢查失敗只記例外型別（既有行為）；CI 不在 log 印任何環境變數值；access log 的查詢字串依待決 #16                                                                                                                                                                                         |
| 測試集答案（Hard Rule 6）   | 不適用：本次不碰答案資料；`e2e/shared/fixtures/` 只放共用的 `test`／`expect`，不放任何資料檔                                                                                                                                                                                                                          |
| 任務設定驅動（Hard Rule 5） | 不適用：沒有任務類型相關的行為                                                                                                                                                                                                                                                                                        |
| CI 權限                     | 新 job 沿用 workflow 的 `permissions: contents: read`；不需要任何 repo secret；ruleset 必過清單只有維護者能改（待決 #10）                                                                                                                                                                                             |

## 技術待決問題

### system-analysis 待決問題的處理

| #   | 主題                             | 本文怎麼處理                                                                                                                               | 設計中的位置              |
| :-- | :------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :------------------------ |
| 1   | 容器裡驗什麼                     | 兩個做法都設計好：(a) compose job 以 `up --wait` 加健康檢查回應驗；(b) e2e 在開發伺服器驗健康檢查頁。擇一或兩者都要由維護者決定            | D5、D7、D8                |
| 2   | 唯一公開入口                     | 共同部分（前端映像是 nginx:alpine）先做；選項 A／B 只差四格                                                                                | D6；部署拓撲圖            |
| 3   | e2e 進不進 CI                    | `e2e` job 已設計，是否存在由維護者決定；骨架與本機指令兩種情況都要                                                                         | D8；CI job 表             |
| 4   | 型別檢查與後端 lint 進不進 CI    | 本機一律跑；CI 的對應步驟標為可選                                                                                                          | CI job 表；本機自查的步驟 |
| 5   | 相依套件掃描                     | `dependency-audit` job 已設計，是否存在由維護者決定                                                                                        | CI job 表                 |
| 6   | Semgrep 失敗或回報、規則集、範圍 | 規則集本文只放兩條專案禁令（`architecture.mdx` 的最低要求）；範圍前後端與 e2e；失敗或回報只差 `--error` 一個旗標                           | `semgrep` 序列圖          |
| 7   | 覆蓋率基準的定義                 | 量測方式定案；基準來源做成可替換的輸入，兩個選項的成本列出；容許誤差是一個數字輸入                                                         | D12                       |
| 8   | 前端覆蓋率分母                   | 排除項沿用；是否擴大 `include` 只改 `vitest.config.ts` 一處                                                                                | D12                       |
| 9   | `hashFiles()` 語意               | 預設照字面寫、行為等於全跑；改成依變更路徑時的做法已寫出                                                                                   | D13                       |
| 10  | 必過檢查清單                     | 不在本 change 內改 ruleset；job 名稱固定，方便維護者勾選                                                                                   | CI job 表                 |
| 11  | 四條根目錄指令的語意             | 本文預設：setup 包住 `scripts/setup.sh` 再裝前後端依賴；dev 起本機開發伺服器；check 依固定順序跑、PostgreSQL 那一輪有條件；指令名衝突見 N1 | 目錄結構；本機自查的步驟  |
| 12  | 文件改寫範圍                     | 不屬設計；本文新增的 N3 併入                                                                                                               | —                         |
| 13  | T9 與 #111 的歸屬                | 不屬設計                                                                                                                                   | —                         |
| 14  | 正式層關閉 `/docs`               | 本文預設不新增設定；改的話影響 `runtime-config`                                                                                            | 設定範例檔                |
| 15  | 健康檢查輪詢頻率、存活端點       | 本文預設 30 秒、不拆端點，`api-contract.md` 因此無新端點；拆的話新增一個端點                                                               | D5                        |
| 16  | access log 格式                  | 本文預設不動；要動只改 backend 的 `command`                                                                                                | 設定範例檔                |

### 本文新發現的待決問題

| #   | 問題                                                                                                                                                                                                                                                                                | 影響                                                                                                       |
| :-- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| N1  | **`pnpm setup` 是 pnpm 的內建指令**（設定 `PNPM_HOME`），根目錄 `package.json` 叫 `setup` 的 script 不會被 `pnpm setup` 執行，必須打 `pnpm run setup`。#506 指名「setup」：要保留這個名字並在文件一律寫 `pnpm run setup`，還是改名（例如 `bootstrap`）？`dev`、`check` 沒有這個問題 | 根目錄 `package.json`；`AGENTS.md` §Required Behaviors 與 acceptance 的人工步驟怎麼寫；與待決 #11 一起決定 |
| N2  | 覆蓋率基準的數字從哪一次量測來：system-analysis 記的後端 97% 是本機單一輪的數字，本文的 CI 量法是兩輪合併（D12），數字會不同；前端若依待決 #8 擴大分母也會改變。T10 §例外 說「以第一次測得的基準為準」——是以**本 PR 在 CI 上第一次量到的值**為基準，還是沿用 acceptance 記的數字？  | 選項 (b) 的 `coverage-baseline.json` 初始值；驗收條件 3 怎麼驗                                             |
| N3  | Lite 資料改用具名 volume（D3）後，`architecture.mdx` §部署與維運 備援列「停掉服務再複製 `./data`」在容器部署下不成立，要改成 `docker compose cp` 或 `docker run --volumes-from` 的寫法。併入待決 #12 的文件範圍？                                                                   | `architecture.mdx` 一列；`technical-writer` 的工作量                                                       |
| N4  | `compose` job（D7）會在每次執行時建置兩個映像並起兩套服務，估計數分鐘。要每張 PR 跑、只在動到編排檔或 Dockerfile 時跑，還是只在本機與驗收時跑？                                                                                                                                     | CI 耗時；驗收條件 1 是否有機械證據；與待決 #9、#10 一起決定                                                |
| N5  | 技術風險，不需維護者決定：`import-linter` 的 `forbidden` 契約是否支援 `app.modules.*.router` 這類萬用字元依版本而定。apply 第一個後端群組先驗證，不支援時改由「列出所有模組」的 unit 測試逐模組產生契約檢查                                                                         | `backend/pyproject.toml` 的契約寫法與那支 unit 測試的範圍                                                  |

### 效能與資源

- **健康檢查輪詢**：30 秒一次、每次一個 `SELECT 1`，backend-skeleton system-design §交易、session 與效能 留下的疑慮在這個頻率下可忽略；多實例或改用外部監控時再評估。
- **CI 時間**：新 job 彼此平行，最長的會是 `compose`（映像建置）與 `e2e`（瀏覽器安裝）。pnpm 用 `actions/setup-node` 的 cache、uv 用 `astral-sh/setup-uv` 的 cache；Docker 建置是否加 layer cache（`docker/build-push-action` 的 gha cache）等實測耗時後再定，本次不預先加。
- **session 生命週期**：本次不碰。API 的 async session 由既有的 `get_db` 管；worker 的 sync session 屬第一個背景工作的 change。
