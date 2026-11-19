# Metric KPI Tile

> 正典章節：`MASTER.md` §Metric KPI Tile ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.metric` 容器 | 必填 | `pages/shared/metric.css:2`、`components-showcase.html:814` |
| `<span>` 標籤（11px 大寫、字距 0.04em） | 必填 | `metric.css:9`、`components-showcase.html:820` |
| `<strong>` 數值（1.35rem／700） | 必填 | `metric.css:19`、`components-showcase.html:829` |
| `.metric-desc` 說明行 | 選用 | **只有** `metric.css:27`（issue `singyichen/label-suite#1453`）；正典區塊沒有 |

結構用的是**元素選擇器**（`.metric span`、`.metric strong`）而不是 class，所以磚裡不能再放別的 `span`。

## 變體

| class | 差別 | 依據 |
| :--- | :--- | :--- |
| `.metric` | 標準，數值 1.35rem | `metric.css:2` |
| `.metric-lg` | 單獨站著的大 KPI，數值 2.5rem | `metric.css:35` |

`.metric-grid`（`repeat(auto-fit, minmax(100px, 1fr))`）**不是正典**，是 showcase 自己的示範外框（`components-showcase.html:965`–`:972` 的註解明寫）。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `metric.css:2` |
| hover／focus／disabled／錯誤 | 不適用，非互動元素 | `metric.css` 全檔無偽類 |
| 載入中 | 未觀察到專屬樣式；載入中用 [Skeleton](skeleton.md) 取代整塊 | — |
| 空（無資料） | 未觀察到。沒有「—」或「尚無資料」的樣式 | — |

## token

`--space-md`、`--radius-lg`、`--color-white`、`--color-border`、`--color-ink-muted`、`--color-text-soft`。

字級 11px／1.35rem／2.5rem／12px 與字距 0.04em 是字面值，不是 `--text-*`。

## 鍵盤與焦點

不可聚焦，沒有 ARIA。數值與標籤的關聯只靠視覺鄰近。

## 樣式出處

`design/prototype/pages/shared/metric.css:1`–`:37`（shipped，含 `.metric-desc` 與 `.metric-lg`）、`design/prototype/components-showcase.html:813`–`:832`（正典，只有基礎三條）。

**兩份不一致**：shipped 多了 `.metric-desc` 與 `.metric-lg`；正典少了 `display: block`，showcase 只好在非正典的 chrome 區塊補回來（`components-showcase.html:974`–`:977` 的註解明寫是為了讓正典區塊保持 verbatim）→ `../design-gaps.md` G-19。

## 可重現樣本

`components-showcase#state-default` → `#comp-metric`（`components-showcase.html:1326`），三塊磚在 `:1331`–`:1333`。

## shadcn 對照

候選原語 `Card`（`CardHeader` ＋ `CardTitle` ＋ `CardContent`）。

- **我們有而它沒有**：`.metric-lg` 的 hero 尺寸、`.metric-desc` 的第三行。
- **它有而我們沒有**：結構 class（我們用元素選擇器）、`CardFooter`。
- **語意對不上**：shadcn 沒有 KPI 磚這個語意，通常是 `Card` 自組；我們的 `.metric` 是固定三段式，換不了順序。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 四塊樣本 |
| `dashboard/dashboard`（五個 `#param-scenario-*`、`#param-view-skeleton`） | `.metric`（22 處），`dashboard.layout.css:1` `@import` 正典 `metric.css`；骨架期間 `.metric` 裡放 `.skel-metric` |
| `task-management/task-detail`（`#tab-overview`、`#tab-annotation-progress`、`#tab-work-log`） | `overview.html` 4 處、`annotation-progress.html` 6 處、`work-log.html` 4 處；`task-detail.html:1076` 加了 `.metric strong.speed-by-kind` |
| `dataset/dataset-analysis-detail`（`#tab-stats`、`#state-stats-empty`、`#state-stats-entity-recognition`、`#state-stats-sequence-tagging`、`#state-stats-relation-identification`） | 共用指標五塊 `.metric`（`dataset-analysis-detail.html:270`–`:274`），統計空狀態時三塊換成破折號（`applyStatsState`，`:1465`）；三個 stats partial 另有 `.metric`／`.metric-lg` |

b1 的帳號頁一個都沒用。b2 已補上（見上表）。b4 已補上（見上表）。
