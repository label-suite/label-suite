---
name: clarify
description: 釐清 OpenSpec change 規劃產物（system-analysis、system-design、ui-design、api-contract、proposal、specs、design、tasks）中的疏漏、邏輯矛盾、可行性風險與待決策項目。propose 流程產出 proposal 後會以關卡模式自動執行並寫入 clarification.md；也可手動觸發，重新審視既有 change、或實作中途發現規格有疑慮時使用。
---

# Clarify

此 skill 是 SDD 流程的**品質閘**，職責是**找出規格本身的問題**，不是擴張規格。

它同時是本專案**兩個人工停點的第一個**：需要維護者決定的項目（Q）在這裡逐題問完，之後整條 propose 到 apply 不再停（故障除外）。見 `openspec/config.yaml` 的 `context`。

## 提問格式

凡是本文寫「依提問格式」詢問的地方，一律用下面的文字格式提問，然後**停下來等維護者回覆**，不要自行選擇或繼續往下做：

```markdown
**Q1｜{面向}**：{問題}

1. {選項}（建議）— {選這個選項的影響}
2. {選項} — {影響}
3. {選項} — {影響}

（回覆編號即可，也可以直接輸入其他答案）
```

- 每題 2～4 個選項，最推薦的放第一個並標「（建議）」
- 一次最多 4 題，題號連續；維護者可以用「Q1:1、Q2:3」一次回覆
- 開放式問題不列選項，直接問
- 維護者回覆前，不寫檔、不提交

## 兩種模式

| 模式 | 時機 | 檢查範圍 | 產出 |
| :--- | :--- | :--- | :--- |
| 關卡模式 | propose 流程內，proposal 完成後、specs 之前（schema 的 `clarification` artifact） | system-analysis、system-design、ui-design、api-contract、proposal | `clarification.md` |
| 完整模式 | 維護者手動觸發 | 全部九份規劃產物 | 對話中的 Clarify 報告 |

判斷方式：change 目錄還沒有 `specs/`、`design.md`、`tasks.md`，或 `pnpm exec openspec status --change <name>` 顯示下一份待產生的是 `clarification` → 關卡模式；其餘為完整模式。

關卡模式放在 proposal 之後，是因為流程、權限、遮蔽、端點等決策到這裡都已定案，而 specs、design、tasks 都由它們推導；在這裡修正，不必重寫下游三份。

## 何時使用

- propose 流程產出 proposal 之後（關卡模式，由主 agent 自動執行）
- 想對既有的 OpenSpec change 做一次品質檢查（完整模式）
- 實作中途發現規格有疑慮，回頭釐清（完整模式）

## 何時不使用

- 還沒有任何規劃產物 → 先用 `openspec-propose` 建立 change
- 想討論需求方向、還沒到產規格階段 → 用 `openspec-explore`
- 已經確定要改規劃內容、只是要把決定寫回去 → 用 `openspec-update-change`

> 本 skill 是人工視角的審查；`design-reviewer` agent 審同一批產物時可參考本清單，但兩者結論不互相取代。

---

## 步驟

### 步驟 1：定位目標 change

1. 維護者已指定 change 名稱或路徑 → 直接使用
2. 未指定時列出未封存的 change（依修改時間排序）：

   ```bash
   ls -1dt openspec/changes/*/ 2>/dev/null | grep -v '/archive/' | head -5
   ```

   （搜尋與讀檔用 `rg` 與一般的檔案讀取，見 `AGENTS.md` §Codex-Specific Notes）

   - 只有一個，或最新一個比次新的晚 10 分鐘以上 → 向維護者確認是否用這個
   - 否則列出前 3～5 個（附修改時間）請維護者選

### 步驟 2：載入規劃產物

讀取 change 目錄下的檔案：

| 檔案 | 必要 | 說明 |
| :--- | :--- | :--- |
| `system-analysis.md` | 是 | 業務流程、跨模組依賴、需求文件矛盾與**待決問題** |
| `system-design.md` | 是 | Class Diagram、每個 Scenario 的 Sequence Diagram |
| `ui-design.md` | 是 | 頁面、路由、元件樹、資料來源、四種狀態；無 UI 變更時寫「本次無 UI 變更」 |
| `api-contract.md` | 是 | 端點、request／response 欄位、錯誤碼、權限、遮蔽欄位 |
| `proposal.md` | 是 | |
| `specs/**/spec.md` | 是 | 各 capability 的 Requirement 與 Scenario |
| `design.md` | 是 | |
| `tasks.md` | 是 | |

