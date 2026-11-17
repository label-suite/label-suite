# Skeleton

> 正典章節：`MASTER.md` §Skeleton ｜行為契約 [UXC-08](../ux-conventions.md#uxc-08-skeleton-尺寸要貼合載入後的內容)｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

兩種互不相干的實作，正典把它們並列為 Variant A 與 Variant B。

| variant | 結構 | 依據 |
| :--- | :--- | :--- |
| A（pulse） | `.skeleton-stack` > `.skeleton-card` > `.skeleton-line` ×n，line 另帶 `.title`／`.body`／`.body.short` | `components-showcase.html:433`–`:451` |
| B（shimmer） | `.skeleton` 加一個尺寸 class：`.skel-avatar`／`.skel-line`／`.skel-input`／`.skel-btn` | `components-showcase.html:454`–`:467` |

## 變體

| variant | 動畫 | 用在哪種版面 |
| :--- | :--- | :--- |
| A pulse | `@keyframes skeleton-pulse`，`opacity` 0.55 ↔ 0.95，`--dur-normal`、`alternate` | 卡片／清單版面 |
| B shimmer | `@keyframes skeleton-shimmer`，背景漸層橫移，**固定 1.5s**（不是 token） | 表單版面 |

B 另有深色模式覆寫（`components-showcase.html:468`–`:470`，同樣是三個寫死值，原值見 `../design-gaps.md` G-02）；**A 沒有**，因為它用 `--color-border` 當底色，token 本身會換。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 載入中 | 這就是它的唯一狀態 | `components-showcase.html:443`、`:457` |
| 預設／hover／focus／disabled／錯誤／空 | 不適用 | — |
| 減少動態 | **分頁面而定**。showcase 有全域的一條；但實際用到 Skeleton 最多的 `account/profile`（49 處）**沒有**任何 `prefers-reduced-motion` | `components-showcase.html:971`–`:973`（`* { animation: none !important }`）；`profile.html` 全檔 0 命中 → `../design-gaps.md` G-30 |

## token

A：`--color-border`、`--color-white`、`--radius-lg`、`--radius-sm`、`--space-md`、`--space-lg`、`--dur-normal`、`--ease-standard`。
B：`--radius-md`、`--radius-full`；**漸層的三個色與 1.5s 都寫死**（`components-showcase.html:455`、`:457`，深色另三個在 `:469`），原值見 `../design-gaps.md` G-02。

尺寸一律字面值（`.skeleton-line.title` 220×20、`.body` 12px、`.skel-avatar` 72×72、`.skel-input` 42px、`.skel-btn` 90×40）——UXC-08 要求尺寸貼合載入後的內容，所以這些值**本來就不該 token 化**，是逐處量出來的。

## 鍵盤與焦點

不可聚焦。樣本把 `aria-live="polite"` 與 `aria-busy="true"` 放在**容器**上（`components-showcase.html:1130` 的 A、`:1138` 的 B），所以載入完成時改 `aria-busy` 就會被朗讀。

## 樣式出處

`design/prototype/components-showcase.html:432`–`:470`。`pages/shared/` 沒有 skeleton 的 CSS 檔。

## 可重現樣本

`components-showcase#state-default` → `#comp-skeleton`（`components-showcase.html:1125`）：左欄 A（一張卡三條線），右欄 B（頭像、單行、輸入框、按鈕）。

## shadcn 對照

候選原語 `Skeleton`。

- **我們有而它沒有**：兩種動畫並存，且各自對應一種版面；`aria-busy` 的使用約定。
- **它有而我們沒有**：單一 class 任意套尺寸的簡潔 API。
- **語意對不上**：shadcn 只有一個 `Skeleton`；我們的 A 是**結構化**的（stack > card > line），B 才是 shadcn 那種「任何方塊加一個 class」。兩者不能互換。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 兩個 variant |
| `account/profile`（`state-default`） | `profile.html` 共 49 處 |

另有 b2 的 `dashboard`（含 `dashboard.components.css`、`dashboard.js`）與 `task-management/task-detail`，以及 `shared/sidebar.js`、`shared/modal.css` 各自提到 skeleton，待 b2 核對是不是同一份 → `../design-gaps.md` G-10。
