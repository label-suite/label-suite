# Spinner

> 正典章節：**無**。`MASTER.md` 的載入語彙是 [Skeleton](skeleton.md) 與 [Button](button.md) 的 `.btn-loading`；這個旋轉圈是帳號頁自己加的。｜行為契約 [UXC-06](../ux-conventions.md#uxc-06-送出中的載入態與重複送出防護)｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

單一 `<span class="spinner">`：18×18、2.5px 邊框、頂邊換色、`border-radius: 50%`，以 `@keyframes spin` 持續旋轉（0.7s linear infinite）。

依據：`pages/account/login.html:306`。

放在送出鈕內，取代按鈕文字。

## 變體

兩份定義：

| 定義 | 出現在 |
| :--- | :--- |
| A | `account/login`、`account/forgot-password`、`account/reset-password` |
| B | `account/register` |

→ `../design-gaps.md` G-28。`account/verify-email` 沒有 spinner（它沒有表單送出）。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 旋轉中 | 這是它唯一的狀態 | `login.html:306` |
| 減少動態 | **有**。五個登出帳號頁各自都寫了 `@media (prefers-reduced-motion: reduce)`，以 `*, *::before, *::after { animation-duration: 0.01ms !important; }` 蓋掉旋轉 | `login.html:342`–`:344`，另四頁同理（`register.html:329`、`forgot-password.html:310`、`reset-password.html:404`、`verify-email.html:280`） |
| 其他 | 不適用 | — |

## token

**只有 `--color-on-cta` 一個**：#420 起頂邊改用 `--color-on-cta`（`login.html:312`），跟著 CTA 上的文字色走，深色模式下會一起換。其餘三邊原本是寫死的半透明白 `rgba(255,255,255,0.4)`，#437 改成 `color-mix(in srgb, var(--color-on-cta) 40%, transparent)`（`:311`），淺色下算出來是同一個顏色，深色下變成 40% 的深墨色。`account/profile` 的按鈕內 spinner 同樣改成 35% 的 `--color-on-cta`。原值見 `../design-gaps.md` G-02。

尺寸 18px、邊框 2.5px、0.7s 都是字面值。

## 鍵盤與焦點

不可聚焦。`account/login#state-submitting` 的重現步驟寫明：送出後按鈕停用、文字換成帶 `aria-label="載入中"` 的 spinner（`login.html:682`–`:689`），所以有無障礙名稱。

`forgot-password` 與 `reset-password` 另有 `.loading-status` 這個 class，待逐頁確認是不是同一套的 live region。

## 樣式出處

`.spinner`：`design/prototype/pages/account/login.html:308` 及另外三頁各自的 `<style>`。

## 可重現樣本

| 視圖 | 怎麼走到 |
| :--- | :--- |
| `account/login#state-submitting` | 填好帳密送出，按鈕進入送出中 |

`register`、`forgot-password`、`reset-password` 的送出中狀態**沒有被收進交付包的視圖**（它們只有 `state-submitted` 這個完成後的狀態）→ `../design-gaps.md` G-31。

## shadcn 對照

沒有發行的 Spinner 原語；慣例是在 `Button` 裡放 `Loader2` 圖示加 `animate-spin`。

- **我們有而它沒有**：無。
- **它有而我們沒有**：圖示化的實作（可繼承 `currentColor`，不必另外調一份半透明色）。
- **語意對不上**：我們的 spinner 是 CSS 邊框技巧，顏色綁死在「實心 CTA 鈕」這個情境（頂邊跟 `--color-on-cta`，其餘三邊是 40% 的 `--color-on-cta`）；換到其他底色就不能用。

## 用到它的畫面

`account/login#state-submitting`，以及 `register`、`forgot-password`、`reset-password` 的送出中（未收為視圖）。
