---
name: design-handoff
description: 把某個版本的 design/prototype/ 連同它的規格與導覽文件打包成一份有版本、可重跑的交付包，寫進 design/system/handoff/：點名每個畫面與視圖、記下穩定 ID、入口、重現條件、規格連結與批次，核對覆蓋並列出無法重現的視圖。當使用者說「打包 prototype」「盤點現在有哪些畫面」「重建元件規格前先固定輸入」「prototype 改過了，哪些批次要重驗」，或要跑 design-system-setup 而還沒有交付包時使用。
---

# Design Handoff

此 skill 是元件規格重建的**第一步**：把某個版本的 `design/prototype/` 連同它的規格與導覽文件，打包成一份**有版本、可重跑**的交付包，交給 [`design-system-setup`](../design-system-setup/SKILL.md) 分批重建 `design/system/`。
工作源頭是 [Issue #248](https://github.com/label-suite/label-suite/issues/248)。

它**只盤點，不判斷**：產出是「這個版本有哪些畫面與視圖、各自怎麼重現、對應哪一條規格」。元件怎麼拆、哪裡和規格不一致，是下一個 skill 的事。

## 何時使用

- 要開始（或重跑）元件規格重建，需要一份固定版本的輸入
- `design/prototype/` 或 `docs/specs/` 改過，要知道哪些視圖受影響、哪些批次要重驗
- 要回答「某個畫面狀態在 prototype 上到底存不存在、怎麼叫得出來」

## 何時不使用

- 要寫元件規格本身 → [`design-system-setup`](../design-system-setup/SKILL.md)
- 要改 prototype 的畫面 → 那是**畫面修正**，先走 `AGENTS.md` 的 Ready gate（提案畫成 artifact 給維護者看過才能開工）
- 要查某個色票或字級的值 → [`label-suite-design`](../label-suite-design/SKILL.md)
- 要寫業務規格 → [`spec-writing`](../spec-writing/SKILL.md)

## 鐵律

1. **只讀不改。** 本 skill 不動 `design/prototype/`、`docs/specs/`、`docs/prototype/`。發現 prototype 有問題時記進交付包的「無法重現」，不要順手改畫面
2. **交付包一定釘在一個 commit 上。** 沒有釘住版本的盤點不算交付包——下一個 skill 會依它判斷「哪些批次要重驗」，浮動的輸入會讓那個判斷失效
3. **重現方式用文字寫，不截圖**。寫「怎麼走到那個畫面」：哪個檔、哪個角色、哪個參數、點哪裡。這條**兩個 skill 都適用**——[Issue #248](https://github.com/label-suite/label-suite/issues/248) 本文原本寫「截圖只留給差異、難重現及待裁定畫面」，那一句已被這條取代
4. **不腦補。** 畫面上看不到的狀態就寫進「無法重現」，**不要用規格去推測畫面有什麼**。規格說該有、prototype 沒有，那是差異，不是視圖
5. **重跑要可比。** 同一個來源、同一個範圍重跑，`manifest.json` 除了 `generatedAt` 之外必須逐位元組相同

---

## 輸入

| 輸入 | 怎麼用 |
| :--- | :--- |
| `design/prototype/`（釘住版本） | **畫面的唯一現況證據**。HTML、它載入的 `.js`／`.css`／`partial`、`assets/` |
| `docs/prototype/navigation.mdx` | 兩件事：每一頁的 Incoming／Outgoing／Inline 轉場表（「入口」與覆蓋核對的主要來源），以及 **§網址參數**——這個 prototype 認得的參數契約，`design-handoff` 展開視圖就是依它（[#248](https://github.com/label-suite/label-suite/issues/248) 寫進去的） |
| `docs/specs/`（釘住版本） | 每個視圖連回哪一條規格。只用來**連結**，不用來推測畫面 |
| `design/prototype/assets/tokens.css` | 色值的唯一來源；本 skill 只記路徑，不抄值（值見 `label-suite-design`） |
| 原始 repo 的 `design/system/` | **參照，不是依據。** 可以拿來比對「舊版盤到哪些畫面」，但本交付包只記本 repo 這個版本實際存在的東西 |

---

## 產出

```
design/system/handoff/
├─ manifest.json        交付包本體：版本、來源、批次、畫面與視圖
├─ coverage.md          覆蓋核對結果，含無法重現的視圖與原因
└─ spec-index.md        規格章節索引：視圖 → docs/specs 的錨點
```

`design/system/` 目前**不存在**，第一次執行時建立。

### 「可開啟的快照」是釘住的版本，不是複製一份

交付包**不把 prototype 複製進 `design/system/`**。版本用 git 自己的 tree 物件釘住：

```sh
git rev-parse HEAD                      # 交付包的 commit
git rev-parse HEAD:design/prototype     # prototype 的 tree sha
git rev-parse HEAD:docs/specs           # 規格的 tree sha
git rev-parse HEAD:docs/prototype/navigation.mdx   # 導覽文件的 blob sha
```

理由：把整個 prototype（寫這份時是 119 個檔）複製進版控會產生第二份會漂移的畫面，而本 repo 的第八條鐵律正是「改動會把別頁的既有斷言打成假的就要一起改」——兩份 prototype 必然互相打假。tree sha 由 git 保證，任何一個位元組變了就不同，而且用它可以隨時把那個版本開起來：

```sh
git switch --detach <commit> && pnpm prototype
```

`manifest.json` 的 `openWith` 欄位就記這兩行。

---

## 穩定 ID

ID 是 `design-system-setup` 重跑時比對「哪些東西受影響」的鍵，**一旦發出就不再改字面**。

### 共用外殼算一個條目，不是 16 份重複

大部分條目是一個 HTML 入口，但**不是全部**。`design/prototype/pages/shared/sidebar.js` 被 18 個畫面裡的 16 個載入（只有 `index.html` 與 `components-showcase.html` 沒有），它自己有一整組狀態——主題、語言、側欄收合、行動版版面、使用者區、登出、通知、快捷鍵、系統管理群組與它的次選單、工作頁籤與階段徽章；那些狀態**屬於同一組元件**，不是 16 組。

所以共用外殼用 `shared/<名稱>` 自成一個條目，`file` 指向它的本體（例：`shared/sidebar.js`），`hosts` 記它被哪些畫面載入。採這個做法，而不是把同一組狀態複製進 16 個畫面的 `views`（以目前的 13 個狀態算就是 208 筆重複，而下游盤元件時還要自己收回 13 組）。

判準是**「這組狀態由誰擁有」**，不是「它出現在幾個畫面上」：`shared/` 底下的檔定義它、而任何單一畫面都只是載入它，就自成一個條目。只在某一頁出現的東西仍然是那一頁的視圖。

| 對象 | 形式 | 例 |
| :--- | :--- | :--- |
| 畫面（一個 HTML 入口） | `<模組>/<頁面>` | `task-management/task-detail` |
| **共用外殼**（不是 HTML 入口，但自己有狀態） | `shared/<名稱>` | `shared/app-shell` |
| 視圖（同一個畫面或外殼的一種狀態） | `<上面那個 ID>#<視圖>` | `task-management/task-detail#tab-overview`、`shared/app-shell#state-theme-dark` |

- 模組與頁面照 `design/prototype/pages/` 的實際路徑，不自己改名
- 視圖名用 kebab-case 英文，取**叫出它的那個條件**，不是它長什麼樣：`role-annotator`、`sim-403`、`param-status-draft`、`tab-overview`、`state-empty`、`modal-export`、`toast-saved`、`proto-expired`。前綴只用下表那七列給的八個
- 頁面改名或視圖合併時，**不改舊 ID**：在新條目加 `renamedFrom`，舊 ID 留在 `retired` 清單並寫原因

### 視圖從哪裡來

這個 prototype 的狀態幾乎全部由 **URL 參數**驅動，所以展開視圖的主力是把參數掃出來，不是靠點。七種條件：

| 條件 | 怎麼叫出來 | ID 前綴 |
| :--- | :--- | :--- |
| 角色 | `?role=`。`shared/sidebar.js`、`task-management/task-detail.html`、`annotation/annotation-list.html`、`annotation/annotation-workspace.html`、`admin/user-management.html` 都讀它；任務角色另有 `?task_role=` | `role-` |
| **模擬旗標** | `?sim_<情況>=1`，prototype 自己的約定，專門用來叫出**正常走不到或會被自動導走**的狀態：`sim_403`（`task-detail.html`）、`sim_delete_error`（`task-list.html`）、`sim_hold`（`verify-email.html`，擋住成功後的導向好讓面板留在畫面上）、`sim_logged_in`／`sim_logged_out`（`sidebar.js`） | `sim-` |
| 其他 URL 參數 | 篩選與定位：`task_id`、`status`、`run_type`、`view`、`scenario`、`q`／`keyword`、`limit`／`offset`、`output_type`、`iaa_status`、`ap_stage`、`run_stage`、`q_state`／`s_state`、`invalid_task`、`unauthorized`、`notice` | `param-` |
| 分頁 | `?tab=`，或頁內切換；含動態載入的 `*.panels/`（`task-detail`）與 `*.partials/`（`dataset-analysis-detail`） | `tab-` |
| 設定或資料 | 改種子資料（`*.data.js`）才看得到的：空清單、極值、不同狀態值 | `state-` |
| 覆蓋層 | modal、toast、下拉、側滑 | `modal-`／`toast-` |
| **頁內原型開關** | `proto-btn` 按鈕呼叫 `showState('valid'｜'expired'｜'used')`，只存在於 `account/reset-password.html` 與 `account/verify-email.html`。那幾個連結狀態**沒有別的叫法**——不是角色、不是參數、不是 tab、不是資料 | `proto-` |

**參數要掃出來，不要用猜的**——但**逐字掃 `.get('<名稱>')` 掃不到全部**。`task-detail.html` 把 16 個參數定義在一張 `URL_VIEW_STATE` 表裡（`:5042`），以 `params.get(entry.param)` 讀（`:5117`）；字面量掃描對這種寫法完全瞎掉，第一次跑就漏了 14 個（判例：[PR #399](https://github.com/label-suite/label-suite/pull/399) 的獨立審查）。

所以兩步都要做：

1. 掃 `.get('<名稱>')` 的字面量
2. **再掃 `.get(<變數>)`，回去把那個變數的來源表讀出來**——`params.get(x)`、`searchParams.get(x)` 只要引數不是字串常數，就一定有一張表或一組常數在別處

上表的名單是寫這份時的現況，不是上限。
`sim_` 那一族要特別掃一遍——它們存在的理由就是那些狀態點不到，漏掉它們等於把一批真的存在的視圖寫成「無法重現」。

叫不出來的不列為視圖。規格寫了而畫面沒有的，進 `coverage.md` 的「無法重現」。

---

## 批次

依 [Issue #248](https://github.com/label-suite/label-suite/issues/248) 的首輪執行順序，固定五批。`b0` 由本 skill 一次做完，其餘四批是 `design-system-setup` 的執行單位。

| 批次 ID | 範圍 | 條目數 |
| :--- | :--- | ---: |
| `b0-inventory` | 全站點名（本 skill 一次完成，並固定交付包版本） | 19 |
| `b1-shared-account` | `pages/shared/`（含共用外殼條目）、`pages/account/`，加上 `index.html` 與 `components-showcase.html` | 1 ＋ 6 ＋ 2 |
| `b2-admin-dashboard-task` | `pages/admin/`、`pages/dashboard/`、`pages/task-management/` | 2 ＋ 1 ＋ 3 |
| `b3-annotation-review` | `pages/annotation/` | 2 |
| `b4-dataset-sweep` | `pages/dataset/`，以及全站覆蓋複查 | 2 |

`index.html` 與 `components-showcase.html` 在 `pages/` 之外，不屬於任何產品模組，**隨 `b1` 一起處理**：前者是站台入口，後者是 living styleguide，而它正是 `design-system-setup` 的元件樣本主來源，沒有批次歸屬等於元件正典沒有歸屬。

`pages/shared/` **一個 HTML 都沒有**，裡面是別頁載入的 CSS 與 JS（側欄、modal、日期區間、空狀態、輸入框…），所以它不產生「畫面」——但它產生一個**共用外殼條目**（`shared/app-shell`），見上面的穩定 ID。
它排在 `b1` 是因為那些檔決定了全站共用元件的樣子，要先定案；而 `b1` 的其他八個條目（兩個根層入口與六個帳號頁）**都不算繪側欄**——帳號頁載入 `sidebar.js` 只是為了登入導向判斷。沒有外殼條目的話，`b1` 要定的共用元件裡最大的一組沒有落點。
條目數是寫這份時的現況（`pages/**/*.html` 共 16 個，加兩個根層入口與一個共用外殼＝19），不是上限；每次 `b0` 重跑都要重數。

---

## 步驟

### 步驟 1：釘住版本

1. 確認工作區乾淨（`git status`）。不乾淨就先問要不要先提交，**不要把未提交的畫面打進交付包**——那個版本別人開不出來
2. 取上面四個 sha，記進 `manifest.json` 的 `source`

### 步驟 2：點名畫面

1. 列出 `design/prototype/pages/**/*.html` 的每一個檔，一個檔一個畫面
2. `index.html` 與 `components-showcase.html` 也要收：前者是入口，後者是 living styleguide，`design-system-setup` 會拿它當元件樣本的現成來源
3. **再加共用外殼的條目**：`pages/shared/` 底下定義全站共用狀態的檔（目前是 `sidebar.js` 與 `sidebar.css`）自成一個 `shared/<名稱>` 條目，`hosts` 記它被哪些畫面載入
4. 每個畫面記下它實際載入的檔（`<script src>`、`<link href>`、`fetch` 的 partial）。**打開 HTML 看，不要用檔名猜**——`task-detail.html` 的 tab 內容在 `task-detail.panels/` 底下，檔名看不出來

### 步驟 3：展開視圖

對每個畫面，依上面「視圖從哪裡來」的七種條件逐一試：

1. 先讀 `docs/prototype/navigation.mdx`：該頁的轉場表（`Inline` 那幾列是視圖的主要線索），以及 §網址參數 裡該頁認得的參數與值域
2. 把該頁 HTML 與它載入的 `.js` 裡的 `.get('<名稱>')` 全部掃出來，逐個試；`sim_` 開頭的一定要試
3. 每個視圖寫一條**重現步驟**：從哪一頁開始、改哪個東西、點哪裡、看到什麼為止
4. 試不出來的寫進「無法重現」，並寫清楚**卡在哪一步**

### 步驟 4：核對覆蓋

三個來源互相對過，每一邊多出來的都要有下落：

| 對照 | 不一致時 |
| :--- | :--- |
| `navigation.mdx` 的頁面 vs `pages/**/*.html` | 文件有而檔案沒有 → 記進 `coverage.md`；檔案有而文件沒有 → 同上，並在回報裡建議補 `navigation.mdx`（本 skill 不改它） |
| `navigation.mdx` 的 `Inline` 列 vs 展開出來的視圖 | 每一列都要對得到一個視圖，或寫出為什麼叫不出來 |
| `navigation.mdx` §網址參數 vs 逐檔掃出來的參數全集 | **兩個方向都要對**：契約有而程式沒有的是過期或編的；程式有而契約沒有的要回報建議補進 `navigation.mdx`（本 skill 不改它）。**掃的時候要照上面「視圖從哪裡來」那兩步做**——只掃字面量會漏掉表格驅動的讀取，這一條第一次執行就是這樣漏了 14 個。這一條是 §網址參數 存在的理由，沒有它契約隔天就會過期 |
| `docs/specs/` 的頁面 vs 畫面 | 規格有而畫面沒有 → 「無法重現」；畫面有而規格沒有 → 記進 `coverage.md` 的「沒有規格可連的視圖」 |

另外逐一確認：**動態 partial 與素材載得起來**（`task-management/task-detail.panels/` 6 個、`dataset/dataset-analysis-detail.partials/` 16 個，以及 `assets/images/`、`assets/guidelines/`、`assets/icons/`）。載不起來的視圖算「無法重現」，原因寫「素材缺失」。

> 執行環境的瀏覽器工具不一定連得到本機 `pnpm prototype`（這個 repo 的輪詢 loop 就連不到）。需要真的開畫面才能確認的，寫進回報請維護者代看，**不要反覆重試**，也不要因為開不起來就把視圖當成不存在。

### 步驟 5：寫交付包

`manifest.json` 的形狀：

```json
{
  "packageVersion": 1,
  "generatedAt": "2026-11-16",
  "source": {
    "commit": "<sha>",
    "prototypeTree": "<sha>",
    "specsTree": "<sha>",
    "navigationBlob": "<sha>",
    "referenceDesignDocs": { "repo": "singyichen/label-suite", "commit": "faf8335" },
    "openWith": ["git switch --detach <sha>", "pnpm prototype"]
  },
  "screens": [
    {
      "id": "account/login",
      "batch": "b1-shared-account",
      "file": "design/prototype/pages/account/login.html",
      "loads": ["design/prototype/pages/shared/input.css"],
      "entry": "由 /index.html 自動導向；登出後也回到這裡",
      "spec": "docs/specs/01-account/01-login.mdx",
      "views": [
        {
          "id": "account/login#error-invalid",
          "how": "在帳號欄輸入不存在的 email，送出",
          "spec": "docs/specs/01-account/01-login.mdx#卡控機制",
          "evidence": ["design/prototype/pages/account/login.html"]
        }
      ]
    }
  ],
  "unreproducible": [
    { "id": "<id>", "why": "<卡在哪一步>", "spec": "<規格連結，沒有就 null>" }
  ],
  "retired": [{ "id": "<舊 id>", "why": "<原因>" }]
}
```

- `screens` 依 `id` 字典序排、`views` 也是。**順序固定是重跑可比的前提**
- 視圖的批次**繼承它所屬的畫面**，不在 `views` 裡重複一欄——同一個畫面的視圖不可能分到兩批
- `referenceDesignDocs` 記的是原始 repo 的設計文件（#248「參考」區塊指名的那一版）。它只是**參照**，不是現況證據，所以**它變了不觸發重驗**；記下來是為了讓「當時拿哪一版對照過」有據可查
- `coverage.md` 寫步驟 4 的三張對照結果與「無法重現」的完整清單，每條都要有重現步驟卡住的那一步
- `spec-index.md` 是反向索引：規格頁 → 哪些視圖指向它，順便讓「規格有、畫面沒有」一眼看得出來

### 步驟 6：重跑

重跑時**先比 `source` 的四個 sha**（`referenceDesignDocs` 不在比對範圍內，理由見上）：

| 情況 | 做法 |
| :--- | :--- |
| 四個都沒變 | 重新產生一次，除 `generatedAt` 外必須與舊檔相同。不同就是本 skill 有不確定性，先查清楚再說 |
| 有變 | 逐一列出**新增、移除、受影響**的視圖，並把受影響視圖所屬的批次標成「應重驗」 |

受影響的判定只看證據：某個視圖的 `evidence` 或 `spec` 指到的檔變了，它就是受影響。**不要憑印象判斷「這個改動應該不影響畫面」。**

重跑的差異寫進 `coverage.md` 的「本次重跑」一節，連同應重驗的批次清單——`design-system-setup` 讀的就是這一節。

### 步驟 7：回報

```markdown
## 交付包已產生

- 版本：commit `<sha>`，prototype tree `<sha>`
- 條目 n 個（含共用外殼）、視圖 n 個、批次 5 個（`b0` 本 skill 做完，`b1`–`b4` 交給下游）
- 覆蓋：navigation n 頁全數對上／缺 n 頁（已列出）
- 無法重現：n 個（原因分類：素材缺失 n、叫不出那個狀態 n、需要維護者代看 n）
- 沒有規格可連的視圖：n 個
- 重跑：與上一版相同／有 n 個新增、n 個移除、n 個受影響，應重驗批次：…
- 要維護者代看的：{列出來，沒有就寫「無」}
```

---

## 邊界

- 不改 `design/prototype/`、`docs/specs/`、`docs/prototype/`、`docs/specs/00-prd.mdx`
- 不做設計判斷：不決定元件怎麼拆、不評價畫面好不好、不提重新設計
- 不截圖
- 產出只進 `design/system/handoff/`，屬**設計系統 PR**（見 `docs/development/workflow/spec-migration.mdx` §PR 的變更範圍）
- 不關閉、不修改 GitHub Issue 本身；要留言先問

## 輸出風格

繁體中文、條列為主。對話中的回報簡短，細節寫在交付包裡。`manifest.json` 的鍵用英文，值照它記的東西的語言。
