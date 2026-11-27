# Brand Mark

> 正典章節：無（`MASTER.md` 原件只寫「Lucide `tag` glyph in white on a … rounded square」，見 [`brand.md`](../brand.md) §CIS）｜#720 新增（clarification Q9）｜交付包 commit `b1fd43c`
>
> 程式實作：`frontend/src/components/brand-mark.tsx`

## 結構

一個圓角方塊，主色填底，中間是白色的標籤線稿；永遠 `aria-hidden="true"`，可存取名稱由外層的品牌連結提供（「Label Suite 首頁」）。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| 方塊（`.navbar-logo`／`.card-logo`） | 必填 | 帳號頁 `login.html:47`、`:117`；外殼 `pages/shared/sidebar.css:52`–`:61` |
| 標籤線稿（24 單位畫布、線寬 2） | 必填 | `login.html:356`–`:363`；`pages/shared/sidebar.js:2045`–`:2050` |
| wordmark「Label Suite」 | **不屬於本元件**：由使用它的品牌連結自己排在旁邊 | `sidebar.js:2051`、`login.html:364` |

prototype 的線稿是內嵌 SVG；實作用 Lucide `tag`（[`brand.md`](../brand.md) §圖示：唯一圖示來源是 Lucide，logo 的形狀本來就取自它），不另畫 SVG。

## 變體

只有尺寸不同，形狀與配色一樣。

| 尺寸 | 用在 | 依據 |
| :--- | :--- | :--- |
| 帳號頁頁首 | [Auth Navbar](auth-navbar.md) 的品牌區 | `login.html:47`（32px）、`:336`（窄螢幕 28px） |
| 帳號頁卡片 | [Auth Card](auth-card.md) 的 `.card-logo` | `login.html:117`；窄螢幕 `:340`（52px）；`.card-logo` 已分裂成兩份 → `../design-gaps.md` G-28 |
| 側欄品牌區 | [App Shell](app-shell.md) 的品牌區，桌機在側欄最上、手機在上方品牌列 | `.navbar-logo`（`sidebar.css:52`，36px） |

尺寸由呼叫端以 class 傳入，元件本身不定尺寸。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | 上表各處 |
| hover／focus | 不適用：本身不可互動，焦點與 hover 屬外層品牌連結 | — |
| disabled／載入中／錯誤／空 | 不適用 | — |

## token

底色 `--color-primary`，線稿 `--color-on-cta`（`sidebar.js:2046` 的 `style="color: var(--color-on-cta)"`），圓角 `--radius-md`（外殼）；帳號頁的圓角是字面值 8px，比例同 [`brand.md`](../brand.md) §CIS 的 25%。

深色主題下白色線稿對 `--color-primary` 只有 2.98:1，[`brand.md`](../brand.md) §深色主題的 logo（量測）已登記，不是新發現。

## 鍵盤與焦點

不可聚焦、不朗讀。外層品牌連結負責焦點與名稱。

## 樣式出處

帳號頁各自的 `<style>`（代表定義 `design/prototype/pages/account/login.html:47`、`:117`）。外殼的 `.navbar-logo` 在 `design/prototype/pages/shared/sidebar.css:52`–`:66`。兩處**沒有共用任何程式碼**。

## 可重現樣本

| 視圖 | 怎麼走到 |
| :--- | :--- |
| `account/login#state-default` 等五個帳號頁 | 左上角頁首與卡片頂端 |
| `shared/app-shell` 的任一視圖 | 開 `pages/dashboard/dashboard.html`，側欄最上方；`#state-sidebar-collapsed` 時只剩它 |

## shadcn 對照

沒有對應的原語；它是一個帶 Lucide 圖示的裝飾性方塊。

- **我們有而它沒有**：品牌的尺寸比例與配色規則（[`brand.md`](../brand.md) §CIS）。
- **它有而我們沒有**：無。
- **語意對不上**：無。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `account/forgot-password`、`account/login`、`account/register`、`account/reset-password`、`account/verify-email` | 頁首品牌區與卡片頂端 |
| `shared/app-shell` | 側欄品牌區；收合時仍顯示 |
