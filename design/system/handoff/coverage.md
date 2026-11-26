# 覆蓋核對

交付包版本：commit `b16b294b1ea604d0231c5ef6e3dff16bf825f6b9`，prototype tree `ee820973ad42dba66377a64291495a6452d68dd9`。
產生依據：[`design-handoff` skill](../../../.claude/skills/design-handoff/SKILL.md) 的步驟 4。工作源頭是 [Issue #248](https://github.com/label-suite/label-suite/issues/248)。

**本次是第十四版**（第十三次重跑）。差異見 §九。

| 項目 | 數 |
| :--- | ---: |
| 條目 | 19（18 個畫面 ＋ 1 個共用外殼） |
| 視圖 | 154 |
| 批次 | 5（`b0` 本 skill 做完，`b1`–`b4` 交給 `design-system-setup`） |
| 無法重現的視圖 | 3 |
| 沒有規格可連的視圖 | 2 |

---

## 一、`navigation.mdx` 的頁面 vs `pages/**/*.html`

**完全一致，0 筆差異。** 兩邊各 18 個：`docs/prototype/navigation.mdx` 的 18 個 `### \`/…\`` 小節，對上 `design/prototype/pages/**/*.html` 的 16 個檔加兩個根層入口（`index.html`、`components-showcase.html`）。

`pages/` 底下另有 **22 個 HTML 不是畫面**，是別的畫面注入的片段，所以不列為畫面而列在那個畫面的 `loads`：

| 片段目錄 | 數 | 被誰載入 | 鍵是什麼 |
| :--- | ---: | :--- | :--- |
| `task-management/task-detail.panels/` | 6 | `task-detail.html` | 分頁名（`overview`、`settings`、`member-management`、`annotation-progress`、`annotation-results`、`work-log`） |
| `dataset/dataset-analysis-detail.partials/` | 16 | `dataset-analysis-detail.html` | 「統計／品質」× 八種輸出類型 |

`pages/shared/` **一個 HTML 都沒有**（15 個 CSS 與 JS），所以它不產生「畫面」——但它產生一個**共用外殼條目** `shared/app-shell`，見 §八。加上它，交付包共 **19 個條目**。

---

## 二、`navigation.mdx` 的 `Inline` 列 vs 展開出來的視圖

`navigation.mdx` 共 **24 列 `Inline`**，分佈在 16 個頁面（`index.html` 與 `components-showcase.html` 沒有）。**每一列都對得到至少一個視圖**——視圖就是從那些列加上掃出來的 URL 參數展開的。

這是一個**刻意寬鬆**的斷言：「至少一個」不等於逐項涵蓋。逐列看，`task-detail` 的「設定、抽樣、guideline、run control、成員操作、匯出」整列對到六個分頁、五個設定區段（`#param-section-*`，第二次重跑才補上）與 `state-panel-load-failed`，但「run control、成員操作、匯出」三項仍然沒有各自的視圖——一個 12,501 行、6 個 panel、含日期區間選擇器與分類刪除彈窗的畫面只收 17 個視圖，`modal-`／`toast-` 一個都沒有。`design-system-setup` 在 `b2` 會吃到這個缺口。

視圖數比 `Inline` 列多很多（154 vs 24），因為 `Inline` 把「搜尋／篩選／排序／分頁」這類寫成一列，而 URL 參數掃描把它們拆成可個別重現的狀態。

### 另一道對照：網址參數契約 vs 掃出來的全集

[PR #398](https://github.com/label-suite/label-suite/pull/398) 把參數寫成契約之後，多了一道機械對照：**`navigation.mdx` §網址參數 宣告的，與逐檔掃 `.get('<名稱>')` 得到的全集，兩個方向都要對得上**。

本次結果（**第三版，兩步掃描**）：**兩個方向各 0 筆。**

第七次重跑時（第八版）多了一筆：[Issue #422](https://github.com/label-suite/label-suite/issues/422) 在 `dataset-analysis-list.model.js:241` 與 `dataset-analysis-detail.html:1507` 新增 `error`（只認 `1`），**程式有、契約沒有**。建議把它補進 `navigation.mdx` §網址參數 的兩列資料集分析頁（本 skill 不改那份文件）。兩個視圖已收為 `#param-error`。

第八次重跑時（第九版）這一筆已關閉：`navigation.mdx` 的兩列資料集分析頁補上了 `error`，兩個方向又是各 0 筆。

第二版寫「兩個方向各 0 筆」而**那是錯的**，因為掃描法只找字面量 `.get('<名稱>')`，看不見把參數名放在表裡、以變數讀的寫法。獨立審查連續兩輪抓到四處這種寫法：

| 位置 | 名字從哪來 | 宣告新參數 |
| :--- | :--- | ---: |
| `task-detail.html:5048` | `URL_VIEW_STATE` | **16** |
| `annotation-workspace.config.js:1560` | `LIST_VIEW_STATE_KEYS` ＋ `LIST_IDENTITY_KEYS` | **6** |
| `dataset-analysis-detail.html:2520` | `PROTOTYPE_ONLY_PARAMS` | 0（`s_state` 已在表上） |
| `sidebar.js:732` | 列舉既有鍵 | 0 |

兩輪的修法：[PR #400](https://github.com/label-suite/label-suite/pull/400) 把那 22 個名字補進 `navigation.mdx` 的契約，本版把掃描法改成兩步，所以 `params` 欄現在才是真的全集——`task-management/task-detail` 從 11 個變 **25** 個、`annotation/annotation-workspace` 從 9 個變 **13** 個。

這一條是 §網址參數 存在的理由——沒有它，契約隔天就會過期，而過期的契約比沒有契約更糟（`design-handoff` 第 3 步正是依它展開視圖）。**它前兩次執行都報了假的 0 筆**，所以 skill 現在明寫掃描要兩步走。

### 這一輪刻意做的三個判斷

這三個不是裁定，是**本次執行的判斷**，寫在這裡讓下一個人可以推翻：

1. **篩選參數不各自成一個視圖。** `?q=`、`?keyword=`、`?status=`、`?limit=`、`?offset=`、`?output_type=` 這類換的是**資料**不是版面，所以每個清單頁只收「預設」與「篩到空」兩種（`state-default`、`state-filtered-empty`），不為每個參數值各開一個視圖。要逐值展開的話，光 `task-list` 一頁就會有上百個。
2. **`?sim_logged_in=1` 在帳號頁算一個視圖**，即使它的可觀察結果是「本頁自動導走」。理由是 prototype 特地提供這個旗標來叫出那個行為，而規格 01-01 Q3 定義了它。
3. **`dataset-analysis-detail` 的八種輸出類型逐型成一個視圖**（統計與品質各八個，共 16 個）。理由是它們是**16 個獨立的 HTML 檔**，不是同一個版面的資料差異。

---

## 三、`docs/specs/` 的頁面 vs 畫面

20 份規格頁（不含 `index.mdx`、`glossary.mdx`、`00-prd.mdx`、`open-questions.mdx`），**18 份有視圖指向它**，2 份沒有。逐頁對照見 [`spec-index.md`](./spec-index.md)。

### 規格有、畫面沒有：**2 筆**，兩筆都有紀錄

| 規格頁 | 為什麼沒有畫面 |
| :--- | :--- |
| `01-account/05-login-state.mdx` | PRD §Site Map 列在「不是獨立頁面」 |
| `05-dataset/03-ingestion-lineage.mdx` | 該頁 §已確認決議 **Q1**（維護者 2026-11-08 裁定）**刻意**不補畫面；建立者的入口在規格 03-02 第一步、出口在 03-03 的試標發布 |

PRD §Site Map 另外**四份**列為「不是獨立頁面」的規格**都有視圖指向它**，因為它們的行為落在別的東西上：

- `07-shared/01-sidebar.mdx` ← `shared/app-shell` 的四個視圖（主題、語言、收合、系統管理群組）
- `07-shared/02-workspace-tabs.mdx` ← `shared/app-shell#state-workspace-tabs`、`#param-ap-stage`
- `07-shared/03-denied-and-not-found.mdx` ← `task-management/task-detail#sim-403`、`task-management/task-list#param-unauthorized`
- `07-shared/04-notification-events.mdx` ← `shared/app-shell#modal-notification`

**第一版把 07-01／07-02 歸進「沒有畫面」是錯的**——同一節對 07-03／07-04 用的是相反的邏輯，而側欄的行為顯然落在 16 個畫面上。獨立審查抓到，已改。

### 畫面有、沒有規格可連：**2 筆**

| 畫面 | 說明 |
| :--- | :--- |
| `index` | 站台入口，只做 meta refresh 到登入頁。沒有規格描述它，也不需要 |
| `components-showcase` | living styleguide，開發與設計參考頁，不在產品導航流程內。它是 `design-system-setup` 取元件樣本的主來源 |

---

## 四、動態片段與素材

**22 個動態片段全部存在**（6 個 panel ＋ 16 個 partial），路徑是從兩個畫面的路徑對應表讀出來的、不是用檔名猜的。
`task-detail.html` 自己的註解寫明降級行為：某個 panel 載入失敗時只留下它的佔位符，其餘 panel 仍載入、其他分頁仍可用——已收為 `task-management/task-detail#state-panel-load-failed`。

`manifest.json` 一共指到 **457 個檔案路徑**（`loads` 230、`views[].evidence` 208、`screens[].file` 19），逐一確認存在，**0 筆缺失**。

> **注入片段的素材路徑是相對於宿主文件寫的，不是相對於片段自己的目錄。** `task-detail.panels/work-log.html:85` 寫 `../../assets/icons/clock.svg`，那個相對路徑只有從 `pages/task-management/` 解得開。本檔第一版用片段自己的目錄當基準，所以 `clock.svg` 與 `file-text.svg`（`annotation-results.html:165`）被靜默丟掉，連帶讓下面那個「全文搜不到」的斷言變成假的。獨立審查抓到，已修。

### 本次抽取沒有碰到的 22 個檔

`design/prototype` 在版控裡共 119 個檔，本次抽取到 **97 個**。剩下 22 個：

| 類 | 數 | 檔 |
| :--- | ---: | :--- |
| 圖示 | 16 | `assets/icons/` 的 `bar-chart-3`、`bell`、`chevron-right`、`eye-off`、`globe`、`info`、`layout-dashboard`、`lock`、`log-out`、`mail`、`more-horizontal`、`play-circle`、`search`、`settings`、`user`、`x` |
| Logo | 4 | `assets/logo/` 的 `banner`、`icon`、`logo-horizontal`、`social-preview` |
| 其他 | 2 | `README.md`（說明文件，不被載入）、`assets/analytics.config.example.json`（檔名自己寫著 example） |

**這 20 個素材的檔名在 prototype 的任何 HTML／CSS／JS 裡都搜不到**（逐檔以 basename 全文掃過；`lock.svg` 那一筆命中是 `clock.svg` 的子字串假陽性）。合理的解釋是畫面把 SVG 直接內嵌在 HTML 裡（`annotation-workspace.html` 的 ⓘ 圖示就是內嵌的 `<svg>`），所以 `assets/icons/` 的檔案沒人載入。

**但這只是抽取的結果，不是「它們沒用」的證明。** 本 skill 不做設計判斷，所以這一條留給 `design-system-setup` 在元件盤點時確認；若確認是死檔，那是 `design-gaps.md` 的材料。

---

## 五、無法重現的視圖

三筆。前兩筆**都是規格要求而畫面沒有**，而且都已經有單在追（[Issue #187](https://github.com/label-suite/label-suite/issues/187) 的第 1、2 項，維護者 2026-11-12 裁定先不做）。第三筆是 `design-gaps.md` G-40 要補的視圖，第四次重跑時實際叫不出來。

### 1. `annotation/annotation-list#state-loading`

- **卡在哪一步**：這一頁**沒有任何載入狀態可以叫出來**。python 掃 `annotation-list.html` 的 `skeleton`、`loading`、`載入` 三個字各 0 次。
- **對照**：同一個 repo 的 `task-detail.html`、`dashboard.html`、`profile.html` 各有一套骨架，而 `components-showcase.html` 也有正典的 §Skeleton 元件（Variant A pulse 與 Variant B shimmer）。所以缺的不是元件，是這一頁沒有接。
- **規格**：[04-01 §空的與找不到](../../../docs/specs/04-annotation/01-annotation-list.mdx#空的與找不到) 第 1、2 條要求「資料還沒讀進來時要顯示載入中，不得先顯示一張空表格或『目前尚無資料。』」，而且兩者必須明顯分得出來。
- **現況的後果**：讀取有延遲時畫面會先顯示「目前尚無資料。」——那句話的意思是「這個任務還沒發布資料」，與「還在讀」對使用者是兩回事。

### 2. `annotation/annotation-workspace#state-task-goal-and-instruction`

- **卡在哪一步**：右欄「任務說明」區只算繪**任務名稱**——`annotation-workspace.config.js` 的 `setText('guidelineSummaryText', taskName)`，而 `taskName` 取自 `currentProfile.nameZh`／`nameEn`。
- **規格**：[04-02 §右欄：說明與檔案、操作紀錄](../../../docs/specs/04-annotation/02-annotation-workspace.mdx#右欄說明與檔案操作紀錄) 第 6 條要求這一區「**依序承載三件事**：名稱、任務目標、操作指引」。
- **缺到什麼程度**：不只是沒有版位——那兩段的**內容在 prototype 裡不存在**，任務資料上也沒有對應欄位。所以這不是「叫不出來」，是「沒有東西可以叫」。

### 3. `task-management/task-new#state-banner-error`

- **卡在哪一步**：頂端錯誤橫幅 `#bannerError`（`task-new.html:236`）只有「下一步」的 click handler 會呼叫 `showBannerError()`（`:1653`–`:1688`）。但第一步與第三步每次輸入都跑 `revalidateCurrentStep()`（`:1139`），驗證不過就把「下一步」設成 disabled，所以那段 handler 永遠走不到。
- **實測**：清空任務名稱、把第三步抽樣筆數改成 0，「下一步」都是停用，橫幅不出現。
- **規格**：[03-02 §卡控機制](../../../docs/specs/03-task-management/02-task-new.mdx#卡控機制)。
- **待決**：G-40 的裁定要把它補成視圖，但畫面目前叫不出來。是畫面要改成讓按鈕可按、還是這個視圖本來就不該列，要維護者決定，本 skill 不判斷。

---

## 六、要維護者代看的

**無。**

本次核對全部以讀檔完成：HTML／CSS／JS 的實際內容、路徑對應表、URL 參數（逐檔掃 `.get('<名稱>')`）、規格章節錨點（逐一比對標題的 slug）。沒有任何一條結論依賴把畫面開起來看。

需要真的開畫面才驗得到的事（例如某個視圖算繪出來好不好看、素材在瀏覽器裡載不載得起來），本 skill 不做判斷，也不在交付包的範圍內。

---

## 七、重跑怎麼比

`manifest.json` 的 `source` 釘了四個 sha。下一次執行先比它們：

| 情況 | 做法 |
| :--- | :--- |
| 四個都沒變 | 產出應該與這一版相同（`generatedAt` 除外） |
| 有變 | 逐一列出新增、移除、受影響的視圖，並把受影響視圖所屬的批次標成「應重驗」，寫進本檔的「本次重跑」一節 |

`referenceDesignDocs`（原始 repo 的設計文件）**不在比對範圍**：它只是參照，不是現況證據。

**受影響的判定只看證據**：某個視圖的 `evidence` 或 `spec` 指到的檔變了，它就是受影響。`manifest.json` 的 `screens` 與 `views` 都依 `id` 字典序排，所以 diff 讀得出來。

**但只看證據不夠。** 參數驅動的視圖大多不以 `navigation.mdx` 為 `evidence`，所以改動那份文件時，它們一個都不會被這條規則點到。§九 因此改成兩欄並列，第二欄是「該批的參數驅動視圖」；兩次重跑的紀錄都照這個格式寫。

---

## 八、共用外殼 `shared/app-shell`

`design/prototype/pages/shared/sidebar.js` 被 18 個畫面裡的 **16 個**載入（只有 `index.html` 與 `components-showcase.html` 沒有），而它自己有 **13 個狀態**：

| 視圖 | 證據（摘要） |
| :--- | :--- |
| `#state-theme-dark` | 主題鈕 `sidebar.js:2087`／`:2061`；載入 `theme.js` 的 11 頁走它的 `setChoice()`（`sidebar.js:364`–`:367` 提前 return），其餘 5 個帳號頁走 `:370`／`:374` |
| `#state-lang-en` | `#langToggle` `sidebar.js:2053`／`#mobileLangToggle` `:2057` → `applyGlobalLanguage()` `:427` |
| `#state-sidebar-collapsed` | **桌機**（`sidebar.js:513` 的 `min-width: 768px`）收合 → `body.sidebar-collapsed` `:2531` |
| `#state-mobile` | `sidebar.css` 的 `@media (max-width: 767px)`：另一套版面，另有 `#mobileLangToggle`／`#mobileThemeToggleBtn`／`#mobileLogoutBtn` |
| `#state-user-chip` | `#userAvatar` `sidebar.js:2104`、`#userName`、`#roleIndicator` `:2107`；頭像取自 `label-suite-profile-avatar` `:55` |
| `#state-logout` | `#logoutBtn` `sidebar.js:2110`／`#mobileLogoutBtn` `:2071`，一次清掉 7 個 storage 鍵 |
| `#modal-notification` | `#notificationDropdown` `sidebar.js:2266`、`#notifMarkAllBtn` `:2281`、`#notificationBadge` |
| `#modal-shortcut` | `#shortcutHelpModal` `sidebar.js:2115`，開關在 `:2215` |
| `#role-super-admin` | `sidebar.js:536` 在不是 `super_admin` 時隱藏 `#navAdminItem` `:628` |
| `#state-admin-submenu-open` | `sidebar.js:539`–`:541` 的 `System Administration` 子選單：桌機且未收合才展開成兩個連結 |
| `#state-active-task-type` | `labelsuite.activeTaskType` `sidebar.js:4` 決定標記作業那一項的標籤與 `#roleIndicator` |
| `#state-workspace-tabs` | 頁籤列 `workspace-tab-bar` `sidebar.js:1525`、總覽選單、重開、全部關閉與三種通知；6 個 sessionStorage 鍵 |
| `#param-ap-stage` | **任務詳情**才讀（`pageKind`，`sidebar.js:763`）：`:770`／`:773` 設 `stageBadge` → `data-stage-badge` `:1253` |

### 為什麼它自成一個條目

這些狀態**屬於同一組元件**，不是 16 組。維護者 2026-11-16 裁定走「一個 `shared/app-shell` 條目」，而不是把同一組狀態複製進 16 個畫面的 `views`（以 13 個狀態算就是 208 筆重複，而下游盤元件時還要自己收回 13 組）。

代價是它**不是 HTML 入口**，所以 `design-handoff` 的「畫面＝一個 HTML 入口」定義跟著放寬了——skill 的 §穩定 ID 新增一段寫明判準是**「這組狀態由誰擁有」**，不是「它出現在幾個畫面上」。

條目帶一個 `hosts` 欄位列出載入它的 16 個畫面，所以 `sidebar.js` 改動時，受影響的範圍查得到。

### 這個條目改過兩次，兩次都是審查抓的

| 輪次 | 問題 |
| :--- | :--- |
| [PR #394](https://github.com/label-suite/label-suite/pull/394) | 外殼的視圖**一個都沒收**。當時先放進 `uncollected` 欄位，因為補成視圖要改資料形狀 |
| [PR #397](https://github.com/label-suite/label-suite/pull/397) 第一版 | 建了條目，但**只收六個狀態**，而且把 `#modal-notification` 與 `#modal-shortcut` 記成 `dashboard/dashboard` 的視圖——那兩套程式**整個在 `sidebar.js` 裡**（`dashboard.html` 全檔 `notif` 出現 **0 次**），正好違反同一張 PR 新寫進 skill 的那條判準。現在 13 個 |

第二次的教訓和第一次一樣：**我數了「我想到的」，沒有把那兩個檔從頭讀到尾**。

### 一個仍然成立的觀察

`b1` 的另外八個條目（兩個根層入口與六個帳號頁）**都不算繪側欄**——帳號頁載入 `sidebar.js` 只是為了那段登入導向判斷。所以 `b1` 要定的共用元件裡最大的一組，只靠這個外殼條目承載。

---

## 九、重跑紀錄

### 第十三次（本版）

上一版釘在 `387482b`。之後 [Issue #473](https://github.com/label-suite/label-suite/issues/473)（`9464627`）把「參考值」改成「參考線」；同一段期間 [Issue #435](https://github.com/label-suite/label-suite/issues/435) 的三個 commit（`9cd74bf`、`d8c0a05`、`b74390d`）也改了同一頁，所以**變動的不只是用詞**。`docs/specs/` 有 61 個 commit（各模組的 Logic Flow #545–#558、#434 的裁定、#551 的管理端入口與不可能狀態），`navigation.mdx` 只改了兩列的四個行號引用。

| 欄位 | 第十三版 | 本版 | |
| :--- | :--- | :--- | :--- |
| `commit` | `387482bb7075` | `b16b294b1ea6` | 必然變 |
| `prototypeTree` | `a4336be42bc7` | `ee820973ad42` | **變了** |
| `specsTree` | `41776418aee0` | `efa1a6e2360e` | **變了** |
| `navigationBlob` | `7a60a4eeeeee` | `a05f8013a1e7` | **變了**（只把兩列裡指向 `dataset-analysis-detail.html` 的四個行號換成新位置，沒有改參數） |

變動的 prototype 檔（共 8 個，全在 `pages/dataset/`）：
- `dataset-analysis-detail.html`（+108／−13 行）：
  - **用詞**：`lblSeqPartThr`、`lblRelThr2`、`altHSeqThr` 的「參考值」改「參考線」（#473），中英文都改。
  - **行為（新）**：實體辨識切到 `Partial overlap` 時，IAA 報告標題的主要指標星號收起（連 `aria-label` 一起拿掉），後綴由「— 主要指標」改成「— 參考顯示」；切回 `Strict match` 還原（`dataset-analysis-detail.html:1968` 的 `updateMethodName()`；#435）。這是 `#state-seq-match-partial` 看得到的新狀態。
  - **行為（新）**：`setElText()` 讓門檻文字換語言時保留 `通過`／`未達` 判定字，並套用到次要 IAA 卡（#435）。
  - **英文版**：新增 `qualityListRank.aria*` 21 條、`pairwiseAvg`、`anomStSpd1*`／`anomStOut1*`、`seqSpeedWarn`；序列標記的異常偵測區塊補上 `id`，語言切換才換得到（#435）。
  - **樣式**：`.iaa-bar-fill` 預設底色 `--color-ink-muted`（原本沒有預設，未通過也未達標時會沒顏色）。
- 7 個 `quality-*.html` partial：用詞（`entity_recognition`、`relation_identification` 的「參考值」→「參考線」）、`aria-label` 與表頭加 `data-i18n`、序列標記的異常偵測區塊加 `id`。**沒有改結構、沒有新增或移除元素。**

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 0 | 沒有新增視圖：Partial overlap 的星號收起是既有 `#state-seq-match-partial` 的內容 |
| 移除 | 0 | |
| 改寫 | 3 | `#state-seq-match-partial` 的重現步驟補上星號與後綴的變化；`#param-error`（`DEMO_LOAD_ERROR` 判斷，改指 `dataset-analysis-detail.html:1514`、`:2383`）與 `#state-seq-match-strict`（`syncSequenceUi`，改指 `dataset-analysis-detail.html:2022`）只換行號。ID 不變 |
| `loads` 欄 | 0 | 沒有新增或移除載入的檔 |
| 參數 | 0 | 沒有改讀網址參數的程式；兩步掃描的兩個方向仍各 0 筆 |
| 受影響（prototype） | 27 | 全是 `dataset/dataset-analysis-detail` 的視圖（`b4-dataset-sweep`）；同批的 `dataset-analysis-list`（5 個視圖）沒有變 |
| 受影響（規格） | 89 | 154 個視圖中有 89 個的 `spec` 指到變動的規格頁（見下表）。**所有 `spec` 錨點仍然解得到，沒有一個被改名或刪掉** |

`spec` 指到變動規格頁的視圖，依頁面：

| 規格頁 | 視圖 | 批次 | 變動性質 |
| :--- | ---: | :--- | :--- |
| `05-dataset/02-analysis-detail.mdx` | 27 | b4 | **用詞與判定**：參考線（Q26）、部分重疊結果是「不判定」（#434） |
| `04-annotation/02-annotation-workspace.mdx` | 15 | b3 | **行為**：說明彈窗只有「確認」與「返回標記清單」兩個出口，Esc 與點視窗外不關閉（#434） |
| `04-annotation/01-annotation-list.mdx` | 10 | b3 | 只加一段理由 |
| `03-task-management/01-task-list.mdx` | 6 | b2 | **行為**：刪除確認視窗點視窗外不關閉（#434） |
| `06-admin/02-role-settings.mdx` | 7 | b2 | **入口**：側欄次選單與使用者管理的分頁兩個入口、平台成員讀不到矩陣（#551） |
| `06-admin/01-user-management.mdx` | 6 | b2 | **行為**：沒有設定寄信服務時帳號照樣建立、「信未寄出」標記、設定密碼連結 24 小時內只能用一次（#551） |
| `01-account/04-profile.mdx` | 4 | b1 | **行為**：換 Email 的連結失效面板，按鈕依登入狀態回個人設定或前往登入（#558） |
| `07-shared/*`（sidebar 10、workspace-tabs 2、denied 2） | 14 | b1／b2 | 只改來源說明與一條不洩漏存在的規則（#166），沒有改畫面該有的東西 |

另外 `index.mdx` 與各模組 `index.mdx` 新增的是跨頁 Logic Flow（#545–#558），沒有視圖指向它們。

### 應重驗的批次（第十三次）

| 批次 | 受影響視圖（prototype） | 受影響視圖（規格） | 判斷 |
| :--- | ---: | ---: | :--- |
| `b1-shared-account` | 0 | 16 | 規格新增換 Email 失效面板；`account/profile` 的 prototype 沒有動，是原型與規格的差異，不是這次重驗的輸入 |
| `b2-admin-dashboard-task` | 0 | 21 | 規格改了入口、寄信服務、刪除視窗；prototype 沒有動 |
| `b3-annotation-review` | 0 | 25 | 規格改了說明彈窗的出口；prototype 沒有動 |
| `b4-dataset-sweep` | **27** | 27 | **prototype 與規格都動了**：用詞、Partial overlap 的星號與後綴、英文版翻譯與 `aria-label` |

**只有 `b4` 的 prototype 輸入變了。** 它不只是「參考線」用詞：Partial overlap 的星號收起與後綴是畫面行為，要核對 `design/system/pages/dataset-dataset-analysis-detail.md`（已手動跟上用詞，見 #473）有沒有寫到；英文版與 `aria-label` 的 `data-i18n` 屬文案與可及性，不改元件結構。`b1`–`b3` 的 prototype 輸入沒變，規格那一側的變動是 prototype 與規格的新差異，該進 `design-gaps.md`，由 `design-system-setup` 或維護者決定，本 skill 不判斷。

### 第十二次

上一版釘在 `8702db2`。之後 [Issue #455](https://github.com/label-suite/label-suite/issues/455) 修正 `navigation.mdx` 超出範圍的引用（補檔名、改行號），[Issue #461](https://github.com/label-suite/label-suite/issues/461) 把兩頁規格的「您」改成「你」（`01-account/04-profile.mdx`、`05-dataset/02-analysis-detail.mdx`，只改用字），[Issue #458](https://github.com/label-suite/label-suite/issues/458) 把其餘不跟主題換色的寫死 `rgba()` 改掉，改了三個 prototype 檔。

| 欄位 | 第十二版 | 本版 | |
| :--- | :--- | :--- | :--- |
| `commit` | `8702db294f5d` | `387482bb7075` | 必然變 |
| `prototypeTree` | `9f1aebb90272` | `a4336be42bc7` | **變了** |
| `specsTree` | `cdf459578e4f` | `41776418aee0` | **變了**（#461，只改用字，沒有改規則） |
| `navigationBlob` | `fabea63469ca` | `7a60a4eeeeee` | **變了**（#455，只改引用，沒有改參數） |

變動的檔：
- `task-config.css`：關係與序列標記的待選取強調（`.rel-sel-highlight`）由寫死的藍色改成 `--color-primary` 的 `color-mix`，淺色看得出由藍變靛。
- `admin/role-settings.html`：任務權限格底色改成 `--color-task` 的 `color-mix`，淺色差一個色階以內。
- `shared/sidebar.css`：檔尾加一段深色覆寫（多七行），通知下拉與分頁總覽選單的陰影在深色改黑色；淺色不變。

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 0 | |
| 移除 | 0 | |
| 改寫 | 0 | 沒有視圖的重現步驟改變；`sidebar.css` 只在檔尾加行，另兩檔行數不變，manifest 引用的行號都不必換 |
| `loads` 欄 | 0 | |
| 參數 | 0 | 沒有改讀網址參數的程式 |
| 受影響 | 128 | 154 個視圖中有 128 個的畫面載入了變動的檔（`sidebar.css` 128 個，其中 `task-config.css` 41 個、`role-settings.html` 7 個） |

### 應重驗的批次（第十二次）

| 批次 | 載入變動檔的視圖 | 新增 | 該批的參數驅動視圖 |
| :--- | ---: | ---: | ---: |
| `b1-shared-account` | 17／43 | 0 | 沒變 |
| `b2-admin-dashboard-task` | 54／54 | 0 | 沒變 |
| `b3-annotation-review` | 25／25 | 0 | 沒變 |
| `b4-dataset-sweep` | 32／32 | 0 | 沒變 |

這次只動到**顏色**，沒有改行為或版面。淺色刻意改變的是關係選取強調（藍改靛）與任務權限格底色（色差 1）；深色下兩個選單陰影、選取強調與任務格底色改跟深色 token。四批不必重做結構；受影響的文件（`app-shell.md`、`proto-toggle-bar.md`、Input 與 artifact 的 README、`design-gaps.md` G-02）已在同一張單裡改好。

### 第十一次

上一版釘在 `fdcea09`。之後 [Issue #439](https://github.com/label-suite/label-suite/issues/439) 重新對齊 `navigation.mdx` 的 17 個行號（只改數字），[Issue #442](https://github.com/label-suite/label-suite/issues/442) 把其餘寫死的主色與錯誤色 `rgba()` 改成 token 的 `color-mix()`，改了十四個 prototype 檔。`docs/specs/` 沒動。

| 欄位 | 第十一版 | 本版 | |
| :--- | :--- | :--- | :--- |
| `commit` | `fdcea09ac12b` | `8702db294f5d` | 必然變 |
| `prototypeTree` | `76fc01d0b121` | `9f1aebb90272` | **變了** |
| `specsTree` | `cdf459578e4f` | `cdf459578e4f` | 沒變 |
| `navigationBlob` | `90137539fd2f` | `fabea63469ca` | **變了**（#439，只改行號，沒有改參數） |

變動的檔：
- 帳號五頁（`login.html`、`register.html`、`forgot-password.html`、`reset-password.html`、`account/profile.html`）：輸入框的焦點環與錯誤環改 `color-mix`；`profile.html` 另有 Toggle Switch 的焦點環。
- `admin/user-management.html`、`admin/role-settings.html`、`dashboard.components.css`、`task-list.html`、`task-new.html`、`shared/sidebar.css`：焦點環改 `color-mix`；`role-settings.html` 的系統權限格底色、`sidebar.css` 的頭像框線也一樣。
- `task-config.css`：焦點環、schema 卡與關係徽章的框線改 `color-mix`；刪掉兩個關係徽章的深色覆寫（少兩行），色點的深色覆寫改 `--color-ink` 的 `color-mix`。
- `task-detail.html`：焦點環、錯誤底色與框線改 `color-mix`。
- `components-showcase.html`：`.page-size-select` 補文字色與兩種主題的下拉箭頭（多三行）。

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 0 | |
| 移除 | 0 | |
| 改寫 | 0 | 沒有視圖的重現步驟改變；manifest 的 `how`／`why` 引用的行號都不在行數有變的兩個檔（`task-config.css`、`components-showcase.html`），不必換 |
| `loads` 欄 | 0 | |
| 參數 | 0 | 沒有改讀網址參數的程式 |
| 受影響 | 149 | 154 個視圖中有 149 個的畫面載入了變動的檔（`sidebar.css` 128 個、`task-config.css` 41 個、`task-detail.html` 19 個，其餘各 1–8 個） |

### 應重驗的批次（第十一次）

| 批次 | 載入變動檔的視圖 | 新增 | 該批的參數驅動視圖 |
| :--- | ---: | ---: | ---: |
| `b1-shared-account` | 38／43 | 0 | 沒變 |
| `b2-admin-dashboard-task` | 54／54 | 0 | 沒變 |
| `b3-annotation-review` | 25／25 | 0 | 沒變 |
| `b4-dataset-sweep` | 32／32 | 0 | 沒變 |

這次只動到**顏色**，沒有改行為或版面。淺色主題刻意改變的只有 showcase 的 `.page-size-select`（補上箭頭與 `--color-ink` 文字色）；其餘淺色算出值與 `origin/main` 相同，深色下焦點環、框線與錯誤色改跟深色 token。四批不必重做結構；受影響的元件文件（Color Dot、Pagination）、各文件指向 `components-showcase.html` 與 `task-config.css` 的行號、`design-gaps.md` G-02、G-04、G-10 已在同一張單裡改好。

### 第十次

上一版釘在 `5566aec`。之後 [Issue #438](https://github.com/label-suite/label-suite/issues/438) 補齊深色主題的配色缺口，改了十二個 prototype 檔；同一張單依 prototype 的新行號重新對齊 `navigation.mdx` 與 `docs/specs/07-shared/01-sidebar.mdx` 的行號引用（只改數字），所以三個 sha 都變了。

| 欄位 | 第十版 | 本版 | |
| :--- | :--- | :--- | :--- |
| `commit` | `5566aec2decc` | `fdcea09ac12b` | 必然變 |
| `prototypeTree` | `ecdd14a24d90` | `76fc01d0b121` | **變了** |
| `specsTree` | `58bee0ccf9d5` | `cdf459578e4f` | **變了**（只有一個行號 261→266） |
| `navigationBlob` | `29e4eea42c99` | `90137539fd2f` | **變了**（只改行號，沒有改參數） |

變動的檔：
- `tokens.css`：只改 `--color-toggle-thumb` 的註解（圓鈕改疊在 `--color-border-control` 軌道上的對比），值與行數都不變。
- `shared/list-page.css`：focus ring 改 `color-mix`；`.page-btn.active` 的字改 `--color-on-cta`（G-12）；下拉箭頭依主題分兩條 data-URI。
- `components-showcase.html`：`.input` 補底色與文字色、focus ring 改 `color-mix`、補 `.btn-secondary:hover`、色點的深色邊框、頭像邊框與遮罩圖示。
- `task-config.css`、`account/profile.html`：關閉的開關軌道改 `--color-border-control`。
- `task-detail.html`、`task-new.html`、`admin/user-management.html`、`dashboard.components.css`：下拉箭頭依主題分成兩條 data-URI；`task-detail.html` 另把寫死的內陰影白改走 `--color-white`。
- `annotation-workspace.html`、`dataset-analysis-list.html`：寫死的 `rgba(99,102,241,…)` 邊框與內陰影改 `color-mix`。
- `dataset-analysis-detail.html`：載入 `data-palette.css`（第 10 行）。

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 0 | |
| 移除 | 0 | |
| 改寫 | 0 | 沒有視圖的重現步驟改變；8 個視圖的 `how` 與 1 筆無法重現的 `why` 只把行號換成新位置（`user-management.html`、`dataset-analysis-detail.html`、`task-detail.html`、`task-new.html`），本文 §二、§五 的行號也一起換 |
| `loads` 欄 | 1 | `dataset/dataset-analysis-detail` 新增 `design/prototype/assets/data-palette.css` |
| 參數 | 0 | 沒有改讀網址參數的程式 |
| 受影響 | 140 | 154 個視圖中有 140 個的畫面載入了變動的檔（`tokens.css` 140 個、`task-config.css` 41 個、`dataset-analysis-detail.html` 27 個、`list-page.css` 22 個、`task-detail.html` 19 個，其餘各 1–15 個） |

### 應重驗的批次（第十次）

| 批次 | 載入變動檔的視圖 | 新增 | 該批的參數驅動視圖 |
| :--- | ---: | ---: | ---: |
| `b1-shared-account` | 29／43 | 0 | 沒變 |
| `b2-admin-dashboard-task` | 54／54 | 0 | 沒變 |
| `b3-annotation-review` | 25／25 | 0 | 沒變 |
| `b4-dataset-sweep` | 32／32 | 0 | 沒變 |

這次只動到**顏色**，沒有改行為或版面。淺色主題刻意改變的只有三處：下拉箭頭筆畫由 `#94A3B8` 改 `#5E6B7F`（對白底 2.56→5.40:1）、關閉的開關軌道由 `#E2E8F0` 改 `#7C899D`（3:1）、showcase 補上 `.btn-secondary:hover`；其餘淺色算出值與 `origin/main` 相同。四批不必重做結構；受影響的元件文件（Avatar、Button、Color Dot、Input、List Toolbar、Pagination、Toggle Switch）、showcase 頁面文件與 `design-gaps.md` G-02、G-04、G-10、G-12 已在同一張單裡改好。

### 第九次

上一版釘在 `5b1cb92`。之後 [Issue #437](https://github.com/label-suite/label-suite/issues/437) 把 prototype 裡上色用的 `white` 關鍵字與通知徽章的 `#fff` 換成 token，改了十個 prototype 檔；`docs/specs/` 與 `navigation.mdx` 都沒動。

| 欄位 | 第九版 | 本版 | |
| :--- | :--- | :--- | :--- |
| `commit` | `5b1cb921515b` | `5566aec2decc` | 必然變 |
| `prototypeTree` | `d9c2ab67868b` | `ecdd14a24d90` | **變了** |
| `specsTree` | `58bee0ccf9d5` | `58bee0ccf9d5` | 沒變 |
| `navigationBlob` | `29e4eea42c99` | `29e4eea42c99` | 沒變 |

變動的檔：
- `tokens.css`：新增 `--color-on-badge-notify`（兩種主題都是白）與 `--color-toggle-thumb`（淺色白、深色 slate-200）。這是唯一行數有變的檔。
- `shared/sidebar.css`：通知徽章的字改用 `--color-on-badge-notify`。
- `task-config.css`、`components-showcase.html`、`account/profile.html`：開關圓鈕、chip 的勾、分類勾選框與輸出序號徽章改用 `--color-on-cta` 或 `--color-toggle-thumb`；預覽列的白底改用 `--color-white`。
- `task-list.html`：焦點環外圈改用 `--color-white`。
- 四個帳號頁（`login`、`register`、`forgot-password`、`reset-password`）與 `profile.html`：spinner 的三邊改用 `--color-on-cta` 的半透明混色。

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 0 | |
| 移除 | 0 | |
| 改寫 | 0 | 交付包引用的行號（`login.html:685` 的 `#loginBtnText`、`reset-password.html:548` 的 `successPanel`、`task-list.html:1219` 的 `TASK_LIST_DATA_READY`）都在原地替換的檔裡，行數不變；行數有變的只有 `tokens.css`，交付包沒有引用它的行號 |
| `loads` 欄 | 0 | 沒有新增或移除載入的檔 |
| 參數 | 0 | 沒有改讀網址參數的程式 |
| 受影響 | 153 | 154 個視圖中有 153 個的畫面載入了變動的檔（`tokens.css` 140 個、`sidebar.css` 128 個、`task-config.css` 41 個，其餘各 1–7 個） |

### 應重驗的批次（第九次）

| 批次 | 載入變動檔的視圖 | 新增 | 該批的參數驅動視圖 |
| :--- | ---: | ---: | ---: |
| `b1-shared-account` | 42／43 | 0 | 沒變 |
| `b2-admin-dashboard-task` | 54／54 | 0 | 沒變 |
| `b3-annotation-review` | 25／25 | 0 | 沒變 |
| `b4-dataset-sweep` | 32／32 | 0 | 沒變 |

這次只動到**顏色**，沒有改行為或版面，而且淺色主題的算出值不變：同一張單以 Playwright 對 20 個頁面與狀態比對 `origin/main` 與本分支，淺色下每個元素與偽元素的算出色都相同，深色下只有上面列的部件改變。四批不必重做結構；受影響的元件文件（Toggle Switch、Spinner、Chip、Proto Toggle Bar）與 `brand.md` 已在同一張單裡改好。

### 第八次

上一版釘在 `e69cc99`。之後同一張單（[Issue #420](https://github.com/label-suite/label-suite/issues/420)）依維護者的裁示再改了四個 prototype 檔，並改了 `navigation.mdx`。

| 欄位 | 第八版 | 本版 | |
| :--- | :--- | :--- | :--- |
| `commit` | `e69cc9925435` | `5b1cb921515b` | 必然變 |
| `prototypeTree` | `6241519a5d37` | `d9c2ab67868b` | **變了** |
| `specsTree` | `58bee0ccf9d5` | `58bee0ccf9d5` | 沒變 |
| `navigationBlob` | `fab9fabe0dab` | `29e4eea42c99` | **變了** |

變動的檔：
- `tokens.css`：淺色 `--color-task` 改成 Teal 700，讓它在 `--color-task-bg` 上的文字對比到 4.5:1。
- `data-palette.css`：實體色、輪次色與切分色加上深色那一組（原本兩種主題共用一組）。
- `task-config.data.js`：在 `ENTITY_COLORS` 後面加 `entityPaintColor()`／`entityWashColor()`。
- `task-config.engine.js`：上色處改走這兩個函式，每處只換一行，所以行號沒動。
- `navigation.mdx`：重新對齊行號，並在兩列資料集分析頁補上 `error`。

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 0 | |
| 移除 | 0 | |
| 改寫 | 0 | 重現步驟引用的行號都不在變動的範圍內 |
| `loads` 欄 | 0 | 沒有新增或移除載入的檔 |
| 參數 | 0 | 掃出來的全集不變；`error` 這次補進了契約，§二 的缺口關閉 |
| 受影響 | 140 | 154 個視圖中有 140 個的畫面載入了變動的檔（`tokens.css` 140 個、`data-palette.css` 72 個、`task-config.*` 68 個） |

### 應重驗的批次（第八次）

| 批次 | 載入變動檔的視圖 | 新增 | 該批的參數驅動視圖 |
| :--- | ---: | ---: | ---: |
| `b1-shared-account` | 29／43 | 0 | 沒變 |
| `b2-admin-dashboard-task` | 54／54 | 0 | 沒變 |
| `b3-annotation-review` | 25／25 | 0 | 沒變 |
| `b4-dataset-sweep` | 32／32 | 0 | 沒變；`error` 已在契約裡 |

這次只動到**顏色**，沒有改行為或版面。四批不必重做結構，只要重看顏色。這次已在同一張單裡把 `components/`（35 份）、`pages/`（19 份）與 `MASTER.md` 的每一句顏色描述，逐句對照 HEAD 上淺色與深色兩種主題的實際算出值：17 份元件文件改了 25 處，頁面文件與 `MASTER.md` 0 處。畫不出來的狀態（例如錯誤列、`.pass`／`.warn` 進度條、偽元素的開關鈕）只以 CSS 核對。

### 第七次

上一版釘在 `c77da22`。之後 main 合併了 [Issue #422](https://github.com/label-suite/label-suite/issues/422)（無障礙修正）與 [Issue #423](https://github.com/label-suite/label-suite/issues/423)（元件一致性），兩者都改了 prototype 卻沒有重跑交付包；本分支再加上 [Issue #420](https://github.com/label-suite/label-suite/issues/420) 的寫死色值改 token。這一版把三張單一起算。

| 欄位 | 第七版 | 本版 | |
| :--- | :--- | :--- | :--- |
| `commit` | `c77da22351dd` | `e69cc9925435` | 必然變 |
| `prototypeTree` | `86b43b19dca2` | `6241519a5d37` | **變了** |
| `specsTree` | `e8362d715d6b` | `58bee0ccf9d5` | **變了** |
| `navigationBlob` | `c64128a7e7a5` | `fab9fabe0dab` | **變了** |

變動的檔：prototype 34 個（#422／#423 改 22 個，#420 改 25 個，有重疊）；規格 2 個（`03-task-management/01-task-list.mdx`、`07-shared/01-sidebar.mdx`，兩次都只改引用 prototype 的行號，標題沒變）；`navigation.mdx` 只改引用行號。

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 2 | `dataset/dataset-analysis-list#param-error`、`dataset/dataset-analysis-detail#param-error`（#422 的 `?error=1`）。兩個都在執行中的 prototype 開過才記：清單只剩一列「資料集分析載入失敗」與「重試」、分頁列隱藏；詳情頁兩個面板都換成「資料載入失敗」與「重新載入」 |
| 移除 | 0 | #423 移除的分析詳情 toast 原本就沒有收成視圖 |
| 改寫 | 17 | 重現步驟裡的行號依修正後的檔重新對齊（只搬動內容沒變的行）；兩個 `#modal-audit-log` 的抽屜由 #422 抽到 `shared/audit-drawer.js`，改引用那個檔，並把它加進 `evidence` |
| `loads` 欄 | 17 | #420：五個帳號頁加 `tokens.css`、登入頁加 `google-g.svg`、八個條目加 `data-palette.css`；#422／#423：兩個管理頁加 `audit-drawer.css`／`audit-drawer.js`、三個條目加 `modal-focus.js`、六個條目加 `card.css` |
| 參數 | 2 | 兩個資料集分析條目的 `params` 加 `error`；契約缺口見 §二 |
| 受影響 | 141 | 依 `evidence`／`spec` 算出的；見下表 |

規格錨點逐一對過：新增兩個視圖指到的 `#四種互斥的頁面狀態`、`#載入失敗只換掉內容區` 都是現有標題。

**只看證據仍會低估**：`tokens.css`、`data-palette.css`、`card.css`、`audit-drawer.css` 與 `shared/` 的多個樣式檔沒有被任何視圖列為 `evidence`，而 #420 把 22 個檔的寫死色值換成 token，幾乎每個視圖的顏色來源都變了。

### 應重驗的批次（第七次）

| 批次 | 依 `evidence`／`spec` 算出的 | 新增 | 該批的參數驅動視圖 |
| :--- | ---: | ---: | ---: |
| `b1-shared-account` | 33／43 | 0 | `navigationBlob` 有變，但只改行號，沒有改參數 |
| `b2-admin-dashboard-task` | 52／54 | 0 | 同上 |
| `b3-annotation-review` | 25／25 | 0 | 同上 |
| `b4-dataset-sweep` | 31／32 | 2 | 同上；`error` 是程式新增、契約還沒有的參數 |

四批都要重驗。#420 的部分只需要重看**顏色**（`design-system-setup` 已做 b1～b4 的色值複查，見 `MASTER.md` 變更紀錄第 5 列）；#422／#423 的部分改了行為（彈窗焦點、Esc 與遮罩、提交受阻時的指引、參考值、卡片與按鈕抽成共用樣式），那幾批的元件與畫面規格要依各自的單重驗，本次重跑只記錄它們動到哪些視圖。

### 第六次

[Issue #427](https://github.com/label-suite/label-suite/issues/427) 第五次重跑之後，維護者 2026-11-18 的兩輪裁定又改了 prototype：淺色 `--color-border-control` 從 `#8592A6` 加深為 `#7C899D`（在 surface 上也過 3:1）；日期區間與分類選擇這兩個長得像欄位的觸發鈕改用 `--color-border-control`；五個帳號頁的 `--color-link` 在兩種主題都對齊 `--color-primary-strong`（淺色 `#4F46E5`、深色 `#A5B4FC`）。規格沒有變動。

| 欄位 | 第六版 | 本版 | |
| :--- | :--- | :--- | :--- |
| `commit` | `296af36cfe64` | `c77da22351dd` | 必然變 |
| `prototypeTree` | `a93ce77ce72f` | `86b43b19dca2` | **變了** |
| `specsTree` | `e8362d715d6b` | `e8362d715d6b` | **沒變** |
| `navigationBlob` | `c64128a7e7a5` | `c64128a7e7a5` | **沒變** |

變動的檔共 8 個，全在 prototype：`assets/tokens.css`、五個帳號頁、`shared/date-range-picker.css`、`task-management/task-config.css`。

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 0 | 只改顏色，沒有新的狀態 |
| 移除 | 0 | |
| 改寫 | 0 | 重現步驟都沒變 |
| `loads` 欄 | 0 | 沒有新增或移除 `<script src>`、`<link href>` |
| 行號 | 0 | 8 個檔都是原地替換，行數不變 |
| 受影響 | 17 | 依 `evidence`／`spec` 算出的，全在 `b1-shared-account`（五個帳號頁）；見下表 |

**只看證據會低估**：`tokens.css`、`date-range-picker.css`、`task-config.css` 三個檔沒有被任何視圖列為 `evidence`。`tokens.css` 被 19 個條目裡的 12 個載入，四批都有；`date-range-picker.css` 由 `components-showcase`（b1）與 `task-management/task-detail`（b2）載入；`task-config.css` 由 `task-management/task-detail`、`task-management/task-new`（b2）與 `annotation/annotation-workspace`（b3）載入。所以淺色主題的控制項外框幾乎在每個有表單控制項的視圖都變了。

### 應重驗的批次（第六次）

| 批次 | 依 `evidence`／`spec` 算出的 | 新增 | 該批的參數驅動視圖 |
| :--- | ---: | ---: | ---: |
| `b1-shared-account` | 17／43 | 0 | 0（`navigationBlob` 沒變） |
| `b2-admin-dashboard-task` | 0／54 | 0 | 0（同上） |
| `b3-annotation-review` | 0／25 | 0 | 0 |
| `b4-dataset-sweep` | 0／30 | 0 | 0 |

四批都要重驗，但只需要重看**顏色**：淺色主題的表單控制項外框（四批），日期區間與分類選擇觸發鈕的外框（b1 的 `components-showcase`、b2 的任務頁、b3 的標註工作區），以及帳號頁兩種主題的連結色（b1）。版面、文案、狀態都沒變。

### 第五次

[Issue #427](https://github.com/label-suite/label-suite/issues/427) 依對比裁定改了 token 與控制項外框：`tokens.css` 的次要文字色改值、新增 `--color-border-control`，主色當文字的宣告改用 `--color-primary-strong`，控制項外框改用 `--color-border-control`，日期選擇器的「今天」改用 `--color-primary` 邊框。同一段期間 main 改了兩份規格引用 prototype 的行號（只動行號，標題沒變）。

| 欄位 | 第五版 | 本版 | |
| :--- | :--- | :--- | :--- |
| `commit` | `d06045939d96` | `296af36cfe64` | 必然變 |
| `prototypeTree` | `a71a5d61b57a` | `a93ce77ce72f` | **變了** |
| `specsTree` | `18e6cba23433` | `e8362d715d6b` | **變了** |
| `navigationBlob` | `c64128a7e7a5` | `c64128a7e7a5` | **沒變** |

變動的檔共 39 個：prototype 37 個（#427），規格 2 個（`03-task-management/01-task-list.mdx`、`07-shared/01-sidebar.mdx`，main 上改行號，本分支沒有改 `docs/specs/`）。

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 0 | 只改顏色，沒有新的狀態 |
| 移除 | 0 | |
| 改寫 | 0 | 重現步驟都沒變 |
| `loads` 欄 | 0 | 沒有新增或移除 `<script src>`、`<link href>` |
| 行號 | 0 | prototype 只有 `tokens.css` 的行號位移，交付包沒有引用它的行號；其他 36 個檔都是原地替換，行數不變 |
| 受影響 | 131 | 依 `evidence`／`spec` 算出的；見下表 |

兩份規格的 diff 只改了引用 prototype 的行號，沒有動到任何標題，所以視圖指到的錨點不受影響。

**只看證據會低估**：有 11 個改動的檔（`tokens.css`、`shared/` 的 `input.css`、`list-page.css`、`button.css`、`content-tabs.css`、`date-range-picker.css`，`dashboard.components.css`、`dashboard.layout.css`、`task-config.css`，以及兩個 logo SVG）沒有被任何視圖列為 `evidence`。`tokens.css` 被 19 個條目裡的 12 個載入，五個帳號頁不載入它、各有一份自己的 token 區塊，也一起改了；`shared/app-shell` 的 `sidebar.css` 也在改動之列。所以實際上幾乎每個視圖的顏色都變了。

### 應重驗的批次（第五次）

| 批次 | 依 `evidence`／`spec` 算出的 | 新增 | 該批的參數驅動視圖 |
| :--- | ---: | ---: | ---: |
| `b1-shared-account` | 33／43 | 0 | 0（`navigationBlob` 沒變） |
| `b2-admin-dashboard-task` | 46／54 | 0 | 0（同上） |
| `b3-annotation-review` | 25／25 | 0 | 0 |
| `b4-dataset-sweep` | 27／30 | 0 | 0 |

四批都要重驗，但只需要重看**顏色**：次要文字、主色文字、表單控制項外框與日期選擇器的「今天」。版面、文案、狀態都沒變。

### 第四次

[Issue #418](https://github.com/label-suite/label-suite/issues/418) 依品牌書修正 prototype 的文案、圖示、logo 與斷點；同一段期間 main 也併進了規格的角色表改版（[PR #417](https://github.com/label-suite/label-suite/pull/417)、[PR #419](https://github.com/label-suite/label-suite/pull/419)）。兩者一起進這一版。

| 欄位 | 第四版 | 本版 | |
| :--- | :--- | :--- | :--- |
| `commit` | `eb9a88434fc6` | `d06045939d96` | 必然變 |
| `prototypeTree` | `815b85344df6` | `a71a5d61b57a` | **變了** |
| `specsTree` | `63b7a51d2e3b` | `18e6cba23433` | **變了** |
| `navigationBlob` | `c64128a7e7a5` | `c64128a7e7a5` | **沒變** |

變動的檔共 71 個：prototype 54 個（#418），規格 17 個（main 上的角色表改版，本分支沒有改 `docs/specs/`）。

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 12 | 依 `design-gaps.md` 2026-11-18 對 G-40、G-51 的裁定補上：`task-management/task-new#modal-taxonomy-delete`、`#state-step4`；`task-management/task-detail#state-loading`、`#state-task-not-found`；`admin/user-management#modal-audit-log`、`#modal-edit`；`admin/role-settings#modal-audit-log`、`#modal-dirty`、`#state-stored-invalid`；`annotation/annotation-workspace#modal-review-flow`、`#toast-saved`；`annotation/annotation-list#state-dry-run-feedback`。每一個都在 prototype 實際叫出來過 |
| 無法重現 | 1 | `task-management/task-new#state-banner-error`，見 §五 第 3 筆 |
| 移除 | 0 | |
| 改寫 | 2 | G-52：`dataset/dataset-analysis-detail#state-seq-match-strict`／`-partial` 的重現步驟改指 `entity_recognition` 品質卡，`evidence` 加 `quality-entity_recognition.html`；**ID 不變** |
| `loads` 欄 | 17 個條目 | #418 Q10 給每一頁加了 `<link rel="icon">`，那是 `<link href>`，所以 `assets/logo/icon-colored.svg` 進了 17 個 HTML 條目的 `loads`（`components-showcase` 原本就有）。`params` 沒變 |
| 行號 | 62 行 | prototype 改動讓行號位移，`manifest.json` 36 行與本檔 26 行的行號引用依 `git diff` 的 hunk 逐一換算，抽查過 |
| 受影響 | 140 | **既有的 140 個視圖全部受影響**：每一頁的 HTML 都因 favicon 改過，加上 17 個規格檔 |

受影響視圖指到的規格錨點逐一重比過標題 slug，新舊 152 個**全部還在**。

### 應重驗的批次（第四次）

| 批次 | 依 `evidence`／`spec` 算出的 | 新增 | 該批的參數驅動視圖 |
| :--- | ---: | ---: | ---: |
| `b1-shared-account` | 43 | 0 | 0（`navigationBlob` 沒變） |
| `b2-admin-dashboard-task` | 45 | 9 | 0（同上） |
| `b3-annotation-review` | 22 | 3 | 0 |
| `b4-dataset-sweep` | 30 | 0 | 0 |

四批都要重驗。多數改動是文案、圖示與 favicon，不動版面；會動到版面判讀的是 `sidebar.css` 的斷點（768／767，`shared/app-shell` 13 個視圖）與 `b2`、`b3` 新增的 12 個視圖。

### 第三次

[Issue #403](https://github.com/label-suite/label-suite/issues/403) 撤掉儀表板的「三條最短成功路徑」區塊（畫面 `8eadc38`、規格 `35b7533`），這是交付包產生以來**畫面與規格第一次真的變了**。

| 欄位 | 第三版 | 本版 | |
| :--- | :--- | :--- | :--- |
| `commit` | `b1fd43c84031` | `eb9a88434fc6` | 必然變 |
| `prototypeTree` | `4cb347d5e720` | `815b85344df6` | **變了** |
| `specsTree` | `a4b0e889a5a3` | `63b7a51d2e3b` | **變了** |
| `navigationBlob` | `c64128a7e7a5` | `c64128a7e7a5` | **沒變** |

變動的檔共 7 個：`dashboard.html`、`dashboard.components.css`、`dashboard.i18n.js`，與規格 `02-dashboard/01-dashboard.mdx`、`02-dashboard/index.mdx`、`03-task-management/01-task-list.mdx`、`open-questions.mdx`。

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 0 | 被撤掉的區塊**從來沒有自己的視圖**——它在 `state-default` 等五種版面裡一直顯示，不是一個要叫出來的狀態 |
| 移除 | 0 | 同上 |
| `params` 欄 | 0 | 七個檔的 diff 裡沒有任何 `.get(`、`<script>`、`<link>`、`src=`、`href=` 的增刪，`loads` 與 `params` 照舊 |
| 受影響 | 14 | `dashboard/dashboard` 全部 8 個視圖（`evidence` 指到 `dashboard.html`，`spec` 指到 02-01），`task-management/task-list` 的 6 個視圖（`spec` 指到 03-01，那一頁只改了兩個行號引用與變更紀錄一列，**條文一字未改**） |

受影響視圖指到的規格錨點逐一重比過標題 slug，**14 個全部還在**；被刪掉的標題 `### 三條最短成功路徑` 沒有任何視圖連到它。

### 應重驗的批次（第三次）

| 批次 | 依 `evidence`／`spec` 算出的 | 該批的參數驅動視圖 |
| :--- | ---: | ---: |
| `b1-shared-account` | 0 | 0（`navigationBlob` 沒變） |
| `b2-admin-dashboard-task` | 14 | 0（同上） |
| `b3-annotation-review` | 0 | 0 |
| `b4-dataset-sweep` | 0 | 0 |

`b2` 本來就還沒做，所以這 14 個視圖的重驗**併入 `b2` 的第一次執行**；`b1` 的成果不受影響。

### 第二次

[PR #400](https://github.com/label-suite/label-suite/pull/400) 把 `/task-management/task-detail` 的 16 個畫面狀態參數與工作區的 6 個補進 §網址參數，`navigationBlob` 再次改變。

| 欄位 | 第二版 | 本版 | |
| :--- | :--- | :--- | :--- |
| `commit` | `328ab7ea7d54` | `b1fd43c84031` | 必然變 |
| `prototypeTree` | `4cb347d5e720` | `4cb347d5e720` | **沒變** |
| `specsTree` | `a4b0e889a5a3` | `a4b0e889a5a3` | **沒變** |
| `navigationBlob` | `9ff44128884e` | `c64128a7e7a5` | **變了** |

**畫面與規格仍然一個位元組都沒動**，這已經是連續第二次：導覽文件在長，而它描述的東西沒變。

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 5 | `task-management/task-detail#param-section-basic`／`-labeling`／`-guideline`／`-sampling`／`-review`——設定分頁的五個區段（`SETTINGS_SECTIONS` 的 slug），各自對到 03-03 的一節 |
| 移除 | 0 | |
| `params` 欄修正 | 2 個條目 | `task-detail` 11 → **25**、`annotation-workspace` 9 → **13**（兩步掃描才看得到的那些） |
| 受影響 | 26 | `evidence` 指到 `navigation.mdx` 的全部視圖 |

**為什麼只加五個視圖而不是 22 個**：其餘 17 個新參數是篩選（`ar_*` 六個、`wl_stage`、`wl_member`、`wl_from`／`wl_to` 這組日期區間、`ap_sort`，加上工作區的 `status`／`q`／`limit`／`offset`）與分頁（`ar_page`、`wl_page`、`mm_page`），而 §二 的第一個判斷早就定下「篩選參數不各自成一個視圖」。`section` 不是篩選——它切換的是設定分頁裡**五個不同的區段**，所以逐一成視圖。

**這條引用要打一個折扣。** §二 判斷一是對**清單頁**寫的，它承諾的替代是「每個清單頁只收 `state-default` 與 `state-filtered-empty` 兩種」；而 `task-management/task-detail` 這兩個視圖**一個都沒有**，所以在這一頁，判斷一只擋掉了 13 個參數，沒有給出任何補償視圖。這個缺口 §二 已經自己記著（「`b2` 會吃到這個缺口」），這裡不另開一筆，但不要把它讀成「已經涵蓋」。

### 應重驗的批次

| 批次 | 依 `evidence` 算出的 | 該批的參數驅動視圖 |
| :--- | ---: | ---: |
| `b1-shared-account` | 17 | 9 |
| `b2-admin-dashboard-task` | 8 | 30 |
| `b3-annotation-review` | 1 | 10 |
| `b4-dataset-sweep` | 0 | 27 |

**兩欄都要看**，理由見下面第一次重跑那一節——`evidence` 這條規則兩個方向都不夠，而右邊那一欄是補左邊漏掉的那一半。

---

## 九之一、第一次重跑


[PR #398](https://github.com/label-suite/label-suite/pull/398) 把 §網址參數 寫進 `navigation.mdx`，換掉了 `navigationBlob` 的 sha。依 §七 的規則重跑。

### 四個 sha 的比對

| 欄位 | 上一版 | 本版 | 變了嗎 |
| :--- | :--- | :--- | :--- |
| `commit` | `75084e22bf79` | `328ab7ea7d54` | 必然變（它是「哪個 commit 產生這一版」） |
| `prototypeTree` | `4cb347d5e720` | `4cb347d5e720` | **沒變** |
| `specsTree` | `a4b0e889a5a3` | `a4b0e889a5a3` | **沒變** |
| `navigationBlob` | `83d6ee8674b1` | `9ff44128884e` | **變了** |

畫面與規格一個位元組都沒動，所以這一輪的差異全部來自導覽文件。

### 新增、移除、受影響

| 類 | 數 | 內容 |
| :--- | ---: | :--- |
| 新增 | 1 | `account/reset-password#sim-logged-out` |
| 移除 | 1 | `account/verify-email#sim-logged-out` |
| 受影響 | **26** | `evidence` 指到 `docs/prototype/navigation.mdx` 的全部視圖 |

新增與移除**不是**這次來源變動造成的，是**修掉上一版的一個錯**：`verify-email.html` 根本不呼叫 `redirectIfLoggedIn()`（它那三處都是註解），唯四呼叫的是 login、register、forgot-password 與 reset-password（`sidebar.js:95` 自己寫「四頁在載入時呼叫」）。那是 [PR #394](https://github.com/label-suite/label-suite/pull/394) 補 `sim_logged_out` 時挑錯了頁面，寫 §網址參數 時才查出來。

### 應重驗的批次

| 批次 | 依 `evidence` 算出的受影響視圖 | **實際應重驗** |
| :--- | ---: | :--- |
| `b1-shared-account` | 17 | 17 ＋ 該批 9 個參數驅動視圖 |
| `b2-admin-dashboard-task` | 8 | 8 ＋ 該批 24 個參數驅動視圖 |
| `b3-annotation-review` | 1 | 1 ＋ 該批 10 個參數驅動視圖 |
| `b4-dataset-sweep` | **0** | **27 個參數驅動視圖——這一批跟這次變更最相關** |

`design-system-setup` 讀的就是這一節，所以**左邊那一欄不能直接當成應重驗清單**。原因見下。

**這一輪的「受影響」要讀準**：26 個視圖被標出來，是因為它們的重現步驟引用了導覽文件，而那份文件的內容變了——**畫面本身沒有任何改動**。所以重驗的範圍是「那些 `how` 寫得對不對」，不是「那些畫面長什麼樣變了沒」。

### 這一次重跑驗到了什麼

交付包到上一版為止**只產生過、沒重跑過**，§七 寫的規則一直沒有被執行過。這一輪是第一次，結果是：

- 四個 sha 的比對**照寫的那樣運作**：只有真的變了的那一個被標出來
- 「受影響只看證據」這條**機械上照寫的那樣運作**：26 個視圖是算出來的，不是憑印象挑的

**但那條規則本身在這一輪被證明不夠用，而且是兩個方向都不夠：**

| 方向 | 實測 |
| :--- | :--- |
| **多標** | 26 個裡只有 **3 個**是參數驅動的，其餘 23 個（`account/profile#toast-saved`、`index#state-default`、`components-showcase#state-default`…）只用到轉場表，與這次新增的 §網址參數 無關 |
| **少標（更嚴重）** | 全部 135 個視圖裡有 **70 個**的 `how` 直接由某個網址參數驅動（`?scenario=`、`?tab=`、`?q_state=`、`?task_role=`、`?sim_403=`…），其中 **67 個的 `evidence` 不含 `navigation.mdx`，所以一個都沒被標** |

少標的後果直接寫在上面那張表上：`b4-dataset-sweep` 依 `evidence` 算是 **0**，可是這次 §網址參數 新宣告的值域事實（`/dataset/dataset-analysis-detail` 的 `task_id` 必填、`tab` 只認 `quality`、`q_state` 五值、`s_state` 只認 `empty`）**正是那一批 27 個視圖的 `how` 所斷言的東西**。照 `evidence` 讀，`design-system-setup` 會**完全跳過 b4**——跳過與這次變更最相關的那一批。

所以本輪的應重驗範圍**不是**「`evidence` 指到 `navigation.mdx` 的 26 個」，而是**那 26 個加上四批的全部參數驅動視圖**。

根因是 `evidence` 的顆粒度是「檔」而不是「章節」，而且它記的是「這個視圖的證據在哪」，不是「這個視圖依賴哪些宣告」。要修得改資料形狀——**那是另一件事，不在這一輪**，但在改掉之前，重跑的應重驗清單**不能只讀 `evidence`**。
