# Card

> 正典章節：原件 `MASTER.md` §Cards（只見於 `pages/dashboard/dashboard.layout.css:171` 的註解，本 repo 無原文）｜批次 `b2-admin-dashboard-task` ｜交付包 commit `eb9a884`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| 容器：`1px solid --color-border`、`--radius-lg`、`--color-white` 底、`--space-lg` 內距 | 必填 | `dashboard.layout.css:172`–`:176`；同樣四條也出現在 `task-detail.html:91`–`:95` 的 `.panel` 與 `task-new.html:51` 的 `.form-card` |
| `.panel-header`（標題與動作分置兩端） | 選用 | `dashboard.layout.css:183` |
| `.panel-title`（1.05rem／600） | 選用 | `:190` |
| `.panel-subtitle`（`--color-ink-muted`、0.875rem） | 選用 | `:197` |
| `.form-card-title`（16px／600，下緣一條 `--color-border` 分隔線） | 選用，只在 `.form-card` | `task-new.html:52` |

**卡片沒有共用檔**：同一組四條規則在三個地方各寫一次，class 名有三種（`.panel` 兩份同名不同檔、`.form-card`），加上 b1 的 `account/profile` 的 `.section-card` 是第四份、b3 的 `annotation-workspace` 的 `.content-card`（`annotation-workspace.html:248`–`:252`）是第五份 → `../design-gaps.md` G-41。

## 變體

| 變體 | 差別 | 依據 |
| :--- | :--- | :--- |
| `dashboard` 的 `.panel` | 直向 flex、子元素間距 `--space-md`、`min-width: 0` | `dashboard.layout.css:177`–`:180` |
| `task-detail` 的 `.panel` | 只有容器四條 | `task-detail.html:91` |
| `task-new` 的 `.form-card` | 多 `margin-bottom: --space-md` 與帶分隔線的標題 | `task-new.html:51`–`:52` |

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | 同上 |
| hover／focus | 未觀察到（卡片本身不可互動） | 三處定義都沒有 `:hover`／`:focus` |
| 載入中 | 有，由 [Skeleton](skeleton.md) 放進卡片裡 | `dashboard.html:65`–`:77`；`task-detail.html:1964`–`:1975` 的 `.skeleton-card` 沿用同一組容器規則（`:71`–`:75`） |
| 錯誤 | 頁面自理：`dashboard` 換成 `.dashboard-error-state`（同一組容器規則，`dashboard.components.css` 的 Error state 區塊） | `dashboard.html:96` |
| 空 | 由 [Empty State](empty-state.md) 放進卡片裡 | `dashboard.js:431` |

## token

`--color-border`、`--radius-lg`、`--color-white`、`--space-lg`、`--space-md`、`--color-ink`、`--color-ink-muted`。三份定義都沒有寫死的值。

## 鍵盤與焦點

不適用：卡片是容器，不可聚焦。卡片沒有標題語意的保證，`.panel-title` 用什麼標籤由頁面決定。

## 樣式出處

`design/prototype/pages/dashboard/dashboard.layout.css:171`–`:204`（註解自稱 §Cards，視為本元件的參考實作）；`task-detail.html:91`、`task-new.html:51` 各一份。`components-showcase.html` 沒有卡片區塊。

## 可重現樣本

`dashboard/dashboard#state-default`（以及五個 `#param-scenario-*`），`task-management/task-new#state-step1`。

## shadcn 對照

候選原語 `Card`（`CardHeader`、`CardTitle`、`CardDescription`、`CardContent`、`CardFooter`）。

- **我們有而它沒有**：沒有。
- **它有而我們沒有**：`CardFooter`、`CardContent` 的固定內距分區；我們的內距在容器上，內容自己排。
- **語意對不上**：shadcn 的 Card 帶陰影；三份實作都只有邊框、沒有陰影。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `dashboard/dashboard`（全部八個視圖） | `.panel` 是整頁的版面單位 |
| `task-management/task-detail`（`#tab-*`、`#sim-403`、`#state-panel-load-failed`） | 本頁 `.panel`，`taskForbidden`／`taskNotFound` 面板也是它 |
| `task-management/task-new`（`#state-step1`～`#state-step3`） | `.form-card` |
| `annotation/annotation-workspace`（`#role-*`、`#state-arbitration`、`#state-exception-pool`） | 本頁 `.content-card`（`annotation-workspace.html:248`–`:252`），同樣四條規則的第五份 → `../design-gaps.md` G-41 |
| `dataset/dataset-analysis-detail`（全部視圖，含十六個 partial） | 本頁 `.panel`（`dataset-analysis-detail.html:49`），第六份；`renderPanelLoadError` 的 `.panel.panel-load-error`（`:1508`）也是它 → `../design-gaps.md` G-41 |
