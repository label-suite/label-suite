## MODIFIED Requirements

### Requirement: 匯出指令不需環境變數與資料庫並產出穩定的檔案

系統 SHALL 提供一個匯出指令，在不設任何環境變數、沒有可用資料庫的情況下產出介面描述檔。不帶輸出路徑時，指令 MUST 把同一份內容同時寫到 `backend/openapi.json` 與文件站副本 `docs/diagrams/architecture/api.openapi.json`，兩份位元組完全相同；帶輸出路徑時 MUST 只寫該路徑，不寫副本。輸出 MUST 鍵名排序、縮排 2 個空白、以換行結尾；程式未變時重複匯出 MUST 產生位元組完全相同的檔案。寫出多個檔案時，寫入暫存內容的階段任一處失敗 MUST 使所有目標的既有檔案維持原樣、不留暫存檔或半成品，且指令以非零狀態結束。

來源：issue #572 §維護者裁定（2026-11-23）、clarification Q1；api-agent-rules A4、A5、testing-agent-rules T4、clarification Q8（N2）；ADR-003 D6（副本不是第二個契約來源）。

#### Scenario: 不設環境變數即可匯出

- **WHEN** 在沒有設定 `CORS_ALLOWED_ORIGINS`、`DATABASE_URL`、`SQLITE_PATH` 的環境執行匯出指令
- **THEN** 指令以狀態 0 結束，`backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 被寫出，且沒有建立任何 SQLite 檔

#### Scenario: 重複匯出內容相同

- **WHEN** 程式未變，連續執行兩次匯出指令
- **THEN** 兩次產出的 `backend/openapi.json` 位元組完全相同，檔案以換行結尾、縮排為 2 個空白、物件鍵依字母排序
- **AND** 兩次產出的 `docs/diagrams/architecture/api.openapi.json` 也位元組完全相同

#### Scenario: 提交的介面描述檔與程式一致

- **WHEN** 在本 change 完成的程式上執行匯出指令
- **THEN** 產出的 `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 都與版本庫中提交的檔案沒有差異

#### Scenario: 匯出指令預設同時寫出兩份內容相同的契約

- **WHEN** 不帶輸出路徑執行匯出指令
- **THEN** 指令以狀態 0 結束
- **AND** `backend/openapi.json` 與 `docs/diagrams/architecture/api.openapi.json` 都存在，且兩份位元組完全相同

#### Scenario: 帶輸出路徑時只寫該處

- **WHEN** 帶一個暫存目錄下的輸出路徑執行匯出指令
- **THEN** 指令以狀態 0 結束，該路徑被寫出
- **AND** 暫存目錄只出現該檔，`docs/diagrams/architecture/api.openapi.json` 的內容與修改時間不變

#### Scenario: 匯出途中寫入失敗時兩處都不留半成品

- **WHEN** 匯出指令要寫出兩個目標（測試以暫存目錄下的兩個路徑代替），其中一個目標所在的目錄不存在，而另一個目標已有既有內容
- **THEN** 指令以非零狀態結束，並在標準錯誤寫出原因
- **AND** 兩個目標的既有檔案位元組不變，兩個目標所在目錄都沒有留下暫存檔或半成品
