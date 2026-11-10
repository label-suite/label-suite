---
title: 需求文件撰寫
description: 進入 OpenSpec 之前，怎麼用 prd-writing 寫 PRD、用 spec-writing 寫規格書：三層文件的分工、檔案結構與編號、撰寫方式、兩個 skill 的配合、待確認與衝突的處理，以及怎麼用 /sdd 交給 OpenSpec。
tags: [prd, spec, prd-writing, spec-writing, sdd]
---

# 需求文件撰寫

OpenSpec 的規劃產出是給 AI 和工程師看的技術文件。在那之前，需要 PM、研究人員、設計、工程、QA 都看得懂的需求文件，
把「為什麼做、誰能做什麼、系統擋什麼、怎樣算做完」講清楚。這份文件說明需求文件怎麼分層、放在哪裡、用哪個 skill 寫，以及寫完怎麼交給 OpenSpec。

skill 本身的完整規則在 `.claude/skills/prd-writing/`、`.claude/skills/spec-writing/`（Codex 讀 `.agents/skills/` 的同名副本）；
這份文件是給人看的入口，兩者說法不同時以 skill 為準，並回報給維護者修正這份文件。文件語法見 [notecraft-writing.md](notecraft-writing.md)。

## 三層文件

需求從粗到細分成三層，每一層回答不同的問題，由不同的 skill 或指令產生：

| 層 | 回答的問題 | 份數 | 產生方式 | 位置 |
| :--- | :--- | :--- | :--- | :--- |
| PRD | 為什麼做、給誰用、做到哪裡、模組怎麼串 | 一個專案一份 | `prd-writing` | `docs/specs/00-prd.mdx` |
| 規格書 | 誰能做什麼、操作後看到什麼、系統擋什麼、怎樣算做完 | 每個頁面或功能一份 | `spec-writing` | `docs/specs/NN-<module>/NN-<page>.mdx` |
| OpenSpec change | 技術上怎麼做：九份規劃與實作產物 | 每次變更一個 | **`/sdd`** | `openspec/changes/<name>/` |

兩條規則讓三層保持一致：

- **上層是下層的上限**：規格書的角色與權限不能比 PRD 寬，也不能碰 PRD 的範圍外；OpenSpec 不新增規格書沒有的功能
- **下層只引用、不抄寫**：規格書連到 PRD 的章節，OpenSpec 只寫「規格 06-01 §卡控機制」這樣的編號；需求要改，一律先改上游

`docs/specs/` 由維護者擁有，只寫業務面；OpenSpec change 不得更動其中的需求。技術細節（API、資料模型、權限實作，以及測試集答案不外露的系統端做法）
寫在 `openspec/specs/`，只能透過 change 的 spec delta 修改（見 `openspec/config.yaml` 的 `context`）。

## 檔案結構與編號

PRD 和規格書都放在 `docs/specs/`，由 NoteCraft 呈現：

```text
docs/specs/
├─ 00-prd.mdx                    PRD（prd-writing）；檔名固定，不是模組
├─ index.mdx                     規格總索引；其中 :::define{id="specs.module-map"} 是模組地圖
├─ glossary.mdx                  術語表：每個業務名詞一個 :::define{id="term.xxx"}
├─ legacy/                       搬移舊規格時擷取的舊編號清單（NN-NN-<page>.ids）
└─ 06-admin/                     模組資料夾 NN-<module>
   ├─ index.mdx                  模組索引：頁面一覽與撰寫狀態
   └─ 01-user-management.mdx     規格書 NN-<page>.mdx
```

| 規則 | 說明 |
| :--- | :--- |
| 編號 | 模組 `NN`、頁面 `NN-NN`，兩位數；模組從 `01` 起（`01-account` 到 `07-shared`），`00-prd.mdx` 不算模組 |
| 引用格式 | 規格寫 `規格 06-01`，指到章節寫 `規格 06-01 §卡控機制`；PRD 寫 `PRD §使用者角色`，不用編號。在 `docs/` 裡一律寫成連結 |
| 不重排 | 新增一律接在最後，既有編號不重排，避免引用失效 |
| 預留 | PRD 先在模組地圖列出還沒寫的頁面（有編號、沒有連結，標「未撰寫」），spec-writing 寫到時沿用編號並補上連結 |

### 只維護一份：define、include、ref

