## MODIFIED Requirements

### Requirement: dev 起本機前後端開發伺服器

根目錄 SHALL 提供 `pnpm run dev`，在本機（不是容器）同時起後端與前端開發伺服器，並讀取根目錄 `.env`。任一方結束時另一方 MUST 一併結束，指令以先結束那一方的結束碼結束；收到中斷訊號時兩者 MUST 都結束。以設定範例檔複製出的 `.env` 執行時，後端 SHALL 在自己的行程內同步執行背景工作，不需要 Redis 或 worker；`pnpm run dev` MUST NOT 另起 worker。

來源：ADR-003 D7、D8；clarification Q11；email-celery-worker clarification 技術預設「本機、CI、e2e 的背景工作」。

#### Scenario: 起本機開發環境

- **WHEN** 以 `.env.example` 複製出 `.env`，執行 `pnpm run dev`
- **THEN** 後端的 `/api/v1/health` 在 `BACKEND_PORT` 回應 200，前端開發伺服器在 5173 回應 200

#### Scenario: 一方結束時另一方一併結束

- **WHEN** `pnpm run dev` 執行中，後端程序以非 0 結束
- **THEN** 前端開發伺服器也結束，`pnpm run dev` 以後端的結束碼結束

#### Scenario: 中斷時兩者都結束

- **WHEN** `pnpm run dev` 執行中收到 SIGINT
- **THEN** 後端與前端開發伺服器的程序都不再存在

#### Scenario: 以範例檔設定時背景工作不需要 Redis

- **WHEN** 以 `.env.example` 複製出 `.env`，計算 `pnpm run dev` 交給後端程序的環境
- **THEN** 環境中 `CELERY_TASK_ALWAYS_EAGER` 為 `true`
- **AND** `pnpm run dev` 起的程序只有後端與前端開發伺服器兩個，沒有 worker
