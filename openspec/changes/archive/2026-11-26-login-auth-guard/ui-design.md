# UI Design

本份是 change `login-auth-guard`（Issue #719）的前端設計：登入頁、Google 回調、前端的頁面守門，以及登入後的暫時落點。畫面長相以 `design/prototype/pages/account/login.html` 為準，元件與狀態以 `design/system/` 為準，業務規則以規格 01-01、01-05 為準；暫時落點以維護者 2026-11-26 依 Ready gate 同意的畫面 artifact 為準（[核准留言](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187214559)）。規劃時的提案都已在 clarification 停點由維護者決定（[決定表](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)），本份照決定寫成定案的設計，對照見 [§維護者決定的對照](#維護者決定的對照)。

## Prototype 對照

| 畫面                                       | 來源                                                                                                                               | design system                                 | 對應的規格                                                                                  |
| :----------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------ |
| 登入頁（預設）                             | `design/prototype/pages/account/login.html`（`#state-default`）                                                                    | `design/system/pages/account-login.md`        | 規格 01-01 §登入頁 第 1–5 條                                                                |
| 登入頁：沒有設定寄信服務                   | 同上，加 `?sim_no_mail=1`（底部註冊那一列整列不顯示）                                                                              | 同上（交付包還沒有這個視圖）                  | 規格 01-01 §登入頁 第 10 條、§卡控機制；規格 01-02 Q10                                      |
| 登入頁：Google 沒有對應帳號或 Email 未驗證 | 同上，加 `?sim_google_no_account=1`（錯誤橫幅顯示 Google 那一句）                                                                  | 同上（交付包還沒有這個視圖）                  | 規格 01-01 §用 Google 帳號登入 第 4 條、E2；規格 01-05 Q18                                  |
| 登入頁：欄位必填錯誤                       | 同上，兩欄留空送出                                                                                                                 | `#state-field-error`                          | 規格 01-01 §用 Email 與密碼登入 第 2–7 條                                                   |
| 登入頁：送出中                             | 同上，填好送出                                                                                                                     | `#state-submitting`                           | 規格 01-01 §用 Email 與密碼登入 第 8–10 條（整頁凍結以規格為準，見 U1）                     |
| 登入頁：帳號或密碼錯誤                     | 同上；markup 的 `#errorBanner` 預設文案即「帳號或密碼錯誤，請再試一次」，原型沒有開關能叫出它                                      | Alert Banner                                  | 規格 01-01 §用 Email 與密碼登入 第 12–14 條、Q1、Q2                                         |
| 已登入的人開登入頁                         | 同上，`?sim_logged_in=1`：畫出來之前就導向落點                                                                                     | `#sim-logged-in`                              | 規格 01-01 §登入頁 第 9 條、Q3                                                              |
| 登入頁：沒有設定 Google                    | prototype 沒有；依維護者決定 sa-8，不顯示 Google 鈕與「或」分隔線，其餘不變                                                        | 同登入頁                                      | 規格 01-01 §登入頁 第 11 條、Q10                                                            |
| 登入頁：被動登出的兩句、送出後平台沒有回應 | prototype 沒有；用同一個錯誤橫幅，不是新畫面                                                                                       | Alert Banner                                  | 規格 01-05 Q4、§不能通行的登入狀態不說明原因；規格 01-01 §用 Email 與密碼登入 第 16 條、Q13 |
| 登入後的暫時落點                           | **維護者核准的畫面 artifact**（<https://claude.ai/artifact/9YYG8xYVeJLtcBH2y5faj3>）；prototype 沒有，也不修改 `design/prototype/` | Auth Navbar、Auth Card、Badge（role）、Button | Issue #719 sa-5、sa-7；規格 01-05 §從這一台登出                                             |
| 守門判定中、Google 回調處理中              | 沒有畫面，只有頁面底色（不是新畫面）                                                                                               | 無                                            | 規格 01-05 §不能通行的登入狀態不說明原因                                                    |

prototype 與規格的四處差異（U1 整頁凍結、U2 橫幅收起時機、U5 尺寸就近套 token、U8 語言鈕名稱）已由 PR #742 登記進 `design/system/design-gaps.md`；本份照決定實作，不改 `design/prototype/`。

## 頁面與路由

路徑沿用 prototype 的頁面識別（`docs/prototype/navigation.mdx` 的 `/account/login`、`/dashboard/dashboard`），02-01 外殼完成時只換 `/dashboard/dashboard` 的頁面元件，路徑與導向不變。

| 路由                          | 頁面                                                                                                    | 對應的規格                                                              | 需要的角色                                                                                                                                    |
| :---------------------------- | :------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `/account/login`              | 登入頁 `LoginPage`                                                                                      | 規格 01-01 全頁                                                         | **只給未登入的訪客**；已有可通行登入狀態的人（三種系統角色皆同）以取代歷史紀錄的方式導向落點，畫面上不出現登入頁（01-01 §登入頁 第 9 條、Q3） |
| `/account/google/callback`    | Google 回調 `GoogleCallbackPage`：沒有自己的畫面，只把 Google 帶回來的 `code`、`state` 交給後端，再導走 | 規格 01-01 §用 Google 帳號登入、E1、E2；`system-design.md` §技術待決 T1 | **只給未登入的訪客**；這個路徑登記為 Google 的回調網址（`api-contract` 已確認）                                                               |
| `/dashboard/dashboard`        | 暫時落點 `DashboardPlaceholderPage`（02-01 完成時換成儀表板）                                           | Issue #719 sa-5、sa-7；規格 01-01 Q7；規格 01-05 §從這一台登出          | 需要登入；三種系統角色都一樣，不看任務角色                                                                                                    |
| `/`                           | 不顯示內容，只依登入狀態導向                                                                            | 規格 01-01 §登入頁 第 9 條、Q3                                          | 任何人；已登入 → 落點，未登入 → `/account/login`                                                                                              |
| 其他路徑                      | 以取代歷史紀錄的方式導向 `/`，再依登入狀態導向（U7）；07-03 完成時改成找不到頁                          | 規格 07-03（之後取代）                                                  | 任何人                                                                                                                                        |
| `/dev/health`、`/dev/gallery` | 不變，只在開發模式註冊，不經過守門                                                                      | `openspec/specs/dev-health-page/`、`component-gallery/`                 | 開發用                                                                                                                                        |

### 進入、離開與返回

依規格 01-01 與帳號模組 `docs/specs/01-account/index.mdx` §Logic Flow 分段一、分段四：

