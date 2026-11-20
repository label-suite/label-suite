# UI Design

本 change 新增兩個**只給開發者用**的畫面：健康檢查頁 `/dev/health` 與元件展示頁 `/dev/gallery`。沒有業務頁面、沒有側欄與登入外框（#505 §不包含、維護者 2026-11-20 留言）。

**畫面基準**：兩頁沒有對應的 `design/prototype/pages/` 檔案，基準是維護者 2026-11-20 核可的畫面 artifact（https://claude.ai/artifact/BA87odDCTUkTT6FWoRteUV）的 `Main.dc.html`（健康檢查頁四種狀態）與 `Gallery.dc.html`（元件展示頁），以及 canvas 的「假設」1–4。本文描述那兩張畫面要怎麼拆成路由、元件、資料與狀態，**不重新設計**；artifact 與 `design/system/`、`brand.md` 對不上的地方列在 [§待決問題](#待決問題)，不自己選邊。本文不改 `design/prototype/`。

**依據條號**：本 change 沒有 `docs/specs/` 規格（spec-migration D4），追溯到 ADR 與規則文件。前端框架的依據是 ADR-005（`openspec/config.yaml` 的 `rules.ui-design` 寫成 ADR-004，見 system-analysis 需求矛盾 #5、待決 #16）：React 19 加 Vite 加 TypeScript strict、React Router v6、TanStack Query、shadcn/ui 放 `components/ui/`、目錄 `pages/` 加 `features/`、不用 Storybook 改用元件展示頁（ADR-005 D1–D3、architecture.mdx §前端）。

## 頁面與路由

| 路由                  | 頁面                           | 對應的規格                                                                                                                                                                 | 需要的角色                                                                                        |
| :-------------------- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| `/dev/health`         | 健康檢查頁（「系統健康檢查」） | 無 `docs/specs/` 規格；依據 #505 §包含「一頁 health check 頁」、維護者 2026-11-20 留言的四種狀態、Epic #502 §需求目標、主規格 `health-check`；畫面 artifact `Main.dc.html` | 無。沒有登入、沒有路由守衛；健康檢查是刻意公開的端點（主規格 `health-check`「健康檢查刻意公開」） |
| `/dev/gallery`        | 元件展示頁（「元件展示」）     | 無 `docs/specs/` 規格；依據 ADR-005 D3、architecture.mdx §前端「元件展示頁」、#505 §驗收條件第 4 項、維護者 2026-11-20 留言的七個區塊；畫面 artifact `Gallery.dc.html`     | 無                                                                                                |
| `/`、其他不存在的路徑 | 未定                           | 無                                                                                                                                                                         | 見待決 SA-15                                                                                      |

### 來源對照

| 頁面           | 畫面來源                                                                                            | 元件與狀態的來源                                                                                                                                                                                                                                                                                                                                            | 備註                                                                                                                                                                                                                                     |
| :------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dev/health`  | artifact `Main.dc.html`（四格：載入中、正常（200）、資料庫無法連線（503）、連不到後端（網路錯誤）） | `design/system/components/`：[Card](../../../design/system/components/card.md)、[Badge](../../../design/system/components/badge.md)、[Alert Banner](../../../design/system/components/alert-banner.md)、[Skeleton](../../../design/system/components/skeleton.md)、[Button](../../../design/system/components/button.md)；`design/system/pages/` 沒有這一頁 | artifact 把四種狀態並排成一張展示板；**實際頁面一次只顯示一張卡片**（artifact 說明文字「下面是同一頁的四種狀態」）                                                                                                                       |
| `/dev/gallery` | artifact `Gallery.dc.html`                                                                          | 同上，另加 [Input](../../../design/system/components/input.md)、[Empty State](../../../design/system/components/empty-state.md)                                                                                                                                                                                                                             | **不是** `design/prototype/components-showcase.html` 的移植：後者是 prototype 的元件正典，展示 20 個元件（`design/system/pages/components-showcase.md`）；`/dev/gallery` 只展示 `frontend/src/components/ui/` 實際有的元件，本次七個區塊 |

### 進入、離開與返回

- **進入**：開發者直接輸入網址。兩頁之間沒有互相連結，也沒有任何頁面連到它們（artifact 沒有畫導覽）。
- **離開與返回**：瀏覽器的上一頁。`/dev/gallery` 的目錄是頁內錨點（`#button` 等），點擊會改網址的 hash，上一頁回到前一個錨點。
- **出現在哪些建置**：artifact 假設 1 寫「兩頁都只在開發環境掛載，正式 build 不含路由」，但 #506 的驗收條件要在容器裡看到健康檢查頁顯示成功（system-analysis 需求矛盾 #1）。**本文不決定**，見待決 SA-1。

