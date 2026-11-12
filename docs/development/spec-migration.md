# 搬移舊 repo 規格到 docs/specs/ — 設計文件

- 日期：2026-11-04
- 狀態：維護者 2026-11-04 拍板；搬移已於 2026-11-09 全部完成
- 來源 repo：`singyichen/label-suite`（`specs/`，main 分支）
- 目標：`label-suite-oss` 的 `docs/specs/`

## 意圖

舊 repo 的 `specs/` 有 22 份以 `FR-NNN`／`AC-N.N`／`SC-NNN` 編號的規格，混著業務規則與技術設計，單份最大 962KB。
本專案已經改採三層文件分工（PRD → 規格書 → OpenSpec），規格書由 `spec-writing` skill 產生、只寫業務。
這件事要把舊規格的業務需求一條不漏地搬進新結構，讓 `/opsx:propose` 有可用的需求依據。

18 頁已於 **2026-11-09 全部完成**（`06-01 使用者管理` 是第一頁）。本文件保留下來的作用是記住那些判例與通則，後續的 PR 分類也沿用[§PR 的變更範圍](#pr-的變更範圍)。

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
- 搬移期間不改 `design/prototype/`；畫面與規格不一致時列入待釐清。**搬移結束後**，依裁定改畫面是「畫面修正 PR」的事，見 [§PR 的變更範圍](#pr-的變更範圍)——那一類有一道 artifact 前置關卡。
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
`03-02` 已經把這 8 個名稱定案（見該頁 §已確認決議 Q10，依據是來源自己三處已拍板的條文）；規格 03-01 Q4 已於 2026-11-08 依術語表折回定案；07-01 Q6 同日獨立定案（整條移除側欄的類型沿用機制），不再依賴它。

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

### 要搬的（18 份來源 → 18 頁，**2026-11-09 全部完成**）

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
   | `spec-writing` 的鐵律或邊界，或本文件的「非目標」 | 版面與按鈕順序不寫進規格（06-01 Q7，依「畫面長相以 prototype 為準」）、技術細節不寫進規格（06-01 Q8，依「非目標」第一條） |

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
   | 方法論 | **同時**出現「`spec-writing`／搬移設計文件」與「鐵律／非目標／黑名單／以 prototype 為準」——光是出現其中一邊不算 |

   **不被接受的寫法**：「prototype 與舊規格都已經這樣做」（和畫面一致不是依據）、「來源沒有定義這一條，所以…」
   （指名一個依據只為了說它不存在，檢查會把這種否定句排除後再判）。
   方法論理由（「規格只寫業務」）**是**第五種依據，維護者 2026-11-09 裁定（#203）——它決定的是「什麼東西該進這份文件」，
   不是產品行為；但它只能用在這一類範圍決定上，不能拿來替產品規則背書——**這一條檢查驗不到，由獨立審查判斷**。

   還查不到依據、但結論必須先留著時，唯一的寫法是 **`依據待補（#<issue>）`**——一定要帶 issue 編號，
   讓缺口被追蹤而不是看起來像已經定案。判例：06-01 曾有四條掛這個標記（Q1、Q2、Q5、Q6），**現在全部結清**（#203）。
   那一頁原本有八條沒寫出依據，逐條回查的結果值得記下來，因為八條裡只有兩條真的是「沒有依據」：一條在來源就查到；
   三條（Q4、Q5、Q6）的依據是**維護者 2026-10-29 的裁定**，頁面卻把它寫成「舊編號 `006-Q2`／`Q3`／`Q4`」，看起來像來源條文編號，所以連撰寫者自己都判成「來源沒有」；
   兩條（Q7、Q8）屬第五種依據；剩下 Q1 與 Q2 由維護者 2026-11-09 兩句裁定結案。
   **所以這一輪真正的缺口不是檢查太嚴，是裁定落地時沒把「誰在哪一天裁的」寫進頁面**——07-01 的 Q1 與 Q3 也一樣（維護者 2026-11-04 裁定，頁面只留下一個日期）。
   寫「已確認決議」時，裁定的出處要寫到**讀者循線查得到**：issue 編號、工作項或留言、必要時連 commit。
5. **狀態一律草稿**：frontmatter `tags` 放 `草稿`，頁首 `:badge[草稿]{variant="warning"}`。
6. **Prototype 嵌入**：有對應頁面的大項以 `PrototypeFrame` 開頭（`client:idle` 必填）。
   `05-03` 沒有 prototype、`01-05`／`07-01`／`07-02` 不是獨立頁面，依 skill 處理並在待釐清說明。
7. **流程圖留 pending**（D6）。
8. **舊編號對照**：附錄涵蓋 `.ids` 的每個舊編號，標 `刪除` 的列一律寫理由；廢止條文依上方「已廢止的舊條文怎麼處理」逐條判定。
9. **自我檢查**：跑完 skill 步驟 6 的整份清單，特別是技術用語黑名單的 Grep（例外判定見上方「技術用語黑名單的例外」）。
10. **更新索引**：模組 `index.mdx` 與 `docs/specs/index.mdx` 的 `specs.module-map`（補連結、拿掉「（未撰寫）」），新名詞進 `glossary.mdx`。
11. **更新彙總清單**：把這頁的待釐清同步進 `docs/specs/open-questions.mdx`。
12. **驗證**：`pnpm check:specs` 與 `pnpm exec notecraftapp build docs` 都要通過（build 第一次失敗要重跑一次，見[§建置閘門要重跑確認](#建置閘門要重跑確認)）。
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

**一張 PR 只能是下面五類中的一類**（`AGENTS.md` 的「One purpose per PR」）。合併前逐一看過 `gh pr view <N> --json files`，每個檔案都要落在那一類的允許清單裡；越界就拆成兩張。
**release、相依套件升級，以及只改規則文件（`AGENTS.md`、`CLAUDE.md`）的 PR 不屬於這五類**，照 `AGENTS.md` 自己的規則走——判例 #147（升級 notecraftapp，動了 `package.json`、`pnpm-lock.yaml` 與一個共用元件）。

**「只改規則文件」的判準**（整節只定義在這裡，下面兩處引用它）：**把 `AGENTS.md`／`CLAUDE.md` 本身排除之後，沒有動到文件 PR 或流程設定 PR 允許的其他路徑。**
判準刻意只看那兩類——它們是唯一有「連帶規則文件」條款的。所以一張 `AGENTS.md` ＋ `pnpm-lock.yaml` 的升版 PR 仍然算「只改規則文件」，照這一條走，不會因為 `pnpm-lock.yaml` 落在工具 PR 的清單裡就兩邊落空。
**判準不能寫成「沒有動到五類任一類允許的路徑」**：`AGENTS.md` 本身現在就在其中兩類的清單裡，那樣寫會讓這個例外永遠不成立。

前三類是搬移作業期間的分類，後兩類在搬移結束後才用得到——**搬移已於 2026-11-09 全部完成（18 頁），所以現在新開的 PR 多半落在後兩類**。

| 類別 | 可以動 | 典型 |
| :--- | :--- | :--- |
| **文件 PR** | `docs/`；那一頁的流程圖已生成時，可同時更新它的 `.notecraft/components/*-flow.tsx`；**`.notecraft/plugins.json`**（見下）；以及**連帶**修到的 `AGENTS.md`／`CLAUDE.md` | 搬一頁規格、折回待釐清、改既有規格的條文、改 `docs/development/` 的設計文件 |
| **流程圖 PR** | `docs/` 與 `.notecraft/components/` | 生成或更新業務流程圖 |
| **工具 PR** | `scripts/`、`package.json`、`pnpm-lock.yaml`、`.github/`，以及下面那一條限定的 `docs/specs/` | 修 `check-specs.mjs`、新增機械檢查、調 CI |
| **畫面修正 PR** | `design/prototype/`、`docs/prototype/navigation.mdx`（限該檔 §維護說明 要求的同步），以及下面那一條限定的 `docs/specs/` | 依裁定改畫面的文案、欄位或徽章——`[UI]` 與 `[Enhancement]` issue 的本體 |
| **流程設定 PR** | `openspec/`、`.claude/`（`agents/`、`skills/`、`commands/`）、`.agents/skills/`，以及**連帶**修到的 `docs/development/` 與 `AGENTS.md`／`CLAUDE.md` | 建 schema 與 template、寫 agent 角色定義、加 skill 或指令 |

五類的差別是**目的**，不是檔案數：同樣動到一個 `*-flow.tsx`，目的是畫圖的算流程圖 PR，目的是改條文、順手讓圖跟上的算文件 PR。
同理，同樣動到 `docs/development/` 的一份設計文件：**只動它與連帶的 `AGENTS.md`／`CLAUDE.md`、不動 `openspec/`、`.claude/` 或 `.agents/skills/` 的算文件 PR**（判例：#221 那張補五類表的，以及 #224）；因為改了 schema、agent 或 skill 而連帶要更新那份文件的，算流程設定 PR。

- **流程圖元件不住在 `docs/` 底下**：規格頁用 `GeneratedFrame` 從 `@notes/components/` 取元件，所以流程圖 PR 通常會同時動到 `docs/specs/` 的頁面與 `.notecraft/components/`。這是允許的，不必每次在留言裡解釋。判例 #175、#176、#177、#193、#198、#199。只修元件、完全不動 `docs/` 也算這一類（判例 #167）。
- **`.notecraft/plugins.json` 算文件 PR**（維護者 2026-11-11 裁定）。它把 NoteCraft 的外掛對應到 `docs/` 底下的資料檔（例如 `er-diagram-renderer` 對 `**/*.er.json`），它的作用就是決定 `docs/` 底下的那份資料交給哪個 renderer（頂層 `disabled` 的站台級啟停、每條映射的 `options` 也在這裡），依本節「五類的差別是**目的**，不是檔案數」，和它要呈現的那份資料同一類。
  **原本它不在任何一類裡**：這張表只收了 `.notecraft/components/`，而 `plugins.json` 不在 `components/` 底下。**判例 #246**（issue #236 的交付 PR，`93a8b4f`）：它把 `.notecraft/plugins.json` 與 `docs/diagrams/architecture/` 的三個檔（`database-schema.er.json`、`data-table-dictionary.mdx`、`data-field-inventory.mdx`）一起當文件 PR 合併，四個檔服務同一個目的——決定那份 ER 資料交給哪個 renderer，以及它從哪份盤點來。
  **這一條有程序掛勾**（比照下面規則文件那條）：**`plugins.json` 的每一處改動都要在 PR body 列出，並寫明它服務的是同一個目的**。原因同樣是合併閘第 2 條只比對路徑——而這個檔會被工具改寫：`pnpm docs:serve` 在 `/plugins` 停用一個外掛，dev API 就會改寫它頂層的 `disabled` 陣列（`notecraftapp@1.15.0` 的 `src/dev-api/handlers.mjs` `PUT /api/plugins/:id`）。那種改動與 PR 的目的無關，但在機械閘上會無聲通過。
  **`.notecraft/plugins/<id>/`（裝進版控的外掛本體）不算文件 PR**，照本節開頭「相依套件」那個例外處理，**不屬五類**，照 `AGENTS.md` 自己的規則走——比照判例 #147（升級 notecraftapp）。維護者 2026-11-11 裁定另開一張相依套件 PR、先合併它，再合併用到它的文件 PR；順序反過來會讓 `plugins.json` 指向沒裝的外掛而 build 失敗。**判例 #245**（`ec1af4f`）就是那張相依套件 PR，比 #246 早 22 分鐘合併。它的範圍是 `.notecraft/plugins/`（外掛本體與 `_types.d.ts`）加上根目錄的 `NOTICE`——**散入版控的第三方程式要同時交代授權**，所以 `NOTICE` 跟著外掛走，不另開一張。
  除了上面這兩條，**不擴及 `.notecraft/` 的其他檔案**：真的碰到別的，照本節開頭那三種例外的方式重新判斷，不要類推。
- **文件 PR 可以帶著它連帶修到的規則文件**，因為一份給 agent 讀的說明，它的入口本來就在 `AGENTS.md`：新增 `docs/development/` 的說明而同一張 PR 在 `AGENTS.md` 設索引，算文件 PR。判例 #224（#105：`docs/development/agent-rules.md` ＋ `AGENTS.md` 的 Agent Rules Index）。
  這一條是**補出來的**：#221 補五類表時只給了流程設定 PR 這個連帶條款，而文件 PR 沒有，所以 #224 一度掉在五類之間——而那個形狀是 #105 工作項 1 的結構決定的（索引與被索引的文件必須同一張 PR 落地，否則合併後索引會指向不存在的檔案）。維護者 2026-11-10 裁定補上。
  **連帶不等於夾帶**，而且這一條有程序掛勾（比照工具 PR 那條）：**規則文件的每一處改動都要在 PR body 逐一列出，並寫明它服務的是同一個目的**。合併閘第 2 條是純路徑比對，`AGENTS.md` 一進清單就機械上全部通過，所以這個限制只能靠 PR body 的逐項說明與獨立審查把關。
  只改規則文件的 PR 仍然不屬五類，判準見上面。
- **文件 PR 可以順手更新那一頁已生成的流程圖**：條文改了而圖還是舊的，比圖沒更新更糟。判例 #200——折回 03-01 的範圍硬化規則時，同一張 PR 改了 `spec-03-01-task-list-flow.tsx` 的三行。
- **工具 PR 可以動 `docs/specs/`，但只限修掉新檢查在既有頁面上抓到的違規**，而且要在 PR body 逐一列出；**不得新增或改寫規格條文**，也不得為了讓檢查器有東西可驗而去改真正的規格頁（測試資料放 `scripts/tests/`）。
  原因在 CI：`specs` job 會在 **PR 分支上**跑 `node scripts/check-specs.mjs docs`，所以新檢查一加上去，既有頁面的違規就讓**那張工具 PR 自己**變紅；不在同一張修掉就過不了。判例 #149、#151、#152、#153 四張都是這個形狀。
- **畫面修正 PR 可以動 `design/prototype/`，但那道關卡在 Ready 之前、不在 PR 階段**：規則本體寫在 `AGENTS.md` §Project Board and Dispatch 的 **Ready gate**（維護者 2026-11-10），這裡不複述以免兩份漂移。要記住的是：**卡片沒有合法地走過那道關卡，就不會有這一類 PR**；畫 artifact 不等於改畫面的授權。
  這一類也可以同時動 `docs/specs/`，**但只限兩種**：把這次改動打成假的既有斷言改掉，以及把裁定記成那一頁的「已確認決議」。判例 #220（儀表板狀態徽章改用 PRD 的五個名稱：六個 `design/prototype/pages/dashboard/` 的檔案，加上規格 02-01 新增 Q18、03-01 一處跨頁斷言失效）。
  **不得夾帶與這次裁定無關的條文改寫**——那是文件 PR。
- **流程設定 PR** 管的是 agent 怎麼工作，不是產品要做什麼，所以它**不碰 `docs/specs/`**，只動 `openspec/`、`.claude/`（`agents/`、`skills/`、`commands/`）與 `.agents/skills/`，以及因此連帶要改的 `docs/development/` 設計文件與 `AGENTS.md`／`CLAUDE.md`。判例 #215（schema 與 `config.yaml`）、#216（十二個 agent 角色）、#217（clarify skill 的兩份副本）、#219（`/sdd` 指令與 `AGENTS.md` 的 SDD 一節）。
  **同一次流程改動連帶的規則條文可以一起改**：#219 動了 `.claude/commands/sdd.md`、`AGENTS.md`（新增 §SDD Workflow 一節）與 `docs/development/spec-authoring.md`，三個檔都服務同一個目的，所以整張歸流程設定 PR，不必拆。
  **只改**規則文件的 PR 不屬於這五類，照本節開頭那一條走；判準也定義在那裡。
- 文件 PR 與流程圖 PR **不得動 `scripts/`、`package.json`、`.github/`**。搬移途中發現檢查器有缺陷時，開一張 `[Bug]` issue 與它對應的工具 PR 處理，不要夾帶。
- **任何一類都不准動的**：`docs/specs/00-prd.mdx`。要動 PRD 時回報並建議用 `prd-writing`（見「非目標」）。
- **`design/prototype/` 只有畫面修正 PR 能動，而且要先過上面那道 artifact 關卡。** 文件 PR、流程圖 PR、工具 PR 與流程設定 PR 都不准動它：搬移期間畫面與規格不一致時列入待釐清（見「非目標」），不要順手改畫面。

## 建置閘門要重跑確認

`pnpm exec notecraftapp build docs --rebuild` 在編輯 `docs/` 之後的**第一次執行會間歇性失敗**，第二次起通過（[#172](https://github.com/label-suite/label-suite/issues/172)，實測 1 PASS／3 FAIL）。

**根因已經查到（2026-11-12）：它就是下面那一節的「同路徑併發」，第二個 build 是 `notecraftapp serve docs` 的背景 watcher。** `serve` 的 `--watch` **預設是 `true`**（`bin/notecraftapp.mjs:786`），所以只要有人開著 `pnpm docs:serve`，每次存檔 `docs/**` 都會觸發它自己的一次 `atomicRebuild()`——而你手動跑的那一次正好同時開始。「編輯之後的第一次」之所以特別，不是因為編輯，而是因為**編輯就是 watcher 被觸發的那一刻**。

所以**最便宜的對策不是重跑，是不要和 watcher 同時 build**：要手動跑 `--rebuild` 之前先停掉 `pnpm docs:serve`，或那一輪用 `--no-watch` 開它。
⚠️ 但 `--no-watch` 只解掉「撞在一起」，**不解「瀏覽器看到舊的」**：`--rebuild` 輪替過 `dist` 之後，那個一直開著的 serve 會繼續服務 `dist.prev`（見 [#172](https://github.com/label-suite/label-suite/issues/172) §線索）。要在瀏覽器驗收，手動 build 之後要重開 serve。

**這不是叫人別用 `docs:serve`。** 它的 watcher 本身就是一條合法的驗證路徑——[`content-visualize`](../../.claude/skills/content-visualize/SKILL.md) 正是靠「觀察使用者開著的 `docs:serve`，存檔後 watcher 自己 rebuild、SSE 推 auto reload」來驗元件的。要避免的只有**兩條路徑同時走**：用 watcher 驗就別再手動 build，要手動 build 就先讓 watcher 停下來。

這移掉的是目前已知的唯一併發來源；**沒有另外做「關掉 serve 之後連跑 N 次全綠」的驗證**，所以這裡不保證第一次一定過。重跑規則留著當保險。

**規則：第一次失敗就再跑一次，只跑一次。** 第二次綠就算這一道閘通過；**兩次都失敗才是真的壞了**，去找真正的錯。

這一條寫下來是因為兩個方向都會誤讀，而**第二種更危險**：

| 誤判 | 後果 |
| :--- | :--- |
| 把第一次的失敗當成真的失敗 | 白花時間找一個不存在的 MDX 錯誤 |
| 把第二次的成功當成「一次就綠」 | 哪天真的有一個**穩定**的 build 失敗，會被當成同一個偶發而重跑帶過 |

**怎麼分辨真失敗**：唯一可靠的判準是 **重跑會不會一模一樣地再失敗一次**。真的 MDX 錯誤會穩定重現；#172 重跑就過。

判例（2026-11-11）：一個標題裡放了半形雙引號，錯誤是 `docs/tmp-title-edge.mdx:14:22 Unexpected content after expression`，連跑兩次都相同——那不是 #172。

⚠️ **「有沒有印出檔案位置」不是判準，這一條 2026-11-12 更正過。** 原本寫「真的 MDX 錯誤會印出檔案與位置，#172 的形狀沒有檔案位置」。**#172 有兩種形狀，其中一種印得出檔案路徑**：

| 形狀 | 錯誤 | 落在哪個共用資源 |
| :--- | :--- | :--- |
| A | `Cannot find module …/chunks/*.mjs`，堆疊收在 `ModuleJob._link`／`ModuleLoader.import`，**沒有檔案位置** | staging 目錄 `node_modules/.notecraft-build/<雜湊>` |
| B | `ENOENT: no such file or directory, rename '…/.astro/content-modules.mjs.tmp' -> '…/.astro/content-modules.mjs'`，堆疊收在 `MutableDataStore.writeModuleImports`，**印得出完整路徑** | `~/.notecraft/app-<版本>/.astro/` |

形狀 B 印出來的路徑在 **`~/.notecraft/` 底下，不是你的 repo**——這是和真 MDX 錯誤最快的分辨方式；真的 MDX 錯誤指的一定是 `docs/` 裡的某一行。但還是以重跑為準。

這條規則**另外有兩份副本**，本章節是第三份，也是唯一寫了「怎麼分辨真失敗」的一份：[`.claude/agents/ops.md`](../../.claude/agents/ops.md) 與 [`.claude/agents/technical-writer.md`](../../.claude/agents/technical-writer.md) 的檢查清單。`openspec/config.yaml` 的 apply 階段也要求跑這道 build，但沒提重跑。

**CI 那一份已經拿掉了**（2026-11-12，#172）：`.github/workflows/ci.yml` 的 `docs-site` job 原本寫 `… --rebuild || … --rebuild`，依據就是本節的實測數字。根因查到之後那個依據不成立了——併發來自本機的 `serve` watcher，而 CI 從不跑 `serve`，所以那個 `||` 只會遮住一個真的失敗兩次的 build，正好是下面表格第二列警告的那一種。

**真正修掉 #172 之後，剩下這三處的重跑要一起拿掉。**

**[#172](https://github.com/label-suite/label-suite/issues/172) 倉庫內的工作已於 2026-11-12 全部完成**，依維護者同日的裁示結案（移除 CI 的重跑，另外六個檔不再把 watcher 與手動 build 並列：`notecraft-visualize.md`、`notecraft-writing.md`、兩份 `spec-writing/references/flow.md`、兩份 `content-visualize/SKILL.md`）。**剩下的修法在 `notecraftapp` 上游、不在本倉庫**：兩條路是「以 `cacheDir` 為單位加跨行程鎖」或「把 build 的 staging 目錄與 `.astro/` 做成每行程唯一」。所以這一節是現在唯一的追蹤點——**升級 `notecraftapp` 時（`package.json` 的 `devDependencies`）要重測一次**：關掉 `docs:serve`、編輯一個 `docs/` 檔、連跑三次 `--rebuild`，三次都綠就把**四處**的重跑規則一起拿掉：本節、[`.claude/agents/ops.md`](../../.claude/agents/ops.md) 與 [`.claude/agents/technical-writer.md`](../../.claude/agents/technical-writer.md) 的檢查清單，以及本文件 §單頁搬移通則 第 12 步那一句（它自帶規則、不只是交叉引用）；還會壞就開一張新的 issue，不要重開這一張。

⚠️ **要確認 serve 停了沒，別用 `pgrep -f 'notecraftapp serve'`。** 實際的指令字串是 `node …/notecraftapp.mjs serve docs --port 4330`，中間隔著 `.mjs`，所以那個模式永遠比不到，會回報「沒有 serve 在跑」。用 `pgrep -lf 'notecraftapp.mjs serve docs --port 4330'`——**限定到這個 port**，否則別的專案的 `notecraftapp` 行程也會被列出來，讓人以為還有 serve 在跑。
判例（2026-11-12）：照那個錯模式檢查之後，一連串「沒有 serve 卻還是第一次失敗」的觀察被當成根因不成立的證據，差點據此改掉本節的結論——而 `ps` 顯示 watcher 從 11-08 起就一直開著（4 天）。**所以那些觀察不構成反證**——但也僅止於此：根因仍然只以「同路徑併發 3／3 重現」為依據，而「關掉 serve 之後連跑 N 次全綠」這個正面驗證**到現在還是沒做**（見本節上文）。**這也是為什麼本節的判準是「重跑會不會一模一樣地再失敗」，而不是「有沒有別的行程在跑」**：前者不依賴你有沒有把行程查對。

### 併發的 build 會撞在一起，而且分得出哪一種併發

**同一個 `docs/` 路徑的兩個 build 同時跑，其中一個會失敗。** 2026-11-11 做了對照實驗，各 3 回：

| 實驗 | 結果 |
| :--- | :--- |
| **同路徑**併發（相隔 1 秒啟動） | **3／3 第二個失敗**，形狀就是 #172 的那一種（`Cannot find module …/chunks/*.mjs` → `astro build exited with code 1`），第一個都 `Complete!` |
| **不同路徑**併發（同時啟動） | **3／3 兩個都成功** |

機制在 `~/.notecraft/app-1.15.0/bin/notecraftapp.mjs`：

| 事實 | 出處 |
| :--- | :--- |
| 快取目錄 `~/.notecraft/cache/<雜湊>` = `sha1(絕對 docs 路徑)` 前 12 位 | `cacheDirFor()`，`:152-155` |
| build 的暫存目錄 = **`~/.notecraft/app-<版本>/node_modules/.notecraft-build/<同一個雜湊>`** | `buildStageDir()`，`:573-575` |

**那個 `node_modules` 是 app 自己的，不是你的 repo。** `buildCmd` 呼叫 `ensureBuild(packageRoot, …, process.cwd())`（`:758`），所以函式裡的 `cwd` 是 app 根、使用者的目錄是另一個參數；astro 也是從 app 根載入的（`:392`）。**repo 的 `node_modules` 完全不參與 build**——`<repo>/node_modules/.notecraft-build` 根本不存在，別去那裡找。上游自己的註解（`:571-572`）就寫「以快取 hash 命名，不同筆記資料夾可並行」。

**還有幾份不帶雜湊的共用可變資源**：`~/.notecraft/app-<版本>/.astro/`（content layer 的 `dotAstroDir`，每次 build 都重寫）、`node_modules/.vite/`，以及**快取目錄自己的輪替區** `~/.notecraft/cache/<雜湊>/` 底下的 `dist`／`dist.next`／`dist.prev`——`atomicRebuild()` 開頭對後兩者無條件 `fs.rm`（`:594-597`）、結尾的兩次 rename（`:608-612`）同樣沒有互斥。上面那 3 回不同路徑的併發沒有因為它們失敗，但 **3 回不等於所有時序都安全**；真的要大量平行建置時，這是第一個要懷疑的地方。

**但 2026-11-12 的複驗顯示 `.astro/` 確實會害死同路徑的併發**，而且是當天抓到的唯一形狀：同時開兩個 `build --rebuild`，**3／3 每組正好一個失敗**，三次的 `Caused by` 逐字相同——

```
ENOENT: no such file or directory, rename
  '…/.notecraft/app-1.15.0/.astro/content-modules.mjs.tmp'
  -> '…/.notecraft/app-1.15.0/.astro/content-modules.mjs'
  at MutableDataStore.writeModuleImports
```

兩個 build 各自寫同一個 `.tmp` 再 rename，先完成的把它改名走，後到的就 ENOENT。所以同路徑併發**至少同時踩到兩份共用資源**（staging 與 `.astro/`），兩者各自產生目前觀察到的兩種失敗形狀（見上一節那張表）。輪替區是第三份，只是兩次實驗都走不到它——總有一個 build 在 astro 階段就先死了。不同路徑只分開了 staging，`.astro/` 仍然共用——上面「3 回不等於所有時序都安全」那句話要當真。

### 第二個 build 從哪裡來：`serve` 的 watcher

平常不會有人手動開兩個 build，但**`notecraftapp serve docs` 本身就是第二個 build**：

| 事實 | 出處 |
| :--- | :--- |
| `serve` 的 `--watch` **預設 `true`**，開著就有背景 rebuild | `:786-790` |
| watcher 觸發時呼叫的是**同一個** `atomicRebuild(cwd, notesDir, cacheDir, userCwd)` | `startBackgroundRebuild()` → `runOnce()`，`:863`、`:906` |
| 它的 `rebuilding`／`pending` 旗標只讓 watcher **和自己**排隊，不知道有別的行程在 build | `:897`、`:927` |

所以「編輯 `docs/` 之後的第一次失敗」並不是編輯本身有什麼特別，而是**編輯就是 watcher 被觸發的那一刻**；你手動跑的那一次剛好和它撞上。這也解釋了為什麼 **CI 不會踩到**（CI 沒有 `serve` 在跑），以及為什麼它是**間歇**的——兩邊的 content-sync 階段都落在 build 的最前面一小段（整次 build 約 25～30 秒，這一段目測只有一兩秒，**沒有實際量過**），要撞在同一個瞬間才會壞。

**一個否定結果也記下來**：2026-11-12 另外做過 A／B——「編輯後立刻 build」對「編輯後等 watcher 跑完才 build」，各 3 回，**兩邊都 3／3 PASS，沒有分開**（當時 `serve` 確實開著、watcher 也確實在觸發）。所以**不能**說「編輯後立刻 build 就會失敗」；watcher 有 300ms debounce 又有自己的佇列，它那一輪落在什麼時間點不受你控制。

**實務規則：會和別的 build 平行跑的 agent，給它自己的 git worktree**（不同路徑 → 不同雜湊）；否則請它不要跑 build，改讀既有產物。本 loop 的獨立審查會平行跑，所以這條直接決定每次派工怎麼下指示。

兩個前提要寫出來，否則照做的人會卡住：

- **worktree 要先有 `node_modules`。** `notecraftapp` 是 repo 的 devDependency，`pnpm exec` 靠 `node_modules/.bin/` 解析；剛 `git worktree add` 出來的 worktree 沒有它，命令會直接找不到。symlink 回主 checkout 就夠（build 用的是 app 的 `node_modules`，不是這一份）。
- **SDD 角色不適用這條。** `AGENTS.md` §SDD Workflow 明寫「Do not give an SDD role its own worktree or its own issue」。那裡沒有衝突：會建置的 SDD 角色只有 `technical-writer`，而 SDD 的 apply 是逐群組**序列**派工的，不會有兩個 SDD build 同時跑。真正要避開的是**主流程與被派出去的角色同時建置**——那由派工的一方負責錯開。


## 機械編輯的驗證陷阱

這三條都是**檢查全綠、東西其實壞了**的形狀，維護者 2026-11-12 裁示記進來（[Issue #292](https://github.com/label-suite/label-suite/issues/292)）。它們的共同點是：**驗證的對象和要保證的事不是同一件**，所以綠燈不代表什麼。

### 一、`s.count(pattern) == 1` 不驗縮排

用「這個模式在檔案裡只出現一次」當安全檢查，只保證**唯一**，不保證**縮排對**：6 個空白的模式是 8 個空白那一行的子字串，所以它會命中，而你插進去的那一段少了 2 格。

判例（2026-11-12，#195）：`design/prototype/pages/account/profile.html` 的 i18n 鍵實際縮 **8** 格、`zh:`／`en:` 縮 **6** 格；我拿 6 格的模式去比對，命中之後插進去的鍵全部少 2 格。接著寫的「修正」腳本又反過來把 `zh:`／`en:` 從 6 改成 8——兩次都「只命中一次」。最後是 `git show origin/main:<檔案>` 才定出哪一邊是真的。

怎麼做：模式要**連同縮排一起寫進去**（從檔案裡複製整行，不要手打），或改用「比對整行、不是比對片段」的方式；拿不準就 `git show origin/main:<檔案>` 看原樣。

### 二、「全部編輯都成功才寫檔」會靜默丟掉做對的編輯

把多筆編輯收集起來、最後一次寫入，任何一條斷言拋錯就整批不寫——**前面已經算好的正確編輯一起消失**，而語法檢查仍然是綠的（檔案根本沒被改壞，它只是沒被改）。

判例（2026-11-12，#195）：`setState` 的兩態切換與 `applyLang` 的三處新增同時消失，是回頭逐條對規格才發現的，當時所有機械檢查都通過。

怎麼做：**逐條 apply-and-write**。每一條編輯自己斷言、自己落地；某一條失敗就只有那一條沒做，而且看得出來是哪一條。

### 三、斷言物件屬性不等於斷言畫面行為

測試裡寫 `expect(el.hidden).toBe(true)` 只證明**那個屬性被設了**，不證明**畫面上真的看不到**。CSS 的作者規則會蓋掉瀏覽器預設。

判例（2026-11-12，#195）：`register.html` 在「驗證信已寄出」之後設 `btn.hidden = true`，harness 的 `submitBtn.hidden === true` 通過；但 `.submit-btn { display: flex }` 是作者規則、勝過瀏覽器預設的 `[hidden] { display: none }`，所以按鈕還看得見。由獨立審查抓到，修法是補一條 `.submit-btn[hidden] { display: none; }`。

怎麼做：斷言要落在**使用者看得到的那一層**（有沒有那個樣式規則、算出來的 `display` 是什麼），不是只落在屬性上；寫下「這個屬性要生效，需要哪一條 CSS 配合」並把那一條也驗進去。


## 驗收

這件事做完的定義：

1. `scripts/check-specs.mjs` 的三個缺陷都已修好並有單元測試；`annotation/015` 擷出 480 條、`06-01` 的既有對照表 46／46 不回歸（D9）。
2. `docs/specs/` 有 18 頁規格（含已完成的 06-01），模組地圖 18 列全部有連結、沒有「（未撰寫）」。
3. `pnpm check:specs` 與 `pnpm exec notecraftapp build docs` 全綠（build 的重跑規則見[§建置閘門要重跑確認](#建置閘門要重跑確認)）。
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
