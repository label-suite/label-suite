# e2e-testing Specification

## Purpose

定義根目錄 e2e 套件的位置、執行方式與撰寫約束，以及第一條全端旅程（健康檢查頁顯示正常），讓之後每個模組的角色旅程都有固定的放置規則、單一的位址設定與共用的擴充點。

## Requirements

### Requirement: e2e 是根目錄的獨立套件

e2e 測試 SHALL 放在根目錄 `e2e/`，是根目錄 pnpm 工作區的一個套件，從根目錄以 `pnpm --filter e2e test` 執行；spec 檔 SHALL 依 `e2e/<module>/<page>.spec.ts` 放置，共用的 fixture 放在 `e2e/shared/fixtures/`。前端映像 MUST NOT 含 e2e 套件的依賴。

來源：ADR-007 D1、D4；testing-agent-rules T1。

#### Scenario: 從根目錄執行 e2e

- **WHEN** 根目錄依 lockfile 安裝依賴並裝好瀏覽器後，執行 `pnpm --filter e2e test`
- **THEN** 指令自行起後端與前端開發伺服器、跑完 `e2e/` 下所有 spec，全部通過時以結束碼 0 結束，結束後兩個伺服器都已關閉

#### Scenario: spec 檔依模組與頁面放置

- **WHEN** 列出 `e2e/` 下所有 `*.spec.ts`
- **THEN** 每個檔案的路徑都是 `e2e/<module>/<page>.spec.ts` 兩層結構，`e2e/shared/` 下沒有 spec 檔

### Requirement: 位址設定只集中在一處

前端與後端的位址 SHALL 只由 e2e 設定檔讀取兩個環境變數（`E2E_BASE_URL`、`E2E_API_URL`）決定，未設定時的本機預設值 MUST 只寫在該設定檔一處。spec 檔 MUST 以相對路徑導覽，MUST NOT 含主機名稱或埠號。

來源：testing-agent-rules T8；ADR-007 D4。

#### Scenario: spec 不含主機與埠

- **WHEN** 在 `e2e/` 下除設定檔以外的所有檔案搜尋 `localhost`、`127.0.0.1` 與 `:<四到五位數字>` 形式的埠號
- **THEN** 沒有任何命中

#### Scenario: 以環境變數改位址

- **WHEN** 設定 `E2E_BASE_URL` 與 `E2E_API_URL` 為與預設值不同的兩個本機埠，執行 `pnpm --filter e2e test`
- **THEN** 前端與後端開發伺服器分別在這兩個埠起來，旅程通過

### Requirement: 介面語言固定為 zh-TW

e2e 的瀏覽器 context SHALL 固定以 `zh-TW` 為介面語言與請求語言，不受執行機器的系統語言影響。

來源：testing-agent-rules T8；主規格 `frontend-i18n`；system-design D8a。

#### Scenario: 英文系統上仍以 zh-TW 執行

- **WHEN** 在系統語言為英文的機器上執行 `pnpm --filter e2e test`
- **THEN** 健康檢查頁以 zh-TW 文案呈現，旅程通過

### Requirement: 前端呼叫位址與後端允許來源由同一處推導

e2e 起的後端，其允許來源 SHALL 由前端位址推導；e2e 起的前端，其後端呼叫位址 SHALL 由後端位址推導。兩個值 MUST NOT 讀自根目錄 `.env`。

來源：testing-agent-rules T8；主規格 `runtime-config`、`dev-health-page`；system-design D8a。

#### Scenario: 根目錄 .env 不影響 e2e

- **WHEN** 根目錄 `.env` 的 `CORS_ALLOWED_ORIGINS` 與 `VITE_API_BASE_URL` 設成與 e2e 位址不符的值，執行 `pnpm --filter e2e test`
- **THEN** 旅程通過，頁面沒有出現「連不到後端」

### Requirement: 等待只用條件式

e2e spec MUST NOT 使用固定時間的等待；等待頁面狀態時 SHALL 以「直到條件成立」的斷言進行。每個 spec 檔 SHALL 只走一條旅程。

來源：testing-agent-rules T8。

#### Scenario: spec 不使用固定時間等待

- **WHEN** 在 `e2e/` 下所有 spec 檔搜尋固定時間等待的呼叫
- **THEN** 沒有任何命中

### Requirement: 共用 fixtures 不含資料檔

`e2e/shared/fixtures/` SHALL 只放共用的測試擴充程式，MUST NOT 含任何資料檔；e2e MUST NOT 含標準答案或測試集標記。

來源：`AGENTS.md` Hard Rule 6；testing-agent-rules T5、T6；clarification 第 10 面向。

#### Scenario: 共用 fixtures 目錄沒有資料檔

- **WHEN** 列出 `e2e/shared/fixtures/` 下的所有檔案
- **THEN** 只有 TypeScript 原始檔，沒有 `.json`、`.csv`、`.jsonl` 或其他資料檔

### Requirement: 健康檢查頁旅程

e2e SHALL 有一條旅程：在前端開發伺服器開啟健康檢查開發頁，看到後端與資料庫都正常。旅程只觀察既有頁面，MUST NOT 依賴新增的測試專用屬性；這條旅程不使用任何角色登入狀態。

來源：clarification Q1、Q3；ADR-007 D1；主規格 `frontend-routing`、`dev-health-page`；system-design D8b。

#### Scenario: 開發伺服器上的健康檢查頁顯示正常

- **WHEN** e2e 起後端（SQLite 暫存檔）與前端開發伺服器，瀏覽器以相對路徑開啟健康檢查開發頁
- **THEN** 頁面有標題「系統健康檢查」，等待後出現「後端與資料庫都可以用」
- **AND** 「服務」與「資料庫」兩項的值都是 `ok`，檢查時間與 traceId 兩項存在，頁面上沒有 `role="alert"` 的元素
