清單頁表格上方的搜尋與篩選列：`.toolbar` 裡放 `.filter-select` 下拉、`.clear-btn` 清除篩選，以及帶內嵌圖示的 `.search-wrap` 搜尋框。

## 何時使用

- 任務清單、標記清單、資料集分析清單這類「表格＋分頁」的頁面頂端，用來縮小清單範圍。
- 一般表單裡的文字欄用 [Input](../Input/README.md)；日期區間篩選用 [DateRangePicker](../DateRangePicker/README.md)，可放進同一列。
- 行為契約 UXC-11：篩選、搜尋與分頁的狀態放在網址上，重新整理或分享連結時要還原同一個清單。

## 結構與使用方提供的內容

- `.toolbar`：flex、可換行，下方留 `--space-lg`。
- `.toolbar-left`（選用）：`flex: 1`，吃掉剩餘寬度。
- `.filter-select` 若干：原生 `<select>`，`appearance: none` 加背景箭頭；`min-width` 刻意留給頁面自己定。
- `.clear-btn`（選用）：清除所有篩選，含 x 圖示。
- `.search-wrap` ＞ `.search-icon`（絕對定位在左側 12px、`pointer-events: none`）＋ `.search-input`（36px 左內距讓位）。
- 使用方提供每個下拉與搜尋框的無障礙名稱（`aria-label` 或 `<label>`），整列可加 `role="search"`；原型的搜尋框沒有關聯任何 label。
- 頁面要在自己的 `<style>` **之前**載入這份樣式，同特異性下頁面的規則才會贏。

## 變體

只有一種。`.clear-btn.hide-clear` 是狀態不是變體。

## 狀態

| 狀態 | 表現 |
| :--- | :--- |
| 預設 | `--color-white` 底、`--radius-md`；`.search-input` 與 `.filter-select` 用 `--color-border-control` 外框，`.clear-btn` 用 `--color-border` |
| 有篩選可清除 | 顯示 `.clear-btn`；hover 時文字與邊框變深 |
| 沒有可清除的篩選 | `.clear-btn.hide-clear`：`visibility: hidden` ＋ `pointer-events: none`，**保留佔位，不跳版**（預覽第二列可見那段空位） |
| focus | `.search-input` 與 `.filter-select` 換 primary 邊框加 3px 焦點環 |
| 停用／載入中／錯誤 | 原型沒有定義；查無結果的畫面由表格的空狀態承擔 |

## 該做／不該做

- **該做**：把篩選與搜尋值同步到網址（UXC-11），並在清除時一起清掉。
- **該做**：用 `hide-clear` 隱藏清除鈕，而不是 `display: none`，避免搜尋框位置跳動。
- **該做**：焦點環改用 token 版的 `color-mix` 寫法（G-04）；原型寫死 `rgba(99,102,241,0.12)`，下拉箭頭的 data-URI 也寫死了顏色（G-02）。
- **該做**：高對比模式下保留可見的 `outline`；原型 `outline: none`、只靠 `box-shadow`（G-05）。
- **不該做**：期待原生 `<select>` 的選單外觀受設計系統控制；展開後的選單由作業系統繪製，各平台長得不一樣。
- 已知：G-21，元件盤點的第一批沒有可重現的工具列畫面，最近的樣本在任務清單的預設與「篩選後無結果」狀態。
