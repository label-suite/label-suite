# Label Suite — Design System MASTER

> 批次 `b1-shared-account` 建立、`b2-admin-dashboard-task`／`b3-annotation-review`／`b4-dataset-sweep` 補寫 ｜交付包 commit `b1fd43c` → `eb9a884`（prototype tree `815b853`、specs tree `63b7a51`）

## 這份檔是重建的，不是原件

`design/prototype/` 裡有 **25 處**註解引用 `design/system/MASTER.md`，但在本批次之前這個檔**並不存在於本 repo**。那些引用指向的是原始 repo（`singyichen/label-suite`）的同名檔。

本檔是依 [`design-system-setup`](../../.claude/skills/design-system-setup/SKILL.md) 的四種依據，**從 prototype 的實際程式碼反推重建**的。因此：

- **章節名沿用**那些註解指名的名字（§Buttons、§Inputs、§Empty State、§Desktop Content Tabs、§Metric KPI Tile…），這樣既有註解才不會變成懸空引用。
- **版本號與行號引用無法重現**：`tokens.css:3`（「updated 2026-04-18」）、`:32` 與 `:182`（「MASTER.md v1.7.1」）、`:70`（「MASTER.md Changelog」）、`annotation-workspace.config.js:3944`（「MASTER.md:1423-1482」）、`:3947`（「MASTER.md:1482」）指的都是原件的版本與行數。本檔從第 1 版重新起算，**那五處引用在本 repo 解析不到**，記在 [`design-gaps.md`](design-gaps.md) G-25。
- 原始 repo 的 `design/system/` 依 `design-handoff` 鐵律是**參照，不是依據**，所以本檔沒有從它抄任何內容。

## 怎麼查

| 想知道 | 看哪裡 |
| :--- | :--- |
| 這個元件長什麼樣、有哪些狀態、用了哪些 token | [`components/<元件>.md`](components/) |
| 這個畫面用到哪些元件 | [`pages/<頁面>.md`](pages/) |
| 哪個元件被哪些畫面用（雙向對照） | [`screen-inventory.md`](screen-inventory.md)（**生成的，不要手改**） |
| 跨元件的共同約定 | [`ux-conventions.md`](ux-conventions.md) |
| 品牌層的規則：鐵律、內容與語氣、視覺語彙、圖示、logo 與 CIS 使用 | [`brand.md`](brand.md) |
| 原型和規格對不上、或缺證據的地方 | [`design-gaps.md`](design-gaps.md) |
| 某個視圖怎麼在 prototype 上叫出來 | [`handoff/manifest.json`](handoff/) 的視圖 ID 與 `how` |
| token 的實際值 | `design/prototype/assets/tokens.css`，或 `label-suite-design` skill。**本目錄一律只寫 token 名，不抄 hex** |
| 業務規則 | `docs/specs/`。本目錄不重述規則，只連過去 |

## 命名約定

### 「工作頁籤」與「Content Tabs」是兩個東西

`sidebar.css:963` 與 `sidebar.js:682` 都引用「MASTER.md 的 terminology note」來區分這兩者。本節就是那一節，內容由那兩處註解與程式碼反推：

| 名稱 | 是什麼 | 元件 |
| :--- | :--- | :--- |
| **工作頁籤**（workspace tabs） | 側欄上方的**跨頁面**頁籤列，記錄使用者開過哪些工作頁，有上限、重開堆疊與改鍵通知。狀態存在 `localStorage` 的 `labelsuite.workspaceTabs`（`sidebar.js:7`） | [App Shell](components/app-shell.md) |
| **Content Tabs** | 單一頁面**內部**的分頁列（`.admin-tabs` ／ `.admin-tab`），切的是同一頁的不同區塊 | [Desktop Content Tabs](components/content-tabs.md) |

兩者視覺相似、語意相反：前者是導覽歷程，後者是頁內結構。寫規格與 `ui-design.md` 時不要混用。

### 其他

- 元件檔名用 kebab-case 英文，和 `components/` 的檔名一致。
- 元件標題用正典章節名的英文原文（`Button`、`Metric KPI Tile`），不翻譯。
- 視圖 ID 沿用交付包的 `<模組>/<頁面>#<視圖>`，**一旦發出就不改字面**。

