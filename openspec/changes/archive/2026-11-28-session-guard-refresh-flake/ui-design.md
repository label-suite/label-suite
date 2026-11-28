# UI Design

本次無 UI 變更。

理由：本 change 只修正 `e2e/account/session-guard.spec.ts`「refresh conflicts」區塊兩個測試的路由攔截寫法（依請求順序回應，會被開發模式雙重掛載取消的第一份登入狀態查詢占掉名額）。產品端的畫面、路由、元件、文案都不改，`design/prototype/` 與 `design/system/` 都不動。

## 測試觀察的既有畫面狀態（僅供追溯，不是設計變更）

修法完成後，兩個測試仍以下列既有畫面狀態作為斷言依據。這些狀態由產品既有實作呈現，本 change 不新增、不調整。

| 測試                       | 路由                   | 觀察的畫面狀態                                                                | 既有呈現來源                                                                                                                        |
| :------------------------- | :--------------------- | :---------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| 慢的那個分頁自動重試一次   | `/dashboard/dashboard` | 延續並重送成功後，level 1 標題「儀表板」可見；頁面沒有 `alert` 角色的錯誤橫幅 | `design/prototype/pages/dashboard-dashboard.md`；頁面元件既有實作                                                                   |
| 重試仍失敗就帶回登入頁     | `/account/login`       | 網址落在登入頁；`alert` 角色顯示「驗證失敗，請重新登入」                      | `design/prototype/pages/account-login.md`；文案來源 `frontend/src/lib/i18n/locales/zh-TW/auth.json`（`login.error.sessionInvalid`） |
| 重試不通時再延續一次就成功 | `/dashboard/dashboard` | 再延續一次成功後，level 1 標題「儀表板」可見；沒有 `alert` 角色的錯誤橫幅     | 同第一列                                                                                                                            |

注意：第二列的「驗證失敗，請重新登入」是登入頁既有的錯誤文案，不是本 change 新增的錯誤呈現。測試斷言以文字與網址為準，不依賴版面。

## 不適用的段落

資料來源、元件樹、四種畫面狀態的新設計、design token 對應與 `frontend-routes.mdx` 異動，本 change 都不涉及，依上面的理由不另寫。若 `design-reviewer` 或 `planner` 之後要求補上，代表 `system-design` 的修法範圍已改為含 `frontend/`，要回到 `proposal` 與本文件重新評估（見 `system-analysis.md` 待決問題 #1）。
