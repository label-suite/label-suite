# State Panel

> 正典章節：`MASTER.md` §State Panel ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

表單層級的狀態容器：送出成功或 token 驗證失敗後**取代**表單區塊，不是疊在它上面（`components-showcase.html:1330`）。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.state-panel` ＋ `--success`／`--error`（`<section>`） | 必填 | `components-showcase.html:844`、樣本 `:1333`、`:1341` |
| `.state-panel-icon`（40×40 圓形，內含 20×20 svg） | 必填 | `:860`–`:869`、樣本 `:1336` |
| `.state-panel-title` | 必填 | `:878`、樣本 `:1339` |
| `.state-panel-desc` | 必填 | `:884`、樣本 `:1340` |
| `.state-panel-action`（連結，hover 加底線） | 選用 | `:890`–`:898`、樣本 `:1341` |

和鄰近兩個元件的分工，正典寫得很明確（`:1332`）：表單還在、訊息內嵌 → [Alert Banner](alert-banner.md)；浮動自動消失 → [Toast](toast.md)；表單被取代 → 本元件。

## 變體

| class | 用途 | role |
| :--- | :--- | :--- |
| `.state-panel--success` | 送出成功（例：驗證信已寄出） | 無 |
| `.state-panel--error` | token 失效 | 樣本帶 `role="alert"`（`:1343`） |

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| success | 有 | `components-showcase.html:850` |
| error | 有 | `:856` |
| hover | 只有 `.state-panel-action` 有（加底線） | `:898` |
| focus | **未觀察到**（action 是 `<a>`，靠瀏覽器預設） | 以 `:focus` 掃 `:843`–`:898`，0 命中 → `../design-gaps.md` G-05 |
| warning／info | **未觀察到**。只有成功與錯誤兩種 | — |
| 載入中／空 | 不適用 | — |

## token

`--radius-md`、`--radius-full`、`--color-success`／`-bg`／`-border`、`--color-error`／`-bg`／`-border`、`--color-primary`、`--color-primary-strong`。

圖示底色與標題色是**四個**寫死值，註解都標為「MASTER §State Panel literal」（`:871`、`:875`、`:882`、`:883`），原值見 `../design-gaps.md` G-02。

整個章節在正典裡只有 Tailwind 樣本，showcase 的註解說明它是依 Divider 的先例對映成 token 的（`:843`–`:845`）。

## 鍵盤與焦點

本身不可聚焦；`.state-panel-action` 是原生 `<a>`。error 變體帶 `role="alert"`，所以取代表單時會被朗讀。

## 樣式出處

`design/prototype/components-showcase.html:841`–`:896`。

## 可重現樣本

`components-showcase#state-default` → `#comp-statepanel`（`components-showcase.html:1328`）：兩個樣本就是帳號頁的兩個狀態——「Check your email」（`:1337`）與「Reset link is invalid」（`:1345`）。

## shadcn 對照

候選原語：`Card` ＋ `Alert` 的組合，沒有單一對應。

- **我們有而它沒有**：「取代表單」這個語意位置，以及和 Alert／Toast 的三方分工規則。
- **它有而我們沒有**：`CardHeader`／`CardContent` 的結構分層。
- **語意對不上**：shadcn 的 `Alert` 是內嵌訊息，對應的是我們的 Alert Banner；State Panel 在 shadcn 裡沒有對應，通常是頁面自己組。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | success 與 error 各一 |

**正典的兩個樣本畫的就是帳號頁，但帳號頁沒有用這組 class。**`account/forgot-password#state-submitted` 用 `.success-panel`（`forgot-password.html:399`），`account/reset-password#state-success` 用同名的 `.success-panel`（`reset-password.html:548`），`proto-expired`／`proto-used` 用 `.token-error-panel`（`reset-password.html:453`）。三者都在各自頁面的 `<style>` 裡另外定義 → `../design-gaps.md` G-03。

b2 核對後**沒有**：`task-detail` 那 3 個 panel 用的是 `empty-state-panel`（[Empty State](empty-state.md)），不是這個元件；`task-detail` 的 `taskForbidden`／`taskNotFound` 與 `dashboard` 的 `.dashboard-error-state` 也是各自的實作。b3 核對後**也沒有**：`annotation-list` 的 `#taskNotFound`／`#noActionableNotice` 是 `empty-state-panel`（`annotation-list.html:466`、`:470`）。b4 核對後**也沒有**：`dataset-analysis-detail` 及其四個 partial 的狀態面板全是 `empty-state-panel`（`dataset-analysis-detail.html:279`、`:298`），讀取與計算失敗是 `.panel.panel-load-error`（`:1508`）。
