# Clarification

## 檢查範圍

關卡模式。檢查 `system-analysis.md`、`system-design.md`、`ui-design.md`、`api-contract.md`、`proposal.md` 五份（以 a93d962 回修後的版本為準），對照規格 01-01、01-05、02-01、06-01、07-01、07-03，ADR-004，`architecture.mdx`，`security-agent-rules`、`api-agent-rules`、`testing-agent-rules`，以及 `openspec/specs/` 的 `api-envelope`、`frontend-api-client`、`frontend-routing`、`frontend-i18n`、`backend-code-boundaries`、`container-runtime`。`specs`、`design`、`tasks` 尚未產生，相關檢查項標「後續產物」。

維護者在 2026-11-26 以派工 session 的問答逐題回覆全部 Q，決定表記在 [#719 留言](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187190476)，暫時落點畫面的核可記在 [#719 留言](https://github.com/label-suite/label-suite/issues/719#issuecomment-7187214559)。

## 檢查結論

| 面向             | 結論                                                                                                                          | 問題數 |
| :--------------- | :---------------------------------------------------------------------------------------------------------------------------- | :----- |
| 規格完整性       | 通過（Q 全數決議；規格 01-01 補三條、01-05 補英文文案，走 spec-writing）；specs、tasks 涵蓋度為後續產物                       | 6      |
| API Contract     | 通過（拿掉 `ACCOUNT_LOGIN_THROTTLED`；`user` 加 `email`；C1–C4 以 P 處理）                                                    | 4      |
| 邏輯一致性       | 通過（S4 與規格 01-05 的衝突依 N3 改 S4；C3、C4 已對齊）                                                                      | 3      |
| 可行性           | 通過（`AUTH_SECRET` 與 Lite 承諾的衝突依 PL1 決議；沒有偷定 `architecture.mdx` §待決 的題目）                                 | 2      |
| 邊界情況         | 通過（多分頁延續、疑似盜用、守門連不上、未知路徑、Seeder 重複執行皆有結論）                                                   | 4      |
| 跨功能影響       | 通過（新表 `account_refresh_token`、`users` 三欄、字典與 ER 已改，`pnpm check:er` 通過；既有 capability 的 MODIFIED 見 P 表） | 7      |
| 可測試性         | 待後續產物（Scenario 名稱沿用規格驗收標準由 specs 落實；覆蓋率門檻依 sa-13 只建兩項）                                         | 1      |
| 規格範圍         | 通過（記住我、鎖定移出；不改 `00-prd.mdx`、`design/prototype/`；prototype 差異記進 design-gaps G-62–G-65）                    | 2      |
| 任務設定驅動     | 通過：登入與守門不涉及任務類型，沒有 `task.type` 分支或任務專用欄位                                                           | 0      |
| 測試集答案不外露 | 通過：本次端點只回登入者自己的帳號資料與部署能力旗標，不含任何任務、標記或答案資料                                            | 0      |

## 決議（Q）

日期皆為 2026-11-26，維護者在派工 session 以問答回覆；來源見上方兩則留言。

### Q1. 「記住我」（sa-1）

- **來源**：`system-analysis.md` 待決 1、C1
- **問題**：Issue #719 字面要求「記住我」，規格 01-05 只有固定的 90 天／7 天
- **決議**：不做；登入狀態期限照規格 01-05
- **理由**：規格優先於 Issue 字面，規格沒有這個選項
- **已回修**：`system-analysis.md` §範圍、`ui-design.md`、`proposal.md`
- **日期**：2026-11-26

### Q2. 01-05 本次範圍（sa-2）

- **來源**：`system-analysis.md` 待決 2、C7
- **問題**：01-05 哪些部分在本次、哪些留給 #726
- **決議**：期限、延續（含多分頁競爭與疑似盜用）、被動登出兩句、登出端點都在本次；撤銷事件與保留清除留給 #726
- **理由**：登入沒有延續與被動登出就不能完整使用
- **已回修**：`system-design.md`、`api-contract.md`（`createSessionRefresh`、`deleteCurrentSession` 去提案）、`ui-design.md`
- **日期**：2026-11-26

### Q3. 登入失敗鎖定（sa-3）

- **來源**：`system-analysis.md` 待決 3、C2
- **問題**：規格的連續失敗 10 次擋 30 分鐘本次做不做
- **決議**：本次不做，交給 #726；「同一個人」將來以帳號加來源位址認定
- **理由**：鎖定需要計數儲存與清除排程，屬 #726 的安全範圍
- **已回修**：`api-contract.md`、`error-codes.mdx` 移除 `ACCOUNT_LOGIN_THROTTLED`；`system-design.md` 只留插入點
- **日期**：2026-11-26

### Q4. 第一個可登入的帳號（sa-4）

- **來源**：`system-analysis.md` 待決 4
- **問題**：沒有任何帳號時無法驗收登入
- **決議**：提前交付建立初始管理員（Seeder）的指令
- **理由**：06-01 已有此需求，提前做才能驗收本次
- **已回修**：`system-design.md` §Seeder 初始化指令；`local-development.mdx` 由實作時更新
- **日期**：2026-11-26

### Q5. 暫時落點與登出（sa-5、sa-7）

- **來源**：`system-analysis.md` 待決 5、7
- **問題**：02-01 完成前登入後去哪、放什麼
- **決議**：`/dashboard/dashboard` 放最小佔位頁：「你已登入」、名字與 Email、系統角色、說明句、登出鈕；已登入者開登入頁也到這裡。畫面經維護者看過 artifact 核可
- **理由**：先有可驗收的落點，02-01 完成時整頁替換、路徑不變
- **已回修**：`ui-design.md` §暫時落點、`frontend-routes.mdx`、`api-contract.md`（`user.email`）
- **日期**：2026-11-26

### Q6. 「忘記密碼？」「前往註冊」與寄信判斷（sa-6）

- **決議**：照 prototype 顯示，去處由後續張補；本次建立「有沒有設定寄信服務」的共用判斷（`selfRegistrationEnabled`）
- **已回修**：`api-contract.md` `getAuthOptions`、`ui-design.md`
- **日期**：2026-11-26

### Q7. 沒設定 Google（sa-8）

- **決議**：不顯示 Google 按鈕與「或」分隔線
- **理由**：與沒設寄信服務時隱藏「前往註冊」同一做法
- **已回修**：規格 01-01 §已確認決議 Q10（spec-writing，分支 `docs/login-clarification-specs`）、`ui-design.md`；後端 `ACCOUNT_GOOGLE_UNAVAILABLE` 只作防呆
- **日期**：2026-11-26

### Q8. 登入頁 Google 自動綁定（sa-9）

- **決議**：照 ADR-004 D5 自動綁定，不另外告知
- **已回修**：規格 01-01 Q11、01-05 §四種改動；`system-design.md`
- **日期**：2026-11-26

### Q9. 登入後去處（sa-10）

- **決議**：一律去落點，不帶回原本要去的頁面
- **已回修**：`ui-design.md`、`system-design.md`（不收 `returnTo`）
- **日期**：2026-11-26

### Q10. 守門深度（sa-11）

- **決議**：只做授權第 1、2 步，權限矩陣留給 06-02
- **已回修**：`system-design.md`、`endpoint-authorization.mdx`
- **日期**：2026-11-26

### Q11. 覆蓋率門檻（sa-13）

- **決議**：只建認證與授權兩項，附路徑清單進 CI；#111 本文隨後改寫
- **已回修**：`system-design.md` 路徑清單
- **日期**：2026-11-26

### Q12. refresh token 的儲存（N1）

- **決議**：新表 `account_refresh_token`
- **理由**：ADR-004 D1 要求伺服器維護；逐次記錄才能判斷重複使用與疑似盜用
- **已回修**：`data-table-dictionary.mdx`、`database-schema.er.json`（`pnpm check:er` 通過）、`system-design.md`
- **日期**：2026-11-26

### Q13. 停用或已匿名化帳號用 Google 登入（N2）

- **決議**：顯示與「沒有對應帳號」同一句（E2）
- **已回修**：規格 01-01 Q12、`api-contract.md`（`ACCOUNT_GOOGLE_REJECTED`）
- **日期**：2026-11-26

### Q14. 角色變更與登入狀態（N3）

- **決議**：不撤銷登入狀態，守門每次從資料庫讀角色；規則 S4 改寫。維護者另外同意任務成員變動也從 S4 的撤銷清單移除
- **理由**：規格 01-05 優先於規則文件
- **已回修**：`security-agent-rules.mdx` S4（分支 `docs/login-clarification-specs`）
- **日期**：2026-11-26

### Q15. `AUTH_SECRET` 與 Lite 承諾（PL1）

- **決議**：Lite 層沒設就首次啟動自動產生並存進資料 volume，重啟沿用；正式層仍必填
- **已回修**：`system-design.md` §`AUTH_SECRET` 的來源、`backend-modules.mdx`
- **日期**：2026-11-26

### Q16. 畫面細節（U1、U2、U3、U5、U6、U7、U8）

- **決議**：
  - U1 送出中整頁凍結（依規格）
  - U2 任一欄輸入即收起錯誤橫幅
  - U3 沿用既有文案，缺的由派工擬稿寫進規格 01-01 Q13、01-05 Q19，維護者已核可擬稿
  - U5 就近套用既有 token
  - U6 守門查詢失敗當成未登入，回登入頁顯示「沒有回應」那句
  - U7 未知路徑導向 `/`，再依登入狀態導向，07-03 完成時取代
  - U8 語言鈕無障礙名稱含「ZH」／「EN」
- **已回修**：`ui-design.md`、`frontend-routes.mdx`；prototype 差異記進 `design/system/design-gaps.md` G-62–G-65，不改 `design/prototype/`
- **日期**：2026-11-26

## 已修正（P）

| 編號   | 位置                      | 問題                                                                                          | 修正                                                                                                                                                                  |
| :----- | :------------------------ | :-------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sa-12  | 資料表字典、ER            | `users` 缺 `google_subject`、`credential_version`、`is_seeder`                                | `sd` 已補，`pnpm check:er` 通過                                                                                                                                       |
| C3、C4 | `ui-design.md`            | Google 回調方式與 operationId 和 contract 不一致                                              | `ui-ux` 已對齊（e18432f）                                                                                                                                             |
| U4     | `frontend-i18n`           | 與規格 01-01 語言切換、預設繁中不一致                                                         | `planner` 在 specs 寫 MODIFIED                                                                                                                                        |
| C1     | `api-envelope`            | 第一批通用碼要加 `AUTH_REQUIRED`、`CSRF_FAILED`                                               | `planner` 在 specs 寫 MODIFIED                                                                                                                                        |
| C2     | 單數化表                  | `auth-options` 的單數化                                                                       | `planner` 在 tasks 列一項                                                                                                                                             |
| PL2    | `frontend-api-client`     | 「不自動重送」與「`401` 先延續再重送」衝突                                                    | `planner` 在 specs 寫 MODIFIED，例外只有兩條：`401` 延續成功後重送原請求一次；延續遇 `409 ACCOUNT_REFRESH_CONFLICT` 時等待另一分頁完成後重送一次（`ui-design.md` X7） |
| PL3    | `api-envelope`            | 「沒有 `204` 例外端點」與登出的 `204`                                                         | `planner` 在 specs 寫 MODIFIED                                                                                                                                        |
| PL4    | `frontend-routing`        | 開發模式 `/` 導向 `/dev/health` 與 `/` 依登入狀態導向衝突                                     | `planner` 在 specs 寫 MODIFIED                                                                                                                                        |
| PL5    | `backend-code-boundaries` | 「今天沒有任何入口」因新增 `app/oidc/` 不再成立                                               | `planner` 在 specs 寫 MODIFIED                                                                                                                                        |
| PL6    | `database-migration`      | 「升級後版本表只有 baseline、沒有其他表」在第一個業務 revision 後不再成立                     | `planner` 在 specs 寫 MODIFIED                                                                                                                                        |
| PL7    | `component-gallery`       | 「Badge 正好五個 variant」與固定七區，和新增的 `label`、`separator` 原語及 badge 角色變體衝突 | `planner` 在 specs 寫 MODIFIED                                                                                                                                        |

## 交給後續產出

- specs 的每條 Requirement 追溯到規格 01-01／01-05（含 `docs/login-clarification-specs` 新增的 Q10–Q15、Q19）、06-01 或 ADR-004 的條號；Scenario 名稱沿用規格驗收標準的名稱
- 不寫記住我、登入失敗鎖定；鎖定只在 design 留插入點並指向 #726
- 規格 01-01、01-05 的文案以 `docs/login-clarification-specs` 為準，該 PR 要先於本 change 合併或一起合併前確認一致
- Migration 一個 revision：`users`、`account_session`、`account_refresh_token`，SQLite 與 PostgreSQL 都要測（`TEST_DATABASE_URL`）
- 覆蓋率門檻只涵蓋 `system-design.md` 列的認證與授權路徑；tasks 列一項改寫 #111 本文
- tasks 要有：Seeder 指令、`AUTH_SECRET` 自動產生、`local-development.mdx` 更新、`_IRREGULAR_SINGULARS` 加 `auth-options`、暫時落點頁、`"*"` 路由
- 負向 Scenario：停用、已匿名化帳號不能登入；未登入打任何受保護端點回 `401 AUTH_REQUIRED`；錯誤訊息不透露帳號是否存在
- U4 改 `frontend-i18n` 時，檢查 `dev-health-page`、`e2e-testing` 中假設瀏覽器決定語言的 Scenario；不再成立就一併列 MODIFIED
- 被動登出兩句的英文以舊 repo 實作計畫的文案為準（維護者 2026-11-26 改選，取代先前核可的擬稿），見規格 01-05 Q19
- 測試集答案不外露：本次無相關資料，specs 不需額外 Scenario，但守門的預設是拒絕
