# `task-management/task-new`

> 批次 `b2-admin-dashboard-task` ｜規格 [`docs/specs/03-task-management/02-task-new.mdx`](../../../docs/specs/03-task-management/02-task-new.mdx) ｜檔案 `design/prototype/pages/task-management/task-new.html`（1721 行）＋ `task-config.css`、`task-config.engine.js` ｜交付包 commit `eb9a884`

## 入口

`task-management/task-list` 點「新增任務」。

載入：`assets/tokens.css`、`assets/data-palette.css`（#420）、`pages/shared/sidebar.css`、`pages/shared/modal.css`、`pages/shared/button.css`、`task-config.css`、`pages/shared/sidebar.js`、`task-config.data.js`、`task-config.yaml.js`、`task-config.dataset.js`、`annotation/annotation-workspace.data.js`、`task-config.engine.js`。**沒有載入 `pages/shared/modal-focus.js`**。`task-config.css` 與 `task-config.engine.js` 和 `task-detail` 的設定分頁共用。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-step1` | 開 `pages/task-management/task-new.html`（`step1Panel`，`:265`） | [App Shell](../components/app-shell.md)、[Step Indicator](../components/step-indicator.md)（`:242`–`:262`）、[Card](../components/card.md)（`.form-card`）、[Input](../components/input.md)（本頁的 `.input-text`，`:64`）、[Button](../components/button.md) |
| `#state-step2` | 第一步填妥按「下一步」（`step2Panel`，`:341`） | [Step Indicator](../components/step-indicator.md)、[Chip](../components/chip.md)（`.task-type-chip`）、[Accordion](../components/accordion.md)（`.output-accordion`）、[Color Dot](../components/color-dot.md)、[Toggle Switch](../components/toggle-switch.md)、[Empty State](../components/empty-state.md)（`empty-state-compact`，`task-config.engine.js:1878`） |
| `#state-step3` | 進第三步（`step3Panel`，`:395`） | [Step Indicator](../components/step-indicator.md)、[Tooltip](../components/tooltip.md)（`:411`–`:414`）、[Input](../components/input.md) |
| `#modal-dataset-preview` | 第一步點資料集預覽（`datasetPreviewModal`，`:557`，`.modal-xl`） | [Modal](../components/modal.md) |
| `#modal-leave-confirm` | 填了一半點離開（`leaveModal`，`:533`） | [Modal](../components/modal.md)、[Button](../components/button.md) |

**交付包漏了第四步**：畫面有 `step4Panel`（`:446`，「標記說明」），步驟條也畫了四格（`:242`–`:262`），但交付包只有 `#state-step1`～`#state-step3`。照第三步按「下一步」就能到，可重現 → `../design-gaps.md` G-40。不替它取 ID。

另外找得到但交付包沒有列的：刪除分類確認（`taxonomyDeleteModal`，`:545`，`role="alertdialog"`，`:544` 註明 UXC-10）；頂端錯誤橫幅（`:236`）；操作結果的通知（`showToast`，`:888`）→ [Toast](../components/toast.md)。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.step-*`（`:42`–`:53`） | 步驟條，只此一頁 → [Step Indicator](../components/step-indicator.md) |
| `.form-card`（`:56`） | 容器在 `pages/shared/card.css`，本頁只加 `margin-bottom`（#423）→ [Card](../components/card.md)、G-41 |
| `.input-text`（`:64`） | 本頁的輸入框，與正典 `.input` 不同一份 → G-04 |
| `.toast*` | [Toast](../components/toast.md)：#423 起 `showToast` 依 `TOAST_DURATIONS`（`:880`）分級，error 只能手動關 → G-39 |

## 業務行為

連回規格 [`03-task-management/02-task-new.mdx`](../../../docs/specs/03-task-management/02-task-new.mdx)。UXC 落點：UXC-03（離開確認）、UXC-10（`:544`；`task-config.engine.js:22`、`:6185`）。
