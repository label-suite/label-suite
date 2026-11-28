# login-session Specification

## Purpose

定義一段登入狀態從開始到結束的可觀察行為：登入憑證只放在 httpOnly cookie、90 天絕對上限與 7 天閒置兩條期限、延續（含多分頁同時延續與疑似盜用）、被動登出時顯示的兩句，以及只結束這一台的登出。

## Requirements

### Requirement: 登入憑證只放在 cookie

開始或延續一段登入狀態時，系統 SHALL 以 `__Host-ls_at`、`__Host-ls_rt`、`__Host-ls_csrf` 三個 cookie 交付憑證，三者都帶 `Secure`、`Path=/`、不帶 `Domain`、`SameSite=Lax`；`__Host-ls_at` 與 `__Host-ls_rt` MUST 帶 `HttpOnly`，`__Host-ls_csrf` MUST NOT 帶 `HttpOnly`。回應 body MUST NOT 含任何 token。

來源：ADR-004 D1、D3；security-agent-rules S1、S2；規格 01-05 §一次登入是一段登入狀態；`api-contract.md` §共用約定。

#### Scenario: 登入回應的 cookie 屬性

- **WHEN** 以正確的 Email 與密碼送出 `POST /api/v1/sessions`
- **THEN** 回應的 `Set-Cookie` 有 `__Host-ls_at`、`__Host-ls_rt`、`__Host-ls_csrf` 三個，三者都含 `Secure`、`Path=/`、`SameSite=Lax`，都不含 `Domain`
- **AND** `__Host-ls_at` 與 `__Host-ls_rt` 含 `HttpOnly`，`__Host-ls_csrf` 不含 `HttpOnly`
- **AND** 回應 body 序列化後不含三個 cookie 的任何一個值

### Requirement: 每次登入是一段獨立的登入狀態

每次登入成功 SHALL 開始一段新的登入狀態，記下開始時間；同一帳號在兩台裝置登入就是兩段，一段失效不影響另一段。

來源：規格 01-05 §一次登入是一段登入狀態 第 1–3 條；Scenario「兩段登入狀態互不相干」。

#### Scenario: 兩段登入狀態互不相干

- **WHEN** 同一帳號在裝置 A 與裝置 B 各自登入，之後 A 從這一台登出
- **THEN** 兩段登入狀態各有自己的開始時間
- **AND** B 送出 `GET /api/v1/current-session` 仍回覆 `200`

### Requirement: 兩條期限先到先生效

一段登入狀態 SHALL 在兩條限制內有效：從登入起算 90 天的絕對上限，以及連續 7 天沒有使用的閒置限制。延續成功 SHALL 讓閒置那條線往後延，但 MUST NOT 越過絕對上限；任一條到了，下一次操作與延續都被拒絕。期限一律在伺服器端判定。

來源：規格 01-05 §登入狀態能撐多久 第 1–5 條、§卡控機制、§已確認決議 Q1、Q2、Q12；Scenario「達到絕對上限就要重新登入」「閒置超過限制就要重新登入」「持續使用會延長閒置那條線」「延長不會越過絕對上限」。

#### Scenario: 達到絕對上限就要重新登入

- **WHEN** 一段登入狀態從登入起算已滿 90 天，即使前一分鐘還延續成功過，使用者送出延續
- **THEN** 系統回覆 `401`，`code` 為 `"ACCOUNT_SESSION_EXPIRED"`，回應清掉三個登入 cookie
- **AND** 畫面回到登入頁，顯示「登入已過期，請重新登入」

#### Scenario: 閒置超過限制就要重新登入

- **WHEN** 一段登入狀態最後一次延續是 7 天又 1 分鐘之前，使用者送出延續
- **THEN** 系統回覆 `401`，`code` 為 `"ACCOUNT_SESSION_EXPIRED"`

#### Scenario: 持續使用會延長閒置那條線

- **WHEN** 使用者在登入後第 1 天到第 10 天每天延續一次，第 10 天送出 `GET /api/v1/current-session`
- **THEN** 系統回覆 `200`，沒有被要求重新登入

#### Scenario: 延長不會越過絕對上限

- **WHEN** 距絕對上限只剩一天，使用者延續成功
- **THEN** 新發出的 `__Host-ls_rt` 與 `__Host-ls_at` 的到期時間都不晚於登入起算滿 90 天的那一刻

