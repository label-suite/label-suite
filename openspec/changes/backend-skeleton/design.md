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
- 執行期依賴（一律 `uv add`，Hard Rule 3）：`fastapi`、`uvicorn[standard]`、`pydantic>=2.11`、`pydantic-settings`、`sqlalchemy[asyncio]`、`aiosqlite`、`asyncpg`、`alembic`。`pydantic` 雖隨 `fastapi` 安裝，仍明列下限 `2.11`：D13 的 `validate_by_alias`／`validate_by_name` 從 2.11 起才有。
- 開發依賴（`uv add --dev`）：`pytest`、`pytest-asyncio`、`pytest-cov`、`httpx`、`ruff`、`mypy`。
- 不加 `asgi-lifespan`、`inflect`、`babel`：分別由 D7、D6、D5 的做法取代，少三個依賴。
- `uv.lock` 提交進版控；`pyproject.toml` 的 `version = "0.0.0"`（clarification Q7）。
- `backend/.gitignore` 排除 `.venv/`、`__pycache__/`、`.pytest_cache/`、`.mypy_cache/`、`.ruff_cache/`、`.coverage` 與 `data/`（`SQLITE_PATH` 預設的 `./data/label_suite.db` 所在目錄），讓 D10 要求的「驗證後 `git status` 乾淨」在跑過 `uv sync`、pytest、mypy、ruff 與服務之後仍成立。根目錄 `.gitignore` 不動。

對應：`system-design.md` §目錄結構（`pyproject.toml` 列）、`architecture.mdx` §技術選型、§測試分層。

### D2. 組裝入口用 factory，import 時不讀環境變數

做法與理由見 `system-design.md` §目錄結構 第三點與 §元件清單 `create_app(settings)`。本文補的決策：

- `create_app(settings: Settings | None = None)`：`None` 時才以 `load_settings(Settings)`（D7）讀環境變數。正式執行用 `uv run uvicorn app.main:create_app --factory`；測試與匯出指令都傳入自己建的 `Settings`。
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
- 外層組 `message` 時從 `scope["state"]` 讀 locale，讀不到就用 zh-TW。第 4 群組還沒掛 `LocaleMiddleware`（第 5 群組才掛），所以該群組的測試一律斷言 zh-TW 文案；`Accept-Language` 的效果從第 5 群組起才測。
- 替代方案：Babel／gettext。不採用：只有兩個語言、十個以內的字串，`.po` 編譯流程的成本大於好處；之後字串變多再評估，換法不影響對外行為。

### D6. operationId 與 OpenAPI 後處理

產生規則、單複數轉換與撞名檢查見 `system-design.md` §關鍵設計細節「operationId」；元件命名見 api-contract §OpenAPI 元件命名與 `openapi.json`。本文補的決策：

- 資源名取自去掉 `/api/v1` 後最後一個非參數路徑段，路徑段依 api-agent-rules 一律是複數（`tasks`、`task-items`）。先把 kebab-case 轉成 PascalCase（`task-items` → `TaskItems`），再依動詞決定單複數：
  - `list` 直接用路徑段的複數形：`listTasks`、`listTaskItems`。
  - `get`、`create`、`update`、`delete` 先把最後一個字單數化再接上：`getTask`、`createTaskItem`。
- 單數化寫在 `app/core/openapi.py`，對最後一個字依序套用、命中即停：
  1. 不規則字表（本次放 `health` → `health`，不可數、單複同形；`statuses` → `status`、`buses` → `bus`，`s` 結尾的單數字加 `es`，步驟 4 不收 `ses`；`people` → `person`、`children` → `child`、`analyses` → `analysis` 這類字之後遇到再加進表）；
  2. `ss` 結尾不變（`access`、`class`）；
  3. `ies` 結尾換成 `y`（`categories` → `category`）；
  4. `sses`、`xes`、`ches`、`shes` 結尾去掉 `es`（`classes` → `class`、`boxes` → `box`、`batches` → `batch`、`dishes` → `dish`）；
  5. 其餘 `s` 結尾去掉 `s`（`tasks` → `task`；`responses` → `response`、`cases` → `case`、`databases` → `database`、`phases` → `phase` 也落在這一步）；
  6. 不以 `s` 結尾的字不變。