任一必要檔缺失 → 停止並回報缺哪一份（可用 `pnpm exec openspec status --change <name>` 確認 artifact 狀態）。

**關卡模式**只讀前五份（到 `proposal.md` 為止），`specs`、`design`、`tasks` 不算缺失；另跑 `pnpm exec openspec instructions clarification --change <name>` 取得範本與 `rules.clarification`。

**`sa` 一定會留下待決問題。** 本專案的 `sa` agent 遇到找不到依據、依據互相矛盾、前置功能不存在時，**不停下來問，而是記進 `system-analysis.md` 的「待決問題」並繼續**。所以那張表是這個關卡的主要輸入，不是例外狀況——逐條都要變成一個 Q 或一個已回答的結論。

### 步驟 3：載入對照基準

1. `openspec/config.yaml` 的 `context`：兩層規格的分工、需求依據順序、派工順序與兩個停點、語言規範
2. **`AGENTS.md`**——本專案唯一的規則來源，**沒有** `.claude/rules/`。Hard Rules 全部適用，第 5（任務設定驅動）與第 6（測試集答案不外露）是下面第 4.9、4.10 個面向
3. `context` 指到的需求文件中，本次 change 相關的章節：`docs/specs/00-prd.mdx`（PRD，**權限上限**）與 `docs/specs/NN-<module>/NN-<page>.mdx` 的規格書
4. `docs/development/architecture.md` 的 §待決清單——**那上面還沒答的題目不要在這裡自己答**，但要確認規劃產物把它們留成待決而不是偷偷定掉
5. `openspec/specs/` 中被本次 change 修改的主規格

對照重點：

- system-analysis 的「跨模組依賴」應在 system-design／design 中被處理
- system-analysis、system-design 的「待決問題」應在後續產物中被回應或明確保留
- design 若偏離 system-analysis／system-design 的判斷，必須在報告中標註
- **規劃產物與 `docs/specs/` 的規格書不一致時以規格書為準**，而且**規格書由維護者擁有，不得透過 change 改它的需求**（`config.yaml` 的 `context`）

### 步驟 4：依檢查清單逐項審視

下列**十個面向**每一項都要產出結論（通過／待釐清／問題），不得跳過。
關卡模式下，只能對 specs、design、tasks 檢查的項目標「後續產物」，不算通過也不算問題；可以改用上游產物檢查的項目照常檢查（例如「需求文件的驗收情境是否都有 api-contract 端點支撐」）。

#### 4.1 規格完整性
- [ ] proposal 是否涵蓋需求文件中本次範圍的所有功能點？
- [ ] specs 是否涵蓋需求文件的所有驗收情境（Scenario）？
- [ ] design 是否說明 proposal 提及的所有變更？
- [ ] tasks 是否涵蓋 design、api-contract、ui-design 中的所有實作項目？
- [ ] 規格書中的「待釐清」項目是否被處理（不能忽略）？**規格書的「已確認決議」是否被當成已定事項沿用，而不是重新討論？**

#### 4.2 API Contract
- [ ] **api-contract 是否涵蓋所有 Scenario**：每個需要後端參與的 Scenario 都對得到端點，且 request／response 欄位足以完成該 Scenario
- [ ] **權限與遮蔽是否寫進 contract**：每個端點標出需要的系統角色與任務成員身分；會被遮蔽的欄位、遮蔽時的回傳方式與觸發角色都有寫
- [ ] 錯誤碼是否對應 specs 中的失敗 Scenario（驗證失敗、未登入、無權限、找不到、衝突）？**看不到的資源是否回 404 而不是 403？**
- [ ] 欄位命名、型別、列表分頁契約是否與 system-design 和既有的 `openapi.json` 一致？
- [ ] **operationId 是否符合「動詞加資源」且全專案唯一？**
- [ ] ui-design 的資料來源是否都對得到 contract 中的端點與欄位？

#### 4.3 邏輯一致性
- [ ] 規劃產物之間是否互相對齊（前一份提到、後一份漏掉）？
- [ ] 角色權限是否與規格書一致，而且**沒有超出 PRD §權限矩陣**？超出時是否明寫上限並交給 Issue #85，而不是默默放寬？
- [ ] 業務流程位置是否與 system-analysis 的流程圖一致？
- [ ] 術語、欄位、模組名是否前後一致，而且**與 `docs/specs/glossary.mdx` 相同**？