## 元件樹

元件名稱用語意描述；括號內是候選的 shadcn/ui 原語（放 `components/ui/`）或 `lucide-react` 圖示。頁面放 `pages/`，健康檢查的資料區塊放 `features/` 底下一個功能（名稱與實際目錄以 `system-design.md` 為準）。

### `/dev/health`

```text
DevHealthPage（pages/）
├─ 頁首（靜態）
│  ├─ 眉標「DEV ONLY · /dev/health」
│  ├─ 頁面標題 h1「系統健康檢查」
│  └─ 說明段落：呼叫〔行內程式碼 GET /api/v1/health〕，證明前端經由 Orval 產生的 hook 與 mutator 打得到後端。
└─ HealthStatusCard（features/，卡片 Card；內容區是 polite live region）
   ├─ 〔載入中〕
   │  ├─ 狀態列：旋轉圖示（LoaderCircle，裝飾）＋「正在檢查後端狀態…」（role="status"）
   │  └─ 骨架三條（Skeleton，aria-hidden）
   ├─ 〔正常〕
   │  ├─ 狀態列：狀態徽章 success（Badge，Check 圖示＋「正常」）＋「後端與資料庫都可以用」
   │  └─ 描述清單 dl：服務／資料庫／檢查時間／traceId
   ├─ 〔資料庫無法連線〕
   │  ├─ 錯誤提示 error（Alert，role="alert"，CircleAlert 圖示）：標題「資料庫無法連線」＋後端回的 message
   │  └─ 描述清單 dl：錯誤碼／traceId
   ├─ 〔連不到後端〕
   │  ├─ 警告提示 warning（Alert，role="alert"，TriangleAlert 圖示）：標題「連不到後端」＋檢查提示
   │  └─ 描述清單 dl：錯誤類型／traceId
   └─ 卡片底部：「重新檢查」按鈕（Button，variant 依狀態，見下表）
```

「重新檢查」按鈕在四種狀態的樣子不同，這是 artifact 的設計，照做：

| 狀態           | 按鈕                | 理由（從 artifact 讀出）       |
| :------------- | :------------------ | :----------------------------- |
| 載入中         | outline，停用外觀   | 請求進行中，不能再按（UXC-06） |
| 正常           | outline             | 一切正常，重新檢查是次要動作   |
| 資料庫無法連線 | default（主色實心） | 出錯時重新檢查是主要動作       |
| 連不到後端     | default（主色實心） | 同上                           |

描述清單左欄是標籤（次要文字色），右欄是值；值為代碼的用等寬字（`--font-mono`）。

### `/dev/gallery`

