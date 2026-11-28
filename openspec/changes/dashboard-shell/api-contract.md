# API Contract

本份是 change `dashboard-shell`（Issue #722）的 API 契約，依據同目錄的 `system-analysis.md`（待決題號寫成 sa-N）與 `system-design.md`。路徑前綴 `/api/v1`、成功回應包一層 envelope 都照定案寫，不列為待決。

**在建議的提案之下（sa-1、sa-3 都選 A），本次沒有新增、修改或刪除任何端點**：儀表板只沿用既有的 `getCurrentSession`，讀它回應裡的系統角色來決定版面，契約一個字都不改，`backend/openapi.json` 也不會變。

後兩節 `getTaskRoleSummary` 與 `getPlatformUserSummary` 是**條件式契約**：只有 clarification 選了對應的提案 B 才成立、才實作，寫在這裡是讓 clarification 那一關看得到選 B 的成本。選 A 時兩節整段刪除，不進 specs、design 與 tasks。

## 端點總覽

| Method | Path                            | operationId              | 模組（tag） | 角色                                     | 異動                                  |
| :----- | :------------------------------ | :----------------------- | :---------- | :--------------------------------------- | :------------------------------------ |
| GET    | `/api/v1/current-session`       | `getCurrentSession`      | `account`   | 平台成員、系統管理員（含 Seeder 管理員） | 沿用，無異動                          |
| GET    | `/api/v1/task-role-summary`     | `getTaskRoleSummary`     | `dashboard` | 平台成員、系統管理員（含 Seeder 管理員） | **僅 sa-1 選 B**：新增；選 A 時不存在 |
| GET    | `/api/v1/platform-user-summary` | `getPlatformUserSummary` | `dashboard` | 系統管理員（含 Seeder 管理員）           | **僅 sa-3 選 B**：新增；選 A 時不存在 |

- **沒有 BREAKING**：唯一用到的既有端點不改；兩個條件式端點都是新增
- **operationId**：兩個條件式名字是用 `app/core/openapi.py` 的 `generate_operation_id` 對兩條路徑實際算出來的（`GET`、回應不是分頁 → `get` 加最後一段的 PascalCase 單數）。與 `main` 上既有的 8 個（`getHealth`、`getAuthOptions`、`createSession`、`getCurrentSession`、`createSessionRefresh`、`deleteCurrentSession`、`getGoogleAuthorization`、`createGoogleSession`）都不重複
- **路徑不帶模組段**：api-agent-rules A1 禁止在 `/api/v1` 之後插模組名，所以是 `/api/v1/task-role-summary`，不是 `/api/v1/dashboard/task-role-summary`；模組邊界由 `app/modules/dashboard/` 與 tag 表達。兩個資源都是「呼叫者自己的一份摘要」，像 `current-session` 一樣是單數的單例資源，沒有 path 參數
- **區塊 A 的資源名用 `platform-user-summary`**：`stats` 會被單數化成 `getPlatformUserStat`，`summary` 單數化後不變
- **envelope 例外**：本份三個端點都是 `200` 帶 envelope，沒有例外。sa-7 提案 B 會用到的 `deleteCurrentSession` 是既有的 `204` 例外（已記在 `login-auth-guard` 的契約），本次不改它
- **共通的錯誤宣告**：每個 `/api/v1` 操作都由 `API_V1_ERROR_RESPONSES` 宣告 `404`、`405`、`406`、`500`；下面各端點的錯誤表只寫實際會回的情況
- **`401` 不是儀表板的讀取失敗**：前端 API client 收到 `401` 先走既有的 single-flight refresh（`createSessionRefresh`）並重放；refresh 也失敗才交給守門導向登入頁（api-agent-rules A7）。儀表板的「錯誤說明加重試」只接 `5xx` 與逾時（02-01 §業務流程「讀取任務角色時的載入與失敗」寫的是伺服器錯誤或逾時）
- **錯誤訊息**：全部由既有的錯誤外層產生，`message` 依 `Accept-Language` 在地化，不帶使用者 ID、任務 ID、權限鍵、矩陣版本或堆疊

