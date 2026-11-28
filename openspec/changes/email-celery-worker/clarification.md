# Clarification

## 檢查範圍

關卡模式：檢查 `system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md`、`proposal.md` 五份。specs、design、tasks 還沒產生，相關的檢查項標「後續產物」。

## 檢查結論

| 面向             | 結論                                                                                                                                                                                              | 問題數 |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----- |
| 規格完整性       | 待釐清 → 已決議：兩項文件矛盾（Q1、Q2）；本卡是共用基礎建設，不對應規格頁驗收標準列，改追溯 ADR-003、ADR-008 D3、`backend-agent-rules` B3／B4／B9／B10／B12、`security-agent-rules` S9            | 2      |
| API Contract     | 通過：本次無 API 變更；API 健康檢查不變（技術預設 Q13）                                                                                                                                           | 0      |
| 邏輯一致性       | 問題 → 已決議（Q2）：B4、`backend-modules.mdx` 與 ADR-008 D3、06-01 Q9 對「寄送失敗印連結」說法不一                                                                                               | 1      |
| 可行性           | 通過：六個元件的骨架不隨決議改變；eager 模式只在本機與 e2e，`DATABASE_URL` 有設時拒絕開啟                                                                                                         | 0      |
| 邊界情況         | 通過：沒設金鑰、暫時性失敗重試、重試用盡、佇列連不上都有對應路徑（Q3、Q4）                                                                                                                        | 0      |
| 跨功能影響       | 問題 → 已列 P1：`container-runtime` 契約、CI `compose` job 斷言、`docker-compose.prod.yml` 開頭註解三處寫「不得有 Redis 或 worker」，本卡一併改寫；常駐文件未在規劃階段先改（T10），交 tasks 排入 | 1      |
| 可測試性         | 通過：後端測試以 `send_mail.apply()` 加 `httpx` 邊界替身；CI `compose` 只驗 worker `inspect ping`，整封信經佇列的驗證交給第一個消費者的 e2e                                                       | 0      |
| 規格範圍         | 通過：消費者的畫面、訊息、一次性連結、頻率限制都不在本卡；03-03 缺定義的部分留給 #766（告知 Q17）                                                                                                 | 0      |
| 任務設定驅動     | 通過：與任務類型無關                                                                                                                                                                              | 0      |
| 測試集答案不外露 | 通過，交後續產物：worker 是唯一讀測試集答案的程序，信件參數、內容與 log 不得帶答案；新增 import 契約「`app.mail` 不得 import `app.modules`」與 canary 測試，spec delta 寫明                       | 0      |

## 決議（Q）

### Q1. 寄信只排入背景，還是當場寄與排入並存

- **來源**：`system-analysis.md` 需求矛盾 1、待決問題 1；`system-design.md` 選項比較
- **問題**：06-01 E1b、01-04 Q23 要求寄信失敗當下告知且不建立帳號；#756 與 B4 把寄信放到背景（重試用盡約 13 分鐘後才知道）
- **決議**：共用寄信服務同時提供 `send_now`（只試一次、當場回報結果）與 `enqueue`（排入背景、依重試政策重送）；06-01、01-04 用前者，01-02、01-03、03-03 用後者；規格頁不改
- **理由**：兩種需求都真實存在；`architecture.mdx` §容器視圖 把「API 寄或 worker 寄」留給後端設計
- **已回修**：`proposal.md`、`system-design.md`（標已決議）；B4 的措辭隨本卡修正（見 Q2）。代價：#728 實作時要在「先 commit 再補償刪除」與「援用 B4『預設』二字的例外」之間選定，屬 #728 的設計
- **日期**：2026-11-28

### Q2. 寄送失敗時印不印連結

- **來源**：`system-analysis.md` 需求矛盾 2、待決問題 7
- **問題**：B4 與 `backend-modules.mdx` 寫寄送失敗把連結印到 log；ADR-008 D3、06-01 Q9 寫只有沒設金鑰才印，寄送失敗是故障
- **決議**：以 ADR-008 D3 與 06-01 為準。只有「沒設定寄信服務」才印連結；設了但寄送失敗就回報給呼叫端，不印連結。B4 與 `backend-modules.mdx` 隨本卡修正
- **理由**：與 ADR、規格一致，也符合 #756「log 不外洩信件內容」的驗收條件
- **已回修**：B4、`backend-modules.mdx`（tasks 排入）
- **日期**：2026-11-28

### Q3. 最終失敗記在哪；連結明文停在 Redis