### Requirement: 延續登入狀態

持有有效 `__Host-ls_rt` 的呼叫端 SHALL 能以 `POST /api/v1/session-refreshes`、body `{}` 延續同一段登入狀態：成功回 `201`、`Location: /api/v1/current-session`，重設三個 cookie（新的 refresh token），`data` 欄位同登入。請求沒有 refresh cookie 時 SHALL 回 `401 AUTH_REQUIRED`（沒有登入狀態可延續，不是被動登出）；帳號停用或已匿名化時 MUST 拒絕且不發新憑證。

來源：規格 01-05 §延續登入狀態與疑似被盜用、§帳號被停用或重新啟用 第 2 條；ADR-004 D1；`api-contract.md` §createSessionRefresh。

#### Scenario: 延續成功

- **WHEN** 使用者的 access token 已過期、refresh token 仍有效，送出 `POST /api/v1/session-refreshes`，body 為 `{}`
- **THEN** 系統回覆 `201`，`data.user` 恰好含 `id`、`name`、`email`、`role`
- **AND** 回應設定的 `__Host-ls_rt` 與請求帶來的不同，之後以新 cookie 送出 `GET /api/v1/current-session` 回覆 `200`

#### Scenario: 停用的帳號不能延續

- **WHEN** 帳號在登入後被停用，它的 refresh token 尚未用過，送出延續
- **THEN** 系統回覆 `401`，`code` 為 `"ACCOUNT_SESSION_INVALID"`，回應清掉三個登入 cookie，沒有發新憑證

#### Scenario: 延續的 body 只收空物件

- **WHEN** 送出延續，body 為 `{"sid": "x"}`
- **THEN** 系統回覆 `422`，`code` 為 `"VALIDATION_FAILED"`

#### Scenario: 沒有 refresh cookie 時延續回 AUTH_REQUIRED

- **WHEN** 沒有任何 cookie 的呼叫端送出 `POST /api/v1/session-refreshes`，body 為 `{}`
- **THEN** 系統回覆 `401`，`code` 為 `"AUTH_REQUIRED"`，不是 `ACCOUNT_SESSION_EXPIRED` 或 `ACCOUNT_SESSION_INVALID`

#### Scenario: 延續登入狀態失敗不計次

- **WHEN** 同一個呼叫端以同一張已失效的 refresh token 連續送出 20 次延續
- **THEN** 20 次都回覆 `401 ACCOUNT_SESSION_INVALID`，沒有任何一次回覆 `429` 或其他鎖定的碼

### Requirement: 多個分頁同時延續不互相踢掉

同一張 refresh token 在寬限期內第二次使用時，系統 SHALL 再發一次同一段登入狀態的新憑證；第三次以上 SHALL 回 `409 ACCOUNT_REFRESH_CONFLICT`，不發新憑證、不清 cookie、不撤銷任何登入狀態。畫面遇到 `409` 時 SHALL 短暫等候後以目前的 cookie 重送原請求一次；仍不通就最多再延續一次，成功就再重送一次，還是不行才帶回登入頁。整個過程延續至多 2 次、原請求的重送至多 2 次。

來源：規格 01-05 §多個分頁同時延續登入狀態 第 1–4 條、§已確認決議 Q13；§邊界情況；Scenario「兩個分頁同時延續不會互相踢掉」「慢的那個分頁自動重試一次」「重試仍失敗就帶回登入頁」「同一次延續用第三次就不給」；Scenario「重試不通時再延續一次就成功」驗的是 01-05 §規格「多個分頁同時延續登入狀態」第 3 條（仍不通就最多再延續一次，成功就再重送一次）的成功分支，規格書 §驗收標準沒有同名的一列。

#### Scenario: 兩個分頁同時延續不會互相踢掉

- **WHEN** 同一台的兩個分頁在寬限期內各用同一張 refresh token 送出延續
- **THEN** 兩次都回覆 `201`，兩個回應屬於同一段登入狀態
- **AND** 該帳號其他裝置的登入狀態都還能通行，沒有新增第二段登入狀態

#### Scenario: 同一次延續用第三次就不給

- **WHEN** 同一張 refresh token 在寬限期內已用過兩次，第三次送出延續
- **THEN** 系統回覆 `409`，`code` 為 `"ACCOUNT_REFRESH_CONFLICT"`，回應沒有任何 `Set-Cookie`
- **AND** 該帳號所有裝置的登入狀態都還能通行

