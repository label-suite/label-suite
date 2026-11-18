# `annotation/annotation-workspace`

> 批次 `b3-annotation-review` ｜規格 [`docs/specs/04-annotation/02-annotation-workspace.mdx`](../../../docs/specs/04-annotation/02-annotation-workspace.mdx) ｜檔案 `design/prototype/pages/annotation/annotation-workspace.html`（1372 行）＋ `annotation-workspace.config.js`（7038 行）、`task-config.engine.js` ｜交付包 commit `eb9a884`

## 入口

`annotation/annotation-list` 點一列（帶 `task_id`、`sample_id`、`role`、`run_type`，解析在 `annotation-workspace.config.js:7017`–`:7028`）。

載入：`assets/tokens.css`、`assets/data-palette.css`（#420）、`pages/shared/modal.css`、`sidebar.css`、`button.css`、`empty-state.css`、`content-tabs.css`、`input.css`、`task-management/task-config.css`；腳本 `sidebar.js`、`annotation-history.js`、`modal-focus.js`（`:1108`）、`theme.js`、`analytics.js`、`task-list.data.js`、`task-detail.data.js`、`task-config.data.js`、`task-config.yaml.js`、`task-config.dataset.js`、`task-config.engine.js`（`:1341`）、`annotation-workspace.data.js`、`annotation-workspace.config.js`。

本頁**沒有定義** `--navbar-mobile-height`／`--navbar-mobile-top-height`，而 `sidebar.css:828`–`:837` 在窄螢幕用到它們且沒有後備值 → `../design-gaps.md` G-24。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#role-annotator` | 不給 `role`，或給不認得的值（預設） | [App Shell](../components/app-shell.md)、[Breadcrumb](../components/breadcrumb.md)（`nav#entryBreadcrumb`，`:1211`）、[Progress Bar](../components/progress-bar.md)（本頁 `.progress-track`，`:303`–`:314`、markup `:1239`）、[Card](../components/card.md)（`.content-card`，外框在 `pages/shared/card.css:8`–`:16`，本頁 `:250` 只留 G-41 註解）、[Input](../components/input.md)（「無法判定」理由，`.input`，`annotation-workspace.config.js:649`–`:681`）、[Button](../components/button.md)、[Toast](../components/toast.md)（`:1326`–`:1327`） |
| `#role-reviewer` | `?role=reviewer` | 同上，加 [Review Status Track](../components/review-status-track.md)（`.review-track`，CSS `:441`–`:462`，算繪 `annotation-workspace.config.js:5547`）、[Tooltip](../components/tooltip.md)（審核單位脈絡橫幅的審核說明，`:4000`–`:4034`）、[Input](../components/input.md)（`.input-textarea`，審核理由） |
| `#tab-guideline` | 右欄預設分頁「說明與檔案」 | [Content Tabs](../components/content-tabs.md)（`.admin-tabs.admin-tabs--panel`，`:1290`–`:1291`） |
| `#tab-history` | 切到「操作紀錄」（`renderHistoryPanel`，`annotation-workspace.config.js:2253`） | [Content Tabs](../components/content-tabs.md)、[Empty State](../components/empty-state.md)（沒有紀錄時 `empty-state-compact`，`:2280`） |
| `#modal-guideline-gate` | 任務要求先讀說明且這個帳號尚未確認（`setupGuidelineModal`，`:6837`；markup `wsGuidelineModal`，`annotation-workspace.html:1117`） | [Modal](../components/modal.md)、[Button](../components/button.md)（`.btn.btn-cta` 確認、`.btn.btn-secondary` 返回標記清單，#423） |
| `#modal-guideline-image` | 右欄點圖片檔（`:1145`） | [Modal](../components/modal.md) |
| `#modal-guideline-pdf` | 右欄點 PDF 檔（`:1160`） | [Modal](../components/modal.md) |
| `#modal-guideline-md` | 右欄點 Markdown 檔（`:1176`） | [Modal](../components/modal.md) |
| `#modal-mobile-drawer` | 視窗窄到 767px 以下，點右欄抽屜的把手（`#wsMobileDrawer`，`:1315`；`setupMobileDrawer`，`:6791`–`:6801`） | 本頁的抽屜（`:938`–`:982`） |
| `#state-review-decision` | 審核員選「通過／修正／無法裁決」（`.rv-choice-group`，`:3675`–`:3720`） | [Button](../components/button.md)（正典 `.mini-btn` ＋本頁的 `mini-btn-active-*` 選中狀態，`aria-pressed`）、[Review Status Track](../components/review-status-track.md) |
| `#state-arbitration` | 審核單位處於爭議待裁決（`renderArbitrationCard`，`:4792`；呼叫點 `:5890`） | [Card](../components/card.md)、[Button](../components/button.md)（`.mini-btn`） |
| `#state-exception-pool` | `?role=project_leader`：選處置後按「確認處置」（`renderExceptionPoolScreen`，`:5157`；`renderWorkspace` 的分支 `:1736`） | [Card](../components/card.md)、本頁 inline 樣式的理由輸入框（`:5044`–`:5052`）→ G-04 |
| `#state-submitted-next` | 還有未完成的樣本時按「提交」：通知成功（`:3146`），留在本頁跳到下一筆（`:3157`）；沒有下一筆才回清單（`:3161`） | [Toast](../components/toast.md) |