## 常駐文件異動

本次無常駐文件異動（依 sa-1、sa-3 的提案 A）。

- `docs/diagrams/architecture/error-codes.mdx`：沒有新的錯誤碼；`getCurrentSession` 會回的碼與情況不變
- `docs/diagrams/architecture/endpoint-authorization.mdx`：沒有新端點；`getCurrentSession` 的角色、矩陣格（依系統角色：01 帳號 `R (o)`）與遮蔽都不變。儀表板讀它的 `role` 決定版面，不是一格新的權限，也不改這一列

**只有 clarification 選了提案 B 才要改**（本次**不改**，`sd` 在 clarification 之後、specs 之前先改常駐文件、再回修本份）：

| 文件                         | 節                   | 選 sa-1 B 時                                                                                                                                                                                                                       | 選 sa-3 B 時                                                                                                                                                 |
| :--------------------------- | :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error-codes.mdx`            | §通用碼              | `AUTH_REQUIRED`、`PERMISSION_DENIED`、`INTERNAL_ERROR` 三列的端點欄加 `getTaskRoleSummary`；`PERMISSION_DENIED` 的「目前沒有：沒有端點掛 `require_permission`」改成這個端點                                                        | 同左三列加 `getPlatformUserSummary`；`NOT_FOUND` 的端點欄加它（平台成員在第 4 步拿到 `404`），產生位置加 `dashboard` 模組的第 4 步條件                       |
| `error-codes.mdx`            | §模組專屬碼          | 不加：`dashboard` 沒有專屬碼                                                                                                                                                                                                       | 不加                                                                                                                                                         |
| `endpoint-authorization.mdx` | §端點                | 加一列：平台成員、系統管理員；任務成員身分不檢查；依系統角色 02 儀表板，平台成員 `R (o)`、系統管理員 `R`；遮蔽「無」；出處 `app/modules/dashboard/router.py` 掛 `require_permission(DASHBOARD_VIEW)`；開頭的「八個端點」改成實際數 | 加一列：只放行系統管理員，平台成員回 `404`；依系統角色 02 儀表板，系統管理員 `R`；遮蔽「無」；出處同左加第 4 步條件；註明不經 `admin.platform_overview.view` |
| `endpoint-authorization.mdx` | §已知限制、§決策紀錄 | §已知限制 那一列的「目前沒有任何端點掛它」改寫；§決策紀錄 加一列                                                                                                                                                                   | §決策紀錄 加一列                                                                                                                                             |

## getCurrentSession

**沿用，無異動。** 契約以 `backend/openapi.json` 與 `openspec/specs/auth-guard`、`login-session` 為準，這裡只寫儀表板怎麼用它。

- **Method / Path**：`GET /api/v1/current-session`
- **模組（tag）**：`account`
- **角色**：平台成員、系統管理員（含 Seeder 管理員）；任務成員身分不檢查。只掛 `get_current_principal`（授權第 1、2 步），每次從資料庫讀當下的帳號狀態與系統角色，不看 JWT 的 `role` claim
- **儀表板怎麼用**：與守門、外殼共用同一份查詢快取（`getGetCurrentSessionQueryKey()`），進儀表板**不多送請求**。儀表板只讀 `data.user.role` 一個欄位：`user` → 平台成員版面（再問任務角色來源），`super_admin` → 系統管理員版面（不讀任務角色）。`id`、`name`、`email` 儀表板不讀（頁首是固定文案）

### Request

| 位置   | 欄位           | 型別                 | 必填 | 驗證                                                                                                                   |
| :----- | :------------- | :------------------- | :--- | :--------------------------------------------------------------------------------------------------------------------- |
| cookie | `__Host-ls_at` | string（access JWT） | 是   | 驗簽章與 `exp`；不在或驗不過一律 `401`。沒有 path、query 或 body 參數；未宣告的 query 參數被忽略（api-agent-rules A2） |

### Response

| 欄位         | 型別                               | nullable | 說明                                                                                   |
| :----------- | :--------------------------------- | :------- | :------------------------------------------------------------------------------------- |
| `user.id`    | string（UUID）                     | 否       | 登入者自己的帳號 ID；儀表板不讀                                                        |
| `user.name`  | string                             | 否       | 顯示名稱；儀表板不讀                                                                   |
| `user.email` | string                             | 否       | 正規化後的 Email；儀表板不讀                                                           |
| `user.role`  | string enum：`user`、`super_admin` | 否       | 這一次請求從資料庫讀到的系統角色，**只供顯示與版面選擇，不是授權**；儀表板讀的唯一欄位 |

```json
{
  "success": true,
  "code": "OK",
  "message": "成功",
  "data": {
    "user": {
      "id": "0b9f3c3e-6f1d-4c2a-9a57-2f0d6f1b8e11",
      "name": "Mandy",
      "email": "mandy@example.org",
      "role": "user"
    }
  },
  "timestamp": "2026-11-28T08:00:00.000Z",
  "traceId": "8d3e5a1c-2b7f-4c90-9e41-6a0f3d2c7b15"
}
```

### 欄位遮蔽

| 欄位 | 誰看不到 | 遮蔽後的值 |
| :--- | :------- | :--------- |
| 無   | —        | —          |

沒有依角色遮蔽的欄位：回應只有呼叫者自己的四個欄位，平台成員與系統管理員拿到同一組。`hashed_password`、`google_subject`、`credential_version`、`is_seeder` 與登入狀態的 `sid` 不在 `SessionUserData` 的 allowlist 裡，任何人都拿不到。

**測試集答案隔離**：無風險。回應只有登入者自己的帳號欄位，不讀任何任務、資料集、項目、標準答案或測試集辨識資訊；標記員能到達這個端點，但從這四個欄位推不出任何答案或哪些項目屬於測試集。

### 錯誤

| HTTP | `code`           | 觸發條件                                                                                                                                                                                                                         |
| :--- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_REQUIRED`  | 沒有可通行的登入狀態，不分原因：cookie 不在、token 驗不過或過期、登入狀態已撤銷或過期、帳號停用或已匿名化、`credential_version` 不符，以及**系統角色不是 `user`／`super_admin`**（sa-7「角色無效時導向登入頁」在後端就是這一列） |
| 406  | `NOT_ACCEPTABLE` | `Accept-Language` 全部被拒（`q=0`）                                                                                                                                                                                              |
| 500  | `INTERNAL_ERROR` | 未處理的例外；訊息不帶內部識別碼或堆疊，不帶 `Set-Cookie`（「讀取失敗不清掉登入狀態」）                                                                                                                                          |