#### 4.4 可行性
- [ ] 技術選型是否符合 `openspec/config.yaml` `context` 與 `docs/development/architecture.md` 列出的技術棧？不符合的地方要列出
- [ ] 是否依賴尚未存在的功能？若有，是否標註為前置依賴？
- [ ] 是否與既有架構衝突？**`backend/` 與 `frontend/` 目前都還不存在**，所以「與既有慣例衝突」在骨架 change 之前多半不適用，改為檢查「有沒有假設一個還不存在的結構」
- [ ] **還沒定案的事有沒有被偷偷定掉**：後端目錄分層、成功回應的統一格式、`/api/v1` 前綴、前端版本與元件庫、client 生成工具。這五件在 `architecture.md` §待決清單 上，規劃產物應該把它們寫成提案或待決，不是寫成結論
- [ ] task 數量與粒度是否合理？

#### 4.5 邊界情況
- [ ] 驗證失敗／輸入錯誤的處理是否明確？
- [ ] 未登入／登入狀態失效／權限不足的處理是否明確，前後端都有？
- [ ] 並發／重複請求／重複送出是否考慮？
- [ ] ui-design 是否為每個資料區塊定義 loading／error／empty／無權限四種狀態？**遮蔽欄位的呈現是否不是空白或「無資料」？**

#### 4.6 跨功能影響
- [ ] 對其他模組的副作用，design 是否說明？
- [ ] 是否要改共用的認證、授權、版面或 HTTP 邊界？若有，tasks 是否體現？
- [ ] 資料庫 schema 變更是否影響其他模組？是否有對應的 Alembic migration task？**SQLite 與 PostgreSQL 兩層是否都考慮到？**

#### 4.7 可測試性
- [ ] 每個 Scenario 是否可被自動化測試覆蓋（後端 pytest、前端 Vitest、E2E Playwright）？
- [ ] 是否定義了各層測試的邊界？**名詞是否正確（httpx 的 API 測試叫 integration，E2E 專指 Playwright）？**
- [ ] 是否有不可測的需求（例如「體驗良好」）？要轉成可測指標或標為待釐清
- [ ] **Scenario 的名稱是否沿用規格書「驗收標準」那一條的名稱**，讓兩層文件對得起來？

#### 4.8 規格範圍
- [ ] tasks 是否有超出 design 範圍的項目（規格擴張）？
- [ ] tasks 是否有 design 提到但遺漏的項目？
- [ ] proposal 是否塞入不屬於本次 change 的工作？
- [ ] 規劃產物有沒有要求改 **`docs/specs/00-prd.mdx`** 或 **`design/prototype/`**？那兩個任何角色都不准動——要動 PRD 就交給 `prd-writing`，畫面與規格不一致就列成待釐清

#### 4.9 任務設定驅動（`AGENTS.md` Hard Rule 5）
- [ ] 這次的行為有沒有**寫死某一種任務類型**？有沒有任務名稱特判、固定的 `task.type` 分支？
- [ ] **新增一種任務類型要不要改核心程式**？如果要，那就是違規——任務類型由 `input_type` 加 `outputs[]` 的組合決定
- [ ] 資料層有沒有為某一種任務類型加專用欄位（任務設定應該走 JSON）？
- [ ] 既有 output type 的 UI／驗證／評分擴充，與**新增一個 output primitive 的程式工作**，兩者是否分清楚了？

#### 4.10 測試集答案不外露（`AGENTS.md` Hard Rule 6）
- [ ] **標記員能到達的端點與畫面，payload 裡有沒有標準答案或測試集辨識資訊？** 逐個端點問，不是整批問
- [ ] 覆蓋面是否完整：API 回應、列表與詳情、下載與匯出、輪詢結果、快取、瀏覽器 bundle 與 source map、公開 fixture 與 mock、錯誤訊息與 log
- [ ] 計分與 IAA 是否在後端算？**瀏覽器有沒有下載答案再自己算分？**
- [ ] specs 是否有**負向 Scenario**：以標記員身分取不到答案？
- [ ] seed 與測試 fixture 裡有沒有答案或測試集標記？

> 4.9 與 4.10 放在規劃階段是刻意的。等到 `code-reviewer` 或驗收才發現任務類型被寫死、或答案從 API 漏出去，已經太晚。

### 步驟 5：產出釐清報告

- **關卡模式**：依 `clarification` 範本寫入 `openspec/changes/<name>/clarification.md`（主 agent 直接寫，這是唯一由主 agent 撰寫的規劃產出）；Q 的「決議」欄先留空，步驟 6 回答後補上
- **完整模式**：以下列格式輸出在對話中