- **來源**：`system-analysis.md` 待決問題 4；`system-design.md` T4
- **問題**：B9 要求背景工作結果寫進資料庫；信件內容（含一次性連結）在 worker 取走前明文停在 Redis
- **決議**：不新增資料表，最終失敗只留一行不含內容的 log，spec 寫明這是 B9「結果寫進資料庫」與「只傳識別資訊」的例外；接受連結在 worker 取走前短暫停在 Redis（Redis 不對外發布埠、ack 後即刪、`argsrepr` 遮蔽、`ignore_result`）
- **理由**：免去個資保存與匿名化的範圍；信件不是需要事後查詢的業務資料
- **已回修**：B9 的例外寫進 spec delta 與 `backend-agent-rules`（tasks 排入）
- **日期**：2026-11-28

### Q4. 排不進佇列時怎麼辦

- **來源**：`system-analysis.md` 待決問題 12；`system-design.md` T5
- **問題**：Redis 掛了時，要丟錯誤還是自動改成當場寄
- **決議**：`enqueue` 丟 `MailQueueUnavailableError`，由各功能決定怎麼告知使用者；不自動改成當場寄。不另包 executor，以 socket 逾時 2 秒與發送重試上限把最壞情況壓在數秒內；不觸發 ADR-003 D8 的重新討論
- **理由**：自動改寄會讓 01-02 的回應時間透露 Email 是否存在
- **已回修**：`system-design.md`（標已決議）
- **日期**：2026-11-28

### Q5. 沒設金鑰時連結由誰印、印到哪；log 可寫什麼

- **來源**：`system-analysis.md` 待決問題 8、9；`system-design.md` T11
- **決議**：是否印連結由各功能決定；入口提供 `record_unsent_link`，寫進專用 logger `app.mail.unsent_link`（`propagate=False`，一般 log 管道看不到）。一般 log 只寫 `mailId`、類型、次數、結果、固定字彙的原因、`excType`、寄信服務的訊息 id；收件者連網域都不寫，寄信服務的錯誤本文也不寫。`httpx`、`httpcore` 的 logger 固定 `WARNING`
- **理由**：S9 要求 log 不含 PII，Email 屬之；`httpcore` 的 DEBUG 會印出 `Authorization` 標頭
- **已回修**：spec delta、`backend-modules.mdx`（tasks 排入）
- **日期**：2026-11-28

### Q6. 寄件人設定

- **來源**：`system-analysis.md` 待決問題 10
- **決議**：新增 `MAIL_FROM`，與 `RESEND_API_KEY` 一起設或都不設，只設一個就 `ConfigError`（B10）；`REDIS_URL` 只給一個；信裡連結的對外網址由第一個寄連結的功能單引入
- **已回修**：`.env.example`、`runtime-config` delta（後續產物）
- **日期**：2026-11-28

### Q7. 寄信服務的接法與新套件歸類

- **來源**：`system-analysis.md` 待決問題 14；`system-design.md` T3
- **決議**：以既有的 `httpx` 呼叫 Resend HTTP API，不新增 SDK；`celery`、`kombu`、`redis` 歸一般套件，不新增 B12 入口；`ENTRY_THIRD_PARTY[MAIL]` 維持禁止 `resend`、`smtplib`、`aiosmtplib`
- **理由**：少一個相依與 `pip-audit` 面；替身寫法與 Google 登入一致；不用 SDK 的模組層全域金鑰
- **已回修**：`system-design.md`（標已決議）；ADR-008 D3 提到 SDK 優點的句子隨本卡補一句現行做法（tasks 排入）
- **日期**：2026-11-28

### Q8. 寄信 task 放哪

- **來源**：`system-design.md` T1
- **決議**：放寄信入口 `app/mail/tasks.py`；B3、B9 的適用路徑文字隨本卡修正
- **已回修**：`backend-agent-rules` B3、B9（tasks 排入）
- **日期**：2026-11-28

## 依上游建議定案的技術預設（非維護者題）

主 session 依 system-design 的建議定案並在此留痕（2026-11-28）：

