# Label Suite — 品牌書

> 本檔由 prototype 與規格**反推**而成，只寫有證據的規則；沒有證據的一律進 [§未決](#未決)，由維護者決定，不在這裡定案。
> 依據：`design/prototype/`、`docs/specs/`、`docs/prototype/`、`.claude/skills/label-suite-design/SKILL.md`。**本檔只寫 token 名，不抄色值**。

## 這份檔管什麼、不管什麼

| 想知道 | 看哪裡 |
| :--- | :--- |
| 品牌層的規則：鐵律、語氣、視覺語彙、圖示、logo 與 CIS | **本檔** |
| token 的實際值（色、字、距、圓角、陰影） | `design/prototype/assets/tokens.css`，或 [`label-suite-design`](../../.claude/skills/label-suite-design/SKILL.md) skill |
| 元件長什麼樣、有哪些狀態 | [`components/`](components/)，索引見 [`MASTER.md`](MASTER.md) |
| 跨元件的互動約定（UXC-NN） | [`ux-conventions.md`](ux-conventions.md) |
| 原型與規格對不上之處 | [`design-gaps.md`](design-gaps.md)，下文以 G-NN 引用 |
| 業務規則 | `docs/specs/`，本檔不重述 |

寫法約定：每條規則後面附依據的檔案與行號；行號是撰寫當時（`main` 的 `eb9a884`）的位置，檔案改過後以檔案內容為準。

## 產品是什麼

Label Suite 是碩士論文 Demo Paper 的核心成果：用設定驅動的標記流程，讓研究團隊在同一個平台走完建立任務、試標、確認一致性、正式標記、審核、匯出，並在標記過程中就看到資料統計（`docs/specs/00-prd.mdx` §專案概述）。使用者是研究團隊成員，不是一般消費者；其中標記員與審核員的「好上手」以 SUS 75 分衡量（`00-prd.mdx:60`）。

banner 與 social preview 上的產品副標是「NLP Annotation Portal」（`design/prototype/assets/logo/banner.svg`、`social-preview.svg`）。

---

## 鐵律

以下每一條都有明確的文字依據，不是撰寫者從畫面「覺得」出來的。

1. **只用 token，不自創顏色。**`tokens.css` 的檔頭寫「Import this file instead of redefining tokens in each page」（`assets/tokens.css:4`）；skill 寫「不要自創 token 以外的顏色」（`label-suite-design/SKILL.md` §怎麼用）。#420 之前現況與這條不符：prototype 有大量寫死色值（`design-gaps.md` G-02）。#420 起頁面與 showcase 的色值都改用 token；剩下的寫死色值是資料色（`assets/data-palette.css`、樣本資料）、註解、`var()` 的後備值與一處固定白字（頭像遮罩上的上傳圖示，疊在固定的黑色遮罩上）；側欄通知徽章的白字在 #437 改用 `--color-on-badge-notify`，細節見 G-02。
2. **主色當文字一律用 `--color-primary-strong`，不用 `--color-primary`；圖示用 `--color-primary`，`--color-secondary` 只做裝飾與大面積填色。**`--color-primary` 當文字在白底只有 4.47:1、在 `--color-primary-soft-bg` 上 3.99:1，`--color-primary-strong` 是白底 6.29、頁底 5.73、主色淺底 5.62:1（`tokens.css:19` 註解；維護者裁定 2026-11-18，#427）。`--color-primary` 留給按鈕填色、邊框、logo 與圖示（圖示只需 3:1）。次要文字最淺到 `--color-ink-muted`（淺色 `#5E6B7F`：頁底 4.93、白底 5.40、`--color-border-muted` 4.93:1），`slate-400` 以下的顏色不可用於文字（skill §無障礙）。
3. **語意色各有專屬用途。**`--color-warning` 與 `--color-error` 保留給例外、待確認與錯誤，不當區分色；用顏色區分模組或角色時最多五種，超過就靠標籤文字（skill §區分多個模組或角色）。
4. **狀態不能只靠顏色。**Review Status Track 以文字前綴「目前：」、字重與線寬輔助（`components-showcase.html:1221` 的說明、[`components/review-status-track.md`](components/review-status-track.md)）。Color Dot 目前只靠顏色，已登記為缺口（G-14）。
5. **錯誤 toast 不自動消失，只能手動關。**整頁只有一則 toast；success 3000ms、info 5000ms、warning 8000ms、error 0（UXC-07，`components-showcase.html:1507`）。
6. **Toast 與 banner 分工。**頁面層級的錯誤用 inline banner（`role="alert"`）；動作結果的回饋用 toast（`components-showcase.html:1112`）。
7. **送出中要有載入態且不能重複送出。**UXC-06（`.btn-loading`，`components-showcase.html:213`–`:214`）。已知缺口：只擋滑鼠、沒擋鍵盤（G-06）。
8. **Skeleton 的尺寸要貼合載入後的內容**，以防 layout shift（UXC-08，`components-showcase.html:1134`）。所以 Skeleton 的尺寸不 token 化。
9. **同一組一次性連結失效用同一句話。**`ONE_TIME_LINK_WORDING` 是單一來源（`pages/shared/sidebar.js:227`），重設密碼與驗證信兩頁都引用它（`reset-password.html:611`、`verify-email.html:390`）。
10. **每個畫面同時支援繁中與英文、淺色與深色。**語言與外觀是共用介面的一部分（PRD 的「外觀切換（淺色／深色）」，`00-prd.mdx:138`、`docs/specs/07-shared/01-sidebar.mdx`）；元件要用語意 token，深色主題靠 `html[data-theme="dark"]` 重新對映同名 token，頁面不寫兩份（`tokens.css` 深色區塊的檔頭說明）。
11. **互動元件要有 `prefers-reduced-motion` 的退路。**共用 CSS 與 showcase 都有 `@media (prefers-reduced-motion: reduce)`（`pages/shared/sidebar.css:185`、`components-showcase.html:979`）；`account/profile` 是唯一漏掉的帳號頁（G-30）。
12. **圖示一律用 SVG，不用 emoji，也不用文字字元（`✕`、`←`、`→`、`✓` 等）充當圖示。**維護者裁定（2026-11-18）；repo 內早有同向的依據：ADR-030「Lucide 是唯一圖示來源」，`task-config.engine.js:870`、`:977` 的註解寫「no text-glyph icons」「no hand-drawn glyphs」。細節見 [§圖示](#圖示)。
13. **控制項外框用 `--color-border-control`，`--color-border` 只做裝飾。**輸入框、下拉選單、文字區塊、搜尋框、勾選框，以及長得像欄位的觸發鈕（日期區間、分類選擇）的外框用前者（淺色 `#7C899D` 對白底 3.55、對頁底 3.23:1；深色 `#6B6B78` 對卡片 3.42、對頁底 3.73:1），才過 WCAG 1.4.11 的 3:1；卡片、表格、分隔線用 `--color-border`（對白底只有 1.23:1）。焦點與錯誤狀態維持各自的 token。維護者裁定（2026-11-18，#427）；`tokens.css:26`、`:203`。
14. **`--color-primary-border` 不能是唯一的提示。**它對白底只有 1.49:1；只靠邊框標示的狀態改用 `--color-primary`，例如日期選擇器的「今天」（`date-range-picker.css:34`）。維護者裁定（2026-11-18，#427）。

## 設計決策

維護者已經裁定、可以直接引用的決定：

| 決定 | 內容 | 來源 |
| :--- | :--- | :--- |
| 危險按鈕 | 以 `modal.css` 的**實心**版為正典，showcase 的外框版記為與出貨不符 | `design-gaps.md` G-01（2026-11-17） |
| 帳號頁元件 | 帳號頁自己的 `.login-btn`／`.sso-btn` 等視為正典元件的同一個，規格用正典名 | G-03（2026-11-17） |
| UXC 編號 | 沿用 prototype 已在用的 03–11，01／02 留空 | `ux-conventions.md`（2026-11-17） |
| 外觀選項 | 三選一「跟隨系統／淺色／深色」，預設「跟隨系統」；`system` 真的讀作業系統 | `assets/theme.js:5`、`:17` 的註解（#195，2026-11-09） |
| 語言 | 兩種：`zh`、`en`；沒有儲存值時預設 `zh`；選擇存在 `labelsuite.lang` | `pages/shared/sidebar.js:3`、`:410`–`:415` |
| 說明按鈕 | 這期不做，下一期依 SUS 結果再決定 | `00-prd.mdx:149` |
| 引用 `MASTER.md` 版號 | `tokens.css` 與 prototype 註解引用的 `MASTER.md` 版號、行號指向原件，本 repo 解析不到 | `MASTER.md` §這份檔是重建的、G-25 |
| 中文稱謂 | 全部中文介面文案用「你」，不用「您」 | 維護者裁定 2026-11-18 |
| 送出用語 | 統一「送出」＋受詞（送出標記、送出審核、送出仲裁），不用「提交」 | 維護者裁定 2026-11-18 |
| 圖示 | 一律 SVG，不用 emoji、不用文字字元；圖示來源是 Lucide（ISC 授權），線寬統一為 2 | 維護者裁定 2026-11-18 |
| 日期、時間、數字格式 | 日期 `YYYY-MM-DD`、時間 24 小時制 `HH:mm`（例：2026-11-18 14:30）、千分位用逗號、百分比小數一位 | 維護者裁定 2026-11-18 |
| Email 用語 | 中文介面一律「電子郵件」，英文介面一律「Email」；後續要補進 glossary | 維護者裁定 2026-11-18 |
| 招牌做法 | 維持 §招牌做法 的 5 項，不再增補 | 維護者裁定 2026-11-18 |
| logo 規範 | 圓角比、最小尺寸、安全留白、圖文間距，以 `icon-colored.svg` 量得的值為準（見 §CIS） | 維護者裁定 2026-11-18 |
| favicon | 來源是 `assets/logo/icon-colored.svg` | 維護者裁定 2026-11-18 |
| 深淺主題的 logo | 量測後結論：白色標籤線稿疊在深色主題 `--color-primary` 上不到 3:1，深色主題需要另備一版（見 §CIS） | 維護者裁定 2026-11-18 要求依量測結果決定 |
| banner 與 social preview | banner.svg 是 README 橫幅，social-preview.svg 是 GitHub social preview；兩個 SVG 保留寫死色值，對應 token 見 §CIS | 維護者裁定 2026-11-18 |
| 響應式斷點與寬度 | 手機 `max-width: 767px`／桌面 `min-width: 768px`；小螢幕 420px；內容最大寬度 1280px；帳號頁單卡 480px；Modal 400／520／720，860 與 1280 為個案例外；480／640／1100 屬頁面自己的斷點 | 維護者裁定 2026-11-18 |
| 品牌色與襯線的取捨 | 已定案；原件 `MASTER.md` 只記結果，沒有記理由（見下節） | 維護者裁定 2026-11-18 |
| 本檔的地位 | 本檔是規則，prototype 是現況；兩者不符時，列在 [§與 prototype 的落差](#與-prototype-的落差)，改 prototype 走 Ready gate | 維護者裁定 2026-11-18 |

### 原件記載的品牌決策

原件 `singyichen/label-suite` 的 `design/system/MASTER.md`（讀取時的 `main` 為 `faf8335`）有以下**直接寫出**的品牌層記載；以下只轉錄，不推論：

- **品牌基線已定稿**：「Maintainer decision 2026-10-07 (issue #935): the current brand is final, not a placeholder」，React 的 Tailwind 轉寫「carries these values over unchanged」（`MASTER.md:37`）。
- **基線內容**：主色 indigo、介面字體 Inter、logo 是「Lucide `tag` glyph in white on a … rounded square, wordmark in Crimson Pro」，圓角與字級刻度維持原狀（`MASTER.md:39`–`:44`）；「No custom logo design or full corporate identity system」（`:46`）。
- **色彩**：「Indigo primary + emerald CTA」（`:58`）；原件**沒有**寫為什麼選這兩色。emerald CTA 只有一次調整紀錄，原因是對比（淺色 `--color-cta` 因 WCAG AA 加深，`:3023` 的 v1.38）。
- **字體**：標題 Crimson Pro、內文 Inter、閱讀 Atkinson Hyperlegible、等寬 JetBrains Mono；「Mood: academic, research, scholarly, accessible, readable, educational」（`:401`–`:406`）。Crimson Pro 沒有中日韓字形，所以標題字體的備援一定要接「Noto Serif TC」（`:456`）。這是原件對襯線字體**唯一**寫出的取向，沒有逐項說明「為什麼是襯線」。
- **風格**：Flat Design，關鍵字含「tool-oriented」，適用「annotation tools」；無漸層、無裝飾陰影；hover 只允許 `translateY` 最多 `-2px` 的唯一例外（`:2879`–`:2897`）。
- **圖示**：「Minimal, purposeful icons (Lucide — the project's single icon library)」（`:2893`）。

**沒找到**：為什麼選 indigo 為主色、為什麼 emerald 當 CTA、為什麼大標用襯線——原件只有結果與氛圍關鍵字，沒有取捨紀錄。維護者已將這些決定視為定案（2026-11-18），**已定案、原件未記理由**；本檔不替它補寫理由。

---

## 內容與語氣

### 語言

- **雙語並行，繁體中文（`zh-TW`）與英文對等。**每個帳號頁都有 `i18n = { zh: {...}, en: {...} }` 兩份完整文案，鍵名一一對應（例：`pages/account/login.html:508`–`:555`）。新增任何字串兩份一起加。
- **切換鈕顯示的是目前語言的代碼 `ZH`／`EN`**，aria-label 是「切換語言」／「Switch language」（`login.html:515`、`:534`、`:538`、`:557`；`sidebar.js:430`）。
- **頁面標題格式**：`Label Suite — <頁名>`；英文版同格式（`login.html:514`、`:537`）。dashboard 另帶「（原型）」，那是 prototype 標記，不是品牌規則（`dashboard.i18n.js:7`）。
- **品牌名不翻譯**：「Label Suite」在兩種語言都照寫，aria-label 才分「Label Suite 首頁」／「Label Suite home」（`login.html:533`、`:556`）。
- 字體對應：中文行高 1.8、英文 1.6（`tokens.css` §Semantic type rules，`html[lang="zh-TW"]`）。

### 稱謂

**規則：全部中文介面文案用「你」，不用「您」。**維護者裁定（2026-11-18）。

- 動作與後果說明本來就用「你」（例：`profile.html:1227`「除非你回到『密碼設定』重新設一組」），區塊副標與成功通知也一律改「你」（例：`profile.html:1179`「修改你的姓名與聯絡方式」、`:1221`「你現在可使用電子郵件與密碼登入」、`register.html:562`「填寫以下資訊以建立你的帳號」）。
- prototype 原本有 13 行用「您」，已在 #418 改成「你」，列在 [§與 prototype 的落差](#與-prototype-的落差)。規格書 `docs/specs/01-account/04-profile.mdx:133` 的副標題也已在 #461 改成「你」。

### 按鈕用語

- **「送出」＋受詞，不用「提交」。**維護者裁定（2026-11-18）：標記員「送出標記」、審核員「送出審核」（`annotation-workspace.config.js:62` 已是這個寫法）、仲裁「送出仲裁」（`:86`）；狀態詞「已提交」改「已送出」，「提交時間」改「送出時間」。現況與這條不符的行數列在 [§與 prototype 的落差](#與-prototype-的落差)。
- **帳號流程用「動詞＋受詞」說出結果，不寫「確定」這種空動詞。**登入、建立帳號、寄送重設連結、更新密碼、重新寄送驗證信、前往登入（`register.html:572`、`forgot-password.html:441`、`reset-password.html:605`、`profile.html:1213`）。英文對應：Sign In、Create Account、Send Reset Link、Update Password（Title Case，無句點）。
- **表單通用鈕是「儲存」與「取消」**（`user-management.html:678`–`:687`、`task-new.html:640`–`:641`）。標記員另有「儲存草稿」（`annotation-workspace.config.js:22`）。
- **送出鈕旁說明後果。**審核送出旁會寫「送出後進入爭議池，待仲裁定案」或「送出後即定稿，成為最終答案」（`annotation-workspace.config.js:73`–`:74`，顯示在 `#wsReviewSubmitConsequence`，`annotation-workspace.html:1276`）。
- **載入中的按鈕文字**：進行式加刪節號，「建立中…」（`components-showcase.html:1045`）；登入頁的送出鈕改以 spinner 取代文字並帶 `aria-label="載入中"`（UXC-06）。
- **破壞性動作要先確認，確認句型**：「確定要停用 …」（`user-management.html:803`）、未儲存離開：「你有尚未儲存的變更，離開將會遺失所有已填寫的內容。」（`task-new.html:647`）。UXC-10、UXC-03 在 b2／b3 才寫完。
- **返回類連結**：「返回登入」「返回個人設定」「前往登入」（`register.html:527`、`profile.html:1212`、`reset-password.html:557`）；**不帶箭頭字元**（見鐵律 12）；現況的 `← 返回登入` 列在落差表。

### 錯誤與驗證訊息

- **欄位驗證：「請」開頭，說出要做什麼。**「請輸入電子郵件」「請輸入密碼」「請輸入有效的電子郵件格式」（`login.html:527`–`:528`、`register.html:578`）；英文對應「Email is required」「Password is required」。
- **規則寫在訊息裡，不只說錯。**「密碼至少需 8 個字元，含大寫英文、小寫英文與數字」（`register.html:580`）；密碼規則另有常駐的 hint（`:569`）。
- **登入失敗不指出是帳號還是密碼**：「帳號或密碼錯誤，請再試一次」（`login.html:526`）；英文 `Invalid email or password`（`:549`）。
- **說出原因與下一步。**「瀏覽器的儲存空間放不下這張圖，請換一張小一點的；其他欄位已經存好了」（`profile.html:1217`）——先說發生什麼，再說怎麼辦，並交代沒壞的部分。
- **一次性連結失效**：「連結無法使用，請重新申請」；英文 `This link can no longer be used. Please request a new one.`（`sidebar.js:228`–`:229`）。
- **標記員被擋下時說明條件**：句型是「請完成所有標記項目後再送出」（`annotation-workspace.config.js:59`）；審核員失去資格時說明還能做什麼：「…可檢視自己審核過的內容與歷程，但無法再送出審核決策。」（`:114`）。
- **無障礙名稱（aria-label）和可見文字一樣要兩種語言**（`ssoAriaLabel`、`navAriaLabel` 等，`login.html:529`–`:534`、`:552`–`:557`）。

### 標點與格式

- 中文句末多數不加句號（欄位標籤、toast 標題、按鈕），完整句子才加（例：`task-new.html:627` 的 `s3NoticeText`）；toast 副文字是子句，不加句號（`profile.html:1223`）。
- 「？」用全形（「忘記密碼？」「還沒有帳號？」，`login.html:519`、`:521`）。
- 破折號用全形雙線「——」（`profile.html:1230`）。
- **日期、時間、數字（維護者裁定 2026-11-18）：**

| 項目 | 格式 | 範例 |
| :--- | :--- | :--- |
| 日期 | `YYYY-MM-DD` | 2026-11-18 |
| 時間 | 24 小時制 `HH:mm` | 14:30 |
| 日期加時間 | 日期、空格、時間 | 2026-11-18 14:30 |
| 千分位 | 逗號 | 1,248 |
| 百分比 | 小數一位 | 87.5% |

  依據之外的觀察：prototype 內 `YYYY-MM-DD` 形式出現 358 次，沒有 `YYYY/MM/DD`、`YYYY年M月` 形式，也沒有 12 小時制（上午／下午、AM／PM），所以這條規則與現況一致。千分位與百分比小數位沒有逐項盤點，不聲稱現況一致。

### Email 與專有名詞

- **中文介面一律寫「電子郵件」，英文介面一律寫「Email」。**維護者裁定（2026-11-18）。現況在中文文案裡寫「Email」的行數列在落差表。
- **後續**：這個用語要補進 `docs/specs/` 的 glossary。`docs/specs/` 由維護者擁有，本檔不改；請維護者決定何時補。
- 其他術語以 glossary 為準（標記員、審核員、專案負責人、任務設定；`00-prd.mdx` 的 `:ref` 引用）。本檔不重列。

---

## 視覺基礎

token 名與值以 `tokens.css` 為準；本節只寫**怎麼用**。

### 色彩角色

| 角色 | token | 用在哪 | 依據 |
| :--- | :--- | :--- | :--- |
| 品牌主色 | `--color-primary`、`--color-secondary` | logo 底色、按鈕填色、邊框、選取、圖示；`--color-secondary` 只做裝飾與大面積填色（鐵律 2） | skill §色票；`navbar-logo`（`login.html:47`、`sidebar.css:52`） |
| 主色文字 | `--color-primary-strong`、`--color-on-cta` | 前者是主色當文字（含連結、放在主色淺底上），後者是主色填色上的文字（鐵律 2） | `tokens.css:19`、`:21` |
| 確認與完成 | `--color-cta`、`--color-cta-hover` | 確認、完成類主要鈕 | skill §色票 |
| 頁面與卡片 | `--color-surface`（頁底）、`--color-white`（卡片）、`--color-slate-50`（交錯列） | 版面底色層次 | skill §色票；`tokens.css` 語意別名 `--bg-page`／`--bg-surface` |
| 文字 | `--color-ink`（內文標題）、`--color-ink-muted`（次要）、`--color-on-ink` | | `tokens.css` §Semantic aliases |
| 分隔 | `--color-border`、`--color-border-muted` | 卡片、表格、分隔線，只做裝飾（鐵律 13） | skill §色票 |
| 控制項外框 | `--color-border-control` | 輸入框、下拉選單、文字區塊、搜尋框、勾選框，以及長得像欄位的觸發鈕（日期區間、分類選擇）（鐵律 13） | `tokens.css:26`、`:203` |
| 四個語意 | `--color-success`／`warning`／`error`／`info`，各配 `-bg`、`-border` | 狀態、banner、toast、badge | `tokens.css` §Semantic State Colors |
| 非語意強調 | `--color-file-markdown` | 只用來區分檔案類型圖示，不是狀態 | `tokens.css`（檔案類型圖示強調）註解 |
| 工作頁籤 | `--color-tab-active-bg`、`--color-tab-hover-bg` | 側欄上方頁籤；兩者在深色主題刻意不同值 | `tokens.css` §Workspace Tabs |
| 次要鈕 hover 外框 | `--color-border-hover` | `.btn-oauth`、`.btn-icon`、`.btn-language` hover 時的外框，只做裝飾（#420 Q6） | `tokens.css:28`、`:205` |
| 非狀態的強調 | `--color-accent`、`-bg`、`-border` | 分類 chip、`.badge-official` 這類要跟主色分開、又不是狀態的標記（#420 Q2） | `tokens.css:73`–`:75`、`:247`–`:249` |
| 任務欄 | `--color-task`、`--color-task-bg` | 任務欄的表頭文字、底線、勾選框（#420 Q5）。淺色值為 Teal 700，疊在 `--color-task-bg` 上 5.25:1（維護者 2026-11-18 從 3.59:1 的 Teal 600 改定） | `tokens.css:78`–`:79`、`:252`–`:253` |
| 通知徽章 | `--color-badge-notify`、`--color-on-badge-notify` | 側欄通知數字的底與上面的字，白字 6.47:1；兩個都深淺主題同值（#420 Q5；字色 token 是 #437 補的） | `tokens.css:84`–`:85`、`:255` |
| 開關圓鈕 | `--color-toggle-thumb` | Toggle Switch 關閉時的圓鈕（淺色白、深色 slate-200）；開啟時圓鈕在主色軌道上，改用 `--color-on-cta`（#437） | `tokens.css:90`、`:258` |
| 程式碼區 | `--color-code-bg`、`--color-code-fg` | 程式碼編輯區的底與字（#420） | `tokens.css:93`–`:94`、`:261`–`:262` |
| 資料色 | `--data-entity-*`、`--data-task-type-*` 等，在 `assets/data-palette.css` | 實體類型、任務類型、角色卡這類**指派給資料**的顏色，不是語意色；不放進 `tokens.css`，有淺色與深色兩套（#420 Q4） | `assets/data-palette.css`；`task-config.data.js` 的 `ENTITY_COLORS` 與 `--data-entity-*` 同值 |

`--color-text-muted` 是 `--color-ink-muted` 的舊別名，新元件不用（`tokens.css:29`、`:34`、skill）。

**淺色與深色是同一組 token 名、不同的值。**深色的 `--color-white` 其實是「抬高一階的卡片底」，不是白色（`tokens.css` 深色區塊 `--color-white` 註解）；所以**不要把 `--color-white` 當成字面上的白色用在文字**，需要固定白色字時用 `--color-on-cta`／`--color-on-ink`（G-12 正是這個問題）。

### 字體

| token | 用途 | 依據 |
| :--- | :--- | :--- |
| `--font-sans` | 介面預設字體 | `tokens.css` §Type Families；`body` 規則 |
| `--font-serif-display` | `h1`、`h2`、`.display`、**wordmark**「Label Suite」 | `tokens.css` §Semantic type rules；`sidebar.css:68`–`:75` |
| `--font-sans-reading` | 標註員閱讀的長文本 | skill §字體 |
| `--font-mono` | 代碼、ID | skill §字體 |

- 大標用襯線、其餘用無襯線，是 `tokens.css` 的規則；`h3` 起回到無襯線。
- 字級：display 48、h1 36、h2 24、h3 18、body 16、caption 14、label 12（`tokens.css` §Type Scale）。圖內文字用 12–14（skill）。
- **現況落差**：帳號頁的 wordmark 直接寫字面字體名 `'Crimson Pro', serif`（`login.html:62`），沒走 `--font-serif-display`；側欄的版本才用 token（`sidebar.css:69`）。
- 字體由 `tokens.css:7` 以 Google Fonts 的 `@import` 載入。

### 間距、圓角、陰影、動態、層級

- 間距刻度：4、8、16、24、32、48、64（`--space-xs` … `--space-3xl`）。
- 圓角：sm 4、md 8、lg 12、xl 16、full（`--radius-*`）。按鈕與輸入用 `--radius-md`（`shared/button.css`）。
- 陰影：卡片用 `--shadow-card`；**圖內元素不加陰影**（skill §字級、間距、圓角、陰影）。深色主題的陰影改成細環線為主（`tokens.css` 深色區塊 §Shadows）。
- 動態：`--ease-standard` ＋ `--dur-fast`（150ms）／`--dur-normal`（200ms）。
- 層級：`--z-base` … `--z-tooltip` 一組七階，toast 在 modal 之上、tooltip 最上（`tokens.css` §Z-index）。

### 對比與無障礙

- 對比修正是**有紀錄的**：`--color-cta` 與 `--color-ink-muted` 為過 WCAG AA 而換過值，註解保留舊值（`tokens.css:13`、`:34`）；`--color-ink-muted` 換過兩次，最近一次在 #427 由 `#64748B` 調為 `#5E6B7F`。此後新的文字／底色組合以 AA 為下限，非文字的控制項外框以 3:1 為下限（鐵律 13）。
- `--color-on-cta` 疊在淺色主題的 `--color-primary` 上是 4.47:1，**低於 AA，被列為已接受的取捨**（`tokens.css:21` 註解）。這是唯一有明文豁免的一處。
- 焦點樣式現況幾乎缺席（G-05），所以「所有互動元件都有可見焦點」是**目標而非現況**。

### 招牌做法

目前 prototype 與規格裡**有證據、而且是這個產品才有**的做法：

1. **標記作業區的進度與存檔語言。**進度寫成「{done} / {total} 已提交」，存檔狀態用「尚未儲存」「尚未儲存的變更」「上次儲存於 {time}」三種字串，離開有未儲存變更要擋（`annotation-workspace.config.js:32`、`:34`–`:36`；UXC-03）。
2. **實體標記以「每個實體類型一個顏色」直接畫在原文上。**原文中的標記是行內 highlight，顏色隨實體類型，以 inline style 帶入；旁邊配同色的類型小徽章（`annotation-workspace.html:630`–`:640` 的 `.rv-source-mark`、`.rv-source-badge`）。這些色是**資料色**，不是語意色（Color Dot 的 8 色盤同理，[`components/color-dot.md`](components/color-dot.md)、G-02）。
3. **審核單位的雙軌狀態**：待審 → 已定稿（答案未修改）與待審 → 爭議中 → 已定稿（答案有修改），畫成分岔軌道而不是線性步驟條；明確不可改用 Step Indicator（`components-showcase.html:1222`）。
4. **後果寫在按鈕旁**：送出前就讓審核員知道會進爭議池還是定稿（見 §按鈕用語）。
5. **角色與任務型別用 badge 辨識**：角色 badge 是 `--radius-full` 藥丸、任務型別是各自一組色（[`components/badge.md`](components/badge.md)）。

**維持這 5 項（維護者裁定 2026-11-18）。**只有一份證據、不能算「做法」的，不列入。

---

## 版面

證據偏少，只收有明文的：

- **登入後的每一頁共用側欄**：品牌區 `.brand-section`（logo＋wordmark＋語言切換）在最上、分隔線、導覽列（`sidebar.js:2043`–`:2057`、`sidebar.css:37`–`:44`）。側欄可收合，狀態存在 `labelsuite.sidebarCollapsed`（`sidebar.js:5`）。
- **工作頁籤**上限 8 個、重開堆疊上限 10（`sidebar.js` 的 `TAB_CAP`、`TAB_REOPEN_CAP`）。「工作頁籤」與頁內「Content Tabs」是兩個東西，命名見 [`MASTER.md`](MASTER.md) §命名約定。
- **帳號頁**是置中的單卡版面，頂部 navbar 只有 logo 與語言切換（`login.html` 的 `.navbar`、`:353`–`:375`）。
- **響應式規則（維護者裁定 2026-11-18）：**

| 項目 | 值 |
| :--- | :--- |
| 手機／桌面分界 | 手機 `max-width: 767px`，桌面 `min-width: 768px`（JS 的 `matchMedia` 也用 `min-width: 768px`） |
| 小螢幕 | `max-width: 420px` |
| 登入後內容最大寬度 | 1280px |
| 帳號頁單卡最大寬度 | 480px |
| Modal 與抽屜寬度 | 小 400、中 520、大 720；860（`pdf-modal`）與 1280（`modal-xl`）是個案例外 |
| 頁面自己的斷點 | 480（`task-new`）、640（`task-detail`）、1100（`task-new`）不列入共用規則 |

  依據是現況盤點（見下，「盤點」小節）：767 有 16 條、768 有 8 條；1280 在 10／10 個登入後頁面一致；480 在 5／5 個帳號頁一致。網格欄數沒有任何共用規則。

### 響應式盤點（依據）

這一節是維護者裁定時的盤點，在 #418 對齊斷點之前；行號仍是 `eb9a884` 的位置，數字與觀察都是當時的狀態，現行規則以上表為準。


**媒體查詢（`design/prototype/`，CSS 共 31 條寬度查詢、JS 2 處；另有 `prefers-reduced-motion` 14 條、`hover` 1 條不計）：**

| 斷點 | 條數 | 位置 |
| :--- | :--- | :--- |
| `max-width: 767px` | 16 | `dataset-analysis-detail.html:218`、`role-settings.html:253`、`:323`、`dataset-analysis-list.html:199`、`annotation-workspace.html:957`、`:1026`、`verify-email.html:292`、`sidebar.css:1086`、`:1124`、`login.html:354`、`user-management.html:253`、`:331`、`register.html:342`、`profile.html:641`、`forgot-password.html:319`、`reset-password.html:413` |
| `max-width: 768px` | 8 | `task-list.html:156`、`task-new.html:152`、`task-detail.html:1006`、`:1873`、`dashboard.components.css:275`、`content-tabs.css:36`、`annotation-list.html:367`、`sidebar.css:828` |
| `min-width: 768px` | 1 | `profile.html:50` |
| `max-width: 420px` | 3 | `task-list.html:170`、`task-detail.html:1040`、`annotation-list.html:416` |
| `max-width: 480px` | 1 | `task-new.html:173` |
| `max-width: 640px` | 1 | `task-detail.html:1896` |
| `max-width: 1100px` | 1 | `task-new.html:186` |
| JS `matchMedia` | 2 | `sidebar.js:513`（`min-width: 769px`）、`:518`（`min-width: 768px`） |

**內容最大寬度（`max-width`）：**

| 值 | 用在 | 位置（節選） |
| :--- | :--- | :--- |
| 1280px | 登入後頁面的內容區（10 頁） | `task-list.html:38`、`task-new.html:31`、`task-detail.html:42`、`dataset-analysis-list.html:38`、`dataset-analysis-detail.html:36`、`user-management.html:36`、`annotation-list.html:35`、`profile.html:48`、`role-settings.html:40`、`dashboard.layout.css:58` |
| 480px | 帳號頁的單卡（5 頁） | `login.html:126`、`register.html:129`、`forgot-password.html:128`、`reset-password.html:122`、`verify-email.html:127` |
| 400／440／520／720／860／1280px | Modal 與抽屜寬度（各自寫） | `role-settings.html:262`（400）、`user-management.html:680`（440）、`task-detail.html:892`、`annotation-list.html:223`、`annotation-workspace.html:1012`（520）、`annotation-workspace.html:947`、`:949`（720）、`:952`（860）、`task-new.html:70`（1280） |
| 520／420px | 空狀態（一般／緊湊） | `empty-state.css:11`、`:16` |
| 960px | 元件展示頁 | `components-showcase.html:63` |

**觀察：**

1. 「手機／桌面」的分界已經高度一致，只差 1px：24 條在 767／768 附近（767 有 16 條、768 有 8 條），加上 `profile.html:50` 的 `min-width: 768px`；`sidebar.js` 的 `matchMedia` 一處用 769、一處用 768（`:513`、`:518`），與 CSS 的 768 差 1px，**同一頁會有 1px 區間 CSS 與 JS 不一致**。`sidebar.css` 自己就兩種寫法（`:828` 是 768，`:1086`、`:1124` 是 767）。
2. 小螢幕的第二層分界只有 420px（3 條）。
3. 480、640、1100 各只有 1 條，是個別頁面自己的版面需要（`task-new`、`task-detail`）。
4. 內容最大寬度 1280px 非常一致（10／10 個登入後頁面）；帳號頁單卡 480px 也一致（5／5）。Modal 寬度各寫各的。

---

## 圖示

### 來源與規則

- **圖示來源是 [Lucide](https://lucide.dev/)，授權 ISC。**維護者裁定（2026-11-18）。repo 內的依據：`sidebar.js:666` 的註解引用 `https://lucide.dev/icons/chevron-down`；`docs/development/rules/frontend-agent-rules.mdx:310` 寫「ADR-030（Lucide 是唯一圖示來源）」；原件 `MASTER.md:2893` 寫「the project's single icon library」。
- **版本：未知。**`assets/icons/` 的 28 個 SVG 與 `assets/logo/icon.svg` 都沒有版本註解，prototype 內也沒有 `lucide` 套件或版號；原件 `MASTER.md` 同樣沒寫。要寫入版本需要維護者提供當初取用的版本，或之後改以套件鎖版（那是 `frontend/` 的事，現在不存在）。
- **線寬統一為 2。**`assets/icons/` 28 個全部是 `stroke-width="2"`，`24×24`、`fill="none"`、`stroke="currentColor"`、圓角端點與轉角、`aria-hidden="true"`（抽查 `check.svg`、`tag.svg`）。內嵌圖示不是 2 的行列在落差表。
- **一律 SVG。不用 emoji，也不用 `✕`、`←`、`→`、`✓`、`▾` 等字元。**關閉用 Lucide 的 `x`，返回用 `arrow-left`／`chevron-left`，勾選用 `check`，下拉箭頭用 `chevron-down`。這是鐵律 12。

### 用法

- 線條圖示，單色，顏色由 `currentColor` 繼承；不另外上色。
- 大多數頁面**不載入 `assets/icons/` 的檔案，而是把 `<svg>` 內嵌在 HTML／JS 裡**（`login.html:353`–`:358`、`sidebar.js:2046`；全 prototype 只有 `components-showcase.html` 以檔案引用 `chevron-down.svg`，見 [`pages/components-showcase.md`](pages/components-showcase.md)）。所以 `assets/icons/` 現況比較像**圖示資料庫**，不是頁面實際引用的來源。
- 純裝飾圖示加 `aria-hidden="true"`；單獨成為控制項的圖示要有 `aria-label`（`login.html:366`–`:368` 的語言切換是圖示加文字，所以圖示本身 `aria-hidden`）。

---

## CIS

素材全部在 `design/prototype/assets/logo/`。**標誌只有一個圖形**：Lucide 風格的「標籤」形（`tag`），中間一點。以下尺寸與構成都直接讀自 SVG 原檔。

| 檔案 | 尺寸 | 構成 | 顏色怎麼來 |
| :--- | :--- | :--- | :--- |
| `icon.svg` | 24×24 | 只有標籤線稿，線寬 2 | `currentColor`，繼承文字色 |
| `icon-colored.svg` | 48×48 | 圓角方（`rx` 12）填主色，白色標籤線稿置中 | 檔內寫死 |
| `logo-horizontal.svg` | 200×48 | 左：同 `icon-colored`；右：「Label Suite」wordmark，襯線 24 粗體 | 檔內寫死 |
| `banner.svg` | 1280×200 | 白底；左側 144 圓角方（`rx` 36）＋標籤；右側 wordmark 96 粗體、其下副標「NLP Annotation Portal」24 | 檔內寫死 |
| `social-preview.svg` | 1280×640 | 頁面底色；左側 160 圓角方（`rx` 40）＋標籤；右側 wordmark 80 粗體、其下副標 32 | 檔內寫死 |

### 結構規則（維護者裁定 2026-11-18）

數值取自 `icon-colored.svg`（48×48 的圓角方）。`icon.svg` 本身是 24×24 的線稿，**沒有圓角方**，所以圓角比只能量 `icon-colored.svg`。

| 規則 | 值 | 怎麼量的 |
| :--- | :--- | :--- |
| 圓角比 | 邊長的 25% | `icon-colored.svg`：`rx` 12 ÷ 48。`logo-horizontal.svg`、`social-preview.svg`（40 ÷ 160）、`login.html:50`（`.navbar-logo` 的 `border-radius` 8 ÷ 32）同為 25% |
| 最小尺寸 | 16px | 維護者裁定；原件 `assets/logo/README.md:49` 也寫 16 px（圖示）與 100 px（橫式 lockup） |
| 安全留白 | 圖示高度的 25% | `icon-colored.svg` 48 → 12 單位。原件 `README.md:50` 寫「at least 12 units」，與此相同 |
| 圖示與 wordmark 的間距 | 圖示高度的三分之一 | `logo-horizontal.svg`：圖示 0–48，文字起點 `x` 64，間距 16 ÷ 48 |
| 標籤線稿線寬 | 2（24 單位的畫布裡） | `icon.svg`、`icon-colored.svg`、`logo-horizontal.svg` |
| wordmark | 永遠是襯線粗體「Label Suite」，Crimson Pro | `logo-horizontal.svg`、`banner.svg`、`social-preview.svg`、`login.html:62`。副標用 Atkinson Hyperlegible（`banner.svg`） |
| 圖形與文字 | 圖形在左、wordmark 在右，垂直置中 | 各 SVG |

原件另有「不要」清單（`assets/logo/README.md:54`–`:57`），直接轉錄意思：不拉伸、傾斜、旋轉或裁切，只等比縮放；不在 token 之外改色；不替換 wordmark 字體、不改圖文間距；不加陰影、漸層、描邊、光暈。

**素材之間的不一致（要處理時走 UI／素材 issue）：**量得的值是 #418 之前的；狀態欄記處理結果。

| 檔案 | 量得 | 與規則的差 | 狀態 |
| :--- | :--- | :--- | :--- |
| `banner.svg:8` | 圓角 32 ÷ 144 ≈ **22%** | 規則是 25%（應為 36） | 已修（#418），`rx` 36 |
| `banner.svg:13`、`:14` | 標籤線稿線寬 1.8、點用 `circle` | 其餘素材線寬 2、點用 `line`；縮放後視覺線寬約 6.0（`1.8 × 3.33`），其餘約 6.7 | 已修（#418），線寬 2、點用 `line` |
| `banner.svg:12` | 圖形占圓角方 55.6%（24 × 3.33 ÷ 144） | `icon-colored.svg` 與 `social-preview.svg` 都是 50% | 已修（#418），`scale(3)`，占 50% |
| `banner.svg:8`、`:18` | 圖（`rect` 寬 144）與 wordmark（`text`）的間距 36 ÷ 144 = 25% | `logo-horizontal.svg` 是三分之一；`social-preview.svg`（40 ÷ 160）也是 25%。**圖文間距有兩種比例**，規則採 `logo-horizontal.svg` 的三分之一，另兩個是否照改由維護者決定 | 待決（`banner.svg`、`social-preview.svg` 都還是 25%） |
| `social-preview.svg:19` | 副標色與 token 不符 | 見下方色彩對應 | 已修（#418，Q12），改 `--color-ink-muted` 的值 |

### 素材用途

| 檔案 | 用途 |
| :--- | :--- |
| `icon.svg` | 繼承文字色的單色圖示（`currentColor`） |
| `icon-colored.svg` | App 圖示、頭像、**favicon 來源** |
| `logo-horizontal.svg` | 頁首、文件、簡報 |
| `banner.svg` | **README 橫幅** |
| `social-preview.svg` | **GitHub social preview** |

### SVG 寫死色值對應的 token

SVG 檔無法引用 CSS 變數，維護者裁定保留寫死色值（2026-11-18）。下表是每個寫死顏色對應的 token（取**淺色主題**的值）：

| 檔案 | 位置 | 對應 token | 是否完全相同 |
| :--- | :--- | :--- | :--- |
| 四個圓角方素材 | 圓角方填色 | `--color-primary` | 是 |
| 四個圓角方素材 | 標籤線稿 `white` | `--color-on-cta`（淺色值為白色） | 是 |
| `logo-horizontal.svg:13`、`banner.svg:18`、`social-preview.svg:16` | wordmark | `--color-ink` | 是 |
| `social-preview.svg:4` | 頁面底色 | `--color-surface` | 是 |
| `banner.svg:5` | 白底 | `--color-white`（淺色值） | 是 |
| `banner.svg:21` | 副標 | `--color-ink-muted` | 是 |
| `social-preview.svg:19` | 副標 | `--color-ink-muted` | 是 |

**規則（維護者裁定 2026-11-18）：副標用 `--color-ink-muted` 的 slate 灰**；`social-preview.svg` 原本寫死的 gray 已於 #418 改掉（落差表 Q12）。`--color-ink-muted` 在 #427 調為 `#5E6B7F` 後，疊在 `--color-surface` 上是 4.93:1、白底上 5.40:1，兩個 SVG 的副標跟著改成同一值。

### 深色主題的 logo（量測）

深色主題把 `--color-primary` 換成較亮的靛藍，而產品內 logo 的標籤線稿在 #418 之前固定 `white`。以 WCAG 相對亮度公式、`tokens.css` 的值（深色 `--color-primary`：`tokens.css:188`；線稿：白色）量測：

| 組合 | 對比 |
| :--- | :--- |
| 白色線稿 ／ 淺色主題 `--color-primary` | **4.47 : 1** |
| 白色線稿 ／ 深色主題 `--color-primary` | **2.98 : 1**（未達 3:1） |
| 深色主題 `--color-on-cta` ／ 深色主題 `--color-primary` | 5.36 : 1 |

**規則（維護者裁定 2026-11-18）：白色線稿在深色主題上不到 3:1（差 0.02），不能深淺共用一版；深色主題的 logo 標籤線稿用 `--color-on-cta`（深色主題的值是深墨色，5.36:1），與按鈕在深色主題的處理（`tokens.css:198`）一致。**實作屬 UI 修正，列在落差表；#418 已實作（落差表 Q11），線稿改 `currentColor`、色取 `--color-on-cta`。

### 在產品裡實際怎麼用

| 場景 | 做法 | 依據 |
| :--- | :--- | :--- |
| 帳號頁頂部 navbar | 32×32 主色圓角方（圓角 8px）＋內嵌 20×20 的標籤線稿（`--color-on-cta`：淺色白、深色深墨）；右側 wordmark 18px 襯線粗體；整塊是「回首頁」連結，`aria-label` 兩種語言 | `login.html:39`–`:68`、`:351`–`:361` |
| 登入後側欄品牌區 | 36×36（`--radius-md`）＋ wordmark 16px；放在最上、下方一條 `--color-border` 分隔線；整塊連回儀表板（`brandHref`） | `sidebar.css:37`–`:75`、`sidebar.js:2042`–`:2050` |
| 元件展示的頭像樣本 | `icon-colored.svg` 當作使用者頭像的示範圖 | `components-showcase.html:1366` |

觀察到的規則：

- 產品內的 logo 是**內嵌 SVG ＋ CSS 的 `--color-primary` 底**，不載入 `logo/*.svg` 檔案；所以它會**跟著主題換底色**；標籤線稿是 `currentColor`、色取 `--color-on-cta`，也跟著主題換（`login.html:357`–`:362`，#418）。
- logo 圖形本身 `aria-hidden`，辨識靠旁邊的 wordmark 與連結的 `aria-label`（`login.html:354`–`:356`）。
- 圖形底色用 `--color-primary`，**不用** `--color-cta` 或其他語意色。

### 沒有證據、不寫的

- **單色版本、「禁止用法」以外的深色背景版本細節**：本 repo 沒有素材；`icon.svg` 以 `currentColor` 承擔單色用途。
- **favicon 的尺寸清單與格式**：來源已定為 `icon-colored.svg`；原件 `assets/logo/README.md:146`–`:157` 用 inkscape 轉 16／32／48 px 再合成 `.ico`，那是原件的做法，本 repo 沒有採用的紀錄，所以不抄成規則。要補哪一個放進 UI issue。

---

## 與 prototype 的落差

本檔是規則，prototype 是現況。下表列出 prototype **目前違反**已定規則之處，供另開 UI issue 使用（改 `design/prototype/` 屬畫面修正，要先走 `AGENTS.md` 的 Ready gate；本檔與本次提交都沒有動它）。行號是撰寫當時（`main` 的 `eb9a884`）的位置。表中的 Q 項已在 #418 修正，各小節保留原本的清單作為紀錄，行號仍是 `eb9a884` 的位置；修正時與清單不同之處記在 [§#418 修正紀錄](#418-修正紀錄)。

| 類別 | 規則 | 行數 | 狀態 |
| :--- | :--- | :--- | :--- |
| Q1 「您」 | 全部中文文案用「你」 | 13 | 已修（#418） |
| Q2 「提交」 | 統一「送出」＋受詞 | 93（26 個檔案） | 已修（#418） |
| Q3 字元圖示 | 一律 SVG | 27 | 已修（#418） |
| Q5 中文文案裡的「Email」 | 中文用「電子郵件」 | 33 | 已修（#418） |
| Q7 線寬非 2 的圖示 | 線寬統一為 2 | 29（內嵌圖示）＋ 1（`banner.svg`） | 已修（#418），保留 1 處（見下） |
| Q9 logo 素材 | 圓角 25%、線寬 2 | 見 §CIS 的不一致表（5 項） | 已修 4 項（#418），圖文間距待決 |
| Q10 favicon | 每頁要有 `<link rel="icon">` | 40 個 HTML 全缺 | 已修（#418），18 頁 |
| Q6 斷點與寬度 | 767／768 分界、modal 400／520／720 | 見下，11 處 | 已修（#418） |
| Q11 深色主題 logo | 線稿用 `--color-on-cta` | 帳號頁與側欄的內嵌 logo（見下） | 已修（#418） |
| Q12 social preview 副標色 | 用 `--color-ink-muted` 的 slate 灰 | `social-preview.svg:19` 1 處 | 已修（#418） |
| G-02 寫死色值 | 只用 token | 22 個檔案、658 個六位色碼（頁面與 showcase，不含 `tokens.css` 與 logo）；細節與分類見 [`design-gaps.md`](design-gaps.md) G-02 | 已修（#420）：開工時（`cf0109a`）重算為 22 個檔案 662 個，修完剩 8 個檔案 171 個（含維護者追加的深色資料色 9 個），都是資料色、註解、`var()` 後備值與固定白字。#437 再把 `white` 關鍵字換成 token，通知徽章的白字改 `--color-on-badge-notify` |

### Q1：「您」（13 行）

- 介面文案 11 行：`task-detail.html:2142`、`:2472`；`dataset-analysis-list.i18n.js:46`；`annotation-workspace.config.js:67`；`profile.html:693`、`:740`、`:1181`、`:1191`、`:1233`；`register.html:427`、`:615`。
- 樣本資料 2 行（標記範例裡的對話文字，是否同改由維護者決定）：`task-detail.data.js:909`、`:917`。

### Q2：「提交」（93 行）

已排除 6 行（5 行註解：`annotation-workspace.config.js:1920`、`:1933`、`:2033`、`:2252`、`:3316`；1 行 showcase 的說明文字 `components-showcase.html:1341`）。含少量樣本資料（`task-detail.data.js`、`annotation-workspace.data.js`）。「已提交」「提交時間」等狀態詞與名詞同樣要改。

  - `components-showcase.html`（1）：:1106
  - `pages/annotation/annotation-list.html`（2）：:589, :637
  - `pages/annotation/annotation-workspace.config.js`（21）：:21, :27, :32, :33, :39, :58, :59, :86, :110, :111, :112, :113, :114, :115, :121, :122, :176, :178, :179, :182, :183
  - `pages/annotation/annotation-workspace.data.js`（3）：:774, :776, :3748
  - `pages/dashboard/dashboard.html`（3）：:167, :193, :194
  - `pages/dashboard/dashboard.i18n.js`（3）：:53, :66, :67
  - `pages/dataset/dataset-analysis-detail.html`（19）：:286, :301, :339, :396, :399, :412, :425, :449, :515, :538, :563, :567, :568, :630, :673, :685, :731, :751, :756
  - `…detail.partials/quality-entity_recognition.html`（1）：:152
  - `…detail.partials/quality-multi_dim.html`（1）：:149
  - `…detail.partials/quality-multi_label.html`（1）：:151
  - `…detail.partials/quality-sequence_tagging.html`（1）：:110
  - `…detail.partials/quality-single_dim.html`（1）：:153
  - `…detail.partials/quality-single_label.html`（1）：:143
  - `…detail.partials/stats-entity_recognition.html`（1）：:6
  - `…detail.partials/stats-free_text.html`（2）：:6, :13
  - `…detail.partials/stats-multi_label.html`（1）：:6
  - `…detail.partials/stats-relation_identification.html`（1）：:43
  - `…detail.partials/stats-sequence_tagging.html`（1）：:6
  - `…detail.partials/stats-single_label.html`（1）：:6
  - `pages/shared/annotation-history.js`（1）：:81
  - `pages/shared/sidebar.js`（2）：:242, :2134
  - `pages/task-management/task-config.data.js`（1）：:658
  - `pages/task-management/task-detail.data.js`（2）：:1085, :1422
  - `pages/task-management/task-detail.html`（15）：:2313, :2401, :2490, :2536, :2542, :2567, :2575, :2582, :2644, :2645, :2654, :2656, :2670, :2699, :2736
  - `…detail.panels/annotation-progress.html`（4）：:11, :56, :71, :127
  - `…detail.panels/annotation-results.html`（3）：:15, :18, :167

### Q3：字元圖示（27 行）

- `✕`（4）：`components-showcase.html:1534`、`dataset-analysis-list.html:312`、`dataset-analysis-detail.html:364`、`annotation-workspace.html:1328`（toast 關閉鈕）。
- `←`（9）：`reset-password.html:588`、`:653`、`:679`；`forgot-password.html:438`、`:453`、`:488`、`:491`、`:506`、`:509`。
- `▾`（1）：`task-config.engine.js:662`。
- `✓`、`✗`、`✎`、`○`、`ⓘ`（7）：`task-config.engine.js:2258`、`:2825`；`task-detail.html:6459`、`:8606`、`:8608`；`annotation-workspace.config.js:3628`、`:3629`。
- `→`（6）：`annotation-list.html:2168`；`task-config.engine.js:2225`、`:2229`、`:4632`；`task-detail.html:2682`、`:3274`。
- 沒有 emoji。唯一的 `⛔` 在註解（`role-settings.html:193`）。
- **我的範圍判斷（請維護者確認）**：資料內容裡的箭頭與乘號（關係三元組 `(DRUG:…)→treats→(SYMP:…)`、`×2`，`task-detail.html:3858`–`:4138`）與說明句中的流程箭頭（`task-config.engine.js:2067`–`:2068`）視為資料或文句，不算字元圖示，沒有列入。

### Q5：中文文案裡的「Email」（33 行）

`components-showcase.html:1064`；`forgot-password.html:451`、`:490`；`profile.html:873`、`:963`、`:973`、`:983`、`:993`、`:1003`、`:1013`、`:1153`、`:1208`、`:1223`、`:1233`；`user-management.html:395`、`:777`、`:823`、`:824`；`task-detail.html:2434`、`:2436`、`:2437`、`:2438`、`:2439`、`:2440`、`:2464`、`:2470`；`task-detail.panels/member-management.html:4`、`:9`、`:11`、`:36`、`:37`、`:39`；`task-new.html:644`。

### Q7：線寬不是 2 的內嵌圖示（29 處＋ logo 1 處）

- 2.5（21）：`task-config.engine.js:1315`、`:2495`、`:4053`；`dataset-analysis-detail.partials/quality-multi_label.html:25`、`quality-single_dim.html:34`、`quality-entity_recognition.html:47`、`quality-multi_dim.html:66`、`quality-relation_identification.html:29`、`quality-single_label.html:25`；`annotation-workspace.html:1150`、`:1165`、`:1181`、`:1202`、`:1216`、`:1235`、`:1246`；`verify-email.html:376`、`:388`；`forgot-password.html:446`；`reset-password.html:501`、`:596`。
- 1.5（3）：`dataset-analysis-detail.html:296`、`:315`；`user-management.html:555`。
- 3（2）：`components-showcase.html:1234`、`task-new.html:902`。
- 2.2（2）：`verify-email.html:366`、`reset-password.html:491`。
- 2.4（1）：`profile.html:1059`。
- logo（1）：`assets/logo/banner.svg:13` 的 1.8。
- 未列入：`dataset-analysis-detail.partials/stats-*.html` 裡寫 1、1.5、0.5 的線條是圖表的格線與軸線，不是圖示。

### Q6：斷點與寬度（11 處）

- `max-width: 768px` 應改 `767px`（8）：`task-list.html:156`、`task-new.html:152`、`task-detail.html:1006`、`:1873`、`dashboard.components.css:275`、`content-tabs.css:36`、`annotation-list.html:367`、`sidebar.css:828`。
- `sidebar.js:513` 的 `matchMedia('(min-width: 769px)')` 應改 768（1）；`:518` 已是 768。
- Modal 寬度 440px 不在 400／520／720 之內（1）：`user-management.html:680`。
- 小螢幕之外沒有其他需改的共用斷點；480／640／1100 是頁面自己的，不算落差。
- 另一處不計：`profile.html:50` 的 `min-width: 768px` 本來就符合。

### Q10：favicon

全部 40 個 HTML 都沒有 `<link rel="icon">`；`assets/` 底下沒有 favicon 檔。`index.html:6` 的標題是「Label Suite Prototype」（與品牌頁面標題格式 `Label Suite — <頁名>` 也不同）。

### Q11：深色主題 logo

產品內 logo 是內嵌 SVG，標籤線稿固定 `white`：`login.html:403`–`:408`（帳號頁 navbar）、`sidebar.css:52`–`:58` 與 `sidebar.js:2039`（側欄品牌區）。深色主題下對比 2.98:1，需要另備深色版（見 §CIS）。#418 已修，見下方修正紀錄 Q11。

### #418 修正紀錄

- **Q1、Q2**：樣本資料一併改（維護者裁定）；「提交」依「送出」＋受詞改寫，狀態詞改「已送出」「送出時間」。
- **Q3**：改為 Lucide SVG（線寬 2）。另補 3 處清單未列的字元圖示：`task-detail.html` 標記說明移除鈕的 `×`、相依提示的 `⤷`（`task-config.css` 的 `::before`）、`annotation-workspace.config.js` 略過決定的 `—`。`assets/icons/` 新增 `arrow-left`、`pencil`、`circle`、`minus`、`corner-down-right` 五個，照 Lucide 原樣。資料內容裡的箭頭與乘號、說明句中的流程箭頭依維護者裁定不改。
- **Q7**：另補清單未列的 `task-config.engine.js` 的 `makeSvgIcon` 與 `task-detail.html` 的 chevron。**保留** `components-showcase.html:1234` 的 3：那是審核分岔的非色彩狀態提示（鐵律 4），showcase 的說明明寫「fork stroke-width 2→3」，是否改 2 由維護者決定。
- **Q9**：`banner.svg` 圓角改 36、線寬 2、點改 `line`、圖形改占 50%（`scale(3)` 置中）。**圖文間距**（`banner.svg`、`social-preview.svg` 的 25%）照 §CIS 仍待維護者決定，沒有改。
- **Q10**：18 個完整頁面加上指向 `assets/logo/icon-colored.svg` 的 `<link rel="icon">`；另 22 個是注入用的片段（`task-detail.panels/` 6 個、`dataset-analysis-detail.partials/` 16 個），沒有 `<head>`，不加。`index.html` 的標題沒有改。
- **Q6**：`user-management.html` 的停用確認 modal 改 400，與 `role-settings.html` 的 `.modal-center` 相同。
- **Q11**：帳號頁 5 頁與側欄共 11 個內嵌 logo 的線稿改 `currentColor`，顏色取 `--color-on-cta`；帳號頁不載入 `tokens.css`，所以在各頁的本地 token 補上 `--color-on-cta`（淺色 `#FFFFFF`、深色 `#1E1B4B`，與 `tokens.css` 相同）。#420 起帳號頁改載 `tokens.css`，這些本地 token 已刪（G-03）。

---

## 未決

目前無。
