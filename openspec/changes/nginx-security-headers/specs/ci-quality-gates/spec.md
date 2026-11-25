# Spec Delta

## MODIFIED Requirements

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

容器編排驗證 SHALL 依序：確認容器編排工具的版本不低於專案寫明的最低版本，低於時 MUST 失敗並說明；驗證兩份編排檔的語法；確認缺少允許來源或正式層缺資料庫密碼時編排工具拒絕解析（這兩項沒有被拒絕時 MUST 失敗）；以 Lite 與正式層依序起服務、經公開入口取得健康檢查回應，再比對安全標頭（正式層另做瀏覽器檢查），停止後端後比對 502 回應的安全標頭。任一服務在 300 秒內沒有變成健康、或健康檢查回應的 `data.status`、`data.database` 不是 `ok` 時 MUST 失敗。

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
- **THEN** CI 執行容器編排驗證；Lite 與正式層各比對一次安全標頭、各在停止後端後比對一次 502 回應，正式層另做一次瀏覽器檢查，全部通過時驗證成功

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

## ADDED Requirements

### Requirement: 容器編排驗證比對公開入口的安全標頭

容器編排驗證 SHALL 在每一層經公開入口請求主規格 `security-headers` 列的各類回應，比對每個安全標頭的完整值與狀態碼。任一類缺少標頭、值不符、同名標頭出現超過一次、帶 `Strict-Transport-Security`、帶 `Content-Security-Policy-Report-Only` 或狀態碼不符時 MUST 失敗，輸出 MUST 列出回應類別、標頭名、期望值與實際值。

來源：issue #568 §驗收條件 2；ADR-008 D1；nginx-security-headers clarification Q1、Q3-附、Q4、system-design D2、D4。

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

#### Scenario: 後端停止後的 502 缺標頭時 CI 失敗

- **WHEN** 某一層停止後端後，公開入口對 `GET /api/v1/health` 的回應不是 `502`，或缺少任一安全標頭
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