同一份內容只寫在一個地方，其他地方用 NoteCraft 的定義與引用嵌進來：

| 內容 | 定義在 | 怎麼用 |
| :--- | :--- | :--- |
| 模組地圖（模組與頁面清單） | `docs/specs/index.mdx` 的 `:::define{id="specs.module-map"}` | PRD 用 `::include{id="specs.module-map"}` 整塊嵌入 |
| 業務名詞與角色 | `docs/specs/glossary.mdx` 的 `:::define{id="term.xxx"}` | PRD 與規格用 `:ref[名詞]{id="term.xxx"}` 連結，例如 `:ref[專案負責人]{id="term.project-leader"}` |
| 跨模組流程、共用狀態機 | PRD §模組架構與串接 | 規格的業務流程用一般連結指過去，不重寫 |
| 畫面 | `design/prototype/pages/` | 規格用 `PrototypeFrame` 嵌入，不另畫 wireframe |

各檔案由誰維護：

| 檔案 | 用途 | 維護 | 不寫 |
| :--- | :--- | :--- | :--- |
| `00-prd.mdx` | 專案全貌（七章） | `prd-writing` | 欄位、畫面、技術 |
| `index.mdx` | 規格總索引與模組地圖 | `prd-writing`（模組劃分）、`spec-writing`（新增頁面、補連結） | 撰寫狀態（在模組索引） |
| `glossary.mdx` | 業務名詞與角色定義 | 兩者都會新增名詞 | 系統怎麼存 |
| `NN-<module>/index.mdx` | 模組的頁面一覽與撰寫狀態（草稿／已定案） | `spec-writing` | — |
| `NN-<module>/NN-<page>.mdx` | 一個頁面的業務規格 | `spec-writing` | API、資料表、元件 |

## 用 prd-writing 寫 PRD

PRD 是整個專案的全貌，一個專案一份，寫好之後隨需求維護。目前的 PRD 是 [00-prd.mdx](../specs/00-prd.mdx)，狀態為定稿。

### 提示詞範例

| 情境 | 說法 | skill 會做什麼 |
| :--- | :--- | :--- |
| 修改 | `修改 PRD：審核員也可以匯出標記結果` | 先列出和既有內容衝突的地方再提問，最後回報哪些規格要跟著改 |
| 修改 | `修改 PRD：新增通知模組，任務指派與審核退回時通知相關成員` | 更新模組地圖、Site Map、權限矩陣與跨模組流程 |
| 依 Issue | `依 Issue #N 修改 PRD` | 用 `gh` 讀 Issue 的描述與所有評論，用 `<mark>` 標出這次的改動；提交後先給你看留言全文，同意才在 Issue 留言 |
| 檢查 | `檢查 PRD 和規格書是否一致` | 只讀不寫，用表格列出差異後再問要不要修 |

### 三種模式

| 模式 | 什麼時候 | 做什麼 |
| :--- | :--- | :--- |
| 新建 | `docs/specs/00-prd.mdx` 還不存在 | 依素材或訪談產出七章；模組地圖寫進 `index.mdx` |
| 修改 | 角色、權限、範圍、模組劃分或跨模組流程有變動（口述或 GitHub Issue） | 只改受影響的段落，依 Issue 修改時用 `<mark>` 標出改動；回報連帶影響的規格 |
| 檢查 | 想確認 PRD 和規格書是否還對得上 | 完成度和內文的待確認是否一致、Site Map 和模組地圖是否一一對應、規格的角色有沒有超出權限矩陣或碰到範圍外 |

### 七個章節

| # | 章節 | 寫什麼 | 不寫什麼 |
| :--- | :--- | :--- | :--- |
| 1 | 文件資訊 | 基本資訊、章節完成度（已完成／暫定／待確認／待生成） | — |
| 2 | 專案概述 | 問題背景；目標寫成「讓誰達成什麼」並附衡量方式 | 「更好用」這類無法驗證的形容詞 |
| 3 | 使用者角色 | 角色清單（連到術語表）、權限矩陣 | 每個按鈕誰看得到 |
| 4 | 專案範圍 | 範圍內、範圍外（附原因）、假設與限制 | — |
| 5 | Site Map | 頁面階層與可存取角色，附互動圖 | 頁面裡的區塊與欄位 |
| 6 | 模組架構與串接 | 模組地圖（嵌入）、跨模組流程（模組泳道）、共用狀態機、模組依賴 | 模組內的操作步驟 |
| 7 | 術語 | 一句話指到術語表 | 名詞定義本身 |