```text
DevGalleryPage（pages/）
├─ 元件目錄（nav，aria-label「元件目錄」，固定在左側）
│  ├─ 眉標「DEV ONLY · /dev/gallery」
│  └─ 七個錨點連結：Button、Input、Badge、Alert、Card、Skeleton · Empty、Token 對照
└─ 主內容（main）
   ├─ 頁首：h1「元件展示」＋說明「每個〔components/ui/〕元件的每個 variant 都在這頁出現一次。完整性測試比對元件宣告的 variant 與本頁的展示，少一個就失敗。」
   ├─ 區塊 Button（#button）　計數「variant × 6 · size × 3 · 狀態 × 2」
   │  ├─ variant 列：default、cta、outline、secondary、ghost、destructive
   │  └─ 尺寸與狀態列：sm、md、lg ｜ 直立分隔線 ｜ disabled、loading（LoaderCircle＋文字，aria-busy）
   ├─ 區塊 Input（#input）　計數「狀態 × 3」
   │  └─ 三欄：預設（placeholder「輸入文字」）、驗證錯誤（值「abc」、錯誤訊息「這一欄的格式不正確」）、停用（值「不能編輯」）；每欄都有關聯的標籤（Label）
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

artifact 最下方還有一塊深底的「完整性測試擋下漏寫的 variant（示意）」，畫的是測試的輸出；它是不是頁面的一部分見待決 UI-4。

**完整性測試要求頁面做到的事**（ADR-005 D3、#505 §驗收條件第 4 項、canvas 假設 4）：

- 每個展示項目都要能被測試辨識成「元件、維度、值」三元組（例如 Button／variant／cta、Button／size／lg、Button／狀態／loading），可見文字就是那個值的名稱，與 artifact 一致。
- 每個區塊標頭的計數（「variant × 6」等）**從元件宣告的 variant 清單算出來**，不手寫數字；手寫的數字會和宣告漂移，測試又抓不到。
- 測試比對的是「元件宣告的 variant」與「頁面展示的項目」。artifact 示意中 Button 宣告了 `link` 卻沒展示而失敗，表示定案的 Button 宣告恰好是上面六個 variant、三個尺寸；shadcn 預設的 `link` variant 與 `icon` 尺寸要不要保留、要不要改原語原始碼，屬待決 SA-11。
- Empty State 在 shadcn/ui 沒有原語（`design/system/components/empty-state.md` §shadcn 對照），它放在哪一層、算不算完整性測試的範圍，以 `system-design.md` 為準。

## 資料來源

| 區塊                              | operationId                                                            | 快取鍵／失效時機                                                                                                                         |
| :-------------------------------- | :--------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `/dev/health` 的 HealthStatusCard | `getHealth`（`GET /api/v1/health`，`backend/openapi.json` 唯一的操作） | query key 只用產物產生的那一個，不手寫（A9）；沒有 mutation，**不失效任何查詢**。「重新檢查」對同一個查詢重新取資料（refetch），不換 key |
| `/dev/health` 的頁首              | 無（靜態文字）                                                         | —                                                                                                                                        |
| `/dev/gallery` 全部區塊           | 無（靜態展示，不取資料）                                               | —                                                                                                                                        |

`getHealth` 回應與 HealthStatusCard 欄位的對應：

| 畫面欄位                     | 來源                                                                                                   | 備註                                                                     |
| :--------------------------- | :----------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| 服務                         | 成功時 `data.status`（值 `ok`）                                                                        | 原樣以等寬字顯示                                                         |
| 資料庫                       | 成功時 `data.database`（值 `ok`）                                                                      | 同上                                                                     |
| 檢查時間                     | 未定：外層的 `timestamp`（伺服器時間）或前端收到回應的時間                                             | 唯一出口拆掉外層後拿不到 `timestamp`，連動待決 SA-2；顯示格式見待決 UI-3 |
| traceId（正常）              | 外層 `traceId`／`X-Correlation-ID`                                                                     | 成功時呼叫端拿不拿得到，待決 SA-2                                        |
| 後端的說明（資料庫無法連線） | 錯誤外層的 `message`，原樣顯示（architecture.mdx §i18n 兩層：前端把 `message` 當已本地化的不透明字串） | 語言取決於唯一出口送的語言偏好，待決 SA-6                                |
| 錯誤碼                       | 單一錯誤型別的錯誤碼（`DATABASE_UNAVAILABLE`）                                                         | A7                                                                       |
| traceId（資料庫無法連線）    | 單一錯誤型別的追蹤編號                                                                                 | A7                                                                       |
| 錯誤類型（連不到後端）       | 單一錯誤型別區分「沒有收到回應」的那個值，artifact 顯示 `network`                                      | 值的名稱以 `system-design.md` 的錯誤型別為準                             |
| traceId（連不到後端）        | 固定文字「無（請求沒有送達）」                                                                         | 不是空白：請求沒有送達，所以沒有追蹤編號                                 |

### 狀態放在哪裡

| 狀態       | 去處           | 內容                                                                                                       |
| :--------- | :------------- | :--------------------------------------------------------------------------------------------------------- |
| 伺服器狀態 | TanStack Query | `getHealth` 一個查詢                                                                                       |
| URL 狀態   | 網址           | `/dev/gallery` 的錨點 hash（`#button` 等），可分享、重新整理後回到同一區塊。`/dev/health` 沒有可分享的狀態 |
| 純 UI 狀態 | 元件內         | `/dev/gallery` 目錄的「目前項目」若需要追蹤捲動位置才放這裡（待決 UI-6）；兩頁都沒有表單草稿               |
| 全域 store | **不需要**     | 兩頁沒有跨路由共用、又不屬於伺服器或網址的狀態（F4）                                                       |

## 畫面狀態

### `/dev/health`

這頁的四種狀態是 artifact 定的「載入中／正常／資料庫無法連線／連不到後端」，**不是** F8 的 loading／error／empty／無權限。對應如下：

