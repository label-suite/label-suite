## 驗收：prod-hide-api-docs

結論：通過

本次沒有產品畫面變更（沒有新增或修改前端頁面），因此沒有 Playwright E2E；沒有業務端點變更，因此沒有角色、遮蔽欄位、答案隔離的新增面。驗證以真實啟動的 uvicorn 加 HTTP 請求為主。

### Scenario 結果

| Scenario                                | 對應的規格書驗收標準    | 證據                                                                                                                                                                                                                                                        | 結果 |
| :-------------------------------------- | :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 只設允許來源即可啟動                    | runtime-config 預設值   | 在空目錄只設 `CORS_ALLOWED_ORIGINS` 啟動：`/api/v1/health` 200、`data/label_suite.db` 已建立、`/docs` 200                                                                                                                                                   | 通過 |
| API_DOCS_ENABLED 不是布林值時啟動失敗   | runtime-config 啟動驗證 | `API_DOCS_ENABLED=CANARY-maybe` 啟動，exit=1，訊息 `API_DOCS_ENABLED: Input should be a valid boolean, unable to interpret input`，不含 `CANARY-maybe`                                                                                                      | 通過 |
| 正式層不提供內建 API 文件與介面描述路由 | 正式層關閉內建文件      | `API_DOCS_ENABLED=false`：`/docs`、`/docs/oauth2-redirect`、`/redoc`、`/openapi.json` 皆 404，body 為 `{"success":false,"code":"NOT_FOUND",...}`；與 `/no-such-path` 逐字相同（去除 timestamp、traceId 後）；`Accept-Language: en` 亦同形態                 | 通過 |
| Lite 層與本機開發維持提供內建 API 文件  | 本機與 Lite 維持文件    | 不設與設 true 時四條路由皆 200，前三條為 text/html，`/openapi.json` 為文件本體 JSON（無 envelope 外層）                                                                                                                                                     | 通過 |
| 關閉內建文件不影響業務端點              | 業務端點不受影響        | `API_DOCS_ENABLED=false` 時 `GET /api/v1/health` 200，envelope `success:true`                                                                                                                                                                               | 通過 |
| 契約匯出不受設定影響                    | 契約產物穩定            | `API_DOCS_ENABLED=true/false` 各匯出一次，兩份與已提交 `backend/openapi.json` md5 皆為 `8ddf2ad650c4d4f6816055064ff05ea8`；`pnpm api:sync` 後 `backend/openapi.json`、文件站副本、前端產生目錄無差異；`paths` 不含四條內建路徑（grep 為 0）；另有自動化測試 | 通過 |
| 正式層部署明確關閉內建文件              | 正式層 compose          | `docker compose -f docker-compose.prod.yml config` 輸出 `API_DOCS_ENABLED: "false"`；環境同時給 `API_DOCS_ENABLED=true` 仍為 `"false"`；`.env.example` 有說明並指出 prod compose 固定為 false                                                               | 通過 |

spec 沒描述但實作出現的額外行為：無。

### Decision Table

| 輸入 `API_DOCS_ENABLED`  | 路徑             | 預期                    | 實測         | 驗證          |
| :----------------------- | :--------------- | :---------------------- | :----------- | :------------ |
| 未設                     | 四條內建路由     | 200 非 envelope         | 200          | 手動加 pytest |
| true                     | 四條內建路由     | 200 非 envelope         | 200          | 手動加 pytest |
| false                    | 四條內建路由     | 404 NOT_FOUND envelope  | 404          | 手動加 pytest |
| false                    | `/api/v1/health` | 200 envelope            | 200          | 手動加 pytest |
| false                    | `/no-such-path`  | 404，與內建路由形態一致 | 一致         | 手動加 pytest |
| `CANARY-maybe`（非布林） | 啟動             | 拒絕，訊息無值          | exit 1，無值 | 手動加 pytest |
| true／false              | 匯出             | 位元組相同              | 相同         | 手動加 pytest |
| compose 環境給 true      | prod compose     | 仍為 false              | `"false"`    | 手動          |

本變更無系統角色或任務成員身分差異（四條路由本就對任何人開放，沒有授權判定，控制點是路由是否存在）。

### Hard Rule 必驗項

