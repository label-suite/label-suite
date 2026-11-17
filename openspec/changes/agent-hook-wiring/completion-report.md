# 完成報告：agent-hook-wiring

> 依 `tasks.md` 群組 8 第 4 項建立。每完成一個群組就往下追加，不回頭改寫既有紀錄。

## 群組 1：實作前的事實查核

查核日 **2026-11-17**，機器 darwin arm64。

### 1.1 本機 runtime（已完成）

| 項目 | 實測值 | 與 proposal §前置查核 所記 |
| :--- | :--- | :--- |
| Claude Code | `2.1.273` | 相同 |
| codex-cli | `codex-cli 0.153.0` | 相同 |
| `codex features list` 的 `hooks` | `stable` / `true` | 相同 |
| `command -v timeout` | **不存在** | 相同 |
| `command -v gtimeout` | **不存在** | 相同 |
| node | `v22.23.3` | — |
| pnpm | `10.18.3` | — |
| uv | `0.12.18` | — |

五項與規劃階段所記**完全一致**，無須停下回報。

### 1.2 四個版本閘鍵（已完成）

本機 Claude Code **2.1.273**：

| 鍵 | 版本下限 | 本機可用 |
| :--- | :--- | :--- |
| `permissions.blockReadsOutsideWorkingDirectories` | 2.1.257 | **可用** |
| `onFailure: "block"` | 2.1.295 | 不可用 |
| `permissions.blockWritesOutsideWorkingDirectories` | 2.1.314 | 不可用 |
| `permissions.denyInsteadOfPrompting` | 2.1.319 | 不可用 |

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

### 1.5 `head -c 65536` 的截斷行為（**macOS 已驗，Linux 待 CI**）

macOS `/usr/bin/head`（BSD，無 `--version`）：

| 輸入 | 輸出 | 結果 |
| :--- | :--- | :--- |
| 70000 bytes 純 ASCII | 65536 bytes | 正確截斷 |
| 69000 bytes 的 UTF-8 中文（每字 3 bytes） | 65536 bytes | **末端切在字元中間** |

65536 = 3 × 21845 + 1，所以第 21846 個字被切掉只剩 1 個 byte，輸出尾端是 `b'\xe4'`，**整段無法以 UTF-8 解碼**（`unexpected end of data`）。

**這對 D6 是實質問題。** 契約 §Repo 定位 明寫 `cwd` 由使用者的目錄決定、不能假設是 ASCII，所以診斷輸出含多位元組字元是正常情況。截斷必須不產生無效 UTF-8——`head -c` 單獨使用做不到這件事。task 2.3 實作時要處理（例如截斷後丟棄尾端不完整的位元組序列再補 `TRUNCATED:`）。

Linux 側（CI）尚未驗，屬 task 5.1 落地後才做得到；屆時補記並比對兩邊是否一致。