- unit 測試以對照表斷言 spec `api-schema-export`「操作識別名依方法與回應形狀決定動詞」的六條（`listTasks`、`getTask`、`createTask`、`updateTask`、`deleteTask`、`getHealth`），並逐條涵蓋上面六個步驟各一個字。替代方案 `inflect` 套件不採用：五條規則加一張表就夠，多一個依賴不值得；規則猜錯的字會在撞名檢查或 code review 時現形，修法是補一筆不規則字。
- 動詞的判定依據是 handler 的回傳型別標註（維護者裁定，2026-11-20，apply 任務 6.1 發現原做法不成立後修訂）：
  - 機制（`system-design.md` §關鍵設計細節「operationId」）：`generate_operation_id(route)` 以 `typing.get_type_hints(route.endpoint)["return"]` 讀出回傳型別；`GET` 且該型別是 `ApiResponse[PaginatedResponse[...]]` → `list`，其餘 `GET` → `get`，`POST`／`PUT`／`PATCH`／`DELETE` 依方法對應 `create`／`update`／`update`／`delete`。`typing.get_type_hints` 是公開 API，FastAPI 本身也從回傳型別推導回應模型，兩者讀同一個來源。
  - 專案慣例：handler 以回傳型別標註宣告回應 schema（例 `async def get_health(...) -> ApiResponse[HealthData]:`），不傳 `response_model=`。回應模型因此只有一個來源，operationId 的判定與 FastAPI 的回應驗證、OpenAPI 宣告不會分歧。
  - 沒有回傳型別標註的路由（`get_type_hints` 結果不含 `"return"`），`generate_operation_id` MUST 拋出例外，訊息列出該路由的 method 與 path；不得靜默退回 `get`。拋出發生在路由註冊時，`create_app` 因而啟動失敗，與撞名檢查同一原則。
  - 原做法為何不成立：原設計以 `route.response_model` 判定是否分頁。在 fastapi 0.165.0 上實測，`generate_unique_id_function` 在 `route.response_model` 設定之前就被呼叫：直接掛在 app 上的路由此時還沒有 `response_model` 屬性；經 `include_router` 掛入的路由則以私有的 `_EffectiveRouteContext` 傳入，`response_model` 為 `None`。依 `response_model` 判定時，分頁列表會被命名為 `getTask`，與單筆查詢撞名。
  - 替代方案「讀私有的 `original_route` 屬性取回原路由的 `response_model`」不採用：綁在 FastAPI 私有實作上，升級時容易壞。
  - 替代方案「在 `install_openapi` 內等路由建好後再改寫 `route.operation_id`」不採用：operationId 在路由註冊時已由 `generate_unique_id_function` 決定，事後改寫等於兩套產生邏輯，且撞名檢查與 OpenAPI 產生的時點分離。
