# Proposal

## Why

#504 後端骨架與 #505 前端骨架都已合併，但兩者只能在本機各自啟動；根目錄沒有能一次起前後端的容器編排，CI 的四個 job（`commit-messages`、`docs-site`、`format`、`specs`）也都不碰 `backend/`、`frontend/`。規則文件標「待建置」的分層 import、契約漂移、雙資料庫測試、覆蓋率「不得下降」與 Semgrep，因此全靠本機自律（Issue #506 §需求目標、2026-11-21 留言「前端的檢查目前完全不在 CI 裡」）。#528 剛補上的 `no-unknown-files` 也只在本機有效。第一個功能 change（規格 01-01 登入）開始前，要先讓這些檢查在每張 PR 上真的會擋（Epic #502 §需求目標、§承接的延後條文）。

本 change 沒有 `docs/specs/` 規格可追溯（spec-migration D4：foundation 屬技術規範）。需求依 `openspec/config.yaml` `context`（維護者 2026-11-20 裁定，#503）追溯到 ADR 與規則文件的條號。上游的待決問題（system-analysis 待決 #1–#16、system-design N1–N4）已由維護者於 2026-11-22 在 `clarification.md` Q1–Q15 全數裁定，規劃審查後維護者再於 2026-11-22 裁定 R-A（覆蓋率基準只能持平或上升）與 R-B（#506 驗收條件 6 的 `AGENTS.md` 部分依 Q12 (c) 移給 #523，issue 內文已更新）。本 proposal 依上述裁定撰寫；仍開著的 N5、N6 都是技術風險，由 apply 驗證。

## What Changes

範圍以 Issue #506 §包含、§驗收條件 1–6（2026-11-22 依 Q1、Q3–Q6、Q9、Q11 改寫後的版本；條件 6 的 `AGENTS.md` 部分依 R-B 移給 #523）與 2026-11-21 留言為準（system-analysis §範圍）。

