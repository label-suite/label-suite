# Breadcrumb

> 正典章節：`MASTER.md` §Breadcrumb ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c` ｜未標檔名的行號指 `design/prototype/components-showcase.html`

## 結構

`<nav class="breadcrumb" aria-label="breadcrumb">` 裡交替排列連結與分隔符，最後一節是 `aria-current="page"` 的純文字。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.breadcrumb` 容器 | 必填 | `components-showcase.html:639`、樣本 `:1212` |
| `<a>` 上層連結 | 至少一個 | `components-showcase.html:647`、樣本 `:1213` |
| `.breadcrumb-sep`（`›`，`aria-hidden="true"`） | 每兩節之間一個 | `components-showcase.html:653`、樣本 `:1214` |
| 目前節點（`aria-current="page"`） | 必填 | 樣本 `components-showcase.html:1215` |

**最深兩層**（`components-showcase.html:1210` 的說明）。但同一份 showcase 的 Review Status Track 樣本就用了三層（`:1223`–`:1228`），而 `pages/annotation/annotation-list.html:56` 的註解稱自己用的是「compact form」→ `../design-gaps.md` G-13。

## 變體

正典只有一種。`annotation-list.html:56` 與 `annotation-workspace.html:56` 的註解都提到一個「compact form」，但正典沒有對應的 class。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `components-showcase.html:639` |
| hover | 有，連結加底線 | `components-showcase.html:650` |
| focus | **未觀察到** | 以 `:focus` 掃 `.breadcrumb` 的規則 `:638`–`:656`，0 命中 → `../design-gaps.md` G-05 |
| disabled／載入中／錯誤／空 | 不適用 | — |

## token

`--color-text-soft`、`--color-primary-strong`、`--color-ink-muted`。字級 13px／11px 與 `margin-bottom: 12px` 是字面值。

## 鍵盤與焦點

原生 `<a>`，Tab 可達。分隔符 `aria-hidden="true"`，不會被朗讀成「大於」。

## 樣式出處

`design/prototype/components-showcase.html:638`–`:656`。`pages/shared/` 沒有 breadcrumb 的 CSS 檔；使用它的四個 shipped 頁面各自在 `<style>` 裡複製一份。

## 可重現樣本

`components-showcase#state-default` → `#comp-breadcrumb`（`components-showcase.html:1208`）：兩層版。三層版在同頁的 `#comp-review-track`（`:1225`）。

## shadcn 對照

候選原語 `Breadcrumb`（`BreadcrumbItem`、`BreadcrumbSeparator`、`BreadcrumbPage`、`BreadcrumbEllipsis`）。

- **我們有而它沒有**：無。
- **它有而我們沒有**：`<ol>`／`<li>` 的語意結構（我們是扁平的 span 與 a）、`BreadcrumbEllipsis` 的層數摺疊、focus ring。
- **語意對不上**：shadcn 用 list 結構，輔助技術會朗讀「第 2 項，共 3 項」；我們的扁平結構沒有這個資訊。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 兩層與三層各一 |
| `task-management/task-detail`（全部 `#tab-*`） | 本頁一行式的 `.breadcrumb`（`task-detail.html:47`–`:49`，markup `:1877`–`:1880`），兩層 |
| `annotation/annotation-list`（`#state-default`、`#role-*`） | `#entryBreadcrumb`（`annotation-list.html:435`），最後一層 `aria-current="page"`（`:2394`） |
| `annotation/annotation-workspace`（全部視圖） | `nav#entryBreadcrumb`（`annotation-workspace.html:1212`），第三層是樣本，`aria-current="page"`（`annotation-workspace.config.js:1603`） |
| `dataset/dataset-analysis-detail`（全部視圖） | 本頁 `nav.breadcrumb`（`dataset-analysis-detail.html:249`–`:253`，樣式 `:38`–`:41`）：兩層「資料集分析 › 任務名稱」，分隔符 `aria-hidden`，目前頁是純文字 `<span>`、沒有 `aria-current` |

b1 的帳號頁一個都沒用（它們是登出狀態的單層頁）。b2 已補上（見上表）。b3 已補上（見上表）。b4 已補上（見上表）。
