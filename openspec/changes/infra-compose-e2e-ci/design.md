# Design

## Context

動機見 `proposal.md` §Why。本文只記實作取捨；檔案佈局、編排拓撲、CI job 步驟、本機自查順序與設定範例檔的欄位都已寫在 `system-design.md`，這裡指過去，不重抄。

會影響做法的現況與限制：

- `backend/` 與 `frontend/` 已由 #504、#505 建好；兩邊的 lint、型別檢查、測試只在本機跑，CI 只有 `commit-messages`、`docs-site`、`format`、`specs` 四個 job（`.github/workflows/ci.yml`）。這四個 job 一字不動（system-design §CI job 設計）。
- 既有 `specs` job 逐一列出 `scripts/tests/` 下要跑的測試檔，不用萬用字元；本 change 新增的腳本測試不會自動被它執行（見 D11）。
- 根目錄 `package.json` 沒有 YAML 解析器的直接依賴（`yaml` 只以間接依賴出現在 `pnpm-lock.yaml`）；對 `ci.yml` 做靜態斷言需要它（見 D14）。
- #528（`fix-pages-root-layer-classification`）尚未歸檔，連 `origin/main` 的主規格 `frontend-code-boundaries` 都還是歸檔前的版本，而它的 delta 以 MODIFIED 改寫「依分層限制 import 方向」（見 D2）。
- 本次沒有 API、資料表或 UI 變更：`api-contract.md`、`ui-design.md` 都只有一行，system-design §資料模型異動 為「無」。
- 維護者在 `clarification.md` Q1–Q15 已全數裁定（2026-11-22），規劃審查時再裁定 R-A（覆蓋率基準與 base 分支比較，只能持平或上升，調低須維護者加 `coverage-baseline-lower` 標籤）與 R-B（#506 驗收條件 6 改 `AGENTS.md` 的部分依 Q12 (c) 移給 #523）；本文不與之矛盾。還開著的是技術風險 N5（R1）與 N6（R9）。

## Goals / Non-Goals

**Goals:**

- 每一個 delta spec 的 Scenario 都有一個 CI job 步驟、一支測試或一條寫明預期結束碼與輸出的本機指令能客觀判定（對照見 D4）。
- 本機 `check` 與 CI 呼叫同一個 package script 或同一個指令，兩邊不另寫參數（system-design §本機自查的步驟）。
- 每個 task 群組可以獨立提交、獨立驗證；後面的群組不必回頭修前面群組欠的測試或文件。

**Non-Goals:**

- 不改 `main` ruleset，也不在本 change 內決定哪些 job 必過（Q10）；CI job 名稱照 system-design §CI job 設計 固定，方便之後的 ruleset issue 引用。
- 不為 Docker 建置加 layer cache（system-design §效能與資源：實測耗時後再定）。
- 不改後端或前端的產品程式；本次的程式改動限於設定檔、腳本、編排檔與 `e2e/`。若 apply 時發現既有程式違反新加的檢查（分層契約、Semgrep、零警告），停下回報，不在本 change 內順手重構（R5）。

## Decisions

### D1 capability 切成六個新增加一個修改，安全掃描獨立

`ci-quality-gates` 只放品質檢查；Semgrep 與相依套件掃描拆成 `security-scanning`。理由：兩者的依據是 Hard Rule 7、8 與 ADR-008 D8，與 T9、T10 的品質門檻來源不同，之後調整安全門檻（例如加規則、改嚴重度）時只動一個 capability。替代方案是全部放在 `ci-quality-gates`：一份 spec 會超過二十個 requirement，且安全與品質的修改理由混在一起。`ci-quality-gates` 的「每張 PR 都執行」requirement 仍把兩個安全 job 列進「不得依路徑跳過」，因為那是執行條件，不是掃描內容。

### D2 `frontend-code-boundaries` 以 ADDED 新增「lint 不容許警告」

#528 的 delta 以 MODIFIED 改寫「依分層限制 import 方向」，而 #528 尚未歸檔。若本 change 也 MODIFIED 同一個 requirement，就得選一個基準：以歸檔前的主規格為準，#528 先歸檔時本 change 的 MODIFIED 會覆蓋掉 #528 加的字句；以 #528 歸檔後的文字為準，本 change 先歸檔時會把尚未定案的字句帶進主規格。改成 ADDED 一個獨立 requirement，兩張 change 不碰同一段文字，歸檔順序互不影響。「分不出層的檔案在零警告下仍失敗」這個 Scenario 只描述 lint 結果，不引用 #528 改寫的字句。

clarification §交給後續產出 要求「以 #528 歸檔後的主規格為基準」；本做法讓本 change 的 delta 不論基準是哪一版都成立，沒有違反那條交辦。若 design-reviewer 認為仍須等 #528 歸檔，再改為 MODIFIED。

### D3 容器編排照 system-design D1–D6

遷移是一次性服務、正式層是獨立檔、Lite 用具名 volume、缺密碼時由 Compose 拒絕啟動、30 秒健康檢查、前端 nginx 是唯一公開入口，全部依 system-design §部署拓撲 與 D1–D6，本文不另做選擇。規劃審查後 system-design 補上的三點也照寫：兩份編排檔的 `frontend` 都以 `depends_on: backend: condition: service_healthy` 等後端健康（D5）；`CORS_ALLOWED_ORIGINS` 寫成 `${CORS_ALLOWED_ORIGINS:?set CORS_ALLOWED_ORIGINS in .env}`、不給預設值（D6）；`up` 一律帶 `--wait-timeout 300`（D7）。實作上要注意的兩點：

