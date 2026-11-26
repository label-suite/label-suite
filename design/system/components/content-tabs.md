# Desktop Content Tabs

> 正典章節：`MASTER.md` §Desktop Content Tabs ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c` ｜未標檔名的行號指 `design/prototype/pages/shared/content-tabs.css`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.admin-tabs` 容器（`display: flex`、底部 2px 框線） | 必填 | `pages/shared/content-tabs.css:4` |
| `.admin-tab` ×n（`<a>` 或 `<button>` 皆可，CSS 把三邊框線都關掉） | 必填 | `:15`–`:31` |
| `.active` 標在目前那一個 | 必填 | `:33` |

`.admin-tab` 以 `margin-bottom: -2px` 讓自己的底線壓在容器的底線上（`:21`），所以**兩者的 2px 必須一致**，改一邊就會錯開。

CSS 檔開頭明寫：頁面只能連結這個檔，**不得自行重新定義這兩個選擇器**（`content-tabs.css:2`–`:3`）。

## 變體

| class | 差別 | 依據 |
| :--- | :--- | :--- |
| `.admin-tabs` | 標準，下方留 `--space-lg` | `content-tabs.css:4` |
| `.admin-tabs--panel` | 貼齊側面板頂端：`margin-bottom: 0`、左右 `--space-md`、`flex-shrink: 0` | `:10`–`:14`（issue `singyichen/label-suite#1445`，為 annotation-workspace 的說明面板加的） |

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有，`--color-text-soft`、透明底線 | `content-tabs.css:15`–`:31` |
| hover | 有，文字換 `--color-primary-strong` | `:32` |
| active | 有，文字換 `--color-primary-strong`、底線換 `--color-primary`，字重升 600 | `:33` |
| focus | **未觀察到** | 以 `:focus` 掃全檔，0 命中 → `../design-gaps.md` G-05 |
| disabled | **未觀察到** | 全檔無 `:disabled` |
| 載入中／錯誤／空 | 不適用 | — |
| 窄視窗 | 有。768px 以下不換行，改成橫向捲動並隱藏捲軸 | `:36`–`:44` |

## token

`--color-border`、`--color-text-soft`、`--color-primary`、`--color-primary-strong`、`--space-lg`、`--space-md`、`--dur-fast`。字級 14px 與內距 `10px 20px` 是字面值。

## 鍵盤與焦點

Tab 可達（原生 `<a>`／`<button>`），但**沒有焦點樣式**，也沒有 tablist 的 ARIA：CSS 不提供 `role="tablist"`／`role="tab"`／`aria-selected`，也沒有方向鍵巡覽。是否補齊由每個使用頁面自己決定 → `../design-gaps.md` G-22。

窄視窗下橫向捲動且 `scrollbar-width: none`（`:40`），所以**沒有捲軸可見**——鍵盤使用者 Tab 到被切掉的分頁時瀏覽器會自動捲，滑鼠使用者則沒有提示。

## 樣式出處

`design/prototype/pages/shared/content-tabs.css:1`–`:44`。**沒有進 showcase 的正典區塊**。

## 可重現樣本

本批次**沒有可重現的視圖**：`components-showcase.html` 不含 content tabs，b1 的九個畫面也沒有一個用它。最近的樣本在 b2 的 `task-management/task-detail`（六個分頁）。→ `../design-gaps.md` G-21

**b2 補上**：`task-management/task-detail#tab-overview`（按鈕版，含方向鍵）、`admin/user-management#state-default`（連結版）。

## shadcn 對照

候選原語 `Tabs`（`TabsList`、`TabsTrigger`、`TabsContent`）。

- **我們有而它沒有**：`--panel` 這個貼齊側面板的變體、窄視窗的橫向捲動。
- **它有而我們沒有**：完整的 tablist ARIA、方向鍵巡覽、`TabsContent` 的顯示切換（我們只管分頁列，內容切換由頁面自理）、focus ring。
- **語意對不上**：shadcn 的 `Tabs` 同時管列與內容；我們的 `.admin-tabs` **只是一列按鈕**，而且實際用途常常是路由（`task-detail` 用 `?tab=` 換網址），不是同頁切換。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| 無（b1） | — |
| `admin/user-management#state-default`、`admin/role-settings#state-default` | `.admin-tabs`（`user-management.html:285`–`:287`、`role-settings.html:335`–`:337`）；兩個分頁是 `<a>` 換頁，**頁面自己補了** `role="tablist"`／`role="tab"`／`aria-selected`，沒有方向鍵 |
| `task-management/task-detail`（全部 `#tab-*`） | `.admin-tabs`（`task-detail.html:1885`–`:1892`），按鈕＋`role="tab"`，初始化前 `aria-disabled`；**方向鍵巡覽在本頁**（`:11884`–`:11900`）→ `../design-gaps.md` G-22 |
| `annotation/annotation-workspace`（`#tab-guideline`、`#tab-history`） | `.admin-tabs.admin-tabs--panel`（`annotation-workspace.html:1288`–`:1289`）。按鈕沒有 `tablist`／`tab`／`aria-selected`，只能點（`setupGuidelineTabs`，`annotation-workspace.config.js:6736`–`:6754`）→ `../design-gaps.md` G-22 |
| `dataset/dataset-analysis-detail`（`#tab-stats`、`#tab-quality`） | `.admin-tabs role="tablist"`（`dataset-analysis-detail.html:257`–`:260`），兩顆 `<button role="tab">` 帶 `aria-selected`／`aria-controls`，面板 `role="tabpanel"`；只能點，沒有方向鍵（`:2545`–`:2550`）→ `../design-gaps.md` G-22 |

b2 已補上（見上表）。b3 已補上（見上表）。b4 已補上（見上表）。`shared/sidebar.css` 也提到它，見 [app-shell](app-shell.md) 與 `../design-gaps.md` G-25。
