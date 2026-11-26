# `dataset/dataset-analysis-detail`

> 批次 `b4-dataset-sweep` ｜規格 [`docs/specs/05-dataset/02-analysis-detail.mdx`](../../../docs/specs/05-dataset/02-analysis-detail.mdx) ｜檔案 `design/prototype/pages/dataset/dataset-analysis-detail.html`（2632 行）＋ `dataset-analysis-detail.partials/` 十六個 partial（`quality-*` 八個、`stats-*` 八個）｜交付包 commit `b16b294`（第十三次重跑後重驗，#608）

## 入口

`dataset/dataset-analysis-list` 點一列（帶 `task_id`）。

載入：`assets/tokens.css`、`assets/data-palette.css`（`:10`，#438 補上，實體色點的 `--data-entity-N` 才有值）、`pages/shared/sidebar.css`、`button.css`（`:12`）、`card.css`（`:13`）、`empty-state.css`（`:14`）、`content-tabs.css`（`:15`）、`metric.css`（`:16`）；腳本 `sidebar.js`（`:222`）、`theme.js`、`analytics.js`，以及任務管理與標記的資料腳本 `*.data.js`（`:351`–`:354`）。**沒有任何 modal**。本頁在 `<style>` 定義了 `--navbar-mobile-height`／`--navbar-mobile-top-height`（`:25`），G-24 在本頁不成立。

兩個分頁的型別內容由 `loadStatsPanel`（`:1509`）與 `loadQualityPanel`（`:2375`）依任務的第一個輸出類型，從 `STATS_PANEL_PATHS`／`QUALITY_PANEL_PATHS`（`:1165`–`:1184`）載入。