#### Scenario: 慢的那個分頁自動重試一次

- **WHEN** 畫面的某個請求收到 `401 AUTH_REQUIRED`，接著延續收到 `409 ACCOUNT_REFRESH_CONFLICT`，等候後以目前 cookie 重送的原請求回覆 `200`
- **THEN** 畫面沒有顯示錯誤，也沒有離開目前的頁面

#### Scenario: 重試仍失敗就帶回登入頁

- **WHEN** 延續收到 `409 ACCOUNT_REFRESH_CONFLICT`，等候後重送的原請求仍回覆 `401 AUTH_REQUIRED`，再延續一次回覆 `401 ACCOUNT_SESSION_INVALID`
- **THEN** 畫面回到 `/account/login`，整個過程中延續請求恰好 2 次、原請求的重送恰好 1 次，沒有第三次延續

#### Scenario: 重試不通時再延續一次就成功

- **WHEN** 延續收到 `409 ACCOUNT_REFRESH_CONFLICT`，等候後重送的原請求仍回覆 `401 AUTH_REQUIRED`，再延續一次回覆 `201`，第二次重送的原請求回覆 `200`
- **THEN** 畫面沒有顯示錯誤，也沒有離開目前的頁面；延續共 2 次、原請求的重送共 2 次

### Requirement: 疑似被盜用時所有裝置一起登出

同一張 refresh token 在寬限期外又被使用時，系統 SHALL 讓該帳號所有登入狀態失效並回 `401 ACCOUNT_SESSION_INVALID`。因登出或安全撤銷而失效的登入狀態 MUST NOT 有寬限資格，再次使用只會被拒，不觸發全部登出。

來源：規格 01-05 §疑似被盜用時所有裝置一起登出 第 1–4 條；§卡控機制；Scenario「疑似被盜用時所有裝置一起登出」「安全撤銷的登入狀態沒有寬限資格」。

#### Scenario: 疑似被盜用時所有裝置一起登出

- **WHEN** 帳號在裝置 A、B 都登入著，A 的某一張 refresh token 已在寬限期外被用過，有人再用它送出延續
- **THEN** 系統回覆 `401`，`code` 為 `"ACCOUNT_SESSION_INVALID"`
- **AND** A 與 B 下一次送出 `GET /api/v1/current-session` 都回覆 `401 AUTH_REQUIRED`，延續也都被拒

#### Scenario: 安全撤銷的登入狀態沒有寬限資格

- **WHEN** 裝置 A 從這一台登出後，立刻（寬限期內）以登出前的 refresh token 送出延續，同帳號的裝置 B 仍登入著
- **THEN** 系統回覆 `401 ACCOUNT_SESSION_INVALID`
- **AND** B 送出 `GET /api/v1/current-session` 仍回覆 `200`

### Requirement: 被動登出時顯示對應的一句

延續回 `401 ACCOUNT_SESSION_EXPIRED` 時，畫面 SHALL 回到登入頁並在錯誤橫幅顯示「登入已過期，請重新登入」（英文 `Session expired, please sign in again`）；回 `401 ACCOUNT_SESSION_INVALID` 時顯示「驗證失敗，請重新登入」（英文 `Authentication failed, please sign in`）。延續回 `401 AUTH_REQUIRED`（本來就沒有登入狀態）時回到登入頁、MUST NOT 顯示任何錯誤橫幅。兩句 MUST NOT 帶出任何帳號或裝置資訊，也不放在網址裡。

來源：規格 01-05 §不能通行的登入狀態不說明原因 第 4 條、§已確認決議 Q4、Q19；§邊界情況；Scenario「英文介面的登入已過期顯示英文那句」「英文介面的驗證失敗顯示英文那句」。

#### Scenario: 登入已過期顯示中文那句

- **WHEN** 介面語言為繁體中文，畫面的請求收到 `401 AUTH_REQUIRED`，接著延續收到 `401 ACCOUNT_SESSION_EXPIRED`
- **THEN** 畫面回到 `/account/login`，錯誤橫幅顯示「登入已過期，請重新登入」，網址沒有 query string

#### Scenario: 英文介面的登入已過期顯示英文那句

- **WHEN** 介面語言為英文，登入狀態因為絕對上限到了而結束，使用者回到登入頁
- **THEN** 錯誤橫幅顯示 `Session expired, please sign in again`

