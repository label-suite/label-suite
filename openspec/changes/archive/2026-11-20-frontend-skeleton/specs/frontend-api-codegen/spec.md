# Spec Delta

## Purpose

定義前端呼叫層如何由後端的介面描述檔產生：一條指令重產、產物進版控、產物與描述檔不同步時檢查失敗，並規定產生的呼叫函式、快取鍵、型別與測試用模擬回應的名稱，讓前端只透過產生的呼叫層與後端溝通。

## ADDED Requirements

### Requirement: 一條指令由介面描述檔重產呼叫層

前端 SHALL 提供一條指令，只讀取後端進版控的介面描述檔（`backend/openapi.json`），重產前端的呼叫層產物到固定目錄（`frontend/src/api/generated/`）；重產 MUST 先清空該目錄，不保留描述檔已刪除端點的舊產物；指令不得啟動後端、不得連網。

來源：ADR-003 D6；api-agent-rules A4、A5；clarification Q8。

#### Scenario: 一條指令由介面描述檔重產呼叫層

- **WHEN** 開發者在乾淨的工作區執行重產指令
- **THEN** 指令以結束碼 0 結束，產物目錄出現健康檢查的呼叫函式、快取鍵函式、型別與模擬回應
- **AND** 執行期間沒有對任何網路位址發出連線

#### Scenario: 描述檔刪除的端點不留在產物中

- **WHEN** 產物目錄中有一個描述檔已不存在的端點留下的檔案，開發者執行重產指令
- **THEN** 該檔案不再存在於產物目錄

### Requirement: 產物進版控且不同步時檢查失敗

產生的呼叫層 SHALL 進版控；在描述檔沒變的情況下執行重產指令後，產物目錄 MUST 沒有任何已追蹤檔案的差異，也沒有未追蹤檔案。有差異或多出檔案時，檢查 SHALL 以非 0 結束碼失敗，且產物目錄不得被格式化工具改寫。

來源：ADR-003 D6；api-agent-rules A4、A5；`api-contract.md` §不同步的定義；clarification Q8。

#### Scenario: 產物與描述檔同步時檢查通過

- **WHEN** 產物已依目前的描述檔重產並提交，開發者再次執行重產指令後跑不同步檢查
- **THEN** 檢查以結束碼 0 結束

#### Scenario: 描述檔改了卻沒重產時檢查失敗

- **WHEN** 描述檔的健康檢查回應多了一個欄位，產物沒有重產就跑不同步檢查
- **THEN** 檢查以非 0 結束碼失敗，輸出列出產物目錄中有差異的檔案

#### Scenario: 產物被手改時檢查失敗

- **WHEN** 開發者手動修改產物目錄中的一個檔案後跑不同步檢查
- **THEN** 檢查以非 0 結束碼失敗

#### Scenario: 格式化不改寫產物目錄

- **WHEN** 開發者對整個專案執行格式化檢查
- **THEN** 產物目錄中的檔案不被列入檢查也不被改寫

### Requirement: 產生的呼叫層名稱固定且經唯一出口

健康檢查的產物 SHALL 提供下列固定名稱：查詢 hook `useGetHealth`、呼叫函式 `getHealth`、快取鍵 `getGetHealthQueryKey`、查詢選項 `getGetHealthQueryOptions`、錯誤型別 `GetHealthQueryError`、模擬回應 `getGetHealthMockHandler` 與 `getGetHealthResponseMock`、型別 `HealthData`、`HealthDataResponse`、`HealthStatus`、`ErrorResponse`、`ErrorDetail`。產生的呼叫函式 MUST 經唯一出口送出請求並傳入取消訊號，呼叫成功的回傳形狀為 `{ data, meta }`，錯誤型別為單一錯誤型別。

來源：ADR-003 D6；api-agent-rules A5、A6；`api-contract.md` §產生的程式碼合約；clarification Q2、Q19（C1）。

#### Scenario: 產物提供契約列出的名稱

- **WHEN** 檢查重產後的產物匯出
- **THEN** 上述十二個名稱都存在於產物的匯出中

#### Scenario: 產生的查詢 hook 回傳資料與追蹤資訊

- **WHEN** 測試用模擬伺服器以健康正常的成功外層回應，元件使用健康檢查的查詢 hook
- **THEN** hook 的資料為 `{ data: { status: "ok", database: "ok" }, meta: { traceId, timestamp } }`，`traceId` 與 `timestamp` 等於成功外層的同名欄位

#### Scenario: 產生的查詢 hook 的錯誤是單一錯誤型別

- **WHEN** 測試用模擬伺服器以 `503` 錯誤外層回應，元件使用健康檢查的查詢 hook
- **THEN** hook 的錯誤通過單一錯誤型別的判定，`kind` 為 `http`、`status` 為 `503`

### Requirement: 測試用模擬回應只出現在測試中

產物附帶的模擬回應與假資料產生器 SHALL 只被測試程式碼使用；正式建置的輸出 MUST NOT 含模擬伺服器或假資料產生器的程式碼。

來源：ADR-007 D1；testing-agent-rules T6；clarification Q1、Q6。

#### Scenario: 正式建置不含模擬伺服器

- **WHEN** 執行正式建置
- **THEN** 建置輸出的所有 JavaScript 檔案都不含模擬伺服器套件與假資料產生器套件的程式碼
