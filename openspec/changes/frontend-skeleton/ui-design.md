# UI Design

本 change 新增兩個**只給開發者用**的畫面：健康檢查頁 `/dev/health` 與元件展示頁 `/dev/gallery`。沒有業務頁面、沒有側欄與登入外框（#505 §不包含、維護者 2026-11-20 留言）。

**畫面基準**：兩頁沒有對應的 `design/prototype/pages/` 檔案，基準是維護者 2026-11-20 核可的畫面 artifact（https://claude.ai/artifact/BA87odDCTUkTT6FWoRteUV，**第 4 版**，維護者 2026-11-20 核可）的 `Main.dc.html`（健康檢查頁四種狀態）與 `Gallery.dc.html`（元件展示頁），以及 canvas 的「假設」1–4。本文描述那兩張畫面要怎麼拆成路由、元件、資料與狀態，**不重新設計**；artifact 與 `design/system/`、`brand.md` 對不上的地方，已由維護者在 clarification 的 §決議（Q）逐條裁定，結果記在 [§已決議事項](#已決議事項)。本文不改 `design/prototype/`。

**第 4 版與前一版的差別只有一處**：`/dev/gallery` 標題列「元件展示」右側多一組「淺色／深色」切換（Q13）。其餘畫面不變。

**依據條號**：本 change 沒有 `docs/specs/` 規格（spec-migration D4），追溯到 ADR 與規則文件。前端框架的依據是 ADR-005（`openspec/config.yaml` 的 `rules.ui-design` 誤寫成 ADR-004，已由 clarification P1 在 apply 時改正）：React 19 加 Vite 加 TypeScript strict、React Router v6、TanStack Query、shadcn/ui 放 `components/ui/`、目錄 `pages/` 加 `features/`、不用 Storybook 改用元件展示頁（ADR-005 D1–D3、architecture.mdx §前端）。

## 頁面與路由

| 路由                  | 頁面                                                                                               | 對應的規格                                                                                                                                                                 | 需要的角色                                                                                        |
| :-------------------- | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| `/dev/health`         | 健康檢查頁（「系統健康檢查」）                                                                     | 無 `docs/specs/` 規格；依據 #505 §包含「一頁 health check 頁」、維護者 2026-11-20 留言的四種狀態、Epic #502 §需求目標、主規格 `health-check`；畫面 artifact `Main.dc.html` | 無。沒有登入、沒有路由守衛；健康檢查是刻意公開的端點（主規格 `health-check`「健康檢查刻意公開」） |
| `/dev/gallery`        | 元件展示頁（「元件展示」）                                                                         | 無 `docs/specs/` 規格；依據 ADR-005 D3、architecture.mdx §前端「元件展示頁」、#505 §驗收條件第 4 項、維護者 2026-11-20 留言的七個區塊；畫面 artifact `Gallery.dc.html`     | 無                                                                                                |
| `/`、其他不存在的路徑 | 無頁面：開發模式下導向 `/dev/health`（`replace`）；正式建置只有空殼，首頁與找不到頁面由 01-01 設計 | 無                                                                                                                                                                         | 無（Q14）                                                                                         |

### 來源對照

| 頁面           | 畫面來源                                                                                            | 元件與狀態的來源                                                                                                                                                                                                                                                                                                                                            | 備註                                                                                                                                                                                                                                     |
| :------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dev/health`  | artifact `Main.dc.html`（四格：載入中、正常（200）、資料庫無法連線（503）、連不到後端（網路錯誤）） | `design/system/components/`：[Card](../../../design/system/components/card.md)、[Badge](../../../design/system/components/badge.md)、[Alert Banner](../../../design/system/components/alert-banner.md)、[Skeleton](../../../design/system/components/skeleton.md)、[Button](../../../design/system/components/button.md)；`design/system/pages/` 沒有這一頁 | artifact 把四種狀態並排成一張展示板；**實際頁面一次只顯示一張卡片**（artifact 說明文字「下面是同一頁的四種狀態」）                                                                                                                       |
| `/dev/gallery` | artifact `Gallery.dc.html`                                                                          | 同上，另加 [Input](../../../design/system/components/input.md)、[Empty State](../../../design/system/components/empty-state.md)                                                                                                                                                                                                                             | **不是** `design/prototype/components-showcase.html` 的移植：後者是 prototype 的元件正典，展示 20 個元件（`design/system/pages/components-showcase.md`）；`/dev/gallery` 只展示 `frontend/src/components/ui/` 實際有的元件，本次七個區塊 |

### 進入、離開與返回

- **進入**：開發者直接輸入網址。兩頁之間沒有互相連結，也沒有任何頁面連到它們（artifact 沒有畫導覽）。
- **離開與返回**：瀏覽器的上一頁。`/dev/gallery` 的目錄是頁內錨點（`#button` 等），點擊會改網址的 hash，上一頁回到前一個錨點。
- **出現在哪些建置**：兩頁只在 Vite 開發模式註冊路由，正式建置剪除（Q1）。#506 在容器裡改以後端 `/api/v1/health` 驗證，或把 E2E 跑在開發伺服器上。
- **`/` 與未知路徑**：開發模式下一律導向 `/dev/health`；正式建置沒有這兩頁，也不做首頁或找不到頁面（Q14）。
- **內部資料的例外**：兩頁顯示錯誤碼、traceId、設定名稱，是 07-01「不出現系統內部資料」的例外，只因兩頁僅在開發模式、讀者是開發者（Q11）。本次不做業務頁共用的錯誤元件，留到 01-01 依 07-01 設計。

## 元件樹

