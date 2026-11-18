# Accordion

> 正典章節：`MASTER.md` §Accordion ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.output-accordion` 外框（`overflow: hidden`） | 必填 | `components-showcase.html:742` |
| `.output-accordion-header`（`role="button"`、`tabindex="0"`、`aria-expanded`、`aria-controls`） | 必填 | `:752`、樣本 `:1288` |
| `.output-accordion-number` 序號 | 選用 | 樣本 `:1289`，**CSS 沒有這個 class 的規則** |
| `.output-accordion-title` 標題 | 必填 | 樣本 `:1290`，同樣沒有 CSS 規則 |
| `.output-accordion-chevron` 箭頭（`margin-left: auto` 推到右側） | 必填 | `:770`、樣本 `:1292` |
| `.output-accordion-body`（`role="region"`、`aria-label`、`id` 對應 `aria-controls`） | 必填 | `:782`、樣本 `:1294` |

兩個 `.output-accordion-*` 的 class 出現在樣本裡但**正典 CSS 沒有定義**（`-number`、`-title`），它們的樣式來自 header 的 `font-size: 14px; font-weight: 600` → `../design-gaps.md` G-15。

箭頭 svg 的 path 是從 `assets/icons/chevron-down.svg` 內嵌的，註解寫明依據是 ADR-030 的 reuse-only（`:1291`）。

## 變體

只有展開與收合兩種，由 `.collapsed` 切換；**多個面板可同時展開**（`:1284` 的說明），不是互斥的手風琴。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 展開（預設） | 有 | `components-showcase.html:742` |
| 收合 | 有。`.collapsed` 讓 body `display: none`、箭頭轉 −90° | `:778`、`:787` |
| hover | 有，header 底色換 `--color-primary-soft-bg` | `:766` |
| focus | **未觀察到**。header 有 `tabindex="0"`、聚焦得到也按得動，但沒有任何 `:focus` 樣式 | 以 `:focus` 掃 `:741`–`:789`，0 命中 → `../design-gaps.md` G-05 |
| disabled／載入中／錯誤／空 | 不適用 | — |

## token

`--color-border`、`--color-slate-50`、`--color-primary-soft-bg`、`--color-ink`、`--color-text-soft`、`--radius-md`、`--space-sm`、`--space-md`、`--dur-fast`。內距 `12px var(--space-md)` 混用字面值與 token。

## 鍵盤與焦點

header 是 `<div role="button" tabindex="0">` 而不是 `<button>`，原生的 Enter／Space 不會觸發 `click`，所以行為由腳本補齊：`components-showcase.html:1562`–`:1574` 對每個 header 綁 `click`，另綁 `keydown` 攔 `Enter` 與 `Space`（`:1569`），切換 `.collapsed` 並同步 `aria-expanded`（`:1565`）。面板彼此獨立。

唯一缺的是**焦點樣式**（見上）：鍵盤使用者聚焦到 header 時沒有可見指示。

## 樣式出處

`design/prototype/components-showcase.html:741`–`:789`。shipped 的那一份在 `pages/task-management/task-config.css`（b2）。

## 可重現樣本

`components-showcase#state-default` → `#comp-accordion`（`components-showcase.html:1282`）：第一個展開（`aria-expanded="true"`），第二個收合。兩者都是**可操作的**——點或按 Enter／Space 會真的切換。

## shadcn 對照

候選原語 `Accordion`（`AccordionItem`、`AccordionTrigger`、`AccordionContent`）。

- **我們有而它沒有**：序號欄位（`-number`）。
- **它有而我們沒有**：方向鍵在 header 之間巡覽、展開收合的高度動畫、`type="single"` 的互斥模式、focus ring、原生 `<button>` 的 trigger。
- **語意對不上**：shadcn 的 trigger 是 `<button>`，鍵盤行為免費得到；我們是 `div[role=button]` 加手寫的 `keydown`，等於把原生行為重做了一次。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 兩個靜態面板 |
| `task-management/task-new#state-step2` | 輸出設定的 `.output-accordion`（`task-config.css:463`–`:470`）。標頭是原生 `<button>`，帶 `aria-expanded` 與 `aria-controls`（`task-config.engine.js:633`–`:676`），**比正典的 `div[role=button]` 完整** |
| `task-management/task-detail#tab-settings`（及 `#param-section-labeling`） | 同一份 `task-config.css`／`task-config.engine.js` |
| `dataset/dataset-analysis-detail`（`#state-quality-*`） | 替代指標的 `.alt-toggle-btn`／`.alt-metrics-body`（`dataset-analysis-detail.html:110`–`:115`）：原生 `<button>`，帶 `aria-expanded`／`aria-controls`（例如 `quality-single_label.html:24`），收合時 body 設 `aria-hidden`（`wireAltToggle`，`:1919`） |

b1 的帳號頁一個都沒用。b2 已補上（見上表）：出貨版的鍵盤靠原生 `<button>`，與正典不同一份。b4 已補上（見上表），同樣是原生 `<button>`，又一份。
