# Proposal

## Why

`AGENTS.md` 的硬性規則與六份規範文件目前只靠人與 agent 自律遵守：契約定義的七個 hook 裡**只有 H5（`scripts/git-hooks/commit-msg`）與 H7（CI）是活的，而且兩者都早於 #111 就存在**，H1、H2、H3、H4、H6 一行程式都沒有（#111 2026-11-16 重開註記）。2026-11-17 複查現況，與契約 2026-11-11 的查核完全一致：`scripts/` 只有 `check-commit-msg.sh`、`check-er-data.mjs`、`check-flows.mjs`、`check-specs.mjs`、`serve-prototype.mjs`、`setup.sh` 與 `tests/`；`scripts/git-hooks/` 只有 `commit-msg`；`.claude/settings.json` 只有 attribution 設定；`.codex/` 整個目錄不存在；`.github/workflows/ci.yml` 只有 `commit-messages`、`docs-site`、`specs` 三個 job。契約所列的五支檢查器（`check-env.sh`、`check-command.sh`、`check-write-target.sh`、`check-changed.sh`、`check-evidence.sh`）全部標著**待建置**。

契約 `docs/development/agent-hook-contract.mdx` 已於 2026-11-11 交付並合併，七個 hook 的九欄契約、七項能力缺口與承接、repo 定位、平台支援矩陣與查核方式都已確認，實作要用到的裁定也都收在它的 §決策紀錄——現在缺的只是把它接起來。**現在做的理由**：`backend/`、`frontend/` 都還不存在，此刻接上防護，第一行產品程式寫下時規則就已經在跑；等產品程式先長出來再補，等於讓未受檢查的程式先累積一批。

## What Changes

### 前置查核（先做，結論會影響 H2 的範圍）

- **平台權限層的官方文件對照：Codex 這一半已於 2026-11-17 查完。** 契約 §能力缺口與承接第 6 條記著「這次只查了 hook 文件，沒有核對權限設定的官方文件」，並列為實作 PR 的前置查核項；#111 §3 於 2026-11-16 補列同一項（未勾項第 8 條）。查核對象 `https://learn.chatgpt.com/docs/permissions`（`https://developers.openai.com/codex/permissions` 308 轉址過去，與契約 §附錄 認定官方來源的方式一致），本機 runtime codex-cli 0.153.0。**文件未標版本，故以查核日為準。** 結果：

  - **Codex 有兩套互斥的機制**，文件原文：「Permission profiles do not compose with the older sandbox settings. Configure either `default_permissions` and `[permissions]`, or `sandbox_mode` / `sandbox_workspace_write`, but not both.」契約把那四個鍵並列，讀起來像同一套設定的四個欄位；實際上必須擇一。
  - **Permission profiles**：`default_permissions` 收自訂 profile 名或內建 `:read-only`／`:workspace`／`:danger-full-access`，文件要求明確設定。`[permissions.<名稱>]` 的子鍵有 `description`、`extends`、`workspace_roots`、`filesystem`（值 `read`／`write`／`deny`，**`deny` 在同等特異性下勝過 `write` 或 `read`**）、`network.enabled`、`network.domains`。
  - **舊的 sandbox 設定**：`sandbox_mode` 加 `[sandbox_workspace_write]` 的 `network_access`、`writable_roots`、`exclude_tmpdir_env_var`、`exclude_slash_tmp`；`workspace-write` 預設不開對外網路。

  **對契約的影響**：§能力缺口第 3 條（「Codex 攔不住讀取」）前半仍然成立——**hook 層**確實沒有攔截點；但 `filesystem` 的 `deny` 是**權限層**的宣告式攔截，所以該條的「承接」要從「靠 `.gitignore` 與硬性規則 8」改寫成指名這個機制。**這是修正承接方式，不是推翻原句。**

