# Proposal

本份是 change `sidebar-nav`（Issue #720，Epic #713 共用介面外殼）的提案，摘要同目錄的 `system-analysis.md`（以下稱 sa）、`system-design.md`（sd）、`ui-design.md`（ui）、`api-contract.md`，並依 `clarification.md` 的決議（Q1–Q14、P1–P7）定稿，不與它們矛盾。

## Why

登入後目前只有 #719 的暫時落點，明文「沒有側欄」（`openspec/specs/auth-guard` Requirement「暫時落點顯示目前登入者並提供登出」）；規格 07-01 要求每一個登入後頁面都有同一套側欄，讓使用者知道自己在哪、能去哪，並切換語言與外觀、查看快捷鍵、登出。依產品路線圖（`docs/product/roadmap.mdx` §排序依據 第 2 條），01-01 之後接 07-01，#721、#722、#725 與之後每一個登入後頁面都掛在這層外殼上，所以現在要先做。

## What Changes

- **新增登入後外殼與側欄**（規格 07-01）：包住所有登入後路由的外殼，畫出品牌區、五或六個導覽項、系統管理次選單、底部工具列（快捷鍵、外觀）、使用者區與登出、快捷鍵總覽；桌機可收合、手機改為上方品牌列加下方主導覽。畫面以 `design/prototype/pages/shared/sidebar.js`、`sidebar.css` 為準，維護者 2026-11-27 已核可（Issue #720 留言「Ready gate：畫面已核可」）
- **依系統角色顯示導覽項**：平台成員五項，系統管理員（含 Seeder 管理員）多「系統管理」；看不看得到只是顯示，不是授權（sd §權限檢查點）。系統角色被改掉時，側欄在使用者下一次換頁才更新：每次換頁背景重查登入狀態，視窗重新取得焦點不重查（clarification Q11）
- **任務角色來源是單一接縫，本次固定回答「任何任務都沒有任務角色、沒有目前任務」**，不新增後端讀取（clarification Q1）。本次因此只驗收「沒有任務角色」這一支：角色標示讀作「一般使用者」、第三個導覽項讀作「標記作業」、從側欄點它被擋下；需要真實任務角色的 7 條 Scenario 移交 #766
- **擋下時回到落點並顯示一次說明**：在落點頁頂端以既有 Alert 顯示，以 navigation state 帶、不進網址、重新整理後不再出現，文案照 07-01 §進入模組的條件 的註（clarification Q4）。本次驗收「標記作業」回暫時落點那一條；「資料集分析」回任務列表那一條移交 #730
- **暫時落點掛進外殼**：拿掉它的頁首與卡片裡的登出鈕，改由側欄登出（clarification Q2）。導覽項照常連到最終路徑，落點頁還不存在時沿用現行「回暫時落點」，**不新增「建置中」頁**
- **語言切換**：登入後的語言切換在側欄（手機在上方品牌列）；缺翻譯時顯示繁體中文原文（clarification P1）；三個只有單一語言的 aria-label 補齊（P2）
- **外觀切換與外觀偏好**：淺色與深色一鍵切換、記在這台瀏覽器、第一次繪製前就套用（不閃淺色）；「跟隨系統」依作業系統、值無效或從未設定當成跟隨系統；全站每一頁含登入頁、登出後的登入頁都照偏好（clarification Q6）。三選一的完整設定屬 01-04（#727），讀寫同一份偏好
- **快捷鍵總覽**：桌機以 `?` 或入口開啟、手機沒有；只列目前頁面實際可用的快捷鍵，本次只有「全域」一組（clarification Q3）
- **側欄收合**：桌機點側欄空白處收合、記在本機、手機不啟用；另加一顆平時不可見、取得焦點才顯示焦點框的收合控制項作為鍵盤路徑（clarification Q12）
- **登出**：側欄的登出控制項是登入後頁面唯一的登出入口，沿用 `deleteCurrentSession`；`features/auth` 抽出共用的登出邏輯，舊的登出鈕移除
- **三個元件搬到共用元件區**（Issue #720 §驗收條件 第 2 項、`frontend-agent-rules` F5）：`features/auth/language-toggle.tsx`、`features/auth/brand-mark.tsx`、`pages/dev-gallery/theme-toggle.tsx` 搬到 `frontend/src/components/`；外觀切換放 `components/` 是 clarification Q5 的裁定，元件展示頁改用同一個外觀切換並記住選擇。`password-input.tsx` 不搬（Issue #720 留言「備註（來自 #747）」）
- **外殼依 F5 拆層**：畫面放 `components/app-shell/`、規則與狀態放 `features/app-shell/`、組合在 `src/app/`（clarification P6）
- **新增對話框原語**（快捷鍵總覽用），元件展示頁加一個區塊
- **不包含**：通知（移交 #740，本次不畫通知入口，clarification Q7）、工作頁籤的位置（#725）、儀表板行動入口卡不擋（#722）、各導覽項的落點頁本身、外觀三選一的完整設定（#727）、標記清單讀取入口標記那一端（#773）；完整清單見 clarification §移出本次的驗收標準
- **無 BREAKING 變更**：API、資料庫、`openapi.json` 都不變（`api-contract.md`）。改變既有 Requirement 行為的有三項，都是 clarification 的裁定：暫時落點從「沒有側欄、卡片有登出鈕」改為掛進外殼、由側欄登出（Q2）；元件展示頁的外觀切換由「不記住、離開還原淺色」改為記住偏好（Q5）；缺翻譯時由顯示鍵名改為顯示繁中（P1）

