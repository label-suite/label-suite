# Design

## Context

動機見 `proposal.md` §Why。元件、類別圖與六張 Sequence 圖都在 `system-design.md`，本文只記決策與取捨，不重畫。行為以 `specs/` 為準。

現況與限制：

- `backend/app/` 沒有任何背景工作；`app/oidc/` 是唯一的 B12 入口套件，它的替身寫法（`tests/support/google_oidc.py` 換 `httpx.AsyncClient.send`）是本卡寄信替身的樣板
- `app/core/config.py` 兩層：`DatabaseSettings`（Alembic 讀）與 `Settings`（API 讀）；`mail_configured()` 目前在 `Settings`，只看 `RESEND_API_KEY`
- 兩份編排檔、`container-runtime` 契約、CI `compose` job 都寫死「不得有 Redis 或 worker」（clarification P1）
- `pyproject.toml` 有九條 import 契約；`test_layer_boundaries.py` 以名稱集合比對，`test_entry_contracts.py` 以 `CHECKED_PACKAGES` 與 `ENTRY_TOP_LEVEL_PACKAGES` 守頂層套件
- `clarification.md` Q1–Q8 與技術預設是本文的上限：本文不新增它們沒有的功能

## Goals / Non-Goals

**Goals:**

- 六個元件照 `system-design.md` §骨架 落地，依賴方向不變
- 兩條寄法（當場寄、排入背景）共用同一個 transport、同一套失敗分類與紀錄規則
- 「eager 到不了容器」與「信件內容到不了 log」兩件事都有機械檢查，不只靠審查
- 後端測試不需要 Redis；容器層由 CI `compose` 證明 worker 起得來

**Non-Goals:**

- 任何消費者（#723、#724、#727、#728、#766）的信件內容、畫面、訊息、一次性連結與頻率限制
- worker 的同步資料庫驅動與同步 session（留給 #767）
- 在 CI 讓一封信真的經佇列送到假寄信服務（T8，留給第一個消費者的 e2e）；因此 `ResendTransport` 的基底網址不做成設定
- API 健康檢查回報佇列或 worker 狀態（技術預設「健康檢查」）
- 寄信紀錄表、監控、批次寄送

## Decisions

### D1 六個元件與依賴方向照 system-design

依 `system-design.md` §骨架、§元件與職責、§依賴方向與 import 契約。`app/mail/` 是頂層入口套件（B12 (a) 寫法，與 `app/oidc/` 同），`app/worker.py` 是 worker 的組裝點，寄信 task 放 `app/mail/tasks.py`（clarification Q8）。`app.core.celery_app` 不 import 任何 task，task 清單由 `app/worker.py` 以 `include=["app.mail.tasks"]` 帶入。

替代方案：task 放 `app/modules/mail/`（五個消費者各要一條跨模組放行）或 `app/core/`（core 會依賴入口）。clarification Q8 已選入口套件。

### D2 設定三層：`WorkerSettings` 夾在中間

`DatabaseSettings` ← `WorkerSettings` ← `Settings`（`system-design.md` §分層與類別、技術預設「Settings 分層」）。`WorkerSettings` 持有 `REDIS_URL`、`RESEND_API_KEY`、`MAIL_FROM`、`CELERY_TASK_ALWAYS_EAGER`、`LOG_LEVEL`，並在 model validator 做三件事：

- `RESEND_API_KEY` 與 `MAIL_FROM` 全有或全無（空字串當成沒設，沿用 login-auth-guard design D4），只設一個時 `ConfigError` 指出缺的那個（clarification Q6）
- `database_url` 有值且 eager 為 true 時 `ConfigError("CELERY_TASK_ALWAYS_EAGER: ...")`（技術預設）
- `REDIS_URL` 只接受 `redis`／`rediss` scheme、路徑為空或 `/`；`broker_url()`、`result_backend_url()` 推導 `/0`、`/1`（`architecture.mdx` §非同步任務 已固定編號）