| 節點／連線       | 前端行為                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S → D1           | 打開 `/`、任何需要登入的路由或只給未登入的路由時，先查「目前的登入狀態」；判定完成前不畫任何一頁的內容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D1 是 → X5       | 以取代歷史紀錄的方式到 `/dashboard/dashboard`；按瀏覽器上一頁不會回到登入頁                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D1 否 → P1       | 以取代歷史紀錄的方式到 `/account/login`；**不帶原本要去的頁面**，登入後一律去落點（sa-10）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D1 判定失敗 → P1 | 守門查詢連不上、逾時或 `5xx`：當成未登入，帶回 `/account/login` 並在錯誤橫幅顯示「沒有回應」那一句（U6）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| P1 → D2 是 → X5  | 登入成功 → 等「目前的登入狀態」更新為已登入，再以取代歷史紀錄的方式到落點（避免守門還讀到舊結果、把人彈回登入頁）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D2 否 → 停在 P1  | 留在同一頁，兩欄內容不清空（01-01 §用 Email 與密碼登入 第 13 條）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| P1 → X1          | 點「使用 Google 帳號繼續」→ 先向後端取得授權網址（`getGoogleAuthorization`），再以整頁導覽前往；授權網址只用這一次，不存進任何狀態。`googleEnabled` 為假時這個按鈕不存在（sa-8）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| X1 → D3          | Google 導回 `/account/google/callback`：網址帶 `error`（取消或 Google 拒絕）→ 不呼叫後端，直接回登入頁；帶 `code`、`state` → 呼叫 `createGoogleSession`，回應前只有頁面底色                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D3 是 → X5       | `createGoogleSession` 成功 → 等「目前的登入狀態」更新，再以取代歷史紀錄的方式到落點。對上還沒連結 Google 的既有帳號時照 ADR-004 D5 綁定，畫面**不另外告知**（sa-9）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D3 否 → P1       | 一律以取代歷史紀錄的方式回 `/account/login`，回調網址（含 `code`、`state`）不留在歷史紀錄裡。E1：**不顯示錯誤**；E2：以導覽時夾帶的路由狀態帶一個「顯示 Google 那一句」的旗標，不帶原因、不放網址                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| P1 → P2、P1 → P4 | 「前往註冊」到 `/account/register`（只在 `selfRegistrationEnabled` 為真時顯示）、「忘記密碼？」到 `/account/forgot-password`，照 prototype 顯示（sa-6）。兩條路由由 01-02、01-03 的 change 註冊；在那之前點下去落到「其他路徑」（U7），回到 `/` 再依登入狀態導回登入頁                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| X5 → X7（登出）  | 暫時落點的「登出」→ `deleteCurrentSession`；**不論結果**都清掉「目前的登入狀態」查詢，以取代歷史紀錄的方式到 `/account/login`（01-05 §從這一台登出 第 4 條：回應完全相同，畫面不分）。其他裝置不受影響                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| X7 → P1（被動）  | 任何請求回 `401 AUTH_REQUIRED` → 試延續（`createSessionRefresh`），**全程最多延續 2 次、重送原請求 2 次**（規格 01-05 §多個分頁同時延續登入狀態 第 2、3 條與 Scenario「重試仍失敗就帶回登入頁」）：①第一次延續成功 → 重送原請求；②延續回 `409 ACCOUNT_REFRESH_CONFLICT`（同一台另一個分頁剛延續過）→ **不回登入頁**，短暫等候後用目前的 cookie 重送原請求一次；③這次重送仍回 `401` → **再延續一次**，成功就再重送一次；④還是不行 → 回 `/account/login`，不再重試。延續最後回的碼決定登入頁顯示什麼：`ACCOUNT_SESSION_EXPIRED` →「登入已過期，請重新登入」、`ACCOUNT_SESSION_INVALID` →「驗證失敗，請重新登入」（sa-2，規格 01-05 §不能通行的登入狀態不說明原因）；`AUTH_REQUIRED`（沒有 refresh cookie，例如從沒登入過的訪客）或 `409` 用完次數 → **不顯示任何訊息** |

## 常駐文件異動

- 常駐文件：`docs/diagrams/architecture/frontend-routes.mdx`（已先改）

| 節                                | 異動                                         | 摘要                                                                                                                                                                                                                                                               |
| :-------------------------------- | :------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §路由                             | 摺疊區塊「規劃中：login-auth-guard（#719）」 | `/account/login`、`/account/google/callback`、`/dashboard/dashboard`（`DashboardPlaceholderPage`）、`/` 與「其他路徑導向 `/`」，含規格與 Logic Flow 節點；路徑沿用 prototype 頁面識別；`/dev/*` 不經過守門。標明還沒有合併，合併後由 `frontend-developer` 併進主表 |
| §頁面與功能元件                   | 新增三列                                     | `LoginPage`、`GoogleCallbackPage`、`DashboardPlaceholderPage` 各自的功能元件與 operationId；namespace `auth`                                                                                                                                                       |
| §前端骨架 › `apiFetch` 的細節之後 | 摺疊區塊「規劃中的骨架異動」                 | 守門層兩種路由包裝、守門判定失敗當成未登入、`401` 先試一次延續再回登入頁、寫入請求帶 `X-CSRF-Token`、登出、語言切換與現行 `frontend-i18n` 不同（U4）、預期新增的原語                                                                                               |
| §已知限制                         | 改一格                                       | 「登入與登入狀態的處理」一列的追蹤補上 #719                                                                                                                                                                                                                        |
| frontmatter                       | `updatedAt`                                  | 2026-11-26                                                                                                                                                                                                                                                         |

## 元件樹

元件以語意名稱描述；能直接對到 shadcn/ui 的標在括號裡（放 `components/ui/`），其餘是 `features/auth/` 或頁面自己的組合。

### 守門

```text
Router
├─ "/"                     RootRedirect：讀目前的登入狀態 → 導向落點或登入頁
├─ 只給未登入的人（PublicOnlyRoute）
│  ├─ "/account/login"     LoginPage
│  └─ "/account/google/callback" GoogleCallbackPage（沒有畫面，處理完即導走）
├─ 需要登入（RequireAuthRoute）
│  └─ "/dashboard/dashboard" DashboardPlaceholderPage
├─ 開發模式："/dev/health"、"/dev/gallery"（不經守門）
└─ "*"                     以取代歷史紀錄的方式導向 "/"（07-03 完成時換成找不到頁）
```

