# Design

## Context

動機見 `proposal.md` §Why。本文只記實作取捨；檔案佈局、編排拓撲、CI job 步驟、本機自查順序與設定範例檔的欄位都已寫在 `system-design.md`，這裡指過去，不重抄。

會影響做法的現況與限制：

- `backend/` 與 `frontend/` 已由 #504、#505 建好；兩邊的 lint、型別檢查、測試只在本機跑，CI 只有 `commit-messages`、`docs-site`、`format`、`specs` 四個 job（`.github/workflows/ci.yml`）。這四個 job 一字不動（system-design §CI job 設計）。
- 既有 `specs` job 逐一列出 `scripts/tests/` 下要跑的測試檔，不用萬用字元；本 change 新增的腳本測試不會自動被它執行（見 D11）。
- #528（`fix-pages-root-layer-classification`）尚未歸檔，連 `origin/main` 的主規格 `frontend-code-boundaries` 都還是歸檔前的版本，而它的 delta 以 MODIFIED 改寫「依分層限制 import 方向」（見 D2）。
- 本次沒有 API、資料表或 UI 變更：`api-contract.md`、`ui-design.md` 都只有一行，system-design §資料模型異動 為「無」。
- 維護者在 `clarification.md` Q1–Q15 已全數裁定（2026-11-22），本文不與之矛盾；只剩技術風險 N5 開著（R1）。

## Goals / Non-Goals

**Goals:**

- 每一個 delta spec 的 Scenario 都有一個 CI job 步驟或本機指令能客觀判定（對照見 D4）。
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

遷移是一次性服務、正式層是獨立檔、Lite 用具名 volume、缺密碼時由 Compose 拒絕啟動、30 秒健康檢查、前端 nginx 是唯一公開入口，全部依 system-design §部署拓撲 與 D1–D6，本文不另做選擇。實作上要注意的兩點：

- 前端映像以 repo 根為 build context，需要根目錄 `.dockerignore` 排除 `node_modules`、`.git`、`docs/` 等；`design/prototype/assets/` 只讀取（frontend-skeleton design D8）。
- 容器建置時 `VITE_API_BASE_URL` 為空字串，前端呼叫走同源的 `/api/v1`，由 nginx 轉發（system-design D6）。空字串時產生的呼叫層組出的網址是否正確，由 compose job 經公開入口取健康檢查、以及 frontend 群組的一支單元測試共同確認（R6）。

### D4 CI job 與 Scenario 的對應

job 名稱、步驟與失敗條件照 system-design §CI job 設計 的表。每個 Scenario 由哪裡判定：

| capability                 | 判定的 job 或指令                                                                     |
| :------------------------- | :------------------------------------------------------------------------------------ |
| `container-runtime`        | `compose` job（system-design D7，加下方補的三個靜態步驟）；其餘動態負向情境見下方說明 |
| `workspace-commands`       | `scripts/tests/` 下 `check`、`dev` 的 `node --test` 測試（D11）                       |
| `e2e-testing`              | `e2e` job；位址、等待、fixtures 三條靜態約束由 e2e 套件內的一支掃描測試判定（D7）     |
| `backend-code-boundaries`  | `backend-sqlite` job 的 `lint-imports` 步驟與後端 unit 測試（D9）                     |
| `ci-quality-gates`         | 各對應 job；「既有四個 job 不變」由 code-review 比對 diff                             |
| `security-scanning`        | `semgrep` job（含 `semgrep --test`）、`dependency-audit` job                          |
| `frontend-code-boundaries` | `frontend` job 的 lint 步驟；「降成警告仍失敗」由前端既有探針測試的一個新案例判定     |

`container-runtime` 的判定分兩類：

