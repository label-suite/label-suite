# API Contract

**本次無後端 API 變更**：不新增、不修改任何端點，`backend/` 與 `backend/openapi.json` 都不動。前端只消費既有的契約——`backend/openapi.json`（實作真相）與 `openspec/changes/archive/2026-11-20-backend-skeleton/api-contract.md`（下稱「後端契約」）——本文**不重新定義**外層、錯誤碼、標頭或 `getHealth` 的回應形狀，需要時只引用後端契約的章節。

本文要釘住的是交接的**前端那一側**：健康檢查頁用哪一個 `operationId` 與產生的 hook、畫面每個欄位對到回應的哪個欄位、唯一出口（`apiFetch`）對外承諾的錯誤正規化、MSW 四種狀態的 fixture、以及 Orval 的產生與漂移契約。之後每個前端功能 change 都沿用這幾份約定，改動它們屬 A10 的破壞性變更。

已裁定、照寫不列待決（維護者 2026-11-10、#503 2026-11-20）：路徑前綴 `/api/v1`、成功回應包一層 envelope、外層六欄 `{ success, code, message, data, timestamp, traceId }`、錯誤套同一外層（另帶 `errors`）、JSON 一律 camelCase。

上游待決（system-analysis 的 #1–#16，本文沿用 ui-design 的寫法稱 SA-n；system-design 的 N1–N8；ui-design 的 UI-1–UI-7）**一條都不在這裡決定**。契約內容取決於某一條時，本文寫出各選項下契約長什麼樣子，標「待決 SA-n」。撰寫本文新發現的問題記為 C1–C6，見 [§新發現的待決問題](#新發現的待決問題)。

設計依據：api-agent-rules A4–A10；security-agent-rules S2；ADR-003 D5、D6；ADR-005 D1；testing-agent-rules T6；`system-design.md`、`ui-design.md`。

## 端點總覽

| Method | Path             | operationId | 角色                                | 異動                               |
| :----- | :--------------- | :---------- | :---------------------------------- | :--------------------------------- |
| `GET`  | `/api/v1/health` | `getHealth` | 公開（刻意，後端 clarification Q4） | 無；前端第一次消費（由 #504 新增） |

