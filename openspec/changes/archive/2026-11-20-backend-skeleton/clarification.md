# Clarification

## 檢查範圍

關卡模式：`system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md`、`proposal.md`。`specs/`、`design.md`、`tasks.md` 尚未產生，相關檢查項標「後續產物」。

主要輸入是 `system-analysis.md` 的待決 1–16 與需求矛盾 1–4，以及 `system-design.md`、`api-contract.md` 新增的 N1–N10。每一條都在下面變成一個 Q，或一個附依據的結論（§不需維護者決定的結論）。

## 檢查結論

| 面向             | 結論 | 問題數 |
| :--------------- | :--- | :----- |
| 規格完整性       | 通過 | 3      |
| API Contract     | 通過 | 2      |
| 邏輯一致性       | 通過 | 1      |
| 可行性           | 通過 | 2      |
| 邊界情況         | 通過 | 0      |
| 跨功能影響       | 通過 | 1      |
| 可測試性         | 通過 | 1      |
| 規格範圍         | 通過 | 1      |
| 任務設定驅動     | 通過 | 0      |
| 測試集答案不外露 | 通過 | 0      |

結論欄是 Q 決議後的狀態；問題數是決議前提出的 Q 數。各面向的說明：

- **規格完整性**：proposal 涵蓋 #504 §包含 的每一項。必要設定（Q1）、本地化範圍（Q2）、PostgreSQL 來源（Q5）未定，會改變 #504 驗收第 1、5 項的驗法與 `response-localization` 的去留。specs、tasks 的涵蓋檢查為後續產物。
- **API Contract**：唯一端點 `getHealth` 符合「動詞加資源」，沒有撞名。健康檢查的失敗語意（Q3）與通用錯誤碼、`traceId`、`timestamp` 的預設（Q8）待定。ui-design 本次無 UI，沒有資料來源要對。
- **邏輯一致性**：五份產物互相對齊，待決編號一路沿用。`AGENTS.md` Language Rules 兩列對 `api-contract.md` 的語言說法相反（Q9）。
- **可行性**：技術選型符合 `architecture.mdx` §技術選型。檢查過 §決策紀錄，已裁定的項目（`/api/v1`、成功包外層、外層六欄與 camelCase、模組內分層、Orval、元件展示頁、day.js）沒有被列成待決。版號（Q7）與 lint、型別檢查的歸屬（Q6）待定。
- **邊界情況**：驗證失敗、路徑不存在、method 不支援、未處理例外、資料庫不可用都有對應的錯誤外層。沒有登入，所以未登入與權限不足不適用。沒有寫入，所以並發不適用。無 UI，四種狀態由 #505 處理。
- **跨功能影響**：沒有資料模型異動，不必跑 `check:er`。#505、#506、01-01 的交接都列在 system-analysis §會被後續依賴的。健康檢查在認證上線後是否公開（Q4）會影響 01-01 的 S10 矩陣。
- **可測試性**：每個關鍵情境都能用 pytest 自動化，層名正確（httpx 打 API 的叫 integration）。驗證失敗與未處理例外要靠只存在於 `tests/` 的探測路由才觸發得到（N4，併入 Q8）。
- **規格範圍**：沒有改 `docs/specs/`、`00-prd.mdx` 或 `design/prototype/`。lint 與型別檢查是否進本次（Q6）待定。tasks 的範圍檢查為後續產物。
- **任務設定驅動**：本次不碰任務、資料集與 output type，沒有任務類型分支。新增任務類型不會改到骨架的任何檔案。
- **測試集答案不外露**：本次沒有標記員能到達的端點。骨架先擋住三條間接路徑：`500` 只回通用訊息、`422` 不回顯 `input`、回應一律經明列欄位的 schema（system-design §權限檢查點）。specs 的負向 Scenario 為後續產物，本次沒有需要的端點。

## 決議（Q）

### Q1. 本次的必要設定有哪幾項

- **來源**：system-analysis 待決 1、需求矛盾 3；system-design §設定與啟動失敗
- **問題**：B10 要求缺必要設定時啟動失敗，ADR-003 D7 要求 clone 後不必設定就能跑。本次沒有認證 secret，資料庫連線依 D7 是可選的，唯一的候選是 `CORS_ALLOWED_ORIGINS`。
- **決議**：`CORS_ALLOWED_ORIGINS` 是本次唯一的必要設定：缺少、空清單或含 `*` 都啟動失敗。其餘設定都有預設：`CORS_ALLOW_CREDENTIALS` 預設 true；`DATABASE_URL` 可選，postgres 系列 scheme 正規化成 `+asyncpg`；`SQLITE_PATH` 預設 `./data/label_suite.db`。
- **理由**：B10 本次有可驗的對象，#504 驗收第 5 項就驗這一項；D7 的「不必設定就能跑」由 #506 的 `.env.example` 與 compose 補上預設值。
- **日期**：2026-11-20（維護者）
- **回修位置**：system-analysis 待決 1、需求矛盾 3 標為已決；system-design §設定與啟動失敗 由「建議」改為定案

