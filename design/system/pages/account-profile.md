# `account/profile`

> 批次 `b1-shared-account` ｜規格 [`docs/specs/01-account/04-profile.mdx`](../../../docs/specs/01-account/04-profile.mdx) ｜檔案 `design/prototype/pages/account/profile.html`（1912 行）｜交付包 commit `b1fd43c`

## 入口

側欄的使用者區。**這是 b1 唯一的登入狀態畫面**，也是唯一連結共用 CSS 的帳號頁。

載入（`profile.html:12` 起）：`assets/tokens.css`、`pages/shared/sidebar.css`（它再 `@import` `empty-state.css`）、`pages/shared/button.css`、`assets/theme-fouc.js`、`pages/shared/sidebar.js`、`assets/theme.js`、`assets/analytics.js`。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 開 `pages/account/profile.html` | [App Shell](../components/app-shell.md)、[Button](../components/button.md)（`.btn-primary`，`:815`）、[Input](../components/input.md)（`.field-hint`／`.field-error`）、[Toggle Switch](../components/toggle-switch.md)（通知設定，共 36 處）、[Avatar](../components/avatar.md)、[Password Eye Toggle](../components/password-eye-toggle.md)（`:883`）、[Skeleton](../components/skeleton.md)（49 處） |
| `#state-avatar-preview` | 選一張圖或點「移除頭像」：**只改預覽，要按儲存才生效** | [Avatar](../components/avatar.md) ＋ `.avatar-remove-btn`（`:763`） |
| `#state-google-linked` | 點「連結 Google 帳號」：第五個區塊切成已連結狀態 | `.google-account`／`.google-linked-row`／`.google-linked-check`／`.google-no-unlink`／`.google-status` |
| `#toast-saved` | 改個人資料或通知設定後儲存 | [Toast](../components/toast.md)（本頁自己的 `.toast*`，見下） |

## 這一頁專屬的

這一頁定義了 **66 個** 頁面內 class，是 b1 最多的。重點：

| 元件 | 說明 |
| :--- | :--- |
| `.btn-primary`／`.btn-secondary`／`.input`／`.toggle-switch`／`.toggle-slider`／`.skeleton`／`.skel-*`／`.avatar-*`／`.toast*` | **本頁重新定義了這些**，即使它已經 `<link>` 了 `button.css`。同一個 class 名兩份定義，頁面的 `<style>` 在後面所以贏 → `../design-gaps.md` G-33 |
| `.section-card`／`.section-title`／`.section-desc` | 區塊容器。登出頁用 [Auth Card](../components/auth-card.md)，本頁用這一組——兩套卡片 |
| `.notif-pref-table`／`.preference-row`／`.preference-label` | 通知設定表 |
| `.email-masked`／`.email-change-btn`／`.email-row` | Email 遮蔽與變更 |
| `.sent-card`／`.sent-title`／`.sent-desc`／`.sent-icon-wrap`／`.sent-email-highlight`／`.sent-hint`／`.sent-actions`／`.resend-link` | 變更 Email 的「已寄出」面板——**又一份 State Panel 的獨立實作** → G-03 |
| `.appearance-toggle` | 外觀（主題）設定，和側欄的主題鈕是兩個入口 |
| `.avatar-remove-btn`（`:763`） | 移除頭像。**正典的 [Avatar](../components/avatar.md) 沒有這個動作** → G-17 |
| `.info-banner` | 又一份 banner 實作 → G-07 |

`empty-state.css` 經由 `sidebar.css` 的 `@import` 載入，但本頁 `empty-state` 出現 **0 次**——載了沒用 → G-21。

## 業務行為

連回規格 [`01-account/04-profile.mdx`](../../../docs/specs/01-account/04-profile.mdx)。UXC-06（送出中的載入態與重複送出防護）在本頁有三處註解標記（`:350`、`:1540`、`:1583`），是全 prototype 引用 UXC-06 的唯一一頁。
