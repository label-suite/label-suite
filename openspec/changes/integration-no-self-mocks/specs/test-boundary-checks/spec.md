# Spec Delta

## Purpose

定義後端 integration 測試與 harness 組裝檔不得把本專案自己的模組換成替身的機械檢查：被擋下的寫法與允許的邊界、檢查的範圍、不另建應用程式、harness 與 production 組裝一致、例外的記法，以及常駐樣本如何證明檢查仍然有效。

## ADDED Requirements

### Requirement: 不得以字串指名替換本專案的模組

在檢查範圍內，以字串指名替換目標的寫法（`monkeypatch.setattr`、`setitem`、`delattr`、`delitem`、`patch`、`patch.dict`、`patch.multiple` 的第一個位置參數，或以關鍵字參數 `target=` 指名的目標），字串為 `app` 或以 `app.` 開頭時（含單引號、雙引號與 f-string），測試替身邊界檢查 SHALL 判為違規，並 MUST 在輸出列出檔案、行號與規則 id。

來源：issue #562 工作項 1、2；Epic #560；testing-agent-rules T4、T6；clarification Q1、Q2。

#### Scenario: 字串目標被擋

- **WHEN** `backend/tests/integration/` 底下的測試檔含 `monkeypatch.setattr("app.main.create_app", fake)`，執行測試替身邊界檢查
- **THEN** 檢查以非 0 結束，輸出列出該檔、該行行號與字串目標那條規則的 id

#### Scenario: 各種字串寫法都被擋

- **WHEN** 檢查範圍內的檔案分別含 `patch("app.core.config.Settings")`（裝飾器、`with` 與一般呼叫各一處）、`monkeypatch.setattr('app.main.x', 1)`、`monkeypatch.setattr(f"app.{name}.x", 1)`、`monkeypatch.delattr("app.main.x")`、`monkeypatch.setattr(target="app.main.x", value=1)`
- **THEN** 每一處都被列為違規

#### Scenario: 名稱只是以 app 開頭的字串不擋

- **WHEN** 檢查範圍內的檔案含 `monkeypatch.setattr("application.x", 1)`
- **THEN** 該行不被列為違規

### Requirement: 不得替換從本專案匯入的物件

在檢查範圍內，`monkeypatch.setattr`、`setitem`、`delattr`、`delitem`、內建 `setattr`、`patch`、`patch.object`、`patch.dict`、`patch.multiple`（不論接收者名稱）的第一個參數是從本專案 `app` 套件匯入的物件或其屬性時，測試替身邊界檢查 SHALL 判為違規；匯入的寫法（`from app… import x`、`import app.x as y`、`import app.x`）與匯入後的別名 MUST NOT 影響判定。

來源：issue #562 工作項 1、2；Epic #560；testing-agent-rules T4；clarification Q1、N4。

#### Scenario: 匯入物件被擋

- **WHEN** 檢查範圍內的檔案以 `from app.core.config import Settings` 匯入後寫 `monkeypatch.setattr(Settings, "model_config", {})`，執行測試替身邊界檢查
- **THEN** 檢查以非 0 結束，輸出列出該行與匯入物件那條規則的 id

#### Scenario: 別名與巢狀屬性同樣被擋

- **WHEN** 檢查範圍內的檔案分別含 `import app.scripts.export_openapi as eo` 後的 `monkeypatch.setattr(eo, "build", fake)`、`import app.main` 後的 `monkeypatch.setattr(app.main.create_app, "x", 1)`、`with monkeypatch.context() as m: m.setattr(Settings, "x", 1)`、`patch.object(Settings, "x")`
- **THEN** 每一處都被列為違規

#### Scenario: harness 的 app 物件屬性被替換時同樣被擋

- **WHEN** 檢查範圍內的測試以名為 `app` 的 fixture 寫 `monkeypatch.setattr(app.router, "routes", [])`
- **THEN** 該行被列為違規；需要時只能以例外記法放行

### Requirement: export_openapi 的輸出路徑常數視為檔案系統邊界

