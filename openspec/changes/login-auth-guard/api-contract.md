# API Contract

本份是 change `login-auth-guard`（Issue #719）的前後端交接依據：七個新端點的路徑、operationId、request 與 response 欄位、錯誤碼、角色、欄位遮蔽與測試集答案隔離。分層與序列見 `system-design.md`，本份不重畫。

全部端點掛在 `/api/v1`，成功回應包一層 envelope `{ success, code, message, data, timestamp, traceId }`，下面各段的 Response 只寫 `data` 那一層。唯一的 envelope 例外是 `deleteCurrentSession` 的 `204`（無 body）。Google 登入不使用 `302`：授權網址以 JSON 回給前端，Google 回到前端的路由，前端再呼叫 `createGoogleSession`（`system-design.md` §技術待決 T1，協調者 2026-11-26 採用）。

每一處都已依維護者 2026-11-26 在 clarification 停點的決定寫成定案（[#719 的決定表](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)），本份沒有提案；決定與本份的對應見 [§維護者的決定](#維護者的決定)。

## 端點總覽

| Method   | Path                           | operationId              | 角色                                             | 異動 |
| :------- | :----------------------------- | :----------------------- | :----------------------------------------------- | :--- |
| `GET`    | `/api/v1/auth-options`         | `getAuthOptions`         | 不檢查（未登入也可呼叫）                         | 新增 |
| `POST`   | `/api/v1/sessions`             | `createSession`          | 不檢查（未登入的訪客送出登入）                   | 新增 |
| `GET`    | `/api/v1/current-session`      | `getCurrentSession`      | 已登入：平台成員、系統管理員（含 Seeder 管理員） | 新增 |
| `POST`   | `/api/v1/session-refreshes`    | `createSessionRefresh`   | 持有 refresh cookie 的人；不檢查系統角色         | 新增 |
| `DELETE` | `/api/v1/current-session`      | `deleteCurrentSession`   | 不檢查（登入狀態不能驗證時也要能清 cookie）      | 新增 |
| `GET`    | `/api/v1/google-authorization` | `getGoogleAuthorization` | 不檢查                                           | 新增 |
| `POST`   | `/api/v1/google-sessions`      | `createGoogleSession`    | 不檢查（持有流程 cookie 的人）                   | 新增 |

operationId 由 `generate_operation_id` 依「method 加 `/api/v1` 之後最後一個非參數路徑段」算出，不手寫：

- `ui-design.md` 預期的三個名字 `getCurrentSession`、`getAuthOptions`、`createSession` 都**沒有改**
- `auth-options` 的最後一個字 `options` 照預設規則會被單數化成 `option`（算出 `getAuthOption`），所以實作時要在 `backend/app/core/openapi.py` 的 `_IRREGULAR_SINGULARS` 加 `"options": "options"`（後端模組檢查清單的既有做法）
- 七個名字與既有的 `getHealth` 都不重複
- 路徑不插模組段（api-agent-rules A1），資源直接接在 `/api/v1` 後面；所以 `system-design.md` 圖中暫寫的 `/auth/...` 路徑以本表為準，`system-design.md` 與 `backend-modules.mdx` 已同步改成本表的路徑

### 共用約定

**Cookie**：後端一律經 `SessionCookies` 發與清，前端不讀、不寫 token（S2）。四個 cookie 都帶 `__Host-` 前綴（`Secure`、`Path=/`、沒有 `Domain`）。

| Cookie           | 內容                                                                                                               | `HttpOnly`                                    | `SameSite` | 存活                                                                 | 誰發                                                           |
| :--------------- | :----------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- | :--------- | :------------------------------------------------------------------- | :------------------------------------------------------------- |
| `__Host-ls_at`   | access JWT（`sub`、`sid`、`credential_version`、`role`、`iat`、`exp`；`exp` 至多 15 分鐘，且不越過登入起算 90 天） | 是                                            | `Lax`      | 與 refresh token 同時到期（讓 CSRF 驗證在 JWT 過期後仍讀得到 `sid`） | `createSession`、`createGoogleSession`、`createSessionRefresh` |
| `__Host-ls_rt`   | refresh token（不透明值，資料庫只存雜湊）                                                                          | 是                                            | `Lax`      | 至 refresh token 的 `expires_at`（至多 7 天，且不越過 90 天）        | 同上                                                           |
| `__Host-ls_csrf` | `HMAC(secret, sid)`                                                                                                | **否**（double-submit 的設計，S2 的唯一例外） | `Lax`      | 同 `__Host-ls_at`                                                    | 同上                                                           |
| `__Host-ls_oidc` | Google 登入流程的 `state`、`nonce`、PKCE verifier，經 `AUTH_SECRET` 衍生的金鑰簽章                                 | 是                                            | `Lax`      | 10 分鐘                                                              | `getGoogleAuthorization`；`createGoogleSession` 不論成敗都清掉 |

失敗的登入、延續與 `deleteCurrentSession` 會在回應裡清掉 `__Host-ls_at`、`__Host-ls_rt`、`__Host-ls_csrf`（`Max-Age=0`），各段另註明。

**CSRF**：`POST`、`PUT`、`PATCH`、`DELETE` 帶著 access cookie（`__Host-ls_at`）時，要帶標頭 `X-CSRF-Token`，值等於 `__Host-ls_csrf`，且等於 `HMAC(secret, sid)`；驗不過回 `403 CSRF_FAILED`。**沒有** access cookie 的寫入不驗，直接交給路由（`design.md` D3、`specs/csrf-protection`）。本次的四個寫入端點 `createSession`、`createGoogleSession`、`createSessionRefresh`、`deleteCurrentSession` **全部在放行清單**（理由見 `system-design.md` §技術待決 T2；維護者 2026-11-26 確認），清單寫死在 `CsrfMiddleware`；之後新增的寫入端點預設都要驗。

**只收 JSON**：三個 `POST` 的 body 一律 `Content-Type: application/json`（`createSessionRefresh` 送 `{}`），讓跨站表單送不出、`fetch` 必定觸發 CORS 預檢；其他 Content-Type 回 `422 VALIDATION_FAILED`（`errors` 一筆 `location: "body"`）。

**未知欄位**：request body 繼承 `RequestModel`，只收 camelCase、未宣告的欄位回 `422`（`extra_forbidden`）。本次沒有任何 query 參數；送了也會被忽略，不支援。

**`201` 與 `Location`**：三個建立登入狀態的 `POST` 回 `201`，`Location: /api/v1/current-session`（登入狀態對外沒有自己的 id，只能以「目前這一段」定址）。

**通用錯誤**：每個端點另外可能回父 router 宣告的 `404`、`405`、`406`、`500`，下面各段不重列；`422` 只在有 body 的端點列。

**語系**：錯誤外層的 `message` 依 `Accept-Language`，字串在 `app/i18n/<locale>/messages.json`；下面引用的中文句子是 zh-TW 的值。

## 常駐文件異動

- 常駐文件：`docs/diagrams/architecture/error-codes.mdx`、`docs/diagrams/architecture/endpoint-authorization.mdx`

| 文件                         | 節                 | 異動       | 摘要                                                                                                                                               |
| :--------------------------- | :----------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error-codes.mdx`            | 通用碼             | 新增兩列   | `AUTH_REQUIRED`（401）、`CSRF_FAILED`（403）；`VALIDATION_FAILED` 的端點欄加上本次三個有 body 的端點                                               |
| `error-codes.mdx`            | 模組專屬碼         | 新增一張表 | `account` 模組前綴 `ACCOUNT_` 的七個碼；登入失敗鎖定不在本次，沒有它的碼                                                                           |
| `error-codes.mdx`            | 已知限制、決策紀錄 | 修改、新增 | 「`400`、`401`、`403`、`409` 還沒有」那一列改成只剩 `403`（權限不足）與一般 `409`；決策紀錄一列                                                    |
| `endpoint-authorization.mdx` | 端點               | 新增七列   | 每列的放行對象、對到或對不到 PRD 權限矩陣的格、遮蔽欄位（全部「無」；回帳號資料的寫明只明列 `id`、`name`、`email`、`role` 四欄，都是登入者自己的） |
| `endpoint-authorization.mdx` | 已知限制、決策紀錄 | 修改、新增 | 「認證、授權與 CSRF」改成「授權第 3、4 步」；決策紀錄一列                                                                                          |

`api-envelope` spec 的「第一批通用碼」只列了六個；新增的兩個通用碼要由 `planner` 在本 change 的 spec delta 補進那條 Requirement。

## getAuthOptions

- **Method / Path**：`GET /api/v1/auth-options`
- **角色**：不檢查；未登入也可呼叫。回應只有兩個部署開關，不讀任何帳號或業務資料
- **用途**：登入頁決定要不要顯示「前往註冊」與 Google 按鈕的狀態（規格 01-01 §登入頁 第 10 條、01-02 Q10 的共用判斷）

### Request

無 path、query 或 body。

### Response

`200`。

| 欄位                      | 型別    | nullable | 說明                                                                                                                                                                                                        |
| :------------------------ | :------ | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selfRegistrationEnabled` | boolean | 否       | 這個部署有沒有設定寄信服務（`RESEND_API_KEY` 有沒有設），即是否開放自行註冊；登入頁、註冊頁與註冊的送出共用這一個判斷（01-02 Q10，維護者 sa-6）                                                             |
| `googleEnabled`           | boolean | 否       | 三個 `GOOGLE_*` 都設時 true、三個都不設時 false（只設一部分服務根本不會啟動，`specs/runtime-config`「Google 登入的設定一起設或一起不設」）；false 時前端**不顯示** Google 按鈕與「或」分隔線（維護者 sa-8） |

```json
{ "selfRegistrationEnabled": false, "googleEnabled": true }
```

### 欄位遮蔽

無。兩個布林是部署層級的事實，不含金鑰、網址或任何部署細節。

### 測試集答案隔離

無風險：不讀任務、資料集或標記資料。

### 錯誤

只有通用錯誤。

## createSession

- **Method / Path**：`POST /api/v1/sessions`
- **角色**：不檢查。已登入的人再送一次也照樣開一段新的登入狀態（既有的不受影響）
- **用途**：Email 與密碼登入（規格 01-01 §用 Email 與密碼登入；01-05 §Email 的識別規則、§沒有本地密碼的帳號）

### Request

| 位置 | 欄位       | 型別   | 必填 | 驗證                                                                                                                                                              |
| :--- | :--------- | :----- | :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| body | `email`    | string | 是   | 去掉前後空白後至少 1 字元、最多 320 字元；**不檢查格式**（01-01 資料欄位）。後端正規化（NFKC、casefold）後比對；正規化後超過 254 字元不回 `422`，而是當成帳密不對 |
| body | `password` | string | 是   | 至少 1 字元、最多 1024 字元；**不去空白、不檢查組成規則**（01-01 Q8）                                                                                             |

未知欄位回 `422`。範例：

```json
{ "email": "User@Example.com", "password": "correct horse" }
```

### Response

`201`，`Location: /api/v1/current-session`，並設定 `__Host-ls_at`、`__Host-ls_rt`、`__Host-ls_csrf` 三個 cookie。

| 欄位         | 型別                          | nullable | 說明                                                                                          |
| :----------- | :---------------------------- | :------- | :-------------------------------------------------------------------------------------------- |
| `user.id`    | string（UUID）                | 否       | 帳號的識別碼                                                                                  |
| `user.name`  | string                        | 否       | 顯示名稱                                                                                      |
| `user.email` | string                        | 否       | 登入者自己的 Email（存的是正規化之後的值）；落點頁顯示它（維護者 sa-5／7）                    |
| `user.role`  | string：`user`、`super_admin` | 否       | 目前的系統角色，**只供顯示**；授權一律以後端每次讀到的值為準。Seeder 管理員也是 `super_admin` |

```json
{
  "user": {
    "id": "5b0f4c1e-6a3d-4f6e-9a0b-2f1c8d7e9a10",
    "name": "王小明",
    "email": "user@example.com",
    "role": "user"
  }
}
```

### 欄位遮蔽

不是依角色遮蔽，而是回應 schema 只明列上表四欄，全部是登入者**自己的**資料（PRD 01 帳號 `R/E (o)`），所以沒有對誰遮蔽的問題；以下欄位在任何角色、任何情況都**不在回應裡**（不是換成某個值）：`hashed_password`、`google_subject`、`credential_version`、`is_seeder`、`is_active`、`anonymized_at`、登入狀態的 `sid` 與 `source_info`。token 只在 cookie 裡，不出現在 body。

### 測試集答案隔離

無風險：不讀任務、資料集或標記資料。

### 錯誤

| HTTP | `code`                        | 觸發條件                                                                                                                                                                                   |
| :--- | :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `ACCOUNT_INVALID_CREDENTIALS` | 帳號不存在、密碼不符、帳號停用、已匿名化、沒有本地密碼（只能用 Google），或 Email 正規化後超過 254 字元——**全部同一個碼、同一句**「帳號或密碼錯誤，請再試一次」，不分原因；不設任何 cookie |
| 422  | `VALIDATION_FAILED`           | Content-Type 不是 `application/json`、body 不是合法 JSON、欄位缺少、去空白後為空、超過長度上限、或有未宣告的欄位；`errors` 逐欄位列出，不回顯送來的值                                      |

## getCurrentSession

- **Method / Path**：`GET /api/v1/current-session`
- **角色**：已登入的平台成員與系統管理員（含 Seeder 管理員）；由 `get_current_principal` 做授權四步的第 1、2 步，系統角色取自資料庫
- **用途**：前端的頁面守門與「已登入的人開登入頁直接進落點」（規格 01-01 §登入頁 第 9 條、Q3）；也供暫時落點顯示目前是誰

### Request

無 path、query 或 body。身分只來自 `__Host-ls_at` cookie；`Authorization` 標頭、query、其他標頭一概不看（S1）。

### Response

`200`。欄位與 `createSession` 相同（`user.id`、`user.name`、`user.email`、`user.role`）；`role` 是**這一次**從資料庫讀到的值，不是 JWT 裡的。

### 欄位遮蔽

同 `createSession`：只明列四欄。

### 測試集答案隔離

無風險：不讀任務、資料集或標記資料。

### 錯誤

| HTTP | `code`          | 觸發條件                                                                                                                                                                                                                                                                                                                                                          |
| :--- | :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_REQUIRED` | 沒有 access cookie、簽章不對、JWT 過期；登入狀態不存在、屬於別的帳號、已失效、已過 90 天或 7 天；帳號停用或已匿名化；`credential_version` 不符；系統角色不是兩個值之一。**每一種都是同一個碼與同一句**，不帶 `sid`、帳號或其他裝置的資訊（01-05 §不能通行的登入狀態不說明原因）。前端收到後試一次 `createSessionRefresh`（A7 的 single-flight），仍不行才回登入頁 |

## createSessionRefresh

維護者 sa-2：延續（含多分頁與疑似盜用）在本次；N1：refresh token 存在新表 `account_refresh_token`。

- **Method / Path**：`POST /api/v1/session-refreshes`（命令資源：每次延續是一次「延續」的建立，api-agent-rules A1 的命令資源寫法）
- **角色**：持有 `__Host-ls_rt` 的人；不檢查系統角色，但輪替之前先讀帳號狀態，停用就拒絕
- **用途**：access token 到期後延續同一段登入狀態（01-05 §登入狀態能撐多久、§延續登入狀態與疑似被盜用）

### Request

| 位置 | 欄位 | 型別   | 必填 | 驗證                                  |
| :--- | :--- | :----- | :--- | :------------------------------------ |
| body | —    | object | 是   | 一律送空物件 `{}`；任何欄位都回 `422` |

身分只來自 `__Host-ls_rt` cookie。

### Response

`201`，`Location: /api/v1/current-session`，重設三個 cookie（同一個 `sid`、新的 refresh token、新的 access JWT 與 CSRF token）。`data` 欄位同 `createSession`。

寬限期（30 秒，寫在 `SessionPolicy`）內同一張 refresh token 的第二次使用也回 `201`，拿到同一段登入狀態的另一張 token（01-05 Q13 的「額外重發一次」）。

### 欄位遮蔽

同 `createSession`。

### 測試集答案隔離

無風險：不讀任務、資料集或標記資料。

### 錯誤

| HTTP | `code`                     | 觸發條件                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :--- | :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_REQUIRED`            | 請求**沒有** refresh cookie（例如從沒登入過的訪客，或 cookie 已被清掉）。不清任何東西、不寫資料庫；前端照一般的未登入處理，**不顯示**被動登出的兩句（01-05 Q4 只用在「曾經登入、後來不能通行」）                                                                                                                                                                                                                                                 |
| 401  | `ACCOUNT_SESSION_EXPIRED`  | 所屬登入狀態已過 90 天的絕對上限或 7 天的閒置限制；後端同時把它標成失效（不記登出）並清掉三個 cookie。前端顯示「登入已過期，請重新登入」（01-05 Q4）                                                                                                                                                                                                                                                                                             |
| 401  | `ACCOUNT_SESSION_INVALID`  | **帶著** refresh cookie 但不能用：查不到這張 token、所屬登入狀態已失效（登出或安全撤銷，沒有寬限資格）、帳號停用或已匿名化，或同一張 token 在寬限期**外**又被使用（疑似被盜用：該帳號所有登入狀態一起失效）。清掉三個 cookie；前端顯示「驗證失敗，請重新登入」。不說明是哪一種                                                                                                                                                                   |
| 409  | `ACCOUNT_REFRESH_CONFLICT` | 同一張 token 在寬限期內被用到第三次以上：不發新 token、不撤銷任何登入狀態、**不清 cookie**（同一台的另一個分頁可能剛拿到新的）。前端短暫等候同來源另一個分頁的結果，用目前的 cookie 重送一次原請求；重送仍回 `401` 時再延續一次、成功就再重送一次。合計**最多兩次延續、兩次重送**，仍不行才回登入頁（01-05 §多個分頁同時延續登入狀態 第 2、3 條；`ui-design.md` X7）（01-05 §多個分頁同時延續登入狀態；A7 的「refresh 併發回 `409`」，不進畫面） |
| 422  | `VALIDATION_FAILED`        | body 不是 `{}` 或不是 JSON                                                                                                                                                                                                                                                                                                                                                                                                                       |

## deleteCurrentSession

維護者 sa-2、sa-5／7：登出在本次；呼叫它的是落點 `/dashboard/dashboard` 的登出鈕，07-01 的側欄之後呼叫同一個端點。

- **Method / Path**：`DELETE /api/v1/current-session`
- **角色**：不檢查。登入狀態已經不能驗證時也要能清掉本機的 cookie（01-05 §從這一台登出 第 4 條）
- **用途**：從這一台登出

### Request

無 path、query 或 body。依 `__Host-ls_rt` 找出這一段登入狀態。

### Response

`204`，無 body，清掉 `__Host-ls_at`、`__Host-ls_rt`、`__Host-ls_csrf`。

**envelope 例外的理由**：登出沒有要回給前端的資料，依 architecture §API 契約 與 api-agent-rules A1，刪除成功回 `204` 無 body。

refresh cookie 可驗證且登入狀態有效時，把它標成失效並記下登出時間；cookie 不在、查不到或已失效時什麼都不寫、不記登出，回應**完全相同**（不聲稱伺服器端已失效，也不讓回應透露差別）。其他裝置的登入狀態不受影響。

### 欄位遮蔽

無（沒有 body）。

### 測試集答案隔離

無風險：不讀任務、資料集或標記資料。

### 錯誤

只有通用錯誤；不會回 `401`。

## getGoogleAuthorization

- **Method / Path**：`GET /api/v1/google-authorization`
- **角色**：不檢查
- **用途**：開始 Google 登入（規格 01-01 §用 Google 帳號登入 第 2 條）

### Request

無 path、query 或 body。

### Response

`200`，並設定 `__Host-ls_oidc`（10 分鐘）。

| 欄位               | 型別          | nullable | 說明                                                                                                                                                 |
| :----------------- | :------------ | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authorizationUrl` | string（URL） | 否       | Google 的授權網址，含 `state`、`nonce`、PKCE `code_challenge`（S256）與 `redirect_uri`。前端以整頁導覽前往（`window.location.assign`），不是 `fetch` |

```json
{
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&state=...&nonce=...&code_challenge=...&code_challenge_method=S256&redirect_uri=..."
}
```

`redirect_uri` 取自設定 `GOOGLE_REDIRECT_URI`，指向**前端**的 Google 回調路由 `/account/google/callback`（頁面 `GoogleCallbackPage`，`ui-design.md`）。部署時設成 `<對外的 origin>/account/google/callback`（例 Lite：`http://localhost:8080/account/google/callback`；本機開發：`http://localhost:5173/account/google/callback`），並在 Google Cloud Console 登記同一個值；後端不自己組這個網址。Google 帶著 `code` 與 `state`（或 `error`）回到那裡，前端再呼叫 `createGoogleSession`。

### 欄位遮蔽

無。網址裡的 `state` 與 `nonce` 是一次性的流程值，PKCE verifier 只在 httpOnly 的流程 cookie 裡，不出現在回應。

### 測試集答案隔離

無風險：不讀任務、資料集或標記資料。

### 錯誤

| HTTP | `code`                       | 觸發條件                                                                                                            |
| :--- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| 409  | `ACCOUNT_GOOGLE_UNAVAILABLE` | 這個部署沒有設定 Google（`googleEnabled` 為 false）。這時前端不顯示 Google 按鈕（sa-8），正常不會呼叫；這個碼是防呆 |

## createGoogleSession

- **Method / Path**：`POST /api/v1/google-sessions`
- **角色**：不檢查；必須帶著同一個瀏覽器在 `getGoogleAuthorization` 拿到的 `__Host-ls_oidc`
- **用途**：用 Google 回傳的授權碼完成登入；只登入或綁定既有帳號，不建立帳號（規格 01-01 §用 Google 帳號登入；01-05 Q18；ADR-004 D5）

### Request

| 位置 | 欄位    | 型別   | 必填 | 驗證                                         |
| :--- | :------ | :----- | :--- | :------------------------------------------- |
| body | `code`  | string | 是   | 1–2048 字元；Google 回傳的授權碼，原樣轉送   |
| body | `state` | string | 是   | 1–512 字元；必須等於流程 cookie 裡的 `state` |

未知欄位回 `422`。Google 回 `error`（例如使用者取消）時前端**不呼叫**這個端點，直接回登入頁、不顯示錯誤（01-01「Google 驗證沒通過回到登入頁」）。

```json
{ "code": "4/0Ab...", "state": "q7Jc2..." }
```

### Response

`201`，`Location: /api/v1/current-session`，設定三個 session cookie並清掉 `__Host-ls_oidc`。`data` 欄位同 `createSession`。

帳號的對應：先找**已連結這個 Google 帳號**的帳號，找到就登入，不看 Email 是否相同；沒有已連結的帳號時，若 Google 回報 Email 已驗證、且有 Email 相同的既有帳號，依 ADR-004 D5 自動綁定（維護者 sa-9）：同一筆交易寫入連結、清掉本地密碼、`credential_version` 加一、撤銷該帳號既有的所有登入狀態，再為這一台開新的登入狀態。回應本身不說明有沒有綁定，畫面也**不另外告知**（sa-9）。

### 欄位遮蔽

同 `createSession`；另外 Google 那一側的 `sub`、Email 與 `email_verified` 一律不回。

### 測試集答案隔離

無風險：不讀任務、資料集或標記資料。

### 錯誤

| HTTP | `code`                        | 觸發條件                                                                                                                                                                                                                                                                                                                     |
| :--- | :---------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `ACCOUNT_GOOGLE_FLOW_INVALID` | 流程 cookie 不在、過期或簽章不對；`state` 不符；向 Google 換 token 失敗；`id_token` 驗不過（簽章、`iss`、`aud`、`exp`、`nonce`）。清掉流程 cookie。前端據此**安靜回登入頁、不顯示錯誤橫幅**（與 01-01「Google 驗證沒通過回到登入頁」同一個結果）                                                                             |
| 401  | `ACCOUNT_GOOGLE_REJECTED`     | 沒有任何帳號連結這個 Google 帳號，且（沒有 Email 相同的既有帳號，或 Google 回報 Email 未驗證）；已連結或可綁定的帳號是停用或已匿名化的，也回這個碼（維護者 N2）。不建立帳號；有沒有設定寄信服務都同一個碼與同一句「無法用這個 Google 帳號登入。需要帳號的話，請聯絡系統管理員邀請你。」，不說明是哪一種原因。清掉流程 cookie |
| 409  | `ACCOUNT_GOOGLE_UNAVAILABLE`  | 這個部署沒有設定 Google                                                                                                                                                                                                                                                                                                      |
| 422  | `VALIDATION_FAILED`           | 欄位缺少、為空、超過長度上限、有未宣告的欄位，或 Content-Type 不是 JSON                                                                                                                                                                                                                                                      |

前端回調頁分辨三種結果只看 HTTP 狀態與 `code`，不讀 `message`：

| 結果                                                     | 前端看到                                                                        | 畫面（`ui-design.md`）                                    |
| :------------------------------------------------------- | :------------------------------------------------------------------------------ | :-------------------------------------------------------- |
| E1：取消或驗證沒通過                                     | Google 回 `error`（不呼叫本端點），或本端點回 `400 ACCOUNT_GOOGLE_FLOW_INVALID` | 回登入頁，不顯示錯誤                                      |
| E2：沒有對應帳號、Email 未驗證、帳號停用或已匿名化（N2） | `401 ACCOUNT_GOOGLE_REJECTED`；單一個碼，不帶原因                               | 回登入頁，顯示 Google 那一句                              |
| 網路錯誤或 `5xx`                                         | 沒有回應、不是 JSON，或 `500 INTERNAL_ERROR` 等 `5xx`                           | 回登入頁，顯示「沒有回應」那一句可重試的說明（不當成 E1） |

`409 ACCOUNT_GOOGLE_UNAVAILABLE` 與 `422` 在正常流程不會出現（前端不會在沒設定時開始流程、body 由前端組），前端當成網路錯誤那一類處理。

## 破壞性變更

無。七個端點全部新增；既有的 `getHealth` 不變。`CORSMiddleware` 允許的請求標頭多了 `X-CSRF-Token`，不影響既有請求。

## 維護者的決定

本份照維護者 2026-11-26 的決定寫（[#719 的決定表](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)），下表只列影響契約的幾題。

| #              | 決定                                                                            | 本份落在哪裡                                                                                                                                               |
| :------------- | :------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sa-2           | 期限、延續、被動登出兩句、登出都在本次                                          | `createSessionRefresh`（`ACCOUNT_SESSION_EXPIRED`、`ACCOUNT_SESSION_INVALID`、`ACCOUNT_REFRESH_CONFLICT`）、`deleteCurrentSession`                         |
| sa-3           | 登入失敗鎖定不在本次                                                            | `createSession` 沒有 `429`；`error-codes.mdx` 沒有鎖定的碼                                                                                                 |
| sa-4           | 建立第一位 Seeder 管理員的指令                                                  | 不是端點，本份沒有；見 `system-design.md` §Seeder 初始化指令                                                                                               |
| sa-5／7、sa-10 | 落點 `/dashboard/dashboard` 顯示名字、Email、系統角色與登出鈕；登入後一律去落點 | `user.email` 加進回應；登入端點不收 `returnTo`                                                                                                             |
| sa-6           | 建「有沒有設定寄信服務」的共用判斷                                              | `getAuthOptions.selfRegistrationEnabled`                                                                                                                   |
| sa-8           | 沒設定 Google 就不顯示按鈕                                                      | `getAuthOptions.googleEnabled`；`ACCOUNT_GOOGLE_UNAVAILABLE` 只是防呆                                                                                      |
| sa-9           | Google 自動綁定照 ADR-004 D5，不另外告知                                        | `createGoogleSession`                                                                                                                                      |
| sa-11          | 守門只做授權第 1、2 步                                                          | `getCurrentSession` 的角色欄；沒有依權限矩陣的 `403`                                                                                                       |
| N1             | 新表 `account_refresh_token`                                                    | `createSessionRefresh`、`deleteCurrentSession`                                                                                                             |
| N2             | 停用、已匿名化的帳號用 Google 也回 E2                                           | `ACCOUNT_GOOGLE_REJECTED`                                                                                                                                  |
| U6             | 前端查守門時連不上或 `5xx` 當成未登入，回登入頁並顯示「沒回應」那句             | 不需要新東西：`getCurrentSession` 的失敗只有 `401 AUTH_REQUIRED`（試延續、再回登入頁）與通用的 `5xx`／沒有回應（回登入頁、「沒回應」那句），兩者前端分得開 |

## 本份的新問題

都不需要維護者決定，交給 `planner` 與 `design-reviewer` 核對。

| #   | 問題                                                                                               | 處理                                                                                                     |
| :-- | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| C1  | `api-envelope` spec 的「第一批通用碼」只列六個，本次新增 `AUTH_REQUIRED`、`CSRF_FAILED` 兩個通用碼 | `planner` 在 spec delta 修改那條 Requirement；兩個碼不加前綴，因為它們由 `core` 產生、之後每個模組都會回 |
| C2  | `auth-options` 的單數化                                                                            | 實作時在 `_IRREGULAR_SINGULARS` 加 `"options": "options"`，tasks 要列這一項                              |
| C3  | Google 回調                                                                                        | 已定：前端路由 `/account/google/callback`，`GOOGLE_REDIRECT_URI` 指向它                                  |
| C4  | operationId 以本份端點總覽為準                                                                     | `ui-design.md` 已對齊                                                                                    |
