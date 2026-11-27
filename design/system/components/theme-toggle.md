# Theme Toggle

> 正典章節：無（`MASTER.md` 原件沒有這一節）｜#720 新增（clarification Q5、Q9）｜交付包 commit `b1fd43c`
>
> 程式實作：`frontend/src/components/theme-toggle.tsx`

## 結構

單一圖示按鈕，內含兩個 Lucide 圖示（`moon`、`sun`），**同一時間只顯示一個**：目前是淺色時顯示月亮，目前是深色時顯示太陽；圖示指的是「點了會切過去的方向」。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `<button type="button">`，`aria-label` 與 `title` 同一句 | 必填 | `pages/shared/sidebar.js:2087`（側欄）、`:2061`（手機品牌列） |
| 月亮圖示 `data-theme-toggle-icon="moon"` | 必填 | `sidebar.js:2088`、`:2062` |
| 太陽圖示 `data-theme-toggle-icon="sun"` | 必填 | `sidebar.js:2089`、`:2063` |

顯示哪一個由 `.is-dark` 決定（`sidebar.css:243`–`:256`）；`.is-dark` 依**實際生效**的外觀設定（`syncSidebarThemeToggle`，`sidebar.js:378`–`:388`），所以「跟隨系統」而作業系統是深色時，顯示的是太陽。

## 變體

| 變體 | 用在 | 依據 |
| :--- | :--- | :--- |
| 工具列 | 桌機側欄底部工具列，與快捷鍵、通知並排、等寬 | `.sidebar-utility-btn`（`sidebar.css:208`–`:228`）、`.sidebar-theme-toggle-btn` |
| 精簡 | 手機上方品牌列 | `.mobile-theme-toggle-btn`（`sidebar.css:378`–`:395`、`:898`） |

兩者行為與文案相同，只差尺寸；實作是同一個元件的兩種尺寸，不建兩份。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設（淺色生效，顯示月亮） | 有 | `sidebar.css:243`–`:246` |
| 深色生效（顯示太陽） | 有 | `sidebar.css:248`–`:256` |
| hover | 有：主色文字與邊框、主色淡底 | `sidebar.css:224`–`:228`、`:391` |
| focus | 有：主色淡化的外環 | `sidebar.css:230`–`:235` |
| disabled／載入中／錯誤／空 | 不適用 | — |

## token

`--color-border`、`--color-white`、`--color-ink-muted`、`--radius-md`；hover 另用 `--color-primary`（文字與邊框）與 `--color-primary-soft-bg`（底）；動態 `--dur-fast`。字面值有三個：高度 `height: 42px`（`sidebar.css:213`）、圖示 `width: 16px`（`sidebar.css:238`）、字級 `font-size: 13px`（`sidebar.css:219`）。13px 對到哪一個 token 見 `../design-gaps.md` G-66。

## 鍵盤與焦點

原生按鈕，Enter／空白鍵觸發。可存取名稱說出**切過去的方向**：「切換為深色模式」／「切換為淺色模式」，英文「Switch to dark mode」／「Switch to light mode」（`sidebar.js:255`–`:256`、`:277`–`:278`），切換語言時跟著換（`updateSidebarThemeToggleLanguage`，`:390`–`:399`）。

點了立即切換、寫入外觀偏好（`label-suite-theme`，`assets/theme.js:3`），換頁與重新整理都維持；它只寫「淺色」或「深色」兩種明確值，「跟隨系統」由個人設定的三選一負責（規格 07-01 §外觀切換）。

## 樣式出處

`design/prototype/pages/shared/sidebar.css:208`–`:256`、`:378`–`:395`；行為 `design/prototype/pages/shared/sidebar.js:346`–`:399`、`:2238`–`:2244`。

## 可重現樣本

| 視圖 | 怎麼走到 |
| :--- | :--- |
| `shared/app-shell#state-theme-dark` | 開 `pages/dashboard/dashboard.html`，點側欄底部的月亮 |
| `shared/app-shell#state-mobile` | 視窗縮到 767px 以下，上方品牌列的精簡版 |

## shadcn 對照

候選原語 `Button`（`variant="outline"`、`size="icon"`）。

- **我們有而它沒有**：依實際生效的外觀只顯示一個方向的圖示與名稱。
- **它有而我們沒有**：無。
- **語意對不上**：shadcn 範例常用下拉選單列出三種外觀；這裡只做淺色與深色的快速切換，三選一屬個人設定頁。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `shared/app-shell` | 桌機側欄底部工具列；手機上方品牌列 |

前端的元件展示頁（`/dev/gallery`）也用同一個元件切換外觀，但它不是產品畫面，不列在這裡。只有一個 feature 的產品畫面用到它，放在 `frontend/src/components/` 是維護者在 #720 的裁定（clarification Q5：照 Issue 字面搬移，展示頁與外殼共用同一個）。
