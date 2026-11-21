# Proposal

## Why

#504 後端骨架與 #505 前端骨架都已合併，但兩者只能在本機各自啟動；根目錄沒有能一次起前後端的容器編排，CI 的四個 job（`commit-messages`、`docs-site`、`format`、`specs`）也都不碰 `backend/`、`frontend/`。規則文件標「待建置」的分層 import、契約漂移、雙資料庫測試、覆蓋率「不得下降」與 Semgrep，因此全靠本機自律（Issue #506 §需求目標、2026-11-21 留言「前端的檢查目前完全不在 CI 裡」）。#528 剛補上的 `no-unknown-files` 也只在本機有效。第一個功能 change（規格 01-01 登入）開始前，要先讓這些檢查在每張 PR 上真的會擋（Epic #502 §需求目標、§承接的延後條文）。

本 change 沒有 `docs/specs/` 規格可追溯（spec-migration D4：foundation 屬技術規範）。需求依 `openspec/config.yaml` `context`（維護者 2026-11-20 裁定，#503）追溯到 ADR 與規則文件的條號。上游產出共有 21 個待決問題：system-analysis 待決 #1–#16，system-design 技術待決 N1–N5。**這些問題都還沒裁定**，本 proposal 不替維護者選答案；凡範圍會隨答案改變的地方都標出待決編號，由 clarification 一次問完。

## What Changes

範圍以 Issue #506 §包含的七項與 §驗收條件 1–6 為準，另加 2026-11-21 留言（system-analysis §範圍）。

- **容器編排（Lite 層）**：根目錄新增 `docker-compose.yml`，預設 SQLite，資料放持久化 volume。clone 後只要複製設定範例檔，不必設定資料庫就能起前後端（ADR-003 D1、D7；`architecture.mdx` §資料庫雙層）。遷移由一次性服務先跑完，失敗時後端不啟動（system-design D1）。
- **容器編排（正式層）**：新增 `docker-compose.prod.yml`，使用 PostgreSQL，獨立使用、不疊加在 Lite 上（system-design D2）。缺資料庫密碼時拒絕啟動（D4）。Redis 與 worker 不在本次（Epic #502 §不包含）。
- **兩層共通**：後端都有容器健康檢查（D5）。是否有唯一公開入口（反向代理）**依待決 #2，未定**。
- **映像**：新增後端與前端的映像建置檔。前端映像以 repo 根為 build context，**只讀取** `design/prototype/assets/`，不修改它（frontend-skeleton design D8）。
- **設定範例檔** `.env.example`：列出每個設定、Lite 可直接使用的預設值，不含任何可用的 secret（Hard Rule 8、B10、#504 Q1、#505 交接的兩個值）。`.env` 加進 `.gitignore`。
- **根目錄四條指令**：setup、dev、契約同步（後端匯出後接前端重產，A5）、check。check 依固定順序跑本機自查，呼叫的是與 CI 相同的指令。四條指令的語意依待決 #11；`setup` 名稱與 pnpm 內建指令衝突，見技術待決 N1。
- **e2e 骨架**：根目錄新增 `e2e/`，是獨立的 workspace 套件，含一條「健康檢查頁顯示正常」的旅程。這條旅程跑在開發伺服器上（system-design D8），`baseURL`、介面語言與兩個推導值都集中在設定檔（ADR-007 D4；T1、T8；D8a、D8b）。e2e 是否每張 PR 在 CI 跑，**依待決 #3，未定**。
- **CI 新增的 job**（既有四個 job 不動；job 清單見 system-design §CI job 設計）：
  - 後端測試在 SQLite 與 PostgreSQL 各跑一輪；PostgreSQL 那一輪 MUST 0 skipped（B6、B7、T4、T11；D11）。
  - 介面描述檔與前端產物的漂移比對（A5）。
  - 覆蓋率基準與「不得下降」（ADR-007 D2、T10；D12）。基準怎麼存、容許誤差多少、前端分母範圍、初始值從哪次量測來，依待決 #7、#8 與技術待決 N2。
  - 後端分層 import 方向檢查（B1、ADR-003 D3），健康檢查模組也是檢查對象（#504 Q8）。
  - 前端 lint（含分層與分不出層的檔案）在 CI 執行，並改為**零警告**：規則被降成警告時 lint 也失敗（F1、ADR-005 D2；2026-11-21 留言第 1 點；D9）。
  - Semgrep：至少涵蓋 CORS 萬用來源與寫死的 secret 兩條專案禁令（ADR-008 D8；`architecture.mdx` §部署與維運；Hard Rule 7、8；S2）。違規時讓 CI 失敗還是只回報、規則集範圍，**依待決 #6，未定**。
  - 以容器編排起服務並驗證健康檢查的 job（D7）。要不要建、在什麼時機跑，依待決 #1、#9、#10 與技術待決 N4。
  - 依待決決定是否新增：前端型別檢查、後端 ruff 與 `mypy --strict` 進 CI（待決 #4，牽動 #504 Q6 的裁定）；相依套件掃描（待決 #5，ADR-008 D8 的「先做」項）。
  - job 執行條件仍依 `hashFiles()`（ADR-003 D1）。要不要改成「這次 PR 有改到該層才跑」，依待決 #9。
