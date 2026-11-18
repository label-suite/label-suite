# Color Dot

> 正典章節：`MASTER.md` §Color Dot ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

單一空 `<span>`，**顏色一律以 inline `style="background: …"` 套用**（`components-showcase.html:1239` 的說明）。class 只決定尺寸與形狀。

## 變體

| class | 尺寸 | 形狀 | 用途 |
| :--- | :--- | :--- | :--- |
| `.entity-color-dot` | 20×20 | `--radius-sm` 圓角方 | 表單的實體類型列 |
| `.annotation-preview-color` | 12×12 | `3px` 圓角（字面值，不是 token） | 標記預覽 |
| `.t-dot` | 8×8 | `50%` 正圓 | 狀態圓點（IAA 門檻過或沒過；`.t-dot-neutral` 標不判定的參考值，#423） |

依據：`components-showcase.html:720`、`:729`、`:739`。

**預設 8 色盤**在 `components-showcase.html:1242`–`:1249`，註解標「hex values verbatim from MASTER §Color Dot」。這 8 個值 `tokens.css` 一個都沒有；原值見 `../design-gaps.md` G-02。它們比較像**資料色**（指派給實體類型）而不是語意色，所以該不該 token 化本身就是 G-02 的待決問題之一。

`.t-dot` 的樣本反而用 token（`var(--color-success)`／`var(--color-error)`，`:1255`–`:1256`）——同一個元件的三個變體，兩種取色方式。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `components-showcase.html:720` |
| hover／focus／disabled／載入中／錯誤 | 不適用，非互動元素 | `:719`–`:739` 無任何偽類 |
| 空 | 未觀察到。沒有「沒有指派顏色」的樣式 | — |

## token

`--radius-sm`（只有 `.entity-color-dot`）。邊框是 `rgba(0,0,0,0.1)`／`rgba(0,0,0,0.12)` 兩個寫死值，深色模式下不會變。

## 鍵盤與焦點

不可聚焦。樣本用 `title` 屬性帶色碼或語意（`:1242`、`:1255`），**不是 `aria-label`**——`title` 在觸控裝置上看不到，而顏色是唯一的訊號 → `../design-gaps.md` G-14。

## 樣式出處

`design/prototype/components-showcase.html:719`–`:739`。`.t-dot` 的註解寫明它是從 `dataset-analysis-detail.html` 抄回來的 shipped CSS（`:737`–`:738`）。

## 可重現樣本

`components-showcase#state-default` → `#comp-colordot`（`components-showcase.html:1237`）：第一列 8 色盤，第二列三個預覽加兩個狀態點。

## shadcn 對照

沒有對應原語。shadcn 沒有 color swatch／status dot 這一類元件。

- **我們有而它沒有**：整個元件。
- **它有而我們沒有**：無。
- **語意對不上**：不適用。若要對映，`.t-dot` 比較接近 `Badge` 的一個無文字變體，但 shadcn 沒有。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 三個變體 |
| `task-management/task-new#state-step2`、`task-management/task-detail#tab-settings` | **不是正典的 `.color-dot`**：`task-config.css` 的 `.entity-color-dot`（`:169`，20px 方形 `--radius-sm`）與 `.annotation-preview-color`（`:424`，12px），邊框寫死 rgba（`:169`、`:578`–`:579`）；`task-detail.html:1180` 又定義一次 `.entity-color-dot` → `../design-gaps.md` G-10 |
| `dataset/dataset-analysis-detail`（`#state-quality-*`） | **不是正典的 `.color-dot`**：本頁 `.t-dot`（`dataset-analysis-detail.html:93`–`:97`），同樣只靠顏色 → `../design-gaps.md` G-14 |

b1 的帳號頁一個都沒用。b2 已補上（見上表）。b4 已補上（見上表）。
