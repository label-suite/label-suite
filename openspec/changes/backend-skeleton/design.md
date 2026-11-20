# Design

## Context

動機見 `proposal.md` §Why。`backend/` 目前不存在，本 change 從零建立；技術藍圖（目錄、元件、中介層順序、Sequence Diagram、遷移設定、測試做法）已寫在 `system-design.md`，對外契約已寫在 `api-contract.md`，行為以 `specs/` 七個 capability 為準。本文只補兩份上游沒有寫到的實作決策、替代方案與風險，寫過的內容一律指過去。

限制條件：

- 技術選型依 `docs/development/architecture.mdx` §技術選型：FastAPI 加 pydantic v2 加 uvicorn、SQLAlchemy 2.0（async）加 Alembic、pytest 加 pytest-asyncio 加 httpx、uv。
- clarification Q1–Q9（2026-11-20）的決議不得違反，特別是：唯一必要設定 `CORS_ALLOWED_ORIGINS`（Q1）、完整 A8 本地化（Q2）、健康檢查實際查詢與 `503`（Q3）、本機 PostgreSQL 驗收（Q5）、不加 CI job（Q6）、版號 `0.0.0`（Q7）、Q8 九項預設。
- 不改 `AGENTS.md`（#516）、不改 schema 範本（#517）、不建覆蓋率門檻、匯入方向檢查與 Semgrep（#506）。

## Goals / Non-Goals

**Goals:**

- 讓 `specs/` 每個 Scenario 都能以 pytest 自動驗證，SQLite 與 PostgreSQL 各跑一次。
- 讓之後的功能 change 只需在 `app/modules/<module>/` 照 `health` 的四件分層新增，不必改 `app/core/`、`alembic/env.py` 或測試 harness。
- 讓 `uv run ruff check`、`uv run ruff format --check`、`uv run mypy --strict app` 在第一個 commit 起就是乾淨的。

**Non-Goals:**

- 不為 worker 預建同步 session（`system-design.md` §關鍵設計細節「資料庫與 session」最後一點）。
- 不拆 liveness／readiness 兩個端點（`system-design.md` §交易、session 與效能）。
- 不解決 operationId 撞名時的父資源命名（N1），只做撞名即失敗。
- 不關閉 `/docs`、`/redoc`、`/openapi.json`（N6，#506）。

## Decisions

### D1. Python 版本與套件清單

- `requires-python = ">=3.12"`。理由：3.12 是 FastAPI、SQLAlchemy 2.0、asyncpg、aiosqlite 都有正式支援的版本，且 `datetime.UTC`、PEP 695 泛型語法可用；上游沒有指定版本，這是本文的技術決策（替代方案：3.11，少了 `typing` 的新語法，沒有對應的好處；3.13，部分 C 擴充套件的 wheel 較晚釋出）。
- 執行期依賴（一律 `uv add`，Hard Rule 3）：`fastapi`、`uvicorn[standard]`、`pydantic-settings`、`sqlalchemy[asyncio]`、`aiosqlite`、`asyncpg`、`alembic`。`pydantic` 隨 `fastapi` 安裝，不另列。
- 開發依賴（`uv add --dev`）：`pytest`、`pytest-asyncio`、`pytest-cov`、`httpx`、`ruff`、`mypy`。
- 不加 `asgi-lifespan`、`inflect`、`babel`：分別由 D7、D6、D5 的做法取代，少三個依賴。
- `uv.lock` 提交進版控；`pyproject.toml` 的 `version = "0.0.0"`（clarification Q7）。

對應：`system-design.md` §目錄結構（`pyproject.toml` 列）、`architecture.mdx` §技術選型、§測試分層。

### D2. 組裝入口用 factory，import 時不讀環境變數

做法與理由見 `system-design.md` §目錄結構 第三點與 §元件清單 `create_app(settings)`。本文補的決策：