技術選型、非功能需求、時程與變更紀錄都不寫在 PRD：技術在 `AGENTS.md` 與 `openspec/config.yaml`，歷史看 git。

### 三張互動圖

PRD 的三張圖都從 `prd-writing` 的骨架複製、只換資料：

| 圖 | 互動 | 什麼時候畫 |
| :--- | :--- | :--- |
| Site Map | 角色篩選（進不去的頁面壓暗）、點頁面看入口與權限 | 一律要有 |
| 跨模組流程 | 以**模組**為泳道，逐步走查每次交接、例外與替代路徑 | 有兩個以上模組互相交接時 |
| 共用狀態機 | 依模組篩選轉移、點狀態看進出條件；待確認的轉移畫黃色虛線 | 有實體被兩個以上模組推進狀態時 |

骨架與檢查清單在 `.claude/skills/prd-writing/references/visualize.md`，視覺化規範見 [notecraft-visualize.md](notecraft-visualize.md)。

## 用 spec-writing 寫規格

規格書一份只寫一個頁面或功能，是 `/sdd` 的預設需求依據。說「幫我寫規格：」後面接需求描述、文件路徑或網址；
需求變更來自 GitHub Issue 時，直接給 Issue 編號。範例規格是 [06-01 使用者管理](../specs/06-admin/01-user-management.mdx)。

### 提示詞範例

| 情境 | 說法 |
| :--- | :--- |
| 寫 PRD 預留的頁面（沿用預留的編號） | `寫規格 01-01 登入：Email 與密碼登入，含 Google SSO 入口` |
| 修改既有規格 | `修改規格 06-01：停用帳號時要填寫停用原因` |
| 依 Issue 修改 | `依 Issue #N 修改規格 06-01`；不確定改哪一份時只給 Issue，skill 會依內容找出相關規格再請你確認 |
| 搬移舊規格 | `搬移舊 repo 的 specs/NNN-xxx/spec.md 到規格 NN-NN` |

搬移舊規格前先讀 [spec-migration.md](spec-migration.md)：那份文件記下這一批 17 頁的來源對照、不搬的來源與理由、
十條跨頁決議（輸出類型、異名統一、廢止條文怎麼判），以及待釐清要同步到哪裡。各頁不自行決定這些事。

skill 會先讀 PRD 確認角色與範圍，再判斷是新增還是修改；修改時會列出和既有決議衝突的地方，以及引用這份規格、可能要跟著改的其他規格。

依 Issue 修改和常規修改的差別：

- 用 `gh issue view <N> --json number,title,url,body,comments` 讀描述與所有評論，記下 Issue 編號與網址
- 先清掉上一次的變更標示，再用 `<mark>` 加上連到 Issue 的上標標出這次所有改動，頁首加 `:badge[變更 #N]`
- 「變更紀錄」最上面新增一列，寫原本與修改後
- 提交後先給你看留言全文，同意才在 Issue 留言；不關閉 Issue

Issue 也動到角色、權限、範圍或模組時，先說「依 Issue #N 修改 PRD」，再修改規格。

### 撰寫步驟

| # | 步驟 | 做什麼 |
| :--- | :--- | :--- |
| 1 | 收集輸入 | 提示詞、文件、網址、`design/prototype/pages/` 的頁面、舊規格或 GitHub Issue |
| 2 | 盤點現況 | 讀 PRD 的角色、範圍、Site Map 與模組地圖，確認落在哪個模組與預留頁面；再讀總索引、術語表與相關規格，判斷新增還是修改 |
| 3 | 確認範圍與大綱 | 放哪個模組、要不要拆成多份、「規格」章節的大項、要寫哪幾段業務流程 |
| 4 | 追問模糊處 | 依追問清單逐章檢查，用選擇題提問並附建議選項；答不出的選「先列入待釐清」 |
| 5 | 撰寫 | 依範本撰寫；每條卡控、邊界情況、替代與例外流程都要有對應的驗收 Scenario |
| 6 | 自我檢查 | 掃過技術用語黑名單、檢查連結與錨點、Scenario 對應 |
| 7 | Prototype 與流程圖 | 「規格」章節每個大項以 `PrototypeFrame` 嵌入 prototype 頁面開頭（不需詢問）；業務流程附泳道流程圖（以**角色**為泳道），詢問要不要現在生成 |
| 8 | 更新索引、驗證與提交 | 更新模組索引與模組地圖，跑 `pnpm check:specs` 與 `pnpm exec notecraftapp build docs`；詢問是否 commit，依 Issue 修改時再詢問是否在 Issue 留言 |
| 9 | 回報 | 狀態、待釐清、自行假設、連帶影響與下一步 |

