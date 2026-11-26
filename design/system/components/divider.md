# Divider

> 正典章節：`MASTER.md` §Divider ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c` ｜未標檔名的行號指 `design/prototype/components-showcase.html`

## 結構

三種形態，共用一條 `.divider-hr`。

| 形態 | 結構 | 依據 |
| :--- | :--- | :--- |
| 水平線 | 單一 `<hr class="divider-hr">` | `components-showcase.html:838`、樣本 `:1274` |
| 文字分隔 | `.divider-text` > `.divider-hr` ＋ `<span>` ＋ `.divider-hr` | `:845`–`:847`、樣本 `:1278`–`:1282` |
| 清單分隔 | `.divider-list` > `<li>`，相鄰項之間加上邊框 | `:848`–`:850`、樣本 `:1283`–`:1287` |

## 變體

見上三種。文字分隔的用途被正典限定成「**僅登入頁 OAuth 與帳號登入之間**」（`:1270`）。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `components-showcase.html:837` |
| hover／focus／disabled／載入中／錯誤／空 | 不適用，非互動元素 | `.divider-hr` 等規則 `:836`–`:850` 無偽類 |

## token

`--color-border`、`--color-border-muted`、`--color-ink-muted`。

`.divider-list` 的分隔線原本是寫死值，#420 起改用 `--color-border-muted`（`:849`）；`.divider-hr` 用 `--color-border`（`:840`），兩條線都取自 token，只是深淺差一階。原值見 `../design-gaps.md` G-02。
`margin: 24px 0`、`py-4` 的 `16px`、`gap: 12px` 都是字面值。

正典原文只有 Tailwind 樣本，沒有 CSS 區塊；showcase 的註解說明它是依 Banner／Toast 的先例對映成 token 的（`:836`–`:838`）。

## 鍵盤與焦點

不可聚焦。`<hr>` 在多數螢幕閱讀器裡是 `separator` 角色；`.divider-list` 的分隔是 `<li>` 的邊框，沒有額外語意。

## 樣式出處

`design/prototype/components-showcase.html:834`–`:848`。

## 可重現樣本

`components-showcase#state-default` → `#comp-divider`（`components-showcase.html:1268`）：三種形態依序排列。

## shadcn 對照

候選原語 `Separator`。

- **我們有而它沒有**：文字分隔（中間夾字）與清單分隔兩種形態。
- **它有而我們沒有**：垂直方向、`decorative` 屬性（決定要不要發 `role="separator"`）。
- **語意對不上**：shadcn 的 `Separator` 是單一線條；我們的 `.divider-text` 其實是一個版面元件（flex 三欄），只是被收進同一章節。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 三種形態 |
| `dataset/dataset-analysis-detail`（`#state-stats-single-dim`、`#state-stats-multi-dim`） | **不是正典的 `.divider-hr`**：本頁 `hr.panel-divider`（`dataset-analysis-detail.html:55`），用在 `stats-single_dim.html:27`、`stats-multi_dim.html:61` → `../design-gaps.md` G-18 |

**全 prototype 只有 showcase 用得到 `.divider-hr`。** b4 的 `.panel-divider` 是另一份做法（見上表）。

正典把文字分隔的用途指名給登入頁，而 `account/login#state-default` 確實有那一條（`login.html:414`，文字是「或」／「or」，隨語言切換，`:518`／`:541`／`:583`）——但它用的是**完全不同的做法**：class 叫 `.divider`，線是 `::before` 與 `::after` 兩個偽元素（`login.html:185`、`:193`），不是正典的 `.divider-text` ＋ 兩個 `<hr>`。

也就是說這個元件的唯一指名用途，在實作上沒有採用正典 → `../design-gaps.md` G-18。
