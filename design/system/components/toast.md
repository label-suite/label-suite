# Toast

> 正典章節：`MASTER.md` §Toast ｜行為契約 [UXC-07](../ux-conventions.md#uxc-07-toast-單一實例與分級存續時間)｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`

## 結構

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `#toast` 固定容器（**整頁唯一**，id 不是 class） | 必填 | CSS `components-showcase.html:399`；容器在 `:1374`，帶 `aria-live="polite" aria-atomic="true"` |
| `.toast-card` ＋ 一個語意 class | 必填，由腳本建立 | `components-showcase.html:1514`–`:1515` |
| `.toast-msg` 訊息 | 必填 | `components-showcase.html:1516`–`:1518` |
| `.toast-close` 關閉鈕（`aria-label="關閉通知"`、Lucide `x` 圖示（`assets/icons/x.svg`）） | 必填，**四種 variant 都會建** | `components-showcase.html:1520`–`:1537` |

`#toast` 的內容每次以 `replaceChildren()` 整個換掉（`:1529`），這就是「單一實例」的實作方式——不是佇列，是覆蓋。

## 變體

| variant | 色系 | 自動消失 |
| :--- | :--- | ---: |
| `.success` | `--color-success` 系列 | 3000ms |
| `.info` | `--color-info` 系列 | 5000ms |
| `.warning` | `--color-warning` 系列 | 8000ms |
| `.error` | `--color-error` 系列 | **0 ＝ 不自動消失，只能手動關** |

色：`components-showcase.html:425`–`:428`。秒數：`components-showcase.html:1498`（`TOAST_DURATIONS`）；`:1530` 的 `if (duration)` 讓 `0` 落到「不設計時器」。

## 適用狀態

| 狀態 | 有沒有 | 依據 |
| :--- | :--- | :--- |
| 隱藏（預設） | 有。`opacity: 0; visibility: hidden`，且 `visibility` 的 transition 延遲到淡出結束 | `components-showcase.html:406`–`:408` |
| 顯示 | 有。`.visible` | `components-showcase.html:410` |
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

`design/prototype/components-showcase.html:398`–`:431`（CSS）、`:1497`–`:1537`（行為）。

## 可重現樣本

`components-showcase#state-default` → `#comp-toast`（`components-showcase.html:1112`）。四顆按鈕各觸發一種 variant 的**真實行為**（`:1533`–`:1537`），不是靜態樣本：按 Error 那顆之後 toast 會一直留著，要自己按 ✕。

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
| `admin/role-settings#toast-saved` | 本頁的 `.toast*`（#423 起改右下角，與規格一致），`TOAST_DURATIONS` 依類型（`role-settings.html:1413`），符合 UXC-07 → `../design-gaps.md` G-39 |
| `admin/user-management#toast-action` | 本頁的 `.toast*`（上方置中），`TOAST_DURATIONS` 依類型（`user-management.html:1456`），符合 UXC-07 |
| `task-management/task-list`（`#param-unauthorized`、`#sim-delete-error`） | 本頁的 `.toast*`（右下角）；#423 起 `TOAST_DURATIONS`（`task-list.html:578`）依類型，error 不自動消失、有關閉鈕，符合 UXC-07 → `../design-gaps.md` G-39 |
| `task-management/task-new`（交付包未列） | 同上，`TOAST_DURATIONS`（`task-new.html:878`）→ G-39 |
| `task-management/task-detail`（交付包未列） | 同上，`TOAST_DURATIONS`（`task-detail.html:11243`）→ G-39 |
| `annotation/annotation-workspace`（`#state-submitted-next`；其他操作交付包未列） | 本頁的 `.toast*`（`annotation-workspace.html:1011`–`:1054`，`aria-live="polite"`，`:1324`）；`TOAST_DURATIONS`（`annotation-workspace.config.js:426`–`:443`）依類型 3000／5000／8000／不自動關，符合 UXC-07 |
| `dataset/dataset-analysis-list#param-invalid-task`（另有點列時的 info，交付包未列） | 本頁的 `.toast*`（`dataset-analysis-list.html:155`–`:197`，`aria-live="polite"`，`:310`）；`TOAST_DURATIONS`（`dataset-analysis-list.js:25`）照 UXC-07 |

`profile.html` 用的是它自己 `<style>` 裡的 toast，不是載入正典——全 prototype 沒有 `shared/toast.css`。另有 7 個頁面各自有 `id="toast"`（b2 五個、b3 一個、b4 一個），七個都已核對（見上表）→ `../design-gaps.md` G-10。b4 的 `dataset-analysis-detail` 原本也有 `.toast*` 樣式與 `#toast`，但沒有任何程式顯示它；#423 已刪掉 → G-55。
