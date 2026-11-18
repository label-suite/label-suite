膠囊形的小標籤，分兩類：可點的選取 chip（`.task-type-chip`，多選或單選）與唯讀的顯示 chip（分類結果、數值、指標、原因）。

## 何時使用

- **選取 chip**：從少量、可一眼看完的選項裡挑選，例如建立任務時選任務類型（多選）或標籤模式（單選）。選項很多時改用下拉。
- **顯示 chip**：在表格或卡片裡標出一個簡短的屬性值，例如分類結果、V／A 數值、IAA 指標、原因標籤。不可點。
- 狀態類的標示（進行中、已完成）用 Status Pill 或 Badge，不用 chip。
- G-11：設計系統把這兩類放在同一個章節，但它們其實是兩個元件，前者對應切換群組，後者對應 Badge；新程式碼按類別分開實作。

## 結構與使用方提供的內容

選取 chip：

- `.task-type-chip-grid` 容器，帶 `role="group"`（多選）或 `role="radiogroup"`（單選）與 `aria-label`。
- 每個選項是 `<button class="task-type-chip">`，帶 `role="checkbox"` 或 `role="radio"` 與 `aria-checked`。
- 內含 `.task-type-chip-check` 勾選框（多選為方形打勾，單選為圓點）＋選項文字。
- 使用方提供選項文字，並在點擊時切換 `aria-checked`（單選時把同組其他的設回 false）。

顯示 chip：單一 `<span>`，使用方提供簡短文字。

## 變體

| class | 類 | 說明 |
| :--- | :--- | :--- |
| `.task-type-chip` | 選取，多選 | primary 系列 token |
| `.task-type-chip[role="radio"]` | 選取，單選 | 勾選框改成圓形 |
| `.ar-classif-chip` | 顯示 | 分類結果，紫色系（寫死） |
| `.ar-va-chip` ＋ `-normal`／`-outlier` | 顯示 | 數值與離群標記，`--font-mono`，綠／紅（寫死） |
| `.round-metric-chip` | 顯示 | 指標，token |
| `.cause-chip` | 顯示 | 原因標籤，token |

## 狀態

| 狀態 | 表現 |
| :--- | :--- |
| 預設 | `--color-border` 外框、`--radius-full` |
| hover（選取 chip） | 邊框換 `--color-primary`、文字換 `--color-primary-strong`，底色 `--color-primary-soft-bg` |
| 選中 | 同 hover 的色，字重 600，勾選框填滿 |
| focus | **原型沒有**焦點樣式（G-05） |
| 停用 | 原型沒有定義 |
| 載入中／錯誤／空 | 不適用 |

## 該做／不該做

- **該做**：選取 chip 一律帶 `role` 與 `aria-checked`，容器帶 `aria-label`。
- **該做**：實作時補焦點環（G-05）；單選群組補方向鍵巡覽，整組只佔一個 Tab 位（原型只綁了點擊）。
- **該做**：顯示 chip 改用 token 上色。原型的顯示 chip 寫死 9 個色值（G-02），並且圓角混用 `9999px`、`999px` 與 `--radius-full`。
- **不該做**：讓顯示 chip 看起來可點，或給它 hover 效果。
- **不該做**：只靠顏色區分正常與離群；保留文字或符號（例如 V／A 前綴與數值）。
