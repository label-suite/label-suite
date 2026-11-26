# container-runtime Specification

## Purpose

定義以容器編排重現整套系統的行為：Lite 與正式兩層各起哪些服務、唯一公開入口、遷移與健康檢查的順序、缺設定時的失敗方式，以及設定範例檔的內容，讓 clone 後一條指令就能起服務並以健康檢查確認成功。

## Requirements

### Requirement: Lite 層以預設值起服務

根目錄的 Lite 編排檔 SHALL 在只以設定範例檔複製出 `.env`、不修改任何值的情況下，起前端、後端與一次性遷移服務，資料庫為檔案型資料庫。`docker compose up --wait --wait-timeout 300` MUST 在所有具健康檢查的服務都於 300 秒內健康後才以結束碼 0 結束，逾時 MUST 以非 0 結束；之後經公開入口取得的健康檢查回應 MUST 是成功 envelope，服務與資料庫兩項都為 `ok`。編排所需的容器編排工具最低版本 SHALL 寫在設定範例檔的註解與 `architecture.mdx` §部署與維運。

來源：ADR-003 D1、D7；ADR-008 D1；`architecture.mdx` §資料庫雙層；clarification Q1、Q2；system-design D7。

#### Scenario: Lite 編排以預設值起服務並通過健康檢查

- **WHEN** 在乾淨的 clone 以 `.env.example` 複製出 `.env`，執行 `docker compose up --build --wait --wait-timeout 300`
- **THEN** 指令以結束碼 0 結束，`docker compose ps` 中前端與後端都是 healthy、遷移服務以 0 結束
- **AND** 對 `http://localhost:${FRONTEND_PORT}/api/v1/health` 發出請求，回應 200，body 為 `{"data": {"status": "ok", "database": "ok"}, ...}` 形式的成功 envelope

#### Scenario: 範例檔寫出容器編排工具的最低版本

- **WHEN** 讀取 `.env.example` 的註解與 `architecture.mdx` §部署與維運
- **THEN** 兩處寫出同一個容器編排工具最低版本號

### Requirement: 前端在後端健康後才啟動

兩層編排的前端服務 SHALL 等後端服務通過容器健康檢查後才啟動；後端沒有變成健康時，前端服務 MUST NOT 啟動，`docker compose up --wait` MUST 以非 0 結束。

來源：ADR-008 D1、D10；clarification Q2、Q14；system-design D5。

#### Scenario: 兩份編排檔的前端都以後端健康為啟動條件

- **WHEN** 對 `docker-compose.yml` 與 `docker-compose.prod.yml` 各執行 `docker compose config --format json`
- **THEN** 兩份輸出中前端服務對後端服務的相依條件都是 `service_healthy`

#### Scenario: 後端不健康時前端不啟動

- **WHEN** 以會讓後端健康檢查一直失敗的設定執行 `docker compose up --wait --wait-timeout 300`
- **THEN** 指令以非 0 結束，`docker compose ps -a` 中前端容器不是 running

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

- **WHEN** 以讓遷移無法完成的資料庫設定執行 `docker compose up --wait --wait-timeout 300`，遷移服務以非 0 結束
- **THEN** 指令以非 0 結束，後端容器沒有進入 running 狀態，遷移服務的 log 含遷移失敗的訊息

### Requirement: 後端缺必要設定時編排啟動失敗

兩份編排檔 MUST NOT 為允許來源設定預設值。允許來源未設或為空字串時，編排工具 MUST 在建立任何容器前就以非 0 結束，訊息 MUST 指出要設定的變數名 `CORS_ALLOWED_ORIGINS`。允許來源含萬用字元時，`docker compose up --wait` MUST 以非 0 結束；後端 log MUST 指出無效的變數名，MUST NOT 印出設定值。

來源：backend-agent-rules B10；security-agent-rules S2、S9；`AGENTS.md` Hard Rule 7；主規格 `runtime-config`；system-design D6、D7。

#### Scenario: 允許來源為空時起不來

- **WHEN** `.env` 的 `CORS_ALLOWED_ORIGINS` 設為空字串，執行 `docker compose up --wait --wait-timeout 300`
- **THEN** 指令以非 0 結束，輸出含 `CORS_ALLOWED_ORIGINS`
- **AND** `docker compose ps -a` 不列出任何容器

#### Scenario: 缺允許來源時編排檔無法解析

- **WHEN** 以 `.env.example` 複製出 `.env` 後，以空字串的 `CORS_ALLOWED_ORIGINS` 環境變數執行 `docker compose config --quiet`
- **THEN** 指令以非 0 結束，輸出含 `CORS_ALLOWED_ORIGINS`

