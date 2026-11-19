# List Toolbar

> 正典章節：`MASTER.md` 無對應章節（`shared/list-page.css` 自己是來源）｜行為契約 [UXC-11](../ux-conventions.md#uxc-11-篩選搜尋與分頁的狀態放在網址上)｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c` ｜未標檔名的行號指 `design/prototype/pages/shared/list-page.css`

## 結構

清單頁上方那一列：搜尋、篩選、清除。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.toolbar`（flex、可換行、下方 `--space-lg`） | 必填 | `pages/shared/list-page.css:10` |
| `.toolbar-left`（`flex: 1`，吃掉剩餘寬度） | 選用 | `:14` |
| `.search-wrap` ＞ `.search-icon` ＋ `.search-input` | 選用 | `:15`–`:30` |
| `.filter-select` ×n | 選用 | `:31`–`:39` |
| `.clear-btn`（清除篩選） | 選用 | `:40`–`:47` |

`.search-icon` 絕對定位在左側 12px 並 `pointer-events: none`（`:19`–`:22`），輸入框以 36px 左內距讓位（`:21`）。

## 變體

只有一種。`.clear-btn.hide-clear` 不是變體而是狀態（見下）。

`.filter-select` 與 `.task-table` 的 `min-width` **刻意留給頁面自己定**（`list-page.css:4`–`:5` 的註解）。檔頭也明寫：頁面必須在自己的 `<style>` **之前**連結這個檔，同特異性下頁面的規則才會贏（`:2`–`:3`）。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `list-page.css:10` |
| focus | **有**。`.search-input` 與 `.filter-select` 都換 primary 邊框加 3px ring | `:30`、`:39` — 全 `list-page.css` 只有這兩條 `:focus` |
| hover | 只有 `.clear-btn` 有（文字換 `--color-ink`、邊框換 `--color-primary`） | `:46` |
| 沒有可清除的篩選 | 有。`.clear-btn.hide-clear` 用 `visibility: hidden` ＋ `pointer-events: none`——**保留佔位，不跳版** | `:47` |
| disabled／載入中／錯誤／空 | 未觀察到 | 全檔無 `:disabled` |

## token

`--space-sm`、`--space-lg`、`--color-border`、`--color-border-control`、`--color-ink`、`--color-ink-muted`、`--color-white`、`--color-primary`、`--radius-md`、`--dur-fast`。

#438 之前有兩個寫死處：focus ring 的 `rgba(99,102,241,0.12)`（`:30`、`:39`），以及 `.filter-select` 下拉箭頭 data-URI SVG 裡的 `%2394A3B8`（`:31`）。#438 起 focus ring 改成和 `shared/input.css` 相同的 `color-mix(in srgb, var(--color-primary) 12%, transparent)`；箭頭的筆畫色仍寫在 data-URI 裡（SVG 讀不到 `var()`），但對齊 `--color-ink-muted`，淺色 `%235E6B7F`、深色另一條規則 `%239CA3AF`（`:108`）→ `../design-gaps.md` G-02、G-04。

## 鍵盤與焦點

原生 `<input>`／`<select>`／`<button>`。焦點樣式是 `box-shadow` ring 而不是 `outline`，且 `outline: none`（`:27`、`:35`）——高對比模式下會消失，和 [Input](input.md) 同一個問題 → `../design-gaps.md` G-05。

`.search-input` 沒有被任何 `<label>` 關聯；無障礙名稱由使用頁面自己補。

## 樣式出處

`design/prototype/pages/shared/list-page.css:1`–`:47`。檔頭註解說明這些值是從 `dataset-analysis-list` **逐字搬過來**的，`dataset-analysis-list`、`task-list`、`annotation-list` 三頁採用（issue `singyichen/label-suite#1448`）。

`:where(button, input, select) { font: inherit; cursor: pointer; }` 這條元素重設（`:7`）用 `:where()` 保持零特異性——它會影響載入此檔的**整個頁面**，不只工具列。

## 可重現樣本

本批次**沒有可重現的視圖**：showcase 不含工具列，b1 的九個畫面也沒有一個載入 `list-page.css`。最近的樣本在 b2 的 `task-management/task-list#state-filtered-empty`。→ `../design-gaps.md` G-21

**b2 補上**：`task-management/task-list#state-default` 與 `#state-filtered-empty`（`list-page.css` 加本頁重寫）。

## shadcn 對照

沒有單一對應原語；接近 `Input` ＋ `Select` ＋ `Button` 的組合，shadcn 的 data-table 範例裡有類似的工具列但不是發行的元件。

- **我們有而它沒有**：`hide-clear` 的「保留佔位」約定、搜尋框的內嵌圖示版式。
- **它有而我們沒有**：`Select` 的完整鍵盤與 ARIA（我們用原生 `<select>`，樣式靠 `appearance: none` 加背景圖）、`Command` 式的搜尋。
- **語意對不上**：shadcn 的 `Select` 是自繪下拉；我們是原生 `<select>`，所以選單本身的外觀**不受設計系統控制**，各作業系統長得不一樣。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| 無（b1） | — |
| `task-management/task-list`（`#state-default`、`#state-filtered-empty`） | 工具列 markup `task-list.html:197`–`:229`，已載 `list-page.css` 又在 `<style>` 重寫（`:143`–`:149`） |
| `admin/user-management#state-default` | 本頁的搜尋與篩選 `.filter-bar`（`user-management.html:59`–`:83`、`:291`），不是 `list-page.css` |
| `annotation/annotation-list`（`#state-default`、`#state-filtered-empty`） | `.toolbar role="search"`（`annotation-list.html:473`）：`.filter-select`、`.search-input`、`.clear-btn`；篩選狀態放網址（`?q=`、`?status=`，UXC-11，`:1051`） |
| `dataset/dataset-analysis-list`（`#state-default`、`#state-filtered-empty`） | `list-page.css` 的 `.toolbar role="search"`（`dataset-analysis-list.html:250`）：兩個 `.filter-select`（`:252`、`:255`）、`.clear-btn`（`:258`）、`.search-input`；篩選寫進網址（`syncUrl`，`dataset-analysis-list.js:71`） |

b2 已補上（見上表）。b3 已補上（見上表）。b4 已補上（見上表）。表格與分頁的部分見 [Data Table](data-table.md) 與 [Pagination](pagination.md)。