- 前端映像以 repo 根為 build context，需要根目錄 `.dockerignore` 排除 `node_modules`、`.git`、`docs/` 等；`design/prototype/assets/` 只讀取（frontend-skeleton design D8）。
- 容器建置時 `VITE_API_BASE_URL` 為空字串，前端呼叫走同源的 `/api/v1`，由 nginx 轉發（system-design D6）。空字串時產生的呼叫層組出的網址是否正確，由 compose job 經公開入口取健康檢查、以及 frontend 群組的一支單元測試共同確認（R6）。

### D4 CI job 與 Scenario 的對應

job 名稱、步驟與失敗條件照 system-design §CI job 設計 的表。每個 capability 由哪裡判定：

| capability                 | 判定的 job 或指令                                                                                |
| :------------------------- | :----------------------------------------------------------------------------------------------- |
| `container-runtime`        | `compose` job（system-design D7，加下方 compose 靜態斷言）；其餘起停容器的負向情境依下表本機重現 |
| `workspace-commands`       | `scripts-tests` job 裡 `check`、`dev` 的 `node --test` 測試（D10、D11）                          |
| `e2e-testing`              | `e2e` job；位址、等待、fixtures 三條靜態約束由 e2e 套件內的一支掃描測試判定（D7）                |
| `backend-code-boundaries`  | `backend-sqlite` job 的 `lint-imports` 步驟與後端 unit 測試（D9）                                |
| `ci-quality-gates`         | 各對應 job；負向情境依下表，靠設定靜態測試或本機重現判定                                         |
| `security-scanning`        | `semgrep` job（含 `semgrep --test`）、`dependency-audit` job                                     |
| `frontend-code-boundaries` | `frontend` job 的 lint 步驟；「降成警告仍失敗」由前端既有探針測試的一個新案例判定                |

**負向情境不靠「在 PR 上推一個刻意失敗的 commit」驗證。** `ci-quality-gates` 與 `container-runtime` 的每個負向 Scenario，驗證方式是下列三種之一（下表「驗證方式」欄）：

- **設定靜態測試**：`scripts/tests/ci-workflow.test.mjs` 以 YAML 解析 `.github/workflows/ci.yml`，斷言 job 的條件、相依、逾時與步驟順序（D14）。在 `scripts-tests` job 每張 PR 跑；斷言編號 C1–C11 見表後。
- **腳本測試**：`scripts/tests/` 下各腳本自己的 `node --test`，以 fixture 餵入檔案或參數、斷言結束碼與輸出，同樣在 `scripts-tests` job 跑。
- **本機重現**：在本機執行表中的指令，預期結果寫在表裡；執行的 task 把指令、實際結束碼與關鍵輸出記在該群組的提交訊息，acceptance-verifier 依 `acceptance.md` 的手動步驟重跑。重現用到的暫時修改在記錄後還原，不提交。