## Capabilities

### New Capabilities

- `app-shell-sidebar`：登入後外殼的側欄——導覽項與可見性、角色標示、目前位置、進入模組的條件與擋下、系統管理次選單、語言與外觀切換入口、快捷鍵總覽、登出、側欄收合、不同螢幕寬度的呈現與其邊界情況。來源：規格 07-01 §規格、§卡控機制、§邊界情況、§驗收標準
- `appearance-mode`：外觀模式偏好——淺色、深色、跟隨系統三種值的保存、解讀、預設與無效值處理，以及第一次繪製前套用、全站含登入頁一致。獨立成一個 capability，是因為 01-04 個人設定（#727）會讀寫同一份偏好，不應去改側欄的 spec。來源：規格 07-01 §外觀切換、§資料欄位、Q14、Q21；規格 01-01 §已確認決議 Q16；規格 01-04 §偏好設定

### Modified Capabilities

- `auth-guard`：Requirement「暫時落點顯示目前登入者並提供登出」更名為「暫時落點顯示目前登入者」，改為畫在外殼裡、卡片沒有登出鈕、擋下說明在卡片之上（clarification Q2、Q4）
- `login-session`：Requirement「從這一台登出」的呼叫端由暫時落點的登出鈕改為側欄的登出控制項（clarification Q2）
- `frontend-i18n`：Requirement「介面文字只取自語言檔」加 `appShell` 一組、共用元件的文字放 `common`；Requirement「介面語言預設繁體中文並記住使用者的選擇」的切換位置含側欄，並加入 07-01 的兩條 Scenario；新增「缺少目前語言的文字時顯示繁體中文」（clarification P1）
- `component-gallery`：Requirement「展示頁列出每個宣告的項目」加 Dialog 區塊；Requirement「展示頁切換淺色與深色」移除，改為「展示頁的外觀切換沿用外觀偏好」（clarification Q5；兩個既有 Scenario 與新行為相反，所以以 REMOVED 加 ADDED 表達，見 design D7）

不改：`frontend-routing`（不新增「建置中」頁，clarification Q2）、`permission-authorization`、`role-permission-matrix`（側欄只讀，不讀矩陣，clarification Q10）、`design-token-mapping`（對照層新增的 `--nav-active` 指向既有 token，屬既有 Requirement 的範圍）、`api-envelope`、`date-time-display`、`security-headers`（第一次繪製前的套用在既有 CSP 下運作，design D7）、`e2e-testing`（既有旅程照常成立，只改登出的點擊位置）。

## Impact

- **後端**：無。不新增、不修改端點、模組、資料表、`app/core/` 或 Alembic migration（sd §設計結論、§資料模型異動）；`backend/openapi.json` 應與 `main` 逐位元組相同（`api-contract.md`）
- **前端**：新增 `src/app/app-shell-layout.tsx`、`components/app-shell/`、`features/app-shell/`、`lib/theme.ts`、`public/theme-init.js`、`components/ui/dialog.tsx`；`features/auth` 抽出 `useSignOut()` 並移除 `LogoutButton`；三個元件搬到 `components/`；路由加上外殼 layout 與每條登入後路由的 `navKey`；`lib/i18n` 新增 `appShell` 並改 `fallbackLng`。詳細檔案以 ui §元件樹、design 為準
- **依賴**：不新增套件。對話框原語以既有的 `radix-ui` 建，圖示沿用 `lucide-react`
- **常駐文件**：`docs/diagrams/architecture/frontend-routes.mdx` 已在規劃階段依 Q2、Q5 改好（clarification P4），實作後由實作角色校正。`backend-modules.mdx`、`error-codes.mdx`、`endpoint-authorization.mdx`、`data-table-dictionary.mdx` 不改
- **設計系統**：已在規劃階段完成（clarification Q9）：新增 `design/system/components/brand-mark.md`、`theme-toggle.md`，`lang-toggle.md`、`app-shell.md` 的「程式實作」改指 `frontend/src/components/`，`screen-inventory.md` 補 `shared/app-shell`，`design-gaps.md` 登記 G-66。不改 `design/prototype/`
- **規格書**：已在規劃階段以 `spec-writing` 回寫 07-01（Q19–Q21）與 01-01（Q16）（commit `081721f`）
- **檢查腳本**：`scripts/check-component-reuse.mjs` 不改；本分支在三個元件搬好、`components/app-shell/` 建好之前會失敗，所以 tasks 群組 1 一次做完（tasks 開頭的說明）
- **後續單**：#766 接上任務角色讀取並驗收依任務角色的 7 條；#722、#730 在各自頁頂端放同一個擋下說明；#773 讀取入口標記 `entry=nav`；#728、#729 用角色標示覆寫與次選單；#727 讀寫同一份外觀偏好；#725、#780 把頁籤、工作區、審核三組加進快捷鍵總覽；#740 做通知；#763 驗任務詳情的目前位置
- **Hard Rule 5（任務設定驅動）**：側欄不依任務類型分支；prototype 點「標記作業」帶 `task_type` 的做法依 07-01 Q6 移除，只帶入口標記 `entry=nav`（ui §Prototype 對照）
- **Hard Rule 6（測試集答案不外露）**：側欄碰到的端點只回登入者自己的四個帳號欄位，沒有任務、資料集、樣本或標準答案；擋下說明是固定文案、不帶任務名或任務 ID（sd §權限檢查點、`api-contract.md` §getCurrentSession §欄位遮蔽）
- **規模**：規格 07-01 §驗收標準 72 條，移出 32 條、留 40 條，加上 01-01 的「登入頁沿用已儲存的外觀」，本次驗收 **41** 條（clarification §移出本次的驗收標準）

