# API Contract

本 change **不新增、不刪除任何端點**，也不改任何端點的 path、method、operationId、request、response、錯誤碼、角色或欄位遮蔽。契約的異動只在 OpenAPI 文件的形狀：

1. 文件頂層多一個 `tags` 陣列，每個模組一筆，帶 `name` 與一句英文 `description`
2. 每個 operation 多一個 `tags` 欄位，**恰好一個值**，等於該端點所屬的 `backend/app/modules/` 目錄名
3. 8 個 operationId 全部不變，前端 Orval 產生的 hook 與型別名稱因此不變

`system-design.md` 的待決 SA-1～SA-7 與 T1～T4 已由 `clarification.md` 全部定案；本文照定案寫，影響契約內容的是 Q2（頂層 `tags` 的順序）、P5（檢查範圍）與 P3（適用於所有 operation）。文末 §待決問題 保留每題並指向 clarification。

## 端點總覽

模組欄就是這次加上的 tag；表的列序依 clarification Q2 的 tag 順序（`account` 先、`health` 最後）。operationId 由 `generate_operation_id` 依「method 加 `/api/v1` 之後最後一個非參數路徑段與回傳型別」算出，與現行 `backend/openapi.json` 逐一相同；`generate_operation_id` 不看 tag，所以加 tag 不會讓任何 operationId 改變。

| Method   | Path                           | operationId              | 模組（tag） | 角色                                             | 異動     |
| :------- | :----------------------------- | :----------------------- | :---------- | :----------------------------------------------- | :------- |
| `GET`    | `/api/v1/auth-options`         | `getAuthOptions`         | `account`   | 不檢查（未登入也可呼叫）                         | 加上 tag |
| `POST`   | `/api/v1/sessions`             | `createSession`          | `account`   | 不檢查（未登入的訪客送出登入）                   | 加上 tag |
| `GET`    | `/api/v1/current-session`      | `getCurrentSession`      | `account`   | 已登入：平台成員、系統管理員（含 Seeder 管理員） | 加上 tag |
| `POST`   | `/api/v1/session-refreshes`    | `createSessionRefresh`   | `account`   | 持有 refresh cookie 的人；不檢查系統角色         | 加上 tag |
| `DELETE` | `/api/v1/current-session`      | `deleteCurrentSession`   | `account`   | 不檢查（登入狀態不能驗證時也要能清 cookie）      | 加上 tag |
| `GET`    | `/api/v1/google-authorization` | `getGoogleAuthorization` | `account`   | 不檢查                                           | 加上 tag |
| `POST`   | `/api/v1/google-sessions`      | `createGoogleSession`    | `account`   | 不檢查（持有 Google 流程 cookie 的人）           | 加上 tag |
| `GET`    | `/api/v1/health`               | `getHealth`              | `health`    | 不檢查（刻意公開）                               | 加上 tag |

角色欄照抄現行的 `docs/diagrams/architecture/endpoint-authorization.mdx`，本次不變，也沒有超出 `docs/specs/00-prd.mdx` §權限矩陣。

**BREAKING**：無。只新增 OpenAPI 的描述性欄位，wire 上的請求與回應一個位元組都不變；operationId 不變，所以前端 `frontend/src/api/generated/` 重產後 hook 與型別名稱不變，前端呼叫端不必改。

## OpenAPI 文件結構

這是本 change 實際的契約內容；實作後由 `uv run python -m app.scripts.export_openapi` 產生的 `backend/openapi.json` 與文件站副本 `docs/diagrams/architecture/api.openapi.json` 必須符合本節。

### 頂層 `tags`

