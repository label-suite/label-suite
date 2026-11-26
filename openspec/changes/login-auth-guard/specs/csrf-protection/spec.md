# Spec Delta

## Purpose

定義寫入請求的跨站偽造防護：帶著登入 cookie 的寫入請求必須同時帶上與 cookie 相符的 `X-CSRF-Token`，只有固定的放行清單例外，讓別的網站無法借用使用者的登入狀態送出寫入。

## ADDED Requirements

### Requirement: 帶登入 cookie 的寫入請求要帶相符的 CSRF token

對 `/api/v1` 送出 `POST`、`PUT`、`PATCH`、`DELETE` 且帶 `__Host-ls_at` cookie 的請求，系統 SHALL 要求 `X-CSRF-Token` 標頭等於 `__Host-ls_csrf` cookie，且屬於該 access token 所屬的登入狀態；不符時在路由之前回 `403`、`code` 為 `CSRF_FAILED`，`data` 與 `errors` 為 `null`。

來源：ADR-004 D3；security-agent-rules S2；`api-contract.md` §共用約定 CSRF。

#### Scenario: 沒帶 CSRF 標頭的寫入被擋下

- **WHEN** 帶有效登入 cookie 的呼叫端送出 `POST /api/v1/health`，沒有 `X-CSRF-Token` 標頭
- **THEN** 系統回覆 `403`，`code` 為 `"CSRF_FAILED"`，`data` 與 `errors` 為 `null`

#### Scenario: CSRF 標頭與 cookie 不符被擋下

- **WHEN** 帶有效登入 cookie 的呼叫端送出 `POST /api/v1/health`，`X-CSRF-Token` 為另一段登入狀態的 CSRF token，`__Host-ls_csrf` 也設成同一個值
- **THEN** 系統回覆 `403`，`code` 為 `"CSRF_FAILED"`

#### Scenario: CSRF 相符的寫入交給路由處理

- **WHEN** 帶有效登入 cookie 與相符 `X-CSRF-Token` 的呼叫端送出 `POST /api/v1/health`
- **THEN** 系統回覆 `405`，`code` 為 `"METHOD_NOT_ALLOWED"`

#### Scenario: 讀取請求不驗 CSRF

- **WHEN** 帶有效登入 cookie、沒有 `X-CSRF-Token` 的呼叫端送出 `GET /api/v1/current-session`
- **THEN** 系統回覆 `200`

### Requirement: 沒有登入 cookie 的寫入請求不驗 CSRF

沒有帶 `__Host-ls_at` cookie 的寫入請求 SHALL 不做 CSRF 驗證，照一般路由處理；這類請求沒有可被借用的登入狀態，需要登入的端點會由身分判定拒絕。

來源：ADR-004 D3；security-agent-rules S2；`design.md` 決策 D3。

#### Scenario: 未登入的寫入照常路由

- **WHEN** 沒有任何 cookie 的呼叫端送出 `POST /api/v1/health`
- **THEN** 系統回覆 `405`，`code` 為 `"METHOD_NOT_ALLOWED"`

### Requirement: 四個登入相關的寫入端點放行

`POST /api/v1/sessions`、`POST /api/v1/session-refreshes`、`POST /api/v1/google-sessions` 與 `DELETE /api/v1/current-session` SHALL 不做 CSRF 驗證，即使帶著登入 cookie；其餘寫入端點 MUST 驗證。三個 `POST` 只接受 `application/json`。

來源：ADR-004 D3；security-agent-rules S2；`system-design.md` §技術待決 T2；`api-contract.md` §共用約定。

#### Scenario: 放行清單不需 CSRF 標頭

- **WHEN** 帶著已過期 access cookie、沒有 `X-CSRF-Token` 的呼叫端依序送出延續與登出
- **THEN** 兩個請求都沒有回覆 `403 CSRF_FAILED`

#### Scenario: 已登入時再送登入不被 CSRF 擋下

- **WHEN** 帶有效登入 cookie、沒有 `X-CSRF-Token` 的呼叫端以正確帳密送出 `POST /api/v1/sessions`
- **THEN** 系統回覆 `201`

### Requirement: 只有允許的來源能送出 CSRF 標頭

跨來源預檢 SHALL 只對允許清單內的來源回應允許 `X-CSRF-Token` 標頭；不在清單內的來源 MUST NOT 取得 `Access-Control-Allow-Origin`。

來源：ADR-004 D3；AGENTS.md Hard Rule 7；security-agent-rules S2；主規格 `runtime-config`「允許來源設定決定跨來源回應」。

#### Scenario: 允許的來源可以送 CSRF 標頭

- **WHEN** 允許清單含 `http://localhost:5173`，送出 `OPTIONS /api/v1/sessions`，帶 `Origin: http://localhost:5173`、`Access-Control-Request-Method: POST`、`Access-Control-Request-Headers: content-type, x-csrf-token`
- **THEN** 回應的 `Access-Control-Allow-Headers` 含 `x-csrf-token`（不分大小寫），`Access-Control-Allow-Origin` 為 `http://localhost:5173`

#### Scenario: 不允許的來源拿不到允許標頭

- **WHEN** 同一個預檢改帶 `Origin: http://evil.example`
- **THEN** 回應不帶 `Access-Control-Allow-Origin`