- **容器編排（Lite 層）**：根目錄新增 `docker-compose.yml`，預設 SQLite，資料放具名 volume。clone 後只要以設定範例檔複製出 `.env`，不必設定資料庫就能起服務（ADR-003 D1、D7；`architecture.mdx` §資料庫雙層）。遷移由一次性服務先跑完，失敗時後端不啟動（system-design D1、D3）。
- **容器編排（正式層）**：新增 `docker-compose.prod.yml`，使用 PostgreSQL，獨立使用、不疊加在 Lite 上；缺資料庫密碼時拒絕啟動（system-design D2、D4）。兩層都不含 Redis 與 worker（Epic #502 §不包含、Q2）。
- **唯一公開入口**：前端容器的反向代理同時服務前端正式建置並轉發 `/api/v1`，兩層編排都只有它發布埠，後端與資料庫只在編排網路內（ADR-008 D1、Q2；system-design D6）。設定範例檔的允許來源與前端呼叫位址因此一次定成同源值。
- **容器健康檢查**：後端每 30 秒輪詢既有的健康檢查端點，不拆存活端點（Q14；system-design D5）；`docker compose up --wait` 等所有服務健康才以 0 結束，再經公開入口取得健康檢查回應（驗收條件 1 前半，Q1）。
- **映像**：新增後端與前端的映像建置檔。前端映像以 repo 根為 build context，**只讀取** `design/prototype/assets/`，不修改它（frontend-skeleton design D8）。
- **設定範例檔** `.env.example`：列出每個設定、Lite 可直接使用的預設值，不含任何可用的 secret（Hard Rule 8、B10、#504 Q1、#505 交接的兩個值）。`.env` 加進 `.gitignore`，也排除在映像 build context 之外。
- **根目錄四條指令**（Q11）：`bootstrap`（先跑 `scripts/setup.sh` 再裝前後端依賴；不叫 `setup`，以免撞 pnpm 內建指令）、`dev`（起本機前後端開發伺服器，不是容器）、`api:sync`（後端匯出後接前端重產，匯出失敗就不重產，A5）、`check`（依固定順序跑與 CI 相同的指令；缺 `TEST_DATABASE_URL` 時明確印出 PostgreSQL 那一輪已跳過；遇到探針殘留檔就失敗、不自動刪除）。
- **e2e 骨架**：根目錄新增 `e2e/`，是 pnpm workspace 的獨立套件，含一條「健康檢查頁顯示正常」的旅程，跑在開發伺服器上（驗收條件 1 後半，Q1；system-design D8）。`baseURL`、介面語言與兩個推導值都集中在設定檔（ADR-007 D4；T1、T8；system-design D8a、D8b）。
- **CI 新增的 job**（既有四個 job 不動；job 清單見 system-design §CI job 設計）：
  - 前後端 job 每張 PR 全跑，不依變更路徑跳過；只有容器編排驗證依路徑過濾，判斷邏輯放在有測試的腳本，取不到 base commit 時一律執行（Q9；system-design D13）。
  - 後端：ruff、`ruff format --check`、`mypy --strict` 進 CI，取代 #504 Q6「不加 CI job」（Q4、B2）；分層 import 方向檢查，健康檢查模組也受檢（B1、ADR-003 D3、#504 Q8）；SQLite 與 PostgreSQL 各跑一輪測試，PostgreSQL 那一輪 MUST 0 skipped（B6、B7、T4、T11；system-design D11）。
  - 前端：lint（含分層與分不出層的檔案）改為**零警告**，型別檢查、含覆蓋率的測試與建置都在 CI 執行（F1、F2、F3、ADR-005 D2、Q4；2026-11-21 留言第 1 點；system-design D9）；探針殘留檔不影響後續步驟（留言第 2 點；system-design D10）。
  - 介面描述檔與前端產物的漂移比對（A5；system-design §CI job 設計 `api-contract`）。
  - 覆蓋率「不得下降」：基準存 repo 根 `coverage-baseline.json`，前後端各一段，容許誤差 0.1 個百分點。依 R-A，PR 的基準與 base 分支的基準比較，只能持平或上升；調低基準（含放寬容許誤差）時 CI 失敗，除非 PR 帶有由維護者加上的 `coverage-baseline-lower` 標籤。覆蓋率上升時 CI 通過，並在 log 與 artifact `coverage-baseline-suggested` 輸出建議基準，是否更新基準由 PR 作者選擇。數字一律以 CI 量到的為準，本機不比較也不寫入基準；初始值取本 PR 在 CI 上第一次輸出的建議基準；前端分母改為涵蓋 `src/**`（排除產物、測試輔助、設定）；五項關鍵路徑 90% 本次不留位置（ADR-007 D2、T10、Q7、Q8；system-design D12）。
  - Semgrep：違規即失敗，只用兩條專案禁令（CORS 萬用來源、寫死的 secret），掃 `backend/`、`frontend/`、`e2e/`（ADR-008 D8；`architecture.mdx` §部署與維運；Hard Rule 7、8；S2；Q6）。
  - 相依套件掃描：後端 `pip-audit --fail-on high`、前端 `pnpm audit --prod --audit-level high`（ADR-008 D8、Q5）。
  - 容器編排驗證：只在動到編排檔、Dockerfile、`.dockerignore`、`frontend/nginx.conf`、`backend/`、`frontend/` 時跑；先確認編排工具版本、再以兩個反向檢查確認缺必要設定時編排檔無法解析，最後兩層各起一次（Q1、Q9；system-design D7）。
  - CI 輔助腳本的測試獨立成一個 job，不等其他 job，並以靜態測試鎖住 CI 設定本身的結構（system-design D13；design D11、D14）。
  - e2e：每張 PR 跑（SQLite、開發伺服器），先不列必過（Q3）。
