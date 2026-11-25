# Spec Delta

## Purpose

定義後端伺服器紀錄的可測行為：每個 `/api/v1` 請求一行存取紀錄的欄位、涵蓋範圍與分級，已記過錯誤的請求不重複記錄，每一筆紀錄自動帶目前請求的 `traceId`，紀錄不得含請求內容，以及一行 `key=value` 的輸出格式與輸出等級，讓部署者能用使用者回報的 `traceId` 串起同一個請求的所有紀錄。

## ADDED Requirements

### Requirement: 每個 /api/v1 請求留下一行存取紀錄

系統 SHALL 在每個 `/api/v1` 請求的回應送完後寫**恰好一行**存取紀錄，`logger` 欄為 `app.access`，並含以下欄位：`method`（請求方法）、`route`（比對到的路由模板，含 `/api/v1` 前綴，MUST NOT 是實際路徑）、`status`（回應狀態碼）、`durationMs`（從進入存取紀錄處理起到最後一段回應 body 送出為止的毫秒數，一位小數）、`traceId`（與該回應的 `X-Correlation-ID` 同值）。存取紀錄 MUST NOT 含來源 IP。例外情形只有下列各條 requirement 明列的四種：成功的健康檢查、已記過錯誤的請求、CORS 預檢、`/api/v1` 以外的路徑。

來源：issue #567 §功能範圍、§驗收條件 第 1 條；ADR-008 D4；ADR-003 D5；clarification Q5、Q9、Q11。

#### Scenario: 成功的請求留下一行 INFO 存取紀錄

- **WHEN** 呼叫端帶 `X-Correlation-ID: client-trace-0001` 送出 `GET /api/v1/items/42`，該端點以路由模板 `/api/v1/items/{item_id}` 宣告並回覆 `200`
- **THEN** 這個請求的伺服器紀錄中，`logger` 為 `app.access` 的恰好一行，等級為 `INFO`
- **AND** 該行的 `method` 為 `GET`、`route` 為 `/api/v1/items/{item_id}`、`status` 為 `200`、`traceId` 為 `client-trace-0001`
- **AND** 該行的 `durationMs` 符合 `^\d+\.\d$`
- **AND** 該行不含 `/api/v1/items/42`

#### Scenario: 方法不支援的請求記路由模板

- **WHEN** 呼叫端送出 `POST /api/v1/health`，系統回覆 `405`
- **THEN** 這個請求恰好有一行存取紀錄，等級為 `WARNING`，`route` 為 `/api/v1/health`、`status` 為 `405`

#### Scenario: 沒有路由模板的請求記固定佔位文字

- **WHEN** 呼叫端分別送出 `GET /api/v1/no-such-resource`（回覆 `404`），以及帶 `Accept-Language: fr` 送出 `GET /api/v1/health`（每個語言都被拒，回覆 `406`）
- **THEN** 兩個請求各恰好有一行存取紀錄，等級都是 `WARNING`，`route` 都是 `<unmatched>`，`status` 依序為 `404`、`406`
- **AND** 兩行都不含 `no-such-resource`

### Requirement: 存取紀錄依狀態碼分級

系統 SHALL 依回應狀態碼決定存取紀錄的等級：`2xx` 與 `3xx` 為 `INFO`，`4xx` 為 `WARNING`，`5xx` 為 `ERROR`。

來源：issue #567 §功能範圍、§驗收條件 第 1 條；api-agent-rules A7。

#### Scenario: 用戶端錯誤的請求記一行 WARNING 存取紀錄

- **WHEN** 呼叫端對一個要求 body 欄位 `displayName`、路由模板為 `/api/v1/probe` 的端點送出 `POST /api/v1/probe`，body 為 `{}`，系統回覆 `422`
- **THEN** 這個請求恰好有一行存取紀錄，等級為 `WARNING`，`method` 為 `POST`、`route` 為 `/api/v1/probe`、`status` 為 `422`

#### Scenario: 處理過程沒有記過錯誤的 5xx 記一行 ERROR 存取紀錄

