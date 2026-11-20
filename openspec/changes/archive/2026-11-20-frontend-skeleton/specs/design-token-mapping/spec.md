# Spec Delta

## Purpose

定義前端的色彩、字型、圓角與陰影如何只來自 prototype 的 design token：建置時只取 token 自訂屬性、不帶進外部字型與元素樣式，元件只用一層語意變數，語意變數對照到 token 名稱且同時涵蓋淺色與深色，讓前端畫面與 prototype 共用唯一的視覺基準。

## ADDED Requirements

### Requirement: 建置只取 token 檔的自訂屬性

前端在開發與建置時 SHALL 從 `design/prototype/assets/tokens.css` 只取出 `:root` 與 `html[data-theme="dark"]` 兩個區塊中的自訂屬性（`--` 開頭的宣告）；元素規則（例如 `body`、`h1`）與外部字型的 `@import` MUST NOT 進入前端的樣式。token 檔不存在時建置 MUST 失敗並指出缺少的檔案路徑。取出的結果不提交進版控。

來源：ADR-005 D4；frontend-agent-rules F6；clarification Q15。

#### Scenario: 取出的樣式只有自訂屬性

- **WHEN** token 檔含 `:root { --color-primary: #4F46E5; }`、`html[data-theme="dark"] { --color-primary: #818CF8; }`、`body { color: red; }` 與一行外部字型 `@import url(...)`，執行取出
- **THEN** 結果含 `:root` 的 `--color-primary: #4F46E5` 與深色區塊的 `--color-primary: #818CF8`
- **AND** 結果不含 `body` 規則，也不含 `@import`

#### Scenario: 頁面不載入外部字型

- **WHEN** 在開發模式開啟健康檢查頁
- **THEN** 瀏覽器沒有對 `fonts.googleapis.com` 發出請求

#### Scenario: token 檔不存在時建置失敗

- **WHEN** token 檔路徑不存在，執行正式建置
- **THEN** 建置以非 0 結束碼失敗，錯誤訊息含 `design/prototype/assets/tokens.css`

### Requirement: 元件只用語意變數且對照層不寫色值

`components/ui/` 的元件 SHALL 只引用對照層的語意變數（shadcn 的語意變數加上 `--cta`、`--success`、`--warning`、`--info` 等擴充語意），MUST NOT 直接引用 token 檔的變數名或寫死色值。對照層 SHALL 只把語意變數指向 token 檔的變數名，MUST NOT 含任何色值，也 MUST NOT 改變 token 檔任何變數的值。已核可的對照為 `--primary` ← `--color-primary-strong`、`--destructive` ← `--color-error`、`--background` ← `--color-surface`、`--input` ← `--color-border-control`。

來源：ADR-005 D3、D4；frontend-agent-rules F6；clarification Q9、Q17；畫面 artifact 第 4 版 Gallery.dc.html §Token 對照。

#### Scenario: 對照層的已核可對照

- **WHEN** 讀取對照層樣式檔的淺色區塊
- **THEN** `--primary` 的值為 `var(--color-primary-strong)`、`--destructive` 為 `var(--color-error)`、`--background` 為 `var(--color-surface)`、`--input` 為 `var(--color-border-control)`

#### Scenario: 對照層不含色值

- **WHEN** 搜尋對照層樣式檔中所有宣告的值
- **THEN** 沒有十六進位色碼、`rgb(`、`rgba(`、`hsl(`、`oklch(` 等色值寫法

#### Scenario: token 檔的變數值不被對照層覆寫

- **WHEN** 在瀏覽器開啟元件展示頁，讀取 `<html>` 上 `--color-primary`、`--color-border`、`--color-success` 的計算值
- **THEN** 三者分別等於 token 檔 `:root` 區塊同名變數的色值，沒有變成空值或其他變數的值

#### Scenario: 元件不直接引用 token 檔變數

- **WHEN** 搜尋 `components/ui/` 下的所有原始碼
- **THEN** 找不到 `--color-` 開頭的變數名，也找不到十六進位色碼

### Requirement: 深色主題由 html 屬性切換

對照層 SHALL 同時對應淺色與深色：`<html>` 的 `data-theme` 為 `dark` 時，語意變數取得 token 檔深色區塊的值；沒有 `data-theme` 或為 `light` 時取得 `:root` 區塊的值。深色要指向另一個 token 名稱的語意變數才另列在以 `html[data-theme="dark"]` 為條件的區塊，該區塊同樣 MUST NOT 含色值。

來源：ADR-005 D4；frontend-agent-rules F6；clarification Q13。

#### Scenario: 取出的 token 同時保留淺色與深色

- **WHEN** 從實際的 `design/prototype/assets/tokens.css` 取出自訂屬性
- **THEN** 結果同時含 `:root` 區塊與 `html[data-theme="dark"]` 區塊，兩者都定義 `--color-surface`

#### Scenario: 切成深色時頁面底色改用深色 token

- **WHEN** 在瀏覽器開啟元件展示頁，把 `<html>` 的 `data-theme` 設為 `dark`
- **THEN** 頁面底色等於 token 檔深色區塊 `--color-surface` 的色值
- **AND** 移除 `data-theme` 後頁面底色回到 `:root` 區塊 `--color-surface` 的色值

### Requirement: 減少動態偏好時停止旋轉動畫

使用者的系統設定為減少動態（`prefers-reduced-motion: reduce`）時，載入中的旋轉圖示 SHALL 停止轉動，旁邊的狀態文字照常顯示。

來源：frontend-agent-rules F9；`brand.md` 鐵律 11；`ui-design.md` §用途 → token。

#### Scenario: 減少動態時旋轉圖示不轉

- **WHEN** 瀏覽器模擬 `prefers-reduced-motion: reduce`，健康檢查頁處於載入中
- **THEN** 旋轉圖示沒有動畫，「正在檢查後端狀態…」文字可見
