# Spec Delta

## ADDED Requirements

### Requirement: 寄信套件只能經寄信入口使用

`backend/app/` 底下的非入口程式 MUST NOT 直接 import `resend`、`smtplib`、`aiosmtplib`；違反時分層檢查 MUST 以非 0 結束，並指出「Mail only through its entry」被違反與 import 鏈。

來源：issue #563 工作項 2、5；Epic #560；backend-agent-rules B1、B12（新）；ADR-008 D3；clarification Q1、Q3。

#### Scenario: 業務模組直接 import 寄信套件時檢查失敗

- **WHEN** 某業務模組的 service 檔 import `resend`，執行後端分層檢查
- **THEN** 檢查以非 0 結束，輸出指出「Mail only through its entry」被違反，以及從該 service 檔到 `resend` 的 import 鏈

#### Scenario: 其他寄信套件也被擋

- **WHEN** 業務模組的檔案分別 import `smtplib`、`aiosmtplib`，各自執行後端分層檢查
- **THEN** 每一次檢查都以非 0 結束，並指出「Mail only through its entry」被違反

### Requirement: Google OIDC 套件只能經 OIDC 入口使用

`backend/app/` 底下的非入口程式 MUST NOT 直接 import `authlib`；違反時分層檢查 MUST 以非 0 結束，並指出「OIDC only through its entry」被違反與 import 鏈。

來源：issue #563 工作項 2、5；Epic #560；backend-agent-rules B1、B12（新）；ADR-004 D4；clarification Q1、Q3。

#### Scenario: 業務模組直接 import OIDC 套件時檢查失敗

- **WHEN** 某業務模組的檔案 import `authlib`，執行後端分層檢查
- **THEN** 檢查以非 0 結束，並指出「OIDC only through its entry」被違反

### Requirement: 對外 HTTP 客戶端套件只能經 HTTP 入口使用

`backend/app/` 底下的非入口程式 MUST NOT 直接 import `httpx`、`requests`、`aiohttp`、`urllib3`；違反時分層檢查 MUST 以非 0 結束，並指出「Outbound HTTP only through its entry」被違反與 import 鏈。標準庫的 `urllib.request`、`http.client` 不在檢查範圍。每個整合自己的包裝就是它的入口，不另設共用 HTTP 層。

來源：issue #563 工作項 2、5；Epic #560；backend-agent-rules B12（新）；testing-agent-rules T6 §正例；clarification Q1、N8。

#### Scenario: 業務模組直接 import 第三方 HTTP 客戶端時檢查失敗

- **WHEN** 業務模組的檔案分別 import `httpx`、`requests`、`aiohttp`、`urllib3`，各自執行後端分層檢查
- **THEN** 每一次檢查都以非 0 結束，並指出「Outbound HTTP only through its entry」被違反

#### Scenario: 共用層與組裝點直接 import 第三方 HTTP 客戶端時檢查失敗

- **WHEN** `app/core` 底下的檔案 import `httpx`，或 `app/main.py` import `httpx`，執行後端分層檢查
- **THEN** 兩種情況的檢查都以非 0 結束，並指出「Outbound HTTP only through its entry」被違反

#### Scenario: 標準庫的 HTTP 工具不在檢查範圍

- **WHEN** 業務模組的檔案 import 標準庫的 `urllib.parse`，執行後端分層檢查
- **THEN** 檢查以結束碼 0 結束

### Requirement: 入口與間接使用不算違規

入口套件 import 自己的第三方套件 SHALL 不算違規；業務模組只經由入口間接到達該套件也 SHALL 不算違規。入口的檔案位置不在本 change 範圍，今天 `backend/app/` 沒有任何入口，三條入口契約在真實的 `app` 上皆無違規。

來源：issue #563 工作項 2、5；Epic #560；backend-agent-rules B12（新）；clarification Q2、Q3、N6。

#### Scenario: 入口 import 自己的套件時通過

