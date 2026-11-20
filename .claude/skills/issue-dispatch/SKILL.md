---
name: issue-dispatch
description: 掃描 Label Suite 看板上 Ready 的 issue，排出彼此不衝突的波次，用各自獨立 worktree 的 lead 平行處理，經獨立審查、開 PR、CI 通過後由主 session 合併並把卡片移到 Done。第一版只派文件與工具類的 issue。當使用者說「派工」「跑 Ready 的 issue」「跑一波」「dispatch」，或只給一個 issue 編號要你接著做先前派出去的工作時使用。
---

# Issue Dispatch

狀態只存在兩個地方：看板的 Status 欄，和 issue 上的檢查點留言。不要把進度寫進記憶檔、scratchpad 或任何本機檔案，因為平行的 session 會互相覆蓋，另一台電腦也讀不到。任何 session 只要拿到 issue 編號，讀它最後一則檢查點留言，就能接著做。

卡片進到 Ready，就是維護者對這張 issue 的常設授權：從派工到合併都不再問，見 `AGENTS.md` §Project Board and Dispatch 的 Dispatch 一條。

## 這個 skill 不做的事

- 不把卡片移到 Ready，也不移 Epic 的 Ready。哪張可以做，由 `AGENTS.md` 的 Ready gate 決定。
- 不派範圍外的 issue（見步驟 3），不處理 Critical 或 High 的資安發現。
- 不 commit、不 push 到 `main`，不用 squash 或 rebase 合併。
- 不改 `docs/specs/` 的需求、`docs/specs/00-prd.mdx` 或 `design/prototype/`。

## 角色

```
主 session（唯一的排程者、唯一移動卡片到 Done 的人、唯一合併的人）
│  掃描 → 撞車檢查 → 分類 → 排波次（一波最多 3 張）
│  一則訊息派出整波的 lead
│
├─ lead（general-purpose，一張 issue 一個，自己的 worktree 與分支）
│    寫文件、跑檢查、commit、push、留檢查點、勾 issue 的工作項
│
└─ 審查者（general-purpose，新開的，沒寫過這份 diff）
     依 doc-writing 的自我檢查清單審 diff，只回報不修改
```

- lead 和審查者都用 `general-purpose`。`.claude/agents/` 的角色都是 SDD 用的，文件類沒有對應的角色。
- 模型依 `CLAUDE.md` 的檔案數：會碰到 2–9 個檔案用 Sonnet，10 個以上用 Opus，拿不準就選大的。
- lead 的回報不是證據。主 session 自己讀 diff、讀命令輸出，才判斷能不能往下走。

## 步驟 1 掃描

```bash
scripts/dispatch-scan.sh
```

輸出每張 Ready、還開著、不是 Epic 的 issue 一列：編號、還沒關的 blocked-by、標題。查詢寫死在腳本裡，所以 `.claude/settings.json` 只允許這支腳本，不允許任意的 `gh api graphql`（那樣連 mutation 都會放行）。

第二欄不是 `[]` 的，代表還有沒關的 blocked-by，跳過。

每張候選都要讀完整串留言再判斷：`gh issue view <N> --comments`。裁定常寫在後面的留言裡；內文和最新留言講法不一致時，歸到「需要裁定」，不要猜。

### 只給 issue 編號時

這條路不經過掃描，所以認領或移動任何卡片之前，先確認 issue 的狀態：

```bash
gh issue view <N> --json state -q .state
gh project item-list 1 --owner label-suite --limit 400 --format json \
  -q '.items[]|select(.content.number==<N>)|.status'
```

`state` 必須是 `OPEN`。新認領的 Status 必須是 Ready；In Progress 或 In Review 的，照步驟 2 依最後一則檢查點留言判斷是不是重入。Todo、Done、已關閉，或第二個指令沒有輸出（issue 不在看板上），都算不符，就停下來回報維護者，不動卡片、不留言。

## 步驟 2 撞車檢查

用 issue 編號比對，任何一項命中就是有人在做，跳過並寫進波次報告。

