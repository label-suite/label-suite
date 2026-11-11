---
title: '測試與交付證據規範'
description: '三層測試的範圍與生命週期、TDD、行為測試與自證測試的界線、integration 的真實邊界、隔離與清理、外部替身、決策表、E2E 選擇器、開發前要落實的自動 gate、覆蓋率、evidence、兩個停點。附來源逐條對照。'
category: '開發說明'
tags: [開發說明, Agent, 規範, 測試]
createdAt: '2026-11-10'
updatedAt: '2026-11-11'
---

# 測試與交付證據規範

:badge[Issue #110]{variant="neutral"} :badge[正式開發前]{variant="warning"}

> `AGENTS.md` 是**規則本體**。這一份是測試與交付證據那一塊的說明，由 `AGENTS.md` 的 Agent Rules Index 指過來。
> 兩邊說法不同時**以 `AGENTS.md` 為準**，並回報給維護者。
> 跨領域在 [agent-rules.md](agent-rules.md)、後端在 [backend-agent-rules.md](backend-agent-rules.md)、授權與答案隔離在 [security-agent-rules.md](security-agent-rules.md)、
> API 契約在 [api-agent-rules.md](api-agent-rules.md)、前端在 [frontend-agent-rules.md](frontend-agent-rules.md)，這裡不重複。

**`backend/`、`frontend/` 與 `e2e/` 目前都不存在**，所以下面每一條的「檢查方式」幾乎都還沒有自動檢查。標「待建置」就是字面意思，**不得因為這份文件存在就宣稱測試或 gate 已經在跑**——這一點對本文件特別重要，因為它談的就是「怎麼證明事情做完了」。

## 兩個前提

| 前提 | 狀態 |
| :--- | :--- |
| 三層的工具與位置 | 已定（[architecture.md](architecture.md) §測試分層）：後端 pytest 加 pytest-asyncio 加 httpx 放 `backend/tests/`；前端 Vitest 加 React Testing Library 與原始碼同目錄；正式 E2E 用 Playwright 放根目錄 `e2e/[module]/[page].spec.ts`。TDD 依 ADR-009，**測試與實作在同一個 task**（`openspec/config.yaml` 的 `rules.tasks`） |
| 覆蓋率門檻 | **維護者 2026-11-10 裁定：只管「不得下降」加關鍵路徑 90% 分支覆蓋**，不把整體 80% 寫成硬閘。分母排除生成程式（Orval 產物）、Alembic migration 與設定檔。「關鍵路徑」的**五項範圍也已裁定**（維護者 2026-11-10 裁定維持五項），見 T10 |

---

## 規範

每一條交付**適用路徑、禁止事項、正例、反例、例外條件、檢查方式、來源**。

### T1 三層的範圍、位置、指令與生命週期

| | |
| :--- | :--- |
| **適用路徑** | `backend/tests/**`、`frontend/src/**/*.test.ts(x)`、`e2e/**` |
| **禁止** | **把用 httpx 打 API 的測試叫成 E2E**；把跨頁旅程寫成元件測試；把純 UI 邏輯拿去 Playwright 測；在三層以外另立第四種名字；測試檔放在與下表不同的位置 |
| **正例** | 見下表。名詞只有三個：**unit**、**integration**、**e2e**；`tasks.md`、PR 本文與 commit 訊息都用這三個字 |
| **反例** | `e2e/annotation/submit.spec.ts` 裡其實是用 httpx 打 `/api/v1/...`（那是 integration）；用 Playwright 驗一個日期格式化函式 |
| **例外** | 無。跨層的補充覆蓋允許，但**要寫明哪一層是主責**（見 T3 正例的最後一句） |
| **檢查方式** | **待建置**。位置與命名可由 CI 的路徑規則檢查；「名字對不對」要靠審查 |
| **來源** | [architecture.md](architecture.md) §測試分層（工具、範圍、位置、三層不重疊）**沿用**；ADR-009、012、034。**「用 Supertest 打 API 叫 integration，不叫 e2e」**來自 scaffold `testing.md` §測試名詞**沿用**（本 repo 換成 httpx）；原始 repo 的位置慣例**部分沿用**：後端 `tests/[module]/test_[file].py` 與 e2e `e2e/[module]/[page].spec.ts` **沿用**；**前端的 `src/[module]/__tests__/[file].test.tsx` 不採用**——本 repo 依 ADR-012 與 [architecture.md](architecture.md) §測試分層 是**與原始碼同目錄**，照來源寫會撞上本條禁止格的「測試檔放在與下表不同的位置」 |

| 層 | 工具 | 範圍 | 位置 | 指令 |
| :--- | :--- | :--- | :--- | :--- |
| unit | pytest（後端）／Vitest（前端） | 純函式、service、hook、單一元件 | `backend/tests/[module]/test_*.py`；前端與原始碼同目錄 `*.test.ts(x)` | `uv run pytest`／`pnpm test` |
| integration | pytest 加 httpx（後端）／Vitest 加 RTL 加 MSW（前端） | 真實路由、認證與授權、真 test DB；前端到網路邊界為止 | `backend/tests/integration/**`；前端同上 | `uv run pytest -m integration`／`pnpm test` |
| e2e | Playwright | 跨頁、跨角色的使用者旅程，真前後端加真瀏覽器 | 根目錄 `e2e/[module]/[page].spec.ts` | `pnpm exec playwright test` |

**生命週期**：unit 不碰檔案、網路與資料庫；integration 自己起、自己清（T5）；e2e 用 `e2e/shared/fixtures/` 的各角色 `storageState` 與 seed helper，不在測試裡重新登入（T8）。

### T2 TDD 與紅燈的原因

| | |
| :--- | :--- |
| **適用路徑** | 所有測試與對應的實作 |
| **禁止** | 先寫實作再補測試；**紅燈原因沒確認就改實作**；修 bug 沒有先寫出能重現它的測試；把測試拆成獨立的 task；用「加了 N 個測試」當成驗收 |
| **正例** | Red→Green→Refactor：先寫會紅的測試，**確認紅的原因是「功能還沒做」**而不是語法、import 或替身設定錯；再寫剛好讓它綠的實作；再重構。修 bug 的順序是「先寫一個紅的重現測試 → 修 → 那個測試變綠」 |
| **反例** | 測「衝突要回 409」卻紅在「找不到資料」——那是替身的供應被吃光了（見下），**這時候去改實作會把對的程式改壞**；在 `tasks.md` 開一個「補測試」的 task |
| **例外** | 既有程式沒有測試而這次要改它時，允許先補一個描述**現況**的測試當安全網，但要在 PR 寫明那不是 TDD 的紅燈 |
| **檢查方式** | **待建置**，而且這一條**本質上沒有機械檢查**：事後看不出測試是先寫還是後寫。由 `code-reviewer` 看 commit 順序與測試是否真的會紅 |
| **來源** | ADR-009 與 [architecture.md](architecture.md)（TDD、測試與實作同一個 task）**沿用**；scaffold `testing.md` §TDD 的三步與「**測試紅了先判斷是測試缺陷還是實作缺陷，未確認前不改實作**」**沿用**；「不以測試數量代替驗收行為」是 #110 工作項 2 明文，本條照收 |

**假紅的指紋來自 duty-mate 的一次事故，值得照搬的是紀律而不是寫法。** 它的 `jest-mock-queue.md` 記著：`await expect(...)` 每出現一次就是**一次真實呼叫**，所以用「只供應一次」的替身鋪佇列時，第二個斷言會拿到空值，SUT 走進「查無此筆」分支，**錯誤訊息完全不是你在測的那件事**。它的結論是「**看到前置檢查類例外出現在不該出現的測試裡，先數替身的供應次數，不要去改實作**」。pytest 的對應陷阱是 `side_effect` 清單被耗盡後丟 `StopIteration`。**#110 工作項 5 明文要求不得把 Jest 的佇列修法逐字搬過來**，所以這裡收的是紀律：**紅燈的原因沒確認之前，不動實作**。

### T3 測行為，不測自己

| | |
| :--- | :--- |
| **適用路徑** | 所有測試 |
| **禁止** | 用「原始碼含有某個字串」、regex 或 AST 片段、函式簽章存在、設定鍵存在這類**自證測試**充當功能驗收；把架構或政策的靜態檢查混在功能測試裡而不標明；斷言實作細節（私有方法被呼叫幾次、內部狀態）；**快照測試**——它破了也沒有意圖，不能當行為驗收 |
| **正例** | 斷言**可觀察的結果**：HTTP 回應的欄位值、資料庫裡那一列的內容、畫面上使用者看得到的文字與狀態、稽核事件有沒有寫進去。測試名稱**寫行為與預期**（「審核員刪任務回 403」）而不是實作細節；**一個測試只驗一件事**（一個邏輯行為一個斷言，共用 setup 時才合併成一個測試）。同一個 Scenario 跨層都有覆蓋時，**只有一層是主責**，其他層寫的是補充、**不能取代主責那一層**。架構與政策檢查**可以**用靜態分析，但要放在獨立的 lint 工作並**標成 lint**（例如「import 邊界 lint」），不計入功能驗收 |
| **反例** | `assert "credentials" in Path("frontend/src/api/mutator.ts").read_text()`（證明的是字串存在，不是 cookie 真的被送出）；`assert hasattr(service, "anonymize_user")`；把「每個 router 都有 `response_model=`」寫成一個 `test_api_contract` 放進功能測試的計數裡 |
| **例外** | 架構與政策的靜態檢查本身是合法且必要的（見 T9），只是不能冒充行為測試。生成產物的 drift 比對（[api-agent-rules.md](api-agent-rules.md) A5）同樣屬 lint 類 |
| **檢查方式** | **待建置**。可用命名與目錄把 lint 類與行為類分開（例如 `backend/tests/lint/`），讓計數與報表分得清楚；判斷某個測試是不是自證仍要靠審查 |
| **來源** | #110 工作項 3 列的四種自證形式（source includes、regex／AST 片段、簽章、config key 存在），本條照收。**owner layer 的概念取自 `trendlink/trendlink-portal` 的 `.claude/rules/testing-architecture.md`**（每個 Scenario 只有一個主責層，其他層只能寫補充、不能取代），本文件沿用它的**原則**；它的 ledger 與骨架產生器是工具，依本張附註歸 [#111](https://github.com/label-suite/label-suite/issues/111)，不在這份文件偷渡實作 |

### T4 integration 的真實邊界

| | |
| :--- | :--- |
| **適用路徑** | `backend/tests/integration/**` |
| **禁止** | mock ORM 或 session 來「測資料庫」；繞過認證或授權 dependency 直接呼叫 service 當成 API 測試；**harness 比 production 寬鬆**（少一個 middleware、放寬驗證、關掉 CSRF）；只在一種資料庫上跑 migration |
| **正例** | 打真實路由（httpx 的 ASGI transport 或起一個 test server）、經過真的認證與授權 dependency、連真的 test DB；**harness 與 production 共用同一個 app 組裝函式**；**SQLite（Lite）與 PostgreSQL 兩層各自跑完 migration**，並對涉及差異的行為各有測試 |
| **反例** | `monkeypatch` 掉授權 dependency 以免準備成員資格——那會讓最該被測的那一段永遠沒被測到；用 SQLite 的結果宣稱 PostgreSQL 也可以 |
| **例外** | **反向不在此限**：harness 比 production 更嚴格（多一層斷言），或把**外部**依賴換成替身（T6），都允許。「測試要多做一層才會過」代表產品碼有問題，不是幫測試補一層 |
| **檢查方式** | **待建置**。「harness 與 production 同構」可由共用組裝函式在結構上保證；雙資料庫要靠 CI 跑兩輪 |
| **來源** | 原始 repo `testing-backend.md` 的「**資料庫測試要用真的 test DB，不 mock ORM 層**」**沿用**；scaffold `integration-test-http.md` **鐵律三「harness 不得比 production 寬鬆」與鐵律四「真 test db、schema 以 migration 建立」沿用**（含「反向與外部替身不在此限」那句例外）；雙資料庫來自 ADR-024 與 [backend-agent-rules.md](backend-agent-rules.md) B6、B7。**它的 `AUTH_MODE=dev` 測試 token 不採用**——本 repo 在 [#107](https://github.com/label-suite/label-suite/issues/107) 的 S1 已明文禁止 dev-token 模式，測試要走真的登入或簽一個真的 session cookie |

### T5 隔離、清理與生命週期

| | |
| :--- | :--- |
| **適用路徑** | `backend/tests/**` 的 fixture 與 `e2e/shared/fixtures/**` |
| **禁止** | 測試之間共用可變資料而沒有隔離；測試結果隨執行時間變化（沒有固定時鐘）；在各個 spec 各自寫一份測試帳密；清庫時清掉別人的資料（`TRUNCATE` 全表、刪整個資料夾）；fixture 沒有 teardown；沒有 timeout 的等待；把輸出直接 pipe 給 `head`／`less` 之後讀退出碼 |
| **正例** | 每個測試**自己準備、自己清**，或整個測試包在交易裡最後 rollback；檔案與上傳用 pytest 的 `tmp_path`；**資料建構的 factory helper 放 `backend/tests/factories/`**，不在測試本體裡堆大量資料；**E2E 的測試帳密以 `playwright.config.ts` 與 `e2e/shared/fixtures/` 為單一來源**，不散在各 spec；**時間用假時鐘固定**，不依賴執行當下的時間；明確寫出啟動、連線、timeout 與 teardown；共用同一個 test DB 的測試**同時只跑一個行程**；長輸出**先落檔再讀**，退出碼才不會失真 |
| **反例** | `conftest.py` 在 session 層建一筆任務讓二十個測試共用並各自改它；`await conn.execute("TRUNCATE tasks")`；`pytest ... \| head -50` 之後以為 exit 0 就是過了（EPIPE 會截斷輸出並讓退出碼失真） |
| **例外** | 唯讀的參考資料（輸出類型定義之類）允許在 session 層建立一次。**本條不照搬來源的框架修法**：scaffold 與 duty-mate 那套 `listen(0)`／`closeTestApp` 與 Jest 佇列的細節屬 NestJS 與 Jest，pytest 沒有對應問題 |
| **檢查方式** | **待建置**。平行安全性要靠實際跑 `-n auto` 之類的平行模式才看得出來；「只清自己的資料」要靠審查 |
| **來源** | 原始 repo `testing-backend.md` 的 fixture 慣例**沿用**；scaffold `integration-test-http.md` 的**紀律沿用**（同時只跑一個共用 test DB 的行程、輸出先落檔再讀、`--detectOpenHandles` 綠燈不代表沒有 open handle、間歇性問題要能重現才算結案），**它的 NestJS 生命週期修法與 duty-mate 的 Jest 佇列修法都不逐字搬**——#110 工作項 5 明文 |

### T6 外部替身設在邊界上

| | |
| :--- | :--- |
| **適用路徑** | 所有層的測試設定與 fixture |
| **禁止** | 測試連到正式的第三方服務；在公開 fixture 放真的 token、金鑰或**標準答案**；用前端的 MSW 替代後端的授權驗證；在 service 內部 mock 掉「寄信」這件事本身而不是它的傳輸邊界 |
| **正例** | 替身放在**網路或協定邊界**：寄信（ADR-013 的 Resend）在 HTTP 客戶端那一層換掉、Google OIDC（ADR-035）在 token 端點那一層換掉；前端用 MSW 攔 HTTP；授權一律由**真後端**驗（T4） |
| **反例** | 測試用真的 Resend API key 寄一封信出去；fixture 裡放一份有標準答案的資料集；前端測試用 MSW 回一個「管理員」身分就宣稱權限測過了 |
| **例外** | Lite 層沒有 Resend key 時把設定密碼連結印在伺服器 log（維護者 2026-11-10 裁定），**那個降級路徑本身要有測試**；而且依該裁定的連帶要求，**Lite 層的 log 視為敏感**，測試產出不得外流 |
| **檢查方式** | **待建置**。可用 CI 的 secret 掃描擋住 fixture 裡的金鑰（見 T9）；「答案不在 fixture 裡」屬 [security-agent-rules.md](security-agent-rules.md) S5 的覆蓋面 |
| **來源** | `AGENTS.md` 硬性規則 6（測試集答案不外露）與 8（祕密只從環境變數來）；ADR-013、ADR-035 與 2026-11-10 的 Resend 降級裁定；scaffold `testing.md` 的「web 端以 MSW handler 模擬 API（優先用 Orval 產生的 mock），**不 mock `fetch` 本身**」**沿用**；`trendlink/trendlink-portal` `testing-architecture.md` 的 **L2-contract 層**（決定性替身、不連真實第三方）**沿用原則**。「MSW 不代替真後端的授權驗證」是 #110 工作項 6 明文 |

### T7 多維輸入用決策表

| | |
| :--- | :--- |
| **適用路徑** | 所有有兩個以上輸入維度的測試 |
| **禁止** | 用幾個「代表性案例」蓋過角色×成員資格×狀態的組合；把「缺值」當成一格（`null`、沒送、`false` 是三種）；只斷言 HTTP 狀態碼；重試與重複提交沒有測 |
| **正例** | 先列決策表再寫測試，**每列一個編號**（`D1`、`D2`…）並對回規格的 Scenario 或 design 的決策表；維度至少涵蓋**角色×任務成員資格×任務狀態**；**「缺值」拆成三格**：欄位存在但值是 `null`、欄位完全沒送、以及**值是 `false` 或其他 falsy**（`0`、空字串）——第三格最常被漏掉，而它正是下面那個事故的成因；邊界值各自一列（0、1、上限、上限 +1）；斷言**持久化的結果與回應欄位的值**，不只看 `200` |
| **反例** | 一個 `test_update_task` 測管理員改草稿任務就收工；`assert resp.status_code == 200` 之後不讀回來比對；只測「送一次」而不測重送同一筆 |
| **例外** | 單一維度且沒有邊界的輸入不必列表 |
| **檢查方式** | **待建置**。`pytest.mark.parametrize` 與 `it.each` 可以讓每一列各自成案例；表格是否齊全要靠審查，並與 [security-agent-rules.md](security-agent-rules.md) S10 的驗收矩陣對齊 |
| **來源** | scaffold `testing.md` §Decision Table 寫法**沿用**（編號對回 Scenario、缺值拆兩格、邊界值各一列、「斷言要看值，不只看狀態碼：建立後要讀回並比對欄位」）；**拆格有事故背書**——duty-mate `dto-boolean.md` 的決策表就是因為沒把「key 存在但值為 undefined」與「key 不存在」分開，漏掉了真正的缺陷；而它那次事故（2026-07-07「列入排班時好時壞」）**兩個方向都錯**，成因也有兩個：陣列 fall through，以及 **`Boolean('false') === true` 的隱式轉型**，所以 `false` 那一格是第三格而不是「缺值」的一種；角色×成員×狀態的維度來自 #107 的 S10 與 PRD §權限矩陣 |

### T8 E2E 的選擇器、設定與等待

| | |
| :--- | :--- |
| **適用路徑** | `e2e/**` |
| **禁止** | 用 CSS 選擇器或類別名定位；寫死 `localhost` 與埠號；固定 `sleep`／`waitForTimeout`；每個測試各自重新登入；**一個 spec 裡混多條旅程**；把 prototype 的 Playwright 測試搬進本 repo |
| **正例** | **一個 spec 一條旅程**（登入 → 操作 → 斷言），不同旅程分檔；優先 `getByRole()`／`getByLabel()`／`getByText()`；**prototype 已有的 `data-testid` 原字串沿用**到 React 元件與 `e2e/`（那是刻意保留的共用契約）；`baseURL` 集中在 `playwright.config.ts`；各角色的 `storageState` 放 `e2e/shared/fixtures/`；等待用條件式等待（`expect(...).toBeVisible()`、`waitFor`） |
| **反例** | `page.locator('.task-row > td:nth-child(3)')`；`await page.waitForTimeout(3000)`；在每個 spec 開頭走一次登入表單 |
| **例外** | 沒有語意替代時才用 `data-testid`——而本 repo 的 prototype 契約**就是那個例外的主要來源**，沿用它不算違規 |
| **檢查方式** | **待建置**。可用 lint 擋 `waitForTimeout` 與 CSS locator；`baseURL` 是否集中由設定檔結構保證 |
| **來源** | 原始 repo `testing-e2e.md` **沿用**（位置、一個 spec 一條旅程、role／label／text 優先、`storageState`、不寫死埠而讀 `baseURL`）；[architecture.md](architecture.md) 的「`data-testid` 的共用契約仍然值得沿用」與「ADR-014 的 prototype 層 Playwright 測試**不適用本 repo**，依 [#16](https://github.com/label-suite/label-suite/issues/16) 留在個人 repo」**沿用**；scaffold `testing.md` 的「不用 `setTimeout` 等待」**沿用** |

### T9 開發前要落實的自動 gate

| | |
| :--- | :--- |
| **適用路徑** | CI 與本機 hook（兩者呼叫同一組檢查器） |
| **禁止** | 在這份文件裡實作任何 gate；把「文件寫了」當成 gate 已存在；宣稱本機 hook 通過等於 CI 通過 |
| **正例** | 下表每一項都有**明確的歸屬 Issue**，實作在那裡做，本文件只定政策 |
| **反例** | 在這張 PR 裡加一支 lint 腳本或 CI job |
| **例外** | 無 |
| **檢查方式** | **全部待建置**。`backend/`、`frontend/` 與 `e2e/` 都不存在，所以七項裡沒有任何一項現在是跑著的 |
| **來源** | #110 工作項 9 列的七項，本條照收；歸屬依 [#111](https://github.com/label-suite/label-suite/issues/111) 自己寫的分工——「**#110 負責定義測試與 gate 政策，本單負責如何觸發與傳遞結果**」 |

| gate | 政策寫在哪 | 實作歸屬 |
| :--- | :--- | :--- |
| Python lint 與型別檢查 | [backend-agent-rules.md](backend-agent-rules.md) B2（`mypy --strict`、`ruff` 的 `D` 規則） | [#111](https://github.com/label-suite/label-suite/issues/111) |
| TypeScript strict 與 React Hooks | [frontend-agent-rules.md](frontend-agent-rules.md) F2、F3 | [#111](https://github.com/label-suite/label-suite/issues/111) |
| import 邊界（前端分層、後端分層） | F1 與 B1 | [#111](https://github.com/label-suite/label-suite/issues/111) |
| OpenAPI 與前端 client 的 drift | [api-agent-rules.md](api-agent-rules.md) A5 | [#111](https://github.com/label-suite/label-suite/issues/111) |
| migration 在 SQLite 與 PostgreSQL 兩層都能跑 | B6、B7 與本文 T4 | [#111](https://github.com/label-suite/label-suite/issues/111) |
| 授權與答案隔離的回歸 | [security-agent-rules.md](security-agent-rules.md) S5、S10 與本文 T7 | [#111](https://github.com/label-suite/label-suite/issues/111) |
| 依賴、secret 與 CORS 掃描 | `AGENTS.md` 硬性規則 7、8 與 ADR-028（SCA 加延後 SAST、Semgrep 擋 `allow_origins=["*"]`） | ADR-028 已定方向，串接歸 [#111](https://github.com/label-suite/label-suite/issues/111) |

### T10 覆蓋率

| | |
| :--- | :--- |
| **適用路徑** | 後端與前端的覆蓋率報告與 CI |
| **禁止** | 把「整體 80%」當成硬閘；讓覆蓋率在一張 PR 裡下降；把生成程式算進分母來墊高數字；用刪測試或關規則的方式讓數字過關 |
| **正例** | 兩條規則：（1）**不得下降**——每張 PR 的覆蓋率不低於它的基準；（2）**關鍵路徑 90% 分支覆蓋**，範圍是**五項**：認證、授權與權限檢查、答案隔離、評分、IAA 計算（見下）。分母**排除** Orval 產物、Alembic migration 與設定檔 |
| **反例** | 把 `src/api/generated/` 算進分母（產物是工具產生的，覆蓋它沒有意義，而且會讓整體數字看起來很高）；為了讓百分比好看而刪掉一個會紅的測試 |
| **例外** | 骨架期（`backend/`、`frontend/` 剛建立）尚無足夠程式時，「不得下降」以第一次測得的基準為準 |
| **檢查方式** | **待建置**。`pytest --cov` 與 `vitest --coverage` 可以產出報告；「不得下降」需要 CI 記住基準，歸 [#111](https://github.com/label-suite/label-suite/issues/111) |
| **來源** | **維護者 2026-11-10 裁定**（只管「不得下降」加關鍵路徑 90% 分支；分母排除生成程式、migration 與設定檔）。**「關鍵路徑」的五項範圍由維護者 2026-11-10 裁定維持**：來源（原始 repo `testing-backend.md`／`testing-frontend.md` §Coverage）寫的是三項（`auth`、`permission checks`、`score calculation`），本文件初版另外提議**答案隔離**（`AGENTS.md` 硬性規則 6 與 S5，違反就是測試集外洩）與**IAA 計算**（ADR-007 的 scoring 佇列算的就是它，屬 `score calculation` 的一部分），當日裁定兩項都採用。紀錄在 [#110 的這則留言](https://github.com/label-suite/label-suite/issues/110#issuecomment-6765792713)。兩個數字的出處本來就不同：**90% 關鍵路徑分支**來自原始 repo `testing-backend.md` 與 `testing-frontend.md`（「Critical paths (auth, permission checks, score calculation) require ≥ 90% branch coverage」）**沿用**；**整體 80%** 不在任何規則檔裡，而是原始 repo foundation spec 的 `SC-001`，**只管後端**而且自帶逃生條款（尚未達 80% 時正式 PR 不得再降低並須有提升計畫）——範圍不同，所以**不合成一條硬規定**，這正是 #110 工作項 10 要求先裁定的原因 |

### T11 evidence

| | |
| :--- | :--- |
| **適用路徑** | PR 的 Test Plan、`acceptance.md`、任何宣稱「測試通過」的回報 |
| **禁止** | 只寫「測試通過」而不附命令與結果；用快速子集的結果宣稱完整驗收；拿上一次的結果當這次變更的證據；**為了讓 CI 變綠而關掉規則、刪測試、加 `skip`**；提交 `.only`／`.skip`／`xfail` 而不說明 |
| **正例** | 每一項證據要有：**跑了什麼命令**、**在哪個 commit 上跑**（加工具版本）、**退出碼**、**實際執行的範圍**（幾個測試、哪些路徑）、以及**被跳過或被擋住的項目**。被擋住要寫原因（例如資料庫沒起來），**不得默默略過** |
| **反例** | 「pytest 全綠」沒有命令與 commit；用 `-k smoke` 的結果填完整的 Test Plan；資料庫連不上時測試自動 skip 而報表仍顯示綠 |
| **例外** | 快速子集可以在開發過程中用，但**不能出現在驗收欄位裡**；要在回報裡標明那是 quick pass |
| **檢查方式** | **待建置**。可用 lint 擋 `.only`／`.skip` 的提交；evidence 的欄位齊不齊由 `code-reviewer` 與 `acceptance-verifier` 檢查 |
| **來源** | #110 工作項 11 列的五個欄位與三條禁止，本條照收；`trendlink/trendlink-portal` `testing-architecture.md` 的**禁止 `.only`／`.skip`／`xit`（ESLint 與 pre-commit 都擋）沿用**，以及它的 **pre-commit 在「相關測試含 L2 而資料庫連不上」時擋下並提示、不默默略過**——那正是「skipped／blocked 要記錄」的具體做法；scaffold `testing.md` 的「不 commit `.only`、`.skip`」**沿用**；`integration-test-http.md` 的「輸出先落檔再讀，否則退出碼失真」與「間歇性問題要能重現才算結案」**沿用**（也落在 T5） |

### T12 接到既有的兩個停點

| | |
| :--- | :--- |
| **適用路徑** | `openspec/changes/*/acceptance.md` 與交付回報 |
| **禁止** | 新增第三個需要維護者確認的關卡；把技術驗證與人工驗收拆成兩次交付；在 PR 合併前關閉 Issue；把「測試全綠」當成停點二的通過 |
| **正例** | 依 `AGENTS.md` §SDD Workflow 的兩個停點：**停點一**在 `clarification.md` 之後（只問要維護者決定的 Q）、**停點二**在 apply 完成之後——`acceptance-verifier` 產出 `acceptance.md`，**技術驗證的 evidence 與人工驗收步驟一起提供**（啟動命令、網址、用哪個角色登入、開哪些畫面、預期看到什麼），維護者親自驗完才 `/opsx:archive` |
| **反例** | 在實作中途多問一次「這樣可以嗎」；`acceptance.md` 只有 pytest 輸出而沒有人工步驟；PR 還沒合併就把 Issue 關掉 |
| **例外** | **故障不是關卡但照樣停**：task 描述有歧義、實作中發現規格有問題、超出 `tasks.md` 範圍、命令失敗——這幾種要停下回報，與停點無關 |
| **檢查方式** | **待建置**。`acceptance.md` 的章節齊不齊可由 schema 檢查（歸 [#50](https://github.com/label-suite/label-suite/issues/50) 的驗收項）；「不提前關閉」由 `AGENTS.md` 的 Development Workflow 第 4 步規定 |
| **來源** | `AGENTS.md` §SDD Workflow 的兩個停點與「故障仍會停」**沿用**；[#50](https://github.com/label-suite/label-suite/issues/50) 的驗收條件（「apply 結束時產出 `acceptance.md` 與人工驗收步驟，停在停點二」）；`AGENTS.md` §Development Workflow 第 4 步（「PR 合併後才關閉 Issue」）。#110 工作項 12 明文「不額外新增維護者確認關卡」 |

---

## 刻意不採用的來源條文

| 不採用 | 出處 | 為什麼 |
| :--- | :--- | :--- |
| 整體 80% 當硬閘 | 原始 repo foundation spec `SC-001` | 維護者 2026-11-10 裁定只管「不得下降」加關鍵路徑 90%。該條只管後端且自帶逃生條款，範圍與 90% 那條不同 |
| `AUTH_MODE=dev` 的測試 token | scaffold `integration-test-http.md` 鐵律四 | [#107](https://github.com/label-suite/label-suite/issues/107) 的 S1 已明文禁止 dev-token 模式 |
| `createTestApp()` 的 `listen(0)`／`closeTestApp()` 生命週期修法 | scaffold `integration-test-http.md` 鐵律一、二 | NestJS 與 supertest 的框架細節，pytest 沒有對應問題。#110 工作項 5 明文不得逐字搬 |
| Jest mock 佇列的 `rounds` 寫法 | duty-mate `jest-mock-queue.md` | 同上。它的**紀律**（紅燈原因未確認前不改實作）沿用在 T2 |
| 診斷用的 `lsof` 埠號指紋與 `ps` 行程檢查 | scaffold `integration-test-http.md` 鐵律五、六 | 那是 Node 與 supertest 的臨時埠問題。「同時只跑一個共用 test DB 的行程」與「輸出先落檔」兩條原則沿用在 T5 |
| `testing-ledger.yaml`、Scenario ID 格式與骨架產生器 | `trendlink/trendlink-portal` `testing-architecture.md` | 那是**工具**，依本張附註要另開可追溯 Issue。owner layer 的原則沿用在 T3，實作歸 [#111](https://github.com/label-suite/label-suite/issues/111) |


---

## 來源對照

### 原始 repo（`singyichen/label-suite@faf83356`）

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `testing-backend.md` §General（TDD 必須、測試檔鏡像原始碼結構、一個邏輯行為一個斷言） | **沿用** | TDD 成為 T2、位置成為 T1、「一個邏輯行為一個斷言」成為 T3 的正例 |
| `testing-backend.md` §Backend（pytest fixture、真 test DB 不 mock ORM、`pytest-asyncio`、factory 放 `tests/factories/`、慢測試標 `@pytest.mark.integration`） | **沿用** | 成為 T1（`-m integration`）、T4（真 test DB）、T5（fixture 與 factory 位置） |
| `testing-backend.md`／`testing-frontend.md` §Coverage 的「新程式不得降低整體覆蓋率」與「關鍵路徑 ≥ 90% 分支」 | **沿用** | 成為 T10，正是維護者裁定採用的那兩條 |
| `testing-frontend.md` §Frontend（測行為不測實作、用 role／label／text 查元素、只在網路邊界 mock、**禁止快照測試**） | **沿用** | 成為 T3（含快照禁令）、T6、T8 |
| `testing-frontend.md` §Frontend 的「不手動包 `act()`，用 `userEvent`」 | **不在本文件** | 那是 React Testing Library 的寫法細節，不是測試政策；落在前端的元件測試慣例（[frontend-agent-rules.md](frontend-agent-rules.md) F3 的 Hooks 規則與 RTL 用法） |
| `testing-e2e.md`（位置、一個 spec 一條旅程、語意選擇器優先、`storageState`、不寫死埠、執行命令） | **沿用** | 成為 T1（位置與命令）與 T8（其餘四項，「一條旅程」在禁止與正例格） |
| foundation spec `SC-001` 的整體 80% | **不採用為硬閘** | 見上表與 T10 |

### scaffold（`trendlink/fullstack-ai-sdd-workflow-scaffold`）

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `testing.md` §測試名詞（三個名字、工具、位置、指令、誰寫；**Supertest 打 API 叫 integration 不叫 e2e**） | **沿用** | 成為 T1 |
| `testing.md` §TDD 的三步與「未確認紅燈原因前不改實作」、「修 bug 先寫重現測試」 | **沿用** | 成為 T2 |
| `testing.md` §Decision Table（編號對回 Scenario、缺值拆兩格、邊界值各一列） | **沿用** | 成為 T7 |
| `testing.md` §寫法慣例（行為式命名、一個測試一件事、**斷言要看值不只看狀態碼**、不用 `setTimeout` 等待、MSW 不 mock `fetch`、假時鐘、不 commit `.only`／`.skip`） | **沿用** | 行為式命名與一個測試一件事成為 **T3**、斷言看值成為 T7、不用 `setTimeout` 成為 T8、MSW 成為 T6、假時鐘成為 **T5**、`.only`／`.skip` 成為 T11 |
| `integration-test-http.md` 鐵律三（harness 不得比 production 寬鬆，含「反向與外部替身不在此限」） | **沿用** | 成為 T4 的例外格 |
| `integration-test-http.md` 鐵律四（真 Postgres test db、migration 建 schema、每個 spec 自己清） | **沿用** | 成為 T4、T5 |
| `integration-test-http.md` 鐵律四的 `AUTH_MODE=dev` token | **不採用** | 見上表 |
| `integration-test-http.md` 鐵律一、二、五（NestJS 生命週期與 `lsof` 診斷） | **不採用寫法，沿用紀律** | 見上表與 T5 |
| `integration-test-http.md` 鐵律六（同時只跑一個共用 test db 的行程、輸出先落檔再讀） | **沿用** | 成為 T5 與 T11 |
| `jest-mock-queue.md` | **沿用紀律** | 成為 T2 的假紅段 |

### duty-mate（`trendlink/duty-mate@c53cc453`，`develop`）

**本張點名的 `testing-architecture.md` 不在 `develop`。** 我用 contents API 列過 `.claude/rules/`：`develop` 有 **12 份**、沒有它；它在**未合併的 `codex/issue-89-testing-architecture` 分支**（13 份）。真正可讀的改寫版在 `trendlink/trendlink-portal`（見下節），那份檔頭自己就寫著「改寫自 DutyMate 同名規則」。查核日期 2026-11-10。

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| `jest-mock-queue.md`（替身供應被吃光造成假紅、先數佇列再動實作） | **沿用紀律** | 成為 T2 |
| `integration-test-http.md`（含 harness 不得寬鬆） | **沿用** | 與 scaffold 那份同向但**鐵律編號不同**（duty-mate 是三＝harness、四＝診斷指紋、五＝只跑一個行程、六＝輸出落檔，而且**沒有**「真 Postgres test db／`AUTH_MODE=dev`」那一條）。本文件引用的鐵律編號**一律指 scaffold 那份** |
| `dto-boolean.md` 的「缺值要拆成兩格」決策表要求 | **沿用** | 成為 T7 的事故背書 |
| `database.md` 的 **E2E 測試帳密以設定檔為單一來源**與測試清庫允許硬刪 | **沿用原則** | 兩項都成為 T5。清庫不是業務刪除，與 B8 不衝突——[backend-agent-rules.md](backend-agent-rules.md):203 當初把「E2E 測試帳密與測試清庫例外」明文延後到本張，現在接上了 |

### trendlink-portal（`trendlink/trendlink-portal`，`.claude/rules/testing-architecture.md`）

| 來源條文 | 處理 | 說明 |
| :--- | :--- | :--- |
| L1／L2／L2-contract／L3 分層與「**選能證明這個行為的最低層**」 | **沿用原則** | 本 repo 是三層（unit／integration／e2e），L2-contract 的「決定性替身、不連真實第三方」落在 T6 |
| owner layer：每個 Scenario 只有一個主責層，其他層只能寫補充（`[ID+]`）**不能取代** | **沿用原則** | 成為 T3 |
| `testing-ledger.yaml`、`[CAP-…-000]` ID 格式、骨架產生器與 `@signature` | **不採用（歸 #111）** | 工具，見上表 |
| 禁止 `.only`／`.skip`／`xit`，ESLint 與 pre-commit 都擋 | **沿用** | 成為 T11 |
| pre-commit 遇到「相關測試含 L2 而資料庫連不上」時擋下並提示，不默默略過 | **沿用** | 成為 T11 |
| 「不用 `--no-verify` 繞過；真的要繞先說明理由」 | **沿用原則** | 與 T11 的「不得關掉規則讓 CI 變綠」同向；hook 的實作歸 [#111](https://github.com/label-suite/label-suite/issues/111) |

### starter-kit

**這一次查出了它為什麼一直查不到。** #105 到 #110 每張都點名一個不同的 starter-kit 檔名（`core-principles.md`／`workflow.md`、`backend/architecture.md`／`backend/database.md`、`backend/api-design.md`／`frontend/api-client.md`、`frontend/react-typescript.md`、本張的 `test-quality.md`），五輪搜尋全部零命中。原因寫在 [#111](https://github.com/label-suite/label-suite/issues/111) 自己的來源表裡：

> 維護者提供的 starter-kit：`hooks/` 六份腳本及 `settings-snippet.json`

而該表其他列給的本機路徑是 `/Users/mandychen/mandy/project/...`——**那是維護者另一台機器的家目錄**（本機是 `/Users/mandy610425`，`/Users/mandychen` 不存在）。所以 starter-kit 是**維護者本機的一個目錄，不是 GitHub 上的 repo**，這個 loop 讀不到它。

本張另外查過的範圍（2026-11-10）：`trendlink` 組織 24 個 repo 的 tree（`truncated: false` 已確認）、`singyichen` 的全部 repo、`trendlink/lexpayroll`（**空 repo**，它宣告的子 repo `lexpayroll-api`／`lexpayroll-web` 在 `trendlink` 下是 404）、組織內以 `starter` 搜尋 repo 名稱（0 筆）、以及本機 `find ~`（只有 `whest-starterkit`，那是科學計算起始包，#105 已排除）。

**所以這一類的結論從「不存在」改成「存在但這個 loop 讀不到」**，而且 #111 已經規定「交付物不得依賴其他開發者擁有這些目錄」。要把它納入對照，需要維護者把那幾份檔案貼進 Issue 或放進本 repo。

---

## 變更紀錄

| Issue | 日期 | 變更 |
| :--- | :--- | :--- |
| [#111](https://github.com/label-suite/label-suite/issues/111) | 2026-11-11 | T10 的「關鍵路徑」範圍從「本文件提議、待裁定」改成裁定紀錄：**維護者 2026-11-10 裁定維持五項**（認證、授權與權限檢查、答案隔離、評分、IAA 計算）。前提表、T10 正例與來源三處同步。#110 已關閉，依硬性規則 1 折進 [#111](https://github.com/label-suite/label-suite/issues/111) 落地 |
| [#110](https://github.com/label-suite/label-suite/issues/110) | 2026-11-10 | 獨立審查後修兩個 High：**七處來源標「沿用／成為 T…」卻在十二條裡找不到落點**（一個邏輯行為一個斷言、factory 位置、禁止快照測試、一個 spec 一條旅程、行為式命名、假時鐘、E2E 帳密單一來源），每一處二選一處理完——補進 T3／T5／T8 的禁止或正例格，或改標「不在本文件」並寫去處（`act()` 那一項屬 RTL 寫法，歸 F3）；**T1 的來源把前端測試位置標成沿用**（`__tests__/`），而本 repo 依 ADR-012 是與原始碼同目錄，照來源寫會撞上同條禁止格，已改成部分沿用並在不採用表補一列。另修：T10 的兩項自訂關鍵路徑在正例與前提表就地標「待裁定」、T1 例外的指路改成實際存在的落點、duty-mate 章節補上 `@c53cc453`／`develop` 並寫明它的鐵律編號與 scaffold 不同、`dto-boolean` 的事故成因是兩個不是一個 |
| [#110](https://github.com/label-suite/label-suite/issues/110) | 2026-11-10 | 初版。十二條規範（各帶適用路徑、禁止、正反例、例外條件、檢查方式與來源）、六條刻意不採用、原始 repo 三份／scaffold 三份／duty-mate 四份／trendlink-portal 一份的逐條對照，以及 starter-kit 五輪搜尋後查出的真正原因。覆蓋率依維護者 2026-11-10 裁定寫成「不得下降」加關鍵路徑 90% 分支 |