- **WHEN** 樣本樹中的入口套件（不是 `app/core`、`app/modules`、`app/main`、`app/scripts` 之一）import `resend`，執行後端分層檢查
- **THEN** 檢查以結束碼 0 結束

#### Scenario: 業務模組只經入口間接使用套件時通過

- **WHEN** 樣本樹中某業務模組 import 入口套件，入口套件 import `resend`，執行後端分層檢查
- **THEN** 檢查以結束碼 0 結束

#### Scenario: 既有程式通過入口檢查

- **WHEN** 在本 change 合併時的 `backend/` 執行後端分層檢查
- **THEN** 檢查以結束碼 0 結束，且沒有任何入口契約被破壞

### Requirement: 單一入口清單只有一個來源，無法機械檢查的項目要寫明

規則文件 SHALL 有且只有一處定義後端單一入口清單與各入口的禁止清單，共七項：寄信、Google OIDC、取得目前使用者、對外 HTTP 客戶端、發 session cookie 的 helper、CSRF 驗證 middleware、資料庫 session 取得。有專屬第三方套件的三項標明由分層檢查擋下；其餘四項標「待建置」並寫明原因。「尚未檢查」寫明標準庫的 HTTP 客戶端無法被擋，適用路徑只有 `backend/app/**`。其他規則的檢查方式 MUST 只指向該清單。

來源：issue #563 工作項 1、6；Epic #560；backend-agent-rules B1、B3、B5、B12（新）；security-agent-rules S1、S2；ADR-004 D3；clarification Q1、Q7、Q10、N1、N5、N8。

#### Scenario: 清單列出七項並標明檢查狀態

- **WHEN** 讀取 `backend-agent-rules.mdx` 的 B12
- **THEN** 清單恰有七項，寄信、Google OIDC、對外 HTTP 客戶端三項標明由分層檢查擋下並列出各自的禁止清單，取得目前使用者、發 session cookie 的 helper、CSRF 驗證 middleware、資料庫 session 取得四項各標「待建置」並寫明原因

#### Scenario: 限制與適用路徑寫明

- **WHEN** 讀取 B12 的「尚未檢查」與適用路徑
- **THEN** 內容寫明標準庫的 `urllib.request` 與 `http.client` 無法被擋，適用路徑為 `backend/app/**`，且未宣稱任何其他工具補得上這個缺口

#### Scenario: B1 與 B5 只指向清單

- **WHEN** 讀取 B1 的檢查方式與 B5 的「待建置」說明
- **THEN** B1 指向 B12 取得入口與跨模組契約，不重複列出禁止清單；B5 註明分層檢查只能擋整個套件、擋不了 `text` 這種名稱

### Requirement: `app` 底下每個頂層套件都受入口契約檢查

`backend/app/` 底下的每一個頂層套件或模組，SHALL 不是已列入每一條入口契約的檢查來源，就是已登記的入口套件；兩者皆非時，後端測試 MUST 失敗並指出該套件名。已登記的入口套件 MUST NOT 同時出現在任何入口契約的檢查來源內。今天沒有已登記的入口套件。

來源：issue #563 工作項 2；Epic #560；backend-agent-rules B12（新）；clarification Q3、N6；system-design §守門測試。

#### Scenario: 新的頂層套件未歸類時測試失敗

- **WHEN** 樣本樹在 `app/` 下新增 `stray` 套件，既沒有列入入口契約的檢查來源，也沒有登記為入口套件，執行守門測試
- **THEN** 測試失敗，訊息點名 `stray`

#### Scenario: 已登記的入口套件被放進檢查來源時測試失敗

- **WHEN** 某套件已登記為入口套件，卻同時列在某條入口契約的檢查來源，執行守門測試
- **THEN** 測試失敗，訊息點名該套件與該契約

#### Scenario: 入口契約漏列既有頂層套件時測試失敗