| 規則               | 怎麼驗的                                                                                                             | 結果                   |
| :----------------- | :------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| 5 任務設定驅動     | 本變更不碰任務類型邏輯，只新增一個與任務無關的部署設定；未新增任何以 input_type 或 outputs 分支的程式                | 通過（不適用於新增面） |
| 6 測試集答案不外露 | 四條內建路由只描述端點結構，不含資料；沒有新增標記員能到達的端點；`/openapi.json` 內容與已提交契約相同，不含答案欄位 | 通過                   |

### DoD

| 項目                                                 | 指令與結果                                                                                                         | 結果       |
| :--------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- | :--------- |
| 後端測試 SQLite                                      | `cd backend && uv run pytest -q`：342 passed, 4 skipped（4 筆皆為需要 `TEST_DATABASE_URL` 的 PostgreSQL 專屬測試） | 通過       |
| 後端測試 PostgreSQL                                  | postgres:16 容器，`TEST_DATABASE_URL=postgresql+asyncpg://...`：346 passed, 0 skipped                              | 通過       |
| Alembic upgrade、downgrade base、upgrade：SQLite     | 皆成功                                                                                                             | 通過       |
| Alembic upgrade、downgrade base、upgrade：PostgreSQL | 皆成功                                                                                                             | 通過       |
| ruff                                                 | `ruff check .` 通過；`ruff format --check .`：48 files already formatted                                           | 通過       |
| mypy                                                 | `mypy --strict app`：no issues in 21 source files                                                                  | 通過       |
| 契約無差異                                           | `pnpm api:sync` 後 `git diff --exit-code` 三處皆無差異，`git status` 乾淨                                          | 通過       |
| `pnpm check:specs`                                   | `check-specs: docs OK`                                                                                             | 通過       |
| 後端啟動                                             | uvicorn `--factory` 在三種設定下啟動成功                                                                           | 通過       |
| 前端 build、前端測試、Playwright                     | 本變更未動 `frontend/` 原始碼（只有重新產生的型別，無差異）；無 UI 變更，不適用                                    | 不適用     |
| 文件站建置                                           | 動到 `docs/` 的僅常駐文件校對；依 tasks 3.3 由 CI 驗證，本機未執行                                                 | 由 CI 驗證 |

備註：驗收途中第一次 PostgreSQL 執行，因我自己取的資料庫名稱為單字元 `t`，被 health 回應不含資料庫名稱的既有測試誤判（回應裡的 timestamp 含字母 t）。這是驗收環境的人為設定，與實作無關；改用 `acceptdb` 後全綠。

### 人工驗收步驟（留作紀錄）

1. **啟動**：
   - `cd backend && uv sync`
   - 預設（文件開啟）：`CORS_ALLOWED_ORIGINS=http://localhost:5173 uv run uvicorn app.main:create_app --factory --port 8000`，後端網址 `http://localhost:8000`；不設 `DATABASE_URL` 即走 SQLite。本變更沒有前端畫面，不需啟動前端（前端慣用網址 `http://localhost:5173` 僅作為 CORS 允許來源）。
   - 關閉：同上並加 `API_DOCS_ENABLED=false`，建議改用 `--port 8001`。
2. **身分**：四條內建路由與 health 不需登入，不需要測試帳號。
3. **要點開的網址**：`/docs`、`/docs/oauth2-redirect`、`/redoc`、`/openapi.json`、`/api/v1/health`、`/no-such-path`。
4. **預期**：
   - 預設或 true：前四條 200，前三條是 HTML 頁，`/openapi.json` 是 OpenAPI 文件 JSON（頂層是 `openapi`，不是 `success`）。
   - false：前四條與 `/no-such-path` 皆 404，body 是 `{"success":false,"code":"NOT_FOUND","message":"找不到指定的資源",...}`，不含堆疊或路由資訊；`/api/v1/health` 仍 200，頂層有 `"success":true`。
   - 部署：`POSTGRES_PASSWORD=x CORS_ALLOWED_ORIGINS=http://localhost docker compose -f docker-compose.prod.yml config`，後端環境含 `API_DOCS_ENABLED: "false"`；再加 `API_DOCS_ENABLED=true` 重跑，仍為 `"false"`。
5. **失敗路徑**：`API_DOCS_ENABLED=CANARY-maybe` 啟動，預期立即以非零狀態結束，訊息含 `API_DOCS_ENABLED` 且不出現 `CANARY-maybe`。
6. **收尾**：用 Ctrl+C 結束 uvicorn；預設啟動會在工作目錄建立 `data/label_suite.db`，可在拋棄式目錄執行後刪除該目錄。

### 缺陷

無。