#### Scenario: 允許來源含萬用字元時起不來

- **WHEN** `.env` 的 `CORS_ALLOWED_ORIGINS` 設為 `http://localhost:5173,*`，執行 `docker compose up --wait --wait-timeout 300`
- **THEN** 指令以非 0 結束，後端 log 指出 `CORS_ALLOWED_ORIGINS` 不得含萬用字元，log 中沒有出現 `http://localhost:5173,*` 這串值

### Requirement: 正式層以 PostgreSQL 起服務

正式層編排檔 SHALL 單獨使用（不疊加在 Lite 上），起前端、後端、一次性遷移服務與 PostgreSQL 資料庫；後端與遷移服務的資料庫連線 SHALL 由 `.env` 的資料庫使用者、密碼與資料庫名組成。所有服務健康後，經公開入口的健康檢查 MUST 回報資料庫為 `ok`。

來源：ADR-008 D1；backend-agent-rules B7；`architecture.mdx` §資料庫雙層；system-design D2。

#### Scenario: 正式層編排以 PostgreSQL 起服務並通過健康檢查

- **WHEN** `.env` 填入 `POSTGRES_PASSWORD`，執行 `docker compose -f docker-compose.prod.yml up --build --wait --wait-timeout 300`
- **THEN** 指令以結束碼 0 結束，資料庫、後端與前端都是 healthy
- **AND** 對 `http://localhost:${FRONTEND_PORT}/api/v1/health` 的回應為 200，`data.database` 為 `ok`

### Requirement: 正式層缺資料庫密碼時拒絕啟動

`.env` 沒有資料庫密碼時，正式層編排 MUST 在建立任何容器前就以非 0 結束，訊息 MUST 指出要設定的變數名。設定範例檔的資料庫密碼 MUST 留空。

來源：`AGENTS.md` Hard Rule 8；backend-agent-rules B10；system-design D4。

#### Scenario: 正式層編排缺資料庫密碼時拒絕啟動

- **WHEN** `.env` 的 `POSTGRES_PASSWORD` 為空或不存在，執行 `docker compose -f docker-compose.prod.yml up --wait --wait-timeout 300`
- **THEN** 指令以非 0 結束，輸出含 `POSTGRES_PASSWORD`
- **AND** `docker compose -f docker-compose.prod.yml ps -a` 不列出任何容器

#### Scenario: 缺資料庫密碼時正式層編排檔無法解析

- **WHEN** 以 `.env.example` 複製出 `.env` 後，以空字串的 `POSTGRES_PASSWORD` 環境變數執行 `docker compose -f docker-compose.prod.yml config --quiet`
- **THEN** 指令以非 0 結束，輸出含 `POSTGRES_PASSWORD`

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

- **WHEN** Lite 編排已起，在資料庫寫入一筆測試列後執行 `docker compose down`（不帶 `-v`），再執行 `docker compose up --wait --wait-timeout 300`
- **THEN** 該測試列仍存在，遷移服務沒有重建資料庫

#### Scenario: 帶 -v 停止時資料一併移除

- **WHEN** 執行 `docker compose down -v` 後再 `docker compose up --wait --wait-timeout 300`
- **THEN** 資料庫是由遷移服務新建的空資料庫

### Requirement: 設定範例檔列出所有設定且不含 secret

根目錄 `.env.example` SHALL 列出編排檔、後端、前端與本機開發指令讀取的每個設定，每一項附註解說明用途與哪一層使用；Lite 層所需的值 SHALL 可直接使用；`FORWARDED_ALLOW_IPS` 也在列，並說明只在代理後面才設、直接暴露時不要設；`AUTH_SECRET` 也在列，值為空，註解說明 Lite 層可不設（首次啟動自動產生並存進資料 volume）、正式層必填；三個 `GOOGLE_*` 與 `RESEND_API_KEY` 也在列、值為空。檔案 MUST NOT 含任何可用的密碼、API key 或 token。`.env` MUST 被版控忽略，且 MUST NOT 進入任何映像。

來源：`AGENTS.md` Hard Rule 8；backend-agent-rules B10；clarification Q2；#504 Q1；#505 交接；issue #566、trusted-proxy-client-ip clarification T2；login-auth-guard 決定表 PL1。

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

### Requirement: 兩層編排固定網段並釘住前端位址