元件名稱用語意描述；括號內是候選的 shadcn/ui 原語（放 `components/ui/`）或 `lucide-react` 圖示。頁面放 `pages/`，健康檢查的資料區塊放 `features/` 底下一個功能（名稱與實際目錄以 `system-design.md` 為準）。

**所有介面文字走 react-i18next 的翻譯鍵**（Q5），不在元件內寫死字串；本文引號內的繁體中文是 `zh-TW` 語系檔的內容，`en` 語系檔提供對應英文。語言依 `navigator.language` 判斷（`zh` 開頭用 `zh-TW`，其餘用 `en`），**畫面不加語言切換控制項**，`Accept-Language` 與介面語言一致。後端回的 `message` 原樣顯示，不經翻譯。

### `/dev/health`

```text
DevHealthPage（pages/）
├─ 頁首（靜態）
│  ├─ 眉標「DEV ONLY · /dev/health」
│  ├─ 頁面標題 h1「系統健康檢查」
│  └─ 說明段落：呼叫〔行內程式碼 GET /api/v1/health〕，證明前端經由 Orval 產生的 hook 與 mutator 打得到後端。
└─ HealthStatusPanel（features/，卡片 Card；內容區是 polite live region）
   ├─ 〔載入中〕
   │  ├─ 狀態列：旋轉圖示（LoaderCircle，裝飾）＋「正在檢查後端狀態…」（role="status"）
   │  └─ 骨架三條（Skeleton，aria-hidden）
   ├─ 〔正常〕
   │  ├─ 狀態列：狀態徽章 success（Badge，Check 圖示＋「正常」）＋「後端與資料庫都可以用」
   │  └─ 描述清單 dl：服務／資料庫／檢查時間／traceId
   ├─ 〔資料庫無法連線〕（503 錯誤版面；所有錯誤外層都用這個版面，Q3）
   │  ├─ 錯誤提示 error（Alert，role="alert"，CircleAlert 圖示）：標題「資料庫無法連線」（錯誤碼 DATABASE_UNAVAILABLE）；其他錯誤碼的標題用通用的「後端回報錯誤」＋後端回的 message
   │  └─ 描述清單 dl：錯誤碼／traceId
   ├─ 〔連不到後端〕（沒有統一外層的回應、連線失敗、逾時）
   │  ├─ 警告提示 warning（Alert，role="alert"，TriangleAlert 圖示）：標題「連不到後端」＋檢查提示
   │  └─ 描述清單 dl：錯誤類型（原樣顯示 network 或 timeout）／traceId
   └─ 卡片底部：「重新檢查」按鈕（Button，variant 依狀態，見下表）
```

「重新檢查」按鈕在四種狀態的樣子不同，這是 artifact 的設計，照做：

| 狀態           | 按鈕                                 | 理由（從 artifact 讀出）       |
| :------------- | :----------------------------------- | :----------------------------- |
| 載入中         | outline，停用外觀（`aria-disabled`） | 請求進行中，不能再按（UXC-06） |
| 正常           | outline                              | 一切正常，重新檢查是次要動作   |
| 資料庫無法連線 | default（主色實心）                  | 出錯時重新檢查是主要動作       |
| 連不到後端     | default（主色實心）                  | 同上                           |

描述清單左欄是標籤（次要文字色），右欄是值；值為代碼的用等寬字（`--font-mono`）。

### `/dev/gallery`

```text
DevGalleryPage（pages/）
├─ 元件目錄（nav，aria-label「元件目錄」，固定在左側）
│  ├─ 眉標「DEV ONLY · /dev/gallery」
│  └─ 七個錨點連結：Button、Input、Badge、Alert、Card、Skeleton · Empty、Token 對照
└─ 主內容（main）
   ├─ 頁首標題列：h1「元件展示」；右側是主題切換「淺色／深色」（Q13，見下）
   ├─ 頁首說明「每個〔components/ui/〕元件的每個 variant 都在這頁出現一次。完整性測試比對元件宣告的 variant 與本頁的展示，少一個就失敗。」
   ├─ 區塊 Button（#button）　計數「variant × 6 · size × 3 · 狀態 × 2」（六個 variant 不含 link，Q10）
   │  ├─ variant 列：default、cta、outline、secondary、ghost、destructive
   │  └─ 尺寸與狀態列：sm、md、lg ｜ 直立分隔線 ｜ disabled、loading（LoaderCircle＋文字，aria-busy）
   ├─ 區塊 Input（#input）　計數「狀態 × 3」
   │  └─ 三欄：預設（placeholder「輸入文字」）、驗證錯誤（值「abc」、錯誤訊息「這一欄的格式不正確」）、停用（值「不能編輯」）；每欄都有關聯的標籤（原生 `<label htmlFor>`，不建 Label 原語，design.md D9）
   ├─ 兩欄
   │  ├─ 區塊 Badge（#badge）　計數「variant × 5」：success、warning、error、info、neutral
   │  └─ 區塊 Alert（#alert）　計數「variant × 4」：info「提示訊息」、success「已完成」、warning「請留意」、error「發生錯誤」
   ├─ 兩欄
   │  ├─ 區塊 Card（#card）　計數「header · content · footer」
   │  │  └─ 樣本卡：標題「卡片標題」＋說明「說明文字」／「內容區」／footer 兩顆 sm 按鈕「取消」（ghost）、「確認」（default）
   │  └─ 區塊 Skeleton · Empty（#states）　說明「四種畫面狀態的共用元件」
   │     ├─ 骨架兩條（Skeleton）
   │     └─ 空狀態樣本（Empty State，虛線框）：圖示＋「還沒有資料」＋「說明為什麼是空的，以及下一步」
   └─ 區塊 Token 對照（#tokens）　說明「shadcn/ui 變數 ← prototype tokens.css」
      └─ 四格色塊＋對照字串：--primary ← --color-primary-strong、--destructive ← --color-error、--background ← --color-surface、--input ← --color-border-control
```