`LOG_LEVEL` 從 `Settings` 下移到 `WorkerSettings`，worker 才能用同一個驗證；`Settings` 的行為不變。`mail_configured()` 下移，語意改成兩者都有設，`selfRegistrationEnabled` 跟著它，`account` 的回應形狀不變（`api-contract.md` §理由）。

替代方案：worker 讀完整 `Settings`，編排檔替 worker 帶齊 `CORS_ALLOWED_ORIGINS`、`AUTH_SECRET`。被否決：worker 拿到用不到的秘密。

### D3 兩條寄法共用 transport，當場寄在 thread 跑

依 clarification Q1、`system-design.md` §待決 1 選項 (b)：

- `MailService.enqueue(message) -> MailDispatch`：`async`，回 `QUEUED` 或 `NOT_CONFIGURED`；排不進丟 `MailQueueUnavailableError`（eager 時的處理見 D4）
- `MailService.send_now(message) -> MailOutcome`：`async`，以 `anyio.to_thread.run_sync` 執行 `ResendTransport.send`，回 `SENT`／`NOT_CONFIGURED`／`FAILED`；`TransientMailError` 與 `PermanentMailError` 都轉成 `FAILED`，不重試
- `ResendTransport` 是同步 `httpx.Client`、逾時 10 秒、`Authorization: Bearer`、`Idempotency-Key: <mail_id>`；把結果分類成成功（回訊息 id）、`TransientMailError`（連線錯誤、逾時、`429`、`5xx`）、`PermanentMailError`（其他 `4xx`），丟出時 `from None`（技術預設「重試政策」、clarification Q7）

當場寄放 thread 的理由與 `core/passwords.py` 把 argon2 放進 thread 相同：`httpx.Client` 是同步呼叫，直接在 `async def` 裡跑會卡住 event loop。兩條路徑共用 transport，失敗分類只寫一次。

替代方案：當場寄改用 `httpx.AsyncClient`。被否決：worker 是同步行程，會變成兩套 transport 與兩份替身。

### D4 eager 的護欄與在 async 路由裡的處理

- 設定層：D2 的 `ConfigError` 擋住「正式層加 eager」
- 編排層：兩份編排檔的 `environment` 明列每個變數，不用 `env_file`，所以 `.env` 的 `CELERY_TASK_ALWAYS_EAGER=true` 進不了容器；CI `compose` 的結構斷言檢查兩層每個服務都沒有它（`specs/container-runtime`「容器內不同步執行背景工作」）
- 行程內：`create_celery_app` 依設定設 `task_always_eager` 與 `task_eager_propagates=False`；`MailService.enqueue` 偵測到 eager 時以 `anyio.to_thread.run_sync` 執行 `apply_async`，讓同步的 HTTP 呼叫不在 event loop 上跑；非 eager 時直接 `apply_async`（ADR-003 D8「在 `async def` 路由裡直接呼叫，不另包 executor」；`system-design.md` §待決 5 末段）。消費者不必知道目前是不是 eager

eager 下 `self.retry` 會立即同步重跑，退避看不到；這只發生在本機與 e2e，重試行為由單元測試以 `send_mail.apply()` 驗證（D8）。

### D5 佇列逾時與發送重試上限

依 clarification Q4、`system-design.md` §session 與交易邊界：`broker_transport_options={"socket_connect_timeout": 2, "socket_timeout": 2}`、`task_publish_retry_policy={"max_retries": 2, "interval_start": 0, "interval_step": 0.5, "interval_max": 1}`。最壞情況約三次 2 秒連線加 1.5 秒間隔，約 7.5 秒，`specs/mail-delivery`「排不進佇列時明確回報」寫成 10 秒上限留餘裕。`kombu.exceptions.OperationalError` 與 `redis.exceptions.ConnectionError` 轉成 `MailQueueUnavailableError() from None`，紀錄只寫 `outcome=queue_unavailable` 與 `excType`。

替代方案：`enqueue` 一律包進 thread。被否決：觸發 ADR-003 D8 的重新討論，clarification Q4 已決定不包。

### D6 Celery 端的脫敏：`argsrepr`、`ignore_result`、無文字的錯誤

