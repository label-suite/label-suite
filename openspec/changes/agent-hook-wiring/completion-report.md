# 完成報告：agent-hook-wiring

> 依 `tasks.md` 群組 8 第 4 項建立。每完成一個群組就往下追加，不回頭改寫既有紀錄。

## 群組 1：實作前的事實查核

查核日 **2026-11-17**，機器 darwin arm64。

### 1.1 本機 runtime（已完成）

| 項目                             | 實測值              | 與 proposal §前置查核 所記 |
| :------------------------------- | :------------------ | :------------------------- |
| Claude Code                      | `2.1.273`           | 相同                       |
| codex-cli                        | `codex-cli 0.153.0` | 相同                       |
| `codex features list` 的 `hooks` | `stable` / `true`   | 相同                       |
| `command -v timeout`             | **不存在**          | 相同                       |
| `command -v gtimeout`            | **不存在**          | 相同                       |
| node                             | `v22.23.3`          | —                          |
| pnpm                             | `10.18.3`           | —                          |
| uv                               | `0.12.18`           | —                          |

五項與規劃階段所記**完全一致**，無須停下回報。

### 1.2 四個版本閘鍵（已完成）

本機 Claude Code **2.1.273**：

| 鍵                                                 | 版本下限 | 本機可用 |
| :------------------------------------------------- | :------- | :------- |
| `permissions.blockReadsOutsideWorkingDirectories`  | 2.1.257  | **可用** |
| `onFailure: "block"`                               | 2.1.295  | 不可用   |
| `permissions.blockWritesOutsideWorkingDirectories` | 2.1.314  | 不可用   |
| `permissions.denyInsteadOfPrompting`               | 2.1.319  | 不可用   |

三個不可用，所以 D7 的「腳本自行 fail-closed」仍是唯一可行路徑，不能改用 `onFailure`。
本次**沒有**設定任何權限層（D19），所以 `blockReads…` 雖然可用也未啟用——**可用 ≠ 已設定**。

### 1.3 Codex `hooks.json` 的 `command` 欄位（已完成）

**是字串，不是陣列。** 官方文件的範例：

> `"command": "python3 ~/.codex/hooks/session_start.py"`

來源 `https://learn.chatgpt.com/docs/hooks`，查核日 2026-11-17。task 6.2 依此實作，task 7.1 回填契約。

### 1.4 Codex `apply_patch` 的路徑欄位（已完成，**結果推翻一個設計假設**）

官方文件：`apply_patch` 與 `Bash` **共用同一個輸入結構 `tool_input.command`**；該頁**沒有**記載 `command` 內部結構，也**沒有**任何獨立的路徑欄位。

這和 Claude 不同：Claude 的 `Edit`／`Write` 在 `tool_input` 直接給檔案路徑。

**後果（需要 design 處理，不是實作細節）：** D11 寫「找不到可辨識路徑欄位就 `exit 2`」。依這次查到的事實，Codex 上**永遠**找不到路徑欄位，所以那條規則會讓**每一次 `apply_patch` 都被擋**——fail-closed 到不可用。三條可能的出路，擇一屬 design 決定：

1. 從 `tool_input.command` 解析 apply_patch 封包取出目標路徑（多一層解析，且該格式官方未文件化）；
2. 承認 Codex 側沒有 hook 層的寫檔目標保護，比照 §能力缺口第 3 條（讀取）的處理方式，改由**權限層**承接並明寫缺口；
3. 只在 Claude 側啟用寫檔目標保護，Codex 側標為未覆蓋。

**本報告不選。** 已回報給規劃階段處理。

### 1.5 `head -c 65536` 的截斷行為（兩平台皆已驗）

macOS `/usr/bin/head`（BSD，無 `--version`）：

| 輸入                                      | 輸出        | 結果                 |
| :---------------------------------------- | :---------- | :------------------- |
| 70000 bytes 純 ASCII                      | 65536 bytes | 正確截斷             |
| 69000 bytes 的 UTF-8 中文（每字 3 bytes） | 65536 bytes | **末端切在字元中間** |

65536 = 3 × 21845 + 1，所以第 21846 個字被切掉只剩 1 個 byte，輸出尾端是 `b'\xe4'`，**整段無法以 UTF-8 解碼**（`unexpected end of data`）。

