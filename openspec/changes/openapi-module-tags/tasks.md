# Tasks

依 `clarification.md` 的決議（Q1、Q2、P1–P9）與 §交給後續產出撰寫。群組順序：先寫規則本文 A1（其他各處都要連到它），再改後端與重產契約，最後同步角色檔與規劃範本。

## 1. 分組規則本文

- [ ] 1.1 在 `docs/development/rules/api-agent-rules.mdx` 的 A1 新增「OpenAPI tag」一段（design D4）：一個後端模組一個 tag、名稱等於 `backend/app/modules/` 下的目錄名、每個 operation 恰好一個且沒有例外（P3）、頂層 `tags` 宣告並附一句非空英文說明（不含內部識別碼、路徑、部署資訊或答案相關內容）、順序照規格章節且 `health` 最後（`account`、`dashboard`、`task`、`dataset`、`admin`、`health`，Q2）、在 `create_app` 掛載時以 `include_router(tags=[...])` 帶上而模組 `APIRouter()` 不寫 tags（P4）、缺 tag／未宣告／空說明由測試擋而名稱對錯由審查把關（P5、P7）、tag 不表達授權邊界（P9）；模組名舉例照 ADR-003 D14（P1）。文件開頭的速查表加一列 tag 指向 A1，§決策紀錄補一列（照常駐文件寫法約束：正文只寫現況、不寫 issue 編號）；驗證：`pnpm check:specs` 與 `pnpm exec notecraftapp build docs --rebuild` 通過，A1 的錨點可被連結 [@technical-writer]

## 2. 後端分組、測試與契約重產

- [ ] 2.1 TDD：先在 `backend/tests/unit/test_openapi.py` 寫測試（design D3），再改 `backend/app/main.py`（design D1、D2）。測試：測試檔內的 helper 列出違規；三個測試函式分別對 `create_app` 組出的 app 驗「每個 operation 恰好一個 tag」「tag 在頂層宣告」「頂層 `description` 去空白後非空」；一個契約測試斷言頂層 `name` 依序為 `account`、`health`，`getHealth` 為 `["health"]`、其餘 7 個 account operation 為 `["account"]`；一組反向測試用測試專用的小型 app 構造漏帶、帶兩個、帶未宣告 tag、空說明四種情況並斷言 helper 回報違規與 method、path（對應 spec 的三個失敗 Scenario）。實作：新增 `OPENAPI_TAGS`（`account`、`health` 兩筆英文說明，措辭照 `api-contract.md` §頂層 `tags` 的限制）傳給 `FastAPI(openapi_tags=...)`，`include_router` 帶 `tags=["account"]`、`tags=["health"]`；`backend/app/modules/*/router.py` 與 `backend/app/core/openapi.py` 不動。驗證：先看到新測試失敗再看到通過；`cd backend && uv run pytest`（附 skipped 數）與 `TEST_DATABASE_URL=postgresql+asyncpg://... uv run pytest`（0 skipped）通過，`uv run ruff check . && uv run ruff format --check .`、`uv run mypy --strict app` 通過 [@backend-developer]
- [ ] 2.2 依實作校正常駐文件 `docs/diagrams/architecture/backend-modules.mdx`（`system-design.md` §常駐文件異動、design D5）：§app factory 與 lifespan 步驟 2 加 `openapi_tags`（宣告順序即顯示順序：照規格章節、`health` 最後）、步驟 6 寫明掛載時以 `include_router(tags=[...])` 帶模組 tag；§OpenAPI 匯出與 operationId 檢查 表格加一列 tag（規則連到 `api-agent-rules.mdx` A1，寫明缺 tag／未宣告／空說明由 `tests/unit/test_openapi.py` 擋、名稱對錯靠審查）；§新增業務模組的檢查清單 加「掛 router 時用 `include_router(tags=["<module>"])` 指定模組 tag，模組的 `APIRouter()` 不寫 tags；在 `openapi_tags` 依規格章節的位置加一筆英文說明」並連到 A1；§決策紀錄 補一列；模組名舉例照 ADR-003 D14；§health、§account 分層表不動。驗證：`pnpm exec notecraftapp build docs --rebuild` 通過，內容與 2.1 的實作一致 [@backend-developer]
- [ ] 2.3 重新產生 openapi.json 與前端型別並確認與 api-contract 一致：`cd backend && uv run python -m app.scripts.export_openapi` 重產 `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json`，再 `pnpm --filter frontend api:generate` 重產 `frontend/src/api/generated/`。確認：兩份 JSON 位元組相同；頂層 `tags` 與每個 operation 的 `tags` 符合 `api-contract.md` §OpenAPI 文件結構；8 個 operationId 不變；前端產物沒有新增或刪除檔案、`useGetHealth`、`getHealth` 等 hook 與型別名稱不變（有任何名稱變動即停下回報）。驗證：契約漂移指令 `cd backend && uv run python -m app.scripts.export_openapi && git diff --exit-code -- openapi.json ../docs/diagrams/architecture/api.openapi.json && test -z "$(git status --porcelain -- openapi.json ../docs/diagrams/architecture/api.openapi.json)"`（提交後）與 `pnpm --filter frontend api:generate && git diff --exit-code -- frontend/src/api/generated && test -z "$(git status --porcelain -- frontend/src/api/generated)"`（提交後）通過；`pnpm --filter frontend lint`、`typecheck`、`test`、`build` 通過 [@backend-developer]

