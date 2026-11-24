# Button

> 正典章節：`MASTER.md` §Buttons ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

單一 `<button>`（或 `<a>`）元素加一個 variant class，沒有必填的子結構。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| variant class（`.btn-primary` 等七選一） | 必填 | `design/prototype/components-showcase.html:150`–`:290` |
| 文字 | 選用（`.btn-icon` 只有圖示） | `components-showcase.html:1041`（`.btn-icon` 僅有 `aria-label` 與 svg） |
| 前置圖示 `<svg>`／`<img>` | 選用 | `.btn-oauth` `components-showcase.html:1040`、`.btn-language` `:1042` |
| 狀態 class（`.btn-loading`／`disabled`） | 選用 | `components-showcase.html:212`–`:225` |

## 變體

| variant | 用途 | 定義處 |
| :--- | :--- | :--- |
| `.btn-primary`（別名 `.btn-cta`） | 主要行動 | `design/prototype/pages/shared/button.css:4`；別名僅存在於 `button.css`，showcase 正典區塊沒有 `.btn-cta` |
| `.btn-secondary` | 次要行動，外框 | `button.css:30` |
| `.btn-ghost` | 低強度行動（查看全部、取消） | `button.css:46` |
| `.btn-danger` | 破壞性確認 | `design/prototype/pages/shared/modal.css:80`（**實心**，維護者 2026-11-17 裁定為正典）；`components-showcase.html:180` 另有一份外框版，見 `../design-gaps.md` G-01 |
| `.btn-oauth` | 第三方登入入口 | **只有** `components-showcase.html:229` |
| `.btn-icon` | 純圖示觸發器 | `components-showcase.html:250`、另有 `pages/task-management/task-list.html:70` 與 `task-new.html:140` 各自一份 |
| `.btn-language` | 語言切換（zh-TW／EN） | **只有** `components-showcase.html:271`；細節見 [Language Toggle](lang-toggle.md)，依維護者 2026-11-17 裁定兩者是同一個元件 |
| `.mini-btn`（小尺寸） | 表格列、卡片列上的小按鈕，高 30px、字級 `--text-label`；色彩 variant `-primary`／`-success`／`-warning`／`-danger`／`-log`，`-icon` 縮內距 | `pages/shared/button.css:62`–`:158`（#423 收進正典，維護者 2026-11-18 裁定，見 `../design-gaps.md` G-37） |

`.btn.btn-danger` 另有一條還原規則（`modal.css:99`）：`.btn-danger` 的 (0,1,0) 會蓋掉 `:where(.btn)` 的零特異性，所以要把 `10px 20px` 的內距與 1px 透明邊框補回來，讓確認鈕和旁邊的「取消」等高。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `button.css:4`、`:30`、`:46` |
| hover | 有。primary／cta 是 `opacity .9` 加上移 1px；secondary 換成 `--color-primary-soft-bg`；ghost 加底線 | `button.css:17`、`:42`、`:58`；showcase 的 `.btn-secondary:hover` 原本缺，#438 照 `button.css:42` 補上（`components-showcase.html:177`） |
| focus | 七個大尺寸 variant **未觀察到**，沒有任何 `:focus` 或 `:focus-visible` 規則，只靠瀏覽器預設；`.mini-btn` 有，`outline: 2px solid var(--color-primary)`（`button.css:89`） | 以 `:focus` 掃過 `button.css` 與 `components-showcase.html:150`–`:290`，0 命中 → `../design-gaps.md` G-05 |
| disabled | 有。`opacity .4`、`cursor: not-allowed` | `button.css:23`（只針對 primary／cta）、`components-showcase.html:220`（`.btn-disabled, button[disabled]`，適用所有 variant，另加 `pointer-events: none`） |
| 載入中 | 有。`.btn-loading`：`opacity .7` 加 `pointer-events: none` | `components-showcase.html:214` |
| 錯誤 | 不適用 | — |
| 空 | 不適用 | — |

## token

`--color-cta`、`--color-on-cta`、`--color-primary-strong`、`--color-primary-soft-bg`、`--color-border`、`--color-error`、`--radius-md`、`--text-caption`。

`.btn-danger`（showcase 版）、`.btn-oauth`、`.btn-icon`、`.btn-language` 在 #420 之前共寫死 18 處色值（9 個相異值）。#420 起全部改用 token：`.btn-danger` 用 `--color-error*` 與 `--color-border`；`.btn-oauth`、`.btn-icon`、`.btn-language` 底色 `--color-white`、文字 `--color-ink`（`.btn-icon` 為 `--color-ink-muted`，hover 轉 `--color-ink`）、框線 `--color-border-control`，hover 換 `--color-slate-50` 底與 `--color-border-hover` 框（`components-showcase.html:180`–`:290`）。Google 標誌改用 `assets/google-g.svg`。原值見 `../design-gaps.md` G-02。