`400`、`403`、`404`、`409`、`422` 不會回：沒有輸入要驗證、不經授權第 3 步、沒有資源識別碼、沒有狀態轉換。

## getTaskRoleSummary（僅 clarification 選 sa-1 提案 B 時才成立）

> **選 A 時整節刪除。** 選 B 時本次在 `task_membership` 落地前，回應對每個人都是 `heldRoles: []`；#766 落地後改成查表，契約不變。

- **Method / Path**：`GET /api/v1/task-role-summary`
- **模組（tag）**：`dashboard`（新 tag，`OPENAPI_TAGS` 依規格章節插在 `account` 之後；頂層 description 例：`Dashboard summaries of the signed-in caller.`）
- **角色**：平台成員、系統管理員（含 Seeder 管理員）；任務成員身分不檢查（不是任務範圍的操作，不走授權第 2b 步）。掛 `require_permission(PermissionKey.DASHBOARD_VIEW)`：系統層的鍵，兩種系統角色的格固定開。系統管理員呼叫也放行、回他自己的角色，只是畫面不呼叫（02-01 §卡控機制「系統管理員……不讀任務角色」）
- **只讀呼叫者自己**：使用者 ID 只取 `AccessGrant.principal.user_id`，**不接受**任何 path、query 或 body 參數，所以沒有「讀別人的」這條路
- **權限上限**：PRD §權限矩陣「02 儀表板」平台成員 `R (o)`、系統管理員 `R`；本端點只讀、只讀自己，沒有超出

