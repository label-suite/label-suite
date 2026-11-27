# Proposal

## Why

後端自帶的 API 文件頁 `/docs`（Swagger UI）與文件站的 API 頁 `/view/diagrams/architecture/api.openapi` 是給人看的 API 文件，但目前匯出的 `backend/openapi.json` 中 8 個 operation 的 `tags` 全部為空，所有端點都擠在 `default`（文件站顯示為「未分類」）底下。ADR-003 D5 規定路徑在 `/api/v1` 之後直接接資源、不插模組名，所以從路徑也看不出端點屬於哪個模組。E1–E7 的端點陸續加進來之後會更難查，而規則文件與 `backend-modules.mdx` 的「新增業務模組的檢查清單」都沒有要求 tag，新模組會沿用沒有分組的寫法。因此現在就要把「一個後端模組一個 tag」定成契約，並在規劃、實作、審查三個環節都守住它。

## What Changes

- 每個後端模組的 operation 都帶**恰好一個** OpenAPI tag，名稱等於 `backend/app/modules/` 下的目錄名（目前為 `health`、`account`）；不在模組內再依資源細分（issue #765 §分類原則）。
- 介面描述檔頂層新增 `tags` 陣列，每個模組一筆，帶 `name` 與一句英文 `description`；陣列順序就是分組的顯示順序。順序依待決 SA-3，`description` 的內容限制見 `api-contract.md` §頂層 `tags`。
- 新增一條後端測試：介面描述檔中每個 operation 都恰好有一個 tag，新模組漏帶、或同一模組重複帶 tag 時測試失敗。測試是否另驗「用到的 tag 都在頂層宣告且 `description` 非空」依待決 SA-5；是否另在 app 組裝時檢查依待決 T2；tag 名稱是否等於目錄名改成自動驗依待決 T3（issue 目前裁定靠審查）。
- tag 寫在哪裡（模組 router、app 組裝時的掛載處、或由模組提供 tag 物件）依待決 T1；三種寫法產生相同的介面描述檔，只影響改哪些檔案與檢查清單的措辭。
- 重新匯出 `backend/openapi.json` 與文件站副本 `docs/diagrams/architecture/api.openapi.json`（同一支匯出指令產生、位元組相同），並重新產生 `frontend/src/api/generated/`；8 個 operationId 不變，前端 hook 與型別名稱不變。
- 改常駐文件 `docs/diagrams/architecture/backend-modules.mdx`：§app factory 與 lifespan、§OpenAPI 匯出與 operationId 檢查、§新增業務模組的檢查清單（加「掛 router 時指定模組 tag」一項）、§決策紀錄補一列；§health、§account 的分層表只在 T1 選模組自己宣告或模組提供 tag 物件時才改（`system-design.md` §常駐文件異動）。
- 把分組規則同步到五處角色與範本（issue #765 §同步範圍）：
  - `.claude/agents/backend-developer.md`：§API 與 OpenAPI 寫明掛 router 時指定模組 tag，完成檢查清單加一項
  - `.claude/agents/code-reviewer.md`：審查清單加「每個 operation 恰好一個 tag，且 tag 名稱等於所屬模組目錄名」
  - `.claude/agents/sd.md`、`openspec/config.yaml` 的 `rules.api-contract`、`openspec/schemas/label-suite-sdd/templates/api-contract.md` 端點表：加上 tag（模組）欄
  - `.claude/agents/design-reviewer.md`、`.claude/skills/clarify/SKILL.md` 檢查清單：加「api-contract 每個端點都標了 tag，且等於所屬模組」
- 是否另外改 `docs/development/rules/api-agent-rules.mdx` A1（或在 ADR-003 記一筆）、`openspec/schemas/label-suite-sdd/schema.yaml` 的 api-contract 產出說明、`api-agent-rules.mdx` §附錄 FR-082 一列，分別依待決 SA-1、SA-4、SA-7；決定之前不列入範圍，也不排除。
- 確認兩個閱讀入口都依模組分組，不再出現 `default`／「未分類」；文件站外掛的分組是否照頂層 `tags` 的順序排依待決 T4（外掛本身不改）。
- **BREAKING**：無。只新增 OpenAPI 的描述性欄位，請求與回應不變；operationId 不變，前端呼叫端不必改（`api-contract.md` §端點總覽）。

