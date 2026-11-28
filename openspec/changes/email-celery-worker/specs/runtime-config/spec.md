## MODIFIED Requirements

### Requirement: 其餘設定都有預設值

系統 SHALL 在只設定合法的 `CORS_ALLOWED_ORIGINS` 時即可啟動（Lite 層，即不設 `DATABASE_URL`）：`CORS_ALLOW_CREDENTIALS` 預設為 true，`API_DOCS_ENABLED` 預設為 true，`DATABASE_URL` 可不設，`SQLITE_PATH` 預設為 `./data/label_suite.db`，`LOG_LEVEL` 預設為 `INFO`，`FORWARDED_ALLOW_IPS` 預設為 `127.0.0.1,::1`，`REDIS_URL` 預設為 `redis://localhost:6379`，`CELERY_TASK_ALWAYS_EAGER` 預設為 false，`AUTH_SECRET`、三個 `GOOGLE_*`、`RESEND_API_KEY` 與 `MAIL_FROM` 可不設；SQLite 檔的父目錄不存在時 MUST 自動建立。設了 `DATABASE_URL` 的正式層另外 MUST 設定 `AUTH_SECRET`（見「`AUTH_SECRET` 的來源依資料庫層而定」）。`API_DOCS_ENABLED` 或 `CELERY_TASK_ALWAYS_EAGER` 的值無法解析為布林時，服務 MUST 拒絕啟動、以非零狀態結束，錯誤訊息 MUST 指出該設定的名稱與原因，且 MUST NOT 印出設定值。`LOG_LEVEL` 只接受 `DEBUG`、`INFO`、`WARNING`、`ERROR`、`CRITICAL`（不分大小寫）；其他值 MUST 讓服務拒絕啟動、以非零狀態結束，錯誤訊息 MUST 指出 `LOG_LEVEL` 這個名稱與原因，且 MUST NOT 印出設定值。

來源：ADR-003 D7、backend-agent-rules B10、security-agent-rules S9、clarification Q1、issue #592、archive infra-compose-e2e-ci clarification Q13、issue #567、request-access-log clarification Q12、issue #566、trusted-proxy-client-ip clarification Q10、Q12；login-auth-guard 決定表 PL1；email-celery-worker clarification Q6、技術預設「本機、CI、e2e 的背景工作」。

#### Scenario: 只設允許來源即可啟動

- **WHEN** 只設定 `CORS_ALLOWED_ORIGINS=http://localhost:5173`、其餘設定都不設，在一個沒有 `data/` 目錄的工作目錄啟動服務
- **THEN** 服務啟動成功，`GET /api/v1/health` 回覆 `200`
- **AND** `./data/label_suite.db` 已被建立
- **AND** `GET /docs` 回覆 `200`（`API_DOCS_ENABLED` 預設為 true）

#### Scenario: API_DOCS_ENABLED 不是布林值時啟動失敗

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `API_DOCS_ENABLED=CANARY-maybe` 啟動服務
- **THEN** 服務拒絕啟動，程序以非零狀態結束
- **AND** 錯誤訊息含 `API_DOCS_ENABLED`，且不含 `CANARY-maybe`

#### Scenario: CELERY_TASK_ALWAYS_EAGER 不是布林值時啟動失敗

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `CELERY_TASK_ALWAYS_EAGER=CANARY-maybe` 啟動服務
- **THEN** 服務拒絕啟動，程序以非零狀態結束
- **AND** 錯誤訊息含 `CELERY_TASK_ALWAYS_EAGER`，且不含 `CANARY-maybe`

#### Scenario: 佇列與寄信設定的預設值

- **WHEN** 只設定合法的 `CORS_ALLOWED_ORIGINS` 載入設定
- **THEN** 佇列位址為 `redis://localhost:6379`，背景工作不在行程內同步執行，這個部署沒有設定寄信服務

