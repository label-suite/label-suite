# Tasks

所有指令都在 `backend/` 下執行（`cd backend && ...`）。Python 依賴一律 `uv add`／`uv add --dev`，不得出現 `pip install`。每個群組提交前，該群組新增的程式都要通過 `uv run ruff check .`、`uv run ruff format --check .`、`uv run mypy --strict app` 與 `uv run pytest`。integration 測試一律標 `@pytest.mark.integration`；只能在 PostgreSQL 上成立的測試另標 `@pytest.mark.postgres`，沒設 `TEST_DATABASE_URL` 時自動跳過（clarification Q5）。

## 1. 專案骨架與工具

- [ ] 1.1 在 `backend/` 建立 uv 專案與 `app/` 套件（`app/core/`、`app/modules/`、`app/scripts/`、`app/i18n/`、`tests/unit/`、`tests/integration/`，目錄見 `system-design.md` §目錄結構）；`pyproject.toml` 的 `version = "0.0.0"`、`requires-python = ">=3.12"`（design D1、clarification Q7）；以 `uv add fastapi "uvicorn[standard]" pydantic-settings "sqlalchemy[asyncio]" aiosqlite asyncpg alembic` 與 `uv add --dev pytest pytest-asyncio pytest-cov httpx ruff mypy` 加入依賴並提交 `uv.lock`；在 `pyproject.toml` 寫入 ruff、mypy（`pydantic.mypy` plugin）與 pytest（`asyncio_mode`、`integration` 與 `postgres` 兩個 marker）設定（design D11、D10）。驗證：`uv sync` 成功、`grep '^version = "0.0.0"' pyproject.toml` 有輸出、`uv run ruff check .`、`uv run ruff format --check .`、`uv run mypy --strict app` 全部以 0 結束 [@backend-developer]

## 2. 設定、共用 schema 與訊息目錄（可平行）

- [ ] 2.1 實作 `app/core/config.py` 的 `Settings`：`CORS_ALLOWED_ORIGINS` 為唯一必要設定（逗號切分、拒絕缺少、空清單、`*`、帶路徑或缺 scheme）、`CORS_ALLOW_CREDENTIALS` 預設 true、`DATABASE_URL` 只接受 PostgreSQL 系列並正規化成 `postgresql+asyncpg://`、`SQLITE_PATH` 預設 `./data/label_suite.db` 並轉絕對路徑；驗證錯誤只含欄位名與原因、不含設定值（design D7、clarification Q1）。先寫 `tests/unit/test_config.py` 涵蓋 spec `runtime-config` 四個啟動失敗 Scenario 的設定驗證部分、「非 PostgreSQL 的連線字串讓啟動失敗」與預設值，再實作。驗證：`uv run pytest tests/unit/test_config.py` 通過 [@backend-developer]
- [ ] 2.2 實作 `app/core/schemas.py`：`ApiModel`（小駝峰 alias、`extra="forbid"`）、`ApiResponse[T]`、`ErrorResponse`、`ErrorDetail`、`PaginatedResponse[T]`（後三欄以推導產生）、`PaginationParams`（`limit` 預設 20、1..100，`offset` 預設 0、>= 0），並覆寫泛型元件名為 `XResponse`／`XPageResponse`／`XPage`（`system-design.md` §元件清單、design D6、clarification Q8）。先寫 `tests/unit/test_schemas.py` 涵蓋 spec `api-envelope` 分頁的五個 Scenario、「回應欄位名為小駝峰」，以及 spec `api-schema-export`「分頁外層的元件名」的元件名斷言，再實作。驗證：`uv run pytest tests/unit/test_schemas.py` 通過 [@backend-developer]
- [ ] 2.3 建立 `app/i18n/zh-TW/messages.json` 與 `app/i18n/en/messages.json`（文案取 `api-contract.md` §錯誤碼 表列字串），實作 `app/core/i18n.py` 的語言挑選與取字（兩語言 key 集合不同就拋例外），並在 `app/core/errors.py` 定義 `AppError`、`NotFoundError`、`NotAcceptableError`、`DatabaseUnavailableError`（design D5、clarification Q2）。先寫 `tests/unit/test_i18n.py` 涵蓋 spec `response-localization` 第一個 Requirement 的語言挑選規則（q 值、略過不支援、`*`、`zh`／`zh-Hant`／大小寫、未帶時 zh-TW）與全部被拒的判定，再實作。驗證：`uv run pytest tests/unit/test_i18n.py` 通過 [@backend-developer]