不在本次範圍：

- Orval 由 `mode: "split"` 改為 `tags-split`（issue #765 §不在本單範圍）
- 新增或修改任何端點的路徑、行為、權限、錯誤碼；`error-codes.mdx`、`endpoint-authorization.mdx` 不變
- 任何產品畫面（`design/prototype/`）、`frontend/` 的路由與頁面（`ui-design.md`：本次無 UI 變更）、`docs/specs/` 需求
- 資料模型與 migration（`system-design.md` §資料模型異動：無）
- 修改文件站的 `openapi-renderer` 外掛

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `api-schema-export`：新增介面描述檔的分組規則——每個 operation 恰好一個 tag、名稱等於所屬模組目錄名、頂層 `tags` 每個模組一筆並附英文說明、陣列順序即顯示順序，以及漏帶 tag 時檢查失敗。這與既有的操作識別名規則、外層元件命名同屬「介面描述檔的內容規則」，所以沿用此 capability，不另開新名稱（`system-analysis.md` §跨模組依賴）。requirement 的範圍受下列待決影響：
  - SA-5：是否有「用到的 tag 都在頂層宣告且 `description` 非空」的 requirement 與 Scenario
  - SA-6：規則適用於「文件中所有 operation」，還是只限 `backend/app/modules/` 內的 operation，以及不屬於模組的 operation 怎麼分
  - SA-3：「頂層 `tags` 依某順序排列」的 Scenario 寫哪一種順序
  - T2：漏帶 tag 時是「檢查失敗」還是也「拒絕啟動與匯出」（後者會比照既有 requirement「操作識別名撞名時拒絕啟動與匯出」）
  - T3：「tag 名稱等於目錄名」是可自動驗的 Scenario，還是只寫成規則、由審查守
  - SA-1：每條 requirement 的「來源」寫法（目前沒有 ADR 或規則文件條號涵蓋 tag，只能寫 issue #765 §分類原則；若 SA-1 決定寫進 `api-agent-rules.mdx` A1 或 ADR-003，改為追溯到該條號）

`frontend-api-codegen` 不列入：產生方式維持 `split`，既有 requirement 規定的 hook 與型別名稱不變，只有產物內容隨描述檔重產。五處角色檔與範本的規則同步屬工具與文件，沒有對應的 capability（`agent-rule-enforcement` 規範的是 hook 觸發與檢查器，不是角色檔內容），不為它新增 requirement。

## Impact

- 後端程式：`backend/app/main.py`（`openapi_tags`；T1 選組裝時宣告時另含 `include_router` 的 tag）；`backend/app/modules/health/router.py`、`backend/app/modules/account/router.py` 只在 T1 選模組自己宣告時修改；`backend/app/core/openapi.py` 只在 T2 選啟動檢查時修改。
- 後端測試：`backend/tests/unit/test_openapi.py` 新增 tag 檢查；既有的漂移檢查 `test_committed_document_matches_the_code` 與 CI `api-contract` job 不改，會擋下沒重產的提交。
- 契約與產物：`backend/openapi.json`、`docs/diagrams/architecture/api.openapi.json`、`frontend/src/api/generated/`（重產，名稱不變）。
- 常駐文件：`docs/diagrams/architecture/backend-modules.mdx`。
- 角色與規劃範本：`.claude/agents/backend-developer.md`、`code-reviewer.md`、`sd.md`、`design-reviewer.md`、`.claude/skills/clarify/SKILL.md`、`openspec/config.yaml`、`openspec/schemas/label-suite-sdd/templates/api-contract.md`；依 SA-1、SA-4、SA-7 可能另含 `docs/development/rules/api-agent-rules.mdx`（或 `docs/development/adr/003-backend-architecture.mdx`）、`openspec/schemas/label-suite-sdd/schema.yaml`。
- 後續模組：ADR-003 D14 預定的業務模組開模組時都要照新的檢查清單指定 tag；舉例名稱用 D14 的 `dashboard`、`task`、`dataset`、`admin`，或 issue 舉例的 `project`、`annotation`，依待決 SA-2。
- 不受影響：資料庫、migration、端點授權與遮蔽、錯誤碼、產品畫面、相依套件。
- 權限與答案隔離：tag 只是文件分組，不表達授權邊界；新增的只有模組名稱與英文說明，不含任何資料，不會帶出標準答案或測試集辨識資訊（`system-design.md` §權限檢查點）。`/docs`、`/redoc`、`/openapi.json` 維持 `API_DOCS_ENABLED` 開關。

