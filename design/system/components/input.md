# Input

> 正典章節：`MASTER.md` §Inputs ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`
>
> 程式實作：`frontend/src/components/ui/input.tsx`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.input`（單行）或 `.input-textarea`（多行） | 必填 | `design/prototype/pages/shared/input.css:3` |
| `.field-hint` 說明文字 | 選用，放欄位下方 | `components-showcase.html:322`（CSS）、`:1057`（樣本） |
| `.field-error` 錯誤訊息 | 選用，`role="alert"` | `components-showcase.html:329`（CSS）、`:1061`（樣本） |

`.input` 本身**不含 label**；樣本用 `aria-label` 代替（`components-showcase.html:1056`）。

## 變體

| variant | 用途 | 定義處 |
| :--- | :--- | :--- |
| `.input` | 單行欄位 | `input.css:3` |
| `.input-textarea` | 多行欄位，`resize: vertical`、`min-height: 100px` | `input.css:24` |
| `.input.error` | 驗證失敗 | **只有** `components-showcase.html:308`；`input.css` 沒有這條 |
| `.input[readonly]`／`.input.readonly` | 系統管理、不可編輯（例：SSO email） | **只有** `components-showcase.html:313`；全 prototype 沒有任何頁面在用 |

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 預設 | 有 | `input.css:3` |
| hover | **未觀察到** | `input.css` 與正典區塊都沒有 `.input:hover` |
| focus | 有。邊框換 `--color-primary`，外加 3px 的 focus ring | `input.css:19`（`color-mix(in srgb, var(--color-primary) 12%, transparent)`）／`components-showcase.html:305`（#438 起同為 `color-mix`）→ `../design-gaps.md` G-04 |
| disabled | **未觀察到**。沒有 `.input:disabled` 規則 | 以 `:disabled` 掃 `input.css` 與正典區塊，0 命中 |
| 載入中 | 不適用 | — |
| 錯誤 | 有（只在正典區塊） | `components-showcase.html:308` |
| 空 | 由 `placeholder` 承擔，沒有專屬狀態 | `components-showcase.html:1056` |

## token

`--color-border-control`、`--color-primary`、`--color-surface`、`--color-ink`、`--radius-md`。

正典區塊原本另寫死 6 個色值，#420 起改用 `--color-border-control`、`--color-error`、`--color-slate-50`、`--color-border-muted`、`--color-ink-muted`（`components-showcase.html:292`–`:334`）；原值見 `../design-gaps.md` G-02。focus ring 的 `rgba()` 不在 #420 範圍，#438 改成和 `input.css` 相同的 `color-mix`。#438 另補上正典 `.input` 原本沒有的底色與文字色（`--color-white`、`--color-ink`，`components-showcase.html:296`–`:297`）：之前深色主題下是瀏覽器預設的白底黑字。
`font-size: 16px` 是字面值，不是 `--text-*` 的任何一個（`input.css:13`）。

## 鍵盤與焦點

原生 `<input>`／`<textarea>` 行為。focus ring 是 `box-shadow` 而非 `outline`，且明寫 `outline: none`（`input.css:20`）——高對比模式下 ring 會消失 → `../design-gaps.md` G-05。

## 樣式出處

`design/prototype/pages/shared/input.css:1`–`:27`（基礎與 focus）、`design/prototype/components-showcase.html:292`–`:334`（正典區塊，含 error／readonly／field-hint／field-error）。

**兩份不一致**：底色不同（`input.css` 是 `--color-surface`，正典是 `--color-white`），且正典多出四條規則。focus ring 原本也不同（正典寫死 `rgba()`），#438 起兩份都是 `color-mix`。見 `../design-gaps.md` G-04。

## 可重現樣本

`components-showcase#state-default` → `#comp-inputs`（`components-showcase.html:1051`）：default（可點出 focus ring）／error／readonly 三種，搭配 field-hint 與 field-error。

## shadcn 對照

候選原語 `Input`、`Textarea`，搭配 `Label` 與 `Form` 的 `FormDescription`／`FormMessage`。

- **我們有而它沒有**：`.input.readonly` 的語意（系統管理欄位，與 `disabled` 不同）。
- **它有而我們沒有**：`disabled` 樣式、`Label` 的關聯、`aria-describedby` 串到 hint／error 的接線。
- **語意對不上**：我們的 `.field-error` 只是一段文字，不像 `FormMessage` 會自動掛上 `aria-invalid`。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 三個 variant 的樣本 |
| `account/register`（`state-default`、`state-field-error`） | `.field-hint`、`.field-error` |
| `account/login`（`state-field-error`） | `.field-error` |
| `account/forgot-password`（`state-default`） | `.field-error` |
| `account/reset-password`（`proto-valid`、`state-mismatch`） | `.field-error` |
| `account/profile`（`state-default`） | `.field-hint`、`.field-error` |
| `admin/user-management`（`#state-default`、`#modal-invite`） | 本頁的 `.form-input`（`user-management.html:153`），不是正典 `.input` |
| `task-management/task-new`（`#state-step1`、`#state-step3`） | **本頁的 `.input-text`**（`task-new.html:64`），不是正典 → `../design-gaps.md` G-04 |
| `annotation/annotation-workspace`（`#role-annotator`） | 「無法判定」理由用正典 `.input`（`annotation-workspace.config.js:649`–`:681`），送出才驗證、輸入就清錯 → UXC-04、UXC-05 |
| `annotation/annotation-workspace`（`#role-reviewer`） | 審核理由用正典 `.input-textarea` |
| `annotation/annotation-workspace#state-exception-pool` | **inline 樣式的理由輸入框**（`annotation-workspace.config.js:5044`–`:5052`），不是 `.input` → G-04 |

帳號頁用的是各自 `<style>` 裡的 `.field-hint`／`.field-error`，不是載入 `input.css`（那五頁一個 `<link>` 都沒有）→ `../design-gaps.md` G-03。
b4 兩頁都沒有用到：`dataset-analysis-list` 的搜尋框與篩選是 [List Toolbar](list-toolbar.md) 的 `.search-input`／`.filter-select`，`dataset-analysis-detail` 沒有輸入框。
