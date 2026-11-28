# API Contract

本份是 change `dashboard-shell`（Issue #722）的 API 契約，依據同目錄的 `system-analysis.md`（待決題號寫成 sa-N）與 `system-design.md`，已依 `clarification.md` 的決議（Q1、Q2）定稿。路徑前綴 `/api/v1`、成功回應包一層 envelope 都照定案寫，不列為待決。

**本次沒有新增、修改或刪除任何端點**：儀表板只沿用既有的 `getCurrentSession`，讀它回應裡的系統角色來決定版面，契約一個字都不改，`backend/openapi.json` 也不會變。

## 端點總覽

| Method | Path                            | operationId              | 模組（tag） | 角色                                     | 異動         |
| :----- | :------------------------------ | :----------------------- | :---------- | :--------------------------------------- | :----------- |
| GET    | `/api/v1/current-session`       | `getCurrentSession`      | `account`   | 平台成員、系統管理員（含 Seeder 管理員） | 沿用，無異動 |
| GET    | `/api/v1/task-role-summary`     | `getTaskRoleSummary`     | —           | —                                        | 未採用       |
| GET    | `/api/v1/platform-user-summary` | `getPlatformUserSummary` | —           | —                                        | 未採用       |

- **沒有 BREAKING**：唯一用到的既有端點不改
- **envelope 例外**：`getCurrentSession` 是 `200` 帶 envelope，沒有例外。本次不呼叫 `deleteCurrentSession`（既有的 `204` 例外）
- **共通的錯誤宣告**：每個 `/api/v1` 操作都由 `API_V1_ERROR_RESPONSES` 宣告 `404`、`405`、`406`、`500`；下面錯誤表只寫實際會回的情況
- **`401` 不是儀表板的讀取失敗**：前端 API client 收到 `401` 先走既有的 single-flight refresh（`createSessionRefresh`）並重放；refresh 也失敗才交給守門導向登入頁（api-agent-rules A7）
- **錯誤訊息**：全部由既有的錯誤外層產生，`message` 依 `Accept-Language` 在地化，不帶使用者 ID、權限鍵或堆疊

## 常駐文件異動

本次無常駐文件異動。

- `docs/diagrams/architecture/error-codes.mdx`：沒有新的錯誤碼；`getCurrentSession` 會回的碼與情況不變
- `docs/diagrams/architecture/endpoint-authorization.mdx`：沒有新端點；`getCurrentSession` 的角色、矩陣格（依系統角色：01 帳號 `R (o)`）與遮蔽都不變。儀表板讀它的 `role` 決定版面，不是一格新的權限，也不改這一列

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

| HTTP | `code`           | 觸發條件                                                                                                                                                                                                                                                     |
| :--- | :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_REQUIRED`  | 沒有可通行的登入狀態，不分原因：cookie 不在、token 驗不過或過期、登入狀態已撤銷或過期、帳號停用或已匿名化、`credential_version` 不符，以及**系統角色不是 `user`／`super_admin`**（sa-7「角色無效時導向登入頁」在後端就是這一列，畫面只導向、不結束登入狀態） |
| 406  | `NOT_ACCEPTABLE` | `Accept-Language` 全部被拒（`q=0`）                                                                                                                                                                                                                          |
| 500  | `INTERNAL_ERROR` | 未處理的例外；訊息不帶內部識別碼或堆疊，不帶 `Set-Cookie`（「讀取失敗不清掉登入狀態」）                                                                                                                                                                      |

`400`、`403`、`404`、`409`、`422` 不會回：沒有輸入要驗證、不經授權第 3 步、沒有資源識別碼、沒有狀態轉換。

## 未採用的端點

以下兩個端點在 `system-design.md` 與 `system-analysis.md` 曾以提案 B 列出；clarification 決議不採用，**不進 specs、design 與 tasks，不實作**，`backend/openapi.json` 不會出現它們。

### getTaskRoleSummary（未採用）

- **原提案**：`GET /api/v1/task-role-summary`，回 `heldRoles`（任務角色名稱的陣列）
- **不採用的原因**：clarification Q1 採提案 A。任務與任務成員要到 #766 才存在，端點在那之前只會對每個人回 `heldRoles: []`；而且會先替 #766 定下 path、operationId、權限鍵與成員資格範圍，#766 要嘛沿用、要嘛 **BREAKING** 改掉。任務角色沿用前端既有的單一來源（補讀取中、失敗、完成三種狀態），#766 建好成員後再接上真的讀取，契約屆時由 #766 的 api-contract 定
- **對本次的影響**：`401`、`403 PERMISSION_DENIED`（原提案的 `dashboard.view` 格）都不在儀表板路徑上，ui-design 的 U4 不成立

### getPlatformUserSummary（未採用）

- **原提案**：`GET /api/v1/platform-user-summary`，回四個固定整數，只放行系統管理員，平台成員回 `404`
- **不採用的原因**：clarification Q2 採提案 A。區塊 A 四張卡（`總用戶`、`專案負責人`、`標記員`、`審核員`）的值寫死在前端語言檔、全部顯示 0 人，不經後端；後端回寫死的值不帶任何真實資訊，還要新寫「呼叫者是系統管理員」的第 4 步條件（不得借用待啟用的 `admin.platform_overview.view`），並讓系統管理員版面多出載入與失敗狀態（sa-8）。真實統計的算法另案定義（02-01 Q4）