依 `system-design.md` §log 脫敏、clarification Q3、Q5：

- `apply_async(kwargs={"mail_id": ..., "payload": ...}, queue="default", argsrepr="()", kwargsrepr="{redacted}")`：Celery 的 `Received task`、`inspect active` 與事件用的是這兩個欄位
- `shared_task(bind=True, ignore_result=True)`：result backend 不存任何寄信資料，`succeeded in …s: None`
- 錯誤型別（`MailDeliveryError` 及其子類）沒有訊息文字、不繼承 `AppError`；Celery 的 `Retry in 60s: <exc>` 與 `raised unexpected: <exc>` 因此只印出空字串
- `task_serializer="json"`、`accept_content=["json"]`、`result_serializer="json"`
- 寄信紀錄以既有 `KeyValueFormatter` 的 `msg` 寫一行 `key=value`，欄位只限 `specs/mail-delivery`「寄信紀錄只寫允許的欄位」的白名單；`PermanentMailError.provider_status` 只轉成 `reason=status_<碼>`

最終失敗只留 log，不新增資料表（clarification Q3）；寄信 task 不開 session。這兩點是 B9「結果寫進資料庫」「只傳識別資訊」「重查權限」的例外，理由寫進 `backend-agent-rules` B9（tasks 排入）。

### D7 未寄出連結的專用 logger

`app/mail/unsent_link.py` 的 `record_unsent_link(kind, link)` 寫進 logger `app.mail.unsent_link`：`propagate=False`、自己一個寫 stderr 的 handler、沿用 `KeyValueFormatter`（clarification Q5、`system-design.md` §沒有設定時的連結）。`MailService` 不呼叫它；是否呼叫由消費者依規格決定。`configure_logging` 重設 root handler 時不得移除這個 logger 的 handler，測試以「root 上的收集器收不到、專用 handler 收得到」驗證。

### D8 測試替身與 TDD 的落點

- 寄信服務替身放 `backend/tests/support/resend.py`，以 `monkeypatch` 換 `httpx.Client.send`，可設定每次回應（狀態碼、逾時、連線錯誤）並記下每個請求的標頭與本文；與 `FakeGoogle` 同一種寫法，semgrep `test-boundaries.yml` 不必改（testing-agent-rules T6）
- task 本體以 `send_mail.apply(kwargs=...)` 測：會經參數驗證但不經 broker；重試以 `apply()` 的 `Retry` 例外與 `countdown` 斷言，不真的等 60 秒
- 「排入」以 eager 加「參數可 JSON 往返」斷言；「佇列連不上」以指向關閉埠的 `REDIS_URL` 測（連線被拒會立即失敗，另以 monkeypatch 讓 publish 拋 `OperationalError` 測分類）
- canary 測試一次跑完 `specs/mail-delivery` 的五條路徑，同時收 `caplog` 與 Celery 自己的 logger
- 「沒有對佇列位址的連線嘗試」以 monkeypatch `kombu.Connection` 的建立為計數器斷言
- 後端測試不需要 Redis（`specs/ci-quality-gates`「後端測試不需要佇列服務」）

替代方案：CI 後端 job 加 `redis:7` service。被否決：技術預設已定不加。

### D9 import 契約與守門測試

依技術預設「import 契約」：

- `pyproject.toml` 新增「Routers do not import the mail entry」（`forbidden`，source `app.modules.*.router`、forbidden `app.mail`、`allow_indirect_imports = true`）與「Mail entry does not import modules」（`forbidden`，source `app.mail`、forbidden `app.modules`，不設 `allow_indirect_imports`，間接也擋）
- 三條入口契約的 `source_modules` 加 `app.worker`；`test_entry_contracts.py` 的 `CHECKED_PACKAGES` 同步；`import_tree.py` 的 `ENTRY_TOP_LEVEL_PACKAGES` 加 `mail`，`ENTRY_THIRD_PARTY[MAIL]` 維持 `{"resend", "smtplib", "aiosmtplib"}`（clarification Q7）
- `test_dependency_classification.py` 的 `GENERAL_PACKAGES` 加 `celery`、`kombu`、`redis`（clarification Q7）；`anyio` 若尚未歸類一併加入
- `test_layer_boundaries.py` 的 `EXPECTED_CONTRACTS` 加兩個名稱，並為兩條新契約各加一個常駐違規樣本