- **文件**（Q12 (a)(b)(d)(e)(f)；`AGENTS.md` 不改，R-B）：規則文件裡本次建成的檢查，以及 #504、#505 已在本機建成、本次進 CI 的 F1、F2、F3、A5、B2，從「待建置」改寫成實際的檢查方式；ADR-008 D8 與 `architecture.mdx` §部署與維運 的「Semgrep 延後」與備援列（具名 volume 的備份寫法，system-design N3）；T9「七項的實作全歸 #111」的歸屬字句與 #111 §2b 的覆蓋率項；B1 §例外 補一句健康檢查模組仍是分層檢查對象；`architecture.mdx` §部署與維運 補容器編排工具最低版本（N6）。
- **不含**：認證與權限、業務模組、Celery／Redis／worker、可觀測性（Epic #502 §不包含）；五項關鍵路徑 90% 分支覆蓋（程式尚不存在，ADR-007 D2、Q7）；正式部署的 TLS 與備份（ADR-008 待決 1、7）；Agent hook（#111 的 H1–H6）；修改 `design/prototype/`、`docs/specs/`、`docs/specs/00-prd.mdx`；修改 `main` ruleset（Q10，合併後另開 issue 由維護者執行）；正式層關閉 `/docs` 與介面描述路由（Q13，另開 issue）；後端 access log 格式（Q15，留給 01-01）；ADR-005 第 86 行與 ADR-003 中不在 Q12 (d) 範圍的「檢查待建置」段落（另開 issue）；不碰資料庫的存活端點（Q14，不拆）；各規則文件開頭與 `AGENTS.md` §Agent Rules Index 第四段「`backend/`、`frontend/`、`e2e/` 目前不存在」的過時敘述（Q12 (c)，留給 #523）。
- **破壞性變更**：無對外 API 或資料變更。對開發者行為有兩項收緊：前端 `lint` 改為零警告，任何警告都讓本機與 CI 的 lint 失敗（前端目前零警告，`fix-pages-root-layer-classification` tasks 3.1）；前端覆蓋率分母擴大到 `src/**`，數字會與 #505 acceptance 記的 98.98% 不同，基準以本 PR 在 CI 上第一次量到的值為準。另有一項流程收緊（R-A）：基準一旦提交就只能持平或上升，調低須經維護者加標籤；CI 因此改為在 PR 加上或移除標籤時重跑（`on.pull_request.types` 加 `labeled`、`unlabeled`）。

## Capabilities

### New Capabilities

- `container-runtime`：以容器編排重現整套系統。Lite 與正式兩層各起哪些服務、唯一公開入口、遷移先於後端且失敗時後端不啟動、前端在後端健康後才啟動、容器健康檢查與「全部健康才算起來」、正式層缺資料庫密碼或允許來源時拒絕啟動、Lite 資料保存在具名 volume、設定範例檔的內容與不含 secret。
- `workspace-commands`：根目錄的 `bootstrap`、`dev`、`api:sync`、`check` 四條指令的行為，含契約同步「匯出失敗就不重產」、check 的固定順序、與 CI 相同參數、第一個失敗即以非 0 結束、契約漂移比對執行前工作區而非最近一次 commit、本機不比較也不寫入覆蓋率基準、缺 PostgreSQL 設定時明確印出已跳過、探針殘留時明確失敗。
- `e2e-testing`：根目錄 e2e 套件的位置、執行方式與約束（`baseURL` 與預設位址只集中在一處、固定介面語言、前端呼叫位址與後端允許來源由同一處推導、條件式等待、共用 fixtures 不含資料檔），以及健康檢查頁顯示正常的那一條旅程。
- `backend-code-boundaries`：後端原始碼的機械分層檢查。模組內 router、service、repository、models 的允許方向，Router 不直接使用資料層，共用層不依賴業務模組，資料層不處理 HTTP，每個模組都受檢、漏列時測試失敗。
- `ci-quality-gates`：每張 PR 在 CI 上執行的品質檢查與各自的失敗條件：執行條件、後端 lint 與型別檢查、雙資料庫測試（PostgreSQL 那一輪 0 skipped）、前端檢查、探針殘留隔離、契約漂移、覆蓋率基準與量測範圍、覆蓋率基準只能持平或上升（調低須維護者標籤）、容器編排驗證（含路徑判斷與反向檢查）、e2e、CI 輔助腳本測試獨立執行、CI 權限。
- `security-scanning`：原始碼的專案禁令掃描（CORS 萬用來源、寫死的 secret，違規即失敗、規則附回歸樣本）與相依套件的已知弱點掃描（門檻 high）。

### Modified Capabilities

