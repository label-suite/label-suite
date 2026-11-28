# API Contract

本次無 API 變更。

## 理由

- issue #756 交付的是背景工作程序、佇列與共用寄信入口，三者都在後端內部：寄信入口只被其他模組的 service 呼叫，背景工作程序從 Redis 取工作，都不經 HTTP（`system-design.md` §分層與類別）
- 本卡沒有畫面、沒有新的業務動作，不涉及 PRD §權限矩陣（`system-analysis.md` §涉及角色）；會寄信的端點屬於各消費者的 change（#723、#724、#727、#728、#766），由它們各自的 api-contract 定義
- 登入頁設定的 `selfRegistrationEnabled` 仍由同一個「寄信服務有沒有設定」判斷算出；本卡把 `mail_configured()` 的判斷移到 `WorkerSettings`（API 與 worker 共用的設定層），語意改為 `RESEND_API_KEY` 與 `MAIL_FROM` 兩者都設才算「有設定」；只設其中一個在啟動時 `ConfigError`（clarification Q6），不會變成「沒有設定」。回應形狀不變，所以 `account` 模組既有端點的契約不受影響，也不改任何回應
- `openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 不應有任何差異；實作群組最後一個 task 的契約漂移檢查（`uv run python -m app.scripts.export_openapi` 後 `git diff --exit-code`）要通過，用來證明這一點

## 健康檢查的選項（待決 13，已定案）

待決 13 **已定案**：選 **(a) API 的健康檢查不變**，`redis` 與 `worker` 改用各自的容器 healthcheck（clarification「依上游建議定案的技術預設」表「健康檢查（SA 13）」列）；寄件人設定的待決 10 亦已定案（clarification Q6）。下面保留 (b)、(c) 作為未採用選項的紀錄，不需改寫成端點段落，也不需改常駐文件。

| 選項                               | `getHealth`（`GET /api/v1/health`，tag `health`）                                                                                                       | 會不會 BREAKING                                                                                                                                                                 | 常駐文件                                                                                                                      |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- |
| **(a) 不變（已定案）**             | 不變：`data` 只有 `status`、`database`                                                                                                                  | 否                                                                                                                                                                              | 無                                                                                                                            |
| (b) 加查 Redis，連不上回 503       | `data` 加 `queue`（值只有 `ok`）；Redis 連不上或逾時回 `503`，新錯誤碼 `QUEUE_UNAVAILABLE`（訊息鍵 `common.queue_unavailable`，`zh-TW` 與 `en` 同時加） | **行為上是**：欄位是新增的，但 Redis 掛掉時健康檢查從 200 變 503，`frontend` 以 `service_healthy` 等後端，整個網站會起不來或被判為不健康；前端 `/dev/health` 頁的型別要重新產生 | `error-codes.mdx` 加 `QUEUE_UNAVAILABLE` 一列；`endpoint-authorization.mdx` 的 `getHealth` 列改遮蔽欄位說明（回應多 `queue`） |
| (c) 加查 Redis，只回報、不改狀態碼 | `data` 加 `queue`，值 `ok` 或 `unavailable`；Redis 掛掉仍回 200                                                                                         | 否（只新增欄位）；但 `health-check` spec「健康檢查回應不含部署資訊」要重新確認 `queue` 不算部署資訊                                                                             | `endpoint-authorization.mdx` 的 `getHealth` 列改回應欄位說明                                                                  |

三個選項共同的限制：

- 角色不變：刻意公開、未登入也可呼叫（`health-check`「健康檢查刻意公開」）；不加任何認證或授權依賴
- 遮蔽欄位：無；回應不得含 Redis 的位址、版本、佇列長度或 worker 名稱（`health-check`「健康檢查回應不含部署資訊」）
- 測試集答案隔離：無；健康檢查不讀任務、資料集或答案
- 不論哪個選項，API 的健康檢查都**不**回報 worker 是否活著：API 行程要知道 worker 狀態只能經 Celery 的廣播（`inspect ping`），會讓健康檢查的耗時取決於 worker 回應，`health-check`「資料庫連線逾時在時限內回應」的時限就保不住

## 常駐文件異動

本次無常駐文件異動。`docs/diagrams/architecture/error-codes.mdx` 與 `docs/diagrams/architecture/endpoint-authorization.mdx` 因待決 13 已定案為 (a) 而不需改（見上表）。