### Q2. 外層 `message` 是否本次就依語言偏好本地化

- **來源**：system-analysis 待決 2、需求矛盾 4；api-contract N9、N10
- **問題**：A8 禁止回 key 或原始英文，#504 §包含 沒有列語系能力。若本次做，要一併定下 zh-TW 與 en 的文案來源（N9）與 `Content-Language` 標頭（N10）。
- **決議**：本次就實作完整的 A8：zh-TW／en 兩份訊息檔，依 `Accept-Language` 的 q 值挑語言，預設 zh-TW；所有語言都被拒時回 `406 NOT_ACCEPTABLE`；回應帶 `Content-Language`（N10）。文案先用 api-contract N9 列的字串。`ErrorDetail.message` 維持 Pydantic 英文，這是 A8 的明文例外。
- **理由**：骨架一開始就符合 A8，後續功能 change 直接沿用，不必回頭改錯誤處理。
- **日期**：2026-11-20（維護者）
- **回修位置**：system-analysis 待決 2、需求矛盾 4；api-contract N9、N10 改為定案；proposal 保留 `response-localization`，拿掉「依待決 2」的但書

### Q3. 健康檢查是否實際查詢資料庫，連不上時回什麼

- **來源**：system-analysis 待決 11；api-contract §getHealth
- **問題**：Epic #502 要它落到兩種資料庫，B1 只說不碰業務資料，沒有定失敗語意。
- **決議**：健康檢查實際對資料庫執行一次 `SELECT 1`。成功回 200，`data` 為 `{status:"ok", database:"ok"}`；連不上回 `503 DATABASE_UNAVAILABLE` 的錯誤外層，PostgreSQL 連線最多等 5 秒。
- **理由**：這樣才符合 Epic #502「落到兩種資料庫」的要求，也讓 #505 的健康檢查頁有真的 error 狀態可以呈現。
- **日期**：2026-11-20（維護者）
- **回修位置**：system-analysis 待決 11；system-design 對應的 Sequence Diagram；api-contract §getHealth 改為定案

### Q4. 認證上線之後，健康檢查是否維持公開

- **來源**：system-analysis 待決 12；api-contract §端點總覽
- **問題**：本次所有端點都不需登入，沒有寫明健康檢查是刻意公開還是暫時沒擋。
- **決議**：健康檢查刻意公開，認證上線之後也一直維持公開。01-01 在 S10 權限矩陣把它列為刻意的例外。
- **理由**：負載平衡器、容器健康檢查與 #505 的頁面都不必登入就能呼叫；回應只有服務與資料庫的狀態，沒有可外洩的資料。
- **日期**：2026-11-20（維護者）
- **回修位置**：system-analysis 待決 12、§會被後續依賴的（交接給 01-01）；api-contract §端點總覽 的權限欄寫「公開（刻意）」

### Q5. 本次驗收用的 PostgreSQL 由誰提供

- **來源**：system-analysis 待決 4；system-design §技術待決問題
- **問題**：#504 驗收第 1 項要兩種資料庫都通過，但容器編排與 CI 的資料庫在 #506。
- **決議**：本次驗收用本機 `docker run postgres:16` 起暫時的資料庫，設定 `TEST_DATABASE_URL` 後跑 pytest。指令與結果寫進 `acceptance.md`。沒設這個變數時，PostgreSQL 測試自動跳過。CI 裡的 PostgreSQL 由 #506 建。
- **理由**：不提前做 #506 的 CI 工作，同時讓 #504 驗收第 1 項有可重現的驗法。
- **日期**：2026-11-20（維護者）
- **回修位置**：system-analysis 待決 4；system-design §技術待決問題 改為定案；tasks 要有 PostgreSQL 驗收步驟

### Q6. 本次是否建立 `ruff` 與 `mypy --strict`，並寫進 `config.yaml`

