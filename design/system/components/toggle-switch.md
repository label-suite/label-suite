# Toggle Switch

> 正典章節：`MASTER.md` §Toggle Switch ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.toggle-switch` 外框（40×22） | 必填 | `components-showcase.html:331` |
| 內含 `<input type="checkbox">`，視覺上隱藏 | 必填 | `components-showcase.html:332`（`opacity: 0; width: 0; height: 0`） |
| `.toggle-slider` 軌道，`::before` 是 16×16 的圓鈕 | 必填 | `components-showcase.html:333`、`:334` |
| `.toggle-row` ＋ `.toggle-info`（標題＋說明） | 選用，是 showcase 自己的排版殼，不在正典區塊 | `components-showcase.html:133`–`:136`（註解標為非正典） |

## 變體

只有一種。尺寸、圓角、位移（`translateX(18px)`）都是字面值，沒有 size 維度。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設（off） | 有，軌道 `--color-border` | `components-showcase.html:333` |
| on | 有，軌道換 `--color-primary`、圓鈕右移 18px | `components-showcase.html:335`、`:336` |
| hover | **未觀察到** | 正典區塊沒有 `:hover` |
| focus | **未觀察到**。`<input>` 被壓成 0×0 且 `opacity: 0`，原生 focus ring 無處可畫，而 `.toggle-slider` 沒有 `:focus-within` | `components-showcase.html:332` → `../design-gaps.md` G-05 |
| disabled | **未觀察到** | 正典區塊沒有 `:disabled` |
| 載入中／錯誤／空 | 不適用 | — |

## token

`--color-border`、`--color-primary`、`--radius-full`、`--dur-fast`。圓鈕底色是字面 `white`（`components-showcase.html:334`）。

## 鍵盤與焦點

`<input type="checkbox">` 原生可聚焦、Space 可切換，**但沒有任何可見的焦點指示**（見上）。`profile.html` 的通知設定一頁就有 12 組（`toggle-switch` 出現 36 次），全部同樣沒有焦點樣式。

## 樣式出處

`design/prototype/components-showcase.html:331`–`:336`（正典六行）。`pages/shared/` **沒有** toggle 的 CSS 檔；`pages/task-management/task-config.css` 另有一份供 b2 的設定畫面用。

## 可重現樣本

`components-showcase#state-default` → `#comp-toggle`（`components-showcase.html:1069`），樣本在 `:1077`。

## shadcn 對照

候選原語 `Switch`。

- **我們有而它沒有**：無。
- **它有而我們沒有**：`disabled` 樣式、`focus-visible` ring、`Label` 關聯、受控／非受控 API。
- **語意對不上**：shadcn 的 `Switch` 是 `role="switch"` 的 button；我們是一個藏起來的 checkbox，輔助技術讀到的角色不同。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 樣本 |
| `account/profile`（`state-default`、`toast-saved`） | 通知設定區塊，`profile.html` 共 36 處 |
| `task-management/task-new#state-step2` | `task-config.css:242`–`:247`，與正典逐字相同（40×22、開啟 `--color-primary`） |
| `task-management/task-detail#tab-settings` | `settings.html:274`、`:345`；用同頁載入的 `task-config.css` 正典（40×22、開啟 `--color-primary`）。原本頁內重新定義的 42×24／`--color-cta` 版已於 #423 刪除 → `../design-gaps.md` G-42 |

b2 已判斷（見上表）：`task-config.css` 那一份是同一個元件；`task-detail` 的重新定義不是。
