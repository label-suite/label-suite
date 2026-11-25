# API Contract

本次無 API 變更。

## 理由

本 change（issue #524）只改 `backend/pyproject.toml` 的 mypy 與 ruff 設定，並修正 `backend/app` 中違反新規則的 docstring。它不新增、不修改、不刪除任何端點、request 或 response 欄位、錯誤碼或 operationId，也不動角色、欄位遮蔽或測試集答案隔離。因此 `docs/diagrams/architecture/error-codes.mdx` 與 `endpoint-authorization.mdx` 不需要改，本次也沒有常駐文件異動。

## 與契約相鄰的限制

FastAPI 會把 router handler 的 docstring 寫成 operation 的 `description`，Pydantic 則把 schema 類別的 docstring 寫成 schema 的 `description`，兩者都會進到 `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json`。所以：

- 實作時如果改到 handler 或 schema 的 docstring，必須跑 `pnpm run api:sync`，並把重新產生的檔案一起提交。不這樣做，CI 的 `api-contract` job 和 `pnpm run check` 第 7 步 `Contract sync` 都會判成漂移。
- 本 change 要改的 docstring 都不在 handler 或 schema 上：依 `clarification.md` 的決議設定，`ruff check .` 只報 `app/core/log_safety.py:11` 的 D301 一處；另依 Q2 把 `app/modules/health/repository.py` 與 `app/modules/health/service.py` 兩個類別的建構參數寫進類別 docstring 的 `Args:`（D107 已忽略，這兩處不是違規）。預期 `openapi.json` 不變。
- docstring 只改 `description` 的文字，不影響欄位、型別、狀態碼或 operationId，所以即使 `openapi.json` 因此重新產生，也不算 BREAKING。