## 引用的需求來源

本 change 是技術 change，`docs/specs/` 沒有可追溯的規格頁（`docs/specs/00-prd.mdx`、`glossary.mdx` 已確認沒有相關內容）；依 `openspec/config.yaml` `context` 改追溯到下列來源。

| 來源                                             | 章節                                                                                                                                              |
| :----------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| issue #765                                       | §修改目的、§現況、§預期調整（十項）、§不在本單範圍、§分類原則（維護者 2026-11-27 裁定）、§同步範圍（維護者 2026-11-27 裁定）                      |
| ADR-003                                          | D5 API 路徑前綴與成功回應外層、D6 前端 client 用 Orval 產生、D14 後端業務模組的切分                                                               |
| `docs/development/rules/api-agent-rules.mdx`     | A1 路由、HTTP status、operationId 與回應外層；A4、A5 契約產物分工與重產漂移檢查；§附錄：來源對照 FR-082 一列                                      |
| `docs/diagrams/architecture/backend-modules.mdx` | §預定模組與資料表歸屬、§OpenAPI 匯出與 operationId 檢查、§新增業務模組的檢查清單、§決策紀錄                                                       |
| `openspec/specs/api-schema-export`               | 全部 requirement                                                                                                                                  |
| 本 change 上游產出                               | `system-analysis.md`（需求矛盾 1、2）、`system-design.md`（設計選項 A、B，§常駐文件異動）、`ui-design.md`、`api-contract.md`（§OpenAPI 文件結構） |

## 待決問題

以下全部延續上游產出，留到 clarification 一次問維護者，本 proposal 不替維護者決定。

| #    | 問題（摘要）                                                                                  | 影響本 proposal 的地方                                                        |
| :--- | :-------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------- |
| SA-1 | 分組規則要不要寫進 `api-agent-rules.mdx` A1（或 ADR-003 記一筆）                              | 是否多一個改規則文件的工作項；spec delta 的「來源」寫法                       |
| SA-2 | issue 舉例的 `project`、`annotation` 是否只是示意，以 ADR-003 D14 的模組名為準                | 角色檔、檢查清單、範本裡的舉例名稱                                            |
| SA-3 | 頂層 `tags` 的順序                                                                            | `openapi_tags` 的順序、檢查清單的排序規則、對應 Scenario                      |
| SA-4 | `schema.yaml` 的 api-contract 產出說明要不要加分組                                            | 是否多改 `schema.yaml` 一處                                                   |
| SA-5 | 測試是否也驗頂層宣告與非空說明                                                                | `api-schema-export` 的 requirement 與 Scenario 數；`code-reviewer` 檢查項     |
| SA-6 | 不屬於任何模組的 operation 怎麼分                                                             | `api-schema-export` 分組規則的適用範圍                                        |
| SA-7 | `api-agent-rules.mdx` 附錄 FR-082「restricted-client router 的 OpenAPI tag」那一列要不要處理  | 是否多改附錄或 `security-agent-rules.mdx`                                     |
| T1   | tag 寫在模組 router、`create_app` 掛載處，還是模組提供 tag 物件（`system-design.md` 提案 A2） | 改哪些後端檔案、檢查清單措辭、`backend-modules.mdx` 要改哪幾節                |
| T2   | 只做測試，還是也像 operationId 撞名一樣在 app 組裝時檢查（提案：只做測試）                    | `api-schema-export` 的 requirement 寫法；是否改 `backend/app/core/openapi.py` |
| T3   | tag 名稱等於目錄名要不要自動驗（提案：照 issue 靠審查）                                       | 是否有可自動驗的 Scenario；`code-reviewer` 檢查項的角色                       |
| T4   | 文件站外掛的分組順序是否照頂層 `tags`（提案：驗收時確認，不改外掛）                           | SA-3 的決定能否在文件站看到；驗收步驟                                         |
