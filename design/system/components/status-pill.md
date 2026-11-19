# Status Pill

> 正典章節：`MASTER.md` §Status Pill ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c` ｜未標檔名的行號指 `design/prototype/components-showcase.html`

## 結構

單一行內元素：`.status-badge` 加一個狀態 class。無邊框、柔和底色的藥丸，和 [Badge](badge.md) 是**兩個不同的元件**（Badge 有 1px 邊框、`--radius-sm`；本元件無邊框、`--radius-full`、字重 700）。

## 變體

| class | 語意 | 色 |
| :--- | :--- | :--- |
| `.status-submitted` | 已送出 | `--color-success` ／ `--color-success-soft-bg` |
| `.status-saved` | 已暫存 | `--color-warning` ／ `--color-warning-soft-bg` |
| `.status-pending` | 未處理 | `--color-ink-muted` ／ `--color-border` |

依據：`components-showcase.html:384`–`:386`。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `components-showcase.html:374` |
| hover／focus／disabled／載入中／錯誤／空 | **未觀察到**，非互動元素 | 正典區塊 `.status-badge` `:374`–`:386` 沒有任何偽類 |

## token

`--radius-full`、`--color-success`、`--color-success-soft-bg`、`--color-warning`、`--color-warning-soft-bg`、`--color-ink-muted`、`--color-border`。**全部用 token，零寫死色值**——這是正典區塊裡少數完全乾淨的元件。

## 鍵盤與焦點

不可聚焦。

## 樣式出處

`design/prototype/components-showcase.html:374`–`:386`（註解標為「shipped CSS (verbatim)」）。

## 可重現樣本

`components-showcase#state-default` → `#comp-badges`（`components-showcase.html:1092`），三個 `.status-badge` 樣本在 `:1105`–`:1107`。

## shadcn 對照

候選原語 `Badge` 的 `variant="secondary"`。

- **我們有而它沒有**：`-soft-bg` 這一層（比 `-bg` 更淡）的語意分級。
- **它有而我們沒有**：統一的 variant API。
- **語意對不上**：shadcn 沒有「同一組語意色、兩種強度」的設計；我們同時有 Badge（`-bg` ＋ 邊框）與 Status Pill（`-soft-bg`、無邊框），兩者在正典裡是分開的章節。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 三個樣本 |
| `annotation/annotation-list`（`#state-default`、`#role-reviewer`） | 本頁 `.status-badge`／`.status-submitted`／`-saved`／`-pending`（`annotation-list.html:257`–`:268`），與 showcase 的 `components-showcase.html:384`–`:386` 逐字相同，只換了 class 名 |

b2 核對後**沒有**：`task-detail` 全檔與六個 partial 以 `status-pill` 搜尋都是 0 次，任務狀態用的是本頁的 `.badge`（[Badge](badge.md)）。b3 已補上（見上表）。
