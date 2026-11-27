# Password Eye Toggle

> 正典章節：**無**。`MASTER.md` §Inputs 沒有密碼欄位這個情境。｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`
>
> 程式實作：`frontend/src/features/auth/password-input.tsx`

## 結構

絕對定位在密碼欄右側 12px 的圖示鈕，切換 `type="password"` ↔ `type="text"`。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.input-wrapper`（`position: relative` 的外框） | 必填 | `pages/account/login.html` 的 `<style>`；`profile.html` 用 `.input-pw-wrap` |
| `.eye-toggle`（`position: absolute; right: 12px`、無邊框、`--color-ink-muted`） | 必填 | `pages/account/login.html:264` |
| 內含眼睛 svg | 必填 | `login.html:464`（`aria-label="顯示密碼"`） |

## 變體

`.eye-toggle` 在三頁的定義**完全相同**（login、register、reset-password）。`reset-password` 與 `register` 各有兩個實例（密碼、確認密碼），id 分別是 `eyeToggle1`／`eyeToggle2`（`register.html:469`、`:505`）與 `eyeToggleNew`／`eyeToggleConfirm`（`reset-password.html:488`、`:521`）。

`account/profile` 另有一個（`profile.html:877`），外框 class 是 `.input-pw-wrap` 而非 `.input-wrapper` → `../design-gaps.md` G-28。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 隱藏（預設） | 有 | `login.html:262` |
| 顯示 | 有，圖示換成劃線的眼睛 | 逐頁的腳本 |
| hover | 有，圖示換 `--color-ink`（四頁都有，含 `profile`） | `login.html:277` |
| focus | 有，`:focus-visible` 加 2px `--color-primary` 外框（login、register、reset-password；`profile` 沒有） | `login.html:278`–`:281` |
| disabled／載入中／錯誤／空 | 不適用 | — |

## token

`--color-ink-muted`；hover 用 `--color-ink`，focus 外框用 `--color-primary`。`right: 12px`、`padding: 2px` 是字面值。

## 鍵盤與焦點

原生 `<button>`，起始帶 `aria-label="顯示密碼"`（`login.html:464`）；確認密碼那一個是「顯示確認密碼」（`register.html:505`、`reset-password.html:521`），兩個欄位分得開。

**標籤會跟著狀態走**：點擊時切換 `input.type` 並改寫 `aria-label`（`login.html:624`–`:630`），切換語言時也會依目前的顯示狀態重算（`:608`，`pwVisible ? t.eyeHide : t.eyeShow`）。這是 b1 少見的、把動態無障礙名稱做對的地方。

沒有用 `aria-pressed`；以切換 `aria-label` 承載狀態是可接受的替代做法，不另列為缺口。

## 樣式出處

`.eye-toggle`：`design/prototype/pages/account/login.html:264`、`register.html`、`reset-password.html`、`profile.html` 各自的 `<style>`。

## 可重現樣本

| 視圖 | 怎麼走到 |
| :--- | :--- |
| `account/login#state-default` | 密碼欄右側的眼睛圖示，點它 |
| `account/register#state-default` | 兩個（密碼、確認密碼） |
| `account/reset-password#proto-valid` | 兩個 |
| `account/profile#state-default` | 一個（變更密碼區） |

## shadcn 對照

沒有對應原語；shadcn 的 `Input` 不處理密碼顯示切換。

- **我們有而它沒有**：整個元件。
- **它有而我們沒有**：無。
- **語意對不上**：不適用。重建時這應該成為 `Input` 的一個 `type="password"` 衍生元件。

## 用到它的畫面

`account/login`、`account/register`（×2）、`account/reset-password`（×2）、`account/profile`（×1）。
