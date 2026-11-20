# Spec Delta

## Purpose

定義前端的介面語言：依瀏覽器語言在繁體中文（zh-TW）與英文（en）之間決定一次、所有介面文字取自兩份鍵集一致的語言檔、後端訊息原樣顯示不翻譯，且送給後端的語言偏好與介面語言一致，讓後續業務頁沿用同一套語系層。

## ADDED Requirements

### Requirement: 介面語言依瀏覽器語言決定

前端 SHALL 在啟動時依瀏覽器回報的語言決定介面語言：語言代碼以 `zh` 開頭（不分大小寫）時為 `zh-TW`，其餘情況（含空值或沒有值）為 `en`。畫面 MUST NOT 提供語言切換控制項；執行期間介面語言不變。

來源：architecture.mdx §i18n 兩層；api-agent-rules A8；clarification Q5。

#### Scenario: 介面語言依瀏覽器語言決定且請求語言一致

- **WHEN** 瀏覽器語言為 `zh-TW`，開啟健康檢查頁
- **THEN** 頁面標題 h1 為「系統健康檢查」
- **AND** 健康檢查請求的 `Accept-Language` 為 `zh-TW`

#### Scenario: 各種瀏覽器語言對應的介面語言

- **WHEN** 瀏覽器語言分別為 `zh-TW`、`zh-CN`、`zh`、`ZH-hk`、`en-US`、`ja`、空字串、沒有值
- **THEN** 介面語言依序為 `zh-TW`、`zh-TW`、`zh-TW`、`zh-TW`、`en`、`en`、`en`、`en`

#### Scenario: 英文瀏覽器顯示英文介面並送出英文偏好

- **WHEN** 瀏覽器語言為 `en-US`，開啟健康檢查頁
- **THEN** 頁面標題 h1 為英文語言檔對應的文字，不是「系統健康檢查」
- **AND** 健康檢查請求的 `Accept-Language` 為 `en`

#### Scenario: 畫面沒有語言切換控制項

- **WHEN** 開啟健康檢查頁與元件展示頁
- **THEN** 兩頁都沒有可切換介面語言的控制項

### Requirement: 介面文字只取自語言檔

兩個開發頁的所有介面文字 SHALL 取自語言檔的翻譯鍵，依模組分為 `common`、`systemHealth`、`devGallery` 三組；`zh-TW` 與 `en` 兩份語言檔的鍵集 MUST 完全相同，任何一份多出或缺少鍵時測試失敗。元件展示頁上元件 variant 的值名稱（例如 `cta`、`lg`）是程式識別值，原樣顯示、不翻譯。

來源：architecture.mdx §i18n 兩層；api-agent-rules A8；`brand.md` 鐵律 10；clarification Q5。

#### Scenario: 兩份語言檔的鍵集一致

- **WHEN** 比對 `zh-TW` 與 `en` 三組語言檔的所有鍵
- **THEN** 兩份語言檔的鍵集完全相同

#### Scenario: 語言檔缺鍵時測試失敗

- **WHEN** `en` 的 `systemHealth` 語言檔少了一個 `zh-TW` 有的鍵，執行鍵集一致測試
- **THEN** 測試失敗，訊息列出缺少的鍵名

### Requirement: 後端回的訊息原樣顯示

後端錯誤外層的 `message` SHALL 原樣顯示，不經前端翻譯；它的語言由送出的語言偏好決定。

來源：architecture.mdx §i18n 兩層；api-agent-rules A8；`ui-design.md` §資料來源。

#### Scenario: 英文介面顯示後端回的英文訊息

- **WHEN** 介面語言為 `en`，後端以 `503` 回應 `message` 為 `The database is temporarily unavailable. Please try again later.` 的錯誤外層
- **THEN** 健康檢查頁顯示的後端說明正好是 `The database is temporarily unavailable. Please try again later.`
