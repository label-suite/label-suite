# Spec Delta

## MODIFIED Requirements

### Requirement: e2e 是根目錄的獨立套件

e2e 測試 SHALL 放在根目錄 `e2e/`，是根目錄 pnpm 工作區的一個套件，從根目錄以 `pnpm --filter e2e test` 執行；spec 檔 SHALL 依 `e2e/<module>/<page>.spec.ts` 放置，共用的 fixture 放在 `e2e/shared/fixtures/`。只在容器公開入口才成立的旅程 SHALL 放在 `e2e/public-entry/`，預設跑法 MUST NOT 執行它們。前端映像 MUST NOT 含 e2e 套件的依賴。

來源：ADR-007 D1、D4；testing-agent-rules T1；nginx-security-headers clarification Q4。

#### Scenario: 從根目錄執行 e2e

- **WHEN** 根目錄依 lockfile 安裝依賴並裝好瀏覽器後，執行 `pnpm --filter e2e test`
- **THEN** 指令自行起後端與前端開發伺服器、跑完 `e2e/` 下 `e2e/public-entry/` 以外的所有 spec，全部通過時以結束碼 0 結束，結束後兩個伺服器都已關閉

#### Scenario: spec 檔依模組與頁面放置

- **WHEN** 列出 `e2e/` 下所有 `*.spec.ts`
- **THEN** 每個檔案的路徑都是 `e2e/<module>/<page>.spec.ts` 兩層結構，`e2e/shared/` 下沒有 spec 檔

#### Scenario: 預設跑法不執行公開入口旅程

- **WHEN** 不設 `E2E_TARGET`，執行 `pnpm --filter e2e exec playwright test --list`
- **THEN** 列出的旅程中沒有 `e2e/public-entry/` 下的檔案，`e2e/system-health/dev-health.spec.ts` 在其中

### Requirement: 位址設定只集中在一處

前端與後端的位址與跑法 SHALL 只由 e2e 設定檔讀取三個環境變數（`E2E_BASE_URL`、`E2E_API_URL`、`E2E_TARGET`）決定，未設定時的本機預設值 MUST 只寫在該設定檔一處。`E2E_TARGET` 為 `compose` 時 SHALL 對準 `E2E_BASE_URL` 所指的既有公開入口、不自起任何伺服器；此時 `E2E_BASE_URL` 未設或為空 MUST 以錯誤結束，MUST NOT 退回預設值。spec 檔 MUST 以相對路徑導覽，MUST NOT 含主機名稱或埠號。

來源：testing-agent-rules T8；ADR-007 D4；nginx-security-headers clarification Q4；system-design D5。

#### Scenario: spec 不含主機與埠

- **WHEN** 在 `e2e/` 下除設定檔以外的所有檔案搜尋 `localhost`、`127.0.0.1` 與 `:<四到五位數字>` 形式的埠號
- **THEN** 沒有任何命中

#### Scenario: 以環境變數改位址

- **WHEN** 設定 `E2E_BASE_URL` 與 `E2E_API_URL` 為與預設值不同的兩個本機埠，執行 `pnpm --filter e2e test`
- **THEN** 前端與後端開發伺服器分別在這兩個埠起來，旅程通過

#### Scenario: 對準容器入口時不自起伺服器

- **WHEN** 正式層編排已在 `http://localhost:8080` 起好，以 `E2E_TARGET=compose E2E_BASE_URL=http://localhost:8080` 執行 `pnpm --filter e2e test`
- **THEN** 沒有起後端或前端開發伺服器，只執行 `e2e/public-entry/` 下的旅程，全部通過時以結束碼 0 結束

#### Scenario: 對準容器入口卻沒有設位址時以錯誤結束

- **WHEN** 只設 `E2E_TARGET=compose`、不設 `E2E_BASE_URL`，執行 `pnpm --filter e2e test`
- **THEN** 指令在執行任何旅程之前以非 0 結束，錯誤訊息含 `E2E_BASE_URL`，沒有連到 `http://localhost:5173`

## ADDED Requirements

### Requirement: 公開入口不擋前端自己的資源旅程

e2e SHALL 有一條只在 `E2E_TARGET=compose` 時執行的旅程：瀏覽器開啟公開入口的 `/`，依主規格 `security-headers`「CSP 不擋前端自己的資源」的判準判定。頁面殼回應不帶 `Content-Security-Policy` 時 MUST 失敗；旅程 MUST NOT 比對 CSP 的值、MUST NOT 依賴頁面文案或新增的測試專用屬性，也不使用任何角色登入狀態。

來源：issue #568 §驗收條件 3；clarification Q4、Q5；system-design D4、D5；testing-agent-rules T8。

#### Scenario: 容器公開入口上的頁面殼載入正常

- **WHEN** 正式層編排已起，以 `E2E_TARGET=compose` 與指向公開入口的 `E2E_BASE_URL` 執行這條旅程
- **THEN** 頁面殼回應帶 `Content-Security-Policy`，頁面殼與它引用的每一支 `/assets/` 資源都回 `200`，CSP 違規 0 次、請求失敗 0 次，頁面內同源呼叫 `/api/v1/health` 回 `200`，旅程通過

#### Scenario: 目標沒有 CSP 時旅程失敗

- **WHEN** 公開入口的頁面殼回應不帶 `Content-Security-Policy`，執行這條旅程
- **THEN** 旅程失敗，失敗訊息指出頁面殼缺少 `Content-Security-Policy`

#### Scenario: 載入時有 CSP 違規則旅程失敗

- **WHEN** 公開入口提供的頁面殼含一段內嵌 `<script>`，執行這條旅程
- **THEN** 旅程失敗，失敗訊息列出被擋的指令（`script-src` 或 `script-src-elem`）
