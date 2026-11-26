# account-login Specification

## Purpose

定義登入頁與兩條登入路徑（Email 與密碼、Google）的可觀察行為：登入頁依部署能力顯示的入口、送出前後的畫面、各種失敗一律不揭露原因，以及 Google 只登入或連結既有帳號、不建立帳號。

## Requirements

### Requirement: 登入頁設定只回兩個部署開關

系統 SHALL 讓未登入的訪客取得登入頁設定，`data` 恰好含 `selfRegistrationEnabled`（這個部署有沒有設定寄信服務）與 `googleEnabled`（Google 登入的設定是否齊全）兩個布林，不含任何金鑰、網址或帳號資料。

來源：規格 01-01 §登入頁 第 10、11 條；規格 01-02 §已確認決議 Q10；規格 01-01 §已確認決議 Q10；`api-contract.md` §getAuthOptions。

#### Scenario: 未登入也取得登入頁設定

- **WHEN** 沒有任何 cookie 的呼叫端送出 `GET /api/v1/auth-options`，部署有設定寄信服務、沒有設定 Google
- **THEN** 系統回覆 `200`，`data` 恰好是 `{"selfRegistrationEnabled": true, "googleEnabled": false}`

#### Scenario: 三個 Google 設定都設時開啟 Google

- **WHEN** 三個 Google 設定都已設定，呼叫端送出 `GET /api/v1/auth-options`
- **THEN** `data.googleEnabled` 為 `true`（三個都不設時為 `false`；只設一部分時服務拒絕啟動，見主規格 `runtime-config`「Google 登入的設定一起設或一起不設」）

### Requirement: 登入頁依部署能力顯示入口

登入頁 SHALL 依登入頁設定決定入口：`selfRegistrationEnabled` 為假時不顯示「還沒有帳號？ 前往註冊」整列；`googleEnabled` 為假時不顯示「使用 Google 帳號繼續」與「或」分隔線，Email 欄成為卡片第一個控制項；其餘照 prototype 的順序顯示，卡片排版不留空洞。

來源：規格 01-01 §登入頁 第 1–5、10、11 條；§卡控機制；§已確認決議 Q10；Scenario「登入頁顯示完整的登入入口」「沒有設定寄信服務時登入頁不顯示前往註冊」「沒有設定 Google 登入時登入頁不顯示 Google 入口」。

#### Scenario: 登入頁顯示完整的登入入口

- **WHEN** 這個部署有設定寄信服務與 Google 登入，未登入的訪客開啟 `/account/login`
- **THEN** 畫面依序有頁首（品牌與語言切換）、標題與副標、「使用 Google 帳號繼續」、「或」分隔線、Email 欄、密碼欄（標籤列有「忘記密碼？」）、「登入」按鈕，以及底部的「還沒有帳號？」與「前往註冊」
- **AND** 畫面上沒有「記住我」控制項

#### Scenario: 沒有設定寄信服務時登入頁不顯示前往註冊

- **WHEN** 這個部署沒有設定寄信服務、有設定 Google 登入，開啟 `/account/login`
- **THEN** 畫面上沒有「還沒有帳號？」與「前往註冊」
- **AND** Google 按鈕、Email 欄、密碼欄、「忘記密碼？」與「登入」照常顯示

#### Scenario: 沒有設定 Google 登入時登入頁不顯示 Google 入口

- **WHEN** 這個部署沒有設定 Google 登入，開啟 `/account/login`
- **THEN** 畫面上沒有「使用 Google 帳號繼續」，也沒有「或」分隔線
- **AND** 卡片標題區之後的第一個控制項是 Email 欄，其餘照常顯示

#### Scenario: 點忘記密碼前往重設

- **WHEN** 使用者在登入頁點「忘記密碼？」
- **THEN** 瀏覽器前往 `/account/forgot-password`

#### Scenario: 點前往註冊

- **WHEN** 這個部署有設定寄信服務，使用者在登入頁點「前往註冊」
- **THEN** 瀏覽器前往 `/account/register`

### Requirement: 送出前只檢查必填

登入表單 SHALL 在送出前只檢查兩欄必填：Email 去掉前後空白後為空、或密碼為空時擋下送出，在出問題的那一欄旁顯示必填說明；兩欄都為空時兩欄各自顯示。登入 MUST NOT 檢查 Email 格式或密碼組成規則。使用者在報錯的欄位重新輸入時，該欄的錯誤 SHALL 立刻消失。

