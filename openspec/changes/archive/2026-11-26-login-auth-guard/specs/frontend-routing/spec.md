# Spec Delta

## ADDED Requirements

### Requirement: 開發頁只在開發模式註冊且不經過守門

前端 SHALL 只在開發模式註冊 `/dev/health`（健康檢查頁）與 `/dev/gallery`（元件展示頁）兩條路由，兩頁不經過登入守門。`/` 與任何未註冊的路徑在開發模式與正式建置都 SHALL 依登入狀態導向（見 `auth-guard`），不再導向 `/dev/health`。

來源：ADR-005 D1；clarification Q1、Q14；畫面 artifact 第 4 版 Main.dc.html、Gallery.dc.html；login-auth-guard PL4、決定表 U7。

#### Scenario: 開發模式可直接開啟健康檢查頁

- **WHEN** 在開發模式、沒有登入 cookie，開啟 `/dev/health`
- **THEN** 畫面顯示健康檢查頁，網址維持 `/dev/health`，沒有被導向登入頁

#### Scenario: 開發模式下根路徑依登入狀態導向

- **WHEN** 在開發模式、沒有登入 cookie，開啟 `/`
- **THEN** 網址變為 `/account/login`，不是 `/dev/health`

#### Scenario: 開發模式可直接開啟元件展示頁

- **WHEN** 在開發模式開啟 `/dev/gallery`
- **THEN** 畫面顯示元件展示頁，網址維持 `/dev/gallery`

### Requirement: 正式建置含登入相關頁面且不含開發頁與測試替身

正式建置 SHALL 含登入頁、Google 回調、暫時落點與依登入狀態導向的根路徑；建置輸出 MUST NOT 含兩個開發頁的程式碼、`/dev/` 路徑字串、模擬伺服器或假資料產生器的程式碼。

來源：ADR-005 D1；testing-agent-rules T6；clarification Q1、Q6、Q14；login-auth-guard PL4。

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

## MODIFIED Requirements

### Requirement: 每頁設定瀏覽器標題

每個有畫面的頁面 SHALL 設定瀏覽器標題，格式為「Label Suite — <頁名>」，頁名取自目前介面語言的翻譯，切換語言時跟著換：健康檢查頁、元件展示頁、登入頁（「登入」／`Sign In`）與暫時落點（「你已登入」）。

來源：frontend-agent-rules F9；規格 01-01 §語言切換 第 1 條；`ui-design.md` §無障礙；畫面 artifact 第 4 版 Main.dc.html、Gallery.dc.html。

#### Scenario: 健康檢查頁的瀏覽器標題

- **WHEN** 介面語言為 `zh-TW`，開啟 `/dev/health`
- **THEN** 瀏覽器標題為「Label Suite — 系統健康檢查」

#### Scenario: 元件展示頁的瀏覽器標題

- **WHEN** 介面語言為 `zh-TW`，開啟 `/dev/gallery`
- **THEN** 瀏覽器標題為「Label Suite — 元件展示」

#### Scenario: 登入頁的瀏覽器標題

- **WHEN** 介面語言為 `zh-TW`，未登入的訪客開啟 `/account/login`
- **THEN** 瀏覽器標題為「Label Suite — 登入」；切換為英文後為「Label Suite — Sign In」

## REMOVED Requirements

### Requirement: 兩頁只在開發模式註冊

**Reason**：這條要求開發模式下 `/` 與未註冊的路徑導向 `/dev/health`；login-auth-guard 起 `/` 與未註冊的路徑一律依登入狀態導向（規格 01-01 §登入頁 第 9 條、決定表 U7，login-auth-guard PL4）。

**Migration**：開發頁的註冊範圍改寫在「開發頁只在開發模式註冊且不經過守門」；根路徑與未知路徑的導向見主規格 `auth-guard`「根路徑與不存在的路徑依登入狀態導向」。開發者直接開啟 `/dev/health` 或 `/dev/gallery`。

### Requirement: 正式建置不含開發頁與測試替身

**Reason**：這條要求正式建置開啟 `/` 只有空殼、不發任何後端請求；login-auth-guard 起正式建置含登入頁、Google 回調與暫時落點，開啟 `/` 會查詢目前的登入狀態（login-auth-guard PL4）。

**Migration**：剪除開發頁與測試替身的要求原樣移到「正式建置含登入相關頁面且不含開發頁與測試替身」，只把根路徑那一條 Scenario 改成依登入狀態導向。
