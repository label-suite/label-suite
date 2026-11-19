# `dataset/dataset-analysis-detail`

> 批次 `b4-dataset-sweep` ｜規格 [`docs/specs/05-dataset/02-analysis-detail.mdx`](../../../docs/specs/05-dataset/02-analysis-detail.mdx) ｜檔案 `design/prototype/pages/dataset/dataset-analysis-detail.html`（2541 行）＋ `dataset-analysis-detail.partials/` 十六個 partial（`quality-*` 八個、`stats-*` 八個）｜交付包 commit `eb9a884`

## 入口

`dataset/dataset-analysis-list` 點一列（帶 `task_id`）。

載入：`assets/tokens.css`、`assets/data-palette.css`（`:10`，#438 補上，實體色點的 `--data-entity-N` 才有值）、`pages/shared/sidebar.css`、`button.css`（`:12`）、`card.css`（`:13`）、`empty-state.css`（`:14`）、`content-tabs.css`（`:15`）、`metric.css`（`:16`）；腳本 `sidebar.js`（`:222`）、`theme.js`、`analytics.js`，以及任務管理與標記的資料腳本（`:351`–`:354`）。**沒有任何 modal**。本頁在 `<style>` 定義了 `--navbar-mobile-height`／`--navbar-mobile-top-height`（`:25`），G-24 在本頁不成立。

兩個分頁的型別內容由 `loadStatsPanel`（`:1437`）與 `loadQualityPanel`（`:2288`）依任務的第一個輸出類型，從 `STATS_PANEL_PATHS`／`QUALITY_PANEL_PATHS`（`:1116`–`:1135`）載入。

