# Label Suite — Design System MASTER

> 批次 `b1-shared-account` 建立 ｜交付包 commit `b1fd43c`、prototype tree `4cb347d5e720`、specs tree `a4b0e889a5a3`

## 這份檔是重建的，不是原件

`design/prototype/` 裡有 **25 處**註解引用 `design/system/MASTER.md`，但在本批次之前這個檔**並不存在於本 repo**。那些引用指向的是原始 repo（`singyichen/label-suite`）的同名檔。

本檔是依 [`design-system-setup`](../../.claude/skills/design-system-setup/SKILL.md) 的四種依據，**從 prototype 的實際程式碼反推重建**的。因此：

- **章節名沿用**那些註解指名的名字（§Buttons、§Inputs、§Empty State、§Desktop Content Tabs、§Metric KPI Tile…），這樣既有註解才不會變成懸空引用。
- **版本號與行號引用無法重現**：`tokens.css:3`（「updated 2026-04-18」）、`:31` 與 `:180`（「MASTER.md v1.7.1」）、`:69`（「MASTER.md Changelog」）、`annotation-workspace.config.js:3944`（「MASTER.md:1423-1482」）、`:3947`（「MASTER.md:1482」）指的都是原件的版本與行數。本檔從第 1 版重新起算，**那五處引用在本 repo 解析不到**，記在 [`design-gaps.md`](design-gaps.md) G-25。
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

32 份。「正典」欄指 `MASTER.md` 的章節名是否由 prototype 註解指名；「b1 用量」來自 [`screen-inventory.md`](screen-inventory.md)。

### 正典區塊定義的（20）

來源是 `design/prototype/components-showcase.html:139`–`:973` 的「MASTER.md canonical component CSS」。

| 元件 | 正典章節 | b1 用量 | 狀態 |
| :--- | :--- | ---: | :--- |
| [Button](components/button.md) | §Buttons | 6 | ✅ b1 完成 |
| [Input](components/input.md) | §Inputs | 6 | ✅ b1 完成 |
| [Toggle Switch](components/toggle-switch.md) | §Toggle Switch | 2 | ✅ b1 完成 |
| [Badge](components/badge.md) | §Semantic State Colors ＋ §Status Badges | 1 | ✅ b1 完成 |
| [Status Pill](components/status-pill.md) | §Status Pill | 1 | ✅ b1 完成 |
| [Alert Banner](components/alert-banner.md) | §Error / Alert Banner | 3 | ✅ b1 完成 |
| [Toast](components/toast.md) | §Toast | 2 | ✅ b1 完成 |
| [Skeleton](components/skeleton.md) | §Skeleton | 2 | ✅ b1 完成 |
| [Chip](components/chip.md) | §Chip | 1 | ✅ b1 完成 |
| [Pagination](components/pagination.md) | §Pagination | 1 | ✅ b1 完成 |
| [Breadcrumb](components/breadcrumb.md) | §Breadcrumb | 1 | ✅ b1 完成 |
| [Review Status Track](components/review-status-track.md) | §Review Status Track | 1 | ✅ b1 完成 |
| [Color Dot](components/color-dot.md) | §Color Dot | 1 | ✅ b1 完成 |
| [Divider](components/divider.md) | §Divider | 2 | ✅ b1 完成 |
| [Accordion](components/accordion.md) | §Accordion | 1 | ✅ b1 完成 |
| [Progress Bar](components/progress-bar.md) | §Progress Bar | 1 | ✅ b1 完成 |
| [Metric KPI Tile](components/metric.md) | §Metric KPI Tile | 1 | ✅ b1 完成 |
| [State Panel](components/state-panel.md) | §State Panel | 4 | ✅ b1 完成 |
| [Avatar](components/avatar.md) | §Avatar | 2 | ✅ b1 完成 |
| [Date Range Picker](components/date-range-picker.md) | 無（`shared/` 自己是來源） | 1 | ✅ b1 完成 |

### 共用 CSS 定義、但沒有進正典區塊的（5）

這五個在 `components-showcase.html` 上**看不到**，也沒有 b1 的使用畫面 → [`design-gaps.md`](design-gaps.md) G-21。