```bash
N=<number>
git worktree list | grep -E "(^|[^0-9])${N}([^0-9]|$)"
git branch -a | grep -E "(^|[^0-9])${N}([^0-9]|$)"
git log --all --grep="#${N}" --oneline | head
gh pr list --state all --search "${N}" --json number,title,state,headRefName
```

比對裸的編號，不是 `issue-<N>-` 前綴；分支和 worktree 的命名不只一種。

卡片在 In Progress 的，看最後一則留言：有 `<!-- issue-dispatch checkpoint -->` 就是重入，從那則接著做；沒有就是別人認領的，不碰。

## 步驟 3 分類

| 類別 | 條件 | 處理 |
| :--- | :--- | :--- |
| 派工 | 只碰 `docs/development/`、`docs/` 其他非規格文件、`.claude/`、`.github/`、`scripts/`、`AGENTS.md`、`CLAUDE.md` | 進入步驟 4 |
| 範圍外 | 改畫面（`design/`、任何介面）、改 `docs/specs/` 的需求或 PRD、產品程式（`backend/`、`frontend/`、`e2e/`） | 不留言，寫進波次報告 |
| 需要裁定 | 需求不清、內文和留言不一致、兩種讀法會做出不同的東西、工作項要維護者決定 | 留一則檢查點說明哪裡要決定，卡片移回 Todo，寫進波次報告 |

拿不準屬於哪一類，就當作範圍外。

## 步驟 4 排波次

估每張 issue 會改哪些檔案。兩張改到同一個檔案就算衝突，排進不同波次；估不準的也當作衝突。

一波是衝突圖裡最大的獨立集合，最多 3 張。

同一波可以同時寫，但 **NoteCraft 的本機 build 不能同時跑**：快取在全機共用的 `~/.notecraft/`。lead 不跑本機 build，以 CI 的 `docs-site` job 為準；主 session 要在本機看頁面時，一次只 build 一個分支。

派工前，先在對話裡寫出波次報告：候選清單、跳過的和原因、衝突圖、各波的成員。

## 步驟 5 派工

一張 issue 一個 worktree、一個分支、一個 lead。

```bash
N=453
SLUG=adr-testing                         # 小寫、用 - 分隔
BRANCH=docs/${SLUG}                      # <type>/<short-description>，見 AGENTS.md Hard Rule 2
WT=$PWD/.claude/worktrees/issue-${N}-${SLUG}

git fetch origin main
git worktree add -b "${BRANCH}" "${WT}" origin/main
```

接著，在派 lead 之前：

1. 卡片移到 In Progress（`gh project item-edit`，ID 見下面的「看板 ID」）。它的 Epic 若還在 Ready，也移到 In Progress。
2. 留認領留言加上第一則檢查點：agent、分支、worktree、lead 的模型。

整波的 lead **在同一則訊息裡派出去**，讓它們同時跑。lead 的 prompt 至少要有：

- issue 編號，以及「先讀 `gh issue view <N> --comments`」
- worktree 的絕對路徑，以及「每個指令都以 `cd <絕對路徑> && ` 開頭，不要假設工作目錄會保留」
- 分支名稱
- 要載入的 skill（文件類是 `doc-writing`；ADR 另外照它的 ADR 一節）
- 驗證指令：本 repo 的 `scripts/check-*.mjs` 中跟改動有關的那幾支，以及 `bash scripts/check-commit-msg.sh` 對每個 commit 的檢查；**不跑** `notecraftapp build`
- commit 格式：`AGENTS.md` §Commits，subject 結尾 `(#N)`，trailer 用 lead 自己的模型
- 做完要：push、勾 issue 上完成的工作項、留一則「待審查」檢查點、回報 diff 範圍；**不開 PR**
- 不要用 `git stash`（stash 是全 repo 共用的）；要暫存就做 WIP commit
- 遇到範圍外的錯誤只回報，不擴大範圍；遇到要維護者決定的事就停下來回報，不自己挑

## 步驟 6 審查與開 PR

lead 回報後：

