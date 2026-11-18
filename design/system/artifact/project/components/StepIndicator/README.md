Step Indicator 是多步驟表單頂端的一排編號圓點與連接線，顯示已完成、目前與未到的步驟。

## 何時使用

- 建立流程拆成固定幾步、要依序完成時使用。目前只有新增任務一處：基本資料、標記設定檔、啟動設定、標記說明，共四步。
- 步驟之間可自由跳轉、沒有先後的，改用 Content Tabs。

## 結構與使用方提供的內容

- `.step-indicator[aria-label]`：橫排容器。
- 每一步是 `.step-item`，裡面有：
  - `.step-circle`：編號圓點；
  - `.step-label`：步驟名稱。
- 步驟之間放 `.step-connector`：2px 連接線，預設 `--color-border`。
- 使用方提供步驟名稱與目前步驟，並在切換時更新每個圓點、標籤和連接線的 class。
- token：`--color-primary`（目前步驟）、`--color-cta`（已完成）、`--color-on-cta`（圓點內文字）、`--color-border`、`--color-text-soft`。

## 變體

只有一種，固定四步。

## 狀態

- 未到：灰框圓點、柔和文字。
- 目前 `.active`：主色圓點與主色標籤。`--color-on-cta` 疊在 `--color-primary` 上的對比低於 AA，`tokens.css` 註明這是已裁定接受的取捨（G-25）。
- 已完成 `.done`：CTA 綠圓點與綠標籤。前面的連接線也加 `.done`，變成 `--color-cta`。
- 第四步可重現，但交付包沒有給它 ID（G-40）。
- 不可聚焦，沒有 hover、focus 或 disabled。

## 該做／不該做

- 該做：在目前步驟加 `aria-current="step"`。原件每一步都是 `<div>`，螢幕閱讀器讀不出目前在第幾步（G-44）。
- 該做：完成一步時，圓點、標籤和左側連接線一起改成 `.done`。
- 不該做：讓圓點可點來跳步；步驟順序由表單控制。
- 不該做：步驟超過一行寬；四步以上要重新評估流程。
