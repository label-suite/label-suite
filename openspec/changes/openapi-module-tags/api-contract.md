# API Contract

本 change **不新增、不刪除任何端點**，也不改任何端點的 path、method、operationId、request、response、錯誤碼、角色或欄位遮蔽。契約的異動只在 OpenAPI 文件的形狀：

1. 文件頂層多一個 `tags` 陣列，每個模組一筆，帶 `name` 與一句英文 `description`
2. 每個 operation 多一個 `tags` 欄位，**恰好一個值**，等於該端點所屬的 `backend/app/modules/` 目錄名
3. 8 個 operationId 全部不變，前端 Orval 產生的 hook 與型別名稱因此不變

`system-design.md` 的待決 SA-1～SA-7 與 T1～T4 全部延續，本文不替維護者決定；會影響契約內容的部分（主要是 SA-3 的順序、SA-5 的檢查範圍、SA-6 的適用範圍）在下文標出。

## 端點總覽

模組欄就是這次加上的 tag。operationId 由 `generate_operation_id` 依「method 加 `/api/v1` 之後最後一個非參數路徑段與回傳型別」算出，與現行 `backend/openapi.json` 逐一相同；`generate_operation_id` 不看 tag，所以加 tag 不會讓任何 operationId 改變。

| Method   | Path                           | operationId              | 模組（tag） | 角色                                             | 異動     |
| :------- | :----------------------------- | :----------------------- | :---------- | :----------------------------------------------- | :------- |
| `GET`    | `/api/v1/health`               | `getHealth`              | `health`    | 不檢查（刻意公開）                               | 加上 tag |
| `GET`    | `/api/v1/auth-options`         | `getAuthOptions`         | `account`   | 不檢查（未登入也可呼叫）                         | 加上 tag |
| `POST`   | `/api/v1/sessions`             | `createSession`          | `account`   | 不檢查（未登入的訪客送出登入）                   | 加上 tag |
| `GET`    | `/api/v1/current-session`      | `getCurrentSession`      | `account`   | 已登入：平台成員、系統管理員（含 Seeder 管理員） | 加上 tag |
| `POST`   | `/api/v1/session-refreshes`    | `createSessionRefresh`   | `account`   | 持有 refresh cookie 的人；不檢查系統角色         | 加上 tag |
| `DELETE` | `/api/v1/current-session`      | `deleteCurrentSession`   | `account`   | 不檢查（登入狀態不能驗證時也要能清 cookie）      | 加上 tag |
| `GET`    | `/api/v1/google-authorization` | `getGoogleAuthorization` | `account`   | 不檢查                                           | 加上 tag |
| `POST`   | `/api/v1/google-sessions`      | `createGoogleSession`    | `account`   | 不檢查（持有 Google 流程 cookie 的人）           | 加上 tag |

角色欄照抄現行的 `docs/diagrams/architecture/endpoint-authorization.mdx`，本次不變，也沒有超出 `docs/specs/00-prd.mdx` §權限矩陣。

**BREAKING**：無。只新增 OpenAPI 的描述性欄位，wire 上的請求與回應一個位元組都不變；operationId 不變，所以前端 `frontend/src/api/generated/` 重產後 hook 與型別名稱不變，前端呼叫端不必改。

## OpenAPI 文件結構

這是本 change 實際的契約內容；實作後由 `uv run python -m app.scripts.export_openapi` 產生的 `backend/openapi.json` 與文件站副本 `docs/diagrams/architecture/api.openapi.json` 必須符合本節。

### 頂層 `tags`