- **來源**：system-analysis 待決 15、需求矛盾 1
- **問題**：T9 把七項 gate 的實作歸給 #111，Epic #502 與 #506 把其中四項排給 #506；#504 只寫「補上後端的檢查指令」。
- **決議**：本次建立 `ruff check`、`ruff format --check` 與 `mypy --strict app`，寫進 `openspec/config.yaml` 的 `operations.apply.guidance`，只在本機與 apply 檢查時跑，不加 CI job。匯入方向、契約漂移、覆蓋率門檻與 Semgrep 留給 #506。
- **理由**：讓第一行後端程式就在檢查下寫成，之後不必回頭清一批錯誤。
- **日期**：2026-11-20（維護者）
- **回修位置**：system-analysis 待決 15、需求矛盾 1；proposal 的範圍寫明 `config.yaml` 的後端指令；tasks 要有更新 `config.yaml` 的 task

### Q7. `backend/pyproject.toml` 的初始版號

- **來源**：system-analysis 待決 5
- **問題**：Hard Rule 4 只允許 release commit 改版號，但建立檔案時就要有一個值，`CITATION.cff` 目前沒有 `version` 可以對齊。
- **決議**：`backend/pyproject.toml` 的初始版號用 `0.0.0`。#505 的 `frontend/package.json` 沿用同一個值。
- **理由**：`0.0.0` 表示還沒發過版，第一次 `chore(release)` 才改成正式版號，不會被誤讀成一次發版，符合 Hard Rule 4。
- **日期**：2026-11-20（維護者）
- **回修位置**：system-analysis 待決 5；交接給 #505

### Q8. 其餘契約與測試的建議預設是否一併採用

- **來源**：system-analysis 待決 6、7、8、9、13、14；system-design N2、N3、N4
- **問題**：以下都有 sd 寫好的建議預設，且有規則條文支撐，但一旦被 #505 的產生 client 使用，改動就屬 A10 的破壞性變更：
  - 6：成功 `code` 固定 `OK`；錯誤碼 `UPPER_SNAKE_CASE`，通用碼無前綴、模組碼加模組前綴；第一批六個通用碼
  - 7：`X-Correlation-ID` 與 `traceId` 同值；自帶值符合 `^[A-Za-z0-9-]{8,64}$` 才沿用，否則重新產生、不回錯誤
  - 8：`timestamp` 用 ISO 8601、UTC、毫秒、`Z` 結尾
  - 9：本次以 `pytest-cov` 產出覆蓋率報告，數字記在 `acceptance.md`；門檻由 #506 建
  - 13：建立一個空的基準遷移，讓「上、下、再上」在兩種資料庫實際跑過
  - 14：健康檢查放成第一個模組資料夾 `app/modules/health/`，走完整四件
  - N2：`openapi.json` 放 `backend/openapi.json` 並提交
  - N3：元件名 `XResponse`／`XPageResponse`／`XPage`
  - N4：驗證失敗與未處理例外用只存在於 `tests/` 的探測路由觸發
- **決議**：九項建議預設全部採用：6 的成功碼與錯誤碼規則、第一批六個通用碼；7 的 correlation ID 規則；8 的 timestamp 格式；9 的覆蓋率報告（門檻在 #506）；13 的空白基準遷移；14 的 `app/modules/health/`；N2 的 `backend/openapi.json`；N3 的元件命名；N4 只存在於 `tests/` 的探測路由。
- **理由**：每一項都有規則條文支撐，而且彼此獨立；之後要改哪一項，再另開 issue。
- **日期**：2026-11-20（維護者）
- **回修位置**：system-analysis 待決 6、7、8、9、13、14；system-design N2、N3、N4；api-contract 的錯誤碼表與外層欄位格式，改為定案

### Q9. `api-contract.md` 用哪種語言

- **來源**：api-contract N7
- **問題**：`AGENTS.md` Language Rules 第一列把「API contracts」列為 English only，同表的 `openspec/` 列要求 artifact 用繁體中文。
- **決議**：`api-contract.md` 的敘述用繁體中文。`AGENTS.md` 第一列的「API contracts」解讀為機器契約：`openapi.json`、schema 與識別字，這些維持英文。另開 #516 修正 `AGENTS.md` 的措辭，本 PR 不改 `AGENTS.md`。
- **理由**：`api-contract.md` 是 openspec artifact，適用 `openspec/` 那一列；措辭的歧義到下一個 change 還會再遇到，所以另開 issue 修正。
- **日期**：2026-11-20（維護者）
- **回修位置**：api-contract N7 標為已決，並寫上 #516