| 狀態                                                                  | 呈現                                                                                                                                                                                                                                                                                                              |
| :-------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| loading                                                               | 〔載入中〕：LoaderCircle 旋轉加「正在檢查後端狀態…」（`role="status"`），下方三條骨架（寬度約為載入後三行的長短，UXC-08），按鈕「重新檢查」為停用外觀。**按下「重新檢查」後也回到這個狀態**（system-analysis §業務流程 的流程圖）；背景重新取資料（例如切回分頁）要不要也顯示這個狀態，見待決 UI-7                |
| 成功                                                                  | 〔正常〕：success 徽章「正常」加「後端與資料庫都可以用」，描述清單四列（服務、資料庫、檢查時間、traceId）                                                                                                                                                                                                         |
| error（`503 DATABASE_UNAVAILABLE`）                                   | 〔資料庫無法連線〕：error 提示，標題「資料庫無法連線」，內文是後端回的 `message`；描述清單「錯誤碼 `DATABASE_UNAVAILABLE`」「traceId」；主要按鈕「重新檢查」                                                                                                                                                      |
| error（沒有收到回應：連不上、逾時）                                   | 〔連不到後端〕：warning 提示，標題「連不到後端」，內文「沒有收到任何回應。請確認後端已啟動，且 `VITE_API_BASE_URL` 指向它。」；描述清單「錯誤類型 `network`」「traceId 無（請求沒有送達）」；主要按鈕「重新檢查」。內文裡的設定名稱取決於 `system-design.md` 選擇直連後端或同源代理，若改走代理，這句提示要跟著改 |
| error（其他：`500`、`406`、`404`、`405`、代理回了不是統一外層的內容） | **未定**，artifact 只畫了上面兩種錯誤。見待決 SA-3                                                                                                                                                                                                                                                                |
| empty                                                                 | **不適用**。健康檢查一定有資料：成功時 `data` 恰好是 `{status, database}` 兩個欄位（主規格 `health-check`），沒有「沒有資料」這種結果（canvas 假設 3、維護者 2026-11-20 留言）                                                                                                                                    |
| 無權限（403）                                                         | **不適用**。健康檢查刻意公開，不帶憑證也回 `200`，認證上線後仍維持公開（主規格 `health-check`「健康檢查刻意公開」）；這頁沒有任何受保護的能力                                                                                                                                                                     |
| 欄位被遮蔽                                                            | **不適用**。回應對所有呼叫端相同，沒有遮蔽欄位，也沒有唯讀角色（system-analysis §涉及的角色）。唯一「沒有值」的欄位是連不到後端時的 traceId，它顯示固定說明「無（請求沒有送達）」，不留白                                                                                                                         |
| 送出中與防重複                                                        | 這頁沒有表單。「重新檢查」在請求進行中不能再觸發（UXC-06）；做法見 [§無障礙](#無障礙) 的焦點保留                                                                                                                                                                                                                  |

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

「狀態」欄：**已核可**是 artifact 的 Token 對照區塊明文畫出的四條；**提議**是本文依 artifact 的用色推出、待 `system-design.md` 落地時確認的；**待決**見文末。

| shadcn/ui 變數                          | ← `tokens.css`                                      | 用在（artifact）                                                                                          | 狀態                                                                                           |
| :-------------------------------------- | :-------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `--background`                          | `--color-surface`                                   | 兩頁的頁面底色                                                                                            | 已核可                                                                                         |
| `--foreground`                          | `--color-ink`                                       | 內文、標題、描述清單的值                                                                                  | 提議                                                                                           |
| `--card`／`--card-foreground`           | `--color-white`／`--color-ink`                      | 健康檢查卡片、展示頁各區塊、元件目錄底色                                                                  | 提議                                                                                           |
| `--primary`                             | `--color-primary-strong`                            | default 按鈕填色、outline 按鈕文字                                                                        | 已核可                                                                                         |
| `--primary-foreground`                  | `--color-on-cta`                                    | default 按鈕的文字（`brand.md` §色彩角色：主色填色上的文字）                                              | 提議                                                                                           |
| `--secondary`／`--secondary-foreground` | `--color-border-muted`／`--color-ink`               | secondary 按鈕                                                                                            | 提議                                                                                           |
| `--muted`                               | `--color-border-muted`                              | 骨架條                                                                                                    | 提議（正典 Skeleton 用 `--color-border`，見待決 UI-2）                                         |
| `--muted-foreground`                    | `--color-ink-muted`                                 | 眉標、說明段落、描述清單標籤、區塊計數、停用文字                                                          | 提議                                                                                           |
| `--accent`／`--accent-foreground`       | `--color-primary-soft-bg`／`--color-primary-strong` | 元件目錄的目前項目、說明段落的行內程式碼；與 prototype outline 按鈕的 hover 同組（`button.md` §適用狀態） | 提議                                                                                           |
| `--destructive`                         | `--color-error`                                     | destructive 按鈕填色                                                                                      | 已核可                                                                                         |
| `--border`                              | `--color-border`                                    | 卡片外框、區塊外框、目錄右側分隔、尺寸列的直立分隔線、停用欄位外框                                        | 提議                                                                                           |
| `--input`                               | `--color-border-control`                            | 輸入框外框（`brand.md` 鐵律 13）                                                                          | 已核可                                                                                         |
| `--ring`                                | `--color-primary`                                   | 鍵盤焦點環                                                                                                | 提議；prototype 的焦點樣式是已登記的缺口 `design-gaps.md` G-05，前端用 shadcn 內建的焦點環補上 |

### shadcn 沒有對應語意的 token（F6 第 1 點要逐一列出的落點）

下表每一列都有兩條路：**A** 在對照層新增 shadcn 風格的語意變數（例如 `--cta`、`--success`），元件與對照層都用它；**B** 元件直接引用 `tokens.css` 的變數名。兩條都要改 `components/ui/` 的原語原始碼，而 architecture.mdx §前端 寫「shadcn 元件不改寫」，所以**全表連動待決 SA-11**，本文不選。

| 語意               | `tokens.css` 來源                                                               | 用在（artifact）                                                                                                     |
| :----------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------- |
| 確認與完成類主要鈕 | `--color-cta`、`--color-on-cta`（hover `--color-cta-hover`）                    | Button 的 `cta` variant                                                                                              |
| outline 按鈕外框   | `--color-primary-border`                                                        | outline 按鈕（shadcn 的 outline 讀 `--input`，artifact 用主色細框）                                                  |
| 成功               | `--color-success`、`-bg`、`-border`                                             | 正常徽章、Badge success、Alert success                                                                               |
| 警告               | `--color-warning`、`-bg`、`-border`                                             | 連不到後端的提示、Badge warning、Alert warning                                                                       |
| 錯誤（淺底版）     | `--color-error`、`-bg`、`-border`                                               | 資料庫無法連線的提示、Badge error、Alert error、輸入框驗證錯誤的外框與訊息（shadcn 的 `--destructive` 只有實心一種） |
| 資訊               | `--color-info`、`-bg`、`-border`                                                | Badge info、Alert info                                                                                               |
| 中性徽章           | `--color-border-muted`（底）、`--color-border`（框）、`--color-ink-muted`（字） | Badge neutral                                                                                                        |
| 停用的控制項底色   | `--color-slate-50`                                                              | 停用的 outline 按鈕、停用的輸入框（見待決 UI-2）                                                                     |
| 卡片陰影           | `--shadow-card`                                                                 | 健康檢查卡片、Card 樣本                                                                                              |

`design-gaps.md` G-07（Alert Banner 只有 error 一種）是已登記的缺口；artifact 的 Alert 四種 variant 是在前端這一側補齊，prototype 的 G-07 不因此結案。

### 用途 → token

| 用途                                               | token                                                                                                                                                                                                 |
| :------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 頁面底色                                           | `--color-surface`                                                                                                                                                                                     |
| 卡片、區塊、目錄底色                               | `--color-white`                                                                                                                                                                                       |
| 卡片與區塊外框；卡片樣本 header／footer 的內部分隔 | `--color-border`；`--color-border-muted`                                                                                                                                                              |
| 健康檢查卡片與 Card 樣本的陰影                     | `--shadow-card`（展示頁的區塊外框不加陰影，照 artifact）                                                                                                                                              |
| 內文、標題                                         | `--color-ink`                                                                                                                                                                                         |
| 次要文字（眉標、說明、標籤、計數、停用文字）       | `--color-ink-muted`                                                                                                                                                                                   |
| 行內程式碼（健康檢查說明段落）                     | 底 `--color-primary-soft-bg`、字 `--color-primary-strong`、字型 `--font-mono`                                                                                                                         |
| 載入中的旋轉圖示                                   | `--color-primary`（`brand.md` 鐵律 2：圖示用 `--color-primary`）                                                                                                                                      |
| 元件目錄的目前項目                                 | 底 `--color-primary-soft-bg`、字 `--color-primary-strong`                                                                                                                                             |
| 輸入框外框；驗證錯誤的外框與訊息                   | `--color-border-control`；`--color-error`                                                                                                                                                             |
| 空狀態樣本的虛線框                                 | 待決 UI-2                                                                                                                                                                                             |
| Token 對照的色塊                                   | 直接以對照後的 shadcn 變數上色（色塊本身就是在驗證對照），對照字串用 `--font-mono`                                                                                                                    |
| 字型                                               | 介面 `--font-sans`；代碼、錯誤碼、traceId、對照字串 `--font-mono`；頁面標題見待決 UI-1                                                                                                                |
| 字級                                               | 頁面標題 `--text-h1`；展示頁區塊標題 `--text-h3`；內文與狀態文字 `--text-body`；描述清單、說明、按鈕 `--text-caption`；眉標、計數、欄位錯誤訊息 `--text-label`；artifact 另有 13px、15px，見待決 UI-2 |
| 間距                                               | 頁面內距 `--space-2xl`；頁首與內容之間 `--space-xl`；卡片內距、健康檢查的四格間距 `--space-lg`；區塊內 `--space-md`；artifact 另有 6、10、12、14、20px，見待決 UI-2                                   |
| 圓角                                               | 卡片與區塊 `--radius-lg`；按鈕、輸入框、提示、目錄項目 `--radius-md`；行內程式碼與骨架條 `--radius-sm`；徽章 `--radius-full`                                                                          |
| 動態                                               | 旋轉圖示的轉動；`prefers-reduced-motion` 時停止轉動，「正在檢查後端狀態…」文字照常顯示（F9、`brand.md` 鐵律 11）                                                                                      |

按鈕三個尺寸的高度（36、44、52px）與左右內距是元件內部尺寸，和 prototype `button.css` 一樣不是間距刻度；尺寸由 Button 原語宣告，頁面不另寫。

### 圖示

| 用在                      | Lucide 圖示     | 備註                                                   |
| :------------------------ | :-------------- | :----------------------------------------------------- |
| 載入中、Button 的 loading | `LoaderCircle`  | 裝飾，`aria-hidden`；狀態由旁邊的文字表達              |
| 正常徽章                  | `Check`         | 裝飾；徽章有文字「正常」                               |
| 資料庫無法連線            | `CircleAlert`   | 裝飾；標題文字表達狀態                                 |
| 連不到後端                | `TriangleAlert` | 同上                                                   |
| 空狀態樣本                | 未定            | artifact 的圖形不是 Lucide 的任何一個字形，見待決 UI-5 |

### 文案

畫面上的文字以 artifact 為準，上面元件樹已逐一列出。三點補充：

- artifact 的展示板文字**不上頁面**：健康檢查四格上方的「1　載入中」「2　正常（200）」等格標、說明段落的最後一句「下面是同一頁的四種狀態。」、資料庫無法連線格內的「後端有回應，但 5 秒內查不到資料庫。顯示的是後端回傳的 `message`。」（實際顯示後端的 `message`）。這是本文對 artifact 的解讀，列入待決 UI-4 讓 clarification 確認。
- 介面只有繁體中文版本；要不要同時有英文、文字放語系檔還是直接寫在元件，取決於待決 SA-6。`brand.md` 鐵律 10 要求每個畫面同時支援繁中與英文，開發用頁面算不算在內也在同一題裡。
- 頁面標題（瀏覽器分頁）依 `brand.md` §語言 的格式「Label Suite — <頁名>」：「Label Suite — 系統健康檢查」「Label Suite — 元件展示」。

### 響應式

artifact 只畫了 1280px 寬的桌面版。開發用頁面要不要照 `brand.md` §版面 的斷點（手機 ≤ 767px）處理、健康檢查頁的單張卡片寬度多少，artifact 都沒有交代，見待決 UI-6。不論結果，內容最大寬度不超過 `brand.md` 的 1280px。

### 無障礙

依 F9 的最低要求，兩頁各自要做到：

- **地標與標題**：每頁一個 `h1`；展示頁的每個區塊是帶 `aria-labelledby` 指向區塊標題的 `section`，標題是 `h2`（artifact 的寫法）；元件目錄是 `nav`，`aria-label`「元件目錄」。目前項目的連結加 `aria-current`（若採用目前項目，見待決 UI-6）。
- **狀態朗讀**：健康檢查卡片的內容區是 polite live region，載入時加 `aria-busy`，結果出來時移除，讓螢幕閱讀器讀到新狀態（Skeleton 正典的 `aria-busy` 約定）；載入中的文字 `role="status"`；兩種錯誤提示 `role="alert"`（`alert-banner.md` §鍵盤與焦點 的使用約定）。骨架條 `aria-hidden`。
- **狀態不只靠顏色**：四種狀態都有文字標題（「正常」「資料庫無法連線」「連不到後端」「正在檢查後端狀態…」）與不同的圖示（`brand.md` 鐵律 4）。
- **「重新檢查」的焦點保留**：按下後狀態回到載入中，若用原生 `disabled`，焦點會掉到 `body`，鍵盤使用者要從頭 Tab。所以請求進行中改用 `aria-disabled="true"`，忽略點擊與 Enter／Space，焦點留在按鈕上；外觀照 artifact 的停用樣式。這同時處理 `design-gaps.md` G-06（只擋滑鼠不擋鍵盤）在前端這一側的問題；prototype 的 G-06 待決不受影響。Button 原語的 loading 狀態採同樣做法，並帶 `aria-busy`。
- **欄位標籤**：展示頁三個輸入框都有 `<Label htmlFor>`；驗證錯誤那一欄加 `aria-invalid` 並以 `aria-describedby` 關聯到錯誤訊息；停用那一欄用原生 `disabled`。
- **焦點環**：所有可互動元素用 shadcn 內建的可見焦點環（`--ring`），不拆掉（G-05 是 prototype 的已登記缺口）。
- **對比**：只用 `tokens.css` 已驗過的組合（F9）。主色當文字用 `--color-primary-strong`（`brand.md` 鐵律 2）；outline 按鈕的主色細框對白底只有 1.49:1，但按鈕有文字，框不是唯一提示（鐵律 14）。

## 待決問題

本文**不決定**以下任何一題，全部交給 clarification 的停點。

### 沿用 system-analysis 的待決（只列 UI 受影響的部分）

| #          | 問題                                                                            | UI 受影響的地方                                                                                                              | 選項                                                                                                                                                                                                                  |
| :--------- | :------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SA-1       | 兩頁要不要出現在正式建置                                                        | 路由是否註冊、#506 在容器裡能不能打開健康檢查頁                                                                              | A 只在開發模式註冊（artifact 假設 1）；B 以設定開關，容器可打開；C 健康檢查頁進正式建置、展示頁不進                                                                                                                   |
| SA-2       | 成功時呼叫端拿不拿得到 traceId 與伺服器時間                                     | 〔正常〕的 traceId 列與檢查時間                                                                                              | A 唯一出口回傳資料時一併帶出外層的 `traceId`、`timestamp`；B 從 `X-Correlation-ID` 標頭讀 traceId，檢查時間用前端收到回應的時間；C 拿掉這兩列（偏離已核可畫面，要維護者同意）                                         |
| SA-3       | 四種狀態以外的回應歸哪裡                                                        | 〔資料庫無法連線〕以外的錯誤畫面                                                                                             | A 有統一外層的錯誤一律用 error 提示版面，標題改成通用的「後端回報錯誤」並顯示錯誤碼與 `message`，沒有外層的內容歸〔連不到後端〕；B 新增第五種「其他錯誤」狀態（偏離已核可畫面，要維護者看過）；C 全部歸〔連不到後端〕 |
| SA-4、SA-5 | 重試次數、請求逾時                                                              | 從〔載入中〕到結果出現要多久；逾時若短於後端的 5 秒資料庫等待，資料庫無法連線會被顯示成連不到後端                            | 由 `system-design.md` 提選項                                                                                                                                                                                          |
| SA-6       | 語系層與語言偏好                                                                | 兩頁的文案要不要有英文、後端 `message` 用哪種語言                                                                            | A 建語系層，兩頁文案進繁中與英文兩份；B 不建，開發用頁面只有繁中，語言偏好固定送 `zh-TW`                                                                                                                              |
| SA-7       | 開發時能不能在瀏覽器切到網路替身                                                | artifact 沒有任何「目前使用替身」的標示                                                                                      | A 只在測試用替身，頁面不變；B 開發時可切換，頁面要加一個標示（artifact 沒有，要維護者看過）                                                                                                                           |
| SA-11      | 能不能改 `components/ui/` 原語的原始碼來加 variant；`cta` 等語意的落點          | Button 的 `cta`、尺寸 `md`、loading 與移除 `link`／`icon`；Badge 五種、Alert 四種；上面「shadcn 沒有對應語意的 token」整張表 | 見該表的 A／B                                                                                                                                                                                                         |
| SA-12      | 開發用頁面顯示錯誤碼、traceId、設定名稱算不算 07-01「不出現系統內部資料」的例外 | 〔資料庫無法連線〕與〔連不到後端〕的描述清單、`VITE_API_BASE_URL` 提示                                                       | A 開發用頁面是例外，照 artifact 顯示；B 不是例外，拿掉這些欄位（偏離已核可畫面）                                                                                                                                      |
| SA-14      | 對照層涵蓋深色與否、展示頁要不要切換深色                                        | artifact 沒有切換控制項                                                                                                      | A 對照層含深色，展示頁加切換（要維護者看過）；B 對照層含深色但不加切換，靠手動設 `data-theme` 驗；C 本次只做淺色                                                                                                      |
| SA-15      | 根路徑與不存在的路徑顯示什麼                                                    | artifact 沒有畫                                                                                                              | 由 `system-design.md` 提選項；若要新畫面，要維護者看過                                                                                                                                                                |

### 本文新發現的待決

| #    | 問題                                                                                                                                                                                                                                                                                                                                                                                                                                          | 來源與衝突點                                                                                                 | 影響                                                                               | 選項                                                                                                                                                                       |
| :--- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-1 | 頁面標題的字型：`tokens.css` 對 `h1`、`h2` 有元素規則（襯線 `--font-serif-display`，`h2` 還是 24px），artifact 的兩頁標題都是無襯線，展示頁的 `h2` 是 18px                                                                                                                                                                                                                                                                                    | `tokens.css` §Semantic type rules；artifact 兩頁的 `h1`、`h2`                                                | 對照層若整份引入 `tokens.css`，元素規則會一起生效，畫面與 artifact 不同            | A 照 `tokens.css` 用襯線（偏離 artifact）；B 對照層只取變數，元素規則不生效，照 artifact 用無襯線；C 引入整份，在頁面層覆寫回 artifact 的樣子                              |
| UI-2 | artifact 有幾個值對不到 token 或語意不符：間距 6、10、12、14、20px 與字級 13、15px 不在刻度上；停用按鈕與停用欄位畫成明確的底色，正典 Button 是 `opacity .4`；骨架條的顏色是 `--color-border-muted` 的值，正典 Skeleton 用 `--color-border`；空狀態虛線框的值等於 `--color-border-hover`（語意是次要鈕的 hover 外框），正典空狀態面板用 `--color-border` 加 `--color-slate-50` 底；測試示意裡失敗那一行的淺紅色在 `tokens.css` 沒有任何 token | artifact 的行內樣式；`design/system/components/button.md`、`skeleton.md`、`empty-state.md`；`brand.md` §間距 | 不選就沒辦法「只用 token」                                                         | A 一律取最接近的刻度與正典 token；B 刻度外的值保留為元件內部尺寸、顏色照 artifact 的值找同值 token；C 逐項由維護者決定                                                     |
| UI-3 | 「檢查時間」的格式：artifact 是「2026-11-20 16:03:12（UTC+8）」，帶秒與時區；`brand.md` 規定日期加時間是「YYYY-MM-DD HH:mm」                                                                                                                                                                                                                                                                                                                  | artifact 〔正常〕；`brand.md` §標點與格式（維護者 2026-11-18 裁定）                                          | `src/lib/date.ts` 要不要多一種含秒與時區的格式                                     | A 照 `brand.md`，不帶秒與時區；B 開發用頁面照 artifact 帶秒與時區（要多一種格式）                                                                                          |
| UI-4 | artifact 的展示板文字與測試示意是不是頁面內容：健康檢查的格標與說明末句、資料庫無法連線格內的設計說明、展示頁最下方「完整性測試擋下漏寫的 variant（示意）」那塊深底區（裡面用了 `✓`、`✗` 字元，`brand.md` 鐵律 12 不允許字元當圖示）                                                                                                                                                                                                          | artifact `Main.dc.html`、`Gallery.dc.html`；維護者留言列的「以及完整性測試」                                 | 頁面要不要多一塊區域；測試示意若上頁面，要決定它顯示的是什麼（執行期跑測試不合理） | A 都不上頁面，測試示意只代表測試的輸出（本文的解讀）；B 測試示意上頁面，改成靜態的說明區塊，圖示改用 Lucide                                                                |
| UI-5 | 空狀態樣本的圖示：artifact 的圖形不是任何 Lucide 字形                                                                                                                                                                                                                                                                                                                                                                                         | artifact `#states`；`brand.md` §圖示、F7                                                                     | 需要選一個 Lucide 圖示                                                             | A `Inbox`；B `PackageOpen`；C 其他，由維護者指定                                                                                                                           |
| UI-6 | 版面寬度與響應式：健康檢查頁實際只有一張卡片，它要多寬；展示頁的目錄在窄螢幕怎麼處理；目錄的「目前項目」是點擊後依網址 hash 高亮、依捲動位置高亮，還是不高亮（artifact 只畫了第一項高亮的靜態樣子）                                                                                                                                                                                                                                           | artifact 只有 1280px 一種寬度；`brand.md` §版面 的斷點                                                       | 版面規則與目錄的互動                                                               | 寬度：A 沿用 artifact 單格寬度，B 隨內容區撐滿到 1280px。窄螢幕：A 不處理（開發者用桌面），B 照 `brand.md` 在 767px 以下把目錄移到上方。高亮：A hash、B 捲動位置、C 不高亮 |
| UI-7 | 背景重新取資料要不要顯示〔載入中〕：伺服器資料快取預設會在切回分頁時重新取資料                                                                                                                                                                                                                                                                                                                                                                | system-analysis 流程圖只畫了「重新檢查 → 載入中」；伺服器資料快取的預設值屬 `system-design.md`               | 開發者切回分頁時卡片會不會閃回載入中                                               | A 只要在取資料就顯示載入中；B 只有首次載入與按「重新檢查」才顯示，背景更新直接換結果；C 這個查詢關掉切回分頁時重新取資料                                                   |