兩份編排檔 SHALL 各自宣告預設網路的固定子網段，並以 `ip_range` 把動態配位限制在子網段的一部分，同時為 `frontend` 服務指定落在動態範圍之外的固定 IPv4 位址。兩份檔的子網段、動態配位範圍與 `frontend` 位址 MUST 是同一組值；子網段 MUST 在 Docker 預設位址池之外。

來源：issue #566；ADR-008 D1；`architecture.mdx` §部署與維運；clarification Q2、T1。

#### Scenario: 兩層宣告同一組子網段與前端位址

- **WHEN** 對 `docker-compose.yml` 與 `docker-compose.prod.yml` 各執行 `docker compose config --format json`（正式層另以環境提供 `POSTGRES_PASSWORD`）
- **THEN** 兩份輸出的預設網路都有 `ipam` 的 `subnet` 與 `ip_range`，兩者的值各自相同
- **AND** 兩份輸出的 `frontend` 服務都有 `ipv4_address`，值相同且落在 `subnet` 內、不在 `ip_range` 內

#### Scenario: 子網段在 Docker 預設位址池之外

- **WHEN** 讀取兩份編排檔有效設定中預設網路的 `subnet`
- **THEN** 該子網段不在 `172.16.0.0/12` 內，也不在 `192.168.0.0/16` 內

### Requirement: 後端只預設信任前端的固定位址

兩份編排檔 SHALL 把 `FORWARDED_ALLOW_IPS` 傳進後端容器，`.env` 未設時預設值 MUST 恰為 `frontend` 服務的固定位址，不得是 `*`、前綴長度為 0 的網段，也不得涵蓋整個編排網路。`.env` 設了值時 MUST 以該值為準。`migrate` 服務不需要此變數。

來源：issue #566 驗收條件 3；ADR-004 D7；ADR-008 D1；clarification Q2、T2；`system-design.md` 實測 E2、E4、E7。

#### Scenario: 預設只信任前端的固定位址

- **WHEN** 以 `.env.example` 複製出 `.env`，展開兩份編排檔的有效設定
- **THEN** 兩份的後端服務 `FORWARDED_ALLOW_IPS` 都等於各自 `frontend` 服務的 `ipv4_address`
- **AND** 兩份的值都不是 `*`，也不含前綴長度為 0 的網段

#### Scenario: .env 的值覆寫預設

- **WHEN** 以 `--env-file` 指向含 `FORWARDED_ALLOW_IPS=192.0.2.7` 的檔案（等同在 `.env` 加上該值），展開兩份編排檔的有效設定
- **THEN** 兩份的後端服務 `FORWARDED_ALLOW_IPS` 都是 `192.0.2.7`

### Requirement: 正式層缺 AUTH_SECRET 時拒絕啟動

`.env` 沒有 `AUTH_SECRET` 或為空字串時，正式層編排 MUST 在建立任何容器前就以非 0 結束，訊息 MUST 指出 `AUTH_SECRET`。

來源：login-auth-guard 決定表 PL1；`AGENTS.md` Hard Rule 8；backend-agent-rules B10。

#### Scenario: 正式層編排缺 AUTH_SECRET 時拒絕啟動

- **WHEN** 以 `.env.example` 複製出 `.env`、填好 `POSTGRES_PASSWORD`、`AUTH_SECRET` 留空，執行 `docker compose -f docker-compose.prod.yml config --quiet`
- **THEN** 指令以非 0 結束，輸出含 `AUTH_SECRET`

### Requirement: Lite 層的 AUTH_SECRET 存在資料 volume 並跨重啟沿用

Lite 層沒有設定 `AUTH_SECRET` 時，後端 SHALL 把自動產生的秘密存在資料庫檔所在的具名 volume；以不移除 volume 的方式停止再啟動後 MUST 沿用同一把，帶 `-v` 停止後重新產生。秘密 MUST NOT 出現在映像或任何容器的環境變數裡。

來源：login-auth-guard 決定表 PL1；ADR-003 D7；`AGENTS.md` Hard Rule 8；主規格 `container-runtime`「Lite 資料保存在具名 volume」。

#### Scenario: 重啟後登入狀態仍有效

- **WHEN** Lite 編排以範例檔起服務、登入取得 cookie，執行 `docker compose down`（不帶 `-v`）再 `docker compose up --wait --wait-timeout 300`
- **THEN** 以原本的 cookie 經公開入口送出 `GET /api/v1/current-session` 回覆 `200`

#### Scenario: 秘密不在容器環境變數

- **WHEN** Lite 編排以範例檔起服務後執行 `docker compose exec backend env`
- **THEN** 輸出沒有值不為空的 `AUTH_SECRET`
