# Spec Delta

## Purpose

讓每個請求都有一個追蹤編號，同時出現在回應標頭 `X-Correlation-ID` 與外層 `traceId`，並定下呼叫端自帶編號的接受與丟棄規則，讓使用者回報的編號能對回伺服器紀錄。

## ADDED Requirements

### Requirement: 每個回應都帶追蹤編號且與 traceId 同值

系統 SHALL 讓每一個回應都帶 `X-Correlation-ID` 標頭，包括成功、`404`、`405`、`406`、`422`、`500`、`503` 與 CORS 預檢回應；回應有外層時，標頭值 MUST 與外層 `traceId` 相同。

來源：api-agent-rules A6、A7、clarification Q8。

#### Scenario: 成功回應的標頭與 traceId 同值

- **WHEN** 呼叫端未帶 `X-Correlation-ID` 送出 `GET /api/v1/health`
- **THEN** 回應帶 `X-Correlation-ID` 標頭，值與外層 `traceId` 相同
- **AND** 該值為小寫、帶連字號的 UUID 第 4 版格式

#### Scenario: 錯誤回應也帶追蹤編號

- **WHEN** 呼叫端分別送出 `GET /api/v1/no-such-resource` 與觸發未處理例外的請求
- **THEN** 兩個回應都帶 `X-Correlation-ID`，值各自與該回應的 `traceId` 相同

#### Scenario: CORS 預檢回應也帶追蹤編號

- **WHEN** 允許來源對 `/api/v1/health` 送出 `OPTIONS` 預檢請求
- **THEN** 回應帶 `X-Correlation-ID` 標頭

#### Scenario: 每個請求的追蹤編號不同

- **WHEN** 呼叫端未帶 `X-Correlation-ID`，連續送出兩次 `GET /api/v1/health`
- **THEN** 兩個回應的 `traceId` 不同

### Requirement: 呼叫端自帶的追蹤編號符合格式才沿用

系統 SHALL 在呼叫端帶的 `X-Correlation-ID` 符合 `^[A-Za-z0-9-]{8,64}$` 時沿用該值；不符合時 MUST 丟棄並改用伺服器產生的新值，且 MUST NOT 因此回覆錯誤。

來源：api-agent-rules A6、AGENTS.md Hard Rule 9、clarification Q8。

#### Scenario: 符合格式的自帶值被沿用

- **WHEN** 呼叫端帶 `X-Correlation-ID: client-trace-0001` 送出 `GET /api/v1/health`
- **THEN** 回應的 `X-Correlation-ID` 標頭與 `traceId` 都是 `client-trace-0001`

#### Scenario: 不符合格式的自帶值被丟棄

- **WHEN** 呼叫端分別帶 `X-Correlation-ID` 為 `abc`（少於 8 字元）、`has space_and_underscore`、65 個 `a` 送出 `GET /api/v1/health`
- **THEN** 每個回應都是 `200`，不是 `400` 或 `422`
- **AND** 回應的 `X-Correlation-ID` 與 `traceId` 相同、是伺服器產生的 UUID 第 4 版格式，不等於呼叫端送出的值

### Requirement: 瀏覽器可以讀到追蹤編號

系統 SHALL 在回應允許來源的請求時，以 `Access-Control-Expose-Headers` 公開 `X-Correlation-ID`，讓瀏覽器端程式讀得到這個標頭。

來源：api-agent-rules A7、security-agent-rules S2。

#### Scenario: 允許來源的回應公開追蹤編號標頭

- **WHEN** 呼叫端帶允許清單內的 `Origin` 送出 `GET /api/v1/health`
- **THEN** 回應的 `Access-Control-Expose-Headers` 含 `X-Correlation-ID`
