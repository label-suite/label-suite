# API Contract

本次無 API 變更。

理由：`db-comment-coverage` 只新增後端測試（`backend/tests/unit/test_db_comments.py`、`backend/tests/integration/test_db_comments_postgres.py`、`backend/tests/support/db_comments.py`）並更新規則文件，不新增、修改或移除任何端點、request／response 欄位、錯誤碼、角色權限或欄位遮蔽，也不動 `openapi.json`。因此沒有端點總覽，`error-codes.mdx` 與 `endpoint-authorization.mdx` 也無需異動（本次無常駐文件異動）。測試集答案隔離：不適用，沒有任何標記員可到達的端點被改動。