**角色閘門**：`task_id` 缺值、不認得，或這個帳號在該任務是標記員（`TASK_ROLES_ALLOWED = ['project_leader','reviewer']`，`:1212`），一律導回 `dataset-analysis-list.html?invalid_task=1`（`:2569`–`:2577`），看到的是 `dataset/dataset-analysis-list#param-invalid-task`。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#tab-stats` | 帶合法 `task_id`（預設分頁） | [App Shell](../components/app-shell.md)、[Breadcrumb](../components/breadcrumb.md)（`nav.breadcrumb`，`:250`–`:254`）、[Content Tabs](../components/content-tabs.md)（`.admin-tabs role="tablist"`，`:257`–`:260`）、[Card](../components/card.md)（本頁 `.panel`，`:50`）、[Metric KPI Tile](../components/metric.md)（共用指標五塊，`:270`–`:274`） |
| `#tab-quality` | `?tab=quality`，或點「品質監控」（`switchTab`，`:2528`） | [Content Tabs](../components/content-tabs.md)、[Card](../components/card.md)、[Badge](../components/badge.md)（`#iaaSummaryBadge`）、[Data Table](../components/data-table.md)（標記員被修改率 `.annotator-table`，`:324`–`:340`） |
| `#state-stats-single-label`、`#state-stats-multi-label`、`#state-stats-single-dim`、`#state-stats-multi-dim`、`#state-stats-entity-recognition`、`#state-stats-relation-identification`、`#state-stats-sequence-tagging`、`#state-stats-free-text` | 帶該輸出類型的 `task_id`，統計分頁載入 `stats-<型別>.html` | [Card](../components/card.md)（`.panel`）、本頁的長條圖與共現矩陣（`.stats-hbar-*`、`.stats-comatrix-*`，`:189`–`:202`）；`entity_recognition`、`sequence_tagging`、`relation_identification` 另有 [Metric KPI Tile](../components/metric.md)（`.metric`／`.metric-lg`）；`single_dim`、`multi_dim` 用 [Divider](../components/divider.md)（`hr.panel-divider`，`:54`；`stats-single_dim.html:27`、`stats-multi_dim.html:61`） |
| `#state-stats-empty` | `?s_state=empty`（`applyStatsState`，`:1537`） | [Empty State](../components/empty-state.md)（`#statsEmpty`，`empty-state-panel`，`:281`）、[Button](../components/button.md)（`.btn.btn-secondary.btn-sm` 連到任務詳情）；共用指標仍顯示，三塊需要提交的指標換成破折號（#155 Q6，維護者 2026-11-08） |
| `#state-quality-single-label`、`#state-quality-multi-label`、`#state-quality-single-dim`、`#state-quality-multi-dim`、`#state-quality-entity-recognition`、`#state-quality-relation-identification`、`#state-quality-sequence-tagging`、`#state-quality-free-text` | 帶該輸出類型的 `task_id` 並加 `?tab=quality`，載入 `quality-<型別>.html` | [Card](../components/card.md)、[Badge](../components/badge.md)（`.badge-pass`／`-fail`／`-warn`／`-neutral`，`:58`–`:62`；`.risk-level-badge`，`:150`–`:154`）、[Progress Bar](../components/progress-bar.md)（本頁 `.iaa-bar-wrap`／`.iaa-bar-fill`，`:84`–`:89`）、[Color Dot](../components/color-dot.md)（本頁 `.t-dot`，`:92`–`:96`）、[Accordion](../components/accordion.md)（替代指標的 `.alt-toggle-btn`／`.alt-metrics-body`，`:112`–`:117`；`wireAltToggle`，`:1994`）、[Chip](../components/chip.md)（`.cause-chip`，`:156`）、[Data Table](../components/data-table.md)（`.annotator-table`）、[Button](../components/button.md)（`.risk-action-btn.btn.btn-secondary.btn-sm`）；`single_label`、`multi_label`、`single_dim`、`relation_identification` 另有 [Empty State](../components/empty-state.md)（`empty-state-panel empty-state-compact`）；`free_text` 只有一段不適用說明（`quality-free_text.html`，9 行） |
| `#state-seq-match-strict` | 見下方「交付包的重現方式與畫面不符」 | 本頁的切換鈕 `.match-toggle`／`.match-btn`（`:106`–`:109`；`syncSequenceUi`，`:2022`）、IAA 報告標題列的主要指標星號 `.iaa-primary-star`（`:68`–`:69`）、[Card](../components/card.md) |
| `#state-seq-match-partial` | 同上，點 `#matchPartial`；星號收起、後綴改「— 參考顯示」，見下方「Partial overlap 時標題列跟著換」 | 同上 |
| `#param-q-state-ready` | `?tab=quality&q_state=ready`（預設） | 同 `#state-quality-*` |
| `#param-q-state-dry-run-in-progress`、`#param-q-state-report-pending`、`#param-q-state-report-generating` | `?tab=quality&q_state=<狀態>`（`applyQualityState`，`:2469`） | [Empty State](../components/empty-state.md)（`#qualityEmpty`，`empty-state-panel`，`:300`；文案依狀態取 `emptyStateMsgs`）、[Badge](../components/badge.md)（`.badge.iaa-summary-badge.badge-neutral`）、[Button](../components/button.md) |
| `#param-q-state-report-failed` | `?tab=quality&q_state=report_failed` | `renderPanelLoadError(mount,'calc')`（`:1575`）：[Card](../components/card.md)（`.panel.panel-load-error`，`aria-live="polite"`，`:1581`–`:1582`）＋ [Button](../components/button.md)（`.btn.btn-secondary.btn-sm` 重試） |
| `#param-error` | 帶合法 `task_id` 再加 `?error=1`（`DEMO_LOAD_ERROR`，`:1506`–`:1507`） | 統計與品質兩個面板都走 `renderPanelLoadError(mountId)`（`:1514`、`:2383`；`cause` 不帶，即 `'load'` 那一支）：[Card](../components/card.md)（`.panel.panel-load-error`）＋ [Button](../components/button.md)（重新載入）。開關不寫回網址，重新載入就恢復 |

`q_state`、`s_state` 是**原型專用**的示範開關，維護者 2026-11-10 裁定不得帶進實作（`:2502`–`:2508` 的註解）。

**交付包的重現方式與畫面不符**：交付包寫「在序列標註任務的統計總覽點 `#matchStrict`」，但 `#matchStrict`／`#matchPartial`／`#seqStrictCard`／`#seqPartialCard` 只出現在 `quality-entity_recognition.html:11`–`:30`，也就是**實體辨識任務的品質監控**；序列標註與統計總覽都沒有這組切換。照規格 §八種輸出類型各自的主指標與門檻（表格的實體辨識列與第 5 條），切換本來就屬實體辨識。換成「帶實體辨識任務、`?tab=quality`」即可重現，所以不算無法重現 → `../design-gaps.md` G-52。

**「部分重疊」的 0.70 與關係識別的 0.80 改叫參考線**（#423 定「參考值」，#473 改為「參考線」）：實體辨識切到 `Partial overlap` 時卡片寫「Relaxed 參考線 0.70」（`quality-entity_recognition.html:42`），關係識別第二列寫「高品質參考線 0.80」（`quality-relation_identification.html:24`），兩者都不帶通過／未達，圓點用中性的 `.t-dot-neutral`；部分重疊卡的數值與長條也改中性色。「兩種計算模式比較」表頭改「門檻／參考線」（`quality-entity_recognition.html:55`），部分重疊那一列的結果是中性徽章「不判定」，Strict 那一列照舊判定。依據規格 §八種輸出類型各自的主指標與門檻 第 11 條（Q15，維護者 2026-11-08）→ `../design-gaps.md` G-53。

