Auth Navbar 是登出狀態帳號頁的頂部列：左邊品牌，右邊語言切換，高 64px、捲動時固定在頂端。

## 何時使用

- 只用在登出狀態的五個帳號頁：登入、註冊、忘記密碼、重設密碼、驗證信箱。
- 和 App Shell 互斥：登出用這個，登入後用側欄。`account/profile` 雖然是帳號頁，但已登入，所以用 App Shell。
- 頁面外層要包 `.auth-page`。bundle 把 `.navbar`、`.lang-toggle` 等規則限定在 `.auth-page` 底下，因為同名 class 也被 App Shell 用掉了。

## 結構與使用方提供的內容

- `header.navbar[role=banner]`：高 64px、`--color-card` 底、下框線、左右 32px 內距、兩端對齊、`position: sticky`。
- `a.navbar-brand`（帶 `aria-label="Label Suite 首頁"`）裡放：
  - `.navbar-logo`：主色方塊加標籤圖示，線稿 `currentColor` 取 `--color-on-cta`（淺色白、深色深墨），`aria-hidden`；
  - `.navbar-wordmark`：「Label Suite」。
- `button.lang-toggle`：地球圖示加目前語言代碼（`ZH`／`EN`）。
- 使用方只提供首頁連結和目前語言，其他內容固定。
- token：`--color-card`（頁面私有，見 Auth Card 的 G-29）、`--color-border`。高度 64px 與內距 32px 是字面值。

## 變體

沒有宣告的變體。五頁的 `.navbar`、`.navbar-brand`、`.navbar-wordmark` 完全相同，分歧只在 `.navbar-logo`：login、register、forgot-password 一份，reset-password、verify-email 另一份（G-28）。bundle 收的是 login 那一份。

## 狀態

- 預設：有。
- sticky：捲動時固定在頂端。preview 為了放進卡片，把 `position` 改成 `static`。
- hover／focus／disabled／載入中／錯誤／空：不適用，它是容器。裡面可聚焦的只有品牌連結和語言鈕。
- 深色：跟著 `--color-card` 的深色值變。

## 該做／不該做

- 該做：用 `<header role="banner">` 包住，讓頁面有 banner landmark。原件的元素各頁不一，要逐頁確認。
- 該做：五頁共用同一份 `.navbar-logo`，等 G-28 裁定哪一份是正典。
- 不該做：在登出頁塞入側欄、通知鈴或使用者區。那些只屬於 App Shell。
- 不該做：脫離 `.auth-page` 使用這組 class，否則會拿到 App Shell 的 240px 直式側欄樣式。
