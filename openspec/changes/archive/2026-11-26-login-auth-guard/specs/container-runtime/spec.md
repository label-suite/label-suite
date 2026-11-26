# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
