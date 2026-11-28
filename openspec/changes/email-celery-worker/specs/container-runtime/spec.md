## MODIFIED Requirements

### Requirement: Lite 層以預設值起服務

根目錄的 Lite 編排檔 SHALL 在只以設定範例檔複製出 `.env`、不修改任何值的情況下，起前端、後端、一次性遷移、Redis 與 worker 服務，資料庫為檔案型資料庫。`docker compose up --wait --wait-timeout 300` MUST 在所有具健康檢查的服務都於 300 秒內健康後才以結束碼 0 結束，逾時 MUST 以非 0 結束；之後經公開入口取得的健康檢查回應 MUST 是成功 envelope，服務與資料庫兩項都為 `ok`。編排所需的容器編排工具最低版本 SHALL 寫在設定範例檔的註解與 `architecture.mdx` §部署與維運。

來源：ADR-003 D1、D7、D8；ADR-008 D1；`architecture.mdx` §資料庫雙層、§容器視圖；clarification Q1、Q2；system-design D7；email-celery-worker clarification 技術預設「本機、CI、e2e 的背景工作」、P1。

#### Scenario: Lite 編排以預設值起服務並通過健康檢查

- **WHEN** 在乾淨的 clone 以 `.env.example` 複製出 `.env`，執行 `docker compose up --build --wait --wait-timeout 300`
- **THEN** 指令以結束碼 0 結束，`docker compose ps` 中前端、後端、Redis 與 worker 都是 healthy、遷移服務以 0 結束
- **AND** 對 `http://localhost:${FRONTEND_PORT}/api/v1/health` 發出請求，回應 200，body 為 `{"data": {"status": "ok", "database": "ok"}, ...}` 形式的成功 envelope

#### Scenario: 範例檔寫出容器編排工具的最低版本

- **WHEN** 讀取 `.env.example` 的註解與 `architecture.mdx` §部署與維運
- **THEN** 兩處寫出同一個容器編排工具最低版本號

### Requirement: 前端服務是唯一公開入口

兩層編排 SHALL 只有前端服務發布主機埠；後端、資料庫、Redis 與 worker MUST NOT 發布主機埠，只在編排網路內可達。前端服務 SHALL 服務前端正式建置，並把 `/api/v1/` 下的請求轉發給後端；非檔案路徑 SHALL 回前端頁面，交由前端路由處理。兩層編排 SHALL 各含一個 `redis` 服務與一個 `worker` 服務。

來源：ADR-008 D1、D2；ADR-003 D8；`architecture.mdx` §容器視圖；clarification Q2；email-celery-worker clarification P1、Q3（Redis 不對外發布埠）。

#### Scenario: 只有前端服務發布主機埠

- **WHEN** 對 `docker-compose.yml` 與 `docker-compose.prod.yml` 各執行 `docker compose config`
- **THEN** 兩份輸出中只有前端服務有 `ports`，後端、遷移、資料庫、`redis` 與 `worker` 服務都沒有
- **AND** 兩份輸出都各有一個 `redis` 服務與一個 `worker` 服務

#### Scenario: 後端不能從主機直接連線

- **WHEN** Lite 編排已起，從主機對後端容器的應用埠（8000）發出請求
- **THEN** 連線失敗；同一請求改經 `http://localhost:${FRONTEND_PORT}/api/v1/health` 則回應 200

#### Scenario: Redis 沒有對應的主機埠

- **WHEN** Lite 編排已起，分別執行 `docker compose port redis 6379` 與 `docker compose port worker 6379`
- **THEN** 兩個指令的輸出都為空，Redis 與 worker 沒有對應到任何主機埠

#### Scenario: 非檔案路徑回前端頁面

- **WHEN** Lite 編排已起，對 `http://localhost:${FRONTEND_PORT}/some/client/route` 發出請求
- **THEN** 回應 200，內容是前端的 `index.html`

### Requirement: 正式層以 PostgreSQL 起服務

正式層編排檔 SHALL 單獨使用（不疊加在 Lite 上），起前端、後端、一次性遷移服務、PostgreSQL 資料庫、Redis 與 worker；後端、遷移服務與 worker 的資料庫連線 SHALL 由 `.env` 的資料庫使用者、密碼與資料庫名組成。所有服務健康後，經公開入口的健康檢查 MUST 回報資料庫為 `ok`。

來源：ADR-008 D1；backend-agent-rules B7；`architecture.mdx` §資料庫雙層；system-design D2；email-celery-worker clarification 技術預設「本機、CI、e2e 的背景工作」「『兩層都能跑』的範圍」。

#### Scenario: 正式層編排以 PostgreSQL 起服務並通過健康檢查

- **WHEN** `.env` 填入 `POSTGRES_PASSWORD`，執行 `docker compose -f docker-compose.prod.yml up --build --wait --wait-timeout 300`
- **THEN** 指令以結束碼 0 結束，資料庫、後端、前端、Redis 與 worker 都是 healthy
- **AND** 對 `http://localhost:${FRONTEND_PORT}/api/v1/health` 的回應為 200，`data.database` 為 `ok`

