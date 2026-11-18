取代整張表單的結果面板：動作完成後表單已經沒有意義，就用一個成功或失敗的面板接手，並給下一步連結。

## 何時使用

- 送出後表單不再需要：重設密碼信已寄出、連結失效。
- 分工：
  - 表單還在、要就地修正 → Alert Banner。
  - 浮在畫面上的短訊息 → Toast。
  - 表單被結果整個取代 → State Panel。

## 結構與使用方提供的內容

- 容器：`.state-panel` 加 `.state-panel--success` 或 `.state-panel--error`；error 版加 `role="alert"`。
- `.state-panel-icon`：40px 圓形圖示，內放 `assets/icons/` 的 check 或 alert-circle 內嵌 SVG。
- `.state-panel-title`：一句結果（「請到信箱收信」）。
- `.state-panel-desc`：補充說明與下一步。
- `.state-panel-action`：可省略的連結，例如「回到登入」「重新申請連結」。

## 變體

- `--success`：完成。
- `--error`：失敗、連結失效。
- 帳號頁目前用的是 `.success-panel` 與 `.token-error-panel`，不是這個元件（G-03）；新頁面用 State Panel。

## 狀態

- 靜態元件，出現後不再變化。
- 動作連結目前沒有自己的 focus 樣式（G-05），依賴瀏覽器預設外框。
- 面板內有四個寫死的值（G-02）；暗色主題下 success 標題與底色的對比偏低，是這些寫死值造成的。

## 該做／不該做

- 該做：標題講結果，說明講下一步；有下一步時一定給 action 連結。
- 該做：失敗面板給一條能重來的路（重新申請、回上一頁）。
- 不該做：面板跟原本的表單同時出現。
- 不該做：用它顯示「儲存成功」這種不必離開表單的訊息；那是 Toast。
- 不該做：新頁面再做一套 `.success-panel` 樣式。
