## Purpose

定義所有功能共用的寄信能力的可測行為：當場寄與排入背景兩種寄法、沒有設定寄信服務時不寄、失敗的分類與有界重試、冪等、最終失敗的紀錄方式、排不進佇列時的回報，以及信件內容、收件者與測試集答案都不進入紀錄，讓註冊、邀請與換 Email 等消費者共用同一套寄信規則。

## ADDED Requirements

### Requirement: 信件在交出時驗證欄位

呼叫端交給寄信能力的每封信 SHALL 由收件者、主旨、純文字內文、可選的 HTML 內文與種類組成，交出時即驗證：收件者正規化後 MUST 不超過 254 字元；主旨 MUST 為 1 到 200 字元且 MUST NOT 含 CR 或 LF；純文字內文 MUST 不為空；種類 MUST 符合 `^[a-z][a-z0-9_]{0,31}$`。驗證不通過時 MUST 當場拒絕，不排入佇列、不呼叫寄信服務，錯誤 MUST NOT 帶欄位值。設定的寄件人 `MAIL_FROM` 同樣 MUST NOT 含 CR 或 LF，含時服務與 worker MUST 拒絕啟動。種類只用於紀錄，與任務類型無關。

來源：`AGENTS.md` Hard Rule 9；backend-agent-rules B10；security-agent-rules S9；`system-design.md` §元件與職責（信件）；clarification 技術預設「語言參數」。

#### Scenario: 主旨含換行時拒絕

- **WHEN** 呼叫端以主旨 `Hello\r\nBcc: CANARY-inject@example.com` 交出一封信，分別以當場寄與排入背景兩種寄法
- **THEN** 兩次都當場拒絕，佇列沒有收到任何工作，寄信服務的替身沒有收到任何請求
- **AND** 拒絕的錯誤文字不含 `CANARY-inject`

#### Scenario: 寄件人設定含換行時拒絕啟動

- **WHEN** 以合法的 `CORS_ALLOWED_ORIGINS`、`RESEND_API_KEY=re_test` 與 `MAIL_FROM` 為 `noreply@example.test\r\nBcc: CANARY-inject@example.com`，分別啟動服務與載入 worker 的設定
- **THEN** 兩者都拒絕啟動，錯誤訊息含 `MAIL_FROM`，且不含 `CANARY-inject`

#### Scenario: 種類不合格式時拒絕

- **WHEN** 呼叫端分別以種類 `Signup`、`1invite`、空字串與 33 個字元的 `a` 交出信
- **THEN** 四次都當場拒絕

#### Scenario: 收件者過長或內文為空時拒絕

- **WHEN** 呼叫端分別以正規化後 255 字元的收件者、空字串的純文字內文交出信
- **THEN** 兩次都當場拒絕

#### Scenario: 合格的信被接受

- **WHEN** 呼叫端以收件者 `User@Example.com`、主旨 `歡迎`、純文字內文 `body`、不帶 HTML、種類 `signup_verify` 交出信
- **THEN** 驗證通過，信件的收件者為正規化後的 `user@example.com`

### Requirement: 沒有設定寄信服務時不嘗試寄信

這個部署沒有設定寄信服務時，當場寄與排入背景 SHALL 都回報「沒有設定」，MUST NOT 連線佇列、MUST NOT 呼叫寄信服務、MUST NOT 產生信件識別碼。寄信能力 MUST NOT 自行把信件內容或連結寫進任何紀錄。

來源：issue #756 §驗收條件 3；ADR-008 D3；backend-agent-rules B10；主規格 `runtime-config`「寄信服務只看有沒有設定」；clarification Q5、Q6。

#### Scenario: 沒有設定寄信服務時不嘗試寄信

- **WHEN** `RESEND_API_KEY` 與 `MAIL_FROM` 都不設，佇列位址指向一個沒有服務在聽的埠，呼叫端以內文含 `CANARY-link` 的信分別以當場寄與排入背景交出
- **THEN** 兩次都回報「沒有設定」，信件識別碼為空，沒有丟出錯誤
- **AND** 寄信服務的替身沒有收到任何請求，也沒有任何對佇列位址的連線嘗試
- **AND** 這段期間的全部紀錄輸出都不含 `CANARY-link`

### Requirement: 排入背景的信由背景工作寄出