- **Claude 那一半也在 2026-11-17 查完了。** 對象 `https://code.claude.com/docs/en/settings` 與 `.../permissions`，本機 Claude Code 2.1.273。結果：

  - `permissions.deny` 以「工具名（gitignore 風格樣式）」寫，文件原始範例就是 `"deny": ["Read(./.env)", "Read(./.env.*)"]`——**它擋得住讀取**。`!` 開頭是排除（`Read(!sample.env)`），正好是契約 §H2 要的「合法例外」機制。
  - **`deny` 與 `ask` 立即生效，`allow` 要等工作區信任**（文件：「`deny` and `ask` rules apply right away」）。所以提交在 `.claude/settings.json` 的拒絕規則對 clone 的人**立刻**生效，不受 Codex 那種「改了 hook 就失去信任」的問題影響。
  - 優先序是絕對的：「If a tool is denied at any level, no other level can allow it.」

  **又一次「欄位存在 ≠ 這個版本有」**（契約 §查核方式 第 4 點的同類陷阱，而且不只 `onFailure` 一個）：`permissions.blockReadsOutsideWorkingDirectories` 需 2.1.257（本機**可用**）、`permissions.blockWritesOutsideWorkingDirectories` 需 2.1.314（**不可用**）、`permissions.denyInsteadOfPrompting` 需 2.1.319（**不可用**）。連同 `onFailure` 需 2.1.295，四個鍵都要和本機 2.1.273 比對過才能依賴。

  **所以契約 §能力缺口 第 6 條可以結案**：兩側都查完了。剩下的 Q2 是選擇題，不是查核問題。
- **重新核對實作當時版本的官方 hook 文件與 runtime**（#111 §1 第 2 項；契約 §查核方式要求實作前再核一次）。2026-11-17 已複查並與契約一致：Claude Code **2.1.273**（故 `onFailure: "block"` 仍不可用，它需 v2.1.295）、codex-cli **0.153.0**、`codex features list` 的 `hooks` 為 `stable`／`true`、本機**沒有** `timeout` 也沒有 `gtimeout`。

### 五支待建置的共用檢查器

依契約各 H 的「共用檢查器」欄，一支檢查器同時供 agent hook、Git hook、手動指令與 CI 呼叫（#111 §需求目標）：

- `scripts/check-env.sh`（契約 §H1）：核對 `core.hooksPath`、`AGENTS.md` 是否存在、工具版本，以及**本次 hook 是否真的會跑**（Claude 看 `disableAllHooks`，Codex 看 `[features] hooks` 與信任狀態），並核對兩份設定指向的腳本是否都存在。
- `scripts/check-command.sh`、`scripts/check-write-target.sh`（契約 §H2）：在動作**發生前**擋下 `AGENTS.md` 硬性規則 2、3、10 禁止的命令與受保護路徑寫入，含 `.env.example`、`*.pub`、`scripts/tests/fixtures/` 等合法例外。
- `scripts/check-changed.sh`（契約 §H3、§H4 **同一支**）：依副檔名分流的快速檢查，差別只在檔案清單怎麼來（PostToolUse 的 payload 路徑 vs. `git diff --cached` 的 staged 快照）。
- `scripts/check-evidence.sh`（契約 §H6）：在 agent 宣告做完之前核對驗證與 evidence。

### 兩份 hook 註冊設定

- `.claude/settings.json` 新增 `hooks` 鍵（目前只有 attribution，不得覆寫既有設定）。
- **新增 `.codex/hooks.json`**（`.codex/` 目前整個不存在）。
- 兩份**手寫維護、由 H1 的環境檢查核對**，不做單一來源生成器（契約 §能力缺口第 7 條與 §決策紀錄 2026-11-11）。

### 一個新的 Git hook 與 CI 擴充

- 新增 `scripts/git-hooks/pre-commit`（契約 §H4），讀 **staged 版本**（`git show :<path>`），不拿工作區檔案充數。
- `scripts/git-hooks/commit-msg` 與 `scripts/check-commit-msg.sh`（H5）**不改，只記錄**：它已經是契約要的形狀（契約 §H5）。
- `.github/workflows/ci.yml` 接上與 H3／H4 **同一組**檢查器（契約 §H7），因為本機 hook 有四條被跳過的途徑，合併前的真正 gate 在 CI。

### 跨 hook 的可靠性、隱私與安裝

- Payload 驗證、路徑正規化與 workspace 範圍限制，不用 `eval` 或拼接不受信任 shell（#111 §5 第 1 項）。
- malformed JSON、未知事件、缺工具、timeout、runner crash、非零退出、過大輸出的處理一律明列；**不得用 `|| true` 把判斷不了變成通過**（#111 §5 第 2 項；契約 §H2、§H3）。阻擋型的檢查器**自行** fail-closed（無法判斷就 exit `2`），因為兩個平台的預設都是 fail-open（契約 §能力缺口第 5 條）。契約 §H2 的措辭是「包裝腳本一律先確認檢查器存在且可執行」，但 design D7 不另建包裝腳本、註冊設定直接指向檢查器——理由是包裝腳本只把「哪個檔必須存在」往前移一格，失效面一模一樣。這處偏離與其回填一併記在 design D7 與 task 7.1。
- 執行時間與輸出大小上限一律用**平台 hook 設定的 `timeout` 欄位**，不得用 shell `timeout`（本機沒有，契約 §查核方式第 1 點）。
- `Stop`／`SubagentStop` 的防重入用 payload 的 `stop_hook_active`，不自造標記檔（契約 §H6）。
- 本機診斷 log（若保留）只記脫敏 metadata、有上限與 ignore，與產品 `audit_events` 分開（#111 §5 第 5 項）。
- `scripts/setup.sh` 的安裝流程可重複執行、沿用現有 `core.hooksPath`、偵測既有自訂設定衝突、提供停用與復原方法（#111 §驗收條件第 2 項）。

