Auth Card 是登出狀態帳號頁正中央的卡片，上面是品牌標誌、標題與副標，下面是該頁的表單。

## 何時使用

- 只用在五個登出狀態的帳號頁：登入、註冊、忘記密碼、重設密碼、驗證信箱。
- 頁面外層要包 `.auth-page`。bundle 把 `.card`、`.divider`、`.form`、`label` 等規則都限定在 `.auth-page` 底下，避免和登入後頁面的同名 class 衝突。
- 登入後頁面的內容區塊用 Card（`.panel`），不用它。

## 結構與使用方提供的內容

- `.card[role=region][aria-label]`：
  - `--color-card` 底、`--radius-lg`、`--shadow-card`；
  - `padding: 40px 40px 36px`、`max-width: 480px`。
- `.card-header`：置中直排，裡面有：
  - `.card-logo`：56px 主色方塊加白色標籤圖示；
  - `.card-title`：Crimson Pro 22px；
  - `.card-subtitle`：選用。
- 表單內容由各頁提供。以登入頁為例：
  - Google 登入用正典的 `.btn-oauth`（G-03）；
  - 文字分隔 `.divider` 加「或」；
  - `form.form` 裡是 `.field`，每個 `.field` 有 `label`、`.input-wrapper`（`.input-icon` 加 input，密碼欄另加 `.eye-toggle`）、`.field-error`；
  - 送出用正典的 `.btn-primary`（G-03），不是原件的 `.login-btn`。
- token：`--radius-lg`、`--shadow-card`、`--color-border`、`--color-card`。
  - `--color-card` 不在 `tokens.css`，是五頁各自定義的頁面私有 token，重複了十次（G-29）。
  - bundle 暫時在 `:root` 補了別名。

## 變體

沒有宣告的變體，但規則家族已經有四份互不相同的定義。`.card`、`.card-header` 與 `.card-title` 五頁幾乎一樣。分歧來自兩處：

- `.card-logo`：login、register、forgot-password 一份，reset-password、verify-email 另一份；
- `.card-subtitle`：login 一份，其餘四頁另一份。

詳見 G-28。

## 狀態

- 預設：有。
- 深色：透過 `--color-card` 的深色值。
- 卡片本身沒有 hover、focus 或 disabled；表單欄位的錯誤狀態見 preview 的密碼欄：`input.error` 加 `.field-error.visible`。

## 該做／不該做

- 該做：表單按鈕用正典的 `.btn-primary` 與 `.btn-oauth`，不要沿用 `.login-btn`、`.sso-btn`（G-03）。
- 該做：卡片加 `role="region"` 與 `aria-label`，標題用 `h1`。
- 該做：五頁收斂成同一份 `.card-logo` 與 `.card-subtitle`（G-28），並把 `--color-card` 收進 `tokens.css`（G-29）。
- 不該做：脫離 `.auth-page` 使用 `.card`。
- 注意：`.btn-oauth` 寫死白底與 slate 色（showcase 正典），深色模式下仍是白色按鈕。
