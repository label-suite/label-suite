# UX Conventions

> 批次 `b1-shared-account` 建立、`b2-admin-dashboard-task`、`b3-annotation-review` 補寫 ｜交付包 commit `b1fd43c` → `eb9a884`

跨元件成立的約定。收錄條件（`design-system-setup` 步驟 5）：**至少兩個元件在遵守它**；只有一個元件這樣做的，寫在那個元件自己的檔裡。

## 編號為什麼從 03 開始

`UXC-NN` 這套編號**不是本批次發明的**，是 prototype 的註解裡已經在用的。全 prototype 共 **41 行、42 處**引用（`annotation-workspace.config.js:657` 一行同時寫了 UXC-04 與 UXC-05），分布在 UXC-03 到 UXC-11：UXC-07 ×20、UXC-10 ×6、UXC-03 ×4、UXC-11 ×4、UXC-06 ×3、UXC-04 ×2、UXC-05／08／09 各 ×1。

維護者 2026-11-17 裁定：**沿用 03–11，01／02 留空**。重編會把那 20 處註解全部打成懸空引用，而本 repo 的第八條鐵律正是「不要把別處的斷言打成假的」。UXC-01 與 UXC-02 的內容本 repo 無從得知，記在 [`design-gaps.md`](design-gaps.md) G-34。