| capability          | 負向 Scenario                                        | 判定位置             | 驗證方式                                                                                                                                                                                                                                                                               |
| :------------------ | :--------------------------------------------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci-quality-gates`  | 只改文件的 PR 也跑前後端檢查                         | 每張 PR 都跑的 job   | 設定靜態測試 C1                                                                                                                                                                                                                                                                        |
| `ci-quality-gates`  | 既有四個 job 不變                                    | code-review          | 本機重現：`git diff origin/main -- .github/workflows/ci.yml`，四個 job 的區塊沒有任何 `+`／`-` 行（`on.pull_request.types` 那一行除外）                                                                                                                                                |
| `ci-quality-gates`  | 後端型別錯誤時 CI 失敗                               | `backend-sqlite`     | 設定靜態測試 C4（`mypy --strict app` 在 pytest 之前）；本機重現：暫時在 `app/` 加一個回傳型別不符的函式，`cd backend && uv run mypy --strict app` 結束碼 1，輸出含 `error:`                                                                                                            |
| `ci-quality-gates`  | 後端格式不符時 CI 失敗                               | `backend-sqlite`     | 設定靜態測試 C4；本機重現：暫時加一個未排版的檔案，`cd backend && uv run ruff format --check .` 結束碼 1，輸出含 `Would reformat`                                                                                                                                                      |
| `ci-quality-gates`  | PostgreSQL 那一輪有測試被跳過時 CI 失敗              | `backend-postgres`   | 腳本測試（`check-junit-skips` 讀 skipped 為 1 的 JUnit fixture，結束碼非 0、輸出含測試名）；設定靜態測試 C4（`check-junit-skips.mjs` 在 pytest 之後、不帶 `--summary`）                                                                                                                |
| `ci-quality-gates`  | SQLite 那一輪回報跳過數                              | `backend-sqlite`     | 腳本測試（`--summary` 模式輸出 skipped 數、結束碼 0）；設定靜態測試 C4（`--summary` 的輸出寫入 `$GITHUB_STEP_SUMMARY`）                                                                                                                                                                |
| `ci-quality-gates`  | 只在 PostgreSQL 失敗的測試讓 CI 失敗                 | `backend-postgres`   | 本機重現（需要本機 PostgreSQL）：暫時加一個標 `postgres` 且斷言必敗的測試，SQLite 那一輪 `uv run pytest` 結束碼 0、該測試為 skipped；設 `TEST_DATABASE_URL` 後同一指令結束碼 1                                                                                                         |
| `ci-quality-gates`  | 前端違反分層或有警告時 lint 失敗                     | `frontend`           | lint 本身由 2.1 的探針測試判定；設定靜態測試 C5（lint 是第一個檢查步驟、之後的步驟沒有 `if: always()` 或 `continue-on-error`）                                                                                                                                                         |
| `ci-quality-gates`  | 前端型別錯誤時 CI 失敗                               | `frontend`           | 本機重現：暫時在 `src/lib/` 把陣列索引的值當非 undefined 使用，`pnpm --filter frontend typecheck` 結束碼非 0，輸出含 `TS2532` 或 `TS18048`                                                                                                                                             |
| `ci-quality-gates`  | 測試步驟逾時後不執行後續步驟                         | `frontend`           | 設定靜態測試 C5（job 設 `timeout-minutes`、checkout 沒有 `clean: false`、建置步驟沒有 `if: always()`）                                                                                                                                                                                 |
| `ci-quality-gates`  | 介面描述檔、前端產物未重產或手改時 CI 失敗（三條）   | `api-contract`       | 設定靜態測試 C6（匯出 → 比對 → 重產 → 比對的順序）；本機重現：分別 (1) 暫時改一個回應 schema 的欄位說明、(2) 只匯出不重產、(3) 手改一個產物檔，各跑 job 的同一串指令，結束碼 1，輸出列出對應檔名                                                                                       |
| `ci-quality-gates`  | 覆蓋率低於基準、在容許誤差內、基準檔缺失             | `coverage`           | 腳本測試（90.0／89.8 失敗、95.0／94.95 通過、缺檔與缺欄位失敗並指出欄位）                                                                                                                                                                                                              |
| `ci-quality-gates`  | 沒有標籤時調低基準、放寬容許誤差、拿掉標籤後恢復失敗 | `coverage`           | 腳本測試（base 90.0、PR 88.0、無 `--allow-lower` 失敗；tolerance 0.1 改 0.5 失敗；帶 `--allow-lower` 通過；base 檔缺時印出 notice 並通過）；設定靜態測試 C2、C3（觸發含 `labeled`／`unlabeled`；`--allow-lower` 只在標籤條件成立時傳入）                                               |
| `ci-quality-gates`  | 覆蓋率上升時通過並產生建議基準                       | `coverage`           | 腳本測試（85.0／86.0 結束碼 0，輸出與寫出的建議基準 JSON 相同，基準檔未被修改）；設定靜態測試 C3（上傳 `coverage-baseline-suggested`、job 權限只有 `contents: read`）                                                                                                                  |
| `ci-quality-gates`  | 新增未測試的前端檔案時覆蓋率下降                     | `frontend`           | 本機重現（task 2.2）：暫時新增一個無測試的 `src/lib/` 檔，`pnpm --filter frontend test:coverage` 的 `coverage-summary.json` 中 statements 低於新增前，報告列出該檔                                                                                                                     |
| `ci-quality-gates`  | 只改文件時跳過、動到後端或編排檔時執行、取不到 base  | `changes`、`compose` | 腳本測試（`ci-changed-paths` 的純函式：只改 `docs/` 為假、改 `docker-compose.yml` 或 `docker-compose.prod.yml` 為真、改 `backend/` 下的檔為真；base 為空、全 0 或不存在時為真並印出原因）；設定靜態測試 C7（`compose` 依 `changes` 的輸出決定是否執行、`changes` 用 `fetch-depth: 0`） |
| `ci-quality-gates`  | 缺必要設定卻沒有被拒絕時 CI 失敗                     | `compose`            | 設定靜態測試 C7（反向檢查步驟在 `up` 之前）；本機重現：暫時把 Lite 編排檔改成 `${CORS_ALLOWED_ORIGINS:-x}`，執行 job 的反向檢查那一步的同一段指令，結束碼 1，輸出指出反向檢查沒有成立                                                                                                  |
| `ci-quality-gates`  | 服務逾時未健康時 CI 失敗                             | `compose`            | 設定靜態測試 C7（`up` 帶 `--wait-timeout 300`、job `timeout-minutes: 20`）；行為由下方 `container-runtime`「後端不健康時前端不啟動」的本機重現涵蓋                                                                                                                                     |
| `ci-quality-gates`  | 編排工具版本過舊時 CI 失敗                           | `compose`            | 設定靜態測試 C7（版本檢查是 `compose` 第一個執行步驟）；本機重現：以 job 中同一段版本比較指令，把版本字串換成 `v2.19.0` 執行，結束碼 1，輸出含實際與最低版本（下限的準確值見 R9）                                                                                                      |
| `ci-quality-gates`  | e2e 旅程失敗時 CI 失敗並保留報告                     | `e2e`                | 設定靜態測試 C8（上傳 report 的步驟為 `if: failure()`）；本機重現：暫時把 spec 斷言的標題改成不存在的文字，`pnpm --filter e2e test` 結束碼 1，`e2e/playwright-report/` 存在                                                                                                            |
| `ci-quality-gates`  | 後端測試失敗時腳本測試照樣執行                       | `scripts-tests`      | 設定靜態測試 C9（`scripts-tests` 沒有 `needs`、沒有 `if:`）                                                                                                                                                                                                                            |
| `ci-quality-gates`  | CI 設定的回歸測試抓到被跳過的檢查                    | `scripts-tests`      | 設定靜態測試 C1 本身；本機重現：暫時在 `backend-sqlite` 加 `if: false`，`node --test scripts/tests/ci-workflow.test.mjs` 結束碼 1，輸出含 `backend-sqlite`                                                                                                                             |
| `ci-quality-gates`  | 新 job 不引用 secret                                 | 全部新 job           | 設定靜態測試 C10                                                                                                                                                                                                                                                                       |
| `container-runtime` | 只有前端服務發布主機埠                               | `compose` 靜態斷言   | compose 靜態斷言 (1)                                                                                                                                                                                                                                                                   |
| `container-runtime` | 兩份編排檔的前端都以後端健康為啟動條件               | `compose` 靜態斷言   | compose 靜態斷言 (2)                                                                                                                                                                                                                                                                   |
| `container-runtime` | 後端健康檢查的輪詢設定                               | `compose` 靜態斷言   | compose 靜態斷言 (3)                                                                                                                                                                                                                                                                   |
| `container-runtime` | 缺允許來源、缺資料庫密碼時編排檔無法解析             | `compose` 反向檢查   | system-design D7 的兩個反向檢查本身；本機重現：`cp .env.example .env` 後 `CORS_ALLOWED_ORIGINS= docker compose config --quiet` 與 `POSTGRES_PASSWORD= docker compose -f docker-compose.prod.yml config --quiet` 都結束碼非 0，輸出各含變數名                                           |
| `container-runtime` | 允許來源為空時起不來、正式層缺密碼時拒絕啟動         | 本機                 | 本機重現：在 `.env` 把該值設為空，執行 Scenario 的 `up --wait --wait-timeout 300`，結束碼非 0、輸出含變數名，`ps -a` 沒有任何容器                                                                                                                                                      |
| `container-runtime` | 允許來源含萬用字元時起不來                           | 本機                 | 本機重現：`.env` 設 `CORS_ALLOWED_ORIGINS=http://localhost:5173,*`，`docker compose up --wait --wait-timeout 300` 結束碼非 0；`docker compose logs backend` 含 `CORS_ALLOWED_ORIGINS`、不含 `http://localhost:5173,*`                                                                  |
| `container-runtime` | 遷移失敗時後端不啟動                                 | 本機                 | 本機重現：以讓 `alembic upgrade head` 失敗的資料庫設定執行 `docker compose up --wait --wait-timeout 300`（用哪個變數由 7.2 依編排檔的寫法決定並記錄），結束碼非 0；`docker compose ps -a` 中 backend 不是 running；`docker compose logs migrate` 含錯誤                                |
| `container-runtime` | 後端不健康時前端不啟動                               | 本機                 | 本機重現：以讓健康檢查一直失敗的設定（例如正式層先停掉 `db` 再起 backend）執行 `up --wait --wait-timeout 300`，結束碼非 0，`docker compose ps -a` 中 frontend 不是 running                                                                                                             |
| `container-runtime` | 資料庫不可用時後端被判為不健康                       | 本機                 | 本機重現：正式層全部健康後 `docker compose -f docker-compose.prod.yml stop db`，等 120 秒，`docker compose -f docker-compose.prod.yml ps backend` 顯示 `unhealthy`                                                                                                                     |
| `container-runtime` | 後端不能從主機直接連線                               | 本機                 | 本機重現：Lite 已起，`curl -sS --max-time 5 http://localhost:8000/api/v1/health` 結束碼非 0；`curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/api/v1/health` 輸出 `200`                                                                                                   |
| `container-runtime` | 非檔案路徑回前端頁面                                 | 本機                 | 本機重現：`curl -s -w '\n%{http_code}' http://localhost:8080/some/client/route` 最後一行為 `200`，body 與 `curl -s http://localhost:8080/` 相同                                                                                                                                        |
| `container-runtime` | 重啟後資料仍在、帶 -v 停止時資料一併移除             | 本機                 | 本機重現：以 `docker compose exec backend` 對資料庫寫一筆測試列，`down` 後 `up --wait --wait-timeout 300` 仍查得到；`down -v` 後再起，查不到                                                                                                                                           |
| `container-runtime` | .env 不進版控也不進映像                              | 本機                 | 本機重現：建立 `.env` 後 `git status --porcelain` 不列出它；`docker run --rm --entrypoint sh <映像> -c 'test ! -e /app/.env'`（前端映像改查 `/usr/share/nginx/html/.env` 與 `/.env`）結束碼 0                                                                                          |

