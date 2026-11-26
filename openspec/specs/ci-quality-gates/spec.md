# ci-quality-gates Specification

## Purpose

定義每張 pull request 在 CI 上執行的品質檢查與各自的失敗條件：前後端的 lint、型別、測試、雙資料庫、契約漂移、覆蓋率基準、容器編排驗證與 e2e，讓規則文件列為自動 gate 的項目在合併前被機械擋下，而不靠本機自律。

## Requirements

### Requirement: 前後端檢查每張 PR 都執行

CI 的前端、後端、契約漂移、覆蓋率、原始碼安全掃描、相依套件掃描、CI 輔助腳本測試與 e2e 檢查 SHALL 在每一張 pull request 上執行，MUST NOT 依變更路徑或目錄是否存在而跳過。既有的 `commit-messages`、`docs-site`、`format`、`specs` 四個 job MUST 維持不變。

來源：ADR-003 D1；testing-agent-rules T9；clarification Q9。

#### Scenario: 只改文件的 PR 也跑前後端檢查

- **WHEN** 開一張只修改 `docs/` 下檔案的 pull request
- **THEN** 前端、後端（兩種資料庫）、契約漂移、覆蓋率、原始碼安全掃描、相依套件掃描、CI 輔助腳本測試與 e2e 的 job 都執行，沒有被標為 skipped

#### Scenario: 既有四個 job 不變

- **WHEN** 比對本 change 前後的 CI 設定中 `commit-messages`、`docs-site`、`format`、`specs` 四個 job 的定義
- **THEN** 四個 job 的內容完全相同

### Requirement: 後端 lint、格式與型別檢查在 CI 執行

CI SHALL 對整個 `backend/` 執行 lint 與格式檢查，對 `backend/app` 執行嚴格型別檢查；任一項有違規 MUST 讓該 job 失敗。lint 的文件註解規則 SHALL 只約束 `backend/app`：公開的模組、類別、函式與方法缺文件註解，或文件註解的 `Args:` 段漏列參數，MUST 讓 lint 失敗；私有 helper（名稱以 `_` 開頭、不是 `__x__` 形式的特殊方法）、公開類別的建構子本身，以及 `backend/tests`、`backend/alembic` 底下的程式 MUST NOT 因文件註解而失敗。在 `backend/` 不帶嚴格參數執行的型別檢查 SHALL 與 CI 的嚴格型別檢查判定相同。

來源：backend-agent-rules B2；testing-agent-rules T9；infra-compose-e2e-ci clarification Q4（取代 #504 Q6）；issue #524 工作項 1 至 3；backend-strict-docstrings clarification Q1、Q2、Q3、Q6。

#### Scenario: 後端型別錯誤時 CI 失敗

- **WHEN** PR 在後端加入一個回傳型別與宣告不符的函式
- **THEN** CI 的後端 job 在型別檢查那一步失敗

#### Scenario: 後端格式不符時 CI 失敗

- **WHEN** PR 在後端加入一個未依格式化工具排版的檔案
- **THEN** CI 的後端 job 在格式檢查那一步失敗

#### Scenario: 公開介面缺 docstring 時 CI 失敗

- **WHEN** PR 在 `backend/app` 加入一個沒有文件註解的公開函式（或公開類別裡一個沒有文件註解的公開方法），其餘檢查都通過
- **THEN** CI 的後端 job 在 lint 那一步失敗，輸出列出該函式或方法所在的檔名與行號

#### Scenario: 文件註解漏列參數時 CI 失敗

- **WHEN** PR 在 `backend/app` 加入一個有兩個參數的公開函式，它的文件註解有 `Args:` 段但只描述其中一個參數
- **THEN** CI 的後端 job 在 lint 那一步失敗，輸出指出漏列的參數名

#### Scenario: 私有 helper 與建構子不需要 docstring

