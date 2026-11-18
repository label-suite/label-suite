觸發一個動作的按鈕：一個 `<button>`（或 `<a>`）加上 `.btn` 與七種語意 variant 之一，另有載入中與停用兩種狀態 class。

## 何時使用

- 使用者按下去會「做一件事」（送出、儲存、刪除、切換語言、第三方登入）時用按鈕；只是換頁或開外部連結，用連結。
- 一個區塊只放一顆 `.btn-primary`，其餘降為 `.btn-secondary` 或 `.btn-ghost`。
- 破壞性操作的最終確認（刪除、封存）用 `.btn-danger`，通常放在 [Modal](../Modal/README.md) 的 `.modal-actions` 裡，旁邊配一顆 `.btn-secondary` 取消。

## 結構與使用方提供的內容

- 必填：variant class（七選一）。
- 選用：文字（`.btn-icon` 只有圖示，此時必須給 `aria-label`）；前置圖示 `<svg>`／`<img>`（`.btn-oauth`、`.btn-language` 有固定的「圖示＋文字」排版）。
- 選用：狀態 class `.btn-loading`，或 `disabled` 屬性（也可寫 `.btn-disabled`）。
- 按鈕文字由使用方提供，用動詞開頭（「建立任務」「刪除任務」），不要寫「確定」「OK」。

## 變體

| class | 用途 |
| :--- | :--- |
| `.btn-primary`（別名 `.btn-cta`） | 主要行動，`--color-cta` 實心底、`--color-on-cta` 字 |
| `.btn-secondary` | 次要行動，外框；hover 換成 `--color-primary-soft-bg` |
| `.btn-ghost` | 低強度行動（查看全部、取消），hover 加底線 |
| `.btn-danger` | 破壞性確認，**實心**紅底（G-01：維護者裁定 modal.css 的實心版為正典，showcase 的外框版不採用） |
| `.btn-oauth` | 第三方登入入口，品牌圖示＋文字 |
| `.btn-icon` | 純圖示觸發器（設定、更多） |
| `.btn-language` | 語言切換；與帳號頁的 `.lang-toggle` 是同一個元件（G-03），見 [LangToggle](../LangToggle/README.md) |

G-03：帳號頁自寫的 `.login-btn`、`.submit-btn`、`.sso-btn`、`.lang-toggle` 依維護者 2026-11-17 裁定，與上面的正典 variant 視為同一個元件，規格一律用正典名；新畫面不要再沿用那些頁面私有 class。

G-37：維護者 2026-11-18 裁定，頁面私有的 `.mini-btn` 收進正典，成為小尺寸 variant；dashboard 的彩色按鈕（`.btn-emerald` 等）改用既有 variant。

## 狀態

| 狀態 | 表現 |
| :--- | :--- |
| 預設 | 見上表 |
| hover | primary：`opacity .9` 加上移 1px；secondary：soft 底；ghost：底線 |
| focus | **原型沒有**任何 `:focus-visible` 規則，只靠瀏覽器預設（G-05）。實作時補上以 `--color-primary` 為色的焦點環 |
| 停用 | `opacity .4`、`cursor: not-allowed` |
| 載入中 | `.btn-loading`：`opacity .7`，文字可換成「建立中…」或 [Spinner](../Spinner/README.md) |

G-06：原型的 `.btn-loading` 與 `.btn-disabled` 只靠 `pointer-events: none`，沒有 `disabled` 屬性，鍵盤仍可聚焦並以 Enter 觸發。實作時兩者都要同時設 `disabled`（載入中再加 `aria-busy="true"`）。

## 該做／不該做

- **該做**：每個區塊只有一顆 primary；破壞性確認用實心 `.btn-danger`，並和取消鈕等高（`.btn.btn-danger` 已補回內距與透明邊框）。
- **該做**：`.btn-icon` 一定要有 `aria-label`。
- **不該做**：在頁面裡重新定義 `.btn` 系統或自創 `.btn-emerald` 之類的頁面私有按鈕（G-37）；小尺寸用收進正典的 `.mini-btn` variant，其餘回到這七個 variant。
- **不該做**：寫死色值。`.btn-oauth`、`.btn-icon`、`.btn-language` 在原型裡有寫死的顏色（G-02），只有 Google 標誌本身的品牌色是例外。
- **不該做**：只用 class 表示停用或載入中而不設 `disabled`（G-06）。