- 兩種包裝讀**同一個**「目前的登入狀態」查詢，不各自發請求
- 判定中：畫面只有頁面底色（`--color-surface`），不畫登入卡、不畫落點，也不顯示任何帳號資訊（prototype `login.html:497`–`:503` 的註解：在畫面畫出來之前就決定，避免閃一下再跳走）
- 守門只做授權四步的第 1、2 步（已登入、帳號啟用，sa-11），只決定「讓不讓進、往哪裡去」；不自己判斷角色能看到什麼，權限一律由後端擋（architecture §前端、F8）

### 共用外殼（登入頁與暫時落點）

```text
AuthLayout（登出狀態的外殼，沒有側欄）
├─ AuthNavbar（<header>，banner）                          design/system: Auth Navbar
│  ├─ BrandLink → "/"：品牌標誌（Lucide Tag，主色底圓角方塊）＋ 字標「Label Suite」
│  └─ LanguageToggle（Button outline／sm）：Lucide Globe ＋ 目前代號 ZH／EN    design/system: Language Toggle
└─ <main>：頁面內容（置中的單張卡片）
```

暫時落點沿用這個外殼（artifact：「沿用登入頁的頁首與卡片樣式，沒有側欄」）。語言切換在兩頁行為相同。

### 登入頁

```text
AuthLayout
└─ LoginPage
   └─ AuthCard（Card；region，名稱「登入」）                 design/system: Auth Card
      ├─ AuthCardHeader：品牌標誌（大）、標題「Label Suite」、副標「登入你的帳號」
      ├─ FormErrorBanner（Alert，錯誤；平時不渲染）          design/system: Alert Banner
      │    Lucide CircleAlert ＋ 一句訊息（見 §畫面狀態）
      ├─ GoogleSignInButton（Button 次要／OAuth；只在 googleEnabled 為真時渲染）  design/system: Button（.sso-btn ＝ .btn-oauth，G-03）
      │    Google 的 G 標誌（品牌標記例外，用 prototype 的 assets/google-g.svg）＋「使用 Google 帳號繼續」
      ├─ TextDivider（Separator ＋「或」＋ Separator；與 Google 鈕同進同出）  design/system: Divider（文字分隔，G-18）
      └─ LoginForm（<form>，不用瀏覽器內建驗證）
         ├─ EmailField
         │  ├─ Label「電子郵件」（Label）
         │  ├─ Input：前置 Lucide Mail；type email、autocomplete email、placeholder name@example.com
         │  └─ FieldError（以 aria-describedby 關聯）          design/system: Input 的 .field-error
         ├─ PasswordField
         │  ├─ 標籤列：Label「密碼」 ＋ ForgotPasswordLink「忘記密碼？」
         │  ├─ PasswordInput：前置 Lucide Lock；autocomplete current-password；
         │  │   右側 PasswordEyeToggle（Lucide EyeOff／Eye）   design/system: Password Eye Toggle
         │  └─ FieldError
         ├─ SubmitButton（Button 主要，CTA 色）「登入」；送出中換成 Spinner   design/system: Button、Spinner
         └─ RegisterRow「還沒有帳號？ 前往註冊」（只在 selfRegistrationEnabled 為真時渲染）
```

- 版面、順序、文案逐字照 prototype（含英文版字串表 `login.html:537`–`:560`）；沒有「記住我」（sa-1）
- 規格 01-01 §用 Google 帳號登入 的段末說明註明英文版文案只是 prototype 的字串，所以英文以 prototype 為準、但不當成規格驗收
- 中文介面的 Email 一律寫「電子郵件」（`brand.md` §Email 與專有名詞）
- `googleEnabled` 為假時 Google 鈕與「或」分隔線都不渲染，卡片從錯誤橫幅（若有）直接接到表單，不留空洞（sa-8；同 01-01 §邊界情況「卡片排版不留空洞」的處理）
- `features/auth/`：`LoginForm`、`GoogleSignInButton`、`GoogleCallbackHandler`、`SignedInCard`、`LogoutButton`、守門的兩種包裝與「目前的登入狀態」hook。`AuthLayout`、`AuthNavbar`、`AuthCard`、`LanguageToggle`、`PasswordInput` 之後註冊、重設密碼頁也會用，放在共用位置（`components/` 下非 `ui/` 的組合，或 `features/auth/` 對外匯出），由 `design.md` 決定
- 新增的 shadcn/ui 原語：`label`、`separator`；`button` 增加送出中的狀態；`badge` 增加角色的變體（暫時落點用）。各自在元件展示頁要有一節（完整性測試會擋）。`card`、`input`、`alert` 已存在

### Google 回調

```text
（不用 AuthLayout；只有頁面底色，同守門判定中）
└─ GoogleCallbackPage
   └─ GoogleCallbackHandler（features/auth/）
      ├─ 讀網址：error？→ 回登入頁（E1，不顯示錯誤）
      ├─ 讀網址：code、state → createGoogleSession（只送一次）
      └─ 依結果導走：落點／登入頁（E2 帶旗標）／登入頁（E1）／登入頁（沒有回應）
```

- 沒有任何可見元件，也沒有可互動的東西；不是新畫面
- 只送一次：React 開發模式的 StrictMode 會讓效果跑兩次，而 `state` 對應的流程 cookie 只能用一次，送第二次會變成 E1；同一組 `code`、`state` 只能送出一次
- 網址上的 `code`、`state` 只交給後端，不寫進任何狀態、紀錄或錯誤訊息

### 暫時落點

依維護者核准的 artifact：

```text
AuthLayout
└─ DashboardPlaceholderPage
   └─ SignedInCard（Card；region，名稱「你已登入」；內容置中）   design/system: Auth Card 的卡片
      ├─ 標題「你已登入」（<h1>）
      ├─ 身分列「{name}（{email}）」                            資料：getCurrentSession 的 user.name、user.email
      ├─ 系統角色（Badge 角色變體，藥丸）                          design/system: Badge（.badge-role）
      │    user.role：user →「平台成員」、super_admin →「系統管理員」（Seeder 管理員也是 super_admin）
      ├─ 說明「儀表板還在建置中，完成後登入會直接帶你過去。」
      └─ LogoutButton（Button 次要，外框）「登出」                  design/system: Button
```