來源：規格 01-01 §用 Email 與密碼登入 第 2–7 條；§卡控機制；§邊界情況；§已確認決議 Q8；Scenario「沒填 Email 就送出」「沒填密碼就送出」「兩欄都沒填」「只填空白字元的 Email」「重新輸入就清掉錯誤」。

#### Scenario: 沒填 Email 就送出

- **WHEN** 密碼已填、Email 空白，使用者點「登入」
- **THEN** Email 欄旁顯示必填的說明，停在登入頁，沒有送出任何登入請求

#### Scenario: 沒填密碼就送出

- **WHEN** Email 已填、密碼空白，使用者點「登入」
- **THEN** 密碼欄旁顯示必填的說明，停在登入頁，沒有送出任何登入請求

#### Scenario: 兩欄都沒填

- **WHEN** 兩欄都空白，使用者點「登入」
- **THEN** Email 欄與密碼欄旁各自顯示自己的必填說明

#### Scenario: 只填空白字元的 Email

- **WHEN** Email 只有空白字元、密碼已填，使用者點「登入」
- **THEN** Email 欄旁顯示必填的說明，沒有送出任何登入請求

#### Scenario: 重新輸入就清掉錯誤

- **WHEN** Email 欄正顯示必填的說明，使用者在 Email 欄輸入文字
- **THEN** 那一欄的錯誤立刻消失

### Requirement: 登入請求的欄位驗證

系統 SHALL 對 Email 與密碼登入請求只接受 `application/json` 的 body，恰好含 `email`（去掉前後空白後 1–320 字元）與 `password`（1–1024 字元，不去空白）；不符時回 `422 VALIDATION_FAILED`，逐欄列出錯誤且不回顯送出的值。Email 格式與密碼組成規則 MUST NOT 造成 `422`。

來源：規格 01-01 §資料欄位、§已確認決議 Q8；api-agent-rules A2、A7；`api-contract.md` §createSession。

#### Scenario: 空白 Email 回 422 且不回顯密碼

- **WHEN** 呼叫端送出 `POST /api/v1/sessions`，body 為 `{"email": "   ", "password": "CANARY-pw-1"}`
- **THEN** 系統回覆 `422`，`code` 為 `"VALIDATION_FAILED"`，`errors` 含一筆 `field` 為 `"email"` 的錯誤
- **AND** 回應 body 不含 `CANARY-pw-1`，也沒有設定任何 cookie

#### Scenario: 未宣告的欄位被拒收

- **WHEN** 呼叫端送出 `{"email": "a@example.com", "password": "x", "rememberMe": true}`
- **THEN** 系統回覆 `422`，`errors` 含一筆 `field` 為 `"rememberMe"`、`code` 為 `"extra_forbidden"` 的錯誤

#### Scenario: 不是 JSON 的 body 被拒收

- **WHEN** 呼叫端以 `Content-Type: application/x-www-form-urlencoded` 送出 `email=a%40example.com&password=x`
- **THEN** 系統回覆 `422`，`code` 為 `"VALIDATION_FAILED"`，`errors` 至少一筆 `location` 為 `"body"`

### Requirement: Email 與密碼對得上就開始一段登入狀態

Email 正規化後對到一個啟用中、未匿名化、有本地密碼的帳號，且密碼相符時，系統 SHALL 回 `201`、`Location: /api/v1/current-session`，設定登入憑證的 cookie，`data.user` 恰好含 `id`、`name`、`email`、`role` 四欄；登入 MUST NOT 檢查密碼組成規則。畫面 SHALL 隨後前往落點 `/dashboard/dashboard`。

來源：規格 01-01 §用 Email 與密碼登入 第 11 條、§登入頁 第 8 條；§已確認決議 Q7、Q8；規格 01-05 §Email 的識別規則；Scenario「登入成功進入儀表板」「登入不檢查密碼組成規則」「用大寫寫自己的 Email 登入」。

#### Scenario: 登入成功進入儀表板

