# Progress Bar

> 正典章節：`MASTER.md` §Progress Bar ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c` ｜未標檔名的行號指 `design/prototype/components-showcase.html`

## 結構

`.progress` 軌道（6px 高、`--radius-full`、`overflow: hidden`）內含一個 `<span>` 當填充，寬度以 inline `style="width: N%"` 給。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.progress`（樣本帶 `role="progressbar"` 與 `aria-valuenow`／`min`／`max`／`aria-label`） | 必填 | `components-showcase.html:799`、樣本 `:1320` |
| `> span` 填充（樣本為 `<span>`） | 必填 | `components-showcase.html:806`、樣本 `:1321` |

## 變體

**只有一種。**填充色一律 `--color-cta`，說明明寫「無逐狀態色，狀態語意請搭配 Status Badge」（`:1318`）——也就是不要用綠／黃／紅表示健康度。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `components-showcase.html:799` |
| 寬度變化 | 有，`transition: width 300ms ease`（字面值，不是 `--dur-*`） | `:811` |
| hover／focus／disabled | 不適用 | `.progress` 規則 `:800`–`:813` 無偽類 |
| 不確定進度 | **未觀察到**。沒有 indeterminate 樣式或動畫 | — |
| 0%／100% | 未觀察到專屬樣式；0% 時 `<span>` 寬度為 0，軌道仍看得見 | — |

## token

`--radius-full`、`--color-border`（軌道）、`--color-cta`（填充）。

軌道色有一條註解（`:803`）：出貨頁面寫的是字面值、和 `--color-border` 相同，待遷移到 token（issue `singyichen/label-suite#183`）。這條註解已過時：下表各頁的軌道現在都用 token，沒有字面值。

## 鍵盤與焦點

不可聚焦。無障礙全靠樣本 markup 上的 `role="progressbar"` 與 `aria-value*`（`:1320`），**不是元件保證的**——`.progress` 這個 class 本身不帶任何語意。

## 樣式出處

`design/prototype/components-showcase.html:798`–`:811`。`pages/shared/` 沒有 progress 的 CSS 檔。

## 可重現樣本

`components-showcase#state-default` → `#comp-progress`（`components-showcase.html:1316`），65% 的樣本在 `:1316`。

## shadcn 對照

候選原語 `Progress`。

- **我們有而它沒有**：無。
- **它有而我們沒有**：`value` 的受控 API、內建 `role`／`aria-value*`、indeterminate。
- **語意對不上**：shadcn 的 `Progress` 自己發出 ARIA；我們把它留給每個使用端自己寫，所以「有沒有無障礙」是逐頁的，不是元件層的。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 65% 樣本 |
| `dashboard/dashboard`（`#param-scenario-project-leader`、`#param-scenario-annotator`） | `dashboard.components.css:206`–`:241` 的 `.progress`，與正典同名；審核覆蓋率那一條有 `role="progressbar"` 與 `aria-value*`（`dashboard.js:213`–`:218`），一般進度條沒有（`:222`） |
| `annotation/annotation-list#state-default` | 任務資訊卡的本頁 `.progress`（`annotation-list.html:179`–`:191`），全用 token；markup 帶 `aria-hidden="true"`（`:456`），旁邊的文字才是給輔助科技的 |
| `annotation/annotation-workspace`（`#role-*`） | 本頁 `.progress-track`／`.progress-fill`（`annotation-workspace.html:305`–`:316`），尺寸與 token 和正典相同、只換了 class 名；帶 `role="progressbar"` 與 `aria-value*`（`:1240`） |
| `dataset/dataset-analysis-list#state-default` | 完成率欄的本頁 `.progress-track`／`.progress-fill`（`dataset-analysis-list.html:98`–`:107`），全用 token，但軌道是 `--color-border-muted`、填充是 `--color-primary`，與正典的 `--color-border`／`--color-cta` 不同；帶 `role="progressbar"`、`aria-label` 與 `aria-value*`（`dataset-analysis-list.view.js:67`–`:79`） |
| `dataset/dataset-analysis-detail`（`#state-quality-*`） | 達標分數條 `.iaa-bar-wrap`／`.iaa-bar-fill`（`dataset-analysis-detail.html:83`–`:87`），寬度寫在 inline `style`；填充依達標與否換 `--color-success`／`--color-warning`（`.pass`／`.warn`），即正典說不要的逐狀態色；沒有 `role="progressbar"`，數值在旁邊的文字 |

b1 的帳號頁一個都沒用。b2 已補上（見上表）；`task-detail.panels/annotation-progress` 用的是 `.progress-metric-grid`（`annotation-progress.html:8`），不是進度條。b3 已補上（見上表），兩頁各自重寫一份。b4 已補上（見上表），又是兩份。