**這對 D6 是實質問題。** 契約 §Repo 定位 明寫 `cwd` 由使用者的目錄決定、不能假設是 ASCII，所以診斷輸出含多位元組字元是正常情況。截斷必須不產生無效 UTF-8——`head -c` 單獨使用做不到這件事。task 2.3 實作時要處理（例如截斷後丟棄尾端不完整的位元組序列再補 `TRUNCATED:`）。

Linux 側於 **2026-11-20** 在 PR #526 的 `hooks` job（`ubuntu-latest`）補驗，與 macOS 用同一組輸入（23000 個 3-byte 中文字）。**兩邊一致**：

| 平台                   | `head -c 65536` 尾端 4 bytes | 原始輸出能否解碼 |
| :--------------------- | :--------------------------- | :--------------- |
| Linux（GNU coreutils） | `e4 b8 ad e4`                | **不能**         |
| macOS（BSD）           | `e4 b8 ad e4`                | **不能**         |

兩邊都把第 21846 個字切成只剩第一個 byte，所以 `head -c` 單獨使用在哪個平台都產生無效 UTF-8。**沒有平台差異要因應**；本 change 的因應不是挑一邊，而是不依賴它——截斷在 `hook-common.sh` 的 node 過濾器裡做，退回到完整字元邊界再補 `TRUNCATED:`，CI 那一步斷言的正是「過濾後的輸出在兩個平台都能解碼」，並接著跑整套 `hook-common-tests.sh`。

## 群組 2–7：落地的東西

| 層         | 檔案                                                                                                                                                 | 測試                                                     |
| :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| 共用       | `scripts/lib/hook-payload.mjs`、`hook-common.sh`、`hook-routes.sh`                                                                                   | `hook-payload.test.mjs`（27 項）、`hook-common-tests.sh` |
| 五支檢查器 | `check-env.sh`（H1）、`check-command.sh`（H2 命令）、`check-write-target.sh`（H2 寫檔）、`check-changed.sh`（H3／H4／H7）、`check-evidence.sh`（H6） | 各一套，加 `checker-contract-tests.sh` 的共同介面一致性  |
| Git hook   | `git-hooks/pre-commit`（lint-staged 後接 `check-changed.sh --staged`）、`commit-msg`（行為不變）                                                     | `git-hooks-tests.sh`                                     |
| 註冊       | `.claude/settings.json` 的 `hooks` 鍵、`.codex/hooks.json`                                                                                           | `check-env-tests.sh` 的兩份註冊交叉核對                  |
| CI         | `ci.yml` 的 `hooks` job，ubuntu 與 macOS 兩個平台                                                                                                    | `ci-wiring-tests.sh`                                     |
| 稽核       | `forbidden-terms-lint.sh` 與它的兩個 fixture                                                                                                         | `forbidden-terms-tests.sh`                               |

## 群組 8：驗證與實測

### 8.1 Runtime 事件實測

**Claude 側（已完成，2026-11-20）。** 七次全部不是刻意安排的，都是這一輪工作本身撞到的：

| #   | 事件                | 觀察到的行為                                                                                                                                                                                           |
| :-- | :------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `PreToolUse`／Write | H2 擋下寫入 scratchpad 的 Write（維護者裁定維持嚴格，本輪改走 shell 寫檔）                                                                                                                             |
| 2   | `PreToolUse`／Bash  | H2 擋下驗證命令裡的 `rm -rf`（硬性規則 10）                                                                                                                                                            |
| 3   | `PreToolUse`／Bash  | 檢查器自己 abort 時輸出 `BLOCK: checker aborted unexpectedly` 並擋下——那次 abort 是真缺陷，見下方 8.2 第 3 項                                                                                          |
| 4   | `Stop`              | H6 擋下完成宣告，並因此暴露「純 docs 變更永遠無法滿足 H6」                                                                                                                                             |
| 5   | `pre-commit`        | 在本 PR 的每個 commit 上依序跑完 lint-staged 與 `check-changed.sh --staged`；動到 docs 的 commit 跑了整棵 `check:specs`，動到 `backend/**.py` 的 merge commit 跑了真的 `ruff check` 與 `mypy --strict` |
| 6   | `pre-commit`        | 擋下 merge commit 本身——`ruff`／`mypy` 不在 `PATH` 上，見 8.2 第 1 項                                                                                                                                  |
| 7   | `commit-msg`        | 兩次擋下：一次 subject 76 字超過 72，一次 message 含 CJK                                                                                                                                               |

