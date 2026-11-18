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

Label Suite 是碩士論文 Demo Paper 的核心成果：用設定驅動的標記流程，讓研究團隊在同一個平台走完建立任務、試標、確認一致性、正式標記、審核、匯出，並在標記過程中就看到資料統計（`docs/specs/00-prd.mdx` §專案概述）。使用者是研究團隊成員，不是一般消費者；其中標記員與審核員的「好上手」以 SUS 75 分衡量（`00-prd.mdx:58`）。

banner 與 social preview 上的產品副標是「NLP Annotation Portal」（`design/prototype/assets/logo/banner.svg`、`social-preview.svg`）。

---

## 鐵律

以下每一條都有明確的文字依據，不是撰寫者從畫面「覺得」出來的。

1. **只用 token，不自創顏色。**`tokens.css` 的檔頭寫「Import this file instead of redefining tokens in each page」（`assets/tokens.css:3`）；skill 寫「不要自創 token 以外的顏色」（`label-suite-design/SKILL.md` §怎麼用）。**現況與這條不符**：prototype 有大量寫死色值（`design-gaps.md` G-02），本檔把它當作「要追的規範」，不是「已達成的事實」。
2. **主色文字放淺底要用 `--color-primary-strong`，不用 `--color-primary`。**後者對比不足 4.5:1（`tokens.css:19` 註解、skill §無障礙）。次要文字最淺到 `--color-ink-muted`，`slate-400` 以下的顏色不可用於文字（skill §無障礙）。
3. **語意色各有專屬用途。**`--color-warning` 與 `--color-error` 保留給例外、待確認與錯誤，不當區分色；用顏色區分模組或角色時最多五種，超過就靠標籤文字（skill §區分多個模組或角色）。
4. **狀態不能只靠顏色。**Review Status Track 以文字前綴「目前：」、字重與線寬輔助（`components-showcase.html:1214` 的說明、[`components/review-status-track.md`](components/review-status-track.md)）。Color Dot 目前只靠顏色，已登記為缺口（G-14）。
5. **錯誤 toast 不自動消失，只能手動關。**整頁只有一則 toast；success 3000ms、info 5000ms、warning 8000ms、error 0（UXC-07，`components-showcase.html:1500`）。
6. **Toast 與 banner 分工。**頁面層級的錯誤用 inline banner（`role="alert"`）；動作結果的回饋用 toast（`components-showcase.html:1105`）。
7. **送出中要有載入態且不能重複送出。**UXC-06（`components-showcase.html:211`）。已知缺口：只擋滑鼠、沒擋鍵盤（G-06）。
8. **Skeleton 的尺寸要貼合載入後的內容**，以防 layout shift（UXC-08，`components-showcase.html:1127`）。所以 Skeleton 的尺寸不 token 化。
9. **同一組一次性連結失效用同一句話。**`ONE_TIME_LINK_WORDING` 是單一來源（`pages/shared/sidebar.js:227`），重設密碼與驗證信兩頁都引用它（`reset-password.html:657`、`verify-email.html:435`）。
10. **每個畫面同時支援繁中與英文、淺色與深色。**語言與外觀是共用介面的一部分（`00-prd.mdx:136`、`docs/specs/07-shared/01-sidebar.mdx`）；元件要用語意 token，深色主題靠 `html[data-theme="dark"]` 重新對映同名 token，頁面不寫兩份（`tokens.css` 深色區塊的檔頭說明）。
11. **互動元件要有 `prefers-reduced-motion` 的退路。**共用 CSS 與 showcase 都有（`pages/shared/sidebar.css:185`、`components-showcase.html:971`）；`account/profile` 是唯一漏掉的帳號頁（G-30）。

## 設計決策

維護者已經裁定、可以直接引用的決定：

