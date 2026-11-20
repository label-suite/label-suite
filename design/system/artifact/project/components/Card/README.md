Card 是登入後頁面的基本內容容器：細框線、大圓角、白底，沒有陰影，裡面放一個區塊的標題與內容。

## 何時使用

- 把頁面切成幾個獨立區塊時使用，例如儀表板的「開始你的第一個工作流程」、任務詳情的各個區塊、新增任務的表單段落。
- 登出狀態帳號頁的置中卡片不是它，那是 Auth Card。
- 需要浮起來的覆蓋層（Modal、下拉）也不是它；卡片沒有陰影。

## 結構與使用方提供的內容

- `.panel`：`1px solid var(--color-border)`、`--radius-lg`、`--color-white` 底、`--space-lg` 內距。
- `.panel-header`：選用。標題與右側動作分置兩端。
- `.panel-title`：選用，1.05rem、600。用什麼標籤（`h2`、`h3`）由頁面決定。
- `.panel-subtitle`：選用，`--color-ink-muted`、0.875rem。
- 使用方提供標題、副標、右側動作和內容。
- token：`--color-border`、`--radius-lg`、`--color-white`、`--space-lg`、`--space-md`、`--color-ink`、`--color-ink-muted`，沒有寫死的值。

## 變體

- `dashboard` 的 `.panel`：直向 flex，子元素間距 `--space-md`。
- `task-detail` 的 `.panel`：只有容器四條規則。
- `task-new` 的 `.form-card`：多一個 `margin-bottom` 和帶分隔線的 `.form-card-title`。bundle 沒有收這個變體。

同樣四條容器規則在原件曾寫了五、六份，class 名也不一致：`.panel`、`.form-card`、`.section-card`、`.content-card`，以及 `dataset-analysis-detail` 自己的 `.panel`。正典是 `.panel`（G-41）；#423 起原件收成 `pages/shared/card.css` 一份，其餘 class 名是別名。

## 狀態

- 預設：有。
- hover／focus：沒有，卡片本身不可互動。
- 載入中：卡片內放 Skeleton，不另做卡片載入態。
- 空：卡片內放 Empty State。
- 錯誤：頁面自理，例如 `dashboard` 換成同樣容器規則的錯誤區塊。
- 深色：跟著 `--color-white` 與 `--color-border` 的深色值變。

## 該做／不該做

- 該做：新頁面一律用 `.panel`，不要再寫一份同樣四條規則的卡片（G-41）。
- 該做：標題用正確的標題層級，讓卡片在大綱裡有名字。
- 不該做：加陰影或 hover 浮起效果；卡片不是可點元件。
- 不該做：卡片套卡片。需要分段時，用卡片內的標題與分隔線。