**角色閘門**：`task_id` 缺值、不認得，或這個帳號在該任務是標記員（`TASK_ROLES_ALLOWED = ['project_leader','reviewer']`，`:1163`），一律導回 `dataset-analysis-list.html?invalid_task=1`（`:2478`–`:2471`），看到的是 `dataset/dataset-analysis-list#param-invalid-task`。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#tab-stats` | 帶合法 `task_id`（預設分頁） | [App Shell](../components/app-shell.md)、[Breadcrumb](../components/breadcrumb.md)（`nav.breadcrumb`，`:249`–`:253`）、[Content Tabs](../components/content-tabs.md)（`.admin-tabs role="tablist"`，`:256`–`:258`）、[Card](../components/card.md)（本頁 `.panel`，`:49`）、[Metric KPI Tile](../components/metric.md)（共用指標五塊，`:269`–`:273`） |
| `#tab-quality` | `?tab=quality`，或點「品質監控」（`switchTab`，`:2441`） | [Content Tabs](../components/content-tabs.md)、[Card](../components/card.md)、[Badge](../components/badge.md)（`#iaaSummaryBadge`）、[Data Table](../components/data-table.md)（標記員修改率 `.annotator-table`，`:321`–`:340`） |
| `#state-stats-single-label`、`#state-stats-multi-label`、`#state-stats-single-dim`、`#state-stats-multi-dim`、`#state-stats-entity-recognition`、`#state-stats-relation-identification`、`#state-stats-sequence-tagging`、`#state-stats-free-text` | 帶該輸出類型的 `task_id`，統計分頁載入 `stats-<型別>.html` | [Card](../components/card.md)（`.panel`）、本頁的長條圖與共現矩陣（`.stats-hbar-*`、`.stats-comatrix-*`，`:189`–`:202`）；`entity_recognition`、`sequence_tagging`、`relation_identification` 另有 [Metric KPI Tile](../components/metric.md)（`.metric`／`.metric-lg`）；`single_dim`、`multi_dim` 用 [Divider](../components/divider.md)（`hr.panel-divider`，`:54`；`stats-single_dim.html:27`、`stats-multi_dim.html:61`） |
| `#state-stats-empty` | `?s_state=empty`（`applyStatsState`，`:1465`） | [Empty State](../components/empty-state.md)（`#statsEmpty`，`empty-state-panel`，`:281`）、[Button](../components/button.md)（`.btn.btn-secondary.btn-sm` 連到任務詳情）；共用指標仍顯示，三塊需要提交的指標換成破折號（#155 Q6，維護者 2026-11-08） |
| `#state-quality-single-label`、`#state-quality-multi-label`、`#state-quality-single-dim`、`#state-quality-multi-dim`、`#state-quality-entity-recognition`、`#state-quality-relation-identification`、`#state-quality-sequence-tagging`、`#state-quality-free-text` | 帶該輸出類型的 `task_id` 並加 `?tab=quality`，載入 `quality-<型別>.html` | [Card](../components/card.md)、[Badge](../components/badge.md)（`.badge-pass`／`-fail`／`-warn`／`-neutral`，`:57`–`:62`；`.risk-level-badge`，`:149`–`:153`）、[Progress Bar](../components/progress-bar.md)（本頁 `.iaa-bar-wrap`／`.iaa-bar-fill`，`:83`–`:87`）、[Color Dot](../components/color-dot.md)（本頁 `.t-dot`，`:91`–`:94`）、[Accordion](../components/accordion.md)（替代指標的 `.alt-toggle-btn`／`.alt-metrics-body`，`:111`–`:116`；`wireAltToggle`，`:1914`）、[Chip](../components/chip.md)（`.cause-chip`，`:156`）、[Data Table](../components/data-table.md)（`.annotator-table`）、[Button](../components/button.md)（`.risk-action-btn.btn.btn-secondary.btn-sm`）；`single_label`、`multi_label`、`single_dim`、`relation_identification` 另有 [Empty State](../components/empty-state.md)（`empty-state-panel empty-state-compact`）；`free_text` 只有一段不適用說明（`quality-free_text.html`，9 行） |
| `#state-seq-match-strict` | 見下方「交付包的重現方式與畫面不符」 | 本頁的切換鈕 `.match-toggle`／`.match-btn`（`:105`–`:108`；`syncSequenceUi`，`:1942`）、[Card](../components/card.md) |
| `#state-seq-match-partial` | 同上，點 `#matchPartial` | 同上 |
| `#param-q-state-ready` | `?tab=quality&q_state=ready`（預設） | 同 `#state-quality-*` |
| `#param-q-state-dry-run-in-progress`、`#param-q-state-report-pending`、`#param-q-state-report-generating` | `?tab=quality&q_state=<狀態>`（`applyQualityState`，`:2382`） | [Empty State](../components/empty-state.md)（`#qualityEmpty`，`empty-state-panel`，`:299`；文案依狀態取 `emptyStateMsgs`）、[Badge](../components/badge.md)（`.badge.iaa-summary-badge.badge-neutral`）、[Button](../components/button.md) |
| `#param-q-state-report-failed` | `?tab=quality&q_state=report_failed` | `renderPanelLoadError(mount,'calc')`（`:1503`）：[Card](../components/card.md)（`.panel.panel-load-error`，`aria-live="polite"`，`:1510`）＋ [Button](../components/button.md)（`.btn.btn-secondary.btn-sm` 重試） |

`q_state`、`s_state` 是**原型專用**的示範開關，維護者 2026-11-10 裁定不得帶進實作（`:2414`–`:2422` 的註解）。

**交付包的重現方式與畫面不符**：交付包寫「在序列標註任務的統計總覽點 `#matchStrict`」，但 `#matchStrict`／`#matchPartial`／`#seqStrictCard`／`#seqPartialCard` 只出現在 `quality-entity_recognition.html:11`–`:30`，也就是**實體辨識任務的品質監控**；序列標註與統計總覽都沒有這組切換。照規格 §八種輸出類型各自的主指標與門檻（表格的實體辨識列與第 5 條），切換本來就屬實體辨識。換成「帶實體辨識任務、`?tab=quality`」即可重現，所以不算無法重現 → `../design-gaps.md` G-52。

**「部分重疊」的 0.70 與關係識別的 0.80 改叫參考值**（#423）：實體辨識切到 `Partial overlap` 時卡片寫「Relaxed 參考值 0.70」（`quality-entity_recognition.html:42`），關係識別第二列寫「高品質參考值 0.80」（`quality-relation_identification.html:24`），兩者都不帶通過／未達，圓點用中性的 `.t-dot-neutral`；部分重疊卡的數值與長條也改中性色。「兩種計算模式比較」表頭改「門檻／參考值」，部分重疊那一列的結果是中性徽章「不判定」，Strict 那一列照舊判定。依據規格 §八種輸出類型各自的主指標與門檻 第 11 條（Q15，維護者 2026-11-08）→ `../design-gaps.md` G-53。

