## 驗收：sidebar-nav

結論：**通過**

驗收對象：分支 `feat/sidebar-nav`，HEAD `ff9a2757`（issue #720，PR #792）。驗收日期 2026-11-27，`acceptance-verifier`。

本次驗收 41 條 Scenario：`app-shell-sidebar` 31 條、`appearance-mode` 7 條（含 01-01「登入頁沿用已儲存的外觀」）、`frontend-i18n` ADDED／MODIFIED 中出自 07-01 的 3 條；另核對 `auth-guard`、`login-session`、`frontend-i18n`、`component-gallery` 四份 delta 沿用的既有 Scenario 仍成立。41 條全部通過；clarification §移出本次的驗收標準 的 32 條標為移交，不算失敗。另記一筆規格文字缺陷（缺陷 1，由 `planner` 負責，不擋驗收，但要在 `/opsx:archive` 之前修正）。

### Scenario 結果

證據代號：

- **E2E**：`pnpm --filter e2e test`（完整一輪，真後端加 Vite 開發伺服器，SQLite），**110 passed**，結束碼 0
- **Unit**：`pnpm --filter frontend test`，**700 passed**，結束碼 0
- **API**：用 curl 以真實登入取得的 cookie 打 API（見 §API 驗收）
- **Browser**：驗收者自己寫的 Playwright 腳本，對著另外啟動的後端（8010）與前端（5183）跑，不用 E2E 的 fixture

#### app-shell-sidebar（31 條，全部是 07-01 驗收標準原名）

| Scenario                             | 對應的規格書驗收標準                  | 證據                                                                                                                                                                        | 結果 |
| :----------------------------------- | :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 桌機能完整導覽                       | 07-01「桌機能完整導覽」               | E2E `e2e/app-shell/sidebar.spec.ts`「桌機能完整導覽」；Browser 1280px 截圖                                                                                                  | 通過 |
| 平板能完整導覽                       | 07-01「平板能完整導覽」               | E2E 同檔「平板能完整導覽」（820px）                                                                                                                                         | 通過 |
| 手機能完整導覽                       | 07-01「手機能完整導覽」               | E2E 同檔「手機能完整導覽」（375px）                                                                                                                                         | 通過 |
| 手機底部導覽不遮擋主要操作           | 07-01「手機底部導覽不遮擋主要操作」   | E2E 同檔。註：暫時落點沒有主要操作按鈕（design §Risks），這裡驗的是 `main` 裡最後一個元素落在上下兩條列之間                                                                 | 通過 |
| 語言文字較長時導覽不截斷             | 07-01「語言文字較長時導覽不截斷」     | E2E 同檔（1280px、375px 兩支）；Browser：英文 375px 與 1280px 的文件寬度分別是 375 和 1280，導覽區沒有中文字。註：375px 時英文標籤會在字中間斷行（見 §缺陷 1、§驗收觀察 1） | 通過 |
| 平台成員看不到系統管理               | 07-01 同名                            | E2E；Unit `app-shell.test.tsx`                                                                                                                                              | 通過 |
| 系統管理員看到系統管理               | 07-01 同名                            | E2E（自建的 `super_admin` 帳號）；Browser：**Seeder 管理員**（`create_seeder` 建立）登入後看到六項，順序正確                                                                | 通過 |
| 角色被改掉時側欄不立刻變             | 07-01 同名                            | E2E（`setRole` 直接改 DB；`blur`／`focus` 之後 0 次查詢，點「任務管理」之後恰好 1 次查詢，剩五項）；Browser：`focus` 階段 0 次請求                                          | 通過 |
| 沒有任務角色時角色標示讀作一般使用者 | 07-01 同名（前提依 clarification Q1） | E2E；Unit                                                                                                                                                                   | 通過 |
| 角色標示切換語言後也換               | 07-01 同名                            | E2E                                                                                                                                                                         | 通過 |
| 每頁只有一個目前位置                 | 07-01 同名                            | E2E（收合前後都恰好一個 `aria-current="page"`）；Unit                                                                                                                       | 通過 |
| 沒有任務角色時點擊標記作業           | 07-01 同名                            | E2E（`href` 是 `/annotation/annotation-list?entry=nav`，點了之後網址沒有 query string，說明在卡片上方，重新整理後消失）；Browser：擋下時 0 次 API 請求                      | 通過 |
| 展開系統管理次選單                   | 07-01 同名                            | E2E；Unit                                                                                                                                                                   | 通過 |
| 按 Esc 關閉系統管理次選單            | 07-01 同名                            | E2E；Unit                                                                                                                                                                   | 通過 |
| 切換語言後整頁一起換                 | 07-01 同名                            | E2E（導覽項、h1、`Switch to … mode`、`Keyboard shortcuts`、`Sign out`、`Main navigation`、`Global tools`、`Go to Profile`）                                                 | 通過 |
| 切換外觀立即生效                     | 07-01 同名                            | E2E                                                                                                                                                                         | 通過 |
| 桌機開啟快捷鍵總覽                   | 07-01 同名                            | E2E；Browser：點總覽外面會關閉，焦點回到「快捷鍵」，關閉鈕叫「關閉快捷鍵」                                                                                                  | 通過 |
| 手機沒有快捷鍵總覽入口               | 07-01 同名                            | E2E；Browser：英文 375px 只有 `EN, Switch language`、`Switch to dark mode`、`Sign out` 三個按鈕                                                                             | 通過 |
| 手機按問號不開啟快捷鍵總覽           | 07-01 同名                            | E2E                                                                                                                                                                         | 通過 |
| 快捷鍵總覽只列目前頁面可用的         | 07-01 同名（規格書回寫後新增）        | E2E                                                                                                                                                                         | 通過 |
| 登出後回到登入頁                     | 07-01 同名                            | E2E（用舊 cookie 打 `GET /current-session` 回 401 `AUTH_REQUIRED`）；API                                                                                                    | 通過 |
| 等待中的操作顯示進行中               | 07-01 同名                            | E2E（`DELETE` 被擋住時 `aria-busy="true"`、看得到 spinner，連點兩下只送 1 次）                                                                                              | 通過 |
| 點擊側欄空白區收合                   | 07-01 同名                            | E2E；Unit                                                                                                                                                                   | 通過 |
| 點擊導覽連結不會收合                 | 07-01 同名                            | E2E；Unit                                                                                                                                                                   | 通過 |
| 點擊登出不會收合                     | 07-01 同名                            | E2E；Unit                                                                                                                                                                   | 通過 |
| 重新整理後收合狀態保持               | 07-01 同名                            | E2E                                                                                                                                                                         | 通過 |
| 手機不啟用收合                       | 07-01 同名                            | E2E（記住的值保持 `true`，畫面仍顯示五個標籤）                                                                                                                              | 通過 |
| 側欄收合後快捷鍵入口隱藏             | 07-01 同名                            | E2E（收合前後都沒有通知入口）；Unit                                                                                                                                         | 通過 |
| 用鍵盤走過側欄所有控制項             | 07-01 同名                            | E2E（14 個控制項的順序與可存取名稱都對，焦點框的 `box-shadow` 不是 `none`，Enter 之後名稱變成「展開側欄」）                                                                 | 通過 |
| 關閉動態效果時不播動畫               | 07-01 同名                            | E2E（側欄、次選單連結的 `transition-duration` 都是 `0s`）；Browser：次選單容器、快捷鍵對話框與遮罩的 `transition`／`animation` 都是 `0s`／`none`                            | 通過 |
| 錯誤訊息不出現系統內部資訊           | 07-01 同名                            | E2E（`page.route` 讓查詢回 500 `INTERNAL_ERROR`／`trace-abc`，畫面上找不到這兩個字串，也找不到端點路徑）                                                                    | 通過 |