- 覆寫 `app.openapi`：`create_app` 呼叫 `app/core/openapi.py` 的 `install_openapi(app)`，把 `app.openapi` 換成包住 FastAPI 預設產生器（`get_openapi`）的函式，第一次產生時依序做三件後處理——把每個 `422` 回應的 schema 換成 `ErrorResponse` 的參照，刪除 `components.schemas` 的 `HTTPValidationError` 與 `ValidationError`，再依下一點把泛型元件改名。結果快取在 `app.openapi_schema`，執行期的 `/openapi.json` 與匯出指令取得同一份。
- `info.version` 取自 `backend/pyproject.toml` 的 `[project].version`，不另寫第二份版本號（Hard Rule 4；clarification Q7 定為 `0.0.0`）：`app/core/openapi.py` 的 `get_app_version()` 以 `tomllib` 讀 `Path(__file__).resolve().parents[2] / "pyproject.toml"`，`create_app` 以 `FastAPI(title="Label Suite API", version=get_app_version())` 建立 app。不設的話 FastAPI 預設填 `0.1.0`，與 Q7 不符。
  - 替代方案「`importlib.metadata.version("label-suite-backend")`」不採用：`pyproject.toml` 沒有 `[build-system]`，`uv run` 不會把專案安裝成 distribution，實測在 `backend/` 執行 `uv run python -c "import importlib.metadata as m; print(m.version('label-suite-backend'))"` 拋出 `PackageNotFoundError`。為了它補 `[build-system]` 會改變打包方式，超出本次範圍。
  - 代價：執行環境必須帶著 `pyproject.toml`；檔案不存在或缺 `[project].version` 時 `get_app_version()` 直接拋例外，不退回預設值。
- `404`、`405`、`406`、`500` 以 `/api/v1` 父 router 的 `responses=` 一次宣告；`getHealth` 的 `503` 宣告在端點上（api-contract §OpenAPI 元件命名與 `openapi.json`「錯誤回應在 OpenAPI 的宣告」）。
- 泛型元件命名分兩段（維護者裁定，2026-11-20，apply 任務 2.2 發現原做法不成立後修訂）：
  1. `ApiResponse.model_parametrized_name` 與 `PaginatedResponse.model_parametrized_name` 仍覆寫，讓參數化類別的 `__name__` 與 JSON Schema 的 `title` 成為 `XResponse`／`XPageResponse`／`XPage`。unit 測試（tasks 2.2）對 `ApiResponse[HealthData]`、`ApiResponse[PaginatedResponse[X]]`、`PaginatedResponse[X]` 三種斷言 `__name__` 與 `model_json_schema()["title"]`。
  2. `components.schemas` 的鍵由上一點覆寫的第三步、`install_openapi` 內的私有函式 `rename_generic_components(schema)` 改名（`system-design.md` §關鍵設計細節「介面描述檔匯出」）：對每個泛型元件（鍵與 `title` 不同者），把鍵改成它的 `title`，並遞迴走過整份文件，把每個指向舊鍵的 `$ref`（`#/components/schemas/<舊鍵>`）改成新鍵。只用 FastAPI 的 `get_openapi` 回傳的 dict 與 Pydantic 公開的 `title`，不碰任何私有 API。改名後的鍵若與既有元件撞名（例：手寫的 `HealthDataResponse` 與泛型產生的同名），`app.openapi()` MUST 拋出例外並列出撞名的鍵與兩個來源，不得覆蓋或靜默跳過；匯出指令與 `/openapi.json` 都經過 `app.openapi()`，撞名會讓匯出指令以非零狀態結束。unit 測試（tasks 6.1）在 `app.openapi()` 產生的文件上斷言 spec `api-schema-export`「分頁外層的元件名」、沒有任何元件鍵以 `_` 結尾、每個 `$ref` 都指向存在的元件，以及撞名時拋出例外。
  - 原做法為何不成立：原設計假設覆寫 `model_parametrized_name` 就會改變元件鍵。在 pydantic 2.14.4／fastapi 0.165.0 上實測，它只改 `__name__` 與 `title`；`components.schemas` 的鍵來自 Pydantic 產生 JSON Schema 時的型別參照（defs ref，由泛型原型名與參數組成，例 `ApiResponse_Item_`），不讀 `__name__`，所以鍵仍是 `ApiResponse_Item_`。
  - 替代方案 (a)：在 `ApiResponse`／`PaginatedResponse` 覆寫 `__class_getitem__`，回傳以目標名稱宣告的具名子類別，讓型別參照本身就是 `XResponse`。不採用：要介入 Pydantic 泛型的參數化與快取機制，行為綁在私有實作上，升級時容易壞，且不保證不同參數化取得同一個類別。
  - 替代方案 (b)：每個端點手寫具名子類別（`class HealthDataResponse(ApiResponse[HealthData]): ...`）。不採用：每加一個端點都要多寫一個空殼類別，忘記寫就會漏出 `ApiResponse_X_` 鍵，靠人記得不如在產生端統一處理。
  - 撞名檢查與 operationId 的 `assert_unique_operation_ids` 同一原則：衝突時大聲失敗，不靠後寫入者覆蓋。
