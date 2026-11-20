欄位旁的補充說明泡泡：標籤旁一顆 16px 圓形的 `.field-help-tooltip`「?」鈕，hover 或 focus 時，緊接在它後面的 `.tooltip-bubble` 出現在上方。

## 何時使用

- 欄位需要一句額外說明，但放在 `.field-hint` 會太佔版面，或只有部分使用者需要時（例如「每回合抽樣筆數需 >= 1 且 < 資料集總筆數」）。
- 說明是**必要**資訊（不看就填錯）時，改用 [Input](../Input/README.md) 的 `.field-hint`，直接顯示。
- 不要在泡泡裡放連結、按鈕等可互動的內容；泡泡只是文字。

## 結構與使用方提供的內容

- `.field-label-row`：欄位標籤和觸發鈕排在同一行。
- `.tooltip-wrap` ＞ `.field-help-tooltip`（原生 `<button type="button">`，`cursor: help`）＋ `.tooltip-bubble`。
- 泡泡必須**緊接**在觸發鈕之後：顯示是純 CSS，靠 `.field-help-tooltip:hover + .tooltip-bubble` 與 `:focus + .tooltip-bubble`。
- 泡泡帶 `role="tooltip"` 與 id，觸發鈕以 `aria-describedby` 指向它。
- 使用方提供說明文字與觸發鈕的 `aria-label`（例如「每回合抽樣筆數的說明」）。
- 泡泡最寬 `min(320px, 100vw − 48px)`，帶向下的小三角。預覽中第一組以預覽本地 class 強制顯示，第二組是預設的隱藏狀態。

## 變體

| 變體 | 差別 |
| :--- | :--- |
| 欄位說明 | 觸發鈕放在 `.field-label-row` 裡，用在任務建立與任務設定 |
| 審核說明 | 觸發鈕放在審核單位的脈絡橫幅裡，泡泡用固定 id 供 `aria-describedby` 指向；同一組 class，沒有 `.field-label-row` |

## 狀態

| 狀態 | 表現 |
| :--- | :--- |
| 隱藏（預設） | `visibility: hidden` 加 `opacity: 0` |
| 顯示 | 觸發鈕 hover 或 focus 時淡入，以 `--dur-fast` 過場 |
| 觸發鈕 focus | `outline: 2px solid var(--color-primary)`（#423 改用 token，G-37；#442 把 bundle 的鏡像對齊過來） |
| 停用／載入中／錯誤／空 | 不適用 |

## 該做／不該做

- **該做**：每個泡泡都接上 `role="tooltip"` 與 `aria-describedby`，讓螢幕閱讀器讀得到。
- **該做**：實作時補上 Esc 收起；原型沒有鍵盤處理，泡泡只在失焦時消失。
- **該做**：泡泡的圓角與 `z-index` 改用 `--radius-*`、`--z-*`（G-02，原型寫死 6px 與 500）。
- **不該做**：在泡泡和觸發鈕之間插入其他元素，相鄰選擇器會失效。
- **不該做**：靠泡泡傳達錯誤或必要資訊；泡泡固定在上方靠左，窄視窗可能出界。
- 已知：「?」是原型的實際內容（字元），圖示庫目前沒有問號圖示。
