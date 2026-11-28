# auth-guard Specification

## Purpose

定義之後每個模組共用的身分判定（授權四步的第 1、2 步）與畫面端的頁面守門：每一次操作都以資料庫當下的登入狀態、帳號狀態與系統角色判定，不能通行時一律同一個回應；畫面依判定結果導向登入頁或落點。

## Requirements

### Requirement: 查詢目前的登入狀態

已登入的呼叫端 SHALL 能以 `GET /api/v1/current-session` 取得自己的身分，回 `200`，`data.user` 恰好含 `id`、`name`、`email`、`role` 四欄，`role` 是這一次從資料庫讀到的系統角色（`user` 或 `super_admin`；Seeder 管理員也是 `super_admin`）。身分 MUST 只來自 `__Host-ls_at` cookie，不讀 `Authorization` 標頭或 query。

來源：規格 01-05 §每一次操作都用最新的身分判定；ADR-004 D1、D2；security-agent-rules S1、S3；PRD §使用者角色 §角色清單；`api-contract.md` §getCurrentSession。

#### Scenario: 平台成員查到自己的身分

- **WHEN** 以平台成員 `user@example.com`（名稱「王小明」）的登入 cookie 送出 `GET /api/v1/current-session`
- **THEN** 系統回覆 `200`，`data` 恰好是 `{"user": {"id": <字串>, "name": "王小明", "email": "user@example.com", "role": "user"}}`
- **AND** 回應中沒有 `hashedPassword`、`googleSubject`、`credentialVersion`、`isSeeder`、`isActive` 或任何登入狀態識別碼

#### Scenario: Seeder 管理員的角色是系統管理員

- **WHEN** 以初始化指令建立的 Seeder 管理員登入後送出 `GET /api/v1/current-session`
- **THEN** `data.user.role` 為 `"super_admin"`，回應中沒有任何欄位標示他是 Seeder

#### Scenario: 只認 cookie 不認 Authorization 標頭

- **WHEN** 沒有登入 cookie，但帶 `Authorization: Bearer <一張有效的 access token>` 送出 `GET /api/v1/current-session`
- **THEN** 系統回覆 `401`，`code` 為 `"AUTH_REQUIRED"`

### Requirement: 不能通行時一律同一個回應

登入狀態不存在、已失效、屬於另一個帳號、已過 90 天或 7 天，帳號停用或已匿名化，憑證版本不符，或沒有、無效、過期的 access cookie 時，需要登入的操作 SHALL 一律回 `401`、`code` 為 `AUTH_REQUIRED`、同一句 `message`，`data` 與 `errors` 為 `null`；回應 MUST NOT 透露是哪一種原因、登入狀態屬於誰或帳號的任何資訊。守門的預設是拒絕。

來源：規格 01-05 §不能通行的登入狀態不說明原因 第 1–3 條、§卡控機制；ADR-004 D2；security-agent-rules S1、S3；Scenario「不能通行的登入狀態不說明原因」。

#### Scenario: 不能通行的登入狀態不說明原因

- **WHEN** 分別以沒有 cookie、被竄改簽章的 access cookie、已登出那一段的 access cookie、別的帳號已失效那一段的 access cookie 送出 `GET /api/v1/current-session`
- **THEN** 四次都回覆 `401`，`code` 都是 `"AUTH_REQUIRED"`，`message` 都相同
- **AND** 四個回應 body 的 `data` 與 `errors` 都為 `null`，序列化後都不含任何 Email、名稱或識別碼

#### Scenario: 未登入時受保護的操作回 401

- **WHEN** 沒有任何 cookie 的呼叫端送出 `GET /api/v1/current-session`
- **THEN** 系統回覆 `401`，`code` 為 `"AUTH_REQUIRED"`

### Requirement: 每一次操作都用當下的帳號狀態與系統角色

需要登入的操作 SHALL 每一次都從資料庫讀當下的帳號狀態與系統角色，不沿用登入時或憑證內的值。系統角色變更 MUST NOT 讓登入狀態失效，下一次操作就以新角色判定；帳號停用時該帳號所有登入狀態的下一次操作都被拒絕；憑證版本已變更的登入狀態 MUST 被拒，所以重新啟用不會恢復停用前的登入狀態（停用時加一憑證版本並撤銷屬 06-01）。

