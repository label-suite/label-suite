# Design

## Context

本 change 的動機與範圍見 `proposal.md`（§Why、§What Changes）；要滿足的行為見
`specs/agent-rule-enforcement/spec.md`（33 條 requirement）。本文件只決定**怎麼做**。

三件影響整份設計的現況：

1. **本 change 走 `spec-driven` 四產出 schema，沒有 `system-design.md`，也沒有 `api-contract.md`。**
   `openspec instructions design` 的 `rules` 只有一條：「決策要對應到 system-design 或
   api-contract 的段落」。那兩份產出在本 schema 下不存在，這條規則**無法照字面綁定**。
   本文件改以可驗證的等價做法替代：每個決策標註它的依據是
   `docs/development/agent-hook-contract.mdx` 的哪一節、spec delta 的哪一條 requirement、
   或 [#111](https://github.com/label-suite/label-suite/issues/111) 的哪一項；**沒有來源的決策一律明寫
   「本 design 的判斷，無來源」**。這件事已回報給派工者，不自行補一份 system-design。
2. **`AGENTS.md` 是唯一規則來源。** 契約文件自己的 §邊界 寫明它「不是規則來源」。本文件同樣
   不產生任何規則，只決定既有規則用什麼機制執行。
3. **一題未決（Q1，原 Q2）橫在 `.codex/` 的權限設定上**（proposal §待決問題、spec delta §待決問題）。
   本設計刻意把受影響的部分隔離，使它的任一答案都不需要重做其餘設計；
   見 [D16](#d16-codexhooksjson手寫新目錄註冊與-q1-切開) 與
   [D19](#d19-平台權限層不在本-change-設定只負責把歸屬講清楚)。
   原本並列的另一題（Codex 信任指引要不要寫進 `scripts/setup.sh`）已由**維護者 2026-11-17 裁定**為「要寫」，
   記在 [D18](#d18-setupsh-的職責三件安裝流程本體的事加一段-codex-信任指引)；§Open Questions 的編號也隨之重編。

既有可沿用的形狀（實測於 2026-11-17）：`scripts/setup.sh` 只設 `core.hooksPath=scripts/git-hooks`；
`scripts/git-hooks/commit-msg` 以 `git rev-parse --show-toplevel` 定位後 `exec` 共用檢查器；
`scripts/check-commit-msg.sh` 同時被該 hook 與 CI 的 `commit-messages` job 呼叫。
**H4、H7 的做法就照這個既有形狀長**，不另發明入口。

## Goals / Non-Goals

**Goals:**

- 一份判定邏輯同時服務四個呼叫者（Claude hook、Codex hook、Git hook、CI），四邊對同一份輸入得到同一個結論。
- 在兩個平台都 fail-open 的前提下，讓阻擋型觸發點（H2、H4、H6、H7）在「判斷不出來」時仍然擋得住。
- 把兩份手寫設定的漂移風險收斂到一道可機器執行的核對（H1 加 CI），而不是靠人記得改兩邊。
- 讓「hook 層能做什麼」與「平台權限層能做什麼」在程式、輸出與文件三處都分得開。

**Non-Goals:**

- 不設定任一平台的權限層（`permissions.deny`、Codex permission profile 或 sandbox）。理由見 [D19](#d19-平台權限層不在本-change-設定只負責把歸屬講清楚)。
- 不做兩份設定的單一來源生成器（契約 §決策紀錄 2026-11-11；spec「Session 開始時核對兩份 hook 註冊設定」）。本設計不重提這個選項。
- 不改 H5（`scripts/check-commit-msg.sh` 與 `scripts/git-hooks/commit-msg`）的任何行為（契約 §H5）。
- 不實作 coverage gate（proposal §明確不在本次範圍）。
- 不逐行規劃實作；檔案內部的函式切法留給實作者。

## Decisions

### D1 三層分工：觸發層只負責編碼，判定一律在檢查器

**決策。** 分三層：

| 層 | 內容 | 可以做什麼 |
| :--- | :--- | :--- |
| 註冊層 | `.claude/settings.json`、`.codex/hooks.json`、`scripts/git-hooks/pre-commit`、`ci.yml` 的 job | 只宣告「什麼事件、什麼 matcher、呼叫哪一支、timeout 多少」 |
| 檢查器層 | `scripts/check-env.sh`、`check-command.sh`、`check-write-target.sh`、`check-changed.sh`、`check-evidence.sh` | **唯一產生判定的地方** |
| 支援層 | `scripts/lib/hook-payload.mjs`、`scripts/lib/hook-common.sh` | payload 解析、路徑正規化、遮蔽、輸出截斷 |

**「觸發層 MUST NOT 自行判斷規則內容，也 MUST NOT 改寫檢查器的判定」**（spec「規則判定一律來自共用檢查器」）
在本設計裡的精確含意：判定的**內容**（通過與否、診斷文字）由檢查器產生且原樣傳出；
觸發層只做**編碼**——把同一個判定翻成該平台要求的退出碼與輸出流。
H3 把「有診斷」編碼成 exit `0`（契約 §H3「一律不以 exit `2` 阻擋」），
H4 把同一個判定編碼成非零，**兩者的診斷文字完全相同**。這是編碼差異，不是改判。

**替代方案（否決）：** 讓每個觸發點自己帶一小段判斷（例如 H3 只對 `docs/` 跑）。
否決理由：那會讓同一份輸入在 H3 與 H4 得到不同結論，直接違反 spec 第一條 requirement。

**支援層是本 design 新增的檔案。** 理由：payload 解析、路徑正規化、遮蔽與截斷五支檢查器都要用，
寫五份就等於放棄「一支檢查器服務四個呼叫者」的目標。
它原本不在 proposal §Impact 的「新增檔案」欄，**2026-11-17 的規劃回修已把這兩個檔補進 Impact**，
`tasks.md` 也已列入（task 2.2、2.3）。

### D2 檢查器的共同介面：輸入模式、輸出流、退出碼

**決策。** 五支檢查器共用同一組介面，差異只在它判什麼。

**輸入模式**（互斥，由旗標選擇）：

| 模式 | 旗標 | 誰用 | 輸入從哪來 |
| :--- | :--- | :--- | :--- |
| 事件模式 | `--event <EventName>` | Claude hook、Codex hook | JSON payload 從 **stdin** 讀；argv 只有固定字面值 |
| 索引模式 | `--staged` | `scripts/git-hooks/pre-commit` | `git diff --cached` 的 staged 快照 |
| 範圍模式 | `--range <BASE>..<HEAD>` | CI | 兩個 sha 之間的變更 |
| 直接模式 | `--files <path>…` / `--command <string>` | 人工、測試 | argv |
| CI 核對模式 | `--ci` | CI（只有 `check-env.sh` 有） | repo 現況 |

「事件 payload 一律走 stdin、argv 只放固定字面值」是**安全上的核心不變量**：
不受信任的字串永遠不會出現在 argv，也就永遠不會經過任何一層 shell 重新解析
（spec「事件輸入須先驗證且不經由 shell 拼接執行」）。這個不變量也讓 [D16](#d16-codexhooksjson手寫新目錄註冊與-q1-切開) 的
「Codex `command` 欄位是字串還是陣列」這個未知**不影響安全性**。

**退出碼字彙**（全部五支共用）：

| 碼 | 意義 | 哪幾支會用 |
| :--- | :--- | :--- |
| `0` | 通過，或判定為 not applicable | 全部 |
| `1` | 有違規（非阻擋型語境的「不通過」） | `check-changed.sh` 在 `--staged`／`--range`／`--files` 下；`--event`（H3）下同一個違規改以 `exit 0` 加診斷表達（D1 的編碼差異，見 D12） |
| `2` | 阻擋：違規，或**無法判斷** | `check-command.sh`、`check-write-target.sh`、`check-evidence.sh`；`check-changed.sh` 在 `--staged`／`--range`／`--files` 下的**無法判斷** |

**`check-changed.sh` 的「無法判斷」依模式而定。** 同一支檢查器同時服務提醒型（H3）與阻擋型（H4、H7），
所以 spec「阻擋型觸發點（H2、H4、H6、H7）在無法判斷時 MUST 以阻擋的退出碼結束」在這一支上**不能只有一種編碼**：

| 模式 | 觸發點 | 無法判斷時 |
| :--- | :--- | :--- |
| `--event` | H3，提醒型 | `exit 0`，並在 stderr 寫一行 `UNKNOWN:` 指名哪一項沒判成（契約 §H3「一律不以 exit `2` 阻擋」；spec「提醒型觸發點 MUST 在輸出中明寫哪一項沒有判定成功」） |
| `--staged` | H4，阻擋型 | `exit 2` |
| `--range`（含 CI 的 `--list-routes` 斷言） | H7，阻擋型 | `exit 2` |
| `--files` | 人工、測試 | 比照阻擋型，`exit 2`（本 design 的判斷：直接模式沒有自己的觸發點，取較嚴的一邊） |

（`--ci` 不是 `check-changed.sh` 的模式，它只屬於 `check-env.sh`；`check-env.sh` 在 `--ci` 下同樣以非零表達無法判斷，見下方兩段與 D9。）

「無法判斷」的情況與 [D7](#d7-fail-closed兩組阻擋型檢查器的進場守衛以及一條禁止--true-的-ci-lint) 的進場守衛清單相同。
**判定內容在四種模式下完全相同，差的只有編碼**，與 D1 一致。

`check-env.sh` 在 `--event SessionStart` 下**一律 exit `0`**（契約 §H1；spec「H1 不阻擋」），
無法判斷的項目以輸出中的 `UNKNOWN:` 行表達（spec「提醒型觸發點 MUST 在輸出中明寫哪一項沒有判定成功」）。
同一支在 `--ci` 下則以非零表達同一個判定——**判定相同，編碼不同**，與 D1 一致。

**輸出流**：H1 的環境回報走 stdout（契約 §H1）；其餘一律走 stderr（契約 §H2、§H3、§H6）。
每一行以固定前綴開頭：`PASS:`／`FAIL:`／`BLOCK:`／`NA:`／`UNKNOWN:`，使測試與 CI 可機器判讀。

**替代方案（否決）：** 讓檢查器自己讀 hook JSON 而不提供其他模式。
否決理由：Git hook 與 CI 就得偽造一份假 payload，等於把事件格式的細節洩進兩個沒有事件的呼叫者。

### D3 Repo 定位：註冊路徑用來找腳本，被判定的 repo 一律來自 payload 的 `cwd`

**依據：** 契約 §Repo 定位（六種情境表）；spec「事件觸發點以事件提供的工作目錄定位 repo」。

**決策。**

- **Claude 註冊路徑**：`${CLAUDE_PROJECT_DIR}/scripts/<checker>.sh`。
- **Codex 註冊路徑**：`"$(git rev-parse --show-toplevel)"/scripts/<checker>.sh`（Codex 沒有專案根佔位符，契約 §設定位置）。
- **被判定的 repo 不是註冊路徑推出來的**，而是 `git -C "<payload.cwd>" rev-parse --show-toplevel`。
  兩者可能不同（例如 agent 切進另一個 worktree）；**以 payload 的 `cwd` 為準**（契約 §Repo 定位「事件 cwd」）。
  這條在設計上要寫死：腳本自己的 `$PWD`、`${CLAUDE_PROJECT_DIR}` 都**不得**當成判定對象。
- 非事件呼叫者（Git hook、CI、人工）以 `git rev-parse --show-toplevel` 從自己的 `$PWD` 取根，
  與 `scripts/git-hooks/commit-msg` 現行作法相同。
- `cwd` 不存在、或不在任何 work tree 內 → **無法判斷**（阻擋型 exit `2`，提醒型 `UNKNOWN:`）。
- **worktree**：只用 `--show-toplevel`，**不得**用 `--git-common-dir` 去找主 checkout（契約 §Repo 定位）。
- **空白與非 ASCII 路徑**：所有展開加雙引號；檔案清單一律以 **NUL 分隔**傳遞
  （`git … -z`，bash 端 `while IFS= read -r -d ''`）；不得把檔案清單組成一個字串再交給任何命令。
  子工具一律以陣列展開呼叫（`ruff check -- "${files[@]}"`）。

### D4 Payload 解析交給 `node`，不經 `eval`、不賭 GNU 工具

**依據：** spec「事件輸入須先驗證且不經由 shell 拼接執行」；契約 §查核方式第 1 點（本機沒有 `timeout`／`gtimeout`）。

**決策。** `scripts/lib/hook-payload.mjs` 讀 stdin 的 JSON，做三件事後把結果交回 bash：

1. 依事件名稱比對**固定的必要欄位清單**（H1：`cwd`、`hook_event_name`；H2：`tool_name`、`tool_input`、`cwd`；
   H3：`tool_name`、`tool_input`、`cwd`；H6：`stop_hook_active`、`cwd`）。缺欄位或 JSON 無法解析 → 退出碼 `3`。
2. 路徑正規化（`path.resolve` 後解析符號連結），並標出落在 workspace 之外的路徑。
3. 以 **NUL 分隔的 `名稱\x1F值` 記錄**輸出；名稱來自 mjs 內的固定 allowlist，值不經任何展開。
   bash 端以 `read -r -d ''` 收進陣列，**不使用 `eval`、不以 payload 的字串當變數名**。

**為什麼是 `node` 而不是 `jq`：** `node` 是本 repo 既有且 CI 已安裝的相依（`scripts/check-specs.mjs` 等四支都靠它），
`jq` 不在任何相依清單裡。順帶解決路徑正規化：macOS 的 BSD 工具集與 GNU 不同（本機已實測沒有 `timeout`／`gtimeout`），
把正規化交給 `node` 就不必賭任何 GNU coreutils 存在。**「macOS 沒有 `realpath`」是推論不是實測**，
所以設計上直接避開它，而不是去條件判斷。

**代價：** 每次 hook 多一次 node 冷啟動。H2 只有 5 秒預算，這是風險項，見 §Risks。

### D5 時間上限：agent 事件用平台的 `timeout` 欄位；H4、H7 由執行環境承擔

**依據：** 契約 §決策紀錄 2026-11-11（四個 timeout 值）、§查核方式第 1 點；
spec「執行時間與輸出大小有上限且由平台設定控制」。

**決策。** 四個 agent 事件的上限**只寫在註冊設定的 `timeout` 欄位**，兩份設定都要寫，數值一致：

| Hook | 事件 | timeout |
| :--- | :--- | :--- |
| H1 | `SessionStart` | 10 |
| H2 | `PreToolUse` | 5 |
| H3 | `PostToolUse` | 30 |
| H6 | `Stop`／`SubagentStop` | 60 |

**檢查器內部不得出現 shell `timeout`／`gtimeout`**，也不得以 `command -v timeout || true` 之類的寫法繞過
（契約 §查核方式第 1 點已指出那會把「工具不存在」偽裝成通過）。

**H4、H7 沒有平台 timeout。** 這裡契約與 spec 的說法不一致，必須擇一：
契約 §H4 寫「腳本自己設上限」；spec 的 requirement 寫「Git hook 與 CI 的時間上限由各自的執行環境控制」。
**本設計採 spec**（spec 是本 change 已核准的 WHAT，位階高於契約；契約 §邊界 也自陳不是規則來源）：

- H4 不自建 watchdog。開發者可以 Ctrl-C；真正的 gate 在 CI。
- H7 在新增的 CI job 上明寫 `timeout-minutes`，把「執行環境的上限」變成設定裡看得到的數字，而不是 GitHub 的六小時預設。

**替代方案（否決）：** 以背景子程序加輪詢的純 bash watchdog 自建上限。否決理由：要正確地只殺掉自己的子程序樹，
在沒有 `setsid` 的 macOS 上需要額外的 PID 追蹤，複雜度換來的保護在 H4 的語境下接近零（本機 hook 本來就能被 `--no-verify` 跳過）。
**這個取捨要記下**：契約那句「腳本自己設上限」在本 change 不實作，差異已列入 §Open Questions。

**不自建 watchdog 之後，spec「只終止本次觸發所啟動的子程序」怎麼滿足：**
它是一條禁止——檢查器**不得**出現 `pkill`、`killall` 或對 PID 範圍的掃殺；
任何清理只透過 `trap … EXIT` 刪除本次自己建立的暫存目錄。實際的逾時收尾由平台做，平台只殺它自己啟動的那個程序。

### D6 輸出大小上限：每支檢查器單次執行、stdout 與 stderr **各 64 KiB**

**這是本 design 的判斷，沒有任何來源給過數字。** spec 要求「輸出 MUST 有大小上限」但刻意不寫數字；
契約、#111、`AGENTS.md` 也都沒有。把它定在這裡，是因為 `tasks.md` 與測試需要一個可斷言的值。

**數值與理由（皆為本 design 的判斷）：** 64 KiB（65536 bytes）。取這個數量級是因為它一方面足以容納
`check-specs.mjs docs` 這種整樹檢查的完整診斷，另一方面在最壞情況下仍只有約一萬多個 token，
不會把 agent 的脈絡吃掉一大塊。**沒有實測支撐，只是個合理的起點**；真的不夠用時應該調整數字並在契約留紀錄，
而不是把限制拿掉。

**實作方式：** 診斷先寫進 `mktemp` 的暫存檔，判定結束後才 flush：

- flush 時先以 65536 bytes 為界切斷，**再丟棄尾端不完整的多位元組序列**，最後補一行
  `TRUNCATED: output exceeded 65536 bytes (N bytes dropped)`。`N` 是「原長度減去真正輸出的位元組數」，
  所以被丟掉的那個不完整字元也算進 `N`，帳才對得上。
- **截斷標記本身不計入預算**，否則「超過上限」這件事可能被自己截掉。
- **截斷發生在判定確定之後**，退出碼由判定決定，與有沒有截斷無關（spec「輸出被截斷並標示截斷，判定結果與未截斷時相同」）。
- **單獨用 `head -c 65536` 不符合上面第一點，已實測確認**（2026-11-17，macOS `/usr/bin/head`（BSD）；
  紀錄見 `completion-report.md` §1.5）：69000 bytes 的 3-byte UTF-8 中文在 65536 bytes 處被切斷時，
  65536 = 3 × 21845 + 1，尾端只剩 `b'\xe4'` 一個位元組，**整段無法以 UTF-8 解碼**（`unexpected end of data`）；
  純 ASCII 則切得乾淨。契約 §Repo 定位 明寫 `cwd` 由使用者的目錄決定、不得假設是 ASCII，
  所以診斷含多位元組字元是**正常情況，不是邊緣案例**——截斷後的輸出必須仍可解碼
  （spec「截斷後的輸出仍是完整可解碼的文字」）。
- **丟棄尾端不完整序列的手段留給 task 2.3 選**，兩種都可接受，判準是 task 2.3 的斷言：
  交給 `node`（D4、D7 已把它列為必要工具，不新增相依），或在 shell 內修剪尾端的
  UTF-8 續接位元組與其不完整的首位元組（最多 3 bytes）。**不得**改用「先按字元數截斷」來迴避，
  那會把上限從位元組預算變成字元預算，與本決策的數值語意不同。
- **GNU 側尚未實測。** `head -c` 在 BSD 與 GNU 都有，Linux 那一半要在 CI 上驗（task 1.5 的未完成部分）；
  兩邊若行為不同，以「輸出必須可解碼」這個結果為準，不以某一邊的實作行為為準。

### D7 fail-closed：兩組阻擋型檢查器的進場守衛，以及一條禁止 `|| true` 的 CI lint

**依據：** 契約 §H2「缺工具／無適用檔案」、§能力缺口與承接第 5 條（兩平台預設 fail-open，
`onFailure: "block"` 需 Claude Code 2.1.295，本機 2.1.273 沒有）；spec「無法判斷不得回報為通過」。

**決策。** 兩組檢查器在做任何判定**之前**依序守衛，任一步不成立就 `exit 2` 並在 stderr 說明：

- **一律守衛**：`check-command.sh`（H2）、`check-write-target.sh`（H2）、`check-evidence.sh`（H6）。
- **依模式守衛**：`check-changed.sh` 在 `--staged`（H4）、`--range`／`--list-routes`（H7）、`--files` 下同樣 `exit 2`；
  只有 `--event`（H3，提醒型）例外——守衛不成立時它 `exit 0` 並印 `UNKNOWN:` 行（D2 的模式表）。
  **這一條是 H4 與 H7 的 fail-closed 落點**：spec 把 H4、H7 列為阻擋型，而它們呼叫的就是這一支。

守衛順序：

1. `set -uo pipefail`，外加 `trap` 把**任何未預期的結束**轉成 `exit 2` 並印出一行 `BLOCK: checker aborted unexpectedly`。
   （不用 `set -e`：要的是「意外一律變成擋」，不是「意外就靜悄悄離開」。）
2. `command -v node` 不存在 → `exit 2`。
3. `scripts/lib/hook-payload.mjs`、`scripts/lib/hook-common.sh` 不存在或不可讀 → `exit 2`。
4. payload 解析回報 `3`（malformed／缺欄位） → `exit 2`。
5. repo 定位失敗（D3） → `exit 2`。

**明文禁止：** 這五支檢查器的判定路徑上不得出現 `|| true`、`|| exit 0`、`|| :`。
**執行方式（本 design 的判斷，無來源）：** CI 的新 job 加一個 grep 步驟，在
`scripts/check-*.sh`、`scripts/lib/*.sh`、`scripts/git-hooks/*` 裡搜到 `|| true`、`|| exit 0`
或**命令位置**的 `timeout`／`gtimeout` 就讓 job 失敗。**樣式必須綁在命令位置**
（例如 `(^|[;&|(]\s*)(timeout|gtimeout)[[:space:]]`），否則會命中「上限由平台的 `timeout` 欄位控制」
這類合法的英文註解；`--fix`、`--write`、`git add` 同理（D12）。這把一條只靠人記得的禁止變成會紅的檢查。

**「檢查器不存在就 exit 2」的無限回歸，與為什麼不做包裝腳本。**
契約 §H2 寫「包裝腳本一律先確認檢查器存在且可執行」。本設計**不另建包裝腳本**，
註冊設定直接指向檢查器本身。理由：包裝腳本只是把「哪個檔必須存在」往前移一格——
包裝腳本自己不見時，同樣沒有任何我們的程式會跑，平台同樣 fail-open。兩種做法的失效面一模一樣，
一個檔比兩個檔簡單，而且讓 H1 的設定核對變成單純的「路徑存在且可執行」。
**註冊目標本身不見**這個情境改由兩道檢查承接：H1 的設定核對（會在 session 開始時說出來）
與 CI 的設定核對（會讓 PR 變紅）。**這是對契約措辭的刻意偏離，理由如上，已列入交付回報。**

### D8 遮蔽在單一出口做，不在各呼叫點做

**依據：** spec「攔截原因與診斷不得回顯 secret 值」、「本機診斷紀錄只保留脫敏 metadata」；#111 §3 第 3 項。

**決策。** `scripts/lib/hook-common.sh` 提供唯一的輸出函式（`emit_out`／`emit_err`），
所有診斷都必須經過它；遮蔽與截斷（D6）都在這個唯一出口做，任何呼叫點都沒有機會忘記。

遮蔽規則（本 design 的判斷，`AGENTS.md` 與契約只要求「要遮蔽」，沒有給樣式）：

- `(?i)(token|secret|password|passwd|api[-_]?key|authorization|bearer)\s*[=: ]\s*\S+` → 鍵名保留，值換成 `***`
- 常見前綴（`ghp_`、`github_pat_`、`sk-`、`xox[baprs]-`）後接的字串 → `***`
- 連續 20 字元以上的 base64／hex 串 → `***`。**這個連續串不跨 `/`**（維護者 2026-11-18 裁定）：
  原本的樣式含 `/`，使得任何夠長的絕對路徑都被打成 `***`，而檢查器的訊息本來就要指名是哪個檔
  （spec「受保護路徑的寫入被拒絕」、「一邊的設定漏改」都要求指名）。代價是每一段都短於 20 字元的
  base64 會漏掉，這比完全指不出路徑窄得多。

另外兩條結構性保證，比樣式比對可靠：

- **H2 的攔截原因只輸出「命中哪一條規則」與經過遮蔽的命令片段**，不輸出完整 argv。
- **任何檢查器都不讀 secret 類檔案的內容**（契約 §H1「不讀 `.env` 的值」；spec「環境檢查不讀取 secret 檔案的內容」）。
  H1 只用 `test -e`；H2 只看路徑，不看內容。

### D9 `check-env.sh`（H1）：環境回報、兩份設定核對、hook 是否真的會跑

**依據：** 契約 §H1、§能力缺口與承接第 1、7 條；spec 的五條 H1 requirement。

**決策。** 輸出分四段，全走 stdout，**一律 exit `0`**（以 `trap` 強制，即使內部出錯也不改退出碼）：

**（一）Git 與規則入口**：`core.hooksPath` 是否為 `scripts/git-hooks`；`AGENTS.md` 是否存在。
缺的時候印出補法（`scripts/setup.sh`）。

**（二）工具版本**：`node`、`pnpm` 必查；`uv` 在 `backend/` 不存在時標 `NA:`
（契約 §H1「缺工具／無適用檔案」；spec「尚未建立的層標為 not applicable 而不是失敗」）。

**（三）兩份註冊設定的核對**（契約 §能力缺口第 7 條的承接，也是兩份手寫設定**唯一**的防漂移機制）：

- 以 `node` 讀 `.claude/settings.json` 與 `.codex/hooks.json`，取出每個 handler 的 `command`（與 `args`）。
- **以字面取代解析佔位符**：`${CLAUDE_PROJECT_DIR}` 與 `$(git rev-parse --show-toplevel)` 這兩個已知 token
  直接換成 repo 根。**不執行任何 shell 去展開**。
- 出現其他 `$VAR` 或 `$( … )` → 標 `UNKNOWN:`「無法靜態核對」，**不算通過**。
- 對每個解析出的路徑檢查存在與可執行位，缺的時候**指名是哪一份設定、哪一個事件**（spec「一邊的設定漏改」）。
- 兩邊都齊 → 印一行 `PASS:` 說兩份設定一致（spec「兩份設定一致」要求有這個肯定輸出）。

**（四）本次 hook 是不是真的會跑**（spec「Session 開始時回報本次 hook 是否真的會執行」）：

- **Claude 側**：讀專案層、使用者層與 local 設定的 `disableAllHooks`。
  讀不到組織層 managed policy → 明寫這一項查不到，標 `UNKNOWN:`，不假裝查過。
- **Codex 側 `[features] hooks`**：讀 `.codex/config.toml` 與 `~/.codex/config.toml`，被關掉就明寫本次 hook 不會執行。
- **Codex 的信任狀態**：沒有已知的非互動查詢方式，所以用兩個可得的事實推：
  1. **H1 是被 Codex 叫起來的這件事本身，就證明這支已被信任**（平台偵測來自 payload／環境）；
     被 Claude 叫起來時，H1 不替 Codex 的信任狀態作保，標 `UNKNOWN:` 並寫出 `/hooks` 的作法。
  2. **hook 定義的摘要比對**：把兩份註冊設定的 sha256 存在
     `"$(git rev-parse --git-dir)"/label-suite/hook-defs.sha256`，與上次成功執行時的值比對；
     不同就印「hook 定義已變更，Codex 側在重新信任前會被跳過」加重新信任的方式。
     信任綁 hash（契約 §查核方式第 3 點），所以摘要變了就是全員被跳過，這是可以算出來的。

**替代方案（否決）：** 逆向 `codex` binary 或讀它的內部狀態檔推信任。
否決理由：契約 §查核方式第 2 點已經記過一次教訓——逆向讀 binary 不能當依據。

### D10 `check-command.sh`（H2 命令那組）：先切詞再判，判不出來就擋

**依據：** 契約 §H2、§能力缺口與承接第 2 條；spec 的四條命令類 requirement。

**決策。** 判定流程（純字串分析，**絕不執行**被檢查的命令）：

1. **切段**：在**引號之外**的 `;`、`&&`、`||`、`|`、換行處切開。引號內的同樣字元不是分隔符
   ——這是「commit 訊息中提到 `rm -rf` 不該被誤判」（spec 的 scenario）能成立的機制。
2. **切詞**：每段用一個理解單引號、雙引號與反斜線的小型 tokenizer 取出 argv；
   前導的 `VAR=value` 環境指派略過；`<<` 之後的 heredoc 內文整段略過（`git commit -F -` 的情形）。
3. **比對規則**（對應 `AGENTS.md` Hard Rules 2、3、10）：

   來源欄標示每一列的依據：**源**＝`AGENTS.md` 硬性規則與 spec 條文的字面；**本 design 判斷**＝超出字面、由本設計納入的寫法。

   | 規則 | 命中條件 | 依據 |
   | :--- | :--- | :--- |
   | HR10 | `rm -rf` | 源（HR10；spec「破壞性命令在執行前被拒絕」） |
   | HR10 | 同一個 `rm` 的其他寫法：`-fr`、`-r` 與 `-f` 分開寫、`--recursive --force` | **本 design 判斷**（同一個動作的等價寫法） |
   | HR10 | `git … reset --hard` | 源 |
   | HR10 | `git … push --force` | 源 |
   | HR10 | `git … push` 帶 `-f`／`--force-with-lease`，或 refspec 以 `+` 開頭 | **本 design 判斷**（`-f` 是 `--force` 的短旗標；`--force-with-lease` 與 `+` refspec 是**另外的命令寫法**，不是 `--force` 的別名，納入是為了涵蓋同樣會改寫遠端歷史的動作） |
   | HR10 | `git … branch -D` | 源 |
   | HR10 | `git … branch` 的 `-d` 加 `--force` | **本 design 判斷**（等價寫法） |
   | HR2 | `git … commit` 且目標 checkout 的現行分支是 `main` | 源（HR2；spec「提交與推送到 main 的目標被拒絕」） |
   | HR2 | `git … push` 的 refspec 目的端是 `main`／`refs/heads/main`；或無 refspec 而上游是 `main` | 源（spec 的三個 scenario） |
   | HR3 | `pip install`、`npm install` | 源（HR3；spec「不符本 repo 套件管理方式的安裝命令被拒絕」） |
   | HR3 | `pip3 install`、`npm i`、`npm add` | **本 design 判斷**（同一個動作的明顯寫法；`AGENTS.md` 與 spec 都只點名 `pip install`／`npm install`） |

   `uv add`、`pnpm add` 明確放行（spec「H2 放行 pnpm add」）。
   **標為「本 design 判斷」的列，`tasks.md` 的測試矩陣要指回 D10，不得當成 spec 條文的要求。**

4. **目標 checkout 的解析**：`git -C <path>`、`--git-dir`、`--work-tree` 都要納入，
   分支以 `git -C <解析出的路徑> symbolic-ref --short HEAD` 取得（spec「H2 擋下指定其他工作目錄的提交」）。
5. **判不出來就擋**（範圍刻意收窄，否則會把日常命令全擋掉）。只有這三類算「無法判斷」：
   引號不成對；`eval`／`sh -c`／`bash -c` 的參數不是字面字串；命令位置本身是 `$( … )` 或反引號。
   **操作數裡的命令替換不算**（`echo "$(date)"` 照常放行）。
   **這條界線是本 design 的判斷**：契約只說「擋明顯的情況」，沒有定義「明顯」的邊界。
6. **每一則攔截訊息都附一句邊界說明**（spec「攔截訊息說明邊界」）：字串比對涵蓋不了變數展開、
   編碼後的命令與動態組出來的命令，真正的保護在平台權限層與 branch protection。
7. **拒絕是無條件的，檢查器不試圖判別「維護者已確認」**（**維護者 2026-11-17 裁定**，原 §Open Questions Q5，
   已結案；行為與原本的設計相同，變的是把理由寫定）。`AGENTS.md` 硬性規則 10 仍然寫著這四個命令
   「need the maintainer's explicit confirmation first」——**規則本身不變**，本決策只講明 hook 在其中的角色：
   **確認過的那條路走 hook 之外**（維護者自己在終端機執行，或暫時停用 hook），不經過 H2。
   本設計**不引入任何 in-band 的「已確認」訊號**——送得出那個訊號的 agent 就能自我授權，
   正是 spec「MUST NOT 自行推定維護者已確認」要防的事。因此比對一命中就擋，沒有例外分支，
   `tasks.md` 的測試矩陣也不需要「已確認」這一組輸入（spec「破壞性命令在執行前被拒絕」的第四個 scenario
   斷言的就是這件事）。

### D11 `check-write-target.sh`（H2 寫檔那組）：只看路徑，例外先於拒絕

**依據：** 契約 §H2「適用路徑／角色」、§決策紀錄 2026-11-11（不用 hook 擋 PRD）；spec「受保護路徑的寫入被拒絕且合法例外放行」。

**決策。** 判定順序固定為：取出路徑 → 正規化 → workspace 範圍 → 合法例外 → 拒絕清單。

- **拒絕清單**（照 spec 一字不差，不自行加項）：`**/.env`、`**/.env.*`、`*.pem`、`*.key`、`*id_rsa*`、`*credentials.json`。
  **第六個樣式 `**/.env` 由維護者 2026-11-17 裁定加入**（原 §Open Questions Q3，已結案）：以 git 自身的樣式比對實測，
  `**/.env.*` 命中 `.env.local` 與 `config/.env.local`，**不**命中裸檔名 `.env` 與 `config/.env`；
  兩個樣式並列之後，有後綴與裸檔名在任何層級都被涵蓋。這是**加一個樣式，不是放寬**。
- **合法例外，先於拒絕判斷**：`*.example`（含 `.env.example`）、`*.pub`、`scripts/tests/fixtures/**` 底下的假憑證。
  **新增 `**/.env` 不收窄這些例外**：例外仍然先於拒絕清單判斷，`.env.example` 等三類照常放行
  （spec 的三個放行 scenario 與新增的裸檔名 scenario 一起驗這件事）。
- **`docs/specs/00-prd.mdx` 不在清單上**，H2 完全不介入（spec「H2 不擋 PRD」）。
- **缺路徑欄位的處理依工具名分成兩種，不是同一條規則**（**維護者 2026-11-17 裁定**；
  task 1.4 的查核結果見 `completion-report.md` §1.4）。原本的設計是「在 `tool_input` 裡找不到任何
  可辨識的路徑欄位 → `exit 2`（無法判斷）」，查核後**那條規則對 Codex 不成立**：
  官方文件（`https://learn.chatgpt.com/docs/hooks`，查核日 2026-11-17）記載 `apply_patch` 與 `Bash`
  **共用同一個輸入結構 `tool_input.command`**，該頁沒有記載該欄位的內部結構，也沒有任何獨立的路徑欄位。
  所以「找不到路徑欄位」在 Codex 上是**文件已記載的常態**，照原規則會讓**每一次 `apply_patch` 都被擋**。
  規則因此改成：

  | 事件的工具名 | `tool_input` 有路徑欄位 | 缺路徑欄位時 |
  | :--- | :--- | :--- |
  | Claude `Edit`／`Write`（`file_path`）、`NotebookEdit`（`notebook_path`） | 有（文件記載） | **`exit 2`（無法判斷）**——欄位本該在卻不在，是真的異常 |
  | Codex `apply_patch` | **沒有**（文件記載只有 `tool_input.command`） | **不觸發 `exit 2`**：輸出一行 `NA:` 指出 hook 層在這條途徑沒有寫檔目標保護、承接者是平台權限層、而權限層本次未設定（D19），然後 `exit 0` |
  | 其他未列出的工具名 | 未知 | **`exit 2`**——未知的工具名仍是異常，不比照 Codex 的已記載缺口 |

  **這是承認缺口，不是放寬規則**：比照契約 §能力缺口第 3 條對「讀取」的處理方式，
  hook 層接不住就明寫缺口並指名承接層（spec「寫檔攔截不得被宣稱已覆蓋所有寫入途徑」的兩個 scenario 驗這件事）。
  **三條出路中沒有選解析 `tool_input.command`**（`completion-report.md` §1.4 的出路 1）：
  那個封包格式官方未文件化，照它實作等於把保護建在一個隨時會變的未記載格式上，
  而猜錯的後果是「以為擋住了」——比明寫沒擋更糟。
- **為什麼不乾脆把 `apply_patch` 從寫檔那組的 matcher 移掉**（本 design 的判斷，非裁定內容）：
  留著註冊，是因為「文件已記載的缺口」與「異常」要**在同一支檢查器裡以工具名分流**才驗得出來
  （上表第一列與第二列的斷言在 task 3.3 是一組對照）；移掉 matcher 之後，
  寫檔路徑上就沒有任何地方能把這兩者分開，而那正是本次裁定要求「缺口可被斷言而不只是被描述」的地方。
  代價是每次 `apply_patch` 多付一次檢查器冷啟動，輸出只有一行、受 D6 的預算約束。
  D16 的對應表維持原樣，task 6.2 不受影響。
- **workspace 之外的寫入目標 → `exit 2`。** spec 寫「超出範圍的路徑 MUST 被視為不適用而非被檢查或被寫入」，
  對一個阻擋型觸發點來說，「不適用」與「不被寫入」只有擋下來才同時成立。
  相對地在 H3（純診斷）那邊，workspace 之外的路徑是**略過並註明原因**。
  **這兩個觸發點採不同處理，已由維護者 2026-11-17 裁定維持**（原 §Open Questions Q4，已結案；**行為不變**）。
  裁定的理由值得寫下來，省得下一位讀者重開這題：workspace 之外的寫入**正是檢查器判斷不了的情形**，
  spec「無法判斷不得回報為通過」因此適用，H2 必須以 `exit 2` 擋；而 H3 是 `PostToolUse`，
  兩個平台在那裡都撤銷不了已發生的編輯，阻擋得不到任何效果，所以只略過並說明。
  `tasks.md` 3.3／3.4 的斷言照舊，不需要改。
- **不得宣稱已涵蓋所有寫入途徑**（spec「寫檔攔截不得被宣稱已覆蓋所有寫入途徑」）：
  以 shell 改檔走的是 D10 那組；Codex 沒有讀取類工具名，hook 層沒有讀取攔截點（契約 §工具名稱、§能力缺口第 3 條）；
  **Codex 的 `apply_patch` 沒有寫入路徑欄位，hook 層在那條途徑也沒有寫檔目標保護**（上一點，維護者 2026-11-17 裁定）。
  這三句要同時出現在 H1 的輸出、攔截訊息與契約回填的文字裡；
  讀取與寫入是**同一種**缺口的兩條，契約 §能力缺口 因此要列成兩條（task 7.2）。

### D12 `check-changed.sh`（H3／H4／H7 同一支）：路由表、排除清單、啟用語意

**依據：** 契約 §H3「適用路徑／角色」、§H4、§H7；spec 的四條 H3 requirement 與 H4、H7 requirement。

**決策。** 一支檢查器，四種檔案清單來源（D2 的輸入模式），**路由與判定完全相同**。

**副檔名路由表**（spec 刻意沒寫，契約 §H3 有）：

| 命中條件 | 執行的檢查 | 粒度 | 啟用條件 |
| :--- | :--- | :--- | :--- |
| `*.py` | `ruff check`、`mypy` | 逐檔 | `backend/` 存在 |
| `*.ts`、`*.tsx` | `tsc --noEmit`、`eslint` | `tsc` 整專案；`eslint` 逐檔 | `frontend/` 存在 |
| `docs/**/*.mdx`、`docs/**/*.md` | `node scripts/check-specs.mjs docs` | 整棵 `docs/` | 一律啟用（檢查器已存在） |
| 其他 | 無 | — | 標 `NA:` |

`.md` 自 [PR #395](https://github.com/label-suite/label-suite/pull/395) 起才在 `check-specs.mjs` 範圍內（契約 §H3），所以兩種副檔名都要收。

**排除清單**（路由前先濾掉，比對 repo 相對路徑）：

- `frontend/src/api/generated/**`
- Alembic migration（`backend/` 尚不存在，實際路徑樣式待 backend bootstrap 時確認，先以 `backend/**/alembic/versions/**` 佔位並在 `tasks.md` 標為待確認）
- `pnpm-lock.yaml`、`uv.lock`
- `**/vendor/**`、`**/node_modules/**`
- 本次已被刪除或改名、現在不存在的路徑（spec「H3 面對被刪除的檔案」）
- workspace 之外的路徑，略過並印出排除原因（spec「路徑指向 workspace 之外」）

**整專案粒度的檢查怎麼報。** `tsc --noEmit` 與 `check-specs.mjs docs` 都是整棵樹跑，
診斷可能包含本次沒動到的檔案。**決策：原樣輸出，不過濾**，另在前面加一行說明是哪幾個被改的檔觸發了這次檢查。
過濾等於觸發層改寫判定，違反 D1 與 spec 第一條 requirement。

**「啟用」的定義：層的目錄存在即為已宣告啟用。** 於是：

- `backend/` 不存在 + 改到 `.py` → `NA:`，不是失敗（spec「後端尚未 bootstrap」）。
- `backend/` 存在 + `ruff` 不存在 → **明確失敗**，指名缺什麼（spec「已啟用的檢查缺工具」）。
- 完全沒命中任何路由 → `NA:` 加 `exit 0`（spec「H3 沒有命中檔案」）。

**CI 不得用 not applicable 跳過已啟用的檢查**（spec）。做法：CI 先跑 `check-changed.sh --list-routes`，
斷言啟用中的路由集合與預期相同，再跑實際檢查。這樣「某個層的目錄被改名導致路由悄悄變成 NA」會讓 job 失敗，
而不是靜悄悄少跑一項。**這個斷言機制是本 design 的判斷**，spec 只規定了結果。

**H3 的收尾**：`check-changed.sh` 回 `1` 時，H3 仍以 `exit 0` 結束，診斷原樣留在 stderr
（契約 §H3；spec「編輯後依路徑回報診斷但不阻擋」）。**不使用 `updatedToolOutput`／`decision: "block"`
去替換 model 看到的結果**——契約 §H3 明文說刻意不用那個替換，因為會讓失敗變得不明顯。

**H3 不得改動工作區**（spec「編輯後檢查不改動工作區」）：所有子工具一律以檢查模式呼叫
（`ruff check` 而非 `ruff format`，`eslint` 不加 `--fix`），且不得呼叫 `git add`。
這條同樣列進 D7 的 CI lint（搜 `--fix`、`--write`、`git add`，**比對綁在參數／命令位置**，見 D7）。

### D13 `scripts/git-hooks/pre-commit`（H4）：以 `git checkout-index` 物化索引，不碰工作區

**依據：** 契約 §H4「必須讀 staged 版本（`git show :<path>`），不能拿工作區的檔案充數」；spec「提交前以 staged 快照判定」。

**決策。** hook 本身維持與 `commit-msg` 同形狀的三行：`cd "$(git rev-parse --show-toplevel)"`，
然後 `exec scripts/check-changed.sh --staged`。判定全在檢查器裡。

`--staged` 模式取得內容的方式：

- 檔案清單：`git diff --cached --name-only --diff-filter=ACMR -z`
  （`-z` 處理空白與中文檔名；`--diff-filter` 排掉刪除，與 D12「只涵蓋仍存在的檔案」一致）。
- **逐檔**的檢查：`git show :"<path>"` 寫進 `mktemp -d` 下、保持 repo 相對結構的鏡像目錄。
- **整樹**的檢查（`check-specs.mjs docs`、`tsc`）：用 `git checkout-index -a --prefix="$TMP/"`
  把整個索引物化到同一個暫存目錄，再對 `"$TMP/docs"` 跑。這樣整樹檢查看到的也是 staged 內容，
  「工作區修好但沒 stage」才會如 spec 要求地被擋下。
- `trap … EXIT` 刪暫存目錄；**不得使用 `git stash`** ——它會動到工作區，正是 spec「H3／H4 不改動工作區」要防的事。
- 在子目錄執行時，因為第一行就 `cd` 到 toplevel，判定涵蓋整份 staged 清單（spec「H4 在子目錄執行」）。

### D14 `check-evidence.sh`（H6）：證據是檢查實際跑過的副產物，存在 `.git` 裡

**依據：** 契約 §H6；[T11](../../../docs/development/testing-agent-rules.mdx) 的五個欄位；spec 的三條 H6 requirement。

**決策。**

**第一步永遠是防重入**：payload 的 `stop_hook_active` 為 `true` → 立刻 `exit 0`
（契約 §H6「不要自己另造標記檔」；spec「證據核對的重複觸發須收斂」）。

**證據從哪來：`check-changed.sh` 每完成一次執行就寫一筆紀錄**，不論通過與否。
證據因此是「檢查真的跑過」的副產物，而不是 agent 可以自己宣稱的東西。

**存放位置：`"$(git rev-parse --git-dir)"/label-suite/evidence/`。**
選在 `.git` 底下而不是工作區加 `.gitignore`，理由有三：天生不進版控（spec「診斷紀錄不進版控」），
不必新增 ignore 規則也不可能被誤 commit；`--git-dir` 在 worktree 回傳該 worktree 自己的目錄，
所以證據不會跨 worktree 串用；重新 clone 就沒有舊證據，這正是想要的。

**每筆紀錄的欄位**（對齊 T11 的五欄，全部是 metadata）：
跑了什麼命令（**只記檢查器自己發動的固定命令，不記 agent 傳來的任何字串**）、
在哪個 commit 上跑加工具版本、退出碼、實際涵蓋的路徑清單、被跳過或標 NA 的項目與原因。
外加三個摘要供新鮮度比對：`HEAD` sha、**涵蓋路徑的內容摘要**、`AGENTS.md` 的 sha256（代表規則版本）。
紀錄經過 D8 的同一個出口寫出，所以同樣被遮蔽。

**新鮮度（spec「只重用與目前狀態一致的證據」）**：三個摘要任一對不上 → 當成沒有這筆證據。
檔案在證據產生後又被改，內容摘要就變，於是結束被擋下（spec 的 scenario）。

**H6 要求什麼**：對「自 `HEAD` 以來有變更、且命中某個已啟用路由」的每個檔案，
都要有一筆涵蓋它且通過的新鮮證據。沒有 → `exit 2`，stderr **指名缺哪一項**。
`backend/`、`frontend/` 不存在 → 那些項標 `NA:`，不因此擋下（spec「H6 在 frontend 尚未存在時」）。

**不新增第三個停點**（契約 §H6；T12）：回饋全部回到 agent，不等任何人輸入。

**留存上限**（本 design 的判斷，無來源）：該目錄保留最新 200 筆或 1 MiB，先到者為準，由舊到新裁掉。

### D15 `.claude/settings.json`：只新增 `hooks` 鍵

**依據：** 契約 §設定位置；proposal §Impact。

**決策。** 現檔只有 `$schema` 與 `attribution.sessionUrl`（2026-11-17 實測）。
本 change **只新增 `hooks` 鍵**，`$schema` 與 `attribution` 原封不動——`CLAUDE.md` §Attribution 靠它。

註冊五個 handler：

| 事件 | matcher | command | timeout |
| :--- | :--- | :--- | :--- |
| `SessionStart` | `startup\|resume\|clear\|compact\|fork` | `${CLAUDE_PROJECT_DIR}/scripts/check-env.sh --event SessionStart` | 10 |
| `PreToolUse` | `Bash` | `…/check-command.sh --event PreToolUse` | 5 |
| `PreToolUse` | `Edit\|Write\|NotebookEdit` | `…/check-write-target.sh --event PreToolUse` | 5 |
| `PostToolUse` | `Edit\|Write\|NotebookEdit` | `…/check-changed.sh --event PostToolUse` | 30 |
| `Stop`、`SubagentStop` | （無） | `…/check-evidence.sh --event Stop`／`--event SubagentStop` | 60 |

三件要照辦的事：

- **不寫 `onFailure: "block"`。** 它需要 2.1.295，本機 2.1.273（契約 §查核方式第 4 點）。
  fail-closed 由 D7 的腳本守衛做。升級到 2.1.295 之後可以改用，屆時把版本下限記進契約。
- **matcher 是未定錨的 JavaScript regex**（契約 §工具名稱），所以 `Bash` 會命中 `Bash` 也會命中含 `Bash` 的工具名；
  本設計接受這個較寬的命中（寬只會多檢查，不會漏）。
- **`MultiEdit` 不寫進 matcher。** 契約明說它是否仍是有效工具名「本次沒有確認」，
  照抄一個不確定的名字只會得到誤以為有效的設定。要納入前先用 `/hooks` 與真實事件對過。

### D16 `.codex/hooks.json`：手寫、新目錄、註冊與 Q1 切開

**依據：** 契約 §設定位置、§工具名稱、§能力缺口第 7 條；proposal §待決問題 Q1（原 Q2）。

**決策。** 新建 `.codex/` 目錄，**只放 `hooks.json` 一個檔**。

**這件事與 Q1 無關，可以現在做。** `hooks.json` 是 hook 註冊；Q1 要決定的是 permission profile 還是舊的
sandbox 設定，那會寫在 `config.toml`。兩者是不同檔、不同機制。
**所以本設計不碰 `.codex/config.toml`，也不假定它會長成哪一種形狀**（spec「平台權限層的能力以核對過的事實陳述」）。
Q1 無論答什麼，`hooks.json` 都不用改。

對應關係（事件名稱兩邊相同，matcher 與工具名不同——契約 §工具名稱）：

| 事件 | Codex matcher | 與 Claude 的差別 |
| :--- | :--- | :--- |
| `SessionStart` | 同 Claude 的五種 | 無 |
| `PreToolUse` | `Bash` | 無 |
| `PreToolUse`（寫檔） | `apply_patch` | Claude 是 `Edit\|Write\|NotebookEdit` |
| `PostToolUse` | `apply_patch` | 同上 |
| `Stop` | **不吃 matcher**，要自己從 payload 判 | Claude 可用 matcher |
| `SubagentStop` | 吃 subagent type | 同 |

兩邊 `command` 指向**同一批腳本**，timeout 數值與 D5 的表相同。

**`command` 欄位的 wire 形狀（字串或陣列）契約沒有記錄，實作前必須核對官方文件**，
並把結果補進契約（列入 `tasks.md`）。不過這個未知**不影響安全性**：依 D2 的不變量，
argv 只有固定字面值，payload 走 stdin，所以兩種形狀都不會把不受信任的字串交給 shell。

**不做生成器**（契約 §決策紀錄 2026-11-11；spec「系統 MUST NOT 以生成器產生其中任一份」）。
一致性由 D9 的 H1 核對加 D17 的 CI 核對承接。

### D17 CI（H7）：新增一個 job，用同一組檢查器

**依據：** 契約 §H7；spec「CI 重跑必要檢查並作為合併前的 gate」、「安裝流程可重複執行且不靜默覆寫既有設定」。

**決策。** `.github/workflows/ci.yml` 新增一個 job（既有三個 job 不動），明寫 `timeout-minutes`（D5），步驟：

1. 五支檢查器的回歸測試（形狀沿用既有的 `scripts/tests/check-commit-msg-tests.sh` 與 `node --test`）。
2. `scripts/check-env.sh --ci` ——核對兩份註冊設定指向的腳本都存在且可執行；缺就非零。
   （H1 的 exit `0` 規定只約束 `SessionStart` 這個觸發點；CI 是 H7，不同觸發點、不同編碼，見 D1、D2。）
3. `scripts/check-changed.sh --list-routes` 的路由斷言（D12）。
4. `scripts/check-changed.sh --range "$BASE..$HEAD"`，判定不通過即 job 失敗。
   檔案清單用 `git diff --name-only --diff-filter=ACMR -z "$BASE" "$HEAD"`，
   `BASE`／`HEAD` 沿用 `commit-messages` job 已在用的 `github.event.pull_request.base.sha`／`head.sha`。
5. D7 的禁止 lint（`|| true`、`|| exit 0`、shell `timeout`、`--fix`／`git add`）。

**H5 的 `commit-messages` job 不動**（契約 §H5）。
**branch protection 的啟用不在本 change**（契約 §H7：那是維護者的設定權限）——
所以本 change 交付後，CI job 會紅但技術上還擋不住合併，這件事要寫進完成報告，不得宣稱 gate 已完整。

### D18 `setup.sh` 的職責：三件安裝流程本體的事，加一段 Codex 信任指引

**依據：** spec「安裝流程可重複執行且不靜默覆寫既有設定」（含其「安裝流程輸出 Codex 的 hook 信任指引」scenario）；
**維護者 2026-11-17 裁定**（契約 §待決第 1 題的答案：要寫進 `scripts/setup.sh`；原 §Open Questions Q1，已結案）。

**決策。** `scripts/setup.sh` 本次加四件事。前三件是安裝流程本體：

1. **冪等**：設 `core.hooksPath` 前先讀現值；已是 `scripts/git-hooks` 就印一行「已啟用」不重設（spec「重複執行安裝」）。
2. **衝突偵測**：現值是別的路徑、或使用者層／全域有相衝的設定 → **回報衝突與處理方式，不覆寫**（spec「既有自訂設定衝突」）。
3. **停用與復原**：印出停用方式（`git config --unset core.hooksPath`、Claude 的 `disableAllHooks`、
   Codex 的 `[features] hooks = false`）與復原方式，同時寫明**停用本機 hook 不會讓 CI 的必要檢查失效**（spec「停用本機 hook」）。

第四件由維護者 2026-11-17 裁定加入：

4. **Codex hook 信任指引**：輸出一段說明——Codex 使用者必須信任本 repo 的 hook（`/hooks`），
   否則 hook 會被**靜默**跳過——並寫出重新信任的方式（spec「安裝流程輸出 Codex 的 hook 信任指引」）。

**為什麼值得印這一段：** Codex 的信任綁 hook 定義的 hash，所以**每改一次 hook，所有 Codex 開發者那邊都會重新變成未信任而被跳過**，
而版控裡的檔案看起來完全正常（契約 §能力缺口第 1 條）。沒有這段輸出，用 Codex 的人會以為 hook 正在跑。
H1 的摘要比對（D9 第四段）只在 session 開始時說得出這件事；安裝當下就先講一次，才不會有人從頭到尾沒聽過。

**實作位置不變：** 這段輸出仍然是**一個只被呼叫一次的函式**（當初這樣切是為了讓兩種答案都只動一處），
現在內容已確定，函式與呼叫點都保留。`tasks.md` 仍把它列成獨立的 task（task 4.4），
好讓它的驗證與前三件分開，而不是混進同一個 task。

### D19 平台權限層不在本 change 設定，只負責把歸屬講清楚

**依據：** 契約 §邊界「hook 不等於權限控制」、§能力缺口第 3、6 條；
spec「平台權限層與 hook 攔截分開陳述」、「平台權限層的能力以核對過的事實陳述」；proposal §前置查核。

**決策。** 本 change **不寫任何權限層設定**——不加 Claude 的 `permissions.deny`，也不碰 Codex 的 `config.toml`。

理由（三點，第一點是本 design 的判斷）：

1. Claude 側技術上**不被 Q1（原 Q2）擋住**（`permissions.deny` 可用，`deny` 立即生效不等工作區信任，2026-11-17 查核），
   但加上它會改變**每一位 Claude 開發者**讀檔的預設行為，與 Q1 同屬維護者的選擇，
   而 proposal §Impact 的「修改檔案」欄只列了 `.claude/settings.json` 的 `hooks` 鍵。
   在沒有核准的情況下擴張，等於替維護者作決定。
2. 文件寫到的鍵不等於本機可用：`blockWritesOutsideWorkingDirectories` 需 2.1.314、
   `denyInsteadOfPrompting` 需 2.1.319，**兩者的版本下限都高於本機的 2.1.273，所以現在用不了**
   （只有 `blockReadsOutsideWorkingDirectories` 需 2.1.257，本機已達）。
3. spec 要求的是**把歸屬講清楚**，不是把它設好。

**於是本 change 要落實的是陳述的正確性**，三處都要一致：

- H1 的輸出：Codex 的 hook 層沒有讀取攔截點（沒有 `Read`／`Grep`／`Glob` 工具名），**也沒有寫檔目標保護**
  （`apply_patch` 沒有路徑欄位，D11，維護者 2026-11-17 裁定），兩項都由權限層承接，**而權限層尚未設定**。
- H2 的攔截訊息：字串比對不是安全邊界（D10 第 6 點）。
- 契約回填：§能力缺口第 3 條（讀取）的「承接」改寫成指名權限層的機制，並**新增同類的一條（寫入：Codex `apply_patch`）**；
  第 6 條的「本次沒做」改為已於 2026-11-17 兩側查完，
  並明記**查完 ≠ 設好**。Codex 的兩套機制互斥，不得把四個鍵並列（spec 的 scenario）。

### D20 文件回填：只改事實陳述，一條規則都不動

**依據：** spec「文件中的 hook 現況敘述與實際狀態一致」；契約 §邊界；proposal §文件回填。

**決策。** 兩處，都是事實更新：

- `docs/development/agent-hook-contract.mdx`：五支檢查器的「**待建置**」標記改成現況（建置日、對應 PR）。
  **本次仍未建置的項目維持標記**（spec 的 scenario）——例如權限層（D19）、branch protection。
  **Codex `apply_patch` 的路徑欄位名不再是「未確認」而是「文件記載沒有這個欄位」**（D11），
  那一格要寫成事實與缺口，不是待確認標記。
- `AGENTS.md` §Agent Rules Index 末段（現行第 171 行）「No agent hook is wired yet: …」在本 change 之後成為**假的**，
  必須改寫成當時的實際狀態。**這是事實更新，不是新增規則**；
  驗收方式就是 spec 的 scenario：比對前後，差異只在 hook 現況的敘述，規則條目數量與內容不變。

契約是 `docs/` 底下的 `.mdx`，所以 `node scripts/check-specs.mjs docs` 會對它跑術語、錨點、Q 編號、
引文與過期標記五項檢查（契約 §邊界最後一列）。回填之後 `pnpm check:specs` 必須仍然綠。

### D21 測試策略：為 `tasks.md` 留的位置

spec 刻意把四件事排除在系統行為之外（它們是交付方式，不是系統要表現的行為）。
它們**必須出現在 `tasks.md`**，在這裡留下形狀以免遺失：

1. **隔離的暫存 repo／worktree 加假 runner。** `mktemp -d` 裡 `git init` 一個小 repo，
   以 `PATH` 前置一個假的 `ruff`／`mypy`／`tsc`／`eslint`（印固定輸出、回固定退出碼）。
   驗 allow／deny／warning／合法例外／退出碼／輸出上限／缺工具／staged 與 unstaged／
   含空白與中文的路徑／產物排除／防重入。
   **破壞性命令只驗「對那個字串的判定」，一次都不真的執行**；不接觸任何正式 secret。
2. **至少一次真實 runtime 的 smoke test**：在 Claude 與 Codex 各跑一次真的事件，確認註冊生效、
   matcher 命中、payload 欄位如預期、回饋看得到、攔截真的擋下。只有腳本測試綠不算完成。
3. **完成報告**：測試命令、工具版本、退出碼、snapshot、未覆蓋的能力（T11 的五欄）。
   必須寫明「branch protection 未啟用」與「權限層未設定」這兩個已知缺口。
4. **程式註解一律英文**（`AGENTS.md` §Language Rules；現有 `scripts/*.sh` 已是這個形狀）。

原本列在這裡的兩個待確認項（Codex `command` 的 wire 形狀，D16；Codex `apply_patch` 的路徑欄位名，D11）
**已於 2026-11-17 由 task 1.3、1.4 查完**（結果見 `completion-report.md` §1.3、§1.4）：
`command` 是字串；`apply_patch` 沒有路徑欄位。兩者都改為「要回填契約」的工作（task 7.1），不再是待確認。
**仍留在 `tasks.md` 的待確認項只剩 task 1.5 的 Linux 半邊**（`head -c` 在 GNU 側的截斷行為，D6）。

## Risks / Trade-offs

| 風險 | 承接 |
| :--- | :--- |
| **H2 只有 5 秒，而 D4 每次要冷啟動 `node`。** 在慢機器或冷快取上可能逼近上限，逾時即 fail-open（契約 §阻擋能力表）。 | 實作時實測 H2 的 p95 耗時並寫進完成報告；超過約 1 秒就改用純 bash 解析 H2 需要的少數欄位（H2 的 payload 只要 `tool_name`、`tool_input`、`cwd`）。這是本 design 判斷的門檻值，無來源。 |
| **Codex 的信任綁 hook 定義的 hash：每次改 hook，所有 Codex 開發者那邊都重新變未信任而被跳過，而版控裡的檔案看起來是好的**（契約 §能力缺口第 1 條）。 | 必要 gate 一律在 CI 再跑一次（D17）；H1 以摘要比對主動說出「定義變了，需重新信任」（D9 第四段）。 |
| **兩份手寫設定漂移。** 改一邊忘另一邊不會有任何報錯。 | H1 核對（D9）加 CI 核對（D17 第 2 步）。兩道都是機器執行，不靠人記得。 |
| **字串比對繞得過**（變數展開、編碼、動態組命令）。 | D10 第 5、6 點：窄範圍的無法判斷即擋，並在每則訊息寫明邊界。真正的保護在權限層與 branch protection，**而這兩者本 change 都沒有建置**（D19、D17），完成報告必須照實寫。 |
| **Codex 側沒有 hook 層的寫檔目標保護。** `apply_patch` 與 `Bash` 共用 `tool_input.command`、沒有路徑欄位（官方文件，2026-11-17 查核），所以受保護路徑的寫入在 Codex 上**擋不住**；Claude 側擋得住。兩個平台在這一項**不對等**。 | 維護者 2026-11-17 裁定承認缺口、交由平台權限層承接（D11、D19），**而權限層本 change 未設定**（Q2）。本 change 能做的三件：H1 的輸出明寫這個缺口、`apply_patch` 的 `NA:` 行就地說明、契約 §能力缺口 列成第二條（task 7.2）。完成報告（task 8.4）必須把它列為未覆蓋能力，不得宣稱兩平台等價。 |
| **兩平台預設 fail-open，`onFailure: "block"` 要 2.1.295、本機 2.1.273。** | D7 的進場守衛加 D7 的 CI lint；升級後改用宣告式開關並記版本下限。 |
| **H3 的 30 秒對大型 `tsc --noEmit` 可能不夠**，被平台中斷。 | H3 本來就是提醒（契約 §H3），真正的 gate 在 H4、H7。被中斷時 D2 的 `UNKNOWN:` 行會寫出哪一項沒判完，不會偽裝成通過。 |
| **新增的 pre-commit 與 H2 會改變既有工作習慣**（proposal §破壞性變更）。 | D18 的 setup 輸出寫明停用與復原方式；誤擋屬「故障」，依 `AGENTS.md` §SDD Workflow 停下回報，不得靠放寬規則收場。 |
| **`backend/`、`frontend/` 都不存在，`.py`／`.ts` 路由在本 change 裡無法對真工具驗證。** | D21 第 1 點的假 runner 驗「路由與啟用語意」；真工具的驗證要等那兩層 bootstrap，完成報告列為未覆蓋能力。 |
| **D1 的支援層（`scripts/lib/`）是 design 階段才長出來的檔案。** | 2026-11-17 回修已補進 proposal §Impact 並列入 `tasks.md`（task 2.2、2.3）。若維護者不接受這兩個檔，退路是把那段邏輯內嵌進五支檢查器——代價是五份副本，與本 change 的目標相反。 |

## Migration Plan

**上線順序**（每一步都能獨立回滾）：

1. 支援層與五支檢查器 + 它們的測試（此時還沒有任何東西呼叫它們，風險為零）。
2. `scripts/git-hooks/pre-commit` 與 `scripts/setup.sh`（H4 開始生效；`--no-verify` 可跳過）。
3. `.github/workflows/ci.yml` 的新 job（H7 開始生效；這是四步裡唯一不能被本機跳過的）。
4. `.claude/settings.json` 的 `hooks` 鍵與 `.codex/hooks.json`（H1、H2、H3、H6 開始生效）。
5. 文件回填（D20）——**放最後**，因為它陳述的是「已經建置了什麼」，前四步沒落地就是假的。

把註冊設定放在 CI 之後，是為了讓「檢查器本身有 bug」這件事先由 CI 擋在 PR 上，
而不是先去干擾每一位開發者的每一次工具呼叫。

**回滾**（四個互相獨立的開關）：

| 要關掉什麼 | 做法 |
| :--- | :--- |
| H2、H3、H6（Claude） | 從 `.claude/settings.json` 移除 `hooks` 鍵；`attribution` 不受影響 |
| H2、H3、H6（Codex） | 刪除 `.codex/hooks.json`（或 `[features] hooks = false`） |
| H4 | 刪除 `scripts/git-hooks/pre-commit`。**不要 `git config --unset core.hooksPath`** ——那會連 H5 一起關掉 |
| H7 | 以 revert PR 移除該 job |

**個別開發者的緊急出口**：`git commit --no-verify`、Claude 的 `disableAllHooks`、
Codex 的 `[features] hooks = false`。四條跳過途徑的存在正是 CI 必須是真正 gate 的理由（契約 §H7）。

**沒有資料遷移。** `.git/label-suite/` 下的證據與摘要是可拋棄的本機狀態；刪掉只會讓下一次檢查重新產生。

## Open Questions

**編號在 2026-11-17 重編過，舊號不再使用。** 維護者當日裁定了原 Q1、Q3、Q4、Q5 四題，它們已落回對應的決策，
不再是待決問題；剩下的兩題重新編為 Q1、Q2，本節不留空號：

| 現在的編號 | 原編號 | 題目 |
| :--- | :--- | :--- |
| Q1 | Q2 | 本 repo 的 Codex 設定採 permission profile 還是舊的 sandbox 設定 |
| Q2 | Q6 | 平台權限層什麼時候設 |

| 已裁定（2026-11-17） | 原編號 | 結論落在哪裡 |
| :--- | :--- | :--- |
| Codex 信任指引要不要寫進 `scripts/setup.sh` | Q1 | 要寫。D18 第 4 點、spec「安裝流程…」的信任指引 scenario、task 4.4 |
| 裸檔名 `.env` 要不要納入受保護樣式 | Q3 | 要。`**/.env` 成為第六個樣式：D11 拒絕清單、spec 受保護路徑 requirement 與其裸檔名 scenario、task 3.3 |
| workspace 之外的路徑在阻擋型觸發點怎麼算 | Q4 | 維持 D11 的做法：H2 `exit 2`、H3 略過並註明。行為不變，理由寫進 D11 |
| 「經維護者確認的破壞性命令」怎麼走 | Q5 | hook 一律拒絕，確認過的路徑走 hook 之外。D10 第 7 點、spec「破壞性命令…」及其第四個 scenario |

**本 change 的 proposal 與 spec delta 只登記 Q1**（它是停點一仍在等的那一題）；**Q2 只登記在本文件**，
因為它要決定的是後續 change 的排程，不改變本 change 的任何 requirement、決策或工作拆解。
**兩題都不阻擋本 change 進入 apply。**

- **Q1（原 Q2）：本 repo 的 Codex 設定採 permission profile 還是舊的 sandbox 設定。**
  官方文件明寫兩者不可混用（proposal §前置查核）。
  D16 已把 hook 註冊（`hooks.json`）與權限設定（`config.toml`）切開，Q1 的任一答案都不改 `hooks.json`，
  所以本 change 不需要等它。
- **Q2（原 Q6）：權限層什麼時候設。** D19 把它整個排除在本 change 之外，所以契約 §能力缺口第 3 條的承接在本 change 之後
  仍是「已查明機制、尚未設定」。它需要一張自己的 issue。

最後一項不是問題而是必須記下的差異：**契約 §H4 寫「腳本自己設上限」，本設計依 spec 不實作 watchdog**（D5）。
契約回填時要把那一格改成現況，而不是留著一個沒做的承諾。
