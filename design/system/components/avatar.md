# Avatar

> 正典章節：`MASTER.md` §Avatar ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

兩種模式，結構不同。

| 模式 | 結構 | 依據 |
| :--- | :--- | :--- |
| display-only | 單一 `<img class="avatar-sm">`（32×32，2px primary/20 邊框） | `components-showcase.html:910`、樣本 `:1366` |
| uploadable | `.avatar-wrap`（`role="button"`、`tabindex="0"`、`aria-label`、`aria-describedby`）> `.avatar-preview` ＋ `.avatar-overlay`（`aria-hidden`）＋ 隱藏的 `<input type="file">`；外加 `.avatar-error`（`role="alert"`）與 `.avatar-hint` | `:917`–`:962`、樣本 `:1369`–`:1378` |

`.avatar-preview` 的預設內容是**姓名首字**（樣本是「陳」，`:1371`）；選了檔案後換成 `<img>`。

## 變體

| class | 尺寸 | 用在哪 |
| :--- | :--- | :--- |
| `.avatar-sm` | 32×32 | navbar |
| `.avatar-preview` | showcase demo 80×80；**出貨的 `account/profile` 是 72×72** | profile |

showcase 的說明寫「profile 64/80px」（`:1364`），它自己的 CSS 是 80px（`:920`、`:927`，註解標 `md:w-20 — desktop demo size`），而實際出貨的 `profile.html:149` 是 **72px**——說明、正典、出貨三個數字都不一樣 → `../design-gaps.md` G-17。

好消息是出貨那一頁內部是一致的：`.skel-avatar` 也是 72×72（`profile.html:560`），符合 [UXC-08](../ux-conventions.md#uxc-08-skeleton-尺寸要貼合載入後的內容)。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設（首字） | 有 | `components-showcase.html:925`、`:1369` |
| 已上傳 | 有，`<img>` 蓋滿、`object-fit: cover` | `:940`、腳本 `:1625`–`:1630` |
| hover | 有，遮罩 `opacity: 0 → 1`（唯一一條標為 verbatim 的正典 CSS，`:956`–`:957`） | `:957` |
| focus | **有**。`.avatar-wrap:focus-visible` 畫 2px primary outline，`outline-offset: 2px` | `:923`–`:926` — 這是 b1 唯一一個有焦點樣式的元件 |
| 錯誤 | 有。`.avatar-error.visible`，文字由腳本填 | `:959`–`:960`、腳本 `:1622`–`:1623` |
| disabled／載入中／空 | 未觀察到 | — |

## token

`--radius-full`、`--color-primary`、`--color-on-cta`、`--color-error`、`--color-ink-muted`、`--dur-normal`。首字疊在主色上，#438 起用 `--color-on-cta`（`:931`），之前的 `--color-white` 在深色主題是卡片底色，首字會變成深色字疊在亮靛藍上。

寫死的有：遮罩是 50% 不透明的黑（`:945`），遮罩上的相機圖示是 `#fff`（`:946`，#438 起；理由同 `account/profile.html:178`，遮罩在兩種主題都是黑，白色兩邊都對），以及 80px／32px／24px 等尺寸。邊框原本也寫死 20% 不透明的 primary 色，#438 起改 `color-mix(in srgb, var(--color-primary) 20%, transparent)`（`:911`），淺色同值、深色跟著深色主色 → `../design-gaps.md` G-02。

## 鍵盤與焦點

完整：`.avatar-wrap` 是 `role="button"` ＋ `tabindex="0"`，腳本綁 `click`（`:1597`）與 `keydown` 攔 Enter／Space（`:1598`–`:1603`），都轉成 `avatarInput.click()`。焦點指示有（見上）。錯誤列是 `role="alert"` 且 wrap 以 `aria-describedby` 指過去（`:1370`、`:1377`），所以違規訊息會被朗讀。

**上傳契約**（腳本 `:1594`–`:1613`）：只收 `image/jpeg`、`image/png`、`image/webp`，上限 `5 * 1024 * 1024` bytes。違規時填 `.avatar-error` 並停住。預覽用 `URL.createObjectURL` 並在 `load` 後 `revokeObjectURL`（`:1616`），**不用 `innerHTML`**——註解把這點寫成契約的一部分（`:1587`–`:1588`）。

## 樣式出處

`design/prototype/components-showcase.html:907`–`:960`（CSS）、`:1583`–`:1619`（行為）。

## 可重現樣本

`components-showcase#state-default` → `#comp-avatar`（`components-showcase.html:1361`）。**可實際選檔**：選一張超過 5 MB 或非 JPG／PNG／WebP 的檔，錯誤列會出現；選合格的檔，首字換成縮圖。

## shadcn 對照

候選原語 `Avatar`（`AvatarImage`、`AvatarFallback`）。

- **我們有而它沒有**：整套上傳契約（檔型、大小、錯誤呈現、hover 遮罩、鍵盤觸發）。
- **它有而我們沒有**：載入失敗自動退回 fallback、`AvatarFallback` 的延遲顯示。
- **語意對不上**：shadcn 的 Avatar 是**唯讀**顯示元件；我們的 uploadable 模式其實是一個檔案上傳控制項，只是長得像頭像。拆成兩個元件比較接近實況。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 兩種模式，uploadable 可實操 |
| `account/profile`（`state-default`、`state-avatar-preview`） | `profile.html` 的頭像區，含「移除頭像」（`profile.html:753`）——**正典沒有這個動作** → `../design-gaps.md` G-17 |

`shared/sidebar.js` 另以 `#userAvatar` 呈現使用者頭像（見 [app-shell](app-shell.md)），待確認是不是 display-only 模式的同一個。