- `frontend-code-boundaries`：新增「lint 不容許警告」：任何警告都讓 lint 以非 0 結束，讓既有 requirement 的「違反時 lint MUST 失敗」在規則被降成警告時仍然成立（2026-11-21 留言第 1 點）。以 ADDED 寫成獨立 requirement，不改寫 #528 `fix-pages-root-layer-classification` 正在 MODIFIED 的「依分層限制 import 方向」，兩張 change 的歸檔順序不互相影響（design D2）。

`health-check`、`runtime-config`、`database-migration`、`api-schema-export`、`frontend-api-codegen`、`frontend-routing`、`dev-health-page`、`frontend-i18n` 在本 change 只被呼叫或觀察，requirement 不變。

## Impact

- **新增檔案**：`docker-compose.yml`、`docker-compose.prod.yml`、`.env.example`、根目錄 `.dockerignore`、`backend/Dockerfile`、`backend/.dockerignore`、`frontend/Dockerfile`、`frontend/nginx.conf`、`.semgrep/`（規則與回歸樣本）、`coverage-baseline.json`（內容取自 CI 的 `coverage-baseline-suggested`）、`scripts/` 下的 dev、check、覆蓋率比較、skipped 檢查、變更路徑判斷（`scripts/ci-changed-paths.mjs`）腳本及其測試、CI 設定的靜態測試 `scripts/tests/ci-workflow.test.mjs`、`e2e/` 整個套件。完整目錄見 system-design §目錄結構。
- **修改檔案**：`.github/workflows/ci.yml`（新增 job，並在 `on.pull_request` 加 `types`，含 `labeled`、`unlabeled`；既有四個 job 的內容不動）；根目錄 `package.json`（四條指令、devDependency `yaml`）；`pnpm-workspace.yaml`（加入 `e2e`）；`pnpm-lock.yaml`；`.gitignore`；`backend/pyproject.toml`、`backend/uv.lock`（分層檢查契約、覆蓋率設定、dev 依賴）；`frontend/package.json`（`lint` 零警告）；`frontend/vitest.config.ts`（覆蓋率摘要輸出與 `src/**` 分母）。`scripts/setup.sh` 不改（`bootstrap` 包住它）。
- **文件**：`docs/development/rules/` 的 backend、frontend、api、security、testing 規則文件的「檢查方式」段落；`docs/development/adr/008-deployment-and-operations.mdx` D8；`docs/development/architecture.mdx` §部署與維運。`AGENTS.md` 不改：它唯一涉及「待建置」的是 §Agent Rules Index 第四段，屬 Q12 (c)，留給 #523；#506 驗收條件 6 的 `AGENTS.md` 部分也依 R-B 移給 #523。
- **新增依賴**：後端以 `uv add --dev` 加入分層檢查工具與相依套件掃描工具；e2e 以 `pnpm --filter e2e add -D` 加入瀏覽器測試框架；根目錄以 `pnpm add -D -w yaml` 加入 CI 設定靜態測試用的解析器（Hard Rule 3；design D14）。版號不動（Hard Rule 4）。
- **API**：無新增或修改（`api-contract.md`）。容器健康檢查與 e2e 都沿用既有的 `GET /api/v1/health`（`getHealth`）。
- **資料模型**：無。不新增表、欄位或遷移，資料表字典與 ER 都不動（system-design §資料模型異動）。
- **UI**：無（`ui-design.md`）。e2e 只觀察 #505 既有的健康檢查開發頁，不新增 `data-testid`，前端產品程式不改。
- **權限與答案隔離**：沒有產品角色的權限檢查點，PRD §權限矩陣不受影響。Hard Rule 5、6 在行為上不適用（clarification 第 9、10 面向）：`e2e/shared/fixtures/` 不放任何資料檔。基礎建設面的約束：設定範例檔不含 secret、CI 的 log 不印設定值、新 job 只有 `contents: read` 且不用 repo secret、`CORS_ALLOWED_ORIGINS` 一律寫明確來源。
- **治理**：新 job 不會自動成為 `main` 的必過檢查。驗收條件 2–5 的「CI 失敗」要真正擋住合併，取決於維護者修改 ruleset；本 PR 合併後另開 issue，建議必過 `backend-sqlite`、`backend-postgres`、`frontend`、`api-contract`、`coverage`、`semgrep`（Q10）；`scripts-tests` 不在 Q10 建議清單，是否列入由維護者在該 issue 決定。調低覆蓋率基準用的 `coverage-baseline-lower` 標籤由維護者管理（R-A）。
- **下游**：規格 01-01 登入起，每張 PR 都受雙資料庫測試、覆蓋率、分層檢查與 Semgrep 約束，`e2e/shared/fixtures/` 是第一條角色旅程的擴充點。#111 的 hook 可轉接本次的 `check` 指令。第一個背景工作的 change 會在本次的編排檔上加 Redis 與 worker。