### D10 紀錄設定

`log_config.PINNED_WARNING_LOGGERS` 加 `httpx`、`httpcore`（clarification Q5）。`create_celery_app` 設 `worker_hijack_root_logger=False`，並以 `celery.signals.setup_logging` 呼叫既有的 `configure_logging(settings)`（它只讀 `log_level`，`WorkerSettings` 即可滿足）；Celery 不再裝自己的 handler，worker 的輸出經同一個 `KeyValueFormatter`，`traceId` 為 `-`（`specs/server-logging`「worker 的紀錄與 API 用同一個格式」）。

### D11 兩層編排與 CI `compose`

編排檔照 `system-design.md` §兩層編排 的表：`redis:7-alpine`、不發布埠、`redis-cli ping`；`worker` 沿用 `x-backend-image`、`command: ["celery", "-A", "app.worker", "worker", "-Q", "default,scoring", "--concurrency", "2"]`、`stop_grace_period: 330s`、healthcheck `celery -A app.worker inspect ping -d celery@$$HOSTNAME` 每 30 秒；Lite 掛 `label-suite-data:/app/data`，正式層帶 `*database-url`。`backend` 與 `worker` 都以 `REDIS_URL: redis://redis:6379`、`RESEND_API_KEY: ${RESEND_API_KEY:-}`、`MAIL_FROM: ${MAIL_FROM:-}` 傳入；`backend.depends_on` 加 `redis: service_healthy`。`docker-compose.prod.yml` 開頭註解改寫（clarification P1）。

CI `compose` job：

- 「Assert the structure of both orchestration files」把 `redis|worker` 的不存在斷言換成：兩者存在、只有 `frontend` 有 `ports`、`worker.image == backend.image`、`stop_grace_period` 大於 300 秒、`worker.command` 含 `default,scoring`、Lite 的 `worker` 掛 `label-suite-data`、正式層 `worker` 沒有具名 volume、兩層 `backend` 與 `worker` 都有 `REDIS_URL`、`RESEND_API_KEY`、`MAIL_FROM`，且每個服務都沒有 `CELERY_TASK_ALWAYS_EAGER`；開頭註解同步
- 兩層各自 `up --wait` 並檢查健康之後，新增一步 `docker compose exec -T worker celery -A app.worker inspect ping`（正式層帶 `-f docker-compose.prod.yml` 與兩個產生的秘密）
- `scripts/tests/ci-workflow.test.mjs` 的 C7：靜態斷言的測試改成檢查新斷言（不再找 `redis\|worker` 的不存在寫法），步驟順序表加入兩個 `inspect ping` 步驟

`scripts/ci-changed-paths.mjs` 的 `COMPOSE_EXACT` 加 `.env.example`：`compose` job 以 `cp .env.example .env` 起兩層，本卡起 `.env.example` 的寄信設定全有或全無會決定兩層能不能啟動，只改它而不跑 `compose` 會漏掉這種破壞。新檔案都在 `backend/` 底下，已被既有的 `backend/` 前綴涵蓋，不需另加。`scripts/tests/ci-changed-paths.test.mjs` 加一條「只改 `.env.example` 時 `compose=true`」。

### D12 本機與 e2e 的 eager

- `.env.example` 的 Local development 段落加 `CELERY_TASK_ALWAYS_EAGER=true`；`scripts/dev.mjs` 程式不改，它本來就把 `.env` 交給後端（`specs/workspace-commands` 的 Scenario 以 `dev.test.mjs` 對 `loadDevEnv` 驗證）
- `e2e/playwright.config.ts` 的後端 `webServer.env` 加 `CELERY_TASK_ALWAYS_EAGER: "true"`；`E2E_TARGET=compose` 時沒有 `webServer`，不受影響
- 本機想走真佇列的步驟（清掉 eager、`docker run redis:7`、另開 `celery -A app.worker worker`、Windows 加 `--pool=solo`）寫進 `local-development.mdx`（技術預設 T9）

