# System Analysis

## 需求依據

本次是技術 change，沒有 `docs/specs/` 的規格可追溯（`docs/specs/` 與 PRD 沒有與「API 文件是否對外公開」相關的需求，已檢查），依 config context 改追溯到 issue、已歸檔的 clarification 條文、ADR 與規則文件。

| 來源                                                                                                                  | 章節／編號                                                                                                      | 摘要（一句）                                                                                                               |
| :-------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| Issue #592                                                                                                            | 修改目的、預期調整、承接的延後條文                                                                              | 正式層不提供內建 API 文件與介面描述路由，Lite 層與本機開發維持可用；新設定的名稱與預設值由本單規劃決定                     |
| `openspec/changes/archive/2026-11-23-infra-compose-e2e-ci/clarification.md`                                           | §決議 Q13                                                                                                       | 正式層要不要關閉內建 API 文件：本次不關、另開 issue，理由是會改 `runtime-config` 的預設值契約                              |
| `openspec/changes/archive/2026-11-20-backend-skeleton/clarification.md`                                               | 延後項 N6                                                                                                       | `/docs`、`/redoc`、`/openapi.json` 本次維持預設開啟，是否關閉交給 #506                                                     |
| `openspec/specs/runtime-config/spec.md`                                                                               | Requirement「其餘設定都有預設值」、「允許來源是必要設定且不得含萬用字元」、「依有無 DATABASE_URL 選擇資料庫層」 | 唯一必要設定是允許來源；其餘設定都有預設值；以有無資料庫連線字串區分 Lite 層與正式層                                       |
| `docs/diagrams/architecture/endpoint-authorization.mdx`                                                               | §不在本表的路徑、§已知限制                                                                                      | 內建文件路徑任何人都讀得到；「正式環境要不要關閉」列為已知限制，標註尚未開 issue（本單即為該 issue）                       |
| `docs/diagrams/architecture/backend-modules.mdx`                                                                      | §契約匯出（文件站副本）、operationId 算法註記                                                                   | 內建文件路徑「維持預設開啟」是現行文件寫法；匯出契約與文件站副本是獨立流程                                                 |
| `docs/development/rules/api-agent-rules.mdx`                                                                          | A4（三份契約產物分工）、A5（重產與 drift 檢查）                                                                 | 唯一契約真相是 `api-contract.md` 加匯出的契約檔；文件站副本是位元組相同的副本；CI 重產比對                                 |
| `docs/development/adr/003-backend-architecture.mdx`                                                                   | D6（前端 client 由匯出契約產生）、D7（設定依有無資料庫連線字串分層，見 runtime-config 來源註記）                | 前端型別與 client 來自匯出契約，不來自執行中服務的文件路由                                                                 |
| `docs/development/adr/008-deployment-and-operations.mdx`                                                              | D1（Compose 加反向代理當 runtime）                                                                              | 正式層只有前端容器對外開放連接埠，後端不直接對外                                                                           |
| ADR-004（認證與安全）                                                                                                 | 全文掃過                                                                                                        | 沒有任何一條處理 API 文件路由的公開與否（只在 endpoint-authorization 的限制表被間接引用）；此處不能引為依據                |
| `backend/app/main.py`、`backend/app/core/config.py`、`docker-compose.prod.yml`、`.env.example`、`frontend/nginx.conf` | 現況                                                                                                            | 應用組裝沒有關閉內建文件路由；設定類只有資料庫與跨來源設定；正式層 compose 只傳資料庫與跨來源設定；反向代理只轉發 API 前綴 |

## 範圍

- 這次包含：
  - 正式層服務不提供內建 API 文件頁與介面描述路由；Lite 層與本機開發、測試維持可用
  - 為此新增的設定項（名稱、預設值、哪一層預設開或關）與其驗證規則
  - 調整主規格 `runtime-config` 對「其餘設定都有預設值」的描述與新增 Scenario
  - 同步 `.env.example` 與 `docker-compose.prod.yml` 對這項設定的傳遞
  - 更新現行文件中「維持預設開啟」「尚未開 issue」的敘述（端點授權圖、後端模組圖）
