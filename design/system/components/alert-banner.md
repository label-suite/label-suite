# Alert Banner

> 正典章節：`MASTER.md` §Error / Alert Banner ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.alert-banner` 容器（`display: flex`、`align-items: flex-start`） | 必填 | `components-showcase.html:384` |
| 前置 `<svg>` 圖示（`flex-shrink: 0`、`margin-top: 2px` 對齊首行） | 選用 | `components-showcase.html:395` |
| 訊息文字 | 必填 | `components-showcase.html:1107` |

## 變體

**只有錯誤一種。**正典區塊把邊框、底色、文字色直接寫在 `.alert-banner` 上（`--color-error-border`／`--color-error-bg`／`--color-error`），沒有 success／info／warning 的修飾子——雖然章節名叫「Error / Alert Banner」。四色齊備的是 [Toast](toast.md)。

依據：`components-showcase.html:384`–`:394`。

全 prototype 只有**一個**修飾子，而且不在正典裡：`pages/admin/user-management.html:200` 自己寫了 `.alert-banner.warning`。也就是說出貨頁面確實需要第二種語意，但它是就地補的，正典不知道有這回事 → `../design-gaps.md` G-07。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設（錯誤） | 有 | `components-showcase.html:384` |
| hover／focus／disabled／載入中 | 不適用，非互動元素 | — |
| 可關閉 | **未觀察到**。沒有關閉鈕，和 Toast 不同 | 正典區塊沒有 `.alert-banner-close` |
| 空 | 不適用 | — |

## token

`--color-error`、`--color-error-bg`、`--color-error-border`、`--radius-md`。零寫死色值。

## 鍵盤與焦點

不可聚焦。正典樣本帶 `role="alert"`（`components-showcase.html:1107`），和同一份 showcase 的 `.field-error`（`:1053`）一致，所以兩者都會被螢幕閱讀器自動朗讀。這個角色寫在**樣本的 markup** 上，不在 CSS 裡，所以是使用約定而不是元件本身保證的。

## 樣式出處

`design/prototype/components-showcase.html:383`–`:395`。

## 可重現樣本

`components-showcase#state-default` → `#comp-banner`（`components-showcase.html:1103`），樣本在 `:1107`。

## shadcn 對照

候選原語 `Alert`（`AlertTitle` ＋ `AlertDescription`）。

- **我們有而它沒有**：無。
- **它有而我們沒有**：`variant="destructive"` 以外的預設樣式、標題／內文的結構分層、`role="alert"`。
- **語意對不上**：我們的 banner 只有一行訊息，沒有標題層；章節名承諾了 Alert 的廣度，實作只有 Error 一種。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 唯一樣本 |

shipped 使用頁面只有 b2 的 `admin/user-management`，待 b2 補。