### Requirement: 容器健康檢查

兩層的後端 SHALL 以既有健康檢查端點作為容器健康檢查，輪詢間隔 30 秒，非 2xx 即判為不健康；前端服務 SHALL 有自己的健康檢查，資料庫服務 SHALL 以資料庫就緒檢查判定健康；Redis SHALL 以 Redis 的 `PING` 判定健康；worker SHALL 每 30 秒向自己發出背景工作框架的 ping，沒有回應即判為不健康。本次 MUST NOT 新增不碰資料庫的存活端點，API 的健康檢查 MUST NOT 回報 Redis 或 worker 的狀態。

來源：ADR-008 D1、D4、D10；主規格 `health-check`；clarification Q14；system-design D5；email-celery-worker clarification 技術預設「健康檢查」「worker 參數」。

#### Scenario: 資料庫不可用時後端被判為不健康

- **WHEN** 正式層編排已全部健康，停止資料庫服務並等待 3 次輪詢（約 90 秒加逾時）
- **THEN** `docker compose -f docker-compose.prod.yml ps` 顯示後端為 unhealthy

#### Scenario: 後端健康檢查的輪詢設定

- **WHEN** 對兩份編排檔各執行 `docker compose config`
- **THEN** 後端服務的 `healthcheck.interval` 為 30 秒，且檢查的目標是 `/api/v1/health`

#### Scenario: Redis 與 worker 的健康檢查設定

- **WHEN** 對兩份編排檔各執行 `docker compose config --format json`
- **THEN** `redis` 的 `healthcheck.test` 含 `redis-cli` 與 `ping`
- **AND** `worker` 的 `healthcheck.interval` 為 30 秒，`healthcheck.test` 含 `inspect ping`

#### Scenario: worker 停止不影響網站的健康檢查

- **WHEN** Lite 編排已全部健康，執行 `docker compose stop worker`
- **THEN** 對 `http://localhost:${FRONTEND_PORT}/api/v1/health` 的回應仍為 200，body 的 `data` 只有 `status` 與 `database` 兩個鍵

### Requirement: 設定範例檔列出所有設定且不含 secret

根目錄 `.env.example` SHALL 列出編排檔、後端、前端與本機開發指令讀取的每個設定，每一項附註解說明用途與哪一層使用；Lite 層所需的值 SHALL 可直接使用；`FORWARDED_ALLOW_IPS` 也在列，並說明只在代理後面才設、直接暴露時不要設；`AUTH_SECRET` 也在列，值為空，註解說明 Lite 層可不設（首次啟動自動產生並存進資料 volume）、正式層必填；三個 `GOOGLE_*`、`RESEND_API_KEY` 與 `MAIL_FROM` 也在列、值為空，註解說明後兩者要一起設或都不設；`REDIS_URL` 也在列並說明預設值與兩層編排檔自己設定；`CELERY_TASK_ALWAYS_EAGER` 列在本機開發段落、值為 `true`，註解說明只有本機開發指令讀它、容器不得設定。檔案 MUST NOT 含任何可用的密碼、API key 或 token。`.env` MUST 被版控忽略，且 MUST NOT 進入任何映像。

來源：`AGENTS.md` Hard Rule 8；backend-agent-rules B10；clarification Q2；#504 Q1；#505 交接；issue #566、trusted-proxy-client-ip clarification T2；login-auth-guard 決定表 PL1；email-celery-worker clarification Q6、技術預設「本機、CI、e2e 的背景工作」。

#### Scenario: 範例檔不含可用的 secret

- **WHEN** 讀取 `.env.example`
- **THEN** `POSTGRES_PASSWORD`、`AUTH_SECRET`、`GOOGLE_CLIENT_SECRET`、`RESEND_API_KEY` 的值都為空，連線字串範例只含占位字且預設為註解狀態，沒有任何未註解的密碼、API key 或 token 值

#### Scenario: 允許來源同時涵蓋本機開發與前端容器

- **WHEN** 讀取 `.env.example` 的 `CORS_ALLOWED_ORIGINS`
- **THEN** 值同時含前端開發伺服器的來源（`http://localhost:5173`）與前端容器的公開來源（`http://localhost:${FRONTEND_PORT}` 的預設值），且不含 `*`

#### Scenario: .env 不進版控也不進映像

- **WHEN** 在 repo 根建立含任意內容的 `.env`，執行 `git status --porcelain` 並建置前端與後端映像
- **THEN** `git status` 不列出 `.env`，兩個映像的檔案系統中都沒有 `.env`

#### Scenario: 範例檔列出 FORWARDED_ALLOW_IPS 並說明用法

- **WHEN** 讀取 `.env.example` 的 `FORWARDED_ALLOW_IPS`
- **THEN** 該項附註解說明：放在代理後面才設、直接暴露時不要設、不得為 `*` 或涵蓋全部位址的網段
- **AND** 沒有任何未註解的值是 `*` 或前綴長度為 0 的網段

