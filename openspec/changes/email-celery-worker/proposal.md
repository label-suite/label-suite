# Proposal

## Why

平台目前沒有任何背景工作程序與佇列，也沒有共用的寄信入口。註冊驗證、忘記密碼、換 Email、邀請帳號、任務邀請（#723、#724、#727、#728、#766）與 IAA 背景計算（#767）都要先有這兩樣東西。`AGENTS.md` Size gate「Shared infrastructure first」要求這類多功能共用、尚不存在的基礎建設先獨立開卡，排在第一個消費者之前，所以拆成 issue #756。

本 change 是技術 change，沒有 `docs/specs/` 的規格頁驗收列（spec-migration D4）；需求追溯到 ADR-003、ADR-008 D3、`backend-agent-rules` B3／B4／B9／B10／B12、`security-agent-rules` S9 與 `clarification.md` 的決議。規格頁只用來確認「有設定／沒有設定寄信服務」與「寄不出」對使用者的意義。

## What Changes

依 `system-design.md` §骨架的六個新元件，以及 `clarification.md` Q1–Q8 與技術預設：

- **worker 設定**：設定在 API 與 worker 共用的一層新增 `REDIS_URL`、`MAIL_FROM`、`CELERY_TASK_ALWAYS_EAGER`；`RESEND_API_KEY` 與 `MAIL_FROM` 要一起設或都不設，只設一個就拒絕啟動（Q6）；`DATABASE_URL` 有設時拒絕 eager（技術預設）。worker 不要求 `CORS_ALLOWED_ORIGINS`、`AUTH_SECRET`。「寄信服務有沒有設定」仍只有一個判斷，`selfRegistrationEnabled` 跟著它。
- **Celery app**：佇列只有 `default` 與 `scoring`、只收 JSON、worker 的 log 經既有格式器、broker socket 逾時 2 秒加發送重試上限（Q4）。
- **寄信入口 `app/mail/`**：B12 單一入口清單第 1 項第一次落地。同時提供兩種寄法（Q1）：
  - **當場寄**：只試一次、當場回報「寄出／沒有設定／寄不出」，給 06-01、01-04 用
  - **排入背景**：依 B9 的三次、60／180／540 秒重試，給 01-02、01-03、03-03 用；排不進佇列時丟 `MailQueueUnavailableError`，不自動改成當場寄（Q4）
  - 寄信 task 放在 `app/mail/tasks.py`（Q8）；以既有 `httpx` 呼叫 Resend HTTP API，不新增 SDK（Q7）；每封信帶冪等鍵
  - 沒有設定寄信服務時兩種寄法都不碰佇列與寄信服務；是否記下連結由各功能決定，入口提供專用 logger `app.mail.unsent_link` 這條管道（Q5）
- **worker 組裝點 `app/worker.py`** 與 **`main.py` 接線**。
- **最終失敗只留一行不含內容的 log**，不新增資料表；這是 B9「結果寫進資料庫」與「只傳識別資訊」的例外（Q3）。設定了但寄不出時**不印連結**，回報給呼叫端（Q2）。
- **log 脫敏與 Hard Rule 6**：寄信紀錄只寫 `mailId`、`kind`、次數、結果、固定字彙的原因、`excType`、寄信服務的訊息 id；收件者連網域都不寫（Q5）；`httpx`、`httpcore` 的 logger 固定 `WARNING`。新增兩條 import 契約：router 不得 import `app.mail`、`app.mail` 不得 import `app.modules`；信件參數、內容與 log 不得含測試集答案。
- **兩層編排**：`docker-compose.yml`（Lite）與 `docker-compose.prod.yml`（正式）都新增 `redis` 與 `worker`，都不發布主機埠；`worker` 共用後端 image、`--concurrency 2`、`stop_grace_period` 大於 300 秒、healthcheck 每 30 秒 `inspect ping`，Lite 層掛同一個資料 volume。
- **改寫既有的「不得有 Redis 或 worker」**（**BREAKING**，指既有契約；clarification P1）：
  - `container-runtime`「前端服務是唯一公開入口」的條文與 Scenario
  - `.github/workflows/ci.yml` `compose` job「Assert the structure of both orchestration files」的斷言，並新增 worker `inspect ping` 步驟
  - `docker-compose.prod.yml` 開頭註解
- **本機與 e2e 預設 eager**：`.env.example` 的 Local development 段落設 `CELERY_TASK_ALWAYS_EAGER=true`（`pnpm run dev` 讀它，`scripts/dev.mjs` 不改）；e2e 自起的後端帶 eager；CI 後端 job 不加 Redis。
- **無 API 變更、無 UI 變更、無資料模型異動**（Q3 不新增表；健康檢查不變）。`openapi.json` 不應有差異。