- **靜態、進 `compose` job**：在 system-design D7 的 `docker compose config --quiet` 之後加三步，都不起容器：(1) 不帶 `POSTGRES_PASSWORD` 對正式層執行 `docker compose -f docker-compose.prod.yml config`，斷言以非 0 結束且訊息含 `POSTGRES_PASSWORD`；(2) 以 `docker compose config --format json` 讀兩份檔，斷言只有 `frontend` 服務有 `ports`；(3) 同一份 JSON 斷言 backend 健康檢查的 interval 為 30 秒。這三步讓缺密碼、唯一入口與輪詢設定在每次 compose job 都被機械判定。
- **動態負向情境**（遷移失敗時後端不啟動、允許來源為空或含 `*`、資料庫停止後後端轉為不健康、具名 volume 的保留與 `-v` 移除、`.env` 不進映像、SPA fallback、後端不能從主機連線）：起停容器的成本高、部分要等 90 秒以上，不放進每次的 CI。實作的 task 在本機逐條執行 spec 的 WHEN、把指令與結果記在提交訊息，acceptance-verifier 依 `acceptance.md` 的手動步驟重跑。

只有在路徑過濾下才跑的 `compose` 與每張 PR 都跑的 `e2e`，依 Q9、Q3 不列必過（system-design D13）。

### D5 雙資料庫與 skipped 檢查照 system-design D11

PostgreSQL 那一輪以 JUnit XML 加 `scripts/check-junit-skips.mjs` 斷言 0 skipped；選 JUnit XML 而不是解析 pytest 的終端摘要，因為摘要格式隨 pytest 版本與外掛變動，XML 的 `skipped` 屬性穩定，也能列出被跳過的測試名。

### D6 覆蓋率照 system-design D12

`scripts/check-coverage.mjs` 只吃「實測、基準、容許誤差」，讀後端 `coverage.json` 的 `totals.percent_covered` 與前端 `coverage-summary.json` 的 `total.statements.pct`、`total.branches.pct`。`--update` 只在本機使用；CI 的步驟不帶 `--update`。基準檔不存在或缺欄位時腳本失敗並說明缺什麼，不以 0 當預設（loud failure，agent-rules R7）。初始值怎麼產生見 R3。

### D7 e2e 跑在開發伺服器上，照 system-design D8、D8a、D8b

`playwright.config.ts` 是唯一讀 `E2E_BASE_URL`、`E2E_API_URL` 並寫預設值的地方，兩個推導值（後端允許來源、前端呼叫位址）在這裡以 `webServer.env` 明確帶入，不讀根目錄 `.env`（system-design D8a）。e2e spec 的三條靜態約束（不含主機與埠、不用固定時間等待、`shared/fixtures/` 只有 `.ts`）用一支 `node --test` 掃描測試判定，放在 `e2e/` 套件內、由 `e2e` 的 `test:static` script 執行，`e2e` job 在跑瀏覽器之前先跑它。替代方案是 ESLint 規則：e2e 套件目前沒有 ESLint，為三條字串比對引進一整套 lint 設定不划算。

### D8 前端 lint 零警告與探針殘留照 system-design D9、D10

`frontend/package.json` 的 `lint` 改成 `eslint . --max-warnings 0`，CI 與 `check` 都呼叫這個 script。「規則降成警告仍失敗」的 Scenario 由前端既有的邊界探針測試加一個案例驗證：以覆寫設定把分層規則設成 `warn` 跑 ESLint 的 Node API，斷言加上 `maxWarnings: 0` 的判定結果為失敗。探針殘留的三層防護照 D10；`.gitignore` 加 `frontend/src/pages/**/boundary-probe.tsx`。

### D9 後端分層契約照 system-design §後端：分層 import 檢查的對象

四條契約寫在 `backend/pyproject.toml` 的 `[tool.importlinter]`。「新模組漏列時測試失敗」由一支後端 unit 測試以 `pkgutil.iter_modules(app.modules.__path__)` 列出所有模組，與契約設定比對。「違反時檢查失敗」的各個 Scenario 由同一個測試檔以暫存目錄建出違規的模組副本、對它跑 import-linter 並斷言非 0；不在 `app/` 裡留違規檔。萬用字元是否可用見 R1，fallback 寫在 tasks 1.1。

### D10 根目錄四條指令照 system-design §本機自查的步驟