- **WHEN** PR 在 `backend/app` 加入一個名稱以 `_` 開頭、沒有文件註解的函式，以及一個有類別文件註解、但建構子沒有文件註解的公開類別，其餘程式都符合規則
- **THEN** CI 的後端 job 的 lint 那一步通過

#### Scenario: 測試與遷移腳本不受文件註解規則約束

- **WHEN** PR 在 `backend/tests` 加入一個沒有文件註解的測試函式，並在 `backend/alembic` 底下加入一個沒有文件註解的模組，其餘程式都符合規則
- **THEN** CI 的後端 job 的 lint 那一步通過

#### Scenario: 型別檢查範圍是 backend/app

- **WHEN** PR 只在 `backend/tests` 加入一個缺型別標註的輔助函式
- **THEN** CI 的後端 job 的型別檢查那一步通過；同一個函式放進 `backend/app` 時，型別檢查那一步失敗

#### Scenario: 本機不帶嚴格參數的型別檢查與 CI 一致

- **WHEN** `backend/app` 有一個缺型別標註的公開函式，開發者在 `backend/` 對 `app` 執行不帶嚴格參數的型別檢查
- **THEN** 檢查失敗，回報的錯誤與 CI 嚴格型別檢查回報的相同

### Requirement: 後端測試在兩種資料庫各跑一輪

CI SHALL 以 SQLite 與 PostgreSQL 各執行一次完整的後端測試，兩輪都包含遷移的升降升。PostgreSQL 那一輪被跳過的測試數 MUST 為 0，不為 0 時 MUST 失敗並列出被跳過的測試名；SQLite 那一輪 SHALL 在 job 摘要回報被跳過的測試數。

來源：backend-agent-rules B6、B7；testing-agent-rules T4、T11；`architecture.mdx` §部署與維運「本機與 CI」。

#### Scenario: PostgreSQL 那一輪有測試被跳過時 CI 失敗

- **WHEN** PR 讓一個標記為 PostgreSQL 的測試在 PostgreSQL 那一輪被跳過（其餘測試全部通過）
- **THEN** CI 的 PostgreSQL job 失敗，輸出列出被跳過的測試名

#### Scenario: SQLite 那一輪回報跳過數

- **WHEN** PR 的後端測試在 SQLite 那一輪全部通過
- **THEN** CI 的 SQLite job 成功，job 摘要寫出該輪被跳過的測試數

#### Scenario: 只在 PostgreSQL 失敗的測試讓 CI 失敗

- **WHEN** PR 加入一個在 SQLite 通過、在 PostgreSQL 失敗的測試
- **THEN** CI 的 PostgreSQL job 失敗，SQLite job 成功

### Requirement: 前端 lint、型別檢查、測試與建置在 CI 執行

CI SHALL 對 `frontend/` 依序執行 lint、型別檢查、含覆蓋率的測試與正式建置，每一步呼叫的 MUST 是前端 package 的同一個 script；lint 有任何錯誤或警告、型別錯誤、測試失敗或建置失敗 MUST 讓該 job 失敗。

來源：frontend-agent-rules F1、F2、F3；ADR-005 D2；testing-agent-rules T9；clarification Q4；#506 留言（2026-11-21）第 1 點。

#### Scenario: 前端違反分層或有警告時 lint 失敗

- **WHEN** PR 讓 `components/` 下的檔案 import `pages/` 下的模組，或讓任一規則產生一則警告
- **THEN** CI 的前端 job 在 lint 那一步失敗，後續的型別檢查、測試與建置不執行

#### Scenario: 前端型別錯誤時 CI 失敗

- **WHEN** PR 在前端把陣列索引取得的值直接當成非 undefined 使用
- **THEN** CI 的前端 job 在型別檢查那一步失敗

### Requirement: 探針殘留檔不影響後續步驟

前端 job SHALL 從乾淨的工作目錄開始，不含先前執行留下的未追蹤檔案；測試步驟失敗或逾時後，同一 job 的後續步驟 MUST NOT 執行。前端 job SHALL 設有逾時上限。

