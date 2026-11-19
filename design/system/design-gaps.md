# Design Gaps

> 批次 `b1-shared-account` 建立、`b2-admin-dashboard-task`、`b3-annotation-review`、`b4-dataset-sweep` 補寫 ｜交付包 commit `b1fd43c` → `eb9a884`、prototype tree `815b853`

每一筆四欄齊全：**重現方式**（不截圖）、**受影響範圍**、**依據**（兩邊原文都引出來）、**待決問題**。
分三類：原型與業務規格差異 ／ 缺少狀態證據 ／ 待重新設計。

**待決問題不自己回答**（`design-system-setup` 邊界）。已裁定的改成「已裁定（日期）」並保留原題。

---

## 一、原型與業務規格差異

### G-01 `.btn-danger` 有兩份互相矛盾的定義

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `design/prototype/components-showcase.html`，看 `#comp-buttons` 的「刪除任務」：**透明底、紅字、灰框**。再開 `pages/task-management/task-list.html`，叫出刪除確認：**紅底白字實心**。兩顆都是 `class="btn-danger"`。 |
| **受影響範圍** | [Button](components/button.md)、[Modal](modal.md 的 `.btn.btn-danger`)；`components-showcase`、b2 的 `task-list`／`task-new`／`task-detail`／`user-management`／`role-settings`、b3 的 `annotation-workspace` |
| **依據** | `components-showcase.html:179`「`/* Danger Button — destructive actions (logout, delete) */ .btn-danger { background: transparent; color: #B91C1C; border: 1px solid #E2E8F0; }`」 vs `pages/shared/modal.css:77`–`:80`「`/* Solid destructive confirm …, MASTER §Buttons "Danger (solid)". Single definition for all pages. */ .btn-danger { … background: var(--color-error); color: var(--color-on-cta); }`」。showcase **沒有**載入 `modal.css`（它只 `<link>` `tokens.css` 與 `date-range-picker.css`，`:10`–`:11`），六個使用頁面**全部**載入——所以 styleguide 上那個樣式沒有任何出貨頁面會渲出來。 |
| **待決問題** | **已裁定（2026-11-17）**：以 `modal.css` 的實心版為正典，showcase 那份記為 livingstyleguide 與出貨不符。原題保留：若原始 MASTER 本來就是外框版，則是 `modal.css` 改錯了方向，要不要回頭對原始版本？ |

### G-02 正典區塊大量寫死色值，`tokens.css` 沒有對應 token

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `components-showcase.html`，切到深色模式（右上「深色模式」鈕）。Palette 區塊的色票會跟著換；但 `#comp-buttons` 的 `.btn-oauth`／`.btn-icon`／`.btn-language` 仍是白底灰框，`#comp-chips` 的紫／綠／紅唯讀 chip 也不變。 |
| **受影響範圍** | [Button](components/button.md)（18 處／9 個相異值）、[Input](components/input.md)（6）、[Badge](components/badge.md)（**42**：`task-type-badge.css` 淺深各 18 ＋ `.badge-draft`／`.badge-dry-run-status` 6）、[Chip](components/chip.md)（9）、[Color Dot](components/color-dot.md)（8 色盤）、[Skeleton](components/skeleton.md)（6）、[State Panel](components/state-panel.md)（4）、[Avatar](components/avatar.md)（2）、[Divider](components/divider.md)（1）、[Spinner](components/spinner.md)（2）、[List Toolbar](components/list-toolbar.md)（2） |
| **依據** | 例：`pages/shared/task-type-badge.css:6`「`.badge-task-type-single { color: #0E7490; background: #ECFEFF; border-color: #A5F3FC; }`」，`assets/tokens.css` 全檔沒有 `#0E7490`。反例（做對的）：`components-showcase.html:379`「`.status-submitted { color: var(--color-success); background: var(--color-success-soft-bg); }`」。 |
| **待決問題** | **已裁定（2026-11-18，#420）**：分兩類。語意色進 `tokens.css`，中性徽章用 `--color-ink-muted`／`--color-slate-50`／`--color-border`，紫色正式徽章與分類 chip 新增 `--color-accent*`，結果標籤、VA chip 與 State Panel 併入 success／info／error 族（淺色值小幅改變可接受），另新增 `--color-task*`、`--color-badge-notify`、`--color-code-*`、`--color-border-hover`。資料色另放 `assets/data-palette.css`，淺深各一組；JS 的 `ENTITY_COLORS` 只在 `task-config.data.js` 定義一次。原題保留：這些值要不要補成 token？若要，哪些是**語意色**、哪些是**資料色**？ |

**b3 核對**：`annotation/annotation-list` 的 CSS 約 30 個寫死 hex ＋ 1 個 rgba，集中在階段徽章（`annotation-list.html:167`–`:174`）、結果標籤（`:343`–`:345`）與暗色模式覆寫（`:401`–`:407`）；`annotation-workspace` 把同一組結果標籤 hex 再寫一份（`annotation-workspace.html:596`–`:601`），另有 `rgba(99,102,241,0.2)`（`:834`、`:855`）與 `var(--color-surface, #…)` 的 hex 後備值（`:953`）。作答控制項的 hex 在引擎裡 → G-50。

**b4 核對**：`dataset/dataset-analysis-list` 只有一個寫死值，焦點環的 `rgba(99, 102, 241, 0.18)`（`dataset-analysis-list.html:76`）；輸出類型徽章載入 `task-type-badge.css`，那 36 個 hex 已算在上面。`dataset/dataset-analysis-detail` 與十六個 partial 沒有 hex 或 rgba，SVG 與 inline `style` 全用 `var(--*)`；只有平均標記時間的 `<small style="font-size:18px">`（`dataset-analysis-detail.html:273`）寫死字級。

**狀態（#420）**：已修正。`design/prototype/` 的 6 位 hex 從 22 個檔 662 處降到 8 個檔 171 處（不含 `tokens.css` 與 logo SVG）。剩下的分三種，都是刻意留下：

- **資料色本身**：`assets/data-palette.css` 75 處（淺深兩組；實體 8 色與「尚未切分」的深色值是維護者 2026-11-18 追加的）；`task-config.data.js` 33 處與 `task-detail.data.js` 50 處是範例任務的標籤顏色，屬任務設定的資料，照 Color Dot 的規則可以是任意值，不換成變數。
- **註解**：`modal.css:78`–`:79`、`dashboard.components.css:367`、`components-showcase.html:581`、`:762`、`:772`、`:800` 共 7 處，寫的是色值說明。
- **`var()` 的後備值**：`sidebar.css:115`、`:443`、`:741` 與 `account/profile.html:106`，後備值與 `tokens.css` 相同，只在 token 沒載入時生效。與 `tokens.css` 不一致的後備值已一併刪掉。

`white` 關鍵字、`rgba()` 與焦點環的 `color-mix()` 不在本單範圍（`white` 見 #437）。本段列的是修正後的行號；上文盤點的行號指的是修正前。深色主題順帶修正：主色填色上的 `#fff` 改 `--color-on-cta`、當文字用的 slate-400 改 `--color-ink-muted`、深色的關係徽章文字改 `--color-primary-strong`；正式徽章原本沒有深色覆寫，現在跟著 `--color-accent*` 換色。

**狀態（#437）**：`white` 關鍵字已處理。`design/prototype/` 的 CSS、HTML、JS 原有 25 處獨立的 `white`（不算 `--color-white`、`white-space` 這類字串），其中 15 處是實際上色、10 處是註解與文案；上色的 15 處全部換掉。現在剩 11 處，都不是上色：`tokens.css` 的註解 7 處（含 #437 新增的一處）、`dashboard.components.css:358`、`:362` 的註解 3 處、`dataset-analysis-detail.html:785` 的畫面文案 1 處。寫死的 `#fff` 原有 2 處（不算 `modal.css:78` 的註解），換掉側欄通知徽章那處，剩 `account/profile.html:178`：頭像遮罩上的上傳圖示，遮罩固定是 48% 黑，白色在兩種主題都對。改法分三類：

- **主色填色上的字與圖形**改 `--color-on-cta`：Toggle Switch 開啟時的圓鈕（`task-config.css:248`、`components-showcase.html:341`、`account/profile.html:634`）、分類預覽勾選框（`task-config.css:233`）、輸出類型序號徽章（`:490`）、選取 chip 的勾與圓點（`:562`–`:565`，showcase `:524`–`:536`）。帳號頁與個人資料頁 spinner 的其餘三邊由半透明白改成 `--color-on-cta` 的 `color-mix()`。
- **版面底色**改 `--color-white`：關係抽取預覽列（`task-config.css:439`、`:445`）、統一預覽框（`:480`）、任務列表按鈕焦點環的外圈（`task-list.html:69`）。
- **新增兩個 token**：`--color-toggle-thumb`（關閉時的圓鈕，淺色 `#FFFFFF`、深色 `#E2E8F0`；`task-config.css:246`、showcase `:339`、`account/profile.html:627`）與 `--color-on-badge-notify`（側欄通知數字，兩種主題都是 `#FFFFFF`，對 `--color-badge-notify` 6.47:1，`sidebar.css:676`）。

淺色畫面逐頁比對與改前像素相同；深色下上述元件改成深墨或 slate-200，不再是白。`rgba()` 的半透明白（原型狀態切換列，見 [Proto Toggle Bar](components/proto-toggle-bar.md)；`task-detail.html:1787` 的內陰影）與 CSS 裡 data-URI SVG 的 `white`（#438）不在本單範圍。#438 盤點時原型的 data-URI 裡沒有 `white`，這句指的應是下拉箭頭寫死的筆畫色，處理見下段。

**狀態（#438）**：深色主題的色差補齊，淺色只改兩處（下拉箭頭、Toggle Switch 關閉時的軌道，見下）。本段列的是修正後的行號。