有設定寄信服務時，排入背景 SHALL 產生一個新的信件識別碼（UUID4）、把信送進 `default` 佇列，回報「已排入」與該識別碼。背景工作取出後 SHALL 再判斷一次有沒有設定寄信服務，有設定就呼叫寄信服務一次；寄信服務接受時寫一行結果為 `sent` 的紀錄。工作內容 MUST 只以 JSON 編碼，背景工作程序 MUST 拒絕其他編碼的工作。

來源：issue #756 §驗收條件 2；ADR-003 D8；backend-agent-rules B9；`architecture.mdx` §非同步任務；clarification Q1。

#### Scenario: 排入背景工作的信寄出成功

- **WHEN** 有設定寄信服務，呼叫端以排入背景交出一封合格的信，背景工作取出並執行，寄信服務的替身回 `200` 與訊息 id `provider-1`
- **THEN** 呼叫端得到「已排入」與一個 UUID4 格式的信件識別碼，工作送進的佇列是 `default`
- **AND** 替身恰好收到一次寄信請求，請求帶有設定的寄件人、收件者、主旨、純文字內文
- **AND** 背景工作寫出一行 `outcome=sent`、`attempt=1`、`mailId` 等於該識別碼的紀錄

#### Scenario: 工作內容可以 JSON 序列化

- **WHEN** 呼叫端以排入背景交出一封帶 HTML 內文的信
- **THEN** 送進佇列的工作參數以 JSON 編碼後再解碼，得到與原信相同的五個欄位與同一個信件識別碼

#### Scenario: 非 JSON 編碼的工作被拒絕

- **WHEN** 讀取背景工作程序的序列化設定，並以該設定解碼一則以 pickle 編碼的工作內容
- **THEN** 工作編碼與可接受的內容類型都只有 JSON，解碼以「內容類型不被接受」被拒絕，沒有任何工作被執行

### Requirement: 暫時性失敗以有界次數重試

背景工作遇到連線錯誤、逾時、`429` 或 `5xx` 時 SHALL 視為暫時性失敗並重試，第 1、2、3 次重試分別在 60、180、540 秒後；最多重試 3 次，總共最多嘗試 4 次。每次重試寫一行結果為 `retry` 的紀錄。

來源：backend-agent-rules B9；clarification 技術預設「重試政策與重複寄送」。

#### Scenario: 暫時性失敗後重試寄出

- **WHEN** 背景工作第一次呼叫寄信服務時替身回 `503`，第二次回 `200`
- **THEN** 第一次失敗後排定 60 秒後重試，寫一行 `outcome=retry`、`attempt=1`、`reason=status_503` 的紀錄
- **AND** 第二次寄出成功，寫一行 `outcome=sent`、`attempt=2` 的紀錄

#### Scenario: 連線錯誤、逾時與 429 都會重試

- **WHEN** 替身分別以連線錯誤、逾時與 `429` 回應第一次寄信請求
- **THEN** 三種情況都排定重試，紀錄的 `reason` 依序為 `connect_error`、`timeout`、`status_429`

#### Scenario: 重試間隔依序為 60、180、540 秒

- **WHEN** 替身對同一封信每次都回 `503`
- **THEN** 三次重試排定的延遲依序為 60、180、540 秒

### Requirement: 同一封信的每次嘗試帶同一個冪等鍵

每一次對寄信服務的請求 SHALL 帶 `Idempotency-Key` 標頭，值等於該信的信件識別碼；同一封信的重試 MUST 帶同一個值，不同的信 MUST 帶不同的值。

來源：backend-agent-rules B9（冪等）；clarification 技術預設「重試政策與重複寄送」。

#### Scenario: 重試帶同一個冪等鍵

- **WHEN** 一封信第一次寄送遇 `503`、重試後成功
- **THEN** 替身收到的兩次請求的 `Idempotency-Key` 相同，且等於呼叫端拿到的信件識別碼

#### Scenario: 不同的信帶不同的冪等鍵

- **WHEN** 呼叫端以排入背景先後交出兩封內容相同的信
- **THEN** 替身收到的兩次請求的 `Idempotency-Key` 不同

### Requirement: 永久性失敗與重試用盡記為最終失敗

寄信服務回 `429` 以外的 `4xx`、重試用盡，或背景工作端判斷沒有設定寄信服務時，背景工作 SHALL 記為最終失敗：不再重試，只寫一行結果為 `failed` 的紀錄，`reason` 分別為 `status_<狀態碼>`、`retries_exhausted`、`not_configured_in_worker`，且 MUST NOT 印出連結。寄信工作不論成敗都 MUST NOT 開啟資料庫連線、MUST NOT 存入工作結果儲存區；這是 B9「結果寫進資料庫」的例外。

