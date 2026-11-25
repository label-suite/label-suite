# API Contract

本次無 API 變更。安全標頭由公開入口的 Nginx 在傳輸層對所有回應附加，不是 OpenAPI 契約的一部分：不新增或修改任何 `/api/v1` 端點、operationId、request 或 response 欄位、envelope、錯誤碼或授權，`backend/openapi.json` 與前端的 Orval 產物都不變；後端程式不改，實測後端目前也不發任何安全標頭，依 clarification Q6 也不會發（`system-design.md` §實測基線、§分層與類別）。CSP 依 clarification Q2 為強制模式且**不收違規回報**，所以沒有違規回報端點，也沒有 `report-uri`／`report-to`。

本次無常駐文件異動：`error-codes.mdx`、`endpoint-authorization.mdx` 不變。

測試集答案隔離：無新端點、無新回應欄位，標頭不帶任何資料且對所有角色一致；強制模式的 CSP 是 XSS 的第二道防線（`system-design.md` §權限檢查點）。