1. 主 session 用 `git -C <worktree> diff origin/main...HEAD` 讀完整個 diff，對照 issue 的工作項。不用 `cd` 進 lead 的 worktree。
2. 另開一個新的 general-purpose 審查者。prompt 只給 issue 編號、worktree 路徑和「依 `.claude/skills/doc-writing/SKILL.md` 步驟 5 的清單，以及 `AGENTS.md` §Review Guidelines 審查 `origin/main...HEAD`」，不給主 session 自己的看法。
3. 主 session 逐條核對審查意見。Critical 或 High 就用 `SendMessage` 交回原本的 lead 修，修完再審一次；Medium 或 Low 寫進 PR 的「非阻擋」，但違反 `doc-writing` 鐵律的（例如來源沒有的理由、正文寫出來源 repo）即使是 Medium 也在合併前交回 lead 修，主 session 讀修正的 diff 確認即可，不必重審；真的有問題但在範圍外的，另開 issue，在 PR 裡寫出編號。
4. 開 PR。body 先寫進 scratchpad 的檔案，再用 `--body-file` 傳：

```bash
gh pr create --base main --head "${BRANCH}" \
  --title "<type>: <中文描述>" --body-file "<scratchpad>/pr-${N}.md"
```

body 依 `.github/PULL_REQUEST_TEMPLATE.md`，要有 `Closes #N`，Test Plan 每一項都附上指令和結果才能打勾。

5. 卡片移到 In Review，留「PR 已開」的檢查點。
6. 在拿到 PR 編號的**同一輪**就用 `run_in_background` 啟動 `gh pr checks <pr> --watch`。沒有啟動監看，就不會有任何事件把主 session 叫醒。

## 步驟 7 合併

監看結束只代表該醒來了，不代表可以合併。以下全部成立才合併：

```bash
gh pr view <pr> --json mergeable,mergeStateStatus,headRefOid,statusCheckRollup
```

- `mergeable` 是 `MERGEABLE`，`mergeStateStatus` 是 `CLEAN`
- 檢查數大於 0，而且全部通過
- `commit-messages`、`docs-site`、`format`、`specs` 四個 job 都在，而且都是 `SUCCESS`（每個 PR 都會跑，缺一個就代表還沒註冊）
- 這個 head SHA 沒有還在 `queued` 或 `in_progress` 的 run：
  `gh run list --branch <branch> --json status,headSha --jq '[.[]|select(.headSha=="<sha>" and .status!="completed")]|length'` 要是 `0`
- 審查已經通過，issue 的工作項和 PR 的 Test Plan 全部勾完

```bash
gh pr merge <pr> --merge
```

合併後確認 issue 已經被 `Closes` 關掉，卡片移到 Done，留「已合併」的檢查點。Epic 的最後一張子 issue 完成時，Epic 也移到 Done。

CI 紅了就修、再 push，最多兩次。第三次還紅，就留一則附上**原始錯誤輸出**的檢查點，卡片留在 In Review，寫進波次報告，等維護者處理。

## 步驟 8 檢查點留言

每到一個階段就留一則：派工、待審查、審查結果、PR 已開、已合併、卡住。

```markdown
<!-- issue-dispatch checkpoint -->
### 🤖 issue-dispatch 檢查點：<階段>

- **已完成**：…
- **已驗證**：<指令 + 結果>
- **剩下**：…
- **分支 · worktree**：`docs/…` · `.claude/worktrees/issue-N-…`
- **PR**：#…（或「未開」）
```

開頭的 HTML 註解是找最新一則檢查點的錨點。只有命令印出留言網址，才算留成功；GitHub 偶爾會回 502，失敗了就重試。

## 步驟 9 收尾

合併後，遠端分支會被 GitHub 自動刪除。本機的清理：

```bash
git worktree remove "${WT}"
git branch -d "${BRANCH}"
```

主 checkout 在別的分支時，`-d` 會警告「not yet merged to HEAD」但仍會刪除，因為分支已併進對應的遠端分支；這不是錯誤。`.claude/worktrees/` 裡其他 session 的 `agent-*` worktree 不是本 skill 開的，不要動。`-d` 真的失敗才代表分支上有沒合併的 commit，停下來看，不要改用 `-D`（`AGENTS.md` Hard Rule 10）。