**`#state-task-goal-and-instruction` 無法重現**：中欄上方只顯示任務名稱，沒有任務目標與說明 → 交付包列為無法重現，追蹤在 label-suite/label-suite#187。

另外找得到但交付包沒有列的：審核流程抽屜（`wsReviewFlowDrawer`，`:1196`，`annotation-workspace.config.js:5722` 起）；操作結果的通知（`showToast`，`:426`–`:443`）→ `../design-gaps.md` G-51。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.content-card` | `pages/shared/card.css` 的別名，本頁不再重寫（#423）→ [Card](../components/card.md)、G-41 |
| `.review-track*`（`:441`–`:462`） | 自稱「CSS verbatim」，核對後 11 條規則與 `components-showcase.html:651`–`:715` 逐字相同 → [Review Status Track](../components/review-status-track.md) |
| `.mini-btn-active-approve`／`-modify`／`-bypass`、`.rv-choice-group` | 審核三向決策的選中狀態，疊在正典 `pages/shared/button.css` 的 `.mini-btn` 上；#423 起本頁不再重寫 `.mini-btn` 本體與 `-danger` → G-37 |
| `.progress-track`／`.progress-fill`（`:303`–`:314`） | 與 Progress Bar 同尺寸同 token，只換了 class 名 |
| `.toast*`（`:1013`–`:1056`） | [Toast](../components/toast.md)：分級存續時間照 UXC-07（`TOAST_DURATIONS`，`annotation-workspace.config.js:426`–`:443`） |
| 作答控制項 | `task-config.engine.js` 的 `renderOutputPreview`（`:3673`）畫按鈕（例如 `renderSingleLabelPreview`）。#420 之前用 inline 樣式並寫死三個色值（原文見 G-50）；#420 起改套 `task-config.css` 的 `.chip` 一族，標籤自己的顏色經 `--chip-color` 傳入，引擎已沒有 hex。它仍不屬正典的 [Chip](../components/chip.md) → G-50 |
| 結果標籤（`:598`–`:600`）、`.sample-item.active` 與一個寫死的 rgba（`:123`、`:833`、`:854`，原文見 G-10） | 結果標籤 #420 起改用 success／info／error 族（Q3），與 `annotation-list` 仍各寫一份；rgba 不在 #420 範圍 → G-02、G-10 |

六個 overlay 全部接了 `modal-focus.js`：圖片（`annotation-workspace.config.js:6384`）、PDF（`:6408`）、Markdown（`:6573`）、審核流程抽屜（`:5741`）、指引閘門（`:6887`），右欄抽屜由原生按鈕與 `aria-expanded` 控制 → G-23、G-43 在本頁不成立。但：

- 指引閘門原本把 `onClose` 設成 `hideGuidelineModal`，按 Esc 就能不確認直接開始；#423 改成空函式（`:6898`），Esc 不關，另加「返回標記清單」鈕（`:6922`，走 `buildListReturnUrl`、不寫確認紀錄）；開啟時初始焦點在確認鈕（`:6902`）→ G-46
- 審核流程抽屜的關閉鈕（`:1201`）靜態 markup 只有圖示；已於 #422 補上 `aria-label`（執行期本來就會設定）→ G-49
- 分頁按鈕沒有 `tablist`／`tab`／`aria-selected`，只能點（`setupGuidelineTabs`，`:6736`–`:6754`）→ G-22

送出被擋時，未完成的輸出區塊加上 `data-error="true"`、一行錯誤文字「這一項還沒作答，完成後才能送出／Answer this item before submitting」（`.ws-output-error`，以 `aria-describedby` 綁到區塊），焦點捲到第一個未完成區塊（`markPanelError`，`:2939`；`handleSubmit`，`:3090`）。框線是 `annotation-workspace.html:1087` 的 2px `--color-error` outline；區塊重繪時錯誤態一併清掉（`patchedRenderOutputPreview`）→ G-47（#423 修正）。

## 業務行為

連回規格 [`04-annotation/02-annotation-workspace.mdx`](../../../docs/specs/04-annotation/02-annotation-workspace.mdx)。UXC 落點：UXC-03（`annotation-workspace.config.js:2041`–`:2069`）、UXC-04 與 UXC-05（`:649`–`:681`、`:3097`–`:3116`）、UXC-06（提交的 `submitBusy`）、UXC-07（`:426`–`:443`）。鍵盤快捷鍵：審核鍵 a／b（`:3765`）、Ctrl／Cmd＋S、Ctrl／Cmd＋Enter、Alt＋←／→（`:3791`）。
