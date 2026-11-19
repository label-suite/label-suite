# Auth Card

> 正典章節：**無**。這是帳號頁自己長出來的元件，`MASTER.md` 沒有對應章節，`pages/shared/` 也沒有檔。｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

五個登出狀態的帳號頁共用的置中卡片。

| 部分 | 必填 | 依據（以 `login.html` 為代表） |
| :--- | :--- | :--- |
| `.card`（白底、`--radius-lg`、`--shadow-card`、`padding: 40px 40px 36px`、`max-width: 480px`） | 必填 | `pages/account/login.html:100` |
| `.card-header` | 必填 | 五頁皆有 |
| `.card-logo` | 必填 | 同上 |
| `.card-title` | 必填 | 同上 |
| `.card-subtitle` | 選用 | 同上 |

## 變體

沒有宣告的變體，但**整個規則家族已經有四份互不相同的定義**。雜湊比對的範圍是 `.card` ＋ `.card-header` ＋ `.card-logo` ＋ `.card-title` ＋ `.card-subtitle`：

| 定義 | 出現在 |
| :--- | :--- |
| A | `account/login` |
| B | `account/register` |
| C | `account/forgot-password` |
| D | `account/reset-password`、`account/verify-email` |

分歧**不在 `.card` 本身**：`.card` 只有兩份（`register` 的行動版覆寫少一行 `border-radius`），`.card-header` 與 `.card-title` 五頁全同。推成四份的是 `.card-logo`（{login, register, forgot} vs {reset, verify}）與 `.card-subtitle`（login vs 其餘四頁）。細節見 `../design-gaps.md` G-28。

## 適用狀態

| 狀態 | 有沒有 |
| :--- | :--- |
| 預設 | 有 |
| hover／focus／disabled／載入中／錯誤／空 | 不適用，是容器 |
| 深色 | 有，透過 `--color-white` 在 `tokens.css` 的深色覆寫（見下） |

## token

`--radius-lg`、`--shadow-card`、`--color-border`、`--color-border-control`（欄位外框），以及卡片底色 **`--color-white`**。#420 起五個帳號頁都改載 `tokens.css`，這些 token 不再各自鏡像。

#420 之前，卡片底色是頁面私有的 `--color-card`：五個帳號頁各自在 `:root` 定義，淺色與深色共重複十次，全站 22 處引用（原值見 `../design-gaps.md` G-29）。#420 起各頁改載 `tokens.css` 並刪掉本地鏡像，`--color-card` 換成同值的 `--color-white`，深色覆寫交給 `tokens.css` → `../design-gaps.md` G-03、G-29。

## 鍵盤與焦點

本身不可聚焦，沒有 landmark 角色。

## 樣式出處

五頁各自的 `<style>`，沒有共用檔。代表定義：`design/prototype/pages/account/login.html:98`。

## 可重現樣本

| 視圖 | 怎麼走到 |
| :--- | :--- |
| `account/login#state-default` | 開 `pages/account/login.html` |
| `account/register#state-default`、`account/forgot-password#state-default`、`account/reset-password#proto-valid`、`account/verify-email#proto-valid` | 同理 |

## shadcn 對照

候選原語 `Card`（`CardHeader`、`CardTitle`、`CardDescription`、`CardContent`）——結構幾乎一一對應。

- **我們有而它沒有**：`.card-logo`（品牌標誌插槽）。
- **它有而我們沒有**：`CardFooter`、結構的型別約束。
- **語意對不上**：無；這是最適合直接換成 shadcn `Card` 的一個。

## 用到它的畫面

`account/login`、`account/register`、`account/forgot-password`、`account/reset-password`、`account/verify-email` —— b1 的五個登出帳號頁全部。`account/profile` **不用**（它有側欄，版面是 `.section-card`）。