#### appearance-mode（7 條）

| Scenario               | 對應的規格書驗收標準           | 證據                                                                                            | 結果 |
| :--------------------- | :----------------------------- | :---------------------------------------------------------------------------------------------- | :--- |
| 重新整理後外觀保持     | 07-01 同名                     | E2E `e2e/app-shell/appearance.spec.ts`；Unit `lib/theme`                                        | 通過 |
| 外觀設定值無效         | 07-01 同名                     | E2E（`sepia`、空字串、`DARK`）；Unit 案例表同時跑 `lib/theme.ts` 與 `theme-init.js`             | 通過 |
| 從來沒設定過外觀       | 07-01 同名                     | E2E；Unit                                                                                       | 通過 |
| 跟隨系統依作業系統呈現 | 07-01 同名                     | E2E（`emulateMedia` 在頁面開著時切換）；Unit                                                    | 通過 |
| 重新整理時不閃淺色     | 07-01 同名                     | E2E（`addInitScript` 記下每次 `data-theme` 變動與第一個 frame 的值）                            | 通過 |
| 登出後登入頁沿用外觀   | 07-01 同名（規格書回寫後新增） | E2E；Browser：登出後登入頁的 `data-theme=dark`，`label-suite-theme` 仍是 `dark`（登出不會清掉） | 通過 |
| 登入頁沿用已儲存的外觀 | 01-01 同名（規格書回寫後新增） | E2E                                                                                             | 通過 |

`frontend/dist/index.html` 用 `<script src="/theme-init.js">` 載入，輸出根目錄有 `theme-init.js`，沒有內嵌腳本，CSP 沒有放寬。

#### frontend-i18n（出自 07-01 的 3 條）

