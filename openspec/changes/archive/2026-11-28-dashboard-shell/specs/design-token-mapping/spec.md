# Spec Delta

## MODIFIED Requirements

### Requirement: 建置只取 token 檔的自訂屬性

前端在開發與建置時 SHALL 從 `design/prototype/assets/tokens.css` 與資料色檔 `design/prototype/assets/data-palette.css` 只取出 `:root` 與 `html[data-theme="dark"]` 兩個區塊中的自訂屬性（`--` 開頭的宣告），`tokens.css` 的宣告排在資料色之前；元素規則（例如 `body`、`h1`）與外部字型的 `@import` MUST NOT 進入前端的樣式。任一個檔案不存在時建置 MUST 失敗並指出缺少的檔案路徑。取出的結果不提交進版控。

來源：ADR-005 D4（dashboard-shell 修訂：資料色另來自 `data-palette.css`）；frontend-agent-rules F6；clarification Q15；dashboard-shell clarification Q8 與其補充決議；`design/prototype/assets/data-palette.css` 檔頭（載入順序在 `tokens.css` 之後）；規格 02-01 §還沒有任務角色的人看到什麼 第 2 條（三張卡的角色色以 prototype 為準）。

#### Scenario: 取出的樣式只有自訂屬性

- **WHEN** token 檔含 `:root { --color-primary: #4F46E5; }`、`html[data-theme="dark"] { --color-primary: #818CF8; }`、`body { color: red; }` 與一行外部字型 `@import url(...)`，執行取出
- **THEN** 結果含 `:root` 的 `--color-primary: #4F46E5` 與深色區塊的 `--color-primary: #818CF8`
- **AND** 結果不含 `body` 規則，也不含 `@import`

#### Scenario: 資料色的淺深兩組都被取出且排在 token 之後

- **WHEN** 從實際的 `tokens.css` 與 `data-palette.css` 取出自訂屬性
- **THEN** 結果的 `:root` 區塊與 `html[data-theme="dark"]` 區塊都定義 `--data-role-emerald-bg`、`--data-role-violet-bg`、`--data-role-indigo-bg`
- **AND** 結果中第一個 `--data-` 宣告出現在最後一個來自 `tokens.css` 的宣告之後

#### Scenario: 頁面不載入外部字型

- **WHEN** 在開發模式開啟健康檢查頁
- **THEN** 瀏覽器沒有對 `fonts.googleapis.com` 發出請求

#### Scenario: token 檔不存在時建置失敗

- **WHEN** token 檔路徑不存在，執行正式建置
- **THEN** 建置以非 0 結束碼失敗，錯誤訊息含 `design/prototype/assets/tokens.css`

#### Scenario: 資料色檔不存在時建置失敗

- **WHEN** 資料色檔路徑不存在，執行正式建置
- **THEN** 建置以非 0 結束碼失敗，錯誤訊息含 `design/prototype/assets/data-palette.css`

## ADDED Requirements

### Requirement: 資料色不進對照層也不給原語用

資料色（`--data-` 開頭的變數）SHALL 只由需要它的功能元件直接引用，淺色與深色都取資料色檔對應區塊的值。對照層 MUST NOT 宣告或引用任何 `--data-` 變數，`components/ui/` 的元件也 MUST NOT 引用；shadcn 的語意變數仍只指向 `tokens.css`。

來源：ADR-005 D4（dashboard-shell 修訂）；frontend-agent-rules F6；dashboard-shell clarification Q8 補充決議；`design/prototype/assets/data-palette.css` 檔頭（資料色不帶語意）。

#### Scenario: 對照層與原語都不引用資料色

- **WHEN** 搜尋對照層樣式檔與 `components/ui/` 下的所有原始碼
- **THEN** 都找不到 `--data-` 開頭的變數名

#### Scenario: 角色色隨主題取淺深兩組

- **WHEN** 在瀏覽器開啟 `/dashboard/dashboard`（平台成員、沒有任務角色），讀取卡 B 角色圓形圖示的計算後背景色，接著把 `<html>` 的 `data-theme` 設為 `dark` 再讀一次
- **THEN** 第一次等於資料色檔 `:root` 區塊 `--data-role-violet-bg` 的色值，第二次等於深色區塊 `--data-role-violet-bg` 的色值

#### Scenario: 引用 token 的資料色解得出值

- **WHEN** 在淺色主題讀取 `<html>` 上 `--data-role-emerald-fg` 的計算值
- **THEN** 它等於 `tokens.css` `:root` 區塊 `--color-cta-hover` 的色值，不是空值
