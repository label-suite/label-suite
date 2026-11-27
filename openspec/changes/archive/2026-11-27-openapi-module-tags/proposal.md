# Proposal

## Why

後端自帶的 API 文件頁 `/docs`（Swagger UI）與文件站的 API 頁 `/view/diagrams/architecture/api.openapi` 是給人看的 API 文件，但目前匯出的 `backend/openapi.json` 中 8 個 operation 的 `tags` 全部為空，所有端點都擠在 `default`（文件站顯示為「未分類」）底下。ADR-003 D5 規定路徑在 `/api/v1` 之後直接接資源、不插模組名，所以從路徑也看不出端點屬於哪個模組。E1–E7 的端點陸續加進來之後會更難查，而規則文件與 `backend-modules.mdx` 的「新增業務模組的檢查清單」都沒有要求 tag，新模組會沿用沒有分組的寫法。因此現在就要把「一個後端模組一個 tag」定成契約，並在規劃、實作、審查三個環節都守住它。

## What Changes

- 每個後端模組的 operation 都帶**恰好一個** OpenAPI tag，名稱等於 `backend/app/modules/` 下的目錄名（目前為 `account`、`health`；之後依 ADR-003 D14 為 `dashboard`、`task`、`dataset`、`admin`，見 clarification P1）；不在模組內再依資源細分（issue #765 §分類原則）。所有 operation 都要有 tag，沒有例外（clarification P3）。
- 介面描述檔頂層新增 `tags` 陣列，每個模組一筆，帶 `name` 與一句英文 `description`；陣列順序就是分組的顯示順序，照規格章節排、`health` 放最後：`account`（01）、`dashboard`（02）、`task`（03、04）、`dataset`（05）、`admin`（06），最後 `health`；目前只有 `account`、`health` 兩筆，新模組依它的規格章節插入對應位置（clarification Q2）。`description` 的內容限制見 `api-contract.md` §頂層 `tags`。
- 新增後端測試，檢查三件事：每個 operation 恰好一個 tag、該 tag 在頂層 `tags` 宣告、頂層每筆的 `description` 不是空字串；新模組漏帶、重複帶或未宣告時測試失敗（clarification P5）。只做測試，不在 app 啟動時另加檢查（P6）；tag 名稱是否等於目錄名不自動驗，由 `code-reviewer` 審查（P7）。
- tag 在 `create_app` 掛載模組 router 時以 `include_router(tags=[...])` 帶上；模組自己的 `APIRouter()` 不寫 tags，避免 FastAPI 把兩處的 tag 串接成兩個（clarification P4）。
- 重新匯出 `backend/openapi.json` 與文件站副本 `docs/diagrams/architecture/api.openapi.json`（同一支匯出指令產生、位元組相同），並重新產生 `frontend/src/api/generated/`；8 個 operationId 不變，前端 hook 與型別名稱不變。
- 改常駐文件 `docs/diagrams/architecture/backend-modules.mdx`：§app factory 與 lifespan、§OpenAPI 匯出與 operationId 檢查、§新增業務模組的檢查清單（加「掛 router 時指定模組 tag」一項）、§決策紀錄補一列；§health、§account 的分層表不動（掛載處帶 tag，模組檔案不變；`system-design.md` §常駐文件異動）。檢查清單連到 `api-agent-rules.mdx` A1，不重寫規則本文。
- 把分組規則本文寫進 `docs/development/rules/api-agent-rules.mdx` A1，與 operationId 的規則放在一起，並寫明「每個 operation 都要有 tag，沒有例外」；這是規則本文的唯一位置，spec delta、角色檔、範本與 `backend-modules.mdx` 的檢查清單都連到 A1（clarification Q1、P3）。
- 把分組規則同步到五處角色與範本，各處連到 A1（issue #765 §同步範圍）：
  - `.claude/agents/backend-developer.md`：§API 與 OpenAPI 寫明掛 router 時指定模組 tag，完成檢查清單加一項
  - `.claude/agents/code-reviewer.md`：審查清單加「每個 operation 恰好一個 tag，且 tag 名稱等於所屬模組目錄名」
  - `.claude/agents/sd.md`、`openspec/config.yaml` 的 `rules.api-contract`、`openspec/schemas/label-suite-sdd/templates/api-contract.md` 端點表：加上 tag（模組）欄
  - `.claude/agents/design-reviewer.md`、clarify skill 的兩份副本（`.claude/skills/clarify/SKILL.md`、`.agents/skills/clarify/SKILL.md`）檢查清單：加「api-contract 每個端點都標了 tag，且等於所屬模組」
- `openspec/schemas/label-suite-sdd/schema.yaml` 的 api-contract 產出說明同步提到 tag（模組）欄，與範本一致（clarification P2）。
- 模組名的舉例一律照 ADR-003 D14，不用 issue 舉例的 `project`、`annotation`（clarification P1）。
- 確認兩個閱讀入口都依模組分組，不再出現 `default`／「未分類」；外掛本身不改，驗收時兩個入口各看一次並記錄實際順序，文件站若自行排序記為已知差異（clarification P8）。
- **BREAKING**：無。只新增 OpenAPI 的描述性欄位，請求與回應不變；operationId 不變，前端呼叫端不必改（`api-contract.md` §端點總覽）。

不在本次範圍：