- **WHEN** 某條入口契約的檢查來源少列了 `app` 底下既有的頂層套件，執行守門測試
- **THEN** 測試失敗，訊息點名該契約與缺少的套件

#### Scenario: 既有的 app 通過守門測試

- **WHEN** 在本 change 合併時的 `backend/` 執行守門測試
- **THEN** 測試通過

### Requirement: 每個被 import 的第三方套件都已歸類

`backend/app/` 實際 import 到的每一個第三方套件（標準庫除外），SHALL 歸類為「某入口的套件」或「一般套件」兩者之一；未歸類時，後端測試 MUST 失敗並指出套件名。「某入口的套件」的清單 MUST 與入口契約的禁止清單一致：任一邊多出或缺少套件，後端測試 MUST 失敗並指出差異。

來源：issue #563 工作項 3；Epic #560；backend-agent-rules B12（新）；clarification Q4、N6。

#### Scenario: 未歸類的第三方套件使測試失敗

- **WHEN** 樣本樹中某檔 `import requests`，而 `requests` 不在一般套件清單也不在任何入口的套件清單，執行分類測試
- **THEN** 測試失敗，訊息點名 `requests`，並說明要歸為一般套件或登記為入口的套件

#### Scenario: 標準庫不需歸類

- **WHEN** 樣本樹中某檔 import `json` 與 `pathlib`，執行分類測試
- **THEN** 測試不因這兩個套件失敗

#### Scenario: 傳遞相依被直接 import 時也被看見

- **WHEN** 樣本樹中某檔 import 一個沒有出現在任何歸類清單的套件，無論該套件是否列在專案的宣告相依裡，執行分類測試
- **THEN** 測試失敗並點名該套件

#### Scenario: 入口的套件清單與契約禁止清單不一致時測試失敗

- **WHEN** 測試的某入口套件清單比對應契約的禁止清單多一個套件，或少一個套件，執行一致性測試
- **THEN** 測試失敗，訊息點名該入口與有差異的套件

#### Scenario: 既有的 app 全部已歸類

- **WHEN** 在本 change 合併時的 `backend/` 對真實的 `app` 執行分類測試
- **THEN** 測試通過，沒有任何未歸類的套件

### Requirement: 業務模組之間不得互相 import

`app/modules/` 底下的任兩個業務模組 MUST NOT 互相 import，不分 router、service、repository、models 或 schemas；違反時分層檢查 MUST 以非 0 結束，並指出被違反的契約與 import 鏈。契約 SHALL 涵蓋每個現有與日後新增的模組，不需逐一列名。`app/main.py` 同時 import 多個模組不算違反。需要跨模組共用的功能，其放行方式由日後的功能 change 決定，今天沒有任何放行。

來源：issue #563 工作項 2、5；Epic #560；backend-agent-rules B1、B12（新）；ADR-003 D3；clarification Q2、Q5。

#### Scenario: 一個模組的 router import 另一個模組的 service 時檢查失敗

- **WHEN** 樣本樹中 `health` 模組的 router import `other` 模組的 service，執行後端分層檢查
- **THEN** 檢查以非 0 結束，輸出指出「Modules do not import each other」被違反，以及從 `app.modules.health.router` 到 `app.modules.other.service` 的 import 鏈

#### Scenario: 新增的模組也受跨模組檢查

- **WHEN** 樣本樹新增第三個模組，其 service import `health` 模組的 schemas，執行後端分層檢查
- **THEN** 檢查以非 0 結束，並指出「Modules do not import each other」被違反

#### Scenario: 組裝點 import 多個模組不違反獨立性

- **WHEN** 樣本樹中 `app/main.py` 同時 import 兩個模組的 router，執行後端分層檢查
- **THEN** 檢查以結束碼 0 結束

### Requirement: Router 只由組裝點 import

任何模組的 router SHALL 只被 `app/main.py` import；其他任何檔案（包含同一模組與其他模組的 service、repository）import router 時，分層檢查 MUST 以非 0 結束，並指出被違反的契約與 import 鏈。