再比對一次：PR 已合併、但 issue 還開著的，在 issue 上留言指出 PR 後關掉。

## 步驟 10 循環

一波做完就回到步驟 1。每一波結束時，逐條寫出下面三個停止條件是否成立，並附上證據：

1. 沒有可以派的 Ready issue 了（範圍外的不算）
2. 剩下的候選全部卡在 blocked-by 或「需要裁定」
3. 剛做完的這一波全部失敗

任何一條成立就停下來，並回報總結。只寫進度摘要不夠：換到別的 session 時，要靠這三條判斷要不要繼續。

要一直跑到條件成立，就搭配 `/goal`；要整天待命等卡片進 Ready，就用不帶間隔的 `/loop`。不要給 `/loop` 固定間隔：一波可能跑得比間隔久，下一次觸發就會重複派工。

## 守則

- **主 session 不 `cd` 進 lead 的 worktree。** 用 `git -C <worktree>`，或子 shell `( cd <worktree> && … )`。
- **lead 之間不互傳訊息協調檔案。** 同一波排的都是不衝突的 issue；需要協調，代表衝突圖錯了，回報給主 session。
- **只寫自己跑過的指令。** 不把 lead 或審查者跑的東西寫成自己跑的。
- **一張 PR 一個目的。** 做不成一個目的的 issue，回報給維護者拆單，不要擴大 PR。
- **合併只用 merge commit。** 後續分支要跟上 `main` 用 `git merge origin/main`，不 rebase，因為 rebase 之後要 force push。

## 看板 ID

| 項目 | ID |
| :--- | :--- |
| Project | `PVT_kwDOEWdNqs4BoCOI` |
| Status 欄位 | `PVTSSF_lADOEWdNqs4BoCOIzhmkHS4` |
| Todo / Ready / In Progress / In Review / Done | `ffb16e90` / `f2fdd464` / `7bd48096` / `bd485826` / `9521793b` |

```bash
ITEM=$(gh project item-list 1 --owner label-suite --limit 400 --format json \
  -q '.items[]|select(.content.number=='"$N"')|.id')
gh project item-edit --project-id PVT_kwDOEWdNqs4BoCOI --id "$ITEM" \
  --field-id PVTSSF_lADOEWdNqs4BoCOIzhmkHS4 --single-select-option-id <選項 ID>
```

## 已知的坑

| 坑 | 防法 |
| :--- | :--- |
| `gh api graphql --paginate` 的游標變數不叫 `$endCursor` 時，每一頁都從頭查，形成無窮迴圈 | 掃描一律用 `scripts/dispatch-scan.sh`；自己寫查詢時變數一定命名為 `$endCursor` |
| 白名單寫 `gh api graphql` 或 `gh pr merge` 的前綴，會連 mutation 和 `--admin`（繞過分支保護）一起放行 | 掃描包成固定查詢的腳本；合併只允許 `--merge`，並在 `deny` 擋掉 `--admin` 與 `--auto` |
| `gh project item-list --format json` 的輸出含控制字元，整份丟給 `jq` 會解析失敗 | 用 `gh` 自己的 `-q` 過濾，不要把輸出接給 `jq` |
| 刪掉的 worktree 路徑殘留在 `~/.notecraft/app-*/.astro/data-store.json` 與 `node_modules/.astro/data-store.json`，之後的 build 會找不到模組 | lead 不跑本機 build；本機要 build 時若遇到，把這兩個快取移開再 build |
| 裁定寫在後面的留言，不在內文 | 步驟 1 讀完整串留言 |
| 合併了但 PR 缺少 `Closes`，issue 留著沒關 | 步驟 9 比對 issue 和 PR |
| `gh pr checks --watch` 在 PR 一個檢查都沒有時也會回 0 | 步驟 7 以四個 job 的名稱與 run 數量為準 |
| lead 的 commit 本文寫成 `**Add**:`（粗體動詞後多冒號），commit-msg hook 擋下（試跑 #453） | 派工 prompt 寫明粗體動詞後直接接說明，不加冒號 |
| ADR 的 lead 會自己補理由與「考慮過的選項」，來源其實沒有（試跑 #453） | 獨立審查第一項就核對每個理由與選項的出處；派工 prompt 寫明「來源沒有的理由不寫」 |
| ADR 編號與個人 repo 的 ADR 編號撞號（本 repo ADR-007 ≠ 個人 repo ADR-007），舊文件裡裸寫的「ADR-007」會變成歧義（試跑 #453） | 動到的文件裡，個人 repo 的 ADR 一律寫成「個人 repo ADR-0xx」 |

