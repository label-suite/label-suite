# API Contract

**本次無 API 變更。** 沒有新增、修改或移除任何端點、request／response 欄位、錯誤碼或授權規則；實作後重新匯出的 `backend/openapi.json` 應與 `main` 上的版本逐位元組相同，`api-contract` CI job 不應出現漂移。

下面各節不是新的契約，而是把側欄**沿用**的既有端點逐一寫出：用到哪些欄位、怎麼認身分、會遇到哪些錯誤碼，讓前端實作、`planner` 的 Scenario 與驗收有一份可對照的依據。契約本身以 `backend/openapi.json`（與 `docs/diagrams/architecture/api.openapi.json` 相同）和 `openspec/specs/` 的 `auth-guard`、`login-session`、`api-envelope` 為準；兩邊說法不同時以它們為準。

本份沿用 `system-design.md`（以下稱 sd）的設計結論與 `ui-design.md` 的資料來源：

- 側欄讀 `getCurrentSession`，沿用既有的同一份查詢快取；**每次換頁在背景重查一次**，視窗重新取得焦點不重查（clarification Q11，sd SD-4 已決議）
- 登出經共用的 `useSignOut()` 呼叫 `deleteCurrentSession`；暫時落點掛進外殼、拿掉它卡片裡的登出鈕，側欄的登出控制項是登入後頁面唯一的登出入口（Q2）
- 任務角色來源本次固定回「任何任務都沒有任務角色、沒有目前任務」，**不呼叫任何端點**（Q1，sd SD-1 的 A）。需要真實任務角色的 Scenario 與任務角色讀取移交 #766
- 被擋下時回到的儀表板，目前就是掛進外殼的暫時落點（Q2）；說明以前端 navigation state 帶（Q4），不經任何端點

## 端點總覽

