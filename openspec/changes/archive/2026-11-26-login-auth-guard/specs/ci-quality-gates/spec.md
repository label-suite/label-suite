# Spec Delta

## ADDED Requirements

### Requirement: 認證與授權的關鍵路徑分支覆蓋率門檻

CI SHALL 依 repo 根的關鍵路徑清單，分別計算「認證」與「授權與權限檢查」兩項在後端與前端的分支覆蓋率（兩輪後端合併），任一項任一層低於 90% MUST 失敗並印出項目、層、門檻與實測值（小數點後一位）。清單列到的檔案不存在或不在覆蓋率報告裡 MUST 失敗並點名該檔。清單只含這兩項，不得有其他三項的空項目。

來源：testing-agent-rules T10；ADR-007 D2；Issue #719 §驗收條件；login-auth-guard 決定表 sa-13；`system-design.md` §維護者的決定 覆蓋率門檻的後端路徑清單。

#### Scenario: 認證項低於門檻時 CI 失敗

- **WHEN** 認證項的後端檔案分支合計 200 個、覆蓋 178 個（89.0%）
- **THEN** CI 的覆蓋率 job 失敗，輸出含「authentication」「backend」「90.0」「89.0」

#### Scenario: 兩項都達標時通過

- **WHEN** 兩項在兩層的分支覆蓋率都不低於 90.0%
- **THEN** 關鍵路徑檢查成功

#### Scenario: 清單列到不存在的檔案時失敗

- **WHEN** 關鍵路徑清單列了 `backend/app/core/no_such.py`
- **THEN** 檢查失敗，輸出點名 `backend/app/core/no_such.py`

#### Scenario: 清單只有兩項

- **WHEN** 讀取關鍵路徑清單
- **THEN** 清單恰好有「認證」與「授權與權限檢查」兩項，沒有答案隔離、評分或 IAA 計算的項目
