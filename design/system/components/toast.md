# Toast

> 正典章節：`MASTER.md` §Toast ｜行為契約 [UXC-07](../ux-conventions.md#uxc-07-toast-單一實例與分級存續時間)｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `#toast` 固定容器（**整頁唯一**，id 不是 class） | 必填 | CSS `components-showcase.html:398`；容器在 `:1376`，帶 `aria-live="polite" aria-atomic="true"` |
| `.toast-card` ＋ 一個語意 class | 必填，由腳本建立 | `components-showcase.html:1516`–`:1517` |
| `.toast-msg` 訊息 | 必填 | `components-showcase.html:1518`–`:1520` |
| `.toast-close` 關閉鈕（`aria-label="關閉通知"`、字形 `✕`） | 必填，**四種 variant 都會建** | `components-showcase.html:1521`–`:1526` |

`#toast` 的內容每次以 `replaceChildren()` 整個換掉（`:1529`），這就是「單一實例」的實作方式——不是佇列，是覆蓋。

## 變體

| variant | 色系 | 自動消失 |
| :--- | :--- | ---: |
| `.success` | `--color-success` 系列 | 3000ms |
| `.info` | `--color-info` 系列 | 5000ms |
| `.warning` | `--color-warning` 系列 | 8000ms |
| `.error` | `--color-error` 系列 | **0 ＝ 不自動消失，只能手動關** |

色：`components-showcase.html:424`–`:427`。秒數：`components-showcase.html:1500`（`TOAST_DURATIONS`）；`:1532` 的 `if (duration)` 讓 `0` 落到「不設計時器」。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 隱藏（預設） | 有。`opacity: 0; visibility: hidden`，且 `visibility` 的 transition 延遲到淡出結束 | `components-showcase.html:405`–`:407` |
| 顯示 | 有。`.visible` | `components-showcase.html:409` |
| hover | **未觀察到**。滑鼠移上去**不會**暫停計時器 | `:1532` 只有 `setTimeout`，沒有 `mouseenter` → `../design-gaps.md` G-09 |
| focus | 關閉鈕可聚焦；但 toast 出現時**焦點不會移過去** | `:1514`–`:1533` 沒有任何 `focus()` |
| 載入中／空 | 不適用 | — |

## token

`--z-toast`、`--dur-fast`、`--radius-md`、`--shadow-md`（註解標為「approved flat-design exception」，`:422`）、四組 `--color-<語意>` ／ `-bg` ／ `-border`。寬度 `min(384px, calc(100vw - 32px))` 是字面值。

## 鍵盤與焦點

- 關閉鈕在 Tab 順序裡，Enter／Space 可關。
- 容器本身是 live region：`#toast` 帶 `aria-live="polite" aria-atomic="true"`（`:1376`），而內容是整塊 `replaceChildren()` 換掉的（`:1529`），所以 `aria-atomic` 會讓整則訊息被重讀一次。
- Escape 不會關閉。
- 焦點不會被移進 toast，也不會被困住。
- **error 這一種有疑慮**：它不自動消失、又不搶焦點，鍵盤使用者要一路 Tab 到頁尾才碰得到關閉鈕（`#toast` 在 `:1376`，是 `<body>` 的最後一個元素）→ `../design-gaps.md` G-08。

## 樣式出處

`design/prototype/components-showcase.html:397`–`:430`（CSS）、`:1499`–`:1539`（行為）。

## 可重現樣本

`components-showcase#state-default` → `#comp-toast`（`components-showcase.html:1114`）。四顆按鈕各觸發一種 variant 的**真實行為**（`:1535`–`:1539`），不是靜態樣本：按 Error 那顆之後 toast 會一直留著，要自己按 ✕。

## shadcn 對照

候選原語 `Toast`／`Toaster`（或 `sonner`）。

- **我們有而它沒有**：四種 variant 各自不同的存續時間，而且 error 是 0＝常駐。
- **它有而我們沒有**：佇列與堆疊（我們是覆蓋）、swipe 關閉、`ToastAction`、hover 暫停。
- **語意對不上**：shadcn 的 toast 是多實例列表；我們的 `#toast` 是**單一 id 容器**，第二則通知會直接蓋掉第一則，使用端無法同時顯示兩則。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 四個 variant 的真實行為 |
| `account/profile#toast-saved` | 儲存個人資料或通知設定後顯示 |
| `admin/role-settings#toast-saved`、`admin/user-management#toast-action` | 本頁的 `.toast*`（上方置中），`TOAST_DURATIONS` 依類型（`role-settings.html:1504`、`user-management.html:1579`），符合 UXC-07 |
| `task-management/task-list`（`#param-unauthorized`、`#sim-delete-error`） | 本頁的 `.toast*`；`showToast`（`task-list.html:599`–`:606`）一律 3000 ms → `../design-gaps.md` G-39 |
| `task-management/task-new`（交付包未列） | `showToast`（`task-new.html:858`–`:865`）一律 3500 ms → G-39 |
| `task-management/task-detail`（交付包未列） | `showToast`（`task-detail.html:11255`）一律 2400 ms → G-39 |

`profile.html` 用的是它自己 `<style>` 裡的 toast，不是載入正典——全 prototype 沒有 `shared/toast.css`。另有 8 個頁面各自有 `id="toast"`（b2 五個、b3 一個、b4 兩個），b2 的五個已核對（見上表），b3、b4 的三個待那兩批核對 → `../design-gaps.md` G-10。