## 待決

| # | 問題 | 卡住什麼 | 誰決定 |
| :--- | :--- | :--- | :--- |
| 1 | 產品程式的 SDD change 要怎麼接進來：停點二取消之後，誰歸檔、什麼時候歸檔 | 程式類的派工（`backend/` 出現之後） | 維護者，見 [#464](https://github.com/label-suite/label-suite/issues/464) |

## 附錄：與原 skill 的對照

來源是個人 repo `singyichen/label-suite` 的 `.claude/skills/issue-dispatch/SKILL.md`。

| 原 skill 的做法 | 本 repo | 原因 |
| :--- | :--- | :--- |
| 進度只存在 issue 檢查點留言，加上 HTML 錨點 | 沿用 | 換 session、換電腦都讀得到 |
| 用 issue 編號做撞車檢查 | 沿用 | 本 repo 也有多個 session 同時在做事 |
| 一張 issue 一個 worktree、一個 lead；一波最多 3 張；整波一次派出 | 沿用 | 和 `CLAUDE.md` 的 Subagents 一致 |
| 主 session 先讀 diff；審查者不是寫的人；合併前的四個條件加上 run 數量 | 沿用，job 名稱換成本 repo 的四個 | 都是事實面的檢查 |
| 不用 `git stash`、不 `cd` 進 worktree、用 merge 不用 rebase、拿到 PR 編號當輪就啟動監看 | 沿用 | 原 skill 實際踩過的坑 |
| `agent-ready`／`agent-running`／`blocked` 標籤 | 改成看板的 Ready / In Progress，以及 blocked-by 依賴 | `AGENTS.md`：不用標籤追蹤狀態 |
| 標籤就代表預先授權合併 | 改成卡片在 Ready 就代表授權 | 授權寫在 `AGENTS.md` 的 Dispatch 一條 |
| `senior-qa` 寫 Red、`senior-*` 寫 Green 的 TDD 流程 | 不搬 | 第一版只派文件類，沒有程式可以測 |
| 審查者 `senior-code-reviewer` 或 Codex | 改成新開的 general-purpose，依 `doc-writing` 的清單審查 | 本 repo 沒有審文件的角色；維護者選了 Claude |
| Codex companion 的 Green 與審查 | 不搬 | 本 repo 沒有 `scripts/codex-companion.sh` |
| Playwright port、每波最多兩個完整套件 | 不搬；改成 NoteCraft build 一次只跑一個 | `frontend/`、`e2e/` 還不存在；本 repo 會衝突的是全機共用的 NoteCraft 快取 |
| `specs/STATUS.md`、規格版本號、FR/AC 編號的分配 | 不搬 | 本 repo 沒有這些 |
| OpenSpec 路徑與 MAJOR 停點 | 不搬 | 程式類另外處理，見待決 |
| stacked PR、pre-tool-use hook、`claude-progress.md` 的例外 | 不搬 | 本 repo 都沒有 |
| `pr-flow` 的視覺變更摘要 | 不搬 | 本 repo 沒有 `pr-flow`；改畫面的 issue 本來就不派 |
| 與 `doc-writing` 步驟 6「本機 build 並在瀏覽器看過」的差異 | lead 不跑本機 build，以 CI `docs-site` 為準 | 無人值守時沒有人看瀏覽器，同時 build 也會互相干擾 |
