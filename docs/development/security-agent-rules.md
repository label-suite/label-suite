---
title: '授權與答案隔離規範'
description: '身分只來自 httpOnly cookie、token 不離開 cookie、CSRF 與 CORS 的統一位置、授權的四段順序、遮蔽與 allowlist 在後端、答案隔離的覆蓋面、受控答案表與 worker 邊界、設定驅動的界線、稽核與脫敏、驗收矩陣。附來源逐條對照。'
category: '開發說明'
tags: [開發說明, Agent, 規範, 安全]
createdAt: '2026-11-10'
updatedAt: '2026-11-10'
---

# 授權與答案隔離規範

:badge[Issue #107]{variant="neutral"} :badge[正式開發前]{variant="warning"}

> `AGENTS.md` 是**規則本體**。這一份是授權與答案隔離那一塊的說明，由 `AGENTS.md` 的 Agent Rules Index 指過來。
> 兩邊說法不同時**以 `AGENTS.md` 為準**，並回報給維護者。
> 跨領域的規範在 [agent-rules.md](agent-rules.md)，後端的在 [backend-agent-rules.md](backend-agent-rules.md)，這裡不重複。

**這一份管的是產品不變量，不是 UI 約定。** 下面每一條的「禁止」如果被違反，影響的是誰能看到什麼資料——不是體驗好不好。

`backend/` 與 `frontend/` 目前都不存在，所以**檢查方式幾乎都是「待建置」**。標了就是字面意思：那些檢查還不存在，**不得因為這份文件存在就宣稱授權已被強制**。

兩個前提由維護者 2026-11-10 裁定，已落在 [architecture.md](architecture.md)：**可接受的身分來源只有 httpOnly cookie**（原文那句自相矛盾的敘述是筆誤），以及 **CSRF 加 double-submit token 的顯式防護**。

---

## 規範

每一條交付**適用路徑、禁止事項、正例、反例、例外條件、檢查方式、來源**。

### S1 身分只來自驗證完成的 session

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/**` 的認證 dependency 與每一個受保護端點 |
| **禁止** | 從 `Authorization` header、查詢字串、自訂 header 或請求內文推定身分；複製外部 IdP 的 dev-token 路由（例如一個「非 dev 模式回 404」的 `/dev/auth/token`） |
| **正例** | 認證 dependency 驗 httpOnly cookie 裡的 access JWT，取 `sub`、`sid`、`credential_version`，其餘來源一概不看 |
| **反例** | `token = request.headers.get("Authorization")`；或為了本機方便加一條發 token 的端點 |
| **例外** | **無。** Google SSO 走 OIDC 回調換發自己的 cookie（ADR-035），那是發 cookie 的流程，不是另一種身分來源 |
| **檢查方式** | **待建置**。可用整合測試斷言「帶 `Authorization` header 但沒有 cookie → 401」 |
| **來源** | ADR-021（JWT 加 refresh token，httpOnly cookie，沿用）；**維護者 2026-11-10 裁定可接受來源只有 cookie**。dev-token 的禁止來自 #107 工作項 1 明文（「禁止複製外部 IdP／dev-token 模式」），對應 scaffold `auth-oidc.md` 的 `/dev/auth/token` **不採用** |

### S2 token 不離開 cookie；CSRF 與 CORS 的統一位置

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/**` 的 middleware；`frontend/src/**` 全部 |
| **禁止** | 前端儲存或讀取 token（`localStorage`、`sessionStorage`、非 httpOnly cookie、記憶體 store 都算）；從可修改的 UI state 判斷權限；`allow_origins=["*"]`（`AGENTS.md` 硬性規則 7）；在端點各自處理 CSRF |
| **正例** | **session cookie** 一律 `httpOnly`、`Secure`、`SameSite=Lax`（CSRF cookie 是唯一例外，見 [architecture.md](architecture.md) 的 token 表）；請求帶 `credentials: 'include'`；**CSRF 由單一 middleware 驗綁定 session 的 double-submit token**（值是 `HMAC(secret, sid)`、cookie 加 `__Host-` 前綴、前端複製到自訂 header）；CORS 來源逐一列出 |
| **反例** | 把 token 放進 Zustand 或任何前端 store——`httpOnly` 的意義就是 JS 讀不到它，會這樣寫表示架構被誤解了；每個寫入端點各自檢查 CSRF；**或把 CSRF 做成只比對 cookie 與 header 是否相等**——那種擋不住子網域覆寫 cookie |
| **例外** | CSRF token 那個 cookie **刻意可被 JS 讀取**，那是 double-submit 的設計，不是漏洞；它靠 `__Host-` 前綴與 HMAC 綁定 session 來守住 |
| **檢查方式** | **待建置**。負向測試要涵蓋「缺 CSRF header」「header 與 cookie 不符」「HMAC 無效」三種；CORS 的 `allow_origins=["*"]` 已列在 ADR-028 的 Semgrep 禁令。**`credentials` 的統一責任位置是 [#108](https://github.com/label-suite/label-suite/issues/108) 的單一前端 HTTP client、cookie flags 的是後端單一發 cookie 的 helper**，兩者各要一條測試（斷言沒有第二處設 cookie、斷言元件不自己帶 credentials） |
| **來源** | [architecture.md](architecture.md) 的 token 表與 **2026-11-10 的 CSRF 裁定**。原始 repo `frontend.md` 的「**Zustand for auth token**」**不採用**——與 httpOnly 根本不相容。scaffold `auth-oidc.md` 的「token 只存在記憶體、由 `custom-fetch` 附加 Bearer」同樣**不採用**（那是 Bearer 架構） |

### S3 授權的四段順序

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/**` 的授權判定 |
| **禁止** | 把 JWT 的 `role` 當授權真相；讓系統管理員自動取得任務權限；未知的 permission key、缺少的矩陣列或層級不符時放行 |
| **正例** | 依序判定四件事：(1) 登入者、帳號啟用、`credential_version`、token family 仍有效；(2) 從 **DB** 讀目前的系統角色，任務範圍的操作另讀該任務目前有效的成員身分；(3) 操作解析成已啟用、在白名單內的 permission key 與它所屬的層，要求對應角色的 cell 為 `allowed=true`；(4) 再檢查附加條件（任務歸屬與狀態、指派與審核者身分、資料集可見性、答案隔離） |
| **反例** | `if jwt["role"] == "super_admin": allow`——`role` 只供顯示（ADR-037）；或 cell 為 `true` 就放行而不看第 (4) 段的附加條件 |
| **例外** | 無。**未知值或缺失一律拒絕**，不走「預設允許」 |
| **檢查方式** | **待建置**。第 (4) 段的每一種附加條件都要有負向測試 |
| **來源** | ADR-037（沿用）與 [architecture.md](architecture.md) §認證與授權 的四段敘述；ADR-021 的「任務角色不放進 JWT」。權限上限以 PRD §權限矩陣 為準，**不得放寬**（超出時照 07-01 的做法明寫上限並交給 [#85](https://github.com/label-suite/label-suite/issues/85)）。scaffold `auth-oidc.md` 的「角色只決定 UI 顯示、不作為資料能否取得的依據」**沿用**——那正是 `frontend.md` 寫錯那一條的正確版本 |

**系統角色與任務成員身分不得快取。** 它們每次請求都從 DB 取，所以一改，**授權**在下一個請求就生效。但這句話只涵蓋這兩樣——授權第 (3) 段要讀的**權限矩陣列、cell 與矩陣版本列**是典型的快取對象，要快取就**以矩陣版本列為失效鍵**。

**而且「下一個請求就生效」不適用於 JWT 裡的 `role`**：它在 access token 裡，效期 15 分鐘，所以顯示用的角色最多 stale 15 分鐘。真正的失效規則見 S4。

### S4 遮蔽與 allowlist 在後端

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/modules/**` 的回應 schema；`frontend/src/**` 的渲染 |
| **禁止** | 回傳裸 ORM model；前端自己依角色決定要不要藏值；用「前端藏按鈕」代替後端拒絕 |
| **正例** | 回應 schema **明確 allowlist** 欄位；該遮蔽的由後端標記（例如欄位列在遮蔽清單裡），前端只負責把它渲染成「已遮蔽」 |
| **反例** | `return task`（ORM 物件直接序列化，將來加一個欄位就外洩）；或前端 `if (role !== 'project_leader') hideField()`——那是體驗，不是授權 |
| **例外** | 無 |
| **檢查方式** | **待建置**。可用「回應 model 必須明列欄位、不得 `from_attributes` 全收」的審查項；遮蔽欄位用 Decision Table 驗 |
| **session 與快取的失效規則** | **PRD §權限矩陣 已定**：「停用後該帳號登入狀態失效；角色變更從下一次操作起生效」。落地方式：**帳號停用、系統角色變更、任務成員身分變更時，`credential_version` 加一並撤銷該使用者的 refresh token family**——照 [architecture.md](architecture.md) 已有的 SSO 綁定做法（同一筆交易內加一並撤銷所有 session）。權限矩陣若要快取，失效鍵是矩陣版本列 |
| **來源** | 原始 repo `api.md` 的「Response schemas must be explicit — never return raw ORM models」**沿用**；scaffold `auth-oidc.md` 的「欄位列在 `maskedFields` 時顯示『已遮蔽』，不自己依角色判斷」**沿用原則** |

### S5 答案隔離的覆蓋面

| | |
| :--- | :--- |
| **適用路徑** | 標記員能到達的**每一個**出口 |
| **禁止** | 在標記員能接觸到的任何地方出現標準答案或測試集辨識資訊——**覆蓋面包括** API 回應、列表與詳情、下載與匯出、輪詢結果、快取、瀏覽器 bundle 與 source map、公開 fixture 與 mock handler、錯誤訊息與 log |
| **正例** | 以標記員身分打他能到達的每一個端點，斷言 payload 裡沒有答案；fixture 與 mock 用不帶答案的資料 |
| **反例** | 錯誤訊息裡回「期望值是 X」；或 mock handler 直接複製一份含答案的真實回應 |
| **例外** | 無。這是 `AGENTS.md` 硬性規則 6 |
| **檢查方式** | **待建置**。`acceptance-verifier` 的檢查清單已有這一項（以標記員身分逐端點斷言），但它要等有端點才跑得起來 |
| **來源** | `AGENTS.md` 硬性規則 6；[architecture.md](architecture.md) §測試集答案隔離 的四道；規格 03-02 與 04-01 已把它寫成卡控與 Scenario。**覆蓋面那一串是 #107 工作項 5 列的**，本條照收 |

### S6 受控答案表與 worker 的讀取邊界

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/**`、Celery task、`frontend/src/**` |
| **禁止** | 瀏覽器下載答案再算分；在 API 行程裡讀答案表；把答案表與一般標記資料放同一張表 |
| **正例** | 答案存在**獨立、受存取控制的資料表**；`load_answers()` 只在 **worker 行程內**執行，答案不離開 worker；計分與 IAA 在後端算完才回結果 |
| **反例** | 前端 `GET /answers` 然後在瀏覽器比對——答案一旦進 bundle 就等於公開 |
| **例外** | 無 |
| **檢查方式** | **待建置**。負向驗收要涵蓋**跨角色與跨任務的直接請求**（標記員直接打審核員的端點、打別的任務的資源） |
| **來源** | ADR-005／ADR-007；[architecture.md](architecture.md) 的隔離四道表（資料庫列與 Celery worker 列）。**跨角色與跨任務的負向驗收是 #107 工作項 6 要求的** |

### S7 設定驅動的界線

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/**` 的核心路徑 |
| **禁止** | 用任務名稱特判；寫死 `task.type` 的分支；**為了新增一種研究任務而改核心程式** |
| **正例** | 任務用 `input_type` 加 `outputs[]` 的組合模型；既有 output type 的 UI、驗證與評分透過**明確的 registry 邊界**擴充 |
| **反例** | `if task.name == "醫療文本情感分類": ...`；或 `match task.type: case "sentiment": ...` |
| **例外** | **新增一個 output primitive 是程式工作**，與「只改任務設定」要分清楚：前者要開 issue 走正常流程，後者不該碰程式 |
| **檢查方式** | **待建置**。`acceptance-verifier` 的清單已有「換一種 `input_type` 加 `outputs[]` 的組合，同一條路徑仍然走得通」 |
| **來源** | `AGENTS.md` 硬性規則 5；ADR-010（沿用原則，config schema 已由 ADR-029 取代）；[architecture.md](architecture.md) §任務設定 |

### S8 設定的驗證與 span 的表示

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/**` 讀任務設定的地方；序列標記相關的程式 |
| **禁止** | **`eval` 或任何動態執行設定提供的程式**；接受未經 schema 驗證的設定；回退已淘汰的 token 對齊模型 |
| **正例** | 設定走 schema 驗證加允許清單；**驗證 output 之間的依賴與循環**；span 用**半開字元 offset** |
| **反例** | `eval(config["scoring_expr"])`——設定是使用者可控輸入，等於遠端執行；或用 token index 表示 span |
| **例外** | 無 |
| **檢查方式** | **待建置**。「不得出現 `eval`／`exec`」可靜態擋；循環依賴要有測試 |
| **來源** | ADR-029（config schema）；**ADR-031 已 Superseded，明寫「改成半開字元 offset span」**，所以回退 token 對齊是回到被取代的模型；`AGENTS.md` 硬性規則 9（輸入驗證，#105 新增） |

### S9 稽核、脫敏與保留

| | |
| :--- | :--- |
| **適用路徑** | `backend/app/**` 寫稽核的地方；所有 log |
| **禁止** | 更新或刪除 `audit_events` 的列；把 PII 或 secret 寫進 log；對帶答案的歷史做匿名化或單獨刪除；**為了「清理輸入」而改寫研究原文** |
| **正例** | **刪除與保留的規則本體在 [backend-agent-rules.md](backend-agent-rules.md) 的 B8**（`audit_events` append-only、過了最短保留期只能墓碑化、帶答案的歷史不匿名化不單獨刪除），本條不重寫它、只補安全面：log 裡的 PII 與 secret **脫敏**；XSS 由**安全渲染**處理（輸出轉義），**不是改輸入** |
| **反例** | 四個，對應上面三件事加原文改寫：<br>• append-only：`UPDATE audit_events SET actor_id = NULL WHERE ...`——補救 PII 不能靠改稽核列，要用墓碑化<br>• 脫敏：`logger.info(f"reset_url={url}")`——寄信降級把設定密碼連結印在伺服器 log，那條 log 本身就是敏感資料，不得再帶進一般 log 管道<br>• 保留規則：單獨 `DELETE` 一列帶答案的歷史 JSON——它要跟著所屬的資料集版本或 run 存續<br>• **為了防 XSS 把標記文本裡的 `<` 換成 `&lt;` 存進資料庫**——那會破壞 span 的字元 offset，而 offset 是序列標記的基礎 |
| **例外** | 無 |
| **檢查方式** | **人工／獨立審查**加**待建置**。append-only 可用資料庫層的規則擋 `UPDATE`／`DELETE`；「不改寫原文」要靠審查 |
| **來源** | ADR-038（沿用）；[architecture.md](architecture.md) 的保留政策與「事件列永遠不刪，過了最短保留期後只能把 PII 欄位墓碑化」。**「輸入驗證不任意改寫研究原文以免破壞 span」是 #107 工作項 9 明文**，與 S8 的半開 offset 相扣 |

### S10 驗收矩陣

| | |
| :--- | :--- |
| **適用路徑** | `backend/tests/**`、E2E |
| **禁止** | **用固定角色的假資料取代真實授權路徑**（例如測試裡直接塞一個 `role="super_admin"` 的假 user 繞過授權判定） |
| **正例** | 每一個受保護端點的驗收涵蓋：**未登入、帳號停用、session 失效、非該任務成員、換成另一個任務、矩陣列缺失、矩陣 cell 為拒絕、以及每一個有效角色** |
| **反例** | 只測「管理員可以、匿名不行」兩種，中間那些（停用、失效、非成員、別的任務）全沒測——而那幾種正是實際會出事的 |
| **例外** | 無 |
| **檢查方式** | **待建置**。測試分層與證據要求歸 [#110](https://github.com/label-suite/label-suite/issues/110)，本條只定矩陣要蓋哪幾格 |
| **來源** | #107 工作項 10 列的八種情形，本條照收。scaffold `auth-oidc.md` 的「每個端點涵蓋無 token、viewer、admin 三種」**沿用原則但不夠**——本專案的角色多一層（系統角色加任務成員身分），所以矩陣要寬得多 |

---

## 刻意不採用的來源條文

| 不採用 | 出處 | 為什麼 |
| :--- | :--- | :--- |
| 「Zustand 存 auth token」 | 原始 repo `frontend.md` §State management | 與 httpOnly cookie **根本不相容**——`httpOnly` 的意義就是 JS 讀不到。#107 工作項 2 明文禁止前端儲存或讀取 token |
| 「System role 從 JWT 取」當成授權依據 | 原始 repo `frontend.md` §Role model | ADR-037：`role` **只供顯示**，授權不看它。用它決定顯示哪一種版面可以，當成能否取得資料的依據不行 |
| 外部 OIDC ＋ `Authorization: Bearer` ＋ token 只存記憶體 | scaffold `auth-oidc.md` §模式、§前端鐵律 | 架構不同。本專案走自己的 cookie／session（ADR-021），Google SSO 是直接 OIDC 整合換發自己的 cookie（ADR-035），不引入外部 IdP |
| `/dev/auth/token` 這類 dev-token 路由 | scaffold `auth-oidc.md` §模式 | #107 工作項 1 明文禁止。「非 dev 模式回 404」不是安全邊界，只是把風險藏起來 |
| 「寫入端點只給 `admin`，viewer 回 403」 | scaffold `auth-oidc.md` §後端鐵律 | 兩個角色的模型套不上本專案。本專案是系統角色加任務成員身分兩層，權限由 PRD §權限矩陣 的 cell 決定 |
| **「角色只從 token 取：不讀 query、body、header（除 `Authorization`）或 DB 裡前端可改的欄位來決定角色」** | scaffold `auth-oidc.md` §後端鐵律 2 | **本專案正好相反**：系統角色每次從 **DB** 讀，JWT 的 `role` 只供顯示（ADR-037）。照這一條做就是 S3 明文禁止的「把 JWT 的 `role` 當授權真相」。**這是整份來源裡最危險的一條**，所以單獨列出來 |

---

## 來源對照

**這兩張表的範圍只含安全相關的條文。** 來源檔裡的非安全條文（`frontend.md` 的 ADR-011 切片與 `shared/` 准入規則、§Localization、§Icons、§TypeScript Code Style；`api.md` 的分頁與狀態碼慣例）**刻意不在這裡對照**，歸 [#108](https://github.com/label-suite/label-suite/issues/108)／[#109](https://github.com/label-suite/label-suite/issues/109)。所以某一節沒出現在下表，是被排除、不是被漏掉。

### 原始 repo（`singyichen/label-suite@faf83356`）

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `api.md` §Auth & Permissions 的「受保護路由都要宣告 `current_user` dependency」 | **沿用** | 成為 S1 |
| `api.md` 的「權限檢查放 route handler 或專屬 `permissions.py`，不放 CRUD helper」 | **沿用原則** | 與 S3／S4 同向（授權在後端、不在資料層）；具體檔案位置依模組內分層 |
| `api.md` 的「任務範圍的操作要先驗 `task_membership`」 | **沿用** | 成為 S3 第 (2) 段 |
| `api.md` 的「`403` vs `404`：對無權限者隱藏存在時偏好 `404`」 | **沿用** | 與 [architecture.md](architecture.md)「被隱藏的任務要在不洩漏它存在的前提下回應」同向 |
| `api.md` 的「Response schemas must be explicit，不回裸 ORM model」 | **沿用（與 #108 分工）** | 同一條服務兩個目的：**本條取它的安全面**（allowlist 防欄位外洩）成為 S4；**合約面**（`response_model=` 每條路由必填、Pydantic 驗證）歸 [#108](https://github.com/label-suite/label-suite/issues/108)，[backend-agent-rules.md](backend-agent-rules.md) 也是這樣標的 |
| `frontend.md` §State management 的「Zustand 存 auth token」 | **不採用** | 見上表 |
| `frontend.md` §Role model 的「System role（JWT）」當授權依據 | **不採用** | 見上表 |
| `frontend.md` §Role model 的「任務角色不放 JWT、進任務頁另查成員身分」 | **沿用** | 與 ADR-021／S3 一致 |
| `frontend.md` §Role model 的「未知角色清掉 session 並導回登入」 | **沿用原則** | 與 S3 的「未知值一律拒絕」同向 |
| `general.md` §Security 三條 | **沿用** | 第一條（輸入驗證與淨化）已於 [#105](https://github.com/label-suite/label-suite/issues/105) 進 `AGENTS.md` 硬性規則 9；第二、三條在硬性規則 8、7 |

### scaffold（`fullstack-ai-sdd-workflow-scaffold`，本機）

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `auth-oidc.md` §後端鐵律 1 的「只信任驗證過的 token」 | **沿用** | 成為 S1 的核心 |
| `auth-oidc.md` §後端鐵律 的「全域 guard 預設都要登入，不需登入的明確標註」 | **沿用原則** | default-deny。本專案的落點是認證 dependency 加 S3 的四段 |
| `auth-oidc.md` §後端鐵律 3 的「權限一定在後端擋、guard 統一判斷、前端藏按鈕只是 UX」 | **沿用** | 成為 S4 |
| `auth-oidc.md` §後端鐵律 4 的後端那一半（service 依角色組回應 DTO、被遮蔽欄位回 `null`、欄位保留） | **沿用原則，但位置不同** | 遮蔽的決定在後端這一點沿用；它把遮蔽放在 service，而 [architecture.md](architecture.md) 的分層表把回應組裝放在 Router——**本專案依分層表** |
| `auth-oidc.md` §前端鐵律 的「401 清 session 導回登入、403 顯示無權限且不重試」 | **沿用原則** | 落點歸 [#109](https://github.com/label-suite/label-suite/issues/109)（前端），本條只記對照 |
| `auth-oidc.md` §測試要求 的「遮蔽欄位以 Decision Table 驗證」 | **沿用** | S4 的檢查方式用的就是它 |
| `auth-oidc.md` 的「401 與 403 分清楚」 | **沿用** | 但 `403` vs `404` 的取捨依本 repo（見上） |
| `auth-oidc.md` 的「錯誤訊息不洩漏驗證細節」 | **沿用** | 成為 S9 的 log 脫敏與 S1 的錯誤回應 |
| `auth-oidc.md` §前端鐵律 的「角色只決定 UI 顯示，不作為資料能否取得的依據」 | **沿用** | 成為 S3；**這是 `frontend.md` 寫錯那一條的正確版本** |
| `auth-oidc.md` §前端鐵律 的「欄位列在 `maskedFields` 時顯示『已遮蔽』」 | **沿用原則** | 成為 S4 |
| `auth-oidc.md` §測試要求 的「每端點涵蓋無 token、viewer、admin」 | **沿用原則但不夠** | 成為 S10，但本專案的矩陣要蓋八種情形 |
| `auth-oidc.md` §模式（外部 OIDC、Bearer、dev-token）、§後端鐵律 的兩角色模型 | **不採用** | 見上表 |

### starter-kit

**對不上。** #107 點名它的 `backend/security.md`。延續 [#106](https://github.com/label-suite/label-suite/issues/106) 的實查結果（`trendlink` 24 個 repo 的 tree、個人帳號、本機 `find`，查核日期 2026-11-10），該 repo 底下沒有這一份；本機唯一叫 starter-kit 的 `whest-starterkit` 是科學計算起始包。

維護者 2026-11-10 已在 [#105](https://github.com/label-suite/label-suite/issues/105) 裁定該來源不存在或已不適用。**不編造對照。**

---

## 變更紀錄

| Issue | 日期 | 變更 |
| :--- | :--- | :--- |
| [#107](https://github.com/label-suite/label-suite/issues/107) | 2026-11-10 | 初版。十條規範（各帶適用路徑、禁止、正反例、例外、檢查方式與來源）、五條刻意不採用的來源條文、原始 repo 與 scaffold 的逐條對照。另依維護者當日的兩項裁定更新 [architecture.md](architecture.md)：可接受的身分來源只有 httpOnly cookie（原文那句自相矛盾的敘述是筆誤），以及 CSRF 加 double-submit token 的顯式防護 |
| [#107](https://github.com/label-suite/label-suite/issues/107) | 2026-11-10 | 獨立審查後修五處：**S4 補 session 與快取的失效規則**（工作項 4 要的「須有規則」原本沒落點，而 PRD §權限矩陣 早已寫了「停用後登入狀態失效；角色變更從下一次操作起生效」，初版沒引用它）；**S3 的「授權不讀快取」收斂**（原本把「沒有規則」寫成「不需要規則」，而且漏了權限矩陣本身是快取對象、以及 JWT 裡的 `role` 會 stale 15 分鐘）；**CSRF 改成綁定 session 的 double-submit 加 `__Host-` 前綴**（初版那種只比對 cookie 與 header 的 naive 版本**擋不住它自己點名的子網域威脅**，而且初版說「開 CORS 例外也失守」對 SameSite 是錯的——SameSite 由瀏覽器強制、與伺服器 CORS 無關）；**S9 補三個反例**（工作項 9 要求三件事「均有正反例」，初版只有一個）；scaffold 的來源對照補六列，其中 §後端鐵律 2「角色只從 token 取」改列**不採用**——它與 S3 正面衝突，初版既未沿用也未排除 |