- **WHEN** 一個 `/api/v1` 端點以領域錯誤回覆 `5xx`（例如 `502`），處理過程沒有寫過任何 `WARNING` 或 `ERROR` 紀錄
- **THEN** 這個請求恰好有一行存取紀錄，等級為 `ERROR`，`status` 為該狀態碼

### Requirement: 已記過錯誤的請求不再寫存取紀錄

系統 SHALL 讓每個請求的錯誤只被記一次：處理過程中已經為這個請求寫過 `WARNING` 或 `ERROR` 紀錄的情形——未處理例外、未對應狀態轉成的 `500`、資料庫無法連線的健康檢查——系統 MUST NOT 再為該請求寫存取紀錄。既有那一筆紀錄的等級與內容規則不變。

來源：issue #567 §需求目標、§驗收條件 第 1、2 條；api-agent-rules A7；security-agent-rules S9；clarification Q3。

#### Scenario: 未處理例外造成的 500 只留一筆 ERROR 紀錄

- **WHEN** 處理 `GET /api/v1/probe-crash` 時拋出訊息為 `"CANARY-boom"` 的未處理例外，系統回覆 `500`
- **THEN** 這個請求的伺服器紀錄中，等級為 `ERROR` 的恰好一筆，它含請求的實際路徑 `/api/v1/probe-crash`，`traceId` 與回應的 `traceId` 相同
- **AND** 這個請求沒有 `logger` 為 `app.access` 的紀錄
- **AND** 該筆的訊息文字不含 `traceId=`，輸出那一行中 `traceId=` 恰好出現一次

#### Scenario: 未對應狀態轉成的 500 只留一筆 ERROR 紀錄

- **WHEN** 一個 `/api/v1` 端點丟出狀態碼沒有對應錯誤碼的 HTTP 例外（例如 `418`），系統回覆 `500`、`code` 為 `INTERNAL_ERROR`
- **THEN** 這個請求的伺服器紀錄中，等級為 `ERROR` 的恰好一筆，`traceId` 與回應的 `traceId` 相同
- **AND** 這個請求沒有 `logger` 為 `app.access` 的紀錄
- **AND** 該筆的訊息文字不含 `traceId=`

#### Scenario: 資料庫無法連線時健康檢查只留一筆 WARNING 紀錄

- **WHEN** 資料庫無法連線，呼叫端送出 `GET /api/v1/health`，系統回覆 `503`
- **THEN** 這個請求的伺服器紀錄中，等級為 `WARNING` 以上的恰好一筆，等級為 `WARNING`
- **AND** 這個請求沒有 `logger` 為 `app.access` 的紀錄

### Requirement: 成功的健康檢查不寫存取紀錄

系統 SHALL 讓健康檢查回覆 `2xx` 時不寫存取紀錄；健康檢查回覆非 `2xx` 時，除了已記過錯誤的請求以外，MUST 依分級照常寫一行存取紀錄。

來源：issue #567 §驗收條件 第 1 條；clarification Q1。

#### Scenario: 成功的健康檢查不留存取紀錄

- **WHEN** 資料庫可以連線，呼叫端送出 `GET /api/v1/health`，系統回覆 `200`
- **THEN** 這個請求沒有 `logger` 為 `app.access` 的紀錄
- **AND** 同一個 app 隨後處理的 `POST /api/v1/health`（`405`）仍有一行存取紀錄

### Requirement: 只記 /api/v1 請求且預檢不記

系統 SHALL 只為路徑在 `/api/v1` 底下的請求寫存取紀錄；CORS 預檢請求（帶 `Origin` 與 `Access-Control-Request-Method` 的 `OPTIONS`）與 `/api/v1` 以外的路徑 MUST NOT 有存取紀錄。

來源：issue #567 §功能範圍；ADR-003 D5；clarification Q4、Q6。

#### Scenario: 預檢與 /api/v1 以外的請求不留存取紀錄

- **WHEN** 以 `API_DOCS_ENABLED=true` 啟動，允許來源送出 `OPTIONS /api/v1/health` 預檢（帶 `Access-Control-Request-Method: GET`），呼叫端再分別送出 `GET /docs`、`GET /openapi.json`、`GET /no-such-path`
- **THEN** 這四個請求都沒有 `logger` 為 `app.access` 的紀錄

