密碼欄右側切換「顯示／隱藏密碼」的圖示鈕：絕對定位在 `.input-wrapper` 內，切換輸入框的 `type="password"` 與 `type="text"`。

## 何時使用

- 任何密碼輸入欄：登入、註冊（密碼、確認密碼）、重設密碼（新密碼、確認密碼）、個人資料的變更密碼。
- 每個密碼欄各配一顆；兩個欄位的鈕要能分開辨識。
- 一般文字欄不需要它。

## 結構與使用方提供的內容

- `.input-wrapper`：`position: relative` 的外框，包住輸入框。左側可放 `.input-icon`（例如鎖頭圖示）。
- `<input type="password">`。
- `.eye-toggle`：原生 `<button type="button">`，`position: absolute`、距右 12px、無邊框、`--color-ink-muted` 色，內含眼睛 `<svg>`。
- 使用方提供 `aria-label`：預設「顯示密碼」；確認密碼欄用「顯示確認密碼」，讓兩顆分得開。
- 帳號頁的寫法放在 `.auth-page` 範圍內。

## 變體

- 只有一種。login、register、reset-password 三頁的定義完全相同。
- G-28：個人資料頁的外框 class 是 `.input-pw-wrap` 而不是 `.input-wrapper`，屬於帳號頁元件定義分歧，重建時統一為一份。
- 重建時這應成為 Input 的一個 `type="password"` 衍生元件，而不是各頁各寫一份。

## 狀態

| 狀態 | 表現 |
| :--- | :--- |
| 隱藏（預設） | 輸入框 `type="password"`，圖示為劃線的眼睛，`aria-label` 為「顯示密碼」 |
| 顯示 | 輸入框 `type="text"`，圖示換成眼睛，`aria-label` 改為「隱藏密碼」 |
| hover／focus | **原型沒有**（G-05），實作時補上焦點環 |
| 停用／載入中／錯誤／空 | 不適用；錯誤樣式由外層輸入框承擔 |

## 該做／不該做

- **該做**：點擊時同時切換 `input.type` 與 `aria-label`；切換語言時依目前的顯示狀態重算標籤。這是原型少見把動態無障礙名稱做對的地方，要保留。
- **該做**：用 `type="button"`，避免在表單裡誤觸送出。
- **不該做**：用 `aria-pressed` 再表示一次同樣的狀態；以切換 `aria-label` 承載狀態已足夠，兩者並用會讓報讀重複。
- **不該做**：為不同頁面另寫外框 class（G-28）。
