# workspace-commands Specification

## Purpose

定義根目錄四條指令（`bootstrap`、`dev`、`api:sync`、`check`）的行為，讓貢獻者與 coding agent 用同一組指令完成安裝、起本機開發環境、同步前後端契約，並在提交前跑完與 CI 相同的自查。

## Requirements

### Requirement: bootstrap 一次完成安裝

根目錄 SHALL 提供 `pnpm run bootstrap`：先啟用 Git hooks（執行既有的 `scripts/setup.sh`），再依 lockfile 安裝 JavaScript 工作區與後端的依賴。依賴與 lockfile 不一致時 MUST 以非 0 結束。根目錄 MUST NOT 提供名為 `setup` 的指令。

來源：ADR-003 D7；`AGENTS.md` Hard Rule 3、§Required Behaviors 第一條；clarification Q11。

#### Scenario: 乾淨 clone 一條指令完成安裝

- **WHEN** 在乾淨的 clone 執行 `pnpm run bootstrap`
- **THEN** 指令以結束碼 0 結束，`git config core.hooksPath` 為 `scripts/git-hooks`
- **AND** 之後不再安裝任何依賴，直接執行 `pnpm --filter frontend lint` 與 `cd backend && uv run pytest` 都能啟動

#### Scenario: lockfile 不一致時 bootstrap 失敗

- **WHEN** `frontend/package.json` 新增一個依賴但 `pnpm-lock.yaml` 沒有更新，執行 `pnpm run bootstrap`
- **THEN** 指令以非 0 結束，不改寫 lockfile

#### Scenario: 根目錄沒有 setup 指令

- **WHEN** 讀取根目錄 `package.json` 的 `scripts`
- **THEN** 有 `bootstrap`，沒有 `setup`

### Requirement: dev 起本機前後端開發伺服器

根目錄 SHALL 提供 `pnpm run dev`，在本機（不是容器）同時起後端與前端開發伺服器，並讀取根目錄 `.env`。任一方結束時另一方 MUST 一併結束，指令以先結束那一方的結束碼結束；收到中斷訊號時兩者 MUST 都結束。

來源：ADR-003 D7；clarification Q11。

#### Scenario: 起本機開發環境

- **WHEN** 以 `.env.example` 複製出 `.env`，執行 `pnpm run dev`
- **THEN** 後端的 `/api/v1/health` 在 `BACKEND_PORT` 回應 200，前端開發伺服器在 5173 回應 200

#### Scenario: 一方結束時另一方一併結束

- **WHEN** `pnpm run dev` 執行中，後端程序以非 0 結束
- **THEN** 前端開發伺服器也結束，`pnpm run dev` 以後端的結束碼結束

#### Scenario: 中斷時兩者都結束

- **WHEN** `pnpm run dev` 執行中收到 SIGINT
- **THEN** 後端與前端開發伺服器的程序都不再存在

### Requirement: api:sync 一次完成後端匯出與前端重產

根目錄 SHALL 提供 `pnpm run api:sync`：先由後端匯出介面描述檔，成功後再以它重產前端呼叫層。指令 MUST NOT 需要環境變數或資料庫。匯出失敗時 MUST 以非 0 結束，且 MUST NOT 執行重產。

來源：api-agent-rules A5；主規格 `api-schema-export`、`frontend-api-codegen`。

#### Scenario: 契約同步指令一次完成後端匯出與前端重產

- **WHEN** 在沒有 `.env`、沒有資料庫的環境，修改一個後端回應 schema 的欄位說明後執行 `pnpm run api:sync`
- **THEN** 指令以結束碼 0 結束，`backend/openapi.json` 與 `frontend/src/api/generated/` 都出現對應的差異，留在工作區供提交

#### Scenario: 匯出失敗時不重產

- **WHEN** 後端存在兩個相同的 operationId，執行 `pnpm run api:sync`
- **THEN** 指令以非 0 結束，`frontend/src/api/generated/` 沒有任何變更

### Requirement: check 依固定順序執行與 CI 相同的自查

根目錄 SHALL 提供 `pnpm run check`，依固定順序執行格式、規格、前端 lint、型別檢查與測試、契約漂移、後端 lint、格式、型別檢查、分層檢查與測試；每一步呼叫的 MUST 是 CI 使用的同一個 package script 或指令，參數也相同，後端測試同樣輸出覆蓋率資料與 JUnit 結果檔。加上 `--with-semgrep` 時 SHALL 在預設步驟之後依序加跑原始碼安全掃描與測試替身邊界檢查，指令與 CI `semgrep` job 的對應步驟相同。每一步 SHALL 印出名稱與結果；第一個失敗的步驟 MUST 讓指令以非 0 結束，後續步驟不再執行。

來源：testing-agent-rules T9、T10、T11；agent-hook-contract H7；api-agent-rules A5；clarification Q4、Q7、Q11；維護者規劃審查裁定 R-A（2026-11-22）；system-design §本機自查的步驟；issue #562 工作項 2、T4、T6 與其 clarification Q4。

#### Scenario: 全部通過

- **WHEN** 在通過所有檢查的工作區執行 `pnpm run check`
- **THEN** 每一步都印出名稱與通過結果，指令以結束碼 0 結束

#### Scenario: 某一步失敗時停止

- **WHEN** 一個前端檔案有 lint 錯誤，執行 `pnpm run check`
- **THEN** 前端 lint 那一步印出失敗，指令以非 0 結束，後端的步驟沒有執行

#### Scenario: 預設不跑 e2e 與安全掃描

- **WHEN** 執行 `pnpm run check`，接著執行 `pnpm run check --with-e2e --with-semgrep`
- **THEN** 第一次不執行 e2e、原始碼安全掃描與測試替身邊界檢查；第二次三者都執行並各自印出結果，測試替身邊界檢查排在最後