設定靜態測試的斷言（C1–C11，全部在 `scripts/tests/ci-workflow.test.mjs`）：

- **C1**：`backend-sqlite`、`backend-postgres`、`frontend`、`api-contract`、`coverage`、`semgrep`、`dependency-audit`、`scripts-tests`、`e2e` 都沒有 job 層級的 `if:`、沒有 `continue-on-error`；`on.pull_request` 沒有 `paths`、`paths-ignore`。
- **C2**：`on.pull_request.types` 含 `opened`、`synchronize`、`reopened`、`labeled`、`unlabeled`。
- **C3**：`coverage` 的 `needs` 正好是 `backend-sqlite`、`backend-postgres`、`frontend`；checkout 用 `fetch-depth: 0`；合併步驟為 `coverage combine .coverage.sqlite .coverage.postgres` 之後才 `coverage json`；`--allow-lower` 只出現在以 `coverage-baseline-lower` 標籤為條件的地方；有上傳 `coverage-baseline-suggested` 的步驟。
- **C4**：`backend-sqlite` 的步驟順序為 `ruff check` → `ruff format --check` → `mypy --strict app` → `lint-imports` → pytest → `check-junit-skips.mjs --summary`（寫入 `$GITHUB_STEP_SUMMARY`）；`backend-postgres` 為 pytest → `check-junit-skips.mjs`（不帶 `--summary`）；兩個 job 的 pytest 步驟各設環境變數 `COVERAGE_FILE`（`.coverage.sqlite`、`.coverage.postgres`），兩個值必須不同，上傳的 coverage artifact 名稱也必須不同；兩個後端上傳步驟都要有 `include-hidden-files: true`（upload-artifact ≥ v4.4.0 預設略過隱藏檔，`.coverage.*` 會靜默沒上傳）與 `if-no-files-found: error`（system-design D12：pytest-cov 結束時自行合併資料，不留 `.coverage.*`，同名會互相覆蓋）。
- **C5**：`frontend` 設 `timeout-minutes`；上傳 coverage summary 的步驟設 `if-no-files-found: error`；檢查步驟順序為 lint → typecheck → `test:coverage` → build；沒有任何步驟帶 `if: always()` 或 `continue-on-error`；checkout 沒有 `clean: false`。
- **C6**：`api-contract` 的順序為後端匯出 → 比對 `backend/openapi.json` → 前端重產 → 比對 `frontend/src/api/generated`。
- **C7**：`compose` 的 `needs` 含 `changes`、`if` 讀 `changes` 的輸出；`changes` 的 checkout 用 `fetch-depth: 0`；`compose` 設 `timeout-minutes: 20`；執行步驟順序為版本檢查 → `config --quiet` → 兩個反向檢查 → Lite `up` → 正式層 `up`，`up` 都帶 `--wait-timeout 300`。
- **C8**：`e2e` 先跑 `test:static` 再跑 `test`；上傳 report 的步驟帶 `if: failure()`。
- **C9**：`scripts-tests` 沒有 `needs`。
- **C10**：新 job 都沒有 `secrets.` 引用；workflow 層級權限為 `contents: read`，新 job 沒有放寬權限。
- **C11**：`semgrep` 使用的映像標籤不是 `latest`；`semgrep --test .semgrep/` 在 `semgrep scan --error` 之前。

