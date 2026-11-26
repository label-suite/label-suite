# Spec Delta

## MODIFIED Requirements

### Requirement: 其餘設定都有預設值

系統 SHALL 在只設定合法的 `CORS_ALLOWED_ORIGINS` 時即可啟動（Lite 層，即不設 `DATABASE_URL`）：`CORS_ALLOW_CREDENTIALS` 預設為 true，`API_DOCS_ENABLED` 預設為 true，`DATABASE_URL` 可不設，`SQLITE_PATH` 預設為 `./data/label_suite.db`，`LOG_LEVEL` 預設為 `INFO`，`FORWARDED_ALLOW_IPS` 預設為 `127.0.0.1,::1`，`AUTH_SECRET`、三個 `GOOGLE_*` 與 `RESEND_API_KEY` 可不設；SQLite 檔的父目錄不存在時 MUST 自動建立。設了 `DATABASE_URL` 的正式層另外 MUST 設定 `AUTH_SECRET`（見「`AUTH_SECRET` 的來源依資料庫層而定」）。`API_DOCS_ENABLED` 的值無法解析為布林時，服務 MUST 拒絕啟動、以非零狀態結束，錯誤訊息 MUST 指出 `API_DOCS_ENABLED` 這個名稱與原因，且 MUST NOT 印出設定值。`LOG_LEVEL` 只接受 `DEBUG`、`INFO`、`WARNING`、`ERROR`、`CRITICAL`（不分大小寫）；其他值 MUST 讓服務拒絕啟動、以非零狀態結束，錯誤訊息 MUST 指出 `LOG_LEVEL` 這個名稱與原因，且 MUST NOT 印出設定值。

來源：ADR-003 D7、backend-agent-rules B10、security-agent-rules S9、clarification Q1、issue #592、archive infra-compose-e2e-ci clarification Q13、issue #567、request-access-log clarification Q12、issue #566、trusted-proxy-client-ip clarification Q10、Q12；login-auth-guard 決定表 PL1。

#### Scenario: 只設允許來源即可啟動

- **WHEN** 只設定 `CORS_ALLOWED_ORIGINS=http://localhost:5173`、其餘設定都不設，在一個沒有 `data/` 目錄的工作目錄啟動服務
- **THEN** 服務啟動成功，`GET /api/v1/health` 回覆 `200`
- **AND** `./data/label_suite.db` 已被建立
- **AND** `GET /docs` 回覆 `200`（`API_DOCS_ENABLED` 預設為 true）

#### Scenario: API_DOCS_ENABLED 不是布林值時啟動失敗

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `API_DOCS_ENABLED=CANARY-maybe` 啟動服務
- **THEN** 服務拒絕啟動，程序以非零狀態結束
- **AND** 錯誤訊息含 `API_DOCS_ENABLED`，且不含 `CANARY-maybe`

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

## ADDED Requirements

### Requirement: `AUTH_SECRET` 的來源依資料庫層而定

有設 `AUTH_SECRET` 時，兩層都 SHALL 用它，長度不足 32 字元 MUST 拒絕啟動。沒設或為空字串時：正式層 MUST 拒絕啟動；Lite 層 SHALL 讀 SQLite 檔同目錄下的 `auth_secret`，不存在就產生一把並以只有擁有者可讀寫的權限存進去，之後重用。錯誤訊息與 log MUST 指出變數名，MUST NOT 印出秘密的值、長度或雜湊。

來源：login-auth-guard 決定表 PL1；ADR-004 D1；AGENTS.md Hard Rule 8；backend-agent-rules B10；security-agent-rules S9；`system-design.md` §`AUTH_SECRET` 的來源。

#### Scenario: 正式層沒設 AUTH_SECRET 時拒絕啟動

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 與 `DATABASE_URL`、不設 `AUTH_SECRET` 啟動服務
- **THEN** 服務拒絕啟動，程序以非零狀態結束，錯誤訊息含 `AUTH_SECRET`

#### Scenario: AUTH_SECRET 太短時拒絕啟動

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `AUTH_SECRET=CANARY-short` 啟動服務
- **THEN** 服務拒絕啟動，錯誤訊息含 `AUTH_SECRET`，且不含 `CANARY-short`

#### Scenario: Lite 層沒設時自動產生並重用

- **WHEN** 以 `SQLITE_PATH=<暫存目錄>/a.db`、不設 `AUTH_SECRET` 啟動服務並登入，停止後以同樣設定再啟動
- **THEN** `<暫存目錄>/auth_secret` 存在，權限為 `0600`
- **AND** 第一次啟動取得的登入 cookie 在第二次啟動後送出 `GET /api/v1/current-session` 仍回覆 `200`
- **AND** 兩次啟動的 log 都不含 `auth_secret` 檔案的內容

#### Scenario: 刪掉產生的秘密後所有登入狀態失效

- **WHEN** Lite 層以自動產生的秘密運作，登入後停止服務、刪掉 `auth_secret`、再啟動
- **THEN** 原本的登入 cookie 送出 `GET /api/v1/current-session` 回覆 `401 AUTH_REQUIRED`

### Requirement: Google 登入的設定一起設或一起不設

`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`GOOGLE_REDIRECT_URI` 三個 SHALL 一起設或一起不設：三個都設時這個部署有設定 Google；三個都不設時沒有設定；只設一部分時 MUST 拒絕啟動，錯誤訊息指出缺少的變數名且不印出任何設定值。

來源：ADR-004 D4；規格 01-01 §已確認決議 Q10；backend-agent-rules B10；security-agent-rules S9。

#### Scenario: 只設一部分時拒絕啟動

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS` 加 `GOOGLE_CLIENT_ID=CANARY-id`、不設另外兩個，啟動服務
- **THEN** 服務拒絕啟動，錯誤訊息含 `GOOGLE_CLIENT_SECRET` 與 `GOOGLE_REDIRECT_URI`，且不含 `CANARY-id`

#### Scenario: 三個都不設時沒有 Google

- **WHEN** 三個 Google 設定都不設，啟動服務後送出 `GET /api/v1/auth-options`
- **THEN** `data.googleEnabled` 為 `false`

### Requirement: 寄信服務只看有沒有設定

`RESEND_API_KEY` 有設且不是空字串時，這個部署 SHALL 視為有設定寄信服務；沒設或為空字串時視為沒有。登入頁設定的 `selfRegistrationEnabled` MUST 等於這個判斷。

來源：規格 01-02 §已確認決議 Q10；規格 01-01 §登入頁 第 10 條；login-auth-guard 決定表 sa-6。

#### Scenario: 有設寄信服務時開放自行註冊

- **WHEN** 以 `RESEND_API_KEY=re_test` 啟動服務後送出 `GET /api/v1/auth-options`
- **THEN** `data.selfRegistrationEnabled` 為 `true`

#### Scenario: 空字串視為沒有設定

- **WHEN** 以 `RESEND_API_KEY=` 啟動服務後送出 `GET /api/v1/auth-options`
- **THEN** `data.selfRegistrationEnabled` 為 `false`