- **分層測試的探針檔殘留**：`frontend/build/eslint-config.test.ts` 的探針檔若殘留，不得影響後續步驟。做法是順序加上全新工作目錄，本機的 check 遇到殘留就明確失敗、不自動刪除（2026-11-21 留言第 2 點；D10）。
- **文件**：`AGENTS.md` 與規則文件裡本次建成的檢查，從「待建置」改寫成實際的檢查方式（#506 §驗收條件 6）。改寫範圍（是否包含 #504、#505 已在本機建成的檢查、各文件開頭的過時敘述、ADR-008 D8 與 `architecture.mdx` 的「Semgrep 延後」、具名 volume 的備份寫法），依待決 #12 與技術待決 N3。T9「七項的實作全歸 #111」的歸屬字句，依待決 #13。
- **不含**：認證與權限、業務模組、Celery／Redis／worker、可觀測性（Epic #502 §不包含）；五項關鍵路徑 90% 分支覆蓋的實際量測（程式尚不存在，ADR-007 D2）；正式部署的 TLS 與備份（ADR-008 待決 1、7）；Agent hook（#111）；修改 `design/prototype/`；修改 `main` ruleset（屬維護者動作，待決 #10）。
- **破壞性變更**：無對外 API 或資料變更。對開發者行為有一項收緊：前端 `lint` 改為零警告，任何警告都讓本機與 CI 的 lint 失敗。前端目前零警告，既有程式不受影響（`fix-pages-root-layer-classification` tasks 3.1）。

## Capabilities

### New Capabilities

- `container-runtime`：以容器編排重現整套系統。範圍包括 Lite 與正式兩層各起哪些服務、遷移先於後端完成且失敗時後端不啟動、後端的容器健康檢查與「全部健康才算起來」、正式層缺資料庫密碼時拒絕啟動、Lite 資料保存在持久化 volume、設定範例檔的內容與不含 secret。唯一公開入口與對外埠依待決 #2。
- `workspace-commands`：根目錄的 setup、dev、契約同步、check 四條指令。範圍包括各自的行為、契約同步「匯出失敗就不重產」、check 的固定順序與第一個失敗即以非 0 結束、需要 PostgreSQL 的那一步在缺設定時明確印出「已跳過」、探針殘留時明確失敗。語意依待決 #11，`setup` 名稱依技術待決 N1。
- `e2e-testing`：根目錄 e2e 套件的結構與執行約束。範圍包括 `e2e/<module>/<page>.spec.ts` 的位置、`baseURL` 與預設位址只集中在一處、固定介面語言、前端呼叫位址與後端允許來源由同一處推導、共用 fixtures 不含答案資料，以及健康檢查頁顯示正常的那一條旅程。
- `backend-code-boundaries`：後端原始碼的機械分層檢查。範圍包括模組內 router、service、repository、models 的允許方向，Router 不直接使用資料層，共用層不依賴業務模組，資料層不處理 HTTP，每個模組都受檢、漏列時測試失敗。違反時檢查 MUST 失敗並指出違反的契約與 import 鏈。
- `ci-quality-gates`：每張 PR 在 CI 上執行的檢查，以及各自的失敗條件。範圍包括雙資料庫測試（PostgreSQL 那一輪 0 skipped）、契約漂移比對、覆蓋率不得低於基準、前後端分層檢查、Semgrep、容器健康檢查驗證；要不要再加 e2e、型別檢查與後端 lint、相依套件掃描，依待決 #3、#4、#5。job 執行條件依待決 #9。Semgrep 的失敗或回報依待決 #6，覆蓋率基準的定義依待決 #7、#8 與 N2。