#### Scenario: LOG_LEVEL 未設時輸出等級為 INFO

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS`、不設 `LOG_LEVEL` 啟動服務，處理請求期間後端寫出一筆 `INFO` 紀錄與一筆 `DEBUG` 紀錄
- **THEN** 輸出含那一筆 `level=INFO` 的紀錄，不含那一筆 `DEBUG` 紀錄

#### Scenario: LOG_LEVEL 不分大小寫

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 分別加 `LOG_LEVEL=warning` 與 `LOG_LEVEL=WARNING` 啟動服務
- **THEN** 兩次都啟動成功，且輸出等級都是 `WARNING`（`INFO` 紀錄不輸出）

#### Scenario: LOG_LEVEL 不合法時啟動失敗

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `LOG_LEVEL=CANARY-verbose` 啟動服務
- **THEN** 服務拒絕啟動，程序以非零狀態結束
- **AND** 錯誤訊息含 `LOG_LEVEL`，且不含 `CANARY-verbose`

### Requirement: 寄信服務只看有沒有設定

`RESEND_API_KEY` 與 `MAIL_FROM` SHALL 一起設或都不設：兩個都有設且不是空字串時，這個部署視為有設定寄信服務；兩個都沒設或為空字串時視為沒有；只設其中一個時服務與 worker MUST 拒絕啟動，錯誤訊息 MUST 指出缺少的變數名，MUST NOT 印出任何設定值。登入頁設定的 `selfRegistrationEnabled` MUST 等於這個判斷。API 與 worker MUST 以同一個判斷決定有沒有設定。

來源：規格 01-02 §已確認決議 Q10；規格 01-01 §登入頁 第 10 條；login-auth-guard 決定表 sa-6；backend-agent-rules B10；security-agent-rules S9；email-celery-worker clarification Q6。

#### Scenario: 有設寄信服務時開放自行註冊

- **WHEN** 以 `RESEND_API_KEY=re_test` 與 `MAIL_FROM=Label Suite <noreply@example.test>` 啟動服務後送出 `GET /api/v1/auth-options`
- **THEN** `data.selfRegistrationEnabled` 為 `true`

#### Scenario: 空字串視為沒有設定

- **WHEN** 以 `RESEND_API_KEY=` 與 `MAIL_FROM=` 啟動服務後送出 `GET /api/v1/auth-options`
- **THEN** `data.selfRegistrationEnabled` 為 `false`

#### Scenario: 只設金鑰時拒絕啟動

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `RESEND_API_KEY=re_CANARY-key`、不設 `MAIL_FROM`，分別啟動服務與載入 worker 的設定
- **THEN** 兩者都拒絕啟動，錯誤訊息含 `MAIL_FROM`，且不含 `re_CANARY-key`

#### Scenario: 只設寄件人時拒絕啟動

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `MAIL_FROM=CANARY-from@example.test`、不設 `RESEND_API_KEY`，啟動服務
- **THEN** 服務拒絕啟動，錯誤訊息含 `RESEND_API_KEY`，且不含 `CANARY-from`

## ADDED Requirements

### Requirement: 行程內同步執行背景工作只限 Lite 層

`CELERY_TASK_ALWAYS_EAGER` 為 true 時，背景工作 SHALL 在呼叫的行程內同步執行，不經佇列。設了 `DATABASE_URL` 時 `CELERY_TASK_ALWAYS_EAGER` 為 true，服務與 worker MUST 拒絕啟動，錯誤訊息 MUST 指出 `CELERY_TASK_ALWAYS_EAGER`，且 MUST NOT 印出 `DATABASE_URL` 的值。

來源：ADR-003 D8（不採用行程內執行的理由）；backend-agent-rules B10；security-agent-rules S9；email-celery-worker clarification 技術預設「本機、CI、e2e 的背景工作」。

#### Scenario: 正式層開啟 eager 時拒絕啟動

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS`、`AUTH_SECRET`、`DATABASE_URL=postgresql://user:CANARY-pw@db/app` 加 `CELERY_TASK_ALWAYS_EAGER=true` 啟動服務
- **THEN** 服務拒絕啟動，程序以非零狀態結束，錯誤訊息含 `CELERY_TASK_ALWAYS_EAGER`，且不含 `CANARY-pw`

#### Scenario: Lite 層開啟 eager 時背景工作不經佇列