### D13 常駐文件由 technical-writer 在實作群組最後一個 task 之前改

`rules.tasks` 寫「依實作校正常駐文件由寫那段程式的實作角色完成」，但 `clarification.md`「交給後續產出」明定 `backend-modules.mdx`、`architecture.mdx`、`backend-agent-rules`、ADR-003、ADR-008 D3、`local-development.mdx` 與 `.env.example` 標 `[@technical-writer]`。clarification 是本 change 的決議，以它為準；tasks 把這些文件放在後端群組最後一個 task（契約漂移檢查）之前，讓 technical-writer 依已完成的程式校正。`.env.example` 是編排與設定的一部分，但同樣交 technical-writer，並由後續的容器編排驗證證明可用。

## Risks / Trade-offs

- [Redis 單實例掉訊息時佇列中的信會遺失] → ADR-003 D8 已接受；消費者可保存 `enqueue` 回的 `mail_id` 自行追蹤
- [一次性連結在 worker 取走前以明文停在 Redis] → Redis 不發布埠、ack 後即刪、`argsrepr` 遮蔽、`ignore_result`（clarification Q3）
- [只設 `RESEND_API_KEY` 的既有部署升級後拒絕啟動] → 錯誤訊息點名 `MAIL_FROM`；`.env.example` 與 `local-development.mdx` 寫明兩者一起設；PR 說明列為部署設定的 BREAKING
- [寄信服務冪等鍵的有效期短於整段重試（約 13 分鐘）時可能重寄] → apply 時先查證寄信服務文件，結果寫進 `backend-modules.mdx` 的「背景工作與寄信」一節；若有效期不足，屬故障類中斷，停下回報
- [eager 下重試立即同步重跑、看不到退避] → 只在本機與 e2e；重試政策以 `send_mail.apply()` 的單元測試驗證
- [本機設了 `DATABASE_URL` 指向本機 PostgreSQL 又沿用範例檔的 eager 時，`pnpm run dev` 拒絕啟動] → 錯誤訊息點名 `CELERY_TASK_ALWAYS_EAGER`；`local-development.mdx` 寫明要改走真佇列
- [CI `compose` 只驗 `inspect ping`，沒有驗整封信經佇列] → 技術預設 T8 接受；第一個消費者的 e2e 補上
- [`celery`、`redis`、`kombu` 擴大 `pip-audit` 面] → `dependency-audit` 照常把關；有已知弱點就停下回報
- [`configure_logging` 被 Celery signal 呼叫時重複安裝 handler] → 沿用既有函式的冪等寫法，並以 worker 端紀錄格式的測試覆蓋

## Migration Plan

部署：

1. 升級前在 `.env` 補 `MAIL_FROM`（已設 `RESEND_API_KEY` 的部署必做；沒設的不必）
2. `docker compose up --build --wait --wait-timeout 300`（正式層加 `-f docker-compose.prod.yml`）：多起 `redis` 與 `worker`，`backend` 等 `redis` 健康後才啟動
3. `docker compose exec worker celery -A app.worker inspect ping` 回 `pong`

資料庫：無 migration，Alembic revision 不變。

回滾：還原本 change 的 commit 後重新 `up --build`；編排檔不再有 `redis` 與 `worker`，`docker compose up --remove-orphans` 移除兩個孤兒容器。`MAIL_FROM` 留在 `.env` 不影響舊版（舊版不讀它）。Redis 沒有掛 volume，回滾不留資料；回滾當下佇列裡還沒寄出的信會遺失，與 ADR-003 D8 接受的範圍相同。

## Open Questions

- 寄信服務 `Idempotency-Key` 的有效期與重複請求時的回應碼：apply 第一個寄信 task 前以寄信服務文件查證；只影響文件內容與替身的回應設定，不改 specs、做法與 task 切分（有效期不足時則屬故障類中斷，見 Risks）