- `create_app(settings: Settings | None = None)`：`None` 時才建 `Settings()` 讀環境變數。正式執行用 `uv run uvicorn app.main:create_app --factory`；測試與匯出指令都傳入自己建的 `Settings`。
- 匯出指令建立佔位設定時以初始化參數明列**全部四個欄位**（初始化參數優先於環境變數），確保環境裡的 `DATABASE_URL` 等值不會被讀到；匯出不跑 lifespan，所以輸出與環境無關（spec `api-schema-export`「不設環境變數即可匯出」「重複匯出內容相同」）。
- 替代方案：模組頂層 `app = create_app()`。不採用：import 就會讀環境變數，缺 `CORS_ALLOWED_ORIGINS` 時連匯出與 unit 測試都無法 import。

### D3. 中介層順序與純 ASGI

順序、各層職責與「不交給 `ServerErrorMiddleware`」的理由見 `system-design.md` §請求穿過的層。本文補的決策：

- `add_middleware` 是後加的在外層，所以 `create_app` 內的呼叫順序與表格相反：先加 `LocaleMiddleware`，再 `UnhandledExceptionMiddleware`、`CORSMiddleware`，最後 `CorrelationIdMiddleware`。unit 測試斷言 `app.user_middleware` 的順序，避免之後插入認證中介層時排錯。
- `CorrelationIdMiddleware` 在 `send` 的 `http.response.start` 訊息上補 `X-Correlation-ID`，這樣 CORS 產生的預檢回應與 `UnhandledExceptionMiddleware` 產生的 `500` 都帶得到（spec `request-correlation`「CORS 預檢回應也帶追蹤編號」）。
- `Content-Language`：`LocaleMiddleware` 在 `http.response.start` 依 `scope["state"]` 的 locale 補上，涵蓋成功外層與 handler 產生的錯誤外層；`LocaleMiddleware` 自己產生的 `406` 固定 `zh-TW`。位在它外側的 `UnhandledExceptionMiddleware` 產生 `500` 時，由 `Envelope.error` 讀同一個 `scope["state"]` 的 locale（沒有就 `zh-TW`）自己帶上。不從 body 反推語言。
- 替代方案：`BaseHTTPMiddleware`。不採用，理由見 `system-design.md` 同段末。

### D4. 錯誤處理的分工

`AppError` 家族、handler 與 `Envelope` 的分工見 `system-design.md` §元件清單 與 §權限檢查點「Service 不丟 `HTTPException`」。本文補的決策：

- `HTTPException` handler 註冊在 Starlette 的 `HTTPException`（不是 FastAPI 子類別），才接得到路由層產生的 `404`、`405`；`405` 時把原例外的 `headers`（含 `Allow`）帶進錯誤外層回應。
- `RequestValidationError` handler 把 `loc` 拆成 `location` 與 `field`，**只取 `type` 與 `msg`**，丟掉 `input`、`ctx`、`url`；做法見 `system-design.md` §關鍵設計細節「422 的逐欄位錯誤」。JSON 解析失敗時 Pydantic 回的 `loc` 是 `("body", <位置>)`，`field` 轉成字串；只有 `("body",)` 時 `field` 為 `""`。
- `ResponseValidationError` 不註冊 handler，讓它落到 `UnhandledExceptionMiddleware` 變成 `500 INTERNAL_ERROR`（api-contract §錯誤碼「含回應 schema 驗證失敗」）。
- 健康檢查的 `503`：`HealthRepository.ping()` 讓 SQLAlchemy 的 `OperationalError`、`DBAPIError`、`OSError`、`TimeoutError` 原樣往上拋，`HealthService.check()` 捕捉這幾種並轉成 `DatabaseUnavailableError`；log 記一筆 `WARNING`（含 `traceId` 與例外型別，不含連線字串）。這對應 `system-design.md` §關鍵情境「資料庫無法連線時健康檢查回 503 外層」。
- 替代方案：在 Router 捕捉資料庫例外。不採用：Router 會依賴資料層的例外型別，違反 B1 的分層。