以 `from app.scripts import export_openapi` 匯入、名稱為 `export_openapi`，並以位置參數指名 `DEFAULT_OUTPUT`、`DOCS_COPY_OUTPUT` 的替換 SHALL 視為檔案系統邊界而不判為違規；同一個模組的其他屬性，以及替換這兩個常數的其他別名或寫法（含 `import … as`、全路徑、關鍵字參數 `name=`），MUST 照樣判為違規。本 change 合併時的後端程式 MUST 在檢查範圍內沒有任何違規。

來源：issue #562 工作項 1、2；Epic #560；testing-agent-rules T4、T6；clarification Q3。

#### Scenario: 兩個輸出常數放行而其他屬性仍擋

- **WHEN** 檢查範圍內的檔案以 `from app.scripts import export_openapi` 匯入後，分別寫 `monkeypatch.setattr(export_openapi, "DEFAULT_OUTPUT", path)`、`monkeypatch.setattr(export_openapi, "DOCS_COPY_OUTPUT", path)` 與 `monkeypatch.setattr(export_openapi, "build_document", fake)`
- **THEN** 前兩行不被列為違規，第三行被列為違規

#### Scenario: 兩個輸出常數換個寫法仍被擋

- **WHEN** 檢查範圍內的檔案分別含 `import app.scripts.export_openapi as eo` 後的 `monkeypatch.setattr(eo, "DEFAULT_OUTPUT", path)`、`import app.scripts.export_openapi` 後的 `monkeypatch.setattr(app.scripts.export_openapi, "DOCS_COPY_OUTPUT", path)`，以及 `from app.scripts import export_openapi` 後的 `monkeypatch.setattr(export_openapi, name="DEFAULT_OUTPUT", value=path)`
- **THEN** 每一處都被列為違規

#### Scenario: 既有程式通過檢查

- **WHEN** 在本 change 合併時的 repo 根目錄對 `backend/` 執行測試替身邊界檢查
- **THEN** 檢查以結束碼 0 結束，沒有任何違規；`backend/tests/integration/test_export_openapi.py` 未被修改

### Requirement: 不得改寫應用程式的依賴覆寫表

在檢查範圍內，任何對應用程式 `dependency_overrides` 的寫入 SHALL 判為違規，包含以索引指派、以 `del` 刪除鍵、`update`、`setdefault`、`pop`、`popitem`、`clear`、`|=` 合併、整個重新指派，以及以 `monkeypatch.setitem` 或 `patch.dict` 指到它；只讀取 MUST NOT 判為違規。

來源：issue #562 工作項 1、2；Epic #560；testing-agent-rules T4；clarification Q1。

#### Scenario: dependency_overrides 寫入被擋

- **WHEN** 檢查範圍內的檔案分別含 `app.dependency_overrides[get_session] = fake_session`、`client.app.dependency_overrides.update({})`、`app.dependency_overrides = {}`、`app.dependency_overrides.clear()`、`app.dependency_overrides.popitem()`、`del app.dependency_overrides[get_session]`、`app.dependency_overrides |= {get_session: fake_session}`
- **THEN** 每一處都被列為違規，輸出列出依賴覆寫那條規則的 id

#### Scenario: 只讀取依賴覆寫表不擋

- **WHEN** 檢查範圍內的檔案含 `current = app.dependency_overrides`
- **THEN** 該行不被列為違規

### Requirement: 不得使用 mock 物件

在檢查範圍內，建立 `MagicMock`、`AsyncMock`、`Mock`、`create_autospec` 的 mock 物件，以及匯入 `unittest.mock`（`import unittest.mock`、`from unittest import mock`、`from unittest.mock import …`），SHALL 判為違規，不論 mock 物件或匯入的用途。

來源：issue #562 工作項 1、2；Epic #560；testing-agent-rules T4、T6；clarification Q1。

#### Scenario: mock 物件被擋

- **WHEN** 檢查範圍內的檔案分別含 `session = MagicMock()`、`send = AsyncMock(return_value=None)`、`create_autospec(Settings)` 與 `from unittest.mock import patch`
- **THEN** 每一處都被列為違規，輸出列出 mock 物件那條規則的 id

### Requirement: 外部邊界與行程環境的替換不受限

