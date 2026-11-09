# 搬移舊 repo 規格到 docs/specs/ — 設計文件

- 日期：2026-11-04
- 狀態：待維護者核可
- 來源 repo：`singyichen/label-suite`（`specs/`，main 分支）
- 目標：`label-suite-oss` 的 `docs/specs/`

## 意圖

舊 repo 的 `specs/` 有 22 份以 `FR-NNN`／`AC-N.N`／`SC-NNN` 編號的規格，混著業務規則與技術設計，單份最大 962KB。
本專案已經改採三層文件分工（PRD → 規格書 → OpenSpec），規格書由 `spec-writing` skill 產生、只寫業務。
這件事要把舊規格的業務需求一條不漏地搬進新結構，讓 `/opsx:propose` 有可用的需求依據。

目前 18 頁裡只有 `06-01 使用者管理` 完成，剩 **17 頁**。

### 為什麼不是一頁一頁慢慢問

維護者的時間是瓶頸，不是撰寫本身。`06-01` 一頁產出 8 條「已確認決議」、分兩天決定；17 頁照比例是一百題上下。
如果每頁都卡在互動追問，整件事會拖成十幾次獨立的 session。

所以改成兩段：**跨頁的地基決策先一次問完**（已完成，見下方「本局決議」），**單頁的決策全部寫進各頁「待釐清」**，
維護者有空時從一份彙總清單往下掃，掃完再跑第二輪把答案折回規格、狀態改「已定案」。

## 目標

1. 舊 repo 每一份業務規格的每一條 `FR`／`AC`／`SC` 都有新位置或明確的刪除理由，`pnpm check:specs` 可驗證。
2. 17 頁都產出至少「草稿」等級的規格，維護者能一次看到全貌、而不是等十幾次 session。
3. 所有需要維護者決策的點集中在一份清單，可以零碎時間處理。
4. 新規格只寫業務，通得過 `spec-writing` 的「技術用語黑名單」與步驟 6 自我檢查。

## 非目標

- 不寫技術設計、資料庫設計、API 設計、元件拆分（那是 OpenSpec 的 design 與 spec delta）。
- 不改 `docs/specs/00-prd.mdx`（PRD 已定稿；要動 PRD 時回報並建議用 `prd-writing`）。
- 不改 `design/prototype/`；畫面與規格不一致時列入待釐清。
- 不搬舊 repo 的技術規範（見「不搬的來源」）。
- 不在這件事裡做實作，也不開 OpenSpec change。

## 反目標（做到了也算失敗）

- **靜默遺漏**：17 頁都寫完了，但某些舊 `FR` 沒有新位置也沒有刪除理由。這比沒搬更糟，因為之後沒人會回頭查。
- **腦補成定案**：把我的建議寫成「已確認決議」，讓維護者以為那是他決定的。待釐清的事一律標成待釐清。
- **跨頁矛盾**：17 份草稿各用一套名詞，角色名稱或任務狀態前後不一致，`:ref` 與 `規格 NN-NN` 連結斷掉。
- **規格裡留技術語言**：直接把舊 spec 的 `TASK_STATUS_ENUM`、路由、斷點 px 值搬進新規格。

## 約束

- `AGENTS.md` 全部硬性規則，特別是：Issue first、不 commit 到 `main`、不做版本號變更、測試集答案不得外露。
- 語言：`docs/` 允許繁體中文；規格內文一律繁體中文、全形標點。
- 流程：一律照 `spec-writing` skill 的步驟與鐵律，本文件只在「步驟 4 的追問改成寫入待釐清」這一點上調整它，其餘不改。
- 工具鏈：`pnpm check:specs`、`pnpm exec notecraftapp build docs`（需 Node 22 以上）可用；
  但 `scripts/check-specs.mjs --extract-legacy` 目前有三個缺陷，必須先修（D9），否則「一條不漏」這個目標無法成立。

## 本局決議（維護者 2026-11-04 拍板）

這八條是 17 份草稿的地基，各頁不得自行推翻；要推翻時回報維護者。

