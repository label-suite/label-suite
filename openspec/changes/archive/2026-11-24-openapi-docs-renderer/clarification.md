# Clarification

## 檢查範圍

關卡模式：system-analysis、system-design、ui-design、api-contract、proposal。specs、design、tasks 尚未產生，相關檢查項標「後續產物」。

`sa` 留下 10 個待決問題（system-analysis §待決問題 1–10），逐條處理如下：2 條成為 Q（Q1 對應 sa-3、Q2 對應 sa-4），其餘 8 條已有規則、先例或可查證的事實，寫成結論，不再問維護者。

| sa 待決                | 結論                                                                                                                                                                                                                                                      | 依據                                                                                                                                     |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| 1 PR 拆分              | 拆兩張：外掛本體（`.notecraft/plugins/openapi-renderer/` 加根目錄 `NOTICE`）是相依套件 PR，先合併；其餘（`plugins.json`、匯出指令與測試、CI、文件、副本、本 change 的 openspec 產出）是程式 PR，`Closes #572` 放這張                                      | `spec-migration.mdx` §PR 的變更範圍（維護者 2026-11-11 裁定，判例 #245、#246）；這是既有規則，不是新決定                                 |
| 2 API 頁由哪一頁承載   | 不新增 mdx 頁。外掛資料檔有自己的路由，比照 ER 圖的 `/view/diagrams/architecture/database-schema.er`，副本的頁面是 `/view/diagrams/architecture/api.openapi`；`architecture.mdx` 連到這個路徑                                                             | 既有先例：`docs/specs/` 多頁以 `/view/diagrams/architecture/database-schema.er` 連 ER 圖，沒有承載的 mdx 頁；實際路徑在本機 build 時確認 |
| 5 格式化會不會改寫副本 | 不會：`.prettierignore` 整份排除 `docs/`，副本不需另加排除。文件站的規格檢查與建置會不會掃到資料檔，實作時以 `pnpm check:specs` 與本機 build 實測                                                                                                         | `.prettierignore` 現行內容                                                                                                               |
| 6 漂移檢查口徑         | 採 system-design 的做法：重新匯出覆寫兩處後，兩個路徑一起做 `git diff` 與未追蹤檢查，錯誤訊息列出落後的檔名並提示 `pnpm run api:sync`；不另加 `cmp`。兩份彼此相同由「只渲染一次、同一字串寫兩處」保證，副本被手改、漏提交或被刪都會在重新匯出後表現為差異 | issue #572 驗收條件 3 只要求「不一致時 CI 失敗」，這個做法滿足它，沒有要維護者取捨的地方                                                 |
| 7 外掛相容性           | 官方 store 在目前的 `notecraftapp@1.15.0` 列出 `openapi-renderer` v1.0.0（2026-11-24 以 `notecraftapp install-plugin` 查得）；版本以安裝當下為準，授權交代進 `NOTICE`（見 sa-1）。本機 build 失敗時屬故障，照停                                           | 實際查詢結果                                                                                                                             |
| 8 文件站公開界線       | 不新增外露：`backend/openapi.json` 本來就在公開 repo，`endpoint-authorization.mdx` 已在文件站列出每個端點的角色；副本與後端那份逐位元組相同。Hard Rule 6 的檢查見面向 10                                                                                  | repo 現況                                                                                                                                |
| 9 是否補回維護流程文件 | 不補規格；維持純技術 change。system-analysis 的流程概觀只留在本 change                                                                                                                                                                                    | `openspec/config.yaml` context（技術 change 追溯 ADR 與規則文件）                                                                        |
| 10 `api:sync` 要不要改 | 不改：不帶參數的匯出就寫兩處，`api:sync` 與 CI 的匯出指令維持原樣                                                                                                                                                                                         | system-design §常駐文件異動之後的技術待決                                                                                                |

## 檢查結論

| 面向             | 結論                                                                                                  | 問題數 |
| :--------------- | :---------------------------------------------------------------------------------------------------- | :----- |
| 規格完整性       | 通過（Q1、Q2 已決議）；specs、design、tasks 屬後續產物                                                | 0      |
| API Contract     | 通過：本次無端點、欄位、錯誤碼、權限變更，api-contract 寫明「本次無 API 變更」                        | 0      |
| 邏輯一致性       | 問題（P1、P2）                                                                                        | 2      |
| 可行性           | 通過：外掛在 store 可取得；匯出指令與 CI job 都已存在，只擴充                                         | 0      |
| 邊界情況         | 通過（Q1 已決議：帶 `--output` 只寫該處；兩處寫入失敗都不留半成品）                                   | 0      |
| 跨功能影響       | 通過：不動共用認證、授權、HTTP 邊界、資料庫；前端 client 仍只讀 `backend/openapi.json`                | 0      |
| 可測試性         | 通過：兩份位元組相同、CI 漂移失敗都可用 pytest 與 CI 步驟驗證；Scenario 名稱屬後續產物                | 0      |
| 規格範圍         | 通過：不動 `docs/specs/`、`00-prd.mdx`、`design/prototype/`；#547 的連結留在 #547                     | 0      |
| 任務設定驅動     | 通過：不涉及任務類型                                                                                  | 0      |
| 測試集答案不外露 | 通過：匯出以佔位設定組 app、不連資料庫，副本只有契約結構與範例；標記員能到達的端點與 payload 沒有變化 | 0      |