| Scenario                   | 對應的規格書驗收標準                          | 證據                                                                                                                                                                                                       | 結果 |
| :------------------------- | :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 第一次登入預設繁體中文     | 07-01 同名                                    | E2E「第一次登入預設繁體中文 / 重新整理後語言保持」（瀏覽器 context 設 `en-US`）                                                                                                                            | 通過 |
| 重新整理後語言保持         | 07-01 同名                                    | 同上                                                                                                                                                                                                       | 通過 |
| 術語缺少翻譯時顯示備用文字 | 07-01 §邊界情況「某個名詞缺少目前語言的文字」 | Unit：`src/lib/i18n/index.test.ts` 的 "shows the Traditional Chinese text, never the key name"、`src/components/app-shell/app-shell.test.tsx`。E2E 沒辦法移除語言檔的鍵，依 tasks 4.4 以 unit 測試作為證據 | 通過 |

#### delta 沿用的既有 Scenario（回歸）

| Capability                                           | Scenario                                                                                                                                                                                                                                                               | 證據                                                                                                                                                                                                        | 結果 |
| :--------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| auth-guard（MODIFIED「暫時落點顯示目前登入者」）     | 平台成員看到自己的身分、系統管理員看到系統管理員、落點的瀏覽器標題                                                                                                                                                                                                     | E2E `e2e/dashboard/dashboard.spec.ts`；Unit `dashboard-placeholder-page.test.tsx`、`app-shell-layout.test.tsx`                                                                                              | 通過 |
| login-session（MODIFIED「從這一台登出」）            | 從這一台登出只影響這一台、登出不影響其他裝置、登入狀態已經不能驗證時登出、登出失敗時畫面仍回到登入頁                                                                                                                                                                   | E2E `dashboard.spec.ts`；API（未登入時 `DELETE` 回 204，三個 cookie 都清掉；登出後 DB 的 `logged_out_at` 有寫入，另一個帳號的 session 不受影響）；Unit `use-sign-out.test.tsx`                              | 通過 |
| frontend-i18n（MODIFIED 兩條 Requirement 的 11 條）  | 兩份語言檔的鍵集一致、語言檔缺鍵時測試失敗、開發頁的語言檔不進正式建置、開發頁載入後才有該頁的文字、第一次來的人看到繁體中文、記住的語言值無效時用繁體中文、切換後的語言跨頁沿用、重新開啟後沿用記住的語言、開發頁沒有語言切換控制項但沿用記住的語言（另外兩條見上表） | Unit `locales.test.ts`、`index.test.ts`；E2E `login-page.spec.ts`、`dashboard.spec.ts`、`dev-pages.spec.ts`；Build：`frontend/dist` 找得到「一般使用者」，找不到 `DEV ONLY`、「系統健康檢查」、「元件展示」 | 通過 |
| component-gallery（MODIFIED 6 條、ADDED 4 條）       | 每個宣告的 variant 都在頁面上、新原語各有一個區塊、完整性測試擋下漏寫的 variant、新增原語沒放進展示頁時測試失敗、原語的測試檔不算原語、展示頁不顯示測試示意；元件展示頁切換淺色與深色、重新整理後沿用外觀偏好、離開展示頁不還原外觀、鍵盤可以切換主題                  | Unit `completeness.test.tsx`、`dev-gallery-page.test.tsx`、`router.test.tsx`                                                                                                                                | 通過 |
| component-gallery（REMOVED「展示頁切換淺色與深色」） | 舊的 `pages/dev-gallery/theme-toggle.tsx` 與 `devGallery` 的 `theme.*` 鍵已刪除                                                                                                                                                                                        | Unit `locales.test.ts`："no longer keeps the gallery's own theme switch text"                                                                                                                               | 通過 |

#### 移出本次的 32 條（移交，不算失敗）