## 3. 資料庫連線與遷移基礎

- [ ] 3.1 實作 `app/core/db.py`：`Base` 與約束命名慣例、依 `Settings` 建立 async engine（Lite 層建立父目錄並設 `PRAGMA foreign_keys=ON`；正式層 `connect_args={"timeout": 5}`、`pool_pre_ping=True`）、sessionmaker 與 `get_db`（一個請求一個 session、例外時 rollback、不 commit）（`system-design.md` §關鍵設計細節「資料庫與 session」、design D8）。先寫測試：unit 斷言 `get_db` 例外時 rollback 且不 commit；integration 斷言 SQLite 連線的 `PRAGMA foreign_keys` 為 1，並以只存在於 `tests/` 的 `sample`／`owner` 表涵蓋 spec `database-migration`「約束名稱依固定規則產生」（design D9）。驗證：`uv run pytest` 通過，且設定 `TEST_DATABASE_URL` 後約束名稱測試在 PostgreSQL 也通過 [@dba]
- [ ] 3.2 建立 Alembic：`alembic.ini`（`script_location`、`file_template` 依 `system-design.md` §資料模型異動）、async `env.py`（URL 取自 `Settings`、可由 `config.attributes["connection"]` 傳入連線、`render_as_batch=True`、`compare_type=True`、以 `pkgutil` 掃 `app.modules.*.models`）、`script.py.mako`，並以 `uv run alembic revision -m "baseline"` 產生 `upgrade`／`downgrade` 都只有 `pass` 的基準遷移（design D9、clarification Q8）；建立 `tests/conftest.py` 的測試資料庫 fixture（有 `TEST_DATABASE_URL` 用 PostgreSQL，否則用 `tmp_path` 下的 SQLite 檔，schema 一律 `alembic upgrade head`）。先寫 integration 測試涵蓋 spec `database-migration`「資料庫遷移在兩種資料庫上可升可降」「基準遷移不建立業務資料表」「遷移連到與服務相同的資料庫」。本次不建任何資料表，`data-table-dictionary.mdx`、`database-schema.er.json` 不動，不需 `pnpm check:er`（`system-design.md` §資料模型異動）。驗證：`uv run pytest -m integration` 通過，設定 `TEST_DATABASE_URL` 後再跑一次也通過 [@dba]

## 4. 應用組裝與錯誤處理

本群組還沒有匯出工具與正式端點，`openapi.json` 的產生與契約比對從第 6 群組開始。