- **主色的 `rgba(99,102,241,…)` 改 `color-mix(in srgb, var(--color-primary) N%, transparent)`**，N 照原本的透明度：列表頁焦點環（`list-page.css:30`、`:39`，12%）、showcase 輸入框焦點環（`components-showcase.html:305`，12%）、showcase 頭像框線（`:911`，20%）、`dataset-analysis-list.html:78` 的列焦點（18%）、`annotation-workspace.html:123`、`:833`、`:854`（20%）。淺色計算值與改前相同，深色跟著深色主色換。其他頁的 `rgba()` 焦點環（`task-config.css`、`task-new.html`、`task-detail.html`、`user-management.html`、`role-settings.html`、`sidebar.css`、`account/profile.html`、帳號頁、`task-list.html`）不在本單範圍，還在。
- **`task-detail.html:1787` 的內陰影**改 `color-mix(in srgb, var(--color-white) 92%, transparent)`：淺色同值，深色變成卡片底色的 92%，不再是一條亮白線。
- **下拉選單箭頭**：data-URI SVG 讀不到 `var()`，`<select>` 又沒有偽元素可以改用 mask，所以每個主題各寫一份 URI，筆畫色對齊 `--color-ink-muted`（淺色 `#5E6B7F`、深色 `#9CA3AF`）。共 9 條規則：`list-page.css:34`、`:103`（深色 `:108`–`:109`）、`user-management.html:79`、`:138`、`:164`（深色 `:171`–`:173`）、`dashboard.components.css:371`（深色 `:377`）、`task-detail.html:227`、`:623`（深色 `:233`、`:629`）、`task-new.html:68`（深色 `:73`）。淺色由 `#94A3B8` 改 `#5E6B7F`：舊色 #420 起已不是 token，對白底只有 2.56:1；新色 5.40:1。這是淺色的可見改變，維護者若要保留舊色可以只還原淺色那一份。
- **Toggle Switch 關閉時的軌道**由 `--color-border` 改 `--color-border-control`（`components-showcase.html:338`、`task-config.css:245`、`account/profile.html:616`）。圓鈕 `--color-toggle-thumb` 疊在舊軌道上淺色只有 1.23:1，達不到 UI 元件的 3:1；改軌道而不改圓鈕，因為軌道對頁面底色也要 3:1（白底 3.55、頁底 3.23:1），圓鈕對新軌道淺色 3.55、深色 4.26:1。這是淺色的可見改變（軌道由 `#E2E8F0` 變 `#7C899D`）。`token-usage.json` 補了這一組對比，`tokens.json` 的未達清單仍是原本 8 組。
- **showcase 頭像**：首字 `.avatar-preview` 改 `--color-on-cta`（`components-showcase.html:928`）；上傳遮罩的圖示改寫死 `#fff`（`:943`），理由同 `account/profile.html:178`：遮罩在兩種主題都是黑色半透明，白色兩邊都對。所以寫死的 `#fff` 現在是 2 處。
- **showcase 色點外框**：`.entity-color-dot`、`.annotation-preview-color` 淺色的黑色半透明不變，深色加一條覆寫改 `--color-ink` 的 18%（`components-showcase.html:738`–`:740`），對齊 `task-config.css` 的做法。
- **`dataset-analysis-detail.html:10`** 補載 `assets/data-palette.css`：實體色點的 `--data-entity-N` 原本在這頁是空值（淺色計算出 `#6366F1`，深色 `#818CF8`）。

沒有新增 token。Playwright 逐頁比對改前改後（showcase、任務／標記／資料集分析三個清單頁、資料集分析詳情、使用者管理、儀表板、任務詳情兩個視圖、新增任務、個人資料、標記工作區，淺深各一次）：淺色只有上面列的箭頭、軌道、showcase 輸入框文字色（瀏覽器預設黑 → `--color-ink`）與新的 `.btn-secondary:hover` 有差；焦點環、頭像框線、內陰影、工作區框線的計算值與改前相同。

### G-03 帳號頁一個正典 `.btn-*` 都沒用，各自重寫

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `pages/account/login.html`，檢視原始碼：送出鈕是 `class="login-btn"`，Google 鈕是 `class="sso-btn"`，語言鈕是 `class="lang-toggle"`。再開 `register.html`／`forgot-password.html`／`reset-password.html`：送出鈕變成 `class="submit-btn"`。五頁都**沒有** `<link>` 任何 `pages/shared/*.css`。 |
| **受影響範圍** | [Button](components/button.md)、[Input](components/input.md)、[State Panel](components/state-panel.md)、[Alert Banner](components/alert-banner.md)；`account/login`、`register`、`forgot-password`、`reset-password`、`verify-email`，以及 `account/profile` 的 `.sent-card` |
| **依據** | 正典：`components-showcase.html:226`「`/* OAuth Button — third-party auth entry (Google, GitHub) */ .btn-oauth { … }`」。實作：`pages/account/login.html:182`「`.sso-btn { width: 100%; display: flex; … border: 1px solid var(--color-border); … }`」。同理 `.btn-language`（`:268`）vs `.lang-toggle`（`login.html:88`）、`.btn-primary`（`shared/button.css:4`）vs `.login-btn`（`login.html:304`）／`.submit-btn`（`reset-password.html:280`）。State Panel 的兩個正典樣本（`components-showcase.html:1339`「Check your email」、`:1347`「Reset link is invalid」）畫的就是帳號頁，但帳號頁用的是 `.success-panel`（`forgot-password.html:444`）與 `.token-error-panel`（`reset-password.html:499`）。 |
| **待決問題** | **已裁定（2026-11-17）**：視為同一個元件，規格用正典名，頁面的 class 記在這裡。原題保留：要不要讓帳號頁改載 `shared/button.css`？那會動到 `design/prototype/`，屬**畫面修正**，要先走 `AGENTS.md` 的 Ready gate。 |

**狀態（#420）**：部分處理。五個帳號頁（`login`、`register`、`forgot-password`、`reset-password`、`verify-email`）改載 `assets/tokens.css`，刪掉各自的 `:root` 與深色 token 鏡像；私有別名 `--color-card`、`--color-border-focus`、`--color-link` 換成同值的 `--color-white`、`--color-primary`、`--color-primary-strong`。Google 標誌改用共用的 `assets/google-g.svg`。主色填色上的白字改 `--color-on-cta`（原本 `#064E3B` 一類的寫死值也是）。按鈕 class（`.login-btn`／`.sso-btn`／`.submit-btn`）**沒有**改成正典 `.btn-*`，也還沒載入 `shared/button.css`；上面的原題仍待決。上文的行號指的是修正前。

### G-04 `.input` 的正典與出貨兩份不一致

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `components-showcase.html` 的 `#comp-inputs`，點輸入框看 focus ring。再開任何載入 `shared/input.css` 的頁面做同樣的事。兩者的 ring 來源不同。 |
| **受影響範圍** | [Input](components/input.md)、[List Toolbar](components/list-toolbar.md) |
| **依據** | `pages/shared/input.css:21`「`box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);`」 vs `components-showcase.html:301`「`box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);`」。同樣寫死的還有 `pages/shared/list-page.css:30`、`:39`。另外正典多出 `.input.error`（`components-showcase.html:304`）、`.input[readonly]`（`components-showcase.html:309`）、`.field-hint`（`components-showcase.html:318`）、`.field-error`（`components-showcase.html:325`）四條，`input.css` 一條都沒有。 |
| **待決問題** | 正典多出的四條要不要搬進 `input.css`？`color-mix` 與 `rgba` 哪一個是目標寫法？ |

**狀態（#438）**：焦點環已統一。showcase 的 `.input:focus` 與 `list-page.css` 的兩條改成和 `input.css` 相同的 `color-mix(in srgb, var(--color-primary) 12%, transparent)`（`components-showcase.html:305`、`list-page.css:30`、`:39`）。showcase 的 `.input` 另補了底色與文字色（`:296`–`:297`），原本沒有，深色下是瀏覽器預設的白底黑字；底色用 `--color-white`，**不是** `input.css` 的 `--color-surface`，兩份的底色差異照舊，正典多出的四條也還沒搬，上面兩題的第一題仍待決。上文的行號指的是修正前。

**b3 核對**：`annotation-workspace` 的「無法判定」理由與審核理由用正典 `.input`／`.input-textarea`；但專案負責人例外處置的理由輸入框是 inline 樣式（`annotation-workspace.config.js:5042`–`:5050`，`--color-border`、`--radius-sm`、`--color-surface`），沒有用 `.input`。

### G-07 Alert Banner 只有 error，但出貨頁面需要更多

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `components-showcase.html` 的 `#comp-banner`：只有一種紅色。再開 `pages/admin/user-management.html`，它自己多寫了一個黃色的。`pages/account/register.html` 另有 `.banner--success` 與 `.banner--error` 兩種，`account/profile.html` 又有 `.info-banner`。 |
| **受影響範圍** | [Alert Banner](components/alert-banner.md)；`components-showcase`、`account/register`、`account/profile`、b2 的 `admin/user-management` |
| **依據** | 正典：`components-showcase.html:388`–`:398`，`.alert-banner` 把 `--color-error-*` 直接寫在基底上，沒有修飾子。出貨：`pages/admin/user-management.html:182`「`.alert-banner.warning { background: var(--color-warning…`」。章節名叫「Error / Alert Banner」，實作只有 Error。 |
| **待決問題** | 要不要把 banner 補成四色（success／info／warning／error），和 [Toast](components/toast.md) 一致？`register` 的 `.banner--*` 與 `user-management` 的 `.alert-banner.warning` 哪一種命名當基準？ |

### G-12 `.page-btn.active` 的文字色，正典與出貨用不同 token

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 切到深色模式，看任何清單頁目前頁碼的文字。正典版會換色，出貨版固定白。 |
| **受影響範圍** | [Pagination](components/pagination.md)；b2 的 `admin/user-management`、`task-list`、`task-detail` 四個 panel，b3 的 `annotation-list`，b4 的 `dataset-analysis-list` |
| **依據** | `components-showcase.html:615`「`color: var(--color-on-cta); /* WCAG AA foreground token, issue singyichen/label-suite#1019 */`」 vs `pages/shared/list-page.css:92`「`.page-btn.active { background: var(--color-primary); color: var(--color-white); … }`」。正典那一行**附了無障礙理由**，出貨那一行沒有。 |
| **待決問題** | `list-page.css` 要不要改成 `--color-on-cta`？深色模式下 `--color-white` 疊在 `--color-primary` 上的對比度實測是多少？（本批次沒有量，不猜。） |

**狀態（#438）**：已修正。`list-page.css:92` 改用 `--color-on-cta`，與正典一致。改前深色的 `--color-white` 是卡片底色 `#16161F`，疊在深色主色 `#818CF8` 上，實測文字是 rgb(22, 22, 31)；改後是 rgb(30, 27, 75)（`--color-on-cta` 的深色值），對比 5.36:1。淺色兩者都是白，畫面不變。`task-list` 原本就有頁內覆寫，不受影響；`dataset-analysis-list` 與 `dataset-analysis-detail` 的目前頁碼在深色下跟著變。上文的行號指的是修正前。

### G-18 Divider 的唯一指名用途，實作沒有採用

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `pages/account/login.html`，看 Google 鈕與帳密欄之間那條帶「或」的線。再開 `components-showcase.html` 的 `#comp-divider` 第二個樣本。外觀接近，做法不同。 |
| **受影響範圍** | [Divider](components/divider.md)；`account/login` |
| **依據** | 正典：`components-showcase.html:1267`「`§Divider — 水平線 / 文字分隔（僅登入頁 OAuth 與帳號登入之間）…`」，CSS 是 `.divider-text` ＋ 兩個 `<hr class="divider-hr">`（`:841`–`:843`）。實作：`pages/account/login.html:185` 的 `.divider` 用 `::before`／`::after`（`:193`），markup 是 `<div class="divider"><span id="dividerText">或</span></div>`（`:414`）。`.divider-hr` 全 prototype 只有 showcase 用。 |
| **待決問題** | 正典要不要改成 `::before`／`::after` 的做法（少兩個 DOM 節點），還是 `login.html` 改用正典？ |

