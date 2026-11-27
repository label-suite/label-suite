# Spec Delta

## MODIFIED Requirements

### Requirement: 根路徑與不存在的路徑依登入狀態導向

開啟 `/` 時，畫面 SHALL 依登入狀態以取代歷史紀錄的方式前往 `/dashboard/dashboard`（已登入）或 `/account/login`（未登入）。開啟沒有註冊的路徑時 SHALL 先前往 `/` 再依同一規則導向。

來源：規格 01-01 §登入頁 第 9 條；Issue #719 決定表 U7；規格 07-03 §兩種畫面的分工 第 1、5 條（找不到只涵蓋網址定址到的那一筆，不涵蓋沒有註冊的路徑；沒有註冊的路徑維持導向，見 denied-and-not-found clarification Q2）。

#### Scenario: 未登入開啟根路徑

- **WHEN** 沒有登入 cookie 的訪客開啟 `/`
- **THEN** 網址變成 `/account/login`
- **AND** 登入頁沒有錯誤橫幅

#### Scenario: 已登入開啟根路徑

- **WHEN** 已登入的使用者開啟 `/`
- **THEN** 網址變成 `/dashboard/dashboard`

#### Scenario: 不存在的路徑依登入狀態導向

- **WHEN** 沒有登入 cookie 的訪客開啟 `/no-such-page`
- **THEN** 網址變成 `/account/login`，瀏覽器上一頁不會回到 `/no-such-page`
- **AND** 登入頁沒有錯誤橫幅
