# Modal

> 正典章節：`MASTER.md` 無對應章節（`shared/modal.css` 自己是來源）｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.modal-overlay`（`position: fixed`、`inset: 0`、`backdrop-filter: blur(4px)`） | 必填 | `pages/shared/modal.css:5`–`:15` |
| `.modal` 對話框（`min(520px, 100%)`、`--radius-xl`、`--shadow-xl`） | 必填 | `:18`–`:25` |
| `.modal-header`（標題與關閉鈕分置兩端） | 選用 | `:53` |
| `.modal-title`（或 `.modal` 下的 `h2`） | 必填 | `:27`–`:35` |
| `.modal-desc`（或 `.modal` 下的 `p`） | 選用 | `:37`–`:43` |
| `.modal-close`（32×32 方鈕） | 選用 | `:61`–`:75` |
| `.modal-footer` ／ `.modal-actions`（靠右、可換行） | 選用 | `:45`–`:51` |

**可見性契約**寫在檔頭註解（`modal.css:3`–`:4`）：`.modal-overlay` 預設 `display: none`，**只用切換 `.show` 開關**（`:16`）。頁面專屬的尺寸（`.modal-xl`）、預覽與表單留在各頁。

標題與說明各有兩種寫法：`:where(.modal) h2` 的零特異性版本讓頁面可以直接寫 `<h2>`，`.modal-title` 則多一個 `--font-serif-display`（`:35`）——**兩者外觀不同**，用 `<h2>` 拿不到襯線標題。

## 變體

只有一種版式。`.btn-danger` 住在這個檔裡（`:80`，見 [Button](button.md)），因為破壞性確認幾乎只出現在 modal 裡。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 關閉（預設） | 有，`display: none` | `modal.css:11` |
| 開啟 | 有，`.show` → `display: flex` | `:16` |
| hover | 只有 `.modal-close` 有（底色換 `--color-slate-50`） | `:75` |
| focus | **未觀察到樣式**，但**行為完整**（見下） | 以 `:focus` 掃全檔，0 命中 → `../design-gaps.md` G-05 |
| disabled／載入中／錯誤／空 | 不適用，由內容自理 | — |

## token

`--z-modal`（帶 `300` 的 fallback，`:10`）、`--space-md`（帶 `16px` fallback）、`--space-sm`、`--space-lg`、`--space-xl`、`--radius-xl`、`--radius-md`、`--shadow-xl`、`--color-white`、`--color-border`、`--color-ink`、`--color-text-soft`、`--color-ink-muted`、`--color-slate-50`、`--color-error`、`--color-on-cta`、`--font-serif-display`（帶 `inherit` fallback）。

遮罩是 `rgba(0, 0, 0, 0.5)`（`:8`），寫死。

## 鍵盤與焦點

由 `pages/shared/modal-focus.js` 提供，是**全 prototype 唯一一個把焦點管理抽成共用模組**的元件。

| 行為 | 依據 |
| :--- | :--- |
| 開啟時把焦點移到第一個可聚焦元素，沒有就聚焦 modal 本身 | `modal-focus.js:34`–`:39` |
| Tab／Shift+Tab 困在 modal 內（繞回首尾） | `:47`–`:64` |
| Escape 呼叫 `options.onClose` | `:42`–`:45` |
| 關閉時把焦點還給 `trigger`（預設是開啟當下的 `activeElement`） | `:32`、`:80`–`:84` |
| 可聚焦判定排除 `offsetParent === null`（看不見的） | `:19`–`:21` |

模組**不自己切換顯示**（`modal-focus.js:7`–`:8` 的註解明寫），開關仍是頁面的事；頁面要在自己的 open／close 裡顯式呼叫 `LabelSuiteModalFocus.open/close`。依據是 issue `singyichen/label-suite#195` / F-11 與 WCAG 2.1 AA 2.4.3（`:1`）。