來源：issue #563 工作項 2、5；Epic #560；backend-agent-rules B1、B12（新）；ADR-003 D3；clarification Q5。

#### Scenario: 其他模組的 service import router 時檢查失敗

- **WHEN** 樣本樹中 `health` 模組的 service import `other` 模組的 router，執行後端分層檢查
- **THEN** 檢查以非 0 結束，並指出「Only the assembly point imports routers」被違反

#### Scenario: 同一模組內的 service import 自己的 router 時檢查失敗

- **WHEN** 樣本樹中 `health` 模組的 service import 同模組的 router，執行後端分層檢查
- **THEN** 檢查以非 0 結束，並指出被違反的契約

#### Scenario: 組裝點 import router 時通過

- **WHEN** 樣本樹中 `app/main.py` import 各模組的 router，執行後端分層檢查
- **THEN** 檢查以結束碼 0 結束

### Requirement: 檢查豁免必須帶理由與來源，過期即失敗

契約若以 `ignore_imports` 放行某條 import，每一條放行 MUST 在設定檔緊接其上的註解寫明理由與來源（issue 編號或規則編號），否則後端測試 MUST 失敗並指出該條。任何契約 MUST NOT 設定關閉「放行項已不存在」警示的選項，設定時後端測試 MUST 失敗；因此放行項在其所指的 import 不再存在時，分層檢查 MUST 以非 0 結束。今天沒有任何豁免，也沒有白名單。

來源：issue #563 工作項 4；Epic #560；backend-agent-rules B12（新）；clarification Q6、N6；system-design §Q6。

#### Scenario: 放行項沒有註解時測試失敗

- **WHEN** 樣本設定檔的某條 `ignore_imports` 緊接其上沒有註解，執行豁免註解測試
- **THEN** 測試失敗，訊息點名該契約與該條放行

#### Scenario: 註解沒有來源時測試失敗

- **WHEN** 樣本設定檔的某條放行有註解，但註解沒有 issue 編號或規則編號，執行豁免註解測試
- **THEN** 測試失敗，訊息點名該條放行

#### Scenario: 註解同時有理由與來源時通過

- **WHEN** 樣本設定檔的某條放行，其上註解寫了理由並含 `#563` 或 `B12`，執行豁免註解測試
- **THEN** 測試通過

#### Scenario: 契約關閉過期警示時測試失敗

- **WHEN** 樣本設定檔的某條契約設定了關閉「放行項已不存在」警示的選項（不論值為 `warn` 或 `none`），執行豁免註解測試
- **THEN** 測試失敗，訊息點名該契約

#### Scenario: 過期的放行項使分層檢查失敗

- **WHEN** 樣本樹的某條契約放行一條實際不存在的 import，執行後端分層檢查
- **THEN** 檢查以非 0 結束，並指出該放行項沒有對應的 import

#### Scenario: 既有設定沒有任何豁免

- **WHEN** 在本 change 合併時的 `backend/pyproject.toml` 執行豁免註解測試
- **THEN** 測試通過，且設定檔沒有任何 `ignore_imports`

### Requirement: 契約集合以數量與名稱比對，並由常駐違規樣本證明有效

後端測試 SHALL 以契約數量與契約名稱集合比對 `backend/pyproject.toml` 的 import 契約，而不是寫死的數字；增、刪或改名任一契約而沒有同步更新預期名稱集合時，測試 MUST 失敗。本 change 之後契約集合為九條：既有四條與「Mail only through its entry」「Outbound HTTP only through its entry」「OIDC only through its entry」「Modules do not import each other」「Only the assembly point imports routers」。每一條新契約 SHALL 有常駐的違規樣本，在暫存的樣本樹證明違規時分層檢查以非 0 結束，使契約被改寬時下一次 CI 就失敗。