在網路邊界改為明列清單之前，目標不是本專案 `app` 套件的替換 SHALL 視為外部邊界而不判為違規；以 `monkeypatch.setenv`、`delenv`、`chdir` 改變環境變數與工作目錄 MUST NOT 判為違規。以 `unittest.mock` 替換外部目標時，匯入 `unittest.mock` 仍依「不得使用 mock 物件」判為違規；外部邊界 MUST 以 `monkeypatch` 替換。

來源：issue #562 工作項 1；Epic #560；testing-agent-rules T6；clarification Q1、Q2。

#### Scenario: setenv 與 chdir 不擋

- **WHEN** 檢查範圍內的檔案含 `monkeypatch.setenv("LOG_LEVEL", "DEBUG")`、`monkeypatch.delenv("DATABASE_URL", raising=False)`、`monkeypatch.chdir(tmp_path)`
- **THEN** 這三行都不被列為違規

#### Scenario: 替換外部目標不擋

- **WHEN** 檢查範圍內的檔案含 `monkeypatch.setattr(sys, "stderr", buffer)`、`monkeypatch.setattr("sys.stderr", buffer)` 與 `monkeypatch.setattr(httpx.AsyncClient, "send", fake_send)`
- **THEN** 這三行都不被列為違規

#### Scenario: 以 unittest.mock 替換外部目標仍被擋

- **WHEN** 檢查範圍內的檔案寫 `from unittest.mock import patch` 後以 `patch("httpx.AsyncClient.send")` 替換外部目標
- **THEN** 匯入那一行被列為違規，輸出列出 mock 物件那條規則的 id；`patch("httpx.AsyncClient.send")` 那一行不被字串目標或匯入物件的規則列為違規

#### Scenario: HTTP PATCH 路由裝飾器不被誤判

- **WHEN** 檢查範圍內的檔案以 `@router.patch("/items")` 宣告一條路由
- **THEN** 該行不被列為違規

### Requirement: 檢查範圍涵蓋 integration 與 harness 組裝檔

測試替身邊界檢查 SHALL 檢查 `backend/tests/integration/` 底下任一層的 Python 檔、`backend/tests/conftest.py`、`backend/tests/probe.py` 與 `backend/tests/factories/` 底下任一層的 Python 檔；這些檔案 MUST 實際被讀取，不得因位於 `tests/` 目錄而被略過。範圍外的檔案（含 `backend/tests/unit/`）MUST NOT 被判為違規。

來源：issue #562 工作項 1、2、5；Epic #560；testing-agent-rules T4；clarification Q2、Q4、Q8、N1、N2。

#### Scenario: conftest 與 probe 的違規被擋

- **WHEN** 暫時在 `backend/tests/conftest.py` 與 `backend/tests/probe.py` 各加一行 `monkeypatch.setattr("app.main.x", 1)`，在 repo 根目錄以 CI 使用的同一個指令對 `backend/` 執行測試替身邊界檢查
- **THEN** 檢查以非 0 結束，輸出列出這兩個檔案的該行

#### Scenario: integration 子目錄的違規被擋

- **WHEN** 暫時在 `backend/tests/integration/` 底下的既有測試檔加一行 `session = MagicMock()`，以同一個指令執行檢查
- **THEN** 檢查以非 0 結束，輸出列出該檔該行

#### Scenario: unit 測試不在範圍

- **WHEN** `backend/tests/unit/` 底下的測試檔含 `MagicMock()`、`monkeypatch.setattr("app.main.x", 1)` 或 `FastAPI()`，執行檢查
- **THEN** 這些行都不被列為違規

### Requirement: 檢查在 CI 每張 PR 執行且違規即失敗

CI 的 `semgrep` job SHALL 在每張 pull request 執行測試替身邊界檢查，排在規則樣本驗證之後；有任何違規 MUST 讓該 job 失敗並列出檔案、行號與規則 id。既有專案禁令掃描的規則集與掃描範圍 MUST NOT 因此改變。

來源：issue #562 工作項 2、6；Epic #560；testing-agent-rules T4、T6；clarification Q4、N1。

#### Scenario: PR 加入違規時 CI 失敗

- **WHEN** PR 在 `backend/tests/integration/` 的測試檔加入 `app.dependency_overrides[get_session] = fake_session`
- **THEN** CI 的 `semgrep` job 失敗，輸出列出該檔、行號與依賴覆寫那條規則的 id

