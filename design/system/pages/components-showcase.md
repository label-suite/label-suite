# `components-showcase`

> 批次 `b1-shared-account` ｜規格 **無** ｜檔案 `design/prototype/components-showcase.html`（1616 行）｜交付包 commit `b1fd43c`

## 入口

沒有任何頁面連到它；直接開 `design/prototype/components-showcase.html`。

**這一頁是元件正典的來源。**`MASTER.md` 的正典 CSS 被逐字抄進它的 `<style>`（`:139`–`:145` 的註解：「copied verbatim from §Buttons, §Inputs, …；Do not edit here; change MASTER.md first, then re-sync this block」），所以 `design-system-setup` 的元件樣本主要看它。

載入：`assets/tokens.css`、`assets/data-palette.css`（#420）、`pages/shared/date-range-picker.css`／`.js`、`assets/logo/icon-colored.svg`、`assets/google-g.svg`、`assets/icons/chevron-down.svg`。
**`date-range-picker.css` 是它唯一 `<link>` 進來的共用 CSS**（`:11`）；其餘元件都是把 CSS 抄進 `<style>`。

## 視圖與元件

只有一個視圖，但它展示 **20 個元件**。

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 直接開檔 | 下表全部 |

| 區塊（`id`） | 行 | 元件 |
| :--- | ---: | :--- |
| `#comp-buttons` | 1024 | [Button](../components/button.md)（七個 variant ＋ loading ＋ disabled），含只在這裡存在的 `.btn-oauth`；其中 `.btn-language`（`:1034`）是 [Language Toggle](../components/lang-toggle.md) 的正典形式 |
| `#comp-inputs` | 1043 | [Input](../components/input.md)（default／error／readonly ＋ `.field-hint`／`.field-error`） |
| `#comp-date-range-picker` | 1059 | [Date Range Picker](../components/date-range-picker.md)，**可實際操作** |
| `#comp-toggle` | 1069 | [Toggle Switch](../components/toggle-switch.md) |
| `#comp-badges` | 1084 | [Badge](../components/badge.md) ＋ [Status Pill](../components/status-pill.md) |
| `#comp-banner` | 1103 | [Alert Banner](../components/alert-banner.md) |
| `#comp-toast` | 1114 | [Toast](../components/toast.md)，四顆鈕觸發**真實行為** |
| `#comp-skeleton` | 1125 | [Skeleton](../components/skeleton.md)（A pulse ／ B shimmer） |
| `#comp-chips` | 1147 | [Chip](../components/chip.md)（多選／單選／五種唯讀），**可實際點選** |
| `#comp-pagination` | 1172 | [Pagination](../components/pagination.md) |
| `#comp-breadcrumb` | 1200 | [Breadcrumb](../components/breadcrumb.md) |
| `#comp-review-track` | 1212 | [Review Status Track](../components/review-status-track.md) ＋ 三層 Breadcrumb |
| `#comp-colordot` | 1237 | [Color Dot](../components/color-dot.md)（三種尺寸 ＋ 8 色盤） |
| `#comp-divider` | 1260 | [Divider](../components/divider.md)（三種形態） |
| `#comp-accordion` | 1282 | [Accordion](../components/accordion.md)，**可實際展開** |
| `#comp-progress` | 1308 | [Progress Bar](../components/progress-bar.md) |
| `#comp-metric` | 1318 | [Metric KPI Tile](../components/metric.md) |
| `#comp-statepanel` | 1330 | [State Panel](../components/state-panel.md)（success ／ error） |
| `#comp-avatar` | 1354 | [Avatar](../components/avatar.md)，**可實際選檔** |

另有五個 token 區塊（`#palette` `:987` 起，依序是 Palette、State Colors、Typography、Spacing、Radius、Z-index，止於 `:1019`——`:1020` 已是 `#components`），**在執行期從 `assets/tokens.css` 即時列舉**（`:1391`–`:1494`），不是手寫清單——所以 token 一改，這一頁自動跟上。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.showcase-header`／`.showcase-title`／`.showcase-note`／`.theme-toggle`（`:978`–`:983`） | 頁面外框 |
| `.section-heading`／`.section-note`／`.component-card`／`.component-note`／`.component-demo`／`.component-demo--stack`／`.token-grid` | 展示用版面 |
| `.toggle-row`／`.toggle-info`／`.toggle-label-text`／`.toggle-desc`（`:133`–`:136`） | **非正典**，註解明寫 |
| `.demo-col`（`:956`）／`.metric-grid`（`:960`） | **非正典**，註解明寫是示範外框 |

## 業務行為

沒有對應的規格頁，也不該有——它不是產品畫面。

## 本批次對它的核對結果

- 正典區塊宣告涵蓋 15 個 `§` 章節（`:140`–`:144`），加上標為「token-rendered」的 Divider、State Panel、Avatar 與 Status Badges，共 20 個元件。
- **它和出貨的共用 CSS 已經分歧**：`.btn-danger`（G-01）、`.input`（G-04）、`.page-btn.active`（G-12）、`.metric`（G-19）四處。
- **三個 variant 只活在這裡**：`.btn-oauth`、`.btn-language`、`.input[readonly]`，沒有任何出貨頁面使用。
- 五個共用元件**沒有進正典區塊**：[Empty State](../components/empty-state.md)、[Desktop Content Tabs](../components/content-tabs.md)、[Modal](../components/modal.md)、[List Toolbar](../components/list-toolbar.md)、[Data Table](../components/data-table.md)——所以 styleguide 上看不到它們（G-21）。