**沒有的**：沒有 `role="dialog"`／`aria-modal`／`aria-labelledby` 的保證（CSS 與模組都不發），點遮罩關閉也不在模組裡 → `../design-gaps.md` G-23。

## 樣式出處

`design/prototype/pages/shared/modal.css:1`–`:99`（版式）、`design/prototype/pages/shared/modal-focus.js:1`–`:88`（焦點）。**沒有進 showcase 的正典區塊**。

## 可重現樣本

本批次**沒有可重現的視圖**：showcase 不含 modal，b1 的九個畫面也沒有一個用它。最近的樣本在 b2 的 `task-management/task-new#modal-dataset-preview` 與 `admin/user-management#modal-invite`。→ `../design-gaps.md` G-21

**b2 補上**：上面兩個加 `task-management/task-new#modal-leave-confirm`。三者都**沒有**接 `modal-focus.js`；要看完整的焦點行為，用 `task-management/task-list#sim-delete-error` 的刪除確認。

`shared/app-shell` 的 `#modal-shortcut` 與 `#modal-notification` 兩個視圖**不是這個元件**，它們整套寫在 `sidebar.js` 裡，見 [app-shell](app-shell.md)。

## shadcn 對照

候選原語 `Dialog`（`DialogOverlay`、`DialogContent`、`DialogHeader`、`DialogTitle`、`DialogDescription`、`DialogFooter`）——結構幾乎一一對應。

- **我們有而它沒有**：`:where()` 包起來的零特異性元素選擇器，讓頁面可以不加 class 就拿到樣式。
- **它有而我們沒有**：`role="dialog"` 與 `aria-*` 自動發出、點遮罩關閉、進出場動畫、巢狀 dialog。
- **語意對不上**：shadcn 的 Dialog 自己管開關狀態；我們刻意把顯示留給頁面、只共用焦點，所以兩邊的責任切分相反。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| 無（b1） | — |
| `task-management/task-list#sim-delete-error` | `#deleteTaskModal`（`task-list.html:280`–`:288`）；**有接** `modal-focus.js`（`:705`、`:715`）；點遮罩不關（UXC-10，#423 起）→ `../design-gaps.md` G-45 |
| `task-management/task-new`（`#modal-dataset-preview`、`#modal-leave-confirm`） | `datasetPreviewModal`（`.modal-xl`，`task-new.html:542`）、`leaveModal`（`:518`）、`taxonomyDeleteModal`（`:530`）；**沒有接** `modal-focus.js` |
| `task-management/task-detail`（`#tab-*`、`#param-status`、`#param-section-labeling`） | 八個 modal（`task-detail.html:1921`–`:2022`、`annotation-results.html:138`），只有四個接了 `modal-focus.js` → `../design-gaps.md` G-43 |
| `admin/user-management`（`#modal-invite`、`#toast-action`） | `addModal`（`:569`）、`editModal`（`:622`）、`disableModal`（`:673`），帶 `role="dialog"`／`aria-modal`；**沒有接** `modal-focus.js` |
| `admin/role-settings`（離開確認，交付包未列） | `#dirtyModal`（`role-settings.html:953`）；**沒有接** `modal-focus.js` |
| `annotation/annotation-workspace`（`#modal-guideline-gate`、`#modal-guideline-image`、`#modal-guideline-pdf`、`#modal-guideline-md`） | 五個 overlay 全部接 `modal-focus.js`（`annotation-workspace.config.js:6384`、`:6408`、`:6573`、`:5741`、`:6887`）。指引閘門自 #423 起把 `onClose` 設成空函式（`:6898`），**Esc 不關**，只能按確認或「返回標記清單」離開 → `../design-gaps.md` G-46；審核流程抽屜（`wsReviewFlowDrawer`，`annotation-workspace.html:1194`）的關閉鈕沒有名稱 → G-49 |

b2 已補上並核對（見上表）：五頁裡只有 `task-list` 全部接上 → G-43。b3 已補上（見上表）：`annotation-workspace` 全部接上。
