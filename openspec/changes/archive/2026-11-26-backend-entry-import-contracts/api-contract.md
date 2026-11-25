# API Contract

本次無 API 變更。

- 沒有新增、修改或移除任何端點、request 欄位、response 欄位或錯誤碼。本 change 只加後端 import 的機器檢查（`backend/pyproject.toml` 的 import-linter 契約、`backend/tests/unit/` 的測試）與規則文件；`app/` 不動。
- `backend/openapi.json`、`docs/diagrams/architecture/api.openapi.json` 與 `frontend/src/api/generated/`（Orval 的輸出）都不變；`pnpm run api:sync` 後不應有任何 diff，契約漂移檢查維持通過。
- 沒有新的 operationId，也不是 BREAKING；前端沒有受影響處。
- 本次無常駐文件異動：`docs/diagrams/architecture/error-codes.mdx` 與 `docs/diagrams/architecture/endpoint-authorization.mdx` 都不需修改。
- 測試集答案隔離：不適用。本次不新增任何標記員能到達的程式，也不改任何回應。
- 日後入口（寄信、OIDC、目前使用者）落地時才會有 API 變更，屬於各自的功能 change，契約在那時寫。