| # | 問題 | 決議 | 理由 |
| :--- | :--- | :--- | :--- |
| D1 | `shared/018-help-button` 要不要搬 | **不搬** | PRD §範圍外明寫「說明按鈕（平台說明入口）：最新的 prototype 沒有這個入口，這期不做」 |
| D2 | `account/001` + `002` 併成一頁還是分兩頁 | **併成 01-01** | PRD Site Map 寫「登入，含 Google SSO 入口」是同一頁 |
| D3 | 任務「要產出什麼」用哪一套業務名詞 | **以「輸出類型」8 種為主**；「任務類型」退役，不再是業務名詞 | prototype 的 partials 檔名已全部採用這一套；舊 013 是 `OUTPUT_TYPE_KEYS` 的 source of truth；PRD 也寫「任務類型完全由任務設定決定」 |
| D4 | `foundation/000~002` 與 `_governance/` 怎麼處理 | **整份不搬**，但先挑出其中屬於業務的規則併進 `07-01 側欄導覽`，並在 07-01 的舊編號對照列出來源 | 那些是技術與 CI 規範，屬 OpenSpec 範疇；但語言切換、通用錯誤呈現是 PRD 範圍內的業務規則，不能無聲遺漏 |
| D5 | 來源 spec 狀態不一致（`in-progress`、同值異名未統一）怎麼辦 | **一律以 main 分支現況為準**；三組同值異名各自統一成一個中文業務名詞，並在該頁「已確認決議」記下採用哪一個與理由 | 草稿可以一次跑完，之後不必回頭重讀來源 |
| D6 | 業務流程圖何時生成 | **草稿只留 `@ai-visualize` 標記（`status: pending`）與完整 prompt，不生成元件**；該頁定案後再生成 | 待釐清一有答案，流程步驟與對應的 Scenario 就會變，先生成等於白做一次 |
| D7 | 待釐清從哪裡掃 | **一頁彙總清單** `docs/specs/open-questions.mdx`，各頁原生「待釐清」章節照 skill 保留 | 維護者開一個檔就能一路往下決定，不用開 17 個檔 |
| D8 | 撰寫順序 | **07 → 01 → 03 → 04 → 05 → 06-02 → 02** | 07 是所有頁的外框且要收 foundation 的業務規則；03 定下任務設定與 8 種輸出類型；02 儀表板讀其他模組的結果，放最後最準 |
| D9 | `--extract-legacy` 認不出來源實際用的編號形狀 | **先修 `scripts/check-specs.mjs`**，開一個前置 `[Bug]` child，附單元測試；17 頁在它合併後才開始 | 現行 regex 在 `annotation/015` 一份就漏 226 條（實測 254／480）。不修就等於接受第一條反目標 |
| D10 | `admin/007` 的 17 個權限鍵算不算超出已定稿的 PRD | **算合法**，視為在 PRD §權限矩陣上限內的細化：改寫成中文業務權限名詞進術語表，每一個都要對得上矩陣的某一格、不放寬 | PRD 那張表是粗粒度上限，不是權限鍵的窮舉；`06-01` 已經用中文權限名引用過其中兩個 |

### D3 的中文名稱