#### Scenario: 既有專案禁令掃描不變

- **WHEN** 比對本 change 前後 CI 中專案禁令掃描那一步的指令
- **THEN** 指令完全相同，仍只載入專案禁令的規則集、掃描 `backend/ frontend/ e2e/`

### Requirement: 不得在 harness 範圍內另建應用程式

在檢查範圍內，直接建構 web 應用程式物件（`FastAPI(...)`、`fastapi.FastAPI(...)`、`Starlette(...)`、`starlette.applications.Starlette(...)`）SHALL 判為違規；harness MUST 透過 production 的應用程式組裝函式取得應用程式。

來源：issue #562 工作項 3；Epic #560；testing-agent-rules T4；clarification Q6。

#### Scenario: conftest.py 裡另建 FastAPI 被擋

- **WHEN** `backend/tests/conftest.py` 的 fixture 改成回傳 `FastAPI(title="test")`，執行測試替身邊界檢查
- **THEN** 檢查以非 0 結束，輸出列出該行與另建應用程式那條規則的 id

#### Scenario: 呼叫組裝函式不擋

- **WHEN** 檢查範圍內的檔案呼叫 `create_app(settings)` 並以 `include_router` 掛上路由
- **THEN** 這些行不被列為違規

### Requirement: harness 與 production 的組裝一致

後端測試 SHALL 以同一份測試設定各取得一個 production 組裝與一個 harness，比對三項：中介層的類別與順序相同、例外處理器的鍵相同、production 文件的每個 API 路徑都在 harness 中且內容相同。harness 多出的路徑 MUST 全屬探針路由；任一項不符時測試 MUST 失敗並指出不符的項目。比對不啟動應用程式的生命週期，也不連資料庫。

來源：issue #562 工作項 3、5；Epic #560；testing-agent-rules T4；clarification Q6、N6。

#### Scenario: harness 少了 production 的中介層時比對測試失敗

- **WHEN** harness 的中介層清單比 production 少一個，或順序與 production 不同，執行組裝比對
- **THEN** 比對失敗，訊息指出中介層不符並列出兩邊的清單

#### Scenario: harness 少了 production 的路徑時比對測試失敗

- **WHEN** production 的 API 文件有一個路徑在 harness 中不存在，執行組裝比對
- **THEN** 比對失敗，訊息列出缺少的路徑

#### Scenario: harness 少了例外處理器時比對測試失敗

- **WHEN** harness 的例外處理器比 production 少一個，執行組裝比對
- **THEN** 比對失敗，訊息列出缺少的例外處理器

#### Scenario: probe_router 的路徑允許

- **WHEN** 以 `backend/tests/conftest.py` 的 `app` fixture 為 harness、以同一份測試設定呼叫組裝函式為 production，執行組裝比對
- **THEN** 比對通過；harness 多出的路徑（例如 `/api/v1/probe`、`/api/v1/items/{item_id}`）都屬探針路由

#### Scenario: 多出非探針路徑時比對測試失敗

- **WHEN** harness 多掛一條不屬於探針路由的路徑，執行組裝比對
- **THEN** 比對失敗，訊息列出該路徑

### Requirement: 例外必須帶規則 id 與理由

`backend/tests/` 底下任一層的 Python 檔中，Semgrep 會認作例外標記的任何字樣（行首或空白之後緊接 `nosem` 的字樣，不分大小寫，含不在註解裡的，例如註解中段或字串常值裡的 ` nosemgrep`、` nosem`）SHALL 是寫成 `# nosemgrep: <規則 id> -- <理由>` 的合格標記，且一行只有這一個：規則 id 為測試替身邊界檢查的規則 id（可列多個，以逗號分隔），理由非空且引用 T4 或 T6。不符合此格式的字樣（含不帶規則 id 的裸標記、不以 `#` 開頭的字樣）MUST 讓後端測試失敗，並指出檔案與行號。

來源：issue #562 工作項 1、2；Epic #560；testing-agent-rules T4、T6；clarification Q7、N3、N4。

#### Scenario: 不帶理由的 nosemgrep 失敗

