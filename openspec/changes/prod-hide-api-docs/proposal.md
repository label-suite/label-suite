# Proposal

## Why

後端目前在所有環境都由 FastAPI 預設提供內建 API 文件頁與介面描述路由（`/docs`、`/redoc`、`/openapi.json`、`/docs/oauth2-redirect`），正式層也不例外，API 結構因此可能被讀到。#506 的 clarification Q13 與 backend-skeleton 的延後項 N6 都判定這件事本次不處理、另開 issue，理由是要關閉就得新增一項設定，牽動主規格 `runtime-config`「其餘設定都有預設值」的契約；本 change 即承接該延後項（issue #592）。

定位為縱深防禦：`frontend/nginx.conf` 目前只轉發 `/api/v1/`，後端也不對外開連接埠（ADR-008 D1），所以現況下文件路徑經前端連接埠拿不到後端文件頁，不是既存外洩。本 change 讓正式層的部署方式日後若改變（例如直接開後端連接埠），文件路由也不會外露；不改 `frontend/nginx.conf`。

## What Changes

- 新增設定 `API_DOCS_ENABLED`（布林，**預設 true**）。設為 `false` 時，`/docs`、`/docs/oauth2-redirect`、`/redoc`、`/openapi.json` 四條內建路由都不提供。
- 路由不提供時，請求落入既有的 404 處理，回共通 envelope 的 `NOT_FOUND`；不新增錯誤碼、不另寫處理器。
- `docker-compose.prod.yml` 的後端明確設 `API_DOCS_ENABLED=false`；`.env.example` 加說明。Lite 層、本機開發與現有測試不需改設定。
- 調整主規格 `runtime-config`：MODIFIED「其餘設定都有預設值」，把新設定列入；新增 Requirement 規範四條路由依設定提供與否。設定值非布林時依既有設定驗證拒絕啟動。
- 契約匯出（`app.scripts.export_openapi`）與 CI `api-contract` job 不受影響：匯出以占位設定直接產生文件，不經 `/openapi.json` 路由；占位設定明確設 `api_docs_enabled=True`（`BaseSettings` 未設的欄位仍會讀環境變數）。實作以注入兩種設定的測試證明 `backend/openapi.json` 與文件站副本位元組不變。
- 常駐文件在本 change 一併修正：`backend-modules.mdx` 的「維持預設開啟」、`endpoint-authorization.mdx` §不在本表的路徑與「尚未開 issue」那列（規劃階段已先改，見 system-design、api-contract §常駐文件異動）。
- 無業務端點異動、無新增 operationId、無 **BREAKING**（預設值維持提供，現有部署不改設定行為不變；正式層 compose 是明確改為不提供）。前端無 UI 變更。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `runtime-config`：MODIFIED「其餘設定都有預設值」加入 `API_DOCS_ENABLED` 預設 true；ADDED 一條 Requirement，規範該設定為 false／true 時四條內建文件路由的提供與否。

## Impact

- 後端：`backend/app/core/config.py`（設定類）、`backend/app/main.py`（`create_app` 組裝）；後端測試（Lite 與關閉兩種整合測試、匯出位元組不變）。
- 部署：`docker-compose.prod.yml`、`.env.example`。
- 常駐文件：`docs/diagrams/architecture/backend-modules.mdx`、`endpoint-authorization.mdx`（`error-codes.mdx` 不新增錯誤碼）。
- 不受影響：`/api/v1` 全部端點、`backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json`、前端與 client 產生、`frontend/nginx.conf`、`docs/specs/`、PRD、`design/prototype/`。

### 引用的需求來源

本次是技術 change，`docs/specs/` 與 PRD 沒有相關需求（不補規格書），依 config context 追溯：

- Issue #592 §修改目的、§預期調整、§承接的延後條文
- `openspec/changes/archive/2026-11-23-infra-compose-e2e-ci/clarification.md` §決議 Q13
- `openspec/changes/archive/2026-11-20-backend-skeleton/clarification.md` 延後項 N6
- `openspec/specs/runtime-config/spec.md`：「其餘設定都有預設值」「允許來源是必要設定且不得含萬用字元」「依有無 DATABASE_URL 選擇資料庫層」
- `docs/diagrams/architecture/endpoint-authorization.mdx` §不在本表的路徑、§已知限制；`backend-modules.mdx` §契約匯出
- `docs/development/rules/api-agent-rules.mdx` A4、A5；ADR-003 D6、D7；ADR-008 D1（ADR-004 已全文掃過，無相關條文，不引用）
- `clarification.md` 決議 Q1（開關、預設值、各層）、Q2（四條全關），與 Q5–Q10 的收斂結論
