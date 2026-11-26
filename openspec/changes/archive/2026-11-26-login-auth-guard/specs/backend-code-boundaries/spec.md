# Spec Delta

## MODIFIED Requirements

### Requirement: 入口與間接使用不算違規

入口套件 import 自己的第三方套件 SHALL 不算違規；業務模組只經由入口間接到達該套件也 SHALL 不算違規。`backend/app/` 目前有一個入口套件 `app/oidc/`（Google OIDC 的入口）；三條入口契約在真實的 `app` 上皆無違規。

來源：issue #563 工作項 2、5；Epic #560；backend-agent-rules B12（新）；clarification Q2、Q3、N6；ADR-004 D4；login-auth-guard PL5。

#### Scenario: 入口 import 自己的套件時通過

- **WHEN** 樣本樹中的入口套件（不是 `app/core`、`app/modules`、`app/main`、`app/scripts` 之一）import `resend`，執行後端分層檢查
- **THEN** 檢查以結束碼 0 結束

#### Scenario: 業務模組只經入口間接使用套件時通過

- **WHEN** 樣本樹中某業務模組 import 入口套件，入口套件 import `resend`，執行後端分層檢查
- **THEN** 檢查以結束碼 0 結束

#### Scenario: 既有程式通過入口檢查

- **WHEN** 在本 change 合併時的 `backend/` 執行後端分層檢查
- **THEN** 檢查以結束碼 0 結束，且沒有任何入口契約被破壞

#### Scenario: OIDC 套件只出現在 OIDC 入口

- **WHEN** 在本 change 合併時的 `backend/app/` 搜尋 import `authlib` 的檔案
- **THEN** 只有 `app/oidc/` 底下的檔案 import `authlib`

### Requirement: `app` 底下每個頂層套件都受入口契約檢查

`backend/app/` 底下的每一個頂層套件或模組，SHALL 不是已列入每一條入口契約的檢查來源，就是已登記的入口套件；兩者皆非時，後端測試 MUST 失敗並指出該套件名。檢查來源寫成整個 `app`（`app` 本身）時，視為已涵蓋所有頂層套件，守門測試 MUST 接受，不得當成漏列。已登記的入口套件 MUST NOT 同時出現在任何入口契約明列的檢查來源內。目前已登記的入口套件只有 `oidc`。

來源：issue #563 工作項 2；Epic #560；backend-agent-rules B12（新）；clarification Q3、N6；system-design §守門測試；login-auth-guard PL5。

#### Scenario: 新的頂層套件未歸類時測試失敗

- **WHEN** 樣本樹在 `app/` 下新增 `stray` 套件，既沒有列入入口契約的檢查來源，也沒有登記為入口套件，執行守門測試
- **THEN** 測試失敗，訊息點名 `stray`

#### Scenario: 已登記的入口套件被放進檢查來源時測試失敗

- **WHEN** 某套件已登記為入口套件，卻同時列在某條入口契約的檢查來源，執行守門測試
- **THEN** 測試失敗，訊息點名該套件與該契約

#### Scenario: 入口契約漏列既有頂層套件時測試失敗

- **WHEN** 某條入口契約的檢查來源少列了 `app` 底下既有的頂層套件，執行守門測試
- **THEN** 測試失敗，訊息點名該契約與缺少的套件

#### Scenario: 檢查來源寫成整個 app 時通過守門測試

- **WHEN** 某條入口契約的檢查來源是整個 `app`（D8 (b) 的形狀），執行守門測試
- **THEN** 測試不因漏列頂層套件而失敗

#### Scenario: 既有的 app 通過守門測試

- **WHEN** 在本 change 合併時的 `backend/` 執行守門測試
- **THEN** 測試通過，且 `oidc` 是已登記的入口套件