| 欄位                                      | 型別                | 必填 | 規則                                                                                                                                                                                          |
| :---------------------------------------- | :------------------ | :--- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tags`                                    | array of Tag Object | 是   | 每個後端模組恰好一筆；陣列順序就是 `/docs`（Swagger UI）的分組顯示順序，照規格章節排、`health` 最後（Q2）。匯出用 `sort_keys=True` 只排序物件的 key，不排序陣列，所以宣告順序原樣進檔案       |
| `tags[].name`                             | string              | 是   | 等於 `backend/app/modules/` 下的目錄名（小寫，與目錄同字）；全文件唯一                                                                                                                        |
| `tags[].description`                      | string              | 是   | 一句英文，不得為空字串或只有空白（P5）（`openapi.json` 屬機器契約，AGENTS.md Language Rules）；只寫模組對外的用途，不得含內部識別碼、類別名、檔案路徑、部署或主機資訊，也不得提到答案或測試集 |
| 其他 Tag Object 欄位（`externalDocs` 等） | —                   | 否   | 不使用                                                                                                                                                                                        |

順序依 clarification Q2：`account`（01）、`dashboard`（02）、`task`（03、04）、`dataset`（05）、`admin`（06），最後 `health`。本次只有兩個模組存在，所以只有兩筆；之後新增的模組依它的規格章節插入對應位置，例如 `task` 插在 `account` 之後、`health` 之前。

```json
{
  "tags": [
    { "name": "account", "description": "Sign-in, sessions and the signed-in caller." },
    { "name": "health", "description": "Service and database availability check." }
  ]
}
```

兩句 `description` 是提案措辭，實作與審查時可以修字，但要守上表的限制。模組名一律照 ADR-003 D14（P1）。

### 每個 operation 的 `tags`

| 欄位                         | 型別            | 必填 | 規則                                                                                                       |
| :--------------------------- | :-------------- | :--- | :--------------------------------------------------------------------------------------------------------- |
| `paths.<path>.<method>.tags` | array of string | 是   | 長度恰好 1；值等於該端點 handler 所在的 `backend/app/modules/<module>/` 目錄名，且出現在頂層 `tags[].name` |

範例（只列這次多出的欄位，其餘不變）：

```json
{
  "paths": {
    "/api/v1/health": {
      "get": {
        "operationId": "getHealth",
        "tags": ["health"]
      }
    }
  }
}
```

檢查方式：

- 新的後端測試（`backend/tests/unit/test_openapi_tags.py`，只做測試、不加啟動檢查，P6）驗三件事（P5）：每個 operation 恰好一個 tag、該 tag 在頂層 `tags` 宣告、頂層每筆 `description` 非空。新模組掛進 `/api/v1` 卻沒帶 tag、同一個模組在 router 與掛載處各帶一次 tag、或忘了在頂層宣告，測試都會失敗
- tag 在 `create_app` 掛載時以 `include_router(tags=["<module>"])` 帶上，模組自己的 `APIRouter()` 不寫 tags（P4）；這是實作位置，不影響文件內容
- tag 名稱是否等於目錄名，由 `code-reviewer` 審查，測試不驗（P7）
- 規則適用文件裡的**所有** operation，沒有例外（P3）；目前沒有不屬於任何模組的 operation，將來出現時測試會失敗，屆時再決定歸屬
- 提交的 `backend/openapi.json` 與程式不一致時，既有的漂移檢查（`test_committed_document_matches_the_code` 與 CI 的 `api-contract` job）照常擋下，不用改

### 不受影響的部分

- `info`、`components`、每個 operation 的 `parameters`、`requestBody`、`responses`、`summary`、`description` 都不變
- 成功回應仍包一層 envelope；`deleteCurrentSession` 的 `204` 仍是無 body 的明文例外（理由沿用：登出成功沒有資料可回，只清 cookie）
- FastAPI 內建的 `/docs`、`/redoc`、`/openapi.json` 不在 `/api/v1` 底下、不套 envelope，仍由 `API_DOCS_ENABLED` 控制是否註冊；匯出不經這些路由，不受開關影響
- 文件站 `openapi-renderer` 的 operation 錨點是 `#op/<operationId>`，operationId 不變，所以 `endpoint-authorization.mdx` 等處既有的連結不會斷；外掛會多出 `#tag/<name>` 的分組導覽。外掛不改；它的分組是否照頂層 `tags` 的順序，驗收時在兩個入口各看一次並記錄，文件站自己排序則記為已知差異（P8）

## 常駐文件異動

本次無常駐文件異動。沒有新的錯誤碼、沒有端點會多回既有錯誤碼，端點的角色、權限矩陣的格與遮蔽欄位都不變，所以 `docs/diagrams/architecture/error-codes.mdx` 與 `docs/diagrams/architecture/endpoint-authorization.mdx` 都不用改。

## getAuthOptions

- **Method / Path**：`GET /api/v1/auth-options`
- **模組（tag）**：`account`
- **角色**：不檢查；未登入也可呼叫（不變）

### Request

不變：沒有 path、query 或 body 欄位。

### Response

不變：envelope 內的 `data` 為 `LoginOptionsData`，兩個布林 `selfRegistrationEnabled`、`googleEnabled`（都不為 null）。

### 欄位遮蔽

