# Spec Delta

## MODIFIED Requirements

### Requirement: 每頁設定瀏覽器標題

每個有畫面的頁面 SHALL 設定瀏覽器標題，格式為「Label Suite — <頁名>」，頁名取自目前介面語言的翻譯，切換語言時跟著換：健康檢查頁、元件展示頁、登入頁（「登入」／`Sign In`）與儀表板（「儀表板」／`Dashboard`）。

來源：frontend-agent-rules F9；規格 01-01 §語言切換 第 1 條；規格 02-01 §這一頁顯示哪一種版面 第 6 條；`ui-design.md` §無障礙；畫面 artifact 第 4 版 Main.dc.html、Gallery.dc.html；dashboard-shell `ui-design.md` §元件樹、§文案。

#### Scenario: 健康檢查頁的瀏覽器標題

- **WHEN** 介面語言為 `zh-TW`，開啟 `/dev/health`
- **THEN** 瀏覽器標題為「Label Suite — 系統健康檢查」

#### Scenario: 元件展示頁的瀏覽器標題

- **WHEN** 介面語言為 `zh-TW`，開啟 `/dev/gallery`
- **THEN** 瀏覽器標題為「Label Suite — 元件展示」

#### Scenario: 登入頁的瀏覽器標題

- **WHEN** 介面語言為 `zh-TW`，未登入的訪客開啟 `/account/login`
- **THEN** 瀏覽器標題為「Label Suite — 登入」；切換為英文後為「Label Suite — Sign In」

#### Scenario: 儀表板的瀏覽器標題

- **WHEN** 介面語言為 `zh-TW`，已登入的使用者到達 `/dashboard/dashboard`
- **THEN** 瀏覽器標題為「Label Suite — 儀表板」；切換為英文後為「Label Suite — Dashboard」
- **AND** 任務角色來源讀取中與讀取失敗時，瀏覽器標題同樣是「Label Suite — 儀表板」

### Requirement: 正式建置含登入相關頁面且不含開發頁與測試替身

正式建置 SHALL 含登入頁、Google 回調、儀表板與依登入狀態導向的根路徑；建置輸出 MUST NOT 含兩個開發頁的程式碼、`/dev/` 路徑字串、模擬伺服器或假資料產生器的程式碼。

來源：ADR-005 D1；testing-agent-rules T6；clarification Q1、Q6、Q14；login-auth-guard PL4；dashboard-shell clarification「交給後續產出」（暫時落點由儀表板取代）。

#### Scenario: 正式建置剪除開發頁

- **WHEN** 執行正式建置後搜尋建置輸出的所有 JavaScript 與 HTML 檔案
- **THEN** 找不到 `/dev/health`、`/dev/gallery` 字串
- **AND** 找不到模擬伺服器套件與假資料產生器套件的程式碼

#### Scenario: 正式建置開啟根路徑依登入狀態導向

- **WHEN** 以正式建置的輸出、沒有登入 cookie，開啟 `/`
- **THEN** 只送出 `GET /api/v1/current-session` 一個查詢登入狀態的請求，網址變為 `/account/login`（這個請求數不含 `frontend-api-client` 在收到 `401 AUTH_REQUIRED` 時送出的那一次延續請求 `POST /api/v1/session-refreshes`）
- **AND** 頁面沒有健康檢查頁或元件展示頁的內容

#### Scenario: 正式建置在開發頁路徑也不顯示開發頁

- **WHEN** 以正式建置的輸出、沒有登入 cookie，開啟 `/dev/health`
- **THEN** 網址變為 `/account/login`，頁面沒有健康檢查頁的內容

#### Scenario: 正式建置含儀表板的文字

- **WHEN** 執行正式建置後搜尋建置輸出的所有 JavaScript 檔案
- **THEN** 找得到「開始你的第一個工作流程」與「平台使用者統計」
- **AND** 找不到「儀表板還在建置中」
