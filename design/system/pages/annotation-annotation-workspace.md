# `annotation/annotation-workspace`

> 批次 `b3-annotation-review` ｜規格 [`docs/specs/04-annotation/02-annotation-workspace.mdx`](../../../docs/specs/04-annotation/02-annotation-workspace.mdx) ｜檔案 `design/prototype/pages/annotation/annotation-workspace.html`（1372 行）＋ `annotation-workspace.config.js`（7038 行）、`task-config.engine.js` ｜交付包 commit `eb9a884`

## 入口

`annotation/annotation-list` 點一列（帶 `task_id`、`sample_id`、`role`、`run_type`，解析在 `annotation-workspace.config.js:6962`–`:6973`）。

載入：`assets/tokens.css`、`pages/shared/modal.css`、`sidebar.css`、`button.css`、`empty-state.css`、`content-tabs.css`、`input.css`、`task-management/task-config.css`；腳本 `sidebar.js`、`annotation-history.js`、`modal-focus.js`（`:1108`）、`theme.js`、`analytics.js`、`task-list.data.js`、`task-detail.data.js`、`task-config.data.js`、`task-config.yaml.js`、`task-config.dataset.js`、`task-config.engine.js`（`:1341`）、`annotation-workspace.data.js`、`annotation-workspace.config.js`。

本頁**沒有定義** `--navbar-mobile-height`／`--navbar-mobile-top-height`，而 `sidebar.css:828`–`:837` 在窄螢幕用到它們且沒有後備值 → `../design-gaps.md` G-24。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#role-annotator` | 不給 `role`，或給不認得的值（預設） | [App Shell](../components/app-shell.md)、[Breadcrumb](../components/breadcrumb.md)（`nav#entryBreadcrumb`，`:1212`）、[Progress Bar](../components/progress-bar.md)（本頁 `.progress-track`，`:307`–`:318`、markup `:1240`）、[Card](../components/card.md)（`.content-card`，`:248`–`:252`）、[Input](../components/input.md)（「無法判定」理由，`.input`，`annotation-workspace.config.js:640`–`:672`）、[Button](../components/button.md)、[Toast](../components/toast.md)（`:1327`–`:1328`） |
| `#role-reviewer` | `?role=reviewer` | 同上，加 [Review Status Track](../components/review-status-track.md)（`.review-track`，CSS `:445`–`:466`，算繪 `annotation-workspace.config.js:5506`）、[Tooltip](../components/tooltip.md)（審核單位脈絡橫幅的審核說明，`:3935`–`:3980`）、[Input](../components/input.md)（`.input-textarea`，審核理由） |
| `#tab-guideline` | 右欄預設分頁「說明與檔案」 | [Content Tabs](../components/content-tabs.md)（`.admin-tabs.admin-tabs--panel`，`:1291`–`:1292`） |
| `#tab-history` | 切到「操作紀錄」（`renderHistoryPanel`，`annotation-workspace.config.js:2244`） | [Content Tabs](../components/content-tabs.md)、[Empty State](../components/empty-state.md)（沒有紀錄時 `empty-state-compact`，`:2271`） |
| `#modal-guideline-gate` | 任務要求先讀說明且這個帳號尚未確認（`setupGuidelineModal`，`:6794`；markup `wsGuidelineModal`，`:1133`） | [Modal](../components/modal.md)、[Button](../components/button.md)（`.btn.btn-cta`） |
| `#modal-guideline-image` | 右欄點圖片檔（`:1145`） | [Modal](../components/modal.md) |
| `#modal-guideline-pdf` | 右欄點 PDF 檔（`:1160`） | [Modal](../components/modal.md) |
| `#modal-guideline-md` | 右欄點 Markdown 檔（`:1176`） | [Modal](../components/modal.md) |
| `#modal-mobile-drawer` | 視窗窄到 767px 以下，點右欄抽屜的把手（`#wsMobileDrawer`，`:1312`；`setupMobileDrawer`，`:6750`–`:6760`） | 本頁的抽屜（`:955`–`:999`） |
| `#state-review-decision` | 審核員選「通過／修正／無法裁決」（`.rv-choice-group`，`:3630`–`:3670`） | [Button](../components/button.md)（本頁 `.mini-btn mini-btn-active-*`，`aria-pressed`）、[Review Status Track](../components/review-status-track.md) |
| `#state-arbitration` | 審核單位處於爭議待裁決（`renderArbitrationCard`，`:4751`；呼叫點 `:5849`） | [Card](../components/card.md)、[Button](../components/button.md)（`.mini-btn`） |
| `#state-exception-pool` | `?role=project_leader`：選處置後按「確認處置」（`renderExceptionPoolScreen`，`:5116`；`renderWorkspace` 的分支 `:1727`） | [Card](../components/card.md)、本頁 inline 樣式的理由輸入框（`:5001`–`:5009`）→ G-04 |
| `#state-submitted-next` | 還有未完成的樣本時按「提交」：通知成功（`:3105`），留在本頁跳到下一筆（`:3116`）；沒有下一筆才回清單（`:3120`） | [Toast](../components/toast.md) |

