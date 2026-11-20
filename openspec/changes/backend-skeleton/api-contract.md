# API Contract

本 change 只新增一個端點 `getHealth`，另外定下之後每個端點都沿用的共用契約：回應外層、錯誤外層、`422` 的逐欄位錯誤、錯誤碼、分頁形狀、`X-Correlation-ID`、`Accept-Language`、CORS，以及 OpenAPI 元件命名與 `openapi.json` 的位置。

已裁定、照寫不列待決的三件事（維護者 2026-11-10）：路徑前綴 `/api/v1`、成功回應包一層 envelope、模組內分層。外層六個欄位與 camelCase 依 #503（2026-11-20）。

原本待決的項目都已在 clarification 停點處理：維護者 2026-11-20 決議 Q1–Q9，其餘依 `clarification.md` §不需維護者決定的結論。本文照決議寫成定案，並標出對應的「clarification Q<n>」。

設計依據：ADR-003 D5、D6；api-agent-rules A1–A4、A7、A8、A10；security-agent-rules S2、S9；`system-design.md`。

## 端點總覽

| Method | Path             | operationId | 角色             | 異動 |
| :----- | :--------------- | :---------- | :--------------- | :--- |
| `GET`  | `/api/v1/health` | `getHealth` | 公開（刻意，Q4） | 新增 |

- `getHealth` 由 `generate_operation_id` 算出：`GET`、回應不是分頁、資源段 `health` → `get` 加 `Health`（`system-design.md` §關鍵設計細節「operationId」）。`openspec/specs/` 與 `backend/` 目前沒有任何端點，不會撞名。
- 本次**沒有** envelope 例外的端點：沒有 `204`、檔案或串流。
- FastAPI 內建的 `/docs`、`/redoc`、`/openapi.json` 不在 `/api/v1` 底下，不是本契約的端點，也不套外層；本次維持 FastAPI 預設開啟，正式部署是否關閉交給 #506（clarification 結論，N6）。
- **BREAKING：無。** 本 change 是第一份契約，沒有既有端點可以破壞。但從本 change 起，外層、錯誤外層、`ErrorDetail`、錯誤碼與元件命名一旦被 #505 的產生 client 使用，之後任何更動都是破壞性變更，要依 A10 在該 change 的 `design.md` 寫影響範圍。

## 共用契約

這一節是之後所有端點的預設。個別端點的段落只寫和這裡不同的部分。

### 成功回應外層

`200`（以及之後的 `201`）一律包這一層。各端點段落的「Response」寫的是 `data` 裡那一層。

| 欄位        | JSON 型別             | nullable | 說明                                                                                                                   |
| :---------- | :-------------------- | :------- | :--------------------------------------------------------------------------------------------------------------------- |
| `success`   | boolean               | 否       | 成功固定 `true`                                                                                                        |
| `code`      | string                | 否       | 成功固定 `"OK"`（clarification Q8）                                                                                    |
| `message`   | string                | 否       | 已依 `Accept-Language` 本地化的字串，前端當不透明字串直接顯示；不是 i18n key、不是未翻譯的英文（A8，clarification Q2） |
| `data`      | 依端點                | 依端點   | 端點的資料；由各端點段落定義                                                                                           |
| `timestamp` | string（`date-time`） | 否       | 伺服器組外層的時間，ISO 8601、UTC、毫秒、`Z` 結尾，例 `2026-11-20T08:15:30.123Z`（clarification Q8）                   |
| `traceId`   | string                | 否       | 這次請求的追蹤編號，與回應標頭 `X-Correlation-ID` 同值（clarification Q8）                                             |

範例（`Accept-Language: zh-TW`）：

```json
{
  "success": true,
  "code": "OK",
  "message": "成功",
  "data": { "status": "ok", "database": "ok" },
  "timestamp": "2026-11-20T08:15:30.123Z",
  "traceId": "3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01"
}
```

### 錯誤回應外層

所有 `4xx`、`5xx` 都套這一層（A7）。