來源：backend-agent-rules B9；ADR-008 D3、D4；security-agent-rules S9；clarification Q2、Q3。

#### Scenario: 重試用盡記為最終失敗

- **WHEN** 替身對同一封內文含 `CANARY-link` 的信每次都回 `503`，背景工作執行完第 4 次嘗試
- **THEN** 不再排定重試，寫一行 `outcome=failed`、`attempts=4`、`reason=retries_exhausted` 的 `ERROR` 紀錄
- **AND** 全部紀錄輸出都不含 `CANARY-link`

#### Scenario: 永久性失敗不重試

- **WHEN** 替身分別以 `401`、`403`、`422` 回應第一次寄信請求
- **THEN** 三種情況都不排定重試，各寫一行 `outcome=failed`、`attempts=1`、`reason` 依序為 `status_401`、`status_403`、`status_422` 的紀錄

#### Scenario: 背景工作端沒有設定寄信服務時記為最終失敗

- **WHEN** 一封信排入時有設定寄信服務，背景工作執行時的設定沒有寄信服務
- **THEN** 替身沒有收到請求，背景工作寫一行 `outcome=failed`、`reason=not_configured_in_worker` 的紀錄，不排定重試

#### Scenario: 最終失敗不寫資料庫也不存工作結果

- **WHEN** 一封信以任一原因記為最終失敗，或寄出成功
- **THEN** 這段期間沒有開啟任何資料庫連線，工作結果儲存區中沒有該工作的結果

### Requirement: 當場寄只嘗試一次並當場回報

有設定寄信服務時，當場寄 SHALL 產生信件識別碼並呼叫寄信服務恰好一次，寄信服務接受時回報「寄出」，任何失敗（含暫時性失敗）回報「寄不出」，兩者都帶信件識別碼；MUST NOT 重試，MUST NOT 經過佇列，寄不出時 MUST NOT 印出連結。當場寄 MUST NOT 阻塞處理其他請求的事件迴圈。

來源：clarification Q1、Q2；ADR-008 D3；規格 06-01 §邀請新帳號 E1b、規格 01-04 Q23（消費端參照）。

#### Scenario: 當場寄出並回報結果

- **WHEN** 有設定寄信服務，呼叫端以當場寄交出一封信，替身回 `200`
- **THEN** 呼叫端得到「寄出」與一個 UUID4 格式的信件識別碼，替身恰好收到一次請求，佇列沒有收到工作
- **AND** 寫一行 `outcome=sent`、`mode=now` 的紀錄

#### Scenario: 當場寄遇暫時性失敗也不重試

- **WHEN** 有設定寄信服務，呼叫端以當場寄交出一封內文含 `CANARY-link` 的信，替身回 `503`
- **THEN** 呼叫端得到「寄不出」與信件識別碼，替身恰好收到一次請求，沒有排定任何重試
- **AND** 全部紀錄輸出都不含 `CANARY-link`

#### Scenario: 當場寄執行時其他請求照常回應

- **WHEN** 當場寄的替身延遲 2 秒才回應，期間另一個請求呼叫 `GET /api/v1/health`
- **THEN** 健康檢查在當場寄完成之前就回覆 `200`

### Requirement: 排不進佇列時明確回報

有設定寄信服務但佇列無法連線時，排入背景 SHALL 在 10 秒內以「佇列無法使用」的錯誤回報給呼叫端，MUST NOT 自動改成當場寄，MUST NOT 呼叫寄信服務。錯誤 MUST NOT 帶任何文字，紀錄 MUST NOT 含佇列位址與信件內容。呼叫端 MUST NOT 靜默吞掉這個錯誤。

來源：backend-agent-rules B4（不得靜默吞掉）；ADR-003 D8；security-agent-rules S9；clarification Q4。

#### Scenario: 佇列無法連線時排入失敗

- **WHEN** 有設定寄信服務，佇列位址為 `redis://:CANARY-pw@127.0.0.1:1`（關閉的埠，帶一組帳密 canary），呼叫端以排入背景交出一封信
- **THEN** 呼叫端在 10 秒內收到「佇列無法使用」的錯誤，錯誤的文字為空
- **AND** 寄信服務的替身沒有收到任何請求
- **AND** 寫一行 `outcome=queue_unavailable` 的 `WARNING` 紀錄，全部紀錄輸出都不含 `CANARY-pw`

### Requirement: 寄信紀錄只寫允許的欄位

