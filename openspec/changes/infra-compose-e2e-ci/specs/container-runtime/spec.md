# Spec Delta

## Purpose

定義以容器編排重現整套系統的行為：Lite 與正式兩層各起哪些服務、唯一公開入口、遷移與健康檢查的順序、缺設定時的失敗方式，以及設定範例檔的內容，讓 clone 後一條指令就能起服務並以健康檢查確認成功。

## ADDED Requirements

### Requirement: Lite 層以預設值起服務

根目錄的 Lite 編排檔 SHALL 在只以設定範例檔複製出 `.env`、不修改任何值的情況下，起前端、後端與一次性遷移服務，資料庫為檔案型資料庫。`docker compose up --wait` MUST 在所有具健康檢查的服務都健康後才以結束碼 0 結束；之後經公開入口取得的健康檢查回應 MUST 是成功 envelope，服務與資料庫兩項都為 `ok`。

來源：ADR-003 D1、D7；ADR-008 D1；`architecture.mdx` §資料庫雙層；clarification Q1、Q2。

#### Scenario: Lite 編排以預設值起服務並通過健康檢查

- **WHEN** 在乾淨的 clone 以 `.env.example` 複製出 `.env`，執行 `docker compose up --build --wait`
- **THEN** 指令以結束碼 0 結束，`docker compose ps` 中前端與後端都是 healthy、遷移服務以 0 結束
- **AND** 對 `http://localhost:${FRONTEND_PORT}/api/v1/health` 發出請求，回應 200，body 為 `{"data": {"status": "ok", "database": "ok"}, ...}` 形式的成功 envelope

### Requirement: 前端服務是唯一公開入口

兩層編排 SHALL 只有前端服務發布主機埠；後端與資料庫 MUST NOT 發布主機埠，只在編排網路內可達。前端服務 SHALL 服務前端正式建置，並把 `/api/v1/` 下的請求轉發給後端；非檔案路徑 SHALL 回前端頁面，交由前端路由處理。兩層編排 MUST NOT 含 Redis 或 worker 服務。

來源：ADR-008 D1、D2；`architecture.mdx` §容器視圖；Epic #502 §不包含；clarification Q2。

#### Scenario: 只有前端服務發布主機埠

- **WHEN** 對 `docker-compose.yml` 與 `docker-compose.prod.yml` 各執行 `docker compose config`
- **THEN** 兩份輸出中只有前端服務有 `ports`，後端、遷移與資料庫服務都沒有
- **AND** 兩份輸出都沒有 Redis 或 worker 服務

#### Scenario: 後端不能從主機直接連線

- **WHEN** Lite 編排已起，從主機對後端容器的應用埠（8000）發出請求
- **THEN** 連線失敗；同一請求改經 `http://localhost:${FRONTEND_PORT}/api/v1/health` 則回應 200

#### Scenario: 非檔案路徑回前端頁面

- **WHEN** Lite 編排已起，對 `http://localhost:${FRONTEND_PORT}/some/client/route` 發出請求
- **THEN** 回應 200，內容是前端的 `index.html`

### Requirement: 遷移先於後端完成

兩層編排 SHALL 在後端啟動前以一次性服務把資料庫遷移到最新版本；遷移失敗時後端 MUST NOT 啟動，`docker compose up --wait` MUST 以非 0 結束，錯誤只出現在遷移服務的 log。

來源：backend-agent-rules B6；ADR-008 D2；system-design D1。

#### Scenario: 遷移失敗時後端不啟動

- **WHEN** 遷移服務因資料庫連線字串錯誤而以非 0 結束，執行 `docker compose up --wait`
- **THEN** 指令以非 0 結束，後端容器沒有進入 running 狀態，遷移服務的 log 含遷移失敗的訊息

### Requirement: 後端缺必要設定時編排啟動失敗

後端缺少允許來源設定或設定含萬用字元時，`docker compose up --wait` MUST 以非 0 結束；後端 log MUST 指出缺少或無效的變數名，MUST NOT 印出設定值。

來源：backend-agent-rules B10；security-agent-rules S2、S9；`AGENTS.md` Hard Rule 7；主規格 `runtime-config`。

#### Scenario: 允許來源為空時起不來

- **WHEN** `.env` 的 `CORS_ALLOWED_ORIGINS` 設為空字串，執行 `docker compose up --wait`
- **THEN** 指令以非 0 結束，後端 log 含 `CORS_ALLOWED_ORIGINS` 字樣，不含任何設定值

#### Scenario: 允許來源含萬用字元時起不來

- **WHEN** `.env` 的 `CORS_ALLOWED_ORIGINS` 設為 `*`，執行 `docker compose up --wait`
- **THEN** 指令以非 0 結束，後端 log 指出 `CORS_ALLOWED_ORIGINS` 不得含萬用字元

### Requirement: 正式層以 PostgreSQL 起服務

