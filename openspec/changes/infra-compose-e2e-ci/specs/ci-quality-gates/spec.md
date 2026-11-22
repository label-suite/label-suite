# Spec Delta

## Purpose

定義每張 pull request 在 CI 上執行的品質檢查與各自的失敗條件：前後端的 lint、型別、測試、雙資料庫、契約漂移、覆蓋率基準、容器編排驗證與 e2e，讓規則文件列為自動 gate 的項目在合併前被機械擋下，而不靠本機自律。

## ADDED Requirements

### Requirement: 前後端檢查每張 PR 都執行

CI 的前端、後端、契約漂移、覆蓋率、原始碼安全掃描、相依套件掃描與 e2e 檢查 SHALL 在每一張 pull request 上執行，MUST NOT 依變更路徑或目錄是否存在而跳過。既有的 `commit-messages`、`docs-site`、`format`、`specs` 四個 job MUST 維持不變。

來源：ADR-003 D1；testing-agent-rules T9；clarification Q9。

#### Scenario: 只改文件的 PR 也跑前後端檢查

- **WHEN** 開一張只修改 `docs/` 下檔案的 pull request
- **THEN** 前端、後端（兩種資料庫）、契約漂移、覆蓋率、原始碼安全掃描、相依套件掃描與 e2e 的 job 都執行，沒有被標為 skipped

#### Scenario: 既有四個 job 不變

- **WHEN** 比對本 change 前後的 CI 設定中 `commit-messages`、`docs-site`、`format`、`specs` 四個 job 的定義
- **THEN** 四個 job 的內容完全相同

### Requirement: 後端 lint、格式與型別檢查在 CI 執行

CI SHALL 對 `backend/` 執行 lint、格式檢查與嚴格型別檢查；任一項有違規 MUST 讓該 job 失敗。

來源：backend-agent-rules B2；testing-agent-rules T9；clarification Q4（取代 #504 Q6）。

#### Scenario: 後端型別錯誤時 CI 失敗

- **WHEN** PR 在後端加入一個回傳型別與宣告不符的函式
- **THEN** CI 的後端 job 在型別檢查那一步失敗

#### Scenario: 後端格式不符時 CI 失敗

- **WHEN** PR 在後端加入一個未依格式化工具排版的檔案
- **THEN** CI 的後端 job 在格式檢查那一步失敗

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

CI SHALL 重新匯出後端介面描述檔並重產前端呼叫層，與已提交的版本比對；任一處有修改、刪除或新增的檔案 MUST 讓 job 失敗並列出不同步的檔名。這一步 MUST NOT 需要環境變數、資料庫或起服務。

來源：api-agent-rules A5；主規格 `frontend-api-codegen`、`api-schema-export`；#506 §驗收條件 2。

#### Scenario: 介面描述檔或前端產物未重產時 CI 失敗

- **WHEN** PR 修改後端回應 schema，卻沒有重新匯出 `backend/openapi.json`
- **THEN** CI 的契約漂移 job 失敗，輸出列出 `backend/openapi.json`

#### Scenario: 介面描述檔已更新但前端未重產時 CI 失敗

- **WHEN** PR 提交了更新後的 `backend/openapi.json`，但沒有重產 `frontend/src/api/generated/`
- **THEN** CI 的契約漂移 job 失敗，輸出列出不同步的產物檔名

#### Scenario: 手改產物時 CI 失敗

- **WHEN** PR 直接修改 `frontend/src/api/generated/` 下的一個檔案
- **THEN** CI 的契約漂移 job 失敗

### Requirement: 覆蓋率不得低於基準

CI SHALL 把前後端的覆蓋率與 repo 根 `coverage-baseline.json` 比較；基準檔前後端各一段（後端一個整體百分比，前端 statements 與 branches 各一個），加一個容許誤差 0.1 個百分點。任一指標低於「基準減容許誤差」MUST 失敗並印出層、指標、基準與實測值；高於基準超過容許誤差時 SHALL 提示可更新基準，但不失敗，CI MUST NOT 自動寫回基準檔。

來源：ADR-007 D2；testing-agent-rules T10；clarification Q7；#506 §驗收條件 3。

#### Scenario: 覆蓋率低於基準時 CI 失敗

- **WHEN** 基準的前端 statements 為 90.0，PR 讓實測值變成 89.8
- **THEN** CI 的覆蓋率 job 失敗，輸出含「frontend」「statements」「90.0」「89.8」

#### Scenario: 在容許誤差內不失敗

- **WHEN** 基準的後端百分比為 95.0，PR 的實測值為 94.95
- **THEN** CI 的覆蓋率 job 成功

#### Scenario: 高於基準時提示更新但不失敗

- **WHEN** 基準的前端 branches 為 85.0，PR 的實測值為 86.0
- **THEN** CI 的覆蓋率 job 成功，輸出提示可更新基準，`coverage-baseline.json` 在該次執行中沒有被修改

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

CI SHALL 在 pull request 動到 `docker-compose.yml`、`docker-compose.prod.yml`、任一 Dockerfile、`backend/` 或 `frontend/` 時，驗證兩份編排檔的語法，並依序以 Lite 與正式層起服務、經公開入口取得健康檢查回應；任一服務不健康或回應不是 `ok` MUST 失敗。沒有動到上述路徑時這個驗證 SHALL 跳過。

來源：clarification Q1、Q9；ADR-008 D1；#506 §驗收條件 1；system-design D7。

#### Scenario: 動到編排檔時執行容器驗證

- **WHEN** PR 修改 `docker-compose.yml`
- **THEN** CI 執行容器編排驗證；兩層都健康且經公開入口的健康檢查 `data.status` 與 `data.database` 都是 `ok` 時才成功

#### Scenario: 只改文件時跳過容器驗證

- **WHEN** PR 只修改 `docs/` 下的檔案
- **THEN** 容器編排驗證被跳過，其餘檢查照常執行

### Requirement: e2e 每張 PR 執行

CI SHALL 在每張 pull request 以 SQLite 與前端開發伺服器執行 e2e；任一旅程失敗 MUST 讓該 job 失敗並保留報告供下載。

來源：clarification Q1、Q3；ADR-007 D1、D4；#506 §驗收條件 1。

#### Scenario: e2e 旅程失敗時 CI 失敗並保留報告

- **WHEN** PR 讓健康檢查頁的標題文字改變，使旅程找不到標題
- **THEN** CI 的 e2e job 失敗，該次執行有可下載的 e2e 報告

### Requirement: CI 檢查只有讀取權限且不使用 secret

本 change 新增的 CI job SHALL 只有讀取 repo 內容的權限，MUST NOT 使用 repo secret；log MUST NOT 印出環境變數的值。測試用資料庫的密碼是一次性容器的值，可寫在 CI 設定中。

來源：`AGENTS.md` Hard Rule 8；ADR-008 D3；security-agent-rules S9。

#### Scenario: 新 job 不引用 secret

- **WHEN** 讀取 CI 設定中本 change 新增的 job
- **THEN** 沒有任何 `secrets.` 引用，job 的權限只有 `contents: read`