- 這次不包含：
  - 認證、授權、CSRF（尚未建置，由後續 change 處理）
  - 契約匯出與 CI `api-contract` job 的行為變更（issue 明訂不受影響，見待決 #5 的驗證）
  - 反向代理設定的調整，除非待決 #6 的裁定要求
  - `docs/specs/`、PRD、`design/prototype/`

## 業務流程

不適用：本需求沒有 `docs/specs/` 規格，也沒有使用者可見的業務流程；它是部署環境下「誰能讀到 API 結構」的執行期行為。涉及單一能力（執行期設定與應用組裝），不跨規格，也不畫串接圖。使用者視角只有兩種情境：

- 正式層：外部人員要求內建文件頁或介面描述檔，得到「不存在」的回應
- Lite 層與本機開發：開發者照舊能開啟內建文件頁

規格書沒有對應業務流程章節，且流程只有這兩個分支、無角色交接，因此不另畫 Mermaid；是否補回規格書記為待決 #9。

## 跨模組依賴

| 方向       | 對象                                                      | 關係                                                                                                                                 |
| :--------- | :-------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| 需要先存在 | `runtime-config`（主規格）、應用組裝、設定載入            | 新設定要進同一個設定入口，沿用「錯誤訊息指出設定名稱、不印值」的載入行為                                                             |
| 需要先存在 | 容器執行環境（主規格 `container-runtime`，已歸檔於 #506） | 正式層 compose 檔與 `.env.example` 是設定傳遞路徑                                                                                    |
| 共用資料   | 契約匯出命令與其固定的占位設定                            | 匯出用固定設定建立應用並產生契約；若新設定影響契約內容或占位設定的欄位完整性，會牽動 CI `api-contract` job 與文件站副本（見待決 #5） |
| 被依賴     | 前端 client 產生                                          | 由提交進 repo 的匯出契約產生，不讀執行中服務的文件路由，原則上不受影響                                                               |
| 被依賴     | 後端測試                                                  | 測試以應用組裝函式建立應用；預設值決定現有測試與契約相關檢查是否需要改                                                               |
| 被依賴     | 開發者文件與端點授權圖                                    | 兩處現行文字與本變更結果矛盾，需要同步（見需求矛盾 2）                                                                               |
| 衝突檢查   | `openspec/changes/`                                       | 目前只有本 change（已掃過），無重疊                                                                                                  |
| 後續功能   | 認證上線                                                  | 認證層落地後，內建文件路由是否需要登入是另一個問題，本次不處理                                                                       |

## 需求矛盾

1. **issue 的觸發情境與反向代理現況不符**：issue 稱「正式層經前端連接埠的反向代理就能連到後端的文件路由」。來源：issue #592 §現況；`frontend/nginx.conf` 只把 API 前綴轉發給後端，其餘路徑回前端首頁；`docker-compose.prod.yml` 註明後端不對外開放連接埠，ADR-008 D1 同。依現況，內建文件路徑經前端連接埠只會拿到前端首頁，並非外部可讀。這不改變「正式層不應提供」的目標，但改變威脅的前提：目前是縱深防禦，不是已存在的外洩。記為待決 #6。（已解決：縱深防禦，clarification §檢查範圍 Q6 列）
2. **現行文件寫「維持預設開啟」**：`docs/diagrams/architecture/backend-modules.mdx` 的 operationId 註記與 `endpoint-authorization.mdx` §不在本表的路徑、§已知限制都敘述預設開啟或尚未開 issue；完成本變更後兩處過時。依 AGENTS.md 這是本次呼叫路徑上要一併修正的文件（來源：archive Q13 已回修內容只到 proposal 範圍外）。（已解決：clarification Q10 列，本 change 一併修正）
3. **`runtime-config` 以「唯一必要設定」為標題**：Purpose 與 Requirement 標題都寫「其餘設定都有預設值」。新增設定若有預設值就與契約相容但要補 Scenario；若要求正式層必須明確設定（無預設值）就與契約矛盾。來源：`openspec/specs/runtime-config/spec.md`；archive Q13「會改預設值契約」。記為待決 #2、#3。（已解決：clarification Q1（預設 true，MODIFIED 列入新設定））
4. **匯出契約與內建路由的關係**：endpoint-authorization 稱內建路徑「不在 `openapi.json` 的 `paths` 裡」，所以關閉路由本身不應改變契約內容；但這是現行文件的敘述，尚未對照實作驗證。記為待決 #5。（已解決：clarification Q5 列（不經路由、位元組不變，實作以測試證明））