## 3. 角色檔與規劃範本同步（可平行）

每處只寫一句操作性的檢查項並連到 `docs/development/rules/api-agent-rules.mdx` A1，不重寫規則本文（Q1、design D4）；模組名舉例照 ADR-003 D14（P1）。

- [ ] 3.1 `.claude/agents/backend-developer.md`：§API 與 OpenAPI 加「掛 router 時在 `create_app` 用 `include_router(tags=["<module>"])` 指定模組 tag，並在 `openapi_tags` 依規格章節位置加一筆英文說明」，完成檢查清單加一項；驗證：兩處都連到 A1，`pnpm check:specs` 通過 [@technical-writer]
- [ ] 3.2 `.claude/agents/code-reviewer.md`：審查清單在 operationId 項旁加「每個 operation 恰好一個 tag，且 tag 名稱等於所屬模組目錄名」（名稱對錯靠審查，P7）；驗證：該項連到 A1，`pnpm check:specs` 通過 [@technical-writer]
- [ ] 3.3 `.claude/agents/sd.md`：api-contract 寫法在 operationId 條目旁加「每個端點標 tag（模組），值等於所屬 `backend/app/modules/` 目錄名」，自我檢查加一項；驗證：兩處都連到 A1，`pnpm check:specs` 通過 [@technical-writer]
- [ ] 3.4 `openspec/config.yaml` 的 `rules.api-contract` 加一條「端點總覽要有模組（tag）欄，值等於所屬模組目錄名，規則見 api-agent-rules A1」；`openspec/schemas/label-suite-sdd/templates/api-contract.md` 端點總覽表加「模組（tag）」欄、每個端點段落加「模組（tag）」一行；`openspec/schemas/label-suite-sdd/schema.yaml` 的 api-contract instruction 端點欄位清單加 tag（模組）（P2）；驗證：`pnpm exec openspec instructions api-contract --change openapi-module-tags --json` 的輸出含 tag（模組）欄與新規則，`pnpm check:specs` 通過 [@technical-writer]
- [ ] 3.5 `.claude/agents/design-reviewer.md`、`.claude/skills/clarify/SKILL.md`、`.agents/skills/clarify/SKILL.md`：各自的 operationId 檢查項旁加「api-contract 每個端點都標了 tag，且等於所屬模組」；兩份 clarify 副本只在各自的 operationId 檢查項旁插入，不整份同步（design D4）；驗證：三處都連到 A1，`git diff` 只動到這三處，`pnpm check:specs` 通過 [@technical-writer]

## Workflow follow-up

- 驗收時在 `/docs`（Swagger UI，`API_DOCS_ENABLED=true`）與文件站 `/view/diagrams/architecture/api.openapi` 各看一次，確認依模組分組、不再出現 `default`／「未分類」，並在 `acceptance.md` 記錄兩處實際的分組順序；文件站若自行排序記為已知差異（P8）。
- 驗收通過後由 `ops` 執行 `/opsx:archive`，把 `specs/api-schema-export/spec.md` 的 ADDED requirements 同步進主規格，歸檔改動進同一張 PR。