compose 靜態斷言在 `compose` job 內、不起容器，以 `docker compose config --format json` 讀兩份編排檔：(1) 只有 `frontend` 服務有 `ports`，沒有 Redis 或 worker 服務；(2) `frontend.depends_on.backend.condition` 為 `service_healthy`；(3) backend 健康檢查的 interval 為 30 秒、指令打 `/api/v1/health`。缺密碼與缺允許來源由 system-design D7 的兩個反向檢查判定，不再另設靜態步驟。

只有在路徑過濾下才跑的 `compose` 與每張 PR 都跑的 `e2e`，依 Q9、Q3 不列必過（system-design D13）。

### D5 雙資料庫與 skipped 檢查照 system-design D11

PostgreSQL 那一輪以 JUnit XML 加 `scripts/check-junit-skips.mjs` 斷言 0 skipped；選 JUnit XML 而不是解析 pytest 的終端摘要，因為摘要格式隨 pytest 版本與外掛變動，XML 的 `skipped` 屬性穩定，也能列出被跳過的測試名。

### D6 覆蓋率照 system-design D12，CI 是唯一來源

`scripts/check-coverage.mjs` 的輸入是「實測值、PR 的基準檔、base 分支的基準檔（可缺）、是否允許調低（`--allow-lower`）」，讀後端 `coverage.json` 的 `totals.percent_covered` 與前端 `coverage-summary.json` 的 `total.statements.pct`、`total.branches.pct`。比較分三步照 system-design D12：取 base 基準 → 基準不得調低（含 `tolerance` 放寬；有 `--allow-lower` 才略過）→ 實測不得低於「PR 基準減 `tolerance`」。數字格式：訊息中的百分比固定為小數點後一位（`toFixed(1)`，90 印成 `90.0`）；建議基準檔以 `JSON.stringify(obj, null, 2) + "\n"` 寫出，數字是 JSON 數值（90.0 寫成 `90`），且須通過 `prettier --check`，讓原樣提交時不被 lint-staged 與 `format` job 改動。實測上升超過 `tolerance` 時不失敗，在 log 印出完整的建議基準 JSON，並寫到一個由參數指定的檔案路徑，由 `coverage` job 以 artifact `coverage-baseline-suggested` 上傳。

**腳本沒有 `--update`，也不寫回 `coverage-baseline.json`**（R-A）。本機 `check` 不跑這支腳本：本機只有 SQLite 一輪、不做兩輪合併，數字和 CI 對不上（system-design D12「本機數字不等於 CI」）。作者想把基準往上收時，下載 CI 的建議基準檔原樣提交；不收也照樣通過。

`--allow-lower` 由 workflow 依 `github.event.pull_request.labels` 是否含 `coverage-baseline-lower` 決定是否傳入；腳本本身不讀 GitHub 事件，讓它在測試裡只吃參數與檔案。PR 基準檔不存在或缺欄位時腳本失敗並說明缺什麼，不以 0 當預設（loud failure，agent-rules R7），但仍印出並寫出建議基準檔，讓初始化有檔可提交（R3）。

### D7 e2e 跑在開發伺服器上，照 system-design D8、D8a、D8b