| 規格頁 | Scenario                             | 狀態                          |
| :----- | :----------------------------------- | :---------------------------- |
| 07-01  | 審核員看到審核作業                   | clarification 移出，交給 #766 |
| 07-01  | 專案負責人看到例外處置               | clarification 移出，交給 #766 |
| 07-01  | 標記員看到標記作業                   | clarification 移出，交給 #766 |
| 07-01  | 標記員的角色標示讀作標記員           | clarification 移出，交給 #766 |
| 07-01  | 在別的任務有角色時點擊標記作業       | clarification 移出，交給 #766 |
| 07-01  | 專案負責人進得去標記作業             | clarification 移出，交給 #766 |
| 07-01  | 只當專案負責人的人看到例外處置       | clarification 移出，交給 #766 |
| 07-01  | 點標記作業進到的是清單頁             | clarification 移出，交給 #773 |
| 07-01  | 沒有任務角色時點擊資料集分析         | clarification 移出，交給 #730 |
| 07-01  | 系統管理頁的角色標示不被任務角色蓋掉 | clarification 移出，交給 #728 |
| 07-01  | 在任務詳情頁時任務管理是目前位置     | clarification 移出，交給 #763 |
| 07-01  | 在角色設定頁時系統管理是目前位置     | clarification 移出，交給 #729 |
| 07-01  | 展開系統管理次選單直達角色設定       | clarification 移出，交給 #729 |
| 07-01  | 手機點擊系統管理直接進入使用者管理   | clarification 移出，交給 #728 |
| 07-01  | 側欄收合後點擊系統管理               | clarification 移出，交給 #728 |
| 07-01  | 換頁後語言保持                       | clarification 移出，交給 #730 |
| 07-01  | 換頁後收合狀態保持                   | clarification 移出，交給 #730 |
| 07-01  | 從儀表板行動入口卡進入不被擋下       | clarification 移出，交給 #722 |
| 07-01  | 有操作者的通知顯示四件事             | clarification 移出，交給 #740 |
| 07-01  | 沒有操作者的通知少一行               | clarification 移出，交給 #740 |
| 07-01  | 沒有未讀通知                         | clarification 移出，交給 #740 |
| 07-01  | 未讀通知數超過九                     | clarification 移出，交給 #740 |
| 07-01  | 全部標為已讀                         | clarification 移出，交給 #740 |
| 07-01  | 載入通知失敗                         | clarification 移出，交給 #740 |
| 07-01  | 快捷鍵總覽不合併動作                 | clarification 移出，交給 #780 |
| 07-01  | 快捷鍵總覽沒有整批審核               | clarification 移出，交給 #780 |
| 07-01  | 快捷鍵總覽有頁籤那一組               | clarification 移出，交給 #725 |
| 07-01  | 關閉作用中的頁籤後焦點移動           | clarification 移出，交給 #725 |
| 07-01  | 關閉最右側的作用中頁籤後焦點移動     | clarification 移出，交給 #725 |
| 07-01  | 關閉非作用中的頁籤不動焦點           | clarification 移出，交給 #725 |
| 07-01  | 關閉後沒有任何工作頁籤               | clarification 移出，交給 #725 |
| 07-01  | 展開系統管理次選單點使用者管理       | clarification 移出，交給 #728 |

**名稱對照**：從 `docs/specs/07-shared/01-sidebar.mdx` §驗收標準 抽出 72 個名稱，和本次 delta 的 Scenario 名稱加上上表 32 條逐一比對，沒有漏掉的，也沒有多出來的（40 加 32 等於 72）。另外一條「登入頁沿用已儲存的外觀」在 `docs/specs/01-account/01-login.mdx` 也找得到。

**spec 沒寫、但實作出現的行為**：沒有發現。

### Decision Table

本次任務成員身分只有「任何任務都沒有角色」這一種（clarification Q1；其他分支已移交 #766，`sidebar-nav-model.test.ts` 以表格測試先把真值表鎖住）。

