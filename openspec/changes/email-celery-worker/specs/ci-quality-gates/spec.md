## MODIFIED Requirements

### Requirement: 容器編排在相關變更時驗證

CI SHALL 在 pull request 動到 `docker-compose.yml`、`docker-compose.prod.yml`、`.env.example`、任一 Dockerfile、任一 `.dockerignore`、`frontend/nginx.conf`、`scripts/check-security-headers.sh`、`e2e/playwright.config.ts`、`e2e/public-entry/` 或 `e2e/shared/` 下的檔案、`backend/` 或 `frontend/` 時執行容器編排驗證；沒有動到上述路徑時這個驗證 SHALL 跳過。無法取得用來比較的 base commit 時 MUST 當作有動到而執行，不得跳過。

來源：clarification Q1、Q9；ADR-008 D1；#506 §驗收條件 1；system-design D7、D13；issue #568 §驗收條件 2、3；nginx-security-headers clarification Q4、P3；email-celery-worker clarification Q6（容器編排驗證以 `.env.example` 起兩層，寄信設定全有或全無會影響能否啟動）。

#### Scenario: 動到編排檔時執行容器驗證

- **WHEN** PR 修改 `docker-compose.yml`（或 `docker-compose.prod.yml`）
- **THEN** CI 執行容器編排驗證；兩層都健康且經公開入口的健康檢查 `data.status` 與 `data.database` 都是 `ok` 時才成功

#### Scenario: 動到後端程式時執行容器驗證

- **WHEN** PR 只修改 `backend/` 底下的一個檔案
- **THEN** CI 執行容器編排驗證

#### Scenario: 只改設定範例檔時執行容器驗證

- **WHEN** PR 只修改 `.env.example`
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

容器編排驗證 SHALL 依序：確認容器編排工具的版本不低於專案寫明的最低版本，低於時 MUST 失敗並說明；驗證兩份編排檔的語法；確認缺少允許來源或正式層缺資料庫密碼時編排工具拒絕解析（這兩項沒有被拒絕時 MUST 失敗）；比對兩份編排檔的結構（含 `redis` 與 `worker` 兩個服務，見主規格 `container-runtime`）；以 Lite 與正式層依序起服務、經公開入口取得健康檢查回應、確認 worker 回應 ping，再比對安全標頭（正式層另做瀏覽器檢查），停止後端後比對 502 或 504 回應的安全標頭。任一服務在 300 秒內沒有變成健康、健康檢查回應的 `data.status`、`data.database` 不是 `ok`，或 worker 沒有回應 ping 時 MUST 失敗。

來源：clarification Q1、Q9；ADR-008 D1；#506 §驗收條件 1；system-design D7、D13；issue #568 §驗收條件 2、3；nginx-security-headers clarification Q4；issue #756 §驗收條件 1；email-celery-worker clarification P1、技術預設「CI `compose`」。

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

#### Scenario: 編排檔少了 worker 或 worker 發布埠時 CI 失敗

- **WHEN** PR 刪掉任一份編排檔的 `worker` 服務，或為 `redis`、`worker` 加上 `ports`
- **THEN** CI 的容器編排驗證在起任何服務之前失敗，輸出指出是哪一層、哪一項結構不符

#### Scenario: 容器帶 eager 時 CI 失敗

- **WHEN** PR 讓任一份編排檔的 `backend` 或 `worker` 帶 `CELERY_TASK_ALWAYS_EAGER`
- **THEN** CI 的容器編排驗證失敗，輸出指出容器不得帶這個設定

#### Scenario: worker 停機寬限不足時 CI 失敗

- **WHEN** PR 把任一份編排檔的 `worker.stop_grace_period` 改成 300 秒以下，或讓 `worker` 的映像與 `backend` 不同
- **THEN** CI 的容器編排驗證失敗，輸出指出不符的那一項

#### Scenario: worker 沒有回應 ping 時 CI 失敗

- **WHEN** 任一層起好後，`docker compose exec worker celery -A app.worker inspect ping` 以非 0 結束
- **THEN** CI 的容器編排驗證失敗

## ADDED Requirements

### Requirement: 後端測試不需要佇列服務

CI 的兩個後端測試 job SHALL 不起 Redis 或 worker；寄信與背景工作的測試 MUST 在沒有佇列服務的情況下通過，寄信服務以對外 HTTP 客戶端那一層的替身取代。

來源：testing-agent-rules T6；backend-agent-rules B7；email-celery-worker clarification 技術預設「本機、CI、e2e 的背景工作」。

#### Scenario: 後端 job 沒有佇列服務

- **WHEN** 讀取 `.github/workflows/ci.yml` 的 `backend-sqlite` 與 `backend-postgres` 兩個 job
- **THEN** 兩者的 `services` 都沒有 Redis，步驟中沒有起 worker

#### Scenario: 寄信測試在沒有佇列服務時通過

- **WHEN** 在沒有任何 Redis 在執行的環境中，分別以 SQLite 與 PostgreSQL 執行 `uv run pytest`
- **THEN** 寄信與背景工作的測試都通過，沒有因連不上佇列而被跳過
