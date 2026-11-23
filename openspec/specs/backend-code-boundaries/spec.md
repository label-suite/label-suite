# backend-code-boundaries Specification

## Purpose

定義後端原始碼的機械分層檢查：模組內各層的允許 import 方向、共用層與業務模組的關係、資料層不碰 HTTP，以及每個模組都受檢，讓違反 backend-agent-rules B1 的 import 在合併前被擋下，而不只靠審查。

## Requirements

### Requirement: 模組內只允許由上往下的 import

每個 `app/modules/<module>/` 內的分層 SHALL 由上到下為 router、service、repository、models；schemas 位在最低層，任何層都可以使用。下層 import 上層時，分層檢查 MUST 以非 0 結束，並指出違反的規則與 import 鏈。

來源：backend-agent-rules B1；ADR-003 D3。

#### Scenario: service 反向匯入 router 時檢查失敗

- **WHEN** 某模組的 service 檔 import 同模組的 router，執行後端分層檢查
- **THEN** 檢查以非 0 結束，輸出指出模組內分層規則被違反與從 service 到 router 的 import 鏈

#### Scenario: repository 匯入 service 時檢查失敗

- **WHEN** 某模組的 repository 檔 import 同模組的 service，執行後端分層檢查
- **THEN** 檢查以非 0 結束

#### Scenario: 既有程式通過分層檢查

- **WHEN** 在本 change 合併時的 `backend/` 執行後端分層檢查
- **THEN** 檢查以結束碼 0 結束

### Requirement: Router 不直接使用資料層

任何模組的 router MUST NOT import 任何模組的 repository 或 models，即使分層允許跳層；違反時分層檢查 MUST 以非 0 結束。

來源：backend-agent-rules B1；`openspec/config.yaml` `rules.system-design` 第一條。

#### Scenario: 後端 Router 直接匯入 Repository 時 CI 失敗

- **WHEN** 某模組的 router 檔 import 同模組的 repository，推上 PR
- **THEN** CI 的後端分層檢查以非 0 結束並印出違反的規則與 import 鏈，該 job 失敗

### Requirement: 共用層不依賴業務模組

`app/core` MUST NOT import `app/modules` 下的任何模組；違反時分層檢查 MUST 以非 0 結束。

來源：ADR-003 D3；backend-agent-rules B1。

#### Scenario: core 匯入業務模組時檢查失敗

- **WHEN** `app/core` 下的檔案 import 某個業務模組的 service，執行後端分層檢查
- **THEN** 檢查以非 0 結束

### Requirement: 資料層不處理 HTTP

任何模組的 repository 與 models MUST NOT import HTTP 框架或其底層套件；違反時分層檢查 MUST 以非 0 結束。

來源：backend-agent-rules B1；`openspec/config.yaml` `rules.system-design` 第一條。

#### Scenario: repository 匯入 HTTP 例外時檢查失敗

- **WHEN** 某模組的 repository 檔為了回 404 而 import HTTP 框架的例外類別，執行後端分層檢查
- **THEN** 檢查以非 0 結束

### Requirement: 每個模組都受分層檢查

`app/modules/` 下的每一個模組 SHALL 都在分層檢查的範圍內，健康檢查模組也不例外；新增模組卻沒有納入檢查範圍時，後端測試 MUST 失敗並指出模組名。

來源：backend-agent-rules B1 §例外（Q12 (f) 補的字句）；#504 Q8；clarification §交給後續產出（N5）。

#### Scenario: 新模組未列入檢查時測試失敗

- **WHEN** 在 `app/modules/` 新增一個模組套件，但沒有把它納入分層檢查的範圍，執行後端測試
- **THEN** 測試失敗，訊息指出未受檢的模組名

#### Scenario: 健康檢查模組也受檢

- **WHEN** 健康檢查模組的 router 檔 import 它的 repository，執行後端分層檢查
- **THEN** 檢查以非 0 結束

### Requirement: 應用組裝點可以匯入多個模組

應用的組裝點（`app/main.py`）SHALL 可以 import 多個模組的 router；這不算違反分層檢查。

來源：backend-agent-rules B1；system-design §後端：分層 import 檢查的對象。

#### Scenario: 組裝點匯入多個模組的路由不報錯

- **WHEN** `app/main.py` import 兩個不同模組的 router，執行後端分層檢查
- **THEN** 檢查不因此報錯
