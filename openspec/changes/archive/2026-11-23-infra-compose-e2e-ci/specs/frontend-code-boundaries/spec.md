# Spec Delta

## ADDED Requirements

### Requirement: lint 不容許警告

前端的 lint 指令 SHALL 把任何警告都視為失敗：只要有一則警告，lint MUST 以非 0 結束。本機、根目錄的自查指令與 CI 呼叫的 MUST 是同一個 lint 指令，不在 CI 另加參數。這讓本 capability 其他 requirement 的「lint MUST 失敗」在規則被降成警告時仍然成立。

來源：frontend-agent-rules F1；ADR-005 D2；#506 留言（2026-11-21）第 1 點；system-design D9。

#### Scenario: 規則被降成警告時 lint 仍失敗

- **WHEN** 把分層邊界規則的等級從 error 改成 warn，並讓 `components/` 下的一個檔案 import `pages/` 下的模組，執行 `pnpm --filter frontend lint`
- **THEN** lint 以非 0 結束碼失敗，輸出含該則警告

#### Scenario: 分不出層的檔案在零警告下仍失敗

- **WHEN** 一個檔案直接放在 `pages/` 根層，執行 `pnpm --filter frontend lint`
- **THEN** lint 以非 0 結束碼失敗並指出該檔

#### Scenario: 沒有警告也沒有錯誤時 lint 通過

- **WHEN** 在本 change 合併時的 `frontend/` 執行 `pnpm --filter frontend lint`
- **THEN** lint 以結束碼 0 結束，輸出沒有任何警告