`playwright.config.ts` 是唯一讀 `E2E_BASE_URL`、`E2E_API_URL` 並寫預設值的地方，兩個推導值（後端允許來源、前端呼叫位址）在這裡以 `webServer.env` 明確帶入，不讀根目錄 `.env`（system-design D8a）。e2e spec 的三條靜態約束（不含主機與埠、不用固定時間等待、`shared/fixtures/` 只有 `.ts`）用一支 `node --test` 掃描測試判定，放在 `e2e/` 套件內、由 `e2e` 的 `test:static` script 執行，`e2e` job 在跑瀏覽器之前先跑它。替代方案是 ESLint 規則：e2e 套件目前沒有 ESLint，為三條字串比對引進一整套 lint 設定不划算。

### D8 前端 lint 零警告與探針殘留照 system-design D9、D10

`frontend/package.json` 的 `lint` 改成 `eslint . --max-warnings 0`，CI 與 `check` 都呼叫這個 script。「規則降成警告仍失敗」的 Scenario 由前端既有的邊界探針測試加一個案例驗證：以覆寫設定把分層規則設成 `warn` 跑 ESLint 的 Node API，斷言加上 `maxWarnings: 0` 的判定結果為失敗。探針殘留的三層防護照 D10；`.gitignore` 加 `frontend/src/pages/**/boundary-probe.tsx`。

### D9 後端分層契約照 system-design §後端：分層 import 檢查的對象

四條契約寫在 `backend/pyproject.toml` 的 `[tool.importlinter]`。「新模組漏列時測試失敗」由一支後端 unit 測試以 `pkgutil.iter_modules(app.modules.__path__)` 列出所有模組，與契約設定比對。「違反時檢查失敗」的各個 Scenario 由同一個測試檔以暫存目錄建出違規的模組副本、對它跑 import-linter 並斷言非 0；不在 `app/` 裡留違規檔。萬用字元是否可用見 R1，fallback 寫在 tasks 1.1。

### D10 根目錄四條指令照 system-design §本機自查的步驟

`bootstrap`、`dev`、`api:sync`、`check` 寫成根目錄 `package.json` 的 script；`dev` 與 `check` 的邏輯在 `scripts/dev.mjs`、`scripts/check.mjs`，`api:sync` 直接串兩條既有指令（後端匯出成功才跑前端重產）。`check` 的旗標寫成 `pnpm run check --with-e2e --with-semgrep`（pnpm 10 會把 script 名稱之後的參數轉給腳本，不需要 `--`）。`check.mjs` 的步驟清單寫成一個陣列常數，測試對它斷言順序與每一步的指令字串，這樣「與 CI 相同」可以由測試比對 `ci.yml` 的對應 `run:` 判定。

三處照規劃審查後的 system-design §本機自查的步驟：

- **第 11、12 步的 pytest 參數與 CI 完全相同**（`--cov=app --cov-branch --junitxml=test-results/junit-<db>.xml`），`check.mjs` 的測試直接斷言這兩串與 `backend-sqlite`、`backend-postgres` 的 `run:` 相同；`backend/test-results/` 加進 `.gitignore`。
- **第 7 步比對的是「執行前的工作區」，不是 HEAD**：先把 `backend/openapi.json` 與 `frontend/src/api/generated/` 複製到暫存目錄，跑 `pnpm run api:sync`，再比對重產結果與暫存的工作區內容；有差異時保留重產結果、列出檔名並失敗。剛跑過 `api:sync`、還沒提交的正確產物因此不會被誤判。
- **`check` 不跑覆蓋率比較**（D6）：第 6、11 步印出的覆蓋率摘要只供參考。

### D11 新腳本的測試跑在獨立的 `scripts-tests` job，照 system-design D13

`scripts-tests` job 不設 `needs`、不設 `if:`，與其他 job 平行，以 `node --test` 跑本 change 新增的 `check-coverage`、`check-junit-skips`、`ci-changed-paths`、`check`、`dev` 五支腳本的測試，以及 D14 的 `ci-workflow.test.mjs`（後者不是腳本測試，但同樣是 `scripts/tests/` 下的 node 測試，放進同一個 job，不另開 job）。理由照 system-design D13：放進 `coverage` 或 `backend-postgres` 這類使用者 job，腳本壞了要等前面的 job 跑完才知道，前面任一 job 失敗時腳本的回歸還會被遮住。既有 `specs` job 跑的舊腳本測試不動；本機的 `pnpm test:scripts` 以萬用字元涵蓋全部，不必改。

替代方案是把新測試檔加進既有 `specs` job 的清單：那會改到既有 job，違反「既有四個 job 一字不動」（Non-Goals）。`scripts-tests` 不在 Q10 的建議必過清單內，要不要列入由維護者在 ruleset issue 決定（system-design §CI job 設計）。

### D12 相依套件掃描照 Q5，嚴重度過濾的可行性見 R2

`pip-audit` 以 `uv add --dev` 加入；前端用 pnpm 內建的 `audit`。`pnpm audit --prod --audit-level high` 的旗標確定存在；`pip-audit` 依嚴重度過濾的方式待 apply 驗證（R2）。

### D13 文件改寫照 Q12 (a)(b)(d)(e)(f)，`AGENTS.md` 依 R-B 不改

改寫的位置：

