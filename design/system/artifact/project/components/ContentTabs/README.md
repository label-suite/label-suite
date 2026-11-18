Content Tabs 是頁面內容區裡的一排分頁，用底線標出目前分頁，切換同一個物件底下的不同面向。

## 何時使用

- 同一個物件有好幾個面向要分開看時使用，例如任務詳情的概覽、設定、成員管理、標記進度、標記結果、工時紀錄。
- 側面板頂端的少數分頁用 `.admin-tabs--panel`，例如標記工作區的「標記說明／歷程」。
- 不要拿它當工作頁籤。App Shell 的 `.workspace-tab-bar` 是外殼層的工作頁，兩者命名分工要寫進 `MASTER.md`，但那一節還不存在（G-25）。

## 結構與使用方提供的內容

- `.admin-tabs`：橫排容器，下緣 2px `--color-border`。
- `.admin-tab`：可以是 `a`（換頁）或 `button`（同頁切換）。目前分頁加 `.active`，文字變 `--color-primary-strong`、底線變 `--color-primary`。
- 使用方提供分頁文字，並自己決定 ARIA：CSS 不提供 `role="tablist"`、`role="tab"`、`aria-selected`，也不提供方向鍵巡覽（G-22）。
- 已有的做法：`task-detail` 加了完整的 tablist ARIA 和方向鍵；`dataset-analysis-detail` 有 ARIA 但沒有方向鍵；`annotation-workspace` 的面板版兩者都沒有。

## 變體

- 預設 `.admin-tabs`：放在頁首下方，橫跨內容寬度。
- `.admin-tabs--panel`：貼齊側面板頂端，左右內距縮小。
- 窄視窗（< 768px）：分頁列可以橫向捲動，捲軸隱藏，每個分頁不縮。

## 狀態

- 預設、目前分頁 `.active`：有。
- hover：文字變深。
- focus：沒有焦點樣式，全檔 `:focus` 0 命中（G-05）。
- disabled：`task-detail` 在初始化前用 `aria-disabled`，CSS 沒有對應樣式。
- 載入中／錯誤／空：屬於分頁內容，不屬於分頁列。

## 該做／不該做

- 該做：用 `button` 加 `role="tab"`、`aria-selected`、`aria-controls`，內容面板加 `role="tabpanel"`，並支援左右方向鍵。以 `task-detail` 的做法為準。
- 該做：分頁列只用共用的 `.admin-tabs`／`.admin-tab`。
- 不該做：在頁面裡重新定義 `.admin-tabs` 或 `.admin-tab` 的選擇器。
- 不該做：把分頁當主要導覽。跨頁導覽交給 App Shell 的側欄。
- 原件的可重現樣本不在 b1（G-21）。preview 取自 `task-detail` 的分頁 markup。
