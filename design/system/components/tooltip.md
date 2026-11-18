# Tooltip

> 正典章節：原件 `MASTER.md` §Tooltip（只見於 `pages/task-management/task-config.css:259` 的註解，本 repo 無原文）｜批次 `b2-admin-dashboard-task`、`b3-annotation-review` 補寫 ｜交付包 commit `eb9a884`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.field-label-row`（欄位標籤 ＋ 觸發鈕同一行） | 必填 | `task-config.css:260`–`:268` |
| `.tooltip-wrap` | 必填 | `:269` |
| `.field-help-tooltip`：16px 圓形「?」按鈕，`cursor: help` | 必填 | `:270`–`:285` |
| `.tooltip-bubble`：在觸發鈕**上方**、最寬 `min(320px, 100vw − 48px)`，帶向下的小三角（`::after`） | 必填 | `:295`–`:324` |
| `role="tooltip"` 與觸發鈕上的 `aria-describedby` | 必填 | `task-config.engine.js:1152`–`:1182`（`attachFieldHintTooltip`） |

泡泡的顯示**純 CSS**：觸發鈕 hover 或 focus 時，相鄰的 `.tooltip-bubble` 變可見（`task-config.css:325`–`:329`，`+` 相鄰選擇器）。所以泡泡必須緊接在觸發鈕後面。

## 變體

| 變體 | 差別 | 依據 |
| :--- | :--- | :--- |
| 欄位說明 | 觸發鈕放在欄位標籤同一行的 `.field-label-row` 裡 | `task-config.engine.js:1152`–`:1182`（`attachFieldHintTooltip`） |
| 審核說明 | 觸發鈕放在審核單位脈絡橫幅裡，泡泡有固定 id `wsReviewNoteBubble` 供 `aria-describedby` 指向；同一組 class，沒有 `.field-label-row` | `annotation-workspace.config.js:3935`–`:3980`（`appendReviewNoteTooltip`，b3 核對） |

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 隱藏（預設） | 有，`visibility: hidden`＋`opacity: 0` | `:296`–`:297` |
| hover／focus 顯示 | 有 | `:325`–`:329` |
| 觸發鈕 focus 樣式 | 有，但焦點環是寫死的 rgba | `:291`–`:293` → `../design-gaps.md` G-37 |
| disabled／載入中／錯誤／空 | 不適用 | — |

## token

`--color-ink-muted`、`--color-ink`、`--color-white`、`--dur-fast`。寫死：泡泡圓角 6px（`:305`）、`z-index: 500`（`:301`，`tokens.css` 有 `--z-*` 系列卻沒用）、焦點環 rgba（`:293`）→ G-02。

## 鍵盤與焦點

| 行為 | 依據 |
| :--- | :--- |
| Tab 到「?」鈕就顯示泡泡，離開就隱藏 | `:326`（`:focus + .tooltip-bubble`） |
| 螢幕閱讀器經由 `aria-describedby` 讀出說明 | `task-config.engine.js:1152`–`:1182` |
| Esc 收起泡泡 | **未觀察到**：引擎沒有 `keydown` 處理，泡泡只在失焦時消失 |

## 樣式出處

`design/prototype/pages/task-management/task-config.css:259`–`:329`（`task-new` 與 `task-detail` 共用；`task-detail.html:1136` 的註解寫明搬過來共用）。

## 可重現樣本

`task-management/task-new#state-step3`（`task-new.html:393`–`:398`）、`task-management/task-detail#tab-settings`（`settings.html:321`–`:323`）、`annotation/annotation-workspace#role-reviewer`（審核說明）。

## shadcn 對照

候選原語 `Tooltip`（`TooltipTrigger`、`TooltipContent`）。

- **我們有而它沒有**：沒有。
- **它有而我們沒有**：Esc 關閉、碰撞偵測（我們固定在上方、靠左，窄視窗會出界）、延遲顯示、portal。
- **語意對不上**：無。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `task-management/task-new#state-step3` | 啟動設定的欄位說明 |
| `task-management/task-detail#tab-settings`（及五個 `#param-section-*`） | 設定分頁的欄位說明 |
| `annotation/annotation-workspace#role-reviewer` | 審核單位脈絡橫幅的審核說明（`appendReviewNoteTooltip`，`annotation-workspace.config.js:3935`–`:3980`），沿用 `task-config.css` 的同一組 class |
