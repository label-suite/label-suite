# Proposal

本份是 change `login-auth-guard`（Issue #719，Epic #712 帳號）的提案。範圍、設計與契約分別以 `system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md` 為準，這裡只收斂成「為什麼做、改了什麼、動到哪些 capability」。

**決定來源**：上游四份留下的待決（sa 1–13、sd N1–N3、ui U1–U9）與本份的 PL1–PL7，已由維護者在 2026-11-26 的 clarification 停點逐題決定，或依明確問題（P）指定處理方式：

- [決定表](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)（以下簡稱「決定表」）
- [暫時落點畫面確認](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187214559)（依 Ready gate，以下簡稱「落點確認」）
- 同日後續問答：維護者核准規格 01-01 Q13 的擬稿文案，並核准 security-agent-rules S4 的撤銷事件不含任務成員身分變更；被動登出兩句的英文後來改用舊 repo 實作計畫的文案（`Session expired, please sign in again`、`Authentication failed, please sign in`），以規格 01-05 Q19 為準

上游四份已在 a93d962 依決定改寫；本份照決定寫，不再有「建議，待 clarification」的範圍。各項後面的括號是決定表的題號，完整對照見 [§待決問題](#待決問題)。

## Why

平台目前沒有任何認證、授權或跨站防護的共用元件，資料庫也沒有任何業務表（`system-analysis.md` §現況盤點）；之後每一個模組都要「先知道是誰、帳號還能不能用、當下是什麼角色」才能動工。規格 01-01 已定案、產品路線圖把它排在第一張（`docs/product/roadmap.mdx` §排序依據 第 2 條），所以現在要交付登入頁與兩條登入路徑、一段登入狀態的完整生命週期，以及之後每個模組共用的守門；同時提前交付建立第一位帳號的初始化指令，讓交付後的部署真的有人登得進去（sa-4）。

## What Changes

**登入頁與兩條登入路徑（規格 01-01 全頁）**

- 新增登入頁 `/account/login`：Email 與密碼登入（只檢查必填、不檢查格式與組成規則、送出中整頁凍結（U1）、失敗不清空、三種失敗同一句、任一欄重新輸入就收起失敗訊息（U2、01-01 Q15）、平台沒回應的可重試說明、密碼顯示切換）、「使用 Google 帳號繼續」、登入頁上的語言切換（說明文字含畫面上的 `ZH`／`EN`，U8、01-01 Q14）、三種螢幕寬度
- 新增 Google 登入：只登入或綁定既有帳號，**不建立帳號**；沒有對應帳號、Email 未驗證、帳號已停用或已匿名化，一律回登入頁顯示同一句（規格 01-01 §用 Google 帳號登入 第 4 條、01-01 Q12、01-05 Q18、#705；N2）。對上 Email 相同且 Google 回報已驗證的既有帳號時，依 ADR-004 D5 自動連結、不另外告知（sa-9、01-01 Q11）。授權網址以 JSON 回給前端、Google 回到前端回調路由 `/account/google/callback`，不使用 `302`（`system-design.md` §技術待決 T1，協調者 2026-11-26 採用）
- 登入頁依後端回報的部署能力決定：沒有設定寄信服務時不顯示「前往註冊」（規格 01-02 Q10 的共用判斷，本次建立；sa-6）；沒有設定 Google 時不顯示 Google 按鈕與「或」分隔線（sa-8、01-01 Q10）
- 「忘記密碼？」與「前往註冊」照 prototype 顯示，去處由 01-03、01-02 的 change 補上；在那之前點下去落到「其他路徑」，依登入狀態導回（sa-6、U7）
- 已登入的人開登入頁、以及任何人登入成功後，一律到落點，不回原本要開的頁（規格 01-01 §登入頁 第 9 條、Q3、Q7；sa-5／7、sa-10）
- 登入頁缺的三處文案照規格 01-01 Q13：平台沒回應的那一句、進行中指示的輔助技術名稱（中文「載入中」、英文 `Loading`），以及被動登出兩句的英文（01-05 Q19 的最終文案）（U3）

**一段登入狀態（規格 01-05，sa-2）**

- 登入成功開始一段登入狀態，憑證只放在 httpOnly cookie；Email 正規化後比對、正規化後超過 254 字當成帳密不對、沒有本地密碼的帳號不能用密碼登入、停用帳號不能登入（規格 01-05 §Email 的識別規則、§沒有本地密碼的帳號、Q14）
- 絕對上限 90 天與閒置 7 天兩條期限（01-05 Q1、Q2；不做「記住我」，sa-1）
- 延續登入狀態：輪替、寬限、多分頁同時延續、同一次延續第三次不給、疑似盜用時所有裝置一起登出（01-05 §延續登入狀態與疑似被盜用、Q13）；延續憑證另立一張表 `account_refresh_token`（N1）
- 被動登出時登入頁顯示「登入已過期，請重新登入」或「驗證失敗，請重新登入」及其英文（01-05 Q4、Q19）
- 從這一台登出的端點，只結束這一台；登入狀態已不能驗證時也能清掉這一台的 cookie（01-05 §從這一台登出）
- 系統角色變更**不**撤銷登入狀態，下一次操作就用新角色判定（01-05 §每一次操作都用最新的身分判定；N3）
- 不在本次：登入失敗鎖定、撤銷事件本身（改密碼、換 Email、重設密碼、在個人設定連結 Google 由各自的頁面觸發）、登入狀態紀錄的保留與每日清除，都交給 #726（sa-2、sa-3）

**之後每個模組共用的守門**

- 伺服器端：只做授權四步的第 1、2 步——每一次操作都確認登入狀態仍可通行、帳號仍啟用，並以資料庫當下的系統角色判定；不能通行時回同一個 `401 AUTH_REQUIRED`、不說明原因（規格 01-05 §每一次操作都用最新的身分判定、§不能通行的登入狀態不說明原因、Q11；ADR-004 D2；sa-11）。權限矩陣（第 3、4 步，含答案隔離）留給 06-02
- 跨站偽造防護：寫入請求驗 double-submit token；本次四個寫入端點依 `system-design.md` T2 放行（ADR-004 D3、security-agent-rules S2）
- 畫面端：需要登入的路由與「只給未登入的人」的路由兩種包裝，判定完成前不畫內容；`/` 依登入狀態導向；守門查詢連不上、逾時或 `5xx` 時當成未登入，帶回登入頁並顯示「沒回應」那一句（U6）；不存在的路徑交給 `/` 依登入狀態導向，07-03 完成時改成找不到頁（U7）

**暫時落點與登出（sa-5／7，落點確認）**

- 路徑 `/dashboard/dashboard`，要登入才能進；沿用登入頁的頁首與卡片樣式，沒有側欄
- 卡片顯示「你已登入」、名字與 Email、系統角色、「儀表板還在建置中，完成後登入會直接帶你過去。」與「登出」鈕；登出只結束這一台的登入狀態並回登入頁
- 02-01 外殼完成時整頁換成儀表板，路徑不變；不修改 `design/prototype/`

**資料、設定、初始化指令與品質門檻**

- 新建 `users`、`account_session`、`account_refresh_token` 三張表（一個可逆的 Alembic revision；字典與 ER 已由 `sd` 補回三欄並新增第三張表，`pnpm check:er` 通過；N1、sa-12）
- 新增設定 `AUTH_SECRET`：正式層必填、無預設；Lite 層沒設時首次啟動自動產生並存進資料 volume，之後重用，所以 Lite 仍是「範例檔複製即可啟動」（PL1）。另加三個 `GOOGLE_*`（一起設或一起不設）、`RESEND_API_KEY`（只看有沒有設）
- 新增建立第一位 Seeder 管理員的初始化指令，提前實作既有 capability `user-management` 的「Seeder 管理員只能由初始化指令建立」；資料庫層的 Seeder 保護仍屬 06-01（sa-4）
- 建立 testing-agent-rules T10 中「認證」「授權與權限檢查」兩項關鍵路徑的 90% 分支覆蓋率門檻並進 CI；答案隔離、評分、IAA 三項不建空殼，仍屬 #111，#111 本文跟著改寫（sa-13）

**與 Issue #719 字面不同之處**

- Issue 列了「記住我」，但規格 01-01、01-05 與 prototype 都沒有這個控制項，01-05 Q1、Q2 把期限固定為 90 天與 7 天（`system-analysis.md` C1）。維護者決定**不做**，以規格為準（sa-1）
- 規格 01-01 §用 Email 與密碼登入 第 15 條與 Scenario「連續失敗十次被擋住」屬 01-01 全頁，但維護者決定登入失敗鎖定**移到 #726**，本次不驗收這條 Scenario（sa-3、`system-analysis.md` C2）

**破壞性變更**

- **BREAKING**（開發與部署行為）：`frontend-routing` 現行「開發模式下 `/` 與未知路徑導向 `/dev/health`」「正式建置開啟 `/` 只有空殼、不發任何後端請求」兩條不再成立；`/` 與未知路徑改依登入狀態導向（PL4、U7）
- **BREAKING**（介面行為）：`frontend-i18n` 現行「依瀏覽器語言決定、畫面不得有語言切換」改為規格 01-01 的「第一次預設繁體中文、可切換、記住選擇」（U4）
- **BREAKING**（正式層部署）：正式層多一個沒有預設值的必填設定 `AUTH_SECRET`，既有的正式層 `.env` 不補就起不來。Lite 層不受影響（PL1）
- **BREAKING**（Lite 資料 volume）：Lite 層自動產生的 `AUTH_SECRET` 存在資料 volume；刪掉 volume 或那個檔案會讓所有既有登入狀態失效，等於全部登出（`system-design.md` §`AUTH_SECRET` 的來源）
- 對外 API 沒有破壞性變更：七個端點全部新增，`getHealth` 不變（`api-contract.md` §破壞性變更）

## Capabilities

### New Capabilities

- `account-login`：登入頁與兩條登入路徑——Email 與密碼登入、Google 登入（只登入或綁定既有帳號、自動連結不告知、停用與匿名化同一句）、登入頁的部署能力判斷（寄信服務、Google）、語言切換與螢幕寬度、送出中整頁凍結、失敗訊息何時收起、各種失敗不揭露原因。端點 `getAuthOptions`、`createSession`、`getGoogleAuthorization`、`createGoogleSession`。來源：規格 01-01 全頁（含 Q10–Q15，登入失敗鎖定除外）；01-02 Q10；01-05 §Email 的識別規則、§沒有本地密碼的帳號、Q14、Q18；ADR-004 D4、D5
- `login-session`：一段登入狀態的開始、兩條期限、延續（含多分頁與疑似盜用）、被動登出的兩句（中英）、從這一台登出（含暫時落點上的登出鈕）、角色變更不撤銷。端點 `createSessionRefresh`、`deleteCurrentSession`。來源：規格 01-05 §一次登入是一段登入狀態、§登入狀態能撐多久、§延續登入狀態與疑似被盜用、§從這一台登出、§不能通行的登入狀態不說明原因、Q1–Q4、Q13、Q19；ADR-004 D1；security-agent-rules S4
- `auth-guard`：每一次操作的身分判定（授權第 1、2 步：登入狀態可通行、帳號啟用、當下系統角色）、不能通行時不說明原因、目前登入狀態的查詢、畫面端的兩種路由包裝、守門判定失敗當成未登入、`/` 與未知路徑的導向、暫時落點的內容。端點 `getCurrentSession`。來源：規格 01-05 §每一次操作都用最新的身分判定、§不能通行的登入狀態不說明原因、Q11；01-01 §登入頁 第 8、9 條、Q3、Q7；02-01 §業務流程 E1；Issue #719 落點確認；ADR-004 D2、D6；security-agent-rules S1、S3
- `csrf-protection`：寫入請求的跨站偽造防護與放行清單。來源：ADR-004 D3；security-agent-rules S2（技術 change，依 spec-migration D4 追溯到 ADR 與規則條號）

### Modified Capabilities

- `api-envelope`：「錯誤碼為大寫底線格式並定義第一批通用碼」加 `AUTH_REQUIRED`（401）、`CSRF_FAILED`（403）（C1）；「成功回應包一層六欄位外層」的「本次沒有 `204` 例外」改為允許登出的 `204`（PL3）
- `frontend-routing`：REMOVED「兩頁只在開發模式註冊」「正式建置不含開發頁與測試替身」，改以 ADDED「開發頁只在開發模式註冊且不經過守門」「正式建置含登入相關頁面且不含開發頁與測試替身」取代（舊 Scenario 的 `/` 導向 `/dev/health` 與「只有空殼」不再成立）；MODIFIED「每頁設定瀏覽器標題」加登入頁與暫時落點（PL4、U7；BREAKING）
- `frontend-i18n`：REMOVED「介面語言依瀏覽器語言決定」，ADDED「介面語言預設繁體中文並記住使用者的選擇」；MODIFIED「介面文字只取自語言檔」加 `auth` 語言檔（U4；BREAKING）。`dev-health-page` 與 `e2e-testing` 的語言相關 Scenario 以「介面語言為 en」或固定 `zh-TW` 為前提，新規則下仍成立，不修改
- `frontend-api-client`：MODIFIED「唯一出口送出的請求帶憑證與介面語言」（寫入帶 `X-CSRF-Token`）、「伺服器資料快取不自動重試」、「認證錯誤只認 401」；ADDED「`AUTH_REQUIRED` 時延續並重送原請求（各至多兩次）」，把延續成功後重送、`409 ACCOUNT_REFRESH_CONFLICT` 等候後重送，以及重送仍不通時再延續一次寫成僅有的例外，延續與重送各至多兩次（PL2，以規格 01-05 §多個分頁同時延續登入狀態 第 3 條為準）
- `runtime-config`：MODIFIED「其餘設定都有預設值」；ADDED「`AUTH_SECRET` 的來源依資料庫層而定」「Google 登入的設定一起設或一起不設」「寄信服務只看有沒有設定」（PL1、sa-6、sa-8）
- `container-runtime`：MODIFIED「設定範例檔列出所有設定且不含 secret」；ADDED「正式層缺 AUTH_SECRET 時拒絕啟動」「Lite 層的 AUTH_SECRET 存在資料 volume 並跨重啟沿用」（PL1）
- `database-migration`：MODIFIED「遷移在兩種資料庫上可升可降可再升」（版本紀錄改為鏈上最新的版本）；ADDED「帳號組的三張表在兩種資料庫上可升可降」（PL6、N1）
- `backend-code-boundaries`：「入口與間接使用不算違規」寫的「今天 `backend/app/` 沒有任何入口」不再成立，本次新增 OIDC 入口 `app/oidc/`（PL5）
- `component-gallery`：「原語宣告的 variant 集合固定」的 Badge 五個 variant 加角色變體；「展示頁列出每個宣告的項目」的七個區塊加新原語 `label`、`separator`（PL7）
- `ci-quality-gates`：ADDED「認證與授權的關鍵路徑分支覆蓋率門檻」（sa-13）
- `e2e-testing`：ADDED「登入到落點再登出的旅程」（`e2e/account/login.spec.ts`；帳號由初始化指令建立，不連 Google）

`user-management` 不修改：本次是實作它既有的「Seeder 管理員只能由初始化指令建立」，資料庫層的 Seeder 保護與異動紀錄仍留給 06-01（`system-design.md` §Seeder 初始化指令、§資料模型異動）。`api-schema-export` 不修改：`auth-options` 的單數化只是在既有規則的不規則單數清單加一項（C2，列為 task）。

## Impact

- **後端**：新增業務模組 `app/modules/account/`、頂層入口套件 `app/oidc/`、初始化指令 `app/scripts/create_seeder.py`、`app/core/` 七個新檔（認證、`AUTH_SECRET` 來源、token、cookie、CSRF、密碼、Email 正規化）；`main.py` 解析 `AUTH_SECRET`、掛 router 與 CSRF 中介層；CORS 允許標頭加 `X-CSRF-Token`（`system-design.md` §目錄、§權限檢查點）
- **API**：`/api/v1` 下七個新端點，一個 `204` 例外；兩個通用碼與 `ACCOUNT_` 前綴的模組碼，沒有登入失敗鎖定的碼（`api-contract.md` §端點總覽、§常駐文件異動）；`openapi.json` 與前端產生的呼叫層要重新產生；`_IRREGULAR_SINGULARS` 加 `options`（C2）
- **資料庫**：新表 `users`、`account_session`、`account_refresh_token`，一個可逆 revision，兩種資料庫行為一致；migration 不建任何帳號（`system-design.md` §資料模型異動）
- **前端**：登入頁、Google 回調、兩種路由包裝、暫時落點；新增 shadcn/ui 原語 `label`、`separator`，`button` 的送出中狀態與 `badge` 的角色變體，元件展示頁各補一節（`ui-design.md` §元件樹）
- **相依套件**：`pyjwt`、`argon2-cffi`、`authlib`（以 `uv add` 加入並歸類）；不加 `redis`，登入失敗鎖定在 #726（`system-design.md` T7）
- **部署與文件**：`.env.example`（`AUTH_SECRET` 兩層差別）、兩份編排檔、Lite Quick Start；`docs/development/workflow/local-development.mdx` 與部署文件加「建立第一位系統管理員」一步；`Secure` 與 `__Host-` cookie 只在 HTTPS 或 `localhost` 有效（T9）寫進部署文件；常駐文件 `backend-modules.mdx`、`frontend-routes.mdx`、`error-codes.mdx`、`endpoint-authorization.mdx`、資料表字典與 ER 已由上游先改，合併時併進主表
- **CI 與測試規則**：`.github/workflows/ci.yml` 的 `compose` job 為正式層產生並遮蔽一次性的 `AUTH_SECRET`、傳給所有正式層指令，並新增「缺 `AUTH_SECRET` 時拒絕啟動」的檢查；兩項關鍵路徑覆蓋率門檻（後端路徑清單見 `system-design.md` §維護者的決定，前端路徑見 `design.md` D10）；testing-agent-rules T10「尚未檢查」那一列與 Issue #111 本文改寫成兩項已由 #719 建立（sa-13）；Google 一律以 `app.oidc` 的測試替身代替，CI 與 e2e 不連真的 Google（testing-agent-rules T6）
- **Hard Rule 5、6**：本次與任務類型無關；沒有任何端點或畫面讀取任務、資料集或標準答案。守門是日後答案隔離（授權第 4 步）所在的位置，本次交出的身分只含帳號識別、登入狀態識別與系統角色
- **不在本次**：記住我（sa-1）；登入失敗鎖定（#726，sa-3）；01-05 的撤銷事件本身與紀錄保留清除（#726）；權限矩陣與授權第 3、4 步（06-02，sa-11）；註冊（01-02，#723）、設定密碼（01-03，#724）、個人設定與連結 Google（01-04，#727）；側欄與登出控制項（07-01）、無權限與找不到頁（07-03）、儀表板版面（02-01）；使用者管理的其他部分（06-01）；答案隔離、評分、IAA 三項覆蓋率門檻（#111）
- **規格書與規則文件**：本 change 不改 `docs/specs/`、`design/prototype/` 與規則文件。決定帶來的需求與規則異動由另一條文件分支 `docs/login-clarification-specs` 承載：規格 01-01 §已確認決議 Q10–Q15（sa-8、sa-9、N2、U3、U8、U2）、規格 01-05 Q19 與 §四種改動讓所有裝置重新登入 的自動連結一列（U3）、security-agent-rules S4（N3，撤銷事件不含系統角色與任務成員身分變更）、`design/system/design-gaps.md` G-62–G-65（U1、U2、U5、U8）。specs 階段的 Requirement 以那條分支的規格文字為依據；該分支已由 PR #742 合併進 `main`（c6b5036）

## 引用的需求來源

- PRD `docs/specs/00-prd.mdx`：§使用者角色 §角色清單、§權限矩陣；§專案範圍 §範圍內、§假設與限制；§Site Map；§模組架構與串接 §模組依賴
- 規格 01-01 `docs/specs/01-account/01-login.mdx`：全頁；§已確認決議 Q1–Q15（Q10–Q15 見 `docs/login-clarification-specs`）；§用 Google 帳號登入 第 1、2、4、5 條；§登入頁 第 2、4、6–11 條；§用 Email 與密碼登入 第 2–20 條（第 15 條除外，見 sa-3）；§語言切換 第 2、3 條；§卡控機制；§邊界情況
- 規格 01-05 `docs/specs/01-account/05-login-state.mdx`：§一次登入是一段登入狀態、§登入狀態能撐多久、§延續登入狀態與疑似被盜用、§從這一台登出、§每一次操作都用最新的身分判定、§不能通行的登入狀態不說明原因（含新增第 4 條）、§Email 的識別規則、§沒有本地密碼的帳號、§四種改動讓所有裝置重新登入；Q1–Q5、Q7、Q11、Q13、Q14、Q18、Q19
- 規格 01-02 §已確認決議 Q10；規格 01-03 頁首；規格 01-04 §連結 Google 帳號（只作邊界）
- 規格 02-01 §業務流程「進入儀表板拿到自己的版面」E1；規格 07-01 §登出、§切換語言與外觀；規格 07-03 §兩種畫面的分工、Q2、Q6（只作邊界）
- 術語表 `term.login-state`、`term.system-role`、`term.platform-member`
- ADR-004 D1–D7；architecture §認證與授權、§授權四步、§Google SSO、§i18n 兩層、§API 契約、§測試分層
- security-agent-rules S1–S4（S4 依 `docs/login-clarification-specs` 的改寫）；testing-agent-rules T6、T9、T10；api-agent-rules A1、A7
- `design/system/design-gaps.md` G-62–G-65（`docs/login-clarification-specs`）
- Issue #719 §使用情境／功能範圍、§驗收條件、[決定表](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)、[落點確認](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187214559)；Epic #712；Issue #111 §2b 第二項；Issue #726
- 產品路線圖 §排序依據 第 2 條；資料表字典 §二 帳號組

## 待決問題

以下彙整上游四份與本份的全部待決項。候選 Q 已由維護者在 2026-11-26 決定；候選 P 依明確問題處理，不問維護者。「上游建議」欄保留決定前的原文，以便對照。

### 需要維護者決定的項目（候選 Q）

全部已決。「決定」欄的連結：**決**＝[決定表](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)，**畫**＝[落點確認](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187214559)。

| #     | 問題                                                                 | 來源                                                                                                                     | 上游建議                                                                                        | 決定（2026-11-26）                                                                                                                                                                                                                                       |
| :---- | :------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sa-1  | 「記住我」要不要做                                                   | `system-analysis.md` 待決 1、C1；sd 1；ui sa-1                                                                           | 1-A 不做，proposal 註明與 Issue 字面不同                                                        | 已決：不做，期限照 01-05 的 90 天／7 天；本份 §與 Issue #719 字面不同之處 已註明（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                  |
| sa-2  | 01-05 哪些部分在本次、哪些留給 #726；登入頁是否顯示被動登出的兩句    | sa 待決 2、C7；sd 2；ui sa-2；api-contract 依附 2-A                                                                      | 2-A：含期限、延續、被動登出碼與登出端點                                                         | 已決：期限、延續（含多分頁與疑似盜用）、被動登出兩句、登出端點都在本次；鎖定、撤銷事件本身、紀錄保留清除給 #726（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                   |
| sa-3  | 登入失敗 10 次擋 30 分鐘本次做嗎、「同一個人」怎麼認、計數放哪、文案 | sa 待決 3、C2；sd 3；ui sa-3；api-contract `ACCOUNT_LOGIN_THROTTLED`                                                     | 3-C 本次不做、交給 #726；認定以帳號加來源位址                                                   | 已決：本次不做，交給 #726；「同一個人」將來以帳號加來源位址認定（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                                   |
| sa-4  | 第一個可以登入的帳號從哪裡來                                         | sa 待決 4；sd 4                                                                                                          | 4-A 提前交付 Seeder 初始化指令                                                                  | 已決：提前做建立初始管理員（Seeder）的指令（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                                                        |
| sa-5  | 02-01 前的暫時落點內容、是否放登出；登出端點本次建不建               | sa 待決 5；sd 5；ui sa-5／7；api-contract `deleteCurrentSession`                                                         | 路由 `/dashboard/dashboard`；內容由維護者選（A／B 是新畫面，要 artifact）；後端 5-A             | 已決：最小佔位頁加登出鈕，登出端點本次建；畫面 artifact 已依 Ready gate 核准（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)、[畫](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187214559)） |
| sa-6  | 「忘記密碼？」「前往註冊」去處不存在時怎麼處理；寄信判斷由誰建       | sa 待決 6；sd 6；ui sa-6                                                                                                 | 連結照 prototype 顯示（ui A）；後端 6-A 本次建立共用判斷                                        | 已決：照 prototype 顯示，去處由後續張補；本次建「有沒有設定寄信服務」的共用判斷（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                   |
| sa-7  | 已登入的人開登入頁是否也走暫時落點                                   | sa 待決 7；sd 7；ui sa-5／7                                                                                              | 與 sa-5 同一個落點                                                                              | 已決：與 sa-5 同題，同一個落點（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)、[畫](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187214559)）                                               |
| sa-8  | 部署沒設定 Google 時按鈕怎麼呈現（可能要改規格）                     | sa 待決 8、C3；sd 8；ui sa-8                                                                                             | 8-A 按鈕在、點了不動作並顯示一句，規格補一條                                                    | 已決：不顯示 Google 按鈕與「或」分隔線；規格 01-01 補一條（Q10，`docs/login-clarification-specs`）（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                |
| sa-9  | 登入頁 Google 自動綁定算不算「連結 Google 成功」；要不要告知         | sa 待決 9、C4；sd 9；ui sa-9                                                                                             | 9-A 照 ADR-004 D5；是否告知未定                                                                 | 已決：照 ADR-004 D5 綁定，不另外告知；規格 01-01 補一句（Q11）、01-05 連結 Google 那一列補自動連結（`docs/login-clarification-specs`）（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                            |
| sa-10 | 登入後回原頁還是一律去落點                                           | sa 待決 10；sd 10；ui sa-10                                                                                              | 10-A 一律去落點                                                                                 | 已決：一律去落點（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                                                                                  |
| sa-11 | 守門做到授權四步的哪一步                                             | sa 待決 11；sd 11                                                                                                        | 11-A 只做第 1、2 步                                                                             | 已決：只做第 1、2 步，矩陣留給 06-02（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                                                              |
| sa-13 | 覆蓋率門檻範圍、畫面端守門是否算「認證」、#111 本文由誰改            | sa 待決 13、C6；sd 13                                                                                                    | 13-A 只建兩項，另三項不建空殼                                                                   | 已決：只建認證與授權兩項，#111 本文跟著改寫（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                                                       |
| N1    | refresh token 存在哪裡（字典 D7 曾拿掉）                             | `system-design.md` N1                                                                                                    | N1-A 新表 `account_refresh_token`                                                               | 已決：新表 `account_refresh_token`（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                                                                |
| N2    | 停用或已匿名化的帳號用 Google 登入時顯示哪一句                       | sd N2                                                                                                                    | N2-A 用 Google 那一句，規格 01-01 補一句                                                        | 已決：和「沒有對應帳號」同一句；規格 01-01 補一句（Q12，`docs/login-clarification-specs`）（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                        |
| N3    | 系統角色變更要不要撤銷登入狀態（S4 與規格 01-05 不一致）             | sd N3                                                                                                                    | N3-A 不撤銷，回頭改 S4                                                                          | 已決：不撤銷，以規格 01-05 為準；S4 已改寫，後續問答另核准撤銷事件不含任務成員身分變更（`docs/login-clarification-specs`）（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                        |
| U1    | 送出中整頁凍結：規格與 prototype 不一致                              | `ui-design.md` U1                                                                                                        | 依規格；是否登記 design-gaps、修 prototype 待定                                                 | 已決：以規格為準整頁凍結；差異記進 design-gaps G-62，prototype 不改（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                               |
| U2    | 帳密失敗橫幅何時收起                                                 | ui U2                                                                                                                    | 任一欄輸入就收起                                                                                | 已決：任一欄輸入就收起；規格 01-01 Q15，差異記進 G-63（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                                             |
| U3    | 文案缺口：平台沒回應、被擋 30 分鐘、被動登出英文、Spinner 英文名稱   | ui U3                                                                                                                    | (a)(b)(c) 以 `spec-writing` 補；(d) 沿用 brand.md                                               | 已決：沿用既有文案，缺的由派工擬稿寫進規格 01-01 Q13 與 01-05 Q19，擬稿已由維護者在後續問答核准；(b) 隨鎖定移到 #726，本次不需要（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                  |
| U5    | prototype 尺寸沒有對應 token                                         | ui U5                                                                                                                    | 未提建議                                                                                        | 已決：就近套用既有 token，差異記進 design-gaps G-64（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                                               |
| U6    | 守門查詢連不上或 `5xx` 時畫面                                        | ui U6                                                                                                                    | A 整頁錯誤加重試（新畫面）或 B 當未登入，未定                                                   | 已決：當成未登入，帶回登入頁並顯示「沒回應」那句（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                                                  |
| U7    | 未註冊路徑本次怎麼處理                                               | ui U7                                                                                                                    | A 交給 `/` 導向或 B 維持空白，未定                                                              | 已決：交給 `/` 依登入狀態導向，07-03 完成時改成找不到頁（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                                           |
| U8    | 語言切換鈕的無障礙名稱不含可見文字                                   | ui U8                                                                                                                    | 低優先，未定                                                                                    | 已決：改成含「ZH」；規格 01-01 Q14，差異記進 G-65（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                                                                                                 |
| PL1   | `AUTH_SECRET` 必填且無預設，與 Lite「範例檔複製即可啟動」衝突        | 本份新發現：`system-design.md` T8 vs `container-runtime`「Lite 層以預設值起服務」「設定範例檔列出所有設定且不含 secret」 | 未提建議。可能方向：首次啟動自動產生並存進資料 volume，或改成必須先編輯 `.env`（Lite 承諾改變） | 已決：沒設就首次啟動自動產生並存進資料 volume；正式層仍要求明確設定。spec delta 改 `runtime-config`、`container-runtime`（[決](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)）                                          |