| Method   | Path                        | operationId            | 模組（tag） | 角色                                           | 異動                                                                                                          |
| :------- | :-------------------------- | :--------------------- | :---------- | :--------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/v1/current-session`   | `getCurrentSession`    | `account`   | 平台成員、系統管理員（含 Seeder 管理員）       | 無異動（沿用）；新增一個呼叫時機：側欄所在頁面每次換頁背景重查                                                |
| `DELETE` | `/api/v1/current-session`   | `deleteCurrentSession` | `account`   | 不檢查；登入狀態不能驗證時也要能清 cookie      | 無異動（沿用）；新增一個呼叫端：側欄的登出控制項（經 `useSignOut()`）                                         |
| `POST`   | `/api/v1/session-refreshes` | `createSessionRefresh` | `account`   | 不檢查系統角色；持有 refresh cookie 且帳號啟用 | 無異動（沿用）；側欄不直接呼叫，`getCurrentSession` 回 `401 AUTH_REQUIRED` 時由 `apiFetch` 既有的延續流程呼叫 |

三個 operationId 都是既有值，由 `generate_operation_id` 算出，本次不新增 operationId，也不登錄任何提案中的 operationId。

## 常駐文件異動

本次無常駐文件異動。

- `docs/diagrams/architecture/error-codes.mdx`：沒有新的錯誤碼，也沒有會回既有錯誤碼的新端點
- `docs/diagrams/architecture/endpoint-authorization.mdx`：沒有新端點；三個沿用端點的角色、對到的 PRD 權限矩陣格與遮蔽欄位都不變。側欄多呼叫它們，不改變誰能呼叫、能拿到什麼

## getCurrentSession

- **Method / Path**：`GET /api/v1/current-session`
- **模組（tag）**：`account`
- **角色**：平台成員、系統管理員（含 Seeder 管理員），以資料庫當下的系統角色判定；任務成員身分不檢查。PRD 權限矩陣：依系統角色，01 帳號 `R (o)`（讀自己的帳號）；側欄用它屬 07 共用介面 `R/E (o)`，都在上限內
- **身分來源**：只認 `__Host-ls_at` httpOnly cookie，不讀 `Authorization` 標頭或 query（`auth-guard`「查詢目前的登入狀態」）
- **側欄用在**：決定顯示五或六個導覽項（`role`）、使用者晶片的姓名與縮寫（`name`）；Scenario「平台成員看不到系統管理」「系統管理員看到系統管理」「角色被改掉時側欄不立刻變」「錯誤訊息不出現系統內部資訊」
- **呼叫時機（本次新增的用法，不是契約變更）**：進入登入後頁面時由守門讀一次；之後每次路由的 pathname 改變，在背景重查一次。後端每一次請求都從資料庫讀當下的角色，所以重查拿到的就是「下一次操作起」的新角色

### Request

| 位置   | 欄位              | 型別   | 必填 | 驗證                                                                                                                       |
| :----- | :---------------- | :----- | :--- | :------------------------------------------------------------------------------------------------------------------------- |
| cookie | `__Host-ls_at`    | string | 是   | access JWT；簽章、`exp` 與登入狀態由 `get_current_principal` 判定                                                          |
| header | `Accept-Language` | string | 否   | 沒有或空白時為 `zh-TW`；只列不支援的語言回 `406`。只影響錯誤外層的 `message`；前端 API client 依介面語言送 `zh-TW` 或 `en` |

沒有 path、query 或 body。

### Response

`200`，成功外層的 `data`：

| 欄位         | 型別                            | nullable | 說明                                                                                   |
| :----------- | :------------------------------ | :------- | :------------------------------------------------------------------------------------- |
| `user.id`    | string                          | 否       | 帳號 ID。側欄不顯示、不使用                                                            |
| `user.name`  | string                          | 否       | 顯示名稱；側欄的使用者晶片顯示它與它的縮寫                                             |
| `user.email` | string                          | 否       | 正規化後的 Email。側欄不顯示                                                           |
| `user.role`  | string，`user` \| `super_admin` | 否       | 這一次從資料庫讀到的系統角色；`super_admin` 才顯示「系統管理」。只供顯示，不是授權依據 |

`data` 恰好只有 `user` 一個鍵，`user` 恰好只有上面四欄（`additionalProperties: false`）。回應**不含任何任務角色**：任務角色不放進登入身分，側欄的任務角色來源見 §不在本次契約的提案。

### 欄位遮蔽

| 欄位                                                                                                                 | 誰看不到         | 遮蔽後的值                |
| :------------------------------------------------------------------------------------------------------------------- | :--------------- | :------------------------ |
| `hashed_password`、`google_subject`、`credential_version`、`is_seeder`、`is_active`、`anonymized_at`、登入狀態識別碼 | 所有人（含本人） | 不在 schema，不出現在回應 |

沒有依角色而不同的遮蔽：回應只有呼叫者自己的資料。

**測試集答案隔離**：無。回應只有呼叫者自己的帳號四欄，沒有任務、資料集、樣本、標準答案或測試集辨識資訊。

### 錯誤

全部使用共用錯誤外層（`success: false`、`code`、`message`、`data: null`、`errors`、`timestamp`、`traceId`）；`message` 依 `Accept-Language` 在地化，不帶堆疊、SQL、路徑或內部識別碼。

| HTTP | code                 | 觸發條件                                                                                                                                                                                                  |
| :--- | :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_REQUIRED`      | 沒有 access cookie、簽章不對或已過期、登入狀態已失效或過了 90 天／7 天、帳號停用或已匿名化、憑證版本不符；**不分原因同一個回應**。前端 `apiFetch` 會先走一次 `createSessionRefresh`，延續失敗才當成未登入 |
| 404  | `NOT_FOUND`          | 只在路徑打錯時由路由層回；本端點自己不回                                                                                                                                                                  |
| 405  | `METHOD_NOT_ALLOWED` | 用 `GET`、`DELETE` 以外的 method 呼叫這個路徑                                                                                                                                                             |
| 406  | `NOT_ACCEPTABLE`     | `Accept-Language` 只列了不支援的語言（或把支援的語言都以 `q=0` 拒絕）                                                                                                                                     |
| 500  | `INTERNAL_ERROR`     | 未預期的錯誤；只帶 `traceId`，不帶內部資訊                                                                                                                                                                |

不回 `403`：本端點不掛 `require_permission`，`GET` 也不經 CSRF。側欄不把任何錯誤的 `code`、`message` 或 `traceId` 顯示出來，守門把失敗一律轉成未登入（ui-design §畫面狀態）。

## deleteCurrentSession

