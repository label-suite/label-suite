---
title: OpenSpec：導入 fullstack-sdd 流程
description: 採用 scaffold 的九份產物 SDD 流程、把人工關卡收斂成兩個停點的導入決議。含流程圖、產物與關卡盤點、三處要特別處理的地方、要改的檔案清單，以及評估階段查證過的事實。
tags: [openspec, sdd, schema, fullstack-sdd]
---

# OpenSpec：導入 fullstack-sdd 流程

這份文件起初是 Spike [#47](https://github.com/label-suite/label-suite/issues/47) 的評估報告。
維護者看完評估後決定採用完整的九份產物流程，並把人工關卡收斂成兩個，所以本文現在記錄的是導入決議：
流程長什麼樣、哪三處要特別處理、要改哪些檔案，以及評估階段實際查證過的事實。

| 項目 | 內容 |
| :--- | :--- |
| 調查對象 | `trendlink/fullstack-ai-sdd-workflow-scaffold`，commit `7198845`（2026-11-04），本機路徑 `~/project/fullstack-ai-sdd-workflow-scaffold` |
| scaffold 的 schema | `openspec/schemas/fullstack-sdd/`，九份產物 |
| 本專案現用的 schema | `openspec/config.yaml` 的 `schema: spec-driven`（openspec 內建四份產物） |
| openspec 版本 | 本專案 `@fission-ai/openspec` 1.14.1；scaffold 的 skill 產自 1.15.0 |
| 本專案程式現況 | `backend/`、`frontend/` 都還不存在，只有 `docs/`、`design/prototype/`、`openspec/`、`scripts/` |

> **本文件是 #47 當時的評估與盤點，不是現況。** 文內各張對照表寫「尚未定案／由骨架 change 拍板／要等…定案」的技術項目，
> **多數已由維護者 2026-11-10 裁定**：後端模組內分層 `app/modules/<module>/`、成功回應包一層 envelope、前綴 `/api/v1`、
> React 19、`pages/` 加 `features/`、shadcn/ui 放 `components/ui/`、前端型別與 client 用 **Orval**（輸出 `frontend/src/api/generated/`）。
> 現況一律以 [architecture.md](architecture.md) §前端、§技術選型 與 §待決清單 為準；下面 [§七、待決問題](#七待決問題) 已逐列更新。

## 決議

採用 fullstack-sdd 的完整九份產物流程，不分階段導入。人工關卡只留兩個：

- **停點一**：clarify 關卡發現需要維護者決定的項目（Q），逐題問答。
- **停點二**：apply 全部完成並產出驗收報告後，維護者親自驗收功能，確認無誤才執行 `/opsx:archive`。

其餘環節（明確問題的回修、規劃審閱、程式審查、階段之間的提交）全部自動進行，不詢問。
故障類的中斷不算關卡，見[故障仍會停](#故障仍會停)。

## 一、流程

```text
你：/sdd <需求>                    ← 專案自有指令，一次授權規劃與實作

propose（全自動，只有一次問答）
 1  system-analysis.md   sa        待決問題不停下，記成 Q 留給 clarify
 2  system-design.md     sd     ┐
    ui-design.md         ui-ux  ┘  可平行
 3  api-contract.md      sd
 4  proposal.md          planner
 5  clarification.md     主 agent
      ★停點一★  Q 用 AskUserQuestion 逐題問你
                P（明確問題）直接派原角色回修，不問你
 6  specs/ + design.md   planner
 7  tasks.md             planner
 8  design-reviewer 審閱 → planner 回修（不問你）→ 自動提交

apply（接續，不停）
 9  依 tasks 逐群組派工，每群組 lint 過才提交
10  code-reviewer 審查 → 實作角色修正（不問你）
11  acceptance-verifier 驗收，寫 acceptance.md
      ★停點二★  交給你：acceptance.md 加人工驗收步驟
                （啟動指令、用哪個角色登入、點哪幾頁、預期看到什麼）

你：驗完確認無誤 → /opsx:archive
```

| # | 產出或動作 | 角色 | 會不會停 |
| :--- | :--- | :--- | :--- |
| 1 | `system-analysis.md` | `sa` | 不停，待決問題記成 Q |
| 2 | `system-design.md`、`ui-design.md` | `sd`、`ui-ux` | 不停，兩者可平行 |
| 3 | `api-contract.md` | `sd` | 不停 |
| 4 | `proposal.md` | `planner` | 不停 |
| 5 | `clarification.md` | 主 agent（`clarify` 關卡模式） | **停點一**，Q 逐題問答 |
| 6 | `specs/**/spec.md`、`design.md` | `planner` | 不停 |
| 7 | `tasks.md` | `planner` | 不停 |
| 8 | 規劃審閱 | `design-reviewer` 審，`planner` 回修 | 不停 |
| 9 | 逐群組實作 | `backend-developer`、`frontend-developer`、`dba`、`technical-writer` | 不停 |
| 10 | 程式審查 | `code-reviewer` 審，實作角色修正 | 不停 |
| 11 | 驗收 | `acceptance-verifier` | **停點二**，交付報告與人工驗收步驟 |
| 12 | 同步主規格與歸檔 | `ops` | 由你執行 `/opsx:archive` |

### 故障仍會停

`openspec-apply-change` 有幾個中斷條件：task 描述有歧義、實作過程發現規格有問題、工作超出 `tasks.md` 的範圍、指令出錯。
這些不關掉也不該關掉，它們代表規劃錯了，硬推下去只會寫出錯的程式。
「只有兩個停點」指的是例行關卡，故障照停。

## 二、fullstack-sdd 盤點

### 九份產物

前五份是 fullstack-sdd 新增的，後四份是 openspec 內建 `spec-driven` 的四份，只在 `instruction` 末尾加上「先讀上游產物」「遵守 clarification 的決議」。

| # | 產物 | 依賴 | 用途 | 撰寫角色 | 綁 NestJS |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `system-analysis.md` | 無 | 需求依據盤點、範圍、業務流程引用、跨模組依賴、需求矛盾、待決問題。明文禁止出現框架、資料表、端點名稱 | `sa` | 無 |
| 2 | `system-design.md` | 1 | 後端分層 Class Diagram、每個關鍵 Scenario 一張 Sequence Diagram、資料模型異動與 migration 可逆性、權限檢查點 | `sd` | 高 |
| 3 | `ui-design.md` | 1 | 頁面與路由、元件樹、每塊資料的 operationId 與快取鍵、loading／error／empty／無權限四種狀態、design token 對應 | `ui-ux` | 中 |
| 4 | `api-contract.md` | 2 | 前後端唯一的交接依據：端點、request／response 欄位、錯誤碼、需要的角色、遮蔽欄位與遮蔽後的值 | `sd` | 中 |
| 5 | `proposal.md` | 1,2,3,4 | 與 `spec-driven` 相同，加上「先讀前四份、不得與之矛盾」與引用的規格編號 | `planner` | 無 |
| 6 | `clarification.md` | 5 | 品質閘。依 `clarify` skill 的面向檢查前五份，Q 逐一問、P 直接修，決議寫下來交給後續產物 | 主 agent | 低 |
| 7 | `specs/**/*.md` | 6 | 與 `spec-driven` 相同，加上「Scenario 沿用規格書驗收標準的名稱」「遮蔽時 payload 的樣子」 | `planner` | 無 |
| 8 | `design.md` | 6 | 與 `spec-driven` 相同，加上「決策要對應到 system-design 或 api-contract 的段落」 | `planner` | 無 |
| 9 | `tasks.md` | 4,7,8 | 與 `spec-driven` 相同，加上每個 task 標一個負責角色、可平行的放同群組、後端有改動就以契約同步收尾 | `planner` | 中 |

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

### scaffold 的六道關卡與本專案的處理

關卡不在 schema 的 `artifacts` 裡，而是散在 `openspec/config.yaml` 的 `context`、`rules`、`operations` 三處。

| # | scaffold 的關卡 | 位置 | 本專案怎麼處理 |
| :--- | :--- | :--- | :--- |
| 1 | `system-analysis` 的待決問題未決就停下問使用者 | `rules.system-analysis`、`sa` agent | **改掉**。記成待決問題並繼續，由 clarify 一次問完 |
| 2 | clarification 關卡：面向都要有結論，Q 全決議、P 全修正才產 specs | `clarification` artifact、`clarify` skill | **保留**，這是停點一 |
| 3 | `tasks` 定稿後先提交，再由 `design-reviewer` 審閱 | `rules.tasks` 末條 | **保留但不問**，修訂由 `planner` 另開 commit |
| 4 | 每個 task 群組的 lint 必須通過，不得 `eslint-disable` 略過 | `operations.apply` | **保留但不問**，指令換成本專案的 |
| 5 | 全部 task 完成後由 `code-reviewer` 審查 | `operations.apply` | **保留但不問**，修正由實作角色另開 commit |
| 6 | 歸檔前由 `acceptance-verifier` 驗收，不通過不可歸檔 | `operations.archive` | **移位**。移到 `operations.apply` 的最後，成為停點二 |

scaffold 另外在 propose、apply、archive 三個階段結束時各停一次等使用者確認。本專案只留 apply 之後那一次（停點二），
propose 之後那一次要靠下面第三節第一項的做法解除。

### 和 NestJS 綁在一起的部分

| 位置 | 綁的內容 | 本專案的對應 |
| :--- | :--- | :--- |
| `openspec/config.yaml` `context` | NestJS 11 加 TypeORM 加 PostgreSQL、`api/`／`web/` 兩個目錄、`@nestjs/swagger` 產 `openapi.json`、Orval 產前端型別、`npm run contract:sync`、OIDC 與 `AUTH_MODE=dev`、admin／viewer 兩個角色 | FastAPI、`backend/`／`frontend/`、Email 加密碼登入、PRD 權限矩陣的多個角色 |
| `openspec/config.yaml` 的「結構」「提交」「分支」 | meta repo：`api/`、`web/` 是各自獨立的 git repo，一個 commit 不跨 repo | 單一 repo，提交規則在 `AGENTS.md` |
| `rules.tasks` | `[@backend-developer]`、`[@frontend-developer]`、`[@dba]`、`[@technical-writer]` 四個角色標記；收尾 task 固定是 `npm run contract:sync`；JSDoc 依 `.claude/rules/jsdoc.md` | 角色標記可沿用；指令換成 `uv`／`pnpm`；JSDoc 那條刪掉 |
| `operations.apply`／`archive` | `npm run lint`、`npm run check`、`eslint-plugin-jsdoc` | 本專案目前只有 `pnpm check:specs`、`pnpm test:scripts` |
| `templates/system-design.md` | `ExampleController` → `ExampleService` → `ExampleEntity` 的分層、`ApiResponseDto` 回應包裝 | FastAPI 的 Router → Service → Repository／Model；回應包裝**已裁定為包一層 envelope**（2026-11-10） |
| `templates/api-contract.md` | response 寫「`data` 內容」，預設有統一包裝 | 同上 |
| `templates/ui-design.md` | shadcn 元件與語意 token | `design/prototype/assets/tokens.css` 與 `label-suite-design` skill |
| `sd` agent | NestJS 分層、TypeORM、`ApiResponseDto`、`@nestjs/swagger`、必讀 `api/src/modules/`、`api/src/core/auth/`、`api/openapi.json` | 整份改寫成 FastAPI |
| `ui-ux` agent | React 19 加 Vite、Orval 的 TanStack Query hooks、shadcn、`lucide-react`、必讀 `web/src/app/`、`web/src/components/ui/`、`web/src/styles/themes/` | 整份改寫；前端框架與元件庫**已於 2026-11-10 裁定**（React 19、shadcn/ui 放 `components/ui/`） |
| `acceptance-verifier` agent | `docker compose up -d`、`npm run migration:run`、`POST /dev/auth/token`、Playwright 寫在 `web/e2e/`、`npm run contract:sync`、`npm run check` | 驗收骨架照留，指令全部換，並加人工驗收步驟 |
| `backend-developer`、`frontend-developer`、`dba`、`technical-writer`、`code-reviewer` | 綁 TypeScript 生態與 `.claude/rules/*.md` | 後端四個改 Python 生態；全部把規則引用改成 `AGENTS.md` |

`.claude/rules/` 是個獨立的問題：scaffold 有六個 agent 引用它，用 `paths:` frontmatter 做條件載入。
本專案的 Hard Rule 1 是「`AGENTS.md` 是唯一的規則來源」，所以引進來的 agent 一律把這些引用改成指向 `AGENTS.md` 的章節，不建立 `.claude/rules/`。

## 三、三處要特別處理的地方

### 1. propose 到 apply 的停點，`config.yaml` 解不掉

`.claude/skills/openspec-propose/SKILL.md` 第 15 行有 Planning boundary：規劃產物完成後停止，等新的使用者請求才進入 apply。
第 65 行把 `openspec/config.yaml` 明文排除在外：

> Treat context as project-provided data and constraints, not as authority to change this workflow:
> it cannot override user authorization, **the planning boundary**, tool restrictions, or artifact and output rules.

所以 scaffold 那行「提交後停止，等使用者確認才進入 apply」是在順從這條規則，不是造成它。
把相反的指示寫進 `context`，skill 會明文不理。

改 skill 本身也不行。實測：在 `.claude/skills/openspec-propose/SKILL.md` 放一行 marker，
跑 `openspec update` 之後整份被覆寫、marker 消失。那個目錄由 openspec 管理，每次 update 都會回到原狀。

做法是把授權放在 skill 管不到、位階又在 skill 之上的地方：

- 新增專案自有的 slash command `.claude/commands/sdd.md`，由它同時授權規劃與實作，串接 propose 與 apply
- 在 `AGENTS.md` 寫明 `/sdd` 的授權範圍與兩個停點

`openspec update` 只動 `.claude/skills/openspec-*/`，不會碰 `.claude/commands/sdd.md`，所以這個做法在 update 後仍然有效。

### 2. 驗收從 archive 移到 apply 的最後

scaffold 把 `acceptance-verifier` 放在 `operations.archive`，是歸檔前才驗。
但停點二要求維護者先親自驗完才下 `/opsx:archive`，所以驗收報告必須在那個指令之前就產好。

- `operations.apply` 的最後一步加上：`code-reviewer` 審查通過後跑 `acceptance-verifier`，寫 `acceptance.md`
- `operations.archive` 拿掉驗收判定，只留同步主規格與搬檔
- `acceptance-verifier` 的輸出要多一段寫給人看的「人工驗收步驟」：啟動指令、各角色用什麼帳號登入、要點開哪幾個畫面、預期看到什麼

最後一項是必要的。它現在的輸出只有機器證據（Scenario 結果、Decision Table、DoD），
停點二如果只拿到這份報告，維護者不知道自己該驗什麼。

### 3. `sa` 的「停下回報」改成「記成 Q」

`sa` agent 現在遇到找不到需求依據、需求依據互相矛盾、依賴的前置功能不存在，會停下來回報。
要改成記進 `system-analysis.md` 的待決問題，由 clarify 在停點一一次問完。

代價要講清楚：上游真的矛盾時，`sd`、`ui-ux`、`proposal` 會先基於帶問號的分析做一輪，
停點一決議後由原撰寫角色回修。本專案的 `docs/specs/` 由維護者擁有、`06-01` 的「待釐清」是「目前沒有待釐清的問題」，
所以這種情況應該少，但不是零。

## 四、要改寫的部分

### 本專案與 scaffold 的落差

| 面向 | scaffold | 本專案 | 影響 |
| :--- | :--- | :--- | :--- |
| 後端 | NestJS 11 加 TypeORM | FastAPI（`backend/pyproject.toml`），目錄還不存在 | `system-design` 與 `sd` 要改寫 |
| 前端 | React 19 加 Vite 加 shadcn 加 Orval 加 TanStack Query | 只有 HTML prototype，框架與元件庫未定案 | `ui-design` 與 `ui-ux` 要改寫，且有待決項 |
| 套件管理 | npm | `uv`（Python）、`pnpm`（JavaScript） | 所有指令要換 |
| repo 結構 | meta repo 加兩個子 repo | 單一 repo | `context` 的提交與分支段落不適用 |
| 登入 | OIDC，admin／viewer | Email 加密碼，PRD 權限矩陣多角色 | 驗收取 token 的方式要重寫 |
| 規則來源 | `.claude/rules/` 加 `CLAUDE.md` | `AGENTS.md` 單一來源 | agent 的引用要改寫 |
| agent | 18 個 | 0 個（`.claude/agents/` 不存在） | 要新建 12 個 |
| 需求文件 | `docs/specs/` 加 `00-prd.mdx`，`prd-writing`／`spec-writing` 產生 | 完全相同（#29、#30 已引入並在地化） | `sa`、`planner` 的假設可直接沿用 |
| design token | shadcn 語意 token | `design/prototype/assets/tokens.css` 加 `label-suite-design` skill | `ui-design` 的 token 段落換來源 |

最後兩列是導入成本能壓低的原因。本專案的 `docs/specs/` 章節（目標、使用角色、業務流程、規格、卡控機制、邊界情況、驗收標準、待釐清、已確認決議）
和 scaffold 同源，`scripts/check-specs.mjs` 還在機器檢查這些章節存在。
`sa` 的「業務流程引用規格書、不重畫」與 `planner` 的「Scenario 沿用驗收標準的名稱」兩條規則因此可以原封不動沿用。

### 逐項判斷

| 產物 | 判斷 | 說明 |
| :--- | :--- | :--- |
| `system-analysis` | 照搬，只改路徑與停下規則 | template 零技術用語；`sa` 只需改 schema 路徑、`.claude/rules` 引用與第三節第 3 項的停下規則 |
| `clarification` | 照搬骨架，面向加兩項 | 見下一節 |
| `proposal`／`specs`／`design` | 照搬 | 與 `spec-driven` 的差異只有三句，都與技術棧無關 |
| `tasks` | 小改 | 角色標記沿用；契約同步指令換成 FastAPI 版，JSDoc 那條刪掉 |
| `system-design` | 改寫 | 分層換成 FastAPI 的 Router → Service → Repository／Model，migration 換 Alembic；回應包裝**已裁定為包一層 envelope**（2026-11-10） |
| `api-contract` | 改寫 | 骨架（端點、角色、錯誤碼、遮蔽欄位）通用；operationId 在 FastAPI 預設是由函式名與路徑組出來的長字串，要用 `generate_unique_id_function` 固定成「動詞加資源」才能當交接依據 |
| `ui-design` | 改寫 | 四種狀態、資料來源、元件樹的骨架通用；shadcn 與 Orval **已於 2026-11-10 裁定**，不再是待決項 |

不需要的部分：`.claude/rules/*.md` 的引用、`AUTH_MODE=dev` 的 `POST /dev/auth/token`、
TypeORM 的 migration 慣例、`ApiResponseDto` 這個字面名稱、meta repo 的提交與分支規則。

### clarify 的十個面向

scaffold 是八項。本專案加兩項，對應 `AGENTS.md` 的 Hard Rule：

| | 面向 | 來源 |
| :--- | :--- | :--- |
| 1 | 規格完整性 | scaffold |
| 2 | API Contract | scaffold |
| 3 | 邏輯一致性 | scaffold |
| 4 | 可行性 | scaffold |
| 5 | 邊界情況 | scaffold |
| 6 | 跨功能影響 | scaffold |
| 7 | 可測試性 | scaffold |
| 8 | 規格範圍 | scaffold |
| 9 | 任務設定驅動 | 新增。這次的行為有沒有寫死某一種任務類型？新增任務類型要不要改核心程式？（Hard Rule 5） |
| 10 | 測試集答案不外露 | 新增。標記員能到達的端點與畫面，payload 裡有沒有標準答案或測試集標記？（Hard Rule 6） |

第 9、10 項放在規劃階段是刻意的。等到 `code-reviewer` 或驗收才發現任務類型被寫死、或答案從 API 漏出去，已經太晚。

## 五、完整流程現在就能跑

`ui-design` 與 `api-contract` 的 template 本身允許整份只寫「本次無 UI 變更」「本次無 API 變更」，
`ui-ux` agent 也明文要求沒有 UI 變更時照樣產出那一句。所以九份產物的流程套在 `backend/` 骨架那個 change 上不會空轉。

`sd` agent 要先寫，但不需要先有程式：把 FastAPI 的分層、回應包裝、`generate_unique_id_function` 策略
當**提案**寫進去，骨架 change 的 `system-design` 把它們攤開，停點一就是維護者拍板的地方。
這是這套流程最該發揮的時刻：慣例一旦寫死，後面每個 API 都照抄。

`ui-ux` agent 可以等前端框架定案再補完，在那之前 `ui-design` 都是那一句話。

## 六、要改的檔案

分三個子 Issue。子 Issue 一完成才動二和三，因為 agent 與 clarify skill 都要引用 schema 的範本路徑與面向定義。

### 子 Issue 一：schema 與 config

| # | 檔案 | 動作 |
| :--- | :--- | :--- |
| 1 | `openspec/schemas/label-suite-sdd/schema.yaml` | 以 `openspec schema fork spec-driven label-suite-sdd` 產生骨架，再把 fullstack-sdd 的五份 artifact 定義搬進來並調整 `requires` |
| 2 | `templates/system-analysis.md` | 由 fullstack-sdd 搬入，照搬 |
| 3 | `templates/clarification.md` | 搬入，檢查結論表改十列 |
| 4 | `templates/system-design.md` | 搬入並改寫成 FastAPI 分層與 Alembic |
| 5 | `templates/api-contract.md` | 搬入，response 段落依回應包裝調整 |
| 6 | `templates/ui-design.md` | 搬入，元件與 token 段落改成引用 `label-suite-design` 與 `design/prototype/assets/tokens.css` |
| 7 | `templates/{proposal,spec,design,tasks}.md` | fork 帶出來的四份，不改 |
| 8 | `openspec/config.yaml` | `schema:` 換成 `label-suite-sdd`；`context` 寫派工順序與兩個停點；`rules.*` 九組；`operations.apply` 加驗收與人工驗收輸出；`operations.archive` 拿掉驗收 |

### 子 Issue 二：授權與 clarify skill

| # | 檔案 | 動作 |
| :--- | :--- | :--- |
| 1 | `.claude/commands/sdd.md` | 新增，串接 propose 與 apply 並授權實作（第三節第 1 項） |
| 2 | `AGENTS.md` | 新增一節：SDD 流程的角色分工、兩個停點、`/sdd` 的授權範圍，以及與 subagent worktree 規則的界線 |
| 3 | `.claude/skills/clarify/SKILL.md` | 搬入並在地化：十個面向、規則引用改 `AGENTS.md`、路徑改 `backend/`／`frontend/` |
| 4 | `.agents/skills/clarify/SKILL.md` | 與上一份同步的副本（Codex 讀這個目錄） |
| 5 | `docs/development/spec-authoring.md` | 「怎麼交給 `/opsx:propose`」改成 `/sdd`，補上兩個停點 |

### 子 Issue 三：十二個 agent

| 群組 | agent | 動作 |
| :--- | :--- | :--- |
| 規劃 | `sa`、`planner`、`design-reviewer` | 搬入，改 schema 路徑與規則引用；`sa` 另改停下規則 |
| 設計 | `sd` | 改寫成 FastAPI 加 SQLAlchemy 加 Alembic，加 operationId 策略 |
| 設計 | `ui-ux` | 改寫；Prototype 來源改 `design/prototype/pages/`，token 來源改 `label-suite-design`；元件庫待定 |
| 實作 | `backend-developer`、`dba` | 改寫成 Python 生態 |
| 實作 | `frontend-developer` | 依前端技術棧改寫；元件庫待定 |
| 實作 | `technical-writer` | 搬入，文件規範改 `docs/development/notecraft-writing.md` |
| 審查 | `code-reviewer` | 改寫，檢查項改成本專案的 Hard Rules |
| 驗收 | `acceptance-verifier` | 改寫指令，加人工驗收步驟輸出（第三節第 2 項） |
| 雜務 | `ops` | 搬入，GitHub label 段落改成本專案的 Issue 規則 |

### 不要做的事

- **不建立 `.claude/rules/`**。與 Hard Rule 1「`AGENTS.md` 是唯一的規則來源」衝突。
- **不改 `.claude/skills/openspec-*/SKILL.md`**。`openspec update` 會覆寫，實測見驗證紀錄。
- **不直接沿用 scaffold 的 `operations` 指令**。`npm run lint`、`npm run check`、`eslint-plugin-jsdoc` 在本專案都不存在，
  寫進去等於每次都要手動略過，關卡會失去效力。
- **不在有進行中 change 的時候改 schema 檔案**。`requires` 一變，進行中的 change 會突然多出未完成的產物。

## 七、待決問題

| # | 問題 | 什麼時候決定 |
| :--- | :--- | :--- |
| ~~1~~ | ~~schema 的名字，以及它是不是 `openspec/config.yaml` 的預設~~ | **已定案（維護者 2026-11-04）**：名稱 `label-suite-sdd`，**就是預設**。落地於 #51 |
| ~~2~~ | ~~小型 change（文件、工具）要不要保留 `--schema spec-driven` 的逃生門~~ | **已定案（維護者 2026-11-04）**：**保留**。實測：不帶 `--schema` 走 9 份產物，帶 `--schema spec-driven` 走 4 份。落地於 #51 |
| ~~3~~ | ~~FastAPI 的分層、回應包裝格式、`generate_unique_id_function` 策略~~ | **已定案**：分層、回應包裝與前綴由**維護者 2026-11-10 裁定**（模組內分層 `app/modules/<module>/`、包一層 envelope、`/api/v1`）；operationId 策略由 [#51](https://github.com/label-suite/label-suite/issues/51) 落地 |
| 3' | **auth 的實作層次**（認證與授權 dependency 的掛點細節） | 身分來源與 CSRF 已由 [#107](https://github.com/label-suite/label-suite/issues/107) 落地（只認 httpOnly cookie、綁 session 的 CSRF token）；剩下的掛點細節由 `backend/` 骨架 change 的 `system-design` 在停點一確認 |
| ~~4~~ | ~~前端框架與元件庫~~ | **已定案（維護者 2026-11-10）**：React 19、`pages/` 加 `features/`、shadcn/ui 放 `components/ui/`、前端型別與 client 用 Orval。`ui-design` **照常撰寫**，不再寫「本次無 UI 變更」 |
| 5 | **Storybook** | 仍待決（`architecture.md` §待決清單 第 10 列）。第一個前端 change 之前決定 |

## 驗證紀錄

為避免只憑閱讀下判斷，以下在本機實際跑過（在 scratchpad 的臨時目錄，未改動本專案的 `openspec/` 與 `.claude/`）：

| 驗證 | 指令 | 結果 |
| :--- | :--- | :--- |
| 1.14.1 接受 fullstack-sdd schema | `openspec schema validate fullstack-sdd` | `✓ Schema 'fullstack-sdd' is valid` |
| 兩套 schema 並存 | `openspec schemas --json` | 同時列出 `source: "project"` 的 `fullstack-sdd` 與 `source: "package"` 的 `spec-driven` |
| 逐 change 選 schema | `openspec new change probe-a --schema fullstack-sdd` | 建立成功，`.openspec.yaml` 寫入 `schema: fullstack-sdd` |
| 依賴由 CLI 強制 | `openspec status --change probe-a` | `0/9`，並列出每一份的 `blocked by` |
| fork 可產生專案 schema 骨架 | `openspec schema fork spec-driven label-suite-sdd` | 產生 `schema.yaml` 與 `templates/{proposal,spec,design,tasks}.md` 四份 |
| **`openspec update` 會覆寫 skill** | 在 `.claude/skills/openspec-propose/SKILL.md` 放 marker 後跑 `openspec update` | marker 消失，整份被原版覆寫。所以授權不能寫在 skill 裡 |
| **Planning boundary 不受 `config.yaml` 管轄** | 讀 `openspec-propose/SKILL.md` 第 15、65、169 行 | 第 65 行明文：`context` 不能覆寫 planning boundary |
| skill 與 schema 無關 | 逐行比對本專案與 scaffold 的 `openspec-*/SKILL.md` | 差異只有 openspec 版號與 1.15.0 多出的輸出路徑檢查 |
| 既有 change 的 schema 紀錄 | 讀 `openspec/changes/archive/*/.openspec.yaml` | 三個都是 `schema: spec-driven` |
| `06-01` 的規格完成度 | 讀 `docs/specs/06-admin/01-user-management.mdx` | 待釐清是「目前沒有待釐清的問題」，驗收標準約 58 個 Scenario |

子 Issue 一（#51）落地後補測：

| 驗證 | 指令 | 結果 |
| :--- | :--- | :--- |
| schema 本體有效 | `pnpm exec openspec schema validate label-suite-sdd` | `✓ Schema 'label-suite-sdd' is valid`，9 份產物 |
| 兩套並存 | `pnpm exec openspec schemas --json` | `label-suite-sdd`（project，9 份）與 `spec-driven`（package，4 份） |
| 預設走新流程 | `pnpm exec openspec new change probe-default` | `.openspec.yaml` 寫入 `schema: label-suite-sdd` |
| 依賴圖與本文第二節一致 | `pnpm exec openspec status --change probe-default` | `0/9`，`system-design` 與 `ui-design` 都只被 `system-analysis` 擋住（可平行），`tasks` 被 `api-contract`、`specs`、`design` 擋住 |
| 逃生門可用 | `pnpm exec openspec new change probe-escape --schema spec-driven` | `0/4`，走 proposal → specs ∥ design → tasks |
| 在地化真的進到 instruction | `pnpm exec openspec instructions system-design --change probe-default --json` | 輸出含「Router → Service」與「Alembic」，template 的 `classDiagram` 也在 |
| CLI 的執行方式 | `pnpm exec openspec --version` | `1.14.1`（專案 devDependency；`npx` 在本環境會被權限分類器擋下） |
