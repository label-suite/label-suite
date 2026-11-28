# Spec Delta

## MODIFIED Requirements

### Requirement: 介面文字只取自語言檔

每個頁面的所有介面文字 SHALL 取自語言檔的翻譯鍵，依模組分為 `common`、`auth`、`appShell`、`dashboard`、`systemHealth`、`devGallery` 六組；`common` 放跨頁共用與共用元件的文字，`auth` 放登入頁與 Google 回調的文字，`appShell` 放登入後外殼的文字，`dashboard` 放儀表板的文字，這四組啟動時載入；`systemHealth`、`devGallery` 只在對應的開發頁載入時才載入，正式建置輸出 MUST NOT 含這兩組的文字；`zh-TW` 與 `en` 兩份語言檔的鍵集 MUST 完全相同，任何一份多出或缺少鍵時測試失敗。元件展示頁上 variant 的值名稱原樣顯示、不翻譯。

來源：architecture.mdx §i18n 兩層；api-agent-rules A8；`brand.md` 鐵律 10；login-auth-guard `ui-design.md` §元件樹；規格 07-01 §語言切換 第 1、4 條；sidebar-nav `ui-design.md` §文案；規格 02-01 §這一頁顯示哪一種版面 第 8 條、§導覽、語言與登出不在這一頁 第 3 條；dashboard-shell `ui-design.md` §文案、§交給 `planner`／`sd` 的明確事項（新增啟動時載入的 `dashboard`，暫時落點的文字隨暫時落點移除）。

#### Scenario: 兩份語言檔的鍵集一致

- **WHEN** 比對 `zh-TW` 與 `en` 六組語言檔的所有鍵
- **THEN** 兩份語言檔的鍵集完全相同

#### Scenario: 語言檔缺鍵時測試失敗

- **WHEN** `en` 的 `auth` 語言檔少了一個 `zh-TW` 有的鍵，執行鍵集一致測試
- **THEN** 測試失敗，訊息列出缺少的鍵名

#### Scenario: 開發頁的語言檔不進正式建置

- **WHEN** 執行正式建置後搜尋建置輸出的所有 JavaScript 與 HTML 檔案
- **THEN** 找不到 `systemHealth`、`devGallery` 兩組語言檔的文字，例如 `DEV ONLY`、「系統健康檢查」、「元件展示」
- **AND** 找得到 `appShell` 的文字，例如「一般使用者」，也找得到 `dashboard` 的文字，例如「掌握任務進度與團隊協作狀態」

#### Scenario: 開發頁載入後才有該頁的文字

- **WHEN** 應用啟動後尚未開啟任何開發頁，查詢 `systemHealth` 的任一個翻譯鍵
- **THEN** 查不到該鍵的翻譯
- **AND** 開啟健康檢查頁後，頁面以 `systemHealth` 的文字顯示，h1 為「系統健康檢查」

#### Scenario: 儀表板的語言檔啟動時就在

- **WHEN** 應用啟動後尚未開啟任何頁面，分別以 `zh-TW` 與 `en` 查詢 `dashboard` 的頁首主標題翻譯鍵
- **THEN** 分別查到「儀表板」與「Dashboard」
- **AND** `auth` 語言檔沒有「你已登入」或「儀表板還在建置中」的文字