## 元件一覽

35 份。「正典」欄指 `MASTER.md` 的章節名是否由 prototype 註解指名；「b1」～「b4」欄是各批用到它的畫面數，來自 [`screen-inventory.md`](screen-inventory.md)。

### 正典區塊定義的（20）

來源是 `design/prototype/components-showcase.html:139`–`:973` 的「MASTER.md canonical component CSS」。

| 元件 | 正典章節 | b1 | b2 | b3 | b4 | 狀態 |
| :--- | :--- | ---: | ---: | ---: | ---: | :--- |
| [Button](components/button.md) | §Buttons | 6 | 6 | 2 | 1 | ✅ b1 完成 |
| [Input](components/input.md) | §Inputs | 6 | 2 | 1 | 0 | ✅ b1 完成 |
| [Toggle Switch](components/toggle-switch.md) | §Toggle Switch | 2 | 2 | 0 | 0 | ✅ b1 完成 |
| [Badge](components/badge.md) | §Semantic State Colors ＋ §Status Badges | 1 | 5 | 1 | 2 | ✅ b1 完成 |
| [Status Pill](components/status-pill.md) | §Status Pill | 1 | 0 | 1 | 0 | ✅ b1 完成 |
| [Alert Banner](components/alert-banner.md) | §Error / Alert Banner | 3 | 2 | 0 | 0 | ✅ b1 完成 |
| [Toast](components/toast.md) | §Toast | 2 | 5 | 1 | 1 | ✅ b1 完成 |
| [Skeleton](components/skeleton.md) | §Skeleton | 2 | 2 | 0 | 0 | ✅ b1 完成 |
| [Chip](components/chip.md) | §Chip | 1 | 2 | 0 | 1 | ✅ b1 完成 |
| [Pagination](components/pagination.md) | §Pagination | 1 | 3 | 1 | 1 | ✅ b1 完成 |
| [Breadcrumb](components/breadcrumb.md) | §Breadcrumb | 1 | 1 | 2 | 1 | ✅ b1 完成 |
| [Review Status Track](components/review-status-track.md) | §Review Status Track | 1 | 0 | 1 | 0 | ✅ b1 完成 |
| [Color Dot](components/color-dot.md) | §Color Dot | 1 | 2 | 0 | 1 | ✅ b1 完成 |
| [Divider](components/divider.md) | §Divider | 2 | 0 | 0 | 1 | ✅ b1 完成 |
| [Accordion](components/accordion.md) | §Accordion | 1 | 2 | 0 | 1 | ✅ b1 完成 |
| [Progress Bar](components/progress-bar.md) | §Progress Bar | 1 | 1 | 2 | 2 | ✅ b1 完成 |
| [Metric KPI Tile](components/metric.md) | §Metric KPI Tile | 1 | 2 | 0 | 1 | ✅ b1 完成 |
| [State Panel](components/state-panel.md) | §State Panel | 4 | 0 | 0 | 0 | ✅ b1 完成 |
| [Avatar](components/avatar.md) | §Avatar | 2 | 0 | 0 | 0 | ✅ b1 完成 |
| [Date Range Picker](components/date-range-picker.md) | 無（`shared/` 自己是來源） | 1 | 1 | 0 | 0 | ✅ b1 完成 |

### 共用 CSS 定義、但沒有進正典區塊的（5）

這五個在 `components-showcase.html` 上**看不到**，b1 沒有使用畫面（[`design-gaps.md`](design-gaps.md) G-21）；b2 補上了樣本。

| 元件 | 來源 | b1 | b2 | b3 | b4 | 狀態 |
| :--- | :--- | ---: | ---: | ---: | ---: | :--- |
| [Empty State](components/empty-state.md) | `shared/empty-state.css`（經 `sidebar.css` 的 `@import` 散佈） | 0 | 6 | 2 | 2 | ✅ b2 補上樣本 |
| [Desktop Content Tabs](components/content-tabs.md) | `shared/content-tabs.css` | 0 | 3 | 1 | 1 | ✅ b2 補上樣本 |
| [Modal](components/modal.md) | `shared/modal.css` ＋ `shared/modal-focus.js` | 0 | 5 | 1 | 0 | ✅ b2 補上樣本 |
| [List Toolbar](components/list-toolbar.md) | `shared/list-page.css:1`–`:47` | 0 | 2 | 1 | 1 | ✅ b2 補上樣本 |
| [Data Table](components/data-table.md) | `shared/list-page.css:49`–`:72` | 0 | 4 | 1 | 2 | ✅ b2 補上樣本 |