| 欄位        | JSON 型別             | nullable | 說明                                                                    |
| :---------- | :-------------------- | :------- | :---------------------------------------------------------------------- |
| `success`   | boolean               | 否       | 固定 `false`                                                            |
| `code`      | string                | 否       | 應用錯誤碼，見 [§錯誤碼](#錯誤碼)                                       |
| `message`   | string                | 否       | 已本地化的說明；不含例外訊息、堆疊、SQL、內部路徑、連線字串或內部識別碼 |
| `data`      | null                  | 是       | 固定 `null`                                                             |
| `timestamp` | string（`date-time`） | 否       | 同成功外層                                                              |
| `traceId`   | string                | 否       | 同成功外層；`5xx` 時前端顯示這個值，讓使用者回報                        |
| `errors`    | `ErrorDetail[]`       | 是       | 只有 `422` 帶非空陣列；其他錯誤為 `null`                                |

`errors` 在其他錯誤也出現、值為 `null`，讓 `ErrorResponse` 只有一個形狀，前端的單一錯誤型別（A6）不必分兩種。

### `ErrorDetail`（`422` 的逐欄位錯誤）

| 欄位       | JSON 型別 | nullable | 說明                                                                                                                                    |
| :--------- | :-------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `location` | string    | 否       | 錯誤所在：`body`、`query`、`path`、`header`、`cookie` 之一                                                                              |
| `field`    | string    | 否       | 欄位路徑，用 `.` 串接，用**呼叫端送出的 camelCase 名**，陣列索引寫數字（例 `items.0.displayName`）；錯誤在整個 location 時為空字串 `""` |
| `code`     | string    | 否       | Pydantic 的錯誤類型，例 `missing`、`extra_forbidden`、`string_too_short`、`int_parsing`、`json_invalid`                                 |
| `message`  | string    | 否       | Pydantic 產生的說明（英文）；屬 A8 的明文例外，不本地化。前端逐欄位顯示時應以 `code` 對照自己的 UI 字串，`message` 只是備援             |

- **不回傳** Pydantic 的 `input`（呼叫端送來的原值）、`ctx`、`url`：`input` 會把密碼、答案內容等原值回顯在回應裡。
- `errors` 的順序與 Pydantic 回報的順序相同，不保證穩定排序。

範例（`POST` 一個缺 `displayName`、多送 `nickName` 的 body）：

```json
{
  "success": false,
  "code": "VALIDATION_FAILED",
  "message": "輸入資料有誤，請檢查標示的欄位",
  "data": null,
  "timestamp": "2026-11-20T08:15:30.123Z",
  "traceId": "3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01",
  "errors": [
    { "location": "body", "field": "displayName", "code": "missing", "message": "Field required" },
    {
      "location": "body",
      "field": "nickName",
      "code": "extra_forbidden",
      "message": "Extra inputs are not permitted"
    }
  ]
}
```

### 錯誤碼

規則（clarification Q8）：

- 錯誤碼一律 `UPPER_SNAKE_CASE`。
- 通用錯誤碼不加前綴，由骨架定義。
- 模組專屬錯誤碼加模組前綴（例 `TASK_NAME_DUPLICATED`），由各功能 change 的 `api-contract.md` 新增。
- 錯誤碼一旦被前端使用就不改名；改名屬 A10 的破壞性變更。

第一批通用錯誤碼：

| HTTP  | `code`                 | 觸發條件                                                                                                                                                                      | `message`（zh-TW／en，clarification Q2、N9）                                                                                                                                                    |
| :---- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200` | `OK`                   | 成功（成功外層用）                                                                                                                                                            | 成功／Success                                                                                                                                                                                   |
| `404` | `NOT_FOUND`            | `/api/v1` 底下的路徑不存在；之後也用於「資源不存在」與「刻意隱藏」，三者訊息相同，不洩漏存在與否                                                                              | 找不到指定的資源／The requested resource was not found.                                                                                                                                         |
| `405` | `METHOD_NOT_ALLOWED`   | 路徑存在但 method 不支援；保留 `Allow` 標頭                                                                                                                                   | 不支援這個操作／This operation is not supported.                                                                                                                                                |
| `406` | `NOT_ACCEPTABLE`       | `Accept-Language` 列出的語言全部不支援或都被 `q=0` 拒絕（clarification Q2）                                                                                                   | 不支援所要求的語言／The requested language is not supported.（`406` 的 body 一律用 zh-TW，因為沒有可接受的語言；en 字串不會出現在任何回應 body，只為了兩份 `messages.json` 的鍵集合一致而存在） |
| `422` | `VALIDATION_FAILED`    | path、query、header 或 body 的 schema 驗證失敗，含未知 body 欄位（`extra="forbid"`）、用 snake_case 欄位名送出的欄位（請求只認 camelCase alias，#503 裁定 3）與 JSON 格式錯誤 | 輸入資料有誤，請檢查標示的欄位／Some fields are invalid. Please check the highlighted fields.                                                                                                   |
| `500` | `INTERNAL_ERROR`       | 未處理的例外，含回應 schema 驗證失敗                                                                                                                                          | 系統發生錯誤，請稍後再試／Something went wrong. Please try again later.                                                                                                                         |
| `503` | `DATABASE_UNAVAILABLE` | 資料庫連不上或連線逾時（PostgreSQL 5 秒，clarification Q3）                                                                                                                   | 資料庫暫時無法連線，請稍後再試／The database is temporarily unavailable. Please try again later.                                                                                                |

本次不定義、由之後的 change 加入的：`400`（語意或應用規則錯誤，與 `422` 分開，A7）、`401`、`403`、`409`。`401`、`403`、CSRF 失敗由規格 01-01 登入定義。

### 分頁形狀（`PaginatedResponse`）

本次沒有列表端點，下列形狀固定給之後的列表端點用（A3）。因為沒有端點引用，本次匯出的 `openapi.json` 裡**不會出現**這個元件。

Query（`PaginationParams`）：

| 欄位     | 型別    | 必填 | 驗證                |
| :------- | :------ | :--- | :------------------ |
| `limit`  | integer | 否   | 預設 `20`，`1..100` |
| `offset` | integer | 否   | 預設 `0`，`>= 0`    |

`data` 的欄位：

| 欄位         | JSON 型別 | nullable | 說明                                             |
| :----------- | :-------- | :------- | :----------------------------------------------- |
| `items`      | array     | 否       | 這一頁的資料，元素型別由端點定義                 |
| `total`      | integer   | 否       | 符合條件的總筆數                                 |
| `limit`      | integer   | 否       | 實際採用的 `limit`                               |
| `offset`     | integer   | 否       | 實際採用的 `offset`                              |
| `hasMore`    | boolean   | 否       | `offset + limit < total`                         |
| `totalPages` | integer   | 否       | `ceil(total / limit)`；`total = 0` 時為 `0`      |
| `nextOffset` | integer   | 是       | `hasMore` 為真時是 `offset + limit`，否則 `null` |

- 後三個欄位由前四個推導，不另查資料庫。
- `offset >= total` 時回 `200`、空 `items`、`hasMore: false`，不回 `404`。
- 每個列表端點仍要在自己的契約寫出 `limit` 上限、預設排序鍵與尾鍵、空頁行為（A3）。

### 請求與回應標頭

| 標頭               | 方向 | 規則                                                                                                                                                                                                                                            |
| :----------------- | :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Correlation-ID` | 請求 | 選填。符合 `^[A-Za-z0-9-]{8,64}$` 才沿用；不符合或沒帶時由伺服器產生小寫、帶連字號的 UUID4。**不符合時不回錯誤**，直接改用新產生的值（clarification Q8）                                                                                        |
| `X-Correlation-ID` | 回應 | **每一個回應都有**，含錯誤、`404`、`405`、`406`、`500` 與 CORS preflight；值與外層 `traceId` 相同。CORS 以 `Access-Control-Expose-Headers` 公開，瀏覽器的 JS 讀得到                                                                             |
| `Accept-Language`  | 請求 | 選填。依 q-value 由高到低挑第一個支援的語言（`zh-TW`、`en`）；`*` 視為接受預設 `zh-TW`；`q=0` 表示拒絕該語言；沒帶時用 `zh-TW`；全部被拒回 `406`。只作用在 `/api/v1` 底下（A8，clarification Q2）。比對不分大小寫，`zh`、`zh-Hant` 對到 `zh-TW` |
| `Content-Language` | 回應 | 有外層 `message` 的回應都帶，值為實際使用的語言（`zh-TW` 或 `en`）                                                                                                                                                                              |

`Content-Language` 是本契約新增的標頭，讓前端與測試不必從字串內容猜語言（clarification Q2、N10）。

### CORS

設定（clarification Q1；帶憑證依 clarification 結論，待決 3）：

| 項目                | 值                                                                          |
| :------------------ | :-------------------------------------------------------------------------- |
| 允許來源            | 環境變數 `CORS_ALLOWED_ORIGINS` 逐一列出，必要設定；拒絕 `*`（Hard Rule 7） |
| `allow_credentials` | `true`，讓 01-01 登入的 httpOnly cookie 可以隨請求送出                      |
| `allow_methods`     | `GET, POST, PUT, PATCH, DELETE, OPTIONS`                                    |
| `allow_headers`     | `Content-Type, Accept-Language, X-Correlation-ID`；01-01 再加 CSRF header   |
| `expose_headers`    | `X-Correlation-ID`                                                          |

不在清單內的來源：伺服器照常處理，但回應不帶 `Access-Control-Allow-Origin`，瀏覽器不放行。

### OpenAPI 元件命名與 `openapi.json`

元件命名（clarification Q8、N3）：

| Python 型別                                                | OpenAPI 元件名                    | 例                          |
| :--------------------------------------------------------- | :-------------------------------- | :-------------------------- |
| `ApiResponse[X]`                                           | `XResponse`                       | `HealthDataResponse`        |
| `ApiResponse[PaginatedResponse[X]]`                        | `XPageResponse`                   | `TaskItemPageResponse`      |
| `PaginatedResponse[X]`                                     | `XPage`                           | `TaskItemPage`              |
| `ErrorResponse`                                            | `ErrorResponse`（全專案共用一個） | —                           |
| `ErrorDetail`、其他 `ResponseModel`／`RequestModel` 子類別 | 類別名本身                        | `ErrorDetail`、`HealthData` |
| 欄位型別用的 `StrEnum` 子類別                              | 類別名本身                        | `HealthStatus`              |

- 在一處產生，不逐個 schema 指定（維護者 2026-11-20 裁定）：覆寫 `model_parametrized_name` 產生元件的 `title`；`app/core/openapi.py` 的 `app.openapi` 覆寫（與改寫 `422` 同一處）把每個泛型元件的鍵改成它的 `title`，並改寫所有指向它的 `$ref`。只覆寫 `model_parametrized_name` 不會改元件鍵（pydantic 2.14.4／fastapi 0.165.0 上仍是 `ApiResponse_HealthData_`）。
- 改名後的鍵與既有元件撞名時，產生 OpenAPI 直接失敗，不覆蓋、不自動加後綴（`create_app` 不呼叫 `app.openapi()`，所以不會讓啟動失敗；失敗的是匯出指令（非零結束、不寫檔）與第一次請求 `/openapi.json`，CI 的 drift 檢查會攔下）。
- 元件名決定 Orval 產生的 TypeScript 型別名，被前端使用之後改名屬 A10 的破壞性變更。
- 撞名（兩個模組有同名的資料類別）時 FastAPI 會在元件名加模組路徑；之後的 change 應以資料類別命名避開，而不是接受加長的名字。

錯誤回應在 OpenAPI 的宣告：

- `/api/v1` 的 router 對每個端點預設宣告 `404`、`405`、`406`、`500` 回應為 `ErrorResponse`；端點專屬的錯誤（本次 `getHealth` 的 `503`）在端點上另外宣告。
- 有參數或 body 的端點，FastAPI 預設產生的 `422` 是 `HTTPValidationError`，與實際回應不符。骨架改寫成 `ErrorResponse`，並且不在 `components.schemas` 留下 `HTTPValidationError` 與 `ValidationError`。
- 所有 schema 欄位名是 camelCase（alias），#504 驗收第 6 項據此掃 `openapi.json`。

`openapi.json` 的位置（clarification Q8、N2）：

- 匯出指令 `cd backend && uv run python -m app.scripts.export_openapi`，預設寫到 `backend/openapi.json`，提交進 repo。
- 輸出 `sort_keys`、縮排 2、結尾換行，讓 drift 比對穩定。
- #505 的 Orval 以這個路徑為輸入；A5 要求本契約、`openapi.json` 與前端產物同一個 commit，前端產物從 #505 開始才有。

## getHealth

- **Method / Path**：`GET /api/v1/health`
- **角色**：刻意公開，不需登入，不檢查系統角色或任務成員身分。認證上線後也維持公開，由 01-01 登入在 S10 矩陣列為刻意的例外（clarification Q4）。
- **用途**：證明一條請求走完 `/api/v1` → 中介層 → router → service → repository → 資料庫 → 外層（Epic #502 §需求目標）；#505 的健康檢查頁依它的四種狀態顯示。
- **envelope 例外**：否，包外層。
- **回應形狀**：有明確的回應模型（handler 回傳型別註記 `ApiResponse[HealthData]`，不傳 `response_model=`；operationId 也從這個註記判斷動詞，見 `system-design.md` §關鍵設計細節「operationId」），放進 `openapi.json`，不採 A2「健康檢查不必建回應模型」的例外（clarification 結論，待決 10、需求矛盾 2）。

### Request

| 位置   | 欄位               | 型別   | 必填 | 驗證                                                       |
| :----- | :----------------- | :----- | :--- | :--------------------------------------------------------- |
| header | `Accept-Language`  | string | 否   | 見 [§請求與回應標頭](#請求與回應標頭)；全部被拒回 `406`    |
| header | `X-Correlation-ID` | string | 否   | 符合 `^[A-Za-z0-9-]{8,64}$` 才沿用，否則改用伺服器產生的值 |

- path 參數：無。
- query 參數：無。依 A2 的 query 政策，沒有宣告的 query 參數一律忽略，不回 `422`。
- body：無。`GET` 帶 body 時忽略。
- 範例：`GET /api/v1/health`，`Accept-Language: en`

### Response

`200`，外層的 `code` 為 `"OK"`，`data` 為 `HealthData`（元件名 `HealthData`，外層 `HealthDataResponse`）。兩個欄位共用具名元件 `HealthStatus`（`type: string`、`enum: ["ok"]`），各自以 `$ref: #/components/schemas/HealthStatus` 參照，不是各自內嵌的字串 enum：

| 欄位       | JSON 型別      | nullable | 說明                                                                                          |
| :--------- | :------------- | :------- | :-------------------------------------------------------------------------------------------- |
| `status`   | `HealthStatus` | 否       | 服務本身可以處理請求                                                                          |
| `database` | `HealthStatus` | 否       | 資料庫可以連線（實際執行一次 `SELECT 1`，clarification Q3）；連不上時不會是 `200`，而是 `503` |

- 兩個欄位目前只有一個值，是為了讓前端與之後的擴充有穩定的形狀；之後要加 `"degraded"` 之類的值屬 A10 的破壞性變更（enum 擴充會改變產生的 TypeScript 型別）。
- `HealthStatus` 是後端 `app/modules/health/schemas.py` 的 `StrEnum`（唯一成員 `OK = "ok"`），兩個欄位共用；Orval 因此產生一個具名的 enum 型別 `HealthStatus`，前端以它判斷兩個欄位（維護者 2026-11-20 裁定）。不用 `Literal["ok"]`：pydantic 2.14 對它輸出 `const` 而不是 `enum`。`HealthStatus` 改名或加值都屬 A10 的破壞性變更。
- **不回傳**資料庫的類型（SQLite 或 PostgreSQL）、版本、主機名、連線字串、應用版號：這是公開端點，這些資訊只對攻擊者有用。
- 範例（`Accept-Language: en`）：

```json
{
  "success": true,
  "code": "OK",
  "message": "Success",
  "data": { "status": "ok", "database": "ok" },
  "timestamp": "2026-11-20T08:15:30.123Z",
  "traceId": "3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01"
}
```

### 欄位遮蔽

| 欄位 | 誰看不到 | 遮蔽後的值 |
| :--- | :------- | :--------- |
| 無   | —        | —          |

所有呼叫端拿到相同內容，沒有依角色遮蔽的欄位。

### 測試集答案隔離

無。這個端點不讀任務、資料集或答案，回應裡沒有標準答案或測試集辨識資訊；錯誤回應也不含例外訊息或資料庫錯誤內容。

### 錯誤

| HTTP  | `code`                 | 觸發條件                                                                                                                                                                      |
| :---- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401` | —                      | 不適用：公開端點                                                                                                                                                              |
| `403` | —                      | 不適用：公開端點                                                                                                                                                              |
| `404` | —                      | OpenAPI 裡會出現：由 `/api/v1` 父 router 的預設回應宣告（見 [§OpenAPI 元件命名與 `openapi.json`](#openapi-元件命名與-openapijson)）。實際上不會觸發：路徑固定、沒有資源識別碼 |
| `405` | `METHOD_NOT_ALLOWED`   | 用 `GET` 以外的 method 呼叫（`HEAD` 依 FastAPI 預設不自動支援，同樣回 `405`）                                                                                                 |
| `406` | `NOT_ACCEPTABLE`       | `Accept-Language` 全部被拒（clarification Q2）                                                                                                                                |
| `422` | —                      | 不適用：沒有任何被驗證的輸入                                                                                                                                                  |
| `500` | `INTERNAL_ERROR`       | 未處理的例外；`message` 為通用訊息，不含堆疊或例外內容                                                                                                                        |
| `503` | `DATABASE_UNAVAILABLE` | 資料庫連不上或逾時（PostgreSQL 連線逾時 5 秒）；`data` 為 `null`，`message` 不含驅動錯誤或連線字串（clarification Q3）                                                        |

## 新發現的待決問題

`system-design.md` §技術待決問題 的 N1–N6 都已處理：N2、N3、N4 由 clarification Q8 決議（具體規則見 [§OpenAPI 元件命名與 `openapi.json`](#openapi-元件命名與-openapijson) 與 `system-design.md` §關鍵設計細節「測試」）；N1、N5、N6 依 `clarification.md` §不需維護者決定的結論 定案。撰寫契約時新發現的 N7–N10 也都已處理：

| #   | 問題                                                                                                                                                                                                                 | 影響                                                                          | 結論                                                                                                                                                                                               |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N7  | `AGENTS.md` §Language Rules 第一列把「API contracts」列為 English only，但同表的 `openspec/` 列要求 artifact 用繁體中文，`api-contract.md` 的 schema 範本與 `sd` 角色定義也是中文。兩列對 `api-contract.md` 說法相反 | 本文與之後每份 `api-contract.md` 用哪種語言；`design-reviewer` 會不會判為違規 | 已決（clarification Q9）：`api-contract.md` 的敘述用繁體中文；「API contracts」指機器契約（`openapi.json`、schema 與識別字），維持英文。`AGENTS.md` 的措辭由 #516 修正，本 change 不改 `AGENTS.md` |
| N8  | schema 範本 `templates/api-contract.md` 的錯誤表把 `400` 寫成「欄位驗證失敗」、`422` 寫成「語意上無法處理的輸入」，與 api-agent-rules A7（`422` 是 schema 驗證失敗、`400` 是語意或應用規則錯誤）相反                 | 之後每份契約照範本抄會寫出與 A7 相反的狀態碼；前端分流會錯                    | 已定（clarification 結論）：本文依 A7，本 change 不改範本；範本由 #517 修正                                                                                                                        |
| N9  | 外層 `message` 的 zh-TW 與 en 實際字串屬使用者看得到的文案，目前沒有來源可依                                                                                                                                         | `app/i18n/<lang>/messages.json` 的內容；#505 健康檢查頁顯示的字               | 已決（clarification Q2）：文案先用 [§錯誤碼](#錯誤碼) 表列的字串                                                                                                                                   |
| N10 | 回應是否帶 `Content-Language` 標頭標出 `message` 實際使用的語言？A8 沒有要求                                                                                                                                         | 測試斷言語言的方式；前端是否需要知道後端用了哪個語言                          | 已決（clarification Q2）：帶，值為實際使用的語言（`zh-TW` 或 `en`）                                                                                                                                |