#### Scenario: 測試替身邊界檢查與 CI 指令相同

- **WHEN** 比對 `pnpm run check --with-semgrep` 的測試替身邊界檢查那一步的指令與 CI `semgrep` job 中測試替身邊界檢查那一步的指令
- **THEN** 兩邊的指令與參數逐字相同

#### Scenario: 測試替身邊界檢查失敗時停止

- **WHEN** 檢查範圍內有一處違規，執行 `pnpm run check --with-semgrep`
- **THEN** 測試替身邊界檢查那一步印出失敗，指令以非 0 結束

#### Scenario: 後端測試步驟與 CI 參數相同

- **WHEN** 比對 `check` 的 SQLite、PostgreSQL 兩輪後端測試指令與 CI 兩個後端測試 job 的對應指令
- **THEN** 兩邊的指令與參數相同，都輸出覆蓋率資料與 JUnit 結果檔

### Requirement: check 的契約漂移比對執行前的工作區

契約漂移那一步 SHALL 比對「重新匯出與重產的結果」和「執行前工作區裡的 `backend/openapi.json` 與 `frontend/src/api/generated/`」，MUST NOT 與最近一次 commit 比較；有差異時 MUST 以非 0 結束並列出檔名，重產結果留在工作區。

來源：api-agent-rules A5；testing-agent-rules T11；clarification Q11；system-design §本機自查的步驟。

#### Scenario: 剛同步、尚未提交的契約產物不被誤判

- **WHEN** 修改一個後端回應 schema 的欄位說明，執行 `pnpm run api:sync`，不提交，接著執行 `pnpm run check`
- **THEN** 契約漂移那一步通過

#### Scenario: 工作區的契約產物與重產結果不同時失敗

- **WHEN** 手動修改 `frontend/src/api/generated/` 下的一個檔案（不論是否已提交），執行 `pnpm run check`
- **THEN** 契約漂移那一步失敗並列出該檔名，指令以非 0 結束，該檔在工作區中是重產後的內容

### Requirement: check 不比較也不寫入覆蓋率基準

`check` MUST NOT 比較覆蓋率基準，也 MUST NOT 建立或修改 `coverage-baseline.json`；覆蓋率是否通過以 CI 為準（`ci-quality-gates`），本機只印出測試指令本身的覆蓋率摘要供參考。

來源：testing-agent-rules T10；clarification Q7；維護者規劃審查裁定 R-A（2026-11-22）；system-design D12、§本機自查的步驟。

#### Scenario: 本機不比較也不寫入覆蓋率基準

- **WHEN** `coverage-baseline.json` 的值高於本機量到的覆蓋率，執行 `pnpm run check`
- **THEN** 指令不因覆蓋率而失敗，`coverage-baseline.json` 沒有被修改（不存在時也沒有被建立）

### Requirement: check 明確回報 PostgreSQL 那一輪

沒有設定 `TEST_DATABASE_URL` 時，`check` MUST 印出 PostgreSQL 那一輪已跳過與原因，不得默默略過；有設定時 SHALL 執行 PostgreSQL 那一輪，且被跳過的測試數不為 0 時 MUST 失敗。SQLite 那一輪 SHALL 印出被跳過的測試數。

來源：backend-agent-rules B7；testing-agent-rules T4、T11；clarification Q11。

#### Scenario: 未設 TEST_DATABASE_URL 時明確印出已跳過

- **WHEN** 環境沒有 `TEST_DATABASE_URL`，執行 `pnpm run check`
- **THEN** 輸出含「PostgreSQL 那一輪已跳過：未設 TEST_DATABASE_URL」，SQLite 那一輪印出 skipped 數

#### Scenario: PostgreSQL 那一輪有跳過時失敗

- **WHEN** `TEST_DATABASE_URL` 指向可用的 PostgreSQL，但有一個測試在那一輪被跳過，執行 `pnpm run check`
- **THEN** 指令以非 0 結束，輸出列出被跳過的測試名

### Requirement: check 遇到探針殘留檔時失敗

`check` 執行前端 lint 之前 SHALL 檢查有沒有被中斷的前端 lint 探針測試留下的探針檔，範圍為 `frontend/src/pages/` 底下任一層的 `boundary-probe.tsx`，以及 `frontend/src/components/boundary-probe.tsx`、`frontend/src/components/size-probe.tsx`、`frontend/src/components/size-probe.test.tsx`；有的話 MUST 以非 0 結束並說明該檔的來源與處理方式，MUST NOT 自動刪除該檔。探針檔 MUST 被版控忽略。

來源：#506 留言（2026-11-21）第 2 點；issue #561 工作項 6；testing-agent-rules T5、T11；system-design D10（#506）；clarification Q10、T1（#561）。

#### Scenario: 偵測到殘留探針檔時失敗且不刪除

- **WHEN** `frontend/src/pages/` 底下存在 `boundary-probe.tsx`，執行 `pnpm run check`
- **THEN** 指令在前端 lint 之前以非 0 結束，訊息指出該檔路徑、說明它是被中斷的測試留下的並請刪除後重跑
- **AND** 該檔仍存在，`git status --porcelain` 不列出它

#### Scenario: 殘留的尺寸探針檔讓 check 在 lint 前失敗且不刪除

- **WHEN** `frontend/src/components/size-probe.tsx` 或 `frontend/src/components/size-probe.test.tsx` 存在，執行 `pnpm run check`
- **THEN** 指令在前端 lint 之前以非 0 結束，訊息指出該檔路徑、說明它是被中斷的測試留下的並請刪除後重跑
- **AND** 該檔仍存在，`git status --porcelain` 不列出它
