# Card

> 正典章節：原件 `MASTER.md` §Cards（只見於 `pages/dashboard/dashboard.layout.css:171` 的註解，本 repo 無原文）｜批次 `b2-admin-dashboard-task` ｜交付包 commit `eb9a884`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| 容器：`1px solid --color-border`、`--radius-lg`、`--color-white` 底、`--space-lg` 內距 | 必填 | `pages/shared/card.css`（#423 起唯一一份）；`.panel` 是正典 class，`.form-card`、`.section-card`、`.content-card` 是同一個容器的別名 |
| `.panel-header`（標題與動作分置兩端） | 選用，只在 `dashboard` | `dashboard.layout.css:180` |
| `.panel-title`（1.05rem／600） | 選用，只在 `dashboard`；`task-detail` 另有一份 16px 的同名規則（`task-detail.html:96`） | `dashboard.layout.css:187` |
| `.panel-subtitle`（`--color-ink-muted`、0.875rem） | 選用，只在 `dashboard` | `:194` |
| `.form-card-title`（16px／600，下緣一條 `--color-border` 分隔線） | 選用，只在 `.form-card` | `task-new.html:57` |

**共用檔**：容器四條規則原本在六個頁面各寫一份（`dashboard` 與 `task-detail` 的 `.panel`、`task-new` 的 `.form-card`、`account/profile` 的 `.section-card`、`annotation-workspace` 的 `.content-card`、`dataset-analysis-detail` 的 `.panel`）。#423 依維護者 2026-11-18 裁定抽成 `pages/shared/card.css`、以 `.panel` 為準；舊的 class 名保留為別名，頁面只留自己的變體規則 → `../design-gaps.md` G-41。

## 變體

| 變體 | 差別 | 依據 |
| :--- | :--- | :--- |
| `dashboard` 的 `.panel` | 直向 flex、子元素間距 `--space-md`、`min-width: 0` | `dashboard.layout.css:173`–`:178` |
| `task-detail` 的 `.panel` | `margin-bottom: --space-md` | `task-detail.html:95` |
| `task-new` 的 `.form-card` | `margin-bottom: --space-md` 與帶分隔線的標題 | `task-new.html:56`–`:57` |
| `account/profile` 的 `.section-card` | `margin-bottom: --space-lg`，手機版內距縮成 16px | `profile.html:68` |
| `annotation-workspace` 的 `.content-card` | 只有容器四條 | `annotation-workspace.html:251`（只剩指向共用檔的註解） |
| `dataset-analysis-detail` 的 `.panel` | `margin-bottom: --space-md` | `dataset-analysis-detail.html:50` |

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | 同上 |
| hover／focus | 未觀察到（卡片本身不可互動） | 三處定義都沒有 `:hover`／`:focus` |
| 載入中 | 有，由 [Skeleton](skeleton.md) 放進卡片裡 | `dashboard.html:67`–`:79`；`task-detail.html:1890`–`:1901` 的 `.skeleton-card` 沿用同一組容器規則（`:73`–`:77`） |
| 錯誤 | 頁面自理：`dashboard` 換成 `.dashboard-error-state`（同一組容器規則，`dashboard.components.css` 的 Error state 區塊） | `dashboard.html:98` |
| 空 | 由 [Empty State](empty-state.md) 放進卡片裡 | `dashboard.js:431` |

## token

`--color-border`、`--radius-lg`、`--color-white`、`--space-lg`、`--space-md`、`--color-ink`、`--color-ink-muted`。共用檔與各頁變體都沒有寫死的值（`account/profile` 手機版的 16px 內距除外）。

## 鍵盤與焦點

不適用：卡片是容器，不可聚焦。卡片沒有標題語意的保證，`.panel-title` 用什麼標籤由頁面決定。

## 樣式出處

`design/prototype/pages/shared/card.css`（容器，#423 起）；`design/prototype/pages/dashboard/dashboard.layout.css:171`–`:201`（註解自稱 §Cards，儀表板的變體與 `.panel-header`／`-title`／`-subtitle`）。`components-showcase.html` 沒有卡片區塊。

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
| `annotation/annotation-workspace`（`#role-*`、`#state-arbitration`、`#state-exception-pool`） | `.content-card`，共用檔的別名 → `../design-gaps.md` G-41 |
| `dataset/dataset-analysis-detail`（全部視圖，含十六個 partial） | `.panel`，共用檔加本頁的 `margin-bottom`；`renderPanelLoadError` 的 `.panel.panel-load-error`（`:1528`）也是它 → `../design-gaps.md` G-41 |
| `account/profile`（全部視圖） | `.section-card`，共用檔的別名 → `../design-gaps.md` G-41 |
