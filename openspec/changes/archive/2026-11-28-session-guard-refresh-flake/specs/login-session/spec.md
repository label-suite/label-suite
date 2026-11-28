## MODIFIED Requirements

### Requirement: 多個分頁同時延續不互相踢掉

同一張 refresh token 在寬限期內第二次使用時，系統 SHALL 再發一次同一段登入狀態的新憑證；第三次以上 SHALL 回 `409 ACCOUNT_REFRESH_CONFLICT`，不發新憑證、不清 cookie、不撤銷任何登入狀態。畫面遇到 `409` 時 SHALL 短暫等候後以目前的 cookie 重送原請求一次；仍不通就最多再延續一次，成功就再重送一次，還是不行才帶回登入頁。整個過程延續至多 2 次、原請求的重送至多 2 次。

來源：規格 01-05 §多個分頁同時延續登入狀態 第 1–4 條、§已確認決議 Q13；§邊界情況；Scenario「兩個分頁同時延續不會互相踢掉」「慢的那個分頁自動重試一次」「重試仍失敗就帶回登入頁」「同一次延續用第三次就不給」；Scenario「重試不通時再延續一次就成功」驗的是 01-05 §規格「多個分頁同時延續登入狀態」第 3 條（仍不通就最多再延續一次，成功就再重送一次）的成功分支，規格書 §驗收標準沒有同名的一列。

#### Scenario: 兩個分頁同時延續不會互相踢掉

- **WHEN** 同一台的兩個分頁在寬限期內各用同一張 refresh token 送出延續
- **THEN** 兩次都回覆 `201`，兩個回應屬於同一段登入狀態
- **AND** 該帳號其他裝置的登入狀態都還能通行，沒有新增第二段登入狀態

#### Scenario: 同一次延續用第三次就不給

- **WHEN** 同一張 refresh token 在寬限期內已用過兩次，第三次送出延續
- **THEN** 系統回覆 `409`，`code` 為 `"ACCOUNT_REFRESH_CONFLICT"`，回應沒有任何 `Set-Cookie`
- **AND** 該帳號所有裝置的登入狀態都還能通行

#### Scenario: 慢的那個分頁自動重試一次

- **WHEN** 畫面的某個請求收到 `401 AUTH_REQUIRED`，接著延續收到 `409 ACCOUNT_REFRESH_CONFLICT`，等候後以目前 cookie 重送的原請求回覆 `200`
- **THEN** 畫面沒有顯示錯誤，也沒有離開目前的頁面

#### Scenario: 重試仍失敗就帶回登入頁

- **WHEN** 延續收到 `409 ACCOUNT_REFRESH_CONFLICT`，等候後重送的原請求仍回覆 `401 AUTH_REQUIRED`，再延續一次回覆 `401 ACCOUNT_SESSION_INVALID`
- **THEN** 畫面回到 `/account/login`，整個過程中延續請求恰好 2 次、原請求的重送恰好 1 次，沒有第三次延續

#### Scenario: 重試不通時再延續一次就成功

- **WHEN** 延續收到 `409 ACCOUNT_REFRESH_CONFLICT`，等候後重送的原請求仍回覆 `401 AUTH_REQUIRED`，再延續一次回覆 `201`，第二次重送的原請求回覆 `200`
- **THEN** 畫面沒有顯示錯誤，也沒有離開目前的頁面；延續共 2 次、原請求的重送共 2 次