```markdown
# Clarify 報告：{change 名稱}

## 1. 檢查結論摘要

| 面向 | 結論 | 問題數 |
| --- | --- | --- |
| 規格完整性 | 通過 / 待釐清 / 問題 | n |
| API Contract | ... | n |
| 邏輯一致性 | ... | n |
| 可行性 | ... | n |
| 邊界情況 | ... | n |
| 跨功能影響 | ... | n |
| 可測試性 | ... | n |
| 規格範圍 | ... | n |
| 任務設定驅動 | ... | n |
| 測試集答案不外露 | ... | n |

## 2. 待釐清項目（需維護者決定）

### Q1. {問題標題}
- **面向**：{檢查面向}
- **來源**：{檔案路徑與章節}
- **問題描述**：{具體說明}
- **建議選項**：
  - [ ] 選項 A：{說明}
  - [ ] 選項 B：{說明}
- **預設傾向**：{若有明顯建議，附理由}

## 3. 明確問題（直接修正即可）

### P1. {問題標題}
- **位置**：{檔案路徑與章節}
- **問題**：{例如 api-contract 沒有寫出標記員視角要遮蔽哪些欄位}
- **建議修正**：{具體動作}

## 4. 通過項目

簡列確認沒問題的面向。

## 5. 下一步建議
```

### 步驟 6：互動式逐項釐清 Q

依「提問格式」逐一詢問 Q 項目：

- 每個 Q 一題，題號沿用 Q 編號
- 建議選項寫成 2～4 個編號選項；預設傾向放第一個並標「（建議）」
- 一次最多 4 個 Q，超過分批
- P 項目不詢問，在步驟 7 一併修正

**選項裡不要夾帶既定方向。** 維護者的技術選型題（`architecture.md` §待決清單 上的那些）要把現況、外部參考做法與差異的代價都寫出來，不要只給一個看起來唯一合理的選項。

**決議要記下日期。** 維護者在這裡拍板的事，日後是規格書「已確認決議」的合格依據之一（`docs/development/spec-migration.md` 通則第 4 條第四種），而那一條要求**維護者與日期同時寫出來**，否則查不回來。

### 步驟 7：回修

**關卡模式**（propose 流程內，回答 Q 即視為同意回修，不再另外詢問）：

1. 決議會改變需求 → **先用 `spec-writing` 改 `docs/specs/` 的規格書**，再回修 openspec 產出。寫進規格書「已確認決議」的依據只有 `docs/development/spec-migration.md` 通則第 4 條那**五種**
2. 依原撰寫角色的職責回修：system-analysis 照 `sa` 的範圍、system-design 與 api-contract 照 `sd`、ui-design 照 `ui-ux`、proposal 照 `planner`。
   那些角色定義在 `.claude/agents/`（Claude Code 才會派工給它們）；**Codex 沒有對應的 subagent 機制，所以自己做，但守同一條職責界線**：
   改 system-analysis 時不寫技術設計，改 system-design 時不寫畫面，依此類推。P 項目一併修正
3. 把決議、理由、**日期**、回修位置寫進 `clarification.md`，並在「交給後續產出」條列 specs、design、tasks 要遵守的事
4. 只對受影響的面向重新檢查；全數通過（沒有未決的 Q、P 都已修正）後回到 propose 流程，繼續產生 specs
5. 維護者對某個 Q 選擇暫不決定 → **停止 propose**，回報卡在哪裡，不往下產生 specs

**完整模式**：

- 收到所有 Q 的回答後，詢問是否要寫回規劃產物；同意後用 `openspec-update-change` 的方式修改，保持各產物一致
- P 項目在維護者同意後一併修正
- 完成後提醒「建議再跑一次 clarify，確認沒有引入新問題」；全數通過即可進入 `openspec-apply-change`

---

## 邊界

- 不新增 design 未提及的功能（那是規劃階段的工作）
- **不擅自做技術決策**，待釐清項目留給維護者選；`architecture.md` §待決清單 上的題目尤其不自己答
- 不跳過任何檢查面向，顯然通過也要標註
- 未經同意不修改任何規劃產物（關卡模式下，維護者回答 Q 即視為同意依決議回修）
- **不改 `docs/specs/` 的需求**：決議要改需求時走 `spec-writing`，而 `docs/specs/00-prd.mdx` 與 `design/prototype/` 任何情況都不動
- `pnpm exec openspec validate` 的結果可作參考，但不取代本 skill 的人工判斷

## 輸出風格

繁體中文、結構化、條列為主；報告結尾明確寫出下一步。
