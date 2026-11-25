# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: 設定範例檔列出所有設定且不含 secret

根目錄 `.env.example` SHALL 列出編排檔、後端、前端與本機開發指令讀取的每個設定，每一項附註解說明用途與哪一層使用；Lite 層所需的值 SHALL 可直接使用；`FORWARDED_ALLOW_IPS` 也在列，並說明只在代理後面才設、直接暴露時不要設。檔案 MUST NOT 含任何可用的密碼、API key 或 token。`.env` MUST 被版控忽略，且 MUST NOT 進入任何映像。

來源：`AGENTS.md` Hard Rule 8；backend-agent-rules B10；clarification Q2；#504 Q1；#505 交接；issue #566、trusted-proxy-client-ip clarification T2。

#### Scenario: 範例檔不含可用的 secret

- **WHEN** 讀取 `.env.example`
- **THEN** `POSTGRES_PASSWORD` 的值為空，連線字串範例只含占位字且預設為註解狀態，沒有任何未註解的密碼、API key 或 token 值

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