partial 讀取失敗的面板（`renderPanelLoadError(mount,'load')`，`:1575`）原本只有讓 partial 請求失敗才看得到；#422 加了 `?error=1` 示範開關，交付包已收為 `#param-error`（上表）→ `../design-gaps.md` G-54。

**Partial overlap 時標題列跟著換**（#435）：實體辨識的品質監控切到 `Partial overlap`，IAA 報告標題列的主要指標星號 `.iaa-primary-star` 收起（加 `.hidden`），連它的 `aria-label` 一起拿掉；後綴 `#iaaMethodSuffix` 由「— 主要指標」改成「— 參考顯示」（英文「— Primary metric」→「— Reference only」，鍵 `iaaMethodSuffix`／`iaaMethodSuffixRef`，`:437`、`:848`）。切回 `Strict match` 時星號重新顯示、`aria-label` 補回 `iaaPrimaryAria`（「主要指標」／"Primary metric"），後綴還原。只對 `entity_recognition` 生效，其他型別的標題列不受影響（`updateMethodName`，`:1968`–`:1991`；兩顆切換鈕的處理 `:2042`–`:2053` 都會呼叫它）。實體辨識 partial 的星號本身沒有 `data-i18n-aria-label`（`quality-entity_recognition.html:6`），它的 `aria-label` 只由 `updateMethodName` 寫；其餘六個有星號的 partial 都帶 `data-i18n-aria-label="iaaPrimaryAria"`（例如 `quality-single_label.html:6`）。規格只寫星號與「— 主要指標」，沒有寫切到部分重疊時的樣子 → `../design-gaps.md` G-57。

**換語言時保留「通過／未達」判定**（#435）：門檻列的文字以 `setElText`（`:1452`–`:1473`）寫入。元素裡有 `strong.t-pass`／`strong.t-fail` 時只換掉它前面的文字，判定字本身另由 `tPass`／`tFail` 重新翻成目前語言（「通過／未達」↔ "Pass／Fail"）；多維度那種把判定放在**後面兄弟元素** `<strong>` 的寫法也一併翻（`:1456`–`:1466`）。`setText`（`:1474`–`:1477`）、`applySimpleIds` 都改走它。複合任務的次要 IAA 卡在換 id 之前先跑一次同一套翻譯（`buildSecondaryIaaBlock`，`:2349`；翻譯那段在函式內，`:2359`–`:2362` 的 `SIMPLE_IDS.forEach`），所以英文模式下次要卡也是英文。換語言走 `applyLang`（`:1699`）→ `applyTypeContent` 重新載入兩個 partial；`S.seqMode` 不重設，`loadQualityPanel` 的收尾（`:2392`–`:2398`）再跑 `syncSequenceUi` 與 `updateMethodName`，所以停在 `Partial overlap` 時換語言，星號仍收起、後綴是新語言的「參考顯示」。替代指標的展開區會被 `closeAllAltToggles` 收起。