| 編號 | 標題 | 哪一批寫完 |
| :--- | :--- | :--- |
| UXC-01 | **未知** | 否，prototype 無引用 |
| UXC-02 | **未知** | 否，prototype 無引用 |
| [UXC-03](#uxc-03-未儲存的變更要擋住離開) | 未儲存的變更要擋住離開 | **b2 寫完**，b3 核對 |
| [UXC-04](#uxc-04-送出才驗證不是檢查就驗證) | 送出才驗證，不是檢查就驗證 | **b3 寫完** |
| [UXC-05](#uxc-05-輸入就清掉上一次的錯誤) | 輸入就清掉上一次的錯誤 | **b3 寫完** |
| [UXC-06](#uxc-06-送出中的載入態與重複送出防護) | 送出中的載入態與重複送出防護 | **可以** |
| [UXC-07](#uxc-07-toast-單一實例與分級存續時間) | Toast 單一實例與分級存續時間 | **可以** |
| [UXC-08](#uxc-08-skeleton-尺寸要貼合載入後的內容) | Skeleton 尺寸要貼合載入後的內容 | **可以** |
| [UXC-09](#uxc-09-首次使用的空與篩不到的空是兩種) | 首次使用的「空」與篩不到的「空」是兩種 | **b2 寫完**，b3 核對 |
| [UXC-10](#uxc-10-刪除分支要先確認) | 刪除分支要先確認 | **b2 寫完** |
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

**b2 核對**：`admin/role-settings`（`role-settings.html:1504`）與 `admin/user-management`（`user-management.html:1579`）照抄 `TOAST_DURATIONS`，遵守；`task-management/task-list`（3000 ms）、`task-new`（3500 ms）、`task-detail`（2400 ms）一律固定秒數、錯誤也會自己消失，**不遵守** → [`design-gaps.md`](design-gaps.md) G-39。App Shell 的通知是 `sidebar.js` 的下拉選單，不是 toast，不適用。

**b3 核對**：`annotation/annotation-workspace` 照抄 `TOAST_DURATIONS`（`annotation-workspace.config.js:422`–`:439`），遵守。`annotation-list` 沒有 toast。

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

**b2 補上可重現的樣本**：`admin/user-management#state-filtered-empty`（`?q=`／`?status=`／`?role=`）與 `task-management/task-list#state-filtered-empty`（`?keyword=`／`?status=`／`?output_type=`／`?run_stage=`，規格 [`01-task-list.mdx` §查詢條件保留在網址](../../docs/specs/03-task-management/01-task-list.mdx)）。

這條和 `docs/prototype/navigation.mdx` §網址參數 是同一件事的兩面：那一節是**宣告有哪些參數**，這一條是**為什麼要有**。

---

## UXC-03：未儲存的變更要擋住離開

有未儲存的編輯時，**頁內的離開**（取消、切走）先跳確認視窗，**瀏覽器層的離開**（重新整理、關分頁）交給原生的 `beforeunload` 提示。兩層都要有。

遵守它的元件：

- [Modal](components/modal.md)：`admin/role-settings` 的 `#dirtyModal`（`design/prototype/pages/admin/role-settings.html:958`；`cancelEdit` 在 `isDirty` 時先開它，`:1416`–`:1422`）；`task-management/task-new` 的 `leaveModal`（`task-new.html:517`）；`task-management/task-detail` 的 `settingsLeave`（`task-detail.html:2035`）
- [Alert Banner](components/alert-banner.md)：`admin/role-settings` 的 `.dirty-banner`（`:353`）在離開之前就先把「有未儲存的變更」說出來

瀏覽器層：`role-settings.html:1398`–`:1403`、`task-new.html:1662`。**`task-detail` 沒有 `beforeunload`**——它只擋頁內切換（`task-detail.html` 全檔 `beforeunload` 0 次）。

**b3 核對**：`annotation/annotation-workspace` 兩層都有，但頁內那一層**不是確認視窗**。瀏覽器層是 `beforeunload`（`design/prototype/pages/annotation/annotation-workspace.config.js:2055`–`:2059`）；頁內則是中欄任何 `input`／`change`／`click` 都把旗標設起來（`markUnsaved`，`:2038`；三個 capture 監聽，`:2051`–`:2053`），同時把自動儲存狀態改成「尚未儲存」（`:2043`）——用狀態列說出來，而不是擋住切換。`:1980` 那段註解說的就是這兩者分工。

## UXC-09：首次使用的「空」與篩不到的「空」是兩種

「從來沒有資料」和「有資料但篩不到」要用**不同的話**，而且只有後者給「清除篩選」——前者沒有東西可清。兩種「空」換的是文案與動作，**不是換樣式**。

遵守它的元件：

- [Empty State](components/empty-state.md)：`admin/user-management` 篩到 0 列時是 `empty-state-page` ＋「清除篩選」（`design/prototype/pages/admin/user-management.html:547`–`:559`）
- [Data Table](components/data-table.md)：`task-management/task-list` 把空狀態放成表格裡的一列，`createEmptyRow(isNoResults)`（`task-list.html:846`–`:870`）依參數換文案，只有 `isNoResults` 為真才加清除鈕；兩種情況都保留表頭

依據的規格：[`03-task-management/01-task-list.mdx` §空狀態與載入失敗](../../docs/specs/03-task-management/01-task-list.mdx)（三種情況的文案表，且「不放第二顆新增任務」）。第三種「載入失敗」**絕對不能顯示成空資料**，`task-list` 用另一列錯誤列（`:881`–`:913`）處理。

**b3 核對**：`annotation/annotation-list` 遵守。`renderEmptyState`（`design/prototype/pages/annotation/annotation-list.html:1951`–`:1966`）用同一個 `empty-state-page` 容器，只依「本來有沒有資料」換文案（「找不到符合條件的資料。」／「目前尚無資料。」），只有前者加清除篩選。對應規格 [`04-annotation/01-annotation-list.mdx` §空的與找不到](../../docs/specs/04-annotation/01-annotation-list.mdx) 第 4–6 條。

## UXC-10：刪除分支要先確認

破壞性的動作（刪除分支、停用帳號、捨棄編輯）先跳確認視窗；確認視窗**點遮罩不關**，**Esc 取消、Enter 確認**。

遵守它的元件：

- [Modal](components/modal.md)：`admin/user-management` 只讓新增與編輯可以點遮罩關閉，停用確認不行（`design/prototype/pages/admin/user-management.html:1357`–`:1361`）；停用確認開著時 Enter 送出（`:1369`–`:1371`）。`admin/role-settings` 的 `#dirtyModal` 同樣 Esc 取消、Enter 確認（`role-settings.html:1405`–`:1414`）。刪除分類分支的確認（`task-config.engine.js:6183`–`:6194`，`task-new.html:528` 的 `role="alertdialog"`）把焦點放在「刪除」鈕上（`:6193`），文案寫明一併刪除的子節點數
- [Button](components/button.md)：確認動作一律用 `.btn-danger`（`user-management.html:696`、`role-settings.html:972`、`task-list.html:307`–`:315`）

**不一致**：`task-management/task-list` 的刪除任務確認**點遮罩會關**（`task-list.html:1197`–`:1199`）——而那是規格明寫的（[`01-task-list.mdx` §刪除任務](../../docs/specs/03-task-management/01-task-list.mdx) 第 5 條「點視窗外面，或按 Esc → 視窗關閉」）。約定與規格在這一處對不上 → [`design-gaps.md`](design-gaps.md) G-45。

## UXC-04：送出才驗證，不是檢查就驗證

勾選或切換一個選項時**不驗證**——使用者還沒說要送出，這時跳錯誤是在催他。驗證只在按「提交」時跑一次，擋下時**每個有問題的欄位各自顯示錯誤**，再用**一則**通知把它們一起點名。

遵守它的元件：

- [Input](components/input.md)：`annotation/annotation-workspace` 勾了「無法判定」之後出現的理由輸入框（`.input`，`design/prototype/pages/annotation/annotation-workspace.config.js:640`–`:672`），勾的當下錯誤訊息是隱藏的（`:647`，註解 `:656`–`:658`）；按提交才逐一判斷哪幾個輸出類型缺理由，各自打開錯誤（`:3056`–`:3068`）
- [Toast](components/toast.md)：同一次提交只發**一則** warning 通知，把缺理由的輸出類型名稱用「、」串起來（`:3069`–`:3075`）

依據的規格：[`04-annotation/02-annotation-workspace.mdx` §作答完整性與提交阻擋](../../docs/specs/04-annotation/02-annotation-workspace.mdx) 第 5 條。同一段第 2 條要「提示對應的那個區塊」，但區塊上的 `data-error` 標記沒有樣式 → [`design-gaps.md`](design-gaps.md) G-47。

## UXC-05：輸入就清掉上一次的錯誤

送出被擋之後，使用者**一開始改**那個欄位，那個欄位的錯誤就收掉，不等下一次送出。錯誤是在說「上一次送出的值不對」，值已經在改了，留著它只會誤導。

遵守它的元件：

- [Input](components/input.md)：`annotation/annotation-workspace` 的理由輸入框，`input` 事件一有非空白的值就隱藏錯誤（`syncOnInput`，`design/prototype/pages/annotation/annotation-workspace.config.js:659`–`:665`）；帳號頁的 `.field-error` 同樣在 `input` 事件清掉（`account/login.html:691`–`:696`、`account/register.html:780`–`:786`、`account/reset-password.html:831`–`:836`）
- [Alert Banner](components/alert-banner.md)：`account/register` 一開始打字就把表單層級的錯誤橫幅收起來（`register.html:785`）

只清**錯誤**，不清值，也不在輸入當下重新驗證——那會變成檢查就驗證，違反 UXC-04。