- **WHEN** 啟用中的帳號 `user@example.com`（名稱「王小明」、系統角色平台成員）在登入頁填入正確的 Email 與密碼並點「登入」
- **THEN** 登入請求回覆 `201`，`data` 恰好是 `{"user": {"id": <字串>, "name": "王小明", "email": "user@example.com", "role": "user"}}`
- **AND** 回應設定 `__Host-ls_at`、`__Host-ls_rt`、`__Host-ls_csrf` 三個 cookie，body 中沒有任何 token
- **AND** 畫面以取代歷史紀錄的方式前往 `/dashboard/dashboard`

#### Scenario: 登入不檢查密碼組成規則

- **WHEN** 帳號的密碼只有 6 個小寫字元，使用者填對帳號與那個密碼並送出
- **THEN** 登入成功，沒有因為密碼不合註冊的組成規則被擋

#### Scenario: 用大寫寫自己的 Email 登入

- **WHEN** 帳號以 `user@example.com` 建立，使用者以 `USER@EXAMPLE.COM` 與正確密碼登入
- **THEN** 登入成功，`data.user.email` 為 `"user@example.com"`

### Requirement: 登入失敗一律同一句且不設憑證

帳號不存在、密碼不符、帳號停用、帳號已匿名化、帳號沒有本地密碼，或 Email 正規化後超過 254 字時，系統 SHALL 一律回 `401`、`code` 為 `ACCOUNT_INVALID_CREDENTIALS`、`message` 為同一句，`data` 與 `errors` 為 `null`，不設定任何登入憑證的 cookie；回應 MUST NOT 透露是哪一種原因。

來源：規格 01-01 §用 Email 與密碼登入 第 12 條、§卡控機制、§已確認決議 Q1、Q2；規格 01-05 §沒有本地密碼的帳號 第 2 條、§Email 的識別規則 第 4 條；Scenario「帳號或密碼不對」「停用的帳號無法登入」「沒有本地密碼的人只能用 Google」「正規化後超過上限就拒絕」。

#### Scenario: 帳號或密碼不對

- **WHEN** 使用者以不存在的 Email 登入一次、以存在帳號的錯誤密碼登入一次
- **THEN** 兩次都回覆 `401`、`code` 為 `"ACCOUNT_INVALID_CREDENTIALS"`，兩次的 `message` 完全相同
- **AND** 畫面卡片上方顯示「帳號或密碼錯誤，請再試一次」，停在登入頁

#### Scenario: 停用的帳號無法登入

- **WHEN** 帳號存在、密碼正確，但帳號是停用中的，使用者送出登入
- **THEN** 回覆與「帳號或密碼不對」相同：`401`、`code` 為 `"ACCOUNT_INVALID_CREDENTIALS"`、同一句 `message`
- **AND** 回應沒有 `Set-Cookie` 設定 `__Host-ls_at`、`__Host-ls_rt` 或 `__Host-ls_csrf`

#### Scenario: 已匿名化的帳號無法登入

- **WHEN** 帳號已匿名化，使用者以它原本的 Email 與密碼送出登入
- **THEN** 回覆與「帳號或密碼不對」相同

#### Scenario: 沒有本地密碼的人只能用 Google

- **WHEN** 帳號已連結 Google、沒有本地密碼，使用者以它的 Email 與任意密碼送出登入
- **THEN** 回覆與「帳號或密碼不對」相同，沒有任何文字說明這個帳號只能用 Google

#### Scenario: 正規化後超過上限就拒絕

- **WHEN** 使用者送出的 Email 正規化後為 255 字元（未超過請求欄位的 320 字元上限）
- **THEN** 系統回覆 `401`、`code` 為 `"ACCOUNT_INVALID_CREDENTIALS"`，不是 `422`

#### Scenario: 失敗回應不帶帳號資訊

- **WHEN** 以停用帳號的 Email 送出登入，取得回應 body
- **THEN** body 的頂層欄位恰好是 `success`、`code`、`message`、`data`、`timestamp`、`traceId`、`errors`，`data` 與 `errors` 為 `null`
- **AND** 序列化後的 body 不含該帳號的 Email、名稱或識別碼

### Requirement: 失敗後保留輸入並在任一欄輸入時收起訊息

登入失敗時畫面 SHALL 保留兩欄已填的內容；使用者在任一欄重新輸入時，失敗訊息 SHALL 消失。曾顯示過錯誤後再送出成功時，錯誤 SHALL 先清掉再進入送出中。

來源：規格 01-01 §用 Email 與密碼登入 第 13、14 條；§已確認決議 Q15；§邊界情況；Scenario「失敗時不清空已填的內容」「改在任一欄輸入就收起失敗訊息」「錯誤後再送出成功」。

