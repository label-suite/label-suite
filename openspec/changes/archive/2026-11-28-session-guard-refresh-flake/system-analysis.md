# System Analysis

> 本 change 處理 #804（CI Linux 偶發）與 #812（Windows 固定失敗）。兩張單都是同一份 E2E 旅程 `e2e/account/session-guard.spec.ts` 的「refresh conflicts」區塊斷言失敗，**不是**產品行為改變。
> 這是技術 change，產品規則本身不變。本文件照範本只寫業務面：被驗的規格條文、角色、流程與依賴。另外依派工要求加一節「根因分析與證據」。那一節得說明測試怎麼失敗，所以會用到測試名稱與計數器名稱；請求一律以業務語意稱呼（「登入狀態查詢」「延續」），不寫端點路徑。

## 需求依據

| 來源                                                                                                   | 章節／編號                                                                                                                                  | 摘要（一句）                                                                                                   |
| :----------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------- |
| `docs/specs/00-prd.mdx`                                                                                | §權限矩陣「01 帳號（自己的帳號與個人設定）」                                                                                                | 角色與權限上限，本 change 不涉及任何權限差異                                                                   |
| `docs/specs/01-account/05-login-state.mdx`（已定案）                                                   | §規格 › 延續登入狀態與疑似被盜用 › **多個分頁同時延續登入狀態** 第 1–4 條                                                                   | 沒搶到延續的分頁短暫等候後把原操作重試**一次**；仍不通最多再延續一次，還是不行才帶回登入頁；次數有上限         |
| 同上                                                                                                   | §邊界情況「兩個分頁同時延續，其中一個慢了」「重試之後還是不通」                                                                             | 慢的那個短暫等一下就好；重試仍不通就帶回登入頁、不一直重試                                                     |
| 同上                                                                                                   | §驗收標準 Scenario「**慢的那個分頁自動重試一次**」「重試仍失敗就帶回登入頁」                                                                | 前者就是失敗測試 1 驗的條文；後者這次沒有失敗                                                                  |
| 同上                                                                                                   | §已確認決議 Q13                                                                                                                             | 多個分頁同時延續不算被盜用；前端重試必須有界、失敗就導向登入                                                   |
| 同上                                                                                                   | §業務流程「時間到了自然結束」A1                                                                                                             | 限制沒到時正常通行；這是延續成功後原操作的去向                                                                 |
| `openspec/specs/login-session/spec.md`                                                                 | Requirement「多個分頁同時延續不互相踢掉」、Scenario「慢的那個分頁自動重試一次」「重試仍失敗就帶回登入頁」「**重試不通時再延續一次就成功**」 | 可測契約：延續至多 2 次、原請求重送至多 2 次；第三個 Scenario 就是失敗測試 2 驗的條文                          |
| `openspec/specs/frontend-api-client/spec.md`（源自 login-auth-guard 的 delta）                         | Requirement「伺服器資料快取不自動重試」                                                                                                     | 明文規定：開發模式雙重掛載中止的第一次請求不計，也不算重試                                                     |
| `openspec/changes/archive/2026-11-27-sidebar-nav/design.md`                                            | §外殼換頁重查（第 83、93、98 行附近）                                                                                                       | 已記錄：E2E 跑在開發模式，雙重掛載會同步取消第一份查詢；`session-guard.spec.ts` 的查詢次數以「完成的請求」為準 |
| `docs/development/rules/testing-agent-rules.mdx`                                                       | **T8**（禁止固定 `sleep`／`waitForTimeout`，用條件式等待）；附錄 T5／T11「間歇性問題要能重現才算結案」                                      | 修法的界線：不得用固定等待繞過，間歇問題要先重現才能結案                                                       |
| `AGENTS.md`                                                                                            | §Agent Rules Index「Scope, once locked, is not yours to shrink」                                                                            | 已承諾的驗收斷言（`refreshes()`／`originals()` 的次數）不得放寬或刪除                                          |
| #804、#812 本文與留言；`openspec/changes/archive/2026-11-28-dashboard-shell/acceptance.md` §驗收觀察 1 | —                                                                                                                                           | 兩張單的症狀，以及 #722 驗收時提出的假設（被取消的第一份查詢吃掉了 401）                                       |

## 範圍