- [ ] 4.1 實作 `app/core/envelope.py`（成功與錯誤外層、`timestamp` 為 UTC 毫秒 `Z`、`code` 成功固定 `OK`）與 `app/core/errors.py` 的 handler 註冊（`AppError`、`RequestValidationError` 只取 `loc`／`type`／`msg`、Starlette `HTTPException` 的 `404`／`405` 保留 `Allow`）（`system-design.md` §關鍵設計細節「外層與 camelCase」「422 的逐欄位錯誤」、design D4）。先寫 unit 測試斷言 `RequestValidationError` 轉出的 `ErrorDetail` 只有四個鍵且不含送出的值、`timestamp` 格式，再實作。驗證：`uv run pytest tests/unit` 通過 [@backend-developer]
- [ ] 4.2 實作 `app/main.py` 的 `create_app(settings)`：`Settings` 驗證失敗時改拋只含欄位名與原因的例外、lifespan 建立與釋放 engine、`CORSMiddleware` 明列 origins／methods／headers 與 `expose_headers=["X-Correlation-ID"]`、`/api/v1` 父 router 以 `responses=` 宣告 `404`／`405`／`406`／`500` 為 `ErrorResponse`、註冊 handler（`system-design.md` §元件清單 `create_app`、design D2、D3、D6）；在 `tests/conftest.py` 加入以 `lifespan_context` 包住 `httpx.AsyncClient(ASGITransport)` 的 client fixture，以及只存在於 `tests/` 的探測 router（一條帶 body 的 `POST`、一條成功的 `GET`、一條丟 `RuntimeError` 的 `GET`）（clarification Q8、N4）。先寫 integration 測試涵蓋 spec `api-envelope`「非驗證錯誤的 errors 為 null」「通用錯誤碼與 HTTP 狀態對應」中的 404／405／422、「請求驗證失敗回 422 外層與逐欄位錯誤」「未宣告的 body 欄位被拒收」「無法解析的 JSON 回 422」「驗證錯誤不回顯送出的值」「不存在的路徑回 404 外層」「外層時間為 UTC 毫秒格式」，spec `runtime-config`「允許來源的請求帶跨來源標頭」「預檢回應明列方法與標頭」「不在清單內的來源不帶跨來源標頭」，以及以 `subprocess` 執行 `uv run uvicorn app.main:create_app --factory` 驗證「缺必要設定時啟動失敗」程序以非零狀態結束（design D10）。驗證：`uv run pytest` 通過 [@backend-developer]

## 5. 追蹤編號、本地化與未處理例外中介層

本群組沒有新增端點與 schema，`openapi.json` 的產生與契約比對從第 6 群組開始。

- [ ] 5.1 實作 `app/core/middleware.py` 的 `CorrelationIdMiddleware`（自帶值符合 `^[A-Za-z0-9-]{8,64}$` 才沿用，否則產生 UUID4；在 `http.response.start` 補 `X-Correlation-ID`；值寫進 `scope["state"]` 與 contextvar），並讓 `Envelope` 的 `traceId` 取同一個值（`system-design.md` §關鍵設計細節「追蹤編號」、design D3、clarification Q8）。先寫測試：unit 涵蓋接受與丟棄規則；integration 涵蓋 spec `request-correlation` 全部 Scenario（成功回應以探測 `GET` 代替健康檢查，第 7 群組再以 `/api/v1/health` 補一條）。驗證：`uv run pytest` 通過 [@backend-developer]
- [ ] 5.2 實作 `UnhandledExceptionMiddleware`（回 `500 INTERNAL_ERROR` 通用訊息、不露堆疊與例外訊息、回應尚未開始時才改寫；以 `logging` 寫一筆含 `traceId`、method、path、例外的 `ERROR`，不記 body、query、header、cookie）與 `LocaleMiddleware`（只作用在 `/api/v1`、全部被拒回 `406` zh-TW、在 `http.response.start` 補 `Content-Language`），並依 `system-design.md` §請求穿過的層 的順序掛進 `create_app`（design D3、D4、clarification Q2、§不需維護者決定的結論 待決 16）。先寫測試：unit 斷言 `app.user_middleware` 的順序；integration 涵蓋 spec `api-envelope`「未處理例外回 500 外層且不露出堆疊」「未處理例外的紀錄含追蹤編號且不含請求內容」（以 `caplog`）與「通用錯誤碼與 HTTP 狀態對應」中的 406／500，spec `response-localization` 全部 Scenario（成功訊息以探測 `GET` 代替健康檢查）。驗證：`uv run pytest` 通過 [@backend-developer]

## 6. 操作識別名與介面描述檔匯出

