---
name: issue-dispatch
description: 掃描 Label Suite 看板上 Ready 的 issue，排出彼此不衝突的波次，用各自獨立 worktree 的 lead 平行處理，經獨立審查、開 PR、CI 通過後由主 session 合併並把卡片移到 Done。派文件、工具、`openspec/` 與產品程式碼的 issue；產品程式碼走 `label-suite-sdd` 的全流程。當使用者說「派工」「跑 Ready 的 issue」「跑一波」「dispatch」，或只給一個 issue 編號要你接著做先前派出去的工作時使用。
---

# Issue Dispatch

狀態只存在兩個地方：看板的 Status 欄，和 issue 上的檢查點留言。不要把進度寫進記憶檔、scratchpad 或任何本機檔案，因為平行的 session 會互相覆蓋，另一台電腦也讀不到。任何 session 只要拿到 issue 編號，讀它最後一則檢查點留言，就能接著做。

卡片進到 Ready，就是維護者對這張 issue 的常設授權：從派工到合併都不再問，見 `AGENTS.md` §Project Board and Dispatch 的 Dispatch 一條。

## 這個 skill 不做的事

- 不把卡片移到 Ready，也不移 Epic 的 Ready。哪張可以做，由 `AGENTS.md` 的 Ready gate 決定。
- 不派範圍外的 issue（見步驟 3），不處理 Critical 或 High 的資安發現。
- 不 commit、不 push 到 `main`，不用 squash 或 rebase 合併。
- 不改 `docs/specs/` 的需求、`docs/specs/00-prd.mdx` 或 `design/prototype/`。
- 對 `openspec/` 的 issue 只改該目錄底下的檔案，不跑 SDD 的角色流程。SDD 的角色流程是給產品程式的 issue 走的，見[步驟 5](#步驟-5-派工) 的 §SDD 類。

## 角色

```
主 session（唯一的排程者、唯一移動卡片到 Done 的人、唯一合併的人）
│  掃描 → 撞車檢查 → 分類 → 排波次（一般派工最多 3 張，SDD 派工一張）
│  一則訊息派出整波的 lead
│
├─ 一般派工：lead（general-purpose，一張 issue 一個，自己的 worktree 與分支）
│    寫文件、跑檢查、commit、push、留檢查點、勾 issue 的工作項
│  └─ 審查者（general-purpose，新開的，沒寫過這份 diff）
│       依 doc-writing 的自我檢查清單審 diff，只回報不修改
│
├─ Epic 結束後：架構審查者（`code-reviewer`，新開的，沒寫過該 Epic 的程式）
│    只回報，由主 session 開彙總 issue，見步驟 7 的 §Epic 結束時的架構審查
│
└─ SDD 派工：沒有 lead。主 session 自己依序派 `.claude/agents/` 的各個角色
     （`sa`→`sd`∥`ui-ux`→…→`code-reviewer`→`acceptance-verifier`→`ops`），
     全部共用一個 issue、一個分支、一個 worktree，見步驟 5 的 §SDD 類
```

- 一般派工的 lead 與審查者都用 `general-purpose`：文件與 `openspec/` 類在 `.claude/agents/` 沒有對應的角色。SDD 派工相反，角色全部來自 `.claude/agents/`，而且審查用 `code-reviewer` 不用 general-purpose。
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

狀態相符、又是產品程式碼的新認領，照[步驟 3](#步驟-3-分類) 的 §產品程式碼單的大小檢查先數大小。

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
| 一般派工 | 只碰 `docs/development/`、`docs/` 其他非規格文件、`.claude/`、`.github/`、`scripts/`、`openspec/`、`AGENTS.md`、`CLAUDE.md` | 進入步驟 4 |
| SDD 派工 | 碰產品程式（`backend/`、`frontend/`、`e2e/`） | 走 `label-suite-sdd` 的全流程，見[步驟 5](#步驟-5-派工) 的 §SDD 類；一波只排一張 |
| 範圍外 | 改 `design/` 底下的檔案（含 `design/prototype/`）、改 `docs/specs/` 的需求或 `00-prd.mdx` | 不留言，寫進波次報告 |
| 需要裁定 | 需求不清、內文和留言不一致、兩種讀法會做出不同的東西、工作項要維護者決定 | 留一則檢查點說明哪裡要決定，卡片移回 Todo，寫進波次報告 |

拿不準屬於哪一類，就當作範圍外——**但碰 `backend/`、`frontend/`、`e2e/` 的一律歸 SDD 派工**，不因為它會改到畫面就改判範圍外。

**實作畫面的 `frontend/` issue 歸 SDD 派工，不是範圍外。** 「範圍外」擋的是改 `design/` 底下那份設計來源，不是擋實作它的程式。畫面改動的那道關卡在 `AGENTS.md` 的 Ready gate——維護者看過 artifact 才移 Ready——卡片已經在 Ready，那道關卡就已經過了；這個 skill 不重判，也不替它畫 artifact。

### 產品程式碼單的大小檢查

SDD 派工的單在**新認領之前**先數大小；已在 In Progress、從檢查點重入的不重數。怎麼數、門檻多少、超過了怎麼拆，都只寫在 `AGENTS.md` §Project Board and Dispatch 的 Size gate 一條，這裡只寫怎麼執行。

單涵蓋整頁規格時，數那一頁 `## 驗收標準` 表格的資料列：

```bash
awk '/^## 驗收標準/{f=1;next} /^## /{f=0} f && /^\| / && !/^\| *:?-/{n++} END{print n-1}' docs/specs/<模組>/<頁面>.mdx
```

定義以 `AGENTS.md` 的 Size gate 為準。`n-1` 扣掉的是表頭；分隔列已由 `:?-` 排除。單只涵蓋頁面的部分章節時（拆出來的子單），數它本文列出的章節或列。

超過門檻就**不認領**：卡片不動、不開 worktree，在單上留一則檢查點（階段寫「超過大小門檻」，列出條目數、門檻與「依 Size gate 拆單後才能派」），寫進波次報告的跳過清單，改做下一張。這張單最新一則 issue-dispatch 檢查點已經是「超過大小門檻」、條目數也相同時，不再留言，只寫進跳過清單，免得每輪都留一則。拆單要先給維護者看過，不在派工裡做。

## 步驟 4 排波次

估每張 issue 會改哪些檔案。兩張改到同一個檔案就算衝突，排進不同波次；估不準的也當作衝突。

一波是衝突圖裡最大的獨立集合，最多 3 張。

**SDD 派工一波只排一張**；一般派工仍照衝突圖，一波最多 3 張。這條限制的是 SDD 那一類的張數，沒有禁止同一波同時帶一般派工。

同一波可以同時寫，但 **NoteCraft 的本機 build 不能同時跑**：快取在全機共用的 `~/.notecraft/`。lead 不跑本機 build，以 CI 的 `docs-site` job 為準；主 session 要在本機看頁面時，一次只 build 一個分支。

派工前，先在對話裡寫出波次報告：候選清單、跳過的和原因、衝突圖、各波的成員。

## 步驟 5 派工

一張 issue 一個 worktree、一個分支、一個 lead。**SDD 派工沒有 lead**，由主 session 自己依序派角色，見下面的 §SDD 類。

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
- 要載入的 skill（文件類是 `doc-writing`；ADR 另外照它的 ADR 一節）。`openspec/` 底下的檔案照 `openspec/config.yaml` 的規則寫，不載入 `doc-writing`；同時改 `docs/` 與 `openspec/` 的 issue，`docs/` 的部分載入 `doc-writing`
- 驗證指令：本 repo 的 `scripts/check-*.mjs` 中跟改動有關的那幾支，以及 `bash scripts/check-commit-msg.sh` 對每個 commit 的檢查；**不跑** `notecraftapp build`
- commit 格式：`AGENTS.md` §Commits，subject 結尾 `(#N)`，trailer 用 lead 自己的模型
- 做完要：push、勾 issue 上完成的工作項、留一則「待審查」檢查點、回報 diff 範圍；**不開 PR**
- 不要用 `git stash`（stash 是全 repo 共用的）；要暫存就做 WIP commit
- 遇到範圍外的錯誤只回報，不擴大範圍；遇到要維護者決定的事就停下來回報，不自己挑

### SDD 類：由主 session 依序派各個角色

產品程式的 issue 走 `label-suite-sdd` 的全流程，和一般派工有三個地方不同。

1. **不交給單一 lead。** subagent 不能再派 subagent，所以 SDD 的各個角色必須由**主 session** 自己依序派出去。
2. **所有角色共用同一個 issue、同一個分支、同一個 worktree。** 不要給 SDD 角色各自的 worktree 或各自的 issue——那條「一張 issue 一個 worktree」是用來拆開不相干的 issue 的，見 `AGENTS.md` §SDD Workflow 的 "The SDD roles share one issue and one branch"。
3. **順序照 `openspec/config.yaml`**，不自己排：

| 階段 | 順序 |
| :--- | :--- |
| 規劃 | `sa` 寫 system-analysis → `sd` 寫 system-design ∥ `ui-ux` 寫 ui-design → `sd` 寫 api-contract → `planner` 寫 proposal → **主 session** 以 `clarify` skill 的關卡模式寫 clarification → `planner` 寫 specs 與 design → `planner` 寫 tasks → `design-reviewer` 審閱、`planner` 回修 |
| 實作 | 依 `tasks.md` 的標記一組一組派給 `backend-developer`／`frontend-developer`／`dba`／`technical-writer`；每完成一組就提交一次，不累積到最後 |
| 收尾 | `code-reviewer` 審查、實作角色修 → `acceptance-verifier` 寫 `acceptance.md` → `ops` 跑 `/opsx:archive`，歸檔 commit push 進**同一張已開的 PR**，然後才走步驟 7 |

PR 的開法照步驟 6，但時機不同：**實作期間就先開**，不等歸檔。`openspec/config.yaml` 要求歸檔改動與程式進同一張 PR，所以 PR 必須在 `ops` 動手之前就存在；開完就把卡片移到 In Review，之後 `code-reviewer`、`acceptance-verifier` 與 `ops` 的 commit 都 push 進它。

驗證指令照 `openspec/config.yaml` 的 `operations.apply.guidance`：動到 `backend/` 或 `frontend/` 時各有自己的 lint、型別、測試與契約漂移檢查，照那裡寫的指令跑。

**後端還沒有 CI job**（屬 [#506](https://github.com/label-suite/label-suite/issues/506)）。在它合併之前，CI 不跑 `pytest`，所以**實作角色的本機測試輸出是唯一證據**：把輸出貼進 PR 的 Test Plan，不要只寫「通過」。步驟 7 的 job 清單不因此放寬——它要求的是**每一個**既有 job 都綠，不是某個數字。

### clarification 有 Q 項時怎麼停

`clarification.md` 沒有 Q 項就一路做到合併，不問。有 Q 項就停，而且停的方式和「需要裁定」那一類不同：

1. 把每一題以檢查點留言貼在 issue 上，格式見下。
2. 卡片**留在 In Progress**，不要移回 Todo——規劃已經做了一半，移回去下一輪會從頭重做。
3. 派工改做別張，不要等在這裡。
4. 維護者在 issue 回覆後，下一輪循環從該檢查點接著做。

每一題三個欄位，題目、選項、建議答案：

```markdown
<!-- issue-dispatch checkpoint -->
### 🤖 issue-dispatch 檢查點：clarification 的 Q 項

- **Q1 <題目>**
  - 選項：A …／B …／C …
  - 建議答案：A，一句理由
- **Q2 <題目>**
  - 選項：…
  - 建議答案：…
- **接續點**：回覆後從 `clarification.md` 的 Q 項回修開始，規劃不重跑
- **分支 · worktree**：`feat/…` · `.claude/worktrees/issue-N-…`
```

**重入時怎麼判斷維護者已經回覆**：找到最後一則 `issue-dispatch` 檢查點，往後讀，三個條件都成立才算已回覆：

1. 留言**不帶**檢查點的 HTML 錨點（那是這個 skill 自己留的）。
2. 留言的 `authorAssociation` 是 `OWNER`、`MEMBER` 或 `COLLABORATOR`。**這個 repo 是公開的**，任何帳號都能在 issue 留言，少了這道門檻，一則外部留言就會被當成裁定帶著跑完實作到合併。
3. 留言逐題回答了，而且對得上題號。

```bash
gh issue view <N> --json comments \
  -q '.comments[] | select(.authorAssociation == "OWNER" or .authorAssociation == "MEMBER" or .authorAssociation == "COLLABORATOR") | "\(.createdAt) \(.author.login): \(.body)"'
```

**身分門檻擋得住外部帳號，擋不住 agent。** agent 是用維護者的帳號留言的（`authorAssociation` 同樣是 `MEMBER`），所以第 2 條只排除外人，不能證明是本人回的。**拿不準就當成還沒回覆**，卡片留在 In Progress，不要往下走。

只有部分題目有答案時，先做答案涵蓋得到的部分，剩下的留一則新檢查點再問；**不要替沒答到的題目挑一個答案**——那是 `AGENTS.md`「Conflicts are not yours to settle」擋的事。

## 步驟 6 審查與開 PR

lead 回報後：

1. 主 session 用 `git -C <worktree> diff origin/main...HEAD` 讀完整個 diff，對照 issue 的工作項。不用 `cd` 進 lead 的 worktree。
2. 另開一個新的審查者。**程式類改派 `code-reviewer`，不用 `doc-writing` 的清單**——它要看的是分層、型別與契約同步，見 `.claude/agents/code-reviewer.md`。文件與 `openspec/` 類用新開的 general-purpose 審查者。prompt 只給 issue 編號、worktree 路徑和「依 `.claude/skills/doc-writing/SKILL.md` 步驟 5 的清單，以及 `AGENTS.md` §Review Guidelines 審查 `origin/main...HEAD`」，不給主 session 自己的看法。`openspec/` 的 diff 改依 `openspec/config.yaml` 的規則，加上 `AGENTS.md` §Review Guidelines 審查，不用 `doc-writing` 的清單；diff 裡 `docs/` 的部分仍用 `doc-writing` 步驟 5。**程式類的 diff 改了 `docs/`（例如常駐文件）時，在 `code-reviewer` 之外再開一個新的 general-purpose 審查者，只對 `docs/` 那部分依 `doc-writing` 步驟 5 的自我檢查清單審查**——`code-reviewer` 不看文件寫法。
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
- `commit-messages`、`docs-site`、`format`、`hooks`、`specs` 五個 job 都在，而且都是 `SUCCESS`（每個 PR 都會跑，缺一個就代表還沒註冊）
- 這個 head SHA 沒有還在 `queued` 或 `in_progress` 的 run：
  `gh run list --branch <branch> --json status,headSha --jq '[.[]|select(.headSha=="<sha>" and .status!="completed")]|length'` 要是 `0`
- 審查已經通過，issue 的工作項和 PR 的 Test Plan 全部勾完。issue 本文要實際查過沒有未勾的項目，`gh issue view <N> --json body -q .body | grep -c -- '- \[ \]'` 要是 `0`；不能只憑 lead 或角色的回報

程式類（SDD 派工）另外要全部成立：

- `code-reviewer` 審查通過，阻斷意見都已修
- `acceptance-verifier` 的 `acceptance.md` 判定通過
- 主 session 自己核對 `acceptance.md`「規格頁驗收標準覆蓋」表上的每個 `#N`：那張 issue 的本文都有 `ops` 寫入的「從 #<本張> 移交的驗收」清單，而且列到表上交給它的每一條。缺了就不合併，交回 `ops` 補
- `ops` 已經跑完 `/opsx:archive`，而且歸檔改動就在**這一張 PR** 裡——`AGENTS.md` §SDD Workflow 要求 main 不留「合併了但還沒歸檔」的 change

程式類 PR 屬 **程式 PR** 這一類，範圍見 [spec-migration.mdx 的 §PR 的變更範圍](../../../docs/development/workflow/spec-migration.mdx)：`backend/`、`frontend/`、`e2e/`，連帶該 change 的 `openspec/changes/<change>/` 與 `openspec/specs/`。逐檔比對照那張表走。

```bash
gh pr merge <pr> --merge
```

合併後確認 issue 已經被 `Closes` 關掉，卡片移到 Done，留「已合併」的檢查點。Epic 的最後一張子 issue 完成時，Epic 也移到 Done，然後照下面的「Epic 結束時的架構審查」跑一次。

CI 紅了就修、再 push，最多兩次。第三次還紅，就留一則附上**原始錯誤輸出**的檢查點，卡片留在 In Review，寫進波次報告，等維護者處理。

### Epic 結束時的架構審查

lint 擋得住單一檔案，擋不住整體慢慢長歪。Epic 移到 Done 之後，對**這個 Epic 動過的程式**做一次審查；Epic 沒有動到 `backend/`、`frontend/`、`e2e/` 的程式就略過（維護者 2026-11-25 確認）。審查不擋 Epic 的 Done。

1. 找出 Epic 的已合併 PR：先列子 issue，再找各自被哪張已合併的 PR 關掉。

   ```bash
   for n in $(gh api repos/label-suite/label-suite/issues/<epic>/sub_issues --paginate -q '.[].number'); do
     gh api graphql -f query='query($n:Int!){repository(owner:"label-suite",name:"label-suite"){issue(number:$n){closedByPullRequestsReferences(first:5,includeClosedPrs:true){nodes{number merged}}}}}' \
       -F n=$n -q '.data.repository.issue.closedByPullRequestsReferences.nodes[]|select(.merged)|.number'
   done
   ```

2. 主 session 新開一個 `code-reviewer`（唯讀，檢查分層與 Hard Rules），它不能寫過這個 Epic 的任何程式。模型依 `CLAUDE.md`：Epic 的 PR 合計 10 個以上檔案用 Opus，否則 Sonnet。
3. 給它三樣輸入：上面 PR 的 diff 與動到的檔案（`gh pr diff`）、`docs/development/adr/`、`docs/development/rules/`。
4. 要它找三類：新舊寫法並存、重複實作、模組之間的互相依賴；另外順手看到的安全問題也要回報。每條發現附檔案與行號、對照的 ADR 或規則、最小的修法。只回報，不改檔案、不開 issue。
5. 主 session 讀完回報，**自己核對**幾條再收（審查者的回報不是證據），然後**先**挑出 Critical 或 High 的安全問題：它們不進任何公開 issue，照 `AGENTS.md` 的 Security findings 回報 `SECURITY ESCALATION REQUIRED`，只寫受影響範圍與緊急程度。
6. 其餘發現開成**一張**彙總 issue：`gh issue create --type Task --label task --project "Label Suite"`，標題 `[Task] <Epic 範圍>: 架構審查發現`，格式照 `.github/issue-templates.md` 的 Task 範本，每條發現一個 checkbox 工作項。建好後若 Status 是空的，用[看板 ID](#看板-id) 的 Todo 選項設成 Todo，由維護者看過再決定哪些拆單；在 Epic 留言連到它。沒有發現就不開，只在 Epic 留一句「架構審查無發現」。

## 步驟 8 檢查點留言

每到一個階段就留一則：派工、待審查、審查結果、PR 已開、已合併、卡住、超過大小門檻（見[步驟 3](#步驟-3-分類) 的 §產品程式碼單的大小檢查），以及 SDD 類的「clarification 的 Q 項」（格式見[步驟 5](#步驟-5-派工)）。

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
| `gh pr checks --watch` 在 PR 一個檢查都沒有時也會回 0 | 步驟 7 以五個 job 的名稱與 run 數量為準 |
| lead 的 commit 本文寫成 `**Add**:`（粗體動詞後多冒號），commit-msg hook 擋下（試跑 #453） | 派工 prompt 寫明粗體動詞後直接接說明，不加冒號 |
| ADR 的 lead 會自己補理由與「考慮過的選項」，來源其實沒有（試跑 #453） | 獨立審查第一項就核對每個理由與選項的出處；派工 prompt 寫明「來源沒有的理由不寫」 |
| ADR 編號與個人 repo 的 ADR 編號撞號（本 repo ADR-007 ≠ 個人 repo ADR-007），舊文件裡裸寫的「ADR-007」會變成歧義（試跑 #453） | 動到的文件裡，個人 repo 的 ADR 一律寫成「個人 repo ADR-0xx」 |

## 決策紀錄

| 日期 | 決策 | 取代了什麼 | 來源 |
| :--- | :--- | :--- | :--- |
| 2026-11-19 | 驗收不再停下來等維護者；`ops` 在合併前跑 `/opsx:archive`，歸檔改動與程式進同一張 PR（[步驟 5](#步驟-5-派工) 的 §SDD 類、[步驟 7](#步驟-7-合併)） | §待決 原本第 1 列：「產品程式的 SDD change 要怎麼接進來：誰歸檔、什麼時候歸檔」 | [#464](https://github.com/label-suite/label-suite/issues/464) |
| 2026-11-20 | 六類 PR 新增**程式 PR**（`backend/`、`frontend/`、`e2e/`，連帶該 change 的 `openspec/` 產出），見 `spec-migration.mdx`；派工範圍加入產品程式碼，走 `label-suite-sdd` 全流程；clarification 有 Q 項就以檢查點留言停在 In Progress，派工改做別張；程式類一波只排一張（[步驟 3](#步驟-3-分類)、[步驟 4](#步驟-4-排波次)、[步驟 5](#步驟-5-派工)） | 「只派文件、工具與 `openspec/` 目錄下的 issue」，以及把產品程式算成範圍外 | [#525](https://github.com/label-suite/label-suite/issues/525) |
| 2026-11-25 | 每個 Epic 移到 Done 之後，對它動過的程式跑一次架構審查：新開的審查者找新舊寫法並存、重複實作、模組互依，結果開成一張彙總 issue（工作項為 checkbox、放 Todo），由維護者決定拆哪些（[步驟 7](#步驟-7-合併) 的 §Epic 結束時的架構審查） | 只靠 lint 與單張 PR 的審查，沒有跨 PR 的整體檢查 | [#564](https://github.com/label-suite/label-suite/issues/564) |
| 2026-11-27 | 合併前核對 issue 本文沒有未勾的項目、程式類核對覆蓋表上每個 `#N` 都有移交清單；程式類 PR 改了 `docs/` 時另以 `doc-writing` 步驟 5 審那一部分（[步驟 6](#步驟-6-審查與開-pr)、[步驟 7](#步驟-7-合併)） | 移交驗收由主 session 合併後臨時補記；程式類 PR 只派 `code-reviewer` | [#744](https://github.com/label-suite/label-suite/issues/744) |
| 2026-11-27 | 產品程式碼單新認領前先數大小，超過 `AGENTS.md` Size gate 的門檻就不認領、留檢查點並跳過（[步驟 3](#步驟-3-分類) 的 §產品程式碼單的大小檢查） | 產品程式碼單不論大小都直接認領，一頁規格一張單、一個 PR | [#753](https://github.com/label-suite/label-suite/issues/753) |

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
| `senior-qa` 寫 Red、`senior-*` 寫 Green 的 TDD 流程 | 不搬 | 本 repo 的程式類走 `label-suite-sdd` 的角色，TDD 寫在 `backend-developer`、`frontend-developer` 各自的角色定義裡，不另設 Red／Green 的分工 |
| 審查者 `senior-code-reviewer` 或 Codex | 改成新開的 general-purpose，依 `doc-writing` 的清單審查 | 本 repo 沒有審文件的角色；維護者選了 Claude |
| Codex companion 的 Green 與審查 | 不搬 | 本 repo 沒有 `scripts/codex-companion.sh` |
| Playwright port、每波最多兩個完整套件 | 不搬；改成 NoteCraft build 一次只跑一個，程式類一波只排一張 | `e2e/` 還不存在（`frontend/` 已落地）；本 repo 會衝突的是全機共用的 NoteCraft 快取 |
| `specs/STATUS.md`、規格版本號、FR/AC 編號的分配 | 不搬 | 本 repo 沒有這些 |
| OpenSpec 路徑與 MAJOR 停點 | 不搬 MAJOR 停點；`openspec/` 目錄的 issue 可派但只改該目錄的檔案、不跑角色流程，產品程式的 issue 才走全流程 | 唯一的人工停點是 clarification 的 Q 項，見[步驟 5](#步驟-5-派工) |
| stacked PR、pre-tool-use hook、`claude-progress.md` 的例外 | 不搬 | 本 repo 都沒有 |
| `pr-flow` 的視覺變更摘要 | 不搬 | 本 repo 沒有 `pr-flow`；改畫面的 issue 本來就不派 |
| 與 `doc-writing` 步驟 6「本機 build 並在瀏覽器看過」的差異 | lead 不跑本機 build，以 CI `docs-site` 為準 | 無人值守時沒有人看瀏覽器，同時 build 也會互相干擾 |
