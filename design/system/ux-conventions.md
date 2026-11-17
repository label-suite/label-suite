# UX Conventions

> 批次 `b1-shared-account` 建立 ｜交付包 commit `b1fd43c`

跨元件成立的約定。收錄條件（`design-system-setup` 步驟 5）：**至少兩個元件在遵守它**；只有一個元件這樣做的，寫在那個元件自己的檔裡。

## 編號為什麼從 03 開始

`UXC-NN` 這套編號**不是本批次發明的**，是 prototype 的註解裡已經在用的。全 prototype 共 **41 行、42 處**引用（`annotation-workspace.config.js:657` 一行同時寫了 UXC-04 與 UXC-05），分布在 UXC-03 到 UXC-11：UXC-07 ×20、UXC-10 ×6、UXC-03 ×4、UXC-11 ×4、UXC-06 ×3、UXC-04 ×2、UXC-05／08／09 各 ×1。

維護者 2026-11-17 裁定：**沿用 03–11，01／02 留空**。重編會把那 20 處註解全部打成懸空引用，而本 repo 的第八條鐵律正是「不要把別處的斷言打成假的」。UXC-01 與 UXC-02 的內容本 repo 無從得知，記在 [`design-gaps.md`](design-gaps.md) G-34。

| 編號 | 標題 | 本批次能不能寫完 |
| :--- | :--- | :--- |
| UXC-01 | **未知** | 否，prototype 無引用 |
| UXC-02 | **未知** | 否，prototype 無引用 |
| [UXC-03](#uxc-03-未儲存的變更要擋住離開) | 未儲存的變更要擋住離開 | 否，證據全在 b2／b3 |
| [UXC-04](#uxc-04-送出才驗證不是檢查就驗證) | 送出才驗證，不是檢查就驗證 | 否，證據全在 b3 |
| [UXC-05](#uxc-05-輸入就清掉上一次的錯誤) | 輸入就清掉上一次的錯誤 | 否，證據全在 b3 |
| [UXC-06](#uxc-06-送出中的載入態與重複送出防護) | 送出中的載入態與重複送出防護 | **可以** |
| [UXC-07](#uxc-07-toast-單一實例與分級存續時間) | Toast 單一實例與分級存續時間 | **可以** |
| [UXC-08](#uxc-08-skeleton-尺寸要貼合載入後的內容) | Skeleton 尺寸要貼合載入後的內容 | **可以** |
| [UXC-09](#uxc-09-首次使用的空與篩不到的空是兩種) | 首次使用的「空」與篩不到的「空」是兩種 | 否，證據在 b2／b3 |
| [UXC-10](#uxc-10-刪除分支要先確認) | 刪除分支要先確認 | 否，證據全在 b2 |
| [UXC-11](#uxc-11-篩選搜尋與分頁的狀態放在網址上) | 篩選、搜尋與分頁的狀態放在網址上 | **部分** |

---

## UXC-06：送出中的載入態與重複送出防護

送出後到結果回來這段時間，控制項要進入載入態，而且**不能被按第二次**。

遵守它的元件（兩個以上）：

- [Spinner](components/spinner.md)：取代送出鈕的文字，帶 `aria-label="載入中"`（`design/prototype/pages/account/login.html:736`）
- [Button](components/button.md)：`.btn-loading` 以 `opacity: .7` ＋ `pointer-events: none` 表示送出中（`design/prototype/components-showcase.html:211`）

引用處：`design/prototype/pages/account/profile.html:350`（「UXC-06 / MASTER Loading state: opacity-70 + spinner while pending」）、`:1540`（「loading state + double-submission guard while the (simulated) request runs」）、`:1583`。

**已知缺口**：`.btn-loading` 只關掉滑鼠（`pointer-events: none`），**沒有加 `disabled`**，所以鍵盤仍然按得動——防護只擋得住一半（[`design-gaps.md`](design-gaps.md) G-06）。

## UXC-07：Toast 單一實例與分級存續時間

整頁同時只有一則 toast；存續時間依語意分級，錯誤不自動消失。

| variant | 存續 |
| :--- | ---: |
| success | 3000ms |
| info | 5000ms |
| warning | 8000ms |
| error | **0 ＝ 只能手動關** |

依據：`design/prototype/components-showcase.html:1500`（`TOAST_DURATIONS`），`:1532` 的 `if (duration)` 讓 `0` 落到「不設計時器」。單一實例靠 `:1529` 的 `replaceChildren()`——是覆蓋，不是佇列。

遵守它的元件：[Toast](components/toast.md) 本身，以及 [App Shell](components/app-shell.md) 的通知（待 b2 核對是否同一套）。

這是 prototype 引用最多的一條：42 處裡獨佔 **20 處**，其中 4 處在 `components-showcase.html`（`:142`、`:397`、`:1116`、`:1499`），`:142` 甚至把它寫進正典 CSS 區塊的標頭。

## UXC-08：Skeleton 尺寸要貼合載入後的內容

骨架的尺寸要照著載入後真正會出現的東西量，**以防 layout shift**。

依據：`design/prototype/components-showcase.html:1127`（「尺寸須貼合載入後內容以防 layout shift（UXC-08）」）。

遵守它的元件：

- [Skeleton](components/skeleton.md)：A variant 的 `.skeleton-line.title` 220×20、`.body` 12px、`.body.short` 65%；B variant 的 `.skel-avatar` 72×72、`.skel-input` 42px、`.skel-btn` 90×40（`components-showcase.html:445`–`:447`、`:460`–`:463`）
- [Avatar](components/avatar.md)：`account/profile` 的 `.avatar-preview` 與 `.skel-avatar` **都是 72×72**（`profile.html:152`、`:563`），骨架和載入後的頭像一樣大——這是本批次找到最乾淨地遵守 UXC-08 的一處

**這條約定解釋了為什麼 Skeleton 的尺寸不該 token 化**：它們是逐處量出來的，不是設計刻度。

## UXC-11：篩選、搜尋與分頁的狀態放在網址上

清單頁的 `q`／`keyword`、`status`、`limit`／`offset` 這類狀態寫進網址，重新整理與分享連結都能回到同一個畫面。

依據：`design/prototype/pages/admin/user-management.html:1075`（「URL state (UXC-11): q / role / status / limit / offset」）、`pages/annotation/annotation-list.html:1078`（「filter/search/pagination live in the URL (limit/offset…」）、`components-showcase.html:1174`（「行為契約見 UXC-11（limit/offset、URL 同步）」）。

遵守它的元件：[Pagination](components/pagination.md)、[List Toolbar](components/list-toolbar.md)。兩者在 b1 都**沒有可重現的視圖**（showcase 只展示版面、不展示網址行為），所以這一條在本批次只記到契約層。

這條和 `docs/prototype/navigation.mdx` §網址參數 是同一件事的兩面：那一節是**宣告有哪些參數**，這一條是**為什麼要有**。

---

## 本批次沒有寫完的

UXC-03、04、05、09、10 的證據全部落在 b2–b4 的畫面上；b1 的九個畫面一個都踩不到。各自的引用位置記在 [`design-gaps.md`](design-gaps.md) G-36，由那幾批補完。

依 `design-system-setup` 鐵律 1，本批次只「引用」它們、不在這裡先寫；先寫等於用 b1 看不到的東西下結論。

### UXC-03：未儲存的變更要擋住離開

引用：`pages/admin/role-settings.html:1398`、`:1416`，`pages/annotation/annotation-workspace.config.js:1980`、`:2032`。待 **b2／b3**。

### UXC-04：送出才驗證，不是檢查就驗證

引用：`pages/annotation/annotation-workspace.config.js:657`、`:3058`。待 **b3**。

### UXC-05：輸入就清掉上一次的錯誤

引用：`pages/annotation/annotation-workspace.config.js:657`（與 UXC-04 同一段註解）。待 **b3**。

### UXC-09：首次使用的「空」與篩不到的「空」是兩種

引用：`pages/annotation/annotation-list.html:1949`。相關元件 [Empty State](components/empty-state.md) 在 b1 已經寫了，但它的 CSS **只有一套**——兩種「空」的分法是換文案，不是換樣式。待 **b2／b3**。

### UXC-10：刪除分支要先確認

引用：`pages/task-management/task-config.engine.js:22`、`:6183`，`pages/task-management/task-new.html:528`，`pages/admin/user-management.html:1357`。待 **b2**。
