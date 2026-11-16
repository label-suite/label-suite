# 覆蓋核對

交付包版本：commit `b1fd43c84031f254b82e195e9659ba41dfa3a41a`，prototype tree `4cb347d5e720203418701a0a4a6b521cc117c64e`。
產生依據：[`design-handoff` skill](../../../.claude/skills/design-handoff/SKILL.md) 的步驟 4。工作源頭是 [Issue #248](https://github.com/label-suite/label-suite/issues/248)。

**本次是第三版**（第二次重跑）。差異見 §九。

| 項目 | 數 |
| :--- | ---: |
| 條目 | 19（18 個畫面 ＋ 1 個共用外殼） |
| 視圖 | 140 |
| 批次 | 5（`b0` 本 skill 做完，`b1`–`b4` 交給 `design-system-setup`） |
| 無法重現的視圖 | 2 |
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

這是一個**刻意寬鬆**的斷言：「至少一個」不等於逐項涵蓋。逐列看，`task-detail` 的「設定、抽樣、guideline、run control、成員操作、匯出」整列只對到六個分頁與 `state-panel-load-failed`——一個 12,501 行、6 個 panel、含日期區間選擇器與分類刪除彈窗的畫面只收 12 個視圖，`modal-`／`toast-` 一個都沒有。`design-system-setup` 在 `b2` 會吃到這個缺口。

視圖數比 `Inline` 列多很多（140 vs 24），因為 `Inline` 把「搜尋／篩選／排序／分頁」這類寫成一列，而 URL 參數掃描把它們拆成可個別重現的狀態。

### 另一道對照：網址參數契約 vs 掃出來的全集

[PR #398](https://github.com/label-suite/label-suite/pull/398) 把參數寫成契約之後，多了一道機械對照：**`navigation.mdx` §網址參數 宣告的，與逐檔掃 `.get('<名稱>')` 得到的全集，兩個方向都要對得上**。

本次結果（**第三版，兩步掃描**）：**兩個方向各 0 筆。**

第二版寫「兩個方向各 0 筆」而**那是錯的**，因為掃描法只找字面量 `.get('<名稱>')`，看不見把參數名放在表裡、以變數讀的寫法。獨立審查連續兩輪抓到四處這種寫法：

| 位置 | 名字從哪來 | 宣告新參數 |
| :--- | :--- | ---: |
| `task-detail.html:5117` | `URL_VIEW_STATE` | **16** |
| `annotation-workspace.config.js:1552` | `LIST_VIEW_STATE_KEYS` ＋ `LIST_IDENTITY_KEYS` | **6** |
| `dataset-analysis-detail.html:2432` | `PROTOTYPE_ONLY_PARAMS` | 0（`s_state` 已在表上） |
| `sidebar.js:731` | 列舉既有鍵 | 0 |

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

兩筆，**都是規格要求而畫面沒有**，而且兩筆都已經有單在追（[Issue #187](https://github.com/label-suite/label-suite/issues/187) 的第 1、2 項，維護者 2026-11-12 裁定先不做）。

### 1. `annotation/annotation-list#state-loading`

- **卡在哪一步**：這一頁**沒有任何載入狀態可以叫出來**。python 掃 `annotation-list.html` 的 `skeleton`、`loading`、`載入` 三個字各 0 次。
- **對照**：同一個 repo 的 `task-detail.html`、`dashboard.html`、`profile.html` 各有一套骨架，而 `components-showcase.html` 也有正典的 §Skeleton 元件（Variant A pulse 與 Variant B shimmer）。所以缺的不是元件，是這一頁沒有接。
- **規格**：[04-01 §空的與找不到](../../../docs/specs/04-annotation/01-annotation-list.mdx#空的與找不到) 第 1、2 條要求「資料還沒讀進來時要顯示載入中，不得先顯示一張空表格或『目前尚無資料。』」，而且兩者必須明顯分得出來。
- **現況的後果**：讀取有延遲時畫面會先顯示「目前尚無資料。」——那句話的意思是「這個任務還沒發布資料」，與「還在讀」對使用者是兩回事。

### 2. `annotation/annotation-workspace#state-task-goal-and-instruction`

- **卡在哪一步**：右欄「任務說明」區只算繪**任務名稱**——`annotation-workspace.config.js` 的 `setText('guidelineSummaryText', taskName)`，而 `taskName` 取自 `currentProfile.nameZh`／`nameEn`。
- **規格**：[04-02 §右欄：說明與檔案、操作紀錄](../../../docs/specs/04-annotation/02-annotation-workspace.mdx#右欄說明與檔案操作紀錄) 第 6 條要求這一區「**依序承載三件事**：名稱、任務目標、操作指引」。
- **缺到什麼程度**：不只是沒有版位——那兩段的**內容在 prototype 裡不存在**，任務資料上也沒有對應欄位。所以這不是「叫不出來」，是「沒有東西可以叫」。

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

---

## 八、共用外殼 `shared/app-shell`

`design/prototype/pages/shared/sidebar.js` 被 18 個畫面裡的 **16 個**載入（只有 `index.html` 與 `components-showcase.html` 沒有），而它自己有 **13 個狀態**：

| 視圖 | 證據（摘要） |
| :--- | :--- |
| `#state-theme-dark` | 主題鈕 `:2080`／`:2054`；載入 `theme.js` 的 11 頁走它的 `setChoice()`（`:364`–`:367` 提前 return），其餘 5 個帳號頁走 `:370`／`:374` |
| `#state-lang-en` | `#langToggle` `:2046`／`#mobileLangToggle` `:2050` → `applyGlobalLanguage()` `:427` |
| `#state-sidebar-collapsed` | **桌機**（`:513` 的 `min-width: 769px`）收合 → `body.sidebar-collapsed` `:2524` |
| `#state-mobile` | `sidebar.css` 的 `@media (max-width: 768px)`：另一套版面，另有 `#mobileLangToggle`／`#mobileThemeToggleBtn`／`#mobileLogoutBtn` |
| `#state-user-chip` | `#userAvatar` `:2097`、`#userName`、`#roleIndicator` `:2100`；頭像取自 `label-suite-profile-avatar` `:55` |
| `#state-logout` | `#logoutBtn` `:2103`／`#mobileLogoutBtn` `:2064`，一次清掉 7 個 storage 鍵 |
| `#modal-notification` | `#notificationDropdown` `:2259`、`#notifMarkAllBtn` `:2274`、`#notificationBadge` |
| `#modal-shortcut` | `#shortcutHelpModal` `:2108`，開關在 `:2208` |
| `#role-super-admin` | `:536` 在不是 `super_admin` 時隱藏 `#navAdminItem` `:627` |
| `#state-admin-submenu-open` | `:539`–`:541`：桌機且未收合才展開成兩個連結 |
| `#state-active-task-type` | `labelsuite.activeTaskType` `:4` 決定標記作業那一項的標籤與 `#roleIndicator` |
| `#state-workspace-tabs` | 頁籤列 `:1524`、總覽選單、重開、全部關閉與三種通知；6 個 sessionStorage 鍵 |
| `#param-ap-stage` | **任務詳情**才讀（`:762`）：`:769`／`:772` 設 `stageBadge` → `data-stage-badge` `:1252` |

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

### 第二次（本版）

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

**為什麼只加五個視圖而不是 22 個**：其餘的新參數是篩選（`ar_*`、`wl_stage`、`wl_member`、`ap_sort`、工作區那四個）與分頁（`*_page`），而 §二 的第一個判斷早就定下「篩選參數不各自成一個視圖」。`section` 不是篩選——它切換的是設定分頁裡**五個不同的區段**，所以逐一成視圖。

### 應重驗的批次

| 批次 | 依 `evidence` 算出的 | 該批的參數驅動視圖 |
| :--- | ---: | ---: |
| `b1-shared-account` | 17 | 9 |
| `b2-admin-dashboard-task` | 8 | 29 |
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

新增與移除**不是**這次來源變動造成的，是**修掉上一版的一個錯**：`verify-email.html` 根本不呼叫 `redirectIfLoggedIn()`（它那三處都是註解），唯四呼叫的是 login、register、forgot-password 與 reset-password（`sidebar.js:89` 自己寫「四頁在載入時呼叫」）。那是 [PR #394](https://github.com/label-suite/label-suite/pull/394) 補 `sim_logged_out` 時挑錯了頁面，寫 §網址參數 時才查出來。

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