- `docs/development/rules/` 的「檢查方式」段：backend（B1、B2、B6、B7）、frontend（F1、F2、F3）、api（A5）、security（S2）、testing（T1、T9、T10），從「待建置」改成本次實際的 job 名稱與指令。T10 的寫法要反映 R-A：基準與 base 分支比較、只能持平或上升、調低須維護者加 `coverage-baseline-lower` 標籤、更新基準是選擇性的。
- testing-agent-rules T9 的「七項的實作全歸 #111」改成哪幾項由本 change 建成、哪幾項仍屬 #111（Q12 (e)）。
- backend-agent-rules B1 §例外 補一句：健康檢查模組仍是分層檢查對象（Q12 (f)）。
- ADR-008 D8 的「Semgrep 延後」改為已建成；`architecture.mdx` §部署與維運 的 CI 安全掃描列、備援列（具名 volume 改用 `docker compose cp`，system-design N3），以及容器編排工具的最低版本（system-design D7，準確值依 R9 實測）。
- **#506 驗收條件 6 的 `AGENTS.md` 部分移給 #523**（維護者規劃審查裁定 R-B，依 Q12 (c)；issue 內文已更新）。本 change 不改 `AGENTS.md`，也不改各規則文件開頭「`backend/`、`frontend/`、`e2e/` 目前不存在」的敘述。驗收條件 6 在本 change 的完成範圍因此是 Q12 (a)(b)(d)(e)(f)。
- **不在範圍內**：ADR-005 第 86 行「（檢查待建置）」與 ADR-003 中同樣寫「檢查待建置」、但不屬 Q12 (d) 所列 ADR-008 D8 的段落。這些不在 Q12 裁定的改寫範圍，列為 tasks §Workflow follow-up 的另開 issue，本 change 不動。

文件群組放在最後，因為檢查方式要寫實際的 job 名稱與指令，必須等前面的群組定案；這不是把前面群組欠的文件堆到最後：前面每個群組都不產生文件義務，規則文件的改寫本身就是 Q12 的獨立工作。

### D14 `ci.yml` 的負向情境以設定靜態測試判定

負向 CI 情境（某個 job 被條件跳過、步驟順序錯、逾時沒設、標籤觸發沒加）不能靠「在 PR 上推刻意失敗的 commit」驗證：那會把失敗的 commit 留在歷史裡，而且只驗一次。改為 `scripts/tests/ci-workflow.test.mjs` 解析 `ci.yml`，斷言 D4 的 C1–C11；之後有人改壞 workflow，`scripts-tests` job 立刻變紅。

解析 YAML 需要 `yaml` 套件：以 `pnpm add -D -w yaml` 加為根目錄 devDependency（Hard Rule 3）。它已以間接依賴出現在 lockfile，版本跟著現有解析結果，不引入新的套件來源。替代方案是以正規表示式比對 `ci.yml` 的文字：縮排與鍵順序一變就誤判，斷言 `needs`、步驟順序這類結構時不可靠。

靜態測試判定的是「設定長什麼樣」，不是「GitHub Actions 照設定執行」；後者是 GitHub 的行為，不在本 change 驗證範圍。實際的失敗輸出由 D4 表中的本機重現補上。

### D15 路徑過濾抽成 `scripts/ci-changed-paths.mjs`，照 system-design D13

`changes` job 的判斷寫成腳本而不是 workflow 裡的 shell，讓它有 node 測試：純函式收檔名清單回傳布林，外層收 `--base`、`--head` 跑 `git diff --name-only`，base 取不到時一律回答「有變動」並印出原因，結果寫進 `$GITHUB_OUTPUT`。命中規則照 system-design D13 的清單。測試至少涵蓋只改 `docs/`、改編排檔、改 `backend/` 與 base 取不到四種情況（D4 表）。

## Risks / Trade-offs

