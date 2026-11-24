# Tasks

## 1. 設定與 app factory

- [ ] 1.1 以 TDD 在 `Settings` 新增布林欄位 `API_DOCS_ENABLED`（預設 true），非布林值由 `load_settings` 拒絕且錯誤訊息只含名稱與原因、不含值；測試涵蓋預設值、明確 true／false、非布林值（對應 spec Scenario「API_DOCS_ENABLED 不是布林值時啟動失敗」）。Python 用 uv。[@backend-developer]
- [ ] 1.2 以 TDD 在 `create_app` 依設定在 false 時將 `docs_url`、`redoc_url`、`openapi_url` 設為 `None`；整合測試涵蓋：預設與 true 時四條路由回 200 非 envelope、false 時四條都回 envelope `NOT_FOUND` 404 且與任一不存在路徑的回應形態一致、false 時 `GET /api/v1/health` 仍為 200（對應 spec Scenario「正式層不提供內建 API 文件與介面描述路由」「Lite 層與本機開發維持提供內建 API 文件」「關閉內建文件不影響業務端點」「只設允許來源即可啟動」）。[@backend-developer]
- [ ] 1.3 新增測試證明契約匯出在 `API_DOCS_ENABLED` 為 true 與 false 下位元組相同，且 `paths` 不含四條內建路徑；`PLACEHOLDER_SETTINGS` 不補欄位，若其文件字串與現況不符就同步修正（對應 spec Scenario「契約匯出不受設定影響」）。[@backend-developer]

## 2. 部署傳遞

- [ ] 2.1 `docker-compose.prod.yml` 的後端傳入 `API_DOCS_ENABLED=false`，`.env.example` 加 `API_DOCS_ENABLED` 說明（預設 true、正式層 compose 設 false）；以現有 compose 檢查或新增測試確認（對應 spec Scenario「正式層部署明確關閉內建文件」）。[@backend-developer]

## 3. 契約與驗證

- [ ] 3.1 重新產生 openapi.json 與前端型別並確認與 api-contract 一致：`cd backend && uv run python -m app.scripts.export_openapi && git diff --exit-code -- openapi.json ../docs/diagrams/architecture/api.openapi.json && test -z "$(git status --porcelain -- openapi.json ../docs/diagrams/architecture/api.openapi.json)"`（後端契約與文件站副本一起比對，預期無差異）；`pnpm --filter frontend api:generate` 後 `git diff --exit-code -- frontend/src/api/generated` 無差異。[@backend-developer]
- [ ] 3.2 後端檢查全數通過：`cd backend && uv run pytest`（SQLite，附 skipped 數量）、`TEST_DATABASE_URL=postgresql+asyncpg://... uv run pytest`（PostgreSQL，0 skipped）、`uv run ruff check . && uv run ruff format --check .`、`uv run mypy --strict app`。[@backend-developer]
- [ ] 3.3 校對常駐文件 `docs/diagrams/architecture/backend-modules.mdx`、`endpoint-authorization.mdx` 與實作一致（設定名稱、預設值、四條路徑、404 形態），不一致處依實作修正；`pnpm check:specs` 與 `pnpm exec notecraftapp build docs --rebuild` 通過。[@technical-writer]
