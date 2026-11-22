# Spec Delta

## Purpose

定義根目錄四條指令（`bootstrap`、`dev`、`api:sync`、`check`）的行為，讓貢獻者與 coding agent 用同一組指令完成安裝、起本機開發環境、同步前後端契約，並在提交前跑完與 CI 相同的自查。

## ADDED Requirements

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

根目錄 SHALL 提供 `pnpm run check`，依固定順序執行格式、規格、前端 lint、型別檢查與測試、契約漂移、後端 lint、格式、型別檢查、分層檢查與測試；每一步呼叫的 MUST 是 CI 使用的同一個 package script 或指令。每一步 SHALL 印出名稱與結果；第一個失敗的步驟 MUST 讓指令以非 0 結束，後續步驟不再執行。

來源：testing-agent-rules T9、T11；agent-hook-contract H7；clarification Q4、Q11。

#### Scenario: 全部通過

- **WHEN** 在通過所有檢查的工作區執行 `pnpm run check`
- **THEN** 每一步都印出名稱與通過結果，指令以結束碼 0 結束

#### Scenario: 某一步失敗時停止

- **WHEN** 一個前端檔案有 lint 錯誤，執行 `pnpm run check`
- **THEN** 前端 lint 那一步印出失敗，指令以非 0 結束，後端的步驟沒有執行

#### Scenario: 預設不跑 e2e 與安全掃描

- **WHEN** 執行 `pnpm run check`，接著執行 `pnpm run check --with-e2e --with-semgrep`
- **THEN** 第一次不執行 e2e 與原始碼安全掃描；第二次兩者都執行並各自印出結果

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

`check` 執行前端 lint 之前 SHALL 檢查 `frontend/src/pages/` 底下有沒有分層測試被中斷時留下的探針檔；有的話 MUST 以非 0 結束並說明該檔的來源與處理方式，MUST NOT 自動刪除該檔。探針檔 MUST 被版控忽略。

來源：#506 留言（2026-11-21）第 2 點；testing-agent-rules T5、T11；system-design D10。

#### Scenario: 偵測到殘留探針檔時失敗且不刪除

- **WHEN** `frontend/src/pages/` 底下存在 `boundary-probe.tsx`，執行 `pnpm run check`
- **THEN** 指令在前端 lint 之前以非 0 結束，訊息指出該檔路徑、說明它是被中斷的測試留下的並請刪除後重跑
- **AND** 該檔仍存在，`git status --porcelain` 不列出它
