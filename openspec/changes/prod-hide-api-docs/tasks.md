# Tasks

## 1. 設定與 app factory

- [x] 1.1 以 TDD 在 `Settings` 新增布林欄位 `API_DOCS_ENABLED`（預設 true），非布林值由 `load_settings` 拒絕且錯誤訊息只含名稱與原因、不含值；測試涵蓋預設值、明確 true／false、非布林值（對應 spec Scenario「API_DOCS_ENABLED 不是布林值時啟動失敗」）。Python 用 uv。[@backend-developer]
- [x] 1.2 以 TDD 在 `create_app` 依設定在 false 時將 `docs_url`、`redoc_url`、`openapi_url` 設為 `None`；整合測試涵蓋：預設與 true 時四條路由回 200 非 envelope、false 時四條都回 envelope `NOT_FOUND` 404 且與任一不存在路徑的回應形態一致、false 時 `GET /api/v1/health` 仍為 200（對應 spec Scenario「正式層不提供內建 API 文件與介面描述路由」「Lite 層與本機開發維持提供內建 API 文件」「關閉內建文件不影響業務端點」「只設允許來源即可啟動」）。[@backend-developer]
- [x] 1.3 `PLACEHOLDER_SETTINGS` 明確設 `api_docs_enabled=True`；以 TDD 新增測試，經 `main(argv, app_factory=...)` 注入 `api_docs_enabled` 為 true 與 false 的兩個 `Settings`（不用環境變數），證明兩次匯出的 `openapi.json` 與文件站副本位元組相同，且 `paths` 不含四條內建路徑（對應 spec Scenario「契約匯出不受設定影響」）。[@backend-developer]

## 2. 部署傳遞

- [x] 2.1 `docker-compose.prod.yml` 的後端傳入固定值 `API_DOCS_ENABLED: "false"`；`.env.example` 加 `API_DOCS_ENABLED` 說明：預設 true，正式層 compose 把它固定為 false，所以 `.env` 裡的值不影響正式層（不沿用「兩份編排檔都傳入」的措辭）。驗證：`POSTGRES_PASSWORD=x CORS_ALLOWED_ORIGINS=http://localhost docker compose -f docker-compose.prod.yml config` 的後端服務輸出含 `API_DOCS_ENABLED: "false"`；本機沒有 docker 時改以人工檢視檔案並寫進 acceptance 步驟（對應 spec Scenario「正式層部署明確關閉內建文件」）。[@backend-developer]

## 3. 契約與驗證

- [x] 3.1 重新產生 openapi.json 與前端型別並確認與 api-contract 一致：在 repo 根目錄執行 `pnpm api:sync`，再執行 `git diff --exit-code -- backend/openapi.json docs/diagrams/architecture/api.openapi.json frontend/src/api/generated && test -z "$(git status --porcelain -- backend/openapi.json docs/diagrams/architecture/api.openapi.json frontend/src/api/generated)"`（後端契約、文件站副本與前端產生目錄一起比對，預期無差異）。[@backend-developer]
- [x] 3.2 後端檢查全數通過：`cd backend && uv run pytest`（SQLite，附 skipped 數量）、`TEST_DATABASE_URL=postgresql+asyncpg://... uv run pytest`（PostgreSQL，0 skipped）、`uv run ruff check . && uv run ruff format --check .`、`uv run mypy --strict app`。[@backend-developer]
- [ ] 3.3 校對常駐文件 `docs/diagrams/architecture/backend-modules.mdx`、`endpoint-authorization.mdx` 與實作一致（設定名稱、預設值、四條路徑、404 形態），不一致處依實作修正；`pnpm check:specs` 通過；文件站建置不在本機執行，由 CI 驗證。[@technical-writer]