| 欄位 | 誰看不到 | 遮蔽後的值 |
| :--- | :------- | :--------- |
| 無   | —        | —          |

### 測試集答案隔離

無。

### 錯誤

不變：`/api/v1` 共用的 `404`、`405`、`406`、`500`。

## createSession

- **Method / Path**：`POST /api/v1/sessions`
- **模組（tag）**：`account`
- **角色**：不檢查；未登入的訪客送出登入（不變）

### Request

不變：body 為 `LoginRequest`（`email`、`password`），驗證規則與未知欄位政策照現行 `backend/openapi.json` 與 `openspec/specs/account-login`。

### Response

不變：`201`，envelope 內的 `data` 為 `SessionData`（`user.id`、`user.name`、`user.email`、`user.role`），帶 `Location: /api/v1/current-session`。

### 欄位遮蔽

| 欄位                                                                          | 誰看不到 | 遮蔽後的值         |
| :---------------------------------------------------------------------------- | :------- | :----------------- |
| `hashed_password`、`google_subject`、`credential_version`、`is_seeder`、`sid` | 所有人   | 不在回應裡（不變） |

### 測試集答案隔離

無。

### 錯誤

不變：`401`（登入失敗，不分原因）、`422`（schema 驗證失敗），以及共用的 `404`、`405`、`406`、`500`。

## getCurrentSession

- **Method / Path**：`GET /api/v1/current-session`
- **模組（tag）**：`account`
- **角色**：已登入的平台成員、系統管理員（含 Seeder 管理員），以資料庫當下的角色判定（不變）

### Request

不變：沒有 path、query 或 body 欄位；身分只來自 httpOnly cookie。

### Response

不變：envelope 內的 `data` 為 `SessionData`。

### 欄位遮蔽

| 欄位                                                                          | 誰看不到 | 遮蔽後的值         |
| :---------------------------------------------------------------------------- | :------- | :----------------- |
| `hashed_password`、`google_subject`、`credential_version`、`is_seeder`、`sid` | 所有人   | 不在回應裡（不變） |

### 測試集答案隔離

無。

### 錯誤

不變：`401`（未登入或登入狀態已失效），以及共用的 `404`、`405`、`406`、`500`。

## createSessionRefresh

- **Method / Path**：`POST /api/v1/session-refreshes`
- **模組（tag）**：`account`
- **角色**：持有 refresh cookie 且帳號啟用的人；不檢查系統角色（不變）

### Request

不變：body 一律是空物件 `{}`（`RefreshRequest`）；refresh token 只從 cookie 讀。

### Response

不變：`201`，envelope 內的 `data` 為 `SessionData`，帶 `Location: /api/v1/current-session`。

### 欄位遮蔽

| 欄位                                                                          | 誰看不到 | 遮蔽後的值         |
| :---------------------------------------------------------------------------- | :------- | :----------------- |
| `hashed_password`、`google_subject`、`credential_version`、`is_seeder`、`sid` | 所有人   | 不在回應裡（不變） |

### 測試集答案隔離

無。

### 錯誤

不變：`401`、`409`、`422`，以及共用的 `404`、`405`、`406`、`500`；觸發條件照 `openspec/specs/login-session` 與 `error-codes.mdx`。

## deleteCurrentSession

- **Method / Path**：`DELETE /api/v1/current-session`
- **模組（tag）**：`account`
- **角色**：不檢查；登入狀態不能驗證時也要能清 cookie（不變）

### Request

不變：沒有 path、query 或 body 欄位。

### Response

不變：`204` 無 body（envelope 的明文例外：登出沒有資料可回）。

### 欄位遮蔽

| 欄位 | 誰看不到 | 遮蔽後的值 |
| :--- | :------- | :--------- |
| 無   | —        | —          |

### 測試集答案隔離

無。

### 錯誤

不變：一律回 `204`；只有共用的 `404`、`405`、`406`、`500`。

## getGoogleAuthorization

- **Method / Path**：`GET /api/v1/google-authorization`
- **模組（tag）**：`account`
- **角色**：不檢查（不變）

### Request

不變：沒有 path、query 或 body 欄位。

### Response

不變：envelope 內的 `data` 為 `GoogleAuthorizationData`（`authorizationUrl`）；PKCE verifier 只在 httpOnly cookie。

### 欄位遮蔽

| 欄位 | 誰看不到 | 遮蔽後的值 |
| :--- | :------- | :--------- |
| 無   | —        | —          |

