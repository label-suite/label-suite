# `account/verify-email`

> 批次 `b1-shared-account` ｜規格 [`docs/specs/01-account/02-register.mdx`](../../../docs/specs/01-account/02-register.mdx) ｜檔案 `design/prototype/pages/account/verify-email.html`（607 行）｜交付包 commit `b1fd43c`

## 入口

註冊驗證信裡的連結。載入 `assets/tokens.css`（#420 起）、`assets/analytics.js`、`pages/shared/sidebar.js`，**無其他共用 CSS**。

**這一頁沒有表單**，所以也沒有 [Input](../components/input.md)、[Spinner](../components/spinner.md) 或 [Password Eye Toggle](../components/password-eye-toggle.md)——是 b1 唯一一個純結果頁。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#proto-valid` | 原型切換鈕切到 `showState('valid')`（`:367`） | [Auth Navbar](../components/auth-navbar.md)、[Language Toggle](../components/lang-toggle.md)、[Auth Card](../components/auth-card.md)、[State Panel](../components/state-panel.md)（本頁的 class 是 `.success-panel`）、[Proto Toggle Bar](../components/proto-toggle-bar.md) |
| `#proto-expired` | 切到 `showState('expired')`（`:368`） | [State Panel](../components/state-panel.md)（`.token-error-panel`）；**與 `account/reset-password` 同一份文案** |
| `#proto-used` | 切到 `showState('used')`（`:369`） | 與 expired 同一句 |
| `#sim-hold` | 加 `?sim_hold=1` | 擋住驗證成功後的那一次導向，讓成功面板留在畫面上。prototype 的註解寫明這是為了把面板看清楚 |

`sim_hold` 是全 prototype **唯一**的「擋住導向」旗標，只存在於這一頁。

## 這一頁專屬的

| 元件 | 說明 |
| :--- | :--- |
| `.success-panel` ＋ `-icon`／`-msg`／`-back`／**`-hint`** | `.success-panel` 本身與另外兩頁完全相同；本頁多一個 `-hint`，所以**規則家族**不同 → `../design-gaps.md` G-28 |
| `.token-error-panel` ＋ 三件套 | 與 `reset-password` 的那一組同名 |
| `.proto-toggle-bar`／`.proto-btn`（`:367`–`:369`） | 原型鷹架 |

本頁的 Auth Card 與 Auth Navbar **規則家族**和 `reset-password` 同一份（五頁裡這兩頁是一組，差別在 `.card-logo`／`.navbar-logo`）；`.card` 與 `.navbar` 這兩個 class 本身則是五頁共通的。

## 業務行為

連回規格 [`01-account/02-register.mdx`](../../../docs/specs/01-account/02-register.mdx)——驗證信是註冊流程的一環，所以規格頁和 `account/register` 共用。
