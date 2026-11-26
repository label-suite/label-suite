# Proposal

本份是 change `login-auth-guard`（Issue #719，Epic #712 帳號）的提案。範圍、設計與契約分別以 `system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md` 為準，這裡只收斂成「為什麼做、改了什麼、動到哪些 capability」。

**閱讀前提**：上游四份留下的待決與提案（sa 1–13、sd N1–N3、ui U1–U8，以及本份新發現的 PL1–PL5）都還**沒有定案**。下文凡標「**建議，待 clarification**」的範圍，是依上游的建議方案描述，由 clarification 那一個停點決定；選了別的方案時，本份與 specs、design、tasks 一起回修。完整清單見 [§待決問題](#待決問題)。

## Why

平台目前沒有任何認證、授權或跨站防護的共用元件，資料庫也沒有任何業務表（`system-analysis.md` §現況盤點）；之後每一個模組都要「先知道是誰、帳號還能不能用、當下是什麼角色」才能動工。規格 01-01 已定案、產品路線圖把它排在第一張（`docs/product/roadmap.mdx` §排序依據 第 2 條），所以現在要交付登入頁與兩條登入路徑，以及之後每個模組共用的守門。

## What Changes

**登入頁與兩條登入路徑（規格 01-01 全頁）**

- 新增登入頁 `/account/login`：Email 與密碼登入（只檢查必填、不檢查格式與組成規則、送出中整頁凍結、失敗不清空、三種失敗同一句、平台沒回應的可重試說明、密碼顯示切換）、「使用 Google 帳號繼續」、登入頁上的語言切換、三種螢幕寬度
- 新增 Google 登入：只登入或綁定既有帳號，**不建立帳號**；沒有對應帳號或 Email 未驗證一律回登入頁顯示同一句（規格 01-01 §用 Google 帳號登入 第 4 條、01-05 Q18、#705）。授權網址以 JSON 回給前端、Google 回到前端回調路由 `/account/google/callback`，不使用 `302`（`system-design.md` §技術待決 T1，協調者 2026-11-26 已採用）
- 登入頁依後端回報的部署能力決定是否顯示「前往註冊」（規格 01-02 Q10 的共用判斷；**建議 6-A，待 clarification**）與 Google 鈕的狀態（**待決 8**）
- 已登入的人開登入頁直接到落點（規格 01-01 §登入頁 第 9 條、Q3）

**一段登入狀態（規格 01-05 中登入當下就要成立的部分）**

- 登入成功開始一段登入狀態，憑證只放在 httpOnly cookie；Email 正規化後比對、正規化後超過 254 字當成帳密不對、沒有本地密碼的帳號不能用密碼登入、停用帳號不能登入（規格 01-05 §Email 的識別規則、§沒有本地密碼的帳號、Q14）
- **建議 2-A，待 clarification**：同時交付 90 天絕對上限與 7 天閒置、延續（輪替、寬限、第三次不給、疑似盜用全部登出）、被動登出的兩個錯誤碼，以及「從這一台登出」的端點（**建議 5-A**；登出控制項仍屬 07-01）。紀錄的保留與每日清除、改密碼等撤銷事件的觸發留給各自的 change

**之後每個模組共用的守門**

- 伺服器端：每一次操作都確認登入狀態仍可通行、帳號仍啟用、以資料庫當下的系統角色判定；不能通行時回同一個 `401 AUTH_REQUIRED`、不說明原因（規格 01-05 §每一次操作都用最新的身分判定、§不能通行的登入狀態不說明原因、Q11；ADR-004 D2）。**建議 11-A，待 clarification**：本次只做授權四步的第 1、2 步，權限矩陣與附加條件（含答案隔離）隨第一個需要它的端點建立
- 跨站偽造防護：寫入請求驗 double-submit token；本次四個寫入端點依 `system-design.md` T2 放行（ADR-004 D3、security-agent-rules S2）
- 畫面端：需要登入的路由與「只給未登入的人」的路由兩種包裝，判定完成前不畫內容；`/` 依登入狀態導向
- 登入後的落點路由 `/dashboard/dashboard`，02-01 外殼完成時只換頁面元件。**落點內容待決 5、7**（新畫面要先過 Ready gate）

**資料、設定與品質門檻**

- 新建 `users`、`account_session` 兩張表（一個可逆的 Alembic revision；字典與 ER 已由 `sd` 補回三欄，`pnpm check:er` 通過）。**建議 N1-A，待 clarification**：另建 `account_refresh_token`
- 新增設定 `AUTH_SECRET`（必填、無預設）、三個 `GOOGLE_*`（一起設或一起不設）、`RESEND_API_KEY`（只看有沒有設）；它和 Lite「範例檔複製即可啟動」的衝突見 **PL1**
- **建議 13-A，待 clarification**：建立 testing-agent-rules T10 中「認證」「授權與權限檢查」兩項關鍵路徑的 90% 分支覆蓋率門檻並進 CI
- **建議 4-A，待 clarification**：提前交付 06-01 既有 Requirement「Seeder 管理員只能由初始化指令建立」的初始化指令，讓交付後至少有一個帳號能登入

**與 Issue #719 字面不同之處**

- Issue 列了「記住我」，但規格 01-01、01-05 與 prototype 都沒有這個控制項，01-05 Q1、Q2 把期限固定為 90 天與 7 天（`system-analysis.md` C1）。依需求依據順序以規格為準，**建議 1-A（不做），待 clarification 確認**

**破壞性變更**

- **BREAKING**（開發與部署行為）：`frontend-routing` 現行「開發模式下 `/` 與未知路徑導向 `/dev/health`」「正式建置開啟 `/` 只有空殼、不發任何後端請求」兩條不再成立；`/` 改依登入狀態導向
- **BREAKING**（介面行為）：`frontend-i18n` 現行「依瀏覽器語言決定、畫面不得有語言切換」改為規格 01-01 的「第一次預設繁體中文、可切換、記住選擇」（`ui-design.md` U4）
- **BREAKING**（部署）：後端多一個沒有預設值的必填設定 `AUTH_SECRET`，既有的 `.env` 不補就起不來（處理方式待 PL1）
- 對外 API 沒有破壞性變更：七個端點全部新增，`getHealth` 不變（`api-contract.md` §破壞性變更）

## Capabilities

### New Capabilities

- `account-login`：登入頁與兩條登入路徑——Email 與密碼登入、Google 登入（只登入或綁定既有帳號）、登入頁的部署能力判斷、語言切換與螢幕寬度、各種失敗不揭露原因。端點 `getAuthOptions`、`createSession`、`getGoogleAuthorization`、`createGoogleSession`。來源：規格 01-01 全頁；01-02 Q10；01-05 §Email 的識別規則、§沒有本地密碼的帳號、Q14、Q18；ADR-004 D4、D5
- `login-session`：一段登入狀態的開始、期限、延續、被動登出與從這一台登出（範圍依待決 2、5）。端點 `createSessionRefresh`、`deleteCurrentSession`。來源：規格 01-05 §一次登入是一段登入狀態、§登入狀態能撐多久、§延續登入狀態與疑似被盜用、§從這一台登出、Q1–Q4、Q13；ADR-004 D1
- `auth-guard`：每一次操作的身分判定（登入狀態可通行、帳號啟用、當下系統角色）、不能通行時不說明原因、目前登入狀態的查詢、畫面端的兩種路由包裝、`/` 與落點的導向。端點 `getCurrentSession`。來源：規格 01-05 §每一次操作都用最新的身分判定、§不能通行的登入狀態不說明原因、Q11；01-01 §登入頁 第 8、9 條、Q3、Q7；02-01 §業務流程 E1；ADR-004 D2、D6；security-agent-rules S1、S3
- `csrf-protection`：寫入請求的跨站偽造防護與放行清單。來源：ADR-004 D3；security-agent-rules S2（技術 change，依 spec-migration D4 追溯到 ADR 與規則條號）

### Modified Capabilities

- `api-envelope`：「錯誤碼為大寫底線格式並定義第一批通用碼」加 `AUTH_REQUIRED`（401）、`CSRF_FAILED`（403）（`api-contract.md` C1）；「成功回應包一層六欄位外層」的「本次沒有 `204` 例外」改為允許登出的 `204`（PL3，依附待決 5）
- `frontend-routing`：`/` 與未知路徑的導向、正式建置的內容、登入頁與落點的瀏覽器標題（BREAKING，見上；未知路徑依 U7）
- `frontend-i18n`：「介面語言依瀏覽器語言決定」改為登入頁可切換、預設繁體中文、記住選擇（`ui-design.md` U4，P）
- `frontend-api-client`：寫入請求帶 `X-CSRF-Token`；收到 `401` 時先延續一次再重送原請求，與現行「不自動重送」「認證錯誤整個過程只送 1 次」的關係要重寫（PL2）
- `runtime-config`：「其餘設定都有預設值」加入 `AUTH_SECRET` 必填、`GOOGLE_*` 一起設或一起不設、`RESEND_API_KEY` 只看有沒有設
- `container-runtime`：兩層編排傳入新設定；「Lite 層以預設值起服務」與「設定範例檔列出所有設定且不含 secret」在 `AUTH_SECRET` 之下如何同時成立，待 PL1
- `backend-code-boundaries`：「入口與間接使用不算違規」寫的「今天 `backend/app/` 沒有任何入口」不再成立，本次新增 OIDC 入口 `app/oidc/`（PL5）
- `ci-quality-gates`：新增關鍵路徑覆蓋率門檻（範圍依待決 13）

`user-management` 不修改：選 4-A 時是實作它既有的「Seeder 管理員只能由初始化指令建立」，資料庫層的 Seeder 保護仍留給 06-01（`system-design.md` §資料模型異動）。

## Impact

- **後端**：新增業務模組 `app/modules/account/`、頂層入口套件 `app/oidc/`、`app/core/` 六個新檔（認證、token、cookie、CSRF、密碼、Email 正規化）；`main.py` 掛 router 與 CSRF 中介層；CORS 允許標頭加 `X-CSRF-Token`（`system-design.md` §目錄、§權限檢查點）
- **API**：`/api/v1` 下七個新端點，一個 `204` 例外；兩個通用碼與 `ACCOUNT_` 前綴的模組碼（`api-contract.md` §端點總覽、§常駐文件異動）；`openapi.json` 與前端產生的呼叫層要重新產生；`_IRREGULAR_SINGULARS` 加 `options`（`api-contract.md` C2）
- **資料庫**：新表 `users`、`account_session`（與提案中的 `account_refresh_token`），兩種資料庫行為一致（`system-design.md` §資料模型異動）
- **前端**：登入頁、Google 回調、兩種路由包裝、落點路由；新增 shadcn/ui 原語 `label`、`separator` 與 `button` 的送出中狀態，元件展示頁各補一節（`ui-design.md` §元件樹）
- **相依套件**：`pyjwt`、`argon2-cffi`、`authlib`（以 `uv add` 加入並歸類；選 3-A 時另加 `redis`）（`system-design.md` T7）
- **部署與文件**：`.env.example`、兩份編排檔、Lite Quick Start；`Secure` 與 `__Host-` cookie 只在 HTTPS 或 `localhost` 有效（T9）寫進部署文件；常駐文件 `backend-modules.mdx`、`frontend-routes.mdx`、`error-codes.mdx`、`endpoint-authorization.mdx`、資料表字典與 ER 已由上游先改，合併時併進主表
- **CI**：關鍵路徑覆蓋率門檻（依待決 13）；Google 一律以 `app.oidc` 的測試替身代替，CI 與 e2e 不連真的 Google（testing-agent-rules T6）
- **Hard Rule 5、6**：本次與任務類型無關；沒有任何端點或畫面讀取任務、資料集或標準答案。守門是日後答案隔離（授權第 4 步）所在的位置，本次交出的身分只含帳號識別、登入狀態識別與系統角色
- **不在本次**：註冊（01-02，#723）、設定密碼（01-03，#724）、個人設定與連結 Google（01-04，#727）、側欄與登出控制項（07-01）、無權限與找不到頁（07-03）、儀表板版面（02-01）、使用者管理與權限矩陣設定（06-01、06-02）、答案隔離／評分／IAA 三項覆蓋率門檻（#111）；01-05 中不在本次的部分依待決 2 交給 #726
- **規格書**：本 change 不改 `docs/specs/` 與 `design/prototype/`。下列待決若選了需要改規格或畫面的方案，須先走 `spec-writing` 或 Ready gate：1-B、8、9（告知）、10-B、N2-A（01-01 補一句）、N3-B、U1、U3、U8

## 引用的需求來源

- PRD `docs/specs/00-prd.mdx`：§使用者角色 §角色清單、§權限矩陣；§專案範圍 §範圍內、§假設與限制；§Site Map；§模組架構與串接 §模組依賴
- 規格 01-01 `docs/specs/01-account/01-login.mdx`：全頁；§已確認決議 Q1–Q9；§用 Google 帳號登入 第 1、2、4 條；§登入頁 第 2、4、6–10 條；§用 Email 與密碼登入 第 2–20 條；§卡控機制；§邊界情況
- 規格 01-05 `docs/specs/01-account/05-login-state.mdx`：§一次登入是一段登入狀態、§登入狀態能撐多久、§延續登入狀態與疑似被盜用、§從這一台登出、§每一次操作都用最新的身分判定、§不能通行的登入狀態不說明原因、§Email 的識別規則、§沒有本地密碼的帳號、§四種改動讓所有裝置重新登入；Q1–Q5、Q7、Q11、Q13、Q14、Q18
- 規格 01-02 §已確認決議 Q10；規格 01-03 頁首；規格 01-04 §連結 Google 帳號（只作邊界）
- 規格 02-01 §業務流程「進入儀表板拿到自己的版面」E1；規格 07-01 §登出、§切換語言與外觀；規格 07-03 §兩種畫面的分工、Q2、Q6（只作邊界）
- 術語表 `term.login-state`、`term.system-role`、`term.platform-member`
- ADR-004 D1–D7；architecture §認證與授權、§授權四步、§Google SSO、§i18n 兩層、§API 契約、§測試分層
- security-agent-rules S1–S4；testing-agent-rules T6、T9、T10；api-agent-rules A1、A7
- Issue #719 §使用情境／功能範圍、§驗收條件；Epic #712；Issue #111 §2b 第二項；Issue #726
- 產品路線圖 §排序依據 第 2 條；資料表字典 §二 帳號組

## 待決問題

以下彙整上游四份與本份的全部待決項，供 clarification 轉成 Q（維護者決定）或 P（明確問題，派原角色回修）。「建議」欄照抄上游的建議方案，**不是決定**。

### 需要維護者決定的項目（候選 Q）

| #     | 問題                                                                 | 來源                                                                                                                     | 上游建議                                                                                        |
| :---- | :------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| sa-1  | 「記住我」要不要做                                                   | `system-analysis.md` 待決 1、C1；sd 1；ui sa-1                                                                           | 1-A 不做，proposal 註明與 Issue 字面不同                                                        |
| sa-2  | 01-05 哪些部分在本次、哪些留給 #726；登入頁是否顯示被動登出的兩句    | sa 待決 2、C7；sd 2；ui sa-2；api-contract 依附 2-A                                                                      | 2-A：含期限、延續、被動登出碼與登出端點                                                         |
| sa-3  | 登入失敗 10 次擋 30 分鐘本次做嗎、「同一個人」怎麼認、計數放哪、文案 | sa 待決 3、C2；sd 3；ui sa-3；api-contract `ACCOUNT_LOGIN_THROTTLED`                                                     | 3-C 本次不做、交給 #726；認定以帳號加來源位址                                                   |
| sa-4  | 第一個可以登入的帳號從哪裡來                                         | sa 待決 4；sd 4                                                                                                          | 4-A 提前交付 Seeder 初始化指令                                                                  |
| sa-5  | 02-01 前的暫時落點內容、是否放登出；登出端點本次建不建               | sa 待決 5；sd 5；ui sa-5／7；api-contract `deleteCurrentSession`                                                         | 路由 `/dashboard/dashboard`；內容由維護者選（A／B 是新畫面，要 artifact）；後端 5-A             |
| sa-6  | 「忘記密碼？」「前往註冊」去處不存在時怎麼處理；寄信判斷由誰建       | sa 待決 6；sd 6；ui sa-6                                                                                                 | 連結照 prototype 顯示（ui A）；後端 6-A 本次建立共用判斷                                        |
| sa-7  | 已登入的人開登入頁是否也走暫時落點                                   | sa 待決 7；sd 7；ui sa-5／7                                                                                              | 與 sa-5 同一個落點                                                                              |
| sa-8  | 部署沒設定 Google 時按鈕怎麼呈現（可能要改規格）                     | sa 待決 8、C3；sd 8；ui sa-8                                                                                             | 8-A 按鈕在、點了不動作並顯示一句，規格補一條                                                    |
| sa-9  | 登入頁 Google 自動綁定算不算「連結 Google 成功」；要不要告知         | sa 待決 9、C4；sd 9；ui sa-9                                                                                             | 9-A 照 ADR-004 D5；是否告知未定                                                                 |
| sa-10 | 登入後回原頁還是一律去落點                                           | sa 待決 10；sd 10；ui sa-10                                                                                              | 10-A 一律去落點                                                                                 |
| sa-11 | 守門做到授權四步的哪一步                                             | sa 待決 11；sd 11                                                                                                        | 11-A 只做第 1、2 步                                                                             |
| sa-13 | 覆蓋率門檻範圍、畫面端守門是否算「認證」、#111 本文由誰改            | sa 待決 13、C6；sd 13                                                                                                    | 13-A 只建兩項，另三項不建空殼                                                                   |
| N1    | refresh token 存在哪裡（字典 D7 曾拿掉）                             | `system-design.md` N1                                                                                                    | N1-A 新表 `account_refresh_token`                                                               |
| N2    | 停用或已匿名化的帳號用 Google 登入時顯示哪一句                       | sd N2                                                                                                                    | N2-A 用 Google 那一句，規格 01-01 補一句                                                        |
| N3    | 系統角色變更要不要撤銷登入狀態（S4 與規格 01-05 不一致）             | sd N3                                                                                                                    | N3-A 不撤銷，回頭改 S4                                                                          |
| U1    | 送出中整頁凍結：規格與 prototype 不一致                              | `ui-design.md` U1                                                                                                        | 依規格；是否登記 design-gaps、修 prototype 待定                                                 |
| U2    | 帳密失敗橫幅何時收起                                                 | ui U2                                                                                                                    | 任一欄輸入就收起                                                                                |
| U3    | 文案缺口：平台沒回應、被擋 30 分鐘、被動登出英文、Spinner 英文名稱   | ui U3                                                                                                                    | (a)(b)(c) 以 `spec-writing` 補；(d) 沿用 brand.md                                               |
| U5    | prototype 尺寸沒有對應 token                                         | ui U5                                                                                                                    | 未提建議                                                                                        |
| U6    | 守門查詢連不上或 `5xx` 時畫面                                        | ui U6                                                                                                                    | A 整頁錯誤加重試（新畫面）或 B 當未登入，未定                                                   |
| U7    | 未註冊路徑本次怎麼處理                                               | ui U7                                                                                                                    | A 交給 `/` 導向或 B 維持空白，未定                                                              |
| U8    | 語言切換鈕的無障礙名稱不含可見文字                                   | ui U8                                                                                                                    | 低優先，未定                                                                                    |
| PL1   | `AUTH_SECRET` 必填且無預設，與 Lite「範例檔複製即可啟動」衝突        | 本份新發現：`system-design.md` T8 vs `container-runtime`「Lite 層以預設值起服務」「設定範例檔列出所有設定且不含 secret」 | 未提建議。可能方向：首次啟動自動產生並存進資料 volume，或改成必須先編輯 `.env`（Lite 承諾改變） |

### 明確問題（候選 P）

| #      | 問題                                                                                               | 來源                                                 | 回修者與處理                                                             |
| :----- | :------------------------------------------------------------------------------------------------- | :--------------------------------------------------- | :----------------------------------------------------------------------- |
| sa-12  | 字典排除的三欄                                                                                     | sa 待決 12、C5；sd 12                                | 已由 `sd` 補回字典與 ER，`pnpm check:er` 通過；只需在 clarification 確認 |
| U4     | `frontend-i18n` 與規格 01-01 語言切換不一致                                                        | ui U4                                                | `planner`：spec delta MODIFIED（本份已列）                               |
| C1     | `api-envelope` 第一批通用碼要加兩個                                                                | `api-contract.md` C1                                 | `planner`：spec delta MODIFIED（本份已列）                               |
| C2     | `auth-options` 單數化                                                                              | api-contract C2                                      | `planner`：tasks 列一項                                                  |
| C3、C4 | ui-design 的 Google 回調方式、路徑與 operationId 和 api-contract 不一致                            | api-contract C3、C4                                  | 已由 `ui-ux` 於 e18432f 對齊；clarification 確認即可                     |
| PL2    | `frontend-api-client`「不自動重送」「認證錯誤整個過程只送 1 次」與「`401` 先延續再重送原請求」衝突 | 本份新發現：ui-design §資料來源 vs 既有 capability   | `planner`：spec delta MODIFIED，把延續後重送寫成唯一例外（依附 sa-2）    |
| PL3    | `api-envelope`「本次沒有 `204` 例外端點」與登出的 `204`                                            | 本份新發現：api-contract §deleteCurrentSession       | `planner`：spec delta MODIFIED（依附 sa-5／5-A）                         |
| PL4    | `frontend-routing` 開發模式 `/` 導向 `/dev/health` 與 `/` 依登入狀態導向衝突                       | 本份新發現：ui-design §頁面與路由 vs 既有 capability | `planner`：spec delta MODIFIED；未知路徑部分依附 U7                      |
| PL5    | `backend-code-boundaries`「今天沒有任何入口」不再成立                                              | 本份新發現：sd §目錄新增 `app/oidc/`                 | `planner`：spec delta MODIFIED                                           |

`system-design.md` 的技術待決 T1–T11 已由設計自行決定（T1 經協調者採用），不列為待決；若 clarification 對 T 項有異議，再由 `sd` 回修。