### D5. 本地化用 JSON 訊息檔與自寫的 `Accept-Language` 解析

解析規則與檔案位置見 `system-design.md` §元件清單 `MessageCatalog` 與 api-contract §請求與回應標頭。本文補的決策：

- 訊息檔是扁平的 key 對字串（例 `"common.ok": "成功"`），在 `create_app` 時載入一次；啟動時檢查兩個語言的 key 集合相同，不同就啟動失敗，避免某個語言漏字後回出 key。
- 文案採 api-contract §錯誤碼 表列的字串（clarification Q2、N9），`NOT_ACCEPTABLE` 的訊息兩個檔都有 key，但回應一律取 zh-TW。
- 替代方案：Babel／gettext。不採用：只有兩個語言、十個以內的字串，`.po` 編譯流程的成本大於好處；之後字串變多再評估，換法不影響對外行為。

### D6. operationId 與 OpenAPI 後處理

產生規則、單複數轉換與撞名檢查見 `system-design.md` §關鍵設計細節「operationId」；元件命名見 api-contract §OpenAPI 元件命名與 `openapi.json`。本文補的決策：

- 單複數轉換寫在 `app/core/openapi.py`：`y` 結尾轉 `ies`、`s`／`x`／`ch`／`sh` 結尾加 `es`、其餘加 `s`，外加一張不規則字表（本次只放 `health`→`health`）。替代方案 `inflect` 套件不採用：一條規則加一張表就夠，多一個依賴不值得。
- 覆寫 `app.openapi`：先呼叫 FastAPI 的 `get_openapi`，再做兩件後處理——把每個 `422` 回應的 schema 換成 `ErrorResponse` 的參照，刪除 `components.schemas` 的 `HTTPValidationError` 與 `ValidationError`。結果快取在 `app.openapi_schema`，執行期的 `/openapi.json` 與匯出指令取得同一份。
- `404`、`405`、`406`、`500` 以 `/api/v1` 父 router 的 `responses=` 一次宣告；`getHealth` 的 `503` 宣告在端點上（api-contract §OpenAPI 元件命名與 `openapi.json`「錯誤回應在 OpenAPI 的宣告」）。
- 泛型元件命名靠覆寫 `ApiResponse.model_parametrized_name` 與 `PaginatedResponse.model_parametrized_name`；unit 測試對 `ApiResponse[HealthData]`、`ApiResponse[PaginatedResponse[X]]`、`PaginatedResponse[X]` 三種斷言元件名（spec `api-schema-export`「分頁外層的元件名」）。

### D7. 設定的解析

欄位、驗證與預設見 `system-design.md` §關鍵設計細節「設定與啟動失敗」。本文補的決策：

- `cors_allowed_origins` 標 `NoDecode`，由 `field_validator(mode="before")` 以逗號切分、去空白、丟空字串後逐一驗證；不用 pydantic-settings 預設的 JSON 解析，部署者才能直接寫 `http://a,http://b`。
- 驗證錯誤的訊息只放欄位名與原因，自訂驗證器拋出的 `ValueError` 不帶原值；Pydantic 的 `ValidationError` 字串預設會印 `input_value`，所以 `create_app` 捕捉 `ValidationError` 後改拋一個只含 `loc` 與 `msg` 的例外，並在拋出時 `from None`，避免原例外鏈被 uvicorn 印出（spec `runtime-config` 四個啟動失敗 Scenario 的「不含設定值」）。
- `async_database_url()`：`postgresql://`、`postgres://`、`postgresql+asyncpg://` 都正規化成 `postgresql+asyncpg://`；沒設時回 `sqlite+aiosqlite:///<SQLITE_PATH 的絕對路徑>`。

### D8. 資料庫 engine 與 lifespan

做法見 `system-design.md` §關鍵設計細節「資料庫與 session」。本文補的決策：

