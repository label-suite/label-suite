# Progress Bar

> 正典章節：`MASTER.md` §Progress Bar ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

`.progress` 軌道（6px 高、`--radius-full`、`overflow: hidden`）內含一個 `<span>` 當填充，寬度以 inline `style="width: N%"` 給。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.progress`（樣本帶 `role="progressbar"` 與 `aria-valuenow`／`min`／`max`／`aria-label`） | 必填 | `components-showcase.html:792`、樣本 `:1312` |
| `> span` 填充 | 必填 | `components-showcase.html:798`、樣本 `:1313` |

## 變體

**只有一種。**填充色一律 `--color-cta`，說明明寫「無逐狀態色，狀態語意請搭配 Status Badge」（`:1310`）——也就是不要用綠／黃／紅表示健康度。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `components-showcase.html:792` |
| 寬度變化 | 有，`transition: width 300ms ease`（字面值，不是 `--dur-*`） | `:803` |
| hover／focus／disabled | 不適用 | `:791`–`:804` 無偽類 |
| 不確定進度 | **未觀察到**。沒有 indeterminate 樣式或動畫 | — |
| 0%／100% | 未觀察到專屬樣式；0% 時 `<span>` 寬度為 0，軌道仍看得見 | — |

## token

`--radius-full`、`--color-border`（軌道）、`--color-cta`（填充）。

軌道色有一條註解（`:795`）：出貨頁面寫的是字面值、和 `--color-border` 相同，待遷移到 token（issue `singyichen/label-suite#183`）。

## 鍵盤與焦點

不可聚焦。無障礙全靠樣本 markup 上的 `role="progressbar"` 與 `aria-value*`（`:1312`），**不是元件保證的**——`.progress` 這個 class 本身不帶任何語意。

## 樣式出處

`design/prototype/components-showcase.html:791`–`:804`。`pages/shared/` 沒有 progress 的 CSS 檔。

## 可重現樣本

`components-showcase#state-default` → `#comp-progress`（`components-showcase.html:1308`），65% 的樣本在 `:1312`。

## shadcn 對照

候選原語 `Progress`。

- **我們有而它沒有**：無。
- **它有而我們沒有**：`value` 的受控 API、內建 `role`／`aria-value*`、indeterminate。
- **語意對不上**：shadcn 的 `Progress` 自己發出 ARIA；我們把它留給每個使用端自己寫，所以「有沒有無障礙」是逐頁的，不是元件層的。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 65% 樣本 |
| `dashboard/dashboard`（`#param-scenario-project-leader`、`#param-scenario-annotator`） | `dashboard.components.css:235`–`:270` 的 `.progress`，與正典同名；審核覆蓋率那一條有 `role="progressbar"` 與 `aria-value*`（`dashboard.js:213`–`:218`），一般進度條沒有（`:222`） |
| `annotation/annotation-list#state-default` | 任務資訊卡的本頁 `.progress`（`annotation-list.html:176`–`:188`），全用 token；markup 帶 `aria-hidden="true"`（`:485`），旁邊的文字才是給輔助科技的 |
| `annotation/annotation-workspace`（`#role-*`） | 本頁 `.progress-track`／`.progress-fill`（`annotation-workspace.html:307`–`:318`），尺寸與 token 和正典相同、只換了 class 名；帶 `role="progressbar"` 與 `aria-value*`（`:1240`） |

b1 的帳號頁一個都沒用。b2 已補上（見上表）；`task-detail.panels/annotation-progress` 用的是 `.progress-metric-grid`（`annotation-progress.html:8`），不是進度條。b3 已補上（見上表），兩頁各自重寫一份。
