# Clarification

## 檢查範圍

關卡模式：檢查 `system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md`、`proposal.md` 五份產出。specs、design、tasks 尚未產生，相關檢查項標「後續產物」。

本 change 沒有 `docs/specs/` 的規格頁可追溯；需求依據是 issue #765 的 §分類原則、§同步範圍（維護者 2026-11-27 裁定）與 §預期調整，以及 `docs/development/` 的 ADR-003（D5、D6、D12–D14）、`docs/diagrams/architecture/backend-modules.mdx` 與 `docs/development/rules/api-agent-rules.mdx`。`sa` 的待決問題 SA-1～SA-7 與 `sd` 的待決問題 T1～T4 逐條處理如下，兩題為 Q，其餘為 P。

## 檢查結論

| 面向             | 結論                                                                                                                                                                                           | 問題數 |
| :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----- |
| 規格完整性       | 待釐清（Q1 規則本文的位置）；specs 涵蓋度屬後續產物                                                                                                                                            | 1      |
| API Contract     | 待釐清（Q2 頂層 tags 的順序）；端點、欄位、錯誤碼、權限與遮蔽皆不變，operationId 不變                                                                                                          | 1      |
| 邏輯一致性       | 問題（P1 舉例的模組名與 ADR-003 D14 不一致；P2 `schema.yaml` 的 api-contract 說明與範本不一致）                                                                                                | 2      |
| 可行性           | 通過：只改 `create_app` 與一條測試，FastAPI 原生支援 `openapi_tags` 與 `include_router(tags=...)`；匯出的 `sort_keys` 不打亂陣列順序                                                           | 0      |
| 邊界情況         | 問題（P3 不屬於任何模組的 operation；P4 tag 寫在兩處會串接成兩個）                                                                                                                             | 2      |
| 跨功能影響       | 通過：前端 Orval 維持 `split`，產物檔名與 hook 名稱不變；文件站 `#op/<operationId>` 錨點不變；`error-codes.mdx`、`endpoint-authorization.mdx` 不受影響。`backend-modules.mdx` 的異動交給 tasks | 0      |
| 可測試性         | 問題（P5 測試的檢查範圍；P6 只做測試或也在啟動時檢查；P7 tag 名稱是否自動驗；P8 文件站外掛的分組順序）                                                                                         | 4      |
| 規格範圍         | 通過：Orval `tags-split`、端點行為、畫面、資料模型、文件站外掛都在範圍外；P9 FR-082 的授權 tag 只記風險                                                                                        | 1      |
| 任務設定驅動     | 通過：不涉及任務類型，沒有寫死任何任務類型的行為                                                                                                                                               | 0      |
| 測試集答案不外露 | 通過：tag 與 description 只有模組名與用途，不含任何資料；description 不得寫內部識別碼、路徑、部署資訊或答案相關內容                                                                            | 0      |

## 決議（Q）

### Q1. 分組規則的本文放在哪裡（SA-1）

- **來源**：`system-analysis.md` 待決問題 1；`proposal.md` §Impact 與 §待決
- **問題**：目前沒有任何規則條號涵蓋 OpenAPI tag，spec delta 的「來源」只能寫 issue #765，五處角色檔與範本也沒有條文可連。
- **決議**：寫進 `docs/development/rules/api-agent-rules.mdx` 的 A1，與 operationId 的規則放在一起；spec delta 與五處角色檔、範本、`backend-modules.mdx` 的檢查清單都連到 A1，規則本文只寫一處。
- **理由**：A1 已經管介面描述檔裡 operationId 的寫法，tag 屬於同一類規則。
- **已回修**：`proposal.md` §What Changes 與 §Impact 加入 `api-agent-rules.mdx` A1（由 `planner` 回修）；tasks 加一項改 A1（後續產物）
- **日期**：2026-11-27

### Q2. 頂層 tags 的順序（SA-3）

- **來源**：`system-analysis.md` 待決問題 3；`api-contract.md` §OpenAPI 文件結構
- **問題**：頂層 `tags` 的宣告順序就是 `/docs` 與文件站的分組順序，issue 沒有指定怎麼排。
- **決議**：照規格章節排，`health` 放最後：`account`（01）、`dashboard`（02）、`task`（03、04）、`dataset`（05）、`admin`（06），最後 `health`。目前只有 `account`、`health` 兩筆；之後新增模組依它的規格章節插入對應位置。
- **理由**：與規格書、產品順序一致；健康檢查是維運用，排在最後。
- **已回修**：`api-contract.md` §OpenAPI 文件結構 只留這一種順序的範例（由 `sd` 回修）；`system-design.md` 的 `OPENAPI_TAGS` 寫明順序（由 `sd` 回修）
- **日期**：2026-11-27

## 已修正（P）