| #   | 系統角色                  | 任務成員身分 | 動作                      | 資料狀態／寬度                            | 輸入                                                                            | 預期                                                                | 驗證方式                                             | 結果 |
| :-- | :------------------------ | :----------- | :------------------------ | :---------------------------------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------ | :--------------------------------------------------- | :--- |
| 1   | `user`                    | 無           | 開啟落點                  | 1280／820／375                            | —                                                                               | 五項，沒有「系統管理」                                              | E2E 自動                                             | 通過 |
| 2   | `super_admin`（自建）     | 無           | 開啟落點                  | 1280                                      | —                                                                               | 六項                                                                | E2E 自動                                             | 通過 |
| 3   | `super_admin`（Seeder）   | 無           | 開啟落點                  | 1280                                      | —                                                                               | 六項，角色標示「一般使用者」                                        | Browser 手動腳本                                     | 通過 |
| 4   | `super_admin` 改成 `user` | 無           | 視窗失焦後再取得焦點      | 已開著                                    | —                                                                               | 仍是六項，0 次查詢                                                  | E2E 自動                                             | 通過 |
| 5   | `super_admin` 改成 `user` | 無           | 點「任務管理」            | 已開著                                    | —                                                                               | 五項，恰好 1 次查詢                                                 | E2E 自動                                             | 通過 |
| 6   | `user`                    | 無           | 點「標記作業」            | 落點                                      | 一般點擊                                                                        | 擋下，說明顯示一次，網址沒有 query                                  | E2E 自動                                             | 通過 |
| 7   | `user`                    | 無           | 擋下後重新整理            | 落點                                      | —                                                                               | 說明不再出現                                                        | E2E 自動；Unit（上一頁／下一頁、換語言、StrictMode） | 通過 |
| 8   | `super_admin`             | 無           | 點「系統管理」            | 1280，展開                                | 點擊／`Esc`／點外面                                                             | 展開成兩個連結；`Esc` 收起並把焦點還回去；點外面也收起              | E2E 與 Unit 自動                                     | 通過 |
| 9   | `super_admin`             | 無           | 點「系統管理」            | 已收合                                    | —                                                                               | 直接連到 `/admin/user-management`，不展開                           | Unit 自動                                            | 通過 |
| 10  | 任一                      | 無           | 按 `?`                    | 1280／375                                 | 焦點在連結上、焦點在輸入框裡                                                    | 1280：開啟；375：不開；在輸入框裡：不開                             | E2E 與 Unit 自動                                     | 通過 |
| 11  | 任一                      | 無           | 收合                      | 1280／375                                 | `labelsuite.sidebarCollapsed` 為 `true`、無效值、缺值                           | 1280 依記住的值；375 一律展開且不改寫記住的值；無效值或缺值當成展開 | E2E 與 Unit 自動                                     | 通過 |
| 12  | 任一／未登入              | —            | 載入頁面                  | 作業系統深色或淺色                        | `label-suite-theme` 為 `light`／`dark`／`system`／缺值／`sepia`／空字串／`DARK` | 依規則解析，沒有閃爍，也沒有錯誤                                    | E2E 與 Unit（同一張案例表同時跑兩份實作）            | 通過 |
| 13  | 任一                      | —            | 切換語言                  | —                                         | 記住的值為 `zh-TW`／`en`／`ja`／空字串／`EN-us`／缺值                           | 只有 `en` 是英文，其他都是 `zh-TW`                                  | E2E 與 Unit 自動                                     | 通過 |
| 14  | 任一                      | —            | 登出                      | 正常、回應很慢、沒有回應                  | 連點                                                                            | 只送 1 次 `DELETE`，`aria-busy`，一律回到登入頁                     | E2E 自動                                             | 通過 |
| 15  | 已登入                    | —            | 換頁時重查                | 查詢回 500                                | `INTERNAL_ERROR`／`trace-abc`                                                   | 回到登入頁，畫面沒有內部資訊                                        | E2E 自動                                             | 通過 |
| 16  | 未登入                    | —            | `GET /current-session`    | 沒有 cookie                               | —                                                                               | 401 `AUTH_REQUIRED`                                                 | API 手動                                             | 通過 |
| 17  | 登入狀態已失效            | —            | `GET /current-session`    | 登出後拿舊 cookie；竄改過的 JWT           | —                                                                               | 401 `AUTH_REQUIRED`，原因不同但回應相同                             | API 手動                                             | 通過 |
| 18  | `user`                    | —            | `GET /current-session`    | 只帶 `Authorization: Bearer`，沒帶 cookie | —                                                                               | 401（不讀標頭）                                                     | API 手動                                             | 通過 |
| 19  | 未登入                    | —            | `DELETE /current-session` | 沒有 cookie                               | —                                                                               | 204，沒有 body，清掉三個 cookie，DB 沒寫入                          | API 手動                                             | 通過 |

### API 驗收（真實 HTTP，走真實登入）

本次沒有 API 變更。為了確認側欄沿用的端點行為沒變，以 `POST /api/v1/sessions` 真實登入三個帳號，再用 curl 依序呼叫：

- `GET /api/v1/current-session`：平台成員、系統管理員、Seeder 都回 200，`data` 只有 `user` 一個鍵，裡面只有 `id,name,email,role` 四欄，`role` 分別是 `user`、`super_admin`、`super_admin`。沒有任務、資料集、樣本或答案相關欄位。未登入、竄改過的 cookie、登出後的舊 cookie 都回 401 `AUTH_REQUIRED`，錯誤外層不含堆疊或路徑；`Accept-Language: en` 時 `message` 是英文
- `DELETE /api/v1/current-session`：有 cookie 和沒 cookie 都回 204，body 長度 0，三個 `Set-Cookie` 清除標頭相同。有 cookie 時該 session 寫入 `revoked_at` 與 `logged_out_at`，另一台（系統管理員那一段）的 `revoked_at` 仍是 null，之後查詢仍回 200
- cookie：`__Host-ls_at`、`__Host-ls_rt` 是 `HttpOnly; Secure; SameSite=lax; Path=/`；`__Host-ls_csrf` 不是 httpOnly（設計如此）
- **端點授權與常駐文件一致**：`docs/diagrams/architecture/endpoint-authorization.mdx` 的 `getCurrentSession`、`deleteCurrentSession` 兩列（第 48、50 行）和實測相同；本分支沒有改動這份文件
- 404 對 403：本次沒有任何新增的「看不到的資源」，不適用
- 寫入端點：本次只用到 `DELETE`，已逐欄查 DB 核對（見上）
- 用錯 method：`POST /current-session` 沒帶 CSRF token 時先回 403 `CSRF_FAILED`，帶了 token 才回 405 `METHOD_NOT_ALLOWED`。這是 `main` 上本來就有的中介層順序，本次沒有改到，不列為缺陷

### Hard Rule 必驗項