### 測試集答案隔離

無。

### 錯誤

不變：`409 ACCOUNT_GOOGLE_UNAVAILABLE`（部署沒有設定 Google），以及共用的 `404`、`405`、`406`、`500`。

## createGoogleSession

- **Method / Path**：`POST /api/v1/google-sessions`
- **模組（tag）**：`account`
- **角色**：不檢查；持有同一個瀏覽器的 Google 流程 cookie（不變）

### Request

不變：body 為 `GoogleSessionRequest`（`code`、`state`）。

### Response

不變：`201`，envelope 內的 `data` 為 `SessionData`，帶 `Location: /api/v1/current-session`。

### 欄位遮蔽

| 欄位                                                                                                                               | 誰看不到 | 遮蔽後的值         |
| :--------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------------- |
| `hashed_password`、`google_subject`、`credential_version`、`is_seeder`、`sid`，以及 Google 那一側的 `sub`、Email、`email_verified` | 所有人   | 不在回應裡（不變） |

### 測試集答案隔離

無。

### 錯誤

不變：`400`、`401`、`409`、`422`，以及共用的 `404`、`405`、`406`、`500`；觸發條件照 `openspec/specs/account-login` 與 `error-codes.mdx`。

## getHealth

- **Method / Path**：`GET /api/v1/health`
- **模組（tag）**：`health`
- **角色**：不檢查；未登入也可呼叫（刻意公開，不變）

### Request

不變：沒有 path、query 或 body 欄位。

### Response

不變：envelope 內的 `data` 只有 `status`、`database`（字串，值只有 `ok`，不為 null）。

### 欄位遮蔽

| 欄位 | 誰看不到 | 遮蔽後的值 |
| :--- | :------- | :--------- |
| 無   | —        | —          |

### 測試集答案隔離

無：不讀任務、資料集或答案；tag 與說明不含資料。

### 錯誤

不變：`503 DATABASE_UNAVAILABLE`（資料庫連不上或逾時），以及 `/api/v1` 共用的 `404`、`405`、`406`、`500`。

## 待決問題

以下各題都已由 `clarification.md` 定案，保留原題與定案指向，不再待決。

| #    | 問題（摘要）                                                 | 定案與對契約的影響                                         | 狀態                       |
| :--- | :----------------------------------------------------------- | :--------------------------------------------------------- | :------------------------- |
| SA-1 | 分組規則要不要寫進 `api-agent-rules.mdx` A1（或 ADR-003）    | 寫進 A1；不改契約內容，spec delta 的來源寫 A1              | 已定案（clarification Q1） |
| SA-2 | issue 舉例的 `project`、`annotation` 是否以 ADR-003 D14 為準 | 以 D14 為準；本次的 `account`、`health` 不受影響           | 已定案（clarification P1） |
| SA-3 | 頂層 `tags` 的順序                                           | 照規格章節，`health` 最後；§頂層 `tags` 只留這一種範例     | 已定案（clarification Q2） |
| SA-4 | `schema.yaml` 的 api-contract 產出說明要不要加分組           | 要，tasks 加一項；不改本次契約                             | 已定案（clarification P2） |
| SA-5 | 檢查是否也驗頂層宣告與非空說明                               | 驗；測試擋「恰好一個 tag、已在頂層宣告、description 非空」 | 已定案（clarification P5） |
| SA-6 | 不屬於任何模組的 operation 怎麼分                            | 不另訂規則；規則適用所有 operation，出現時測試失敗再決定   | 已定案（clarification P3） |
| SA-7 | FR-082「restricted-client router 的 OpenAPI tag」那一列      | 本次不處理，只記風險；tag 只表達模組，不表達授權範圍       | 已定案（clarification P9） |
| T1   | tag 寫在模組 router、`create_app` 掛載處，還是模組匯出的物件 | `create_app` 的 `include_router(tags=[...])`；不改契約內容 | 已定案（clarification P4） |
| T2   | 只做測試，還是也在 `create_app` 啟動時檢查                   | 只做測試；不改契約內容                                     | 已定案（clarification P6） |
| T3   | tag 名稱等於目錄名要不要自動驗                               | 不自動驗，靠 `code-reviewer`；不改契約內容                 | 已定案（clarification P7） |
| T4   | 文件站外掛的分組順序是否照頂層 `tags`                        | 不改外掛，驗收時兩個入口各看一次並記錄；不改契約內容       | 已定案（clarification P8） |
