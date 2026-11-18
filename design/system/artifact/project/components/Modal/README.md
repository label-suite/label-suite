蓋在頁面上的對話框：`.modal-overlay` 遮罩加上置中的 `.modal`，內含標題、說明與靠右的 `.modal-actions`；只用切換 `.show` 開關，焦點由共用的焦點模組管理。

## 何時使用

- 需要使用者先處理才能繼續的事：破壞性確認（刪除、封存）、離開前確認、邀請成員之類的小表單、資料預覽。
- 純提示或操作結果用 Toast；能在原地編輯的內容不要搬進 modal。
- 破壞性確認的按鈕組合是 `.btn-secondary` 取消＋ `.btn-danger` 確認（G-01：實心紅底為正典），見 [Button](../Button/README.md)。

## 結構與使用方提供的內容

- `.modal-overlay`：`position: fixed; inset: 0`、半透明黑遮罩、`backdrop-filter: blur(4px)`、`--z-modal`。
- `.modal`：寬 `min(520px, 100%)`、`--radius-xl`、`--shadow-xl`。
- `.modal-header`（選用）：標題與 `.modal-close`（32×32）分置兩端。
- 標題：`.modal-title`（襯線 `--font-serif-display`）或直接寫 `<h2>`（零特異性樣式，**拿不到襯線**，兩者外觀不同）。
- 說明：`.modal-desc` 或直接寫 `<p>`。
- `.modal-footer`／`.modal-actions`：靠右、可換行的按鈕列。
- 使用方提供：`role="dialog"`、`aria-modal="true"`、以 `aria-labelledby` 指向標題（G-23：CSS 與焦點模組都不會自動加，原型沒有保證）。
- 預覽以預覽本地的覆寫把遮罩改為 `position: relative`，讓它留在卡片裡。

## 變體

只有一種版式。頁面專屬的尺寸（例如 `.modal-xl`）、預覽區、表單內容留在各頁。

## 狀態

| 狀態 | 表現 |
| :--- | :--- |
| 關閉（預設） | `.modal-overlay` 為 `display: none` |
| 開啟 | 加上 `.show` → `display: flex`，對話框置中 |
| hover | 只有 `.modal-close` 有（換淺底） |
| focus | 沒有專屬樣式（G-05），但焦點行為完整（見下） |
| 停用／載入中／錯誤／空 | 由內容自理 |

焦點行為由共用的焦點模組提供，頁面在自己的開關函式裡呼叫它：開啟時聚焦第一個可聚焦元素、Tab／Shift+Tab 困在對話框內、Esc 呼叫 `onClose`、關閉時把焦點還給觸發鈕。模組**不自己切換顯示**，開關仍是頁面的事。

## 該做／不該做

- **該做**：每個 modal 都接上焦點模組。G-43：維護者 2026-11-18 裁定，原型裡未接上的 modal 全部補接。
- **該做**：自己加上 `role="dialog"`、`aria-modal`、`aria-labelledby`（G-23）。
- **該做**：必須確認才能繼續的閘門（例如標記指引閘門）忽略 Esc，只能按確認，並保留返回清單的出口（G-46，維護者 2026-11-18 裁定）。
- **該做**：每個關閉鈕都要有無障礙名稱（G-49）。
- **不該做**：用 `display` 或 inline style 直接開關，只切換 `.show`。
- **不該做**：在遮罩外另寫一份 `.btn-danger`；它就住在 modal 的樣式裡。
- 已知：遮罩色 `rgba(0, 0, 0, 0.5)` 寫死，沒有對應 token。