| 欄位                                      | 型別                | 必填 | 規則                                                                                                                                                            |
| :---------------------------------------- | :------------------ | :--- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tags`                                    | array of Tag Object | 是   | 每個後端模組恰好一筆；陣列順序就是 `/docs`（Swagger UI）的分組顯示順序。匯出用 `sort_keys=True` 只排序物件的 key，不排序陣列，所以宣告順序原樣進檔案            |
| `tags[].name`                             | string              | 是   | 等於 `backend/app/modules/` 下的目錄名（小寫，與目錄同字）；全文件唯一                                                                                          |
| `tags[].description`                      | string              | 是   | 一句英文（`openapi.json` 屬機器契約，AGENTS.md Language Rules）；只寫模組對外的用途，不得含內部識別碼、類別名、檔案路徑、部署或主機資訊，也不得提到答案或測試集 |
| 其他 Tag Object 欄位（`externalDocs` 等） | —                   | 否   | 不使用                                                                                                                                                          |

順序依 **SA-3（待決）**，兩種寫法的範例：

```json
{
  "tags": [
    { "name": "health", "description": "Service and database availability check." },
    { "name": "account", "description": "Sign-in, sessions and the signed-in caller." }
  ]
}
```

```json
{
  "tags": [
    { "name": "account", "description": "Sign-in, sessions and the signed-in caller." },
    { "name": "health", "description": "Service and database availability check." }
  ]
}
```

第一種是 `health` 先、`account` 後；第二種是字母序，也與 ADR-003 D14 把 `account` 列第一的順序相同（`health` 不在 D14 的業務模組列表裡）。兩句 `description` 是提案措辭，實作與審查時可以修字，但要守上表的限制。

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

- 「每個 operation 恰好一個 tag」由新的後端測試擋下（`system-design.md` 選項 B）；新模組掛進 `/api/v1` 卻沒帶 tag、或同一個模組在 router 與掛載處各帶一次 tag，測試都會失敗
- 「用到的 tag 都在頂層宣告，且 `description` 非空」是否也由測試擋，依 **SA-5（待決）**
- tag 名稱是否等於目錄名，照 issue 由 `code-reviewer` 審查；要不要改成自動驗，依 **T3（待決）**
- 不屬於任何模組的 operation（目前沒有）怎麼分，依 **SA-6（待決）**；在決定之前，上表的規則套用到文件裡的所有 operation
- 提交的 `backend/openapi.json` 與程式不一致時，既有的漂移檢查（`test_committed_document_matches_the_code` 與 CI 的 `api-contract` job）照常擋下，不用改

### 不受影響的部分

- `info`、`components`、每個 operation 的 `parameters`、`requestBody`、`responses`、`summary`、`description` 都不變
- 成功回應仍包一層 envelope；`deleteCurrentSession` 的 `204` 仍是無 body 的明文例外（理由沿用：登出成功沒有資料可回，只清 cookie）
- FastAPI 內建的 `/docs`、`/redoc`、`/openapi.json` 不在 `/api/v1` 底下、不套 envelope，仍由 `API_DOCS_ENABLED` 控制是否註冊；匯出不經這些路由，不受開關影響
- 文件站 `openapi-renderer` 的 operation 錨點是 `#op/<operationId>`，operationId 不變，所以 `endpoint-authorization.mdx` 等處既有的連結不會斷；外掛會多出 `#tag/<name>` 的分組導覽。外掛的分組是否照頂層 `tags` 的順序排，依 **T4（待決）**

## 常駐文件異動

本次無常駐文件異動。沒有新的錯誤碼、沒有端點會多回既有錯誤碼，端點的角色、權限矩陣的格與遮蔽欄位都不變，所以 `docs/diagrams/architecture/error-codes.mdx` 與 `docs/diagrams/architecture/endpoint-authorization.mdx` 都不用改。

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

## 待決問題

以下全部延續 `system-analysis.md` 與 `system-design.md`，由 clarification 一次問完；本文只寫它們對契約的影響。

| #    | 問題（摘要）                                                 | 對契約的影響                                                         | 狀態 |
| :--- | :----------------------------------------------------------- | :------------------------------------------------------------------- | :--- |
| SA-1 | 分組規則要不要寫進 `api-agent-rules.mdx` A1（或 ADR-003）    | 不改契約內容；影響 spec delta 的「來源」怎麼寫                       | 待決 |
| SA-2 | issue 舉例的 `project`、`annotation` 是否以 ADR-003 D14 為準 | 不影響本次的 `health`、`account`；決定將來的 tag 名稱                | 待決 |
| SA-3 | 頂層 `tags` 的順序                                           | 決定 §頂層 `tags` 採哪一個範例，與 `/docs` 的分組順序                | 待決 |
| SA-4 | `schema.yaml` 的 api-contract 產出說明要不要加分組           | 不改本次契約；影響之後 `sd` 拿到的指示                               | 待決 |
| SA-5 | 檢查是否也驗頂層宣告與非空說明                               | 決定「`tags` 出現在頂層且 `description` 非空」是由測試擋還是只靠審查 | 待決 |
| SA-6 | 不屬於任何模組的 operation 怎麼分                            | 決定 §每個 operation 的 `tags` 規則的適用範圍                        | 待決 |
| SA-7 | FR-082「restricted-client router 的 OpenAPI tag」那一列      | 本契約的 tag 只表達模組，不表達授權範圍                              | 待決 |
| T1   | tag 寫在模組 router、`create_app` 掛載處，還是模組匯出的物件 | 不改契約內容（三種寫法產生相同文件）                                 | 待決 |
| T2   | 只做測試，還是也在 `create_app` 啟動時檢查                   | 不改契約內容；影響違反時是測試失敗還是 app 起不來                    | 待決 |
| T3   | tag 名稱等於目錄名要不要自動驗                               | 不改契約內容；影響名稱規則由誰守                                     | 待決 |
| T4   | 文件站外掛的分組順序是否照頂層 `tags`                        | 不改契約內容；影響 SA-3 的決定能否在文件站看到                       | 待決 |
