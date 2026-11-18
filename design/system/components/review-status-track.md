# Review Status Track

> 正典章節：`MASTER.md` §Review Status Track ｜批次 `b1-shared-account` ｜交付包 commit `b1fd43c`（正典定義在 showcase）

## 結構

7 欄 × 2 列的 grid，呈現**單一審核單位**的雙軌狀態。

| 部分 | 必填 | 依據 |
| :--- | :--- | :--- |
| `.review-track`（`display: grid`、`grid-template-columns: auto 28px auto auto 1fr 28px auto`、兩列各 34px、`role="list"`） | 必填 | `components-showcase.html:652`–`:658`、樣本 `:1221` |
| `.review-track-node`（`role="listitem"`） | 三個 | `:661`、樣本 `:1224`、`:1229`、`:1232` |
| `.review-track-fork`（分岔的 svg，`aria-hidden`） | 兩個（頭尾） | `:717`、樣本 `:1225`、`:1231` |
| `.review-track-branch[data-branch]` 軌道標籤 | 三個 | `:705`、樣本 `:1226`、`:1227`、`:1230` |
| `.review-track-rail`（軌道，`::before` 畫線） | 兩個 | `:687`–`:704`、樣本 `:1228`、`:1230` |
| `.review-track-marker`（`目前：` 文字前綴） | 當前節點必填 | `:686`、樣本 `:1229` |

## 變體

節點只有三個：**待審 → 已定稿**（上軌，答案未修改）與**待審 → 爭議中 → 已定稿**（下軌，答案有修改）。

正典把「為什麼只有三個」寫進了說明（`components-showcase.html:1212`）：自 issue `singyichen/label-suite#596` 起每個審核單位恰有一位審核員（annotation-015 FR-093），所以 `approved`／`modified` 這兩個「已作答但未達門檻」的中繼節點**結構上不可能發生**。同一段也寫明**不可改用線性 §Step Indicator**（annotation-015 FR-051），因為兩軌互斥。

## 適用狀態

| 狀態 | class | 依據 |
| :--- | :--- | :--- |
| 未到 | 無修飾（`--color-ink-muted` 文字、`--color-white` 底） | `components-showcase.html:659` |
| 已走過 | `.done`：邊框 `--color-cta`、底 `--color-success-bg`、字重 600 | `:674` |
| 目前 | `.current`：primary 色系、字重 600，另加 `目前：` 文字前綴與 `aria-current="step"` | `:680`、樣本 `:1229` |
| hover／focus／disabled／載入中／空 | 不適用，非互動元素 | `:653`–`:717` 無偽類 |

**不只靠顏色**是這個元件寫進說明的設計約束（`:1214`）：當前節點有文字前綴，走過的節點／標籤／軌道另以 `font-weight: 600` 與線寬加粗區分（rail 2px→3px，`:704`；fork 的 `stroke-width` 2→3，樣本 `:1225`）。

## token

`--color-border`、`--color-white`、`--color-ink-muted`、`--color-cta`、`--color-success-bg`、`--color-primary`、`--color-primary-strong`、`--color-primary-soft-bg`、`--radius-full`。**零寫死色值**；連 svg 的 `stroke` 都用 `var(--color-border)`／`var(--color-cta)`（樣本 `:1225`）。

## 鍵盤與焦點

不可聚焦。語意靠 `role="list"` ＋ `role="listitem"`（樣本 `:1223`、`:1224`）與 `aria-current="step"`（`:1229`）。分岔的 svg 是 `aria-hidden`。

軌道標籤（`.review-track-branch`）**沒有被任何 ARIA 關聯到節點上**，所以螢幕閱讀器讀到的是三個節點加三段散落的文字 → `../design-gaps.md` G-20。

## 樣式出處

`design/prototype/components-showcase.html:651`–`:715`。shipped 的那一份在 `pages/annotation/annotation-workspace.html:442`，註解寫明是「§Review Status Track -- CSS verbatim」。

## 可重現樣本

`components-showcase#state-default` → `#comp-review-track`（`components-showcase.html:1210`）：一個走在差異軌、目前停在「爭議中」的單位。

## shadcn 對照

沒有對應原語。shadcn 沒有 stepper／進度軌。

- **我們有而它沒有**：整個元件，尤其是**雙軌互斥**這件事。
- **它有而我們沒有**：無。
- **語意對不上**：常見的 stepper 元件庫都假設線性；本元件的說明特別寫了「不可改用線性 Step Indicator」，所以任何線性原語都不是候選。

## 用到它的畫面

| 畫面 | 怎麼用 |
| :--- | :--- |
| `components-showcase#state-default` | 差異軌、停在爭議中 |
| `annotation/annotation-workspace`（`#role-reviewer`、`#state-review-decision`） | `annotation-workspace.html:442`–`:463` 的 11 條規則與 `components-showcase.html:651`–`:715` **逐字相同**；`annotation-workspace.config.js:5547` 起算繪，節點帶 `aria-current="step"`（`:5557`） |

b3 已補上並核對（見上表）：那份 verbatim 屬實。
