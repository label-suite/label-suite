立即生效的開／關設定：40×22 的 `.toggle-switch` 外框，內含視覺上隱藏的 checkbox 與 `.toggle-slider` 軌道和圓鈕。

## 何時使用

- 一個設定只有開與關兩種值，而且切換後立即生效（通知設定、試跑模式）。
- 需要按「儲存」才生效的表單選項，用 checkbox 或 [Chip](../Chip/README.md) 的勾選型。
- 多個互斥選項用單選，不要用多個開關模擬。

## 結構與使用方提供的內容

- `.toggle-switch`：`<label>` 外框。
- 內含 `<input type="checkbox">`，以 `opacity: 0; width: 0; height: 0` 視覺上隱藏。
- `.toggle-slider`：軌道，`::before` 是 16×16 的圓鈕：關閉時 `--color-toggle-thumb`（淺色白、深色 slate-200），開啟時 `--color-on-cta`（#437）。
- 使用方提供設定名稱與說明。預覽中的 `.toggle-row`／`.toggle-info`／`.toggle-label-text`／`.toggle-desc` 是 showcase 的排版殼，不屬於元件本身，預覽在本地補了這段排版 CSS；實際頁面可以用自己的列版型。
- 使用方要把設定名稱關聯到 checkbox（包在同一個 `<label>` 裡，或用 `aria-labelledby`）。

## 變體

- 只有一種。尺寸、圓角、圓鈕位移（`translateX(18px)`）都是固定值，沒有尺寸維度。
- G-42：任務詳情頁的設定分頁另外重新定義了一份 toggle；維護者 2026-11-18 裁定以正典為準（40×22、開啟為主色）。任務設定頁（`task-config.css`）的那份與正典是同一個元件。

## 狀態

| 狀態 | 表現 |
| :--- | :--- |
| 關（預設） | 軌道 `--color-border` |
| 開 | 軌道換 `--color-primary`，圓鈕右移 18px，以 `--dur-fast` 過場 |
| focus | **原型沒有可見的焦點指示**（G-05）：checkbox 被壓成 0×0，原生焦點環無處可畫，`.toggle-slider` 也沒有 `:focus-within` |
| hover、停用 | 原型沒有定義 |
| 載入中／錯誤／空 | 不適用 |

## 該做／不該做

- **該做**：實作時為 `.toggle-switch:focus-within .toggle-slider` 補焦點環（G-05）；個人資料頁的通知設定一頁就有 12 組開關，全部靠鍵盤操作卻看不到焦點。
- **該做**：補上停用樣式，並在停用時設 `disabled`。
- **該做**：注意角色差異：我們是藏起來的 checkbox，輔助技術讀成「核取方塊」；若要讀成開關，加 `role="switch"`。
- **不該做**：在頁面裡另寫一份尺寸或顏色不同的 toggle（G-42）。
- **不該做**：用開關表示需要確認或儲存才生效的動作。
