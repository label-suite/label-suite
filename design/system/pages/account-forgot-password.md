# `account/forgot-password`

> 批次 `b1-shared-account` ｜規格 [`docs/specs/01-account/03-reset-password.mdx`](../../../docs/specs/01-account/03-reset-password.mdx) ｜檔案 `design/prototype/pages/account/forgot-password.html`（633 行）｜交付包 commit `b1fd43c`

## 入口

登入頁的「忘記密碼」連結。載入 `assets/tokens.css`（#420 起）、`assets/analytics.js`、`pages/shared/sidebar.js`，**無其他共用 CSS**。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/account/forgot-password.html` | [Auth Navbar](../components/auth-navbar.md)、[Language Toggle](../components/lang-toggle.md)、[Auth Card](../components/auth-card.md)、[Input](../components/input.md)（`.field-error`）、[Button](../components/button.md)（`.submit-btn`） |
| `#state-submitted` | 送出任一 Email（**不論存不存在**）：停在本頁顯示同一句通用提示 | [State Panel](../components/state-panel.md)（本頁的 class 是 `.success-panel`，`:399`）、`.back-row` |
| `#sim-logged-in` | 加 `?sim_logged_in=1` | **無**（`redirectIfLoggedIn()` 直接導走） |
| `#sim-logged-out` | 加 `?sim_logged_out=1` | 同 `#state-default` |

「不論存不存在都顯示同一句」是業務規則，見規格；這裡只記畫面上確實只有一種結果。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.success-panel` ＋ `-icon`／`-msg`／`-back`（`forgot-password.html:399`–`:408`） | 送出成功後**取代表單**。正典的 [State Panel](../components/state-panel.md) 的 success 樣本畫的就是這一頁（「Check your email」，`components-showcase.html:1347`），但 class 完全不同 → `../design-gaps.md` G-03 |
| `.loading-status` | 送出中的狀態列，`reset-password` 也有，待確認是不是 live region |
| `.spinner` | 與 `login`、`reset-password` 同一份定義 |
| `.submit-btn` | 與 `reset-password` 同一份定義，但和 `register` 的不同 → G-28 |
| `.form-section`、`.back-row` | 版面輔助 |

## 業務行為

連回規格 [`01-account/03-reset-password.mdx`](../../../docs/specs/01-account/03-reset-password.mdx)（與 `account/reset-password` 共用同一份）。
