# 產品測試用的範例資料與任務設定

這個目錄是**手動測試的素材**，從原始 repo 複製而來。它不是規格、也不是需求來源——規則一律以 [`docs/specs/`](../specs/) 為準。

同一層的 [使用者故事地圖](story-map.mdx) 不是測試素材：它把規格依使用者活動串成 story，並標出每個 story 屬於 [產品路線圖](roadmap.mdx) 的哪個 Epic。

## 出處（釘住版本，不是浮動引用）

| 項目 | 值 |
| :--- | :--- |
| 來源 repo | [`singyichen/label-suite`](https://github.com/singyichen/label-suite) |
| commit | `faf8335686863fdcf516a1c93ecd3aa49b40cf6d`（2026-11-04） |
| `example-data/` 目錄 tree | `8a84949848171d923e079d5b498aaabb948e23a1` |
| `task-configs/` 目錄 tree | `5038ce58bd6cd688782aeab78ea59ab76de29065` |
| 取得日 | **2026-11-17** |
| 複製方式 | 逐檔取用 GitHub Contents API 並**逐檔比對 git blob sha**，33 個檔全數相符 |

`faf8335` 與 [`design/system/handoff/manifest.json`](../../design/system/handoff/manifest.json) 的 `referenceDesignDocs` 釘住的是同一個 commit。

**要引用這裡的內容當事實之前，先重新比對來源。** 原始 repo 會動；本目錄是某一天的快照，不會自動跟著更新。

## 兩個目錄

### `task-configs/`（16 個）

任務型別設定。16 個檔裡有 **15 個**是 `{ task_category, input_type, typical_tasks, outputs[] }` 四個頂層鍵，`outputs[].config` 放該輸出型別的細節（例如 `single_label` 的 `label_options` 與色票）。

**例外是 `absa-va.json`**，它多兩個鍵：`cross_utterance: true` 與 `input_format: { type: "dialogue_sequence", … }`。它的 `input_type` 仍是 `single_item`，但那個 `input_format` 表示它要的是對話序列的呈現方式——只看下面那句 `input_type` 的通則會把這個設定裝錯。

這組檔是**原始專案**那個「設定」的長相，可以拿來理解硬性規則 5（**任務型別由設定驅動，新增一種不得改核心程式**）想保護的是什麼。本專案的 `backend/`、`frontend/` 都還不存在，**還沒有自己的設定契約**——所以它是參考，不是本專案的規格。

| `task_category` | 檔 |
| :--- | :--- |
| `classification` | `single-label`、`multi-label`、`multi-label-hierarchical`、`nli`、`review-flow-dry-run`、`review-flow-official-single`、`review-flow-official-multi` |
| `sequence` | `entity-recognition`、`relation-identification`、`sequence-tagging`、`medical-ner-re`、`absa-va` |
| `regression` | `single-dim`、`multi-dim` |
| `generation` | `free-text`、`mrc` |

`input_type` 除 `nli` 是 `item_pair` 外，其餘都是 `single_item`。

### `example-data/`（17 個）

範例資料集。**欄位依任務型別而異，沒有共通形狀**——`id`／`text` 這兩個欄位也不是每個檔都有（`mrc` 用 `article_id` 與 `question`，`nli` 用 `ID` 與 `Premise`／`Hypothesis`，`multi-dim` 用 `source`／`translation`）。

**答案欄位每個檔不一樣**，共 71 筆資料，逐檔實測如下（2026-11-17）：

| 答案欄位 | 檔 |
| :--- | :--- |
| `gold_label` | `single-label`、`review-flow-dry-run`、`review-flow-iaa-failed`、`review-flow-official-single`、`review-flow-official-multi` |
| `gold_labels` | `multi-label`、`multi-label-hierarchical` |
| `gold_entities` | `entity-recognition` |
| `gold_triplets` | `absa-va` |
| `gold_answer` | `free-text` |
| `gold_score` ／ `gold_scores` | `single-dim` ／ `multi-dim` |
| `answer` | `mrc` |
| `Label`（大寫） | `nli` |
| `spans` | `sequence-tagging` |
| `entities`、`triples`、`relation_types` | `medical-ner-re`、`relation-identification` |

**只有 5 個檔用 `gold_label`。**任何想「把答案欄拿掉」的程式都必須照這張表處理，只找 `gold_label` 會在 12 個檔留下標準答案。

檔名與 `task-configs/` **成對**，配成一組使用：`task-configs/<name>.json` 是設定，`example-data/<name>.json` 是餵給它的資料。

**唯一的例外**：`example-data/review-flow-iaa-failed.json` 在 `task-configs/` **沒有對應檔**。

它配哪一個設定，**本目錄無法回答**——來源 repo 沒有任何文件說明，資料本身也不指向特定設定（三個 `review-flow-*` 設定在 `task_category`、`input_type` 與 `label_options` 上完全相同，只差 `typical_tasks` 的敘述）。兩個可觀察到的事實供判斷：

- 它的 id 是 `oif-01`…`oif-05`，和 `review-flow-official-multi` 的 `ofm-01-reviewer-corrects-b`…**不是同一組資料**。
- IAA 至少需要兩位標記員才算得出來；`review-flow-official-multi` 的 `typical_tasks` 寫 **1 標記員**，`review-flow-dry-run` 寫 **3 標記員**。

所以要用它測試時，請自行決定載哪一個設定。**上一版的 README 曾斷言它沿用 `official-multi`，那是沒有依據的推測，已移除。**

## 標準答案與硬性規則 6

`example-data/` 的 **17 個檔、71 筆資料全部帶標準答案**（欄位名見上表）。

`AGENTS.md` 硬性規則 6 的原文是：

> **No test-set answer exposure** — anything an annotator can reach must never include ground-truth answers.

**規則沒有「在產品裡」這個限定。**而 `label-suite/label-suite` 目前是 **PUBLIC**，所以標註員打開 GitHub 就讀得到這些檔——不需要經過產品。照字面讀，這個目錄落在規則的範圍內。

**本目錄存在，是維護者 2026-11-17 在知情下的決定**，依據是：這些是原始 repo 已經公開發布的自撰示範資料（餐廳與電商評論之類），不是任何真實任務的測試集，所以洩漏的不是誰的評估基準。**這是風險接受，不是「規則不適用」**——不要把這段當成規則有例外。

兩條實際要守的線：

1. **不要把這裡的任一檔當成線上測試集的來源。**檔案本身就在公開 repo 裡，後端遮蔽擋不住這條路徑。
2. 真的要拿它們當測試集時，答案欄必須在送到標註員之前拿掉，而且要照上面那張表逐欄處理——那是後端的責任，不是靠這個目錄的擺放位置。

[Issue #383](https://github.com/label-suite/label-suite/issues/383) 要把本 repo 轉為私人；那之後第 1 條的理由會變，但規則本身不變。

## 和本專案其他東西的關係

- 規格以 [`docs/specs/`](../specs/) 為準；本目錄不定義任何規則。
- 畫面以 [`design/prototype/`](../../design/prototype/) 為準；本目錄不含任何畫面。
- 原始 repo 的 `design/system/` 在本專案是**參照，不是依據**（`.claude/skills/design-handoff/SKILL.md` 的**輸入表**，不是鐵律那三條）。本目錄沿用同樣的態度：它是素材，不是任何規則的來源。