### 外殼與帳號頁自己長出來的（7）

正典沒有章節，但它們真實存在而且有使用畫面。

| 元件 | 來源 | b1 | b2 | b3 | b4 | 狀態 |
| :--- | :--- | ---: | ---: | ---: | ---: | :--- |
| [App Shell（Sidebar）](components/app-shell.md) | `shared/sidebar.css` ＋ `sidebar.js` | 2 | 6 | 2 | 2 | ✅ b1 完成；b2 核完 token 清單（G-24） |
| [Auth Card](components/auth-card.md) | 五個帳號頁各自的 `<style>` | 5 | 0 | 0 | 0 | ✅ b1 完成（已分裂成四份，G-28） |
| [Auth Navbar](components/auth-navbar.md) | 同上 | 5 | 0 | 0 | 0 | ✅ b1 完成（已分裂成兩份，G-28） |
| [Language Toggle](components/lang-toggle.md) | 同上；正典對應 `.btn-language` | 6 | 0 | 0 | 0 | ✅ b1 完成（五頁唯一沒分裂的） |
| [Spinner](components/spinner.md) | 四個帳號頁各自的 `<style>` | 1 | 0 | 0 | 0 | ✅ b1 完成 |
| [Password Eye Toggle](components/password-eye-toggle.md) | 四個帳號頁各自的 `<style>` | 4 | 0 | 0 | 0 | ✅ b1 完成 |
| [Proto Toggle Bar](components/proto-toggle-bar.md) | `reset-password`、`verify-email` | 2 | 0 | 0 | 0 | ✅ b1 完成（**原型鷹架，不是產品元件**） |

### b2 新增的（3）

prototype 註解指名了章節，但 b1 沒有證據；b2 依它們的出貨實作寫成規格。

| 元件 | 正典章節（只見於註解） | b1 | b2 | b3 | b4 | 狀態 |
| :--- | :--- | ---: | ---: | ---: | ---: | :--- |
| [Card](components/card.md) | §Cards（`pages/dashboard/dashboard.layout.css:171`） | 0 | 3 | 1 | 1 | ✅ b2 完成（#423 抽成 `pages/shared/card.css`，G-41） |
| [Tooltip](components/tooltip.md) | §Tooltip（`pages/task-management/task-config.css:259`） | 0 | 2 | 1 | 0 | ✅ b2 完成；b3 補上審核說明變體 |
| [Step Indicator](components/step-indicator.md) | §Step Indicator（`assets/tokens.css:21`） | 0 | 1 | 0 | 0 | ✅ b2 完成（**單頁專屬**） |

### 只「引用」、不重寫的

prototype 的註解另外指名的章節裡，這一個不是元件（b1 原列四個，§Cards、§Tooltip、§Step Indicator 已由 b2 寫成上表）：

| 章節 | 引用處 | 待 |
| :--- | :--- | :--- |
| §Changelog | `assets/tokens.css:70` | 原件的版本紀錄，本檔從第 1 版起算 |

## 批次狀態