**b4 核對**：`dataset-analysis-detail` 又有一份做法，`hr.panel-divider`（`dataset-analysis-detail.html:54`，用 `--color-border-muted`），用在 `stats-single_dim.html:27` 與 `stats-multi_dim.html:61`；也不是正典的 `.divider-hr`。

### G-19 `.metric` 的正典少了 `display: block`

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 把 `components-showcase.html:973` 那條 chrome 規則註解掉再開頁，`#comp-metric` 的標籤與數值會擠在同一行。 |
| **受影響範圍** | [Metric KPI Tile](components/metric.md)；`components-showcase`、b2 的 `dashboard`、`task-detail` 三個 panel、b4 的 `dataset-analysis-detail` |
| **依據** | 出貨：`pages/shared/metric.css:9`「`.metric span { display: block; … }`」、`:19`「`.metric strong { display: block; … }`」，另有正典沒有的 `.metric-desc`（`:27`）與 `.metric-lg`（`:35`）。正典：`components-showcase.html:817`、`:825` 都沒有 `display: block`，showcase 只好在非正典區塊補：`:970`–`:973`「`/* Shipped dashboard.layout.css gives .metric span/strong display:block; MASTER §Metric KPI Tile omits it — mirrored here as chrome so the canonical block above stays verbatim. */`」。 |
| **待決問題** | 正典要不要補上 `display: block` 與那兩個 shipped 的變體？ |

### G-26 `.task-table` 這個名字和它的用途對不上

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `pages/dataset/dataset-analysis-list.html` 或 `pages/annotation/annotation-list.html`，表格的 class 是 `task-table`，但那裡面一列不是任務。 |
| **受影響範圍** | [Data Table](components/data-table.md)；b2 的 `task-list`、`user-management`，b3 的 `annotation-list`，b4 的 `dataset-analysis-list` |
| **依據** | `pages/shared/list-page.css:1`–`:5`「`Shared list-page chrome …: toolbar, search / filter / clear controls, data table and pagination, moved verbatim from dataset-analysis-list. … dataset-analysis-list, task-list and annotation-list adopt it`」——檔頭自己說它是通用的，class 名卻留著 `task-`。 |
| **待決問題** | 要不要改名？改名會動到四個頁面的 markup，屬**畫面修正**，要走 Ready gate。 |

### G-28 五個帳號頁複製了同一組元件，已經分裂

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 並排開五個登出帳號頁，肉眼幾乎一樣。檢視各自 `<style>` 裡的 `.card`、`.navbar`、`.spinner`、`.submit-btn`、`.success-panel`。 |
| **受影響範圍** | [Auth Card](components/auth-card.md)、[Auth Navbar](components/auth-navbar.md)、[Spinner](components/spinner.md)、[Button](components/button.md)、[State Panel](components/state-panel.md)、[Password Eye Toggle](components/password-eye-toggle.md)；五個登出帳號頁 ＋ `account/profile` |
| **依據** | 比對方式是**對整個元件的規則家族**（不是單一 class）做雜湊：Auth Card 取 `.card` ＋ `.card-header` ＋ `.card-logo` ＋ `.card-title` ＋ `.card-subtitle`，Auth Navbar 取 `.navbar` ＋ `-brand` ＋ `-logo` ＋ `-wordmark`。

| 元件（規則家族） | 份數 | 分組 |
| :--- | ---: | :--- |
| Auth Card | **4** | login／register／forgot-password／{reset-password, verify-email} |
| Auth Navbar | **2** | {login, register, forgot-password}／{reset-password, verify-email} |
| `.spinner` | **2** | {login, forgot-password, reset-password}／register |
| `.submit-btn` | **2** | register（`:hover:not(:disabled)`、`[hidden]`）／{forgot-password, reset-password}（`:hover`、`:active`） |

**逐個 class 看的話分歧少得多**，這點要寫清楚以免誤導：`.navbar`、`.navbar-brand`、`.navbar-wordmark`、`.card-header`、`.card-title`、`.lang-toggle`、`.success-panel` 這七個**五頁（或三頁）完全相同**；`.card` 只有兩份（`register.html` 的行動版覆寫少了一行 `border-radius`）。

把家族推成 4 份與 2 份的其實是三個子元件：`.card-logo` 與 `.navbar-logo`（{login, register, forgot-password} vs {reset-password, verify-email}）、`.card-subtitle`（login vs 其餘四頁）。`verify-email` 的 `.success-panel` 家族多一個 `-hint`，但 `.success-panel` 本身三頁相同。

代表位置：`login.html:98`（`.card`）、`:27`（`.navbar`）、`:306`（`.spinner`）、`:66`（`.lang-toggle`）。 |
| **待決問題** | 要抽成 `pages/shared/auth.css` 嗎？若要，四份 `.card` 以哪一份為準？（本批次不挑，挑了就是撰寫者自己的判斷。） |

### G-29 `--color-card` 是五個帳號頁的私有 token

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 在 `components-showcase.html` 的 Palette 區塊找 `--color-card`：**找不到**（那一頁從 `tokens.css` 即時列舉）。但五個帳號頁都在用它。 |
| **受影響範圍** | [Auth Card](components/auth-card.md)、[Auth Navbar](components/auth-navbar.md)、[Language Toggle](components/lang-toggle.md)；五個登出帳號頁 |
| **依據** | `assets/tokens.css` 全檔沒有 `--color-card:` 的定義。五頁各自定義兩次（淺色 `#FFFFFF`、深色 `#16161F`）：`login.html:19`／`:372`、`register.html:19`／`:348`、`forgot-password.html:19`／`:312`、`reset-password.html:19`／`:406`、`verify-email.html:24`／`:310`。全站 **22 處**引用 `var(--color-card)`，全部在這五頁。值五頁一致。 |
| **待決問題** | 要升格進 `tokens.css` 嗎？它和既有的 `--color-surface`／`--bg-surface`／`--color-white` 是什麼關係——是第四個同義詞，還是真的有區別？ |

**狀態（#420）**：已修正。依 G-03 的處理，五個帳號頁改載 `tokens.css`、刪掉本地 token；`--color-card` 不升格，換成同值的 `--color-white`（淺色 `#FFFFFF`、深色 `#16161F`，與 `tokens.css` 相同），全站已沒有 `var(--color-card)`。上文的行號指的是修正前。

### G-33 `account/profile` 重新定義了它已經載入的共用元件

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `pages/account/profile.html`，它第 `:12` 行 `<link>` 了 `shared/button.css`；再往下看它自己的 `<style>`，裡面又寫了一次 `.btn-primary`、`.btn-secondary`、`.input`、`.toggle-switch`、`.skeleton` 等。 |
| **受影響範圍** | [Button](components/button.md)、[Input](components/input.md)、[Toggle Switch](components/toggle-switch.md)、[Skeleton](components/skeleton.md)、[Avatar](components/avatar.md)、[Toast](components/toast.md)；`account/profile` |
| **依據** | `profile.html` 的 `<style>` 定義了 66 個 class，其中與共用檔同名的至少有：`btn-primary`、`btn-secondary`、`input`、`toggle-switch`、`toggle-slider`、`skeleton`、`skel-avatar`、`skel-line`、`skel-input`、`skel-btn`、`avatar-wrap`、`avatar-preview`、`avatar-overlay`、`avatar-hint`、`toast`。頁面的 `<style>` 在 `<link>` 之後，所以同特異性下頁面贏。 |
| **待決問題** | 這些覆寫是刻意的（profile 的尺寸確實和正典不同，例如頭像 72px vs 80px）還是複製貼上的殘留？逐條判斷屬畫面修正。 |

---

### G-37 b2 的頁面重新定義了已載入的共用按鈕，還有兩套第二按鈕系統

> b2 新增。延伸 G-03／G-33 的同一類現象到 b2；G-33 的裁定不重開。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `pages/dashboard/dashboard.html`，Tab 到任一顆 `.btn`：焦點環是一圈寫死的半透明色，不是 `tokens.css` 的焦點 token。再開 `pages/task-management/task-detail.html?tab=member-management`，表格列上的小按鈕是 `.mini-btn`，與正典 `button.css` 的任何 variant 都不同尺寸。 |
| **受影響範圍** | [Button](components/button.md)、[Tooltip](components/tooltip.md)、[List Toolbar](components/list-toolbar.md)、[Pagination](components/pagination.md)；`dashboard/dashboard`、`task-management/task-detail`、`task-list`、`admin/user-management`、`admin/role-settings` |
| **依據** | `dashboard.layout.css:211`–`:240` 自建 `.btn` 系統（`.btn-emerald`／`.btn-violet`／`.btn-indigo` 正典沒有），`:235` 焦點環寫死 rgba；`task-detail.html:777`–`:799` 的 `.mini-btn`（29 處），`:799` 同樣寫死 rgba；`role-settings.html:93`–`:94`、`:257`–`:258` 重寫 `.btn-ghost`／`.btn-cta`；`user-management.html:54` 重寫 `.btn-primary`／`.btn-ghost`、`:166`–`:167` 重寫 modal 規則；`task-list.html:160`–`:166` 已載 `list-page.css` 又重寫工具列；`task-config.css:293` 的 tooltip 觸發鈕焦點環也是寫死 rgba。 |
| **待決問題** | **已裁定（2026-11-18）**：`.mini-btn` 收進 `button.css` 成為小尺寸 variant，dashboard 彩色鈕改用既有 variant。修正於 #423。原題保留：`.mini-btn` 與 dashboard 的彩色按鈕要收進正典成為 variant，還是改用既有 variant？（維護者決定；本 skill 不作答。） |

**b3 核對**：`.mini-btn` 又多兩份——`annotation-list.html:266`–`:287`（焦點環寫死 rgba，`:280`）與 `annotation-workspace.html:578`–`:600`（全用 token，另有 `-active-approve`／`-modify`／`-bypass`、`-danger` 四個 variant，審核三向決策靠它）。全 prototype 共四份。

**b4 核對**：`dataset-analysis-detail` 載入正典 `button.css` 後又在頁內重寫 `.btn`（`dataset-analysis-detail.html:166`–`:172`，零特異性）；`dataset-analysis-list` 沒有載入 `button.css`，按鈕是 `list-page.css` 的 `.clear-btn`／`.page-btn`。b4 沒有 `.mini-btn`。

**狀態（#423）**：已修正裁定的部分。`.mini-btn` 收進 `pages/shared/button.css:62`–`:158`，含 `-primary`／`-success`／`-warning`／`-danger`／`-log`／`-icon`；`task-list`、`task-detail`、`user-management`、`role-settings`、`annotation-list`、`annotation-workspace` 六份頁內定義刪除，`annotation-workspace` 只留審核決策的 `-active-*` 選中狀態。焦點環改 `outline: 2px solid var(--color-primary)`（與 `date-range-picker.css` 同一寫法），`dashboard.layout.css` 的 `.btn:focus-visible` 與 `task-config.css` 的 tooltip 觸發鈕也一併改。dashboard 三顆角色 CTA 改用 `.btn-cta`，`.btn-emerald`／`.btn-violet`／`.btn-indigo` 與其深色覆寫刪除。**未處理**（裁定沒有涵蓋）：`role-settings`、`user-management` 重寫 `.btn-ghost`／`.btn-cta`／`.btn-primary` 與 modal 規則、`task-list` 重寫工具列、`dataset-analysis-detail` 重寫 `.btn`。上文的行號指的是修正前。