#### Scenario: 失敗時不清空已填的內容

- **WHEN** 畫面剛顯示「帳號或密碼錯誤，請再試一次」
- **THEN** Email 欄與密碼欄的內容都還在

#### Scenario: 改在任一欄輸入就收起失敗訊息

- **WHEN** 畫面剛顯示「帳號或密碼錯誤，請再試一次」，使用者在密碼欄輸入文字
- **THEN** 失敗訊息消失

#### Scenario: 錯誤後再送出成功

- **WHEN** 畫面曾顯示必填的說明，使用者把兩欄填妥並以正確帳密點「登入」
- **THEN** 錯誤先消失，才進入送出中並前往落點

### Requirement: 送出中整頁凍結且只送出一次

兩欄通過必填檢查後，畫面 SHALL 進入送出中：「登入」按鈕停用並顯示進行中指示（輔助技術名稱為「載入中」／`Loading`），整頁其餘控制項（含語言切換、「忘記密碼？」、「前往註冊」、Google 按鈕）都不可互動；同一次送出只發出一個登入請求。

來源：規格 01-01 §用 Email 與密碼登入 第 8–10 條；§已確認決議 Q6、Q13；§卡控機制；§邊界情況；Scenario「送出中點語言切換沒反應」「送出中點底部連結沒反應」「送出中重複點擊只送出一次」「送出中的進行中指示有名稱」。

#### Scenario: 送出中點語言切換沒反應

- **WHEN** 兩欄都已填妥，使用者點「登入」後在回應前點語言切換
- **THEN** 介面語言沒有改變，頁面維持原狀

#### Scenario: 送出中點底部連結沒反應

- **WHEN** 這個部署有設定寄信服務，兩欄都已填妥，使用者點「登入」後在回應前點「前往註冊」
- **THEN** 沒有離開登入頁

#### Scenario: 送出中重複點擊只送出一次

- **WHEN** 兩欄都已填妥，使用者點「登入」後在回應前再連點「登入」三次
- **THEN** 只送出 1 個登入請求，成功後只導向一次

#### Scenario: 送出中的進行中指示有名稱

- **WHEN** 介面語言為繁體中文，兩欄都已填妥，使用者點「登入」後查看按鈕的進行中指示
- **THEN** 輔助技術讀到的名稱是「載入中」；介面語言為英文時是 `Loading`

### Requirement: 平台沒有回應時顯示可重試的說明

登入請求沒有收到有效回應（連線失敗、逾時、回應不是錯誤外層，或 `5xx`）時，畫面 SHALL 在錯誤橫幅顯示可重試的說明，並保留兩欄內容、結束送出中。

來源：規格 01-01 §用 Email 與密碼登入 第 16 條；§邊界情況；§已確認決議 Q1、Q13；Scenario「送出後平台沒有回應」。

#### Scenario: 送出後平台沒有回應

- **WHEN** 兩欄都已填妥，使用者點「登入」後平台沒有回應
- **THEN** 錯誤橫幅顯示「平台暫時沒有回應，請稍後再試。」（英文介面為 `The platform is not responding. Please try again later.`）
- **AND** 兩欄的內容都還在，「登入」按鈕恢復可點

#### Scenario: 伺服器錯誤也顯示同一句

- **WHEN** 登入請求收到 `500` 錯誤外層
- **THEN** 錯誤橫幅顯示「平台暫時沒有回應，請稍後再試。」，不顯示「帳號或密碼錯誤，請再試一次」

### Requirement: 密碼欄可切換顯示

密碼欄 SHALL 預設遮住內容，右側切換按鈕可在顯示與遮住之間切換，按鈕的說明文字隨目前狀態改變；切換語言時密碼的顯示狀態不變。

來源：規格 01-01 §用 Email 與密碼登入 第 17–20 條；§邊界情況；Scenario「密碼可切換顯示」「密碼再點一次變回遮住」「密碼顯示中切換語言」。

#### Scenario: 密碼可切換顯示

- **WHEN** 密碼欄有內容且遮住，使用者點切換顯示的按鈕
- **THEN** 密碼變成看得見，按鈕的說明文字跟著改

#### Scenario: 密碼再點一次變回遮住