| 決定 | 內容 | 來源 |
| :--- | :--- | :--- |
| 危險按鈕 | 以 `modal.css` 的**實心**版為正典，showcase 的外框版記為與出貨不符 | `design-gaps.md` G-01（2026-11-17） |
| 帳號頁元件 | 帳號頁自己的 `.login-btn`／`.sso-btn` 等視為正典元件的同一個，規格用正典名 | G-03（2026-11-17） |
| UXC 編號 | 沿用 prototype 已在用的 03–11，01／02 留空 | `ux-conventions.md`（2026-11-17） |
| 外觀選項 | 三選一「跟隨系統／淺色／深色」，預設「跟隨系統」；`system` 真的讀作業系統 | `assets/theme.js:5`、`:17` 的註解（#195，2026-11-09） |
| 語言 | 兩種：`zh`、`en`；沒有儲存值時預設 `zh`；選擇存在 `labelsuite.lang` | `pages/shared/sidebar.js:3`、`:410`–`:415` |
| 說明按鈕 | 這期不做，下一期依 SUS 結果再決定 | `00-prd.mdx:147` |
| 引用 `MASTER.md` 版號 | `tokens.css` 與 prototype 註解引用的 `MASTER.md` 版號、行號指向原件，本 repo 解析不到 | `MASTER.md` §這份檔是重建的、G-25 |

