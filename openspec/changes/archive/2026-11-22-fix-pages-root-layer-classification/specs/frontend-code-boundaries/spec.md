## MODIFIED Requirements

### Requirement: 依分層限制 import 方向

前端原始碼 SHALL 依 `app`、`pages`、`features`、`components`、`api`、`lib`、`styles` 分層，只允許 frontend-agent-rules F1 列出的 import 方向；違反時 lint MUST 失敗並指出違規的檔案與層別。`pages` 只能經功能的對外入口使用功能；功能之間 MUST NOT 互相 import。唯一的具名例外是元件展示頁以原文讀取對照層樣式檔。**分不出層的檔案 MUST NOT 因此跳過上述檢查**：lint MUST 失敗並指出該檔。

來源：ADR-005 D2；frontend-agent-rules F1；clarification Q16；分不出層那一句來自 [#528](https://github.com/label-suite/label-suite/issues/528)。

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

#### Scenario: 分不出層的檔案 lint 失敗

- **WHEN** 一個檔案直接放在 `pages/` 根層（不在任何頁面資料夾裡），執行 lint
- **THEN** lint 失敗並指出該檔，而不是因為分不出層就跳過分層檢查
