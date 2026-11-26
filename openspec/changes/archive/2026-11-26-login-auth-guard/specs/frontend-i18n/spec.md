# Spec Delta

## ADDED Requirements

### Requirement: 介面語言預設繁體中文並記住使用者的選擇

前端 SHALL 在啟動時讀取瀏覽器記住的語言選擇：值為 `zh-TW` 或 `en` 時用它，沒有值、讀不到或是其他值時一律為 `zh-TW`，不看瀏覽器回報的語言。使用者在登入頁或暫時落點的頁首切換語言後，介面語言即時改變並記住，之後開啟任何頁面都沿用。開發頁 MUST NOT 提供語言切換控制項。

來源：規格 01-01 §語言切換 第 1–3 條、§資料欄位「語言」、§邊界情況、§已確認決議 Q5；architecture.mdx §i18n 兩層；api-agent-rules A8；login-auth-guard U4；Scenario「第一次來的人看到繁體中文」「記住的語言值無效時用繁體中文」。

#### Scenario: 第一次來的人看到繁體中文

- **WHEN** 瀏覽器語言為 `en-US`、沒有記住過語言，開啟登入頁
- **THEN** 介面語言為 `zh-TW`，登入卡的副標為「登入你的帳號」
- **AND** 登入頁設定請求的 `Accept-Language` 為 `zh-TW`

#### Scenario: 記住的語言值無效時用繁體中文

- **WHEN** 瀏覽器記住的語言值分別為 `ja`、空字串、`EN-us`，開啟登入頁
- **THEN** 三次的介面語言都是 `zh-TW`，畫面沒有出現錯誤

#### Scenario: 切換後的語言跨頁沿用

- **WHEN** 使用者在登入頁切換為英文後登入，到達 `/dashboard/dashboard`
- **THEN** 落點以英文顯示，請求的 `Accept-Language` 為 `en`

#### Scenario: 重新開啟後沿用記住的語言

- **WHEN** 使用者在登入頁切換為英文後重新整理頁面
- **THEN** 登入頁仍以英文顯示，語言切換鈕顯示 `EN`

#### Scenario: 開發頁沒有語言切換控制項但沿用記住的語言

- **WHEN** 瀏覽器記住的語言為 `en`，開啟健康檢查頁與元件展示頁
- **THEN** 兩頁都以英文介面顯示，都沒有可切換介面語言的控制項

## MODIFIED Requirements

### Requirement: 介面文字只取自語言檔

每個頁面的所有介面文字 SHALL 取自語言檔的翻譯鍵，依模組分為 `common`、`auth`、`systemHealth`、`devGallery` 四組；`common` 只放跨頁共用的文字，啟動時載入；`auth` 放登入頁、Google 回調與暫時落點的文字；`systemHealth`、`devGallery` 只在對應的開發頁載入時才載入，正式建置輸出 MUST NOT 含這兩組的文字；`zh-TW` 與 `en` 兩份語言檔的鍵集 MUST 完全相同，任何一份多出或缺少鍵時測試失敗。元件展示頁上元件 variant 的值名稱（例如 `cta`、`lg`）是程式識別值，原樣顯示、不翻譯。

來源：architecture.mdx §i18n 兩層；api-agent-rules A8；`brand.md` 鐵律 10；clarification Q5；login-auth-guard `ui-design.md` §元件樹。

#### Scenario: 兩份語言檔的鍵集一致

- **WHEN** 比對 `zh-TW` 與 `en` 四組語言檔的所有鍵
- **THEN** 兩份語言檔的鍵集完全相同

#### Scenario: 語言檔缺鍵時測試失敗

- **WHEN** `en` 的 `auth` 語言檔少了一個 `zh-TW` 有的鍵，執行鍵集一致測試
- **THEN** 測試失敗，訊息列出缺少的鍵名

#### Scenario: 開發頁的語言檔不進正式建置

- **WHEN** 執行正式建置後搜尋建置輸出的所有 JavaScript 與 HTML 檔案
- **THEN** 找不到 `systemHealth`、`devGallery` 兩組語言檔的文字，例如 `DEV ONLY`、「系統健康檢查」、「元件展示」

#### Scenario: 開發頁載入後才有該頁的文字

- **WHEN** 應用啟動後尚未開啟任何開發頁，查詢 `systemHealth` 的任一個翻譯鍵
- **THEN** 查不到該鍵的翻譯
- **AND** 開啟健康檢查頁後，頁面以 `systemHealth` 的文字顯示，h1 為「系統健康檢查」

## REMOVED Requirements

### Requirement: 介面語言依瀏覽器語言決定

**Reason**：規格 01-01 §語言切換 與 §資料欄位「語言」規定第一次來的訪客預設看到繁體中文、登入頁可以切換、選擇記住後跨頁沿用；依需求依據順序以規格為準（login-auth-guard U4）。

**Migration**：改由新增的「介面語言預設繁體中文並記住使用者的選擇」決定介面語言；不再讀瀏覽器回報的語言。e2e 的瀏覽器 context 仍固定 `zh-TW`（主規格 `e2e-testing`「介面語言固定為 zh-TW」），沒有記住過語言時介面語言同樣是 `zh-TW`，旅程不受影響。