- **WHEN** 不設 `DATABASE_URL`、`CELERY_TASK_ALWAYS_EAGER=true`、有設定寄信服務、佇列位址指向沒有服務在聽的埠，呼叫端以排入背景交出一封信
- **THEN** 呼叫端得到「已排入」，寄信服務的替身收到一次請求，沒有對佇列位址的連線嘗試

### Requirement: 佇列位址在啟動時驗證

`REDIS_URL` SHALL 是 `redis://` 或 `rediss://` 加主機（可帶連接埠與帳密），路徑 MUST 為空或只有 `/`，不得帶資料庫編號；不合格時服務與 worker MUST 拒絕啟動，錯誤訊息 MUST 指出 `REDIS_URL` 與原因，MUST NOT 印出設定值。佇列、工作結果與快取 SHALL 分別使用該位址的第 0、1、2 號資料庫。

來源：backend-agent-rules B10；security-agent-rules S9；ADR-003 D8；`architecture.mdx` §非同步任務；email-celery-worker clarification Q6。

#### Scenario: 佇列位址不合格時拒絕啟動

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS`，分別以 `REDIS_URL=http://CANARY-host:6379`、`redis://CANARY-host:6379/3`、空字串啟動服務
- **THEN** 三次都拒絕啟動，錯誤訊息含 `REDIS_URL`，且不含 `CANARY-host`

#### Scenario: 佇列與工作結果使用不同的資料庫編號

- **WHEN** 以 `REDIS_URL=redis://redis:6379` 載入設定
- **THEN** 佇列位址為 `redis://redis:6379/0`，工作結果位址為 `redis://redis:6379/1`

### Requirement: worker 只需要自己的設定

worker SHALL 只讀取資料庫、佇列、寄信與 `LOG_LEVEL` 的設定，並套用相同的驗證；它 MUST NOT 要求 `CORS_ALLOWED_ORIGINS` 與 `AUTH_SECRET`，正式層也一樣。

來源：backend-agent-rules B10；email-celery-worker clarification 技術預設「Settings 分層」。

#### Scenario: worker 不需要 API 專用的設定

- **WHEN** 不設 `CORS_ALLOWED_ORIGINS` 與 `AUTH_SECRET`，分別在不設與設定 `DATABASE_URL` 的情況下載入 worker 的設定
- **THEN** 兩次都載入成功

#### Scenario: worker 的設定不合格時拒絕啟動

- **WHEN** 不設 `CORS_ALLOWED_ORIGINS`，以 `LOG_LEVEL=CANARY-verbose` 載入 worker 的設定
- **THEN** 載入失敗，錯誤訊息含 `LOG_LEVEL`，且不含 `CANARY-verbose`

### Requirement: 兩層編排把佇列與寄信設定傳進後端與 worker

兩層的編排檔 SHALL 對後端與 `worker` 傳入 `REDIS_URL=redis://redis:6379`，並把 `.env` 的 `RESEND_API_KEY`、`MAIL_FROM` 傳入兩者，`.env` 未設時傳空字串；`.env` 的 `LOG_LEVEL` SHALL 也傳進 `worker`，未設時為 `INFO`。編排檔 MUST NOT 為此改用整份 `.env` 傳入的方式。

來源：issue #567；ADR-008 D3、D4；backend-agent-rules B10；email-celery-worker clarification Q6。

#### Scenario: 兩個服務都帶佇列與寄信設定

- **WHEN** 以 `.env.example` 複製出 `.env`，對兩份編排檔各執行 `docker compose config --format json`（正式層另以環境提供 `POSTGRES_PASSWORD` 與 `AUTH_SECRET`）
- **THEN** `backend` 與 `worker` 的 `environment` 都含 `REDIS_URL`（值 `redis://redis:6379`）、`RESEND_API_KEY`、`MAIL_FROM`
- **AND** `worker` 的 `LOG_LEVEL` 為 `INFO`

#### Scenario: .env 的寄信設定傳進兩個服務

- **WHEN** 以 `--env-file` 疊加含 `RESEND_API_KEY=re_test` 與 `MAIL_FROM=noreply@example.test` 的檔案，展開兩份編排檔的有效設定
- **THEN** 兩份的 `backend` 與 `worker` 的這兩個值都與檔案相同