**Codex 側（未完成）。** 需要一個 Codex session，本流程跑不到。要觀察的四件事已寫進 [#111 的留言](https://github.com/label-suite/label-suite/issues/111)：`SessionStart` 收不收 matcher、`apply_patch` 是否命中、payload 欄位、H2 的攔截是否真的擋下動作。**在那之前，Codex 側的註冊只是靜態核對過（H1 確認兩份設定指向的腳本都存在且一致），沒有任何一次真的事件證據。**

### 8.2 全量回歸與效能

PR #526 的 `hooks` job 在 **ubuntu-latest 與 macos-latest 皆綠**（run 44724346461），六個 CI job 全綠。本機全量：13 套 shell 測試、`hook-payload.test.mjs` 27 項、禁止用語 lint 10 檔乾淨、`check-env.sh --ci` exit 0、`check:specs`／`check:flows`／`check:er` 全綠、`check-citations --strict` 2485 條 0 unverified 0 errors、`pnpm format:check` 全數符合。

**每個 handler 對它自己註冊的 timeout 的餘裕**（darwin arm64，走真正要做事的路徑，不是 early-exit）：

| Handler                                                       | 事件           |     p95 |     max | 註冊的 timeout |  餘裕 | 超時次數 |
| :------------------------------------------------------------ | :------------- | ------: | ------: | -------------: | ----: | -------: |
| `check-env.sh`                                                | `SessionStart` |  864 ms |  883 ms |           10 s | 11.6× |    0／12 |
| `check-command.sh`                                            | `PreToolUse`   |  283 ms |  287 ms |            5 s | 17.7× |    0／40 |
| `check-write-target.sh`                                       | `PreToolUse`   |  279 ms |  279 ms |            5 s | 17.9× |    0／40 |
| `check-changed.sh`（docs，整棵 `check:specs`）                | `PostToolUse`  | 1465 ms | 1465 ms |           30 s | 20.5× |    0／10 |
| `check-changed.sh`（`backend/**.py`，ruff + mypy）            | `PostToolUse`  | 1111 ms | 1111 ms |           30 s | 27.0× |    0／10 |
| `check-evidence.sh`（`stop_hook_active=false`，真的比對證據） | `Stop`         |  225 ms |  225 ms |           60 s |  266× |    0／10 |

H2 另有一組跨七種輸入各 40 輪（共 280 次）的量測：median 268 ms、p95 284 ms、p99 313 ms、max 422 ms，**0 次超過 5 s**。

**只有設定真的上線、或 CI 真的跑過才現形的七個缺陷**（全部不是讀碼或審查找到的）：

1. **`ruff`／`mypy` 不在 `PATH` 上。** `uv sync` 把它們裝進 `backend/.venv`，所以「該層已存在但缺工具」成為每一次 Python 改動的判定，連只帶著 main 的 Python 的 merge commit 都被 pre-commit 擋下。改為經 `uv run --directory <backend> --project <backend> --no-sync` 呼叫。
2. **ruff 的 `per-file-ignores` 是對工作目錄解析的，不是對 `--config` 指的檔案。** 工作目錄一離開 `backend/`，`"tests/**" = ["S101"]` 就不再匹配，staged 的測試檔裡每個 `assert` 都被報。`--staged` 的鏡像因此要物化整棵索引：ruff 要旁邊有 `pyproject.toml`，`mypy --strict` 要有套件樹，否則每個 `app.*` import 都判為解不開。
3. **兩支工具的範圍不同**（`openspec/config.yaml`：`ruff check .` 是整個 `backend/`，`mypy --strict app` 只有套件）。把 `--strict` 也套到 `backend/tests/` 上會報出 12 個本次改動沒碰過的錯。
4. **純 docs 的改動永遠無法滿足 H6。** docs 路由一律啟用，但證據記錄的 `covered` 與內容指紋都只由 `.py`／`.ts` 清單組成。隱形至今是因為 H6 的測試全部改 `.py`，而註冊之前沒有東西會觸發 `Stop`。
5. **遮蔽規則吃掉路徑裡的一段。** 單一路徑片段本身就可能是 20 個字元，macOS 的暫存目錄一定是，於是 H2 印出 `/private/var/folders/q2/***/T/…`——指了一個不存在的路徑。2026-11-18 那條裁定的 fixture 漏掉這個情況，因為它的 macOS 路徑含底線，把 run 切到門檻以下。
6. **TypeScript 路由有一模一樣的三個問題。** `frontend/` 在同一天隨 #505 落地，`.ts`／`.tsx` 從 NA 轉成已啟用，於是：`tsc`／`eslint` 不在 `PATH` 上（在 `frontend/node_modules/.bin`）；eslint 的 flat config 也是對工作目錄解析的；`tsc -b` 不能帶檔案參數，否則單檔編譯看不到專案設定。改為經 `pnpm -C <frontend> exec` 呼叫，`--staged` 時把已安裝的工具鏈接進鏡像——這就是 Python 那邊 `--project` 做的事。**抓到它的是 CI 的路由集斷言**，那一步存在的理由正是「這個 repo 實際在強制什麼」不能無聲改變。

7. **H2 的「無法判斷」從來沒印出過它的理由。** 兩個缺陷疊在一起：裸 `$detail` 撞上後面的全形括號，在 UTF-8 locale 下 bash 把那個字元的位元組吃進變數名（退出碼仍是 2，判定沒錯，該說明原因的那一行什麼都沒說）；底下還有一層是欄位用 tab 分隔，而 tab 是 IFS 空白，bash 會把連續的 tab 併成一個，「無規則」的空欄位就消失，理由跑到別的變數去。改用 `0x1f` 分隔。

另外兩個是跨平台的測試缺陷，由兩個平台互相打出來：Linux 的單一環境變數上限 128 KiB 讓 220 KB 的 fixture 在 `bash -c` 就失敗（量到的是作業系統，不是被測的上限）；以及上面第 5 項。

### 8.3 註解與 CI 步驟名稱的語言

本 change 動到的 29 個 `scripts/`／`.github/` 檔逐檔掃過，註解與 `ci.yml` 的 29 個 `name` 欄位 **0 處** CJK。先以「非 ASCII」掃出 131 處，逐一看過全是框線、破折號與 `§` 這類英文排版符號；改以 CJK 與全形區段重掃才是正確口徑。行尾註解與引號外的 CJK 也掃過，剩下的 6 行是診斷字串與 `--list-routes` 的釘住輸出，依 `AGENTS.md` §Language Rules 的檢查器例外本來就是中文。

### 8.4 未覆蓋的能力

**這個 gate 不完整，本 change 不宣稱做完。**

| #   | 未覆蓋                                 | 現況                                                                                                                                                                                                        |
| :-- | :------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | branch protection 未啟用               | CI job 會紅，但技術上還擋不住合併。H7 的真正 gate 在 branch protection，不在本 change                                                                                                                       |
| 2   | 平台權限層未設定                       | Codex 的 `filesystem = "deny"`、Claude 的 `permissions.deny` 都還沒設（維護者 2026-11-17 裁定不在本 change 做）                                                                                             |
| 3   | **Codex 側沒有 hook 層的寫檔目標保護** | `apply_patch` 沒有路徑欄位（官方文件 2026-11-17 查核），受保護路徑的寫入在 Codex 上擋不住，Claude 側擋得住，**兩平台不對等**；承接它的權限層就是第 2 項                                                     |
| 4   | Codex 的讀取攔截                       | Codex 沒有讀取類的工具名，hook 層在讀取上沒有攔截點，同樣由第 2 項承接                                                                                                                                      |
| 5   | Codex 側未經 runtime 實測              | 見 8.1；`SessionStart` 收不收 matcher 也還沒驗過，契約已記成未實測                                                                                                                                          |
| 6   | ~~`frontend/` 不存在~~                 | **已解除**：`frontend/` 於 2026-11-20 隨 #505 落地，`.ts`／`.tsx` 路由已對真 `tsc -b` 與 `eslint` 驗過，含 `--staged`——鏡像裡放壞檔會紅，工作區修好但沒 staged 仍然紅。`.py` 同樣已對真 `ruff`／`mypy` 驗過 |
| 7   | Alembic migration 的排除樣式           | 仍是 `backend/**/alembic/versions/**` 這個佔位；`backend/` 已存在，實際路徑是 `backend/alembic/versions/`，樣式能匹配，但沒有專門的測試釘住                                                                 |
| 8   | 組織層 managed policy                  | H1 明寫 `UNKNOWN:`，非互動環境查不到，不代表已通過                                                                                                                                                          |
| 9   | Codex 的信任狀態                       | H1 明寫 `UNKNOWN:`，沒有非互動的查詢方式，被 Claude 叫起時不替它作保                                                                                                                                        |
| 10  | `forbidden-terms-lint.sh` 只掃檢查器層 | 不掃 `scripts/tests/`。實測擴到那裡會報三行、三行都合法，需要豁免機制，而沒有豁免機制正是這道 gate 的強項。測試層靠變異測試保護                                                                             |

### 8.5 退出碼字彙與各模式的編碼

五支檢查器共用同一套字彙（D2；`checker-contract-tests.sh` 逐支驗過）：`0` 通過或不適用、`1` 有違規但只回報、`2` 阻擋。**同一種「無法判斷」在不同模式下編碼不同**，這是刻意的：

| 模式／事件                                                  | 性質   | 無法判斷時                                                  | 實測                                                           |
| :---------------------------------------------------------- | :----- | :---------------------------------------------------------- | :------------------------------------------------------------- |
| `check-changed.sh --event`（H3）                            | 提醒型 | `0` 並印 `UNKNOWN:`                                         | `check-changed-tests.sh`                                       |
| `--staged`／`--range`／`--files`／`--list-routes`（H4、H7） | 阻擋型 | `2`                                                         | 同上，逐模式斷言                                               |
| `check-command.sh`、`check-write-target.sh`（H2）           | 阻擋型 | `2`                                                         | 本輪實測：引號不成對與非字面參數都回 `2`，且現在會印出是哪一種 |
| `check-evidence.sh`（H6）                                   | 阻擋型 | `2`                                                         | `check-evidence-tests.sh`                                      |
| `check-env.sh`（H1）                                        | 只回報 | 永不阻擋，`--event` 一律 `0`；`--ci` 把同一份判定表達成非零 | `check-env-tests.sh`                                           |

`hook-payload.mjs` 另有一個 `3`，給「payload 本身不堪用」，刻意落在 `0`／`1`／`2` 之外，呼叫端才分得出「檢查說不行」與「連 payload 都讀不到」。

### 8.6 釘住的 snapshot

四份，都在同一個 commit 裡與被它描述的東西一起改，否則就是漂移：

| Snapshot            | 位置                                                        | 釘的是什麼                                                  | 本輪是否動過                                                                |
| :------------------ | :---------------------------------------------------------- | :---------------------------------------------------------- | :-------------------------------------------------------------------------- |
| 過濾器輸出的 digest | `hook-common-tests.sh` 的 `PARITY_EXPECTED`                 | 遮蔽與截斷後的位元組，兩平台必須一致                        | **動過**：遮蔽規則三改了，並把那條 macOS 路徑加進輸入，重釘前先讀過過濾結果 |
| 啟用中的路由集      | `ci.yml` 的 `ROUTES` heredoc                                | `--list-routes` 的完整輸出                                  | **動過**：`backend/` 落地讓 `.py` 從 NA 轉成已啟用                          |
| hook 定義摘要       | `.git/label-suite/hook-defs.sha256`（執行期產生，不進版控） | 兩份註冊設定的內容；變了就讓 H1 說「與上次不同」            | 不適用（執行期狀態）                                                        |
| H5 的 perl 程式     | `check-commit-msg-tests.sh`                                 | 36 行逐行釘住，因為先前一版斷言是空的（允許新增註解行就過） | 未動                                                                        |

### 8.7 這份報告的界限

本 change 把 `AGENTS.md` 的規則接到了 agent 的事件上，**沒有**把那個 gate 做完整：上面 8.4 的十項都還開著，其中第 1、2 項是 gate 的兩塊主要缺口，第 3、4、5 項是 Codex 側與 Claude 側不對等的部分。工作項 8.1 的 Codex 半邊尚未完成，所以 `tasks.md` 的 31 項中 **30 項已完成、1 項待維護者在 Codex 代跑**。