- **WHEN** 密碼正顯示中，使用者再點切換顯示的按鈕
- **THEN** 密碼變回遮住，按鈕的說明文字跟著改

#### Scenario: 密碼顯示中切換語言

- **WHEN** 密碼正顯示中，使用者點語言切換
- **THEN** 密碼仍然顯示中，只有說明文字換語言

### Requirement: 開始 Google 登入

部署有設定 Google 時，系統 SHALL 讓未登入的訪客取得一次性的 Google 授權網址（`data.authorizationUrl`），並設定 10 分鐘的流程 cookie；沒有設定 Google 時 SHALL 回 `409 ACCOUNT_GOOGLE_UNAVAILABLE`。畫面點「使用 Google 帳號繼續」時以整頁導覽前往該網址；快速連點不出現錯誤畫面。

來源：規格 01-01 §用 Google 帳號登入 第 1、2 條；§邊界情況；§已確認決議 Q4；ADR-004 D4；Scenario「點 Google 帳號登入」「快速連點 Google 按鈕」。

#### Scenario: 點 Google 帳號登入

- **WHEN** 部署有設定 Google，使用者在登入頁點「使用 Google 帳號繼續」
- **THEN** 前端取得的 `data` 恰好含 `authorizationUrl` 一個欄位，網址指向 Google 的授權端點並帶 `state`、`nonce` 與 `code_challenge_method=S256`
- **AND** 回應設定 `__Host-ls_oidc` cookie，瀏覽器以整頁導覽前往該網址

#### Scenario: 快速連點 Google 按鈕

- **WHEN** 使用者在登入頁連續快速點「使用 Google 帳號繼續」三次
- **THEN** 畫面沒有出現錯誤，瀏覽器只前往一次 Google 的授權網址

#### Scenario: 沒有設定 Google 時拒絕開始

- **WHEN** 部署沒有設定 Google，呼叫端送出 `GET /api/v1/google-authorization`
- **THEN** 系統回覆 `409`，`code` 為 `"ACCOUNT_GOOGLE_UNAVAILABLE"`，沒有設定 `__Host-ls_oidc`

### Requirement: Google 登入只登入或連結既有帳號

完成 Google 登入時，系統 SHALL 先找已連結這個 Google 帳號的帳號，不看 Email 是否相同；沒有時，若 Google 回報 Email 已驗證且有 Email 相同、啟用中、未匿名化的既有帳號，SHALL 自動連結並登入（停用或已匿名化的不連結），不另外通知。成功回 `201`，`data` 欄位同 Email 與密碼登入。Google 登入 MUST NOT 建立帳號。

來源：規格 01-01 §用 Google 帳號登入 第 2、5 條；§已確認決議 Q11；規格 01-05 §沒有本地密碼的帳號 第 1、4 條、§四種改動讓所有裝置重新登入、§已確認決議 Q18；ADR-004 D5；Scenario「已連結 Google 的帳號 Email 不同仍能登入」「Google 登入自動連結既有帳號」。

#### Scenario: 已連結 Google 的帳號 Email 不同仍能登入

- **WHEN** 某個帳號已連結這個 Google 帳號，平台上的 Email 與 Google 回報的 Email 不同，使用者以這個 Google 帳號完成登入
- **THEN** 系統回覆 `201`，`data.user.email` 是平台上的 Email，畫面前往落點

#### Scenario: Google 登入自動連結既有帳號

- **WHEN** 平台上有 Email 相同、還沒連結過 Google 的啟用帳號，Google 回報這個 Email 已驗證，使用者以這個 Google 帳號完成登入
- **THEN** 系統回覆 `201`，畫面前往落點，沒有顯示任何連結的通知
- **AND** 之後以這個帳號原本的 Email 與密碼送出登入，回覆 `401 ACCOUNT_INVALID_CREDENTIALS`

#### Scenario: 自動連結讓這個帳號其他裝置的登入狀態失效

- **WHEN** 上一個 Scenario 的帳號在另一台裝置 B 已登入著，這一台以 Google 自動連結並登入
- **THEN** B 下一次送出 `GET /api/v1/current-session` 回覆 `401 AUTH_REQUIRED`，B 延續登入狀態回覆 `401 ACCOUNT_SESSION_INVALID`
- **AND** 這一台剛開始的登入狀態可以通行

#### Scenario: 停用的同 Email 帳號不會被自動連結

