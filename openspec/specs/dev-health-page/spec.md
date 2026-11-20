# dev-health-page Specification

## Purpose

定義開發用的健康檢查頁 `/dev/health`：經產生的呼叫層呼叫後端健康檢查，以載入中、正常、資料庫無法連線（含其他後端錯誤）、連不到後端四種狀態呈現結果並可重新檢查，證明前端從呼叫層、唯一出口到畫面的整條路徑打得通。

## Requirements

### Requirement: 健康檢查頁呼叫健康檢查端點

健康檢查頁 SHALL 在開啟時經產生的呼叫層對 `GET /api/v1/health` 完成一次請求（開發模式下 React StrictMode 的雙重掛載會中止第一次請求，被中止的請求不計，見 design.md D6），頁首顯示眉標「DEV ONLY · /dev/health」、標題「系統健康檢查」與說明段落。健康檢查是公開端點，對所有呼叫端回應相同，沒有遮蔽欄位；頁面 MUST NOT 呼叫其他端點。

來源：ADR-003 D6；api-agent-rules A6；clarification Q1；畫面 artifact 第 4 版 Main.dc.html §頁首。

#### Scenario: 開啟頁面只呼叫健康檢查端點

- **WHEN** 開啟健康檢查頁，後端回應正常
- **THEN** 整個過程完成的請求只有 1 個，目標為 `GET /api/v1/health`；開發模式下 StrictMode 雙重掛載而中止的那一次不計
- **AND** 被中止的請求不改變畫面：不出現錯誤版面，畫面依完成的那個請求顯示正常
- **AND** 頁首顯示「DEV ONLY · /dev/health」與 h1「系統健康檢查」

#### Scenario: 未登入時看到與任何呼叫端相同的內容

- **WHEN** 瀏覽器沒有任何登入憑證，開啟健康檢查頁，後端回應正常
- **THEN** 頁面顯示「正常」與完整的描述清單四列，沒有欄位被隱藏或遮蔽，也沒有導向登入頁

### Requirement: 等待回應時顯示載入中

首次載入與按下「重新檢查」後、回應抵達前，健康檢查頁 SHALL 顯示載入中：狀態文字「正在檢查後端狀態…」（`role="status"`）、三條對輔助科技隱藏的骨架、內容區 `aria-busy="true"`，「重新檢查」按鈕為停用外觀並以 `aria-disabled="true"` 表示停用。背景自動更新（例如切回分頁）時 MUST NOT 回到載入中，畫面維持前一個結果直到新結果抵達；但只要有任何對健康檢查的請求進行中（含背景更新），「重新檢查」按鈕 SHALL 以 `aria-disabled="true"` 表示停用，按下 MUST NOT 送出新請求，也 MUST NOT 中斷進行中的請求。

來源：frontend-agent-rules F8、F9；clarification Q19（UI-7）；畫面 artifact 第 4 版 Main.dc.html §1 載入中。

#### Scenario: 健康檢查頁在等待回應時顯示載入中並可重新檢查

- **WHEN** 開啟健康檢查頁，後端尚未回應
- **THEN** 頁面顯示「正在檢查後端狀態…」，其元素的 role 為 `status`
- **AND** 內容區的 `aria-busy` 為 `true`，「重新檢查」按鈕的 `aria-disabled` 為 `true`
- **AND** 回應抵達後 `aria-busy` 移除，頁面顯示結果

#### Scenario: 背景更新不回到載入中

- **WHEN** 頁面已顯示正常結果，查詢在背景重新取得資料且後端尚未回應
- **THEN** 頁面仍顯示先前的正常結果，沒有「正在檢查後端狀態…」

#### Scenario: 背景更新進行中按重新檢查不中斷也不重送

- **WHEN** 頁面已顯示正常結果，查詢在背景重新取得資料且後端尚未回應，使用者按下「重新檢查」
- **THEN** 「重新檢查」按鈕的 `aria-disabled` 為 `true`，這次按下沒有送出新的請求
- **AND** 背景請求沒有被中止，回應抵達後頁面顯示該回應的結果，整個過程沒有「正在檢查後端狀態…」

### Requirement: 後端與資料庫正常時顯示正常

後端回應成功外層時，健康檢查頁 SHALL 顯示 success 徽章「正常」與「後端與資料庫都可以用」，並以描述清單列出：服務（`data.status`）、資料庫（`data.database`）、檢查時間（回應的伺服器時間依裝置時區格式化為 `YYYY-MM-DD HH:mm:ss（UTC±H）`，括號內為實際偏移，見 `date-time-display`）、traceId（回應的追蹤編號）。「重新檢查」為 outline 按鈕。

來源：ADR-003 D5；frontend-agent-rules F8、F10；clarification Q2、Q18（含補充決議）；畫面 artifact 第 4 版 Main.dc.html §2 正常（200）。

#### Scenario: 後端與資料庫正常時健康檢查頁顯示正常

- **WHEN** 介面語言為 `zh-TW`、裝置時區為 `Asia/Taipei`，後端以 `200` 回應 `data` 為 `{"status": "ok", "database": "ok"}`、`timestamp` 為 `2026-11-20T08:15:30.123Z`、`traceId` 為 `3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01` 的成功外層
- **THEN** 頁面顯示徽章「正常」與「後端與資料庫都可以用」
- **AND** 描述清單為：服務 `ok`、資料庫 `ok`、檢查時間 `2026-11-20 16:15:30（UTC+8）`、traceId `3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01`
- **AND** 「重新檢查」按鈕為 outline 樣式且可按

### Requirement: 後端回報錯誤時顯示錯誤版面