- 卡片沿用 Auth Card 的底色、圓角、陰影與 480px 最大寬；沒有品牌標誌（artifact 沒有），沒有側欄，沒有任何業務資料或導覽連結
- 系統角色只顯示**系統角色**（`user.role`），不顯示任務角色。artifact 的示範值寫「專案負責人」，那是任務角色，只是示範資料；實作以 `user.role` 對到的兩個名稱為準（PRD §角色清單）。英文名稱用 prototype 既有的「Platform Member」「System Admin」
- 文字中英兩份都進 `auth` namespace。英文照 `design.md` D12（維護者 2026-11-26 核准）：「你已登入」`You're signed in`、說明句 `The dashboard is still being built. Once it's ready, signing in will take you straight there.`、「登出」`Sign out`、瀏覽器標題 `Label Suite — Signed In`（中文「Label Suite — 你已登入」）；角色 `Platform Member`、`System Admin`
- 02-01 外殼完成時，這一頁整個換成儀表板，路徑不變

## 資料來源

端點、operationId、欄位名與錯誤碼一律照 `api-contract.md` 的端點總覽（operationId 由路徑算出，api-agent-rules A1）。Google 登入不用 `302`：兩個端點都是一般的 JSON 與 envelope（`system-design.md` §技術待決 T1）。

| 區塊                           | operationId                                                                                                                                                                                           | 快取鍵／失效時機                                                                                                                                                                                                                                                                                                                                                     |
| :----------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 守門與暫時落點：目前的登入狀態 | `getCurrentSession`（`GET /api/v1/current-session`）；回 `user.id`、`user.name`、`user.email`、`user.role`                                                                                            | 生成的 query key；整個 app 共用一份，守門與暫時落點讀同一份、不另發請求。登入成功後重新取得並等它完成再導向；登出後清掉；回 `401 AUTH_REQUIRED` 時照 X7 試延續，仍不行才清掉；期限與閒置**不在畫面端計算**，一律以後端回應為準（規格 01-05 Q11）                                                                                                                     |
| 守門：延續登入狀態             | `createSessionRefresh`（`POST /api/v1/session-refreshes`，body `{}`）                                                                                                                                 | mutation；同一時間只發一次（多個請求同時遇到 `401` 時共用同一次延續）；一次被動處理裡最多延續 2 次、重送原請求 2 次（X7）。成功 → 重新取得「目前的登入狀態」並重送原請求。`401 ACCOUNT_SESSION_EXPIRED`／`ACCOUNT_SESSION_INVALID` 決定被動登出的兩句；`401 AUTH_REQUIRED`（沒有 refresh cookie）不顯示任何句子；`409 ACCOUNT_REFRESH_CONFLICT` 不進畫面，等候後重送 |
| 登入頁：部署能力               | `getAuthOptions`（`GET /api/v1/auth-options`）；回 `selfRegistrationEnabled`、`googleEnabled` 兩個布林。規格 01-02 Q10 要求登入頁、註冊頁與後端共用同一個判斷，所以來自後端，不是前端建置時的環境變數 | 生成的 query key；部署設定在執行期間不變，取得一次即可，不需要失效                                                                                                                                                                                                                                                                                                   |
| 登入表單：用 Email 與密碼登入  | `createSession`（`POST /api/v1/sessions`）                                                                                                                                                            | mutation；成功 → 重新取得「目前的登入狀態」；失敗不動任何快取                                                                                                                                                                                                                                                                                                        |
| Google 登入：取得授權網址      | `getGoogleAuthorization`（`GET /api/v1/google-authorization`）；回 `authorizationUrl`                                                                                                                 | 點按鈕時才取（每次都會發新的流程 cookie，不預取）；不快取，用完即丟；`googleEnabled` 為假時按鈕不存在，不會呼叫                                                                                                                                                                                                                                                      |
| Google 登入：完成登入          | `createGoogleSession`（`POST /api/v1/google-sessions`，body `code`、`state`）                                                                                                                         | mutation；成功 → 重新取得「目前的登入狀態」；只看 HTTP 狀態與 `code`、不讀 `message`：`400 ACCOUNT_GOOGLE_FLOW_INVALID` 是 E1，`401 ACCOUNT_GOOGLE_REJECTED` 是 E2，前端只轉成「要不要顯示那一句」一個布林                                                                                                                                                           |
| 暫時落點：登出                 | `deleteCurrentSession`（`DELETE /api/v1/current-session`，`204` 無 body）                                                                                                                             | mutation；不論成功或失敗都清掉「目前的登入狀態」查詢（連同其他查詢快取），以取代歷史紀錄的方式到 `/account/login`                                                                                                                                                                                                                                                    |

### 狀態放哪裡

不需要全域 store：

| 狀態                                                                        | 放哪裡                                                                        | 理由                                                                                                   |
| :-------------------------------------------------------------------------- | :---------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| 目前的登入狀態、部署能力                                                    | TanStack Query                                                                | 伺服器狀態；守門與頁面讀同一份快取                                                                     |
| 介面語言                                                                    | i18n 實例＋瀏覽器儲存（prototype 的 `labelsuite.lang`，`brand.md` §設計決策） | 規格 01-01 §語言切換 第 3 條要跨頁沿用；值不是兩種之一或讀不到時當成繁體中文（§邊界情況）              |
| 表單欄位值、欄位錯誤、錯誤橫幅、送出中、密碼是否顯示                        | 登入頁的本地狀態                                                              | 純 UI；失敗時欄位值保留                                                                                |
| 登出送出中                                                                  | 暫時落點的本地狀態                                                            | 純 UI                                                                                                  |
| 登入頁要顯示的那一句（Google E2、被動登出兩句、守門判定失敗的「沒有回應」） | 導覽時夾帶的路由狀態，登入頁讀進本地狀態；不放網址                            | 只有幾個不含帳號資訊的固定值。不放網址，重新整理或分享連結不會再出現，也沒人能做出一個顯示這幾句的連結 |

沒有可分享的篩選或分頁，沒有需要放 query string 的狀態。

## 畫面狀態

錯誤橫幅的文字由前端依錯誤外層的 `code`（網路錯誤則依 `ApiError.kind`）對到 `auth` 語言檔的字串，**不顯示後端的 `message`**；文案全部取自既有來源：