**主題切換**（第 4 版新增，Q13）：一組分段控制「淺色／深色」，是兩顆按鈕（Sun、Moon 圖示加文字），放在 `role="group"`、`aria-label="主題"` 的容器內，各以 `aria-pressed` 表示目前選中者。它**只設定 `<html data-theme>`**（`light`／`dark`），預設淺色、**不記住選擇**（重新整理回到淺色）；**離開 `/dev/gallery`（元件卸載）時把 `<html data-theme>` 還原成淺色**，`/dev/health` 因此不會停在深色；純 UI 狀態，放元件內。`/dev/health` 不加這個切換。切換的目的是讓對照層的深色（`html[data-theme="dark"]`）在展示頁看得到。

artifact 最下方那塊深底的「完整性測試擋下漏寫的 variant（示意）」**不上頁面**（UI-4，Q19）：它代表測試的輸出，不是頁面內容。

**完整性測試要求頁面做到的事**（ADR-005 D3、#505 §驗收條件第 4 項、canvas 假設 4）：

- 每個展示項目都要能被測試辨識成「元件、維度、值」三元組（例如 Button／variant／cta、Button／size／lg、Button／狀態／loading），可見文字就是那個值的名稱，與 artifact 一致。
- 每個區塊標頭的計數（「variant × 6」等）**從元件宣告的 variant 清單算出來**，不手寫數字；手寫的數字會和宣告漂移，測試又抓不到。
- 測試比對的是「元件宣告的 variant」與「頁面展示的項目」。Button 宣告恰好是上面六個 variant（刪掉 shadcn 預設的 `link`，Q10）、三個尺寸；允許修改 `components/ui/` 的 shadcn 原語加 variant（Q9）。每個原語匯出 `as const` 的 variant 陣列，完整性測試在執行期比對陣列與頁面展示的項目。
- Empty State 在 shadcn/ui 沒有原語（`design/system/components/empty-state.md` §shadcn 對照），它放在哪一層、算不算完整性測試的範圍，以 `system-design.md` 為準。

## 資料來源

| 區塊                               | operationId                                                            | 快取鍵／失效時機                                                                                                                         |
| :--------------------------------- | :--------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `/dev/health` 的 HealthStatusPanel | `getHealth`（`GET /api/v1/health`，`backend/openapi.json` 唯一的操作） | query key 只用產物產生的那一個，不手寫（A9）；沒有 mutation，**不失效任何查詢**。「重新檢查」對同一個查詢重新取資料（refetch），不換 key |
| `/dev/health` 的頁首               | 無（靜態文字）                                                         | —                                                                                                                                        |
| `/dev/gallery` 全部區塊            | 無（靜態展示，不取資料）                                               | —                                                                                                                                        |

`getHealth` 回應與 HealthStatusPanel 欄位的對應：

| 畫面欄位                     | 來源                                                                                                   | 備註                                                                                                                                                                                                                                                                                                                                                                                          |
| :--------------------------- | :----------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 服務                         | 成功時 `data.status`（值 `ok`）                                                                        | 原樣以等寬字顯示                                                                                                                                                                                                                                                                                                                                                                              |
| 資料庫                       | 成功時 `data.database`（值 `ok`）                                                                      | 同上                                                                                                                                                                                                                                                                                                                                                                                          |
| 檢查時間                     | `meta.timestamp`（外層的伺服器時間）                                                                   | `apiFetch` 回傳 `{data, meta:{traceId, timestamp}}`（Q2）；顯示格式 `YYYY-MM-DD HH:mm:ss（UTC±H）`，是開發頁例外（Q18），業務頁仍依 `brand.md` 的 `YYYY-MM-DD HH:mm`。時間**依瀏覽者裝置時區**換算，括號內標出該裝置的實際偏移（台灣裝置顯示「（UTC+8）」、紐約裝置顯示「（UTC-5）」）；artifact 上的「UTC+8」是台灣裝置的顯示結果，**不是固定換算**，前端不寫死任何時區（F10，Q18 補充決議） |
| traceId（正常）              | `meta.traceId`                                                                                         | 同上（Q2）                                                                                                                                                                                                                                                                                                                                                                                    |
| 後端的說明（資料庫無法連線） | 錯誤外層的 `message`，原樣顯示（architecture.mdx §i18n 兩層：前端把 `message` 當已本地化的不透明字串） | 語言與介面語言一致（`Accept-Language`，Q5）                                                                                                                                                                                                                                                                                                                                                   |
| 錯誤碼                       | 單一錯誤型別的錯誤碼（如 `DATABASE_UNAVAILABLE`）                                                      | A7；所有錯誤外層都顯示（Q3）                                                                                                                                                                                                                                                                                                                                                                  |
| traceId（錯誤外層）          | 單一錯誤型別的追蹤編號（`ApiError` 也帶 `timestamp`，Q2）                                              | A7                                                                                                                                                                                                                                                                                                                                                                                            |
| 錯誤類型（連不到後端）       | 單一錯誤型別區分「沒有收到回應」的那個值，原樣顯示 `network` 或 `timeout`，不翻譯、不合併（Q3）        | 值的名稱以 `system-design.md` 的錯誤型別為準                                                                                                                                                                                                                                                                                                                                                  |
| traceId（連不到後端）        | 固定文字「無（請求沒有送達）」                                                                         | 不是空白：請求沒有送達，所以沒有追蹤編號                                                                                                                                                                                                                                                                                                                                                      |

