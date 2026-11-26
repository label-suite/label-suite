# `account/register`

> 批次 `b1-shared-account` ｜規格 [`docs/specs/01-account/02-register.mdx`](../../../docs/specs/01-account/02-register.mdx) ｜檔案 `design/prototype/pages/account/register.html`（896 行）｜交付包 commit `b1fd43c`

## 入口

登入頁的「註冊」連結。載入 `assets/tokens.css`（#420 起）、`assets/analytics.js`、`pages/shared/sidebar.js`，**無其他共用 CSS**。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/account/register.html` | [Auth Navbar](../components/auth-navbar.md)、[Language Toggle](../components/lang-toggle.md)、[Auth Card](../components/auth-card.md)、[Input](../components/input.md)（`.field-hint`）、[Password Eye Toggle](../components/password-eye-toggle.md)（**兩個**：`register.html:466` 密碼、`:501` 確認密碼）、[Button](../components/button.md)（`.submit-btn`） |
| `#state-field-error` | 欄位留空或格式不符後送出 | 同上 ＋ `.field-error` |
| `#state-submitted` | 填妥四個欄位送出 | 同上 ＋ [Alert Banner](../components/alert-banner.md)（本頁的 class 是 `.banner--success`）；四個欄位停用，**帳號還沒有建立** |
| `#sim-logged-in` | 加 `?sim_logged_in=1` | **無**（`redirectIfLoggedIn()` 直接導走） |
| `#sim-logged-out` | 加 `?sim_logged_out=1` | 同 `#state-default` |

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.banner`／`.banner--error`／`.banner--success`（`register.html` 的 `<style>`） | 表單層級訊息。**這是全 b1 唯一有 success／error 兩個語意的 banner**；正典的 [Alert Banner](../components/alert-banner.md) 只有 error → `../design-gaps.md` G-07 |
| `.submit-btn` | 送出鈕，和 `forgot-password`／`reset-password` 的同名 class **定義不同**（本頁自成一份）→ G-28 |
| `.spinner` | 送出中，和另外三頁的定義**不同** → G-28 |
| `.login-row` | 版面輔助 |

本頁沒有 `.input-wrapper`／`.input-icon` 以外的輸入裝飾，`.field`／`.field-hint`／`.field-error` 三件套與 login 一致。

## 業務行為

連回規格 [`01-account/02-register.mdx`](../../../docs/specs/01-account/02-register.mdx)。`account/verify-email` 的規格也指向同一頁。
