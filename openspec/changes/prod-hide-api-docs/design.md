# Design

## Context

目前 `Settings`（`app/core/config.py`）只有跨來源設定，`create_app`（`app/main.py`）以 FastAPI 預設建立應用，內建四條文件路由在所有環境都註冊。契約匯出命令（`app.scripts.export_openapi`）以固定的 `PLACEHOLDER_SETTINGS` 直接呼叫 `app.openapi()`，不經 HTTP。`frontend/nginx.conf` 只轉發 `/api/v1/`，後端不對外開連接埠（ADR-008 D1）。決議見 clarification Q1、Q2；動機見 proposal，不在此重述。

## Goals / Non-Goals

**Goals:**

- 以單一布林設定控制四條內建文件路由，預設提供，正式層 compose 明確關閉
- 關閉時回既有 envelope 404，與其他不存在路徑一致
- 契約匯出、CI `api-contract` job、文件站副本位元組不變

**Non-Goals:**

- 認證、授權、CSRF；內建文件路由日後是否要登入
- 修改 `frontend/nginx.conf`（定位為縱深防禦，clarification Q6）
- 新增錯誤碼、自訂處理器、資料模型、前端與 `docs/specs/` 異動

## Decisions

1. **新增 `API_DOCS_ENABLED`，單一預設 true，正式層 compose 明確設 false（方案 A）。** 欄位放在 `Settings`，不放 `DatabaseSettings`（Alembic 不需要）。對應 system-design §分層與類別、§提案：預設值與正式層的決定方式。替代方案：B 預設 false（本機與 `.env.example` 要改為開啟，違反 issue「Lite 與本機維持可用」的最小改動）；C 依 `is_lite()` 自動決定（與 `runtime-config`「層只決定資料庫」衝突）；D 必須明確設定（與「唯一必要設定是允許來源」衝突，且所有直接建 `Settings` 的測試與占位設定都要改）。取捨：非 compose 部署的正式後端若沒設定仍會提供文件，安全性在此依賴部署檔明確設定；以 spec 的部署 Scenario 與 compose 任務顧到。
2. **在 `create_app` 以一個判斷關閉：設定為 false 時 `docs_url`、`redoc_url`、`openapi_url` 傳 `None`。** `/docs/oauth2-redirect` 依附 `docs_url`，隨之不註冊。四條全關（clarification Q2）。對應 system-design §分層與類別設計要點。不寫自訂 Router。
3. **隱藏回應沿用既有 404 處理。** 未註冊路由落入 `register_exception_handlers` 既有的 routing 404 轉換，回 envelope `NOT_FOUND`；不新增錯誤碼，`error-codes.mdx` 不動（api-contract Q7-1）。以測試確認與任一不存在路徑的回應一致。
4. **契約匯出命令只補一個欄位。** 匯出取代的是 `app.openapi()` 本身，不依賴 `/openapi.json` 路由（system-design §關鍵情境「契約匯出不受設定影響」）。`PLACEHOLDER_SETTINGS` 是 `BaseSettings`，沒設的欄位仍會讀環境變數，環境裡的非布林值會讓匯出模組載入時失敗，所以明確設 `api_docs_enabled=True`，這也使其文件字串「每個欄位都明確設定」維持成立（clarification Q5 更正；ADR-001 D2：這是匯出呼叫路徑上本次會碰到的既有描述）。位元組不變以注入兩種 `Settings` 的測試證明，不靠環境變數；另以契約漂移指令（含文件站副本）驗證。
5. **非布林值由既有設定載入拒絕。** 沿用 pydantic-settings 與 `CORS_ALLOW_CREDENTIALS` 的布林解析，失敗走 `load_settings` 的 `ConfigError`，只寫變數名與原因、不印值（B10、S9）。不寫新驗證器。
6. **`runtime-config` 切法：MODIFIED「其餘設定都有預設值」＋ ADDED 一條路由 Requirement。** MODIFIED 保留「唯一必要設定是允許來源」的契約，只把新設定列入預設值清單；路由行為另立 Requirement，避免把行為塞進預設值條文。Purpose 文字不改。
7. **常駐文件已在規劃階段改好**：`backend-modules.mdx`、`endpoint-authorization.mdx`（見 system-design §常駐文件異動、api-contract §常駐文件異動）；apply 階段只校對與實作一致，不重寫。

## Risks / Trade-offs

- 預設 true 使安全性依賴部署設定：以 compose 明確 false、部署 Scenario、`.env.example` 說明降低遺漏風險；日後新增部署形態時需自行設定。
- 隱藏回應與其他 404 不一致的風險：以測試比對任一不存在路徑的回應。
- 匯出位元組若意外改變會讓 CI `api-contract` job 失敗：以契約漂移指令在同一群組驗證。
- 無資料模型異動，無 migration，不需回滾腳本；回滾即還原設定類、`create_app` 判斷與 compose、`.env.example` 的改動（預設 true 下，未設定的環境行為與回滾前相同）。
- 遷移：既有正式層部署更新 compose 後文件路由消失；沒有已知在正式環境取用 `/openapi.json` 的人或工具（前端 client 由提交進 repo 的契約產生，ADR-003 D6）。
