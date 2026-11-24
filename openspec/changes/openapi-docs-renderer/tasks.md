# Tasks

## 1. 相依套件 PR：安裝外掛本體（獨立 PR，先合併）

此群組是自己的一張 PR，須先於程式 PR 合併（`spec-migration.mdx` §PR 的變更範圍；design 決策 7）；不含 `Closes #572`。

- [ ] 1.1 以 `pnpm exec notecraftapp install-plugin openapi-renderer` 安裝外掛本體到 `.notecraft/plugins/openapi-renderer/`，不改 `.notecraft/plugins.json`；驗證：目錄存在且版本為 store 目前版本，`git status` 只有該目錄與 `NOTICE` 變動 [@technical-writer]
- [ ] 1.2 在根目錄 `NOTICE` 加上該外掛的授權條目；驗證：條目含名稱、版本與授權，格式與既有條目一致 [@technical-writer]

## 2. 程式 PR：匯出指令與副本（`Closes #572`）

- [ ] 2.1 先寫測試再改 `backend/app/scripts/export_openapi.py`：不帶 `--output` 寫 `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 且位元組相同；帶 `--output` 只寫該處；兩處先寫同目錄暫存檔、全部成功才替換、失敗時既有檔案不變且不留暫存檔、退出碼 1；對應 specs `api-schema-export` 的全部 Scenario；驗證：`uv run pytest`（含該測試檔）、`ruff`、`mypy` 通過 [@backend-developer]
- [ ] 2.2 重新匯出並確認與 api-contract 一致：執行 `pnpm run api:sync`；驗證：`backend/openapi.json` 與 `frontend/src/api/generated/` 無差異，新增的 `docs/diagrams/architecture/api.openapi.json` 與 `backend/openapi.json` 位元組相同並一起提交 [@backend-developer]

## 3. 程式 PR：CI 契約漂移檢查

- [ ] 3.1 修改 `.github/workflows/ci.yml` 的 `api-contract` job：`git diff` 與未追蹤檢查的路徑納入 `docs/diagrams/architecture/api.openapi.json`，錯誤訊息列出落後檔名並提示 `pnpm run api:sync`，不新增 job、不加 `cmp`；驗證：本機模擬手改副本、刪除副本後執行該檢查步驟的指令都失敗並列出副本檔名，還原後通過，對應 specs `ci-quality-gates` 的 Scenario [@backend-developer]

## 4. 程式 PR：外掛對應與文件

- [ ] 4.1 在 `.notecraft/plugins.json` 加入 `openapi-renderer` 對應 `**/*.openapi.json`，並在 PR body 列出此處改動；驗證：JSON 合法且 `er-diagram-renderer` 條目不變 [@technical-writer]
- [ ] 4.2 修改 `docs/development/architecture.mdx` §API 契約 的表，加一句副本與用途並連到 `/view/diagrams/architecture/api.openapi`；驗證：`pnpm check:specs` 通過、連結路徑與 4.4 本機 build 一致 [@technical-writer]
- [ ] 4.3 修改 `docs/development/rules/api-agent-rules.mdx`：A4 補一句副本是 `openapi.json` 的位元組相同複本、不是第四份契約來源、同樣不得手改；A5 檢查方式納入副本；ADR-003 不動；同步 `docs/diagrams/architecture/backend-modules.mdx` §目錄與 §OpenAPI 匯出與 operationId 檢查（副本與 `--output` 行為）；驗證：與 specs 用語一致，`pnpm check:specs` 通過 [@technical-writer]
- [ ] 4.4 本機建置文件站一次，開啟 `/view/diagrams/architecture/api.openapi`；驗證：頁面顯示 API 文件，實際路徑與 4.2 的連結一致；若路徑不同則回報並修正連結 [@technical-writer]

## 5. 驗證

- [ ] 5.1 執行 `uv run pytest`、`ruff`、`mypy`、`pnpm run api:sync` 後 `git status` 無未提交變更、`pnpm check:specs`；驗證：全部通過，CI 四個 job 在 PR 上通過 [@backend-developer]
