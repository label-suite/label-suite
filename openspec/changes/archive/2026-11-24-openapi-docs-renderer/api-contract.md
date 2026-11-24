# API Contract

本次無 API 變更。

沒有新增或修改的端點、request／response 欄位、錯誤碼、角色或遮蔽欄位，operationId 也沒有異動；成功回應 envelope 與 `/api/v1` 前綴不受影響。FastAPI 內建的 `/docs`、`/redoc`、`/openapi.json` 維持現狀。

## 契約檔的呈現（不是端點）

依 issue #572 維護者裁定（2026-11-23），匯出的契約檔 `backend/openapi.json` 除了原位置，另有一份位元組完全相同的副本 `docs/diagrams/architecture/api.openapi.json`，供文件站的 `openapi-renderer` 渲染。副本只是呈現用的複本，內容與契約本身不變；前端 client 仍只由 `backend/openapi.json` 產生。匯出與漂移檢查的做法見 `system-design.md`。

文件站公開這份契約不新增外露：`backend/openapi.json` 本來就在公開 repo（clarification sa-8 結論）。

## 常駐文件異動

本次無常駐文件異動