正式層編排檔 SHALL 單獨使用（不疊加在 Lite 上），起前端、後端、一次性遷移服務與 PostgreSQL 資料庫；後端與遷移服務的資料庫連線 SHALL 由 `.env` 的資料庫使用者、密碼與資料庫名組成。所有服務健康後，經公開入口的健康檢查 MUST 回報資料庫為 `ok`。

來源：ADR-008 D1；backend-agent-rules B7；`architecture.mdx` §資料庫雙層；system-design D2。

#### Scenario: 正式層編排以 PostgreSQL 起服務並通過健康檢查

- **WHEN** `.env` 填入 `POSTGRES_PASSWORD`，執行 `docker compose -f docker-compose.prod.yml up --build --wait`
- **THEN** 指令以結束碼 0 結束，資料庫、後端與前端都是 healthy
- **AND** 對 `http://localhost:${FRONTEND_PORT}/api/v1/health` 的回應為 200，`data.database` 為 `ok`

### Requirement: 正式層缺資料庫密碼時拒絕啟動

`.env` 沒有資料庫密碼時，正式層編排 MUST 在建立任何容器前就以非 0 結束，訊息 MUST 指出要設定的變數名。設定範例檔的資料庫密碼 MUST 留空。

來源：`AGENTS.md` Hard Rule 8；backend-agent-rules B10；system-design D4。

#### Scenario: 正式層編排缺資料庫密碼時拒絕啟動

- **WHEN** `.env` 的 `POSTGRES_PASSWORD` 為空或不存在，執行 `docker compose -f docker-compose.prod.yml up --wait`
- **THEN** 指令以非 0 結束，輸出含 `POSTGRES_PASSWORD`
- **AND** `docker compose -f docker-compose.prod.yml ps -a` 不列出任何容器

### Requirement: 容器健康檢查

兩層的後端 SHALL 以既有健康檢查端點作為容器健康檢查，輪詢間隔 30 秒，非 2xx 即判為不健康；前端服務 SHALL 有自己的健康檢查，資料庫服務 SHALL 以資料庫就緒檢查判定健康。本次 MUST NOT 新增不碰資料庫的存活端點。

來源：ADR-008 D1、D10；主規格 `health-check`；clarification Q14；system-design D5。

#### Scenario: 資料庫不可用時後端被判為不健康

- **WHEN** 正式層編排已全部健康，停止資料庫服務並等待 3 次輪詢（約 90 秒加逾時）
- **THEN** `docker compose -f docker-compose.prod.yml ps` 顯示後端為 unhealthy

#### Scenario: 後端健康檢查的輪詢設定

- **WHEN** 對兩份編排檔各執行 `docker compose config`
- **THEN** 後端服務的 `healthcheck.interval` 為 30 秒，且檢查的目標是 `/api/v1/health`

### Requirement: Lite 資料保存在具名 volume

Lite 層的資料庫檔 SHALL 存放在具名 volume；以不移除 volume 的方式停止再啟動後，資料 MUST 保留。

來源：ADR-003 D7；`architecture.mdx` §資料庫雙層；system-design D3。

#### Scenario: 重啟後資料仍在

- **WHEN** Lite 編排已起，在資料庫寫入一筆測試列後執行 `docker compose down`（不帶 `-v`），再執行 `docker compose up --wait`
- **THEN** 該測試列仍存在，遷移服務沒有重建資料庫

#### Scenario: 帶 -v 停止時資料一併移除

- **WHEN** 執行 `docker compose down -v` 後再 `docker compose up --wait`
- **THEN** 資料庫是由遷移服務新建的空資料庫

### Requirement: 設定範例檔列出所有設定且不含 secret

根目錄 `.env.example` SHALL 列出編排檔、後端、前端與本機開發指令讀取的每個設定，每一項附註解說明用途與哪一層使用；Lite 層所需的值 SHALL 可直接使用。檔案 MUST NOT 含任何可用的密碼、API key 或 token。`.env` MUST 被版控忽略，且 MUST NOT 進入任何映像。

來源：`AGENTS.md` Hard Rule 8；backend-agent-rules B10；clarification Q2；#504 Q1；#505 交接。

#### Scenario: 範例檔不含可用的 secret

- **WHEN** 讀取 `.env.example`
- **THEN** `POSTGRES_PASSWORD` 的值為空，連線字串範例只含占位字且預設為註解狀態，沒有任何未註解的密碼、API key 或 token 值

#### Scenario: 允許來源同時涵蓋本機開發與前端容器

- **WHEN** 讀取 `.env.example` 的 `CORS_ALLOWED_ORIGINS`
- **THEN** 值同時含前端開發伺服器的來源（`http://localhost:5173`）與前端容器的公開來源（`http://localhost:${FRONTEND_PORT}` 的預設值），且不含 `*`

#### Scenario: .env 不進版控也不進映像

- **WHEN** 在 repo 根建立含任意內容的 `.env`，執行 `git status --porcelain` 並建置前端與後端映像
- **THEN** `git status` 不列出 `.env`，兩個映像的檔案系統中都沒有 `.env`