| 規則               | 怎麼驗的                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 結果 |
| :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 5 任務設定驅動     | 本次的路徑沒有任務設定可以換（沒有任務、沒有 `input_type`／`outputs[]`）。改用靜態加行為驗證：在 `frontend/src/components/app-shell`、`features/app-shell`、`app/`、`lib/theme.ts` 搜尋 `task_type`、`input_type`、`outputs` 等字串，非測試檔一個都沒有；`sidebar-nav-model.ts` 只依「任務角色」分支，不依任務類型；「標記作業」的連結固定是 `/annotation/annotation-list?entry=nav`，E2E 也斷言不含 `task_type` 或任務識別                                     | 通過 |
| 6 測試集答案不外露 | 以平台成員（本次唯一有的成員身分，沒有標記員）登入，走完：登入頁 → 落點 → 點「標記作業」被擋 → 點「任務管理」→ 重新整理 → 視窗失焦後再取得焦點。全程只打了 `current-session`、`session-refreshes`、`auth-options`、`sessions` 四個端點，回應 body 用 `ground_truth`／`answer`／`test_set`／`task_id`／`dataset` 搜尋都沒有命中；擋下說明是固定文案，不帶任務名稱或 ID；`localStorage` 與 `sessionStorage` 都是空的，`document.cookie` 只看得到 `__Host-ls_csrf` | 通過 |

### 前端驗收補充

- **token 不在前端**：E2E「the browser holds no token, sends cookies with every API call, and gets no errors」通過；Browser 腳本另外核對 `localStorage`、`sessionStorage` 都是空的，`document.cookie` 讀不到 `ls_at`／`ls_rt`
- **請求**：登入之後擋下的點擊送 0 次請求，換頁送 1 次 `GET /current-session`，視窗失焦後再取得焦點送 0 次，沒有重複。開發模式下頁面載入或重新整理時，第一份守門查詢會被 StrictMode 中止（`net::ERR_ABORTED`），未登入時 401 會被 Chrome 記成 console error。這兩件事在 `main` 上就有，design D6 也有記錄，E2E 以相同規則排除，不是這次引入的
- **四種狀態**：這個 change 的畫面沒有列表或 loading／empty 狀態；error 以「錯誤訊息不出現系統內部資訊」驗過；無權限以「平台成員看不到系統管理」與擋下說明驗過
- **遮蔽欄位**：本次沒有依角色遮蔽的欄位（api-contract §欄位遮蔽）

### DoD

| 項目                  | 指令                                                                                                                                                                 | 結果                                                                         |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------- |
| 41 條 Scenario        | 見上                                                                                                                                                                 | 通過                                                                         |
| Decision Table        | 見上，19 列                                                                                                                                                          | 通過                                                                         |
| 前端 lint             | `pnpm --filter frontend lint`                                                                                                                                        | 通過（exit 0）                                                               |
| 前端型別              | `pnpm --filter frontend typecheck`                                                                                                                                   | 通過（exit 0）                                                               |
| 前端測試              | `pnpm --filter frontend test`                                                                                                                                        | 通過，700 passed                                                             |
| 前端建置              | `pnpm --filter frontend build`                                                                                                                                       | 通過；`dist/theme-init.js` 存在，`index.html` 以 `src="/theme-init.js"` 引用 |
| 後端測試              | `cd backend && uv run pytest -q`（沒有 `DATABASE_URL`）                                                                                                              | 通過，1171 passed、4 skipped                                                 |
| E2E 靜態檢查          | `pnpm --filter e2e test:static`                                                                                                                                      | 通過，12 pass／0 fail                                                        |
| E2E 全部旅程          | `pnpm --filter e2e test`                                                                                                                                             | 通過，110 passed                                                             |
| 元件重用              | `node scripts/check-component-reuse.mjs`                                                                                                                             | 通過，0 個 FAIL                                                              |
| 規格站檢查            | `pnpm check:specs`                                                                                                                                                   | 通過，`check-specs: docs OK`                                                 |
| scripts 測試          | `pnpm test:scripts`                                                                                                                                                  | 通過（exit 0）                                                               |
| OpenSpec              | `pnpm exec openspec validate sidebar-nav --strict`                                                                                                                   | 通過，`Change 'sidebar-nav' is valid`                                        |
| 後端契約漂移          | `cd backend && uv run python -m app.scripts.export_openapi && git diff --exit-code -- openapi.json ../docs/diagrams/architecture/api.openapi.json` 加 porcelain 檢查 | 通過，沒有差異                                                               |
| 前端契約漂移          | `pnpm --filter frontend api:generate && git diff --exit-code -- frontend/src/api/generated` 加 porcelain 檢查                                                        | 通過，沒有差異                                                               |
| 與 `main` 比對        | `git diff --exit-code $(git merge-base origin/main HEAD) -- backend/openapi.json docs/diagrams/architecture/api.openapi.json frontend/src/api/generated`             | 通過，三處逐位元組相同，和 `api-contract.md`「本次無 API 變更」一致          |
| Alembic（SQLite）     | 新的 `SQLITE_PATH`，`upgrade head` → `downgrade base` → `upgrade head`                                                                                               | 通過（本次沒有新 migration，跑的是既有鏈）                                   |
| Alembic（PostgreSQL） | `docker run postgres:16-alpine`，`DATABASE_URL=postgresql+asyncpg://…@localhost:55432/…`，`upgrade head` → `downgrade base` → `upgrade head`                         | 通過，跑完後容器已停                                                         |
| 後端、前端都能啟動    | 後端 uvicorn（8010）`/api/v1/health` 回 `database: ok`；前端 Vite（5183）回 200                                                                                      | 通過                                                                         |
| 文件站建置            | 依 tasks 的規定不在 worktree 跑 `notecraftapp build`，以 CI `docs-site` job 為準                                                                                     | **沒有在本地驗證**，交給 CI                                                  |
| 受影響文件            | `frontend-routes.mdx` 已依實作校正（tasks 3.6）；`endpoint-authorization.mdx`、`error-codes.mdx` 不需要改                                                            | 通過                                                                         |
| 工作區                | 跑完全部指令後 `git status --porcelain` 是空的                                                                                                                       | 通過                                                                         |

