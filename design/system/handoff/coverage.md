# 覆蓋核對

交付包版本：commit `31c202e8934ff9b1229280daf79e7256a5fe386e`，prototype tree `4cb347d5e720203418701a0a4a6b521cc117c64e`。
產生依據：[`design-handoff` skill](../../../.claude/skills/design-handoff/SKILL.md) 的步驟 4。工作源頭是 [Issue #248](https://github.com/label-suite/label-suite/issues/248)。

**本次是第一版**，所以沒有「本次重跑」那一節。

| 項目 | 數 |
| :--- | ---: |
| 畫面 | 18 |
| 視圖 | 115 |
| 批次 | 5 |
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

`pages/shared/` **一個 HTML 都沒有**（15 個 CSS 與 JS），所以它不產生畫面；它排在 `b1` 是因為那些檔決定全站共用元件的樣子。

---

## 二、`navigation.mdx` 的 `Inline` 列 vs 展開出來的視圖

`navigation.mdx` 共 **24 列 `Inline`**，分佈在 16 個頁面（`index.html` 與 `components-showcase.html` 沒有）。**每一列都對得到至少一個視圖**——視圖就是從那些列加上掃出來的 URL 參數展開的。

視圖數比 `Inline` 列多很多（115 vs 24），因為 `Inline` 把「搜尋／篩選／排序／分頁」這類寫成一列，而 URL 參數掃描把它們拆成可個別重現的狀態。

### 這一輪刻意做的三個判斷

這三個不是裁定，是**本次執行的判斷**，寫在這裡讓下一個人可以推翻：

1. **篩選參數不各自成一個視圖。** `?q=`、`?keyword=`、`?status=`、`?limit=`、`?offset=`、`?output_type=` 這類換的是**資料**不是版面，所以每個清單頁只收「預設」與「篩到空」兩種（`state-default`、`state-filtered-empty`），不為每個參數值各開一個視圖。要逐值展開的話，光 `task-list` 一頁就會有上百個。
2. **`?sim_logged_in=1` 在帳號頁算一個視圖**，即使它的可觀察結果是「本頁自動導走」。理由是 prototype 特地提供這個旗標來叫出那個行為，而規格 01-01 Q3 定義了它。
3. **`dataset-analysis-detail` 的八種輸出類型逐型成一個視圖**（統計與品質各八個，共 16 個）。理由是它們是**16 個獨立的 HTML 檔**，不是同一個版面的資料差異。

---

## 三、`docs/specs/` 的頁面 vs 畫面

20 份規格頁（不含 `index.mdx`、`glossary.mdx`、`00-prd.mdx`、`open-questions.mdx`），**16 份有視圖指向它**，4 份沒有。逐頁對照見 [`spec-index.md`](./spec-index.md)。

### 規格有、畫面沒有：**0 筆**

4 份沒有視圖的規格頁，**每一份都有紀錄說明為什麼**，沒有一份是漏掉的：

| 規格頁 | 為什麼沒有畫面 |
| :--- | :--- |
| `01-account/05-login-state.mdx` | PRD §Site Map 列在「不是獨立頁面」 |
| `07-shared/01-sidebar.mdx` | PRD §Site Map 列在「不是獨立頁面」。它的實體是每一頁都載入的 `shared/sidebar.js` 與 `shared/sidebar.css` |
| `07-shared/02-workspace-tabs.mdx` | PRD §Site Map 列在「不是獨立頁面」 |
| `05-dataset/03-ingestion-lineage.mdx` | 該頁 §已確認決議 **Q1**（維護者 2026-11-08 裁定）**刻意**不補畫面；建立者的入口在規格 03-02 第一步、出口在 03-03 的試標發布 |

另兩份 PRD 也列為「不是獨立頁面」的規格**反而有視圖指向它**，因為它們的行為落在別的畫面上：

- `07-shared/03-denied-and-not-found.mdx` ← `task-management/task-detail#sim-403`、`task-management/task-list#param-unauthorized`
- `07-shared/04-notification-events.mdx` ← `dashboard/dashboard#modal-notification`

### 畫面有、沒有規格可連：**2 筆**

| 畫面 | 說明 |
| :--- | :--- |
| `index` | 站台入口，只做 meta refresh 到登入頁。沒有規格描述它，也不需要 |
| `components-showcase` | living styleguide，開發與設計參考頁，不在產品導航流程內。它是 `design-system-setup` 取元件樣本的主來源 |

---

## 四、動態片段與素材

**22 個動態片段全部存在**（6 個 panel ＋ 16 個 partial），路徑是從兩個畫面的路徑對應表讀出來的、不是用檔名猜的。
`task-detail.html` 自己的註解寫明降級行為：某個 panel 載入失敗時只留下它的佔位符，其餘 panel 仍載入、其他分頁仍可用——已收為 `task-management/task-detail#state-panel-load-failed`。

`manifest.json` 的 `loads` 與 `views[].evidence` 一共指到 **406 個檔案路徑**，逐一確認存在，**0 筆缺失**。

### 本次抽取沒有碰到的 23 個檔

`design/prototype` 在版控裡共 119 個檔，本次抽取到 **96 個**。剩下 23 個：

| 類 | 數 | 檔 |
| :--- | ---: | :--- |
| 圖示 | 17 | `assets/icons/` 的 `bar-chart-3`、`bell`、`chevron-right`、`clock`、`eye-off`、`globe`、`info`、`layout-dashboard`、`lock`、`log-out`、`mail`、`more-horizontal`、`play-circle`、`search`、`settings`、`user`、`x` |
| Logo | 4 | `assets/logo/` 的 `banner`、`icon`、`logo-horizontal`、`social-preview` |
| 其他 | 2 | `README.md`（說明文件，不被載入）、`assets/analytics.config.example.json`（檔名自己寫著 example） |

**這 21 個素材的檔名在 prototype 的任何 HTML／CSS／JS 裡都搜不到**（逐檔以 basename 全文掃過）。合理的解釋是畫面把 SVG 直接內嵌在 HTML 裡（`annotation-workspace.html` 的 ⓘ 圖示就是內嵌的 `<svg>`），所以 `assets/icons/` 的檔案沒人載入。

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
