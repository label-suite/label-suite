# Clarification

## 檢查範圍

關卡模式：system-analysis、system-design、ui-design、api-contract、proposal。specs、design、tasks 尚未產生，相關檢查項標「後續產物」。

`sa` 留下 10 個待決問題（system-analysis §待決問題 Q1–Q10）。Q1、Q2、Q3、Q8 是同一個決定的四個面向，合併成本文件的 Q1；Q4 成為 Q2；其餘五條依規則、既有程式與先例收斂：

| sa 待決                                                 | 結論                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 依據                                                                                                                                   |
| :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| Q1、Q2、Q3、Q8                                          | 見下方 Q1                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 維護者 2026-11-24                                                                                                                      |
| Q4                                                      | 見下方 Q2                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 維護者 2026-11-24                                                                                                                      |
| Q5 匯出與 CI 是否受影響                                 | 不受影響：`export_openapi` 以 `PLACEHOLDER_SETTINGS` 直接呼叫 `app.openapi()` 產生文件，不經 `/openapi.json` 路由。`PLACEHOLDER_SETTINGS` **要明確設 `api_docs_enabled=True`**：它是 `BaseSettings`，沒設的欄位仍會讀環境變數，不補的話環境裡的非布林值會讓匯出模組在載入時失敗，docstring「每個欄位都明確設定」也不再成立（規劃審閱發現，原結論「不必補」更正）。實作以 `app_factory` 注入兩種設定的測試證明 `backend/openapi.json` 與文件站副本位元組不變 | system-design §匯出；`backend/app/scripts/export_openapi.py`                                                                           |
| Q6 觸發前提（nginx 只轉 `/api/v1/`、後端不對外開 port） | 照 issue 做，定位為縱深防禦：正式層的部署方式日後若改變（例如直接開後端 port），文件路由也不會外露。不改 `frontend/nginx.conf`                                                                                                                                                                                                                                                                                                                              | issue #592、archive Q13；`frontend/nginx.conf`、ADR-008 D1                                                                             |
| Q7 隱藏路徑的回應                                       | 路由不註冊，落入既有的 404 處理，回共通 envelope；不新增錯誤碼，不另寫處理器。實作以測試確認                                                                                                                                                                                                                                                                                                                                                                | `backend/app/core/errors.py` 已把路由找不到轉成 envelope 404；api-contract Q7-1                                                        |
| Q9 要不要補 `docs/specs/` 規格                          | 不補：技術 change，依 `openspec/config.yaml` 追溯 issue、archive Q13／N6 與 ADR-008 D1                                                                                                                                                                                                                                                                                                                                                                      | `openspec/config.yaml` context（技術 change 追溯 ADR 與規則文件，維護者 2026-11-20 裁定）                                              |
| Q10 現行文件的過時說法                                  | 本 change 一併修正：`backend-modules.mdx` 的「維持預設開啟」、`endpoint-authorization.mdx` §不在本表的路徑與「尚未開 issue」那列                                                                                                                                                                                                                                                                                                                            | ADR-001 D2（本次改到的路徑上的既有描述錯了就同 PR 修）；`openspec/config.yaml` rules.system-design、rules.api-contract（常駐文件先改） |

## 檢查結論

| 面向             | 結論                                                                        | 問題數 |
| :--------------- | :-------------------------------------------------------------------------- | :----- |
| 規格完整性       | 通過（Q1、Q2 已決議）；specs、design、tasks 屬後續產物                      | 0      |
| API Contract     | 通過：業務端點不變；四條非業務路由依 Q2 在正式層不提供，回既有 envelope 404 | 0      |
| 邏輯一致性       | 通過：sa 的矛盾 1（nginx）以縱深防禦收斂                                    | 0      |
| 可行性           | 通過：只動設定與 app factory，不需新相依                                    | 0      |
| 邊界情況         | 通過：設定值非布林時依既有設定驗證拒絕啟動；後續產物要有 Scenario           | 0      |
| 跨功能影響       | 通過：契約匯出、CI `api-contract` job、#572 文件站副本、前端都不受影響      | 0      |
| 可測試性         | 通過：Lite 與正式層各一個整合測試即可證明；名稱屬後續產物                   | 0      |
| 規格範圍         | 通過：不動 `docs/specs/`、PRD、`design/prototype/`                          | 0      |
| 任務設定驅動     | 通過：不涉及任務類型                                                        | 0      |
| 測試集答案不外露 | 通過：介面描述只有結構，沒有資料；本次是減少外露面                          | 0      |