| 元件 | 來源 | b1 用量 | 狀態 |
| :--- | :--- | ---: | :--- |
| [Empty State](components/empty-state.md) | `shared/empty-state.css`（經 `sidebar.css` 的 `@import` 散佈） | 0 | ⚠️ 規格已寫，無樣本 |
| [Desktop Content Tabs](components/content-tabs.md) | `shared/content-tabs.css` | 0 | ⚠️ 同上 |
| [Modal](components/modal.md) | `shared/modal.css` ＋ `shared/modal-focus.js` | 0 | ⚠️ 同上 |
| [List Toolbar](components/list-toolbar.md) | `shared/list-page.css:1`–`:47` | 0 | ⚠️ 同上 |
| [Data Table](components/data-table.md) | `shared/list-page.css:49`–`:72` | 0 | ⚠️ 同上 |

### 外殼與帳號頁自己長出來的（7）

正典沒有章節，但它們真實存在而且有使用畫面。

| 元件 | 來源 | b1 用量 | 狀態 |
| :--- | :--- | ---: | :--- |
| [App Shell（Sidebar）](components/app-shell.md) | `shared/sidebar.css` ＋ `sidebar.js` | 2 | ✅ b1 完成（token 清單待 b2，G-24） |
| [Auth Card](components/auth-card.md) | 五個帳號頁各自的 `<style>` | 5 | ✅ b1 完成（已分裂成四份，G-28） |
| [Auth Navbar](components/auth-navbar.md) | 同上 | 5 | ✅ b1 完成（已分裂成兩份，G-28） |
| [Language Toggle](components/lang-toggle.md) | 同上；正典對應 `.btn-language` | 5 | ✅ b1 完成（五頁唯一沒分裂的） |
| [Spinner](components/spinner.md) | 四個帳號頁各自的 `<style>` | 1 | ✅ b1 完成 |
| [Password Eye Toggle](components/password-eye-toggle.md) | 四個帳號頁各自的 `<style>` | 4 | ✅ b1 完成 |
| [Proto Toggle Bar](components/proto-toggle-bar.md) | `reset-password`、`verify-email` | 2 | ✅ b1 完成（**原型鷹架，不是產品元件**） |

### 本批次只「引用」、不重寫的

prototype 的註解另外指名了四個章節，但它們的證據全在別批，依鐵律 1 不在這裡寫：

| 章節 | 引用處 | 待 |
| :--- | :--- | :--- |
| §Cards | `pages/dashboard/dashboard.layout.css:171` | b2 |
| §Tooltip | `pages/task-management/task-config.css:259`、`pages/annotation/annotation-workspace.config.js:3943` | b2／b3 |
| §Step Indicator | `assets/tokens.css:21` | b2 |
| §Changelog | `assets/tokens.css:69` | 原件的版本紀錄，本檔從第 1 版起算 |

## 批次狀態

| 批次 | 範圍 | 條目 | 視圖 | 狀態 |
| :--- | :--- | ---: | ---: | :--- |
| `b0-inventory` | 全站點名 | 19 | 140 | ✅ 已完成（[PR #401](https://github.com/label-suite/label-suite/pull/401)，第二次重跑） |
| **`b1-shared-account`** | `pages/shared/`、`pages/account/`、`index.html`、`components-showcase.html` | **9** | **43** | ✅ **本批次** |
| `b2-admin-dashboard-task` | `pages/admin/`、`pages/dashboard/`、`pages/task-management/` | 6 | 45 | ⬜ 未開始 |
| `b3-annotation-review` | `pages/annotation/` | 2 | 22 | ⬜ 未開始 |
| `b4-dataset-sweep` | `pages/dataset/`，以及全站覆蓋複查 | 2 | 30 | ⬜ 未開始 |

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

## 變更紀錄

| 版本 | 日期 | 變更 |
| :--- | :--- | :--- |
| 1 | 2026-11-17 | 初版。由 `b1-shared-account` 建立整個 `design/system/`：MASTER、32 份元件、9 份畫面、ux-conventions、screen-inventory、design-gaps。 |