- [ ] 6.1 實作 `app/core/openapi.py`：`generate_operation_id`（依 method、去掉 `/api/v1` 後最後一個非參數路徑段與回應是否為分頁決定「動詞加資源」，單複數用一條規則加不規則字表）、`assert_unique_operation_ids`（撞名時列出識別名與兩條路由）、覆寫 `app.openapi` 把 `422` 改成 `ErrorResponse` 並刪除 `HTTPValidationError`／`ValidationError`，並在 `create_app` 設定 `generate_unique_id_function` 與唯一性檢查（`system-design.md` §關鍵設計細節「operationId」、design D6）。先寫 unit 測試涵蓋 spec `api-schema-export`「操作識別名依方法與回應形狀決定動詞」「操作識別名撞名時啟動失敗」「帶 body 的操作的 422 宣告」（以探測 router 組出的 app），再實作。驗證：`uv run pytest tests/unit` 通過 [@backend-developer]
- [ ] 6.2 實作 `app/scripts/export_openapi.py`：以明列四個欄位的佔位 `Settings` 呼叫 `create_app`、不跑 lifespan、撞名時以非零狀態結束且不寫檔、輸出 `sort_keys`、縮排 2、結尾換行，預設寫 `backend/openapi.json`（`system-design.md` §關鍵設計細節「介面描述檔匯出」、design D2、clarification Q8）。先寫 integration 測試涵蓋 spec `api-schema-export`「不設環境變數即可匯出」「重複匯出內容相同」。驗證：`uv run pytest` 通過 [@backend-developer]
- [ ] 6.3 執行 `uv run python -m app.scripts.export_openapi` 產生並提交 `backend/openapi.json`，確認與 `api-contract.md` §共用契約 一致（本群組尚無 `/api/v1` 端點，`paths` 不含 `/api/v1` 路徑；欄位為小駝峰；沒有 `HTTPValidationError`）。前端型別由 #505 建立，本次沒有要重新產生的前端產物。驗證：再執行一次匯出後 `git diff --exit-code backend/openapi.json` 以 0 結束 [@backend-developer]

## 7. 健康檢查模組

- [ ] 7.1 建立 `app/modules/health/` 的 `schemas.py`（`HealthData`，`status`／`database` 皆為只有 `"ok"` 的 enum）、`repository.py`（`ping()` 以 `select(literal(1))` 查詢，資料庫例外原樣往上拋）、`service.py`（`check()` 把連線失敗與逾時轉成 `DatabaseUnavailableError`，含 `get_health_service` 依賴工廠）、`router.py`（`GET /health`，`response_model` 為 `ApiResponse[HealthData]`，端點另宣告 `503` 為 `ErrorResponse`），並在 `create_app` 掛到 `/api/v1`（`system-design.md` §目錄結構、§關鍵情境 前兩張圖、design D4、clarification Q3、Q4、Q8）。先寫測試：unit 斷言 `check()` 遇連線例外時拋 `DatabaseUnavailableError`；integration 涵蓋 spec `health-check` 全部 Scenario（「資料庫無法連線時健康檢查回 503 外層」用關閉的本機埠、「資料庫連線逾時在時限內回應」用不回應的本機 TCP 伺服器、「健康檢查回應不含部署資訊」標 `postgres`），spec `api-envelope`「成功回應包含六個外層欄位」「回應欄位名為小駝峰」「不支援的方法回 405 外層」與「通用錯誤碼與 HTTP 狀態對應」中的 503，spec `request-correlation`「成功回應的標頭與 traceId 同值」，spec `response-localization`「回應訊息依語言偏好本地化」「指定 zh-TW 時回中文訊息」，spec `runtime-config`「只設允許來源即可啟動」「沒設 DATABASE_URL 時走 Lite 層」「設了 DATABASE_URL 時走正式層」（標 `postgres`）「請求結束後連線歸還」（design D10）。驗證：`uv run pytest` 通過，設定 `TEST_DATABASE_URL` 後再跑一次通過且 0 skipped [@backend-developer]
- [ ] 7.2 重新產生 `backend/openapi.json` 並確認與 `api-contract.md` 一致：`paths["/api/v1/health"].get.operationId` 為 `getHealth`、`200` 為 `HealthDataResponse`、`404`／`405`／`406`／`500`／`503` 參照 `ErrorResponse`、不含 `422`、`components.schemas` 含 `HealthDataResponse`、`HealthData`、`ErrorResponse`、`ErrorDetail` 且屬性名皆為小駝峰；以 integration 測試涵蓋 spec `api-schema-export`「匯出的介面描述檔為小駝峰且操作識別名符合動詞加資源」「健康檢查的外層元件名為 HealthDataResponse」「健康檢查的錯誤回應宣告」「提交的介面描述檔與程式一致」。前端型別由 #505 建立，本次沒有要重新產生的前端產物。驗證：`uv run pytest` 通過，且重新匯出後 `git diff --exit-code backend/openapi.json` 以 0 結束 [@backend-developer]

