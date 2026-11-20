# System Design

本文把 `system-analysis.md` 的能力清單轉成 `backend/` 骨架的技術藍圖。本 change 沒有 `docs/specs/` 規格（spec-migration D4），設計依據追溯到 ADR 與規則條號。

三件已裁定的事照裁定寫、不列待決（維護者 2026-11-10，`architecture.mdx` §決策紀錄）：**模組內分層** `app/modules/<module>/`、成功回應**包一層 envelope**、路徑前綴 **`/api/v1`**。envelope 的六個欄位與 camelCase 依 #503（2026-11-20）。

system-analysis 的 16 條待決問題與 4 條需求矛盾，以及本文新增的 N1–N6，都已在 clarification 停點處理（維護者 2026-11-20 決議 Q1–Q9，其餘依 `clarification.md` §不需維護者決定的結論）。本文的設計點照決議寫成定案，並標出對應的「clarification Q<n>」；對照表在 [§技術待決問題](#技術待決問題)。

## 分層與類別

### 目錄結構

```text
backend/
├─ pyproject.toml               uv 專案；依賴一律 uv add（Hard Rule 3）
├─ alembic.ini                  script_location、檔名模板
├─ alembic/
│  ├─ env.py                    async 執行；只讀 DatabaseSettings，URL 與 app 共用同一個推導函式
│  ├─ script.py.mako
│  └─ versions/                 空的基準遷移（clarification Q8）
├─ openapi.json                 匯出的介面描述檔，提交進 repo（clarification Q8、N2）
├─ app/
│  ├─ main.py                   create_app(settings) 組裝入口；uvicorn 以 --factory 啟動
│  ├─ core/                     全站共用，不屬任何業務模組
│  │  ├─ config.py              DatabaseSettings、Settings、load_settings、ConfigError（B10 的唯一設定入口）
│  │  ├─ db.py                  engine、sessionmaker、get_db、Base 與命名慣例
│  │  ├─ schemas.py             ApiModel、RequestModel、ResponseModel、ApiResponse、ErrorResponse、ErrorDetail、PaginatedResponse、PaginationParams
│  │  ├─ envelope.py            成功與錯誤外層的組裝函式
│  │  ├─ errors.py              AppError 家族與 exception handler 註冊
│  │  ├─ middleware.py          CorrelationIdMiddleware、LocaleMiddleware、UnhandledExceptionMiddleware
│  │  ├─ i18n.py                Accept-Language 解析與訊息目錄（clarification Q2）
│  │  └─ openapi.py             generate_operation_id、唯一性檢查、app.openapi 覆寫（422 改寫、泛型元件改名）、匯出
│  ├─ i18n/
│  │  ├─ zh-TW/messages.json    外層 message 字串（architecture.mdx §i18n 兩層）
│  │  └─ en/messages.json
│  ├─ scripts/
│  │  └─ export_openapi.py      uv run python -m app.scripts.export_openapi
│  └─ modules/
│     └─ health/                第一個模組資料夾（clarification Q8）
│        ├─ router.py
│        ├─ service.py          含 get_health_service 依賴工廠
│        ├─ repository.py
│        └─ schemas.py
└─ tests/
   ├─ conftest.py               依 TEST_DATABASE_URL 選資料庫、對測試庫跑 alembic upgrade head
   ├─ unit/
   └─ integration/
```

- `app/core/` 放全站共用的基礎設施，B10 的適用路徑 `backend/app/core/config*` 即據此；業務邏輯一律在 `app/modules/<module>/`（ADR-003 D3）。
- **依賴工廠放在 service 模組**：`get_health_service(db)` 在 `service.py` 裡建構 `HealthRepository` 再注入 `HealthService`。這樣 `router.py` 只 import `service` 與 `schemas`，import 方向是 `router → service → repository`，#506 的分層 import 檢查（B1 檢查方式）可以照這個方向寫契約。之後每個模組照抄。
- `app.main` 不在模組頂層呼叫 `create_app()`：uvicorn 用 `uvicorn app.main:create_app --factory` 啟動，import 時不讀環境變數，測試與匯出指令才能自己傳入 `Settings`。

### 請求穿過的層（由外而內）

Starlette 的堆疊固定是 `ServerErrorMiddleware` → 使用者中介層 → `ExceptionMiddleware` → 路由。本次的使用者中介層依下列順序（第一個最外層）：

| 順序 | 元件                                              | 職責                                                                                                                              | 依據                                               |
| :--- | :------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------- |
| 1    | `CorrelationIdMiddleware`（純 ASGI）              | 取得或產生追蹤編號，寫進 `scope["state"]` 與 contextvar，回應時加 `X-Correlation-ID` 標頭；放最外層，連 preflight 與 500 都帶得到 | A6、A7；clarification Q8                           |
| 2    | `CORSMiddleware`                                  | 來源逐一列出，`expose_headers` 含 `X-Correlation-ID` 讓瀏覽器讀得到                                                               | Hard Rule 7、S2；clarification 結論（待決 3）      |
| —    | （01-01 登入插入：認證、CSRF）                    | 本次不實作，只留位置                                                                                                              | architecture.mdx §後端分層 九站                    |
| 3    | `UnhandledExceptionMiddleware`（純 ASGI）         | 攔下未處理例外，回 `500` 外層、不露堆疊，寫一筆含追蹤編號的 log                                                                   | A7、07-01 §卡控機制；clarification 結論（待決 16） |
| 4    | `LocaleMiddleware`（純 ASGI，只作用在 `/api/v1`） | 解析 `Accept-Language` 寫進 `scope["state"]`；全部被拒回 `406` 外層                                                               | A8；clarification Q2                               |
| —    | Starlette `ExceptionMiddleware`                   | 執行註冊的 handler：`AppError`、`RequestValidationError`、`HTTPException`（404、405）                                             | A7                                                 |
| —    | 路由 → Router → Service → Repository              | 模組內分層                                                                                                                        | B1、ADR-003 D3                                     |

未處理例外**不**交給 Starlette 的 `ServerErrorMiddleware` 處理，理由是它位在所有使用者中介層外面：由它產生的 `500` 不會再經過 CORS 與追蹤編號中介層，瀏覽器會看到 CORS 錯誤而讀不到外層，回應也沒有 `X-Correlation-ID`。所以本次自己的 `UnhandledExceptionMiddleware` 放在 CORS 內側，`ServerErrorMiddleware` 只剩最後保險。中介層一律寫成純 ASGI，不用 `BaseHTTPMiddleware`，避免 contextvar 在 task 之間斷掉與串流回應被緩衝。

### Class Diagram

```mermaid
classDiagram
  direction TB

  class HealthRouter {
    <<router>>
    +get_health(request: Request, service: HealthService) ApiResponse~HealthData~
  }
  class HealthService {
    <<service>>
    -repository: HealthRepository
    +check() HealthData
  }
  class get_health_service {
    <<dependency>>
    +get_health_service(db: AsyncSession) HealthService
  }
  class HealthRepository {
    <<repository>>
    -session: AsyncSession
    +ping() None
  }
  class HealthData {
    <<schema>>
    +status: str
    +database: str
  }

  class ApiModel {
    <<schema base>>
    +model_config: ConfigDict
  }
  class RequestModel {
    <<schema base>>
    +model_config: ConfigDict
  }
  class ResponseModel {
    <<schema base>>
    +model_config: ConfigDict
  }
  class ApiResponse~T~ {
    <<schema>>
    +success: bool
    +code: str
    +message: str
    +data: Optional~T~
    +timestamp: datetime
    +trace_id: str
  }
  class ErrorResponse {
    <<schema>>
    +errors: Optional~list~ErrorDetail~~
  }
  class ErrorDetail {
    <<schema>>
    +location: str
    +field: str
    +code: str
    +message: str
  }
  class PaginatedResponse~T~ {
    <<schema>>
    +items: list~T~
    +total: int
    +limit: int
    +offset: int
    +has_more() bool
    +total_pages() int
    +next_offset() Optional~int~
  }
  class PaginationParams {
    <<schema query>>
    +limit: int
    +offset: int
  }

  class Envelope {
    <<module>>
    +ok(data: T, request: Request, message_key: str) ApiResponse~T~
    +error(status_code: int, code: str, message_key: str, request_state: State, errors: Optional~list~ErrorDetail~~) JSONResponse
  }
  class AppError {
    <<exception>>
    +status_code: int
    +code: str
    +message_key: str
    +params: dict
  }
  class NotFoundError {
    <<exception>>
  }
  class NotAcceptableError {
    <<exception>>
  }
  class DatabaseUnavailableError {
    <<exception>>
  }
  class ErrorHandlers {
    <<module>>
    +register_exception_handlers(app: FastAPI) None
    +handle_app_error(request: Request, exc: AppError) JSONResponse
    +handle_validation_error(request: Request, exc: RequestValidationError) JSONResponse
    +handle_http_exception(request: Request, exc: HTTPException) JSONResponse
  }
  class CorrelationIdMiddleware {
    <<middleware>>
    +__call__(scope: Scope, receive: Receive, send: Send) None
    -accept_or_generate(raw: Optional~str~) str
  }
  class LocaleMiddleware {
    <<middleware>>
    +__call__(scope: Scope, receive: Receive, send: Send) None
  }
  class UnhandledExceptionMiddleware {
    <<middleware>>
    +__call__(scope: Scope, receive: Receive, send: Send) None
  }
  class MessageCatalog {
    <<module>>
    +resolve_locale(accept_language: Optional~str~) str
    +translate(key: str, locale: str, params: dict) str
  }

  class DatabaseSettings {
    <<config>>
    +database_url: Optional~str~
    +sqlite_path: Path
    +async_database_url() str
    +is_lite() bool
  }
  class Settings {
    <<config>>
    +cors_allowed_origins: list~str~
    +cors_allow_credentials: bool
  }
  class ConfigLoader {
    <<module>>
    +load_settings(cls: type~S~) S
  }
  class ConfigError {
    <<exception>>
    +message: str
  }
  class Database {
    <<module>>
    +create_engine(settings: DatabaseSettings) AsyncEngine
    +create_sessionmaker(engine: AsyncEngine) async_sessionmaker
    +get_db(request: Request) AsyncIterator~AsyncSession~
  }
  class Base {
    <<model>>
    +metadata: MetaData
  }
  class AppFactory {
    <<module>>
    +create_app(settings: Optional~Settings~) FastAPI
    -lifespan(app: FastAPI) AsyncIterator~None~
  }
  class OpenApiTools {
    <<module>>
    +generate_operation_id(route: APIRoute) str
    +assert_unique_operation_ids(app: FastAPI) None
    +install_openapi(app: FastAPI) None
    -rename_generic_components(schema: dict) dict
    +export_openapi(app: FastAPI, output: Path) None
  }

  HealthRouter --> HealthService : Depends
  HealthRouter ..> get_health_service : Depends
  get_health_service ..> HealthRepository : 建構
  get_health_service ..> Database : get_db
  HealthService --> HealthRepository
  HealthService ..> DatabaseUnavailableError : raises
  HealthRepository ..> Base : 同一個 engine

  HealthRouter ..> Envelope : ok()
  HealthRouter ..> HealthData
  RequestModel --|> ApiModel
  ResponseModel --|> ApiModel
  HealthData --|> ResponseModel
  ApiResponse --|> ResponseModel
  ErrorResponse --|> ApiResponse
  ErrorDetail --|> ResponseModel
  PaginatedResponse --|> ResponseModel
  PaginationParams --|> RequestModel

  NotFoundError --|> AppError
  NotAcceptableError --|> AppError
  DatabaseUnavailableError --|> AppError
  ErrorHandlers ..> Envelope : error()
  ErrorHandlers ..> AppError
  UnhandledExceptionMiddleware ..> Envelope : error()
  LocaleMiddleware ..> MessageCatalog
  LocaleMiddleware ..> NotAcceptableError
  Envelope ..> MessageCatalog

  AppFactory ..> ConfigLoader : load_settings(Settings)
  ConfigLoader ..> DatabaseSettings : cls()
  ConfigLoader ..> ConfigError : raises
  AppFactory ..> Database
  AppFactory ..> ErrorHandlers
  AppFactory ..> CorrelationIdMiddleware
  AppFactory ..> LocaleMiddleware
  AppFactory ..> UnhandledExceptionMiddleware
  AppFactory ..> OpenApiTools
  AppFactory ..> HealthRouter : include_router
  Settings --|> DatabaseSettings
  Database ..> DatabaseSettings
```

本次沒有業務 Model；`Base` 只畫屬性 `metadata`（帶約束命名慣例），表間關聯以 ER 為準，本次不新增。

### 元件清單

| 元件                                                              | 層            | 職責                                                                                                                                                                                                                                                                                                                                                                                       | 依據                                                                                       |
| :---------------------------------------------------------------- | :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| `create_app(settings)`                                            | 組裝          | 沒傳入時以 `load_settings(Settings)` 從環境變數建立、掛中介層與 handler、`include_router`、設 `generate_unique_id_function`、跑 operationId 唯一性檢查、`install_openapi` 掛上 `app.openapi` 覆寫；lifespan 建立與釋放 engine。正式執行、測試 harness、匯出指令都走它                                                                                                                      | T4「harness 與 production 共用同一個 app 組裝函式」、B10                                   |
| `DatabaseSettings`                                                | 設定          | 只含資料庫兩項 `database_url`、`sqlite_path` 與 URL 推導；Alembic `env.py` 只讀這個類別，所以跑遷移不需要 `CORS_ALLOWED_ORIGINS` 等 app 設定                                                                                                                                                                                                                                               | B10；clarification Q1                                                                      |
| `Settings`                                                        | 設定          | 繼承 `DatabaseSettings`，加上 CORS 設定；Pydantic Settings 集中驗證；缺必要設定或格式不合法時產生的 `ValidationError` 不直接往外拋，由 `load_settings` 轉成 `ConfigError`，啟動失敗                                                                                                                                                                                                        | B10、S9；clarification Q1                                                                  |
| `load_settings(cls)`                                              | 設定          | 建 `cls()`，攔下 Pydantic `ValidationError`，把每筆錯誤的 `loc[0].upper()` 當環境變數名，拋 `ConfigError("<ENV_VAR>: <msg>")`，並用 `from None` 切掉原例外鏈（避免 traceback 帶出輸入值）。`create_app(None)` 用 `load_settings(Settings)`，Alembic `env.py` 用 `load_settings(DatabaseSettings)`                                                                                          | B10、S9；clarification Q1                                                                  |
| `ConfigError`                                                     | 例外          | 設定錯誤的唯一例外型別，訊息只有大寫環境變數名與原因，不含值；不屬 `AppError` 家族，只在啟動與遷移時出現，不會變成 HTTP 回應                                                                                                                                                                                                                                                               | B10、S9                                                                                    |
| `Database`（`create_engine`、`get_db`）                           | 資料存取基礎  | 依 `DatabaseSettings` 推導 async URL、建 engine 與 sessionmaker；`get_db` 一個請求一個 `AsyncSession`，例外時 rollback，結束關閉；**不 commit**                                                                                                                                                                                                                                            | ADR-003 D7、B3、B4                                                                         |
| `Base`                                                            | Model 基底    | `DeclarativeBase`，`MetaData(naming_convention=...)` 讓約束名在兩種資料庫一致、batch 模式能找到約束                                                                                                                                                                                                                                                                                        | B6、ADR-003 D7                                                                             |
| `ApiModel`                                                        | schema 基底   | 共用設定 `ConfigDict(alias_generator=to_camel, serialize_by_alias=True, extra="forbid")`，全專案一處設定；不直接繼承，只當下面兩個基底的父類別                                                                                                                                                                                                                                             | A2、#503 裁定 3                                                                            |
| `RequestModel`                                                    | schema 基底   | request body 與 query 的基底：`validate_by_alias=True, validate_by_name=False`，**只認 camelCase alias**；送 snake_case 欄位名（例 `display_name`）會被當成未知欄位，回 `422`、`extra_forbidden`                                                                                                                                                                                           | A2、#503 裁定 3                                                                            |
| `ResponseModel`                                                   | schema 基底   | 回應的基底：`validate_by_alias=True, validate_by_name=True, from_attributes=True`，讓後端程式能用 Python 欄位名或 ORM 物件建構；輸出一律用 alias（camelCase）                                                                                                                                                                                                                              | A2、#503 裁定 3                                                                            |
| `ApiResponse[T]`                                                  | schema        | 外層六欄 `success`、`code`、`message`、`data`、`timestamp`、`traceId`；覆寫 `model_parametrized_name` 產生 `XResponse`／`XPageResponse` 的 `title`，元件鍵由 `install_openapi` 改成這個 title                                                                                                                                                                                              | A1、ADR-003 D5、#503                                                                       |
| `ErrorResponse`、`ErrorDetail`                                    | schema        | 錯誤外層；`422` 另帶 `errors`                                                                                                                                                                                                                                                                                                                                                              | A7                                                                                         |
| `PaginatedResponse[T]`、`PaginationParams`                        | schema        | 七個欄位，後三個用 `computed_field` 由前四個推導；`limit` 預設 20、`1..100`，`offset` 預設 0、`>= 0`；覆寫 `model_parametrized_name` 產生 `XPage` 的 `title`                                                                                                                                                                                                                               | A3                                                                                         |
| `Envelope.ok`／`Envelope.error`                                   | 回應組裝      | 填入 `timestamp`、`traceId`、依 locale 翻好的 `message`；Router 與 handler 共用，Service 不碰                                                                                                                                                                                                                                                                                              | A1、A7、A8；architecture.mdx §後端分層「Service 不組 HTTP 回應、不自己讀 Accept-Language」 |
| `AppError` 家族                                                   | 例外          | Service 只丟領域例外（帶 `status_code`、`code`、`message_key`），不丟 `HTTPException`                                                                                                                                                                                                                                                                                                      | B1「資料層不處理 HTTP」、A7                                                                |
| `register_exception_handlers`                                     | 錯誤處理      | `AppError`、`RequestValidationError`、`HTTPException` 轉成錯誤外層                                                                                                                                                                                                                                                                                                                         | A7                                                                                         |
| 三個中介層                                                        | 橫切          | 見上一節的順序表                                                                                                                                                                                                                                                                                                                                                                           | A6、A7、A8、S2                                                                             |
| `MessageCatalog`                                                  | i18n          | 解析 `Accept-Language`（q-value、`*`、`q=0`），fallback `zh-TW`，從 `app/i18n/<lang>/messages.json` 取字                                                                                                                                                                                                                                                                                   | A8、architecture.mdx §i18n 兩層；clarification Q2                                          |
| `generate_operation_id`                                           | OpenAPI       | 從 method、路徑與 handler 回傳型別註記（`get_type_hints(route.endpoint)["return"]`）算「動詞加資源」，不讀函式名、不讀 `route.response_model`；沒有註記就丟例外                                                                                                                                                                                                                            | A1                                                                                         |
| `install_openapi`                                                 | OpenAPI       | 覆寫 `app.openapi`，只在第一次產生時做兩件事並快取：把 `422` 改寫成 `ErrorResponse`、移除 `HTTPValidationError`／`ValidationError`；把每個泛型元件的鍵改成它的 `title`，並改寫所有指向它的 `$ref`。改名後的鍵若與既有元件撞名就丟例外（`create_app` 不呼叫 `app.openapi()`，所以不會讓啟動失敗；失敗的是匯出指令（非零結束、不寫檔）與第一次請求 `/openapi.json`，CI 的 drift 檢查會攔下） | A1、A4、clarification Q8、N3；維護者 2026-11-20 裁定                                       |
| `export_openapi`                                                  | OpenAPI       | 用固定的佔位 `Settings` 呼叫 `create_app`，不跑 lifespan、不連資料庫，輸出排序過的 JSON                                                                                                                                                                                                                                                                                                    | A4、A5                                                                                     |
| `HealthRouter`／`HealthService`／`HealthRepository`／`HealthData` | 模組 `health` | 第一個模組，示範完整分層；`ping()` 用 `select(literal(1))`，不用 `text()`                                                                                                                                                                                                                                                                                                                  | B1、B5；clarification Q3、Q8，結論（待決 10）                                              |

### 關鍵設計細節

**外層與 camelCase**（A1、A2、#503）

- Python 欄位 snake_case，JSON 由 `ApiModel` 的 alias generator 轉成 camelCase；FastAPI 預設 `response_model_by_alias=True`，OpenAPI schema 也用 alias，所以 #504 驗收第 6 項可直接掃 `openapi.json`。
- **請求只認 alias**（#503 裁定 3、A2）：request 與 query 的 schema 繼承 `RequestModel`（`validate_by_name=False`），送 snake_case 欄位名的 body 不會被默默接受，而是落進 `extra="forbid"`，回 `422`、`extra_forbidden`，同時缺 camelCase 欄位會再報 `missing`。回應繼承 `ResponseModel`，允許後端用欄位名建構（`Envelope` 組 `ApiResponse(trace_id=...)` 需要），輸出仍用 alias。兩個基底分開，是因為單一基底設 `validate_by_name=False` 會讓後端自己建構回應時也只能傳 alias。
- 泛型外層在 OpenAPI 的元件名預設是 `ApiResponse_HealthData_`，Orval 產出的型別名會很難讀。目標是 `ApiResponse[HealthData]` 的元件名為 `HealthDataResponse`、`ApiResponse[PaginatedResponse[TaskItem]]` 為 `TaskItemPageResponse`；完整命名規則寫在 `api-contract` §OpenAPI 元件命名（clarification Q8、N3）。做法分兩段（維護者 2026-11-20 裁定）：
  - 覆寫 `ApiResponse.model_parametrized_name` 與 `PaginatedResponse.model_parametrized_name`，產生 `title`（與 `__name__`）。
  - 實作時確認：在 pydantic 2.14.4／fastapi 0.165.0 上，`model_parametrized_name` **不會**改變 OpenAPI 的元件鍵，鍵仍是 `ApiResponse_HealthData_`。所以元件鍵另由 `app/core/openapi.py` 的 `install_openapi` 改：見下方「介面描述檔匯出」。
- `timestamp`：ISO 8601、UTC、毫秒、`Z` 結尾（例 `2026-11-20T08:15:30.123Z`），在 `Envelope` 組裝時取 `datetime.now(UTC)`（clarification Q8）。
- `code`：成功固定 `OK`；錯誤碼 `UPPER_SNAKE_CASE`，通用碼不加前綴，模組專屬碼加模組前綴（例 `TASK_NAME_DUPLICATED`）。第一批通用碼：`VALIDATION_FAILED`（422）、`NOT_FOUND`（404）、`METHOD_NOT_ALLOWED`（405）、`NOT_ACCEPTABLE`（406）、`INTERNAL_ERROR`（500）、`DATABASE_UNAVAILABLE`（503）（clarification Q8）。

**422 的逐欄位錯誤**（A7）

- `RequestValidationError.errors()` 每一筆轉成 `ErrorDetail`：`location` 取 `loc[0]`（`body`、`query`、`path`、`header`），`field` 是其餘 `loc` 用 `.` 串起（Pydantic 的 `loc` 已是 alias，所以是呼叫端送出的 camelCase 名），`code` 取 Pydantic 的 `type`（例 `missing`、`extra_forbidden`），`message` 取 Pydantic 的 `msg`。
- **不帶 Pydantic 的 `input`、`ctx`、`url`**：`input` 會把呼叫端送來的原值回顯，之後的端點可能含密碼或答案內容。
- `errors` 內的 `message` 屬 A8 的明文例外，不本地化；外層的 `message` 仍依 locale 翻譯。

**追蹤編號**（clarification Q8）

- 標頭 `X-Correlation-ID` 與外層 `traceId` 用同一個值。
- 呼叫端自帶的值只在符合 `^[A-Za-z0-9-]{8,64}$` 時沿用，其餘一律丟棄並產生 UUID4，不回 `400`（Hard Rule 9：外部輸入先驗證才進 log 與回應）。
- 值寫進 `scope["state"]["correlation_id"]` 與 contextvar，handler、log 都從這裡取。

**設定與啟動失敗**（clarification Q1；帶憑證依 clarification 結論，待決 3）

| 環境變數                 | 型別                   | 必要 | 驗證                                                                                                                                                                                                                | 預設                    |
| :----------------------- | :--------------------- | :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------- |
| `CORS_ALLOWED_ORIGINS`   | 逗號分隔的 origin 清單 | 是   | 每一項都要是 `http(s)://host[:port]`、不帶路徑；拒絕 `*`、空清單                                                                                                                                                    | 無                      |
| `CORS_ALLOW_CREDENTIALS` | bool                   | 否   | —                                                                                                                                                                                                                   | `true`                  |
| `DATABASE_URL`           | PostgreSQL URL         | 否   | 只接受 `postgresql://`、`postgresql+asyncpg://`、`postgres://` 三種 scheme，一律正規化成 `postgresql+asyncpg://`；其他驅動（例 `postgresql+psycopg://`、`postgresql+psycopg2://`）與非 PostgreSQL scheme 都啟動失敗 | 無（沒設就走 Lite）     |
| `SQLITE_PATH`            | 路徑                   | 否   | —                                                                                                                                                                                                                   | `./data/label_suite.db` |

- `CORS_ALLOWED_ORIGINS` 是唯一的必要設定（clarification Q1）：缺少、空清單或含 `*` 都啟動失敗，這也讓 #504 驗收第 5 項有東西可驗；「clone 後不必設定就能跑」由 #506 的 `.env.example` 與 compose 預設值補上（需求矛盾 3）。
- 沒有 env 前綴，與 `architecture.mdx` 既有的 `DATABASE_URL`、`GOOGLE_CLIENT_ID` 一致。
- **類別拆兩層**：`DatabaseSettings` 只有 `DATABASE_URL`、`SQLITE_PATH` 兩項與 `async_database_url()`；`Settings` 繼承它，再加 CORS 兩項。app 讀 `Settings`，Alembic `env.py` 只讀 `DatabaseSettings`，所以跑遷移（含 #506 的部署與 CI）不必設定 `CORS_ALLOWED_ORIGINS`。
- **啟動錯誤訊息**由 `load_settings` 統一產生：攔下 `ValidationError`，以 `loc[0].upper()` 對回環境變數名，拋 `ConfigError`（`from None`）。訊息用大寫的環境變數名指出是哪一項（例 `CORS_ALLOWED_ORIGINS: must not contain "*"`、`DATABASE_URL: unsupported scheme`），不用 Python 欄位名，也不印值（S9：`DATABASE_URL` 可能含密碼）。
- `CORSMiddleware` 的 `allow_methods` 明列 `GET, POST, PUT, PATCH, DELETE, OPTIONS`，`allow_headers` 明列 `Content-Type, Accept-Language, X-Correlation-ID`（01-01 再加 CSRF header），不用 `*`。

**資料庫與 session**（ADR-003 D7、B3、B4）

- engine 在 lifespan 建立、存在 `app.state`，關閉時 `dispose()`；不放模組頂層全域（B3 反例）。
- `get_db` 的形狀：`async with sessionmaker() as session`，例外時 `rollback` 後重拋，離開時關閉；**交易由 Service 擁有**，`get_db` 與 Repository 都不 commit（B4）。健康檢查唯讀，不 commit。
- Lite：`sqlite+aiosqlite:///<SQLITE_PATH>`，啟動時建立父目錄；在 sync engine 的 `connect` 事件設 `PRAGMA foreign_keys=ON`，讓之後的外鍵在 SQLite 也生效。
- 正式：`postgresql+asyncpg://...`，`connect_args={"timeout": 5}` 讓資料庫連不上時健康檢查在有限時間內回應。
- **API 與 worker 的 session 分離**：本次只有 API 的 async session。worker 的同步 URL 推導（去掉 `+aiosqlite`、`+asyncpg` 換 `+psycopg2`）與同步 sessionmaker 留給第一個 Celery change，不預先建（ADR-003 D8、B3）。

**operationId**（A1）

- `generate_operation_id(route)` 的規則：去掉 `/api/v1` 前綴，取最後一個非參數的路徑段當資源，轉成 PascalCase；動詞依 method 與回應形狀決定：
  - `GET` 且回應形狀是 `ApiResponse[PaginatedResponse[...]]` → `list` 加複數資源（`listTasks`）
  - 其他 `GET` → `get` 加單數資源（`getTask`、`getHealth`）
  - `POST` → `create`；`PUT`／`PATCH` → `update`；`DELETE` → `delete`，皆加單數資源
- **回應形狀從 handler 的回傳型別註記讀**（維護者 2026-11-20 裁定）：fastapi 0.165.0 呼叫 `generate_unique_id_function` 時 `route.response_model` 還沒設定（不存在或是 `None`），所以函式改用 `typing.get_type_hints(route.endpoint)["return"]` 取回應形狀，不讀 `route.response_model`。
- 配套慣例：handler 一律把回傳型別註記寫成回應 schema（例 `-> ApiResponse[HealthData]`），**不傳 `response_model=`**；FastAPI 會從同一個註記推出回應模型，所以 OpenAPI 與 operationId 看的是同一個型別。
- 路由沒有回傳型別註記時，產生 operationId 直接丟例外，訊息寫出 method 與路徑（例 `GET /api/v1/health`），不退回看路徑猜動詞；`create_app` 在 `include_router` 時就會觸發，所以是啟動失敗。
- 單複數轉換用 `app/core/openapi.py` 內的一條簡單規則加一張不規則字表，不另加套件。
- 用回應形狀而不是路徑判斷 `list` 與 `get`，是因為 `/health` 這類單例資源沒有路徑參數，光看路徑會被誤判成集合。
- `create_app` 在 `include_router` 之後跑 `assert_unique_operation_ids`，撞名就啟動失敗，unit 測試同時鎖住。撞名時要怎麼加父資源（A1 要求加在契約裡、但產生處仍只有這個函式）本次沒有實例，解法等第一次撞名的 change 再定（clarification 結論，N1）。
- 本次唯一端點 `GET /api/v1/health` → `getHealth`。

**介面描述檔匯出**（A4、A5 前半段）

- `uv run python -m app.scripts.export_openapi [--output PATH]`，預設輸出 `backend/openapi.json`，並提交進 repo（clarification Q8、N2）。
- 用固定的佔位 `Settings`（例 `cors_allowed_origins=["http://localhost"]`）呼叫 `create_app`，不跑 lifespan、不連資料庫，所以不需要任何環境變數。
- 輸出 `sort_keys=True`、縮排 2、結尾換行，讓 #505 與 #506 的 drift 比對穩定。
- **`app.openapi` 覆寫**（維護者 2026-11-20 裁定）：`create_app` 呼叫 `install_openapi(app)`，把 `app.openapi` 換成一個包住 FastAPI 預設產生器的函式。它在第一次產生 schema 時依序做兩件事，結果存回 `app.openapi_schema`，之後直接回快取；`/openapi.json` 路由與匯出指令拿到的是同一份：
  1. 把每個端點的 `422` 改寫成 `ErrorResponse`，並移除 `components.schemas` 的 `HTTPValidationError` 與 `ValidationError`（api-contract §OpenAPI 元件命名與 `openapi.json`）。
  2. 泛型元件改名：對 `components.schemas` 裡鍵與 `title` 不同的元件（`ApiResponse[...]`、`PaginatedResponse[...]` 參數化後的元件），把鍵改成它的 `title`，再走訪整份 schema，把所有 `#/components/schemas/<舊鍵>` 的 `$ref` 改成新鍵。改名後的鍵若已是另一個元件的鍵（含另一個泛型元件改名後的鍵），**直接丟例外**，列出兩個舊鍵與撞到的名字，不覆蓋、不自動加後綴（`create_app` 不呼叫 `app.openapi()`，所以不會讓啟動失敗；失敗的是匯出指令（非零結束、不寫檔）與第一次請求 `/openapi.json`，CI 的 drift 檢查會攔下）。
- 只在這一處改鍵，不逐個 schema 指定 `json_schema_extra` 或 `title`，與 operationId 一樣維持單一產生處。unit 測試鎖住：`HealthDataResponse` 是鍵、沒有任何 `$ref` 仍指向 `ApiResponse_` 開頭的鍵、人為製造的撞名會丟例外。

**未處理例外的 log**（clarification 結論，待決 16）

- 用標準函式庫 `logging` 寫一筆 `ERROR`：`traceId`、method、path、例外型別與堆疊。
- 不記 request body、query、header、cookie（S9）；這不是可觀測性（ADR-008 D4 不做的是監控、指標與錯誤追蹤服務），只是讓部署者能用回應裡的 `traceId` 找到原因。

**測試**（ADR-007 D1、T1、T4、B7）

- 測試資料庫：有 `TEST_DATABASE_URL` 就用 PostgreSQL，沒有就用 `tmp_path` 下的 SQLite 檔（不用 `:memory:`，多連線會看到不同的庫）。兩種資料庫各跑一次 `uv run pytest`。
- PostgreSQL 的來源（clarification Q5）：本次驗收用本機 `docker run postgres:16` 起暫時的資料庫，設定 `TEST_DATABASE_URL` 後跑 pytest，指令與結果寫進 `acceptance.md`。沒設 `TEST_DATABASE_URL` 時，只能在 PostgreSQL 上跑的測試自動跳過、不算失敗。CI 裡的 PostgreSQL 由 #506 建。
- 覆蓋率（clarification Q8）：以 `pytest-cov` 產出報告，數字記在 `acceptance.md`；本次不設門檻，門檻由 #506 建。
- 測試庫的 schema 一律 `alembic upgrade head` 建立，不用 `create_all`（B6）。
- integration 用 `httpx.AsyncClient(transport=ASGITransport(app))` 打 `create_app(test_settings)` 產生的 app，中介層與 handler 與正式環境相同（T4）。
- 驗證失敗與未處理例外需要一條會觸發它們的路由，而本次唯一的端點沒有輸入、也不會丟例外。在測試 fixture 對 `create_app()` 產生的 app 額外 `include_router` 一個只存在於 `tests/` 的探測 router（一條帶 body 的 `POST`、一條會丟 `RuntimeError` 的 `GET`）。這是在同一個組裝之上多加路由，不少任何中介層，不算 T4 禁止的「harness 比 production 寬鬆」（clarification Q8、N4）。
- unit：`RequestModel` 只認 camelCase alias（snake_case 欄位名回 `extra_forbidden`）與 `extra="forbid"`、`ResponseModel` 可用欄位名建構且輸出 camelCase、`PaginatedResponse` 的推導（含 `total=0`、`offset >= total`）、`generate_operation_id` 的對照表與撞名檢查、`Settings` 的驗證（缺 `CORS_ALLOWED_ORIGINS`、含 `*`、`DATABASE_URL` 三種接受的 scheme 都正規化成 `+asyncpg`、`+psycopg` 等其他驅動被拒、錯誤訊息用大寫環境變數名）、`DatabaseSettings` 在沒有 `CORS_ALLOWED_ORIGINS` 時可單獨建立、`resolve_locale` 的 q-value 規則、追蹤編號的接受與丟棄。
- integration：每個 [§關鍵情境](#關鍵情境) 至少一條；遷移的 `upgrade → downgrade → upgrade`；請求結束後 pool 的 checked-out 連線回到 0（B3 檢查方式）。

## 關鍵情境

本 change 的 `specs/` 尚未寫出（由 `planner` 在 clarification 之後產生）。下列情境名稱依 #504 §驗收條件 與 system-analysis §業務流程 擬定，**`planner` 寫 spec 的 `#### Scenario:` 時請沿用同一組名稱**，讓 Sequence Diagram 與 spec 對得上（`rules.system-design`）。

參與者到 Router 回傳回應為止。本次沒有認證依賴，`中介層` 代表上一節順序表的追蹤編號、CORS、未處理例外與語言四層。

### Scenario: 健康檢查回傳完整外層與追蹤編號

```mermaid
sequenceDiagram
  participant Client
  participant MW as 中介層
  participant Router as HealthRouter
  participant Service as HealthService
  participant Repo as HealthRepository
  participant DB
  Client->>MW: GET /api/v1/health（可帶 X-Correlation-ID、Accept-Language）
  MW->>MW: 驗證或產生追蹤編號，寫入 request state
  MW->>MW: 解析語言偏好，未帶時用 zh-TW
  MW->>Router: 轉交請求
  Router->>Service: check()（經 get_health_service 注入，get_db 開一個 session）
  Service->>Repo: ping()
  Repo->>DB: select(literal(1))
  DB-->>Repo: 1
  Repo-->>Service: None
  Service-->>Router: HealthData(status=ok, database=ok)
  Router->>Router: Envelope.ok 組外層：code OK、本地化 message、timestamp、traceId
  Router-->>MW: 200 ApiResponse HealthData
  MW-->>Client: 200 外層，標頭 X-Correlation-ID 與 traceId 同值
  Note over Router,DB: 請求結束 get_db 關閉 session，連線回到 pool
```

### Scenario: 資料庫無法連線時健康檢查回 503 外層

clarification Q3：健康檢查實際對資料庫執行一次 `SELECT 1`，連不上回 `503`、`DATABASE_UNAVAILABLE`，不回 `200` 加降級欄位；PostgreSQL 連線最多等 5 秒。

```mermaid
sequenceDiagram
  participant Client
  participant MW as 中介層
  participant Router as HealthRouter
  participant Service as HealthService
  participant Repo as HealthRepository
  participant DB
  participant EH as ExceptionHandler
  Client->>MW: GET /api/v1/health
  MW->>Router: 轉交請求（已帶追蹤編號與語言）
  Router->>Service: check()
  Service->>Repo: ping()
  Repo->>DB: select(literal(1))
  alt 連線失敗或逾時（PostgreSQL 5 秒）
    DB-->>Repo: OperationalError 或 OSError
    Repo-->>Service: 原樣往上拋（資料層不處理 HTTP）
    Service->>Service: 轉成 DatabaseUnavailableError
    Service-->>EH: raise AppError（503、DATABASE_UNAVAILABLE）
    EH->>EH: Envelope.error：success false、data null、本地化 message，不含連線字串或驅動錯誤
    EH-->>MW: 503 錯誤外層
  end
  MW-->>Client: 503 錯誤外層與 X-Correlation-ID
```

### Scenario: 請求驗證失敗回 422 外層與逐欄位錯誤

本次唯一的端點沒有輸入，這張圖以只存在於 `tests/` 的探測路由為例（clarification Q8、N4）；之後每個帶 body 的端點走同一條路。

```mermaid
sequenceDiagram
  participant Client
  participant MW as 中介層
  participant FA as FastAPI 參數解析
  participant Router
  participant EH as ExceptionHandler
  Client->>MW: POST /api/v1/probe（缺必填欄位或多送未知欄位）
  MW->>FA: 轉交請求
  FA->>FA: 以 RequestModel 子類別驗證 body（extra forbid、只認 camelCase alias，snake_case 欄位名視為未知欄位）
  alt 驗證失敗
    FA-->>EH: RequestValidationError
    EH->>EH: 每筆錯誤轉 ErrorDetail（location、field、code、message），丟掉 input、ctx、url
    EH->>EH: Envelope.error：422、VALIDATION_FAILED、本地化外層 message、errors
    EH-->>MW: 422 錯誤外層
  else 驗證通過
    FA->>Router: 呼叫 handler
    Router-->>MW: 200 外層
  end
  MW-->>Client: 回應與 X-Correlation-ID
```

### Scenario: 未處理例外回 500 外層且不露出堆疊

```mermaid
sequenceDiagram
  participant Client
  participant Corr as CorrelationIdMiddleware
  participant CORS as CORSMiddleware
  participant UEM as UnhandledExceptionMiddleware
  participant Router
  participant Log as logging
  Client->>Corr: GET /api/v1/probe-crash
  Corr->>CORS: 帶追蹤編號轉交
  CORS->>UEM: 轉交
  UEM->>Router: 轉交（經語言中介層與路由）
  Router-->>UEM: 未處理例外（例 RuntimeError、ResponseValidationError）
  alt 回應尚未開始送出
    UEM->>Log: ERROR：traceId、method、path、例外型別與堆疊（不含 body、header、cookie）
    UEM->>UEM: Envelope.error：500、INTERNAL_ERROR、通用本地化 message、data null
    UEM-->>CORS: 500 錯誤外層
  else 回應已開始送出
    UEM->>Log: ERROR 同上
    UEM-->>CORS: 重拋，由 ServerErrorMiddleware 收尾（無法再改回應）
  end
  CORS-->>Corr: 加上 CORS 標頭
  Corr-->>Client: 500 外層與 X-Correlation-ID，body 無堆疊、無例外訊息、無內部路徑
```

### Scenario: 不存在的路徑回 404 外層

```mermaid
sequenceDiagram
  participant Client
  participant MW as 中介層
  participant RT as Starlette 路由
  participant EH as ExceptionHandler
  Client->>MW: GET /api/v1/no-such-resource
  MW->>RT: 轉交
  alt 路徑不存在
    RT-->>EH: HTTPException 404
    EH->>EH: Envelope.error：404、NOT_FOUND、本地化 message
  else 路徑存在但方法不符
    RT-->>EH: HTTPException 405
    EH->>EH: Envelope.error：405、METHOD_NOT_ALLOWED，保留 Allow 標頭
  end
  EH-->>MW: 錯誤外層
  MW-->>Client: 回應與 X-Correlation-ID
```

### Scenario: 回應訊息依語言偏好本地化

clarification Q2：本次就實作完整的 A8，含解析規則、zh-TW 與 en 兩份訊息目錄、`406` 與 `Content-Language` 回應標頭。

```mermaid
sequenceDiagram
  participant Client
  participant LM as LocaleMiddleware
  participant Router
  participant Cat as MessageCatalog
  Client->>LM: GET /api/v1/health，Accept-Language 為 en 或 zh-TW 或 未帶
  LM->>Cat: resolve_locale(Accept-Language)
  alt 有可接受的語言（含 * 與未帶，未帶時 zh-TW）
    Cat-->>LM: en 或 zh-TW
    LM->>Router: 轉交，request state 帶 locale
    Router->>Cat: translate(health.ok, locale)
    Cat-->>Router: 該語言的字串
    Router-->>Client: 200 外層，message 為該語言，不是 key 也不是未翻譯的英文
  else 全部被拒（例 只接受 fr，或 en、zh-TW、星號都標 q=0）
    Cat-->>LM: NotAcceptableError
    LM-->>Client: 406 錯誤外層，NOT_ACCEPTABLE，message 用 zh-TW
  end
```

### Scenario: 缺必要設定時啟動失敗

```mermaid
sequenceDiagram
  participant Operator as 部署者
  participant Uvicorn as uvicorn --factory
  participant Factory as create_app
  participant Loader as load_settings
  participant Engine as AsyncEngine
  Operator->>Uvicorn: uv run uvicorn app.main:create_app --factory
  Uvicorn->>Factory: create_app()
  Factory->>Loader: load_settings(Settings)（建 Settings()，讀環境變數）
  alt 缺 CORS_ALLOWED_ORIGINS、含星號、或 DATABASE_URL scheme 不合法（含 +psycopg 等其他驅動）
    Loader->>Loader: 攔下 ValidationError，loc[0].upper() 對回環境變數名
    Loader-->>Factory: ConfigError("<ENV_VAR>: <msg>")，from None，不印值
    Factory-->>Uvicorn: 例外往上拋
    Uvicorn-->>Operator: 程序以非零狀態結束，服務未啟動
  else 設定合法
    Loader-->>Factory: settings
    Factory->>Factory: 掛中介層、handler、router，檢查 operationId 唯一
    Uvicorn->>Factory: 進入 lifespan
    Factory->>Engine: 依 DATABASE_URL 有無選正式層或 Lite 層建 engine
    Uvicorn-->>Operator: 服務就緒
  end
```

### Scenario: 匯出的介面描述檔為小駝峰且操作識別名符合動詞加資源

```mermaid
sequenceDiagram
  participant Dev as 開發者或 CI
  participant Script as export_openapi
  participant Factory as create_app
  participant OA as OpenApiTools
  Dev->>Script: uv run python -m app.scripts.export_openapi
  Script->>Factory: create_app(佔位 Settings)，不跑 lifespan
  Factory->>OA: generate_unique_id_function = generate_operation_id
  alt 路由沒有回傳型別註記
    OA-->>Script: 例外，寫出該路由的 method 與路徑
    Script-->>Dev: 非零狀態結束，不寫檔
  end
  Factory->>OA: assert_unique_operation_ids(app)
  alt operationId 撞名
    OA-->>Script: 例外，列出撞名的兩條路由
    Script-->>Dev: 非零狀態結束，不寫檔
  else 唯一
    Script->>OA: app.openapi()（install_openapi 的覆寫）
    OA->>OA: FastAPI 預設產生 schema
    OA->>OA: 422 改寫成 ErrorResponse，移除 HTTPValidationError／ValidationError
    OA->>OA: 泛型元件鍵改成 title（ApiResponse_HealthData_ 改為 HealthDataResponse），改寫所有 $ref
    alt 改名後的鍵與既有元件撞名
      OA-->>Script: 例外，列出撞名的元件
      Script-->>Dev: 非零狀態結束，不寫檔
    else 無撞名
      OA-->>Script: OpenAPI dict（schema 欄位用 camelCase alias，GET /api/v1/health 為 getHealth）
      Script-->>Dev: 寫 backend/openapi.json（sort_keys、縮排 2、結尾換行）
    end
  end
```

### Scenario: 資料庫遷移在兩種資料庫上可升可降

clarification Q8：建立一個不含任何操作的基準遷移。

```mermaid
sequenceDiagram
  participant Test as pytest integration
  participant Alembic as alembic env.py
  participant Loader as load_settings
  participant DB as 測試資料庫（SQLite 檔或 PostgreSQL）
  Test->>Alembic: upgrade head
  Alembic->>Loader: load_settings(DatabaseSettings)（不需 CORS 設定）
  alt DATABASE_URL scheme 不合法
    Loader-->>Alembic: ConfigError("DATABASE_URL: <msg>")，遷移不執行
  else 合法
    Loader-->>Alembic: db_settings
  end
  Alembic->>Alembic: db_settings.async_database_url()（與 app 同一個推導）
  Alembic->>DB: render_as_batch=True、命名慣例，套用基準遷移
  DB-->>Alembic: alembic_version 有一列
  Test->>Alembic: downgrade base
  Alembic->>DB: 還原基準遷移
  DB-->>Alembic: alembic_version 為空
  Test->>Alembic: upgrade head
  Alembic->>DB: 再套用一次
  DB-->>Test: 成功；兩種資料庫各跑一輪
```

本次沒有狀態轉換，不畫 `stateDiagram-v2`。

## 資料模型異動

本次無資料模型異動。#504 §不包含 明列「任何業務資料表」，system-analysis §共用的資料 也確認不建表，所以 `docs/diagrams/architecture/data-table-dictionary.mdx` 與 `database-schema.er.json` 都不動，不必跑 `pnpm check:er`。

以下是遷移的基礎設定，不屬資料模型異動，列出來是因為之後每個模組的遷移都會建在它上面：

| 項目              | 做法                                                                                                                                                                                                                                  | 依據                                               |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------- |
| 約束命名慣例      | `ix: ix_%(column_0_label)s`、`uq: uq_%(table_name)s_%(column_0_name)s`、`ck: ck_%(table_name)s_%(constraint_name)s`、`fk: fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s`、`pk: pk_%(table_name)s`，設在 `Base.metadata` | B6；SQLite 的 batch 模式重建表時要靠約束名找到約束 |
| `render_as_batch` | `env.py` 一律設 `True`。在 PostgreSQL 上 batch 操作照常發出 `ALTER`，只有 SQLite 會重建表，所以兩種資料庫用同一份遷移檔                                                                                                               | ADR-003 D7                                         |
| 檔名模板          | `file_template = %%(year)d%%(month).2d%%(day).2d_%%(hour).2d%%(minute).2d_%%(rev)s_%%(slug)s`，依時間排序                                                                                                                             | #504 §包含                                         |
| `env.py` 的 URL   | 以 `load_settings(DatabaseSettings)` 建立，與 app 共用 `async_database_url()`，以 async engine 跑 `run_sync`；不另讀環境變數，也不需要 `CORS_ALLOWED_ORIGINS`                                                                         | B10                                                |
| model 的收集      | `env.py` 用 `pkgutil` 掃 `app.modules.*.models` 自動 import，新模組不必改 `env.py`                                                                                                                                                    | B6                                                 |
| `compare_type`    | `True`，autogenerate 時偵測型別變更；產物仍要人工讀過，確認沒有非預期的 `DROP`（B6 正例）                                                                                                                                             | B6                                                 |
| 基準遷移          | 一個空的 revision，`upgrade` 與 `downgrade` 都不做事；**down 可完全還原**（只移除 `alembic_version` 那一列）（clarification Q8）                                                                                                      | B6、T4                                             |

SQLite 與 PostgreSQL 在本次碰得到的差異：

| 面向     | SQLite（Lite）                     | PostgreSQL（正式） | 本次處理                                                                      |
| :------- | :--------------------------------- | :----------------- | :---------------------------------------------------------------------------- |
| 驅動     | `aiosqlite`                        | `asyncpg`          | `DatabaseSettings.async_database_url()` 一處推導                              |
| 外鍵     | 預設不檢查                         | 預設檢查           | `connect` 事件設 `PRAGMA foreign_keys=ON`                                     |
| DDL 交易 | 多數 `ALTER` 不支援，要重建表      | 支援交易內 DDL     | `render_as_batch=True`                                                        |
| 連線失敗 | 幾乎不會（檔案），父目錄不存在才會 | 網路或服務停止     | 啟動時建父目錄；PostgreSQL 連線逾時 5 秒                                      |
| 並發寫入 | 單一寫入者                         | 多寫入者           | 本次沒有寫入；JSON／JSONB、日期與並發的雙庫測試由第一個建表的 change 補（B7） |

## 權限檢查點

本次**沒有任何受保護的能力**：沒有登入、沒有角色、沒有欄位遮蔽，所有呼叫端拿到的內容相同（system-analysis §涉及的角色）。PRD §權限矩陣 不適用，也沒有超出它的地方。

| 檢查點                                                | 本次                                                                                          | 之後由誰接上                |
| :---------------------------------------------------- | :-------------------------------------------------------------------------------------------- | :-------------------------- |
| 認證 dependency（驗 httpOnly cookie 裡的 access JWT） | 不實作；中介層順序表留了位置                                                                  | 規格 01-01 登入             |
| CSRF middleware                                       | 不實作；`allow_headers` 之後補 CSRF header                                                    | 規格 01-01 登入             |
| 授權四步（architecture.mdx §授權四步）                | 不實作                                                                                        | 第一個有受保護端點的 change |
| 欄位遮蔽                                              | 無；所有回應 schema 都明列欄位，不回 ORM 物件（A2）                                           | 各模組的 Router             |
| `GET /api/v1/health`                                  | 刻意公開，不需登入；認證上線後也維持公開，01-01 在 S10 矩陣標成刻意的例外（clarification Q4） | 規格 01-01 登入             |

骨架為之後的權限檢查先定好兩件事：

- **看不到的資源回 404**：`NotFoundError` 與路由不存在的 404 用同一個 `NOT_FOUND` 碼與同一句訊息，之後「刻意隱藏」與「真的不存在」從外層分不出來（A7）。
- **Service 不丟 `HTTPException`**：權限以外的業務卡控丟 `AppError`，由 handler 轉外層，資料層不處理 HTTP（B1）。

**測試集答案隔離**：本次不碰任務、資料集或答案，**無直接風險**。骨架是之後所有端點的出口，先在這一層擋住三條間接外洩路徑：

1. 未處理例外的 `500` 外層只放通用訊息，不含例外訊息、堆疊或內部路徑，例外的細節只進伺服器 log（A7、07-01 §卡控機制）。
2. `422` 的 `errors` 不帶 Pydantic 的 `input`，不回顯呼叫端送來的值。
3. 回應一律經明列欄位的 schema 序列化，沒有回 ORM 物件的路徑（A2、S4）。

## 技術待決問題

### system-analysis 待決問題與需求矛盾的處理

全部已在 clarification 停點處理：需要維護者決定的由 Q1–Q9 決議（2026-11-20），其餘依 `clarification.md` §不需維護者決定的結論 定案。

| 待決           | 主題                       | 決議                                                                                                                                                                                     | 依據                          | 寫在                                                                   |
| :------------- | :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------- | :--------------------------------------------------------------------- |
| 1（含矛盾 3）  | 必要設定                   | 只有 `CORS_ALLOWED_ORIGINS` 必要，缺少、空清單或含 `*` 都啟動失敗；其餘有預設。免設定即可啟動由 #506 的 `.env.example` 與 compose 預設值補                                               | clarification Q1              | §關鍵設計細節「設定與啟動失敗」                                        |
| 2（含矛盾 4）  | `message` 本地化           | 本次實作完整 A8：q 值解析、`zh-TW` 與 `en` 兩份訊息目錄、預設 `zh-TW`、全部被拒回 `406`、`Content-Language` 標頭；`ErrorDetail.message` 維持英文                                         | clarification Q2              | `LocaleMiddleware`、`MessageCatalog`、情境「回應訊息依語言偏好本地化」 |
| 3              | CORS 帶憑證                | `allow_credentials=True`，origins、methods、headers 都明列                                                                                                                               | clarification 結論（待決 3）  | §關鍵設計細節「設定與啟動失敗」                                        |
| 4              | PostgreSQL 由誰提供        | 本機 `docker run postgres:16` 加 `TEST_DATABASE_URL` 驗收，指令與結果寫進 `acceptance.md`；沒設變數時 PostgreSQL 測試跳過；CI 的 PostgreSQL 由 #506 建                                   | clarification Q5              | §關鍵設計細節「測試」                                                  |
| 5              | `pyproject.toml` 初始版號  | `0.0.0`，表示尚未 release；第一次 `chore(release)` 才改正式版號；#505 的 `frontend/package.json` 沿用                                                                                    | clarification Q7              | —                                                                      |
| 6              | `code` 規則                | 成功 `OK`；`UPPER_SNAKE_CASE`；通用碼無前綴、模組碼加模組前綴；第一批六個                                                                                                                | clarification Q8              | §關鍵設計細節「外層與 camelCase」                                      |
| 7              | 追蹤編號                   | 標頭與 `traceId` 同值；自帶值符合格式才沿用，否則重新產生、不回錯誤                                                                                                                      | clarification Q8              | §關鍵設計細節「追蹤編號」                                              |
| 8              | `timestamp` 格式           | ISO 8601、UTC、毫秒、`Z`                                                                                                                                                                 | clarification Q8              | §關鍵設計細節「外層與 camelCase」                                      |
| 9              | 覆蓋率基準                 | 本次以 `pytest-cov` 產出報告，數字記在 `acceptance.md`；不設門檻，門檻與不得下降由 #506 建                                                                                               | clarification Q8              | §關鍵設計細節「測試」                                                  |
| 10（含矛盾 2） | 健康檢查的回應形狀         | 有明確的 `HealthData`，以 handler 回傳型別註記宣告，放進 `openapi.json`                                                                                                                  | clarification 結論（待決 10） | `HealthData`、情境「健康檢查回傳完整外層與追蹤編號」                   |
| 11             | 健康檢查碰資料庫           | 實際執行 `SELECT 1`；連不上回 `503`、`DATABASE_UNAVAILABLE`；PostgreSQL 連線最多等 5 秒                                                                                                  | clarification Q3              | 情境「資料庫無法連線時健康檢查回 503 外層」                            |
| 12             | 認證上線後健康檢查是否公開 | 刻意公開，認證上線後也維持；01-01 在 S10 矩陣列為刻意的例外                                                                                                                              | clarification Q4              | §權限檢查點                                                            |
| 13             | 空的基準遷移               | 建立；`up`、`down` 都不做事，可完全還原，「上、下、再上」在兩種資料庫實際跑過                                                                                                            | clarification Q8              | §資料模型異動、情境「資料庫遷移在兩種資料庫上可升可降」                |
| 14             | 健康檢查當第一個模組       | 放 `app/modules/health/`，走完整的 router、service、repository、schemas 四件，給 #506 的分層檢查當對象                                                                                   | clarification Q8              | §目錄結構                                                              |
| 15（含矛盾 1） | `ruff`、`mypy --strict`    | 本次建立 `ruff check`、`ruff format --check`、`mypy --strict app`，寫進 `openspec/config.yaml`，只在本機與 apply 檢查時跑、不加 CI job；import 方向、drift、覆蓋率門檻與 Semgrep 歸 #506 | clarification Q6              | 見下方「`openspec/config.yaml` 要補的指令」                            |
| 16             | 未處理例外的 log           | 寫一筆含 `traceId` 的 `ERROR`，不記 body、query、header、cookie                                                                                                                          | clarification 結論（待決 16） | §關鍵設計細節「未處理例外的 log」                                      |

`openspec/config.yaml` 的 `operations.apply.guidance` 要補的後端指令（#504 驗收第 7 項；clarification Q6，不加 CI job）：

- `cd backend && uv run pytest`（SQLite）
- `cd backend && TEST_DATABASE_URL=postgresql+asyncpg://... uv run pytest`（PostgreSQL）
- `cd backend && uv run ruff check . && uv run ruff format --check .`
- `cd backend && uv run mypy --strict app`
- `cd backend && uv run python -m app.scripts.export_openapi && git diff --exit-code -- openapi.json && test -z "$(git status --porcelain -- openapi.json)"`（指令在 `backend/` 內執行，所以路徑寫 `openapi.json`；`git diff` 抓已追蹤檔的內容漂移，`git status --porcelain` 補抓檔案尚未追蹤的情況）

### 本文新發現的待決問題

全部已處理；處理方式寫在「結論」欄。

| #   | 問題                                                                                                                                                                                                                   | 影響                                                                   | 結論                                                                                                                                                                                                                                                             |
| :-- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | operationId 撞名時，A1 要求「在 `api-contract.md` 把名字加上父資源」，但同時要求產生處只有 `generate_unique_id_function`、不得逐個覆寫。函式只看得到單一路由，不知道別的路由是否同名，契約裡寫的父資源要怎麼回到函式？ | 第一個巢狀資源出現時的命名機制；本次沒有實例，不卡本次                 | 已定（clarification 結論）：本次只做「撞名就啟動失敗」；解法等第一次撞名的 change 再定，屆時候選是「巢狀路徑一律加父資源」或「在 `openapi.py` 維護一張集中的撞名表」，兩者都只有一個產生處                                                                       |
| N2  | 匯出的 `openapi.json` 放哪裡、是否提交進 repo？                                                                                                                                                                        | #505 Orval 的輸入路徑；A5 要求契約、`openapi.json` 與產物同一個 commit | 已決（clarification Q8）：放 `backend/openapi.json` 並提交；#505 的 Orval 讀這個路徑                                                                                                                                                                             |
| N3  | 泛型外層在 OpenAPI 的元件名（`ApiResponse_HealthData_` 對 `HealthDataResponse`）                                                                                                                                       | Orval 產出的 TypeScript 型別名；之後改名是對前端的破壞性變更           | 已決（clarification Q8）：元件名 `XResponse`／`XPageResponse`／`XPage`，規則寫在 `api-contract`。機制（維護者 2026-11-20 裁定）：`model_parametrized_name` 產生 `title`，`app/core/openapi.py` 的 `app.openapi` 覆寫把元件鍵改成 title 並改寫 `$ref`，撞名即失敗 |
| N4  | 驗證失敗與未處理例外的 integration 測試需要觸發它們的路由，本次唯一的端點兩者都觸發不了                                                                                                                                | #504 驗收第 3、4 項怎麼驗                                              | 已決（clarification Q8）：只在 `tests/` 定義探測 router，掛在 `create_app()` 產生的同一個 app 上；不在正式程式留測試端點                                                                                                                                         |
| N5  | `ServerErrorMiddleware` 位在 CORS 外面，由它產生的 `500` 沒有 CORS 標頭；跨來源的前端只會看到 CORS 錯誤                                                                                                                | 未處理例外時前端能否顯示通用錯誤並附 `traceId`（A7）                   | 已定（clarification 結論）：由 CORS 內側的 `UnhandledExceptionMiddleware` 處理；回應已開始送出時無法補救，只能由 log 追查。供 `code-reviewer` 與 #505 知悉                                                                                                       |
| N6  | `/docs`、`/redoc`、`/openapi.json` 這三條 FastAPI 內建路由在正式部署是否關閉？它們不在 `/api/v1` 底下，也不套外層                                                                                                      | 正式環境是否公開 API 結構；不卡本次驗收                                | 已定（clarification 結論）：本次維持 FastAPI 預設開啟；正式環境是否關閉交給 #506 的部署設定                                                                                                                                                                      |

### 交易、session 與效能

- **交易邊界**：Service 擁有交易（B4）；`get_db` 只負責開關與例外時 rollback。本次健康檢查唯讀，沒有 commit。
- **session 生命週期**：API 一個請求一個 `AsyncSession`，由 `get_db` 依賴管理；worker 的同步 session 本次不建，留給第一個 Celery change，兩者不共用 engine（B3）。
- **效能**：健康檢查每次都打資料庫，若之後被負載平衡器高頻輪詢，PostgreSQL 連線池會被占用。本次不處理，等 #506 定下健康檢查的輪詢頻率時再評估是否拆出不碰資料庫的 liveness 端點。PostgreSQL 連不上時，請求最多等 5 秒（`connect_args` 逾時）。
