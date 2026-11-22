# Spec Delta

## Purpose

定義每張 pull request 上的兩種安全掃描：原始碼的專案禁令掃描（CORS 萬用來源、寫死的 secret）與相依套件的已知弱點掃描，讓 `AGENTS.md` Hard Rule 7、8 與 ADR-008 D8 的門檻由 CI 機械擋下，而不只靠 agent 與審查把關。

## ADDED Requirements

### Requirement: 專案禁令掃描違規即失敗

CI SHALL 在每張 pull request 以原始碼安全掃描檢查 `backend/`、`frontend/`、`e2e/`，規則集只含本專案的兩條禁令：CORS 允許來源含萬用字元、寫死的 secret。有任何發現 MUST 讓 job 失敗，並列出檔案、行號與規則 id。

來源：ADR-008 D8；`architecture.mdx` §部署與維運「安全掃描與分支推進」；`AGENTS.md` Hard Rule 7、8；security-agent-rules S2；clarification Q6；#506 §驗收條件 5。

#### Scenario: Semgrep 掃到 CORS 萬用來源或寫死的 secret

- **WHEN** PR 在後端把 CORS 中介層的允許來源寫成含 `"*"` 的清單，或在前端把名為 `apiKey` 的常數指派為非空字串常值
- **THEN** CI 的原始碼安全掃描 job 失敗，輸出列出該檔案、行號與對應的規則 id

#### Scenario: 從環境變數讀取的設定不報

- **WHEN** 後端以環境變數讀取 token、前端以建置期環境變數讀取 API 位址
- **THEN** 原始碼安全掃描沒有發現

#### Scenario: 掃描只回報兩條專案規則

- **WHEN** 讀取掃描使用的規則集
- **THEN** 只有 CORS 萬用來源與寫死的 secret 兩條規則，沒有外部註冊表的規則集

#### Scenario: 既有程式通過掃描

- **WHEN** 在本 change 合併時的 `backend/`、`frontend/`、`e2e/` 執行原始碼安全掃描
- **THEN** 沒有發現，job 成功

### Requirement: 專案禁令規則附回歸樣本

兩條專案禁令 SHALL 各附應命中與不應命中的回歸樣本；CI 在掃描前 MUST 先驗證規則對樣本的結果，與樣本標註不符時 MUST 失敗。

來源：testing-agent-rules T3；ADR-008 D8。

#### Scenario: 規則回歸樣本不符時 CI 失敗

- **WHEN** PR 修改寫死 secret 的規則，使一個標註為應命中的樣本不再被命中
- **THEN** CI 的原始碼安全掃描 job 在規則回歸那一步失敗，掃描步驟不執行

### Requirement: 相依套件有 high 以上弱點時失敗

CI SHALL 在每張 pull request 掃描後端依賴與前端正式依賴的已知弱點，門檻為 high：有 high 以上弱點 MUST 讓 job 失敗並列出套件與弱點編號；只有 high 以下的弱點時 job SHALL 成功。前端開發依賴的弱點不在本掃描的失敗條件內。

來源：ADR-008 D8；`architecture.mdx` §部署與維運「CI 安全掃描」；testing-agent-rules T9；clarification Q5。

#### Scenario: 相依套件有 high 以上弱點時 CI 失敗

- **WHEN** PR 把一個後端依賴鎖定在有已公開 high 弱點的版本
- **THEN** CI 的相依套件掃描 job 失敗，輸出列出該套件與弱點編號

#### Scenario: 前端正式依賴有 high 弱點時 CI 失敗

- **WHEN** 前端正式依賴之一有已公開的 high 弱點
- **THEN** CI 的相依套件掃描 job 失敗

#### Scenario: 只有低於 high 的弱點時不失敗

- **WHEN** 依賴中只有 moderate 等級的已知弱點
- **THEN** CI 的相依套件掃描 job 成功
