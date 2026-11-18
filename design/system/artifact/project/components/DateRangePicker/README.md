選擇日期區間的觸發鈕與日曆彈出層：頁面提供 `.date-range-trigger`，腳本以 `DateRangePicker.mount()` 建立 `.date-range-popover`，支援單端開放的區間。

## 何時使用

- 篩選或查詢需要「從某天到某天」的區間時（例如工作紀錄、標記紀錄的時間範圍）。
- 只要單一日期時不用它。
- 允許只有起日或只有迄日：只給起日顯示「2026-11-09 ～ 不限」，只給迄日顯示「不限 ～ <日期>」。

## 結構與使用方提供的內容

- 頁面提供：`.date-range-trigger`（最小寬 220px）＞ `.date-range-trigger-text`（溢出省略）。
- 腳本建立：
  - `.date-range-popover`（280px 寬，`--z-dropdown`）；
  - `.date-range-popover-header`，含 `.date-range-nav-prev`、`.date-range-month-label`、`.date-range-nav-next`；
  - `.date-range-grid` ＞ `.date-range-day`；
  - `.date-range-popover-footer` ＞ `.date-range-clear`。
- 使用方以 `DateRangePicker.mount(trigger, { value: { from, to }, lang, onChange })` 掛載，`from`／`to` 都可以是 `null`；之後可用 `setLang()`、`setValue()`、`destroy()`。
- 預覽以靜態 markup 呈現一個展開中的日曆，並用預覽本地的覆寫把彈出層改為 `position: static`；上下月按鈕用 chevron 圖示代替原型的字元。

## 變體

只有一種版式。日期格有四個修飾 class：

| class | 表現 |
| :--- | :--- |
| `.is-today` | 以 `--color-primary` 畫框（`--color-primary-border` 不能是唯一的提示） |
| `.is-in-range` | `--color-primary-soft-bg` 柔底，圓角拉平成連續色帶 |
| `.is-range-start`／`.is-range-end` | 實心 `--color-primary`、`--color-on-cta` 字 |

## 狀態

| 狀態 | 表現 |
| :--- | :--- |
| 收合（預設） | 彈出層 `[hidden]`；未選時觸發鈕顯示「選擇日期區間」；觸發鈕用 `--color-border-control` 外框 |
| 展開 | 彈出層出現在觸發鈕下方 |
| hover | 日期格與上下月鈕換 soft 底 |
| focus | 觸發鈕與日期格都有 2px primary outline |
| 停用／載入中／錯誤 | 原型沒有定義（沒有禁用日期） |

## 該做／不該做

- **該做**：保留完整的鍵盤操作：Esc 關閉並把焦點還給觸發鈕；←／→ 移一天、↑／↓ 移一週；roving tabindex（只有目前那一天是 `tabindex="0"`）。
- **該做**：保留 ARIA：彈出層 `role="dialog"`、`aria-modal="false"`；觸發鈕帶 `aria-haspopup`、`aria-controls`、`aria-expanded`；端點帶 `aria-selected="true"`；上下月鈕的 `aria-label` 隨語言切換。
- **該做**：維持全檔只用 token；這是原型裡唯一完全沒有寫死色值的共用元件。
- **不該做**：把日曆與彈出層拆成兩個元件各自組合；`mount()` 是封裝好的整體，觸發鈕必須是頁面上既有的元素。
- **不該做**：用字元（‹ ›）當上下月圖示，改用 icon。
