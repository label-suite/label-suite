# frontend-routing Specification

## Purpose

定義前端的路由與建置範圍：健康檢查頁與元件展示頁只在開發模式註冊，開發模式下根路徑與未知路徑導向健康檢查頁，正式建置只有空殼且不含開發頁、測試替身與假資料，讓開發用頁面不會進入使用者可到達的正式 bundle。

## Requirements

### Requirement: 兩頁只在開發模式註冊

前端 SHALL 只在開發模式註冊 `/dev/health`（健康檢查頁）與 `/dev/gallery`（元件展示頁）兩條路由；開發模式下 `/` 與任何未註冊的路徑 SHALL 以取代歷史紀錄的方式導向 `/dev/health`。

來源：ADR-005 D1；clarification Q1、Q14；畫面 artifact 第 4 版 Main.dc.html、Gallery.dc.html。

#### Scenario: 兩頁只在開發模式註冊並導向健康檢查頁

- **WHEN** 在開發模式開啟 `/`
- **THEN** 網址變為 `/dev/health`，畫面顯示健康檢查頁
- **AND** 瀏覽器上一頁不會回到 `/`

#### Scenario: 開發模式下未知路徑導向健康檢查頁

- **WHEN** 在開發模式開啟 `/no-such-page`
- **THEN** 網址變為 `/dev/health`，畫面顯示健康檢查頁

#### Scenario: 開發模式可直接開啟元件展示頁

- **WHEN** 在開發模式開啟 `/dev/gallery`
- **THEN** 畫面顯示元件展示頁，網址維持 `/dev/gallery`

### Requirement: 正式建置不含開發頁與測試替身

正式建置 SHALL 只輸出空殼應用；建置輸出 MUST NOT 含兩個開發頁的程式碼、`/dev/` 路徑字串、模擬伺服器或假資料產生器的程式碼。

來源：ADR-005 D1；testing-agent-rules T6；clarification Q1、Q6、Q14。

#### Scenario: 正式建置剪除開發頁

- **WHEN** 執行正式建置後搜尋建置輸出的所有 JavaScript 與 HTML 檔案
- **THEN** 找不到 `/dev/health`、`/dev/gallery` 字串
- **AND** 找不到模擬伺服器套件與假資料產生器套件的程式碼

#### Scenario: 正式建置開啟根路徑只有空殼

- **WHEN** 以正式建置的輸出開啟 `/`
- **THEN** 頁面沒有健康檢查頁或元件展示頁的內容，也不發出任何後端請求

### Requirement: 每頁設定瀏覽器標題

兩個開發頁 SHALL 各自設定瀏覽器標題，格式為「Label Suite — <頁名>」，頁名取自目前介面語言的翻譯。

來源：frontend-agent-rules F9；`ui-design.md` §頁面標題；畫面 artifact 第 4 版 Main.dc.html、Gallery.dc.html。

#### Scenario: 健康檢查頁的瀏覽器標題

- **WHEN** 介面語言為 `zh-TW`，開啟 `/dev/health`
- **THEN** 瀏覽器標題為「Label Suite — 系統健康檢查」

#### Scenario: 元件展示頁的瀏覽器標題

- **WHEN** 介面語言為 `zh-TW`，開啟 `/dev/gallery`
- **THEN** 瀏覽器標題為「Label Suite — 元件展示」