### Request

| 位置   | 欄位           | 型別                 | 必填 | 驗證                                                                             |
| :----- | :------------- | :------------------- | :--- | :------------------------------------------------------------------------------- |
| cookie | `__Host-ls_at` | string（access JWT） | 是   | 同 `getCurrentSession`。沒有 path、query 或 body 參數；未宣告的 query 參數被忽略 |

### Response

| 欄位        | 型別                                                            | nullable | 說明                                                                                                                                                                   |
| :---------- | :-------------------------------------------------------------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heldRoles` | array of string enum：`project_leader`、`reviewer`、`annotator` | 否       | 呼叫者在任何任務擁有的任務角色，不重複，依 `TASK_ROLES` 的順序（`project_leader`、`reviewer`、`annotator`）排；沒有就是 `[]`。本次在 `task_membership` 落地前恆為 `[]` |

```json
{
  "success": true,
  "code": "OK",
  "message": "成功",
  "data": { "heldRoles": [] },
  "timestamp": "2026-11-28T08:00:00.000Z",
  "traceId": "8d3e5a1c-2b7f-4c90-9e41-6a0f3d2c7b15"
}
```

- **選角色集合、不選三個計數**（system-design 留給本份二選一）：版面只需要「有沒有」（02-01 §資料欄位「任務角色摘要」的「使用者看到」是「不直接顯示」，計數大於 0 與集合包含該角色對版面的決定等價）；集合與前端既有的 `TaskRoleAnswer.heldRoles` 同形，#766 接上時前端只換來源；計數多帶「參與幾個任務」這個業務上沒有被要求顯示的資訊
- **版面優先序**（專案負責人 > 審核員 > 標記員）不在回應裡，由前端以純函式決定：它只是版面，不是授權
- **「算哪些成員資格」**（只算生效中？排除已封存任務？）在 `task_membership` 存在前沒有作用，留給 #766 定，本契約不預設

### 欄位遮蔽

| 欄位 | 誰看不到 | 遮蔽後的值 |
| :--- | :------- | :--------- |
| 無   | —        | —          |

沒有依角色遮蔽的欄位：回應只有呼叫者自己的角色名稱。**不回**任務 ID、任務名稱、任務類型、筆數、成員資格狀態或任何他人的資料。

**測試集答案隔離**：無風險。標記員能到達這個端點；回應只有三個固定的角色名稱的子集合，不含任何任務、資料集、項目、標準答案或測試集辨識資訊，從「我是標記員」推不出哪些項目屬於測試集。

### 錯誤

| HTTP | `code`              | 觸發條件                                                                                                                                                                                                    |
| :--- | :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_REQUIRED`     | 同 `getCurrentSession`（含系統角色無效）。前端先走 refresh，不進儀表板的錯誤畫面                                                                                                                            |
| 403  | `PERMISSION_DENIED` | 授權第 3 步拒絕。`dashboard.view` 兩種系統角色的格固定開，**正常資料下不會發生**，只在矩陣版本列或格缺列（資料損壞）時出現；訊息不帶權限鍵或矩陣版本（回應 ui-design 的 U4：畫面可依選項 (c) 視為不會發生） |
| 406  | `NOT_ACCEPTABLE`    | `Accept-Language` 全部被拒                                                                                                                                                                                  |
| 500  | `INTERNAL_ERROR`    | 未處理的例外（含讀矩陣時資料庫出錯）；訊息不帶內部識別碼或堆疊，不帶 `Set-Cookie`，不撤銷登入狀態。這是「讀取失敗顯示錯誤與重試」的那一種失敗；重試就是重送同一個請求                                       |

