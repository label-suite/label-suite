# Empty State

> 正典章節：`MASTER.md` §Empty State ｜行為契約 [UXC-09](../ux-conventions.md#uxc-09-首次使用的空與篩不到的空是兩種)｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

骨架寫在 CSS 檔開頭的註解裡（`pages/shared/empty-state.css:2`）：

```
.empty-state > .empty-state-icon? + .empty-state-title + .empty-state-desc + .empty-state-action?
```

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.empty-state`（`text-align: center`） | 必填 | `empty-state.css:4` |
| `.empty-state-icon` | 選用；**只有 panel 與 page 兩個尺寸有樣式** | `:30`、`:41` |
| `.empty-state-title` | 必填 | `:5` |
| `.empty-state-desc`（下方間距由它的 `margin-bottom` 給） | 必填 | `:6`–`:7` |
| `.empty-state-action` | 選用 | `:8` |

## 變體

三個尺寸加三個表格輔助 class。

| class | 尺寸 | 依據 |
| :--- | :--- | :--- |
| `.empty-state-cell` | 表格儲存格內，最寬 520px，標題 20px／700 | `empty-state.css:11`–`:13` |
| `.empty-state-panel` | 面板，1px 虛線框、`--color-slate-50` 底，標題 15px | `:24`–`:32` |
| `.empty-state-compact` | 只有說明文字的內嵌提示（例：異常清單） | `:34`–`:37` |
| `.empty-state-page` | 整頁，圖示是 48px 的圓 | `:40`–`:47` |
| `.empty-state-td` ／ `.empty-state-dense` | `<td>` 的內距（40px／48px），dense 另把 cell 收到 420px | `:14`–`:16` |
| `.empty-state-row` ／ `.error-row` | 取消列的 hover 與 cursor | `:17`–`:20` |

`.error-row .empty-state-title` 把標題改成 `--color-error`（`:21`）——**這是「載入失敗」與「沒有資料」共用同一套版面**的接法，不是另一個元件。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 空（沒有資料） | 有，這是預設 | `empty-state.css:4` |
| 篩不到 | **沒有專屬 class**。UXC-09 要求兩者分開，但分法是**換文案**，CSS 只有一套 | `empty-state.css` 全檔無 `filtered` 字樣 |
| 錯誤 | 有，`.error-row` | `:18`、`:21` |
| hover | 有，但是**關掉** hover（`background: transparent !important`） | `:19`–`:20` |
| focus／disabled／載入中 | 不適用 | — |

## token

`--color-ink`、`--color-text-soft`、`--color-error`、`--color-border`、`--color-slate-50`、`--color-border-muted`、`--color-ink-muted`、`--radius-lg`、`--radius-md`、`--space-2xl`、`--space-lg`、`--space-md`。

字級（20／15／14／13px）、內距（40／48／20／14px）、寬度（520／420／400px）、圖示尺寸（48／40px）都是字面值。四處 `!important`（`:14`、`:15`、`:18`、`:20`）。

## 鍵盤與焦點

本身不可聚焦。`.empty-state-action` 通常是按鈕或連結，由 [Button](button.md) 提供行為。`.empty-state-row` 取消了列的 cursor 與 hover，避免看起來可以點。

沒有 `role="status"` 或 `aria-live`：清單篩到空時，**螢幕閱讀器不會自動得知**（CSS 不能提供，使用端也沒有統一約定）→ `../design-gaps.md` G-08。

## 樣式出處

`design/prototype/pages/shared/empty-state.css:1`–`:47`。**沒有進 showcase 的正典區塊**，所以 styleguide 上看不到它。

**它的散佈方式和其他共用 CSS 不同**：沒有任何頁面直接 `<link>` 它，而是由 `pages/shared/sidebar.css:1` 的 `@import url("./empty-state.css")` 帶進來——這是全 `pages/shared/` 唯一一條 `@import`。換句話說「有側欄的頁面就有空狀態樣式」，11 個連結 `sidebar.css` 的頁面全部拿得到。

## 可重現樣本

本批次**沒有可重現的視圖**：`components-showcase.html` 不含 empty state，而 b1 的九個畫面一個都沒用到它。最近的樣本在 b2 的 `task-management/task-list#state-filtered-empty`。→ `../design-gaps.md` G-21

**b2 補上**：載入共用 `empty-state.css` 的可重現樣本是 `admin/user-management#state-filtered-empty`（`empty-state-page`）與 `task-management/task-detail#tab-annotation-progress`（`empty-state-panel`，資料為空時）。`task-list#state-filtered-empty` 是表格內的一列，不用這個 class。

## shadcn 對照

沒有對應原語。

- **我們有而它沒有**：整個元件，尤其是三個尺寸與表格內嵌的那一組 class。
- **它有而我們沒有**：無。
- **語意對不上**：不適用。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `account/profile` | **載了沒用**。它連 `sidebar.css`（`profile.html:12`），因此透過上述 `@import` 拿到 `empty-state.css`；但 `profile.html` 全檔 `empty-state` 出現 **0 次** → `../design-gaps.md` G-21 |
| `admin/user-management#state-filtered-empty` | `empty-state-page`（`user-management.html:456`–`:468`），含「清除篩選」；稽核抽屜用 `empty-state-compact`（`shared/audit-drawer.js:51`） |
| `admin/role-settings`（稽核抽屜，交付包未列） | `empty-state-compact`（`shared/audit-drawer.js:51`） |
| `task-management/task-list`（`#state-filtered-empty`、`#param-view-empty`） | **表格內一列**（`createEmptyRow`，`task-list.html:834`–`:858`），不是 `.empty-state` class；兩種文案、只有篩選無結果才有清除鈕 → `../ux-conventions.md` UXC-09 |
| `task-management/task-detail`（`#tab-annotation-progress`、`#tab-annotation-results`、`#tab-work-log`） | `empty-state-panel`（`annotation-progress.html:157`、`annotation-results.html:164`、`work-log.html:84`） |
| `task-management/task-new#state-step2` | `empty-state-compact`（`task-config.engine.js:1890`） |
| `dashboard/dashboard#param-scenario-reviewer` | `empty-state-compact`（`dashboard.js:431`） |
| `annotation/annotation-list`（`#state-empty`、`#state-filtered-empty`） | `empty-state-page`（`annotation-list.html:507`）；兩種空換文案，只有篩不到才給清除篩選（`renderEmptyState`，`:1923`–`:1938`）→ UXC-09 |
| `annotation/annotation-list`（`#state-no-task`、`#state-task-not-found`、`#param-notice-no-actionable-review`） | `empty-state-panel`（`#taskNotFound`，`:475`；`#noActionableNotice`，`role="status"`，`:479`）。沒帶任務時標題是「尚未選擇任務」，與「找不到這個任務」分開（#423）→ `../design-gaps.md` G-48 |
| `annotation/annotation-workspace#tab-history` | 沒有操作紀錄時 `empty-state-compact`（`annotation-workspace.config.js:2280`） |
| `dataset/dataset-analysis-list`（`#state-filtered-empty`、`#param-view-empty`） | 表格內一列的 `empty-state empty-state-cell`（`createEmptyRow`，`dataset-analysis-list.view.js:133`），依參數換文案；清除鈕在工具列 |
| `dataset/dataset-analysis-detail`（`#state-stats-empty`、`#param-q-state-dry-run-in-progress`、`#param-q-state-report-pending`、`#param-q-state-report-generating`、`#state-quality-single-label`、`#state-quality-multi-label`、`#state-quality-single-dim`、`#state-quality-relation-identification`） | `empty-state-panel`：統計 `#statsEmpty`（`dataset-analysis-detail.html:280`）、品質 `#qualityEmpty`（`:299`）；四個 quality partial 另有 `empty-state-panel empty-state-compact` |

b2 已補上（見上表），G-21 的「沒有樣本」對這個元件不再成立。b3 已補上（見上表）。b4 已補上（見上表）。