`PrototypeFrame` 的寫法（`page` 是 `design/prototype/pages/` 底下的路徑，不含 `.html`）：

```mdx
import PrototypeFrame from '@notes/components/prototype-frame';

### 使用者管理

<PrototypeFrame page="admin/user-management" caption="使用者管理" client:idle />
```

找不到對應 prototype 頁面的大項不嵌入，改在「待釐清」新增一題說明缺哪個頁面；預覽方式見 [Prototype](../prototype/index.mdx)。

### 規格書的章節

| 章節 | 回答的問題 | 必要 |
| :--- | :--- | :--- |
| 目標 | 為什麼要做？誰受益？ | 是 |
| 使用角色 | 誰能看、新增、編輯、刪除（R／C／E／D）？ | 是 |
| 業務流程 | 從誰開始、經過誰、在哪分岔、結束在哪？ | 是，不適用要寫原因 |
| 規格 | 有哪些功能、操作後系統怎麼回應、資料欄位？ | 是 |
| 卡控機制 | 系統擋什麼？寫成「條件 → 結果」 | 是，沒有要寫原因 |
| 邊界情況（Edge Case） | 空狀態、極值、跨期、並發、載入失敗時使用者看到什麼？ | 是 |
| 驗收標準 | 怎樣算做完？每個 Scenario 只有一個 When | 是 |
| 待釐清、已確認決議 | 還沒決定的事；追問過的決議與理由 | 有才寫 |
| 變更紀錄、Q&A | 因哪個 Issue 改過；規則背後的理由 | 變更紀錄必寫 |
| 附錄：舊編號對照 | 舊規格的每個 `FR`／`AC`／`SC` 搬到哪裡 | 搬移舊規格時必寫，`pnpm check:specs` 會檢查 |

待釐清清空後，規格的狀態從「草稿」改成「已定案」，才能進 `/sdd`。
還有未決的待釐清時**不要硬進**：`sa` 會把它記成 `system-analysis.md` 的待決問題帶到停點一，但那是給「規格本來就有缺口」用的逃生門，不是跳過定案的捷徑。

測試集保護（`AGENTS.md` Hard Rules 6）是「只寫業務」唯一的例外：涉及標準答案的頁面，規格用業務語言寫明「標記員能接觸到的任何地方都看不到標準答案」，
並寫出對應的卡控與 Scenario；系統端怎麼做到不寫在規格，留給 OpenSpec change 的 design 與 spec delta。

## 兩者怎麼配合

判斷用哪個 skill 的原則只有一條：**動到角色、權限、範圍、模組劃分或跨模組流程，就是 PRD 的事；只動單一頁面的操作、欄位、卡控，就是規格的事。**
兩者都動到時，先改 PRD，再改規格。

| 情境 | PRD | 規格書 | OpenSpec |
| :--- | :--- | :--- | :--- |
| 寫預留的頁面 | 不需要 | 新增（沿用預留編號，補上模組地圖的連結） | `/opsx:propose` |
| 加一個未預留的頁面 | 補 Site Map 與模組地圖 | 新增 | `/opsx:propose` |
| 加一個模組 | 修改：模組地圖、Site Map、權限矩陣、跨模組流程 | 撰寫新模組的頁面 | `/opsx:propose` |
| 改角色或權限 | 修改：權限矩陣，回報連帶影響的規格 | 逐份修改受影響的規格 | 依 change 階段 |
| 依 Issue 修改需求 | 動到 PRD 層級時先修改 | 依 Issue 修改並標示 | 依 change 階段 |
| change 進行中需求改變 | 必要時修改 | 修改 | `/opsx:update` |

「依 change 階段」：還沒有 change 就 `/opsx:propose`；change 已建立、還沒歸檔就 `/opsx:update`；change 已歸檔就開新的 change，不重開舊的。