## 決議（Q）

### Q1. 帶 `--output` 時要不要也寫副本，兩處寫入要不要做到「都不留半成品」

- **來源**：system-analysis §待決問題 3；system-design §分層與類別（`write_outputs`、`main` 的 `--output`）
- **問題**：不帶參數時寫兩處已由 issue 裁定。帶 `--output PATH` 時是只寫該處還是仍寫副本，以及寫第二個檔失敗時第一個檔已被覆寫要不要處理，issue 沒有說。
- **決議**：不帶參數寫兩處（issue 裁定）；帶 `--output PATH` 只寫該處、不寫副本。兩處寫入都先寫成同目錄暫存檔，全部成功才 `os.replace`，任一步失敗就刪掉暫存檔、既有檔案不動、退出碼 1。
- **理由**：現有測試全部用 `--output <tmp_path>` 並斷言 tmp 目錄只出現該檔，帶 `--output` 仍寫副本會讓測試改到 repo 內的真檔；暫存再替換避免只更新其中一份。
- **已回修**：system-design §分層與類別（`write_outputs`、`main` 的 `--output` 去掉「提案」）、§關鍵情境第二張圖；`backend-modules.mdx` §OpenAPI 匯出與 operationId 檢查 補 `--output` 行為；proposal §What Changes
- **日期**：2026-11-24

### Q2. 副本在規則文件裡的定位

- **來源**：system-analysis §待決問題 4、§需求矛盾 2–3；`api-agent-rules` A4、A5；ADR-003 D6、D9
- **問題**：A4 寫「三份契約產物」；副本是第四份產物，還是 `openapi.json` 的呈現複本？issue 只要求改 `architecture.mdx`。A5 的「檢查方式」在本 change 後會變成不完整的描述，依 ADR-001 D2（本次改到的程式路徑上的既有描述錯了就同 PR 修）一定要改；要決定的是 A4 與 ADR-003 要不要一起動。
- **決議**：A4 補一句「副本是 `openapi.json` 的位元組相同複本，不是第四份契約來源，同樣不得手改」；A5 的檢查方式納入副本；ADR-003 不動。
- **理由**：A5 依 ADR-001 D2 本來就要改；A4 補一句避免把副本當成第二個來源（ADR-003 D6 不允許第二份），ADR-003 的決定本身沒變。
- **已回修**：system-analysis §待決問題 4、§需求矛盾 2–3；proposal §Impact（連帶文件：`api-agent-rules` A4、A5，`architecture.mdx` §API 契約）
- **日期**：2026-11-24

## 已修正（P）

| 編號 | 位置                                                               | 問題                                                                 | 修正                                                                                                               |
| :--- | :----------------------------------------------------------------- | :------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| P1   | proposal §What Changes、§Capabilities；system-analysis §待決問題 2 | 把「承載頁面」寫成待決，但先例已定：外掛資料檔有自己的 `/view/` 路由 | 改寫成 sa-2 的結論：不新增 mdx 頁，API 頁路徑 `/view/diagrams/architecture/api.openapi`，`architecture.mdx` 連到它 |
| P2   | proposal §Impact、§待決問題；system-analysis §待決問題 1、5–10     | 已有規則或事實可定的題目仍列為待決                                   | 依本文件「檢查範圍」的表改成結論；proposal 不再列待決問題                                                          |

## 交給後續產出

- PR 拆兩張（sa-1 結論）：tasks 把「安裝外掛本體加 `NOTICE`」獨立成第一個群組，對應先合併的相依套件 PR；其餘群組在第二張 PR。
- spec delta：`api-schema-export`（匯出寫兩處、位元組相同；Q1 的 `--output` 行為與失敗處理）、`ci-quality-gates`（副本納入漂移檢查，錯誤訊息列出落後檔名）。每條 requirement 追溯 issue #572 的裁定與 `api-agent-rules` A5、ADR-003 D6。
- 前端 client 只由 `backend/openapi.json` 產生；不得把副本設為任何工具的輸入。
- `architecture.mdx` §API 契約 加一句副本與用途，連到 `/view/diagrams/architecture/api.openapi`；A4 補一句副本的定位、A5 檢查方式納入副本、ADR-003 不動（Q2）。
- `api-schema-export` 的 Scenario 要涵蓋：預設寫兩處且位元組相同；帶 `--output` 只寫該處；寫入失敗兩處既有檔案不變（Q1）。
- 驗證：pytest（含兩份位元組相同）、ruff、mypy、契約漂移指令、`pnpm check:specs`、本機 build 一次確認 API 頁顯示與實際路徑。