## 鍵盤與焦點

原生 `<button>` 的 Tab 與 Enter／Space 行為，沒有額外的腳本。`.btn-loading` 與 `.btn-disabled` 都用 `pointer-events: none`，**但沒有加 `disabled` 屬性**，所以鍵盤仍然聚焦得到、Enter 仍然觸發得了（`components-showcase.html:214`、`:220`）→ `../design-gaps.md` G-06。

## 樣式出處

`design/prototype/pages/shared/button.css:1`–`:60`（四個 variant）、`:62`–`:158`（`.mini-btn` 小尺寸 variant）、`design/prototype/pages/shared/modal.css:77`–`:99`（`.btn-danger` 實心版）、`design/prototype/components-showcase.html:150`–`:290`（正典區塊，七個 variant 加兩個狀態）。

## 可重現樣本

`components-showcase#state-default` → `#comp-buttons`（`components-showcase.html:1032`）：第一列七個 variant，第二列 loading 與兩個 disabled。

## shadcn 對照

候選原語 `Button`。

- **我們有而它沒有**：`.btn-language`（語言切換器）、`.btn-oauth` 的固定圖示＋文字排版；`.btn-loading` 是獨立 class 而不是 `disabled` 的衍生。
- **它有而我們沒有**：`size` 維度（`sm`／`lg`／`icon` 是尺寸而非語意）、`asChild`、內建 focus ring。
- **語意對不上**：shadcn 的 `variant="destructive"` 是實心紅底，對得上 `modal.css` 那份；`variant="outline"` 才是 showcase 那份。我們用同一個 class 名承載兩者。

## 用到它的畫面

| 畫面 | 用到的 variant |
| :--- | :--- |
| `components-showcase#state-default` | 全部七個加兩個狀態 |
| `account/profile`（`state-default`） | `.btn-primary`（`profile.html:803`） |
| `admin/role-settings`（`#state-default`、`#state-dirty`） | `.btn-ghost`／`.btn-cta` **本頁重新定義**（`role-settings.html:77`–`:78`、`:241`–`:242`）；`.btn-danger`（`:872`） |
| `admin/user-management`（`#state-default`、`#toast-action`） | `.btn-primary`／`.btn-ghost` 本頁只補版面規則（`user-management.html:56`），外觀來自 `button.css`；`.btn-danger`（`user-management.html:604`） |
| `dashboard/dashboard`（全部視圖） | 本頁的 `.btn` 外框（`dashboard.layout.css:208`–`:238`）加正典 variant：`.btn-primary`、三個角色 CTA 的 `.btn-cta`、`.btn-secondary.slim`；彩色鈕已於 #423 刪除 → `../design-gaps.md` G-37 |
| `task-management/task-list#sim-delete-error` | 正典 `.btn-secondary` ＋ `.btn-danger`（`task-list.html:280`–`:288`） |
| `task-management/task-new`（全部視圖） | 正典 `button.css` 的 variant |
| `task-management/task-detail`（全部視圖） | 正典 variant ＋ `.mini-btn`（#423 起用正典，頁內不再重新定義）→ G-37 |
| `annotation/annotation-list`（`#state-default`） | `.btn.btn-primary.slim` 快速繼續（`annotation-list.html:437`–`:458`）；回儀表板用正典 `.mini-btn`，清除篩選用 `.clear-btn` → `../design-gaps.md` G-37 |
| `annotation/annotation-workspace`（`#modal-guideline-gate`、`#state-review-decision`、`#state-arbitration`） | 指引閘門的確認是 `.btn.btn-cta`（`annotation-workspace.html:1138` 起）；審核三向決策是正典 `.mini-btn` 加本頁的 `mini-btn-active-*` 選中狀態，帶 `aria-pressed`（`annotation-workspace.config.js:3671`–`:3711`）→ G-37 |
| `dataset/dataset-analysis-detail`（`#state-stats-empty`、`#param-q-state-*`、`#param-error`、`#state-quality-*`） | 載入正典 `button.css`，用 `.btn.btn-secondary.btn-sm`（空狀態的連結、重試、`.risk-action-btn`）；頁內又在 `dataset-analysis-detail.html:169`–`:175` 重寫 `.btn` → `../design-gaps.md` G-37 |

五個登出狀態的帳號頁**一個正典 variant 都沒用**，它們自己寫 `.login-btn`／`.submit-btn`／`.sso-btn`／`.lang-toggle`／`.eye-toggle`／`.proto-btn` → `../design-gaps.md` G-03。
b2、b3、b4 已補上（見上表）。`dataset-analysis-list` 沒有載入 `button.css`，它的按鈕是 [List Toolbar](list-toolbar.md) 的 `.clear-btn` 與 [Pagination](pagination.md) 的 `.page-btn`。