| 編號       | 位置                                                                    | 問題                                                                                                                                                                                            | 修正                                                                                                                                                                    |
| :--------- | :---------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1（SA-2） | `system-analysis.md`、後續角色檔與檢查清單的舉例                        | issue 舉例的 `project`、`annotation` 與 ADR-003 D14 定的模組名不一致                                                                                                                            | issue 的例子只是示意；模組名以 ADR-003 D14 為準（`account`、`dashboard`、`task`、`dataset`、`admin`，加上既有的 `health`），所有舉例照 D14 寫                           |
| P2（SA-4） | `openspec/schemas/label-suite-sdd/schema.yaml` 的 api-contract 產出說明 | 範本加了 tag（模組）欄，schema 的說明沒有                                                                                                                                                       | tasks 加一項：`schema.yaml` 的 api-contract instruction 同步提到 tag（模組）欄                                                                                          |
| P3（SA-6） | `system-design.md` 選項 B 與測試範圍                                    | 不屬於任何模組的 operation（將來在 `app/core/`、`app/oidc/` 掛的路由）怎麼歸 tag                                                                                                                | 目前沒有這種 operation。測試檢查文件裡的**所有** operation，所以將來出現時會直接失敗，屆時再決定歸屬；本次不另訂規則，在 A1 寫明「每個 operation 都要有 tag，沒有例外」 |
| P4（T1）   | `system-design.md` 選項 A                                               | tag 寫在哪裡；FastAPI 會把 router 與掛載時各自寫的 tag 串接起來                                                                                                                                 | 採 A2：在 `create_app` 用 `include_router(tags=[...])` 掛載時帶上，與 issue「掛 router 時指定模組 tag」一致；模組自己的 `APIRouter()` 不寫 tags，避免串接成兩個         |
| P5（SA-5） | `system-design.md` 選項 B、`api-contract.md`                            | 測試只驗「恰好一個 tag」，沒有驗頂層宣告與說明                                                                                                                                                  | issue 的分類原則要求「每個 tag 在頂層 `tags` 宣告並附說明」，所以測試一併驗：每個 operation 恰好一個 tag、該 tag 在頂層宣告、頂層每筆的 description 不是空字串          |
| P6（T2）   | `system-design.md`                                                      | 只做測試，或也像 operationId 撞名一樣在啟動時擋下                                                                                                                                               | 照 issue §預期調整「加一個測試」，只做測試，不加啟動檢查                                                                                                                |
| P7（T3）   | `system-design.md`、`code-reviewer` 清單                                | tag 名稱等於目錄名要不要自動驗                                                                                                                                                                  | 照 issue §預期調整：測試只擋缺 tag，名稱對錯靠 `code-reviewer` 審查                                                                                                     |
| P8（T4）   | 驗收                                                                    | 文件站 openapi-renderer 外掛的分組順序可能自己排序                                                                                                                                              | 不改外掛；驗收時兩個入口（`/docs` 與 `/view/diagrams/architecture/api.openapi`）各看一次，記錄實際順序；若文件站自己排序，記為已知差異                                  |
| P9（SA-7） | `system-analysis.md`                                                    | `api-agent-rules` 附錄把 FR-082「restricted-client router 的 OpenAPI tag」歸給 `security-agent-rules`，但那份文件沒有對應條文；將來若用 tag 標授權邊界，會和「每個 operation 恰好一個 tag」衝突 | 本次不處理，只記風險：tag 不用來表達授權邊界（`system-design.md` 已寫）                                                                                                 |

## 移出本次的驗收標準

無。本 change 沒有對應的 `docs/specs/` 規格頁。

## 交給後續產出

- spec delta 只改 `api-schema-export`；每條 requirement 的來源寫 `api-agent-rules.mdx` A1 與 issue #765 §分類原則
- requirement 涵蓋：每個 operation 恰好一個 tag、tag 名稱等於 `backend/app/modules/` 下的目錄名、頂層 `tags` 每個模組一筆並附非空的英文 description、宣告順序依 Q2、漏帶或未宣告時測試失敗；operationId 不變
- design 採 P4（A2）與 P6（只做測試）；測試範圍依 P5
- tasks 必含：`backend/app/main.py`、測試、重新匯出 `backend/openapi.json` 與文件站副本、重新生成 `frontend/src/api/generated/`（確認 hook 名稱不變）、`api-agent-rules.mdx` A1（Q1）、`backend-modules.mdx` 的 §app factory、§OpenAPI 匯出、§新增業務模組的檢查清單與決策紀錄、五處角色檔與範本（backend-developer、code-reviewer、sd 與 api-contract 範本、design-reviewer、clarify 兩份副本）、`openspec/config.yaml` 的 api-contract 規則、`schema.yaml`（P2）
- 所有模組名舉例照 ADR-003 D14（P1）
- 常駐文件依各角色檔的「常駐文件寫法約束」：正文只寫現況，依據與異動寫進決策紀錄