## 8. 寫入後端檢查指令

- [ ] 8.1 在 `openspec/config.yaml` 的 `operations.apply.guidance` 寫入後端檢查指令：`cd backend && uv run pytest`（SQLite）、`cd backend && TEST_DATABASE_URL=postgresql+asyncpg://... uv run pytest`（PostgreSQL，由本機 `docker run postgres:16` 提供）、`cd backend && uv run ruff check . && uv run ruff format --check .`、`cd backend && uv run mypy --strict app`、`cd backend && uv run python -m app.scripts.export_openapi` 後跑 `git diff --exit-code backend/openapi.json`；把第 4 條改為只剩前端的檢查指令待 #505 補上；不新增任何 CI job（design D12、clarification Q5、Q6）。驗證：`corepack pnpm exec openspec validate backend-skeleton` 通過、`corepack pnpm exec prettier --check openspec/config.yaml` 通過，且新寫入的每一行指令都在本機實際執行成功 [@technical-writer]

## 9. 雙資料庫整合驗證

- [ ] 9.1 在 SQLite 執行 `uv run pytest --cov=app --cov-report=term-missing`；以 `docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=postgres postgres:16` 起暫時的 PostgreSQL，設定 `TEST_DATABASE_URL` 後再執行一次同一指令，確認兩次都通過、PostgreSQL 那次 0 skipped；再執行 `uv run ruff check .`、`uv run ruff format --check .`、`uv run mypy --strict app`，以及重新匯出後 `git diff --exit-code backend/openapi.json`。把每條指令、兩次 pytest 摘要與覆蓋率數字交給 `acceptance-verifier` 寫進 `acceptance.md`（不設覆蓋率門檻，clarification Q5、Q8）。驗證：上述指令全部以 0 結束，且 `git status` 乾淨 [@backend-developer]

## Workflow follow-up

- 全部 task 完成且工作區乾淨後，交由 `code-reviewer` 審查；修正由實作角色另開 commit。
- `acceptance-verifier` 對照 `specs/` 每個 Scenario 驗收，寫 `acceptance.md`，含 PostgreSQL 的 `docker run postgres:16` 與 `TEST_DATABASE_URL` 指令、兩次 pytest 結果、覆蓋率數字與人工驗收步驟（啟動指令、`curl` 呼叫 `/api/v1/health` 的預期回應）。
- 驗收通過後由 `ops` 在合併前執行 `/opsx:archive`，七個新 capability 的 Purpose 由本 change 的 `## Purpose` 帶入。
- 交接：#505 讀 `backend/openapi.json` 與 `0.0.0` 版號；#506 依 `openspec/config.yaml` 的指令建 CI job、PostgreSQL 服務與覆蓋率門檻；規格 01-01 在 S10 權限矩陣把 `GET /api/v1/health` 列為刻意公開的例外。
- 不在本 change：`AGENTS.md` Language Rules 措辭（#516）、schema 範本的 `400`／`422`（#517）。