#### Scenario: 範例檔說明 AUTH_SECRET 兩層的差別

- **WHEN** 讀取 `.env.example` 的 `AUTH_SECRET`
- **THEN** 該項的值為空，註解說明 Lite 層可不設、正式層必填，以及至少 32 字元

#### Scenario: 範例檔說明寄信與佇列設定

- **WHEN** 讀取 `.env.example` 的 `RESEND_API_KEY`、`MAIL_FROM`、`REDIS_URL` 與 `CELERY_TASK_ALWAYS_EAGER`
- **THEN** `RESEND_API_KEY` 與 `MAIL_FROM` 的值都為空，註解說明兩者要一起設或都不設、只設一個會拒絕啟動
- **AND** `REDIS_URL` 的註解說明預設值為 `redis://localhost:6379`、兩層編排檔自己設定為 `redis://redis:6379`
- **AND** `CELERY_TASK_ALWAYS_EAGER=true` 位在本機開發段落，註解說明只有本機開發指令讀它、設了 `DATABASE_URL` 時不可開啟

## ADDED Requirements

### Requirement: worker 共用後端映像並有停機寬限

兩層的 `worker` SHALL 使用與後端相同的映像，只換啟動指令；SHALL 同時處理 `default` 與 `scoring` 兩個佇列、並發數為 2；停機寬限 MUST 大於 300 秒；SHALL 等 `redis` 健康且遷移服務成功結束後才啟動。後端 SHALL 等 `redis` 健康後才啟動。

來源：ADR-008 D2、D10；ADR-003 D8；backend-agent-rules B9（佇列界線）；`architecture.mdx` §部署與維運「停機」；email-celery-worker clarification 技術預設「worker 參數」。

#### Scenario: worker 與後端用同一個映像

- **WHEN** 對兩份編排檔各執行 `docker compose config --format json`
- **THEN** `worker.image` 等於 `backend.image`，`worker.command` 含 `default,scoring` 與 `--concurrency` `2`

#### Scenario: worker 的停機寬限大於 300 秒

- **WHEN** 對兩份編排檔各執行 `docker compose config --format json`
- **THEN** `worker.stop_grace_period` 換算成秒後大於 300

#### Scenario: worker 與後端的啟動順序

- **WHEN** 對兩份編排檔各執行 `docker compose config --format json`
- **THEN** `worker.depends_on.redis.condition` 為 `service_healthy`、`worker.depends_on.migrate.condition` 為 `service_completed_successfully`
- **AND** `backend.depends_on.redis.condition` 為 `service_healthy`

### Requirement: Lite 層的 worker 掛同一個資料 volume

Lite 層的 `worker` SHALL 掛載後端存放資料庫檔的同一個具名 volume，掛載路徑與後端相同；正式層的 `worker` MUST NOT 掛載該 volume。

來源：`architecture.mdx` §資料庫雙層；ADR-003 D7；email-celery-worker clarification 技術預設「『兩層都能跑』的範圍」。

#### Scenario: Lite 層的 worker 與後端掛同一個 volume

- **WHEN** 對 `docker-compose.yml` 執行 `docker compose config --format json`
- **THEN** `worker` 的 volumes 中有一項的 `source` 與 `target` 都和 `backend` 存放資料庫檔的那一項相同

#### Scenario: 正式層的 worker 不掛 Lite 的 volume

- **WHEN** 以環境提供 `POSTGRES_PASSWORD` 與 `AUTH_SECRET`，對 `docker-compose.prod.yml` 執行 `docker compose config --format json`
- **THEN** `worker` 沒有掛載任何具名 volume

### Requirement: 容器內不同步執行背景工作

兩層的後端與 `worker` MUST NOT 帶 `CELERY_TASK_ALWAYS_EAGER`；即使 `.env` 設了它，兩份編排檔也 MUST NOT 把它傳進任何容器。

來源：ADR-003 D8（不採用行程內執行）；email-celery-worker clarification 技術預設「本機、CI、e2e 的背景工作」。

#### Scenario: 編排檔不把 eager 傳進容器

- **WHEN** 以 `.env.example` 複製出 `.env`（其中 `CELERY_TASK_ALWAYS_EAGER=true`），對兩份編排檔各執行 `docker compose config --format json`
- **THEN** 每一個服務的 `environment` 都沒有 `CELERY_TASK_ALWAYS_EAGER`

### Requirement: worker 起來後連得上佇列

兩層全部健康後，對 `worker` 執行背景工作框架的 ping SHALL 得到該 worker 的回應。

來源：issue #756 §驗收條件 1；ADR-003 D8；email-celery-worker clarification 技術預設「CI `compose`」。

#### Scenario: worker 回應 ping

- **WHEN** Lite 層與正式層各自以 `docker compose up --wait --wait-timeout 300` 起好後，執行 `docker compose exec worker celery -A app.worker inspect ping`
- **THEN** 兩層的指令都以結束碼 0 結束，輸出含 `pong`