- 這次包含：
  - 找出 `session-guard.spec.ts`「refresh conflicts」區塊兩個測試間歇失敗（Linux、macOS）與固定失敗（Windows）的根因，並判斷是測試假設還是產品競態
  - 讓兩個測試只取決於被驗的行為（規格 01-05 §多個分頁同時延續登入狀態 第 2、3 條），每次結果相同；原有的次數斷言維持不變
  - 確認同一個區塊的「重試仍失敗就帶回登入頁」與其他 spec 有沒有同一種寫法
- 這次不包含：
  - 產品端的延續與重送行為（根因分析顯示它是對的，見下節）
  - 把 E2E 改成跑正式建置、或拿掉開發模式的雙重掛載（那是 E2E 環境的設計決定，見待決問題 #3）
  - 改動 `docs/specs/` 的任何需求
  - 畫面：本 change 不改任何畫面，`ui-design` 應為「不適用」

## 根因分析與證據

### 結論

**#804 與 #812 是同一個根因，都在測試端，不是產品競態。** 根因就是 #722 驗收提出的假設，這次已經用 trace 證實：

1. 開發模式在掛載時會「掛載、卸載、再掛載」，第一份登入狀態查詢送出後**在同一個時間片段就被取消**，接著送出第二份。這是設計允許的行為，見 frontend-api-client 的「被中止的請求不計」
2. 兩個失敗的測試都用一個**依「第幾個請求」決定回什麼**的攔截器替換登入狀態查詢的回應：測試 1 只讓第 1 個回 401；測試 2 讓前 2 個回 401
3. 被取消的那一份會不會進到攔截器，看瀏覽器把它送出去之前有沒有先被取消，各平台的時序不同。**它進到攔截器時就會占掉「第 1 個」的名額**：攔截器的 401 回給一個已取消的請求，等於沒回
4. 真正被畫面使用的那一份於是拿到「第 2 個」的回應，整條情境往後挪一格：
   - 測試 1：真正的查詢直接通過，從頭到尾沒有延續 → `refreshes()` 為 **0**（#812；#722 的觀察；#804 本文提到的較早 `:218`）
   - 測試 2：真正的查詢拿到 401 → 延續遇到衝突 → 等候後重送，這時已輪到「第 3 個」而直接通過，第二次延續沒有發生 → `refreshes()` 為 **1**（#804 的 `:266`，現在是 `:274`）
5. 產品在每一次失敗中都**照規格正確反應**它實際收到的回應：收到 401 就延續，遇到衝突就短暫等候、重送一次；收到通過就不延續。失敗的原因是測試給它的情境跑掉了，不是產品少做一步
6. #804 本文推測的「畫面顯示時第二次延續還沒發生或被合併」**不成立**：失敗的 trace 裡第二次延續根本沒有送出，原因是重送已經通過，不是送得晚

### 執行紀錄（macOS，本機，worktree `1d039f34`）

| 指令（在 `e2e/` 下執行）                                                                                        | 結果                                                         |
| :-------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| `npx playwright test account/session-guard.spec.ts -g "慢的那個分頁自動重試一次" --repeat-each=10`              | 10 次失敗 1 次（另 1 個是 setup），`Expected: 1 Received: 0` |
| 同上，`--repeat-each=20 --trace on`                                                                             | 20 次失敗 2 次，都是 `:247` `Expected: 1 Received: 0`        |
| 同上，`--repeat-each=30 --trace on`                                                                             | 30 次失敗 3 次，都是 `:247` `Expected: 1 Received: 0`        |
| `npx playwright test account/session-guard.spec.ts -g "重試不通時再延續一次就成功" --repeat-each=20 --trace on` | 20 次失敗 7 次，都是 `:302` `Expected: 2 Received: 1`        |

失敗率在 macOS 介於約一成到三成五，兩個測試的差距在這麼小的樣本下看不出是不是系統性的差異。

### trace 證據：攔截器被叫的順序與成敗一一對應

從每個 trace 抽出攔截器實際做的動作（回 401、回 409、放行），依測試結果分組：

