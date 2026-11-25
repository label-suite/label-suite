# Spec Delta

## MODIFIED Requirements

### Requirement: check 依固定順序執行與 CI 相同的自查

根目錄 SHALL 提供 `pnpm run check`，依固定順序執行格式、規格、前端 lint、型別檢查與測試、契約漂移、後端 lint、格式、型別檢查、分層檢查與測試；每一步呼叫的 MUST 是 CI 使用的同一個 package script 或指令，參數也相同，後端測試同樣輸出覆蓋率資料與 JUnit 結果檔。加上 `--with-semgrep` 時 SHALL 在預設步驟之後依序再執行原始碼安全掃描與測試替身邊界檢查兩步，指令與 CI `semgrep` job 的對應步驟相同。每一步 SHALL 印出名稱與結果；第一個失敗的步驟 MUST 讓指令以非 0 結束，後續步驟不再執行。

來源：testing-agent-rules T9、T10、T11；agent-hook-contract H7；api-agent-rules A5；clarification Q4、Q7、Q11；維護者規劃審查裁定 R-A（2026-11-22）；system-design §本機自查的步驟；issue #562 工作項 2、testing-agent-rules T4、T6、clarification Q4（#562）。

#### Scenario: 全部通過

- **WHEN** 在通過所有檢查的工作區執行 `pnpm run check`
- **THEN** 每一步都印出名稱與通過結果，指令以結束碼 0 結束

#### Scenario: 某一步失敗時停止

- **WHEN** 一個前端檔案有 lint 錯誤，執行 `pnpm run check`
- **THEN** 前端 lint 那一步印出失敗，指令以非 0 結束，後端的步驟沒有執行

#### Scenario: 預設不跑 e2e 與安全掃描

- **WHEN** 執行 `pnpm run check`，接著執行 `pnpm run check --with-e2e --with-semgrep`
- **THEN** 第一次不執行 e2e、原始碼安全掃描與測試替身邊界檢查；第二次三者都執行並各自印出結果，測試替身邊界檢查排在最後

#### Scenario: 測試替身邊界檢查與 CI 指令相同

- **WHEN** 比對 `pnpm run check --with-semgrep` 的測試替身邊界檢查那一步的指令與 CI `semgrep` job 中測試替身邊界檢查那一步的指令
- **THEN** 兩邊的指令與參數逐字相同

#### Scenario: 測試替身邊界檢查失敗時停止

- **WHEN** 檢查範圍內有一處違規，執行 `pnpm run check --with-semgrep`
- **THEN** 測試替身邊界檢查那一步印出失敗，指令以非 0 結束

#### Scenario: 後端測試步驟與 CI 參數相同

- **WHEN** 比對 `check` 的 SQLite、PostgreSQL 兩輪後端測試指令與 CI 兩個後端測試 job 的對應指令
- **THEN** 兩邊的指令與參數相同，都輸出覆蓋率資料與 JUnit 結果檔