另外找得到但交付包沒有列的：partial 讀取失敗的面板（`renderPanelLoadError(mount,'load')`，`:1503`），只有讓 partial 請求失敗才看得到 → `../design-gaps.md` G-54。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.panel`（`:52`） | 容器在 `pages/shared/card.css`，本頁只加 `margin-bottom`（#423）→ [Card](../components/card.md)、G-41 |
| `.btn` 覆寫（`:168`–`:174`） | 載入正典 `button.css` 後又在頁內用零特異性重寫 → G-37 |
| `.badge*`（`:57`–`:62`）、`.risk-level-badge`（`:149`–`:153`） | 本頁重寫的徽章，全用 token → [Badge](../components/badge.md) |
| `.iaa-score-card`（`:73`–`:76`）、`.iaa-bar-*`（`:83`–`:87`） | 達標分數卡與分數條；分數條沒有 `role="progressbar"`，數字在旁邊的文字 → [Progress Bar](../components/progress-bar.md) |
| `.t-dot`（`:94`–`:98`） | 與 Color Dot 同用途的圓點，只靠顏色；#423 加了不判定用的 `.t-dot-neutral`（`--color-ink-muted`）→ [Color Dot](../components/color-dot.md)、G-14 |
| `.match-toggle`／`.match-btn`（`:105`–`:108`） | 分段切換鈕，只此一頁；用 `.active` 表示目前選項；已於 #422 補上 `aria-pressed` 並與 `.active` 同步 → G-56 |
| `.alt-toggle-btn`／`.alt-metrics-body`（`:111`–`:116`） | 原生 `<button>`，帶 `aria-expanded`／`aria-controls`（例如 `quality-single_label.html:24`），收合時 body 設 `aria-hidden`（`wireAltToggle`，`:1914`）→ [Accordion](../components/accordion.md) |
| `.anomaly-item`（`:129`） | 異常提示列，用 warning token |
| `.annotator-table`（`:137`–`:141`） | 第 N 份表格樣式 → [Data Table](../components/data-table.md)、G-10 |
| `.cause-chip`（`:156`） | 唯讀的原因標籤 → [Chip](../components/chip.md)、G-11 |
| `.risk-action-btn[disabled]`（`:162`） | 非專案負責人時 `syncRoleUi`（`:1543`）停用 `[data-role-action]` 並顯示 `[data-role-note]`；按下由 `:1555`–`:1562` 導到任務詳情的成員管理，或以審核員身分帶 `dry_run` 進標記清單 |
| `.stats-hbar-*`、`.stats-comatrix-*`（`:189`–`:202`） | 統計圖表，全用 token，只此一頁 |
| ~~`.toast*`~~ | #423 已刪：原本有樣式、markup 與關閉鈕的處理，卻沒有任何程式會顯示它。本頁沒有需要通知的操作 → [Toast](../components/toast.md)、G-55 |

十六個 partial 沒有寫死的 hex 或 rgba：SVG 的 `fill`／`stroke` 與 inline `style` 全部用 `var(--color-*)`、`var(--space-*)`。inline `style` 很多（`quality-entity_recognition.html` 26 處、`quality-sequence_tagging.html` 26 處、`stats-entity_recognition.html` 20 處），平均標記時間那一塊另有一個寫死的字級（`:286` 的 `<small>`）→ G-02。

分頁有 `role="tablist"`／`tab`／`tabpanel` 與 `aria-selected`、`aria-controls`，但只能點，沒有方向鍵（`:2437`–`:2442`）→ G-22。

## 業務行為

連回規格 [`05-dataset/02-analysis-detail.mdx`](../../../docs/specs/05-dataset/02-analysis-detail.mdx)。UXC 落點：UXC-09（統計與品質兩種空狀態，`:281`、`:300`）、UXC-11（`syncUrlState` 只從狀態組網址，`:2425`；#155 Q4，維護者 2026-11-08）。