- `backend/openapi.json` 的格式由匯出指令決定（`sort_keys`、縮排 2、結尾換行），不由 Prettier 決定：把它加進根目錄 `.prettierignore`，註解寫明「匯出指令產生的檔案，格式由匯出指令負責」。不加的話，lint-staged 的 `*.json` 規則與 CI 的 `format` job 會把它改寫成 Prettier 的格式（例如短陣列收成一行），D12 的漂移比對與格式檢查就不可能同時通過。替代方案「讓匯出指令輸出 Prettier 的格式」不採用：匯出指令得依賴 Node 工具鏈，`backend/` 的檢查就不能只靠 `uv`。
- `backend/.venv/`、`backend/.pytest_cache/`、`backend/.mypy_cache/`、`backend/.ruff_cache/` 也加進根目錄 `.prettierignore`：它們只列在 `backend/.gitignore`，Prettier 只讀根目錄的 `.gitignore` 與 `.prettierignore`，不加的話 `uv sync` 後根目錄的 `prettier --check .` 會掃進虛擬環境與快取而失敗（維護者裁定 2026-11-20，tasks 6.4）。

### D7. 設定的解析

欄位、驗證與預設見 `system-design.md` §關鍵設計細節「設定與啟動失敗」。本文補的決策：

- `cors_allowed_origins` 標 `NoDecode`，由 `field_validator(mode="before")` 以逗號切分、去空白、丟空字串後逐一驗證；不用 pydantic-settings 預設的 JSON 解析，部署者才能直接寫 `http://a,http://b`。
- 設定分兩層（理由見 D9）：`DatabaseSettings` 只有 `database_url`、`sqlite_path` 兩個欄位與 `async_database_url()`、`is_lite()` 兩個方法；`Settings(DatabaseSettings)` 再加 `cors_allowed_origins`、`cors_allow_credentials`。
- 驗證錯誤的訊息只放設定名與原因，自訂驗證器拋出的 `ValueError` 不帶原值；Pydantic 的 `ValidationError` 字串預設會印 `input_value`，所以由 `app/core/config.py` 的 `load_settings(cls)` 統一建構設定：捕捉 `ValidationError`，對每一筆錯誤把 `loc[0]`（Python 欄位名，例 `cors_allowed_origins`）以 `.upper()` 轉成環境變數名（`CORS_ALLOWED_ORIGINS`），組成 `"<環境變數名>: <msg>"` 一行一筆的訊息，改拋 `ConfigError` 並 `from None`，避免原例外鏈被 uvicorn 印出。欄位與環境變數名一對一、沒有 `env_prefix`，所以 `.upper()` 就是 pydantic-settings 實際讀的名稱。`create_app(None)` 與 `alembic/env.py` 都經過 `load_settings`（前者傳 `Settings`、後者傳 `DatabaseSettings`）。這對應 spec `runtime-config` 四個啟動失敗 Scenario 的「錯誤訊息含 `CORS_ALLOWED_ORIGINS`」與「不含設定值」，以及兩個 `DATABASE_URL` 啟動失敗 Scenario 的「錯誤訊息含 `DATABASE_URL`」。
- `DATABASE_URL` 的 scheme 由 `DatabaseSettings` 的 `field_validator` 檢查，只接受三種，全部正規化成 `postgresql+asyncpg://`，其餘部分原樣保留：
  - `postgresql://` 與 `postgresql+asyncpg://`；
  - `postgres://`（Heroku 等平台慣用的別名）。
  - 其他一律拒絕並啟動失敗，包括 `postgresql+psycopg://`、`postgresql+psycopg2://` 這類指定了別的驅動的寫法（本專案只裝 `asyncpg`，接受它們等於在連線時才失敗），以及 `mysql://`、`sqlite://`。錯誤訊息為 `DATABASE_URL: <原因>`，原因只描述「只接受 postgresql、postgresql+asyncpg、postgres」，不含連線字串。