| 測試                                | 結果     | 攔截器動作順序                                             | 次數 |
| :---------------------------------- | :------- | :--------------------------------------------------------- | :--- |
| 慢的那個分頁自動重試一次（30 次）   | 通過     | 查詢回 401 → 延續回 409 → 查詢放行                         | 27   |
| 同上                                | **失敗** | 查詢回 401 → 查詢放行（**沒有延續**）                      | 3    |
| 重試不通時再延續一次就成功（20 次） | 通過     | 查詢回 401 → 延續回 409 → 查詢回 401 → 延續放行 → 查詢放行 | 13   |
| 同上                                | **失敗** | 查詢回 401 → **查詢回 401** → 延續回 409 → 查詢放行        | 7    |

成敗與順序**一一對應，沒有例外**。以失敗的 trace 為例，測試 1 的 network 紀錄裡，換頁後只有一份「已取消」的查詢和一份「真正送到後端並通過」的查詢，沒有任何一份被攔截器回 401 的完成請求；也就是攔截器那一次 401 回給了已取消的那一份。測試 2 失敗的 trace 裡，攔截器兩次 401 幾乎同時發生（相隔約 1 ms），第一次對應的就是已取消的那一份。通過的 trace 裡，已取消的那一份也出現在 network 紀錄中，但沒有叫到攔截器。

### 兩張單是否共用一個根因

| 項目       | #804（CI Linux，偶發）                               | #812（Windows，固定）                                                  |
| :--------- | :--------------------------------------------------- | :--------------------------------------------------------------------- |
| 失敗的測試 | `:266`（現 `:274`）測試 2；`:218`（現 `:224`）測試 1 | `:218`（現 `:224`）測試 1                                              |
| 症狀       | `refreshes()` 2→1；1→0                               | `refreshes()` 1→0，畫面正常、無錯誤橫幅                                |
| 機制       | 已取消的第一份查詢占掉攔截器名額                     | 同左，症狀完全吻合；Windows 的時序讓已取消的查詢幾乎每次都先送到攔截器 |
| 本機重現   | macOS 兩個測試都重現，且證實是這個機制               | 沒有 Windows 可以重現（見待決問題 #2）                                 |

**判斷：同一個根因，不建議把 #812 拆出去。** 唯一沒有解開的一點是 #812 的另一項觀察：同一台 Windows 跑全套時，測試 2 是通過的。照這個機制，Windows 上的測試 2 也應該常常失敗。單次全套通過不足以推翻這個機制（失敗機率不到 1 就會發生），但在 Windows 實測之前不算結案，見待決問題 #2。

### 「為什麼只有 Windows 固定失敗」

已取消的請求會不會先送到攔截器，取決於取消與瀏覽器網路層之間的時序，各平台不同。這次在 macOS 量到約一到三成，CI Linux 是偶發，#812 的 Windows 是 5 次全部失敗。這解釋了「同一個根因、三種頻率」。**Windows 的時序沒有實測**，這一句是推論。

### 同一區塊與其他 spec 的檢查

- 「重試仍失敗就帶回登入頁」：登入狀態查詢一律回 401，跟順序無關；它依順序決定的是延續的回應，而延續請求不會被雙重掛載取消。所以它不受影響，這次也沒有失敗
- 「判定中不顯示內容」：只是把查詢扣住再放行，跟順序無關，不受影響
- 其他 spec（`dashboard`、`app-shell/sidebar`、`account/google-callback`、`account/login-page`）的攔截器都沒有用「第幾個掛載查詢」決定回應的寫法。`login-page.spec.ts` 與本檔開頭都已註明「計數只算完成的請求」，但本檔這兩個測試的**攔截器**還是依「被叫的次數」決定回應，跟那句註解的前提不一致；這就是缺陷的位置

## 業務流程

| 規格       | 業務流程                                                                | 本次涉及                                                                                                                |
| :--------- | :---------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| 規格 01-05 | §規格 › 多個分頁同時延續登入狀態 第 1–4 條（不是 §業務流程 的獨立流程） | 第 2 條（等候後重試一次並成功）、第 3 條的成功分支（再延續一次成功、重送成功）；第 3 條的失敗分支只用來確認沒有受到影響 |
| 規格 01-05 | §業務流程「時間到了自然結束」                                           | A1：延續成功後原操作正常通行的去向；本次不改                                                                            |

只涉及一份規格，所以不畫串接圖。規格 01-05 §業務流程只寫了三段流程（自己登出、安全事件撤銷、時間到了自然結束），沒有「多個分頁同時延續」這一段，它只以規則條列寫在 §規格 底下。這屬於業務流程的缺漏，照規則不在這裡另畫，記成待決問題 #4。