## 引用的需求來源

| 來源                                              | 章節                                                                                                                                                                                                     |
| :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue #720                                        | §使用情境／功能範圍、§需求目標、§驗收條件；留言「備註（來自 #747）」「更正（來自 #747）」「Ready gate：畫面已核可」                                                                                      |
| PRD `docs/specs/00-prd.mdx`                       | §使用者角色 §角色清單、§權限矩陣「07 共用介面」列與條列；§專案範圍 §範圍內；§Site Map；§模組架構與串接 §模組依賴                                                                                         |
| 規格 07-01 側欄導覽                               | §規格（導覽項目與可見性、目前位置、進入模組的條件、系統管理的次選單、語言切換、外觀切換、快捷鍵總覽、登出、不同螢幕寬度的呈現、側欄收合、資料欄位）、§卡控機制、§邊界情況、§驗收標準、§已確認決議 Q1–Q21 |
| 規格 07-shared 模組索引                           | §Logic Flow 分段一、分段二、缺口二                                                                                                                                                                       |
| 規格 07-02 工作頁籤                               | §關閉與重開 第 1 條、§快捷鍵（移交 #725 的依據）                                                                                                                                                         |
| 規格 07-04 通知事件                               | §兩個消費端、§規格 第 2 條（移交 #740 的依據）                                                                                                                                                           |
| 規格 04-02 標記工作區                             | §決策快捷鍵、§鍵盤快捷鍵（審核組以它為準，clarification Q3）                                                                                                                                             |
| 規格 01-01 登入                                   | §語言切換、§規格（登入頁外觀沿用偏好）、§驗收標準「登入頁沿用已儲存的外觀」、§已確認決議 Q5、Q16                                                                                                         |
| 規格 01-04 個人設定                               | §偏好設定、§已確認決議 Q7、Q18                                                                                                                                                                           |
| 規格 01-05 登入狀態                               | §業務流程「自己登出這一台」、§從這一台登出 第 4 條                                                                                                                                                       |
| 規格 02-01 儀表板                                 | §還沒有任務角色的人看到什麼、§已確認決議 Q2、Q8                                                                                                                                                          |
| 規格 04-01 標記清單                               | §路由上下文與回退 第 10、11 條                                                                                                                                                                           |
| 術語表 `docs/specs/glossary.mdx`                  | `term.system-role`、`term.task-role`、`term.platform-member`、`term.system-admin`、`term.seeder-admin`、`term.appearance-mode`、`term.workspace-tabs`                                                    |
| `docs/development/rules/frontend-agent-rules.mdx` | F1、F4、F5（含例外）                                                                                                                                                                                     |
| ADR-003                                           | D12、D14（任務成員歸 `task` 模組，本次不加讀取的依據）                                                                                                                                                   |
| `clarification.md`                                | Q1–Q14、P1–P7、§移出本次的驗收標準、§交給後續產出                                                                                                                                                        |

## 待決問題

本次沒有待決問題。上游的 sa-1～15、SD-1～6、U1～U11 全部已在 `clarification.md` 決議（Q1–Q14），對照如下：

| 上游題號                                | 決議 |
| :-------------------------------------- | :--- |
| sa-1、sa-2、SD-1、SD-2、SD-3、SD-5、U11 | Q1   |
| sa-3、U1                                | Q2   |
| sa-10、U5                               | Q3   |
| sa-9、U2                                | Q4   |
| sa-11、U3                               | Q5   |
| sa-4、sa-14、U9、U10                    | Q6   |
| sa-5、U8                                | Q7   |
| sa-6、sa-7、sa-8                        | Q8   |
| sa-12、U4                               | Q9   |
| sa-13、SD-6                             | Q10  |
| SD-4                                    | Q11  |
| U6                                      | Q12  |
| U7                                      | Q13  |
| sa-15                                   | Q14  |