來源：#506 留言（2026-11-21）第 2 點；testing-agent-rules T5；system-design D10。

#### Scenario: 測試步驟逾時後不執行後續步驟

- **WHEN** 前端 job 的測試步驟在寫入探針檔後因逾時被終止
- **THEN** 該 job 失敗，建置步驟沒有執行；下一次執行的前端 job 在 lint 之前，工作目錄中沒有該探針檔

### Requirement: 契約產物不同步時 CI 失敗

CI SHALL 重新匯出後端介面描述檔（含文件站副本）並重產前端呼叫層，與已提交的版本比對；任一處有修改、刪除或新增的檔案 MUST 讓 job 失敗並列出不同步的檔名。比對範圍 MUST 包含 `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json`。失敗訊息 MUST 提示以 `pnpm run api:sync` 重產並一起提交。這一步 MUST NOT 需要環境變數、資料庫或起服務。前端呼叫層仍只由 `backend/openapi.json` 產生，副本 MUST NOT 成為任何產生工具的輸入。

來源：api-agent-rules A5；主規格 `frontend-api-codegen`、`api-schema-export`；#506 §驗收條件 2；issue #572 §維護者裁定（2026-11-23）、§驗收條件 3；ADR-003 D6。

#### Scenario: 介面描述檔或前端產物未重產時 CI 失敗

- **WHEN** PR 修改後端回應 schema，卻沒有重新匯出 `backend/openapi.json`
- **THEN** CI 的契約漂移 job 失敗，輸出列出 `backend/openapi.json`

#### Scenario: 介面描述檔已更新但前端未重產時 CI 失敗

- **WHEN** PR 提交了更新後的 `backend/openapi.json`，但沒有重產 `frontend/src/api/generated/`
- **THEN** CI 的契約漂移 job 失敗，輸出列出不同步的產物檔名

#### Scenario: 手改產物時 CI 失敗

- **WHEN** PR 直接修改 `frontend/src/api/generated/` 下的一個檔案
- **THEN** CI 的契約漂移 job 失敗

#### Scenario: 契約副本與後端契約不一致時 CI 失敗

- **WHEN** PR 直接修改 `docs/diagrams/architecture/api.openapi.json`，使它與 `backend/openapi.json` 不同
- **THEN** CI 的契約漂移 job 失敗，輸出列出 `docs/diagrams/architecture/api.openapi.json`
- **AND** 輸出提示執行 `pnpm run api:sync` 並一起提交

#### Scenario: 副本漏提交或被刪除時 CI 失敗

- **WHEN** PR 修改後端回應 schema 並提交了重新匯出的 `backend/openapi.json`，但沒有提交更新後的副本，或刪除了副本
- **THEN** CI 的契約漂移 job 失敗，輸出列出 `docs/diagrams/architecture/api.openapi.json`

#### Scenario: 兩份契約都與重新匯出結果一致時通過

