---
title: 'Agent Hook 契約與平台支援矩陣'
description: 'Claude Code 2.1.273 與 Codex 0.153.0 的 hook 事件、阻擋能力、工具名稱、payload、timeout 與信任模型逐項實查對照；本 repo 要註冊的七個 hook 的契約表；repo 定位方式；以及兩邊都接不住的能力缺口與承接路徑。'
category: '開發說明'
tags: [開發說明, Agent, 規範, hooks]
createdAt: '2026-11-11'
updatedAt: '2026-11-11'
---

# Agent Hook 契約與平台支援矩陣

:badge[Issue #111]{variant="neutral"} :badge[正式開發前]{variant="warning"}

> `AGENTS.md` 是**規則本體**。這一份只定「**怎麼觸發、怎麼傳遞結果**」，不是第二份規則 canon，**一條新規則也沒有**。
> 規則內容在 [#104](https://github.com/label-suite/label-suite/issues/104) 底下的六份文件；自動 gate 的**政策**在 [testing-agent-rules.md](testing-agent-rules.md) T9。
> 兩邊說法不同時**以 `AGENTS.md` 為準**，並回報給維護者。

## 這份文件的邊界

| 邊界 | 說明 |
| :--- | :--- |
| 不實作任何 gate | [T9](testing-agent-rules.md) 明文禁止在規範文件裡實作 gate。本文件同樣只定契約；`.claude/` 的設定與 `scripts/`、`.github/` 的檢查器是 [#111](https://github.com/label-suite/label-suite/issues/111) 後兩張 PR 的事 |
| 不是規則來源 | hook 只呼叫本 repo 的共用檢查器。檢查器要擋什麼，依六份規範文件 |
| hook 不等於權限控制 | hook 攔不住平台權限層、產品授權與 CI 要負責的事。**本機 hook 通過不能代替 CI**（T9 的禁止格） |
| 不宣稱兩邊等價 | Claude 的設定、事件名稱、exit code 與工具名稱**不會**自動在 Codex 生效。見下方矩陣與§能力缺口 |

**這份文件不在 `pnpm check:specs` 的掃描範圍內。** `scripts/check-specs.mjs` 的 `listMdx` 只收 `.mdx`，而 `docs/development/` 底下是 `.md`；它的機械驗證只有 docs build（MDX 編譯）。所以本文件的事實正確性靠實查與獨立審查，不靠機械檢查——**不得因為 `check:specs` 綠就當成這份對過了**。

---

## 查核方式（2026-11-11）

工作項 1 明寫「**實作前核對當時版本的官方 hook 文件與實際 runtime**」。以下是這次實際跑過、看過的東西，不是憑印象：

| 查核對象 | 指令或網址 | 結果 |
| :--- | :--- | :--- |
| Claude Code runtime | `claude --version` | **2.1.273** |
| Codex runtime | `codex --version` | **codex-cli 0.153.0** |
| Codex 是否支援 hook | `codex features list` | `hooks` → **`stable` 且 `true`**（預設開啟，不是實驗功能） |
| Claude 官方 hook 文件 | `code.claude.com/docs/en/hooks`（`docs.claude.com/en/docs/claude-code/hooks` 301 轉到這裡） | 30 個以上事件 |
| Codex 官方 hook 文件 | `learn.chatgpt.com/docs/hooks` | 14 個事件 |
| 確認 Codex 文件是官方的 | `developers.openai.com/codex/hooks` | **308 轉址**到 `learn.chatgpt.com/docs/hooks`，故採為官方來源 |
| 本機有沒有 `timeout` | `command -v timeout` / `command -v gtimeout` | **兩個都沒有** |
| 本 repo 既有的 Git hook 入口 | `scripts/setup.sh`、`scripts/git-hooks/commit-msg` | `core.hooksPath=scripts/git-hooks`；commit-msg 以 `git rev-parse --show-toplevel` 定位後呼叫 `scripts/check-commit-msg.sh` |

### 三個會讓人寫錯的地方

1. **這台機器沒有 `timeout`，也沒有 `gtimeout`。** 所以 hook 腳本裡**不能**用 shell 的 `timeout` 去包檢查器——在 macOS 上那行會直接 `command not found`，而且如果寫成 `timeout 30 checker || true` 還會把「工具不存在」偽裝成通過。要用的是**平台 hook 設定自己的 `timeout` 欄位**（兩邊都有）。工作項 5 要求「跨 macOS／Linux 驗證 timeout 不依賴機器剛好裝了 GNU timeout」，這件事在本機就已經成立。
2. **Codex 的事件名稱是 PascalCase，不是 snake_case。** 從 `codex` binary 的 strings 讀得到 `pre_tool_use`、`post_tool_use`、`session_start`、`user_prompt_submit`，但官方文件寫的是 `PreToolUse`、`PostToolUse`、`SessionStart`、`UserPromptSubmit`。那些 snake_case 是**內部 enum 名稱**，不是設定檔的 wire format。**逆向讀 binary 不能當依據**，照它寫設定會得到一個永遠不觸發的 hook。
3. **Codex 有 hook 信任模型，Claude 沒有。** 非 managed 的 hook 要先逐一審核並信任，而**信任是綁在 hook 定義的 hash 上**：新加或改過的 hook 在被信任之前是 **skipped**。這件事對「必要 gate」是決定性的，見§能力缺口第 1 條。

---

## 平台支援矩陣

### 事件

「本 repo」欄只標這次契約有沒有要用，不代表平台沒有別的用途。

| 事件 | Claude Code 2.1.273 | Codex 0.153.0 | 本 repo |
| :--- | :--- | :--- | :--- |
| `SessionStart` | 有（matcher：`startup`／`resume`／`clear`／`compact`／`fork`） | 有（同樣 fires on startup、resume、clear、compact、fork） | **H1** |
| `SessionEnd` | 有（matcher：`clear`／`resume`／`logout`／`prompt_input_exit`／`other`） | 有（含 idle timeout） | 不用（時間預算太小，見下） |
| `UserPromptSubmit` | 有，**可阻擋** | 有，**可阻擋** | 不用 |
| `PreToolUse` | 有，**可阻擋**（matcher：工具名） | 有，**可阻擋**（matcher：工具名） | **H2** |
| `PostToolUse` | 有，**不能阻擋** | 有，**可擋後續**（但同樣不能撤銷副作用） | **H3** |
| `PermissionRequest` | 有 | 有 | 不用（屬平台權限層） |
| `PreCompact` / `PostCompact` | 兩個都有 | 兩個都有 | 不用 |
| `Stop` | 有，**可阻擋** | 有，**可阻擋** | **H6** |
| `SubagentStart` / `SubagentStop` | 兩個都有（matcher：agent type） | 兩個都有（matcher 支援**本次未確認**） | **H6**（同一支檢查器） |
| `Interrupt` | **沒有** | 有 | 不用 |
| `PreModelRequest` / `PostModelRequest` | **沒有**（Claude 的是 `PreModelSwitch`／`PostModelSwitch`，語意不同——換模型，不是每次請求） | 有 | 不用 |
| `Setup`、`PostToolUseFailure`、`PostToolBatch`、`PermissionDenied`、`TeammateIdle`、`TaskCreated`、`TaskCompleted`、`CwdChanged`、`DirectoryAdded`、`FileChanged`、`ConfigChange`、`InstructionsLoaded`、`WorktreeCreate`、`WorktreeRemove`、`Elicitation`、`ElicitationResult`、`Notification`、`MessageDisplay`、`UserPromptExpansion`、`StopFailure` | 有 | **都沒有** | 不用 |

**共通子集只有十一個**：`SessionStart`、`SessionEnd`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`PermissionRequest`、`PreCompact`、`PostCompact`、`Stop`、`SubagentStart`、`SubagentStop`。本文件的契約**只用共通子集**，單邊獨有的事件一個都不依賴——否則同一份規則在兩個 agent 上的效果會不一樣，而那正是工作項 1 要防的事。

### 阻擋能力與退出碼

| 事件 | Claude Code 2.1.273 | Codex 0.153.0 |
| :--- | :--- | :--- |
| `PreToolUse` | exit `2`（stderr 當原因）或 `hookSpecificOutput.permissionDecision: "deny"` 加 `permissionDecisionReason` | exit `2`（stderr 當原因）或 `permissionDecision: "deny"`（舊式 `decision: "block"` 仍收） |
| `PostToolUse` | **擋不住**。exit `2` 只是把 stderr 給 agent 看 | `decision: "block"` 或 `continue: false` **可擋後續**；但**不能撤銷**已經發生的副作用 |
| `Stop` / `SubagentStop` | exit `2` 或 `decision: "block"` | exit `2` 或 `decision: "block"`（擋下代表「帶著原因繼續這個 turn」，不是終止） |
| `SessionStart` | **擋不住**。exit `2` 只顯示 stderr | 文件未列為可阻擋事件 |
| exit `0` | 成功，套用 JSON 輸出欄位 | 同 |
| 其他非零 | **非阻擋錯誤**，動作照做，只顯示 stderr 第一行（除非該 handler 設了 `onFailure: "block"`） | 文件只定義 `2` 為阻擋；其他非零視為錯誤 |
| 失敗即阻擋的開關 | 有：handler 的 `onFailure: "block"` | **沒有**（本次查核未見等價欄位） |

**兩個會咬人的差異**：

- **`PostToolUse` 的語意相反。** 在 Claude 上它純粹是提醒，在 Codex 上它能擋下後續。所以 H3 的檢查器**不能靠 `PostToolUse` 當 gate**——要在兩邊都成立，它只能是提醒，真正的 gate 放 Git hook 與 CI。工作項 2 的「PostToolUse 回報失敗不等於撤銷原編輯」在兩個平台都成立，而且 Claude 那邊更弱。
- **只有 Claude 有 `onFailure: "block"`。** 「檢查器自己壞掉時要不要擋」在 Claude 可以宣告，在 Codex 得由腳本自己以 exit `2` 表達。**不得假設不寫就會擋**。

### 工具名稱

matcher 比對的是工具名，而**兩邊的工具名不一樣**。這是本次查核影響最大的一項。

| 用途 | Claude Code 2.1.273 | Codex 0.153.0 |
| :--- | :--- | :--- |
| 執行命令 | `Bash` | `Bash` |
| 寫檔／改檔 | `Edit`、`Write`、`NotebookEdit` | `apply_patch`（matcher 也吃 `apply_patch`、`Edit`、`Write` 這三種寫法） |
| 讀檔 | `Read` | **沒有對應工具名**（讀檔走 shell） |
| 搜尋 | `Grep`、`Glob` | **沒有對應工具名**（走 shell） |
| MCP | `mcp__<server>__<tool>` | `mcp__<server>__<tool>` |
| 本地 function tool | — | `update_plan`、`spawn_agent` 等，走同一條 hook 路徑 |
| hosted 工具 | `WebSearch` 等有 hook | `WebSearch` 等 hosted 工具**不支援 hook** |

matcher 語法兩邊一致：`"*"`、`""` 或省略代表全部命中；`Edit|Write` 是替代列舉；含其他字元時當 regex（Claude 的文件明寫是**未定錨**的 JavaScript regex，所以 `^Bash$` 與 `Bash` 不同義）。

**既有設定的空轉警告。** 參考來源那份 `.claude/settings.json`（原始本機 repo）用 `Read|Edit|Write|Grep|Glob|NotebookEdit` 當 matcher 來擋敏感檔。搬到 Codex 時，`Read`、`Grep`、`Glob`、`NotebookEdit` **永遠不會命中**，只剩 `Edit|Write`（作為 `apply_patch` 的別名）有效——也就是「**攔截讀取**」這件事在 Codex 上整個落空。那份設定裡的 `MultiEdit` 是否仍是 Claude 的有效工具名，**本次沒有確認**（官方文件的 matcher 範例沒有列它），實作時要用 `/hooks` 與實際事件對過，不要照抄。

### 設定位置、handler、timeout、信任

| 項目 | Claude Code 2.1.273 | Codex 0.153.0 |
| :--- | :--- | :--- |
| 專案層設定 | `.claude/settings.json` 的 `hooks` 鍵（另有 `.claude/settings.local.json` 不進版控） | `.codex/hooks.json`，或 `.codex/config.toml` 的 `[[hooks.<Event>]]` |
| 使用者層設定 | `~/.claude/settings.json` | `~/.codex/hooks.json` 或 `~/.codex/config.toml` |
| 組織層 | managed policy settings（**最高優先、不能停用**） | managed hooks（system／MDM／cloud／`requirements.toml`，**trusted by policy 且不能停用**） |
| handler 型別 | `command`、`http`、`mcp_tool`、`prompt`、`agent` | `command`、`mcp_tool` |
| 設定結構 | `hooks.<Event>[].matcher` 加 `hooks[]`（`type`／`command`／`args`／`timeout`／`onFailure`） | `hooks.<Event>[].matcher` 加 `hooks[]`（`type`／`command`／`statusMessage`／`timeout`／`async`） |
| timeout 預設 | `command` **600 秒**；`UserPromptSubmit` 等 30 秒；`MessageDisplay` 10 秒；`SessionEnd` 共用 **1.5 秒**預算（個別 hook 宣告需要時放寬到 60） | 多數 **600 秒**；**`SessionEnd` 與 `Interrupt` 只有 1 秒，上限 3 秒** |
| 非同步執行 | — | `"async": true`（預設同步） |
| 信任模型 | **沒有**。設定檔裡的 hook 直接生效 | **有**。非 managed 的 hook 要逐一審核並信任，信任綁 hook 定義的 **hash**；新加或改過的在信任前**被跳過**。`/hooks` 管理，`--dangerously-bypass-hook-trust` 可單次跳過 |
| 全部停用 | `"disableAllHooks": true` | 以 `/hooks` 停用個別非 managed hook |
| 專案根佔位符 | `${CLAUDE_PROJECT_DIR}`（另有 `${CLAUDE_PLUGIN_ROOT}`、`${CLAUDE_PLUGIN_DATA}`） | **沒有專案根佔位符**。只有 `PLUGIN_ROOT`、`PLUGIN_DATA`（與 `CLAUDE_PLUGIN_ROOT`、`CLAUDE_PLUGIN_DATA` 相容別名）。官方給的作法是 `$(git rev-parse --show-toplevel)` |

**兩份設定要分開維護。** 同一個 hook 在本 repo 會有兩個註冊點（`.claude/settings.json` 與 `.codex/hooks.json`），兩邊指向**同一支腳本**。這不是重複實作，而是兩個平台的設定格式與事件集合不同；腳本只有一份，差異收在設定裡。

**`SessionEnd` 不放任何實際工作。** Codex 給 1 秒、上限 3 秒，Claude 的共用預算是 1.5 秒。要做事的收尾放 `Stop`（H6），不放 `SessionEnd`。

---

## 本 repo 的 Hook 契約

七個 hook，一一交付工作項 1 要求的九個欄位：**目的、事件、適用路徑或角色、payload 欄位、共用檢查器、timeout、輸出與退出碼、阻擋或提醒、缺工具或無適用檔案時的行為**。

檢查器標「待建置」就是字面意思；**不得因為這份契約存在就宣稱 hook 已經在跑**。

### H1 Session 開始：環境自我檢查

| | |
| :--- | :--- |
| **目的** | 把「這個 checkout 的 Git hook 有沒有啟用、規則入口在不在、工具版本夠不夠」在對話一開始就講清楚，而不是等到 commit 被退才發現 |
| **事件** | `SessionStart`（matcher `startup|resume|clear|compact|fork`，兩邊都支援這五種） |
| **適用路徑／角色** | 整個 repo，不分角色 |
| **payload 欄位** | `cwd`（定位 repo）、`hook_event_name`、`session_id`（只用於 log 關聯） |
| **共用檢查器** | `scripts/check-env.sh`（**待建置**）：核對 `core.hooksPath` 是否指向 `scripts/git-hooks`、`AGENTS.md` 是否存在、`node`／`pnpm`／`uv` 版本 |
| **timeout** | **10 秒**（本文件提議，待裁定）。環境檢查不該讓對話等 |
| **輸出與退出碼** | 一律 exit `0`，訊息走 stdout。缺東西時列出「缺什麼、怎麼補」 |
| **阻擋或提醒** | **提醒**。`SessionStart` 在兩邊都擋不住，所以也不假裝它能擋 |
| **缺工具／無適用檔案** | `backend/`、`frontend/` 還不存在時標 **not applicable** 而不是失敗（工作項 2 明文「不要求尚未建立的 backend/frontend 必須存在」）。**不讀 `.env` 的值**，只看檔案在不在 |

### H2 工具執行前：破壞性命令與受保護目標

| | |
| :--- | :--- |
| **目的** | 在動作**發生前**擋下 `AGENTS.md` 硬性規則 2、3、10 會禁止的事：commit／push 到 `main`、`git push --force`、`rm -rf`、`git reset --hard`、`git branch -D`、用 `pip install`／`npm install` 取代 `uv add`／`pnpm add` |
| **事件** | `PreToolUse`。Claude matcher `Bash`；Codex matcher `Bash`。寫檔目標的保護另註冊一組：Claude `Edit|Write|NotebookEdit`，Codex `apply_patch` |
| **適用路徑／角色** | 命令那組不分路徑；寫檔那組只看目標路徑（`.env*`、`*.pem`、`*.key`、`*id_rsa*`、`credentials.json`、`docs/specs/00-prd.mdx`） |
| **payload 欄位** | `tool_name`、`tool_input`（Bash 取 `command`；寫檔取檔案路徑）、`tool_use_id`、`cwd` |
| **共用檢查器** | `scripts/check-command.sh`、`scripts/check-write-target.sh`（**兩者待建置**） |
| **timeout** | **5 秒**（本文件提議，待裁定）。這支擋在每個工具呼叫前面，不能慢 |
| **輸出與退出碼** | 擋下時 exit `2`，原因寫 stderr；或輸出 `permissionDecision: "deny"` 加 `permissionDecisionReason`。**兩種寫法兩邊都收**，優先用 exit `2`＋stderr，因為 JSON 欄位名在兩邊的細節不完全一致 |
| **阻擋或提醒** | **阻擋**。工作項 2 明文「必須在動作前拒絕；不能只在執行後提醒」 |
| **缺工具／無適用檔案** | 檢查器本身不存在或壞掉時：在 Claude 以 `onFailure: "block"` 宣告擋下；在 Codex **沒有**這個欄位，所以腳本自己要在無法判斷時 exit `2`。**不得用 `|| true` 把判斷不了變成通過** |

**這一條的保護範圍有明確上限，寫在§能力缺口第 2 條，不得當成完整安全邊界。**

### H3 編輯後：按路徑跑快速檢查

| | |
| :--- | :--- |
| **目的** | 剛改過的檔案立刻拿到可修正的診斷，而不是等 CI |
| **事件** | `PostToolUse`。Claude matcher `Edit|Write|NotebookEdit`；Codex matcher `apply_patch` |
| **適用路徑／角色** | 只對**本次受影響且已存在**的檔案，依副檔名分流：`.py` → `ruff` 加 `mypy`；`.ts`／`.tsx` → `tsc --noEmit` 加 `eslint`；`.mdx` → `node scripts/check-specs.mjs docs`。**排除** `frontend/src/api/generated/`、Alembic migration、`pnpm-lock.yaml`、`uv.lock` 與 vendor |
| **payload 欄位** | `tool_name`、`tool_input` 的檔案路徑、`cwd` |
| **共用檢查器** | `scripts/check-changed.sh`（**待建置**）。`.mdx` 那條沿用既有的 `scripts/check-specs.mjs` |
| **timeout** | **30 秒**（本文件提議，待裁定） |
| **輸出與退出碼** | 診斷走 stderr。**一律不以 exit `2` 阻擋**——見下 |
| **阻擋或提醒** | **提醒**。Claude 的 `PostToolUse` 本來就擋不住；Codex 的擋得住後續，但**刻意不用**，否則同一份規則在兩個 agent 上效果不同。真正的 gate 是 H4、H5 與 H7 |
| **缺工具／無適用檔案** | 本次沒有命中的檔案（例如只改了 `.md`）→ 標 not applicable 並 exit `0`；檔案被刪除或改名 → 不對不存在的檔案報錯；`ruff`／`mypy`／`tsc` 不存在且該層尚未 bootstrap → 標 not applicable。**已宣告啟用的檢查缺工具時要明確失敗**，不是靜默通過 |

**預設 check-only。** 要不要自動 format／fix 是維護者的政策決定（工作項 4），本文件不替它決定；未裁定前不自動改檔、不自動 `git add`。

### H4 Git pre-commit：檢查 staged 快照

| | |
| :--- | :--- |
| **目的** | 在提交成形前，對**真正要進去的內容**跑檢查 |
| **事件** | Git `pre-commit`（不是 agent 事件）。由 `core.hooksPath=scripts/git-hooks` 啟用 |
| **適用路徑／角色** | `git diff --cached` 命中的檔案，分流規則同 H3 |
| **payload 欄位** | 無（Git hook 沒有 JSON payload）。輸入是 staged snapshot |
| **共用檢查器** | 與 H3 **同一支** `scripts/check-changed.sh`（**待建置**），差別只在檔案清單怎麼來 |
| **timeout** | 無平台 timeout。腳本自己設上限；**不得用 shell `timeout`**（本機沒有，見查核方式） |
| **輸出與退出碼** | 非零即擋下 commit，這是 Git 的既有語意 |
| **阻擋或提醒** | **阻擋**。但 `--no-verify` 可跳過，所以它不是最終 gate——`scripts/git-hooks/commit-msg` 的註解已經把這件事寫明了 |
| **缺工具／無適用檔案** | 必須讀**staged 版本**（`git show :<path>`），不能拿工作區的檔案充數，否則「unstaged 的修正」會被誤當成「staged 已通過」。部分暫存與在子目錄執行都要正確——`git rev-parse --show-toplevel` 已是本 repo 既有作法 |

### H5 Git commit-msg：檢查提交訊息

| | |
| :--- | :--- |
| **目的** | 擋下不符 `AGENTS.md` §Commits 的訊息（英文 Conventional Commits、subject ≤ 72 字、body 每條粗體動詞開頭） |
| **事件** | Git `commit-msg` |
| **適用路徑／角色** | 提交訊息本身 |
| **payload 欄位** | 無。輸入是 `$1`（訊息檔路徑） |
| **共用檢查器** | **`scripts/check-commit-msg.sh`（已存在）**。這是本 repo 唯一已經在跑的 hook 檢查器 |
| **timeout** | 無 |
| **輸出與退出碼** | 非零即擋下 commit |
| **阻擋或提醒** | **阻擋**；同樣可被 `--no-verify` 跳過，所以 CI 的 `commit-messages` job 才是真正的 gate |
| **缺工具／無適用檔案** | merge commit（`$GIT_DIR/MERGE_HEAD` 存在）直接 exit `0`，這是現行行為，照留 |

**H5 不改，只記錄。** 它與 CI 的 `commit-messages` job 已經共用同一支檢查器，正是這份契約要的形狀；[#111](https://github.com/label-suite/label-suite/issues/111) 不重建它。

### H6 工作與子任務結束：核對證據

| | |
| :--- | :--- |
| **目的** | 在 agent 宣告做完之前，核對該跑的驗證有沒有跑、evidence 齊不齊（[T11](testing-agent-rules.md)） |
| **事件** | `Stop` 與 `SubagentStop`（兩邊都有，且**兩邊都可阻擋**） |
| **適用路徑／角色** | 整個 repo。Claude 可用 agent type 當 matcher 分流角色；**Codex 的 SubagentStop 是否支援 matcher 本次未確認**，所以角色分流不得作為必要條件 |
| **payload 欄位** | `last_assistant_message`、`session_id`、`transcript_path`（只在本機用，**不外傳**）、`cwd` |
| **共用檢查器** | `scripts/check-evidence.sh`（**待建置**） |
| **timeout** | **60 秒**（本文件提議，待裁定） |
| **輸出與退出碼** | 擋下時 exit `2` 或 `decision: "block"`，原因要寫「缺哪一項證據」 |
| **阻擋或提醒** | **阻擋**，但**必須防重入**：被擋下之後 agent 會再結束一次，又觸發自己。要有一次性標記與併發策略，否則失敗後無限重跑（工作項 5） |
| **缺工具／無適用檔案** | 只重用與**目前 snapshot、規則版本與驗證範圍一致**的 evidence；對不上就當沒有。`backend/`、`frontend/` 不存在時標 not applicable |

**不新增第三個停點。** [T12](testing-agent-rules.md) 明文只有兩個停點；H6 是機械核對，不是要維護者確認的關卡。

### H7 CI：重跑必要檢查

| | |
| :--- | :--- |
| **目的** | 本機 hook 可被 `--no-verify` 與 `disableAllHooks` 跳過、在 Codex 還可能因為未被信任而 skipped，所以合併前的真正 gate 在 CI |
| **事件** | `pull_request`（`.github/workflows/ci.yml`，已存在三個 job：`commit-messages`、`docs-site`、`specs`） |
| **適用路徑／角色** | 整個 PR |
| **payload 欄位** | GitHub 事件的 `base.sha` 與 `head.sha`（現行 `commit-messages` job 已經在用） |
| **共用檢查器** | 與 H3、H4、H5 **同一組**。CI 與本機共用邏輯是防漂移的唯一辦法 |
| **timeout** | 由 workflow 設定 |
| **輸出與退出碼** | job 失敗即擋下合併（搭配 branch protection） |
| **阻擋或提醒** | **阻擋**。**本機通過不能代替 CI**（[T9](testing-agent-rules.md) 的禁止格） |
| **缺工具／無適用檔案** | CI 不得標 not applicable 來跳過已宣告啟用的必要檢查。branch protection 的啟用是**維護者的設定權限**，不是本單能改的——這兩件事要分清楚 |

---

## Repo 定位

工作項 1 第三個 bullet：**不寫死 `/Users/...`，不以目前 shell 的另一個 checkout 代替事件 workspace。**

| 情境 | 作法 |
| :--- | :--- |
| Claude，專案層 hook | `${CLAUDE_PROJECT_DIR}/scripts/<checker>`。這是平台提供的專案根佔位符 |
| Codex，專案層 hook | **沒有**對應佔位符。用 `"$(git rev-parse --show-toplevel)"/scripts/<checker>`，與 `scripts/git-hooks/commit-msg` 現行作法一致 |
| 事件 cwd | 兩邊的 hook command 都以 session 的工作目錄為 `cwd`，payload 另給 `cwd` 欄位。**以 payload 的 `cwd` 為準**，不要用腳本自己的 `$PWD`——那可能是另一個 checkout |
| 子目錄執行 | 一律先 `cd "$(git rev-parse --show-toplevel)"`，`scripts/setup.sh` 已是這個形狀 |
| worktree | `git rev-parse --show-toplevel` 在 worktree 裡回傳該 worktree 的根，正確。**不要**用 `--git-common-dir` 去找主 checkout |
| 空白與中文路徑 | 所有路徑展開一律加雙引號。本 repo 的 `scripts/` 路徑目前都是 ASCII，但 `cwd` 由使用者的目錄決定，不能假設 |

---

## 能力缺口與承接

工作項 1 要求：**沒有對應能力時明列限制，以共用指令／Git／CI 承接，不宣稱等價攔截。**

1. **Codex 的 hook 信任模型讓 hook 不能單獨作為必要 gate。** 非 managed 的 hook 在被信任前是 skipped，而信任綁 hash——意思是**每次改 hook，所有開發者那邊都會重新變成未信任而跳過**，而版控裡的檔案看起來是好的。
   **承接**：必要 gate 一律在 **CI（H7）** 再跑一次；hook 只負責「早一點講」。另外在 H1 的環境檢查裡回報「hook 是否實際生效」，讓跳過這件事看得見而不是靜悄悄。
2. **字串比對不是完整的命令安全邊界。** H2 讀的是 `tool_input.command` 的字串。複合命令、引號、變數展開、`eval`、`git -C <path>`、refspec 寫法、base64 之類的編碼都能繞過字串規則；反過來，Issue 本文或 commit body 裡**提到** `rm -rf` 的文字也可能被誤判成正在執行。
   **承接**：H2 擋**明顯**的情況並寫明它不是安全邊界；真正的保護靠平台權限層（Claude 的 `permissions.deny`、Codex 的 sandbox 與權限設定）與 **branch protection**。驗收要涵蓋複合命令、引號、參數變體與「文件裡提到命令」這幾類（工作項 3）。
3. **Codex 攔不住讀取。** 沒有 `Read`／`Grep`／`Glob` 工具名，讀檔走 shell，所以「不要讀 `.env` 的值」在 Codex 上沒有 hook 層的攔截點。
   **承接**：靠平台權限／sandbox 設定與 `.gitignore`；`AGENTS.md` 硬性規則 8 本來就要求 secret 從環境變數來。**不宣稱 Codex 有等價攔截。**
4. **`PostToolUse` 在兩邊的強度不同**，所以 H3 一律當提醒。真正的 gate 在 H4、H5、H7。
5. **只有 Claude 有 `onFailure: "block"`。** 「檢查器自己壞了要擋下」在 Codex 得由腳本以 exit `2` 自己表達。
6. **平台權限層的對照本次沒做。** Claude 的 `permissions.deny` 有見過實例（參考來源那份 settings 擋 `.env.*`、`*.pem`、`*.key`、`*id_rsa*`、`credentials.json` 的寫入）；Codex 的 `config.toml` 有 `permissions`、`default_permissions`、`sandbox_mode`、`sandbox_workspace_write` 等鍵，但**這次只查了 hook 文件，沒有核對權限設定的官方文件**。
   **承接**：列為實作 PR 的前置查核項。工作項 3 要求「平台權限控制」與「hook 攔截」分清楚，而這一半還沒查完——**不在這份文件裡假裝查過了**。
7. **`.claude/` 與 `.codex/` 兩份設定有漂移風險。** 事件集合與工具名都不同，改一邊忘了另一邊不會有任何報錯。
   **承接**：H1 的環境檢查核對兩份設定指向的腳本是否都存在；長遠作法（例如從單一來源生成兩份設定）列入下方待裁定。

---

## 待維護者裁定

本文件提議、**尚未裁定**的事項。依 `AGENTS.md` §Required Behaviors，這些不自行決定：

| 題目 | 本文件的提議 | 為什麼要裁 |
| :--- | :--- | :--- |
| 四個 timeout | H1 10 秒、H2 5 秒、H3 30 秒、H6 60 秒 | 太短會誤擋，太長會卡住對話。沒有任何來源定過這四個數字，所以是提議而不是依據 |
| 自動 format／fix 的政策 | 預設 **check-only**，不自動改檔、不自動 `git add` | 工作項 4 明文「若要自動 format/fix，先確認維護者政策」 |
| 兩份設定要不要從單一來源生成 | 先手寫兩份並由 H1 核對一致性 | 生成器是額外機制，值不值得由維護者決定 |
| Codex hook 的信任要不要寫進 `scripts/setup.sh` 的指引 | 在 setup 輸出提示「Codex 使用者要跑 `/hooks` 信任」 | 這會影響新人上手流程 |

---

## 來源對照

| 來源 | 已確認內容 | 本專案處置 |
| :--- | :--- | :--- |
| Claude Code 官方文件（`code.claude.com/docs/en/hooks`，runtime 2.1.273） | 30 個以上事件、每個事件的阻擋機制、exit code 語意、matcher 比對對象與語法、payload 欄位、`hookSpecificOutput`、timeout 預設與 `onFailure`、設定位置與 `${CLAUDE_PROJECT_DIR}` | 事件與阻擋能力照收進矩陣；**只用與 Codex 的共通子集** |
| Codex 官方文件（`learn.chatgpt.com/docs/hooks`，runtime codex-cli 0.153.0） | 14 個事件、PascalCase 命名、`.codex/hooks.json` 與 `config.toml` 兩種寫法、handler 型別、timeout 預設與 `SessionEnd`／`Interrupt` 的 1 秒上限、信任模型、工具名稱清單、matcher 語法 | 同上；**信任模型與工具名稱差異是本次最重要的兩個發現** |
| 本機 runtime | `claude --version`、`codex --version`、`codex features list`、`command -v timeout` | 版本與「沒有 `timeout`」都以實測為準，不引用文件 |
| `codex` binary 的 strings | 內部 enum 是 snake_case | **不採為依據**，並在查核方式裡寫明理由，避免後人重蹈 |
| 本 repo | `scripts/setup.sh`（`core.hooksPath`）、`scripts/git-hooks/commit-msg`（`git rev-parse --show-toplevel` 加共用 checker）、`.github/workflows/ci.yml`（三個 job）、`.claude/settings.json`（目前只有 attribution） | **保留並擴充既有入口**，不另建重複的 commit checker |
| 參考來源的 `.claude/settings.json`（原始本機 repo） | 七支腳本與 `SessionStart`／`PreToolUse`／`PostToolUse`／`PreCompact`／`Stop`／`UserPromptSubmit` 的接線、`permissions.deny` 清單、`command -v harness ... || true` 的選用外部呼叫 | 參考**事件分工**；移除個人絕對路徑與外部 harness 假設。其 matcher 含 `Read|Grep|Glob|NotebookEdit`，搬到 Codex 會空轉，已在§工具名稱寫明 |
| [testing-agent-rules.md](testing-agent-rules.md) T9、T11、T12 | 七個 gate 的政策與歸屬（實作全歸 [#111](https://github.com/label-suite/label-suite/issues/111)）、evidence 的五個欄位、兩個停點 | H6 與 H7 直接接到這三條，不另定政策 |

---

## 變更紀錄

| Issue | 日期 | 變更 |
| :--- | :--- | :--- |
| [#111](https://github.com/label-suite/label-suite/issues/111) | 2026-11-11 | 初版。工作項 1 的三個 bullet：**事件、阻擋能力、工具名稱、設定位置、timeout 與信任模型的雙平台矩陣**（Claude Code 2.1.273 與 codex-cli 0.153.0，均以官方文件加本機 runtime 實查）、**七個 hook 的契約表**（各帶九個欄位）、**repo 定位**六種情境，以及**七項能力缺口與承接**。四個 timeout、自動 fix 政策等四題標為待裁定。查核中發現三件會寫錯的事：本機沒有 `timeout`／`gtimeout`；Codex 事件名是 PascalCase 而 binary 內部 enum 是 snake_case；Codex 有綁 hash 的 hook 信任模型，改過的 hook 在信任前會被跳過 |