### 測試與證據

- 以隔離的暫存 repo／worktree 與假的 runner 驗證 allow、deny、warning、合法例外、退出碼、timeout、輸出上限、缺工具、staged/unstaged、含空白與中文的路徑、產物排除與防重入；不真的執行破壞性操作、不接觸正式 secret（#111 §驗收條件第 3 項）。
- 至少一次**實際 runtime 事件 smoke test**，確認註冊、matcher、payload、回饋與攔截確實生效；只有腳本測試通過不算完成（#111 §驗收條件第 4 項）。
- 完成報告記錄測試命令、版本、退出碼、snapshot 與未覆蓋能力（#111 §驗收條件第 6 項）。

### 文件回填

- 契約文件中已建置檢查器的「待建置」標記改為現況。
- `AGENTS.md` §Agent Rules Index 末段的現況敘述「No agent hook is wired yet: `.claude/settings.json` carries only the attribution setting, there is no `.codex/hooks.json`…」在本 change 之後不再成立，需更新為實際現況。**只改現況陳述，不新增、不修改任何規則**——契約不是規則來源，本 change 也不產生新規則（契約 §邊界）。

### 破壞性變更

- **BREAKING（本機開發流程）**：新增的 pre-commit gate 會擋下先前可以成立的提交；H2 的 `PreToolUse` 會在動作前拒絕部分工具呼叫。兩者都可被 `--no-verify`／`disableAllHooks`／`[features] hooks = false` 跳過，所以不是最終 gate，但既有工作習慣會改變。
- **BREAKING（Codex 使用者）**：Codex 的 hook 信任綁 hook 定義的 hash，**每次改 hook，所有 Codex 開發者那邊都會重新變成未信任而被跳過**，而版控裡的檔案看起來是好的（契約 §能力缺口第 1 條）。

### 明確不在本次範圍

- **coverage gate（#111 §2b 第二項）不在本 change 內。** #111 自己寫明「coverage gate 在 `backend/` 出現之前無法開始——沒有產品程式可以量覆蓋率」。它**留在 #111 上**，本 change 的 specs、design 與 tasks 都不得出現它。
- 重建 commit-msg 檢查器（H5 已是契約要的形狀）。
- session 摘要、圖片自動轉檔／縮圖、輸出自動重寫、PRD bump、prototype diff artifact、外部 harness（#111 §附註）。
- `docs/specs/` 的需求、`docs/specs/00-prd.mdx` 與 `design/prototype/`。
- branch protection 的啟用——那是維護者的設定權限，不是實作契約的人能改的（契約 §H7）。
- 不用 hook 擋 `docs/specs/00-prd.mdx` 的寫入（契約 §決策紀錄 2026-11-11）。

## Capabilities

### New Capabilities

- `agent-rule-enforcement`: 本 repo 已核准的規則在什麼時機被自動執行、由哪一支共用檢查器判斷、結果怎麼回報、哪些情況阻擋哪些只提醒，以及兩個 agent 平台之間哪些能力接不住、由誰承接。選這個邊界的理由：它擁有的是「規則怎麼被強制執行」這組會隨規則增加而持續長大的行為，與規則內容本身（`AGENTS.md`）和產品能力（`user-management`）都分得開，也不綁死在 hook 這個實作手段上——同一組行為同時由 agent hook、Git hook 與 CI 承擔。沿用 `openspec/specs/` 現行的單層 kebab-case 組織。

### Modified Capabilities

無。`user-management` 是本 repo 現有的唯一 capability，描述的是產品帳號管理行為，本 change 不改它的任何 requirement。

## Impact

