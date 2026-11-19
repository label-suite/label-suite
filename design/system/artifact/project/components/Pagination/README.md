Pagination 是清單底部的分頁列：左邊總筆數與每頁筆數，右邊上一頁、頁碼、下一頁。

## 何時使用

- 伺服器端分頁的清單或表格，放在表格下方，例如任務清單、資料集分析清單。
- 筆數少到一頁放得下時仍顯示資訊列，但上一頁與下一頁都會是 disabled。
- 頁碼、每頁筆數要寫進網址（UXC-11），重新整理或分享連結後要回到同一頁。

## 結構與使用方提供的內容

- `nav.pagination[aria-label]`
- 左側 `.pagination-left`：
  - `.pagination-info`：「共 N 筆 · 第 X / Y 頁」；
  - `select.page-size-select`：20／50／100 筆/頁。
- 右側 `.pagination-controls`：
  - `button.page-btn`：上一頁、頁碼、下一頁。上一頁與下一頁放 chevron SVG，要帶 `aria-label`。
  - `span.page-ellipsis`：頁碼中間省略的地方。
- 頁碼最多同時顯示 5 個，其餘以省略號代替，首頁與末頁固定顯示。
- 使用方提供總筆數、目前頁、每頁筆數，以及換頁時更新網址的處理。
- token：`--color-primary`、`--color-primary-strong`、`--color-primary-soft-bg`、`--color-border`、`--color-border-control`（每頁筆數選單）、`--color-text-soft`，以及目前頁文字的 `--color-on-cta`（G-12）。

## 變體

只有一種。showcase 的上一頁、下一頁用 ‹ › 字元；preview 改用 `dataset-analysis-list` 的 chevron SVG 版本。

## 狀態

- 預設：有。
- hover（非目前頁、非 disabled）：主色框線、淡主色底、`--color-primary-strong` 字。
- 目前頁 `.active`：主色底，文字 `--color-on-cta`。#438 讓 `list-page.css` 改用它，和正典一致（G-12）；原本的 `--color-white` 在深色主題取到的是卡片底色。
- `:disabled`：透明度 0.4，不可點。
- focus：`.page-btn` 與 `.page-size-select` 都沒有焦點樣式（G-05）。
- 載入中／錯誤／空：由表格負責，分頁列不另做。

## 該做／不該做

- 該做：目前頁加 `aria-current="page"`，上一頁與下一頁加 `aria-label`。
- 該做：換頁與換每頁筆數都同步到網址（UXC-11）。
- 該做：換每頁筆數後回到第 1 頁。
- 不該做：一次列出所有頁碼；超過 5 個就用省略號。
- 不該做：用字元當箭頭圖示。