## 引用的需求來源

- 維護者指定：Issue #506 §使用情境／功能範圍「包含」、§需求目標、§驗收條件 1–6、§修訂紀錄（2026-11-22）、2026-11-21 留言「折進本單：前端的檢查目前完全不在 CI 裡」（`--max-warnings 0`、探針檔殘留兩點）；Epic #502 §範圍「不包含」、§需求目標、§承接的延後條文；#503 裁定（追溯方式）；Issue #509（ruleset 四項必過）；Issue #111 §2b。
- 本 change 的 `clarification.md` Q1–Q15（2026-11-22 裁定）與 §交給後續產出。
- 維護者規劃審查裁定（2026-11-22）：R-A（覆蓋率與 base 分支基準比較、只能持平或上升、調低須 `coverage-baseline-lower` 標籤）、R-B（驗收條件 6 的 `AGENTS.md` 部分依 Q12 (c) 移給 #523）。
- 歸檔 change 的交接：`2026-11-20-backend-skeleton` 的 `clarification.md` Q1、Q5、Q6、Q8、N6，`system-design.md` §交易、session 與效能，`acceptance.md` 附註 3；`2026-11-20-frontend-skeleton` 的 `clarification.md` Q1、Q7、Q8、Q12，`design.md` D8、§跨 change 依賴。進行中 change `fix-pages-root-layer-classification`（#528）。
- `docs/specs/`：無對應規格頁（spec-migration D4）。
- ADR：ADR-003 D1、D3、D7；ADR-005 D2；ADR-007 D1、D2、D4；ADR-008 D1、D2、D3、D8、D10、§待決 1、7。
- 規則文件：testing-agent-rules T1、T4、T5、T6、T8、T9、T10、T11；backend-agent-rules B1、B2、B6、B7、B10；frontend-agent-rules F1、F2、F3；api-agent-rules A5；security-agent-rules S2、S9；agent-hook-contract H7。
- `AGENTS.md` Hard Rule 3、4、5、6、7、8，§Required Behaviors 第一條；`docs/development/architecture.mdx` §技術選型「目錄結構（目標）」、§容器視圖、§資料庫雙層、§部署與維運；`openspec/config.yaml` `operations.apply.guidance`（前後端檢查指令）。
- 既有主規格（只呼叫或觀察）：`health-check`、`runtime-config`、`database-migration`、`api-schema-export`、`frontend-api-codegen`、`frontend-routing`、`dev-health-page`、`frontend-i18n`。

## 待決問題

- system-analysis 待決 #1–#16 與 system-design N1–N4：已於 2026-11-22 由 `clarification.md` Q1–Q15 裁定，對照見 system-design §技術待決問題。
- N5（技術風險，不需維護者決定）：分層檢查工具的 `forbidden` 契約是否支援萬用字元。apply 第一個後端群組先驗證，不支援時改由「列出所有模組」的 unit 測試逐模組產生契約（clarification §交給後續產出；design R1）。
- 可行性風險（apply 驗證、不在規劃中自行解決）：`pip-audit` 可能沒有依嚴重度過濾的旗標，無法照 ADR-008 D8 的字面 `--fail-on high` 執行；處理方式與回報方式見 design R2。
- N6（技術風險，不需維護者決定）：容器編排工具的最低版本。system-design D7 暫定 v2.20.0，apply 在本機（tasks 7.1）與 CI runner（tasks 8.3）實測確認後寫進 `.env.example`、`compose` job 與 `architecture.mdx`；不成立時停下回報（design R9）。