來源：規格 01-05 §每一次操作都用最新的身分判定 第 1–3 條、§帳號被停用或重新啟用 第 1–4 條、§已確認決議 Q10、Q11；security-agent-rules S3、S4；Scenario「角色變更從下一次操作起生效」「停用帳號讓所有裝置立刻失效」「重新啟用不恢復舊的登入狀態」。

#### Scenario: 角色變更從下一次操作起生效

- **WHEN** 系統管理員已登入，他的系統角色在資料庫改為平台成員後，他以同一組 cookie 送出 `GET /api/v1/current-session`
- **THEN** 系統回覆 `200`，`data.user.role` 為 `"user"`，登入狀態沒有失效

#### Scenario: 停用帳號讓所有裝置立刻失效

- **WHEN** 帳號在裝置 A、B 都登入著，帳號在資料庫被標為停用
- **THEN** A 與 B 下一次送出 `GET /api/v1/current-session` 都回覆 `401 AUTH_REQUIRED`
- **AND** 以這個帳號的 Email 與密碼重新登入回覆 `401 ACCOUNT_INVALID_CREDENTIALS`，用已連結的 Google 帳號登入回覆 `401 ACCOUNT_GOOGLE_REJECTED`

#### Scenario: 重新啟用不恢復舊的登入狀態

- **WHEN** 帳號已登入，測試前置把它的 `credential_version` 加一、為它所有登入狀態寫入 `revoked_at`、標為停用，再標回啟用（模擬 06-01 的停用與重新啟用），以停用前的 cookie 送出 `GET /api/v1/current-session`
- **THEN** 系統回覆 `401 AUTH_REQUIRED`
- **AND** 以正確的 Email 與密碼重新登入成功

### Requirement: 畫面判定完成前不顯示任何頁面內容

開啟 `/`、需要登入的路由或只給未登入的人的路由時，畫面 SHALL 先查目前的登入狀態，判定完成前只顯示頁面底色，不顯示登入卡、落點內容或任何帳號資訊。需要登入與只給未登入的人兩種路由 MUST 共用同一份查詢結果。

來源：規格 01-01 §登入頁 第 9 條；規格 01-05 §已確認決議 Q11；ADR-004 D2；`ui-design.md` §元件樹 › 守門；dashboard-shell clarification「交給後續產出」（落點改為儀表板，判定中的負向檢查改看儀表板頁首）。

#### Scenario: 判定中不顯示內容

- **WHEN** 開啟 `/dashboard/dashboard`，目前登入狀態的查詢尚未回應
- **THEN** 畫面沒有主標題「儀表板」、沒有登入卡，也沒有任何名稱或 Email

#### Scenario: 兩種路由共用同一次查詢

- **WHEN** 已登入的使用者開啟 `/account/login`，被導向 `/dashboard/dashboard` 並顯示落點
- **THEN** 整個過程只送出 1 次 `GET /api/v1/current-session`

### Requirement: 未登入的訪客被帶回登入頁

沒有可通行登入狀態的訪客開啟需要登入的路由時，畫面 SHALL 以取代歷史紀錄的方式前往 `/account/login`，不帶原本要去的頁面；之後登入成功一律前往落點。

來源：規格 01-01 §登入頁 第 8 條、§已確認決議 Q7；規格 02-01 §業務流程「進入儀表板拿到自己的版面」E1；Issue #719 決定表 sa-10。

#### Scenario: 未登入開啟落點被帶回登入頁

- **WHEN** 沒有登入 cookie 的訪客開啟 `/dashboard/dashboard`
- **THEN** 網址變成 `/account/login`，沒有 query string，瀏覽器上一頁不會回到 `/dashboard/dashboard`
- **AND** 登入頁沒有錯誤橫幅

#### Scenario: 登入後一律去落點

- **WHEN** 訪客曾開啟某個需要登入的路由被帶回登入頁，接著以正確帳密登入
- **THEN** 畫面前往 `/dashboard/dashboard`

### Requirement: 已登入的人不會看到只給未登入的人的頁面

已有可通行登入狀態的人開啟 `/account/login` 或 `/account/google/callback` 時，畫面 SHALL 以取代歷史紀錄的方式前往 `/dashboard/dashboard`，不顯示登入頁。