## 待確認與衝突

### 問題記在哪裡

PRD 不設待釐清專章，規格書的「待釐清」也只放這一頁自己的事。一個問題依「決議後要改哪裡」記在一個地方，其他地方只放連結：

| 情況 | 記在哪裡 | 例子 |
| :--- | :--- | :--- |
| 決議會改到 PRD（角色、權限、範圍、模組劃分、跨模組流程） | PRD 對應段落：`:badge[待確認]` 加 `:::warning` callout，寫問題、選項、建議與需要決定的人；§文件資訊 的章節完成度標「待確認」 | 審核員要不要能匯出標記結果？ |
| 有主責模組 | 主責模組那份規格的「待釐清」；其他規格用錨點連過去 | 異動紀錄要保留多久？（主責 06-01） |
| 需要討論、指派或追蹤 | GitHub Issue；文件裡只放 Issue 連結，決議後依 Issue 修改 | Google SSO 要不要限定組織網域，需要 IT 評估 |

判斷順序：先問「決議會改到 PRD 嗎？」，是就記在 PRD；否再問「有明確的主責模組嗎？」，有就記在該規格，沒有也記在 PRD（主責不明本身就是模組劃分的問題）。
要不要開 Issue 是另一個獨立的判斷，開了也只是把連結放進上面那一處。

決議後：PRD 移除 callout、把結論寫進正文，並通知連帶影響的規格；規格把問題搬到「已確認決議」，保留問題、結論與理由，全部清空後狀態改為「已定案」。

### 衝突一律提問

兩個 skill 都不會替你選邊。遇到以下衝突，會把兩邊的來源與說法都寫進問題裡，再給建議選項：

- **輸入之間**：兩份參考資料，或同一份資料前後說法不同
- **輸入和既有文件**：這次的需求推翻 PRD 或規格既有的決議
- **輸入和設定**：角色或範圍和 `AGENTS.md` 的 Hard Rules（例如測試集答案不外露、任務類型由設定驅動）、`openspec/config.yaml` 對不上
- **連帶影響**：改 PRD 會讓既有規格的角色超出權限矩陣，或碰到新的範圍外

提問的格式固定：每題 2～4 個建議選項，最推薦的放第一個並標 `(Recommended)`，選項說明寫出對業務與既有規格的影響；
衝突題至少有「以 A 為準」「以 B 為準」兩個選項；每題都可以選「先標為待確認」（規格是「先列入待釐清」）或自己輸入。

純措辭、排版這類不影響範圍、權限與驗收結果的細節不會提問，skill 會自行處理，並在回報的「自行假設」列出來給你確認。

## 接到 OpenSpec

### 進入 OpenSpec 前：先寫規格書

規格的狀態是「已定案」、待釐清清空後，才開 change。`openspec/config.yaml` 的 `context` 已把 `docs/specs/` 設為預設需求依據，所以一般只要：

```text
/sdd add-user-management（依規格 06-01）
```

也可以不寫編號，用需求描述讓 agent 自己找；或另外指定其他文件，指定的文件會和 `docs/specs/` 一起當依據：

```text
/sdd add-login 依規格 01-01，另外參考 docs/meetings/2026-11-04.md 的 SSO 需求
```

開 change 之前，`AGENTS.md` 的 Issue first 一樣適用：先有列出工作項目的 open Issue，再開分支與 change。

**`/sdd` 一次授權規劃與實作，中間只停兩次**（授權範圍與邊界見 `AGENTS.md` §SDD Workflow）：

| 停點 | 在哪裡 | 停下來做什麼 |
| :--- | :--- | :--- |
| **一** | `clarification.md` 寫完（proposal 之後、specs 之前） | 需要維護者決定的項目（Q）逐題問完。明確問題（P）直接派原撰寫角色回修，**不問** |
| **二** | apply 全部完成、`acceptance-verifier` 產出 `acceptance.md` 之後 | 維護者照報告裡的**人工驗收步驟**親自驗，確認無誤才下 `/opsx:archive` |

其餘環節不問。但**故障不是關卡、故障照停**：task 描述有歧義、實作中發現規格有問題、工作超出 `tasks.md` 的範圍、指令出錯——那些代表規劃錯了，會停下來回報。

