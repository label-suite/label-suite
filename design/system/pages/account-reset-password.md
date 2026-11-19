# `account/reset-password`

> 批次 `b1-shared-account` ｜規格 [`docs/specs/01-account/03-reset-password.mdx`](../../../docs/specs/01-account/03-reset-password.mdx) ｜檔案 `design/prototype/pages/account/reset-password.html`（905 行）｜交付包 commit `b1fd43c`

## 入口

重設密碼信裡的連結。載入 `assets/tokens.css`（#420 起）、`assets/analytics.js`、`pages/shared/sidebar.js`，**無其他共用 CSS**。

這一頁是 b1 視圖最多的帳號頁（6 個），因為 token 的三種結果要靠 [Proto Toggle Bar](../components/proto-toggle-bar.md) 才叫得出來。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#proto-valid` | 開頁後點底部原型切換鈕選「valid」，呼叫 `showState('valid')` | [Auth Navbar](../components/auth-navbar.md)、[Language Toggle](../components/lang-toggle.md)、[Auth Card](../components/auth-card.md)、[Input](../components/input.md)、[Password Eye Toggle](../components/password-eye-toggle.md)（**兩個**：`:534`、`:567`）、[Button](../components/button.md)（`.submit-btn`）、[Proto Toggle Bar](../components/proto-toggle-bar.md) |
| `#proto-expired` | 切到 `showState('expired')` | [State Panel](../components/state-panel.md)（本頁的 class 是 `.token-error-panel`，`:453`）＋ [Proto Toggle Bar](../components/proto-toggle-bar.md) |
| `#proto-used` | 切到 `showState('used')` | **與 expired 顯示同一句**（規格 01-03 Q2：三種原因不分辨） |
| `#state-mismatch` | 在 `#proto-valid` 的表單裡兩個密碼欄填不一致後送出 | 同 `#proto-valid` ＋ `.field-error` |
| `#state-success` | 填一致且合格的新密碼後送出：`#successPanel` 加上 `visible`（`:548`） | [State Panel](../components/state-panel.md)（本頁的 class 是 `.success-panel`，`:548`） |
| `#sim-logged-out` | 加 `?sim_logged_out=1` | 同 `#proto-valid` |

本頁與 `login`／`register`／`forgot-password` 是**唯四**呼叫 `redirectIfLoggedIn()` 的畫面（`sidebar.js:95`）。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.token-error-panel` ＋ `-icon`／`-msg`／`-action`（`:453`，`role="alert"`） | token 失效。正典 [State Panel](../components/state-panel.md) 的 error 樣本畫的就是這個（「Reset link is invalid」，`components-showcase.html:1354`），class 不同 → `../design-gaps.md` G-03 |
| `.success-panel` ＋ 三件套（`:548`，`role="alert" aria-live="polite"`） | `.success-panel` 本身與 `forgot-password`、`verify-email` 三頁全同；`verify-email` 的家族多一個 `-hint` → G-28 |
| `.proto-toggle-bar`／`.proto-btn`（`:358`、`:377`） | 原型鷹架，產品裡不會有 |
| `.loading-status`、`.back-row` | 版面輔助 |

## 業務行為

連回規格 [`01-account/03-reset-password.mdx`](../../../docs/specs/01-account/03-reset-password.mdx)。「expired 與 used 顯示同一句」出自該規格 Q2 的裁定，畫面照做。