### 明確問題（候選 P）

| #      | 問題                                                                                                                                 | 來源                                                                            | 回修者與處理                                                                                                                                                                                          |
| :----- | :----------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sa-12  | 字典排除的三欄                                                                                                                       | sa 待決 12、C5；sd 12                                                           | 已處理：`sd` 補回字典與 ER，並依 N1 新增 `account_refresh_token`，`pnpm check:er` 通過；`dba` 依字典寫 migration（tasks）                                                                             |
| U4     | `frontend-i18n` 與規格 01-01 語言切換不一致                                                                                          | ui U4                                                                           | `planner`，specs 階段：`frontend-i18n` spec delta MODIFIED「介面語言依瀏覽器語言決定」；同時檢查 `dev-health-page`、`e2e-testing` 中以瀏覽器語言為前提的 Scenario 是否仍成立，不成立就一併列 MODIFIED |
| U9     | 暫時落點需要 `getCurrentSession` 回應裡有 `user.email`                                                                               | ui U9                                                                           | 已處理：`api-contract.md` 已把 `email` 加進 `SessionUserData`（a93d962）；specs 階段在 `auth-guard` 寫出回應明列的四欄                                                                                |
| C1     | `api-envelope` 第一批通用碼要加兩個                                                                                                  | `api-contract.md` C1                                                            | `planner`，specs 階段：`api-envelope` spec delta MODIFIED                                                                                                                                             |
| C2     | `auth-options` 單數化                                                                                                                | api-contract C2                                                                 | `planner`，tasks 階段：列一項 task（`_IRREGULAR_SINGULARS` 加 `options`），不改 capability                                                                                                            |
| C3、C4 | ui-design 的 Google 回調方式、路徑與 operationId 和 api-contract 不一致                                                              | api-contract C3、C4                                                             | 已處理：`ui-ux` 於 e18432f 對齊，a93d962 再確認；不需 spec delta                                                                                                                                      |
| PL2    | `frontend-api-client`「不自動重送」「認證錯誤整個過程只送 1 次」與「`401` 先延續再重送原請求」衝突                                   | 本份新發現：ui-design §資料來源 vs 既有 capability                              | `planner`，specs 階段：`frontend-api-client` spec delta MODIFIED，把延續後重送與 `409 ACCOUNT_REFRESH_CONFLICT` 稍等重送寫成僅有的例外；寫入帶 `X-CSRF-Token` 同時改（sa-2 已決，依附成立）           |
| PL3    | `api-envelope`「本次沒有 `204` 例外端點」與登出的 `204`                                                                              | 本份新發現：api-contract §deleteCurrentSession                                  | `planner`，specs 階段：`api-envelope` spec delta MODIFIED（sa-5 已決建登出端點，依附成立）                                                                                                            |
| PL4    | `frontend-routing` 開發模式 `/` 導向 `/dev/health` 與 `/` 依登入狀態導向衝突                                                         | 本份新發現：ui-design §頁面與路由 vs 既有 capability                            | `planner`，specs 階段：`frontend-routing` spec delta MODIFIED 三條 Requirement；未知路徑依 U7（已決）                                                                                                 |
| PL5    | `backend-code-boundaries`「今天沒有任何入口」不再成立                                                                                | 本份新發現：sd §目錄新增 `app/oidc/`                                            | `planner`，specs 階段：`backend-code-boundaries` spec delta MODIFIED                                                                                                                                  |
| PL6    | `database-migration`「升到最新後版本紀錄恰好一筆、值為基準版本」「除版本紀錄表外沒有其他資料表」在新增第一個業務 revision 後不再成立 | 本份新發現：sd §資料模型異動 vs 既有 capability                                 | `planner`，specs 階段：`database-migration` spec delta MODIFIED，改成「升到最新是最新 revision、降回起點完全還原」；第一個業務 revision 的可逆驗證由 `dba` 的 task 帶測試                             |
| PL7    | `component-gallery`「Badge 正好五個 variant」「展示頁依序七個區塊」與新增 `label`、`separator` 原語及 `badge` 角色變體衝突           | 本份新發現：ui-design §元件樹 › 登入頁、§元件與 design token vs 既有 capability | `planner`，specs 階段：`component-gallery` spec delta MODIFIED 兩條 Requirement；`button` 送出中狀態若就是既有的 `loading`，不另改                                                                    |

`system-design.md` 的技術待決 T1–T11 已由設計自行決定（T1 經協調者採用），不列為待決；若之後對 T 項有異議，再由 `sd` 回修。