寄信能力與背景工作寫出的每一筆紀錄 SHALL 只含信件識別碼（`mailId`）、種類（`kind`）、次數（`attempt`、`attempts`）、結果（`outcome`）、寄法（`mode`）、固定字彙的原因（`reason`）、例外型別（`excType`）與寄信服務的訊息 id；MUST NOT 含收件者（完整或遮蔽後，含網域）、主旨、內文、連結、寄件人、金鑰、寄信服務回應的本文與佇列位址。背景工作框架自己寫出的紀錄（收到工作、重試、失敗）也 MUST NOT 含這些內容。

來源：issue #756 §驗收條件 2；security-agent-rules S9；clarification Q3、Q5。

#### Scenario: 五條路徑的紀錄都不含信件內容

- **WHEN** 以 `LOG_LEVEL=DEBUG`、收件者 `canary-to@canary-domain.example`、主旨 `CANARY-subject`、內文 `CANARY-body CANARY-link`、寄信服務錯誤回應本文 `CANARY-provider`、金鑰 `re_CANARY-key`，依序走過寄出成功、暫時性失敗後重試、重試用盡、沒有設定、排不進佇列五條路徑
- **THEN** API 端與背景工作端的全部紀錄輸出都不含 `canary-to`、`canary-domain`、`CANARY-subject`、`CANARY-body`、`CANARY-link`、`CANARY-provider`、`CANARY-key`

#### Scenario: 原因只用固定字彙

- **WHEN** 收集上一個 Scenario 中所有帶 `reason=` 的紀錄
- **THEN** 每一個 `reason` 值都屬於 `status_<三位數字>`、`timeout`、`connect_error`、`retries_exhausted`、`not_configured_in_worker` 之一

### Requirement: 未寄出的連結只走專用管道

是否把未寄出的連結交給部署者 SHALL 由呼叫端決定；寄信能力 SHALL 提供一條專用管道，寫進 logger `app.mail.unsent_link`，該 logger MUST NOT 傳遞給一般紀錄管道。寄信能力 MUST NOT 自行呼叫這條管道。只有「沒有設定寄信服務」時這條管道才適用；設定了但寄不出時連結 MUST NOT 寫進任何紀錄。

來源：ADR-008 D3；security-agent-rules S9 反例；backend-agent-rules B4、B10；clarification Q2、Q5。

#### Scenario: 專用管道的連結不出現在一般紀錄

- **WHEN** 呼叫端經專用管道記下種類 `account_invite`、連結 `https://example.test/set-password?t=CANARY-token`，同時有一個接在一般紀錄管道（root logger）上的收集器
- **THEN** 專用管道的輸出含 `CANARY-token`，`logger` 為 `app.mail.unsent_link`
- **AND** 一般紀錄管道的收集器沒有收到含 `CANARY-token` 的紀錄

#### Scenario: 寄信能力不自行使用專用管道

- **WHEN** 沒有設定寄信服務，呼叫端以兩種寄法交出內文含 `CANARY-link` 的信，但沒有使用專用管道
- **THEN** 專用管道沒有任何輸出

### Requirement: 信件參數與紀錄不含測試集答案

寄信工作的參數 SHALL 只有信件識別碼與信件的五個內容欄位，MUST NOT 含任何資料庫識別碼，背景工作 MUST NOT 依參數回頭讀取業務資料，因此不做 B9「在自己的行程裡重新查權限與資料版本」。寄信參數、信件內容與寄信紀錄 MUST NOT 含標準答案或測試集辨識資訊；每個寄信的消費者 change 在其 clarification 第 10 面向對信件內容負責。

來源：`AGENTS.md` Hard Rule 6；security-agent-rules S6；backend-agent-rules B9；clarification §檢查結論「測試集答案不外露」。

#### Scenario: 寄信參數只有信件識別碼與內容欄位

- **WHEN** 呼叫端以排入背景交出一封信，讀取送進佇列的工作參數
- **THEN** 參數的鍵恰為信件識別碼與收件者、主旨、純文字內文、HTML 內文、種類，沒有其他鍵

#### Scenario: 寄信入口到不了測試集答案

- **WHEN** 寄信能力的程式 import 任一業務模組（例如保存測試集答案的模組），執行後端分層檢查
- **THEN** 檢查以非 0 結束，指出「Mail entry does not import modules」被違反

#### Scenario: 寄信能力不新增標記員能到達的端點

- **WHEN** 比較本 change 前後匯出的 `openapi.json`
- **THEN** 兩者位元組相同，沒有新增任何端點
