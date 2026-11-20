# API Contract

**本次無後端 API 變更**：不新增、不修改任何端點，`backend/` 與 `backend/openapi.json` 都不動。前端只消費既有的契約——`backend/openapi.json`（實作真相）與 `openspec/changes/archive/2026-11-20-backend-skeleton/api-contract.md`（下稱「後端契約」）——本文**不重新定義**外層、錯誤碼、標頭或 `getHealth` 的回應形狀，需要時只引用後端契約的章節。

本文要釘住的是交接的**前端那一側**：健康檢查頁用哪一個 `operationId` 與產生的 hook、畫面每個欄位對到回應的哪個欄位、唯一出口（`apiFetch`）對外承諾的回傳形狀與錯誤正規化、MSW 四種狀態的 fixture、以及 Orval 的產生與漂移契約。之後每個前端功能 change 都沿用這幾份約定，改動它們屬 A10 的破壞性變更。

已裁定、照寫不列待決（維護者 2026-11-10、#503 2026-11-20）：路徑前綴 `/api/v1`、成功回應包一層 envelope、外層六欄 `{ success, code, message, data, timestamp, traceId }`、錯誤套同一外層（另帶 `errors`）、JSON 一律 camelCase。

上游待決（SA-n、N1–N8、UI-1–UI-7）與本文的 C1–C6 **已由維護者於 2026-11-20 以 clarification Q1–Q19 全部決議**，本文依決議改寫，各項對應見 [§待決問題的處理結果](#待決問題的處理結果)。

設計依據：api-agent-rules A4–A10；security-agent-rules S2；ADR-003 D5、D6；ADR-005 D1；testing-agent-rules T6；`system-design.md`、`ui-design.md`。

## 端點總覽

| Method | Path             | operationId | 角色                                | 異動                               |
| :----- | :--------------- | :---------- | :---------------------------------- | :--------------------------------- |
| `GET`  | `/api/v1/health` | `getHealth` | 公開（刻意，後端 clarification Q4） | 無；前端第一次消費（由 #504 新增） |

- `getHealth` 是 `backend/openapi.json` 唯一的操作，operationId 由後端的 `generate_unique_id_function` 算出（後端契約 §端點總覽），前端只引用、不覆寫。Orval 依它命名產物，見 [§產生的識別字](#產生的識別字)。
- envelope 例外：無。本次沒有 `204`、檔案或串流端點。`apiFetch` 仍把 `204` 處理成「不丟錯、回 `undefined`」（`system-design.md` §唯一出口的處理順序），那是為之後的端點預留的行為，本次沒有端點會觸發。
- **BREAKING：無。** 後端契約未變。但本文定下的前端側約定（`ApiResponse<T>` 的 `{ data, meta }` 形狀、`ApiError` 的形狀與 `kind` 值、產物的路徑與命名）一旦被功能 change 使用，之後改動屬 A10 的破壞性變更，受影響處是每一個 `use*` hook 的 `data`／`error` 型別與每一個依 `kind` 分流的元件。

## getHealth

- **Method / Path**：`GET /api/v1/health`
- **角色**：刻意公開，不需登入，不檢查系統角色或任務成員身分；認證上線後仍公開（後端契約 §getHealth）。本次前端沒有路由守衛（屬 01-01）。權限沒有超出 `docs/specs/00-prd.mdx` §權限矩陣：矩陣裡沒有任何能力被用到。
- **envelope 例外**：否。
- **消費者**：`features/system-health` 的 `HealthStatusPanel`（`system-design.md` §元件清單），經 `pages/dev-health` 掛在 `/dev/health`。路由只在 Vite 開發模式註冊、正式建置剪除（Q1）；正式環境要驗證這個端點時直接打 `/api/v1/health`。

### Request

`apiFetch` 送出的請求。後端的驗證規則見後端契約 §請求與回應標頭；這裡寫的是**前端送什麼**。

| 位置   | 欄位               | 型別   | 必填 | 前端送的值與規則                                                                                                                                                     |
| :----- | :----------------- | :----- | :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| header | `Accept-Language`  | string | 否   | 一律送，值是 `getCurrentLanguage()`：`zh-TW` 或 `en`，與介面語言一致；介面語言由 `navigator.language` 決定（`zh` 開頭為 `zh-TW`，其餘為 `en`），沒有切換控制項（Q5） |
| header | `X-Correlation-ID` | string | 否   | **不送**，由後端產生（`system-design.md` §唯一出口的處理順序 第 2 步）。所以連不到後端時前端沒有追蹤編號                                                             |
| header | `Content-Type`     | string | 否   | **不送**：`GET` 沒有 body，送了會觸發 preflight（A6 摺疊區塊）                                                                                                       |
| —      | `credentials`      | —      | —    | `'include'`，只由 `apiFetch` 設（A6、S2）                                                                                                                            |
| —      | `signal`           | —      | —    | TanStack Query 傳入的 signal 與 15 秒逾時計時器合成（`composeSignals`）；15 秒大於後端的 10 秒總上限（Q4）。不自動重試                                               |

- path、query、body：無。
- 網址：`readApiConfig().baseUrl` 加產物給的 `url`（`/api/v1/health`，已含前綴）。`VITE_API_BASE_URL` 開發時是 `http://localhost:8000`、正式環境留空走同源（`system-design.md` §本機開發的跨來源）；它會被打包進前端，**不是祕密**。
- 兩種語言下後端都只會回支援的語言，`Accept-Language` 只送 `zh-TW` 或 `en`，不會觸發 `406`。

### Response

`200`，`data` 是 `HealthData`（後端契約 §getHealth §Response，不在此重抄）：

| 欄位       | 型別（產生的 TS）               | nullable | 說明                           |
| :--------- | :------------------------------ | :------- | :----------------------------- |
| `status`   | `HealthStatus`（目前只有 `ok`） | 否       | 服務可處理請求                 |
| `database` | `HealthStatus`                  | 否       | 資料庫可連線；連不上時是 `503` |

外層的 `traceId`、`timestamp` 在 `apiFetch` 拆掉外層之後放進 `meta` 交給呼叫端（Q2），見 [§唯一出口的回傳形狀](#唯一出口的回傳形狀)；外層的 `code`、`message` 與 `success` 成功時不交給呼叫端。

### 畫面欄位對應

對到 `ui-design.md` §資料來源 的表。「來源」寫的是畫面讀到的前端值，以及它來自回應的哪個欄位。

| 狀態         | 畫面欄位     | 前端值                                                                                                                                                                                                                           | 回應來源                                                                                                                               |
| :----------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| 正常         | 服務         | `query.data.data.status`                                                                                                                                                                                                         | 成功外層 `data.status`                                                                                                                 |
| 正常         | 資料庫       | `query.data.data.database`                                                                                                                                                                                                       | 成功外層 `data.database`                                                                                                               |
| 正常         | 檢查時間     | `query.data.meta.timestamp`，經 `formatDevCheckTime`（`src/lib/date.ts`，不傳時區參數），換成瀏覽者裝置的時區（`Intl.DateTimeFormat().resolvedOptions().timeZone`）                                                              | 成功外層 `timestamp`（UTC）；開發頁格式 `YYYY-MM-DD HH:mm:ss（UTC±H）`，括號內是裝置的實際偏移，不固定換算 Asia/Taipei（Q18 補充決議） |
| 正常         | traceId      | `query.data.meta.traceId`                                                                                                                                                                                                        | 成功外層 `traceId`                                                                                                                     |
| 後端回報錯誤 | 標題         | `code === "DATABASE_UNAVAILABLE"` 用資料庫無法連線標題，其餘用通用「後端回報錯誤」                                                                                                                                               | 錯誤外層 `code`（依 `code`，不依 `status`，A7）                                                                                        |
| 後端回報錯誤 | 標題下的說明 | `ApiError.message`                                                                                                                                                                                                               | 錯誤外層 `message`（後端已依 `Accept-Language` 本地化，原樣顯示，A8）                                                                  |
| 後端回報錯誤 | 錯誤碼       | `ApiError.code`                                                                                                                                                                                                                  | 錯誤外層 `code`                                                                                                                        |
| 後端回報錯誤 | traceId      | `ApiError.traceId`                                                                                                                                                                                                               | 錯誤外層 `traceId`                                                                                                                     |
| 連不到後端   | 錯誤類型     | `ApiError.kind` 直接顯示 `network` 或 `timeout`（Q3）                                                                                                                                                                            | 無回應；由 `apiFetch` 判定。非外層的回應（`invalidResponse`）顯示 `network`                                                            |
| 連不到後端   | traceId      | `ApiError.traceId` 為 `null`，畫面顯示固定文字「無（請求沒有送達）」                                                                                                                                                             | 無回應                                                                                                                                 |
| 載入中       | —            | `isPending`，或由使用者按「重新檢查」觸發的 `isFetching`；背景更新的 `isFetching` 不顯示載入中（UI-7）。`isFetching` 期間「重新檢查」是 `aria-disabled` 且忽略點擊，所以 `refetch()` 預設的 `cancelRefetch` 不會取消進行中的請求 | —                                                                                                                                      |

四種狀態的判定是 `toHealthViewState` 的事，判定的**輸入契約**是（Q3）：

- 任何 `kind: "http"` 的 `ApiError`（任何錯誤外層：`404`、`405`、`406`、`422`、`500`、`503`…）→ 後端回報錯誤的版面；標題依 `code` 是否為 `DATABASE_UNAVAILABLE` 決定。
- `kind` 是 `network`、`timeout` 的 `ApiError` → 連不到後端，「錯誤類型」列顯示該值。
- `kind: "invalidResponse"`（回應不是外層）→ 連不到後端，「錯誤類型」列顯示 `network`。
- `kind: "aborted"` 不會到達畫面（TanStack Query 自己處理取消）；若仍交到 `toHealthViewState`，它回 `null`（回傳型別 `HealthViewState | null`），`HealthStatusPanel` 保留前一次畫出的狀態。

### 欄位遮蔽

| 欄位 | 誰看不到 | 遮蔽後的值 |
| :--- | :------- | :--------- |
| 無   | —        | —          |

所有呼叫端拿到相同內容。開發用頁面顯示 `code`、`traceId`、設定名稱 `VITE_API_BASE_URL` 是 07-01「不出現系統內部資料」的例外（Q11），不是後端遮蔽；業務頁的錯誤露出由 01-01 依 07-01 設計。

### 測試集答案隔離

無。端點不讀任務、資料集或答案；MSW fixture 只含健康檢查的外層，不含任何答案或真實身分（T6、Hard Rule 6）。標記員也到不了開發用頁面（只在開發模式註冊，Q1）。延續到後續的風險：Orval 會依 `openapi.json` 裡**每一個**回應 schema 產生 MSW 假資料，所以「標記員可達的回應不含答案」要靠後端 S5 讓那些 schema 本來就沒有答案欄位（`system-design.md` §權限檢查點）。

### 錯誤

`openapi.json` 為 `getHealth` 宣告的錯誤回應都是 `ErrorResponse`。觸發條件以後端契約 §getHealth §錯誤 為準；這裡加上前端會轉成的 `ApiError`。

| HTTP  | `code`                 | 觸發條件（摘自後端契約）                                                      | 前端的 `ApiError`                                                        | 健康檢查頁                         |
| :---- | :--------------------- | :---------------------------------------------------------------------------- | :----------------------------------------------------------------------- | :--------------------------------- |
| `401` | —                      | 不適用：公開端點                                                              | —                                                                        | —                                  |
| `403` | —                      | 不適用：公開端點                                                              | —                                                                        | —                                  |
| `404` | `NOT_FOUND`            | 實際上不會觸發（路徑固定）；`baseUrl` 指到別的 FastAPI 才可能                 | `kind: "http"`、`status: 404`                                            | 後端回報錯誤（通用標題）           |
| `405` | `METHOD_NOT_ALLOWED`   | 非 `GET`；產物固定用 `GET`，正常不會觸發                                      | `kind: "http"`、`status: 405`                                            | 後端回報錯誤（通用標題）           |
| `406` | `NOT_ACCEPTABLE`       | `Accept-Language` 全部被拒；前端只送 `zh-TW` 或 `en`，正常不會觸發            | `kind: "http"`、`status: 406`                                            | 後端回報錯誤（通用標題）           |
| `422` | —                      | 不適用：沒有被驗證的輸入                                                      | —                                                                        | —                                  |
| `500` | `INTERNAL_ERROR`       | 未處理的例外                                                                  | `kind: "http"`、`status: 500`                                            | 後端回報錯誤（通用標題）           |
| `503` | `DATABASE_UNAVAILABLE` | 資料庫連不上或逾時（PostgreSQL 5 秒）                                         | `kind: "http"`、`status: 503`、`code`、`message`、`traceId`、`timestamp` | 後端回報錯誤（資料庫無法連線標題） |
| —     | —                      | 連線被拒、DNS 失敗、CORS 被擋                                                 | `kind: "network"`                                                        | 連不到後端（錯誤類型 `network`）   |
| —     | —                      | 超過前端逾時 15 秒                                                            | `kind: "timeout"`                                                        | 連不到後端（錯誤類型 `timeout`）   |
| 任意  | —                      | 回應不是外層（代理回 HTML、Vite 開發伺服器回 `index.html` 加 `200`、空 body） | `kind: "invalidResponse"`、`status` 照實                                 | 連不到後端（錯誤類型 `network`）   |

- CORS 被擋在瀏覽器看起來就是 `fetch` 拒絕，與連線被拒無法區分，所以同樣是 `network`。後端 `CORS_ALLOWED_ORIGINS` 沒列 `http://localhost:5173` 時，健康檢查頁會顯示「連不到後端」；這是 `acceptance.md` 人工步驟要提醒的設定，由 #506 寫進 `.env.example`。
- 錯誤訊息不含內部識別碼或堆疊：`kind: "http"` 的 `message` 來自後端，後端契約已保證不含；其他 kind 的 `message` 是 `apiFetch` 自己合成的英文診斷字串（A7 例外），**不得**放入原生錯誤的 `message`、堆疊或回應 body 原文，也不上畫面。

## 唯一出口的回傳形狀

`apiFetch` 是 Orval 的 mutator（`override.mutator` 指向 `src/api/mutator.ts` 的 `apiFetch`），產生的函式寫成 `apiFetch<HealthDataResponse>(...)`。**已決（Q2）**：回傳 `{ data, meta: { traceId, timestamp } }`，`ApiError` 也帶 `timestamp`，成功與錯誤同形。

| 項目                   | 型別                                                                                 |
| :--------------------- | :----------------------------------------------------------------------------------- |
| `apiFetch<T>` 的回傳   | `ApiResponse<T> = T extends { data: infer D } ? { data: D; meta: ResponseMeta } : T` |
| `ResponseMeta`         | `{ traceId: string; timestamp: string }`，值取自成功外層的同名欄位                   |
| `useGetHealth().data`  | `{ data: HealthData; meta: ResponseMeta }`                                           |
| `useGetHealth().error` | `ApiError`                                                                           |

- 外層的 `success`、`code`、`message` 不交給呼叫端（成功時 `success` 恆為 `true`，失敗時已轉成 `ApiError`；成功時沒有畫面需要 `code`、`message`，之後加進 `meta` 是非破壞性變更）。
- 呼叫端寫 `query.data.data`；需要攤平時在自己的 hook options 用 `select`。
- `204` 沒有 body，回 `undefined`，不套用 `{ data, meta }`。
- 型別能不能穿過產物依 N3：產物的請求函式不能有 Orval 加上的明確回傳型別註記，apply 第一組以實際版本確認，失敗時停下來回到 clarification。

## 錯誤正規化契約

`apiFetch` 對外承諾：**任何**失敗都以 `ApiError` 拋出，元件與 hook 永遠拿不到原生 `TypeError`、`DOMException`、`Response` 或 `unknown`。`mutator.ts` 匯出 `ErrorType<E> = ApiError`，所以 Orval 產生的 `GetHealthQueryError` 等錯誤型別都是 `ApiError`，不是 `ErrorResponse`。

### `ApiError` 的欄位

| 欄位          | TS 型別                 | 何時有值                           | 來源                                                                   | 能不能上畫面                                                                                                               |
| :------------ | :---------------------- | :--------------------------------- | :--------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| `kind`        | `ApiErrorKind`          | 一律                               | `apiFetch` 判定                                                        | 開發用頁面可以（「錯誤類型」）；業務頁的露出由 01-01 依 07-01 設計                                                         |
| `status`      | `number \| null`        | `http`、`invalidResponse`          | HTTP 狀態碼                                                            | 只用來分流，不直接顯示                                                                                                     |
| `code`        | `string \| null`        | `http`                             | 錯誤外層 `code`                                                        | 開發用頁面可以；業務頁見 01-01                                                                                             |
| `message`     | `string`                | 一律                               | `http`：錯誤外層 `message`（已本地化）；其他：英文診斷字串             | `http` 的可以原樣顯示（A8）；其他 kind 的**不上畫面**，畫面用自己的翻譯字串                                                |
| `traceId`     | `string \| null`        | `http`；`invalidResponse` 有標頭時 | `http`：錯誤外層 `traceId`；`invalidResponse`：`X-Correlation-ID` 標頭 | 可以；A7 規定 `5xx` 顯示通用錯誤並附 correlation id                                                                        |
| `timestamp`   | `string \| null`        | `http`                             | 錯誤外層 `timestamp`（UTC 毫秒字串）                                   | 開發用頁面可以；與成功的 `meta.timestamp` 對稱（Q2、C6）                                                                   |
| `fieldErrors` | `ErrorDetail[] \| null` | `http` 且 `status === 422`         | 錯誤外層 `errors`，型別是產物的 `ErrorDetail`                          | 逐欄位顯示時以 `code` 對照翻譯字串，`message` 只是備援（後端契約 §ErrorDetail）；不得 `JSON.stringify` 貼到畫面（A7 反例） |

- `ErrorDetail` 直接用產物的型別，不另寫 DTO（A6 禁止）。
- `ApiError` 不保留原始 `Response` 或 `cause` 給畫面讀；若為除錯保留 `cause`，它不在對外契約內，元件不得讀它。

### `ApiErrorKind`

| 值                | 意義                                                        | 自動重試 |
| :---------------- | :---------------------------------------------------------- | :------- |
| `http`            | 收到錯誤外層（非 `2xx` 且 `isErrorEnvelope` 成立）          | 不重試   |
| `network`         | `fetch` 拒絕，且不是 abort                                  | 不重試   |
| `timeout`         | 本層的逾時計時器（15 秒）abort                              | 不重試   |
| `invalidResponse` | 回應不是外層：非 JSON、空 body、JSON 但形狀不符（含 `2xx`） | 不重試   |
| `aborted`         | 呼叫端（TanStack Query）取消                                | 不重試   |

`isAuthError` 只認 `kind: "http"` 且 `status === 401`（Q4）；`403` 是無權限不是未登入，留給 01-01。本次沒有端點會回這兩個碼。

### 外層的判定規則

`isSuccessEnvelope`、`isErrorEnvelope` 把 body 當 `unknown` 收窄，欄位以 `openapi.json` 的 `required` 為準：

| guard               | 成立條件                                                                                                                                                 |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isSuccessEnvelope` | 物件；`success === true`；`code`、`message`、`timestamp`、`traceId` 是 string；有 `data` 鍵                                                              |
| `isErrorEnvelope`   | 物件；`success === false`；`code`、`message`、`timestamp`、`traceId` 是 string；`data === null`；`errors` 是陣列或 `null`，**缺鍵視同 `null`**（Q19 C4） |

`data` 裡那一層不在執行期驗證，以型別信任產物（執行期 schema 驗證不在本次範圍）。`2xx` 但 `isSuccessEnvelope` 不成立時是 `invalidResponse`，不是成功。

## MSW 四種狀態的 fixture

測試用 `msw/node` 的 `setupServer`（`src/test/msw-server.ts`），`onUnhandledRequest: "error"`。MSW、faker 與產生的 `*.msw.ts` **只給測試檔用**（測試檔指 `**/*.test.ts(x)`、`src/test/**`、`vitest.config.ts`，定義見 `system-design.md` §目錄結構），lint 擋住產品碼 import（Q6）。四種狀態的回應**只用 `openapi.json` 裡有的 body 欄位**，不加任何欄位；值取自後端契約的範例與錯誤碼表。fixture 由 `src/test/envelope-fixtures.ts` **手組**，回傳型別是產物的 `HealthDataResponse`／`ErrorResponse`，欄位改名時測試在型別檢查就失敗（Q19 C3）。**前端測試一律以固定 fixture 覆寫 Orval 產生的 handler**，產生的預設 handler 只當「有攔到請求」的底線（Q19 C1，理由見下）。

| 狀態         | handler 行為                                                             | status | body                   |
| :----------- | :----------------------------------------------------------------------- | :----- | :--------------------- |
| 載入中       | 延遲回應（`await delay("infinite")` 或測試控制的 promise），之後不必回應 | —      | —                      |
| 正常         | `HttpResponse.json(body, { status: 200, headers })`                      | `200`  | 下方「正常」           |
| 後端回報錯誤 | `HttpResponse.json(body, { status: 503, headers })`                      | `503`  | 下方「資料庫無法連線」 |
| 連不到後端   | `HttpResponse.error()`（`fetch` 拒絕）                                   | —      | —                      |

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

- `errors` 必須帶、值為 `null`：`openapi.json` 把它列在 `ErrorResponse` 的 `required`，後端契約也說非 `422` 時為 `null`。少了它 `ErrorResponse` 型別不成立。
- **回應標頭（Q19 C2）**：fixture 照後端契約帶 `X-Correlation-ID`（值與 body 的 `traceId` 相同）與 `Content-Language`（`zh-TW` 或 `en`，與請求的 `Accept-Language` 一致），視後端契約為標頭的依據；`openapi.json` 沒有宣告回應標頭，Orval 產物看不到它們。
- **為什麼要覆寫產生的 handler（C1）**：`openapi.json` 對外層的 `success` 只宣告 `type: boolean`、`code` 只宣告 `type: string`，沒有 `const` 或 `enum`，也沒有 `example`，Orval 用 faker 產的「`200`」會隨機給 `success`（可能是 `false`）與隨機 `code`，`isSuccessEnvelope` 會判成 `invalidResponse`。測試用 `getGetHealthMockHandler(override)` 或 `server.use` 帶固定 fixture；若要後端在外層 schema 加 `const` 與 `examples`，屬後端 change，另開 issue，不在本次改 `backend/`。
- 「連不到後端」的逾時路徑以假時鐘推進 15 秒驗證，不在 MSW 層模擬（`system-design.md` §測試 `mutator.test.ts`）。
- `traceId` 是固定的 UUID4 字串、`timestamp` 是固定的 UTC 毫秒字串，不用 faker 產生，讓斷言與快照穩定。
- 其他錯誤外層（`404`、`500` 等）的測試照同樣方式組，`code` 與 `message` 取自後端契約 §錯誤碼 的表，不自創。
- 英文語言的測試把 `message` 換成後端契約的英文版文字，`Content-Language` 為 `en`。

## Orval 產生契約

### 輸入與輸出

| 項目   | 值                                                                                                                                                        | 依據                                            |
| :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------- |
| 設定檔 | `frontend/orval.config.ts`，唯一的一份                                                                                                                    | A5、`system-design.md`                          |
| 輸入   | `../backend/openapi.json`（相對 `frontend/`）；只讀已提交的檔案，前端不改它                                                                               | A4、後端契約 §OpenAPI 元件命名與 `openapi.json` |
| 輸出   | `frontend/src/api/generated/`，整個資料夾由 Orval 擁有，`clean: true`                                                                                     | A4、ADR-003 D6                                  |
| client | `react-query`；`override.mutator` → `src/api/mutator.ts` 的 `apiFetch`；`override.query.signal: true`                                                     | A6、A9                                          |
| mock   | MSW handlers 與 response mock，只被測試 import（lint 擋產品碼）                                                                                           | T6                                              |
| 格式化 | 不格式化：`frontend/src/api/generated/` 進根目錄 `.prettierignore`，產物維持 Orval 原樣（Q8）                                                             | A4、A5                                          |
| 指令   | `pnpm --filter frontend api:generate`：**只讀 `backend/openapi.json` 跑 Orval**，不依賴 Python；從後端匯出到 Orval 的整條鏈由 #506 的根目錄指令串起（Q8） | A5                                              |

產物檔案在資料夾內怎麼分（Orval 的 `mode`）是實作細節，不在契約內；契約只承諾下表的匯出名稱，從 `src/api/generated/` 底下 import。

### 產生的識別字

依 operationId `getHealth` 與元件名，Orval 預期產出（以 apply 時的實際版本為準；與下表不同時先回來改本文，A4）：

| 種類          | 名稱                                                                               | 用在                                                                                  |
| :------------ | :--------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| 查詢 hook     | `useGetHealth`                                                                     | `HealthStatusPanel`                                                                   |
| 請求函式      | `getHealth`                                                                        | `useGetHealth` 的 `queryFn`；元件不直接呼叫                                           |
| query key     | `getGetHealthQueryKey`                                                             | 唯一的 key 來源（A9）；「重新檢查」用 `refetch()`、不換 key                           |
| query options | `getGetHealthQueryOptions`                                                         | 之後需要 prefetch 時用                                                                |
| 錯誤型別別名  | `GetHealthQueryError`（＝`ErrorType<ErrorResponse>`＝`ApiError`）                  | 元件的 `error` 型別                                                                   |
| MSW           | `getGetHealthMockHandler`、`getGetHealthResponseMock`（位於產生的 `*.msw.ts`）     | 只給測試檔（`**/*.test.ts(x)`、`src/test/**`、`vitest.config.ts`）；產品碼不得 import |
| 型別          | `HealthData`、`HealthDataResponse`、`HealthStatus`、`ErrorResponse`、`ErrorDetail` | fixture、`apiFetch` 的泛型、`ApiError.fieldErrors`                                    |

- 沒有 `servers` 欄位，產物的 `url` 是 `/api/v1/health`，base URL 只由 `apiFetch` 加（A6）。
- `openapi.json` 沒有宣告請求標頭參數，所以 `getHealth` 沒有 header 參數；`Accept-Language` 一律由 `apiFetch` 加，元件不組標頭（A6）。

### 什麼算漂移

在根目錄執行 `pnpm --filter frontend api:generate` 之後，以下任一情況就是漂移，檢查失敗：

1. `git diff --exit-code -- frontend/src/api/generated` 有差異：已提交的產物與輸入重產的結果不同（手改、格式化過、或後端改了契約卻沒重產）。
2. `git status --porcelain -- frontend/src/api/generated` 有輸出：多出未追蹤或已刪除的檔案（手加檔案也算手改，A4；`clean: true` 讓舊檔不殘留）。

後端那一側的漂移（`backend/openapi.json` 在重新匯出後有差異）由後端既有的契約漂移指令負責，匯出到產生的整條鏈由 #506 串起。

不算漂移的：`orval.config.ts`、`mutator.ts` 等手寫檔的變動（它們會讓產物變，但變動本身受 lint、型別檢查與審查管）。產物不受 lint、不進覆蓋率分母（F2 例外、T10、Q12），也不被 Prettier 改寫。本次只提供這條指令並補進 `openspec/config.yaml`；CI 執行它屬 #506。A5 要求契約、`openapi.json` 與產物同一個 commit：本次 `openapi.json` 不變，所以只要產物與手寫碼同一個 commit。

## 待決問題的處理結果

本 change 沒有新增待決。上游待決與本文原本的 C1–C6 已由維護者於 2026-11-20 全部決議（clarification Q1–Q19），本文依決議改寫。

| 編號        | 主題                                                    | 決議                                                                              | 依據                        | 狀態                |
| :---------- | :------------------------------------------------------ | :-------------------------------------------------------------------------------- | :-------------------------- | :------------------ |
| C1          | Orval 產生的預設 handler 不能代表「正常」               | 前端測試一律以固定 fixture 覆寫產生的 handler                                     | Q19                         | 已決                |
| C2          | fixture 要不要帶 `X-Correlation-ID`、`Content-Language` | 照後端契約帶，值與 body `traceId`、請求語言一致                                   | Q19                         | 已決                |
| C3          | `503` 的錯誤外層 mock 從哪來                            | 手組 fixture，型別取自產物                                                        | Q19                         | 已決                |
| C4          | `isErrorEnvelope` 要不要要求 `errors` 鍵                | `errors` 缺鍵視同 `null`，其餘照 `required`                                       | Q19                         | 已決                |
| C5          | 連不到後端時「錯誤類型」顯示什麼                        | 直接顯示 `network` 或 `timeout`；非外層的回應歸〔連不到後端〕                     | Q3                          | 已決                |
| C6          | `ApiError` 要不要帶 `timestamp`                         | 帶：`timestamp: string \| null`；成功的 `meta` 也有 `timestamp`                   | Q2                          | 已決                |
| SA-2        | 成功時交不交出 traceId 與時間                           | `apiFetch` 回 `{ data, meta: { traceId, timestamp } }`                            | Q2                          | 已決                |
| SA-3        | 四種狀態以外的回應                                      | 所有錯誤外層走錯誤版面；非外層歸連不到後端                                        | Q3                          | 已決                |
| SA-4、SA-5  | 重試、逾時、認證錯誤範圍                                | 不自動重試；逾時 15 秒；`isAuthError` 只認 401                                    | Q4                          | 已決                |
| SA-6        | 語系層與語言偏好                                        | react-i18next，zh-TW 與 en，依 `navigator.language`，`Accept-Language` 與介面一致 | Q5                          | 已決                |
| SA-7        | 網路替身                                                | 只給測試用                                                                        | Q6                          | 已決                |
| SA-8        | 專案結構                                                | 根目錄 pnpm workspace，指令用 `pnpm --filter frontend`                            | Q7                          | 已決                |
| SA-9、SA-10 | 產物格式化與一條命令的範圍                              | 進 `.prettierignore`；`api:generate` 只跑 Orval                                   | Q8                          | 已決                |
| SA-12       | 開發頁顯示內部資料                                      | 兩頁是 07-01 的例外                                                               | Q11                         | 已決                |
| N3          | `ApiResponse<T>` 能否穿過 Orval 產物                    | 技術風險：apply 第一組以實際版本確認，失敗時回到 clarification                    | clarification §交給後續產出 | 已決，待 apply 驗證 |