- 正式層的 engine 傳 `connect_args={"timeout": 5}`，並設 `pool_pre_ping=True`，避免資料庫重啟後第一個請求拿到失效連線。
- 測試以 `async with app.router.lifespan_context(app):` 包住 `httpx.AsyncClient(transport=ASGITransport(app=app))`，因為 `ASGITransport` 不會觸發 lifespan；不另加 `asgi-lifespan` 套件。
- 連線歸還的斷言（spec `runtime-config`「請求結束後連線歸還」）讀 `engine.pool.checkedout()`；SQLite 檔案連線同樣有 pool，兩種資料庫都可斷言。

### D9. Alembic 設定

設定項目與 SQLite／PostgreSQL 差異見 `system-design.md` §資料模型異動 的兩張表。本文補的決策：

- `env.py` 透過 `Settings()` 取得 URL；若呼叫端（測試）以 `config.attributes["connection"]` 傳入連線就直接用，讓 pytest 能對 `tmp_path` 的 SQLite 與 `TEST_DATABASE_URL` 跑遷移，而不必改環境變數。
- 基準遷移以 `uv run alembic revision -m "baseline"` 產生，`upgrade()` 與 `downgrade()` 都只有 `pass`。
- 約束命名的驗證（spec `database-migration`「約束名稱依固定規則產生」）用只存在於 `tests/` 的 `sample`／`owner` 兩張表，掛在一份套用同一個 `naming_convention` 的 `MetaData` 上，以 `create_all` 建在測試庫、用 inspector 讀回約束名；不寫進任何遷移，也不碰 `Base.metadata`。

### D10. 測試 harness

資料庫選擇、探測 router、unit／integration 範圍見 `system-design.md` §關鍵設計細節「測試」。本文補的決策：

- 目錄：`tests/unit/`、`tests/integration/`；integration 測試以 `@pytest.mark.integration` 標記，`uv run pytest -m integration` 只跑這一層（testing-agent-rules T1）。
- 只能在 PostgreSQL 上成立的測試（runtime-config「設了 DATABASE_URL 時走正式層」、health-check「健康檢查回應不含部署資訊」）以 `@pytest.mark.postgres` 加 `skipif(TEST_DATABASE_URL 未設)` 標記，跳過時 pytest 摘要會列出數量；這是 clarification Q5 明定的條件式跳過，不是 T11 禁止的無條件 `skip`。其餘 integration 測試依 `TEST_DATABASE_URL` 有無自動跑在對應資料庫上。
- 健康檢查 `503` 的兩種情境不需要真的 PostgreSQL：「連不上」用 `postgresql://u:CANARY-pw@127.0.0.1:<一個關閉的埠>/x`；「逾時」用測試內起的本機 TCP 伺服器，接受連線但不回任何位元組，讓 asyncpg 在 5 秒連線時限屆滿。兩者在沒有 `TEST_DATABASE_URL` 時也會跑。
- 未處理例外的 log 以 pytest 的 `caplog` 斷言（spec `api-envelope`「未處理例外的紀錄含追蹤編號且不含請求內容」）。
- 啟動失敗的 Scenario 以 unit 測試對 `create_app()` 斷言拋出的例外與訊息，另以一條 integration 測試用 `subprocess` 跑 `uvicorn --factory` 確認程序以非零狀態結束。
- 覆蓋率：`uv run pytest --cov=app --cov-report=term-missing`，不設 `--cov-fail-under`（clarification Q8）。

### D11. lint 與型別檢查的設定

- `ruff` 與 `mypy` 的設定寫在 `backend/pyproject.toml`：`[tool.ruff]` 的 `target-version = "py312"`、`line-length = 100`，`[tool.ruff.lint]` 選 `E`、`F`、`I`、`UP`、`B`、`S`、`ASYNC`；`tests/` 對 `S101`（assert）放寬。`[tool.mypy]` 以命令列的 `--strict` 為準，加 `plugins = ["pydantic.mypy"]`。
- 只在本機與 apply 檢查時跑，不加 CI job（clarification Q6）。

### D12. `openspec/config.yaml` 的後端檢查指令