- **R1 import-linter 的 `forbidden` 契約可能不支援萬用字元（N5）** → tasks 1.1 先在所裝版本上驗證：寫一條 `app.modules.*.router` 的 forbidden 契約，對刻意違規的暫存模組跑 `lint-imports`，看是否非 0。支援就照 system-design 的四條契約寫；不支援時，後端 unit 測試以 `pkgutil.iter_modules` 列出所有模組、逐模組產生 forbidden 契約內容，並斷言 `pyproject.toml` 的契約與產生結果一致（clarification §交給後續產出）。兩條路的外部行為相同，spec 不受影響；驗證結果寫進該群組的提交訊息。
- **R2 `pip-audit` 可能沒有依嚴重度過濾的旗標** → ADR-008 D8 與 Q5 寫的是 `pip-audit --fail-on high`。tasks 3.1 先以 `uv run pip-audit --help` 與官方文件確認旗標是否存在。存在就照寫。不存在時：(1) fallback 是以 `pip-audit --format json` 輸出、交給一支小腳本依弱點資料庫的嚴重度判定 high 以上才失敗；若 JSON 沒有嚴重度欄位，再退一步改為「任何已知弱點都失敗」，那比 ADR 嚴格；(2) 不論採哪一個 fallback，都**不得自行改寫 ADR-008 D8 或 Q5 的字句**，由執行的 agent 停下，把實際旗標、選用的 fallback 與它和 D8 字面的差異回報給主 agent，由主 agent 轉維護者決定是否接受或修 ADR。這條同時適用 `pnpm audit` 旗標與 Q5 不符的情況。
- **R3 覆蓋率基準的初始值要等 CI 量出來** → 基準檔不存在時 `check-coverage.mjs` 失敗（D6），所以本 PR 第一次 CI run 的 `coverage` job 會是紅的，但 job 仍會印出並上傳建議基準檔 `coverage-baseline-suggested`。tasks 的整合群組下載那個檔、原樣提交成 `coverage-baseline.json`，之後的 run 應該轉綠。base 分支（`main`）上還沒有基準檔，這次 run 依 system-design D12 第 1 步印出 notice、略過「不得調低」；本 PR 合併後，之後的 PR 才開始與 base 比較。不以 0 或 acceptance 記的 97%、98.98% 當占位值（Q7）。
- **R3a 標籤由維護者管理** → `coverage-baseline-lower` 只有維護者會加（R-A）。repo 裡還沒有這個標籤時，加不上去，調低基準的 PR 只會一直紅，不會誤放行；建立標籤屬 repo 設定，不在本 change 內執行，列在 tasks §Workflow follow-up 由主 session 回報維護者。workflow 只讀標籤名稱，不檢查是誰加的；「只有維護者加」靠 repo 權限與審查，不是 CI 的機械檢查。
- **R4 既有依賴可能已有 high 弱點，或既有程式命中 Semgrep 規則** → 新 job 一上就紅。apply 時若發生，停下回報，不加忽略清單、不降門檻（AGENTS.md §Review Guidelines；loud failure）。升級依賴屬另一張 issue 的決定。Semgrep 規則寫好後、接上 CI 之前，先對目前的 `backend/`、`frontend/` 跑一次：必須 0 個發現；有發現時不論是真違規還是規則誤判（例如把從環境變數讀取的設定當成寫死的 secret），都停下回報，不自行放寬規則或加例外（tasks 3.2）。
- **R5 新加的檢查可能抓到既有程式的違規**（分層契約、零警告、mypy strict 在 CI 的設定差異） → system-design 已確認健康檢查模組符合四條契約、前端目前零警告。若 apply 實測不符，停下回報，不在本 change 改產品程式（Non-Goals）。
- **R6 容器建置的空 `VITE_API_BASE_URL`** → 若產生的呼叫層對空字串組出錯誤網址，compose job 經公開入口取健康檢查會失敗而不是默默通過；frontend 群組另加一支單元測試，斷言空字串時呼叫的是同源的 `/api/v1/health`。若需要改前端產品程式才能支援，停下回報（R5）。
- **R7 e2e 與 compose 的穩定度與耗時** → 兩者都不列必過（Q3、Q9、Q10）；e2e 失敗時上傳報告供查。瀏覽器只裝 chromium。
- **R8 #528 與本 change 的歸檔順序** → D2 已讓兩者不碰同一段文字。若 #528 在本 change apply 期間歸檔，frontend 群組重新跑 lint 確認仍零警告即可，不需改 delta。
- **R9 `up --wait` 與一次性 `migrate` 的 Compose 版本下限（N6）** → system-design D7 以 v2.20.0 為保守下限。tasks 7.1 在本機、8.3 在 CI runner 上各印出 `docker compose version`，並實測 `migrate` 以 0 結束後 `--wait` 不判失敗；確認後的下限寫進 `.env.example` 註解、`compose` job 的版本檢查與 `architecture.mdx`（tasks 10.4）。若實測發現 v2.20.0 不夠、或 CI runner 的版本低於下限，停下回報，不改用其他編排方式。
- **R10 設定靜態測試鎖住 `ci.yml` 的結構**（D14）→ 之後有人合理地改 job（例如改步驟名稱）時要一併改測試。斷言只鎖 D4 C1–C11 列的條件、相依、逾時與順序，以指令內容比對步驟、不比對步驟名稱，把誤報降到最低。
- **取捨：正式層與 Lite 兩份編排檔約 30 行重複**（system-design D2）→ 由 `docker compose config --quiet` 與 compose job 兩層都起一次抓漂移。

## Migration Plan

- **資料庫**：無 schema 變更、無 Alembic revision，不需要遷移或回填。
- **部署順序**：本 change 只新增檔案與 CI job，另把 `on.pull_request` 的觸發加上 `labeled`、`unlabeled`（R-A），合併即生效；沒有正式環境要切換。合併後由維護者另開 issue 修改 ruleset（Q10），在那之前新 job 只會顯示結果、不擋合併。
- **對開發者的影響**：合併後本機 `pnpm --filter frontend lint` 有任何警告就失敗；`pnpm install` 會多裝 `e2e` 套件，`pnpm run bootstrap` 是新的一次性入口（`scripts/setup.sh` 照舊可單獨使用）。
- **回滾**：revert 合併 commit 即可。沒有資料、沒有對外 API、ruleset 也還沒改，revert 後 CI 回到四個 job、觸發回到預設的三種事件、根目錄指令消失。`coverage-baseline.json` 隨 revert 一起移除；`coverage-baseline-lower` 標籤若已建立會留在 repo，但沒有 workflow 讀它，不影響任何行為。若 ruleset issue 已把新 job 設為必過，revert 前要先請維護者把它們從必過清單拿掉，否則之後的 PR 會等不到這些 job。

## Open Questions

- Docker 建置要不要加 layer cache：等 compose job 的實測耗時再定（system-design §效能與資源），不影響 spec 與任務拆分。
- `e2e`、`compose` 何時列為必過：由 Q10 的 ruleset issue 處理；`scripts-tests` 要不要列入也在那張 issue 由維護者決定（system-design §CI job 設計）。