### Requirement: 伺服器紀錄不含請求內容

系統 MUST NOT 在任何伺服器紀錄（含存取紀錄）中寫入請求的 query string、body、標頭與 cookie 的內容，存取紀錄也 MUST NOT 寫入實際路徑與來源 IP。來自請求的值寫進紀錄前 MUST 先跳脫，使其無法在輸出中產生新的一行。這也是標記員能送出的答案內容不會經紀錄外流的前提。

來源：issue #567 §驗收條件 第 4 條；security-agent-rules S5、S9；AGENTS.md Hard Rule 6；clarification Q5、Q9。

#### Scenario: 存取紀錄不含查詢字串、body、標頭與 cookie

- **WHEN** 呼叫端對路由模板為 `/api/v1/probe` 的端點送出 `POST /api/v1/probe?q=CANARY-query`，帶 `Cookie: session=CANARY-cookie`、`Authorization: Bearer CANARY-auth`、`X-Custom: CANARY-header`，body 為 `{"displayName": "CANARY-body"}`
- **THEN** 這個請求寫出的全部伺服器紀錄輸出（不限存取紀錄）都不含 `CANARY-query`、`CANARY-cookie`、`CANARY-auth`、`CANARY-header`、`CANARY-body`
- **AND** 存取紀錄那一行不含呼叫端的來源位址

#### Scenario: 存取紀錄不含路徑參數的實際值

- **WHEN** 呼叫端送出 `GET /api/v1/items/CANARY-answer`，該端點以路由模板 `/api/v1/items/{item_id}` 宣告
- **THEN** 這個請求的存取紀錄 `route` 為 `/api/v1/items/{item_id}`
- **AND** 這個請求寫出的全部伺服器紀錄輸出都不含 `CANARY-answer`

### Requirement: 每一筆伺服器紀錄自動帶追蹤編號

系統 SHALL 讓後端在處理請求期間寫出的**每一筆**伺服器紀錄——包括業務程式、本專案的基礎建設與第三方套件寫的紀錄——不需呼叫端在訊息或參數中提供，就帶有目前請求的 `traceId`，其值與該回應的外層 `traceId`、`X-Correlation-ID` 相同。請求以外寫的紀錄（啟動、關閉等），`traceId` MUST 為固定標記 `-`，MUST NOT 為新產生的編號。紀錄的訊息文字 MUST NOT 另外手寫 `traceId`。

來源：issue #567 §需求目標、§驗收條件 第 3 條；ADR-003 D5；ADR-008 D4；api-agent-rules A7；clarification Q7、Q8、N1。

#### Scenario: 業務程式的紀錄不改呼叫方式就帶上追蹤編號

- **WHEN** 資料庫無法連線，呼叫端帶 `X-Correlation-ID: client-trace-0002` 送出 `GET /api/v1/health`
- **THEN** 健康檢查寫的那一筆 `WARNING` 紀錄的 `traceId` 為 `client-trace-0002`
- **AND** 該筆的訊息文字不含 `traceId=` 與 `client-trace-0002`，輸出那一行中 `traceId=` 恰好出現一次

#### Scenario: 第三方套件的紀錄也帶追蹤編號

- **WHEN** 一個 `/api/v1` 端點在處理時，以不屬於本專案命名空間的 logger（例如 `thirdparty.lib`）寫一筆 `WARNING` 紀錄，呼叫端帶 `X-Correlation-ID: client-trace-0003`
- **THEN** 該筆紀錄的 `traceId` 為 `client-trace-0003`

#### Scenario: 請求以外寫的紀錄帶固定標記

- **WHEN** 在任何請求之外（例如服務啟動期間）先後寫出兩筆紀錄
- **THEN** 兩筆紀錄的 `traceId` 都是 `-`，輸出都含 `traceId=-`
- **AND** 兩筆的 `traceId` 都不是 UUID 格式

### Requirement: 紀錄輸出為一行 key=value 文字