只想做規劃、不要接著實作時，照舊用 `/opsx:propose`——那個 skill 的 planning boundary 明文只授權規劃，產物完成就停。

### 規格書怎麼對到 OpenSpec 產出

本專案的 OpenSpec schema 是 **`label-suite-sdd`**（`openspec/schemas/label-suite-sdd/`），change 產出**九份**。
文件或工具類的小 change 可以帶 `--schema spec-driven` 走四份產物的舊流程（維護者 2026-11-04 裁定保留這個逃生門）。

| 規格書 | OpenSpec 產出 |
| :--- | :--- |
| 目標、使用角色 | `system-analysis` 的需求依據與範圍（它**只引用** PRD §權限矩陣、不抄一份）；角色真正落地在 `system-design` §權限檢查點、`api-contract` 每個端點的角色、`ui-design` 的「無權限」狀態；`proposal` 的 Why 與影響範圍 |
| 業務流程 | `system-analysis` **引用**規格書的業務流程章節，不重畫；跨規格、跨模組的串接才在那裡補一張圖 |
| 規格（功能、欄位、`PrototypeFrame` 畫面） | `ui-design` 的頁面、路由與元件樹；`system-design` 的分層與資料模型異動；`api-contract` 的端點與欄位；`tasks` 的實作項目 |
| 卡控機制、邊界情況 | spec delta 的 Requirement 與 Scenario；`api-contract` 的錯誤碼與觸發條件；**`ui-design` 的 loading／error／empty／無權限四種狀態**；`design` 的 Risks／Trade-offs |
| 驗收標準 | spec delta 的 Scenario，**沿用規格書的 Scenario 名稱**；`system-design` 每個關鍵 Scenario 一張 Sequence Diagram；`acceptance-verifier` 逐條驗收 |
| 待釐清 | 必須清空才開 change。真的有缺口時由 `system-analysis` 的待決問題帶到停點一 |
| 已確認決議 | 當成已定事項沿用，**不在 change 裡重新討論**（`clarify` 第 4.1 個面向會檢查這一點） |

delta 裡的每條 requirement 都要追溯到規格書，註明規格編號與 Scenario 名稱，例如「來源：06-01 停用登入中的帳號」。
delta 和 `docs/specs/` 不一致時以 `docs/specs/` 為準：agent 會停下來，把衝突列成問題請維護者回答，不自行選邊。

### 需求要改，先改規格書

OpenSpec 只引用規格的編號與章節，不另抄一份需求。開了 change 之後發現需求要調整：

1. 動到角色、權限、範圍或模組，先用 `prd-writing` 改 PRD
2. 用 `spec-writing` 修改規格書
3. 依 change 的階段：還沒歸檔就 `/opsx:update <change 名稱>` 讓規劃產出跟上；已歸檔就開新的 change

不直接改 `openspec/` 裡的規劃產出來代替修改規格，否則兩邊會對不上。

## 常見問題

**PRD 和規格書各要寫到多細？**
PRD 寫到「有哪些頁面、誰進得去、模組之間交接什麼」為止；只要開始寫欄位、按鈕文案、提示文字或某一頁的操作步驟，就是規格書的範圍，改成連到規格。
規格書寫到「使用者看到什麼、能做什麼、系統擋什麼」為止，不寫 API、資料表與元件。

**Site Map 和模組地圖有什麼不同？**
Site Map 是使用者視角：有哪些頁面、從哪裡進去、哪個角色進得去。模組地圖是業務能力視角：有哪些模組、每個模組底下有哪些規格、各自的編號。
兩者的頁面要一一對應，`prd-writing` 的檢查模式會比對。

**PRD 的跨模組流程和規格的業務流程有什麼不同？**
跨模組流程以**模組**為泳道，只畫模組之間的交接；規格的業務流程以**角色**為泳道，只畫這一頁裡誰做了什麼、系統怎麼回應。
流程跨到其他模組時，規格只放連結到 PRD，不重寫交接。

**畫面要畫 wireframe 嗎？**
不用。畫面以 `design/prototype/` 為準，規格用 `PrototypeFrame` 嵌入；規格只寫規則，畫面和規格不一致時列入待釐清，不由 spec-writing 改 prototype。

**規格書要改，可以直接改 `openspec/` 裡的檔案嗎？**
不行。先用 `spec-writing` 改規格，再用 `/opsx:update` 讓規劃產出跟上。