| 情況                                 | 繁體中文                                                           | 英文                                                                                                    | 來源                                                                       |
| :----------------------------------- | :----------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------- |
| `ACCOUNT_INVALID_CREDENTIALS`        | 帳號或密碼錯誤，請再試一次                                         | Invalid email or password                                                                               | prototype `login.html:526`、`:550`；規格 01-01 Q1                          |
| `ACCOUNT_GOOGLE_REJECTED`            | 無法用這個 Google 帳號登入。需要帳號的話，請聯絡系統管理員邀請你。 | You can't sign in with this Google account. If you need an account, ask an administrator to invite you. | prototype `login.html:527`、`:551`；規格 01-01 §用 Google 帳號登入 第 4 條 |
| `ACCOUNT_SESSION_EXPIRED`（延續）    | 登入已過期，請重新登入                                             | Session expired, please sign in again                                                                   | 規格 01-05 Q4、§不能通行的登入狀態不說明原因                               |
| `ACCOUNT_SESSION_INVALID`（延續）    | 驗證失敗，請重新登入                                               | Authentication failed, please sign in                                                                   | 同上                                                                       |
| 連不上、逾時、`5xx` 與歸到這一類的碼 | 平台暫時沒有回應，請稍後再試。                                     | The platform is not responding. Please try again later.                                                 | 規格 01-01 §用 Email 與密碼登入 第 16 條、Q13                              |
| Spinner 的無障礙名稱                 | 載入中                                                             | Loading                                                                                                 | 規格 01-01 §用 Email 與密碼登入 第 8 條、Q13                               |

`AUTH_REQUIRED` 沒有對應的句子：它只觸發延續，延續也回 `AUTH_REQUIRED` 時登入頁不顯示橫幅。

### 守門：目前的登入狀態

| 狀態          | 呈現                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| loading       | 只有頁面底色，不畫任何頁面內容（見 §元件樹 › 守門）；不用 skeleton——登入頁與落點長得不一樣，骨架會猜錯版面                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| error         | `401 AUTH_REQUIRED`（不存在、已失效、屬於別的帳號、帳號已停用，一律同一個碼）→ 照 §進入、離開與返回 X7 試延續（最多延續 2 次、重送 2 次）；仍不行 → 在需要登入的路由：回登入頁；在登入頁：留在登入頁。登入頁顯示什麼只看延續最後回的碼：`ACCOUNT_SESSION_EXPIRED`「登入已過期，請重新登入」、`ACCOUNT_SESSION_INVALID`「驗證失敗，請重新登入」；延續回 `AUTH_REQUIRED`（沒有 refresh cookie）時**不顯示任何橫幅**——從沒登入過的訪客開啟登入頁、`/` 或任何需要登入的路由，都只看到乾淨的登入頁。除此之外**不說明原因**。連不上、逾時或 `5xx` → 當成未登入，帶回登入頁並顯示「沒有回應」那一句（U6）；已經在登入頁就直接顯示那一句 |
| empty         | 不適用：「沒有登入」就是 `401`，沒有第三種結果                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 無權限（403） | 不適用：這個查詢對任何人都不回 `403`。登入後各頁的 `403` 交給該頁（規格 07-03），守門不處理                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 欄位被遮蔽    | 無遮蔽欄位；回應只明列 `api-contract` 的欄位，畫面不顯示其他帳號資訊                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### 暫時落點：目前的登入狀態

這一頁與守門讀同一份查詢；能畫出這一頁時，守門已經確認查詢成功。

| 狀態          | 呈現                                                                                                      |
| :------------ | :-------------------------------------------------------------------------------------------------------- |
| loading       | 不會出現在這一頁：守門判定完成前整頁只有頁面底色（同上）                                                  |
| error         | 不會出現在這一頁：查詢失敗時守門已經帶回登入頁（同上）。這一頁之後的請求（只有登出）回 `401` 也照 X7 處理 |
| empty         | 不適用：回應一定有 `user`；`name` 為空字串時身分列只顯示 Email，不顯示空括號                              |
| 無權限（403） | 不適用：三種系統角色都能進，`getCurrentSession` 不回 `403`                                                |
| 欄位被遮蔽    | 無；`email` 是登入者自己的 Email（PRD §權限矩陣「01 帳號」`R (o)`），只在這一頁顯示給本人                 |

### 暫時落點：登出

| 狀態                         | 呈現                                                                                                          |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------ |
| 送出中                       | 「登出」鈕停用（真的擋住鍵盤，G-06）並顯示 Spinner，重複點只送出一次                                          |
| 成功（`204`）                | 清掉「目前的登入狀態」查詢，以取代歷史紀錄的方式到登入頁，不顯示任何訊息                                      |
| error（連不上、逾時、`5xx`） | **與成功相同**：照樣清掉查詢並回登入頁，不顯示錯誤（01-05 §從這一台登出 第 4 條：伺服器端是否失效，畫面不分） |
| empty／無權限（403）／遮蔽   | 不適用：端點不檢查角色、只有通用錯誤、沒有 body                                                               |

### 登入頁：部署能力

| 狀態                                 | 呈現                                                                                                                                                                  |
| :----------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| loading                              | 登入卡與表單照常顯示；Google 鈕、「或」分隔線與底部註冊那一列**先不渲染**，回來確認為真才出現，不會先出現再消失                                                       |
| error                                | Google 鈕、「或」分隔線與註冊那一列都不渲染（寧可少一條路，也不顯示一條點了才發現不能用的路）；不顯示錯誤橫幅——錯誤橫幅留給使用者自己的動作。Email 與密碼登入照常可用 |
| 回來：`googleEnabled` 為假           | 不渲染 Google 鈕與「或」分隔線（sa-8）                                                                                                                                |
| 回來：`selfRegistrationEnabled` 為假 | 不渲染「還沒有帳號？ 前往註冊」整列（規格 01-01 §登入頁 第 10 條）                                                                                                    |
| empty                                | 不適用                                                                                                                                                                |
| 無權限（403）                        | 不適用：未登入就能讀，對任何人都不回 `403`                                                                                                                            |
| 欄位被遮蔽                           | 無                                                                                                                                                                    |

### 登入表單（送出）

