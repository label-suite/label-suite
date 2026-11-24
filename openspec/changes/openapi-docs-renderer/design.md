# Design

## Context

- 現況：匯出指令 `backend/app/scripts/export_openapi.py` 預設只寫 `backend/openapi.json`；CI 的 `api-contract` job 已有「重新匯出後以 `git diff` 與未追蹤檢查比對已提交版本」的做法（`.github/workflows/ci.yml`）。`.notecraft/plugins.json` 目前只有 `er-diagram-renderer` 對應 `**/*.er.json`。
- 約束：`backend/openapi.json` 是 Orval 的輸入、不能搬（issue #572）；前端 client 只由它產生（ADR-003 D6）。
- 無端點、資料表、權限變更，UI 與 API contract 皆「本次無變更」（見 `ui-design.md`、`api-contract.md`）。需求依據與決議見 `proposal.md`、`clarification.md`。

## Goals / Non-Goals

**Goals:**

- 文件站有一頁 API 文件，內容永遠等於匯出的契約。
- 副本與後端那份位元組相同，且手改、漏提交、被刪都會讓 CI 失敗。

**Non-Goals:**

- #547 把常駐文件連到 API 頁的 operation。
- 變更任何端點、欄位或契約內容；變更前端產生 client 的來源。

## Decisions

1. **兩處寫入同一個字串，不事後比對**。`render_openapi` 只渲染一次，同一字串寫兩處，位元組相同由此保證（system-design §分層與類別）。替代方案：寫完再 `cmp`，因為已由構造保證而不採用（clarification sa-6）。
2. **`--output` 只寫該處**。現有測試都用 `--output <tmp_path>` 並斷言目錄內只有該檔；若仍寫副本會改到 repo 內的真檔（clarification Q1；system-design §分層與類別）。替代方案：仍寫副本，被否決。
3. **兩處寫入先寫暫存檔、全部成功才替換**。暫存檔放在各目標同目錄以便原子替換；寫暫存檔階段任一步失敗就刪暫存檔、既有檔案不動、退出碼 1（clarification Q1；system-design §關鍵情境「匯出途中寫入失敗時兩處都不留半成品」）。替代方案：依序直接 `write_text`，會在第二處失敗時留下「只更新一份」的狀態，被否決。
4. **漂移檢查只擴大比對路徑**。重新匯出覆寫兩處後，兩個路徑一起做 `git diff` 與未追蹤檢查；訊息列出落後檔名並提示 `pnpm run api:sync`；不新增 job、不加 `cmp`（clarification sa-6；system-design §關鍵情境「契約副本與後端契約不一致時 CI 失敗」）。`api:sync` 與 CI 匯出指令不改。
5. **API 頁不新增 mdx**。外掛資料檔有自己的路由，頁面為 `/view/diagrams/architecture/api.openapi`，比照 ER 圖；`architecture.mdx` §API 契約 連到它。實際路徑在本機 build 時確認（clarification sa-2）。
6. **副本定位寫進規則文件**。`api-agent-rules` A4 補一句副本是位元組相同複本、不是第四份契約來源、同樣不得手改；A5 檢查方式納入副本（ADR-001 D2）；ADR-003 不動（clarification Q2）。
7. **兩張 PR**。相依套件 PR（`.notecraft/plugins/openapi-renderer/` 加根目錄 `NOTICE`）先合併，其餘為程式 PR 並 `Closes #572`，避免 `plugins.json` 指向未安裝外掛而建置失敗（`spec-migration.mdx` §PR 的變更範圍；clarification sa-1）。
8. **本機檢查同步涵蓋副本**：`scripts/check.mjs` 的 `CONTRACT_PATHS` 納入副本（快照、還原與比對），`scripts/tests/check.test.mjs` 補測試案例；`openspec/config.yaml` 的後端契約漂移指令改為同時比對 `openapi.json` 與 `../docs/diagrams/architecture/api.openapi.json`（路徑相對於 backend/）。這些是本次路徑上的既有檢查，依 ADR-001 D2 同 PR 修正。
9. **格式化**：`.prettierignore` 已整份排除 `docs/`，副本不需另加排除；文件站規格檢查與建置是否掃到資料檔，實作時以 `pnpm check:specs` 與本機 build 實測（clarification sa-5）。

## Risks / Trade-offs

- 外掛設定先於外掛本體合併會使建置失敗：以 PR 合併順序處理（決策 7）。
- 文件站規格檢查或建置可能不接受資料檔：實測失敗屬故障，照停回報，不自行改規則。
- 兩個 `os.replace` 之間並非原子：若第二個替換失敗，第一個目標已被替換。此為殘餘風險，結果是兩份不一致，由 CI 契約漂移檢查抓到（重新匯出後比對）；Scenario 只保證寫暫存檔階段失敗的行為。
- 副本進版控使每次契約變更多一個 diff 檔：換得「文件站內容永遠等於契約」，維護者已裁定接受。
- 暫存檔放同目錄：若程序在替換前被強制終止可能留下暫存檔；一般失敗路徑會清掉。
- 遷移與回滾：無資料表、無 Alembic migration。回滾為還原本 change 的 commit（刪除副本、還原 `plugins.json` 與匯出指令、CI 路徑）；若只回滾程式 PR，相依套件 PR 的外掛本體留著無害。
