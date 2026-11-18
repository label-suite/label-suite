# Pagination

> 正典章節：`MASTER.md` §Pagination ｜行為契約 [UXC-11](../ux-conventions.md#uxc-11-篩選搜尋與分頁的狀態放在網址上)｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.pagination` 容器（`<nav aria-label="Pagination">`） | 必填 | `components-showcase.html:586`、樣本 `:1176` |
| `.pagination-info` 總筆數與頁次 | 選用 | `pages/shared/list-page.css:82`、樣本 `components-showcase.html:1177` |
| `.pagination-controls` > `.page-btn` ×n ＋ `.page-ellipsis` | 必填 | `list-page.css:83`、`:94`、樣本 `:1178`–`:1186` |
| `.page-size-select` 每頁筆數 | 選用 | `components-showcase.html:624`、`list-page.css:100` |

**最多 5 顆可見頁碼加省略號**（`components-showcase.html:1174` 的說明）；樣本是 `1 2 3 … 7`。

## 變體

只有一種版式。`.page-btn` 的三種狀態（預設／`.active`／`:disabled`）不是變體而是狀態。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `list-page.css:84` |
| hover | 有。正典無條件套用；**shipped 版多了 `:not(:disabled):not(.active)` 兩個排除** | `components-showcase.html:609` vs `list-page.css:91` |
| 目前頁 | 有。`.active` 實心 primary，樣本帶 `aria-current="page"` | `list-page.css:92`、樣本 `components-showcase.html:1180` |
| disabled | 有。`opacity .4`；**shipped 版多 `pointer-events: none`** | `components-showcase.html:620` vs `list-page.css:93` |
| focus | **未觀察到**。`.page-btn` 與 `.page-size-select` 兩份都沒有 `:focus`／`:focus-visible` | 正典 `components-showcase.html:585`–`:631` 0 命中；`list-page.css` 全檔只有 2 個 `:focus`，都在工具列（`:30` 的 `.search-input`、`:39` 的 `.filter-select`），分頁一個都沒有 → `../design-gaps.md` G-05 |
| 載入中／錯誤 | 不適用 | — |
| 空 | 未觀察到。沒有「0 筆時分頁長什麼樣」的樣式 | — |

## token

`--color-border`、`--color-border-control`、`--color-white`、`--color-ink`、`--color-primary`、`--color-primary-strong`、`--color-primary-soft-bg`、`--color-text-soft`、`--radius-md`、`--space-md`、`--space-lg`、`--space-xs`、`--dur-fast`。

**一個色 token 兩份定義不一致**：`.page-btn.active` 的文字色，正典是 `--color-on-cta`（`components-showcase.html:617`，註解明寫「WCAG AA foreground token, issue singyichen/label-suite#1019」），shipped 的 `list-page.css:92` 是 `--color-white`。前者會隨主題換（深色下不是白），後者固定白 → `../design-gaps.md` G-12。

`.page-size-select` 與 `.filter-select` 的下拉箭頭是 data-URI SVG，裡面寫死 `%2394A3B8`（`list-page.css:103`、`:34`）。

## 鍵盤與焦點

原生 `<button>` 與 `<select>`，Tab 可達。樣本的 `aria-label="Previous page"`／`"Next page"`（`:1179`、`:1185`）與 `aria-current="page"`（`:1180`）都在**樣本的 markup** 上，不是元件保證的。沒有焦點樣式（見上）。

## 樣式出處

`design/prototype/components-showcase.html:585`–`:631`（正典）、`design/prototype/pages/shared/list-page.css:74`–`:105`（shipped，7 個頁面載入它）。

## 可重現樣本

`components-showcase#state-default` → `#comp-pagination`（`components-showcase.html:1172`）。

## shadcn 對照

候選原語 `Pagination`（`PaginationLink`、`PaginationEllipsis`、`PaginationPrevious`／`Next`）。

- **我們有而它沒有**：每頁筆數選單、總筆數資訊列、UXC-11 的網址同步契約。
- **它有而我們沒有**：`isActive` 的型別化 API、內建 focus ring、`<a>` 與 `<button>` 兩種語意。
- **語意對不上**：shadcn 的 Pagination 是純版面，頁數計算留給使用端；我們把「最多 5 顆加省略號」寫進了正典說明，但**沒有任何程式實作它**——每個清單頁各自算。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 樣本 |
| `admin/user-management#state-default` | 本頁重寫的 `.page-btn`（`user-management.html:115`–`:133`） |
| `task-management/task-list#state-default` | 本頁重寫的 `.page-btn`（`task-list.html:110`；markup `:262`–`:275`）；三種空／錯誤狀態整條隱藏 |
| `task-management/task-detail`（`#tab-member-management`、`#tab-annotation-progress`、`#tab-annotation-results`、`#tab-work-log`） | 各 panel 的 `.page-btn`（`annotation-progress.html:134`、`annotation-results.html:63`、`:112` 等） |
| `annotation/annotation-list#state-default` | `.pagination`（`annotation-list.html:517`），「共 N 筆 · 第 N / N 頁」 |
| `dataset/dataset-analysis-list`（`#state-default`） | `list-page.css` 的 `.pagination`（`dataset-analysis-list.html:284`–`:300`），`.page-size-select` 與 `.page-btn`；目前頁 `aria-current="page"`（`dataset-analysis-list.view.js:239`） |

b1 的帳號頁一個都沒用。b2 已補上（見上表）。b3 已補上（見上表）。b4 已補上（見上表）。
