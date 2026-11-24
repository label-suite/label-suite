# Color Dot

> 正典章節：`MASTER.md` §Color Dot ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c` ｜未標檔名的行號指 `design/prototype/components-showcase.html`

## 結構

單一空 `<span>`，**顏色一律以 inline `style="background: …"` 套用**（`components-showcase.html:1247` 的說明）。class 只決定尺寸與形狀。

## 變體

| class | 尺寸 | 形狀 | 用途 |
| :--- | :--- | :--- | :--- |
| `.entity-color-dot` | 20×20 | `--radius-sm` 圓角方 | 表單的實體類型列 |
| `.annotation-preview-color` | 12×12 | `3px` 圓角（字面值，不是 token） | 標記預覽 |
| `.t-dot` | 8×8 | `50%` 正圓 | 狀態圓點（IAA 門檻過或沒過；`.t-dot-neutral` 標不判定的參考線，#423、#473） |

依據：`components-showcase.html:724`、`:733`、`:746`。

**預設 8 色盤**在 `components-showcase.html:1249`–`:1257`。維護者裁定它們是**資料色**（指派給實體類型），不進 `tokens.css`（#420 Q4）：#420 起改取 `assets/data-palette.css` 的 `--data-entity-1`–`--data-entity-8`，淺色值與 `task-config.data.js` 的 `ENTITY_COLORS` 相同；深色主題另有一組同色相的 400 階（對深色卡片 6:1 以上）。任務設定存的是淺色 hex，引擎上色時經 `entityPaintColor()` 把預設色換成 `var(--data-entity-N)`，所以深色主題換得到；使用者自選、不在色盤裡的顏色照原值畫。原值見 `../design-gaps.md` G-02。

`.t-dot` 的樣本則用 `tokens.css` 的語意 token（`var(--color-success)`／`var(--color-error)`，`:1263`–`:1264`）——同一個元件的三個變體，兩種色源：色盤取資料色，狀態圓點取語意色。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `components-showcase.html:724` |
| hover／focus／disabled／載入中／錯誤 | 不適用，非互動元素 | `.entity-color-dot` 等規則 `:725`–`:748` 無任何偽類 |
| 空 | 未觀察到。沒有「沒有指派顏色」的樣式 | — |

## token

`--radius-sm`（只有 `.entity-color-dot`）。邊框是兩個寫死的半透明黑。#438 起 showcase 的正典也有深色覆寫，改 `color-mix(in srgb, var(--color-ink) 18%, transparent)`（`components-showcase.html:741`–`:743`），黑邊在深色卡片上原本看不見；`task-config.css` 的同名規則本來就有深色覆寫（`task-config.css:580`–`:581`），原本寫死 `rgba(226,232,240,0.18)`，#442 起改成同一個 `--color-ink` 18% 的 `color-mix()`。

## 鍵盤與焦點

不可聚焦。樣本用 `title` 屬性帶色票變數名或語意（`:1251`、`:1264`），**不是 `aria-label`**——`title` 在觸控裝置上看不到，而顏色是唯一的訊號 → `../design-gaps.md` G-14。

## 樣式出處

`design/prototype/components-showcase.html:724`–`:747`。`.t-dot` 的註解寫明它是從 `dataset-analysis-detail.html` 抄回來的 shipped CSS（`:745`–`:746`）。

## 可重現樣本

`components-showcase#state-default` → `#comp-colordot`（`components-showcase.html:1245`）：第一列 8 色盤，第二列三個預覽加兩個狀態點。

## shadcn 對照

沒有對應原語。shadcn 沒有 color swatch／status dot 這一類元件。

- **我們有而它沒有**：整個元件。
- **它有而我們沒有**：無。
- **語意對不上**：不適用。若要對映，`.t-dot` 比較接近 `Badge` 的一個無文字變體，但 shadcn 沒有。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 三個變體 |
| `task-management/task-new#state-step2`、`task-management/task-detail#tab-settings` | **不是正典的 `.color-dot`**：`task-config.css` 的 `.entity-color-dot`（`task-config.css:170`，20px 方形 `--radius-sm`）與 `.annotation-preview-color`（`:424`，12px），淺色邊框寫死 rgba（`:170`），深色覆寫 #442 起改 `--color-ink` 的 `color-mix()`（`:580`–`:581`）；`task-detail.html:1187` 又定義一次 `.entity-color-dot` → `../design-gaps.md` G-10 |
| `dataset/dataset-analysis-detail`（`#state-quality-*`） | **不是正典的 `.color-dot`**：本頁 `.t-dot`（`dataset-analysis-detail.html:92`–`:96`），同樣只靠顏色 → `../design-gaps.md` G-14 |

b1 的帳號頁一個都沒用。b2 已補上（見上表）。b4 已補上（見上表）。