`bootstrap`、`dev`、`api:sync`、`check` 寫成根目錄 `package.json` 的 script；`dev` 與 `check` 的邏輯在 `scripts/dev.mjs`、`scripts/check.mjs`，`api:sync` 直接串兩條既有指令（後端匯出成功才跑前端重產）。`check` 的旗標寫成 `pnpm run check --with-e2e --with-semgrep`（pnpm 10 會把 script 名稱之後的參數轉給腳本，不需要 `--`）。`check.mjs` 的步驟清單寫成一個陣列常數，測試對它斷言順序與每一步的指令字串，這樣「與 CI 相同」可以由測試比對 `ci.yml` 的對應 `run:` 判定。

### D11 新腳本的測試在使用它的 job 裡先跑

既有 `specs` job 不能改（Non-Goals），新腳本的 `node --test` 要有地方跑。決定：`backend-postgres` job 在呼叫 `check-junit-skips.mjs` 前先跑它的測試；`coverage` job 在呼叫 `check-coverage.mjs` 前先跑它的測試，並一併跑 `check.mjs`、`dev.mjs` 的測試（這兩支腳本不在任何 CI job 裡被呼叫）。本機的 `pnpm test:scripts` 以萬用字元涵蓋全部，不必改。替代方案是新增一個 `scripts-tests` job：多一個 job 名稱給 ruleset 選，但它與 `specs` job 的職責重疊；放進使用者 job 讓「腳本壞了」直接表現為使用它的 job 失敗。system-design §CI job 設計 的表沒有寫這幾步，屬本文補的實作細節，不改變任何 job 的失敗語意。

### D12 相依套件掃描照 Q5，嚴重度過濾的可行性見 R2

`pip-audit` 以 `uv add --dev` 加入；前端用 pnpm 內建的 `audit`。`pnpm audit --prod --audit-level high` 的旗標確定存在；`pip-audit` 依嚴重度過濾的方式待 apply 驗證（R2）。

### D13 文件改寫照 Q12 (a)(b)(d)(e)(f)

改寫的位置：

- `docs/development/rules/` 的「檢查方式」段：backend（B1、B2、B6、B7）、frontend（F1、F2、F3）、api（A5）、security（S2）、testing（T1、T9、T10），從「待建置」改成本次實際的 job 名稱與指令。
- testing-agent-rules T9 的「七項的實作全歸 #111」改成哪幾項由本 change 建成、哪幾項仍屬 #111（Q12 (e)）。
- backend-agent-rules B1 §例外 補一句：健康檢查模組仍是分層檢查對象（Q12 (f)）。
- ADR-008 D8 的「Semgrep 延後」改為已建成；`architecture.mdx` §部署與維運 的 CI 安全掃描列與備援列（具名 volume 改用 `docker compose cp`，system-design N3）。
- `AGENTS.md` 與各規則文件開頭的「目錄不存在」敘述不改（Q12 (c)，#523）。

文件群組放在最後，因為檢查方式要寫實際的 job 名稱與指令，必須等前面的群組定案；這不是把前面群組欠的文件堆到最後：前面每個群組都不產生文件義務，規則文件的改寫本身就是 Q12 的獨立工作。

## Risks / Trade-offs