- `async_database_url()`：設了 `DATABASE_URL` 時回正規化後的值；沒設時回 `sqlite+aiosqlite:///<SQLITE_PATH 的絕對路徑>`。

### D8. 資料庫 engine 與 lifespan

做法見 `system-design.md` §關鍵設計細節「資料庫與 session」。本文補的決策：

- 正式層的 engine 傳 `connect_args={"timeout": 5}`，並設 `pool_pre_ping=True`，避免資料庫重啟後第一個請求拿到失效連線。
- 測試以 `async with app.router.lifespan_context(app):` 包住 `httpx.AsyncClient(transport=ASGITransport(app=app))`，因為 `ASGITransport` 不會觸發 lifespan；不另加 `asgi-lifespan` 套件。
- 連線歸還的斷言（spec `runtime-config`「請求結束後連線歸還」）讀 `engine.pool.checkedout()`；SQLite 檔案連線同樣有 pool，兩種資料庫都可斷言。

### D9. Alembic 設定

設定項目與 SQLite／PostgreSQL 差異見 `system-design.md` §資料模型異動 的兩張表。本文補的決策：

- `env.py` 只讀 `DatabaseSettings`（經 D7 的 `load_settings(DatabaseSettings)`），取 `async_database_url()`，**不讀 `Settings`**。理由：`Settings` 要求 `CORS_ALLOWED_ORIGINS`，若 `env.py` 讀它，跑遷移也得設一個與資料庫無關的跨來源設定，spec `database-migration`「遷移連到與服務相同的資料庫」（只設 `SQLITE_PATH`）就無法成立。`Settings` 繼承 `DatabaseSettings`，所以兩邊對 `DATABASE_URL`、`SQLITE_PATH` 的驗證與 URL 推導是同一段程式，B10「唯一設定入口」仍成立。替代方案：(b) `env.py` 讀 `Settings` 並塞一個佔位的 `CORS_ALLOWED_ORIGINS`，不採用，佔位值會讓部署者誤以為遷移需要它；(c) `env.py` 自己讀 `os.environ`，不採用，違反 B10 並會與 app 的 URL 推導分岔。
- 若呼叫端（測試）以 `config.attributes["connection"]` 傳入連線就直接用，讓 pytest 能對 `tmp_path` 的 SQLite 與 `TEST_DATABASE_URL` 跑遷移，而不必改環境變數；「遷移連到與服務相同的資料庫」那條測試則刻意不傳連線，以 `monkeypatch` 只設 `SQLITE_PATH`、刪掉 `CORS_ALLOWED_ORIGINS` 與 `DATABASE_URL` 後呼叫 `alembic upgrade head`，驗證走的是 `DatabaseSettings`。
- 基準遷移以 `uv run alembic revision -m "baseline"` 產生，`upgrade()` 與 `downgrade()` 都只有 `pass`。
- 約束命名的驗證（spec `database-migration`「約束名稱依固定規則產生」）用只存在於 `tests/` 的 `sample`／`owner` 兩張表，掛在一份套用同一個 `naming_convention` 的 `MetaData` 上，以 `create_all` 建在測試庫、用 inspector 讀回約束名；不寫進任何遷移，也不碰 `Base.metadata`。測試結束時以 `drop_all` 刪掉這兩張表（放在 fixture 的 teardown，測試失敗也會執行），否則同一個 PostgreSQL 測試庫上後續的「基準遷移不建立業務資料表」會看到殘留的表而失敗。
- 遷移測試在 PostgreSQL 上共用同一個庫，所以每條遷移測試以 `downgrade base` 開始、以 `upgrade head` 結束，不依賴前一條測試留下的狀態，也讓之後的測試拿到已升到最新的庫。