`400`、`404`、`409`、`422` 不會回：沒有輸入、沒有資源識別碼、沒有狀態轉換。若選 system-design 列的替代做法「只掛 `get_current_principal`」，`403` 那一列消失，`endpoint-authorization.mdx` 要寫明「只認身分、只讀自己」。

## getPlatformUserSummary（僅 clarification 選 sa-3 提案 B 時才成立）

> **選 A 時整節刪除。** 選 B 時回四個寫死的示範值，不查任何表；換成真實統計要先以 `spec-writing` 改規格 02-01（Q4 明定算法另案定義）。選 B 也會讓 sa-8（系統管理員的載入與失敗狀態）重新出現。

- **Method / Path**：`GET /api/v1/platform-user-summary`
- **模組（tag）**：`dashboard`
- **角色**：只有系統管理員（含 Seeder 管理員）；任務成員身分不檢查。掛 `require_permission(PermissionKey.DASHBOARD_VIEW)`，再加授權第 4 步條件「呼叫者的系統角色是 `super_admin`」（`dashboard` 模組新寫的條件，目前沒有實作者）。**不得**改掛「檢視全平台統計」`admin.platform_overview.view`：它是已登錄、待啟用的鍵（02-01 §使用角色 末二條；06-02 §五個已登錄、待啟用的鍵 第 10 條）
- **權限上限**：PRD §權限矩陣「02 儀表板」系統管理員 `R`；平台成員的 `R (o)` 只涵蓋自己的資料，全平台數字不屬於它，所以平台成員不放行，沒有超出

### Request

| 位置   | 欄位           | 型別                 | 必填 | 驗證                                                                             |
| :----- | :------------- | :------------------- | :--- | :------------------------------------------------------------------------------- |
| cookie | `__Host-ls_at` | string（access JWT） | 是   | 同 `getCurrentSession`。沒有 path、query 或 body 參數；未宣告的 query 參數被忽略 |

### Response

| 欄位             | 型別            | nullable | 說明                          |
| :--------------- | :-------------- | :------- | :---------------------------- |
| `totalUsers`     | integer（非負） | 否       | `總用戶` 的示範值，單位人     |
| `projectLeaders` | integer（非負） | 否       | `專案負責人` 的示範值，單位人 |
| `annotators`     | integer（非負） | 否       | `標記員` 的示範值，單位人     |
| `reviewers`      | integer（非負） | 否       | `審核員` 的示範值，單位人     |

四個數字是哪幾個是 sa-3 的另一半，由 clarification 定（例如沿用 prototype 的數字）；回應**不帶**「這是示範值」的旗標，示範值標示是畫面的固定文案（sa-4）。

### 欄位遮蔽

| 欄位 | 誰看不到 | 遮蔽後的值 |
| :--- | :------- | :--------- |
| 無   | —        | —          |

沒有依角色遮蔽的欄位：平台成員整個端點拿到 `404`，不是拿到遮蔽過的值。

**測試集答案隔離**：無風險。標記員（平台成員）在第 4 步就拿到 `404`；放行的系統管理員拿到的是四個寫死的整數，不讀任何任務、資料集、項目、標準答案或測試集辨識資訊。

### 錯誤

| HTTP | `code`              | 觸發條件                                                                                                    |
| :--- | :------------------ | :---------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_REQUIRED`     | 同 `getCurrentSession`                                                                                      |
| 403  | `PERMISSION_DENIED` | 授權第 3 步拒絕；與 `getTaskRoleSummary` 相同，只在矩陣資料損壞時出現                                       |
| 404  | `NOT_FOUND`         | 呼叫者是平台成員（第 4 步）。**不回 `403`**，不讓平台成員知道這個端點存在；訊息與路由找不到相同，不說明原因 |
| 406  | `NOT_ACCEPTABLE`    | `Accept-Language` 全部被拒                                                                                  |
| 500  | `INTERNAL_ERROR`    | 未處理的例外；訊息不帶內部識別碼或堆疊，不帶 `Set-Cookie`                                                   |

`400`、`409`、`422` 不會回。