### 人工驗收步驟（留作紀錄）

1. **啟動**（Lite 層，**不要**設 `DATABASE_URL`；以下在 repo 根目錄執行）

   ```bash
   # 一次性：建立資料庫與帳號
   cd backend
   export SQLITE_PATH="$PWD/data/manual-720.db"
   uv run alembic upgrade head
   printf '%s\n' '<你自己的 Seeder 密碼>' | uv run python -m app.scripts.create_seeder \
     --email seeder@example.com --name "Seeder 管理員" --password-stdin
   # 平台成員與第二個系統管理員（目前還沒有使用者管理頁，只能用 e2e 的 helper 寫入，走的是真實的 argon2id 雜湊）
   printf '%s\n' '<成員密碼>' | PYTHONPATH="$PWD" uv run python ../e2e/shared/account_db.py add \
     --email user@example.com --name 王小明
   printf '%s\n' '<管理員密碼>' | PYTHONPATH="$PWD" uv run python ../e2e/shared/account_db.py add \
     --email admin@example.com --name 管理員 --role super_admin

   # 後端（終端機 1）：http://localhost:8000
   SQLITE_PATH="$PWD/data/manual-720.db" CORS_ALLOWED_ORIGINS=http://localhost:5173 \
     uv run uvicorn app.main:create_app --factory --host localhost --port 8000

   # 前端（終端機 2，repo 根目錄）：http://localhost:5173
   VITE_API_BASE_URL=http://localhost:8000 pnpm --filter frontend dev --host localhost --port 5173
   ```

   確認後端：瀏覽器開 `http://localhost:8000/api/v1/health`，看到 `"database":"ok"`。前端：`http://localhost:5173/account/login`。密碼由執行的人自己決定（至少 8 碼，要有大寫、小寫和數字），不寫進 repo。

2. **用什麼身分登入**
   - 平台成員：`user@example.com`（王小明），密碼是上面 `<成員密碼>`
   - 系統管理員：`admin@example.com`（管理員），或 Seeder `seeder@example.com`，密碼是自己設的那組
   - 本次沒有標記員、審核員、專案負責人（任務成員要等 #766）

3. **要點開哪幾個畫面**
   - `http://localhost:5173/account/login` → 登入 → 自動到 `/dashboard/dashboard`
   - 用 DevTools 的裝置模式切換寬度：1280、820、375（iPhone SE）
   - `http://localhost:5173/dev/gallery`、`http://localhost:5173/dev/health`（外觀沿用）

4. **每一步預期看到什麼**
   - **平台成員，1280px，中文**：左側固定側欄，從上到下是「Label Suite」品牌和「ZH」語言鈕；接著是「儀表板／任務管理／標記作業／資料集分析／個人設定」五項，「儀表板」字比較粗而且有底色；底部是兩顆圖示鈕（鍵盤是快捷鍵，月亮是外觀）；最下面是頭像「王」、名字「王小明」、角色標示「一般使用者」（**不是**「平台成員」），旁邊是登出圖示。右邊的卡片寫「你已登入」、「王小明（user@example.com）」、膠囊「平台成員」、「儀表板還在建置中…」，**卡片裡沒有登出鈕**
   - **系統管理員**：多一項「系統管理」，排在「資料集分析」和「個人設定」之間。點它展開「使用者管理」「角色設定」，再按 `Esc` 收起，焦點框回到「系統管理」
   - **點「標記作業」**（平台成員）：網址停在 `/dashboard/dashboard`（沒有 `?`），卡片上方出現藍色提示「你目前在任何任務都沒有標記或審核角色，所以還不能進入標記作業。」；按 F5 之後提示消失
   - **點「任務管理」**：那一頁還沒做，所以會回到 `/dashboard/dashboard`，側欄不會閃
   - **按 `?`**（1280px，先點一下頁面空白處）：跳出「目前頁面可用快捷鍵」，只有「全域」一組兩列：`?` 開啟快捷鍵總覽、`Esc` 關閉視窗或取消選取。按 `Esc` 關閉
   - **點側欄中間的空白處**：側欄縮成只剩圖示（寬 88px），語言鈕、快捷鍵鈕、名字都不見，月亮和登出還在。F5 之後仍是收合；再點空白處展開
   - **月亮圖示**：整頁立刻變深色，滑鼠移上去提示變成「切換為淺色模式」；F5 之後仍是深色，而且**沒有先閃一下白色**；登出之後登入頁也是深色
   - **英文、375px（手機）**：點「ZH」切到「EN」。上方是品牌列：「Label Suite」、「EN」、月亮、登出，**沒有名字、沒有鍵盤圖示**。下方主導覽是五項（系統管理員六項）：Dashboard、Task Management、Annotation、Dataset Analytics、（System Administration）、Profile，每一項的字都完整出現、沒有「…」，但長字會**在字中間斷行**（例如「Dashboar／d」、「Annotatio／n」），這是 clarification Q13 續決接受的做法。整頁不能左右捲動，卡片最下面那行字沒有被下方導覽蓋住
   - **英文、1280px**：導覽項是 Dashboard、Task Management、Annotation、Dataset Analytics、System Administration、Profile，每一項一行；角色標示是「General user」；側欄和導覽裡除了名字「管理員」之外沒有中文