「為什麼是這個設計」的取捨紀錄（例如為什麼選 indigo 為主色、為什麼大標題用襯線體）**本 repo 沒有留下來**，不在這裡補寫；見 [§未決](#未決)。

---

## 內容與語氣

### 語言

- **雙語並行，繁體中文（`zh-TW`）與英文對等。**每個帳號頁都有 `i18n = { zh: {...}, en: {...} }` 兩份完整文案，鍵名一一對應（例：`pages/account/login.html:563`–`:610`）。新增任何字串兩份一起加。
- **切換鈕顯示的是目前語言的代碼 `ZH`／`EN`**，aria-label 是「切換語言」／「Switch language」（`login.html:586`、`:608`；`sidebar.js:430`）。
- **頁面標題格式**：`Label Suite — <頁名>`；英文版同格式（`login.html:566`、`:589`）。dashboard 另帶「（原型）」，那是 prototype 標記，不是品牌規則（`dashboard.i18n.js:7`）。
- **品牌名不翻譯**：「Label Suite」在兩種語言都照寫，aria-label 才分「Label Suite 首頁」／「Label Suite home」（`login.html:585`、`:608`）。
- 字體對應：中文行高 1.8、英文 1.6（`tokens.css` §Semantic type rules，`html[lang="zh-TW"]`）。

### 稱謂

**原型沒有一致的稱呼。**同一份 `profile.html` 同時出現「您」（5 處）與「你」（10 處）；整個 prototype 統計下來「你」多於「您」（`profile.html`：您 5、你 10；`task-detail.html`：您 2、你 2；`register.html`：您 2、你 1；`login.html`、`forgot-password.html`、`verify-email.html`、`task-new.html`、`sidebar.js`：只有「你」）。規格書也兩種都有（`04-profile.mdx:127` 用「您」，`01-dashboard.mdx:217` 用「你」）。

- 只能說：**偏向「你」的口語**，尤其是動作與後果說明（例：`profile.html:1239`「除非你回到『密碼設定』重新設一組」）；「您」多出現在區塊副標與成功通知（`profile.html:1191`「修改您的姓名與聯絡方式」、`:1233`「您現在可使用…」、`register.html:590`）。
- 這是現況觀察，不是規則 → [§未決](#未決) Q1。

### 按鈕用語

規則是從現有文案歸納的，沒有原文明列：

- **帳號流程用「動詞＋受詞」說出結果，不寫「確定」「送出」這種空動詞。**登入、建立帳號、寄送重設連結、更新密碼、重新寄送驗證信、前往登入（`register.html:600`、`forgot-password.html:486`、`reset-password.html:651`、`profile.html:1224`）。英文對應：Sign In、Create Account、Send Reset Link、Update Password（Title Case，無句點）。
- **表單通用鈕是「儲存」與「取消」**（`user-management.html:793`–`:802`、`task-new.html:622`–`:623`）。
- **標記作業用「提交」，審核與仲裁用「送出」**：標記員按「提交」（`annotation-workspace.config.js:21`）；審核員「送出審核」、仲裁「送出仲裁」（`:60`、`:84`）。標記員另有「儲存草稿」（`:22`）。
- **送出鈕旁說明後果。**審核送出旁會寫「送出後進入爭議池，待仲裁定案」或「送出後即定稿，成為最終答案」（`annotation-workspace.config.js:71`–`:72`、`annotation-workspace.html:1276`）。
- **載入中的按鈕文字**：進行式加刪節號，「建立中…」（`components-showcase.html:1037`）；登入頁的送出鈕改以 spinner 取代文字並帶 `aria-label="載入中"`（UXC-06）。
- **破壞性動作要先確認，確認句型**：「確定要停用 …」（`user-management.html:918`）、未儲存離開：「你有尚未儲存的變更，離開將會遺失所有已填寫的內容。」（`task-new.html:629`）。UXC-10、UXC-03 在 b2／b3 才寫完。
- **返回類連結**：「返回登入」「返回個人設定」「前往登入」（`register.html:562`、`profile.html:1224`、`reset-password.html:603`）；`reset-password` 的返回連結帶箭頭字元「← 返回登入」（`:653`）。

### 錯誤與驗證訊息

- **欄位驗證：「請」開頭，說出要做什麼。**「請輸入電子郵件」「請輸入密碼」「請輸入有效的電子郵件格式」（`login.html:579`–`:580`、`register.html:606`）；英文對應「Email is required」「Password is required」。
- **規則寫在訊息裡，不只說錯。**「密碼至少需 8 個字元，含大寫英文、小寫英文與數字」（`register.html:609`）；密碼規則另有常駐的 hint（`:597`）。
- **登入失敗不指出是帳號還是密碼**：「帳號或密碼錯誤，請再試一次」（`login.html:578`）；英文 `Invalid email or password`（`:601`）。
- **說出原因與下一步。**「瀏覽器的儲存空間放不下這張圖，請換一張小一點的；其他欄位已經存好了」（`profile.html:1229`）——先說發生什麼，再說怎麼辦，並交代沒壞的部分。
- **一次性連結失效**：「連結無法使用，請重新申請」；英文 `This link can no longer be used. Please request a new one.`（`sidebar.js:228`–`:229`）。
- **標記員被擋下時說明條件**：「請完成所有標記項目後再提交」（`annotation-workspace.config.js:58`）；審核員失去資格時說明還能做什麼：「…可檢視自己審核過的內容與歷程，但無法再提交審核決策。」（`:112`）。
- **無障礙名稱（aria-label）和可見文字一樣要兩種語言**（`login.html:584`–`:586`、`:607`–`:609`）。

### 標點與格式

- 中文句末多數不加句號（欄位標籤、toast 標題、按鈕），完整句子才加（例：`task-new.html:629`）；toast 副文字是子句，不加句號（`profile.html:1233`）。
- 「？」用全形（「忘記密碼？」「還沒有帳號？」，`login.html:574`、`:576`）。
- 破折號用全形雙線「——」（`profile.html:1239`）。
- 日期與時間格式、數字格式：**沒有統一證據** → Q4。

### Email 與專有名詞

- 「Email」與「電子郵件」並存：標籤用「電子郵件」（`login.html:571`），說明與成功訊息用「Email / Password」（`profile.html:1208`、`:1233`）、「Email 已存在」（`user-management.html:818`）。→ Q5。
- 術語以 `docs/specs/` 的 glossary 為準（標記員、審核員、專案負責人、任務設定；`00-prd.mdx` 的 `:ref` 引用）。本檔不重列。

---

## 視覺基礎

token 名與值以 `tokens.css` 為準；本節只寫**怎麼用**。

### 色彩角色

| 角色 | token | 用在哪 | 依據 |
| :--- | :--- | :--- | :--- |
| 品牌主色 | `--color-primary`、`--color-secondary` | logo 底色、主要操作、選取、連結強調 | skill §色票；`navbar-logo`（`login.html:67`、`sidebar.css:52`） |
| 主色上的文字 | `--color-primary-strong`、`--color-on-cta` | 放在主色淺底或填色上的文字 | `tokens.css:19`、`:21` |
| 確認與完成 | `--color-cta`、`--color-cta-hover` | 確認、完成類主要鈕 | skill §色票 |
| 頁面與卡片 | `--color-surface`（頁底）、`--color-white`（卡片）、`--color-slate-50`（交錯列） | 版面底色層次 | skill §色票；`tokens.css` 語意別名 `--bg-page`／`--bg-surface` |
| 文字 | `--color-ink`（內文標題）、`--color-ink-muted`（次要）、`--color-on-ink` | | `tokens.css` §Semantic aliases |
| 分隔 | `--color-border`、`--color-border-muted` | | skill §色票 |
| 四個語意 | `--color-success`／`warning`／`error`／`info`，各配 `-bg`、`-border` | 狀態、banner、toast、badge | `tokens.css` §Semantic State Colors |
| 非語意強調 | `--color-file-markdown` | 只用來區分檔案類型圖示，不是狀態 | `tokens.css`（檔案類型圖示強調）註解 |
| 工作頁籤 | `--color-tab-active-bg`、`--color-tab-hover-bg` | 側欄上方頁籤；兩者在深色主題刻意不同值 | `tokens.css` §Workspace Tabs |

`--color-text-muted` 是 `--color-ink-muted` 的舊別名，新元件不用（`tokens.css:27`、`:32`、skill）。

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
- **現況落差**：帳號頁的 wordmark 直接寫字面字體名 `'Crimson Pro', serif`（`login.html:82`），沒走 `--font-serif-display`；側欄的版本才用 token（`sidebar.css:69`）。
- 字體由 `tokens.css:7` 以 Google Fonts 的 `@import` 載入。

### 間距、圓角、陰影、動態、層級

- 間距刻度：4、8、16、24、32、48、64（`--space-xs` … `--space-3xl`）。
- 圓角：sm 4、md 8、lg 12、xl 16、full（`--radius-*`）。按鈕與輸入用 `--radius-md`（`shared/button.css`）。
- 陰影：卡片用 `--shadow-card`；**圖內元素不加陰影**（skill §字級、間距、圓角、陰影）。深色主題的陰影改成細環線為主（`tokens.css` 深色區塊 §Shadows）。
- 動態：`--ease-standard` ＋ `--dur-fast`（150ms）／`--dur-normal`（200ms）。
- 層級：`--z-base` … `--z-tooltip` 一組七階，toast 在 modal 之上、tooltip 最上（`tokens.css` §Z-index）。

### 對比與無障礙

- 對比修正是**有紀錄的**：`--color-cta` 與 `--color-ink-muted` 為過 WCAG AA 而換過值，註解保留舊值的對比數字（`tokens.css:13`、`:32`）；此後新的文字／底色組合以 AA 為下限。
- `--color-on-cta` 疊在淺色主題的 `--color-primary` 上是 4.47:1，**低於 AA，被列為已接受的取捨**（`tokens.css:21` 註解）。這是唯一有明文豁免的一處。
- 焦點樣式現況幾乎缺席（G-05），所以「所有互動元件都有可見焦點」是**目標而非現況**。

### 招牌做法

目前 prototype 與規格裡**有證據、而且是這個產品才有**的做法：

1. **標記作業區的進度與存檔語言。**進度寫成「{done} / {total} 已提交」，存檔狀態用「尚未儲存」「尚未儲存的變更」「上次儲存於 {time}」三種字串，離開有未儲存變更要擋（`annotation-workspace.config.js:32`、`:34`–`:36`；UXC-03）。
2. **實體標記以「每個實體類型一個顏色」直接畫在原文上。**原文中的標記是行內 highlight，顏色隨實體類型，以 inline style 帶入；旁邊配同色的類型小徽章（`annotation-workspace.html:644`–`:661` 的 `.rv-source-mark`、`.rv-source-badge`）。這些色是**資料色**，不是語意色（Color Dot 的 8 色盤同理，[`components/color-dot.md`](components/color-dot.md)、G-02）。
3. **審核單位的雙軌狀態**：待審 → 已定稿（答案未修改）與待審 → 爭議中 → 已定稿（答案有修改），畫成分岔軌道而不是線性步驟條；明確不可改用 Step Indicator（`components-showcase.html:1214`）。
4. **後果寫在按鈕旁**：送出前就讓審核員知道會進爭議池還是定稿（見 §按鈕用語）。
5. **角色與任務型別用 badge 辨識**：角色 badge 是 `--radius-full` 藥丸、任務型別是各自一組色（[`components/badge.md`](components/badge.md)）。

只有一份證據、不能算「做法」的，不列入。若維護者認為還有別的招牌做法，請補（Q8）。

---

## 版面

證據偏少，只收有明文的：

- **登入後的每一頁共用側欄**：品牌區（logo＋wordmark＋語言切換）在最上、分隔線、導覽列（`sidebar.js:2034`–`:2048`、`sidebar.css:37`–`:44`）。側欄可收合，狀態存在 `labelsuite.sidebarCollapsed`（`sidebar.js:5`）。
- **工作頁籤**上限 8 個、重開堆疊上限 10（`sidebar.js` 的 `TAB_CAP`、`TAB_REOPEN_CAP`）。「工作頁籤」與頁內「Content Tabs」是兩個東西，命名見 [`MASTER.md`](MASTER.md) §命名約定。
- **帳號頁**是置中的單卡版面，頂部 navbar 只有 logo 與語言切換（`login.html` 的 `.navbar`、`:396`–`:411`）。
- 響應式斷點、內容最大寬度、網格欄數：**沒有統一證據**（各頁各寫各的媒體查詢）→ Q6。

---

## 圖示

### 來源

- `design/prototype/assets/icons/` 有 **28 個** SVG，全部是 24×24 的 `viewBox`、`fill="none"`、`stroke="currentColor"`、`stroke-width="2"`、圓角端點與圓角轉角、`aria-hidden="true"`（抽查 `check.svg`、`tag.svg`）。
- **形狀來自 Lucide**：側欄與 CSS 的註解明寫引用 Lucide 的 `chevron-down`（`sidebar.js:665`、`sidebar.css:134`）；logo 的標籤形與 `icons/tag.svg` 同一路徑（見 §CIS）。檔案名稱（`chevron-down`、`bar-chart-3`、`layout-dashboard`、`more-horizontal`）也是 Lucide 的命名。
- **repo 沒有記錄整套圖示的來源、授權與版本** → Q7。

### 用法

- 線條圖示，單色，顏色由 `currentColor` 繼承；不另外上色。
- 大多數頁面**不載入 `assets/icons/` 的檔案，而是把 `<svg>` 內嵌在 HTML／JS 裡**（`login.html:403`–`:408`、`sidebar.js:2039`；全 prototype 只有 `components-showcase.html` 以檔案引用 `chevron-down.svg`，見 [`pages/components-showcase.md`](pages/components-showcase.md)）。所以 `assets/icons/` 現況比較像**圖示資料庫**，不是頁面實際引用的來源。
- 內嵌圖示的 `stroke-width` 以 `2` 為多；`banner.svg` 內縮放後的標籤線稿用 `1.8`。**沒有定出單一線寬**→ Q7。
- 純裝飾圖示加 `aria-hidden="true"`；單獨成為控制項的圖示要有 `aria-label`（`login.html:413`–`:414` 的語言切換是圖示加文字，所以圖示本身 `aria-hidden`）。
- **有文字字元充當圖示的例外**：toast 的關閉鈕用字元 `✕`（`components-showcase.html` toast、[`components/toast.md`](components/toast.md)），不是 SVG → Q7。

---

## CIS

素材全部在 `design/prototype/assets/logo/`。**標誌只有一個圖形**：Lucide 風格的「標籤」形（`tag`），中間一點。以下尺寸與構成都直接讀自 SVG 原檔。

| 檔案 | 尺寸 | 構成 | 顏色怎麼來 |
| :--- | :--- | :--- | :--- |
| `icon.svg` | 24×24 | 只有標籤線稿，線寬 2 | `currentColor`，繼承文字色 |
| `icon-colored.svg` | 48×48 | 圓角方（`rx` 12）填主色，白色標籤線稿置中 | 檔內寫死 |
| `logo-horizontal.svg` | 200×48 | 左：同 `icon-colored`；右：「Label Suite」wordmark，襯線 24 粗體 | 檔內寫死 |
| `banner.svg` | 1280×200 | 白底；左側 144 圓角方（`rx` 32）＋標籤；右側 wordmark 96 粗體、其下副標「NLP Annotation Portal」24 | 檔內寫死 |
| `social-preview.svg` | 1280×640 | 頁面底色；左側 160 圓角方（`rx` 40）＋標籤；右側 wordmark 80 粗體、其下副標 32 | 檔內寫死 |

### 結構規則

- **圓角方的圓角約為邊長的四分之一**：48→12、144→32（約 22%）、160→40（25%）、頁面的 32px 版本 8px（`login.html:67`）、側欄 36px 版本用 `--radius-md`（`sidebar.css:52`–`:58`）。圓角比不是單一值，**沒有被明訂**，見 Q9。
- **wordmark 永遠是襯線粗體的「Label Suite」**，字體是 Crimson Pro（`logo-horizontal.svg`、`banner.svg`、`social-preview.svg`、`login.html:82`）。副標用 Atkinson Hyperlegible（`banner.svg`）。
- **圖形與文字的關係**：圖形在左，wordmark 在右，垂直置中；banner 的副標比 wordmark 縮進 6px（`banner.svg`）。

### 在產品裡實際怎麼用

| 場景 | 做法 | 依據 |
| :--- | :--- | :--- |
| 帳號頁頂部 navbar | 32×32 主色圓角方（圓角 8px）＋內嵌 20×20 的白色標籤；右側 wordmark 18px 襯線粗體；整塊是「回首頁」連結，`aria-label` 兩種語言 | `login.html:61`–`:90`、`:401`–`:411` |
| 登入後側欄品牌區 | 36×36（`--radius-md`）＋ wordmark 16px；放在最上、下方一條 `--color-border` 分隔線；整塊連回儀表板（`brandHref`） | `sidebar.css:37`–`:75`、`sidebar.js:2036`–`:2044` |
| 元件展示的頭像樣本 | `icon-colored.svg` 當作使用者頭像的示範圖 | `components-showcase.html:1358` |

觀察到的規則：

- 產品內的 logo 是**內嵌 SVG ＋ CSS 的 `--color-primary` 底**，不載入 `logo/*.svg` 檔案；所以它會**跟著主題換底色**，而標籤線稿固定 `white`（`login.html:403`–`:408`）。
- logo 圖形本身 `aria-hidden`，辨識靠旁邊的 wordmark 與連結的 `aria-label`（`login.html:401`–`:402`）。
- 圖形底色用 `--color-primary`，**不用** `--color-cta` 或其他語意色。

### 沒有證據、不寫的

favicon、最小尺寸、安全留白、深色背景版本、單色版本、禁止用法、與字標的間距比例，以及 banner 與 social preview 要放在哪裡（GitHub、README、論文簡報）——repo 內**找不到任何記錄**。見 Q9–Q12。

---

## 未決

以下每一題都是：證據不足以定案，或證據彼此衝突。**撰寫者不自己回答**。

| # | 問題 | 為什麼卡住 | 證據 |
| :--- | :--- | :--- | :--- |
| **Q1** | 稱謂用「你」還是「您」？是否依場景分（動作說明用「你」、正式提示用「您」）？ | 同一頁同時有兩種；規格書也兩種都有。這會決定全部中文文案的語氣 | §內容與語氣 §稱謂 |
| **Q2** | 按鈕用語要不要寫成規則？特別是標記作業「提交」與審核／仲裁「送出」並存，是刻意的還是尚未統一？ | 兩組動詞在同一個工作區並存 | `annotation-workspace.config.js:21`、`:60`、`:84` |
| **Q3** | 是否允許 emoji 與字元圖示（`✕`、`←`）？ | 沒有任何文件禁止或允許；toast 關閉鈕與返回連結已經在用字元 | `components-showcase.html` toast、`reset-password.html:653` |
| **Q4** | 日期、時間、數字的顯示格式是什麼？ | prototype 沒有統一的格式化函式或說明 | — |
| **Q5** | 「Email」與「電子郵件」哪個是正式用語？是否放進術語表？ | 標籤與說明文案混用 | `login.html:571`、`profile.html:1208` |
| **Q6** | 響應式斷點、內容最大寬度、網格欄數的標準值？ | 各頁各自寫媒體查詢，沒有 token | §版面 |
| **Q7** | `assets/icons/` 的來源、授權與版本；單一線寬；`✕` 這類字元要不要換成 SVG？ | 檔名與路徑像 Lucide，但 repo 沒有記錄；線寬 1.8 與 2 並存 | §圖示 |
| **Q8** | 招牌做法是否還有別的？（維護者想強調的產品特色） | 本檔只收有證據的 5 項 | §招牌做法 |
| **Q9** | logo 的規範：圓角比（約 22% 與 25% 兩種）、最小尺寸、安全留白、與 wordmark 的間距比？ | SVG 原檔量得出尺寸，但沒有「這是規定」的說明 | §CIS |
| **Q10** | favicon 要怎麼做、放哪裡？ | 所有 HTML 都沒有 `<link rel="icon">`，`assets/` 也沒有 favicon 檔；`index.html` 的標題是「Label Suite Prototype」 | §CIS |
| **Q11** | logo 的深色背景版本與單色版本要不要有？目前深色主題下 logo 底色會變亮（`--color-primary`），但標籤線稿固定白色，對比未量測 | `tokens.css` 深色區塊 `--color-primary`；`login.html:403`–`:408` | §CIS |
| **Q12** | banner 與 social preview 的用途與放置位置（GitHub social preview？README？簡報？）；兩者的字幕色與底色是否該改成對應 token？ | 素材存在，但沒有任何檔案引用或說明；SVG 內寫死色值，與 `tokens.css` 的對應關係無記錄 | `assets/logo/banner.svg`、`social-preview.svg` |
| **Q13** | 為什麼選 indigo 為主色、襯線為大標字體、`--color-cta` 用 emerald？這些品牌決策有沒有決策紀錄要補進 §設計決策？ | `tokens.css` 檔頭指向 `MASTER.md`（原件）2026-04-18 版，本 repo 沒有那份 | `MASTER.md` §這份檔是重建的 |
| **Q14** | 這份品牌書成為「依據」的方式：prototype 與它不符時，改 prototype 還是改它？（例如鐵律 1 與 G-02 的落差） | 改 `design/prototype/` 屬畫面修正，要走 Ready gate | `AGENTS.md` §Ready gate |
