# Spec Delta

## Purpose

定義前端原始碼的分層與 import 邊界、型別嚴格度、套件位置與檢查指令：靜態檢查在違規時失敗，讓後續的業務功能不需要人工審查就能守住分層、單一 HTTP 邊界、測試替身不進產品碼與不使用 any 的規則。

## ADDED Requirements

### Requirement: 前端是根目錄工作區的一個套件

前端 SHALL 是根目錄 pnpm 工作區的一個套件（`frontend`），與根目錄共用一份 lockfile 與同一個 Prettier；在根目錄執行一次安裝即裝好前端依賴。前端的版本號 SHALL 為 `0.0.0`。前端 SHALL 提供 lint、型別檢查、測試、含覆蓋率的測試、正式建置與重產呼叫層的指令，皆可由根目錄以「`pnpm --filter frontend <指令>`」執行。

來源：ADR-002 D6；ADR-005 D1；`AGENTS.md` Hard Rule 3、4；clarification Q7。

#### Scenario: 根目錄一次安裝即可執行前端檢查

- **WHEN** 在乾淨的 clone 於根目錄執行 `pnpm install --frozen-lockfile`，接著執行 `pnpm --filter frontend lint`、`pnpm --filter frontend typecheck`、`pnpm --filter frontend test`、`pnpm --filter frontend build`
- **THEN** 五條指令都以結束碼 0 結束
- **AND** 專案中只有根目錄一份 lockfile

#### Scenario: 手寫的 TypeScript 在提交時格式化

- **WHEN** 開發者暫存一個格式不符 Prettier 的 `.tsx` 檔案並提交
- **THEN** pre-commit 以 Prettier 改寫該檔，提交的內容符合 Prettier 格式

### Requirement: 依分層限制 import 方向

前端原始碼 SHALL 依 `app`、`pages`、`features`、`components`、`api`、`lib`、`styles` 分層，只允許 frontend-agent-rules F1 列出的 import 方向；違反時 lint MUST 失敗並指出違規的檔案與層別。`pages` 只能經功能的對外入口使用功能；功能之間 MUST NOT 互相 import。唯一的具名例外是元件展示頁以原文讀取對照層樣式檔。

來源：ADR-005 D2；frontend-agent-rules F1；clarification Q16。

#### Scenario: 元件匯入頁面時 lint 失敗

- **WHEN** `components/` 下的一個檔案 import `pages/` 下的模組，執行 lint
- **THEN** lint 以非 0 結束碼失敗，訊息指出該檔案違反分層邊界

#### Scenario: 功能之間互相匯入時 lint 失敗

- **WHEN** 一個功能的檔案 import 另一個功能目錄下的模組，執行 lint
- **THEN** lint 以非 0 結束碼失敗

#### Scenario: 頁面繞過功能入口匯入時 lint 失敗

- **WHEN** `pages/` 下的檔案直接 import 功能目錄內非對外入口的檔案，執行 lint
- **THEN** lint 以非 0 結束碼失敗

#### Scenario: 只有元件展示頁可以讀對照層原文

- **WHEN** 元件展示頁以原文方式讀取對照層樣式檔，另一個頁面以相同方式讀取同一檔案，執行 lint
- **THEN** 元件展示頁不報錯，另一個頁面的檔案被 lint 指為違規

### Requirement: HTTP 只經唯一出口

`pages`、`features`、`components` 中的程式碼 SHALL 只透過產生的呼叫層取得伺服器資料；直接使用全域 `fetch` 或 `axios` 時 lint MUST 失敗。

來源：api-agent-rules A6；frontend-agent-rules F1；`system-design.md` §額外的 ESLint 規則。

#### Scenario: 功能直接呼叫 fetch 時 lint 失敗

- **WHEN** 功能目錄下的檔案直接呼叫全域 `fetch`，執行 lint
- **THEN** lint 以非 0 結束碼失敗，訊息指出應改用產生的呼叫層

### Requirement: 測試替身不進產品碼

模擬伺服器、假資料產生器、呼叫層產生器附帶的模擬回應檔與假資料檔、測試支援目錄 SHALL 只能被測試檔 import；產品碼 import 它們時 lint MUST 失敗。

來源：ADR-007 D1；testing-agent-rules T6；clarification Q6。

#### Scenario: 產品碼匯入模擬伺服器時 lint 失敗

- **WHEN** 功能目錄下的非測試檔 import 模擬伺服器套件，執行 lint
- **THEN** lint 以非 0 結束碼失敗

#### Scenario: 產品碼匯入產生的假資料檔時 lint 失敗

- **WHEN** 功能目錄下的非測試檔 import 呼叫層產生器附帶的假資料檔（健康檢查回應的假資料函式所在的檔案），執行 lint
- **THEN** lint 以非 0 結束碼失敗，訊息指出測試替身只准測試檔使用

#### Scenario: 測試檔可以匯入模擬伺服器

- **WHEN** 功能目錄下的測試檔 import 模擬伺服器套件、測試支援目錄與產生的假資料檔，執行 lint
- **THEN** lint 不因此報錯

### Requirement: 型別嚴格且不使用 any

前端 SHALL 以 TypeScript 嚴格模式檢查，另開 `noUncheckedIndexedAccess`、`noImplicitOverride`、`noFallthroughCasesInSwitch`、`noUnusedLocals`、`noUnusedParameters`、`verbatimModuleSyntax`，不開 `exactOptionalPropertyTypes`；原始碼 MUST NOT 使用 `any`，出現時 lint 失敗。產生的呼叫層目錄不在 lint 範圍內，但仍受型別檢查。

來源：`AGENTS.md` Hard Rule 7；frontend-agent-rules F2；clarification Q19（N4）。

#### Scenario: 原始碼出現 any 時 lint 失敗

- **WHEN** 功能目錄下的檔案宣告型別為 `any` 的參數，執行 lint
- **THEN** lint 以非 0 結束碼失敗

#### Scenario: 陣列索引未檢查時型別檢查失敗

- **WHEN** 程式碼把陣列索引取得的值直接當成非 undefined 使用，執行型別檢查
- **THEN** 型別檢查以非 0 結束碼失敗

### Requirement: Hooks 規則由 lint 檢查

前端 SHALL 以 lint 檢查 React Hooks 的呼叫順序與依賴陣列；條件式呼叫 hook 時 lint MUST 失敗。

來源：frontend-agent-rules F3。

#### Scenario: 條件式呼叫 hook 時 lint 失敗

- **WHEN** 元件在 `if` 區塊內呼叫 hook，執行 lint
- **THEN** lint 以非 0 結束碼失敗

### Requirement: 圖示只用 Lucide

前端的圖示 SHALL 只取自 Lucide 圖示庫，不手寫 SVG 圖示。

來源：ADR-005 D5；frontend-agent-rules F7；clarification Q19（UI-5）。

#### Scenario: 空狀態使用 Lucide 的 Inbox 圖示

- **WHEN** 渲染元件展示頁的空狀態範例
- **THEN** 範例中的圖示是 Lucide 的 `Inbox` 圖示，且帶 `aria-hidden="true"`