### D10. 測試 harness

資料庫選擇、探測 router、unit／integration 範圍見 `system-design.md` §關鍵設計細節「測試」。本文補的決策：

- 目錄：`tests/unit/`、`tests/integration/`；integration 測試以 `@pytest.mark.integration` 標記，`uv run pytest -m integration` 只跑這一層（testing-agent-rules T1）。
- 測試資料庫 fixture 在 `tests/conftest.py`，隨第一個需要資料庫的測試（tasks 3.1）建立：有 `TEST_DATABASE_URL` 時用該 PostgreSQL，否則用 `tmp_path` 下的 SQLite 檔；它只提供 engine，不跑遷移。需要已遷移結構的測試另用建在它之上的 fixture 跑 `alembic upgrade head`（tasks 3.2 加入）。PostgreSQL 的隔離做法見 D9 最後兩點。
- 只能在 PostgreSQL 上成立的測試（runtime-config「設了 DATABASE_URL 時走正式層」、health-check「健康檢查回應不含部署資訊」）以 `@pytest.mark.postgres` 加 `skipif(TEST_DATABASE_URL 未設)` 標記，跳過時 pytest 摘要會列出數量；這是 clarification Q5 明定的條件式跳過，不是 T11 禁止的無條件 `skip`。其餘 integration 測試依 `TEST_DATABASE_URL` 有無自動跑在對應資料庫上。
- 健康檢查 `503` 的兩種情境不需要真的 PostgreSQL：「連不上」用 `postgresql://u:CANARY-pw@127.0.0.1:<一個關閉的埠>/x`；「逾時」用測試內起的本機 TCP 伺服器，接受連線（TCP 連線建立）後不回任何位元組，讓 asyncpg 在 5 秒連線時限屆滿。兩者在沒有 `TEST_DATABASE_URL` 時也會跑。
- 「回應內容不符合宣告形狀回 500」（spec `api-envelope`）用 `tests/` 內探測 router 的一條 `GET`：回傳型別標註宣告必填欄位（依 D6 的慣例，不傳 `response_model=`），handler 回傳缺該欄位的 dict，FastAPI 拋 `ResponseValidationError`，依 D4 落到 `UnhandledExceptionMiddleware`。
- 未處理例外的 log 以 pytest 的 `caplog` 斷言（spec `api-envelope`「未處理例外的紀錄含追蹤編號且不含請求內容」）。
- 啟動失敗的 Scenario 以 unit 測試對 `create_app()` 斷言拋出的例外與訊息，另以一條 integration 測試用 `subprocess` 跑 `uvicorn --factory` 確認程序以非零狀態結束。
- 覆蓋率：`uv run pytest --cov=app --cov-report=term-missing`，不設 `--cov-fail-under`（clarification Q8）。

### D11. lint 與型別檢查的設定

- `ruff` 與 `mypy` 的設定寫在 `backend/pyproject.toml`：`[tool.ruff]` 的 `target-version = "py312"`、`line-length = 100`，`[tool.ruff.lint]` 選 `E`、`F`、`I`、`UP`、`B`、`S`、`ASYNC`；`tests/` 對 `S101`（assert）放寬。`[tool.mypy]` 以命令列的 `--strict` 為準，加 `plugins = ["pydantic.mypy"]`。
- 只在本機與 apply 檢查時跑，不加 CI job（clarification Q6）。

### D12. `openspec/config.yaml` 的後端檢查指令

把 `system-design.md` §技術待決問題「`openspec/config.yaml` 的 `operations.apply.guidance` 要補的後端指令」那五行寫進 `operations.apply.guidance`，並把第 4 條「後端與前端的檢查指令等骨架 change 建好再補進這一節」改成只剩前端（#505 補）。本文補的決策：

