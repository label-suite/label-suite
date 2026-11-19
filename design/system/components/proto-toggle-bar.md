# Proto Toggle Bar

> 正典章節：**無**，而且**不該有**——這是原型專用的控制列，不是產品介面。｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

固定在視窗底部置中的深色藥丸列，裡面是幾顆切換鈕，用來叫出**正常走不到的頁面狀態**。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.proto-toggle-bar`（`position: fixed; bottom: 16px; left: 50%`、`rgba(30,27,75,0.92)` 底、`border-radius: 20px`） | 必填 | `pages/account/reset-password.html:358` |
| `.proto-btn` ×3（28px 高、11px 字、`.active`／`.inactive`） | 必填 | `reset-password.html:377`；markup 見 `verify-email.html:365`–`:367` |

按鈕以 `onclick="showState('valid'｜'expired'｜'used')"` 直接呼叫頁面函式（`verify-email.html:365`–`:367`）。

## 變體

兩頁的定義**完全相同**（`reset-password`、`verify-email`）。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| `.active` | 有 | `reset-password.html:388` |
| `.inactive` | 有 | `reset-password.html:389`–`:390` |
| hover | 有（`transition: background .15s, color .15s`，`reset-password.html:385`） | — |
| focus | **未觀察到** | → `../design-gaps.md` G-05 |
| disabled／載入中／錯誤／空 | 不適用 | — |

## token

**只有選中鈕用 token**：`.proto-btn.active` 是 `--color-primary` 底、`--color-on-cta` 字（`reset-password.html:388`），會跟著主題換。其餘——列底色 `rgba(30,27,75,0.92)`、未選中鈕的半透明白底與白字（`:389`–`:390`）、圓角 `20px`／`12px`、高度 `28px`、字級 `11px`——全部寫死，兩種主題相同。#437 盤點 `white` 時刻意不改未選中鈕的半透明白：列底是固定的深靛色，白字在兩種主題都讀得到，換成會隨主題變的 token 反而會在深色主題變暗。

這是刻意的：它是原型的鷹架，不該和產品共用 token，列本身換主題時也不該跟著變（選中鈕是例外）→ **不列入 `design-gaps.md`**，而是記在這裡當作已知且正確的例外。#458 盤點非主色的 `rgba()` 時再確認一次：列底的 `rgba(30,27,75,0.92)` 照這個理由不改。

## 鍵盤與焦點

原生 `<button>`，Tab 可達。沒有 `aria-pressed`，目前選中哪一個只靠 `.active` 的顏色——但因為它不是產品介面，無障礙要求不適用。

## 樣式出處

`design/prototype/pages/account/reset-password.html:358`、`:377`，以及 `verify-email.html` 的同一組。

## 可重現樣本

| 視圖 | 怎麼走到 |
| :--- | :--- |
| `account/reset-password#proto-valid`／`#proto-expired`／`#proto-used` | 開頁後點底部那三顆 |
| `account/verify-email#proto-valid`／`#proto-expired`／`#proto-used` | 同理 |

交付包的 `proto-` 前綴（`design-handoff` 的八個前綴之一）就是為這個元件保留的：那幾個連結狀態**沒有別的叫法**——不是角色、不是網址參數、不是 tab、不是種子資料。

## shadcn 對照

**不適用。**這是原型鷹架，產品裡不會有它，重建時應該整個拿掉（對應的狀態改由真實的 token 驗證結果決定）。

## 用到它的畫面

`account/reset-password`、`account/verify-email`。