> **2026-11-06 維護者裁定**：容器名詞一律用「**輸出類型**」。
> 在這之前本文件與規格 07-01 寫的是「輸出型別」，而畫面與全部舊來源 `spec.md` 寫的是「輸出類型」，兩個名字並存。裁定選了後者，所以改的是規格這一側（327 處、11 個檔案，見 [Issue #131](https://github.com/label-suite/label-suite/issues/131)），`design/prototype/` 不動。
> 術語表的 `term.output-type` 只改 `label`，**`id` 不動**。這一條**不影響**下面講的 8 個中文名稱——那是 03-02 Q10 另外定的。

8 種輸出類型的英文鍵（`sequence_tagging`、`entity_recognition`、`relation_identification`、`single_label`、`multi_label`、`single_dim`、`multi_dim`、`free_text`）
要對應 8 個中文業務名詞並進術語表。`03-02 新增任務` 是定義它們的那一頁，由它定名、其餘頁面 `:ref` 引用。
`03-02` 已經把這 8 個名稱定案（見該頁 §已確認決議 Q10，依據是來源自己三處已拍板的條文）；規格 03-01 Q4 仍在等那個答案折回；07-01 Q6 已於 2026-11-08 獨立定案（整條移除側欄的類型沿用機制），不再依賴它。

### D5 的三組同值異名

| 舊異名 | 統一後 | 影響頁面 |
| :--- | :--- | :--- |
| `TASK_STATUSES`（014）／`TASK_STATUS_ENUM`（010） | 用 PRD §共用狀態機的五個中文狀態：草稿、試標中、等待 IAA 確認、正式標記中、已完成 | 03-01、03-03、02-01 |
| `RUN_TYPES`（015）／`RUN_STAGE_ENUM`（010） | 用術語表現有的 `term.dry-run`（試標）與 `term.official-run`（正式標記） | 03-03、04-01、04-02 |
| `IAA_SUMMARY_STATES`（017）／`IAA_BADGE_STATES`（016） | 統一一組中文 IAA 狀態名詞，含 017 v2.0.0 新增的 `not_applicable` | 05-01、05-02 |

前兩組 PRD 與術語表已經定好，直接用；第三組由 `05-01 分析列表` 定名，列入該頁待釐清。

### D9 要修的三個缺陷

全部在 `scripts/check-specs.mjs`。前置 `[Bug]` child 的工作項：

| # | 缺陷 | 現況 | 要改成 |
| :--- | :--- | :--- | :--- |
| 1 | 編號形狀 | `ID_SOURCE = (?:FR\|SC)-\d{2,3}[A-Za-z]?\|AC-\d+(?:\.\d+)+` 認不出 `AC-2A.1`、`AC-2A.2a`、`AC-3.1A`、`FR-0010`、`FR-024A-1`、`FR-004aa` 等形狀 | 擴充到涵蓋來源實際用過的所有形狀。`ID_RE` 與 `LEGACY_DEF_RE` 共用同一個來源，兩邊一起生效 |
| 2 | 定義標頭帶版本註記 | `LEGACY_DEF_RE` 要求粗體內容剛好是編號，所以 `**AC-1.10（v3.0.0 新增，v4.2.0 廢止）**` 這種定義整條漏掉 | 允許編號後接括號註記 |
| 3 | 跨頁與多來源 | 對照表的「新位置」只接受本頁章節連結、`Scenario：<名稱>`、`刪除`；`.ids` 是純字串集合，分不出同名編號屬於哪一份來源 | 新增「跨頁目標」（讓 04-01／04-02 能寫「見 §規格 04-0X」）與「來源前綴」（讓 07-01 能區分 `shared/008` 與 `foundation/000` 的 36 個同名編號） |

修完要重跑一次 `06-01` 的既有對照表，確認 46／46 仍然通過、沒有回歸。

修好之後對照表多兩種合法的寫法，各頁照用（`spec-writing` 的「搬移舊規格」同步記了）：

| 情況 | `舊編號` 欄 | `新位置` 欄 |
| :--- | :--- | :--- |
| 一份來源拆兩頁（04-01／04-02） | 照原樣 | `見 規格 04-02`；指向不存在的規格或指向自己時 `check:specs` 失敗 |
| 一頁收兩份來源（07-01） | 加來源前綴：`shared:FR-001`、`foundation:FR-001` | 照原樣 |

**實測基準**（修完後用來驗證，數字應該只增不減）：

| 來源 | 現在擷出 | 粗體定義實際有 |
| :--- | :--- | :--- |
| `annotation/015` | 254 | 480 |
| `shared/008` | 99 | — |
| `foundation/000` | 177 | — |
| `admin/006`（已完成的 06-01） | 46 | 46（全中） |

`shared/008` 與 `foundation/000` 之間有 36 個字串完全相同的編號，是缺陷 3 的直接成因。

### D10 的落地方式

- 17 個權限鍵各自改寫成一個中文業務權限名詞，進 `glossary.mdx`；`06-01` 已引用的「進入使用者管理頁」「新增／編輯／停用使用者、指派系統角色」沿用、不改名。
- 每個權限名詞在 `06-02` 的規格裡標明它對應 PRD §權限矩陣的哪一格，不得放寬。
- 兩處落位不一致各列一題待釐清，不自行決定：
  1. 來源把匯出放在 `dataset.export`，PRD 放在「03 匯出標記結果」。
  2. PRD 給專案負責人「05 資料匯入與版本 R/C」，但來源沒有對應的權限鍵。
- 如果細化過程發現某個權限鍵在 PRD 矩陣找不到任何一格對應，那才是真的超出 PRD：該鍵列入待釐清並在回報裡列為 PRD 連帶影響，不自行加進矩陣。

### 已廢止的舊條文怎麼處理

來源有大量自我廢止條文（`annotation/015` 光粗體定義就有 77 條標「廢止」，`013`、`014` 也有），而且來源的 changelog 明寫過「條文原文不刪除、僅加刪除線」。規則：

1. 標「廢止」「已取代」或加刪除線的條文，**判 `刪除` 之前一定要讀過該條**。
2. 條文的業務規則被後續版本的條文承接 → 對到承接它的新位置，不判 `刪除`；「說明」寫「來源 vN 廢止，規則由 FR-NNN 承接」。
3. 確認整條都不再適用 → 判 `刪除`，「說明」寫「來源 vN 已廢止」。
4. 不得整批判 `刪除` 而不讀；這是第一條反目標最容易破功的地方。

### 技術用語黑名單的例外

依 `references/writing-guide.md`「技術用語黑名單」的例外條款（「業務上真的叫這個名字可以保留，第一次出現時在術語表說明」）：

- `JSON` 資料集與 `JSON`／`JSON-MIN` 匯出格式是 PRD §範圍內指名的業務格式，**可以保留**，第一次出現時進術語表。影響 03-02、03-03、05-03。
- `01-05` 的 `session`／`token` **不適用例外**，一律改寫成 PRD 用的業務說法「登入狀態」。
- 驗收第 4 條因此不是字面零命中：Grep 命中時要逐條判定是例外還是該改寫，自我檢查時把判為例外的命中列在回報裡。

## 來源與目標對照

### 要搬的（18 份來源 → 18 頁，06-01 已完成）

| 目標頁 | 來源 | 備註 |
| :--- | :--- | :--- |
| 01-01 登入 | `account/001-login-email-password/spec.md`、`account/002-login-google-sso/spec.md` | 兩份併一頁（D2）；`001` 另有 `plan.md`，只讀不搬 |
| 01-02 註冊 | `account/003-register-email-password/spec.md` | |
| 01-03 用一次性連結設定密碼 | `account/004-forgot-reset-password/spec.md` | 對應兩個 prototype：`account/forgot-password`、`account/reset-password` |
| 01-04 個人設定 | `account/005-profile-settings/spec.md` | 來源 43KB |
| 01-05 登入狀態與安全 | `account/020-auth-session-security/spec.md` | PRD 列為「不是獨立頁面」，無 prototype |
| 02-01 儀表板 | `dashboard/012-dashboard/spec.md` | 來源 102KB |
| 03-01 任務列表 | `task-management/010-task-list/spec.md` | |
| 03-02 新增任務 | `task-management/013-task-new/spec.md` | 來源 212KB；D3 的定名頁 |
| 03-03 任務詳情 | `task-management/014-task-detail/spec.md` | 來源 341KB；prototype 有 6 個 panels |
| 04-01 標記清單 | `annotation/015-annotation-workspace/spec.md` | 一份拆兩頁（來源標題是 Annotation List + Workspace） |
| 04-02 標記工作區 | `annotation/015-annotation-workspace/spec.md` | 同上；來源 962KB，最大一份 |
| 05-01 分析列表 | `dataset/016-dataset-analysis-list/spec.md` | D5 第三組的定名頁 |
| 05-02 分析詳情 | `dataset/017-dataset-analysis-detail/spec.md` | 來源 133KB；prototype 有 16 個 partials（8 種輸出類型 × 統計／品質） |
| 05-03 資料匯入與版本 | `dataset/021-dataset-ingestion-and-lineage/spec.md` | **沒有 prototype 頁面**，依 skill 列入待釐清 |
| 06-01 使用者管理 | `admin/006-user-management/spec.md` | **已完成**，不重做 |
| 06-02 角色設定 | `admin/007-role-settings/spec.md` | 權限不得超出 PRD §權限矩陣 |
| 07-01 側欄導覽 | `shared/008-sidebar-navbar-shared/spec.md` + `foundation/000-foundation/spec.md` 的業務規則（D4） | 來源 81KB；PRD 列為「不是獨立頁面」，無 prototype |
| 07-02 工作頁籤 | `shared/019-workspace-tabs/spec.md` | 來源 68KB；無 prototype |

### 不搬的來源

| 來源 | 理由 |
| :--- | :--- |
| `shared/018-help-button/` | PRD §範圍外（D1） |
| `foundation/000-foundation/` | 技術規範；只挑業務規則併進 07-01（D4） |
| `foundation/001-project-sdd-lint/` | CI 與 lint 規範，不是業務 |
| `foundation/002-user-path-map-freshness-check/` | 同上 |
| `_governance/` 四份 constitution | 工程規範，對應本專案的 `AGENTS.md` 與 OpenSpec |
| `_shared/constants.md` | 技術常數；只當搬移時的對照參考，不進 `docs/specs/` |
| `specs/STATUS.md` | 舊 repo 的進度表 |
| 各來源目錄下的 `plan.md`、`diagrams/`、`diagrams.mdx` | 技術規劃與舊版圖表；新圖依 `spec-writing` 步驟 7 重畫 |

## 單頁搬移通則

每一頁一個 session，照 `spec-writing` skill 走，差異只在步驟 3、4：

1. **讀來源**：取得該頁的來源 `spec.md`。來源最大 962KB，必要時分段讀，但不得只讀摘要就動筆。
2. **擷取舊編號**：
   `node scripts/check-specs.mjs --extract-legacy <來源 spec.md> > docs/specs/legacy/NN-NN-<page>.ids`
   拆兩頁（04-01／04-02）時，兩頁各自產一份 `.ids`，同一個舊編號只能落在其中一頁，另一頁的對照表寫「見 §規格 04-0X」。
3. **步驟 3（範圍與大綱）不互動**：目標頁、模組、拆分方式都已由 PRD 模組地圖與本文件對照表決定；「規格」章節的大項依來源 `spec.md` 的結構與對應 prototype 的區塊決定。
4. **步驟 4（追問）改成寫入待釐清**：依 `references/writing-guide.md` 的「追問清單」逐章節找出所有模糊處，
   每一題都寫進該頁「待釐清」章節，格式照 `templates/spec-page.mdx`，**一律附我的建議與理由**，並標明影響哪些章節。
   正文依建議撰寫，讓規格能獨立閱讀；不得把建議寫成「已確認決議」。

   **「已確認決議」只有以下五種依據可以寫**，其餘一律進「待釐清」：

   | 依據 | 例 |
   | :--- | :--- |
   | PRD 或術語表已經定的事項 | 角色名稱、權限矩陣、任務五狀態 |
   | 本文件的 D1–D10 | 輸出類型、來源前綴、`foundation/000` 只取業務規則 |
   | 來源 `spec.md` 自己的 Clarifications 或已拍板條文（依 D5） | 手機不提供快捷鍵總覽、頁籤只記網址 |
   | 維護者在 Issue 或對話裡明確拍板，且已記下日期 | 07-01 的 Q1 與 Q3 |
   | `spec-writing` 的鐵律或本文件的「非目標」 | 版面、按鈕順序與技術細節不寫進規格（06-01 的 Q7、Q8） |

   **撰寫者自己的判斷不算依據**，即使理由充分、即使它和 prototype 一致。這一條被違反過三次（07-01 的
   「不嵌入 prototype」、07-02 的「不嵌入 prototype」與「來源釘樁」、01-01 的「登入不檢查密碼組成規則」），三次都由獨立審查抓到——
   寫下某一條時先問「這是誰決定的、記在哪」，答不出來就是待釐清。

   **這五種依據已經是機械檢查**（`check-specs.mjs`，Issue #90 與 #203）：每個 `### Q<n>.` 區塊（標題、選項與理由合起來算）
   至少要命中下面一種寫法，否則 `pnpm check:specs` 報 ERROR。檢查只驗「有沒有寫出依據」，不驗那個依據成不成立——
   後者仍然要人或獨立審查判斷。

   | 依據 | 檢查認得的寫法 |
   | :--- | :--- |
   | PRD 或術語表 | 出現 `PRD` 或 `術語表` |
   | 本文件的 D1–D10 | 出現 `D1`～`D10` |
   | 來源 `spec.md` 自己的條文 | 出現舊編號（`FR-`、`SC-`、`AC-` 後接數字），或同時出現「來源／舊規格」與「Clarifications／釐清紀錄／拍板／明寫／明訂／定成／定義／條文／規格常數／行為規則／使用者故事／舊編號／逐字」其中之一 |
   | 維護者拍板 | 「維護者」與一個 `YYYY-MM-DD` 日期出現在同一句（任一順序） |
   | 方法論 | **同時**出現「`spec-writing`／搬移設計文件」與「鐵律／非目標／黑名單」——光是出現其中一邊不算 |

   **不被接受的寫法**：「prototype 與舊規格都已經這樣做」（和畫面一致不是依據）、「來源沒有定義這一條，所以…」
   （指名一個依據只為了說它不存在，檢查會把這種否定句排除後再判）。
   方法論理由（「規格只寫業務」）**是**第五種依據，維護者 2026-11-09 裁定（#203）——它決定的是「什麼東西該進這份文件」，
   不是產品行為；但它只能用在這一類範圍決定上，不能拿來替產品規則背書——**這一條檢查驗不到，由獨立審查判斷**。

   還查不到依據、但結論必須先留著時，唯一的寫法是 **`依據待補（#<issue>）`**——一定要帶 issue 編號，
   讓缺口被追蹤而不是看起來像已經定案。判例：06-01 的四條（#203）——那一頁原本有八條沒寫出依據：一條回到來源就查到依據，一條由維護者補裁，兩條屬第五種依據，剩下四條（Q1、Q2、Q5、Q6）掛著這個標記；其中 Q6 的註明寫了要維護者裁定，Q1、Q2、Q5 只記著依據的帳未結。
5. **狀態一律草稿**：frontmatter `tags` 放 `草稿`，頁首 `:badge[草稿]{variant="warning"}`。
6. **Prototype 嵌入**：有對應頁面的大項以 `PrototypeFrame` 開頭（`client:idle` 必填）。
   `05-03` 沒有 prototype、`01-05`／`07-01`／`07-02` 不是獨立頁面，依 skill 處理並在待釐清說明。
7. **流程圖留 pending**（D6）。
8. **舊編號對照**：附錄涵蓋 `.ids` 的每個舊編號，標 `刪除` 的列一律寫理由；廢止條文依上方「已廢止的舊條文怎麼處理」逐條判定。
9. **自我檢查**：跑完 skill 步驟 6 的整份清單，特別是技術用語黑名單的 Grep（例外判定見上方「技術用語黑名單的例外」）。
10. **更新索引**：模組 `index.mdx` 與 `docs/specs/index.mdx` 的 `specs.module-map`（補連結、拿掉「（未撰寫）」），新名詞進 `glossary.mdx`。
11. **更新彙總清單**：把這頁的待釐清同步進 `docs/specs/open-questions.mdx`。
12. **驗證**：`pnpm check:specs` 與 `pnpm exec notecraftapp build docs` 都要通過。
13. **提交**：照 skill 步驟 8.3 詢問後提交；分支 `docs/spec-NN-NN-<page>`，commit subject 結尾帶該頁 child issue 編號。

### 一頁一頁做，不並行

17 頁**嚴格序列**，依 D8 的順序一頁接一頁，不開 worktree 並行。兩個理由：

- 每一頁的 PR 都會改到同三個共用檔：`docs/specs/index.mdx` 的 `specs.module-map`、`docs/specs/glossary.mdx`、`docs/specs/open-questions.mdx`。並行會在這三個檔上連環衝突，`open-questions.mdx` 尤其，因為每頁都要在步驟 11 追加。
- 瓶頸是維護者處理待釐清的時間，不是撰寫速度。並行縮短不了那一段。

`open-questions.mdx` 另外依模組分區段（每個模組一個 `##`），讓第二輪逐模組定案時只動自己那一段。
相依性用 GitHub issue dependencies 建成一條鏈：前置 `[Bug]` child → 07-01 → 07-02 → 01-01 → … → 02-01。

## 待釐清彙總清單

新檔 `docs/specs/open-questions.mdx`，依模組分組，每題一列：

| 欄 | 內容 |
| :--- | :--- |
| 題號 | `NN-NN Q1` |
| 問題 | 一句話 |
| 我的建議 | 正文目前採用的寫法 |
| 影響 | 該頁受影響的章節，跨頁時列出其他頁 |
| 連結 | 跳回該頁「待釐清」的錨點 |

- 由各頁 session 在步驟 11 同步寫入，不手動維護兩份內容。
- 維護者決定後，跑第二輪：答案折回該頁「已確認決議」、修正受影響的正文與 Scenario、
  把該頁狀態改為 `已定案`／`variant="success"`、生成流程圖（D6）、從彙總清單移除該列。
- 清單空了代表 17 頁全定案，可以開始跑 `/opsx:propose`。

## Issue 與專案板結構

Issue 總數 **1 + 7 Epic + 17 + 7 = 32**。

- **1 個前置 child**：`[Bug] check-specs: <中文描述>`，Issue Type `Bug`、label `bug`，內容依 D9 的三個缺陷與實測基準表。
  **這一個合併之前不開始寫任何規格**，因為 `.ids` 要用修好的工具重新擷取。它不屬於任何模組 Epic。
- **7 個 Epic**，一個模組一個：01 帳號、02 儀表板、03 任務管理、04 標記作業、05 資料集、06 系統管理、07 共用介面。
  Issue Type `Epic`，body 列出子項並連成 GitHub sub-issues。
- **17 個第一輪 child**，一頁一個。Issue Type `Task`、label `docs`、標題 `[Docs] <NN-NN>: <中文描述>`。
  body 必須寫死：來源路徑、`.ids` 檔名、目標檔路徑、對應的 prototype 頁面（或「無」）、本文件連結。
- 四個大頁（04-02 962KB、03-03 341KB、03-02 212KB、05-02 133KB）**現在不拆**；輪到它、讀完來源知道怎麼切了再開 sub-issue。
- 一律 `gh issue create --type <Type> --project "Label Suite"`，child 加 `--parent <N>`。
- Ready gate 在維護者手上：Epic 一個模組一個放行，順序照 D8。
- 卡片由做事的 agent 自己移動：領取時 In Progress、PR 開了 In Review、合併且 issue 關閉後 Done。
- **7 個第二輪 child**，一個模組一個：`[Docs] <模組>: 待釐清定案與流程圖生成`，掛在同一個模組 Epic 下。
  第一輪 child 以「草稿交付」為完成就關閉，不為這件事破 `AGENTS.md`「PR 合併後關閉 issue」的流程；
  「規格已定案」由第二輪 child 負責。Epic 要等它的第二輪 child 也關閉才 Done。
- 相依性用 GitHub issue dependencies（blocked-by）記，不只寫在文字裡：
  前置 `[Bug]` child 擋住全部 17 個第一輪 child；第一輪 child 之間依 D8 串成一條鏈（見「一頁一頁做，不並行」）；
  每個模組的第二輪 child blocked-by 該模組所有第一輪 child。

## PR 的變更範圍

搬移作業期間，**一張 PR 只能是下面三類中的一類**（`AGENTS.md` 的「One purpose per PR」）。合併前逐一看過 `gh pr view <N> --json files`，每個檔案都要落在那一類的允許清單裡；越界就拆成兩張。
**release、相依套件升級與規則文件（`AGENTS.md`、`CLAUDE.md`）的 PR 不屬於這三類**，照 `AGENTS.md` 自己的規則走——判例 #147（升級 notecraftapp，動了 `package.json`、`pnpm-lock.yaml` 與一個共用元件）。

| 類別 | 可以動 | 典型 |
| :--- | :--- | :--- |
| **文件 PR** | `docs/`；那一頁的流程圖已生成時，可同時更新它的 `.notecraft/components/*-flow.tsx` | 搬一頁規格、折回待釐清、改既有規格的條文、改 `docs/development/` 的設計文件 |
| **流程圖 PR** | `docs/` 與 `.notecraft/components/` | 生成或更新業務流程圖 |
| **工具 PR** | `scripts/`、`package.json`、`pnpm-lock.yaml`、`.github/`，以及下面那一條限定的 `docs/specs/` | 修 `check-specs.mjs`、新增機械檢查、調 CI |

三類的差別是**目的**，不是檔案數：同樣動到一個 `*-flow.tsx`，目的是畫圖的算流程圖 PR，目的是改條文、順手讓圖跟上的算文件 PR。

- **流程圖元件不住在 `docs/` 底下**：規格頁用 `GeneratedFrame` 從 `@notes/components/` 取元件，所以流程圖 PR 通常會同時動到 `docs/specs/` 的頁面與 `.notecraft/components/`。這是允許的，不必每次在留言裡解釋。判例 #175、#176、#177、#193、#198、#199。只修元件、完全不動 `docs/` 也算這一類（判例 #167）。
- **文件 PR 可以順手更新那一頁已生成的流程圖**：條文改了而圖還是舊的，比圖沒更新更糟。判例 #200——折回 03-01 的範圍硬化規則時，同一張 PR 改了 `spec-03-01-task-list-flow.tsx` 的三行。
- **工具 PR 可以動 `docs/specs/`，但只限修掉新檢查在既有頁面上抓到的違規**，而且要在 PR body 逐一列出；**不得新增或改寫規格條文**，也不得為了讓檢查器有東西可驗而去改真正的規格頁（測試資料放 `scripts/tests/`）。
  原因在 CI：`specs` job 會在 **PR 分支上**跑 `node scripts/check-specs.mjs docs`，所以新檢查一加上去，既有頁面的違規就讓**那張工具 PR 自己**變紅；不在同一張修掉就過不了。判例 #149、#151、#152、#153 四張都是這個形狀。
- 文件 PR 與流程圖 PR **不得動 `scripts/`、`package.json`、`.github/`**。搬移途中發現檢查器有缺陷時，開一張 `[Bug]` issue 與它對應的工具 PR 處理，不要夾帶。
- **任何一類都不准動的**：`docs/specs/00-prd.mdx` 與 `design/prototype/`。這兩條在「非目標」那一節已經定了（要動 PRD 時回報並建議用 `prd-writing`；畫面與規格不一致時列入待釐清），這裡只是重申它們對三類 PR 都成立。

## 驗收

這件事做完的定義：

1. `scripts/check-specs.mjs` 的三個缺陷都已修好並有單元測試；`annotation/015` 擷出 480 條、`06-01` 的既有對照表 46／46 不回歸（D9）。
2. `docs/specs/` 有 18 頁規格（含已完成的 06-01），模組地圖 18 列全部有連結、沒有「（未撰寫）」。
3. `pnpm check:specs` 與 `pnpm exec notecraftapp build docs` 全綠。
4. 18 份 `.ids` 的每個舊編號在對應的規格附錄都有新位置或帶理由的 `刪除`；廢止條文都逐條判定過，沒有整批判 `刪除`。
5. 技術用語黑名單 Grep 的每個命中都判定過：判為例外的已進術語表並列在回報裡，其餘都已改寫。
6. `docs/specs/open-questions.mdx` 存在、依模組分區段、每題都有建議與連結（第一輪完成時），或已清空（全部定案時）。
7. 32 張 issue 全部關閉，7 個 Epic 都 Done。

第一輪（17 份草稿）完成即可交付；第二輪（折回答案、定案、生成流程圖）依維護者處理待釐清的進度進行。

## 留給執行者決定

- 每頁「規格」章節大項怎麼切（依來源結構與 prototype 區塊判斷）。
- 大頁要不要再拆 sub-issue、怎麼拆（讀完來源再決定）。
- 962KB 的來源怎麼分段讀。
- 每頁待釐清的題目與建議內容。
- `open-questions.mdx` 的 frontmatter 與排版細節（照 NoteCraft 既有文件的慣例）。

## 本文件作者自行決定的事（維護者可推翻）

- 不另開一個「前置準備」child 去一次擷取 18 份 `.ids`；改成各頁 session 開頭自己擷取，因為每個 session 本來就只讀自己那一份來源。
- `.ids` 檔名沿用 skill 的 `NN-NN-<page>.ids` 格式，和 `docs/specs/legacy/06-01-user-management.ids` 一致。
- **`.ids` 首兩行記下來源的 commit 與路徑**（`# source: singyichen/label-suite@<sha> <path>`、`# extracted: <date>`）。
  舊 repo 在搬移期間會被更新（2026-11-04 當天 pull 了兩次，`annotation/015` 的條數從 480 變成 517），
  不記出處的話來源變動會讓 `.ids` 靜默過期，而 `pnpm check:specs` 只比對 `.ids` 與附錄、不回頭看來源。
  `readLegacyIds` 本來就會濾掉 `#` 開頭的註解，所以這個慣例不需要改任何工具。
  讓檢查工具真的去比對那個 commit 是另一件事，尚未實作。
- D5 前兩組異名直接用 PRD 與術語表既有的中文名詞，不另外列待釐清；第三組（IAA 狀態）PRD 沒定，列入 05-01 待釐清。
- 分支命名 `docs/spec-NN-NN-<page>`，一頁一分支一 PR。
- 廢止條文的處理規則（讀過才判 `刪除`、有承接就對到承接者）。
- 17 頁嚴格序列、不並行，`open-questions.mdx` 依模組分區段。
- 第二輪的 issue 結構（第一輪 child 以草稿交付關閉，每模組另開一個定案 child）。
- 技術用語黑名單的例外認定（`JSON` 可留並進術語表，`session`／`token` 一律改寫成「登入狀態」）。
- 來源 spec 自帶的 `## Open Questions` 段落併進該頁「待釐清」並附建議，不另列一類。