### 必須同步更新的常駐文件

這些文件在規劃階段**沒有**先改（clarification 技術預設 T10），由 apply 的 `[@technical-writer]` task 改，排在實作群組最後一個 task 之前（clarification「交給後續產出」）。

| 文件                                                              | 異動                                                                                                                                                                                                |
| :---------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/diagrams/architecture/backend-modules.mdx`                  | §目錄、§`core/` 各模組、新增「背景工作與寄信」一節、§log 安全規則（刪「寄信失敗把連結印在 log」，改寫成 Q2、Q5）、§設定（三層與新設定列）、§新增業務模組的檢查清單、§測試輔助、§已知限制、§決策紀錄 |
| `docs/development/architecture.mdx`                               | §容器視圖末段（Q1）、§後端分層「Celery task」列、§非同步任務（共用寄信流程落點）、§部署與維運（本機與 CI、寄信、停機）、§決策紀錄                                                                   |
| `docs/development/rules/backend-agent-rules.mdx`                  | B3、B9 適用路徑（Q8）；B4 失敗補償（Q2）；B9 寄信 task 的例外（Q3）；B12 例外欄（P2）與「尚未檢查」第 4 項                                                                                          |
| `docs/development/adr/003-backend-architecture.mdx`               | 加一條「共用基礎建設的 task 落在它的入口套件」（Q8）；D8 不改                                                                                                                                       |
| `docs/development/adr/008-deployment-and-operations.mdx` D3       | 指向 Q1 的答案；後果補「設定了但寄失敗不印連結」（Q2）；SDK 那句補現行做法（Q7）                                                                                                                    |
| `docs/development/workflow/local-development.mdx`、`.env.example` | eager 開關、想走真佇列時怎麼起 Redis 與 worker、Windows `--pool=solo`、`MAIL_FROM`                                                                                                                  |

`error-codes.mdx`、`endpoint-authorization.mdx`、`frontend-routes.mdx` 不動（無 API、無錯誤碼、無畫面）。

## Capabilities

依 `clarification.md` 技術預設「capability」列定案。

### New Capabilities

- `mail-delivery`：共用寄信入口的可測行為：當場寄與排入背景兩種寄法、沒有設定時不寄、暫時性與永久性失敗的分類與有界重試、冪等鍵、最終失敗只留 log（B9 例外）、排不進佇列的回報、信件欄位驗證、寄信紀錄的欄位白名單與未寄出連結的專用管道、信件參數與紀錄不含測試集答案、寄信 task 不回查資料。

### Modified Capabilities

- `container-runtime`：「前端服務是唯一公開入口」改為兩層各含 `redis` 與 `worker` 且都不發布主機埠；「Lite 層以預設值起服務」「正式層以 PostgreSQL 起服務」「容器健康檢查」加入新服務；「設定範例檔列出所有設定且不含 secret」加 `REDIS_URL`、`MAIL_FROM`、`CELERY_TASK_ALWAYS_EAGER`；新增 worker 共用 image、停機寬限、Lite 同一個 volume，以及容器不得開 eager 的條文。
- `runtime-config`：「其餘設定都有預設值」加三個新設定；「寄信服務只看有沒有設定」改為金鑰與寄件人全有或全無；新增 eager 只限 Lite、worker 只需要自己的設定、兩層編排把寄信與佇列設定傳進 backend 與 worker。
- `backend-code-boundaries`：入口套件多一個 `mail`、`app/worker.py` 列入入口契約的檢查來源；契約集合由九條變十一條（router 不得 import 寄信入口、寄信入口不得 import 業務模組）。
- `server-logging`：資料庫相關 logger 固定 `WARNING` 的條文擴及對外 HTTP 客戶端；新增 worker 的紀錄走同一個格式器。
- `ci-quality-gates`：`compose` job 的結構斷言、worker `inspect ping` 步驟；`.env.example` 加入容器編排驗證的觸發路徑。
- `workspace-commands`：「dev 起本機前後端開發伺服器」加上以範例檔設定在沒有 Redis 時處理背景工作。
- `e2e-testing`：e2e 自起的後端以 eager 處理背景工作，不需要 Redis。

## Impact

- **後端**：`backend/app/core/config.py`、`core/celery_app.py`（新）、`mail/`（新）、`worker.py`（新）、`main.py`、`core/log_config.py`；`backend/pyproject.toml` 的 import 契約；測試 `tests/unit/import_tree.py`、`test_entry_contracts.py`、`test_dependency_classification.py`、`test_layer_boundaries.py`、`test_config.py`、`test_log_config.py`，與 `tests/support/` 下新增的寄信服務替身（換 `httpx.Client.send`）。
- **相依**：以 `uv add` 新增 `celery`、`redis`（帶入 `kombu`），歸為一般套件（Q7）；不新增寄信 SDK；`pip-audit` 面擴大。
- **部署**：兩份編排檔、`.env.example`、`.github/workflows/ci.yml`、`scripts/ci-changed-paths.mjs`；既有部署者升級後多起兩個容器，`backend` 啟動前多等 `redis` 健康；只設 `RESEND_API_KEY` 沒設 `MAIL_FROM` 的部署升級後會拒絕啟動（**BREAKING**，部署設定層面）。
- **e2e**：`e2e/playwright.config.ts` 的 `webServer.env`。
- **資料庫與 migration**：無。
- **API 與契約**：無；`openapi.json` 與 `api.openapi.json` 不應有差異。
- **依賴本卡的 change**：#723、#724、#727、#728、#766、#767；#726 共用同一個 Redis。#728 要自行在「先 commit 再補償刪除」與援用 B4「預設」例外之間選定（Q1 代價）。
- **風險**：Redis 單實例掉訊息時佇列中的信會遺失（ADR-003 D8 已接受）；一次性連結在 worker 取走前以明文停在 Redis（Q3 已接受）。

## 引用的需求來源

- issue #756 §使用情境、§驗收條件 1–4；issue #753 檢查點 D3；`AGENTS.md` Size gate「Shared infrastructure first」、Hard Rule 6、8、9
- `docs/specs/00-prd.mdx` §系統情境（Resend 列）、§角色清單、§範圍內「帳號」、§跨模組流程 交接 2
- 規格頁（只作消費端行為參照）：01-02 §開啟註冊頁、送出註冊表單、Q10；01-03 §規格 第 7 條、Q5；01-04 §送出新的 Email、Q21–Q23；06-01 §邀請新帳號（E1a、E1b、A1）、§卡控機制、Q6、Q9–Q11；03-03 §成員管理 第 9–11 條、Q50、Q51；07-04 §這一頁定什麼
- ADR-003 D3、D7、D8、D10、D12、D13；ADR-004 D7；ADR-007 D4；ADR-008 D2、D3、D7、D10
- `docs/development/architecture.mdx` §容器視圖、§資料庫雙層、§非同步任務、§部署與維運
- 規則：backend-agent-rules B3、B4、B7、B8、B9、B10、B12；security-agent-rules S6、S9；testing-agent-rules T6
- 既有 spec：container-runtime、runtime-config、backend-code-boundaries、server-logging、ci-quality-gates、workspace-commands、e2e-testing
- `system-analysis.md` 待決 1–17 與兩項需求矛盾、`system-design.md` T1–T11、`clarification.md` Q1–Q8、技術預設、P1–P3

## 待決問題（全部已決議或已定案）

| 原題                                             | 狀態   | 去處                                                   |
| :----------------------------------------------- | :----- | :----------------------------------------------------- |
| 需求矛盾 1（即待決 1）：只排入背景還是當場寄並存 | 已決議 | clarification Q1：兩種並存                             |
| 需求矛盾 2（即待決 7）：寄送失敗印不印連結       | 已決議 | clarification Q2：只有沒設定才印                       |
| 待決 2、3：重試政策、重複寄送                    | 已定案 | clarification 技術預設「重試政策與重複寄送」           |
| 待決 4、T4：最終失敗落點、連結停在 Redis         | 已決議 | clarification Q3                                       |
| 待決 5、T9：dev、CI、e2e 的背景工作              | 已定案 | clarification 技術預設「本機、CI、e2e 的背景工作」     |
| 待決 6：兩層都能跑的範圍                         | 已定案 | clarification 技術預設；同步驅動留給 #767              |
| 待決 8、9、T11：連結由誰印、log 可寫什麼         | 已決議 | clarification Q5                                       |
| 待決 10：寄件人與 Redis 設定                     | 已決議 | clarification Q6                                       |
| 待決 11：語言參數                                | 已定案 | clarification 技術預設：不帶                           |
| 待決 12、T5：排不進佇列                          | 已決議 | clarification Q4                                       |
| 待決 13：健康檢查                                | 已定案 | clarification 技術預設：API 健康檢查不變               |
| 待決 14、T3：SDK 或 `httpx`、套件歸類            | 已決議 | clarification Q7                                       |
| 待決 15：07-04 電子郵件通道                      | 已定案 | clarification 技術預設：單封信設計                     |
| 待決 16：共用寄信流程落點                        | 已定案 | clarification 技術預設：`architecture.mdx` §非同步任務 |
| 待決 17：03-03 缺定義                            | 告知   | clarification §告知；#766 動工前由維護者補             |
| T1                                               | 已決議 | clarification Q8                                       |
| T2、T6、T7、T8、T10                              | 已定案 | clarification 技術預設                                 |