## 跨模組依賴

- **角色**：本規則適用所有已登入的人（平台成員、系統管理員、Seeder 管理員），沒有權限差異，也沒有被遮蔽或唯讀的資料；PRD §權限矩陣「01 帳號」的 `R/E (o)` 已涵蓋，本 change 不動

  | 角色          | 遇到延續衝突時                           | 備註                                |
  | :------------ | :--------------------------------------- | :---------------------------------- |
  | 平台成員      | 自動等候並重試一次；仍不通最多再延續一次 | 使用者感覺不到                      |
  | 系統管理員    | 同上                                     | 同上                                |
  | Seeder 管理員 | 同上                                     | PRD §使用者角色「權限同系統管理員」 |

- **依賴的既有 capability**：`login-session`（延續與重送的次數契約）、`frontend-api-client`（「被中止的請求不計」的界定）、`auth-guard`（守門以登入狀態查詢決定去向）、`e2e-testing`（E2E 跑在開發伺服器上）。這次都只引用、不修改；planner 判斷要不要為 `e2e-testing` 加一條「攔截器不得依掛載查詢的順序決定回應」之類的契約
- **E2E 環境**：E2E 預設跑開發伺服器，所以雙重掛載一定存在（`e2e/playwright.config.ts` 的預設模式、sidebar-nav design 第 83 行）。修法要能在這個前提下成立，不能靠「剛好沒有取消」
- **後續會依賴這次結果的**：同一個 `e2e` CI job 擋住的所有 PR（#799、#807、#818 都被誤擋過）；之後任何需要「第一次回錯、之後放行」的 E2E 旅程都會沿用這次定下的寫法
- **沒有前置功能缺席**：產品端的延續、等候與重送都已存在（`login-auth-guard`，已歸檔）

## 需求矛盾

- **無業務規則之間的矛盾。** 規格 01-05、`login-session` 與 `frontend-api-client` 三者一致：重試有界、延續至多 2 次、重送至多 2 次；被中止的請求不計
- **追溯不完整（不是矛盾）**：`openspec/specs/login-session/spec.md` 的 Scenario「重試不通時再延續一次就成功」在 `docs/specs/01-account/05-login-state.mdx` §驗收標準沒有同名 Scenario；它所在 Requirement 的「來源」也沒有列出它。它的依據是 §多個分頁同時延續登入狀態 第 3 條的成功分支，見待決問題 #5
- **#812 引用的規則**：#812 寫「不得用放寬斷言或加固定等待繞過（T8）」。T8 只禁止固定等待；「不得放寬斷言」的依據其實是 `AGENTS.md`「Scope, once locked」與 #804 的待辦。兩條約束都成立，只是出處不同，不影響修法

## 待決問題

