## MODIFIED Requirements

### Requirement: 入口與間接使用不算違規

入口套件 import 自己的第三方套件 SHALL 不算違規；業務模組只經由入口間接到達該套件也 SHALL 不算違規。`backend/app/` 目前有兩個入口套件：`app/oidc/`（Google OIDC 的入口）與 `app/mail/`（寄信的入口）；寄信入口以對外 HTTP 客戶端呼叫寄信服務，這是 B12 第 3 項「每個整合自己的包裝就是它的入口」允許的寫法。三條入口契約在真實的 `app` 上皆無違規。

來源：issue #563 工作項 2、5；Epic #560；backend-agent-rules B12（新）；clarification Q2、Q3、N6；ADR-004 D4；login-auth-guard PL5；ADR-008 D3；email-celery-worker clarification Q7、Q8。

#### Scenario: 入口 import 自己的套件時通過

- **WHEN** 樣本樹中的入口套件（不是 `app/core`、`app/modules`、`app/main`、`app/scripts`、`app/worker` 之一）import `resend`，執行後端分層檢查
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

#### Scenario: 對外 HTTP 客戶端只出現在入口套件

- **WHEN** 在本 change 合併時的 `backend/app/` 搜尋 import `httpx` 的檔案
- **THEN** 只有 `app/oidc/` 與 `app/mail/` 底下的檔案 import `httpx`
- **AND** `backend/app/` 沒有任何檔案 import `resend`、`smtplib` 或 `aiosmtplib`

### Requirement: `app` 底下每個頂層套件都受入口契約檢查

`backend/app/` 底下的每一個頂層套件或模組，SHALL 不是已列入每一條入口契約的檢查來源，就是已登記的入口套件；兩者皆非時，後端測試 MUST 失敗並指出該套件名。檢查來源寫成整個 `app`（`app` 本身）時，視為已涵蓋所有頂層套件，守門測試 MUST 接受，不得當成漏列。已登記的入口套件 MUST NOT 同時出現在任何入口契約明列的檢查來源內。目前已登記的入口套件為 `oidc` 與 `mail`；worker 的組裝點 `app/worker.py` 是檢查來源，不是入口套件。

來源：issue #563 工作項 2；Epic #560；backend-agent-rules B12（新）；clarification Q3、N6；system-design §守門測試；login-auth-guard PL5；email-celery-worker clarification 技術預設「import 契約」。

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
- **THEN** 測試通過，`oidc` 與 `mail` 是已登記的入口套件，`app.worker` 列在三條入口契約的檢查來源內

#### Scenario: worker 組裝點直接 import 對外 HTTP 客戶端時檢查失敗

- **WHEN** `app/worker.py` import `httpx`，執行後端分層檢查
- **THEN** 檢查以非 0 結束，並指出「Outbound HTTP only through its entry」被違反

### Requirement: 契約集合以數量與名稱比對，並由常駐違規樣本證明有效

後端測試 SHALL 以契約數量與契約名稱集合比對 `backend/pyproject.toml` 的 import 契約，而不是寫死的數字；增、刪或改名任一契約而沒有同步更新預期名稱集合時，測試 MUST 失敗。本 change 之後契約集合為十一條：既有四條、「Mail only through its entry」「Outbound HTTP only through its entry」「OIDC only through its entry」「Modules do not import each other」「Only the assembly point imports routers」，以及「Routers do not import the mail entry」「Mail entry does not import modules」。除既有四條外的每一條契約 SHALL 有常駐的違規樣本，在暫存的樣本樹證明違規時分層檢查以非 0 結束，使契約被改寬時下一次 CI 就失敗。

來源：issue #563 工作項 5；Epic #560；testing-agent-rules T6、T9；backend-agent-rules B1、B4、B12（新）；clarification Q9；`AGENTS.md` Hard Rule 6；email-celery-worker clarification 技術預設「import 契約」。

#### Scenario: 乾淨的樣本樹通過全部契約

- **WHEN** 乾淨的樣本樹執行後端分層檢查
- **THEN** 檢查以結束碼 0 結束，輸出的契約通過數等於設定檔的契約數，且沒有被破壞的契約

#### Scenario: 刪一條契約同時加一條時測試失敗

- **WHEN** 設定檔刪除一條契約並新增另一條，使契約總數不變，執行契約名稱測試
- **THEN** 測試失敗，訊息點名缺少與多出的契約名稱

#### Scenario: 每條新契約都有會失敗的樣本

- **WHEN** 對既有四條以外的七條契約各自在樣本樹加入一個違規 import，執行後端分層檢查
- **THEN** 每一個樣本的檢查都以非 0 結束，並點名對應的契約

## ADDED Requirements

### Requirement: Router 不得匯入寄信入口

任何模組的 router MUST NOT 直接 import 寄信入口 `app.mail`；寄信只能由 service 在交易提交之後呼叫。違反時分層檢查 MUST 以非 0 結束，並指出「Routers do not import the mail entry」被違反與 import 鏈。router 經 service 間接到達寄信入口不算違規。

來源：backend-agent-rules B1、B4；email-celery-worker clarification 技術預設「import 契約」。

#### Scenario: router 直接匯入寄信入口時檢查失敗

- **WHEN** 樣本樹中某模組的 router 檔 import `app.mail`，執行後端分層檢查
- **THEN** 檢查以非 0 結束，並指出「Routers do not import the mail entry」被違反，以及從該 router 到 `app.mail` 的 import 鏈

#### Scenario: router 經 service 間接到達寄信入口時通過

- **WHEN** 樣本樹中某模組的 router import 同模組的 service，該 service import `app.mail`，執行後端分層檢查
- **THEN** 「Routers do not import the mail entry」不被違反

### Requirement: 寄信入口不得匯入業務模組

寄信入口 `app.mail` MUST NOT 直接或間接 import `app.modules` 下的任何模組，使寄信入口與寄信工作在 import 圖上到不了任何業務資料與測試集答案；違反時分層檢查 MUST 以非 0 結束，並指出「Mail entry does not import modules」被違反與 import 鏈。

來源：`AGENTS.md` Hard Rule 6；security-agent-rules S6；ADR-003 D3；email-celery-worker clarification 技術預設「import 契約」、§檢查結論「測試集答案不外露」。

#### Scenario: 寄信入口匯入業務模組時檢查失敗

- **WHEN** 樣本樹中 `app/mail/` 底下的檔案 import 某個業務模組的 repository，執行後端分層檢查
- **THEN** 檢查以非 0 結束，並指出「Mail entry does not import modules」被違反

#### Scenario: 寄信入口經中介套件間接匯入業務模組時也被擋

- **WHEN** 樣本樹中 `app/mail/` 底下的檔案 import 一個中介套件，該套件再 import 某個業務模組，執行後端分層檢查
- **THEN** 檢查以非 0 結束，並指出「Mail entry does not import modules」被違反
