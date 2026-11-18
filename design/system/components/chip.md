# Chip

> 正典章節：`MASTER.md` §Chip ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

正典把**兩類**放在同一章節，但它們結構不同：

| 類 | 結構 | 依據 |
| :--- | :--- | :--- |
| 選取 chip | `.task-type-chip-grid` > `<button class="task-type-chip">` > `.task-type-chip-check` ＋ 文字 | `components-showcase.html:473`–`:536` |
| 顯示 chip（唯讀） | 單一 `<span>` | `components-showcase.html:538`–`:583` |

`.task-type-chip-check` 的勾是 `::after` 的兩條 2px 白邊旋轉 −45°（`:518`–`:525`）；radio 模式下改成 6×6 實心圓（`:529`–`:536`）。

## 變體

| class | 類 | 色 |
| :--- | :--- | :--- |
| `.task-type-chip` | 選取，`role="checkbox"` 多選 | token（primary 系列） |
| `.task-type-chip[role="radio"]` | 選取，單選；勾選框改圓形 | 同上 |
| `.ar-classif-chip` | 顯示，分類結果 | **寫死** violet-100／800／200 |
| `.ar-va-chip` ＋ `-normal`／`-outlier` | 顯示，數值與離群標記，`--font-mono` | **寫死** 綠／紅各三色 |
| `.round-metric-chip` | 顯示，指標 | token |
| `.cause-chip` | 顯示，原因標籤 | token |

依據：`components-showcase.html:478`、`:526`、`:539`、`:549`、`:561`、`:573`。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `components-showcase.html:478` |
| hover | 有（僅選取 chip）：邊框與文字換 primary、底色 `--color-primary-soft-bg` | `components-showcase.html:493` |
| 選中 | 有：同 hover 的色，字重升到 600，勾選框填滿 | `components-showcase.html:498`、`:514` |
| focus | **未觀察到**。`.task-type-chip` 是 `<button>`，但沒有 `:focus` 或 `:focus-visible` 規則 | 以 `:focus` 掃 `:473`–`:583`，0 命中 → `../design-gaps.md` G-05 |
| disabled | **未觀察到** | 同上，無 `:disabled` |
| 載入中／錯誤／空 | 不適用 | — |

## token

`--color-border`、`--color-primary`、`--color-primary-soft-bg`、`--color-primary-border`、`--color-ink`、`--color-white`、`--color-text-soft`、`--radius-full`、`--dur-fast`、`--font-mono`。

顯示 chip 共寫死 **9 個**色值（`components-showcase.html:545`–`:560`），原值見 `../design-gaps.md` G-02。
另有三處圓角寫 `9999px`／`999px` 字面值而不是 `--radius-full`（`:542`、`:553`、`:566`），同一個章節內三種寫法並存。

## 鍵盤與焦點

選取 chip 是原生 `<button>`，Tab 可達、Enter／Space 原生觸發 `click`，並帶 `role="checkbox"`／`role="radio"` 與 `aria-checked`（`components-showcase.html:1152`、`:1159`）。容器帶 `role="group"`／`role="radiogroup"` 與 `aria-label`（`:1151`、`:1158`）。

行為由腳本維持：`components-showcase.html:1541`–`:1558`，註解自稱「§Chip accessibility contract: aria-checked toggled on click」。checkbox 各自切換（`:1546`），radio 則把同組其他的設回 false（`:1555`）。

兩個缺口：**沒有焦點樣式**（見上）；`role="radiogroup"` 只綁 `click`（`:1554`），**沒有方向鍵巡覽**，而 radio group 的鍵盤契約是左右鍵切換、整組只佔一個 Tab 位。

## 樣式出處

`design/prototype/components-showcase.html:472`–`:583`。shipped 的那一份在 `pages/task-management/task-config.css`（b2）。

## 可重現樣本

`components-showcase#state-default` → `#comp-chips`（`components-showcase.html:1147`）：三組 demo——多選（`:1151`）、單選（`:1158`）、五種唯讀顯示 chip（`:1164`–`:1168`）。

## shadcn 對照

候選原語：選取 chip 對 `ToggleGroup`（`type="multiple"`／`"single"`），顯示 chip 對 `Badge`。

- **我們有而它沒有**：chip 內建的勾選框（checkbox 方形／radio 圓形）。
- **它有而我們沒有**：`ToggleGroup` 的方向鍵巡覽與 roving tabindex、focus ring。
- **語意對不上**：正典把「可點的選取器」與「唯讀標籤」收進同一個 §Chip，但前者該是 ToggleGroup、後者該是 Badge——這個章節其實是兩個元件 → `../design-gaps.md` G-11。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 兩類全部樣本 |
| `task-management/task-new#state-step2` | `.task-type-chip`（`task-config.css:556`–`:559`），引擎依情境發 `role="checkbox"` 或 `"radio"` 與 `aria-checked`（`task-config.engine.js:6235`–`:6239`） |
| `task-management/task-detail#tab-settings` | 同一份，`settings.html:74`、`:78` |

b1 的帳號頁一個都沒用。b2 已補上（見上表）。
