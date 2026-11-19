# Step Indicator

> 正典章節：原件 `MASTER.md` §Step Indicator（只見於 `assets/tokens.css:21` 的註解，本 repo 無原文）｜批次 `b2-admin-dashboard-task` ｜交付包 commit `eb9a884` ｜**單頁專屬**

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.step-indicator` 容器（橫向 flex），帶 `aria-label` | 必填 | `task-new.html:41`、markup `:242` |
| `.step-item`：`.step-circle`（32px 圓，數字）＋ `.step-label` | 必填 | `:40`–`:46`、`:230`–`:233` |
| `.step-connector`（2px 連接線） | 必填 | `:47`–`:48` |

畫面上是**四步**：基本資料、標記設定檔、啟動設定、標記說明（`:229`–`:248`）。

## 變體

只有一種。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 未到 | 有：`--color-border` 框、`--color-white` 底、`--color-ink-muted` 字 | `:41` |
| 目前（`.active`） | 有：`--color-primary` 底、`--color-on-cta` 字 | `:42`、`:45` |
| 完成（`.done`） | 有：`--color-cta` 底，連接線也變 `--color-cta` | `:43`、`:46`、`:48` |
| hover／focus／disabled | 未觀察到（步驟不可點） | — |

淺色下 `--color-on-cta` 疊在 `--color-primary` 上的對比約 4.47:1，低於 AA，`tokens.css:21` 註明是「已裁定接受的取捨」，裁定記錄在原件 → `../design-gaps.md` G-25。深色下兩者都換成深色值，對比約 5.36:1，達 AA。

## token

`--color-border`、`--color-white`、`--color-ink-muted`、`--color-primary`、`--color-primary-strong`、`--color-cta`、`--color-on-cta`、`--space-lg`、`--dur-fast`。

## 鍵盤與焦點

不可聚焦。目前步驟已於 #422 加上 `aria-current="step"`，完成的步驟有只給螢幕閱讀器讀的「已完成」文字 → `../design-gaps.md` G-44。

## 樣式出處

`design/prototype/pages/task-management/task-new.html:41`–`:50`（頁內 `<style>`）。

## 可重現樣本

`task-management/task-new#state-step1`、`#state-step2`、`#state-step3`（第四步可重現但交付包沒有 ID，見 G-40）。

## shadcn 對照

shadcn 沒有對應原語（常見做法是自建，或用 `Progress` 之外的社群元件）。

- **我們有而它沒有**：整個元件。
- **它有而我們沒有**：不適用。
- **語意對不上**：不適用。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `task-management/task-new`（`#state-step1`～`#state-step3`） | 新增任務的四步精靈 |