## 不需維護者決定的結論

| 項目                                      | 結論                                                                                                                        | 依據                                                                                               |
| :---------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| 待決 3：允許來源是否允許帶憑證            | 允許（`allow_credentials=True`），origins、methods、headers 都明列                                                          | ADR-004 D1 §後果已定「CORS 要設 credentials: true」；S2、Hard Rule 7                               |
| 待決 10、需求矛盾 2：健康檢查的回應形狀   | 有明確的 `HealthData` 與 `response_model`，放進 `openapi.json`                                                              | A2 的例外是「不必建」而不是「不得建」；Epic #502 要前端只用產生的型別顯示                          |
| 待決 16：未處理例外的 log                 | 寫一筆含 `traceId` 的 `ERROR`，不記 body、query、header、cookie                                                             | A7「correlation id 只進錯誤物件與 log」；ADR-008 D4 排除的是監控、指標與錯誤追蹤服務，不是 log；S9 |
| N1：撞名時父資源如何回到產生函式          | 本次只做「撞名就啟動失敗」，解法等第一次撞名的 change 再定                                                                  | 本次沒有實例                                                                                       |
| N5：最外層 `500` 沒有 CORS 標頭           | 已由 CORS 內側的 `UnhandledExceptionMiddleware` 處理；回應已開始送出時無法補救，只能靠 log。供 `code-reviewer` 與 #505 知悉 | system-design §請求穿過的層                                                                        |
| N6：`/docs`、`/redoc`、`/openapi.json`    | 本次維持 FastAPI 預設開啟，正式環境是否關閉交給 #506                                                                        | 部署設定屬 #506 §包含                                                                              |
| N8：schema 範本的 `400`／`422` 與 A7 相反 | 本 change 依 A7，不改範本；範本由 #517 修正                                                                                 | AGENTS.md §Required Behaviors：不在這次程式路徑上的錯誤另開 issue                                  |

## 明確問題（P）

無。五份產物的待決編號、Scenario 名稱與交接項互相對齊，沒有前一份提到、後一份漏掉的地方。Q 的決議會讓 sa、sd、planner 回修對應段落，那是依決議回修，不是 P。

## 交給後續產出

specs、design、tasks 要遵守：

1. **設定**：`CORS_ALLOWED_ORIGINS` 是唯一的必要設定，缺少、空清單或含 `*` 都啟動失敗，各寫一個 Scenario。其餘設定都有預設值（Q1）。
2. **本地化**：`response-localization` 是一個 capability。Scenario 涵蓋 zh-TW、en、q 值排序、預設 zh-TW、全部被拒回 `406 NOT_ACCEPTABLE`、`Content-Language` 標頭。`ErrorDetail.message` 維持英文，這是 A8 的例外（Q2）。
3. **健康檢查**：實際執行 `SELECT 1`，成功回 200 與 `HealthData`；連不上回 `503 DATABASE_UNAVAILABLE`。兩種資料庫各驗一次。endpoint 刻意公開，交接給 01-01 的 S10 矩陣（Q3、Q4）。
4. **PostgreSQL 驗收**：本機 `docker run postgres:16` 加 `TEST_DATABASE_URL`；沒設這個變數時，PostgreSQL 測試跳過、不算失敗。指令與結果寫進 `acceptance.md`（Q5）。
5. **檢查指令**：tasks 要有一個 task 把下列指令寫進 `openspec/config.yaml` 的 `operations.apply.guidance`：`uv run pytest`（兩種資料庫）、`ruff check`、`ruff format --check`、`mypy --strict app`、匯出 `openapi.json` 後跑 `git diff --exit-code`。不加 CI job（Q6）。
6. **版號**：`backend/pyproject.toml` 寫 `0.0.0`（Q7）。
7. **契約預設**：成功碼 `OK`、六個通用錯誤碼、correlation ID 規則、`timestamp` 格式、覆蓋率報告（不設門檻）、空白基準遷移的「上、下、再上」、`app/modules/health/` 四件、`backend/openapi.json`、元件命名、只存在於 `tests/` 的探測路由，都照 Q8 實作，tasks 逐項對得到。
8. **不在範圍**：不改 `AGENTS.md`（#516）、不改 schema 範本（#517）、不加 CI job、不設覆蓋率門檻、不建匯入方向與 Semgrep 檢查（#506）。
9. **測試集答案不外露**：沒有標記員能到達的端點；specs 仍要有 Scenario 鎖住 `500` 不回內部資訊、`422` 不回顯 `input`。
