---
description: 跑一個完整的 SDD change：依 label-suite-sdd schema 產出九份規劃產物、在停點一逐題問完決策，然後接著實作到驗收，停在停點二。
---

# /sdd

一次授權**規劃與實作**，把 `label-suite-sdd` schema 的九份產物與 apply 階段串成一條線。

**這個指令本身就是維護者的授權。** `openspec-propose` 的 planning boundary 服從的是使用者請求所攜帶的授權（它只拒絕讓 `openspec/config.yaml` 代替使用者發授權）；維護者輸入 `/sdd` 就是那個請求。授權範圍與邊界見 `AGENTS.md` §SDD Workflow。

## 開始前先確認

1. **有一張列出工作項的 open issue**（`AGENTS.md` Hard Rule 1）。沒有就停下來，先問要掛哪一張，不要自己開。
2. **不在 `main` 上**（Hard Rule 2）。在 `main` 就先開 `<type>/<short-description>` 分支。
3. `openspec/changes/` 底下**沒有**跟這次重疊的進行中 change（`pnpm exec openspec list`）。
4. 需求依據讀得到：`docs/specs/` 的相關規格頁與 `docs/specs/00-prd.mdx`。引用的規格頁仍標「草稿」或有未決待釐清時**不要停下來問**——把它記進 `system-analysis.md` 的待決問題，停點一一次問完。

## 流程

```text
propose（不停，只在停點一停）
 1  system-analysis.md   sa        待決問題記下來就繼續，不停
 2  system-design.md     sd     ┐  可平行
    ui-design.md         ui-ux  ┘
 3  api-contract.md      sd
 4  proposal.md          planner
 5  clarification.md     主 agent（clarify skill 的關卡模式，十個面向）
      ★停點一★  Q 逐題問維護者；P 直接派原角色回修，不問
 6  specs/ + design.md   planner
 7  tasks.md             planner
 8  design-reviewer 審閱 → planner 回修 → 自動提交

apply（接續，不停）
 9  依 tasks.md 逐群組派工，每群組過檢查才提交
10  code-reviewer 審查 → 實作角色修正
11  acceptance-verifier 驗收，寫 acceptance.md（含人工驗收步驟）
      ★停點二★  交給維護者親自驗

維護者驗完 → /opsx:archive
```

每一步的角色、必讀與自我檢查寫在 `.claude/agents/<role>.md`；派工順序、十個面向與兩個停點寫在 `openspec/config.yaml`。

## 怎麼跑

1. 讀 `openspec/config.yaml` 的 `context`，再跑 `pnpm exec openspec new change <kebab-case 名稱>`（不帶 `--schema` 就走 `label-suite-sdd`；文件或工具類的小 change 可以帶 `--schema spec-driven` 走四份產物的舊流程）。
2. 依 `pnpm exec openspec status --change <name>` 的順序，把每一份派給對應的 agent。**除 `clarification.md` 以外，主 agent 不自己寫規劃產物。**
3. 每一份開寫前跑 `pnpm exec openspec instructions <artifact> --change <name>`，照它給的範本與 `rules.<artifact>` 寫。
4. `proposal.md` 完成後，主 agent 自己執行 `clarify` skill 的關卡模式寫 `clarification.md`，在**停點一**逐題問維護者。
5. Q 全部有決議、P 全部修正之後才產 `specs`、`design`、`tasks`，然後交 `design-reviewer` 審閱。
6. 規劃階段結束時自動提交，**接著進 apply**，不另外問。
7. apply 依 `operations.apply` 的 guidance 走，最後由 `acceptance-verifier` 產出 `acceptance.md`，停在**停點二**。

## 什麼時候照樣停下來

**故障不是關卡，故障照停**（`openspec/config.yaml` 的 `context`）：

- task 描述有歧義，不知道要做什麼
- 實作過程發現規格本身有問題
- 工作超出 `tasks.md` 的範圍
- 指令出錯、檔案讀不到、依賴的前置功能不存在

這些代表規劃錯了，硬推下去只會寫出錯的程式。停下來回報，不要自己補洞。

另外三件**不在 `/sdd` 的授權範圍**，遇到就停下來問：

- 要改 `docs/specs/` 的需求（走 `spec-writing`，而那些頁面由維護者擁有）
- 要改 `docs/specs/00-prd.mdx` 或 `design/prototype/`（任何情況都不在這個 change 裡改；**介面的提案先畫 artifact 給維護者看**）
- 要合併 PR、發版、或關閉 issue

## 參數

`/sdd <需求描述>`。可以附規格編號（例「依規格 06-01」）、文件路徑或 Issue 編號；沒附時由 `sa` 依 `context` 的需求依據順序自己找，找不到就記成待決問題。
