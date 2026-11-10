---
title: 技術架構
description: 依 singyichen/label-suite 的 38 份 ADR 整理出本 repo 要照著做的技術架構：技術選型、後端分層、認證與授權、任務設定組合模型、測試集答案隔離、資料庫雙層、非同步任務、i18n、稽核、前端、測試分層、部署。附每份 ADR 在本 repo 的效力、十五項矛盾與落差，以及待決清單。
tags: [architecture, fastapi, react, adr]
---

# 技術架構

技術決策的 canon 在 `singyichen/label-suite` 的 `docs/adr/`，共 38 份（36 份 Accepted、ADR-031 Superseded、ADR-036 Proposed）。
本文件不是那些 ADR 的副本，而是本 repo 的視角：哪些決策照著做、哪些要調整、哪些已經被本 repo 自己的決策取代，以及哪些還沒拍板。

本 repo 目前沒有 `backend/`、`frontend/`，所以本文件寫的是「要照著做的架構」，不是「現在的程式長這樣」。
它的第一個讀者是 OpenSpec 規劃階段的 `sd` 與 `ui-ux` agent（[#53](https://github.com/label-suite/label-suite/issues/53)）：
`system-design.md` 與 `api-contract.md` 的技術前提從這裡來。業務面的規格以 `docs/specs/` 為準，見 [需求文件撰寫](spec-authoring.md)。

本文與 ADR 不一致時，以 ADR 為準並回報維護者修正本文；本文與 `docs/specs/` 不一致時，以 `docs/specs/` 為準。
**唯一的例外是維護者已明文裁定覆寫的項目**——§ADR 效力總表 標成「被覆寫」「部分被覆寫」「本期不做」「本期部分採用」的那幾列，**以本文為準，不回退 ADR**。
那些裁定的紀錄在 [Issue #105 的 2026-11-10 留言](https://github.com/label-suite/label-suite/issues/105#issuecomment-6755062393)。沒有那種標記的列，照上面那條規則走。

## ADR 效力總表

| ADR | 標題 | 狀態 | 在本 repo 的效力 |
| :--- | :--- | :--- | :--- |
| 001 | Modular Monorepo Structure | Accepted | 需調整：`backend/` 加 `frontend/` 沿用，但 canon 規格在 `docs/specs/`，不是根目錄 `specs/` |
| 002 | uv（後端）加 pnpm（前端） | Accepted | 沿用，等同 `AGENTS.md` Hard Rule 3 |
| 003 | FastAPI | Accepted | 沿用 |
| 004 | React 加 Vite SPA | Accepted | **部分被覆寫**（2026-11-10 裁定）：SPA 與 Vite 沿用，**版本改 React 19** |
| 005 | PostgreSQL 16 | Accepted | 沿用，Lite 層由 024 補上 |
| 006 | Redis 7（cache 加 broker） | Accepted | 沿用 |
| 007 | Celery | Accepted | 沿用 |
| 008 | Docker 加 Docker Compose | Accepted | 沿用 |
| 009 | pytest 加 Playwright 加 TDD | Accepted | 沿用 |
| 010 | Config-Driven Task Architecture | Accepted | 沿用原則，等同 Hard Rule 5；config schema 已由 029 取代 |
| 011 | 前端垂直功能切片 | Accepted | **被覆寫**（2026-11-10 裁定）：改用 `pages/` 加 `features/` |
| 012 | Vitest 加 RTL 加 Playwright | Accepted | 沿用，E2E 位置已由 034 取代 |
| 013 | Resend 寄信 | Accepted | 需調整：**降級路徑已由 2026-11-10 裁定補上**（未設定 key 時把連結印在伺服器 log） |
| 014 | Prototype 層 Playwright 測試 | Accepted | 不適用：測試與 `package.json` 依 #16 留在個人 repo |
| 015 | 角色導向漸進式 onboarding | Accepted | **本期部分採用**（2026-11-10 裁定）：空狀態與情境提示做，**導覽與角色導向漸進揭露不做** |
| 016 | shadcn/ui 加 Storybook | Accepted | **部分被覆寫**（2026-11-10 裁定）：採 shadcn/ui，但元件放 `components/ui/`。**Storybook 不在那次裁定的範圍裡，仍待決** |
| 017 | 三層 agent（Planner／Generator／Evaluator） | Accepted | 已被取代：改用 #47 決議的 fullstack-sdd 角色分工 |
| 018 | Prometheus 加 Grafana | Accepted | **本期不做**（2026-11-10 裁定） |
| 019 | AI 可追溯與稽核（`ai_runs`） | Accepted | 沿用，**本期要做**（2026-11-10 裁定：三套觀測性裡只做這一套） |
| 020 | Sentry | Accepted | **本期不做**（2026-11-10 裁定） |
| 021 | JWT 加 refresh token（httpOnly cookie） | Accepted | 沿用 |
| 022 | 任務狀態機放 service 層 | Accepted | 沿用，轉移條件以 `docs/specs/` 為準；但它舉的扁平 `app/services/` 路徑**已被** 2026-11-10 裁定 的模組內分層**覆寫** |
| 023 | Compose 加 Nginx 加 Cloudflare 部署 | Accepted | 需調整：要搭 `commit-and-release.md` 的三分支與 GHCR |
| 024 | 資料庫雙層（SQLite 加 PostgreSQL） | Accepted | 沿用 |
| 025 | Bruno API collection | Accepted | **部分被覆寫**（2026-11-10 裁定）：Bruno 降級成可選的手動工具，**pre-PR 硬關卡取消** |
| 026 | i18n 兩層 | Accepted | 沿用 |
| 027 | GitHub Projects | Accepted | 已被取代：改用組織層專案，無 `STATUS.md` |
| 028 | CI 安全掃描（SCA 加延後 SAST） | Accepted | 沿用，等同 Hard Rule 7、8 |
| 029 | Output-Type Composition Model | Accepted | 沿用，`sequence_tagging` 那一列已過期（見落差 7） |
| 030 | Lucide 圖示 | Accepted | 沿用 |
| 031 | 序列標記 tokenization 契約 | Superseded | 已被取代：改成半開字元 offset span |
| 032 | 使用者行為稽核（`audit_events`） | Accepted | 沿用 |
| 033 | OpenSpec 當變更流程層 | Accepted | 已被取代：本 repo 的 `openspec/config.yaml` 加 #47 決議 |
| 034 | 正式 E2E 放根目錄 `e2e/[module]/` | Accepted | 沿用 |
| 035 | Google SSO 直接走 OIDC | Accepted | 沿用 |
| 036 | 開源 repo 拆分 | Proposed | 需調整：規格 canon 已搬到本 repo |
| 037 | 權限矩陣當授權輸入 | Accepted | 沿用 |
| 038 | 資料保留、刪除與匿名化 | Accepted | 沿用 |

2026-11-10 的裁定動到**九列**的效力，所以舊的分類統計（「二十一份照著做、五份要調整…」）已經不準，改成現況：

| 效力 | 份數 | 哪幾份 |
| :--- | :--- | :--- |
| 沿用 | 22 | 含 **019**（原本待決，裁定後確定本期要做） |
| 需調整 | 4 | 含 **013**（降級路徑已由裁定補上） |
| 已被取代 | 4 | |
| 不適用 | 1 | |
| **整條被覆寫** | 1 | **011**（切片方式改成 `pages/` 加 `features/`） |
| **部分被覆寫** | 4 | **004**（版本改 19）、**016**（元件位置改 `components/ui/`）、**022**（狀態機沿用，但它舉的扁平路徑被覆寫）、**025**（Bruno 的 pre-PR 關卡取消） |
| **本期部分採用** | 1 | **015**（空狀態與情境提示做，導覽那一套不做） |
| **本期不做** | 2 | **018**、**020** |

**ADR-016 的 Storybook 沒有被裁定**，仍待決——那次問的是元件庫，不是 Storybook。它列在 §待決清單 第 10 列。

## 目錄

本 repo 的目標結構（`backend/`、`frontend/`、`e2e/` 尚未建立）：

```text
label-suite/
├─ backend/                       FastAPI + SQLAlchemy 2.0 + Alembic（ADR-003、005）
│  ├─ app/modules/<module>/       模組內分層：router、service、repository、schemas（2026-11-10 裁定）
│  ├─ tests/                      pytest：unit 與 integration（ADR-009）
│  ├─ bruno/                      可選的手動工具，**不是 pre-PR 關卡**（2026-11-10 裁定）
│  └─ pyproject.toml              依賴只用 uv 管（ADR-002、Hard Rule 3）
├─ frontend/                      React + Vite + TypeScript strict（ADR-004）
│  ├─ src/{pages,features}/       React 19；pages 組頁面、features 放功能邏輯（2026-11-10 裁定）
│  └─ package.json                依賴只用 pnpm 管（ADR-002）
├─ e2e/                           正式全端 Playwright，依模組分目錄（ADR-034）
│  └─ shared/fixtures/            各角色的 storageState 與 seed helper
├─ docs/
│  ├─ specs/                      canon 需求文件：PRD 與模組規格（本 repo 擁有）
│  ├─ development/                本文件與其他開發規範
│  └─ prototype/                  prototype 使用說明
├─ design/prototype/              HTML 線框與 design token（Playwright 測試留在個人 repo，ADR-014）
├─ openspec/                      規劃產出與可測契約
├─ docker-compose.yml             Lite 層預設 SQLite（ADR-024）
└─ docker-compose.prod.yml        PostgreSQL 全套加監控（ADR-024、023）
```

## 技術選型

| 層 | 選型 | ADR |
| :--- | :--- | :--- |
| 後端框架 | FastAPI 加 pydantic v2 加 uvicorn | 003 |
| 後端測試 | pytest 加 pytest-asyncio 加 httpx | 003、009 |
| ORM 與 migration | SQLAlchemy 2.0（async）加 Alembic | 005 |
| 資料庫 | PostgreSQL 16（正式）／SQLite（Lite） | 005、024 |
| 資料庫驅動 | `asyncpg`（API）、`psycopg2`（worker）、`aiosqlite`（Lite API）、`sqlite3`（Lite worker） | 005、024 |
| 快取與佇列 | Redis 7 | 006 |
| 非同步任務 | Celery | 007 |
| 寄信 | Resend | 013 |
| 前端框架 | **React 19** 加 Vite 加 TypeScript strict（維護者 2026-11-10 裁定，覆寫 ADR-004 的 React 18） | 004 |
| 路由與伺服器狀態 | React Router v6 加 TanStack Query | 004 |
| 元件庫與圖示 | **shadcn/ui**（維護者 2026-11-10 裁定，元件放 `components/ui/`，覆寫 ADR-016 的 `shared/ui/`）加 Lucide（唯一圖示來源） | 016、030 |
| 前端測試 | Vitest 加 React Testing Library | 012 |
| E2E | Playwright | 009、034 |
| 套件管理 | uv（Python）、pnpm（JavaScript） | 002 |
| 容器 | Docker 加 Docker Compose | 008 |
| 反向代理 | Nginx，前面可接 Cloudflare | 023 |

## 後端分層

```text
HTTP 請求
  → CORS（來源逐一列出，禁止 allow_origins=["*"]，Hard Rule 7）
  → 認證 dependency：驗 httpOnly cookie 裡的 access JWT，取 sub、sid、credential_version
  → 授權 dependency：權限矩陣四步判定（見下節）
  → pydantic 驗證 request schema
  → Router：HTTP 轉接、取得呼叫者、把 model 轉成 response schema
  → Service：商業邏輯、狀態機、寫稽核事件
  → Repository／SQLAlchemy model → PostgreSQL 或 SQLite
  → 回應：i18n 訊息依 Accept-Language 取字（ADR-026）
```

| 層 | 職責 | 不做 |
| :--- | :--- | :--- |
| Router | 路由、request／response schema、取得呼叫者、套用欄位遮蔽 | 不碰 Repository、不寫商業邏輯 |
| Service | 查詢條件、狀態機轉移、權限以外的業務卡控、寫 `audit_events` | 不組 HTTP 回應、不自己讀 `Accept-Language` |
| Repository 與 model | 資料存取；schema 只由 Alembic migration 管 | 不寫原生 SQL（migration DDL 例外） |
| Celery task | 評分、IAA 計算、匯出等長時間工作 | 不處理 HTTP、不回傳使用者可見訊息 |

任務狀態機只實作在 service 層（ADR-022）。反向轉移除了 `waiting_iaa_confirmation` 回 `draft` 與回 `dry_run_in_progress` 兩條之外都不允許，
違反時丟 `InvalidTransitionError`。完整轉移條件以 `docs/specs/` 的規格書與 PRD §共用狀態機為準，不以 ADR-022 的表為準（ADR 的表帶著個人 repo 的 FR 編號）。

**目錄分層已定案（維護者 2026-11-10 裁定）：模組內分層** `app/modules/<module>/`，一個業務模組一個資料夾，裡面放自己的 router、service、repository 與 schemas。ADR-022 的扁平 `app/services/` 寫法記為被覆寫（見[落差 1](#矛盾與落差)）。`sd` 寫 `system-design.md` 時照這個結構畫，不再當成待決。

## 認證與授權

後端只認 httpOnly cookie 裡的 token，不接受 `Authorization` header 以外的來源推定身分。角色只從驗證過的 token 與資料庫取，
權限一定在後端擋，前端隱藏按鈕只是體驗。

| Token | 效期 | Cookie flag | 輪替 |
| :--- | :--- | :--- | :--- |
| Access token（JWT） | 15 分鐘 | `httpOnly`、`Secure`、`SameSite=Lax` | 每次 refresh 重發 |
| Refresh token（不透明 UUID） | 7 天滑動 | `httpOnly`、`Secure`、`SameSite=Lax` | 每次使用輪替，一次性 |

JWT payload 只放 `sub`、`sid`、`credential_version`、`role`、`iat`、`exp`。**任務角色不放進 JWT**，
前端進任務頁後另外查成員身分（ADR-021）。`role` 只供顯示，授權不看它（ADR-037）。

授權依序判定四件事（ADR-037）：

1. 驗目前登入者、帳號是否啟用、`credential_version`、token family 是否仍有效
2. 讀目前的系統角色；任務範圍的操作另讀該任務目前有效的成員身分。系統角色永遠不隱含任務成員身分
3. 把操作解析成已啟用、在白名單內的 permission key 與它所屬的層（系統或任務），要求對應角色的 cell 為 `allowed=true`。
   未知的 key、缺少的列、層級不符、成員身分失效、矩陣版本列不存在，一律拒絕
4. 再檢查操作本身的附加條件：任務歸屬與狀態、指派與審核者身分、資料集可見性、測試集答案隔離。
   cell 為 true 不會蓋過這些條件；被隱藏的任務要在不洩漏它存在的前提下回應

Google SSO 走直接 OIDC 整合（`authlib`），不引入外部 IdP；`GOOGLE_CLIENT_ID` 沒設定時按鈕退回 no-op，
所以 SSO 是可選加購而非必要基礎設施（ADR-035）。Google 回報 `email_verified: true` 時才自動綁定既有 Email 帳號，
綁定同一筆交易內把 `hashed_password` 設為 `null`、`credential_version` 加一並撤銷所有 session。

## 任務設定：`input_type` 加 `outputs[]`

任務類型完全由設定決定，平台核心不得出現任何任務專屬邏輯（ADR-010、Hard Rule 5）。
固定的 `task.type` enum 已被組合模型取代（ADR-029）：設定由 `input_type`（`single_item` 或 `item_pair`）加上一個 `outputs[]` 陣列組成，
每個 output type 自帶設定片段、標記 UI 與評分指標。

| Output type | 設定片段 | 標記 UI | 評分指標 |
| :--- | :--- | :--- | :--- |
| `single_label` | `label_options[]` | 單選群組 | accuracy、f1_macro、cohen_kappa |
| `multi_label` | `label_options[]`、`max_selections` | 可搜尋的階層多選 | f1_micro、f1_macro、hamming_loss |
| `single_dim` | `dimension_name`、`min`、`max`、`step` | 滑桿 | pearson_r、spearman_rho、mse |
| `multi_dim` | `dimensions[]` | 多個滑桿 | pearson_r（逐維）、mean_mse |
| `sequence_tagging` | `entities[]`、`snap_unit` | 字元 offset span 選取 | span 級指標（見落差 7） |
| `entity_recognition` | `entities[]` 或 `polarity_options[]`、`allow_overlapping`、`scheme` | 實體選取加標籤 | entity_f1、span_f1 |
| `relation_identification` | `relation_types[]`、`source_output` | 實體加關係連線 | triple_f1 |
| `free_text` | `max_length` | 文字區塊 | ROUGE、BERTScore、BLEU |

依賴關係以 `source_output` 宣告，被依賴的 output 要先完成；沒有依賴的 output 標記員可以任意順序完成。
v1 的限制：同一種 output type 每個任務最多出現一次，output 數量沒有上限。

多 output 的任務產生的是分數向量而不是單一分數，IAA 也逐 output type 獨立計算。

標記資料不再是對齊 token 序列的標籤，而是半開區間的字元 offset span `{ start, end, label }`（ADR-031 的 supersede 說明）。
`snap_unit` 只影響拖曳落點，不改變既有 span 的意義，所以不需要凍結 tokenizer 版本。

## 測試集答案不外露

Hard Rule 6：標記員能接觸到的任何地方都不得出現標準答案與測試集資訊。架構上分四道：

| 位置 | 做法 | ADR |
| :--- | :--- | :--- |
| 資料庫 | 測試集答案存在獨立、受存取控制的資料表，不與一般標記資料同表 | 005 |
| Celery worker | `load_answers()` 只在 worker 行程內讀答案，答案不離開 worker | 007 |
| 授權 | 測試集答案隔離是授權第四步的附加條件，權限矩陣 cell 為 true 也不能蓋過 | 037 |
| 保留政策 | 帶答案的歷史 JSON 跟著它所屬的資料集版本或 run 存續，不做 PII 匿名化、不單獨刪除 | 038 |

規劃階段由 clarify 關卡的第 10 個檢查面向把關（見 [OpenSpec 導入決議](openspec-fullstack-sdd.md)）。

## 資料庫雙層

依 `DATABASE_URL` 是否設定決定走哪一層（ADR-024）：

| 層 | 資料庫 | 用途 | 啟用方式 |
| :--- | :--- | :--- | :--- |
| Lite | SQLite | 本機試用、單人、評估 | 預設，不需設定 |
| 正式 | PostgreSQL 16 | 多人、並發寫入、部署 | 設 `DATABASE_URL` |

同一層的 API 與 worker 用不同的驅動，因為 Celery 跑在同步執行緒裡，不能用 async engine：

- Lite：API 用 `sqlite+aiosqlite:///./data/label_suite.db`，worker 把 `+aiosqlite` 去掉得到同步 URL
- 正式：API 用 `postgresql+asyncpg://...`，worker 同樣推導出 `postgresql+psycopg2://...`

Lite 層的 `./data` 必須是持久化 volume，而且 `backend` 與 `worker` 兩個 container 要掛同一個路徑，
否則 worker 寫的資料 API 讀不到。`docker-compose.yml` 預設 Lite，`docker-compose.prod.yml` 提供 PostgreSQL 全套與監控。

任務設定存成 JSONB（Lite 層為 SQLite JSON），讓新增任務類型不必改 schema（ADR-005、010）。
schema 一律走 Alembic migration，不用 `synchronize` 類的自動同步。

## 非同步任務

Redis 7 同時當 Celery broker、result backend 與應用快取，用不同的 DB 編號隔開（ADR-006）：broker `/0`、result `/1`、cache `/2`。
快取 DB 的淘汰策略是 `allkeys-lru`；共用實例不設 `maxmemory`。

```text
上傳提交
  → FastAPI 端點驗檔案 → 送進 scoring 佇列 → 回 {"data": {"task_id": "..."}, ...}（envelope，裁定 2）
  → Celery worker：parse_submission → load_answers → compute_metrics → write_results
  → FastAPI GET /api/v1/submissions/{id}/status 回任務狀態與結果（前綴依裁定 3）
```

評分任務走 `scoring` 佇列，雜務走 `default`；最多重試三次，退避 60、180、540 秒；單一評分工作硬性上限 300 秒；
結果在 result backend 留 24 小時（ADR-007）。

`worker` 與 `backend` 共用同一個 image，所以 NLP 評估套件（`krippendorff`、`seqeval`、`scipy`）要宣告在 `pyproject.toml` 裡（ADR-008）。

## i18n 兩層

支援 `zh-TW`（預設 fallback）與 `en`（ADR-026）。兩層各自負責，不互相抄：

| 層 | 範圍 | 實作 | 規則 |
| :--- | :--- | :--- | :--- |
| 前端 UI 字串 | React 元件直接渲染的文字、前端驗證訊息 | `react-i18next`，依模組分 namespace | 語系檔**不得**放後端 `detail` 字串的副本 |
| 後端回應訊息 | `ErrorResponse` 的 `detail` 與任何回傳給使用者看的字串 | 後端讀 `Accept-Language`，字串放 `app/i18n/<lang>/` | 商業邏輯**不得**內嵌人看得懂的訊息字面值 |

前端把後端的 `detail` 當成已經本地化的不透明字串直接顯示，不再翻譯或對照 key。
FastAPI 預設的 422 `RequestValidationError` 不在這個契約內，需要本地化時另註冊 handler。

`Accept-Language` 的解析規則（含 q-value、`*` 通配、`q=0` 拒絕、全部被拒時回 `406`）在 ADR-026 寫得很細，實作時直接照抄。

## 稽核與可追溯

兩張 append-only 表，職責分開（ADR-019、032）：

| 表 | 記什麼 | ADR |
| :--- | :--- | :--- |
| `ai_runs` 加其生命週期事件 | AI 輔助流程的 run：模型、prompt 版本、config hash、輸入與輸出快照、工具呼叫、評估結果 | 019 |
| `audit_events` | 人發起的領域行為：發布、提交、裁決、投票、成員變更、匯出 | 032 |

分界：使用者接受、編輯或拒絕一個 AI 產出，記在 `ai_runs` 裡，不另外寫 `audit_events`；
人的行為觸發了一個 AI run，則寫 `audit_events` 並帶 `ai_run_id` 做關聯。

`audit_events` 的欄位：`actor_user_id`（系統行為時為 null）、`actor_role`（當時的角色）、`action`（命名空間動詞，例 `task.status_changed`）、
`target_type`、`target_id`、`task_id`（任務內的行為才有）、`payload_summary`（去識別化的 JSON）、`request_id`、`occurred_at`（UTC，伺服器時間）。

規則：

- **只新增。** 一般 service 寫入只做 insert，update 與 delete 在兩層資料庫都拒絕；要更正就寫新事件
- **保留至少一個日曆年**，沒有自動刪除。任何封存或清除機制都要另外經過審核
- `(target_type, target_id)` 是由註冊表驗證的多型參照，不是實體 FK
- `audit_events` 這個共用表名是 PRD 單數、模組前綴命名慣例的明確例外，不擴及其他表

資料保留與匿名化（ADR-038）：使用者的刪除請求是**就地匿名化同一列**，不把 FK 指向共用墓碑帳號，
所以稽核行為人、session、成員身分、歷史與 gold 追溯都保持完整。事件列永遠不刪，過了最短保留期後只能把 PII 欄位墓碑化。

## 前端

| 面向 | 做法 | ADR |
| :--- | :--- | :--- |
| 框架 | React 加 Vite 的 SPA，TypeScript strict，禁止 `any`（Hard Rule 7） | 004 |
| 路由 | React Router v6 | 004 |
| 伺服器狀態 | TanStack Query；表單狀態與純 UI 狀態分開放 | 004 |
| 元件庫 | shadcn/ui 當原語，元件以原始碼形式放進 `components/ui/`（2026-11-10 裁定）。**Storybook 仍待決** | 016 |
| 圖示 | **只用** Lucide（`lucide-react`）。不得加入其他圖示庫，不得用 emoji 或自己畫的 SVG 當圖示 | 030 |
| design token | 只用語意 token，色值只寫在主題檔，見 `label-suite-design` skill 與 `design/prototype/assets/tokens.css` | 016、030 |
| 權限 | 前端隱藏按鈕只是體驗，權限一律由後端擋 | 021、037 |

Lucide 的例外：prototype 的 HTML 必然把圖示內嵌成 SVG（設計層沒有 npm），只要每個字形都複製自真實的 Lucide 圖示就允許；
品牌與 logo 標記（彩色 logo、banner、Google SSO 的 G）不受這條限制。

ADR 沒有定義畫面狀態的最低要求。本 repo 由 OpenSpec 的 `ui-design` 產出負責：每個資料區塊都要寫出
loading、error、empty、無權限（403）四種狀態，以及被遮蔽欄位的呈現方式。

## 測試分層

| 層 | 工具 | 範圍 | 位置 | ADR |
| :--- | :--- | :--- | :--- | :--- |
| 後端 unit 與 integration | pytest 加 pytest-asyncio 加 httpx | service、router、商業邏輯 | `backend/tests/` | 009 |
| 前端元件與 hook | Vitest 加 React Testing Library | 單一元件、hook、角色分派 | 與原始碼同目錄 `*.test.tsx` | 012 |
| 正式全端 E2E | Playwright | 跨頁、跨角色的使用者旅程 | 根目錄 `e2e/[module]/[page].spec.ts` | 034 |

三層職責互補、不重疊：純 UI 邏輯不要用 Playwright 測，跨頁旅程不要用 Vitest 測。
`e2e/shared/fixtures/` 放各角色的 `storageState` 與 seed helper。

開發方式是 TDD（ADR-009）：先寫會失敗的測試，再寫剛好讓它通過的程式，然後重構。
這條對 agent 同樣適用，而且 OpenSpec 的 `rules.tasks` 要求測試與實作放在同一個 task，不另拆測試 task。

ADR-014 的 prototype 層 Playwright 測試**不適用本 repo**：那些測試與 `design/prototype/package.json`、`playwright.config.ts`
依 #16 的決定留在個人 repo 當參考。prototype 在本 repo 只當線框，用 `PrototypeFrame` 嵌進規格書。

`data-testid` 的共用契約仍然值得沿用：prototype HTML 標的 `data-testid` 原字串重用在 React 元件與 `e2e/` 裡。

## 部署與維運

| 面向 | 做法 | ADR |
| :--- | :--- | :--- |
| 本機與 CI | `docker compose up`；CI 用 workflow 的 service container 起 PostgreSQL 與 Redis | 008 |
| 正式環境 | Compose 當預設 runtime，Nginx 當公開入口與靜態前端伺服器 | 023 |
| TLS 與 CDN | 有的話用 Cloudflare 當 DNS、CDN 與 TLS 邊緣；Nginx 仍是原站入口，照樣要擋安全標頭與隔離內部服務 | 023 |
| image | 後端與 worker 共用一個多階段 Dockerfile；前端 build 完由 `nginx:alpine` 服務 `/dist` | 008 |
| CI 安全掃描 | 後端 `uv run pip-audit --fail-on high`、前端 `pnpm audit --prod --audit-level high`；SAST（Semgrep）等有程式再接 | 028 |
| 發版 | 版號、CHANGELOG、tag、GitHub Release 與 Zenodo DOI 的流程見 `commit-and-release.md` | 023 加本 repo |

Semgrep 上線時至少要蓋兩條專案禁令：CORS 的 `allow_origins=["*"]`，以及寫死的 API key 與 secret（ADR-028，等同 Hard Rule 7、8）。
DAST 與 API fuzzing 都明確先不做，條件寫在 ADR-028。

分支與映像推進以 `commit-and-release.md` 為準：目前只有 `main`，等 staging 與 production 環境存在後改成 `dev` → `release` → `main` 三分支，
image 在 `release` 建一次、不重建，`main` 合併後打 `vX.Y.Z` 並在 GHCR 加同 digest 的別名 tag。ADR-023 沒有寫這一段。

## 矛盾與落差

十五項。前八項影響實作，後七項影響流程與範圍。

| # | 落差 | 影響 | 建議 |
| :--- | :--- | :--- | :--- |
| 1 | **後端目錄分層有兩種寫法並存。** ADR-022 寫 `app/services/task_service.py`（扁平 services），ADR-025 的 pre-PR gate 寫 `backend/app/modules/*/router.py`、`app/modules/*/schemas.py`（模組內分層），另有 `backend/app/schemas/`、`app/api/routes`、`app/core/deps.py` 零星出現。沒有任何 ADR 拍板 | `sd` 寫 `system-design.md` 的 Class Diagram 時無從依循；兩種混用會讓每個模組長得不一樣 | **已裁定（維護者 2026-11-10 裁定）：模組內分層 `app/modules/*/`**。ADR-022 的扁平寫法記為被覆寫；建議在個人 repo 補一份 ADR |
| 2 | **沒有成功回應的統一格式決策。** ADR-026 提到 `ErrorResponse` 與 `SuccessResponse` 的 `detail` 欄位，但沒有 ADR 定義成功回應的外層結構 | 前後端交接缺一塊；每個端點可能各自決定要不要包一層 | **已裁定（維護者 2026-11-10 裁定）：包一層 envelope**；204 無 body、檔案與串流是明文例外，例外清單要寫進契約 |
| 3 | **沒有 operationId 與 API 版本前綴的決策。** `/api/v1` 在 ADR 裡出現八次但沒有任何 ADR 決定它；FastAPI 預設的 operationId 是函式名加路徑組出來的長字串 | operationId 是前後端交接依據與前端產物的命名來源，不固定就不能當契約 | **兩半都已定**：operationId 用 `generate_unique_id_function` 固定成「動詞加資源」（#51 已落地）；前綴**用 `/api/v1`**（維護者 2026-11-10 裁定） |
| 4 | **ADR-036 已與現況脫節。** 它把規格 canon 留在個人 repo、本 repo 只放程式與 openspec；但 #29 到 #32 已把 PRD 與模組規格搬到本 repo 的 `docs/specs/`，`openspec/config.yaml` 也宣告 `docs/specs/` 由維護者擁有。ADR-036 仍是 Proposed | 兩個 repo 誰是 canon 的說法不一致，追溯會指錯地方 | 請維護者在個人 repo 更新或 supersede ADR-036，寫明規格 canon 已移至本 repo |
| 5 | **ADR-033 與本 repo 的 openspec 規則方向相反。** 033 說 `openspec/specs/` 是衍生檢視、永不權威，且「寫回 `specs/[module]/NNN-feature/spec.md`」是合併的硬關卡；本 repo 的 `openspec/config.yaml` 說 `openspec/specs/` 是實作與測試依循的可測契約，而且 change **不得**更動 `docs/specs/` 裡的需求 | 兩份規則同時存在時，agent 不知道該寫回哪裡 | 本 repo 以 `openspec/config.yaml` 加 #47 決議為準；請維護者 supersede ADR-033 或標註它只適用個人 repo |
| 6 | **ADR-033 的狀態不一致。** 檔案裡是 `**Status**: Accepted`，`README.md` 的索引寫 Proposed | 讀索引與讀檔案得到不同結論 | 請維護者修正 `README.md` 索引 |
| 7 | **ADR-029 的 `sequence_tagging` 那一列已過期。** 029（Accepted）寫 `tagging_scheme`、`token_f1`、`token_accuracy`；ADR-031 的 supersede 說明寫標記已改成半開字元 offset span `{ start, end, label }`、`snap_unit` 只影響拖曳落點、指標改成 span 級 | 照 029 的表實作會做出 token 對齊的資料模型，與現行決策相反 | 本文的 output type 表已改成現行說法。請維護者在個人 repo 修訂 ADR-029 那一列 |
| 8 | **ADR 大量引用個人 repo 的條文編號**（FR-131、FR-105、FR-063、admin-007、spec 013／014／015／017 等），本 repo 沒有這些文件 | 追溯鏈在本 repo 斷掉 | 這些編號當成「去個人 repo 查」的指標即可；本 repo 的規格一律引 `docs/specs/NN-<module>/NN-<page>.mdx` |
| 9 | **ADR-017 與 #47 決議的 SDD 流程重疊，且有一條直接衝突。** 017 的三層是 Planner／Generator／Evaluator，且**禁止** Generator 階段用 `/compact`；`CLAUDE.md` 要求約 70% context 時 compact | 兩套角色說法並存；compact 規則直接相反 | 本 repo 以 #47 的 fullstack-sdd 角色分工與 `CLAUDE.md` 為準。017 的「Evaluator 只用外部確定性工具、禁止自評」這個原則已由 `code-reviewer` 與 `acceptance-verifier` 承接 |
| 10 | **ADR-027 部分被取代。** 027 用 repo 層 GitHub Projects 加 `specs/STATUS.md` 當規格階段的真相；本 repo 的 `AGENTS.md` 說組織層專案「Label Suite」是狀態的唯一記錄、不用 label 追狀態，也沒有 `STATUS.md` | 兩套專案管理說法 | 本 repo 以 `AGENTS.md` 為準 |
| 11 | **ADR-013 的 Resend 沒有降級路徑。** ADR-035 給了 Google SSO「沒設 `GOOGLE_CLIENT_ID` 就退回 no-op」的 optional-integration 保證，Resend 沒有對應設計；而規格 06-01 的「重發設定密碼信」是使用者管理的核心功能 | Lite 層部署若沒有 Resend key，忘記密碼與重發設定信就不能用，與 ADR-024 的零前置條件啟動精神不符 | **已裁定（維護者 2026-11-10 裁定）：把設定密碼連結印在伺服器 log**，由部署者轉給使用者。連帶要求：Lite 層的 log 視為敏感，畫面要讓管理員知道信沒有寄出去。**延伸（我排的後續工作）**：規格 01-03 與 06-01 要補這一條，走 `spec-writing`；畫面的改動先畫 artifact 給維護者看 |
| 12 | **ADR-015 與 PRD 的範圍外衝突。** 015 要做角色導向的漸進式 onboarding；本 repo PRD 的「範圍外」寫「說明按鈕（平台說明入口）：這期不做」 | onboarding 與說明入口是不是同一件事沒有界定 | **已裁定（維護者 2026-11-10 裁定）：空狀態與情境提示算在範圍內**（已在 18 頁裡的 11 頁）；ADR-015 的導覽與角色導向漸進揭露**不做**。PRD §範圍外 要補一句把「說明按鈕」與「情境提示」分開，改動交給 #85 |
| 13 | **觀測性堆疊對研究原型可能過重。** ADR-018（Prometheus 加 Grafana）、019（`ai_runs`）、020（Sentry）各自是一套；PRD 說平台定位是研究原型、不是生產規模服務，範圍外包含大規模並發壓力測試 | 三套都做會吃掉相當多實作與維運成本 | **已裁定（維護者 2026-11-10 裁定）：只做 `ai_runs`（ADR-019）**；ADR-018 與 ADR-020 本期不做。`audit_events`（032）與授權（037）是功能需求，不在這個取捨裡 |
| 14 | **ADR-025 的 Bruno 與新流程職責重疊。** Bruno 是手動維護的 API collection，還帶一條 pre-PR 硬關卡；本 repo 的 `api-contract.md` 是規劃產物、`openapi.json` 由 FastAPI 自動產生 | 同一份 API 資訊要維護三個地方 | **已裁定（維護者 2026-11-10 裁定）：保留但降級成可選的手動工具，拿掉 pre-PR 硬關卡**。唯一的契約真相是 `api-contract.md` 加 `openapi.json` |
| 15 | **前端細節原本尚未定案（已於 2026-11-10 裁定）。** ADR-004 寫 React 18（scaffold 是 19）；ADR-011 的垂直功能切片與 scaffold 的 `pages/` 加 `features/` 不同；ADR-016 的 shadcn 元件放 `frontend/src/shared/ui/`，與 scaffold 的 `components/ui/` 不同 | `ui-ux` 與 `frontend-developer` agent 寫不完整（#53） | **已裁定（維護者 2026-11-10 裁定）：照 scaffold——React 19、`pages/` 加 `features/`、shadcn/ui 放 `components/ui/`**。ADR-004、011、016 三份記為被覆寫；#53 那兩個 agent 要回頭補上 |

## 待決清單

**第 1 到第 8 列已於 2026-11-10 全部由維護者裁定**。逐題的紀錄在 [Issue #105 的那則留言](https://github.com/label-suite/label-suite/issues/105#issuecomment-6755062393)；下表的「裁定」欄是維護者選定的選項與它描述裡一起接受的連帶，**不含我排的後續動作**（那些另標「延伸」）。
原本那八列是 #105 到 #110（**六張**）的共同瓶頸——其中 #106、#108、#109 的第一個工作項明文是「由維護者確認…」。現在它們從「要猜」變成「照抄決策寫文件」。

| # | 待決 | 裁定（2026-11-10） |
| :--- | :--- | :--- |
| ~~1~~ | 後端目錄分層（落差 1） | **模組內分層**：一個業務模組一個資料夾，裡面放自己的 router、service、repository、schemas。ADR-022 的扁平 `app/services/` 寫法記為被覆寫 |
| ~~2~~ | 成功回應的統一格式（落差 2） | **包一層 envelope**。204 無 body、檔案與串流是明文例外（選項描述裡一起接受的連帶）。**延伸（本文要求，非裁定內容）**：「哪些是例外」要逐一寫進 `api-contract.md`，不逐案自由心證 |
| ~~3~~ | operationId 策略與 `/api/v1` 前綴（落差 3） | **兩半都定了**：operationId 由 `generate_unique_id_function` 固定成「動詞加資源」（#51 已落地）；路徑前綴**用 `/api/v1`**。（選它的理由是 envelope 將來要改就是破壞性改動、版本前綴是那個逃生門——**那是理由，不是裁定內容**） |
| ~~4~~ | Lite 層沒有 Resend key 時的替代方案（落差 11） | **把設定密碼連結印在伺服器 log**，由部署者自己轉給使用者。與 ADR-035 給 Google SSO 的 optional-integration 形狀一致。**連帶要求：Lite 層的 log 視為敏感**，而且畫面要讓管理員知道信沒有寄出去 |
| ~~5~~ | onboarding 與說明入口的界線（落差 12） | **空狀態與情境提示算在範圍內**（已經寫在 18 頁裡的 11 頁）；**ADR-015 的導覽與角色導向漸進揭露不做**，ADR-015 記為本期部分採用。PRD §範圍外 要補一句把「說明按鈕」與「情境提示」分開——改動交給 [#85](https://github.com/label-suite/label-suite/issues/85) |
| ~~6~~ | 觀測性要做哪幾套（落差 13） | **只做 `ai_runs`（ADR-019）**。它不是運維工具而是研究可追溯性，對標註平台而言屬於資料品質。ADR-018（Prometheus 加 Grafana）與 ADR-020（Sentry）**本期不做**，與 PRD「研究原型、不是生產規模服務」的定位一致。代價：出錯時只能看 log，沒有告警 |
| ~~7~~ | Bruno 是否保留（落差 14） | **降級成可選的手動工具，拿掉 pre-PR 硬關卡**。唯一的契約真相是 `api-contract.md` 加 `openapi.json`；ADR-025 的那條關卡記為被覆寫 |
| ~~8~~ | 前端版本、目錄分層與元件庫（落差 15） | **照 scaffold**：React 19、`pages/` 加 `features/`、shadcn/ui 放 `components/ui/`。**ADR-004、011、016 三份都記為被覆寫** |
| 9 | ADR-029、033、036 與 `README.md` 索引的修訂（落差 4、5、6、7） | **仍待決**（不在 2026-11-10 的裁定範圍）：由維護者在個人 repo 處理，不卡本 repo 的實作 |
| 10 | **ADR-016 的 Storybook 要不要用** | **仍待決**：2026-11-10 問的是元件庫，不是 Storybook。第一個前端 change 之前決定 |

## ADR 追溯

| 本文章節 | ADR |
| :--- | :--- |
| 目錄 | 001、002、009、024、034 |
| 技術選型 | 002、003、004、005、006、007、008、012、013、016、023、024、030、034 |
| 後端分層 | 003、005、022、026、028 |
| 認證與授權 | 021、035、037 |
| 任務設定 | 010、029、031 |
| 測試集答案不外露 | 005、007、037、038 |
| 資料庫雙層 | 005、010、024 |
| 非同步任務 | 006、007、008 |
| i18n 兩層 | 026 |
| 稽核與可追溯 | 019、032、038 |
| 前端 | 004、016、021、030、037 |
| 測試分層 | 009、012、014、034 |
| 部署與維運 | 008、023、028 |
| 矛盾與落差 | 011、013、015、017、018、019、020、022、025、026、027、029、031、033、036 |