### Modified Capabilities

- `frontend-code-boundaries`：前端 lint 改為零警告，任何警告都讓 lint 以非 0 結束，讓「違反時 lint MUST 失敗」在規則被降成警告時仍然成立（2026-11-21 留言第 1 點）。進行中的 `fix-pages-root-layer-classification`（#528）也修改這個 capability：本 change 的 delta 要以那張 change 歸檔後的主規格為基準，歸檔順序由 `ops` 處理（system-analysis §跨模組依賴）。

依待決結果可能增列（目前**不**列入，clarification 決議後由 planner 回修本節）：

- `runtime-config`：待決 #14 若決定在正式層關閉互動式 API 文件，會新增一項有預設值的設定。
- `health-check`：待決 #15 若決定拆出不碰資料庫的存活檢查，會新增端點，`api-contract.md` 也要回修。

`frontend-api-codegen`、`api-schema-export`、`database-migration`、`frontend-routing`、`dev-health-page` 在本 change 只被呼叫或觀察，requirement 不變。

## Impact

- **新增檔案**：`docker-compose.yml`、`docker-compose.prod.yml`、`.env.example`、根目錄 `.dockerignore`、`backend/Dockerfile`、`backend/.dockerignore`、`frontend/Dockerfile`、`frontend/nginx.conf`、`.semgrep/`（規則與回歸樣本）、`scripts/` 下的 dev、check、覆蓋率比較與 skipped 檢查腳本及其測試、`e2e/` 整個套件。完整目錄見 system-design §目錄結構。
- **修改檔案**：`.github/workflows/ci.yml`（只新增 job）；根目錄 `package.json`（四條指令）；`pnpm-workspace.yaml`（加入 `e2e`）；`.gitignore`；`backend/pyproject.toml`（分層檢查契約與覆蓋率設定）；`frontend/package.json`（`lint` 零警告）；`frontend/vitest.config.ts`（覆蓋率摘要輸出，分母依待決 #8）。文件：`AGENTS.md`、`docs/development/rules/` 下的規則文件，範圍依待決 #12、#13；`scripts/setup.sh` 與 `AGENTS.md` §Required Behaviors 是否要改，依待決 #11、N1。
- **新增依賴**：後端以 `uv add --dev` 加入分層檢查工具（若待決 #5 決定接相依套件掃描，再加掃描工具）；e2e 以 `pnpm add` 加入瀏覽器測試框架（Hard Rule 3）。版號不動（Hard Rule 4）。
- **API**：無新增或修改（`api-contract.md`）。容器健康檢查與 e2e 都沿用既有的 `GET /api/v1/health`（`getHealth`）。若待決 #15 決定拆端點，會改變這一項。
- **資料模型**：無。不新增表、欄位或遷移，資料表字典與 ER 都不動（system-design §資料模型異動）。
- **UI**：無（`ui-design.md`）。e2e 只觀察 #505 既有的 `/dev/health`，不新增 `data-testid`，前端程式不改。
- **權限與答案隔離**：沒有產品角色的權限檢查點，PRD §權限矩陣不受影響。Hard Rule 5、6 在行為上不適用：e2e fixtures 不放任何資料檔與答案（system-design §權限檢查點）。基礎建設面的約束：設定範例檔不含 secret、CI 的 log 不印設定值、新 job 只有 `contents: read`、`CORS_ALLOWED_ORIGINS` 一律寫明確來源。
- **治理**：新 job 不會自動成為 `main` 的必過檢查。驗收條件 2–4 寫的「CI 失敗」要真正擋住合併，取決於維護者是否修改 ruleset（待決 #10），這不在 `/sdd` 的授權內。
- **下游**：規格 01-01 登入起，每張 PR 都受雙資料庫測試、覆蓋率、分層檢查與 Semgrep 約束，`e2e/shared/fixtures/` 是第一條角色旅程的擴充點。#111 的 hook 可轉接本次的 check 指令。第一個背景工作的 change 會在本次的編排檔上加 Redis 與 worker。

