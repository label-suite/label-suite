## ADDED Requirements

### Requirement: e2e 自起的後端在行程內執行背景工作

e2e 預設跑法自起的後端 SHALL 帶 `CELERY_TASK_ALWAYS_EAGER=true`，在自己的行程內同步執行背景工作，不需要 Redis 或 worker；這個值 SHALL 寫在 e2e 設定檔，MUST NOT 讀自根目錄 `.env`。`E2E_TARGET=compose` 時 SHALL 使用容器裡真正的 worker，e2e 設定檔 MUST NOT 對容器傳入這個值。

來源：testing-agent-rules T8；ADR-007 D4；email-celery-worker clarification 技術預設「本機、CI、e2e 的背景工作」。

#### Scenario: e2e 自起的後端帶 eager

- **WHEN** 不設 `E2E_TARGET`，讀取 e2e 設定檔解析後的後端伺服器環境
- **THEN** 環境中 `CELERY_TASK_ALWAYS_EAGER` 為 `true`

#### Scenario: 根目錄 .env 不影響 e2e 的背景工作設定

- **WHEN** 根目錄 `.env` 設 `CELERY_TASK_ALWAYS_EAGER=false`，不設 `E2E_TARGET`，讀取 e2e 設定檔解析後的後端伺服器環境
- **THEN** 環境中 `CELERY_TASK_ALWAYS_EAGER` 仍為 `true`

#### Scenario: 對準容器入口時不起後端也不帶 eager

- **WHEN** 以 `E2E_TARGET=compose E2E_BASE_URL=http://localhost:8080` 讀取 e2e 設定檔
- **THEN** 設定中沒有任何自起的伺服器，因此沒有任何地方帶 `CELERY_TASK_ALWAYS_EAGER`