- **WHEN** 平台上有 Email 相同、還沒連結過 Google、但已停用的帳號，Google 回報這個 Email 已驗證，使用者以這個 Google 帳號完成登入
- **THEN** 系統回覆 `401 ACCOUNT_GOOGLE_REJECTED`
- **AND** 該帳號的 Google 連結仍為空，本地密碼沒有被清掉

#### Scenario: Google 登入不建立帳號

- **WHEN** 任一次 Google 登入完成（成功或被拒）
- **THEN** 帳號總數與完成前相同

### Requirement: Google 登入被拒一律同一句

沒有帳號連結這個 Google 帳號且（沒有 Email 相同的既有帳號，或 Google 回報 Email 未驗證），或對應的帳號已停用、已匿名化時，系統 SHALL 一律回 `401 ACCOUNT_GOOGLE_REJECTED`、同一句 `message`，不建立帳號、不設登入憑證；畫面 SHALL 回到登入頁，以錯誤橫幅顯示同一句，不導向註冊，也不因有沒有設定寄信服務而換句子。

來源：規格 01-01 §用 Google 帳號登入 第 4 條、§卡控機制、§邊界情況、§已確認決議 Q12；規格 01-05 §已確認決議 Q18；Scenario「Google 帳號沒有對應的平台帳號」「Google 回報 Email 未驗證」「沒有設定寄信服務時 Google 沒有對應帳號仍是同一句」「停用的帳號用 Google 登入」「匿名化的帳號用 Google 登入」。

#### Scenario: Google 帳號沒有對應的平台帳號

- **WHEN** 沒有任何帳號連結這個 Google 帳號，平台上也沒有 Email 相同的既有帳號，使用者以這個 Google 帳號完成登入
- **THEN** 系統回覆 `401`、`code` 為 `"ACCOUNT_GOOGLE_REJECTED"`，沒有建立任何帳號
- **AND** 畫面回到 `/account/login`，錯誤橫幅顯示「無法用這個 Google 帳號登入。需要帳號的話，請聯絡系統管理員邀請你。」，沒有導向註冊頁

#### Scenario: Google 回報 Email 未驗證

- **WHEN** 沒有任何帳號連結這個 Google 帳號，平台上有 Email 相同的帳號，但 Google 回報這個 Email 沒有驗證
- **THEN** 回覆與「Google 帳號沒有對應的平台帳號」相同的碼與同一句，畫面沒有任何文字說明是未驗證，該帳號沒有被連結

#### Scenario: 沒有設定寄信服務時 Google 沒有對應帳號仍是同一句

- **WHEN** 這個部署沒有設定寄信服務，沒有任何帳號連結這個 Google 帳號，平台上也沒有 Email 相同的既有帳號，使用者以這個 Google 帳號完成登入
- **THEN** 畫面顯示同一句「無法用這個 Google 帳號登入。需要帳號的話，請聯絡系統管理員邀請你。」，沒有提到註冊

#### Scenario: 停用的帳號用 Google 登入

- **WHEN** 已連結這個 Google 帳號的帳號是停用中的，使用者以這個 Google 帳號完成登入
- **THEN** 回覆與「Google 帳號沒有對應的平台帳號」相同的碼與同一句，沒有進入平台

#### Scenario: 匿名化的帳號用 Google 登入

- **WHEN** 已連結這個 Google 帳號的帳號已匿名化，使用者以這個 Google 帳號完成登入
- **THEN** 回覆與「Google 帳號沒有對應的平台帳號」相同的碼與同一句，沒有進入平台

#### Scenario: 被拒的回應不帶原因

- **WHEN** 分別以上述五種情況完成 Google 登入，取得五個回應 body
- **THEN** 五個回應的 `code` 與 `message` 都相同，`data` 與 `errors` 為 `null`，都不含任何 Email 或帳號識別碼

### Requirement: Google 驗證沒通過時安靜回到登入頁

使用者在 Google 那一側取消或驗證沒通過、流程 cookie 不在或過期、`state` 不符，或授權碼換不到有效身分時，畫面 SHALL 回到登入頁、不顯示錯誤，使用者可以改用 Email 與密碼登入；流程中的後端回應為 `400 ACCOUNT_GOOGLE_FLOW_INVALID`，並清掉流程 cookie。