來源：規格 01-01 §登入頁 第 9 條、§已確認決議 Q3；Scenario「已登入的人開登入頁直接進儀表板」；Issue #719 決定表 sa-5／7。

#### Scenario: 已登入的人開登入頁直接進儀表板

- **WHEN** 已登入的使用者直接開啟 `/account/login`
- **THEN** 網址變成 `/dashboard/dashboard`，畫面沒有出現登入卡，瀏覽器上一頁不會回到 `/account/login`

### Requirement: 根路徑與不存在的路徑依登入狀態導向

開啟 `/` 時，畫面 SHALL 依登入狀態以取代歷史紀錄的方式前往 `/dashboard/dashboard`（已登入）或 `/account/login`（未登入）。開啟沒有註冊的路徑時 SHALL 先前往 `/` 再依同一規則導向。

來源：規格 01-01 §登入頁 第 9 條；Issue #719 決定表 U7；規格 07-03 §兩種畫面的分工 第 1、5 條（找不到只涵蓋網址定址到的那一筆，不涵蓋沒有註冊的路徑；沒有註冊的路徑維持導向，見 denied-and-not-found clarification Q2）。

#### Scenario: 未登入開啟根路徑

- **WHEN** 沒有登入 cookie 的訪客開啟 `/`
- **THEN** 網址變成 `/account/login`
- **AND** 登入頁沒有錯誤橫幅

#### Scenario: 已登入開啟根路徑

- **WHEN** 已登入的使用者開啟 `/`
- **THEN** 網址變成 `/dashboard/dashboard`

#### Scenario: 不存在的路徑依登入狀態導向

- **WHEN** 沒有登入 cookie 的訪客開啟 `/no-such-page`
- **THEN** 網址變成 `/account/login`，瀏覽器上一頁不會回到 `/no-such-page`
- **AND** 登入頁沒有錯誤橫幅

### Requirement: 守門查詢失敗時當成未登入

目前登入狀態的查詢連線失敗、逾時、回應不是錯誤外層，或回 `5xx` 時，畫面 SHALL 當成未登入，前往 `/account/login` 並在錯誤橫幅顯示「平台暫時沒有回應，請稍後再試。」。查詢回 `200` 但 `data.user.role` 不是 `user` 或 `super_admin` 時，畫面 SHALL 同樣當成未登入：不顯示錯誤橫幅，MUST NOT 結束登入狀態（不送出 `DELETE /api/v1/current-session`）；只給未登入的人的路由與需要登入的路由對這個登入者的判定 MUST 一致。

來源：Issue #719 決定表 U6；規格 01-01 §用 Email 與密碼登入 第 16 條、§已確認決議 Q13；規格 02-01 §邊界情況「系統角色是空的或是未知的值」；clarification「不需維護者決定」表 sa-7、T-3；design D11。

#### Scenario: 守門查詢遇到伺服器錯誤

- **WHEN** 開啟 `/dashboard/dashboard`，`GET /api/v1/current-session` 回覆 `503` 錯誤外層
- **THEN** 網址變成 `/account/login`，錯誤橫幅顯示「平台暫時沒有回應，請稍後再試。」

#### Scenario: 守門查詢連不上

- **WHEN** 開啟 `/`，`GET /api/v1/current-session` 連線失敗
- **THEN** 網址變成 `/account/login`，錯誤橫幅顯示「平台暫時沒有回應，請稍後再試。」

#### Scenario: 角色無效時登入頁不被帶走

- **WHEN** 開啟 `/account/login`，`GET /api/v1/current-session` 回覆 `200`，`data.user.role` 為 `"guest"`
- **THEN** 網址停在 `/account/login`，沒有被帶到 `/dashboard/dashboard`，登入頁沒有錯誤橫幅
- **AND** 整個過程只送出 1 次 `GET /api/v1/current-session`，沒有送出 `DELETE /api/v1/current-session`

#### Scenario: 角色無效時根路徑導向登入頁

- **WHEN** 開啟 `/`，`GET /api/v1/current-session` 回覆 `200`，`data.user.role` 為 `"guest"`
- **THEN** 網址變成 `/account/login` 並停在那裡，登入頁沒有錯誤橫幅
- **AND** 整個過程沒有送出 `DELETE /api/v1/current-session`
