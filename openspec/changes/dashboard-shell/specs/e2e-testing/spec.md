# Spec Delta

## MODIFIED Requirements

### Requirement: 登入到落點再登出的旅程

e2e SHALL 有一條旅程：在前端開發伺服器以初始化指令建立的帳號，從登入頁用 Email 與密碼登入，到達儀表板看到系統管理員的版面，再從這一台登出回到登入頁。帳號 MUST 由初始化指令在旅程開始前建立，密碼 MUST NOT 寫在 `e2e/shared/fixtures/` 的資料檔裡；旅程不連真的 Google。

來源：規格 01-01 Scenario「登入成功進入儀表板」「已登入的人開登入頁直接進儀表板」；規格 01-05 Scenario「從這一台登出只影響這一台」；規格 02-01 §這一頁顯示哪一種版面 第 1、6 條、Scenario「系統管理員的平台使用者統計」；testing-agent-rules T1、T6、T8；ADR-007 D1；主規格 `user-management`「Seeder 管理員只能由初始化指令建立」；Issue #719 落點確認；dashboard-shell clarification「交給後續產出」（暫時落點由儀表板取代，初始化指令建立的是系統管理員）。

#### Scenario: 登入、到落點、再登出

- **WHEN** e2e 起後端（SQLite 暫存檔）與前端開發伺服器，旅程以初始化指令建立的帳號開啟 `/`
- **THEN** 網址變成 `/account/login`；填入 Email 與密碼並點「登入」後，網址變成 `/dashboard/dashboard`，頁面的一級標題是「儀表板」，並有「平台使用者統計」區塊
- **AND** 再開啟 `/account/login` 時網址變回 `/dashboard/dashboard`
- **AND** 點「登出」後網址變成 `/account/login`，再開啟 `/dashboard/dashboard` 時被帶回 `/account/login`

#### Scenario: 帳密錯誤停在登入頁

- **WHEN** 旅程在登入頁以同一個 Email 與錯誤的密碼送出
- **THEN** 頁面顯示「帳號或密碼錯誤，請再試一次」，網址仍是 `/account/login`，Email 欄的內容還在

#### Scenario: 旅程檔依模組與頁面放置

- **WHEN** 列出 `e2e/` 下所有 `*.spec.ts`
- **THEN** 其中有 `e2e/account/login.spec.ts`