| 題                                   | 定案                                                                                                                                                                                                                         |
| :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 重試政策與重複寄送（SA 2、3）        | 沿用 B9 的三次、60／180／540 秒；連線錯誤、逾時、429、5xx 算暫時性，其餘 4xx 直接最終失敗；每封信帶 `Idempotency-Key: <mail_id>` 由寄信服務去重，apply 前查證其有效期                                                        |
| 本機、CI、e2e 的背景工作（SA 5、T9） | 兩層容器一律真 Redis 加 worker；`pnpm run dev` 與 e2e 預設 eager；CI 後端 job 不加 Redis，以 `.apply()` 加 `httpx` 替身測；`DATABASE_URL` 有設就拒絕 eager；Windows 走真佇列時用 `--pool=solo`，寫進 `local-development.mdx` |
| 「兩層都能跑」的範圍（SA 6）         | 本卡只保證 worker 在兩層都起得來，Lite 掛同一個 volume；同步驅動與同步 session 留給 #767                                                                                                                                     |
| 語言參數（SA 11）                    | 入口只寄組好的內容，不帶語言參數                                                                                                                                                                                             |
| 健康檢查（SA 13）                    | API 健康檢查不變；`redis`、`worker` 各有容器 healthcheck                                                                                                                                                                     |
| 07-04 電子郵件通道（SA 15）          | 入口以單封信設計，07-04 成為消費者時再評估                                                                                                                                                                                   |
| 共用寄信流程的落點（SA 16）          | 補在 `architecture.mdx` §非同步任務，不進 `docs/specs/`                                                                                                                                                                      |
| Settings 分層（T2）                  | 新增 `WorkerSettings`，worker 不要求 `CORS_ALLOWED_ORIGINS`、`AUTH_SECRET`                                                                                                                                                   |
| import 契約（T6）                    | router 不得 import `app.mail`；`app.mail` 不得 import `app.modules`；`app/worker.py` 列進三條入口契約與 `CHECKED_PACKAGES`                                                                                                   |
| worker 參數（T7）                    | `--concurrency 2`，healthcheck 每 30 秒 `inspect ping`                                                                                                                                                                       |
| CI `compose`（T8）                   | 只驗 worker `inspect ping`                                                                                                                                                                                                   |
| 常駐文件（T10）                      | 由 apply 的 task 更新，排在實作群組最後一個 task 之前                                                                                                                                                                        |
| capability                           | 新增 `mail-delivery`；worker 與 Redis 併入修改 `container-runtime`；另修改 `runtime-config`、`backend-code-boundaries`、`server-logging`、`ci-quality-gates`，`workspace-commands`、`e2e-testing` 視 eager 預設而定          |

### Q9. Redis 掉訊息是否觸發 ADR-003 D8 的重新討論

- **來源**：`system-analysis.md` 待決問題 12 後半；design-reviewer 2026-11-28
- **問題**：ADR-003 D8 接受 Redis 重啟時偶爾掉一個背景工作，理由原本只針對評分；D8 寫明「評分之外出現必須保證不掉的工作」時要重新討論。註冊驗證信、設定密碼信算不算
- **決議**：不算，不重開 D8
- **理由**：這些信使用者都能重新觸發（重寄、重新邀請）
- **已回修**：`design.md`、`proposal.md` 的 Risks 改指本題；ADR-003 決策紀錄記一筆（tasks 排入）
- **日期**：2026-11-28

## 告知

- **03-03 缺定義（SA 17）**：03-03 的 Email 邀請沒有定義「沒設寄信服務」與「寄不出」時的行為；不影響本卡，#766 動工前由維護者以 `spec-writing` 補

## 已修正（P）

| 編號 | 位置                                                                           | 問題                                                                  | 修正                                                             |
| :--- | :----------------------------------------------------------------------------- | :-------------------------------------------------------------------- | :--------------------------------------------------------------- |
| P1   | `container-runtime` 契約、CI `compose` job、`docker-compose.prod.yml` 開頭註解 | 寫「不得有 Redis 或 worker」，那是 Epic #502 的範圍排除，不是持久決定 | 本卡一併改寫（spec delta 與 tasks）                              |
| P2   | `backend-agent-rules` B12「例外」欄                                            | 仍寫「今天 `backend/app/` 沒有任何入口」，`app/oidc/` 已落地          | 隨本卡修正（tasks 排入）                                         |
| P3   | `system-analysis.md`、`system-design.md`、`proposal.md` 的待決問題             | 已在本檔決議或定案，仍寫成待決                                        | 各自標「已決議／已定案，見 clarification」（交 sa、sd、planner） |

## 移出本次的驗收標準

無（本卡不對應規格頁的驗收標準列）。

## 交給後續產出

- specs：新增 `mail-delivery`（`send_now` 與 `enqueue`、沒設定不寄、重試與暫時性／最終失敗的分類、冪等鍵、最終失敗只留 log 且為 B9 例外、佇列連不上丟 `MailQueueUnavailableError`、log 欄位白名單與專用 logger、`MAIL_FROM` 與金鑰全有或全無、信件參數與 log 不帶測試集答案）；修改 `container-runtime`（兩層都有 `redis` 與 `worker`）與其餘 capability。來源引 ADR-003、ADR-008 D3、B3／B4／B9／B10／B12、S9 與本檔 Q1–Q8
- design：六個元件、`send_now` 在 thread 執行的方式、eager 的護欄、`argsrepr` 遮蔽與 `ignore_result`、socket 逾時
- tasks：實作標 `[@backend-developer]`；常駐文件（`backend-modules.mdx`、`architecture.mdx` §非同步任務、`backend-agent-rules` B3／B4／B9／B12、ADR-003、ADR-008 D3、`local-development.mdx`）與 `.env.example` 標 `[@technical-writer]`；驗證含兩輪 `uv run pytest`、`lint-imports`、`ruff`、`mypy --strict`、`docker compose` 兩層起得來且 worker `inspect ping` 通過、CI `compose` job、`pip-audit`
