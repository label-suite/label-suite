## MODIFIED Requirements

### Requirement: 契約產物不同步時 CI 失敗

CI SHALL 重新匯出後端介面描述檔（含文件站副本）並重產前端呼叫層，與已提交的版本比對；任一處有修改、刪除或新增的檔案 MUST 讓 job 失敗並列出不同步的檔名。比對範圍 MUST 包含 `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json`。失敗訊息 MUST 提示以 `pnpm run api:sync` 重產並一起提交。這一步 MUST NOT 需要環境變數、資料庫或起服務。前端呼叫層仍只由 `backend/openapi.json` 產生，副本 MUST NOT 成為任何產生工具的輸入。

來源：api-agent-rules A5；主規格 `frontend-api-codegen`、`api-schema-export`；#506 §驗收條件 2；issue #572 §維護者裁定（2026-11-23）、§驗收條件 3；ADR-003 D6。

#### Scenario: 介面描述檔或前端產物未重產時 CI 失敗

- **WHEN** PR 修改後端回應 schema，卻沒有重新匯出 `backend/openapi.json`
- **THEN** CI 的契約漂移 job 失敗，輸出列出 `backend/openapi.json`

#### Scenario: 介面描述檔已更新但前端未重產時 CI 失敗

- **WHEN** PR 提交了更新後的 `backend/openapi.json`，但沒有重產 `frontend/src/api/generated/`
- **THEN** CI 的契約漂移 job 失敗，輸出列出不同步的產物檔名

#### Scenario: 手改產物時 CI 失敗

- **WHEN** PR 直接修改 `frontend/src/api/generated/` 下的一個檔案
- **THEN** CI 的契約漂移 job 失敗

#### Scenario: 契約副本與後端契約不一致時 CI 失敗

- **WHEN** PR 直接修改 `docs/diagrams/architecture/api.openapi.json`，使它與 `backend/openapi.json` 不同
- **THEN** CI 的契約漂移 job 失敗，輸出列出 `docs/diagrams/architecture/api.openapi.json`
- **AND** 輸出提示執行 `pnpm run api:sync` 並一起提交

#### Scenario: 副本漏提交或被刪除時 CI 失敗

- **WHEN** PR 修改後端回應 schema 並提交了重新匯出的 `backend/openapi.json`，但沒有提交更新後的副本，或刪除了副本
- **THEN** CI 的契約漂移 job 失敗，輸出列出 `docs/diagrams/architecture/api.openapi.json`

#### Scenario: 兩份契約都與重新匯出結果一致時通過

- **WHEN** PR 提交的 `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 都等於重新匯出的結果
- **THEN** 契約漂移 job 的這一步成功，繼續比對前端呼叫層