- **WHEN** `backend/tests/integration/` 底下的測試檔有一行尾端是 `# nosemgrep`，或 `# nosemgrep: label-suite-test-self-mock-object`（沒有 `--` 與理由），執行後端測試
- **THEN** 例外標記檢查失敗，訊息指出該檔與行號以及要求的格式

#### Scenario: 理由沒有引用條號時失敗

- **WHEN** 例外標記寫成 `# nosemgrep: label-suite-test-self-mock-object -- needed here`
- **THEN** 例外標記檢查失敗，訊息指出理由要引用 T4 或 T6

#### Scenario: 不在註解開頭的例外字樣同樣失敗

- **WHEN** 測試檔有一行寫成 `x = 1  # see nosemgrep docs`（註解中段），另一行的字串常值含 `" nosem"`（沒有 `#`）
- **THEN** 例外標記檢查失敗，兩行各自被列出檔案與行號

#### Scenario: 合格的例外通過且抑制該規則

- **WHEN** 檢查範圍內一行違規的同一行或上一行寫 `# nosemgrep: label-suite-test-self-mock-object -- T4 <理由>`
- **THEN** 例外標記檢查通過，測試替身邊界檢查不列出該行

#### Scenario: 指名別的規則不會放行

- **WHEN** 一行匯入物件的違規旁的例外標記只指名依賴覆寫那條規則的 id
- **THEN** 測試替身邊界檢查仍列出該行

### Requirement: 常駐樣本證明規則有效

測試替身邊界檢查的每條規則 SHALL 附常駐的應命中與不應命中樣本，CI 在檢查之前 MUST 驗證規則對樣本的結果，與標註不符時 MUST 失敗。樣本 MUST 以不標註的行記下已知擋不住的三種寫法：先指派給區域變數再傳入、在別處組出目標字串、先取出依賴覆寫表再寫入。

來源：issue #562 工作項 2、5；Epic #560；testing-agent-rules T4、T6；clarification Q8、N2、N5。

#### Scenario: 規則被改寬鬆時樣本驗證失敗

- **WHEN** PR 修改匯入物件那條規則，使一個標註為應命中的樣本不再被命中
- **THEN** CI 的 `semgrep` job 在規則樣本驗證那一步失敗，輸出列出漏掉的行

#### Scenario: 放行範圍被擴大時樣本驗證失敗

- **WHEN** PR 修改規則，使 `export_openapi` 的 `DEFAULT_OUTPUT`、`DOCS_COPY_OUTPUT` 以外的屬性（標註為應命中的樣本）也被放行
- **THEN** 規則樣本驗證失敗，輸出列出該行

#### Scenario: 已知擋不住的寫法被記下

- **WHEN** 讀取樣本檔
- **THEN** 三種已知擋不住的寫法各有一行，且不帶應命中或不應命中的標註；若規則日後能命中其中一行，規則樣本驗證失敗並列出該行

### Requirement: 規則文件寫出檢查方式與已知缺口

`testing-agent-rules.mdx` 的 T4、T6 SHALL 把本 capability 的檢查寫成實際指令與 CI 的 job，T4 的適用路徑 MUST 含 `backend/tests/conftest.py` 與 `backend/tests/probe.py`；T6 MUST 寫出三種已知擋不住的寫法，並寫明前端未納入、檢查方式維持「待建置」的原因。

來源：issue #562 工作項 4；Epic #560；testing-agent-rules T4、T6；clarification Q5、Q9、N5。

#### Scenario: T4 與 T6 的檢查方式是實際指令

- **WHEN** 讀取 `docs/development/rules/testing-agent-rules.mdx` 的 T4 與 T6 檢查方式
- **THEN** 兩條都寫出測試替身邊界檢查的指令與 CI 的 `semgrep` job；T4 寫出組裝比對測試的檔名；T4 的「harness 與 production 同構」不再標「待建置」

#### Scenario: 已知缺口與前端缺口寫在 T6

- **WHEN** 讀取 T6 的檢查方式
- **THEN** 列出區域變數轉手、在別處組字串、先取出依賴覆寫表再寫入三種擋不住的寫法；並寫明前端 integration 與 unit 測試同目錄、同副檔名而無法區分，前端部分仍為「待建置」