### G-39 三個任務管理頁的 toast 不照 UXC-07，`role-settings` 的位置與規格不同

> b2 新增。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `pages/task-management/task-list.html?unauthorized=1`：錯誤 toast 3 秒後自己消失。開 `pages/admin/role-settings.html`，改一格後儲存：成功 toast 出現在**畫面上方置中**。 |
| **受影響範圍** | [Toast](components/toast.md)、[`ux-conventions.md`](ux-conventions.md) UXC-07；`task-management/task-list`、`task-new`、`task-detail`、`admin/role-settings` |
| **依據** | 時長：`task-list.html:599`–`:606` 的 `showToast` 一律 3000 ms，`task-new.html:858`–`:865` 一律 3500 ms，`task-detail.html:11255` 一律 2400 ms——三者都不分類型，錯誤也會自動消失；UXC-07 要求 error 為 0（只能手動關，`components-showcase.html:1500`）。位置：`role-settings.html:213`「`/* ── Toast (top-center, UXC-07 / MASTER §Toast) */`」、`:216` `top: 24px` vs [`06-admin/02-role-settings.mdx`](../../docs/specs/06-admin/02-role-settings.mdx) 第 343 行「通知出現在頁面**右下角**，**依類型決定多久自動消失**」與驗收標準第 663–664 行「通知出現在右下角」。 |
| **待決問題** | **已裁定（2026-11-18）**：三頁的 toast 對齊 UXC-07 分級時長；`role-settings` 的位置以規格的右下角為準，規格不改。修正於 #423。原題保留：一、三個任務管理頁的 toast 是否要改成 UXC-07 的分級時長？二、`role-settings` 的 toast 位置以規格的右下角為準，還是規格要改成上方置中？（規格屬維護者。） |

**狀態（#423）**：已修正。`task-list`、`task-new`、`task-detail` 的 `showToast` 改用 `TOAST_DURATIONS = { success: 3000, info: 5000, warning: 8000, error: 0 }`，error 不設計時器；三頁的 toast 加上關閉鈕（`#toastClose`，雙語 `aria-label`），隱藏時以 `visibility: hidden` 移出 Tab 順序。舊呼叫第二個參數傳 `true` 的視為 error、省略的視為 success；`task-list` 的「前往任務詳情…」改為 info。`role-settings` 的 `.toast-container` 改成右下角（`bottom: 24px; right: 24px`）。上文的行號指的是修正前。

### G-41 卡片有四份實作，沒有共用檔

> b2 新增。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 在 `dashboard/dashboard`、`task-management/task-detail`、`task-management/task-new` 與 b1 的 `account/profile` 各看一張卡片：外觀相同（邊框、圓角、白底、內距），但 class 分別是 `.panel`、`.panel`、`.form-card`、`.section-card`，各寫在自己的檔案裡。 |
| **受影響範圍** | [Card](components/card.md)；上列四頁 |
| **依據** | `dashboard.layout.css:171`–`:180`（註解自稱 MASTER §Cards）、`task-detail.html:91`–`:95`、`task-new.html:51`–`:52`、`account/profile.html` 的 `.section-card`。`pages/shared/` 底下沒有卡片的 CSS。 |
| **待決問題** | **已裁定（2026-11-18）**：抽成 `pages/shared/card.css`，以 `.panel` 為準。修正於 #423。原題保留：要不要抽成 `pages/shared/card.css`、以哪一份為準？ |

**b3 核對**：第五份是 `annotation-workspace.html:248`–`:252` 的 `.content-card`，同樣四條規則。

**b4 核對**：第六份是 `dataset-analysis-detail.html:49` 的 `.panel`，十六個 partial 全用它。

**狀態（#423）**：已修正。容器四條規則抽成 `pages/shared/card.css`，以 `.panel` 為準，`.form-card`、`.section-card`、`.content-card` 列為同一條規則的別名，markup 不改。六頁都載入它，頁內只留各自的變體（`dashboard` 的直向 flex、`task-detail`／`task-new`／`dataset-analysis-detail` 的 `margin-bottom`、`profile` 的 `margin-bottom` 與手機版內距），`annotation-workspace` 的 `.content-card` 整段刪除。六頁淺深色的邊框、圓角、底色、內距與外距實測與修正前相同。上文的行號指的是修正前。

### G-42 `task-detail` 重新定義了 Toggle Switch，與同頁載入的正典不同

> b2 新增。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `pages/task-management/task-detail.html?tab=settings`，再開 `pages/task-management/task-new.html` 第二步：兩邊的開關一個 42×24、開啟時是 CTA 色，另一個 40×22、開啟時是主色。 |
| **受影響範圍** | [Toggle Switch](components/toggle-switch.md)；`task-management/task-detail#tab-settings`、`task-new#state-step2` |
| **依據** | `task-detail.html:306`–`:332` 定義 `.toggle-switch`（42×24，`--color-cta`）；同頁也載入 `task-config.css`，其 `:242`–`:247` 與 `components-showcase.html:331`–`:336` 逐字相同（40×22，`--color-primary`）。頁內 `<style>` 在後，蓋過正典。 |
| **待決問題** | **已裁定（2026-11-18）**：以正典為準（40×22、開啟為主色）。修正於 #423。原題保留：設定分頁的開關以哪一份為準？ |

**狀態（#423）**：已修正。`task-detail.html` 頁內的 `.toggle-switch`／`.toggle-slider` 重新定義整段刪除，只留一行註解指向 `task-config.css`；設定分頁的開關實測 40×22、開啟為 `--color-primary`（淺色 `rgb(99, 102, 241)`、深色 `rgb(129, 140, 248)`）。上文的行號指的是修正前。

### G-45 刪除任務的確認視窗可以點遮罩關閉，與 UXC-10 相反，但規格要它這樣

> b2 新增。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `pages/task-management/task-list.html`，叫出刪除確認，點視窗外面：視窗關閉。再開 `pages/admin/user-management.html`，叫出停用確認，點視窗外面：視窗不關。 |
| **受影響範圍** | [Modal](components/modal.md)、[`ux-conventions.md`](ux-conventions.md) UXC-10；`task-management/task-list#sim-delete-error` |
| **依據** | `task-list.html:1197`–`:1199` 點遮罩即關 vs `user-management.html:1357`「`/* UXC-10: a destructive confirmation must not dismiss on overlay click */`」。規格站在 `task-list` 那邊：[`03-task-management/01-task-list.mdx`](../../docs/specs/03-task-management/01-task-list.mdx) §刪除任務 第 5 條「點視窗外面，或按 Esc → 視窗關閉」。 |
| **待決問題** | **已裁定（2026-11-18）**：刪除任務也適用 UXC-10，點遮罩不關。規格那一條要改，屬維護者。原型修正於 #423。原題保留：UXC-10 的「點遮罩不關」要不要適用到刪除任務？若要，規格那一條要改（屬維護者）；若不要，UXC-10 要寫明例外。 |

**狀態（#423）**：原型已修正，規格未改。`task-list.html` 刪除確認的遮罩點擊關閉整段刪除；另在遮罩的 `mousedown` 取消預設動作，因為 `modal-focus.js` 的 Esc 監聽掛在視窗上，焦點一掉到 `body` Esc 就失效。淺深色實測：點遮罩不關、焦點留在「取消」，Esc、「取消」、「刪除」都能關。規格 `01-task-list.mdx` §刪除任務 第 5 條與 A1 替代流程仍寫「點視窗外面 → 視窗關閉」，屬維護者改。上文的行號指的是修正前。

### G-46 指引閘門按 Esc 就能不確認直接開始

> b3 新增。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開一個要求先讀說明、這個帳號尚未確認的任務的 `pages/annotation/annotation-workspace.html`，指引閘門出現後按 Esc：彈窗關閉，可以開始作答。重新整理：彈窗再出現（確認沒有被記下）。 |
| **受影響範圍** | [Modal](components/modal.md)；`annotation/annotation-workspace#modal-guideline-gate` |
| **依據** | `annotation-workspace.config.js:6845`–`:6850` 開閘門時傳 `onClose: hideGuidelineModal`，`hideGuidelineModal`（`:6818`–`:6822`）只關彈窗、不寫確認紀錄；`pages/shared/modal-focus.js:42`–`:44` 在 Esc 時呼叫 `onClose`。規格 [`04-annotation/02-annotation-workspace.mdx`](../../docs/specs/04-annotation/02-annotation-workspace.mdx) §指引閘門 第 3 條「開關開著時，進場顯示說明彈窗，**使用者按確認按鈕才開始**」。 |
| **待決問題** | **已裁定（2026-11-18）**：閘門忽略 Esc，只能按確認，保留返回清單的出口。修正於 #423。原題保留：閘門要不要忽略 Esc（只能按確認）？若 Esc 可以關，關掉之後算不算「開始」——要不要擋住作答？ |

**狀態（#423）**：已修正。閘門開啟時傳給 `modal-focus.js` 的 `onClose` 改成空函式，Esc 只被取消、不關彈窗；只有確認鈕會關閉並寫確認紀錄。原本閘門沒有確認以外的出口，所以在確認鈕左邊加了 `.btn-secondary`「返回標記清單／Back to annotation list」，走 `buildListReturnUrl()`，不寫確認紀錄，下次進來照樣顯示。淺深色實測：按 Esc（焦點在彈窗內、Tab 之後再按）彈窗都還在；返回鈕回到 `annotation-list.html?task_id=…&role=…&run_type=…`；確認鈕關閉彈窗。`modal-focus.js` 預設把焦點放在第一個可聚焦元素，也就是返回鈕；依維護者裁定（2026-11-18），開啟後再把焦點移到確認鈕（`annotation-workspace.config.js:6902`），初始焦點落在主要動作上。上文的行號指的是修正前。

### G-47 送出被擋時，畫面看不出是哪一個區塊擋住

> b3 新增。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `pages/annotation/annotation-workspace.html`，選一筆有兩個以上輸出類型的樣本，只作答其中一個就按「提交」：出現「請完成所有標記項目後再提交」的通知，但未完成的那個區塊外觀不變。 |
| **受影響範圍** | [Card](components/card.md)、[Toast](components/toast.md)、[`ux-conventions.md`](ux-conventions.md) UXC-04；`annotation/annotation-workspace#role-annotator` |
| **依據** | `annotation-workspace.config.js:3048` 對未完成的區塊設 `data-error="true"`（`:2926` 清掉），但全 prototype 沒有任何 CSS 選到 `[data-error]`。規格 [`04-annotation/02-annotation-workspace.mdx`](../../docs/specs/04-annotation/02-annotation-workspace.mdx) §作答完整性與提交阻擋 第 2 條「任一個還沒完成時：**阻擋提交並提示對應的那個區塊**」，第 4 條要「**可定位的**錯誤」。 |
| **待決問題** | **已裁定（2026-11-18）**：未完成區塊框線換錯誤色，區塊內顯示錯誤文字（以 `aria-describedby` 綁定），焦點捲到第一個未完成區塊。修正於 #423。原題保留：「提示對應的那個區塊」要長什麼樣（框線換色、區塊內的錯誤文字、捲到第一個）？是否另需讓輔助科技讀得到？ |