- `getHealth` 是 `backend/openapi.json` 唯一的操作，operationId 由後端的 `generate_unique_id_function` 算出（後端契約 §端點總覽），前端只引用、不覆寫。Orval 依它命名產物，見 [§產生的識別字](#產生的識別字)。
- envelope 例外：無。本次沒有 `204`、檔案或串流端點。`apiFetch` 仍把 `204` 處理成「不丟錯、回 `undefined`」（`system-design.md` §唯一出口的處理順序），那是為之後的端點預留的行為，本次沒有端點會觸發。
- **BREAKING：無。** 後端契約未變。但本文定下的前端側約定（`ApiError` 的形狀與 `kind` 值、`EnvelopeData<T>` 的回傳形狀、產物的路徑與命名）一旦被功能 change 使用，之後改動屬 A10 的破壞性變更，受影響處是每一個 `use*` hook 的 `data`／`error` 型別與每一個依 `kind` 分流的元件。

## getHealth

- **Method / Path**：`GET /api/v1/health`
- **角色**：刻意公開，不需登入，不檢查系統角色或任務成員身分；認證上線後仍公開（後端契約 §getHealth）。本次前端沒有路由守衛（屬 01-01）。權限沒有超出 `docs/specs/00-prd.mdx` §權限矩陣：矩陣裡沒有任何能力被用到。
- **envelope 例外**：否。
- **消費者**：`features/system-health` 的 `HealthStatusPanel`（`system-design.md` §元件清單），經 `pages/dev-health` 掛在 `/dev/health`。路由是否進正式建置見待決 SA-1，與本契約無關。

### Request

`apiFetch` 送出的請求。後端的驗證規則見後端契約 §請求與回應標頭；這裡寫的是**前端送什麼**。

| 位置   | 欄位               | 型別   | 必填 | 前端送的值與規則                                                                                                                                                                       |
| :----- | :----------------- | :----- | :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| header | `Accept-Language`  | string | 否   | 一律送，值來自 `getRequestLocale()`：待決 SA-6 選 A 時是 i18next 目前語言、B 時固定 `zh-TW`、C 時由 `navigator.languages` 組 q 值。只有 C 可能讓後端回 `406`（瀏覽器語言全部不支援時） |
| header | `X-Correlation-ID` | string | 否   | **不送**，由後端產生（`system-design.md` §唯一出口的處理順序 第 2 步）。所以連不到後端時前端沒有追蹤編號                                                                               |
| header | `Content-Type`     | string | 否   | **不送**：`GET` 沒有 body，送了會觸發 preflight（A6 摺疊區塊）                                                                                                                         |
| —      | `credentials`      | —      | —    | `'include'`，只由 `apiFetch` 設（A6、S2）                                                                                                                                              |
| —      | `signal`           | —      | —    | TanStack Query 傳入的 signal 與逾時計時器合成；逾時值見待決 SA-5，`system-design.md` 的候選 15 秒／30 秒都大於後端的 10 秒總上限                                                       |

- path、query、body：無。
- 網址：`readApiConfig().baseUrl` 加產物給的 `url`（`/api/v1/health`，已含前綴）。`VITE_API_BASE_URL` 開發時是 `http://localhost:8000`、正式環境留空走同源（`system-design.md` §本機開發的跨來源）；它會被打包進前端，**不是祕密**。

### Response

`200`，`data` 是 `HealthData`（後端契約 §getHealth §Response，不在此重抄）：

| 欄位       | 型別（產生的 TS）               | nullable | 說明                           |
| :--------- | :------------------------------ | :------- | :----------------------------- |
| `status`   | `HealthStatus`（目前只有 `ok`） | 否       | 服務可處理請求                 |
| `database` | `HealthStatus`                  | 否       | 資料庫可連線；連不上時是 `503` |

外層的 `code`（`"OK"`）、`message`、`timestamp`、`traceId` 在 `apiFetch` 拆掉外層之後**呼叫端拿不拿得到**取決於待決 SA-2，見 [§唯一出口的回傳形狀](#唯一出口的回傳形狀)。

### 畫面欄位對應

對到 `ui-design.md` §資料來源 的表。「來源」寫的是畫面讀到的前端值，以及它來自回應的哪個欄位。

| 狀態           | 畫面欄位     | 前端值                                                               | 回應來源                                                                                                               | 依賴的待決          |
| :------------- | :----------- | :------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :------------------ |
| 正常           | 服務         | `HealthData.status`                                                  | 成功外層 `data.status`                                                                                                 | —                   |
| 正常           | 資料庫       | `HealthData.database`                                                | 成功外層 `data.database`                                                                                               | —                   |
| 正常           | 檢查時間     | 選項見右欄，經 `formatDateTime`（`src/lib/date.ts`）                 | SA-2 選 B／C：外層 `timestamp`；選 A：TanStack Query 的 `dataUpdatedAt`（瀏覽器時間，不是回應欄位）                    | SA-2、UI-3（格式）  |
| 正常           | traceId      | 選項見右欄                                                           | SA-2 選 B／C：外層 `traceId`；ui-design 的 SA-2 選項 B：回應標頭 `X-Correlation-ID`（見 C2）；選 A：沒有，這一列要拿掉 | SA-2                |
| 資料庫無法連線 | 標題下的說明 | `ApiError.message`                                                   | 錯誤外層 `message`（後端已本地化，原樣顯示，A8）                                                                       | SA-6（語言）、SA-12 |
| 資料庫無法連線 | 錯誤碼       | `ApiError.code`（`"DATABASE_UNAVAILABLE"`）                          | 錯誤外層 `code`                                                                                                        | SA-12               |
| 資料庫無法連線 | traceId      | `ApiError.traceId`                                                   | 錯誤外層 `traceId`                                                                                                     | SA-12               |
| 連不到後端     | 錯誤類型     | `ApiError.kind`（`network` 或 `timeout`）                            | 無回應；由 `apiFetch` 判定                                                                                             | C5                  |
| 連不到後端     | traceId      | `ApiError.traceId` 為 `null`，畫面顯示固定文字「無（請求沒有送達）」 | 無回應                                                                                                                 | —                   |
| 其他錯誤       | 未定         | `ApiError` 的 `kind`、`status`、`code`、`message`、`traceId` 都可用  | `404`、`405`、`406`、`500` 的錯誤外層，或非外層的回應                                                                  | SA-3                |
| 載入中         | —            | `isFetching`                                                         | —                                                                                                                      | SA-4、SA-5、UI-7    |

狀態判定是 `toHealthViewState` 的事（`system-design.md` §元件清單），判定的**輸入契約**是：

- `ApiError` 且 `code === "DATABASE_UNAVAILABLE"` → 資料庫無法連線。**依 `code`，不依 `status`**（A7 不得用字串猜 status；`503` 之後可能有別的錯誤碼）。
- `ApiError` 且 `kind` 是 `network` 或 `timeout` → 連不到後端。
- 其餘 `ApiError`（`kind: "http"` 的其他碼、`kind: "invalidResponse"`）→ 待決 SA-3。
- `kind: "aborted"` 不會到達畫面（TanStack Query 自己處理取消）。

### 欄位遮蔽

| 欄位 | 誰看不到 | 遮蔽後的值 |
| :--- | :------- | :--------- |
| 無   | —        | —          |

所有呼叫端拿到相同內容。開發用頁面顯示 `code`、`traceId`、設定名稱 `VITE_API_BASE_URL` 算不算 07-01「不出現系統內部資料」的例外，是畫面露出範圍的問題，不是後端遮蔽，見待決 SA-12。

### 測試集答案隔離

無。端點不讀任務、資料集或答案；MSW fixture 只含健康檢查的外層，不含任何答案或真實身分（T6、Hard Rule 6）。標記員也到不了開發用頁面。延續到後續的風險：Orval 會依 `openapi.json` 裡**每一個**回應 schema 產生 MSW 假資料，所以「標記員可達的回應不含答案」要靠後端 S5 讓那些 schema 本來就沒有答案欄位（`system-design.md` §權限檢查點）。

### 錯誤

`openapi.json` 為 `getHealth` 宣告的錯誤回應都是 `ErrorResponse`。觸發條件以後端契約 §getHealth §錯誤 為準；這裡加上前端會轉成的 `ApiError`。

| HTTP  | `code`                 | 觸發條件（摘自後端契約）                                                      | 前端的 `ApiError`                                           | 健康檢查頁     |
| :---- | :--------------------- | :---------------------------------------------------------------------------- | :---------------------------------------------------------- | :------------- |
| `401` | —                      | 不適用：公開端點                                                              | —                                                           | —              |
| `403` | —                      | 不適用：公開端點                                                              | —                                                           | —              |
| `404` | `NOT_FOUND`            | 實際上不會觸發（路徑固定）；`baseUrl` 指到別的 FastAPI 才可能                 | `kind: "http"`、`status: 404`                               | 待決 SA-3      |
| `405` | `METHOD_NOT_ALLOWED`   | 非 `GET`；產物固定用 `GET`，正常不會觸發                                      | `kind: "http"`、`status: 405`                               | 待決 SA-3      |
| `406` | `NOT_ACCEPTABLE`       | `Accept-Language` 全部被拒；只有 SA-6 選 C 才可能                             | `kind: "http"`、`status: 406`                               | 待決 SA-3      |
| `422` | —                      | 不適用：沒有被驗證的輸入                                                      | —                                                           | —              |
| `500` | `INTERNAL_ERROR`       | 未處理的例外                                                                  | `kind: "http"`、`status: 500`                               | 待決 SA-3      |
| `503` | `DATABASE_UNAVAILABLE` | 資料庫連不上或逾時（PostgreSQL 5 秒）                                         | `kind: "http"`、`status: 503`、`code`、`message`、`traceId` | 資料庫無法連線 |
| —     | —                      | 連線被拒、DNS 失敗、CORS 被擋                                                 | `kind: "network"`                                           | 連不到後端     |
| —     | —                      | 超過前端逾時（值見待決 SA-5）                                                 | `kind: "timeout"`                                           | 連不到後端     |
| 任意  | —                      | 回應不是外層（代理回 HTML、Vite 開發伺服器回 `index.html` 加 `200`、空 body） | `kind: "invalidResponse"`、`status` 照實                    | 待決 SA-3      |

- CORS 被擋在瀏覽器看起來就是 `fetch` 拒絕，與連線被拒無法區分，所以同樣是 `network`。後端 `CORS_ALLOWED_ORIGINS` 沒列 `http://localhost:5173` 時，健康檢查頁會顯示「連不到後端」；這是 `acceptance.md` 人工步驟要提醒的設定，由 #506 寫進 `.env.example`。
- 錯誤訊息不含內部識別碼或堆疊：`kind: "http"` 的 `message` 來自後端，後端契約已保證不含；其他 kind 的 `message` 是 `apiFetch` 自己合成的英文診斷字串（A7 例外），**不得**放入原生錯誤的 `message`、堆疊或回應 body 原文。

## 唯一出口的回傳形狀

`apiFetch` 是 Orval 的 mutator（`override.mutator` 指向 `src/api/mutator.ts` 的 `apiFetch`），產生的函式寫成 `apiFetch<HealthDataResponse>(...)`。它的回傳形狀決定**每一個**產生 hook 的 `data` 型別，選項由待決 SA-2 決定（`system-design.md` §回傳形狀）：

| SA-2 選項                          | `apiFetch<T>` 的回傳型別                        | `useGetHealth().data`                      | 外層的 `code`、`message`、`timestamp`、`traceId` |
| :--------------------------------- | :---------------------------------------------- | :----------------------------------------- | :----------------------------------------------- |
| A 只回 `data`                      | `EnvelopeData<T>`                               | `HealthData`                               | 呼叫端拿不到                                     |
| B 回 `{ data, meta }`              | `{ data: EnvelopeData<T>; meta: ResponseMeta }` | `{ data: HealthData; meta: ResponseMeta }` | 在 `meta`                                        |
| C 只回 `data`，`meta` 走另一條通道 | `EnvelopeData<T>`                               | `HealthData`                               | 經另一條通道，只有需要的頁面去拿                 |

選 B 時 `ResponseMeta` 的欄位就是成功外層除了 `success`、`data` 以外的四欄，名稱與型別照 `openapi.json` 的 `HealthDataResponse`（`code: string`、`message: string`、`timestamp: string`、`traceId: string`），不另取名字。不論哪個選項，`success` 都不交給呼叫端（成功時恆為 `true`，失敗時已轉成 `ApiError`）。

型別能不能穿過產物依 N3：產物的請求函式不能有 Orval 加上的明確回傳型別註記，apply 第一組以實際版本確認。

## 錯誤正規化契約

`apiFetch` 對外承諾：**任何**失敗都以 `ApiError` 拋出，元件與 hook 永遠拿不到原生 `TypeError`、`DOMException`、`Response` 或 `unknown`。`mutator.ts` 匯出 `ErrorType<E> = ApiError`，所以 Orval 產生的 `GetHealthQueryError` 等錯誤型別都是 `ApiError`，不是 `ErrorResponse`。

### `ApiError` 的欄位

| 欄位          | TS 型別                 | 何時有值                           | 來源                                                                   | 能不能上畫面                                                                                                               |
| :------------ | :---------------------- | :--------------------------------- | :--------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| `kind`        | `ApiErrorKind`          | 一律                               | `apiFetch` 判定                                                        | 開發用頁面可以（「錯誤類型」）；業務頁的露出見 SA-12                                                                       |
| `status`      | `number \| null`        | `http`、`invalidResponse`          | HTTP 狀態碼                                                            | 只用來分流，不直接顯示                                                                                                     |
| `code`        | `string \| null`        | `http`                             | 錯誤外層 `code`                                                        | 開發用頁面可以；業務頁見 SA-12                                                                                             |
| `message`     | `string`                | 一律                               | `http`：錯誤外層 `message`（已本地化）；其他：英文診斷字串             | `http` 的可以原樣顯示（A8）；其他 kind 的**不上畫面**，畫面用自己的 UI 字串                                                |
| `traceId`     | `string \| null`        | `http`；`invalidResponse` 有標頭時 | `http`：錯誤外層 `traceId`；`invalidResponse`：`X-Correlation-ID` 標頭 | 可以；A7 規定 `5xx` 顯示通用錯誤並附 correlation id                                                                        |
| `fieldErrors` | `ErrorDetail[] \| null` | `http` 且 `status === 422`         | 錯誤外層 `errors`，型別是產物的 `ErrorDetail`                          | 逐欄位顯示時以 `code` 對照 UI 字串，`message` 只是備援（後端契約 §ErrorDetail）；不得 `JSON.stringify` 貼到畫面（A7 反例） |

- `ErrorDetail` 直接用產物的型別，不另寫 DTO（A6 禁止）。
- 錯誤外層的 `timestamp` 不進 `ApiError`：本次沒有畫面需要，加欄位屬非破壞性變更，之後需要再加。
- `ApiError` 不保留原始 `Response` 或 `cause` 給畫面讀；若為除錯保留 `cause`，它不在對外契約內，元件不得讀它。

### `ApiErrorKind`

| 值                | 意義                                                        | 重試（`shouldRetry`）           |
| :---------------- | :---------------------------------------------------------- | :------------------------------ |
| `http`            | 收到錯誤外層（非 `2xx` 且 `isErrorEnvelope` 成立）          | 認證錯誤不重試；其他依待決 SA-4 |
| `network`         | `fetch` 拒絕，且不是 abort                                  | 依待決 SA-4                     |
| `timeout`         | 本層的逾時計時器 abort                                      | 依待決 SA-4                     |
| `invalidResponse` | 回應不是外層：非 JSON、空 body、JSON 但形狀不符（含 `2xx`） | 依待決 SA-4                     |
| `aborted`         | 呼叫端（TanStack Query）取消                                | 不重試                          |

`isAuthError` 涵蓋 `401` 還是 `401` 加 `403` 見待決 SA-4；本次沒有端點會回這兩個碼。

### 外層的判定規則

`isSuccessEnvelope`、`isErrorEnvelope` 把 body 當 `unknown` 收窄，欄位以 `openapi.json` 的 `required` 為準：

| guard               | 成立條件                                                                                                                                     |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `isSuccessEnvelope` | 物件；`success === true`；`code`、`message`、`timestamp`、`traceId` 是 string；有 `data` 鍵                                                  |
| `isErrorEnvelope`   | 物件；`success === false`；`code`、`message`、`timestamp`、`traceId` 是 string；`data === null`；`errors` 是陣列或 `null`（缺鍵怎麼算見 C4） |

`data` 裡那一層不在執行期驗證，以型別信任產物（執行期 schema 驗證不在本次範圍）。`2xx` 但 `isSuccessEnvelope` 不成立時是 `invalidResponse`，不是成功。

## MSW 四種狀態的 fixture

測試用 `msw/node` 的 `setupServer`（`src/test/msw-server.ts`），`onUnhandledRequest: "error"`。四種狀態的回應**只用 `openapi.json` 裡有的欄位**，不加任何欄位；值取自後端契約的範例與錯誤碼表。fixture 由 `src/test/envelope-fixtures.ts` 組成，回傳型別是產物的 `HealthDataResponse`／`ErrorResponse`，欄位改名時測試在型別檢查就失敗。Orval 產生的預設 handler 不能直接當成「正常」狀態，理由見 C1。

| 狀態           | handler 行為                                                             | status | body                   |
| :------------- | :----------------------------------------------------------------------- | :----- | :--------------------- |
| 載入中         | 延遲回應（`await delay("infinite")` 或測試控制的 promise），之後不必回應 | —      | —                      |
| 正常           | `HttpResponse.json(body, { status: 200 })`                               | `200`  | 下方「正常」           |
| 資料庫無法連線 | `HttpResponse.json(body, { status: 503 })`                               | `503`  | 下方「資料庫無法連線」 |
| 連不到後端     | `HttpResponse.error()`（`fetch` 拒絕）                                   | —      | —                      |

正常（`HealthDataResponse`；`message` 依 `Accept-Language`，此例 `zh-TW`）：

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

資料庫無法連線（`ErrorResponse`）：

```json
{
  "success": false,
  "code": "DATABASE_UNAVAILABLE",
  "message": "資料庫暫時無法連線，請稍後再試",
  "data": null,
  "timestamp": "2026-11-20T08:15:35.456Z",
  "traceId": "9c1d7e2a-4b3f-4a8e-8d6c-0f5e2a1b3c47",
  "errors": null
}
```

`errors` 必須帶、值為 `null`：`openapi.json` 把它列在 `ErrorResponse` 的 `required`，後端契約也說非 `422` 時為 `null`。少了它 `ErrorResponse` 型別不成立。

- 「連不到後端」的逾時路徑以假時鐘推進驗證，不在 MSW 層模擬（`system-design.md` §測試 `mutator.test.ts`）。
- `X-Correlation-ID`、`Content-Language` 回應標頭要不要加進 fixture 見 C2。
- `traceId` 是固定的 UUID4 字串、`timestamp` 是固定的 UTC 毫秒字串，不用 faker 產生，讓斷言與快照穩定。
- 待決 SA-3 若決定要處理其他錯誤，fixture 照同樣方式加，`code` 與 `message` 取自後端契約 §錯誤碼 的表，不自創。
- 待決 SA-7 選 B（開發時也能切到替身）時，瀏覽器端沿用同一組 fixture，不另寫一份。

## Orval 產生契約

### 輸入與輸出

| 項目   | 值                                                                                                    | 依據                                            |
| :----- | :---------------------------------------------------------------------------------------------------- | :---------------------------------------------- |
| 設定檔 | `frontend/orval.config.ts`，唯一的一份                                                                | A5、`system-design.md`                          |
| 輸入   | `../backend/openapi.json`（相對 `frontend/`）；只讀已提交的檔案，前端不改它                           | A4、後端契約 §OpenAPI 元件命名與 `openapi.json` |
| 輸出   | `frontend/src/api/generated/`，整個資料夾由 Orval 擁有，`clean: true`                                 | A4、ADR-003 D6                                  |
| client | `react-query`；`override.mutator` → `src/api/mutator.ts` 的 `apiFetch`；`override.query.signal: true` | A6、A9                                          |
| mock   | MSW handlers 與 response mock，只被測試 import（lint 擋產品碼）                                       | T6                                              |
| 格式化 | 待決 SA-9（排除 Prettier，或產出後用同版 Prettier 格式化）                                            | A4、A5                                          |
| 指令   | `pnpm api:generate`；是否先跑後端匯出見待決 SA-10；從哪個目錄跑見待決 SA-8                            | A5                                              |

產物檔案在資料夾內怎麼分（Orval 的 `mode`）是實作細節，不在契約內；契約只承諾下表的匯出名稱，從 `src/api/generated/` 底下 import。

### 產生的識別字

依 operationId `getHealth` 與元件名，Orval 預期產出（以 apply 時的實際版本為準；與下表不同時先回來改本文，A4）：

| 種類          | 名稱                                                                               | 用在                                                        |
| :------------ | :--------------------------------------------------------------------------------- | :---------------------------------------------------------- |
| 查詢 hook     | `useGetHealth`                                                                     | `HealthStatusPanel`                                         |
| 請求函式      | `getHealth`                                                                        | `useGetHealth` 的 `queryFn`；元件不直接呼叫                 |
| query key     | `getGetHealthQueryKey`                                                             | 唯一的 key 來源（A9）；「重新檢查」用 `refetch()`、不換 key |
| query options | `getGetHealthQueryOptions`                                                         | 之後需要 prefetch 時用                                      |
| 錯誤型別別名  | `GetHealthQueryError`（＝`ErrorType<ErrorResponse>`＝`ApiError`）                  | 元件的 `error` 型別                                         |
| MSW           | `getGetHealthMockHandler`、`getGetHealthResponseMock`                              | `src/test/` 與測試；產品碼不得 import                       |
| 型別          | `HealthData`、`HealthDataResponse`、`HealthStatus`、`ErrorResponse`、`ErrorDetail` | fixture、`apiFetch` 的泛型、`ApiError.fieldErrors`          |

- 沒有 `servers` 欄位，產物的 `url` 是 `/api/v1/health`，base URL 只由 `apiFetch` 加（A6）。
- `openapi.json` 沒有宣告請求標頭參數，所以 `getHealth` 沒有 header 參數；`Accept-Language` 一律由 `apiFetch` 加，元件不組標頭（A6）。

### 什麼算漂移

在 `frontend/` 執行 `pnpm api:generate` 之後，以下任一情況就是漂移，檢查失敗：

1. `git diff --exit-code -- src/api/generated` 有差異：已提交的產物與輸入重產的結果不同（手改、格式化過、或後端改了契約卻沒重產）。
2. `git status --porcelain -- src/api/generated` 有輸出：多出未追蹤或已刪除的檔案（手加檔案也算手改，A4；`clean: true` 讓舊檔不殘留）。
3. 待決 SA-10 選 B 時，`backend/openapi.json` 在重新匯出後也有差異（後端那一側的漂移，與後端既有的契約漂移指令同一件事）。

不算漂移的：`orval.config.ts`、`mutator.ts` 等手寫檔的變動（它們會讓產物變，但變動本身受 lint、型別檢查與審查管）。產物不受 lint、不進覆蓋率分母（F2 例外、T10）。本次只提供這條指令並補進 `openspec/config.yaml`；CI 執行它屬 #506。A5 要求契約、`openapi.json` 與產物同一個 commit：本次 `openapi.json` 不變，所以只要產物與手寫碼同一個 commit。

## 新發現的待決問題

上游待決 SA-1–SA-16、N1–N8、UI-1–UI-7 照原狀態延續，本文沒有替任何一條做決定；契約依賴的幾條（SA-2、SA-3、SA-4、SA-5、SA-6、SA-7、SA-8、SA-9、SA-10、SA-12、N3）已在上面各節寫出各選項下的契約。以下是撰寫本文時新發現的：

| #   | 問題                                                                                                                                                                                                                                                                                                                                | 影響                                                                                                                    | 選項                                                                                                                                                                                                                                                       | 狀態 |
| :-- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| C1  | `openapi.json` 對外層的 `success` 只宣告 `type: boolean`、`code` 只宣告 `type: string`，沒有 `const` 或 `enum`，也沒有任何 `example`。Orval 依 schema 用 faker 產 mock，產生的「`200`」handler 會隨機給 `success`（可能是 `false`）與隨機 `code`，`isSuccessEnvelope` 會把它判成 `invalidResponse`；`traceId`、`message` 也每次不同 | 產生的預設 handler 不能直接代表「正常」狀態；測試若沒覆寫會隨機失敗；之後所有端點的產生 mock 都有同樣問題               | A 前端一律覆寫：測試用 `getGetHealthMockHandler(override)` 或 `server.use` 帶固定 fixture（本文的寫法），預設 handler 只當「有攔到請求」的底線／B 後端在外層 schema 加 `const`（`success`）與 `examples`，屬後端 change，另開 issue，不在本次改 `backend/` | 待決 |
| C2  | 後端契約說**每一個**回應都帶 `X-Correlation-ID`（有 `message` 的還帶 `Content-Language`），但 `openapi.json` 沒有宣告任何回應標頭。MSW fixture「只用 `openapi.json` 有的欄位」時就不該帶標頭，與真實後端不同                                                                                                                        | `invalidResponse` 讀標頭補 `traceId` 的測試；SA-2 若選「從標頭讀 traceId」時 fixture 必須帶；Orval 產物看不到這兩個標頭 | A fixture 照後端契約帶 `X-Correlation-ID`（值與 body 的 `traceId` 相同）與 `Content-Language`，視後端契約為標頭的依據／B 只照 `openapi.json`，不帶標頭／C 後端在 OpenAPI 宣告回應標頭（後端 change，另開 issue），之後 fixture 依它                        | 待決 |
| C3  | Orval 預設只為成功回應產 mock；`503` 的 `ErrorResponse` mock 要嘛由 `envelope-fixtures.ts` 手組（以產物型別約束），要嘛開 Orval 的「每個 status 都產 mock」選項（名稱依版本，例如 `generateEachHttpStatus`），產出 `getGetHealthResponseMock503` 等                                                                                 | `envelope-fixtures.ts` 要不要存在；fixture 的值是固定字串還是 faker；產物體積                                           | A 手組 fixture，型別取自產物（`system-design.md` 的寫法）／B 開 Orval 的逐 status mock，再以 override 固定值（仍受 C1 影響）                                                                                                                               | 待決 |
| C4  | `isErrorEnvelope` 要不要要求 `errors` 鍵存在？`openapi.json` 列為 `required`，但若有代理或舊版後端漏掉它，嚴格判定會把真正的錯誤外層轉成 `invalidResponse`，畫面就拿不到 `code` 與 `traceId`                                                                                                                                        | `DATABASE_UNAVAILABLE` 能不能被認出來；guard 的測試格數                                                                 | A 嚴格：照 `required`，缺鍵就是 `invalidResponse`／B 寬鬆：`errors` 缺鍵視同 `null`，其餘照 `required`                                                                                                                                                     | 待決 |
| C5  | 連不到後端時「錯誤類型」顯示 `ApiError.kind`。artifact 只畫了 `network`；逾時時這一列會是 `timeout`，畫面文字「沒有收到任何回應」仍適用，但核可畫面沒畫這個值                                                                                                                                                                       | 〔連不到後端〕的顯示值；`ui-design.md` 的欄位對應                                                                       | A 原樣顯示 `kind`（`network` 或 `timeout`）／B 一律顯示 `network`，`timeout` 只進測試                                                                                                                                                                      | 待決 |
| C6  | `ApiError` 要不要帶錯誤外層的 `timestamp`？本文的契約不帶（目前沒有畫面需要）；但 SA-2 若選 B／C 讓成功時拿得到 `timestamp`，成功與失敗兩邊的「伺服器時間」就不對稱，資料庫無法連線的畫面若之後要顯示檢查時間會拿不到                                                                                                               | `ApiError` 的欄位（之後再加不是破壞性變更，但會再改一次測試）；與 SA-2 一起決定比較省事                                 | A 不帶（本文的寫法）／B 帶 `timestamp: string \| null`                                                                                                                                                                                                     | 待決 |

C1 到 C3 都是後端契約對前端的缺口，依指示**不改 `backend/`**：若選 B／C 要後端配合，另開 issue 處理。