來源：issue #563 工作項 5；Epic #560；testing-agent-rules T6、T9；backend-agent-rules B1、B12（新）；clarification Q9。

#### Scenario: 乾淨的樣本樹通過全部契約

- **WHEN** 乾淨的樣本樹執行後端分層檢查
- **THEN** 檢查以結束碼 0 結束，輸出的契約通過數等於設定檔的契約數，且沒有被破壞的契約

#### Scenario: 刪一條契約同時加一條時測試失敗

- **WHEN** 設定檔刪除一條契約並新增另一條，使契約總數不變，執行契約名稱測試
- **THEN** 測試失敗，訊息點名缺少與多出的契約名稱

#### Scenario: 每條新契約都有會失敗的樣本

- **WHEN** 對五條新契約各自在樣本樹加入一個違規 import，執行後端分層檢查
- **THEN** 每一個樣本的檢查都以非 0 結束，並點名對應的契約

## MODIFIED Requirements

### Requirement: 每個模組都受分層檢查

`app/modules/` 下的每一個模組 SHALL 都在分層檢查的範圍內，健康檢查模組也不例外，範圍包含模組內分層、router 不用資料層、資料層不處理 HTTP、「業務模組之間不得互相 import」與「Router 只由組裝點 import」；新增模組卻沒有納入檢查範圍時，後端測試 MUST 失敗並指出模組名。跨模組的兩條契約 SHALL 以涵蓋每個模組的寫法納入範圍；把寫法改成只列明部分模組致使某模組漏檢時，後端測試 MUST 失敗並指出模組名。

來源：backend-agent-rules B1 §例外（Q12 (f) 補的字句）；#504 Q8；clarification §交給後續產出（N5）；issue #563 工作項 2、5；Epic #560；backend-agent-rules B12（新）；clarification Q5。

#### Scenario: 新模組未列入檢查時測試失敗

- **WHEN** 在 `app/modules/` 新增一個模組套件，但沒有把它納入分層檢查的範圍，執行後端測試
- **THEN** 測試失敗，訊息指出未受檢的模組名

#### Scenario: 健康檢查模組也受檢

- **WHEN** 健康檢查模組的 router 檔 import 它的 repository，執行後端分層檢查
- **THEN** 檢查以非 0 結束

#### Scenario: 跨模組契約被改成明列單一模組時測試失敗

- **WHEN** 「業務模組之間不得互相 import」或「Router 只由組裝點 import」的涵蓋範圍被改成只列明 `health`，而 `app/modules/` 下還有其他模組，執行後端測試
- **THEN** 測試失敗，訊息指出未受檢的模組名

#### Scenario: 新模組同時受跨模組契約檢查

- **WHEN** 樣本樹新增一個模組，其 router 檔 import 另一個模組的 service，執行後端分層檢查
- **THEN** 檢查以非 0 結束，並指出「Modules do not import each other」被違反

### Requirement: 應用組裝點可以匯入多個模組

應用的組裝點（`app/main.py`）SHALL 可以 import 多個模組的 router；這不算違反分層檢查，也不算違反「業務模組之間不得互相 import」與「Router 只由組裝點 import」。除組裝點以外的任何檔案 import router，MUST 仍由後者擋下。

來源：backend-agent-rules B1；system-design §後端：分層 import 檢查的對象；issue #563 工作項 2；Epic #560；backend-agent-rules B12（新）；clarification Q5。

#### Scenario: 組裝點匯入多個模組的路由不報錯

- **WHEN** `app/main.py` import 兩個不同模組的 router，執行後端分層檢查
- **THEN** 檢查不因此報錯

#### Scenario: 組裝點以外的檔案 import router 仍被擋

- **WHEN** 樣本樹中 `app/main.py` import 兩個模組的 router，且另一個模組的 service import 其中一個 router，執行後端分層檢查
- **THEN** 檢查以非 0 結束，並指出「Only the assembly point imports routers」被違反