- **R1 import-linter 的 `forbidden` 契約可能不支援萬用字元（N5）** → tasks 1.1 先在所裝版本上驗證：寫一條 `app.modules.*.router` 的 forbidden 契約，對刻意違規的暫存模組跑 `lint-imports`，看是否非 0。支援就照 system-design 的四條契約寫；不支援時，後端 unit 測試以 `pkgutil.iter_modules` 列出所有模組、逐模組產生 forbidden 契約內容，並斷言 `pyproject.toml` 的契約與產生結果一致（clarification §交給後續產出）。兩條路的外部行為相同，spec 不受影響；驗證結果寫進該群組的提交訊息。
- **R2 `pip-audit` 可能沒有依嚴重度過濾的旗標** → ADR-008 D8 與 Q5 寫的是 `pip-audit --fail-on high`。tasks 3.1 先以 `uv run pip-audit --help` 與官方文件確認旗標是否存在。存在就照寫。不存在時：(1) fallback 是以 `pip-audit --format json` 輸出、交給一支小腳本依弱點資料庫的嚴重度判定 high 以上才失敗；若 JSON 沒有嚴重度欄位，再退一步改為「任何已知弱點都失敗」，那比 ADR 嚴格；(2) 不論採哪一個 fallback，都**不得自行改寫 ADR-008 D8 或 Q5 的字句**，由執行的 agent 停下，把實際旗標、選用的 fallback 與它和 D8 字面的差異回報給主 agent，由主 agent 轉維護者決定是否接受或修 ADR。這條同時適用 `pnpm audit` 旗標與 Q5 不符的情況。
- **R3 覆蓋率基準的初始值要等 CI 量出來** → 基準檔不存在時 `check-coverage.mjs` 失敗（D6），所以本 PR 第一次 CI run 的 `coverage` job 會是紅的，但 job 仍會把實測值印出來。tasks 的最後一個整合群組取這些值寫進 `coverage-baseline.json` 再提交，之後的 run 應該轉綠。不以 0 或 acceptance 記的 97%、98.98% 當占位值（Q7）。
- **R4 既有依賴可能已有 high 弱點，或既有程式命中 Semgrep 規則** → 新 job 一上就紅。apply 時若發生，停下回報，不加忽略清單、不降門檻（AGENTS.md §Review Guidelines；loud failure）。升級依賴屬另一張 issue 的決定。
- **R5 新加的檢查可能抓到既有程式的違規**（分層契約、零警告、mypy strict 在 CI 的設定差異） → system-design 已確認健康檢查模組符合四條契約、前端目前零警告。若 apply 實測不符，停下回報，不在本 change 改產品程式（Non-Goals）。
- **R6 容器建置的空 `VITE_API_BASE_URL`** → 若產生的呼叫層對空字串組出錯誤網址，compose job 經公開入口取健康檢查會失敗而不是默默通過；frontend 群組另加一支單元測試，斷言空字串時呼叫的是同源的 `/api/v1/health`。若需要改前端產品程式才能支援，停下回報（R5）。
- **R7 e2e 與 compose 的穩定度與耗時** → 兩者都不列必過（Q3、Q9、Q10）；e2e 失敗時上傳報告供查。瀏覽器只裝 chromium。
- **R8 #528 與本 change 的歸檔順序** → D2 已讓兩者不碰同一段文字。若 #528 在本 change apply 期間歸檔，frontend 群組重新跑 lint 確認仍零警告即可，不需改 delta。
- **取捨：正式層與 Lite 兩份編排檔約 30 行重複**（system-design D2）→ 由 `docker compose config --quiet` 與 compose job 兩層都起一次抓漂移。

## Migration Plan

- **資料庫**：無 schema 變更、無 Alembic revision，不需要遷移或回填。
- **部署順序**：本 change 只新增檔案與 CI job，合併即生效；沒有正式環境要切換。合併後由維護者另開 issue 修改 ruleset（Q10），在那之前新 job 只會顯示結果、不擋合併。
- **對開發者的影響**：合併後本機 `pnpm --filter frontend lint` 有任何警告就失敗；`pnpm install` 會多裝 `e2e` 套件，`pnpm run bootstrap` 是新的一次性入口（`scripts/setup.sh` 照舊可單獨使用）。
- **回滾**：revert 合併 commit 即可。沒有資料、沒有對外 API、ruleset 也還沒改，revert 後 CI 回到四個 job、根目錄指令消失，不留殘餘狀態。若 ruleset issue 已把新 job 設為必過，revert 前要先請維護者把它們從必過清單拿掉，否則之後的 PR 會等不到這些 job。

## Open Questions

- Docker 建置要不要加 layer cache：等 compose job 的實測耗時再定（system-design §效能與資源），不影響 spec 與任務拆分。
- `e2e`、`compose` 何時列為必過：由 Q10 的 ruleset issue 處理。
