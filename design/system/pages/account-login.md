# `account/login`

> 批次 `b1-shared-account` ｜規格 [`docs/specs/01-account/01-login.mdx`](../../../docs/specs/01-account/01-login.mdx) ｜檔案 `design/prototype/pages/account/login.html`（773 行）｜交付包 commit `b1fd43c`

## 入口

`design/prototype/index.html` 的 `meta refresh` 直接導到這裡；登出後也回到這裡。

載入：`assets/tokens.css`（#420 起，`login.html:12`）、`assets/analytics.js`、`pages/shared/sidebar.js`。**不載入其他共用 CSS**——版面全在自己的 `<style>` 裡。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/account/login.html` | [Auth Navbar](../components/auth-navbar.md)、[Language Toggle](../components/lang-toggle.md)、[Auth Card](../components/auth-card.md)、[Password Eye Toggle](../components/password-eye-toggle.md)、[Button](../components/button.md)（`.sso-btn`／`.login-btn`，見下）、[Divider](../components/divider.md)（`.divider`，見下） |
| `#state-field-error` | 帳號或密碼留空／格式不符後送出 | 同上 ＋ [Input](../components/input.md) 的 `.field-error`，表單層級錯誤用 [Alert Banner](../components/alert-banner.md)（本頁的 class 是 `.error-banner`） |
| `#state-submitting` | 送出登入 | 同上 ＋ [Spinner](../components/spinner.md)（`login.html:703`） |
| `#sim-logged-in` | 加 `?sim_logged_in=1` | **無**。本頁只載 `sidebar.js` 用它的 `redirectIfLoggedIn()`（`pages/shared/sidebar.js:95`）直接導向 `/dashboard/dashboard`，不渲染任何外殼 |
| `#sim-logged-out` | 加 `?sim_logged_out=1` | 同 `#state-default`；這個旗標存在的理由是登入成功後 `login.html` 會寫下 `labelsuite.loggedIn`，之後四個帳號頁都會被導走，而它們沒有側欄可以登出（`sidebar.js:92`） |

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.sso-btn`（`login.html:162`） | Google 登入鈕。正典的對應品是 `.btn-oauth`（`components-showcase.html:229`），**兩者沒有共用程式碼** → `../design-gaps.md` G-03 |
| `.login-btn`（`login.html:284`） | 送出鈕。正典的對應品是 `.btn-primary`；本頁版本把 `font-family: 'Inter', sans-serif` 寫死；文字色 #420 起改用 `--color-on-cta` → G-03 |
| `.divider`（`login.html:185`、`:414`） | OAuth 與帳號登入之間的「或」。正典的 `.divider-text` 用兩個 `<hr>`，本頁用 `::before`／`::after` → G-18 |
| `.error-banner` | 表單層級錯誤。對應正典的 [Alert Banner](../components/alert-banner.md)，class 不同 → G-03 |
| `.forgot-link`、`.register-row`、`.field-label-row` | 版面輔助，無正典對應 |

## 業務行為

一律連回規格 [`01-account/01-login.mdx`](../../../docs/specs/01-account/01-login.mdx)，這裡不重述規則。`?sim_logged_in=1` 的導向行為在規格 01-01 Q3。