#### Scenario: 英文介面的驗證失敗顯示英文那句

- **WHEN** 介面語言為英文，延續收到 `401 ACCOUNT_SESSION_INVALID`，使用者回到登入頁
- **THEN** 錯誤橫幅顯示 `Authentication failed, please sign in`

#### Scenario: 沒有登入狀態時回到登入頁不顯示橫幅

- **WHEN** 畫面的請求收到 `401 AUTH_REQUIRED`，接著延續也收到 `401 AUTH_REQUIRED`
- **THEN** 畫面回到 `/account/login`，登入頁沒有錯誤橫幅

#### Scenario: 重新整理後不再顯示被動登出那句

- **WHEN** 登入頁正顯示「驗證失敗，請重新登入」，使用者重新整理頁面
- **THEN** 登入頁沒有錯誤橫幅

### Requirement: 從這一台登出

`DELETE /api/v1/current-session` SHALL 一律回 `204`、沒有 body，並清掉三個登入 cookie。refresh cookie 可驗證且登入狀態有效時，該段登入狀態失效並記下登出時間；cookie 不在、查不到或已失效時什麼都不寫、不記登出，回應完全相同。其他裝置 MUST 不受影響。登入後外殼側欄的登出控制項呼叫它，不論結果都回到登入頁。

來源：規格 01-05 §從這一台登出 第 1–4 條、§登出紀錄只記真正的登出 第 1、4 條；§卡控機制；Scenario「從這一台登出只影響這一台」「登出不影響其他裝置」「登入狀態已經不能驗證時登出」；Issue #719 落點確認；規格 07-01 §登出；clarification Q2。

#### Scenario: 從這一台登出只影響這一台

- **WHEN** 同一帳號在 A、B 都登入著，A 在側欄點「登出」
- **THEN** 登出請求回覆 `204`、沒有 body，回應清掉三個登入 cookie，畫面以取代歷史紀錄的方式回到 `/account/login`
- **AND** A 這段登入狀態記有登出時間，以 A 原本的 cookie 送出 `GET /api/v1/current-session` 回覆 `401 AUTH_REQUIRED`

#### Scenario: 登出不影響其他裝置

- **WHEN** 上一個 Scenario 中 A 登出成功之後，B 送出 `GET /api/v1/current-session`
- **THEN** 系統回覆 `200`

#### Scenario: 登入狀態已經不能驗證時登出

- **WHEN** 呼叫端沒有任何登入 cookie，送出 `DELETE /api/v1/current-session`
- **THEN** 系統回覆 `204`、沒有 body，與可驗證時的回應狀態與標頭相同
- **AND** 沒有任何登入狀態被記上登出時間

#### Scenario: 登出失敗時畫面仍回到登入頁

- **WHEN** 使用者在側欄點「登出」，登出請求沒有收到回應
- **THEN** 畫面仍回到 `/account/login`

### Requirement: 只有真正的登出才記成登出

只有可驗證的明確登出 SHALL 記下登出時間；自然到期與安全撤銷（疑似被盜用、Google 自動連結）讓登入狀態失效，但 MUST NOT 記成登出。

來源：規格 01-05 §登出紀錄只記真正的登出 第 1–3 條；Scenario「登入狀態自然到期不記成登出」「安全撤銷不記成登出」。

#### Scenario: 登入狀態自然到期不記成登出

- **WHEN** 一段登入狀態因為超過閒置限制，在延續時被判定失效
- **THEN** 這段登入狀態被標成已失效，登出時間為空

#### Scenario: 安全撤銷不記成登出

- **WHEN** 一段登入狀態因為疑似被盜用而失效
- **THEN** 這段登入狀態被標成已失效，登出時間為空

### Requirement: 沒有登出別人裝置的操作

系統 MUST NOT 提供任何讓某個帳號結束另一個帳號某一段登入狀態的操作，也不提供列出某帳號各裝置登入狀態的操作。

來源：規格 01-05 §從這一台登出、§卡控機制「想登出別人的某一台裝置」、§已確認決議 Q5；Scenario「沒有登出別人裝置的操作」。

#### Scenario: 沒有登出別人裝置的操作

- **WHEN** 列出介面描述檔 `openapi.json` 中的所有操作
- **THEN** 沒有任何操作的 path 或 body 接受另一個帳號的識別碼或登入狀態的識別碼來結束或列出登入狀態