來源：規格 01-01 §業務流程「用 Google 帳號登入」E1；Scenario「Google 驗證沒通過回到登入頁」；ADR-004 D4。

#### Scenario: Google 驗證沒通過回到登入頁

- **WHEN** 使用者在 Google 那一側取消，Google 帶著 `error` 回到 `/account/google/callback`
- **THEN** 畫面以取代歷史紀錄的方式回到 `/account/login`，沒有錯誤橫幅，沒有送出完成 Google 登入的請求

#### Scenario: state 不符時回 400

- **WHEN** 呼叫端送出 `POST /api/v1/google-sessions`，body 的 `state` 與流程 cookie 內的不同
- **THEN** 系統回覆 `400`，`code` 為 `"ACCOUNT_GOOGLE_FLOW_INVALID"`，回應清掉 `__Host-ls_oidc`，沒有設定任何登入憑證的 cookie

#### Scenario: 同一組回調只送出一次

- **WHEN** Google 帶著 `code` 與 `state` 回到 `/account/google/callback`，頁面被掛載兩次
- **THEN** 完成 Google 登入的請求只送出 1 次

### Requirement: 登入頁的語言切換

登入頁 SHALL 讓使用者在繁體中文與英文之間即時切換，不必重新整理；切換時整頁文字、圖示型控制項的說明文字、`<html lang>` 與瀏覽器頁籤標題一起換，欄位錯誤先清掉。語言切換鈕只顯示目前語言的代號（`ZH`／`EN`），其說明文字 MUST 包含該代號。

來源：規格 01-01 §語言切換 第 1、2、4 條；§登入頁 第 5 條；§已確認決議 Q14；Scenario「語言切換鈕只顯示代號」「語言切換鈕的說明文字包含代號」「Google 按鈕的文字隨語言切換」「切換語言整頁即時更新」「切換語言可以切回來」「切換語言會清掉欄位錯誤」。

#### Scenario: 語言切換鈕只顯示代號

- **WHEN** 介面語言為繁體中文，查看頁首的語言切換鈕
- **THEN** 鈕上可見文字只有 `ZH`

#### Scenario: 語言切換鈕的說明文字包含代號

- **WHEN** 介面語言為繁體中文，語言切換鈕上顯示 `ZH`，讀取它的無障礙名稱
- **THEN** 無障礙名稱包含 `ZH`

#### Scenario: Google 按鈕的文字隨語言切換

- **WHEN** 部署有設定 Google，介面語言為繁體中文，使用者切換為英文
- **THEN** 按鈕文字變成 `Continue with Google`，說明文字一起換

#### Scenario: 切換語言整頁即時更新

- **WHEN** 介面語言為繁體中文，使用者點語言切換
- **THEN** 標題、欄位標籤、按鈕文字都變成英文，瀏覽器標題變成「Label Suite — Sign In」，`<html lang>` 為 `en`，頁面沒有重新載入

#### Scenario: 切換語言可以切回來

- **WHEN** 介面語言為英文，使用者點語言切換
- **THEN** 全部文字與說明文字都回到繁體中文，瀏覽器標題為「Label Suite — 登入」

#### Scenario: 切換語言會清掉欄位錯誤

- **WHEN** Email 欄正顯示必填的說明，使用者點語言切換
- **THEN** 錯誤消失

### Requirement: 登入頁在三種螢幕寬度都能完整操作

登入頁 SHALL 在手機、平板與桌機寬度都看得完整、每個控制項都點得到，不出現文字重疊、控制項被遮住或左右捲動。

來源：規格 01-01 §不同螢幕寬度的呈現；Scenario「桌機能完整操作登入頁」「平板能完整操作登入頁」「手機能完整操作登入頁」。

#### Scenario: 桌機能完整操作登入頁

- **WHEN** 以 1280×800 的視窗開啟登入頁
- **THEN** 頁面沒有水平捲軸，每個控制項都在可視範圍內且可點擊

#### Scenario: 平板能完整操作登入頁

- **WHEN** 以 768×1024 的視窗開啟登入頁
- **THEN** 頁面沒有水平捲軸，每個控制項都在可視範圍內且可點擊

#### Scenario: 手機能完整操作登入頁

- **WHEN** 以 375×667 的視窗開啟登入頁
- **THEN** 頁面沒有水平捲軸，卡片內的欄位、按鈕與文字都沒有超出卡片