**`#state-task-goal-and-instruction` 無法重現**：中欄上方只顯示任務名稱，沒有任務目標與說明 → 交付包列為無法重現，追蹤在 label-suite/label-suite#187。

另外找得到但交付包沒有列的：審核流程抽屜（`wsReviewFlowDrawer`，`:1197`，`annotation-workspace.config.js:5681` 起）；操作結果的通知（`showToast`，`:422`–`:439`）→ `../design-gaps.md` G-51。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.content-card`（`:248`–`:252`） | 與 Card 同樣四條規則的第五份 → [Card](../components/card.md)、G-41 |
| `.review-track*`（`:445`–`:466`） | 自稱「CSS verbatim」，核對後 11 條規則與 `components-showcase.html:653`–`:717` 逐字相同 → [Review Status Track](../components/review-status-track.md) |
| `.mini-btn`／`.rv-choice-group`（`:578`–`:600`） | 第二套按鈕的第四份（另有 `-active-approve`／`-modify`／`-bypass`、`-danger`），全用 token → G-37 |
| `.progress-track`／`.progress-fill`（`:307`–`:318`） | 與 Progress Bar 同尺寸同 token，只換了 class 名 |
| `.toast*`（`:1030`–`:1073`） | [Toast](../components/toast.md)：分級存續時間照 UXC-07（`TOAST_DURATIONS`，`annotation-workspace.config.js:422`–`:439`） |
| 作答控制項 | `task-config.engine.js` 的 `renderOutputPreview`（`:3671`）用 inline 樣式畫按鈕（例如 `renderSingleLabelPreview`，`:2871`），寫死三個色值（`:2816`–`:2828`、`:2888`，原文見 G-50），不屬任何元件 → G-50 |
| 結果標籤 hex（`:613`–`:618`）、`.sample-item.active` 與一個寫死的 rgba（`:120`、`:851`、`:872`，原文見 G-10） | 與 `annotation-list` 的同一組 hex 各寫一份 → G-02、G-10 |

六個 overlay 全部接了 `modal-focus.js`：圖片（`annotation-workspace.config.js:6343`）、PDF（`:6367`）、Markdown（`:6532`）、審核流程抽屜（`:5700`）、指引閘門（`:6845`），右欄抽屜由原生按鈕與 `aria-expanded` 控制 → G-23、G-43 在本頁不成立。但：

- 指引閘門把 `onClose` 設成 `hideGuidelineModal`（`:6849`），而 `modal-focus.js:42`–`:44` 在 Esc 時呼叫它，所以**按 Esc 就能不確認直接開始** → G-46
- 審核流程抽屜的關閉鈕（`:1201`）靜態 markup 只有圖示；已於 #422 補上 `aria-label`（執行期本來就會設定）→ G-49
- 分頁按鈕沒有 `tablist`／`tab`／`aria-selected`，只能點（`setupGuidelineTabs`，`:6695`–`:6713`）→ G-22

送出被擋時各輸出類型的區塊會加上 `data-error="true"`（`:3048`），但全 prototype 沒有任何 CSS 選到它，畫面上看不出是哪一塊擋住 → G-47。

## 業務行為

連回規格 [`04-annotation/02-annotation-workspace.mdx`](../../../docs/specs/04-annotation/02-annotation-workspace.mdx)。UXC 落點：UXC-03（`annotation-workspace.config.js:2032`–`:2060`）、UXC-04 與 UXC-05（`:640`–`:672`、`:3056`–`:3075`）、UXC-06（提交的 `submitBusy`）、UXC-07（`:422`–`:439`）。鍵盤快捷鍵：審核鍵 a／b（`:3724`）、Ctrl／Cmd＋S、Ctrl／Cmd＋Enter、Alt＋←／→（`:3750`）。