- **WHEN** PR 提交的 `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 都等於重新匯出的結果
- **THEN** 契約漂移 job 的這一步成功，繼續比對前端呼叫層

### Requirement: 覆蓋率不得低於基準

CI SHALL 把前後端的覆蓋率與 PR 所帶的 repo 根 `coverage-baseline.json` 比較；基準檔前後端各一段（後端一個整體百分比，前端 statements 與 branches 各一個），加一個容許誤差 0.1 個百分點。任一指標低於「基準減容許誤差」MUST 失敗並印出層、指標、基準與實測值。訊息中的百分比數字一律固定為小數點後一位（90 印成「90.0」、89.8 印成「89.8」）；寫進建議基準檔的數字則是 JSON 數值（90.0 寫成 `90`，不補零）。PR 的基準檔不存在或缺欄位時 MUST 失敗並說明缺什麼，MUST NOT 以 0 或任何預設值代替。覆蓋率是否通過與基準該填多少，一律以 CI 量到的數字為準（本機自查的對應行為見 `workspace-commands`）。

來源：ADR-007 D2；testing-agent-rules T10；clarification Q7；維護者規劃審查裁定 R-A（2026-11-22）；#506 §驗收條件 3。

#### Scenario: 覆蓋率低於基準時 CI 失敗

- **WHEN** 基準的前端 statements 為 90.0，PR 讓實測值變成 89.8
- **THEN** CI 的覆蓋率 job 失敗，輸出含「frontend」「statements」「90.0」「89.8」

#### Scenario: 在容許誤差內不失敗

- **WHEN** 基準的後端百分比為 95.0，PR 的實測值為 94.95
- **THEN** CI 的覆蓋率 job 成功

#### Scenario: 基準檔缺失時 CI 失敗

- **WHEN** PR 的 repo 根沒有 `coverage-baseline.json`，或其中缺少前端 branches 欄位
- **THEN** CI 的覆蓋率 job 失敗，輸出指出缺少的檔案或欄位名

### Requirement: 覆蓋率基準只能持平或上升

CI SHALL 另取 PR base 分支上的 `coverage-baseline.json`，與 PR 所帶的基準檔逐項比較：PR 基準的任一指標低於 base 的對應值，或容許誤差大於 base 的值時，覆蓋率 job MUST 失敗並列出被調低的欄位與兩邊的值；唯一例外是 PR 帶有 `coverage-baseline-lower` 標籤（由維護者加上），此時不做這項比較。加上或拿掉該標籤 SHALL 讓 CI 重新執行，覆蓋率 job 的結果跟著標籤更新。base 分支上沒有基準檔時 SHALL 略過這項比較並在輸出註明，其餘比較照常。

來源：ADR-007 D2；testing-agent-rules T10；clarification Q7；維護者規劃審查裁定 R-A（2026-11-22）；#506 §驗收條件 3。

#### Scenario: 沒有標籤時調低基準讓 CI 失敗

- **WHEN** base 分支的基準前端 statements 為 90.0，PR 把 `coverage-baseline.json` 的該值改成 88.0、實測值為 88.5，PR 沒有 `coverage-baseline-lower` 標籤
- **THEN** CI 的覆蓋率 job 失敗，輸出含「frontend」「statements」「90.0」「88.0」，並說明調低基準須由維護者加上 `coverage-baseline-lower` 標籤

#### Scenario: 放寬容許誤差視同調低

- **WHEN** base 分支的基準容許誤差為 0.1，PR 把它改成 0.5，PR 沒有 `coverage-baseline-lower` 標籤
- **THEN** CI 的覆蓋率 job 失敗，輸出指出容許誤差被放寬

#### Scenario: 有標籤時調低基準可以通過

- **WHEN** 同一張調低前端 statements 到 88.0、實測值為 88.5 的 PR，由維護者加上 `coverage-baseline-lower` 標籤
- **THEN** CI 重新執行，覆蓋率 job 成功

#### Scenario: 拿掉標籤後恢復失敗

- **WHEN** 上一個 Scenario 的 PR 被拿掉 `coverage-baseline-lower` 標籤
- **THEN** CI 重新執行，覆蓋率 job 失敗

#### Scenario: base 分支沒有基準檔時略過調低比較

- **WHEN** base 分支上不存在 `coverage-baseline.json`，PR 帶有完整的基準檔且實測值不低於它
- **THEN** CI 的覆蓋率 job 成功，輸出註明 base 分支沒有基準檔、已略過調低比較

### Requirement: 覆蓋率上升時產生建議基準

更新基準是選擇性的。實測值高於 PR 基準超過容許誤差時，覆蓋率 job MUST NOT 失敗，SHALL 在輸出印出完整的建議基準檔內容（上升的指標換成實測值，其餘沿用 PR 基準，容許誤差不變），並以名為 `coverage-baseline-suggested` 的 artifact 供下載。PR 不更新基準照樣通過。CI MUST NOT 自動寫回基準檔或提交任何變更。

來源：ADR-007 D2；testing-agent-rules T10；clarification Q7；維護者規劃審查裁定 R-A（2026-11-22）；#506 §驗收條件 3。

#### Scenario: 覆蓋率上升時通過並產生建議基準

- **WHEN** PR 與 base 的基準前端 branches 都是 85.0，PR 的實測值為 86.0，其餘指標不變
- **THEN** CI 的覆蓋率 job 成功
- **AND** 輸出含完整的建議基準檔內容，其中前端 branches 為 `86`（JSON 數值）、其餘值與 PR 基準相同、容許誤差為 0.1
- **AND** 該次執行有名為 `coverage-baseline-suggested` 的 artifact，內容與輸出的建議基準相同
- **AND** `coverage-baseline.json` 在該次執行中沒有被修改，CI 沒有推送任何 commit

#### Scenario: 不更新基準照樣通過

- **WHEN** PR 的實測值高於基準超過容許誤差，作者沒有提交建議基準
- **THEN** CI 的覆蓋率 job 成功

### Requirement: 覆蓋率的量測範圍

後端覆蓋率 SHALL 合併 SQLite 與 PostgreSQL 兩輪的結果，分母只含 `backend/app/`（不含遷移腳本與設定）。前端覆蓋率的分母 SHALL 涵蓋 `frontend/src/` 下所有原始檔，排除產生的呼叫層、測試輔助目錄、測試檔、型別宣告檔與設定檔；未被任何測試載入的原始檔 MUST 以 0% 計入分母。

來源：ADR-007 D2；testing-agent-rules T10；clarification Q7、Q8。

#### Scenario: 新增未測試的前端檔案時覆蓋率下降

- **WHEN** PR 在 `frontend/src/lib/` 新增一個沒有任何測試 import 的原始檔
- **THEN** 前端 statements 的實測值低於新增前，該檔出現在覆蓋率報告中

#### Scenario: 產物不算進分母

- **WHEN** 檢視前端覆蓋率報告列出的檔案
- **THEN** 沒有 `src/api/generated/` 與 `src/test/` 下的檔案

#### Scenario: 只在 PostgreSQL 走到的分支計入後端覆蓋率

- **WHEN** 一段後端分支只有在 PostgreSQL 那一輪會執行
- **THEN** 合併後的後端覆蓋率報告把該分支標為已覆蓋

### Requirement: 容器編排在相關變更時驗證

CI SHALL 在 pull request 動到 `docker-compose.yml`、`docker-compose.prod.yml`、任一 Dockerfile、任一 `.dockerignore`、`frontend/nginx.conf`、`scripts/check-security-headers.sh`、`e2e/playwright.config.ts`、`e2e/public-entry/` 或 `e2e/shared/` 下的檔案、`backend/` 或 `frontend/` 時執行容器編排驗證；沒有動到上述路徑時這個驗證 SHALL 跳過。無法取得用來比較的 base commit 時 MUST 當作有動到而執行，不得跳過。

來源：clarification Q1、Q9；ADR-008 D1；#506 §驗收條件 1；system-design D7、D13；issue #568 §驗收條件 2、3；nginx-security-headers clarification Q4、P3。

#### Scenario: 動到編排檔時執行容器驗證

- **WHEN** PR 修改 `docker-compose.yml`（或 `docker-compose.prod.yml`）
- **THEN** CI 執行容器編排驗證；兩層都健康且經公開入口的健康檢查 `data.status` 與 `data.database` 都是 `ok` 時才成功

#### Scenario: 動到後端程式時執行容器驗證

- **WHEN** PR 只修改 `backend/` 底下的一個檔案
- **THEN** CI 執行容器編排驗證

#### Scenario: 只改文件時跳過容器驗證

- **WHEN** PR 只修改 `docs/` 下的檔案
- **THEN** 容器編排驗證被跳過，其餘檢查照常執行

#### Scenario: 取不到 base commit 時執行容器驗證

- **WHEN** 用來比較的 base commit 為空、全為 0 或在 repo 中找不到
- **THEN** CI 執行容器編排驗證，輸出說明因取不到 base 而一律執行

#### Scenario: 只改標頭驗證時執行容器驗證

- **WHEN** PR 只修改 `scripts/check-security-headers.sh`、`e2e/playwright.config.ts`、`e2e/public-entry/` 下的任一檔案（含新增的 spec）或 `e2e/shared/` 下的任一檔案，其中一個
- **THEN** CI 執行容器編排驗證

#### Scenario: 只改其他 e2e 旅程時跳過容器驗證

- **WHEN** PR 只修改 `e2e/system-health/dev-health.spec.ts`
- **THEN** 容器編排驗證被跳過，e2e 檢查照常執行

### Requirement: 容器編排驗證的步驟與失敗條件

容器編排驗證 SHALL 依序：確認容器編排工具的版本不低於專案寫明的最低版本，低於時 MUST 失敗並說明；驗證兩份編排檔的語法；確認缺少允許來源或正式層缺資料庫密碼時編排工具拒絕解析（這兩項沒有被拒絕時 MUST 失敗）；以 Lite 與正式層依序起服務、經公開入口取得健康檢查回應，再比對安全標頭（正式層另做瀏覽器檢查），停止後端後比對 502 或 504 回應的安全標頭。任一服務在 300 秒內沒有變成健康、或健康檢查回應的 `data.status`、`data.database` 不是 `ok` 時 MUST 失敗。

來源：clarification Q1、Q9；ADR-008 D1；#506 §驗收條件 1；system-design D7、D13；issue #568 §驗收條件 2、3；nginx-security-headers clarification Q4。

#### Scenario: 缺必要設定卻沒有被拒絕時 CI 失敗

- **WHEN** PR 把 Lite 編排檔的允許來源改成帶預設值，使 `.env` 缺少該設定時編排工具仍能解析
- **THEN** CI 的容器編排驗證失敗，輸出指出「缺少允許來源時應拒絕」的檢查沒有成立

#### Scenario: 服務逾時未健康時 CI 失敗

- **WHEN** PR 讓後端在 300 秒內都無法通過容器健康檢查
- **THEN** CI 的容器編排驗證失敗，輸出指出未健康的服務

#### Scenario: 編排工具版本過舊時 CI 失敗

- **WHEN** 執行容器編排驗證的環境中，編排工具的版本低於專案寫明的最低版本
- **THEN** 容器編排驗證在起任何服務之前失敗，輸出含實際版本與要求的最低版本

#### Scenario: 動到公開入口時 CI 驗證兩層的安全標頭

- **WHEN** PR 只修改 `frontend/nginx.conf`，且它的安全標頭符合主規格 `security-headers`
- **THEN** CI 執行容器編排驗證；Lite 與正式層各比對一次安全標頭、各在停止後端後比對一次 502 或 504 回應，正式層另做一次瀏覽器檢查，全部通過時驗證成功

### Requirement: e2e 每張 PR 執行

CI SHALL 在每張 pull request 以 SQLite 與前端開發伺服器執行 e2e；任一旅程失敗 MUST 讓該 job 失敗並保留報告供下載。

來源：clarification Q1、Q3；ADR-007 D1、D4；#506 §驗收條件 1。

#### Scenario: e2e 旅程失敗時 CI 失敗並保留報告

- **WHEN** PR 讓健康檢查頁的標題文字改變，使旅程找不到標題
- **THEN** CI 的 e2e job 失敗，該次執行有可下載的 e2e 報告

### Requirement: CI 輔助腳本的測試獨立執行

本 change 新增的 CI 輔助腳本（覆蓋率比較、跳過數檢查、變更路徑判斷、本機自查與本機開發指令）、安全標頭比對腳本與 CI 設定本身的回歸測試 SHALL 在每張 pull request 執行，MUST NOT 等待其他 CI 檢查完成才開始，也 MUST NOT 因其他檢查失敗而不執行；任一測試失敗 MUST 讓該檢查失敗。

來源：testing-agent-rules T9、T11；agent-rules（loud failure）；system-design D13；nginx-security-headers clarification Q4、design D3。

#### Scenario: 後端測試失敗時腳本測試照樣執行

- **WHEN** PR 讓後端測試失敗，同時讓覆蓋率比較腳本的一個測試失敗
- **THEN** CI 的腳本測試檢查照樣執行並失敗，輸出指出失敗的腳本測試；它的結果不必等覆蓋率檢查

#### Scenario: CI 設定的回歸測試抓到被跳過的檢查

- **WHEN** PR 在 CI 設定中給後端 SQLite 那一輪的檢查加上依路徑或條件跳過的設定
- **THEN** CI 的腳本測試檢查失敗，輸出指出該檢查不得被條件跳過

#### Scenario: 安全標頭比對腳本的測試在腳本測試檢查中執行

- **WHEN** PR 修改安全標頭比對腳本，使它收到重複的同名標頭時不再失敗
- **THEN** CI 的腳本測試檢查失敗，輸出指出安全標頭比對腳本中檢查重複標頭的那一個測試；這個結果不必等容器編排驗證

### Requirement: CI 檢查只有讀取權限且不使用 secret

本 change 新增的 CI job SHALL 只有讀取 repo 內容的權限，MUST NOT 使用 repo secret；log MUST NOT 印出環境變數的值。測試用資料庫的密碼是一次性容器的值，可寫在 CI 設定中。

來源：`AGENTS.md` Hard Rule 8；ADR-008 D3；security-agent-rules S9。

#### Scenario: 新 job 不引用 secret

- **WHEN** 讀取 CI 設定中本 change 新增的 job
- **THEN** 沒有任何 `secrets.` 引用，job 的權限只有 `contents: read`

### Requirement: 容器編排驗證比對公開入口的安全標頭

容器編排驗證 SHALL 在每一層經公開入口請求主規格 `security-headers` 列的各類回應，比對每個安全標頭的完整值與狀態碼。任一類缺少標頭、值不符、同名標頭出現超過一次、帶 `Strict-Transport-Security`、帶 `Content-Security-Policy-Report-Only` 或狀態碼不符時 MUST 失敗，輸出 MUST 列出回應類別、標頭名、期望值與實際值。

來源：issue #568 §驗收條件 2；ADR-008 D1；nginx-security-headers clarification Q1、Q3-附、Q4、Q11、system-design D2、D4。

#### Scenario: 安全標頭被刪除時 CI 失敗

- **WHEN** PR 從 `frontend/nginx.conf` 刪掉 `Content-Security-Policy` 那一行
- **THEN** CI 的容器編排驗證在 Lite 層比對安全標頭那一步失敗，輸出含回應類別、`Content-Security-Policy`、期望的完整值，實際值印成 `<missing>`

#### Scenario: 安全標頭值不符時 CI 失敗

- **WHEN** PR 把 `frontend/nginx.conf` 的 `X-Frame-Options` 改成 `DENY`
- **THEN** CI 的容器編排驗證失敗，輸出含回應類別、`X-Frame-Options`、期望值 `SAMEORIGIN` 與實際值 `DENY`

#### Scenario: 某條路徑漏掉安全標頭時 CI 失敗

- **WHEN** PR 在 `frontend/nginx.conf` 轉發 `/api/v1/` 的區塊內另加一個自己的回應標頭，使該路徑的回應不再帶 server 層級的安全標頭
- **THEN** CI 的容器編排驗證失敗，輸出指出後端成功回應與後端錯誤回應兩類缺少的標頭

#### Scenario: 回應帶 HSTS 時 CI 失敗

- **WHEN** PR 在 `frontend/nginx.conf` 加上 `Strict-Transport-Security` 標頭
- **THEN** CI 的容器編排驗證失敗，輸出指出回應不得帶 `Strict-Transport-Security`

#### Scenario: 同名標頭重複時 CI 失敗

- **WHEN** PR 讓同一個安全標頭在後端回應中出現兩次（例如後端也送出 `X-Frame-Options`）
- **THEN** CI 的容器編排驗證失敗，輸出指出該標頭出現的次數

#### Scenario: 後端停止後的 502 或 504 缺標頭時 CI 失敗

- **WHEN** 某一層停止後端後，公開入口對 `GET /api/v1/health` 的回應既不是 `502` 也不是 `504`，或缺少任一安全標頭
- **THEN** CI 的容器編排驗證失敗，輸出指出該回應類別與不符的狀態碼或標頭

### Requirement: 容器編排驗證在正式層做瀏覽器檢查

容器編排驗證 SHALL 在正式層服務健康、停止後端之前，以瀏覽器對公開入口執行主規格 `security-headers`「CSP 不擋前端自己的資源」的判準；未達判準時 MUST 失敗，輸出 MUST 列出被擋的指令與位址或失敗的請求。這項檢查 MUST NOT 在 e2e 檢查中執行。

來源：issue #568 §驗收條件 3；nginx-security-headers clarification Q4、Q5、system-design D5、D6。

#### Scenario: CSP 擋下前端資源時 CI 失敗

- **WHEN** PR 在 `frontend/index.html` 加入一段內嵌 `<script>`，`frontend/nginx.conf` 不變
- **THEN** 兩層的安全標頭比對都通過，CI 的容器編排驗證在正式層的瀏覽器檢查失敗，輸出含被擋的指令（`script-src` 或 `script-src-elem`）

#### Scenario: 瀏覽器檢查不在 e2e 檢查中執行

- **WHEN** 檢視任一張 PR 的 e2e 檢查所執行的旅程清單
- **THEN** 清單中沒有 `e2e/public-entry/` 下的旅程

### Requirement: 認證與授權的關鍵路徑分支覆蓋率門檻

CI SHALL 依 repo 根的關鍵路徑清單，分別計算「認證」與「授權與權限檢查」兩項在後端與前端的分支覆蓋率（兩輪後端合併），任一項任一層低於 90% MUST 失敗並印出項目、層、門檻與實測值（小數點後一位）。清單列到的檔案不存在或不在覆蓋率報告裡 MUST 失敗並點名該檔。清單只含這兩項，不得有其他三項的空項目。

來源：testing-agent-rules T10；ADR-007 D2；Issue #719 §驗收條件；login-auth-guard 決定表 sa-13；`system-design.md` §維護者的決定 覆蓋率門檻的後端路徑清單。

#### Scenario: 認證項低於門檻時 CI 失敗

- **WHEN** 認證項的後端檔案分支合計 200 個、覆蓋 178 個（89.0%）
- **THEN** CI 的覆蓋率 job 失敗，輸出含「authentication」「backend」「90.0」「89.0」

#### Scenario: 兩項都達標時通過

- **WHEN** 兩項在兩層的分支覆蓋率都不低於 90.0%
- **THEN** 關鍵路徑檢查成功

#### Scenario: 清單列到不存在的檔案時失敗

- **WHEN** 關鍵路徑清單列了 `backend/app/core/no_such.py`
- **THEN** 檢查失敗，輸出點名 `backend/app/core/no_such.py`

#### Scenario: 清單只有兩項

- **WHEN** 讀取關鍵路徑清單
- **THEN** 清單恰好有「認證」與「授權與權限檢查」兩項，沒有答案隔離、評分或 IAA 計算的項目
