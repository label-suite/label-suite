Data Table 是清單頁的通用表格：小號大寫表頭、單行儲存格，長內容靠外層容器橫向捲動。

## 何時使用

- 一列一筆、欄位固定的清單，例如任務清單、資料集分析清單、標記清單。
- 名稱叫 `task-table`，但它是通用的清單表格，不限任務（G-26）。
- 要固定首欄或表頭的矩陣（例如角色設定的權限矩陣）不用它；那是 `role-settings` 自己的 `.matrix-table`。

## 結構與使用方提供的內容

- `.task-table-wrap`：必填，`overflow-x: auto`。儲存格一律不換行，少了它表格會撐破版面。
- `table.task-table`：`border-collapse: collapse`、`white-space: nowrap`、左對齊。
- `th`：11px、大寫、字距 0.05em、`--color-slate-50` 底、下框線。
- `td`：`padding: 14px 20px`、下框線 `--color-border-muted`、垂直置中。
- 結構用元素選擇器（`.task-table th`／`td`），不另給 class。
- 使用方提供：
  - 表格的 `aria-label`；
  - `th` 的 `scope`；
  - 可點的列（需要時用 `tr role="button" tabindex="0"`）；
  - 列的 hover 樣式（由各頁自己定義）。
- token：`--color-border`、`--color-border-muted`、`--color-ink-muted`、`--color-slate-50`，沒有寫死的色值。

## 變體

只有一種。空列與錯誤列的樣式由 Empty State 提供：

- `.empty-state-row` 加 `td.empty-state-td[colspan]`，裡面放 `.empty-state.empty-state-cell`；
- `.empty-state-dense` 是較窄的版本；
- `.error-row` 把標題改成 `--color-error`。

## 狀態

- 預設：有。
- 列 hover：表格本身不提供，各頁自訂。空列與錯誤列會用 `!important` 取消 hover。
- 空：整列一個 Empty State，標題加說明。
- 錯誤：`.error-row`。
- 排序中：沒有排序指示的樣式，但 `ap_sort` 這類排序參數已存在（G-27）。
- focus／disabled／載入中：沒有對應樣式；載入中由 Skeleton 處理。

## 該做／不該做

- 該做：表格一律包在 `.task-table-wrap` 裡。
- 該做：給 `th` 加 `scope="col"`，給表格加 `aria-label` 或 `<caption>`。
- 該做：可排序的欄位補 `aria-sort` 與視覺指示，等 G-27 定案。
- 不該做：用表格做版面排版。
- 注意：橫向捲動的容器沒有 `tabindex="0"`，鍵盤無法捲動（G-27）。需要時參考 `role-settings` 的 `role="region" tabindex="0"` 寫法。