## 待決問題

| #   | 問題                                                                                                                                                                                                                                                                                                                                                   | 影響                                                                                                                                                                                                                                                                           | 狀態                                                         |
| :-- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| 1   | 新設定的名稱與語意：用「關閉文件」（預設關閉才安全時為 on 表示隱藏）還是「開啟文件」（on 表示提供）？名稱要不要沿用現有命名慣例（來源：issue #592 §預期調整；`backend/app/core/config.py` 的命名，全大寫環境變數加欄位名）                                                                                                                             | 決定設定類欄位、`.env.example`、compose 檔、runtime-config 新 Requirement 的名稱與 Scenario 字句；也決定布林值解析失敗時的錯誤行為                                                                                                                                             | 已決：clarification Q1                                       |
| 2   | 預設值與「哪一層預設如何」：是單一預設（例如預設提供，正式層 compose 明確設為隱藏），還是依有無資料庫連線字串（Lite／正式）自動決定，或正式層強制必須明確設定（來源：`runtime-config` Requirement「其餘設定都有預設值」「依有無 DATABASE_URL 選擇資料庫層」；archive Q13；issue §預期調整）                                                            | 預設提供：安全性依賴 compose 檔記得設定，非 compose 部署的正式後端仍會公開。依層自動：正式層預設關閉，但設定語意與 `runtime-config` 既有「層只決定資料庫」衝突。強制設定：與「唯一必要設定」契約衝突，並讓 Lite 與測試都得改。三者會改變 runtime-config delta 的寫法與現有測試 | 已決：clarification Q1                                       |
| 3   | `runtime-config` 契約如何調整：改 Requirement 的字句（「唯一必要設定」不變、補一條新設定的預設），或新增獨立 Requirement，或拆出新 capability（來源：`openspec/specs/runtime-config/spec.md` Purpose 與三條 Requirement）                                                                                                                              | 決定 specs 的 MODIFIED／ADDED 切法，以及 Purpose 文字是否要跟著改；也決定追溯來源要引 ADR 與規則文件的哪幾條                                                                                                                                                                   | 已決：clarification Q1                                       |
| 4   | 要關閉哪些路徑：只關互動式文件頁與 `redoc` 頁，還是連 `/openapi.json` 與 `/docs/oauth2-redirect` 一併關（來源：issue 標題稱「內建 API 文件與介面描述路由」；`endpoint-authorization.mdx` §不在本表的路徑列出四個；archive N6 列出三個）                                                                                                                | 關介面描述檔會讓正式層不能再線上取得契約，需確認沒有人或工具在正式環境取用它；影響該表的修改範圍、驗收 Scenario 的路徑清單                                                                                                                                                     | 已決：clarification Q2（四條全關）                           |
| 5   | 契約匯出與 CI `api-contract` job 是否真的不受影響：匯出命令用固定占位設定建立應用，若新設定欄位沒有預設值或占位設定未列出，匯出會失敗；文件站副本（#572 的 `openapi-renderer` 讀取）是否仍在匯出時產生、位元組不變（來源：issue §預期調整；`backend/app/scripts/export_openapi.py` 的占位設定；`backend-modules.mdx` §文件站副本；api-agent-rules A5） | 若新設定要放進占位設定，需同步改匯出命令，不屬 issue 所說「不受影響」；契約檔與副本若有差異會讓 CI 失敗，影響 tasks 要不要含重新匯出                                                                                                                                           | 已決：clarification §檢查範圍 Q5 列（不受影響）              |
| 6   | issue 的觸發前提（經反向代理可連到後端文件）與 nginx 現況不符時，本次定位為縱深防禦、還是要連同反向代理設定一併處理（例如明確拒絕文件路徑），或其他部署形態（Cloudflare、自行直連後端）才是真正的風險來源（來源：issue §現況；`frontend/nginx.conf`；ADR-008 D1；見需求矛盾 1）                                                                        | 決定範圍是否擴大到反向代理設定與其測試；決定驗收證據是對後端直連驗證，還是經前端連接埠驗證；也影響威脅描述寫進 proposal 的口徑                                                                                                                                                 | 已決：clarification §檢查範圍 Q6 列（縱深防禦，不改 nginx）  |
| 7   | 隱藏時的回應形態：回「找不到」且沿用統一錯誤外層，還是由框架預設的找不到回應；是否要與其他不存在路徑一致，避免透露「曾有文件頁」（來源：`openspec/specs/api-envelope`；本需求依據中無明文）                                                                                                                                                            | 決定 api-contract 的描述、錯誤外層的 Scenario，以及驗收怎麼確認                                                                                                                                                                                                                | 已決：clarification §檢查範圍 Q7 列（沿用既有 404 envelope） |
| 8   | 測試與本機開發的預設體驗：測試與本機 `uvicorn` 要維持可用文件頁（issue 明定 Lite 與本機開發維持可用），預設值的選擇是否使測試無需顯式設定即可繼續通過（來源：issue §預期調整；待決 #2）                                                                                                                                                                | 預設若偏向隱藏，現有後端測試、本機開發指令、`.env.example` 預設值都要改；影響 tasks 的工作量與開發者文件                                                                                                                                                                       | 已決：clarification Q1                                       |
| 9   | 規格書沒有對應的業務流程或需求章節；是否要用 `spec-writing` 在 `docs/specs/` 補一條「正式環境不公開 API 結構」的非功能需求（來源：本次無 `docs/specs/` 依據；`openspec/config.yaml` 追溯規則；spec-migration D4）                                                                                                                                      | 補了則本 change 的 delta 可追溯到規格編號；不補則維持追溯到 ADR 與規則文件，但目前 ADR-004 與 ADR-008 都沒有直接條文，追溯來源可能不足，需決定要引的 ADR 條號或新增一條決策                                                                                                    | 已決：clarification §檢查範圍 Q9 列（不補規格）              |
| 10  | 現行文件（`backend-modules.mdx` 的 operationId 註記、`endpoint-authorization.mdx` 的路徑表與已知限制）要在本 change 一併修正，還是另開 issue（來源：AGENTS.md §Required Behaviors「呼叫路徑上的錯誤實作直接修正」；見需求矛盾 2）                                                                                                                      | 影響 tasks 是否含文件更新，與 technical-writer 工作項；`docs/diagrams/` 是否屬維護者擁有範圍需確認                                                                                                                                                                             | 已決：clarification §檢查範圍 Q10 列（一併修正）             |

## 參考檔案

- `openspec/changes/archive/2026-11-23-infra-compose-e2e-ci/clarification.md`（Q13）
- `openspec/changes/archive/2026-11-20-backend-skeleton/clarification.md`（N6）
- `openspec/specs/runtime-config/spec.md`
- `backend/app/main.py`、`backend/app/core/config.py`、`backend/app/scripts/export_openapi.py`
- `docker-compose.prod.yml`、`.env.example`、`frontend/nginx.conf`
- `docs/development/adr/003-backend-architecture.mdx`、`docs/development/adr/004-auth-and-security.mdx`、`docs/development/adr/008-deployment-and-operations.mdx`
- `docs/development/rules/api-agent-rules.mdx`（A4、A5）
- `docs/diagrams/architecture/backend-modules.mdx`、`docs/diagrams/architecture/endpoint-authorization.mdx`
- Issue #592；issue #572（文件站契約呈現）
