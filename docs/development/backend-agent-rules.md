---
title: '後端開發規範'
description: '後端的分層與允許 import、docstring 與指令、session 分離、交易擁有層、SQLAlchemy 專管存取、Alembic 專管 schema、雙資料庫測試、刪除與匿名化、Celery 的界線、設定與 secret。附來源逐條對照。'
category: '開發說明'
tags: [開發說明, Agent, 規範, 後端]
createdAt: '2026-11-10'
updatedAt: '2026-11-10'
---

# 後端開發規範

:badge[Issue #106]{variant="neutral"} :badge[正式開發前]{variant="warning"}

> `AGENTS.md` 是**規則本體**。這一份是後端那一塊的說明，由 `AGENTS.md` 的 Agent Rules Index 指過來。
> 兩邊說法不同時**以 `AGENTS.md` 為準**，並回報給維護者。
> 跨領域的規範（先搜尋再新增、最小變更、衝突處理等）在 [agent-rules.md](agent-rules.md)，這裡不重複。

**`backend/` 目前不存在**，所以下面每一條的「檢查方式」都還沒有自動檢查。標「待建置」就是字面意思：那些檢查要等實際有程式才寫得出來，**不得因為這份文件存在就宣稱架構已被強制**。

技術選型與 ADR 效力在 [architecture.md](architecture.md)：FastAPI、Pydantic v2、SQLAlchemy 2.0（async）、Alembic、Celery、PostgreSQL 16 正式／SQLite Lite。

---

## 規範

每一條交付**適用路徑、禁止事項、正例、反例、例外條件、檢查方式、來源**。

### B1 分層與允許的 import

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/modules/**` |
| **禁止** | Router 直接呼叫 Repository；資料層處理 HTTP（讀 request、回 status code、丟 `HTTPException`）；狀態機的轉移判斷寫在 Router 或 Repository |
| **正例** | `router → service → repository／model`；狀態轉移只在 service，違反時丟 `InvalidTransitionError` |
| **反例** | Router 裡 `await repo.get(...)` 然後自己組回應；Repository 裡 `raise HTTPException(404)` |
| **例外** | 無。唯讀的健康檢查之類不碰業務資料的端點不在此列 |
| **檢查方式** | **待建置**。可用 import linter（例如 `import-linter` 的 layered contract）機械擋住反向 import，但要等 `backend/` 存在 |
| **來源** | **維護者 2026-11-10 裁定模組內分層** `app/modules/<module>/`（一個業務模組一個資料夾，裡面放自己的 router、service、repository 與 schemas），見 [architecture.md](architecture.md)。狀態機只在 service 來自 ADR-022（沿用；它舉的扁平 `app/services/` 路徑已被那次裁定覆寫）。原始 repo `api.md` 的 `app/schemas/` 集中寫法同樣被覆寫 |

**完整的轉移條件以 `docs/specs/` 與 PRD §共用狀態機 為準**，不以 ADR-022 的表為準——那張表帶著個人 repo 的 FR 編號。

### B2 docstring、型別與指令

| | |
| :--- | :--- |
| **適用路徑** | `backend/**` |
| **禁止** | 公開介面缺型別標註；為了讓單次測試通過而放寬型別或驗證；用 `pip`／裸 `python` 跑後端指令 |
| **正例** | `uv run pytest`、`uv run alembic upgrade head`；公開函式有英文 docstring 寫明前提、副作用與例外（`Args:`／`Returns:`／`Raises:`） |
| **反例** | `python -m pytest`；為了讓一個測試過而把參數型別從 `TaskId` 放寬成 `str` |
| **例外** | 私有 helper（`_` 開頭）不強制 docstring，但型別標註仍然要 |
| **檢查方式** | **待建置**。型別可用 `mypy --strict`、docstring 可用 `ruff` 的 `D` 規則；兩者都要等 `backend/` 與它的設定檔 |
| **來源** | 原始 repo `backend.md` §Python Code Style（**沿用**：docstring 英文加完整型別、指令走 `uv run`）。`uv run` 這一條是 [#105](https://github.com/label-suite/label-suite/issues/105) 的來源對照裡標「待採用、歸本張」的那一條，現在落在這裡。相依一律 `uv add` 已在 `AGENTS.md` 硬性規則 3 |

### B3 session 的生命週期

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/**`（含模組內的 Celery 進入點）。**不寫 `backend/worker/`**：`architecture.md` 的 `worker` 是與 `backend` 共用同一個 image 的 container，不是一個目錄；2026-11-10 的裁定給的是 `app/modules/<module>/` |
| **禁止** | 跨請求或跨 task 共用同一個可變 session；把 session 存進模組層的全域變數；在 Celery task 裡用 async engine |
| **正例** | API 用 `db: AsyncSession = Depends(get_db)`，一個請求一個 session；worker 用同步 session，一個 task 一個，結束就關 |
| **反例** | `SESSION = async_session()` 放在 module top-level，所有請求共用；把 `AsyncSession` 當參數塞進 `task.delay(...)` |
| **例外** | 無。例外發生時一律 rollback 並釋放連線，不讓連線留在交易中回到 pool |
| **檢查方式** | **待建置**。整合測試可斷言「請求結束後 pool 的 checked-out 連線回到 0」；需要 `backend/` 的測試 harness |
| **來源** | [architecture.md](architecture.md)：「同一層的 API 與 worker 用不同的驅動，因為 Celery 跑在同步執行緒裡，不能用 async engine」（Lite 用 `sqlite+aiosqlite` / 同步 URL；正式用 `postgresql+asyncpg` / `psycopg2`）。scaffold `database.md` §連線管理 的「透過 DI 取得、不用全域 connection」**沿用原則** |

### B4 交易的擁有層

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/modules/**` |
| **禁止** | Repository 自行 `commit`；在 DB 交易裡做外部網路呼叫；**在交易尚未 commit 前呼叫 `.delay()`／`.apply_async()`**；把「寄完信再 commit」當成預設做法 |
| **正例** | **交易由 service 擁有**：多步寫入在同一個交易內，業務資料與必要稽核一起 commit；外部呼叫（寄信、第三方 API）**與 task 派送**都放在 commit 之後，失敗走補償路徑 |
| **反例** | `repo.create()` 裡面自己 `await session.commit()`，讓上層的交易邊界失效；在交易裡 `await smtp.send()`，把 DB 連線佔住到網路逾時；**交易內就 `score.delay(submission_id)`——worker 搶先查不到那一列** |
| **例外** | 稽核事件若規格要求「即使業務失敗也要留痕」，那一筆走獨立交易，而且要在程式註解寫明為什麼分開 |
| **失敗補償要寫明** | commit 之後的每一個外部動作（寄信、派送 task）都要有**明確的補償路徑**，#106 工作項 4 點名這一點：寄信失敗照[寄信降級的裁定](architecture.md)（連結印在伺服器 log）；**派送失敗**則由該筆資料的狀態欄留在「待派送」，由排程補送或人工重送——不得靜默吞掉 |
| **檢查方式** | **待建置**。可用「Repository 層不得出現 `commit`」的靜態檢查 |
| **來源** | scaffold `database.md` §連線管理 的「多步驟寫入用 `dataSource.transaction`，transaction 內只用 `manager`」**沿用原則**（轉成 SQLAlchemy 的 session 邊界）。**「寄完信再 commit」刻意不採用**——那個順序會讓寄信失敗吃掉已成立的業務結果，#106 工作項 4 明文要求不照搬 |

### B5 資料存取一律走 SQLAlchemy

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/**`、`backend/tests/**` |
| **禁止** | 拼接 SQL 字串；用 `text()` 包一段手寫 SQL 來繞過 ORM |
| **正例** | 查詢、寫入與測試的資料準備都用 SQLAlchemy 的 model 與 select／insert 構造 |
| **反例** | `session.execute(text(f"SELECT * FROM tasks WHERE id = '{task_id}'"))` |
| **例外** | **三種**：(1) Alembic migration 裡的 DDL；(2) schema API 表達不了的 DDL（partial index、extension、RLS 之類）；(3) **migration 內的資料遷移（DML）**。三者都要在該 migration 的 docstring 寫明為什麼只能這樣寫；第 (3) 項另外要寫明**影響的列數量級、能不能重跑、以及怎麼回復**（#106 工作項 5 要求「資料遷移需個別說明」） |
| **檢查方式** | **待建置**。可用「`app/` 底下不得 import `text`」的靜態檢查，migration 目錄排除 |
| **來源** | scaffold `database.md` §ORM 唯一原則（**沿用**，含它的 DDL 例外）；[architecture.md](architecture.md) 的分層表已寫「不寫原生 SQL（migration DDL 例外）」。**#106 工作項 5 另外要求：資料遷移要個別說明，不把 migration 變成任意 SQL 逃生門** |

### B6 schema 只由 Alembic 管

| | |
| :--- | :--- |
| **適用路徑** | `backend/alembic/**`、`backend/app/**/models.py` |
| **禁止** | 任何環境（含 dev、test）用 `create_all` 或自動同步建 schema；改動已部署的 migration |
| **正例** | 每個 migration 都能 `up` 也能 `down`，`down` 精確還原 `up`；提交前在本機跑一次 `upgrade → downgrade → upgrade`；generate 之後讀過產物，確認沒有非預期的 `DROP` |
| **反例** | 測試 fixture 裡 `Base.metadata.create_all(engine)`；直接編輯上一版已部署的 migration 檔 |
| **例外** | **不可逆的變更**（刪欄位、改型別導致資料遺失）允許 `down` 無法完全還原，但要在 migration 的 docstring 寫明不可逆的部分，並經維護者審核 |
| **檢查方式** | **待建置**。CI 可跑 `upgrade → downgrade → upgrade`；`create_all` 可靜態擋 |
| **來源** | scaffold `database.md` §Migration（**沿用**：不用 synchronize、可 up 可 down、已部署凍結、讀過產物）；[architecture.md](architecture.md)「schema 一律走 Alembic migration，不用 `synchronize` 類的自動同步」。**「所有 migration 同時 transaction 加 CONCURRENTLY」這類互相衝突的要求不採用**（#106 工作項 6 明文）——`CREATE INDEX CONCURRENTLY` 不能在交易裡跑，兩個要求放一起必然矛盾 |

### B7 雙資料庫的測試要求

| | |
| :--- | :--- |
| **適用路徑** | `backend/tests/**` |
| **禁止** | 只在 SQLite 上跑過就宣稱 PostgreSQL 通過 |
| **正例** | 兩層都在支援範圍內，所以牽涉下列差異的行為**兩邊都要有測試**：JSON／JSONB 的查詢與索引、約束（partial unique、check、外鍵的 deferrable）、日期與時區、migration 行為、並發寫入 |
| **反例** | 整個測試套件只跑 SQLite，PR 寫「資料層測試通過」 |
| **例外** | 不碰上述差異的純邏輯測試只跑一邊即可 |
| **檢查方式** | **待建置**。CI 要有兩條 job（SQLite 與真 PostgreSQL），而這要等 `backend/` 與 CI 設定 |
| **來源** | ADR-024 資料庫雙層（**沿用**）；[architecture.md](architecture.md) 的兩層表與驅動推導。scaffold `integration-test-http.md` 的「真 Postgres test db」**沿用原則**，但它的 NestJS harness 不轉用（測試分層歸 [#110](https://github.com/label-suite/label-suite/issues/110)） |

### B8 刪除、軟刪除與匿名化

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/modules/**`、`backend/alembic/**` |
| **禁止** | **把「所有 entity 一律軟刪除」當成預設**；對帶答案的歷史資料做 PII 匿名化或單獨刪除 |
| **正例** | 每一種資料的刪除語意依**功能規格與 ADR-038** 個別決定。稽核事件列**永遠不刪**，過了最短保留期只能把 PII 欄位墓碑化；帶答案的歷史 JSON 跟著它所屬的資料集版本或 run 存續 |
| **反例** | 新增 entity 時順手繼承一個「含 `deleted_at` 的共用基底」並把查詢預設都加上排除條件——那是把別的專案的預設搬過來，不是本專案的規格 |
| **例外** | 規格明確要求軟刪除的那些資料照做，並在 model 的 docstring 指向該規格 |
| **檢查方式** | **人工／獨立審查**。刪除語意是規格問題，沒有辦法機械判定 |
| **來源** | ADR-038 資料保留、刪除與匿名化（**沿用**）；[architecture.md](architecture.md) 的保留政策列與稽核 append-only。**scaffold `database.md` §軟刪除（鐵律）刻意不採用**——它要求「業務刪除一律 `softDelete()`，禁止 `delete()`」，而 #106 工作項 8 明文要求不套用「所有 entity 一律軟刪除」 |

### B9 Celery 的界線

| | |
| :--- | :--- |
| **適用路徑** | 模組內的 Celery task 定義（依裁定落在 `app/modules/<module>/`）與所有 `.delay()`／`.apply_async()` 的呼叫點 |
| **禁止** | 把 HTTP 物件（request、response、`UploadFile`）或 DB session 塞進 task 參數；無界重試；task 的結果與失敗狀態不落地 |
| **正例** | 只傳可序列化的識別資訊（`task_id`、`submission_id`）；task 在自己的行程裡**重新查權限與資料版本**；重試有上限、task 冪等（重跑同一個 task 不會產生第二筆結果）；結果與失敗狀態寫進資料庫 |
| **反例** | `score.delay(submission=upload_file, db=session)`；`autoretry_for=(Exception,)` 不設 `max_retries` |
| **例外** | Celery 只用於**長時間工作**（評分、IAA 計算、匯出）走 `scoring` 佇列；雜務走 `default`（`architecture.md`）。既定的界線也在那裡：**最多重試三次、退避 60／180／540 秒、單一評分工作硬上限 300 秒、結果在 result backend 留 24 小時**（ADR-007）——「重試有界」就是指這組數字，不要另訂 |
| **檢查方式** | **待建置**。「task 參數只能是基本型別」可用靜態檢查；冪等性要靠測試（重跑同一個 task 斷言只有一筆結果） |
| **來源** | ADR-007 Celery（**沿用**）；[architecture.md](architecture.md) 的 Celery 分層列（「不處理 HTTP、不回傳使用者可見訊息」）與評分流程圖。**「重新查權限」這一條與授權規範相接**，授權本身歸 [#107](https://github.com/label-suite/label-suite/issues/107) |

### B10 設定與 secret

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/core/config*`、所有讀環境變數的地方 |
| **禁止** | 散落各處 `os.environ[...]`；必要設定缺失時用預設值悄悄啟動；**在未決的情況下自行把密碼或重設連結印出來** |
| **正例** | 設定集中在一個 Pydantic Settings 類別驗證；必要設定缺失**明確失敗**（啟動就報錯，不是第一個請求才爆） |
| **反例** | `SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")`——缺設定時靜默用弱預設值 |
| **例外** | **可選整合的降級要維護者確認**。已確認的一例：`GOOGLE_CLIENT_ID` 沒設定時 SSO 按鈕退回 no-op（ADR-035）；寄信降級的做法由維護者 2026-11-10 裁定為「連結印在伺服器 log，Lite 版的 log 視為敏感」 |
| **檢查方式** | **待建置**。「`app/` 底下除 config 模組外不得 import `os.environ`」可靜態擋 |
| **來源** | `AGENTS.md` 硬性規則 8（祕密只從環境變數）與硬性規則 9（輸入驗證）；ADR-035 Google SSO 可選；維護者 2026-11-10 的寄信降級裁定。**「自行印出密碼或重設連結」是 #106 工作項 10 明文要防的**——降級的做法未決時不自己決定 |

---

## 刻意不採用的來源條文

| 不採用 | 出處 | 為什麼 |
| :--- | :--- | :--- |
| 「業務刪除一律 `softDelete()`，禁止 `delete()`」，以及「新 entity 一律繼承軟刪除基底」 | **scaffold 與 duty-mate 的 `database.md` §軟刪除（兩份都列為鐵律）** | 刪除語意是規格問題。本專案依 ADR-038 與功能規格逐種決定；稽核列永遠不刪、帶答案的歷史不匿名化，兩者都不是「軟刪除」能表達的。**#106 工作項 8 明文點名不套用這一條** |
| 「所有 migration 同時 transaction 加 `CONCURRENTLY`」 | #106 工作項 6 點名的那類要求 | 自相矛盾：`CREATE INDEX CONCURRENTLY` 不能在交易裡執行 |
| 「寄完信再 commit」 | #106 工作項 4 點名 | 寄信失敗會吃掉已成立的業務結果。本專案把外部呼叫放在 commit 之後、失敗走補償 |
| NestJS／TypeORM 的具體寫法（`@InjectRepository`、`dataSource.transaction`、`synchronize: false` 的設定鍵） | scaffold 與 duty-mate 的 `database.md` | 棧不同（本專案是 SQLAlchemy）。**原則沿用、寫法不沿用** |
| 原始 repo `backend.md` 的 Accept-Language 解析長段 | `backend.md` §i18n | 那是實作規格不是規則。i18n 兩層的決定在 ADR-026（沿用），實際的解析行為屬 `docs/specs/` 或該模組的 api-contract，不放進規則文件 |
| 原始 repo `api.md` 的 `app/schemas/`、`backend.md` 的 `app/i18n/zh_TW/` 等集中路徑 | 兩份皆是 | **被 2026-11-10 的模組內分層裁定覆寫** |

---

## 來源對照

### 原始 repo（`singyichen/label-suite@faf83356`）

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `backend.md` §Python Code Style 的 docstring 英文加完整型別 | **沿用** | 成為 B2 |
| `backend.md` 的「指令一律走 `uv run`」 | **沿用** | 成為 B2。這是 #105 標「待採用、歸本張」的那一條 |
| `backend.md` 的「用 pytest 不用 unittest」、「f-string 優先」 | **不在本文件** | 測試框架歸 [#110](https://github.com/label-suite/label-suite/issues/110)；f-string 屬風格，本 repo 未立條文 |
| `backend.md` §i18n 的「訊息字串由後端擁有、不硬寫在 handler」 | **沿用** | ADR-026 沿用；落點是各模組的 api-contract |
| `backend.md` §i18n 的 `app/i18n/zh_TW/` 路徑與 Accept-Language 解析長段 | **改寫／不採用** | 路徑被模組內分層覆寫；解析長段是實作規格，見上表 |
| `api.md` §Design Conventions 的 RESTful 與 `/api/v1/[module]/[resource]` | **沿用** | 前綴 `/api/v1` 已由維護者 2026-11-10 裁定。**API 契約的規範歸 [#108](https://github.com/label-suite/label-suite/issues/108)**，這裡只記對照 |
| `api.md` 的 Pydantic 驗證、不回傳裸 ORM model、`response_model=` 必填 | **沿用** | 歸 [#108](https://github.com/label-suite/label-suite/issues/108) |
| `api.md` 的 `PaginatedResponse[T]` 與 `next_offset` | **沿用** | 與 2026-11-10 的 envelope 裁定同向；細節歸 #108 |
| `api.md` §Status Codes、§Auth & Permissions（含 `403` vs `404`） | **不在本文件** | 授權與資源隱藏歸 [#107](https://github.com/label-suite/label-suite/issues/107) |
| `api.md` §FastAPI Specifics 的 `Depends(get_db)` | **沿用** | 成為 B3 的正例 |
| `api.md` 的 `app/schemas/` 集中路徑 | **改寫** | 被模組內分層覆寫 |

### scaffold（`fullstack-ai-sdd-workflow-scaffold`，本機）

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `database.md` §ORM 唯一原則（含 migration DDL 與 RLS 例外） | **沿用原則** | 成為 B5 |
| `database.md` §Migration 的五條（不用 synchronize、可 up 可 down、已部署凍結、讀過產物、命名有意義） | **沿用原則** | 成為 B6 |
| `database.md` §軟刪除（鐵律） | **不採用** | 見上表 |
| `database.md` §連線管理（DI 取 repository、多步寫入用 transaction） | **沿用原則** | 成為 B3 與 B4 |
| `database.md` 的 TypeORM 具體 API | **不採用** | 棧不同 |
| `integration-test-http.md` 的「真 Postgres test db」 | **沿用原則** | 成為 B7；它的 NestJS harness 歸 #110 |

### duty-mate（`trendlink/duty-mate@c53cc453`，`develop`）

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `database.md` §ORM 唯一原則（鐵律，禁原生 SQL，含測試程式碼同樣適用） | **沿用原則** | 與 B5 同向。它的 TypeORM Schema API 寫法不採用（本專案是 SQLAlchemy），SQLite-only 的前提也不適用——本專案 SQLite 只是 Lite 層，正式是 PostgreSQL |
| `database.md` §Migration 規範（必用 Migration API、冪等性、包含 down） | **沿用原則** | 與 B6 同向 |
| **`database.md` §軟刪除唯一原則（鐵律）**：業務刪除禁用硬刪一律軟刪、查詢預設自動過濾軟刪列、唯一性用 partial unique index 帶 `WHERE deletedAt IS NULL`、**新 entity 一律繼承 `SoftDeletableEntity`** | **不採用** | **這一節是 #106 工作項 8 點名要防的那一條**，而 duty-mate 正是那個「所有 entity 一律軟刪除」的專案。本專案依 ADR-038 與功能規格逐種決定刪除語意，見 B8——它舉的反例就是「新增 entity 時順手繼承一個含 `deleted_at` 的共用基底」 |
| `database.md` §Session / Connection 管理（禁止全域 connection／session、用 DI 管理、每個 request 結束後連線歸還 pool） | **沿用原則** | 與 B3 幾乎逐字同向。它的 `@InjectRepository`／`@InjectDataSource` 寫法不採用 |
| `database.md` 的 E2E 測試帳密與測試清庫例外 | **不在本文件** | 測試歸 [#110](https://github.com/label-suite/label-suite/issues/110)。附帶一提它的「測試清庫允許硬刪」與 B8 不衝突——那不是業務刪除 |
| `command.md`（nest-commander） | **不採用** | 棧不同。本專案的 CLI 若要規範，另案處理 |
| 其餘九份 | **不在本文件** | 見 [agent-rules.md](agent-rules.md) §來源對照 的 duty-mate 一節 |

### starter-kit

**仍然對不上。** #106 點名它的 `backend/architecture.md` 與 `backend/database.md`。維護者 2026-11-10 在 [#105](https://github.com/label-suite/label-suite/issues/105) 已裁定「該來源不存在或已不適用，從工作項移除」——#105 查過 `trendlink` 組織底下所有 repo、個人帳號與本機，`core-principles.md`／`workflow.md` 都不存在；本機唯一叫 starter-kit 的 `whest-starterkit` 是科學計算起始包。

**本張另外實查了一次**（因為 #106 點的是不同檔名，而 `agent-rules.md` 自己記的教訓正是「附帶搜尋清單的否定結論會勸退後面的人再查」）：`trendlink` 組織底下 24 個 repo（含 `backend`、`frontend`、`deid-kit`）的 tree、`singyichen` 的 repo 清單、以及本機 `find ~/project` 找 `backend/architecture.md`／`backend/database.md`，**全部零命中**。查核日期 2026-11-10。

所以這一類沒有對照可做，也不編造。

---

## 變更紀錄

| Issue | 日期 | 變更 |
| :--- | :--- | :--- |
| [#106](https://github.com/label-suite/label-suite/issues/106) | 2026-11-10 | 初版。十條後端規範（各帶適用路徑、禁止、正反例、例外、檢查方式與來源）、六條刻意不採用的來源條文、原始 repo／scaffold／duty-mate 的逐條對照（starter-kit 沿用 #105 的裁定） |
| [#106](https://github.com/label-suite/label-suite/issues/106) | 2026-11-10 | 獨立審查後修五處：**B4 補上 task 派送與 commit 的先後**（工作項 4 的「排程」原本只處理了寄信那一半，而交易內 `.delay()` 是經典的 dual-write 錯誤）；**B5 的例外補第 (3) 項資料遷移**（工作項 5 要求「資料遷移需個別說明」，原本只寫在來源欄）；**`backend/worker/**` 這個路徑是憑空寫的**，全 `docs/` 只有本檔在用，改成裁定的 `app/modules/<module>/`；**duty-mate 的對照補五列**，其中 §軟刪除唯一原則（含「新 entity 一律繼承 `SoftDeletableEntity`」）改標**不採用**——它正是工作項 8 點名的那一條，原本整份被標成「原則沿用」；B9 的「重試有界」接上 `architecture.md` 的既定數字 |