5. **刻意要試的失敗路徑**
   - **角色被改掉**：系統管理員開著落點時，在另一個終端機跑 `PYTHONPATH="$PWD" SQLITE_PATH=… uv run python ../e2e/shared/account_db.py set --email admin@example.com --role user`（在 `backend/`）。切到別的視窗再切回來，側欄**仍是六項**；點「任務管理」之後只剩五項
   - **登出請求沒回應**：DevTools → Network → Offline，點登出，仍會回到 `/account/login`
   - **舊 cookie**：登出後按瀏覽器的上一頁，不會回到「你已登入」的卡片
   - **手機按 `?`**：375px 時按 `?`，什麼都不會跳出來
   - **無效的外觀值**：DevTools Console 跑 `localStorage.setItem('label-suite-theme','sepia')` 後 F5，畫面依作業系統深淺呈現，沒有錯誤訊息
   - **系統管理員的網址**：本次沒有 `/admin/*` 頁面，平台成員直接開 `/admin/user-management` 會回到落點（`*` 路由的既有行為），不會看到任何管理內容

6. **收尾**：兩個終端機各按 Ctrl+C；刪掉 `backend/data/manual-720.db`（這個檔案已被 `.gitignore` 排除）；`localStorage` 裡的 `label-suite-theme`、`labelsuite.sidebarCollapsed` 與語言設定只在這台瀏覽器，不必清，要清就在 DevTools → Application → Local Storage 刪除。

### 驗收觀察（不是缺陷，留給抽查）

1. 英文 375px 的主導覽會在字中間斷行（「Dashboar／d」、「Managem／ent」、「Annotatio／n」）。規格書 07-01 的驗收標準是「文字仍然看得懂，沒有被截斷到無法辨識」，Scenario 的量測條件（內容寬度不大於可見寬度、沒有省略號、文件不比視窗寬）都成立，clarification Q13 續決也寫了「必要時字中斷行」，所以判定通過。截圖（只放在本機 scratchpad，不進 repo）：`720-en-375.png`
2. E2E「系統管理員看到系統管理」用的是自建的 `super_admin` 帳號，不是 Scenario 寫的 Seeder 管理員。驗收時另外用 `create_seeder` 建立的 Seeder 帳號，以瀏覽器確認同樣是六項

### 缺陷

1. **delta Requirement 的文字沒有跟上 Q13 續決**
   - 對應 Scenario：「語言文字較長時導覽不截斷」（Scenario 本身通過）
   - 預期／實際：`specs/app-shell-sidebar/spec.md` 的 Requirement「語言文字較長時導覽不截斷」寫的是「寬度 768px 以上允許換行」，讀起來像是 767px 以下不允許換行。但 commit `51ce4f2a` 已經把 clarification Q13 續決、design D14、design gap G-66 都改成「手機主導覽的文字允許換行（必要時字中斷行）」，實作也這樣做。`/opsx:archive` 會把這句同步進 `openspec/specs/app-shell-sidebar/spec.md`，主規格就會留下和實作、決議互相矛盾的文字
   - 重現步驟：`grep -n '允許換行' openspec/changes/sidebar-nav/specs/app-shell-sidebar/spec.md openspec/changes/sidebar-nav/design.md openspec/changes/sidebar-nav/clarification.md`，比對三處的說法；再以英文、375px 開 `/dashboard/dashboard`，看下方主導覽的換行
   - 負責角色：`planner`（只改 delta 這一句的文字，例如改成「每一種寬度都允許換行，767px 以下必要時可在字中斷行」；不需要改程式）。嚴重度：不擋驗收結論，但要在 `ops` 執行 `/opsx:archive` 之前修正