系統 SHALL 把後端的**每一筆**伺服器紀錄輸出成一行 `key=value` 文字：依序以 `timestamp`、`level`、`logger`、`traceId` 開頭；存取紀錄接著 `method`、`route`、`status`、`durationMs`；紀錄帶例外資訊時接 `excType`；最後固定為 `msg`，值為到行尾的訊息文字。`timestamp` MUST 為 UTC、毫秒、以 `Z` 結尾。訊息中的換行等控制字元 MUST 以跳脫序列輸出，使每一筆紀錄恰好佔一行。紀錄帶例外資訊時，輸出 MUST 只含例外型別，MUST NOT 含例外訊息與多行堆疊。

來源：issue #567 §功能範圍；security-agent-rules S9；clarification Q2（取代歸檔 `2026-11-23-infra-compose-e2e-ci` clarification Q15）。

#### Scenario: 每一筆紀錄輸出為一行 key=value

- **WHEN** 呼叫端送出 `GET /api/v1/items/42`（回覆 `200`），取該請求存取紀錄的輸出行
- **THEN** 該行符合 `^timestamp=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z level=INFO logger=app\.access traceId=\S+ method=GET route=/api/v1/items/\{item_id\} status=200 durationMs=\d+\.\d msg=.+$`

#### Scenario: 訊息含換行時仍輸出一行

- **WHEN** 處理請求時拋出未處理例外，該筆 `ERROR` 紀錄的訊息含多行的堆疊
- **THEN** 該筆紀錄在輸出中恰好佔一行，原本的換行以跳脫序列 `\n` 出現在同一行內

#### Scenario: 第三方紀錄帶例外資訊時只寫例外型別

- **WHEN** 一筆由第三方 logger 寫出、附帶例外資訊的紀錄，例外為 `ValueError("CANARY-exc")`
- **THEN** 該筆輸出恰好一行，含 `excType=builtins.ValueError`
- **AND** 輸出不含 `CANARY-exc` 與 `Traceback`

### Requirement: 伺服器程式內建的存取紀錄已關閉

系統 SHALL 關閉 ASGI 伺服器程式（uvicorn）內建的存取紀錄，不論以容器、本機開發指令或手動指令啟動，請求的存取紀錄都只有本規格定義的那一行。

來源：issue #567 §驗收條件 第 4 條；security-agent-rules S9；歸檔 `2026-11-20-backend-skeleton` acceptance §觀察 第 3 條；clarification Q10。

#### Scenario: 伺服器程式內建的存取紀錄已關閉

- **WHEN** 以 `uvicorn app.main:create_app --factory` 啟動服務（不帶關閉存取紀錄的參數），呼叫端送出 `GET /api/v1/health?q=CANARY-query`
- **THEN** 服務行程的輸出不含 `CANARY-query`，也沒有伺服器程式內建格式的存取紀錄行（例如含 `"GET /api/v1/health` 的那一行）

### Requirement: 輸出等級由 LOG_LEVEL 決定且 SQL 紀錄維持 WARNING

系統 SHALL 以 `LOG_LEVEL` 決定後端所有紀錄（含伺服器程式自己的紀錄）的最低輸出等級；低於該等級的紀錄 MUST NOT 輸出。資料庫引擎的紀錄 MUST 固定為 `WARNING`，不論 `LOG_LEVEL` 設為何值，SQL 本文 MUST NOT 出現在輸出中。

來源：issue #567 §功能範圍；security-agent-rules S9；ADR-008 D4；clarification Q12。

#### Scenario: LOG_LEVEL 設為 WARNING 時不輸出 INFO 紀錄

- **WHEN** 以 `LOG_LEVEL=WARNING` 啟動服務，呼叫端送出 `GET /api/v1/items/42`（`200`）與 `GET /api/v1/no-such-resource`（`404`）
- **THEN** 輸出沒有 `level=INFO` 的行，也沒有 `200` 那個請求的存取紀錄
- **AND** `404` 那個請求有一行 `level=WARNING` 的存取紀錄

#### Scenario: 資料庫引擎的紀錄維持 WARNING

- **WHEN** 分別以未設 `LOG_LEVEL` 與 `LOG_LEVEL=DEBUG` 啟動服務，資料庫可以連線，呼叫端送出 `GET /api/v1/health`
- **THEN** 兩次的輸出都不含 `SELECT 1`