| #   | 問題                                                                                                                                                                                                                                                                                                                                                                                                                                                | 影響                                                                                                                                                                                                       | 狀態                                                                                                                                                      |
| :-- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 根因已證實在測試端（攔截器依「第幾個請求」選回應，開發模式取消的第一份查詢會占掉名額）。修法要限定在測試端（例如讓攔截器只回應「沒被取消、會完成」的請求，或改依請求的狀態而不是順序判斷），還是也要動產品端？（來源：本文件 §根因分析與證據；`openspec/specs/frontend-api-client/spec.md`「被中止的請求不計」；衝突點：#804 待辦寫「若是產品行為的競態，回報為產品 bug」，trace 顯示產品行為正確，所以預期是只改測試，但產品程式要不要碰需要定案） | 決定 `system-design` 的範圍（只有 `e2e/` 還是含 `frontend/`）、`tasks.md` 的分組與派工角色（只派 `frontend-developer` 改 E2E，還是加產品修改）；選只改測試時，`api-contract` 與 `ui-design` 都是「不適用」 | 已決議（clarification Q1，2026-11-28）：只改測試（`e2e/`），採設計 A；前端不動                                                                            |
| 2   | #812 的 Windows 驗收（「Windows 本機 `--repeat-each=10` 全部通過」）由誰、在哪台機器上做？agent 的執行環境沒有 Windows，CI 也只有 ubuntu。另外，#812 記錄同一台 Windows 跑全套時測試 2 通過，跟「Windows 幾乎每次都中」的推論不完全一致，要靠 Windows 實測確認（來源：#812 §待辦第 3 項、§實際結果；衝突點：機制在 macOS 已證實，Windows 的時序是推論）                                                                                             | 決定 `acceptance.md` 能不能勾掉 #812 的 Windows 項目、`Closes #812` 能不能放在同一張 PR；如果 Windows 實測發現其他原因，#812 要拆回獨立處理，`proposal.md` 的範圍也要跟著改                                | 已決議（clarification Q2，2026-11-28）：PR 只寫 `Closes #804`，#812 保持開啟；合併後由維護者在 Windows 驗，全過才關 #812，不過則在 #812 續查              |
| 3   | E2E 是否繼續固定跑開發模式（含雙重掛載）？這次的修法以「維持開發模式」為前提（來源：`e2e/playwright.config.ts` 預設模式說明；`openspec/changes/archive/2026-11-27-sidebar-nav/design.md` 第 83 行；衝突點：本 change 不打算改，但如果維護者想改成正式建置，根因的觸發條件就會消失，修法與驗收方式都不同）                                                                                                                                           | 影響 `system-design` 選的修法，以及 `e2e-testing` capability 要不要改；預設是維持現狀、不改                                                                                                                | 已決議（clarification Q3，2026-11-28）：維持開發模式，不在本 change 處理                                                                                  |
| 4   | 規格 01-05 §業務流程沒有「多個分頁同時延續登入狀態」這段流程，只在 §規格 條列。要不要用 `spec-writing` 補成一段業務流程（觸發、主流程、A／E 分支）？（來源：`docs/specs/01-account/05-login-state.mdx` §業務流程、§規格 › 多個分頁同時延續登入狀態；衝突點：業務流程章節缺這一段）                                                                                                                                                                  | 不影響本 change 的修法與驗收；只影響規格書的完整度，補的話要另開 `docs` 工作，不在本 PR                                                                                                                    | 已決議（clarification Q4，2026-11-28）：本次不處理，不另開 issue；之後修改 01-05 時一併由 `spec-writing` 補                                               |
| 5   | `login-session` 的 Scenario「重試不通時再延續一次就成功」在規格 01-05 §驗收標準沒有對應的 Scenario，所屬 Requirement 的「來源」也沒列它。要補 docs/specs 的 Scenario，還是在 openspec 的來源改註「第 3 條成功分支」？（來源：`openspec/specs/login-session/spec.md` 第 97、121 行；`docs/specs/01-account/05-login-state.mdx` §驗收標準；衝突點：可測契約有、業務規格沒有同名驗收）                                                                 | 影響本 change 要不要帶一份 `login-session` 的 spec delta（只修來源註記）；補 docs/specs 則要走 `spec-writing`、不在本 PR。不影響測試修法                                                                   | 已決議（clarification Q5，2026-11-28）：在 `login-session` 的 delta 修正來源註記，指到 01-05 §規格「多個分頁同時延續登入狀態」第 3 條；不改 `docs/specs/` |

## 參考檔案

- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/e2e/account/session-guard.spec.ts`（第 13–15 行註解、第 33–42 行 `countFinished`、第 223–305 行 refresh conflicts 區塊）
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/e2e/shared/api-stubs.ts`
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/e2e/playwright.config.ts`
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/frontend/src/main.tsx`（雙重掛載的來源）
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/frontend/src/features/auth/session-query.ts`（查詢以取消訊號送出；取消時不轉成「未登入」）
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/frontend/src/features/auth/route-guards.tsx`
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/frontend/src/api/session-refresh.ts`（延續、等候、重送的流程，延續不受取消影響）
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/frontend/src/api/mutator.ts`
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/docs/specs/01-account/05-login-state.mdx`
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/openspec/specs/login-session/spec.md`
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/openspec/changes/archive/2026-11-26-login-auth-guard/specs/frontend-api-client/spec.md`
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/openspec/changes/archive/2026-11-27-sidebar-nav/design.md`
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/openspec/changes/archive/2026-11-28-dashboard-shell/acceptance.md`
- `/Users/mandy610425/project/label-suite-oss/.claude/worktrees/issue-804-session-guard-refresh/docs/development/rules/testing-agent-rules.mdx`（T8、附錄 T5／T11）
- GitHub #804、#812（本文與全部留言）
