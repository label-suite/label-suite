# Spec Delta

## MODIFIED Requirements

### Requirement: 畫面判定完成前不顯示任何頁面內容

開啟 `/`、需要登入的路由或只給未登入的人的路由時，畫面 SHALL 先查目前的登入狀態，判定完成前只顯示頁面底色，不顯示登入卡、落點內容或任何帳號資訊。需要登入與只給未登入的人兩種路由 MUST 共用同一份查詢結果。

來源：規格 01-01 §登入頁 第 9 條；規格 01-05 §已確認決議 Q11；ADR-004 D2；`ui-design.md` §元件樹 › 守門；dashboard-shell clarification「交給後續產出」（落點改為儀表板，判定中的負向檢查改看儀表板頁首）。

#### Scenario: 判定中不顯示內容

- **WHEN** 開啟 `/dashboard/dashboard`，目前登入狀態的查詢尚未回應
- **THEN** 畫面沒有主標題「儀表板」、沒有登入卡，也沒有任何名稱或 Email

#### Scenario: 兩種路由共用同一次查詢

- **WHEN** 已登入的使用者開啟 `/account/login`，被導向 `/dashboard/dashboard` 並顯示落點
- **THEN** 整個過程只送出 1 次 `GET /api/v1/current-session`

### Requirement: 守門查詢失敗時當成未登入

目前登入狀態的查詢連線失敗、逾時、回應不是錯誤外層，或回 `5xx` 時，畫面 SHALL 當成未登入，前往 `/account/login` 並在錯誤橫幅顯示「平台暫時沒有回應，請稍後再試。」。查詢回 `200` 但 `data.user.role` 不是 `user` 或 `super_admin` 時，畫面 SHALL 同樣當成未登入：不顯示錯誤橫幅，MUST NOT 結束登入狀態（不送出 `DELETE /api/v1/current-session`）；只給未登入的人的路由與需要登入的路由對這個登入者的判定 MUST 一致。

來源：Issue #719 決定表 U6；規格 01-01 §用 Email 與密碼登入 第 16 條、§已確認決議 Q13；規格 02-01 §邊界情況「系統角色是空的或是未知的值」；clarification「不需維護者決定」表 sa-7、T-3；design D11。

#### Scenario: 守門查詢遇到伺服器錯誤

- **WHEN** 開啟 `/dashboard/dashboard`，`GET /api/v1/current-session` 回覆 `503` 錯誤外層
- **THEN** 網址變成 `/account/login`，錯誤橫幅顯示「平台暫時沒有回應，請稍後再試。」

#### Scenario: 守門查詢連不上

- **WHEN** 開啟 `/`，`GET /api/v1/current-session` 連線失敗
- **THEN** 網址變成 `/account/login`，錯誤橫幅顯示「平台暫時沒有回應，請稍後再試。」

#### Scenario: 角色無效時登入頁不被帶走

- **WHEN** 開啟 `/account/login`，`GET /api/v1/current-session` 回覆 `200`，`data.user.role` 為 `"guest"`
- **THEN** 網址停在 `/account/login`，沒有被帶到 `/dashboard/dashboard`，登入頁沒有錯誤橫幅
- **AND** 整個過程只送出 1 次 `GET /api/v1/current-session`，沒有送出 `DELETE /api/v1/current-session`

#### Scenario: 角色無效時根路徑導向登入頁

- **WHEN** 開啟 `/`，`GET /api/v1/current-session` 回覆 `200`，`data.user.role` 為 `"guest"`
- **THEN** 網址變成 `/account/login` 並停在那裡，登入頁沒有錯誤橫幅
- **AND** 整個過程沒有送出 `DELETE /api/v1/current-session`

## REMOVED Requirements

### Requirement: 暫時落點顯示目前登入者

**Reason**: `/dashboard/dashboard` 的頁面由暫時落點（「你已登入」卡片、身分列、系統角色與「儀表板還在建置中」）換成規格 02-01 的儀表板，網址不變；這條 Requirement 的三個 Scenario 與瀏覽器標題「Label Suite — 你已登入」整條被取代（Issue #722 §驗收條件 第 2 項；規格 02-01 §這一頁顯示哪一種版面；dashboard-shell clarification「交給後續產出」）。

**Migration**: 落點的畫面行為改看 capability `dashboard`；瀏覽器標題改看 `frontend-routing` Requirement「每頁設定瀏覽器標題」（「Label Suite — 儀表板」）；擋下說明的位置改看 `app-shell-sidebar` Requirement「沒有任務角色時從側欄進入標記作業被擋下」。登入者的名稱與角色標示只在側欄使用者區（`app-shell-sidebar`），儀表板不再顯示 Email 或系統角色名稱。依賴「你已登入」字樣的前端測試與 e2e 旅程改以儀表板頁首與版面內容判定。