**狀態（#423）**：已修正。送出被擋時，每個未完成的輸出區塊：`data-error="true"` 有了樣式（2px `--color-error` outline，錯誤態另加 `--space-sm` 內距與上下間距，因為區塊本身沒有內距、彼此緊貼）；區塊末尾加一行 `.ws-output-error` 錯誤文字（`--text-label`、`--color-error`，中文「這一項還沒作答，完成後才能送出」、英文 "Answer this item before submitting"），以 `aria-describedby` 綁到區塊；第一個未完成區塊設 `tabindex="-1"`、取得焦點並捲到畫面中央。原本的 warning toast 保留。作答時引擎重繪該區塊，錯誤態跟著清掉（UXC-05）。淺深色、中英文以 `T013`（實體＋關係＋多維度三個區塊）實測。上文的行號指的是修正前。

### G-48 標記清單沒帶任務時，借用了「找不到這個任務」的標題

> b3 新增。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `pages/annotation/annotation-list.html`，不帶 `task_id`：面板標題是「找不到這個任務」，說明是「未指定任務，請回到儀表板重新選擇任務。」。 |
| **受影響範圍** | [Empty State](components/empty-state.md)；`annotation/annotation-list#state-no-task` |
| **依據** | `renderNotFound`（`annotation-list.html:2312`–`:2342`）兩種情況共用標題 `notFoundTitle`（`:2323`、文案 `:614`），只換說明（`:2327`、`:616`）。規格 [`04-annotation/01-annotation-list.mdx`](../../docs/specs/04-annotation/01-annotation-list.mdx) §路由上下文與回退 第 6 條只寫「顯示『未指定任務，請回到儀表板重新選擇任務。』與一個回儀表板的入口」，第 7 條才是「顯示『找不到這個任務』」。 |
| **待決問題** | **已裁定（2026-11-18）**：標題改「尚未選擇任務」。修正於 #423。原題保留：沒帶任務時要不要有標題？有的話用什麼字？ |

**狀態（#423）**：已修正。`renderNotFound` 依有沒有 `task_id` 選標題：沒帶是新的 `noTaskTitle`「尚未選擇任務」／"No task selected"，帶了查不到仍是「找不到這個任務」／"Task not found"；兩種情況的說明與「回儀表板」不變。淺深色、中英文以不帶參數與 `?task_id=NOPE` 實測。上文的行號指的是修正前。

### G-52 交付包說切換鈕在序列標註的統計總覽，實際在實體辨識的品質監控

> b4 新增。屬交付包，不是本 skill 能改的。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 照交付包的 `dataset/dataset-analysis-detail#state-seq-match-strict` 開一個序列標註任務的統計總覽：找不到 `#matchStrict`。改開實體辨識任務並加 `?tab=quality`，品質監控最上面的卡片才有 `Strict match`／`Partial overlap` 兩顆鈕。 |
| **受影響範圍** | `dataset/dataset-analysis-detail#state-seq-match-strict`、`#state-seq-match-partial` |
| **依據** | 交付包 `handoff/manifest.json` 這兩個視圖的 `how`：「在序列標註任務的統計總覽點 `#matchStrict`」。原型：`#matchStrict`／`#matchPartial`／`#seqStrictCard`／`#seqPartialCard` 只在 `dataset-analysis-detail.partials/quality-entity_recognition.html:11`–`:30`，`quality-sequence_tagging.html` 與八個 `stats-*` 都沒有。規格 [`05-dataset/02-analysis-detail.mdx`](../../docs/specs/05-dataset/02-analysis-detail.mdx) §八種輸出類型各自的主指標與門檻：實體辨識列寫「部分重疊的 F1（只能切換顯示）」，第 5 條提到「同一張卡的切換鈕」。視圖 ID 也叫 `seq-`，與它實際所屬的型別對不上。 |
| **待決問題** | **已裁定（2026-11-18）**：下次重跑 `design-handoff` 時改重現方式，視圖 ID 不改名。**已於 #418 處理**：交付包第四次重跑把兩個視圖的 `how` 改指實體辨識的品質監控，`evidence` 加上 `quality-entity_recognition.html`，ID 不變。`spec` 仍連 §序列標註的統計；較貼切的錨點是 §八種輸出類型各自的主指標與門檻，要不要改由維護者決定。原題保留：下一次重跑 `design-handoff` 時，要不要把這兩個視圖的重現方式改成實體辨識的品質監控，ID 要不要改名？本 skill 不改交付包。 |

### G-53 「部分重疊」與關係識別的第二個數值，畫面上仍叫「門檻」

> b4 新增。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開實體辨識任務的品質監控，切到 `Partial overlap`：卡片寫「Relaxed 門檻 0.70 — 通過」。再開關係識別任務的品質監控：第二列寫「高品質門檻 0.80 — 未達」。 |
| **受影響範圍** | `dataset/dataset-analysis-detail#state-quality-entity-recognition`、`#state-quality-relation-identification`、`#state-seq-match-partial` |
| **依據** | 原型：`quality-entity_recognition.html:40`「`Relaxed 門檻 0.70`」、`:53` 替代指標表頭也叫「門檻」；`quality-relation_identification.html:23`「`高品質門檻 0.80`」。規格 [`05-dataset/02-analysis-detail.mdx`](../../docs/specs/05-dataset/02-analysis-detail.mdx) §八種輸出類型各自的主指標與門檻 第 11 條：「它的 0.70 **不得叫『門檻』**……畫面要改成不帶『門檻』的字（例如『參考值』），關係識別的 `高品質門檻 0.80` 同一個問題、一併改」（Q15，維護者 2026-11-08）。 |
| **待決問題** | **已裁定（2026-11-18）**：改成「參考值」，並拿掉「通過／未達」的判定語氣。修正於 #423。原題保留：規格已裁定要改；改原型屬**畫面修正**，要走 Ready gate。改成什麼字（規格只舉例「參考值」）、何時改，由維護者決定。 |

**狀態（#423）**：已修正。實體辨識的部分重疊卡改成「Relaxed 參考值 0.70」／"Relaxed reference value 0.70"，關係識別第二列改成「高品質參考值 0.80」／"High-quality reference value 0.80"，兩者都拿掉「— 通過／未達」，圓點改中性的新 `.t-dot-neutral`（`--color-ink-muted`）。部分重疊卡的數值與長條原本是綠色（等於說它過了），也改中性：數值不帶狀態 class，長條用新的 `.iaa-bar-fill.neutral`。「兩種計算模式比較」表頭從「門檻」改「門檻／參考值」（"Threshold / reference"），因為 Strict 那一列的 0.80 仍是真門檻；部分重疊那一列的結果從綠色「通過」改成中性徽章「不判定」（"Not judged"），Strict 那一列的「未達」不動。中英文 i18n 一併改；`T007`、`T008` 與複合任務 `T010` 淺深色實測。上文的行號指的是修正前。

## 二、缺少狀態證據

### G-05 焦點樣式幾乎全面缺席

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `components-showcase.html`，只用鍵盤 Tab 走一遍。多數控制項聚焦時沒有任何可見變化。 |
| **受影響範圍** | 本批次 **32 個元件裡至少 11 個**：[Button](components/button.md)、[Toggle Switch](components/toggle-switch.md)、[Chip](components/chip.md)、[Pagination](components/pagination.md)、[Breadcrumb](components/breadcrumb.md)、[Accordion](components/accordion.md)、[State Panel](components/state-panel.md)、[Desktop Content Tabs](components/content-tabs.md)、[Modal](components/modal.md)、[Language Toggle](components/lang-toggle.md)、[Password Eye Toggle](components/password-eye-toggle.md)、[Proto Toggle Bar](components/proto-toggle-bar.md) |
| **依據** | 以 `:focus` 逐段掃描：`shared/button.css` ＋ `components-showcase.html:149`–`:288`（Button）**0**；`:335`–`:340`（Toggle）**0**；`:473`–`:584`（Chip）**0**；`:586`–`:632`（Pagination 正典）**0**，`shared/list-page.css` 全檔只有 2 個 `:focus`，都在工具列（`:30`、`:39`），`.page-btn` **0**；`:637`–`:655`（Breadcrumb）**0**；`:745`–`:793`（Accordion）**0**；`:847`–`:902`（State Panel）**0**；`shared/content-tabs.css` 全檔 **0**；`shared/modal.css` 全檔 **0**。做對的只有三個：[Avatar](components/avatar.md)（`components-showcase.html:918` `.avatar-wrap:focus-visible`）、[Date Range Picker](components/date-range-picker.md)（`shared/date-range-picker.css:8`、`:33`）、[List Toolbar](components/list-toolbar.md)（`list-page.css:30`、`:39`，但用 `box-shadow` ＋ `outline: none`）。 |
| **待決問題** | 要不要在 `tokens.css` 加一組 focus ring token，讓所有元件共用一條規則？`outline` 與 `box-shadow` 哪一種當基準（前者在高對比模式下才看得見）？ |

