# Date Range Picker

> 正典章節：`MASTER.md` 無對應章節（`shared/date-range-picker.*` 自己是來源）｜契約 `openspec/changes/1101-work-log-date-range-picker/design.md` D1–D3 ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

觸發鈕留在頁面裡，彈出層由腳本建立。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.date-range-trigger`（最小寬 220px）＞ `.date-range-trigger-text`（溢出省略） | 必填，由頁面提供 | `pages/shared/date-range-picker.css:2`–`:9` |
| `.date-range-popover`（280px，`--z-dropdown`，`[hidden]` 時 `display: none`） | 腳本建立 | `:11`–`:16` |
| `.date-range-popover-header` ＋ `.date-range-nav-prev`／`-next` ＋ `.date-range-month-label` | 腳本建立 | `:17`–`:23` |
| `.date-range-grid` ＞ `.date-range-day` ×n | 腳本建立 | `:25`–`:31` |
| `.date-range-popover-footer` ＞ `.date-range-clear` | 腳本建立 | `:38`–`:43` |

## 變體

只有一種版式。日期格子有四個修飾狀態（見下）。

掛載 API（`date-range-picker.js:6`–`:10`）：

```js
var h = window.DateRangePicker.mount(triggerEl, {
  value: { from, to },          // 兩端都可以是 null
  lang: 'zh' | 'en',
  onChange: function (range) {}
});
h.setLang('en'); h.setValue({ from: null, to: null }); h.destroy();
```

**支援單端開放區間**：只給 `from` 顯示「<日期> ～ 不限」，只給 `to` 顯示「不限 ～ <日期>」（`date-range-picker.js:16`–`:17`，英文版 `:20`–`:21`）。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 收合（預設） | 有，`[hidden]` | `date-range-picker.css:16` |
| 展開 | 有 | 腳本切 `hidden` |
| hover | 有，日期格與上下月鈕都換 `--color-primary-soft-bg` | `:22`、`:32` |
| focus | **有**。trigger 與日期格都畫 2px primary outline、`outline-offset: 1px` | `:8`、`:33` — b1 第二個有焦點樣式的元件（另一個是 [Avatar](avatar.md)） |
| 今天 | 有，`.is-today` 以 `--color-primary` 畫框（`--color-primary-border` 只有 1.49:1，不能是唯一的提示） | `:34` |
| 區間內 | 有，`.is-in-range` 柔底、**圓角拉平**成連續色帶 | `:35` |
| 區間端點 | 有，`.is-range-start`／`.is-range-end` 實心 primary | `:36` |
| disabled／載入中／錯誤／空 | 未觀察到 | 全檔無 `:disabled` |

## token

`--color-white`、`--color-border`、`--color-ink`、`--color-primary`、`--color-primary-strong`、`--color-primary-soft-bg`、`--color-on-cta`、`--radius-md`、`--radius-sm`、`--shadow-lg`、`--z-dropdown`、`--space-sm`、`--space-xs`、`--font-sans`。

檔頭註解明寫「Tokens from assets/tokens.css only」（`date-range-picker.css:1`），**全檔沒有任何寫死色值**——b1 唯一做到這件事的共用 CSS。

## 鍵盤與焦點

這是 b1 鍵盤支援最完整的元件。

| 行為 | 依據 |
| :--- | :--- |
| Escape 關閉並把焦點還回 trigger | `date-range-picker.js:190` |
| ←／→ 移動一天，↑／↓ 移動一週 | `:191`–`:194` |
| roving tabindex：只有聚焦中的那一天 `tabindex="0"`，其餘 `-1` | `:119` |
| 移動後把焦點帶過去 | `focusCurrentDay()`，`:131` |
| Enter 與 Space 都靠原生 `<button>` 的 click | `:196` 的註解 |

ARIA：popover 是 `role="dialog"` ＋ `aria-modal="false"`（`:48`–`:49`），trigger 帶 `aria-haspopup="dialog"`、`aria-controls`、`aria-expanded`（`:59`–`:61`，開關時同步於 `:170`／`:178`），格子是 `role="row"`（`:108`）＋ `role="gridcell"`（`:120`），端點帶 `aria-selected="true"`（`:121`）。上下月鈕與對話框的 `aria-label` 隨語言換（`applyStrings()`，`:70`–`:74`）。

## 樣式出處

`design/prototype/pages/shared/date-range-picker.css:1`–`:43`、`design/prototype/pages/shared/date-range-picker.js:1`–`:221`。

## 可重現樣本

`components-showcase#state-default` → `#comp-date-range-picker`（`components-showcase.html:1059`），trigger 在 `:1063`。**這是 showcase 唯一 `<link>` 進來的共用 CSS**（`components-showcase.html:11`），其餘元件都是把 CSS 抄進 `<style>`；demo 的掛載在 `:1380`–`:1389`。

## shadcn 對照

候選原語 `Calendar`（react-day-picker）＋ `Popover`。

- **我們有而它沒有**：單端開放區間（「～ 不限」）、中英雙語字串、`setLang` 的執行期切換。
- **它有而我們沒有**：月份／年份下拉、禁用日期、多月並排、本地化套件。
- **語意對不上**：shadcn 把日曆與彈出層拆成兩個原語自由組合；我們的 `mount()` 是一個封裝好的整體，trigger 必須是頁面上既有的元素。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 可實際操作的 demo |
| `task-management/task-detail#tab-work-log` | `.date-range-trigger`（`work-log.html:7`，`aria-haspopup="dialog"`）；`task-detail.html:12` 載 CSS、`:1923` 載 JS |

b2 已補上（見上表）。