## 引用的需求來源

- 維護者指定：Issue #506 §使用情境／功能範圍「包含」七項、§需求目標、§驗收條件 1–6、2026-11-21 留言「折進本單：前端的檢查目前完全不在 CI 裡」（`--max-warnings 0`、探針檔殘留兩點）；Epic #502 §範圍「不包含」、§需求目標、§承接的延後條文；#503 裁定（追溯方式）；Issue #509（ruleset 四項必過）；Issue #111 §2b。
- 歸檔 change 的交接：`2026-11-20-backend-skeleton` 的 `clarification.md` Q1、Q5、Q6、Q8、N6，`system-design.md` §交易、session 與效能，`acceptance.md` 附註 3；`2026-11-20-frontend-skeleton` 的 `clarification.md` Q1、Q7、Q8、Q12，`design.md` D8、§跨 change 依賴。進行中 change `fix-pages-root-layer-classification`（#528）。
- `docs/specs/`：無對應規格頁（spec-migration D4）。
- ADR：ADR-003 D1、D3、D7；ADR-005 D2；ADR-007 D1、D2、D4；ADR-008 D1、D2、D3、D8、D10、§待決 1、7。
- 規則文件：testing-agent-rules T1、T4、T5、T8、T9、T10、T11；backend-agent-rules B1、B2、B6、B7、B10；frontend-agent-rules F1、F2、F3；api-agent-rules A5；security-agent-rules S2、S9；agent-hook-contract H7。
- `AGENTS.md` Hard Rule 3、4、5、6、7、8，§Agent Rules Index 第四段，§Required Behaviors 第一條；`docs/development/architecture.mdx` §技術選型「目錄結構（目標）」、§容器視圖、§資料庫雙層、§部署與維運；`openspec/config.yaml` `operations.apply.guidance`（前後端檢查指令）。
- 既有主規格（只呼叫或觀察）：`health-check`、`runtime-config`、`database-migration`、`api-schema-export`、`frontend-api-codegen`、`frontend-routing`、`dev-health-page`、`frontend-i18n`。

## 待決問題

全部帶到 clarification，本 proposal 不作答。

- system-analysis 待決 #1–#16（`system-analysis.md` §待決問題）：#1 容器裡驗什麼；#2 唯一公開入口；#3 e2e 進不進 CI；#4 型別檢查與後端 lint 進不進 CI；#5 相依套件掃描；#6 Semgrep 失敗或回報、規則集、範圍；#7 覆蓋率基準的定義；#8 前端覆蓋率分母；#9 `hashFiles()` 語意；#10 必過檢查清單與 ruleset；#11 四條根目錄指令的語意；#12 文件改寫範圍；#13 T9 與 #111 的歸屬；#14 正式層關閉互動式 API 文件；#15 健康檢查輪詢頻率與存活端點；#16 access log 格式。
- system-design 技術待決 N1–N5（`system-design.md` §本文新發現的待決問題）：N1 `setup` 與 pnpm 內建指令同名；N2 覆蓋率初始基準的來源；N3 具名 volume 下的備份寫法；N4 `compose` job 的執行時機；N5 分層檢查工具的萬用字元支援（技術風險，apply 第一個後端群組先驗證，不需維護者決定）。
