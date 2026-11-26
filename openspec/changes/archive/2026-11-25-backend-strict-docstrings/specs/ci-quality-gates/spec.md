# Spec Delta

## MODIFIED Requirements

### Requirement: 後端 lint、格式與型別檢查在 CI 執行

CI SHALL 對整個 `backend/` 執行 lint 與格式檢查，對 `backend/app` 執行嚴格型別檢查；任一項有違規 MUST 讓該 job 失敗。lint 的文件註解規則 SHALL 只約束 `backend/app`：公開的模組、類別、函式與方法缺文件註解，或文件註解的 `Args:` 段漏列參數，MUST 讓 lint 失敗；私有 helper（名稱以 `_` 開頭、不是 `__x__` 形式的特殊方法）、公開類別的建構子本身，以及 `backend/tests`、`backend/alembic` 底下的程式 MUST NOT 因文件註解而失敗。在 `backend/` 不帶嚴格參數執行的型別檢查 SHALL 與 CI 的嚴格型別檢查判定相同。

來源：backend-agent-rules B2；testing-agent-rules T9；infra-compose-e2e-ci clarification Q4（取代 #504 Q6）；issue #524 工作項 1 至 3；backend-strict-docstrings clarification Q1、Q2、Q3、Q6。

#### Scenario: 後端型別錯誤時 CI 失敗

- **WHEN** PR 在後端加入一個回傳型別與宣告不符的函式
- **THEN** CI 的後端 job 在型別檢查那一步失敗

#### Scenario: 後端格式不符時 CI 失敗

- **WHEN** PR 在後端加入一個未依格式化工具排版的檔案
- **THEN** CI 的後端 job 在格式檢查那一步失敗

#### Scenario: 公開介面缺 docstring 時 CI 失敗

- **WHEN** PR 在 `backend/app` 加入一個沒有文件註解的公開函式（或公開類別裡一個沒有文件註解的公開方法），其餘檢查都通過
- **THEN** CI 的後端 job 在 lint 那一步失敗，輸出列出該函式或方法所在的檔名與行號

#### Scenario: 文件註解漏列參數時 CI 失敗

- **WHEN** PR 在 `backend/app` 加入一個有兩個參數的公開函式，它的文件註解有 `Args:` 段但只描述其中一個參數
- **THEN** CI 的後端 job 在 lint 那一步失敗，輸出指出漏列的參數名

#### Scenario: 私有 helper 與建構子不需要 docstring

- **WHEN** PR 在 `backend/app` 加入一個名稱以 `_` 開頭、沒有文件註解的函式，以及一個有類別文件註解、但建構子沒有文件註解的公開類別，其餘程式都符合規則
- **THEN** CI 的後端 job 的 lint 那一步通過

#### Scenario: 測試與遷移腳本不受文件註解規則約束

- **WHEN** PR 在 `backend/tests` 加入一個沒有文件註解的測試函式，並在 `backend/alembic` 底下加入一個沒有文件註解的模組，其餘程式都符合規則
- **THEN** CI 的後端 job 的 lint 那一步通過

#### Scenario: 型別檢查範圍是 backend/app

- **WHEN** PR 只在 `backend/tests` 加入一個缺型別標註的輔助函式
- **THEN** CI 的後端 job 的型別檢查那一步通過；同一個函式放進 `backend/app` 時，型別檢查那一步失敗

#### Scenario: 本機不帶嚴格參數的型別檢查與 CI 一致

- **WHEN** `backend/app` 有一個缺型別標註的公開函式，開發者在 `backend/` 對 `app` 執行不帶嚴格參數的型別檢查
- **THEN** 檢查失敗，回報的錯誤與 CI 嚴格型別檢查回報的相同
