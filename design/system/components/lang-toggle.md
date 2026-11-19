# Language Toggle

> 正典章節：`MASTER.md` §Buttons 的 `.btn-language`（維護者 2026-11-17 裁定：與本元件視為同一個，規格用正典名）｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

單一 `<button class="lang-toggle">`，內含地球圖示與目前語言代碼。

依據：`pages/account/login.html:66`（CSS）、`:363`（markup，帶 `data-testid="lang-toggle"` 與 `aria-label="切換語言"`）。

## 變體

只有一種，切換 zh-TW ↔ EN。

**這是帳號頁唯一沒有分裂的元件**：五頁的 `.lang-toggle` 規則集雜湊完全相同。其餘（`.card` 四份、`.navbar` 兩份、`.spinner` 兩份、`.submit-btn` 兩份、`.success-panel` 兩份）都已分歧 → `../design-gaps.md` G-28。

登入後的版本是另一套：側欄的 `#langToggle`（`pages/shared/sidebar.js:2046`）與行動版 `#mobileLangToggle`（`:2050`），見 [App Shell](app-shell.md)。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `login.html:66` |
| hover | 待逐頁確認 | — |
| focus | **未觀察到** | → `../design-gaps.md` G-05 |
| disabled／載入中／錯誤／空 | 不適用 | — |

## token

`--color-border`、`--radius-md`、`--color-white`（#420 之前是頁面私有的 `--color-card`）、`--color-ink`；hover 另用 `--color-primary`（邊框）與 `--color-primary-soft-bg`（底，`login.html:84`–`:87`）。內距 `6px 12px` 與 `gap: 6px` 是字面值。

## 鍵盤與焦點

原生 `<button>`，帶 `aria-label="切換語言"`（`login.html:363`）。沒有焦點樣式。

切換後**不只換這顆鈕**：整頁文案由各頁自己的字串表換掉（例：`login.html:515`／`:538` 的 `dividerText`），所以它實際上是一個頁面層級的控制項。

## 樣式出處

五頁各自的 `<style>`，內容相同。代表定義：`design/prototype/pages/account/login.html:66`。
正典的對應品 `.btn-language` 在 `design/prototype/components-showcase.html:270`——**兩者沒有共用任何程式碼**。

## 可重現樣本

| 視圖 | 怎麼走到 |
| :--- | :--- |
| `components-showcase#state-default` | `#comp-buttons` 的 `.btn-language`（`components-showcase.html:1038`），**正典版** |
| `account/login#state-default` 等五個 | 右上角，**實際版**；點了會真的換語言 |

## shadcn 對照

候選原語 `Button`（`variant="outline"`、`size="sm"`）或 `DropdownMenu`（多於兩種語言時）。

- **我們有而它沒有**：無。
- **它有而我們沒有**：focus ring。
- **語意對不上**：兩種語言用切換鈕合理；再多就該換成下拉，而目前的 markup 沒有為此留餘地。

## 用到它的畫面

五個登出帳號頁（實際版）、`components-showcase`（正典版）。`account/profile` **沒有語言鈕**——它靠側欄的那一個。