### G-06 `.btn-loading`／`.btn-disabled` 只擋滑鼠，不擋鍵盤

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 在 `components-showcase.html` 的 `#comp-buttons`，Tab 到「建立中…」那顆（`.btn-loading`），按 Enter。 |
| **受影響範圍** | [Button](components/button.md)、[UXC-06](ux-conventions.md#uxc-06-送出中的載入態與重複送出防護) |
| **依據** | `components-showcase.html:213`「`.btn-loading { opacity: 0.7; cursor: not-allowed; pointer-events: none; }`」、`:220`「`.btn-disabled, button[disabled] { opacity: 0.4; cursor: not-allowed; pointer-events: none; }`」。`pointer-events: none` 不影響鍵盤；只有 `button[disabled]` 那一半真的擋得住，`.btn-loading` 與 `.btn-disabled` 兩個 class 單獨用時擋不住。UXC-06 的引用（`account/profile.html:1527`）明寫「double-submission guard」。 |
| **待決問題** | 要改成加 `disabled` 屬性嗎？`.btn-loading` 的語意是「按鈕還在、只是忙」，加 `disabled` 會讓它退出 Tab 順序，可能不是想要的。 |

### G-08 Toast 的 error 不自動消失，又不搶焦點

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 在 `components-showcase.html` 的 `#comp-toast` 按「Error（手動關閉）」。toast 會一直留著。用鍵盤 Tab 找它的關閉鈕，要一路走到頁尾。 |
| **受影響範圍** | [Toast](components/toast.md)、[Empty State](components/empty-state.md) |
| **依據** | `components-showcase.html:1504`「`var TOAST_DURATIONS = { success: 3000, info: 5000, warning: 8000, error: 0 };`」、`:1536`「`if (duration) toastTimer = setTimeout(hideToast, duration);`」。`#toast` 容器在 `:1380`，是 `<body>` 的最後一個元素，帶 `aria-live="polite" aria-atomic="true"`（朗讀沒問題，**焦點順序有問題**）。`showToast()`（`:1518`–`:1537`）沒有任何 `focus()`。另 [Empty State](components/empty-state.md) 完全沒有 live region，清單篩到空時不會被朗讀。 |
| **待決問題** | error toast 要不要把焦點移進去（或至少做成 `role="alertdialog"`）？空狀態要不要加 `role="status"`？ |

### G-21 五個共用元件沒有任何可重現的樣本

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `components-showcase.html` 從頭看到尾：找不到空狀態、分頁列（內容分頁，非 Pagination）、modal、清單工具列、資料表格。再開 b1 的九個畫面：同樣找不到。 |
| **受影響範圍** | [Empty State](components/empty-state.md)、[Desktop Content Tabs](components/content-tabs.md)、[Modal](components/modal.md)、[List Toolbar](components/list-toolbar.md)、[Data Table](components/data-table.md) |
| **依據** | `components-showcase.html:141`–`:145` 列出正典區塊涵蓋的 15 個 `§`，這五個都不在內。`account/profile` 經由 `sidebar.css:1` 的 `@import url("./empty-state.css")` 拿到空狀態樣式，但 `profile.html` 全檔 `empty-state` 出現 **0 次**。 |
| **待決問題** | 要不要把這五個補進 `components-showcase.html`？那會動到 `design/prototype/`，屬**畫面修正**，要走 Ready gate。在那之前，這五份元件規格的「可重現樣本」欄只能指向 b2–b4 的畫面。 |

**b2 補上**：Empty State、Content Tabs、Modal、List Toolbar、Data Table 在 b2 都有了可重現的樣本，各元件檔的 §可重現樣本 已補。

### G-31 三頁的送出中狀態沒有被收為視圖

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 在 `register`／`forgot-password`／`reset-password` 送出表單，按鈕會短暫進入 spinner 狀態，但交付包沒有對應的視圖 ID。 |
| **受影響範圍** | [Spinner](components/spinner.md)；`account/register`、`account/forgot-password`、`account/reset-password` |
| **依據** | 交付包 `manifest.json` 裡這三頁的視圖只有 `state-default`／`state-field-error`／`state-submitted`／`proto-*`／`sim-*`；只有 `account/login` 有 `#state-submitting`。但四頁都定義了 `.spinner`（`login.html:308` 等）。 |
| **待決問題** | 要不要在下一次重跑 `design-handoff` 時補上這三個視圖？（屬交付包的事，不是本 skill 能改的。） |

### G-40 b2 有一個可重現的畫面與數個疊加層沒有被收為視圖

> b2 新增。同 G-31 的性質：屬交付包，不是本 skill 能改的。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `pages/task-management/task-new.html`，第一到第三步填妥後按「下一步」：出現第四步「標記說明」。交付包只有 `#state-step1`～`#state-step3`。 |
| **受影響範圍** | [Step Indicator](components/step-indicator.md)、[Modal](components/modal.md)、[Skeleton](components/skeleton.md)；`task-management/task-new`、`task-detail`、`admin/user-management`、`admin/role-settings` |
| **依據** | `task-new.html:446` 的 `step4Panel`，步驟條畫了四格（`:242`–`:262`）。同樣找得到但沒有視圖 ID 的：`task-new` 的 `taxonomyDeleteModal`（`:545`）與頂端錯誤橫幅（`:236`）；`task-detail` 的載入骨架（`task-detail.html:1896`–`:1908`）與 `taskNotFound`（`:1912`）；`user-management` 的 `editModal`（`user-management.html:530`）；`role-settings` 的 `#dirtyModal`（`role-settings.html:858`）與 `storedInvalidBanner`（`:306`）；兩頁共用的異動紀錄抽屜（`shared/audit-drawer.js:36`）。 |
| **待決問題** | **已裁定（2026-11-18）**：下次重跑 `design-handoff` 時補上這些視圖。**已於 #418 處理**：交付包第四次重跑補上九個視圖：`task-management/task-new#state-step4`、`#modal-taxonomy-delete`；`task-management/task-detail#state-loading`、`#state-task-not-found`；`admin/user-management#modal-edit`、`#modal-audit-log`；`admin/role-settings#modal-dirty`、`#modal-audit-log`、`#state-stored-invalid`。`task-new` 的頂端錯誤橫幅叫不出來（驗證不過時「下一步」已停用，`showBannerError()` 走不到），記進交付包的「無法重現」為 `task-management/task-new#state-banner-error`，畫面要不要改仍待決。原題保留：要不要在下一次重跑 `design-handoff` 時補上這些視圖？本 skill 不替它們取 ID。 |

### G-36 五條 UX 約定在本批次沒有證據

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 在 b1 的九個畫面上找 UXC-03／04／05／09／10 的行為：找不到。 |
| **受影響範圍** | [`ux-conventions.md`](ux-conventions.md) |
| **依據** | 引用位置全在別批：UXC-03 → `admin/role-settings.html:1300`、`:1318`，`annotation-workspace.config.js:1989`、`:2041`；UXC-04 → `annotation-workspace.config.js:666`、`:3099`；UXC-05 → 同 `:666`；UXC-09 → `annotation-list.html:1922`；UXC-10 → `task-config.engine.js:22`、`:6203`，`task-new.html:544`，`user-management.html:1247`。 |
| **待決問題** | 無（由 b2／b3 補完即可）。登記在此是為了讓 `ux-conventions.md` 的空缺有下落。 |

**b2 補上**：UXC-03、09、10 已寫進 [`ux-conventions.md`](ux-conventions.md)；UXC-04、05 待 b3。

**b3 補上**：UXC-04、05 已寫進 [`ux-conventions.md`](ux-conventions.md)，五條都有了落點，本條沒有剩下的待辦。

### G-51 b3 有數個疊加層與一張卡片沒有被收為視圖

> b3 新增。同 G-31、G-40 的性質：屬交付包，不是本 skill 能改的。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | 開 `pages/annotation/annotation-workspace.html?role=reviewer`，打開審核流程抽屜；作答後按「儲存草稿」看右上的通知。再開 `pages/annotation/annotation-list.html?task_id=<試標中的任務>`，以標記員身分看試標歷史回饋卡。三者都沒有視圖 ID。 |
| **受影響範圍** | [Modal](components/modal.md)、[Toast](components/toast.md)；`annotation/annotation-workspace`、`annotation/annotation-list` |
| **依據** | 審核流程抽屜 `wsReviewFlowDrawer`（`annotation-workspace.html:1197`，`annotation-workspace.config.js:5724` 起）；通知 `#toast`（`annotation-workspace.html:1328`，`showToast`，`annotation-workspace.config.js:430`）；試標歷史回饋卡 `#dryRunFeedbackCard`（`annotation-list.html:465`，`renderDryRunFeedback`，`:2199`）。交付包的 `annotation-list` 九個視圖、`annotation-workspace` 十三個視圖都不含它們。 |
| **待決問題** | **已裁定（2026-11-18）**：下次重跑 `design-handoff` 時補上這些視圖。**已於 #418 處理**：交付包第四次重跑補上三個視圖：`annotation/annotation-workspace#modal-review-flow`、`#toast-saved`，`annotation/annotation-list#state-dry-run-feedback`。審核流程抽屜要該筆先有一次送出才叫得出來，步驟寫在 `how`。原題保留：要不要在下一次重跑 `design-handoff` 時補上這些視圖？本 skill 不替它們取 ID。 |

### G-54 b4 有兩個錯誤狀態沒有被收為視圖

> b4 新增。同 G-31、G-40、G-51 的性質：屬交付包，不是本 skill 能改的。

| 欄 | 內容 |
| :--- | :--- |
| **重現方式** | `dataset-analysis-list`：讓資料腳本載入失敗（`state.loadFailed`），表格只剩一列錯誤與重試鈕。`dataset-analysis-detail`：讓任一個 partial 的請求失敗，那個分頁顯示「載入失敗」面板與重試鈕。兩者都沒有網址參數可以觸發，也沒有視圖 ID。 |
| **受影響範圍** | [Data Table](components/data-table.md)、[Card](components/card.md)、[Button](components/button.md)；`dataset/dataset-analysis-list`、`dataset/dataset-analysis-detail` |
| **依據** | 清單：`createErrorRow`（`dataset-analysis-list.view.js:159`），條件 `dataset-analysis-list.model.js:138`，樣式 `.error-title`（`dataset-analysis-list.html:151`）。詳情：`renderPanelLoadError(mountId, 'load')`（`dataset-analysis-detail.html:1503`），`aria-live="polite"`（`:1510`）。同一個函式以 `'calc'` 呼叫時就是交付包有列的 `#param-q-state-report-failed`，`'load'` 這一支沒有列。交付包 `dataset-analysis-list` 四個視圖、`dataset-analysis-detail` 二十六個視圖都不含它們。 |
| **待決問題** | **已裁定（2026-11-18）**：下次重跑 `design-handoff` 時補上這兩個視圖；原型先加 `?error=1` 示範開關，於 #422 處理。原題保留：要不要在下一次重跑 `design-handoff` 時補上這兩個視圖？沒有網址參數能觸發，要不要先在原型加一個示範開關（屬畫面修正，走 Ready gate）？ |

**狀態（#422）**：原型已加 `?error=1` 示範開關。`dataset-analysis-list.html?error=1` 讓 `state.loadFailed` 為真（`dataset-analysis-list.model.js:241`），只剩錯誤列與重試鈕；`dataset-analysis-detail.html?task_id=<id>&error=1` 讓統計與品質兩個 partial 都顯示載入失敗面板。參數只在載入時讀取，`syncUrl` 不會帶著它，所以重試（重新載入）會恢復，和真實的重試一致。視圖 ID 要等下次重跑 `design-handoff` 才補，這裡不處理。

---

## 三、待重新設計

**只登記，不提方案**（`design-system-setup` 步驟 7）。

### G-09 Toast 沒有 hover 暫停

滑鼠停在 toast 上不會暫停計時器（`components-showcase.html:1536` 只有 `setTimeout`，沒有 `mouseenter`）。success 的 3 秒對長訊息可能不夠讀完。

### G-10 同一個元件在出貨頁面有多份獨立實作

[Toast](components/toast.md)：`#toast` 在 8 個頁面各有一份（b2 五個、b3 一個、b4 兩個），加上 `account/profile` 自己的 `.toast*`。[Skeleton](components/skeleton.md)：`dashboard.components.css`、`dashboard.js`、`task-detail.html`、`shared/sidebar.js`、`shared/modal.css` 各自提到。待 b2–b4 逐一核對是否與正典相同。

**b2 核對**：Skeleton 的 `dashboard.components.css:319`–`:333`（shimmer）與 `task-detail.html:70`–`:92`（pulse）都是正典的逐字複製；Toast 的 b2 五份裡兩份（`admin/*`）照 UXC-07、三份（`task-management/*`）不照 → G-39。另找到：Toggle Switch 在 `task-detail` 被重新定義（G-42）、卡片四份（G-41）、異動紀錄抽屜兩份（G-38）、Badge 在 b2 六頁都各自重寫（`user-management.html:103`、`role-settings.html:255`、`task-list.html:91`、`task-detail.html:115`、`dashboard.layout.css:238`）。b3、b4 的部分待那兩批。

**b3 核對**：Toast 的 b3 那一份（`annotation-workspace.html:1011`–`:1054`，`TOAST_DURATIONS` 在 `annotation-workspace.config.js:426`–`:443`）照 UXC-07。另找到：結果標籤的 hex 在 `annotation-list` 與 `annotation-workspace` 各寫一份（G-02）、卡片第五份（G-41）、`.mini-btn` 第三與第四份（G-37）、Progress Bar 兩頁各重寫一份（`annotation-list.html:178`–`:190` 的 `.progress`、`annotation-workspace.html:304`–`:315` 的 `.progress-track`）、Status Pill 換名複製（`annotation-list.html:256`–`:267`）。Skeleton 在 `shared/sidebar.js`、`shared/modal.css` 的那幾處只是字面上的「skeleton」，不是這個元件。b4 的部分待 b4。

**b4 核對**：Toast 的 b4 兩份——`dataset-analysis-list` 照 UXC-07（`TOAST_DURATIONS`，`dataset-analysis-list.js:25`）；`dataset-analysis-detail` 只有 markup 與關閉鈕，沒有任何程式顯示它 → G-55。另找到：卡片第六份（`dataset-analysis-detail.html:50` 的 `.panel`，G-41）、徽章再重寫兩份（`dataset-analysis-list.html:122`–`:148`、`dataset-analysis-detail.html:58`–`:62`）、表格樣式 `.annotator-table`（`:138`–`:142`）、分隔線 `.panel-divider`（`:55`，G-18）、進度條兩份（`dataset-analysis-list.html:99`–`:108` 的 `.progress-track`、`dataset-analysis-detail.html:84`–`:89` 的 `.iaa-bar-*`）、圓點 `.t-dot`（`:92`–`:96`，G-14）。

**#438 補記**：下拉選單的箭頭樣式在 6 個檔各寫一份（9 條規則），#438 給每一條加了深色版，所以現在是 18 條；之後改箭頭要一起改。showcase 新增的 `.btn-secondary:hover`（`components-showcase.html:177`）照抄 `pages/shared/button.css`，正典與出貨的第二按鈕 hover 才一致。

### G-11 §Chip 其實是兩個元件

正典把「可點的選取器」（`.task-type-chip`，`role="checkbox"`／`"radio"`）與「唯讀標籤」（`.ar-classif-chip` 等四種）收進同一章節。前者對應 shadcn 的 `ToggleGroup`，後者對應 `Badge`。依據：`components-showcase.html:1153` 的說明自己就寫「語意狀態請改用 Status Badge」。

**b4 核對**：`dataset-analysis-detail` 的 `.cause-chip`（`dataset-analysis-detail.html:156`）是唯讀標籤，又一個屬於「後者」的實作。

### G-13 Breadcrumb 的「最深兩層」與實際用法不符

正典說明寫「最深兩層」（`components-showcase.html:1206`），但同一頁的 Review Status Track 樣本用了三層（`:1220`–`:1225`）。`annotation-list.html:55` 與 `annotation-workspace.html:55` 的註解另提到一個「compact form」，正典沒有對應的 class。

**b3 核對**：兩頁的 `#entryBreadcrumb` 都用三層（工作區的第三層是樣本，`annotation-workspace.config.js:1603`），沒有另一個 compact class，所謂 compact form 只存在於註解。

### G-14 Color Dot 的語意只靠顏色

`title` 屬性在觸控裝置上看不到（`components-showcase.html:1248`、`:1261`），而顏色是唯一的訊號。對照組：[Review Status Track](components/review-status-track.md) 刻意做了文字前綴與線寬兩種非顏色訊號（`:1218`）。

**b4 核對**：`dataset-analysis-detail` 的 `.t-dot`（`dataset-analysis-detail.html:91`–`:94`）不是正典 `.color-dot`，但同樣只靠顏色；旁邊有文字標籤時才不成問題，各 partial 的用法不一。

### G-15 Accordion 有兩個 class 只出現在 markup

`.output-accordion-number`（`components-showcase.html:1293`）與 `.output-accordion-title`（`:1294`）在正典 CSS 區塊（`:745`–`:793`）裡沒有任何規則。

### G-17 Avatar 的尺寸三個數字各不相同，而且少一個動作

showcase 說明寫「profile 64/80px」（`components-showcase.html:1361`），它的 CSS 是 80px（`:917`），出貨的 `profile.html:149` 是 72px。另外 `profile.html:751` 有「移除頭像」（`.avatar-remove-btn`），正典的上傳契約（`components-showcase.html:1593`–`:1629`）沒有這個動作。

### G-20 Review Status Track 的軌道標籤沒有 ARIA 關聯

`.review-track-branch`（`components-showcase.html:1230`、`:1231`、`:1234`）沒有被任何 `aria-describedby`／`aria-labelledby` 接到節點上，螢幕閱讀器讀到三個節點加三段散落的文字。

### G-22 Content Tabs 沒有 tablist 語意

`shared/content-tabs.css` 不提供 `role="tablist"`／`role="tab"`／`aria-selected`，也沒有方向鍵巡覽；且窄視窗下 `scrollbar-width: none`（`:40`）隱藏捲軸，滑鼠使用者沒有「還有更多分頁」的提示。

**b2 核對**：三個使用頁面**自己補上了**語意——`admin/user-management`（`user-management.html:285`–`:287`）與 `admin/role-settings`（`role-settings.html:335`–`:337`）在 `<a>` 上加 `role="tablist"`／`role="tab"`／`aria-selected`；`task-detail` 另有方向鍵巡覽（`task-detail.html:11686`–`:11702`）。共用的 `content-tabs.css` 本身仍不提供，缺口不變。

**b3 核對**：`annotation-workspace` 的 `.admin-tabs--panel`（`annotation-workspace.html:1288`–`:1289`）是兩顆 `<button>`，**沒有補上**語意，只能點（`annotation-workspace.config.js:6736`–`:6754`）。

**b4 核對**：`dataset-analysis-detail` 的 `.admin-tabs`（`dataset-analysis-detail.html:256`–`:258`）**自己補上了** `role="tablist"`／`tab`／`tabpanel` 與 `aria-selected`、`aria-controls`，但沒有方向鍵，只能點（`:2437`–`:2442`）。

### G-23 覆蓋層有兩套焦點處理

[Modal](components/modal.md) 用共用的 `shared/modal-focus.js`（`:1`–`:88`）；[App Shell](components/app-shell.md) 的 `#shortcutHelpModal`（`sidebar.js:2109`）與 `#notificationDropdown`（`:2260`）整套自建，`sidebar.js` 全檔 `LabelSuiteModalFocus` 出現 **0 次**。另外 `modal.css`／`modal-focus.js` 都不保證 `role="dialog"`／`aria-modal`／`aria-labelledby`，也沒有點遮罩關閉。

**b3 核對**：`annotation-workspace` 的五個 overlay 全部接 `modal-focus.js`（`annotation-workspace.config.js:6384`、`:6408`、`:6573`、`:5741`、`:6887`），也都帶 `role="dialog"`、`aria-modal`；這一頁不受本條影響。但共用模組把 Esc 一律接到 `onClose`，造成 G-46。

### G-24 側欄的 token 清單未逐條核對

`sidebar.css` 有 1233 行，`tokens.css` 為它與工作頁籤準備了 `--nav-active-bg`、`--color-tab-active-bg`、`--color-tab-hover-bg`、`--workspace-tab-min-width`、`--workspace-tab-max-width`（五個都確認存在）。完整對照留給 b2——那時 10 個使用頁面都會進來。

**b2 已逐條核對**：`sidebar.css` 用到 40 個 `--*` token，38 個在 `tokens.css`。另外兩個 `--navbar-mobile-height`、`--navbar-mobile-top-height`（`sidebar.css:831`–`:837`，窄視窗規則）**不在 `tokens.css`**，由宿主頁面自己定義：b2 六頁裡五頁寫在頁內 `<style>`，`dashboard` 寫在 `dashboard.layout.css:6`；b1 的 `account/profile` 也有。`annotation-workspace` 沒有定義，待 b3 核對它的窄視窗版面。`sidebar.css` 另有 19 處寫死 hex、12 處寫死 rgba → G-02。`components/app-shell.md` 提到的 `--z-dropdown` 在 `sidebar.css` 沒有用到（只用 `--z-sticky`）。

**b3 核對**：`annotation-list` 自己定義了那兩個變數（`annotation-list.html:16`–`:18`）；`annotation-workspace` **沒有**（全檔 0 次），而 `sidebar.css:828`–`:837` 的窄視窗規則用到它們且沒有後備值。另外 `sidebar.css` 的規則寫在 `max-width: 768px`，工作區的抽屜斷點是 767px 以下（`annotation-workspace.html:936` 起），差一個像素。

**b4 核對**：b4 兩頁都自己定義了那兩個變數（`dataset-analysis-list.html:21`、`dataset-analysis-detail.html:24`）。全站只剩 `annotation-workspace` 沒有。

### G-25 `MASTER.md` 的 terminology note 還不存在

`sidebar.css:963` 與 `sidebar.js:682` 都引用它來區分「工作頁籤」與「Content Tabs」。本批次建立 `MASTER.md` 時已在 §命名約定 寫入該節，但**內容是從這兩處註解反推的**，不是原件。

### G-27 Data Table 沒有排序指示，橫捲容器鍵盤到不了

`shared/list-page.css:49`–`:72` 不提供 `aria-sort` 或排序樣式，但 `ap_sort` 這類排序參數確實存在（見 `docs/prototype/navigation.mdx` §網址參數）。`.task-table-wrap` 沒有 `tabindex="0"`，所以鍵盤無法捲動它。

### G-30 `account/profile` 是唯一沒有 `prefers-reduced-motion` 的帳號頁

五個登出帳號頁**各自都有**（`login.html:342`、`register.html:313`、`forgot-password.html:305`、`reset-password.html:399`、`verify-email.html:278`），規則是 `*, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }`，`*` 蓋得住 [Spinner](components/spinner.md) 的 `animation: spin 0.7s linear infinite`（`login.html:334`）。

**`account/profile.html` 一條都沒有**，而它是 b1 動畫最多的一頁：`skeleton` 相關 class 出現 49 處。它的骨架動畫不受減少動態保護。`components-showcase.html:975`–`:977` 的那條只涵蓋 showcase 自己。

> 本條原本寫反了（寫成「五個帳號頁都沒有」），自審時以逐頁掃描更正。

### G-34 UXC-01 與 UXC-02 的內容未知

全 prototype 42 處 UXC 引用只覆蓋 03–11。維護者 2026-11-17 裁定沿用編號、兩格留空。原始 MASTER.md 屬**參照不是依據**（`design-handoff` 鐵律），所以本 repo 無從補。

### G-38 異動紀錄抽屜在兩個管理頁各寫一份，沒有焦點陷阱

> b2 新增。

`admin/user-management`（`user-management.html:273`、`:709`–`:727`）與 `admin/role-settings`（`role-settings.html:277`、`:933`–`:951`）各有一份 `.audit-drawer`，CSS 與 markup 幾乎相同，沒有共用檔。兩份都是 `role="complementary"`，開啟時焦點不被留在抽屜裡（兩頁 `modal-focus.js` 0 次），Esc 可關（`user-management.html:1366`、`role-settings.html:1410`）。

**已裁定（2026-11-18）**：修正：抽成共用檔並接上焦點陷阱。修正於 #422。

**狀態（#422）**：已修正。兩頁共用 `pages/shared/audit-drawer.css` 與 `pages/shared/audit-drawer.js`（自我掛載，標題與空狀態文字由 `<script>` 的 `data-*` 帶入；`LabelSuiteAuditDrawer.open({trigger})`／`.close()`）。抽屜改為 `role="dialog" aria-modal="true"` 並以 `aria-labelledby` 指向標題，關閉時為 `inert`；開啟時接上 `modal-focus.js`，Tab 不離開抽屜，Esc 或關閉鈕後焦點回到觸發鈕。各頁只留自己的 `.audit-badge-*`。上文的行號指的是修正前。

### G-43 b2 的 modal 有一半沒有接 `modal-focus.js`

> b2 新增。延伸 G-23。

`admin/user-management`、`admin/role-settings`、`task-management/task-new` 三頁全檔 `modal-focus`／`ModalFocus` 0 次；`task-detail` 八個 modal 在 b2 時只有四個接上；現在全部接上，`LabelSuiteModalFocus.open` 在 `task-detail.html:5991`、`:7741`、`:8188`、`:10881`、`:11255`、`:11309`，類別刪除與資料集預覽在 `task-config.engine.js:6216`、`:6143`。只有 `task-list` 全部接上（`:705`、`:715`）。沒接的那些開啟後焦點不進視窗、關閉後不回觸發鈕，Esc 由各頁自己的 `keydown` 處理。

**b3 核對**：`annotation-workspace` 全部接上（見 G-23 的 b3 核對）。

**已裁定（2026-11-18）**：修正：未接的 modal 全部接上 `modal-focus.js`。修正於 #422。

**狀態（#422）**：已修正。`user-management`（新增、編輯、停用）、`role-settings`（未儲存確認）、`task-new`（離開確認、類別刪除、資料集預覽）、`task-detail`（成員操作，以及與 `task-new` 共用 `task-config.engine.js` 的類別刪除、資料集預覽）都接上 `LabelSuiteModalFocus.open`／`.close`，並以 Playwright 逐一驗證 Tab 不離開、Esc 關閉、焦點回到觸發鈕。前提的更正：核對時 `task-detail` 其實已有五個 modal 接上（上文寫四個）；現在全部都接了。

### G-44 Step Indicator 的目前步驟沒有非視覺標示

> b2 新增。

`task-new.html:243`–`:261` 每一步是 `<div class="step-item">`，目前步驟只靠 `.active` 換色，沒有 `aria-current="step"`；完成的步驟也只靠 `.done` 換色。螢幕閱讀器讀不出現在第幾步、哪幾步已完成。

**已裁定（2026-11-18）**：修正：目前步驟加 `aria-current="step"`。修正於 #422。

**狀態（#422）**：已修正。`task-new.html` 的 `.step-item` 各有 id（`si1`–`si4`），`updateStepIndicator` 在目前步驟上設 `aria-current="step"`、其餘移除；完成的步驟在圓圈內加一個只給螢幕閱讀器讀的「已完成／Completed」文字（`.step-sr-only`），語言切換時重新套用。

### G-49 審核流程抽屜的關閉鈕沒有名稱

> b3 新增。

`annotation-workspace.html:1198` 的 `#wsReviewFlowDrawerClose` 裡只有一個 `aria-hidden` 的 svg，沒有 `aria-label`，`annotation-workspace.config.js:5810` 取得它之後也沒有補上。同頁另外三個預覽的關閉鈕都有（`:1149`、`:1164`、`:1180`）。螢幕閱讀器只會讀出「按鈕」。

**已裁定（2026-11-18）**：修正：補 `aria-label`。修正於 #422。

**狀態（#422）**：已修正。`#wsReviewFlowDrawerClose` 在 markup 上加了 `aria-label="關閉流程與目前狀態"`（`annotation-workspace.html:1201`）。前提的更正：`annotation-workspace.config.js` 在執行期早就用 `flowDrawerCloseAria` 設定這個名稱（`:6982` 一帶），所以螢幕閱讀器實際讀得到；缺的是靜態 markup。這次補的是靜態那一份，與執行期的字串一致。

### G-50 作答控制項不屬任何元件，樣式全是 inline 與寫死 hex

> b3 新增。延伸 G-02。

`annotation-workspace` 的作答區由 `task-config.engine.js` 的 `renderOutputPreview`（`:3671`）畫出，例如單選標籤 `renderSingleLabelPreview`（`:2871`）：按鈕的樣式全寫在 inline `style` 上，選中色寫死 `#fff` 與後備值 `#6366F1`（`:2888` 等），「無法判定」chip 寫死 `#64748B`（`makeBypassChip`，`:2816`–`:2828`）。引擎全檔 18 個 hex。它們長得像 [Chip](components/chip.md)，但沒有用任何 `.task-type-chip` 或 `.chip` class，所以 Chip 的 b3 用到 0 次。

**已裁定（2026-11-18）**：併入 #420：改套 `.chip` class，色值改用 token。

**狀態（#420）**：已修正。`task-config.css` 新增 `.chip` 一族（`.chip`、`.is-active`、`.chip--lg`、`.chip--bypass`、`.chip-mark`），引擎改設這些 class，不再用 inline `cssText` 組外觀。每個標籤自己的顏色是任務資料，經 `--chip-color` 傳入；後備值改取 `ENTITY_COLORS`，選中時的白字改 `--color-on-cta`。上色前一律經 `entityPaintColor()`（`task-config.data.js`）：預設色盤的顏色換成 `var(--data-entity-N)`，深色主題才換得到 `data-palette.css` 的深色組；標註底色原本是色碼接 `'33'`，改成 `entityWashColor()` 的 `color-mix(… 20%, transparent)`，透明度相同。引擎全檔已沒有 hex。這組 `.chip` 只在 `task-config.css`，[Chip](components/chip.md) 的正典 `.task-type-chip` 沒有改；兩者要不要合併仍待決。上文的行號指的是修正前。

### G-55 `dataset-analysis-detail` 的 toast 沒有任何程式會顯示它

> b4 新增。延伸 G-10。

`dataset-analysis-detail.html` 有 `.toast*` 樣式（`:175`–`:187`）、`#toast` markup（`:362`–`:363`）與關閉鈕的處理（`:2463`），但全檔沒有 `showToast` 或任何把 `#toast` 加上 `visible` 的程式。本頁也沒有需要通知的操作（風險處置鈕直接導頁，`:1573`–`:1580`）。要刪掉這段死 markup，還是本頁其實該有通知（例如重試成功）？維護者決定。

**已裁定（2026-11-18）**：刪掉死 markup 與樣式。修正於 #423。

**狀態（#423）**：已修正。刪掉 `.toast*` 樣式、`.toast-container`／`#toast` markup 與 `toastClose` 的處理，以及檔頭註解裡「toast 疊在 `--z-toast`」那句。`shared/sidebar.js` 的三個工作頁籤通知會找 `#toast`，找不到就不做事（原註解即如此設計）；它們加的是 `show` class，本頁樣式只認 `visible`，所以刪除前本來就看不見，行為不變。淺深色實測統計與品質監控兩個分頁、切換分頁，沒有頁面錯誤。上文的行號指的是修正前。

### G-56 品質監控的「Strict／Partial」切換鈕讀不出目前選哪一個

> b4 新增。

`.match-btn`（`dataset-analysis-detail.html:107`–`:109`，markup `quality-entity_recognition.html:11`–`:12`）是兩顆原生 `<button>`，修正前選項只靠 `.active` 的樣式表示（`syncSequenceUi`，`dataset-analysis-detail.html:1942`–`:1956`），沒有 `aria-pressed`，也不是 `role="radiogroup"`。對照組：`annotation-workspace` 的審核三向決策 `.mini-btn` 有 `aria-pressed`。這是全站唯一的分段切換鈕，不屬任何元件。

**已裁定（2026-11-18）**：修正：加 `aria-pressed`。修正於 #422。

**狀態（#422）**：已修正。`quality-entity_recognition.html` 的 `#matchStrict`／`#matchPartial` 帶 `aria-pressed`，`syncSequenceUi` 每次切換都與 `.active` 同步更新（`dataset-analysis-detail.html:1942` 起）。`.match-btn` 樣式現在在 `:107`–`:109`。

---

## 撤回的條目

本批次自審時，下列三條在**逐條對檔案驗證後**發現不成立，寫下後撤回。編號留空、不重用，理由記在這裡。

| 編號 | 原本寫的 | 為什麼不成立 |
| :--- | :--- | :--- |
| G-16 | Accordion 的 header 是 `div[role=button]`，showcase 沒有腳本，所以 Enter／Space 按不動 | **有腳本**：`components-showcase.html:1579`–`:1591` 綁了 `click` 與 `keydown`，攔 `Enter` 與 `Space`（`:1586`）並同步 `aria-expanded`（`:1582`）。寫下時沒有去看 `<script>` 區塊。 |
| G-32 | Password Eye Toggle 的 `aria-label` 不隨狀態更新 | **會更新**：`pages/account/login.html:606`–`:612` 切換 `input.type` 時一併改寫 `aria-label`，`:587` 在換語言時也依目前狀態重算。 |
| G-35 | `account/profile` 的頭像骨架（72px）比實際頭像（80px）小，違反 UXC-08 | **兩者都是 72px**：`profile.html:148` 的 `.avatar-preview` 與 `:559` 的 `.skel-avatar` 相同。80px 只存在於 showcase 的 demo（`components-showcase.html:916`，註解標 `md:w-20 — desktop demo size`）。 |

同一輪自審還修正了兩條**寫錯但仍成立**的：Alert Banner 原寫「樣本沒有 `role="alert"`」（實際有，`components-showcase.html:1112`）與「全 prototype 0 個修飾子」（實際有一個，`pages/admin/user-management.html:182` 的 `.alert-banner.warning`）——後者反而讓 G-07 更有力；Toast 原寫「沒有 `aria-live`」（實際容器有，`components-showcase.html:1381`），改成焦點順序的問題。