**英文模式與 aria 鍵**（#435）：七個 `quality-*` partial 的表格 `aria-label` 都加了 `data-i18n-aria-label`，鍵在 `qualityListRank.aria*`，共 21 條（`ariaAltMetrics`；`ariaDev*` 六條、`ariaRank*` 七條、`ariaSample*` 七條；中文 `:593`–`:613`，英文 `:985`–`:1005`），由 `applyDataI18n`（`:1495`–`:1498`）在每次載入時套上。另加的文案鍵：`entityRecognitionListRank.pairwiseAvg`（實體辨識兩張卡的「Pairwise 平均」，`:652`／`:1044`）、`qualityRisk.seqSpeedWarn`（序列標記速度欄，`:573`／`:965`），以及偏離分析表頭的 `qualityRisk.headerAnnotator`。序列標記與單一標籤的異常偵測區塊原本沒有 `id`，換語言換不到；現在補上（`quality-sequence_tagging.html:104`–`:120` 的 `anomSeqSpeedTitle`、`anomStSpd1*`、`anomSeqOutlierTitle`、`anomStOut1*`，`quality-single_label.html:101`–`:104` 的 `anomClsSpeedTitle`、`anomClsSpeedEmpty`、`anomClsOutlierTitle`、`anomSdOutlierEmpty`；`SIMPLE_IDS` 收在 `dataset-analysis-detail.html:1692`–`:1693`）。沒有新增或移除任何元素，元件結構不變。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.panel`（`:50`） | 容器在 `pages/shared/card.css`，本頁只加 `margin-bottom`（#423）→ [Card](../components/card.md)、G-41 |
| `.btn` 覆寫（`:169`–`:175`） | 載入正典 `button.css` 後又在頁內用零特異性重寫 → G-37 |
| `.badge*`（`:58`–`:62`）、`.risk-level-badge`（`:150`–`:154`） | 本頁重寫的徽章，全用 token → [Badge](../components/badge.md) |
| `.iaa-score-card`（`:74`–`:77`）、`.iaa-bar-*`（`:84`–`:89`） | 達標分數卡與分數條；分數條沒有 `role="progressbar"`，數字在旁邊的文字。填充依 class 取色：`.pass` `--color-success`、`.warn` `--color-warning`、`.fail` `--color-error`、`.neutral` `--color-ink-muted`；#435 起沒有狀態 class 時預設也是 `--color-ink-muted`（`:85`），序列標註那種沒有門檻的長條才看得到 → [Progress Bar](../components/progress-bar.md) |
| `.t-dot`（`:92`–`:96`） | 與 Color Dot 同用途的圓點，只靠顏色；#423 加了不判定用的 `.t-dot-neutral`（`--color-ink-muted`）→ [Color Dot](../components/color-dot.md)、G-14 |
| `.iaa-primary-star`（`:68`–`:69`） | 主要指標旁的星號，`--color-warning` 系列 token；內含的 SVG `aria-hidden`，名稱在外層 `aria-label`。實體辨識切到 `Partial overlap` 時收起（`updateMethodName`，`:1968`）→ G-57 |
| `.match-toggle`／`.match-btn`（`:106`–`:109`） | 分段切換鈕，只此一頁；用 `.active` 表示目前選項；已於 #422 補上 `aria-pressed` 並與 `.active` 同步 → G-56 |
| `.alt-toggle-btn`／`.alt-metrics-body`（`:112`–`:117`） | 原生 `<button>`，帶 `aria-expanded`／`aria-controls`（例如 `quality-single_label.html:24`），收合時 body 設 `aria-hidden`（`wireAltToggle`，`dataset-analysis-detail.html:1994`）→ [Accordion](../components/accordion.md) |
| `.anomaly-item`（`:129`） | 異常提示列，用 warning token |
| `.annotator-table`（`:138`–`:142`） | 第 N 份表格樣式 → [Data Table](../components/data-table.md)、G-10 |
| `.cause-chip`（`:156`） | 唯讀的原因標籤 → [Chip](../components/chip.md)、G-11 |
| `.risk-action-btn[disabled]`（`:162`） | 非專案負責人時 `syncRoleUi`（`:1615`）停用 `[data-role-action]` 並顯示 `[data-role-note]`；按下由 `:1637`–`:1641` 導到任務詳情的成員管理，或以審核員身分帶 `dry_run` 進標記清單 |
| `.stats-hbar-*`、`.stats-comatrix-*`（`:189`–`:202`） | 統計圖表，全用 token，只此一頁 |
| ~~`.toast*`~~ | #423 已刪：原本有樣式、markup 與關閉鈕的處理，卻沒有任何程式會顯示它。本頁沒有需要通知的操作 → [Toast](../components/toast.md)、G-55 |

十六個 partial 沒有寫死的 hex 或 rgba：SVG 的 `fill`／`stroke` 與 inline `style` 全部用 `var(--color-*)`、`var(--space-*)`。inline `style` 很多（`quality-entity_recognition.html` 26 處、`quality-sequence_tagging.html` 26 處、`stats-entity_recognition.html` 20 處），平均標記時間那一塊另有一個寫死的字級（`:274` 的 `<small>`）→ G-02。

分頁有 `role="tablist"`／`tab`／`tabpanel` 與 `aria-selected`、`aria-controls`，但只能點，沒有方向鍵（`:2545`–`:2550`）→ G-22。

## 業務行為

連回規格 [`05-dataset/02-analysis-detail.mdx`](../../../docs/specs/05-dataset/02-analysis-detail.mdx)。UXC 落點：UXC-09（統計與品質兩種空狀態 `statsEmpty`／`qualityEmpty`，`:281`、`:300`）、UXC-11（`syncUrlState` 只從狀態組網址，`:2512`；#155 Q4，維護者 2026-11-08）。
