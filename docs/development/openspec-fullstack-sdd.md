---
title: OpenSpec：fullstack-sdd schema 評估
description: Spike #47 的結論。盤點 scaffold 的 fullstack-sdd 九份產物與關卡、哪些適用 FastAPI 加前端的本專案、clarify skill 與驗收 agent 值不值得引入，以及分三階段的導入建議與要改的檔案清單。
tags: [openspec, sdd, schema, spike, fullstack-sdd]
---

# OpenSpec：fullstack-sdd schema 評估

這份文件是 Spike [#47](https://github.com/label-suite/label-suite/issues/47) 的結論，交給維護者決定要不要導入、導入到哪一層。
本 Spike 不修改 `openspec/`；決定之後的實作另開 Issue。

調查對象與本專案現況：

| 項目 | 內容 |
| :--- | :--- |
| 調查對象 | `trendlink/fullstack-ai-sdd-workflow-scaffold`，commit `7198845`（2026-11-04），本機路徑 `~/project/fullstack-ai-sdd-workflow-scaffold` |
| scaffold 的 schema | `openspec/schemas/fullstack-sdd/`，九份產物 |
| 本專案的 schema | `openspec/config.yaml` 的 `schema: spec-driven`（openspec 內建四份產物） |
| openspec 版本 | 本專案 `@fission-ai/openspec` 1.14.1；scaffold 的 skill 產自 1.15.0 |
| 本專案程式現況 | `backend/`、`frontend/` 都還不存在，只有 `docs/`、`design/prototype/`、`openspec/`、`scripts/` |

## 結論

fullstack-sdd 的價值集中在兩個地方：**把業務分析從技術設計裡拆出來**（`system-analysis`），
以及**在推導 specs 之前擋一道品質閘**（`clarification` 加 `clarify` skill）。這兩個和 NestJS 無關，現在就能用。

真正綁死 NestJS 的是 `system-design`、`api-contract`、`ui-design` 三份與對應的 `sd`、`ui-ux`、`acceptance-verifier` agent。
它們的必讀清單與驗收指令全部指向 `api/src/`、`web/src/`、`npm run contract:sync`、`POST /dev/auth/token`，
本專案一條都不成立，現在導入只會得到一批指向不存在目錄的死文件。

建議分三階段，依本專案程式的進度推進：

| 階段 | 前提 | 導入內容 | 產物數 |
| :--- | :--- | :--- | :--- |
| 一 | 現在 | `system-analysis`、`clarification`、`sa`／`planner`／`design-reviewer` agent | 6 |
| 二 | `backend/` 骨架與第一個 API 可跑 | `system-design`、`api-contract`、`sd` agent、`acceptance-verifier`（改寫成 FastAPI 版） | 8 |
| 三 | 前端框架與元件庫定案 | `ui-design`、`ui-ux` agent、契約同步機制 | 9 |

## 一、fullstack-sdd 盤點

### 九份產物

前五份是 fullstack-sdd 新增的，後四份是 openspec 內建 `spec-driven` 的四份，只在 `instruction` 末尾加上「先讀上游產物」「遵守 clarification 的決議」。

| # | 產物 | 依賴 | 用途 | 撰寫角色 | 綁 NestJS |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `system-analysis.md` | 無 | 需求依據盤點、範圍、業務流程引用、跨模組依賴、需求矛盾、待決問題。明文禁止出現框架、資料表、端點名稱 | `sa` | 無 |
| 2 | `system-design.md` | 1 | 後端分層 Class Diagram、每個關鍵 Scenario 一張 Sequence Diagram、資料模型異動與 migration 可逆性、權限檢查點 | `sd` | 高 |
| 3 | `ui-design.md` | 1 | 頁面與路由、元件樹、每塊資料的 operationId 與快取鍵、loading／error／empty／無權限四種狀態、design token 對應 | `ui-ux` | 中 |
| 4 | `api-contract.md` | 2 | 前後端唯一的交接依據：端點、request／response 欄位、錯誤碼、需要的角色、遮蔽欄位與遮蔽後的值 | `sd` | 中 |
| 5 | `proposal.md` | 1,2,3,4 | 與 `spec-driven` 相同，加上「先讀前四份、不得與之矛盾」與引用的規格編號 | `planner` | 無 |
| 6 | `clarification.md` | 5 | 品質閘。依 `clarify` skill 的八個面向檢查前五份，Q 逐一問使用者、P 直接修正，決議寫下來交給後續產物 | 主 agent | 低 |
| 7 | `specs/**/*.md` | 6 | 與 `spec-driven` 相同，加上「Scenario 沿用規格書驗收標準的名稱」「遮蔽時 payload 的樣子」 | `planner` | 無 |
| 8 | `design.md` | 6 | 與 `spec-driven` 相同，加上「決策要對應到 system-design 或 api-contract 的段落」 | `planner` | 無 |
| 9 | `tasks.md` | 4,7,8 | 與 `spec-driven` 相同，加上每個 task 標一個負責角色、可平行的放同群組、後端有改動就以 `contract:sync` 收尾 | `planner` | 中 |

依賴不只是文件上的說法，CLI 會擋。在 `openspec 1.14.1` 下用這個 schema 開一個空 change，`openspec status` 的輸出是：

```text
Progress: 0/9 artifacts complete

[ ] system-analysis
[-] system-design (blocked by: system-analysis)
[-] ui-design (blocked by: system-analysis)
[-] api-contract (blocked by: system-design)
[-] proposal (blocked by: system-analysis, system-design, ui-design, api-contract)
[-] clarification (blocked by: proposal)
[-] specs (blocked by: clarification)
[-] design (blocked by: clarification)
[-] tasks (blocked by: api-contract, specs, design)
```

`system-design` 與 `ui-design` 都只依賴 `system-analysis`，所以兩者可平行；`sd` 寫完 `system-design` 才能寫 `api-contract`。

### 六道關卡

關卡不在 schema 的 `artifacts` 裡，而是散在 `openspec/config.yaml` 的 `context`、`rules`、`operations` 三處。

| # | 關卡 | 位置 | 判定 | 不通過的結果 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 待決問題關卡 | `rules.system-analysis`、`sa` agent | `system-analysis` 的待決問題有任一項未決 | 不進入下一份產物，停下來問使用者 |
| 2 | clarification 關卡 | `clarification` artifact、`clarify` skill | 八個面向都要有結論，Q 全部決議、P 全部修正 | 不產生 specs；使用者對某個 Q 選擇暫不決定就停止 propose |
| 3 | 規劃審閱 | `rules.tasks` 末條 | `tasks` 定稿後先提交，再由 `design-reviewer` 審閱 | 修訂由 `planner` 另開 commit |
| 4 | 每群組 lint | `operations.apply` | 群組動到的子專案 lint 必須通過，不得用 `eslint-disable` 略過 | 不提交該群組 |
| 5 | 程式審查 | `operations.apply` | 全部 task 完成且工作區乾淨後由 `code-reviewer` 審查 | 修正由實作角色另開 commit |
| 6 | 驗收關卡 | `operations.archive`、`acceptance-verifier` | 每個 Scenario 與 DoD 逐項驗收，報告寫 `acceptance.md` | 判定不通過即不可歸檔 |

另外每個階段（propose、apply、archive）結束時自動提交，提交後停止等使用者確認，所以三個階段之間還各有一道人工關卡。

### 和 NestJS 綁在一起的部分

| 位置 | 綁的內容 | 本專案的對應 |
| :--- | :--- | :--- |
| `openspec/config.yaml` `context` | NestJS 11 加 TypeORM 加 PostgreSQL、`api/`／`web/` 兩個目錄、`@nestjs/swagger` 產 `openapi.json`、Orval 產前端型別、`npm run contract:sync`、OIDC 與 `AUTH_MODE=dev`、admin／viewer 兩個角色 | FastAPI、`backend/`／`frontend/`、Email 加密碼登入、PRD 權限矩陣的多個角色 |
| `openspec/config.yaml` `context` 的「結構」「提交」「分支」 | meta repo：`api/`、`web/` 是各自獨立的 git repo，一個 commit 不跨 repo | 單一 repo，提交規則在 `AGENTS.md` |
| `rules.tasks` | `[@backend-developer]`、`[@frontend-developer]`、`[@dba]`、`[@technical-writer]` 四個角色標記；收尾 task 固定是 `npm run contract:sync`；JSDoc 依 `.claude/rules/jsdoc.md` | 角色名可沿用，指令要換成 `uv`／`pnpm`；JSDoc 規則本專案沒有 |
| `operations.apply`／`archive` | `npm run lint`、`npm run check`、`eslint-plugin-jsdoc` | 本專案目前只有 `pnpm check:specs`、`pnpm test:scripts` |
| `templates/system-design.md` | `ExampleController` → `ExampleService` → `ExampleEntity` 的分層、`ApiResponseDto` 回應包裝 | FastAPI 的 Router → Service → Repository／Model，回應包裝待定 |
| `templates/api-contract.md` | response 寫「`data` 內容」，預設有統一包裝 | 同上 |
| `templates/ui-design.md` | shadcn 元件與語意 token | `design/prototype/assets/tokens.css` 與 `label-suite-design` skill |
| `sd` agent | NestJS 分層、TypeORM、`ApiResponseDto`、`@nestjs/swagger`、必讀 `api/src/modules/`、`api/src/core/auth/`、`api/openapi.json` | 整份要改寫 |
| `ui-ux` agent | React 19 加 Vite、Orval 的 TanStack Query hooks、shadcn、`lucide-react`、必讀 `web/src/app/`、`web/src/components/ui/`、`web/src/styles/themes/` | 整份要改寫，且前端框架未定案 |
| `acceptance-verifier` agent | `docker compose up -d`、`npm run migration:run`、`POST /dev/auth/token`、Playwright 寫在 `web/e2e/`、`npm run contract:sync`、`npm run check` | 驗收步驟的骨架可留，指令全部要換 |
| `backend-developer`、`frontend-developer`、`dba`、`technical-writer`、`code-reviewer` | 全部綁 TypeScript 生態與 `.claude/rules/*.md` | 本專案沒有 `.claude/rules/`，規則在 `AGENTS.md` |

`.claude/rules/` 是個獨立的問題：scaffold 有六個 agent 引用它，用 `paths:` frontmatter 做條件載入。
本專案的 Hard Rule 1 是「`AGENTS.md` 是唯一的規則來源」，所以任何引進來的 agent 都要把這些引用改成指向 `AGENTS.md` 的章節。

## 二、適用性

### 本專案與 scaffold 的落差

| 面向 | scaffold | 本專案 | 影響 |
| :--- | :--- | :--- | :--- |
| 後端 | NestJS 11 加 TypeORM | FastAPI（`backend/pyproject.toml`），目錄還不存在 | `system-design` 要改寫 |
| 前端 | React 19 加 Vite 加 shadcn 加 Orval 加 TanStack Query | 只有 HTML prototype，框架與元件庫未定案 | `ui-design` 現在寫不出來 |
| 套件管理 | npm | `uv`（Python）、`pnpm`（JavaScript） | 所有指令要換 |
| repo 結構 | meta repo 加兩個子 repo | 單一 repo | `context` 的提交與分支段落不適用 |
| 登入 | OIDC，admin／viewer | Email 加密碼，PRD 權限矩陣多角色 | 驗收取 token 的方式要重寫 |
| 規則來源 | `.claude/rules/` 加 `CLAUDE.md` | `AGENTS.md` 單一來源 | agent 的引用要改寫 |
| agent | 18 個 | 0 個（`.claude/agents/` 不存在） | 要新建 |
| 需求文件 | `docs/specs/` 加 `00-prd.mdx`，`prd-writing`／`spec-writing` 產生 | 完全相同（#29、#30 已引入並在地化） | `sa`、`planner` 的假設可直接沿用 |
| design token | shadcn 語意 token | `design/prototype/assets/tokens.css` 加 `label-suite-design` skill | `ui-design` 的 token 段落要換來源 |

最後兩列是關鍵：本專案的 `docs/specs/` 章節（目標、使用角色、業務流程、規格、卡控機制、邊界情況、驗收標準、待釐清、已確認決議）
和 scaffold 同源，`scripts/check-specs.mjs` 還在機器檢查這些章節存在。
`sa` agent 的「業務流程引用規格書、不重畫」與 `planner` 的「Scenario 沿用驗收標準的名稱」兩條規則因此可以原封不動沿用。

### 逐項判斷

| 產物 | 判斷 | 說明 |
| :--- | :--- | :--- |
| `system-analysis` | **照搬，只改路徑** | template 零技術用語；`sa` agent 只需把 schema 路徑與 `.claude/rules` 引用換掉 |
| `clarification` | **照搬骨架，加兩個面向** | 八個面向中有五項可改用上游產物檢查；見下一節 |
| `proposal`／`specs`／`design` | **照搬** | 與 `spec-driven` 的差異只有「先讀上游」「沿用驗收標準的 Scenario 名稱」「遵守 clarification 決議」三句，都與技術棧無關 |
| `tasks` | **小改** | 角色標記可沿用；`npm run contract:sync` 要換成 FastAPI 版的契約同步指令，JSDoc 那條刪掉 |
| `system-design` | **改寫，階段二** | 分層換成 FastAPI 的 Router → Service → Repository／Model，migration 換 Alembic，回應包裝要先定案 |
| `api-contract` | **改寫，階段二** | 骨架（端點、角色、錯誤碼、遮蔽欄位）通用；operationId 在 FastAPI 預設是由函式名與路徑組出來的長字串，要用 `generate_unique_id_function` 固定成「動詞加資源」才能當交接依據 |
| `ui-design` | **改寫，階段三** | 四種狀態、資料來源、元件樹的骨架通用；shadcn 與 Orval 的部分要等前端定案才知道換成什麼 |

不需要的部分：`.claude/rules/*.md` 的引用、`AUTH_MODE=dev` 的 `POST /dev/auth/token`、TypeORM 的 migration 慣例、
`ApiResponseDto` 這個字面名稱、meta repo 的提交與分支規則。

值得本專案加進去、scaffold 沒有的部分：`AGENTS.md` 的 Hard Rule 5（任務類型由設定驅動，新增任務類型不得改核心程式）
與 Hard Rule 6（測試集答案不外露）都是規劃階段就該擋的事，等到 `code-reviewer` 或驗收才發現已經太晚。

## 三、clarify skill 與驗收 agent

### clarify：建議引入，並加兩個檢查面向

`clarify` 有關卡與完整兩種模式。關卡模式在 propose 流程內、`proposal` 之後 `specs` 之前執行，
檢查八個面向（規格完整性、API Contract、邏輯一致性、可行性、邊界情況、跨功能影響、可測試性、規格範圍），
需要使用者決定的項目（Q）用 `AskUserQuestion` 逐一問、不自行假設，明確問題（P）直接修正，
決議與回修位置寫進 `clarification.md`，全數通過才繼續產生 specs。

建議引入，三個理由：

1. 和本專案的規格寫法咬合。`docs/specs/` 的規格書有「待釐清」與「已確認決議」兩個章節，
   `clarify` 的 Q／P 機制正好把規格層的未決項擋在 specs 之前，而不是讓它變成 OpenSpec 裡的假設。
   `clarify` 的步驟 7 明文要求「決議會改變需求時，先用 `spec-writing` 改 `docs/specs/` 的規格書」，與本專案
   `openspec/config.yaml` 既有的「delta 與 `docs/specs/` 不一致時以 `docs/specs/` 為準」完全一致。
2. 成本低。它是一個 skill 加一份 artifact，不需要新的 CLI、CI 或目錄，也不需要程式存在。
3. 擋得住本專案特有的風險。建議在八個面向之外加兩項：
   - **任務設定驅動**（對應 Hard Rule 5）：這次的行為有沒有寫死某一種任務類型？新增任務類型要不要改核心程式？
   - **測試集答案不外露**（對應 Hard Rule 6）：標記員能到達的端點與畫面，payload 裡有沒有標準答案或測試集標記？

已知的代價與風險：

- 八個面向裡，「API Contract」整項與「可行性」「跨功能影響」的一部分依賴 `api-contract`、`ui-design` 與既有程式。
  階段一還沒有這三者，這些項目只能標「後續產物」，產出會偏薄。這不是錯，但要先知道第一次用起來的樣子。
- `/opsx:propose` 從「一次跑完」變成「中途停下來問 Q、等回答才繼續」。這是刻意的設計，但體感差異要先講清楚。

### acceptance-verifier：概念保留，現在不引入

它的設計本身值得學：以 spec 的 Scenario 為唯一準繩做黑箱驗收、用 Decision Table 展開「角色 × 動作 × 資料狀態 × 輸入」、
判定不通過即不可歸檔、驗收報告寫成 `acceptance.md`，而且明確和 `code-reviewer` 分工（它不看程式風格，只看行為）。
對本專案的 Hard Rule 6 特別有用：它會用多個角色的 token 實際呼叫每個端點，逐欄位核對遮蔽欄位的回傳值。

但現在不要引入。它的每一個步驟都是可執行指令，本專案一條都不成立：
`docker compose up -d`、`npm run migration:run`、`POST /dev/auth/token`、`web/e2e/**/*.spec.ts`、`psql`、`npm run contract:sync`、`npm run check`。
在 `backend/` 還不存在時放進去，`operations.archive` 會要求一個跑不起來的驗收關卡，結果是每次歸檔都要手動略過，關卡反而失效。

建議等 `backend/` 的第一個 API 可跑之後再引入，屆時要重寫的是：啟動與 migration 指令（`uv`、Alembic）、
取得各角色 token 的方式（Email 加密碼登入或測試用 fixture）、API 驗收改用 `pytest` 加 `httpx`、
e2e 的語言與位置、DoD 的指令清單。驗收步驟的骨架（Scenario 清單、Decision Table、API 驗收、前端驗收、DoD、缺陷報告格式）可以照留。

### 其他角色

| agent | 現在有用 | 說明 |
| :--- | :--- | :--- |
| `sa` | 是 | 只讀需求文件，不碰程式。改掉 schema 路徑與 `.claude/rules` 引用即可 |
| `planner` | 是 | 寫 proposal／specs／design／tasks，必讀清單都是 OpenSpec 與 `docs/specs/` |
| `design-reviewer` | 是 | 只審不改，必讀清單全是規劃產物 |
| `ops` | 是 | 機械性雜務（同步主規格、archive、更新文件索引）；GitHub label 那段要改成本專案的 Issue 規則 |
| `sd` | 階段二 | 整份綁 NestJS |
| `acceptance-verifier` | 階段二 | 見上 |
| `ui-ux` | 階段三 | 前端未定案 |
| `backend-developer`／`frontend-developer`／`dba`／`technical-writer`／`code-reviewer` | 階段二、三 | 綁 TypeScript 生態與 `.claude/rules/` |
| `mdx-writer`／`note-scanner`／`visualize-planner`／`present-planner`／`slide-generator`／`component-generator` | 不在本 Spike 範圍 | NoteCraft 與投影片相關，與 schema 無關 |

本專案的 `CLAUDE.md` 已經有 subagent 規則（一個 subagent 一個 issue 一個 worktree、subagent 的回報不算證據），
和 fullstack-sdd 的多 agent 派工相容；但要注意 fullstack-sdd 的派工是「同一個 change 內依 schema 順序派給不同角色」，
和 `CLAUDE.md` 說的「平行 subagent 各自一個 worktree、不共用 issue」是兩種不同的用法，導入時要在 `AGENTS.md` 或 `CLAUDE.md` 說清楚兩者的界線。

### 對 `/opsx:*` 流程的影響

**skill 本身不用改。** 本專案 `.claude/skills/openspec-*/SKILL.md` 與 scaffold 的同名檔案逐行比對，
差異只有 openspec 版號（1.14.1 對 1.15.0）與 1.15.0 多出的輸出路徑檢查，沒有一行和 schema 綁定。
`openspec-propose` 的做法是跑 `openspec status --change <name> --json` 拿到待產生的 artifact，
再對每一份跑 `openspec instructions <artifact-id> --change <name> --json`，依回傳的 `instruction` 與 `template` 產生檔案。
換 schema 等於換這兩個指令的回傳內容，skill 的步驟不變。

**派工順序寫在 config，不在 skill。** scaffold 的 `sa → sd ∥ ui-ux → planner → clarify` 是 `openspec/config.yaml`
`context` 裡的三行「規劃階段」規則，所以這套派工是可攜的，不需要改 skill，也不需要改 `.claude/commands/opsx/*.md`。

**兩套 schema 可以並存。** 已驗證 `openspec 1.14.1` 支援：

- `openspec schemas --json` 會同時列出 `source: "project"` 的專案 schema 與 `source: "package"` 的內建 schema
- `openspec new change <name> --schema <name>` 可以逐個 change 選 schema
- 每個 change 的 `.openspec.yaml` 會記下自己用哪個 schema（既有三個 archive 的 change 都是 `schema: spec-driven`）

所以可以讓文件類、工具類的小 change 繼續用 `spec-driven`，功能類的 change 用新 schema，不必一次全面切換。
`openspec-propose` 的規則是「使用者沒有明確指定就用預設 schema」，所以哪一個當預設，決定了不指定時走哪條路。

**要注意的時機問題。** 改 schema 檔案本身（例如階段二加入 `system-design`）會立刻改變所有引用它的 change 的
`requires` 與 `status`，進行中的 change 會突然多出未完成的產物。建議只在沒有進行中 change 的時候改 schema。
已歸檔的 change 不受影響，它們只剩下當時產生的檔案。

**成本。** 產物從 4 份變 9 份，每個 change 的 propose 階段 token 與時間都會明顯上升，還多一輪互動問答。
看本專案已歸檔的三個 change（user-management 的三次迭代）的粒度，九份產物對那種大小的 change 不划算。
這是建議分階段、而且保留 `spec-driven` 當小 change 選項的主要原因。

## 四、建議方案

### 階段一：現在就能做

目標是把 `system-analysis` 與 `clarification` 兩道價值最高、又不依賴程式的環節先放進流程，產物六份。

| # | 檔案 | 動作 | 內容 |
| :--- | :--- | :--- | :--- |
| 1 | `openspec/schemas/label-suite-sdd/schema.yaml` | 新增 | 以 `openspec schema fork spec-driven label-suite-sdd` 產生骨架，再把 fullstack-sdd 的 `system-analysis`、`clarification` 兩份 artifact 定義搬進來，調整 `requires`：`system-analysis` → `proposal` → `clarification` → `specs`／`design` → `tasks` |
| 2 | `openspec/schemas/label-suite-sdd/templates/system-analysis.md` | 新增 | 由 fullstack-sdd 同名 template 搬入，零技術用語，可幾乎照搬 |
| 3 | `openspec/schemas/label-suite-sdd/templates/clarification.md` | 新增 | 由 fullstack-sdd 同名 template 搬入，檢查結論表加「任務設定驅動」「測試集答案不外露」兩列 |
| 4 | `openspec/schemas/label-suite-sdd/templates/{proposal,spec,design,tasks}.md` | 新增 | fork 會帶出內建的四份，不改 |
| 5 | `openspec/config.yaml` | 修改 | `schema:` 換成 `label-suite-sdd`；`context` 加「規劃階段」的派工與停下規則（`sa` → `planner` 寫 proposal → 主 agent 執行 clarify → `planner` 寫 specs、design、tasks）；加 `rules.system-analysis`、`rules.clarification`、`rules.specs`、`rules.tasks`；加 `operations.apply`、`operations.archive`，指令用 `pnpm`／`uv` |
| 6 | `.claude/skills/clarify/SKILL.md` | 新增 | 由 scaffold 搬入並在地化：檢查範圍改成階段一的六份產物、八個面向加兩項、`.claude/rules` 的引用改成 `AGENTS.md` 的章節、`api/`／`web/` 的路徑改成 `backend/`／`frontend/` 並註明目前還不存在 |
| 7 | `.agents/skills/clarify/SKILL.md` | 新增 | 與上一份同步的副本（Codex 讀這個目錄，與既有九個 skill 的做法一致） |
| 8 | `.claude/agents/sa.md` | 新增 | 由 scaffold 搬入，改 schema 路徑、`docs/specs/` 已相同不用改 |
| 9 | `.claude/agents/planner.md` | 新增 | 同上，必讀清單去掉 `system-design`／`ui-design`／`api-contract` 三份 |
| 10 | `.claude/agents/design-reviewer.md` | 新增 | 同上，審閱範圍改成階段一的六份 |
| 11 | `AGENTS.md` | 修改 | 在「Development Workflow」或新增一節，寫明 OpenSpec 規劃階段的角色分工、兩道關卡，以及「同一個 change 內依 schema 派工」與「平行 subagent 各自一個 worktree」的界線 |
| 12 | `docs/development/spec-authoring.md` | 修改 | 「怎麼交給 `/opsx:propose`」那段補上新增的兩份產物與 clarify 關卡會停下來問 Q |
| 13 | `docs/development/openspec-fullstack-sdd.md` | 修改或刪除 | 決策完成後，這份評估改寫成導入紀錄，或連同 Issue 一起歸檔 |

要先決定「`label-suite-sdd` 當預設、小 change 另外指定 `--schema spec-driven`」還是反過來。
建議新 schema 當預設，因為忘記指定時走較嚴的流程比較安全。

### 階段二：`backend/` 骨架與第一個 API 可跑之後

| # | 檔案 | 動作 | 內容 |
| :--- | :--- | :--- | :--- |
| 1 | `openspec/schemas/label-suite-sdd/schema.yaml` | 修改 | 加入 `system-design`、`api-contract` 兩份 artifact 與 `requires`；`proposal` 的 `requires` 加這兩份；`tasks` 的 `requires` 加 `api-contract` |
| 2 | `openspec/schemas/label-suite-sdd/templates/system-design.md` | 新增 | Class Diagram 改成 FastAPI 分層；資料模型異動改 Alembic 的可逆性；回應包裝依屆時的定案 |
| 3 | `openspec/schemas/label-suite-sdd/templates/api-contract.md` | 新增 | 骨架照搬；response 段落依屆時的回應包裝調整 |
| 4 | `.claude/agents/sd.md` | 新增 | 整份改寫成 FastAPI 加 SQLAlchemy 加 Alembic；必讀路徑換成 `backend/`；加上 operationId 要用 `generate_unique_id_function` 固定 |
| 5 | `.claude/agents/acceptance-verifier.md` | 新增 | 驗收骨架照留，指令換成 `uv`、Alembic、`pytest` 加 `httpx`；取 token 改成本專案的登入方式；加上 Hard Rule 6 的逐端點檢查 |
| 6 | `.claude/agents/{backend-developer,dba,code-reviewer,technical-writer}.md` | 新增 | 改寫成 Python 生態，規則引用改 `AGENTS.md` |
| 7 | `openspec/config.yaml` | 修改 | `context` 補後端技術棧、契約同步機制與角色；`operations.archive` 加驗收關卡 |
| 8 | `.claude/skills/clarify/SKILL.md`、`.agents/skills/clarify/SKILL.md` | 修改 | 「API Contract」面向從「後續產物」改成實際檢查 |

### 階段三：前端框架與元件庫定案之後

| # | 檔案 | 動作 | 內容 |
| :--- | :--- | :--- | :--- |
| 1 | `openspec/schemas/label-suite-sdd/schema.yaml` | 修改 | 加入 `ui-design`，`proposal` 的 `requires` 加它 |
| 2 | `openspec/schemas/label-suite-sdd/templates/ui-design.md` | 新增 | 四種狀態與資料來源的骨架照搬；元件與 token 段落改成引用 `label-suite-design` skill 與 `design/prototype/assets/tokens.css` |
| 3 | `.claude/agents/ui-ux.md` | 新增 | 改寫；Prototype 來源改成 `design/prototype/pages/`，token 來源改 `label-suite-design` |
| 4 | `.claude/agents/frontend-developer.md` | 新增 | 依屆時的前端技術棧改寫 |
| 5 | 契約同步 | 新增 | FastAPI 產 `openapi.json`、前端產型別的 `pnpm` 指令，以及 `rules.tasks` 的收尾 task |

### 不建議做的事

- **一次把九份產物與 18 個 agent 全部搬進來。** 一半以上的必讀清單與驗收指令會指向不存在的目錄，
  agent 讀不到就會自行推測，比沒有這些產物更糟。
- **為了湊齊產物而建立 `.claude/rules/`。** 與 Hard Rule 1「`AGENTS.md` 是唯一的規則來源」衝突。
  引進來的 agent 一律把規則引用指向 `AGENTS.md` 的章節。
- **直接沿用 scaffold 的 `operations` 指令。** `npm run lint`、`npm run check`、`eslint-plugin-jsdoc`
  在本專案都不存在，寫進去等於每次都要手動略過，關卡會失去效力。
- **在有進行中 change 的時候改 schema 檔案。** `requires` 一變，進行中的 change 會突然多出未完成的產物。

### 待維護者決定

1. 要不要分三階段導入，還是整套等 `backend/`、`frontend/` 都存在之後一次做。
2. 新 schema 的名字（本文暫用 `label-suite-sdd`），以及哪一個當 `openspec/config.yaml` 的預設。
3. 階段一是否包含 `AGENTS.md` 的修改（第 11 項）。它會改到唯一規則來源，影響所有 agent。
4. `clarify` 的兩個新面向（任務設定驅動、測試集答案不外露）要寫在 skill 裡，還是寫成 `rules.clarification`。
5. 這份評估文件在決策完成後要改寫成導入紀錄，還是刪除。

## 驗證紀錄

為避免只憑閱讀下判斷，以下在本機實際跑過（在 scratchpad 的臨時 openspec 目錄，未改動本專案的 `openspec/`）：

| 驗證 | 指令 | 結果 |
| :--- | :--- | :--- |
| 1.14.1 接受 fullstack-sdd schema | `openspec schema validate fullstack-sdd` | `✓ Schema 'fullstack-sdd' is valid` |
| 兩套 schema 並存 | `openspec schemas --json` | 同時列出 `source: "project"` 的 `fullstack-sdd` 與 `source: "package"` 的 `spec-driven` |
| 逐 change 選 schema | `openspec new change probe-a --schema fullstack-sdd` | 建立成功，`.openspec.yaml` 寫入 `schema: fullstack-sdd` |
| 依賴由 CLI 強制 | `openspec status --change probe-a` | `0/9`，並列出每一份的 `blocked by` |
| fork 可產生專案 schema 骨架 | `openspec schema fork spec-driven label-suite-sdd` | 產生 `schema.yaml` 與 `templates/{proposal,spec,design,tasks}.md` 四份，`schemas` 隨即列出 `source: "project"` 的新 schema |
| skill 與 schema 無關 | 逐行比對本專案與 scaffold 的 `openspec-*/SKILL.md` | 差異只有 openspec 版號與 1.15.0 多出的輸出路徑檢查 |
| 既有 change 的 schema 紀錄 | 讀 `openspec/changes/archive/*/.openspec.yaml` | 三個都是 `schema: spec-driven` |
