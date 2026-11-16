---
name: design-system-setup
description: 依 design-handoff 的交付包，分批把現行 prototype 重建成元件規格，寫進 design/system/：MASTER.md、pages/<頁面>.md、ux-conventions.md、components/<元件>.md 與生成的 screen-inventory.md，並把原型與業務規格的差異記進 design-gaps.md。當使用者說「重建元件規格」「做這一批的元件清冊」「從 prototype 整理設計系統」「哪些畫面還沒有元件規格」，或要寫 ui-design.md 而還沒有元件規格時使用。
---

# Design System Setup

此 skill 把 [`design-handoff`](../design-handoff/SKILL.md) 的交付包**分批**重建成元件規格，寫進 `design/system/`。
工作源頭是 [Issue #248](https://github.com/label-suite/label-suite/issues/248)。

它的產出是 OpenSpec `ui-design.md` 的輸入：`ui-ux` 要決定一個畫面用哪些元件、哪些狀態時，讀的是這裡，不是回頭讀 HTML。
範圍**只有重建現況與記錄差異**。重新設計、改 prototype、改業務規格、導入前端主題或元件，都不在這裡。

## 何時使用

- 要重建某一批的元件規格，而交付包已經產出
- prototype 或規格改過，交付包說某些批次「應重驗」
- 要回答「這個畫面用到哪些元件」或「這個元件被哪些畫面用」

## 何時不使用

- 還沒有交付包 → 先跑 [`design-handoff`](../design-handoff/SKILL.md)
- 要改 prototype 的畫面 → 那是**畫面修正**，先走 `AGENTS.md` 的 Ready gate
- 要查 token 的值或 Tailwind 對照 → [`label-suite-design`](../label-suite-design/SKILL.md)
- 要改業務規則 → [`spec-writing`](../spec-writing/SKILL.md)；這裡只記差異，不改規格

## 鐵律

1. **一次一批。** 輸入一定帶批次 ID。跨批次的東西只「引用」，不在這一批重寫
2. **只讀不改上游。** 不動 `design/prototype/`、`docs/specs/`、交付包
3. **依據只有四種**（寫進規格的每一條都要指得出其中之一）：
   - prototype 的實際程式碼（檔名加行號）
   - `design/prototype/assets/tokens.css` 的 token
   - `docs/specs/` 的條文（連到章節錨點）
   - 維護者明確拍板且已記下日期

   **撰寫者自己的判斷不算依據**，即使理由充分、即使它和畫面一致。沒有依據的觀察寫進 `design-gaps.md`，不要寫成規格
4. **差異用重現步驟寫，不截圖**（維護者 2026-11-16 裁定）。寫「怎麼走到那個畫面、看到什麼」
5. **重跑不洗掉別批的東西。** 依穩定 ID 更新受影響的元件與差異，其他批次的使用關係與既有裁定原樣保留

---

## 提問格式

凡是本文寫「依提問格式」詢問的地方，一律用下面的文字格式提問，然後**停下來等使用者回覆**，不要自行選擇或繼續往下做：

```markdown
**Q1｜{元件或畫面}**：{問題}

1. {選項}（建議）— {選這個選項的影響}
2. {選項} — {影響}
3. {選項} — {影響}

（回覆編號即可，也可以直接輸入其他答案）
```

- 每題 2～4 個選項，最推薦的放第一個並標「（建議）」
- 一次最多 4 題，題號連續；使用者可以用「Q1:1、Q2:3」一次回覆
- 使用者回覆前，不寫檔、不提交

---

## 輸入

| 輸入 | 怎麼用 |
| :--- | :--- |
| `design/system/handoff/manifest.json`（釘住版本） | 這一批有哪些畫面與視圖、各自怎麼重現、連到哪條規格 |
| `design/system/handoff/coverage.md` | 無法重現的視圖、沒有規格可連的視圖、上次重跑的差異與應重驗批次 |
| 批次 ID | `b1-shared-account`、`b2-admin-dashboard-task`、`b3-annotation-review`、`b4-dataset-sweep` 其中之一 |
| `design/system/components/`（現有元件清冊） | 這一批的元件先找得到就沿用，不另造同名或近義的第二份 |
| 維護者裁定紀錄（issue 留言、`design-gaps.md` 的已裁定欄） | 已拍板的事不重新開題 |
| `design/prototype/components-showcase.html` | living styleguide，元件樣本與正典 CSS 的現成來源 |

交付包的 `source` 四個 sha 與目前 `HEAD` 不一致時，**先回報再決定**：要嘛重跑 `design-handoff` 更新交付包，要嘛明說這一批是依舊版寫的。不要默默用舊的。

---

## 產出

```
design/system/
├─ MASTER.md             總表：元件一覽、批次狀態、怎麼查
├─ ux-conventions.md     跨元件的共同約定（狀態、焦點、錯誤、空狀態、載入）
├─ components/<元件>.md  一個元件一份
├─ pages/<頁面>.md       一個畫面一份：用到哪些元件、哪些視圖
├─ screen-inventory.md   生成：畫面 × 元件的對照表
└─ design-gaps.md        差異、缺證據、待重新設計
```

`design/system/` 目前**不存在**，由 `design-handoff` 第一次執行時建立。

**雙向查得到**是驗收條件：`pages/<頁面>.md` 列它用到的元件，`components/<元件>.md` 列用到它的畫面，`screen-inventory.md` 由這兩邊生成、不手寫。三者對不上時以 `components/` 與 `pages/` 為準，重新生成 `screen-inventory.md`。

### 元件規格的欄位

`components/<元件>.md` 每一份都要有這七項，缺的寫「未觀察到」，不要留白：

| 欄位 | 寫什麼 | 依據 |
| :--- | :--- | :--- |
| 結構 | 由哪些部分組成、哪些必填哪些選用 | prototype 檔名加行號 |
| 變體 | 有幾種樣子、怎麼決定用哪一種 | 同上 |
| 適用狀態 | 預設、hover、focus、disabled、載入中、錯誤、空 —— **只寫畫面上真的有的** | 同上；沒有的寫進 `design-gaps.md` |
| token | 用到哪些 `--color-*`／字級／間距／圓角 | `tokens.css` 的 token 名，**不抄 hex**（值見 `label-suite-design`） |
| 鍵盤與焦點 | Tab 順序、Enter／Esc、焦點是否被困在 modal 裡 | prototype 的 `*.js`（例：`shared/modal-focus.js`） |
| 樣式出處 | 這個樣子是哪個 CSS 檔的哪一段決定的 | 檔名加行號 |
| 可重現樣本 | 怎麼在 prototype 上看到它：哪個視圖 ID、怎麼走到 | 交付包的視圖 ID |

另加一節 **shadcn 對照**：候選原語（例：`Button`、`Dialog`、`Command`）與**差距**——我們有而它沒有的、它有而我們沒有的、語意對不上的。這一節是寫給之後的 `ui-design.md` 看的，不是現在要換元件。

---

## 步驟

### 步驟 1：確認輸入

1. 讀交付包，比對 `source` 的 sha 與 `HEAD`
2. 確認批次 ID，列出這一批的畫面與視圖數
3. 讀現有的 `MASTER.md` 與 `components/`：這一批會用到的元件哪些已經有了
4. 讀 `design-gaps.md` 已裁定的那幾條，避免重開已拍板的題

### 步驟 2：先掃元件，再寫畫面

1. 依交付包的視圖逐一打開 prototype 的 HTML 與它載入的 CSS／JS
2. 先列**這一批出現的元件候選**：重複出現的結構、`pages/shared/` 底下的 CSS 各自對應什麼
3. 和現有 `components/` 比對：同一個東西就沿用既有檔名，**不要因為這一批長得稍微不同就另開一份**。真的是兩個東西時，在兩份裡互相寫明差別
4. 依「提問格式」把「看起來像同一個、但不確定要不要合併」的成對元件一次問完（每批最多 4 題）

### 步驟 3：寫元件規格

1. 一個元件一個檔，依上面七個欄位寫
2. 每一條都附依據。找不到依據的**不要寫進規格**，改寫進 `design-gaps.md`
3. 狀態只寫畫面上找得到的。規格要求而畫面沒有的（例：規格寫了載入失敗要顯示重試，畫面沒有那個狀態）→ `design-gaps.md` 的「缺少狀態證據」
4. token 只寫 token 名。畫面上出現 `tokens.css` 沒有的值 → `design-gaps.md`，不要替它取一個新 token 名

### 步驟 4：寫畫面規格

1. 一個畫面一個檔，列出：它有哪些視圖（引交付包的 ID）、每個視圖用到哪些元件、哪些是這一頁專屬
2. 專屬元件也要有 `components/` 的檔，只是在 `MASTER.md` 標成「單頁專屬」
3. 業務行為一律**連回 `docs/specs/`**，不在這裡重述規則——重述會變成第二份會漂移的需求

### 步驟 5：寫 `ux-conventions.md`

只收**跨元件成立**的約定，而且要指得出至少兩個元件在遵守它。只有一個元件這樣做的，寫在那個元件自己的檔裡。

### 步驟 6：生成 `screen-inventory.md`

從 `components/` 與 `pages/` 生成，不手寫。每一列：畫面 ID、視圖數、用到的元件、這一批有沒有處理過。

### 步驟 7：寫 `design-gaps.md`

每一筆四欄，缺一不可：

| 欄位 | 寫什麼 |
| :--- | :--- |
| 重現方式 | 從哪一頁開始、改什麼、點哪裡、看到什麼。**不截圖** |
| 受影響範圍 | 哪些視圖、哪些元件、哪些規格章節 |
| 依據 | 哪一條規格 vs 哪一行畫面；兩邊的原文都引出來 |
| 待決問題 | 要維護者決定什麼。已裁定的改成「已裁定（日期）」並保留原題 |

分三類：**原型與業務規格差異**、**缺少狀態證據**、**待重新設計**。第三類只登記，不在這裡提方案。

### 步驟 8：更新 `MASTER.md` 與驗證

1. `MASTER.md` 更新元件一覽與批次狀態（哪一批做完了、交付包版本是哪一個）
2. 逐項確認：
   - 每個元件的七個欄位都有內容，每一條都有依據
   - 每個 `pages/` 列的元件在 `components/` 找得到，反向也成立
   - `screen-inventory.md` 是生成的，和前兩者一致
   - 這一批交付包裡的每個視圖，都能在某個 `pages/` 檔裡找到
   - `design-gaps.md` 每一筆四欄齊全
   - 全文沒有 hex 色值（除非是 `design-gaps.md` 在引用畫面上的違規值）
3. 跑 `pnpm check:specs`、`pnpm exec notecraftapp build docs --rebuild`（本 skill 不寫 `docs/`，但要確認沒有連帶打破）

### 步驟 9：重跑

交付包說某批「應重驗」時：

1. 只處理**受影響的 ID**。沒被影響的元件、畫面、差異一個字都不動
2. 受影響的元件：重新核對七個欄位，變了的改、沒變的留
3. **別批的使用關係要保留**：某個元件被 `b2` 的畫面用到，在重跑 `b3` 時不得從它的「用到它的畫面」清單裡消失
4. 既有裁定要保留。來源的改動讓某條裁定的前提不成立時，**保留原裁定、原日期與原理由**，另加一行「需複核（日期、哪個改動）」，**不要自己改結論**
5. 回報裡列出：更新 n 個元件、n 個畫面、n 筆差異；需複核的裁定 n 條

### 步驟 10：回報

```markdown
## 批次 <id> 已完成

- 交付包：commit `<sha>`
- 畫面 n 個、視圖 n 個
- 元件：新增 n、沿用 n、更新 n
- 差異：原型與規格 n、缺狀態證據 n、待重新設計 n
- 需維護者決定：{列出來，沒有就寫「無」}
- 需複核的既有裁定：{列出來，沒有就寫「無」}
- 下一批：<id>
```

---

## 邊界

- 不改 `design/prototype/`、`docs/specs/`、`docs/specs/00-prd.mdx`、交付包
- 不重新設計、不提改版方案；待重新設計的只登記
- 不導入 shadcn 元件或前端主題；只做對照與差距
- 不自己回答 `design-gaps.md` 的待決問題
- 不截圖
- 產出只進 `design/system/`，屬**設計系統 PR**（見 `docs/development/spec-migration.mdx` §PR 的變更範圍）
- 不關閉、不修改 GitHub Issue 本身；要留言先問

## 輸出風格

繁體中文、條列為主、業務與介面語言。元件名與 token 名用原文（英文），不翻譯。對話中的回報簡短，細節寫在 `design/system/` 裡。
