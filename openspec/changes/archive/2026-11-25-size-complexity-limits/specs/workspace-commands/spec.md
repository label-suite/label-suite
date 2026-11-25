# Spec Delta

## MODIFIED Requirements

### Requirement: check 遇到探針殘留檔時失敗

`check` 執行前端 lint 之前 SHALL 檢查有沒有被中斷的前端 lint 探針測試留下的探針檔，範圍為 `frontend/src/pages/` 底下任一層的 `boundary-probe.tsx`，以及 `frontend/src/components/boundary-probe.tsx`、`frontend/src/components/size-probe.tsx`、`frontend/src/components/size-probe.test.tsx`；有的話 MUST 以非 0 結束並說明該檔的來源與處理方式，MUST NOT 自動刪除該檔。探針檔 MUST 被版控忽略。

來源：#506 留言（2026-11-21）第 2 點；issue #561 工作項 6；testing-agent-rules T5、T11；system-design D10（#506）；clarification Q10、T1（#561）。

#### Scenario: 偵測到殘留探針檔時失敗且不刪除

- **WHEN** `frontend/src/pages/` 底下存在 `boundary-probe.tsx`，執行 `pnpm run check`
- **THEN** 指令在前端 lint 之前以非 0 結束，訊息指出該檔路徑、說明它是被中斷的測試留下的並請刪除後重跑
- **AND** 該檔仍存在，`git status --porcelain` 不列出它

#### Scenario: 殘留的尺寸探針檔讓 check 在 lint 前失敗且不刪除

- **WHEN** `frontend/src/components/size-probe.tsx` 或 `frontend/src/components/size-probe.test.tsx` 存在，執行 `pnpm run check`
- **THEN** 指令在前端 lint 之前以非 0 結束，訊息指出該檔路徑、說明它是被中斷的測試留下的並請刪除後重跑
- **AND** 該檔仍存在，`git status --porcelain` 不列出它