## 決議（Q）

### Q1. 用什麼開關、預設值是什麼、哪一層關

- **來源**：system-analysis §待決問題 Q1、Q2、Q3、Q8；system-design 方案 A–D
- **問題**：要新增設定還是依資料庫層自動判斷；預設開或關；`runtime-config`「其餘設定都有預設值」要怎麼調整；本機與測試要不要改設定
- **決議**：新增設定 `API_DOCS_ENABLED`，布林，**預設 true**；`docker-compose.prod.yml` 的後端明確設為 `false`；`.env.example` 加說明。`runtime-config` 以 MODIFIED 調整「其餘設定都有預設值」把新設定列入。Lite 層、本機開發與現有測試不用改設定
- **理由**：維持「除了 `CORS_ALLOWED_ORIGINS`，其餘設定都有預設值」；開關不綁在資料庫層上
- **已回修**：system-design 方案 A 定案；proposal
- **日期**：2026-11-24

### Q2. 正式層關掉哪些路徑

- **來源**：system-analysis §待決問題 Q4；api-contract Q4-1／Q4-2
- **問題**：只關文件頁面，還是連介面描述 `/openapi.json` 一起關
- **決議**：**四條全關**：`/docs`、`/docs/oauth2-redirect`、`/redoc`、`/openapi.json`（`API_DOCS_ENABLED=false` 時都不註冊）
- **理由**：契約匯出不經 HTTP 路由，前端執行時不讀 `/openapi.json`
- **已回修**：api-contract Q4-1 定案；system-design
- **日期**：2026-11-24

## 已修正（P）

| 編號 | 位置                                                        | 問題                                                            | 修正                                                                                                    |
| :--- | :---------------------------------------------------------- | :-------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| P1   | system-analysis、system-design、api-contract、proposal      | Q5、Q6、Q7、Q9、Q10 已有規則或程式可收斂，仍列為待決            | 依本文件「檢查範圍」的表改成結論                                                                        |
| P2   | system-design §常駐文件異動、api-contract §常駐文件異動     | 常駐文件異動寫成「待裁定、尚未動手」                            | 依 Q1、Q2、Q10 改寫成確定的異動，並在規劃階段改好 `backend-modules.mdx` 與 `endpoint-authorization.mdx` |
| P3   | clarification §檢查範圍 Q5 列、system-design、design 決策 4 | 原結論「`PLACEHOLDER_SETTINGS` 不必補欄位」有誤（規劃審閱發現） | 改為明確設 `api_docs_enabled=True`，task 1.3 以 `app_factory` 注入設定測試                              |

## 交給後續產出

- spec delta：`runtime-config` MODIFIED「其餘設定都有預設值」，加入 `API_DOCS_ENABLED` 預設 true；新增 Requirement：設為 false 時四條文件路由不提供、回 envelope 404，設為 true 時照常提供。Scenario 涵蓋兩種值、非布林值拒絕啟動，以及契約匯出不受影響。追溯 issue #592、archive Q13、ADR-008 D1
- tasks：設定與 app factory（TDD，Lite 與關閉兩種整合測試）、`docker-compose.prod.yml` 與 `.env.example`、匯出位元組不變的確認、常駐文件
- 驗證照 `openspec/config.yaml` 的後端指令（pytest SQLite 與 PostgreSQL、ruff、mypy、契約漂移含文件站副本）