| 狀態                                                     | 呈現                                                                                                                                                                                                                                                                                                                           |
| :------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 驗證錯誤（送出前）                                       | 只檢查兩項：Email 去掉前後空白後不得為空、密碼不得為空（01-01 Q8：不檢查格式與組成規則）。哪一欄沒填就在那一欄下方顯示「請輸入電子郵件」／「請輸入密碼」，欄位外框換錯誤色；兩欄都沒填時兩欄各自顯示。在報錯的欄位輸入 → 那一欄的錯誤立刻消失（UXC-05）                                                                        |
| 錯誤橫幅收起                                             | 在**任一欄**輸入、切換語言、或下一次送出時，錯誤橫幅收起（U2）                                                                                                                                                                                                                                                                 |
| 送出中                                                   | 「登入」鈕停用、文字換成 Spinner（無障礙名稱「載入中」）；**整頁其餘部分都不可互動**：語言切換、品牌連結、Google 鈕、兩個欄位、密碼切換、「忘記密碼？」與「前往註冊」都對滑鼠與鍵盤無效（規格 01-01 §用 Email 與密碼登入 第 9 條、Q6；U1）。防重複送出：停用要真的擋住鍵盤（`disabled`，不是只關滑鼠，G-06），重複點只送出一次 |
| error：帳號或密碼不對、帳號已停用                        | `401 ACCOUNT_INVALID_CREDENTIALS` → 錯誤橫幅顯示同一句「帳號或密碼錯誤，請再試一次」（`Invalid email or password`），兩欄都不清空；三種情況的畫面完全相同（01-01 Q1、Q2）                                                                                                                                                      |
| error：送出後平台沒有回應（連不上、逾時）                | 錯誤橫幅顯示「沒有回應」那一句可以重試的說明，兩欄內容保留，「登入」鈕恢復可按（01-01 §用 Email 與密碼登入 第 16 條、Q1）。不自動重試（骨架的 `apiFetch` 與 QueryClient 都不重試）                                                                                                                                             |
| error：其他 `5xx`、回應格式不對、`422 VALIDATION_FAILED` | 與「沒有回應」同一種呈現（`422` 在正常流程不會出現：送出前已檢查必填，body 由前端組）；不顯示 `traceId` 以外的內部識別碼                                                                                                                                                                                                       |
| 被擋住 30 分鐘                                           | 不在本次（sa-3 交給 #726）；本次不會收到 `ACCOUNT_LOGIN_THROTTLED`                                                                                                                                                                                                                                                             |
| empty                                                    | 不適用                                                                                                                                                                                                                                                                                                                         |
| 無權限（403）                                            | 不適用：`createSession` 對未登入的人不回權限不足的 `403`；`CSRF_FAILED`（403）依 `api-contract` 這個端點放行、不會出現，萬一出現與「沒有回應」同一種呈現，不給「無權限」說明                                                                                                                                                   |
| 欄位被遮蔽                                               | 無；密碼欄預設遮住內容是輸入框的顯示方式，不是後端遮蔽                                                                                                                                                                                                                                                                         |

### Google 登入

| 狀態                                              | 呈現                                                                                                                                                                                                                                                                                                                                                               |
| :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 取得授權網址中                                    | 點下去立即停用按鈕（真的擋住鍵盤），整頁其餘部分同「送出中」一樣凍結；取得後整頁導覽。快速連點只發一次、只導覽一次，不出現錯誤畫面（01-01 §邊界情況）                                                                                                                                                                                                              |
| 取得授權網址失敗：連不上、逾時、`5xx`、`409`      | 解除凍結、按鈕恢復可按，錯誤橫幅顯示「沒有回應」那一句                                                                                                                                                                                                                                                                                                             |
| 回調處理中                                        | `/account/google/callback` 只有頁面底色，沒有任何文字或帳號資訊；不用 skeleton（之後會導走）                                                                                                                                                                                                                                                                       |
| E1 取消或不通過                                   | 回調網址帶 `error` 時不呼叫後端；或 `createGoogleSession` 回 `400 ACCOUNT_GOOGLE_FLOW_INVALID` → 回到登入頁，不顯示任何錯誤，可以改用 Email 與密碼登入                                                                                                                                                                                                             |
| E2 沒有對應帳號、Email 未驗證、帳號停用或已匿名化 | `createGoogleSession` 回 `401 ACCOUNT_GOOGLE_REJECTED`（N2：停用與已匿名化也是同一個碼）→ 回到登入頁，錯誤橫幅顯示「無法用這個 Google 帳號登入。需要帳號的話，請聯絡系統管理員邀請你。」；不因這個部署有沒有設定寄信服務而換句子；與帳密錯誤的橫幅同一套收起時機（U2）。文字由前端依 `code` 取 `auth` 語言檔的這一句，不顯示後端的 `message`（見本節開頭的文案表） |
| 完成登入失敗：連不上、逾時、`5xx`、`409`、`422`   | 回到登入頁，錯誤橫幅顯示「沒有回應」那一句；不當成 E1 安靜帶過。`409 ACCOUNT_GOOGLE_UNAVAILABLE` 與 `422` 在正常流程不會出現，歸這一類（`api-contract` §createGoogleSession）                                                                                                                                                                                      |
| 部署沒有設定 Google                               | 按鈕與「或」分隔線不渲染（sa-8），不會開始流程                                                                                                                                                                                                                                                                                                                     |
| empty／無權限（403）／遮蔽                        | 不適用；兩個 Google 端點對未登入的人都不回 `403`，回應也沒有被遮蔽的欄位。回調網址上的 `code`、`state` 不顯示在畫面上                                                                                                                                                                                                                                              |

### 刻意不揭露（取代「欄位被遮蔽」）

本次沒有被後端遮蔽的欄位，但有幾處**刻意不說原因**，畫面上一律用固定的一句，不得用空白或「無資料」代替：

- 帳號不存在、密碼錯誤、帳號停用 → 同一句（01-01 Q1、Q2）
- Google 沒有對應帳號、Email 未驗證、帳號停用或已匿名化 → 同一句（01-05 Q18、N2）
- 登入狀態不能通行 → 回登入頁、不說明原因（01-05 §不能通行的登入狀態不說明原因）；被動登出的兩句（01-05 Q4）只分「時間到了」與「憑證不再有效」，不帶帳號資訊
- 登出不論伺服器端有沒有讓登入狀態失效，畫面都一樣（01-05 §從這一台登出 第 4 條）

錯誤橫幅、欄位錯誤與守門判定中的畫面，都不得出現使用者輸入的 Email、帳號識別碼或任何其他裝置的資訊。暫時落點顯示的 Email 是登入者自己的、由 `getCurrentSession` 回傳，不是使用者在登入頁輸入的值。

### 測試集答案不外露（Hard Rule 6）

本次的畫面（登入頁、Google 回調、守門、暫時落點）都沒有任何任務、資料或標準答案；暫時落點只顯示登入者自己的名字、Email 與系統角色。守門是日後答案隔離檢查所在的共用位置（`security-agent-rules` S3、S5），但檢查本身在後端，本次畫面端沒有要做的事。

