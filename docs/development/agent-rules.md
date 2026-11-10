---
title: 'Agent 開發規範'
description: '跨領域的開發規範說明：先搜尋再新增、依賴方向、最小變更、不過度抽象、衝突處理與範圍鎖定。附四個參考來源的逐類對照（沿用／改寫／不採用）與開工前置條件。AGENTS.md 是規則本體，這一份是它的說明。'
category: '開發說明'
tags: [開發說明, Agent, 規範]
createdAt: '2026-11-10'
updatedAt: '2026-11-10'
---

# Agent 開發規範

:badge[Issue #105]{variant="neutral"} :badge[正式開發前]{variant="warning"}

> `AGENTS.md` 是**規則本體**（single rule source）。這一份是它的說明：展開理由、正反例與檢查方式。
> 兩邊說法不同時**以 `AGENTS.md` 為準**，並回報給維護者。
> 本 repo **不建立** `.claude/rules/` 這種第二份 canon（#53 的決議，本文件不推翻它）。

## 這一份管什麼

跨領域、不分 backend／frontend／e2e 都適用的那幾條。分領域的規範各自有自己的 Issue：

| 領域 | 說明文件 | 負責的 Issue | 狀態 |
| :--- | :--- | :--- | :--- |
| 跨領域（本文件） | `docs/development/agent-rules.md` | [#105](https://github.com/label-suite/label-suite/issues/105) | 本次建立 |
| 後端分層、資料庫、背景工作 | [backend-agent-rules.md](backend-agent-rules.md) | [#106](https://github.com/label-suite/label-suite/issues/106) | 2026-11-10 建立 |
| 授權、答案隔離、設定驅動邊界 | 待建置 | [#107](https://github.com/label-suite/label-suite/issues/107) | **待建置** |
| API 契約同步、單一前端 Client | 待建置 | [#108](https://github.com/label-suite/label-suite/issues/108) | **待建置** |
| 前端依賴方向、型別安全、UI 共用 | 待建置 | [#109](https://github.com/label-suite/label-suite/issues/109) | **待建置** |
| 測試分層、雙資料庫驗證、交付證據 | 待建置 | [#110](https://github.com/label-suite/label-suite/issues/110) | **待建置** |

**「待建置」就是字面意思**：那些文件還不存在，所以也還沒有任何檢查在跑。本文件不代那幾張寫內容，`AGENTS.md` 的索引也照實標成待建置——依 #105 的附註，尚無可執行檢查的規範必須註明待建置，不得宣稱已通過。

技術基準（選型、分層、ADR 效力）在 [architecture.md](architecture.md)，不在這裡重複。

---

## 規範

每一條都交付六件事：適用路徑、禁止事項、正例、反例、例外條件、檢查方式。**來源**一律標在最後。

### R1 先搜尋再新增

| | |
| :--- | :--- |
| **適用路徑** | 全部 |
| **禁止** | 在沒有搜尋過既有實作之前，新增 helper、util、型別、常數或相依套件 |
| **正例** | 要格式化日期 → 先 grep 既有的日期工具 → 找到就用它 |
| **反例** | 直接寫一個新的 `formatDate()`，而同一個資料夾已經有一個 |
| **例外** | 搜尋過、確認沒有，且在 commit body 或 PR 寫明搜過什麼 |
| **檢查方式** | **人工／獨立審查**。沒有自動檢查——`grep` 搜過什麼無法事後驗證，所以要寫在 PR 裡 |
| **來源** | 原始 repo `general.md` §Simplicity First 的 reach-for ladder 第 2 階，以及 §AI Agent Non-Negotiables 的「先讀既有匯出與呼叫端」 |

開工前先讀那一區既有的匯出、呼叫端與共用工具。

### R2 依賴方向

| | |
| :--- | :--- |
| **適用路徑** | `frontend/`（還不存在，所以這一條**現在沒有適用對象**）。**`backend/` 由 [backend-agent-rules.md](backend-agent-rules.md) 的 B1 取代**——那一條寫明了層級與允許的 import，比這裡具體 |
| **禁止** | 反向依賴：被依賴的那一層回頭 import 依賴它的那一層 |
| **正例** | 前端：`pages` → `features` → 共用的 `components/ui`（具體分層待 [#109](https://github.com/label-suite/label-suite/issues/109)）。**後端版本見 [backend-agent-rules.md](backend-agent-rules.md) 的 B1** |
| **反例** | `components/ui` 的元件 import `features` 的東西；或共用層回頭依賴頁面層 |
| **例外** | 無 |
| **檢查方式** | **待建置**。後端的具體分層已由 [#106](https://github.com/label-suite/label-suite/issues/106) 定（見 B1），前端待 [#109](https://github.com/label-suite/label-suite/issues/109)；兩邊的自動檢查都要等實際有程式 |
| **來源** | **無來源條文。** 三份來源檔都沒有這一條；它來自 #105 工作項 6 的點名。**後端那一半已於 2026-11-10 移進 B1**；前端那一半等 [#109](https://github.com/label-suite/label-suite/issues/109)，屆時這一條就只剩跨領域的原則敘述 |

模組內分層（`app/modules/<module>/`）已由維護者 2026-11-10 裁定，見 [architecture.md](architecture.md)；後端的落地規則見 [backend-agent-rules.md](backend-agent-rules.md) 的 B1。

### R3 最小變更

| | |
| :--- | :--- |
| **適用路徑** | 全部 |
| **禁止** | 改動與本次請求無關的程式、註解或排版；刪除本次改動之前就存在的死碼 |
| **正例** | 只改那一行；發現旁邊有死碼 → **提出來**，不刪 |
| **反例** | 順手把整個檔案重排版，讓 diff 從 3 行變 300 行 |
| **例外** | 本次改動**自己造成**的孤兒（變成沒人用的 import、變數、函式）要清掉 |
| **檢查方式** | **人工／獨立審查**。測試是「每一行改動都能直接追到請求本身」 |
| **來源** | 原始 repo `general.md` §Surgical Changes（整節沿用，去掉行數門檻） |

**不設固定的檔案數或行數門檻**——見下方「刻意不採用的機械限制」。

### R4 不過度抽象

| | |
| :--- | :--- |
| **適用路徑** | 全部 |
| **禁止** | 為單一使用點建立抽象；加入沒有被要求的「彈性」或「可設定性」；為不可能發生的情境寫錯誤處理 |
| **正例** | 兩個地方有同一段邏輯，而它**確實是同一個概念** → 抽成一個小的共用函式 |
| **反例** | 兩個地方剛好長得像、但語意不同 → 硬抽成一個帶 `mode` 參數的函式 |
| **例外** | 共用的邏輯、驗證與常數**必須**只有一處定義（這是 `AGENTS.md` 硬性規則 5 的精神：不硬寫任務邏輯） |
| **檢查方式** | **人工／獨立審查** |
| **來源** | 原始 repo `general.md` §Simplicity First 開頭四條、§DRY 的「一處邏輯一處定義」、§Design Principles 的「DRY 過度抽象時 KISS 優先」 |

DRY 與 KISS 衝突時**以 KISS 為先**：重複兩次而語意不同，不是抽象的理由。

### R5 衝突處理

| | |
| :--- | :--- |
| **適用路徑** | 全部 |
| **禁止** | 以「比較新」或「比較好測」為理由自行選邊；靜默挑一個 |
| **正例** | 發現兩套相反的慣例 → 先查本 repo 的**已確認決議**（`docs/specs/` 的已確認決議、`architecture.md` 的 ADR 效力表、`AGENTS.md`）→ 有決議就照決議 |
| **反例** | 「A 的寫法比較新，所以照 A」然後繼續做下去 |
| **例外** | 無。沒有決議可循時**回報維護者並停下來**，不自己裁 |
| **檢查方式** | **人工／獨立審查**。`scripts/check-specs.mjs` 的 `BASES` 只驗規格頁的決議有沒有寫出依據，不驗程式層的慣例衝突 |
| **來源** | **改寫**原始 repo `general.md` §Conflicting Patterns（原文要求 `pick one (prefer newer or better-tested)`，本條反轉它）；依 #105 工作項 5 |

這一條**刻意與參考來源相反**，見[§來源對照](#來源對照)。理由：本 repo 已經有一套「已確認決議」的機制（五個依據、機械檢查），自行選邊會繞過它。

### R6 範圍鎖定後不得以 YAGNI 刪驗收條件

| | |
| :--- | :--- |
| **適用路徑** | 全部 |
| **禁止** | 實作階段以「用不到」為理由，刪掉或略過 issue／規格已承諾的驗收條件；把延後的需求藏在程式註解裡 |
| **正例** | 覺得某條驗收條件不該做 → 回到那張 issue 或規格頁提出來，由維護者決定 |
| **反例** | `// YAGNI: 這個情境應該不會發生，先不做` 然後把 tasks 的那一項打勾 |
| **例外** | **範圍還開著的時候**（規劃階段、`/sdd` 的停點一）可以主張某項不做，但要寫進該 change 的 `proposal.md` 或 issue，不是寫在程式裡 |
| **檢查方式** | **人工**。打勾的工作項與實際交付物的對照目前沒有自動檢查 |
| **來源** | #105 工作項 7。原始 repo `general.md` §Simplicity First 的 reach-for ladder 第 1 階有同向的說法（「Rung 1 是範圍問題，屬 Planner，不得在 apply 階段觸發」），本條沿用那個分界 |

延後的需求回到 Issue 或規格決策，**不藏在程式註解**——註解裡的待辦是第二個沒有人讀的 backlog。

### R7 不確定就明說

| | |
| :--- | :--- |
| **適用路徑** | 全部 |
| **禁止** | 任何一步沒有完整驗證卻當成通過；靜默失敗 |
| **正例** | 「這個 job 只能在 runner 上驗證，本機驗不到」寫進 PR 的 Test Plan 並留未勾 |
| **反例** | Test Plan 全部打勾，而其中一項其實沒跑過 |
| **例外** | 無 |
| **檢查方式** | **人工／獨立審查**。`AGENTS.md` 的 Required Behaviors 已有「工具呼叫失敗兩次就回報確切錯誤」 |
| **來源** | 原始 repo `general.md` §Fail Loudly |

---

## 刻意不採用的機械限制

參考來源有幾條以**數量**定成敗的規則。本 repo **不採用**，依 #105 的工作項 6：

| 不採用的門檻 | 出處 | 為什麼不採用 |
| :--- | :--- | :--- |
| 「寫了 200 行而其實 50 行就夠 → 重寫」 | 原始 repo `general.md` | 行數不是複雜度。50 行的爛抽象比 200 行的直白程式更難改 |
| 「同一段程式出現 2 次以上 → 抽出共用」 | 原始 repo `general.md` | 出現兩次不代表是同一個概念。R4 的例外已經覆蓋真正該共用的情形 |
| 「一張 PR 不得超過 5 個檔案或 300 行 diff」 | 原始 repo `git-workflow.md`（Constitution Principle X） | 本 repo 以**單一目的**判斷 PR 大小（`AGENTS.md` 的 Pull Requests：一句話說不清就拆）。行數門檻會逼人把一個目的拆成兩張，反而更難審 |

**不採用不等於不在意**：R3 與 R4 管的是同一件事，只是用「能不能追到請求」與「是不是同一個概念」當判準，而不是數字。

---

## 開工前置條件

[architecture.md](architecture.md) §待決清單 的項目**不是建議，是前置條件**：沒有維護者的裁定，相關的程式工作不開工。

截至 2026-11-10 的狀態：

| 待決項目 | 狀態 |
| :--- | :--- |
| 後端目錄分層 | ✅ **已裁定**（2026-11-10）：模組內分層 `app/modules/<module>/` |
| 成功回應格式 | ✅ **已裁定**（2026-11-10）：包一層 envelope（204、檔案與串流為例外） |
| API 前綴 | ✅ **已裁定**（2026-11-10）：`/api/v1` |
| 前端版本與分層、元件庫 | ✅ **已裁定**（2026-11-10）：React 19、`pages/` ＋ `features/`、`components/ui/` |
| Bruno | ✅ **已裁定**（2026-11-10）：降級成可選工具，拿掉 pre-PR 硬關卡 |
| operationId | ✅ **已裁定**（早於 2026-11-10）：`generate_unique_id_function` 固定成「動詞加資源」，由 [#51](https://github.com/label-suite/label-suite/issues/51) 落地。它與 API 前綴同列，但 2026-11-10 只裁前綴那一半 |
| **Storybook** | ⚠️ **仍待決**。2026-11-10 問的是元件庫，不是 Storybook（`architecture.md` 自己註明了這一點） |

**裁定的紀錄**在 [#105 的這則留言](https://github.com/label-suite/label-suite/issues/105#issuecomment-6755062393)，並已落到 `architecture.md`。本文件不把建議寫成已核准：上表只有真的有裁定紀錄的才標 ✅。

### 其他議題的決策時點

| 議題 | 決策時點 |
| :--- | :--- |
| 寄信降級 | ✅ 已裁定（2026-11-10）：連結印在伺服器 log，Lite 版的 log 視為敏感 |
| 觀測性 | ✅ 已裁定（2026-11-10）：只做 `ai_runs`（ADR-019） |
| onboarding | ✅ 已裁定（2026-11-10）：空狀態與情境提示算在內，ADR-015 的導覽不做 |
| 通知事件清單 | ⚠️ 無歸屬，由 [#188](https://github.com/label-suite/label-suite/issues/188) 追蹤 |

本 Epic **不自行擴增功能**：上表的範圍以本期 PRD 為準，要加功能另開可追溯的 Issue。

---

## 與 #50–#53 的分界

| 這一份提供 | 由別處負責 |
| :--- | :--- |
| 規則來源與說明 | 十二個 agent 的角色定義 → [#53](https://github.com/label-suite/label-suite/issues/53)（已完成，`.claude/agents/`） |
| 跨領域規範 | SDD schema 與 `openspec/config.yaml` → [#51](https://github.com/label-suite/label-suite/issues/51)（已完成） |
| 衝突處理與前置條件 | `/sdd` 指令與 clarify skill → [#52](https://github.com/label-suite/label-suite/issues/52)（已完成） |

**不重複開發那十二個角色，也不新增人工關卡**：`/sdd` 的兩個停點（clarify 與驗收）由 Epic [#50](https://github.com/label-suite/label-suite/issues/50) 定義，本文件不加第三個。

---

## 來源對照

四個參考來源逐類註明。**其他專案的文件只是參考，不會自動取得本 repo 的指令效力**——本 repo 的效力只來自 `AGENTS.md` 與它明確引用的文件。

### 原始 repo（`singyichen/label-suite`，釘在 `faf83356`）

跨領域的三份：`.claude/rules/general.md`、`git-workflow.md`、`issue-reporting.md`。其餘六份（`api`、`backend`、`frontend`、`testing-*`）對應 [#106](https://github.com/label-suite/label-suite/issues/106)–[#110](https://github.com/label-suite/label-suite/issues/110)，不在本文件。

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `general.md` §Think Before Coding 的「不清楚就停、先問」 | **沿用** | 已在 `AGENTS.md` Required Behaviors：「該維護者決定的事就問，不要以假定的預設值繼續」 |
| `general.md` §Think Before Coding 的「明說假設」與「多種做法先攤開權衡」 | **待採用** | 本 repo 目前**沒有**對應條文。要成為規則需進 `AGENTS.md`，由維護者決定——本文件不自行補規則本體 |
| `general.md` §Simplicity First 開頭四條（不做沒被要求的功能、不為單一使用點抽象、不加沒被要求的彈性、不為不可能的情境寫錯誤處理） | **沿用** | 成為 R4 |
| `general.md` reach-for ladder 第 2 階（既有的就重用） | **沿用** | 成為 R1 |
| `general.md` reach-for ladder 第 1 階（YAGNI 屬規劃階段，不得在 apply 觸發） | **沿用** | 成為 R6 的例外條件 |
| `general.md` reach-for ladder 第 3、4、6 階（stdlib、原生平台功能、能一行就一行） | **待採用** | R1 與 R4 都**沒有**覆蓋這三階。可用，但需要有 `backend/`／`frontend/` 才有意義 |
| `general.md` reach-for ladder 第 5 階（不為幾行程式新增相依） | **沿用** | 與 `AGENTS.md` 硬性規則 3 同向（相依一律走 `uv add`／`pnpm add`，所以新增相依是刻意的動作） |
| `general.md` §Surgical Changes | **沿用** | 成為 R3 |
| `general.md` §DRY 的「一處邏輯一處定義」 | **沿用** | 成為 R4 的例外條件 |
| `general.md` §Design Principles 的「DRY 過度抽象時 KISS 優先」 | **沿用** | 成為 R4 的收尾一句 |
| `general.md` §Design Principles 的 SOLID、一函式一事、一模組一責任 | **待採用** | 本 repo 目前沒有條文。後端分層由 [#106](https://github.com/label-suite/label-suite/issues/106) 定時一併處理比較合適 |
| `general.md` §Security 第二條（不硬寫 API key／token，用環境變數） | **沿用** | 已在 `AGENTS.md` 硬性規則 8 |
| `general.md` §Security 第三條（CORS 不得 `allow_origins=["*"]`） | **沿用** | 已在 `AGENTS.md` 硬性規則 7 |
| `general.md` §Security 第一條（所有使用者輸入都要驗證與淨化，防 SQL Injection 與 XSS） | **沿用** | 本 repo 原本兩邊都沒有（grep `sanitiz`／`validat`／`injection`／`xss` 零命中）。**維護者 2026-11-10 裁定它進 Hard Rules**，本次已加為 `AGENTS.md` **硬性規則 9**（原第 9 條的破壞性指令順延為第 10 條；全 repo grep 過，沒有任何文件引用到那兩個編號） |
| `general.md` §AI Agent Non-Negotiables 的「`uv add`／`pnpm add`」 | **沿用** | 已在 `AGENTS.md` 硬性規則 3 |
| `general.md` §AI Agent Non-Negotiables 的「不改版號」 | **沿用** | 已在 `AGENTS.md` 硬性規則 4 |
| `general.md` §AI Agent Non-Negotiables 的「移除 debug `print`／`console.log`」 | **沿用** | 已在 `AGENTS.md` Required Behaviors |
| `general.md` §AI Agent Non-Negotiables 的「先讀既有匯出與呼叫端」 | **沿用** | 成為 R1 |
| `general.md` §AI Agent Non-Negotiables 的「後端指令一律走 `uv run`」 | **沿用** | 維護者 2026-11-10 裁定它歸 [#106](https://github.com/label-suite/label-suite/issues/106)，**已落地於 [backend-agent-rules.md](backend-agent-rules.md) 的 B2**。不進 `AGENTS.md` Hard Rules——它是後端指令的細節，而且在沒有 `backend/` 之前沒有適用對象 |
| `general.md` §Fail Loudly | **沿用** | 成為 R7 |
| **`general.md` §Conflicting Patterns（「pick one, prefer newer or better-tested」）** | **改寫** | **這一條被反轉**。本 repo 改成 R5：照已確認決議，沒有決議就回報維護者。理由：本 repo 已有「五個依據＋機械檢查」的決議機制，自行選邊會繞過它 |
| `general.md` 的「200 行→50 行」與「出現 2 次就抽」 | **不採用** | 機械門檻，見[§刻意不採用的機械限制](#刻意不採用的機械限制) |
| `general.md` 的 `ponytail:` 標記（含其 MIT 出處） | **不採用** | 那個標記綁著外部 skill 的工具鏈，本 repo 沒有那條工具鏈 |
| `general.md` §What simplicity does not override 的 Red test contracts（`senior-qa`、`--cov-fail-under=80`）與兩份 constitution | **不採用** | 本 repo 沒有那些憲章與角色。測試門檻由 [#110](https://github.com/label-suite/label-suite/issues/110) 定 |
| `general.md` §What simplicity does not override 的 Prose outside code（commit body 要 WHY、PR／issue 是審查文件） | **沿用** | 已在 `AGENTS.md` Commits（每條 bullet 粗體動詞加原因）與 Pull Requests |
| `general.md` 把 `specs/` 當 SSoT 的寫法 | **改寫** | 本 repo 的業務需求來源是 `docs/specs/`、可測契約是 `openspec/specs/`，兩者分開 |
| `git-workflow.md` §PR Scope 單一目的與「一句話不含 and／also」的判準 | **沿用** | 已在 `AGENTS.md` Pull Requests |
| `git-workflow.md` §What counts as one purpose 的分類 | **改寫** | 本 repo 用自己的五類表（[spec-migration.md](spec-migration.md) §PR 的變更範圍） |
| `git-workflow.md` §What must be split into separate PRs 的五條 | **沿用** | 與 `AGENTS.md` 的單一目的規則同向，但本 repo**沒有逐條列出**；要列的話屬 `AGENTS.md` 的 Pull Requests 一節 |
| `git-workflow.md` §Relationship to commit convention 的「一個 commit 一個目的」 | **沿用** | 已在 `AGENTS.md` Commits（One purpose per commit） |
| `git-workflow.md` §Size guardrails 的「5 檔／300 行」門檻 | **不採用** | 機械門檻，同上 |
| `git-workflow.md` 引用的 ADR-033 Rule 1（寫回 `specs/[module]/spec.md`） | **不採用** | 本 repo 沒有那個寫回流程 |
| `issue-reporting.md` 的情境→issue 類型對照表 | **沿用（兩類未納入）** | `AGENTS.md` 的 Issue types and titles 有 9 列，來源有 13 列；**未納入的是「效能回歸超出目標門檻」與「CI/CD 失敗兩次後」**（兩者在本 repo 會落到 `[Bug]`，但沒有明文列出來） |
| `issue-reporting.md` 的安全升級協定 | **沿用** | 已在 `AGENTS.md` 的 Security findings |
| `issue-reporting.md` 的語言規則 | **沿用** | 已在 `AGENTS.md` 的 Language Rules |
| `issue-reporting.md` §Templates（讀 `.github/issue-templates.md` 再逐字填） | **沿用** | 已在 `AGENTS.md` 的 Issue types and titles 末句 |
| `issue-reporting.md` 的 team-lead／specialist 轉報路由與 Progress Report 格式 | **不採用** | 本 repo 沒有 team-lead 這個角色，而 #53 的十二個 agent 都有 Bash，可自行開 issue |

### scaffold（`fullstack-ai-sdd-workflow-scaffold`，本機）

`.claude/rules/` 有 **16 份**，它的 `index.md` 自己把四份歸成「**共通（前後端）**」—— 那四份正是本文件的範圍，其餘 12 份歸 [#106](https://github.com/label-suite/label-suite/issues/106)–[#110](https://github.com/label-suite/label-suite/issues/110)。

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `typescript.md` 禁止 `any` | **沿用** | 已在 `AGENTS.md` 硬性規則 7 |
| `typescript.md` 禁止非空斷言 `!`、禁止 `as`、`as const` 取代 enum、named export | **待採用** | 本 repo 沒有這些條文。前端型別安全歸 [#109](https://github.com/label-suite/label-suite/issues/109) |
| `date-handling.md` 日期一律走單一入口、禁止 `new Date()`／`Date.now()` | **待採用** | 本 repo 沒有條文，也還沒有 `frontend/`。歸 [#109](https://github.com/label-suite/label-suite/issues/109) |
| `jsdoc.md` 最嚴格 JSDoc（所有具名函式、方法、class、interface 與欄位） | **待採用** | 本 repo 沒有條文。注意它要求 DTO 欄位與 `@ApiProperty` 一致，而本 repo 的後端是 FastAPI 不是 NestJS，照搬不成立 |
| `testing.md` 測試名詞 unit／integration／e2e、Decision Table、TDD | **待採用** | 歸 [#110](https://github.com/label-suite/label-suite/issues/110) |
| 其餘 12 份（`database`、`api-contract`、`auth-oidc`、`dto-boolean`、`integration-test-http`、`jest-mock-queue`、`frontend`、`api-client`、`design-tokens`、`notecraft-*`、`index`） | **不在本文件** | 分領域，歸 #106–#110；其中 `notecraft-*` 兩份本 repo 已有自己的版本（`docs/development/notecraft-writing.md`、`notecraft-visualize.md`） |
| `index.md` 的「規則帶 `paths:` 自動載入、index 永遠載入」機制 | **不採用** | 本 repo **不建立** `.claude/rules/`（#53 的決議）。等價的目錄功能由 `AGENTS.md` 的 Agent Rules Index 承擔 |
| SDD 流程骨架（九份產物、兩個停點、十二個角色） | **沿用** | 屬 Epic [#50](https://github.com/label-suite/label-suite/issues/50) 的範圍，已由 #51／#52／#53 落地，本文件不重述 |
| `--schema spec-driven` 的預設 | **改寫** | 改成本 repo 自己的 `label-suite-sdd`（#51） |

### duty-mate（`trendlink/duty-mate`，釘在 `c53cc453`，`develop` 分支）

**這個來源存在**，只是不在個人帳號底下而在 `trendlink` 組織，而且 `.claude/rules/` 只在 `develop`（`main` 只有兩行 `README.md`）。`.claude/rules/` 有 **12 份**。

**它的技術棧與本 repo 不同**：duty-mate 是 NestJS ＋ Handlebars ＋ SQLite／TypeORM，本 repo 是 FastAPI ＋ React ＋ PostgreSQL（見 [architecture.md](architecture.md)）。所以多數規則**不採用的理由是棧不同，不是規則不好**。

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `typescript.md` 禁止 `any` | **沿用** | 已在 `AGENTS.md` 硬性規則 7（與 scaffold 同一條，兩個來源一致） |
| `typescript.md` 禁止非空斷言 `!`、命名與匯出規範 | **待採用** | 同 scaffold 那一列，歸 [#109](https://github.com/label-suite/label-suite/issues/109) |
| `date-handling.md` 日期一律從單一入口 import、禁止 `new Date()`／`Date.now()` | **待採用** | 與 scaffold 同向（兩個來源都這樣要求），歸 [#109](https://github.com/label-suite/label-suite/issues/109) |
| `index.md` 的「規則帶 `paths:` frontmatter 自動載入、index 永遠載入、新增規則不改 `CLAUDE.md`」 | **不採用** | 同 scaffold：本 repo 不建 `.claude/rules/`（#53）。不過**「新增規則不改 `CLAUDE.md`」這個目標本文件照辦了**——索引在 `AGENTS.md`，新增分領域文件只動 `docs/development/` |
| `integration-test-http.md`（`listen(0,'127.0.0.1')`、`closeTestApp`、harness 不比 production 寬鬆） | **不在本文件** | 測試分層歸 [#110](https://github.com/label-suite/label-suite/issues/110)；而且它是 NestJS 的 harness，FastAPI 要重寫 |
| `database.md`（SQLite ＋ TypeORM、禁原生 SQL、migration 規範） | **不採用** | 棧不同：本 repo 是 PostgreSQL ＋ SQLAlchemy／Alembic。資料庫規範歸 [#106](https://github.com/label-suite/label-suite/issues/106) |
| `hbs-partials.md`、`hbs-inline-script.md`、`icon-usage.md`、`tailwind-theme.md` | **不採用** | Handlebars 與該專案的 Tailwind 設定專屬，本 repo 用 React |
| `command.md`（nest-commander ＋ `@inquirer/prompts`） | **不採用** | 棧不同 |
| `dto-boolean.md`、`jest-mock-queue.md` | **不採用** | NestJS／Jest 專屬；本 repo 後端是 pytest |

### starter-kit

**對不上。** #105 點名的是 starter-kit 的 `core-principles.md` 與 `workflow.md`。

已查：`trendlink` 組織底下所有 repo（含 `claude-plugins`、`trendlink-portal`、`lexpayroll`、`trendmile`、`fullstack-ai-sdd-workflow-scaffold`）、個人帳號、以及本機 `find ~ -name "core-principles*"`，**都沒有這兩個檔案**。本機唯一叫 starter-kit 的 `whest-starterkit` 是高斯動差／QMC 取樣的科學計算起始包（`.claude/agents/` 底下是 `gaussian-moment-analyst`、`qmc-sampling-specialist`），兩個檔案都不存在。

**維護者 2026-11-10 裁定：該來源不存在或已不適用，從 #105 的工作項移除。** 所以這一類沒有對照可做，也不再是缺口。

> **這一節的教訓記在這裡**：本文件第一版把 duty-mate 也寫成「找不到」，並附了一份「已查」清單——而那份清單只掃了個人帳號與本機，**從來沒掃組織**。附帶搜尋清單的否定結論會勸退後面的人再查，所以結論錯了會錯得更久。獨立審查用 `gh search repos` 一次就找到。

## 變更紀錄

| Issue | 日期 | 變更 |
| :--- | :--- | :--- |
| [#105](https://github.com/label-suite/label-suite/issues/105) | 2026-11-10 | 初版。七條跨領域規範（各帶適用路徑、禁止、正反例、例外、檢查方式與來源）、刻意不採用的三個機械門檻、開工前置條件、與 #50–#53 的分界，以及四個來源的逐條對照 |
| [#105](https://github.com/label-suite/label-suite/issues/105) | 2026-11-10 | 獨立審查後修正四處：**duty-mate 其實存在**（`trendlink/duty-mate`，初版誤記為找不到，搜尋沒掃組織），補上 12 份規則的逐條對照；**兩列「沿用」改成「待採用」**（`general.md` 的輸入驗證與 `uv run` 在本 repo 兩邊都沒有條文）；scaffold 補上 16 份規則裡四份「共通」的逐條對照；**operationId 由 ⚠️ 待決改為 ✅ 已裁定**（早先已由 #51 落地，#105 留言明寫 2026-11-10 只裁前綴）。另把被誇大的「沿用」範圍逐列拆開（Think Before Coding、reach-for ladder、Design Principles、issue 類型對照表） |
| [#105](https://github.com/label-suite/label-suite/issues/105) | 2026-11-10 | 依維護者當日的三項裁定收尾：`general.md` §Security 第一條（輸入驗證與淨化）**進 `AGENTS.md` 硬性規則 9**，對照表那一列由「待採用」改「沿用」；`uv run` 裁定歸 #106，維持待採用但已有歸屬；**starter-kit 那一類裁定從工作項移除**（該來源不存在或已不適用） |
