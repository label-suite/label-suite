# UI Design

本次無 UI 變更。

理由：本 change 只依後端模組替 OpenAPI 操作加上分組（tag），受影響的兩個閱讀入口——後端自帶的 API 文件頁 `/docs`（Swagger UI）與文件站的 API 頁 `/view/diagrams/architecture/api.openapi`——都是開發文件，不是產品畫面，`design/prototype/pages/` 與 `docs/specs/` 都沒有對應頁面。`frontend/` 沒有路由、頁面、元件或狀態異動；重新產生的 `frontend/src/api/generated/` 維持 `operationId` 與 hook 名稱不變，且 `frontend/orval.config.ts` 用的是 `mode: "split"`（不依分組拆檔），產出的檔名與匯入路徑也不變。本次無常駐文件異動。
