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
3. **重現方式用文字寫，不截圖**（維護者 2026-11-16 裁定）。寫「怎麼走到那個畫面」：哪個檔、哪個角色、哪個參數、點哪裡。這條**兩個 skill 都適用**——[Issue #248](https://github.com/label-suite/label-suite/issues/248) 本文原本寫「截圖只留給差異、難重現及待裁定畫面」，那一句已被該裁定取代
4. **不腦補。** 畫面上看不到的狀態就寫進「無法重現」，**不要用規格去推測畫面有什麼**。規格說該有、prototype 沒有，那是差異，不是視圖
5. **重跑要可比。** 同一個來源、同一個範圍重跑，`manifest.json` 除了 `generatedAt` 之外必須逐位元組相同

---

## 輸入

| 輸入 | 怎麼用 |
| :--- | :--- |
| `design/prototype/`（釘住版本） | **畫面的唯一現況證據**。HTML、它載入的 `.js`／`.css`／`partial`、`assets/` |
| `docs/prototype/navigation.mdx` | 每一頁的 Incoming／Outgoing／Inline 轉場表，是「入口」與「覆蓋核對」的主要來源 |
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

| 對象 | 形式 | 例 |
| :--- | :--- | :--- |
| 畫面（一個 HTML 入口） | `<模組>/<頁面>` | `task-management/task-detail` |
| 視圖（同一個畫面的一種狀態） | `<模組>/<頁面>#<視圖>` | `task-management/task-detail#tab-overview` |

- 模組與頁面照 `design/prototype/pages/` 的實際路徑，不自己改名
- 視圖名用 kebab-case 英文，取**叫出它的那個條件**，不是它長什麼樣：`role-annotator`、`tab-overview`、`state-empty`、`modal-export`、`error-invalid-token`
- 頁面改名或視圖合併時，**不改舊 ID**：在新條目加 `renamedFrom`，舊 ID 留在 `retired` 清單並寫原因

### 視圖從哪裡來

一個畫面要展開成哪些視圖，只看**真的叫得出來**的五種條件：

| 條件 | 怎麼叫出來 | ID 前綴 |
| :--- | :--- | :--- |
| 角色 | 側欄或資料檔切換身分（例：`sidebar.js`、`*.data.js` 的角色欄位） | `role-` |
| URL 參數 | `?token=`、`?task=` 之類 | `param-` |
| 分頁 | 頁內 tab 切換，含動態載入的 `*.panels/` | `tab-` |
| 設定或資料 | 空清單、極值、不同 `runType`、不同狀態值 | `state-` |
| 覆蓋層 | modal、toast、下拉、側滑 | `modal-`／`toast-` |

叫不出來的不列為視圖。規格寫了而畫面沒有的，進 `coverage.md` 的「無法重現」。

---

## 批次

依 [Issue #248](https://github.com/label-suite/label-suite/issues/248) 的首輪執行順序，固定五批。`b0` 由本 skill 一次做完，其餘四批是 `design-system-setup` 的執行單位。

| 批次 ID | 範圍 |
| :--- | :--- |
| `b0-inventory` | 全站點名（本 skill 一次完成，並固定交付包版本） |
| `b1-shared-account` | `pages/shared/`、`pages/account/` |
| `b2-admin-dashboard-task` | `pages/admin/`、`pages/dashboard/`、`pages/task-management/` |
| `b3-annotation-review` | `pages/annotation/` |
| `b4-dataset-sweep` | `pages/dataset/`，以及全站覆蓋複查 |

---

## 步驟

### 步驟 1：釘住版本

1. 確認工作區乾淨（`git status`）。不乾淨就先問要不要先提交，**不要把未提交的畫面打進交付包**——那個版本別人開不出來
2. 取上面四個 sha，記進 `manifest.json` 的 `source`

### 步驟 2：點名畫面

1. 列出 `design/prototype/pages/**/*.html` 的每一個檔，一個檔一個畫面
2. `index.html` 與 `components-showcase.html` 也要收：前者是入口，後者是 living styleguide，`design-system-setup` 會拿它當元件樣本的現成來源
3. 每個畫面記下它實際載入的檔（`<script src>`、`<link href>`、`fetch` 的 partial）。**打開 HTML 看，不要用檔名猜**——`task-detail.html` 的 tab 內容在 `task-detail.panels/` 底下，檔名看不出來

### 步驟 3：展開視圖

對每個畫面，依上面「視圖從哪裡來」的五種條件逐一試：

1. 先讀 `docs/prototype/navigation.mdx` 該頁的轉場表。`Inline` 那幾列就是視圖的主要線索
2. 再讀 HTML 與它的 `.js`：切換身分的開關、讀哪個資料檔、哪些分支會換畫面
3. 每個視圖寫一條**重現步驟**：從哪一頁開始、改哪個東西、點哪裡、看到什麼為止
4. 試不出來的寫進「無法重現」，並寫清楚**卡在哪一步**

### 步驟 4：核對覆蓋

三個來源互相對過，每一邊多出來的都要有下落：

| 對照 | 不一致時 |
| :--- | :--- |
| `navigation.mdx` 的頁面 vs `pages/**/*.html` | 文件有而檔案沒有 → 記進 `coverage.md`；檔案有而文件沒有 → 同上，並在回報裡建議補 `navigation.mdx`（本 skill 不改它） |
| `navigation.mdx` 的 `Inline` 列 vs 展開出來的視圖 | 每一列都要對得到一個視圖，或寫出為什麼叫不出來 |
| `docs/specs/` 的頁面 vs 畫面 | 規格有而畫面沒有 → 「無法重現」；畫面有而規格沒有 → 記進 `coverage.md` 的「沒有規格可連的視圖」 |

另外逐一確認：**動態 partial 與素材載得起來**（`task-detail.panels/`、`assets/images/`、`assets/guidelines/`、`assets/icons/`）。載不起來的視圖算「無法重現」，原因寫「素材缺失」。

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
- `coverage.md` 寫步驟 4 的三張對照結果與「無法重現」的完整清單，每條都要有重現步驟卡住的那一步
- `spec-index.md` 是反向索引：規格頁 → 哪些視圖指向它，順便讓「規格有、畫面沒有」一眼看得出來

### 步驟 6：重跑

重跑時**先比 `source` 的四個 sha**：

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
- 畫面 n 個、視圖 n 個、批次 5 個
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
- 產出只進 `design/system/handoff/`，屬**設計系統 PR**（見 `docs/development/spec-migration.mdx` §PR 的變更範圍）
- 不關閉、不修改 GitHub Issue 本身；要留言先問

## 輸出風格

繁體中文、條列為主。對話中的回報簡短，細節寫在交付包裡。`manifest.json` 的鍵用英文，值照它記的東西的語言。
