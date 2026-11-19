# Badge

> 正典章節：`MASTER.md` §Semantic State Colors（基礎）＋ §Status Badges（role 變體）｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

`.badge` 基底加一個語意 class。單一行內元素，內容是文字，`.badge-role` 另可放一個圖示（`gap: 4px`）。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.badge` 基底 | 必填 | `components-showcase.html:343` |
| 語意 class（狀態或角色或任務型別） | 必填 | `components-showcase.html:356`–`:371`、`pages/shared/task-type-badge.css:9`–`:14` |

基底用 `border: 1px solid transparent` 的簡寫，所以**載入順序有意義**：`task-type-badge.css:2`–`:4` 的註解明寫它必須排在頁面自己的 `<style>` **之後**，否則同特異性下 `border-color` 會被重設掉。

## 變體

| 群 | class | 色來源 |
| :--- | :--- | :--- |
| 任務狀態 | `.badge-draft`、`.badge-dry-run-status`、`.badge-iaa`、`.badge-in-progress`、`.badge-completed`、`.badge-error` | `components-showcase.html:357`–`:362`。前兩個用中性 token `--color-ink-muted`／`--color-slate-50`／`--color-border`（#420 Q1），後四個用 `--color-warning/info/success/error` 系列 |
| 角色 | `.badge-role`（`--radius-full` 藥丸、primary 色系） | `components-showcase.html:365` |
| 任務型別 | `.badge-task-type-single`／`-sequence`／`-relation`／`-pairs`／`-scoring`／`-default` | `pages/shared/task-type-badge.css:9`–`:14`。前五個的配色取自 `assets/data-palette.css` 的 `--data-task-type-*`（淺深兩組都在那裡），`-default` 用中性 token（#420 Q1、Q4） |

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `components-showcase.html:343` |
| hover／focus／disabled／載入中 | **未觀察到**。Badge 不是互動元素 | 正典區塊與 `task-type-badge.css` 都沒有互動偽類 |
| 錯誤 | 有，`.badge-error` 是一個語意變體而非元件狀態 | `components-showcase.html:362` |
| 空 | 未觀察到。沒有「沒有狀態」的樣式 | — |
| 深色模式 | 全部跟著 token 翻轉：任務型別由 `data-palette.css` 的深色組負責，其餘由 `tokens.css` 的深色覆寫負責；徽章自己不寫深色規則 | `assets/data-palette.css`、`assets/tokens.css` |

## token

`--radius-sm`、`--radius-full`、`--color-warning/info/success/error` 及其 `-bg`／`-border`、`--color-ink-muted`、`--color-slate-50`、`--color-border`、`--data-task-type-*`、`--color-primary-strong`、`--color-primary-soft-bg`、`--color-primary-border`。

#420 之前，`task-type-badge.css` 的 36 個色值（淺色 18、深色 18）與 `.badge-draft`、`.badge-dry-run-status` 的 6 個都寫死。#420 起任務型別改取 `assets/data-palette.css`，中性徽章改用 `--color-ink-muted`／`--color-slate-50`／`--color-border`，徽章裡已沒有 hex → `../design-gaps.md` G-02。

## 鍵盤與焦點

不可聚焦，不在 Tab 順序裡。沒有 `aria-label`，狀態只以顏色與文字呈現。

## 樣式出處

`design/prototype/components-showcase.html:343`–`:371`（基底、狀態、角色）、`design/prototype/pages/shared/task-type-badge.css:1`–`:14`（任務型別）。

## 可重現樣本

`components-showcase#state-default` → `#comp-badges`（`components-showcase.html:1088`），`.badge-role` 樣本在 `:1098`。

## shadcn 對照

候選原語 `Badge`。

- **我們有而它沒有**：任務型別的六色盤、深色模式的第二組色、載入順序的特異性約定。
- **它有而我們沒有**：`asChild`、`variant` 的型別約束。
- **語意對不上**：shadcn 的 `variant` 是四個泛用值（default／secondary／destructive／outline）；我們的變體是**業務語意**（任務狀態、角色、任務型別），對不上一個泛用集合。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 全部三群的樣本 |
| `admin/user-management#state-default`、`admin/role-settings#state-default` | 各自在 `<style>` 重寫 `.badge`（`user-management.html:103`、`role-settings.html:255`） |
| `dashboard/dashboard`（`#param-scenario-super-admin-data`、`#param-scenario-reviewer`） | `dashboard.layout.css:238`、`:269`、`:278` 的 `.badge` 與 `.badge-error`／`.badge-draft`；任務型別配色來自 `shared/task-type-badge.css` |
| `task-management/task-list#state-default` | 本頁 `<style>` 重寫（`task-list.html:90`–`:99`），型別配色同上 |
| `task-management/task-detail`（`#tab-overview`、`#param-status`） | 本頁 `<style>` 重寫（`task-detail.html:115`–`:132`），中性與正式徽章同樣改用 #420 的 token |
| `annotation/annotation-list`（`#state-default`、`#param-run-type`） | **本頁重寫的 `.badge`**（`annotation-list.html:142`–`:178`），階段徽章 `.badge-dry-run`／`.badge-official` 原本寫死 hex，#420 起改用中性 token 與 `--color-accent*`（`:169`–`:178`）→ `../design-gaps.md` G-02 |
| `dataset/dataset-analysis-list`（`#state-default`） | 本頁 `.badge`（`dataset-analysis-list.html:121`）與 `.badge-iaa-*`（`:140`–`:144`）、`.badge-role-pl`／`-rev`（`:146`–`:147`），全用 token；輸出類型用 `task-type-badge.css`（`dataset-analysis-list.html:214` 載入） |
| `dataset/dataset-analysis-detail`（`#tab-quality`、`#state-quality-*`、`#param-q-state-*`） | 本頁 `.badge-pass`／`-fail`／`-warn`／`-neutral`（`dataset-analysis-detail.html:57`–`:62`）與 `.risk-level-badge`（`:149`–`:153`），全用 token |

b1 的帳號頁一個都沒用。b2 已補上（見上表），**五頁都是各自重寫，沒有一頁直接用正典**。b3 已補上（見上表），同樣是本頁重寫。b4 已補上（見上表），兩頁同樣是本頁重寫。