| 類別 | 受影響對象 |
| :--- | :--- |
| 新增檔案 | `scripts/check-env.sh`、`scripts/check-command.sh`、`scripts/check-write-target.sh`、`scripts/check-changed.sh`、`scripts/check-evidence.sh`、`scripts/lib/hook-payload.mjs`、`scripts/lib/hook-common.sh`（五支檢查器共用的支援層，`design.md` D1）、`scripts/git-hooks/pre-commit`、`.codex/hooks.json`、`scripts/tests/` 下對應的測試 |
| 修改檔案 | `.claude/settings.json`（新增 `hooks` 鍵）、`scripts/setup.sh`（安裝流程與衝突偵測）、`.github/workflows/ci.yml`（接上同一組檢查器）、`docs/development/agent-hook-contract.mdx`（「待建置」標記回填）、`AGENTS.md` §Agent Rules Index 末段的現況敘述 |
| 不動 | `scripts/check-commit-msg.sh`、`scripts/git-hooks/commit-msg`、`scripts/check-specs.mjs`／`check-flows.mjs`／`check-er-data.mjs` 的既有行為、`docs/specs/`、`design/prototype/` |
| 相依工具 | Claude Code 2.1.273、codex-cli 0.153.0、Git、`node`／`pnpm`（`uv` 待 `backend/` 出現後才適用）。不新增任何套件相依 |
| 對人的影響 | 全體開發者的提交流程；Codex 使用者每次 hook 變更後需重新信任，否則 hook 被跳過 |
| 風險 | 兩份設定漂移（承接：H1 核對）；字串比對不是完整的命令安全邊界（承接：平台權限層與 branch protection）；兩平台預設 fail-open（承接：腳本自行 exit `2` 加 CI） |

## 來源與追溯

**引用的來源**（`openspec/config.yaml` 的需求依據順序中，`docs/specs/` 的產品規格不涵蓋開發工具鏈，故本 change 的追溯對象是維護者核准的 #111 工作項、`AGENTS.md` 與契約章節；本 change 不新增任何規則）：

| 來源 | 引用的章節 |
| :--- | :--- |
| `docs/development/agent-hook-contract.mdx` | §邊界、§本 repo 的 Hook 契約 H1–H7、§能力缺口與承接 1–7、§Repo 定位、§平台支援矩陣（事件／阻擋能力與退出碼／工具名稱／設定位置）、§查核方式、§待決、§決策紀錄 |
| GitHub issue #111 | §需求目標、§1 第 2 項、§2 事件分工表與其兩項、§2b（第二項排除）、§3 六項（含 2026-11-16 補列的第 6 項；其中第 5 項已勾）、§4 全部四項、§5 第 1–5 項、§驗收條件第 1–4、6 項、§附註 |
| `AGENTS.md`（唯一規則來源） | Hard Rules 2、3、8、9、10；§Commits；§Language Rules；§Agent Rules Index（末段的 hook 現況敘述） |
| `docs/development/testing-agent-rules.mdx` | T9（本機 hook 通過不能代替 CI）、T11（evidence）、T12（只有兩個停點）——由契約 §H6、§H7 轉引，本 change 不另定政策 |

**待決問題（留給停點一，本 change 不自行決定）**

- **Q1 ＝ 契約 §待決第 1 題：Codex hook 的信任指引要不要寫進 `scripts/setup.sh`。** 提議是在 setup 輸出提示「Codex 使用者要跑 `/hooks` 信任，否則 hook 會被跳過」。卡住的是：這會影響新人上手流程，而 `setup.sh` 目前只做一件事（設 `core.hooksPath`），多印一段提示算不算它的職責。**由維護者決定**；本 proposal 不作答，`design.md` 與 `tasks.md` 需等這題有結論才能定 `setup.sh` 的工作範圍。

- **Q2（2026-11-17 查核後新增）：本 repo 的 Codex 設定採 permission profile 還是 sandbox？** 官方文件明寫兩者不可混用（原文見 §前置查核）。這個選擇會改變**每一位用 Codex 的開發者**的預設行為，不是實作者能決定的。**由維護者決定**；在有結論之前，`design.md` 不得假定 `.codex/` 會長成哪一種形狀。

**前置查核的現況**

- 契約 §能力缺口第 6 條的對照**兩側都已於 2026-11-17 完成**（Codex 與 Claude 的結果各見 §前置查核的前兩項），該條因此結案，不再是 H2 實作前的待辦。
- **查完 ≠ 設好。** 本 change 只把查核結果寫進契約與 H1／H2 的輸出（§文件回填），**不設定任何平台權限層**（Claude 的 `permissions.deny`、Codex 的 `config.toml`）；那屬於 `design.md` D19 排除的範圍，需要另開一張 issue。在權限層真的設好之前，契約 §能力缺口第 3 條的承接狀態是「已查明機制、尚未設定」。
- 外部文件會改版，所以上面每一條都附了查核日與網址。**引用這些結論之前要重查**，不要把舊結果當現況再講一次。