後端回應任一錯誤外層時，健康檢查頁 SHALL 顯示 error 提示（`role="alert"`）：錯誤碼為 `DATABASE_UNAVAILABLE` 時標題為「資料庫無法連線」，其他錯誤碼標題為「後端回報錯誤」；提示內文為後端回的 `message`，原樣顯示；描述清單列出錯誤碼與 traceId。「重新檢查」為主色實心按鈕。錯誤碼與 traceId 只在開發頁顯示，是 07-01「不出現系統內部資料」的例外。

來源：api-agent-rules A7；frontend-agent-rules F8；clarification Q3、Q11；畫面 artifact 第 4 版 Main.dc.html §3 資料庫無法連線（503）。

#### Scenario: 資料庫無法連線時健康檢查頁顯示資料庫無法連線

- **WHEN** 後端以 `503` 回應 `code` 為 `DATABASE_UNAVAILABLE`、`message` 為「資料庫暫時無法連線，請稍後再試」、`traceId` 為 `9c1d7e2a-4b3f-4a8e-8d6c-0f5e2a1b3c47` 的錯誤外層
- **THEN** 頁面顯示 role 為 `alert` 的提示，標題為「資料庫無法連線」，內文為「資料庫暫時無法連線，請稍後再試」
- **AND** 描述清單為：錯誤碼 `DATABASE_UNAVAILABLE`、traceId `9c1d7e2a-4b3f-4a8e-8d6c-0f5e2a1b3c47`
- **AND** 「重新檢查」按鈕為主色實心樣式

#### Scenario: 後端回報其他錯誤時健康檢查頁顯示通用的後端錯誤

- **WHEN** 後端以 `500` 回應 `code` 為 `INTERNAL_ERROR`、`message` 為「系統發生錯誤，請稍後再試」的錯誤外層
- **THEN** 頁面顯示標題「後端回報錯誤」，內文為「系統發生錯誤，請稍後再試」，描述清單的錯誤碼為 `INTERNAL_ERROR`

#### Scenario: 找不到端點時走通用的後端錯誤

- **WHEN** 後端以 `404` 回應 `code` 為 `NOT_FOUND` 的錯誤外層
- **THEN** 頁面顯示標題「後端回報錯誤」，描述清單的錯誤碼為 `NOT_FOUND`

### Requirement: 沒有收到有效回應時顯示連不到後端

連線失敗、請求逾時或回應不是統一外層時，健康檢查頁 SHALL 顯示 warning 提示（`role="alert"`）：標題「連不到後端」，內文「沒有收到任何回應。請確認後端已啟動，且 `VITE_API_BASE_URL` 指向它。」；描述清單列出錯誤類型（逾時為 `timeout`，連線失敗與回應不是統一外層為 `network`，原樣顯示）與 traceId「無（請求沒有送達）」。「重新檢查」為主色實心按鈕。

來源：api-agent-rules A7；frontend-agent-rules F8；clarification Q3、Q4、Q11；畫面 artifact 第 4 版 Main.dc.html §4 連不到後端。

#### Scenario: 連不到後端時健康檢查頁顯示連不到後端

- **WHEN** 健康檢查請求因連線被拒而失敗
- **THEN** 頁面顯示 role 為 `alert` 的提示，標題為「連不到後端」
- **AND** 描述清單為：錯誤類型 `network`、traceId「無（請求沒有送達）」

#### Scenario: 逾時時錯誤類型顯示 timeout

- **WHEN** 後端超過 15 秒沒有回應
- **THEN** 頁面顯示標題「連不到後端」，描述清單的錯誤類型為 `timeout`

#### Scenario: 回應不是統一外層時顯示連不到後端

- **WHEN** 健康檢查請求收到 `502`、body 為 HTML 的回應
- **THEN** 頁面顯示標題「連不到後端」，描述清單的錯誤類型為 `network`

### Requirement: 重新檢查重新取得結果且焦點留在按鈕

按下「重新檢查」時，健康檢查頁 SHALL 回到載入中並對同一端點重新請求一次，焦點留在按鈕上；請求進行中再按或按 Enter／Space MUST NOT 送出額外請求。回應抵達後顯示新結果。

來源：frontend-agent-rules F9；clarification Q4、Q19（UI-7）；畫面 artifact 第 4 版 Main.dc.html §重新檢查。

#### Scenario: 錯誤後重新檢查顯示新結果

- **WHEN** 頁面顯示「資料庫無法連線」，後端改為回應成功外層後使用者按下「重新檢查」
- **THEN** 頁面先顯示「正在檢查後端狀態…」，接著顯示「正常」
- **AND** 按鈕在整個過程中保有焦點

#### Scenario: 請求進行中重複按下不送出額外請求

- **WHEN** 使用者按下「重新檢查」後、回應抵達前，再以滑鼠點擊一次並按一次 Enter
- **THEN** 這次重新檢查只送出 1 個請求

### Requirement: 健康檢查頁以英文介面顯示

介面語言為 `en` 時，健康檢查頁的所有介面文字 SHALL 取自英文語言檔；後端回的 `message`、錯誤碼、traceId 與錯誤類型原樣顯示。

來源：architecture.mdx §i18n 兩層；api-agent-rules A8；clarification Q5。

#### Scenario: 英文介面下的資料庫無法連線

- **WHEN** 介面語言為 `en`，後端以 `503` 回應 `message` 為 `The database is temporarily unavailable. Please try again later.` 的 `DATABASE_UNAVAILABLE` 錯誤外層
- **THEN** 頁面上不出現「資料庫無法連線」等中文介面文字
- **AND** 提示內文為 `The database is temporarily unavailable. Please try again later.`，錯誤碼為 `DATABASE_UNAVAILABLE`