### 狀態放在哪裡

| 狀態       | 去處           | 內容                                                                                                                                           |
| :--------- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| 伺服器狀態 | TanStack Query | `getHealth` 一個查詢                                                                                                                           |
| URL 狀態   | 網址           | `/dev/gallery` 的錨點 hash（`#button` 等），可分享、重新整理後回到同一區塊；目錄的目前項目依 hash 高亮（UI-6）。`/dev/health` 沒有可分享的狀態 |
| 純 UI 狀態 | 元件內         | `/dev/gallery` 的主題（淺色／深色）：只寫 `<html data-theme>`，預設淺色、不持久化，離開該頁（卸載）時還原成淺色（Q13）；兩頁都沒有表單草稿     |
| 全域 store | **不需要**     | 兩頁沒有跨路由共用、又不屬於伺服器或網址的狀態（F4）；語言由 i18next 實例持有，不另建 store                                                    |

## 畫面狀態

### `/dev/health`

這頁的四種狀態是 artifact 定的「載入中／正常／資料庫無法連線／連不到後端」，**不是** F8 的 loading／error／empty／無權限。對應如下：

| 狀態                                                                  | 呈現                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| loading                                                               | 〔載入中〕：LoaderCircle 旋轉加「正在檢查後端狀態…」（`role="status"`），下方三條骨架（寬度約為載入後三行的長短，UXC-08），按鈕「重新檢查」為停用外觀並帶 `aria-disabled="true"`（檢查進行中都是如此，焦點留在按鈕上，見 [§無障礙](#無障礙)）。**只在兩個時機顯示**：首次載入（查詢尚無結果，`isPending`），以及使用者按下「重新檢查」後到結果回來前（system-analysis §業務流程 的流程圖）。背景重新取資料（例如切回分頁）**不顯示**載入中，畫面保留上一個結果、回來後直接換成新結果（UI-7，Q19） |
| 成功                                                                  | 〔正常〕：success 徽章「正常」加「後端與資料庫都可以用」，描述清單四列（服務、資料庫、檢查時間、traceId）                                                                                                                                                                                                                                                                                                                                                                                         |
| error（`503 DATABASE_UNAVAILABLE`，及所有有統一外層的錯誤）           | 〔資料庫無法連線〕版面（Q3）：error 提示，內文是後端回的 `message`；描述清單「錯誤碼」「traceId」；主要按鈕「重新檢查」。標題：`DATABASE_UNAVAILABLE` 用「資料庫無法連線」，其餘錯誤碼（`500`、`404`、`422` 等）用通用的「後端回報錯誤」，錯誤碼與 `message` 照列                                                                                                                                                                                                                                 |
| error（沒有收到回應：連不上、逾時；以及沒有統一外層的回應）           | 〔連不到後端〕：warning 提示，標題「連不到後端」，內文「沒有收到任何回應。請確認後端已啟動，且 `VITE_API_BASE_URL` 指向它。」；描述清單「錯誤類型」原樣顯示 `network` 或 `timeout`、「traceId 無（請求沒有送達）」；主要按鈕「重新檢查」。請求逾時為 15 秒，不自動重試（Q4）；內文裡的設定名稱 `VITE_API_BASE_URL` 是開發頁的例外顯示（Q11）                                                                                                                                                      |
| error（其他：`500`、`406`、`404`、`405`、代理回了不是統一外層的內容） | 有統一外層者走上面的 503 錯誤版面（通用標題）；沒有外層者走〔連不到後端〕。**不新增第五種狀態**（Q3）                                                                                                                                                                                                                                                                                                                                                                                             |
| empty                                                                 | **不適用**。健康檢查一定有資料：成功時 `data` 恰好是 `{status, database}` 兩個欄位（主規格 `health-check`），沒有「沒有資料」這種結果（canvas 假設 3、維護者 2026-11-20 留言）                                                                                                                                                                                                                                                                                                                    |
| 無權限（403）                                                         | **不適用**。健康檢查刻意公開，不帶憑證也回 `200`，認證上線後仍維持公開（主規格 `health-check`「健康檢查刻意公開」）；這頁沒有任何受保護的能力                                                                                                                                                                                                                                                                                                                                                     |
| 欄位被遮蔽                                                            | **不適用**。回應對所有呼叫端相同，沒有遮蔽欄位，也沒有唯讀角色（system-analysis §涉及的角色）。唯一「沒有值」的欄位是連不到後端時的 traceId，它顯示固定說明「無（請求沒有送達）」，不留白                                                                                                                                                                                                                                                                                                         |
| 送出中與防重複                                                        | 這頁沒有表單。「重新檢查」在請求進行中不能再觸發（UXC-06）；做法見 [§無障礙](#無障礙) 的焦點保留                                                                                                                                                                                                                                                                                                                                                                                                  |

F8 的例外依據：這是 F8「四種畫面狀態」在本頁的明文例外（system-analysis §涉及的角色）。

### `/dev/gallery`

| 狀態                                 | 呈現                                                                                                                                                                         |
| :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| loading／error／empty／無權限（403） | **不適用**。整頁是靜態展示、不取資料，屬 F8 §例外「不取資料的靜態區塊沒有這四種狀態」。頁面上的「驗證錯誤」「停用」「loading」「還沒有資料」都是元件的**樣本**，不是頁面狀態 |
| 欄位被遮蔽                           | 不適用                                                                                                                                                                       |

### 測試集答案不外露（Hard Rule 6）

兩頁都不碰任務、資料集或答案，標記員也到不了開發用頁面，**本次不適用**。延續到後續的約束（system-analysis §涉及的角色）：元件展示頁之後要列出標記 widget，那時 widget 的樣本資料不得含標準答案或測試集辨識資訊，且 widget 依設定（output type）出現，不寫死某一種任務（Hard Rule 5）。

## 元件與 design token

所有色值只來自 `design/prototype/assets/tokens.css`；`frontend/src/styles/` 的對照層把 shadcn/ui 的語意變數指向它（ADR-005 D4、F6）。本節不寫色碼。圖示一律 `lucide-react`（ADR-005 D5、F7、`brand.md` §圖示），線寬用 Lucide 預設的 2：artifact 的勾與旋轉圈畫成 3 與 2.5，那是畫面工具的差異，`brand.md` §圖示 規定線寬統一為 2。

### shadcn/ui 變數的對照

「狀態」欄：**已核可**是 artifact 的 Token 對照區塊明文畫出的四條；**提議**是本文依 artifact 的用色推出、待 `system-design.md` 落地時確認的；骨架與停用底色的取捨見 [§artifact 對不到刻度或 token 的值](#artifact-對不到刻度或-token-的值)（Q17）。

**tokens.css 的引入方式**（Q15）：以一支小 Vite 外掛在建置時只抽出 `tokens.css` 中 `:root` 與 `html[data-theme="dark"]` 的自訂屬性，產物不提交；**不載入外部字型、不套用元素規則**（`h1`、`h2` 的襯線與 24px 都不生效，兩頁標題照 artifact 用無襯線，展示頁 `h2` 取 `--text-h3`）。圓角與字型仍以 `tokens.css` 的值為準，不被 Tailwind 的同名變數覆蓋。對照層同時對應深色（`html[data-theme="dark"]`，Q13）。

| shadcn/ui 變數                          | ← `tokens.css`                                      | 用在（artifact）                                                                                                                         | 狀態                                                                                           |
| :-------------------------------------- | :-------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `--background`                          | `--color-surface`                                   | 兩頁的頁面底色                                                                                                                           | 已核可                                                                                         |
| `--foreground`                          | `--color-ink`                                       | 內文、標題、描述清單的值                                                                                                                 | 提議                                                                                           |
| `--card`／`--card-foreground`           | `--color-white`／`--color-ink`                      | 健康檢查卡片、展示頁各區塊、元件目錄底色                                                                                                 | 提議                                                                                           |
| `--primary`                             | `--color-primary-strong`                            | default 按鈕填色、outline 按鈕文字                                                                                                       | 已核可                                                                                         |
| `--primary-foreground`                  | `--color-on-cta`                                    | default 按鈕的文字（`brand.md` §色彩角色：主色填色上的文字）                                                                             | 提議                                                                                           |
| `--secondary`／`--secondary-foreground` | `--color-border-muted`／`--color-ink`               | secondary 按鈕                                                                                                                           | 提議                                                                                           |
| `--muted`                               | `--color-border-muted`                              | 本次沒有原語使用；骨架條依 §artifact 對不到刻度或 token 的值 用 `--border`（`--color-border`）                                           | 提議（正典 Skeleton 用 `--color-border`；取最接近的既有 token，Q17）                           |
| `--muted-foreground`                    | `--color-ink-muted`                                 | 眉標、說明段落、描述清單標籤、區塊計數、停用文字                                                                                         | 提議                                                                                           |
| `--accent`／`--accent-foreground`       | `--color-primary-soft-bg`／`--color-primary-strong` | 元件目錄的目前項目、說明段落的行內程式碼；與 prototype outline 按鈕的 hover 同組（`button.md` §適用狀態）                                | 提議                                                                                           |
| `--destructive`                         | `--color-error`                                     | destructive 按鈕填色                                                                                                                     | 已核可                                                                                         |
| `--destructive-foreground`              | `--color-on-cta`                                    | destructive 按鈕的文字（`pages/shared/modal.css:77`–`:80` 正典實心版的文字色，`button.md` 已核定實心版為正典；淺色 6.47:1、深色 5.78:1） | 提議                                                                                           |
| `--border`                              | `--color-border`                                    | 卡片外框、區塊外框、目錄右側分隔、尺寸列的直立分隔線、停用欄位外框                                                                       | 提議                                                                                           |
| `--input`                               | `--color-border-control`                            | 輸入框外框（`brand.md` 鐵律 13）                                                                                                         | 已核可                                                                                         |
| `--ring`                                | `--color-primary`                                   | 鍵盤焦點環                                                                                                                               | 提議；prototype 的焦點樣式是已登記的缺口 `design-gaps.md` G-05，前端用 shadcn 內建的焦點環補上 |

### shadcn 沒有對應語意的 token（F6 第 1 點要逐一列出的落點）

下表每一列都有兩條路：**A** 在對照層新增 shadcn 風格的語意變數（例如 `--cta`、`--success`），元件與對照層都用它；**B** 元件直接引用 `tokens.css` 的變數名。**已決議走 A**（Q9）：允許修改 `components/ui/` 的 shadcn 原語加 variant；對照層新增 `--cta`、`--success` 等語意變數，原語只用語意變數、不直接引用 `tokens.css` 的變數名。architecture.mdx「shadcn 元件不改寫」那句另開 `[Docs]` issue 改準，不在本 change 改。

| 語意               | `tokens.css` 來源                                                               | 用在（artifact）                                                                                                     |
| :----------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------- |
| 確認與完成類主要鈕 | `--color-cta`、`--color-on-cta`（hover `--color-cta-hover`）                    | Button 的 `cta` variant                                                                                              |
| outline 按鈕外框   | `--color-primary-border`                                                        | outline 按鈕（shadcn 的 outline 讀 `--input`，artifact 用主色細框）                                                  |
| 成功               | `--color-success`、`-bg`、`-border`                                             | 正常徽章、Badge success、Alert success                                                                               |
| 警告               | `--color-warning`、`-bg`、`-border`                                             | 連不到後端的提示、Badge warning、Alert warning                                                                       |
| 錯誤（淺底版）     | `--color-error`、`-bg`、`-border`                                               | 資料庫無法連線的提示、Badge error、Alert error、輸入框驗證錯誤的外框與訊息（shadcn 的 `--destructive` 只有實心一種） |
| 資訊               | `--color-info`、`-bg`、`-border`                                                | Badge info、Alert info                                                                                               |
| 中性徽章           | `--color-border-muted`（底）、`--color-border`（框）、`--color-ink-muted`（字） | Badge neutral                                                                                                        |
| 空狀態面板底色     | `--color-slate-50`（語意變數 `--surface-subtle`）                               | Empty State 樣本的底色（Q17）                                                                                        |
| 停用的控制項底色   | `--color-slate-50`                                                              | 停用的 outline 按鈕、停用的輸入框（取最接近的既有 token，Q17）                                                       |
| 卡片陰影           | `--shadow-card`                                                                 | 健康檢查卡片、Card 樣本                                                                                              |

`design-gaps.md` G-07（Alert Banner 只有 error 一種）是已登記的缺口；artifact 的 Alert 四種 variant 是在前端這一側補齊，prototype 的 G-07 不因此結案。

### 用途 → token

| 用途                                               | token                                                                                                                                                                                                                  |
| :------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 頁面底色                                           | `--color-surface`                                                                                                                                                                                                      |
| 卡片、區塊、目錄底色                               | `--color-white`                                                                                                                                                                                                        |
| 卡片與區塊外框；卡片樣本 header／footer 的內部分隔 | `--color-border`；`--color-border-muted`                                                                                                                                                                               |
| 健康檢查卡片與 Card 樣本的陰影                     | `--shadow-card`（展示頁的區塊外框不加陰影，照 artifact）                                                                                                                                                               |
| 內文、標題                                         | `--color-ink`                                                                                                                                                                                                          |
| 次要文字（眉標、說明、標籤、計數、停用文字）       | `--color-ink-muted`                                                                                                                                                                                                    |
| 行內程式碼（健康檢查說明段落）                     | 底 `--color-primary-soft-bg`、字 `--color-primary-strong`、字型 `--font-mono`                                                                                                                                          |
| 載入中的旋轉圖示                                   | `--color-primary`（`brand.md` 鐵律 2：圖示用 `--color-primary`）                                                                                                                                                       |
| 元件目錄的目前項目                                 | 底 `--color-primary-soft-bg`、字 `--color-primary-strong`                                                                                                                                                              |
| 輸入框外框；驗證錯誤的外框與訊息                   | `--color-border-control`；`--color-error`                                                                                                                                                                              |
| 空狀態樣本的虛線框                                 | `--color-border`（正典空狀態面板，Q17）                                                                                                                                                                                |
| Token 對照的色塊                                   | 直接以對照後的 shadcn 變數上色（色塊本身就是在驗證對照），對照字串用 `--font-mono`                                                                                                                                     |
| 字型                                               | 介面 `--font-sans`；代碼、錯誤碼、traceId、對照字串 `--font-mono`；頁面標題照 artifact 用無襯線（Q15，元素規則不生效）                                                                                                 |
| 字級                                               | 頁面標題 `--text-h1`；展示頁區塊標題 `--text-h3`；內文與狀態文字 `--text-body`；描述清單、說明、按鈕 `--text-caption`；眉標、計數、欄位錯誤訊息 `--text-label`；artifact 的 13px、15px 取最近刻度，見下方偏離表（Q17） |
| 間距                                               | 頁面內距 `--space-2xl`；頁首與內容之間 `--space-xl`；卡片內距、健康檢查的四格間距 `--space-lg`；區塊內 `--space-md`；artifact 的 6、10、12、14、20px 取最近刻度，見下方偏離表（Q17）                                   |
| 圓角                                               | 卡片與區塊 `--radius-lg`；按鈕、輸入框、提示、目錄項目 `--radius-md`；行內程式碼與骨架條 `--radius-sm`；徽章 `--radius-full`                                                                                           |
| 動態                                               | 旋轉圖示的轉動；`prefers-reduced-motion` 時停止轉動，「正在檢查後端狀態…」文字照常顯示（F9、`brand.md` 鐵律 11）                                                                                                       |

按鈕三個尺寸的高度（36、44、52px）與左右內距是元件內部尺寸，和 prototype `button.css` 一樣不是間距刻度；尺寸由 Button 原語宣告，頁面不另寫。

### artifact 對不到刻度或 token 的值

Q17：間距與字級取最近的刻度，顏色用語意最接近的既有 token；不寫死值、不加新 token。畫面與 artifact 差 1–2px，維護者已接受。

| artifact 的值                | 實際用                                                                                                            | 偏離                                                                    |
| :--------------------------- | :---------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| 間距 6px                     | `--space-sm`（8px）                                                                                               | +2px                                                                    |
| 間距 10px                    | `--space-sm`（8px）                                                                                               | -2px                                                                    |
| 間距 12px                    | `--space-md`（16px）                                                                                              | +4px；若該處是元件內部緊貼的間距則取 `--space-sm`，以不改變層級關係為準 |
| 間距 14px                    | `--space-md`（16px）                                                                                              | +2px                                                                    |
| 間距 20px                    | `--space-lg`（24px）                                                                                              | +4px                                                                    |
| 字級 13px                    | `--text-label`（12px）                                                                                            | -1px                                                                    |
| 字級 15px                    | `--text-caption`（14px）                                                                                          | -1px                                                                    |
| 停用按鈕與停用欄位的明確底色 | `--color-slate-50` 加停用文字色 `--color-ink-muted`（不採正典 Button 的 `opacity .4`）                            | 與正典 Button 不同；沿用 artifact 的做法，用既有 token                  |
| 骨架條顏色                   | `--color-border`（正典 Skeleton）                                                                                 | 比 artifact 略深                                                        |
| 空狀態虛線框                 | `--color-border`（正典空狀態面板），底 `--color-slate-50`（經 `--surface-subtle`）                                | artifact 的值等於 `--color-border-hover`，語意是次要鈕 hover 外框，不採 |
| 輸入框尺寸                   | 高 44px（`h-11`）、左右 12px（`px-3`）、字級 `--text-caption`（14px），依核准 artifact `Gallery.dc.html` 的輸入框 | 依 artifact，不取 shadcn 預設的 `h-9`（36px）與 `--text-body`（16px）   |
| 測試示意的淺紅色             | 不適用                                                                                                            | 測試示意不上頁面（UI-4）                                                |

### 圖示

| 用在                      | Lucide 圖示     | 備註                                                                 |
| :------------------------ | :-------------- | :------------------------------------------------------------------- |
| 載入中、Button 的 loading | `LoaderCircle`  | 裝飾，`aria-hidden`；狀態由旁邊的文字表達                            |
| 正常徽章                  | `Check`         | 裝飾；徽章有文字「正常」                                             |
| 資料庫無法連線            | `CircleAlert`   | 裝飾；標題文字表達狀態                                               |
| 連不到後端                | `TriangleAlert` | 同上                                                                 |
| 空狀態樣本                | `Inbox`         | 裝飾；artifact 的圖形不是 Lucide 字形，維護者選 `Inbox`（UI-5，Q19） |
| 主題切換                  | `Sun`、`Moon`   | 裝飾；按鈕有文字「淺色」「深色」（Q13）                              |

### 文案

畫面上的文字以 artifact 為準，上面元件樹已逐一列出。三點補充：

- artifact 的展示板文字**不上頁面**（UI-4，Q19）：健康檢查四格上方的「1　載入中」「2　正常（200）」等格標、說明段落的最後一句「下面是同一頁的四種狀態。」、資料庫無法連線格內的「後端有回應，但 5 秒內查不到資料庫。顯示的是後端回傳的 `message`。」（實際顯示後端的 `message`），以及展示頁的「完整性測試示意」。
- 介面文字同時有繁體中文與英文兩份語系檔，元件只引用翻譯鍵（Q5），符合 `brand.md` 鐵律 10；測試以指定語言執行。
- 頁面標題（瀏覽器分頁）依 `brand.md` §語言 的格式「Label Suite — <頁名>」：「Label Suite — 系統健康檢查」「Label Suite — 元件展示」。

### 響應式

artifact 只畫了 1280px 寬的桌面版。依 UI-6（Q19）：健康檢查頁的卡片沿用 artifact 的單格寬度；767px 以下（`brand.md` §版面 的手機斷點）展示頁的元件目錄移到內容上方；目錄的目前項目依網址 hash 高亮。內容最大寬度不超過 `brand.md` 的 1280px。

### 無障礙

依 F9 的最低要求，兩頁各自要做到：

- **地標與標題**：每頁一個 `h1`；展示頁的每個區塊是帶 `aria-labelledby` 指向區塊標題的 `section`，標題是 `h2`（artifact 的寫法）；元件目錄是 `nav`，`aria-label`「元件目錄」。目前項目的連結加 `aria-current`（依網址 hash 判定，UI-6）。主題切換是 `role="group"`、`aria-label="主題"`，兩顆按鈕各帶 `aria-pressed`，可 Tab 聚焦、Enter／Space 切換。
- **狀態朗讀**：健康檢查卡片的內容區是 polite live region，載入時加 `aria-busy`，結果出來時移除，讓螢幕閱讀器讀到新狀態（Skeleton 正典的 `aria-busy` 約定）；載入中的文字 `role="status"`；兩種錯誤提示 `role="alert"`（`alert-banner.md` §鍵盤與焦點 的使用約定）。骨架條 `aria-hidden`。
- **狀態不只靠顏色**：四種狀態都有文字標題（「正常」「資料庫無法連線」「連不到後端」「正在檢查後端狀態…」）與不同的圖示（`brand.md` 鐵律 4）。
- **「重新檢查」的焦點保留**：按下後狀態回到載入中，若用原生 `disabled`，焦點會掉到 `body`，鍵盤使用者要從頭 Tab。所以請求進行中改用 `aria-disabled="true"`，忽略點擊與 Enter／Space，焦點留在按鈕上；外觀照 artifact 的停用樣式。這同時處理 `design-gaps.md` G-06（只擋滑鼠不擋鍵盤）在前端這一側的問題；prototype 的 G-06 待決不受影響。Button 原語的 loading 狀態採同樣做法，並帶 `aria-busy`。
- **欄位標籤**：展示頁三個輸入框都有原生 `<label htmlFor>`（不建 Label 原語，design.md D9）；驗證錯誤那一欄加 `aria-invalid` 並以 `aria-describedby` 關聯到錯誤訊息；停用那一欄用原生 `disabled`。
- **焦點環**：所有可互動元素用 shadcn 內建的可見焦點環（`--ring`），不拆掉（G-05 是 prototype 的已登記缺口）。
- **對比**：只用 `tokens.css` 已驗過的組合（F9）。主色當文字用 `--color-primary-strong`（`brand.md` 鐵律 2）；outline 按鈕的主色細框對白底只有 1.49:1，但按鈕有文字，框不是唯一提示（鐵律 14）。

## 已決議事項

本節取代原「待決問題」。維護者已在 `clarification.md` §決議（Q）於 2026-11-20 逐條裁定，**本文不得重新討論**；`specs`、`design.md`、`tasks.md` 沿用。畫面以 artifact 第 4 版為準。

### 沿用 system-analysis 的待決（只列 UI 受影響的部分）

| #          | 結論                                                                                                                                                                   | 依據 | 本文落點                      |
| :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- | :---------------------------- |
| SA-1       | 已決議：兩頁只在 Vite 開發模式註冊路由，正式建置剪除；#506 改以後端 `/api/v1/health` 驗證或把 E2E 跑在開發伺服器上                                                     | Q1   | §進入、離開與返回             |
| SA-2       | 已決議：`apiFetch` 回傳 `{data, meta:{traceId, timestamp}}`，`ApiError` 也帶 `timestamp`；〔正常〕照 artifact 顯示 traceId 與檢查時間                                  | Q2   | §資料來源                     |
| SA-3       | 已決議：所有錯誤外層走〔503〕錯誤版面，通用標題「後端回報錯誤」加錯誤碼與 message；非外層歸〔連不到後端〕，「錯誤類型」原樣顯示 `network`／`timeout`；不新增第五種狀態 | Q3   | §畫面狀態                     |
| SA-4、SA-5 | 已決議：不自動重試；請求逾時 15 秒；`isAuthError` 只認 401                                                                                                             | Q4   | §畫面狀態（〔連不到後端〕列） |
| SA-6       | 已決議：建 react-i18next 語系層，`zh-TW` 與 `en` 兩份，依 `navigator.language`，不加切換控制項，`Accept-Language` 與介面語言一致                                       | Q5   | §元件樹說明、§文案            |
| SA-7       | 已決議：替身只給測試，頁面沒有任何替身標示                                                                                                                             | Q6   | 無畫面影響                    |
| SA-11      | 已決議：允許改 `components/ui/` 原語加 variant；對照層新增 `--cta`、`--success` 等語意變數（走 A）；每個原語匯出 `as const` variant 陣列，完整性測試執行期比對         | Q9   | §shadcn 沒有對應語意的 token  |
| SA-12      | 已決議：兩頁是 07-01「不出現系統內部資料」的例外，照 artifact 顯示錯誤碼、traceId、設定名；本次不做業務頁共用錯誤元件                                                  | Q11  | §進入、離開與返回             |
| SA-14      | 已決議：對照層含深色；展示頁標題列右側加「淺色／深色」切換（artifact 第 4 版），只改 `<html data-theme>`、預設淺色、不記住、離開該頁時還原淺色；健康檢查頁不加         | Q13  | §`/dev/gallery` 元件樹        |
| SA-15      | 已決議：開發模式下 `/` 與未知路徑導向 `/dev/health`；正式建置只有空殼                                                                                                  | Q14  | §頁面與路由                   |

### 本文新發現的待決

| #    | 結論                                                                                                                                                                                            | 依據 | 本文落點                          |
| :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- | :-------------------------------- |
| UI-1 | 已決議（選項 B）：只抽出 `tokens.css` 的自訂屬性，不載入外部字型與元素規則，標題照 artifact 用無襯線                                                                                            | Q15  | §元件與 design token              |
| UI-2 | 已決議（選項 A）：間距、字級取最近刻度，顏色用最接近的既有 token，差異列表                                                                                                                      | Q17  | §artifact 對不到刻度或 token 的值 |
| UI-3 | 已決議（選項 B）：開發頁檢查時間 `YYYY-MM-DD HH:mm:ss（UTC±H）`，記為開發頁例外；業務頁仍依 `brand.md`。補充決議：依瀏覽者裝置時區顯示，括號內是實際偏移（台灣裝置為「（UTC+8）」），不寫死時區 | Q18  | §資料來源                         |
| UI-4 | 已決議（選項 A）：展示板文字與「完整性測試示意」不上頁面                                                                                                                                        | Q19  | §文案、§`/dev/gallery` 元件樹     |
| UI-5 | 已決議：空狀態圖示用 Lucide `Inbox`                                                                                                                                                             | Q19  | §圖示                             |
| UI-6 | 已決議：卡片沿用 artifact 單格寬度；767px 以下目錄移到上方；目錄依網址 hash 高亮                                                                                                                | Q19  | §響應式、§無障礙                  |
| UI-7 | 已決議（選項 B）：只有首次載入與按「重新檢查」顯示〔載入中〕，背景更新直接換結果                                                                                                                | Q19  | §畫面狀態                         |

### 其他連動的決議

- **Button 六個 variant、無 `link`**（Q10）：宣告與展示都只有 default、cta、outline、secondary、ghost、destructive。
- **Token 對照區塊的資料來源**（Q16）：以 Vite `?raw` 讀 `styles/theme.css` 解析變數清單；lint 規則對這一個檔案具名放行並註明理由，其他頁仍受 F1 約束。展示頁的對照因此永遠與檔案一致。
- **測試集答案不外露**：不受上述決議影響，兩頁仍不碰任務與答案。