## 元件與 design token

圖示統一 Lucide（`lucide-react`）：`Tag`（品牌標誌）、`Globe`（語言切換）、`CircleAlert`（錯誤橫幅）、`Mail`、`Lock`（欄位前置）、`Eye`／`EyeOff`（密碼顯示切換；預設遮住時顯示 `EyeOff`，同 prototype）、`LoaderCircle`（送出中、登出中）。唯一的例外是 Google 的 G 標誌（品牌標記，architecture §前端），沿用 prototype 的 `design/prototype/assets/google-g.svg`。裝飾性圖示一律對螢幕閱讀器隱藏。

| 用途                                                                                              | 語意 token                                                                                                                                                                                                                                                                                                                                                                         |
| :------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 頁面底色、守門判定中與回調處理中的畫面                                                            | `--color-surface`                                                                                                                                                                                                                                                                                                                                                                  |
| 頁首與卡片底色（登入卡、暫時落點的卡片）                                                          | `--color-white`（深色主題由 `tokens.css` 重新對映）                                                                                                                                                                                                                                                                                                                                |
| 頁首下框線、分隔線、OAuth 鈕與語言鈕外框                                                          | `--color-border`                                                                                                                                                                                                                                                                                                                                                                   |
| Email 與密碼輸入框外框、「登出」鈕外框                                                            | `--color-border-control`（`brand.md` 鐵律 13；「登出」鈕照 artifact）                                                                                                                                                                                                                                                                                                              |
| 主要文字、欄位標籤、卡片標題、字標、「你已登入」、「登出」鈕文字                                  | `--color-ink`                                                                                                                                                                                                                                                                                                                                                                      |
| 副標、「或」、欄位前置圖示、密碼切換圖示、placeholder、「還沒有帳號？」、暫時落點的身分列與說明句 | `--color-ink-muted`                                                                                                                                                                                                                                                                                                                                                                |
| 「忘記密碼？」「前往註冊」連結文字                                                                | `--color-primary-strong`（`brand.md` 鐵律 2：主色當文字不用 `--color-primary`）                                                                                                                                                                                                                                                                                                    |
| 系統角色藥丸                                                                                      | 底 `--color-primary-soft-bg`、文字 `--color-primary-strong`、圓角 `--radius-full`（Badge `.badge-role` 的 token；artifact 同色）                                                                                                                                                                                                                                                   |
| 品牌標誌的底色                                                                                    | `--color-primary`；標誌線條 `--color-on-cta`                                                                                                                                                                                                                                                                                                                                       |
| 「登入」鈕                                                                                        | 底 `--color-cta`、hover `--color-cta-hover`、文字與 Spinner `--color-on-cta`                                                                                                                                                                                                                                                                                                       |
| OAuth 鈕與語言鈕的 hover                                                                          | 外框 `--color-primary`、底 `--color-primary-soft-bg`                                                                                                                                                                                                                                                                                                                               |
| 焦點外框                                                                                          | `--color-primary`；「登入」鈕用 `--color-cta`（同 prototype `login.html:305`）                                                                                                                                                                                                                                                                                                     |
| 錯誤橫幅                                                                                          | 底 `--color-error-bg`、框 `--color-error-border`、文字與圖示 `--color-error`                                                                                                                                                                                                                                                                                                       |
| 欄位錯誤文字與錯誤外框                                                                            | `--color-error`                                                                                                                                                                                                                                                                                                                                                                    |
| 圓角                                                                                              | 卡片 `--radius-lg`；輸入框、按鈕、錯誤橫幅、語言鈕 `--radius-md`；密碼切換鈕 `--radius-sm`；角色藥丸 `--radius-full`                                                                                                                                                                                                                                                               |
| 卡片陰影                                                                                          | `--shadow-card`                                                                                                                                                                                                                                                                                                                                                                    |
| 頁首層級（捲動時固定）                                                                            | `--z-sticky`                                                                                                                                                                                                                                                                                                                                                                       |
| 字體                                                                                              | 字標與登入卡標題 `--font-serif-display`；其餘 `--font-sans`                                                                                                                                                                                                                                                                                                                        |
| 字級（U5，就近套用）                                                                              | 登入卡標題（prototype 22px）→ `--text-h2`；「你已登入」（artifact 20px）→ `--text-h3`；副標與「登入」鈕（15px）、正文、欄位、按鈕 → `--text-caption` 或 `--text-body` 中最近的一個（15px 取 `--text-body`）；連結、「或」、語言鈕（13px）→ `--text-caption`；欄位錯誤（12px）與角色藥丸 → `--text-label`                                                                           |
| 間距（U5，就近套用）                                                                              | 只用 `--space-xs`／`sm`／`md`／`lg`／`xl`／`2xl`：主區上下 `--space-2xl`（手機 `--space-lg`）、左右 `--space-md`；頁首左右 `--space-xl`（手機 `--space-md`）；卡片內距（prototype 40／36px）→ `--space-xl`，手機（28／20px）→ `--space-lg`；表單欄位間距 `--space-md`；「或」上下（20px）→ `--space-lg`；標題區下方（28px）→ `--space-lg`；元件內的小間距（6、10px）→ `--space-sm` |
| 過場                                                                                              | `--dur-fast`、`--ease-standard`；使用者要求減少動態效果時停掉 Spinner 的旋轉與過場（`brand.md` 鐵律 11、F9），停用狀態與「載入中」名稱照常                                                                                                                                                                                                                                         |

- 與 prototype 的尺寸差（字級與間距差幾 px）已由 PR #742 登記進 `design-gaps.md`（U5）；本份不新增 token、不用字面任意值（F6）
- 頁首高度 64px（手機 56px）、品牌標誌 32px 與 56px（手機 28px 與 52px）、卡片最大寬 480px 屬元件尺寸，不是間距刻度，照 prototype 與 `brand.md` §設計決策（帳號頁單卡 480px），以 Tailwind 既有刻度表達
- 這些 token 都經 `src/styles/` 的對照層進到元件（F6）；元件只用語意 class，不寫色碼、不依主題寫條件

## 響應式

斷點依 `brand.md` §設計決策：手機 `max-width: 767px`、桌面 `min-width: 768px`；平板落在桌面那一側。登入頁與暫時落點用同一套。