- **Method / Path**：`DELETE /api/v1/current-session`
- **模組（tag）**：`account`
- **角色**：不檢查；登入狀態不能驗證時也要能清掉本機 cookie。PRD 權限矩陣：依系統角色，01 帳號 `E (o)`（結束自己這一台的登入狀態）
- **CSRF**：在 `CSRF_EXEMPT_OPERATIONS` 放行清單，不需要 `X-CSRF-Token`
- **側欄用在**：側欄的登出控制項，經 `features/auth` 的 `useSignOut()`；依 Q2，暫時落點卡片裡的登出鈕拿掉，這是登入後頁面唯一呼叫它的入口；Scenario「登出後回到登入頁」「點擊登出不會收合」「等待中的操作顯示進行中」

### Request

| 位置   | 欄位           | 型別   | 必填 | 驗證                                                                             |
| :----- | :------------- | :----- | :--- | :------------------------------------------------------------------------------- |
| cookie | `__Host-ls_rt` | string | 否   | refresh cookie；對得到有效且未過期的登入狀態時才撤銷；沒有或對不到也照樣回 `204` |

沒有 path、query 或 body。

### Response

`204`，**無 body**。這是成功外層的明文例外（`204` 依定義沒有 body）；回應的 `Set-Cookie` 清掉三個 session cookie。

| 欄位 | 型別 | nullable | 說明    |
| :--- | :--- | :------- | :------ |
| —    | —    | —        | 無 body |

### 欄位遮蔽

無：沒有 body。

**測試集答案隔離**：無。不讀也不回任何業務資料。

### 錯誤

| HTTP | code                 | 觸發條件                                                              |
| :--- | :------------------- | :-------------------------------------------------------------------- |
| 404  | `NOT_FOUND`          | 只在路徑打錯時由路由層回；本端點自己不回                              |
| 405  | `METHOD_NOT_ALLOWED` | 用 `GET`、`DELETE` 以外的 method 呼叫這個路徑                         |
| 406  | `NOT_ACCEPTABLE`     | `Accept-Language` 只列了不支援的語言（或把支援的語言都以 `q=0` 拒絕） |
| 500  | `INTERNAL_ERROR`     | 未預期的錯誤                                                          |

不回 `401`：登入狀態不能驗證時仍回 `204` 並清 cookie。前端不論成功或失敗都把登入狀態記成未登入並回到登入頁（ui-design §資料來源，沿用 `login-session`「從這一台登出」）。

## createSessionRefresh

- **Method / Path**：`POST /api/v1/session-refreshes`
- **模組（tag）**：`account`
- **角色**：不檢查系統角色；持有 refresh cookie，且帳號啟用。PRD 權限矩陣沒有對應的格（延續既有的登入狀態，不讀業務資料）
- **CSRF**：在放行清單
- **側欄用在**：**側欄不直接呼叫。** 側欄換頁重查 `getCurrentSession` 遇到 `401 AUTH_REQUIRED`（access token 15 分鐘到期）時，`apiFetch` 既有的延續流程呼叫它、成功後重送一次；這是本次換頁重查會比以前更常走到的路徑，所以列出

### Request

| 位置   | 欄位            | 型別   | 必填 | 驗證                                               |
| :----- | :-------------- | :----- | :--- | :------------------------------------------------- |
| cookie | `__Host-ls_rt`  | string | 是   | 沒有時回 `401 AUTH_REQUIRED`                       |
| body   | （空物件 `{}`） | object | 是   | 不接受任何欄位；多帶欄位回 `422 VALIDATION_FAILED` |

### Response

`201`，成功外層的 `data` 與 `getCurrentSession` 相同（`user.id`、`user.name`、`user.email`、`user.role`），並以 `Set-Cookie` 輪替三個 session cookie。側欄不讀這個回應，重送後的 `getCurrentSession` 才是側欄的資料。

### 欄位遮蔽

同 `getCurrentSession`；token 只在 cookie，不在 body。

**測試集答案隔離**：無。

### 錯誤

| HTTP               | code                                                                  | 觸發條件                                                              |
| :----------------- | :-------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| 401                | `AUTH_REQUIRED`                                                       | 請求沒有 refresh cookie（不清 cookie）                                |
| 401                | `ACCOUNT_SESSION_EXPIRED`                                             | 已過 90 天或 7 天；撤銷登入狀態並清 cookie                            |
| 401                | `ACCOUNT_SESSION_INVALID`                                             | token 對不到、登入狀態失效、帳號停用或匿名化、寬限期外重用；清 cookie |
| 409                | `ACCOUNT_REFRESH_CONFLICT`                                            | 同一張 token 在寬限期內被用到第三次以上；什麼都不改                   |
| 422                | `VALIDATION_FAILED`                                                   | body 不是空物件                                                       |
| 404／405／406／500 | `NOT_FOUND`／`METHOD_NOT_ALLOWED`／`NOT_ACCEPTABLE`／`INTERNAL_ERROR` | 同共用契約                                                            |