- Orval 由 `mode: "split"` 改為 `tags-split`（issue #765 §不在本單範圍）
- 新增或修改任何端點的路徑、行為、權限、錯誤碼；`error-codes.mdx`、`endpoint-authorization.mdx` 不變
- 任何產品畫面（`design/prototype/`）、`frontend/` 的路由與頁面（`ui-design.md`：本次無 UI 變更）、`docs/specs/` 需求
- 資料模型與 migration（`system-design.md` §資料模型異動：無）
- 修改文件站的 `openapi-renderer` 外掛
- `api-agent-rules.mdx` §附錄 FR-082「restricted-client router 的 OpenAPI tag」一列：不處理，只記風險——tag 不用來表達授權邊界（clarification P9）
- 在 app 啟動時檢查 tag（clarification P6）

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `api-schema-export`：新增介面描述檔的分組規則——每個 operation 恰好一個 tag、名稱等於所屬模組目錄名、頂層 `tags` 每個模組一筆並附英文說明、陣列順序即顯示順序，以及漏帶 tag 時檢查失敗。這與既有的操作識別名規則、外層元件命名同屬「介面描述檔的內容規則」，所以沿用此 capability，不另開新名稱（`system-analysis.md` §跨模組依賴）。requirement 依 clarification §交給後續產出：每個 operation 恰好一個 tag、tag 名稱等於 `backend/app/modules/` 下的目錄名、頂層 `tags` 每個模組一筆並附非空的英文 `description`、宣告順序依 Q2、漏帶或未宣告時測試失敗、operationId 不變；適用於文件中所有 operation（P3）。每條 requirement 的來源寫 `api-agent-rules.mdx` A1 與 issue #765 §分類原則（Q1）。

`frontend-api-codegen` 不列入：產生方式維持 `split`，既有 requirement 規定的 hook 與型別名稱不變，只有產物內容隨描述檔重產。五處角色檔與範本的規則同步屬工具與文件，沒有對應的 capability（`agent-rule-enforcement` 規範的是 hook 觸發與檢查器，不是角色檔內容），不為它新增 requirement。

## Impact

- 後端程式：只改 `backend/app/main.py`（`openapi_tags` 與 `include_router(tags=[...])`，clarification P4）；`backend/app/modules/health/router.py`、`backend/app/modules/account/router.py` 與 `backend/app/core/openapi.py` 不動（P4、P6）。
- 後端測試：`backend/tests/unit/test_openapi.py` 新增 tag 檢查（每個 operation 恰好一個 tag、tag 已在頂層宣告、`description` 非空，clarification P5）；既有的漂移檢查 `test_committed_document_matches_the_code` 與 CI `api-contract` job 不改，會擋下沒重產的提交。
- 契約與產物：`backend/openapi.json`、`docs/diagrams/architecture/api.openapi.json`、`frontend/src/api/generated/`（重產，名稱不變）。
- 規則文件：`docs/development/rules/api-agent-rules.mdx` A1（分組規則本文的唯一位置，clarification Q1）。
- 常駐文件：`docs/diagrams/architecture/backend-modules.mdx`。
- 角色與規劃範本：`.claude/agents/backend-developer.md`、`code-reviewer.md`、`sd.md`、`design-reviewer.md`、`.claude/skills/clarify/SKILL.md`、`.agents/skills/clarify/SKILL.md`、`openspec/config.yaml`、`openspec/schemas/label-suite-sdd/templates/api-contract.md`、`openspec/schemas/label-suite-sdd/schema.yaml` 的 api-contract 產出說明（clarification P2）。
- 後續模組：ADR-003 D14 預定的業務模組開模組時都要照新的檢查清單指定 tag；舉例名稱用 D14 的 `dashboard`、`task`、`dataset`、`admin`（clarification P1），頂層位置依 Q2 的章節順序插入。
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
| 本 change `clarification.md`                     | Q1、Q2、P1–P9、§交給後續產出                                                                                                                      |
| 本 change 上游產出                               | `system-analysis.md`（需求矛盾 1、2）、`system-design.md`（設計選項 A、B，§常駐文件異動）、`ui-design.md`、`api-contract.md`（§OpenAPI 文件結構） |

## 待決問題

無。上游的 SA-1～SA-7 與 T1～T4 已全部在 `clarification.md` 處理，對照如下。

| #    | 結論                                                                                       | 位置             |
| :--- | :----------------------------------------------------------------------------------------- | :--------------- |
| SA-1 | 規則本文寫進 `api-agent-rules.mdx` A1，其他各處連到 A1                                     | clarification Q1 |
| SA-2 | 舉例照 ADR-003 D14 的模組名                                                                | clarification P1 |
| SA-3 | 照規格章節排，`health` 最後                                                                | clarification Q2 |
| SA-4 | `schema.yaml` 的 api-contract 產出說明同步加 tag（模組）欄                                 | clarification P2 |
| SA-5 | 測試另驗頂層宣告與非空 `description`                                                       | clarification P5 |
| SA-6 | 所有 operation 都要有 tag，沒有例外；將來出現不屬於模組的 operation 時測試會失敗，屆時再定 | clarification P3 |
| SA-7 | 本次不處理，只記風險：tag 不表達授權邊界                                                   | clarification P9 |
| T1   | 採 A2：`create_app` 的 `include_router(tags=[...])`                                        | clarification P4 |
| T2   | 只做測試，不加啟動檢查                                                                     | clarification P6 |
| T3   | 不自動驗，名稱由 `code-reviewer` 審查                                                      | clarification P7 |
| T4   | 不改外掛，驗收時兩個入口各看一次並記錄順序                                                 | clarification P8 |
