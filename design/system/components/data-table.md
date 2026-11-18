# Data Table

> 正典章節：`MASTER.md` 無對應章節（`shared/list-page.css` 自己是來源）｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.task-table-wrap`（`overflow-x: auto`、`-webkit-overflow-scrolling: touch`） | 必填 | `pages/shared/list-page.css:49` |
| `.task-table`（`border-collapse: collapse`、`white-space: nowrap`、左對齊） | 必填 | `:50`–`:56` |
| `<th>`（11px 大寫、字距 0.05em、`--color-slate-50` 底、下框線） | 必填 | `:57`–`:67` |
| `<td>`（`padding: 14px 20px`、`--color-border-muted` 下框線、垂直置中） | 必填 | `:68`–`:72` |

結構用**元素選擇器**（`.task-table th`／`td`），不是 class。

`white-space: nowrap`（`:54`）表示儲存格一律不換行，長內容靠外層橫向捲動——所以 `.task-table-wrap` 是必填的，少了它表格會撐破版面。

名稱叫 `task-table` 但它是**通用**的清單表格：`dataset-analysis-list`、`annotation-list` 也用同一組 class → `../design-gaps.md` G-26。

## 變體

只有一種。空列與錯誤列的樣式由 [Empty State](empty-state.md) 的 `.empty-state-td`／`.empty-state-dense`／`.empty-state-row`／`.error-row` 提供——它們是為這個表格寫的，但住在另一個檔。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `list-page.css:50` |
| 列 hover | **不在這個檔裡**。`empty-state.css:19`–`:20` 用 `background: transparent !important` **取消** hover，反推可知一般列的 hover 是由各頁面自己定義的 | `empty-state.css:19` |
| 空 | 有，見 [Empty State](empty-state.md) | `empty-state.css:11`–`:21` |
| 錯誤 | 有，`.error-row` 把標題改成 `--color-error` | `empty-state.css:21` |
| focus／disabled／載入中 | 未觀察到 | 全檔無偽類 |
| 排序中 | **未觀察到**。沒有排序指示的樣式，但 `ap_sort` 這類排序參數確實存在 | → `../design-gaps.md` G-27 |

## token

`--color-border`、`--color-border-muted`、`--color-ink-muted`、`--color-slate-50`。零寫死色值。

內距（12px 20px／14px 20px）、字級（14px／11px）、字距（0.05em）是字面值。

## 鍵盤與焦點

原生 `<table>`，語意由使用頁面的 markup 決定。這個檔**不提供** `scope`、`<caption>`、`aria-sort` 或任何排序語意。橫向捲動容器沒有 `tabindex="0"`，所以**鍵盤無法捲動它** → `../design-gaps.md` G-27。

## 樣式出處

`design/prototype/pages/shared/list-page.css:49`–`:72`。空／錯誤列在 `design/prototype/pages/shared/empty-state.css:11`–`:21`。

## 可重現樣本

本批次**沒有可重現的視圖**：b1 的九個畫面都沒有表格。最近的樣本在 b2 的 `task-management/task-list#state-default`。→ `../design-gaps.md` G-21

**b2 補上**：`task-management/task-list#state-default`、`admin/role-settings#state-default`（可鍵盤捲動的矩陣）、`task-management/task-detail#tab-member-management`。

## shadcn 對照

候選原語 `Table`（`TableHeader`、`TableBody`、`TableRow`、`TableHead`、`TableCell`、`TableCaption`），通常搭 TanStack Table。

- **我們有而它沒有**：`nowrap` ＋ 外層橫捲這個明確取捨。
- **它有而我們沒有**：`TableCaption`、結構 class（我們用元素選擇器，所以表格內不能有第二層 `<td>`）、排序與選取的整套接法。
- **語意對不上**：shadcn 的 Table 是純版面、資料邏輯交給 TanStack；我們連排序指示都還沒有，所以對照的只是外觀那一層。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| 無（b1） | — |
| `task-management/task-list`（`#state-default`、`#role-task-role`） | `.task-table`，本頁 `<style>` 又定義一次（`task-list.html:79`–`:81`） |
| `admin/user-management#state-default` | 本頁的表格（`user-management.html:416`–`:418`） |
| `admin/role-settings#state-default` | `.matrix-table`（`role-settings.html:104`），sticky 首欄與表頭（`:127`、`:156`），外層 `role="region" tabindex="0"`——**鍵盤可捲**，與 G-27 相反 |
| `task-management/task-detail`（`#tab-member-management`、`#tab-annotation-progress`、`#tab-annotation-results`、`#tab-work-log`） | `.member-table`（`member-management.html:19`；`annotation-progress.html:32`；`annotation-results.html:48`；`work-log.html:38`） |
| `annotation/annotation-list`（`#state-default`、`#role-*`） | `.task-table`（`annotation-list.html:524`）。標記員的列是 `tr role="button" tabindex="0"`，Enter／Space 進工作區（`:1875`）；空狀態**不放進表格**，另用 [Empty State](empty-state.md) |

b2 已補上（見上表）。b3 已補上（見上表）。b4（`dataset/dataset-analysis-list`），待 b4 補。
