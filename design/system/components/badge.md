# Badge

> 正典章節：`MASTER.md` §Semantic State Colors（基礎）＋ §Status Badges（role 變體）｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

`.badge` 基底加一個語意 class。單一行內元素，內容是文字，`.badge-role` 另可放一個圖示（`gap: 4px`）。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.badge` 基底 | 必填 | `components-showcase.html:339` |
| 語意 class（狀態或角色或任務型別） | 必填 | `components-showcase.html:352`–`:367`、`pages/shared/task-type-badge.css:6`–`:11` |

基底用 `border: 1px solid transparent` 的簡寫，所以**載入順序有意義**：`task-type-badge.css:2`–`:4` 的註解明寫它必須排在頁面自己的 `<style>` **之後**，否則同特異性下 `border-color` 會被重設掉。

## 變體

| 群 | class | 色來源 |
| :--- | :--- | :--- |
| 任務狀態 | `.badge-draft`、`.badge-dry-run-status`、`.badge-iaa`、`.badge-in-progress`、`.badge-completed`、`.badge-error` | `components-showcase.html:352`–`:357`。前兩個寫死 hex，後四個用 `--color-warning/info/success/error` 系列 |
| 角色 | `.badge-role`（`--radius-full` 藥丸、primary 色系） | `components-showcase.html:360` |
| 任務型別 | `.badge-task-type-single`／`-sequence`／`-relation`／`-pairs`／`-scoring`／`-default` | `pages/shared/task-type-badge.css:6`–`:11`，深色模式另一組 `:13`–`:18` |

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `components-showcase.html:339` |
| hover／focus／disabled／載入中 | **未觀察到**。Badge 不是互動元素 | 正典區塊與 `task-type-badge.css` 都沒有互動偽類 |
| 錯誤 | 有，`.badge-error` 是一個語意變體而非元件狀態 | `components-showcase.html:357` |
| 空 | 未觀察到。沒有「沒有狀態」的樣式 | — |
| 深色模式 | 只有任務型別那一群有 | `task-type-badge.css:13`–`:18` |

## token

`--radius-sm`、`--radius-full`、`--color-warning/info/success/error` 及其 `-bg`／`-border`、`--color-primary`、`--color-primary-soft-bg`、`--color-primary-border`。

`task-type-badge.css` 的 **36 個色值全部寫死**（淺色 18、深色 18），`tokens.css` 沒有任何對應 token；`.badge-draft` 與 `.badge-dry-run-status` 另有 6 個 → `../design-gaps.md` G-02。

## 鍵盤與焦點

不可聚焦，不在 Tab 順序裡。沒有 `aria-label`，狀態只以顏色與文字呈現。

## 樣式出處

`design/prototype/components-showcase.html:339`–`:367`（基底、狀態、角色）、`design/prototype/pages/shared/task-type-badge.css:1`–`:18`（任務型別）。

## 可重現樣本

`components-showcase#state-default` → `#comp-badges`（`components-showcase.html:1084`），`.badge-role` 樣本在 `:1094`。

## shadcn 對照

候選原語 `Badge`。

- **我們有而它沒有**：任務型別的六色盤、深色模式的第二組色、載入順序的特異性約定。
- **它有而我們沒有**：`asChild`、`variant` 的型別約束。
- **語意對不上**：shadcn 的 `variant` 是四個泛用值（default／secondary／destructive／outline）；我們的變體是**業務語意**（任務狀態、角色、任務型別），對不上一個泛用集合。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 全部三群的樣本 |
| `admin/user-management#state-default`、`admin/role-settings#state-default` | 各自在 `<style>` 重寫 `.badge`（`user-management.html:101`、`role-settings.html:316`） |
| `dashboard/dashboard`（`#param-scenario-super-admin-data`、`#param-scenario-reviewer`） | `dashboard.layout.css:241`、`:272`、`:281` 的 `.badge` 與 `.badge-error`／`.badge-draft`；任務型別配色來自 `shared/task-type-badge.css` |
| `task-management/task-list#state-default` | 本頁 `<style>` 重寫（`task-list.html:117`–`:126`），型別配色同上 |
| `task-management/task-detail`（`#tab-overview`、`#param-status`） | 本頁 `<style>` 重寫（`task-detail.html:117`–`:132`） |
| `annotation/annotation-list`（`#state-default`、`#param-run-type`） | **本頁重寫的 `.badge`**（`annotation-list.html:140`–`:175`），階段徽章 `.badge-dry-run`／`.badge-official` 寫死 hex（`:167`–`:174`）→ `../design-gaps.md` G-02 |
| `dataset/dataset-analysis-list`（`#state-default`） | 本頁 `.badge`（`dataset-analysis-list.html:120`）與 `.badge-iaa-*`（`:139`–`:143`）、`.badge-role-pl`／`-rev`（`:145`–`:146`），全用 token；輸出類型用 `task-type-badge.css`（`:210`） |
| `dataset/dataset-analysis-detail`（`#tab-quality`、`#state-quality-*`、`#param-q-state-*`） | 本頁 `.badge-pass`／`-fail`／`-warn`／`-neutral`（`dataset-analysis-detail.html:57`–`:62`）與 `.risk-level-badge`（`:147`–`:151`），全用 token |

b1 的帳號頁一個都沒用。b2 已補上（見上表），**五頁都是各自重寫，沒有一頁直接用正典**。b3 已補上（見上表），同樣是本頁重寫。b4 已補上（見上表），兩頁同樣是本頁重寫。
