沒有資料可顯示時的說明區塊：告訴使用者為什麼是空的，以及可以做什麼。

## 何時使用

- 清單、表格、面板還沒有任何資料（「尚無成員進度資料」）。
- 篩選或搜尋後沒有符合的結果（「找不到符合條件的使用者」）。
- 表格某一列或某個儲存格沒有內容、或載入失敗。

「還沒有資料」與「篩選後沒結果」共用同一套 CSS，只有文案不同（UXC-09）；只有篩選後沒結果才給「清除篩選」動作。

## 結構與使用方提供的內容

- `.empty-state` > `.empty-state-icon`（可省略）、`.empty-state-title`、`.empty-state-desc`、`.empty-state-action`（可省略）。
- 圖示用 `assets/icons/` 的內嵌 SVG，`aria-hidden="true"`。
- 標題說明狀況，描述說明原因或下一步，動作放一顆按鈕（清除篩選用 `btn-ghost`）。

## 變體

| 尺寸類別 | 用途 |
| --- | --- |
| `.empty-state-page` | 整頁或主要區塊的空狀態 |
| `.empty-state-panel` | 面板、卡片裡 |
| `.empty-state-compact` | 只有一行說明的窄區域 |
| `.empty-state-cell` | 表格儲存格 |

表格輔助類別：`.empty-state-td`、`.empty-state-dense`、`.empty-state-row`；`.error-row` 讓標題變成 `--color-error`，用在載入失敗的列。

## 狀態

- 無資料、篩選無結果、載入失敗三種，靠文案與 `.error-row` 區分，不另做樣式。
- 目前沒有 `role="status"`（G-08），內容替換時報讀器不會主動唸；新用法建議在外層補上。
- 樣式由 sidebar.css 的 `@import` 載入，沒有用 App Shell 的頁面要自己引入 empty-state.css（G-21）。

## 該做／不該做

- 該做：依容器大小挑尺寸類別，不要自己調 padding。
- 該做：篩選無結果時提供清除篩選；真的沒資料時，給建立或返回的路。
- 不該做：只寫「沒有資料」；要講清楚是哪一種空。
- 不該做：為「篩選後沒結果」另做一套樣式。
