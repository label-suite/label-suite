# `index`

> 批次 `b1-shared-account` ｜規格 **無** ｜檔案 `design/prototype/index.html`（11 行）｜交付包 commit `b1fd43c`

## 入口

站台根目錄，整個 prototype 的進入點（`pnpm prototype` 之後開的第一頁）。

## 視圖與元件

| 視圖 | 怎麼走到 | 用到的元件 |
| :--- | :--- | :--- |
| `#state-default` | 直接開 `design/prototype/index.html` | **無** |

全檔 12 行：一個 `<meta http-equiv="refresh" content="0; url=pages/account/login.html">`，加一行給 refresh 失效時用的後備連結。唯一的 `<link>` 是 favicon（`:6`）。沒有 `<style>`、沒有 `<script>`，也沒有引用任何 token。

## 這一頁專屬的

無。

## 業務行為

沒有對應的規格頁，也不需要——它不是產品畫面，是原型的轉接點。「開啟系統即到登入頁」這條規則本身屬於 [`docs/specs/01-account/01-login.mdx`](../../../docs/specs/01-account/01-login.mdx)。

交付包把它列為一個畫面（而不是忽略）的理由：它是站台入口，`docs/prototype/navigation.mdx` 也有它的小節，兩邊要對得上。
