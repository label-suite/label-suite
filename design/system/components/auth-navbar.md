# Auth Navbar

> 正典章節：**無**。｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

登出狀態的頂部列，高 64px、`position: sticky`。

| 部分 | 必填 | 依據（`login.html`） |
| :--- | :--- | :--- |
| `.navbar`（64px、`--color-white` 底、下框線、左右 32px、兩端對齊） | 必填 | `pages/account/login.html:29` |
| `.navbar-brand` ＞ `.navbar-logo` ＋ `.navbar-wordmark` | 必填 | 五頁皆有 |
| 右側 [Language Toggle](lang-toggle.md) | 必填 | 五頁皆有 |

和 [App Shell](app-shell.md) 是**互斥**的兩套外殼：登出用這個，登入用側欄。`account/profile` 是唯一同時是帳號頁又有側欄的畫面，它用的是 App Shell。

## 變體

規則家族（`.navbar` ＋ `-brand` ＋ `-logo` ＋ `-wordmark`）有兩份：

| 定義 | 出現在 |
| :--- | :--- |
| A | `account/login`、`account/register`、`account/forgot-password` |
| B | `account/reset-password`、`account/verify-email` |

**`.navbar` 本身五頁完全相同**（`login.html:29`、`register.html:29`、`forgot-password.html:29`、`reset-password.html:29`、`verify-email.html:34`），`-brand` 與 `-wordmark` 也是。分歧只來自 `.navbar-logo` 一個。→ `../design-gaps.md` G-28

## 適用狀態

| 狀態 | 有沒有 |
| :--- | :--- |
| 預設 | 有 |
| sticky（捲動時固定） | 有 |
| hover／focus／disabled／載入中／錯誤／空 | 不適用，是容器 |

## token

`--color-white`（#420 之前是頁面私有的 `--color-card`，見 [Auth Card](auth-card.md)）、`--color-border`。高度 64px 與內距 32px 是字面值。

## 鍵盤與焦點

**沒有 `role="banner"` 或 `<header>` 語意**（class 是 `.navbar`，元素待逐頁確認），裡面只有品牌與語言鈕兩個可聚焦目標。

## 樣式出處

五頁各自的 `<style>`。代表定義：`design/prototype/pages/account/login.html:29`。

## 可重現樣本

同 [Auth Card](auth-card.md) 的五個視圖。

## shadcn 對照

沒有對應原語（shadcn 不發行 navbar）。

- **我們有而它沒有**：整個元件。
- **它有而我們沒有**：無。
- **語意對不上**：不適用。

## 用到它的畫面

五個登出帳號頁。`account/profile` 不用。