延續失敗時，守門依回來的碼選登入頁要顯示的那一句（既有行為，`frontend/src/api/session-refresh.ts`），側欄不顯示任何錯誤。

## 不需要 API 的部分

| 範圍                                                   | 為什麼不需要                                                                             |
| :----------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| 語言、外觀模式、側欄收合                               | 瀏覽器本機偏好，不存伺服器（規格 07-01 §資料欄位；sd §資料模型異動）                     |
| 第三個導覽項名稱、角色標示、標記作業與資料集分析的擋下 | 本次的任務角色來源是固定回答，不呼叫端點（Q1；真實讀取歸 #766）                          |
| 目前位置、系統管理次選單、快捷鍵總覽、螢幕寬度         | 畫面行為                                                                                 |
| 擋下後顯示說明                                         | 前端導覽，以 navigation state 帶到外殼內的暫時落點（Q2、Q4），不經後端錯誤碼；不是 `403` |

## 不在本次契約的提案

**以下不是本次的契約，不實作、不進 `openapi.json`、不登錄 operationId；由 #766 負責定案**（clarification Q1）。它是 sd §任務角色讀取的提案形狀 在 API 面的摘要，保留給 #766 當起點；正式的 path、operationId 與欄位由 #766 的 `api-contract.md` 決定。

- 模組：`task`（ADR-003 D14）
- 形狀：一個只讀、只認身分的 `GET`，回呼叫者在所有任務裡持有的任務角色集合（例：`{"heldRoles": ["annotator"]}`），只有角色名稱，不帶任務 ID、任務名稱或筆數；不接受任何使用者 ID 參數
- 錯誤：預期只有 `401 AUTH_REQUIRED` 與共用的 `404`／`405`／`406`／`500`
- 測試集答案隔離：只回角色名稱，標記員推不出任何測試集資訊
- 交 #766 定案（Q1）：要不要權限鍵（SD-5）、算不算邀請中或停用的成員資格與封存任務（SD-2）、「目前任務」的角色從哪來（SD-3）

## 待決問題

本份不新增待決問題；延續自上游的各題都已在 `clarification.md` 決議，本次 API 仍無變更。

| 來源                | 問題                             | 決議                                                              | 對 API 的影響                                                            |
| :------------------ | :------------------------------- | :---------------------------------------------------------------- | :----------------------------------------------------------------------- |
| sa 待決 1、sd SD-1  | 任務角色的讀取本次做不做         | **已決議（Q1）**：本次不做，讀取由 #766 提供                      | 本次無 API 變更；提案端點由 #766 定案並先改 `endpoint-authorization.mdx` |
| sd SD-2             | 「任一任務有角色」算哪些成員資格 | **已決議（Q1）**：交 #766                                         | 只影響提案的查詢條件，本次無                                             |
| sa 待決 2、sd SD-3  | 「目前任務」的角色從哪來         | **已決議（Q1）**：交 #766；本次固定「沒有目前任務」               | 本次無                                                                   |
| sd SD-5             | 提案端點要不要權限鍵             | **已決議（Q1）**：交 #766                                         | 本次無                                                                   |
| sa 待決 13、sd SD-6 | 側欄要不要依矩陣擋               | **已決議（Q10）**：不讀矩陣，落點頁各自的 `require_permission` 擋 | 不需要「有效權限」讀取端點                                               |
| sa 待決 5           | 通知歸哪一張單                   | **已決議（Q7）**：移交 #740                                       | 本次無通知端點                                                           |
| sd SD-4             | 何時重查 `getCurrentSession`     | **已決議（Q11）**：每次換頁背景重查，焦點不重查                   | 沿用既有端點，只多一個呼叫時機（§getCurrentSession）                     |
| sa 待決 3           | 側欄掛在哪、落點頁不存在         | **已決議（Q2）**：暫時落點掛進外殼、拿掉卡片裡的登出鈕            | 無：`deleteCurrentSession` 的呼叫端從暫時落點換成側欄，端點不變          |

sa 其餘待決（4、6–12、14、15）對 API 沒有影響，決議見 `clarification.md` Q3–Q9、Q14。
