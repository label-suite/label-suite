# Proposal

## Why

API 契約目前只有 `backend/openapi.json`，要看端點、參數與回應欄位得直接讀 JSON。NoteCraft 官方外掛 `openapi-renderer`（v1.0.0）能把 OpenAPI 3.0／3.1 JSON 渲染成可導覽的 API 文件頁，但它只渲染 `docs/` 底下符合樣式的檔案，而 `backend/openapi.json` 不在 `docs/` 裡，且是 Orval 的輸入，不能搬（issue #572 §使用情境）。維護者 2026-11-23 裁定：匯出指令一次輸出兩處、兩份都進版控且內容完全相同，漂移檢查一起比對，不允許手改副本，使文件站的 API 頁內容永遠等於匯出的契約。

## What Changes

- 安裝 NoteCraft 外掛 `openapi-renderer`，並在外掛設定（`.notecraft/plugins.json`）加入 `**/*.openapi.json`。外掛本體（`.notecraft/plugins/openapi-renderer/`）與根目錄 `NOTICE`（授權交代）是相依套件 PR，須先合併；其餘內容在程式 PR。
- 匯出指令（`backend/app/scripts/export_openapi.py`）不帶 `--output` 時，同一份文字同時寫到 `backend/openapi.json` 與文件站副本 `docs/diagrams/architecture/api.openapi.json`；只渲染一次，兩份位元組相同；測試確認兩份位元組相同。帶 `--output PATH` 時只寫該處、不寫副本。兩處寫入都先寫成同目錄暫存檔，全部成功才替換；任一步失敗就刪掉暫存檔、既有檔案不動、退出碼 1。
- 契約漂移檢查（#506，CI 的 `api-contract` job）把副本納入：重新匯出後，副本或後端那份與已提交版本有任何差異（含手改、漏提交、被刪）即失敗，並列出落後的檔名。不新增 job。
- 文件站出現一頁可瀏覽的 API 文件頁：不新增 mdx 頁，外掛資料檔有自己的路由，頁面是 `/view/diagrams/architecture/api.openapi`（比照 ER 圖的 `/view/diagrams/architecture/database-schema.er`；實際路徑在本機 build 時確認）。
- `docs/development/architecture.mdx` §API 契約 的表加一句說明副本與用途，並連到 `/view/diagrams/architecture/api.openapi`；`docs/diagrams/architecture/backend-modules.mdx`（§目錄、§OpenAPI 匯出與 operationId 檢查）註明副本與 `--output` 行為。
- `docs/development/rules/api-agent-rules.mdx`：A4 補一句「副本是 `openapi.json` 的位元組相同複本，不是第四份契約來源，同樣不得手改」；A5 的檢查方式納入副本（依 ADR-001 D2 同 PR 修正）。ADR-003 不動。
- 本 change 分兩張 PR：相依套件 PR（外掛本體加 `NOTICE`，先合併）與程式 PR（其餘，含 `plugins.json`、匯出指令與測試、CI、文件、副本與本 change 的 openspec 產出，`Closes #572`），依 `spec-migration.mdx` §PR 的變更範圍。
- 前端 client 仍只由 `backend/openapi.json` 產生；副本不是第二個契約來源（ADR-003 D6）。
- 無 **BREAKING**：沒有端點、欄位、錯誤碼、角色、資料表或 migration 變更，UI 與 API contract 皆「本次無變更」。

## Capabilities

### New Capabilities

無。本次不新增 capability：文件站頁面由外掛路由承載、沒有新增 mdx 頁，不產生獨立的行為契約。

### Modified Capabilities

- `api-schema-export`：Requirement「匯出指令不需環境變數與資料庫並產出穩定的檔案」由「預設寫到 `backend/openapi.json`」改為預設同時寫出後端那份與文件站副本、兩份位元組相同；帶 `--output PATH` 只寫該處；兩處寫入先寫暫存檔、全部成功才替換，失敗時既有檔案不動。
- `ci-quality-gates`：Requirement「契約產物不同步時 CI 失敗」納入文件站副本：重新匯出後兩個路徑一起做 `git diff` 與未追蹤檢查，錯誤訊息列出落後的檔名並提示 `pnpm run api:sync`；不另加 `cmp`。

## Impact

- 需求依據：本 change 是技術 change，`docs/specs/` 無對應規格（`docs/specs/index.mdx` 與 `00-prd.mdx` 都不涉及），依 `openspec/config.yaml` context（維護者 2026-11-20 裁定，#503）追溯如下，決議見 `clarification.md`（Q1、Q2、P1、P2）：
  - Issue #572 §維護者裁定（2026-11-23）、§驗收條件；§不在範圍：#547 之後再處理。
  - `docs/development/rules/api-agent-rules.mdx` A4、A5。
  - `docs/development/adr/003-backend-architecture.mdx` D6、D9。
  - `docs/development/architecture.mdx` §API 契約。
  - `docs/development/workflow/spec-migration.mdx` §PR 的變更範圍、D4。
  - `docs/development/notecraft/notecraft-writing.md` §PluginView 與系列。
  - 主規格 `api-schema-export`、`ci-quality-gates`（`frontend-api-codegen` 不改，僅同一 CI job 內運作）。
- 受影響程式與檔案：`backend/app/scripts/export_openapi.py` 與其測試；`.github/workflows/ci.yml` 的 `api-contract` job；`.notecraft/plugins.json` 與外掛本體；新增 `docs/diagrams/architecture/api.openapi.json`；根目錄 `NOTICE`；`architecture.mdx`、`backend-modules.mdx`、`api-agent-rules.mdx`（A4、A5）。`api:sync` 與 CI 的匯出指令不改。
- 不受影響：`create_app`、`app/core/openapi.py`、退出碼與輸出格式（排序 key、縮排 2、結尾換行）、`frontend/`、`design/prototype/`、`docs/specs/`、`00-prd.mdx`。
- 資料與安全：無資料表、無新端點、無新權限；副本與 `backend/openapi.json` 同一份文字，只含契約結構與範例、不含資料，不新增外露（`backend/openapi.json` 本來就在公開 repo，`endpoint-authorization.mdx` 已列各端點角色），Hard Rule 6 無影響。
- 風險：外掛設定指向未安裝的外掛會使建置失敗，故相依套件 PR 先合併；`.prettierignore` 已整份排除 `docs/`，副本不會被格式化，文件站規格檢查與建置是否掃到資料檔，實作時以 `pnpm check:specs` 與本機 build 實測。