| 批次 | 範圍 | 條目 | 視圖 | 狀態 |
| :--- | :--- | ---: | ---: | :--- |
| `b0-inventory` | 全站點名 | 19 | 140 | ✅ 已完成（[PR #401](https://github.com/label-suite/label-suite/pull/401)，第二次重跑） |
| `b1-shared-account` | `pages/shared/`、`pages/account/`、`index.html`、`components-showcase.html` | 9 | 43 | ✅ 已完成（交付包 `b1fd43c`） |
| `b2-admin-dashboard-task` | `pages/admin/`、`pages/dashboard/`、`pages/task-management/` | 6 | 45 | ✅ 已完成（交付包 `eb9a884`） |
| `b3-annotation-review` | `pages/annotation/` | 2 | 22 | ✅ 已完成（交付包 `eb9a884`） |
| **`b4-dataset-sweep`** | `pages/dataset/`，以及全站覆蓋複查 | **2** | **30** | ✅ **本批次**（交付包 `eb9a884`） |

### b1 的成果

- 元件規格 **32 份**，每份七個欄位加 shadcn 對照。
- 畫面規格 **9 份**，涵蓋交付包 b1 的全部 43 個視圖。
- 跨元件約定 **4 條寫完**（UXC-06／07／08／11），**5 條登記待補**（03／04／05／09／10），**2 格留空**（01／02）。
- 差異 **33 筆**：原型與規格差異 12、缺狀態證據 6、待重新設計 15。編號到 G-36，其中 G-16、G-32、G-35 在本批次自審時撤回（見 [`design-gaps.md`](design-gaps.md) §撤回的條目），編號不重用。
- `components/` 與 `pages/` **0 個 hex 色值**；寫死的原值只出現在 [`design-gaps.md`](design-gaps.md) 引用畫面原文時（`design-system-setup` 步驟 8.2）。

### b2 接手時要先讀的

1. [`design-gaps.md`](design-gaps.md) 的 G-01、G-03、G-28、G-33 四條**已有裁定或待裁定**的，不要重開。
2. G-21 的五個元件在 b2 第一次會有使用畫面，請補上它們的「可重現樣本」與「用到它的畫面」。
3. G-24（側欄 token 清單）與 G-10（Toast／Skeleton 的多份實作）指名由 b2 完成。
4. [`ux-conventions.md`](ux-conventions.md) 的 UXC-03、09、10 證據在 b2 的畫面上。
5. **別批的使用關係要保留**（鐵律 5）：b2 只能往 `components/<元件>.md` 的「用到它的畫面」**追加**，不得把 b1 的那幾列刪掉。

### b2 的成果

- 元件規格新增 **3 份**（Card、Tooltip、Step Indicator），共 35 份；既有 23 份追加了 b2 的「用到它的畫面」，G-21 的五份補上可重現樣本。
- 畫面規格 **6 份**，涵蓋交付包 b2 的全部 45 個視圖。找得到但沒有視圖 ID 的畫面與疊加層記在 G-40，不替它們取 ID。
- 跨元件約定新寫 **3 條**（UXC-03／09／10），共 7 條寫完；UXC-04／05 待 b3。
- 差異新增 **9 筆**（G-37～G-45），共 42 筆：原型與規格差異 17、缺狀態證據 7、待重新設計 18。G-10、G-21、G-22、G-24、G-36 追加了 b2 的核對結果，過去的裁定不動。
- 交付包有一處文字與檔案不符：`admin/user-management#modal-invite` 的說明寫本頁沒載 `modal.css`，實際有載（見 [`pages/admin-user-management.md`](pages/admin-user-management.md)）。以檔案為準，交付包不改。

### b3 接手時要先讀的

1. G-01、G-03、G-28、G-33、G-34 已有裁定，不要重開；G-37～G-45 的待決問題等維護者。
2. [`ux-conventions.md`](ux-conventions.md) 的 UXC-04、05 證據在 `annotation-workspace.config.js:657`、`:3058`；UXC-03、09 還有 b3 的引用要核對（`:1980`、`:2032`，`annotation-list.html:1949`）。
3. [Tooltip](components/tooltip.md) 的第二處（`annotation-workspace.config.js:3943`）、Toast 與 Skeleton 在 b3 的那幾份（G-10）、`annotation-workspace` 沒有定義側欄的兩個窄視窗 token（G-24）。
4. **別批的使用關係要保留**（鐵律 5）。

### b3 的成果

- 元件規格沒有新增（仍 35 份）；18 份追加了 b3 的「用到它的畫面」，[Tooltip](components/tooltip.md) 補上第二個變體（審核說明）。
- 畫面規格 **2 份**，涵蓋交付包 b3 的全部 22 個視圖；其中 `annotation/annotation-list#state-loading` 與 `annotation/annotation-workspace#state-task-goal-and-instruction` 是交付包列為**無法重現**的視圖，畫面檔照實寫明，追蹤在 label-suite/label-suite#187。
- 跨元件約定新寫 **2 條**（UXC-04／05），共 9 條寫完；UXC-03、07、09 加上 b3 的核對。
- 差異新增 **6 筆**（G-46～G-51），共 48 筆：原型與規格差異 20、缺狀態證據 8、待重新設計 20。G-02、G-04、G-10、G-13、G-22、G-23、G-24、G-36、G-37、G-41、G-43 追加了 b3 的核對結果，過去的裁定不動。
- `annotation-workspace` 的六個 overlay 都接了 `modal-focus.js`，但指引閘門按 Esc 就能略過（G-46，#423 已修正）。

### b4 接手時要先讀的

1. G-01、G-03、G-28、G-33、G-34 已有裁定，不要重開；G-37～G-51 的待決問題等維護者。
2. b4 除了 `pages/dataset/`，還要做**全站覆蓋複查**：交付包每個視圖都要出現在某份畫面檔，`components/` 的每份都要有使用畫面。
3. 元件檔裡還留著「b4 待補」的佔位行，寫完 b4 的畫面後要換掉。
4. **別批的使用關係要保留**（鐵律 5）。

### b4 的成果

- 元件規格沒有新增（仍 35 份）；17 份追加了 b4 的「用到它的畫面」，[Input](components/input.md) 與 [State Panel](components/state-panel.md) 核對後 b4 沒有用到，寫明原因。
- 畫面規格 **2 份**，涵蓋交付包 b4 的全部 30 個視圖，沒有無法重現的。`#state-seq-match-strict`／`-partial` 照交付包的寫法重現不了，改走實體辨識的品質監控即可，記在 G-52。
- 跨元件約定沒有新增；UXC-07、09、11 加上 b4 的核對。
- 差異新增 **5 筆**（G-52～G-56），共 53 筆：原型與規格差異 22、缺狀態證據 9、待重新設計 22。G-02、G-10、G-11、G-14、G-18、G-22、G-24、G-37、G-41 追加了 b4 的核對結果，過去的裁定不動。

### 全站覆蓋複查

依 [`screen-inventory.md`](screen-inventory.md) 的雙向一致性：

- 交付包 19 個條目、140 個視圖，每一個都出現在某份畫面檔。交付包列為無法重現的兩個（`annotation/annotation-list#state-loading`、`annotation/annotation-workspace#state-task-goal-and-instruction`）照實寫在畫面檔，追蹤在 label-suite/label-suite#187。
- `components/` 35 份每份都有「用到它的畫面」，且至少有一個畫面用到。只用在一頁的有 [Spinner](components/spinner.md)、[Step Indicator](components/step-indicator.md)。
- 元件檔裡「待 b4 補」的佔位行已全部換掉。

### 之後要做的

1. G-01、G-03、G-28、G-33、G-34 已有裁定，不要重開；G-37～G-56 的待決問題等維護者。
2. 交付包要補的（G-31、G-40、G-51、G-52、G-54）與畫面要改的（例如 G-53，已由 #423 修正）都不在本 skill 的範圍：前者重跑 `design-handoff`，後者是畫面修正，要走 Ready gate。
3. prototype 改過之後重跑交付包，再依它點名的批次重驗。

## 變更紀錄

| 版本 | 日期 | 變更 |
| :--- | :--- | :--- |
| 1 | 2026-11-17 | 初版。由 `b1-shared-account` 建立整個 `design/system/`：MASTER、32 份元件、9 份畫面、ux-conventions、screen-inventory、design-gaps。 |
| 2 | 2026-11-18 | `b2-admin-dashboard-task`：新增 Card、Tooltip、Step Indicator 三份元件與六份畫面規格；UXC-03／09／10；G-37～G-45；元件一覽改成分批用量。 |
| 3 | 2026-11-18 | `b3-annotation-review`：兩份畫面規格；UXC-04／05；Tooltip 補審核說明變體；G-46～G-51；元件一覽加 b3 欄。 |
| 4 | 2026-11-18 | `b4-dataset-sweep`：兩份畫面規格；全站覆蓋複查；G-52～G-56；元件一覽加 b4 欄。 |