- PostgreSQL 那一行寫明 `TEST_DATABASE_URL` 由本機 `docker run postgres:16` 提供（clarification Q5）。
- SQLite 那一行寫明：標 `postgres` 的測試在這次會被跳過，回報結果時要附上 pytest 摘要裡的 skipped 數量，不得只寫「通過」。
- 漂移比對那一行的路徑以 `backend/` 為工作目錄（指令都以 `cd backend &&` 開頭），寫成：

  ```bash
  cd backend && uv run python -m app.scripts.export_openapi \
    && git diff --exit-code -- openapi.json \
    && test -z "$(git status --porcelain -- openapi.json)"
  ```

  `git diff` 的路徑是相對於目前目錄解析的，寫 `backend/openapi.json` 會變成 `backend/backend/openapi.json`、永遠沒有差異；`git diff` 也看不到未追蹤的檔案，所以第一次匯出還沒提交時要靠 `git status --porcelain` 那一段抓出來。tasks 6.3、7.2、8.1、9.1 都用這三段。

### D13. 請求與回應用不同的 schema 基底

基底類別的分工見 `system-design.md` §元件清單 `ApiModel`、`RequestModel`、`ResponseModel`。本文補的決策與理由：

- `ApiModel` 只放共用設定：`alias_generator=to_camel`、`serialize_by_alias=True`、`extra="forbid"`。
- `RequestModel(ApiModel)` 設 `validate_by_alias=True, validate_by_name=False`：請求 body 只認小駝峰，送 `display_name` 會被當成未宣告欄位，回 `422 extra_forbidden`（#503 裁定 3、api-agent-rules A2；spec `api-envelope`「底線命名的 body 欄位被拒收」）。`PaginationParams` 繼承它。
- `ResponseModel(ApiModel)` 設 `validate_by_alias=True, validate_by_name=True, from_attributes=True`：Python 內部以欄位名（`trace_id=...`）或 ORM 物件建構回應，序列化仍走 alias。`HealthData`、`ApiResponse`、`ErrorDetail`、`PaginatedResponse` 繼承它。
- 替代方案：單一 `ApiModel` 設 `populate_by_name=True`。不採用：請求 body 會同時接受小駝峰與底線命名，等於對外多開一種沒有寫進契約的寫法。另一個替代方案是單一基底設 `validate_by_name=False`，不採用：內部建構回應時得改寫 alias，`ErrorDetail`、`ApiResponse` 的建構點都要跟著改。
- 之後的功能 change 規則：請求 body schema 繼承 `RequestModel`、回應 schema 繼承 `ResponseModel`，不直接繼承 `ApiModel`；`code-reviewer` 依此審查。

## Risks / Trade-offs

- [PostgreSQL 測試在沒設 `TEST_DATABASE_URL` 時跳過，可能讓只在 PostgreSQL 出錯的改動通過本機檢查] → `acceptance.md` 必須附兩次 pytest 的完整摘要（含 PostgreSQL 那次 0 skipped）；CI 的 PostgreSQL 由 #506 建立後才算真正擋住。
- [`PaginationParams` 繼承 `RequestModel` 而有 `extra="forbid"`，但 A2 要求未宣告的 query 參數被忽略] → 本次沒有端點使用它；第一個列表端點要把它接成一般的依賴（逐個 `Query` 參數組成），不要當成 FastAPI 的 Query model，否則未宣告的 query 參數會回 `422`。
- [泛型元件名依賴 Pydantic 的 `model_parametrized_name` 產生 `title`，以及 FastAPI 產生的元件鍵格式；升級 Pydantic 或 FastAPI 時可能改變] → D6 的 `title` unit 測試、tasks 6.1 對 `app.openapi()` 的元件鍵與 `$ref` 斷言，加上 `openapi.json` 的漂移比對（`git diff --exit-code`），會在升級時立刻失敗。改名只讀寫 `get_openapi` 回傳的 dict，不依賴私有 API。
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