| 寬度       | 行為（以 prototype `login.html:334`–`:341` 為準）                                                                                  |
| :--------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| 桌面與平板 | 頁首 64px 高；卡片在主區垂直與水平置中，最大寬 480px                                                                               |
| 手機       | 頁首變矮、左右內距縮小，品牌標誌與字標縮小；主區改為從上方開始排（不垂直置中），卡片內距縮小                                       |
| 任何寬度   | 不需要左右捲動、沒有文字重疊、每個控制項都點得到（01-01 §不同螢幕寬度的呈現）；暫時落點的身分列在 Email 很長時可以換行，不撐破卡片 |

## 無障礙

- 地標：頁首是 `<header>`（banner），主區是 `<main>`；登入卡是名稱「登入」／`Sign in` 的 region；暫時落點的卡片以標題「你已登入」為名稱
- 欄位：每一欄有可見的 `<label>` 關聯；欄位錯誤以 `aria-describedby` 關聯到欄位，錯誤出現時欄位標成無效
- 錯誤橫幅：`role="alert"`，出現時被朗讀（同 prototype `login.html:397`）；從其他頁帶回登入頁時顯示的那一句也會被朗讀
- 語言切換鈕的無障礙名稱**包含可見的代號**：「ZH，切換語言」／「EN, Switch language」，語音操作的人說「ZH」也點得到（WCAG 2.5.3；U8）
- 只有圖示的按鈕都有名稱：密碼切換鈕的名稱隨狀態改變（「顯示密碼」／「隱藏密碼」），切換語言時依目前狀態重算（01-01 §用 Email 與密碼登入 第 19、20 條）；Google 鈕的名稱「使用 Google 帳號繼續登入」含可見文字；品牌連結名稱「Label Suite 首頁」
- 所有無障礙名稱與可見文字一樣有兩種語言（`brand.md` §錯誤與驗證訊息 最後一條）
- 語言切換時一併更新 `<html lang>`（`zh-TW`／`en`）與瀏覽器頁籤的標題（`Label Suite — 登入`／`Label Suite — Sign In`；暫時落點 `Label Suite — 你已登入`／`Label Suite — Signed In`，`design.md` D12），`tokens.css` 的中英行高依 `html[lang]` 切換
- 焦點：所有可互動元素都有看得見的焦點外框（G-05 已登記 prototype 多處缺焦點樣式，實作照 F9 補上）；Tab 順序依畫面順序：品牌連結 → 語言切換 → Google 鈕（有時）→ 電子郵件 → 忘記密碼？ → 密碼 → 密碼切換 → 登入 → 前往註冊（有時）。暫時落點：品牌連結 → 語言切換 → 登出
- 狀態不只靠顏色：欄位錯誤有文字、錯誤橫幅有圖示加文字、送出中有 Spinner 加名稱、系統角色是文字藥丸
- 送出中整頁凍結時，被凍結的控制項對鍵盤也無效，不能只是看起來停用

## 維護者決定的對照

2026-11-26 clarification 停點的決定（[決定表](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)），與本份落在哪裡：

| #       | 決定                                                                                           | 落在本份                                                           |
| :------ | :--------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| sa-1    | 不做「記住我」                                                                                 | §元件樹 › 登入頁：沒有這個控制項                                   |
| sa-2    | 期限、延續、被動登出兩句、登出端點都在本張                                                     | §進入、離開與返回 X7、§畫面狀態 › 守門：延續失敗的碼決定顯示哪一句 |
| sa-3    | 登入失敗鎖定不在本張（#726）                                                                   | §畫面狀態 › 登入表單：不會收到 `ACCOUNT_LOGIN_THROTTLED`           |
| sa-5、7 | 最小佔位頁加登出鈕；artifact 已核准                                                            | §元件樹 › 暫時落點、§畫面狀態 › 暫時落點                           |
| sa-6    | 「忘記密碼？」「前往註冊」照 prototype 顯示，去處由後續張補；本張建寄信服務的共用判斷          | 「前往註冊」依 `selfRegistrationEnabled`；未註冊的去處走 U7        |
| sa-8    | 沒設定 Google 時不顯示 Google 鈕與「或」分隔線                                                 | §元件樹 › 登入頁、§畫面狀態 › 部署能力                             |
| sa-9    | 照 ADR-004 D5 綁定，不另外告知                                                                 | §進入、離開與返回 D3 是                                            |
| sa-10   | 登入後一律去落點                                                                               | §進入、離開與返回 D1 否                                            |
| sa-11   | 守門只做授權第 1、2 步                                                                         | §元件樹 › 守門                                                     |
| N2      | 停用或已匿名化的帳號用 Google 登入，與「沒有對應帳號」同一句                                   | §畫面狀態 › Google 登入 E2                                         |
| U1      | 送出中整頁凍結，以規格為準                                                                     | §畫面狀態 › 登入表單、Google 登入                                  |
| U2      | 任一欄輸入就收起錯誤橫幅                                                                       | §畫面狀態 › 登入表單                                               |
| U3      | 沿用既有文案；缺的已由 PR #742 補進規格 01-01 Q13、01-05 Q4 的英文；落點英文見 `design.md` D12 | §畫面狀態 開頭的文案表、§元件樹 › 暫時落點                         |
| U5      | 就近套用既有 token                                                                             | §元件與 design token 的字級與間距兩列                              |
| U6      | 守門連不上當成未登入，帶回登入頁並顯示「沒有回應」那一句                                       | §進入、離開與返回 D1 判定失敗、§畫面狀態 › 守門                    |
| U7      | 不存在的路徑交給 `/`，07-03 完成時改成找不到頁                                                 | §頁面與路由、§元件樹 › 守門                                        |
| U8      | 語言鈕無障礙名稱含「ZH」                                                                       | §無障礙                                                            |

U1、U2、U5、U8 與 prototype 的差異已由 PR #742 記進 `design-gaps.md`，本份不改 `design/prototype/`。

### 仍待 `planner` 處理（明確問題，不需維護者決定）

| #   | 問題                                                                                                                                                                     | 處理                                                                                                |
| :-- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| U4  | 規格 01-01 要登入頁有語言切換、第一次來預設繁體中文、記住選擇並跨頁沿用；現行 capability `frontend-i18n` 寫「依瀏覽器語言決定、畫面不得有語言切換」，`main.tsx` 也這樣做 | 規格為準（需求依據順序）；specs MODIFIED `frontend-i18n` 那條 Requirement，兩個開發頁的語言也跟著改 |
| U9  | 暫時落點需要 `getCurrentSession` 回應裡有 `user.email`                                                                                                                   | 已解決：`api-contract.md` 的回應已含 `email`                                                        |
