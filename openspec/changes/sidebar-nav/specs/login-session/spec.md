# Spec Delta

## MODIFIED Requirements

### Requirement: 從這一台登出

`DELETE /api/v1/current-session` SHALL 一律回 `204`、沒有 body，並清掉三個登入 cookie。refresh cookie 可驗證且登入狀態有效時，該段登入狀態失效並記下登出時間；cookie 不在、查不到或已失效時什麼都不寫、不記登出，回應完全相同。其他裝置 MUST 不受影響。登入後外殼側欄的登出控制項呼叫它，不論結果都回到登入頁。

來源：規格 01-05 §從這一台登出 第 1–4 條、§登出紀錄只記真正的登出 第 1、4 條；§卡控機制；Scenario「從這一台登出只影響這一台」「登出不影響其他裝置」「登入狀態已經不能驗證時登出」；Issue #719 落點確認；規格 07-01 §登出；clarification Q2。

#### Scenario: 從這一台登出只影響這一台

- **WHEN** 同一帳號在 A、B 都登入著，A 在側欄點「登出」
- **THEN** 登出請求回覆 `204`、沒有 body，回應清掉三個登入 cookie，畫面以取代歷史紀錄的方式回到 `/account/login`
- **AND** A 這段登入狀態記有登出時間，以 A 原本的 cookie 送出 `GET /api/v1/current-session` 回覆 `401 AUTH_REQUIRED`

#### Scenario: 登出不影響其他裝置

- **WHEN** 上一個 Scenario 中 A 登出成功之後，B 送出 `GET /api/v1/current-session`
- **THEN** 系統回覆 `200`

#### Scenario: 登入狀態已經不能驗證時登出

- **WHEN** 呼叫端沒有任何登入 cookie，送出 `DELETE /api/v1/current-session`
- **THEN** 系統回覆 `204`、沒有 body，與可驗證時的回應狀態與標頭相同
- **AND** 沒有任何登入狀態被記上登出時間

#### Scenario: 登出失敗時畫面仍回到登入頁

- **WHEN** 使用者在側欄點「登出」，登出請求沒有收到回應
- **THEN** 畫面仍回到 `/account/login`