把 `system-design.md` §技術待決問題「`openspec/config.yaml` 的 `operations.apply.guidance` 要補的後端指令」那五行寫進 `operations.apply.guidance`，並把第 4 條「後端與前端的檢查指令等骨架 change 建好再補進這一節」改成只剩前端（#505 補）。PostgreSQL 那一行寫明 `TEST_DATABASE_URL` 由本機 `docker run postgres:16` 提供（clarification Q5）。

## Risks / Trade-offs

- [PostgreSQL 測試在沒設 `TEST_DATABASE_URL` 時跳過，可能讓只在 PostgreSQL 出錯的改動通過本機檢查] → `acceptance.md` 必須附兩次 pytest 的完整摘要（含 PostgreSQL 那次 0 skipped）；CI 的 PostgreSQL 由 #506 建立後才算真正擋住。
- [`ApiModel` 設 `populate_by_name=True`，請求 body 同時接受小駝峰與底線命名] → 這是 `system-design.md` §元件清單 定下的設定，為了讓 Python 內部能用欄位名建構 schema；對外文件與 `openapi.json` 只列小駝峰。若之後要嚴格拒絕底線命名，屬 A10 的行為變更，另開 issue。
- [泛型元件名覆寫依賴 Pydantic 的 `model_parametrized_name` 行為，升級 Pydantic 時可能改變] → D6 的 unit 測試加上 `openapi.json` 的漂移比對（`git diff --exit-code`）會在升級時立刻失敗。
- [`UnhandledExceptionMiddleware` 在回應已開始送出後無法改寫回應] → 只能靠 log 追查；本次沒有串流端點。已列入 `clarification.md` 結論 N5，供 `code-reviewer` 與 #505 知悉。
- [健康檢查每次都打資料庫，高頻輪詢時占用連線池] → `system-design.md` §交易、session 與效能 已列；由 #506 決定輪詢頻率時再評估拆端點。
- [逾時情境的測試至少耗時 5 秒] → 只有一條，標 `integration`；整體測試時間增加約 5 秒，可接受。
- [SQLite 的 inspector 讀主鍵約束名依賴解析建表 SQL] → D9 的測試若在 SQLite 讀不到主鍵名，改以 `sqlite_master` 的 `sql` 欄比對 `CONSTRAINT pk_sample`，仍驗同一件事。
- [`SQLITE_PATH` 預設是相對路徑，依啟動時的工作目錄解析] → D7 在 `Settings` 內轉成絕對路徑後再組 URL，`alembic` 與 app 在同一個工作目錄（`backend/`）執行就會指向同一個檔；`config.yaml` 的指令一律以 `cd backend &&` 開頭。

## Migration Plan

- **部署**：本 change 沒有既有服務、資料或使用者，不需要資料遷移。合併後開發者執行 `cd backend && uv sync`，設定 `CORS_ALLOWED_ORIGINS` 後以 `uv run alembic upgrade head`、`uv run uvicorn app.main:create_app --factory` 啟動。
- **資料庫**：唯一的 Alembic revision 是空的基準遷移；`downgrade base` 完全還原（只移除 `alembic_version` 那一列），SQLite 與 PostgreSQL 行為相同（`system-design.md` §資料模型異動）。
- **回滾**：revert 本 PR 即可，刪除整個 `backend/` 與 `openspec/config.yaml` 的那幾行；沒有其他目錄依賴 `backend/`（#505、#506 尚未開始）。若已在某個資料庫跑過 `upgrade head`，先 `uv run alembic downgrade base` 再刪檔。
- **下游交接**：#505 讀 `backend/openapi.json`；#506 依 `config.yaml` 的指令建 CI job、PostgreSQL 服務與覆蓋率門檻。

## Open Questions

無。D1 的 Python 版本是本文的技術決策，之後若 #506 的 CI 映像或部署環境需要不同版本，改 `requires-python` 不影響 specs 與 tasks 的拆法。
